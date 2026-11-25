import { Router } from "express";
import * as controller from "../controllers/notification.controller";
import { requireAdmin, verifyToken } from "../middleware/verifyToken";

const router = Router();

router.use(verifyToken);

// Pengguna (app mobile)
router.get("/mine", controller.mine);
router.post("/:id/read", controller.markRead);

// Khusus admin (bell dashboard web)
router.get("/status", requireAdmin, controller.status);

export default router;