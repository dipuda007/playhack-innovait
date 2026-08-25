/**
 * Seeds demo data: IIT Guwahati facilities, a cohort of students, and enough
 * realistic existing bookings that the availability grid looks like a live
 * campus rather than an empty spreadsheet.
 *
 * Deliberately leaves the headline peak slots on a few courts OPEN so the race
 * demo has somewhere to fight over.
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL!;
const local = url.includes("localhost") || url.includes("127.0.0.1");
const sql = postgres(url, { max: 4, ssl: local ? false : "require", onnotice: () => {} });

const FACILITIES = [
  {
    slug: "badminton-sac-1", name: "Badminton Court 1", sport: "Badminton",
    location: "Students' Activity Centre", capacity: 4, slot: 60,
    opens: "06:00", closes: "22:00", peak: "17:00",
    color: "#22c55e", emoji: "🏸",
    description: "Wooden court with synthetic overlay. Shuttles not provided.",
  },
  {
    slug: "badminton-sac-2", name: "Badminton Court 2", sport: "Badminton",
    location: "Students' Activity Centre", capacity: 4, slot: 60,
    opens: "06:00", closes: "22:00", peak: "17:00",
    color: "#22c55e", emoji: "🏸",
    description: "Second indoor court, identical surface to Court 1.",
  },
  {
    slug: "tennis-court-a", name: "Tennis Court A", sport: "Tennis",
    location: "Sports Complex, near Lohit", capacity: 4, slot: 60,
    opens: "06:00", closes: "21:00", peak: "17:00",
    color: "#eab308", emoji: "🎾",
    description: "Floodlit hard court. Evening slots go fast.",
  },
  {
    slug: "basketball-court", name: "Basketball Court", sport: "Basketball",
    location: "Outdoor Sports Area", capacity: 10, slot: 60,
    opens: "06:00", closes: "22:00", peak: "18:00",
    color: "#f97316", emoji: "🏀",
    description: "Full-size outdoor court with floodlights.",
  },
  {
    slug: "football-ground", name: "Football Ground", sport: "Football",
    location: "Main Field", capacity: 22, slot: 90,
    opens: "06:00", closes: "20:00", peak: "16:30",
    color: "#10b981", emoji: "⚽",
    description: "Full-size grass pitch. 90-minute slots.",
  },
  {
    slug: "cricket-ground", name: "Cricket Ground", sport: "Cricket",
    location: "Main Field, east end", capacity: 22, slot: 90,
    opens: "06:00", closes: "19:00", peak: "15:30",
    color: "#06b6d4", emoji: "🏏",
    description: "Turf wicket with practice nets alongside.",
  },
  {
    slug: "volleyball-court", name: "Volleyball Court", sport: "Volleyball",
    location: "Outdoor Sports Area", capacity: 12, slot: 60,
    opens: "06:00", closes: "21:00", peak: "17:00",
    color: "#8b5cf6", emoji: "🏐",
    description: "Sand court beside the basketball area.",
  },
  {
    slug: "squash-court", name: "Squash Court", sport: "Squash",
    location: "Students' Activity Centre", capacity: 2, slot: 45,
    opens: "06:00", closes: "22:00", peak: "18:00",
    color: "#ec4899", emoji: "🎯",
    description: "Air-conditioned glass-back court. 45-minute slots.",
  },
  {
    slug: "table-tennis", name: "Table Tennis Hall", sport: "Table Tennis",
    location: "Students' Activity Centre", capacity: 4, slot: 45,
    opens: "06:00", closes: "22:00", peak: "18:00",
    color: "#3b82f6", emoji: "🏓",
    description: "Four tables. Bookings are per hall session.",
  },
  {
    slug: "swimming-pool", name: "Swimming Pool", sport: "Swimming",
    location: "Sports Complex", capacity: 20, slot: 60,
    opens: "06:00", closes: "20:00", peak: "17:00",
    color: "#0ea5e9", emoji: "🏊",
    description: "25 m pool. Lifeguard on duty during all bookable slots.",
  },
  {
    slug: "gymnasium", name: "Gymnasium", sport: "Fitness",
    location: "Sports Complex, ground floor", capacity: 30, slot: 60,
    opens: "05:30", closes: "22:00", peak: "18:00",
    color: "#ef4444", emoji: "🏋️",
    description: "Free weights, machines and cardio floor.",
  },
  {
    slug: "athletics-track", name: "Athletics Track", sport: "Athletics",
    location: "Main Field perimeter", capacity: 40, slot: 60,
    opens: "05:30", closes: "20:00", peak: "17:00",
    color: "#a855f7", emoji: "🏃",
    description: "400 m eight-lane synthetic track.",
  },
];

const FIRST = [
  "Aarav", "Ananya", "Rohan", "Priya", "Ishaan", "Diya", "Arjun", "Meera",
  "Kabir", "Sneha", "Vivaan", "Riya", "Aditya", "Tara", "Karan", "Nikita",
  "Rahul", "Anjali", "Siddharth", "Pooja", "Dev", "Kavya", "Manav", "Sanya",
  "Yash", "Isha", "Nikhil", "Aditi", "Varun", "Shreya", "Aman", "Neha",
  "Rudra", "Trisha", "Kunal", "Ira", "Advait", "Myra", "Parth", "Saanvi",
  "Jai", "Naina", "Om", "Kiara", "Reyansh", "Aarohi", "Vihaan", "Anvi",
  "Krish", "Zara", "Atharv", "Prisha", "Ayush", "Navya", "Rian", "Mahi",
  "Dhruv", "Ridhi", "Samar", "Bhavya", "Aryan", "Lavanya", "Tanish", "Amaira",
]
const LAST = [
  "Sharma", "Verma", "Nair", "Iyer", "Das", "Bora", "Saikia", "Gogoi",
  "Reddy", "Patel", "Bose", "Chatterjee", "Rao", "Menon", "Kalita", "Deka",
  "Barua", "Hazarika", "Dutta", "Baishya", "Phukan", "Mahanta", "Sarma", "Choudhury",
  "Ghosh", "Mukherjee", "Banerjee", "Sen", "Pillai", "Krishnan", "Joshi", "Desai",
]
const HOSTELS = [
  "Brahmaputra", "Lohit", "Kapili", "Manas", "Dihing", "Umiam",
  "Barak", "Siang", "Kameng", "Dhansiri", "Subansiri",
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

/** IST date key for `offset` days from today. */
function dayKey(offset: number): string {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

function ist(dateKey: string, time: string): Date {
  return new Date(`${dateKey}T${time}:00+05:30`);
}

async function main() {
  console.log("· clearing demo data");
  await sql`TRUNCATE race_attempts, naive_bookings, lottery_entries, lotteries,
                     booking_events, waitlist, bookings, facilities, users
            RESTART IDENTITY CASCADE`;

  console.log("· facilities");
  const facilityIds = new Map<string, string>();
  for (const f of FACILITIES) {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO facilities
        (slug, name, sport, location, description, capacity,
         opens_at, closes_at, slot_minutes, peak_from, color, emoji)
      VALUES (${f.slug}, ${f.name}, ${f.sport}, ${f.location}, ${f.description},
              ${f.capacity}, ${f.opens}, ${f.closes}, ${f.slot}, ${f.peak},
              ${f.color}, ${f.emoji})
      RETURNING id
    `;
    facilityIds.set(f.slug, row.id);
  }
  console.log(`  ${FACILITIES.length} facilities`);

  console.log("· users");
  const userIds: string[] = [];

  // A stable demo identity, so the walkthrough always starts as the same person.
  const [demo] = await sql<{ id: string }[]>`
    INSERT INTO users (email, name, roll_number, hostel, role, reliability_score)
    VALUES ('demo@iitg.ac.in', 'Demo Student', '230101001', 'Brahmaputra',
            'student', 100)
    RETURNING id
  `;
  userIds.push(demo.id);

  const [manager] = await sql<{ id: string }[]>`
    INSERT INTO users (email, name, hostel, role, weekly_quota)
    VALUES ('sportsoffice@iitg.ac.in', 'Sports Office', 'Sports Complex',
            'manager', 100)
    RETURNING id
  `;

  // 200 students: enough that a 200-way race is 200 distinct people
  // rather than the same handful cycled, which would weaken the demo.
  for (let i = 0; i < 200; i++) {
    // FIRST has 64 entries and LAST has 32; stepping the surname every time
    // the given-name list wraps walks the 2048-pair grid without repeating a
    // pair. Three students called "Aarav Sharma" in a demo reads as fake data
    // and makes the race waterfall impossible to follow.
    const firstName = FIRST[i % FIRST.length];
    const lastName = LAST[(Math.floor(i / FIRST.length) + i * 7) % LAST.length];
    const name = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@iitg.ac.in`;
    // Spread reliability so the fair-draw weighting has something to chew on.
    const reliability = 60 + ((i * 17) % 41);
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO users (email, name, roll_number, hostel, reliability_score)
      VALUES (${email}, ${name}, ${`23${(101001 + i).toString()}`},
              ${pick(HOSTELS, i * 5)}, ${reliability})
      RETURNING id
    `;
    userIds.push(row.id);
  }
  console.log(`  ${userIds.length} students + 1 manager`);

  console.log("· existing bookings");
  let placed = 0;
  let skipped = 0;
  let seq = 0;

  // Busy-but-not-full: roughly 45% occupancy, weighted towards evenings, so
  // the grid reads as a real campus. Peak slots on badminton and tennis are
  // deliberately left alone — the race demo needs a contested empty slot.
  const RESERVED_FOR_DEMO = new Set(["badminton-sac-1", "tennis-court-a"]);

  for (let day = 0; day < 7; day++) {
    const key = dayKey(day);
    for (const f of FACILITIES) {
      const fid = facilityIds.get(f.slug)!;
      const openH = Number(f.opens.split(":")[0]);
      const openM = Number(f.opens.split(":")[1]);
      const closeH = Number(f.closes.split(":")[0]);
      const total = Math.floor(((closeH * 60) - (openH * 60 + openM)) / f.slot);

      for (let s = 0; s < total; s++) {
        const startMin = openH * 60 + openM + s * f.slot;
        const hh = Math.floor(startMin / 60);
        const mm = startMin % 60;
        const start = ist(key, `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
        const end = new Date(start.getTime() + f.slot * 60_000);

        if (start.getTime() < Date.now()) continue;

        const peakHour = Number(f.peak.split(":")[0]);
        const isPeak = hh >= peakHour;
        if (RESERVED_FOR_DEMO.has(f.slug) && isPeak && day <= 1) continue;

        // Deterministic pseudo-random so reseeding produces the same demo.
        seq++;
        const roll = (seq * 2654435761) % 100;
        const threshold = isPeak ? 70 : 32;
        if (roll >= threshold) continue;

        const uid = userIds[(seq * 13) % userIds.length];
        try {
          await sql`
            INSERT INTO bookings
              (facility_id, user_id, during, idempotency_key, party_size)
            VALUES (${fid}, ${uid},
                    tstzrange(${start}, ${end}, '[)'),
                    ${`seed-${seq}`},
                    ${1 + (seq % Math.min(f.capacity, 4))})
          `;
          placed++;
        } catch {
          // The constraint is doing its job even during seeding.
          skipped++;
        }
      }
    }
  }
  console.log(`  ${placed} bookings placed, ${skipped} rejected by the constraint`);

  console.log("· maintenance blocks");
  // Closures are bookings with kind='block' — same table, same invariant.
  const blocks: [string, number, string, string, string][] = [
    ["swimming-pool", 2, "06:00", "08:00", "Weekly chlorination"],
    ["tennis-court-a", 3, "12:00", "14:00", "Surface repainting"],
    ["football-ground", 4, "06:00", "09:00", "Inter-hostel league fixture"],
  ];
  for (const [slug, day, from, to, why] of blocks) {
    const fid = facilityIds.get(slug)!;
    const key = dayKey(day);
    try {
      await sql`
        INSERT INTO bookings
          (facility_id, user_id, kind, during, idempotency_key, note)
        VALUES (${fid}, NULL, 'block',
                tstzrange(${ist(key, from)}, ${ist(key, to)}, '[)'),
                ${`block-${slug}-${day}`}, ${why})
      `;
    } catch { /* overlaps an existing seed booking; fine to skip */ }
  }

  console.log("· waitlist entries");
  // Queue a few students behind already-full peak slots.
  const busy = await sql<{ facility_id: string; starts_at: string; ends_at: string }[]>`
    SELECT facility_id, lower(during) AS starts_at, upper(during) AS ends_at
    FROM bookings
    WHERE status = 'confirmed' AND kind = 'booking' AND lower(during) > now()
    ORDER BY lower(during)
    LIMIT 6
  `;
  let queued = 0;
  for (let i = 0; i < busy.length; i++) {
    const b = busy[i];
    for (let k = 0; k < 2; k++) {
      const uid = userIds[(i * 7 + k * 3 + 5) % userIds.length];
      try {
        await sql`
          INSERT INTO waitlist (facility_id, user_id, during)
          VALUES (${b.facility_id}, ${uid},
                  tstzrange(${b.starts_at}::timestamptz, ${b.ends_at}::timestamptz, '[)'))
        `;
        queued++;
      } catch { /* already queued */ }
    }
  }
  console.log(`  ${queued} waitlist entries`);

  console.log("· history for analytics");
  // Past bookings, some marked no-show, so the analytics page and the
  // reliability score have real numbers behind them.
  let past = 0;
  for (let day = 1; day <= 14; day++) {
    const key = dayKey(-day);
    for (const f of FACILITIES) {
      const fid = facilityIds.get(f.slug)!;
      for (let s = 0; s < 12; s++) {
        seq++;
        const roll = (seq * 40503) % 100;
        if (roll >= 55) continue;
        const hh = 7 + s;
        if (hh >= Number(f.closes.split(":")[0])) continue;
        const start = ist(key, `${String(hh).padStart(2, "0")}:00`);
        const end = new Date(start.getTime() + f.slot * 60_000);
        const noShow = (seq * 7717) % 100 < 12;
        const uid = userIds[(seq * 11) % userIds.length];
        try {
          await sql`
            INSERT INTO bookings
              (facility_id, user_id, during, idempotency_key, status)
            VALUES (${fid}, ${uid}, tstzrange(${start}, ${end}, '[)'),
                    ${`hist-${seq}`},
                    ${noShow ? "no_show" : "completed"})
          `;
          past++;
          if (noShow) {
            await sql`
              UPDATE users SET reliability_score = greatest(0, reliability_score - 3)
              WHERE id = ${uid}
            `;
          }
        } catch { /* overlap in history is harmless to skip */ }
      }
    }
  }
  console.log(`  ${past} historical bookings`);

  const [{ count }] = await sql<{ count: number }[]>`
    SELECT count(*)::int FROM bookings WHERE status = 'confirmed'
  `;
  console.log(`\n✓ seeded · ${count} live bookings across ${FACILITIES.length} facilities`);
  console.log(`  demo login: demo@iitg.ac.in`);
  console.log(`  manager login: sportsoffice@iitg.ac.in (id ${manager.id.slice(0, 8)}…)`);

  await sql.end();
}

main().catch(async (e) => {
  console.error("✗ seed failed:", e);
  await sql.end();
  process.exit(1);
});
