// Tài khoản, ví xu và kho skin. Mọi thay đổi về xu đều xảy ra ở đây (máy chủ), máy khách chỉ được xem.
// Mật khẩu băm bằng scrypt kèm muối riêng; phiên đăng nhập là mã ngẫu nhiên, máy chủ chỉ giữ bản băm của nó.
// Lưu thành một file JSON (ghi nguyên tử: ghi file tạm rồi đổi tên) nên không cần cài cơ sở dữ liệu.
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import { MISSIONS } from "../js/core/missions.js";
import { COIN, DEFAULT_SKIN, SKIN_BY_ID, missionCoins, validName, validPassword } from "../js/core/skins.js";

const SESSION_DAYS = 30, MAX_SESSIONS = 5;
const sha = (s) => createHash("sha256").update(s).digest("hex");
const derive = (password, salt) => new Promise((ok, no) => scrypt(password, salt, 32, { N: 16384, r: 8, p: 1 }, (e, key) => (e ? no(e) : ok(key))));
const hourOf = (t) => Math.floor(t / 3600000), dayOf = (t) => Math.floor(t / 86400000);

export class Accounts {
  /** file: đường dẫn lưu; null = chỉ giữ trong bộ nhớ (dùng khi kiểm thử). now: hàm trả mili-giây, để kiểm thử chỉnh được giờ. */
  constructor({ file = null, now = Date.now } = {}) {
    this.file = file;
    this.now = now;
    this.users = new Map();                  // tên viết thường -> hồ sơ
    this.fails = new Map();                  // "tên|ip" -> {n, until}
    this.signups = new Map();                // ip -> [mốc thời gian]
    this.timer = null;
    if (file && existsSync(file)) {
      try { for (const u of JSON.parse(readFileSync(file, "utf8")).users) this.users.set(u.key, u); } catch { /* file hỏng: bắt đầu trống, giữ nguyên file cũ tới lần ghi sau */ }
    }
  }

  // ---------- lưu ----------
  _dirty() {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 400);
    this.timer.unref?.();
  }
  flush() {
    if (!this.file) return;
    mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify({ users: [...this.users.values()] }));
    renameSync(tmp, this.file);
  }

  // ---------- đăng ký, đăng nhập ----------
  async register(name, password, ip = "?") {
    if (!validName(name)) throw new Error("Tên đăng nhập gồm 3–16 chữ cái không dấu, số hoặc dấu gạch dưới.");
    if (!validPassword(password)) throw new Error("Mật khẩu dài từ 6 đến 64 ký tự.");
    const now = this.now(), recent = (this.signups.get(ip) || []).filter((t) => now - t < 3600000);
    if (recent.length >= 5) throw new Error("Đăng ký quá nhiều lần từ máy này, thử lại sau một giờ.");
    const key = name.toLowerCase();
    if (this.users.has(key)) throw new Error("Tên này đã có người dùng.");
    const salt = randomBytes(16);
    const user = { key, name, salt: salt.toString("hex"), hash: (await derive(password, salt)).toString("hex"), created: now,
      coins: COIN.start, skins: [DEFAULT_SKIN], equipped: DEFAULT_SKIN, missions: {}, sessions: {}, earned: { hour: 0, spent: 0, day: 0, solo: 0 }, flags: 0 };
    if (this.users.has(key)) throw new Error("Tên này đã có người dùng.");     // người khác vừa đăng ký trong lúc băm mật khẩu
    this.users.set(key, user);
    recent.push(now); this.signups.set(ip, recent);
    this._dirty();
    return this._session(user);
  }

  async login(name, password, ip = "?") {
    const key = String(name).toLowerCase(), slot = `${key}|${ip}`, now = this.now(), f = this.fails.get(slot);
    if (f && f.until > now) throw new Error(`Sai quá nhiều lần, thử lại sau ${Math.ceil((f.until - now) / 60000)} phút.`);
    const user = this.users.get(key);
    let ok = false;
    if (user && typeof password === "string" && password.length <= 64) {
      const want = Buffer.from(user.hash, "hex"), got = await derive(password, Buffer.from(user.salt, "hex"));
      ok = want.length === got.length && timingSafeEqual(want, got);
    } else {
      await derive("x", Buffer.alloc(16));                 // tên không tồn tại cũng tốn thời gian như thật, khỏi dò ra tên nào có tài khoản
    }
    if (!ok) {
      const n = (f && !(f.until && f.until <= now) ? f.n : 0) + 1;       // khoá hết hạn thì đếm lại từ đầu
      this.fails.set(slot, { n, until: n >= 5 ? now + 5 * 60000 : 0 });
      throw new Error("Sai tên đăng nhập hoặc mật khẩu.");
    }
    this.fails.delete(slot);
    return this._session(user);
  }

  _session(user) {
    const token = randomBytes(24).toString("hex"), now = this.now();
    for (const [h, until] of Object.entries(user.sessions)) if (until < now) delete user.sessions[h];
    const old = Object.entries(user.sessions).sort((a, b) => a[1] - b[1]);
    while (old.length >= MAX_SESSIONS) delete user.sessions[old.shift()[0]];
    user.sessions[sha(token)] = now + SESSION_DAYS * 86400000;
    this._dirty();
    return { token, me: this.view(user) };
  }

  /** Mã phiên -> hồ sơ, hoặc null nếu sai / hết hạn. */
  auth(token) {
    if (typeof token !== "string" || token.length !== 48) return null;
    const h = sha(token), now = this.now();
    for (const u of this.users.values()) {
      const until = u.sessions[h];
      if (until) { if (until < now) { delete u.sessions[h]; return null; } return u; }
    }
    return null;
  }
  logout(token) { const u = this.auth(token); if (u) { delete u.sessions[sha(token)]; this._dirty(); } }

  /** Phần hồ sơ gửi về máy khách (không có mật khẩu, không có phiên). */
  view(u) {
    return { name: u.name, coins: u.coins, skins: [...u.skins], equipped: u.equipped, missions: { ...u.missions } };
  }

  // ---------- skin ----------
  buy(u, skinId) {
    const skin = SKIN_BY_ID[skinId];
    if (!skin) throw new Error("Không có skin này.");
    if (u.skins.includes(skin.id)) throw new Error("Bạn đã có skin này.");
    if (u.coins < skin.price) throw new Error(`Chưa đủ xu: cần ${skin.price}, bạn có ${u.coins}.`);
    u.coins -= skin.price;
    u.skins.push(skin.id);
    this._dirty();
    return this.view(u);
  }
  equip(u, skinId) {
    if (!u.skins.includes(skinId)) throw new Error("Bạn chưa sở hữu skin này.");
    u.equipped = skinId;
    this._dirty();
    return this.view(u);
  }

  // ---------- xu ----------
  /** Cộng xu có giới hạn theo giờ. Trả về số xu thực sự được cộng. */
  award(u, amount, { cap = Infinity } = {}) {
    amount = Math.floor(Math.min(Number(amount) || 0, cap));
    if (amount <= 0) return 0;
    const hour = hourOf(this.now());
    if (u.earned.hour !== hour) { u.earned.hour = hour; u.earned.spent = 0; }
    const give = Math.max(0, Math.min(amount, COIN.hourCap - u.earned.spent));
    u.earned.spent += give;
    u.coins += give;
    if (give) this._dirty();
    return give;
  }

  /** Máy khách báo đã xong nhiệm vụ (chơi một mình nên máy chủ không kiểm chứng được): chỉ trả một lần cho mỗi mốc sao. */
  reportMission(u, id, stars) {
    if (!MISSIONS.some((m) => m.id === id)) throw new Error("Nhiệm vụ không tồn tại.");
    stars = Math.floor(Number(stars));
    if (!(stars >= 1 && stars <= 3)) throw new Error("Số sao không hợp lệ.");
    const before = u.missions[id] || 0;
    if (stars <= before) return { gained: 0, me: this.view(u) };
    u.missions[id] = stars;
    const gained = this.award(u, missionCoins(stars) - missionCoins(before));
    this._dirty();
    return { gained, me: this.view(u) };
  }

  /** Máy khách báo kết quả chơi đơn: tính xu theo số đợt nhưng trần mỗi ngày rất thấp. */
  reportSolo(u, waves) {
    waves = Math.max(0, Math.min(60, Math.floor(Number(waves) || 0)));
    const day = dayOf(this.now());
    if (u.earned.day !== day) { u.earned.day = day; u.earned.solo = 0; }
    const room = Math.max(0, COIN.soloDayCap - u.earned.solo);
    const gained = this.award(u, Math.min(room, waves * COIN.soloPerWave));
    u.earned.solo += gained;
    this._dirty();
    return { gained, me: this.view(u) };
  }
}
