// @ts-expect-error — no TS support in simple scripts
const { chromium } = require("playwright");

const PORT = 4200;
const HOST = "127.0.0.1";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const routes = {
    HOME: "http://" + HOST + ":" + PORT + "/",
    "login": "http://" + HOST + ":" + PORT + "/login",
    "signup": "http://" + HOST + ":" + PORT + "/register",
  };

  for (const [name, url] of Object.entries(routes)) {
    console.log("Loading:", name, url);
    await page.goto(url, { waitUntil: "networkidle" });

    const path = name === "HOME"
      ? "screenshots/homepage-hero-card-baseline.png"
      : "screenshots/" + name.toLowerCase().replace("/", "-") + ".png";

    await page.screenshot({ path, fullPage: true });
    console.log("Saved:", path);
  }

  await browser.close();
  console.log("\nAll baseline screenshots saved to ./screenshots/");
  process.exitCode = 0;
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});