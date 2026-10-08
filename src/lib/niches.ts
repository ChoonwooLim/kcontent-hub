/**
 * 소재 수집기 분야(niche) 정의 — 서버(검색 API)와 클라이언트(수집기 UI)가 공유한다.
 *
 * - id 는 한글 라벨과 동일하게 둔다 (PipelineVideo.niche / HunterSearch.niche 에 라벨이 그대로 저장되므로 호환 유지)
 * - keywords 는 **언어별**로 분류되어 있다. 언어를 선택해 수집하면 그 언어의 키워드만 쓰고(부족하면 영어로 보충),
 *   "전체 언어"면 모든 언어를 섞어 랜덤 샘플링한다. 한 번의 수집은 쿼터 절약을 위해 최대 MAX_KEYWORDS_PER_SCAN 개만 사용.
 * - "직접 입력" 모드는 사용자가 쉼표로 구분해 넣은 키워드를 그대로 쓴다 (외국어 권장 — 한국어 영상은 자동 제외됨).
 */

export type SearchLang = "en" | "ja" | "es" | "fr" | "de" | "th" | "pt" | "vi" | "zh" | "id";
export const SEARCH_LANGS: SearchLang[] = ["en", "ja", "es", "fr", "de", "th", "pt", "vi", "zh", "id"];
export const SEARCH_LANG_LABEL: Record<SearchLang, string> = {
  en: "English", ja: "日本語", es: "Español", fr: "Français", de: "Deutsch",
  th: "ไทย", pt: "Português", vi: "Tiếng Việt", zh: "中文", id: "Bahasa",
};

export type NicheGroup = { id: string; label: string; emoji: string; hint: string };
export type Niche = { id: string; label: string; group: string; keywords: Partial<Record<SearchLang, string[]>> };

export const MAX_KEYWORDS_PER_SCAN = 3;      // YouTube search.list 1회 = 100 units (일일 10,000)
export const MAX_CUSTOM_KEYWORDS = 5;

export const NICHE_GROUPS: NicheGroup[] = [
  { id: "korea",    label: "K-컬처 · 외국인의 한국 체험", emoji: "🇰🇷", hint: "외국인이 한국을 방문·체험하는 영상" },
  { id: "wellness", label: "운동 · 웰니스",               emoji: "🧘", hint: "요가·필라테스·마사지·홈트·러닝" },
  { id: "sports",   label: "스포츠",                      emoji: "⚽", hint: "축구·야구·농구·골프 훈련·경기 브이로그" },
  { id: "arts",     label: "예술 · 공연",                 emoji: "🩰", hint: "현대무용·발레·스트릿댄스 안무·수업" },
];

export const NICHES: Niche[] = [
  /* ── K-컬처 ────────────────────────────────────────────── */
  { id: "K-먹방", label: "K-먹방", group: "korea", keywords: {
    en: ["korean food vlog", "eating in korea", "korean convenience store food"],
    ja: ["韓国 グルメ 旅行", "韓国 コンビニ 外国人"],
    es: ["comida coreana viaje"], pt: ["comida coréia vlog"], fr: ["cuisine coréenne voyage"],
    de: ["koreanisches Essen probieren"], th: ["อาหารเกาหลี เที่ยว"], vi: ["ẩm thực hàn quốc du lịch"],
  }},
  { id: "K-바비큐", label: "K-바비큐", group: "korea", keywords: {
    en: ["korean bbq foreigner", "samgyeopsal experience tourist"],
    ja: ["韓国 焼肉 体験"], es: ["barbacoa coreana turista"], fr: ["BBQ coréen expérience"],
    de: ["koreanisches BBQ"], th: ["ปิ้งย่างเกาหลี"],
  }},
  { id: "K-교통", label: "K-교통", group: "korea", keywords: {
    en: ["seoul subway foreigner", "korean public transport tourist"],
    ja: ["ソウル 地下鉄 外国人"], es: ["metro de seúl turista"], fr: ["métro séoul touriste"], de: ["Seoul U-Bahn Tourist"],
  }},
  { id: "K-문화", label: "K-문화", group: "korea", keywords: {
    en: ["jjimjilbang foreign", "korean culture shock foreigner"],
    ja: ["韓国 文化 ショック"], es: ["choque cultural corea"], fr: ["culture coréenne choc"],
    de: ["Kulturschock Korea"], th: ["วัฒนธรรมเกาหลี ชาวต่างชาติ"],
  }},
  { id: "K-의료", label: "K-의료", group: "korea", keywords: {
    en: ["korea hospital tourist", "korean clinic foreigner"],
    ja: ["韓国 病院 外国人"], es: ["hospital corea turista"],
  }},
  { id: "K-뷰티", label: "K-뷰티", group: "korea", keywords: {
    en: ["korea beauty shopping tourist", "korean skincare haul"],
    ja: ["韓国 コスメ 購入"], es: ["compras belleza corea"], fr: ["cosmétique coréen shopping"],
    de: ["koreanische Kosmetik"], th: ["เครื่องสำอางเกาหลี ช้อปปิ้ง"],
  }},
  { id: "K-라이프", label: "K-라이프", group: "korea", keywords: {
    en: ["living in seoul foreigner daily life", "expat korea vlog"],
    ja: ["韓国 生活 外国人"], es: ["vivir en corea experiencia"], fr: ["vivre en corée vlog"],
    de: ["Leben in Korea Alltag"], th: ["ชีวิตในเกาหลี ต่างชาติ"], vi: ["sống ở hàn quốc"],
  }},
  { id: "K-쇼핑", label: "K-쇼핑", group: "korea", keywords: {
    en: ["daiso korea shopping foreigner", "market in korea tourist"],
    ja: ["韓国 ダイソー 買い物"], es: ["compras en corea mercado"], fr: ["shopping corée marché"],
  }},
  { id: "K-관광", label: "K-관광", group: "korea", keywords: {
    en: ["korea travel vlog tourist", "first time seoul foreigner"],
    ja: ["韓国 旅行 初めて"], es: ["viaje corea primera vez"], fr: ["voyage corée première fois"],
    de: ["Korea Reise zum ersten Mal"], th: ["เที่ยวเกาหลี ครั้งแรก"], vi: ["du lịch hàn quốc lần đầu"],
  }},

  /* ── 운동 · 웰니스 ─────────────────────────────────────── */
  { id: "요가", label: "요가", group: "wellness", keywords: {
    en: ["yoga flow for beginners", "morning yoga routine vlog", "yoga teacher daily vlog"],
    ja: ["ヨガ 初心者 朝ヨガ", "ヨガ ルーティン vlog"], es: ["yoga para principiantes en casa", "rutina de yoga mañana"],
    fr: ["yoga débutant matin"], de: ["Yoga für Anfänger zuhause"], pt: ["yoga iniciante em casa", "rotina de yoga matinal"],
    th: ["โยคะ สำหรับผู้เริ่มต้น"], vi: ["yoga cho người mới bắt đầu"], id: ["yoga pemula di rumah"],
  }},
  { id: "필라테스", label: "필라테스", group: "wellness", keywords: {
    en: ["pilates at home beginner", "reformer pilates class", "mat pilates full body"],
    ja: ["ピラティス 自宅 初心者", "ピラティス リフォーマー レッスン"], es: ["pilates en casa principiantes", "clase de pilates reformer"],
    fr: ["pilates débutant maison"], de: ["Pilates für Anfänger"], pt: ["pilates em casa iniciante", "aula de pilates reformer"],
    th: ["พิลาทิส เริ่มต้น"],
  }},
  { id: "마사지", label: "마사지", group: "wellness", keywords: {
    en: ["massage therapy techniques tutorial", "thai massage how to", "relaxing back massage"],
    ja: ["マッサージ やり方 肩こり", "リラックス マッサージ 施術"], es: ["masaje relajante técnica"], fr: ["massage détente technique"],
    de: ["Massage Anleitung Rücken"], pt: ["massagem relaxante como fazer"], th: ["นวดแผนไทย สอน"], vi: ["massage cổ vai gáy"],
  }},
  { id: "홈트레이닝", label: "홈트레이닝", group: "wellness", keywords: {
    en: ["home workout no equipment", "full body workout at home beginner"],
    ja: ["自宅 筋トレ 初心者", "宅トレ 全身 ルーティン"], es: ["ejercicio en casa sin equipo"], fr: ["entraînement maison sans matériel"],
    de: ["Home Workout ohne Geräte"], pt: ["treino em casa sem equipamento"], th: ["ออกกำลังกายที่บ้าน"], vi: ["tập thể dục tại nhà"],
  }},
  { id: "러닝", label: "러닝", group: "wellness", keywords: {
    en: ["running vlog beginner 5k", "marathon training week vlog"],
    ja: ["ランニング 初心者 練習", "マラソン 練習 vlog"], es: ["correr principiantes consejos"], fr: ["course à pied débutant"],
    de: ["Laufen Anfänger Training"], pt: ["corrida iniciante treino"], th: ["วิ่ง มือใหม่"],
  }},

  /* ── 스포츠 ────────────────────────────────────────────── */
  { id: "축구", label: "축구", group: "sports", keywords: {
    en: ["football skills tutorial", "grassroots football training session", "amateur football match vlog"],
    ja: ["サッカー 練習 ドリブル", "草サッカー 試合 vlog"], es: ["entrenamiento de fútbol técnica", "partido de fútbol amateur vlog"],
    fr: ["entraînement football dribble"], de: ["Fußballtraining Technik"], pt: ["treino de futebol habilidades", "pelada futebol vlog"],
    th: ["ฟุตบอล ฝึกซ้อม"], vi: ["kỹ thuật bóng đá"], id: ["latihan sepak bola"],
  }},
  { id: "야구", label: "야구", group: "sports", keywords: {
    en: ["baseball pitching mechanics", "baseball hitting drills", "little league baseball vlog"],
    ja: ["野球 練習 ピッチング", "野球 バッティング 練習", "草野球 試合 vlog"], es: ["béisbol entrenamiento bateo"],
    pt: ["beisebol treino"], zh: ["棒球 投球 教學", "棒球 打擊 練習"],
  }},
  { id: "농구", label: "농구", group: "sports", keywords: {
    en: ["basketball handles drills", "basketball shooting form", "pickup basketball vlog"],
    ja: ["バスケ 練習 ドリブル", "バスケ シュート フォーム"], es: ["baloncesto entrenamiento tiro"], fr: ["basket entraînement dribble"],
    de: ["Basketball Training Wurf"], pt: ["basquete treino arremesso"], zh: ["篮球 训练 投篮"],
  }},
  { id: "골프", label: "골프", group: "sports", keywords: {
    en: ["golf swing tips beginner", "golf course vlog amateur"],
    ja: ["ゴルフ スイング 練習", "ゴルフ ラウンド vlog"], es: ["golf swing principiantes"], fr: ["golf swing débutant"],
    de: ["Golfschwung Anfänger"], pt: ["golfe swing iniciante"], th: ["กอล์ฟ มือใหม่"],
  }},

  /* ── 예술 · 공연 ───────────────────────────────────────── */
  { id: "현대무용", label: "현대무용", group: "arts", keywords: {
    en: ["contemporary dance choreography", "modern dance class improvisation", "contemporary dance solo"],
    ja: ["コンテンポラリーダンス 振付", "コンテンポラリーダンス クラス"], es: ["danza contemporánea coreografía"],
    fr: ["danse contemporaine chorégraphie"], de: ["zeitgenössischer Tanz Choreografie"], pt: ["dança contemporânea coreografia"],
    zh: ["現代舞 編舞"],
  }},
  { id: "발레", label: "발레", group: "arts", keywords: {
    en: ["ballet class beginner adult", "ballet barre workout"],
    ja: ["バレエ 初心者 大人", "バレエ バーレッスン"], es: ["ballet principiantes adultos"], fr: ["cours de ballet débutant"],
    de: ["Ballett für Anfänger"], pt: ["balé iniciante adulto"], zh: ["芭蕾 初學"],
  }},
  { id: "스트릿댄스", label: "스트릿댄스", group: "arts", keywords: {
    en: ["street dance choreography class", "hip hop dance tutorial", "popping tutorial beginner"],
    ja: ["ストリートダンス 練習", "ヒップホップ ダンス 振付"], es: ["street dance coreografía"], fr: ["danse hip hop tutoriel"],
    de: ["Hip Hop Tanz Anleitung"], pt: ["dança de rua coreografia"], zh: ["街舞 教學"],
  }},
];

export const NICHE_BY_ID: Record<string, Niche> = Object.fromEntries(NICHES.map(n => [n.id, n]));

export function nichesInGroup(groupId: string): Niche[] {
  return NICHES.filter(n => n.group === groupId);
}

export function isSearchLang(v: unknown): v is SearchLang {
  return typeof v === "string" && (SEARCH_LANGS as string[]).includes(v);
}

/** 분야의 키워드 — lang 지정 시 그 언어만, 아니면 전체 언어 */
export function nicheKeywords(n: Niche, lang: SearchLang | "all" = "all"): string[] {
  if (lang !== "all") return n.keywords[lang] ?? [];
  return SEARCH_LANGS.flatMap(l => n.keywords[l] ?? []);
}

/** 키워드가 속한 분야 찾기 (결과 뱃지용) */
export function nicheOfKeyword(kw: string, within: Niche[] = NICHES): Niche | undefined {
  return within.find(n => SEARCH_LANGS.some(l => (n.keywords[l] ?? []).includes(kw)));
}

/** 사용자가 입력한 키워드 문자열 → 정리된 배열 (쉼표·세미콜론·줄바꿈 구분, 중복 제거, 최대 MAX_CUSTOM_KEYWORDS) */
export function parseCustomKeywords(input: string | null | undefined): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,;\n]+/)) {
    const kw = raw.trim().replace(/\s+/g, " ").slice(0, 80);
    const key = kw.toLowerCase();
    if (!kw || seen.has(key)) continue;
    seen.add(key);
    out.push(kw);
    if (out.length >= MAX_CUSTOM_KEYWORDS) break;
  }
  return out;
}

export type KeywordSelection = {
  mode: "custom" | "niche" | "group" | "all";
  keywords: string[];
  /** 입력 순서를 지켜야 하면 true (직접 입력), 아니면 랜덤 샘플링 */
  ordered: boolean;
  /** 검색 결과의 niche 뱃지에 쓸 라벨 */
  labelFor: (keyword: string) => string;
  /** 이번 수집의 제목 (예: "요가", "운동 · 웰니스", "키워드: cold plunge") */
  title: string;
  /** 선택 언어의 키워드가 부족해 영어 키워드로 보충/대체했는지 — "none" | "partial" | "full" */
  langFallback: "none" | "partial" | "full";
};

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

/**
 * 언어 우선 키워드 구성: 선택 언어 키워드(랜덤) → 부족하면 영어 키워드로 보충.
 * 반환 배열은 "앞에서부터 MAX_KEYWORDS_PER_SCAN 개"를 쓰면 되도록 이미 정렬되어 있다.
 */
function pickByLang(list: Niche[], lang: SearchLang | "all"): { keywords: string[]; ordered: boolean; langFallback: KeywordSelection["langFallback"] } {
  if (lang === "all") {
    return { keywords: shuffle(list.flatMap(n => nicheKeywords(n, "all"))), ordered: false, langFallback: "none" };
  }
  const own = shuffle(list.flatMap(n => nicheKeywords(n, lang)));
  if (own.length >= MAX_KEYWORDS_PER_SCAN) return { keywords: own, ordered: true, langFallback: "none" };
  const en = shuffle(list.flatMap(n => nicheKeywords(n, "en"))).filter(k => !own.includes(k));
  return {
    keywords: [...own, ...en],
    ordered: true,
    langFallback: own.length === 0 ? "full" : "partial",
  };
}

/**
 * 수집 조건 → 검색 키워드 집합
 *   niche: "전체" | "<분야 id>" | "group:<그룹 id>" | "custom"
 *   customInput: 직접 입력 키워드 (있으면 niche 와 무관하게 우선)
 *   lang: 검색 언어 ("all" 이면 전체 언어 믹스)
 */
export function resolveNicheKeywords(niche: string, customInput?: string | null, lang: string = "all"): KeywordSelection {
  const custom = parseCustomKeywords(customInput);
  if (niche === "custom" || custom.length > 0) {
    const title = `키워드: ${custom.join(", ")}`.slice(0, 60);
    return { mode: "custom", keywords: custom, ordered: true, labelFor: () => title, title, langFallback: "none" };
  }
  const sl: SearchLang | "all" = isSearchLang(lang) ? lang : "all";

  if (niche.startsWith("group:")) {
    const gid = niche.slice("group:".length);
    const list = nichesInGroup(gid);
    const group = NICHE_GROUPS.find(g => g.id === gid);
    const picked = pickByLang(list, sl);
    return {
      mode: "group", ...picked,
      labelFor: kw => nicheOfKeyword(kw, list)?.label ?? group?.label ?? "기타",
      title: group?.label ?? gid,
    };
  }
  const one = NICHE_BY_ID[niche];
  if (one) {
    const picked = pickByLang([one], sl);
    return { mode: "niche", ...picked, labelFor: () => one.label, title: one.label };
  }
  const picked = pickByLang(NICHES, sl);
  return {
    mode: "all", ...picked,
    labelFor: kw => nicheOfKeyword(kw)?.label ?? "기타",
    title: "전체 분야",
  };
}
