// Phòng chơi: nhận người vào bằng mã, chạy mô phỏng (đúng bộ luật trong js/core mà bản chơi một mình đang dùng),
// phát trạng thái cho mọi máy. File này không biết gì về mạng: mỗi kết nối chỉ là một vật có send(obj) và close().
import { config } from "../js/config.js";
import { buildLayout } from "../js/core/layout.js";
import { DEFAULT_MAP, MAP_INFO } from "../js/core/map.js";
import { Simulation } from "../js/core/sim.js";

export const PROTOCOL = 1;
const MODES = ["coop", "pvp"];
const num = (v, lo, hi) => { const n = Number(v); if (!Number.isFinite(n)) throw new Error("số không hợp lệ"); return Math.max(lo, Math.min(hi, n)); };
const vec = (v) => { if (!Array.isArray(v) || v.length < 3) throw new Error("vectơ không hợp lệ"); return [num(v[0], -200, 200), num(v[1], -200, 200), num(v[2], -200, 200)]; };

export function cleanName(raw, fallback) {
  const name = String(raw ?? "").replace(/[\u0000-\u001f<>&"]/g, "").trim().slice(0, 16);
  return name || fallback;
}

class Room {
  constructor(code, mode, mapId = DEFAULT_MAP) {
    this.code = code;
    this.mode = mode;
    this.mapId = MAP_INFO.some((m) => m.id === mapId) ? mapId : DEFAULT_MAP;
    this.members = new Map();        // id người chơi -> {conn, name}
    this.owner = null;               // người được bấm Bắt đầu
    this.nextId = 1;
    this.snapT = 0;
    this.idle = 0;                   // số giây phòng không có ai
    this._newSim();
  }
  _newSim() {
    this.sim = new Simulation(this.mode, buildLayout(null, this.mapId));
    for (const [id, m] of this.members) this.sim.addPlayer(id, m.name);
  }

  join(conn, rawName) {
    const id = this.nextId++, taken = new Set([...this.members.values()].map((m) => m.name));
    let name = cleanName(rawName, `Người chơi ${id}`), n = 2;
    const base = name;
    while (taken.has(name)) name = `${base.slice(0, 13)} ${n++}`;
    this.members.set(id, { conn, name });
    this.sim.addPlayer(id, name);
    if (this.owner === null) this.owner = id;
    conn.send({ t: "welcome", v: PROTOCOL, id, code: this.code, mode: this.mode, map: this.mapId });
    this.roster();
    return id;
  }

  leave(id) {
    if (!this.members.delete(id)) return;
    this.sim.removePlayer(id);
    if (this.owner === id) this.owner = this.members.size ? Math.min(...this.members.keys()) : null;
    this.roster();
  }

  broadcast(message, skip = null) {
    for (const [id, m] of this.members) if (id !== skip) m.conn.send(message);
  }
  roster() {
    this.broadcast({ t: "roster", players: [...this.members].map(([id, m]) => [id, m.name]), owner: this.owner, mode: this.mode,
      started: this.sim.started });
  }

  /** Một gói tin từ người chơi `id`. Gói sai định dạng thì ném lỗi, bên gọi bỏ qua. */
  handle(id, m) {
    const sim = this.sim;
    switch (m.t) {
      case "pose":
        sim.setPose(id, num(m.x, -99, 99), num(m.y, 0, 30), num(m.z, -99, 99), num(m.yaw, -1e6, 1e6), num(m.pitch, -90, 90));
        sim.setGuard(id, Boolean(m.g));
        break;
      case "hit_enemy": sim.hitEnemy(id, Number(m.id), num(m.dmg, 0, 250), Boolean(m.head), m.cause === "melee" ? "melee" : "gun"); break;
      case "hit_player": sim.hitPlayer(id, Number(m.id), num(m.dmg, 0, 250), Boolean(m.head)); break;
      case "throw": {
        const p = sim.players.get(id), o = vec(m.o), d = vec(m.d), len = Math.hypot(...d) || 1;
        if (!p || Math.hypot(o[0] - p.x, o[2] - p.z) > 4) break;          // phải ném từ chỗ mình đứng
        sim.throwItem(id, m.kind === "smoke" ? "smoke" : "grenade", o, d.map((v) => v / len));
        break;
      }
      case "shot":                                                       // chuyển cho máy khác vẽ vệt đạn, nghe tiếng súng
        if (Array.isArray(m.to)) this.broadcast({ t: "ev", e: [{ t: "shot", p: id, w: String(m.w || "rifle").slice(0, 12), from: vec(m.from), to: m.to.slice(0, 8).map(vec) }] }, id);
        break;
      case "start":
        if (id === this.owner && !sim.started) { sim.start(); this.broadcast({ t: "start" }); this.roster(); }
        break;
      case "reset":                                                      // chủ phòng đưa cả phòng về phòng chờ để chơi ván mới
        if (id === this.owner) { this._newSim(); this.broadcast({ t: "reset" }); this.roster(); }
        break;
      default:
    }
  }

  tick(dt) {
    if (!this.members.size) { this.idle += dt; return; }
    this.idle = 0;
    const events = this.sim.tick(dt);
    if (events.length) this.broadcast({ t: "ev", e: events });
    this.snapT -= dt;
    if (this.snapT <= 0 && this.sim.started) {
      this.snapT = 1 / config.NET_SNAPSHOT;
      this.broadcast(this.sim.snapshot());
    }
  }
}

/** Trung tâm quản lý mọi phòng. */
export class Hub {
  constructor({ maxRooms = 40, rng = Math.random } = {}) {
    this.rooms = new Map();
    this.where = new Map();          // kết nối -> {room, id}
    this.maxRooms = maxRooms;
    this.rng = rng;
  }

  /** Một gói tin vừa tới từ kết nối `conn`. */
  receive(conn, m) {
    if (!m || typeof m !== "object") return;
    const seat = this.where.get(conn);
    try {
      if (seat) { seat.room.handle(seat.id, m); return; }
      if (m.v !== PROTOCOL) { conn.send({ t: "refuse", why: "Trang game và máy chủ đang khác phiên bản. Tải lại trang rồi thử lại." }); return; }
      if (m.t === "create") {
        if (this.rooms.size >= this.maxRooms) { conn.send({ t: "refuse", why: "Máy chủ đang đầy phòng, thử lại sau ít phút." }); return; }
        let code;
        do { code = String(Math.floor(this.rng() * 9000) + 1000); } while (this.rooms.has(code));
        const room = new Room(code, MODES.includes(m.mode) ? m.mode : "coop", String(m.map || DEFAULT_MAP));
        this.rooms.set(code, room);
        this.where.set(conn, { room, id: room.join(conn, m.name) });
      } else if (m.t === "join") {
        const room = this.rooms.get(String(m.code ?? "").trim());
        const why = !room ? "Không có phòng nào mang mã này." : room.members.size >= config.MAX_PLAYERS ? "Phòng đã đủ người."
          : room.sim.started ? "Trận đang diễn ra, chờ ván sau nhé." : null;
        if (why) { conn.send({ t: "refuse", why }); return; }
        this.where.set(conn, { room, id: room.join(conn, m.name) });
      }
    } catch { /* gói tin sai định dạng: bỏ qua */ }
  }

  /** Kết nối `conn` vừa đóng. */
  drop(conn) {
    const seat = this.where.get(conn);
    if (!seat) return;
    this.where.delete(conn);
    seat.room.leave(seat.id);
  }

  tick(dt) {
    for (const [code, room] of this.rooms) {
      room.tick(dt);
      if (room.idle > 60) this.rooms.delete(code);       // phòng trống quá 1 phút thì đóng
    }
  }
}
