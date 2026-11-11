import * as auth from "../services/auth.service";
import type { LoginInput, RegisterInput } from "../validators/auth.validator";
import { asyncHandler } from "../utils/asyncHandler";

// POST /api/auth/register  (selalu berperan "user")
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body as RegisterInput;
  res.success(await auth.register(name, email, password), "Registrasi berhasil", 201);
});

// POST /api/auth/login  (admin dan pengunjung; peran ada di dalam token)
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body as LoginInput;
  res.success(await auth.login(email, password), "Login berhasil");
});