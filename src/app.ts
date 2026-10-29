import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { requestContext } from "./middleware/requestContext";
import { requireJson } from "./middleware/requireJson";
import { responseEnvelope } from "./middleware/responseEnvelope";
import api from "./routes";

const app = express();
app.disable("x-powered-by");

// URUTAN MIDDLEWARE MENENTUKAN HASIL (PPT 4)
app.use(helmet()); // header keamanan
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
  }),
);
app.use(requestContext); // req.id + header standar
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev")); // logging
app.use(responseEnvelope); // res.success / res.fail
app.use(requireJson); // cek Content-Type
app.use(express.json({ limit: "2mb" })); // req.body

app.use("/api", api); // modular routes

app.use(notFound); // 404
app.use(errorHandler); // error handler global, selalu paling akhir

export default app;