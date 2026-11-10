import { Router } from "express";
import * as controller from "../controllers/dashboard.controller";
import { requireAdmin, verifyToken } from "../middleware/verifyToken";

const router = Router();

router.use(verifyToken, requireAdmin);
router.get("/", controller.summary);

export default router;