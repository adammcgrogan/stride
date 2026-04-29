// Usage: node scripts/screenshot.js [base_url]
// Requires: npm install playwright && npx playwright install chromium
//
// The script expects you to already be logged in — it reads the athlete_id
// cookie value from ATHLETE_COOKIE env var, e.g.:
//   ATHLETE_COOKIE=33535804 node scripts/screenshot.js

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://localhost:8080";
const COOKIE_VALUE = process.env.ATHLETE_COOKIE;

if (!COOKIE_VALUE) {
  console.error("Set ATHLETE_COOKIE=<your athlete_id> before running.");
  process.exit(1);
}

const PAGES = [
  { name: "dashboard", path: "/" },
  { name: "activities", path: "/activities" },
  { name: "stats", path: "/stats" },
  { name: "records", path: "/records" },
  { name: "predict", path: "/predict" },
  { name: "fitness", path: "/fitness" },
  { name: "goals", path: "/goals" },
  { name: "map", path: "/map" },
];

const OUT_DIR = path.join(__dirname, "screenshots");
fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
  });

  await context.addCookies([
    {
      name: "athlete_id",
      value: String(COOKIE_VALUE),
      domain: new URL(BASE).hostname,
      path: "/",
    },
  ]);

  const page = await context.newPage();

  for (const { name, path: route } of PAGES) {
    const url = BASE + route;
    console.log(`capturing ${url}`);
    await page.goto(url, { waitUntil: "networkidle" });
    const file = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  saved ${file}`);
  }

  await browser.close();
  console.log(`\nDone — screenshots in ${OUT_DIR}`);
})();
