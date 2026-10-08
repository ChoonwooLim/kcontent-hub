import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, mkdirSync, unlinkSync, readdirSync } from "fs";
import { spawn, execSync } from "child_process";
import path from "path";
import {
  LANGS,
  type LangCode,
  isLangCode,
  normalizeLangCode,
  detectLangFromTexts,
  decodeEntities,
  normalizeCues,
  mergeFragmentCues,
  detectChineseScript,
} from "@/lib/subtitle-lang";
import { requireUser, resolveOpenAIKey, keyRequiredResponse } from "@/lib/access";
import { type EngineConfig, type Provider, engineLabel, chunkSizeFor, engineForUser } from "@/lib/translate-engine";
import { resolveYtDlp } from "@/lib/ytdlp";

export const runtime = "nodejs";
export const maxDuration = 300; // yt-dlp + Whisper API는 시간이 걸릴 수 있음

const TMP_DIR = path.join(process.cwd(), "media", "downloads");
const SAVED_DIR = path.join(TMP_DIR, "saved");
const isWindows = process.platform === "win32";

type Sub = { id: number; start: number; end: number; text: string; type: string };
type TranslateStyle = "broadcast" | "faithful";

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

  const yt = await resolveYtDlp(); // 최신 yt-dlp (media/bin, 자동 갱신) — 패키지 버전은 403 이 남
  const ytUrl = `https://www.youtube.com/watch?v=${ytVideoId}`;
  const audioPath = path.join(TMP_DIR, `whisper_${ytVideoId}_${Date.now()}.m4a`);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(yt.cmd, [
      ...yt.baseArgs,
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
 * - languageHint: 원본 언어를 알면 전달 (인식 정확도·속도 향상), 모르면 Whisper 자동 감지
 */
async function whisperTranscribe(
  filePath: string,
  openaiKey: string,
  mimeType = "audio/mp4",
  languageHint: LangCode | null = null,
): Promise<{ subs: Sub[]; language: LangCode | null; rawLanguage: string }> {
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
  if (languageHint) {
    formData.append("language", languageHint.startsWith("zh") ? "zh" : languageHint); // ISO-639-1 (중국어는 스크립트 구분 없음)
    // Whisper 는 간체/번체를 language 로 구분하지 못하므로 prompt 로 출력 스크립트를 유도
    if (languageHint === "zh-Hant") formData.append("prompt", "以下是繁體中文的字幕內容。");
    else if (languageHint === "zh") formData.append("prompt", "以下是简体中文的字幕内容。");
  }

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

  const rawLanguage = whisperData.language || "unknown";

  if (!whisperData.segments || whisperData.segments.length === 0) {
    return {
      rawLanguage,
      language: normalizeLangCode(rawLanguage) ?? languageHint,
      subs: [{
        id: 1, start: 0, end: 30,
        text: whisperData.text || "(음성이 감지되지 않았습니다)",
        type: "narration",
      }],
    };
  }

  const subs = whisperData.segments.map((seg, i) => ({
    id: i + 1,
    start: Math.round(seg.start * 10) / 10,
    end: Math.round(seg.end * 10) / 10,
    text: seg.text.trim(),
    type: "narration",
  }));

  return {
    rawLanguage,
    language: normalizeLangCode(rawLanguage) ?? languageHint ?? detectLangFromTexts(subs.map(s => s.text)),
    subs,
  };
}

/**
 * YouTube CC 자막 추출
 * - 원본 언어를 지정하면 해당 언어 트랙 후보(ko / en, en-US / zh-Hans, zh-CN ...)를 우선 시도
 * - 없으면 기본 트랙 → 그래도 없으면 null (호출부에서 Whisper 폴백)
 */
async function fetchYouTubeCC(
  videoId: string,
  sourceHint: LangCode | null,
): Promise<{ subs: Sub[]; language: LangCode | null; trackLang: string | null } | null> {
  const { YoutubeTranscript } = await import("youtube-transcript");
  const candidates: (string | null)[] = sourceHint ? [...LANGS[sourceHint].ytCodes, null] : [null];

  for (const lang of candidates) {
    try {
      const raw = await YoutubeTranscript.fetchTranscript(videoId, lang ? { lang } : undefined);
      if (!raw || raw.length === 0) continue;

      const subs: Sub[] = raw.map((seg: { offset: number; duration: number; text: string }, i: number) => {
        const startSec = Math.round((seg.offset / 1000) * 10) / 10;
        const endSec = Math.round((startSec + seg.duration / 1000) * 10) / 10;
        return {
          id: i + 1,
          start: startSec,
          end: endSec,
          text: decodeEntities(seg.text),
          type: "narration",
        };
      });

      const trackLang = (raw[0] as { lang?: string }).lang ?? lang ?? null;
      const language = normalizeLangCode(trackLang) ?? detectLangFromTexts(subs.map(s => s.text));
      return { subs, language, trackLang };
    } catch {
      // 해당 언어 트랙 없음 → 다음 후보
    }
  }
  return null;
}

/** 중국어는 트랙 코드만으로 간체/번체를 알 수 없는 경우가 많아 실제 자막의 한자로 판별 */
function refineChinese(lang: LangCode | null, texts: string[]): LangCode | null {
  if (lang !== "zh" && lang !== "zh-Hant") return lang;
  return detectChineseScript(texts.slice(0, 80).join("\n"));
}

/** 추출 결과 후처리: 겹치는 큐 정리 → 중국어 스크립트 판별 → (옵션) 짧은 조각 자막 병합 → id 재부여 */
function finalizeCues(subs: Sub[], lang: LangCode | null, merge: boolean): { subs: Sub[]; language: LangCode | null } {
  let out = normalizeCues(subs);
  const language = refineChinese(lang, out.map(s => s.text));
  if (merge) out = mergeFragmentCues(out, language);
  return { subs: out.map((s, i) => ({ ...s, id: i + 1 })), language };
}

/* ── 번역 프롬프트 (언어별 · 스타일별) ─────────────────────── */
const JSON_RULE = `Return ONLY a JSON object of this exact shape and nothing else:
{"translations": [{"idx": 0, "text": "..."}, ...]}
- Strict 1:1 mapping: exactly one output item per input line with the same idx. Never merge, split, drop or reorder lines.
- "text" must contain only the translated subtitle text — no idx prefix, no quotes around it, no notes, no source text.
- Do not leave any line untranslated.`;

function broadcastPrompt(target: LangCode, srcName: string): string {
  switch (target) {
    case "ko":
      return `당신은 10년 차 지상파 방송 예능/다큐 전속 작가 겸 최고 수준의 영상 번역 전문가입니다. 기계적인 직역을 극도로 혐오하며, 시청자를 단숨에 몰입시키는 생동감 넘치고 맛깔스러운 방송 자막(대본)을 작성합니다.

■ 하이퀄리티 번역 및 윤문 규칙:
1. 영혼을 담은 초월 번역: ${srcName} 원문의 맥락과 감정을 200% 증폭시켜, 한국인 시청자가 가장 빵 터지거나 깊이 공감할 수 있는 찰진 구어체로 싹 다듬어주세요.
2. 디테일과 스토리텔링: 원문이 짧고 뚝뚝 끊기더라도, 프로 작가의 역량을 발휘하여 문맥 사이사이에 생생한 묘사와 뉘앙스를 덧붙여 한 편의 흥미진진한 이야기처럼 유려하게 연결해주세요.
3. 트렌디한 방송 언어: 다큐멘터리의 성우 나레이션이나 예능 프로그램의 쫀득한 자막처럼 텐션 조절을 확실하게 해주세요. 촌스러운 표현은 절대 금지!
4. 고유명사 센스: 장소, 음식 등은 시청자가 단번에 클릭하고 싶게 매력적인 수식어를 살포시 덧붙여도 좋습니다. (한글 + 필요시 영문 병기)
5. 자막 길이: 한 줄은 대략 20자 내외, 최대 2줄로 읽기 편하게.`;
    case "en":
      return `You are a veteran broadcast writer and top-tier subtitle translator for English-language YouTube and streaming content. You despise stiff, literal translation and write vivid, punchy, native-sounding subtitles that hook viewers instantly.

■ Rules for high-quality transcreation:
1. Transcreate, don't transliterate: carry the context, emotion and humor of the ${srcName} source across so an English-speaking viewer laughs or relates at exactly the right beat.
2. Broadcast rhythm: write like a sharp documentary voice-over or a witty variety-show caption. Control the tension — never flat or robotic.
3. Subtitle-friendly length: keep each line readable at speed (about 42 characters per line, at most two lines). Prefer short, strong words.
4. Proper nouns (places, dishes, brands): keep them recognizable; a light, evocative descriptor is welcome when it helps the viewer.
5. Keep the register consistent with the original speaker (casual vs. formal).`;
    case "ja":
      return `あなたは地上波バラエティ／ドキュメンタリー番組を10年以上担当してきた放送作家であり、トップクラスの映像翻訳者です。機械的な直訳を嫌い、視聴者を一瞬で引き込む生き生きとした放送字幕を書きます。

■ ハイクオリティ翻訳・リライトのルール:
1. 直訳ではなく「超訳」: ${srcName}原文の文脈と感情を、日本の視聴者が最も共感し笑える、自然で歯切れのよい話し言葉に仕上げる。
2. 放送のテンポ: ドキュメンタリーのナレーションやバラエティのテロップのように緩急をつける。古臭い表現・翻訳調は禁止。
3. 字幕に適した長さ: 1行おおよそ全角16〜20文字、最大2行。読みやすく簡潔に。
4. 固有名詞(地名・料理名・ブランド)は分かりやすく。必要なら魅力的な修飾語を軽く添えてもよい。
5. 話者のトーン(砕けた口調／丁寧)に合わせて文体を統一する。ふりがなは付けない。`;
    case "zh":
      return `你是一位拥有十年经验的电视综艺/纪录片编剧，同时也是顶级的视频字幕翻译专家。你厌恶生硬的直译，擅长写出让观众瞬间沉浸、生动传神的节目字幕。

■ 高质量翻译与润色规则：
1. 超越直译：把${srcName}原文的语境和情绪完整传递，让中文观众在同一节拍上会心一笑或产生共鸣，语言地道、口语化。
2. 节目节奏：像纪录片旁白或综艺花字一样张弛有度，禁止老套、翻译腔的表达。
3. 字幕长度：每行约 15～20 个汉字，最多两行，简洁易读。
4. 专有名词（地名、菜名、品牌）保持可识别，必要时可轻加一个有吸引力的修饰语。
5. 与说话者语气保持一致（随意/正式）。必须使用简体中文。`;
    case "zh-Hant":
      return `你是一位擁有十年經驗的電視綜藝／紀錄片編劇，同時也是頂尖的影片字幕翻譯專家。你厭惡生硬的直譯，擅長寫出讓觀眾瞬間沉浸、生動傳神的節目字幕。

■ 高品質翻譯與潤飾規則：
1. 超越直譯：把${srcName}原文的語境和情緒完整傳遞，讓台灣、香港等繁體中文觀眾在同一節拍上會心一笑或產生共鳴，語言道地、口語化。
2. 節目節奏：像紀錄片旁白或綜藝字卡一樣張弛有度，禁止老套、翻譯腔的表達。
3. 字幕長度：每行約 15～20 個漢字，最多兩行，簡潔易讀。
4. 專有名詞（地名、菜名、品牌）保持可辨識，必要時可輕加一個有吸引力的修飾語。
5. 與說話者語氣保持一致（隨意／正式）。必須使用繁體中文，用詞以台灣慣用語為準。`;
  }
}

function faithfulPrompt(target: LangCode, srcName: string): string {
  switch (target) {
    case "ko":
      return `당신은 전문 영상 자막 번역가입니다. ${srcName} 원문의 의미·뉘앙스·정보량을 정확히 보존하여 자연스러운 한국어 자막으로 옮기세요.

■ 규칙:
1. 내용을 덧붙이거나 각색·생략하지 않는다.
2. 자연스러운 구어체를 쓰고, 어색한 번역투는 피한다.
3. 한 줄은 대략 20자 내외, 최대 2줄.
4. 고유명사는 통용 표기를 따른다.
5. 화자의 말투(반말/존댓말)를 일관되게 유지한다.`;
    case "en":
      return `You are a professional subtitle translator. Translate the ${srcName} source into natural English subtitles that preserve the meaning, nuance and amount of information of the original exactly.

■ Rules:
1. Do not add, embellish or omit content.
2. Natural spoken English; avoid translationese.
3. About 42 characters per line, at most two lines.
4. Keep proper nouns in their standard English form.
5. Keep the speaker's register (casual vs. formal) consistent.`;
    case "ja":
      return `あなたはプロの映像字幕翻訳者です。${srcName}原文の意味・ニュアンス・情報量を正確に保ちながら、自然な日本語字幕に訳してください。

■ ルール:
1. 内容の追加・脚色・省略は禁止。
2. 自然な話し言葉を使い、翻訳調は避ける。
3. 1行おおよそ全角16〜20文字、最大2行。
4. 固有名詞は一般的な表記に従う。
5. 話者の文体(敬体／常体)を一貫させる。ふりがなは付けない。`;
    case "zh":
      return `你是一名专业的视频字幕翻译。请将${srcName}原文准确地译成自然的简体中文字幕，完整保留原意、语气和信息量。

■ 规则：
1. 不得添加、改编或省略内容。
2. 使用自然口语，避免翻译腔。
3. 每行约 15～20 个汉字，最多两行。
4. 专有名词采用通用译名。
5. 保持说话者语气一致。必须使用简体中文。`;
    case "zh-Hant":
      return `你是一名專業的影片字幕翻譯。請將${srcName}原文準確地譯成自然的繁體中文字幕，完整保留原意、語氣和資訊量。

■ 規則：
1. 不得添加、改編或省略內容。
2. 使用自然口語，避免翻譯腔。
3. 每行約 15～20 個漢字，最多兩行。
4. 專有名詞採用通用譯名。
5. 保持說話者語氣一致。必須使用繁體中文，用詞以台灣慣用語為準。`;
  }
}

function buildSystemPrompt(source: LangCode | null, target: LangCode, style: TranslateStyle): string {
  const srcName = source ? LANGS[source].native : "the source language";
  const body = style === "faithful" ? faithfulPrompt(target, srcName) : broadcastPrompt(target, srcName);
  return `${body}\n\n${JSON_RULE}`;
}

/** 간단한 동시성 제한 map — 외부 API 과다 호출 방지 */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/* ── 번역 엔진 — 설정·등급별 선택은 src/lib/translate-engine.ts, 호출 구현은 아래 ── */
type ChatMessage = { role: "system" | "user"; content: string };

/** 응답 본문에서 JSON 객체를 관대하게 추출 (코드펜스·앞뒤 설명문 허용 — 에이전트 응답 대비) */
function extractJson(content: string): unknown {
  const trimmed = content.trim();
  try { return JSON.parse(trimmed); } catch { /* 계속 */ }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch { /* 계속 */ } }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)); } catch { /* 계속 */ }
  }
  throw new Error("응답에서 JSON을 찾을 수 없습니다");
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error(`응답 시간 초과 (${Math.round(ms / 1000)}초)`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function chatOpenAI(key: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o", temperature: 0.3, messages, response_format: { type: "json_object" } }),
  }, 120000);
  if (!res.ok) throw new Error(`OpenAI 오류 (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "{}";
}

/** OpenClaw 게이트웨이 OpenAI 호환 엔드포인트 — 에이전트 실행이라 20~90초 걸릴 수 있음. response_format 미지원이라 관대 파싱 */
async function chatOpenClaw(oc: { url: string; token: string; agent: string }, messages: ChatMessage[]): Promise<string> {
  const res = await fetchWithTimeout(`${oc.url}/v1/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${oc.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: `openclaw/${oc.agent}`, temperature: 0.3, max_tokens: 6000, messages }),
  }, 180000);
  if (!res.ok) throw new Error(`OpenClaw 오류 (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("OpenClaw 응답이 비어 있습니다");
  return content;
}

type ChunkResult = { subs: Sub[]; engine: Provider; fallbackReason?: string };

/** 한 청크 번역 — 1차 엔진 2회 시도, 그래도 실패하면 (허용 시) OpenAI 로 대체하고 사유를 남긴다 */
async function translateChunk(
  cfg: EngineConfig,
  chunk: Sub[],
  systemPrompt: string,
  source: LangCode | null,
  target: LangCode,
): Promise<ChunkResult> {
  const srcName = source ? LANGS[source].native : "the source language";
  const chunkText = chunk.map((s, idx) => `[${idx}] ${s.text}`).join("\n");
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Translate the following ${srcName} subtitles into ${LANGS[target].native}. Each line is prefixed with its [idx].\n\n${chunkText}` },
  ];

  const apply = (content: string): Sub[] => {
    const parsed = extractJson(content) as { translations?: unknown; result?: unknown } | unknown[];
    const raw = Array.isArray(parsed)
      ? parsed
      : (parsed as { translations?: unknown }).translations ?? (parsed as { result?: unknown }).result ?? [];
    const list = raw as { idx: number; text?: string; ko?: string; translation?: string }[];
    if (!Array.isArray(list) || list.length === 0) throw new Error("번역 결과가 비어 있습니다");
    return chunk.map((s, idx) => {
      const tr = list.find(t => Number(t.idx) === idx);
      const text = (tr?.text ?? tr?.ko ?? tr?.translation ?? "").toString().trim();
      return { ...s, text: text || s.text };
    });
  };

  const run = async (provider: Provider): Promise<Sub[]> => {
    if (provider === "openclaw") {
      if (!cfg.openclaw) throw new Error("OpenClaw 설정 없음");
      return apply(await chatOpenClaw(cfg.openclaw, messages));
    }
    if (!cfg.openaiKey) throw new Error("OpenAI API 키 없음");
    return apply(await chatOpenAI(cfg.openaiKey, messages));
  };

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return { subs: await run(cfg.provider), engine: cfg.provider };
    } catch (e) {
      lastErr = e;
    }
  }
  if (cfg.provider === "openclaw" && cfg.fallbackToOpenAI) {
    const reason = String(lastErr instanceof Error ? lastErr.message : lastErr).slice(0, 160);
    return { subs: await run("openai"), engine: "openai", fallbackReason: reason };
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

type TranslateParams = { subs: Sub[]; sourceLang: LangCode | null; targetLang: LangCode; style: TranslateStyle };
type TranslateResult = {
  subs: Sub[]; engine: string; message: string;
  sourceLang: LangCode | null; targetLang: LangCode; style: TranslateStyle;
};

async function runTranslation(
  cfg: EngineConfig,
  p: TranslateParams,
  onProgress?: (done: number, total: number) => void,
): Promise<TranslateResult> {
  const systemPrompt = buildSystemPrompt(p.sourceLang, p.targetLang, p.style);
  const chunkSize = chunkSizeFor(cfg);
  const concurrency = cfg.provider === "openclaw" ? 2 : 3; // 게이트웨이는 에이전트 실행이 무거워 동시 호출을 줄인다
  const chunks: Sub[][] = [];
  for (let i = 0; i < p.subs.length; i += chunkSize) chunks.push(p.subs.slice(i, i + chunkSize));

  let done = 0;
  const results = await mapWithConcurrency(chunks, concurrency, async chunk => {
    const r = await translateChunk(cfg, chunk, systemPrompt, p.sourceLang, p.targetLang);
    done++;
    onProgress?.(done, chunks.length);
    return r;
  });

  const subs = results.flatMap(r => r.subs);
  const engines = [...new Set(results.map(r => r.engine))];
  const fallback = results.find(r => r.fallbackReason);
  const engine = engines.length === 1
    ? engineLabel(cfg, engines[0])
    : `${engineLabel(cfg, cfg.provider)} + OpenAI 폴백 일부`;
  const styleLabel = p.style === "faithful" ? "원문 충실" : "방송 윤문";
  const message =
    `${p.sourceLang ? LANGS[p.sourceLang].label : "원본"} → ${LANGS[p.targetLang].label} 번역 완료 (${subs.length}줄 · ${styleLabel} · ${engine})`
    + (fallback ? ` ⚠ OpenClaw 실패로 OpenAI 대체: ${fallback.fallbackReason}` : "")
    + (cfg.note ? ` ⚠ ${cfg.note}` : "");
  return { subs, engine, message, sourceLang: p.sourceLang, targetLang: p.targetLang, style: p.style };
}

/* ── 비동기 번역 작업 — Orbitron 프록시 ~60초 한도 회피 (즉시 jobId 반환 → 클라이언트 폴링) ── */
type TranslateJob = {
  id: string;
  status: "running" | "done" | "failed";
  total: number;
  done: number;
  createdAt: number;
  result?: TranslateResult;
  error?: string;
};
const JOB_TTL_MS = 30 * 60 * 1000;
const jobStore = globalThis as unknown as { __subtitleTranslateJobs?: Map<string, TranslateJob> };
const jobs: Map<string, TranslateJob> = jobStore.__subtitleTranslateJobs ??= new Map();

function pruneJobs() {
  const now = Date.now();
  for (const [id, j] of jobs) if (now - j.createdAt > JOB_TTL_MS) jobs.delete(id);
}

/**
 * POST /api/studio/subtitle
 * body:
 *   { action: "extract", videoId?, fileVideoUrl?, sourceLang?: "ko"|"en"|"ja"|"zh"|"zh-Hant"|null, mergeFragments?: boolean }
 *   { action: "translate", subs, sourceLang?: LangCode|null, targetLang: LangCode, style?: "broadcast"|"faithful", async?: boolean }
 *     async=true 면 202 + { jobId } 를 즉시 반환하고 GET ?job=<jobId> 로 진행/결과를 폴링한다.
 *
 * extract:   YouTube CC(원본 언어 트랙 우선) → 실패 시 yt-dlp 오디오 + Whisper 음성 분석. 감지된 언어 코드 반환.
 * translate: 자막을 한국어·영어·일본어·중국어(간체/번체) 중 선택한 언어로 번역. 엔진은 OpenClaw 게이트웨이(TRANSLATE_PROVIDER=openclaw) 또는 OpenAI GPT-4o.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const guard = await requireUser();
    if (guard.error) return guard.error;
    const user = guard.user;

    // ── 1. 자막 추출 (스마트 모드: CC → Whisper 자동 폴백) ──
    if (action === "extract") {
      const { videoId, fileVideoUrl } = body;
      const sourceHint: LangCode | null = isLangCode(body.sourceLang) ? body.sourceLang : null;
      const mergeFragments: boolean = body.mergeFragments !== false; // 기본 ON
      const openaiKey = resolveOpenAIKey(user); // VIP/관리자: 서버 공용 키, 일반: 본인 키
      const langLabel = (l: LangCode | null, raw?: string | null) =>
        l ? `${LANGS[l].flag} ${LANGS[l].label}` : (raw || "알 수 없음");

      // ── A. 파일 모드: ffmpeg 오디오 추출 → Whisper API 음성 분석 ──
      if (fileVideoUrl) {
        if (!openaiKey) return keyRequiredResponse("openai", user);

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
          const result = await whisperTranscribe(audioPath, openaiKey, "audio/mp4", sourceHint);
          const { subs, language } = finalizeCues(result.subs, result.language, mergeFragments);

          return NextResponse.json({
            success: true,
            method: "whisper",
            language,
            rawLanguage: result.rawLanguage,
            segmentCount: subs.length,
            subs,
            message: `🎤 Whisper 음성 분석 완료 — ${subs.length}개 자막 추출 (언어: ${langLabel(language, result.rawLanguage)})`,
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

      // ── B. YouTube 영상: CC 자막(원본 언어 트랙 우선) → 실패 시 Whisper 폴백 ──
      if (videoId) {
        // Step 1: YouTube CC 자막 시도
        try {
          const cc = await fetchYouTubeCC(videoId, sourceHint);
          if (cc) {
            const { subs, language } = finalizeCues(cc.subs, cc.language, mergeFragments);
            return NextResponse.json({
              success: true,
              method: "youtube_cc",
              language,
              rawLanguage: cc.trackLang,
              segmentCount: subs.length,
              subs,
              message: `📝 YouTube CC 자막 추출 완료 — ${subs.length}개 자막 (언어: ${langLabel(language, cc.trackLang)})`,
            });
          }
        } catch {
          // CC 자막 없음 → Whisper 폴백으로 진행
        }

        // Step 2: Whisper 폴백 — yt-dlp로 오디오 다운로드 후 음성 분석
        if (!openaiKey) return keyRequiredResponse("openai", user);

        let audioPath: string | null = null;
        try {
          // 오디오 다운로드
          audioPath = await downloadAudioForWhisper(videoId);

          // Whisper 음성 분석
          const result = await whisperTranscribe(audioPath, openaiKey, "audio/mp4", sourceHint);
          const { subs, language } = finalizeCues(result.subs, result.language, mergeFragments);

          return NextResponse.json({
            success: true,
            method: "whisper_fallback",
            language,
            rawLanguage: result.rawLanguage,
            segmentCount: subs.length,
            subs,
            message: `🎤 YouTube CC 자막 없음 → Whisper 음성 분석으로 ${subs.length}개 자막 추출 완료 (언어: ${langLabel(language, result.rawLanguage)})`,
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

    // ── 2. 다국어 번역 — ko / en / ja / zh / zh-Hant 상호 변환 (OpenClaw 게이트웨이 또는 OpenAI GPT-4o) ──
    if (action === "translate") {
      const subs = (body.subs as Sub[] | undefined)?.map(s => ({
        id: s.id, start: s.start, end: s.end, type: s.type, text: String(s.text ?? ""),
      }));
      if (!subs?.length) return NextResponse.json({ error: "자막 데이터가 필요합니다." }, { status: 400 });

      const targetLang: LangCode = isLangCode(body.targetLang) ? body.targetLang : "ko";
      const sourceLang: LangCode | null = isLangCode(body.sourceLang)
        ? body.sourceLang
        : detectLangFromTexts(subs.map(s => s.text));
      const style: TranslateStyle = body.style === "faithful" ? "faithful" : "broadcast";

      if (sourceLang === targetLang) {
        return NextResponse.json({
          error: `원본 언어와 번역 언어가 같습니다 (${LANGS[targetLang].label}). 다른 언어를 선택하세요.`,
        }, { status: 400 });
      }

      const eng = engineForUser(user);
      if (!eng.ok) return NextResponse.json({ error: eng.error, code: "KEY_REQUIRED", kind: "openai" }, { status: 403 });
      const cfg = eng.cfg;
      if (!cfg.openaiKey && !cfg.openclaw) {
        return NextResponse.json({
          error: "번역 엔진이 설정되지 않았습니다. OPENAI_API_KEY 또는 OPENCLAW_GATEWAY_URL/OPENCLAW_TOKEN 을 설정하세요.",
        }, { status: 500 });
      }
      const params: TranslateParams = { subs, sourceLang, targetLang, style };

      // 비동기 모드: 즉시 jobId 반환 → GET ?job=<id> 로 폴링 (프록시 타임아웃 회피)
      if (body.async) {
        pruneJobs();
        const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        const job: TranslateJob = {
          id, status: "running", done: 0, createdAt: Date.now(),
          total: Math.max(1, Math.ceil(subs.length / chunkSizeFor(cfg))),
        };
        jobs.set(id, job);
        void runTranslation(cfg, params, (done, total) => { job.done = done; job.total = total; })
          .then(result => { job.status = "done"; job.result = result; })
          .catch(e => { job.status = "failed"; job.error = String(e instanceof Error ? e.message : e).slice(0, 300); });
        return NextResponse.json(
          { jobId: id, status: "running", done: 0, total: job.total, engine: engineLabel(cfg, cfg.provider) },
          { status: 202 },
        );
      }

      const result = await runTranslation(cfg, params);
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: "action은 'extract' 또는 'translate'여야 합니다." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: `서버 오류: ${String(e).slice(0, 300)}` }, { status: 500 });
  }
}

/**
 * GET /api/studio/subtitle?job=<id>   → 비동기 번역 작업 상태/결과
 * GET /api/studio/subtitle?config=1   → 현재 번역 엔진 정보 (UI 라벨용)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const guard = await requireUser();
  if (guard.error) return guard.error;
  const user = guard.user;
  const jobId = url.searchParams.get("job");
  if (jobId) {
    const job = jobs.get(jobId);
    if (!job) return NextResponse.json({ error: "번역 작업을 찾을 수 없습니다 (만료되었거나 서버가 재시작됨). 다시 시도하세요." }, { status: 404 });
    if (job.status === "done") return NextResponse.json({ status: "done", success: true, ...job.result });
    if (job.status === "failed") return NextResponse.json({ status: "failed", error: job.error });
    return NextResponse.json({ status: "running", done: job.done, total: job.total });
  }
  if (url.searchParams.get("config")) {
    const eng = engineForUser(user);
    if (!eng.ok) {
      return NextResponse.json({ provider: null, engine: null, agent: null, fallback: null, note: eng.error, tier: "free", needsKey: true });
    }
    const cfg = eng.cfg;
    return NextResponse.json({
      provider: cfg.provider,
      engine: engineLabel(cfg, cfg.provider),
      agent: cfg.openclaw?.agent ?? null,
      fallback: cfg.provider === "openclaw" ? (cfg.fallbackToOpenAI ? "openai" : "none") : null,
      note: cfg.note ?? null,
      tier: cfg.tier,
      needsKey: false,
    });
  }
  return NextResponse.json({ error: "job 또는 config 파라미터가 필요합니다." }, { status: 400 });
}
