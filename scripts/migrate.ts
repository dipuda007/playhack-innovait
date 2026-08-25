/**
 * Applies migrations/*.sql in filename order.
 *
 * Every migration is written to be re-runnable (IF NOT EXISTS / duplicate_object
 * guards), so this is safe to run against an already-migrated database — which
 * matters for a hackathon demo where the deploy target gets migrated more than
 * once under time pressure.
 *
 *   npm run db:push            apply migrations
 *   npm run db:push -- --reset drop the schema first, then apply
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

const RESET = process.argv.includes("--reset");
const MIGRATIONS_DIR = join(process.cwd(), "migrations");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (copy .env.example)");

  const local = url.includes("localhost") || url.includes("127.0.0.1");
  const sql = postgres(url, {
    max: 1,
    ssl: local ? false : "require",
    onnotice: () => {},
  });

  try {
    if (RESET) {
      console.log("· dropping schema public");
      await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    }

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const body = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      process.stdout.write(`· ${file} `);
      await sql.unsafe(body);
      console.log("ok");
    }

    // Prove the one object the whole product depends on actually exists.
    // A migration that silently no-ops here would leave us demoing a lie.
    const [guard] = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap'
      ) AS exists
    `;

    if (!guard.exists) {
      throw new Error(
        "bookings_no_overlap constraint is missing — refusing to continue",
      );
    }

    console.log("\n✓ schema ready · bookings_no_overlap is ACTIVE");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("\n✗ migration failed:", err.message ?? err);
  process.exit(1);
});
