import { useMemo } from "react";
import { useAuth } from "../../store/AuthContext";
import { useRecords, type Kayit } from "../../hooks/useRecords";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { aktifDonem, kiyasDonem, tarihinYili } from "../../constants/donem";
import { branchIdToKurumId } from "../../constants/kurumYetki";
import {
  kursHedefleri, HAT_OKULLARI,
  type KursHatti, type KursHedefi,
} from "../../constants/kursHedefleri";

/* =====================================================================
   KURS HEDEF TAKİBİ

   Kurucular ve kurs müdürleri için ayrı bir ekran. Hedefler Hedefler
   sayfasından değil kursHedefleri.ts'ten gelir; buradan değiştirilemez.

   Uyarı neye göre veriliyor:
     Ham yüzde uyarı DEĞİLDİR — Mart'ta %40 iyidir, Eylül'de kötüdür.
     Bunun yerine geçen dönemin AYNI TARİHİNDEKİ payı alınır ("geçen yıl
     bugün, dönemin %62'si yazılmıştı") ve bu dönemin rakamı o paya
     bölünerek dönem sonu tahmini bulunur. Mevsimsellik böyle hesaba
     katılır; takvim yılına orantılı bir "tempo" yanıltıcı olurdu.

     Geçen dönem verisi yoksa tahmin yapılmaz, ekran bunu açıkça söyler.
   ===================================================================== */

const sadelestir = (s: unknown): string =>
  String(s ?? "").toLocaleLowerCase("tr-TR").trim()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");

const TL = (n: number) => `${Math.round(n).toLocaleString("tr-TR")} ₺`;
const MN = (n: number) =>
  `${(n / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} Mn ₺`;
const YZ = (n: number) => `%${Math.round(n * 100)}`;

/** "GG.AA.YYYY" → yılın kaçıncı gününe denk geldiği kabaca (ay*100+gün). */
function ayGun(tarih: string): number | null {
  const p = String(tarih).split(".");
  if (p.length < 3) return null;
  const g = Number(p[0]); const a = Number(p[1]);
  if (!Number.isFinite(g) || !Number.isFinite(a)) return null;
  return a * 100 + g;
}

type Durum = "ustunde" | "yakin" | "risk" | "tehlike" | "bilinmiyor";

const DURUM_BILGI: Record<Durum, { etiket: string; renk: string; simge: string }> = {
  ustunde:    { etiket: "HEDEFİN ÜZERİNDE", renk: "var(--success)", simge: "▲" },
  yakin:      { etiket: "HEDEFE YAKIN",     renk: "var(--accent)",  simge: "◆" },
  risk:       { etiket: "RİSK ALTINDA",     renk: "var(--warning)", simge: "!" },
  tehlike:    { etiket: "HEDEF TEHLİKEDE",  renk: "var(--danger)",  simge: "!!" },
  bilinmiyor: { etiket: "TAHMİN YAPILAMADI", renk: "var(--text-3)", simge: "?" },
};

interface HatOzeti {
  anahtar: KursHatti;
  hedef: KursHedefi;
  ogrenci: number;
  ciro: number;
  ortalama: number;
  hedefOrtalama: number;
  ogrenciOran: number;
  ciroOran: number;
  /** Geçen dönemin bugüne kadarki payı — tahminin dayanağı */
  mevsimPayiOgrenci: number | null;
  mevsimPayiCiro: number | null;
  tahminOgrenci: number | null;
  tahminCiro: number | null;
  durum: Durum;
  /** Hedefi tutturmak için kalan kayıtların olması gereken ortalaması */
  gerekenKalanOrt: number | null;
  kalanOgrenci: number;
  kalanCiro: number;
}

function hattiOzetle(anahtar: KursHatti, hedef: KursHedefi, kayitlar: Kayit[]): HatOzeti {
  const donem = aktifDonem();
  const gecen = kiyasDonem(donem);
  const bugun = new Date();
  const bugunAyGun = (bugun.getMonth() + 1) * 100 + bugun.getDate();

  const okullar = HAT_OKULLARI[anahtar];
  const hattinKayitlari = kayitlar.filter((k) => okullar.includes(sadelestir(k.Okul)));

  const buDonem = hattinKayitlari.filter((k) => tarihinYili(k.SözleşmeTarihi) === donem);
  const gecenTum = hattinKayitlari.filter((k) => tarihinYili(k.SözleşmeTarihi) === gecen);
  const gecenBugune = gecenTum.filter((k) => {
    const ag = ayGun(k.SözleşmeTarihi);
    return ag !== null && ag <= bugunAyGun;
  });

  const topla = (liste: Kayit[]) => liste.reduce((t, k) => t + k.SonTutar, 0);

  const ogrenci = buDonem.length;
  const ciro = topla(buDonem);

  const gecenTumCiro = topla(gecenTum);
  const mevsimPayiOgrenci = gecenTum.length > 0 ? gecenBugune.length / gecenTum.length : null;
  const mevsimPayiCiro = gecenTumCiro > 0 ? topla(gecenBugune) / gecenTumCiro : null;

  const tahminOgrenci = mevsimPayiOgrenci && mevsimPayiOgrenci > 0 ? ogrenci / mevsimPayiOgrenci : null;
  const tahminCiro = mevsimPayiCiro && mevsimPayiCiro > 0 ? ciro / mevsimPayiCiro : null;

  let durum: Durum = "bilinmiyor";
  if (tahminOgrenci !== null && tahminCiro !== null) {
    const oran = Math.min(tahminOgrenci / hedef.ogrenci, tahminCiro / hedef.ciro);
    durum = oran >= 1 ? "ustunde" : oran >= 0.9 ? "yakin" : oran >= 0.75 ? "risk" : "tehlike";
  }

  const kalanOgrenci = Math.max(0, hedef.ogrenci - ogrenci);
  const kalanCiro = Math.max(0, hedef.ciro - ciro);

  return {
    anahtar, hedef, ogrenci, ciro,
    ortalama: ogrenci > 0 ? ciro / ogrenci : 0,
    hedefOrtalama: hedef.ciro / hedef.ogrenci,
    ogrenciOran: ogrenci / hedef.ogrenci,
    ciroOran: ciro / hedef.ciro,
    mevsimPayiOgrenci, mevsimPayiCiro,
    tahminOgrenci, tahminCiro,
    durum,
    gerekenKalanOrt: kalanOgrenci > 0 ? kalanCiro / kalanOgrenci : null,
    kalanOgrenci, kalanCiro,
  };
}

export default function KursHedefleriPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // Tek veri kaynagi: JSON/Firestore birlestirmesi ve iptal suzgeci
  // useRecords icinde yapiliyor. Iptal edilen kayitlar buraya gelmez.
  const { records, loading } = useRecords();

  const donem = aktifDonem();
  const hedefler = kursHedefleri(donem);

  const kurucu = user?.role?.trim().toLowerCase() === "admin" || user?.email === "ugur@asaf.com";

  /** Müdür yalnızca kendi hattını görür; kurucu ikisini birden. */
  const gorunenHatlar = useMemo<KursHatti[]>(() => {
    if (kurucu) return ["yks", "lgs"];
    const kurum = branchIdToKurumId(user?.branchId);
    if (kurum === "mefkure_yks") return ["yks"];
    if (kurum === "mefkure_lgs") return ["lgs"];
    return [];
  }, [kurucu, user?.branchId]);

  const ozetler = useMemo(() => {
    if (!hedefler) return [];
    return gorunenHatlar.map((h) => hattiOzetle(h, hedefler[h], records));
  }, [hedefler, gorunenHatlar, records]);

  if (!hedefler) {
    return (
      <div className="page rise" style={{ maxWidth: 1100 }}>
        <Baslik donem={donem} />
        <div style={bosKutu}>
          <strong>{donem} dönemi</strong> için kurs hedefi tanımlı değil. Hedefler
          dönem bazında tanımlanır; yeni dönemin rakamları girilene kadar takip
          ekranı çalışmaz.
        </div>
      </div>
    );
  }

  if (gorunenHatlar.length === 0) {
    return (
      <div className="page rise" style={{ maxWidth: 1100 }}>
        <Baslik donem={donem} />
        <div style={bosKutu}>Bu ekran kurucular ve kurs müdürleri içindir.</div>
      </div>
    );
  }

  return (
    <div className="page rise" style={{ maxWidth: 1100 }}>
      <Baslik donem={donem} />

      {loading && (
        <div style={{ ...bosKutu, marginBottom: "var(--sp-4)" }}>Kayıtlar yükleniyor…</div>
      )}

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

      {kurucu && ozetler.length === 2 && <ToplamSerit ozetler={ozetler} />}

      <p className="caption" style={{ marginTop: "var(--sp-5)", maxWidth: 640 }}>
        Dönem sonu tahmini, geçen dönemin aynı tarihindeki payına göre hesaplanır;
        takvime orantılı bir tempo yerine kayıt mevsimini esas alır. İptal edilen
        kayıtlar hiçbir rakama girmez.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- başlık */

function Baslik({ donem }: { donem: number }) {
  return (
    <header style={{ marginBottom: "var(--sp-6)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: "var(--t-display-size)" }}>Kurs Hedefleri</h1>
        <span style={donemRozeti}>{donem} DÖNEMİ</span>
      </div>
      <p style={{ marginTop: "var(--sp-2)", marginBottom: 0, color: "var(--text-2)" }}>
        Dönem sonu hedefleri ve bu tempoyla nereye varıldığı.
      </p>
    </header>
  );
}

/* ------------------------------------------------------------- hat kartı */

function HatKarti({ ozet, gecikme, isMobile }: { ozet: HatOzeti; gecikme: number; isMobile: boolean }) {
  const d = DURUM_BILGI[ozet.durum];
  const renk = ozet.hedef.renk;
  const ortAcik = ozet.ogrenci > 0 && ozet.ortalama < ozet.hedefOrtalama;

  return (
    <section
      className={`card rise rise-${gecikme + 1}`}
      style={{
        padding: 0,
        overflow: "hidden",
        borderColor: `color-mix(in srgb, ${renk} 26%, var(--line))`,
      }}
    >
      {/* Üst şerit: hattın rengi kartı sahiplenir */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${renk}, transparent)` }} />

      <div style={{ padding: "var(--sp-5)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--sp-3)" }}>
          <div>
            <h2 style={{ margin: 0, letterSpacing: "var(--t-title-ls)" }}>{ozet.hedef.ad}</h2>
            <div className="caption" style={{ marginTop: 2 }}>{ozet.hedef.hatlar.join(" + ")}</div>
          </div>
          <span
            style={{
              ...durumRozeti,
              color: d.renk,
              borderColor: `color-mix(in srgb, ${d.renk} 40%, transparent)`,
              background: `color-mix(in srgb, ${d.renk} 12%, transparent)`,
            }}
          >
            {d.simge} {d.etiket}
          </span>
        </div>

        {/* Hedef satırı */}
        <div style={hedefSatiri}>
          Hedef · <strong className="num">{ozet.hedef.ogrenci.toLocaleString("tr-TR")}</strong> öğrenci
          {"  ·  "}
          <strong className="num">{MN(ozet.hedef.ciro)}</strong>
        </div>

        {/* İki halka */}
        <div style={{ display: "flex", gap: "var(--sp-5)", justifyContent: "center", margin: "var(--sp-5) 0" }}>
          <Halka
            oran={ozet.ogrenciOran}
            renk={renk}
            etiket="ÖĞRENCİ"
            deger={`${ozet.ogrenci.toLocaleString("tr-TR")} / ${ozet.hedef.ogrenci.toLocaleString("tr-TR")}`}
            boyut={isMobile ? 108 : 124}
          />
          <Halka
            oran={ozet.ciroOran}
            renk={renk}
            etiket="CİRO"
            deger={`${MN(ozet.ciro)} / ${MN(ozet.hedef.ciro)}`}
            boyut={isMobile ? 108 : 124}
          />
        </div>

        {/* Ortalama — hedefi tutturan asıl kaldıraç */}
        <Satir
          etiket="Kayıt başına ortalama"
          deger={ozet.ogrenci > 0 ? TL(ozet.ortalama) : "—"}
          altBilgi={`hedef ${TL(ozet.hedefOrtalama)}`}
          renk={ortAcik ? "var(--danger)" : ozet.ogrenci > 0 ? "var(--success)" : undefined}
          isaret={ortAcik ? "▼" : ozet.ogrenci > 0 ? "▲" : undefined}
        />

        {/* Dönem sonu tahmini */}
        {ozet.tahminOgrenci !== null && ozet.tahminCiro !== null ? (
          <Satir
            etiket="Bu tempoyla dönem sonu"
            deger={`${Math.round(ozet.tahminOgrenci).toLocaleString("tr-TR")} öğrenci · ${MN(ozet.tahminCiro)}`}
            altBilgi={
              ozet.mevsimPayiOgrenci !== null
                ? `geçen dönem bugüne kadar ${YZ(ozet.mevsimPayiOgrenci)} yazılmıştı`
                : undefined
            }
            renk={DURUM_BILGI[ozet.durum].renk}
          />
        ) : (
          <Satir
            etiket="Bu tempoyla dönem sonu"
            deger="Hesaplanamadı"
            altBilgi={`${kiyasDonem()} döneminde bu hatta kayıt yok`}
          />
        )}

        {/* Kalanın olması gereken ortalaması */}
        {ozet.gerekenKalanOrt !== null && (
          <Satir
            etiket="Hedefe kalan"
            deger={`${ozet.kalanOgrenci.toLocaleString("tr-TR")} öğrenci · ${MN(ozet.kalanCiro)}`}
            altBilgi={`kalan kayıtların ortalaması ${TL(ozet.gerekenKalanOrt)} olmalı`}
            renk={
              ozet.ogrenci > 0 && ozet.gerekenKalanOrt > ozet.ortalama * 1.1
                ? "var(--warning)"
                : undefined
            }
          />
        )}

        {/* Uyarı metni: sayının ne anlama geldiği */}
        <Uyari ozet={ozet} ortAcik={ortAcik} />
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- uyarı */

function Uyari({ ozet, ortAcik }: { ozet: HatOzeti; ortAcik: boolean }) {
  const mesajlar: string[] = [];

  if (ozet.durum === "tehlike" || ozet.durum === "risk") {
    const acik = ozet.tahminCiro !== null ? ozet.hedef.ciro - ozet.tahminCiro : 0;
    mesajlar.push(
      `Bu tempo sürerse dönem sonunda ciro hedefinin ${MN(Math.max(0, acik))} altında kalınır.`
    );
  }
  if (ortAcik) {
    mesajlar.push(
      `Ortalama tutar hedefin ${TL(ozet.hedefOrtalama - ozet.ortalama)} altında; ` +
      `öğrenci sayısı tutsa bile ciro tutmaz.`
    );
  }
  if (ozet.ogrenciOran - ozet.ciroOran > 0.05) {
    mesajlar.push(
      `Öğrenci ilerlemesi ${YZ(ozet.ogrenciOran)}, ciro ilerlemesi ${YZ(ozet.ciroOran)} — ` +
      `makas indirim tarafında açılıyor.`
    );
  }
  if (ozet.durum === "ustunde" && mesajlar.length === 0) {
    mesajlar.push("Her iki hedef de bu tempoyla tutuyor.");
  }

  if (mesajlar.length === 0) return null;

  const renk = DURUM_BILGI[ozet.durum].renk;

  return (
    <div
      role={ozet.durum === "tehlike" ? "alert" : undefined}
      style={{
        marginTop: "var(--sp-4)",
        padding: "var(--sp-3) var(--sp-4)",
        borderRadius: "var(--r-md)",
        background: `color-mix(in srgb, ${renk} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${renk} 32%, transparent)`,
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-2)",
      }}
    >
      {mesajlar.map((m, i) => (
        <div key={i} style={{ fontSize: "0.85rem", lineHeight: 1.45, color: "var(--text)" }}>
          {m}
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- halka */

function Halka({
  oran, renk, etiket, deger, boyut,
}: { oran: number; renk: string; etiket: string; deger: string; boyut: number }) {
  const kalinlik = Math.round(boyut * 0.085);
  const r = (boyut - kalinlik) / 2;
  const cevre = 2 * Math.PI * r;
  const dolu = Math.min(1, Math.max(0, oran));

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", width: boyut, height: boyut }}>
        <svg width={boyut} height={boyut} style={{ transform: "rotate(-90deg)" }} aria-hidden>
          <circle
            cx={boyut / 2} cy={boyut / 2} r={r}
            fill="none" strokeWidth={kalinlik}
            stroke="color-mix(in srgb, var(--line-strong) 55%, transparent)"
          />
          <circle
            cx={boyut / 2} cy={boyut / 2} r={r}
            fill="none" strokeWidth={kalinlik} strokeLinecap="round"
            stroke={renk}
            strokeDasharray={cevre}
            strokeDashoffset={cevre * (1 - dolu)}
            style={{ transition: "stroke-dashoffset var(--dur-med) var(--ease-out)" }}
          />
        </svg>
        <div style={halkaIci}>
          <div className="num" style={{ fontSize: boyut * 0.24, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {YZ(oran)}
          </div>
        </div>
      </div>
      <div className="label" style={{ marginTop: "var(--sp-2)" }}>{etiket}</div>
      <div className="caption num" style={{ marginTop: 1 }}>{deger}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- satır */

function Satir({
  etiket, deger, altBilgi, renk, isaret,
}: { etiket: string; deger: string; altBilgi?: string; renk?: string; isaret?: string }) {
  return (
    <div className="data-row" style={{ alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: "0.85rem", color: "var(--text-2)", fontWeight: 500 }}>{etiket}</div>
        {altBilgi && <div className="caption" style={{ marginTop: 2 }}>{altBilgi}</div>}
      </div>
      <div
        className="num"
        style={{
          fontWeight: 700, fontSize: "0.92rem", textAlign: "right",
          color: renk || "var(--text)", whiteSpace: "nowrap",
        }}
      >
        {isaret && <span style={{ marginRight: 4 }}>{isaret}</span>}
        {deger}
      </div>
    </div>
  );
}

/* ------------------------------------------------- kurucu toplam şeridi */

function ToplamSerit({ ozetler }: { ozetler: HatOzeti[] }) {
  const hedefOgr = ozetler.reduce((t, o) => t + o.hedef.ogrenci, 0);
  const hedefCiro = ozetler.reduce((t, o) => t + o.hedef.ciro, 0);
  const ogr = ozetler.reduce((t, o) => t + o.ogrenci, 0);
  const ciro = ozetler.reduce((t, o) => t + o.ciro, 0);
  const tahminCiro = ozetler.every((o) => o.tahminCiro !== null)
    ? ozetler.reduce((t, o) => t + (o.tahminCiro as number), 0)
    : null;

  return (
    <section className="card rise rise-3" style={{ marginTop: "var(--sp-5)" }}>
      <div className="label" style={{ marginBottom: "var(--sp-3)" }}>KURSLAR TOPLAMI</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-6)" }}>
        <Kutucuk
          etiket="Öğrenci"
          deger={`${ogr.toLocaleString("tr-TR")} / ${hedefOgr.toLocaleString("tr-TR")}`}
          alt={YZ(ogr / hedefOgr)}
        />
        <Kutucuk
          etiket="Ciro"
          deger={`${MN(ciro)} / ${MN(hedefCiro)}`}
          alt={YZ(ciro / hedefCiro)}
        />
        <Kutucuk
          etiket="Kayıt başına ortalama"
          deger={ogr > 0 ? TL(ciro / ogr) : "—"}
          alt={`hedef ${TL(hedefCiro / hedefOgr)}`}
        />
        <Kutucuk
          etiket="Dönem sonu ciro tahmini"
          deger={tahminCiro !== null ? MN(tahminCiro) : "—"}
          alt={tahminCiro !== null ? `hedefin ${YZ(tahminCiro / hedefCiro)}'i` : "hesaplanamadı"}
        />
      </div>
    </section>
  );
}

function Kutucuk({ etiket, deger, alt }: { etiket: string; deger: string; alt: string }) {
  return (
    <div>
      <div className="caption">{etiket}</div>
      <div className="num" style={{ fontSize: "1.15rem", fontWeight: 800, letterSpacing: "-0.015em", marginTop: 2 }}>
        {deger}
      </div>
      <div className="caption" style={{ marginTop: 1 }}>{alt}</div>
    </div>
  );
}

/* --------------------------------------------------------------- stiller */

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

const hedefSatiri: React.CSSProperties = {
  marginTop: "var(--sp-4)",
  padding: "var(--sp-2) var(--sp-3)",
  borderRadius: "var(--r-sm)",
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  fontSize: "0.85rem",
  color: "var(--text-2)",
};

const halkaIci: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
};

const bosKutu: React.CSSProperties = {
  background: "color-mix(in srgb, var(--warning) 10%, transparent)",
  border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)",
  borderRadius: "var(--r-md)",
  padding: "var(--sp-4)",
  color: "var(--text)",
  fontSize: "0.9rem",
};
