"use client";
import { useState } from "react";
import {
  Search, Filter, Play, Youtube, TrendingUp, Clock, Eye, ThumbsUp,
  Subtitles, ChevronDown, SlidersHorizontal, Sparkles, ArrowRight, Globe
} from "lucide-react";

const CATEGORIES = ["전체", "교육", "요리", "여행", "과학", "엔터테인먼트", "뉴스", "스포츠"];
const SORT_OPTIONS = ["조회수 많은 순", "최신 업로드 순", "구독자 많은 순", "번역 난이도 쉬운 순"];
const REGIONS = ["글로벌", "미국", "영국", "호주", "캐나다"];

const MOCK_VIDEOS = [
  {
    id: "1", title: "10 English Phrases You Must Know (Everyday Speech)", channel: "English with Lucy",
    views: "4.2M", likes: "87K", duration: "12:34", category: "교육",
    difficulty: "쉬움", hasSubtitles: true, subs: "2.1M",
    thumbnail_color: "#1a237e", publishedAt: "3일 전", estimated_cpm: "₩18,000"
  },
  {
    id: "2", title: "Gordon Ramsay Teaches You How to Cook Perfectly", channel: "Gordon Ramsay",
    views: "8.7M", likes: "245K", duration: "18:20", category: "요리",
    difficulty: "쉬움", hasSubtitles: true, subs: "20.4M",
    thumbnail_color: "#b71c1c", publishedAt: "5일 전", estimated_cpm: "₩22,000"
  },
  {
    id: "3", title: "Hidden Gems of Tokyo - Travel Guide 2025", channel: "Travel Maisy",
    views: "1.9M", likes: "52K", duration: "22:10", category: "여행",
    difficulty: "보통", hasSubtitles: false, subs: "680K",
    thumbnail_color: "#0d47a1", publishedAt: "1일 전", estimated_cpm: "₩15,000"
  },
  {
    id: "4", title: "The Science Behind Black Holes Explained Simply", channel: "Kurzgesagt",
    views: "12.1M", likes: "521K", duration: "9:47", category: "과학",
    difficulty: "보통", hasSubtitles: true, subs: "22.8M",
    thumbnail_color: "#311b92", publishedAt: "2주 전", estimated_cpm: "₩25,000"
  },
  {
    id: "5", title: "Apartment Tour NYC - 500sq ft Studio Design", channel: "Design Milk",
    views: "890K", likes: "32K", duration: "15:22", category: "라이프스타일",
    difficulty: "쉬움", hasSubtitles: false, subs: "321K",
    thumbnail_color: "#1b5e20", publishedAt: "4일 전", estimated_cpm: "₩12,000"
  },
  {
    id: "6", title: "Top 10 Crazy Science Experiments at Home Vol.5", channel: "Science Geek",
    views: "3.4M", likes: "98K", duration: "11:05", category: "과학",
    difficulty: "쉬움", hasSubtitles: true, subs: "4.2M",
    thumbnail_color: "#e65100", publishedAt: "6일 전", estimated_cpm: "₩20,000"
  },
];

export default function FinderPage() {
  const [query, setQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState("전체");
  const [selectedRegion, setSelectedRegion] = useState("글로벌");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const handleSearch = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setSearched(true); }, 1200);
  };

  const filtered = MOCK_VIDEOS.filter(v =>
    selectedCat === "전체" || v.category === selectedCat
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1200 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>콘텐츠 파인더 🔍</h1>
        <p style={{ color: "#71717a" }}>해외 인기 영상을 AI로 자동 발굴해 한국어 자막 채널에 최적화된 영상을 찾습니다</p>
      </div>

      {/* Search Bar */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20
      }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#52525b" }} />
            <input
              className="input-dark"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="키워드 검색 (예: cooking tutorial, travel vlog...)"
              style={{ paddingLeft: 44 }}
            />
          </div>
          <select
            value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)}
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "0 14px", color: "white", fontSize: 14, cursor: "pointer" }}
          >
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button className="btn-primary" onClick={handleSearch}
            style={{ padding: "0 28px", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
            {loading ? <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.4)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <Sparkles size={18} />}
            AI 검색
          </button>
        </div>

        {/* Categories */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <SlidersHorizontal size={14} color="#52525b" />
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setSelectedCat(cat)}
              style={{
                padding: "6px 14px", borderRadius: 100, fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.2s",
                background: selectedCat === cat ? "rgba(239,68,68,0.15)" : "transparent",
                color: selectedCat === cat ? "#f87171" : "#71717a",
                border: selectedCat === cat ? "1px solid rgba(239,68,68,0.3)" : "1px solid transparent"
              }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {searched && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: "#71717a", fontSize: 14 }}>
              <span style={{ color: "white", fontWeight: 700 }}>{filtered.length}개</span> 영상 발굴됨
            </div>
            <select style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", color: "white", fontSize: 13, cursor: "pointer" }}>
              {SORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
            {filtered.map(video => (
              <div key={video.id} className="card" style={{ overflow: "hidden", cursor: "pointer" }}
                onClick={() => setSelectedVideo(selectedVideo === video.id ? null : video.id)}>
                {/* Thumbnail */}
                <div style={{
                  height: 180, background: `linear-gradient(135deg, ${video.thumbnail_color}, ${video.thumbnail_color}99)`,
                  display: "flex", alignItems: "center", justifyContent: "center", position: "relative"
                }}>
                  <div style={{
                    width: 56, height: 56, background: "rgba(0,0,0,0.5)", borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)"
                  }}>
                    <Play size={24} color="white" fill="white" />
                  </div>
                  {/* Duration */}
                  <div style={{
                    position: "absolute", bottom: 10, right: 10,
                    background: "rgba(0,0,0,0.8)", borderRadius: 4, padding: "3px 7px",
                    fontSize: 12, fontWeight: 600, color: "white"
                  }}>{video.duration}</div>
                  {/* Category */}
                  <div style={{ position: "absolute", top: 10, left: 10 }}>
                    <span className="badge badge-blue" style={{ fontSize: 11 }}>{video.category}</span>
                  </div>
                  {/* Subtitle badge */}
                  {video.hasSubtitles && (
                    <div style={{ position: "absolute", top: 10, right: 10 }}>
                      <span className="badge badge-green" style={{ fontSize: 11 }}>
                        <Subtitles size={10} /> 자막 있음
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {video.title}
                  </div>
                  <div style={{ fontSize: 13, color: "#71717a", marginBottom: 12 }}>
                    {video.channel} · 구독자 {video.subs}
                  </div>

                  <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#52525b", marginBottom: 14 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Eye size={13} /> {video.views}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <ThumbsUp size={13} /> {video.likes}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={13} /> {video.publishedAt}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 13 }}>
                      번역 난이도:
                      <span className={`badge badge-${video.difficulty === "쉬움" ? "green" : "orange"}`} style={{ marginLeft: 6, fontSize: 11 }}>
                        {video.difficulty}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#71717a" }}>
                      예상 CPM: <span style={{ color: "#f97316", fontWeight: 700 }}>{video.estimated_cpm}</span>
                    </div>
                  </div>

                  {selectedVideo === video.id && (
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", gap: 8 }}>
                      <a href={`/dashboard/studio?url=${encodeURIComponent("https://youtube.com/watch?v=" + video.id)}`}
                        style={{ flex: 1, textDecoration: "none" }}>
                        <button className="btn-primary" style={{ width: "100%", padding: "10px", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <Subtitles size={15} /> 자막 생성
                        </button>
                      </a>
                      <button className="btn-secondary" style={{ padding: "10px 16px", fontSize: 13 }}>
                        저장
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
