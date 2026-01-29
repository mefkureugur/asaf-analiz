import * as XLSX from "xlsx";

// ASAF 6 Şube Yapısına Uygun Tip Tanımı
export interface ImportedRecord {
  studentName: string;
  classType: string;
  branch: string; // Dinamik şube yapısı için string olarak bıraktık
  contractDate: Date;
  amount: number;
}

/* ================================
   HELPERS (Normalizasyon)
================================ */

function normalizeBranch(v: string): string {
  const val = v.toLowerCase().trim();

  // Mefkure Grubu
  if (val.includes("vip")) return "Mefkure VİP";
  if (val.includes("lgs")) return "Mefkure LGS";
  if (val.includes("plus")) return "Mefkure PLUS";
  
  // Altınküre Grubu
  if (val.includes("ilköğretim") || val.includes("ilkogretim")) return "Altınküre İlköğretim";
  if (val.includes("lise")) return "Altınküre Lise";
  if (val.includes("teknokent")) return "Altınküre Teknokent";

  return v.trim() || "Bilinmeyen Şube";
}

function parseDate(v: any): Date | null {
  if (v instanceof Date) return v;

  if (typeof v === "number") {
    // Excel tarih kodunu (45231 gibi) JS tarihine çevirir
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(d.y, d.m - 1, d.d);
  }

  if (typeof v === "string") {
    // Farklı tarih formatlarını (GG.AA.YYYY veya YYYY-AA-GG) dener
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/* ================================
   MAIN IMPORT ENGINE
================================ */

export function importExcel(file: File): Promise<ImportedRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(sheet);

        const records: ImportedRecord[] = [];

        json.forEach((row, index) => {
          // Excel sütun başlıklarını yakalamak için esnek anahtarlar
          const studentName = row["Öğrenci Ad Soyad"] || row["AD SOYAD"] || row["Öğrenci"];
          const classType = row["Sınıf"] || row["Grup"];
          const branchRaw = row["Şube"] || row["Kurum"];
          const amount = Number(String(row["Son Tutar"] || row["Tutar"] || 0).replace(/[^\d]/g, ""));
          const date = parseDate(row["Sözleşme Tarihi"] || row["Tarih"]);

          // Kritik veri kontrolü
          if (!studentName || !date || isNaN(amount)) {
            console.warn(`⚠️ Satır ${index + 2} eksik veri nedeniyle atlandı:`, row);
            return;
          }

          records.push({
            studentName: String(studentName).trim().toUpperCase(),
            classType: String(classType || "").trim(),
            branch: normalizeBranch(String(branchRaw || "")),
            contractDate: date,
            amount,
          });
        });

        resolve(records);
      } catch (err) {
        reject(`Excel işleme hatası: ${err}`);
      }
    };

    reader.onerror = () => reject("Dosya okunamadı.");
    reader.readAsArrayBuffer(file);
  });
}