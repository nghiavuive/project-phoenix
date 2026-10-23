// Tạo lưới low-poly bằng code (bản JS của phoenix/game/meshes.py). Hai mức đồ hoạ:
//  - "thap": bóng được "nướng" sẵn vào màu đỉnh theo hướng nắng, không cần đèn -> rất nhẹ, hợp điện thoại.
//  - "cao" : lưới giữ màu gốc + pháp tuyến; đèn thật (mặt trời có bản đồ bóng + trời) tính sáng tối lúc vẽ,
//            nên bóng đổ đúng: rơi lên tường, sàn, container, cả người và địch.
// Mức đồ hoạ chọn một lần lúc tải trang (đổi trong Cài đặt thì tải lại trang).
import { config } from "../config.js";
import * as storage from "../core/storage.js";

const T = window.THREE;
const TAU = Math.PI * 2;

function pickQuality() {
  const q = storage.load().graphics;
  if (q === "cao" || q === "thap") return q;
  try { return window.matchMedia("(pointer: coarse)").matches ? "thap" : "cao"; } catch { return "cao"; }
}
export const QUALITY = pickQuality();
export const LIT = QUALITY === "cao";

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// Hướng nắng và màu ánh sáng theo chủ đề của bản đồ đang dựng (đặt bằng setTheme trước khi dựng hình).
export let SUN = norm(config.SUN);
let WARM = config.SUN_WARM, COOL = config.SHADE_COOL;
export function setTheme(theme) { SUN = norm(theme.sun); WARM = theme.sunWarm; COOL = theme.shadeCool; }

/** Pháp tuyến hướng ra ngoài của một tam giác; đảo thứ tự đỉnh nếu cần để mặt trước luôn quay ra ngoài.
 *  center = tâm khối (hướng "ra ngoài" là rời xa tâm); null = mặt phẳng nằm ngửa (mặt đất, vạch sơn). */
function orient(tri, center) {
  const [a, b, c] = tri;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = norm([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
  let flip;
  if (center) {
    const mid = [0, 1, 2].map((i) => (a[i] + b[i] + c[i]) / 3 - center[i]);
    flip = n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2] < 0;
  } else flip = n[1] < 0;
  return flip ? [[a, c, b], [-n[0], -n[1], -n[2]]] : [tri, n];
}

export const hexRgb = (code) => [1, 3, 5].map((i) => parseInt(code.slice(i, i + 2), 16) / 255);

/** Màu ánh sáng rọi lên một mặt: nền lạnh + nắng ấm theo góc + chút hắt sáng từ trời lên mặt ngửa. */
function light(tri, center) {
  const [a, b, c] = tri;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let n = norm([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
  const mid = [0, 1, 2].map((i) => (a[i] + b[i] + c[i]) / 3 - center[i]);
  if (n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2] < 0) n = [-n[0], -n[1], -n[2]];   // pháp tuyến hướng ra ngoài
  const sun = Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]), sky = Math.max(0, n[1]) * 0.10;
  return [COOL[0] + WARM[0] * sun + sky, COOL[1] + WARM[1] * sun + sky, COOL[2] + WARM[2] * sun + sky];
}

/** Gom nhiều khối lồi thành một lưới duy nhất. */
export class Builder {
  constructor() { this.pos = []; this.col = []; this.nor = []; }
  /** dim < 1 làm tối cả khối (đồ trong nhà, chỗ khuất). */
  add(tris, rgb = [1, 1, 1], center = null, dim = 1) {
    if (!center) {
      const pts = tris.flat();
      center = [0, 1, 2].map((i) => pts.reduce((s, p) => s + p[i], 0) / pts.length);
    }
    for (const tri of tris) {
      if (LIT) {                                          // giữ màu gốc, đèn thật sẽ tô sáng tối
        const [t, n] = orient(tri, center);
        this._push(t, [rgb[0] * dim, rgb[1] * dim, rgb[2] * dim], n);
      } else {
        const l = light(tri, center);
        this.raw(tri, [Math.min(1, rgb[0] * l[0] * dim), Math.min(1, rgb[1] * l[1] * dim), Math.min(1, rgb[2] * l[2] * dim)]);
      }
    }
    return this;
  }
  /** Hộp theo hai góc đối. */
  box(x0, y0, z0, x1, y1, z1, rgb, dim = 1) {
    return this.add(boxTris(x1 - x0, y1 - y0, z1 - z0, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]), rgb, null, dim);
  }
  /** Tam giác đã có sẵn màu cuối cùng (mặt đất, vạch sơn): luôn là mặt nằm ngửa. */
  raw(tri, rgb) {
    if (LIT) { const [t, n] = orient(tri, null); this._push(t, rgb, n); return; }
    for (const p of tri) { this.pos.push(p[0], p[1], p[2]); this.col.push(rgb[0], rgb[1], rgb[2]); }
  }
  _push(tri, rgb, n) {
    for (const p of tri) { this.pos.push(p[0], p[1], p[2]); this.col.push(rgb[0], rgb[1], rgb[2]); this.nor.push(n[0], n[1], n[2]); }
  }
  geometry() {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(this.col, 3));
    if (LIT) g.setAttribute("normal", new T.Float32BufferAttribute(this.nor, 3));
    return g;
  }
}

// Mức "cao": vật liệu Lambert nhận đèn và bóng. Hai mặt (vì vài khối không kín) nhưng chỉ mặt sau
// được vẽ vào bản đồ bóng: tránh bóng tự đổ lốm đốm lên chính bề mặt (shadow acne).
const lambert = (opts) => new T.MeshLambertMaterial({ side: T.DoubleSide, shadowSide: T.BackSide, ...opts });
/** Vật liệu lấy màu đỉnh nhân với màu `tint` (để nháy trắng khi trúng đạn). */
export const paint = (tint = 0xffffff) => LIT ? lambert({ vertexColors: true, color: tint })
  : new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, color: tint });
export const flat = (tint, opacity = 1) => LIT ? lambert({ color: tint, transparent: opacity < 1, opacity })
  : new T.MeshBasicMaterial({ color: tint, side: T.DoubleSide, transparent: opacity < 1, opacity });
/** Đồ hoạ cao: phủ vân nhiễu theo toạ độ thế giới lên bề mặt (3 cỡ: mảng loang vài mét, vết bẩn, hạt sạn)
 *  cho đất, tường, mặt đường bớt phẳng lì như nhựa. Tính thẳng trong shader nên không cần ảnh vân. */
function withDetail(material, amount = 1) {
  if (!LIT) return material;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vDetailPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvDetailPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vDetailPos;
float dHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float dNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dHash(i), dHash(i + vec3(1, 0, 0)), f.x), mix(dHash(i + vec3(0, 1, 0)), dHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(dHash(i + vec3(0, 0, 1)), dHash(i + vec3(1, 0, 1)), f.x), mix(dHash(i + vec3(0, 1, 1)), dHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`)
      .replace("#include <color_fragment>", `#include <color_fragment>
float dn = dNoise(vDetailPos * 0.33) * 0.5 + dNoise(vDetailPos * 1.6) * 0.32 + dNoise(vDetailPos * 6.5) * 0.18;
diffuseColor.rgb *= 1.0 + (dn - 0.5) * ${(0.42 * amount).toFixed(3)};`);
  };
  material.customProgramCacheKey = () => `detail-${amount}`;   // mỗi mức vân một chương trình riêng
  return material;
}

/** Vạch sơn / nền dán sát mặt đất: đẩy lên trước một chút cho khỏi nhấp nháy với mặt đất. */
export const decal = () => {
  const opts = { vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
  // Hai mặt: ở đồ hoạ thấp các tam giác phẳng này quay xuống (do trục z bị lật) nên một mặt sẽ bị xén mất cả mặt đường lẫn vạch kẻ
  return LIT ? withDetail(new T.MeshLambertMaterial(opts), 0.8) : new T.MeshBasicMaterial({ ...opts, side: T.DoubleSide });
};
/** Vật liệu chung của bản đồ (đất, công trình, cây, đá). */
export const SHARED = withDetail(paint());

// ---------- các khối cơ bản (trả về danh sách tam giác) ----------
export function boxTris(w = 1, h = 1, d = 1, at = [0, 0, 0]) {
  const [x0, x1, y0, y1, z0, z1] = [at[0] - w / 2, at[0] + w / 2, at[1] - h / 2, at[1] + h / 2, at[2] - d / 2, at[2] + d / 2];
  const p = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const quads = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
  return quads.flatMap(([a, b, c, d2]) => [[p[a], p[b], p[c]], [p[a], p[c], p[d2]]]);
}

export function coneTris(radius = 1, height = 2, sides = 6, at = [0, 0, 0], twist = 0) {
  const tip = [at[0], at[1] + height, at[2]];
  const ring = Array.from({ length: sides }, (_, i) => [at[0] + Math.cos(twist + (i * TAU) / sides) * radius, at[1],
    at[2] + Math.sin(twist + (i * TAU) / sides) * radius]);
  const tris = ring.map((p, i) => [p, ring[(i + 1) % sides], tip]);
  for (let i = 1; i < sides - 1; i++) tris.push([ring[0], ring[i], ring[i + 1]]);
  return tris;
}

const PHI = (1 + Math.sqrt(5)) / 2;
const ICO_V = [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI],
  [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]].map(norm);
const ICO_F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2],
  [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10],
  [8, 6, 7], [9, 8, 1]];

/** Khối 20 mặt; có rng thì méo ngẫu nhiên thành tảng đá. */
export function blobTris(radius = 1, rng = null, jitter = 0, squash = [1, 1, 1], at = [0, 0, 0]) {
  const verts = ICO_V.map((v) => {
    const k = radius * (1 + (rng ? rng.uniform(-jitter, jitter) : 0));
    return [at[0] + v[0] * k * squash[0], at[1] + v[1] * k * squash[1], at[2] + v[2] * k * squash[2]];
  });
  return ICO_F.map(([a, b, c]) => [verts[a], verts[b], verts[c]]);
}

// ---------- vật thể hoàn chỉnh ----------
const DEFAULT_TREES = ["#2f8f4a", "#3aa35a", "#257a52", "#4aa845"];
export function treeGeometry(rng, b = new Builder(), colors = DEFAULT_TREES) {
  const trunkH = rng.uniform(2.4, 3.0);            // tán cây cao quá đầu người để không che mắt
  b.add(boxTris(0.45, trunkH, 0.45, [0, trunkH / 2, 0]), hexRgb("#6b4a2f"));
  const green = hexRgb(rng.choice(colors));
  let y = trunkH * 0.9, r = rng.uniform(1.5, 2.1);
  for (let i = 0; i < 3; i++) {
    const h = r * 1.25;
    b.add(coneTris(r, h, 6, [0, y, 0], rng.uniform(0, 1)), green);
    y += h * 0.5; r *= 0.72;
  }
  return b.geometry();
}

/** Cây tán tròn (làng quê): thân cao, tán là ba khối cầu méo chụm lại. */
export function roundTreeGeometry(rng, colors) {
  const b = new Builder(), trunkH = rng.uniform(2.6, 3.2), green = hexRgb(rng.choice(colors));
  b.add(boxTris(0.5, trunkH, 0.5, [0, trunkH / 2, 0]), hexRgb("#6e4d30"));
  b.add(blobTris(1.9, rng, 0.14, [1, 0.85, 1], [0, trunkH + 0.9, 0]), green, [0, trunkH + 0.9, 0]);
  b.add(blobTris(1.3, rng, 0.14, [1, 0.85, 1], [0.9, trunkH + 0.4, 0.5]), shadeRgb(green, 0.92), [0.9, trunkH + 0.4, 0.5]);
  b.add(blobTris(1.2, rng, 0.14, [1, 0.85, 1], [-0.8, trunkH + 0.5, -0.6]), shadeRgb(green, 1.06), [-0.8, trunkH + 0.5, -0.6]);
  return b.geometry();
}

/** Cây khô trơ cành (sa mạc). */
export function deadTreeGeometry(rng, colors) {
  const b = new Builder(), col = hexRgb(rng.choice(colors)), h = rng.uniform(2.2, 3.2);
  b.add(boxTris(0.32, h, 0.32, [0, h / 2, 0]), col);
  for (let i = 0; i < 3; i++) {
    const y = h * (0.45 + i * 0.18), a = rng.uniform(0, TAU), len = rng.uniform(0.7, 1.3);
    b.add(boxTris(len, 0.16, 0.16, [Math.cos(a) * len * 0.45, y, Math.sin(a) * len * 0.45]), shadeRgb(col, 0.92));
  }
  return b.geometry();
}

/** Xương rồng: thân trụ xanh, hai nhánh uốn lên. */
export function cactusGeometry(rng) {
  const b = new Builder(), green = hexRgb(rng.choice(["#5f9a4c", "#6aa856", "#548a44"])), h = rng.uniform(2.2, 3.0);
  b.add(cylTris(0.3, h, 7, [0, 0, 0], 0.26), green);
  for (const [dx, y, up] of [[-0.55, h * 0.55, 0.85], [0.5, h * 0.4, 0.7]]) {
    b.add(boxTris(Math.abs(dx) + 0.25, 0.24, 0.24, [dx / 2, y, 0]), shadeRgb(green, 0.95));
    b.add(boxTris(0.24, up, 0.24, [dx, y + up / 2 - 0.1, 0]), shadeRgb(green, 1.05));
  }
  return b.geometry();
}

const shadeRgb = (rgb, k) => rgb.map((v) => Math.min(1, v * k));

export function rockGeometry(rng, tint = null) {
  const grey = rng.uniform(0.50, 0.68), t = tint || [grey, grey * 0.98, grey * 0.94];
  const k = tint ? rng.uniform(0.85, 1.1) : 1;
  const tris = blobTris(1, rng, 0.22, [1, rng.uniform(0.6, 0.9), 1]);
  return new Builder().add(tris, [t[0] * k, t[1] * k, t[2] * k], [0, 0, 0]).geometry();
}

export function crateGeometry() {
  return new Builder().add(boxTris(1, 1, 1), hexRgb("#b98545"))
    .add(boxTris(1.06, 0.14, 1.06, [0, 0.36, 0]), hexRgb("#8a5f2c"))
    .add(boxTris(1.06, 0.14, 1.06, [0, -0.36, 0]), hexRgb("#8a5f2c")).geometry();
}

export function mountainGeometry(rng, colors = ["#6f8a8f", "#7b8f7a", "#64808c"], snowCaps = true, shape = "cone") {
  const b = new Builder(), twist = rng.uniform(0, 1), col = hexRgb(rng.choice(colors));
  if (shape === "mesa") {                           // núi mặt bàn (sa mạc): thân thoai thoải, đỉnh phẳng, vài bậc đá
    b.add(cylTris(1, 0.62, 7, [0, 0, 0], 0.72), col, [0, 0.3, 0]);
    b.add(cylTris(0.72, 0.38, 7, [0, 0.62, 0], 0.6), shadeRgb(col, 1.08), [0, 0.8, 0]);
    return b.geometry();
  }
  b.add(coneTris(1, 1, 7, [0, 0, 0], twist), col, [0, 0.3, 0]);
  if (snowCaps) b.add(coneTris(0.37, 0.35, 7, [0, 0.662, 0], twist).slice(0, 7), [0.97, 0.98, 1.0], [0, 0.3, 0]);   // chóp tuyết
  return b.geometry();
}

/** Mặt đất ghép từ nhiều tam giác xanh đậm nhạt khác nhau. */
export function groundGeometry(size, cells, rng) {
  const b = new Builder(), step = size / cells, base = hexRgb("#5aa64a");
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const x0 = -size / 2 + i * step, z0 = -size / 2 + j * step;
      const p = [[x0, 0, z0], [x0 + step, 0, z0], [x0 + step, 0, z0 + step], [x0, 0, z0 + step]];
      for (const tri of [[p[0], p[1], p[2]], [p[0], p[2], p[3]]]) {
        const k = rng.uniform(0.86, 1.06);
        b.raw(tri, [base[0] * k, base[1] * k, base[2] * k]);
      }
    }
  }
  return b.geometry();
}

/** Thân người khối hộp (chân, thân, tay) màu xám để nhân với màu của từng loại địch. */
export function bodyGeometry() {
  return new Builder()
    .add(boxTris(0.34, 0.75, 0.36, [-0.2, 0.375, 0]), [0.55, 0.55, 0.6])
    .add(boxTris(0.34, 0.75, 0.36, [0.2, 0.375, 0]), [0.55, 0.55, 0.6])
    .add(boxTris(0.85, 0.8, 0.5, [0, 1.15, 0]))
    .add(boxTris(0.24, 0.7, 0.26, [-0.56, 1.15, 0.05]), [0.8, 0.8, 0.8])
    .add(boxTris(0.24, 0.7, 0.26, [0.56, 1.15, 0.05]), [0.8, 0.8, 0.8]).geometry();
}

export const blobGeometry = () => new Builder().add(blobTris(0.5), [1, 1, 1], [0, 0, 0]).geometry();

export function gemGeometry() {
  const top = [0, 0.6, 0], bottom = [0, -0.6, 0];
  const ring = [0, 1, 2, 3].map((i) => [Math.cos((i * TAU) / 4) * 0.42, 0, Math.sin((i * TAU) / 4) * 0.42]);
  const tris = ring.flatMap((p, i) => [[p, ring[(i + 1) % 4], top], [p, ring[(i + 1) % 4], bottom]]);
  return new Builder().add(tris, [1, 1, 1], [0, 0, 0]).geometry();
}

export const UNIT_BOX = new T.BoxGeometry(1, 1, 1);

/** Lăng trụ tròn (trụ nhiều cạnh) đứng thẳng, đáy ở `at`. */
export function cylTris(radius, height, sides = 10, at = [0, 0, 0], topRadius = radius) {
  const ring = (r, y) => Array.from({ length: sides }, (_, i) => [at[0] + Math.cos((i * TAU) / sides) * r, y, at[2] + Math.sin((i * TAU) / sides) * r]);
  const lo = ring(radius, at[1]), hi = ring(topRadius, at[1] + height), tris = [];
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    tris.push([lo[i], lo[j], hi[j]], [lo[i], hi[j], hi[i]]);
    if (i > 0 && i < sides - 1) tris.push([hi[0], hi[i], hi[i + 1]], [lo[0], lo[i], lo[i + 1]]);
  }
  return tris;
}

/** Khối dốc (nêm): mặt trên đi từ `low` lên `high` theo trục axis, dir = 1 là cao dần về phía toạ độ lớn. */
export function wedgeTris(x0, z0, x1, z1, low, high, axis, dir) {
  const h = (x, z) => { const t = axis === "x" ? (x - x0) / (x1 - x0) : (z - z0) / (z1 - z0); return low + (high - low) * (dir > 0 ? t : 1 - t); };
  const b = [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], t = b.map(([x, , z]) => [x, Math.max(0.02, h(x, z)), z]);
  const tris = [[t[0], t[1], t[2]], [t[0], t[2], t[3]], [b[0], b[1], b[2]], [b[0], b[2], b[3]]];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; tris.push([b[i], b[j], t[j]], [b[i], t[j], t[i]]); }
  return tris;
}

/** Bao lồi 2D (thuật toán chuỗi đơn điệu) - dùng để vẽ bóng đổ. */
export function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => { const h = []; for (const q of list) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); } h.pop(); return h; };
  return [...half(p), ...half(p.reverse())];
}
