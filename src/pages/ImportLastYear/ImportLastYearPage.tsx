import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../../firebase';
import { collection, writeBatch, doc, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../../store/AuthContext';
import { Navigate } from 'react-router-dom';

export default function ImportLastYearPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (user?.role !== 'admin' && user?.email !== 'ugur@asaf.com') {
    return <Navigate to="/dashboard" />;
  }

  // 🗑️ 1. ADIM: MÜKERRER KAYITLARI SİLME (ÖNCE BURAYA BAS)
  const clearExcelRecords = async () => {
    if (!window.confirm("Excel ile yüklenen TÜM veriler silinecek ve veritabanı temizlenecek. Emin misiniz?")) return;
    
    setIsUploading(true);
    try {
      const q = query(collection(db, "records"), where("source", "==", "excel_import_2025"));
      const snap = await getDocs(q);
      
      const batches = [];
      let batch = writeBatch(db);
      let count = 0;

      for (const d of snap.docs) {
        batch.delete(d.ref);
        count++;
        if (count === 500) {
          batches.push(batch.commit());
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) batches.push(batch.commit());
      
      await Promise.all(batches);
      alert(`🗑️ ${snap.size} adet mükerrer kayıt temizlendi. Dashboard şimdi sıfırlanmış olmalı.`);
    } catch (e) {
      console.error(e);
      alert("Silme işlemi sırasında bir hata oluştu.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFile = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt: any) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      setData(json);
      setUploadProgress(0);
    };
    reader.readAsBinaryString(file);
  };

  const uploadToFirebase = async () => {
    if (data.length === 0) return alert("Dosya seçin!");
    setIsUploading(true);
    const batchSize = 500;
    
    try {
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = writeBatch(db);
        const currentBatch = data.slice(i, i + batchSize);

        currentBatch.forEach((row) => {
          // 🛡️ 2. ADIM: AKILLI ID SİSTEMİ
          // Öğrenci Adı + Okul + Sınıf bilgisinden benzersiz bir ID üretiyoruz.
          // Bu sayede aynı dosyayı 10 kere de yüklesen hep aynı kaydın üzerine yazar (Merge).
          const uniqueId = `${row["Öğrenci Ad Soyad"]}_${row["Okul"]}_${row["Sınıf"]}`
            .replace(/\s+/g, '_')
            .toLowerCase();
          
          const docRef = doc(db, "records", uniqueId);
          
          batch.set(docRef, {
            studentName: row["Öğrenci Ad Soyad"] || "İsimsiz",
            subeAd: row["Okul"] || "Tanımsız Şube",
            classType: String(row["Sınıf"] || "").replace(".0", ""),
            amount: Number(row["Son Tutar"] || 0),
            contractDate: typeof row["Sözleşme Tarihi"] === 'number' 
              ? new Date(Math.round((row["Sözleşme Tarihi"] - 25569) * 86400 * 1000))
              : new Date(),
            source: "excel_import_2025",
            status: row["Kayıt Durumu"] || "Aktif",
            createdAt: new Date()
          }, { merge: true }); // Var olanın üstüne yaz (Eksiltme/Tekilleştirme)
        });

        await batch.commit();
        setUploadProgress(Math.round(((i + currentBatch.length) / data.length) * 100));
      }
      alert(`✅ ${data.length} kayıt mermi gibi tekilleştirilerek yüklendi!`);
      setData([]);
    } catch (err) {
      alert("Hata oluştu.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ padding: '30px', color: 'white', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: '#38bdf8', margin: 0 }}>📥 Veri Aktarım & Temizlik</h2>
        <button 
          onClick={clearExcelRecords} 
          disabled={isUploading}
          style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
        >
          ❌ Mevcut Verileri Sıfırla
        </button>
      </div>
      
      <div style={cardStyle}>
        <input type="file" ref={fileInputRef} onChange={handleFile} accept=".xlsx, .xls" style={{ marginBottom: 20 }} />
        
        {data.length > 0 && (
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: '20px' }}>
            <p>📊 <strong>{data.length}</strong> Benzersiz Kayıt İşlenecek.</p>
            {isUploading && (
              <div style={progressContainer}>
                <div style={{ ...progressFill, width: `${uploadProgress}%` }} />
              </div>
            )}
            <button onClick={uploadToFirebase} disabled={isUploading} style={btnStyle}>
              {isUploading ? `İşleniyor %${uploadProgress}...` : "Verileri Tekilleştirerek Yükle"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle = { background: '#0f172a', padding: '25px', borderRadius: '16px', border: '1px solid #1e293b' };
const btnStyle = { background: '#38bdf8', color: '#020617', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, width: '100%' };
const progressContainer = { background: '#020617', height: '10px', borderRadius: '5px', marginBottom: '15px', overflow: 'hidden' };
const progressFill = { background: '#38bdf8', height: '100%', transition: '0.3s' };