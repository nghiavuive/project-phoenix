// Người chơi góc nhìn thứ nhất: nhìn, đi, chạy, nhảy, lên dốc, rơi khỏi mép sàn, ngắm bắn, rung camera.
import { config } from "../config.js";
import { BODY } from "../core/collide.js";
import { clamp } from "../core/geometry.js";

const RAD = Math.PI / 180;

export class Player {
  constructor(camera) {
    this.camera = camera;
    camera.rotation.order = "YXZ";
    this.reset();
  }

  reset(x = 0, z = 0) {
    this.x = x; this.y = 0; this.z = z;
    this.vy = 0;
    this.yaw = this.pitch = 0;
    this.kick = 0;                    // camera hất lên vì giật súng (tự hồi)
    this.shake = 0;
    this.bobT = 0;
    this.speed = 0;
    this.grounded = true;
    this.sprinting = false;
    this.land = 0;                    // vừa tiếp đất mạnh cỡ nào (để nhún súng)
    this.stepped = false;             // khung hình này vừa đặt một bước chân (để phát tiếng)
    this.zoom = 1;                    // độ phóng hiện tại khi ngắm
    this.fovH = config.FOV_H;
    this.applyCamera();
  }
  get eye() { return [this.x, this.y + config.EYE_HEIGHT, this.z]; }
  get aimPitch() { return this.pitch - this.kick; }

  /** aim: độ phóng muốn đạt (1 = không ngắm). */
  update(intent, dt, col, aim = 1) {
    this.zoom += (aim - this.zoom) * Math.min(1, 14 * dt);
    const sens = 1 / Math.pow(this.zoom, 0.85);                     // ngắm càng gần thì xoay càng chậm cho dễ chỉnh
    this.yaw += intent.lookYaw * sens;
    this.pitch = clamp(this.pitch + intent.lookPitch * sens, -config.PITCH_LIMIT, config.PITCH_LIMIT);

    let mx = intent.moveX, mz = intent.moveZ;
    const length = Math.hypot(mx, mz);
    if (length > 1) { mx /= length; mz /= length; }
    this.sprinting = intent.sprint && mz > 0.1 && aim <= 1.01;
    const top = (this.sprinting ? config.SPRINT_SPEED : config.WALK_SPEED) * (aim > 1.01 ? 0.6 : 1);
    const s = Math.sin(this.yaw * RAD), c = Math.cos(this.yaw * RAD);
    const vx = (c * mx + s * mz) * top;                             // phải = (cos, -sin), trước = (sin, cos)
    const vz = (-s * mx + c * mz) * top;
    [this.x, this.z] = col.resolve(this.x + vx * dt, this.z + vz * dt, config.PLAYER_RADIUS, this.y, config.ARENA_RADIUS);
    this.speed = Math.hypot(vx, vz);

    // độ cao: bám theo dốc khi đang đứng, rơi khi bước khỏi mép, không nhảy xuyên trần
    const ground = col.ground(this.x, this.z, this.y);
    this.land = Math.max(0, this.land - dt * 5);
    if (this.grounded && this.vy <= 0) {
      if (ground >= this.y - 0.7) this.y = ground; else this.grounded = false;
      if (intent.jump && this.grounded) { this.vy = config.JUMP_SPEED; this.grounded = false; }
    }
    if (!this.grounded) {
      this.vy -= config.GRAVITY * dt;
      this.y += this.vy * dt;
      const roof = col.ceiling(this.x, this.z, this.y - this.vy * dt);
      if (this.vy > 0 && this.y + BODY > roof) { this.y = roof - BODY; this.vy = 0; }
      if (this.vy <= 0 && this.y <= ground) {
        this.land = Math.min(1, -this.vy / 12);
        this.y = ground; this.vy = 0; this.grounded = true;
      }
    }

    this.stepped = false;
    if (this.grounded && this.speed > 0.5) {
      const before = this.bobT;
      this.bobT += dt * this.speed * 1.5;
      this.stepped = Math.floor(before / Math.PI) !== Math.floor(this.bobT / Math.PI);
    }
    this.kick -= this.kick * Math.min(1, 9 * dt);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const target = (this.sprinting && this.speed > 1 ? config.SPRINT_FOV_H : config.FOV_H);
    this.fovH += (target - this.fovH) * Math.min(1, 8 * dt);
    this.applyCamera();
  }

  /** Tự chỉnh tâm dọc về phía mục tiêu gần tâm ngắm nhất. targets: [[x, y, z]]. */
  aimAssist(targets, dt) {
    let best = null, bestOff = 14;
    for (const [tx, ty, tz] of targets) {
      const dx = tx - this.x, dz = tz - this.z;
      const off = Math.abs((((Math.atan2(dx, dz) / RAD - this.yaw + 180) % 360) + 360) % 360 - 180);
      if (off < bestOff) { best = [dx, ty - (this.y + config.EYE_HEIGHT), dz]; bestOff = off; }
    }
    const want = best ? -Math.atan2(best[1], Math.hypot(best[0], best[2])) / RAD : 0;
    this.pitch += (want - this.pitch) * Math.min(1, config.TOUCH_AIM_ASSIST * dt);
  }

  applyCamera() {
    const cam = this.camera;
    const bob = this.grounded ? Math.sin(this.bobT * 2) * 0.03 * Math.min(1, this.speed / 6) : 0;
    const jx = (Math.random() * 2 - 1) * this.shake * 0.06, jy = (Math.random() * 2 - 1) * this.shake * 0.06;
    cam.position.set(this.x + jx, this.y + config.EYE_HEIGHT + bob + jy - this.land * 0.12, -this.z);   // Three.js: z ngược dấu
    cam.rotation.set(-(this.pitch - this.kick) * RAD, -this.yaw * RAD, 0);
    // giữ góc nhìn NGANG cố định; màn hình dọc thì chặn lại kẻo méo hình. Ngắm = thu hẹp góc nhìn.
    const vertical = (2 * Math.atan(Math.tan((this.fovH * RAD) / 2) / cam.aspect)) / RAD;
    const fov = (2 * Math.atan(Math.tan((clamp(vertical, 35, 78) * RAD) / 2) / this.zoom)) / RAD;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }
}
