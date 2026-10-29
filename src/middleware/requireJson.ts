import type { RequestHandler } from "express";

const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

// Standarisasi header (PPT 6): request yang membawa body wajib application/json.
export const requireJson: RequestHandler = (req, res, next) => {
  const hasBody =
    Number(req.headers["content-length"] ?? 0) > 0 ||
    Boolean(req.headers["transfer-encoding"]);

  if (BODY_METHODS.has(req.method) && hasBody && !req.is("application/json")) {
    return res.fail("Content-Type harus application/json", 415);
  }
  next();
};