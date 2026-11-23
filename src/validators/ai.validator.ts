import { z } from "zod";
import { validateBody } from "./validate";

const askSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, "Pertanyaan minimal 3 karakter")
    .max(500, "Pertanyaan maksimal 500 karakter"),
});

export type AskInput = z.infer<typeof askSchema>;

export const validateAsk = validateBody(askSchema);