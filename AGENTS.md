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
<!-- END:kcontent-hub-context -->
