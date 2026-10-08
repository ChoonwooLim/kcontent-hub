import { execSync } from "child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, renameSync, statSync } from "fs";
import { writeFile } from "fs/promises";
import path from "path";

/**
 * yt-dlp 실행 명령 해석 (서버 전용)
 *
 * 운영 컨테이너(Alpine)의 패키지 yt-dlp 는 금방 낡아 YouTube 다운로드가 "HTTP Error 403" 으로 깨진다.
 * Orbitron 이 Dockerfile 을 매 배포마다 다시 쓰기 때문에 이미지를 고칠 수 없으므로,
 * 최신 릴리스 zipapp(python3 로 실행)을 media/bin 에 받아 두고 3일마다 자동 갱신한다.
 *  - Linux/mac : python3 + media/bin/yt-dlp (managed) → 실패 시 시스템 yt-dlp
 *  - Windows   : 시스템 yt-dlp.exe (개발 PC)
 */
const BIN_DIR = path.join(process.cwd(), "media", "bin");
const SCRIPT = path.join(BIN_DIR, "yt-dlp");
const RELEASE_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
const MAX_AGE_MS = 3 * 24 * 3600 * 1000;
const isWindows = process.platform === "win32";

export type YtDlp = { cmd: string; baseArgs: string[]; source: "managed" | "system" };

function which(name: string): string | null {
  try {
    const cmd = isWindows ? `where ${name}` : `which ${name}`;
    const out = execSync(cmd, { stdio: "pipe", timeout: 5000 }).toString().trim().split("\n")[0].trim();
    return out && existsSync(out) ? out : null;
  } catch { return null; }
}

function findWindowsExe(name: string): string | null {
  const username = process.env.USERNAME || process.env.USER || "";
  const bases = [
    `C:\\Users\\${username}\\AppData\\Local\\Microsoft\\WinGet\\Packages`,
    `C:\\Users\\${username}\\AppData\\Local\\Programs\\Python`,
  ];
  const walk = (dir: string, depth: number): string | null => {
    if (depth <= 0) return null;
    try {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isFile() && e.name.toLowerCase() === `${name}.exe`) return path.join(dir, e.name);
        if (e.isDirectory()) { const f = walk(path.join(dir, e.name), depth - 1); if (f) return f; }
      }
    } catch {}
    return null;
  };
  for (const b of bases) { if (existsSync(b)) { const f = walk(b, 5); if (f) return f; } }
  return null;
}

const store = globalThis as unknown as { __ytdlpInflight?: Promise<string> | null };

async function ensureManagedScript(force: boolean): Promise<string> {
  mkdirSync(BIN_DIR, { recursive: true });
  const fresh = !force && existsSync(SCRIPT) && statSync(SCRIPT).size > 100_000
    && Date.now() - statSync(SCRIPT).mtimeMs < MAX_AGE_MS;
  if (fresh) return SCRIPT;
  const res = await fetch(RELEASE_URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`yt-dlp 최신판 다운로드 실패 (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100_000) throw new Error("yt-dlp 파일이 비정상적으로 작습니다");
  const tmp = `${SCRIPT}.part`;
  await writeFile(tmp, buf);
  renameSync(tmp, SCRIPT);
  try { chmodSync(SCRIPT, 0o755); } catch { /* ignore */ }
  return SCRIPT;
}

export async function resolveYtDlp(opts: { forceUpdate?: boolean } = {}): Promise<YtDlp> {
  if (!isWindows) {
    const python = which("python3") ?? which("python");
    if (python) {
      try {
        if (!store.__ytdlpInflight || opts.forceUpdate) {
          store.__ytdlpInflight = ensureManagedScript(!!opts.forceUpdate).finally(() => { store.__ytdlpInflight = null; });
        }
        const script = await store.__ytdlpInflight;
        return { cmd: python, baseArgs: [script], source: "managed" };
      } catch { /* 네트워크 불가 등 → 시스템 바이너리로 */ }
    }
  }
  const sys = which("yt-dlp") ?? (isWindows ? findWindowsExe("yt-dlp") : null);
  if (!sys) throw new Error("yt-dlp 를 찾을 수 없습니다. 서버에 python3 또는 yt-dlp 가 필요합니다.");
  return { cmd: sys, baseArgs: [], source: "system" };
}

/** "낡은 yt-dlp" 징후 — 강제 갱신 후 1회 재시도할 가치가 있는 오류 */
export function isStaleYtDlpError(stderr: string): boolean {
  return /HTTP Error 403|Forbidden|nsig|n challenge|Signature extraction failed|Requested format is not available|Unable to extract/i.test(stderr);
}
