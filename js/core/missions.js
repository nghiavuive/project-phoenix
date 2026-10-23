// Nhiệm vụ: mỗi nhiệm vụ là một bản đồ + một chuỗi "chặng" (stage) phải làm lần lượt, trong lúc các đợt địch vẫn kéo tới.
// Thuần logic (không vẽ gì), chạy chung trong mô phỏng nên nhiệm vụ cũng kiểm thử tự động được.
//
// Loại chặng:
//   kill     {count}                hạ `count` kẻ địch
//   survive  {seconds}              trụ lại `seconds` giây
//   collect  {items: [[x, z], ...]} nhặt hết các hộp dữ liệu (đi tới sát là nhặt)
//   hold     {x, z, r, seconds}     đứng trong vòng chiếm giữ đủ `seconds` giây (ra ngoài thì tiến độ tụt dần)
//   reach    {x, z, r}              tới điểm rút / điểm hẹn
//   boss     {count}                hạ `count` Đồ tể vừa xuất hiện
// Sao: ★ hoàn thành · ★★ nhanh hơn `par` giây · ★★★ và còn ≥ 60 máu, không gục lần nào.
import { config } from "../config.js";

export const MISSIONS = [
  { id: "m1", map: "phuong_hoang", title: "Dọn đường", startWave: 1, par: 110,
    brief: "Địch đã chiếm khu công nghiệp. Hạ chúng để mở đường cho đội tiếp theo.",
    stages: [{ type: "kill", count: 15, text: "Hạ kẻ địch" }] },
  { id: "m2", map: "phuong_hoang", title: "Dữ liệu mật", startWave: 2, par: 170,
    brief: "Ba hộp dữ liệu nằm rải rác: trong nhà kho, bãi xe và bãi container. Lấy đủ cả ba.",
    stages: [{ type: "collect", items: [[17.5, 12.5], [24, -10.5], [-7.5, -16]], text: "Thu thập hộp dữ liệu" }] },
  { id: "m3", map: "phuong_hoang", title: "Giữ ngã tư", startWave: 2, par: 120,
    brief: "Đội cứu hộ cần ngã tư thông suốt. Đứng trong vòng sáng và giữ vững 40 giây.",
    stages: [{ type: "hold", x: 0, z: 6, r: 5.5, seconds: 40, text: "Giữ ngã tư" }] },

  { id: "m4", map: "lang_que", title: "Bảo vệ làng", startWave: 3, par: 100,
    brief: "Dân làng đang sơ tán qua đình. Cầm chân địch 80 giây để mọi người kịp qua.",
    stages: [{ type: "survive", seconds: 80, text: "Cầm chân địch" }] },
  { id: "m5", map: "lang_que", title: "Thu hoạch muộn", startWave: 2, par: 200,
    brief: "Ba bao thóc còn nằm ngoài ruộng. Gom về rồi rút vào đình làng.",
    stages: [{ type: "collect", items: [[16, -15], [28, -22], [20, -29]], text: "Gom bao thóc ngoài ruộng" },
      { type: "reach", x: -15, z: 14.5, r: 3, text: "Rút vào đình làng" }] },

  { id: "m6", map: "sa_mac", title: "Phá trạm radar", startWave: 4, par: 220,
    brief: "Trạm radar đang dẫn đường cho địch. Dọn đường, rồi hạ hai Đồ tể canh giữ.",
    stages: [{ type: "kill", count: 10, text: "Dọn đường vào trạm" }, { type: "boss", count: 2, text: "Hạ Đồ tể canh trạm" }] },
  { id: "m7", map: "sa_mac", title: "Cuộc rút lui", startWave: 3, par: 240,
    brief: "Lấy ba hộp dữ liệu ở giàn khoan, bãi xe và trạm radar, rồi chạy xuống điểm rút phía nam.",
    stages: [{ type: "collect", items: [[-33, 12], [28, -18], [19, 17]], text: "Thu thập hộp dữ liệu" },
      { type: "reach", x: 0, z: -36, r: 3.5, text: "Chạy tới điểm rút phía nam" }] },

  { id: "m8", map: "bang_gia", title: "Đêm băng giá", startWave: 4, par: 330,
    brief: "Nhiệm vụ cuối: lấy dữ liệu trong nhà chỉ huy và kho nhiên liệu, giữ quảng trường, hạ trùm, rồi rút vào nhà chứa máy bay.",
    stages: [{ type: "collect", items: [[-10, 19], [-22, -14]], text: "Lấy dữ liệu chỉ huy" },
      { type: "hold", x: 0, z: 0, r: 6, seconds: 30, text: "Giữ quảng trường" },
      { type: "boss", count: 2, text: "Hạ Đồ tể" },
      { type: "reach", x: 21, z: -19.5, r: 3, text: "Rút vào nhà chứa máy bay" }] },
];

export const missionById = (id) => MISSIONS.find((m) => m.id === id) || null;

/** Nhiệm vụ nào đang mở: cái đầu luôn mở, các cái sau mở khi đã xong cái trước. progress: { mã: {stars} }. */
export function isUnlocked(id, progress = {}) {
  const i = MISSIONS.findIndex((m) => m.id === id);
  return i === 0 || (i > 0 && Boolean(progress[MISSIONS[i - 1].id] && progress[MISSIONS[i - 1].id].stars > 0));
}

export function nextMission(id) {
  const i = MISSIONS.findIndex((m) => m.id === id);
  return i >= 0 && i + 1 < MISSIONS.length ? MISSIONS[i + 1] : null;
}

/** Diễn biến một nhiệm vụ đang chơi. `sim` là Simulation chủ. */
export class MissionRun {
  constructor(def, sim) {
    this.def = def;
    this.sim = sim;
    this.stage = 0;
    this.prog = 0;                  // tiến độ chặng hiện tại (số địch / giây / số hộp / ...)
    this.done = false;
    this.items = [];                // collect: các hộp còn nằm đó [{id, x, z}]
    this.bossIds = new Set();       // boss: các Đồ tể của chặng này
    this._begin();
  }

  get cur() { return this.def.stages[this.stage]; }

  _begin() {
    const st = this.cur, sim = this.sim;
    this.prog = 0;
    this.items = [];
    this.bossIds = new Set();
    if (st.type === "collect") {
      for (const [x, z] of st.items) {
        const id = sim._drop("intel", x, sim.col.ground(x, z, 0), z, 1e9);
        this.items.push({ id, x, z });
      }
    } else if (st.type === "boss") {
      const spots = sim._alive().map((p) => [p.x, p.z]);
      for (let i = 0; i < st.count; i++) this.bossIds.add(sim._spawnEnemy("brute", spots));
      sim._emit("mission_boss", { n: st.count });
    }
    sim._emit("mission_stage", { i: this.stage, n: this.def.stages.length, text: st.text, title: this.def.title });
  }

  _next() {
    if (this.stage + 1 >= this.def.stages.length) {            // xong chặng cuối: giữ nguyên chỉ số để info() vẫn đọc được
      this.done = true;
      this.sim._finish(true);
      return;
    }
    this.stage += 1;
    this._begin();
  }

  // ----- tin từ mô phỏng -----
  onKill(enemy) {
    if (this.done) return;
    const st = this.cur;
    if (st.type === "kill") { this.prog += 1; if (this.prog >= st.count) this._next(); }
    else if (st.type === "boss" && this.bossIds.delete(enemy.id) && this.bossIds.size === 0) this._next();
  }

  /** Người chơi vừa nhặt hộp dữ liệu có mã `pickupId`. */
  onCollect(pickupId) {
    if (this.done || this.cur.type !== "collect") return;
    const i = this.items.findIndex((it) => it.id === pickupId);
    if (i < 0) return;
    this.items.splice(i, 1);
    this.prog += 1;
    if (this.prog >= this.cur.items.length) this._next();
  }

  tick(dt, alive) {
    if (this.done || !alive.length) return;
    const st = this.cur;
    if (st.type === "survive") { this.prog += dt; if (this.prog >= st.seconds) this._next(); }
    else if (st.type === "hold") {
      const inside = alive.some((p) => Math.hypot(p.x - st.x, p.z - st.z) < st.r && p.y < 3);
      this.prog = inside ? Math.min(st.seconds, this.prog + dt) : Math.max(0, this.prog - dt * 0.5);
      if (this.prog >= st.seconds) this._next();
    } else if (st.type === "reach") {
      if (alive.some((p) => Math.hypot(p.x - st.x, p.z - st.z) < st.r && Math.abs(p.y) < 3)) { this.prog = 1; this._next(); }
    }
  }

  /** Điểm sáng chỉ đường: hộp gần nhất, vòng chiếm giữ, điểm rút, hoặc Đồ tể gần nhất. null nếu chặng không có điểm cụ thể. */
  marker() {
    const st = this.cur, alive = this.sim._alive(), me = alive[0] || { x: 0, z: 0 };
    const nearest = (list) => list.reduce((a, b) => (Math.hypot(a.x - me.x, a.z - me.z) <= Math.hypot(b.x - me.x, b.z - me.z) ? a : b));
    if (st.type === "collect" && this.items.length) { const it = nearest(this.items); return { x: it.x, y: this.sim.col.ground(it.x, it.z, 0), z: it.z, r: 1.4, kind: "item" }; }
    if (st.type === "hold" || st.type === "reach") return { x: st.x, y: 0, z: st.z, r: st.r, kind: st.type };
    if (st.type === "boss") {
      const ts = [...this.bossIds].map((id) => this.sim.enemies.get(id)).filter(Boolean);
      if (ts.length) { const e = nearest(ts); return { x: e.x, y: e.y, z: e.z, r: 1.6, kind: "boss" }; }
    }
    return null;
  }

  info() {
    const st = this.cur;
    const goal = { kill: st.count, survive: st.seconds, collect: (st.items || []).length, hold: st.seconds, reach: 1, boss: st.count }[st.type];
    const shown = this.done || st.type === "boss" && this.bossIds.size === 0 ? goal : st.type === "boss" ? goal - this.bossIds.size : this.prog;
    return { id: this.def.id, title: this.def.title, stage: Math.min(this.stage + 1, this.def.stages.length), stages: this.def.stages.length,
      type: st.type, text: st.text, prog: Math.min(goal, shown), goal, frac: Math.max(0, Math.min(1, shown / goal)), done: this.done, par: this.def.par,
      marker: this.done ? null : this.marker() };
  }

  /** Số sao khi kết thúc: 0 nếu thua. */
  stars(time, me) {
    if (!this.done) return 0;
    return 1 + (time <= this.def.par ? 1 : 0) + (me && me.alive && me.hp >= config.PLAYER_HP * 0.6 && me.deaths === 0 ? 1 : 0);
  }
}
