// 팩트체크 출처 허용 목록. web_search는 이 도메인에서만 검색하고(allowed_domains),
// 렌더 단계에서도 여기(및 공공·학술 도메인 접미사)에 없는 링크는 출처로 인정하지 않는다.
// 하위 도메인은 자동 포함. 특정 하위 도메인을 적으면 그 하위 도메인만 허용.
export const TRUSTED_SOURCE_DOMAINS = [
  // 위키피디아는 영어판만
  "en.wikipedia.org",
  // 백과사전·학술 데이터베이스·학술 출판
  "britannica.com",
  "oxfordreference.com",
  "encykorea.aks.ac.kr",
  "doi.org",
  "jstor.org",
  "muse.jhu.edu",
  "cambridge.org",
  "academic.oup.com",
  "link.springer.com",
  "sciencedirect.com",
  "tandfonline.com",
  "onlinelibrary.wiley.com",
  "journals.sagepub.com",
  "degruyter.com",
  "brill.com",
  "nature.com",
  "science.org",
  "pnas.org",
  "ncbi.nlm.nih.gov",
  "arxiv.org",
  "ssrn.com",
  "dbpia.co.kr",
  "kci.go.kr",
  "riss.kr",
  // 정부·공공기관 (국내)
  "go.kr",
  "mil.kr",
  "korea.kr",
  "kosis.kr",
  "bok.or.kr",
  "kdi.re.kr",
  "kida.re.kr",
  // 정부·공공기관 (해외)
  "gov.uk",
  "parliament.uk",
  "go.jp",
  "europa.eu",
  "loc.gov",
  "archives.gov",
  "state.gov",
  "defense.gov",
  "congress.gov",
  "census.gov",
  "bls.gov",
  "cia.gov",
  "history.army.mil",
  "history.navy.mil",
  "af.mil",
  // 국제기구·연구소·박물관
  "un.org",
  "who.int",
  "nato.int",
  "icrc.org",
  "worldbank.org",
  "imf.org",
  "oecd.org",
  "sipri.org",
  "iiss.org",
  "rand.org",
  "brookings.edu",
  "cfr.org",
  "csis.org",
  "wilsoncenter.org",
  "ushmm.org",
  "iwm.org.uk",
  "si.edu",
  "smithsonianmag.com",
  // 대학
  "harvard.edu",
  "stanford.edu",
  "yale.edu",
  "ox.ac.uk",
  "cam.ac.uk",
  "snu.ac.kr",
  "korea.ac.kr",
  "yonsei.ac.kr",
  "aks.ac.kr",
  // 통신사·주요 언론 (해외)
  "reuters.com",
  "apnews.com",
  "afp.com",
  "bbc.com",
  "bbc.co.uk",
  "nytimes.com",
  "washingtonpost.com",
  "wsj.com",
  "ft.com",
  "economist.com",
  "theguardian.com",
  "bloomberg.com",
  "npr.org",
  "aljazeera.com",
  "nikkei.com",
  "lemonde.fr",
  "spiegel.de",
  // 통신사·주요 언론 (국내)
  "yna.co.kr",
  "news.naver.com",
  "n.news.naver.com",
  "v.daum.net",
  "news.kbs.co.kr",
  "imnews.imbc.com",
  "news.sbs.co.kr",
  "ytn.co.kr",
  "chosun.com",
  "joongang.co.kr",
  "www.donga.com",
  "hani.co.kr",
  "khan.co.kr",
  "hankookilbo.com",
  "sisain.co.kr",
  "mk.co.kr",
  "hankyung.com",
];

// 허용 목록 검색이 API에서 거부될 때 단계적으로 쓰는 대체 목록.
// 1) 공공 접미사(go.kr 등)만 빼고 재시도 2) 그래도 안 되면 차단 목록으로 검색.
const SUFFIX_ONLY = new Set(["go.kr", "mil.kr", "gov.uk", "go.jp"]);
export const TRUSTED_SOURCE_DOMAINS_STRICT = TRUSTED_SOURCE_DOMAINS.filter(
  (d) => !SUFFIX_ONLY.has(d),
);

// 렌더 단계에서 추가로 인정하는 공공·학술 도메인 접미사.
const TRUSTED_SUFFIXES = [
  "gov", "mil", "edu", "int",
  "go.kr", "mil.kr", "ac.kr", "re.kr",
  "gov.uk", "ac.uk", "go.jp", "ac.jp",
];

// 허용 목록 안이라도 절대 쓰면 안 되는 도메인(허용 목록 검색이 거부될 때의 대체 검색 차단 목록 겸용).
// 하위 도메인은 자동 포함 (예: blog.naver.com → m.blog.naver.com 도 차단).
export const BLOCKED_SOURCE_DOMAINS = [
  // 나무위키 및 미러·파생 위키
  "namu.wiki",
  "namu.moe",
  "namu.mirror.wiki",
  "theseed.io",
  "rigvedawiki.net",
  "librewiki.net",
  "alphawiki.org",
  "wikiwand.com",
  // 팬덤·밀덕 위키 및 취미 사이트
  "fandom.com",
  "wikia.com",
  "wikia.org",
  "militaryfactory.com",
  "military-today.com",
  "warhistoryonline.com",
  "weaponsandwarfare.com",
  "milpedia.org",
  // 블로그·카페·Q&A
  "blog.naver.com",
  "post.naver.com",
  "cafe.naver.com",
  "kin.naver.com",
  "cafe.daum.net",
  "blog.daum.net",
  "tistory.com",
  "brunch.co.kr",
  "velog.io",
  "medium.com",
  "quora.com",
  // 커뮤니티
  "reddit.com",
  "dcinside.com",
  "fmkorea.com",
  "theqoo.net",
  "ruliweb.com",
  "clien.net",
  "arca.live",
  "mlbpark.donga.com",
  "ppomppu.co.kr",
  "instiz.net",
];

function hostOf(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const matches = (host: string, d: string) => host === d || host.endsWith("." + d);

export function isBlockedSourceUrl(rawUrl: string): boolean {
  const host = hostOf(rawUrl);
  if (!host) return false;
  return BLOCKED_SOURCE_DOMAINS.some((d) => matches(host, d));
}

export function isTrustedSourceUrl(rawUrl: string): boolean {
  const host = hostOf(rawUrl);
  if (!host || isBlockedSourceUrl(rawUrl)) return false;
  return (
    TRUSTED_SOURCE_DOMAINS.some((d) => matches(host, d)) ||
    TRUSTED_SUFFIXES.some((d) => matches(host, d))
  );
}

// 마크다운 URL 매처: 위키피디아처럼 괄호가 포함된 URL도 한 단계까지 허용.
const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+(?:\([^\s)]*\)[^\s)]*)*)\)/g;
const BARE_URL = /https?:\/\/[^\s<>")]+(?:\([^\s)]*\)[^\s)]*)*/g;

// 최종 안전망: 허용 목록 밖의 출처가 결과에 새어 나오면 클릭 링크를 제거한다.
// 마크다운 링크는 텍스트만 남기고, 맨몸 URL은 삭제.
export function sanitizeBlockedSources(markdown: string): string {
  let out = markdown.replace(MD_LINK, (full, text: string, url: string) =>
    isTrustedSourceUrl(url) ? full : text,
  );
  out = out.replace(BARE_URL, (url) => (isTrustedSourceUrl(url) ? url : ""));
  // 링크 없는 출처 표기("출처: 영문 위키백과 및 학술 기관 등")는 출처로 인정하지 않는다.
  out = out.replace(/\(출처:\s*(?:[^()]|\([^()]*\))*\)/g, (full) =>
    /https?:\/\//.test(full) ? full : "(출처 없음)",
  );
  return out;
}
