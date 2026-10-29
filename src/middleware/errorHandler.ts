import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../utils/AppError";

export const notFound: RequestHandler = (req, res) => {
  res.fail(`Rute ${req.method} ${req.originalUrl} tidak ditemukan`, 404);
};

// Error handler global (PPT 4 & 7): fungsi dengan 4 argumen.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  void _next;

  if (err instanceof AppError) {
    return res.fail(err.message, err.status, err.errors);
  }

  // Error dari body parser (JSON rusak / terlalu besar)
  if (err && typeof err === "object" && "type" in err) {
    if (err.type === "entity.parse.failed") return res.fail("Format JSON tidak valid", 400);
    if (err.type === "entity.too.large") return res.fail("Ukuran data terlalu besar", 413);
  }

  console.error(`[${req.id}]`, err);
  return res.fail("Terjadi kesalahan pada server", 500);
};