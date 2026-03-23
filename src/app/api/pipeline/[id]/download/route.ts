import { NextRequest, NextResponse } from "next/server";
import { execSync, execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "fs";
import path from "path";

const TMP_DIR = path.join(process.cwd(), "tmp_downloads");

function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
}

function cleanTmpDir() {
  if (!existsSync(TMP_DIR)) return;
  for (const f of readdirSync(TMP_DIR)) {
    try { unlinkSync(path.join(TMP_DIR, f)); } catch {}
  }
}

/** HH:MM:SS or MM:SS → ffmpeg-compatible HH:MM:SS */
function normalizeTime(t: string): string {
  const parts = t.split(":").map(Number);
  if (parts.length === 2) return `00:${t}`;
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
  try {
    const { mode, ytVideoId, clips } = await req.json();

    if (!ytVideoId || !clips || clips.length === 0) {
      return NextResponse.json({ error: "영상 ID와 클립 정보가 필요합니다." }, { status: 400 });
    }

    ensureTmpDir();
    cleanTmpDir();

    const ytUrl = `https://www.youtube.com/watch?v=${ytVideoId}`;

    // 1. yt-dlp로 원본 영상 다운로드 (HD 1080p 우선)
    const sourcePath = path.join(TMP_DIR, `source_${id}.mp4`);

    if (!existsSync(sourcePath)) {
      try {
        execSync(
          `yt-dlp -f "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best" --merge-output-format mp4 -o "${sourcePath}" "${ytUrl}"`,
          { timeout: 300000, stdio: "pipe" } // 5분 타임아웃
        );
      } catch (dlError) {
        // yt-dlp가 PATH에 없을 수 있으므로 python -m yt_dlp 시도
        try {
          execSync(
            `python -m yt_dlp -f "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best" --merge-output-format mp4 -o "${sourcePath}" "${ytUrl}"`,
            { timeout: 300000, stdio: "pipe" }
          );
        } catch {
          return NextResponse.json(
            { error: `영상 다운로드 실패: ${String(dlError).slice(0, 200)}` },
            { status: 500 }
          );
        }
      }
    }

    if (!existsSync(sourcePath)) {
      return NextResponse.json({ error: "영상 파일을 다운로드할 수 없습니다." }, { status: 500 });
    }

    // ffmpeg 경로 감지
    let ffmpegCmd = "ffmpeg";
    try {
      execSync(`${ffmpegCmd} -version`, { stdio: "pipe" });
    } catch {
      // winget으로 설치된 ffmpeg 경로 시도
      const wingetPath = "C:\\Users\\" + (process.env.USERNAME || process.env.USER || "choon")
        + "\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffmpeg.exe";
      if (existsSync(wingetPath)) {
        ffmpegCmd = `"${wingetPath}"`;
      } else {
        return NextResponse.json({ error: "ffmpeg가 설치되어 있지 않습니다." }, { status: 500 });
      }
    }

    if (mode === "single") {
      // 단일 클립 트림
      const clip = clips[0];
      const start = normalizeTime(clip.startTime);
      const end = normalizeTime(clip.endTime);
      const duration = timeToSec(end) - timeToSec(start);
      const outPath = path.join(TMP_DIR, `clip_${id}_single.mp4`);

      execFileSync(ffmpegCmd.replace(/"/g, ""), [
        "-y", "-ss", start, "-i", sourcePath,
        "-t", String(duration),
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        outPath,
      ], { timeout: 120000, stdio: "pipe" });

      const fileData = readFileSync(outPath);
      cleanTmpDir();

      const label = clip.label || "clip";
      const filename = `KContent_${label}_${start.replace(/:/g, "")}-${end.replace(/:/g, "")}.mp4`;

      return new NextResponse(fileData, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(fileData.length),
        },
      });
    }

    if (mode === "merged") {
      // 여러 클립을 트림 후 병합
      const clipPaths: string[] = [];

      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        const start = normalizeTime(clip.startTime);
        const end = normalizeTime(clip.endTime);
        const duration = timeToSec(end) - timeToSec(start);
        const clipPath = path.join(TMP_DIR, `clip_${id}_${i}.mp4`);

        execFileSync(ffmpegCmd.replace(/"/g, ""), [
          "-y", "-ss", start, "-i", sourcePath,
          "-t", String(duration),
          "-c:v", "libx264", "-preset", "fast", "-crf", "18",
          "-c:a", "aac", "-b:a", "192k",
          "-movflags", "+faststart",
          clipPath,
        ], { timeout: 120000, stdio: "pipe" });

        clipPaths.push(clipPath);
      }

      // concat 파일 생성
      const concatFile = path.join(TMP_DIR, `concat_${id}.txt`);
      const concatContent = clipPaths.map(p => `file '${p.replace(/\\/g, "/")}'`).join("\n");
      writeFileSync(concatFile, concatContent);

      // ffmpeg concat
      const mergedPath = path.join(TMP_DIR, `merged_${id}.mp4`);
      execFileSync(ffmpegCmd.replace(/"/g, ""), [
        "-y", "-f", "concat", "-safe", "0", "-i", concatFile,
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        mergedPath,
      ], { timeout: 300000, stdio: "pipe" });

      const fileData = readFileSync(mergedPath);
      cleanTmpDir();

      const filename = `KContent_Full_${clips.length}clips_${new Date().toISOString().slice(0, 10)}.mp4`;

      return new NextResponse(fileData, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(fileData.length),
        },
      });
    }

    return NextResponse.json({ error: "mode는 'single' 또는 'merged'여야 합니다." }, { status: 400 });

  } catch (e) {
    cleanTmpDir();
    return NextResponse.json(
      { error: `HD 저장 처리 중 오류: ${String(e).slice(0, 300)}` },
      { status: 500 }
    );
  }
}
