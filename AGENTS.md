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
<!-- END:kcontent-hub-context -->
