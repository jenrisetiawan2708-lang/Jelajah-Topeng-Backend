import { currentUser } from "../middleware/verifyToken";
import * as payments from "../models/payment.model";
import * as service from "../services/payment.service";
import type { CheckoutInput } from "../validators/payment.validator";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";

// GET /api/payments  (admin: transaksi semua pengunjung)
export const list = asyncHandler(async (_req, res) => {
  res.success(await payments.listAll(), "Data pembayaran berhasil diambil");
});

// GET /api/payments/mine  (pengunjung: transaksi miliknya)
export const mine = asyncHandler(async (_req, res) => {
  const user = currentUser(res);
  res.success(await payments.listByUser(user.id), "Data pembayaran berhasil diambil");
});

// POST /api/payments/checkout  (pengunjung dari mobile, atau admin)
export const checkout = asyncHandler(async (req, res) => {
  const user = currentUser(res);
  const payment = await service.checkout(user, req.body as CheckoutInput);
  res.success(payment, "Tagihan pembayaran dibuat", 201);
});

// POST /api/payments/notification  <- webhook Midtrans, tanpa login
export const handleNotification = asyncHandler(async (req, res) => {
  res.success(await service.applyNotification(req.body), "Notifikasi diproses");
});

// GET /api/payments/:orderId/status
export const syncStatus = asyncHandler(async (req, res) => {
  const user = currentUser(res);
  const { payment, synced } = await service.syncStatus(user, String(req.params.orderId));
  res.success(
    payment,
    synced
      ? "Status diperbarui dari Midtrans"
      : "Belum ada transaksi di Midtrans (metode bayar belum dipilih)",
  );
});

// DELETE /api/payments/:orderId  (admin) -> hapus tagihan yang belum lunas
export const remove = asyncHandler(async (req, res) => {
  const orderId = String(req.params.orderId);
  const result = await payments.removeAny(orderId);
  if (result === "not_found") throw new AppError(404, "Pembayaran tidak ditemukan");
  if (result === "locked") {
    throw new AppError(409, "Transaksi yang sudah lunas tidak bisa dihapus");
  }
  res.success({ orderId }, "Tagihan berhasil dihapus");
});