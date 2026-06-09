import { Redis } from "@upstash/redis";
import type { FactcheckRecord, RecentSummary } from "./types";

const TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_HISTORY = 100;

let redis: Redis | null = null;

const G = globalThis as unknown as {
  __fcMem?: Map<string, FactcheckRecord>;
  __fcOrder?: string[];
};
const memRecords: Map<string, FactcheckRecord> =
  G.__fcMem ?? (G.__fcMem = new Map());
const memOrder: string[] = G.__fcOrder ?? (G.__fcOrder = []);

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

const recordKey = (id: string) => `sisain:factcheck:item:${id}`;
const recentKey = "sisain:factcheck:recent";

function toSummary(record: FactcheckRecord): RecentSummary {
  const preview = record.markdown
    .replace(/^#.*$/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*>`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return {
    id: record.id,
    createdAt: record.createdAt,
    dateKst: record.dateKst,
    title: record.title,
    preview,
    costKrw: record.cost.cost_krw,
  };
}

export async function saveFactcheck(record: FactcheckRecord): Promise<void> {
  const r = getRedis();
  const summary = toSummary(record);
  if (r) {
    await r.set(recordKey(record.id), JSON.stringify(record), { ex: TTL_SECONDS });
    await r.lpush(recentKey, JSON.stringify(summary));
    await r.ltrim(recentKey, 0, MAX_HISTORY - 1);
    return;
  }
  memRecords.set(record.id, record);
  memOrder.unshift(record.id);
  while (memOrder.length > MAX_HISTORY) memOrder.pop();
}

export async function loadFactcheck(id: string): Promise<FactcheckRecord | null> {
  const r = getRedis();
  if (r) {
    const raw = await r.get<string | FactcheckRecord>(recordKey(id));
    if (!raw) return null;
    return typeof raw === "string" ? (JSON.parse(raw) as FactcheckRecord) : raw;
  }
  return memRecords.get(id) ?? null;
}

export async function deleteFactcheck(id: string): Promise<boolean> {
  const r = getRedis();
  if (r) {
    const exists = await r.exists(recordKey(id));
    if (!exists) return false;
    const list = (await r.lrange(recentKey, 0, MAX_HISTORY - 1)) as Array<string | RecentSummary>;
    const kept = list
      .map((v) => (typeof v === "string" ? (JSON.parse(v) as RecentSummary) : v))
      .filter((s) => s.id !== id);
    const pipe = r.multi();
    pipe.del(recordKey(id));
    pipe.del(recentKey);
    if (kept.length > 0) {
      pipe.rpush(recentKey, ...kept.map((s) => JSON.stringify(s)));
    }
    await pipe.exec();
    return true;
  }
  if (!memRecords.has(id)) return false;
  memRecords.delete(id);
  const idx = memOrder.indexOf(id);
  if (idx >= 0) memOrder.splice(idx, 1);
  return true;
}

export async function listRecent(limit = MAX_HISTORY): Promise<RecentSummary[]> {
  const r = getRedis();
  if (r) {
    const items = (await r.lrange(recentKey, 0, limit - 1)) as Array<string | RecentSummary>;
    return items.map((v) => (typeof v === "string" ? (JSON.parse(v) as RecentSummary) : v));
  }
  return memOrder.slice(0, limit).map((id) => toSummary(memRecords.get(id)!));
}
