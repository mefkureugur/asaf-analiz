import { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import type { ImportedRecord } from "../services/excelImport.service";

type DataContextType = {
  allRecords: ImportedRecord[];
  loading: boolean;
};

const DataContext = createContext<DataContextType | null>(null);

export const DataProvider = ({ children }: { children: React.ReactNode }) => {
  const [allRecords, setAllRecords] = useState<ImportedRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "records"), (snap) => {
      const rows: ImportedRecord[] = [];
      snap.forEach((doc) => rows.push(doc.data() as ImportedRecord));
      setAllRecords(rows);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <DataContext.Provider value={{ allRecords, loading }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
};
