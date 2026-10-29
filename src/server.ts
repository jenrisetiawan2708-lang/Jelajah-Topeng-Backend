import app from "./app";
import { checkDb, pool } from "./config/db";
import { env } from "./config/env";

async function main() {
  await checkDb(); // gagal cepat kalau MySQL tidak bisa dihubungi
  console.log(`MySQL terhubung (${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME})`);

  const PORT = env.PORT;

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`API jalan di port ${PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(
    "Gagal menjalankan server:",
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});