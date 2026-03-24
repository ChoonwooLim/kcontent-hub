import { NextRequest, NextResponse } from "next/server";
import { spawn, execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "fs";
import path from "path";

/* ── 바이너리 경로 자동 탐색 ─────────────────────────── */
const TMP_DIR = path.join(process.cwd(), "tmp_downloads");
const isWindows = process.platform === "win32";

function findBinary(name: string): string {
  try {
    const cmd = isWindows ? `where ${name}` : `which ${name}`;
    const result = execSync(cmd, { stdio: "pipe", timeout: 5000 }).toString().trim().split("\n")[0].trim();
    if (result && existsSync(result)) return result;
  } catch {}

  if (isWindows) {
    const username = process.env.USERNAME || process.env.USER || "choon";
    const searchBases = [
      `C:\\Users\\${username}\\AppData\\Local\\Microsoft\\WinGet\\Packages`,
      `C:\\Users\\${username}\\AppData\\Local\\Programs\\Python`,
    ];
    for (const base of searchBases) {
      if (!existsSync(base)) continue;
      const found = findFileRecursive(base, `${name}.exe`, 5);
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

function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
}

function normalizeTime(t: string): string {
  const parts = t.split(":").map(Number);
  if (parts.length === 2) return `00:${String(parts[0]).padStart(2, "0")}:${String(parts[1]).padStart(2, "0")}`;
  return t;
}

function timeToSec(t: string): number {
  const p = t.split(":").map(Number);
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0];
}

/* ── 작업 상태 파일 관리 ──────────────────────────────── */
interface JobStatus {
  status: "downloading" | "trimming" | "merging" | "done" | "error";
  progress: number; // 0-100
  message: string;
  filename?: string;
  filePath?: string;
}

function jobStatusPath(jobId: string) { return path.join(TMP_DIR, `job_${jobId}.json`); }

function writeJobStatus(jobId: string, status: JobStatus) {
  writeFileSync(jobStatusPath(jobId), JSON.stringify(status), "utf8");
}

function readJobStatus(jobId: string): JobStatus | null {
  const p = jobStatusPath(jobId);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

/* ── 백그라운드 다운로드 함수 ─────────────────────────── */
async function processDownloadJob(
  jobId: string, ytVideoId: string, mode: string,
  clips: { startTime: string; endTime: string; label?: string }[]
) {
  try {
    const ytdlp = findBinary("yt-dlp");
    const ffmpeg = findBinary("ffmpeg");
    const ytUrl = `https://www.youtube.com/watch?v=${ytVideoId}`;
    const sourcePath = path.join(TMP_DIR, `job_${jobId}_source.mp4`);

    // 1단계: yt-dlp 다운로드 (진행률 캡처)
    if (!existsSync(sourcePath)) {
      writeJobStatus(jobId, { status: "downloading", progress: 0, message: "영상 다운로드 시작..." });

      await new Promise<void>((resolve, reject) => {
        const proc = spawn(ytdlp, [
          "-f", "best[height<=1080]/best",
          "--no-check-certificates",
          "--newline",        // 진행률을 줄바꿈으로 출력
          "-o", sourcePath,
          ytUrl,
        ]);

        proc.stdout.on("data", (data: Buffer) => {
          const line = data.toString();
          const match = line.match(/(\d+\.?\d*)%/);
          if (match) {
            const pct = Math.min(parseFloat(match[1]), 99);
            writeJobStatus(jobId, {
              status: "downloading",
              progress: Math.round(pct * 0.7), // 다운로드 = 전체의 70%
              message: `영상 다운로드 중... ${pct.toFixed(1)}%`,
            });
          }
        });

        proc.stderr.on("data", (data: Buffer) => {
          const line = data.toString();
          const match = line.match(/(\d+\.?\d*)%/);
          if (match) {
            const pct = Math.min(parseFloat(match[1]), 99);
            writeJobStatus(jobId, {
              status: "downloading",
              progress: Math.round(pct * 0.7),
              message: `영상 다운로드 중... ${pct.toFixed(1)}%`,
            });
          }
        });

        proc.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`yt-dlp 종료 코드: ${code}`));
        });

        proc.on("error", reject);

        // 10분 타임아웃
        setTimeout(() => { proc.kill(); reject(new Error("다운로드 시간 초과 (10분)")); }, 600000);
      });
    }

    if (!existsSync(sourcePath)) {
      writeJobStatus(jobId, { status: "error", progress: 0, message: "영상 파일을 다운로드할 수 없습니다." });
      return;
    }

    // 2단계: ffmpeg 트림 (-c copy는 매우 빠름)
    if (mode === "single") {
      const clip = clips[0];
      const start = normalizeTime(clip.startTime);
      const duration = timeToSec(normalizeTime(clip.endTime)) - timeToSec(start);
      const outPath = path.join(TMP_DIR, `job_${jobId}_out.mp4`);

      writeJobStatus(jobId, { status: "trimming", progress: 75, message: `클립 트림 중... (${Math.round(duration)}초 구간)` });

      await runFFmpegSimple(ffmpeg, [
        "-y", "-ss", start, "-i", sourcePath,
        "-t", String(duration), "-c", "copy", "-movflags", "+faststart", outPath,
      ]);

      const label = clip.label || "clip";
      const filename = `KContent_${label}_${start.replace(/:/g, "")}.mp4`;

      writeJobStatus(jobId, {
        status: "done", progress: 100,
        message: "다운로드 완료!", filename, filePath: outPath,
      });
    } else {
      // merged — 트림 단계 (72% ~ 90%)
      const clipPaths: string[] = [];
      
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        const start = normalizeTime(clip.startTime);
        const duration = timeToSec(normalizeTime(clip.endTime)) - timeToSec(start);
        const clipPath = path.join(TMP_DIR, `job_${jobId}_part${i}.mp4`);

        writeJobStatus(jobId, {
          status: "trimming",
          progress: 72 + Math.round(((i + 0.5) / clips.length) * 18),
          message: `클립 ${i + 1}/${clips.length} 트림 중... (${Math.round(duration)}초 구간)`,
        });

        await runFFmpegSimple(ffmpeg, [
          "-y", "-ss", start, "-i", sourcePath,
          "-t", String(duration), "-c", "copy", "-movflags", "+faststart", clipPath,
        ]);

        writeJobStatus(jobId, {
          status: "trimming",
          progress: 72 + Math.round(((i + 1) / clips.length) * 18),
          message: `클립 ${i + 1}/${clips.length} 트림 완료 ✓`,
        });

        clipPaths.push(clipPath);
      }

      // 3단계: 병합 (90% ~ 98%) — -c copy concat은 수초 내 완료
      writeJobStatus(jobId, { status: "merging", progress: 92, message: `${clips.length}개 클립 병합 중...` });
      const concatFile = path.join(TMP_DIR, `job_${jobId}_list.txt`);
      writeFileSync(concatFile, clipPaths.map(p => `file '${p.replace(/\\/g, "/")}'`).join("\n"), "utf8");

      const mergedPath = path.join(TMP_DIR, `job_${jobId}_out.mp4`);
      await runFFmpegSimple(ffmpeg, [
        "-y", "-f", "concat", "-safe", "0", "-i", concatFile,
        "-c", "copy", "-movflags", "+faststart", mergedPath,
      ]);

      writeJobStatus(jobId, { status: "merging", progress: 98, message: "병합 완료, 파일 준비 중..." });

      const filename = `KContent_Full_${clips.length}clips.mp4`;
      writeJobStatus(jobId, {
        status: "done", progress: 100,
        message: "다운로드 완료!", filename, filePath: mergedPath,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    writeJobStatus(jobId, { status: "error", progress: 0, message: msg.slice(0, 300) });
  }
}

/** ffmpeg 실행 — 단순 모드 (-c copy용, progress 없음, 빠름) */
function runFFmpegSimple(ffmpeg: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, args, { stdio: ["pipe", "pipe", "pipe"] });
    // stderr 에러 메시지 캡처
    let stderrBuf = "";
    proc.stderr.on("data", (d: Buffer) => { stderrBuf += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg 오류 (코드:${code}): ${stderrBuf.slice(-200)}`));
    });
    proc.on("error", reject);
    setTimeout(() => { proc.kill(); reject(new Error("ffmpeg 시간 초과 (5분)")); }, 300000);
  });
}

/**
 * POST /api/pipeline/[id]/download
 * body: { action: "start", mode, ytVideoId, clips } → 작업 시작, jobId 반환
 * body: { action: "status", jobId } → 진행 상태 반환
 * body: { action: "file", jobId } → 완성된 파일 반환
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  ensureTmpDir();

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "start") {
      const { mode, ytVideoId, clips } = body;
      if (!ytVideoId || !clips?.length) {
        return NextResponse.json({ error: "영상 ID와 클립 정보가 필요합니다." }, { status: 400 });
      }

      const jobId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      writeJobStatus(jobId, { status: "downloading", progress: 0, message: "작업 시작..." });

      // 백그라운드에서 실행 (await 안 함!)
      processDownloadJob(jobId, ytVideoId, mode, clips).catch(() => {});

      return NextResponse.json({ jobId });
    }

    if (action === "status") {
      const { jobId } = body;
      const status = readJobStatus(jobId);
      if (!status) return NextResponse.json({ error: "작업을 찾을 수 없습니다." }, { status: 404 });
      return NextResponse.json(status);
    }

    if (action === "file") {
      const { jobId, pipelineVideoId } = body;
      const status = readJobStatus(jobId);
      if (!status || status.status !== "done" || !status.filePath) {
        return NextResponse.json({ error: "파일이 준비되지 않았습니다." }, { status: 400 });
      }

      const fileData = readFileSync(status.filePath);
      const filename = status.filename || "download.mp4";

      // 영구 저장: tmp에서 permanent 디렉터리로 복사
      const permanentDir = path.join(TMP_DIR, "saved");
      if (!existsSync(permanentDir)) mkdirSync(permanentDir, { recursive: true });
      const permanentPath = path.join(permanentDir, filename);
      writeFileSync(permanentPath, fileData);

      // DB에 다운로드 기록 저장
      try {
        const { prisma: db } = await import("@/lib/prisma");
        const ws = await db.workspace.findFirst();
        if (ws) {
          await db.downloadedFile.create({
            data: {
              filename,
              filepath: permanentPath,
              size: fileData.length,
              mode: filename.includes("Full") ? "merged" : "single",
              clipCount: filename.match(/(\d+)clips/) ? parseInt(filename.match(/(\d+)clips/)![1]) : 1,
              videoId: pipelineVideoId || null,
              workspaceId: ws.id,
            },
          });
        }
      } catch { /* DB 저장 실패해도 파일은 반환 */ }

      // 임시 파일 정리 (saved 폴더 제외)
      for (const f of readdirSync(TMP_DIR)) {
        if (f.startsWith(`job_${jobId}`)) {
          try { unlinkSync(path.join(TMP_DIR, f)); } catch {}
        }
      }

      return new NextResponse(fileData, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
          "Content-Length": String(fileData.length),
        },
      });
    }

    return NextResponse.json({ error: "action은 'start', 'status', 'file' 중 하나여야 합니다." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: `서버 오류: ${String(e).slice(0, 200)}` }, { status: 500 });
  }
}
