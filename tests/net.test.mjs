// Kiểm thử phòng riêng qua mạng: máy chủ thật + các kết nối WebSocket thật trên localhost.   npm test
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import WebSocket from "ws";

import { config } from "../js/config.js";
import { NetSession, socketUrl } from "../js/net/session.js";
import { startServer } from "../server/server.mjs";

globalThis.WebSocket = WebSocket;              // NetSession dùng WebSocket của trình duyệt; trong Node mượn của gói ws
let server, base;
before(async () => { server = await startServer(0); base = `http://127.0.0.1:${server.port}`; });
after(() => server.close());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (check, what, ms = 5000) => { const t = Date.now(); while (!check()) { if (Date.now() - t > ms) assert.fail(`chờ mãi không thấy: ${what}`); await sleep(15); } };
const create = (mode, name) => NetSession.connect(base, { t: "create", mode, name }, 3000);
const join = (code, name) => NetSession.connect(base, { t: "join", code, name }, 3000);
const drain = (s, bag) => { for (const e of s.update(1 / 30)) bag.push(e); };

test("địa chỉ máy chủ: gõ kiểu nào cũng ra đúng địa chỉ WebSocket", () => {
  assert.equal(socketUrl("https://phoenix.onrender.com"), "wss://phoenix.onrender.com/ws");
  assert.equal(socketUrl("phoenix.onrender.com/"), "wss://phoenix.onrender.com/ws");
  assert.equal(socketUrl("http://localhost:8080/index.html?x=1"), "ws://localhost:8080/ws");
});

test("máy chủ phát trang game, báo /health, không phát file ngoài phạm vi", async () => {
  const health = await (await fetch(`${base}/health`)).json();
  assert.equal(health.phoenix, true);
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200); assert.match(await page.text(), /Project Phoenix/);
  assert.equal((await fetch(`${base}/js/core/sim.js`)).status, 200);
  for (const bad of ["/package.json", "/server/server.mjs", "/js/../package.json", "/js/%2e%2e/package.json", "/tests/core.test.mjs", "/node_modules/ws/package.json"]) {
    assert.equal((await fetch(`${base}${bad}`)).status, 404, bad);
  }
});

test("tạo phòng, vào bằng mã, sai mã bị từ chối, tên trùng được đánh số", async () => {
  const host = await create("coop", "Thầy Quỳnh");
  assert.match(host.code, /^\d{4}$/); assert.equal(host.mode, "coop");
  await assert.rejects(join("0000", "Kẻ lạ"), /Không có phòng nào mang mã này/);
  const a = await join(host.code, "Minh"), b = await join(host.code, "Minh");
  await until(() => host.roster.length === 3, "danh sách 3 người");
  assert.deepEqual(host.roster.map(([, n]) => n), ["Thầy Quỳnh", "Minh", "Minh 2"]);
  assert.ok(host.isOwner && !a.isOwner);
  a.start();                                    // không phải chủ phòng thì bấm bắt đầu không có tác dụng
  await sleep(150); assert.equal(host.started, false);
  b.close();
  await until(() => host.roster.length === 2, "người rời phòng biến khỏi danh sách");
  host.close(); a.close();
});

test("Đoàn kết qua mạng: thấy nhau, địch kéo tới, bắn hạ được tính điểm, ném lựu đạn, về phòng chờ", async () => {
  const host = await create("coop", "An"), guest = await join(host.code, "Bình"), seenHost = [], seenGuest = [];
  host.start();
  await until(() => guest.started, "khách nhận lệnh bắt đầu");
  await assert.rejects(join(host.code, "Đến muộn"), /Trận đang diễn ra/);
  guest.sendPose(20, 0, 5, 90, 0); host.sendPose(0, 0, -1.5, 0, 0);
  await until(() => { drain(host, seenHost); drain(guest, seenGuest); host.sendPose(0, 0, -1.5, 0, 0); guest.sendPose(20, 0, 5, 90, 0); return host.enemies.size > 0 && guest.enemies.size > 0; }, "địch xuất hiện ở cả hai máy", 8000);
  assert.equal(host.players.size, 2);
  assert.ok(Math.abs(host.players.get(guest.me).x - 20) < 0.5, "chủ phòng thấy đúng vị trí của khách");
  assert.equal(host.players.get(guest.me).name, "Bình");
  assert.ok(seenGuest.some((e) => e.t === "wave_start" && e.count === 9), "2 người thì đợt 1 có 9 địch");

  const target = [...guest.enemies.keys()][0];
  for (let i = 0; i < 3; i++) guest.hitEnemy(target, 250, true, "gun");
  await until(() => { drain(host, seenHost); drain(guest, seenGuest); return seenHost.some((e) => e.t === "enemy_kill" && e.id === target); }, "cả hai máy biết con địch đã bị hạ");
  assert.ok(seenGuest.some((e) => e.t === "enemy_kill" && e.by === guest.me && e.gained > 0));
  await until(() => guest.players.get(guest.me).kills === 1, "điểm hạ gục của khách");

  guest.shot([20, 1.5, 5], [[25, 1, 5]], "sniper");                     // vệt đạn tới máy kia, không dội lại máy mình
  await until(() => { drain(host, seenHost); drain(guest, seenGuest); return seenHost.some((e) => e.t === "shot" && e.w === "sniper"); }, "chủ phòng thấy phát bắn của khách");
  assert.ok(!seenGuest.some((e) => e.t === "shot" && e.p === guest.me));

  assert.ok(guest.throwItem("grenade", [20, 1.5, 5], [1, 0, 0]));
  await until(() => { drain(host, seenHost); drain(guest, seenGuest); guest.sendPose(20, 0, 5, 90, 0); return seenHost.some((e) => e.t === "explode"); }, "lựu đạn nổ", 6000);
  assert.equal(guest.players.get(guest.me).grenades, config.START_GRENADES - 1);

  host.reset();
  await until(() => { drain(guest, seenGuest); return seenGuest.some((e) => e.t === "reset") && !guest.started; }, "cả phòng về phòng chờ");
  assert.equal(guest.enemies.size, 0);
  host.close(); guest.close();
});

test("PvP qua mạng: bắn trúng nhau trừ máu, hạ gục được tính mạng, có hồi sinh", async () => {
  const a = await create("pvp", "An"), b = await join(a.code, "Bình"), seen = [];
  a.start();
  await until(() => { drain(a, seen); return b.started && a.players.get(b.me) && seen.some((e) => e.t === "spawn"); }, "bắt đầu trận");
  await sleep(200);
  b.hitPlayer(a.me, 25, true);
  await until(() => a.players.get(a.me).hp === config.PLAYER_HP - 25 * config.HEADSHOT_MULT, "trúng đầu trừ gấp đôi");
  for (let i = 0; i < 3; i++) b.hitPlayer(a.me, 250, false);
  await until(() => { drain(a, seen); return seen.some((e) => e.t === "player_kill" && e.victim === a.me && e.by === b.me); }, "bị hạ");
  await until(() => b.players.get(b.me).kills === 1 && !a.players.get(a.me).alive, "tính mạng");
  await until(() => a.players.get(a.me).alive, "hồi sinh", (config.PVP_RESPAWN + 2) * 1000);
  a.close(); b.close();
});

test("máy chủ không sập vì gói tin rác; phòng trống tự đóng", async () => {
  const raw = new WebSocket(`${base.replace("http", "ws")}/ws`);
  await new Promise((r) => raw.on("open", r));
  raw.send("khong phai json");
  await new Promise((r) => raw.on("close", r));
  const s = await create("coop", "<b>An</b>");
  await until(() => s.roster.length === 1, "vào phòng");
  assert.equal(s.roster[0][1], "bAn/b", "tên bị lọc ký tự lạ");
  for (const junk of [{ t: "pose", x: "abc" }, { t: "hit_enemy" }, { t: "throw", o: 5 }, { t: "shot", to: [[1]] }, { t: "hit_player", id: {}, dmg: 1e99 }, 42, null]) s._send(junk);
  s.start();
  await until(() => s.started, "máy chủ vẫn sống sau gói rác");
  const code = s.code;
  assert.ok(server.hub.rooms.has(code));
  s.close();
  await sleep(100);
  server.hub.tick(61);                          // hơn một phút không còn ai
  assert.ok(!server.hub.rooms.has(code));
});

test("phòng chọn bản đồ: máy chủ chạy bản đồ đã chọn, người vào sau nhận đúng bản đồ, mã lạ về bản đồ gốc", async () => {
  const village = await NetSession.connect(base, { t: "create", mode: "coop", name: "An", map: "lang_que" }, 3000);
  assert.equal(village.map, "lang_que");
  const guest = await join(village.code, "Bình");
  assert.equal(guest.map, "lang_que", "người vào sau thấy cùng bản đồ với phòng");
  const plain = await create("coop", "Cường");
  assert.equal(plain.map, "phuong_hoang", "không chọn thì là bản đồ gốc");
  const odd = await NetSession.connect(base, { t: "create", mode: "coop", name: "Dũng", map: "../../etc/passwd" }, 3000);
  assert.equal(odd.map, "phuong_hoang", "mã bản đồ lạ không làm hỏng máy chủ");
  // trận chạy thật trên bản đồ làng quê: địch kéo tới
  village.start();
  await until(() => village.started && guest.started, "bắt đầu trận");
  const seen = [];
  await until(() => { drain(village, seen); return seen.some((e) => e.t === "wave_start"); }, "đợt địch đầu tiên", 8000);
  for (const s of [village, guest, plain, odd]) s.close();
});
