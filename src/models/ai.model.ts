import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { orm } from "../db/orm";
import { aiResults } from "../db/schema";

export type AiResultDTO = {
  id: string;
  question: string;
  answer: string;
  references: string[];
  confidence: "tinggi" | "sedang" | "rendah";
  createdAt: string;
};

export type AiResultDraft = {
  question: string;
  answer: string;
  references: string[];
  confidence: "tinggi" | "sedang" | "rendah";
  model: string;
};

type AiRow = typeof aiResults.$inferSelect;

function parseRefs(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

// userId & model tidak ikut keluar.
const toDTO = (r: AiRow): AiResultDTO => ({
  id: r.id,
  question: r.question,
  answer: r.answer,
  references: parseRefs(r.refs),
  confidence: r.confidence as AiResultDTO["confidence"],
  createdAt: r.createdAt.toISOString(),
});

export async function create(userId: string, draft: AiResultDraft): Promise<AiResultDTO> {
  const row: AiRow = {
    id: randomUUID(),
    userId,
    question: draft.question,
    answer: draft.answer,
    refs: JSON.stringify(draft.references),
    confidence: draft.confidence,
    model: draft.model,
    createdAt: new Date(),
  };
  await orm.insert(aiResults).values(row);
  return toDTO(row);
}

export async function listByUser(userId: string, limit = 20): Promise<AiResultDTO[]> {
  const rows = await orm
    .select()
    .from(aiResults)
    .where(eq(aiResults.userId, userId))
    .orderBy(desc(aiResults.createdAt))
    .limit(limit);
  return rows.map(toDTO);
}

// Dipakai untuk pembatasan laju: berapa pertanyaan user sejak waktu tertentu.
export async function countSince(userId: string, since: Date): Promise<number> {
  const [row] = await orm
    .select({ total: count() })
    .from(aiResults)
    .where(and(eq(aiResults.userId, userId), gte(aiResults.createdAt, since)));
  return Number(row?.total ?? 0);
}