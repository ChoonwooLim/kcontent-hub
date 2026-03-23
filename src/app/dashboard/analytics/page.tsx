"use client";
import { ArrowUp, DollarSign, Eye, TrendingUp, Youtube, BarChart2, Clock } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const MONTHLY = [
  { m: "10월", adsense: 320000, total: 320000 },
  { m: "11월", adsense: 630000, total: 630000 },
  { m: "12월", adsense: 1070000, total: 1070000 },
  { m: "1월", adsense: 1430000, total: 1430000 },
  { m: "2월", adsense: 1790000, total: 1790000 },
  { m: "3월", adsense: 2340000, total: 2340000 },
];

const TOP_VIDEOS = [
  { title: "한국 편의점 처음 가본 미국인", views: "214K", revenue: 312000, ctr: 9.2, niche: "K-먹방" },
  { title: "찜질방 처음 간 외국인 반응", views: "187K", revenue: 271000, ctr: 8.7, niche: "K-문화" },
  { title: "한국 병원 충격 받은 외국인", views: "156K", revenue: 228000, ctr: 10.1, niche: "K-의료" },
  { title: "서울 지하철 vs 뉴욕 지하철", views: "142K", revenue: 203000, ctr: 8.9, niche: "K-교통" },
];

const NICHE_DATA = [
  { niche: "K-먹방", videos: 34, revenue: 820000 },
  { niche: "K-문화", videos: 28, revenue: 680000 },
  { niche: "K-의료", videos: 12, revenue: 420000 },
  { niche: "K-바비큐", videos: 19, revenue: 350000 },
  { niche: "K-교통", videos: 15, revenue: 270000 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ color: "var(--text-secondary)", marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color }}>₩{Number(p.value).toLocaleString()}</div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1100 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>수익 분석</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>채널 AdSense 수익 · 영상별 성과 · 니치별 수익 분석</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {[
          { label: "이번 달 AdSense", val: "₩2,340,000", change: "+31%", color: "#10b981" },
          { label: "총 누적 조회수", val: "4.2M", change: "+18%", color: "#6366f1" },
          { label: "운영 채널 수", val: "4개", change: "", color: "#f59e0b" },
          { label: "이번 달 업로드", val: "47편", change: "+12편", color: "#ec4899" },
        ].map(({ label, val, change, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-card-accent" style={{ background: color }} />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "Outfit", color }}>{val}</div>
            {change && <div style={{ fontSize: 11, color: "#4ade80", marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}><ArrowUp size={10} />{change}</div>}
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>월별 AdSense 수익 추이</div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={MONTHLY} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="adsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border-subtle)" />
            <XAxis dataKey="m" tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => `₩${(v / 10000).toFixed(0)}만`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="adsense" stroke="#6366f1" strokeWidth={2} fill="url(#adsGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Top Videos */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: 14, fontWeight: 700 }}>Top 영상 성과</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>영상</th>
                <th>조회수</th>
                <th>CTR</th>
                <th>수익</th>
              </tr>
            </thead>
            <tbody>
              {TOP_VIDEOS.map((v, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 500, marginBottom: 2 }}>{v.title}</div>
                    <span className="badge badge-gray" style={{ fontSize: 10 }}>{v.niche}</span>
                  </td>
                  <td>{v.views}</td>
                  <td style={{ color: v.ctr > 9 ? "#4ade80" : "#fbbf24" }}>{v.ctr}%</td>
                  <td style={{ color: "#4ade80", fontWeight: 700 }}>₩{v.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Niche Revenue */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>니치별 수익 분포</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={NICHE_DATA} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="niche" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip formatter={(v: number) => `₩${v.toLocaleString()}`} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            {NICHE_DATA.map(({ niche, videos, revenue }) => (
              <div key={niche} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "var(--text-secondary)" }}>{niche} <span style={{ color: "var(--text-muted)" }}>({videos}편)</span></span>
                <span style={{ color: "#818cf8", fontWeight: 700 }}>₩{(revenue / 10000).toFixed(0)}만</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
