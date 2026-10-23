// Chạy game thật trong trình duyệt không màn hình: tự chơi cả ba chế độ trên máy tính và trên điện thoại (đa chạm), chụp ảnh.
//   node tests/browser.test.mjs [thư_mục_ảnh]        (cần gói playwright)
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = process.argv[2] || path.join(root, "tests", "shots");
mkdirSync(out, { recursive: true });
const PORT = 8765;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));

const three = readFileSync(path.join(root, "node_modules/three/build/three.min.js"));
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

async function open(options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e.stack || e)));
  await page.route("**/three.min.js", (r) => r.fulfill({ body: three, contentType: "application/javascript" }));   // dùng bản three cài sẵn thay cho CDN
  await page.route("**/fonts.googleapis.com/**", (r) => r.fulfill({ body: "", contentType: "text/css" }));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => window.phoenix && window.phoenix.phase === "menu");
  const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });
  const phase = (name) => page.waitForFunction((n) => window.phoenix.phase === n && !window.phoenix.busy, name, { timeout: 20000 });
  const run = (fn, arg) => page.evaluate(fn, arg);
  return { page, errors, context, shot, phase, run };
}

// Các hàm dưới đây chạy TRONG trang. Tự chơi bằng đúng đường xử lý của người chơi thật (game.step).
const IDLE = { moveX: 0, moveZ: 0, lookYaw: 0, lookPitch: 0, fire: false, sprint: false, jump: false, reload: false, switch: false,
  select: null, pause: false, autoFire: false, aimAssist: false, aim: false, grenade: false, smoke: false };
/** Quay về phía mục tiêu gần nhất (địch, hoặc người chơi khác ở PvP) rồi bắn. */
function hunt({ frames, idle }) {
  const g = window.phoenix;
  if (g.session.mode !== "pvp") g.session.sim.players.get(1).stats.hp = 100;      // kịch bản thử không được chết giữa chừng vì xui
  for (let i = 0; i < frames && g.phase === "playing"; i++) {
    const p = g.player, intent = { ...idle, aimAssist: true };
    const list = g.targets();
    if (list.length) {
      const e = list.reduce((a, b) => ((a.x - p.x) ** 2 + (a.z - p.z) ** 2 < (b.x - p.x) ** 2 + (b.z - p.z) ** 2 ? a : b));
      const turn = ((((Math.atan2(e.x - p.x, e.z - p.z) * 180) / Math.PI - p.yaw + 180) % 360) + 360) % 360 - 180;
      intent.lookYaw = Math.max(-9, Math.min(9, turn));
      intent.fire = Math.abs(turn) < 2;
    }
    g.step(intent, 1 / 30);
  }
  const me = g.session ? g.session.players.get(1) : null;
  return { phase: g.phase, kills: me ? me.kills : -1, hp: me ? me.hp : -1, info: g.session ? g.session.info : null };
}
function hold() { const s = window.phoenix.session.sim; s.enemies.clear(); s.shots.clear(); s.waves.queue = []; s.waves.timer = 999; s.waves.fighting = false; }
function place([x, y, z, yaw, pitch]) { Object.assign(window.phoenix.player, { x, y, z, yaw, pitch, vy: 0, grounded: true }); }

try {
  // ======================= máy tính: Sinh tồn =======================
  const pc = await open({ viewport: { width: 1280, height: 720 } });
  await pc.shot("01_menu");
  assert.equal(await pc.run(() => window.phoenix.touchMode), false);
  await pc.page.click("#btn-settings");
  await pc.shot("02_cai_dat");
  await pc.page.click("#btn-settings-back");
  await pc.page.click("#btn-room");
  assert.equal(await pc.page.isVisible("#room-server"), true, "trang tĩnh không có máy chủ phòng thì phải cho nhập địa chỉ");
  await pc.page.click("#btn-host-coop");
  await pc.page.waitForFunction(() => /nhập địa chỉ máy chủ/.test(document.getElementById("room-note").textContent));
  await pc.page.click("#btn-room-back");
  await pc.page.click("#btn-play");
  await pc.phase("playing");
  assert.equal(await pc.run(() => window.phoenix.session.mode), "solo");

  let state = await pc.run(hunt, { frames: 450, idle: IDLE });
  await pc.shot("03_giao_tranh");
  for (let i = 0; i < 6; i++) state = await pc.run(hunt, { frames: 150, idle: IDLE });
  console.log("SINH TỒN  hạ", state.kills, "| đợt", state.info.wave, "| điểm", state.info.team, "| máu", state.hp);
  assert.ok(state.kills > 0, "bắn phải hạ được địch");
  assert.ok(state.info.wave >= 1);
  assert.ok(await pc.page.locator("#feed li").count() > 0 || state.kills > 0);

  // ----- đi lại nhiều tầng: lên dốc tầng lửng bằng phím thật -----
  await pc.run(hold);
  await pc.run(place, [10.2, 0, 15.35, 90, 0]);
  await pc.page.keyboard.down("KeyW");
  await pc.page.waitForFunction(() => window.phoenix.player.y > 3, null, { timeout: 120000 }).catch(() => assert.fail("giữ W phải đi hết dốc lên tầng lửng"));
  await pc.page.keyboard.up("KeyW");
  assert.equal(await pc.run(() => window.phoenix.layout.col.deckOf(window.phoenix.player.x, window.phoenix.player.y, window.phoenix.player.z)?.id), "mezz");
  await pc.run(place, [24, 3.25, 19, -90, 6]);
  await pc.page.waitForTimeout(300);
  await pc.shot("04_tang_lung");
  assert.equal(await pc.page.textContent("#zone"), "KHO HÀNG");

  // ----- từng món vũ khí (nạp đầy lại cho các phép thử bên dưới không phụ thuộc trận vừa đánh) -----
  await pc.run(() => { const g = window.phoenix; g.arsenal.reset(); g.session.players.get(1).stats.hp = 100; });
  await pc.run(place, [0, 0, -20, 0, 0]);
  for (const [key, index, name] of [["Digit1", 0, "pistol"], ["Digit3", 2, "smg"], ["Digit4", 3, "shotgun"], ["Digit6", 5, "lmg"], ["Digit8", 7, "knife"], ["Digit7", 6, "pan"], ["Digit5", 4, "sniper"]]) {
    await pc.page.keyboard.press(key);
    await pc.page.waitForFunction((i) => window.phoenix.arsenal.index === i, index);
    assert.equal(await pc.run(() => window.phoenix.arsenal.weapon.spec.key), name);
  }
  // ngắm bằng chuột phải: bắn tỉa hiện ống ngắm, góc nhìn hẹp lại
  const fov0 = await pc.run(() => window.phoenix.camera.fov);
  await pc.page.mouse.move(640, 360);
  await pc.page.mouse.down({ button: "right" });
  await pc.page.waitForFunction(() => window.phoenix.arsenal.scoped, null, { timeout: 15000 });
  await pc.page.waitForTimeout(400);
  await pc.shot("05_ong_ngam");
  assert.ok(await pc.run(() => window.phoenix.camera.fov) < fov0 / 2.5, "ngắm bắn tỉa phải phóng to");
  assert.equal(await pc.page.isVisible("#scope"), true);
  await pc.page.mouse.up({ button: "right" });
  await pc.page.waitForFunction(() => window.phoenix.arsenal.aimT === 0);

  // bắn súng trường: có giật, có vỏ đạn, tâm ngắm nở ra
  await pc.page.keyboard.press("Digit2");
  await pc.page.waitForFunction(() => window.phoenix.arsenal.index === 1 && window.phoenix.arsenal.draw === 0);
  await pc.run(place, [0, 0, -20, 0, 0]);
  const feel = await pc.run((idle) => {
    const g = window.phoenix, before = { ammo: g.arsenal.weapon.ammo, gap: g.arsenal.spread(g.player) };
    for (let i = 0; i < 20; i++) g.step({ ...idle, fire: true }, 1 / 30);
    return { shots: before.ammo - g.arsenal.weapon.ammo, kick: g.player.kick, bloom: g.arsenal.spread(g.player) - before.gap,
      casings: g.effects.particles.filter((p) => p.casing).length };
  }, IDLE);
  await pc.shot("06_ban_sung");
  assert.ok(feel.shots >= 5 && feel.kick > 0.3 && feel.bloom > 0.1 && feel.casings >= 3, JSON.stringify(feel));

  // chảo: đặt một con lính ngay trước mặt rồi vung
  await pc.page.keyboard.press("Digit7");
  await pc.page.waitForFunction(() => window.phoenix.arsenal.index === 6 && window.phoenix.arsenal.draw === 0);
  await pc.run(place, [0, 0, -20, 0, 0]);                         // (di chuột lúc ngắm đã làm lệch hướng nhìn)
  const melee = await pc.run((idle) => {
    const g = window.phoenix, sim = g.session.sim, before = sim.players.get(1).kills;
    sim.waves.queue = ["grunt"]; sim.waves.fighting = true; sim.waves.spawnTimer = 0; sim.tick(1 / 30); sim.waves.queue = [];
    const e = [...sim.enemies.values()][0];
    for (let i = 0; i < 120 && sim.enemies.size; i++) { e.x = 0; e.z = -18.3; e.y = 0; g.step({ ...idle, fire: true }, 1 / 30); }
    const me = sim.players.get(1);
    return { kills: me.kills - before, corpses: g.corpses.length, weapon: g.arsenal.weapon.spec.key, alive: me.alive, hp: me.hp, left: sim.enemies.size,
      enemyHp: e.hp, targets: g.targets().length, at: [g.player.x, g.player.y, g.player.z, g.player.yaw].map((v) => +v.toFixed(1)), over: !!sim.over };
  }, IDLE);
  assert.equal(melee.kills, 1, `chảo phải đánh hạ được địch đứng sát ${JSON.stringify(melee)}`);
  assert.ok(melee.corpses >= 1, "địch chết phải ngã xuống chứ không biến mất ngay");
  await pc.run(hold);

  // bom khói rồi lựu đạn
  await pc.page.keyboard.press("Digit2");
  await pc.page.keyboard.press("KeyF");
  await pc.page.waitForFunction(() => window.phoenix.session.sim.smokes.size === 1, null, { timeout: 30000 });
  await pc.run(place, [0, 0, -20, 90, 0]);
  const had = await pc.run(() => window.phoenix.session.players.get(1).grenades);
  await pc.page.keyboard.press("KeyG");
  await pc.page.waitForFunction(() => window.phoenix.session.sim.throwables.size === 1);
  assert.equal(await pc.run(() => window.phoenix.session.players.get(1).grenades), had - 1);
  assert.equal(await pc.page.textContent("#chip-grenade"), String(had - 1));
  await pc.page.waitForFunction(() => window.phoenix.effects.blasts.length > 0, null, { timeout: 40000, polling: 20 });
  await pc.shot("07_luu_dan");

  // tạm dừng: trận đứng yên
  await pc.page.keyboard.press("KeyP");
  await pc.phase("paused");
  const frozen = await pc.run(() => window.phoenix.session.sim.clock);
  await pc.page.waitForTimeout(300);
  assert.equal(await pc.run(() => window.phoenix.session.sim.clock), frozen);
  await pc.shot("08_tam_dung");
  await pc.page.click("#btn-resume");
  await pc.phase("playing");

  // thua: lưu kỷ lục, về menu
  await pc.run(() => { const g = window.phoenix; g.session.sim._hurt(g.session.players.get(1), 9999, 0, 0); });
  await pc.phase("game_over");
  await pc.shot("09_ket_thuc");
  assert.ok(await pc.run(() => window.phoenix.save.best) > 0, "kỷ lục phải được lưu");
  await pc.page.click("#btn-home");
  await pc.phase("menu");
  assert.match(await pc.page.textContent("#best"), /Kỷ lục sinh tồn: /);

  // ======================= Đoàn kết với máy =======================
  await pc.page.click("#mode-coop");
  assert.match(await pc.page.textContent("#btn-play"), /Đoàn kết/);
  await pc.page.click("#btn-play");
  await pc.phase("playing");
  state = await pc.run(hunt, { frames: 60, idle: IDLE });
  assert.equal(await pc.run(() => window.phoenix.views.avatars.size), 2, "phải thấy hai đồng đội máy");
  await pc.run(() => { const g = window.phoenix, m = [...g.session.players.values()][1]; const p = g.player; p.yaw = (Math.atan2(m.x - p.x, m.z - p.z) * 180) / Math.PI; p.pitch = 4; });
  await pc.page.waitForTimeout(250);
  await pc.shot("10_doan_ket");
  for (let i = 0; i < 6; i++) state = await pc.run(hunt, { frames: 150, idle: IDLE });
  const team = await pc.run(() => [...window.phoenix.session.players.values()].map((p) => [p.name, p.kills]));
  console.log("ĐOÀN KẾT  ", team.map(([n, k]) => `${n} hạ ${k}`).join(" · "), "| đợt", state.info.wave);
  assert.ok(team.slice(1).some(([, k]) => k > 0), "đồng đội máy phải hạ được địch");
  assert.match(await pc.page.textContent("#roster"), /Sói Xám/);
  await pc.page.keyboard.press("KeyP");
  await pc.phase("paused");
  await pc.page.click("#btn-quit");
  await pc.phase("menu");

  // ======================= PvP với máy =======================
  await pc.page.click("#mode-pvp");
  await pc.page.click("#btn-play");
  await pc.phase("playing");
  assert.equal(await pc.run(() => window.phoenix.session.players.size), 4);
  for (let i = 0; i < 10 && state.phase !== "game_over"; i++) state = await pc.run(hunt, { frames: 200, idle: IDLE });
  await pc.shot("11_pvp");
  const board = await pc.run(() => [...window.phoenix.session.players.values()].map((p) => `${p.name} ${p.kills}/${p.deaths}`));
  console.log("PvP  ", board.join(" · "));
  assert.ok(await pc.run(() => [...window.phoenix.session.players.values()].reduce((s, p) => s + p.kills, 0)) > 0, "PvP phải có người hạ được nhau");
  await pc.run(() => { const s = window.phoenix.session.sim; s.players.get(1).stats.kills = 99; s._finish(); });
  await pc.phase("game_over");
  await pc.shot("12_pvp_ket_thuc");
  assert.equal(await pc.page.textContent("#over-title"), "Chiến thắng");
  assert.equal(await pc.page.locator("#over-table li").count(), 4);
  assert.deepEqual(pc.errors, [], "không được có lỗi trên bảng điều khiển");
  await pc.context.close();

  // ======================= điện thoại nằm ngang, đa chạm =======================
  const phone = await open({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await phone.shot("13_dt_menu");
  await phone.page.tap("#btn-play");
  await phone.phase("playing");
  assert.equal(await phone.run(() => window.phoenix.touchMode), true, "chạm tay thì tự bật chế độ cảm ứng");
  await phone.run(hold);
  const spot = (name) => phone.run((n) => {
    const g = window.phoenix, b = g.touch.buttons.find((x) => x.name === n), w = innerWidth, h = innerHeight;
    return { x: (b.x / (w / h) + 0.5) * w, y: (0.5 - b.y) * h };
  }, name);
  const fire = await spot("fire");
  const cdp = await phone.context.newCDPSession(phone.page);
  const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  const before = await phone.run(() => { const p = window.phoenix.player; return { x: p.x, z: p.z, yaw: p.yaw, ammo: window.phoenix.arsenal.weapon.ammo }; });
  await touch("touchStart", [{ x: 150, y: 280, id: 1 }, { x: fire.x, y: fire.y, id: 2 }]);       // ngón trái đặt cần, ngón phải giữ BẮN
  for (let i = 1; i <= 12; i++) {
    await touch("touchMove", [{ x: 150, y: 280 - i * 5, id: 1 }, { x: fire.x - i * 4, y: fire.y, id: 2 }]);   // đẩy cần lên + kéo ngắm sang trái
    await phone.page.waitForTimeout(30);
  }
  await phone.page.waitForFunction((b) => { const g = window.phoenix, p = g.player; return Math.hypot(p.x - b.x, p.z - b.z) > 1 && g.arsenal.weapon.ammo < b.ammo; }, before, { timeout: 20000 })
    .catch(() => assert.fail("cần ảo phải di chuyển được trong lúc ngón kia giữ nút BẮN"));
  await phone.shot("14_dt_choi");
  const after = await phone.run(() => { const g = window.phoenix, p = g.player; return { x: p.x, z: p.z, yaw: p.yaw, ammo: g.arsenal.weapon.ammo }; });
  await touch("touchEnd", []);
  console.log("ĐIỆN THOẠI  đi được", Math.hypot(after.x - before.x, after.z - before.z).toFixed(2), "m | xoay", (after.yaw - before.yaw).toFixed(1), "độ | bắn", before.ammo - after.ammo, "viên");
  assert.ok(after.yaw < before.yaw - 3, "kéo ngón phải sang trái thì quay trái");
  await phone.page.waitForFunction(() => window.phoenix.touch.stickVec[0] === 0 && window.phoenix.touch.stickVec[1] === 0);

  await phone.page.tap("#slot-sniper");                         // chạm thanh vũ khí để đổi súng
  await phone.page.waitForFunction(() => window.phoenix.arsenal.weapon.spec.key === "sniper");
  const aim = await spot("aim");                                // nút NGẮM là công tắc
  await touch("touchStart", [{ x: aim.x, y: aim.y, id: 8 }]);
  await touch("touchEnd", []);
  await phone.page.waitForFunction(() => window.phoenix.arsenal.scoped, null, { timeout: 15000 });
  await touch("touchStart", [{ x: aim.x, y: aim.y, id: 8 }]);
  await touch("touchEnd", []);
  await phone.page.waitForFunction(() => !window.phoenix.arsenal.scoped, null, { timeout: 15000 });
  const nade = await spot("grenade");
  await touch("touchStart", [{ x: nade.x, y: nade.y, id: 9 }]);
  await phone.page.waitForFunction(() => window.phoenix.session.sim.throwables.size === 1);
  await touch("touchEnd", []);
  await phone.page.waitForTimeout(200);
  await phone.shot("15_dt_vu_khi");
  const pause = await spot("pause");
  await touch("touchStart", [{ x: pause.x, y: pause.y, id: 5 }]);
  await touch("touchEnd", []);
  await phone.phase("paused");
  assert.deepEqual(phone.errors, []);
  await phone.context.close();

  // ======================= điện thoại cầm dọc: vẫn phải dùng được =======================
  const tall = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await tall.shot("16_dt_doc");
  assert.ok(await tall.run(() => document.documentElement.scrollWidth - innerWidth) <= 0, "không được tràn ngang");
  const play = await tall.page.locator("#btn-play").boundingBox();
  assert.ok(play.x >= 16 && play.x + play.width <= 390 - 16, "nút vào trận phải nằm gọn trong màn hình");
  assert.deepEqual(tall.errors, []);
  await tall.context.close();
  console.log("BROWSER OK ->", out);
} finally {
  await browser.close();
  server.kill();
}
