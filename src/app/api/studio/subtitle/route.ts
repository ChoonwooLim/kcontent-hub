import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, mkdirSync, unlinkSync, readdirSync } from "fs";
import { spawn, execSync } from "child_process";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 300; // yt-dlp + Whisper API는 시간이 걸릴 수 있음

const TMP_DIR = path.join(process.cwd(), "media", "downloads");
const SAVED_DIR = path.join(TMP_DIR, "saved");
const isWindows = process.platform === "win32";

/* ── 바이너리 경로 자동 탐색 (download route와 동일 로직) ── */
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

/**
 * yt-dlp로 YouTube 영상의 오디오만 다운로드 (Whisper용)
 * - 오디오 전용: 빠르고 용량 작음
 * - 최대 25MB (Whisper API 제한)
 */
async function downloadAudioForWhisper(ytVideoId: string): Promise<string> {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

  const ytdlp = findBinary("yt-dlp");
  const ytUrl = `https://www.youtube.com/watch?v=${ytVideoId}`;
  const audioPath = path.join(TMP_DIR, `whisper_${ytVideoId}_${Date.now()}.m4a`);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ytdlp, [
      "-f", "bestaudio[ext=m4a]/bestaudio",
      "--no-check-certificates",
      "-o", audioPath,
      ytUrl,
    ]);

    let stderrBuf = "";
    proc.stderr.on("data", (d: Buffer) => { stderrBuf += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp 오디오 다운로드 실패 (코드:${code}): ${stderrBuf.slice(-200)}`));
    });
    proc.on("error", reject);
    // 3분 타임아웃 (오디오는 빠름)
    setTimeout(() => { proc.kill(); reject(new Error("오디오 다운로드 시간 초과 (3분)")); }, 180000);
  });

  if (!existsSync(audioPath)) {
    throw new Error("오디오 파일 다운로드 실패");
  }

  return audioPath;
}

/**
 * ffmpeg로 영상 파일에서 오디오만 추출 (Whisper 25MB 제한 대응)
 * - m4a 포맷, 모노, 16kHz (Whisper 최적)
 * - 원본 200~500MB → 오디오 5~15MB
 */
async function extractAudioWithFFmpeg(videoPath: string): Promise<string> {
  const ffmpeg = findBinary("ffmpeg");
  const audioPath = path.join(TMP_DIR, `whisper_audio_${Date.now()}.m4a`);

  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpeg, [
      "-y",
      "-i", videoPath,
      "-vn",                    // 비디오 제거
      "-acodec", "aac",         // AAC 코덱
      "-ar", "16000",           // 16kHz (Whisper 최적 샘플레이트)
      "-ac", "1",               // 모노
      "-b:a", "64k",            // 64kbps (8분 ≈ 3.8MB)
      "-movflags", "+faststart",
      audioPath,
    ]);

    let stderrBuf = "";
    proc.stderr.on("data", (d: Buffer) => { stderrBuf += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg 오디오 추출 실패 (코드:${code}): ${stderrBuf.slice(-200)}`));
    });
    proc.on("error", reject);
    // 2분 타임아웃
    setTimeout(() => { proc.kill(); reject(new Error("오디오 추출 시간 초과 (2분)")); }, 120000);
  });

  if (!existsSync(audioPath)) {
    throw new Error("오디오 추출 파일이 생성되지 않았습니다.");
  }

  return audioPath;
}

/**
 * Whisper API로 오디오 파일 음성 분석
 * - 25MB 파일 크기 제한 (Whisper API 제한)
 * - 4분 타임아웃
 */
async function whisperTranscribe(
  filePath: string,
  openaiKey: string,
  mimeType = "audio/mp4"
): Promise<{
  subs: { id: number; start: number; end: number; text: string; type: string }[];
  language: string;
}> {
  const fileBuffer = readFileSync(filePath);
  const filename = path.basename(filePath);

  // 25MB 제한 체크
  const MAX_SIZE = 25 * 1024 * 1024;
  if (fileBuffer.length > MAX_SIZE) {
    throw new Error(`파일 크기(${Math.round(fileBuffer.length / 1024 / 1024)}MB)가 Whisper API 제한(25MB)을 초과합니다.`);
  }

  const fileBlob = new Blob([fileBuffer], { type: mimeType });

  const formData = new FormData();
  formData.append("file", fileBlob, filename);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");

  // 4분 타임아웃
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240000);

  let whisperRes: Response;
  try {
    whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiKey}` },
      body: formData,
      signal: controller.signal,
    });
  } catch (fetchErr) {
    clearTimeout(timeout);
    if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
      throw new Error("Whisper API 요청 시간 초과 (4분). 파일이 너무 크거나 서버가 응답하지 않습니다.");
    }
    throw fetchErr;
  } finally {
    clearTimeout(timeout);
  }

  if (!whisperRes.ok) {
    const errText = await whisperRes.text().catch(() => "");
    let errMsg = errText;
    try { errMsg = JSON.stringify(JSON.parse(errText)); } catch { /* keep as text */ }
    throw new Error(`Whisper API 오류 (${whisperRes.status}): ${errMsg.slice(0, 300)}`);
  }

  const whisperData = await whisperRes.json() as {
    segments?: { id: number; start: number; end: number; text: string }[];
    text?: string;
    language?: string;
  };

  if (!whisperData.segments || whisperData.segments.length === 0) {
    return {
      language: whisperData.language || "unknown",
      subs: [{
        id: 1, start: 0, end: 30,
        text: whisperData.text || "(음성이 감지되지 않았습니다)",
        type: "narration",
      }],
    };
  }

  return {
    language: whisperData.language || "unknown",
    subs: whisperData.segments.map((seg, i) => ({
      id: i + 1,
      start: Math.round(seg.start * 10) / 10,
      end: Math.round(seg.end * 10) / 10,
      text: seg.text.trim(),
      type: "narration",
    })),
  };
}

/**
 * POST /api/studio/subtitle
 * body: { action: "extract" | "translate", videoId?, fileVideoUrl?, subs? }
 *
 * extract: YouTube CC 자막 → 실패 시 yt-dlp 오디오 + Whisper 음성 분석
 * translate: 자막을 한국어로 번역 (GPT-4o)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ── 1. 자막 추출 (스마트 모드: CC → Whisper 자동 폴백) ──
    if (action === "extract") {
      const { videoId, fileVideoUrl } = body;
      const openaiKey = process.env.OPENAI_API_KEY;

      // ── A. 파일 모드: ffmpeg 오디오 추출 → Whisper API 음성 분석 ──
      if (fileVideoUrl) {
        if (!openaiKey) return NextResponse.json({ error: "OpenAI API 키가 설정되지 않았습니다." }, { status: 500 });

        const filename = decodeURIComponent(fileVideoUrl.split("/").pop() || "");
        let filepath = path.join(SAVED_DIR, filename);
        if (!existsSync(filepath)) {
          filepath = path.join(TMP_DIR, filename);
        }

        if (!filepath.startsWith(TMP_DIR) || !existsSync(filepath)) {
          return NextResponse.json({ error: `영상 파일을 찾을 수 없습니다: ${filename}` }, { status: 404 });
        }

        // ffmpeg로 오디오만 추출 (HD 영상 200~500MB → 오디오 3~15MB)
        let audioPath: string | null = null;
        try {
          audioPath = await extractAudioWithFFmpeg(filepath);
          const result = await whisperTranscribe(audioPath, openaiKey, "audio/mp4");

          return NextResponse.json({
            success: true,
            method: "whisper",
            language: result.language,
            segmentCount: result.subs.length,
            subs: result.subs,
            message: `🎤 Whisper 음성 분석 완료 — ${result.subs.length}개 자막 추출 (언어: ${result.language})`,
          });
        } catch (err) {
          return NextResponse.json({
            error: `음성 분석 실패: ${String(err).slice(0, 300)}`,
          }, { status: 422 });
        } finally {
          // 임시 오디오 파일 정리
          if (audioPath && existsSync(audioPath)) {
            try { unlinkSync(audioPath); } catch {}
          }
        }
      }

      // ── B. YouTube 영상: CC 자막 → 실패 시 Whisper 폴백 ──
      if (videoId) {
        // Step 1: YouTube CC 자막 시도
        try {
          const { YoutubeTranscript } = await import("youtube-transcript");
          const raw = await YoutubeTranscript.fetchTranscript(videoId);

          if (raw && raw.length > 0) {
            const transcript = raw.map((seg: { offset: number; duration: number; text: string }, i: number) => {
              const startSec = Math.round((seg.offset / 1000) * 10) / 10;
              const endSec = Math.round((startSec + seg.duration / 1000) * 10) / 10;
              return {
                id: i + 1,
                start: startSec,
                end: endSec,
                text: seg.text,
                type: "narration",
              };
            });

            return NextResponse.json({
              success: true,
              method: "youtube_cc",
              segmentCount: transcript.length,
              subs: transcript,
              message: `📝 YouTube CC 자막 추출 완료 — ${transcript.length}개 자막`,
            });
          }
        } catch {
          // CC 자막 없음 → Whisper 폴백으로 진행
        }

        // Step 2: Whisper 폴백 — yt-dlp로 오디오 다운로드 후 음성 분석
        if (!openaiKey) {
          return NextResponse.json({
            error: "YouTube CC 자막이 없습니다. Whisper 음성 분석을 위해 OpenAI API 키가 필요합니다.",
          }, { status: 500 });
        }

        let audioPath: string | null = null;
        try {
          // 오디오 다운로드
          audioPath = await downloadAudioForWhisper(videoId);

          // Whisper 음성 분석
          const result = await whisperTranscribe(audioPath, openaiKey, "audio/mp4");

          return NextResponse.json({
            success: true,
            method: "whisper_fallback",
            language: result.language,
            segmentCount: result.subs.length,
            subs: result.subs,
            message: `🎤 YouTube CC 자막 없음 → Whisper 음성 분석으로 ${result.subs.length}개 자막 추출 완료 (언어: ${result.language})`,
          });
        } catch (whisperErr) {
          return NextResponse.json({
            error: `YouTube CC 자막 없음 & Whisper 음성 분석 실패: ${String(whisperErr).slice(0, 300)}`,
            suggestion: "영상의 오디오를 추출할 수 없거나, OpenAI API 한도를 초과했을 수 있습니다.",
          }, { status: 422 });
        } finally {
          // 임시 오디오 파일 정리
          if (audioPath && existsSync(audioPath)) {
            try { unlinkSync(audioPath); } catch {}
          }
        }
      }

      return NextResponse.json({ error: "fileVideoUrl 또는 videoId가 필요합니다." }, { status: 400 });
    }

    // ── 2. 한국어 번역 (GPT-4o) ──
    if (action === "translate") {
      const { subs } = body as { subs: { id: number; start: number; end: number; text: string; type: string }[] };
      if (!subs?.length) return NextResponse.json({ error: "자막 데이터가 필요합니다." }, { status: 400 });

      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) return NextResponse.json({ error: "OpenAI API 키가 설정되지 않았습니다." }, { status: 500 });

      const CHUNK_SIZE = 30;
      const translated: typeof subs = [];

      for (let i = 0; i < subs.length; i += CHUNK_SIZE) {
        const chunk = subs.slice(i, i + CHUNK_SIZE);
        const chunkText = chunk.map((s, idx) => `[${idx}] ${s.text}`).join("\n");

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            temperature: 0.3,
            messages: [
              {
                role: "system",
                content: `당신은 10년 차 지상파 방송 예능/다큐 전속 작가 겸 최고 수준의 영상 번역 전문가입니다. 기계적인 직역을 극도로 혐오하며, 시청자를 단숨에 몰입시키는 생동감 넘치고 맛깔스러운 방송 자막(대본)을 작성합니다.

■ 하이퀄리티 번역 및 윤문 규칙:
1. 영혼을 담은 초월 번역: 외국어 원문의 맥락과 감정을 200% 증폭시켜, 한국인 시청자가 가장 빵 터지거나 깊이 공감할 수 있는 찰진 구어체로 싹 다듬어주세요.
2. 디테일과 스토리텔링: 원문이 짧고 뚝뚝 끊기더라도, 프로 작가의 역량을 발휘하여 문맥 사이사이에 생생한 묘사와 뉘앙스를 덧붙여 한 편의 흥미진진한 이야기처럼 유려하게 연결해주세요.
3. 트렌디한 방송 언어: 다큐멘터리의 성우 나레이션이나 예능 프로그램의 쫀득한 자막처럼 텐션 조절을 확실하게 해주세요. 촌스러운 표현은 절대 금지!
4. 고유명사 센스: 장소, 음식 등은 시청자가 단번에 클릭하고 싶게 매력적인 수식어를 살포시 덧붙여도 좋습니다. (한글 + 필요시 영문 병기)
5. 반드시 아래 JSON 배열 형식만 정확히 반환하세요:
{"translations": [{"idx": 0, "ko": "기가 막히게 번역된 내용"}, ...]}`
              },
              {
                role: "user",
                content: `다음 영상 자막을 한국어로 번역:\n\n${chunkText}`
              }
            ],
            response_format: { type: "json_object" },
          }),
        });

        const data = await res.json();
        let translations: { idx: number; ko: string }[] = [];

        try {
          const content = data.choices?.[0]?.message?.content || "{}";
          const parsed = JSON.parse(content);
          translations = parsed.translations || parsed.result || (Array.isArray(parsed) ? parsed : []);
        } catch {
          translations = chunk.map((_, idx) => ({ idx, ko: chunk[idx].text }));
        }

        for (let j = 0; j < chunk.length; j++) {
          const tr = translations.find(t => t.idx === j);
          translated.push({
            ...chunk[j],
            text: tr?.ko || chunk[j].text,
          });
        }
      }

      return NextResponse.json({ success: true, subs: translated });
    }

    return NextResponse.json({ error: "action은 'extract' 또는 'translate'여야 합니다." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: `서버 오류: ${String(e).slice(0, 300)}` }, { status: 500 });
  }
}
