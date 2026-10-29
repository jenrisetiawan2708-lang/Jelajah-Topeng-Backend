import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

// Augmentasi request + standarisasi header (PPT 6):
// tiap request diberi ID unik, dan response tidak boleh di-cache.
export const requestContext: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id");
  req.id = incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.id);
  res.setHeader("Cache-Control", "no-store");
  next();
};