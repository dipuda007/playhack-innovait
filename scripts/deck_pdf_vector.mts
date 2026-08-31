/**
 * Render docs/deck/deck.html to docs/PlayHack.pdf as a VECTOR deck.
 *
 * The previous deck PDF was sixteen full-bleed PNGs, so it resampled — and
 * looked soft — whenever a reader zoomed or fitted it to a window. Chrome's
 * print pipeline emits real text runs and embedded fonts instead, so it is
 * sharp at any magnification, searchable, and roughly a twentieth the size.
 *
 *   npm run deck:pdf
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SRC = path.resolve("docs/deck/deck.html");
const OUT = path.resolve("docs/PlayHack.pdf");

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--allow-file-access-from-files"],
});
const page = await browser.newPage();
await page.goto(pathToFileURL(SRC).href, { waitUntil: "networkidle2" });
await page.evaluate(() => (document as Document & { fonts: FontFaceSet }).fonts.ready);
await new Promise((r) => setTimeout(r, 700));

await page.pdf({
  path: OUT,
  width: "1600px",
  height: "900px",
  printBackground: true,
  pageRanges: "1-15",
  margin: { top: "0", bottom: "0", left: "0", right: "0" },
});
await browser.close();
console.log(`saved ${OUT}`);
