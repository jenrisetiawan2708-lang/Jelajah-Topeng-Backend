import { pool } from "../config/db";
import * as auth from "../services/auth.service";

async function main() {
  const [name, email] = process.argv.slice(2);
  const password = process.env.ADMIN_PASSWORD ?? "";

  if (!name || !email || !password) {
    console.error(
      'Pemakaian: $env:ADMIN_PASSWORD="kata-sandi" ; npm run admin:create -- "Nama Admin" email@contoh.com',
    );
    process.exit(1);
  }

  const user = await auth.createAdmin(name, email, password);
  console.log(`Admin dibuat: ${user.email} (id ${user.id})`);
}

main()
  .catch((error) => {
    console.error("Gagal membuat admin:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());