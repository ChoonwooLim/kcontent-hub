"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Image as ImageIcon, Film, Download,
  Search, X, Globe, Palette
} from "lucide-react";

type CapturedAsset = {
  scriptId: string;
  scriptTitle: string;
  videoId: string;
  id: string;
  name: string;
  dataUrl: string;
  time: string;
  sceneType?: string;
  sceneText?: string;
  capturedAt: number;
};

type DownloadedFile = {
  id: string;
  filename: string;
  size: number;
  mode: string;
  clipCount: number;
  videoTitle: string;
  ytVideoId: string;
  thumbnail: string;
  url: string;
  createdAt: string;
};

type ProducedThumbnail = {
  id: string;
  title: string;
  dataUrl: string;
  createdAt: string;
};

export default function AssetsLibraryPage() {
  const [tab, setTab] = useState<"images" | "videos" | "thumbnails">("images");
  const [loading, setLoading] = useState(true);
  const [captures, setCaptures] = useState<CapturedAsset[]>([]);
  const [videos, setVideos] = useState<DownloadedFile[]>([]);
  const [thumbnails, setThumbnails] = useState<ProducedThumbnail[]>([]);
  const [search, setSearch] = useState("");
  const router = useRouter();
  
  // 프레임 뷰어 모달
  const [modalImage, setModalImage] = useState<CapturedAsset | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 캡처 이미지 로드
      const resCaps = await fetch("/api/assets");
      if (resCaps.ok) {
        const data = await resCaps.json();
        setCaptures(data.captures || []);
      }
      
      // 비디오 목록 로드
      const resVids = await fetch("/api/downloads");
      if (resVids.ok) {
        const data = await resVids.json();
        setVideos(data.files || []);
      }

      // 제작 썸네일 로드
      const resThumb = await fetch("/api/thumbnails?workspaceId=test-workspace1");
      if (resThumb.ok) {
        const data = await resThumb.json();
        setThumbnails(data.thumbnails || []);
      }
    } catch { /* 무시 */ }
    finally { setLoading(false); }
  };

  const handleDownloadImage = (asset: CapturedAsset) => {
    const a = document.createElement("a");
    a.href = asset.dataUrl;
    a.download = `${asset.name}_${asset.scriptTitle}.jpg`;
    a.click();
  };

  const handleDownloadVideo = (v: DownloadedFile) => {
    const a = document.createElement("a");
    a.href = v.url;
    a.download = v.filename;
    a.click();
  };

  const filteredCaptures = captures.filter(c => 
    (c.scriptTitle || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.sceneText || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const groupedCaptures = filteredCaptures.reduce((acc, c) => {
    const key = c.scriptTitle || "알 수 없는 영상";
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {} as Record<string, CapturedAsset[]>);

  const filteredVideos = videos.filter(v => 
    (v.videoTitle || "").toLowerCase().includes(search.toLowerCase()) ||
    (v.filename || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredThumbnails = thumbnails.filter(t => 
    (t.title || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleDownloadThumbnail = (t: ProducedThumbnail) => {
    const a = document.createElement("a");
    a.href = t.dataUrl;
    a.download = `${t.title}.jpg`;
    a.click();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1200, height: "100%", paddingBottom: 60 }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>에셋 보관소</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            대본 엔진에서 캡처한 썸네일과 원본 다운로드 파일들을 모아서 관리합니다.
          </p>
        </div>
      </div>

      {/* 탭 & 검색 */}
      <div style={{ display: "flex", gap: 16, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button 
            className={`btn ${tab === "images" ? "btn-brand" : "btn-ghost"}`} 
            onClick={() => setTab("images")}
            style={{ width: 140, justifyContent: "center" }}
          >
            <ImageIcon size={14} />캡처 이미지 ({captures.length})
          </button>
          <button 
            className={`btn ${tab === "videos" ? "btn-brand" : "btn-ghost"}`} 
            onClick={() => setTab("videos")}
            style={{ width: 140, justifyContent: "center" }}
          >
            <Film size={14} />다운로드 영상 ({videos.length})
          </button>
          <button 
            className={`btn ${tab === "thumbnails" ? "btn-brand" : "btn-ghost"}`} 
            onClick={() => setTab("thumbnails")}
            style={{ width: 150, justifyContent: "center" }}
          >
            <Palette size={14} />제작 썸네일 ({thumbnails.length})
          </button>
        </div>
        <div className="input-group" style={{ flex: 1, maxWidth: 300, marginLeft: "auto" }}>
          <Search size={14} className="input-icon" />
          <input 
            className="input" 
            placeholder="제목이나 내용으로 검색..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 로딩 */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          불러오는 중...
        </div>
      ) : (
        <>
          {/* 이미지 탭 */}
          {tab === "images" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {Object.keys(groupedCaptures).length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>검색 결과가 없습니다.</div>}
              {Object.entries(groupedCaptures).map(([groupTitle, groupAssets]) => (
                <div key={groupTitle}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <Film size={15} color="#818cf8" />
                    {groupTitle}
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 12 }}>{groupAssets.length}장</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                    {groupAssets.map(asset => (
                      <div 
                        key={`${asset.scriptId}_${asset.id}`} 
                        className="card" 
                        style={{ 
                          position: "relative", overflow: "hidden", cursor: "pointer", 
                          aspectRatio: "16/9", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)",
                          transition: "transform 0.15s, box-shadow 0.15s"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.3)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; }}
                        onClick={() => setModalImage(asset)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={asset.dataUrl} 
                          alt={asset.name} 
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                        
                        {/* 그라디언트 및 정보 오버레이 */}
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 60%)", pointerEvents: "none" }} />
                        <div style={{ position: "absolute", bottom: 12, left: 14, right: 14, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none" }}>
                          {(asset.time || asset.sceneType) && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 600 }}>
                              {asset.time && <span style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", padding: "2px 6px", borderRadius: 4 }}>{asset.time}</span>}
                              {asset.sceneType && <span style={{ color: "#a5b4fc" }}>{asset.sceneType}</span>}
                            </div>
                          )}
                        </div>
                        
                        {/* 호버 시 나타나는 돋보기 리플렉션 */}
                        <div style={{
                          position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.5)",
                          padding: 6, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          backdropFilter: "blur(4px)"
                        }}>
                          <Search size={14} color="rgba(255,255,255,0.8)" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 비디오 탭 */}
          {tab === "videos" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {filteredVideos.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13, gridColumn: "1/-1" }}>검색 결과가 없습니다.</div>}
              {filteredVideos.map(vid => (
                <div key={vid.id} className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={vid.thumbnail || `https://img.youtube.com/vi/${vid.ytVideoId}/mqdefault.jpg`} alt={vid.filename} 
                      onError={e => e.currentTarget.style.display = "none"}
                      style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                    />
                    <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.7)", padding: "2px 6px", borderRadius: 4, fontSize: 10, color: "white" }}>
                      {(vid.size / (1024*1024)).toFixed(1)} MB
                    </div>
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", WebkitLineClamp: 2, display: "-webkit-box", WebkitBoxOrient: "vertical" }}>
                      {vid.videoTitle || "로컬 영상"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>
                      {vid.filename}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => handleDownloadVideo(vid)}>
                        <Download size={13} /> 파일 저장
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => window.open(vid.url, "_blank")}>
                        <Globe size={13} /> 브라우저 열기
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 제작 썸네일 탭 */}
          {tab === "thumbnails" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {filteredThumbnails.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13, gridColumn: "1/-1" }}>검색 결과가 없습니다. 썸네일 스튜디오에서 제작 후 &apos;에셋 보관소에 저장&apos; 버튼을 눌러보세요.</div>}
              {filteredThumbnails.map(t => (
                <div key={t.id} className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.dataUrl} alt={t.title} 
                      style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                    />
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>
                      {new Date(t.createdAt).toLocaleDateString()}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" style={{ flex: 1, background: "rgba(255,255,255,0.05)" }} onClick={() => handleDownloadThumbnail(t)}>
                        <Download size={13} /> 다운로드
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 이미지 뷰어 모달 */}
      {modalImage && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }} onClick={() => setModalImage(null)}>
          <button style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "white", cursor: "pointer" }} onClick={() => setModalImage(null)}>
            <X size={24} />
          </button>
          <div style={{ maxWidth: 1000, width: "100%" }} onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={modalImage.dataUrl} alt="캡처 프리뷰" style={{ width: "100%", height: "auto", borderRadius: 12, boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }} />
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 24 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "white", marginBottom: 6 }}>{modalImage.scriptTitle}</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>{modalImage.sceneText}</div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button 
                  className="btn btn-ghost" 
                  style={{ background: "rgba(255,255,255,0.1)", color: "white" }}
                  onClick={() => {
                    sessionStorage.setItem("thumbnail_bg", modalImage.dataUrl);
                    router.push("/dashboard/thumbnail");
                  }}
                >
                  <Palette size={15} color="#a5b4fc" /> 썸네일 스튜디오로 보내기
                </button>
                <button className="btn btn-brand" onClick={() => handleDownloadImage(modalImage)}>
                  <Download size={15} /> PC에 저장하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
