"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** 공유할 페이지 URL (발행된 결과 페이지 링크) */
  url: string;
  title?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * 공유하기 버튼.
 * - 모바일 등 지원 환경: OS 공유 시트(navigator.share)로 카톡·메시지 등에 바로 전송
 * - 미지원(대부분 데스크톱): 링크 복사로 폴백
 */
export function ShareButton({ url, title = "팩트체크 결과", size = "md", className }: Props) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    if (!url) return;

    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title, url });
        return;
      } catch (e) {
        // 사용자가 공유를 취소한 경우엔 조용히 종료
        if (e instanceof Error && e.name === "AbortError") return;
        // 그 외 오류는 복사로 폴백
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  const sizeCls =
    size === "md"
      ? "rounded-2xl px-4 py-2 text-[13px]"
      : "rounded-full px-3 py-1.5 text-[12px]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!url}
      className={cn(
        "inline-flex items-center gap-1.5 font-medium transition active:scale-[0.97] disabled:opacity-40",
        copied
          ? "bg-mint-600 text-white"
          : "bg-mint-400 text-white shadow-soft hover:bg-mint-500",
        sizeCls,
        className,
      )}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          링크 복사됨
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" />
            <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
          </svg>
          공유하기
        </>
      )}
    </button>
  );
}
