import { sql } from "drizzle-orm";
import { pool } from "../config/db";
import { orm } from "../db/orm";
import { payments } from "../db/schema";

async function main() {
  const ping = await orm.execute(sql`SELECT 1 AS ok`);
  console.log("ORM terhubung lewat pool:", JSON.stringify(ping[0]));

  const rows = await orm.select().from(payments).limit(3);
  console.log("Query lewat skema payments, contoh baris:", rows.length);
  for (const r of rows) {
    console.log(" -", r.orderId, r.status, r.amount, r.createdAt.toISOString());
  }
  await pool.end();
}

main().catch((error) => {
  console.error("ORM gagal:", error);
  process.exit(1);
});