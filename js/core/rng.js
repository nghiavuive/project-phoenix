// Bộ sinh số ngẫu nhiên có seed (mulberry32) - cùng seed thì ra cùng dãy số trên mọi máy.
export class Rng {
  constructor(seed = (Math.random() * 2 ** 32) >>> 0) { this.s = seed >>> 0; }
  random() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  uniform(a, b) { return a + (b - a) * this.random(); }
  choice(list) { return list[Math.floor(this.random() * list.length)]; }
  shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
  gauss(sigma = 1) {
    const u = 1 - this.random(), v = this.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
  }
}
