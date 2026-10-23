// Intent = "người chơi muốn làm gì trong khung hình này".
// Bàn phím-chuột và cảm ứng đều chỉ tạo ra Intent; phần còn lại của game không cần biết thiết bị nào.
export function makeIntent(over = {}) {
  return {
    moveX: 0,          // -1 trái .. +1 phải
    moveZ: 0,          // -1 lùi .. +1 tiến
    lookYaw: 0,        // độ xoay ngang trong khung hình này
    lookPitch: 0,      // độ ngẩng/cúi (dương = cúi xuống)
    fire: false,       // đang giữ cò
    sprint: false,
    jump: false,       // các nút dưới đây chỉ true đúng 1 khung hình
    reload: false,
    switch: false,     // đổi sang súng kế tiếp
    select: null,      // chọn thẳng súng số mấy
    pause: false,
    aim: false,        // đang ngắm (giữ chuột phải / bật nút NGẮM)
    grenade: false,    // ném lựu đạn
    smoke: false,      // ném bom khói
    autoFire: false,   // cho phép tự bắn khi tâm ngắm trúng địch
    aimAssist: false,  // tự chỉnh tâm theo chiều dọc
    ...over,
  };
}
