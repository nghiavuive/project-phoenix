// Hiệu ứng: tia lửa, mảnh vỡ, vỏ đạn, vệt đạn, khói bụi, vụ nổ, và toàn bộ âm thanh (tự tổng hợp, không cần file).
import { config } from "../config.js";
import { UNIT_BOX } from "./meshes.js";

const T = window.THREE;
const MAX_PARTICLES = 170;
const BALL = new T.IcosahedronGeometry(1, 1);
const BRASS = new T.MeshBasicMaterial({ color: 0xd9a441 }), SHELL = new T.MeshBasicMaterial({ color: 0xc2382f });

export class Effects {
  constructor(root, col) {
    this.root = root;
    this.col = col;
    this.particles = [];
    this.tracers = [];
    this.blasts = [];
    this.onCasing = null;             // gọi khi vỏ đạn chạm đất lần đầu (để phát tiếng leng keng)
  }

  /** Chùm mảnh văng. pos: [x, y, z]; tint: màu hex số. */
  burst(pos, tint, count = 8, speed = 5, size = 0.14, life = 0.5) {
    const material = new T.MeshBasicMaterial({ color: tint });
    for (let i = 0; i < count; i++) {
      this._push(material, pos, [(Math.random() * 2 - 1) * speed, (0.2 + Math.random() * 1.2) * speed, (Math.random() * 2 - 1) * speed],
        [size, size, size], life, { shrink: true, own: i === 0 ? material : null });
    }
  }

  /** Vỏ đạn văng ra từ cửa hất vỏ. */
  casing(pos, velocity, shell = false) {
    this._push(shell ? SHELL : BRASS, pos, velocity, shell ? [0.045, 0.045, 0.11] : [0.022, 0.022, 0.06], 2.2, { casing: true });
  }

  _push(material, pos, v, scale, life, extra = {}) {
    if (this.particles.length >= MAX_PARTICLES) this._remove(this.particles.shift());
    const mesh = new T.Mesh(UNIT_BOX, material);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    this.root.add(mesh);
    this.particles.push({ mesh, vx: v[0], vy: v[1], vz: v[2], life, total: life, scale, spin: 8 + Math.random() * 10, ...extra });
  }

  /** Quả cầu phình ra rồi tắt: vụ nổ (cam), bụi (xám), khói đầu nòng. */
  puff(pos, radius, tint, life = 0.32, opacity = 0.9, rise = 0) {
    const ball = new T.Mesh(BALL, new T.MeshBasicMaterial({ color: tint, transparent: true, opacity, depthWrite: false }));
    ball.position.set(pos[0], pos[1], pos[2]);
    this.root.add(ball);
    this.blasts.push({ ball, life, total: life, radius, opacity, rise });
  }

  explosion(pos, radius) {
    this.puff(pos, radius, 0xffb347, 0.34);
    this.puff([pos[0], pos[1] + 0.6, pos[2]], radius * 0.7, 0x3b3b3b, 1.1, 0.55, 2.2);
    this.burst(pos, 0xff7a1a, 18, 9, 0.28, 0.8);
    this.burst(pos, 0x3a3a3a, 12, 6, 0.22, 1.0);
  }

  /** Dấu đạn trúng vật: bụi + vài mảnh theo màu chất liệu. */
  impact(pos, tint = 0xd9ccb3) {
    this.puff(pos, 0.28, tint, 0.22, 0.6);
    this.burst(pos, tint, 3, 2.6, 0.07, 0.3);
  }

  /** Vệt đạn: một dải sáng mỏng luôn quay mặt về phía mắt người chơi. */
  tracer(start, end, eye, tint = 0xffe6a0, width = 0.035) {
    const d = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
    const e = [eye[0] - start[0], eye[1] - start[1], eye[2] - start[2]];
    let s = [d[1] * e[2] - d[2] * e[1], d[2] * e[0] - d[0] * e[2], d[0] * e[1] - d[1] * e[0]];
    const len = Math.hypot(s[0], s[1], s[2]) || 1;
    s = s.map((v) => (v / len) * width);
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute([
      start[0] - s[0], start[1] - s[1], start[2] - s[2], start[0] + s[0], start[1] + s[1], start[2] + s[2], end[0] + s[0], end[1] + s[1], end[2] + s[2],
      start[0] - s[0], start[1] - s[1], start[2] - s[2], end[0] + s[0], end[1] + s[1], end[2] + s[2], end[0] - s[0], end[1] - s[1], end[2] - s[2]], 3));
    const line = new T.Mesh(g, new T.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.9, blending: T.AdditiveBlending,
      depthWrite: false, side: T.DoubleSide }));
    this.root.add(line);
    this.tracers.push({ line, life: 0.07, total: 0.07 });
  }

  tick(dt) {
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) { this._remove(p); return false; }
      p.vy -= 14 * dt;
      const m = p.mesh.position;
      m.x += p.vx * dt; m.y += p.vy * dt; m.z += p.vz * dt;
      const floor = (p.casing ? this.col.ground(m.x, m.z, m.y + 0.3) : 0) + 0.03;
      if (m.y < floor) {
        m.y = floor; p.vy = -p.vy * 0.35; p.vx *= 0.6; p.vz *= 0.6; p.spin *= 0.4;
        if (p.casing && !p.rang && this.onCasing) { p.rang = true; this.onCasing(); }
      }
      p.mesh.rotation.x += p.spin * dt;
      if (p.shrink) p.mesh.scale.setScalar(p.scale[0] * (p.life / p.total));
      return true;
    });
    this.blasts = this.blasts.filter((b) => {
      b.life -= dt;
      if (b.life <= 0) { this.root.remove(b.ball); b.ball.material.dispose(); return false; }
      const k = 1 - b.life / b.total;
      b.ball.scale.setScalar(b.radius * (0.25 + 0.75 * Math.sqrt(k)));
      b.ball.position.y += b.rise * dt;
      b.ball.material.opacity = b.opacity * (1 - k);
      return true;
    });
    this.tracers = this.tracers.filter((t) => {
      t.life -= dt;
      if (t.life > 0) { t.line.material.opacity = 0.9 * (t.life / t.total); return true; }
      this._drop(t);
      return false;
    });
  }

  clear() {
    this.particles.forEach((p) => this._remove(p));
    this.tracers.forEach((t) => this._drop(t));
    this.blasts.forEach((b) => { this.root.remove(b.ball); b.ball.material.dispose(); });
    this.particles = []; this.tracers = []; this.blasts = [];
  }
  _drop(t) { this.root.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); }
  _remove(p) { this.root.remove(p.mesh); if (p.own) p.own.dispose(); }
}

// ======================= âm thanh =======================
const RATE = 22050;
const sine = (f, t) => Math.sin(2 * Math.PI * f * t);
const noise = () => Math.random() * 2 - 1;

/** Tiếng súng = tiếng "đốp" sắc ở đầu + tiếng "ụp" trầm tụt tần số + thân tiếng nổ (nhiễu lọc thấp) + đuôi vang. */
function gunshot({ dur, thump, crack, body, tail = 0 }) {
  let lp = 0, lp2 = 0, prev = 0;
  return [dur, (t, p) => {
    const n = noise();
    lp += (n - lp) * body[0];                           // thân: nhiễu lọc thông thấp
    lp2 += (n - lp2) * 0.06;                            // đuôi: rất trầm
    const snap = t < 0.012 ? (n - prev) * crack * (1 - t / 0.012) : 0;
    prev = n;
    const f = thump[0] + (thump[1] - thump[0]) * Math.min(1, p * 3);
    return snap + sine(f, t) * thump[2] * Math.exp(-t * 26) + lp * body[1] * Math.exp(-t * body[2] * 10) * 2.2 + lp2 * tail * Math.exp(-t * 5) * 5;
  }];
}

const RECIPES = {
  pistol: gunshot({ dur: 0.24, thump: [230, 95, 0.55], crack: 0.9, body: [0.38, 0.55, 3.2] }),
  rifle: gunshot({ dur: 0.34, thump: [165, 60, 0.75], crack: 0.8, body: [0.24, 0.75, 2.5], tail: 0.12 }),
  smg: gunshot({ dur: 0.17, thump: [270, 130, 0.42], crack: 0.75, body: [0.5, 0.45, 3.8] }),
  shotgun: gunshot({ dur: 0.62, thump: [115, 40, 1.0], crack: 0.55, body: [0.13, 0.95, 1.7], tail: 0.3 }),
  sniper: gunshot({ dur: 1.05, thump: [140, 34, 1.0], crack: 1.0, body: [0.2, 0.85, 1.9], tail: 0.55 }),
  lmg: gunshot({ dur: 0.3, thump: [135, 55, 0.9], crack: 0.6, body: [0.18, 0.85, 2.3], tail: 0.1 }),
  enemy: gunshot({ dur: 0.3, thump: [320, 180, 0.3], crack: 0.4, body: [0.6, 0.35, 3] }),
  pan: [0.34, (t, p) => (sine(1730, t) * 0.4 + sine(2610, t) * 0.25 + sine(3470, t) * 0.12) * (1 - p) ** 2 + (t < 0.02 ? noise() * 0.5 : 0)],
  knife: [0.12, (t, p) => noise() * 0.3 * Math.sin(Math.PI * p) ** 2 * (0.4 + p)],
  swish: [0.16, (t, p) => noise() * 0.28 * Math.sin(Math.PI * p) ** 2],
  magout: [0.09, (t, p) => (noise() * 0.4 + sine(520, t) * 0.25) * (1 - p) ** 2],
  magin: [0.11, (t, p) => (noise() * 0.5 * (p < 0.3 ? 1 : 0.2) + sine(340, t) * 0.35) * (1 - p) ** 1.5],
  bolt: [0.2, (t, p) => (noise() * 0.45 + sine(880, t) * 0.2) * (p < 0.18 || (p > 0.5 && p < 0.7) ? 1 : 0.05)],
  pump: [0.26, (t, p) => (noise() * 0.5 + sine(210, t) * 0.3) * (p < 0.25 || (p > 0.55 && p < 0.8) ? 1 : 0.05)],
  dry: [0.05, (t, p) => (noise() * 0.3 + sine(1400, t) * 0.2) * (1 - p)],
  draw: [0.14, (t, p) => noise() * 0.18 * Math.sin(Math.PI * p)],
  tink: [0.16, (t, p) => (sine(4200, t) * 0.18 + sine(6100, t) * 0.1) * (1 - p) ** 3],
  step: [0.09, (t, p) => (sine(90 - 40 * p, t) * 0.5 + noise() * 0.12) * (1 - p) ** 2],
  land: [0.16, (t, p) => (sine(70 - 30 * p, t) * 0.8 + noise() * 0.2) * (1 - p) ** 1.5],
  hit: [0.06, (t, p) => sine(1250, t) * 0.4 * (1 - p)],
  head: [0.14, (t, p) => (sine(1900, t) * 0.35 + sine(2850, t) * 0.2) * (1 - p) ** 2],
  kill: [0.22, (t, p) => (sine(520 + 520 * p, t) * 0.4 + sine(1040 + 1040 * p, t) * 0.15) * (1 - p)],
  hurt: [0.24, (t, p) => (sine(120 - 50 * p, t) * 0.8 + noise() * 0.25) * (1 - p) ** 1.5],
  pickup: [0.22, (t, p) => sine(p < 0.5 ? 660 : 990, t) * 0.4 * (1 - p) ** 0.6],
  wave: [0.9, (t, p) => (sine(110, t) + sine(165, t) * 0.7 + sine(220, t) * 0.4) * 0.3 * Math.sin(Math.PI * p) ** 0.7],
  clear: [0.6, (t, p) => sine([392, 494, 587, 784][Math.min(3, Math.floor(p * 4))], t) * 0.32 * (1 - p) ** 0.4],
  boom: [1.0, (t, p) => noise() * 0.85 * (1 - p) ** 2.4 + sine(58 - 30 * p, t) * 0.95 * (1 - p) ** 1.4],
  hiss: [0.9, (t, p) => noise() * 0.22 * (1 - p) ** 1.2],
  ui: [0.05, (t, p) => sine(880, t) * 0.25 * (1 - p)],
  deploy: [0.5, (t, p) => noise() * 0.25 * Math.sin(Math.PI * p) * (0.3 + p) + sine(80 + 160 * p, t) * 0.25 * (1 - p)],
};

export class Sfx {
  constructor() { this.ctx = null; this.buffers = {}; this.volume = config.VOLUME; }

  /** Trình duyệt chỉ cho phát tiếng sau khi người chơi bấm; gọi hàm này trong lúc bấm nút. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || !config.SOUND) return;
    try {
      this.ctx = new Ctx();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.volume;
      this.gain.connect(this.ctx.destination);
      for (const [name, [seconds, fn]] of Object.entries(RECIPES)) {
        const n = Math.floor(RATE * seconds), buffer = this.ctx.createBuffer(1, n, RATE), data = buffer.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = Math.max(-1, Math.min(1, fn(i / RATE, i / n)));
        this.buffers[name] = buffer;
      }
    } catch { this.ctx = null; }
  }
  setVolume(v) { this.volume = v; if (this.gain) this.gain.gain.value = v; }

  /** gain < 1 cho tiếng ở xa (súng của người khác, bước chân). */
  play(name, pitch = 1, gain = 1) {
    if (!this.ctx || !this.buffers[name] || gain <= 0.01) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers[name];
      src.playbackRate.value = pitch;
      if (gain < 0.99) { const g = this.ctx.createGain(); g.gain.value = gain; src.connect(g); g.connect(this.gain); } else src.connect(this.gain);
      src.start();
    } catch { /* im lặng chạy tiếp */ }
  }
}
