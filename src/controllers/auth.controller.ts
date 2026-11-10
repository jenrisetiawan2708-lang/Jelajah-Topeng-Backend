import jwt from "jsonwebtoken";
import { env } from "../config/env";
import * as users from "../models/user.model";
import type { LoginInput, RegisterInput } from "../validators/auth.validator";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";

// Token pengunjung (role "user"), berlaku 7 hari. Dipakai aplikasi mobile.
function signToken(user: users.AppUser): string {
  return jwt.sign({ email: user.email, role: "user" }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: "7d",
    algorithm: "HS256",
  });
}

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body as RegisterInput;

  if (await users.emailExists(email)) {
    throw new AppError(409, "Email sudah terdaftar", { email: ["Email sudah terdaftar"] });
  }

  const user = await users.create(name, email, password);
  res.success({ token: signToken(user), user }, "Registrasi berhasil", 201);
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body as LoginInput;

  const user = await users.authenticate(email, password);
  if (!user) throw new AppError(401, "Email atau kata sandi salah");

  res.success({ token: signToken(user), user }, "Login berhasil");
});