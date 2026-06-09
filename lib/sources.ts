// 팩트체크 출처로 쓰면 안 되는 도메인. web_search 차단 + 렌더 단계 필터 양쪽에서 사용.
// 하위 도메인은 자동 포함 (예: blog.naver.com → m.blog.naver.com 도 차단).
export const BLOCKED_SOURCE_DOMAINS = [
  "namu.wiki",
  "blog.naver.com",
  "post.naver.com",
  "cafe.naver.com",
  "kin.naver.com",
  "cafe.daum.net",
  "blog.daum.net",
];

export function isBlockedSourceUrl(rawUrl: string): boolean {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  return BLOCKED_SOURCE_DOMAINS.some((d) => host === d || host.endsWith("." + d));
}

// 마크다운 URL 매처: 위키피디아처럼 괄호가 포함된 URL도 한 단계까지 허용.
const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+(?:\([^\s)]*\)[^\s)]*)*)\)/g;
const BARE_URL = /https?:\/\/[^\s<>")]+(?:\([^\s)]*\)[^\s)]*)*/g;

// 최종 안전망: 차단 도메인이 결과에 새어 나오면 클릭 링크를 제거한다.
// 마크다운 링크는 텍스트만 남기고, 맨몸 URL은 삭제.
export function sanitizeBlockedSources(markdown: string): string {
  let out = markdown.replace(MD_LINK, (full, text: string, url: string) =>
    isBlockedSourceUrl(url) ? text : full,
  );
  out = out.replace(BARE_URL, (url) => (isBlockedSourceUrl(url) ? "" : url));
  return out;
}
