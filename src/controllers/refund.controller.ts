import { currentUser } from "../middleware/verifyToken";
import * as refunds from "../models/refund.model";
import type { RefundDecisionInput } from "../validators/refund.validator";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";

// GET /api/refunds
export const list = asyncHandler(async (_req, res) => {
  const user = currentUser(res);
  res.success(await refunds.list(user.id), "Data refund berhasil diambil");
});

// PATCH /api/refunds/:id/decision   body: { decision, reason?, note? }
export const decide = asyncHandler(async (req, res) => {
  const user = currentUser(res);
  const id = String(req.params.id);
  const { decision, reason, note } = req.body as RefundDecisionInput;

  const result = await refunds.decide(user.id, id, decision, reason, note);
  if (result === "not_found") throw new AppError(404, "Pengajuan tidak ditemukan");
  if (result === "invalid_state") {
    throw new AppError(409, "Pengajuan sudah diproses atau tidak bisa diubah ke status ini");
  }

  res.success(
    await refunds.findOwned(user.id, id),
    decision === "approve" ? "Refund berhasil disetujui" : "Refund berhasil ditolak",
  );
});