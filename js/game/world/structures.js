// Công trình, cây đá, đèn đường, và bóng vẽ sẵn (đồ hoạ thấp).
import * as meshes from "../meshes.js";
import { Rng } from "../../core/rng.js";
import { Builder, C, T, boxTris, glowTexture, hexRgb, shadeOf } from "./common.js";

export const structureMethods = {
  // ---------- công trình: mỗi loại khối một kiểu dáng ----------
  _structures(rng) {
    const b = new Builder();
    for (const k of this.map.blocks) {
      const dim = k.indoor ? 0.72 : 1, { x0, z0, x1, z1, y0, y1 } = k, lenX = x1 - x0, lenZ = z1 - z0;
      const tint = k.tint ? hexRgb(k.tint) : null;                          // bản đồ nào cũng có thể đổi màu từng khối
      if (k.kind === "wall") {                                            // tôn thép chia tấm, chân tường sẫm
        const alongX = lenX >= lenZ, len = alongX ? lenX : lenZ, n = Math.max(1, Math.round(len / 1.3));
        for (let i = 0; i < n; i++) {
          const a = i / n, c = (i + 1) / n, rgb = shadeOf(tint ? shadeOf(tint, i % 2 ? 1 : 0.93) : i % 2 ? C.steel : C.steelDark, rng.uniform(0.95, 1.05));
          if (alongX) b.box(x0 + lenX * a, y0, z0, x0 + lenX * c, y1, z1, rgb); else b.box(x0, y0, z0 + lenZ * a, x1, y1, z0 + lenZ * c, rgb);
        }
        if (y0 === 0) b.box(x0 - 0.03, 0, z0 - 0.03, x1 + 0.03, 0.5, z1 + 0.03, tint ? shadeOf(tint, 0.7) : C.base);
      } else if (k.kind === "container") {
        const rgb = hexRgb(k.tint), alongX = lenX >= lenZ, len = alongX ? lenX : lenZ;
        b.box(x0, y0, z0, x1, y1, z1, rgb);
        for (let s = 0.3; s < len - 0.1; s += 0.6) {                      // gân tôn
          const dark = shadeOf(rgb, 0.82);
          if (alongX) b.box(x0 + s, y0 + 0.12, z0 - 0.035, x0 + s + 0.18, y1 - 0.12, z1 + 0.035, dark);
          else b.box(x0 - 0.035, y0 + 0.12, z0 + s, x1 + 0.035, y1 - 0.12, z0 + s + 0.18, dark);
        }
        const frame = shadeOf(rgb, 0.6);                                  // khung thép hai đầu
        if (alongX) { b.box(x0 - 0.04, y0, z0 - 0.04, x0 + 0.12, y1, z1 + 0.04, frame); b.box(x1 - 0.12, y0, z0 - 0.04, x1 + 0.04, y1, z1 + 0.04, frame); }
        else { b.box(x0 - 0.04, y0, z0 - 0.04, x1 + 0.04, y1, z0 + 0.12, frame); b.box(x0 - 0.04, y0, z1 - 0.12, x1 + 0.04, y1, z1 + 0.04, frame); }
      } else if (k.kind === "crate") {
        const n = Math.max(1, Math.round((y1 - y0) / 1.3)), step = (y1 - y0) / n, wood = tint || C.wood, woodDark = tint ? shadeOf(tint, 0.72) : C.woodDark;
        for (let i = 0; i < n; i++) {
          const a = y0 + i * step, j = i ? 0.06 : 0, u = step / 1.3;
          b.box(x0 + j, a, z0 + j, x1 - j, a + step, z1 - j, wood, dim);
          b.box(x0 + j - 0.03, a + 0.95 * u, z0 + j - 0.03, x1 - j + 0.03, a + 1.13 * u, z1 - j + 0.03, woodDark, dim);
          b.box(x0 + j - 0.03, a + 0.17 * u, z0 + j - 0.03, x1 - j + 0.03, a + 0.35 * u, z1 - j + 0.03, woodDark, dim);
        }
      } else if (k.kind === "barrier") {                                  // rào bê tông có vạch cam
        const body = tint || C.concrete;                                  // có màu riêng (bao cát, hàng rào tuyết...) thì vạch cam đổi thành vạch sẫm
        b.box(x0, 0, z0, x1, 0.25, z1, shadeOf(body, 0.9));
        const ix = lenX > lenZ ? 0 : 0.1, iz = lenX > lenZ ? 0.1 : 0;
        b.box(x0 + ix, 0.25, z0 + iz, x1 - ix, y1, z1 - iz, body);
        b.box(x0 + ix - 0.01, 0.62, z0 + iz - 0.01, x1 - ix + 0.01, 0.8, z1 - iz + 0.01, tint ? shadeOf(tint, 0.78) : C.hazard);
      } else if (k.kind === "ramp") {
        b.add(meshes.wedgeTris(x0, z0, x1, z1, k.ramp.low, y1, k.ramp.axis, k.ramp.dir), tint || C.ramp, null, 1);
        const N = k.dune ? 0 : 9, alongX = k.ramp.axis === "x";          // gờ chống trượt (cồn cát / đống tuyết thì không có)
        for (let i = 1; i < N; i++) {
          const t = i / N, at = alongX ? x0 + lenX * t : z0 + lenZ * t, h = this.col.topAt(k, alongX ? at : x0, alongX ? z0 : at);
          if (alongX) b.box(at - 0.05, h, z0 + 0.1, at + 0.05, h + 0.05, z1 - 0.1, C.rail); else b.box(x0 + 0.1, h, at - 0.05, x1 - 0.1, h + 0.05, at + 0.05, C.rail);
        }
      } else if (k.kind === "truck") {
        if (k.part === "cab") {
          b.box(x0, 0.5, z0, x1, y1, z1, tint || C.cab);
          b.box(x0 - 0.02, 1.5, z0 + 0.15, x0 + 0.5, 2.35, z1 - 0.15, C.glass);
          b.box(x0 + 0.3, 0, z0 - 0.02, x0 + 1.3, 0.95, z1 + 0.02, C.tyre);
        } else if (k.part === "trailer") {
          b.box(x0, y0, z0, x1, y1, z1, C.trailer);
          b.box(x0, y0 - 0.12, z0 + 0.2, x1, y0, z1 - 0.2, C.post);
          b.box(x0 + 0.4, y0 + 0.5, z0 - 0.02, x1 - 0.4, y0 + 0.75, z1 + 0.02, C.band);
        } else b.box(x0, 0, z0 - 0.02, x1, y1, z1 + 0.02, C.tyre);
      } else {
        const rgb = tint || { slab: C.slab, rail: C.rail, roof: C.roof, beam: C.beam, plank: C.plank, post: C.post }[k.kind] || C.concrete;
        b.box(x0, y0, z0, x1, y1, z1, rgb, dim);
        if (k.kind === "slab") b.box(x0 - 0.02, y1 - 0.08, z0 - 0.02, x1 + 0.02, y1 + 0.005, z1 + 0.02, shadeOf(tint || C.slab, 1.1), dim);
      }
    }
    for (const p of this.map.props) {                                     // bồn chứa
      if (p.kind !== "tank") continue;
      b.add(meshes.cylTris(p.scale, p.scale * 2, 12, [p.x, 0, p.z]), C.tank);
      b.add(meshes.cylTris(p.scale * 1.02, 0.3, 12, [p.x, p.scale * 1.1, p.z]), C.band);
      b.add(meshes.cylTris(p.scale * 0.9, p.scale * 0.25, 12, [p.x, p.scale * 2, p.z], p.scale * 0.3), C.tank);
    }
    for (const [x, z] of this.map.lamps) {                                // cột đèn
      b.add(meshes.cylTris(0.11, 5, 6, [x, 0, z], 0.07), C.lamp);
      const tx = Math.abs(x) < Math.abs(z) ? -Math.sign(x) : 0, tz = tx ? 0 : -Math.sign(z);
      b.box(x + Math.min(0, tx * 1.2) - 0.05, 4.9, z + Math.min(0, tz * 1.2) - 0.05, x + Math.max(0, tx * 1.2) + 0.05, 5.0, z + Math.max(0, tz * 1.2) + 0.05, C.lamp);
    }
    this._mesh(b.geometry(), meshes.SHARED, 0, { cast: true, receive: true });
  },

  _props() {
    for (const p of this.map.props) {
      if (p.kind === "tank") continue;
      const look = new Rng(p.look);
      const th = this.theme;
      const treeOf = { round: () => meshes.roundTreeGeometry(look, th.treeColors), dead: () => meshes.deadTreeGeometry(look, th.treeColors) }[th.treeStyle]
        || (() => meshes.treeGeometry(look, new Builder(), th.treeColors));
      const [geometry, y] = p.kind === "tree" ? [treeOf(), 0]
        : p.kind === "cactus" ? [meshes.cactusGeometry(look), 0]
        : p.kind === "rock" ? [meshes.rockGeometry(look, th.rockTint ? hexRgb(th.rockTint) : null), p.scale * 0.3]
        : [meshes.crateGeometry(), p.scale / 2];
      const mesh = this._mesh(geometry, meshes.SHARED, 0, { cast: true, receive: true });
      mesh.position.set(p.x, y, p.z);
      mesh.scale.setScalar(p.scale);
      mesh.rotation.y = (p.rotation * Math.PI) / 180;
      mesh.updateMatrix();
    }
  },

  // ---------- đèn: đầu đèn phát sáng + quầng sáng ấm in xuống mặt đường, đèn treo trong nhà kho ----------
  _lamps() {
    const glow = new T.SpriteMaterial({ map: glowTexture("rgba(255,236,190,1)", "rgba(255,190,90,0.45)"), blending: T.AdditiveBlending, depthWrite: false });
    const pool = new T.MeshBasicMaterial({ map: glowTexture("rgba(255,214,150,0.55)", "rgba(255,180,90,0.22)"), blending: T.AdditiveBlending,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    const disc = new T.PlaneGeometry(1, 1);
    disc.rotateX(-Math.PI / 2);
    const boost = this.theme.lampBoost || 1;                               // ban đêm: quầng đèn to và rực hơn
    const light = (x, y, z, size, floor = 0) => {
      size *= boost;
      const s = new T.Sprite(glow);
      s.position.set(x, y, z); s.scale.setScalar(size);
      this.root.add(s);
      const p = new T.Mesh(disc, pool);
      p.position.set(x, floor + 0.07, z); p.scale.setScalar(size * 4.2); p.renderOrder = 3;
      this.root.add(p);
    };
    for (const [x, z] of this.map.lamps) {
      const tx = Math.abs(x) < Math.abs(z) ? -Math.sign(x) : 0, tz = tx ? 0 : -Math.sign(z);
      light(x + tx * 1.2, 4.85, z + tz * 1.2, 2.0);
    }
    for (const [x, y, z, size, floor] of this.map.lights) light(x, y, z, size, floor || 0);     // đèn treo riêng của từng bản đồ
  },

  // ---------- bóng đổ: mỗi khối/cây in một mảng tối xuống đất theo hướng nắng ----------
  _shadows() {
    const sx = -meshes.SUN[0] / meshes.SUN[1], sz = -meshes.SUN[2] / meshes.SUN[1], pos = [];
    const cast = (points) => {                                            // points: [x, y, z] các đỉnh của vật
      const h = meshes.hull(points.map(([x, y, z]) => [x + sx * y, z + sz * y]));
      for (let i = 1; i < h.length - 1; i++) pos.push(h[0][0], 0.05, h[0][1], h[i][0], 0.05, h[i][1], h[i + 1][0], 0.05, h[i + 1][1]);
    };
    for (const k of this.map.blocks) {
      if (k.kind === "rail" || k.kind === "beam") continue;
      const pts = [];
      for (const [x, z] of [[k.x0, k.z0], [k.x1, k.z0], [k.x1, k.z1], [k.x0, k.z1]]) pts.push([x, k.y0, z], [x, this.col.topAt(k, x, z), z]);
      cast(pts);
    }
    const ring = (x, z, r, y) => Array.from({ length: 8 }, (_, i) => [x + Math.cos(i * 0.785) * r, y, z + Math.sin(i * 0.785) * r]);
    for (const p of this.map.props) {
      if (p.kind === "tree") cast([...ring(p.x, p.z, 0.25, 0), ...ring(p.x, p.z, 1.7 * p.scale, 2.6 * p.scale), ...ring(p.x, p.z, 0.4 * p.scale, 5.6 * p.scale)]);
      else if (p.kind === "rock") cast([...ring(p.x, p.z, 0.9 * p.scale, 0), ...ring(p.x, p.z, 0.6 * p.scale, 0.9 * p.scale)]);
      else if (p.kind === "tank") cast([...ring(p.x, p.z, p.scale, 0), ...ring(p.x, p.z, p.scale, p.scale * 2)]);
      else cast([...ring(p.x, p.z, 0.6 * p.scale, 0), ...ring(p.x, p.z, 0.6 * p.scale, p.scale)]);
    }
    for (const [x, z] of this.map.lamps) cast([...ring(x, z, 0.1, 0), ...ring(x, z, 0.1, 5)]);
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    this._mesh(geo, new T.MeshBasicMaterial({ color: 0x141a2c, transparent: true, opacity: 0.30, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: T.DoubleSide }), 2);
  },
};
