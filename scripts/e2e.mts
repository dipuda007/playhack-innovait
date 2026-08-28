/**
 * Browser smoke test for the core student journey.
 * Development aid, not part of the product build.
 *
 *   npx tsx scripts/e2e.mts
 */
import puppeteer, { type Page } from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
// Point at a deployment with E2E_BASE to smoke-test what is actually live.
const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const OUT = "C:/temp/playhack-shots";

const results: { step: string; ok: boolean; detail: string }[] = [];
function check(step: string, ok: boolean, detail = "") {
  results.push({ step, ok, detail });
  console.log(`${ok ? "  ok " : "FAIL "} ${step}${detail ? ` — ${detail}` : ""}`);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

const page: Page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000 });

const pageErrors: string[] = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon")) {
    pageErrors.push(m.text());
  }
});

// Tomorrow, so the grid has future slots.
const tomorrow = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(Date.now() + 86_400_000));

console.log("\nPlayHack · browser smoke test\n──────────────────────────────");

// ── 1. Browse ────────────────────────────────────────────────────────
await page.goto(`${BASE}/?date=${tomorrow}`, { waitUntil: "networkidle2" });
const cardCount = await page.$$eval("a[href^='/facility/']", (a) => a.length);
check("browse page lists facilities", cardCount >= 10, `${cardCount} cards`);

// ── 2. Facility slot grid ────────────────────────────────────────────
await page.goto(`${BASE}/facility/badminton-sac-1?date=${tomorrow}`, {
  waitUntil: "networkidle2",
});

const freeBefore = await page.$$eval("button", (btns) =>
  btns.filter((b) => b.textContent?.includes("Open")).length,
);
check("slot grid renders open slots", freeBefore > 0, `${freeBefore} open`);

// ── 3. Open the booking sheet ────────────────────────────────────────
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Open"),
  );
  (btn as HTMLButtonElement)?.click();
});
await page.waitForSelector("[role='dialog']", { timeout: 10_000 });

const sheetText = await page.$eval("[role='dialog']", (d) => d.textContent ?? "");
check("booking sheet opens", sheetText.includes("Confirm booking"));
check(
  "sheet shows an idempotency key",
  /Idempotency key/.test(sheetText),
  sheetText.match(/Idempotency key (\S+)/)?.[1] ?? "",
);
await page.screenshot({ path: `${OUT}/e2e_sheet.png` });

// ── 4. Confirm ───────────────────────────────────────────────────────
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("[role='dialog'] button")].find(
    (b) => b.textContent?.trim() === "Confirm booking",
  );
  (btn as HTMLButtonElement)?.click();
});

await page
  .waitForFunction(
    () => /PH-\d{5}/.test(document.querySelector("[role='dialog']")?.textContent ?? ""),
    { timeout: 20_000 },
  )
  .catch(() => {});

const confirmText = await page.$eval("[role='dialog']", (d) => d.textContent ?? "");
const code = confirmText.match(/PH-\d{5}/)?.[0];
check("booking confirmed with a code", Boolean(code), code ?? confirmText.slice(0, 90));
await page.screenshot({ path: `${OUT}/e2e_confirmed.png` });

// ── 5. Booking appears in My bookings ────────────────────────────────
await page.goto(`${BASE}/bookings`, { waitUntil: "networkidle2" });
const bookingsText = await page.evaluate(() => document.body.innerText);
check(
  "booking shows in My bookings",
  Boolean(code) && bookingsText.includes(code!),
  code ?? "",
);
await page.screenshot({ path: `${OUT}/e2e_bookings.png`, fullPage: true });

// ── 6. The slot is now mine on the grid ──────────────────────────────
await page.goto(`${BASE}/facility/badminton-sac-1?date=${tomorrow}`, {
  waitUntil: "networkidle2",
});
const gridText = await page.evaluate(() => document.body.innerText);
check("grid marks the slot as mine", Boolean(code) && gridText.includes(code!));

// ── 7. Cancel it again ───────────────────────────────────────────────
await page.goto(`${BASE}/bookings`, { waitUntil: "networkidle2" });

// Target THIS booking's row. The page lists every upcoming booking, so
// clicking the first "Cancel" on the page cancels whichever one happens to
// sort first — which is how this test failed the first time, blaming the
// cancel path for a bug in the test.
const rowFound = await page.evaluate((bookingCode) => {
  const row = [...document.querySelectorAll("div")].find(
    (d) =>
      d.textContent?.includes(bookingCode) &&
      [...d.querySelectorAll("button")].some(
        (b) => b.textContent?.trim() === "Cancel",
      ) &&
      // innermost matching container
      ![...d.querySelectorAll("div")].some((c) =>
        c.textContent?.includes(bookingCode),
      ),
  );
  if (!row) return false;
  const btn = [...row.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === "Cancel",
  );
  (btn as HTMLButtonElement)?.click();
  return true;
}, code!);
check("found this booking's cancel control", rowFound);

await new Promise((r) => setTimeout(r, 400));
await page.evaluate((bookingCode) => {
  const row = [...document.querySelectorAll("div")].find(
    (d) =>
      d.textContent?.includes(bookingCode) &&
      [...d.querySelectorAll("button")].some(
        (b) => b.textContent?.trim() === "Confirm",
      ),
  );
  const btn = [...(row ?? document).querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === "Confirm",
  );
  (btn as HTMLButtonElement)?.click();
}, code!);
await new Promise((r) => setTimeout(r, 2000));
await page.goto(`${BASE}/bookings`, { waitUntil: "networkidle2" });
const afterCancel = await page.evaluate(() => document.body.innerText);
const upcomingSection = afterCancel.split("History")[0];
check(
  "cancellation removes it from upcoming",
  Boolean(code) && !upcomingSection.includes(code!),
  code && upcomingSection.includes(code) ? "still listed as upcoming" : "",
);

// The freed slot must be immediately bookable again — the partial index
// dropped the cancelled row, so availability recovers with no cleanup job.
await page.goto(`${BASE}/facility/badminton-sac-1?date=${tomorrow}`, {
  waitUntil: "networkidle2",
});
const freeAfter = await page.$$eval("button", (btns) =>
  btns.filter((b) => b.textContent?.includes("Open")).length,
);
check(
  "cancelled slot returns to the grid as open",
  freeAfter === freeBefore,
  `${freeBefore} before, ${freeAfter} after`,
);

// ── 8. No client-side errors anywhere ────────────────────────────────
check(
  "no uncaught client errors",
  pageErrors.length === 0,
  pageErrors.slice(0, 2).join(" | "),
);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log("──────────────────────────────");
console.log(`${results.length - failed.length}/${results.length} passed\n`);
process.exit(failed.length === 0 ? 0 : 1);
