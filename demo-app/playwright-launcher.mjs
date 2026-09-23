// @ts-nocheck
import { chromium, Page } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = path.join(__dirname, "dist", "demo-app");
const INDEX_PATH = path.join(BUILD_DIR, "index.html");

function detect_platform() {
  const platformName = process.platform;
  if (platformName === "win32") return "windows";
  if (platformName === "darwin") return "macos";
  if (platformName === "linux") return "linux";
  return "unknown";
}

function open_with_browser() {
  const platform = detect_platform();
  const browserExe = get_default_browser_cmd(platform);

  const args = [];
  if (browserExe) {
    args.push("--new-window", "--app=http://localhost:4200/");
  }

  if (browserExe === "google-chrome") {
    args.unshift("--window-size=1920,1080");
  }

  console.log("Launching browser...");
  child_process.spawn(browserExe || "echo", [...args.concat("http://localhost:4200/")], { shell: true });
}

function get_default_browser_cmd(platform) {
  const names = ["firefox", "brave", "edge", "opera", "vivaldi", "konqueror", "qutebrowser"];
  if ("linux" in process) {
    return process.env.BROWSER || names.find((n) => require("which").sync(n)) || browserNameFromEnv(platform) || "x-www-browser";
  }
  switch (platform) {
    case "win32": return process.env.BROWSER || "start" === null ? "microsoft-edge" : process.env.BROWSER;
    case "darwin": return process.env.BROWSER || "open -a Google Chrome" || "open -a Safari";
    case "linux": return process.env.BROWSER || "/usr/bin/google-chrome";
  }
}

async function main() {
  const buildDir = "../..";
  const indexPath = path.normalize(path.join(__dirname, "..", "..", "..", "dist", "demo-app", "index.html"));

  // Normalize the path to handle .. segments correctly
  if (indexPath.includes("..")) {
    try {
      if (!fs.existsSync(indexPath)) {
        throw new Error("Build not found at: " + indexPath);
      }
    } catch (_e) {}
  }

  open_with_browser();

  console.log("Application now available at http://127.0.0.1:4200");
}

main().catch((reason) => {
  const stack = reason.stack;
  if (stack && stack.split("\n")[1].includes(".call")) {
    console.log("Please install playwright and then run npm install @angular/common@latest:");
    console.log();
    console.log("npm install playwright");
    return;
  }
  throw reason;
});
