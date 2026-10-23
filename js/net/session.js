// Phiên chơi qua mạng: mô phỏng chạy ở máy chủ phòng, máy này gửi thao tác và nhận trạng thái.
// Có đúng bộ thuộc tính của LocalSession (game/session.js) nên phần còn lại của game không cần biết mình đang chơi kiểu gì.
import { config } from "../config.js";
import { SPECS } from "../core/enemies.js";

const PROTOCOL = 1;

/** Địa chỉ WebSocket của máy chủ phòng, suy từ địa chỉ trang web của nó (https://ten.onrender.com -> wss://ten.onrender.com/ws). */
export function socketUrl(base) {
  const url = new URL(/^[a-z]+:\/\//i.test(base) ? base : `https://${base}`);
  url.protocol = url.protocol === "http:" || url.protocol === "ws:" ? "ws:" : "wss:";
  url.pathname = "/ws"; url.search = ""; url.hash = "";
  return url.toString();
}

export class NetSession {
  /** request: {t: "create", mode, name, map?} hoặc {t: "join", code, name}. Trả về phiên đã vào phòng, hoặc ném Error kèm lời báo cho người chơi. */
  static connect(base, request, timeout = 70000) {
    return new Promise((resolve, reject) => {
      let socket, done = false;
      const fail = (why) => { if (done) return; done = true; clearTimeout(timer); try { socket && socket.close(); } catch { /* bỏ qua */ } reject(new Error(why)); };
      const timer = setTimeout(() => fail("Máy chủ phòng không trả lời."), timeout);
      try { socket = new WebSocket(socketUrl(base)); } catch { fail("Địa chỉ máy chủ phòng không hợp lệ, hoặc trang này không được phép kết nối ra ngoài."); return; }
      socket.onopen = () => socket.send(JSON.stringify({ ...request, v: PROTOCOL }));
      socket.onerror = () => fail("Không kết nối được tới máy chủ phòng.");
      socket.onclose = () => fail("Không kết nối được tới máy chủ phòng.");
      socket.onmessage = (event) => {
        const m = JSON.parse(event.data);
        if (m.t === "refuse") fail(m.why);
        else if (m.t === "welcome") { done = true; clearTimeout(timer); resolve(new NetSession(socket, m)); }
      };
    });
  }

  constructor(socket, welcome) {
    this.socket = socket;
    this.online = true;
    this.me = welcome.id; this.code = welcome.code; this.mode = welcome.mode;
    this.map = welcome.map || "phuong_hoang";            // bản đồ của phòng (máy chủ quyết định)
    this.roster = []; this.owner = null;
    this.started = false; this.over = null; this.lost = false;
    this.players = new Map(); this.enemies = new Map(); this.shots = new Map(); this.pickups = new Map();
    this.throwables = new Map(); this.smokes = new Map();
    this.info = { mode: this.mode, wave: 0, fight: false, left: 0, team: 0, time: config.PVP_TIME, target: config.PVP_KILLS };
    this.names = new Map();
    this.queue = [];
    this.pose = null; this.poseT = 0; this.guard = false;
    socket.onmessage = (event) => { try { this._receive(JSON.parse(event.data)); } catch { /* gói lỗi: bỏ qua */ } };
    socket.onclose = () => { this.lost = true; };
    socket.onerror = () => { this.lost = true; };
  }
  get isOwner() { return this.owner === this.me; }

  // ---------- nhận ----------
  _receive(m) {
    if (m.t === "roster") {
      this.roster = m.players; this.owner = m.owner; this.started = m.started;
      this.names = new Map(m.players);
      for (const p of this.players.values()) if (!this.names.has(p.id)) this.players.delete(p.id);
      for (const [id, name] of m.players) if (!this.players.has(id)) this.players.set(id, this._player(id, name));   // để phòng chờ và HUD có tên ngay
    } else if (m.t === "start") {
      this.started = true;
    } else if (m.t === "reset") {
      this.started = false; this.over = null;
      for (const group of [this.enemies, this.shots, this.pickups, this.throwables, this.smokes]) group.clear();
      this.queue.push({ t: "reset" });
    } else if (m.t === "snap") {
      this._snapshot(m);
    } else if (m.t === "ev") {
      for (const e of m.e) {
        if (e.t === "over") this.over = e.result;
        this.queue.push(e);
      }
    }
  }

  _player(id, name) {
    return { id, name, bot: false, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, hp: config.PLAYER_HP, alive: true, score: 0, kills: 0, deaths: 0, combo: 0,
      comboTimer: 0, multiplier: 1, headshots: 0, shield: 0, grenades: config.START_GRENADES, smokes: config.START_SMOKES };
  }

  _snapshot(m) {
    this.info = m.info;
    const seen = new Set();
    for (const a of m.P) {
      let p = this.players.get(a[0]);
      if (!p) { p = this._player(a[0], this.names.get(a[0]) || "?"); this.players.set(a[0], p); }
      [, p.x, p.y, p.z, p.yaw, p.pitch, p.hp] = a;
      p.alive = Boolean(a[7]); p.score = a[8]; p.kills = a[9]; p.deaths = a[10]; p.combo = a[11]; p.comboTimer = a[12];
      p.multiplier = Math.max(1, Math.min(a[11], config.COMBO_MAX)); p.headshots = a[13]; p.shield = a[14]; p.grenades = a[15]; p.smokes = a[16];
      seen.add(a[0]);
    }
    for (const id of [...this.players.keys()]) if (!seen.has(id)) this.players.delete(id);
    const refill = (map, rows, make) => { map.clear(); for (const row of rows) map.set(row[0], make(row)); };
    refill(this.enemies, m.E, (e) => ({ id: e[0], kind: e[1], spec: SPECS[e[1]], x: e[2], y: e[3], z: e[4], yaw: e[5], hp: e[6], maxHp: e[7], lunge: e[8] }));
    refill(this.shots, m.S, (s) => ({ id: s[0], x: s[1], y: s[2], z: s[3] }));
    refill(this.pickups, m.K, (k) => ({ id: k[0], kind: k[1], x: k[2], y: k[3], z: k[4], life: k[5] }));
    refill(this.throwables, m.T, (t) => ({ id: t[0], kind: t[1], x: t[2], y: t[3], z: t[4] }));
    refill(this.smokes, m.M, (s) => ({ id: s[0], x: s[1], y: s[2], z: s[3], r: s[4], life: s[5] }));
  }

  // ---------- gửi ----------
  _send(message) { if (this.socket.readyState === 1) this.socket.send(JSON.stringify(message)); }
  start() { this._send({ t: "start" }); }
  reset() { this._send({ t: "reset" }); }
  sendPose(x, y, z, yaw, pitch) { this.pose = [x, y, z, yaw, pitch]; }
  setGuard(on) { this.guard = on; }
  hitEnemy(id, damage, headshot, cause) { this._send({ t: "hit_enemy", id, dmg: damage, head: headshot, cause }); }
  hitPlayer(id, damage, headshot) { this._send({ t: "hit_player", id, dmg: damage, head: headshot }); }
  shot(muzzle, ends, weapon) { this._send({ t: "shot", w: weapon, from: muzzle.map((v) => +v.toFixed(2)), to: ends.slice(0, 8).map((p) => p.map((v) => +v.toFixed(1))) }); }
  /** Ném: trừ ngay ở máy mình cho mượt, máy chủ là bên quyết định cuối cùng. */
  throwItem(kind, origin, dir) {
    const me = this.players.get(this.me), field = kind === "grenade" ? "grenades" : "smokes";
    if (!me || !me.alive || me[field] <= 0) return false;
    me[field] -= 1;
    this._send({ t: "throw", kind, o: origin, d: dir });
    return true;
  }

  /** Mỗi khung hình: gửi vị trí của mình theo nhịp, trả về các sự kiện máy chủ vừa báo. */
  update(dt) {
    this.poseT -= dt;
    if (this.pose && this.poseT <= 0 && this.started) {
      this.poseT = 1 / config.NET_POSE;
      const [x, y, z, yaw, pitch] = this.pose;
      this._send({ t: "pose", x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(1), pitch: +pitch.toFixed(1), g: this.guard ? 1 : 0 });
    }
    const events = this.queue;
    this.queue = [];
    return events;
  }

  close() { this.socket.onclose = null; try { this.socket.close(); } catch { /* bỏ qua */ } }
}
