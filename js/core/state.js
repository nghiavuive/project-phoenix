// Chỉ số của một người chơi: máu, điểm, chuỗi hạ gục.
import { config } from "../config.js";

export class PlayerStats {
  constructor() { this.reset(); }
  reset() {
    this.hp = config.PLAYER_HP;
    this.score = 0;
    this.kills = 0;
    this.headshots = 0;
    this.combo = 0;
    this.comboTimer = 0;
  }
  get multiplier() { return Math.max(1, Math.min(this.combo, config.COMBO_MAX)); }
  get alive() { return this.hp > 0; }

  tick(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
  }
  /** Cộng điểm một mạng, trả về số điểm vừa được cộng. */
  addKill(baseScore, headshot = false) {
    this.combo += 1;
    this.comboTimer = config.COMBO_WINDOW;
    this.kills += 1;
    let gained = baseScore * this.multiplier;
    if (headshot) { this.headshots += 1; gained += config.HEADSHOT_BONUS; }
    this.score += gained;
    return gained;
  }
  /** Trừ máu, trả về true nếu gục. */
  damage(amount) { this.hp = Math.max(0, this.hp - amount); return this.hp <= 0; }
  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(config.PLAYER_HP, this.hp + amount);
    return this.hp - before;
  }
}
