import { Rng } from "../rng.js";
import { finish, kit } from "./kit.js";

// =====================================================================================================
//  LÀNG QUÊ: chiều nắng đẹp, mái ngói đỏ, ao sen, ruộng lúa, đình làng
// =====================================================================================================
export function langQue() {
  const k = kit(), rng = new Rng(7011);
  const { box, ramp, house, wall, crate } = k;
  k.roads.push({ x0: -3, z0: -51, x1: 3, z1: 51, color: "#a8895a", dash: false }, { x0: -51, z0: -3, x1: 51, z1: 3, color: "#a8895a", dash: false });
  k.dirt.push(k.rect(-8, -30, 8, 30), k.rect(-30, -8, 30, 8));

  // ----- Đình làng (tây bắc): nền cao 0.45 m, mái cong nhiều bậc trên cột gỗ, tường hậu, lan can bên hông -----
  k.stairs(-23, 9, -7, 11.5, "z", 1, 1, 0.45, "#a89b86");                  // bậc thềm phía nam
  box("slab", -22, 11.5, -8, 24.5, 0, 0.45, { tint: "#a89b86" });         // nền đình
  for (const x of [-21.2, -15, -8.8]) for (const z of [12.2, 18, 23.8]) k.post(x, z, 0.45, 3.4, 0.5, "#7a3b24");
  wall("wall", -22, 24, -8, 24.4, 3.4, [], { tint: "#8a4a2c" }, 0.45);      // tường hậu
  box("rail", -22, 12, -21.8, 24, 0.45, 1.4, { tint: "#7a3b24" });          // lan can hai bên (chỗ nấp)
  box("rail", -8.2, 12, -8, 24, 0.45, 1.4, { tint: "#7a3b24" });
  k.stepRoof(-22, 11.5, -8, 24.5, 3.4, "#a2432b", 0.9);
  box("crate", -16, 21.4, -14, 23.4, 0.45, 1.5, { tint: "#b8352a" });      // bàn thờ
  crate(-19.5, 15.5, 1, "#8a6a3a"); crate(-10.5, 15.5, 1, "#8a6a3a");
  k.zone("ĐÌNH LÀNG", -24, 9, -6, 26);

  // ----- Xóm tây (tây nam): bốn ngôi nhà mái ngói quanh sân, cửa hướng ra đường -----
  house(-31, -14, -22, -8, { door: "n", tint: "#e0d3b8", roof: "#9a4b34" });
  house(-19, -14, -11, -8, { door: "n", tint: "#d8c9a8", roof: "#8e4630" });
  house(-31, -27, -23, -21, { door: "e", tint: "#cfc2a4", roof: "#a24d36" });
  house(-18, -28, -10, -21, { door: "n", tint: "#ddd0b6", roof: "#9a4b34" });
  box("crate", -27.5, -18.2, -25.3, -16, 0, 1.7, { tint: "#d6b04a" });      // đống rơm
  box("crate", -14.5, -19.5, -12.3, -17.3, 0, 1.7, { tint: "#d6b04a" });
  crate(-21.5, -17, 1, "#a07840"); crate(-8.5, -13, 1, "#a07840");
  k.zone("XÓM TÂY", -33, -30, -8, -9);

  // ----- Xóm đông bắc (cạnh ao): hai nhà -----
  house(8, 9, 16, 15, { door: "s", tint: "#dccfb3", roof: "#9a4b34" });
  house(30, 18, 38, 24, { door: "w", tint: "#d3c4a4", roof: "#8e4630" });
  k.zone("XÓM ĐÔNG", 6, 7, 40, 26);

  // ----- Ao sen: vật cản thấp (nhảy qua được), mặt nước là mảng màu -----
  k.circles.push([22, 24, 6.2, 0.35]);
  k.patches.push({ disc: [22, 24, 6.8], color: "#4c8fae", y: 0.03, water: true }, { disc: [22, 24, 7.6], color: "#7a6a48", y: 0.015 });
  for (let i = 0; i < 12; i++) {
    const a = rng.uniform(0, 6.28), d = rng.uniform(0.5, 5.4);
    k.patches.push({ disc: [22 + Math.cos(a) * d, 24 + Math.sin(a) * d, rng.uniform(0.35, 0.7)], color: i % 3 ? "#4f9a4f" : "#e8a0b8", y: 0.05, water: true });
  }
  k.zone("AO SEN", 13, 15, 31, 33);

  // ----- Ruộng lúa (đông nam): ô lúa, bờ ruộng thấp (đi qua được), đống rơm làm chỗ nấp -----
  for (const [x0, z0, x1, z1, c] of [[10, -18, 36, -12, "#a8d24e"], [10, -25, 36, -19, "#c4d65e"], [10, -32, 36, -26, "#9ac846"]]) {
    k.patches.push({ x0, z0, x1, z1, color: c, y: 0.02 });
  }
  for (const z of [-18.5, -25.5]) box("plank", 10, z - 0.25, 36, z + 0.25, 0, 0.45, { tint: "#8a6a3a" });
  for (const x of [10, 23, 36]) box("plank", x - 0.25, -32, x + 0.25, -12, 0, 0.45, { tint: "#8a6a3a" });
  for (const [x, z] of [[16, -22], [29, -28], [22, -15], [32, -21]]) box("crate", x - 1.1, z - 1.1, x + 1.1, z + 1.1, 0, 1.7, { tint: "#d6b04a" });
  k.zone("RUỘNG LÚA", 9, -34, 38, -11);

  // ----- Tháp nước (đông): sàn cao 4.3 m, dốc lên từ phía đông -----
  for (const [x, z] of [[31.3, 1.3], [36.7, 1.3], [31.3, 6.7], [36.7, 6.7]]) k.post(x, z, 0, 4.05, 0.55, "#8a8f95");
  box("slab", 31, 1, 37, 7, 4.05, 4.3, { tint: "#a9adb2" });
  box("rail", 31, 6.8, 37, 7, 4.3, 5.2, { tint: "#8a8f95" });
  box("rail", 31, 1, 37, 1.2, 4.3, 5.2, { tint: "#8a8f95" });
  box("rail", 31, 1, 31.2, 7, 4.3, 5.2, { tint: "#8a8f95" });
  ramp(37, 2.6, 44, 5.4, 4.3, "x", -1);
  k.decks.push({ id: "wtower", name: "tháp nước", top: 4.3, areas: [[31, 1, 37, 7]], path: [[44.8, 4], [36.4, 4], [34, 4]] });
  box("slab", 32.4, 2.4, 35.6, 5.6, 4.3, 6.6, { tint: "#9fb4c4" });                       // bồn nước trên sàn tháp
  k.zone("THÁP NƯỚC", 29, -1, 46, 9);

  // ----- Sân làng: cây đa giữa ngã tư làm chỗ nấp, cột đèn -----
  for (const [x, z, a] of [[-5.5, 5.5, "z"], [5.5, -6, "z"], [6, 5.5, "x"], [-6, -5.5, "x"]]) k.barrier(x, z, a, "#8a6a3a");
  for (const [x, z] of [[4.2, 12], [-4.2, -12], [12, -4.2], [-12, 4.2], [4.2, -30], [-4.2, 30], [30, 4.2], [-30, -4.2]]) k.lamp(x, z);
  k.zone("SÂN LÀNG", -8, -8, 8, 8);

  const avoid = [...k.zones, k.rect(-4, -52, 4, 52), k.rect(-52, -4, 52, 4), k.rect(-8, -8, 8, 8)];
  k.scatter(rng, { count: 46, kind: "tree", avoid, scale: [0.9, 1.5], radius: 0.4 });
  k.scatter(rng, { count: 12, kind: "rock", avoid, gap: 3, scale: [0.7, 1.4], radius: 1, height: 1.3 });

  return finish(k, "lang_que", "Làng quê", {
    seed: 7011, spawn: [0, -3], crosswalk: false,
    theme: {
      sky: { top: "#3d86d1", mid: "#a9d6f0", horizon: "#f5e6c8" }, fog: ["#dcebd6", 85, 250],
      sun: [0.5, 0.78, -0.38], sunWarm: [0.8, 0.7, 0.5], shadeCool: [0.42, 0.48, 0.6],
      grass: "#74b04c", gravel: "#b09a6c", asphalt: "#a8895a",
      mountains: ["#6f9a7a", "#7fa882", "#5f8f78"], snowCaps: false, treeStyle: "round",
      treeColors: ["#3f9a4a", "#4fae54", "#2f8a45", "#63b955"], clouds: 22,
    },
  });
}
