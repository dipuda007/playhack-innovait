/**
 * Screenshot a deployed build. Development aid, not part of the product.
 *
 *   npx tsx scripts/shotprod.mts <name> <route>
 *
 * `route` is written WITHOUT a leading slash ("race", "facility/tennis-court-a",
 * or "root" for "/") because Git Bash rewrites a leading "/" into a Windows
 * path before the argument ever reaches Node.
 */
import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = "C:/temp/playhack-shots";
const BASE = process.env.SHOT_BASE ?? "https://innovait-hackathon.vercel.app";

const [name, rawRoute] = process.argv.slice(2);
const route = !rawRoute || rawRoute === "root" ? "" : rawRoute;
const width = Number(process.env.SHOT_WIDTH ?? 1440);
const height = Number(process.env.SHOT_HEIGHT ?? 1000);
const full = process.env.SHOT_FULL === "1";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1 });

const errors: string[] = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 160)}`);
});

// A preview deployment sits behind Vercel Authentication. Visiting the share
// link once sets the bypass cookie for the rest of the session.
if (process.env.SHOT_BYPASS) {
  await page.goto(`${BASE}/?_vercel_share=${process.env.SHOT_BYPASS}`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
}

await page.goto(`${BASE}/${route}`, { waitUntil: "networkidle2", timeout: 90_000 });
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });

console.log(`${OUT}/${name}.png`);
for (const e of errors) console.log("  " + e);
await browser.close();
