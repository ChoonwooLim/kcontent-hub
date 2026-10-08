/**
 * 소재 수집기 분야(niche) 정의 — 서버(검색 API)와 클라이언트(수집기 UI)가 공유한다.
 *
 * - id 는 한글 라벨과 동일하게 둔다 (PipelineVideo.niche / HunterSearch.niche 에 라벨이 그대로 저장되므로 호환 유지)
 * - keywords 는 다국어(영어·일본어·스페인어·프랑스어·독일어·포르투갈어·태국어·베트남어·중국어·인도네시아어) 혼합.
 *   한 번의 수집은 쿼터 절약을 위해 이 중 최대 MAX_KEYWORDS_PER_SCAN 개만 사용한다.
 * - "직접 입력" 모드는 사용자가 쉼표로 구분해 넣은 키워드를 그대로 쓴다 (외국어 권장 — 한국어 영상은 자동 제외됨).
 */

export type NicheGroup = { id: string; label: string; emoji: string; hint: string };
export type Niche = { id: string; label: string; group: string; keywords: string[] };

export const MAX_KEYWORDS_PER_SCAN = 3;      // YouTube search.list 1회 = 100 units (일일 10,000)
export const MAX_CUSTOM_KEYWORDS = 5;

export const NICHE_GROUPS: NicheGroup[] = [
  { id: "korea",    label: "K-컬처 · 외국인의 한국 체험", emoji: "🇰🇷", hint: "외국인이 한국을 방문·체험하는 영상" },
  { id: "wellness", label: "운동 · 웰니스",               emoji: "🧘", hint: "요가·필라테스·마사지·홈트·러닝" },
  { id: "sports",   label: "스포츠",                      emoji: "⚽", hint: "축구·야구·농구·골프 훈련·경기 브이로그" },
  { id: "arts",     label: "예술 · 공연",                 emoji: "🩰", hint: "현대무용·발레·스트릿댄스 안무·수업" },
];

export const NICHES: Niche[] = [
  /* ── K-컬처 (기존) ─────────────────────────────────────── */
  { id: "K-먹방", label: "K-먹방", group: "korea", keywords: [
    "korean food vlog", "eating in korea", "korean convenience store food",
    "韓国 グルメ 旅行", "韓国 コンビニ 外国人",
    "comida coreana viaje", "comida coréia vlog",
    "cuisine coréenne voyage", "koreanisches Essen probieren",
    "อาหารเกาหลี เที่ยว", "ẩm thực hàn quốc du lịch",
  ]},
  { id: "K-바비큐", label: "K-바비큐", group: "korea", keywords: [
    "korean bbq foreigner", "samgyeopsal experience tourist",
    "韓国 焼肉 体験", "barbacoa coreana turista",
    "BBQ coréen expérience", "koreanisches BBQ", "ปิ้งย่างเกาหลี",
  ]},
  { id: "K-교통", label: "K-교통", group: "korea", keywords: [
    "seoul subway foreigner", "korean public transport tourist",
    "ソウル 地下鉄 外国人", "metro de seúl turista",
    "métro séoul touriste", "Seoul U-Bahn Tourist",
  ]},
  { id: "K-문화", label: "K-문화", group: "korea", keywords: [
    "jjimjilbang foreign", "korean culture shock foreigner",
    "韓国 文化 ショック", "choque cultural corea",
    "culture coréenne choc", "Kulturschock Korea",
    "วัฒนธรรมเกาหลี ชาวต่างชาติ",
  ]},
  { id: "K-의료", label: "K-의료", group: "korea", keywords: [
    "korea hospital tourist", "korean clinic foreigner",
    "韓国 病院 外国人", "hospital corea turista",
  ]},
  { id: "K-뷰티", label: "K-뷰티", group: "korea", keywords: [
    "korea beauty shopping tourist", "korean skincare haul",
    "韓国 コスメ 購入", "compras belleza corea",
    "cosmétique coréen shopping", "koreanische Kosmetik",
    "เครื่องสำอางเกาหลี ช้อปปิ้ง",
  ]},
  { id: "K-라이프", label: "K-라이프", group: "korea", keywords: [
    "living in seoul foreigner daily life", "expat korea vlog",
    "韓国 生活 外国人", "vivir en corea experiencia",
    "vivre en corée vlog", "Leben in Korea Alltag",
    "ชีวิตในเกาหลี ต่างชาติ", "sống ở hàn quốc",
  ]},
  { id: "K-쇼핑", label: "K-쇼핑", group: "korea", keywords: [
    "daiso korea shopping foreigner", "market in korea tourist",
    "韓国 ダイソー 買い物", "compras en corea mercado",
    "shopping corée marché",
  ]},
  { id: "K-관광", label: "K-관광", group: "korea", keywords: [
    "korea travel vlog tourist", "first time seoul foreigner",
    "韓国 旅行 初めて", "viaje corea primera vez",
    "voyage corée première fois", "Korea Reise zum ersten Mal",
    "เที่ยวเกาหลี ครั้งแรก", "du lịch hàn quốc lần đầu",
  ]},

  /* ── 운동 · 웰니스 ─────────────────────────────────────── */
  { id: "요가", label: "요가", group: "wellness", keywords: [
    "yoga flow for beginners", "morning yoga routine vlog", "yoga teacher daily vlog",
    "ヨガ 初心者 朝ヨガ", "yoga para principiantes en casa", "yoga débutant matin",
    "Yoga für Anfänger zuhause", "yoga iniciante em casa",
    "โยคะ สำหรับผู้เริ่มต้น", "yoga cho người mới bắt đầu", "yoga pemula di rumah",
  ]},
  { id: "필라테스", label: "필라테스", group: "wellness", keywords: [
    "pilates at home beginner", "reformer pilates class", "mat pilates full body",
    "ピラティス 自宅 初心者", "pilates en casa principiantes", "pilates débutant maison",
    "Pilates für Anfänger", "pilates em casa iniciante", "พิลาทิส เริ่มต้น",
  ]},
  { id: "마사지", label: "마사지", group: "wellness", keywords: [
    "massage therapy techniques tutorial", "thai massage how to", "relaxing back massage",
    "マッサージ やり方 肩こり", "masaje relajante técnica", "massage détente technique",
    "Massage Anleitung Rücken", "massagem relaxante como fazer",
    "นวดแผนไทย สอน", "massage cổ vai gáy",
  ]},
  { id: "홈트레이닝", label: "홈트레이닝", group: "wellness", keywords: [
    "home workout no equipment", "full body workout at home beginner",
    "自宅 筋トレ 初心者", "ejercicio en casa sin equipo", "entraînement maison sans matériel",
    "Home Workout ohne Geräte", "treino em casa sem equipamento",
    "ออกกำลังกายที่บ้าน", "tập thể dục tại nhà",
  ]},
  { id: "러닝", label: "러닝", group: "wellness", keywords: [
    "running vlog beginner 5k", "marathon training week vlog",
    "ランニング 初心者 練習", "correr principiantes consejos", "course à pied débutant",
    "Laufen Anfänger Training", "corrida iniciante treino", "วิ่ง มือใหม่",
  ]},

  /* ── 스포츠 ────────────────────────────────────────────── */
  { id: "축구", label: "축구", group: "sports", keywords: [
    "football skills tutorial", "grassroots football training session", "amateur football match vlog",
    "サッカー 練習 ドリブル", "entrenamiento de fútbol técnica", "entraînement football dribble",
    "Fußballtraining Technik", "treino de futebol habilidades",
    "ฟุตบอล ฝึกซ้อม", "kỹ thuật bóng đá", "latihan sepak bola",
  ]},
  { id: "야구", label: "야구", group: "sports", keywords: [
    "baseball pitching mechanics", "baseball hitting drills", "little league baseball vlog",
    "野球 練習 ピッチング", "野球 バッティング 練習",
    "béisbol entrenamiento bateo", "beisebol treino",
    "棒球 投球 教學", "棒球 打擊 練習",
  ]},
  { id: "농구", label: "농구", group: "sports", keywords: [
    "basketball handles drills", "basketball shooting form", "pickup basketball vlog",
    "バスケ 練習 ドリブル", "baloncesto entrenamiento tiro", "basket entraînement dribble",
    "Basketball Training Wurf", "basquete treino arremesso", "篮球 训练 投篮",
  ]},
  { id: "골프", label: "골프", group: "sports", keywords: [
    "golf swing tips beginner", "golf course vlog amateur",
    "ゴルフ スイング 練習", "golf swing principiantes", "golf swing débutant",
    "Golfschwung Anfänger", "golfe swing iniciante", "กอล์ฟ มือใหม่",
  ]},

  /* ── 예술 · 공연 ───────────────────────────────────────── */
  { id: "현대무용", label: "현대무용", group: "arts", keywords: [
    "contemporary dance choreography", "modern dance class improvisation", "contemporary dance solo",
    "コンテンポラリーダンス 振付", "danza contemporánea coreografía", "danse contemporaine chorégraphie",
    "zeitgenössischer Tanz Choreografie", "dança contemporânea coreografia", "現代舞 編舞",
  ]},
  { id: "발레", label: "발레", group: "arts", keywords: [
    "ballet class beginner adult", "ballet barre workout",
    "バレエ 初心者 大人", "ballet principiantes adultos", "cours de ballet débutant",
    "Ballett für Anfänger", "balé iniciante adulto", "芭蕾 初學",
  ]},
  { id: "스트릿댄스", label: "스트릿댄스", group: "arts", keywords: [
    "street dance choreography class", "hip hop dance tutorial", "popping tutorial beginner",
    "ストリートダンス 練習", "street dance coreografía", "danse hip hop tutoriel",
    "Hip Hop Tanz Anleitung", "dança de rua coreografia", "街舞 教學",
  ]},
];

export const NICHE_BY_ID: Record<string, Niche> = Object.fromEntries(NICHES.map(n => [n.id, n]));

export function nichesInGroup(groupId: string): Niche[] {
  return NICHES.filter(n => n.group === groupId);
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
};

/**
 * 수집 조건 → 검색 키워드 집합
 *   niche: "전체" | "<분야 id>" | "group:<그룹 id>" | "custom"
 *   customInput: 직접 입력 키워드 (있으면 niche 와 무관하게 우선)
 */
export function resolveNicheKeywords(niche: string, customInput?: string | null): KeywordSelection {
  const custom = parseCustomKeywords(customInput);
  if (niche === "custom" || custom.length > 0) {
    const title = `키워드: ${custom.join(", ")}`.slice(0, 60);
    return { mode: "custom", keywords: custom, ordered: true, labelFor: () => title, title };
  }
  if (niche.startsWith("group:")) {
    const gid = niche.slice("group:".length);
    const list = nichesInGroup(gid);
    const group = NICHE_GROUPS.find(g => g.id === gid);
    return {
      mode: "group",
      keywords: list.flatMap(n => n.keywords),
      ordered: false,
      labelFor: kw => list.find(n => n.keywords.includes(kw))?.label ?? group?.label ?? "기타",
      title: group?.label ?? gid,
    };
  }
  const one = NICHE_BY_ID[niche];
  if (one) {
    return { mode: "niche", keywords: [...one.keywords], ordered: false, labelFor: () => one.label, title: one.label };
  }
  return {
    mode: "all",
    keywords: NICHES.flatMap(n => n.keywords),
    ordered: false,
    labelFor: kw => NICHES.find(n => n.keywords.includes(kw))?.label ?? "기타",
    title: "전체 분야",
  };
}
