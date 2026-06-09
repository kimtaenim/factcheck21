"use client";

import { useMemo } from "react";

interface Props {
  markdown: string;
}

export function FactMarkdown({ markdown }: Props) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown]);
  return <div className="prose-fc" dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+(?:\([^\s)]*\)[^\s)]*)*)\)/g,
    (_m, text, url) => `<a href="${url}" target="_blank" rel="noreferrer">${text}</a>`,
  );
  out = out.replace(
    /(?<!href=")\bhttps?:\/\/[^\s<>")]+(?:\([^\s)]*\)[^\s)]*)*/g,
    (url) => `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`,
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return out;
}

function renderMarkdown(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line)) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      const m = line.match(/^(#{1,6})\s+(.+)/)!;
      const level = m[1].length;
      out.push(`<h${level}>${inline(m[2])}</h${level}>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
      continue;
    }
    if (line.trim() === "") {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      continue;
    }
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
    out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}
