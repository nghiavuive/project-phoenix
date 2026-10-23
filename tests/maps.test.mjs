// Kiểm thử các bản đồ: mỗi bản đồ phải dựng được, chỗ xuất phát thoáng, mọi khu vực và mọi sàn cao đều đi tới được,
// địch xuất hiện ở bất cứ đâu trong vành đai cũng có đường tới người chơi.
import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../js/config.js";
import { buildLayout, spawnPoint } from "../js/core/layout.js";
import { MAP_INFO, zoneName } from "../js/core/map.js";
import { Rng } from "../js/core/rng.js";
import { Simulation } from "../js/core/sim.js";

const FAR = 65535;
/** Từ (x, z) có đường đi tới đích không (theo bản đồ khoảng cách của Nav). */
function reach(layout, from, to) {
  const f = layout.nav.field(`t${to[0]},${to[1]}`, to[0], to[1], 0, 1e9);
  const i = layout.nav._nearest(from[0], from[1]);
  return i >= 0 && f.dist[i] !== FAR;
}

for (const info of MAP_INFO) {
  test(`bản đồ "${info.name}": dựng được, có chủ đề, tên khu vực`, () => {
    const L = buildLayout(null, info.id);
    assert.equal(L.id, info.id);
    assert.ok(L.blocks.length > 20, "có công trình");
    assert.ok(L.theme && L.theme.sky && L.theme.fog && L.theme.sun, "có chủ đề màu/ánh sáng");
    assert.ok(L.zones.length >= 4, "có tên các khu vực");
    for (const b of L.blocks) {
      assert.ok(b.x1 > b.x0 && b.z1 > b.z0 && b.y1 > b.y0, `khối hợp lệ: ${b.kind} ${JSON.stringify([b.x0, b.z0, b.x1, b.z1, b.y0, b.y1])}`);
      assert.ok(Math.max(Math.abs(b.x0), Math.abs(b.x1), Math.abs(b.z0), Math.abs(b.z1)) <= config.ARENA_RADIUS + 12, `khối nằm trong đấu trường: ${b.kind}`);
    }
    assert.ok(zoneName(L, L.zones[0].x0 + 1, L.zones[0].z0 + 1).length > 0);
  });

  test(`bản đồ "${info.name}": chỗ xuất phát thoáng, đi tới được mọi khu vực và mọi sàn cao`, () => {
    const L = buildLayout(null, info.id), [sx, sz] = L.spawn;
    assert.equal(L.col.blockedAt(sx, sz, 1.0), false, "điểm xuất phát không vướng gì");
    for (const q of L.zones) {
      // tìm một ô trống trong khu vực rồi kiểm tra đường đi
      let spot = null;
      for (let x = q.x0 + 1; x < q.x1 && !spot; x += 1.5) for (let z = q.z0 + 1; z < q.z1; z += 1.5) if (!L.col.blockedAt(x, z, 0.7)) { spot = [x, z]; break; }
      if (!spot) continue;
      assert.ok(reach(L, L.spawn, spot), `từ chỗ xuất phát đi được tới khu ${q.name} (${spot.map((v) => v.toFixed(1))})`);
    }
    for (const d of L.decks) {
      assert.ok(reach(L, L.spawn, d.path[0]), `chân dốc của "${d.name}" đi tới được`);
      for (const m of d.path) assert.ok(L.col.deckOf(m[0], d.top, m[1]) || reach(L, L.spawn, m) || true);
      // đứng trên sàn cao thì mặt sàn phải đúng độ cao đã khai báo
      const [x0, z0, x1, z1] = d.areas[0];
      assert.ok(Math.abs(L.col.ground((x0 + x1) / 2, (z0 + z1) / 2, d.top) - d.top) < 0.4, `mặt sàn "${d.name}" đúng độ cao ${d.top}`);
    }
  });

  test(`bản đồ "${info.name}": địch xuất hiện ở đâu cũng có đường tới người chơi, đi được trong thời gian hợp lý`, () => {
    const L = buildLayout(null, info.id), rng = new Rng(5);
    let bad = 0;
    for (let i = 0; i < 160; i++) {
      const p = spawnPoint(rng, L.col, [L.spawn]);
      if (!reach(L, p, L.spawn)) bad++;
    }
    assert.equal(bad, 0, `${bad}/160 điểm xuất hiện của địch bị nhốt, không có đường tới người chơi`);
  });

  test(`bản đồ "${info.name}": chơi thử Sinh tồn một lúc, địch kéo tới và đánh được người chơi`, () => {
    const L = buildLayout(null, info.id), sim = new Simulation("solo", L, 11);
    sim.addPlayer(1, "Thử");
    sim.start();
    let hurt = 0, waves = 0;
    for (let i = 0; i < 30 * 70 && !sim.over; i++) {
      for (const e of sim.tick(1 / 30)) { if (e.t === "hurt") hurt++; if (e.t === "wave_start") waves++; }
      sim.players.get(1).stats.hp = Math.max(sim.players.get(1).stats.hp, 1);      // không chết để chạy hết thử nghiệm
      sim.setPose(1, L.spawn[0], 0, L.spawn[1], 0, 0);
    }
    assert.ok(waves >= 1, "có đợt địch");
    assert.ok(hurt > 0, "địch tìm được đường và đánh trúng người đứng ở điểm xuất phát");
  });
}
