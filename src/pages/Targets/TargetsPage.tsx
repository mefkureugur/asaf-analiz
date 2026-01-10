// src/pages/Targets/TargetsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useData } from "../../store/DataContext";
import { computeKPI } from "../../services/analytics.service";

// 🔥 Firestore (modular v9)
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
// ✅ Eğer sende farklı export varsa SADECE bu satırı düzelt:
// örn: import { db } from "../../firebase";
import { db } from "../../firebase";

/* ================================
   HELPERS
================================ */

function normalizeDate(input: any): Date | null {
  if (!input) return null;
  if (typeof input?.toDate === "function") return input.toDate();
  if (input instanceof Date) return input;
  return new Date(input);
}

type ScopeKey = "lgs" | "plus" | "vip";

// ✅ Daha sağlam: hem birebir hem de içeriyor mu (isim değişse bile kırılmasın)
function resolveScopeByBranch(branch: any): ScopeKey | null {
  if (!branch) return null;

  const raw = String(branch);
  const b = raw.toLowerCase();

  // önce kesin eşleşmeler (mevcut ürün dili)
  if (raw === "Mefkure LGS") return "lgs";
  if (raw === "Mefkure Plus") return "plus";
  if (raw === "Mefkure Vip") return "vip";

  // sonra toleranslı eşleşmeler (kırılma önleme)
  if (b.includes("lgs")) return "lgs";
  if (b.includes("plus")) return "plus";
  if (b.includes("vip")) return "vip";

  return null;
}

// ✅ Kayıt anında temizlenir
function clampNumber(v: any) {
  // "10.000" gibi yazılırsa temizle
  const cleaned = String(v ?? "").replace(/[^\d]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function pct(current: number, target: number) {
  if (!target || target <= 0) return null;
  return (current / target) * 100;
}

function statusColor(p: number | null) {
  if (p === null) return "#9ca3af";
  if (p >= 90) return "#22c55e";
  if (p >= 60) return "#f59e0b";
  return "#ef4444";
}

function fmtMoney(n: number) {
  return `₺${(n ?? 0).toLocaleString("tr-TR")}`;
}

/* ================================
   FIRESTORE TARGET TYPES
================================ */

type TargetNums = {
  student: any; // ✅ UI rahat yazsın diye string de tutabilir (save'de number'a çevrilecek)
  revenue: any;
  avg: any; // yıllıkta/aylıkta istenirse girilir (istersen 0 bırak)
};

type TargetsDoc = {
  year: number;
  monthly: Record<string, { lgs: TargetNums; plus: TargetNums; vip: TargetNums }>;
  yearly: { lgs: TargetNums; plus: TargetNums; vip: TargetNums };
  updatedAt?: any;
};

const emptyTargetNums = (): TargetNums => ({ student: 0, revenue: 0, avg: 0 });

function defaultTargetsDoc(year: number): TargetsDoc {
  return {
    year,
    monthly: {},
    yearly: {
      lgs: emptyTargetNums(),
      plus: emptyTargetNums(),
      vip: emptyTargetNums(),
    },
  };
}

function ensureMonthTargets(docData: TargetsDoc, month: number) {
  const key = String(month);
  if (!docData.monthly[key]) {
    docData.monthly[key] = {
      lgs: emptyTargetNums(),
      plus: emptyTargetNums(),
      vip: emptyTargetNums(),
    };
  }
  return docData;
}

// ✅ Firestore’a giderken her şeyi temiz number'a çevir
function cleanNums(t: TargetNums) {
  return {
    student: clampNumber(t.student),
    revenue: clampNumber(t.revenue),
    avg: clampNumber(t.avg),
  };
}

/* ================================
   STYLES
================================ */

const cardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #0f172a, #020617)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 16,
};

const titleStyle: React.CSSProperties = { fontSize: 16, fontWeight: 700 };
const subTitleStyle: React.CSSProperties = { fontSize: 13, color: "#9ca3af", marginTop: 4 };

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
  marginTop: 12,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 8,
  gap: 12,
  fontSize: 14,
};

const inputStyle: React.CSSProperties = {
  width: 110,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#0b1220",
  color: "white",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#0b1220",
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
};

/* ================================
   PAGE
================================ */

export default function TargetsPage() {
  const { allRecords, loading } = useData();

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(currentMonth);

  const [targets, setTargets] = useState<TargetsDoc>(() => defaultTargetsDoc(currentYear));
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");

  // ✅ Ay kilidi: gelecek aylar girilemez (seçilen yıl bugünkü yıldan büyükse tüm aylar kilit)
  const monthLocked = useMemo(() => {
    if (year > currentYear) return true;
    if (year < currentYear) return false;
    return month > currentMonth;
  }, [year, month, currentYear, currentMonth]);

  // ✅ Firestore: targets/{year} oku
  useEffect(() => {
    let alive = true;

    async function loadTargets() {
      setTargetsLoading(true);
      setStatus("");

      try {
        const ref = doc(db as any, "targets", String(year));
        const snap = await getDoc(ref);

        let data: TargetsDoc;
        if (snap.exists()) {
          const raw = snap.data() as any;
          data = {
            year,
            monthly: raw?.monthly ?? {},
            yearly: raw?.yearly ?? {
              lgs: emptyTargetNums(),
              plus: emptyTargetNums(),
              vip: emptyTargetNums(),
            },
          };
        } else {
          data = defaultTargetsDoc(year);
        }

        // seçili ayın objesi yoksa oluştur (AMA Firestore’a yazma, sadece state için)
        ensureMonthTargets(data, month);

        if (alive) setTargets(data);
      } catch (e: any) {
        if (alive) setStatus(`Hedefler okunamadı: ${e?.message ?? "Bilinmeyen hata"}`);
      } finally {
        if (alive) setTargetsLoading(false);
      }
    }

    loadTargets();
    return () => {
      alive = false;
    };
  }, [year, month]);

  // ✅ records filtreleri
  const recordsOfYear = useMemo(() => {
    return allRecords.filter((r: any) => {
      const d = normalizeDate(r.contractDate);
      return d && d.getFullYear() === year;
    });
  }, [allRecords, year]);

  const recordsOfMonth = useMemo(() => {
    return recordsOfYear.filter((r: any) => {
      const d = normalizeDate(r.contractDate);
      return d && d.getMonth() === month;
    });
  }, [recordsOfYear, month]);

  // ✅ Scope’a göre gerçekleşen KPI
  function realizedForScope(records: any[], scope: ScopeKey) {
    const scoped = records.filter((r) => resolveScopeByBranch(r.branch) === scope);
    return computeKPI(scoped);
  }

  const realizedYear = useMemo(() => {
    return {
      lgs: realizedForScope(recordsOfYear, "lgs"),
      plus: realizedForScope(recordsOfYear, "plus"),
      vip: realizedForScope(recordsOfYear, "vip"),
    };
  }, [recordsOfYear]);

  const realizedMonth = useMemo(() => {
    return {
      lgs: realizedForScope(recordsOfMonth, "lgs"),
      plus: realizedForScope(recordsOfMonth, "plus"),
      vip: realizedForScope(recordsOfMonth, "vip"),
    };
  }, [recordsOfMonth]);

  // ✅ Toplam gerçekleşen
  const realizedYearTotal = useMemo(() => {
    const studentCount =
      realizedYear.lgs.studentCount + realizedYear.plus.studentCount + realizedYear.vip.studentCount;
    const totalRevenue =
      realizedYear.lgs.totalRevenue + realizedYear.plus.totalRevenue + realizedYear.vip.totalRevenue;
    const avgRevenue = studentCount === 0 ? 0 : totalRevenue / studentCount;
    return { studentCount, totalRevenue, avgRevenue };
  }, [realizedYear]);

  const realizedMonthTotal = useMemo(() => {
    const studentCount =
      realizedMonth.lgs.studentCount + realizedMonth.plus.studentCount + realizedMonth.vip.studentCount;
    const totalRevenue =
      realizedMonth.lgs.totalRevenue + realizedMonth.plus.totalRevenue + realizedMonth.vip.totalRevenue;
    const avgRevenue = studentCount === 0 ? 0 : totalRevenue / studentCount;
    return { studentCount, totalRevenue, avgRevenue };
  }, [realizedMonth]);

  // ✅ Seçili ay hedefleri (state’ten)
  const monthKey = String(month);
  const monthlyTargets = targets.monthly[monthKey] ?? {
    lgs: emptyTargetNums(),
    plus: emptyTargetNums(),
    vip: emptyTargetNums(),
  };

  // ✅ Toplam hedef (otomatik) — burada hesap düzgün kalsın diye number'a çeviriyoruz
  const monthlyTargetTotal = useMemo(() => {
  const lgs = cleanNums(monthlyTargets.lgs);
  const plus = cleanNums(monthlyTargets.plus);
  const vip = cleanNums(monthlyTargets.vip);

  const student = lgs.student + plus.student + vip.student;
  const revenue = lgs.revenue + plus.revenue + vip.revenue;

  // ✅ DOĞRU ORTALAMA
  const avg = student > 0 ? Math.round(revenue / student) : 0;

  return { student, revenue, avg };
}, [monthlyTargets]);


  const yearlyTargetTotal = useMemo(() => {
  const lgs = cleanNums(targets.yearly.lgs);
  const plus = cleanNums(targets.yearly.plus);
  const vip = cleanNums(targets.yearly.vip);

  const student = lgs.student + plus.student + vip.student;
  const revenue = lgs.revenue + plus.revenue + vip.revenue;

  // ✅ DOĞRU ORTALAMA
  const avg = student > 0 ? Math.round(revenue / student) : 0;

  return { student, revenue, avg };
}, [targets.yearly]);


  // ✅ Input değiştiriciler (ARTIK CLAMP YOK → rahat yaz)
  function setMonthly(scope: ScopeKey, field: keyof TargetNums, value: any) {
    setTargets((prev) => {
      const next: TargetsDoc = JSON.parse(JSON.stringify(prev));
      ensureMonthTargets(next, month);
      (next.monthly[monthKey][scope] as any)[field] = value; // ✅ string kalabilir
      return next;
    });
  }

  function setYearly(scope: ScopeKey, field: keyof TargetNums, value: any) {
    setTargets((prev) => {
      const next: TargetsDoc = JSON.parse(JSON.stringify(prev));
      (next.yearly[scope] as any)[field] = value; // ✅ string kalabilir
      return next;
    });
  }

  // ✅ Kaydet: targets/{year} merge
  async function saveTargets() {
    setSaving(true);
    setStatus("");

    try {
      const ref = doc(db as any, "targets", String(year));

      // ✅ Kaydetmeden önce temizle: UI string olabilir ama Firestore'a number gider
      const cleanedYearly = {
        lgs: cleanNums(targets.yearly.lgs),
        plus: cleanNums(targets.yearly.plus),
        vip: cleanNums(targets.yearly.vip),
      };

      const payload: any = {
        year,
        yearly: cleanedYearly,
        updatedAt: serverTimestamp(),
      };

      if (!monthLocked) {
        const cleanedMonthly = {
          lgs: cleanNums(monthlyTargets.lgs),
          plus: cleanNums(monthlyTargets.plus),
          vip: cleanNums(monthlyTargets.vip),
        };

        payload.monthly = {
          ...(targets.monthly ?? {}),
          [monthKey]: cleanedMonthly,
        };
      } else {
        // kilitliyse monthly dokunmuyoruz
        payload.monthly = targets.monthly ?? {};
      }

      await setDoc(ref, payload, { merge: true });
      setStatus("✅ Kaydedildi");
    } catch (e: any) {
      setStatus(`❌ Kaydedilemedi: ${e?.message ?? "Bilinmeyen hata"}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 24, color: "white" }}>Yükleniyor…</div>;
  }

  const monthsTR = [
    "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
    "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık",
  ];

  // Render helpers
  function TargetCard({
    title,
    subtitle,
    locked,
    t,
    r,
    onChange,
  }: {
    title: string;
    subtitle: string;
    locked: boolean;
    t: TargetNums;
    r: { studentCount: number; totalRevenue: number; avgRevenue: number };
    onChange: (field: keyof TargetNums, value: any) => void;
  }) {
    // ✅ hesaplarda güvenli olması için burada da sayıya çeviriyoruz
    const tClean = cleanNums(t);

    const pStudent = pct(r.studentCount, tClean.student);
    const pRevenue = pct(r.totalRevenue, tClean.revenue);
    const pAvg = pct(r.avgRevenue, tClean.avg);

    return (
      <div style={cardStyle}>
        <div style={titleStyle}>{title}</div>
        <div style={subTitleStyle}>{subtitle}</div>

        <div style={rowStyle}>
          <span>👥 Öğrenci hedefi</span>
          <input
            disabled={locked}
            style={{ ...inputStyle, opacity: locked ? 0.5 : 1 }}
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={t.student ?? ""}
            onChange={(e) => onChange("student", e.target.value)}
          />
        </div>

        <div style={rowStyle}>
          <span>💰 Ciro hedefi</span>
          <input
            disabled={locked}
            style={{ ...inputStyle, opacity: locked ? 0.5 : 1 }}
            type="text"
            inputMode="numeric"
            placeholder="₺"
            value={t.revenue ?? ""}
            onChange={(e) => onChange("revenue", e.target.value)}
          />
        </div>

        <div style={rowStyle}>
          <span>📊 Ortalama hedefi</span>
          <input
            disabled={locked}
            style={{ ...inputStyle, opacity: locked ? 0.5 : 1 }}
            type="text"
            inputMode="numeric"
            placeholder="₺"
            value={t.avg ?? ""}
            onChange={(e) => onChange("avg", e.target.value)}
          />
        </div>

        <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
          <div style={rowStyle}>
            <span>Gerçekleşen öğrenci</span>
            <strong>{r.studentCount}</strong>
          </div>
          <div style={rowStyle}>
            <span>Gerçekleşen ciro</span>
            <strong>{fmtMoney(r.totalRevenue)}</strong>
          </div>
          <div style={rowStyle}>
            <span>Gerçekleşen ortalama</span>
            <strong>{r.avgRevenue === 0 ? "—" : fmtMoney(Math.round(r.avgRevenue))}</strong>
          </div>

          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: statusColor(pStudent), fontWeight: 700 }}>
              Öğrenci %: {pStudent === null ? "—" : `${pStudent.toFixed(0)}%`}
            </div>
            <div style={{ color: statusColor(pRevenue), fontWeight: 700 }}>
              Ciro %: {pRevenue === null ? "—" : `${pRevenue.toFixed(0)}%`}
            </div>
            <div style={{ color: statusColor(pAvg), fontWeight: 700 }}>
              Ortalama %: {pAvg === null ? "—" : `${pAvg.toFixed(0)}%`}
            </div>

            {locked && (
              <div style={{ color: "#9ca3af", marginTop: 6 }}>
                🔒 Bu ay henüz gelmediği için hedef girişi kilitli.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function TotalCard({
    title,
    subtitle,
    t,
    r,
  }: {
    title: string;
    subtitle: string;
    t: { student: number; revenue: number; avg: number };
    r: { studentCount: number; totalRevenue: number; avgRevenue: number };
  }) {
    const pStudent = pct(r.studentCount, t.student);
    const pRevenue = pct(r.totalRevenue, t.revenue);
    const pAvg = pct(r.avgRevenue, t.avg);

    return (
      <div style={cardStyle}>
        <div style={titleStyle}>{title}</div>
        <div style={subTitleStyle}>{subtitle}</div>

        <div style={rowStyle}>
          <span>🎯 Öğrenci hedefi</span>
          <strong>{t.student || "—"}</strong>
        </div>
        <div style={rowStyle}>
          <span>🎯 Ciro hedefi</span>
          <strong>{t.revenue ? fmtMoney(t.revenue) : "—"}</strong>
        </div>
        <div style={rowStyle}>
          <span>🎯 Ortalama hedefi</span>
          <strong>{t.avg ? fmtMoney(t.avg) : "—"}</strong>
        </div>

        <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
          <div style={rowStyle}>
            <span>Gerçekleşen öğrenci</span>
            <strong>{r.studentCount}</strong>
          </div>
          <div style={rowStyle}>
            <span>Gerçekleşen ciro</span>
            <strong>{fmtMoney(r.totalRevenue)}</strong>
          </div>
          <div style={rowStyle}>
            <span>Gerçekleşen ortalama</span>
            <strong>{r.avgRevenue === 0 ? "—" : fmtMoney(Math.round(r.avgRevenue))}</strong>
          </div>

          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: statusColor(pStudent), fontWeight: 800 }}>
              Öğrenci %: {pStudent === null ? "—" : `${pStudent.toFixed(0)}%`}
            </div>
            <div style={{ color: statusColor(pRevenue), fontWeight: 800 }}>
              Ciro %: {pRevenue === null ? "—" : `${pRevenue.toFixed(0)}%`}
            </div>
            <div style={{ color: statusColor(pAvg), fontWeight: 800 }}>
              Ortalama %: {pAvg === null ? "—" : `${pAvg.toFixed(0)}%`}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, color: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>🎯 Hedefler</h2>
          <div style={{ color: "#9ca3af", marginTop: 6 }}>
            Gerçekleşen veriler <strong>records</strong> koleksiyonundan otomatik hesaplanır.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            Yıl:
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(clampNumber(e.target.value))}
              style={{ ...inputStyle, width: 90 }}
            />
          </label>

          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            Ay:
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              style={{ ...inputStyle, width: 140 }}
            >
              {monthsTR.map((m, i) => (
                <option key={i} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <button onClick={saveTargets} style={{ ...buttonStyle, opacity: saving ? 0.7 : 1 }} disabled={saving}>
            {saving ? "Kaydediliyor..." : "💾 Kaydet"}
          </button>
        </div>
      </div>

      {targetsLoading && <div style={{ marginTop: 12, color: "#9ca3af" }}>Hedefler okunuyor…</div>}
      {status && <div style={{ marginTop: 12, color: status.includes("❌") ? "#ef4444" : "#22c55e" }}>{status}</div>}

      {/* ================= MONTHLY ================= */}
      <h3 style={{ marginTop: 28, marginBottom: 0 }}>📅 Aylık Hedefler — {monthsTR[month]} {year}</h3>
      <div style={{ color: "#9ca3af", marginTop: 6 }}>
        Aylık hedefler ayı gelmeden girilemez. (kilit: {monthLocked ? "Açık" : "Kapalı"})
      </div>

      <div style={gridStyle}>
        <TargetCard
          title="Mefkure LGS"
          subtitle="Aylık hedef & gerçekleşen"
          locked={monthLocked}
          t={monthlyTargets.lgs}
          r={realizedMonth.lgs}
          onChange={(field, value) => setMonthly("lgs", field, value)}
        />
        <TargetCard
          title="Mefkure Plus"
          subtitle="Aylık hedef & gerçekleşen"
          locked={monthLocked}
          t={monthlyTargets.plus}
          r={realizedMonth.plus}
          onChange={(field, value) => setMonthly("plus", field, value)}
        />
        <TargetCard
          title="Mefkure Vip"
          subtitle="Aylık hedef & gerçekleşen"
          locked={monthLocked}
          t={monthlyTargets.vip}
          r={realizedMonth.vip}
          onChange={(field, value) => setMonthly("vip", field, value)}
        />
        <TotalCard
          title="TOPLAM"
          subtitle="Aylık otomatik toplam"
          t={monthlyTargetTotal}
          r={realizedMonthTotal}
        />
      </div>

      {/* ================= YEARLY ================= */}
      <h3 style={{ marginTop: 40, marginBottom: 0 }}>📈 Yıllık Hedefler — {year}</h3>
      <div style={{ color: "#9ca3af", marginTop: 6 }}>
        Yıllık hedefler aylıktan bağımsızdır. Toplamlar otomatik hesaplanır.
      </div>

      <div style={gridStyle}>
        <TargetCard
          title="Mefkure LGS"
          subtitle="Yıllık hedef & gerçekleşen"
          locked={false}
          t={targets.yearly.lgs}
          r={realizedYear.lgs}
          onChange={(field, value) => setYearly("lgs", field, value)}
        />
        <TargetCard
          title="Mefkure Plus"
          subtitle="Yıllık hedef & gerçekleşen"
          locked={false}
          t={targets.yearly.plus}
          r={realizedYear.plus}
          onChange={(field, value) => setYearly("plus", field, value)}
        />
        <TargetCard
          title="Mefkure Vip"
          subtitle="Yıllık hedef & gerçekleşen"
          locked={false}
          t={targets.yearly.vip}
          r={realizedYear.vip}
          onChange={(field, value) => setYearly("vip", field, value)}
        />
        <TotalCard
          title="TOPLAM"
          subtitle="Yıllık otomatik toplam"
          t={yearlyTargetTotal}
          r={realizedYearTotal}
        />
      </div>

      <div style={{ marginTop: 18, color: "#9ca3af", fontSize: 13 }}>
        Not: Gerçekleşen “ortalama” değerleri sistemden hesaplanır (ciro / öğrenci).
      </div>
    </div>
  );
}
