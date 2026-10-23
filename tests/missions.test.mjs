// Kiểm thử nhiệm vụ: định nghĩa hợp lệ, mọi mục tiêu đứng được và đi tới được, và một người chơi tự động
// hoàn thành được từng nhiệm vụ từ đầu tới cuối (đúng thứ tự chặng, đúng sao, thua thì không có sao).
import assert from "node:assert/strict";
import test from "node:test";
import { buildLayout } from "../js/core/layout.js";
import { MAP_INFO } from "../js/core/map.js";
import { MISSIONS, isUnlocked, missionById, nextMission } from "../js/core/missions.js";
import { Simulation } from "../js/core/sim.js";

const FAR = 65535;
const reach = (L, from, to) => {
  const f = L.nav.field(`m${to[0]},${to[1]}`, to[0], to[1], 0, 1e9), i = L.nav._nearest(from[0], from[1]);
  return i >= 0 && f.dist[i] !== FAR;
};

test("nhiệm vụ: định nghĩa hợp lệ, có đủ trên cả bốn bản đồ", () => {
  assert.ok(MISSIONS.length >= 8);
  assert.equal(new Set(MISSIONS.map((m) => m.id)).size, MISSIONS.length, "mã không trùng");
  for (const info of MAP_INFO) assert.ok(MISSIONS.some((m) => m.map === info.id), `bản đồ ${info.name} có nhiệm vụ`);
  for (const m of MISSIONS) {
    assert.ok(MAP_INFO.some((i) => i.id === m.map), `${m.id}: bản đồ tồn tại`);
    assert.ok(m.title && m.brief && m.par > 0 && m.startWave >= 1 && m.stages.length >= 1, `${m.id}: đủ thông tin`);
    for (const st of m.stages) {
      assert.ok(["kill", "survive", "collect", "hold", "reach", "boss"].includes(st.type), `${m.id}: loại chặng ${st.type}`);
      assert.ok(st.text, `${m.id}: chặng có lời mô tả`);
    }
  }
});

test("nhiệm vụ: mở khoá lần lượt, xong cái trước mới mở cái sau", () => {
  assert.equal(isUnlocked("m1", {}), true);
  assert.equal(isUnlocked("m2", {}), false);
  assert.equal(isUnlocked("m2", { m1: { stars: 1 } }), true);
  assert.equal(isUnlocked("m3", { m1: { stars: 3 } }), false, "phải xong cái ngay trước");
  assert.equal(nextMission("m1").id, "m2");
  assert.equal(nextMission(MISSIONS.at(-1).id), null);
  assert.equal(missionById("không có"), null);
});

for (const m of MISSIONS) {
  test(`nhiệm vụ ${m.id} "${m.title}": mọi mục tiêu đứng được và đi tới được từ chỗ xuất phát`, () => {
    const L = buildLayout(null, m.map);
    for (const st of m.stages) {
      const points = st.items || (st.x !== undefined ? [[st.x, st.z]] : []);
      for (const [x, z] of points) {
        assert.equal(L.col.blockedAt(x, z, 0.7), false, `(${x}, ${z}) không nằm trong vật cản`);
        assert.ok(reach(L, L.spawn, [x, z]), `đi từ chỗ xuất phát tới (${x}, ${z}) được`);
        assert.ok(Math.hypot(x, z) < 50, "trong đấu trường");
      }
      if (st.type === "hold" || st.type === "reach") assert.ok(st.r >= 2.5, "vòng đủ rộng");
    }
  });
}

/** Người chơi tự động: đi thẳng theo mục tiêu (có bản đồ khoảng cách), bắn hạ địch gần nhất, giữ cho khỏi chết. */
function autoPlay(def, { seconds = 600, immortal = true } = {}) {
  const L = buildLayout(null, def.map), sim = new Simulation("mission", L, 3, { mission: def });
  const me = sim.addPlayer(1, "Thử");
  sim.start();
  const stagesSeen = [], events = [];
  let cd = 0;
  for (let t = 0; t < seconds * 30 && !sim.over; t++) {
    const dt = 1 / 30;
    for (const e of sim.tick(dt)) { events.push(e); if (e.t === "mission_stage") stagesSeen.push(e.i); }
    if (sim.over) break;
    if (immortal) me.stats.hp = Math.max(me.stats.hp, 70);
    // bắn địch gần nhất trong tầm 40 m (xạ thủ đứng xa 14 m theo thiết kế, người thật vẫn bắn được)
    cd -= dt;
    const near = [...sim.enemies.values()].sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
    if (near && cd <= 0 && Math.hypot(near.x - me.x, near.z - me.z) < 40) { sim.hitEnemy(1, near.id, 60, false); cd = 0.18; }
    // đi tới điểm sáng chỉ đường (nếu có), không thì đứng yên
    const goal = sim.mission && sim.mission.marker();
    if (goal && goal.kind !== "boss") {
      const f = L.nav.field("auto", goal.x, goal.z, sim.clock, 0.4), next = L.nav.next(f, me.x, me.z, 1) || [goal.x, goal.z];
      const d = Math.hypot(next[0] - me.x, next[1] - me.z) || 1, step = Math.min(d, 6 * dt);
      const [nx, nz] = L.col.resolve(me.x + ((next[0] - me.x) / d) * step, me.z + ((next[1] - me.z) / d) * step, 0.45, me.y, 52);
      sim.setPose(1, nx, L.col.ground(nx, nz, me.y), nz, 0, 0);
    }
  }
  return { sim, me, stagesSeen, events };
}

for (const m of MISSIONS) {
  test(`nhiệm vụ ${m.id} "${m.title}": người chơi tự động hoàn thành, các chặng đi đúng thứ tự, có sao`, () => {
    const { sim, stagesSeen } = autoPlay(m);
    assert.ok(sim.over, "nhiệm vụ phải kết thúc trong 10 phút chơi thử");
    assert.equal(sim.over.mission.victory, true, "thắng");
    assert.ok(sim.over.mission.stars >= 1 && sim.over.mission.stars <= 3, `số sao hợp lệ: ${sim.over.mission.stars}`);
    assert.deepEqual(stagesSeen, m.stages.map((_, i) => i), "đi qua đủ các chặng theo thứ tự");
    assert.equal(sim.over.mission.id, m.id);
    assert.equal(sim.info().mission.done, true);
  });
}

test("nhiệm vụ: gục thì thua, không có sao", () => {
  const def = MISSIONS[0], L = buildLayout(null, def.map), sim = new Simulation("mission", L, 3, { mission: def });
  const me = sim.addPlayer(1, "Thử");
  sim.start();
  for (let t = 0; t < 30 * 200 && !sim.over; t++) { sim.tick(1 / 30); me.stats.hp = 0; me.alive = false; }
  assert.ok(sim.over);
  assert.equal(sim.over.mission.victory, false);
  assert.equal(sim.over.mission.stars, 0);
});

test("nhiệm vụ: giữ chốt tụt tiến độ khi bước ra ngoài vòng, nhanh hơn par thì thêm sao", () => {
  const def = missionById("m3"), L = buildLayout(null, def.map), sim = new Simulation("mission", L, 3, { mission: def });
  const me = sim.addPlayer(1, "Thử");
  sim.start();
  const st = def.stages[0];
  sim.setPose(1, st.x, 0, st.z, 0, 0);
  for (let t = 0; t < 30 * 10; t++) { sim.tick(1 / 30); me.stats.hp = 100; sim.setPose(1, st.x, 0, st.z, 0, 0); }
  const inside = sim.mission.prog;
  assert.ok(inside > 8 && inside < 11, `đứng trong vòng 10 giây được khoảng 10 (đang là ${inside.toFixed(1)})`);
  for (let t = 0; t < 30 * 6; t++) { sim.tick(1 / 30); me.stats.hp = 100; sim.setPose(1, st.x + 30, 0, st.z, 0, 0); }
  assert.ok(sim.mission.prog < inside - 2, "ra ngoài vòng thì tiến độ tụt");
});

test("nhiệm vụ: info() cho giao diện có đủ chữ, tiến độ và điểm chỉ đường", () => {
  const def = missionById("m2"), L = buildLayout(null, def.map), sim = new Simulation("mission", L, 3, { mission: def });
  sim.addPlayer(1, "Thử");
  sim.start();
  const info = sim.info().mission;
  assert.equal(info.title, "Dữ liệu mật");
  assert.equal(info.goal, 3);
  assert.equal(info.prog, 0);
  assert.ok(info.marker && info.marker.kind === "item", "điểm sáng chỉ vào hộp gần nhất");
  assert.equal(sim.pickups.size, 3, "đã thả ba hộp dữ liệu");
  for (const k of sim.pickups.values()) assert.equal(k.kind, "intel");
});
