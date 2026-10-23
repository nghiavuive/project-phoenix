// Vẽ cần ảo và các nút cảm ứng. Vị trí lấy từ TouchControls nên hình và vùng bấm luôn khớp.
export class TouchOverlay {
  constructor(layer) {
    this.layer = layer;
    this.base = this._disc("stick-base");
    this.knob = this._disc("stick-knob");
    this.items = new Map();
  }
  _disc(className, label = "") {
    const el = document.createElement("div");
    el.className = `pad ${className}`;
    el.textContent = label;
    this.layer.appendChild(el);
    return el;
  }
  show(on = true) { this.layer.hidden = !on; }

  /** ui (x: ±tỉ_lệ/2, y: ±0.5, gốc giữa màn hình) -> điểm ảnh. */
  _place(el, x, y, radius, w, h) {
    const size = radius * 2 * h;
    el.style.width = el.style.height = `${size}px`;
    el.style.transform = `translate(${(x / (w / h) + 0.5) * w - size / 2}px, ${(0.5 - y) * h - size / 2}px)`;
  }

  /** counts: {grenade, smoke} - số quả còn lại, hiện ngay trên nút. */
  sync(controls, counts = {}) {
    const w = this.layer.clientWidth, h = this.layer.clientHeight;
    if (!w || !h) return;
    for (const b of controls.buttons) {
      let el = this.items.get(b.name);
      if (!el) { el = this._disc(`btn btn-${b.name}`, b.label); this.items.set(b.name, el); }
      this._place(el, b.x, b.y, b.r, w, h);
      el.style.fontSize = `${Math.max(10, b.r * h * 0.42)}px`;
      el.classList.toggle("down", b.pressed);
      el.classList.toggle("toggle", b.name === "aim");
      if (b.name in counts) {
        const text = `${b.label}\n${counts[b.name]}`;
        if (el.textContent !== text) el.textContent = text;
        el.classList.toggle("none", counts[b.name] === 0);
      }
    }
    const r = controls.stickRadius, origin = controls.stickOrigin || controls.stickHome;
    this._place(this.base, origin[0], origin[1], r * 1.15, w, h);
    this._place(this.knob, origin[0] + controls.stickVec[0] * r, origin[1] + controls.stickVec[1] * r, r * 0.48, w, h);
  }
}
