import { BLOCKED_SOURCE_DOMAINS, sanitizeBlockedSources } from "./sources";

const HAIKU = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-20250514";

const PRICE: Record<string, { in: number; out: number }> = {
  [HAIKU]: { in: 0.8, out: 4 },
  [SONNET]: { in: 3, out: 15 },
};
const WEB_SEARCH_USD = 0.01; // $10 / 1,000 검색

const FACTCHECK_SYSTEM = `원고에서 수치/통계, 인명, 날짜, 사건, 기관명을 추출하고 web_search로 검증하십시오.

절대 규칙:
- 모든 출력은 반드시 한국어로 작성. 외국어 원문 그대로 출력 금지. 고유명사만 원어 병기 가능.
- "미확인" 사용 금지. 확인 안 되면 "확인 필요"로 쓸 것.
- 마크다운 표 절대 사용 금지. 목록이나 문단으로 정리.

검색 규칙:
- 가장 중요한 팩트부터 우선 검증.
- 출처 우선순위: 1차 출처(정부·공식기관·통계·논문) > 주요 언론사 > 영어판 위키피디아. 검색어는 영어로 작성하되 결과는 한국어로 번역.
- 다음 출처는 절대 사용 금지: 나무위키(namu.wiki), 네이버 블로그·포스트·카페·지식iN, 다음 카페·블로그, 그 밖의 개인 블로그·위키 미러 사이트.
- 신뢰할 수 있는 출처를 못 찾으면 억지로 인용하지 말고 "확인 필요"로 두고 (출처 없음)이라고 쓸 것.

검증 판단 기준:
- 날짜 비교 시 숫자를 직접 대조. 1939는 1940보다 앞.
- 대략적 표현이 범위 안이면 "확인됨"
- 명백히 다를 때만 "확인 필요"

출처는 마크다운 링크로 포함:

✅ **확인됨** | 유형 | 팩트 요소
한국어 검증 내용 (출처: [제목](URL))

⚠️ **확인 필요** | 유형 | 팩트 요소
한국어 검증 내용 (출처: [제목](URL))`;

const FACTCHECK_FORMAT_SYSTEM = `팩트체크 결과를 정리하십시오.
- 한국어로만 작성. 외국어 원문 출력 금지.
- 마크다운 표 절대 사용 금지. 목록이나 문단으로 정리.
- "미확인" 대신 "확인 필요" 사용.
- 출처 URL은 마크다운 링크로 반드시 유지. 원본의 URL을 절대 삭제하지 마십시오.
- 각 검증 항목 끝에 반드시 (출처: [제목](URL)) 형식으로 출처를 표시하십시오. URL이 없으면 (출처 없음)이라고 쓰십시오.
- 외국어 본문은 한국어로 번역하되, URL 링크는 원본 그대로 유지하십시오.`;

interface CostAccumulator {
  usd: number;
  input_tokens: number;
  output_tokens: number;
}

interface ClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
  server_tool_use?: { web_search_requests?: number };
}

async function callClaude(
  apiKey: string,
  model: string,
  system: string,
  userMessage: string,
  maxTokens: number,
  acc: CostAccumulator,
  tools?: unknown[],
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userMessage }],
  };
  if (tools) body.tools = tools;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (data.error) throw new Error(data.error.message || "Anthropic API 오류");

  const usage: ClaudeUsage = data.usage ?? {};
  const price = PRICE[model] ?? { in: 0, out: 0 };
  const inTok = usage.input_tokens ?? 0;
  const outTok = usage.output_tokens ?? 0;
  acc.input_tokens += inTok;
  acc.output_tokens += outTok;
  acc.usd += (inTok * price.in + outTok * price.out) / 1_000_000;
  acc.usd += (usage.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD;

  return (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
}

async function callClaudeStream(
  apiKey: string,
  model: string,
  system: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
  acc: CostAccumulator,
  onTextDelta: (text: string) => void,
  tools?: unknown[],
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    stream: true,
    system,
    messages,
  };
  if (tools) body.tools = tools;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok || !resp.body) {
    let errText = `Anthropic ${resp.status}`;
    try {
      const j = await resp.json();
      if (j?.error?.message) errText = j.error.message;
    } catch {}
    throw new Error(errText);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let sseBuf = "";
  let full = "";
  let inTok = 0;
  let outTok = 0;
  let webReq = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    sseBuf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = sseBuf.indexOf("\n\n")) !== -1) {
      const rawEvent = sseBuf.slice(0, idx);
      sseBuf = sseBuf.slice(idx + 2);
      const dataLine = rawEvent.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const dataStr = dataLine.slice(5).trim();
      if (!dataStr) continue;
      let p: {
        type?: string;
        delta?: { type?: string; text?: string };
        message?: { usage?: ClaudeUsage };
        usage?: ClaudeUsage;
      };
      try {
        p = JSON.parse(dataStr);
      } catch {
        continue;
      }
      if (p.type === "content_block_delta" && p.delta?.type === "text_delta") {
        const t = p.delta.text || "";
        if (t) {
          full += t;
          onTextDelta(t);
        }
      } else if (p.type === "message_start" && p.message?.usage) {
        inTok = p.message.usage.input_tokens ?? 0;
        outTok = p.message.usage.output_tokens ?? 0;
      } else if (p.type === "message_delta" && p.usage) {
        if (typeof p.usage.output_tokens === "number") outTok = p.usage.output_tokens;
        const w = p.usage.server_tool_use?.web_search_requests;
        if (typeof w === "number") webReq = w;
      }
    }
  }

  const price = PRICE[model] ?? { in: 0, out: 0 };
  acc.input_tokens += inTok;
  acc.output_tokens += outTok;
  acc.usd += (inTok * price.in + outTok * price.out) / 1_000_000;
  acc.usd += webReq * WEB_SEARCH_USD;

  return full;
}

const webSearchTool = (maxUses: number) => [
  {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: maxUses,
    blocked_domains: BLOCKED_SOURCE_DOMAINS,
  },
];

export interface FactcheckResult {
  markdown: string;
  retried: boolean;
  cost: { input_tokens: number; output_tokens: number; cost_usd: number; cost_krw: number };
}

export interface StreamHandlers {
  onStatus: (text: string) => void;
  onDelta: (text: string) => void;
}

export async function runFactcheckStream(
  text: string,
  title: string,
  h: StreamHandlers,
): Promise<FactcheckResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY 미설정");

  const heading = title.trim() || "원고 팩트 검증 결과";
  const acc: CostAccumulator = { usd: 0, input_tokens: 0, output_tokens: 0 };

  // 1단계: 팩트 추출 + 웹 검색 검증 (Haiku)
  h.onStatus("웹에서 사실 확인 중…");
  const raw = await callClaude(
    apiKey,
    HAIKU,
    FACTCHECK_SYSTEM,
    `다음 원고의 팩트 요소를 추출하고 웹 검색으로 검증해주십시오:\n\n${text}`,
    8000,
    acc,
    webSearchTool(3),
  );

  // 2단계: 결과 정리 (Sonnet, 스트리밍)
  h.onStatus("결과 정리 중…");
  let markdown = await callClaudeStream(
    apiKey,
    SONNET,
    FACTCHECK_FORMAT_SYSTEM,
    [{ role: "user", content: `"## ${heading}"를 제목으로 다음 팩트체크 결과를 정리해주십시오:\n\n${raw}` }],
    8000,
    acc,
    h.onDelta,
  );

  // 3단계: "확인 필요" 항목 1회 추가 검증
  let retried = false;
  const unverified = markdown
    .split(/\r?\n/)
    .filter((l) => l.includes("확인 필요"))
    .join("\n");

  if (unverified.trim()) {
    h.onStatus("'확인 필요' 항목 추가 검증 중…");
    const retryRaw = await callClaude(
      apiKey,
      HAIKU,
      FACTCHECK_SYSTEM,
      `아래 팩트 요소만 집중 검증하십시오.\n\n검증 대상:\n${unverified}\n\n원고:\n${text}`,
      4000,
      acc,
      webSearchTool(5),
    );
    h.onStatus("추가 검증 결과 정리 중…");
    h.onDelta("\n\n");
    const retryFmt = await callClaudeStream(
      apiKey,
      SONNET,
      FACTCHECK_FORMAT_SYSTEM,
      [{ role: "user", content: `"## 추가 검증 결과"를 제목으로 다음 팩트체크 결과를 정리해주십시오:\n\n${retryRaw}` }],
      8000,
      acc,
      h.onDelta,
    );
    markdown = `${markdown}\n\n${retryFmt}`;
    retried = true;
  }

  return {
    markdown: sanitizeBlockedSources(markdown),
    retried,
    cost: {
      input_tokens: acc.input_tokens,
      output_tokens: acc.output_tokens,
      cost_usd: +acc.usd.toFixed(4),
      cost_krw: Math.round(acc.usd * 1400),
    },
  };
}

const CHAT_SYSTEM = `당신은 원고 팩트체크를 돕는 대화형 어시스턴트입니다. 아래에 원본 원고와 1차 팩트체크 결과가 주어집니다. 사용자가 추가로 묻는 사실·주장에 대해 web_search로 검증하고 답하십시오.

절대 규칙:
- 모든 출력은 반드시 한국어로 작성. 외국어 원문 그대로 출력 금지. 고유명사만 원어 병기 가능.
- "미확인" 사용 금지. 확인 안 되면 "확인 필요"로 쓸 것.
- 마크다운 표 절대 사용 금지. 목록이나 문단으로 정리.

검색·출처 규칙:
- 새로운 사실 주장은 web_search로 검증. 검색어는 영어로 작성하되 결과는 한국어로 번역.
- 출처 우선순위: 1차 출처(정부·공식기관·통계·논문) > 주요 언론사 > 영어판 위키피디아.
- 다음 출처는 절대 사용 금지: 나무위키(namu.wiki), 네이버 블로그·포스트·카페·지식iN, 다음 카페·블로그, 그 밖의 개인 블로그·위키 미러 사이트.
- 사실 검증 항목 끝에는 반드시 (출처: [제목](URL)) 형식으로 출처를 표시. 신뢰할 출처가 없으면 (출처 없음)이라고 쓸 것.
- 검증이 아닌 일반 안내·요약은 출처 없이 간결하게 답해도 됨.

판단 기준:
- 날짜·수치는 직접 대조. 대략적 표현이 범위 안이면 "확인됨", 명백히 다를 때만 "확인 필요".`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  markdown: string;
  cost: { input_tokens: number; output_tokens: number; cost_usd: number; cost_krw: number };
}

export async function runFactcheckChatStream(
  originalText: string,
  resultMarkdown: string,
  messages: ChatMessage[],
  onDelta: (text: string) => void,
): Promise<ChatResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY 미설정");

  const acc: CostAccumulator = { usd: 0, input_tokens: 0, output_tokens: 0 };
  const contextBlock = `${
    originalText.trim() ? `[원본 원고]\n${originalText.trim()}\n\n` : ""
  }[1차 팩트체크 결과]\n${resultMarkdown.trim()}`;
  const system = `${CHAT_SYSTEM}\n\n${contextBlock}`;

  const reply = await callClaudeStream(
    apiKey,
    HAIKU,
    system,
    messages.map((m) => ({ role: m.role, content: m.content })),
    4000,
    acc,
    onDelta,
    webSearchTool(3),
  );

  return {
    markdown: sanitizeBlockedSources(reply),
    cost: {
      input_tokens: acc.input_tokens,
      output_tokens: acc.output_tokens,
      cost_usd: +acc.usd.toFixed(4),
      cost_krw: Math.round(acc.usd * 1400),
    },
  };
}

const SYNTHESIS_SYSTEM = `1차 팩트체크 결과와 이후 대화로 추가 검증한 내용을 하나의 완성된 최종 보고서로 종합하십시오. 새로 웹 검색을 하지 말고, 주어진 내용만으로 정리·통합하십시오.

절대 규칙:
- 모든 출력은 반드시 한국어로 작성. 외국어 원문 그대로 출력 금지.
- 마크다운 표 절대 사용 금지. 목록이나 문단으로 정리.
- "미확인" 사용 금지. "확인 필요" 사용.
- 모든 출처 링크(마크다운 [제목](URL))는 절대 삭제하지 말고 그대로 유지. 각 검증 항목 끝에 (출처: [제목](URL)) 형식 유지, 출처가 없으면 (출처 없음).

종합 규칙:
- 1차 결과와 대화에서 같은 사실이 중복되면 더 정확하고 최신인 내용으로 통합하고 중복은 제거.
- 대화에서 새로 확인된 사실은 보고서의 알맞은 위치에 자연스럽게 통합.
- 대화 중 1차 결과의 판정이 바뀐 부분이 있으면 최종 판정으로 갱신.
- 맨 위 제목(## ...)은 유지하거나 자연스럽게 다듬되, 전체는 하나의 정돈된 보고서 형태로.`;

export async function runSynthesisStream(
  originalText: string,
  resultMarkdown: string,
  messages: ChatMessage[],
  onDelta: (text: string) => void,
): Promise<ChatResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY 미설정");

  const acc: CostAccumulator = { usd: 0, input_tokens: 0, output_tokens: 0 };
  const convo = messages
    .map((m) => `${m.role === "user" ? "질문" : "답변"}: ${m.content}`)
    .join("\n\n");
  const userMsg = `${
    originalText.trim() ? `[원본 원고]\n${originalText.trim()}\n\n` : ""
  }[1차 팩트체크 결과]\n${resultMarkdown.trim()}\n\n[추가 대화 검증]\n${convo}\n\n위 내용을 하나의 완성된 최종 보고서로 종합해주십시오.`;

  const md = await callClaudeStream(
    apiKey,
    HAIKU,
    SYNTHESIS_SYSTEM,
    [{ role: "user", content: userMsg }],
    8000,
    acc,
    onDelta,
  );

  return {
    markdown: sanitizeBlockedSources(md),
    cost: {
      input_tokens: acc.input_tokens,
      output_tokens: acc.output_tokens,
      cost_usd: +acc.usd.toFixed(4),
      cost_krw: Math.round(acc.usd * 1400),
    },
  };
}
