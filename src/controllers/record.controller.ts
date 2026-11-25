import { currentUser } from "../middleware/verifyToken";
import * as records from "../models/record.model";
import * as appUsers from "../models/user.model";
import { ALL_USERS, type RecordInput } from "../validators/record.validator";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";

// Profil Pengguna berisi akun yang mendaftar lewat aplikasi mobile: tidak diubah dari web.
function assertWritable(kind: string) {
  if (kind === "users") {
    throw new AppError(
      409,
      "Data pengguna berasal dari pendaftaran di aplikasi mobile dan tidak bisa diubah dari sini",
    );
  }
}

// Penerima notifikasi: "Semua user" atau email pengguna yang benar-benar sudah terdaftar.
async function assertRecipient(kind: string, location: string) {
  if (kind !== "notification" || location === ALL_USERS) return;
  if (!(await appUsers.registeredEmailExists(location))) {
    throw new AppError(400, "Penerima belum terdaftar sebagai pengguna", {
      location: ["Penerima belum terdaftar sebagai pengguna"],
    });
  }
}

// GET /api/records  -> { exploration: [...], panji: [...], ... }
export const list = asyncHandler(async (_req, res) => {
  const user = currentUser(res);
  res.success(await records.listGrouped(user.id), "Data berhasil diambil");
});

// POST /api/records
export const create = asyncHandler(async (req, res) => {
  const user = currentUser(res);
  const { kind, ...values } = req.body as RecordInput;
  assertWritable(kind);
  await assertRecipient(kind, values.location);

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
  assertWritable(kind);
  await assertRecipient(kind, values.location);

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