"use client";
import { useState } from "react";
import {
  Calendar, Clock, Youtube, CheckCircle, XCircle, Plus, Edit2,
  Trash2, Upload, ChevronLeft, ChevronRight, Zap, BarChart2, Tag
} from "lucide-react";

type Schedule = {
  id: string; title: string; channel: string; date: string; time: string;
  status: "scheduled" | "uploaded" | "failed"; category: string;
  thumbnail_color: string; views?: string;
};

const INIT_SCHEDULES: Schedule[] = [
  { id: "1", title: "[한국어 자막] 완벽한 파스타 만드는 법 Gordon Ramsay", channel: "요리채널 KR", date: "2025-04-02", time: "19:00", status: "scheduled", category: "요리", thumbnail_color: "#b71c1c" },
  { id: "2", title: "[한국어 자막] 영어 기초 문법 총정리 - 초급자 필수", channel: "English World KR", date: "2025-04-03", time: "18:00", status: "scheduled", category: "교육", thumbnail_color: "#1a237e" },
  { id: "3", title: "[한국어 자막] 도쿄 숨겨진 명소 완벽 가이드", channel: "여행채널 KR", date: "2025-04-01", time: "10:00", status: "uploaded", category: "여행", thumbnail_color: "#0d47a1", views: "12,430" },
  { id: "4", title: "[한국어 자막] 블랙홀의 과학적 비밀 총정리", channel: "사이언스 KR", date: "2025-03-30", time: "20:00", status: "uploaded", category: "과학", thumbnail_color: "#311b92", views: "8,922" },
  { id: "5", title: "[한국어 자막] 집에서 만드는 홈카페 레시피 BEST 10", channel: "요리채널 KR", date: "2025-04-04", time: "14:00", status: "scheduled", category: "요리", thumbnail_color: "#4e342e" },
  { id: "6", title: "[한국어 자막] 2025년 미국 경제 전망 핵심 정리", channel: "뉴스채널 KR", date: "2025-03-29", time: "09:00", status: "failed", category: "뉴스", thumbnail_color: "#33691e" },
];

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const CHANNELS = ["요리채널 KR", "English World KR", "여행채널 KR", "사이언스 KR", "뉴스채널 KR"];
const TIMES = ["06:00", "08:00", "10:00", "12:00", "14:00", "18:00", "19:00", "20:00", "21:00"];

export default function SchedulerPage() {
  const [schedules, setSchedules] = useState<Schedule[]>(INIT_SCHEDULES);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [showModal, setShowModal] = useState(false);
  const [currentMonth] = useState(new Date(2025, 3));

  const [newItem, setNewItem] = useState({
    title: "", channel: CHANNELS[0], date: "", time: "19:00", category: "교육"
  });

  const addSchedule = () => {
    const item: Schedule = {
      id: Date.now().toString(), ...newItem, status: "scheduled",
      thumbnail_color: ["#b71c1c", "#1a237e", "#0d47a1", "#311b92"][Math.floor(Math.random() * 4)]
    };
    setSchedules([...schedules, item]);
    setShowModal(false);
    setNewItem({ title: "", channel: CHANNELS[0], date: "", time: "19:00", category: "교육" });
  };

  const deleteSchedule = (id: string) => setSchedules(s => s.filter(x => x.id !== id));

  const statusBadge = (status: Schedule["status"]) => {
    if (status === "scheduled") return <span className="badge badge-blue">예약됨</span>;
    if (status === "uploaded") return <span className="badge badge-green">업로드 완료</span>;
    return <span className="badge badge-red">실패</span>;
  };

  // Calendar grid
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const scheduledDates = new Set(schedules.map(s => s.date));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>업로드 스케줄러 📅</h1>
          <p style={{ color: "#71717a" }}>영상을 최적 시간대에 자동으로 예약 업로드합니다</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ display: "flex", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            {(["list", "calendar"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{
                  padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500,
                  background: view === v ? "rgba(239,68,68,0.15)" : "transparent",
                  color: view === v ? "#f87171" : "#71717a", transition: "all 0.2s"
                }}>
                {v === "list" ? "목록" : "캘린더"}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)}
            style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={18} /> 일정 추가
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[
          { label: "전체 예약", val: schedules.length, color: "#3b82f6" },
          { label: "예약됨", val: schedules.filter(s => s.status === "scheduled").length, color: "#f97316" },
          { label: "업로드 완료", val: schedules.filter(s => s.status === "uploaded").length, color: "#22c55e" },
          { label: "실패", val: schedules.filter(s => s.status === "failed").length, color: "#ef4444" },
        ].map(({ label, val, color }) => (
          <div key={label} className="card" style={{ padding: "16px 20px", display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "Outfit", color }}>{val}</div>
              <div style={{ fontSize: 12, color: "#71717a" }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* List View */}
      {view === "list" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>업로드 일정 목록</h2>
          </div>
          <table className="table-dark">
            <thead>
              <tr>
                <th>영상 정보</th>
                <th>채널</th>
                <th>예약 일시</th>
                <th>상태</th>
                <th>조회수</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {schedules.sort((a, b) => b.date.localeCompare(a.date)).map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 40, height: 28, borderRadius: 4,
                        background: `linear-gradient(135deg, ${s.thumbnail_color}, ${s.thumbnail_color}99)`,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                      }}>
                        <Youtube size={12} color="white" />
                      </div>
                      <span style={{ fontSize: 13, color: "white", maxWidth: 280, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.title}
                      </span>
                    </div>
                  </td>
                  <td style={{ whiteSpace: "nowrap", color: "#a1a1aa" }}>{s.channel}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ fontSize: 13, color: "white" }}>{s.date}</div>
                    <div style={{ fontSize: 12, color: "#52525b" }}>{s.time}</div>
                  </td>
                  <td>{statusBadge(s.status)}</td>
                  <td style={{ color: s.views ? "#4ade80" : "#52525b" }}>
                    {s.views ? s.views : "-"}
                  </td>
                  <td>
                    <button onClick={() => deleteSchedule(s.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#52525b" }}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Calendar View */}
      {view === "calendar" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
            <ChevronLeft size={18} style={{ cursor: "pointer", color: "#71717a" }} />
            <span style={{ fontWeight: 700, fontSize: 17, flex: 1, textAlign: "center" }}>2025년 4월</span>
            <ChevronRight size={18} style={{ cursor: "pointer", color: "#71717a" }} />
          </div>
          <div style={{ padding: 16 }}>
            {/* Day labels */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
              {DAYS.map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: 12, color: "#52525b", padding: "4px 0", fontWeight: 600 }}>{d}</div>
              ))}
            </div>
            {/* Date cells */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `2025-04-${String(day).padStart(2, "0")}`;
                const hasEvent = scheduledDates.has(dateStr);
                const daySchedules = schedules.filter(s => s.date === dateStr);
                return (
                  <div key={day} style={{
                    minHeight: 70, padding: 6, borderRadius: 8,
                    background: hasEvent ? "rgba(239,68,68,0.05)" : "transparent",
                    border: hasEvent ? "1px solid rgba(239,68,68,0.2)" : "1px solid transparent",
                    transition: "all 0.2s", cursor: hasEvent ? "pointer" : "default"
                  }}>
                    <div style={{ fontSize: 13, fontWeight: day === 5 ? 700 : 400, color: hasEvent ? "#f87171" : "#71717a", marginBottom: 4 }}>{day}</div>
                    {daySchedules.slice(0, 2).map(s => (
                      <div key={s.id} style={{
                        fontSize: 10, background: "rgba(239,68,68,0.2)", borderRadius: 3,
                        padding: "2px 4px", marginBottom: 2, color: "#f87171",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                      }}>{s.time} 업로드</div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20
        }}>
          <div className="card" style={{ maxWidth: 480, width: "100%", padding: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>업로드 일정 추가</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: "#71717a", marginBottom: 6, display: "block" }}>영상 제목</label>
                <input className="input-dark" placeholder="[한국어 자막] 영상 제목 입력"
                  value={newItem.title} onChange={e => setNewItem({ ...newItem, title: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: "#71717a", marginBottom: 6, display: "block" }}>채널</label>
                <select className="input-dark" value={newItem.channel} onChange={e => setNewItem({ ...newItem, channel: e.target.value })}>
                  {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, color: "#71717a", marginBottom: 6, display: "block" }}>날짜</label>
                  <input className="input-dark" type="date" value={newItem.date}
                    onChange={e => setNewItem({ ...newItem, date: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: "#71717a", marginBottom: 6, display: "block" }}>시간</label>
                  <select className="input-dark" value={newItem.time} onChange={e => setNewItem({ ...newItem, time: e.target.value })}>
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button className="btn-primary" onClick={addSchedule} style={{ flex: 1 }}>저장</button>
                <button className="btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
