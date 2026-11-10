import { currentUser } from "../middleware/verifyToken";
import * as dashboard from "../models/dashboard.model";
import { asyncHandler } from "../utils/asyncHandler";

// GET /api/dashboard
export const summary = asyncHandler(async (_req, res) => {
  const user = currentUser(res);
  res.success(await dashboard.getSummary(user.id), "Ringkasan dashboard berhasil diambil");
});