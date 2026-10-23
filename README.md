# Project Phoenix - bản web

Game bắn súng góc nhìn thứ nhất phong cách low-poly, chạy thẳng trong trình duyệt trên máy tính và điện thoại.

- **Chơi một máy:** Sinh tồn, Đoàn kết với 2 đồng đội máy, PvP với 3 đối thủ máy, **Nhiệm vụ** có mục tiêu.
- **4 bản đồ:** Khu công nghiệp, Làng quê, Trạm radar sa mạc, Căn cứ băng giá (đêm tuyết).
- **8 nhiệm vụ** trên cả 4 bản đồ: thu thập dữ liệu, giữ chốt, hạ trùm, rút lui; xong nhiệm vụ trước mới mở nhiệm vụ sau, tối đa 3 sao mỗi nhiệm vụ.
- **Đồ hoạ cao:** bóng đổ thật (nắng chiếu qua cửa, mái, cây), vân bề mặt, cỏ, mây, bầu trời đêm có sao. Điện thoại tự dùng mức thấp cho nhẹ.
- **Phòng riêng qua mạng:** tạo phòng Đoàn kết hoặc PvP trên bản đồ bạn chọn, đọc mã 4 số cho bạn bè, tối đa 6 người.
- Bản đồ nhiều tầng, 8 vũ khí + lựu đạn + bom khói, ngắm bắn, bắn tỉa có ống ngắm.

## Chạy game

Cần Node.js 18 trở lên.

```
npm install
npm start
```

Mở `http://localhost:8080`. Chương trình này làm hai việc cùng lúc: phát trang game và làm máy chủ phòng.

- **Chơi chung trong cùng wifi:** các máy khác mở `http://<địa chỉ IP của máy đang chạy>:8080` (ví dụ `http://192.168.1.107:8080`), vào **Phòng riêng**. Không cần đưa gì lên mạng.
- **Chỉ chơi một máy, không cần phòng:** có thể đăng riêng `index.html` + thư mục `js/` lên bất kỳ dịch vụ web tĩnh nào.

## Đưa lên Internet để chơi khác mạng

Cần một dịch vụ chạy được Node.js và cho kết nối WebSocket. Dưới đây là các bước với Render (render.com), gói miễn phí; tên nút trên trang của họ có thể khác đôi chút theo thời gian.

1. **Đưa mã lên GitHub.** Tạo tài khoản github.com, tạo một repository mới, rồi tải toàn bộ thư mục này lên (kéo thả vào trang "uploading an existing file" là được). **Không** tải thư mục `node_modules`.
2. **Tạo dịch vụ trên Render.** Đăng nhập render.com bằng tài khoản GitHub, chọn New, Web Service, chọn repository vừa tạo. Điền:
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: `Free`
3. **Chờ triển khai xong**, Render cấp một địa chỉ dạng `https://ten-thay-dat.onrender.com`. Đó là địa chỉ game: gửi cho bạn bè, ai cũng mở địa chỉ này.
4. **Chơi:** một người vào Phòng riêng, bấm Tạo phòng, đọc mã 4 số; những người khác vào Phòng riêng, nhập mã, bấm Vào phòng; chủ phòng bấm Bắt đầu.

File `render.yaml` kèm theo đã khai sẵn các thông số trên, Render có thể tự đọc.

**Giới hạn của gói miễn phí Render** (theo tài liệu của họ, xem tại https://render.com/docs/free vào thời điểm viết):
- Không ai dùng trong 15 phút thì dịch vụ ngủ; người đầu tiên mở lại phải chờ khoảng một phút. Đang có người chơi thì không ngủ.
- 750 giờ chạy miễn phí mỗi tháng cho cả tài khoản.

Dịch vụ khác (Railway, Fly.io, máy chủ thuê riêng...) cũng dùng được: chỉ cần chạy `npm install` rồi `npm start`, cổng lấy từ biến môi trường `PORT`.

**Nên biết:**
- Máy mỗi người tự báo "tôi đang đứng đâu" và "tôi bắn trúng ai"; máy chủ giữ máu, điểm, địch. Chơi mượt nhưng không chống gian lận, hợp với nhóm bạn, không hợp mở công khai.
- Ai có địa chỉ game đều tạo được phòng; muốn vào phòng người khác thì phải biết mã. Phòng trống quá một phút tự đóng. Trận đang đánh không nhận thêm người.
- Trang xuất bản trên Claude chặn kết nối ra ngoài, nên ở đó chỉ chơi được với máy.

## Điều khiển

| Việc | Máy tính | Điện thoại |
|---|---|---|
| Di chuyển | W A S D | Ngón trái: cần ảo |
| Nhìn | Chuột | Ngón phải: vuốt (hoặc kéo trên nút BẮN) |
| Bắn / đánh | Chuột trái | Nút BẮN; tự bắn khi tâm ngắm trúng địch |
| Ngắm | Giữ chuột phải (hoặc Ctrl trái, V) | Nút NGẮM (bấm bật, bấm lần nữa tắt) |
| Đổi vũ khí | Phím 1-8, Q, lăn chuột | Chạm vào ô trên thanh vũ khí, hoặc nút ĐỔI |
| Lựu đạn / Bom khói | G / F | Nút LỰU / KHÓI |
| Chạy | Shift | Đẩy cần ảo hết cỡ về trước |
| Nhảy / Nạp đạn | Space / R | Nút NHẢY / NẠP |
| Tạm dừng | Esc hoặc P | Nút II |

Game tự nhận ra màn hình cảm ứng; nút "Điều khiển" trong menu để đổi tay.

## Vũ khí

Có sẵn cả 8 món từ đầu trận; súng lục đạn vô hạn, các súng khác đạn có hạn và được thêm khi nhặt hộp đạn (viên vàng).
Ngắm thì đạn chụm hơn và giật ít hơn nhưng đi chậm; chạy, nhảy hoặc bắn liên tục thì đạn toè ra (tâm ngắm nở theo).

| Phím | Vũ khí | Sát thương | Nhịp | Băng / dự trữ | Dùng khi |
|---|---|---|---|---|---|
| 1 | Súng lục | 34 | 0,22 s | 12 / vô hạn | Hết đạn các súng khác |
| 2 | Súng trường AK | 25 | 0,11 s | 30 / 150 | Đa dụng |
| 3 | Tiểu liên SMG | 15 | 0,065 s | 35 / 140 | Xả đạn tầm gần |
| 4 | Shotgun | 14 x 8 viên | 0,75 s | 6 / 18 | Sát mặt |
| 5 | Bắn tỉa | 150 | 1,3 s | 5 / 10 | Tầm xa, trùm |
| 6 | Súng máy | 22 | 0,085 s | 80 / 80 | Giữ chốt, nạp rất lâu |
| 7 | Chảo | 90, quét góc 100° | 0,55 s | - | Cận chiến; **đỡ được đạn bắn từ phía trước** |
| 8 | Dao | 55, góc 60° | 0,28 s | - | Cận chiến nhanh |

- **Lựu đạn** (đầu trận có 2, tối đa 4): nổ sau 2,2 giây, bán kính 6,5 m, nảy khỏi vật cản. Đứng gần là mình cũng dính.
- **Bom khói** (đầu trận có 1, tối đa 3): toả khói 12 giây. Địch bị khói che sẽ mất dấu, xạ thủ ngừng bắn.
- Địch chết có thể rơi: máu (xanh lá), đạn (vàng), lựu đạn (cam), bom khói (xám).

Muốn chỉnh hay thêm vũ khí: `js/core/weapons.js` (thông số) và `MODELS` trong `js/game/arsenal.js` (hình). Thông số lựu đạn, khói ở cuối `js/config.js`.

## Bản đồ, nhiệm vụ và đồ hoạ

### Bốn bản đồ
| Bản đồ | Mã | Đặc điểm |
|---|---|---|
| Khu công nghiệp | `phuong_hoang` | Giờ vàng. Nhà kho hai tầng, bãi container, tháp canh (mô tả chi tiết ở phần dưới) |
| Làng quê | `lang_que` | Nắng chiều. Đình làng trên nền cao, 7 nhà mái ngói có cửa và cửa sổ (trong nhà tối, ngoài sáng), ao sen, ruộng lúa, tháp nước leo lên được |
| Trạm radar sa mạc | `sa_mac` | Nắng gắt giữa trưa. Trạm radar mái bằng có dốc lên mái, giàn khoan, hẻm núi hẹp, lều trại, bãi xe hỏng, đường ống chừa lối |
| Căn cứ băng giá | `bang_gia` | Đêm tuyết, ánh trăng xanh, đèn đường vàng. Nhà chỉ huy, đài truyền tin cao 5 m, kho nhiên liệu, nhà chứa máy bay, hồ băng |

Chọn bản đồ ở màn hình chính (cho Sinh tồn, Đoàn kết, PvP và cả phòng riêng). Nhiệm vụ dùng bản đồ riêng của nó.
Bản đồ khai báo trong `js/core/map.js` (bản gốc) và thư mục `js/core/maps/` (mỗi bản đồ mới một file: `lang_que.js`, `sa_mac.js`, `bang_gia.js`; bộ dụng cụ chung ở `kit.js`: tường có cửa, nhà mái bậc, bậc thang, xe tải, rải cây). Mỗi bản đồ có `theme` riêng (màu trời, nắng, sương, cây, núi). Muốn thêm bản đồ: tạo một file trong `maps/` rồi thêm vào `EXTRA_MAPS` và `MAP_INFO` ở `maps/index.js`; `npm test` sẽ tự kiểm tra bản đồ mới đi được, địch không bị nhốt.

> Cửa nhà phải rộng từ khoảng 2 m trở lên, nếu không bộ tìm đường coi là tường và địch sinh ra trong nhà sẽ đứng chết dí.

### Tám nhiệm vụ
Khai báo trong `js/core/missions.js`. Mỗi nhiệm vụ gồm một hoặc nhiều **chặng** làm lần lượt, trong lúc các đợt địch vẫn kéo tới.

| Loại chặng | Việc phải làm |
|---|---|
| `kill` | Hạ một số kẻ địch |
| `survive` | Trụ lại một số giây |
| `collect` | Nhặt hết các hộp dữ liệu (đi sát là nhặt, có cột sáng xanh chỉ đường) |
| `hold` | Đứng trong vòng sáng đủ số giây (ra ngoài thì tiến độ tụt dần) |
| `reach` | Chạy tới điểm rút |
| `boss` | Hạ các Đồ tể vừa xuất hiện |

Sao: ★ hoàn thành · ★★ nhanh hơn thời gian chuẩn · ★★★ và còn từ 60 máu, không gục lần nào. Tiến độ và sao lưu trong trình duyệt.
Trong trận có dòng mục tiêu ở góc trên trái (chữ, tiến độ, khoảng cách), điểm sáng trên radar và cột sáng trong thế giới (mờ dần khi bạn đã tới gần).

### Đồ hoạ
Hai mức, chọn ở Cài đặt (Tự động / Cao / Thấp; đổi sẽ tải lại trang):
- **Cao** (máy tính): vật liệu nhận đèn, nắng có bản đồ bóng 2048 px bám theo máy quay, mép bóng mềm; vân nhiễu trên đất, tường; cỏ bụi, mây trôi. Đo trên Intel UHD 620: khoảng 80 khung/giây ở 1280×720.
- **Thấp** (điện thoại tự dùng): bóng vẽ sẵn vào màu đỉnh như bản gốc, rất nhẹ.

## Bản đồ gốc: Khu công nghiệp và địch

Bản đồ khai báo trong `js/core/map.js` bằng các lệnh `box(...)` và `ramp(...)`; mỗi khối vừa là tường vừa là sàn đứng được.

| Khu | Có gì |
|---|---|
| KHO HÀNG (đông bắc) | Nhà 20 x 14 m, cửa lớn phía nam, cửa nhỏ phía tây, cửa sổ bắn được; dốc lên tầng lửng 3,25 m |
| BÃI CONTAINER (tây nam) | 7 container, dốc lên nóc, hai nóc nối bằng sàn thép, một chồng đôi cao 5,2 m |
| THÁP CANH (tây bắc) | Sàn cao 3,6 m có mái và tường chắn, dốc lên từ phía đông |
| BÃI XE (đông nam) | Xe tải, bồn chứa, rào bê tông |
| NGÃ TƯ | Điểm xuất phát, rào bê tông thấp (nhảy lên được, bắn qua đầu được) |

Địch tự tìm đường: vòng qua tường, vào cửa, leo dốc lên chỗ người chơi đang đứng (`js/core/nav.js`, và các mốc `path` của từng sàn cao trong `map.js`).

| Địch | Dáng | Cách đánh |
|---|---|---|
| Lính | Giáp đỏ, mũ sắt kính vàng, dùi cui | Áp sát đánh |
| Chạy nhanh | Lom khom, hai lưỡi dao dài, một mắt xanh, gai lưng | Rất nhanh, máu ít |
| Xạ thủ | Cao gầy, áo choàng tím, súng trường dài | Giữ khoảng cách, bắn đạn bay chậm né được |
| Đồ tể | Vai rộng gấp đôi, giáp vạch vàng đen, nắm đấm khổng lồ | Rất trâu, không bị khựng khi trúng đạn |

Trúng đạn thì địch nháy sáng, giật người và khựng lại một nhịp; chết thì ngã ngửa rồi tan dần.

## Giữ gì, đổi gì so với bản Python

| Phần | Bản web |
|---|---|
| Luật đợt, điểm, chuỗi hạ gục, vật phẩm, 4 loại địch, luật Đoàn kết / PvP | Giữ nguyên |
| Con số cân bằng gốc | Giữ nguyên trong `js/config.js`, thêm các mục mới ở cuối file |
| Rừng thông, đá, thùng gỗ của bản đồ cũ | Giữ những cái không đè lên công trình mới |
| Cách tô bóng low-poly, xử lý cảm ứng, cách chia thư mục core / controls / game / ui | Giữ nguyên |
| Bản đồ | Mới: khu công nghiệp nhiều tầng, va chạm có độ cao, địch biết tìm đường |
| Vũ khí | Mới: 8 món, lựu đạn, bom khói, ngắm bắn, độ tản tăng khi bắn liên tục |
| Hình địch, mô hình súng, HUD, menu, âm thanh | Làm lại |
| Chơi với máy (bot) | Mới |
| Phòng riêng qua mạng | Có: máy chủ Node.js trong `server/`, dùng lại nguyên bộ luật `js/core/` |

## Cấu trúc

```
page.html                Nội dung trang (dùng để xuất bản); build.py tạo ra index.html hoàn chỉnh
index.html               Trang hoàn chỉnh để tự đăng
js/
  main.js                Điểm khởi động
  config.js              TẤT CẢ thông số cân bằng
  core/                  Luật chơi thuần logic - chạy được cả ngoài trình duyệt
    sim.js                 mô phỏng cả trận, 3 chế độ
    map.js                 bản đồ gốc (Khu công nghiệp) + chọn bản đồ theo mã + chủ đề mặc định
    maps/                  mỗi bản đồ mới một file (lang_que, sa_mac, bang_gia) + kit.js (bộ dụng cụ) + index.js
    missions.js            8 nhiệm vụ, các loại chặng, tính sao
    collide.js             va chạm có độ cao (tường, sàn, dốc)
    nav.js                 tìm đường cho địch và bot
    bots.js                người chơi máy
    ballistics.js          đường đạn: trúng thân, trúng đầu, bị che
    weapons.js  enemies.js  waves.js  state.js  geometry.js  layout.js  layoutData.js  rng.js  storage.js
  controls/              intent.js  desktop.js  touch.js  pointers.js
  game/                  Dựng hình bằng Three.js - không chứa luật chơi
    app.js                 vòng lặp chính, chế độ, chuyển cảnh
    world/                 dựng thế giới theo bản đồ (đọc chủ đề của từng bản đồ): index.js (lớp World, đèn, bóng đổ thật),
                           sky.js (trời, núi, sao, mây), ground.js (đất, đường, cỏ), structures.js (công trình, cây, đèn đường), common.js
    meshes.js              lưới low-poly, vật liệu, hai mức đồ hoạ
    actors.js              bộ khớp và thiết kế 4 loại địch, người chơi khác
    arsenal.js             mô hình súng, giật, nạp đạn, ngắm
    effects.js             vỏ đạn, vệt đạn, vụ nổ, toàn bộ âm thanh tổng hợp
    player.js  session.js
  net/session.js         phiên chơi qua mạng (cùng bộ thuộc tính với game/session.js)
  ui/                    hud.js  menus.js  touchOverlay.js
server/
  server.mjs             phát trang game + WebSocket tại /ws
  rooms.mjs              phòng: mã phòng, danh sách, chạy mô phỏng, phát trạng thái
tests/
  core.test.mjs          21 bài kiểm thử luật chơi  }
  net.test.mjs           7 bài kiểm thử máy chủ phòng }
  maps.test.mjs          kiểm thử từng bản đồ: đi được tới mọi khu và sàn cao, địch không bị nhốt } npm test (65 bài)
  missions.test.mjs      kiểm thử nhiệm vụ: mục tiêu đứng được, người chơi tự động hoàn thành từng nhiệm vụ, sao, mở khoá }
  online.test.mjs        máy chủ thật + hai trình duyệt: tạo phòng, vào bằng mã, đánh PvP và Đoàn kết
  browser.test.mjs       tự chơi cả 3 chế độ trong trình duyệt, máy tính + điện thoại đa chạm, chụp ảnh
  probe.mjs              công cụ chụp nhanh một cảnh để gỡ lỗi
```
