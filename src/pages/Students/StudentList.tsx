import { useState, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../store/AuthContext";
import { useRecords, type Kayit } from "../../hooks/useRecords";
import { aktifDonem, kiyasDonem, donemListesi, tarihinYili } from "../../constants/donem";
import Modal from "../../components/ui/Modal";

const normalize = (s: any): string => {
  if (!s) return "";
  return String(s).toLocaleLowerCase('tr-TR').trim()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "");
};

// 📅 DEPOLAMA standardı GG.AA.YYYY — tüm raporlar bunu bekler.
// <input type="date"> ise YYYY-AA-GG ister.
const toInputDate = (s: string): string => {
  if (!s) return "";
  if (s.includes(".")) { const [d, m, y] = s.split("."); return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; }
  return s;
};
const toStoredDate = (s: string): string => {
  if (!s) return "";
  if (s.includes("-")) { const [y, m, d] = s.split("-"); return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`; }
  return s;
};

const hierarchy: any = {
  // Mefkure YKS: PLUS + VİP birlikte yönetiliyor
  "mefkureyks": { branches: ["Mefkure PLUS", "Mefkure VIP"], grades: ["9", "10", "11", "12", "Mezun", "Mood"] },
  // Yalnızca PLUS yetkisi verilmiş müdür (Yetki Yönetimi'nde ayrı bir seçenek)
  "mefkureplus": { branches: ["Mefkure PLUS"], grades: ["9", "10", "11", "12", "Mezun", "Mood"] },
  "mefkurelgs": { branches: ["Mefkure LGS"], grades: ["5", "6", "7", "8"] },
  "altinkureilkogretim": { branches: ["Altınküre Anaokulu", "Altınküre İlkokul", "Altınküre Ortaokul"], grades: ["Ana Sınıfı", "1", "2", "3", "4", "5", "6", "7", "8"] },
  "altinkurelise": { branches: ["Altınküre Fen Lisesi", "Altınküre Anadolu Lisesi", "Altınküre Akademi"], grades: ["9", "10", "11", "12", "Mezun", "Akademi"] },
  "altinkureteknokent": { branches: ["Altınküre Teknokent"], grades: ["9", "10", "11", "12"] }
};

const MEFKURE_KEYS = ["mefkureyks", "mefkurelgs"];
const MEFKURE_GROUP = {
  branches: ["Mefkure LGS", "Mefkure PLUS", "Mefkure VİP"],
  grades: ["5", "6", "7", "8", "9", "10", "11", "12", "Mezun", "Mood"]
};

type DonemSuzgeci = string; // yıl metni veya "hepsi"
type DurumSuzgeci = "aktif" | "iptal" | "hepsi";
type KaynakSuzgeci = "hepsi" | "manual" | "excel";

export default function StudentList() {
  const { user } = useAuth();
  const { tumKayitlar, loading, sayim } = useRecords();

  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [iptalEdilen, setIptalEdilen] = useState<Kayit | null>(null);
  const [iptalNotu, setIptalNotu] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  // Liste varsayilan olarak icinde bulunulan donemi gosterir; gecen yilin
  // kayitlari tarihsel veridir, iptal islemi oraya uygulanmaz.
  const [donem, setDonem] = useState<DonemSuzgeci>(String(aktifDonem()));
  const [durumSuzgeci, setDurumSuzgeci] = useState<DurumSuzgeci>("aktif");
  const [kaynakSuzgeci, setKaynakSuzgeci] = useState<KaynakSuzgeci>("hepsi");
  const [islemde, setIslemde] = useState<string | null>(null);
  // Düzenleme penceresindeki doğrulama uyarısı. Pencere zaten en üst katmanda
  // olduğu için uyarı da pencerenin İÇİNDE gösterilir; üstüne ikinci bir
  // katman açmak kullanıcıyı iki kez engellerdi.
  const [duzenlemeHatasi, setDuzenlemeHatasi] = useState<string | null>(null);
  // Sıfır tutar %100 burslu öğrencide gerçek bir değer. Bu yüzden yasaklamıyor,
  // yalnızca bir kez soruyoruz: uyarıdan sonraki Kaydet geçer.
  const [sifirOnayli, setSifirOnayli] = useState(false);

  const isAdmin = user?.role?.trim().toLowerCase() === "admin" || user?.email === "ugur@asaf.com";

  const userSettings = useMemo(() => {
    const userBranchKey = user?.branchId ? normalize(user.branchId) : "";
    // Her müdür YALNIZCA kendi şubesini görür. (Önceden LGS ve YKS müdürleri
    // ortak bir Mefkure havuzunu görüyordu; Ana Sayfa'daki yetki mantığıyla
    // çeliştiği için kaldırıldı.)
    return hierarchy[userBranchKey] || { branches: [], grades: [] };
  }, [user]);

  const filteredList = useMemo(() => {
    const parseDate = (dateStr: string) => {
      if (!dateStr) return 0;
      if (dateStr.includes('.')) {
        const [d, m, y] = dateStr.split('.');
        return new Date(`${y}-${m}-${d}`).getTime() || 0;
      }
      return new Date(dateStr).getTime() || 0;
    };

    const kayitYili = (t: string) => String(t || "").split(".").pop() || "";

    const list = tumKayitlar.filter((r) => {
      // Donem suzgeci — sozlesme tarihinin yili
      if (donem !== "hepsi" && String(tarihinYili(r.SözleşmeTarihi) ?? "") !== donem) return false;

      // Yetki: admin hepsini, müdür kendi şubelerini görür
      const yetkili = isAdmin ||
        userSettings.branches.some((mb: string) => normalize(mb) === normalize(r.Okul || ""));
      if (!yetkili) return false;

      if (durumSuzgeci === "aktif" && r.KayıtDurumu === "İptal") return false;
      if (durumSuzgeci === "iptal" && r.KayıtDurumu !== "İptal") return false;

      if (kaynakSuzgeci === "manual" && r.kaynak !== "manual") return false;
      if (kaynakSuzgeci === "excel" && r.kaynak === "manual") return false;

      if (branchFilter !== "all" && normalize(r.Okul || "") !== normalize(branchFilter)) return false;

      if (searchTerm) {
        const q = normalize(searchTerm);
        return normalize(r.studentName).includes(q) || normalize(r.GittigiOkul || "").includes(q);
      }
      return true;
    });

    return list.sort((a, b) => parseDate(b.SözleşmeTarihi) - parseDate(a.SözleşmeTarihi));
  }, [tumKayitlar, isAdmin, userSettings, searchTerm, branchFilter, durumSuzgeci, kaynakSuzgeci, donem]);

  /** Gösterimde her zaman GG.AA.YYYY — kaynak dosyada "1.1.2026" gibi
      sıfırsız tarihler var, listede karışık görünmesin. */
  // Dönem listesi veriden gelir; yeni yıl kayıt girilince kendiliğinden çıkar.
  const donemler = useMemo(() => donemListesi(tumKayitlar), [tumKayitlar]);

  const saltOkunurSayisi = useMemo(
    () => filteredList.filter((r) => r.kaynak === "json").length,
    [filteredList]
  );

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "-";
    const pad = (x: string) => x.padStart(2, "0");
    if (dateStr.includes('-')) { const [y, m, d] = dateStr.split('-'); return `${pad(d)}.${pad(m)}.${y}`; }
    if (dateStr.includes('.')) { const [d, m, y] = dateStr.split('.'); return `${pad(d)}.${pad(m)}.${y}`; }
    return dateStr;
  };

  const handleUpdate = async (e: any) => {
    e.preventDefault();

    // Tutar boş bırakılırsa Number("") sessizce 0 döner ve kayıt ciroyu
    // sıfırlayarak güncellenir. Sessiz veri kaybı yerine burada duruyoruz.
    const ham = String(editingStudent.SonTutar ?? "").trim();
    const tutar = Number(ham);
    if (ham === "" || !Number.isFinite(tutar) || tutar < 0) {
      setDuzenlemeHatasi("Tutar boş veya geçersiz olamaz. Geçerli bir tutar girin.");
      return;
    }
    if (tutar === 0 && !sifirOnayli) {
      setDuzenlemeHatasi("Tutar 0 olarak kaydedilecek ve ciroya sıfır yazılacak. Doğruysa Kaydet'e tekrar basın.");
      setSifirOnayli(true);
      return;
    }
    setDuzenlemeHatasi(null);

    setIslemde(editingStudent.id);
    try {
      const isMefkure = (editingStudent.Okul || "").toLocaleLowerCase('tr-TR').includes("mefkure");
      await updateDoc(doc(db, "records", editingStudent.id), {
        studentName: editingStudent.studentName,
        SözleşmeTarihi: toStoredDate(editingStudent.SözleşmeTarihi),
        Okul: editingStudent.Okul,
        Sınıf: editingStudent.Sınıf,
        SonTutar: tutar,
        ...(isMefkure ? { GittigiOkul: editingStudent.GittigiOkul || "" } : {})
      });
      setEditingStudent(null);
      setSifirOnayli(false);
    } catch {
      alert("Kayıt güncellenemedi.");
    } finally {
      setIslemde(null);
    }
  };

  /** Kayıt silinmez — iptal durumuna geçer. Böylece geçmiş korunur,
      istatistiklerden düşer ve gerekirse geri alınabilir. */
  const iptalEt = async () => {
    if (!iptalEdilen) return;
    setIslemde(iptalEdilen.id);
    try {
      await updateDoc(doc(db, "records", iptalEdilen.id), {
        KayıtDurumu: "İptal",
        iptalTarihi: new Date().toISOString(),
        iptalEden: user?.displayName || user?.email || "bilinmiyor",
        iptalNotu: iptalNotu.trim(),
      });
      setIptalEdilen(null);
      setIptalNotu("");
    } catch {
      alert("İptal işlemi başarısız.");
    } finally {
      setIslemde(null);
    }
  };

  const geriAl = async (k: Kayit) => {
    setIslemde(k.id);
    try {
      await updateDoc(doc(db, "records", k.id), {
        KayıtDurumu: "Aktif",
        iptalTarihi: "",
        iptalEden: "",
        iptalNotu: "",
      });
    } catch {
      alert("Geri alma başarısız.");
    } finally {
      setIslemde(null);
    }
  };

  const [excelHazirlaniyor, setExcelHazirlaniyor] = useState(false);

  /**
   * Ekranda görünen listeyi (uygulanan tüm süzgeçlerle) Excel'e aktarır.
   * xlsx kütüphanesi ~290 KB; herkesin her açılışta indirmemesi için
   * statik değil, butona basıldığı anda yükleniyor.
   */
  const excelIndir = async () => {
    setExcelHazirlaniyor(true);
    try {
      const XLSX = await import("xlsx");
      const satirlar = filteredList.map((r) => ({
      "Öğrenci Adı": r.studentName,
      "Sözleşme Tarihi": formatDateDisplay(r.SözleşmeTarihi),
      "Okul / Şube": r.Okul,
      "Sınıf": r.Sınıf,
      "Tutar (TL)": r.SonTutar,
      "Gittiği Okul": r.GittigiOkul || "",
      "Kaynak": r.kaynak === "manual" ? "Manuel" : "Sabit",
      "Durum": r.KayıtDurumu,
      "İptal Eden": r.iptalEden || "",
      "İptal Tarihi": r.iptalTarihi ? new Date(r.iptalTarihi).toLocaleDateString("tr-TR") : "",
      "İptal Sebebi": r.iptalNotu || "",
    }));

      const sayfa = XLSX.utils.json_to_sheet(satirlar);
      // Sütun genişlikleri — açılınca elle genişletmek gerekmesin
      sayfa["!cols"] = [
      { wch: 28 }, { wch: 15 }, { wch: 22 }, { wch: 8 }, { wch: 14 },
      { wch: 24 }, { wch: 9 }, { wch: 9 }, { wch: 18 }, { wch: 13 }, { wch: 30 },
    ];

      const kitap = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(kitap, sayfa, "Kayıtlar");

      const bugun = new Date().toLocaleDateString("tr-TR").replace(/\./g, "-");
      const donemEtiketi = donem === "hepsi" ? "tum-donemler" : donem;
      XLSX.writeFile(kitap, `ASAF-kayit-listesi-${donemEtiketi}-${bugun}.xlsx`);
    } catch {
      alert("Excel dosyası oluşturulamadı.");
    } finally {
      setExcelHazirlaniyor(false);
    }
  };

  if (loading) {
    return <div className="page" style={{ textAlign: "center", paddingTop: "var(--sp-7)", color: "var(--text-2)" }}>Yükleniyor…</div>;
  }

  return (
    <div className="page rise" style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-4)", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Kayıt Listesi</h1>
        <button onClick={excelIndir} disabled={filteredList.length === 0 || excelHazirlaniyor} style={btnExcel}>
          {excelHazirlaniyor ? "Hazırlanıyor…" : "Excel'e Aktar"}
        </button>
      </div>

      {/* Aktarılmamış kayıtlar salt okunur — nedeni açıkça yazılıyor */}
      {saltOkunurSayisi > 0 && (
        <div style={uyariKutusu}>
          Bu görünümdeki <strong>{saltOkunurSayisi} kayıt salt okunur</strong>. Uygulamanın içine
          gömülü dosyadan geliyorlar; veritabanında olmadıkları için düzenlenemez ve iptal edilemezler.
          {Number(donem) === kiyasDonem()
            ? " Geçmiş dönem kayıtları kapanmış sayıldığı için bilerek aktarılmadı."
            : isAdmin
              ? " Veri Aktarımı sayfasından aktarılabilirler."
              : " Aktarımı yöneticinin yapması gerekiyor."}
        </div>
      )}

      {/* Süzgeçler */}
      <div style={{ display: "grid", gap: "var(--sp-3)", marginBottom: "var(--sp-5)" }}>
        <input
          placeholder="Öğrenci adı veya gittiği okul ara…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
          <SegmentliSecim
            deger={donem}
            degistir={(v) => setDonem(v as DonemSuzgeci)}
            secenekler={[
              ...donemler.map((d) => ({ deger: String(d), etiket: `${d} Dönemi` })),
              { deger: "hepsi", etiket: "Tüm Dönemler" },
            ]}
          />
          <SegmentliSecim
            deger={durumSuzgeci}
            degistir={(v) => setDurumSuzgeci(v as DurumSuzgeci)}
            secenekler={[
              { deger: "aktif", etiket: "Aktif" },
              { deger: "iptal", etiket: `İptal${sayim.iptal ? ` (${sayim.iptal})` : ""}` },
              { deger: "hepsi", etiket: "Hepsi" },
            ]}
          />
          <SegmentliSecim
            deger={kaynakSuzgeci}
            degistir={(v) => setKaynakSuzgeci(v as KaynakSuzgeci)}
            secenekler={[
              { deger: "hepsi", etiket: "Tümü" },
              { deger: "manual", etiket: "Manuel" },
              { deger: "excel", etiket: "Sabit" },
            ]}
          />
        </div>
        {userSettings.branches.length > 1 && (
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
            <option value="all">Tüm Gruplar</option>
            {userSettings.branches.map((b: string) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
      </div>

      <div className="caption" style={{ marginBottom: "var(--sp-3)" }}>
        {filteredList.length} kayıt gösteriliyor
      </div>

      <div style={{ display: "grid", gap: "var(--sp-3)" }}>
        {filteredList.map((s) => {
          const iptalli = s.KayıtDurumu === "İptal";
          const duzenlenebilir = s.kaynak !== "json";
          const mesgul = islemde === s.id;

          return (
            <div key={s.id} className="card" style={{ padding: "var(--sp-4)", opacity: iptalli ? 0.6 : 1 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--sp-3)", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, textDecoration: iptalli ? "line-through" : "none" }}>
                      {s.studentName || "—"}
                    </span>
                    <Rozet
                      metin={s.kaynak === "manual" ? "Manuel" : "Sabit"}
                      renk={s.kaynak === "manual" ? "var(--accent)" : "var(--text-3)"}
                    />
                    {iptalli && <Rozet metin="İptal" renk="var(--danger)" />}
                  </div>

                  <div className="caption" style={{ marginTop: "var(--sp-1)" }}>
                    {formatDateDisplay(s.SözleşmeTarihi)} · {s.Okul} · {s.Sınıf}. sınıf ·{" "}
                    <span className="num">₺{s.SonTutar?.toLocaleString("tr-TR")}</span>
                  </div>

                  {s.GittigiOkul && (
                    <div className="caption" style={{ color: "var(--accent)", marginTop: "var(--sp-1)" }}>
                      Gittiği okul: {s.GittigiOkul}
                    </div>
                  )}

                  {iptalli && s.iptalEden && (
                    <div className="caption" style={{ color: "var(--danger)", marginTop: "var(--sp-1)" }}>
                      {new Date(s.iptalTarihi || "").toLocaleDateString("tr-TR")} tarihinde {s.iptalEden} iptal etti
                      {s.iptalNotu ? ` — ${s.iptalNotu}` : ""}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                  {!duzenlenebilir ? (
                    // Gömülü dosyadan okunan kayıt: veritabanında olmadığı için
                    // değiştirilemez. Geçmiş dönemler bilerek aktarılmıyor.
                    <span className="caption" style={{ alignSelf: "center", whiteSpace: "nowrap" }}>
                      salt okunur
                    </span>
                  ) : iptalli ? (
                    <button onClick={() => geriAl(s)} disabled={mesgul} style={btnGeriAl}>
                      {mesgul ? "…" : "Geri Al"}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditingStudent({ ...s, SözleşmeTarihi: toInputDate(s.SözleşmeTarihi) })}
                        disabled={mesgul}
                        style={btnEdit}
                      >
                        Düzenle
                      </button>
                      <button onClick={() => { setIptalEdilen(s); setIptalNotu(""); }} disabled={mesgul} style={btnIptal}>
                        İptal Et
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredList.length === 0 && (
          <div style={{ textAlign: "center", padding: "var(--sp-6)", color: "var(--text-3)" }}>
            Kayıt bulunamadı.
          </div>
        )}
      </div>

      {/* İptal onayı */}
      <Modal
        open={!!iptalEdilen}
        onClose={() => setIptalEdilen(null)}
        title="Kaydı İptal Et"
        footer={
          <>
            <button onClick={iptalEt} disabled={!!islemde} style={btnIptalOnay}>
              {islemde ? "İşleniyor…" : "İptal Et"}
            </button>
            <button onClick={() => setIptalEdilen(null)} style={btnVazgec}>Vazgeç</button>
          </>
        }
      >
        <p style={{ marginBottom: "var(--sp-4)" }}>
          <strong style={{ color: "var(--text)" }}>{iptalEdilen?.studentName}</strong> kaydı iptal
          edilecek. Kayıt silinmez; öğrenci sayısı ve cirodan düşer, listede “İptal” olarak kalır ve
          istenirse geri alınabilir.
        </p>
        <label className="caption" style={{ display: "block", marginBottom: "var(--sp-2)" }}>
          Sebep (isteğe bağlı)
        </label>
        <input
          value={iptalNotu}
          onChange={(e) => setIptalNotu(e.target.value)}
          placeholder="Örn. veli talebiyle kayıt sildirildi"
        />
      </Modal>

      {/* Düzenleme */}
      <Modal
        open={!!editingStudent}
        onClose={() => { setEditingStudent(null); setDuzenlemeHatasi(null); setSifirOnayli(false); }}
        title="Kaydı Düzenle"
        footer={
          <>
            <button onClick={handleUpdate} disabled={!!islemde} style={btnKaydet}>
              {islemde ? "Kaydediliyor…" : "Kaydet"}
            </button>
            <button onClick={() => { setEditingStudent(null); setDuzenlemeHatasi(null); setSifirOnayli(false); }} style={btnVazgec}>Vazgeç</button>
          </>
        }
      >
        {editingStudent && (
          <div style={{ display: "grid", gap: "var(--sp-3)" }}>
            <Alan etiket="Öğrenci Adı">
              <input value={editingStudent.studentName || ""} onChange={e => setEditingStudent({ ...editingStudent, studentName: e.target.value })} />
            </Alan>

            <div style={{ display: "flex", gap: "var(--sp-3)" }}>
              <Alan etiket="Okul / Şube" style={{ flex: 1 }}>
                <select value={editingStudent.Okul || ""} onChange={e => setEditingStudent({ ...editingStudent, Okul: e.target.value })}>
                  <option value="">Seçiniz…</option>
                  {userSettings.branches.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Alan>
              <Alan etiket="Sınıf" style={{ width: 110 }}>
                <select value={editingStudent.Sınıf || ""} onChange={e => setEditingStudent({ ...editingStudent, Sınıf: e.target.value })}>
                  <option value="">Seç…</option>
                  {userSettings.grades.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Alan>
            </div>

            {(editingStudent.Okul || "").toLocaleLowerCase('tr-TR').includes("mefkure") && (
              <Alan etiket="Gittiği Okul (isteğe bağlı)">
                <input value={editingStudent.GittigiOkul || ""} onChange={e => setEditingStudent({ ...editingStudent, GittigiOkul: e.target.value })} />
              </Alan>
            )}

            <div style={{ display: "flex", gap: "var(--sp-3)" }}>
              <Alan etiket="Sözleşme Tarihi" style={{ flex: 1 }}>
                <input type="date" value={editingStudent.SözleşmeTarihi || ""} onChange={e => setEditingStudent({ ...editingStudent, SözleşmeTarihi: e.target.value })} />
              </Alan>
              <Alan etiket="Tutar (TL)" style={{ flex: 1 }}>
                <input
                  type="number"
                  value={editingStudent.SonTutar || ""}
                  onChange={e => { setEditingStudent({ ...editingStudent, SonTutar: e.target.value }); setDuzenlemeHatasi(null); setSifirOnayli(false); }}
                  aria-invalid={!!duzenlemeHatasi}
                  style={duzenlemeHatasi ? { borderColor: "var(--danger)" } : undefined}
                />
              </Alan>
            </div>

            {duzenlemeHatasi && (
              <div
                role="alert"
                style={{
                  color: "var(--danger)",
                  fontSize: "0.85rem",
                  background: "color-mix(in srgb, var(--danger) 12%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)",
                  borderRadius: "var(--r-sm)",
                  padding: "var(--sp-2) var(--sp-3)",
                }}
              >
                {duzenlemeHatasi}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---- küçük parçalar ---- */
function Rozet({ metin, renk }: { metin: string; renk: string }) {
  return (
    <span style={{
      fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
      color: renk, border: `1px solid color-mix(in srgb, ${renk} 40%, transparent)`,
      background: `color-mix(in srgb, ${renk} 12%, transparent)`,
      padding: "2px 6px", borderRadius: "var(--r-full)", whiteSpace: "nowrap",
    }}>{metin}</span>
  );
}

function Alan({ etiket, children, style }: { etiket: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label className="caption" style={{ display: "block", marginBottom: "var(--sp-1)" }}>{etiket}</label>
      {children}
    </div>
  );
}

function SegmentliSecim({ deger, degistir, secenekler }: {
  deger: string; degistir: (v: string) => void;
  secenekler: { deger: string; etiket: string }[];
}) {
  return (
    <div style={{ display: "inline-flex", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 2 }}>
      {secenekler.map((s) => (
        <button
          key={s.deger}
          onClick={() => degistir(s.deger)}
          style={{
            border: "none", borderRadius: "var(--r-sm)", padding: "var(--sp-2) var(--sp-3)",
            fontSize: "0.78rem", fontWeight: 600, whiteSpace: "nowrap",
            background: deger === s.deger ? "var(--surface-raised)" : "transparent",
            color: deger === s.deger ? "var(--text)" : "var(--text-3)",
            boxShadow: deger === s.deger ? "inset 0 1px 0 var(--material-edge)" : "none",
          }}
        >
          {s.etiket}
        </button>
      ))}
    </div>
  );
}

/* ---- stiller ---- */
const uyariKutusu: React.CSSProperties = {
  background: "color-mix(in srgb, var(--warning) 10%, transparent)",
  border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)",
  color: "var(--text-2)", padding: "var(--sp-3) var(--sp-4)",
  borderRadius: "var(--r-md)", fontSize: "0.85rem", lineHeight: 1.6,
  marginBottom: "var(--sp-5)",
};
const btnExcel: React.CSSProperties = { background: "transparent", color: "var(--success)", border: "1px solid color-mix(in srgb, var(--success) 45%, transparent)", padding: "var(--sp-2) var(--sp-4)", borderRadius: "var(--r-sm)", fontWeight: 600, fontSize: "0.85rem", whiteSpace: "nowrap" };
const btnEdit: React.CSSProperties = { background: "var(--accent)", color: "var(--accent-ink)", border: "none", padding: "var(--sp-2) var(--sp-3)", borderRadius: "var(--r-sm)", fontWeight: 600, fontSize: "0.82rem" };
const btnIptal: React.CSSProperties = { background: "transparent", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 45%, transparent)", padding: "var(--sp-2) var(--sp-3)", borderRadius: "var(--r-sm)", fontWeight: 600, fontSize: "0.82rem" };
const btnGeriAl: React.CSSProperties = { background: "transparent", color: "var(--success)", border: "1px solid color-mix(in srgb, var(--success) 45%, transparent)", padding: "var(--sp-2) var(--sp-3)", borderRadius: "var(--r-sm)", fontWeight: 600, fontSize: "0.82rem" };
const btnIptalOnay: React.CSSProperties = { flex: 1, background: "var(--danger)", color: "var(--text)", border: "none", padding: "var(--sp-3)", borderRadius: "var(--r-sm)", fontWeight: 700 };
const btnKaydet: React.CSSProperties = { flex: 1, background: "var(--accent)", color: "var(--accent-ink)", border: "none", padding: "var(--sp-3)", borderRadius: "var(--r-sm)", fontWeight: 700 };
const btnVazgec: React.CSSProperties = { flex: 1, background: "var(--surface-raised)", color: "var(--text-2)", border: "1px solid var(--line)", padding: "var(--sp-3)", borderRadius: "var(--r-sm)", fontWeight: 600 };
