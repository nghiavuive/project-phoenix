import { Rng } from "../rng.js";
import { finish, kit } from "./kit.js";

// =====================================================================================================
//  SA MẠC: nắng gắt giữa trưa, trạm radar, giàn khoan, hẻm núi
// =====================================================================================================
export function saMac() {
  const k = kit(), rng = new Rng(9023);
  const { box, ramp, wall, crate } = k;
  k.roads.push({ x0: -51, z0: -3, x1: 51, z1: 3, color: "#b39a6a", dash: false }, { x0: -3, z0: -51, x1: 3, z1: 0, color: "#b39a6a", dash: false });
  k.dirt.push(k.rect(-51, -9, 51, 9), k.rect(-9, -40, 9, 0));

  // ----- Trạm radar (đông bắc): nhà bê tông mái bằng, dốc lên mái, cột và chảo radar -----
  const B = { x0: 10, x1: 28, z0: 12, z1: 22, h: 3.5 };
  wall("wall", B.x0, B.z0, B.x1, B.z0 + 0.4, B.h, [{ at: 19, w: 4, y0: 0, y1: 2.6 }], { tint: "#d4ccb8" });
  wall("wall", B.x0, B.z1 - 0.4, B.x1, B.z1, B.h, [{ at: 14, w: 1.6, y0: 1, y1: 2.1 }, { at: 24, w: 1.6, y0: 1, y1: 2.1 }], { tint: "#d4ccb8" });
  wall("wall", B.x0, B.z0 + 0.4, B.x0 + 0.4, B.z1 - 0.4, B.h, [{ at: 17, w: 1.6, y0: 1, y1: 2.1 }], { tint: "#d4ccb8" });
  wall("wall", B.x1 - 0.4, B.z0 + 0.4, B.x1, B.z1 - 0.4, B.h, [{ at: 17, w: 1.6, y0: 1, y1: 2.1 }], { tint: "#d4ccb8" });
  box("slab", B.x0, B.z0, B.x1 + 0.4, B.z1, B.h, B.h + 0.3, { tint: "#bfb7a2" });
  box("rail", B.x0, B.z1 - 0.2, B.x1, B.z1, B.h + 0.3, B.h + 1.2, { tint: "#a9a290" });
  box("rail", B.x0, B.z0, B.x1, B.z0 + 0.2, B.h + 0.3, B.h + 1.2, { tint: "#a9a290" });
  ramp(28.4, 15, 35.4, 18.6, B.h + 0.3, "x", -1);
  k.decks.push({ id: "bunker", name: "mái trạm radar", top: B.h + 0.3, areas: [[B.x0, B.z0, B.x1 + 0.4, B.z1]], path: [[36.2, 16.8], [27.8, 16.8], [22, 17]] });
  k.post(19, 17, B.h + 0.3, 8.6, 1.0, "#cfc9b8");                         // cột radar
  box("slab", 15.5, 15.6, 22.5, 18.4, 8.6, 8.95, { tint: "#ece9e0" });     // chảo radar
  crate(13, 14.5, 1, "#6b7a4e"); crate(25, 20, 2, "#6b7a4e");
  crate(12, 17.5, 1, "#6b7a4e"); crate(18, 14, 1, "#7a6a4a");
  for (const [x, z, a] of [[8, 8.5, "x"], [14, 8.5, "x"], [26, 8.5, "x"], [32, 9, "z"], [38, 22, "z"], [30, 26.5, "x"], [20, 26.5, "x"]]) k.barrier(x, z, a, "#c9b27a");
  k.zone("TRẠM RADAR", 7, 8, 38, 28);

  // ----- Giàn khoan dầu (tây bắc): sàn cao 4.25 m, dốc lên từ phía nam, cột tháp cao -----
  for (const [x, z] of [[-29.5, 10.5], [-22.5, 10.5], [-29.5, 17.5], [-22.5, 17.5]]) k.post(x, z, 0, 4.0, 0.6, "#8a5a3a");
  box("slab", -30, 10, -22, 18, 4.0, 4.25, { tint: "#7a6a58" });
  box("rail", -30, 17.8, -22, 18, 4.25, 5.1, { tint: "#6a5a48" });
  box("rail", -30, 10, -29.8, 18, 4.25, 5.1, { tint: "#6a5a48" });
  box("rail", -22.2, 10, -22, 18, 4.25, 5.1, { tint: "#6a5a48" });
  ramp(-28, 3.6, -25, 10, 4.25, "z", 1);
  k.decks.push({ id: "derrick", name: "giàn khoan", top: 4.25, areas: [[-30, 10, -22, 18]], path: [[-26.5, 3.2], [-26.5, 10.6], [-26.5, 14]] });
  k.post(-26, 14, 4.25, 12, 0.8, "#9a4a2a");
  box("slab", -27.5, 13.4, -24.5, 14.6, 11.4, 11.8, { tint: "#7a3a22" });
  crate(-33, 6, 2, "#5f5a52"); crate(-19, 14, 1, "#5f5a52");
  k.zone("GIÀN KHOAN", -34, 3, -18, 20);

  // ----- Hẻm núi (tây nam): hai vách đá chừa một lối hẹp 6 m -----
  for (const [x0, z0, x1, z1] of [[-46, -27, -31, -23], [-25, -27, -9, -23]]) {
    box("wall", x0, z0, x1, z1, 0, 7, { tint: "#b0825a" });
    box("wall", x0 + 1.2, z0 + 0.4, x1 - 1.2, z1 - 0.4, 7, 9.5, { tint: "#a8764f" });
  }
  box("wall", -44, -30, -9, -27.4, 0, 5.5, { tint: "#9c6f4a" });          // vách sau
  k.zone("HẺM NÚI", -47, -31, -8, -22);

  // ----- Trại lính (giữa tây nam): lều vải trên cột, thùng đạn, bao cát -----
  for (const [cx, cz, w, d] of [[-15, -11, 6, 5], [-6, -17, 5, 5], [-22, -17, 5, 4]]) {
    for (const [px, pz] of [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx - w / 2, cz + d / 2], [cx + w / 2, cz + d / 2]]) k.post(px, pz, 0, 2.3, 0.25, "#5a4a32");
    k.stepRoof(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, 2.3, "#7f8f5e", 0.4);
  }
  crate(-15, -11, 1, "#6b7a4e"); crate(-6.6, -17.5, 2, "#6b7a4e"); crate(-22, -17.5, 1, "#6b7a4e");
  for (const [x, z, a] of [[-11, -7.4, "x"], [-3.5, -12, "z"], [-19, -12, "z"]]) k.barrier(x, z, a, "#c9b27a");
  k.zone("TRẠI LÍNH", -26, -22, -2, -7);

  // ----- Bãi xe hỏng (đông nam): xe tải bỏ lại, thùng phuy -----
  k.truck(13, -14, true, "#8a4a2a");
  k.truck(11, -21, true, "#7a6a4a");
  for (const [x, z] of [[26, -10], [28.5, -12], [27, -15.5]]) box("crate", x - 0.6, z - 0.6, x + 0.6, z + 0.6, 0, 1.15, { tint: "#a8452e" });   // thùng phuy
  for (const [x, z, a] of [[30, -20, "z"], [20, -26, "x"]]) k.barrier(x, z, a, "#c9b27a");
  k.zone("BÃI XE HỎNG", 8, -27, 32, -8);

  // ----- Đường ống dẫn dầu: các đoạn dài chạy ngang, chừa 3 chỗ cho địch đi qua -----
  for (const [a, b] of [[-46, -34], [-28, -12], [-5, 8], [14, 26], [32, 46]]) box("pipe", a, 24.2, b, 25, 0, 1.0, { tint: "#6d7378" });

  // ----- Cồn cát: dốc thoải (≤ 0.55 m) đi lên được -----
  for (const [x0, z0, x1, z1, axis, dir] of [[-44, 8, -36, 24, "x", 1], [32, -34, 44, -28, "z", -1], [-4, -40, 4, -30, "z", 1], [36, 4, 46, 12, "x", -1]]) {
    ramp(x0, z0, x1, z1, 0.55, axis, dir, 0, { tint: "#d9b46c", dune: true });
  }

  const avoid = [...k.zones, k.rect(-52, -4, 52, 4), k.rect(-4, -52, 4, 2), k.rect(-9, -9, 9, 9)];
  k.scatter(rng, { count: 34, kind: "cactus", avoid, scale: [0.8, 1.5], radius: 0.5, height: 3 });
  k.scatter(rng, { count: 22, kind: "rock", avoid, gap: 3, scale: [0.7, 1.5], radius: 1, height: 1.3 });

  return finish(k, "sa_mac", "Trạm radar sa mạc", {
    seed: 9023, spawn: [0, -4], crosswalk: false,
    theme: {
      sky: { top: "#4f97d6", mid: "#e4d3ab", horizon: "#f5deb4" }, fog: ["#ecd5a8", 70, 230],
      sun: [0.32, 0.92, -0.22], sunWarm: [0.92, 0.8, 0.52], shadeCool: [0.46, 0.45, 0.5],
      grass: "#d9b46c", gravel: "#bf9d62", asphalt: "#b39a6a",
      mountains: ["#b5835a", "#c08f62", "#a87550"], snowCaps: false, mountainShape: "mesa",
      treeStyle: "dead", treeColors: ["#7a6a4a"], rockTint: "#b89a72", clouds: 8, grassBlades: ["#b79a58", "#c4a862", "#a88a4c"],
    },
  });
}
