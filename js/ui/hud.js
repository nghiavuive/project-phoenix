// HUD trong trận: tâm ngắm co giãn theo độ tản, máu, đạn, vũ khí, radar có sơ đồ công trình,
// bảng hạ gục, thông báo chiến đấu, hướng bị bắn, ống ngắm bắn tỉa.
import { config } from "../config.js";
import { LOADOUT } from "../core/weapons.js";

const RADAR_RANGE = 42;
const $ = (id) => document.getElementById(id);
const dots = (n) => Math.round(n).toLocaleString("vi-VN");
const ICONS = {                                           // hình bóng vũ khí, vẽ trong khung 48 x 18
  pistol: "M6 4h24v5H18l-2 8h-6l1-8H6z", rifle: "M1 7h9l2-2h20v2h14v2H32v2h-8l-2 6h-4l1-6h-6l-3 3H1z",
  smg: "M4 5h26v3h8v2h-8v2H20v6h-3v-6h-5l-1 5H7l1-5H4z", shotgun: "M1 8h12l2-2h31v2H24v3H14l-4 4H4l2-5H1z",
  sniper: "M1 9h10l2-2h14V4h10v2h-6v1h15v2H26l-3 2h-6l-2 5h-4l1-5H1z", lmg: "M1 7h10l2-2h18v2h15v2H31v2h-4v5h-9v-5h-6l-3 3H1z",
  pan: "M30 9a7 7 0 1 0 14 0a7 7 0 1 0-14 0zM6 8h24v2H6z", knife: "M4 8h10V6h3v2h25l-7 4H17v1h-3v-1H4z",
};
const icon = (key) => `<svg viewBox="0 0 48 18" aria-hidden="true"><path d="${ICONS[key]}"/></svg>`;

/** Chỉ đụng tới trang khi nội dung đổi. */
function put(el, value) { if (el.textContent !== value) el.textContent = value; }

export class Hud {
  constructor(layout) {
    this.root = $("hud");
    this.el = Object.fromEntries(["hp-fill", "hp-ghost", "hp-text", "vitals", "obj-title", "obj-sub", "zone", "roster", "score", "combo",
      "combo-bar", "ammo", "reserve", "gun", "gun-icon", "mag-fill", "reload", "reload-fill", "banner", "banner-title", "banner-sub", "toast",
      "callout", "callout-title", "callout-sub", "hurt", "cross", "marker", "radar", "feed", "scope", "dmg", "chip-grenade", "chip-smoke", "hint"]
      .map((id) => [id, $(id)]));
    this.radar = this.el.radar.getContext("2d");
    this.setLayout(layout);
    this.bar = $("bar");
    this.slots = LOADOUT.map((spec, i) => {              // thanh vũ khí: bấm phím số hoặc chạm vào ô để đổi
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "slot";
      slot.id = `slot-${spec.key}`;
      slot.title = spec.name;
      slot.innerHTML = `<b>${i + 1}</b>${icon(spec.key)}<span>${spec.tag}</span><i></i>`;
      slot.addEventListener("click", () => this.onSelect && this.onSelect(i));
      this.bar.appendChild(slot);
      return { slot, count: slot.lastChild };
    });
    this.arcs = [...this.el.dmg.children].map((node) => ({ node, t: 0 }));
    this.onSelect = null;
    this.reset();
  }
  /** Sơ đồ công trình in lên radar (đổi theo bản đồ đang chơi). */
  setLayout(layout) {
    this.plan = layout.blocks.filter((b) => ["wall", "container", "truck", "crate", "pipe"].includes(b.kind) && b.y0 < 1 && b.y1 > 0.7);
  }
  show(on = true) { this.root.hidden = !on; this.bar.hidden = !on; }
  setTouch(on) { this.touch = on; }

  reset() {
    this.hurtA = this.bannerT = this.toastT = this.calloutT = this.markT = 0;
    this.lines = [];
    this.el.feed.textContent = "";
    for (const name of ["banner", "toast", "callout"]) this.el[name].classList.remove("on");
    this.el.marker.className = "marker";
    this.arcs.forEach((a) => { a.t = 0; a.node.style.opacity = 0; });
    this.gunKey = "";
  }

  // ---------- sự kiện ----------
  flashDamage(strength = 0.6) { this.hurtA = Math.min(0.9, this.hurtA + strength); }

  /** Vạch đỏ chỉ hướng viên đạn bay tới (độ, 0 = trước mặt, dương = bên phải). */
  damageFrom(angle) {
    const arc = this.arcs.reduce((a, b) => (b.t < a.t ? b : a));
    arc.t = 1.1;
    arc.node.style.transform = `rotate(${angle.toFixed(1)}deg)`;
  }

  hitMarker({ kill = false, headshot = false } = {}) {
    this.markT = kill ? 0.3 : 0.14;
    this.el.marker.className = "marker";
    void this.el.marker.offsetWidth;                       // khởi động lại hoạt ảnh bật ra
    this.el.marker.className = `marker on${kill ? " kill" : headshot ? " head" : ""}`;
  }

  announce(title, sub = "", seconds = 2.4) {
    put(this.el["banner-title"], title);
    put(this.el["banner-sub"], sub);
    this.el.banner.classList.add("on");
    this.bannerT = seconds;
  }

  /** Dòng nhỏ dưới tâm ngắm: nhặt đồ, hết lựu đạn... */
  toast(message, seconds = 1.2) {
    put(this.el.toast, message);
    this.el.toast.classList.add("on");
    this.toastT = seconds;
  }

  /** Thông báo chiến công ngay dưới tâm ngắm: "TRÚNG ĐẦU  +150". */
  callout(title, sub = "", seconds = 1.3) {
    put(this.el["callout-title"], title);
    put(this.el["callout-sub"], sub);
    this.el.callout.classList.remove("on");
    void this.el.callout.offsetWidth;
    this.el.callout.classList.add("on");
    this.calloutT = seconds;
  }

  /** Một dòng trên bảng tin (góc phải): tin thường. */
  feed(text) { this._line(`<span>${text}</span>`, ""); }

  /** Một dòng hạ gục: ai hạ ai, bằng gì, được bao nhiêu điểm. */
  kill(killer, victim, { head = false, cause = "gun", mine = false, lost = false, gained = 0 } = {}) {
    const how = head ? "◎" : cause === "grenade" ? "✹" : cause === "melee" ? "⚔" : "▸";
    this._line(`<b>${killer}</b><i>${how}</i><span>${victim}</span>${gained ? `<em>+${gained}</em>` : ""}`, mine ? "mine" : lost ? "lost" : "");
  }
  _line(html, cls) {
    const li = document.createElement("li");
    li.className = cls;
    li.innerHTML = html;
    this.el.feed.appendChild(li);
    this.lines.push({ li, t: 5 });
    while (this.lines.length > 5) this.lines.shift().li.remove();
  }

  // ---------- mỗi khung hình ----------
  sync(game, dt, zone) {
    const el = this.el, s = game.session, info = s.info, me = s.players.get(s.me), arsenal = game.arsenal, weapon = arsenal.weapon, spec = weapon.spec;
    const hp = me ? me.hp : config.PLAYER_HP, frac = hp / config.PLAYER_HP, alive = me ? me.alive : true;

    // máu: thanh chính tụt ngay, "bóng ma" tụt chậm theo sau để thấy vừa mất bao nhiêu
    el["hp-fill"].style.transform = `scaleX(${frac})`;
    el["hp-ghost"].style.transform = `scaleX(${frac})`;
    el.vitals.dataset.level = frac < 0.3 ? "low" : frac < 0.6 ? "mid" : "ok";
    put(el["hp-text"], String(Math.ceil(hp)));

    // nhiệm vụ
    if (info.mission) {
      const m = info.mission, st = m.type, d = m.marker ? Math.round(Math.hypot(m.marker.x - game.player.x, m.marker.z - game.player.z)) : null;
      const mm = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
      const progress = st === "survive" ? `còn ${mm(Math.max(0, m.goal - m.prog))}` : st === "hold" ? `${Math.round(m.frac * 100)}%`
        : st === "reach" ? "" : st === "boss" ? `còn ${m.goal - m.prog}` : `${m.prog}/${m.goal}`;
      put(el["obj-title"], m.text.toUpperCase());
      put(el["obj-sub"], [m.stages > 1 ? `chặng ${m.stage}/${m.stages}` : "", progress, d !== null ? `${d} m` : ""].filter(Boolean).join(" · "));
      put(el.score, dots(info.team));
    } else if (info.mode === "pvp") {
      const left = Math.max(0, Math.ceil(info.time)), lead = [...s.players.values()].reduce((a, b) => (b.kills > a.kills ? b : a));
      put(el["obj-title"], `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`);
      put(el["obj-sub"], `Dẫn đầu: ${lead.id === s.me ? "Bạn" : lead.name} ${lead.kills}/${info.target}`);
      put(el.score, `${me ? me.kills : 0} / ${info.target}`);
    } else {
      put(el["obj-title"], info.fight ? `ĐỢT ${info.wave}` : `ĐỢT ${info.wave + 1}`);
      put(el["obj-sub"], info.fight ? `còn ${info.left} địch` : "sắp tới…");
      put(el.score, dots(info.team));
    }
    put(el.zone, zone);
    if (s.players.size > 1) {
      const rows = [...s.players.values()].filter((p) => p.id !== s.me);
      if (info.mode === "pvp") rows.sort((a, b) => b.kills - a.kills);
      const text = rows.map((p) => (info.mode === "pvp" ? `${p.name}  ${p.kills}` : `${p.name}  ${p.alive ? Math.ceil(p.hp) : "GỤC"}`)).join("\n");
      put(el.roster, text);
    } else put(el.roster, "");
    const combo = me && me.combo >= 2;
    put(el.combo, combo ? `CHUỖI ×${me.multiplier}` : "");
    el["combo-bar"].style.transform = `scaleX(${combo ? Math.max(0, me.comboTimer / config.COMBO_WINDOW) : 0})`;

    // vũ khí và đạn
    if (this.gunKey !== spec.key) { this.gunKey = spec.key; el["gun-icon"].innerHTML = icon(spec.key); }
    put(el.gun, !alive ? "" : weapon.reloading ? "ĐANG NẠP…" : spec.name.toUpperCase());
    put(el.ammo, !alive ? "" : spec.melee ? "—" : String(weapon.ammo));
    put(el.reserve, !alive || spec.melee ? "" : weapon.reserve === null ? "/ ∞" : `/ ${weapon.reserve}`);
    el.ammo.classList.toggle("low", !spec.melee && weapon.ammo <= spec.magSize * 0.25);
    el["mag-fill"].style.transform = `scaleX(${spec.melee ? 1 : weapon.ammo / spec.magSize})`;
    el.reload.hidden = !(weapon.reloading && alive);
    el["reload-fill"].style.transform = `scaleX(${weapon.reloadProgress})`;
    arsenal.weapons.forEach((w, i) => {
      const { slot, count } = this.slots[i];
      slot.classList.toggle("on", i === arsenal.index);
      slot.classList.toggle("empty", w.outOfAmmo);
      put(count, w.spec.melee ? "" : w.reserve === null ? "∞" : String(w.ammo + w.reserve));
    });
    put(el["chip-grenade"], String(me ? me.grenades : 0));
    put(el["chip-smoke"], String(me ? me.smokes : 0));

    // tâm ngắm: hở rộng theo độ tản thật của phát bắn kế tiếp; đỏ khi đè lên mục tiêu; ngắm thì thu về một chấm
    const cam = game.camera, h = this.root.clientHeight || 720;
    const gap = spec.melee ? 7 : Math.max(3, (Math.tan((arsenal.spread(game.player) * Math.PI) / 180) * (h / 2)) / Math.tan((cam.fov * Math.PI) / 360));
    el.cross.style.setProperty("--gap", `${Math.min(60, gap).toFixed(1)}px`);
    el.cross.hidden = !alive || arsenal.scoped;
    el.cross.classList.toggle("hot", arsenal.onTarget);
    el.cross.classList.toggle("ads", arsenal.aimT > 0.6 && !spec.scope);
    el.scope.hidden = !(alive && arsenal.scoped);

    el.hint.hidden = game.touchMode || game.desktop.locked || game.phase !== "playing";
    this._radar(game);

    if (this.markT > 0) { this.markT -= dt; if (this.markT <= 0) el.marker.className = "marker"; }
    const low = frac < 0.3 && alive ? 0.25 + 0.12 * Math.sin(game.clock * 6) : 0;   // máu thấp: viền đỏ đập theo nhịp
    this.hurtA = Math.max(0, this.hurtA - dt * 1.6);
    el.hurt.style.opacity = Math.max(this.hurtA, low).toFixed(3);
    for (const arc of this.arcs) { if (arc.t > 0) { arc.t -= dt; arc.node.style.opacity = Math.max(0, Math.min(1, arc.t * 2)).toFixed(2); } }
    for (const [name, key] of [["banner", "bannerT"], ["toast", "toastT"], ["callout", "calloutT"]]) {
      if (this[key] > 0) { this[key] -= dt; if (this[key] <= 0) el[name].classList.remove("on"); }
    }
    if (this.lines.length) {
      for (const line of this.lines) { line.t -= dt; if (line.t < 0.6) line.li.style.opacity = Math.max(0, line.t / 0.6).toFixed(2); }
      while (this.lines.length && this.lines[0].t <= 0) this.lines.shift().li.remove();
    }
  }

  /** Radar xoay theo hướng nhìn: sơ đồ công trình, chấm đỏ = địch, xanh = đồng đội. PvP không lộ đối thủ. */
  _radar(game) {
    const c = this.radar, size = c.canvas.width, r = size / 2, player = game.player, s = game.session, k = (r - 4) / RADAR_RANGE;
    const yaw = (player.yaw * Math.PI) / 180, sin = Math.sin(yaw), cos = Math.cos(yaw);
    const at = (x, z) => { const dx = x - player.x, dz = z - player.z; return [r + (cos * dx - sin * dz) * k, r - (sin * dx + cos * dz) * k]; };
    c.clearRect(0, 0, size, size);
    c.save();
    c.beginPath(); c.arc(r, r, r - 1, 0, Math.PI * 2); c.clip();
    c.fillStyle = "rgba(11,18,32,0.62)"; c.fillRect(0, 0, size, size);
    c.fillStyle = "rgba(246,241,233,0.20)";
    for (const b of this.plan) {
      if (Math.hypot((b.x0 + b.x1) / 2 - player.x, (b.z0 + b.z1) / 2 - player.z) > RADAR_RANGE + 12) continue;
      const p = [at(b.x0, b.z0), at(b.x1, b.z0), at(b.x1, b.z1), at(b.x0, b.z1)];
      c.beginPath(); c.moveTo(p[0][0], p[0][1]); for (let i = 1; i < 4; i++) c.lineTo(p[i][0], p[i][1]); c.fill();
    }
    c.restore();
    const blip = (x, z, color) => {
      let [px, py] = at(x, z);
      const d = Math.hypot(px - r, py - r), max = r - 6;
      if (d > max) { px = r + ((px - r) / d) * max; py = r + ((py - r) / d) * max; }     // ngoài tầm thì dính ở mép
      c.fillStyle = color; c.beginPath(); c.arc(px, py, size * 0.032, 0, Math.PI * 2); c.fill();
    };
    for (const e of s.enemies.values()) blip(e.x, e.z, "#ff5a4d");
    const goal = s.info.mission && s.info.mission.marker;
    if (goal) {                                            // điểm nhiệm vụ: hình thoi vàng, dính ở mép radar khi ở xa
      let [px, py] = at(goal.x, goal.z);
      const d = Math.hypot(px - r, py - r), max = r - 8;
      if (d > max) { px = r + ((px - r) / d) * max; py = r + ((py - r) / d) * max; }
      const q = size * 0.055;
      c.fillStyle = goal.kind === "boss" ? "#ff5a4d" : goal.kind === "item" ? "#38bdf8" : "#ffd166";
      c.strokeStyle = "#0b1220"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(px, py - q); c.lineTo(px + q, py); c.lineTo(px, py + q); c.lineTo(px - q, py); c.closePath(); c.fill(); c.stroke();
    }
    if (s.mode !== "pvp") for (const p of s.players.values()) if (p.id !== s.me && p.alive) blip(p.x, p.z, "#5fb4ff");
    c.fillStyle = "#fff";
    c.beginPath(); c.moveTo(r, r - size * 0.065); c.lineTo(r + size * 0.042, r + size * 0.045); c.lineTo(r, r + size * 0.02); c.lineTo(r - size * 0.042, r + size * 0.045); c.fill();
    c.strokeStyle = "rgba(246,241,233,0.35)"; c.lineWidth = 2; c.beginPath(); c.arc(r, r, r - 1.5, 0, Math.PI * 2); c.stroke();
  }
}
