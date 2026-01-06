import * as XLSX from "xlsx";

export interface ImportedRecord {
  studentName: string;
  classType: string;
  branch: "Mefkure Plus" | "Mefkure Vip" | "Mefkure LGS";
  contractDate: Date;
  amount: number;
}

/* ================================
   HELPERS
================================ */

function normalizeBranch(v: string): ImportedRecord["branch"] {
  const val = v.toLowerCase();

  if (val.includes("vip")) return "Mefkure Vip";
  if (val.includes("lgs")) return "Mefkure LGS";
  return "Mefkure Plus";
}

function parseDate(v: any): Date | null {
  if (v instanceof Date) return v;

  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(d.y, d.m - 1, d.d);
  }

  if (typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/* ================================
   MAIN IMPORT
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
          const studentName = row["Öğrenci Ad Soyad"];
          const classType = row["Sınıf"];
          const branchRaw = row["Şube"];
          const amount = Number(row["Son Tutar"]);
          const date = parseDate(row["Sözleşme Tarihi"]);

          if (!studentName || !date || isNaN(amount)) {
            console.warn("Atlanan satır:", index + 2, row);
            return;
          }

          records.push({
            studentName: String(studentName).trim(),
            classType: String(classType || "").trim(),
            branch: normalizeBranch(String(branchRaw || "")),
            contractDate: date,
            amount,
          });
        });

        resolve(records);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject("Excel okunamadı");
    reader.readAsArrayBuffer(file);
  });
}
