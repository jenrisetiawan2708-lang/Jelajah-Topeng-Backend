import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../config/db";

// Halaman yang boleh dibaca pengguna mobile (data dikelola admin lewat web).
export const PUBLIC_KINDS = [
  "exploration",
  "panji",
  "materi",
  "ticketing",
  "faq",
  "notification",
] as const;
export type PublicKind = (typeof PUBLIC_KINDS)[number];

export const isPublicKind = (value: string): value is PublicKind =>
  (PUBLIC_KINDS as readonly string[]).includes(value);

// Status yang tidak boleh tampil ke pengunjung.
const HIDDEN_STATUSES = ["Draft", "Nonaktif"];

export type ContentDTO = {
  id: string;
  name: string;
  description: string;
  location: string;
  date: string;
  amount: string;
  status: string;
  imageUrl: string;
  eventDate: string;
  updatedAt: string;
};

interface ContentRow extends RowDataPacket {
  id: string;
  kind: string;
  name: string;
  description: string;
  location: string;
  date_value: string;
  amount: string;
  status: string;
  image_url: string;
  event_date: string;
  updated_at: Date;
}

// correct_answer & correct_clue SENGAJA tidak ikut keluar (dicek di server).
const toDTO = (r: ContentRow): ContentDTO => ({
  id: r.id,
  name: r.name,
  description: r.description,
  location: r.location,
  date: r.date_value,
  amount: r.amount,
  status: r.status,
  imageUrl: r.image_url,
  eventDate: r.event_date,
  updatedAt: r.updated_at.toISOString(),
});

// Konten milik akun admin. Kalau ada beberapa admin, nama yang sama hanya
// ditampilkan sekali (versi yang paling baru diubah).
export async function listByKind(kind: PublicKind): Promise<ContentDTO[]> {
  const [rows] = await pool.execute<ContentRow[]>(
    `SELECT r.* FROM content_records r
     JOIN app_users u ON u.id = r.user_id
     WHERE u.role = 'admin' AND r.kind = ?
     ORDER BY r.updated_at DESC`,
    [kind],
  );

  const seen = new Set<string>();
  const items: ContentRow[] = [];
  for (const row of rows) {
    if (HIDDEN_STATUSES.includes(row.status)) continue;
    const key = row.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(row);
  }
  return items.reverse().map(toDTO); // urut lama -> baru, sama seperti di web
}

export async function listAll(): Promise<Record<PublicKind, ContentDTO[]>> {
  const entries = await Promise.all(
    PUBLIC_KINDS.map(async (kind) => [kind, await listByKind(kind)] as const),
  );
  return Object.fromEntries(entries) as Record<PublicKind, ContentDTO[]>;
}

interface PanjiRow extends RowDataPacket {
  correct_answer: string;
  correct_clue: string;
}

export async function findPanjiSecret(
  id: string,
): Promise<{ correctAnswer: string; correctClue: string } | null> {
  const [rows] = await pool.execute<PanjiRow[]>(
    `SELECT r.correct_answer, r.correct_clue FROM content_records r
     JOIN app_users u ON u.id = r.user_id
     WHERE r.id = ? AND r.kind = 'panji' AND u.role = 'admin'`,
    [id],
  );
  const row = rows[0];
  return row ? { correctAnswer: row.correct_answer, correctClue: row.correct_clue } : null;
}