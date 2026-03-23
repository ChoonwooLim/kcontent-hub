"use client";
import {
  TrendingUp, DollarSign, Users, Eye, Youtube, ArrowUp, ArrowDown,
  Calendar, Download, BarChart2, ChevronDown
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, Area, AreaChart
} from "recharts";

const MONTHLY_REVENUE = [
  { month: "10월", adsense: 320000, course: 0, total: 320000 },
  { month: "11월", adsense: 480000, course: 150000, total: 630000 },
  { month: "12월", adsense: 620000, course: 450000, total: 1070000 },
  { month: "1월", adsense: 750000, course: 680000, total: 1430000 },
  { month: "2월", adsense: 890000, course: 900000, total: 1790000 },
  { month: "3월", adsense: 1050000, course: 1290000, total: 2340000 },
];

const CHANNEL_DATA = [
  { name: "요리채널 KR", subscribers: 12400, views: "2.1M", revenue: 980000, growth: "+34%", up: true },
  { name: "English World KR", subscribers: 8700, views: "1.4M", revenue: 620000, growth: "+21%", up: true },
  { name: "여행채널 KR", subscribers: 6200, views: "890K", revenue: 450000, growth: "+18%", up: true },
  { name: "사이언스 KR", subscribers: 4100, views: "540K", revenue: 290000, growth: "+8%", up: true },
];

const PIE_DATA = [
  { name: "AdSense", value: 1050000, color: "#f97316" },
  { name: "강의 판매", value: 1290000, color: "#22c55e" },
];

const LEAD_FUNNEL = [
  { stage: "영상 조회수", count: 210000, color: "#3b82f6" },
  { stage: "설명 링크 클릭", count: 8400, color: "#a855f7" },
  { stage: "신청 완료", count: 1890, color: "#f97316" },
  { stage: "강의 구매", count: 142, color: "#22c55e" },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div style={{ background: "#1f1f23", border: "1px solid #3f3f46", borderRadius: 10, padding: "12px 16px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "white" }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ fontSize: 12, color: p.color, marginBottom: 2 }}>
          {p.name}: ₩{p.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
};

export default function EarningsPage() {
  const totalRevenue = 2340000;
  const prevRevenue = 1790000;
  const growth = (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>수익 트래커 💰</h1>
          <p style={{ color: "#71717a" }}>채널별 AdSense 수익과 강의 판매 현황을 실시간으로 확인합니다</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <select style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 16px", color: "white", fontSize: 13, cursor: "pointer" }}>
            {["최근 6개월", "최근 3개월", "이번 달", "작년"].map(o => <option key={o}>{o}</option>)}
          </select>
          <button className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", fontSize: 13 }}>
            <Download size={15} /> 리포트 다운로드
          </button>
        </div>
      </div>

      {/* Top Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {[
          { label: "이번 달 총 수익", val: `₩${totalRevenue.toLocaleString()}`, change: `+${growth}%`, up: true, color: "green", icon: DollarSign },
          { label: "AdSense 수익", val: "₩1,050,000", change: "+18%", up: true, color: "orange", icon: Youtube },
          { label: "강의 판매 수익", val: "₩1,290,000", change: "+43%", up: true, color: "blue", icon: TrendingUp },
          { label: "총 구독자", val: "31,400", change: "+2,800", up: true, color: "red", icon: Users },
        ].map(({ label, val, change, up, color, icon: Icon }) => {
          const clr = { green: "#22c55e", orange: "#f97316", blue: "#3b82f6", red: "#ef4444" }[color];
          return (
            <div key={label} className={`stat-card stat-card-${color}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 13, color: "#71717a", marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "Outfit" }}>{val}</div>
                </div>
                <div style={{ background: `${clr}20`, padding: 10, borderRadius: 10 }}>
                  <Icon size={20} color={clr} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 12, fontSize: 13 }}>
                {up ? <ArrowUp size={13} color="#22c55e" /> : <ArrowDown size={13} color="#ef4444" />}
                <span style={{ color: up ? "#4ade80" : "#f87171" }}>{change}</span>
                <span style={{ color: "#52525b" }}>전월 대비</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue Chart */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>월별 수익 추이</h2>
          <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
            {[{ color: "#f97316", label: "AdSense" }, { color: "#22c55e", label: "강의 판매" }].map(({ color, label }) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, color: "#71717a" }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
                {label}
              </span>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={MONTHLY_REVENUE} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="adsenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="courseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => `₩${(v / 10000).toFixed(0)}만`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="adsense" name="AdSense" stroke="#f97316" strokeWidth={2} fill="url(#adsenseGrad)" />
            <Area type="monotone" dataKey="course" name="강의 판매" stroke="#22c55e" strokeWidth={2} fill="url(#courseGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Two Column */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Revenue Pie */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>수익 구조</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                dataKey="value" paddingAngle={4}>
                {PIE_DATA.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>
            {PIE_DATA.map(({ name, color, value }) => (
              <div key={name} style={{ textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
                  <span style={{ fontSize: 13, color: "#71717a" }}>{name}</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color }}>{(value / 10000).toFixed(0)}만원</div>
              </div>
            ))}
          </div>
        </div>

        {/* Lead Funnel */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>리드 전환 퍼널</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {LEAD_FUNNEL.map(({ stage, count, color }, i) => {
              const pct = Math.round((count / LEAD_FUNNEL[0].count) * 100);
              return (
                <div key={stage}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: "#a1a1aa" }}>{stage}</span>
                    <span style={{ fontWeight: 700, color }}>
                      {count.toLocaleString()} <span style={{ color: "#52525b", fontWeight: 400 }}>({pct}%)</span>
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div style={{ height: "100%", borderRadius: 3, background: color, width: `${pct}%`, transition: "width 1s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: "#71717a", marginBottom: 4 }}>강의 전환율</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#4ade80" }}>7.5%</div>
            <div style={{ fontSize: 12, color: "#52525b" }}>업계 평균 2.1% 대비 3.6배</div>
          </div>
        </div>
      </div>

      {/* Channel Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>채널별 수익 현황</h2>
        </div>
        <table className="table-dark">
          <thead>
            <tr>
              <th>채널명</th>
              <th>구독자</th>
              <th>총 조회수</th>
              <th>수익</th>
              <th>성장률</th>
            </tr>
          </thead>
          <tbody>
            {CHANNEL_DATA.map(({ name, subscribers, views, revenue, growth, up }) => (
              <tr key={name}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: "var(--gradient-red)",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <Youtube size={14} color="white" />
                    </div>
                    <span style={{ color: "white", fontWeight: 500 }}>{name}</span>
                  </div>
                </td>
                <td>{subscribers.toLocaleString()}</td>
                <td>{views}</td>
                <td style={{ color: "#4ade80", fontWeight: 700 }}>₩{revenue.toLocaleString()}</td>
                <td>
                  <span style={{ color: up ? "#4ade80" : "#f87171", display: "flex", alignItems: "center", gap: 4 }}>
                    {up ? <ArrowUp size={13} /> : <ArrowDown size={13} />} {growth}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
