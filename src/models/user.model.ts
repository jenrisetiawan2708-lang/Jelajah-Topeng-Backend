import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../config/db";

export type Role = "admin" | "user";
export type AppUser = { id: string; name: string; email: string; role: Role };

interface UserRow extends RowDataPacket {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
}

const toUser = (r: UserRow): AppUser => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
});

// Hash kata sandi dengan scrypt + salt acak (bawaan Node, tanpa paket tambahan).
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function findById(id: string): Promise<AppUser | null> {
  const [rows] = await pool.execute<UserRow[]>("SELECT * FROM app_users WHERE id = ?", [id]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function emailExists(email: string): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id FROM app_users WHERE email = ?",
    [email],
  );
  return rows.length > 0;
}

export async function create(
  name: string,
  email: string,
  password: string,
  role: Role = "user",
): Promise<AppUser> {
  const id = randomUUID();
  await pool.execute(
    "INSERT INTO app_users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, name, email, hashPassword(password), role, new Date()],
  );
  return { id, name, email, role };
}

export async function authenticate(email: string, password: string): Promise<AppUser | null> {
  const [rows] = await pool.execute<UserRow[]>("SELECT * FROM app_users WHERE email = ?", [email]);
  const row = rows[0];
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return toUser(row);
}