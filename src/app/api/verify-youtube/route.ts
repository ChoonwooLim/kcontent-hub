import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { apiKey } = await req.json();

  if (!apiKey || !apiKey.startsWith("AIza")) {
    return NextResponse.json({ valid: false, error: "유효하지 않은 키 형식입니다. 'AIza'로 시작해야 합니다." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=korea&maxResults=1&key=${apiKey}`
    );

    if (res.status === 400) {
      const data = await res.json();
      return NextResponse.json({ valid: false, error: `API 오류: ${data.error?.message ?? "잘못된 요청"}` });
    }
    if (res.status === 403) {
      const data = await res.json();
      const reason = data.error?.errors?.[0]?.reason ?? "forbidden";
      if (reason === "accessNotConfigured") {
        return NextResponse.json({ valid: false, error: "YouTube Data API v3가 활성화되지 않았습니다. Google Cloud Console에서 API를 활성화해주세요." });
      }
      if (reason === "keyInvalid") {
        return NextResponse.json({ valid: false, error: "API 키가 유효하지 않습니다." });
      }
      return NextResponse.json({ valid: false, error: `접근 거부 (${reason}): API 키 제한 설정을 확인해주세요.` });
    }
    if (!res.ok) {
      return NextResponse.json({ valid: false, error: `YouTube API 오류 (${res.status})` });
    }

    const data = await res.json();
    return NextResponse.json({
      valid: true,
      message: "YouTube Data API v3 키 유효",
      resultCount: data.items?.length ?? 0,
      quota: "일일 한도 10,000 유닛",
    });
  } catch {
    return NextResponse.json({ valid: false, error: "네트워크 오류: YouTube API 서버에 연결할 수 없습니다." }, { status: 500 });
  }
}
