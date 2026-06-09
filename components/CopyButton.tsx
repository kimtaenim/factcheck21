"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  label?: string;
  copiedLabel?: string;
  size?: "sm" | "md";
  className?: string;
}

export function CopyButton({ text, label = "복사", copiedLabel = "복사됨", size = "sm", className }: Props) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
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
      disabled={!text}
      className={cn(
        "inline-flex items-center gap-1.5 font-medium transition active:scale-[0.97] disabled:opacity-40",
        copied
          ? "bg-blue-600 text-white"
          : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200 hover:text-zinc-900 hover:ring-zinc-300",
        sizeCls,
        className,
      )}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {copiedLabel}
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}
