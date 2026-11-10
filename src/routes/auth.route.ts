import { Router } from "express";
import * as controller from "../controllers/auth.controller";
import { validateLogin, validateRegister } from "../validators/auth.validator";

const router = Router();

// Publik: aplikasi mobile belum punya token saat daftar / login.
router.post("/register", validateRegister, controller.register);
router.post("/login", validateLogin, controller.login);

export default router;