import type { RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type AuthUser = {
  id: string;
  email: string;
  role: "admin" | "user";
};

// Ambil user yang sudah diverifikasi dari res.locals (PPT 4).
export const currentUser = (res: Response) => res.locals.user as AuthUser;

// verifyToken (PPT 4): ambil JWT dari header Authorization, tolak 401/403 kalau tidak sah.
export const verifyToken: RequestHandler = (req, res, next) => {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.fail("Token autentikasi tidak ditemukan", 401);
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" || !payload.sub) {
      return res.fail("Token tidak valid", 403);
    }

    res.locals.user = {
      id: String(payload.sub),
      email: String(payload.email ?? ""),
      role: payload.role === "admin" ? "admin" : "user",
    } satisfies AuthUser;

    next();
  } catch (error) {
    const expired = error instanceof jwt.TokenExpiredError;
    return res.fail(expired ? "Token kedaluwarsa" : "Token tidak valid", expired ? 401 : 403);
  }
};

// Otorisasi: hanya admin.
export const requireAdmin: RequestHandler = (_req, res, next) => {
  if (currentUser(res).role !== "admin") {
    return res.fail("Hanya admin yang boleh mengakses", 403);
  }
  next();
};