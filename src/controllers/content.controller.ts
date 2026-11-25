import { currentUser } from "../middleware/verifyToken";
import * as content from "../models/content.model";
import * as appUsers from "../models/user.model";
import type { AnswerInput } from "../validators/content.validator";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";

// Samakan huruf besar/kecil, tanda baca, dan spasi ganda sebelum dibandingkan.
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

// Email pengguna yang sedang login, untuk menyaring notifikasi per penerima.
async function viewerEmail(userId: string): Promise<string | null> {
  return (await appUsers.findById(userId))?.email ?? null;
}

// GET /api/content  -> { exploration: [...], panji: [...], ... }
export const listAll = asyncHandler(async (_req, res) => {
  const email = await viewerEmail(currentUser(res).id);
  res.success(await content.listAll(email), "Konten berhasil diambil");
});

// GET /api/content/:kind
export const listByKind = asyncHandler(async (req, res) => {
  const kind = String(req.params.kind);
  if (!content.isPublicKind(kind)) throw new AppError(404, "Jenis konten tidak ditemukan");
  const email = await viewerEmail(currentUser(res).id);
  res.success(await content.listByKind(kind, email), "Konten berhasil diambil");
});

// POST /api/content/panji/:id/answer  { answer }
export const answerPanji = asyncHandler(async (req, res) => {
  const { answer } = req.body as AnswerInput;
  const secret = await content.findPanjiSecret(String(req.params.id));
  if (!secret) throw new AppError(404, "Game tidak ditemukan");

  const correct = normalize(answer) === normalize(secret.correctAnswer);
  res.success(
    correct ? { correct: true, clue: secret.correctClue } : { correct: false },
    correct ? "Jawaban benar" : "Jawaban belum tepat",
  );
});