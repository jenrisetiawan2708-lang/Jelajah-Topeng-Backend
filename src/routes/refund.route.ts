import { Router } from "express";
import * as controller from "../controllers/refund.controller";
import { requireAdmin, verifyToken } from "../middleware/verifyToken";
import { validateRefundDecision } from "../validators/refund.validator";

const router = Router();

router.use(verifyToken, requireAdmin);

router.get("/", controller.list);
// Multiple callback (PPT 5): validator dulu, baru controller.
router.patch("/:id/decision", validateRefundDecision, controller.decide);

export default router;