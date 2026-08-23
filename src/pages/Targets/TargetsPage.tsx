import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase"; 
import { useAuth } from "../../store/AuthContext";
import { useRecords } from "../../hooks/useRecords";
import { aktifDonem, hedefBelgeKimligi, tarihinYili } from "../../constants/donem";

const normalize = (s: any): string => {
  if (!s) return "";
  return String(s).toLocaleLowerCase('tr-TR').trim()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ okulu$/, " okul").replace(/ anaokulu$/, " anaokul");
};

export default function TargetsPage() {
  const { user } = useAuth();
  const [targets, setTargets] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  
  const [selInstMonth, setSelInstMonth] = useState("GENEL");
  const [selInstYear, setSelInstYear] = useState("GENEL");
  const [saving, setSaving] = useState(false);

  // 🛡️ ANA GRUPLAR VE ALT ŞUBELER (Tam İstediğin Liste)
  const groupMapping: Record<string, string[]> = {
    "Altınküre İlköğretim": ["Altınküre Anaokulu", "Altınküre İlkokul", "Altınküre Ortaokul"],
    "Altınküre Lise": ["Altınküre Fen Lisesi", "Altınküre Anadolu Lisesi", "Altınküre Akademi"],
    "Mefkure YKS": ["Mefkure PLUS", "Mefkure VIP"]
  };

  // 📝 ADMİNİN HEDEF GİREBİLECEĞİ TEKİL ŞUBELERİN LİSTESİ
  const allSubBranches = [
    "Altınküre Anaokulu", "Altınküre İlkokul", "Altınküre Ortaokul",
    "Altınküre Fen Lisesi", "Altınküre Anadolu Lisesi", "Altınküre Akademi",
    "Altınküre Teknokent", "Mefkure LGS", "Mefkure PLUS", "Mefkure VIP"
  ];

  const getAvailableList = () => {
    if (user?.role === 'admin') return ["GENEL", ...allSubBranches];
    
    const uB = normalize(user?.branchId || "");
    if (uB === "altinkure ilkogretim") return ["TOPLAM (İLKÖĞRETİM)", ...groupMapping["Altınküre İlköğretim"]];
    if (uB === "altinkure lise") return ["TOPLAM (LİSE)", ...groupMapping["Altınküre Lise"]];
    if (uB === "mefkure yks") return ["TOPLAM (YKS)", ...groupMapping["Mefkure YKS"]];
    
    return [user?.branchId || ""];
  };

  useEffect(() => {
    if (user && user.role !== 'admin') {
      const list = getAvailableList();
      setSelInstMonth(list[0]);
      setSelInstYear(list[0]);
    }
  }, [user]);


  // Yillik hedefler ayri bir belgede tutuluyor
  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, "targets", hedefBelgeKimligi()));
      setTargets(snap.exists() ? snap.data() : { monthly: {}, yearly: {} });
    }
    load();
  }, []);

  // Tek veri kaynagi: JSON/Firestore birlestirmesi ve iptal suzgeci
  // useRecords icinde yapiliyor. Iptal edilen kayitlar buraya gelmez.
  const { records: allRecords } = useRecords();

  // ✅ HESAPLAMA MOTORU: "TOPLAM" SEÇİLİNCE ALT ŞUBELERİ TOPLAR
  const getTargetData = (inst: string, type: 'monthly' | 'yearly') => {
    if (!targets) return { student: 0, revenue: 0 };
    
    let subList: string[] = [];
    if (inst === "GENEL") subList = allSubBranches;
    else if (inst.includes("İLKÖĞRETİM")) subList = groupMapping["Altınküre İlköğretim"];
    else if (inst.includes("LİSE")) subList = groupMapping["Altınküre Lise"];
    else if (inst.includes("YKS")) subList = groupMapping["Mefkure YKS"];
    else subList = [inst];

    const sum = { student: 0, revenue: 0 };
    subList.forEach(s => {
      // Excel/Verideki VIP/Vip farkını yakalamak için normalize veya manuel kontrol
      const key = s === "Mefkure VIP" ? "Mefkure VIP" : s; 
      const d = type === 'monthly' ? targets.monthly?.[selectedMonth]?.[key] : targets.yearly?.[key];
      sum.student += Number(d?.student || 0);
      sum.revenue += Number(d?.revenue || 0);
    });
    return sum;
  };

  const getRealized = (inst: string, isYear: boolean) => {
    let subList: string[] = [];
    if (inst === "GENEL") subList = allSubBranches;
    else if (inst.includes("İLKÖĞRETİM")) subList = groupMapping["Altınküre İlköğretim"];
    else if (inst.includes("LİSE")) subList = groupMapping["Altınküre Lise"];
    else if (inst.includes("YKS")) subList = ["Mefkure Plus", "Mefkure VIP", "MEFKURE Vip"];
    else subList = [inst];

    const normList = subList.map(n => normalize(n));
    const yearRecs = allRecords.filter(r => normList.includes(normalize(r.Okul)) && tarihinYili(r.SözleşmeTarihi) === aktifDonem());
    const finalRecs = isYear ? yearRecs : yearRecs.filter(r => parseInt(r.SözleşmeTarihi.split(".")[1]) === selectedMonth + 1);
    
    const count = finalRecs.length;
    const total = finalRecs.reduce((acc, curr) => acc + curr.SonTutar, 0);
    return { count, total, avg: count > 0 ? Math.round(total / count) : 0 };
  };

  const save = async () => {
    if (user?.role !== 'admin') return;
    setSaving(true);
    try {
      await setDoc(doc(db, "targets", hedefBelgeKimligi()), { ...targets, updatedAt: serverTimestamp() }, { merge: true });
      alert("🎯 Hedefler Kaydedildi!");
    } catch (e) { alert("Hata!"); } finally { setSaving(false); }
  };

  return (
    <div className="page rise" style={{ maxWidth: 1000 }}>
      <header style={{ marginBottom: 30, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "1.6rem", fontWeight: 700 }}>🎯 Hedef Yönetimi — {aktifDonem()}</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={filterBox}>
            <label style={labSmall}>Ay:</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={selStyle}>
              {["Ocak","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"].map((m, i) => <option key={i} value={i} style={optStyle}>{m}</option>)}
            </select>
          </div>
          {user?.role === 'admin' && <button onClick={save} style={saveButtonStyle}>{saving ? "..." : "💾 Kaydet"}</button>}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 30 }}>
        <TargetSection type="monthly" title="AYLIK DURUM" selectedInst={selInstMonth} setSelectedInst={setSelInstMonth} availableList={getAvailableList()} data={getTargetData(selInstMonth, 'monthly')} realized={getRealized(selInstMonth, false)} isAdmin={user?.role === 'admin'} update={(f: string, v: string) => {
            const next = { ...targets };
            if(!next.monthly) next.monthly = {};
            if(!next.monthly[selectedMonth]) next.monthly[selectedMonth] = {};
            if(!next.monthly[selectedMonth][selInstMonth]) next.monthly[selectedMonth][selInstMonth] = {student:0, revenue:0};
            next.monthly[selectedMonth][selInstMonth][f] = Number(v.replace(/[^\d]/g, ""));
            setTargets(next);
        }} />
        <TargetSection type="yearly" title="YILLIK DURUM" selectedInst={selInstYear} setSelectedInst={setSelInstYear} availableList={getAvailableList()} data={getTargetData(selInstYear, 'yearly')} realized={getRealized(selInstYear, true)} isAdmin={user?.role === 'admin'} update={(f: string, v: string) => {
            const next = { ...targets };
            if(!next.yearly) next.yearly = {};
            if(!next.yearly[selInstYear]) next.yearly[selInstYear] = {student:0, revenue:0};
            next.yearly[selInstYear][f] = Number(v.replace(/[^\d]/g, ""));
            setTargets(next);
        }} />
      </div>
    </div>
  );
}

function TargetSection({ title, selectedInst, setSelectedInst, availableList, data, realized, isAdmin, update }: any) {
  const target = data || { student: 0, revenue: 0 };
  const avgTar = target.student > 0 ? Math.round(target.revenue / target.student) : 0;
  // TOPLAM seçiliyse veya ADMIN değilse giriş kilitlidir
  const isReadOnly = !isAdmin || selectedInst.includes("TOPLAM") || selectedInst === "GENEL";

  return (
    <div style={cardStyle}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:25}}>
        <div style={secTitle}>{title}</div>
        <select value={selectedInst} onChange={(e) => setSelectedInst(e.target.value)} style={cardSelStyle}>
          {availableList.map((k: string) => <option key={k} value={k} style={optStyle}>{k}</option>)}
        </select>
      </div>
      <div style={inputGroup}>
        <div style={row}><span>Öğrenci Hedefi</span><input disabled={isReadOnly} value={target.student} onChange={(e)=>update('student', e.target.value)} style={inp}/></div>
        <div style={row}><span>Ciro Hedefi</span><input disabled={isReadOnly} value={target.revenue} onChange={(e)=>update('revenue', e.target.value)} style={inp}/></div>
        <div style={row}><span style={{color:"var(--text-3)"}}>Ortalama Hedef</span><span style={autoVal}>₺{avgTar.toLocaleString("tr-TR")}</span></div>
      </div>
      <div style={resBox}>
        <ResultLine label="Gerçekleşen Öğrenci" val={realized.count} tar={target.student} />
        <ResultLine label="Gerçekleşen Ciro" val={`₺${realized.total.toLocaleString("tr-TR")}`} tar={target.revenue} />
        <ResultLine label="Gerçekleşen Ortalama" val={`₺${realized.avg.toLocaleString("tr-TR")}`} tar={avgTar} />
      </div>
    </div>
  );
}

function ResultLine({ label, val, tar }: any) {
  const numVal = typeof val === 'string' ? parseFloat(val.replace(/[^\d]/g, "")) : val;
  const pct = tar > 0 ? Math.round((numVal / tar) * 100) : 0;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", marginBottom: 12 }}>
      <span style={{ color: "var(--text-2)" }}>{label}:</span>
      <span style={{ fontWeight: 700 }}>{val} <span style={{ color: pct >= 100 ? "var(--success)" : "var(--danger)", marginLeft: 8 }}>%{pct}</span></span>
    </div>
  );
}

const cardStyle = { background: "var(--surface)", borderRadius: "var(--r-xl)", padding: 30, border: "1px solid var(--line)" };
const filterBox = { background: "var(--surface)", padding: "8px 15px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", minWidth: "120px" };
const labSmall = { fontSize: "0.6rem", color: "var(--text-3)", display: "block", fontWeight: 800, textTransform: "uppercase" as const, marginBottom: 4 };
const selStyle = { background: "transparent", border: "none", color: "var(--text)", outline: "none", cursor: "pointer", fontSize: "0.85rem", width: "100%", colorScheme: "dark" };
const cardSelStyle = { background: "var(--line)", color: "var(--text)", border: "1px solid var(--line-strong)", padding: "8px 12px", borderRadius: "var(--r-md)", fontSize: "0.8rem", outline: "none", colorScheme: "dark" };
const optStyle = { background: "var(--surface)", color: "var(--text)" };
const secTitle = { fontSize: "0.8rem", fontWeight: 800, color: "var(--text-3)", letterSpacing: 1 };
const inputGroup = { display: "flex", flexDirection: "column" as const, gap: 15, marginBottom: 25 };
const row = { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.95rem" };
const inp = { background: "var(--line)", border: "1px solid var(--line-strong)", color: "var(--text)", padding: "10px", borderRadius: "var(--r-md)", width: "120px", textAlign: "right" as const, outline: "none" };
const autoVal = { fontWeight: 700, color: "var(--accent)" };
const resBox = { background: "var(--bg)", padding: 20, borderRadius: "var(--r-xl)", borderLeft: "4px solid var(--success)" };
const saveButtonStyle = { background: "var(--accent)", color: "var(--surface)", border: "none", padding: "10px 20px", borderRadius: "var(--r-md)", fontWeight: 700, cursor: "pointer" };