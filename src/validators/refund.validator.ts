import type { RequestHandler } from "express";
import { z } from "zod";
import { fieldErrorsFromIssues, validateBody } from "./validate";

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

// ---- Pengajuan refund dari app (pengunjung) ----

const createSchema = z.object({
  orderId: z.string().trim().min(3, "Nomor pesanan wajib diisi").max(64),
  reason: z.string().trim().min(3, "Alasan minimal 3 karakter").max(120),
  note: z.string().trim().max(500, "Catatan maksimal 500 karakter").default(""),
  visitAt: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Format waktu kunjungan tidak valid"),
  tickets: z.coerce.number().int().min(1).max(1000).default(1),
  methodType: z.enum(["bank", "ewallet"]),
  provider: z.string().trim().min(2, "Nama bank/dompet wajib diisi").max(40),
  accountNumber: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{6,20}$/, "Nomor rekening/HP harus 6-20 digit angka")),
  accountOwner: z.string().trim().min(3, "Nama pemilik minimal 3 karakter").max(120),
});

export type CreateRefundBody = z.infer<typeof createSchema>;

export const validateRefundCreate = validateBody(createSchema);