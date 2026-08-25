/**
 * Screenshot / interaction driver for local verification.
 * Not part of the product build — a development aid.
 *
 *   npx tsx scripts/shot.mts <name> <path> [action]
 */
import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = "C:/temp/playhack-shots";

const [name, rawPath, action] = process.argv.slice(2);

// Git Bash rewrites a leading "/" into a Windows path before the arg ever
// reaches Node, so paths are passed without one and normalised here.
const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle2" });

const log: string[] = [];
page.on("console", (m) => {
  if (m.type() === "error") log.push(`console.error: ${m.text()}`);
});
page.on("pageerror", (e) => log.push(`pageerror: ${e.message}`));

if (action === "race-naive" || action === "race-safe") {
  const mode = action === "race-naive" ? "Naive" : "Safe";
  await page.evaluate((m) => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === m,
    );
    (btn as HTMLButtonElement)?.click();
  }, mode);
  await new Promise((r) => setTimeout(r, 300));

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Fire"),
    );
    (btn as HTMLButtonElement)?.click();
  });

  // Wait for the verdict banner to appear.
  await page
    .waitForFunction(
      () => document.body.innerText.includes("Per-request timeline"),
      { timeout: 90_000 },
    )
    .catch(() => log.push("timeout waiting for race result"));
  await new Promise((r) => setTimeout(r, 600));
}

if (action === "open-slot") {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Open"),
    );
    (btn as HTMLButtonElement)?.click();
  });
  await new Promise((r) => setTimeout(r, 500));
}

await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
console.log(`saved ${OUT}/${name}.png`);
if (log.length) console.log("PAGE ERRORS:\n" + log.join("\n"));
await browser.close();
