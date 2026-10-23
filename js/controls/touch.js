// Điều khiển cảm ứng: cần ảo bên trái, vuốt để nhìn bên phải, các nút bấm.
// Lớp này không đụng tới trình duyệt: nhận các điểm chạm {id: [x, y]} theo toạ độ giao diện
// (x từ -tỉ_lệ/2 đến +tỉ_lệ/2, y từ -0.5 đến +0.5, gốc ở giữa màn hình, y hướng lên) và trả ra Intent.
//   "dual"       : đa chạm - ngón trái đi, ngón phải nhìn/bắn (điện thoại).
//   "one_finger" : chỉ một điểm chạm - cần ảo vừa tiến/lùi vừa xoay, game tự bắn và tự chỉnh tâm dọc.
import { config } from "../config.js";
import { makeIntent } from "./intent.js";

export class TouchControls {
  constructor(aspect = 16 / 9, scheme = "dual") {
    this.scheme = scheme;
    this.stickOrigin = null;          // tâm cần ảo (nổi theo chỗ đặt ngón)
    this.stickVec = [0, 0];           // -1..1
    this.roles = new Map();           // id điểm chạm -> vai trò
    this.last = new Map();            // id -> vị trí khung hình trước
    this.aiming = false;              // nút NGẮM là công tắc: bấm bật, bấm lần nữa tắt
    this.sensitivity = 1;
    this.setAspect(aspect);
  }

  setAspect(aspect) {
    this.aspect = aspect;
    const s = Math.max(0.6, Math.min(1, aspect / 1.6));   // màn hình hẹp thì thu nút lại
    const right = aspect / 2, top = 0.5;
    const b = (name, x, y, r, label, hold = false) => ({ name, x, y, r, label, hold, pressed: false });
    this.stickRadius = config.TOUCH_STICK_RADIUS * s;
    this.buttons = [
      b("fire", right - 0.17 * s, -0.27, 0.085 * s, "BẮN", true),
      b("jump", right - 0.37 * s, -0.38, 0.055 * s, "NHẢY"),
      b("reload", right - 0.09 * s, -0.06, 0.050 * s, "NẠP"),
      b("switch", right - 0.30 * s, -0.10, 0.050 * s, "ĐỔI"),
      b("grenade", right - 0.44 * s, -0.21, 0.048 * s, "LỰU"),
      b("smoke", right - 0.51 * s, -0.36, 0.045 * s, "KHÓI"),
      b("aim", right - 0.33 * s, 0.03, 0.048 * s, "NGẮM"),
      b("pause", right - 0.07 * s, top - 0.07, 0.040 * s, "II"),
    ];
    this.stickHome = [-right + 0.20 * s, -0.27];          // chỗ vẽ cần ảo khi chưa chạm
  }

  poll(dt, pointers = {}) {
    const intent = makeIntent(), edges = new Set();
    for (const id of [...this.roles.keys()]) {            // ngón vừa nhấc
      if (id in pointers) continue;
      if (this.roles.get(id) === "stick") { this.stickOrigin = null; this.stickVec = [0, 0]; }
      this.roles.delete(id); this.last.delete(id);
    }
    for (const [key, [x, y]] of Object.entries(pointers)) {
      const id = String(key);
      if (!this.roles.has(id)) {                          // ngón vừa đặt
        const role = this._assign(x, y);
        this.roles.set(id, role);
        if (role === "stick") this.stickOrigin = [x, y];
        else if (role !== "look" && role !== "fire") edges.add(role);
      }
      const role = this.roles.get(id);
      const [lx, ly] = this.last.get(id) || [x, y];
      if (role === "stick") this._updateStick(x, y);
      else if (role === "look" || role === "fire") {      // kéo để nhìn
        intent.lookYaw += (x - lx) * config.TOUCH_SENSITIVITY * this.sensitivity;
        intent.lookPitch -= (y - ly) * config.TOUCH_SENSITIVITY * this.sensitivity;
      }
      this.last.set(id, [x, y]);
    }
    const held = new Set(this.roles.values());
    for (const btn of this.buttons) btn.pressed = held.has(btn.name);

    const [sx, sy] = this.stickVec;
    if (this.scheme === "one_finger") {
      intent.moveZ = sy;
      intent.lookYaw += sx * config.TOUCH_TURN_SPEED * dt;
      intent.autoFire = true;
      intent.aimAssist = true;
    } else {
      intent.moveX = sx; intent.moveZ = sy;
      intent.autoFire = config.TOUCH_AUTO_FIRE;
    }
    intent.sprint = Math.hypot(sx, sy) > 0.92 && sy > 0.3;
    intent.fire = held.has("fire");
    intent.jump = edges.has("jump");
    intent.reload = edges.has("reload");
    intent.switch = edges.has("switch");
    intent.pause = edges.has("pause");
    intent.grenade = edges.has("grenade");
    intent.smoke = edges.has("smoke");
    if (edges.has("aim")) this.aiming = !this.aiming;
    intent.aim = this.aiming;
    for (const btn of this.buttons) if (btn.name === "aim") btn.pressed = this.aiming;
    return intent;
  }

  releaseAll() {
    this.roles.clear(); this.last.clear();
    this.stickOrigin = null; this.stickVec = [0, 0];
    this.aiming = false;
    for (const b of this.buttons) b.pressed = false;
  }

  _assign(x, y) {
    for (const b of this.buttons) {
      if ((x - b.x) ** 2 + (y - b.y) ** 2 <= (b.r * 1.25) ** 2) return b.name;
    }
    if (x < 0 && ![...this.roles.values()].includes("stick")) return "stick";
    return "look";
  }

  _updateStick(x, y) {
    const [ox, oy] = this.stickOrigin;
    let dx = (x - ox) / this.stickRadius, dy = (y - oy) / this.stickRadius;
    const length = Math.hypot(dx, dy);
    if (length > 1) { dx /= length; dy /= length; }
    if (length < 0.12) dx = dy = 0;                       // vùng chết
    this.stickVec = [dx, dy];
  }
}
