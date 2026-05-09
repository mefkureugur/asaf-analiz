import { useState, useMemo, useEffect } from "react";
import { collection, query, onSnapshot, where } from "firebase/firestore";
import { db } from "../../firebase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList, Cell, ReferenceLine, Label } from "recharts";
import { TrendingUp, Users, Presentation, Building, Info } from "lucide-react";
import asafFinansRaw from "../../data/finans.json";

interface FinansRecord { Kurum: string; Alan: string; Dönem: string; [key: string]: any; }

interface FinanceEfficiencyPageProps {
  selectedKurum: string;
  selectedDonem: string;
}

export default function FinanceEfficiencyPage({ selectedKurum, selectedDonem }: any) {
  const [firebaseData, setFirebaseData] = useState<any[]>([]);
  const [opStats, setOpStats] = useState<any>({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeMetric, setActiveMetric] = useState<string>("ogrenciMaliyet");
  const rawData = asafFinansRaw as FinansRecord[];

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);

    const targetYear = parseInt(selectedDonem.split('-')[1]);
    const qFin = query(collection(db, "financeSnapshots"), where("year", "==", targetYear));
    const unsubFin = onSnapshot(qFin, (snapshot) => {
      setFirebaseData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qOp = query(collection(db, "operationalStats"));
    const unsubOp = onSnapshot(qOp, (snapshot) => {
      const data: any = {};
      snapshot.docs.forEach(doc => {
        data[doc.id] = doc.data();
      });
      setOpStats(data);
    });

    return () => {
      unsubFin();
      unsubOp();
      window.removeEventListener("resize", handleResize);
    };
  }, [selectedDonem]);

  const formatCurrency = (val: number) => `₺${Math.round(val).toLocaleString("tr-TR")}`;
  const formatPercent = (val: number) => `%${val.toFixed(1)}`;

  const parseAmount = (val: any): number => {
    if (typeof val === 'number') return val;
    return parseInt(String(val || '0').replace(/,/g, '')) || 0;
  };

  const analysis = useMemo(() => {
    const targetYear = parseInt(selectedDonem.split('-')[1]);
    
    // Kurumları belirle (Tüm Kurumlar seçiliyse hepsi, yoksa tek kurum)
    const branches = selectedKurum === "Tüm Kurumlar" 
      ? Object.keys(opStats) 
      : [selectedKurum];

    let totalCiro = 0;
    let totalGider = 0;
    let totalIdareci = 0;
    let totalOgretmen = 0;
    let totalSinif = 0;
    let totalOgrenci = 0;
    let totalCalisan = 0;
    
    const branchStats = branches.map(branch => {
      // 1. Ciro Hesaplama (Sadece Firebase)
      const ciro = firebaseData
        .filter(d => d.unit === branch && d.category === "Ciro")
        .reduce((acc, curr) => acc + (Number(curr.revenueTotal) || 0), 0);
      
      // 2. Tahmini Toplam Gider Hesaplama (JSON + Firebase Ortalama x 12 Mantığı)
      const ayFull = ["Ağustos", "Eylül", "Ekim", "Kasım", "Aralık", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz"];
      const processed = ayFull.map((ay, index) => {
        let ayToplam = 0;
        if (index <= 4) { // Ağustos - Aralık (JSON)
          const jsonEntries = rawData.filter(item => 
            item.Dönem === selectedDonem && item.Alan === "Toplam Giderler" && item.Kurum === branch
          );
          ayToplam = jsonEntries.reduce((acc, curr) => acc + parseAmount(curr[ay]), 0);
        } else { // Ocak - Temmuz (Firebase)
          const fbEntries = firebaseData.filter(d => d.unit === branch && d.category === "Toplam Giderler");
          fbEntries.forEach(d => {
            if (d.expenses && d.expenses[index] !== undefined && d.expenses[index] > 0) {
                ayToplam += Number(d.expenses[index]);
            } else if (d.filledMonths && d.filledMonths.includes(index)) {
                ayToplam += (Number(d.expenseRealSoFar || 0) / d.filledMonths.length);
            }
          });
        }
        return ayToplam;
      });

      const doluAylar = processed.filter(t => t > 1000);
      const ortalamaGider = doluAylar.length > 0 ? doluAylar.reduce((a, b) => a + b, 0) / doluAylar.length : 0;
      const gider = ortalamaGider * 12; // Tahmini Yıl Sonu Gideri
      
      const op = opStats[branch] || { idareci: 0, ogretmen: 0, sinif: 0, ogrenci: 0, calisan: 0 };
      
      const kar = ciro - gider;
      const karMarji = ciro > 0 ? (kar / ciro) * 100 : 0;
      
      totalCiro += ciro;
      totalGider += gider;
      totalIdareci += op.idareci;
      totalOgretmen += op.ogretmen;
      totalSinif += op.sinif;
      totalOgrenci += op.ogrenci;
      totalCalisan += op.calisan;

      return {
        name: branch.replace("Mefkure", "M.").replace("Altınküre", "A."),
        ciro,
        gider,
        kar,
        karMarji,
        idareci: op.idareci,
        ogretmen: op.ogretmen,
        sinif: op.sinif,
        ogrenci: op.ogrenci,
        calisan: op.calisan,
        idareciBasinaOgrenci: op.idareci > 0 ? op.ogrenci / op.idareci : 0,
        ogrenciMaliyet: op.ogrenci > 0 ? gider / op.ogrenci : 0,
        sinifMaliyet: op.sinif > 0 ? gider / op.sinif : 0,
        sinifDoluluk: op.sinif > 0 ? op.ogrenci / op.sinif : 0,
        personelBasinaOgrenci: op.calisan > 0 ? op.ogrenci / op.calisan : 0,
      };
    });

    // Toplam özet (Tüm Kurumlar için)
    const summary = {
      ciro: totalCiro,
      gider: totalGider,
      kar: totalCiro - totalGider,
      karMarji: totalCiro > 0 ? ((totalCiro - totalGider) / totalCiro) * 100 : 0,
      idareci: totalIdareci,
      ogretmen: totalOgretmen,
      sinif: totalSinif,
      ogrenci: totalOgrenci,
      calisan: totalCalisan,
      idareciBasinaOgrenci: totalIdareci > 0 ? totalOgrenci / totalIdareci : 0,
      ogrenciMaliyet: totalOgrenci > 0 ? totalGider / totalOgrenci : 0,
      sinifMaliyet: totalSinif > 0 ? totalGider / totalSinif : 0,
      sinifDoluluk: totalSinif > 0 ? totalOgrenci / totalSinif : 0,
      personelBasinaOgrenci: totalCalisan > 0 ? totalOgrenci / totalCalisan : 0,
    };

    return { summary, branchStats: branchStats.sort((a,b) => (b as any)[activeMetric] - (a as any)[activeMetric]) };
  }, [firebaseData, opStats, selectedKurum, selectedDonem, rawData, activeMetric]);

  const metricsConfig: any = {
    ogrenciMaliyet: { title: "ÖĞRENCİ BAŞI MALİYET", color: "#ef4444", formatter: formatCurrency, isCurrency: true, isHigherBetter: false },
    sinifMaliyet: { title: "SINIF BAŞI MALİYET", color: "#ec4899", formatter: formatCurrency, isCurrency: true, isHigherBetter: false },
    sinifDoluluk: { title: "SINIF BAŞINA ÖĞRENCİ", color: "#22c55e", formatter: (v:any) => v.toFixed(1), isCurrency: false, isHigherBetter: true },
    personelBasinaOgrenci: { title: "PERSONEL BAŞINA ÖĞRENCİ", color: "#3b82f6", formatter: (v:any) => v.toFixed(1), isCurrency: false, isHigherBetter: true },
    idareciBasinaOgrenci: { title: "İDARECİ BAŞINA ÖĞRENCİ", color: "#f59e0b", formatter: (v:any) => v.toFixed(1), isCurrency: false, isHigherBetter: true }
  };

  const activeConf = metricsConfig[activeMetric];

  const activeMetricAvg = useMemo(() => {
    if (analysis.branchStats.length === 0) return 0;
    return analysis.branchStats.reduce((acc: any, curr: any) => acc + curr[activeMetric], 0) / analysis.branchStats.length;
  }, [analysis.branchStats, activeMetric]);

  return (
    <div style={{ marginTop: 10, padding: isMobile ? "0 5px" : 0 }}>
      {/* 📊 ÜST ÖZET KARTLARI */}
      <div style={{ ...grid3, gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <StatCard title="ÖĞRENCİ BAŞI MALİYET" value={formatCurrency(analysis.summary.ogrenciMaliyet)} icon={<TrendingUp size={16}/>} color="#ef4444" isMobile={isMobile} active={activeMetric === "ogrenciMaliyet"} onClick={() => setActiveMetric("ogrenciMaliyet")} />
        <StatCard title="SINIF BAŞI MALİYET" value={formatCurrency(analysis.summary.sinifMaliyet)} icon={<Presentation size={16}/>} color="#ec4899" isMobile={isMobile} active={activeMetric === "sinifMaliyet"} onClick={() => setActiveMetric("sinifMaliyet")} />
        <StatCard title="SINIF BAŞINA ÖĞRENCİ" value={analysis.summary.sinifDoluluk.toFixed(1)} icon={<Presentation size={16}/>} color="#22c55e" isMobile={isMobile} active={activeMetric === "sinifDoluluk"} onClick={() => setActiveMetric("sinifDoluluk")} />
        <StatCard title="PERSONEL BAŞINA ÖĞRENCİ" value={analysis.summary.personelBasinaOgrenci.toFixed(1)} icon={<Users size={16}/>} color="#3b82f6" isMobile={isMobile} active={activeMetric === "personelBasinaOgrenci"} onClick={() => setActiveMetric("personelBasinaOgrenci")} />
        <StatCard title="İDARECİ BAŞINA ÖĞRENCİ" value={analysis.summary.idareciBasinaOgrenci.toFixed(1)} icon={<Users size={16}/>} color="#f59e0b" isMobile={isMobile} active={activeMetric === "idareciBasinaOgrenci"} onClick={() => setActiveMetric("idareciBasinaOgrenci")} />
      </div>

      {/* 📉 GRAFİK: KURUMLARIN İDARECİ VERİMLİLİĞİ */}
      {selectedKurum === "Tüm Kurumlar" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>


          {/* BAR CHART: DİNAMİK METRİK */}
          <div style={{ ...chartWrapper, padding: isMobile ? "15px 5px" : "20px" }}>
            <div style={headerStyle}>{activeConf.title} KARŞILAŞTIRMASI {activeConf.isCurrency ? "(₺)" : ""}</div>
            <div style={{ height: 300, marginTop: 15 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysis.branchStats} margin={{ top: 25, right: 10, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} tick={{ dy: 15 }} />
                  <YAxis hide domain={[(dataMin: number) => (dataMin < 0 ? dataMin * 1.2 : 0), 'dataMax * 1.2']} />
                  <Tooltip cursor={{fill: '#1e293b', opacity: 0.4}} contentStyle={tooltipStyle} itemStyle={{ color: '#f8fafc', fontSize: '12px', fontWeight: 600 }} formatter={(v: any) => [activeConf.formatter(v), activeConf.title]} />
                  <ReferenceLine y={activeMetricAvg} stroke="#cbd5e1" strokeDasharray="3 3">
                     <Label position="insideTopLeft" value={`Ort: ${activeConf.formatter(activeMetricAvg)}`} fill="#94a3b8" fontSize={10} />
                  </ReferenceLine>
                  <Bar dataKey={activeMetric} radius={[4, 4, 0, 0]} barSize={30}>
                    <LabelList 
                      dataKey={activeMetric} 
                      content={(props: any) => {
                        const { x, y, width, height, value } = props;
                        const isNegative = value < 0;
                        const formatted = activeConf.isCurrency ? `₺${(value/1000).toFixed(0)}K` : value.toFixed(1);
                        
                        const safeY = Number(y) || 0;
                        const safeHeight = Number(height) || 0;
                        const yPos = isNegative ? (safeY + safeHeight + 12) : (safeY - 8);

                        return (
                          <text 
                            x={(x || 0) + (width || 0) / 2} 
                            y={yPos} 
                            fill={isNegative ? "#ef4444" : "#94a3b8"} 
                            fontSize={10} 
                            fontWeight={800} 
                            textAnchor="middle"
                          >
                            {formatted}
                          </text>
                        );
                      }}
                    />
                    {analysis.branchStats.map((entry, index) => {
                      const val = (entry as any)[activeMetric];
                      let isGood = false;
                      if (activeConf.isHigherBetter) {
                        isGood = val >= activeMetricAvg;
                      } else {
                        isGood = val <= activeMetricAvg;
                      }
                      return <Cell key={index} fill={val === 0 ? "#1e293b" : (isGood ? "#22c55e" : "#ef4444")} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ ...chartWrapper, padding: "20px", display: "flex", flexDirection: "column", gap: 15 }}>
          <div style={headerStyle}><Info size={16} color="#3b82f6"/> STRATEJİK DEĞERLENDİRME ÖZETİ</div>
          <div style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: "1.6" }}>
            Seçilen kurum (<b>{selectedKurum}</b>) için {analysis.summary.sinif} sınıfta, toplam <b>{analysis.summary.ogrenci}</b> öğrenci eğitim görmektedir. 
            Bu durum sınıf başına ortalama <b>{analysis.summary.sinifDoluluk.toFixed(1)}</b> öğrenci düştüğünü göstermektedir. 
            Ayrıca 1 çalışan başına <b>{analysis.summary.personelBasinaOgrenci.toFixed(1)}</b> öğrenci düşmekte olup, 
            öğrenci başı maliyet <b>{formatCurrency(analysis.summary.ogrenciMaliyet)}</b> olarak gerçekleşmektedir.
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color, isMobile, active, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      style={{ 
        background: active ? "#1e293b" : "#0f172a", 
        border: `1px solid ${active ? color : '#1e2937'}`, 
        borderTop: `3px solid ${color}`, 
        borderRadius: 12, 
        padding: isMobile ? "12px" : "18px",
        cursor: "pointer",
        transition: "all 0.2s ease-in-out",
        boxShadow: active ? `0 4px 12px ${color}20` : "none",
        transform: active ? "translateY(-2px)" : "none"
      }}
    >
      <div style={{ color: active ? "#cbd5e1" : "#64748b", fontSize: isMobile ? "0.6rem" : "0.65rem", fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>{icon} {title}</div>
      <div style={{ fontSize: isMobile ? "1.2rem" : "1.6rem", fontWeight: 900, color: "#f8fafc" }}>{value}</div>
    </div>
  );
}

const grid3 = { display: "grid", gap: 15, marginBottom: 25 };
const chartWrapper = { background: "#0f172a", border: "1px solid #1e2937", borderRadius: 16 };
const headerStyle = { fontSize: "0.75rem", fontWeight: 800, color: "#94a3b8", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 };
const tooltipStyle = { background: "#020617", border: "1px solid #1e2937", borderRadius: "8px" };
