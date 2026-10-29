import type { RequestHandler } from "express";
import type { z } from "zod";

export type FieldErrors = Record<string, string[]>;

export function fieldErrorsFromIssues(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

// Validator middleware (PPT 4): gagal cepat dengan 400, kalau valid lanjut next().
export const validateBody =
  (schema: z.ZodType): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.fail("Validasi gagal", 400, fieldErrorsFromIssues(result.error.issues));
    }
    req.body = result.data;
    next();
  };