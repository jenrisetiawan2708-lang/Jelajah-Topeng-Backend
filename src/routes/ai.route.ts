import { Router } from "express";
import * as controller from "../controllers/ai.controller";
import { verifyToken } from "../middleware/verifyToken";
import { validateAsk } from "../validators/ai.validator";

const router = Router();

// Semua rute AI wajib login (token JWT).
router.use(verifyToken);

router.post("/ask", validateAsk, controller.ask);
router.get("/history", controller.history);

export default router;