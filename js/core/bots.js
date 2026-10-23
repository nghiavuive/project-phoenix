// Người chơi máy (bot): đồng đội trong Đoàn kết, đối thủ trong PvP. Thuần logic, chạy trong mô phỏng.
// Bot dùng đúng các "cửa" mà người chơi thật dùng: đặt vị trí của mình, báo bắn trúng ai.
import { config } from "../config.js";

const EYE = 1.5;

export class Bots {
  constructor(sim) {
    this.sim = sim;
    this.state = new Map();
  }

  tick(dt) {
    for (const p of this.sim.players.values()) {
      if (!p.bot) continue;
      let st = this.state.get(p.id);
      if (!st) { st = { cool: 1 + Math.random(), burst: 0, strafe: 1, flip: 2, seenAt: 0 }; this.state.set(p.id, st); }
      if (p.alive) this._tick(p, st, dt);
    }
  }

  _sees(p, tx, ty, tz) {
    return !this.sim.col.sightBlocked([p.x, p.y + EYE, p.z], [tx, ty, tz]) && !this.sim._smoked(p.x, p.z, tx, tz);
  }

  _tick(p, st, dt) {
    const sim = this.sim, col = sim.col, nav = sim.nav, pvp = sim.mode === "pvp";
    // ----- chọn mục tiêu: gần nhất, ưu tiên cái đang nhìn thấy -----
    const pool = pvp ? [...sim.players.values()].filter((o) => o !== p && o.alive && o.shield <= 0) : [...sim.enemies.values()];
    let target = null, best = Infinity, sight = false;
    for (const t of pool) {
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      const h = pvp ? 1.2 : t.spec.shape.h * 0.7;
      const sees = d < 55 && this._sees(p, t.x, t.y + h, t.z);
      const score = d + (sees ? 0 : 40);
      if (score < best) { best = score; target = t; sight = sees; }
    }
    const dist = target ? Math.hypot(target.x - p.x, target.z - p.z) : 0;

    // ----- chọn chỗ muốn tới -----
    st.flip -= dt;
    if (st.flip <= 0) { st.strafe = -st.strafe; st.flip = 1.2 + Math.random() * 2; }
    let goal = null, speed = config.BOT_SPEED;
    const leader = pvp ? null : [...sim.players.values()].find((o) => !o.bot && o.alive);
    const toLeader = leader ? Math.hypot(leader.x - p.x, leader.z - p.z) : 0;
    if (leader && toLeader > 10) {                                   // Đoàn kết: bám theo người chơi
      goal = nav.next(nav.field(`p${leader.id}`, leader.x, leader.z, sim.clock), p.x, p.z) || [leader.x, leader.z];
    } else if (target && sight) {
      const ux = (target.x - p.x) / (dist || 1), uz = (target.z - p.z) / (dist || 1);
      const want = pvp ? 13 : 9;                                     // giữ cự ly, đi ngang cho khó trúng
      const push = dist < want - 3 ? -1 : dist > want + 4 ? 1 : 0;
      goal = [p.x + (ux * push - uz * st.strafe) * 3, p.z + (uz * push + ux * st.strafe) * 3];
      speed *= 0.75;
    } else if (target) {
      goal = nav.next(nav.field(pvp ? `p${target.id}` : `e${target.id}`, target.x, target.z, sim.clock, 0.8), p.x, p.z);
    } else if (leader && toLeader > 5) {
      goal = [leader.x, leader.z];
    }
    if (goal) {
      const dx = goal[0] - p.x, dz = goal[1] - p.z, d = Math.hypot(dx, dz);
      if (d > 0.3) {
        [p.x, p.z] = col.resolve(p.x + (dx / d) * speed * dt, p.z + (dz / d) * speed * dt, config.PLAYER_RADIUS, p.y, config.ARENA_RADIUS);
        if (!target || !sight) p.yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
      }
    }
    const g = col.ground(p.x, p.z, p.y);
    p.y = g > p.y ? g : Math.max(g, p.y - 14 * dt);
    if (target && sight) {
      p.yaw = (Math.atan2(target.x - p.x, target.z - p.z) * 180) / Math.PI;
      p.pitch = (-Math.atan2(target.y - p.y, dist || 1) * 180) / Math.PI;
    }

    // ----- bắn theo loạt -----
    st.cool -= dt;
    if (!target || !sight || dist > 50 || st.cool > 0) return;
    st.cool = 0.15;
    if (++st.burst >= 5) { st.burst = 0; st.cool = 0.7 + Math.random() * 0.9; }
    const chance = Math.max(0.1, Math.min(config.BOT_AIM, config.BOT_AIM + 0.1 - dist / 70));
    const hit = sim.rng.random() < chance;
    const h = pvp ? 1.15 : target.spec.shape.h * 0.7;
    const miss = hit ? 0 : 1.2;
    const to = [target.x + sim.rng.uniform(-miss, miss), target.y + h + sim.rng.uniform(-miss, miss), target.z + sim.rng.uniform(-miss, miss)];
    const yaw = (p.yaw * Math.PI) / 180;
    sim._emit("shot", { p: p.id, from: [p.x + Math.sin(yaw) * 0.6, p.y + 1.25, p.z + Math.cos(yaw) * 0.6], to, hit });
    if (!hit) return;
    if (pvp) sim.hitPlayer(p.id, target.id, config.BOT_DAMAGE_PVP, false);
    else sim.hitEnemy(p.id, target.id, config.BOT_DAMAGE_COOP, sim.rng.random() < 0.12);
  }
}
