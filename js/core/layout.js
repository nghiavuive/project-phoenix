// Bố cục bản đồ + bộ va chạm + bộ tìm đường, gói lại thành một thứ để mô phỏng và phần vẽ cùng dùng.
import { config } from "../config.js";
import { Collider } from "./collide.js";
import { buildMap, DEFAULT_MAP } from "./map.js";
import { Nav } from "./nav.js";

/** Bản đồ đầy đủ theo mã `mapId`. `data` có thể là một bản đồ rút gọn (kiểm thử): {seed, obstacles: [[x, z, r]], blocks?, decks?}. */
export function buildLayout(data = null, mapId = DEFAULT_MAP) {
  const map = data ? { blocks: [], decks: [], lamps: [], props: [], zones: [], roads: [], spawn: [0, 0], ...data,
    circles: data.circles || data.obstacles || [] } : buildMap(mapId);
  map.obstacles = map.circles;
  map.col = new Collider(map.circles, map.blocks, map.decks);
  map.nav = new Nav(map.col);
  return map;
}

/** Chỗ trống trên mặt đất, cách mọi điểm trong `avoid` ít nhất `minDist`. Trả về [x, z]. */
export function spawnPoint(rng, col, avoid = [], minDist = config.SPAWN_MIN_DIST, near = 22) {
  let best = [0, 34], bestGap = -1;
  for (let i = 0; i < 80; i++) {
    const angle = rng.uniform(0, Math.PI * 2), dist = rng.uniform(near, config.ARENA_RADIUS - 3);
    const x = Math.cos(angle) * dist, z = Math.sin(angle) * dist;
    if (col.blockedAt(x, z, 1.2)) continue;
    let gap = 1e9;
    for (const [ax, az] of avoid) gap = Math.min(gap, Math.hypot(x - ax, z - az));
    if (gap >= minDist) return [x, z];
    if (gap > bestGap) { best = [x, z]; bestGap = gap; }
  }
  return best;
}
