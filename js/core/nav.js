// Tìm đường trên mặt đất cho địch và bot: lưới ô 1 m + loang (BFS) từ đích ra mọi phía.
// Mỗi đích có một "bản đồ khoảng cách"; ai muốn tới đích chỉ việc bước sang ô có số nhỏ hơn.
// Nhờ vậy địch biết vòng qua tường, vào cửa nhà kho, luồn giữa các container thay vì húc đầu vào vật cản.
import { config } from "../config.js";

const CELL = 1;
const FAR = 65535;

export class Nav {
  constructor(col, arena = config.ARENA_RADIUS) {
    this.col = col;
    this.n = Math.ceil((arena * 2) / CELL);
    this.half = arena;
    this.walk = new Uint8Array(this.n * this.n);
    for (let j = 0; j < this.n; j++) {
      for (let i = 0; i < this.n; i++) {
        const x = this.cx(i), z = this.cx(j);
        this.walk[j * this.n + i] = Math.hypot(x, z) < arena - 0.6 && !col.blockedAt(x, z, 0.42) ? 1 : 0;
      }
    }
    this.fields = new Map();        // khoá -> {dist, x, z, time}
    this.queue = new Int32Array(this.n * this.n);
  }
  cx(i) { return -this.half + (i + 0.5) * CELL; }
  cell(v) { return Math.max(0, Math.min(this.n - 1, Math.floor((v + this.half) / CELL))); }

  /** Ô đi được gần (x, z) nhất (đích có thể đang đứng sát tường hoặc trên dốc). */
  _nearest(x, z) {
    const ci = this.cell(x), cj = this.cell(z);
    for (let r = 0; r <= 5; r++) {
      let best = -1, bestD = Infinity;
      for (let j = cj - r; j <= cj + r; j++) {
        for (let i = ci - r; i <= ci + r; i++) {
          if (i < 0 || j < 0 || i >= this.n || j >= this.n || !this.walk[j * this.n + i]) continue;
          const d = (this.cx(i) - x) ** 2 + (this.cx(j) - z) ** 2;
          if (d < bestD) { bestD = d; best = j * this.n + i; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** Bản đồ khoảng cách tới (x, z). Tính lại khi đích đã đi xa hơn 1 m hoặc đã cũ quá `maxAge` giây. */
  field(key, x, z, now, maxAge = 0.5) {
    let f = this.fields.get(key);
    if (f && now - f.time < maxAge && (f.x - x) ** 2 + (f.z - z) ** 2 < 1) return f;
    if (!f) { f = { dist: new Uint16Array(this.n * this.n) }; this.fields.set(key, f); }
    f.x = x; f.z = z; f.time = now;
    const dist = f.dist, n = this.n, q = this.queue, walk = this.walk;
    dist.fill(FAR);
    const start = this._nearest(x, z);
    if (start < 0) return f;
    let head = 0, tail = 0;
    dist[start] = 0; q[tail++] = start;
    while (head < tail) {
      const c = q[head++], d = dist[c] + 1, i = c % n, j = (c - i) / n;
      if (i > 0 && walk[c - 1] && dist[c - 1] === FAR) { dist[c - 1] = d; q[tail++] = c - 1; }
      if (i < n - 1 && walk[c + 1] && dist[c + 1] === FAR) { dist[c + 1] = d; q[tail++] = c + 1; }
      if (j > 0 && walk[c - n] && dist[c - n] === FAR) { dist[c - n] = d; q[tail++] = c - n; }
      if (j < n - 1 && walk[c + n] && dist[c + n] === FAR) { dist[c + n] = d; q[tail++] = c + n; }
    }
    return f;
  }

  /** Điểm nên đi tới tiếp theo (nhìn trước vài ô cho mượt) để từ (x, z) về đích của bản đồ `f`. Trả về [x, z] hoặc null. */
  next(f, x, z, look = 3) {
    const n = this.n, dist = f.dist;
    let c = this.cell(z) * n + this.cell(x);
    if (!this.walk[c] || dist[c] === FAR) { c = this._nearest(x, z); if (c < 0 || dist[c] === FAR) return null; }
    for (let step = 0; step < look && dist[c] > 0; step++) {
      const i = c % n, j = (c - i) / n;
      let best = c, bestD = dist[c];
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di, nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
          const k = nj * n + ni;
          if (!this.walk[k]) continue;
          if (di && dj && (!this.walk[j * n + ni] || !this.walk[nj * n + i])) continue;   // không cắt chéo qua góc tường
          const d = dist[k] + (di && dj ? 0.4 : 0);
          if (d < bestD) { bestD = d; best = k; }
        }
      }
      if (best === c) break;
      c = best;
    }
    const i = c % n;
    return [this.cx(i), this.cx((c - i) / n)];
  }
}
