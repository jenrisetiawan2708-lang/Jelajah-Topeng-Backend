import { Router } from "express";
import * as controller from "../controllers/content.controller";
import { verifyToken } from "../middleware/verifyToken";
import { validateAnswer } from "../validators/content.validator";

const router = Router();

// Wajib login (admin atau pengunjung mobile). Hanya baca, kecuali cek jawaban.
router.use(verifyToken);

router.get("/", controller.listAll);
router.post("/panji/:id/answer", validateAnswer, controller.answerPanji);
router.get("/:kind", controller.listByKind);

export default router;