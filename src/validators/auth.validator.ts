import { z } from "zod";
import { validateBody } from "./validate";

const LETTERS_ONLY = /^[\p{L}\s.,'’-]+$/u;

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter")
    .refine((v) => !/\d/.test(v), "Nama tidak boleh mengandung angka")
    .refine((v) => LETTERS_ONLY.test(v), "Nama hanya boleh berisi huruf"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160, "Email maksimal 160 karakter")
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Format email tidak valid"),
  password: z
    .string()
    .min(8, "Kata sandi minimal 8 karakter")
    .max(100, "Kata sandi maksimal 100 karakter"),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Email wajib diisi"),
  password: z.string().min(1, "Kata sandi wajib diisi"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const validateRegister = validateBody(registerSchema);
export const validateLogin = validateBody(loginSchema);