import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../store/AuthContext";
import { useRecords } from "../../hooks/useRecords";
import { aktifDonem, donemListesi, egitimYili, kiyasDonem } from "../../constants/donem";
import { finansOzetleri, type FinansOzetleri } from "../../services/karHesabiGider";
// Model iki ekranda ortak: Kurs Hedefleri de aynı gider ve kâr eşiklerini okur.
import {
  KOLEKSIYON, ENFLASYON, KAR_HEDEFI, YKS_GIDER, LGS_GIDER,
  YKS_HATLARI, LGS_HATLARI, sadelestir, moodMu,
  VARSAYILAN_ARTIS, giderProjeksiyonu,
  ALANLAR, VARSAYILAN,
  type Hedefler, type Artislar, type Varsayimlar,
} from "../../services/karHesabiModel";
import SayiGirdisi from "../../components/ui/SayiGirdisi";
import { ChevronDown } from "lucide-react";

/* =====================================================================
   KÂR HESABI

   Ekranın kendisi hazır bir HTML: public/kar-hesabi.html. Panelin canlı
   rakamları içine veriyiYukle() ile veriliyor; gerçekleşen ortalama ve
   geçen yıl kıyası HTML'e değil, iframe'in DOM'una ekleniyor.

   MOOD bilerek dışarıda bırakılır: ekranda ayrı bir kutu olarak elle
   giriliyor, YKS cirosuna eklenirse iki kez sayılırdı.

   Gider elle girilmez: Finans'ın yıl sonu gideri alınıp % artışla
   önümüzdeki döneme taşınır. Kullanıcının girdiği varsayımlar (bu
   saatten sonraki öğrenci/ortalama, ek kaynaklar, % artışlar, kâr
   hedefi) dönem bazında Firestore'da saklanır.
   ===================================================================== */


/* Ekranda kullanıcının doldurduğu kutular — gider hariç, o türetiliyor.
   Ek kaynak kalemleri hatlara göre farklı: YKS'de MOOD var, LGS'de
   birebir/özel ders ve deneme geliri var. */
const EK_KALEMLER = {
  y: [{ alan: "mood", etiket: "MOOD" }],
  l: [
    { alan: "biders", etiket: "Birebir Ders" },
    { alan: "ozel", etiket: "Özel Ders" },
    { alan: "deneme", etiket: "Deneme" },
  ],
} as const;

const TL = (n: number) => n.toLocaleString("tr-TR");
const TLS = (n: number) => `${TL(Math.round(n))} ₺`;


/** Ekrandaki kutudan sayıyı okur: "5.000.000" → 5000000 */
function kutuSayisi(belge: Document, kimlik: string): number {
  const el = belge.getElementById(kimlik) as HTMLInputElement | null;
  if (!el) return 0;
  return Number(String(el.value).replace(/\./g, "").replace(/[^0-9-]/g, "")) || 0;
}

/** Ekrandaki bütün kutuları tek nesnede okur. */
function kutulariOku(belge: Document): Varsayimlar {
  const cikti: Varsayimlar = {};
  (["y", "l"] as const).forEach((on) => {
    ALANLAR[on].forEach((alan) => {
      cikti[`${on}_${alan}`] = kutuSayisi(belge, `${on}_${alan}`);
    });
  });
  return cikti;
}

/**
 * Bir hattın "Ek kaynaklar" kalemlerini kurar. Kalemler hatlara göre
 * değiştiği için satırlar HTML'de sabit değil, burada oluşturuluyor;
 * ekranın hesabı blok içindeki bütün kutuları topladığı için yeni kalem
 * eklemek yeterli.
 */
function ekKaynaklariKur(belge: Document, on: "y" | "l") {
  const blok = belge.getElementById(`ek_${on}`);
  if (!blok) return;

  const kalemler = EK_KALEMLER[on];
  // Yemek ve Diğer HTML'de duruyor; onlardan öncesini kalemlere göre kur.
  const yemekSatiri = belge.getElementById(`${on}_yemek`)?.parentElement;
  if (!yemekSatiri) return;

  kalemler.forEach(({ alan, etiket }) => {
    if (belge.getElementById(`${on}_${alan}`)) return;
    const satir = belge.createElement("div");
    satir.className = "satir";
    satir.innerHTML =
      `<span>${etiket}</span>` +
      `<input type="text" inputmode="numeric" id="${on}_${alan}" value="0">`;
    yemekSatiri.before(satir);
    const kutu = satir.querySelector("input") as HTMLInputElement;
    // HTML'in kendi kutularındaki oninput davranışının aynısı.
    kutu.addEventListener("input", () => {
      const p = belge.defaultView as (Window & { fmt?: (el: HTMLInputElement) => void; hesapla?: () => void }) | null;
      p?.fmt?.(kutu);
      p?.hesapla?.();
    });
  });

  // Hatta ait olmayan kalemler (LGS'de MOOD gibi) kaldırılır.
  const gecerli = new Set(kalemler.map((k) => k.alan));
  ["mood", "biders", "ozel", "deneme"].forEach((alan) => {
    if (gecerli.has(alan as never)) return;
    belge.getElementById(`${on}_${alan}`)?.parentElement?.remove();
  });
}

/**
 * "Gerçekleşen" kutusuna ciro ÷ öğrenci satırını ekler.
 *
 * Satır HTML dosyasına değil, iframe'in DOM'una yazılıyor. veriyiYukle()
 * bu kutuyu yeniden oluşturmaz, yalnızca öğrenci ve ciro metinlerini
 * değiştirir; o yüzden satır yerinde kalır, değerini her beslemede
 * burada tazeliyoruz.
 */
function ortalamaSatiri(belge: Document, on: "y" | "l", ogr: number, ciro: number) {
  const ciroSatiri = belge.getElementById(`sabit_${on}_ciro`)?.parentElement;
  if (!ciroSatiri) return;

  const kimlik = `ort_${on}`;
  if (!belge.getElementById(kimlik)) {
    const satir = belge.createElement("div");
    satir.className = "satir";
    satir.innerHTML = `<span>Ortalama</span><span id="${kimlik}"></span>`;
    ciroSatiri.after(satir);
  }

  const deger = belge.getElementById(kimlik);
  if (deger) {
    const ort = ogr > 0 ? Math.round(ciro / ogr) : 0;
    deger.textContent = TLS(ort);
  }
}

/**
 * "Bu saatten sonra" kutusunun altına geçen yılın aynı dilimini yazar:
 * tahmin havada kalmasın, geçen yıl bu tarihten sonra gerçekte ne geldiyse
 * onun yanında girilsin.
 */
function kiyasSatiri(
  belge: Document, on: "y" | "l", kiyasYil: number,
  ogr: number, ciro: number, goster: boolean,
) {
  const carpim = belge.getElementById(`${on}_carpim`);
  if (!carpim) return;

  const kimlik = `gecen_${on}`;
  let el = belge.getElementById(kimlik);
  if (!el) {
    el = belge.createElement("div");
    el.id = kimlik;
    el.className = "carpim";
    carpim.after(el);
  }

  // Yıl ekinin ünlü uyumuyla uğraşmamak için yıl parantezde veriliyor.
  // Tüm Yıl görünümünde "bundan sonrası" diye bir dilim yok.
  el.textContent = goster && ogr > 0
    ? `geçen yıl (${kiyasYil}) bu tarihten sonra: ${ogr} öğrenci · ort. ${TLS(ciro / ogr)}`
    : "";
}

/** Gider kutusunun altına rakamın nereden geldiğini yazar. */
function giderKaynagi(belge: Document, on: "y" | "l", metin: string) {
  const kutu = belge.getElementById(`${on}_gider`);
  const satir = kutu?.parentElement;
  if (!satir) return;

  const kimlik = `kaynak_${on}`;
  let el = belge.getElementById(kimlik);
  if (!el) {
    el = belge.createElement("div");
    el.id = kimlik;
    el.className = "carpim";
    satir.after(el);
  }
  el.textContent = metin;
}

/** Panel başlığına o hattın kâr hedefini yazar. */
function panelBasligi(belge: Document, on: "y" | "l", hedef: number) {
  const basliklar = belge.querySelectorAll(".panel h2");
  const h2 = basliklar[on === "y" ? 0 : 1];
  if (h2) h2.textContent = `${on === "y" ? "YKS" : "LGS"} · hedef %${String(hedef).replace(".", ",")}`;
}

/**
 * Finans'ın ciro projeksiyonunu aşağıdaki hesaba hedef olarak bağlar:
 * o ciroya ulaşmak için bu saatten sonra ne kadar ciro ve kaç öğrenci
 * gerektiğini yazar, tek tıkla öğrenci kutusuna uygulanır.
 *
 * Ek kaynaklar ve ortalama kutulardan okunur; kullanıcı onları
 * değiştirdikçe satır da yeniden hesaplanır.
 */
function finansHedefi(
  belge: Document, on: "y" | "l",
  hedefCiro: number, gerceklesenCiro: number, goster: boolean,
) {
  const carpim = belge.getElementById(`${on}_carpim`);
  if (!carpim) return;

  const kimlik = `fhedef_${on}`;
  let el = belge.getElementById(kimlik);
  if (!el) {
    el = belge.createElement("div");
    el.id = kimlik;
    el.className = "carpim";
    (belge.getElementById(`gecen_${on}`) ?? carpim).after(el);
  }

  if (!goster || hedefCiro <= 0) {
    el.textContent = "";
    return;
  }

  let ek = 0;
  belge.querySelectorAll<HTMLInputElement>(`#ek_${on} input`).forEach((el) => {
    ek += Number(String(el.value).replace(/\./g, "").replace(/[^0-9-]/g, "")) || 0;
  });
  const ortalama = kutuSayisi(belge, `${on}_ort`);
  const gereken = hedefCiro - gerceklesenCiro - ek;

  if (gereken <= 0) {
    el.textContent = `Finans hedefi (${TLS(hedefCiro)}) bu ek kaynaklarla zaten karşılanıyor`;
    return;
  }

  const ogrenci = ortalama > 0 ? Math.ceil(gereken / ortalama) : 0;
  el.textContent = `Finans hedefi için: ${TLS(gereken)} · ${ogrenci} öğrenci `;

  if (ogrenci > 0) {
    const dugme = belge.createElement("span");
    dugme.textContent = "uygula";
    dugme.style.cssText = "text-decoration:underline;cursor:pointer";
    dugme.onclick = () => {
      const kutu = belge.getElementById(`${on}_ogr`) as HTMLInputElement | null;
      if (!kutu) return;
      kutu.value = TL(ogrenci);
      kutu.dispatchEvent(new Event("input", { bubbles: true }));
    };
    el.appendChild(dugme);
  }
}

export default function KarHesabiPage() {
  const { user } = useAuth();
  const { records } = useRecords();

  const [year, setYear] = useState<number>(aktifDonem());
  const [viewMode, setViewMode] = useState<"today" | "all">("today");

  const { targetDay, targetMonth, bugun } = useMemo(() => {
    const d = new Date();
    return { targetDay: d.getDate(), targetMonth: d.getMonth() + 1, bugun: d };
  }, []);

  const donemler = useMemo(() => donemListesi(records), [records]);

  const veri = useMemo(() => {
    const topla = (
      hatlar: string[], moodHaric: boolean, hedefYil: number,
      dilim: "bugunekadar" | "sonrasi" | "tumu",
    ) => {
      let ogr = 0;
      let ciro = 0;
      records.forEach((r) => {
        if (!hatlar.includes(sadelestir(r.Okul))) return;
        if (moodHaric && moodMu(r.Sınıf)) return;

        const p = String(r.SözleşmeTarihi || "").split(".");
        if (p.length < 3) return;
        const rD = parseInt(p[0]);
        const rM = parseInt(p[1]);
        const rY = parseInt(p[2]);
        if (rY !== hedefYil) return;

        if (dilim !== "tumu") {
          const bugunekadar = rM < targetMonth || (rM === targetMonth && rD <= targetDay);
          if (dilim === "bugunekadar" && !bugunekadar) return;
          if (dilim === "sonrasi" && bugunekadar) return;
        }

        ogr += 1;
        ciro += Number(r.SonTutar) || 0;
      });
      return { ogr, ciro };
    };

    const dilim = viewMode === "today" ? "bugunekadar" : "tumu";
    const kiyas = kiyasDonem(year);
    const gunAy = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" }).format(bugun);

    return {
      tarih: viewMode === "today" ? `${gunAy} ${year}` : `${year} dönemi · tüm yıl`,
      yks: topla(YKS_HATLARI, true, year, dilim),
      lgs: topla(LGS_HATLARI, false, year, dilim),
      kiyasYil: kiyas,
      kiyasYks: topla(YKS_HATLARI, true, kiyas, "sonrasi"),
      kiyasLgs: topla(LGS_HATLARI, false, kiyas, "sonrasi"),
    };
  }, [records, year, viewMode, targetDay, targetMonth, bugun]);

  /* ---------------------------------------------------------------
     Finans: seçili dönemin gerçekleşen ciro ve gideri
     --------------------------------------------------------------- */
  const finansDonemi = egitimYili(year);
  const [finans, setFinans] = useState<FinansOzetleri | null>(null);

  useEffect(() => {
    let iptal = false;
    finansOzetleri(finansDonemi).then((o) => { if (!iptal) setFinans(o); });
    return () => { iptal = true; };
  }, [finansDonemi]);

  const finansHazir = finans?.donem === finansDonemi;

  /* ---------------------------------------------------------------
     Kayıtlı varsayımlar
     --------------------------------------------------------------- */
  const [yuklenen, setYuklenen] = useState<{ donem: number; veri: Record<string, any> | null } | null>(null);
  const [artis, setArtis] = useState<Artislar>(VARSAYILAN_ARTIS);
  const [karHedefi, setKarHedefi] = useState<Hedefler>(KAR_HEDEFI);
  const [durum, setDurum] = useState<{ metin: string; hata?: boolean } | null>(null);

  // Hangi dönemin varsayımı elimizde olduğunu birlikte tutuyoruz: geç gelen
  // bir okuma, o sırada seçilmiş başka bir dönemin kutularını doldurmasın.
  const varsayimHazir = yuklenen?.donem === year;

  // Kullanıcının ekranda duran girdisi; dönem değişince temizlenir.
  const elDegerleriRef = useRef<Varsayimlar | null>(null);
  // İlk yüklemede kaydetmeye kalkmamak için.
  const kirliRef = useRef(false);

  useEffect(() => {
    let iptal = false;
    elDegerleriRef.current = null;
    kirliRef.current = false;
    getDoc(doc(db, KOLEKSIYON, String(year)))
      .then((anlik) => {
        if (iptal) return;
        const d = anlik.exists() ? (anlik.data() as Record<string, any>) : null;
        setYuklenen({ donem: year, veri: d });
        setArtis({
          y_ciro: typeof d?.artis_y_ciro === "number" ? d.artis_y_ciro : ENFLASYON,
          y_gider: typeof d?.artis_y_gider === "number" ? d.artis_y_gider : ENFLASYON,
          l_ciro: typeof d?.artis_l_ciro === "number" ? d.artis_l_ciro : ENFLASYON,
          l_gider: typeof d?.artis_l_gider === "number" ? d.artis_l_gider : ENFLASYON,
        });
        // Eski kayıtlarda tek bir karHedefi vardı; o da geçerli sayılır.
        const eski = typeof d?.karHedefi === "number" ? d.karHedefi : null;
        setKarHedefi({
          y: typeof d?.karHedefi_y === "number" ? d.karHedefi_y : (eski ?? KAR_HEDEFI.y),
          l: typeof d?.karHedefi_l === "number" ? d.karHedefi_l : (eski ?? KAR_HEDEFI.l),
        });
      })
      .catch(() => {
        if (!iptal) setYuklenen({ donem: year, veri: null });
      });
    return () => { iptal = true; };
  }, [year]);

  const varsayimJson = useMemo(() => JSON.stringify(yuklenen?.veri ?? null), [yuklenen]);

  /* ---------------------------------------------------------------
     Projeksiyon: Finans rakamı × (1 + % artış)
     --------------------------------------------------------------- */
  const projeksiyon = useMemo(() => {
    const hat = (o: { ciro: number; gider: number; doluAy: number } | undefined, ciroArtis: number, giderArtis: number, yedekGider: number) => {
      const { gider, hamGider, veriVar } = giderProjeksiyonu(o, giderArtis, yedekGider);
      const hamCiro = o?.ciro ?? 0;
      const ciro = Math.round(hamCiro * (1 + ciroArtis / 100));
      return { veriVar, hamCiro, hamGider, ciro, gider, kar: ciro - gider, hamKar: hamCiro - hamGider };
    };
    return {
      yks: hat(finans?.yks, artis.y_ciro, artis.y_gider, YKS_GIDER),
      lgs: hat(finans?.lgs, artis.l_ciro, artis.l_gider, LGS_GIDER),
    };
  }, [finans, artis]);

  /* ---------------------------------------------------------------
     Ekranı besle
     --------------------------------------------------------------- */
  const veriJson = useMemo(
    () => JSON.stringify({ ...veri, karHedefi, gy: projeksiyon.yks.gider, gl: projeksiyon.lgs.gider }),
    [veri, karHedefi, projeksiyon],
  );

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [yuklendi, setYuklendi] = useState(false);
  const [yukseklik, setYukseklik] = useState(1500);

  useEffect(() => {
    if (!yuklendi || !varsayimHazir || !finansHazir) return;

    const pencere = iframeRef.current?.contentWindow as
      | (Window & { veriyiYukle?: (v: unknown) => void; hesapla?: () => void })
      | null
      | undefined;
    const belge = iframeRef.current?.contentDocument;
    if (typeof pencere?.veriyiYukle !== "function" || !belge) return;

    const v = JSON.parse(veriJson) as typeof veri & { karHedefi: Hedefler; gy: number; gl: number };

    pencere.veriyiYukle({
      tarih: v.tarih,
      yks: { ...v.yks, gider: v.gy },
      lgs: { ...v.lgs, gider: v.gl },
      hedef: v.karHedefi,
    });

    panelBasligi(belge, "y", v.karHedefi.y);
    panelBasligi(belge, "l", v.karHedefi.l);

    ekKaynaklariKur(belge, "y");
    ekKaynaklariKur(belge, "l");

    ortalamaSatiri(belge, "y", v.yks.ogr, v.yks.ciro);
    ortalamaSatiri(belge, "l", v.lgs.ogr, v.lgs.ciro);

    const kiyasGoster = viewMode === "today";
    kiyasSatiri(belge, "y", v.kiyasYil, v.kiyasYks.ogr, v.kiyasYks.ciro, kiyasGoster);
    kiyasSatiri(belge, "l", v.kiyasYil, v.kiyasLgs.ogr, v.kiyasLgs.ciro, kiyasGoster);

    const kaynak = (p: typeof projeksiyon.yks, oran: number) =>
      p.veriVar
        ? `Finans ${finansDonemi}: ${TLS(p.hamGider)} · %${String(oran).replace(".", ",")} artış`
        : `Finans'ta ${finansDonemi} gideri yok — varsayılan kullanıldı`;
    giderKaynagi(belge, "y", kaynak(projeksiyon.yks, artis.y_gider));
    giderKaynagi(belge, "l", kaynak(projeksiyon.lgs, artis.l_gider));

    finansHedefi(belge, "y", projeksiyon.yks.ciro, v.yks.ciro, kiyasGoster);
    finansHedefi(belge, "l", projeksiyon.lgs.ciro, v.lgs.ciro, kiyasGoster);

    /* Kutulara ne yazılacağı: kullanıcının o an ekranda duran (henüz
       kaydedilmemiş) girdisi varsa o, yoksa döneme kayıtlı varsayım,
       o da yoksa ekranın kendi varsayılanları. */
    const kayitli = JSON.parse(varsayimJson) as Record<string, any> | null;
    const hedef: Varsayimlar = elDegerleriRef.current ?? { ...VARSAYILAN, ...(kayitli ?? {}) };

    (["y", "l"] as const).forEach((on) => {
      ALANLAR[on].forEach((alan) => {
        const deger = hedef[`${on}_${alan}`];
        if (typeof deger !== "number") return;
        const kutu = belge.getElementById(`${on}_${alan}`) as HTMLInputElement | null;
        if (kutu) kutu.value = TL(deger);
      });
    });
    pencere.hesapla?.();
  }, [yuklendi, varsayimHazir, finansHazir, veriJson, varsayimJson, viewMode, projeksiyon, artis, finansDonemi]);

  /* ---------------------------------------------------------------
     Kaydetme
     --------------------------------------------------------------- */
  const kaydet = useCallback(() => {
    const belge = iframeRef.current?.contentDocument;
    const gonderi: Record<string, unknown> = {
      ...(belge ? kutulariOku(belge) : {}),
      artis_y_ciro: artis.y_ciro, artis_y_gider: artis.y_gider,
      artis_l_ciro: artis.l_ciro, artis_l_gider: artis.l_gider,
      karHedefi_y: karHedefi.y, karHedefi_l: karHedefi.l,
      donem: year,
      guncelleyen: user?.displayName || user?.email || "",
      guncellendi: serverTimestamp(),
    };

    setDurum({ metin: "Kaydediliyor…" });
    setDoc(doc(db, KOLEKSIYON, String(year)), gonderi, { merge: true })
      .then(() => setDurum({ metin: "Varsayımlar kaydedildi" }))
      .catch(() => setDurum({ metin: "Kaydedilemedi — bağlantıyı kontrol edin", hata: true }));
  }, [user, year, artis, karHedefi]);

  // Ekrandaki kutular değiştikçe kaydet.
  useEffect(() => {
    if (!yuklendi) return;
    const belge = iframeRef.current?.contentDocument;
    if (!belge) return;

    let zamanlayici = 0;
    const dinle = (olay: Event) => {
      // Gider kutusu türetiliyor; elle değişirse de kaydedilmez.
      const kimlik = (olay.target as HTMLElement)?.id || "";
      if (kimlik.endsWith("_gider")) return;

      elDegerleriRef.current = kutulariOku(belge);
      kirliRef.current = true;

      // Ek kaynak veya ortalama değişince Finans hedefi satırı da yenilenmeli.
      const g = viewMode === "today";
      finansHedefi(belge, "y", projeksiyon.yks.ciro, veri.yks.ciro, g);
      finansHedefi(belge, "l", projeksiyon.lgs.ciro, veri.lgs.ciro, g);
      window.clearTimeout(zamanlayici);
      zamanlayici = window.setTimeout(kaydet, 900);
    };

    belge.addEventListener("input", dinle);
    return () => {
      window.clearTimeout(zamanlayici);
      belge.removeEventListener("input", dinle);
    };
  }, [yuklendi, kaydet, projeksiyon, veri, viewMode]);

  // % artış ve kâr hedefi değişince kaydet.
  useEffect(() => {
    if (!kirliRef.current) return;
    const zamanlayici = window.setTimeout(kaydet, 900);
    return () => window.clearTimeout(zamanlayici);
  }, [artis, karHedefi, kaydet]);

  // Alt kısım kırpılmasın: iframe kendi içeriği kadar uzar.
  useEffect(() => {
    if (!yuklendi) return;
    const govde = iframeRef.current?.contentDocument?.body;
    if (!govde) return;
    const olc = () => setYukseklik(govde.scrollHeight + 32);
    olc();
    const gozlemci = new ResizeObserver(olc);
    gozlemci.observe(govde);
    return () => gozlemci.disconnect();
  }, [yuklendi]);

  const artisDegistir = (anahtar: keyof Artislar) => (deger: number) => {
    kirliRef.current = true;
    setArtis((o) => ({ ...o, [anahtar]: deger }));
  };

  return (
    <div className="page">
      <div
        style={{
          display: "flex", gap: "var(--sp-3)", marginBottom: "var(--sp-4)",
          alignItems: "center", flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "var(--sp-3)", flex: 1, maxWidth: 520 }}>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ flex: 1 }}>
            {donemler.map((d) => (
              <option key={d} value={d}>{d} Dönemi</option>
            ))}
          </select>
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value as "today" | "all")} style={{ flex: 1 }}>
            <option value="today">
              Bugün ({targetDay} {new Intl.DateTimeFormat("tr-TR", { month: "short" }).format(bugun)})
            </option>
            <option value="all">Tüm Yıl</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          <span className="caption">Kâr hedefi</span>
          {(["y", "l"] as const).map((on) => (
            <label key={on} style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
              <span className="caption">{on === "y" ? "YKS" : "LGS"}</span>
              <SayiGirdisi
                deger={karHedefi[on]}
                degistir={(v) => { kirliRef.current = true; setKarHedefi((o) => ({ ...o, [on]: v })); }}
                ondalikli min={1} max={99}
                aria-label={`${on === "y" ? "YKS" : "LGS"} kâr hedefi yüzdesi`}
                style={{ width: 74, textAlign: "right" }}
              />
              <span className="caption">%</span>
            </label>
          ))}
        </div>

        {durum && (
          <div className="caption" style={{ color: durum.hata ? "var(--danger)" : "var(--text-3)" }}>
            {durum.metin}
          </div>
        )}
      </div>

      <FinansProjeksiyonu
        donem={finansDonemi}
        hazir={finansHazir}
        projeksiyon={projeksiyon}
        artis={artis}
        artisDegistir={artisDegistir}
      />

      <iframe
        ref={iframeRef}
        src="/kar-hesabi.html"
        title="Kâr Hesabı"
        onLoad={() => setYuklendi(true)}
        style={{
          width: "100%", height: yukseklik,
          border: "1px solid var(--line)", borderRadius: "var(--r-md)",
          background: "#f4f5f7", display: "block",
        }}
      />
    </div>
  );
}

/* =====================================================================
   FİNANS PROJEKSİYONU
   Finans'ın gerçekleşen ciro ve gideri, % artışla önümüzdeki döneme
   taşınmış hâliyle yan yana. Gider sütunu aşağıdaki hesabı da besler.
   ===================================================================== */
interface Hat {
  veriVar: boolean; hamCiro: number; hamGider: number;
  ciro: number; gider: number; kar: number; hamKar: number;
}

function FinansProjeksiyonu({
  donem, hazir, projeksiyon, artis, artisDegistir,
}: {
  donem: string;
  hazir: boolean;
  projeksiyon: { yks: Hat; lgs: Hat };
  artis: Artislar;
  artisDegistir: (anahtar: keyof Artislar) => (deger: number) => void;
}) {
  const sonraki = `${parseInt(donem.split("-")[0]) + 1}-${parseInt(donem.split("-")[1]) + 1}`;

  const marj = (kar: number, ciro: number) => (ciro > 0 ? (100 * kar) / ciro : 0);

  const satirlar: { ad: string; hat: Hat; ciroAnahtar: keyof Artislar; giderAnahtar: keyof Artislar }[] = [
    { ad: "YKS", hat: projeksiyon.yks, ciroAnahtar: "y_ciro", giderAnahtar: "y_gider" },
    { ad: "LGS", hat: projeksiyon.lgs, ciroAnahtar: "l_ciro", giderAnahtar: "l_gider" },
  ];

  // Bölüm varsayılan olarak kapalı: asıl iş aşağıdaki hesapta, bu bir
  // dayanak. Başlığa tıklayınca açılır.
  const [acik, setAcik] = useState(false);

  return (
    <div
      className="card"
      style={{ padding: "var(--sp-4) var(--sp-5)", marginBottom: "var(--sp-4)", overflowX: acik ? "auto" : "visible" }}
    >
      <button
        type="button"
        onClick={() => setAcik((o) => !o)}
        aria-expanded={acik}
        className="press"
        style={{
          display: "flex", alignItems: "center", gap: "var(--sp-2)",
          width: "100%", background: "transparent", border: "none", padding: 0,
          cursor: "pointer", textAlign: "left", color: "inherit",
        }}
      >
        <ChevronDown
          size={16} aria-hidden
          style={{
            color: "var(--text-2)", flexShrink: 0,
            transform: acik ? "none" : "rotate(-90deg)",
            transition: "transform var(--sure-hizli, 160ms) ease",
          }}
        />
        <span className="label">FİNANS PROJEKSİYONU · {donem} → {sonraki}</span>
        {!acik && hazir && (
          <span className="caption" style={{ marginLeft: "auto" }}>
            gider YKS {TLS(projeksiyon.yks.gider)} · LGS {TLS(projeksiyon.lgs.gider)}
          </span>
        )}
      </button>

      {!acik ? null : !hazir ? (
        <div className="caption" style={{ marginTop: "var(--sp-3)" }}>Finans verisi okunuyor…</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem", minWidth: 560, marginTop: "var(--sp-3)" }}>
          <thead>
            <tr>
              <th style={bs}>Hat</th>
              <th style={bs}>Kalem</th>
              <th style={{ ...bs, textAlign: "right" }}>Finans ({donem})</th>
              <th style={{ ...bs, textAlign: "right" }}>% artış</th>
              <th style={{ ...bs, textAlign: "right" }}>Projeksiyon ({sonraki})</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map(({ ad, hat, ciroAnahtar, giderAnahtar }) => (
              <Fragment key={ad}>
                <tr>
                  <td style={{ ...hs, fontWeight: 700 }} rowSpan={3}>{ad}</td>
                  <td style={hs}>Ciro</td>
                  <td style={{ ...hs, textAlign: "right" }} className="num">{TLS(hat.hamCiro)}</td>
                  <td style={{ ...hs, textAlign: "right" }}>
                    <SayiGirdisi
                      deger={artis[ciroAnahtar]} degistir={artisDegistir(ciroAnahtar)}
                      ondalikli min={-99} max={999}
                      aria-label={`${ad} ciro artış yüzdesi`}
                      style={{ width: 84, textAlign: "right" }}
                    />
                  </td>
                  <td style={{ ...hs, textAlign: "right", fontWeight: 600 }} className="num">{TLS(hat.ciro)}</td>
                </tr>
                <tr>
                  <td style={hs}>Gider</td>
                  <td style={{ ...hs, textAlign: "right" }} className="num">
                    {hat.veriVar ? TLS(hat.hamGider) : "—"}
                  </td>
                  <td style={{ ...hs, textAlign: "right" }}>
                    <SayiGirdisi
                      deger={artis[giderAnahtar]} degistir={artisDegistir(giderAnahtar)}
                      ondalikli min={-99} max={999}
                      aria-label={`${ad} gider artış yüzdesi`}
                      style={{ width: 84, textAlign: "right" }}
                    />
                  </td>
                  <td style={{ ...hs, textAlign: "right", fontWeight: 600 }} className="num">{TLS(hat.gider)}</td>
                </tr>
                <tr>
                  <td style={{ ...hs, fontWeight: 700 }}>Kâr</td>
                  <td style={{ ...hs, textAlign: "right", color: hat.hamKar >= 0 ? "var(--success)" : "var(--danger)" }} className="num">
                    {TLS(hat.hamKar)}
                    <span className="caption" style={{ display: "block" }}>
                      %{marj(hat.hamKar, hat.hamCiro).toFixed(1)}
                    </span>
                  </td>
                  <td style={hs} />
                  <td style={{ ...hs, textAlign: "right", fontWeight: 700, color: hat.kar >= 0 ? "var(--success)" : "var(--danger)" }} className="num">
                    {TLS(hat.kar)}
                    <span className="caption" style={{ display: "block" }}>
                      %{marj(hat.kar, hat.ciro).toFixed(1)}
                    </span>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      )}

      {acik && (
      <div className="caption" style={{ marginTop: "var(--sp-3)" }}>
        Ciro ve gider Finans modülünden gelir; % artış varsayılanı TÜİK Temmuz 2026 yıllık
        TÜFE'sidir (%31,75). Gider projeksiyonu aşağıdaki hesabın gider kutusunu, ciro
        projeksiyonu da "bu saatten sonra" için gereken öğrenci hedefini besler.
      </div>
      )}
    </div>
  );
}

const bs: React.CSSProperties = {
  textAlign: "left", padding: "var(--sp-2)", borderBottom: "1px solid var(--line-strong)",
  fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em",
  color: "var(--text-3)", fontWeight: 600, whiteSpace: "nowrap",
};

const hs: React.CSSProperties = {
  padding: "var(--sp-2)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap",
};
