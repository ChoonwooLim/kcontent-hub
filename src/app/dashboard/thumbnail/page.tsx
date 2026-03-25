"use client";
import React, { useState, useRef, useEffect, useCallback, MouseEvent } from "react";
import { 
  Download, Type, Image as ImageIcon, PaintBucket,
  Trash2, Copy, Layers, Plus, ArrowUp, ArrowDown
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

export default function ThumbnailStudioPage() {
  // 상태 관리
  const [layers, setLayers] = useState<Layer[]>([]);
  const [bgColor, setBgColor] = useState<string>("#1a1a2e");
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

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

  // 에셋 보관소에서 넘어온 이미지 로드
  useEffect(() => {
    const storedBg = sessionStorage.getItem("thumbnail_bg");
    if (storedBg) {
      const img = new Image();
      img.src = storedBg;
      img.onload = () => {
        setBgImage(img);
        sessionStorage.removeItem("thumbnail_bg");
      };
    }
  }, []);

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
      {/* ── 좌측 툴바 ── */}
      <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 20 }}>
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
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12 }}>텍스트 템플릿</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="btn btn-ghost" style={{ background: "rgba(255,255,255,0.05)" }} onClick={() => addText("title")}>
              <Type size={14} color="#818cf8" /> 메인 타이틀 (대형)
            </button>
            <button className="btn btn-ghost" style={{ background: "rgba(255,255,255,0.05)" }} onClick={() => addText("accent")}>
              <Type size={14} color="#facc15" /> 노란 강조 텍스트
            </button>
            <button className="btn btn-ghost" style={{ background: "rgba(255,255,255,0.05)" }} onClick={() => addText("subtitle")}>
              <Type size={14} color="var(--text-muted)" /> 서브 자막
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12 }}>추가 요소</div>
          <label className="btn btn-ghost" style={{ justifyContent: "center", cursor: "pointer" }}>
            <Plus size={14} /> 레이어 이미지 추가 (스티커)
            <input type="file" accept="image/*" hidden onChange={handleImgUpload} />
          </label>
        </div>

        <button className="btn btn-brand" style={{ height: 48, marginTop: "auto" }} onClick={downloadThumbnail}>
          <Download size={16} /> 썸네일 PNG 다운로드
        </button>
      </div>

      {/* ── 중앙 캔버스 ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {/* Aspect Ratio 16:9 Wrapper Container */}
        <div style={{ 
          width: "100%", maxWidth: 1000, aspectRatio: "16/9", 
          boxShadow: "0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)", 
          borderRadius: 8, overflow: "hidden", position: "relative",
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
