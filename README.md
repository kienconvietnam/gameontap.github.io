# 🛰️ E-Watch – Mạng giám sát môi trường liên thông

Web thuần HTML/CSS/JS: biến điện thoại thành trạm quan sát có AI, các máy liên thông với nhau và chia sẻ cảnh báo tức thì.

## Tính năng
- **AI trên trình duyệt** (TensorFlow.js + COCO-SSD): nhận diện người, động vật, cây cảnh, phương tiện. Hình ảnh không rời khỏi máy.
- **Liên thông** bằng WebRTC (PeerJS): tạo phòng → máy khác nhập mã → cảnh báo gửi cho cả phòng.
- **Dự đoán xu hướng**: đối tượng tiến lại gần nhanh, nghi ngã, đông người, cây úa vàng.
- **Giám sát địa hình**: so khung hình hiện tại với "mốc", báo khi thay đổi lớn hoặc tăng dần (dấu hiệu sạt lở/đổ/dịch chuyển).
- Phát hiện nghi có lửa (theo màu), camera bị che, chế độ canh gác.
- Thông báo: âm thanh, rung, Notification, đính kèm GPS (tuỳ chọn).

## Đưa lên GitHub để mọi người dùng
1. Tạo repo mới (ví dụ `ewatch`), tải 4 file `index.html`, `style.css`, `app.js`, `README.md` lên.
2. Vào **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
3. Sau ~1 phút truy cập `https://<tên-github>.github.io/ewatch/`. (GitHub Pages dùng HTTPS nên camera hoạt động.)

## Cách dùng
1. Máy A: nhập tên vị trí → **Tạo phòng** → gửi mã cho người khác.
2. Máy B, C…: nhập mã → **Vào phòng**.
3. Mỗi máy bấm **Bật giám sát**, đặt máy cố định, cắm sạc, giữ màn hình sáng.
4. Địa hình: đặt máy chắc chắn, bật *Chế độ giám sát địa hình*, dùng *Chụp lại mốc* khi cần.

## Giới hạn cần biết
- **Không thể dự báo sạt lở chính xác chỉ bằng camera.** Công cụ chỉ phát hiện *thay đổi hình ảnh bất thường*; mưa, bóng mây, rung máy, người đi qua có thể gây báo nhầm. Không thay thế cảm biến địa chất và cảnh báo chính thức.
- Trình duyệt hạn chế chạy nền: khi tắt màn hình/chuyển tab, camera có thể dừng. Cần giữ tab mở (đã dùng Wake Lock).
- PeerJS dùng máy chủ báo hiệu miễn phí công cộng; nếu máy mạng khắt khe (4G đối xứng) có thể cần máy chủ TURN riêng.
- Phòng kiểu sao: máy tạo phòng là trung tâm chuyển tiếp; nếu nó thoát thì phòng đóng.

## Hướng phát triển
Push thông báo khi tắt app (Service Worker + máy chủ), xem video trực tiếp giữa các máy, bản đồ trạm, lưu lịch sử (Firebase/Supabase), mô hình riêng cho lửa/khói/sạt lở, tích hợp cảm biến mưa/độ nghiêng.
