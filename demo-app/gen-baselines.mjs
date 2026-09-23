import { chromium } from "playwright";

const PORT = 4200;
const HOST = "127.0.0.1";

const routes = [
  ["HOME", `http://${HOST}:${PORT}/`],
  ["login", `http://${HOST}:${PORT}/login`],
  ["signup", `http://${HOST}:${PORT}/register`],
];

async function main() {
  const browser = await chromium.launch({ slowMo: 0 });
  const context = await browser.newContext();
  const page = await context.newPage();

  for (const [name, url] of routes) {
    console.log(`Loading: ${name}`);
    try {
      await page.goto(url, { waitUntil: "networkidle" });
    } catch (e) {
      console.error("Failed to load:", name);
      continue;
    }

    let path = "";
    if (name === "HOME")
      path = "screenshots/homepage-hero-card-baseline.png";
    else
      const filename = name.replace("/", "-");
      path = `screenshots/${filename}.png`;

    await page.screenshot({ path, fullPage: true });
    console.log(`Saved to ${path}`);
  }

  await browser.close();
}

main().catch(console.error);