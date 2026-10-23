// Kho vũ khí góc nhìn thứ nhất: mô hình có tay cầm, giật, chớp lửa đầu nòng, vỏ đạn, nạp đạn theo từng bước,
// ngắm bắn (chuột phải), lên đạn kiểu bơm/khoá nòng, vung chảo, đâm dao, ném lựu đạn.
// Luật (băng đạn, nhịp bắn, sát thương) nằm ở core/weapons.js; file này lo phần "cảm giác".
import { castRay, viewBasis } from "../core/ballistics.js";
import { LOADOUT, START_INDEX, Weapon } from "../core/weapons.js";
import { UNIT_BOX, flat } from "./meshes.js";

const T = window.THREE;
const RAD = Math.PI / 180;
const HIP = [0.20, -0.175, -0.47];                 // vị trí cầm ngang hông (toạ độ camera của Three.js: -z là phía trước)
const SCALE = 0.5;
const M = { metal: flat(0x363a44), dark: flat(0x1b1c21), wood: flat(0x7a4e2a), woodLight: flat(0x9a6a3c), accent: flat(0xff7a1a),
  steel: flat(0x9aa3ad), olive: flat(0x4e5c3c), iron: flat(0x26282d), pan: flat(0x4a4e57), brass: flat(0xd9a441),
  glove: flat(0x17181b), sleeve: flat(0x3e4636), lens: flat(0x2a6f9c), red: flat(0xc2382f) };
const DISC = new T.CylinderGeometry(0.5, 0.5, 1, 12);
const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const band = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));       // 0 trước a, 1 sau b

// Mỗi món: parts = [vật liệu, kích thước | "cyl", vị trí, nhóm chuyển động]. z dương = chĩa về trước.
// Hộp: [m, [rộng, cao, dài], [x, y, z], nhóm];  Ống: [m, "cyl", [bán kính, dài], [x, y, z], nhóm].
// nhóm: "mag" băng đạn (tụt ra khi nạp) · "slide"/"bolt"/"pump" bộ phận lên đạn (giật lùi sau mỗi phát).
const VIEW = {
  pistol: { grip: [0, -0.13, 0.11], fore: null, muzzle: [0, 0.045, 0.42], sightY: 0.095, port: [0.04, 0.06, 0.2], cycle: ["slide", 0.11, 0.07, 0],
    kick: [0.9, 1.3, 0.5], parts: [
      [M.metal, [0.058, 0.07, 0.31], [0, 0.045, 0.245], "slide"], [M.dark, [0.012, 0.022, 0.012], [0, 0.09, 0.38], "slide"],
      [M.dark, [0.03, 0.02, 0.012], [0, 0.088, 0.1], "slide"], [M.dark, [0.054, 0.05, 0.25], [0, -0.012, 0.22]],
      [M.dark, [0.05, 0.17, 0.08], [0, -0.115, 0.115]], [M.accent, [0.052, 0.012, 0.05], [0, -0.035, 0.115]],
      [M.steel, "cyl", [0.016, 0.03], [0, 0.045, 0.405]], [M.metal, [0.04, 0.14, 0.06], [0, -0.12, 0.115], "mag"]] },
  rifle: { grip: [0, -0.13, 0.0], fore: [0, -0.06, 0.44], muzzle: [0, 0.02, 0.82], sightY: 0.108, port: [0.05, 0.03, 0.12], cycle: ["bolt", 0.09, 0.06, 0],
    kick: [1.0, 1.0, 0.35], parts: [
      [M.metal, [0.075, 0.10, 0.50], [0, 0, 0.10]], [M.dark, "cyl", [0.02, 0.44], [0, 0.02, 0.58]], [M.dark, [0.03, 0.03, 0.3], [0, 0.065, 0.48]],
      [M.wood, [0.072, 0.078, 0.26], [0, 0.0, 0.44]], [M.dark, [0.022, 0.075, 0.022], [0, 0.065, 0.76]], [M.dark, [0.04, 0.03, 0.03], [0, 0.068, 0.08]],
      [M.wood, [0.06, 0.11, 0.3], [0, -0.03, -0.28]], [M.woodLight, [0.062, 0.05, 0.3], [0, 0.0, -0.28]], [M.wood, [0.05, 0.15, 0.07], [0, -0.12, 0.0]],
      [M.accent, [0.078, 0.014, 0.1], [0, 0.058, 0.2]], [M.dark, [0.05, 0.2, 0.09], [0, -0.15, 0.17], "mag"], [M.dark, [0.05, 0.1, 0.09], [0, -0.27, 0.21], "mag"],
      [M.steel, [0.035, 0.025, 0.05], [0.052, 0.03, 0.12], "bolt"]] },
  smg: { grip: [0, -0.13, 0.0], fore: [0, -0.13, 0.33], muzzle: [0, 0.01, 0.55], sightY: 0.092, port: [0.045, 0.02, 0.1], cycle: ["bolt", 0.05, 0.05, 0],
    kick: [0.55, 0.6, 0.6], parts: [
      [M.dark, [0.07, 0.11, 0.38], [0, 0, 0.12]], [M.metal, "cyl", [0.03, 0.22], [0, 0.01, 0.42]], [M.dark, "cyl", [0.016, 0.06], [0, 0.01, 0.55]],
      [M.metal, [0.045, 0.3, 0.06], [0, -0.2, 0.2], "mag"], [M.dark, [0.05, 0.15, 0.065], [0, -0.12, 0.0]], [M.dark, [0.04, 0.13, 0.045], [0, -0.11, 0.33]],
      [M.accent, [0.074, 0.014, 0.16], [0, 0.06, 0.14]], [M.dark, [0.02, 0.03, 0.02], [0, 0.07, 0.28]], [M.steel, [0.012, 0.012, 0.3], [0.03, 0.0, -0.2]],
      [M.steel, [0.012, 0.012, 0.3], [-0.03, 0.0, -0.2]], [M.dark, [0.08, 0.1, 0.03], [0, -0.01, -0.36]], [M.steel, [0.03, 0.02, 0.04], [0.045, 0.03, 0.1], "bolt"]] },
  shotgun: { grip: [0, -0.1, -0.08], fore: [0, -0.06, 0.38], muzzle: [0, 0.045, 0.7], sightY: 0.085, port: [0.05, 0.02, 0.06], cycle: ["pump", 0.46, 0.14, 0.16],
    kick: [2.4, 3.0, 0.8], parts: [
      [M.dark, "cyl", [0.028, 0.72], [0, 0.045, 0.34]], [M.dark, "cyl", [0.024, 0.5], [0, -0.012, 0.36]], [M.metal, [0.076, 0.115, 0.32], [0, 0.005, 0.0]],
      [M.wood, [0.066, 0.12, 0.3], [0, -0.045, -0.3]], [M.woodLight, [0.068, 0.05, 0.12], [0, -0.07, -0.12]], [M.steel, [0.016, 0.02, 0.016], [0, 0.082, 0.68]],
      [M.woodLight, [0.086, 0.072, 0.22], [0, -0.016, 0.38], "pump"], [M.wood, [0.088, 0.02, 0.2], [0, -0.05, 0.38], "pump"]] },
  sniper: { grip: [0, -0.12, -0.04], fore: [0, -0.06, 0.32], muzzle: [0, 0.015, 1.04], sightY: 0.115, port: [0.055, 0.03, 0.0], cycle: ["bolt", 0.95, 0.12, 0.22],
    kick: [2.6, 3.4, 0.4], parts: [
      [M.olive, [0.07, 0.09, 0.52], [0, 0, 0.06]], [M.dark, "cyl", [0.019, 0.72], [0, 0.015, 0.66]], [M.dark, [0.05, 0.05, 0.08], [0, 0.015, 1.0]],
      [M.dark, "cyl", [0.036, 0.3], [0, 0.115, 0.1]], [M.dark, "cyl", [0.046, 0.07], [0, 0.115, 0.27]], [M.dark, "cyl", [0.042, 0.06], [0, 0.115, -0.07]],
      [M.lens, "cyl", [0.038, 0.006], [0, 0.115, -0.102]], [M.dark, [0.03, 0.05, 0.03], [0, 0.07, 0.2]], [M.dark, [0.03, 0.05, 0.03], [0, 0.07, 0.0]],
      [M.olive, [0.066, 0.13, 0.32], [0, -0.03, -0.34]], [M.dark, [0.068, 0.03, 0.2], [0, 0.045, -0.3]], [M.dark, [0.05, 0.14, 0.06], [0, -0.11, -0.04]],
      [M.dark, [0.05, 0.1, 0.11], [0, -0.09, 0.1], "mag"], [M.steel, [0.07, 0.02, 0.022], [0.065, 0.025, -0.02], "bolt"], [M.steel, [0.03, 0.03, 0.03], [0.1, 0.02, -0.02], "bolt"],
      [M.dark, [0.012, 0.012, 0.26], [0.03, -0.05, 0.5]], [M.dark, [0.012, 0.012, 0.26], [-0.03, -0.05, 0.5]]] },
  lmg: { grip: [0, -0.13, -0.02], fore: [0, -0.09, 0.42], muzzle: [0, 0.02, 0.88], sightY: 0.115, port: [0.06, 0.02, 0.14], cycle: ["bolt", 0.07, 0.05, 0],
    kick: [0.8, 0.75, 0.7], parts: [
      [M.metal, [0.09, 0.12, 0.54], [0, 0, 0.08]], [M.dark, "cyl", [0.027, 0.5], [0, 0.02, 0.6]], [M.metal, [0.07, 0.03, 0.34], [0, 0.065, 0.5]],
      [M.dark, [0.024, 0.07, 0.024], [0, 0.07, 0.8]], [M.dark, [0.02, 0.05, 0.16], [0, 0.11, 0.12]], [M.dark, [0.02, 0.05, 0.02], [0, 0.085, 0.05]],
      [M.dark, [0.02, 0.05, 0.02], [0, 0.085, 0.19]], [M.wood, [0.066, 0.12, 0.26], [0, -0.03, -0.3]], [M.dark, [0.05, 0.15, 0.07], [0, -0.12, -0.02]],
      [M.olive, [0.17, 0.16, 0.17], [-0.035, -0.14, 0.15], "mag"], [M.brass, [0.03, 0.035, 0.12], [0.05, -0.04, 0.15], "mag"],
      [M.dark, [0.012, 0.2, 0.012], [0.045, -0.12, 0.72]], [M.dark, [0.012, 0.2, 0.012], [-0.045, -0.12, 0.72]], [M.steel, [0.035, 0.025, 0.05], [0.06, 0.03, 0.14], "bolt"]] },
  pan: { grip: [0, -0.26, 0.3], fore: null, muzzle: [0, 0, 0.4], sightY: 0, port: null, cycle: null, kick: [0, 0, 0], melee: "sweep", parts: [
      [M.wood, [0.045, 0.26, 0.045], [0, -0.2, 0.3]], [M.iron, "disc", [0.4, 0.05], [0, 0.1, 0.3]], [M.pan, "disc", [0.33, 0.012], [0, 0.1, 0.272]]] },
  knife: { grip: [0, -0.02, 0.1], fore: null, muzzle: [0, 0, 0.4], sightY: 0, port: null, cycle: null, kick: [0, 0, 0], melee: "stab", parts: [
      [M.steel, [0.012, 0.055, 0.32], [0, 0.03, 0.36]], [M.steel, [0.012, 0.03, 0.1], [0, 0.005, 0.47]], [M.dark, [0.06, 0.028, 0.03], [0, 0.02, 0.19]],
      [M.wood, [0.036, 0.046, 0.17], [0, 0.02, 0.1]]] },
};

export class Arsenal {
  constructor(game, camera) {
    this.game = game;
    this.view = new T.Group();
    this.view.scale.setScalar(SCALE);
    camera.add(this.view);
    this.models = LOADOUT.map((spec) => this._build(VIEW[spec.key]));
    this._buildFlash();
    this.reset();
  }

  // ---------- dựng mô hình ----------
  _build(def) {
    const root = new T.Group(), groups = {};
    const into = (name) => {
      if (!name) return root;
      if (!groups[name]) { groups[name] = new T.Group(); root.add(groups[name]); }
      return groups[name];
    };
    for (const [material, size, pos, a, b] of def.parts) {
      let mesh, group;
      if (size === "cyl" || size === "disc") {             // ống nòng / mặt chảo: trụ nằm dọc theo trục z
        mesh = new T.Mesh(DISC, material);
        mesh.rotation.x = Math.PI / 2;
        if (size === "cyl") mesh.scale.set(pos[0] * 2, pos[1], pos[0] * 2); else mesh.scale.set(pos[0], pos[1], pos[0]);
        mesh.position.set(a[0], a[1], -a[2]);
        group = b;
      } else {
        mesh = new T.Mesh(UNIT_BOX, material);
        mesh.scale.set(size[0], size[1], size[2]);
        mesh.position.set(pos[0], pos[1], -pos[2]);
        group = a;
      }
      into(group).add(mesh);
    }
    // tay: găng ở chỗ nắm, ống tay áo chạy về phía khuỷu ngoài khung hình
    const arm = (parent, hand, elbow) => {
      const h = new T.Vector3(hand[0], hand[1], -hand[2]), e = new T.Vector3(elbow[0], elbow[1], -elbow[2]);
      const glove = new T.Mesh(UNIT_BOX, M.glove);
      glove.scale.set(0.085, 0.09, 0.1); glove.position.copy(h);
      const sleeve = new T.Mesh(UNIT_BOX, M.sleeve), dir = e.clone().sub(h), len = dir.length();
      sleeve.scale.set(0.095, 0.095, len);
      sleeve.position.copy(h).addScaledVector(dir, 0.5);
      sleeve.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), dir.normalize());
      parent.add(glove, sleeve);
    };
    arm(root, def.grip, [0.3, -0.5, -0.35]);
    if (def.fore) arm(def.cycle && def.cycle[0] === "pump" ? into("pump") : root, def.fore, [-0.5, -0.5, 0.0]);
    else if (!def.melee) arm(root, [def.grip[0] - 0.02, def.grip[1] - 0.06, def.grip[2] + 0.03], [-0.5, -0.5, -0.1]);
    if (def.melee === "sweep") root.rotation.z = -0.25;
    root.userData = { def, groups };
    this.view.add(root);
    return root;
  }

  _buildFlash() {                                          // chớp lửa đầu nòng: ba tấm chéo nhau + quầng sáng
    this.flash = new T.Group();
    const fire = new T.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
    for (let i = 0; i < 3; i++) {
      const plane = new T.Mesh(new T.PlaneGeometry(1, 1), fire);
      if (i < 2) { plane.rotation.z = i * (Math.PI / 2) + Math.PI / 4; plane.scale.set(0.34, 0.1, 1); }
      else { plane.rotation.y = Math.PI / 2; plane.scale.set(0.5, 0.16, 1); plane.position.z = -0.16; }
      this.flash.add(plane);
    }
    const halo = new T.Sprite(new T.SpriteMaterial({ color: 0xffb347, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(0.5);
    this.flash.add(halo);
    this.flash.visible = false;
    this.view.add(this.flash);
  }

  // ---------- trạng thái ----------
  reset() {
    this.weapons = LOADOUT.map((spec) => new Weapon(spec));
    this.index = START_INDEX;
    this.flashT = this.swing = this.draw = this.bloom = 0;
    this.aimT = 0;                    // 0 = cầm ngang hông, 1 = đang ngắm
    this.sprintT = 0;
    this.kick = { z: 0, vz: 0, r: 0, vr: 0, roll: 0, vroll: 0 };      // lò xo giật súng
    this.cycleT = 9;                  // giây kể từ phát bắn gần nhất (để diễn động tác lên đạn)
    this.cycleDone = true;
    this.lastReload = 1;
    this.sway = [0, 0];
    this.sightT = 0;
    this.onTarget = false;            // tâm ngắm đang đè lên mục tiêu (HUD đổi màu tâm)
    this._showModel();
  }
  get weapon() { return this.weapons[this.index]; }
  get def() { return VIEW[this.weapon.spec.key]; }
  /** Độ phóng hiện tại (1 = không ngắm). */
  get zoom() { return 1 + (this.weapon.spec.zoom - 1) * smooth(this.aimT); }
  get scoped() { return this.weapon.spec.scope && this.aimT > 0.8; }
  _showModel() { this.models.forEach((m, i) => { m.visible = i === this.index; }); }

  /** Độ tản hiện tại (độ): ngắm thì chụm, đi/nhảy/bắn liên tục thì toè ra. */
  spread(player) {
    const s = this.weapon.spec;
    if (s.melee) return 0;
    const hip = s.hipSpread ?? s.spread, base = lerp(hip, s.spread * 0.35, smooth(this.aimT));
    const move = 1 + Math.min(1, player.speed / 10) * 0.9 + (player.grounded ? 0 : 1.2);
    return base * move + this.bloom * lerp(1, 0.5, this.aimT) + (player.grounded ? 0 : 0.8);
  }

  select(index) {
    index = ((index % this.weapons.length) + this.weapons.length) % this.weapons.length;
    if (index === this.index) return;
    this.weapon.cancelReload();
    this.index = index;
    this.draw = 1; this.bloom = 0; this.cycleT = 9; this.cycleDone = true; this.lastReload = 1;
    this.onTarget = false;
    this._showModel();
    this.game.sfx.play("draw", this.weapon.spec.melee ? 1.3 : 1);
  }
  /** Đổi sang món kế tiếp còn dùng được (bỏ qua súng đã hết sạch đạn). */
  cycle() {
    for (let step = 1; step <= this.weapons.length; step++) {
      const i = (this.index + step) % this.weapons.length;
      if (!this.weapons[i].outOfAmmo) { this.select(i); return; }
    }
  }
  /** Nhặt hộp đạn: mọi súng dùng đạn có hạn được thêm một ít. */
  addAmmo() { this.weapons.forEach((w) => w.refill()); }

  // ---------- mỗi khung hình ----------
  update(intent, dt, player) {
    const game = this.game;
    let w = this.weapon;
    w.tick(dt);
    if (intent.select !== null) this.select(intent.select);
    else if (intent.switch) this.cycle();
    w = this.weapon;
    const spec = w.spec;
    game.session.setGuard(Boolean(spec.guard));
    if (intent.reload && w.startReload()) this.lastReload = 0;
    if (intent.grenade) this._throw("grenade", player);
    if (intent.smoke) this._throw("smoke", player);

    const canAim = !spec.melee && !w.reloading && this.draw < 0.3;
    this.aimT = Math.max(0, Math.min(1, this.aimT + (intent.aim && canAim ? 1 : -1) * dt * 8));
    this.sprintT = Math.max(0, Math.min(1, this.sprintT + (player.sprinting && player.speed > 7 ? 1 : -1) * dt * 7));
    this.bloom = Math.max(0, this.bloom - (this.bloom * 5 + 0.6) * dt);

    this.sightT -= dt;
    if (this.sightT <= 0) {                                  // 20 lần/giây: tâm ngắm có đang đè lên mục tiêu không
      this.sightT = 0.05;
      this.onTarget = spec.melee ? this._inReach(spec, player).length > 0
        : castRay(player.eye, viewBasis(player.yaw, player.aimPitch).forward, spec.range, game.solids, game.targets()).target !== null;
    }
    const wantFire = intent.fire || (intent.autoFire && this.onTarget);
    if (wantFire && this.draw < 0.35) {
      if (w.tryFire()) { if (spec.melee) this._strike(spec, player); else this._shoot(w, player); }
      else if (w.ammo === 0 && !w.reloading && !spec.melee) {
        if (w.outOfAmmo) { game.sfx.play("dry"); this.select(0); }      // hết sạch đạn -> về súng lục (đạn vô hạn)
        else if (w.startReload()) this.lastReload = 0;
      }
    }
    this._animate(dt, player, intent);
  }

  _shoot(w, player) {
    const spec = w.spec, game = this.game, def = this.def, aim = smooth(this.aimT);
    const { forward, right, up } = viewBasis(player.yaw, player.aimPitch);
    const origin = player.eye;
    const muzzle = add(add(add(origin, forward, 0.78), right, lerp(0.2, 0, aim)), up, lerp(-0.15, -0.06, aim));
    const spread = Math.tan(this.spread(player) * RAD);
    const solids = game.solids, targets = game.targets(), damage = new Map(), ends = [];
    for (let i = 0; i < spec.pellets; i++) {
      const a = game.rng.gauss(spread), b = game.rng.gauss(spread);
      let dir = [forward[0] + right[0] * a + up[0] * b, forward[1] + right[1] * a + up[1] * b, forward[2] + right[2] * a + up[2] * b];
      const len = Math.hypot(...dir); dir = dir.map((v) => v / len);
      const hit = castRay(origin, dir, spec.range, solids, targets);
      game.effects.tracer(muzzle, hit.point, origin, 0xffe6a0, spec.scope ? 0.06 : 0.035);
      ends.push(hit.point);
      if (hit.target) {
        const d = damage.get(hit.target) || { total: 0, head: false, point: hit.point };
        d.total += spec.damage; d.head = d.head || hit.head;
        damage.set(hit.target, d);
      } else if (hit.hitSomething) {
        game.effects.impact(hit.point, hit.point[1] < 0.06 ? 0xb9ad8f : 0xcfc8ba);
      }
    }
    for (const [target, d] of damage) game.damageTarget(target, d.total, d.head, d.point);
    game.reportShot(muzzle, ends);

    // giật: camera hất lên + lệch ngang ngẫu nhiên, súng thụt lùi và ngóc đầu; bắn liên tục thì đạn toè dần
    const k = lerp(1, 0.7, aim);
    player.kick += spec.recoil * k;
    player.yaw += game.rng.gauss(spec.kickYaw * 0.4) * k;
    this.kick.vz += def.kick[0] * 3.2; this.kick.vr += def.kick[1] * 26; this.kick.vroll += (Math.random() - 0.5) * def.kick[2] * 30;
    this.bloom = Math.min(spec.bloomMax, this.bloom + spec.bloom);
    this.cycleT = 0; this.cycleDone = false;
    this.flashT = 0.05;
    this.flash.visible = !this.scoped;
    this.flash.rotation.z = Math.random() * Math.PI * 2;
    this.flash.scale.setScalar((0.8 + Math.random() * 0.5) * (spec.pellets > 1 || spec.scope ? 1.6 : 1));
    if (spec.pellets > 1 || spec.scope) game.effects.puff(add(muzzle, forward, 0.3), 0.3, 0x9a9a9a, 0.6, 0.3, 0.5);
    if (!def.cycle[3]) this._eject(player);                    // súng tự động: hất vỏ ngay; bơm/khoá nòng: hất khi kéo
    game.sfx.play(spec.sound, 0.95 + Math.random() * 0.1);
  }

  _eject(player) {
    const { forward, right, up } = viewBasis(player.yaw, player.aimPitch), aim = smooth(this.aimT);
    const pos = add(add(add(player.eye, forward, 0.45), right, lerp(0.24, 0.06, aim)), up, -0.11);
    const v = add(add(add([0, 0, 0], right, 2.2 + Math.random() * 1.2), up, 1.6 + Math.random()), forward, (Math.random() - 0.5) * 1.2);
    this.game.effects.casing(pos, v, this.weapon.spec.pellets > 1);
  }

  /** Những mục tiêu trong tầm với và trong góc quét trước mặt. */
  _inReach(spec, player) {
    return this.game.targets().filter((t) => {
      const dx = t.x - player.x, dz = t.z - player.z, reach = spec.range + t.shape.r;
      if (dx * dx + dz * dz > reach * reach || Math.abs(player.y - t.y) > 1.6) return false;
      const off = Math.abs((((Math.atan2(dx, dz) / RAD - player.yaw + 180) % 360) + 360) % 360 - 180);
      return off <= spec.arc / 2;
    });
  }

  _strike(spec, player) {
    const game = this.game, hits = this._inReach(spec, player);
    this.swing = 1;
    for (const t of hits) game.damageTarget(t, spec.damage, false, [t.x, t.y + t.shape.h * 0.75, t.z], "melee");
    game.sfx.play(hits.length ? spec.sound : "swish", 0.95 + Math.random() * 0.1);
    if (hits.length) player.shake = Math.min(1, player.shake + 0.25);
  }

  _throw(kind, player) {
    const game = this.game;
    const { forward, right, up } = viewBasis(player.yaw, player.aimPitch - 12);      // ném hơi vồng lên
    const origin = add(add(add(player.eye, forward, 0.6), right, 0.25), up, -0.1);
    if (!game.session.throwItem(kind, origin, forward)) { game.hud.toast(kind === "grenade" ? "Hết lựu đạn" : "Hết bom khói"); return; }
    this.draw = Math.max(this.draw, 0.8);
    game.sfx.play("swish", 0.7);
  }

  _animate(dt, player, intent) {
    const w = this.weapon, spec = w.spec, def = this.def, game = this.game, model = this.models[this.index], g = model.userData.groups;
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.visible = false; }
    this.flash.position.set(def.muzzle[0], def.muzzle[1], -def.muzzle[2] - 0.08);
    this.draw = Math.max(0, this.draw - dt * 3.6);
    this.swing = Math.max(0, this.swing - dt / Math.max(0.2, spec.fireInterval * 0.9));

    // lò xo giật: kéo về vị trí nghỉ, có giảm chấn
    const k = this.kick, step = Math.min(dt, 0.033);
    k.vz += (-220 * k.z - 22 * k.vz) * step; k.z += k.vz * step;
    k.vr += (-260 * k.r - 24 * k.vr) * step; k.r += k.vr * step;
    k.vroll += (-200 * k.roll - 20 * k.vroll) * step; k.roll += k.vroll * step;

    // động tác lên đạn sau mỗi phát: [bộ phận, thời lượng, quãng lùi, trễ]
    this.cycleT += dt;
    if (def.cycle) {
      const [name, duration, travel, delay] = def.cycle, t = (this.cycleT - delay) / duration;
      const back = t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t);
      if (g[name]) g[name].position.z = back * travel;         // +z của Three.js = lùi về phía người bắn
      if (delay && !this.cycleDone && t > 0.05) {              // bơm / kéo khoá nòng: lúc này mới hất vỏ và có tiếng
        this.cycleDone = true;
        game.sfx.play(name === "pump" ? "pump" : "bolt", 1);
        this._eject(player);
      }
      if (name === "bolt" && delay && g.bolt) g.bolt.rotation.z = back * 0.9;
    }

    // nạp đạn theo bước: nghiêng súng -> rút băng -> lắp băng -> lên đạn
    const p = w.reloading ? w.reloadProgress : 1;
    if (w.reloading) {
      if (this.lastReload < 0.14 && p >= 0.14) game.sfx.play("magout");
      if (this.lastReload < 0.62 && p >= 0.62) game.sfx.play("magin");
      if (this.lastReload < 0.84 && p >= 0.84) game.sfx.play(def.cycle && def.cycle[0] === "pump" ? "pump" : "bolt", 1.1);
    }
    this.lastReload = p;
    const tilt = w.reloading ? smooth(band(p, 0, 0.14)) * (1 - smooth(band(p, 0.9, 1))) : 0;
    const magOut = w.reloading ? smooth(band(p, 0.14, 0.3)) * (1 - smooth(band(p, 0.45, 0.62))) : 0;
    const rack = w.reloading ? Math.sin(Math.PI * band(p, 0.82, 0.94)) : 0;
    if (g.mag) { g.mag.position.y = -magOut * 0.45; g.mag.rotation.x = -magOut * 0.5; g.mag.visible = !(w.reloading && p > 0.3 && p < 0.45); }
    if (rack && def.cycle && g[def.cycle[0]]) g[def.cycle[0]].position.z = rack * def.cycle[2];

    // lắc theo bước chân, trễ theo chuột, hạ súng khi chạy, nhún khi tiếp đất
    const aim = smooth(this.aimT), run = smooth(this.sprintT) * (1 - aim), moving = player.grounded ? Math.min(1, player.speed / 6) : 0;
    const bobX = Math.sin(player.bobT) * 0.012 * moving * (1 - aim * 0.85), bobY = Math.abs(Math.cos(player.bobT)) * 0.012 * moving * (1 - aim * 0.85);
    this.sway[0] += (-(intent.lookYaw || 0) * 0.0035 - this.sway[0]) * Math.min(1, 10 * dt);
    this.sway[1] += ((intent.lookPitch || 0) * 0.0035 - this.sway[1]) * Math.min(1, 10 * dt);
    const sx = Math.max(-0.05, Math.min(0.05, this.sway[0])), sy = Math.max(-0.05, Math.min(0.05, this.sway[1]));
    const ads = [0, -def.sightY * SCALE - 0.008, -0.34];
    const chop = Math.sin(this.swing * Math.PI), stab = def.melee === "stab";
    const v = this.view;
    v.position.set(
      lerp(HIP[0], ads[0], aim) + bobX + sx + run * -0.06 - (stab ? 0 : chop * 0.2),
      lerp(HIP[1], ads[1], aim) - bobY + sy - this.draw * 0.3 - tilt * 0.05 - run * 0.05 - player.land * 0.05 + (stab ? 0 : chop * 0.05),
      lerp(HIP[2], ads[2], aim) + k.z * 0.06 - (stab ? chop * 0.22 : chop * 0.12));
    v.rotation.set(
      (k.r * 0.1 - this.draw * 40 - tilt * 16 - run * 14 + rack * 3 - (stab ? chop * 6 : chop * 30)) * RAD,
      (run * 38 + tilt * 10 + (stab ? 0 : chop * 55) + sx * 60) * RAD,
      (k.roll * 0.1 + tilt * 24 + run * 12 - sx * 90) * RAD);
    v.visible = !this.scoped;
  }
}
