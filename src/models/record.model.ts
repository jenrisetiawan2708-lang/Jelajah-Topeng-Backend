import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, withTransaction } from "../config/db";
import { CONTENT_PROFILES, KINDS, type RecordKind } from "../content/profiles";
import * as appUsers from "./user.model";

export type RecordDTO = {
  id: string;
  name: string;
  description: string;
  location: string;
  date: string;
  amount: string;
  status: string;
  createdAt: string;
  correctAnswer: string;
  correctClue: string;
  imageUrl: string;
  eventDate: string;
};

export type RecordDraft = Omit<RecordDTO, "id" | "createdAt">;

interface RecordRow extends RowDataPacket {
  id: string;
  user_id: string;
  kind: RecordKind;
  name: string;
  description: string;
  location: string;
  date_value: string;
  amount: string;
  status: string;
  correct_answer: string;
  correct_clue: string;
  image_url: string;
  event_date: string;
  updated_at: Date;
}

// Transformasi field (PPT 6): snake_case di DB -> camelCase untuk client,
// dan user_id TIDAK ikut dikirim keluar.
const toDTO = (r: RecordRow): RecordDTO => ({
  id: r.id,
  name: r.name,
  description: r.description,
  location: r.location,
  date: r.date_value,
  amount: r.amount,
  status: r.status,
  createdAt: r.updated_at.toISOString(),
  correctAnswer: r.correct_answer,
  correctClue: r.correct_clue,
  imageUrl: r.image_url,
  eventDate: r.event_date,
});

const INSERT_SQL = `INSERT INTO content_records
  (id, user_id, kind, name, description, location, date_value, amount, status,
   correct_answer, correct_clue, image_url, event_date, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// Data contoh dimasukkan sekali per user per halaman.
// INSERT IGNORE + affectedRows: hanya request yang berhasil menandai yang melakukan seed.
async function ensureSeeded(userId: string) {
  const [done] = await pool.execute<RowDataPacket[]>(
    "SELECT kind FROM seeded_kinds WHERE user_id = ? AND kind <> 'refund'",
    [userId],
  );
  if (done.length >= KINDS.length) return;

  await withTransaction(async (conn) => {
    for (const kind of KINDS) {
      const [mark] = await conn.execute<ResultSetHeader>(
        "INSERT IGNORE INTO seeded_kinds (user_id, kind) VALUES (?, ?)",
        [userId, kind],
      );
      if (mark.affectedRows !== 1) continue;

      for (const seed of CONTENT_PROFILES[kind].records) {
        await conn.execute(INSERT_SQL, [
          randomUUID(), userId, kind, seed.name, seed.description, seed.location,
          seed.date, seed.amount, seed.status, "", "", "", "",
          new Date(0), new Date(0),
        ]);
      }
    }
  });
}

export async function listByUser(userId: string): Promise<RecordDTO[]> {
  await ensureSeeded(userId);
  const [rows] = await pool.execute<RecordRow[]>(
    "SELECT * FROM content_records WHERE user_id = ? ORDER BY updated_at ASC, name ASC",
    [userId],
  );
  return rows.map(toDTO);
}

const dateWib = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);

// Halaman Profil Pengguna: bukan data ketikan admin, tapi akun yang mendaftar
// lewat aplikasi mobile (tabel app_users). Hanya baca.
const toUserRecord = (u: appUsers.RegisteredUser): RecordDTO => ({
  id: u.id,
  name: u.name,
  description: "Akun pengguna aplikasi mobile Jelajah Topeng.",
  location: u.email,
  date: dateWib(u.createdAt),
  amount: "Mendaftar lewat aplikasi mobile.",
  status: "Terdaftar",
  createdAt: u.createdAt.toISOString(),
  correctAnswer: "",
  correctClue: "",
  imageUrl: "",
  eventDate: "",
});

export async function listGrouped(userId: string): Promise<Record<RecordKind, RecordDTO[]>> {
  await ensureSeeded(userId);
  const [rows] = await pool.execute<RecordRow[]>(
    "SELECT * FROM content_records WHERE user_id = ? ORDER BY updated_at ASC, name ASC",
    [userId],
  );

  const grouped = Object.fromEntries(KINDS.map((k) => [k, []])) as unknown as Record<
    RecordKind,
    RecordDTO[]
  >;
  for (const row of rows) {
    if (row.kind !== "users" && grouped[row.kind]) grouped[row.kind].push(toDTO(row));
  }
  grouped.users = (await appUsers.listRegistered()).map(toUserRecord);
  return grouped;
}

export async function nameExists(
  userId: string,
  kind: RecordKind,
  name: string,
  exceptId?: string,
): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id FROM content_records WHERE user_id = ? AND kind = ? AND LOWER(TRIM(name)) = ?",
    [userId, kind, name.trim().toLowerCase()],
  );
  return rows.some((r) => r.id !== exceptId);
}

// Cek kepemilikan: userId SELALU ikut di WHERE (cegah IDOR).
export async function findOwned(
  userId: string,
  id: string,
  kind?: RecordKind,
): Promise<RecordDTO | null> {
  const [rows] = await pool.execute<RecordRow[]>(
    "SELECT * FROM content_records WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  const row = rows[0];
  if (!row || (kind && row.kind !== kind)) return null;
  return toDTO(row);
}

export async function insert(
  userId: string,
  kind: RecordKind,
  v: RecordDraft,
): Promise<RecordDTO> {
  const id = randomUUID();
  const now = new Date();
  await pool.execute(INSERT_SQL, [
    id, userId, kind, v.name, v.description, v.location, v.date, v.amount, v.status,
    v.correctAnswer, v.correctClue, v.imageUrl, v.eventDate, now, now,
  ]);
  return (await findOwned(userId, id)) as RecordDTO;
}

export async function update(
  userId: string,
  id: string,
  v: RecordDraft,
): Promise<RecordDTO | null> {
  await pool.execute(
    `UPDATE content_records
     SET name = ?, description = ?, location = ?, date_value = ?, amount = ?, status = ?,
         correct_answer = ?, correct_clue = ?, image_url = ?, event_date = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [
      v.name, v.description, v.location, v.date, v.amount, v.status,
      v.correctAnswer, v.correctClue, v.imageUrl, v.eventDate, new Date(),
      id, userId,
    ],
  );
  return findOwned(userId, id);
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    "DELETE FROM content_records WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  return result.affectedRows > 0;
}