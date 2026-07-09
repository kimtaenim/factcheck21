"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { FactChat } from "@/components/FactChat";
import { FactMarkdown } from "@/components/FactMarkdown";
import { ShareButton } from "@/components/ShareButton";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { FactcheckCost, RecentSummary } from "@/lib/types";

const DRAFT_KEY = "factcheck:draft";

interface DoneResult {
  id: string;
  title: string;
  markdown: string;
  retried: boolean;
  cost: FactcheckCost;
}

export default function HomePage() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [live, setLive] = useState("");
  const [result, setResult] = useState<DoneResult | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentSummary[]>([]);
  const [fxRate, setFxRate] = useState<number | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  // 대화형 추가 팩트체크 (FactChat 컴포넌트로 분리)
  const [ranText, setRanText] = useState("");
  const [synthesized, setSynthesized] = useState(false);

  const refreshRecent = useCallback(async () => {
    const res = await fetch("/api/recent", { cache: "no-store" });
    const data = (await res.json()) as { items: RecentSummary[] };
    setRecent(data.items ?? []);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { title?: string; text?: string };
        if (typeof parsed.title === "string") setTitle(parsed.title);
        if (typeof parsed.text === "string") setText(parsed.text);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, text }));
  }, [hydrated, title, text]);

  useEffect(() => {
    refreshRecent();
  }, [refreshRecent]);

  useEffect(() => {
    fetch("/api/fx", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.rate === "number") setFxRate(d.rate);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (running && liveRef.current) {
      liveRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [live, running]);

  const run = async () => {
    if (!text.trim() || running) return;
    setRunning(true);
    setError(null);
    setStatus("시작하는 중…");
    setLive("");
    setResult(null);
    setShareUrl("");
    setSaved(false);
    setRanText(text.trim());
    setSynthesized(false);
    try {
      const res = await fetch("/api/factcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), title: title.trim() || undefined }),
      });
      if (!res.ok || !res.body) {
        let msg = "팩트체크에 실패했습니다.";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        setError(msg);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buf = "";
      let acc = "";

      const handle = (obj: Record<string, unknown>) => {
        switch (obj.type) {
          case "status":
            setStatus(String(obj.text ?? ""));
            break;
          case "delta":
            acc += String(obj.text ?? "");
            setLive(acc);
            break;
          case "error":
            setError(String(obj.error ?? "오류가 발생했습니다."));
            break;
          case "done":
            setResult({
              id: String(obj.id),
              title: String(obj.title),
              markdown: String(obj.markdown),
              retried: Boolean(obj.retried),
              cost: obj.cost as FactcheckCost,
            });
            setShareUrl(`${window.location.origin}/result/${obj.id}`);
            refreshRecent();
            break;
        }
      };

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
            handle(JSON.parse(line));
          } catch {}
        }
      }
      if (buf.trim()) {
        try {
          handle(JSON.parse(buf.trim()));
        } catch {}
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
    } finally {
      setRunning(false);
      setStatus("");
    }
  };

  const onSave = async () => {
    if (!result || saving || saved) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/factcheck/${result.id}/save`, { method: "POST" });
      if (res.ok) {
        setSaved(true);
        refreshRecent();
      }
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    const before = recent;
    setRecent((prev) => prev.filter((x) => x.id !== id));
    const res = await fetch(`/api/factcheck/${id}`, { method: "DELETE" });
    if (!res.ok) setRecent(before);
  };

  const showPanel = running || !!result;

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3 sm:px-6">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-mint-600">
              FACTCHECK
            </p>
            <h1 className="text-[15px] font-semibold tracking-tight text-zinc-900">
              팩트체크 에이전트
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-dvh max-w-2xl px-5 pb-32 pt-6 sm:px-6 sm:pt-10">
        <p className="mb-7 text-[13px] leading-relaxed text-zinc-500 sm:text-[14px]">
          원고를 붙여넣으면 수치·인명·날짜·사건을 추출해 웹 검색으로 검증하고,
          결과를 공유 가능한 페이지로 만들어 링크를 드립니다.
        </p>

        <section className="mb-5">
          <Card padding="md">
            <label htmlFor="title" className="mb-2 block text-[12px] font-medium uppercase tracking-wider text-zinc-500">
              제목 (선택)
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: OO 기사 팩트 검증"
            />
            <label htmlFor="text" className="mb-2 mt-5 block text-[12px] font-medium uppercase tracking-wider text-zinc-500">
              원고
            </label>
            <Textarea
              id="text"
              rows={12}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="검증할 원고를 붙여넣으세요."
            />
            <p className="mt-2 text-[11px] text-zinc-400">
              {text.length.toLocaleString()}자
            </p>
          </Card>
        </section>

        <section className="mb-6">
          <button
            type="button"
            onClick={run}
            disabled={!text.trim() || running}
            className="w-full rounded-3xl bg-mint-400 px-6 py-5 text-[16px] font-medium text-white shadow-soft transition active:scale-[0.99] disabled:opacity-50 sm:text-[17px]"
          >
            {running ? "검증 중…" : "팩트체크 실행"}
          </button>
          {error && (
            <p className="mt-3 text-center text-[13px] text-red-600">{error}</p>
          )}
          <p className="mt-3 text-center text-[11px] text-zinc-400">
            웹 검색 + Haiku/Sonnet 호출. 환율 1 USD = ₩
            {(fxRate ?? 1400).toLocaleString()} 기준 비용 표시. (매일 갱신)
          </p>
        </section>

        {showPanel && (
          <section ref={liveRef} className="mb-10">
            <Card padding="lg">
              {running && (
                <p className="mb-4 flex items-center gap-2 text-[13px] font-medium text-mint-700">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-mint-500" />
                  {status || "처리 중…"}
                </p>
              )}

              {result ? (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    {result.retried && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                        추가 검증 포함
                      </span>
                    )}
                    {synthesized && (
                      <span className="rounded-full bg-mint-50 px-2 py-0.5 text-[11px] text-mint-700 ring-1 ring-mint-100">
                        대화 종합본
                      </span>
                    )}
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
                      ₩{result.cost.cost_krw.toLocaleString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={saving || saved}
                    className={
                      saved
                        ? "mb-3 w-full rounded-2xl bg-mint-50 px-6 py-4 text-[15px] font-semibold text-mint-700 ring-1 ring-mint-200"
                        : "mb-3 w-full rounded-2xl bg-mint-400 px-6 py-4 text-[15px] font-semibold text-white shadow-soft transition active:scale-[0.99] disabled:opacity-60"
                    }
                  >
                    {saved ? "✓ 저장됨 — 홈 목록에 남았습니다" : saving ? "저장 중…" : "★ 이 결과 저장하기"}
                  </button>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <ShareButton url={shareUrl} title={result.title} size="md" />
                    <CopyButton text={shareUrl} label="링크 복사" copiedLabel="링크 복사됨" size="md" />
                    <CopyButton text={result.markdown} label="본문 복사" size="md" />
                    <Link
                      href={`/result/${result.id}`}
                      className="inline-flex items-center gap-1.5 rounded-2xl bg-zinc-50 px-4 py-2 text-[13px] font-medium text-zinc-600 ring-1 ring-zinc-200 transition hover:text-zinc-900 hover:ring-zinc-300"
                    >
                      발행 페이지 열기
                    </Link>
                  </div>
                  <p className="mb-5 text-[11px] text-zinc-400">
                    {saved
                      ? "홈 ‘최근 결과’ 목록에 저장되었습니다."
                      : "‘저장하기’를 눌러야 홈 ‘최근 결과’ 목록에 남습니다. 공유는 저장과 상관없이 언제든 가능합니다."}
                  </p>
                  <FactMarkdown markdown={result.markdown} />
                </>
              ) : (
                live && <FactMarkdown markdown={live} />
              )}
            </Card>
          </section>
        )}

        {result && (
          <section className="mb-10">
            <FactChat
              key={result.id}
              factId={result.id}
              baseMarkdown={result.markdown}
              originalText={ranText}
              onSynthesized={(md, cost) => {
                setResult((prev) => (prev ? { ...prev, markdown: md, cost } : prev));
                setSynthesized(true);
                setSaved(false);
              }}
            />
          </section>
        )}

        <section>
          <h2 className="mb-3 px-1 text-[12px] font-medium uppercase tracking-wider text-zinc-500">
            최근 결과
          </h2>
          {recent.length === 0 ? (
            <p className="px-1 text-[13px] text-zinc-400">아직 결과가 없습니다.</p>
          ) : (
            <ul className="space-y-2.5">
              {recent.map((r) => (
                <li key={r.id}>
                  <Card padding="sm" className="flex items-start justify-between gap-3">
                    <Link href={`/result/${r.id}`} className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-zinc-900">{r.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-zinc-500">{r.preview}</p>
                      <p className="mt-1 text-[11px] tabular-nums text-zinc-400">
                        {r.dateKst} · ₩{r.costKrw.toLocaleString()}
                      </p>
                    </Link>
                    <button
                      type="button"
                      onClick={() => onDelete(r.id)}
                      className="shrink-0 rounded-full px-2 py-1 text-[12px] text-zinc-400 transition hover:text-red-600"
                      aria-label="삭제"
                    >
                      삭제
                    </button>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
