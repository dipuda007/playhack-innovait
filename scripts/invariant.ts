/**
 * Standalone invariant checker.
 *
 * Sweeps the entire bookings table for any pair of confirmed bookings that
 * overlap on the same facility. Exits non-zero if it finds one, so it can be
 * wired into CI or run against production as a smoke check.
 *
 *   npm run invariant
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL!;
const local = url.includes("localhost") || url.includes("127.0.0.1");
const sql = postgres(url, { max: 1, ssl: local ? false : "require", onnotice: () => {} });

async function main() {
  const [guard] = await sql<{ present: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap'
    ) AS present
  `;

  const [counts] = await sql<
    { confirmed: number; facilities: number; naive_rows: number }[]
  >`
    SELECT
      (SELECT count(*)::int FROM bookings WHERE status = 'confirmed') AS confirmed,
      (SELECT count(*)::int FROM facilities) AS facilities,
      (SELECT count(*)::int FROM naive_bookings) AS naive_rows
  `;

  // Every confirmed row against every other confirmed row on the same court.
  const overlaps = await sql<
    {
      facility: string;
      a_code: string;
      b_code: string;
      a_range: string;
      b_range: string;
    }[]
  >`
    SELECT f.name AS facility,
           a.booking_code AS a_code, b.booking_code AS b_code,
           a.during::text AS a_range, b.during::text AS b_range
    FROM bookings a
    JOIN bookings b
      ON a.facility_id = b.facility_id AND a.id < b.id AND a.during && b.during
    JOIN facilities f ON f.id = a.facility_id
    WHERE a.status = 'confirmed' AND b.status = 'confirmed'
    LIMIT 20
  `;

  const [naive] = await sql<{ overlaps: number }[]>`
    SELECT count(*)::int AS overlaps
    FROM naive_bookings a
    JOIN naive_bookings b
      ON a.facility_id = b.facility_id AND a.id < b.id AND a.during && b.during
    WHERE a.status = 'confirmed' AND b.status = 'confirmed'
  `;

  console.log("\nPlayHack · invariant check");
  console.log("──────────────────────────────────────────────");
  console.log(`constraint bookings_no_overlap : ${guard.present ? "PRESENT" : "MISSING"}`);
  console.log(`confirmed bookings scanned     : ${counts.confirmed.toLocaleString()}`);
  console.log(`facilities                     : ${counts.facilities}`);
  console.log(`overlapping confirmed pairs    : ${overlaps.length}`);

  if (counts.naive_rows > 0) {
    console.log(
      `\nnaive_bookings (control group) : ${counts.naive_rows} rows, ` +
        `${naive.overlaps} overlapping pairs`,
    );
  }

  if (!guard.present) {
    console.error("\n✗ the constraint is missing — the invariant is unenforced");
    await sql.end();
    process.exit(1);
  }

  if (overlaps.length > 0) {
    console.error("\n✗ INVARIANT VIOLATED\n");
    for (const o of overlaps) {
      console.error(`  ${o.facility}: ${o.a_code} ${o.a_range}`);
      console.error(`  ${" ".repeat(o.facility.length)}  ${o.b_code} ${o.b_range}\n`);
    }
    await sql.end();
    process.exit(1);
  }

  console.log("\n✓ INVARIANT HOLDS — zero overlapping confirmed bookings\n");
  await sql.end();
}

main().catch(async (e) => {
  console.error("✗ check failed:", e);
  await sql.end();
  process.exit(1);
});
