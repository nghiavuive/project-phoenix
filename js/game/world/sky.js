// Bầu trời: vòm chuyển màu, mặt trời/trăng, sao, dãy núi xa, mây.
import * as meshes from "../meshes.js";
import { Rng } from "../../core/rng.js";
import { Builder, C, T, boxTris, glowTexture, hexRgb, shadeOf } from "./common.js";

export const skyMethods = {
  // ---------- bầu trời: vòm chuyển màu + mặt trời thấp + dãy núi ----------
  _sky(rng) {
    const geo = new T.SphereGeometry(320, 24, 12), pos = geo.attributes.position, colors = [];
    const top = hexRgb(this.theme.sky.top), mid = hexRgb(this.theme.sky.mid), low = hexRgb(this.theme.sky.horizon);
    for (let i = 0; i < pos.count; i++) {
      const h = Math.max(0, pos.getY(i) / 320), a = h < 0.25 ? low : mid, b = h < 0.25 ? mid : top, t = h < 0.25 ? h / 0.25 : (h - 0.25) / 0.75;
      colors.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
    }
    geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    const dome = this._mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }), -10);
    dome.frustumCulled = false;
    const [sunIn, sunOut] = this.theme.sunColor;                          // ban đêm: mặt trăng xanh nhạt
    const sun = new T.Sprite(new T.SpriteMaterial({ map: glowTexture(sunIn, sunOut), fog: false,
      blending: T.AdditiveBlending, depthWrite: false }));
    sun.position.set(meshes.SUN[0] * 280, meshes.SUN[1] * 280, meshes.SUN[2] * 280);
    sun.scale.setScalar(this.theme.stars ? 90 : 150);
    this.root.add(sun);
    if (this.theme.stars) this._stars(rng);

    const far = meshes.paint();                                          // núi chìm một phần trong sương cho có chiều sâu
    for (let i = 0; i < 26; i++) {
      const angle = (i * Math.PI * 2) / 26 + rng.uniform(-0.08, 0.08), dist = rng.uniform(76, 104);
      const m = new T.Mesh(meshes.mountainGeometry(rng, this.theme.mountains, this.theme.snowCaps, this.theme.mountainShape), far);
      m.position.set(Math.cos(angle) * dist, -1, Math.sin(angle) * dist);
      m.scale.set(rng.uniform(18, 30), rng.uniform(24, 50), rng.uniform(18, 30));
      m.matrixAutoUpdate = false; m.updateMatrix();
      this.root.add(m);
    }
  },

  /** Bầu trời đêm: vài trăm ngôi sao là điểm sáng nhỏ trên nửa vòm trời. */
  _stars(rng) {
    const pos = [];
    for (let i = 0; i < 420; i++) {
      const a = rng.uniform(0, Math.PI * 2), h = Math.sqrt(rng.uniform(0.02, 1)), r = Math.sqrt(1 - h * h) * 300;
      pos.push(Math.cos(a) * r, h * 300, Math.sin(a) * r);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    const stars = new T.Points(geo, new T.PointsMaterial({ color: 0xdfe8ff, size: 2.2, sizeAttenuation: false, fog: false, depthWrite: false }));
    stars.frustumCulled = false;
    this.root.add(stars);
  },

  // ---------- mây: những cụm khối dẹt trôi chậm trên trời ----------
  _clouds(rng, count = 16) {
    this.cloudGroup = new T.Group();
    const material = meshes.LIT ? new T.MeshLambertMaterial({ vertexColors: true, fog: false, emissive: 0x6b7280 })
      : new T.MeshBasicMaterial({ vertexColors: true, fog: false });
    for (let i = 0; i < count; i++) {
      const b = new Builder(), puffs = 3 + Math.floor(rng.uniform(0, 3));
      for (let j = 0; j < puffs; j++) {
        b.add(meshes.blobTris(rng.uniform(5, 9), rng, 0.18, [1.6, 0.55, 1.1], [j * rng.uniform(6, 9) - puffs * 3.5, rng.uniform(-1, 2), rng.uniform(-3, 3)]),
          [0.97, 0.97, 1.0]);
      }
      const cloud = new T.Mesh(b.geometry(), material);
      const angle = rng.uniform(0, Math.PI * 2), dist = rng.uniform(70, 190);
      cloud.position.set(Math.cos(angle) * dist, rng.uniform(55, 90), Math.sin(angle) * dist);
      cloud.rotation.y = rng.uniform(0, Math.PI * 2);
      this.cloudGroup.add(cloud);
    }
    this.root.add(this.cloudGroup);
    this._cloudT = performance.now();
  },
};
