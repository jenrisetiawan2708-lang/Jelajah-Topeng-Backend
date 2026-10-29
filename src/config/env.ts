import "dotenv/config";
import { z } from "zod";

// Semua konfigurasi dibaca dari .env (PPT 7: jangan tulis kredensial di source code)
const schema = z.object({
  PORT: z.coerce.number().default(5050),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET minimal 32 karakter"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  APP_BASE_URL: z.string().default("http://localhost:3000"),
  MIDTRANS_SERVER_KEY: z.string().default(""),
  MIDTRANS_IS_PRODUCTION: z.enum(["true", "false"]).default("false"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Konfigurasi .env tidak valid:");
  for (const issue of parsed.error.issues) {
    console.error(`- ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = {
  ...parsed.data,
  midtransIsProduction: parsed.data.MIDTRANS_IS_PRODUCTION === "true",
};