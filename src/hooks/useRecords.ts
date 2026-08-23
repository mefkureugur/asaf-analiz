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

     • Firestore'da hiç "excel" kaynaklı kayıt yoksa  -> JSON + Firestore
     • En az bir tane varsa (aktarım yapılmış demektir) -> yalnız Firestore

   Böylece aktarım öncesi ve sonrası sayılar hiç bozulmaz; aktarım
   tamamlandığı anda kaynak kendiliğinden değişir. Çift sayma olmaz.
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
  /** Aktarım yapılmış mı (Firestore'da excel kaynaklı kayıt var mı). */
  aktarimYapildi: boolean;
  /** Kaynak dağılımı — doğrulama ve aktarım ekranı için. */
  sayim: { json: number; excel: number; manual: number; iptal: number };
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
    const aktarimYapildi = firestoreKayitlari.some((r) => r.kaynak === "excel");

    // Aktarım yapıldıysa JSON devre dışı kalır — çift sayma olmaz.
    const jsonKayitlari: Kayit[] = aktarimYapildi
      ? []
      : (Array.isArray(asafRecordsRaw) ? asafRecordsRaw : []).map((r: any, i: number) =>
          normalize(r, `json:${i}`, "json")
        );

    const tumKayitlar = [...jsonKayitlari, ...firestoreKayitlari];
    const records = tumKayitlar.filter((r) => r.KayıtDurumu !== "İptal");

    return {
      records,
      tumKayitlar,
      loading,
      aktarimYapildi,
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
