// Bản đồ "Khu công nghiệp Phượng Hoàng": bốn khu chiến đấu quanh một ngã tư, bao bởi rừng thông.
//
//                 bắc (+z)
//     THÁP CANH   |   KHO HÀNG (2 tầng: tầng lửng + dốc lên)
//   ------------- + -------------   <- hai con đường cắt nhau ở giữa
//   BÃI CONTAINER |   BÃI XE
//
// Mọi công trình là các khối hộp thẳng trục (xem core/collide.js). Muốn sửa bản đồ: sửa các lệnh box/ramp ở dưới.
import { config } from "../config.js";
import { LAYOUT_DATA } from "./layoutData.js";
import { EXTRA_MAPS, MAP_INFO } from "./maps/index.js";

export const SPAWN = [0, -1.5];
export const DEFAULT_MAP = "phuong_hoang";
export { MAP_INFO };

/** Diện mạo mặc định (giờ vàng, rừng thông, núi tuyết): bản đồ nào không khai báo `theme` thì dùng cái này. */
export const DEFAULT_THEME = {
  sky: { top: config.SKY_TOP, mid: config.SKY_MID, horizon: config.SKY_HORIZON }, fog: config.FOG,
  sun: config.SUN, sunWarm: config.SUN_WARM, shadeCool: config.SHADE_COOL,
  grass: "#6aa24a", gravel: "#9a9482", asphalt: "#43464b",
  mountains: ["#6f8a8f", "#7b8f7a", "#64808c"], snowCaps: true, mountainShape: "cone",
  treeStyle: "pine", treeColors: ["#2f8f4a", "#3aa35a", "#257a52", "#4aa845"], clouds: 16, stars: false,
  sunColor: ["rgba(255,250,235,1)", "rgba(255,214,150,0.55)"], grassBlades: ["#5f9a3e", "#6fae45", "#4f8a38", "#7dba52"], lampBoost: 1,
};

/** Dựng bản đồ theo mã (xem MAP_INFO). Mã lạ thì trả về bản đồ gốc. */
export function buildMap(id = DEFAULT_MAP) {
  const map = EXTRA_MAPS[id] ? EXTRA_MAPS[id]() : buildPhoenix();
  map.theme = { ...DEFAULT_THEME, ...(map.theme || {}) };
  map.patches = map.patches || [];
  map.lights = map.lights || [];
  map.dirt = map.dirt || [];
  return map;
}

function buildPhoenix() {
  const blocks = [], decks = [], lamps = [], circles = [], props = [];
  const box = (kind, x0, z0, x1, z1, y0, y1, extra = {}) => {
    const b = { kind, x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), y0, y1, ...extra };
    blocks.push(b);
    return b;
  };
  // dốc: mặt trên đi từ `low` lên y1 theo trục `axis`, dir = 1 là cao dần về phía toạ độ lớn
  const ramp = (x0, z0, x1, z1, y1, axis, dir, low = 0) => box("ramp", x0, z0, x1, z1, 0, y1, { ramp: { axis, dir, low } });

  // ================= KHO HÀNG (đông bắc): x 8..28, z 8..22, cao 6 m =================
  const W = { x0: 8, x1: 28, z0: 8, z1: 22, t: 0.4, h: 6 };
  box("wall", W.x0, W.z0, 16, W.z0 + W.t, 0, W.h);                       // tường nam, chừa cửa lớn 4 m
  box("wall", 20, W.z0, W.x1, W.z0 + W.t, 0, W.h);
  box("wall", 16, W.z0, 20, W.z0 + W.t, 4, W.h);                         // lanh tô trên cửa
  box("wall", W.x0, W.z0, W.x0 + W.t, 13, 0, W.h);                       // tường tây, chừa cửa nhỏ
  box("wall", W.x0, 16, W.x0 + W.t, W.z1, 0, W.h);
  box("wall", W.x0, 13, W.x0 + W.t, 16, 2.6, W.h);
  box("wall", W.x0, W.z1 - W.t, W.x1, W.z1, 0, 4.2);                     // tường bắc: hai cửa sổ ở tầng lửng
  box("wall", W.x0, W.z1 - W.t, W.x1, W.z1, 5.4, W.h);
  for (const [a, b] of [[8, 12], [15, 21], [24, 28]]) box("wall", a, W.z1 - W.t, b, W.z1, 4.2, 5.4);
  box("wall", W.x1 - W.t, W.z0, W.x1, W.z1, 0, 1.1);                     // tường đông: một cửa sổ ngang tầm ngực
  box("wall", W.x1 - W.t, W.z0, W.x1, W.z1, 2.4, W.h);
  box("wall", W.x1 - W.t, W.z0, W.x1, 11, 1.1, 2.4);
  box("wall", W.x1 - W.t, 14, W.x1, W.z1, 1.1, 2.4);
  box("slab", 8.4, 16.5, 27.6, 21.6, 3.0, 3.25, { indoor: true });       // tầng lửng
  box("slab", 18, 14.2, 20.5, 16.5, 3.0, 3.25, { indoor: true });        // chiếu nghỉ đầu dốc
  ramp(11, 14.2, 18, 16.5, 3.25, "x", 1);                                // dốc lên tầng lửng
  box("rail", 8.4, 16.5, 11, 16.7, 3.25, 4.2);                           // lan can tầng lửng
  box("rail", 20.5, 16.5, 27.6, 16.7, 3.25, 4.2);
  box("roof", W.x0, 15, W.x1, W.z1, 6.0, 6.25);                          // mái che nửa bắc; nửa nam chỉ còn xà
  for (const z of [9.6, 11.4, 13.2]) box("beam", W.x0, z, W.x1, z + 0.3, 5.7, 6.0);
  for (const [x, z, n] of [[12, 10.5, 2], [13.4, 10.5, 1], [23, 11, 1], [24.4, 11, 2], [23.7, 12.5, 1], [25, 19, 1], [10, 19.4, 2], [22, 18.6, 1]]) {
    box("crate", x - 0.65, z - 0.65, x + 0.65, z + 0.65, 0, 1.3 * n);
  }
  box("crate", 24, 19.6, 25.3, 20.9, 3.25, 4.55);                        // thùng trên tầng lửng làm chỗ nấp
  decks.push({ id: "mezz", name: "tầng lửng", top: 3.25, areas: [[8.4, 16.5, 27.6, 21.6], [18, 14.2, 20.5, 16.5]],
    path: [[18, 5.5], [18, 10.5], [10.2, 15.35], [17.6, 15.35], [19.2, 18]] });

  // ================= BÃI CONTAINER (tây nam) =================
  const can = (x0, z0, x1, z1, tint, y0 = 0, y1 = 2.6) => box("container", x0, z0, x1, z1, y0, y1, { tint });
  can(-26, -12, -19.9, -9.56, "#2f8f83");                                // C1: có dốc lên nóc
  can(-26, -17, -19.9, -14.56, "#b5462f");                               // C2: nối với C1 bằng sàn thép
  can(-17, -20, -10.9, -17.56, "#2f5f9e");                               // C3 + C4 chồng đôi
  can(-17, -20, -10.9, -17.56, "#d9a323", 2.6, 5.2);
  can(-12, -13.4, -9.56, -7.3, "#4f8a3c");                               // C5 nằm dọc
  can(-24.4, -26.2, -21.96, -20.1, "#d8d4c8");                           // C6 nằm dọc
  can(-8.4, -24.5, -2.3, -22.06, "#7a4a9e");                             // C7 chắn phía nam
  ramp(-19.9, -12, -15.4, -9.56, 2.6, "x", -1);
  box("plank", -26, -14.56, -19.9, -12, 2.45, 2.6);                      // sàn thép nối kín hai nóc container
  decks.push({ id: "cans", name: "nóc container", top: 2.6, areas: [[-26, -17, -19.9, -9.56]],
    path: [[-14.4, -10.8], [-20.6, -10.8]] });
  for (const [x, z] of [[-15, -14.6], [-13.6, -14.6], [-19, -22.5]]) box("crate", x - 0.65, z - 0.65, x + 0.65, z + 0.65, 0, 1.3);

  // ================= THÁP CANH (tây bắc) =================
  box("slab", -22, 14, -16, 20, 3.35, 3.6);
  for (const [x, z] of [[-22, 14], [-16.4, 14], [-22, 19.6], [-16.4, 19.6]]) {
    box("post", x, z, x + 0.4, z + 0.4, 0, 3.35);
    box("post", x + 0.1, z + 0.1, x + 0.3, z + 0.3, 3.6, 5.8);
  }
  box("roof", -22.3, 13.7, -15.7, 20.3, 5.8, 6.0);
  box("rail", -22, 19.8, -16, 20, 3.6, 4.5);                             // tường chắn phía bắc và tây trên tháp
  box("rail", -22, 14, -21.8, 19.8, 3.6, 4.5);
  box("rail", -22, 14, -17.4, 14.2, 3.6, 4.5);
  ramp(-16, 15.2, -9.2, 17.2, 3.6, "x", -1);
  decks.push({ id: "tower", name: "tháp canh", top: 3.6, areas: [[-22, 14, -16, 20]], path: [[-8.4, 16.2], [-16.6, 16.2], [-19, 17]] });
  for (const [x, z] of [[-12, 21.5], [-10.6, 21.5], [-24.5, 11]]) box("crate", x - 0.65, z - 0.65, x + 0.65, z + 0.65, 0, 1.3);

  // ================= BÃI XE (đông nam) =================
  box("truck", 13.6, -16.1, 16.2, -13.5, 0, 2.7, { part: "cab" });
  box("truck", 16.5, -16.3, 24.2, -13.3, 0.95, 3.5, { part: "trailer" });
  box("truck", 17.2, -16.1, 18.6, -13.5, 0, 0.95, { part: "wheels" });
  box("truck", 21.6, -16.1, 23.6, -13.5, 0, 0.95, { part: "wheels" });
  const barrier = (x, z, along) => (along === "x" ? box("barrier", x - 1.5, z - 0.3, x + 1.5, z + 0.3, 0, 1.0)
    : box("barrier", x - 0.3, z - 1.5, x + 0.3, z + 1.5, 0, 1.0));
  for (const [x, z, a] of [[10.5, -8, "x"], [14, -8, "x"], [20, -9.5, "x"], [9, -21, "z"], [12, -24.5, "x"], [22.5, -22, "x"], [26, -11, "z"]]) barrier(x, z, a);
  circles.push([26, -19.5, 1.7, 3.4], [22.6, -26, 1.3, 2.6]);            // bồn chứa
  props.push({ kind: "tank", x: 26, z: -19.5, scale: 1.7 }, { kind: "tank", x: 22.6, z: -26, scale: 1.3 });

  // ================= NGÃ TƯ: chỗ nấp thấp quanh điểm xuất phát =================
  for (const [x, z, a] of [[-5.5, 6.5, "z"], [5.5, -6.5, "z"], [6.5, 5.2, "x"], [-6.5, -5.2, "x"], [-5.2, -11, "z"], [5.2, 12.5, "z"]]) barrier(x, z, a);

  // cột đèn dọc hai con đường
  for (const [x, z] of [[4.2, 9], [-4.2, -9], [9, -4.2], [-9, 4.2], [4.2, 30], [-4.2, -30], [30, 4.2], [-30, -4.2], [4.2, -20], [-20, 4.2]]) {
    lamps.push([x, z]);
    circles.push([x, z, 0.16, 5.2]);
  }

  // ================= RỪNG THÔNG: cây, đá, thùng của bản đồ cũ, bỏ những cái đè lên công trình và đường =================
  const zones = [
    { name: "KHO HÀNG", x0: 6, z0: 6, x1: 30, z1: 24 },
    { name: "BÃI CONTAINER", x0: -28, z0: -28, x1: -1, z1: -6 },
    { name: "THÁP CANH", x0: -26, z0: 9, x1: -7, z1: 24 },
    { name: "BÃI XE", x0: 7, z0: -28, x1: 29, z1: -6 },
    { name: "NGÃ TƯ", x0: -7, z0: -7, x1: 7, z1: 7 },
  ];
  const inZone = (x, z, pad) => zones.some((q) => x > q.x0 - pad && x < q.x1 + pad && z > q.z0 - pad && z < q.z1 + pad);
  LAYOUT_DATA.props.forEach(([kind, x, z, scale, rotation, look], i) => {
    if (inZone(x, z, 1.5) || Math.abs(x) < 5 || Math.abs(z) < 5) return;
    props.push({ kind, x, z, scale, rotation, look });
    const [, , r] = LAYOUT_DATA.obstacles[i];
    circles.push([x, z, r, kind === "tree" ? 9 : kind === "rock" ? scale * 1.0 : scale]);
  });

  // Nền nhà kho, thềm cửa, vạch cảnh báo (trước đây viết cứng trong phần vẽ)
  const patches = [
    { x0: 8, z0: 8, x1: 28, z1: 22, color: "#bdb7a8", k: 0.62, y: 0.025 },
    { x0: 15.6, z0: 5, x1: 20.4, z1: 8, color: "#bdb7a8", k: 0.85, y: 0.025 },
    { x0: 15.6, z0: 8, x1: 20.4, z1: 8.25, color: "#e98a1c", y: 0.04 },
  ];
  // Đèn treo trong và trước nhà kho: [x, y, z, cỡ, mặt sàn]
  const lights = [[13, 5.5, 11.5, 1.8], [23, 5.5, 11.5, 1.8]];
  for (const x of [12, 18, 24]) lights.push([x, 2.8, 19, 1.3], [x, 5.8, 19, 1.3, 3.25]);
  return { id: DEFAULT_MAP, name: "Khu công nghiệp", seed: LAYOUT_DATA.seed, blocks, decks, lamps, circles, props, zones, obstacles: circles,
    roads: [{ x0: -3.2, z0: -51, x1: 3.2, z1: 51 }, { x0: -51, z0: -3.2, x1: 51, z1: 3.2 }], spawn: SPAWN,
    patches, lights, crosswalk: true, menuLook: [6, 3.2, -8],
    dirt: [{ x0: -9, z0: -30, x1: 9, z1: 30 }, { x0: -30, z0: -9, x1: 30, z1: 9 }] };
}

/** Tên khu vực tại (x, z) để hiện trên HUD. */
export function zoneName(map, x, z) {
  for (const q of map.zones) if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1) return q.name;
  const wild = { phuong_hoang: ["RỪNG THÔNG", "KHU CÔNG NGHIỆP"], lang_que: ["VƯỜN CÂY", "LÀNG QUÊ"], sa_mac: ["SA MẠC", "TRẠM RADAR"], bang_gia: ["RỪNG TUYẾT", "CĂN CỨ"] }[map.id]
    || ["VÙNG HOANG", "KHU VỰC"];
  return Math.hypot(x, z) > 30 ? wild[0] : wild[1];
}
