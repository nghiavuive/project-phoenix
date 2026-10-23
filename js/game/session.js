// Phiên chơi: thứ mà game nhìn vào để biết "trận đấu đang thế nào".
// LocalSession chạy mô phỏng ngay trong trình duyệt: chơi đơn, hoặc Đoàn kết / PvP với người chơi máy (bot).
// Khi có máy chủ phòng, chỉ cần thêm một lớp NetSession có cùng bộ thuộc tính này; phần còn lại của game không phải sửa.
import { config } from "../config.js";
import { Simulation } from "../core/sim.js";

export class LocalSession {
  constructor(mode, name, layout, opts = {}) {
    this.sim = new Simulation(mode, layout, undefined, opts);
    this.me = 1;
    this.online = false;
    this.lost = false;
    this.names = new Map();
    this.sim.addPlayer(1, name);
    const bots = mode === "coop" ? config.BOTS_COOP : mode === "pvp" ? config.BOTS_PVP : 0;
    for (let i = 0; i < bots; i++) this.sim.addPlayer(2 + i, config.BOT_NAMES[i % config.BOT_NAMES.length], true);
    for (const p of this.sim.players.values()) this.names.set(p.id, p.name);
  }
  get mode() { return this.sim.mode; }
  get started() { return this.sim.started; }
  get over() { return this.sim.over; }
  get players() { return this.sim.players; }
  get enemies() { return this.sim.enemies; }
  get shots() { return this.sim.shots; }
  get pickups() { return this.sim.pickups; }
  get throwables() { return this.sim.throwables; }
  get smokes() { return this.sim.smokes; }
  get info() { return this.sim.info(); }

  start() { this.sim.start(); }
  update(dt) { return this.sim.tick(dt); }
  sendPose(x, y, z, yaw, pitch) { this.sim.setPose(this.me, x, y, z, yaw, pitch); }
  hitEnemy(id, damage, headshot, cause) { this.sim.hitEnemy(this.me, id, damage, headshot, cause); }
  hitPlayer(id, damage, headshot) { this.sim.hitPlayer(this.me, id, damage, headshot); }
  throwItem(kind, origin, dir) { return this.sim.throwItem(this.me, kind, origin, dir); }
  setGuard(on) { this.sim.setGuard(this.me, on); }
  shot() {}
  reset() {}
  close() {}
}
