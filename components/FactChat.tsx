"use client";

import { useEffect, useRef, useState } from "react";
import { FactMarkdown } from "@/components/FactMarkdown";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { FactcheckCost } from "@/lib/types";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  /** 저장된 결과 레코드 id (종합 시 이 레코드를 갱신) */
  factId: string;
  /** 현재 결과 마크다운 — 대화 맥락으로 사용 (종합 후 부모가 갱신해 내려줌) */
  baseMarkdown: string;
  /** 원본 원고 (홈에서만 전달, 결과 페이지에는 없음) */
  originalText?: string;
  /** 종합 완료 시 부모가 결과/배지를 갱신하도록 콜백 */
  onSynthesized?: (markdown: string, cost: FactcheckCost) => void;
}

async function readStream(
  res: Response,
  onEvent: (obj: Record<string, unknown>) => void,
) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        onEvent(JSON.parse(line));
      } catch {}
    }
  }
  if (buf.trim()) {
    try {
      onEvent(JSON.parse(buf.trim()));
    } catch {}
  }
}

export function FactChat({ factId, baseMarkdown, originalText, onSynthesized }: Props) {
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatRunning, setChatRunning] = useState(false);
  const [chatLive, setChatLive] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatCostKrw, setChatCostKrw] = useState(0);
  const [syncedCount, setSyncedCount] = useState(0);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthLive, setSynthLive] = useState("");
  const [synthError, setSynthError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((chatRunning || chat.length) && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [chat, chatLive, chatRunning]);

  const sendChat = async () => {
    const q = chatInput.trim();
    if (!q || chatRunning || synthesizing) return;
    const prevChat = chat;
    const next: ChatTurn[] = [...chat, { role: "user", content: q }];
    setChat(next);
    setChatInput("");
    setChatRunning(true);
    setChatError(null);
    setChatLive("");

    const fail = (msg: string) => {
      setChat(prevChat);
      setChatInput(q);
      setChatError(msg);
    };

    try {
      const res = await fetch("/api/factcheck/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: originalText || undefined,
          markdown: baseMarkdown,
          messages: next,
        }),
      });
      if (!res.ok || !res.body) {
        let msg = "추가 검증에 실패했습니다.";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        fail(msg);
        return;
      }

      let acc = "";
      let failed = false;
      await readStream(res, (obj) => {
        switch (obj.type) {
          case "delta":
            acc += String(obj.text ?? "");
            setChatLive(acc);
            break;
          case "error":
            failed = true;
            fail(String(obj.error ?? "오류가 발생했습니다."));
            break;
          case "done":
            setChat((prev) => [...prev, { role: "assistant", content: String(obj.markdown ?? acc) }]);
            setChatLive("");
            {
              const c = obj.cost as FactcheckCost | undefined;
              if (c) setChatCostKrw((prev) => prev + (c.cost_krw ?? 0));
            }
            break;
        }
      });
      if (failed) return;
    } catch (err) {
      fail(err instanceof Error ? err.message : "네트워크 오류");
    } finally {
      setChatRunning(false);
    }
  };

  const newTurns = chat.slice(syncedCount);
  const hasNewToSync = newTurns.some((m) => m.role === "assistant");

  const synthesize = async () => {
    if (synthesizing || chatRunning || !hasNewToSync) return;
    setSynthesizing(true);
    setSynthError(null);
    setSynthLive("");
    const atLen = chat.length;
    try {
      const res = await fetch(`/api/factcheck/${factId}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: originalText || undefined, messages: newTurns }),
      });
      if (!res.ok || !res.body) {
        let msg = "종합에 실패했습니다.";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        setSynthError(msg);
        return;
      }

      let acc = "";
      await readStream(res, (obj) => {
        switch (obj.type) {
          case "delta":
            acc += String(obj.text ?? "");
            setSynthLive(acc);
            break;
          case "error":
            setSynthError(String(obj.error ?? "오류가 발생했습니다."));
            break;
          case "done":
            onSynthesized?.(
              String(obj.markdown ?? acc),
              obj.cost as FactcheckCost,
            );
            setSyncedCount(atLen);
            setSynthLive("");
            break;
        }
      });
    } catch (err) {
      setSynthError(err instanceof Error ? err.message : "네트워크 오류");
    } finally {
      setSynthesizing(false);
    }
  };

  return (
    <Card padding="lg">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold text-zinc-900">추가 질문 · 대화형 검증</h2>
        {chatCostKrw > 0 && (
          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
            대화 ₩{chatCostKrw.toLocaleString()}
          </span>
        )}
      </div>

      {chat.length === 0 && !chatRunning && (
        <p className="mb-4 text-[13px] leading-relaxed text-zinc-400">
          결과에 대해 더 묻거나, 다른 사실을 추가로 검증해보세요. 웹 검색으로 확인해 답합니다. 여러 번
          이어서 물어볼 수 있습니다.
        </p>
      )}

      <div className="space-y-4">
        {chat.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-mint-50 px-4 py-2.5 text-[14px] leading-relaxed text-zinc-800 ring-1 ring-mint-100">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="rounded-2xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-100">
              <FactMarkdown markdown={m.content} />
            </div>
          ),
        )}

        {chatRunning && (
          <div className="rounded-2xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-100">
            <p className="mb-2 flex items-center gap-2 text-[12px] font-medium text-mint-700">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-mint-500" />
              검증 중…
            </p>
            {chatLive && <FactMarkdown markdown={chatLive} />}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {hasNewToSync && (
        <div className="mt-4 border-t border-zinc-100 pt-4">
          {synthesizing ? (
            <div className="rounded-2xl bg-mint-50/60 px-4 py-3 ring-1 ring-mint-100">
              <p className="mb-2 flex items-center gap-2 text-[12px] font-medium text-mint-700">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-mint-500" />
                대화 내용을 결과에 종합하는 중…
              </p>
              {synthLive && <FactMarkdown markdown={synthLive} />}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={synthesize}
                disabled={chatRunning}
                className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-[13px] font-medium text-white transition active:scale-[0.99] disabled:opacity-50"
              >
                대화 내용까지 종합해 결과 갱신
              </button>
              <p className="mt-2 text-center text-[11px] text-zinc-400">
                위 결과와 공유 링크가 종합본으로 갱신됩니다. (Haiku)
              </p>
            </>
          )}
          {synthError && <p className="mt-2 text-[13px] text-red-600">{synthError}</p>}
        </div>
      )}

      {chatError && <p className="mt-3 text-[13px] text-red-600">{chatError}</p>}

      <div className="mt-4 flex items-end gap-2">
        <Input
          className="flex-1"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              sendChat();
            }
          }}
          placeholder="추가로 확인할 내용을 입력하세요"
          disabled={chatRunning || synthesizing}
        />
        <button
          type="button"
          onClick={sendChat}
          disabled={!chatInput.trim() || chatRunning || synthesizing}
          className="shrink-0 rounded-2xl bg-mint-400 px-5 py-3 text-[14px] font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          전송
        </button>
      </div>
    </Card>
  );
}
