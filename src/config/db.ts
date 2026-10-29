import mysql, { type PoolConnection } from "mysql2/promise";
import { env } from "./env";

// Connection pool (PPT 7): koneksi standby, sistem pinjam-kembalikan.
export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
  timezone: "Z", // Date dibaca/ditulis sebagai UTC
});

export async function checkDb() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

// Transaction (PPT 7): BEGIN -> COMMIT kalau semua berhasil, ROLLBACK kalau ada yang gagal.
export async function withTransaction<T>(
  work: (conn: PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}