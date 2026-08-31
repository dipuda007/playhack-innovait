/**
 * Render each slide of docs/deck/deck.html to a PNG, then hand off to
 * scripts/deck.py to assemble docs/PlayHack.pptx.
 *
 *   npm run deck
 */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SRC = path.resolve("docs/deck/deck.html");
const OUT = path.resolve("docs/deck/slides");

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2.4 });  // 3840x2160 per slide
await page.goto(pathToFileURL(SRC).href, { waitUntil: "networkidle2" });
await page.evaluate(() => (document as Document & { fonts: FontFaceSet }).fonts.ready);
await new Promise((r) => setTimeout(r, 700));

const slides = await page.$$("section.slide");
console.log(`${slides.length} slides`);
for (let i = 0; i < slides.length; i++) {
  const n = String(i + 1).padStart(2, "0");
  await slides[i]!.screenshot({ path: path.join(OUT, `slide-${n}.png`) as `${string}.png` });
  process.stdout.write(`  slide-${n}.png\n`);
}
await browser.close();
