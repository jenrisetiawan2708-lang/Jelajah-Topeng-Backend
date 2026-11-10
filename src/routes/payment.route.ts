import { Router } from "express";
import * as controller from "../controllers/payment.controller";
import { requireAdmin, verifyToken } from "../middleware/verifyToken";
import { validateCheckout } from "../validators/payment.validator";

const router = Router();

// Webhook Midtrans: PUBLIK (tanpa token), diamankan lewat signature_key.
// Harus dideklarasikan SEBELUM router.use(verifyToken).
router.post("/notification", controller.handleNotification);

// Semua route di bawah ini wajib login (pengunjung dari mobile atau admin).
router.use(verifyToken);

router.post("/checkout", validateCheckout, controller.checkout);
router.get("/mine", controller.mine);
router.get("/:orderId/status", controller.syncStatus);

// Khusus admin (dashboard web).
router.get("/", requireAdmin, controller.list);
router.delete("/:orderId", requireAdmin, controller.remove);

export default router;