// Công cụ gỡ lỗi: mở game, chạy một đoạn mã trong trang, chụp ảnh.   node tests/probe.mjs out.png "<js>" [rộng] [cao]
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [out, script = "", w = "1280", h = "720", touch = ""] = process.argv.slice(2);
const server = spawn("python3", ["-m", "http.server", "8766", "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, hasTouch: !!touch, isMobile: !!touch });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("[console]", m.text().slice(0, 300)); });
  page.on("pageerror", (e) => console.log("[pageerror]", String(e.stack || e).slice(0, 600)));
  const three = readFileSync(path.join(root, "node_modules/three/build/three.min.js"));
  await page.route("**/three.min.js", (r) => r.fulfill({ body: three, contentType: "application/javascript" }));
  await page.route("**/fonts.googleapis.com/**", (r) => r.fulfill({ body: "", contentType: "text/css" }));
  await page.goto("http://127.0.0.1:8766/index.html");
  await page.waitForFunction(() => window.phoenix, null, { timeout: 15000 }).catch(() => console.log("phoenix không khởi động"));
  await page.waitForTimeout(600);
  if (script) console.log("=>", JSON.stringify(await page.evaluate(`(async () => { ${script} })()`)));
  await page.waitForTimeout(500);
  await page.screenshot({ path: out });
} finally { await browser.close(); server.kill(); }
