<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:kcontent-hub-context -->
# KContent Studio System Context & Development Plan

**Current Pipeline Stages:**
1. **Hunter**: Scans foreigner videos, filters S-tier content.
2. **Script**: Uses GPT-4 Vision & Whisper to generate Korean narratives & timelines.
3. **Editor**: Browser-based FFmpeg subtitle hardcoding & thumbnail generation.
4. **Publisher**: Multi-platform automated schedule upload (Youtube, Shorts, Tiktok, Reels).

**Short-term Improvements Needed:**
- **FFmpeg/Memory**: WASM FFmpeg in browser crashes on large files -> Next step: backend queue or chunk processing.
- **Auth**: Missing Auth & User models -> Next step: NextAuth/Supabase.
- **Rate Limit**: Missing Rate Limiting -> Next step: P-queue for external APIs (OpenAI, YouTube).

**Future Upgrades:**
- Multi-tenant SaaS Architecture (Workspaces, Roles)
- Billing integration (Stripe)
- Advanced AI features (B-roll insertion, TTS voice cloning)
- CI/CD & E2E Testing (Jest/Playwright)
**Subtitle Translation Engine (2026-10-09):**
- `TRANSLATE_PROVIDER=openclaw` routes subtitle translation to the OpenClaw gateway on twinverse-ai (OpenAI-compatible `POST /v1/chat/completions`, model `openclaw/<OPENCLAW_AGENT_ID>`, default agent `codex-pro`). Env: `OPENCLAW_GATEWAY_URL` (`http://192.168.219.117:18790`, LAN only), `OPENCLAW_TOKEN` (Orbitron secrets), `OPENCLAW_AGENT_ID`, `TRANSLATE_FALLBACK` (`openai` default | `none`).
- Otherwise OpenAI GPT-4o (`OPENAI_API_KEY`). Whisper extraction always uses OpenAI.
- Translation runs as an async job (`POST {async:true}` → `202 {jobId}` → `GET ?job=`) because the Orbitron proxy times out at ~60s; the UI polls and shows the engine actually used, including any OpenAI fallback.
- Values SSOT: `C:\WORK\infra-docs\ai-shared-registry.md` §3.5. Gateway details: `C:\WORK\llm-wiki\40-Tools\OpenClaw.md`.
**Users, Plans & Access (2026-10-09):**
- `User.role` USER|ADMIN and `User.plan` FREE|VIP (Prisma enums). Bootstrap admins (`ADMIN_EMAILS` env, default admin@orbitron.io + choonwoo49@gmail.com) are auto-promoted to ADMIN/VIP on register/login. JWT callback re-reads role/plan/disabled from DB on every request so admin changes apply without re-login; disabled users are signed out.
- FREE users must register their own OpenAI key (and YouTube key for the hunter) at `/dashboard/settings`; keys are AES-256-GCM encrypted with a key derived from `AUTH_SECRET` (`src/lib/crypto.ts`). Until the OpenAI key exists, the dashboard layout locks feature pages (`OPEN_PATHS` stay open) and APIs return `403 {code:"KEY_REQUIRED"}`.
- VIP/ADMIN: translation via OpenClaw, Whisper/YouTube via server env keys (fallback to own key). Key resolution lives in `src/lib/access.ts` (`requireUser`, `requireAdmin`, `resolveOpenAIKey`, `resolveYoutubeKey`) and `src/lib/translate-engine.ts` (`engineForUser`).
- Admin UI `/dashboard/admin` + API `/api/admin/users` (GET/PATCH/DELETE): plan/role changes, disable, delete, notes; guards against self-demotion and removing the last active admin. `/api/me` feeds the layout (`useMe` hook, `refreshMe()` after key saves).
<!-- END:kcontent-hub-context -->
