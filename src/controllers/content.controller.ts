import * as content from "../models/content.model";
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

// GET /api/content  -> { exploration: [...], panji: [...], ... }
export const listAll = asyncHandler(async (_req, res) => {
  res.success(await content.listAll(), "Konten berhasil diambil");
});

// GET /api/content/:kind
export const listByKind = asyncHandler(async (req, res) => {
  const kind = String(req.params.kind);
  if (!content.isPublicKind(kind)) throw new AppError(404, "Jenis konten tidak ditemukan");
  res.success(await content.listByKind(kind), "Konten berhasil diambil");
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