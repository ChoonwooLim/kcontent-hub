import { NextRequest, NextResponse } from "next/server";
import { execFileSync, execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "fs";
import path from "path";

/* ── 바이너리 경로 자동 탐색 ─────────────────────────── */
const TMP_DIR = path.join(process.cwd(), "tmp_downloads");
const isWindows = process.platform === "win32";

/** which / where 명령으로 바이너리 경로 탐색 */
function findBinary(name: string, fallbackPaths: string[]): string {
  // 1) 시스템 PATH에서 탐색
  try {
    const cmd = isWindows ? `where ${name}` : `which ${name}`;
    const result = execSync(cmd, { stdio: "pipe", timeout: 5000 }).toString().trim().split("\n")[0].trim();
    if (result && existsSync(result)) return result;
  } catch {}

  // 2) 하드코딩 폴백 경로 확인
  for (const p of fallbackPaths) {
    if (existsSync(p)) return p;
  }

  // 3) Windows: 재귀 탐색 (winget 설치 경로)
  if (isWindows) {
    const username = process.env.USERNAME || process.env.USER || "choon";
    const searchBases = [
      `C:\\Users\\${username}\\AppData\\Local\\Microsoft\\WinGet\\Packages`,
      `C:\\Users\\${username}\\AppData\\Local\\Programs\\Python`,
    ];
    for (const base of searchBases) {
      if (!existsSync(base)) continue;
      const found = findFileRecursive(base, isWindows ? `${name}.exe` : name, 5);
      if (found) return found;
    }
  }

  throw new Error(`${name}를 찾을 수 없습니다. 설치 후 PATH에 추가하세요.`);
}

function findFileRecursive(dir: string, name: string, depth: number): string | null {
  if (depth <= 0) return null;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) {
        return path.join(dir, entry.name);
      }
      if (entry.isDirectory()) {
        const found = findFileRecursive(path.join(dir, entry.name), name, depth - 1);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

/* ── 유틸리티 ─────────────────────────────────────────── */
function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
}

function cleanTmpFiles(prefix: string) {
  if (!existsSync(TMP_DIR)) return;
  for (const f of readdirSync(TMP_DIR)) {
    if (f.startsWith(prefix)) {
      try { unlinkSync(path.join(TMP_DIR, f)); } catch {}
    }
  }
}

function normalizeTime(t: string): string {
  const parts = t.split(":").map(Number);
  if (parts.length === 2) return `00:${String(parts[0]).padStart(2, "0")}:${String(parts[1]).padStart(2, "0")}`;
  return t;
}

function timeToSec(t: string): number {
  const parts = t.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

/**
 * POST /api/pipeline/[id]/download
 * body: { mode: "single" | "merged", ytVideoId, clips: [{startTime, endTime, label}] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const prefix = `dl_${id}`;

  try {
    const { mode, ytVideoId, clips } = await req.json();

    if (!ytVideoId || !clips || clips.length === 0) {
      return NextResponse.json({ error: "영상 ID와 클립 정보가 필요합니다." }, { status: 400 });
    }

    ensureTmpDir();
    cleanTmpFiles(prefix);

    // 바이너리 경로 자동 탐색
    let ytdlp: string;
    try { ytdlp = findBinary("yt-dlp", []); } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }

    let ffmpeg: string;
    try { ffmpeg = findBinary("ffmpeg", []); } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }

    console.log("[download] yt-dlp:", ytdlp, "| ffmpeg:", ffmpeg);

    const ytUrl = `https://www.youtube.com/watch?v=${ytVideoId}`;

    // 1. yt-dlp로 원본 영상 다운로드 (HD 1080p 우선)
    const sourcePath = path.join(TMP_DIR, `${prefix}_source.mp4`);

    if (!existsSync(sourcePath)) {
      // 이전 시도의 잔여 파일 정리 (부분 다운로드)
      for (const f of readdirSync(TMP_DIR)) {
        if (f.startsWith(prefix) && f !== path.basename(sourcePath)) {
          try { unlinkSync(path.join(TMP_DIR, f)); } catch {}
        }
      }
      try {
        console.log("[download] yt-dlp 다운로드 시작:", ytUrl);
        execFileSync(ytdlp, [
          "-f", "best[height<=1080]/best",
          "--no-check-certificates",
          "--no-warnings",
          "-o", sourcePath,
          ytUrl,
        ], { timeout: 600000, stdio: ["pipe", "pipe", "pipe"] }); // 10분 타임아웃
        console.log("[download] yt-dlp 다운로드 완료");
      } catch (e: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stderr = (e as any)?.stderr?.toString?.() || "";
        const errMsg = stderr || (e instanceof Error ? e.message : String(e));
        console.error("[download] yt-dlp 에러:", errMsg.slice(0, 500));
        return NextResponse.json(
          { error: `영상 다운로드 실패: ${errMsg.slice(0, 200)}` },
          { status: 500 }
        );
      }
    }

    if (!existsSync(sourcePath)) {
      return NextResponse.json({ error: "영상 파일을 다운로드할 수 없습니다." }, { status: 500 });
    }

    if (mode === "single") {
      const clip = clips[0];
      const start = normalizeTime(clip.startTime);
      const duration = timeToSec(normalizeTime(clip.endTime)) - timeToSec(start);
      const outPath = path.join(TMP_DIR, `${prefix}_clip.mp4`);

      console.log("[download] ffmpeg 트림:", start, "→", duration, "초");
      execFileSync(ffmpeg, [
        "-y", "-ss", start, "-i", sourcePath,
        "-t", String(duration),
        "-c", "copy",       // 재인코딩 없이 빠른 복사
        "-movflags", "+faststart",
        outPath,
      ], { timeout: 60000, stdio: "pipe" });

      const fileData = readFileSync(outPath);
      cleanTmpFiles(prefix);

      const label = clip.label || "clip";
      const filename = `KContent_${label}_${start.replace(/:/g, "")}.mp4`;

      return new NextResponse(fileData, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
          "Content-Length": String(fileData.length),
        },
      });
    }

    if (mode === "merged") {
      const clipPaths: string[] = [];

      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        const start = normalizeTime(clip.startTime);
        const duration = timeToSec(normalizeTime(clip.endTime)) - timeToSec(start);
        const clipPath = path.join(TMP_DIR, `${prefix}_part${i}.mp4`);

        console.log(`[download] 클립 ${i + 1}/${clips.length} 트림:`, start, "→", duration, "초");
        execFileSync(ffmpeg, [
          "-y", "-ss", start, "-i", sourcePath,
          "-t", String(duration),
          "-c", "copy",
          "-movflags", "+faststart",
          clipPath,
        ], { timeout: 60000, stdio: "pipe" });

        clipPaths.push(clipPath);
      }

      // concat  리스트 파일
      const concatFile = path.join(TMP_DIR, `${prefix}_list.txt`);
      const concatContent = clipPaths.map(p => `file '${p.replace(/\\/g, "/")}'`).join("\n");
      writeFileSync(concatFile, concatContent, "utf8");

      const mergedPath = path.join(TMP_DIR, `${prefix}_merged.mp4`);
      console.log("[download] ffmpeg concat:", clips.length, "개 클립 병합");
      execFileSync(ffmpeg, [
        "-y", "-f", "concat", "-safe", "0", "-i", concatFile,
        "-c", "copy",
        "-movflags", "+faststart",
        mergedPath,
      ], { timeout: 300000, stdio: "pipe" });

      const fileData = readFileSync(mergedPath);
      cleanTmpFiles(prefix);

      const filename = `KContent_Full_${clips.length}clips.mp4`;

      return new NextResponse(fileData, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
          "Content-Length": String(fileData.length),
        },
      });
    }

    return NextResponse.json({ error: "mode는 'single' 또는 'merged'여야 합니다." }, { status: 400 });

  } catch (e) {
    cleanTmpFiles(prefix);
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("[download] 에러:", errMsg);
    return NextResponse.json(
      { error: `HD 저장 처리 중 오류: ${errMsg.slice(0, 300)}` },
      { status: 500 }
    );
  }
}
