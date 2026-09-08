import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../store/AuthContext";
import { useRecords, type Kayit } from "../../hooks/useRecords";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { aktifDonem, egitimYili, kiyasDonem, tarihinYili } from "../../constants/donem";
import { branchIdToKurumId } from "../../constants/kurumYetki";
import { finansOzetleri } from "../../services/karHesabiGider";
import {
  karVarsayimlari, giderProjeksiyonu, karHedefiCirosu, ekKaynakToplami, kurumToplami,
  sadelestir, moodMu, YKS_GIDER, LGS_GIDER,
  KAR_HEDEFI, VARSAYILAN_ARTIS,
  type Hedefler, type Artislar,
} from "../../services/karHesabiModel";
import {
  kursHedefleri, HAT_OKULLARI,
  type KursHatti, type KursHedefi,
} from "../../constants/kursHedefleri";

/* =====================================================================
   KURS HEDEFLERİ

   Bu ekran karne değil sayaç. Dönem 31 Aralık'ta kapanıyor; tek soru
   "kalan günde ne yapılırsa hedef tutar".

   KÂR HESABI REFERANSI
   Bütün para tarafı karHesabiModel'den gelir — gider, kâr marjı hedefi,
   MOOD ayrımı, hat tanımları. Kâr Hesabı'nda gider Finans'ın rakamı ×
   (1 + % artış), kâr eşiği de gider ÷ (1 − marj). Aynı fonksiyonlar
   burada da çağrılıyor, kopyalanmıyor; iki ekran ayrışamaz.

   Böylece öğrenci sayısı tek başına bırakılmıyor, üç eşik çıkıyor:
     başabaş      gider ÷ ortalama       — sonrası kâra yazılır
     %20 kâr      Kâr Hesabı'nın hedefi  — asıl bahis
     dönem hedefi kurucuların rakamı

   MOOD kayıtları YKS sayımına girmez: Kâr Hesabı'nda ayrı bir ek kaynak
   kutusu olarak giriliyor, buradan da sayılsa iki kez toplanırdı.

   TAHMİN
   Ham yüzde yanıltır — Mart'ta %40 iyidir, Eylül'de değildir. Geçen
   dönemin AYNI TARİHTEKİ payı alınıp bu dönemin rakamı ona bölünür.
   Kıyas verisi yoksa tahmin uydurulmaz.
   ===================================================================== */

const TL = (n: number) => `${Math.round(n).toLocaleString("tr-TR")} ₺`;
const MN = (n: number) =>
  `${(n / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} Mn ₺`;
const YZ = (n: number) => `%${Math.round(n * 100)}`;
const SAYI = (n: number) => Math.round(n).toLocaleString("tr-TR");
const ONDALIK = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });

/** "GG.AA.YYYY" → ay*100+gün; yıl içi tarih karşılaştırması için. */
function ayGun(tarih: string): number | null {
  const p = String(tarih).split(".");
  const g = Number(p[0]); const a = Number(p[1]);
  if (p.length < 3 || !Number.isFinite(g) || !Number.isFinite(a)) return null;
  return a * 100 + g;
}

function tarihe(t: string): Date | null {
  const p = String(t).split(".");
  if (p.length < 3) return null;
  const d = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 31 Aralık'a kalan gün — dönem o gün kapanır. */
function kalanGun(): number {
  const bugun = new Date();
  const son = new Date(bugun.getFullYear(), 11, 31);
  return Math.max(0, Math.ceil((son.getTime() - bugun.getTime()) / 86_400_000));
}

/* Rütbeler ileriye bakar: hiçbiri "olmadı" demez, hepsi "buradan sonrası
   şöyle" der. Ekran suçlamak için değil harekete geçirmek için var. */
type Durum = "onde" | "menzilde" | "hizlan" | "atak" | "bilinmiyor";

const DURUM_BILGI: Record<Durum, { etiket: string; renk: string; simge: string }> = {
  onde:       { etiket: "HEDEFİN ÖNÜNDE", renk: "var(--success)", simge: "▲" },
  menzilde:   { etiket: "HEDEF MENZİLDE", renk: "var(--accent)",  simge: "◆" },
  hizlan:     { etiket: "TEMPO ARTMALI",  renk: "var(--gold)",    simge: "▶" },
  atak:       { etiket: "ATAK ZAMANI",    renk: "var(--warning)", simge: "▶▶" },
  bilinmiyor: { etiket: "YOL BAŞINDA",    renk: "var(--text-3)",  simge: "·" },
};

interface HatOzeti {
  anahtar: KursHatti;
  hedef: KursHedefi;
  /* --- üç temel rakam --- */
  ogrenci: number;
  ciro: number;
  ortalama: number;
  hedefOrtalama: number;
  ogrenciOran: number;
  ciroOran: number;
  ortalamaOran: number;
  /** Ortalama hedefine kalan tutar; hedef aşıldıysa sıfır. */
  kalanOrtalama: number;
  /* --- tahmin --- */
  mevsimPayi: number | null;
  tahminOgrenci: number | null;
  tahminCiro: number | null;
  /** Geçen dönemde bu tarihten SONRA gelen kayıt ve ciro — erişilebilir kıyas. */
  gecenSonrasiOgrenci: number;
  gecenSonrasiCiro: number;
  gecenVerisiVar: boolean;
  durum: Durum;
  /* --- tempo --- */
  kalanOgrenci: number;
  kalanCiro: number;
  gerekenGunluk: number;
  suAnkiGunluk: number;
  /* --- Kâr Hesabı köprüsü --- */
  gider: number;
  giderCanli: boolean;
  /** Kâr Hesabı'nın ciroya eklediği kalemler (MOOD, birebir, deneme…) */
  ekKaynak: number;
  karMarjHedefi: number;
  basabasOgrenci: number;
  karHedefiOgrenci: number;
  /** Eşikler bu ortalamaya bölünerek bulundu — ekranda gösterilir. */
  olcuOrtalama: number;
  /** Kâr marjı hedefine ulaştıran ciro. */
  karHedefiCiro: number;
  /* --- Kâr Hesabı "Kurum toplamı" satırlarının aynısı --- */
  beklenenOgrenci: number;
  beklenenOrtalama: number;
  yilSonuOgrenci: number;
  yilSonuCiro: number;
  yilSonuKar: number;
  yilSonuMarj: number;
  hedefKar: number;
  hedefMarj: number;
}

function hattiOzetle(
  anahtar: KursHatti, hedef: KursHedefi, kayitlar: Kayit[],
  gider: number, giderCanli: boolean, karMarjHedefi: number, ekKaynak: number,
  beklenenOgrenci: number, beklenenOrtalama: number,
): HatOzeti {
  const donem = aktifDonem();
  const bugun = new Date();
  const bugunAyGun = (bugun.getMonth() + 1) * 100 + bugun.getDate();

  const okullar = HAT_OKULLARI[anahtar];
  // MOOD hariç — Kâr Hesabı'ndaki sayımın aynısı.
  const hattin = kayitlar.filter(
    (k) => okullar.includes(sadelestir(k.Okul)) && !(anahtar === "yks" && moodMu(k.Sınıf)),
  );

  // Kâr Hesabı "bugüne kadar" sayar: sözleşme tarihi bugünden sonra olan
  // kayıtlar gerçekleşmiş sayılmaz. Burada tüm takvim yılı sayılıyordu ve
  // iki ekran farklı "gerçekleşen" gösteriyordu.
  const buDonem = hattin.filter((k) => {
    if (tarihinYili(k.SözleşmeTarihi) !== donem) return false;
    const ag = ayGun(k.SözleşmeTarihi);
    return ag !== null && ag <= bugunAyGun;
  });
  const gecenTum = hattin.filter((k) => tarihinYili(k.SözleşmeTarihi) === kiyasDonem(donem));
  const gecenBugune = gecenTum.filter((k) => {
    const ag = ayGun(k.SözleşmeTarihi);
    return ag !== null && ag <= bugunAyGun;
  });

  // Geçen dönemin bu tarihten sonraki dilimi: "önümüzdeki 114 günde ne
  // olabilir" sorusunun gerçekleşmiş cevabı.
  const gecenSonrasi = gecenTum.filter((k) => {
    const ag = ayGun(k.SözleşmeTarihi);
    return ag !== null && ag > bugunAyGun;
  });

  const topla = (l: Kayit[]) => l.reduce((t, k) => t + k.SonTutar, 0);
  const ogrenci = buDonem.length;
  const ciro = topla(buDonem);
  const ortalama = ogrenci > 0 ? ciro / ogrenci : 0;
  const hedefOrtalama = hedef.ciro / hedef.ogrenci;

  const mevsimPayi = gecenTum.length > 0 ? gecenBugune.length / gecenTum.length : null;
  const gecenCiro = topla(gecenTum);
  const mevsimPayiCiro = gecenCiro > 0 ? topla(gecenBugune) / gecenCiro : null;

  const tahminOgrenci = mevsimPayi && mevsimPayi > 0 ? ogrenci / mevsimPayi : null;
  const tahminCiro = mevsimPayiCiro && mevsimPayiCiro > 0 ? ciro / mevsimPayiCiro : null;

  let durum: Durum = "bilinmiyor";
  if (tahminOgrenci !== null && tahminCiro !== null) {
    const oran = Math.min(tahminOgrenci / hedef.ogrenci, tahminCiro / hedef.ciro);
    durum = oran >= 1 ? "onde" : oran >= 0.9 ? "menzilde" : oran >= 0.75 ? "hizlan" : "atak";
  }

  // Son 30 günün hızı: yıl başından ortalama alsaydık kayıt mevsimi
  // yüzünden bugünkü tempo olduğundan düşük görünürdü.
  const otuzGunOnce = new Date(bugun.getTime() - 30 * 86_400_000);
  const sonOtuz = buDonem.filter((k) => {
    const t = tarihe(k.SözleşmeTarihi);
    return t !== null && t >= otuzGunOnce && t <= bugun;
  }).length;

  const kalan = kalanGun();
  const kalanOgrenci = Math.max(0, hedef.ogrenci - ogrenci);

  // Eşikler ölçülürken gerçekleşen ortalama kullanılır; henüz kayıt yoksa
  // hedefin gerektirdiği ortalamaya düşülür.
  const olcuOrt = ortalama > 0 ? ortalama : hedefOrtalama;

  // Kâr Hesabı'nın alt tablosundaki satırların aynısı — formül ortak
  // modelde, burada yalnızca çağrılıyor.
  const yilSonu = kurumToplami({
    gerceklesenOgrenci: ogrenci, gerceklesenCiro: ciro,
    beklenenOgrenci, beklenenOrtalama, ekKaynak, gider,
  });

  return {
    beklenenOgrenci, beklenenOrtalama,
    yilSonuOgrenci: yilSonu.ogrenci,
    yilSonuCiro: yilSonu.ciro,
    yilSonuKar: yilSonu.kar,
    yilSonuMarj: yilSonu.marj,
    anahtar, hedef, ogrenci, ciro, ortalama, hedefOrtalama,
    ogrenciOran: ogrenci / hedef.ogrenci,
    ciroOran: ciro / hedef.ciro,
    ortalamaOran: hedefOrtalama > 0 ? ortalama / hedefOrtalama : 0,
    kalanOrtalama: Math.max(0, hedefOrtalama - ortalama),
    mevsimPayi, tahminOgrenci, tahminCiro, durum,
    gecenSonrasiOgrenci: gecenSonrasi.length,
    gecenSonrasiCiro: topla(gecenSonrasi),
    gecenVerisiVar: gecenTum.length > 0,
    kalanOgrenci,
    kalanCiro: Math.max(0, hedef.ciro - ciro),
    gerekenGunluk: kalan > 0 ? kalanOgrenci / kalan : 0,
    suAnkiGunluk: sonOtuz / 30,
    gider, giderCanli, ekKaynak, karMarjHedefi,
    // Eşikler kayıtlardan gelmesi gereken ciroya bakar: ek kaynaklar
    // kayıt sayısına girmediği için önce ciro hedefinden düşülür —
    // Kâr Hesabı'nın "gereken = hedef ciro − gerçekleşen − ek" satırının
    // aynısı.
    olcuOrtalama: olcuOrt,
    karHedefiCiro: karHedefiCirosu(gider, karMarjHedefi),
    basabasOgrenci: Math.max(0, Math.ceil((gider - ekKaynak) / olcuOrt)),
    karHedefiOgrenci: Math.max(0, Math.ceil((karHedefiCirosu(gider, karMarjHedefi) - ekKaynak) / olcuOrt)),
    hedefKar: hedef.ciro + ekKaynak - gider,
    hedefMarj: hedef.ciro + ekKaynak > 0 ? (hedef.ciro + ekKaynak - gider) / (hedef.ciro + ekKaynak) : 0,
  };
}

export default function KursHedefleriPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { records, loading } = useRecords();

  const donem = aktifDonem();
  const hedefler = kursHedefleri(donem);
  const kalan = kalanGun();

  const kurucu = user?.role?.trim().toLowerCase() === "admin" || user?.email === "ugur@asaf.com";

  const gorunenHatlar = useMemo<KursHatti[]>(() => {
    if (kurucu) return ["yks", "lgs"];
    const kurum = branchIdToKurumId(user?.branchId);
    if (kurum === "mefkure_yks") return ["yks"];
    if (kurum === "mefkure_lgs") return ["lgs"];
    return [];
  }, [kurucu, user?.branchId]);

  /* Gider ve kâr marjı hedefi Kâr Hesabı'nın okuduğu yerlerden gelir:
     Finans'ın dönem gideri + kayıtlı % artış + kayıtlı marj hedefi. */
  const [para, setPara] = useState<{
    gider: Record<KursHatti, number>;
    canli: Record<KursHatti, boolean>;
    marj: Hedefler;
    ek: Hedefler;
    beklenen: Hedefler;
    beklenenOrt: Hedefler;
  }>({
    gider: { yks: YKS_GIDER, lgs: LGS_GIDER },
    canli: { yks: false, lgs: false },
    marj: KAR_HEDEFI,
    // Kaydedilmiş varsayım gelene kadar ekranın kendi varsayılanları.
    ek: { y: ekKaynakToplami(null, "y"), l: ekKaynakToplami(null, "l") },
    beklenen: { y: 0, l: 0 },
    beklenenOrt: { y: 0, l: 0 },
  });

  useEffect(() => {
    let iptal = false;
    Promise.all([finansOzetleri(egitimYili(donem)), karVarsayimlari(donem)])
      .then(([finans, v]: [Awaited<ReturnType<typeof finansOzetleri>>, Awaited<ReturnType<typeof karVarsayimlari>>]) => {
        if (iptal) return;
        const y = giderProjeksiyonu(finans.yks, v.artis.y_gider, YKS_GIDER);
        const l = giderProjeksiyonu(finans.lgs, v.artis.l_gider, LGS_GIDER);
        setPara({
          gider: { yks: y.gider, lgs: l.gider },
          canli: { yks: y.veriVar, lgs: l.veriVar },
          marj: v.karHedefi,
          ek: v.ekKaynak,
          beklenen: v.beklenenOgrenci,
          beklenenOrt: v.beklenenOrtalama,
        });
      })
      .catch(() => {
        // Finans/varsayım okunamazsa Kâr Hesabı'nın yedek rakamlarıyla devam.
        if (!iptal) {
          setPara((o) => ({
            ...o,
            gider: {
              yks: Math.round(YKS_GIDER * (1 + VARSAYILAN_ARTIS.y_gider / 100)),
              lgs: Math.round(LGS_GIDER * (1 + VARSAYILAN_ARTIS.l_gider / 100)),
            },
          }));
        }
      });
    return () => { iptal = true; };
  }, [donem]);

  const ozetler = useMemo(() => {
    if (!hedefler) return [];
    return gorunenHatlar.map((h) =>
      hattiOzetle(
        h, hedefler[h], records,
        para.gider[h], para.canli[h],
        h === "yks" ? para.marj.y : para.marj.l,
        h === "yks" ? para.ek.y : para.ek.l,
        h === "yks" ? para.beklenen.y : para.beklenen.l,
        h === "yks" ? para.beklenenOrt.y : para.beklenenOrt.l,
      ),
    );
  }, [hedefler, gorunenHatlar, records, para]);

  if (!hedefler) {
    return (
      <div className="page rise" style={{ maxWidth: 1100 }}>
        <Kahraman donem={donem} kalan={kalan} ozetler={[]} />
        <div style={bilgiKutusu}>
          <strong>{donem} dönemi</strong> için kurs hedefi tanımlı değil. Hedefler dönem
          bazında tanımlanır; yeni dönemin rakamları girilene kadar bu ekran çalışmaz.
        </div>
      </div>
    );
  }

  if (gorunenHatlar.length === 0) {
    return (
      <div className="page rise" style={{ maxWidth: 1100 }}>
        <Kahraman donem={donem} kalan={kalan} ozetler={[]} />
        <div style={bilgiKutusu}>Bu ekran kurucular ve kurs müdürleri içindir.</div>
      </div>
    );
  }

  return (
    <div className="page rise" style={{ maxWidth: 1100 }}>
      <Kahraman donem={donem} kalan={kalan} ozetler={ozetler} />

      {loading && <div style={{ ...bilgiKutusu, marginBottom: "var(--sp-4)" }}>Kayıtlar yükleniyor…</div>}

      <KalanTablosu ozetler={ozetler} />
      <KarHesabiTablosu ozetler={ozetler} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile || ozetler.length === 1 ? "1fr" : "1fr 1fr",
          gap: "var(--sp-5)",
        }}
      >
        {ozetler.map((o, i) => (
          <HatKarti key={o.anahtar} ozet={o} gecikme={i} isMobile={isMobile} />
        ))}
      </div>

      <p className="caption" style={{ marginTop: "var(--sp-5)", maxWidth: 720 }}>
        Gider, kâr marjı hedefi ve MOOD ayrımı{" "}
        <Link to="/kar-hesabi" style={{ color: "var(--accent)" }}>Kâr Hesabı</Link>'nın
        kullandığı modelden okunur; iki ekran aynı rakamı verir. Kıyas, geçen dönemin
        aynı takvim penceresinde gerçekleşen kayıtlarıdır — takvime orantılı bir tempo
        kayıt mevsimini görmezden gelirdi. İptal edilen kayıtlar hiçbir toplama girmez.
      </p>
    </div>
  );
}

/* ------------------------------------------------------- kahraman şerit */

function Kahraman({ donem, kalan, ozetler }: { donem: number; kalan: number; ozetler: HatOzeti[] }) {
  const ogr = ozetler.reduce((t, o) => t + o.ogrenci, 0);
  const ciro = ozetler.reduce((t, o) => t + o.ciro, 0);
  const kalanOgr = ozetler.reduce((t, o) => t + o.kalanOgrenci, 0);
  const kalanCiro = ozetler.reduce((t, o) => t + o.kalanCiro, 0);
  const hedefOgr = ozetler.reduce((t, o) => t + o.hedef.ogrenci, 0);
  const hedefCiro = ozetler.reduce((t, o) => t + o.hedef.ciro, 0);
  const hedefKar = ozetler.reduce((t, o) => t + o.hedefKar, 0);

  return (
    <header style={{ marginBottom: "var(--sp-6)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Kurs Hedefleri</h1>
        <span style={donemRozeti}>{donem} DÖNEMİ</span>
      </div>

      <div style={kahramanKutu}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-3)" }}>
          <div className="num" style={geriSayimSayi}>{kalan}</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-0.015em" }}>gün kaldı</div>
            <div className="caption">31 Aralık {donem}'da dönem kapanıyor</div>
          </div>
        </div>

        {ozetler.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-6)" }}>
            <Kutucuk etiket="Bugüne kadar" deger={`${SAYI(ogr)} kayıt`} alt={MN(ciro)} />
            {/* Kalan öğrenci ve kalan ciro ayrı ayrı: biri diğerinin alt
                satırıyken ciro ikinci sınıf bir bilgi gibi okunuyordu. */}
            <Kutucuk etiket="Hedefe kalan öğrenci" deger={`${SAYI(kalanOgr)} kayıt`} alt={`hedef ${SAYI(hedefOgr)}`} />
            <Kutucuk etiket="Hedefe kalan ciro" deger={MN(kalanCiro)} alt={`hedef ${MN(hedefCiro)}`} />
            <Kutucuk
              etiket="Hedef tutarsa dönem kârı"
              deger={MN(hedefKar)}
              alt="Kâr Hesabı'ndaki gider ve ek kaynaklara göre"
              vurgu
            />
          </div>
        )}
      </div>
    </header>
  );
}

/* --------------------------------------------------------- kalan tablosu */

/**
 * Hedefe kalan miktar: her hat ayrı satır, birden fazla hat varsa altta
 * genel toplam. Öğrenci ve ciro ayrı sütunlarda — biri diğerinin altında
 * küçük yazıyken ciro açığı gözden kaçıyordu.
 */
function KalanTablosu({ ozetler }: { ozetler: HatOzeti[] }) {
  if (ozetler.length === 0) return null;

  const toplamOgr = ozetler.reduce((t, o) => t + o.kalanOgrenci, 0);
  const toplamCiro = ozetler.reduce((t, o) => t + o.kalanCiro, 0);
  const toplamHedefOgr = ozetler.reduce((t, o) => t + o.hedef.ogrenci, 0);
  const toplamHedefCiro = ozetler.reduce((t, o) => t + o.hedef.ciro, 0);

  return (
    <section className="card rise" style={{ marginBottom: "var(--sp-5)" }}>
      <div className="label" style={{ marginBottom: "var(--sp-3)" }}>HEDEFE KALAN</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "var(--sp-3) var(--sp-5)", alignItems: "baseline" }}>
        <div className="caption" />
        <div className="caption" style={baslikHucre}>Öğrenci</div>
        <div className="caption" style={baslikHucre}>Ciro</div>

        {ozetler.map((o) => (
          <Fragment key={o.anahtar}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", minWidth: 0 }}>
              <span style={{ width: 3, height: "1em", borderRadius: "var(--r-full)", background: o.hedef.renk, flexShrink: 0 }} />
              <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>{o.hedef.ad}</span>
            </div>
            <KalanHucre
              deger={o.kalanOgrenci > 0 ? `${SAYI(o.kalanOgrenci)} kayıt` : `+${SAYI(o.ogrenci - o.hedef.ogrenci)} aşıldı`}
              alt={`${SAYI(o.ogrenci)} / ${SAYI(o.hedef.ogrenci)}`}
              asildi={o.kalanOgrenci === 0}
            />
            <KalanHucre
              deger={o.kalanCiro > 0 ? MN(o.kalanCiro) : `+${MN(o.ciro - o.hedef.ciro)} aşıldı`}
              alt={`${MN(o.ciro)} / ${MN(o.hedef.ciro)}`}
              asildi={o.kalanCiro === 0}
            />
          </Fragment>
        ))}

        {/* Genel toplam yalnızca birden fazla hat görünüyorsa — tek hatta
            aynı satırı iki kez yazmak olurdu. */}
        {ozetler.length > 1 && (
          <>
            <div style={{ ...genelSatir, fontSize: "0.88rem", fontWeight: 800 }}>GENEL</div>
            <div style={genelSatir}>
              <KalanHucre
                deger={toplamOgr > 0 ? `${SAYI(toplamOgr)} kayıt` : "hedef aşıldı"}
                alt={`${SAYI(toplamHedefOgr - toplamOgr)} / ${SAYI(toplamHedefOgr)}`}
                asildi={toplamOgr === 0}
                kalin
              />
            </div>
            <div style={genelSatir}>
              <KalanHucre
                deger={toplamCiro > 0 ? MN(toplamCiro) : "hedef aşıldı"}
                alt={`${MN(toplamHedefCiro - toplamCiro)} / ${MN(toplamHedefCiro)}`}
                asildi={toplamCiro === 0}
                kalin
              />
            </div>

          </>
        )}
      </div>
    </section>
  );
}

function KalanHucre({ deger, alt, asildi, kalin, vurgu }: {
  deger: string; alt: string; asildi: boolean; kalin?: boolean; vurgu?: boolean;
}) {
  return (
    <div style={{ textAlign: "right" }}>
      <div
        className="num"
        style={{
          fontSize: kalin ? "1.1rem" : "1rem",
          fontWeight: kalin ? 800 : 700,
          letterSpacing: "-0.015em",
          color: vurgu || asildi ? "var(--success)" : "var(--text)",
          whiteSpace: "nowrap",
        }}
      >
        {deger}
      </div>
      <div className="caption num">{alt}</div>
    </div>
  );
}

/* ---------------------------------------------------- kâr hesabı tablosu */

/**
 * Kâr Hesabı'nın "Kurum toplamı" tablosunun aynısı: yıl sonu öğrenci,
 * ciro, kâr ve marj. Rakamlar kurumToplami() ile üretiliyor — Kâr Hesabı
 * da aynı fonksiyonu çağırıyor, iki ekran ayrışamaz.
 *
 * Yukarıdaki tablo "hedefe ne kaldı" der; bu tablo "Kâr Hesabı'ndaki
 * varsayımlarla yıl nerede biter" der. İkisi farklı soru, o yüzden ayrı.
 */
function KarHesabiTablosu({ ozetler }: { ozetler: HatOzeti[] }) {
  if (ozetler.length === 0) return null;

  const ogr = ozetler.reduce((t, o) => t + o.yilSonuOgrenci, 0);
  const ciro = ozetler.reduce((t, o) => t + o.yilSonuCiro, 0);
  const gider = ozetler.reduce((t, o) => t + o.gider, 0);
  const kar = ciro - gider;

  return (
    <section className="card rise rise-1" style={{ marginBottom: "var(--sp-5)" }}>
      <div className="label" style={{ marginBottom: 2 }}>KÂR HESABI'NA GÖRE YIL SONU</div>
      <div className="caption" style={{ marginBottom: "var(--sp-3)" }}>
        Gerçekleşene, Kâr Hesabı'ndaki "bu saatten sonra" varsayımı ve ek kaynaklar eklenmiş hâli.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: "var(--sp-3) var(--sp-5)", alignItems: "baseline" }}>
        <div className="caption" />
        <div className="caption" style={baslikHucre}>Öğrenci</div>
        <div className="caption" style={baslikHucre}>Ciro</div>
        <div className="caption" style={baslikHucre}>Kâr</div>
        <div className="caption" style={baslikHucre}>Marj</div>

        {ozetler.map((o) => (
          <Fragment key={o.anahtar}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", minWidth: 0 }}>
              <span style={{ width: 3, height: "1em", borderRadius: "var(--r-full)", background: o.hedef.renk, flexShrink: 0 }} />
              <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>{o.hedef.ad}</span>
            </div>
            <KalanHucre
              deger={SAYI(o.yilSonuOgrenci)}
              alt={`${SAYI(o.ogrenci)} + ${SAYI(o.beklenenOgrenci)}`}
              asildi={o.yilSonuOgrenci >= o.hedef.ogrenci}
            />
            <KalanHucre
              deger={MN(o.yilSonuCiro)}
              alt={`hedef ${MN(o.hedef.ciro)}`}
              asildi={o.yilSonuCiro >= o.hedef.ciro}
            />
            <KalanHucre deger={MN(o.yilSonuKar)} alt={`gider ${MN(o.gider)}`} asildi={o.yilSonuKar > 0} />
            <KalanHucre
              deger={YZ(o.yilSonuMarj)}
              alt={`hedef %${String(o.karMarjHedefi).replace(".", ",")}`}
              asildi={o.yilSonuMarj * 100 >= o.karMarjHedefi}
            />
          </Fragment>
        ))}

        {ozetler.length > 1 && (
          <>
            <div style={{ ...genelSatir, fontSize: "0.88rem", fontWeight: 800 }}>KURUM</div>
            <div style={genelSatir}><KalanHucre deger={SAYI(ogr)} alt="" asildi={false} kalin /></div>
            <div style={genelSatir}><KalanHucre deger={MN(ciro)} alt="" asildi={false} kalin /></div>
            <div style={genelSatir}><KalanHucre deger={MN(kar)} alt={`gider ${MN(gider)}`} asildi={kar > 0} kalin /></div>
            <div style={genelSatir}>
              <KalanHucre deger={YZ(ciro > 0 ? kar / ciro : 0)} alt="" asildi={false} kalin />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- hat kartı */

function HatKarti({ ozet, gecikme, isMobile }: { ozet: HatOzeti; gecikme: number; isMobile: boolean }) {
  const d = DURUM_BILGI[ozet.durum];
  const renk = ozet.hedef.renk;

  return (
    <section
      className={`card rise rise-${gecikme + 1}`}
      style={{ padding: 0, overflow: "hidden", borderColor: `color-mix(in srgb, ${renk} 26%, var(--line))` }}
    >
      <div style={{ height: 3, background: `linear-gradient(90deg, ${renk}, transparent)` }} />

      <div style={{ padding: "var(--sp-5)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--sp-3)" }}>
          <div>
            <h2 style={{ margin: 0 }}>{ozet.hedef.ad}</h2>
            <div className="caption" style={{ marginTop: 2 }}>{ozet.hedef.hatlar.join(" + ")}</div>
          </div>
          <span
            style={{
              ...durumRozeti, color: d.renk,
              borderColor: `color-mix(in srgb, ${d.renk} 40%, transparent)`,
              background: `color-mix(in srgb, ${d.renk} 12%, transparent)`,
            }}
          >
            {d.simge} {d.etiket}
          </span>
        </div>

        {/* ÜÇ TEMEL RAKAM — ekranın omurgası */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--sp-3)", marginTop: "var(--sp-5)" }}>
          <Metrik
            etiket="ÖĞRENCİ"
            deger={SAYI(ozet.ogrenci)}
            hedef={`hedef ${SAYI(ozet.hedef.ogrenci)}`}
            kalan={
              ozet.kalanOgrenci > 0
                ? `${SAYI(ozet.kalanOgrenci)} kayıt kaldı`
                : `hedef aşıldı +${SAYI(ozet.ogrenci - ozet.hedef.ogrenci)}`
            }
            asildi={ozet.kalanOgrenci === 0}
            oran={ozet.ogrenciOran}
            renk={renk}
          />
          <Metrik
            etiket="CİRO"
            deger={MN(ozet.ciro)}
            hedef={`hedef ${MN(ozet.hedef.ciro)}`}
            kalan={
              ozet.kalanCiro > 0
                ? `${MN(ozet.kalanCiro)} kaldı`
                : `hedef aşıldı +${MN(ozet.ciro - ozet.hedef.ciro)}`
            }
            asildi={ozet.kalanCiro === 0}
            oran={ozet.ciroOran}
            renk={renk}
          />
          <Metrik
            etiket="ORTALAMA"
            deger={ozet.ogrenci > 0 ? TL(ozet.ortalama) : "—"}
            hedef={`hedef ${TL(ozet.hedefOrtalama)}`}
            kalan={
              ozet.ogrenci === 0
                ? "kayıt bekleniyor"
                : ozet.kalanOrtalama > 0
                  ? `${TL(ozet.kalanOrtalama)} kaldı`
                  : `hedef aşıldı +${TL(ozet.ortalama - ozet.hedefOrtalama)}`
            }
            asildi={ozet.ogrenci > 0 && ozet.kalanOrtalama === 0}
            oran={ozet.ortalamaOran}
            renk={ozet.ortalamaOran >= 1 ? "var(--success)" : renk}
          />
        </div>

        {/* Kâr merdiveni */}
        <Merdiven ozet={ozet} isMobile={isMobile} />

        {/* Tempo */}
        <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-5)" }}>
          <Tempo
            etiket="Gereken tempo"
            deger={`${ONDALIK(ozet.gerekenGunluk)} kayıt/gün`}
            alt={`${SAYI(ozet.kalanOgrenci)} kayıt · ${kalanGun()} gün`}
            renk={renk}
          />
          <Tempo
            etiket="Son 30 günün temposu"
            deger={`${ONDALIK(ozet.suAnkiGunluk)} kayıt/gün`}
            alt={
              ozet.suAnkiGunluk >= ozet.gerekenGunluk
                ? "gereken tempodan hızlısın"
                : `günde ${ONDALIK(ozet.gerekenGunluk - ozet.suAnkiGunluk)} kayıt daha`
            }
            renk={ozet.suAnkiGunluk >= ozet.gerekenGunluk ? "var(--success)" : "var(--text-2)"}
          />
        </div>

        {/* Geçen dönemin aynı takvim penceresi. Buraya bir dönem sonu
            tahmini yazmak ("333 kayıt") hedefin altını gösteren bir hüküm
            gibi okunuyordu; aynı veri, gerçekleşmiş ve ulaşılabilir bir
            kıyasa çevrildi: geçen dönem bu tarihten sonra ne geldiyse o. */}
        <Satir
          etiket="Bu tarihten sonra gereken"
          deger={`${SAYI(ozet.kalanOgrenci)} kayıt · ${MN(ozet.kalanCiro)}`}
          altBilgi={
            ozet.gecenVerisiVar
              ? `geçen dönem aynı pencerede ${SAYI(ozet.gecenSonrasiOgrenci)} kayıt · ${MN(ozet.gecenSonrasiCiro)} gelmişti`
              : `${kiyasDonem()} döneminde bu hatta kıyas kaydı yok`
          }
          renk={
            ozet.gecenVerisiVar && ozet.kalanOgrenci <= ozet.gecenSonrasiOgrenci
              ? "var(--success)"
              : undefined
          }
        />

        <Firsat ozet={ozet} />
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- merdiven */

/**
 * Üç eşik tek çubukta: başabaş → kâr hedefi → dönem hedefi.
 * Yüzde tek başına "hedefin dörtte üçü" der; merdiven "başabaşı geçtin,
 * kâr eşiğine şu kadar kaldı" der. Aradaki fark ekranın bütün tonu.
 */
function Merdiven({ ozet, isMobile }: { ozet: HatOzeti; isMobile: boolean }) {
  const renk = ozet.hedef.renk;
  const tavan = Math.max(ozet.hedef.ogrenci, ozet.ogrenci, ozet.karHedefiOgrenci) * 1.04;
  const yer = (n: number) => `${Math.min(100, (n / tavan) * 100)}%`;
  const dolu = Math.min(100, (ozet.ogrenci / tavan) * 100);

  // Sıra değere göre: LGS'de %20 kâr eşiği dönem hedefinin üstüne düşebiliyor,
  // sabit sırada yazılsa etiketler çubuktaki çizgilerle ters düşerdi.
  // Her eşiğin altında hangi hesaptan çıktığı yazılı: kaç kayıt olduğu
  // kadar neden o kadar olduğu da görünsün.
  const ek = ozet.ekKaynak > 0 ? ` − ${MN(ozet.ekKaynak)} ek kaynak` : "";
  const esikler = [
    {
      n: ozet.basabasOgrenci, ad: "başabaş", renk: "var(--text-3)",
      hesap: `${MN(ozet.gider)} gider${ek} ÷ ${TL(ozet.olcuOrtalama)} ortalama`,
    },
    {
      n: ozet.karHedefiOgrenci, ad: `%${String(ozet.karMarjHedefi).replace(".", ",")} kâr`, renk: "var(--gold)",
      hesap: `${MN(ozet.karHedefiCiro)} ciro${ek} ÷ ${TL(ozet.olcuOrtalama)} ortalama`,
    },
    {
      n: ozet.hedef.ogrenci, ad: "dönem hedefi", renk,
      hesap: `${MN(ozet.hedef.ciro)} ciro · ${TL(ozet.hedefOrtalama)} ortalama`,
    },
  ].sort((a, b) => a.n - b.n);

  return (
    <div style={{ marginTop: "var(--sp-5)" }}>
      <div className="label" style={{ marginBottom: 2 }}>KÂR MERDİVENİ</div>
      <div className="caption" style={{ marginBottom: "var(--sp-3)" }}>
        Eşikler, gerçekleşen ortalamayla kaç kayıt gerektiğini gösterir; ortalama
        değiştikçe eşikler de kayar.
      </div>

      <div style={{ position: "relative", height: 10, borderRadius: "var(--r-full)", background: "var(--surface-raised)", border: "1px solid var(--line)" }}>
        <div
          style={{
            position: "absolute", inset: "0 auto 0 0", width: `${dolu}%`,
            borderRadius: "var(--r-full)",
            background: `linear-gradient(90deg, color-mix(in srgb, ${renk} 55%, transparent), ${renk})`,
            transition: "width var(--dur-med) var(--ease-out)",
          }}
        />
        {esikler.map((e) => (
          <div
            key={e.ad}
            title={`${e.ad}: ${SAYI(e.n)} kayıt`}
            style={{ position: "absolute", top: -3, bottom: -3, left: yer(e.n), width: 2, background: e.renk, borderRadius: 1 }}
          />
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr 1fr" : "repeat(3, 1fr)",
          gap: "var(--sp-2)", marginTop: "var(--sp-3)",
        }}
      >
        {esikler.map((e) => {
          const gecildi = ozet.ogrenci >= e.n;
          return (
            <div key={e.ad} style={{ borderLeft: `2px solid ${e.renk}`, paddingLeft: "var(--sp-2)" }}>
              <div className="caption" style={{ textTransform: "uppercase", letterSpacing: "var(--t-label-ls)" }}>{e.ad}</div>
              <div className="num" style={{ fontWeight: 700, fontSize: "0.9rem" }}>{SAYI(e.n)}</div>
              <div className="caption" style={{ color: gecildi ? "var(--success)" : "var(--text-3)" }}>
                {gecildi ? "geçildi ✓" : `${SAYI(e.n - ozet.ogrenci)} kayıt`}
              </div>
              <div className="caption num" style={{ marginTop: 2, color: "var(--text-3)" }}>{e.hesap}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- fırsat */

/** Kartın kapanışı: ne kaybedileceği değil, kalan günde ne kazanılacağı. */
function Firsat({ ozet }: { ozet: HatOzeti }) {
  const renk = DURUM_BILGI[ozet.durum].renk;
  const kalan = kalanGun();
  const gunluk = (n: number) => ONDALIK(n / Math.max(1, kalan));
  const marj = String(ozet.karMarjHedefi).replace(".", ",");
  const satirlar: string[] = [];

  if (ozet.ogrenci >= ozet.karHedefiOgrenci) {
    satirlar.push(
      `%${marj} kâr eşiği geçildi. Bundan sonraki her kayıt doğrudan kâra yazılıyor — ` +
      `kayıt başına yaklaşık ${TL(ozet.ortalama > 0 ? ozet.ortalama : ozet.hedefOrtalama)}.`
    );
  } else if (ozet.ogrenci >= ozet.basabasOgrenci) {
    const fark = ozet.karHedefiOgrenci - ozet.ogrenci;
    satirlar.push(
      `Gider çıktı, kâr bölgesindesin. %${marj} kâr eşiğine ${SAYI(fark)} kayıt var — ` +
      `kalan ${kalan} günde günde ${gunluk(fark)} kayıt yetiyor.`
    );
  } else {
    const fark = ozet.basabasOgrenci - ozet.ogrenci;
    satirlar.push(
      `Başabaşa ${SAYI(fark)} kayıt kaldı; ondan sonraki her kayıt doğrudan kâr. ` +
      `Kalan ${kalan} günde günde ${gunluk(fark)} kayıt bu eşiği açıyor.`
    );
  }

  if (ozet.kalanOgrenci > 0) {
    satirlar.push(
      `Hedefe kalan ${SAYI(ozet.kalanOgrenci)} kaydın tamamı gelirse dönem kârı ` +
      `${MN(ozet.hedefKar)} olur (marj ${YZ(ozet.hedefMarj)}).`
    );
  }

  if (ozet.hedefMarj * 100 < ozet.karMarjHedefi) {
    satirlar.push(
      `Dönem hedefinin marjı ${YZ(ozet.hedefMarj)}; Kâr Hesabı'ndaki %${marj} eşiği için ` +
      `${SAYI(ozet.karHedefiOgrenci)} kayıt ya da ortalamanın ` +
      `${TL((karHedefiCirosu(ozet.gider, ozet.karMarjHedefi) - ozet.ekKaynak) / ozet.hedef.ogrenci)} olması gerekir.`
    );
  }

  if (ozet.ogrenci > 0 && ozet.ortalama < ozet.hedefOrtalama) {
    const artis = ozet.hedefOrtalama - ozet.ortalama;
    const denk = Math.ceil((artis * ozet.ogrenci) / ozet.hedefOrtalama);
    satirlar.push(
      `Ortalamayı kayıt başına ${TL(artis)} yukarı çekmek, ${SAYI(denk)} yeni kayıt ` +
      `bulmakla aynı kapıya çıkıyor — indirim masasında kazanılacak yer var.`
    );
  }

  return (
    <div
      style={{
        marginTop: "var(--sp-4)", padding: "var(--sp-3) var(--sp-4)",
        borderRadius: "var(--r-md)",
        background: `color-mix(in srgb, ${renk} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${renk} 30%, transparent)`,
        display: "flex", flexDirection: "column", gap: "var(--sp-2)",
      }}
    >
      {satirlar.map((m, i) => (
        <div key={i} style={{ fontSize: "0.85rem", lineHeight: 1.45, color: "var(--text)" }}>{m}</div>
      ))}
      <div className="caption">
        Gider {TL(ozet.gider)}
        {ozet.giderCanli ? " — Finans'tan, Kâr Hesabı'ndaki % artışla" : " — Finans'ta bu dönem verisi yok, Kâr Hesabı'nın varsayımı"}
        {ozet.ekKaynak > 0 && ` · ek kaynaklar ${TL(ozet.ekKaynak)} ciroya eklendi`}
        {ozet.anahtar === "yks" && " · MOOD kayıtları sayıma girmez"}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- parçalar */

/**
 * Bir metrik: değer, hedefe göre ilerleme ve HEDEFE NE KADAR KALDIĞI.
 * Kalan rakam yüzdeden daha işe yarar — "%68" ne yapılacağını söylemez,
 * "271 kayıt kaldı" söyler.
 */
function Metrik({ etiket, deger, hedef, kalan, asildi, oran, renk }: {
  etiket: string; deger: string; hedef: string; kalan: string;
  asildi: boolean; oran: number; renk: string;
}) {
  return (
    <div>
      <div className="caption" style={{ textTransform: "uppercase", letterSpacing: "var(--t-label-ls)", fontWeight: 700 }}>
        {etiket}
      </div>
      <div className="num" style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.02em", marginTop: 2, whiteSpace: "nowrap" }}>
        {deger}
      </div>
      <div style={{ height: 4, borderRadius: "var(--r-full)", background: "var(--surface-raised)", border: "1px solid var(--line)", marginTop: "var(--sp-2)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%", width: `${Math.min(100, Math.max(0, oran * 100))}%`,
            background: renk, transition: "width var(--dur-med) var(--ease-out)",
          }}
        />
      </div>
      <div className="caption num" style={{ marginTop: 3 }}>{YZ(oran)} · {hedef}</div>
      <div
        className="num"
        style={{
          marginTop: 2, fontSize: "0.78rem", fontWeight: 700,
          color: asildi ? "var(--success)" : "var(--text-2)",
        }}
      >
        {kalan}
      </div>
    </div>
  );
}

function Tempo({ etiket, deger, alt, renk }: { etiket: string; deger: string; alt: string; renk: string }) {
  return (
    <div style={{ flex: 1, background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "var(--sp-3)" }}>
      <div className="caption" style={{ textTransform: "uppercase", letterSpacing: "var(--t-label-ls)" }}>{etiket}</div>
      <div className="num" style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-0.015em", marginTop: 2, color: renk }}>{deger}</div>
      <div className="caption" style={{ marginTop: 1 }}>{alt}</div>
    </div>
  );
}

function Satir({ etiket, deger, altBilgi, renk }: { etiket: string; deger: string; altBilgi?: string; renk?: string }) {
  return (
    <div className="data-row" style={{ alignItems: "flex-start", marginTop: "var(--sp-2)" }}>
      <div>
        <div style={{ fontSize: "0.85rem", color: "var(--text-2)", fontWeight: 500 }}>{etiket}</div>
        {altBilgi && <div className="caption" style={{ marginTop: 2 }}>{altBilgi}</div>}
      </div>
      <div className="num" style={{ fontWeight: 700, fontSize: "0.92rem", textAlign: "right", color: renk || "var(--text)", whiteSpace: "nowrap" }}>
        {deger}
      </div>
    </div>
  );
}

function Kutucuk({ etiket, deger, alt, vurgu }: { etiket: string; deger: string; alt: string; vurgu?: boolean }) {
  return (
    <div>
      <div className="caption" style={{ textTransform: "uppercase", letterSpacing: "var(--t-label-ls)" }}>{etiket}</div>
      <div className="num" style={{ fontSize: "1.3rem", fontWeight: 800, letterSpacing: "-0.02em", marginTop: 2, color: vurgu ? "var(--success)" : "var(--text)" }}>
        {deger}
      </div>
      <div className="caption" style={{ marginTop: 1 }}>{alt}</div>
    </div>
  );
}

/* --------------------------------------------------------------- stiller */

const kahramanKutu: React.CSSProperties = {
  marginTop: "var(--sp-4)",
  padding: "var(--sp-5)",
  borderRadius: "var(--r-lg)",
  background: "var(--surface)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-sm), inset 0 1px 0 var(--material-edge)",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--sp-5)",
};

const geriSayimSayi: React.CSSProperties = {
  fontSize: "clamp(2.6rem, 8vw, 3.6rem)",
  fontWeight: 800,
  lineHeight: 1,
  letterSpacing: "-0.04em",
  color: "var(--accent)",
};

const donemRozeti: React.CSSProperties = {
  fontSize: "var(--t-label-size)",
  letterSpacing: "var(--t-label-ls)",
  fontWeight: 700,
  color: "var(--accent)",
  background: "color-mix(in srgb, var(--accent) 12%, transparent)",
  border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
  borderRadius: "var(--r-full)",
  padding: "var(--sp-1) var(--sp-3)",
  whiteSpace: "nowrap",
};

const durumRozeti: React.CSSProperties = {
  fontSize: "var(--t-caption-size)",
  letterSpacing: "var(--t-caption-ls)",
  fontWeight: 800,
  borderRadius: "var(--r-full)",
  border: "1px solid",
  padding: "var(--sp-1) var(--sp-3)",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const baslikHucre: React.CSSProperties = {
  textAlign: "right",
  textTransform: "uppercase",
  letterSpacing: "var(--t-label-ls)",
};

const genelSatir: React.CSSProperties = {
  borderTop: "1px solid var(--line-strong)",
  paddingTop: "var(--sp-3)",
};

const bilgiKutusu: React.CSSProperties = {
  background: "color-mix(in srgb, var(--accent) 10%, transparent)",
  border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
  borderRadius: "var(--r-md)",
  padding: "var(--sp-4)",
  color: "var(--text)",
  fontSize: "0.9rem",
};
