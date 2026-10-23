// Điều khiển bàn phím + chuột (khoá con trỏ để nhìn quanh như game bắn súng thông thường).
import { config } from "../config.js";
import { makeIntent } from "./intent.js";

export class DesktopControls {
  constructor(surface) {
    this.surface = surface;           // phần tử nhận khoá chuột
    this.keys = new Set();
    this.edges = new Set();
    this.select = null;
    this.dx = this.dy = 0;
    this.mouseDown = false;
    this.rightDown = false;
    this.locked = false;
    this.lockRefused = false;         // nơi không cho khoá chuột: giữ chuột trái và kéo để nhìn
    this.sensitivity = config.MOUSE_DEG_PER_PX;
    this.active = false;              // đang trong trận (để biết có nên xin khoá chuột khi bấm vào màn hình)

    addEventListener("keydown", (e) => this._key(e, true));
    addEventListener("keyup", (e) => this._key(e, false));
    addEventListener("blur", () => { this.keys.clear(); this.mouseDown = this.rightDown = false; });
    surface.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) this.rightDown = true;
      if (!this.locked && this.active) this.capture();      // trận bắt đầu không qua cú bấm của mình (vd. chủ phòng bấm): bấm vào màn hình để khoá chuột
    });
    addEventListener("mouseup", (e) => { if (e.button === 0) this.mouseDown = false; if (e.button === 2) this.rightDown = false; });
    surface.addEventListener("contextmenu", (e) => e.preventDefault());
    addEventListener("mousemove", (e) => {
      if (this.locked || (this.lockRefused && this.mouseDown)) { this.dx += e.movementX || 0; this.dy += e.movementY || 0; }
    });
    surface.addEventListener("wheel", () => this.edges.add("switch"), { passive: true });
    document.addEventListener("pointerlockchange", () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === surface;
      if (this.locked) this.lockRefused = false;
      if (was && !this.locked) this.edges.add("pause");   // bấm Esc thoát khoá chuột = tạm dừng
    });
    document.addEventListener("pointerlockerror", () => { this.lockRefused = true; });
  }

  _key(e, down) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.code;
    if (down) {
      if (e.repeat) return;
      this.keys.add(k);
      if (k === "Space") { this.edges.add("jump"); e.preventDefault(); }
      else if (k === "KeyR") this.edges.add("reload");
      else if (k === "KeyQ") this.edges.add("switch");
      else if (k === "KeyP" || (k === "Escape" && !this.locked)) this.edges.add("pause");
      else if (k === "KeyG") this.edges.add("grenade");
      else if (k === "KeyF") this.edges.add("smoke");
      else if (/^Digit[1-8]$/.test(k)) this.select = Number(k.slice(-1)) - 1;
    } else {
      this.keys.delete(k);
    }
  }

  /** Xin khoá chuột; phải gọi ngay trong lúc người chơi bấm nút. */
  capture() {
    if (this.locked || !this.surface.requestPointerLock) { this.lockRefused = !this.surface.requestPointerLock; return; }
    try {
      const wait = this.surface.requestPointerLock();
      if (wait && wait.catch) wait.catch(() => { this.lockRefused = true; });
    } catch { this.lockRefused = true; }
  }
  release() { if (document.pointerLockElement === this.surface) document.exitPointerLock(); }

  reset() { this.edges.clear(); this.select = null; this.dx = this.dy = 0; }

  poll() {
    const has = (...codes) => codes.some((c) => this.keys.has(c));
    const intent = makeIntent({
      moveX: (has("KeyD", "ArrowRight") ? 1 : 0) - (has("KeyA", "ArrowLeft") ? 1 : 0),
      moveZ: (has("KeyW", "ArrowUp") ? 1 : 0) - (has("KeyS", "ArrowDown") ? 1 : 0),
      sprint: has("ShiftLeft", "ShiftRight"),
      jump: this.edges.has("jump"), reload: this.edges.has("reload"),
      switch: this.edges.has("switch"), pause: this.edges.has("pause"),
      grenade: this.edges.has("grenade"), smoke: this.edges.has("smoke"),
      select: this.select,
      lookYaw: this.dx * this.sensitivity,
      lookPitch: this.dy * this.sensitivity,
      aim: this.rightDown || has("ControlLeft", "KeyV"),
    });
    if (this.locked) intent.fire = this.mouseDown;
    else if (this.lockRefused) { intent.autoFire = true; intent.aimAssist = !this.mouseDown; }
    this.reset();
    return intent;
  }
}
