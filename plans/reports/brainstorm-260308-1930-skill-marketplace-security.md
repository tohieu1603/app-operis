# Báo cáo Brainstorm: Skill Marketplace — Kiến trúc bảo mật

**Ngày:** 2026-03-08
**Trạng thái:** Đã thống nhất
**Nhánh:** Hung

---

## Vấn đề cần giải quyết

Operis Agent cần thêm **Skill Marketplace** — chợ bán skill cho hệ thống agent. Thách thức chính: **ngăn người dùng mua 1 lần rồi copy skill cho người khác dùng miễn phí**.

### Yêu cầu
- Hỗ trợ 2 loại skill: phụ thuộc AI (dựa trên prompt) + logic thuần (dựa trên script)
- Mô hình subscription (trả phí hàng tháng)
- Hybrid offline: một số skill cần chạy offline, một số online
- Tác giả skill: chưa quyết định (team nội bộ hoặc cả bên thứ ba)
- Bảo mật: ngăn phân phối lại ở mức cao nhất khả thi

### Hiện trạng
- Định dạng skill: `SKILL.md` (prompt) + `run.js` (script logic) trong thư mục skill
- Đã có sẵn: Hệ thống billing token (nạp VND, `token_balance`), xác thực qua HttpOnly cookies + JWT, WebSocket gateway
- Skill được tải từ 4 nguồn: workspace → bundled → managed → extra dirs
- Chưa có DRM, licensing, hay logic marketplace

---

## Các hướng tiếp cận đã đánh giá

### Hướng 1: Thực thi phía server (Server-Side Execution)
- **Cách hoạt động:** Logic skill chạy hoàn toàn trên server. User gửi input → server xử lý → trả kết quả
- **Bảo mật:** Cao nhất — code không bao giờ rời server
- **Ưu điểm:** Không thể sao chép; billing theo lần thực thi tự nhiên; kiểm soát hoàn toàn
- **Nhược điểm:** Cần hạ tầng server (Lambda/WASM); độ trễ mỗi lần chạy; không offline; chi phí mở rộng
- **Kết luận:** Tốt cho Cloud skill, không khả thi cho Local skill (cần credentials/hệ thống tập tin cục bộ)

### Hướng 2: Subscription + Token Gating
- **Cách hoạt động:** Mỗi lần chạy skill, app xác thực JWT với server. Hết subscription = skill không chạy
- **Bảo mật:** Trung bình-Cao — chia sẻ thông tin đăng nhập = tốn tiền người chia sẻ
- **Ưu điểm:** Đã có sẵn hệ thống token; triển khai nhanh; doanh thu ổn định
- **Nhược điểm:** Skill có thể bị patch bỏ bước kiểm tra (nếu code local); cần internet để xác thực
- **Kết luận:** Tầng bảo mật cơ bản cho tất cả loại skill

### Hướng 3: Stub nhẹ + Logic chính trên server (Hybrid)
- **Cách hoạt động:** Phân phối stub nhẹ (chỉ điều phối). Logic quan trọng chạy phía server qua API
- **Bảo mật:** Cao — stub vô giá trị nếu không có server
- **Ưu điểm:** Offline cho phần không trọng yếu; server cho phần cốt lõi
- **Nhược điểm:** Thiết kế phức tạp: phải tách skill thành stub và phần cốt lõi
- **Kết luận:** Phù hợp cho Hybrid skill

### Hướng 4: Phân phối mã hóa + Ràng buộc giấy phép (Encrypted Distribution + License Binding)
- **Cách hoạt động:** Mã hóa code skill, khóa giải mã lấy từ license server. Ràng buộc giấy phép vào thiết bị/người dùng
- **Bảo mật:** Trung bình — ngăn người dùng thông thường, không ngăn được hacker chuyên nghiệp
- **Ưu điểm:** Chạy offline sau khi kích hoạt; trải nghiệm quen thuộc
- **Nhược điểm:** Có thể bị crack (dump bộ nhớ); cần duy trì bộ công cụ mã hóa
- **Kết luận:** Dùng cho Local skill cần offline hoàn toàn

### Hướng 5: Đánh dấu người mua + Làm rối mã nguồn (Watermarking + Obfuscation)
- **Cách hoạt động:** Chèn dấu vân tay duy nhất vào mỗi bản skill khi mua + làm rối code
- **Bảo mật:** Thấp-Trung bình — răn đe + truy vết rò rỉ, không ngăn sao chép
- **Ưu điểm:** Triển khai đơn giản; có tác dụng răn đe; kết hợp tốt với các hướng khác
- **Nhược điểm:** Phản ứng sau sự kiện, không chủ động; watermark có thể bị gỡ; obfuscation bị giải mã
- **Kết luận:** Tầng bổ sung, không đứng một mình được

### Bảng so sánh

| Hướng tiếp cận | Bảo mật | Độ phức tạp | Khả năng chống piracy | Phù hợp cho |
|---|---|---|---|---|
| Thực thi phía server | Cao | Cao | Mạnh | Cloud skill |
| Subscription + token gating | Trung bình-Cao | Thấp | Mạnh (kinh tế) | Tất cả skill |
| Stub nhẹ + server core | Cao | Trung bình | Mạnh | Hybrid skill |
| Phân phối mã hóa | Trung bình | Trung bình | Vừa | Skill offline |
| Watermark + obfuscation | Thấp-Trung bình | Thấp | Yếu (răn đe) | Bổ sung |

---

## Giải pháp đề xuất

### Kiến trúc 3 Tầng + Phân Loại Skill

#### Phân loại Skill theo nơi chạy

| Loại | Chạy ở đâu | Bảo mật | Ví dụ |
|---|---|---|---|
| **Cloud skill** | Server Operis | Cao nhất — code không rời server | Phân tích dữ liệu, AI workflow |
| **Local skill** | Máy người dùng | Token validation + mã hóa code | zalo-scanner, tự động hóa |
| **Hybrid skill** | Phần cốt lõi trên server, glue code cục bộ | Cao | Truy cập local + thuật toán phức tạp |

#### Tầng 1: Subscription + Xác thực Token (BẮT BUỘC — tất cả skill)

```
Người dùng mua subscription → Kích hoạt subscription trong DB
  ↓
Mỗi lần chạy skill:
  1. App gửi yêu cầu: { skillId, userId, JWT }
  2. Server xác thực: subscription còn hiệu lực? đã mua skill? JWT hợp lệ?
  3. Server trả về: { allowed: true, executionToken: "jwt-ngắn-hạn-15-phút" }
  4. Skill chạy với executionToken
  5. Server trừ token_balance theo lần thực thi
```

- **Răn đe kinh tế:** Chia sẻ thông tin đăng nhập = tốn tiền người chia sẻ
- **Tận dụng hệ thống sẵn có:** Dùng JWT + token_balance đã có
- **Triển khai:** Độ phức tạp thấp — mở rộng hệ thống xác thực hiện có

#### Tầng 2: Tầng thực thi (tùy loại skill)

**Cloud Skill:**
```
┌─────────────────────────────────┐
│ Máy khách (Operis App)          │
│  → gửi input + executionToken   │
└──────────────┬──────────────────┘
               ↓
┌─────────────────────────────────┐
│ Server Operis                   │
│  → xác thực token               │
│  → chạy skill trong sandbox     │
│  → trả kết quả                  │
│  → trừ token                    │
└─────────────────────────────────┘
Code KHÔNG BAO GIỜ rời server.
```

**Local Skill:**
```
┌─────────────────────────────────┐
│ Máy khách (Operis App)          │
│  → xác thực executionToken      │
│  → giải mã skill code           │
│     (khóa từ server, cache 24h) │
│  → chạy skill cục bộ            │
│  → báo cáo sử dụng về server    │
└─────────────────────────────────┘
Code được mã hóa, chỉ chạy khi có token hợp lệ.
Offline: dùng khóa giải mã đã cache (tối đa 24h).
```

**Hybrid Skill:**
```
┌─────────────────────────────────┐
│ Máy khách (glue code)           │
│  → thu thập dữ liệu cục bộ     │
│  → gửi dữ liệu + executionToken│
│     → Server chạy logic chính   │
│     → trả kết quả               │
│  → ghi kết quả ra local         │
└─────────────────────────────────┘
Glue code cục bộ (vô giá trị), logic chính trên server.
```

#### Tầng 3: Watermark + Obfuscation (BỔ SUNG)

**Đánh dấu người mua (Watermarking):**
- Chèn dấu vân tay người mua (hash duy nhất từ userId + purchaseId) vào mỗi bản skill
- Áp dụng cho Local skill và Hybrid skill (phần glue code)
- Nếu phát hiện bản lậu → truy vết dấu vân tay → thu hồi tài khoản

**Làm rối mã nguồn (Obfuscation):**
- Áp dụng JS obfuscation (javascript-obfuscator) cho code phân phối
- Chỉ là rào cản tốc độ — không phải tường thành
- Ngăn piracy thông thường (copy-paste cho bạn bè)

---

## Định dạng gói Skill (đề xuất)

```
skills/
└── zalo-group-scanner/
    ├── SKILL.md              # Metadata + prompt (phân phối)
    ├── manifest.json          # { type: "local", version, requires, ... }
    ├── stub.js                # Code điều phối (phân phối, có watermark)
    ├── core.wasm/core.js      # Logic chính (phía server hoặc mã hóa)
    └── assets/                # Tài nguyên tĩnh nếu cần
```

**manifest.json:**
```json
{
  "id": "zalo-group-scanner",
  "version": "1.0.0",
  "type": "local",
  "author": "operis-team",
  "pricing": {
    "model": "subscription",
    "tokensPerExecution": 10
  },
  "requires": {
    "credentials": ["zalozcajs"],
    "bins": ["node"],
    "platform": ["win32", "linux", "darwin"]
  }
}
```

---

## Kế hoạch triển khai

### Giai đoạn 1 (MVP): Subscription + Token Gating
- Mở rộng hệ thống xác thực/token hiện có
- Thêm bảng `skill_purchases` trong cơ sở dữ liệu
- Thêm endpoint xác thực: `POST /marketplace/validate-execution`
- Trừ token theo lần thực thi
- **Đánh giá:** Nỗ lực trung bình, hiệu quả bảo mật cao

### Giai đoạn 2: Giao diện Marketplace + Phân phối Skill
- Giao diện duyệt/tìm kiếm/mua skill
- Quy trình tải + cài đặt skill (gói mã hóa)
- Hệ thống đánh giá/nhận xét

### Giai đoạn 3: Thực thi phía server cho Cloud Skill
- Môi trường sandbox (Docker/WASM)
- API endpoint thực thi
- Đo lường sử dụng + billing

### Giai đoạn 4: Bảo vệ nâng cao
- Pipeline đánh dấu người mua (watermarking)
- Bước build làm rối mã nguồn (obfuscation)
- Hệ thống phát hiện rò rỉ
- Tiếp nhận tác giả skill bên thứ ba (nếu quyết định mở)

---

## Rủi ro

| Rủi ro | Mức ảnh hưởng | Biện pháp giảm thiểu |
|---|---|---|
| Code Local skill bị crack giải mã | Trung bình | Mã hóa code + khóa ngắn hạn + xác thực token |
| Chia sẻ token/thông tin đăng nhập giữa người dùng | Thấp | Răn đe kinh tế (tốn tiền), giới hạn tần suất |
| Độ trễ thực thi phía server | Trung bình | Edge computing, cache, thực thi bất đồng bộ |
| Obfuscation bị giải mã | Thấp | Chỉ là rào cản, không dựa vào đây làm chính |
| Skill độc hại từ bên thứ ba | Cao | Quy trình review bảo mật, sandbox, quét code |

---

## Chỉ số thành công

- < 5% tỷ lệ phân phối trái phép
- Tỷ lệ giữ chân subscription > 70% theo tháng
- Độ trễ thực thi skill < 3 giây (Cloud skill)
- Không có sự cố bảo mật từ skill marketplace
- Mức hài lòng nhà phát triển > 4/5 (nếu mở bên thứ ba)

---

## Nghiên cứu nền tảng tham khảo

- **Shopify Apps:** Gần 0% piracy — code chạy phía server, người bán chỉ đăng ký dịch vụ
- **WordPress Plugins:** Piracy lớn — code PHP phân phối cục bộ, GPL cho phép tái phân phối
- **VS Code Extensions:** Piracy thấp — extension trả phí cần token server (Copilot)
- **JetBrains:** Piracy vừa — license server + obfuscation, chấp nhận một phần bị crack

---

## Câu hỏi chưa giải quyết

1. **Tác giả bên thứ ba?** Nếu mở cho nhà phát triển bên ngoài → cần quy trình review bảo mật, mô hình chia sẻ doanh thu, sandbox chặt hơn
2. **Các mức giá?** Bao nhiêu token mỗi lần thực thi? Subscription bao nhiêu VND/tháng?
3. **Thời gian cache offline?** Cache khóa giải mã 24h có phù hợp hay cần điều chỉnh?
4. **Khung pháp lý?** EULA/TOS cho marketplace cần luật sư xem xét
5. **Tích hợp ClawHub?** Tích hợp hay thay thế clawhub.com hiện có?

---

## Bước tiếp theo

1. Quyết định mô hình tác giả bên thứ ba
2. Thiết kế database schema cho marketplace (giao dịch mua, giấy phép, sử dụng)
3. Tạo kế hoạch triển khai chi tiết (Giai đoạn 1 MVP)
4. Thiết kế giao diện marketplace
