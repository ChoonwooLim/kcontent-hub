"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Search, Cpu, Film, Globe, Youtube, Settings,
  ChevronRight, Bell, Layers, BarChart2, Scissors
} from "lucide-react";

const NAV = [
  { section: "제작 파이프라인" },
  { href: "/dashboard", label: "파이프라인 보드", icon: LayoutDashboard },
  { href: "/dashboard/hunter", label: "소재 수집기", icon: Search },
  { href: "/dashboard/editor", label: "영상 편집기", icon: Scissors },
  { href: "/dashboard/script", label: "AI 대본 엔진", icon: Cpu },
  { href: "/dashboard/studio", label: "자막 스튜디오", icon: Film },
  { href: "/dashboard/publisher", label: "멀티플랫폼 배포", icon: Globe },
  { section: "관리" },
  { href: "/dashboard/channels", label: "채널 관리", icon: Youtube },
  { href: "/dashboard/analytics", label: "수익 분석", icon: BarChart2 },
  { href: "/dashboard/settings", label: "API 설정", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ background: "var(--gradient-brand)", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 16px var(--brand-glow)" }}>
              <Film size={16} color="white" />
            </div>
            <div>
              <div style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 15, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>KContent<span style={{ color: "#818cf8" }}> Studio</span></div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>v2.0 · Production</div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 10px", overflowY: "auto" }}>
          {NAV.map((item, i) => {
            if ("section" in item) {
              return <div key={i} className="nav-section">{item.section}</div>;
            }
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`nav-item ${active ? "active" : ""}`} style={{ display: "flex" }}>
                <Icon size={15} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {active && <ChevronRight size={12} style={{ opacity: 0.6 }} />}
              </Link>
            );
          })}
        </nav>

        {/* Pipeline Status */}
        <div style={{ padding: "12px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <span className="live-dot" />
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>파이프라인 동작 중</span>
            </div>
            {[
              { label: "오늘 처리 영상", val: "12개" },
              { label: "업로드 대기", val: "3개" },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                <span>{label}</span>
                <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
            {NAV.filter(n => "href" in n && n.href === pathname).map(n => "label" in n ? n.label : "")[0] || "KContent Studio"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="badge badge-green" style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span className="live-dot" style={{ width: 5, height: 5 }} />
              자동화 실행 중
            </div>
            <button className="btn-icon" style={{ position: "relative" }}>
              <Bell size={15} />
              <span style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, background: "var(--accent-red)", borderRadius: "50%" }} />
            </button>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--gradient-brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "white", cursor: "pointer" }}>Y</div>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
