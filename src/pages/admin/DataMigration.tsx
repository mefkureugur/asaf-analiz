import { useState, useMemo } from "react";
import { collection, doc, writeBatch, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../store/AuthContext";
import { useRecords, kayitAnahtari } from "../../hooks/useRecords";
import asafRecordsRaw from "../../data/excel2json-1769487741734.json";

/* =====================================================================
   VERİ AKTARIMI — TEK SEFERLİK

   Statik JSON'daki kayıtları Firestore'a taşır. Taşındıktan sonra
   kayıtlar düzenlenebilir ve iptal edilebilir hale gelir.

   GÜVENLİK: her kaydın kimliği içeriğinden türetilir (ad + tarih + okul
   + tutar). Aktarım ikinci kez çalıştırılsa bile aynı kayıt aynı kimliği
   alır, yani üzerine yazar — asla mükerrer oluşmaz.
   ===================================================================== */

/** FNV-1a — kararlı, hızlı, kriptografik olmayan özet. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Çakışma olasılığını yok denecek düzeye indirmek için iki yönlü özet. */
function belgeKimligi(anahtar: string, tekrarNo: number): string {
  const a = fnv1a(anahtar).toString(16).padStart(8, "0");
  const b = fnv1a(anahtar.split("").reverse().join("")).toString(16).padStart(8, "0");
  return `excel_${a}${b}_${tekrarNo}`;
}

export default function DataMigration() {
  const { user } = useAuth();
  const { sayim, aktarimYapildi, loading, tumKayitlar } = useRecords();

  const [durum, setDurum] = useState<"hazir" | "calisiyor" | "bitti" | "hata">("hazir");
  const [ilerleme, setIlerleme] = useState(0);
  const [mesaj, setMesaj] = useState("");
  const [onayMetni, setOnayMetni] = useState("");

  const isAdmin = user?.role?.trim().toLowerCase() === "admin" || user?.email === "ugur@asaf.com";

  /** JSON kayıtlarını kararlı kimlikleriyle hazırla. */
  const hazirlanan = useMemo(() => {
    const ham = Array.isArray(asafRecordsRaw) ? asafRecordsRaw : [];
    const tekrarSayaci = new Map<string, number>();
    const mukerrerler: string[] = [];

    const kayitlar = ham.map((r: any) => {
      const anahtar = kayitAnahtari(r);
      const n = tekrarSayaci.get(anahtar) ?? 0;
      tekrarSayaci.set(anahtar, n + 1);
      if (n > 0) mukerrerler.push(`${r.ÖğrenciAdSoyad} — ${r.SözleşmeTarihi} — ${r.Okul}`);

      return {
        id: belgeKimligi(anahtar, n),
        veri: {
          studentName: String(r.ÖğrenciAdSoyad || "").trim(),
          Sınıf: String(r.Sınıf ?? "").replace(".0", "").trim(),
          Okul: String(r.Okul || "").trim(),
          SonTutar: Number(r.SonTutar || 0),
          SözleşmeTarihi: String(r.SözleşmeTarihi || ""),
          SözleşmeBitişTarihi: String(r.SözleşmeBitişTarihi || ""),
          KayıtDurumu: String(r.KayıtDurumu || "Aktif").trim(),
          source: "excel",
          aktarimTarihi: new Date().toISOString(),
          aktaran: user?.email || "bilinmiyor",
        },
      };
    });

    return { kayitlar, mukerrerler };
  }, [user]);

  /**
   * ÇAKIŞMA KONTROLÜ
   * Elle girilmiş kayıtlardan biri, aktarılacak sabit kayıtla aynı kişi
   * olabilir (aynı ad + tarih + okul + tutar). Bu durumda aktarım sonrası
   * öğrenci iki kez sayılır. Aktarımdan ÖNCE görünmesi gerekiyor.
   */
  const cakisanlar = useMemo(() => {
    const manuelAnahtarlar = new Map<string, any>();
    tumKayitlar
      .filter((r) => r.kaynak === "manual")
      .forEach((r) => manuelAnahtarlar.set(kayitAnahtari(r), r));

    const bulunan: { ad: string; tarih: string; okul: string }[] = [];
    (Array.isArray(asafRecordsRaw) ? asafRecordsRaw : []).forEach((r: any) => {
      if (manuelAnahtarlar.has(kayitAnahtari(r))) {
        bulunan.push({ ad: r.ÖğrenciAdSoyad, tarih: r.SözleşmeTarihi, okul: r.Okul });
      }
    });
    return bulunan;
  }, [tumKayitlar]);

  /**
   * Aynı isim, farklı tarih: aynı öğrenci farklı dönemde tekrar kayıt olmuş
   * olabilir. Bunlar AYRI kayıttır, birleştirilmez — burada yalnızca bilgi
   * amaçlı sayılıyor ki aktarım sonrası "neden iki kere görünüyor" sorusu
   * doğmasın.
   */
  const ayniIsimFarkliTarih = useMemo(() => {
    const manuelIsimler = new Map<string, Set<string>>();
    tumKayitlar
      .filter((r) => r.kaynak === "manual")
      .forEach((r) => {
        const ad = String(r.studentName || "").trim().toLocaleUpperCase("tr-TR");
        if (!ad) return;
        if (!manuelIsimler.has(ad)) manuelIsimler.set(ad, new Set());
        manuelIsimler.get(ad)!.add(String(r.SözleşmeTarihi || ""));
      });

    let sayi = 0;
    (Array.isArray(asafRecordsRaw) ? asafRecordsRaw : []).forEach((r: any) => {
      const ad = String(r.ÖğrenciAdSoyad || "").trim().toLocaleUpperCase("tr-TR");
      const tarihler = manuelIsimler.get(ad);
      if (tarihler && !tarihler.has(String(r.SözleşmeTarihi || ""))) sayi++;
    });
    return sayi;
  }, [tumKayitlar]);

  const toplamTutar = useMemo(
    () => hazirlanan.kayitlar.reduce((t, k) => t + k.veri.SonTutar, 0),
    [hazirlanan]
  );

  async function aktar() {
    setDurum("calisiyor");
    setIlerleme(0);
    setMesaj("Aktarım başlıyor…");

    try {
      const PARCA = 400; // Firestore toplu yazma sınırı 500
      const toplam = hazirlanan.kayitlar.length;

      for (let i = 0; i < toplam; i += PARCA) {
        const parca = hazirlanan.kayitlar.slice(i, i + PARCA);
        const batch = writeBatch(db);
        parca.forEach((k) => batch.set(doc(db, "records", k.id), k.veri));
        await batch.commit();
        setIlerleme(Math.min(i + PARCA, toplam));
        setMesaj(`${Math.min(i + PARCA, toplam)} / ${toplam} kayıt aktarıldı…`);
      }

      // Doğrulama: gerçekten kaç tane yazıldı?
      const kontrol = await getDocs(query(collection(db, "records"), where("source", "==", "excel")));
      setMesaj(`Aktarım tamamlandı. Veritabanında ${kontrol.size} adet sabit kayıt var.`);
      setDurum("bitti");
    } catch (e: any) {
      setMesaj(`Hata: ${e?.message || e}`);
      setDurum("hata");
    }
  }

  if (!isAdmin) {
    return (
      <div className="page rise" style={{ maxWidth: 600, textAlign: "center", paddingTop: "var(--sp-7)" }}>
        <h2>Bu sayfa yalnızca yöneticiye açıktır.</h2>
      </div>
    );
  }

  const onayGecerli = onayMetni.trim().toLocaleUpperCase("tr-TR") === "AKTAR";

  return (
    <div className="page rise" style={{ maxWidth: 720 }}>
      <h1>Veri Aktarımı</h1>
      <p>
        Uygulamanın içine gömülü olan sabit öğrenci kayıtlarını veritabanına taşır.
        Aktarımdan sonra bu kayıtlar da listede görünür, düzenlenebilir ve iptal edilebilir.
      </p>

      {/* Mevcut durum */}
      <div className="card" style={{ marginBottom: "var(--sp-5)" }}>
        <div className="label" style={{ marginBottom: "var(--sp-3)" }}>MEVCUT DURUM</div>
        {loading ? (
          <div style={{ color: "var(--text-2)" }}>Yükleniyor…</div>
        ) : (
          <div style={{ display: "grid", gap: "var(--sp-2)" }}>
            <Satir etiket="Gömülü dosyadaki kayıt" deger={hazirlanan.kayitlar.length} />
            <Satir etiket="Veritabanındaki sabit kayıt" deger={sayim.excel} />
            <Satir etiket="Elle girilmiş kayıt" deger={sayim.manual} />
            <Satir etiket="İptal edilmiş kayıt" deger={sayim.iptal} />
            <Satir
              etiket="Aktarım durumu"
              deger={aktarimYapildi ? "Yapılmış ✓" : "Henüz yapılmadı"}
              vurgu={aktarimYapildi ? "var(--success)" : "var(--warning)"}
            />
          </div>
        )}
      </div>

      {/* Aktarılacak içerik */}
      <div className="card" style={{ marginBottom: "var(--sp-5)" }}>
        <div className="label" style={{ marginBottom: "var(--sp-3)" }}>AKTARILACAK</div>
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          <Satir etiket="Kayıt sayısı" deger={hazirlanan.kayitlar.length} />
          <Satir etiket="Toplam tutar" deger={`₺${toplamTutar.toLocaleString("tr-TR")}`} />
          <Satir etiket="Dosyadaki mükerrer" deger={hazirlanan.mukerrerler.length} />
          <Satir etiket="Elle girilmişle çakışan" deger={cakisanlar.length}
                 vurgu={cakisanlar.length ? "var(--danger)" : "var(--success)"} />
          <Satir etiket="Aynı isim, farklı tarih" deger={ayniIsimFarkliTarih} />
        </div>
        <div className="caption" style={{ marginTop: "var(--sp-3)" }}>
          Kayıtlar ad + <strong>tarih</strong> + okul + tutar birlikte karşılaştırılır. Aynı
          öğrenci farklı tarihte tekrar kayıt olmuşsa <strong>ayrı kayıt</strong> sayılır,
          birleştirilmez.
        </div>
        {hazirlanan.mukerrerler.length > 0 && (
          <div className="caption" style={{ marginTop: "var(--sp-3)", color: "var(--warning)" }}>
            Aynı ad, tarih, okul ve tutara sahip kayıtlar ayrı ayrı aktarılır (gerçekten iki
            sözleşme olabilir): {hazirlanan.mukerrerler.slice(0, 3).join(" · ")}
          </div>
        )}
      </div>

      {/* Çakışma uyarısı */}
      {cakisanlar.length > 0 && (
        <div className="card" style={{ marginBottom: "var(--sp-5)", borderLeft: "3px solid var(--danger)" }}>
          <div className="label" style={{ marginBottom: "var(--sp-3)", color: "var(--danger)" }}>
            ÇAKIŞMA BULUNDU
          </div>
          <p style={{ marginBottom: "var(--sp-3)" }}>
            <strong style={{ color: "var(--text)" }}>{cakisanlar.length} kayıt</strong> hem gömülü
            dosyada hem de elle girilmiş kayıtlar arasında var (aynı ad, tarih, okul ve tutar).
            Aktarım yapılırsa bu öğrenciler <strong>iki kez sayılır</strong>.
          </p>
          <div style={{ maxHeight: 160, overflowY: "auto", display: "grid", gap: "var(--sp-1)" }}>
            {cakisanlar.slice(0, 30).map((c, i) => (
              <div key={i} className="caption">{c.ad} — {c.tarih} — {c.okul}</div>
            ))}
            {cakisanlar.length > 30 && (
              <div className="caption" style={{ color: "var(--text-3)" }}>
                …ve {cakisanlar.length - 30} tane daha
              </div>
            )}
          </div>
          <p className="caption" style={{ marginTop: "var(--sp-3)" }}>
            Aktarımdan sonra Kayıt Listesi'nden bu kayıtların birer kopyasını iptal edebilirsiniz.
          </p>
        </div>
      )}

      {/* Uyarı ve onay */}
      <div className="card" style={{ borderLeft: "3px solid var(--warning)" }}>
        <div className="label" style={{ marginBottom: "var(--sp-3)", color: "var(--warning)" }}>
          İŞLEM ÖNCESİ
        </div>
        <ul style={{ color: "var(--text-2)", fontSize: "0.9rem", lineHeight: 1.7, paddingLeft: "1.1rem", margin: 0 }}>
          <li>Bu işlem {hazirlanan.kayitlar.length} kaydı veritabanına yazar.</li>
          <li>
            Her kaydın kimliği içeriğinden üretilir; işlem ikinci kez çalıştırılsa bile
            <strong> mükerrer oluşmaz</strong>, aynı kayıtların üzerine yazılır.
          </li>
          <li>Aktarım biter bitmez tüm sayfalar otomatik olarak veritabanını kullanmaya geçer.</li>
          <li>Elle girilmiş kayıtlara dokunulmaz.</li>
        </ul>

        <div style={{ marginTop: "var(--sp-5)" }}>
          <label style={{ display: "block", color: "var(--text-2)", fontSize: "0.85rem", marginBottom: "var(--sp-2)" }}>
            Onaylamak için aşağıya <strong style={{ color: "var(--text)" }}>AKTAR</strong> yazın
          </label>
          <input
            value={onayMetni}
            onChange={(e) => setOnayMetni(e.target.value)}
            placeholder="AKTAR"
            disabled={durum === "calisiyor"}
          />
        </div>

        <button
          onClick={aktar}
          disabled={!onayGecerli || durum === "calisiyor"}
          style={{
            marginTop: "var(--sp-4)",
            width: "100%",
            padding: "var(--sp-4)",
            borderRadius: "var(--r-md)",
            border: "none",
            background: onayGecerli ? "var(--accent)" : "var(--surface-raised)",
            color: onayGecerli ? "var(--accent-ink)" : "var(--text-3)",
            fontWeight: 700,
            fontSize: "1rem",
          }}
        >
          {durum === "calisiyor" ? `Aktarılıyor… ${ilerleme}/${hazirlanan.kayitlar.length}` : "Aktarımı Başlat"}
        </button>

        {mesaj && (
          <div
            role="status"
            style={{
              marginTop: "var(--sp-4)",
              padding: "var(--sp-3)",
              borderRadius: "var(--r-sm)",
              background: "var(--surface-raised)",
              color: durum === "hata" ? "var(--danger)" : durum === "bitti" ? "var(--success)" : "var(--text-2)",
              fontSize: "0.9rem",
            }}
          >
            {mesaj}
          </div>
        )}
      </div>
    </div>
  );
}

function Satir({ etiket, deger, vurgu }: { etiket: string; deger: any; vurgu?: string }) {
  return (
    <div className="data-row">
      <span style={{ color: "var(--text-2)", fontSize: "0.9rem" }}>{etiket}</span>
      <span className="num" style={{ fontWeight: 700, color: vurgu || "var(--text)" }}>{deger}</span>
    </div>
  );
}
