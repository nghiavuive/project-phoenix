// Mô phỏng một trận đấu - thuần logic, không vẽ gì.
// Chế độ: "solo" | "coop" (đoàn kết chống địch) | "pvp" (đấu với nhau). Người chơi có thể là người thật hoặc máy (bot).
// Mọi vị trí đều có độ cao: người và địch đi lên dốc, đứng trên tầng lửng, rơi khỏi mép sàn.
import { config } from "../config.js";
import { Bots } from "./bots.js";
import { SPECS, seek, steer } from "./enemies.js";
import { segmentBlocked } from "./geometry.js";
import { buildLayout, spawnPoint } from "./layout.js";
import { MissionRun } from "./missions.js";
import { Rng } from "./rng.js";
import { PlayerStats } from "./state.js";
import { WaveDirector } from "./waves.js";

export const MODE_NAMES = { solo: "Chơi đơn", coop: "Đoàn kết", pvp: "PvP", mission: "Nhiệm vụ" };
const SHOT_SPEED = 17;

class SimPlayer {
  constructor(id, name, bot) {
    this.id = id; this.name = name; this.bot = bot;
    this.x = this.y = this.z = 0;
    this.yaw = this.pitch = 0;
    this.stats = new PlayerStats();
    this.alive = true;
    this.deaths = 0;
    this.respawn = 0;
    this.shield = 0;
    this.grenades = config.START_GRENADES;
    this.smokes = config.START_SMOKES;
    this.guard = false;               // đang cầm chảo: đỡ được đạn bắn từ phía trước
  }
  get hp() { return this.stats.hp; }
  get score() { return this.stats.score; }
  get kills() { return this.stats.kills; }
  get headshots() { return this.stats.headshots; }
  get combo() { return this.stats.combo; }
  get comboTimer() { return this.stats.comboTimer; }
  get multiplier() { return this.stats.multiplier; }
}

class SimEnemy {
  constructor(id, spec, x, z, wave, rng) {
    this.id = id; this.spec = spec; this.kind = spec.kind;
    this.x = x; this.y = 0; this.z = z; this.yaw = 0;
    this.maxHp = spec.hp * (1 + 0.06 * (wave - 1));
    this.hp = this.maxHp;
    this.cooldown = rng.uniform(0.3, 1.0);
    this.strafe = rng.choice([-1, 1]);
    this.strafeTimer = rng.uniform(1.5, 3.5);
    this.age = 0;
    this.lunge = 0;                   // vừa ra đòn (để vẽ động tác)
    this.stagger = 0;                 // vừa trúng đạn: khựng lại một nhịp
    this.seen = [x, z];               // chỗ cuối cùng nó nhìn thấy mục tiêu (dùng khi bị khói che)
    this.route = null;                // đang leo lên sàn cao nào, tới mốc thứ mấy
  }
}

export class Simulation {
  /** opts.mission: định nghĩa nhiệm vụ (xem core/missions.js) khi mode là "mission". */
  constructor(mode = "solo", layout = buildLayout(), rngSeed, opts = {}) {
    this.mode = mode;
    this.missionDef = mode === "mission" ? opts.mission || null : null;
    this.mission = null;              // diễn biến nhiệm vụ, tạo lúc bắt đầu trận (cần người chơi đã đứng đúng chỗ)
    this.layout = layout;
    this.seed = layout.seed;
    this.col = layout.col;
    this.nav = layout.nav;
    this.rng = new Rng(rngSeed);
    this.players = new Map(); this.enemies = new Map(); this.shots = new Map(); this.pickups = new Map();
    this.throwables = new Map();      // lựu đạn / bom khói đang bay
    this.smokes = new Map();          // đám khói đang toả
    this.waves = new WaveDirector(rngSeed);
    this.bots = new Bots(this);
    this.events = [];
    this.started = false;
    this.over = null;                 // kết quả khi trận kết thúc
    this.clock = 0;
    this.bonus = 0;                   // điểm thưởng dọn đợt (chung cả đội)
    this.timeLeft = config.PVP_TIME;
    this.pickupTimer = config.PVP_PICKUP_EVERY;
    this._next = 1;
  }

  // ================= người chơi =================
  addPlayer(id, name, bot = false) {
    const p = new SimPlayer(id, name, bot);
    this.players.set(id, p);
    this._place(p);
    return p;
  }
  removePlayer(id) { this.players.delete(id); }

  setPose(id, x, y, z, yaw, pitch) {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    const limit = config.ARENA_RADIUS;
    p.x = Math.max(-limit, Math.min(limit, x));
    p.z = Math.max(-limit, Math.min(limit, z));
    p.y = Math.max(0, Math.min(12, y));
    p.yaw = yaw; p.pitch = pitch;
  }

  start() {
    if (this.started) return;
    this.started = true;
    for (const p of this.players.values()) {
      this._place(p);
      this._emit("spawn", { p: p.id, x: p.x, z: p.z });
    }
    if (this.missionDef) {
      this.waves.number = this.missionDef.startWave - 1;           // độ khó khởi điểm của nhiệm vụ
      this.mission = new MissionRun(this.missionDef, this);
    }
  }

  get teamScore() {
    let total = this.bonus;
    for (const p of this.players.values()) total += p.score;
    return total;
  }
  _alive() { return [...this.players.values()].filter((p) => p.alive); }

  _place(player) {
    if (this.mode === "pvp") {
      const others = [...this.players.values()].filter((o) => o !== player && o.alive).map((o) => [o.x, o.z]);
      [player.x, player.z] = spawnPoint(this.rng, this.col, others, 18, 8);
    } else {                          // chơi đơn / đoàn kết: đứng thành vòng quanh điểm xuất phát
      const ids = [...this.players.keys()].sort((a, b) => a - b), [sx, sz] = this.layout.spawn;
      const angle = (Math.max(0, ids.indexOf(player.id)) * Math.PI * 2) / Math.max(3, this.players.size);
      const r = this.players.size > 1 ? 2.2 : 0;
      player.x = sx + Math.sin(angle) * r; player.z = sz + Math.cos(angle) * r;
    }
    player.y = 0;
  }

  // ================= bước mô phỏng =================
  /** Tiến một bước, trả về danh sách sự kiện phát sinh từ lần gọi trước. */
  tick(dt) {
    if (this.started && !this.over) {
      this.clock += dt;
      for (const p of this.players.values()) {
        p.stats.tick(dt);
        p.shield = Math.max(0, p.shield - dt);
      }
      this.bots.tick(dt);
      if (this.mode === "pvp") this._tickPvp(dt); else this._tickWaves(dt);
      this._tickShots(dt);
      this._tickPickups(dt);
      this._tickThrowables(dt);
    }
    const events = this.events;
    this.events = [];
    return events;
  }
  _emit(t, data = {}) { this.events.push({ t, ...data }); }
  _newId() { return ++this._next; }

  // ---------- đoàn kết / chơi đơn ----------
  _tickWaves(dt) {
    const alive = this._alive();
    if (!alive.length) { this._finish(); return; }
    const [spawns, event] = this.waves.tick(dt, this.enemies.size);
    if (event === "wave_start") {
      const q = this.waves.queue;
      const extra = Math.floor(q.length * config.COOP_EXTRA * (this.players.size - 1));
      for (let i = 0; i < extra; i++) q.push(this.rng.choice(q));
      this._emit("wave_start", { n: this.waves.number, count: q.length });
    } else if (event === "wave_clear") {
      const bonus = 250 * this.waves.number * this.players.size;
      this.bonus += bonus;
      for (const p of this.players.values()) {
        if (p.alive) { p.stats.heal(15); continue; }
        p.alive = true;                // đồng đội đã gục được hồi sinh
        p.stats.hp = config.COOP_REVIVE_HP;
        [p.x, p.z] = this.col.resolve(alive[0].x + 1.5, alive[0].z, config.PLAYER_RADIUS, alive[0].y, config.ARENA_RADIUS);
        p.y = alive[0].y;
        this._emit("spawn", { p: p.id, x: p.x, y: p.y, z: p.z, revived: true });
      }
      this._emit("wave_clear", { n: this.waves.number, bonus });
    }
    const spots = alive.map((p) => [p.x, p.z]);
    for (const kind of spawns) this._spawnEnemy(kind, spots);
    if (this.mission) this.mission.tick(dt, alive);
    const all = [...this.enemies.values()];
    const positions = all.map((e) => [e.x, e.z]);
    all.forEach((e, i) => this._tickEnemy(e, dt, alive, positions.filter((_, j) => j !== i)));
  }

  /** Thả một kẻ địch ở chỗ trống, xa các điểm `avoid`. Trả về mã của nó. */
  _spawnEnemy(kind, avoid = []) {
    const [x, z] = spawnPoint(this.rng, this.col, avoid);
    const id = this._newId();
    this.enemies.set(id, new SimEnemy(id, SPECS[kind], x, z, Math.max(1, this.waves.number), this.rng));
    return id;
  }

  _tickEnemy(e, dt, alive, neighbors) {
    const spec = e.spec, col = this.col;
    e.age += dt;
    e.lunge = Math.max(0, e.lunge - dt * 4);
    e.stagger = Math.max(0, e.stagger - dt);
    e.strafeTimer -= dt;
    if (e.strafeTimer <= 0) { e.strafe = -e.strafe; e.strafeTimer = this.rng.uniform(1.5, 3.5); }

    let target = alive[0], bestD = Infinity;
    for (const p of alive) {
      const d = (p.x - e.x) ** 2 + (p.z - e.z) ** 2 + ((p.y - e.y) * 2) ** 2;
      if (d < bestD) { bestD = d; target = p; }
    }
    const dx = target.x - e.x, dz = target.z - e.z, dist = Math.hypot(dx, dz), climb = target.y - e.y;
    // Khói che tầm nhìn: địch chỉ còn biết chỗ cuối cùng nó thấy mục tiêu, tới nơi thì đi loanh quanh.
    const blind = dist > 2.5 && this._smoked(e.x, e.z, target.x, target.z);
    if (!blind) e.seen = [target.x, target.z];
    else if (Math.hypot(e.seen[0] - e.x, e.seen[1] - e.z) < 1.5) {
      e.seen = [e.x + this.rng.uniform(-7, 7), e.z + this.rng.uniform(-7, 7)];
    }

    // ----- chọn đường: thẳng tới nếu thông thoáng, không thì theo bản đồ khoảng cách, cần leo thì theo các mốc -----
    let v;
    const deck = blind ? null : col.deckOf(target.x, target.y, target.z);
    if (blind) {
      e.route = null;
      v = seek([e.x, e.z], e.seen, spec.speed * 0.7, neighbors);
    } else if (deck && col.deckOf(e.x, e.y, e.z) !== deck) {
      if (!e.route || e.route.deck !== deck.id) e.route = { deck: deck.id, i: 0, t: 0 };
      const r = e.route, path = deck.path;
      r.t += dt;
      if (Math.hypot(path[r.i][0] - e.x, path[r.i][1] - e.z) < 0.9 && r.i < path.length - 1) { r.i += 1; r.t = 0; }
      if (r.t > 9) { r.i = 0; r.t = 0; }                                // quá lâu không tới mốc kế (lạc, rơi xuống): làm lại từ đầu
      const mark = path[r.i];
      const goal = r.i === 0 ? this.nav.next(this.nav.field(`deck:${deck.id}`, mark[0], mark[1], this.clock, 60), e.x, e.z) || mark : mark;
      v = seek([e.x, e.z], Math.hypot(mark[0] - e.x, mark[1] - e.z) < 2.5 ? mark : goal, spec.speed, neighbors);
    } else {
      e.route = null;
      const clear = dist < 2 || !col.sightBlocked([e.x, e.y + 0.5, e.z], [target.x, target.y + 0.5, target.z]);
      if (clear) v = steer([e.x, e.z], [target.x, target.z], spec, neighbors, e.strafe);
      else {
        const goal = this.nav.next(this.nav.field(`p${target.id}`, target.x, target.z, this.clock), e.x, e.z);
        v = goal ? seek([e.x, e.z], goal, spec.speed, neighbors) : steer([e.x, e.z], [target.x, target.z], spec, neighbors, e.strafe);
      }
    }
    const slow = e.stagger > 0 ? 0.3 : 1;
    [e.x, e.z] = col.resolve(e.x + v[0] * slow * dt, e.z + v[1] * slow * dt, spec.radius, e.y, config.ARENA_RADIUS);
    const g = col.ground(e.x, e.z, e.y);
    e.y = g > e.y ? g : Math.max(g, e.y - 14 * dt);
    const face = blind ? e.seen : Math.hypot(v[0], v[1]) > 0.5 && dist > spec.attackRange ? [e.x + v[0], e.z + v[1]] : [target.x, target.z];
    e.yaw = (Math.atan2(face[0] - e.x, face[1] - e.z) * 180) / Math.PI;

    // ----- ra đòn -----
    e.cooldown -= dt;
    if (blind || e.cooldown > 0 || e.age < 0.6 || e.stagger > 0 || dist > spec.attackRange) return;
    if (spec.ranged) {
      const sx = e.x, sy = e.y + 1.25 * spec.size, sz = e.z;
      if (col.sightBlocked([sx, sy, sz], [target.x, target.y + 1.2, target.z])) return;
      e.cooldown = spec.attackInterval; e.lunge = 0.5;
      e.yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
      const ax = target.x - sx, ay = target.y + config.EYE_HEIGHT - 0.45 - sy, az = target.z - sz;
      const k = SHOT_SPEED / (Math.hypot(ax, ay, az) || 1);
      const id = this._newId();
      this.shots.set(id, { id, x: sx, y: sy, z: sz, vx: ax * k, vy: ay * k, vz: az * k, damage: spec.damage, life: 4 });
      this._emit("enemy_fire", { id: e.id });
    } else if (Math.abs(climb) < 1.5) {                // khác tầng hoặc đang nhảy cao thì đòn cận chiến không tới
      e.cooldown = spec.attackInterval; e.lunge = 1;
      this._hurt(target, spec.damage, e.x, e.z);
    }
  }

  // ---------- PvP ----------
  _tickPvp(dt) {
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this._finish(); return; }
    for (const p of this.players.values()) {
      if (p.alive) continue;
      p.respawn -= dt;
      if (p.respawn <= 0) {
        p.alive = true; p.shield = config.PVP_SHIELD;
        p.stats.hp = config.PLAYER_HP;
        p.grenades = Math.max(p.grenades, 1);
        this._place(p);
        this._emit("spawn", { p: p.id, x: p.x, z: p.z });
      }
    }
    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0 && this.pickups.size < 6) {
      this.pickupTimer = config.PVP_PICKUP_EVERY;
      const [x, z] = spawnPoint(this.rng, this.col, [], 0, 4);
      this._drop(this.rng.choice(["health", "ammo", "ammo", "grenade", "smoke"]), x, 0, z);
    }
  }

  // ---------- đạn của địch, vật phẩm ----------
  _tickShots(dt) {
    const alive = this._alive();
    for (const s of [...this.shots.values()]) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      s.life -= dt;
      const hit = alive.find((p) => (s.x - p.x) ** 2 + (s.y - (p.y + config.EYE_HEIGHT - 0.5)) ** 2
        + (s.z - p.z) ** 2 < 0.75 ** 2);
      if (hit) {
        const yaw = (hit.yaw * Math.PI) / 180;
        const facing = -(s.vx * Math.sin(yaw) + s.vz * Math.cos(yaw)) / (Math.hypot(s.vx, s.vz) || 1);
        if (hit.guard && facing > 0.3) this._emit("deflect", { p: hit.id, x: s.x, y: s.y, z: s.z });   // chảo đỡ đạn
        else this._hurt(hit, s.damage, s.x, s.z);
      }
      if (hit || s.life <= 0 || s.y < 0 || this.col.inside(s.x, s.y, s.z)) this.shots.delete(s.id);
    }
  }

  _tickPickups(dt) {
    const alive = this._alive();
    for (const k of [...this.pickups.values()]) {
      k.life -= dt;
      const taker = alive.find((p) => Math.abs(p.y - k.y) < 2 && (k.x - p.x) ** 2 + (k.z - p.z) ** 2 < config.PICKUP_RADIUS ** 2
        && (!p.bot || k.kind === "health"));
      if (taker) {
        if (k.kind === "health") taker.stats.heal(config.HEALTH_PACK);
        else if (k.kind === "grenade") taker.grenades = Math.min(config.MAX_GRENADES, taker.grenades + 1);
        else if (k.kind === "smoke") taker.smokes = Math.min(config.MAX_SMOKES, taker.smokes + 1);
        else if (k.kind === "intel" && this.mission) this.mission.onCollect(k.id);
        this._emit("pickup", { p: taker.id, kind: k.kind });
      }
      if (taker || k.life <= 0) this.pickups.delete(k.id);
    }
  }

  _drop(kind, x, y, z, life = config.PICKUP_LIFETIME) {
    const id = this._newId();
    this.pickups.set(id, { id, kind, x, y, z, life });
    return id;
  }

  // ================= sát thương =================
  /** Người chơi `pid` bắn trúng địch `eid`. */
  hitEnemy(pid, eid, damage, headshot = false, cause = "gun") {
    const p = this.players.get(pid), e = this.enemies.get(eid);
    if (!p || !e || !p.alive || this.over) return;
    damage = Math.max(0, Math.min(Number(damage) || 0, 250)) * (headshot ? config.HEADSHOT_MULT : 1);
    this._damageEnemy(p, e, damage, headshot, cause);
  }

  /** Trừ máu địch; `by` là người gây ra (có thể null nếu người đó đã rời trận). */
  _damageEnemy(by, e, damage, headshot = false, cause = "gun") {
    const who = by ? by.id : null;
    e.hp -= damage;
    if (e.hp > 0) {
      e.stagger = Math.max(e.stagger, e.spec.stagger * (headshot ? 1.8 : 1));
      this._emit("enemy_hit", { id: e.id, by: who, head: headshot, fx: by ? by.x : e.x, fz: by ? by.z : e.z });
      return;
    }
    this.enemies.delete(e.id);
    const gained = by ? by.stats.addKill(e.spec.score, headshot) : 0;
    this._emit("enemy_kill", { id: e.id, by: who, head: headshot, gained, x: e.x, y: e.y, z: e.z, kind: e.kind, cause,
      combo: by ? by.combo : 0, fx: by ? by.x : e.x, fz: by ? by.z : e.z });
    if (this.mission) this.mission.onKill(e);
    if (this.rng.random() < config.PICKUP_CHANCE) {
      const weak = this._alive().some((q) => q.hp < 60), roll = this.rng.random();
      this._drop(weak && roll < 0.5 ? "health" : this.rng.choice(["ammo", "ammo", "ammo", "grenade", "grenade", "smoke"]), e.x, e.y, e.z);
    }
  }

  /** PvP: người chơi `pid` bắn trúng người chơi `targetId`. */
  hitPlayer(pid, targetId, damage, headshot = false) {
    const p = this.players.get(pid), target = this.players.get(targetId);
    if (this.mode !== "pvp" || !p || !target || !p.alive || p === target || this.over) return;
    damage = Math.max(0, Math.min(Number(damage) || 0, 250)) * (headshot ? config.HEADSHOT_MULT : 1);
    this._hurt(target, damage, p.x, p.z, p, headshot);
  }

  _hurt(target, amount, sx, sz, by = null, headshot = false) {
    if (!target.alive || target.shield > 0) return;
    const dead = target.stats.damage(amount);
    this._emit("hurt", { p: target.id, amount, x: sx, z: sz, by: by ? by.id : null, head: headshot });
    if (!dead) return;
    target.alive = false;
    target.deaths += 1;
    if (this.mode === "pvp") {
      target.respawn = config.PVP_RESPAWN;
      if (by) by.stats.addKill(100, headshot);
      this._emit("player_kill", { victim: target.id, by: by ? by.id : null, head: headshot });
      if (by && by.kills >= config.PVP_KILLS) this._finish();
    } else {
      this._emit("player_down", { p: target.id });
    }
  }

  // ================= vật ném: lựu đạn, bom khói =================
  setGuard(pid, on) { const p = this.players.get(pid); if (p) p.guard = Boolean(on); }

  /** Người chơi `pid` ném một quả từ `origin` theo hướng `dir` (đã chuẩn hoá). Trả về true nếu còn để ném. */
  throwItem(pid, kind, origin, dir) {
    const p = this.players.get(pid), field = kind === "grenade" ? "grenades" : kind === "smoke" ? "smokes" : null;
    if (!p || !p.alive || !field || p[field] <= 0 || this.over || !this.started) return false;
    p[field] -= 1;
    const id = this._newId(), v = config.THROW_SPEED;
    this.throwables.set(id, { id, kind, owner: pid, x: origin[0], y: origin[1], z: origin[2],
      vx: dir[0] * v, vy: dir[1] * v, vz: dir[2] * v, fuse: kind === "grenade" ? config.GRENADE_FUSE : config.SMOKE_FUSE });
    return true;
  }

  _tickThrowables(dt) {
    const col = this.col;
    for (const t of [...this.throwables.values()]) {
      const px = t.x, py = t.y, pz = t.z;
      t.vy -= config.GRAVITY * dt;
      t.x += t.vx * dt; t.y += t.vy * dt; t.z += t.vz * dt;
      const hit = col.inside(t.x, t.y - 0.12, t.z);
      if (hit && !Array.isArray(hit)) {                   // khối hộp: rơi lên mặt trên thì nảy, đập vào hông thì dội ra
        const top = col.topAt(hit, t.x, t.z);
        if (py - 0.12 >= top - 0.05 || t.y > top - 0.25) { t.y = top + 0.12; t.vy = Math.abs(t.vy) * 0.35; t.vx *= 0.6; t.vz *= 0.6; if (t.vy < 1) t.vy = 0; }
        else {
          if (px < hit.x0 || px > hit.x1) { t.x = px; t.vx *= -0.4; }
          if (pz < hit.z0 || pz > hit.z1) { t.z = pz; t.vz *= -0.4; }
          if (px >= hit.x0 && px <= hit.x1 && pz >= hit.z0 && pz <= hit.z1) { t.x = px; t.y = py; t.z = pz; t.vy = Math.min(t.vy, 0); t.vx *= -0.4; t.vz *= -0.4; }
        }
      } else if (hit) {                                   // trụ (cây, đá): dội theo pháp tuyến
        const dx = t.x - hit[0], dz = t.z - hit[1], d = Math.hypot(dx, dz) || 1, nx = dx / d, nz = dz / d;
        const into = t.vx * nx + t.vz * nz;
        t.x = hit[0] + nx * (hit[2] + 0.02); t.z = hit[1] + nz * (hit[2] + 0.02);
        if (into < 0) { t.vx -= 1.4 * into * nx; t.vz -= 1.4 * into * nz; }
      }
      if (t.y < 0.15) {                                   // nảy trên mặt đất, mất dần đà
        t.y = 0.15; t.vy = Math.abs(t.vy) * 0.35; t.vx *= 0.6; t.vz *= 0.6;
        if (t.vy < 1) t.vy = 0;
      }
      const edge = Math.hypot(t.x, t.z), limit = config.ARENA_RADIUS;
      if (edge > limit) { t.x *= limit / edge; t.z *= limit / edge; t.vx = t.vz = 0; }
      t.fuse -= dt;
      if (t.fuse > 0) continue;
      this.throwables.delete(t.id);
      if (t.kind === "grenade") this._explode(t);
      else {
        const id = this._newId();
        this.smokes.set(id, { id, x: t.x, y: Math.max(0, t.y - 0.15), z: t.z, r: config.SMOKE_RADIUS, life: config.SMOKE_TIME });
        this._emit("smoke", { id, x: t.x, z: t.z, by: t.owner });
      }
    }
    for (const s of [...this.smokes.values()]) {
      s.life -= dt;
      if (s.life <= 0) this.smokes.delete(s.id);
    }
  }

  _explode(t) {
    const owner = this.players.get(t.owner) || null, R = config.GRENADE_RADIUS;
    this._emit("explode", { x: t.x, y: t.y, z: t.z, by: t.owner });
    for (const e of [...this.enemies.values()]) {
      const d = Math.hypot(e.x - t.x, e.y + e.spec.size - t.y, e.z - t.z);
      if (d < R) this._damageEnemy(owner, e, config.GRENADE_DAMAGE * (1 - d / R), false, "grenade");
    }
    for (const p of this._alive()) {                      // nổ gần là dính: tự ném trúng mình cũng mất máu
      const mine = p.id === t.owner;
      if (!mine && this.mode !== "pvp") continue;         // đoàn kết: không làm đồng đội bị thương
      const d = Math.hypot(p.x - t.x, p.y + 1 - t.y, p.z - t.z);
      if (d < R) this._hurt(p, config.GRENADE_PLAYER_DAMAGE * (1 - d / R), t.x, t.z, mine ? null : owner);
    }
  }

  /** Đường nhìn từ A tới B có xuyên qua đám khói nào không. */
  _smoked(ax, az, bx, bz) {
    if (!this.smokes.size) return false;
    const clouds = [];
    for (const s of this.smokes.values()) if (s.life > 0.8) clouds.push([s.x, s.z, s.r * 0.85]);
    return segmentBlocked(ax, az, bx, bz, clouds);
  }

  /** victory: chỉ có nghĩa ở chế độ nhiệm vụ (hoàn thành mục tiêu cuối cùng). */
  _finish(victory = false) {
    if (this.over) return;
    const order = [...this.players.values()].sort(this.mode === "pvp"
      ? (a, b) => b.kills - a.kills || a.deaths - b.deaths || a.id - b.id
      : (a, b) => b.score - a.score || a.id - b.id);
    this.over = {
      mode: this.mode, wave: this.waves.number, teamScore: this.teamScore, time: this.clock,
      ranking: order.map((p) => ({ id: p.id, name: p.name, bot: p.bot, kills: p.kills, deaths: p.deaths, score: p.score,
        headshots: p.headshots })),
    };
    if (this.missionDef) {                                           // kết quả nhiệm vụ: thắng hay thua, mấy sao
      const me = order[0] || null;
      this.over.mission = { id: this.missionDef.id, title: this.missionDef.title, victory,
        stars: victory && this.mission ? this.mission.stars(this.clock, me) : 0, time: this.clock, par: this.missionDef.par };
    }
    this._emit("over", { result: this.over });
  }

  /** Ảnh chụp trạng thái để máy chủ phòng gửi cho các máy (gọn: mỗi thứ là một mảng số). */
  snapshot() {
    const r = (v) => Math.round(v * 100) / 100;
    return {
      t: "snap", info: this.info(),
      P: [...this.players.values()].map((p) => [p.id, r(p.x), r(p.y), r(p.z), r(p.yaw), r(p.pitch), r(p.hp), p.alive ? 1 : 0, p.score, p.kills,
        p.deaths, p.combo, r(p.comboTimer), p.headshots, r(p.shield), p.grenades, p.smokes]),
      E: [...this.enemies.values()].map((e) => [e.id, e.kind, r(e.x), r(e.y), r(e.z), r(e.yaw), r(e.hp), r(e.maxHp), r(e.lunge)]),
      S: [...this.shots.values()].map((s) => [s.id, r(s.x), r(s.y), r(s.z)]),
      K: [...this.pickups.values()].map((k) => [k.id, k.kind, r(k.x), r(k.y), r(k.z), r(k.life)]),
      T: [...this.throwables.values()].map((t) => [t.id, t.kind, r(t.x), r(t.y), r(t.z)]),
      M: [...this.smokes.values()].map((s) => [s.id, r(s.x), r(s.y), r(s.z), s.r, r(s.life)]),
    };
  }

  info() {
    return { mode: this.mode, wave: this.waves.number, fight: this.waves.fighting,
      left: this.enemies.size + this.waves.remainingToSpawn, team: this.teamScore,
      time: this.timeLeft, target: config.PVP_KILLS, mission: this.mission ? this.mission.info() : null };
  }
}
