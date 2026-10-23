// Vũ khí: thông số từng món và logic băng đạn, nạp đạn, nhịp đánh. Không vẽ gì ở đây.
// Thêm vũ khí mới: viết một spec rồi cho vào LOADOUT (và vẽ hình cho nó trong game/arsenal.js).
// Cảm giác bắn: zoom = độ phóng khi ngắm (chuột phải); bloom = độ tản cộng thêm sau mỗi phát (tự hồi);
// kickYaw = giật ngang ngẫu nhiên; scope = có ống ngắm.
const gun = (o) => Object.freeze({ pellets: 1, spread: 0, range: 80, recoil: 1, reserve: null, refill: 0,
  melee: false, arc: 0, zoom: 1.3, bloom: 0.25, bloomMax: 2.5, kickYaw: 0.25, scope: false, sound: o.key, ...o });
const blade = (o) => Object.freeze({ ...gun({ magSize: 1, reloadTime: 0, range: 2.4, recoil: 0, zoom: 1, bloom: 0 }),
  melee: true, ...o, sound: o.key });

// reserve: đạn dự trữ lúc đầu (null = vô hạn); refill: số đạn được thêm mỗi lần nhặt hộp đạn.
export const PISTOL = gun({ key: "pistol", name: "Súng lục", tag: "LỤC", damage: 34, fireInterval: 0.22, magSize: 12,
  reloadTime: 1.0, spread: 0.5, range: 60, recoil: 1.3, bloom: 0.5, kickYaw: 0.4 });
export const RIFLE = gun({ key: "rifle", name: "Súng trường", tag: "AK", damage: 25, fireInterval: 0.11, magSize: 30,
  reloadTime: 1.4, spread: 0.6, range: 90, recoil: 0.9, reserve: 150, refill: 30 });
export const SMG = gun({ key: "smg", name: "Tiểu liên", tag: "SMG", damage: 15, fireInterval: 0.065, magSize: 35,
  reloadTime: 1.2, spread: 1.6, range: 45, recoil: 0.55, reserve: 140, refill: 35, zoom: 1.2, bloom: 0.3, bloomMax: 3.5, kickYaw: 0.45 });
export const SHOTGUN = gun({ key: "shotgun", name: "Shotgun", tag: "SHOT", damage: 14, fireInterval: 0.75, magSize: 6,
  reloadTime: 1.9, pellets: 8, spread: 4.5, range: 30, recoil: 4.0, reserve: 18, refill: 6, zoom: 1.15, bloom: 0, kickYaw: 1.2 });
export const SNIPER = gun({ key: "sniper", name: "Bắn tỉa", tag: "TỈA", damage: 150, fireInterval: 1.3, magSize: 5,
  reloadTime: 2.4, spread: 0.05, range: 160, recoil: 6.0, reserve: 10, refill: 3, zoom: 4, scope: true, bloom: 0, kickYaw: 0.6, hipSpread: 3.5 });
export const LMG = gun({ key: "lmg", name: "Súng máy", tag: "MÁY", damage: 22, fireInterval: 0.085, magSize: 80,
  reloadTime: 3.2, spread: 1.4, range: 75, recoil: 0.7, reserve: 80, refill: 40, zoom: 1.2, bloom: 0.35, bloomMax: 4, kickYaw: 0.5 });
// Cận chiến: quét trúng mọi mục tiêu trong tầm và trong góc `arc` trước mặt. Cầm chảo còn đỡ được đạn bắn từ phía trước.
export const PAN = blade({ key: "pan", name: "Chảo", tag: "CHẢO", damage: 90, fireInterval: 0.55, arc: 100, range: 2.7,
  guard: true });
export const KNIFE = blade({ key: "knife", name: "Dao", tag: "DAO", damage: 55, fireInterval: 0.28, arc: 60, range: 2.3 });

export const LOADOUT = [PISTOL, RIFLE, SMG, SHOTGUN, SNIPER, LMG, PAN, KNIFE];   // thứ tự = phím số 1..8
export const START_INDEX = 1;                                                    // vào trận cầm súng trường

export class Weapon {
  constructor(spec) {
    this.spec = spec;
    this.ammo = spec.magSize;
    this.reserve = spec.reserve;
    this.cooldown = 0;
    this.reloadLeft = 0;
  }
  get reloading() { return this.reloadLeft > 0; }
  get reloadProgress() { return this.reloading ? 1 - this.reloadLeft / this.spec.reloadTime : 1; }
  get outOfAmmo() { return !this.spec.melee && this.ammo === 0 && this.reserve === 0; }

  /** Trả về true đúng khung hình nạp đạn xong. */
  tick(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading) {
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0) { this.reloadLeft = 0; this._fill(); return true; }
    }
    return false;
  }
  tryFire() {
    if (this.reloading || this.cooldown > 0) return false;
    if (!this.spec.melee) {
      if (this.ammo <= 0) return false;
      this.ammo -= 1;
    }
    this.cooldown = this.spec.fireInterval;
    return true;
  }
  startReload() {
    if (this.spec.melee || this.reloading || this.ammo >= this.spec.magSize || this.reserve === 0) return false;
    this.reloadLeft = this.spec.reloadTime;
    return true;
  }
  cancelReload() { this.reloadLeft = 0; }
  /** Nhặt hộp đạn; trả về true nếu món này có nhận thêm đạn. */
  refill() {
    if (this.reserve === null || !this.spec.refill) return false;
    this.reserve += this.spec.refill;
    return true;
  }
  _fill() {
    const need = this.spec.magSize - this.ammo;
    if (this.reserve === null) { this.ammo += need; return; }
    const take = Math.min(need, this.reserve);
    this.ammo += take;
    this.reserve -= take;
  }
}
