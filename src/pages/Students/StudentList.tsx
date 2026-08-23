import { useState, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../store/AuthContext";
import { useRecords, type Kayit } from "../../hooks/useRecords";
import Modal from "../../components/ui/Modal";

const normalize = (s: any): string => {
  if (!s) return "";
  return String(s).toLocaleLowerCase('tr-TR').trim()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "");
};

// 📅 DEPOLAMA standardı GG.AA.YYYY — tüm raporlar bunu bekler.
// <input type="date"> ise YYYY-AA-GG ister.
const toInputDate = (s: string): string => {
  if (!s) return "";
  if (s.includes(".")) { const [d, m, y] = s.split("."); return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; }
  return s;
};
const toStoredDate = (s: string): string => {
  if (!s) return "";
  if (s.includes("-")) { const [y, m, d] = s.split("-"); return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`; }
  return s;
};

const hierarchy: any = {
  "mefkureyks": { branches: ["Mefkure PLUS", "Mefkure VIP"], grades: ["11", "12", "Mezun", "Mood"] },
  "mefkurelgs": { branches: ["Mefkure LGS"], grades: ["5", "6", "7", "8"] },
  "altinkureilkogretim": { branches: ["Altınküre Anaokulu", "Altınküre İlkokul", "Altınküre Ortaokul"], grades: ["Ana Sınıfı", "1", "2", "3", "4", "5", "6", "7", "8"] },
  "altinkurelise": { branches: ["Altınküre Fen Lisesi", "Altınküre Anadolu Lisesi", "Altınküre Akademi"], grades: ["9", "10", "11", "12", "Mezun", "Akademi"] },
  "altinkureteknokent": { branches: ["Altınküre Teknokent"], grades: ["9", "10", "11", "12"] }
};

const MEFKURE_KEYS = ["mefkureyks", "mefkurelgs"];
const MEFKURE_GROUP = {
  branches: ["Mefkure LGS", "Mefkure PLUS", "Mefkure VİP"],
  grades: ["5", "6", "7", "8", "9", "10", "11", "12", "Mezun", "Mood"]
};

type DonemSuzgeci = "2026" | "2025" | "hepsi";
type DurumSuzgeci = "aktif" | "iptal" | "hepsi";
type KaynakSuzgeci = "hepsi" | "manual" | "excel";

export default function StudentList() {
  const { user } = useAuth();
  const { tumKayitlar, loading, aktarimYapildi, sayim } = useRecords();

  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [iptalEdilen, setIptalEdilen] = useState<Kayit | null>(null);
  const [iptalNotu, setIptalNotu] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  // Liste varsayilan olarak icinde bulunulan donemi gosterir; gecen yilin
  // kayitlari tarihsel veridir, iptal islemi oraya uygulanmaz.
  const [donem, setDonem] = useState<DonemSuzgeci>("2026");
  const [durumSuzgeci, setDurumSuzgeci] = useState<DurumSuzgeci>("aktif");
  const [kaynakSuzgeci, setKaynakSuzgeci] = useState<KaynakSuzgeci>("hepsi");
  const [islemde, setIslemde] = useState<string | null>(null);

  const isAdmin = user?.role?.toLowerCase() === "admin" || user?.email === "ugur@asaf.com";

  const userSettings = useMemo(() => {
    const userBranchKey = user?.branchId ? normalize(user.branchId) : "";
    if (MEFKURE_KEYS.includes(userBranchKey)) return MEFKURE_GROUP;
    return hierarchy[userBranchKey] || { branches: [], grades: [] };
  }, [user]);

  const filteredList = useMemo(() => {
    const parseDate = (dateStr: string) => {
      if (!dateStr) return 0;
      if (dateStr.includes('.')) {
        const [d, m, y] = dateStr.split('.');
        return new Date(`${y}-${m}-${d}`).getTime() || 0;
      }
      return new Date(dateStr).getTime() || 0;
    };

    const kayitYili = (t: string) => String(t || "").split(".").pop() || "";

    const list = tumKayitlar.filter((r) => {
      // Donem suzgeci — sozlesme tarihinin yili
      if (donem !== "hepsi" && kayitYili(r.SözleşmeTarihi) !== donem) return false;

      // Yetki: admin hepsini, müdür kendi şubelerini görür
      const yetkili = isAdmin ||
        userSettings.branches.some((mb: string) => normalize(mb) === normalize(r.Okul || ""));
      if (!yetkili) return false;

      if (durumSuzgeci === "aktif" && r.KayıtDurumu === "İptal") return false;
      if (durumSuzgeci === "iptal" && r.KayıtDurumu !== "İptal") return false;

      if (kaynakSuzgeci === "manual" && r.kaynak !== "manual") return false;
      if (kaynakSuzgeci === "excel" && r.kaynak === "manual") return false;

      if (branchFilter !== "all" && normalize(r.Okul || "") !== normalize(branchFilter)) return false;

      if (searchTerm) {
        const q = normalize(searchTerm);
        return normalize(r.studentName).includes(q) || normalize(r.GittigiOkul || "").includes(q);
      }
      return true;
    });

    return list.sort((a, b) => parseDate(b.SözleşmeTarihi) - parseDate(a.SözleşmeTarihi));
  }, [tumKayitlar, isAdmin, userSettings, searchTerm, branchFilter, durumSuzgeci, kaynakSuzgeci, donem]);

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "-";
    if (dateStr.includes('-')) { const [y, m, d] = dateStr.split('-'); return `${d}.${m}.${y}`; }
    return dateStr;
  };

  const handleUpdate = async (e: any) => {
    e.preventDefault();
    setIslemde(editingStudent.id);
    try {
      const isMefkure = (editingStudent.Okul || "").toLocaleLowerCase('tr-TR').includes("mefkure");
      await updateDoc(doc(db, "records", editingStudent.id), {
        studentName: editingStudent.studentName,
        SözleşmeTarihi: toStoredDate(editingStudent.SözleşmeTarihi),
        Okul: editingStudent.Okul,
        Sınıf: editingStudent.Sınıf,
        SonTutar: Number(editingStudent.SonTutar),
        ...(isMefkure ? { GittigiOkul: editingStudent.GittigiOkul || "" } : {})
      });
      setEditingStudent(null);
    } catch {
      alert("Kayıt güncellenemedi.");
    } finally {
      setIslemde(null);
    }
  };

  /** Kayıt silinmez — iptal durumuna geçer. Böylece geçmiş korunur,
      istatistiklerden düşer ve gerekirse geri alınabilir. */
  const iptalEt = async () => {
    if (!iptalEdilen) return;
    setIslemde(iptalEdilen.id);
    try {
      await updateDoc(doc(db, "records", iptalEdilen.id), {
        KayıtDurumu: "İptal",
        iptalTarihi: new Date().toISOString(),
        iptalEden: user?.displayName || user?.email || "bilinmiyor",
        iptalNotu: iptalNotu.trim(),
      });
      setIptalEdilen(null);
      setIptalNotu("");
    } catch {
      alert("İptal işlemi başarısız.");
    } finally {
      setIslemde(null);
    }
  };

  const geriAl = async (k: Kayit) => {
    setIslemde(k.id);
    try {
      await updateDoc(doc(db, "records", k.id), {
        KayıtDurumu: "Aktif",
        iptalTarihi: "",
        iptalEden: "",
        iptalNotu: "",
      });
    } catch {
      alert("Geri alma başarısız.");
    } finally {
      setIslemde(null);
    }
  };

  if (loading) {
    return <div className="page" style={{ textAlign: "center", paddingTop: "var(--sp-7)", color: "var(--text-2)" }}>Yükleniyor…</div>;
  }

  return (
    <div className="page rise" style={{ maxWidth: 800 }}>
      <h1>Kayıt Listesi</h1>

      {/* Aktarım yapılmadıysa sabit kayıtlar salt okunur — nedeni açıkça yazılıyor */}
      {!aktarimYapildi && (
        <div style={uyariKutusu}>
          Sabit kayıtlar şu an uygulamanın içine gömülü dosyadan geliyor; bu yüzden
          <strong> düzenlenemez ve iptal edilemez</strong>.
          {isAdmin
            ? " Veri Aktarımı sayfasından bir kez aktarım yapıldığında hepsi düzenlenebilir hale gelir."
            : " Yöneticinin veri aktarımı yapması gerekiyor."}
        </div>
      )}

      {/* Süzgeçler */}
      <div style={{ display: "grid", gap: "var(--sp-3)", marginBottom: "var(--sp-5)" }}>
        <input
          placeholder="Öğrenci adı veya gittiği okul ara…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
          <SegmentliSecim
            deger={donem}
            degistir={(v) => setDonem(v as DonemSuzgeci)}
            secenekler={[
              { deger: "2026", etiket: "2026 Dönemi" },
              { deger: "2025", etiket: "2025 Dönemi" },
              { deger: "hepsi", etiket: "Tüm Dönemler" },
            ]}
          />
          <SegmentliSecim
            deger={durumSuzgeci}
            degistir={(v) => setDurumSuzgeci(v as DurumSuzgeci)}
            secenekler={[
              { deger: "aktif", etiket: "Aktif" },
              { deger: "iptal", etiket: `İptal${sayim.iptal ? ` (${sayim.iptal})` : ""}` },
              { deger: "hepsi", etiket: "Hepsi" },
            ]}
          />
          <SegmentliSecim
            deger={kaynakSuzgeci}
            degistir={(v) => setKaynakSuzgeci(v as KaynakSuzgeci)}
            secenekler={[
              { deger: "hepsi", etiket: "Tümü" },
              { deger: "manual", etiket: "Manuel" },
              { deger: "excel", etiket: "Sabit" },
            ]}
          />
        </div>
        {userSettings.branches.length > 1 && (
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
            <option value="all">Tüm Gruplar</option>
            {userSettings.branches.map((b: string) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
      </div>

      <div className="caption" style={{ marginBottom: "var(--sp-3)" }}>
        {filteredList.length} kayıt gösteriliyor
      </div>

      <div style={{ display: "grid", gap: "var(--sp-3)" }}>
        {filteredList.map((s) => {
          const iptalli = s.KayıtDurumu === "İptal";
          const duzenlenebilir = s.kaynak !== "json";
          const mesgul = islemde === s.id;

          return (
            <div key={s.id} className="card" style={{ padding: "var(--sp-4)", opacity: iptalli ? 0.6 : 1 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--sp-3)", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, textDecoration: iptalli ? "line-through" : "none" }}>
                      {s.studentName || "—"}
                    </span>
                    <Rozet
                      metin={s.kaynak === "manual" ? "Manuel" : "Sabit"}
                      renk={s.kaynak === "manual" ? "var(--accent)" : "var(--text-3)"}
                    />
                    {iptalli && <Rozet metin="İptal" renk="var(--danger)" />}
                  </div>

                  <div className="caption" style={{ marginTop: "var(--sp-1)" }}>
                    {formatDateDisplay(s.SözleşmeTarihi)} · {s.Okul} · {s.Sınıf}. sınıf ·{" "}
                    <span className="num">₺{s.SonTutar?.toLocaleString("tr-TR")}</span>
                  </div>

                  {s.GittigiOkul && (
                    <div className="caption" style={{ color: "var(--accent)", marginTop: "var(--sp-1)" }}>
                      Gittiği okul: {s.GittigiOkul}
                    </div>
                  )}

                  {iptalli && s.iptalEden && (
                    <div className="caption" style={{ color: "var(--danger)", marginTop: "var(--sp-1)" }}>
                      {new Date(s.iptalTarihi || "").toLocaleDateString("tr-TR")} tarihinde {s.iptalEden} iptal etti
                      {s.iptalNotu ? ` — ${s.iptalNotu}` : ""}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                  {!duzenlenebilir ? (
                    <span className="caption" style={{ alignSelf: "center" }}>aktarım bekliyor</span>
                  ) : iptalli ? (
                    <button onClick={() => geriAl(s)} disabled={mesgul} style={btnGeriAl}>
                      {mesgul ? "…" : "Geri Al"}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditingStudent({ ...s, SözleşmeTarihi: toInputDate(s.SözleşmeTarihi) })}
                        disabled={mesgul}
                        style={btnEdit}
                      >
                        Düzenle
                      </button>
                      <button onClick={() => { setIptalEdilen(s); setIptalNotu(""); }} disabled={mesgul} style={btnIptal}>
                        İptal Et
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredList.length === 0 && (
          <div style={{ textAlign: "center", padding: "var(--sp-6)", color: "var(--text-3)" }}>
            Kayıt bulunamadı.
          </div>
        )}
      </div>

      {/* İptal onayı */}
      <Modal
        open={!!iptalEdilen}
        onClose={() => setIptalEdilen(null)}
        title="Kaydı İptal Et"
        footer={
          <>
            <button onClick={iptalEt} disabled={!!islemde} style={btnIptalOnay}>
              {islemde ? "İşleniyor…" : "İptal Et"}
            </button>
            <button onClick={() => setIptalEdilen(null)} style={btnVazgec}>Vazgeç</button>
          </>
        }
      >
        <p style={{ marginBottom: "var(--sp-4)" }}>
          <strong style={{ color: "var(--text)" }}>{iptalEdilen?.studentName}</strong> kaydı iptal
          edilecek. Kayıt silinmez; öğrenci sayısı ve cirodan düşer, listede “İptal” olarak kalır ve
          istenirse geri alınabilir.
        </p>
        <label className="caption" style={{ display: "block", marginBottom: "var(--sp-2)" }}>
          Sebep (isteğe bağlı)
        </label>
        <input
          value={iptalNotu}
          onChange={(e) => setIptalNotu(e.target.value)}
          placeholder="Örn. veli talebiyle kayıt sildirildi"
        />
      </Modal>

      {/* Düzenleme */}
      <Modal
        open={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        title="Kaydı Düzenle"
        footer={
          <>
            <button onClick={handleUpdate} disabled={!!islemde} style={btnKaydet}>
              {islemde ? "Kaydediliyor…" : "Kaydet"}
            </button>
            <button onClick={() => setEditingStudent(null)} style={btnVazgec}>Vazgeç</button>
          </>
        }
      >
        {editingStudent && (
          <div style={{ display: "grid", gap: "var(--sp-3)" }}>
            <Alan etiket="Öğrenci Adı">
              <input value={editingStudent.studentName || ""} onChange={e => setEditingStudent({ ...editingStudent, studentName: e.target.value })} />
            </Alan>

            <div style={{ display: "flex", gap: "var(--sp-3)" }}>
              <Alan etiket="Okul / Şube" style={{ flex: 1 }}>
                <select value={editingStudent.Okul || ""} onChange={e => setEditingStudent({ ...editingStudent, Okul: e.target.value })}>
                  <option value="">Seçiniz…</option>
                  {userSettings.branches.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Alan>
              <Alan etiket="Sınıf" style={{ width: 110 }}>
                <select value={editingStudent.Sınıf || ""} onChange={e => setEditingStudent({ ...editingStudent, Sınıf: e.target.value })}>
                  <option value="">Seç…</option>
                  {userSettings.grades.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Alan>
            </div>

            {(editingStudent.Okul || "").toLocaleLowerCase('tr-TR').includes("mefkure") && (
              <Alan etiket="Gittiği Okul (isteğe bağlı)">
                <input value={editingStudent.GittigiOkul || ""} onChange={e => setEditingStudent({ ...editingStudent, GittigiOkul: e.target.value })} />
              </Alan>
            )}

            <div style={{ display: "flex", gap: "var(--sp-3)" }}>
              <Alan etiket="Sözleşme Tarihi" style={{ flex: 1 }}>
                <input type="date" value={editingStudent.SözleşmeTarihi || ""} onChange={e => setEditingStudent({ ...editingStudent, SözleşmeTarihi: e.target.value })} />
              </Alan>
              <Alan etiket="Tutar (TL)" style={{ flex: 1 }}>
                <input type="number" value={editingStudent.SonTutar || ""} onChange={e => setEditingStudent({ ...editingStudent, SonTutar: e.target.value })} />
              </Alan>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---- küçük parçalar ---- */
function Rozet({ metin, renk }: { metin: string; renk: string }) {
  return (
    <span style={{
      fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
      color: renk, border: `1px solid color-mix(in srgb, ${renk} 40%, transparent)`,
      background: `color-mix(in srgb, ${renk} 12%, transparent)`,
      padding: "2px 6px", borderRadius: "var(--r-full)", whiteSpace: "nowrap",
    }}>{metin}</span>
  );
}

function Alan({ etiket, children, style }: { etiket: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label className="caption" style={{ display: "block", marginBottom: "var(--sp-1)" }}>{etiket}</label>
      {children}
    </div>
  );
}

function SegmentliSecim({ deger, degistir, secenekler }: {
  deger: string; degistir: (v: string) => void;
  secenekler: { deger: string; etiket: string }[];
}) {
  return (
    <div style={{ display: "inline-flex", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 2 }}>
      {secenekler.map((s) => (
        <button
          key={s.deger}
          onClick={() => degistir(s.deger)}
          style={{
            border: "none", borderRadius: "var(--r-sm)", padding: "var(--sp-2) var(--sp-3)",
            fontSize: "0.78rem", fontWeight: 600, whiteSpace: "nowrap",
            background: deger === s.deger ? "var(--surface-raised)" : "transparent",
            color: deger === s.deger ? "var(--text)" : "var(--text-3)",
            boxShadow: deger === s.deger ? "inset 0 1px 0 var(--material-edge)" : "none",
          }}
        >
          {s.etiket}
        </button>
      ))}
    </div>
  );
}

/* ---- stiller ---- */
const uyariKutusu: React.CSSProperties = {
  background: "color-mix(in srgb, var(--warning) 10%, transparent)",
  border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)",
  color: "var(--text-2)", padding: "var(--sp-3) var(--sp-4)",
  borderRadius: "var(--r-md)", fontSize: "0.85rem", lineHeight: 1.6,
  marginBottom: "var(--sp-5)",
};
const btnEdit: React.CSSProperties = { background: "var(--accent)", color: "var(--accent-ink)", border: "none", padding: "var(--sp-2) var(--sp-3)", borderRadius: "var(--r-sm)", fontWeight: 600, fontSize: "0.82rem" };
const btnIptal: React.CSSProperties = { background: "transparent", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 45%, transparent)", padding: "var(--sp-2) var(--sp-3)", borderRadius: "var(--r-sm)", fontWeight: 600, fontSize: "0.82rem" };
const btnGeriAl: React.CSSProperties = { background: "transparent", color: "var(--success)", border: "1px solid color-mix(in srgb, var(--success) 45%, transparent)", padding: "var(--sp-2) var(--sp-3)", borderRadius: "var(--r-sm)", fontWeight: 600, fontSize: "0.82rem" };
const btnIptalOnay: React.CSSProperties = { flex: 1, background: "var(--danger)", color: "var(--text)", border: "none", padding: "var(--sp-3)", borderRadius: "var(--r-sm)", fontWeight: 700 };
const btnKaydet: React.CSSProperties = { flex: 1, background: "var(--accent)", color: "var(--accent-ink)", border: "none", padding: "var(--sp-3)", borderRadius: "var(--r-sm)", fontWeight: 700 };
const btnVazgec: React.CSSProperties = { flex: 1, background: "var(--surface-raised)", color: "var(--text-2)", border: "1px solid var(--line)", padding: "var(--sp-3)", borderRadius: "var(--r-sm)", fontWeight: 600 };
