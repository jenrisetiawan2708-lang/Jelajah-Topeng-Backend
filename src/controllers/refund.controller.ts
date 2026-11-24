import { currentUser } from "../middleware/verifyToken";
import * as refunds from "../models/refund.model";
import * as appRefunds from "../models/refundApp.model";
import type { CreateRefundBody, RefundDecisionInput } from "../validators/refund.validator";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";

// GET /api/refunds  (admin)
export const list = asyncHandler(async (_req, res) => {
  const user = currentUser(res);
  res.success(await refunds.list(user.id), "Data refund berhasil diambil");
});

// PATCH /api/refunds/:id/decision   body: { decision, reason?, note? }  (admin)
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

// POST /api/refunds  (pengunjung dari app)
export const create = asyncHandler(async (req, res) => {
  const user = currentUser(res);
  const r = await appRefunds.create(user.id, user.email, req.body as CreateRefundBody);
  if (!r.ok) {
    if (r.error === "not_found") throw new AppError(404, "Pesanan tidak ditemukan");
    if (r.error === "not_paid") throw new AppError(409, "Hanya pesanan yang sudah lunas yang bisa direfund");
    if (r.error === "duplicate") throw new AppError(409, "Pesanan ini sudah pernah diajukan refund");
    throw new AppError(422, "Refund tidak tersedia: kurang dari 24 jam sebelum kunjungan");
  }
  res.success(r.refund, "Pengajuan refund terkirim", 201);
});

// GET /api/refunds/mine  (pengunjung)
export const mine = asyncHandler(async (_req, res) => {
  const user = currentUser(res);
  res.success(await appRefunds.listMine(user.id), "Data refund berhasil diambil");
});

// GET /api/refunds/order/:orderId  (pengunjung) -> 404 kalau belum pernah diajukan
export const byOrder = asyncHandler(async (req, res) => {
  const user = currentUser(res);
  const item = await appRefunds.findByOrder(user.id, String(req.params.orderId));
  if (!item) throw new AppError(404, "Belum ada pengajuan refund untuk pesanan ini");
  res.success(item, "Data refund berhasil diambil");
});