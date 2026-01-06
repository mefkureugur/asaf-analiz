import { useState } from "react";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { importExcel } from "../../services/excelImport.service";
import type { ImportedRecord } from "../../services/excelImport.service";

export default function ImportLastYearPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus("Excel okunuyor...");

    try {
      // 🔒 1) Daha önce import yapılmış mı?
      const lockRef = doc(db, "meta", "excel2025");
      const lockSnap = await getDoc(lockRef);

      if (lockSnap.exists()) {
        alert("Bu Excel daha önce Firestore'a aktarılmış.");
        setLoading(false);
        return;
      }

      // 📥 2) Excel parse
      const rows: ImportedRecord[] = await importExcel(file);
      setStatus(`${rows.length} kayıt Firestore'a yazılıyor...`);

      // 🔥 3) Firestore write
      for (const row of rows) {
        await addDoc(collection(db, "records"), {
          studentName: row.studentName?.toString().trim() || "",
          classType: row.classType?.toString().trim() || "",
          branch: row.branch?.toString().trim() || "",
          amount: Number(row.amount) || 0,
          contractDate: row.contractDate
            ? new Date(row.contractDate)
            : null,
          source: "import",
          createdAt: serverTimestamp(),
        });
      }

      // 🔐 4) Import kilidi
      await setDoc(lockRef, {
        importedAt: serverTimestamp(),
        count: rows.length,
      });

      // 🚀 5) BİTTİ
      // Context zaten Firestore'u dinliyor → otomatik yansır
      setStatus("✅ Excel başarıyla Firestore'a aktarıldı ve sisteme yansıdı.");
    } catch (err) {
      console.error("❌ IMPORT HATASI:", err);
      alert("Excel import sırasında hata oluştu. Console'a bak.");
      setStatus("❌ Hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, color: "white", maxWidth: 520 }}>
      <h2>📥 Geçen Yıl Excel Yükle</h2>
      <p style={{ opacity: 0.7 }}>
        2025 verileri tek seferlik Firestore'a aktarılır
      </p>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        disabled={loading}
        style={{ marginTop: 16 }}
      />

      {status && (
        <p style={{ marginTop: 16, opacity: 0.85 }}>
          {status}
        </p>
      )}
    </div>
  );
}
