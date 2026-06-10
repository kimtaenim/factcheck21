"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { FactChat } from "@/components/FactChat";
import { FactMarkdown } from "@/components/FactMarkdown";
import { Card } from "@/components/ui/Card";
import type { FactcheckRecord } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ResultPage({ params }: PageProps) {
  const { id } = use(params);
  const [record, setRecord] = useState<FactcheckRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    setShareUrl(window.location.href);
    let active = true;
    (async () => {
      const res = await fetch(`/api/factcheck/${id}`, { cache: "no-store" });
      if (!active) return;
      if (res.status === 404) {
        setError("결과를 찾을 수 없습니다. 만료되었거나 삭제되었을 수 있습니다.");
        return;
      }
      if (!res.ok) {
        setError("결과를 불러오지 못했습니다.");
        return;
      }
      setRecord((await res.json()) as FactcheckRecord);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] text-zinc-600 ring-1 ring-zinc-200 transition hover:text-zinc-900 hover:ring-zinc-300"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            새 팩트체크
          </Link>
          <div className="text-right text-[11px] tabular-nums text-zinc-500">
            {record ? `${record.dateKst} ${record.timeKst} (KST)` : ""}
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-dvh max-w-2xl px-5 pb-32 pt-6 sm:px-6 sm:pt-10">
        {error && (
          <Card padding="md" className="text-[14px] text-red-600">
            {error}
          </Card>
        )}

        {!record && !error && (
          <p className="mt-10 text-center text-[13px] text-zinc-400">불러오는 중…</p>
        )}

        {record && (
          <>
            <div className="mb-6">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                FACTCHECK
              </p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-zinc-900 sm:text-[26px]">
                {record.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-zinc-500">
                <span>{record.dateKst} {record.timeKst} (KST)</span>
                {record.retried && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                    추가 검증 포함
                  </span>
                )}
                {record.synthesized && (
                  <span className="rounded-full bg-mint-50 px-2 py-0.5 text-[11px] text-mint-700 ring-1 ring-mint-100">
                    대화 종합본
                  </span>
                )}
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
                  ₩{record.cost.cost_krw.toLocaleString()}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <CopyButton text={shareUrl} label="링크 복사" copiedLabel="링크 복사됨" size="md" />
                <CopyButton text={record.markdown} label="본문 복사" size="md" />
              </div>
            </div>

            <Card padding="lg">
              <FactMarkdown markdown={record.markdown} />
            </Card>

            <section className="mt-8">
              <FactChat
                factId={record.id}
                baseMarkdown={record.markdown}
                onSynthesized={(md, cost) =>
                  setRecord((prev) =>
                    prev ? { ...prev, markdown: md, cost, synthesized: true } : prev,
                  )
                }
              />
            </section>
          </>
        )}
      </main>
    </>
  );
}
