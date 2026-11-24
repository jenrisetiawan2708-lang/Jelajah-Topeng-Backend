import { Router } from "express";
import * as controller from "../controllers/refund.controller";
import { requireAdmin, verifyToken } from "../middleware/verifyToken";
import { validateRefundCreate, validateRefundDecision } from "../validators/refund.validator";

const router = Router();

router.use(verifyToken);

// Pengunjung (app mobile). Harus SEBELUM requireAdmin.
router.post("/", validateRefundCreate, controller.create);
router.get("/mine", controller.mine);
router.get("/order/:orderId", controller.byOrder);

// Khusus admin (dashboard web).
router.use(requireAdmin);
router.get("/", controller.list);
// Multiple callback (PPT 5): validator dulu, baru controller.
router.patch("/:id/decision", validateRefundDecision, controller.decide);

export default router;