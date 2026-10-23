// Dùng chung cho các phần dựng thế giới: bảng màu công trình, tiện ích màu, quầng sáng.
// Dựng hình bản đồ từ core/map.js: mặt đất, đường, công trình, rừng, bóng đổ, bầu trời, đèn.
// Mọi thứ nằm trong `root` dùng hệ trục của luật chơi (z hướng về bắc); root lật trục z cho khớp với Three.js.
// Gần như toàn bộ công trình được gộp vào vài lưới lớn nên điện thoại vẽ rất nhẹ.
import * as meshes from "../meshes.js";

export const T = window.THREE;
export const { Builder, hexRgb, boxTris } = meshes;
export const C = Object.fromEntries(Object.entries({
  steel: "#93a3a6", steelDark: "#6f7f85", base: "#5b6468", concrete: "#bdb7a8", slab: "#a9a495", rail: "#e0a91f",
  roof: "#7a4f3c", beam: "#4f5a63", wood: "#b98545", woodDark: "#8a5f2c", plank: "#7b858d", post: "#49535c",
  ramp: "#818b93", hazard: "#e98a1c", cab: "#b53b2d", glass: "#27323c", trailer: "#d7d6cf", tyre: "#1d1e21",
  asphalt: "#43464b", paint: "#ddd6bd", gravel: "#9a9482", tank: "#d9dbd6", band: "#c9482f", lamp: "#3b434b",
}).map(([k, v]) => [k, hexRgb(v)]));
export const shadeOf = (rgb, k) => rgb.map((v) => v * k);

export function glowTexture(inner, outer) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d"), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner); grad.addColorStop(0.35, outer); grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new T.CanvasTexture(c);
}
