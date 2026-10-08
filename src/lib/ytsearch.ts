import { spawn } from "child_process";
import { resolveYtDlp } from "@/lib/ytdlp";

/**
 * yt-dlp 기반 YouTube 검색 (Data API 쿼터 0)
 *
 * YouTube Data API 의 search.list 는 1회 100 units 라 일일 10,000 units 가 금방 바닥난다.
 * 검색 자체는 yt-dlp 의 검색 URL 추출(`/results?search_query=…&sp=…`)로 영상 ID 만 얻고,
 * 통계·언어 메타데이터는 videos.list / channels.list (각 1 unit) 로만 조회한다.
 *
 * sp 필터(업로드 기간): 이번 주 EgIIAw==, 이번 달 EgIIBA==, 올해 EgIIBQ==
 */
export type YtSearchHit = { id: string; title: string; channel: string | null; channelId: string | null };

function spFilter(dayCap: number): string {
  if (dayCap <= 0) return "";
  if (dayCap <= 7) return "EgIIAw%3D%3D";
  if (dayCap <= 31) return "EgIIBA%3D%3D";
  if (dayCap <= 366) return "EgIIBQ%3D%3D";
  return "";
}

export async function ytDlpSearch(keyword: string, dayCap: number, limit = 30, timeoutMs = 60_000): Promise<YtSearchHit[]> {
  const yt = await resolveYtDlp();
  const sp = spFilter(dayCap);
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}${sp ? `&sp=${sp}` : ""}`;

  const json = await new Promise<string>((resolve, reject) => {
    const proc = spawn(yt.cmd, [
      ...yt.baseArgs,
      "--flat-playlist", "--dump-single-json",
      "--no-warnings", "--no-check-certificates",
      "--playlist-end", String(limit),
      url,
    ]);
    let out = "", err = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { err += d.toString(); if (err.length > 8000) err = err.slice(-4000); });
    const timer = setTimeout(() => { proc.kill(); reject(new Error("yt-dlp 검색 시간 초과")); }, timeoutMs);
    proc.on("close", code => {
      clearTimeout(timer);
      if (code === 0 && out.trim()) resolve(out);
      else reject(new Error(`yt-dlp 검색 실패 (코드 ${code}): ${err.trim().split("\n").slice(-2).join(" | ").slice(-300)}`));
    });
    proc.on("error", e => { clearTimeout(timer); reject(e); });
  });

  const data = JSON.parse(json) as { entries?: { id?: string; title?: string; channel?: string; uploader?: string; channel_id?: string; uploader_id?: string }[] };
  const hits: YtSearchHit[] = [];
  for (const e of data.entries ?? []) {
    if (!e?.id || !/^[\w-]{11}$/.test(e.id)) continue;
    hits.push({ id: e.id, title: e.title ?? "", channel: e.channel ?? e.uploader ?? null, channelId: e.channel_id ?? e.uploader_id ?? null });
  }
  return hits;
}
