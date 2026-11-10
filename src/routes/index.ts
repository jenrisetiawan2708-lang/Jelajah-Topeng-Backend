import { Router } from "express";
import { checkDb } from "../config/db";
import { asyncHandler } from "../utils/asyncHandler";
import authRoute from "./auth.route";
import dashboardRoute from "./dashboard.route";
import paymentRoute from "./payment.route";
import recordRoute from "./record.route";
import refundRoute from "./refund.route";

const api = Router();

api.get(
  "/health",
  asyncHandler(async (_req, res) => {
    await checkDb();
    res.success({ status: "ok", uptime: Math.round(process.uptime()) }, "API sehat");
  }),
);

api.use("/auth", authRoute);
api.use("/records", recordRoute);
api.use("/refunds", refundRoute);
api.use("/payments", paymentRoute);
api.use("/dashboard", dashboardRoute);

export default api;