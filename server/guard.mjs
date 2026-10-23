// Chống gian lận ở máy chủ phòng. Nguyên tắc: máy khách chỉ được BÁO điều mình làm, máy chủ tự quyết kết quả.
//  - Vị trí: bị giới hạn tốc độ và không được chui vào vật cản; đi quá nhanh thì bị kéo lại chỗ cũ.
//  - Sát thương: máy chủ tự tính từ loại súng, bỏ số sát thương máy khách gửi; phát bắn phải đúng tầm, đúng hướng nhìn,
//    không xuyên tường, đúng nhịp bắn của súng đó; trúng đầu do máy chủ tự xét lại.
//  - Vật ném: giới hạn nhịp. Gói tin: giới hạn số gói mỗi giây.
// Phạm lỗi thì cộng điểm nghi ngờ (tự giảm theo thời gian, nên lag thoáng qua không sao); vượt ngưỡng thì đuổi khỏi phòng.
import { config } from "../js/config.js";
import { buildSolids, castRay, viewBasis } from "../js/core/ballistics.js";
import { HUMAN_SHAPE } from "../js/core/enemies.js";
import { LOADOUT } from "../js/core/weapons.js";

const RAD = Math.PI / 180;
export const LIMITS = Object.freeze({
  speed: config.SPRINT_SPEED * 1.25,       // m/s ngang, dư 25% cho trễ mạng
  rise: 16,                                // m/s đi lên (nhảy 7, leo dốc)
  burst: 4.0,                              // mét "tích trữ" tối đa: gói tin dồn cục sau khi lag không bị phạt oan
  kickAt: 25,                              // điểm nghi ngờ bị đuổi
  decay: 1.0,                              // điểm tự giảm mỗi giây
  msgRate: 80, msgBurst: 160,              // gói tin/giây và độ dồn tối đa
  throwEvery: 0.35,
  aimSlack: 0.105,                         // ≈6°: trễ mạng và 20 gói vị trí mỗi giây nên hướng nhìn của máy chủ luôn cũ một chút
  lagReach: 1.2,                           // địch/đối thủ trên máy khách chậm hơn máy chủ tới ~0.15 s
});
const WEAPONS = Object.fromEntries(LOADOUT.map((w) => [w.key, w]));

/** Xô token: mỗi lần dùng mất `cost`, đầy lại với tốc độ `rate`/giây tới tối đa `cap`. */
export class Bucket {
  constructor(rate, cap, now) { this.rate = rate; this.cap = cap; this.v = cap; this.t = now; }
  take(now, cost = 1) {
    this.v = Math.min(this.cap, this.v + (now - this.t) * this.rate);
    this.t = now;
    if (this.v < cost) return false;
    this.v -= cost;
    return true;
  }
}

export class Guard {
  /** solids: khối chắn đạn của bản đồ (buildSolids). */
  constructor(layout, now) {
    this.solids = buildSolids(layout);
    this.sus = 0;                          // điểm nghi ngờ
    this.t = now;
    this.msgs = new Bucket(LIMITS.msgRate, LIMITS.msgBurst, now);
    this.move = new Bucket(LIMITS.speed, LIMITS.burst, now);   // "ngân sách" quãng đường
    this.fire = {};                        // khoá súng -> xô nhịp bắn
    this.throwT = -1;
    this.last = null;                      // vị trí cuối máy chủ chấp nhận: [x, y, z, thời điểm]
    this.grace = 0;                        // hết hạn miễn trừ sau khi máy chủ tự dịch chuyển người chơi (hồi sinh, vào trận)
    this.log = [];                         // vài lỗi gần nhất, để báo vào nhật ký khi đuổi
  }

  flag(now, weight, why) {
    this.sus = Math.max(0, this.sus - (now - this.t) * LIMITS.decay) + weight;
    this.t = now;
    this.log.push(why); if (this.log.length > 5) this.log.shift();
    return this.sus >= LIMITS.kickAt;
  }
  get kicked() { return this.sus >= LIMITS.kickAt; }

  /** Mỗi gói tin tới: còn trong hạn mức không? Quá hạn mức thì cộng nghi ngờ nặng. */
  allow(now) {
    if (this.msgs.take(now)) return true;
    this.flag(now, 2, "spam gói tin");
    return false;
  }

  /**
   * Gói vị trí. p: người chơi trong mô phỏng. Trả về vị trí được chấp nhận [x, y, z] (có thể khác vị trí máy khách báo).
   * Máy chủ tự đặt người chơi (hồi sinh) thì p.x/p.z đổi mà không qua đây: nhận ra bằng cách so với vị trí đã chấp nhận.
   */
  pose(sim, p, x, y, z, now) {
    const col = sim.col;
    if (this.last && (Math.abs(this.last[0] - p.x) > 0.01 || Math.abs(this.last[2] - p.z) > 0.01)) {
      this.last = null; this.grace = now + 1.5;                 // máy chủ vừa dịch chuyển người này
    }
    if (!this.last) { this.last = [p.x, p.y, p.z, now]; this.move.v = LIMITS.burst; this.move.t = now; }
    const [lx, ly, lz, lt] = this.last, dt = Math.max(0, Math.min(1, now - lt));
    let nx = x, ny = y, nz = z, bad = null;

    const dist = Math.hypot(x - lx, z - lz);
    if (now < this.grace) {
      nx = lx + Math.max(-LIMITS.burst, Math.min(LIMITS.burst, x - lx)); nz = lz + Math.max(-LIMITS.burst, Math.min(LIMITS.burst, z - lz));
    } else if (dist > 0.02) {
      if (!this.move.take(now, dist)) {                          // đi nhanh hơn mức cho phép: kéo về, chỉ cho đi tới đâu hết ngân sách tới đó
        const allow = Math.max(0, this.move.v), k = dist > 0 ? Math.min(1, allow / dist) : 0;
        nx = lx + (x - lx) * k; nz = lz + (z - lz) * k;
        this.move.v = 0;
        bad = "đi quá nhanh";
      }
    }
    if (ny - ly > LIMITS.rise * Math.max(dt, 0.05) + 0.5 && now >= this.grace) { ny = ly + LIMITS.rise * Math.max(dt, 0.05); bad = bad || "bay lên"; }
    if (!bad && now >= this.grace && col.inside(nx, ny + 0.9, nz)) { nx = lx; nz = lz; ny = ly; bad = "chui vào vật cản"; }
    if (bad && this.flag(now, bad === "chui vào vật cản" ? 0.5 : 1, bad)) return null;

    this.last = [nx, ny, nz, now];
    return [nx, ny, nz];
  }

  /**
   * Một phát bắn trúng. attacker: người bắn trong mô phỏng; target: {x, y, z, shape}; key: loại súng máy khách báo.
   * Trả về {damage, head} do máy chủ tự quyết, hoặc null nếu bị bác.
   */
  hit(attacker, target, key, claimedDamage, now) {
    const spec = WEAPONS[key];
    if (!spec) { this.flag(now, 3, "súng lạ"); return null; }
    const bucket = (this.fire[key] ||= new Bucket(1 / spec.fireInterval * 1.3, 3, now));   // 3: một phát có thể trúng vài mục tiêu hoặc vài viên đạn
    if (!bucket.take(now)) { this.flag(now, 1.5, "bắn nhanh hơn súng cho phép"); return null; }

    const shape = target.shape || HUMAN_SHAPE, eye = [attacker.x, attacker.y + config.EYE_HEIGHT, attacker.z];
    const body = [target.x, target.y + shape.h / 2, target.z];
    const to = [body[0] - eye[0], body[1] - eye[1], body[2] - eye[2]], dist = Math.hypot(...to) || 1e-6;
    const dir = viewBasis(attacker.yaw, attacker.pitch).forward;

    if (spec.melee) {
      const flat = Math.hypot(to[0], to[2]), bearing = Math.atan2(to[0], to[2]) / RAD;
      const off = Math.abs((((bearing - attacker.yaw + 180) % 360) + 360) % 360 - 180);
      if (flat > spec.range + shape.r + LIMITS.lagReach || Math.abs(target.y - attacker.y) > 2.2 || off > spec.arc / 2 + 25) {
        this.flag(now, 1.5, "đánh cận chiến ngoài tầm"); return null;
      }
      return { damage: spec.damage, head: false };
    }

    if (dist > spec.range + shape.r + LIMITS.lagReach) { this.flag(now, 1.5, "bắn quá tầm"); return null; }
    // khoảng cách từ tâm mục tiêu tới tia nhìn (chỉ tính phía trước)
    const along = to[0] * dir[0] + to[1] * dir[1] + to[2] * dir[2];
    const perp = Math.sqrt(Math.max(0, dist * dist - along * along));
    const reach = shape.r + LIMITS.lagReach * 0.5 + dist * (LIMITS.aimSlack + spec.spread * 0.02);
    if (along < 0 || perp > reach + shape.h * 0.5) { this.flag(now, 1.5, "bắn không nhìn vào mục tiêu"); return null; }
    // xuyên tường? bắn một tia từ mắt tới ngực và tới đầu, chỉ cần một trong hai thông là được
    const free = (point) => {
      const d = [point[0] - eye[0], point[1] - eye[1], point[2] - eye[2]], len = Math.hypot(...d) || 1e-6;
      return castRay(eye, d.map((v) => v / len), len, this.solids, []).dist >= len - 0.6;
    };
    if (!free(body) && !free([target.x, target.y + shape.headY, target.z])) { this.flag(now, 1.5, "bắn xuyên vật cản"); return null; }

    const head = this._headOk(eye, dir, target, shape, dist);
    const hits = Math.max(1, Math.min(spec.pellets, Math.round((Number(claimedDamage) || spec.damage) / spec.damage)));
    return { damage: spec.damage * hits, head };
  }

  /** Trúng đầu hay không do máy chủ xét: tia nhìn phải đi sát tâm đầu. */
  _headOk(eye, dir, target, shape, dist) {
    const c = [target.x - eye[0], target.y + shape.headY - eye[1], target.z - eye[2]];
    const along = c[0] * dir[0] + c[1] * dir[1] + c[2] * dir[2];
    if (along <= 0) return false;
    const d2 = c[0] * c[0] + c[1] * c[1] + c[2] * c[2], perp = Math.sqrt(Math.max(0, d2 - along * along));
    return perp <= shape.headR + 0.25 + dist * 0.04;
  }

  /** Ném vật: không được ném dồn dập. */
  canThrow(now) {
    if (now - this.throwT < LIMITS.throwEvery) { this.flag(now, 1, "ném dồn dập"); return false; }
    this.throwT = now;
    return true;
  }
}
