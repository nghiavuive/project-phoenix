// Đường đạn: tia bắn trúng cái gì trước - vật cản hay mục tiêu? Toán thuần, không dùng engine,
// nên bản web và (sau này) máy chủ phòng tính ra cùng một kết quả.
// Hệ trục giống bản Python: y hướng lên, yaw 0 nhìn về +z, yaw tăng thì quay sang phải.

const RAD = Math.PI / 180;

/** Ba vectơ hướng của góc nhìn: {forward, right, up}; pitch dương = cúi xuống. */
export function viewBasis(yawDeg, pitchDeg) {
  const y = yawDeg * RAD, p = pitchDeg * RAD;
  const sy = Math.sin(y), cy = Math.cos(y), sp = Math.sin(p), cp = Math.cos(p);
  return { forward: [sy * cp, -sp, cy * cp], right: [cy, 0, -sy], up: [sy * sp, cp, cy * sp] };
}

/** Các khối chắn đạn dựng từ bản đồ (khớp với hình vẽ trong game/world/structures.js). */
export function buildSolids(layout) {
  const solids = [];
  for (const p of layout.props || []) {
    if (p.kind === "tree") solids.push({ type: "cyl", x: p.x, z: p.z, r: 0.34 * p.scale, y0: 0, y1: 5.6 * p.scale });
    else if (p.kind === "rock") solids.push({ type: "cyl", x: p.x, z: p.z, r: 0.92 * p.scale, y0: 0, y1: 1.05 * p.scale });
    else if (p.kind === "tank") solids.push({ type: "cyl", x: p.x, z: p.z, r: p.scale, y0: 0, y1: p.scale * 2 });
    else if (p.kind === "crate") {                       // thùng gỗ lẻ: hộp xoay quanh trục đứng
      const h = p.scale / 2;
      solids.push({ type: "box", x: p.x, y: h, z: p.z, hx: h * 1.03, hy: h, hz: h * 1.03, rot: p.rotation * RAD });
    }
  }
  for (const [x, z] of layout.lamps || []) solids.push({ type: "cyl", x, z, r: 0.12, y0: 0, y1: 5.2 });
  const add = (x0, z0, x1, z1, y0, y1) => solids.push({ type: "box", x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2,
    hx: (x1 - x0) / 2, hy: (y1 - y0) / 2, hz: (z1 - z0) / 2, rot: 0 });
  for (const b of layout.blocks || []) {
    if (!b.ramp) { add(b.x0, b.z0, b.x1, b.z1, b.y0, b.y1); continue; }
    const N = 6, { axis, dir, low } = b.ramp;            // dốc: xấp xỉ bằng 6 bậc thang
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N, top = low + (b.y1 - low) * ((dir > 0 ? t0 : 1 - t1) + 0.5 / N);
      if (axis === "x") add(b.x0 + (b.x1 - b.x0) * t0, b.z0, b.x0 + (b.x1 - b.x0) * t1, b.z1, 0, top);
      else add(b.x0, b.z0 + (b.z1 - b.z0) * t0, b.x1, b.z0 + (b.z1 - b.z0) * t1, 0, top);
    }
  }
  return solids;
}

function rayCylinder(o, d, c, max) {                     // trụ đứng hữu hạn, có nắp trên
  const ox = o[0] - c.x, oz = o[2] - c.z;
  const a = d[0] * d[0] + d[2] * d[2];
  let best = Infinity;
  if (a > 1e-9) {
    const b = ox * d[0] + oz * d[2], disc = b * b - a * (ox * ox + oz * oz - c.r * c.r);
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / a;
      const y = o[1] + d[1] * t;
      if (t > 0 && t <= max && y >= c.y0 && y <= c.y1) best = t;
    }
  }
  if (d[1] < -1e-9) {                                    // bắn chúc xuống trúng mặt trên
    const t = (c.y1 - o[1]) / d[1];
    if (t > 0 && t <= max && t < best) {
      const px = ox + d[0] * t, pz = oz + d[2] * t;
      if (px * px + pz * pz <= c.r * c.r) best = t;
    }
  }
  return best;
}

function raySphere(o, d, cx, cy, cz, r, max) {
  const ox = o[0] - cx, oy = o[1] - cy, oz = o[2] - cz;
  const b = ox * d[0] + oy * d[1] + oz * d[2], disc = b * b - (ox * ox + oy * oy + oz * oz - r * r);
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t > 0 && t <= max ? t : Infinity;
}

function rayBox(o, d, box, max) {                        // đưa tia về hệ toạ độ của hộp rồi cắt 3 cặp mặt
  const s = Math.sin(box.rot), c = Math.cos(box.rot);
  const rx = o[0] - box.x, rz = o[2] - box.z;
  const lo = [c * rx - s * rz, o[1] - box.y, s * rx + c * rz];
  const ld = [c * d[0] - s * d[2], d[1], s * d[0] + c * d[2]];
  const half = [box.hx, box.hy, box.hz];
  let t0 = 0, t1 = max;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(ld[i]) < 1e-9) {
      if (Math.abs(lo[i]) > half[i]) return Infinity;
      continue;
    }
    let a = (-half[i] - lo[i]) / ld[i], b = (half[i] - lo[i]) / ld[i];
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return Infinity;
  }
  return t0 > 0 ? t0 : Infinity;
}

/**
 * Bắn một tia từ `origin` theo hướng `dir` (đã chuẩn hoá), xa nhất `maxDist`.
 * targets: [{id, kind, x, y, z, shape: {r, h, headY, headR}}] - thân là trụ, đầu là cầu (trúng đầu = head: true).
 * Trả về {dist, point, target, head}; không trúng gì thì target = null và point là điểm cuối tầm bắn.
 */
export function castRay(origin, dir, maxDist, solids, targets) {
  let dist = maxDist, target = null, head = false;
  if (dir[1] < -1e-9) {                                  // mặt đất
    const t = -origin[1] / dir[1];
    if (t > 0 && t < dist) dist = t;
  }
  for (const s of solids) {
    const t = s.type === "box" ? rayBox(origin, dir, s, dist) : rayCylinder(origin, dir, s, dist);
    if (t < dist) dist = t;
  }
  const wall = dist;
  for (const g of targets) {
    const s = g.shape, base = g.y || 0;
    const tBody = rayCylinder(origin, dir, { x: g.x, z: g.z, r: s.r, y0: base, y1: base + s.h }, dist);
    const tHead = raySphere(origin, dir, g.x, base + s.headY, g.z, s.headR, dist);
    const t = Math.min(tBody, tHead);
    if (t < dist) { dist = t; target = g; head = tHead <= tBody; }
  }
  const point = [origin[0] + dir[0] * dist, origin[1] + dir[1] * dist, origin[2] + dir[2] * dist];
  return { dist, point, target, head, hitSomething: target !== null || wall < maxDist };
}
