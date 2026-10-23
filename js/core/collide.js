// Va chạm có độ cao: nhờ file này bản đồ có nhà, tầng lửng, dốc, nóc container thay vì một mặt phẳng.
//   Trụ  [x, z, bán kính, cao]            : cây, đá, cột đèn... chỉ chắn, không đứng lên được.
//   Khối {x0, z0, x1, z1, y0, y1, ramp?}  : hộp thẳng trục. Vừa là tường (chắn ngang) vừa là sàn (đứng lên mặt trên).
//        ramp = {axis: "x"|"z", dir: 1|-1, low}: mặt trên dốc từ `low` lên y1 theo trục đó.
// Quy tắc: bậc cao không quá STEP thì bước lên được; khối nằm cao hơn đầu thì chui qua bên dưới.
import { clamp } from "./geometry.js";

export const STEP = 0.6;       // bậc cao nhất bước lên được mà không cần nhảy
export const BODY = 1.8;       // chiều cao thân người

export class Collider {
  constructor(circles = [], blocks = [], decks = []) {
    this.circles = circles.map((c) => (c.length > 3 ? c : [c[0], c[1], c[2], 4]));
    this.blocks = blocks;
    this.decks = decks;          // các sàn cao: {id, top, areas: [[x0, z0, x1, z1]], path: [[x, z]]} - đường lên cho địch
  }

  /** Độ cao mặt trên của khối tại (x, z). */
  topAt(b, x, z) {
    if (!b.ramp) return b.y1;
    const t = b.ramp.axis === "x" ? (x - b.x0) / (b.x1 - b.x0) : (z - b.z0) / (b.z1 - b.z0);
    return b.ramp.low + (b.y1 - b.ramp.low) * clamp(b.ramp.dir > 0 ? t : 1 - t, 0, 1);
  }

  /** Mặt sàn cao nhất mà một người đang ở độ cao y đứng lên được tại (x, z). */
  ground(x, z, y) {
    let h = 0;
    for (const b of this.blocks) {
      if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
      const t = this.topAt(b, x, z);
      if (t <= y + STEP && t > h) h = t;
    }
    return h;
  }

  /** Mặt dưới thấp nhất của khối nằm ngay trên đầu (để nhảy không xuyên trần); không có thì Infinity. */
  ceiling(x, z, y) {
    let c = Infinity;
    for (const b of this.blocks) {
      if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
      if (b.y0 >= y + BODY - 0.05 && b.y0 < c) c = b.y0;
    }
    return c;
  }

  /** Đẩy hình tròn (x, z, r) ở độ cao chân y ra khỏi mọi vật chắn và giữ trong đấu trường. Trả về [x, z]. */
  resolve(x, z, r, y, arena) {
    for (const [ox, oz, orad, oh] of this.circles) {
      if (y >= oh) continue;
      const dx = x - ox, dz = z - oz, need = r + orad, d2 = dx * dx + dz * dz;
      if (d2 >= need * need) continue;
      const d = Math.sqrt(d2);
      if (d < 1e-6) { x = ox + need; continue; }
      x = ox + (dx / d) * need; z = oz + (dz / d) * need;
    }
    for (let pass = 0; pass < 2; pass++) {
      for (const b of this.blocks) {
        if (y + BODY <= b.y0 + 0.05) continue;                       // chui qua bên dưới
        const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1);
        if (y >= this.topAt(b, cx, cz) - STEP) continue;             // đủ cao để bước/đứng lên
        const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r; z = cz + (dz / d) * r;
        } else {                                                     // tâm nằm trong khối: đẩy ra theo cạnh gần nhất
          const exits = [[x - b.x0 + r, -1, 0], [b.x1 - x + r, 1, 0], [z - b.z0 + r, 0, -1], [b.z1 - z + r, 0, 1]];
          const [gap, sx, sz] = exits.reduce((a, c) => (c[0] < a[0] ? c : a));
          x += sx * gap; z += sz * gap;
        }
      }
    }
    if (arena) {
      const d = Math.hypot(x, z), limit = arena - r;
      if (d > limit) { x = (x / d) * limit; z = (z / d) * limit; }
    }
    return [x, z];
  }

  /** Điểm (x, y, z) có nằm trong vật rắn nào không (đạn của địch, lựu đạn). Trả về khối/trụ hoặc null. */
  inside(x, y, z) {
    for (const b of this.blocks) {
      if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1 || y < b.y0) continue;
      if (y <= this.topAt(b, x, z)) return b;
    }
    for (const c of this.circles) {
      if (y < c[3] && (x - c[0]) ** 2 + (z - c[1]) ** 2 < c[2] * c[2]) return c;
    }
    return null;
  }

  /** Chỗ (x, z) trên mặt đất có vướng gì trong phạm vi `pad` không (chọn chỗ thả người/địch/vật phẩm). */
  blockedAt(x, z, pad = 0) {
    for (const c of this.circles) if ((x - c[0]) ** 2 + (z - c[1]) ** 2 < (c[2] + pad) ** 2) return true;
    for (const b of this.blocks) {
      if (b.y0 >= BODY || b.y1 <= STEP || x < b.x0 - pad || x > b.x1 + pad || z < b.z0 - pad || z > b.z1 + pad) continue;   // khối thấp ≤ STEP (bậc thềm, bờ ruộng, cồn cát) đi lên được nên không chắn
      return true;
    }
    return false;
  }

  /** Đường nhìn thẳng từ a tới b ([x, y, z]) có bị che không. */
  sightBlocked(a, b) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    for (const k of this.blocks) {
      let t0 = 0, t1 = 1, hit = true;
      const lo = [k.x0, k.y0, k.z0], hi = [k.x1, k.y1, k.z1];
      for (let i = 0; i < 3 && hit; i++) {
        if (Math.abs(d[i]) < 1e-9) { hit = a[i] >= lo[i] && a[i] <= hi[i]; continue; }
        let u = (lo[i] - a[i]) / d[i], v = (hi[i] - a[i]) / d[i];
        if (u > v) [u, v] = [v, u];
        t0 = Math.max(t0, u); t1 = Math.min(t1, v);
        hit = t0 <= t1;
      }
      if (!hit) continue;
      if (!k.ramp) return true;
      const t = (t0 + t1) / 2;                                       // dốc: chỉ che nếu tia đi dưới mặt dốc
      if (a[1] + d[1] * t <= this.topAt(k, a[0] + d[0] * t, a[2] + d[2] * t)) return true;
    }
    const len2 = d[0] * d[0] + d[2] * d[2];
    if (len2 > 1e-9) {
      for (const c of this.circles) {
        const t = clamp(((c[0] - a[0]) * d[0] + (c[1] - a[2]) * d[2]) / len2, 0, 1);
        const px = a[0] + d[0] * t, pz = a[2] + d[2] * t;
        if ((px - c[0]) ** 2 + (pz - c[1]) ** 2 < c[2] * c[2] && a[1] + d[1] * t < c[3]) return true;
      }
    }
    return false;
  }

  /** Sàn cao mà một người ở (x, y, z) đang đứng trên; không thì null. */
  deckOf(x, y, z) {
    for (const d of this.decks) {
      if (y < d.top - 0.5 || y > d.top + 2.5) continue;
      for (const [x0, z0, x1, z1] of d.areas) if (x >= x0 - 0.3 && x <= x1 + 0.3 && z >= z0 - 0.3 && z <= z1 + 0.3) return d;
    }
    return null;
  }
}
