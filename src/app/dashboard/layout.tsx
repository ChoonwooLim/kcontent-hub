"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Search, Subtitles, Calendar, BarChart2,
  Youtube, Settings, ChevronRight, Bell, Menu, X, Zap
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/dashboard/finder", label: "콘텐츠 파인더", icon: Search },
  { href: "/dashboard/studio", label: "자막 스튜디오", icon: Subtitles },
  { href: "/dashboard/scheduler", label: "업로드 스케줄러", icon: Calendar },
  { href: "/dashboard/earnings", label: "수익 트래커", icon: BarChart2 },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 40, backdropFilter: "blur(4px)" }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 240, flexShrink: 0, height: "100vh", position: "sticky", top: 0,
        borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column",
        background: "var(--bg-secondary)", zIndex: 50,
        transition: "transform 0.3s ease",
        ...(typeof window !== "undefined" && window.innerWidth < 768 ? {
          position: "fixed" as const, left: 0, transform: sidebarOpen ? "none" : "translateX(-100%)"
        } : {})
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{
              background: "var(--gradient-red)", width: 36, height: 36, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Youtube size={20} color="white" />
            </div>
            <div>
              <div style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 17, color: "white" }}>
                KContent<span style={{ color: "#f87171" }}>Hub</span>
              </div>
              <div style={{ fontSize: 11, color: "#52525b" }}>자동 수익화 플랫폼</div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, color: "#52525b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px", marginBottom: 8 }}>
            메뉴
          </div>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} className={`sidebar-link ${active ? "active" : ""}`} onClick={() => setSidebarOpen(false)}>
                <Icon size={18} />
                <span>{label}</span>
                {active && <ChevronRight size={14} style={{ marginLeft: "auto" }} />}
              </Link>
            );
          })}

          <div style={{ flexGrow: 1 }} />

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 }}>
            <Link href="/settings" className="sidebar-link">
              <Settings size={18} />
              <span>API 설정</span>
            </Link>
          </div>
        </nav>

        {/* Upgrade Card */}
        <div style={{ padding: "12px", borderTop: "1px solid var(--border)" }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(239,68,68,0.1), rgba(249,115,22,0.1))",
            border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: 16
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Zap size={16} color="#f87171" />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Pro 플랜</span>
            </div>
            <p style={{ fontSize: 12, color: "#71717a", marginBottom: 12, lineHeight: 1.5 }}>
              무제한 채널 · 자동 업로드 · 고급 분석
            </p>
            <button className="btn-primary" style={{ width: "100%", padding: "8px", fontSize: 13 }}>
              업그레이드
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top Bar */}
        <header style={{
          height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 24px", borderBottom: "1px solid var(--border)",
          background: "rgba(9,9,11,0.8)", backdropFilter: "blur(12px)",
          position: "sticky", top: 0, zIndex: 30
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex" }}
            >
              <Menu size={20} />
            </button>
            <div style={{ fontSize: 14, color: "#71717a" }}>
              {NAV_ITEMS.find(n => n.href === pathname)?.label || "대시보드"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="badge badge-green" style={{ fontSize: 12 }}>
              <span style={{ width: 6, height: 6, background: "#4ade80", borderRadius: "50%" }} />
              자동화 실행 중
            </div>
            <button style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", position: "relative" }}>
              <Bell size={18} />
              <span style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, background: "#ef4444", borderRadius: "50%" }} />
            </button>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "linear-gradient(135deg, #ef4444, #f97316)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700, color: "white", cursor: "pointer"
            }}>K</div>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, overflow: "auto", padding: "28px 28px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
