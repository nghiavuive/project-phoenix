// Đạo diễn các đợt tấn công: đợt nào ra con gì, lúc nào thả, lúc nào nghỉ.
import { config } from "../config.js";
import { Rng } from "./rng.js";

/** Danh sách loại địch của đợt `number` (bắt đầu từ 1), đã xáo trộn. */
export function composeWave(number, rng) {
  const count = Math.min(4 + number * 2, 30), kinds = [];
  for (let i = 0; i < count; i++) {
    const roll = rng.random();
    if (number >= 2 && roll < Math.min(0.10 + 0.03 * number, 0.30)) kinds.push("runner");
    else if (number >= 3 && roll < Math.min(0.25 + 0.04 * number, 0.55)) kinds.push("shooter");
    else kinds.push("grunt");
  }
  if (number >= 4) {                               // từ đợt 4 có trùm
    for (let i = 0; i < Math.min(Math.floor((number - 1) / 3), 4); i++) kinds.push("brute");
  }
  return rng.shuffle(kinds);
}

export class WaveDirector {
  constructor(seed) {
    this.rng = new Rng(seed);
    this.number = 0;
    this.fighting = false;
    this.timer = 1.5;                              // đợt đầu đến nhanh
    this.queue = [];
    this.spawnTimer = 0;
  }
  get remainingToSpawn() { return this.queue.length; }

  /** Trả về [danh sách loại địch cần thả ngay, sự kiện]; sự kiện: "wave_start" | "wave_clear" | null. */
  tick(dt, alive) {
    if (!this.fighting) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.number += 1;
        this.queue = composeWave(this.number, this.rng);
        this.fighting = true;
        this.spawnTimer = 0;
        return [[], "wave_start"];
      }
      return [[], null];
    }
    const spawns = [];
    this.spawnTimer -= dt;
    if (this.queue.length && this.spawnTimer <= 0 && alive < config.MAX_ALIVE) {
      spawns.push(this.queue.pop());
      this.spawnTimer = Math.max(0.25, config.SPAWN_INTERVAL - 0.03 * this.number);
    }
    if (!this.queue.length && !spawns.length && alive === 0) {
      this.fighting = false;
      this.timer = config.WAVE_REST;
      return [[], "wave_clear"];
    }
    return [spawns, null];
  }
}
