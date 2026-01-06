import { useState } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";

const PROGRAMS = ["6", "7", "8", "11", "12", "Mezun", "Mood"];

export default function DailyEntryPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [studentName, setStudentName] = useState("");
  const [classType, setClassType] = useState("");
  const [branch, setBranch] = useState<
    "Mefkure Plus" | "Mefkure Vip" | "Mefkure LGS" | ""
  >("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentName || !classType || !branch || !amount) {
      alert("Lütfen tüm alanları doldurun.");
      return;
    }

    try {
      setSaving(true);

      await addDoc(collection(db, "records"), {
        studentName: studentName.trim(),
        classType,
        branch,
        amount: Number(amount),
        contractDate: new Date(date),
        source: "manual",
        createdAt: serverTimestamp(),
      });

      // reset (tarih kalsın)
      setStudentName("");
      setClassType("");
      setBranch("");
      setAmount("");
    } catch (err) {
      console.error("MANUEL KAYIT HATASI:", err);
      alert("Kayıt sırasında hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, color: "white", maxWidth: 520 }}>
      <h2>✍️ Günlük Giriş</h2>
      <p style={{ opacity: 0.7 }}>2026 ve sonrası manuel kayıt</p>

      <form
        onSubmit={handleSubmit}
        style={{ display: "grid", gap: 12, marginTop: 16 }}
      >
        <label>
          Tarih
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label>
          Öğrenci Adı
          <input
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Örn: Ahmet Yılmaz"
            style={inputStyle}
          />
        </label>

        <label>
          Program / Sınıf
          <select
            value={classType}
            onChange={(e) => setClassType(e.target.value)}
            style={inputStyle}
          >
            <option value="">Seçiniz</option>
            {PROGRAMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label>
          Şube
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value as any)}
            style={inputStyle}
          >
            <option value="">Seçiniz</option>
            <option value="Mefkure Plus">Mefkure Plus</option>
            <option value="Mefkure Vip">Mefkure Vip</option>
            <option value="Mefkure LGS">Mefkure LGS</option>
          </select>
        </label>

        <label>
          Tutar (₺)
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Örn: 35000"
            style={inputStyle}
          />
        </label>

        <button type="submit" style={buttonStyle} disabled={saving}>
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  marginTop: 4,
  background: "#020617",
  border: "1px solid #ffffff22",
  borderRadius: 6,
  color: "white",
};

const buttonStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 14px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
};
