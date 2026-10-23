// Kiểm thử luật chơi của bản web (không cần trình duyệt):   node --test tests/
import assert from "node:assert/strict";
import { test } from "node:test";

import { config } from "../js/config.js";
import { TouchControls } from "../js/controls/touch.js";
import { buildSolids, castRay, viewBasis } from "../js/core/ballistics.js";
import { BRUTE, GRUNT, RUNNER, SHOOTER, steer } from "../js/core/enemies.js";
import { resolveCircles, segmentBlocked } from "../js/core/geometry.js";
import { buildLayout } from "../js/core/layout.js";
import { Rng } from "../js/core/rng.js";
import { Simulation } from "../js/core/sim.js";
import { PlayerStats } from "../js/core/state.js";
import { WaveDirector, composeWave } from "../js/core/waves.js";
import { KNIFE, LOADOUT, PAN, PISTOL, RIFLE, SHOTGUN, SNIPER, Weapon } from "../js/core/weapons.js";

const DT = 1 / 30;
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const run = (sim, seconds) => { let ev = []; for (let i = 0; i < seconds / DT; i++) ev = ev.concat(sim.tick(DT)); return ev; };
const kinds = (events) => events.map((e) => e.t);

test("súng: nhịp bắn, băng đạn, nạp đạn", () => {
  const w = new Weapon(RIFLE);
  assert.ok(w.tryFire()); assert.ok(!w.tryFire());
  w.tick(RIFLE.fireInterval); assert.ok(w.tryFire());
  assert.equal(w.ammo, RIFLE.magSize - 2);
  w.ammo = 0; assert.ok(w.startReload()); assert.ok(!w.tryFire());
  assert.ok(!w.tick(RIFLE.reloadTime / 2)); assert.ok(w.tick(RIFLE.reloadTime));
  assert.equal(w.ammo, RIFLE.magSize);
  const s = new Weapon(SHOTGUN); s.ammo = 1; s.reserve = 3; s.startReload(); s.tick(99);
  assert.deepEqual([s.ammo, s.reserve], [4, 0]);
  assert.ok(!s.startReload()); s.ammo = 0; assert.ok(s.outOfAmmo);
});

test("điểm: chuỗi hạ gục nhân điểm rồi hết hạn, có trần", () => {
  const s = new PlayerStats();
  assert.equal(s.addKill(100), 100); assert.equal(s.addKill(100), 200);
  assert.equal(s.addKill(100, true), 300 + config.HEADSHOT_BONUS);
  s.tick(config.COMBO_WINDOW + 0.1); assert.equal(s.addKill(100), 100);
  let g; for (let i = 0; i < config.COMBO_MAX + 5; i++) g = s.addKill(10);
  assert.equal(g, 10 * config.COMBO_MAX);
  assert.ok(!s.damage(40)); assert.equal(s.heal(100), 40); assert.ok(s.damage(1000));
});

test("đợt: lớn dần, mở loại địch mới, đủ một vòng thả-dọn", () => {
  const rng = new Rng(1), w1 = composeWave(1, rng), w6 = composeWave(6, rng);
  assert.deepEqual([...new Set(w1)], ["grunt"]); assert.equal(w1.length, 6);
  assert.ok(w6.length > w1.length); assert.ok(w6.includes("brute"));
  const d = new WaveDirector(3); let alive = 0, spawned = 0; const events = [];
  for (let i = 0; i < 4000 && events.filter((e) => e === "wave_clear").length < 2; i++) {
    const [spawns, ev] = d.tick(0.05, alive);
    assert.ok(alive + spawns.length <= config.MAX_ALIVE);
    alive += spawns.length; spawned += spawns.length; if (ev) events.push(ev);
    if (alive && d.rng.random() < 0.2) alive -= 1;
  }
  assert.deepEqual(events, ["wave_start", "wave_clear", "wave_start", "wave_clear"]);
  assert.equal(spawned, 6 + 8);
});

test("va chạm và tầm nhìn", () => {
  let [x, z] = resolveCircles(0.5, 0, 0.5, [[0, 0, 1]], 50); near(Math.hypot(x, z), 1.5);
  [x] = resolveCircles(80, 0, 0.5, [], 50); near(x, 49.5);
  assert.ok(segmentBlocked(0, 0, 10, 0, [[5, 0, 1]])); assert.ok(!segmentBlocked(0, 3, 10, 3, [[5, 0, 1]]));
});

test("địch: đuổi, dừng khi tới nơi, xạ thủ lùi, không chồng nhau", () => {
  near(steer([0, 0], [10, 0], GRUNT, [])[0], GRUNT.speed);
  assert.deepEqual(steer([0, 0], [1, 0], GRUNT, []), [0, 0]);
  assert.ok(steer([0, 0], [3, 0], SHOOTER, [], 0)[0] < 0);
  assert.ok(steer([0, 0], [0, 10], GRUNT, [[0.5, 0]])[0] < 0);
});

test("cảm ứng: hai ngón đi + nhìn cùng lúc, nút bắn giữ và ngắm, nút bấm một lần", () => {
  const t = new TouchControls(16 / 9, "dual");
  t.poll(0.016, { 1: [-0.5, -0.2], 2: [0.2, 0.1] });
  let i = t.poll(0.016, { 1: [-0.45, -0.2], 2: [0.3, 0.1] });
  assert.ok(i.moveX > 0); near(i.lookYaw, 0.1 * config.TOUCH_SENSITIVITY); assert.ok(!i.fire);
  t.releaseAll();
  t.poll(0.016, { 1: [-0.5, -0.2] });
  i = t.poll(0.016, { 1: [-0.5, -0.2 + t.stickRadius * 2] });
  near(i.moveZ, 1); assert.ok(i.sprint);
  t.releaseAll();
  const fire = t.buttons.find((b) => b.name === "fire"), jump = t.buttons.find((b) => b.name === "jump");
  assert.ok(t.poll(0.016, { 7: [fire.x, fire.y] }).fire);
  i = t.poll(0.016, { 7: [fire.x - 0.3, fire.y] }); assert.ok(i.fire); assert.ok(i.lookYaw < 0);
  assert.ok(!t.poll(0.016, {}).fire);
  assert.ok(t.poll(0.016, { 3: [jump.x, jump.y] }).jump); assert.ok(!t.poll(0.016, { 3: [jump.x, jump.y] }).jump);
  const narrow = new TouchControls(0.56);
  for (const b of narrow.buttons) assert.ok(Math.abs(b.x) + b.r <= 0.28 + 1e-6, b.name);
});

test("bản đồ: bốn khu công trình, rừng giữ từ bản cũ, không gì đè lên đường và điểm xuất phát", () => {
  const map = buildLayout();
  assert.equal(map.seed, config.WORLD_SEED);
  assert.deepEqual(map.zones.map((z) => z.name), ["KHO HÀNG", "BÃI CONTAINER", "THÁP CANH", "BÃI XE", "NGÃ TƯ"]);
  assert.ok(map.blocks.length > 60); assert.equal(map.decks.length, 3);
  assert.ok(map.props.filter((p) => p.kind === "tree").length >= 10, "rừng thông của bản đồ cũ vẫn còn");
  assert.ok(!map.col.blockedAt(map.spawn[0], map.spawn[1], 1));
  for (let z = -45; z <= 45; z += 3) assert.ok(!map.col.blockedAt(0, z, 0.5), `đường dọc bị chắn ở z=${z}`);
  for (const p of map.props) assert.ok(Math.abs(p.x) >= 5 && Math.abs(p.z) >= 5 || p.kind === "tank");
  assert.ok(buildSolids(map).length > 100);
});

test("đường đạn: trúng thân, trúng đầu, bị vật cản che, hộp xoay", () => {
  const { forward } = viewBasis(0, 0);
  near(forward[0], 0); near(forward[1], 0); near(forward[2], 1);
  const enemy = { id: 5, kind: "enemy", x: 0, y: 0, z: 10, shape: GRUNT.shape };
  let hit = castRay([0, 1.0, 0], forward, 90, [], [enemy]);
  assert.equal(hit.target, enemy); assert.ok(!hit.head); near(hit.dist, 10 - 0.52);
  hit = castRay([0, 1.86, 0], forward, 90, [], [enemy]); assert.ok(hit.head);
  hit = castRay([0, 3.0, 0], forward, 90, [], [enemy]); assert.equal(hit.target, null); near(hit.dist, 90);
  const rock = { type: "cyl", x: 0, z: 5, r: 1, y0: 0, y1: 2 };
  hit = castRay([0, 1.0, 0], forward, 90, [rock], [enemy]); assert.equal(hit.target, null); near(hit.dist, 4);
  hit = castRay([0, 1.0, 0], forward, 5, [], [enemy]); assert.equal(hit.target, null);            // ngoài tầm
  const crate = { type: "box", x: 0, y: 1, z: 5, hx: 1, hy: 1, hz: 1, rot: Math.PI / 4 };
  hit = castRay([0, 1.0, 0], forward, 90, [crate], []); near(hit.dist, 5 - Math.SQRT2);        // trúng cạnh hộp xoay 45°
  const down = viewBasis(0, 45).forward;
  hit = castRay([0, 1.7, 0], down, 90, [], []); near(hit.point[1], 0); near(hit.point[2], 1.7);    // trúng đất
  near(viewBasis(90, 0).forward[0], 1); near(viewBasis(0, -30).forward[1], 0.5);                  // phải / ngẩng lên
});

test("chơi đơn: địch kéo tới, bắn hạ được điểm, đứng yên thì thua", () => {
  const sim = new Simulation("solo", buildLayout(), 5);
  const me = sim.addPlayer(1, "Thầy"); sim.start();
  let events = run(sim, 4);
  assert.ok(kinds(events).includes("wave_start")); assert.ok(sim.enemies.size > 0);
  const id = sim.enemies.keys().next().value;
  sim.hitEnemy(1, id, 250, true);
  events = sim.tick(DT);
  assert.ok(kinds(events).includes("enemy_kill")); assert.equal(me.kills, 1);
  assert.equal(sim.teamScore, 100 + config.HEADSHOT_BONUS);
  events = run(sim, 60);
  assert.ok(kinds(events).includes("hurt")); assert.ok(sim.over); assert.equal(sim.over.mode, "solo");
});

test("đoàn kết và PvP: luật giữ nguyên như bản Python", () => {
  const coop = new Simulation("coop", buildLayout(), 5);
  const a = coop.addPlayer(1, "An"), b = coop.addPlayer(2, "Bình"); coop.start();
  const start = run(coop, 2).find((e) => e.t === "wave_start");
  assert.equal(start.count, 6 + Math.floor(6 * config.COOP_EXTRA));
  coop.hitPlayer(1, 2, 100); assert.equal(b.hp, config.PLAYER_HP);                 // không bắn trúng đồng đội
  coop._hurt(b, 999, 0, 0); assert.ok(!b.alive); assert.equal(coop.over, null);
  let events = [];
  for (let i = 0; i < 1500 && !kinds(events).includes("wave_clear"); i++) {
    for (const id of [...coop.enemies.keys()]) for (let k = 0; k < 3; k++) coop.hitEnemy(1, id, 250, true);
    events = events.concat(coop.tick(DT));
  }
  assert.ok(b.alive); assert.equal(b.hp, config.COOP_REVIVE_HP);                   // hồi sinh khi dọn xong đợt
  coop._hurt(a, 999, 0, 0); coop._hurt(b, 999, 0, 0); run(coop, 0.2); assert.ok(coop.over);

  const pvp = new Simulation("pvp", buildLayout(), 5);
  const p = pvp.addPlayer(1, "An"), q = pvp.addPlayer(2, "Bình"); pvp.start(); pvp.tick(DT);
  assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > 10);
  pvp.hitPlayer(1, 2, 25, true); assert.equal(q.hp, config.PLAYER_HP - 25 * config.HEADSHOT_MULT);
  for (let n = 0; n < config.PVP_KILLS; n++) { pvp.hitPlayer(1, 2, 250); run(pvp, config.PVP_RESPAWN + config.PVP_SHIELD + 0.3); }
  assert.ok(pvp.over); assert.equal(pvp.over.ranking[0].name, "An"); assert.equal(pvp.enemies.size, 0);
});

test("kho vũ khí: 8 món, súng lục vô hạn, cận chiến không cần đạn, hộp đạn nạp thêm", () => {
  assert.equal(LOADOUT.length, 8);
  assert.equal(new Set(LOADOUT.map((s) => s.key)).size, 8);
  const pistol = new Weapon(PISTOL); pistol.ammo = 0; pistol.startReload(); pistol.tick(99);
  assert.equal(pistol.ammo, PISTOL.magSize); assert.ok(!pistol.outOfAmmo); assert.ok(!pistol.refill());
  const pan = new Weapon(PAN);
  assert.ok(pan.tryFire()); assert.ok(!pan.tryFire()); pan.tick(PAN.fireInterval); assert.ok(pan.tryFire());
  assert.ok(!pan.startReload()); assert.ok(!pan.outOfAmmo);
  assert.ok(KNIFE.fireInterval < PAN.fireInterval); assert.ok(PAN.damage > KNIFE.damage);
  const sniper = new Weapon(SNIPER); const before = sniper.reserve;
  assert.ok(sniper.refill()); assert.equal(sniper.reserve, before + SNIPER.refill);
  assert.ok(SNIPER.damage * config.HEADSHOT_MULT > 250);                          // tỉa trúng đầu hạ được mọi lính thường
});

test("lựu đạn: bay, nảy, nổ đúng giờ, hạ địch trong tầm và tính điểm cho người ném", () => {
  const sim = new Simulation("solo", buildLayout({ seed: 1, obstacles: [] }), 5);
  const me = sim.addPlayer(1, "Thầy"); sim.start(); run(sim, 6);
  const far = [...sim.enemies.values()];
  assert.ok(far.length >= 5);
  far.forEach((e, i) => { e.x = 20 + i * 0.5; e.z = 0; });                          // địch đang lao về phía mình...
  far[far.length - 1].x = 45;                                                      // ...trừ một con ở xa, ngoài tầm nổ
  assert.equal(me.grenades, config.START_GRENADES);
  assert.ok(sim.throwItem(1, "grenade", [13, 0.5, 0], [0, 0, 0]));                 // ném đón đầu: lúc nổ chúng vừa chạy tới
  assert.equal(me.grenades, config.START_GRENADES - 1);
  let events = run(sim, config.GRENADE_FUSE - 0.3);
  assert.ok(!kinds(events).includes("explode")); assert.equal(sim.throwables.size, 1);
  events = run(sim, 0.5);
  assert.ok(kinds(events).includes("explode")); assert.equal(sim.throwables.size, 0);
  const killed = events.filter((e) => e.t === "enemy_kill");
  assert.ok(killed.length >= 3); assert.ok(killed.every((e) => e.by === 1 && e.cause === "grenade"));
  assert.equal(me.kills, killed.length); assert.equal(sim.enemies.size, far.length - killed.length);
  assert.ok(sim.enemies.has(far[far.length - 1].id));
  assert.equal(me.hp, config.PLAYER_HP);                                           // đứng xa 12 m: không dính

  assert.ok(sim.throwItem(1, "grenade", [0, 0.5, 1], [0, 0, 0]));                  // thả ngay chân mình
  assert.ok(!sim.throwItem(1, "grenade", [0, 1, 0], [0, 0, 1]), "hết lựu đạn thì không ném được");
  run(sim, config.GRENADE_FUSE + 0.2);
  assert.ok(me.hp < config.PLAYER_HP && me.hp > 0, "tự ném trúng mình thì mất máu");

  const arc = new Simulation("solo", buildLayout({ seed: 1, obstacles: [[0, 10, 1]] }), 5);   // ném thẳng vào tảng đá
  arc.addPlayer(1, "A"); arc.start();
  arc.throwItem(1, "grenade", [0, 1.5, 0], [0, 0, 1]);
  for (let i = 0; i < 20; i++) arc.tick(DT);
  const g = [...arc.throwables.values()][0];
  assert.ok(Math.hypot(g.x, g.z - 10) >= 1.0 && g.z < 10, "lựu đạn phải dội khỏi vật cản"); assert.ok(g.y >= 0.15);
});

test("bom khói: địch mất dấu, xạ thủ ngừng bắn; khói tan thì đánh lại", () => {
  const sim = new Simulation("solo", buildLayout({ seed: 1, obstacles: [] }), 9);
  const me = sim.addPlayer(1, "Thầy"); sim.start(); run(sim, 3);
  for (const e of [...sim.enemies.values()].slice(1)) sim.enemies.delete(e.id);
  sim.waves.queue = [];
  const e = [...sim.enemies.values()][0];
  Object.assign(e, { spec: SHOOTER, kind: "shooter", x: 0, z: 20, cooldown: 0, age: 5 });
  assert.equal(me.smokes, config.START_SMOKES);
  assert.ok(sim.throwItem(1, "smoke", [0, 0.3, 10], [0, 0, 0]));
  let events = run(sim, config.SMOKE_FUSE + 0.2);
  assert.ok(kinds(events).includes("smoke")); assert.equal(sim.smokes.size, 1);
  sim.shots.clear(); me.stats.hp = config.PLAYER_HP;
  run(sim, 6);
  assert.equal(sim.shots.size, 0, "bị khói che thì xạ thủ không bắn"); assert.equal(me.hp, config.PLAYER_HP);
  run(sim, config.SMOKE_TIME);
  assert.equal(sim.smokes.size, 0);
  events = run(sim, 6);
  assert.ok(kinds(events).includes("hurt"), "khói tan thì bị bắn lại");
});

test("chảo đỡ đạn bắn từ phía trước, không đỡ được sau lưng", () => {
  const make = (yaw) => {
    const sim = new Simulation("solo", buildLayout({ seed: 1, obstacles: [] }), 3);
    const me = sim.addPlayer(1, "Thầy"); sim.start(); sim.tick(DT);
    sim.setPose(1, 0, 0, 0, yaw, 0); sim.setGuard(1, true);
    sim.shots.set(99, { id: 99, x: 0, y: 1.2, z: 3, vx: 0, vy: 0, vz: -17, damage: 12, life: 4 });   // đạn bay từ +z tới
    return { me, events: run(sim, 0.5) };
  };
  const front = make(0), back = make(180);
  assert.ok(kinds(front.events).includes("deflect")); assert.equal(front.me.hp, config.PLAYER_HP);
  assert.ok(kinds(back.events).includes("hurt")); assert.equal(back.me.hp, config.PLAYER_HP - 12);
});

test("vật phẩm: nhặt lựu đạn/khói được thêm, có trần; cảm ứng có nút ném", () => {
  const sim = new Simulation("solo", buildLayout({ seed: 1, obstacles: [] }), 3);
  const me = sim.addPlayer(1, "Thầy"); sim.start(); sim.tick(DT);
  for (let i = 0; i < 6; i++) { sim._drop("grenade", me.x, 0, me.z); sim._drop("smoke", me.x, 0, me.z); sim.tick(DT); }
  assert.equal(me.grenades, config.MAX_GRENADES); assert.equal(me.smokes, config.MAX_SMOKES);
  const t = new TouchControls(16 / 9), g = t.buttons.find((b) => b.name === "grenade"), s = t.buttons.find((b) => b.name === "smoke");
  assert.ok(t.poll(0.016, { 1: [g.x, g.y] }).grenade); assert.ok(!t.poll(0.016, { 1: [g.x, g.y] }).grenade);
  assert.ok(t.poll(0.016, { 1: [g.x, g.y], 2: [s.x, s.y] }).smoke);
  for (const a of t.buttons) for (const b of t.buttons) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r, `${a.name} đè ${b.name}`);
});

// ======================= bản đồ nhiều tầng =======================
const MAP = buildLayout();

test("va chạm có độ cao: tường chắn, cửa đi qua, chui dưới tầng lửng, lên dốc, đứng trên nóc container", () => {
  const c = MAP.col;
  assert.deepEqual(c.resolve(12, 8.2, 0.45, 0, 52).map((v) => +v.toFixed(2)), [12, 7.55]);      // đâm vào tường nam nhà kho
  assert.deepEqual(c.resolve(18, 8.2, 0.45, 0, 52), [18, 8.2]);                                // cửa lớn: đi qua
  assert.equal(c.ground(15, 19, 0), 0); assert.deepEqual(c.resolve(15, 19, 0.45, 0, 52), [15, 19]);   // dưới tầng lửng
  assert.equal(c.ground(15, 19, 3.25), 3.25);                                                   // trên tầng lửng
  near(c.ground(14.5, 15.3, 1.4), 3.25 * 0.5, 0.01);                                            // giữa dốc
  assert.equal(c.ground(14.5, 15.3, 0), 0, "đứng dưới đất cạnh giữa dốc thì không tự nhảy lên được");
  assert.ok(c.resolve(14.5, 14.0, 0.45, 0, 52)[1] < 13.8, "hông dốc chắn như tường");
  assert.equal(c.ground(-23, -11, 2.6), 2.6);                                                   // nóc container
  assert.ok(c.resolve(-23, -9.3, 0.45, 0, 52)[1] > -9.2, "đứng dưới đất thì container chắn");
  assert.deepEqual(c.resolve(-23, -9.8, 0.45, 2.6, 52), [-23, -9.8]);                           // ở trên nóc thì đi tự do
  assert.equal(c.ground(10.5, -8, 0), 0); assert.equal(c.ground(10.5, -8, 0.5), 1.0, "rào bê tông 1 m: nhảy mới lên được");
  assert.ok(c.ceiling(15, 19, 0) === 3.0);
  assert.equal(c.deckOf(15, 3.25, 19).id, "mezz"); assert.equal(c.deckOf(15, 0, 19), null);
  assert.equal(c.deckOf(-19, 3.6, 17).id, "tower");
});

test("tầm nhìn và đường đạn qua công trình: tường che, cửa sổ và cửa ra vào thì không", () => {
  const c = MAP.col, solids = buildSolids(MAP), fwdN = [0, 0, 1], fwdE = [1, 0, 0];
  assert.ok(c.sightBlocked([12, 1.5, 4], [12, 1.5, 12]));                                      // xuyên tường nam
  assert.ok(!c.sightBlocked([18, 1.5, 4], [18, 1.5, 12]));                                     // qua cửa lớn
  assert.ok(!c.sightBlocked([32, 1.7, 12.5], [20, 1.7, 12.5]), "cửa sổ tường đông nhìn xuyên được");
  assert.ok(c.sightBlocked([32, 0.6, 12.5], [20, 0.6, 12.5]), "dưới bệ cửa sổ thì bị che");
  near(castRay([12, 1.5, 4], fwdN, 90, solids, []).dist, 4);                                    // đạn dừng ở tường
  const inside = { id: 1, kind: "enemy", x: 18, y: 0, z: 14, shape: GRUNT.shape };
  assert.equal(castRay([18, 1.2, 2], fwdN, 90, solids, [inside]).target, inside);              // bắn qua cửa trúng địch bên trong
  const upstairs = { id: 2, kind: "enemy", x: 26, y: 3.25, z: 18, shape: GRUNT.shape };
  assert.equal(castRay([12, 3.25 + 1.2, 18], fwdE, 90, solids, [upstairs]).target, upstairs);  // cùng tầng lửng
  assert.equal(castRay([12, 1.2, 18], fwdE, 90, solids, [upstairs]).target, null, "đứng dưới bắn ngang không trúng người ở tầng trên");
});

test("tìm đường: địch đứng sau tường vòng qua cửa tới chỗ người chơi trong nhà kho", () => {
  const sim = new Simulation("solo", buildLayout(), 4);
  const me = sim.addPlayer(1, "Thầy"); sim.start(); sim.tick(DT);
  sim.setPose(1, 18, 0, 12, 0, 0);
  sim.waves.timer = 999;
  const e = sim.enemies.set(77, null) && null;
  sim.enemies.delete(77);
  sim.waves.queue = ["grunt"]; sim.waves.fighting = true; sim.waves.spawnTimer = 0; sim.tick(DT); sim.waves.queue = ["grunt"];
  const foe = [...sim.enemies.values()][0];
  foe.x = 12; foe.z = 25; foe.y = 0;                                                            // ngay sau tường bắc
  let reached = false;
  for (let i = 0; i < 30 * 30 && !reached; i++) { sim.setPose(1, 18, 0, 12, 0, 0); me.stats.hp = 100; sim.tick(DT);
    reached = Math.hypot(foe.x - 18, foe.z - 12) < 2.2; }
  assert.ok(reached, `địch kẹt ở (${foe.x.toFixed(1)}, ${foe.z.toFixed(1)})`);
});

test("leo tầng: người chơi đứng trên tầng lửng / tháp canh / nóc container thì địch vẫn tìm được đường lên đánh", () => {
  for (const [name, px, py, pz] of [["tầng lửng", 24, 3.25, 19], ["tháp canh", -19, 3.6, 17], ["nóc container", -23, 2.6, -15.5]]) {
    const sim = new Simulation("solo", buildLayout(), 4);
    const me = sim.addPlayer(1, "Thầy"); sim.start(); sim.tick(DT);
    sim.waves.queue = ["grunt"]; sim.waves.fighting = true; sim.waves.spawnTimer = 0;
    sim.setPose(1, px, py, pz, 0, 0); sim.tick(DT); sim.waves.queue = ["grunt"];
    const foe = [...sim.enemies.values()][0];
    foe.x = 0; foe.z = 0; foe.y = 0;
    let hurt = false, t = 0;
    for (; t < 60 * 30 && !hurt; t++) { sim.setPose(1, px, py, pz, 0, 0); hurt = sim.tick(DT).some((ev) => ev.t === "hurt"); }
    assert.ok(hurt, `${name}: địch không lên được, kẹt ở (${foe.x.toFixed(1)}, ${foe.y.toFixed(1)}, ${foe.z.toFixed(1)})`);
    assert.ok(Math.abs(foe.y - py) < 0.6, `${name}: địch phải đứng cùng tầng khi ra đòn`);
  }
});

test("mọi loại địch có vùng trúng đạn riêng", () => {
  assert.ok(RUNNER.shape.h < GRUNT.shape.h); assert.ok(SHOOTER.shape.headY > GRUNT.shape.headY);
  assert.ok(BRUTE.shape.r > GRUNT.shape.r * 2); assert.equal(BRUTE.stagger, 0);
  const sim = new Simulation("solo", buildLayout({ seed: 1, obstacles: [] }), 4);
  sim.addPlayer(1, "A"); sim.start(); run(sim, 3);
  const e = [...sim.enemies.values()][0];
  sim.hitEnemy(1, e.id, 20, false);
  assert.ok(e.stagger > 0, "trúng đạn thì khựng lại");
});

test("bot: Đoàn kết có đồng đội máy biết bắn địch; PvP với máy chạy tới khi có người thắng", () => {
  const coop = new Simulation("coop", buildLayout(), 7);
  coop.addPlayer(1, "Thầy"); coop.addPlayer(2, "Sói Xám", true); coop.addPlayer(3, "Đại Bàng", true); coop.start();
  let events = [];
  for (let i = 0; i < 30 * 40; i++) { coop.setPose(1, 0, 0, -1.5, 0, 0); coop.players.get(1).stats.hp = 100; events = events.concat(coop.tick(DT)); }
  const botKills = coop.players.get(2).kills + coop.players.get(3).kills;
  assert.ok(events.some((e) => e.t === "shot" && e.p !== 1), "bot phải nổ súng");
  assert.ok(botKills >= 2, `bot hạ được ${botKills} địch trong 40 giây`);

  const pvp = new Simulation("pvp", buildLayout(), 7);
  pvp.addPlayer(1, "Thầy"); for (let i = 0; i < 3; i++) pvp.addPlayer(2 + i, config.BOT_NAMES[i], true);
  pvp.start();
  for (let i = 0; i < 30 * 320 && !pvp.over; i++) pvp.tick(DT);
  assert.ok(pvp.over, "trận PvP phải kết thúc (đủ mạng hoặc hết giờ)");
  const total = pvp.over.ranking.reduce((s, r) => s + r.kills, 0);
  assert.ok(total >= 5, `các bot phải hạ được nhau (tổng ${total} mạng)`);
  for (const p of pvp.players.values()) assert.ok(Math.hypot(p.x, p.z) <= config.ARENA_RADIUS && Number.isFinite(p.y));
});
