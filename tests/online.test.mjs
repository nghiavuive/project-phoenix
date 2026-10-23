// Chơi qua mạng thật: một máy chủ phòng + HAI trình duyệt. Tạo phòng, vào bằng mã, đánh PvP rồi Đoàn kết, chụp ảnh hai phía.
//   node tests/online.test.mjs [thư_mục_ảnh]        (cần gói playwright)
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { startServer } from "../server/server.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = process.argv[2] || path.join(root, "tests", "shots");
mkdirSync(out, { recursive: true });
const server = await startServer(0);
const base = `http://127.0.0.1:${server.port}`;
const three = readFileSync(path.join(root, "node_modules/three/build/three.min.js"));
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

async function open(name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e.stack || e)));
  await page.route("**/three.min.js", (r) => r.fulfill({ body: three, contentType: "application/javascript" }));
  await page.route("**/fonts.googleapis.com/**", (r) => r.fulfill({ body: "", contentType: "text/css" }));
  await page.goto(base);
  await page.waitForFunction(() => window.phoenix && window.phoenix.phase === "menu" && window.phoenix.sameOrigin);
  await page.click("#btn-room");
  assert.equal(await page.isVisible("#room-server"), false, "mở trên máy chủ phòng thì không phải nhập địa chỉ");
  await page.fill("#room-name", name);
  return { page, errors, context, name, shot: (n) => page.screenshot({ path: path.join(out, `${n}.png`) }),
    phase: (p) => page.waitForFunction((x) => window.phoenix.phase === x && !window.phoenix.busy, p, { timeout: 30000 }),
    run: (fn, arg) => page.evaluate(fn, arg) };
}

const IDLE = { moveX: 0, moveZ: 0, lookYaw: 0, lookPitch: 0, fire: false, sprint: false, jump: false, reload: false, switch: false,
  select: null, pause: false, autoFire: false, aimAssist: false, aim: false, grenade: false, smoke: false };
/** Chạy trong trang: quay về mục tiêu gần nhất rồi bắn, từng bước nhỏ để mạng kịp đi lại. */
async function hunt({ frames, idle, pace = 0 }) {
  const g = window.phoenix;
  for (let i = 0; i < frames && g.phase === "playing"; i++) {
    const p = g.player, intent = { ...idle, aimAssist: true }, list = g.targets();
    if (list.length) {
      const e = list.reduce((a, b) => ((a.x - p.x) ** 2 + (a.z - p.z) ** 2 < (b.x - p.x) ** 2 + (b.z - p.z) ** 2 ? a : b));
      const turn = ((((Math.atan2(e.x - p.x, e.z - p.z) * 180) / Math.PI - p.yaw + 180) % 360) + 360) % 360 - 180;
      intent.lookYaw = Math.max(-9, Math.min(9, turn));
      intent.fire = Math.abs(turn) < 2;
    }
    g.step(intent, 1 / 30);
    if (pace) await new Promise((r) => setTimeout(r, pace)); else if (i % 5 === 4) await new Promise((r) => setTimeout(r, 12));
  }
  const me = g.session.players.get(g.session.me);
  return { phase: g.phase, kills: me ? me.kills : -1, deaths: me ? me.deaths : -1, hp: me ? me.hp : -1 };
}

try {
  const a = await open("Thầy Quỳnh"), b = await open("Bạn Minh");

  // ======================= PvP =======================
  await a.page.click("#btn-host-pvp");
  await a.phase("lobby");
  const code = await a.page.textContent("#lobby-code");
  assert.match(code, /^\d{4}$/);
  await b.page.fill("#room-code", "0000");
  await b.page.click("#btn-join");
  await b.page.waitForFunction(() => /Không có phòng nào mang mã này/.test(document.getElementById("room-note").textContent));
  await b.page.fill("#room-code", code);
  await b.page.click("#btn-join");
  await b.phase("lobby");
  await a.page.waitForFunction(() => document.querySelectorAll("#lobby-list li").length === 2);
  await a.shot("online_1_phong_cho_chu");
  await b.shot("online_2_phong_cho_khach");
  assert.equal(await b.page.isVisible("#btn-lobby-start"), false, "chỉ chủ phòng mới có nút bắt đầu");
  assert.match(await b.page.textContent("#lobby-list"), /Thầy Quỳnh.*chủ phòng/s);

  await a.page.click("#btn-lobby-start");
  await a.phase("playing"); await b.phase("playing");
  await a.page.waitForFunction(() => window.phoenix.views.avatars.size === 1 || (window.phoenix.step({ moveX: 0, moveZ: 0, lookYaw: 0, lookPitch: 0, select: null }, 1 / 30), false), null, { timeout: 30000 });
  // B đứng yên giữa ngã tư; A đứng cách 9 m nhìn thẳng vào B rồi bắn bằng súng thật
  await b.run(() => Object.assign(window.phoenix.player, { x: 0, y: 0, z: 2, yaw: 180, pitch: 0, vy: 0, grounded: true }));
  await a.run(() => Object.assign(window.phoenix.player, { x: 0, y: 0, z: -7, yaw: 0, pitch: 0, vy: 0, grounded: true }));
  await a.page.waitForFunction(() => { const v = [...window.phoenix.views.avatars.values()][0]; return v && Math.abs(v.z - 2) < 0.3 && Math.abs(v.x) < 0.3; }, null, { timeout: 30000 });
  await a.page.waitForTimeout(400);
  await a.shot("online_3_pvp_thay_nhau");
  const killing = a.run(hunt, { frames: 150, idle: IDLE });
  const feedA = a.page.waitForFunction(() => /Bạn.*Bạn Minh/s.test(document.getElementById("feed").textContent), null, { timeout: 30000 });   // (tin tự tắt sau 5 giây)
  const feedB = b.page.waitForFunction(() => /Thầy Quỳnh.*Bạn/s.test(document.getElementById("feed").textContent), null, { timeout: 30000 });
  await Promise.all([feedA, feedB]).catch(() => assert.fail("cả hai bên phải thấy tin ai hạ ai"));
  await b.page.waitForFunction(() => { const s = window.phoenix.session; return s.players.get(s.me).deaths >= 1; }, null, { timeout: 30000 });
  await a.page.waitForFunction(() => { const s = window.phoenix.session; return s.players.get(s.me).kills >= 1; }, null, { timeout: 30000 });
  await b.shot("online_4_pvp_bi_ha");
  let res = await killing;
  console.log("PvP QUA MẠNG  chủ phòng hạ", (await a.run(() => window.phoenix.session.players.get(window.phoenix.session.me).kills)), "| khách gục",
    (await b.run(() => window.phoenix.session.players.get(window.phoenix.session.me).deaths)));
  await b.page.waitForFunction(() => { const s = window.phoenix.session; return s.players.get(s.me).alive; }, null, { timeout: 30000 });   // hồi sinh

  // kết thúc trận, chủ phòng đưa cả phòng về phòng chờ
  server.hub.rooms.get(code).sim._finish();
  await a.phase("game_over"); await b.phase("game_over");
  await b.shot("online_5_ket_thuc_khach");
  assert.equal(await b.page.isVisible("#btn-again"), false);
  assert.equal(await b.page.isVisible("#over-wait"), true);
  await a.page.click("#btn-again");
  await a.phase("lobby"); await b.phase("lobby");

  // ======================= rớt mạng: khách rời, chủ phòng thấy danh sách còn một người =======================
  await b.page.click("#btn-lobby-leave");
  await b.phase("menu");
  await a.page.waitForFunction(() => document.querySelectorAll("#lobby-list li").length === 1);
  await a.page.click("#btn-lobby-leave");
  await a.phase("menu");

  // ======================= Đoàn kết =======================
  await a.page.click("#btn-room"); await a.page.click("#btn-host-coop");
  await a.phase("lobby");
  const code2 = await a.page.textContent("#lobby-code");
  await b.page.click("#btn-room"); await b.page.fill("#room-code", code2); await b.page.click("#btn-join");
  await b.phase("lobby");
  await a.page.waitForFunction(() => document.querySelectorAll("#lobby-list li").length === 2);
  await a.page.click("#btn-lobby-start");
  // Máy thử dựng hình bằng phần mềm nên rất chậm (vài khung hình/giây) trong khi máy chủ chạy theo giờ thật:
  // cho hai người chơi thật nhiều máu để họ không gục trước khi kịp bắn.
  const tough = setInterval(() => { for (const p of server.hub.rooms.get(code2)?.sim.players.values() ?? []) p.stats.hp = 100; }, 100);
  await a.phase("playing"); await b.phase("playing");
  const both = () => a.run(() => [...window.phoenix.session.players.values()].every((p) => p.kills > 0));
  for (let i = 0; i < 40 && !(await both()); i++) {                 // máy chủ chạy theo giờ thật, nên cứ đánh cho tới khi cả hai cùng có mạng
    await Promise.all([a.run(hunt, { frames: 60, idle: IDLE, pace: 30 }), b.run(hunt, { frames: 60, idle: IDLE, pace: 30 })]);
  }
  clearInterval(tough);
  await a.page.waitForTimeout(400);
  const seenA = await a.run(() => { const s = window.phoenix.session; return { kills: [...s.players.values()].map((p) => [p.name, p.kills]), wave: s.info.wave, team: s.info.team }; });
  const seenB = await b.run(() => { const s = window.phoenix.session; return { kills: [...s.players.values()].map((p) => [p.name, p.kills]), wave: s.info.wave, team: s.info.team }; });
  console.log("ĐOÀN KẾT QUA MẠNG  ", seenA.kills.map(([n, k]) => `${n} hạ ${k}`).join(" · "), "| đợt", seenA.wave, "| điểm đội", seenA.team);
  assert.ok(seenA.kills.every(([, k]) => k > 0), "cả hai người đều hạ được địch");
  assert.deepEqual(seenA.kills, seenB.kills, "hai máy thấy cùng một bảng điểm");
  await a.run(() => { const g = window.phoenix, m = [...g.views.avatars.values()][0], p = g.player; p.yaw = (Math.atan2(m.x - p.x, m.z - p.z) * 180) / Math.PI; p.pitch = 4; });
  await a.page.waitForTimeout(300);
  await a.shot("online_6_doan_ket");
  assert.match(await a.page.textContent("#roster"), /Bạn Minh/);

  // mất kết nối với máy chủ: về menu kèm lời báo
  server.close();
  for (const c of server.hub.where.keys()) c.close();
  await b.page.waitForFunction(() => /Mất kết nối/.test(document.getElementById("room-note").textContent), null, { timeout: 30000 });
  assert.deepEqual(a.errors.filter((e) => !/WebSocket|ERR_CONNECTION|health/.test(e)), []);
  assert.deepEqual(b.errors.filter((e) => !/WebSocket|ERR_CONNECTION|health/.test(e)), []);
  console.log("ONLINE OK ->", out);
} finally {
  await browser.close();
  server.close();
}
