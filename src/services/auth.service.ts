import jwt from "jsonwebtoken";
import { env } from "../config/env";
import * as users from "../models/user.model";
import { AppError } from "../utils/AppError";

export type AuthResult = { token: string; user: users.AppUser };

// Admin (web) lebih pendek karena akses lebih luas, pengunjung (mobile) lebih lama.
const TOKEN_TTL = { admin: "8h", user: "7d" } as const;

function signToken(user: users.AppUser): string {
  return jwt.sign({ email: user.email, role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: TOKEN_TTL[user.role],
    algorithm: "HS256",
  });
}

// Pendaftaran lewat API SELALU berperan "user". Admin hanya dibuat lewat skrip.
export async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  if (await users.emailExists(email)) {
    throw new AppError(409, "Email sudah terdaftar", { email: ["Email sudah terdaftar"] });
  }
  const user = await users.create(name, email, password, "user");
  return { token: signToken(user), user };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const user = await users.authenticate(email, password);
  if (!user) throw new AppError(401, "Email atau kata sandi salah");
  return { token: signToken(user), user };
}

// Dipakai skrip createAdmin (tidak ada endpoint publik untuk membuat admin).
export async function createAdmin(
  name: string,
  email: string,
  password: string,
): Promise<users.AppUser> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (cleanName.length < 3) throw new AppError(400, "Nama minimal 3 karakter");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new AppError(400, "Format email tidak valid");
  }
  if (password.length < 8) throw new AppError(400, "Kata sandi minimal 8 karakter");
  if (await users.emailExists(cleanEmail)) throw new AppError(409, "Email sudah terdaftar");
  return users.create(cleanName, cleanEmail, password, "admin");
}