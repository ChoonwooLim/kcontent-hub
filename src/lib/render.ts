import { spawn, execSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync, unlinkSync, renameSync, statSync, readdirSync } from "fs";
import { writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { isLangCode, normalizeCues } from "@/lib/subtitle-lang";
import { SUBTITLE_PRESETS, subtitleScale } from "@/lib/subtitle-presets";
import type { ShareSub } from "@/lib/share-types";
import { resolveYtDlp, isStaleYtDlpError, type YtDlp } from "@/lib/ytdlp";

/**
 * 자막 번인(burn-in) MP4 렌더링 파이프라인 — 서버 전용
 *
 *  1) CJK 폰트 확보: media/fonts/NotoSansCJKkr-Bold.otf 가 없으면 1회 다운로드 (Orbitron 이미지에는 CJK 폰트가 없음)
 *  2) 원본 영상: 서버 파일(fileVideoUrl) 또는 yt-dlp 로 YouTube 다운로드 (media/renders/src_<id>.mp4 캐시)
 *  3) 자막 → ASS (프리셋 색상·위치, 이중 자막 지원)
 *  4) ffmpeg libass 로 번인 → media/renders/<token>.mp4 (H.264 veryfast CRF22, AAC)
 *
 *  작업은 전역 큐로 1개씩 순차 실행하고 진행률은 SubtitleShare.renderProgress 에 기록한다.
 */
export const MEDIA_DIR = path.join(process.cwd(), "media");
const DOWNLOADS_DIR = path.join(MEDIA_DIR, "downloads");
const SAVED_DIR = path.join(DOWNLOADS_DIR, "saved");
export const RENDER_DIR = path.join(MEDIA_DIR, "renders");
const FONT_DIR = path.join(MEDIA_DIR, "fonts");
const FONT_FILE = "NotoSansCJKkr-Bold.otf";
const FONT_URL = "https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansCJKkr-Bold.otf";
const FONT_FAMILY = "Noto Sans CJK KR";
const MAX_DURATION_SEC = 30 * 60;
const isWindows = process.platform === "win32";

/* ── 바이너리 탐색 (download/subtitle 라우트와 동일 로직) ── */
function findBinary(name: string): string {
  try {
    const cmd = isWindows ? `where ${name}` : `which ${name}`;
    const result = execSync(cmd, { stdio: "pipe", timeout: 5000 }).toString().trim().split("\n")[0].trim();
    if (result && existsSync(result)) return result;
  } catch {}
  if (isWindows) {
    const username = process.env.USERNAME || process.env.USER || "choon";
    for (const base of [
      `C:\\Users\\${username}\\AppData\\Local\\Microsoft\\WinGet\\Packages`,
      `C:\\Users\\${username}\\AppData\\Local\\Programs\\Python`,
    ]) {
      if (!existsSync(base)) continue;
      const found = findFileRecursive(base, `${name}.exe`, 5);
      if (found) return found;
    }
  }
  throw new Error(`${name}를 찾을 수 없습니다. 서버에 설치되어 있어야 합니다.`);
}

function findFileRecursive(dir: string, name: string, depth: number): string | null {
  if (depth <= 0) return null;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) return path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findFileRecursive(path.join(dir, entry.name), name, depth - 1);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

/* ── ASS 생성 ────────────────────────────────────────────── */
export type RenderInput = {
  subs: ShareSub[];
  activeLang: string | null;
  secondaryLang: string | null;
  preset: number;
  overlayPos: string;
  overlayX?: number;   // % 오프셋 (오른쪽 +)
  overlayY?: number;   // % 오프셋 (위쪽 +)
  videoId: string | null;
  fileVideoUrl: string | null;
};

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0").toUpperCase();

/** "#rrggbb" → ASS "&HAABBGGRR" (alpha 1 = 불투명) */
function hexToAss(hex: string, alpha = 1): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  return `&H${hex2((1 - alpha) * 255)}${hex2(b)}${hex2(g)}${hex2(r)}`;
}

/** "rgba(r,g,b,a)" → ASS 색 */
function rgbaToAss(rgba: string): string {
  const m = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (!m) return "&H80000000";
  const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
  return `&H${hex2((1 - a) * 255)}${hex2(+m[3])}${hex2(+m[2])}${hex2(+m[1])}`;
}

function assTime(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const cs = Math.floor((s - Math.floor(s)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** 중괄호(override 태그 주입)·줄바꿈 처리 */
function assText(t: string): string {
  return t.replace(/\{/g, "(").replace(/\}/g, ")").replace(/\s*\r?\n+\s*/g, " ").trim();
}

export function buildAss(input: RenderInput): string {
  const preset = SUBTITLE_PRESETS[input.preset] ?? SUBTITLE_PRESETS[0];
  const primary = hexToAss(preset.color);
  const box = rgbaToAss(preset.bg);
  const align = input.overlayPos === "top" ? 8 : 2;      // 8 = 상단 중앙, 2 = 하단 중앙
  // 미세 이동(%) → ASS 마진 (PlayRes 1920x1080 기준). 가로는 좌우 마진을 비대칭으로, 세로는 MarginV 로
  const dx = Math.round(((input.overlayX ?? 0) / 100) * 1920);
  const dy = Math.round(((input.overlayY ?? 0) / 100) * 1080);
  // 좌우 여백 30px → 자막 폭 1860/1920 (97%) 로 가능한 한 한 줄에 담는다
  const marginL = Math.max(0, 30 + dx);
  const marginR = Math.max(0, 30 - dx);
  const marginV = Math.max(0, Math.min(1000, input.overlayPos === "top" ? 90 - dy : 90 + dy));
  const active = isLangCode(input.activeLang) ? input.activeLang : null;
  const secondary = isLangCode(input.secondaryLang) && input.secondaryLang !== active ? input.secondaryLang : null;
  const cues = normalizeCues([...input.subs].sort((a, b) => a.start - b.start));

  const lines = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1920",
    "PlayResY: 1080",
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // BorderStyle 3 = 불투명 박스 (박스 색 = OutlineColour/BackColour, Outline = 박스 여백)
    `Style: Primary,${FONT_FAMILY},62,${primary},&H000000FF,${box},${box},1,0,0,0,100,100,0,0,3,10,0,${align},${marginL},${marginR},${marginV},1`,
    `Style: Secondary,${FONT_FAMILY},42,${hexToAss("#ffffff", 0.92)},&H000000FF,${box},${box},0,0,0,0,100,100,0,0,3,8,0,${align},${marginL},${marginR},${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  for (const c of cues) {
    const p = active ? (c.texts?.[active] ?? c.text) : c.text;
    if (!p || !p.trim()) continue;
    const s2 = secondary ? c.texts?.[secondary] : undefined;
    // 긴 줄은 글자 크기를 줄여 한 줄에 (62pt 기준 약 30자 → 축소 시 최대 약 42자)
    const scale = Math.min(subtitleScale(p), s2 ? subtitleScale(s2) : 1);
    const fsP = scale < 1 ? `{\\fs${Math.round(62 * scale)}}` : "";
    const fsS = scale < 1 ? `\\fs${Math.round(42 * scale)}` : "";
    const text = s2 && s2.trim() ? `${fsP}${assText(p)}\\N{\\rSecondary${fsS}}${assText(s2)}` : `${fsP}${assText(p)}`;
    lines.push(`Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Primary,,0,0,0,,${text}`);
  }
  return lines.join("\n") + "\n";
}

/* ── 폰트 ────────────────────────────────────────────────── */
async function ensureFont(): Promise<string> {
  mkdirSync(FONT_DIR, { recursive: true });
  const fp = path.join(FONT_DIR, FONT_FILE);
  if (existsSync(fp) && statSync(fp).size > 1_000_000) return FONT_DIR;
  const res = await fetch(FONT_URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`CJK 폰트 다운로드 실패 (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1_000_000) throw new Error("CJK 폰트 파일이 비정상적으로 작습니다");
  const tmp = `${fp}.part`;
  await writeFile(tmp, buf);
  renameSync(tmp, fp);
  return FONT_DIR;
}

/* ── 원본 영상 ───────────────────────────────────────────── */
async function resolveSource(input: RenderInput, onProgress: (pct: number) => void): Promise<string> {
  if (input.fileVideoUrl) {
    const filename = decodeURIComponent(input.fileVideoUrl.split("/").pop() || "");
    if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      throw new Error("잘못된 원본 파일 경로입니다");
    }
    for (const dir of [SAVED_DIR, DOWNLOADS_DIR]) {
      const fp = path.join(dir, filename);
      if (existsSync(fp)) return fp;
    }
    try {
      const db = await prisma.downloadedFile.findFirst({ where: { filename }, orderBy: { createdAt: "desc" } });
      if (db?.filepath && existsSync(db.filepath)) return db.filepath;
    } catch { /* ignore */ }
    throw new Error(`원본 영상 파일을 서버에서 찾을 수 없습니다: ${filename}`);
  }

  if (input.videoId) {
    if (!/^[\w-]{6,20}$/.test(input.videoId)) throw new Error("잘못된 YouTube 영상 ID");
    const target = path.join(RENDER_DIR, `src_${input.videoId}.mp4`);
    if (existsSync(target) && statSync(target).size > 0) return target;
    const url = `https://www.youtube.com/watch?v=${input.videoId}`;
    const download = (yt: YtDlp) => new Promise<void>((resolve, reject) => {
      const proc = spawn(yt.cmd, [
        ...yt.baseArgs,
        "-f", "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/b",
        "--merge-output-format", "mp4",
        "--no-check-certificates", "--no-playlist", "--newline",
        "-o", target,
        url,
      ]);
      let err = "";
      proc.stdout.on("data", (d: Buffer) => {
        const m = d.toString().match(/(\d+\.?\d*)%/);
        if (m) onProgress(Math.min(29, 2 + parseFloat(m[1]) * 0.27));
      });
      proc.stderr.on("data", (d: Buffer) => { err += d.toString(); if (err.length > 20000) err = err.slice(-10000); });
      const timer = setTimeout(() => { proc.kill(); reject(new Error("원본 다운로드 시간 초과 (15분)")); }, 15 * 60 * 1000);
      proc.on("close", code => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(Object.assign(new Error(`yt-dlp 실패 (코드 ${code}): ${err.trim().split("\n").slice(-2).join(" | ").slice(-300)}`), { stderr: err }));
      });
      proc.on("error", e => { clearTimeout(timer); reject(e); });
    });
    const cleanupPartials = () => {
      for (const f of [target, `${target}.part`]) { try { if (existsSync(f)) unlinkSync(f); } catch { /* ignore */ } }
    };

    let yt = await resolveYtDlp();
    try {
      await download(yt);
    } catch (e) {
      const stderr = (e as { stderr?: string }).stderr ?? String(e);
      if (!isStaleYtDlpError(stderr)) throw e;
      // 403 / 서명 오류 등 "낡은 yt-dlp" 징후 → 최신판으로 강제 갱신 후 1회 재시도
      cleanupPartials();
      yt = await resolveYtDlp({ forceUpdate: true });
      try {
        await download(yt);
      } catch (e2) {
        throw new Error(`${String(e2 instanceof Error ? e2.message : e2)} — yt-dlp 최신판(${yt.source})으로 재시도했으나 실패. YouTube 가 서버 접근을 차단했거나 로그인·연령 제한 영상일 수 있습니다.`);
      }
    }
    if (!existsSync(target)) throw new Error("원본 다운로드 결과 파일이 없습니다");
    return target;
  }

  throw new Error("원본 영상 정보가 없습니다 (YouTube ID 또는 서버 파일)");
}

/* ── ffmpeg ──────────────────────────────────────────────── */
function probeDuration(ffmpeg: string, file: string): Promise<number> {
  return new Promise(resolve => {
    const proc = spawn(ffmpeg, ["-hide_banner", "-i", file]);
    let out = "";
    proc.stderr.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      const m = out.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      resolve(m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 0);
    });
    proc.on("error", () => resolve(0));
  });
}

/** 필터그래프 안의 경로 이스케이프: 역슬래시 → 슬래시, 콜론·따옴표 이스케이프 (Windows C: 대응) */
function escFilterPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function renderFfmpeg(
  ffmpeg: string, src: string, assPath: string, fontsDir: string, out: string,
  duration: number, onProgress: (pct: number) => void,
): Promise<void> {
  const vf = `scale='min(1920,iw)':-2,ass='${escFilterPath(assPath)}':fontsdir='${escFilterPath(fontsDir)}'`;
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, [
      "-y", "-hide_banner", "-nostats",
      "-i", src,
      "-vf", vf,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "160k",
      "-movflags", "+faststart",
      "-progress", "pipe:1",
      out,
    ]);
    let err = "";
    proc.stdout.on("data", (d: Buffer) => {
      for (const line of d.toString().split("\n")) {
        const m = line.match(/out_time_(?:us|ms)=(\d+)/);
        if (m && duration > 0) {
          const sec = parseInt(m[1], 10) / 1_000_000;
          onProgress(Math.min(99, 30 + 69 * (sec / duration)));
        }
      }
    });
    proc.stderr.on("data", (d: Buffer) => { err += d.toString(); if (err.length > 20000) err = err.slice(-10000); });
    const timer = setTimeout(() => { proc.kill(); reject(new Error("렌더링 시간 초과 (45분)")); }, 45 * 60 * 1000);
    proc.on("close", code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg 실패 (코드 ${code}): ${err.trim().split("\n").slice(-3).join(" | ").slice(-400)}`));
    });
    proc.on("error", e => { clearTimeout(timer); reject(e); });
  });
}

/* ── 작업 큐 (서버 CPU 보호: 1개씩 순차) ──────────────────── */
const queueStore = globalThis as unknown as { __subtitleRenderQueue?: Promise<void> };

export function enqueueRender(shareId: string): void {
  queueStore.__subtitleRenderQueue = (queueStore.__subtitleRenderQueue ?? Promise.resolve())
    .then(() => runRender(shareId))
    .catch(() => { /* runRender 내부에서 상태 기록 */ });
}

async function setStatus(id: string, data: {
  renderStatus?: string | null; renderProgress?: number; renderPath?: string | null;
  renderError?: string | null; renderedAt?: Date | null;
}) {
  try { await prisma.subtitleShare.update({ where: { id }, data }); } catch { /* 삭제된 공유 등 */ }
}

export async function runRender(shareId: string): Promise<void> {
  const share = await prisma.subtitleShare.findUnique({ where: { id: shareId } });
  if (!share) return;

  let lastPct = -1;
  const onProgress = (pct: number) => {
    const p = Math.round(pct);
    if (p !== lastPct) { lastPct = p; void setStatus(shareId, { renderProgress: p }); }
  };

  try {
    await setStatus(shareId, { renderStatus: "rendering", renderProgress: 1, renderError: null, renderPath: null });
    mkdirSync(RENDER_DIR, { recursive: true });

    const fontsDir = await ensureFont();
    onProgress(2);

    const input: RenderInput = {
      subs: JSON.parse(share.subsJson || "[]"),
      activeLang: share.activeLang, secondaryLang: share.secondaryLang,
      preset: share.preset, overlayPos: share.overlayPos, overlayX: share.overlayX, overlayY: share.overlayY,
      videoId: share.videoId, fileVideoUrl: share.fileVideoUrl,
    };
    if (!input.subs.length) throw new Error("렌더링할 자막이 없습니다");

    const src = await resolveSource(input, onProgress);
    const ffmpeg = findBinary("ffmpeg");
    const duration = await probeDuration(ffmpeg, src);
    if (duration > MAX_DURATION_SEC) throw new Error(`영상이 너무 깁니다 (${Math.round(duration / 60)}분 > 30분 제한)`);

    const assPath = path.join(RENDER_DIR, `${share.token}.ass`);
    writeFileSync(assPath, buildAss(input), "utf8");
    const out = path.join(RENDER_DIR, `${share.token}.mp4`);
    if (existsSync(out)) unlinkSync(out);
    onProgress(30);

    await renderFfmpeg(ffmpeg, src, assPath, fontsDir, out, duration || 1, onProgress);
    try { unlinkSync(assPath); } catch {}

    await setStatus(shareId, { renderStatus: "done", renderProgress: 100, renderPath: out, renderedAt: new Date(), renderError: null });
  } catch (e) {
    await setStatus(shareId, {
      renderStatus: "failed",
      renderError: String(e instanceof Error ? e.message : e).slice(0, 500),
    });
  }
}

/** 공유 삭제 시 렌더링 결과 파일 정리 */
export function removeRenderFile(renderPath: string | null | undefined) {
  if (!renderPath) return;
  try {
    // RENDER_DIR 바깥 경로는 건드리지 않는다
    if (path.resolve(renderPath).startsWith(path.resolve(RENDER_DIR)) && existsSync(renderPath)) unlinkSync(renderPath);
  } catch { /* ignore */ }
}
