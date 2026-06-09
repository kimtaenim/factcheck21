"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { RecentSummary } from "@/lib/types";

const DRAFT_KEY = "factcheck:draft";

export default function HomePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentSummary[]>([]);

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

  const run = async () => {
    if (!text.trim() || running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/factcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), title: title.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "팩트체크에 실패했습니다.");
        setRunning(false);
        return;
      }
      router.push(`/result/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
      setRunning(false);
    }
  };

  const onDelete = async (id: string) => {
    const before = recent;
    setRecent((prev) => prev.filter((x) => x.id !== id));
    const res = await fetch(`/api/factcheck/${id}`, { method: "DELETE" });
    if (!res.ok) setRecent(before);
  };

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3 sm:px-6">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-400">
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

        <section className="mb-10">
          <button
            type="button"
            onClick={run}
            disabled={!text.trim() || running}
            className="w-full rounded-3xl bg-blue-600 px-6 py-5 text-[16px] font-medium text-white shadow-soft transition active:scale-[0.99] disabled:opacity-50 sm:text-[17px]"
          >
            {running ? "검증 중… (웹 검색 포함, 1~2분 소요)" : "팩트체크 실행"}
          </button>
          {error && (
            <p className="mt-3 text-center text-[13px] text-red-600">{error}</p>
          )}
          <p className="mt-3 text-center text-[11px] text-zinc-400">
            웹 검색 + Haiku/Sonnet 호출. 환율 1 USD = ₩1,400 기준 비용 표시.
          </p>
        </section>

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
