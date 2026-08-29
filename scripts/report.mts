/**
 * Render docs/report/playhack-explained.html to docs/PlayHack-Explained.pdf.
 * A real paginated PDF with selectable text — not images of pages.
 *
 *   npm run report
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SRC = path.resolve("docs/report/playhack-explained.html");
const OUT = path.resolve("docs/PlayHack-Explained.pdf");

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--allow-file-access-from-files"],
});
const page = await browser.newPage();
await page.goto(pathToFileURL(SRC).href, { waitUntil: "networkidle2" });
await page.evaluate(() => (document as Document & { fonts: FontFaceSet }).fonts.ready);
await new Promise((r) => setTimeout(r, 500));

const grey = "#837c73";
await page.pdf({
  path: OUT,
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: `<div style="font:400 7pt Inter,sans-serif;color:${grey};width:100%;padding:0 19mm;
     display:flex;justify-content:space-between;letter-spacing:.12em;text-transform:uppercase;">
     <span>PlayHack — Explained</span><span>Team InnovAIT · IIT Guwahati</span></div>`,
  footerTemplate: `<div style="font:400 7pt Inter,sans-serif;color:${grey};width:100%;padding:0 19mm;
     display:flex;justify-content:space-between;">
     <span>innovait-hackathon.vercel.app</span>
     <span class="pageNumber"></span></div>`,
  margin: { top: "21mm", bottom: "20mm", left: "19mm", right: "19mm" },
});
await browser.close();
console.log(`saved ${OUT}`);
