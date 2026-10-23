// Bộ dụng cụ dựng bản đồ: mỗi lệnh thêm khối vào danh sách và trả về khối vừa thêm.
import { Rng } from "../rng.js";

/** Bộ dụng cụ dựng bản đồ: mỗi lệnh thêm khối vào danh sách và trả về khối vừa thêm. */
export function kit() {
  const k = { blocks: [], decks: [], lamps: [], circles: [], props: [], zones: [], patches: [], lights: [], dirt: [], roads: [] };
  const box = (kind, x0, z0, x1, z1, y0, y1, extra = {}) => {
    const b = { kind, x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), y0, y1, ...extra };
    k.blocks.push(b);
    return b;
  };
  const ramp = (x0, z0, x1, z1, y1, axis, dir, low = 0, extra = {}) => box("ramp", x0, z0, x1, z1, 0, y1, { ramp: { axis, dir, low }, ...extra });
  const crate = (x, z, n = 1, tint = null) => box("crate", x - 0.65, z - 0.65, x + 0.65, z + 0.65, 0, 1.3 * n, tint ? { tint } : {});
  const barrier = (x, z, along, tint = null) => (along === "x"
    ? box("barrier", x - 1.5, z - 0.3, x + 1.5, z + 0.3, 0, 1.0, tint ? { tint } : {})
    : box("barrier", x - 0.3, z - 1.5, x + 0.3, z + 1.5, 0, 1.0, tint ? { tint } : {}));
  const post = (x, z, y0, y1, w = 0.4, tint = null) => box("post", x - w / 2, z - w / 2, x + w / 2, z + w / 2, y0, y1, tint ? { tint } : {});
  const lamp = (x, z) => { k.lamps.push([x, z]); k.circles.push([x, z, 0.16, 5.2]); };
  const zone = (name, x0, z0, x1, z1) => k.zones.push({ name, x0, z0, x1, z1 });

  /** Tường chạy dọc theo trục dài của hình chữ nhật, có các lỗ: holes = [{at, w, y0, y1}] (at: toạ độ giữa lỗ dọc theo tường). */
  const wall = (kindName, x0, z0, x1, z1, h, holes = [], extra = {}, y0 = 0) => {
    const alongX = x1 - x0 >= z1 - z0, a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1;
    const seg = (u0, u1, v0, v1) => {
      if (u1 - u0 < 0.02 || v1 - v0 < 0.02) return;
      if (alongX) box(kindName, u0, z0, u1, z1, v0, v1, extra); else box(kindName, x0, u0, x1, u1, v0, v1, extra);
    };
    let cur = a0;
    for (const o of holes.map((q) => ({ a: q.at - q.w / 2, b: q.at + q.w / 2, y0: q.y0 ?? 0, y1: q.y1 ?? 2.2 })).sort((p, q) => p.a - q.a)) {
      seg(cur, o.a, y0, h);
      if (o.y0 > y0) seg(o.a, o.b, y0, o.y0);
      if (o.y1 < h) seg(o.a, o.b, o.y1, h);
      cur = o.b;
    }
    seg(cur, a1, y0, h);
  };

  /** Mái nhiều bậc (3 tầng thu hẹp dần) trông như mái ngói/mái lều; nằm cao hơn đầu người nên đi lọt bên dưới. */
  const stepRoof = (x0, z0, x1, z1, y, tint, over = 0.5) => {
    const alongX = x1 - x0 >= z1 - z0, span = alongX ? z1 - z0 : x1 - x0;
    let yy = y;
    for (const [inset, th] of [[0, 0.25], [span * 0.26, 0.3], [span * 0.4, 0.3]]) {
      if (alongX) box("roof", x0 - over, z0 - over + inset, x1 + over, z1 + over - inset, yy, yy + th, { tint });
      else box("roof", x0 - over + inset, z0 - over, x1 + over - inset, z1 + over, yy, yy + th, { tint });
      yy += th;
    }
  };

  /** Nhà có cửa và cửa sổ. door: hướng cửa chính ("n" = phía z lớn, "s" = z nhỏ, "e" = x lớn, "w" = x nhỏ). */
  const house = (x0, z0, x1, z1, { door = "s", h = 2.8, tint = "#d9cdb4", roof = "#9a4b34", windows = true } = {}) => {
    const t = 0.3, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const holes = (side, mid) => (door === side ? [{ at: mid, w: 2.4, y0: 0, y1: 2.3 }]   // cửa phải rộng ≥ 2 m thì bộ tìm đường mới có ô đi qua được
       : windows ? [{ at: mid, w: 1.3, y0: 0.95, y1: 2.0 }] : []);
    wall("wall", x0, z0, x1, z0 + t, h, holes("s", cx), { tint });
    wall("wall", x0, z1 - t, x1, z1, h, holes("n", cx), { tint });
    wall("wall", x0, z0 + t, x0 + t, z1 - t, h, holes("w", cz), { tint });
    wall("wall", x1 - t, z0 + t, x1, z1 - t, h, holes("e", cz), { tint });
    stepRoof(x0, z0, x1, z1, h, roof);
  };

  /** Bậc thang gồm các bậc cao không quá 0.5 m (bước lên được không cần nhảy). */
  const stairs = (x0, z0, x1, z1, axis, dir, steps, top, tint = null) => {
    for (let i = 0; i < steps; i++) {
      const a = i / steps, b = (i + 1) / steps, h = (top * (i + 1)) / steps;
      const lo = dir > 0 ? a : 1 - b, hi = dir > 0 ? b : 1 - a;
      if (axis === "x") box("slab", x0 + (x1 - x0) * lo, z0, x0 + (x1 - x0) * hi, z1, 0, h, tint ? { tint } : {});
      else box("slab", x0, z0 + (z1 - z0) * lo, x1, z0 + (z1 - z0) * hi, 0, h, tint ? { tint } : {});
    }
  };

  const truck = (x, z, alongX = true, cab = "#b53b2d") => {
    // alongX: đầu xe hướng về x nhỏ (giống xe bản gốc)
    if (alongX) {
      box("truck", x, z - 1.3, x + 2.6, z + 1.3, 0, 2.7, { part: "cab", tint: cab });
      box("truck", x + 2.9, z - 1.5, x + 10.6, z + 1.5, 0.95, 3.5, { part: "trailer" });
      box("truck", x + 3.6, z - 1.3, x + 5, z + 1.3, 0, 0.95, { part: "wheels" });
      box("truck", x + 8, z - 1.3, x + 10, z + 1.3, 0, 0.95, { part: "wheels" });
    } else {
      box("truck", x - 1.3, z, x + 1.3, z + 2.6, 0, 2.7, { part: "cab", tint: cab });
      box("truck", x - 1.5, z + 2.9, x + 1.5, z + 10.6, 0.95, 3.5, { part: "trailer" });
      box("truck", x - 1.3, z + 3.6, x + 1.3, z + 5, 0, 0.95, { part: "wheels" });
      box("truck", x - 1.3, z + 8, x + 1.3, z + 10, 0, 0.95, { part: "wheels" });
    }
  };

  /** Rải cây/đá/xương rồng ngẫu nhiên (cùng seed thì ra cùng bản đồ trên mọi máy). */
  const scatter = (rng, { count, kind, avoid = [], inner = 8, outer = 46, gap = 2.2, scale = [0.9, 1.5], radius = 0.45, height = 9 }) => {
    const clear = (x, z, pad) => !avoid.some((q) => x > q.x0 - pad && x < q.x1 + pad && z > q.z0 - pad && z < q.z1 + pad);
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 40; tries++) {
      const ang = rng.uniform(0, Math.PI * 2), dist = rng.uniform(inner, outer), x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      const s = rng.uniform(scale[0], scale[1]), r = radius * s;
      if (!clear(x, z, 1.6 + r)) continue;
      if (k.props.some((p) => Math.hypot(p.x - x, p.z - z) < gap + r)) continue;
      if (k.circles.some((c) => Math.hypot(c[0] - x, c[1] - z) < c[2] + r + 0.8)) continue;
      k.props.push({ kind, x, z, scale: s, rotation: rng.uniform(0, 360), look: Math.floor(rng.uniform(0, 2 ** 31)) });
      k.circles.push([x, z, r, height]);
      placed++;
    }
  };
  const rect = (x0, z0, x1, z1) => ({ x0, z0, x1, z1 });

  return Object.assign(k, { box, ramp, crate, barrier, post, lamp, zone, wall, stepRoof, house, stairs, truck, scatter, rect });
}

export const finish = (k, id, name, extra) => ({
  id, name, blocks: k.blocks, decks: k.decks, lamps: k.lamps, circles: k.circles, props: k.props, zones: k.zones,
  patches: k.patches, lights: k.lights, dirt: k.dirt, roads: k.roads, obstacles: k.circles, ...extra,
});
