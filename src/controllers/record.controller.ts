import { currentUser } from "../middleware/verifyToken";
import * as records from "../models/record.model";
import type { RecordInput } from "../validators/record.validator";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";

// GET /api/records  -> { exploration: [...], panji: [...], ... }
export const list = asyncHandler(async (_req, res) => {
  const user = currentUser(res);
  res.success(await records.listGrouped(user.id), "Data berhasil diambil");
});

// POST /api/records
export const create = asyncHandler(async (req, res) => {
  const user = currentUser(res);
  const { kind, ...values } = req.body as RecordInput;

  if (await records.nameExists(user.id, kind, values.name)) {
    throw new AppError(409, "Data dengan nama tersebut sudah ada", {
      name: ["Data dengan nama tersebut sudah ada"],
    });
  }

  const created = await records.insert(user.id, kind, values);
  res.success(created, "Data berhasil ditambahkan", 201);
});

// PUT /api/records/:id
export const update = asyncHandler(async (req, res) => {
  const user = currentUser(res);
  const id = String(req.params.id);
  const { kind, ...values } = req.body as RecordInput;

  const existing = await records.findOwned(user.id, id, kind);
  if (!existing) throw new AppError(404, "Data tidak ditemukan atau bukan milik akun ini");

  if (await records.nameExists(user.id, kind, values.name, id)) {
    throw new AppError(409, "Data dengan nama tersebut sudah ada", {
      name: ["Data dengan nama tersebut sudah ada"],
    });
  }

  const updated = await records.update(user.id, id, values);
  res.success(updated, "Perubahan berhasil disimpan");
});

// DELETE /api/records/:id
export const remove = asyncHandler(async (req, res) => {
  const user = currentUser(res);
  const removed = await records.remove(user.id, String(req.params.id));
  if (!removed) throw new AppError(404, "Data tidak ditemukan atau bukan milik akun ini");
  res.success({ id: String(req.params.id) }, "Data berhasil dihapus");
});