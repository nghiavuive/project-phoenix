// Va chạm 2D trên mặt đất: mọi vật cản được coi là hình tròn [x, z, bán kính].
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Đẩy điểm (x, z) ra khỏi các vật cản và giữ nó trong đấu trường. Trả về [x, z]. */
export function resolveCircles(x, z, radius, obstacles, arenaRadius) {
  for (const [ox, oz, orad] of obstacles) {
    let dx = x - ox, dz = z - oz;
    const need = radius + orad, d2 = dx * dx + dz * dz;
    if (d2 < need * need) {
      let d = Math.sqrt(d2);
      if (d < 1e-6) { dx = 1; dz = 0; d = 1; }      // đứng đúng tâm: đẩy theo trục x
      x = ox + (dx / d) * need;
      z = oz + (dz / d) * need;
    }
  }
  const d = Math.hypot(x, z), limit = arenaRadius - radius;
  if (d > limit) { x = (x / d) * limit; z = (z / d) * limit; }
  return [x, z];
}

/** Điểm (x, z) có nằm trong vật cản nào không. */
export function blocked(x, z, obstacles, pad = 0) {
  for (const [ox, oz, orad] of obstacles) {
    if ((x - ox) ** 2 + (z - oz) ** 2 < (orad + pad) ** 2) return true;
  }
  return false;
}

/** Đoạn thẳng A-B có bị vật cản nào chắn không (dùng cho tầm nhìn của địch). */
export function segmentBlocked(ax, az, bx, bz, obstacles) {
  const dx = bx - ax, dz = bz - az, length2 = dx * dx + dz * dz;
  if (length2 < 1e-9) return false;
  for (const [ox, oz, orad] of obstacles) {
    const t = clamp(((ox - ax) * dx + (oz - az) * dz) / length2, 0, 1);
    const cx = ax + dx * t, cz = az + dz * t;
    if ((cx - ox) ** 2 + (cz - oz) ** 2 < orad * orad) return true;
  }
  return false;
}
