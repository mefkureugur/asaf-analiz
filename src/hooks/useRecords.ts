import { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase";
import asafRecordsRaw from "../data/excel2json-1769487741734.json";

/* =====================================================================
   KAYIT VERİSİ — TEK KAYNAK

   Uygulamada iki veri kaynağı vardı:
     1) src/data/excel2json-*.json  — 1806 kayıtlık statik anlık görüntü
     2) Firestore "records"         — Günlük Giriş'ten elle eklenenler
   ve bu ikisi altı ayrı sayfada ayrı ayrı birleştiriliyordu.

   Burada tek yerde toplanıyor. Ayrıca JSON'dan Firestore'a geçişi
   KESİNTİSİZ yapan mantık burada:

     Aktarılan her kayıt, Firestore'da `kaynakAnahtar` alanıyla hangi JSON
     kaydından geldiğini taşır. JSON tarafında yalnızca O kayıt devre dışı
     kalır; geri kalanı okunmaya devam eder.

   Neden kayıt bazında:
     • Kısmi aktarım mümkün olsun diye. Örneğin yalnız 2026 aktarılırsa
       2025 kayıtları dosyadan okunmaya devam eder — geçen yıl / bu yıl
       karşılaştırması bozulmaz.
     • Aktarılan kayıt sonradan DÜZENLENSE bile (ad, tutar, tarih değişse)
       eşleşme `kaynakAnahtar` üzerinden kurulduğu için JSON'daki eski hâli
       geri gelmez.
     • İPTAL edilen kayıt da dosyadaki eşini bastırmaya devam eder; yoksa
       iptal ettiğin öğrenci dosyadan yeniden ortaya çıkardı.
   ===================================================================== */

export interface Kayit {
  id: string;
  studentName: string;
  Sınıf: string;
  Okul: string;
  SonTutar: number;
  SözleşmeTarihi: string;        // GG.AA.YYYY
  SözleşmeBitişTarihi?: string;
  KayıtDurumu: string;           // "Aktif" | "İptal"
  kaynak: "manual" | "excel" | "json";
  GittigiOkul?: string;
  iptalTarihi?: string;
  iptalEden?: string;
  iptalNotu?: string;
  /** Aktarılan kayıtlarda: geldiği JSON kaydının kimliği. */
  kaynakAnahtar?: string;
  [k: string]: any;
}

/** Her iki kaynaktan gelen kaydı tek şekle indirger. */
function normalize(r: any, id: string, kaynak: Kayit["kaynak"]): Kayit {
  return {
    ...r,
    id,
    kaynak,
    // İsim alanı iki kaynakta farklı adda geliyordu; burada birleşiyor.
    studentName: String(r.studentName || r.ÖğrenciAdSoyad || r["Ad Soyad"] || "").trim(),
    Okul: r.Okul || r.branch || r.subeAd || "Bilinmeyen",
    SonTutar: Number(r.SonTutar || r.amount || 0),
    Sınıf: String(r.Sınıf || r.classType || "").replace(".0", "").trim(),
    SözleşmeTarihi: String(r.SözleşmeTarihi || ""),
    SözleşmeBitişTarihi: r.SözleşmeBitişTarihi || "",
    // Durumu olmayan eski kayıtlar Aktif sayılır.
    KayıtDurumu: String(r.KayıtDurumu || "Aktif").trim(),
  };
}

export interface UseRecordsSonuc {
  /** İptal edilmemiş kayıtlar — sayım ve ciro burayı kullanmalı. */
  records: Kayit[];
  /** İptaller dahil hepsi — liste ekranları burayı kullanır. */
  tumKayitlar: Kayit[];
  loading: boolean;
  /** En az bir kayıt aktarılmış mı. */
  aktarimYapildi: boolean;
  /** Kaynak dağılımı — doğrulama ve aktarım ekranı için. */
  sayim: { json: number; excel: number; manual: number; iptal: number };
  /** Aktarılmış kayıtların kaynak anahtarları — aktarım ekranı kullanır. */
  aktarilanAnahtarlar: Set<string>;
}

export function useRecords(): UseRecordsSonuc {
  const [firestoreKayitlari, setFirestoreKayitlari] = useState<Kayit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "records")),
      (snap) => {
        setFirestoreKayitlari(
          snap.docs.map((d) => {
            const data = d.data() as any;
            const kaynak: Kayit["kaynak"] = data.source === "excel" ? "excel" : "manual";
            return normalize(data, d.id, kaynak);
          })
        );
        setLoading(false);
      },
      (err) => {
        console.warn("Firestore hatası:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return useMemo(() => {
    // Aktarılmış kayıtların kaynak anahtarları. İPTAL edilenler de dahil —
    // aksi hâlde iptal edilen kayıt dosyadan geri gelirdi.
    const aktarilanAnahtarlar = new Set<string>();
    firestoreKayitlari.forEach((r) => {
      if (r.kaynak === "excel" && r.kaynakAnahtar) aktarilanAnahtarlar.add(r.kaynakAnahtar);
    });

    const hamJson = Array.isArray(asafRecordsRaw) ? asafRecordsRaw : [];

    // Dosyadan yalnızca HENÜZ AKTARILMAMIŞ kayıtlar okunur.
    const jsonKayitlari: Kayit[] = hamJson
      .map((r: any, i: number) => ({ r, i, anahtar: kayitAnahtari(r) }))
      .filter(({ anahtar }) => !aktarilanAnahtarlar.has(anahtar))
      .map(({ r, i }) => normalize(r, `json:${i}`, "json"));

    const aktarimYapildi = aktarilanAnahtarlar.size > 0;

    const tumKayitlar = [...jsonKayitlari, ...firestoreKayitlari];
    const records = tumKayitlar.filter((r) => r.KayıtDurumu !== "İptal");

    return {
      records,
      tumKayitlar,
      loading,
      aktarimYapildi,
      aktarilanAnahtarlar,
      sayim: {
        json: jsonKayitlari.length,
        excel: firestoreKayitlari.filter((r) => r.kaynak === "excel").length,
        manual: firestoreKayitlari.filter((r) => r.kaynak === "manual").length,
        iptal: tumKayitlar.filter((r) => r.KayıtDurumu === "İptal").length,
      },
    };
  }, [firestoreKayitlari, loading]);
}

/** Aktarımda ve tekrar kontrolünde kullanılan kararlı kayıt kimliği. */
export function kayitAnahtari(r: { studentName?: string; ÖğrenciAdSoyad?: string; SözleşmeTarihi?: string; Okul?: string; SonTutar?: any }): string {
  const ad = String(r.studentName || r.ÖğrenciAdSoyad || "").trim().toLocaleUpperCase("tr-TR");
  const tarih = String(r.SözleşmeTarihi || "").trim();
  const okul = String(r.Okul || "").trim().toLocaleUpperCase("tr-TR");
  const tutar = Number(r.SonTutar || 0);
  return `${ad}|${tarih}|${okul}|${tutar}`;
}
