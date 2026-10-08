/**
 * 자막 스튜디오 다국어 공용 유틸 (한국어·영어·일본어·중국어)
 * - 서버(API route)와 클라이언트(page) 양쪽에서 import 가능한 순수 함수만 둔다.
 */

export type LangCode = "ko" | "en" | "ja" | "zh" | "zh-Hant";
export const LANG_CODES: LangCode[] = ["ko", "en", "ja", "zh", "zh-Hant"];

export type LangInfo = {
  code: LangCode;
  label: string;        // UI 표기 (한국어 기준)
  native: string;       // 해당 언어 자체 표기
  short: string;        // 2글자 뱃지
  flag: string;
  htmlLang: string;     // <div lang="..."> — 한자 글리프 선택용
  ytCodes: string[];    // YouTube CC 트랙 코드 후보 (우선순위 순)
  fonts: string[];      // CJK 폰트 폴백 우선순위
};

export const LANGS: Record<LangCode, LangInfo> = {
  ko: {
    code: "ko", label: "한국어", native: "한국어", short: "KO", flag: "🇰🇷", htmlLang: "ko",
    ytCodes: ["ko", "ko-KR"],
    fonts: ["Noto Sans KR", "Noto Sans JP", "Noto Sans SC", "Noto Sans TC"],
  },
  en: {
    code: "en", label: "영어", native: "English", short: "EN", flag: "🇺🇸", htmlLang: "en",
    ytCodes: ["en", "en-US", "en-GB"],
    fonts: ["Noto Sans KR", "Noto Sans JP", "Noto Sans SC", "Noto Sans TC"],
  },
  ja: {
    code: "ja", label: "일본어", native: "日本語", short: "JA", flag: "🇯🇵", htmlLang: "ja",
    ytCodes: ["ja", "ja-JP"],
    fonts: ["Noto Sans JP", "Noto Sans KR", "Noto Sans SC", "Noto Sans TC"],
  },
  zh: {
    code: "zh", label: "중국어(간체)", native: "简体中文", short: "ZH", flag: "🇨🇳", htmlLang: "zh-Hans",
    ytCodes: ["zh-Hans", "zh-CN", "zh-SG", "zh", "zh-Hant", "zh-TW", "zh-HK"],
    fonts: ["Noto Sans SC", "Noto Sans TC", "Noto Sans JP", "Noto Sans KR"],
  },
  "zh-Hant": {
    code: "zh-Hant", label: "중국어(번체)", native: "繁體中文", short: "ZH-T", flag: "🇹🇼", htmlLang: "zh-Hant",
    ytCodes: ["zh-Hant", "zh-TW", "zh-HK", "zh", "zh-Hans", "zh-CN"],
    fonts: ["Noto Sans TC", "Noto Sans SC", "Noto Sans JP", "Noto Sans KR"],
  },
};

export function isLangCode(v: unknown): v is LangCode {
  return typeof v === "string" && (LANG_CODES as string[]).includes(v);
}

/**
 * Whisper("english", "korean"...) · YouTube("en-US", "zh-Hans"...) · ISO 코드 등
 * 다양한 표기를 4개 코드 중 하나로 정규화. 매핑 불가 시 null.
 */
export function normalizeLangCode(input: string | null | undefined): LangCode | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (s === "ko" || s.startsWith("ko-") || s === "kor" || s === "korean") return "ko";
  if (s === "en" || s.startsWith("en-") || s === "eng" || s === "english") return "en";
  if (s === "ja" || s.startsWith("ja-") || s === "jp" || s === "jpn" || s === "japanese") return "ja";
  if (s.startsWith("zh")) {
    // 번체 지역·스크립트 코드(zh-Hant, zh-TW, zh-HK, zh-MO) → zh-Hant, 그 외(zh, zh-Hans, zh-CN, zh-SG) → zh(간체)
    return /hant|tw|hk|mo/.test(s.slice(2)) ? "zh-Hant" : "zh";
  }
  if (s === "zho" || s === "chi" || s === "cmn" || s === "chinese") return "zh";
  if (s === "yue" || s === "cantonese") return "zh-Hant";
  return null;
}

/* 번체 전용 / 간체 전용 고빈도 한자 (양쪽에서 함께 쓰는 한자는 제외) — 자막 텍스트의 스크립트 판별용 */
const TRAD_ONLY = "們這說來時會沒個麼對點國學體與為於發經開關間從進無現實動兒長應讓題還電話業樂門問車馬魚鳥龍風雲飛書畫聽讀寫買賣錢銀鐵鋼機樣條幾處號當總統歷禮義議認識證護醫藥歡觀覺顯類願響麵齊齒龜愛親見語訴談請謝謎變邊過達運遠選錯錄給網線結練緊細終華萬蓋藝蘭臺灣廣慶優備";
const SIMP_ONLY = "们这说来时会没个么对点国学体与为于发经开关间从进无现实动儿长应让题还电话业乐门问车马鱼鸟龙风飞书画听读写买卖钱银铁钢机样条处号当总统历礼义议认识证护医药欢观觉显类愿响齐齿龟爱亲见语诉谈请谢谜变边过达运远选错录给网线结练紧细终华万盖艺兰湾广庆优备";

/** 중국어 텍스트의 간체/번체 판별. 판별 근거가 없으면 간체(zh) */
export function detectChineseScript(text: string): "zh" | "zh-Hant" {
  let trad = 0, simp = 0;
  for (const ch of text) {
    if (TRAD_ONLY.includes(ch)) trad++;
    else if (SIMP_ONLY.includes(ch)) simp++;
  }
  return trad > simp ? "zh-Hant" : "zh";
}

/**
 * 문자 구성 비율로 언어를 추정하는 경량 휴리스틱.
 * - 가나가 조금이라도 유의미하게 섞이면 일본어 (중국어·한국어는 가나를 쓰지 않음)
 * - 한글 우세 → 한국어, 한자 우세 → 중국어(간체/번체는 한자 구성으로 재판별), 라틴 우세 → 영어
 */
export function detectLang(text: string): LangCode | null {
  let hangul = 0, kana = 0, han = 0, latin = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if ((c >= 0xac00 && c <= 0xd7a3) || (c >= 0x1100 && c <= 0x11ff) || (c >= 0x3130 && c <= 0x318f)) hangul++;
    else if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0x31f0 && c <= 0x31ff) || c === 0xff70) kana++;
    else if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf) || (c >= 0xf900 && c <= 0xfaff)) han++;
    else if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) latin++;
  }
  const total = hangul + kana + han + latin;
  if (total === 0) return null;
  if (kana / total >= 0.05) return "ja";
  if (hangul / total >= 0.3) return "ko";
  if (han / total >= 0.3) return detectChineseScript(text);
  if (latin / total >= 0.5) return "en";
  const max = Math.max(hangul, kana, han, latin);
  if (max === hangul) return "ko";
  if (max === kana) return "ja";
  if (max === han) return detectChineseScript(text);
  return "en";
}

/** 자막 묶음 전체의 언어 추정 (앞쪽 N줄 샘플링) */
export function detectLangFromTexts(texts: string[], sample = 60): LangCode | null {
  return detectLang(texts.slice(0, sample).join("\n"));
}

/** 자막 오버레이/편집기용 폰트 스택 — 활성 언어의 CJK 글리프가 우선 선택되도록 정렬 */
export function fontStackFor(lang: LangCode | null | undefined, baseFont: string): string {
  const order = lang ? LANGS[lang].fonts : LANGS.ko.fonts;
  return [baseFont, ...order, "sans-serif"].map(f => (f.includes(" ") ? `'${f}'` : f)).join(", ");
}

/** YouTube CC 텍스트의 HTML 엔티티 복원 (&amp;#39; 같은 이중 인코딩 포함) */
export function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  const once = (s: string) =>
    s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, g: string) => {
      const key = g.toLowerCase();
      if (key.startsWith("#x")) return String.fromCodePoint(parseInt(key.slice(2), 16));
      if (key.startsWith("#")) return String.fromCodePoint(parseInt(key.slice(1), 10));
      return named[key] ?? m;
    });
  // 이중 인코딩(&amp;#39;) 대응: 두 번 복원
  return once(once(text));
}

/* ── SRT / VTT 생성 (단일·이중 자막 공용) ───────────────── */
export type Cue = { start: number; end: number; lines: string[] };

function fmtTimestamp(t: number, sep: "," | "."): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = Math.floor(t % 60);
  const ms = Math.round((t % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}${sep}${String(ms).padStart(3, "0")}`;
}

export function toSRT(cues: Cue[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${fmtTimestamp(c.start, ",")} --> ${fmtTimestamp(c.end, ",")}\n${c.lines.filter(Boolean).join("\n")}\n`)
    .join("\n");
}

export function toVTT(cues: Cue[]): string {
  return (
    "WEBVTT\n\n" +
    cues
      .map((c, i) => `${i + 1}\n${fmtTimestamp(c.start, ".")} --> ${fmtTimestamp(c.end, ".")}\n${c.lines.filter(Boolean).join("\n")}\n`)
      .join("\n")
  );
}

/* ── 큐 시간 정리 / 조각 병합 ───────────────────────────── */

/**
 * 겹치는 큐 정리: end 를 다음 큐의 start 로 잘라낸다 (최소 노출 minDur 초 보장).
 * YouTube 자동 자막은 duration 이 다음 큐 시작 이후까지 이어지는 경우가 많아,
 * 그대로 두면 뒤 큐가 플레이어에서 영영 표시되지 않거나 SRT 에서 두 줄이 동시에 뜬다.
 */
export function normalizeCues<T extends { start: number; end: number }>(items: T[], minDur = 0.3): T[] {
  return items.map((s, i) => {
    const next = items[i + 1];
    let end = s.end;
    if (next && end > next.start) end = next.start;
    if (end < s.start + minDur) end = s.start + minDur;
    end = Math.round(end * 100) / 100;
    return end === s.end ? s : { ...s, end };
  });
}

const TERMINAL_PUNCT = /[.!?。！？…]["'」』）)]*$/;

function isFragment(text: string, lang: LangCode | null): boolean {
  const t = text.trim();
  if (!t || /^[♪\[(]/.test(t)) return false;   // 효과음·음악 표기는 병합하지 않음
  if (lang === "en") return t.split(/\s+/).length <= 3;
  return [...t].length <= 10;
}

/**
 * 짧게 끊긴 조각 큐를 앞 큐에 이어 붙인다.
 * (YouTube 자동 자막의 "…찾아야 할 시점에" / "있습니다." 같은 분할 대응)
 * 조건: 뒤 큐가 짧고, 앞 큐가 문장 종결 부호로 끝나지 않으며, 간격 ≤ maxGap, 병합 후 길이 ≤ maxDur.
 */
export function mergeFragmentCues<T extends { start: number; end: number; text: string }>(
  items: T[],
  lang: LangCode | null,
  opts: { maxGap?: number; maxDur?: number } = {},
): T[] {
  const maxGap = opts.maxGap ?? 0.8;
  const maxDur = opts.maxDur ?? 8;
  const joiner = lang === "ja" || lang === "zh" || lang === "zh-Hant" ? "" : " ";
  const out: T[] = [];
  for (const cur of items) {
    const prev = out[out.length - 1];
    if (
      prev &&
      isFragment(cur.text, lang) &&
      !TERMINAL_PUNCT.test(prev.text.trim()) &&
      cur.start - prev.end <= maxGap &&
      cur.end - prev.start <= maxDur
    ) {
      out[out.length - 1] = {
        ...prev,
        end: Math.max(prev.end, cur.end),
        text: `${prev.text.trim()}${joiner}${cur.text.trim()}`,
      };
    } else {
      out.push(cur);
    }
  }
  return out;
}
