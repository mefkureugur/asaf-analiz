import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase"; 
import { useAuth } from "../../store/AuthContext";
import { useRecords } from "../../hooks/useRecords";
import { aktifDonem, hedefBelgeKimligi, tarihinYili } from "../../constants/donem";

const normalize = (s: any): string => {
  if (!s) return "";
  return String(s).toLocaleLowerCase('tr-TR').trim()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/ okulu$/, " okul").replace(/ anaokulu$/, " anaokul");
};

export default function ManagerTargets() {
  const { user } = useAuth();
  const [targets, setTargets] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const mapping: Record<string, string[]> = {
    "altinkure ilkogretim": ["Altınküre İlkokul", "Altınküre Ortaokul", "Altınküre Anaokulu"],
    "altinkure lise": ["Altınküre Fen Lisesi", "Altınküre Anadolu Lisesi", "Altınküre Akademi"],
    "altinkure teknokent": ["Altınküre Teknokent"],
    "mefkure lgs": ["Mefkure LGS"],
    "mefkure yks": ["Mefkure PLUS", "Mefkure VIP"] 
  };

  const myBranches = useMemo(() => {
    if (!user) return [];
    const uB = normalize(user.branchId || "");
    return mapping[uB] || [user.branchId];
  }, [user]);

  const hasMultipleBranches = myBranches.length > 1;


  // Yillik hedefler ayri bir belgede tutuluyor
  useEffect(() => {
    async function loadTargets() {
      try {
        const snap = await getDoc(doc(db, "targets", hedefBelgeKimligi()));
        // Belge yoksa da bir nesne yazılır. Aksi halde targets null kalır ve
        // sayfa sonsuza kadar "Yükleniyor..." gösterirdi — yeni dönemin
        // hedefleri henüz girilmemişken tam olarak bu oluyordu.
        setTargets(snap.exists() ? snap.data() : { monthly: {}, yearly: {}, __bos: true });
      } catch (e) {
        console.warn("Hedefler yüklenemedi:", e);
        setTargets({ monthly: {}, yearly: {}, __bos: true });
      }
    }
    loadTargets();
  }, []);

  // Tek veri kaynagi: JSON/Firestore birlestirmesi ve iptal suzgeci
  // useRecords icinde yapiliyor. Iptal edilen kayitlar buraya gelmez.
  const { records: allRecords } = useRecords();

  const calculateData = (isYear: boolean) => {
    let tS = 0; let tR = 0;
    let rC = 0; let rR = 0;

    myBranches.forEach(branch => {
      const target = isYear ? targets?.yearly?.[branch] : targets?.monthly?.[selectedMonth]?.[branch];
      tS += Number(target?.student || 0);
      tR += Number(target?.revenue || 0);

      const recs = allRecords.filter(r => {
        const p = r.SözleşmeTarihi.split(".");
        return normalize(r.Okul) === normalize(branch) && Number(p[2]) === aktifDonem() && (isYear ? true : parseInt(p[1]) === selectedMonth + 1);
      });
      rC += recs.length;
      rR += recs.reduce((acc, curr) => acc + curr.SonTutar, 0);
    });

    const tAvg = tS > 0 ? Math.round(tR / tS) : 0;
    const rAvg = rC > 0 ? Math.round(rR / rC) : 0;

    return {
      title: isYear ? "YILLIK GENEL DURUM" : "AYLIK GRUP DURUMU",
      rC, tS, pctS: tS > 0 ? Math.round((rC/tS)*100) : 0,
      rR, tR, pctR: tR > 0 ? Math.round((rR/tR)*100) : 0,
      rA: rAvg, tA: tAvg, pctA: tAvg > 0 ? Math.round((rAvg/tAvg)*100) : 0
    };
  };

  if (!targets) return <div className="page" style={{ textAlign: "center", paddingTop: "var(--sp-7)", color: "var(--text-2)" }}>Yükleniyor...</div>

  const hedefYok = targets.__bos === true;

  return (
    <div className="page rise" style={{ maxWidth: 1200 }}>
      {/* Yeni dönemin hedefleri henüz girilmemişse sebebini söyle; önceden
          bu durumda sayfa sonsuza kadar "Yükleniyor..." gösteriyordu. */}
      {hedefYok && (
        <div style={hedefYokKutusu}>
          <strong>{aktifDonem()} dönemi</strong> için henüz hedef girilmemiş. Gerçekleşen
          rakamlar aşağıda görünür; hedef karşılaştırması, yönetim hedefleri girdikten
          sonra çalışmaya başlar.
        </div>
      )}

      <header style={headerWrapper}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0 }}>Performans Paneli</h2>
          <p style={{ color: "var(--text-3)", fontSize: "0.75rem", marginTop: 2 }}>{user?.displayName || "Müdürüm"}</p>
        </div>
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={selStyle}>
          {["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"].map((m, i) => <option key={i} value={i} style={{background: "var(--surface)"}}>{m}</option>)}
        </select>
      </header>

      <div style={{ 
        display: "grid", 
        gridTemplateColumns: window.innerWidth < 768 ? "1fr" : (hasMultipleBranches ? "1fr 1fr" : "1fr"), 
        gap: 15, 
        marginBottom: 20 
      }}>
        {hasMultipleBranches && <StandardCard data={calculateData(false)} isMonth />}
        <StandardCard data={calculateData(true)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: window.innerWidth < 768 ? "1fr" : "repeat(auto-fit, minmax(400px, 1fr))", gap: 15 }}>
        {myBranches.map((branchName) => {
          const target = targets.monthly?.[selectedMonth]?.[branchName] || { student: 0, revenue: 0 };
          const recs = allRecords.filter(r => normalize(r.Okul) === normalize(branchName) && tarihinYili(r.SözleşmeTarihi) === aktifDonem() && parseInt(r.SözleşmeTarihi.split(".")[1]) === selectedMonth + 1);
          const rC = recs.length;
          const rR = recs.reduce((acc, curr) => acc + curr.SonTutar, 0);
          const tA = target.student > 0 ? Math.round(target.revenue / target.student) : 0;
          const rA = rC > 0 ? Math.round(rR / rC) : 0;

          return <StandardCard key={branchName} data={{
            title: branchName,
            rC, tS: target.student, pctS: target.student > 0 ? Math.round((rC/target.student)*100) : 0,
            rR, tR: target.revenue, pctR: target.revenue > 0 ? Math.round((rR/target.revenue)*100) : 0,
            rA, tA, pctA: tA > 0 ? Math.round((rA/tA)*100) : 0
          }} isBranch />;
        })}
      </div>
    </div>
  );
}

function StandardCard({ data, isMonth, isBranch }: any) {
  const isYear = data.title.includes("YILLIK");
  const mainColor = isMonth ? "var(--accent)" : (isYear ? "#a855f7" : "var(--accent)");
  
  return (
    <div style={{ ...cardBase, borderTop: `5px solid ${mainColor}` }}>
      <div style={cardHeader}>
        <div style={{...cardTitle, fontSize: isBranch ? '0.9rem' : '0.8rem'}}>{data.title}</div>
        {isBranch && <div style={statusBadge(data.pctS >= 100)}>{data.pctS >= 100 ? "🎯" : "🚀"}</div>}
      </div>
      
      <div style={metricsList}>
        <MetricLine label="ÖĞRENCİ" current={data.rC} target={data.tS} pct={data.pctS} color={mainColor} />
        <MetricLine label="CİRO" current={data.rR} target={data.tR} pct={data.pctR} isPrice color={mainColor} />
        <MetricLine label="ORTALAMA" current={data.rA} target={data.tA} pct={data.pctA} isPrice color={mainColor} />
      </div>
    </div>
  );
}

function MetricLine({ label, current, target, pct, isPrice, color }: any) {
  const isDone = pct >= 100;
  const textColor = isDone ? "var(--success)" : "var(--text)"; 
  
  return (
    <div style={metricRow}>
      <div style={mTop}>
        <span style={mLabel}>{label}</span>
        <span style={{ ...mValue, color: textColor }}>
          {isPrice ? `₺${Math.round(current/1000)}k` : current}
          <span style={mTarget}> / {isPrice ? `${Math.round(target/1000)}k` : target}</span>
        </span>
      </div>
      <div style={barContainer}>
        <div style={barBase}><div style={{ ...barFill, width: `${Math.min(pct, 100)}%`, background: isDone ? "var(--success)" : color }}></div></div>
        <span style={{ ...pctText, color: isDone ? "var(--success)" : "var(--text-2)" }}>%{pct}</span>
      </div>
    </div>
  );
}

// 🎨 MOBİL UYUMLU STİLLER
const hedefYokKutusu: React.CSSProperties = {
  background: "color-mix(in srgb, var(--warning) 10%, transparent)",
  border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)",
  color: "var(--text-2)",
  borderRadius: "var(--r-md)",
  padding: "var(--sp-3) var(--sp-4)",
  fontSize: "0.85rem",
  lineHeight: 1.6,
  marginBottom: "var(--sp-4)",
};

const headerWrapper = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 10 };
const cardBase = { background: "var(--surface)", borderRadius: "var(--r-xl)", padding: "15px 20px", border: "1px solid var(--line)", position: "relative" as const, overflow: "hidden" };
const cardHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottom: "1px solid var(--line)", paddingBottom: 8 };
const cardTitle = { fontWeight: 800, color: "var(--text)", textTransform: "uppercase" as const };
const statusBadge = (done: boolean) => ({ fontSize: "0.9rem" });
const metricsList = { display: "flex", flexDirection: "column" as const, gap: 12 };
const metricRow = { display: "flex", flexDirection: "column" as const, gap: 2 };
const mTop = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const mLabel = { fontSize: "0.6rem", fontWeight: 800, color: "var(--text-3)", letterSpacing: "0.5px" };
const mValue = { fontSize: "0.95rem", fontWeight: 800 };
const mTarget = { fontSize: "0.7rem", color: "var(--text-3)", fontWeight: 400 };
const barContainer = { display: "flex", alignItems: "center", gap: 8 };
const barBase = { flex: 1, height: 5, background: "var(--line)", borderRadius: "var(--r-md)", overflow: "hidden" };
const barFill = { height: "100%", transition: "width 1s ease-in-out" };
const pctText = { fontSize: "0.7rem", fontWeight: 800, minWidth: "28px", textAlign: "right" as const };
const selStyle = { background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text)", padding: "6px 12px", borderRadius: "var(--r-md)", fontSize: "0.8rem", fontWeight: 700 };