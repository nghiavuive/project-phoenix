import { Rng } from "../rng.js";
import { finish, kit } from "./kit.js";

// =====================================================================================================
//  CĂN CỨ BĂNG GIÁ: đêm tuyết, ánh trăng xanh, đèn đường vàng
// =====================================================================================================
export function bangGia() {
  const k = kit(), rng = new Rng(3041);
  const { box, ramp, wall, crate } = k;
  k.roads.push({ x0: -3.2, z0: -51, x1: 3.2, z1: 51, color: "#9fb0c2", dash: false }, { x0: -51, z0: -3.2, x1: 51, z1: 3.2, color: "#9fb0c2", dash: false });
  k.dirt.push(k.rect(-8, -30, 8, 30), k.rect(-30, -8, 30, 8));

  // ----- Nhà chỉ huy (tây bắc): mái bằng, dốc lên mái từ phía tây -----
  const H = { x0: -14, x1: 2, z0: 10, z1: 22, h: 3.2 };
  wall("wall", H.x0, H.z0, H.x1, H.z0 + 0.4, H.h, [{ at: -6, w: 4, y0: 0, y1: 2.5 }], { tint: "#8794a4" });
  wall("wall", H.x0, H.z1 - 0.4, H.x1, H.z1, H.h, [{ at: -10, w: 1.6, y0: 1, y1: 2.1 }, { at: -2, w: 1.6, y0: 1, y1: 2.1 }], { tint: "#8794a4" });
  wall("wall", H.x0, H.z0 + 0.4, H.x0 + 0.4, H.z1 - 0.4, H.h, [{ at: 14, w: 1.6, y0: 1, y1: 2.1 }], { tint: "#8794a4" });
  wall("wall", H.x1 - 0.4, H.z0 + 0.4, H.x1, H.z1 - 0.4, H.h, [{ at: 16, w: 1.6, y0: 1, y1: 2.1 }], { tint: "#8794a4" });
  box("slab", H.x0, H.z0, H.x1, H.z1, H.h, H.h + 0.25, { tint: "#d8e2ec" });   // mái phủ tuyết
  box("rail", H.x0, H.z1 - 0.2, H.x1, H.z1, H.h + 0.25, H.h + 1.1, { tint: "#6d7a8a" });
  box("rail", H.x1 - 0.2, H.z0, H.x1, H.z1, H.h + 0.25, H.h + 1.1, { tint: "#6d7a8a" });
  ramp(-21.4, 15.2, -14.4, 18.4, H.h + 0.25, "x", 1);
  k.decks.push({ id: "hq", name: "mái nhà chỉ huy", top: H.h + 0.25, areas: [[H.x0, H.z0, H.x1, H.z1]], path: [[-22.2, 16.8], [-14.6, 16.8], [-8, 16.8]] });
  box("slab", -11, 14, -3, 15, 0, 0.9, { tint: "#4a5566" });               // bàn họp
  crate(-12, 20, 1, "#7a8aa0"); crate(-3, 20.6, 2, "#7a8aa0"); crate(0.5, 12.5, 1, "#7a8aa0");
  crate(-7, 17.5, 1, "#7a8aa0");
  k.zone("NHÀ CHỈ HUY", -23, 8, 4, 24);

  // ----- Đài truyền tin (đông bắc): sàn cao 5 m, dốc lên từ phía đông, cột ăng-ten cao -----
  for (const [x, z] of [[22.4, 10.4], [29.6, 10.4], [22.4, 17.6], [29.6, 17.6]]) k.post(x, z, 0, 4.75, 0.6, "#5a6674");
  box("slab", 22, 10, 30, 18, 4.75, 5.0, { tint: "#7a8696" });
  box("rail", 22, 17.8, 30, 18, 5.0, 5.9, { tint: "#5a6674" });
  box("rail", 22, 10, 22.2, 18, 5.0, 5.9, { tint: "#5a6674" });
  box("rail", 22, 10, 30, 10.2, 5.0, 5.9, { tint: "#5a6674" });
  ramp(30.4, 13, 38, 16, 5.0, "x", -1);
  k.decks.push({ id: "mast", name: "đài truyền tin", top: 5, areas: [[22, 10, 30, 18]], path: [[38.8, 14.5], [29.6, 14.5], [26, 14]] });
  k.post(26, 14, 5, 17, 0.7, "#8a96a6");
  k.lights.push([26, 17.4, 14, 2.4]);
  crate(24, 12, 1, "#7a8aa0"); crate(28, 16, 1, "#7a8aa0");
  k.zone("ĐÀI TRUYỀN TIN", 20, 8, 40, 20);

  // ----- Kho nhiên liệu (tây nam): bồn trụ, thùng, hàng rào chắn -----
  for (const [x, z, s] of [[-26, -12, 1.8], [-26, -19, 1.8], [-18, -24, 1.4]]) { k.circles.push([x, z, s, s * 2]); k.props.push({ kind: "tank", x, z, scale: s }); }
  for (const [x, z, a] of [[-32, -8, "z"], [-20, -8, "x"], [-12, -18, "z"], [-8, -26, "x"]]) k.barrier(x, z, a, "#c8d4e0");
  crate(-15, -13, 1, "#6a7a90"); crate(-13.6, -13, 1, "#6a7a90"); crate(-14.3, -13, 2, "#6a7a90");
  k.zone("KHO NHIÊN LIỆU", -35, -28, -6, -6);

  // ----- Nhà chứa máy bay (đông nam): không có tường trước, mái cao -----
  box("wall", 10, -28, 30, -27.6, 0, 5.5, { tint: "#7b8798" });
  box("wall", 10, -28, 10.4, -17, 0, 5.5, { tint: "#7b8798" });
  box("wall", 29.6, -28, 30, -17, 0, 5.5, { tint: "#7b8798" });
  box("roof", 9.5, -28.4, 30.5, -16.5, 5.5, 5.8, { tint: "#d8e2ec" });
  k.truck(14, -24, true, "#c1452f");
  crate(26, -20, 2, "#7a8aa0");
  for (const [x, z, a] of [[20, -13, "x"], [26, -13, "x"], [34, -22, "z"]]) k.barrier(x, z, a, "#c8d4e0");
  k.zone("NHÀ CHỨA MÁY", 8, -29, 33, -11);

  // ----- Hồ đóng băng (tây bắc xa): mặt băng xanh nhạt, đi qua được -----
  k.patches.push({ disc: [-30, 30, 9], color: "#b8d8ec", y: 0.03, water: true }, { disc: [-30, 30, 9.8], color: "#dfe9f2", y: 0.015 });
  k.zone("HỒ BĂNG", -42, 20, -18, 42);

  // ----- Đống tuyết: dốc thoải đi lên được -----
  for (const [x0, z0, x1, z1, axis, dir] of [[8, 26, 20, 32, "z", -1], [-40, -4, -34, 8, "x", 1], [34, -8, 44, -2, "z", 1], [-6, -38, 6, -32, "z", -1]]) {
    ramp(x0, z0, x1, z1, 0.5, axis, dir, 0, { tint: "#eef4f9", dune: true });
  }
  for (const [x, z] of [[4.2, 12], [-4.2, -12], [12, -4.2], [-12, 4.2], [4.2, 28], [-4.2, -28], [28, 4.2], [-28, -4.2], [4.2, -20], [-20, 4.2], [-4.2, 20], [20, -4.2]]) k.lamp(x, z);
  for (const [x, z, a] of [[-5.5, 6.5, "z"], [5.5, -6.5, "z"], [6.5, 5.2, "x"], [-6.5, -5.2, "x"]]) k.barrier(x, z, a, "#c8d4e0");
  k.zone("QUẢNG TRƯỜNG", -8, -8, 8, 8);

  const avoid = [...k.zones, k.rect(-4, -52, 4, 52), k.rect(-52, -4, 52, 4), k.rect(-9, -9, 9, 9)];
  k.scatter(rng, { count: 44, kind: "tree", avoid, scale: [0.9, 1.6], radius: 0.4 });
  k.scatter(rng, { count: 10, kind: "rock", avoid, gap: 3, scale: [0.7, 1.4], radius: 1, height: 1.3 });

  return finish(k, "bang_gia", "Căn cứ băng giá", {
    seed: 3041, spawn: [0, -3], crosswalk: false,
    theme: {
      sky: { top: "#050a1c", mid: "#14223f", horizon: "#33466b" }, fog: ["#0d1830", 38, 150],
      sun: [-0.45, 0.72, 0.5], sunWarm: [0.4, 0.5, 0.78], shadeCool: [0.2, 0.25, 0.38],
      grass: "#e8eff6", gravel: "#b6c5d4", asphalt: "#9fb0c2",
      mountains: ["#4a5a78", "#55668a", "#44547a"], snowCaps: true, treeStyle: "pine",
      treeColors: ["#dfeaf0", "#cfe0e8", "#bcd2de"], rockTint: "#aebccb", clouds: 0, stars: true,
      sunColor: ["rgba(235,244,255,1)", "rgba(170,200,255,0.55)"], grassBlades: ["#d5e2ee", "#c5d6e6"], lampBoost: 1.6,
    },
  });
}
