# XMR Web Miner

XMR Web Miner là một ứng dụng web cho phép khai thác tiền điện tử Monero (XMR) và các loại tiền điện tử khác dựa trên thuật toán RandomX/CryptoNight trực tiếp từ trình duyệt web.

## Tính Năng

- **Quản lý Pool Linh Hoạt**: Dễ dàng tùy chỉnh pool khai thác với URL và port
- **Tự Động Phát Hiện CPU**: Tự động nhận diện loại CPU và số lượng luồng tối đa
- **Tối Ưu Hóa Luồng**: Tự động đề xuất số lượng luồng tối ưu cho mỗi thuật toán
- **Quản Lý Cường Độ**: Điều chỉnh mức sử dụng CPU để cân bằng giữa hiệu suất và trải nghiệm người dùng
- **Hỗ Trợ Đa Thuật Toán**: RandomX, CryptoNight R, CryptoNight Light, và các thuật toán khác
- **Lưu Cấu Hình**: Tự động lưu và tải các cấu hình pool và cài đặt khai thác
- **Hiển Thị Hiệu Suất**: Biểu đồ thời gian thực về hashrate và hiệu suất từng luồng
- **Nhật Ký Chi Tiết**: Hệ thống ghi nhật ký đầy đủ với thông tin về kết nối, shares, và lỗi

## Yêu Cầu Hệ Thống

- Trình duyệt hiện đại hỗ trợ WebAssembly và Web Workers
- Google Chrome, Firefox, Edge hoặc Safari (phiên bản mới nhất)
- Kết nối internet ổn định
- CPU đa nhân để khai thác hiệu quả

## Cách Sử Dụng

1. **Cấu hình pool khai thác**:
   - Nhập URL pool (ví dụ: pool.supportxmr.com)
   - Nhập port pool (ví dụ: 3333)
   - Lưu cấu hình pool nếu bạn thường xuyên sử dụng

2. **Nhập thông tin ví**:
   - Nhập địa chỉ ví Monero (XMR) của bạn
   - (Tùy chọn) Nhập tên worker để nhận dạng thiết bị của bạn

3. **Tùy chỉnh cài đặt CPU**:
   - Chọn số lượng luồng CPU (hoặc sử dụng số lượng đề xuất)
   - Điều chỉnh cường độ khai thác (mức sử dụng CPU)
   - Sử dụng nút "Tự Động Cấu Hình" để thiết lập tối ưu

4. **Bắt đầu khai thác**:
   - Nhấn nút "Bắt đầu" để khởi động quá trình khai thác
   - Theo dõi hiệu suất qua biểu đồ và thống kê
   - Nhật ký sẽ hiển thị các sự kiện và trạng thái

5. **Quản lý khai thác**:
   - Điều chỉnh cường độ hoặc số lượng luồng khi đang khai thác
   - Nhấn "Dừng" để dừng quá trình khai thác

## Cấu Trúc Project

```
xmr-web-miner/
├── index.html          # Giao diện người dùng chính
├── css/
│   └── style.css       # Kiểu dáng và bố cục
├── js/
│   ├── algorithms.js   # Thông tin về các thuật toán và pool
│   ├── app.js          # Logic ứng dụng và tương tác UI
│   └── miner.js        # Core công cụ khai thác
└── README.md           # Tài liệu hướng dẫn
```

## Các Pool Khai Thác Đề Xuất

- **SupportXMR**: pool.supportxmr.com:3333
- **MoneroOcean**: gulf.moneroocean.stream:10001
- **2Miners**: xmr.2miners.com:2222
- **Nanopool**: xmr-eu1.nanopool.org:14444
- **HashVault**: pool.hashvault.pro:3333

## Các Thuật Toán Được Hỗ Trợ

- **RandomX (rx/0)**: Thuật toán chính của Monero
- **CryptoNight-R (cn/r)**: Thuật toán legacy của Monero
- **CryptoNight Lite v1 (cn-lite/1)**: Sử dụng cho Aeon
- **CryptoNight Pico (cn-pico)**: Phiên bản siêu nhẹ
- **RandomWOW (rx/wow)**: Biến thể cho Wownero
- **Argon2/Chukwa**: Thuật toán cho Turtlecoin

## Thông Tin Bảo Mật

- Ứng dụng chạy hoàn toàn ở phía client, không gửi dữ liệu nhạy cảm đến server
- Mật khẩu và cấu hình được lưu trữ cục bộ trong trình duyệt của bạn
- Không thu thập thông tin cá nhân ngoài những gì cần thiết để khai thác

## Lưu Ý Quan Trọng

- Khai thác tiền điện tử sẽ sử dụng tài nguyên CPU đáng kể
- Nên thực hiện khi thiết bị được cắm sạc để tránh tốn pin
- Hiệu suất khai thác trên trình duyệt thấp hơn so với phần mềm native
- Sử dụng cẩn thận trên thiết bị di động vì có thể gây nóng máy

## Đóng Góp

Nếu bạn muốn đóng góp vào dự án, hãy:
1. Fork repository
2. Tạo một nhánh feature mới
3. Thực hiện các thay đổi của bạn
4. Gửi pull request

## Giấy Phép

Dự án này được phân phối dưới Giấy phép MIT. Xem file `LICENSE` để biết thêm chi tiết.

## Liên Hệ

Nếu bạn có câu hỏi hoặc đề xuất, vui lòng mở một issue trong repository này.

---

**Lưu ý**: Khai thác tiền điện tử chỉ nên được thực hiện trên các thiết bị bạn sở hữu và có quyền sử dụng tài nguyên. Không sử dụng công cụ này trên máy tính công cộng hoặc không được phép.
