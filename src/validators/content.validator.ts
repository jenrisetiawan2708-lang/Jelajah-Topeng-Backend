import { z } from "zod";
import { validateBody } from "./validate";

const answerSchema = z.object({
  answer: z
    .string()
    .trim()
    .min(1, "Jawaban wajib diisi")
    .max(200, "Jawaban maksimal 200 karakter"),
});

export type AnswerInput = z.infer<typeof answerSchema>;
export const validateAnswer = validateBody(answerSchema);