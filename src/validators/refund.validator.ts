import type { RequestHandler } from "express";
import { z } from "zod";
import { fieldErrorsFromIssues } from "./validate";

export type RefundDecisionInput = {
  decision: "approve" | "reject";
  reason: string;
  note: string;
};

// Alasan penolakan wajib diisi (min. 10 karakter) kalau menolak.
export function checkRefundReason(raw: string): string {
  const value = raw.trim();
  if (!value) return "Alasan penolakan wajib diisi untuk pengajuan tolak.";
  if (value.length < 10) return "Alasan penolakan minimal 10 karakter.";
  if (value.length > 500) return "Alasan penolakan maksimal 500 karakter.";
  return "";
}

const decisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().default(""),
  note: z.string().trim().max(500, "Catatan maksimal 500 karakter").default(""),
});

export const validateRefundDecision: RequestHandler = (req, res, next) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.fail("Validasi gagal", 400, fieldErrorsFromIssues(parsed.error.issues));
  }

  if (parsed.data.decision === "reject") {
    const message = checkRefundReason(parsed.data.reason);
    if (message) return res.fail("Validasi gagal", 400, { reason: [message] });
  }

  req.body = parsed.data satisfies RefundDecisionInput;
  next();
};