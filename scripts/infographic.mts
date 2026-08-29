/**
 * Render the README infographic from its HTML source.
 * Development aid, not part of the product build.
 *
 *   npx tsx scripts/infographic.mts
 *
 * The source is committed alongside the PNG so the graphic can be corrected
 * later without anyone having to reverse-engineer a bitmap.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SRC = path.resolve("docs/infographic/how-it-decides.html");
const OUT = path.resolve("docs/media/how-it-decides.png");

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(SRC).href, { waitUntil: "networkidle2" });

// Webfonts, then the inline script that draws the traces.
await page.evaluate(() => (document as Document & { fonts: FontFaceSet }).fonts.ready);
await new Promise((r) => setTimeout(r, 600));

await page.screenshot({ path: OUT as `${string}.png` });
console.log(`saved ${OUT}`);
await browser.close();
