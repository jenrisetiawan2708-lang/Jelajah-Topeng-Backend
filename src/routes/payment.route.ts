import { Router } from "express";
import * as controller from "../controllers/payment.controller";
import { requireAdmin, verifyToken } from "../middleware/verifyToken";
import { validateCheckout } from "../validators/payment.validator";

const router = Router();

// Webhook Midtrans: PUBLIK (tanpa token), diamankan lewat signature_key.
// Harus dideklarasikan SEBELUM router.use(verifyToken).
router.post("/notification", controller.handleNotification);

router.use(verifyToken, requireAdmin);

router.get("/", controller.list);
router.post("/checkout", validateCheckout, controller.checkout);
router.get("/:orderId/status", controller.syncStatus);

export default router;