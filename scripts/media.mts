/**
 * Capture the README media: still screenshots and an animated GIF of the race
 * demo. Development aid, not part of the product build.
 *
 *   MEDIA_BASE=https://… npx tsx scripts/media.mts [shots|gif|all]
 *
 * The GIF is encoded from raw frames rather than recorded, because there is no
 * ffmpeg on this machine and because a palette-quantised GIF of a two-colour
 * broadsheet page is far smaller than any video of the same thing.
 */
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer-core";
import { PNG } from "pngjs";
/*
 * gifenc ships CJS with named properties, and its "module" build is ESM
 * without a default export map that tsx can destructure directly — the
 * createRequire route is the one that works under both.
 */
import { createRequire } from "node:module";
const { GIFEncoder, quantize, applyPalette } = createRequire(import.meta.url)("gifenc");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.MEDIA_BASE ?? "https://innovait-hackathon.vercel.app";
const OUT = path.resolve("docs/media");
const what = process.argv[2] ?? "all";

await fs.mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1"],
});

/** Wait for fonts and images so a shot never catches a half-painted page. */
async function settle(page: Page, ms = 900) {
  await page.evaluate(() => (document as Document & { fonts: FontFaceSet }).fonts.ready);
  await new Promise((r) => setTimeout(r, ms));
}

async function shot(
  name: string,
  route: string,
  opts: {
    width?: number; height?: number; full?: boolean; scrollTo?: number;
    /**
     * JPEG for the hero only. It is a photograph, and PNG stores a
     * photograph at roughly eight times the size for no visible gain in a
     * README rendered under 1000px wide.
     */
    jpeg?: boolean;
  } = {},
) {
  const page = await browser.newPage();
  await page.setViewport({
    width: opts.width ?? 1440,
    height: opts.height ?? 900,
    deviceScaleFactor: 2,
  });
  await page.goto(`${BASE}/${route}`, { waitUntil: "networkidle2", timeout: 90_000 });
  if (opts.scrollTo) await page.evaluate((y) => window.scrollTo(0, y), opts.scrollTo);
  await settle(page);
  const ext = opts.jpeg ? "jpg" : "png";
  const file = path.join(OUT, `${name}.${ext}`);
  await page.screenshot(
    opts.jpeg
      ? { path: file as `${string}.jpg`, type: "jpeg", quality: 86, fullPage: Boolean(opts.full) }
      : { path: file as `${string}.png`, fullPage: Boolean(opts.full) },
  );
  await page.close();
  const { size } = await fs.stat(file);
  console.log(`  ${name}.${ext}  ${Math.round(size / 1024)} KB`);
}

/** Click a button by its exact trimmed label. */
const clickLabel = (page: Page, label: string) =>
  page.evaluate((l) => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === l,
    );
    (btn as HTMLButtonElement)?.click();
    return Boolean(btn);
  }, label);

/** Click the first button whose label starts with `prefix` (e.g. "Fire "). */
const clickPrefix = (page: Page, prefix: string) =>
  page.evaluate((p) => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.trim().startsWith(p),
    );
    (btn as HTMLButtonElement)?.click();
    return Boolean(btn);
  }, prefix);

async function raceGif() {
  const W = 1100;
  const H = 700;
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/race`, { waitUntil: "networkidle2", timeout: 90_000 });
  await settle(page, 700);

  // Start below the masthead so the frame is all console and verdict.
  await page.evaluate(() => window.scrollTo(0, 470));
  await new Promise((r) => setTimeout(r, 300));

  const frames: Buffer[] = [];
  const grab = async () => {
    frames.push((await page.screenshot({ type: "png" })) as Buffer);
  };
  const hold = async (n: number, gap = 220) => {
    for (let i = 0; i < n; i++) {
      await grab();
      await new Promise((r) => setTimeout(r, gap));
    }
  };

  // ── Act one: the naive implementation double-books ──────────────────
  await clickLabel(page, "Naive");
  await hold(4, 260);
  await clickPrefix(page, "Fire ");
  await hold(6, 260);
  const sawNaive = await page
    .waitForFunction(() => document.body.innerText.includes("ONE COURT"), {
      timeout: 60_000,
    })
    .then(() => true)
    .catch(() => false);
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => window.scrollTo(0, 640));
  await hold(10, 300);

  // ── Act two: the same burst, the constrained path ───────────────────
  await page.evaluate(() => window.scrollTo(0, 470));
  await clickLabel(page, "Safe");
  await hold(4, 260);
  await clickPrefix(page, "Fire ");
  await hold(5, 260);
  const sawSafe = await page
    .waitForFunction(() => document.body.innerText.includes("SURVIVES"), {
      timeout: 60_000,
    })
    .then(() => true)
    .catch(() => false);
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => window.scrollTo(0, 640));
  await hold(12, 300);

  /*
   * A GIF that quietly recorded a spinner because a verdict never rendered
   * would be worse than no GIF at all — it is the README's central claim.
   */
  await page.close();
  console.log(
    `  captured ${frames.length} frames · naive verdict ${sawNaive ? "seen" : "MISSING"} · safe verdict ${sawSafe ? "seen" : "MISSING"}`,
  );
  if (!sawNaive || !sawSafe) {
    throw new Error("a verdict never appeared — not writing a misleading GIF");
  }

  const encoder = GIFEncoder();
  for (const buf of frames) {
    const png = PNG.sync.read(buf);
    const data = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length);
    /*
     * 48 colours is generous for a page that is mostly paper, ink and one
     * red — but the halftone dot texture and the anti-aliased type need the
     * headroom, and the palette costs 144 bytes.
     */
    const palette = quantize(data, 48);
    const index = applyPalette(data, palette);
    encoder.writeFrame(index, png.width, png.height, { palette, delay: 260 });
  }
  encoder.finish();

  const gif = Buffer.from(encoder.bytes());
  await fs.writeFile(path.join(OUT, "race-demo.gif"), gif);
  console.log(`  race-demo.gif  ${Math.round(gif.length / 1024)} KB`);
}

if (what === "shots" || what === "all") {
  console.log("stills:");
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  await shot("home", "", { height: 980, jpeg: true });
  await shot("facility", `facility/tennis-court-a?date=${tomorrow}`, { height: 1040 });
  await shot("bookings", "bookings", { height: 900 });
  await shot("fair", "fair", { height: 900 });
  await shot("ops", "ops", { height: 900 });
  await shot("insights", "analytics", { height: 960 });
  await shot("mobile", "", { width: 420, height: 860 });
}

/** The two verdict blocks, which are the point of the whole demo. */
async function verdicts() {
  for (const mode of ["Naive", "Safe"] as const) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 760, deviceScaleFactor: 2 });
    await page.goto(`${BASE}/race`, { waitUntil: "networkidle2", timeout: 90_000 });
    await settle(page, 600);
    await clickLabel(page, mode);
    await new Promise((r) => setTimeout(r, 250));
    await clickPrefix(page, "Fire ");
    await page
      .waitForFunction(
        () =>
          document.body.innerText.includes("ONE COURT") ||
          document.body.innerText.includes("SURVIVES"),
        { timeout: 90_000 },
      )
      .catch(() => console.log(`  ! ${mode}: no verdict appeared`));
    await new Promise((r) => setTimeout(r, 600));
    // Frame the verdict block itself rather than the page around it.
    const box = await page.evaluate(() => {
      const el = [...document.querySelectorAll("section")].find((s) =>
        /ONE COURT|SURVIVES|NOTHING REACHED/i.test(s.textContent ?? ""),
      );
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top + window.scrollY };
    });
    if (box) await page.evaluate((y) => window.scrollTo(0, y - 40), box.top);
    await new Promise((r) => setTimeout(r, 400));
    const name = `verdict-${mode.toLowerCase()}`;
    await page.screenshot({ path: path.join(OUT, `${name}.png`) as `${string}.png` });
    await page.close();
    const { size } = await fs.stat(path.join(OUT, `${name}.png`));
    console.log(`  ${name}.png  ${Math.round(size / 1024)} KB`);
  }
}

if (what === "verdicts" || what === "all") {
  console.log("verdicts:");
  await verdicts();
}

if (what === "gif" || what === "all") {
  console.log("gif:");
  await raceGif();
}

await browser.close();
