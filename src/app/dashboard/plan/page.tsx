"use client"; // Just to force it as client or keep it server if possible. Let's make it server component initially but use client for icons
import { Map, Zap, Settings, Shield, Cpu, ExternalLink, Target, CheckCircle2 } from "lucide-react";

export default function PlanPage() {
  return (
    <div className="fade-in" style={{ padding: 24, paddingBottom: 64, maxWidth: 1000, margin: "0 auto" }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
          <Map size={24} className="text-brand" />
          KContent Studio 개발계획 및 분석 보고서
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 8, fontSize: 14 }}>
          현행 아키텍처 분석 기반의 단기 개선점 및 중장기 업그레이드 로드맵
        </p>
      </header>

      {/* Grid Layout */}
      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "1fr" }}>
        
        {/* Section 1 */}
        <section className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Target size={20} color="#3b82f6" />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>1. 현행 시스템 분석 (Current State Analysis)</h2>
          </div>
          <div style={{ padding: 16, background: "var(--bg-void)", borderRadius: 8, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            <p style={{ marginBottom: 12 }}>현재 KContent Studio는 다음과 같은 강력하고 선형적인 제작 파이프라인을 구축하고 있습니다:</p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                "수집 (Hunter): 외국인 영상의 조회수, 언어 등 메타데이터 자동 스캔 및 S급 영상 선별",
                "대본 생성 (Script): GPT-4 Vision 기반 한글 변환 및 타임라인 자동 대본 추출 (Whisper 연동)",
                "편집 (Editor): FFmpeg 기반의 브라우저 내 렌더링을 통한 자막 소각 및 썸네일 자동 생성",
                "배포 (Publisher): 유튜브, 쇼츠, 틱톡 등 멀티플랫폼에 최적화된 스케줄 자동 배포",
              ].map((item, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))" }}>
          
          {/* Section 2 */}
          <section className="card" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Zap size={20} color="#f59e0b" />
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>2. 시급한 시스템 개선사항 (Short-term Fixes)</h2>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ padding: 16, borderLeft: "3px solid #f59e0b", background: "rgba(245, 158, 11, 0.05)", borderRadius: "0 8px 8px 0" }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <Settings size={14} /> 메모리 최적화 및 에러 핸들링
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  현재 브라우저 환경에서 FFmpeg(WASM) 구동 시 긴 영상에서 메모리 누수 및 브라우저 크래시가 우려됩니다.
                  큰 파일은 서버리스 백엔드 큐(예: AWS MediaConvert, GCP Transcoder)로 이전하거나 Chunk 단위 처리 도입이 필요합니다.
                </p>
              </div>

              <div style={{ padding: 16, borderLeft: "3px solid #ef4444", background: "rgba(239, 68, 68, 0.05)", borderRadius: "0 8px 8px 0" }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <Shield size={14} /> 인증 및 세션 모델 (Auth & Users) 도입
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  <code style={{ background: "var(--bg-void)", padding: "2px 6px", borderRadius: 4 }}>schema.prisma</code> 상 현재 User 모델이 존재하지 않으며 인증 처리가 배제되어 있습니다. NextAuth 나 Supabase를 이용해 사용자별 격리(Tenant) 및 권한 관리가 필수적입니다.
                </p>
              </div>

              <div style={{ padding: 16, borderLeft: "3px solid #3b82f6", background: "rgba(59, 130, 246, 0.05)", borderRadius: "0 8px 8px 0" }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <Cpu size={14} /> 외부 API Rate Limit 제어
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  OpenAI 및 YouTube API 호출 시 동시성 제어(Rate Limit) 방어 로직이 더 견고해야 합니다. P-queue 등을 활용하여 과도한 병렬 API 호출 시 발생하는 HTTP 429 에러를 방지해야 합니다.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="card" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <ExternalLink size={20} color="#8b5cf6" />
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>3. 향후 업그레이드 필요사항 (Future Upgrades)</h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                {
                  title: "Multi-tenant SaaS 아키텍처 전환",
                  desc: "단일 유저를 넘어 기관/엔터테인먼트 사가 각각의 워크스페이스를 가지고 협업할 수 있는 SaaS 형태로 확장. (역할 및 퍼미션 시스템 도입)"
                },
                {
                  title: "고급 AI 편집 기능 자동화",
                  desc: "대본 기반 모션 그래픽 템플릿 도입. 단순히 자막을 넘어서 B-roll 영상, 자동 TTS(음성 클리닝 및 더빙 복제) 연동."
                },
                {
                  title: "데이터베이스 인덱싱 및 쿼리 최적화",
                  desc: "영상이 수만 건 이상 누적 시, PipelineVideo 테이블에서 필터링하는 쿼리가 매우 느려질 수 있습니다. 단계별(Stage) 인덱스를 설정해야 합니다."
                },
                {
                  title: "결제 모듈 (Billing) 연동",
                  desc: "처리한 영상의 분 단위 청구, 혹은 월 구독 형태의 플랜 제공. (Stripe 연동 필요)"
                },
                {
                  title: "CI/CD 파이프라인 및 통합 테스트(E2E) 구축",
                  desc: "Jest 및 Playwright를 도입하여, 코어 변환 모듈 및 멀티플랫폼 업로드 로직 배포 성공률을 안정적으로 방어해야 합니다."
                }
              ].map((item, i) => (
                <div key={i} style={{ background: "var(--bg-void)", padding: 16, borderRadius: 8 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{item.title}</h4>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
