import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext"; 
import type { ImportedRecord } from "../services/excelImport.service";

function sanitizeRecord(data: any): ImportedRecord {
  const branchRaw = String(data.branch || "").trim();
  let cleanBranch = branchRaw;
  if (branchRaw.toLowerCase() === "lgs") cleanBranch = "Mefkure LGS";
  if (branchRaw.toLowerCase() === "vip") cleanBranch = "Mefkure VİP";
  if (branchRaw.toLowerCase() === "plus") cleanBranch = "Mefkure PLUS";

  let cleanClass = String(data.classType || "").trim();
  if (cleanClass.length === 2 && cleanClass.startsWith("0")) {
    cleanClass = cleanClass.slice(1);
  }

  return {
    ...data,
    branch: cleanBranch,
    classType: cleanClass,
    studentName: String(data.studentName || "").trim().toUpperCase(),
    amount: Number(data.amount) || 0,
    contractDate: data.contractDate?.toDate ? data.contractDate.toDate() : new Date(data.contractDate)
  };
}

const DataContext = createContext<any>(null);

export const DataProvider = ({ children }: { children: React.ReactNode }) => {
  const [rawRecords, setRawRecords] = useState<ImportedRecord[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // Veritabanı dinleyicisi
    const q = query(collection(db, "records"), orderBy("contractDate", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map(doc => sanitizeRecord(doc.data()));
      setRawRecords(rows);
      setDbLoading(false);
    }, (err) => {
      console.error("Firestore Hatası:", err);
      setDbLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredRecords = useMemo(() => {
    // Eğer admin ise (Uğur) direkt tüm veriyi ver
    if (user?.role === 'admin') return rawRecords;
    
    // Eğer manager ise sadece kendi şubesini ver
    if (user?.role === 'manager' && user.branchId) {
      return rawRecords.filter(r => r.branch === user.branchId);
    }

    // Giriş yapılmadıysa veya yetki yoksa boş dön
    return [];
  }, [rawRecords, user]);

  return (
    <DataContext.Provider value={{ allRecords: filteredRecords, loading: authLoading || dbLoading }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData hatası!");
  return ctx;
};