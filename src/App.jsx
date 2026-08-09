import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Check, X, RefreshCw, Sunrise, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  documentId,
  getDocs,
} from "firebase/firestore";

const ROSTER = [
  "力豪", "士弘", "元佑", "尹連", "伃汛", "宏維", "宗甫", "欣儒", "泳呈",
  "冠銘", "威佑", "彥仁", "思嘉", "施信宏", "哲維", "御民", "逢啓", "喬麒",
  "喬麟", "惠鈞", "雅美", "瑋淳", "聖偉", "詩婷", "騏彬", "柏賢",
];

const AVATAR_COLORS = [
  { bg: "#DCE8DF", fg: "#3F6650" },
  { bg: "#F4E1C6", fg: "#8A5A25" },
  { bg: "#DCE3EC", fg: "#3E5776" },
  { bg: "#F0D9D2", fg: "#96482F" },
  { bg: "#E5DCEE", fg: "#5F4180" },
];

function hashColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayLabel() {
  const d = new Date();
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（星期${weekday}）`;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function monthKeyOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(monthStr, delta) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyOf(d);
}

function monthLabel(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  return `${y}年${m}月`;
}

function SunArc({ percent }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(percent, 100) / 100) * c;
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" style={{ transform: "rotate(-90deg)" }}>
      <circle cx="66" cy="66" r={r} fill="none" stroke="#E2E0D4" strokeWidth="10" />
      <circle
        cx="66"
        cy="66"
        r={r}
        fill="none"
        stroke="url(#sunGrad)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <defs>
        <linearGradient id="sunGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F2A93B" />
          <stop offset="100%" stopColor="#E2703F" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function App() {
  const [view, setView] = useState("checkin");
  const [checkins, setCheckins] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalPerson, setModalPerson] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState(null);
  const [reportMonth, setReportMonth] = useState(monthKeyOf(new Date()));
  const [monthlyRecords, setMonthlyRecords] = useState({});
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const dateKey = todayKey();
  const todayDocRef = doc(db, "checkins", dateKey);

  // 即時監聽今日的報到資料（取代原本的 window.storage 輪詢）
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      todayDocRef,
      (snap) => {
        setCheckins(snap.exists() ? snap.data() : {});
        setLoading(false);
        setLastSync(new Date());
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsub();
  }, [dateKey]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const loadMonthlyData = useCallback(async (monthStr) => {
    setMonthlyLoading(true);
    try {
      const monthStart = `${monthStr}-01`;
      const monthEnd = `${shiftMonth(monthStr, 1)}-01`;
      const q = query(
        collection(db, "checkins"),
        where(documentId(), ">=", monthStart),
        where(documentId(), "<", monthEnd)
      );
      const snap = await getDocs(q);
      const obj = {};
      snap.forEach((d) => {
        obj[d.id] = d.data();
      });
      setMonthlyRecords(obj);
    } catch (e) {
      setMonthlyRecords({});
    } finally {
      setMonthlyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "monthly") loadMonthlyData(reportMonth);
  }, [view, reportMonth, loadMonthlyData]);

  const submit = async (name, status) => {
    setSaving(true);
    try {
      await setDoc(todayDocRef, { [name]: { status, time: nowTime() } }, { merge: true });
      setModalPerson(null);
      setToast(`${name} 已完成報到`);
    } catch (e) {
      setToast("送出失敗，請再試一次");
    } finally {
      setSaving(false);
    }
  };

  const doDeleteToday = async () => {
    try {
      await deleteDoc(todayDocRef);
      setConfirmReset(false);
      setToast("今日資料已清除");
    } catch (e) {
      setToast("清除失敗，請再試一次");
    }
  };

  const doneCount = Object.keys(checkins).length;
  const absentees = useMemo(() => ROSTER.filter((n) => !checkins[n]), [checkins]);
  const completed = useMemo(() => ROSTER.filter((n) => checkins[n]), [checkins]);
  const abnormalCount = useMemo(
    () => ROSTER.filter((n) => checkins[n]?.status === "異常").length,
    [checkins]
  );
  const percent = ROSTER.length ? Math.round((doneCount / ROSTER.length) * 100) : 0;

  const monthDates = useMemo(() => Object.keys(monthlyRecords).sort(), [monthlyRecords]);
  const totalDays = monthDates.length;

  const monthlyStats = useMemo(() => {
    const stats = {};
    ROSTER.forEach((n) => {
      stats[n] = { present: 0, abnormal: 0 };
    });
    monthDates.forEach((date) => {
      const day = monthlyRecords[date] || {};
      Object.keys(day).forEach((name) => {
        if (!stats[name]) stats[name] = { present: 0, abnormal: 0 };
        stats[name].present += 1;
        if (day[name].status === "異常") stats[name].abnormal += 1;
      });
    });
    return stats;
  }, [monthlyRecords, monthDates]);

  const monthlyAbnormalTotal = useMemo(
    () =>
      monthDates.reduce(
        (sum, d) => sum + Object.values(monthlyRecords[d] || {}).filter((r) => r.status === "異常").length,
        0
      ),
    [monthDates, monthlyRecords]
  );

  const avgAttendanceRate = useMemo(() => {
    if (!totalDays || !ROSTER.length) return 0;
    const presentSum = ROSTER.reduce((sum, n) => sum + (monthlyStats[n]?.present || 0), 0);
    return Math.round((presentSum / (ROSTER.length * totalDays)) * 100);
  }, [monthlyStats, totalDays]);

  const monthlyRows = useMemo(() => {
    return ROSTER.map((n) => {
      const present = monthlyStats[n]?.present || 0;
      const abnormal = monthlyStats[n]?.abnormal || 0;
      const absent = totalDays - present;
      const rate = totalDays ? Math.round((present / totalDays) * 100) : 0;
      return { name: n, present, absent, abnormal, rate };
    }).sort((a, b) => a.rate - b.rate);
  }, [monthlyStats, totalDays]);

  const exportCsv = () => {
    const header = ["姓名", "出席天數", "未出席天數", "異常次數", "出席率"];
    const rows = monthlyRows.map((r) => [r.name, r.present, r.absent, r.abnormal, `${r.rate}%`]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `體溫報到月報表_${reportMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#EEF1EA", fontFamily: "'Noto Sans TC', sans-serif", color: "#2C3A34" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&family=JetBrains+Mono:wght@500;700&display=swap');
        * { box-sizing: border-box; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        button { font-family: inherit; cursor: pointer; }
        .tap:active { transform: scale(0.96); }
        .fadein { animation: fadein 0.25s ease; }
        @keyframes fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; animation: none !important; }
        }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #D3D6C8; border-radius: 8px; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E2E0D4" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "20px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sunrise size={22} color="#E2703F" />
                <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: 1 }}>晨光報到</h1>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7568" }}>{todayLabel()} · 每日體溫紀錄</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <SunArc percent={percent} />
              <div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
                  {doneCount}<span style={{ fontSize: 15, color: "#8A9188" }}> / {ROSTER.length}</span>
                </div>
                <div style={{ fontSize: 12, color: "#8A9188", marginTop: 4 }}>已完成報到</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginTop: 18 }}>
            {[
              { id: "checkin", label: "服務使用者報到" },
              { id: "dashboard", label: "工作人員後台" },
              { id: "monthly", label: "月報表" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                style={{
                  flex: 1,
                  padding: "12px 8px",
                  border: "none",
                  borderBottom: view === t.id ? "3px solid #E2703F" : "3px solid transparent",
                  background: "transparent",
                  fontSize: 15,
                  fontWeight: view === t.id ? 700 : 500,
                  color: view === t.id ? "#2C3A34" : "#8A9188",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 20px 80px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#8A9188" }}>載入中…</div>
        ) : view === "checkin" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: 14,
            }}
          >
            {ROSTER.map((name) => {
              const done = checkins[name];
              const color = hashColor(name);
              return (
                <button
                  key={name}
                  className="tap"
                  onClick={() => setModalPerson(name)}
                  style={{
                    border: done ? `2px solid ${done.status === "正常" ? "#4F7A5B" : "#B84C3C"}` : "2px solid #E2E0D4",
                    background: "#FFFFFF",
                    borderRadius: 16,
                    padding: "18px 10px 14px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    transition: "transform 0.1s ease",
                    position: "relative",
                  }}
                >
                  {done && (
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: done.status === "正常" ? "#4F7A5B" : "#B84C3C",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {done.status === "正常" ? <Check size={14} color="#fff" /> : <X size={14} color="#fff" />}
                    </div>
                  )}
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 999,
                      background: color.bg,
                      color: color.fg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      fontWeight: 700,
                    }}
                  >
                    {name[0]}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{name}</div>
                  {done && (
                    <div className="mono" style={{ fontSize: 11, color: "#8A9188" }}>
                      {done.time}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : view === "dashboard" ? (
          <div className="fadein">
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
              {[
                { label: "總人數", value: ROSTER.length, color: "#2C3A34" },
                { label: "已完成", value: doneCount, color: "#4F7A5B" },
                { label: "尚未出席", value: absentees.length, color: "#B84C3C" },
                { label: "異常通報", value: abnormalCount, color: "#B84C3C" },
              ].map((s) => (
                <div key={s.label} style={{ background: "#FFFFFF", border: "1px solid #E2E0D4", borderRadius: 14, padding: "16px 18px" }}>
                  <div style={{ fontSize: 12, color: "#8A9188", marginBottom: 6 }}>{s.label}</div>
                  <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Absentee list — auto detected, no manual comparison needed */}
            <div style={{ background: "#FBEFEC", border: "1px solid #E9C7BE", borderRadius: 16, padding: 18, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: "#96382A" }}>
                  ⚪ 尚未出席（{absentees.length}）
                </h2>
              </div>
              {absentees.length === 0 ? (
                <p style={{ fontSize: 13, color: "#96382A", margin: 0 }}>全員已完成報到 🎉</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {absentees.map((n) => (
                    <span
                      key={n}
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E9C7BE",
                        color: "#96382A",
                        borderRadius: 999,
                        padding: "6px 14px",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Completed list */}
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E0D4", borderRadius: 16, padding: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, margin: "0 0 12px" }}>✅ 已完成（{completed.length}）</h2>
              {completed.length === 0 ? (
                <p style={{ fontSize: 13, color: "#8A9188", margin: 0 }}>目前尚無人報到</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {completed
                    .slice()
                    .sort((a, b) => (checkins[a].time < checkins[b].time ? 1 : -1))
                    .map((n) => (
                      <div
                        key={n}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 10px",
                          borderRadius: 10,
                          background: checkins[n].status === "異常" ? "#FBEFEC" : "#F5F8F3",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {checkins[n].status === "正常" ? (
                            <Check size={16} color="#4F7A5B" />
                          ) : (
                            <X size={16} color="#B84C3C" />
                          )}
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{n}</span>
                          <span style={{ fontSize: 12, color: checkins[n].status === "異常" ? "#B84C3C" : "#4F7A5B" }}>
                            {checkins[n].status}
                          </span>
                        </div>
                        <span className="mono" style={{ fontSize: 12, color: "#8A9188" }}>{checkins[n].time}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Sync + reset row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#8A9188" }}>
                <RefreshCw size={13} />
                {lastSync && (
                  <span className="mono">
                    即時同步中 · 上次更新 {String(lastSync.getHours()).padStart(2, "0")}:{String(lastSync.getMinutes()).padStart(2, "0")}
                  </span>
                )}
              </div>
              <button
                className="tap"
                onClick={() => (confirmReset ? doDeleteToday() : setConfirmReset(true))}
                onBlur={() => setConfirmReset(false)}
                style={{
                  background: confirmReset ? "#B84C3C" : "#FFFFFF",
                  color: confirmReset ? "#fff" : "#B84C3C",
                  border: "1px solid #B84C3C",
                  borderRadius: 10,
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {confirmReset ? "再按一次確認清除今日資料" : "清除今日資料"}
              </button>
            </div>
          </div>
        ) : (
          <div className="fadein">
            {/* Month navigator */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  className="tap"
                  onClick={() => setReportMonth((m) => shiftMonth(m, -1))}
                  style={{ background: "#FFFFFF", border: "1px solid #E2E0D4", borderRadius: 10, padding: 8 }}
                >
                  <ChevronLeft size={16} />
                </button>
                <h2 style={{ fontSize: 17, fontWeight: 900, margin: "0 6px", minWidth: 88, textAlign: "center" }}>
                  {monthLabel(reportMonth)}
                </h2>
                <button
                  className="tap"
                  onClick={() => setReportMonth((m) => shiftMonth(m, 1))}
                  style={{ background: "#FFFFFF", border: "1px solid #E2E0D4", borderRadius: 10, padding: 8 }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <button
                className="tap"
                onClick={exportCsv}
                disabled={!totalDays}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: totalDays ? "#2C3A34" : "#C9CDC2",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "9px 14px",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                <Download size={14} /> 匯出 CSV
              </button>
            </div>

            {monthlyLoading ? (
              <div style={{ textAlign: "center", padding: 60, color: "#8A9188" }}>載入月度資料中…</div>
            ) : totalDays === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "#8A9188", background: "#FFFFFF", borderRadius: 16, border: "1px solid #E2E0D4" }}>
                {monthLabel(reportMonth)}尚無報到紀錄
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 18 }}>
                  {[
                    { label: "記錄天數", value: totalDays, color: "#2C3A34" },
                    { label: "平均出席率", value: `${avgAttendanceRate}%`, color: avgAttendanceRate >= 80 ? "#4F7A5B" : "#B84C3C" },
                    { label: "異常通報次數", value: monthlyAbnormalTotal, color: "#B84C3C" },
                  ].map((s) => (
                    <div key={s.label} style={{ background: "#FFFFFF", border: "1px solid #E2E0D4", borderRadius: 14, padding: "16px 18px" }}>
                      <div style={{ fontSize: 12, color: "#8A9188", marginBottom: 6 }}>{s.label}</div>
                      <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Per-person table */}
                <div style={{ background: "#FFFFFF", border: "1px solid #E2E0D4", borderRadius: 16, padding: 18, overflowX: "auto" }}>
                  <h2 style={{ fontSize: 16, fontWeight: 900, margin: "0 0 14px" }}>個人出席統計</h2>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 480 }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "#8A9188", borderBottom: "1px solid #E2E0D4" }}>
                        <th style={{ padding: "6px 8px", fontWeight: 600 }}>姓名</th>
                        <th style={{ padding: "6px 8px", fontWeight: 600 }}>出席</th>
                        <th style={{ padding: "6px 8px", fontWeight: 600 }}>未出席</th>
                        <th style={{ padding: "6px 8px", fontWeight: 600 }}>異常</th>
                        <th style={{ padding: "6px 8px", fontWeight: 600 }}>出席率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyRows.map((r) => (
                        <tr key={r.name} style={{ borderBottom: "1px solid #F0EFE6" }}>
                          <td style={{ padding: "8px", fontWeight: 700 }}>{r.name}</td>
                          <td style={{ padding: "8px" }} className="mono">{r.present}</td>
                          <td style={{ padding: "8px" }} className="mono">{r.absent}</td>
                          <td style={{ padding: "8px" }} className="mono">
                            {r.abnormal > 0 ? <span style={{ color: "#B84C3C", fontWeight: 700 }}>{r.abnormal}</span> : r.abnormal}
                          </td>
                          <td style={{ padding: "8px" }}>
                            <span
                              className="mono"
                              style={{
                                fontWeight: 700,
                                color: r.rate >= 80 ? "#4F7A5B" : r.rate >= 50 ? "#8A6A2F" : "#B84C3C",
                              }}
                            >
                              {r.rate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Check-in modal */}
      {modalPerson && (
        <div
          onClick={() => !saving && setModalPerson(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(44,58,52,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="fadein"
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              padding: 28,
              width: "100%",
              maxWidth: 360,
              textAlign: "center",
            }}
          >
            <button
              onClick={() => setModalPerson(null)}
              style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#8A9188", fontSize: 12, marginBottom: 8 }}
            >
              <ChevronLeft size={14} /> 返回
            </button>
            <div
              style={{
                width: 72,
                height: 72,
                margin: "0 auto 12px",
                borderRadius: 999,
                background: hashColor(modalPerson).bg,
                color: hashColor(modalPerson).fg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {modalPerson[0]}
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 4px" }}>{modalPerson}</h3>
            <p style={{ fontSize: 13, color: "#8A9188", margin: "0 0 20px" }}>請選擇今日體溫結果</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                disabled={saving}
                className="tap"
                onClick={() => submit(modalPerson, "正常")}
                style={{
                  flex: 1,
                  padding: "18px 0",
                  borderRadius: 16,
                  border: "none",
                  background: "#4F7A5B",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 26 }}>⭕</span> 正常
              </button>
              <button
                disabled={saving}
                className="tap"
                onClick={() => submit(modalPerson, "異常")}
                style={{
                  flex: 1,
                  padding: "18px 0",
                  borderRadius: 16,
                  border: "none",
                  background: "#B84C3C",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 26 }}>❌</span> 不舒服
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fadein"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#2C3A34",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 999,
            fontSize: 13,
            zIndex: 60,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
