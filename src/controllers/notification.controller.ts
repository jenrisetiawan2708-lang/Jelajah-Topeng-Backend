import { currentUser } from "../middleware/verifyToken";
import * as notifications from "../models/notification.model";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";

// GET /api/notifications/mine -> notifikasi untuk user yang login + status baca-nya
export const mine = asyncHandler(async (_req, res) => {
  const user = currentUser(res);
  res.success(
    await notifications.listForUser(user.id, user.email),
    "Notifikasi berhasil diambil",
  );
});

// POST /api/notifications/:id/read -> hanya penerima yang bisa menandai terbaca
export const markRead = asyncHandler(async (req, res) => {
  const user = currentUser(res);
  if (user.role === "admin") {
    throw new AppError(403, "Admin tidak bisa menandai notifikasi sebagai terbaca");
  }

  const id = String(req.params.id);
  if (!(await notifications.isRecipient(id, user.email))) {
    throw new AppError(404, "Notifikasi tidak ditemukan");
  }

  await notifications.markRead(id, user.id);
  res.success({ id, read: true }, "Notifikasi ditandai sudah dibaca");
});

// GET /api/notifications/status -> khusus admin (bell di dashboard web)
export const status = asyncHandler(async (_req, res) => {
  const admin = currentUser(res);
  res.success(
    await notifications.statusForAdmin(admin.id),
    "Status notifikasi berhasil diambil",
  );
});