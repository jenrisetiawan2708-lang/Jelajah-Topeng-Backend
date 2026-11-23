import { currentUser } from "../middleware/verifyToken";
import * as service from "../services/ai.service";
import type { AskInput } from "../validators/ai.validator";
import { asyncHandler } from "../utils/asyncHandler";

// POST /api/ai/ask  (pengunjung dari mobile, atau admin)
export const ask = asyncHandler(async (req, res) => {
  const user = currentUser(res);
  const { question } = req.body as AskInput;
  res.success(await service.ask(user.id, question), "Jawaban AI berhasil dibuat", 201);
});

// GET /api/ai/history  (riwayat tanya jawab milik sendiri)
export const history = asyncHandler(async (_req, res) => {
  const user = currentUser(res);
  res.success(await service.history(user.id), "Riwayat AI berhasil diambil");
});