import { sql } from "drizzle-orm";
import { pool } from "../config/db";
import { orm } from "../db/orm";

async function main() {
  const result = await orm.execute(sql`SELECT 1 AS ok`);
  console.log("ORM terhubung lewat pool:", JSON.stringify(result[0]));
  await pool.end();
}

main().catch((error) => {
  console.error("ORM gagal:", error);
  process.exit(1);
});