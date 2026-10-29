import jwt from "jsonwebtoken";
import { env } from "../config/env";

const token = jwt.sign({ email: "admin@test.local", role: "admin" }, env.JWT_SECRET, {
  subject: "dev-admin-1",
  expiresIn: "1h",
  algorithm: "HS256",
});

console.log(token);