import type { Metadata } from "next";
import { loadFactcheck } from "@/lib/cache";
import { ResultClient } from "./ResultClient";

export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ id: string }>;
}

function toPlain(markdown: string, max: number): string {
  return markdown
    .replace(/^#.*$/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*>`#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const record = await loadFactcheck(id);
  if (!record) {
    return { title: "결과를 찾을 수 없음 · 팩트체크 에이전트" };
  }
  const title = `${record.title} · 팩트체크`;
  const description = toPlain(record.markdown, 150) || "원고 팩트체크 결과";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "팩트체크 에이전트",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function ResultPage({ params }: PageProps) {
  const { id } = await params;
  const record = await loadFactcheck(id);
  return <ResultClient initialRecord={record} />;
}
