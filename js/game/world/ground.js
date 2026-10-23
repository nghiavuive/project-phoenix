// Mặt đất, đường và mảng màu trên đất, bụi cỏ.
import * as meshes from "../meshes.js";
import { Rng } from "../../core/rng.js";
import { Builder, C, T, boxTris, glowTexture, hexRgb, shadeOf } from "./common.js";

export const groundMethods = {
  /** Ô đất thuộc khu công trình / đường (rải sỏi, không mọc cỏ). */
  _isGravel(x, z) {
    return this.map.zones.some((q) => x > q.x0 - 1.5 && x < q.x1 + 1.5 && z > q.z0 - 1.5 && z < q.z1 + 1.5)
      || this.map.dirt.some((q) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1);
  },

  // ---------- mặt đất: cỏ ngoài rừng, sỏi trong các khu công trình ----------
  _ground(rng) {
    const b = new Builder(), size = 280, cells = 70, step = size / cells, grass = hexRgb(this.theme.grass), dirt = hexRgb(this.theme.gravel), light = [0.98, 0.93, 0.80];
    const gravel = (x, z) => this._isGravel(x, z);
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < cells; j++) {
        const x0 = -size / 2 + i * step, z0 = -size / 2 + j * step;
        const p = [[x0, 0, z0], [x0 + step, 0, z0], [x0 + step, 0, z0 + step], [x0, 0, z0 + step]];
        for (const tri of [[p[0], p[1], p[2]], [p[0], p[2], p[3]]]) {
          const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cz = (tri[0][2] + tri[1][2] + tri[2][2]) / 3;
          const base = gravel(cx, cz) ? dirt : grass, k = rng.uniform(0.9, 1.06);
          b.raw(tri, [base[0] * k * light[0], base[1] * k * light[1], base[2] * k * light[2]]);
        }
      }
    }
    this._mesh(b.geometry(), meshes.SHARED, 0, { receive: true });
  },

  // ---------- đường, vạch kẻ, các mảng màu trên đất (nền nhà kho, ao, ruộng, mặt hồ...) ----------
  _decals(rng) {
    const b = new Builder();
    const quad = (x0, z0, x1, z1, rgb, y = 0.02) => { const p = [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
      b.raw([p[0], p[1], p[2]], rgb); b.raw([p[0], p[2], p[3]], rgb); };
    for (const r of this.map.roads) {
      const alongX = r.x1 - r.x0 > r.z1 - r.z0, len = alongX ? r.x1 - r.x0 : r.z1 - r.z0, road = hexRgb(r.color || this.theme.asphalt);
      for (let s = 0; s < len; s += 4) {                                  // từng tấm đậm nhạt khác nhau
        const k = rng.uniform(0.9, 1.08), rgb = shadeOf(road, k);
        if (alongX) quad(r.x0 + s, r.z0, Math.min(r.x1, r.x0 + s + 4), r.z1, rgb); else quad(r.x0, r.z0 + s, r.x1, Math.min(r.z1, r.z0 + s + 4), rgb);
      }
      if (r.dash === false) continue;
      for (let s = 5; s < len - 5; s += 5) {                              // vạch đứt giữa đường, bỏ đoạn ngã tư
        const at = (alongX ? r.x0 : r.z0) + s;
        if (Math.abs(at) < 6) continue;
        if (alongX) quad(at, -0.12, at + 2.2, 0.12, C.paint, 0.035); else quad(-0.12, at, 0.12, at + 2.2, C.paint, 0.035);
      }
    }
    if (this.map.crosswalk) for (let i = -3; i <= 3; i++) {               // vạch sang đường quanh ngã tư
      quad(i * 0.85 - 0.25, 4.2, i * 0.85 + 0.25, 6.0, C.paint, 0.035); quad(i * 0.85 - 0.25, -6.0, i * 0.85 + 0.25, -4.2, C.paint, 0.035);
      quad(4.2, i * 0.85 - 0.25, 6.0, i * 0.85 + 0.25, C.paint, 0.035); quad(-6.0, i * 0.85 - 0.25, -4.2, i * 0.85 + 0.25, C.paint, 0.035);
    }
    for (const q of this.map.patches) {                                   // mảng màu: hình chữ nhật hoặc hình tròn (disc: [x, z, bán kính])
      const rgb = shadeOf(hexRgb(q.color), q.k || 1), y = q.y ?? 0.02;
      if (q.disc) {
        const [cx, cz, r] = q.disc, N = 22;
        for (let i = 0; i < N; i++) {
          const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
          b.raw([[cx, y, cz], [cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r], [cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r]], rgb);
        }
      } else quad(q.x0, q.z0, q.x1, q.z1, rgb, y);
    }
    this._mesh(b.geometry(), meshes.decal(), 1, { receive: true });
  },

  // ---------- bụi cỏ: vài nghìn khóm lá nhọn rải trên bãi cỏ, vẽ một lần bằng InstancedMesh ----------
  _grass(rng) {
    const b = new Builder(), greens = this.theme.grassBlades.map(hexRgb);
    for (let i = 0; i < 5; i++) {                                         // một khóm = 5 lá chĩa ra các hướng
      const a = (i / 5) * Math.PI * 2 + rng.uniform(-0.3, 0.3), r = rng.uniform(0.04, 0.14);
      b.add(meshes.coneTris(0.05, rng.uniform(0.32, 0.55), 3, [Math.cos(a) * r, 0, Math.sin(a) * r], rng.uniform(0, 2)), greens[i % greens.length]);
    }
    const geo = b.geometry(), COUNT = 3200;
    const mesh = new T.InstancedMesh(geo, meshes.paint(), COUNT);
    const m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), p = new T.Vector3(), up = new T.Vector3(0, 1, 0);
    const blocked = (x, z) => this._isGravel(x, z) || this.map.roads.some((r) => x > r.x0 - 1 && x < r.x1 + 1 && z > r.z0 - 1 && z < r.z1 + 1)
      || this.map.blocks.some((k) => x > k.x0 - 0.3 && x < k.x1 + 0.3 && z > k.z0 - 0.3 && z < k.z1 + 0.3);
    let n = 0;
    for (let tries = 0; n < COUNT && tries < COUNT * 6; tries++) {
      const angle = rng.uniform(0, Math.PI * 2), dist = 12 + Math.sqrt(rng.uniform(0, 1)) * 100;   // dày ở gần, thưa dần ra xa
      const x = Math.cos(angle) * dist, z = Math.sin(angle) * dist;
      if (blocked(x, z)) continue;
      const k = rng.uniform(0.7, 1.5);
      m.compose(p.set(x, 0, z), q.setFromAxisAngle(up, rng.uniform(0, Math.PI * 2)), s.set(k, k * rng.uniform(0.8, 1.3), k));
      mesh.setMatrixAt(n++, m);
    }
    mesh.count = n;
    mesh.receiveShadow = true;                                            // cỏ nằm trong bóng cây, bóng nhà thì tối đi
    mesh.frustumCulled = false;
    this.root.add(mesh);
  },
};
