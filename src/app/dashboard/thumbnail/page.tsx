"use client";
import React, { useState, useRef, useEffect, useCallback, MouseEvent } from "react";
import { 
  Download, Type, Image as ImageIcon, PaintBucket,
  Trash2, Copy, Layers, Plus, ArrowUp, ArrowDown, Archive
} from "lucide-react";

const CANVAS_W = 1920;
const CANVAS_H = 1080;

type LayerType = "text" | "image";

interface BaseLayer {
  id: string;
  type: LayerType;
  x: number;
  y: number;
}

interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  shadowBlur: number;
  shadowColor: string;
  isBold: boolean;
  isItalic: boolean;
}

interface ImageLayer extends BaseLayer {
  type: "image";
  src: string;
  width: number;
  height: number;
  imgElement?: HTMLImageElement;
}

type Layer = TextLayer | ImageLayer;

const STYLE_TEMPLATES = [
  {
    name: "1. 💥충격! 대반전 (어그로형)",
    layers: [
      { text: "상상도 못한", fontSize: 180, isBold: true, isItalic: true, color: "#FFFFFF", strokeColor: "#000000", strokeWidth: 15, x: 960, y: 780, shadowBlur: 20, shadowColor: "black", fontFamily: "'Black Han Sans', sans-serif" },
      { text: "충격적인 결말?!", fontSize: 260, isBold: true, isItalic: true, color: "#FFEB3B", strokeColor: "#000000", strokeWidth: 30, x: 960, y: 950, shadowBlur: 40, shadowColor: "black", fontFamily: "'Black Han Sans', sans-serif" }
    ]
  },
  {
    name: "2. 🚨긴급 속보 (뉴스형)",
    layers: [
      { text: "[긴급 속보]", fontSize: 130, isBold: true, isItalic: false, color: "#FFFFFF", strokeColor: "#000000", strokeWidth: 8, x: 280, y: 150, shadowBlur: 20, shadowColor: "black", fontFamily: "var(--font-pretendard), sans-serif" },
      { text: "결국 사태가 일어났다...", fontSize: 220, isBold: true, isItalic: false, color: "#FFFFFF", strokeColor: "#D32F2F", strokeWidth: 35, x: 960, y: 900, shadowBlur: 20, shadowColor: "black", fontFamily: "'Black Han Sans', sans-serif" }
    ]
  },
  {
    name: "3. 🎙️감성 브이로그 (일상형)",
    layers: [
      { text: "나만의 소소한 주말 기록", fontSize: 140, isBold: false, isItalic: false, color: "#FFFFFF", strokeColor: "transparent", strokeWidth: 0, shadowBlur: 50, shadowColor: "black", x: 960, y: 540, fontFamily: "var(--font-pretendard), sans-serif" },
      { text: "ep.01", fontSize: 80, isBold: false, isItalic: false, color: "#FFFFFF", strokeColor: "transparent", strokeWidth: 0, shadowBlur: 10, shadowColor: "black", x: 960, y: 720, fontFamily: "var(--font-pretendard), sans-serif" }
    ]
  },
  {
    name: "4. 🎤아이돌 직캠 (팬튜브형)",
    layers: [
      { text: "미모가 미쳤습니다", fontSize: 240, isBold: true, isItalic: true, color: "#FFFFFF", strokeColor: "#EC4899", strokeWidth: 30, shadowBlur: 80, shadowColor: "#EC4899", x: 960, y: 920, fontFamily: "'Black Han Sans', sans-serif" },
      { text: "레전드 찍은 역대급 무대", fontSize: 140, isBold: true, isItalic: false, color: "#FFD700", strokeColor: "#000000", strokeWidth: 15, shadowBlur: 30, shadowColor: "black", x: 960, y: 150, fontFamily: "'Do Hyeon', sans-serif" }
    ]
  },
  {
    name: "5. 🍲먹방 투어 (음식형)",
    layers: [
      { text: "이 가격에 이 퀄리티?!", fontSize: 160, isBold: true, isItalic: false, color: "#FFFFFF", strokeColor: "#F97316", strokeWidth: 20, shadowBlur: 40, shadowColor: "black", x: 960, y: 200, fontFamily: "'Jua', sans-serif" },
      { text: "인생 맛집 찾았습니다", fontSize: 250, isBold: true, isItalic: false, color: "#FFED4A", strokeColor: "#000000", strokeWidth: 35, shadowBlur: 50, shadowColor: "black", x: 960, y: 880, fontFamily: "'Black Han Sans', sans-serif" }
    ]
  },
  {
    name: "6. ✨리뷰/테크 (IT형)",
    layers: [
      { text: "이거 안 사면 후회합니다", fontSize: 180, isBold: true, isItalic: false, color: "#FFFFFF", strokeColor: "#3B82F6", strokeWidth: 20, shadowBlur: 50, shadowColor: "#3B82F6", x: 960, y: 880, fontFamily: "'Noto Sans KR', sans-serif" },
      { text: "장단점 솔직 리뷰", fontSize: 110, isBold: true, isItalic: false, color: "#60A5FA", strokeColor: "#000", strokeWidth: 8, shadowBlur: 0, shadowColor: "black", x: 960, y: 180, fontFamily: "var(--font-pretendard), sans-serif" }
    ]
  },
  {
    name: "7. 🎬영화 요약 (스토리형)",
    layers: [
      { text: "외계인이 지구에 왔다가", fontSize: 160, isBold: true, isItalic: false, color: "#FFFFFF", strokeColor: "#000", strokeWidth: 20, shadowBlur: 50, shadowColor: "black", x: 960, y: 780, fontFamily: "'Do Hyeon', sans-serif" },
      { text: "초토화 되어버린 이유", fontSize: 240, isBold: true, isItalic: false, color: "#FF4500", strokeColor: "#000", strokeWidth: 30, shadowBlur: 50, shadowColor: "black", x: 960, y: 960, fontFamily: "'Black Han Sans', sans-serif" }
    ]
  },
  {
    name: "8. ✈️여행/핫플 (꿀팁형)",
    layers: [
      { text: "한국인 99%가 모르는", fontSize: 150, isBold: true, isItalic: false, color: "#FFFF00", strokeColor: "#000", strokeWidth: 15, shadowBlur: 30, shadowColor: "black", x: 960, y: 200, fontFamily: "'Jua', sans-serif" },
      { text: "숨겨진 지상낙원 어딜까?", fontSize: 210, isBold: true, isItalic: false, color: "#FFFFFF", strokeColor: "#000", strokeWidth: 20, shadowBlur: 40, shadowColor: "black", x: 960, y: 880, fontFamily: "'Jua', sans-serif" }
    ]
  },
  {
    name: "9. 📈주식/재테크 (경제형)",
    layers: [
      { text: "내일부터 무조건 오릅니다", fontSize: 220, isBold: true, isItalic: false, color: "#FFFFFF", strokeColor: "#E11D48", strokeWidth: 26, shadowBlur: 40, shadowColor: "#E11D48", x: 960, y: 900, fontFamily: "'Black Han Sans', sans-serif" },
      { text: "전문가 긴급 분석", fontSize: 120, isBold: true, isItalic: false, color: "#FDE047", strokeColor: "#000", strokeWidth: 10, shadowBlur: 20, shadowColor: "black", x: 280, y: 180, fontFamily: "var(--font-pretendard), sans-serif" }
    ]
  },
  {
    name: "10. 🎮게임 하이라이트 (매드무비)",
    layers: [
      { text: "1 대 5를 이겨버린다고?", fontSize: 240, isBold: true, isItalic: true, color: "#4ADE80", strokeColor: "#000", strokeWidth: 35, shadowBlur: 60, shadowColor: "black", x: 960, y: 920, fontFamily: "'Black Han Sans', sans-serif" },
      { text: "#매드무비 #레전드", fontSize: 100, isBold: true, isItalic: true, color: "#FFFFFF", strokeColor: "#000", strokeWidth: 10, shadowBlur: 20, shadowColor: "black", x: 960, y: 180, fontFamily: "'Do Hyeon', sans-serif" }
    ]
  },
  {
    name: "11. 🐶동물/반려견 (귀요미형)",
    layers: [
      { text: "주인 몰래 간식 훔쳐먹다", fontSize: 180, isBold: true, isItalic: false, color: "#FFFFFF", strokeColor: "#F472B6", strokeWidth: 20, shadowBlur: 30, shadowColor: "black", x: 960, y: 780, fontFamily: "'Jua', sans-serif" },
      { text: "딱 걸린 댕댕이 ㅋㅋㅋ", fontSize: 240, isBold: true, isItalic: false, color: "#FDE047", strokeColor: "#000", strokeWidth: 25, shadowBlur: 40, shadowColor: "black", x: 960, y: 960, fontFamily: "'Jua', sans-serif" }
    ]
  },
  {
    name: "12. 💬인터뷰/대담 (인물집중형)",
    layers: [
      { text: `"제가 사실 그때..."`, fontSize: 170, isBold: true, isItalic: false, color: "#FFFFFF", strokeColor: "#000", strokeWidth: 15, shadowBlur: 50, shadowColor: "black", x: 960, y: 760, fontFamily: "'Noto Sans KR', sans-serif" },
      { text: "드디어 밝혀진 진짜 이유", fontSize: 130, isBold: true, isItalic: false, color: "#D1D5DB", strokeColor: "transparent", strokeWidth: 0, shadowBlur: 60, shadowColor: "black", x: 960, y: 920, fontFamily: "var(--font-pretendard), sans-serif" }
    ]
  },
  {
    name: "13. 🔥폭로/논란 (진실공방)",
    layers: [
      { text: "더 이상 못 참겠습니다", fontSize: 260, isBold: true, isItalic: false, color: "#E11D48", strokeColor: "#FFFFFF", strokeWidth: 20, shadowBlur: 60, shadowColor: "black", x: 960, y: 900, fontFamily: "'Black Han Sans', sans-serif" }
    ]
  },
  {
    name: "14. 👻공포/미스터리 (납량특집)",
    layers: [
      { text: "절대 혼자 보지 마세요", fontSize: 190, isBold: true, isItalic: false, color: "#991B1B", strokeColor: "#000", strokeWidth: 15, shadowBlur: 80, shadowColor: "#EF4444", x: 960, y: 540, fontFamily: "'Do Hyeon', sans-serif" },
      { text: "폐가에서 찍힌 기묘한 형체", fontSize: 140, isBold: true, isItalic: false, color: "#FFFFFF", strokeColor: "transparent", strokeWidth: 0, shadowBlur: 30, shadowColor: "black", x: 960, y: 880, fontFamily: "'Noto Sans KR', sans-serif" }
    ]
  },
  {
    name: "15. 😂유머/짤방 (숏폼감성)",
    layers: [
      { text: "아 ㅋㅋㅋㅋㅋㅋ", fontSize: 300, isBold: true, isItalic: true, color: "#FFFF00", strokeColor: "#000000", strokeWidth: 40, shadowBlur: 20, shadowColor: "black", x: 960, y: 540, fontFamily: "'Jua', sans-serif" }
    ]
  },
  {
    name: "16. 💡강좌/꿀팁 (교육형)",
    layers: [
      { text: "엑셀 단축키 딱 3개면", fontSize: 160, isBold: true, isItalic: false, color: "#FFFFFF", strokeColor: "#000", strokeWidth: 15, shadowBlur: 20, shadowColor: "black", x: 960, y: 780, fontFamily: "'Noto Sans KR', sans-serif" },
      { text: "퇴근 시간이 2시간 빨라짐", fontSize: 200, isBold: true, isItalic: false, color: "#34D399", strokeColor: "#000", strokeWidth: 20, shadowBlur: 30, shadowColor: "black", x: 960, y: 950, fontFamily: "'Black Han Sans', sans-serif" }
    ]
  },
  {
    name: "17. 💄뷰티/패션 (세련된 스타일)",
    layers: [
      { text: "올 봄 유행할 메이크업", fontSize: 180, isBold: true, isItalic: false, color: "#FDA4AF", strokeColor: "transparent", strokeWidth: 0, shadowBlur: 40, shadowColor: "rgba(0,0,0,0.6)", x: 960, y: 800, fontFamily: "'Do Hyeon', sans-serif" },
      { text: "퍼스널 컬러 완벽 가이드", fontSize: 140, isBold: false, isItalic: false, color: "#FFFFFF", strokeColor: "transparent", strokeWidth: 0, shadowBlur: 20, shadowColor: "rgba(0,0,0,0.6)", x: 960, y: 960, fontFamily: "var(--font-pretendard), sans-serif" }
    ]
  },
  {
    name: "18. 💪운동/다이어트 (강렬한 동기부여)",
    layers: [
      { text: "한 달 만에 -10kg?!", fontSize: 220, isBold: true, isItalic: true, color: "#FDE047", strokeColor: "#000", strokeWidth: 25, shadowBlur: 30, shadowColor: "black", x: 960, y: 240, fontFamily: "'Black Han Sans', sans-serif" },
      { text: "기적의 홈트 루틴 대공개", fontSize: 150, isBold: true, isItalic: false, color: "#FFFFFF", strokeColor: "#000", strokeWidth: 15, shadowBlur: 20, shadowColor: "black", x: 960, y: 920, fontFamily: "'Do Hyeon', sans-serif" }
    ]
  },
  {
    name: "19. 🚗자동차/드라이브 (액션형)",
    layers: [
      { text: "풀옵션 G90 타봤습니다", fontSize: 190, isBold: true, isItalic: false, color: "#FFFFFF", strokeColor: "#1E3A8A", strokeWidth: 25, shadowBlur: 40, shadowColor: "black", x: 960, y: 880, fontFamily: "'Jua', sans-serif" },
      { text: "승차감 실화입니까?", fontSize: 130, isBold: true, isItalic: true, color: "#FFFFFF", strokeColor: "#000", strokeWidth: 10, shadowBlur: 20, shadowColor: "black", x: 400, y: 150, fontFamily: "'Noto Sans KR', sans-serif" }
    ]
  },
  {
    name: "20. 🎉이벤트/당첨 (어그로 극대화)",
    layers: [
      { text: "구독자 10만명 달성!", fontSize: 150, isBold: true, isItalic: false, color: "#FFFFFF", strokeColor: "#000", strokeWidth: 15, shadowBlur: 30, shadowColor: "black", x: 960, y: 220, fontFamily: "'Jua', sans-serif" },
      { text: "맥북 아이패드 쏩니다!!", fontSize: 260, isBold: true, isItalic: true, color: "#FF0000", strokeColor: "#FFFFFF", strokeWidth: 30, shadowBlur: 60, shadowColor: "rgba(255,0,0,0.5)", x: 960, y: 900, fontFamily: "'Black Han Sans', sans-serif" }
    ]
  }
];

export default function ThumbnailStudioPage() {
  // 상태 관리
  const [layers, setLayers] = useState<Layer[]>([]);
  const [bgColor, setBgColor] = useState<string>("#1a1a2e");
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<{ name: string, layers: Partial<TextLayer>[] }[]>([]);

  // 캔버스 및 렌더링
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 렌더 코어 함수
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 배경 지우기 & 그리기
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (bgImage) {
      // cover 모드로 그리기
      const scale = Math.max(CANVAS_W / bgImage.width, CANVAS_H / bgImage.height);
      const w = bgImage.width * scale;
      const h = bgImage.height * scale;
      const x = (CANVAS_W - w) / 2;
      const y = (CANVAS_H - h) / 2;
      ctx.drawImage(bgImage, x, y, w, h);
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // 레이어 그리기
    layers.forEach(layer => {
      ctx.save();
      if (layer.type === "text") {
        const t = layer as TextLayer;
        ctx.font = `${t.isItalic ? "italic " : ""}${t.isBold ? "bold " : ""}${t.fontSize}px ${t.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        ctx.shadowColor = t.shadowColor;
        ctx.shadowBlur = t.shadowBlur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // 멀티라인 처리
        const lines = t.text.split("\n");
        const lineHeight = t.fontSize * 1.2;
        const startY = layer.y - (lines.length - 1) * lineHeight / 2;

        lines.forEach((line, idx) => {
          const cy = startY + idx * lineHeight;
          // 윤곽선
          if (t.strokeWidth > 0) {
            ctx.lineWidth = t.strokeWidth;
            ctx.strokeStyle = t.strokeColor;
            ctx.strokeText(line, layer.x, cy);
          }
          // 채우기
          ctx.shadowBlur = 0; // 그림자는 채우기에만 들어감 (선택적)
          ctx.fillStyle = t.color;
          ctx.fillText(line, layer.x, cy);
        });

        // 선택 영역 표시
        if (selectedId === layer.id || hoverId === layer.id) {
          ctx.shadowBlur = 0;
          let maxWidth = 0;
          lines.forEach(line => {
             const m = ctx.measureText(line);
             if(m.width > maxWidth) maxWidth = m.width;
          });
          const totalHeight = lines.length * lineHeight;
          ctx.strokeStyle = selectedId === layer.id ? "#00ffff" : "rgba(255,255,255,0.4)";
          ctx.lineWidth = selectedId === layer.id ? 2 : 1;
          ctx.setLineDash([6, 6]);
          ctx.strokeRect(layer.x - maxWidth / 2 - 10, layer.y - totalHeight / 2 - 10, maxWidth + 20, totalHeight + 20);
          ctx.setLineDash([]);
        }
      } else if (layer.type === "image") {
        const imgL = layer as ImageLayer;
        if (imgL.imgElement) {
          ctx.drawImage(imgL.imgElement, imgL.x - imgL.width / 2, imgL.y - imgL.height / 2, imgL.width, imgL.height);
          
          if (selectedId === layer.id || hoverId === layer.id) {
            ctx.strokeStyle = selectedId === layer.id ? "#00ffff" : "rgba(255,255,255,0.4)";
            ctx.lineWidth = selectedId === layer.id ? 2 : 1;
            ctx.setLineDash([6, 6]);
            ctx.strokeRect(imgL.x - imgL.width / 2 - 4, imgL.y - imgL.height / 2 - 4, imgL.width + 8, imgL.height + 8);
            ctx.setLineDash([]);
          }
        }
      }
      ctx.restore();
    });
  }, [layers, bgColor, bgImage, selectedId, hoverId]);

  useEffect(() => {
    draw();
  }, [draw]);

  // 폰트, 세션(보내기), 로컬스토리지 백업 데이터 로드
  useEffect(() => {
    // 1. 구글 한국어 폰트 동적 로드 (검은고딕, 도현, 주아, 본고딕)
    const fontLinkStr = "https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Do+Hyeon&family=Jua&family=Noto+Sans+KR:wght@400;700;900&display=swap";
    let fontLink = document.querySelector(`link[href="${fontLinkStr}"]`);
    if (!fontLink) {
      fontLink = document.createElement("link");
      (fontLink as HTMLLinkElement).rel = "stylesheet";
      (fontLink as HTMLLinkElement).href = fontLinkStr;
      document.head.appendChild(fontLink);
    }

    // 2. 데이터 우선순위: 세션 스토리지 (방금 에셋에서 보냄) > 로컬 스토리지 (이전 작업 복구)
    const storedBg = sessionStorage.getItem("thumbnail_bg");
    if (storedBg) {
      setTimeout(() => setLayers([]), 0); // eslint warning 방지
      const img = new Image();
      img.src = storedBg;
      img.onload = () => {
        setBgImage(img);
        sessionStorage.removeItem("thumbnail_bg");
      };
    } else {
      // 로컬 스토리지에서 이전 작업 복구
      try {
        const saved = localStorage.getItem("thumbnail_studio_save");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.bgColor) setTimeout(() => setBgColor(parsed.bgColor), 0);
          if (parsed.bgImageSrc) {
            const img = new Image();
            img.src = parsed.bgImageSrc;
            img.onload = () => setBgImage(img);
          }
          if (parsed.layers && Array.isArray(parsed.layers)) {
            const restoredLayers = parsed.layers.map((l: Record<string, unknown>) => {
              if (l.type === "image") {
                const img = new Image();
                img.src = l.src as string;
                return { ...l, imgElement: img };
              }
              return l;
            });
            setTimeout(() => setLayers(restoredLayers as Layer[]), 0);
          }
        }
      } catch { }
    }

    // 3. 내 작업 템플릿 로드 (비동기)
    fetch("/api/thumbnails?workspaceId=test-workspace1")
      .then(r => r.json())
      .then(d => {
        if (d.success && d.thumbnails) {
          const temps = d.thumbnails
            .filter((t: Record<string, unknown>) => !!t.layersJson)
            .map((t: Record<string, unknown>) => {
              try { return { name: "⭐️ " + ((t.title as string) || "내 작업물"), layers: JSON.parse(t.layersJson as string) }; }
              catch { return null; }
            })
            .filter(Boolean);
          setCustomTemplates(temps);
        }
      })
      .catch(() => {});
  }, []);

  // 상태 변경 시마다 로컬스토리지 백업 (오토세이브)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const _layers = layers.map(l => {
          if (l.type === "image") {
            // imgElement는 직렬화 불가능하므로 제거 후 백업
            const rest = { ...l } as Partial<ImageLayer>;
            delete rest.imgElement;
            return rest;
          }
          return l;
        });
        localStorage.setItem("thumbnail_studio_save", JSON.stringify({
          layers: _layers,
          bgColor,
          bgImageSrc: bgImage ? bgImage.src : null
        }));
      } catch { }
    }, 500); // 디바운스
    return () => clearTimeout(timer);
  }, [layers, bgColor, bgImage]);

  // 마우스 이벤트 헬퍼
  const getMousePos = (e: MouseEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { logicX: 0, logicY: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return {
      logicX: (e.clientX - rect.left) * scaleX,
      logicY: (e.clientY - rect.top) * scaleY
    };
  };

  // 피킹 로직
  const getHitLayer = (x: number, y: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // 위(가장 최근 추가된 레이어)부터 검사
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (l.type === "text") {
        const t = l as TextLayer;
        ctx.font = `${t.isItalic ? "italic " : ""}${t.isBold ? "bold " : ""}${t.fontSize}px ${t.fontFamily}`;
        const lines = t.text.split("\n");
        let maxWidth = 0;
        lines.forEach(line => {
           const w = ctx.measureText(line).width;
           if(w > maxWidth) maxWidth = w;
        });
        const totalHeight = lines.length * (t.fontSize * 1.2);
        const lX = l.x - maxWidth / 2;
        const tY = l.y - totalHeight / 2;
        if (x >= lX && x <= lX + maxWidth && y >= tY && y <= tY + totalHeight) {
          return l.id;
        }
      } else if (l.type === "image") {
        const imgL = l as ImageLayer;
        const lX = l.x - imgL.width / 2;
        const tY = l.y - imgL.height / 2;
        if (x >= lX && x <= lX + imgL.width && y >= tY && y <= tY + imgL.height) {
          return l.id;
        }
      }
    }
    return null;
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const { logicX, logicY } = getMousePos(e);
    const hitId = getHitLayer(logicX, logicY);
    setSelectedId(hitId);
    if (hitId) {
      const hitL = layers.find(l => l.id === hitId)!;
      setDragging({ id: hitId, offsetX: logicX - hitL.x, offsetY: logicY - hitL.y });
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const { logicX, logicY } = getMousePos(e);
    if (dragging) {
      setLayers(prev => prev.map(l => l.id === dragging.id ? { ...l, x: logicX - dragging.offsetX, y: logicY - dragging.offsetY } : l));
    } else {
      const hitId = getHitLayer(logicX, logicY);
      setHoverId(hitId);
    }
  };

  const onMouseUp = () => {
    setDragging(null);
  };

  // 객체 추가 함수들
  const addText = (preset: "title" | "subtitle" | "accent" = "title") => {
    const id = `text_${Date.now()}`;
    const newText: TextLayer = {
      id, type: "text",
      x: CANVAS_W / 2, y: CANVAS_H / 2,
      text: preset === "title" ? "메인 타이틀 입력" : preset === "subtitle" ? "서브 자막 입력" : "강조 타이틀 입력!",
      fontSize: preset === "title" ? 210 : preset === "subtitle" ? 90 : 240,
      fontFamily: "var(--font-pretendard), sans-serif",
      isBold: true, isItalic: preset === "accent",
      color: preset === "accent" ? "#FFEB3B" : "#FFFFFF",
      strokeColor: "#000000",
      strokeWidth: preset === "title" ? 18 : preset === "subtitle" ? 10 : 25,
      shadowBlur: 30,
      shadowColor: "rgba(0,0,0,0.8)"
    };
    setLayers(prev => [...prev, newText]);
    setSelectedId(id);
  };

  const applyTemplate = (tpl: { name: string, layers: Partial<TextLayer>[] }) => {
    if (layers.some(l => l.type === "text")) {
       if (!confirm("기존 텍스트 레이어들이 모두 지워지고 새로운 템플릿이 덮어씌워집니다.\n계속하시겠습니까? (배경은 유지됩니다)")) return;
    }
    const nonText = layers.filter(l => l.type !== "text");
    const newTextLayers = tpl.layers.map((l, i) => ({
      id: `text_tpl_${Date.now()}_${i}`,
      type: "text" as const,
      ...l
    } as TextLayer));
    setLayers([...nonText, ...newTextLayers]);
    if (newTextLayers.length > 0) setSelectedId(newTextLayers[0].id);
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    img.onload = () => setBgImage(img);
  };

  const handleImgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    img.onload = () => {
      // 캔버스 크기의 50%를 넘지 않게 조절
      let w = img.width;
      let h = img.height;
      if (w > CANVAS_W / 2) {
        h = h * (CANVAS_W / 2 / w);
        w = CANVAS_W / 2;
      }
      const newImgLayer: ImageLayer = {
        id: `img_${Date.now()}`, type: "image",
        x: CANVAS_W / 2, y: CANVAS_H / 2,
        src: url, imgElement: img, width: w, height: h
      };
      setLayers(prev => [...prev, newImgLayer]);
      setSelectedId(newImgLayer.id);
    };
  };

  const downloadThumbnail = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // 선택 테두리 없이 순수 출력물을 그리기 위해 잠시 선택 해제 후 렌더->출력->복구
    const tempSel = selectedId;
    setSelectedId(null);
    setHoverId(null);
    setTimeout(() => {
      draw();
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/jpeg", 0.95);
      a.download = `썸네일_${Date.now()}.jpg`;
      a.click();
      setSelectedId(tempSel);
    }, 50);
  };

  const saveToAssets = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsSaving(true);
    const tempSel = selectedId;
    setSelectedId(null);
    setHoverId(null);
    
    setTimeout(async () => {
      draw();
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      
      const textLayers = layers.filter(l => l.type === "text").map(l => ({...l}));
      const layersJson = textLayers.length > 0 ? JSON.stringify(textLayers) : null;
      
      try {
        const res = await fetch("/api/thumbnails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `내 보관함 템플릿_${new Date().toISOString().slice(0, 10)}`,
            dataUrl,
            layersJson,
            workspaceId: "test-workspace1"
          })
        });
        if (res.ok) {
           if (textLayers.length > 0) {
             setCustomTemplates(prev => [{ name: "⭐️ 방금 저장된 템플릿", layers: textLayers as Partial<TextLayer>[] }, ...prev]);
           }
           alert("에셋 보관소에 성공적으로 저장되었습니다!");
        } else {
           alert("저장 실패");
        }
      } catch {
         alert("오류 발생");
      }
      setSelectedId(tempSel);
      setIsSaving(false);
    }, 50);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setLayers(prev => prev.filter(l => l.id !== selectedId));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selectedId) return;
    const tgt = layers.find(l => l.id === selectedId);
    if (!tgt) return;
    const newId = `${tgt.type}_${Date.now()}`;
    const newL = { ...tgt, id: newId, x: tgt.x + 60, y: tgt.y + 60 } as Layer;
    setLayers(prev => [...prev, newL]);
    setSelectedId(newId);
  };

  const changeLayerOrder = (dir: "up" | "down" | "top" | "bottom") => {
    if (!selectedId) return;
    const idx = layers.findIndex(l => l.id === selectedId);
    if (idx === -1) return;
    
    const newLayers = [...layers];
    const tgt = newLayers.splice(idx, 1)[0];
    
    if (dir === "up") newLayers.splice(Math.min(idx + 1, layers.length), 0, tgt);
    if (dir === "down") newLayers.splice(Math.max(idx - 1, 0), 0, tgt);
    if (dir === "top") newLayers.push(tgt);
    if (dir === "bottom") newLayers.unshift(tgt);
    setLayers(newLayers);
  };

  // 프로퍼티 변경 헬퍼
  const updateSelectedText = (key: keyof TextLayer, val: string | number | boolean) => {
    setLayers(prev => prev.map(l => (l.id === selectedId && l.type === "text" ? { ...l, [key]: val } : l)));
  };

  const updateSelectedImg = (key: keyof ImageLayer, val: string | number) => {
    setLayers(prev => prev.map(l => (l.id === selectedId && l.type === "image" ? { ...l, [key]: val } : l)));
  };

  const selectedLayer = layers.find(l => l.id === selectedId);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 40px)", gap: 24, paddingTop: 10, paddingBottom: 10, maxWidth: 1600 }}>
        {/* ── 좌초 툴바 ── */}
      <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", paddingRight: 4 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>썸네일 스튜디오</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            유튜브용 16:9 썸네일을 <br/>마우스 드래그로 손쉽게 제작하세요.
          </p>
        </div>


        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12 }}>배경 설정</div>
          <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
            <label className="btn btn-ghost" style={{ justifyContent: "center", cursor: "pointer" }}>
              <ImageIcon size={14} /> 배경 이미지 업로드
              <input type="file" accept="image/*" hidden onChange={handleBgUpload} />
            </label>
            {bgImage && (
              <button className="btn btn-ghost" style={{ justifyContent: "center", color: "#f87171" }} onClick={() => setBgImage(null)}>
                <Trash2 size={14} /> 배경 이미지 제거
              </button>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1 }}>단색 배경</span>
              <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ width: 40, height: 28, padding: 0, border: "none", cursor: "pointer", background: "none" }} />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12 }}>내맘대로 추가 요소</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <button className="btn btn-ghost" style={{ background: "rgba(255,255,255,0.05)", flex: 1, height: 32, fontSize: 12, padding: "0 8px" }} onClick={() => addText("title")}>
              <Type size={12} color="#818cf8" /> 메인 타이틀
            </button>
            <button className="btn btn-ghost" style={{ background: "rgba(255,255,255,0.05)", flex: 1, height: 32, fontSize: 12, padding: "0 8px" }} onClick={() => addText("accent")}>
              <Type size={12} color="#facc15" /> 노란 강조
            </button>
            <button className="btn btn-ghost" style={{ background: "rgba(255,255,255,0.05)", flex: 1, height: 32, fontSize: 12, padding: "0 8px", minWidth: 100 }} onClick={() => addText("subtitle")}>
              <Type size={12} color="var(--text-muted)" /> 서브 자막
            </button>
          </div>
          <label className="btn btn-ghost" style={{ justifyContent: "center", cursor: "pointer" }}>
            <Plus size={14} /> 자유 이미지 추가 (스티커)
            <input type="file" accept="image/*" hidden onChange={handleImgUpload} />
          </label>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto", flexShrink: 0 }}>
          <button className="btn btn-ghost" style={{ height: 48, background: "rgba(255,255,255,0.05)" }} onClick={saveToAssets} disabled={isSaving}>
            <Archive size={16} color="#34d399" /> {isSaving ? "저장 중..." : "에셋 보관소에 저장"}
          </button>
          <button className="btn btn-brand" style={{ height: 48 }} onClick={downloadThumbnail}>
            <Download size={16} /> 고화질 썸네일 다운로드
          </button>
        </div>
      </div>

      {/* ── 중앙 캔버스 및 갤러리 영역 ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", gap: 20 }}>
        {/* Aspect Ratio 16:9 Wrapper Container */}
        <div style={{ 
          width: "100%", maxWidth: 1000, aspectRatio: "16/9", 
          boxShadow: "0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)", 
          borderRadius: 8, overflow: "hidden", position: "relative", flexShrink: 0,
          background: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\"><rect width=\"10\" height=\"10\" fill=\"%23333\"/><rect x=\"10\" y=\"10\" width=\"10\" height=\"10\" fill=\"%23333\"/></svg>')",
          backgroundSize: "20px 20px"
        }}>
          <canvas 
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ 
              width: "100%", height: "100%", display: "block", cursor: dragging ? "grabbing" : hoverId ? "grab" : "default" 
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          />
        </div>

        {/* ── 템플릿 갤러리 (하단) ── */}
        <div className="card" style={{ width: "100%", maxWidth: 1000, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>🔥 템플릿 갤러리</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>스마트 템플릿 및 내 작업물 ({customTemplates.length + STYLE_TEMPLATES.length}종)</span>
          </div>
          <div style={{ 
             display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16
          }}>
            {[...customTemplates, ...STYLE_TEMPLATES].map((tpl, i) => (
              <div 
                key={i}
                onClick={() => applyTemplate(tpl as { name: string, layers: Partial<TextLayer>[] })}
                style={{
                  width: "100%", aspectRatio: "16/9", 
                  background: "#0f172a", borderRadius: 10, cursor: "pointer",
                  border: "2px solid rgba(255,255,255,0.08)", overflow: "hidden",
                  position: "relative",
                  transition: "all 0.15s"
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#818cf8"; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 10px 25px rgba(0,0,0,0.5)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                title={tpl.name}
              >
                {/* 1920x1080 축소 이미지 변환 레이어 */}
                <div style={{
                    width: 1920, height: 1080, position: "absolute", top: 0, left: 0,
                    transform: "scale(0.165)", transformOrigin: "top left",
                    pointerEvents: "none"
                 }}>
                    {/* 가독성을 높이기 위한 다크 모던 더미 배경 */}
                    <div style={{ 
                      width: 1920, height: 1080, position: "absolute", inset: 0, 
                      background: "url('https://images.unsplash.com/photo-1620121692029-d088224ddc74?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80') center/cover", 
                      opacity: 0.5 
                    }} />

                    {tpl.layers.map((l: Record<string, unknown>, li: number) => {
                       if (l.type === "text") {
                         const lines = ((l.text as string) || "").split("\n");
                         return (
                           <div key={li} style={{
                              position: "absolute", left: l.x as number, top: l.y as number,
                              transform: "translate(-50%, -50%)",
                              color: l.color as string, fontFamily: l.fontFamily as string,
                              fontSize: l.fontSize as number, fontWeight: l.isBold ? "bold" : "normal", fontStyle: l.isItalic ? "italic" : "normal",
                              textShadow: `${l.shadowBlur}px ${l.shadowBlur}px ${l.shadowColor}`,
                              WebkitTextStroke: `${l.strokeWidth}px ${l.strokeColor}`,
                              whiteSpace: "pre-wrap", textAlign: "center", lineHeight: "1.2"
                           }}>
                              {lines.map((line: string, lIdx: number) => <div key={lIdx}>{line}</div>)}
                           </div>
                         )
                       }
                       return null;
                    })}
                 </div>
                 {/* 타이틀 오버레이 */}
                 <div style={{ position: "absolute", top: 0, left: 0, background: tpl.name.includes("⭐️") ? "rgba(250, 204, 21, 0.9)" : "rgba(0,0,0,0.7)", color: tpl.name.includes("⭐️") ? "#000" : "white", fontSize: 11, fontWeight: 800, padding: "4px 10px", borderBottomRightRadius: 10 }}>
                    {tpl.name.includes("⭐️") ? "MY ✨" : "PRESET"}
                 </div>
                 <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "30px 12px 10px", background: "linear-gradient(to top, rgba(0,0,0,0.95), transparent)", color: "white", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                   {tpl.name.replace("⭐️ ", "")}
                 </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 우측 속성 창 ── */}
      <div style={{ width: 280, flexShrink: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, paddingRight: 4 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 10, marginBottom: 16 }}>
            속성 및 편집
          </div>
          
          {!selectedLayer ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>
              캔버스에서 요소를 선택하세요.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              
              {/* 공통 동작 (삭제, 복사, 레이어 순서) */}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={deleteSelected} title="삭제"><Trash2 size={14} color="#f87171" /></button>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={duplicateSelected} title="복사"><Copy size={14} /></button>
                <div style={{ width: 1, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
                <button className="btn btn-ghost btn-sm" onClick={() => changeLayerOrder("up")} title="앞으로 한 칸"><ArrowUp size={14} /></button>
                <button className="btn btn-ghost btn-sm" onClick={() => changeLayerOrder("down")} title="뒤로 한 칸"><ArrowDown size={14} /></button>
              </div>

              {selectedLayer.type === "text" && (
                <>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>텍스트 내용</div>
                    <textarea 
                      className="input" 
                      style={{ height: 100, resize: "vertical", width: "100%" }}
                      value={(selectedLayer as TextLayer).text}
                      onChange={e => updateSelectedText("text", e.target.value)}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>크기</div>
                        <input type="number" className="input" style={{ width: "100%" }} value={(selectedLayer as TextLayer).fontSize} onChange={e => updateSelectedText("fontSize", Number(e.target.value))} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>글꼴 체형</div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className={`btn btn-sm ${ (selectedLayer as TextLayer).isBold ? 'btn-brand' : 'btn-ghost' }`} style={{ flex: 1 }} onClick={() => updateSelectedText("isBold", !(selectedLayer as TextLayer).isBold)}><b>B</b></button>
                          <button className={`btn btn-sm ${ (selectedLayer as TextLayer).isItalic ? 'btn-brand' : 'btn-ghost' }`} style={{ flex: 1, fontStyle: "italic" }} onClick={() => updateSelectedText("isItalic", !(selectedLayer as TextLayer).isItalic)}>I</button>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>사용 폰트 (유튜브 추천 서체)</div>
                      <select 
                        className="input" 
                        style={{ width: "100%", padding: "6px 10px", fontSize: 13, cursor: "pointer", background: "rgba(255,255,255,0.05)" }}
                        value={(selectedLayer as TextLayer).fontFamily}
                        onChange={e => updateSelectedText("fontFamily", e.target.value)}
                      >
                        <option value="var(--font-pretendard), sans-serif">프리텐다드 (기본/모던)</option>
                        <option value="'Black Han Sans', sans-serif">검은고딕 (매우 두꺼움/어그로용)</option>
                        <option value="'Do Hyeon', sans-serif">도현체 (유튜브 단골/귀여운 굵은글씨)</option>
                        <option value="'Jua', sans-serif">주아체 (둥글둥글/친근함)</option>
                        <option value="'Noto Sans KR', sans-serif">본고딕 (정갈함/가독성)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>글자 색상</div>
                    <input type="color" value={(selectedLayer as TextLayer).color} onChange={e => updateSelectedText("color", e.target.value)} style={{ width: 40, height: 30, padding: 0, border: "none", cursor: "pointer", background: "none" }} />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>윤곽선 색상</div>
                    <input type="color" value={(selectedLayer as TextLayer).strokeColor} onChange={e => updateSelectedText("strokeColor", e.target.value)} style={{ width: 40, height: 30, padding: 0, border: "none", cursor: "pointer", background: "none" }} />
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>윤곽선 두께 ({(selectedLayer as TextLayer).strokeWidth}px)</div>
                    <input type="range" min="0" max="60" value={(selectedLayer as TextLayer).strokeWidth} onChange={e => updateSelectedText("strokeWidth", Number(e.target.value))} style={{ width: "100%", accentColor: "var(--brand)" }} />
                  </div>
                  
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>그림자(Glow) 효과 강도 ({(selectedLayer as TextLayer).shadowBlur})</div>
                    <input type="range" min="0" max="80" value={(selectedLayer as TextLayer).shadowBlur} onChange={e => updateSelectedText("shadowBlur", Number(e.target.value))} style={{ width: "100%", accentColor: "var(--brand)" }} />
                  </div>
                </>
              )}

              {selectedLayer.type === "image" && (
                <>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>이미지 너비 ({(selectedLayer as ImageLayer).width.toFixed(0)}px)</div>
                    <input type="range" min="50" max="3800" value={(selectedLayer as ImageLayer).width} onChange={e => {
                       const w = Number(e.target.value);
                       const ratio = (selectedLayer as ImageLayer).height / (selectedLayer as ImageLayer).width;
                       updateSelectedImg("width", w);
                       updateSelectedImg("height", w * ratio); // 비율 유지
                    }} style={{ width: "100%", accentColor: "var(--brand)" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>크기 조정 시 비율은 고정됩니다.</div>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* 레이어 트리 구조 */}
        <div className="card" style={{ padding: 16 }}>
           <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, display: "flex", gap: 6, alignItems: "center" }}><Layers size={14} /> 레이어 패널</div>
           <div style={{ display: "flex", flexDirection: "column-reverse", gap: 4 }}>
             {layers.map((l, idx) => (
                <div 
                   key={l.id} 
                   style={{ 
                      padding: "8px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, display: "flex", gap: 8, alignItems: "center",
                      background: selectedId === l.id ? "var(--brand)" : "rgba(255,255,255,0.05)",
                      color: selectedId === l.id ? "white" : "var(--text-primary)"
                   }}
                   onClick={() => setSelectedId(l.id)}
                >
                   {l.type === "text" ? <Type size={12} /> : <ImageIcon size={12} />}
                   <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                     {l.type === "text" ? (l as TextLayer).text.replace(/\n/g, " ") : "이미지 소품"}
                   </span>
                   <span style={{ opacity: 0.5, fontSize: 10 }}>#{idx+1}</span>
                </div>
             ))}
             {layers.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "10px 0" }}>레이어가 없습니다.</div>}
             <div style={{ padding: "8px 12px", borderRadius: 6, fontSize: 12, display: "flex", gap: 8, alignItems: "center", background: "rgba(0,0,0,0.4)", color: "var(--text-muted)" }}>
               <PaintBucket size={12}/> 배경 레이어 (맨 아래)
             </div>
           </div>
        </div>

      </div>
    </div>
  );
}
