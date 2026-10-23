// Chủng loại kẻ địch và cách chúng di chuyển (toán thuần, không engine).
// shape: vùng trúng đạn (đã nhân với size): thân là trụ bán kính r cao h, đầu là cầu tâm cao headY bán kính headR.
const spec = (o) => {
  const k = o.size, s = { r: 0.52, h: 1.56, headY: 1.86, headR: 0.34, ...(o.shape || {}) };
  return Object.freeze({ ranged: false, keepDistance: 0, radius: 0.5, stagger: 0.18, ...o,
    shape: Object.freeze({ r: s.r * k, h: s.h * k, headY: s.headY * k, headR: s.headR * k }) });
};
export const HUMAN_SHAPE = Object.freeze({ r: 0.5, h: 1.5, headY: 1.72, headR: 0.3 });   // người chơi khác / bot

export const GRUNT = spec({ kind: "grunt", name: "Lính", hp: 100, speed: 3.4, damage: 10, attackRange: 1.7,
  attackInterval: 1.0, score: 100, size: 1.0, color: "#d8352f" });
export const RUNNER = spec({ kind: "runner", name: "Chạy nhanh", hp: 50, speed: 6.6, damage: 7, attackRange: 1.6,
  attackInterval: 0.7, score: 120, size: 0.85, color: "#f08a1c", radius: 0.4,
  shape: { r: 0.5, h: 1.2, headY: 1.42, headR: 0.3 } });                 // lom khom nên thấp
export const SHOOTER = spec({ kind: "shooter", name: "Xạ thủ", hp: 75, speed: 2.8, damage: 12, attackRange: 30,
  attackInterval: 2.2, score: 150, size: 1.0, color: "#8a45d6", ranged: true, keepDistance: 14,
  shape: { r: 0.42, h: 1.78, headY: 2.06, headR: 0.3 } });               // cao gầy
export const BRUTE = spec({ kind: "brute", name: "Đồ tể", hp: 420, speed: 2.3, damage: 28, attackRange: 2.6,
  attackInterval: 1.5, score: 400, size: 1.6, color: "#7a1616", radius: 0.95, stagger: 0,
  shape: { r: 0.78, h: 1.62, headY: 1.80, headR: 0.26 } });              // to ngang, đầu nhỏ, không bị khựng khi trúng đạn

export const SPECS = { grunt: GRUNT, runner: RUNNER, shooter: SHOOTER, brute: BRUTE };

/** Vận tốc [vx, vz] cho một kẻ địch. pos, target: [x, z]; neighbors: vị trí địch khác để khỏi chồng nhau. */
export function steer(pos, target, spec, neighbors, strafeSign = 1) {
  const dx = target[0] - pos[0], dz = target[1] - pos[1];
  const dist = Math.hypot(dx, dz) || 1e-6;
  const ux = dx / dist, uz = dz / dist;
  let vx, vz;
  if (spec.ranged) {                               // giữ khoảng cách và đi ngang để khó bắn hơn
    const forward = Math.max(-1, Math.min(1, (dist - spec.keepDistance) / 3));
    vx = ux * forward + -uz * 0.6 * strafeSign;
    vz = uz * forward + ux * 0.6 * strafeSign;
  } else {
    const forward = dist < spec.attackRange * 0.8 ? 0 : 1;
    vx = ux * forward; vz = uz * forward;
  }
  for (const [nx, nz] of neighbors) {              // tách khỏi đồng đội
    const ex = pos[0] - nx, ez = pos[1] - nz, d = Math.hypot(ex, ez);
    if (d > 1e-6 && d < 1.6) {
      const push = (1.6 - d) / 1.6;
      vx += (ex / d) * push * 1.5;
      vz += (ez / d) * push * 1.5;
    }
  }
  const length = Math.hypot(vx, vz);
  if (length > 1) { vx /= length; vz /= length; }
  return [vx * spec.speed, vz * spec.speed];
}

/** Đi thẳng tới một điểm mốc trên đường (không dừng, không đi ngang), vẫn tách khỏi đồng đội. */
export function seek(pos, goal, speed, neighbors) {
  const dx = goal[0] - pos[0], dz = goal[1] - pos[1], dist = Math.hypot(dx, dz) || 1e-6;
  let vx = dx / dist, vz = dz / dist;
  for (const [nx, nz] of neighbors) {
    const ex = pos[0] - nx, ez = pos[1] - nz, d = Math.hypot(ex, ez);
    if (d > 1e-6 && d < 1.4) { vx += (ex / d) * (1.4 - d); vz += (ez / d) * (1.4 - d); }
  }
  const length = Math.hypot(vx, vz) || 1;
  return [(vx / length) * speed, (vz / length) * speed];
}
