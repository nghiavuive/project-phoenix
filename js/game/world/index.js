// Dựng hình bản đồ từ core/map.js: mặt đất, đường, công trình, rừng, bóng đổ, bầu trời, đèn.
// Mọi thứ nằm trong `root` dùng hệ trục của luật chơi (z hướng về bắc); root lật trục z cho khớp với Three.js.
// Gần như toàn bộ công trình được gộp vào vài lưới lớn nên điện thoại vẽ rất nhẹ.
// Chia file theo chức năng: sky.js (trời, núi, mây), ground.js (đất, đường, cỏ), structures.js (công trình, cây, đèn).
import { Rng } from "../../core/rng.js";
import * as meshes from "../meshes.js";
import { T } from "./common.js";
import { groundMethods } from "./ground.js";
import { skyMethods } from "./sky.js";
import { structureMethods } from "./structures.js";

export class World {
  constructor(scene, map) {
    this.map = map;
    this.seed = map.seed;
    this.col = map.col;
    this.root = new T.Group();
    this.root.scale.z = -1;
    scene.add(this.root);
    const theme = this.theme = map.theme;
    meshes.setTheme(theme);                                // màu nắng/bóng của bản đồ này, trước khi dựng bất cứ lưới nào
    scene.background = new T.Color(theme.sky.mid);
    scene.fog = new T.Fog(theme.fog[0], theme.fog[1], theme.fog[2]);
    const rng = new Rng(map.seed + 1);

    this._sky(rng);
    this._ground(rng);
    this._decals(rng);
    if (meshes.LIT) this._lights(scene); else this._shadows();   // đồ hoạ cao: bóng thật; thấp: mảng tối vẽ sẵn
    this._structures(rng);
    this._props();
    this._lamps();
    if (theme.clouds > 0) this._clouds(new Rng(map.seed + 7), theme.clouds);
    if (meshes.LIT) this._grass(new Rng(map.seed + 9));    // cỏ bụi chỉ có ở đồ hoạ cao (điện thoại đỡ nặng)
  }

  /** Gỡ cả thế giới khỏi cảnh và giải phóng bộ nhớ (khi đổi bản đồ). */
  dispose(scene) {
    scene.remove(this.root);
    for (const light of [this.hemi, this.sun, this.sun && this.sun.target]) if (light) scene.remove(light);
    if (this.sun && this.sun.shadow.map) this.sun.shadow.map.dispose();
    const shared = new Set([meshes.SHARED]);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (m && !shared.has(m) && !Array.isArray(m)) { if (m.map) m.map.dispose(); m.dispose(); }
    });
    scene.fog = null;
  }

  /** cast: đổ bóng lên vật khác; receive: nhận bóng của vật khác (chỉ có tác dụng ở đồ hoạ cao). */
  _mesh(geometry, material = meshes.SHARED, order = 0, { cast = false, receive = false } = {}) {
    const mesh = new T.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = order;
    mesh.castShadow = cast && meshes.LIT;
    mesh.receiveShadow = receive && meshes.LIT;
    this.root.add(mesh);
    return mesh;
  }

  // ---------- đèn thật (đồ hoạ cao): nắng có bản đồ bóng + ánh sáng trời ----------
  // Pha màu y như cách "nướng" của đồ hoạ thấp (meshes.light): trời = nền lạnh, nắng = màu ấm theo góc chiếu,
  // nên hai mức đồ hoạ cùng một tông màu; khác ở chỗ chỗ bị che thì chỉ còn ánh trời -> bóng đổ đúng.
  _lights(scene) {
    const cool = this.theme.shadeCool;
    const hemi = new T.HemisphereLight(new T.Color(...cool.map((v) => v + 0.1)), new T.Color(...cool.map((v) => Math.max(0, v - 0.1))), 1);
    scene.add(hemi);
    this.hemi = hemi;
    const sun = new T.DirectionalLight(new T.Color(...this.theme.sunWarm), 1);
    sun.castShadow = true;
    const R = 40, shadow = sun.shadow;                    // vùng có bóng: hình vuông 80 m quanh người chơi
    shadow.mapSize.set(2048, 2048);
    Object.assign(shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 400 });
    shadow.camera.updateProjectionMatrix();
    shadow.bias = -0.0005;
    shadow.normalBias = 0.035;
    scene.add(sun, sun.target);
    this.sun = sun;
    this.shadowR = R;
    this.sunDir = new T.Vector3(meshes.SUN[0], meshes.SUN[1], -meshes.SUN[2]).normalize();   // root lật trục z
    const f = this.sunDir.clone().negate();               // trục của máy chiếu bóng, để bám theo đúng từng điểm ảnh bóng
    this.lightRight = new T.Vector3().crossVectors(f, new T.Vector3(0, 1, 0)).normalize();
    this.lightUp = new T.Vector3().crossVectors(this.lightRight, f).normalize();
    this._ahead = new T.Vector3();
    this._center = new T.Vector3();
  }

  /** Mỗi khung hình: dời vùng có bóng theo máy quay (lệch về phía trước mặt cho bóng phủ kín chỗ đang nhìn).
   *  Bước dời làm tròn đúng bằng một điểm ảnh của bản đồ bóng nên mép bóng không rung khi đi lại. */
  follow(camera) {
    if (this.cloudGroup) {                                   // mây trôi chậm theo gió (xoay cả bầu mây quanh bản đồ)
      const now = performance.now();
      this.cloudGroup.rotation.y += Math.min(0.1, (now - this._cloudT) / 1000) * 0.004;
      this._cloudT = now;
    }
    if (!this.sun) return;
    const dir = camera.getWorldDirection(this._ahead);
    dir.y = 0;
    if (dir.lengthSq() > 1e-6) dir.normalize();
    const c = this._center.copy(camera.position).addScaledVector(dir, this.shadowR * 0.45);
    c.y = 0;
    const texel = (2 * this.shadowR) / this.sun.shadow.mapSize.x;
    const a = Math.round(c.dot(this.lightRight) / texel) * texel, b = Math.round(c.dot(this.lightUp) / texel) * texel;
    const depth = c.dot(this.sunDir);
    c.copy(this.lightRight).multiplyScalar(a).addScaledVector(this.lightUp, b).addScaledVector(this.sunDir, depth);
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).addScaledVector(this.sunDir, 160);
  }
}

Object.assign(World.prototype, skyMethods, groundMethods, structureMethods);
