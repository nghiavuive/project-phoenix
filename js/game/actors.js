// Hình ảnh của mọi thứ biết động: bốn loại địch (mỗi loại một dáng riêng), người chơi khác, đạn, vật phẩm, khói.
// Các lớp ở đây KHÔNG chứa luật chơi: mỗi khung hình chúng nhìn vào đối tượng trạng thái rồi tự đặt mình cho khớp.
//
// Mỗi nhân vật là một bộ khớp đơn giản: hông -> (thân -> đầu, tay trái, tay phải), chân trái, chân phải.
// Bước đi, vung đòn, giật lùi khi trúng đạn, ngã khi chết đều chỉ là xoay các khớp đó.
import { config } from "../config.js";
import { HUMAN_SHAPE } from "../core/enemies.js";
import * as meshes from "./meshes.js";

const T = window.THREE;
const { Builder, boxTris, coneTris, blobTris, hexRgb } = meshes;
const RAD = Math.PI / 180;
const BLOB = meshes.blobGeometry(), GEM = meshes.gemGeometry();
const BAR_BG = new T.SpriteMaterial({ color: 0x000000, opacity: 0.55, transparent: true, depthTest: false });
export const PICKUP_LOOK = { health: [0x4ade80, `+${config.HEALTH_PACK} máu`], ammo: [0xfbbf24, "+đạn cho mọi súng"],
  grenade: [0xf97316, "+1 lựu đạn"], smoke: [0xcbd5e1, "+1 bom khói"], intel: [0x38bdf8, "Đã lấy hộp dữ liệu"] };
export const PLAYER_COLORS = ["#3b82f6", "#22c55e", "#eab308", "#ec4899", "#06b6d4", "#f97316"];

const ease = (dt, rate = 14) => Math.min(1, rate * dt);
const rgb = hexRgb;
const GLOW = { yellow: [2.2, 1.9, 0.6], cyan: [0.5, 2.0, 2.2], red: [2.3, 0.4, 0.3] };      // > 1 để luôn sáng rực dù ở chỗ tối

function part(parent, geometry, material, pos, scale) {
  const mesh = new T.Mesh(geometry, material);
  mesh.castShadow = meshes.LIT;                    // đồ hoạ cao: người, địch, vật phẩm đổ bóng xuống đất
  mesh.position.set(...pos);
  if (scale) mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}
const bx = (b, w, h, d, at, color) => b.add(boxTris(w, h, d, at), color);

// ======================= thiết kế từng loại =======================
// Mỗi hàm trả về hình các bộ phận (toạ độ tính từ khớp của bộ phận đó) và vị trí các khớp.
const DESIGNS = {
  // LÍNH: lính bộ binh giáp đỏ, mũ sắt có kính vàng, ba lô, tay phải cầm dùi cui.
  grunt() {
    const red = rgb("#c9332c"), plate = rgb("#e2564c"), dark = rgb("#2f333c"), boot = rgb("#18191d"), olive = rgb("#4b5238"), skin = rgb("#6b4a3c");
    const leg = () => bx(bx(new Builder(), 0.28, 0.52, 0.32, [0, -0.27, 0], dark), 0.3, 0.3, 0.42, [0, -0.67, 0.05], boot);
    const torso = new Builder();
    bx(torso, 0.6, 0.2, 0.36, [0, 0.1, 0], dark); bx(torso, 0.74, 0.62, 0.44, [0, 0.5, 0], red); bx(torso, 0.5, 0.34, 0.08, [0, 0.56, 0.24], plate);
    bx(torso, 0.46, 0.46, 0.2, [0, 0.5, -0.31], olive); bx(torso, 0.26, 0.14, 0.42, [-0.46, 0.8, 0], dark); bx(torso, 0.26, 0.14, 0.42, [0.46, 0.8, 0], dark);
    const arm = (weapon) => { const b = bx(bx(bx(new Builder(), 0.2, 0.4, 0.22, [0, -0.2, 0], red), 0.18, 0.34, 0.2, [0, -0.53, 0], dark), 0.2, 0.16, 0.22, [0, -0.76, 0], skin);
      return weapon ? bx(b, 0.07, 0.07, 0.72, [0, -0.78, 0.32], rgb("#8b9199")) : b; };
    const head = new Builder();
    head.add(blobTris(0.31, null, 0, [1, 0.86, 1.05], [0, 0.26, 0]), rgb("#8f211c"), [0, 0.26, 0]);
    bx(head, 0.36, 0.2, 0.1, [0, 0.19, 0.24], boot); bx(head, 0.38, 0.07, 0.04, [0, 0.24, 0.3], GLOW.yellow); bx(head, 0.16, 0.12, 0.16, [0, 0.03, 0], skin);
    return { hip: 0.82, shoulder: [0.47, 0.78], neck: 0.8, legX: 0.19, torso, head, armL: arm(false), armR: arm(true), legL: leg(), legR: leg(),
      stride: 0.75, swing: 0.6, lean: 0.08 };
  },
  // CHẠY NHANH: lom khom, gầy, hai lưỡi dao dài thay cho bàn tay, một mắt xanh, gai dọc lưng.
  runner() {
    const orange = rgb("#ef8a1e"), dark = rgb("#3b2a1a"), steel = rgb("#c9d2da"), bone = rgb("#f3d9a8");
    const leg = () => bx(bx(new Builder(), 0.17, 0.42, 0.2, [0, -0.2, 0.04], dark), 0.14, 0.4, 0.16, [0, -0.56, -0.03], orange);
    const torso = new Builder();
    bx(torso, 0.42, 0.62, 0.3, [0, 0.33, 0], orange); bx(torso, 0.3, 0.3, 0.2, [0, 0.2, 0.2], dark);
    for (let i = 0; i < 4; i++) torso.add(coneTris(0.07, 0.24, 4, [0, 0.1 + i * 0.16, -0.22]), bone, [0, 0.3, 0]);
    const arm = () => bx(bx(bx(new Builder(), 0.14, 0.44, 0.16, [0, -0.22, 0], orange), 0.12, 0.3, 0.14, [0, -0.55, 0], dark), 0.04, 0.12, 0.86, [0, -0.72, 0.36], steel);
    const head = new Builder();
    bx(head, 0.3, 0.26, 0.36, [0, 0.14, 0.06], dark); bx(head, 0.16, 0.12, 0.05, [0, 0.16, 0.26], GLOW.cyan); bx(head, 0.32, 0.06, 0.3, [0, 0.29, 0], orange);
    return { hip: 0.78, shoulder: [0.3, 0.58], neck: 0.62, legX: 0.14, torso, head, armL: arm(), armR: arm(), legL: leg(), legR: leg(),
      stride: 1.05, swing: 0.25, lean: 0.52, armBack: 0.9, hipBack: -0.16 };
  },
  // XẠ THỦ: cao gầy, áo choàng tím, mũ trùm với khe mắt xanh, hai tay ôm súng trường dài, ăng-ten sau vai.
  shooter() {
    const purple = rgb("#7d3fc8"), deep = rgb("#3c2168"), dark = rgb("#201a2c"), gun = rgb("#23252b");
    const leg = () => bx(bx(new Builder(), 0.2, 0.62, 0.24, [0, -0.33, 0], dark), 0.22, 0.3, 0.34, [0, -0.8, 0.04], rgb("#121216"));
    const torso = new Builder();
    bx(torso, 0.52, 0.72, 0.34, [0, 0.42, 0], purple); bx(torso, 0.62, 0.54, 0.44, [0, -0.2, 0], deep); bx(torso, 0.7, 0.14, 0.4, [0, 0.76, 0], deep);
    bx(torso, 0.03, 0.7, 0.03, [0.24, 1.05, -0.16], gun); bx(torso, 0.07, 0.07, 0.07, [0.24, 1.42, -0.16], GLOW.cyan);
    const arm = () => bx(bx(new Builder(), 0.15, 0.4, 0.17, [0, -0.2, 0], purple), 0.13, 0.36, 0.15, [0, -0.54, 0], dark);
    const rifle = bx(bx(bx(bx(new Builder(), 0.07, 0.11, 1.15, [0, 0, 0.3], gun), 0.05, 0.05, 0.34, [0, 0.01, 1.0], gun), 0.06, 0.2, 0.08, [0, -0.12, 0.05], gun), 0.05, 0.06, 0.05, [0, 0.085, 0.3], GLOW.cyan);
    const head = new Builder();
    head.add(coneTris(0.3, 0.62, 5, [0, -0.02, -0.02], 0.3), deep, [0, 0.25, 0]);
    bx(head, 0.3, 0.3, 0.3, [0, 0.16, 0.02], dark); bx(head, 0.26, 0.05, 0.04, [0, 0.2, 0.18], GLOW.cyan);
    return { hip: 0.98, shoulder: [0.36, 0.72], neck: 0.82, legX: 0.14, torso, head, armL: arm(), armR: arm(), legL: leg(), legR: leg(), gun: rifle,
      stride: 0.6, swing: 0, lean: 0.03, aim: 1.2, hand: 0.68 };
  },
  // ĐỒ TỂ: vai rộng gấp đôi, đầu nhỏ thụt giữa hai vai, giáp ngực vạch vàng đen, hai nắm đấm khổng lồ, gai vai.
  brute() {
    const blood = rgb("#7d1a1a"), dark = rgb("#2a1414"), iron = rgb("#3d4048"), yellow = rgb("#e9b21a"), black = rgb("#141414");
    const leg = () => bx(bx(new Builder(), 0.4, 0.48, 0.44, [0, -0.24, 0], dark), 0.46, 0.26, 0.56, [0, -0.6, 0.05], iron);
    const torso = new Builder();
    bx(torso, 0.86, 0.38, 0.56, [0, 0.19, 0], dark); bx(torso, 1.42, 0.66, 0.72, [0, 0.7, 0], blood); bx(torso, 0.86, 0.4, 0.08, [0, 0.7, 0.38], yellow);
    for (const x of [-0.26, 0, 0.26]) bx(torso, 0.1, 0.4, 0.09, [x, 0.7, 0.385], black);
    for (const s of [-1, 1]) { torso.add(coneTris(0.16, 0.42, 5, [s * 0.6, 1.0, 0]), iron, [s * 0.6, 0.8, 0]); bx(torso, 0.44, 0.2, 0.6, [s * 0.6, 0.98, 0], iron); }
    const arm = () => bx(bx(bx(new Builder(), 0.36, 0.5, 0.4, [0, -0.25, 0], blood), 0.46, 0.5, 0.5, [0, -0.72, 0.03], iron), 0.54, 0.38, 0.58, [0, -1.12, 0.06], black);
    const head = new Builder();
    bx(head, 0.3, 0.28, 0.32, [0, 0.12, 0.05], dark); bx(head, 0.08, 0.05, 0.03, [-0.08, 0.14, 0.22], GLOW.red); bx(head, 0.08, 0.05, 0.03, [0.08, 0.14, 0.22], GLOW.red);
    bx(head, 0.34, 0.08, 0.36, [0, 0.27, 0.04], iron);
    return { hip: 0.72, shoulder: [0.84, 0.88], neck: 0.98, legX: 0.3, torso, head, armL: arm(), armR: arm(), legL: leg(), legR: leg(),
      stride: 0.5, swing: 0.3, lean: 0.14, sway: 0.09, armOut: 0.12 };
  },
  // NGƯỜI CHƠI KHÁC / BOT: lính đặc nhiệm, áo giáp theo màu người chơi, kính bảo hộ, ôm súng.
  operator(tint) {
    const vest = rgb(tint), dark = rgb("#262b33"), cloth = rgb("#4a5361"), boot = rgb("#15171a"), gun = rgb("#1d1f24"), skin = rgb("#c39a7a");
    const leg = () => bx(bx(new Builder(), 0.26, 0.52, 0.3, [0, -0.27, 0], cloth), 0.28, 0.3, 0.4, [0, -0.67, 0.05], boot);
    const torso = new Builder();
    bx(torso, 0.58, 0.2, 0.34, [0, 0.1, 0], dark); bx(torso, 0.68, 0.6, 0.4, [0, 0.5, 0], cloth); bx(torso, 0.7, 0.42, 0.44, [0, 0.52, 0], vest);
    bx(torso, 0.4, 0.4, 0.16, [0, 0.5, -0.28], dark);
    for (const x of [-0.18, 0, 0.18]) bx(torso, 0.13, 0.16, 0.08, [x, 0.34, 0.25], dark);
    const arm = () => bx(bx(bx(new Builder(), 0.18, 0.4, 0.2, [0, -0.2, 0], cloth), 0.16, 0.34, 0.18, [0, -0.53, 0], vest), 0.17, 0.14, 0.19, [0, -0.75, 0], dark);
    const rifle = bx(bx(bx(bx(new Builder(), 0.07, 0.12, 0.8, [0, 0, 0.22], gun), 0.045, 0.045, 0.28, [0, 0.01, 0.74], gun), 0.06, 0.2, 0.09, [0, -0.14, 0.2], gun), 0.06, 0.1, 0.24, [0, -0.02, -0.26], gun);
    const head = new Builder();
    head.add(blobTris(0.29, null, 0, [1, 0.9, 1.05], [0, 0.25, 0]), dark, [0, 0.25, 0]);
    bx(head, 0.32, 0.18, 0.1, [0, 0.14, 0.2], skin); bx(head, 0.34, 0.1, 0.06, [0, 0.22, 0.27], GLOW.cyan); bx(head, 0.38, 0.06, 0.34, [0, 0.36, 0], vest);
    return { hip: 0.82, shoulder: [0.44, 0.78], neck: 0.8, legX: 0.17, torso, head, armL: arm(), armR: arm(), legL: leg(), legR: leg(), gun: rifle,
      stride: 0.7, swing: 0, lean: 0.06, aim: 1.2, hand: 0.74 };
  },
};
const CACHE = new Map();
function design(kind, tint) {
  const key = kind + (tint || "");
  if (!CACHE.has(key)) {
    const d = DESIGNS[kind](tint);
    for (const name of ["torso", "head", "armL", "armR", "legL", "legR", "gun"]) if (d[name]) d[name] = d[name].geometry();
    CACHE.set(key, d);
  }
  return CACHE.get(key);
}

/** Bộ khớp + các động tác dùng chung cho địch và người chơi khác. */
class Rig {
  constructor(root, kind, x, y, z, tint) {
    this.root = root;
    const d = this.d = design(kind, tint);
    this.material = meshes.paint();
    this.group = new T.Group();
    this.group.position.set(x, y, z);
    this.tilt = new T.Group();                     // xoay cả người khi ngã
    this.group.add(this.tilt);
    this.hips = new T.Group();
    this.hips.position.set(0, d.hip, d.hipBack || 0);
    this.tilt.add(this.hips);
    this.torso = new T.Group();
    this.hips.add(this.torso);
    const joint = (parent, geometry, px, py, pz = 0) => { const g = new T.Group(); g.position.set(px, py, pz); parent.add(g); part(g, geometry, this.material, [0, 0, 0]); return g; };
    part(this.torso, d.torso, this.material, [0, 0, 0]);
    this.head = joint(this.torso, d.head, 0, d.neck);
    this.armL = joint(this.torso, d.armL, -d.shoulder[0], d.shoulder[1]);
    this.armR = joint(this.torso, d.armR, d.shoulder[0], d.shoulder[1]);
    if (d.gun) {                                   // súng gắn ở bàn tay phải, tự xoay ngược lại để luôn chĩa thẳng về trước
      this.gun = new T.Group();
      this.gun.position.set(-0.14, -d.hand, 0);
      part(this.gun, d.gun, this.material, [0, 0, 0]);
      this.armR.add(this.gun);
    }
    this.legL = joint(this.hips, d.legL, -d.legX, 0);
    this.legR = joint(this.hips, d.legR, d.legX, 0);
    this.walk = Math.random() * 6;
    this.flash = 0; this.flinch = 0; this.flinchHead = 0; this.side = 1;
    this.dying = -1;
    root.add(this.group);
  }
  get x() { return this.group.position.x; }
  get y() { return this.group.position.y; }
  get z() { return this.group.position.z; }

  /** Trượt mượt về vị trí mới; trả về true nếu đang di chuyển. */
  glide(x, y, z, dt, speed) {
    const p = this.group.position, k = ease(dt);
    if ((x - p.x) ** 2 + (z - p.z) ** 2 > 49) { p.set(x, y, z); return false; }      // hồi sinh / dịch chuyển xa: nhảy thẳng tới
    const nx = p.x + (x - p.x) * k, nz = p.z + (z - p.z) * k;
    const moving = Math.hypot(nx - p.x, nz - p.z) > 0.35 * dt;
    p.set(nx, p.y + (y - p.y) * ease(dt, 16), nz);
    if (moving) this.walk += dt * (2.2 + speed * 1.5);
    return moving;
  }

  /** Dáng đứng/đi + đòn đánh (attack 1 -> 0) + giật lùi khi trúng đạn. */
  pose(moving, attack, dt, pitch = 0) {
    const d = this.d, s = moving ? Math.sin(this.walk) : 0;
    this.flinch = Math.max(0, this.flinch - dt * 5);
    this.flinchHead = Math.max(0, this.flinchHead - dt * 4);
    this.legL.rotation.x = s * d.stride; this.legR.rotation.x = -s * d.stride;
    this.hips.position.y = d.hip + (moving ? Math.abs(Math.cos(this.walk)) * 0.06 : 0);
    this.torso.rotation.x = d.lean + (moving ? d.lean * 0.5 : 0) - this.flinch * 0.5;
    this.torso.rotation.z = (d.sway || 0) * s;
    this.torso.rotation.y = this.flinch * 0.35 * this.side;
    this.head.rotation.x = -d.lean * 0.8 - this.flinchHead * 0.7 + pitch * RAD;
    const out = d.armOut || 0;
    if (d.aim) {                                   // ôm súng chĩa về trước
      const raise = -d.aim + attack * 0.25 + pitch * RAD;
      this.armR.rotation.set(raise, 0, 0);
      this.armL.rotation.set(raise * 0.92, 0, -0.55);
      this.gun.rotation.x = -raise - this.torso.rotation.x + pitch * RAD;
    } else {
      const back = d.armBack || 0, hit = Math.sin(Math.min(1, attack) * Math.PI);      // vung lên rồi bổ xuống
      this.armR.rotation.set(back - s * d.swing - hit * (back ? 2.6 : 2.3), 0, out);
      this.armL.rotation.set(back + s * d.swing - (back || d.armOut ? hit * 2.4 : 0), 0, -out);
    }
  }

  /** Trúng đạn: nháy sáng, giật người ra sau; trúng đầu thì ngật đầu. */
  hit(headshot = false) {
    this.flash = 0.08;
    this.material.color.setScalar(2.4);
    this.flinch = 1;
    this.side = Math.random() < 0.5 ? -1 : 1;
    if (headshot) this.flinchHead = 1;
  }
  blink(dt) {
    if (this.flash > 0) { this.flash -= dt; if (this.flash <= 0) this.material.color.setScalar(1); }
  }

  /** Bắt đầu ngã. (fx, fz) là chỗ viên đạn bay tới: ngã ngửa ra xa hướng đó. */
  die(fx, fz) {
    const p = this.group.position;
    this.group.rotation.y = Math.atan2(fx - p.x, fz - p.z);
    this.dying = 0;
    this.material.color.setScalar(1);
  }
  /** Diễn cảnh ngã rồi chìm dần; trả về false khi xong. */
  tickDead(dt) {
    this.dying += dt;
    const fall = Math.min(1, this.dying / 0.45), k = 1 - (1 - fall) ** 2;
    this.tilt.rotation.x = -k * 1.5;
    this.tilt.position.y = k * 0.12;
    this.armL.rotation.z = -k * 1.1; this.armR.rotation.z = k * 1.1;
    this.legL.rotation.x = k * 0.3; this.legR.rotation.x = -k * 0.2;
    if (this.dying > 1.0) {
      if (!this.material.transparent) { this.material.transparent = true; this.material.needsUpdate = true; }
      this.material.opacity = Math.max(0, 1 - (this.dying - 1.0) / 0.7);
    }
    return this.dying < 1.7;
  }

  vanish() { this.root.remove(this.group); this.material.dispose(); }
}

export class EnemyView extends Rig {
  constructor(root, obj) {
    super(root, obj.kind, obj.x, obj.y, obj.z);
    this.id = obj.id; this.kind = "enemy";
    this.spec = obj.spec; this.size = obj.spec.size;
    this.shape = obj.spec.shape;
    this.tint = new T.Color(obj.spec.color);
    this.barBg = new T.Sprite(BAR_BG);
    this.barMaterial = new T.SpriteMaterial({ color: 0x66f266, depthTest: false });
    this.bar = new T.Sprite(this.barMaterial);
    const top = this.shape.headY / this.size + 0.62;
    for (const [s, w, h] of [[this.barBg, 1.0, 0.11], [this.bar, 0.94, 0.065]]) { s.position.y = top; s.scale.set(w, h, 1); s.visible = false; this.group.add(s); }
    this.group.scale.setScalar(0.01);
    this.grow = 0;
    this.lastHp = obj.hp;
  }

  sync(obj, dt) {
    this.grow += dt;
    this.group.scale.setScalar(Math.max(0.01, this.size * Math.min(1, this.grow / 0.35)));      // trồi lên từ đất
    const moving = this.glide(obj.x, obj.y, obj.z, dt, obj.spec.speed);
    this.group.rotation.y = obj.yaw * RAD;
    this.pose(moving, obj.lunge, dt);
    if (obj.hp < this.lastHp) {
      const frac = Math.max(0, obj.hp / obj.maxHp);
      this.barBg.visible = this.bar.visible = true;
      this.bar.scale.x = 0.94 * frac;
      this.barMaterial.color.set(frac < 0.35 ? 0xf2594d : 0x66f266);
    }
    this.lastHp = obj.hp;
    this.blink(dt);
  }

  die(fx, fz) { super.die(fx, fz); this.barBg.visible = this.bar.visible = false; }
  vanish() { super.vanish(); this.barMaterial.dispose(); }
}

function nameTag(text, tint) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 64;
  const g = c.getContext("2d");
  g.font = "700 34px 'Be Vietnam Pro', 'Segoe UI', sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 6; g.strokeStyle = "rgba(11,18,32,0.85)"; g.strokeText(text, 128, 32);
  g.fillStyle = tint; g.fillText(text, 128, 32);
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false, transparent: true }));
  sprite.scale.set(1.5, 0.375, 1);
  return sprite;
}

/** Người chơi khác trong trận (hiện là bot). */
export class AvatarView extends Rig {
  constructor(root, obj) {
    const tint = PLAYER_COLORS[(obj.id - 1) % PLAYER_COLORS.length];
    super(root, "operator", obj.x, obj.y, obj.z, tint);
    this.id = obj.id; this.kind = "player";
    this.shape = HUMAN_SHAPE; this.size = 1;
    this.tint = new T.Color(tint);
    this.tag = nameTag(obj.name, tint);
    this.tag.position.y = 2.25;
    this.group.add(this.tag);
    this.alive = true;
    this.lastHp = obj.hp;
    this.fire = 0;
  }
  get muzzle() { const p = this.group.position, yaw = this.group.rotation.y; return [p.x + Math.sin(yaw) * 0.8, p.y + 1.3, p.z + Math.cos(yaw) * 0.8]; }

  sync(obj, dt) {
    if (obj.alive !== this.alive) {
      this.alive = obj.alive;
      if (obj.alive) {                               // hồi sinh: dựng lại dáng đứng
        this.dying = -1;
        this.tilt.rotation.x = 0; this.tilt.position.y = 0;
        this.material.opacity = 1; this.material.transparent = false; this.material.needsUpdate = true;
        this.group.position.set(obj.x, obj.y, obj.z);
        this.group.visible = true;
      } else this.die(this.lastFrom ? this.lastFrom[0] : obj.x, this.lastFrom ? this.lastFrom[1] : obj.z + 1);
    }
    this.tag.visible = obj.alive;
    if (!obj.alive) { if (this.dying >= 0 && !this.tickDead(dt)) this.group.visible = false; return; }
    const moving = this.glide(obj.x, obj.y, obj.z, dt, 5);
    this.group.rotation.y = obj.yaw * RAD;
    this.fire = Math.max(0, this.fire - dt * 6);
    this.pose(moving, this.fire, dt, -obj.pitch * 0.6);
    if (obj.hp < this.lastHp) this.hit();
    this.lastHp = obj.hp;
    this.blink(dt);
    this.group.visible = !(obj.shield > 0) || Math.floor(performance.now() / 90) % 2 === 0;      // vừa hồi sinh, đang bất tử: nhấp nháy
  }
  vanish() { super.vanish(); this.tag.material.map.dispose(); this.tag.material.dispose(); }
}

/** Đạn của xạ thủ: viên năng lượng cam kéo vệt. */
export class ShotView {
  constructor(root, obj) {
    this.root = root;
    this.mesh = part(root, BLOB, SHOT, [obj.x, obj.y, obj.z], [0.3, 0.3, 0.3]);
    this.halo = new T.Sprite(HALO);
    this.halo.scale.setScalar(1.3);
    this.mesh.add(this.halo);
  }
  sync(obj, dt) {
    const p = this.mesh.position, k = ease(dt, 25);
    p.set(p.x + (obj.x - p.x) * k, p.y + (obj.y - p.y) * k, p.z + (obj.z - p.z) * k);
    this.mesh.rotation.y += 7 * dt;
  }
  vanish() { this.root.remove(this.mesh); }
}
const SHOT = new T.MeshBasicMaterial({ color: 0xffa040 });
const HALO = new T.SpriteMaterial({ color: 0xff7a1a, opacity: 0.45, transparent: true, blending: T.AdditiveBlending, depthWrite: false });

export class PickupView {
  constructor(root, obj) {
    this.root = root;
    this.base = obj.y || 0;
    this.material = meshes.paint(PICKUP_LOOK[obj.kind][0]);
    this.mesh = part(root, GEM, this.material, [obj.x, this.base + 0.9, obj.z], [0.8, 0.8, 0.8]);
    this.spin = 0;
  }
  sync(obj, dt) {
    this.spin += dt;
    this.mesh.rotation.y += 2.1 * dt;
    this.mesh.position.y = this.base + 0.9 + Math.sin(this.spin * 3) * 0.15;
    this.mesh.visible = obj.life > 4 || Math.floor(obj.life * 8) % 2 === 0;     // sắp biến mất thì nhấp nháy
  }
  vanish() { this.root.remove(this.mesh); this.material.dispose(); }
}

/** Điểm sáng chỉ đường của nhiệm vụ: vòng sáng trên mặt đất + cột sáng cao nhìn thấy từ xa. */
const MARKER_COLOR = { item: 0x38bdf8, hold: 0xffd166, reach: 0x6ee7b7, boss: 0xff5a4d };
export class ObjectiveView {
  constructor(root) {
    this.group = new T.Group();
    this.group.visible = false;
    const additive = (color) => new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false,
      side: T.DoubleSide, fog: false });
    this.ringMat = additive(0xffffff);
    this.beamMat = additive(0xffffff);
    const ring = new T.RingGeometry(0.86, 1, 48);
    ring.rotateX(-Math.PI / 2);
    this.ring = new T.Mesh(ring, this.ringMat);
    this.ring.position.y = 0.06;
    this.disc = new T.Mesh(new T.CircleGeometry(0.86, 40).rotateX(-Math.PI / 2), additive(0xffffff));
    this.disc.material.opacity = 0.12;
    this.disc.position.y = 0.05;
    this.beam = new T.Mesh(new T.CylinderGeometry(1, 1, 70, 16, 1, true), this.beamMat);
    this.beam.position.y = 35;
    this.group.add(this.ring, this.disc, this.beam);
    for (const m of this.group.children) { m.castShadow = false; m.frustumCulled = false; m.renderOrder = 5; }
    root.add(this.group);
    this.t = 0;
    this.kind = "";
  }
  hide() { this.group.visible = false; }
  /** marker: {x, y, z, r, kind} hoặc null; from: {x, z} chỗ người chơi đứng (cột sáng mờ dần khi tới gần để khỏi che màn hình). */
  sync(marker, dt, from = null) {
    if (!marker) { this.group.visible = false; return; }
    this.t += dt;
    this.group.visible = true;
    this.group.position.set(marker.x, marker.y, marker.z);
    if (this.kind !== marker.kind) {
      this.kind = marker.kind;
      const c = MARKER_COLOR[marker.kind] || 0xffffff;
      for (const m of [this.ringMat, this.beamMat, this.disc.material]) m.color.setHex(c);
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3.2);
    this.ring.scale.setScalar(marker.r * (1 + 0.04 * pulse));
    this.disc.scale.setScalar(marker.r);
    const slim = marker.kind === "item" || marker.kind === "boss" ? 0.35 : Math.max(0.5, marker.r * 0.16);
    this.beam.scale.set(slim, 1, slim);
    const near = from ? Math.hypot(from.x - marker.x, from.z - marker.z) : 99;
    const fade = Math.max(0.06, Math.min(1, (near - marker.r * 0.7) / 10));        // đứng trong/sát điểm đích thì cột sáng gần như biến mất
    this.beamMat.opacity = (0.26 + 0.12 * pulse) * fade;
    this.ringMat.opacity = 0.55 + 0.3 * pulse;
  }
}

/** Lựu đạn / bom khói đang bay. */
export class ThrowableView {
  constructor(root, obj) {
    this.root = root;
    this.mesh = part(root, BLOB, obj.kind === "grenade" ? GRENADE : CANISTER, [obj.x, obj.y, obj.z], [0.3, 0.36, 0.3]);
  }
  sync(obj, dt) {
    this.mesh.position.set(obj.x, obj.y, obj.z);
    this.mesh.rotation.x += 9 * dt;
    this.mesh.rotation.z += 5 * dt;
  }
  vanish() { this.root.remove(this.mesh); }
}
const GRENADE = meshes.paint(0x4d7c2a), CANISTER = meshes.paint(0xb8c0cc);

/** Đám khói: một chùm khối xám đặc, phồng lên rồi tan dần. Che mắt cả người lẫn địch. */
export class SmokeView {
  constructor(root, obj) {
    this.root = root;
    this.material = meshes.paint(0xd9dde3);
    this.group = new T.Group();
    this.group.position.set(obj.x, obj.y || 0, obj.z);
    this.puffs = [];
    const r = obj.r;
    for (let i = 0; i < 9; i++) {
      const angle = (i / 8) * Math.PI * 2, ring = i === 8 ? 0 : r * 0.52, size = r * (i === 8 ? 1.15 : 0.95);
      const puff = part(this.group, BLOB, this.material, [Math.cos(angle) * ring, r * (i === 8 ? 0.75 : 0.42), Math.sin(angle) * ring],
        [size, size * 0.85, size]);
      puff.rotation.y = i * 1.7;
      puff.castShadow = false;                     // khói dày đổ bóng đen kịt trông giả
      this.puffs.push(puff);
    }
    this.age = 0;
    root.add(this.group);
  }
  sync(obj, dt) {
    this.age += dt;
    const grow = Math.min(1, this.age / 1.2), fade = Math.min(1, obj.life / 2.5);
    this.group.scale.setScalar(Math.max(0.01, grow));
    if (fade < 1 && !this.material.transparent) { this.material.transparent = true; this.material.needsUpdate = true; }   // chỉ trong suốt lúc đang tan: nhẹ máy hơn
    this.material.opacity = fade;
    this.puffs.forEach((p, i) => { p.rotation.y += dt * 0.12 * (i % 2 ? 1 : -1); });
  }
  vanish() { this.root.remove(this.group); this.material.dispose(); }
}
