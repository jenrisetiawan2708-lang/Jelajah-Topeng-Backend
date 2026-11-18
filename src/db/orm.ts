import { drizzle } from "drizzle-orm/mysql2";
import { pool } from "../config/db";
import * as schema from "./schema";

// ORM Drizzle memakai pool mysql2 yang sama dengan config/db.ts (singleton):
// satu pool untuk seluruh aplikasi, koneksi dipinjam dan dikembalikan otomatis.
export const orm = drizzle(pool, { schema, mode: "default" });