import { Router } from "express";
import * as controller from "../controllers/record.controller";
import { requireAdmin, verifyToken } from "../middleware/verifyToken";
import { validateRecord } from "../validators/record.validator";

const router = Router();

// Router-level middleware: semua rute di bawah ini wajib login + admin.
router.use(verifyToken, requireAdmin);

// Chainable route (PPT 5): satu path, beberapa method.
router.route("/").get(controller.list).post(validateRecord, controller.create);
router.route("/:id").put(validateRecord, controller.update).delete(controller.remove);

export default router;