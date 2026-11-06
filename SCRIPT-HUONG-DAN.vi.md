# Hướng dẫn viết `script.json` tiết kiệm AI

<!-- $env:OMNIVOICE_PORT="8123"
.\run.bat
npm run pipeline -- output/test-video/script.json -->

## Mục tiêu

Viết kịch bản đủ rõ ngay từ lần đầu để:

- AI không phải hỏi lại hoặc sửa nhiều lần.
- OmniVoice chỉ tạo lại những scene thật sự thay đổi.
- Template hiển thị đúng nội dung, không bị tràn chữ.
- Pipeline tận dụng được `.pipeline-cache.json`.

## Cấu trúc bắt buộc

Mỗi file cần có:

```json
{
  "version": "1.0",
  "renderer": "hyperframes",
  "aspect": "9:16",
  "metadata": {
    "title": "Tiêu đề video",
    "source": {
      "url": "",
      "domain": "",
      "image": null
    },
    "channel": "Tên kênh"
  },
  "voice": {
    "provider": "omnivoice",
    "speed": 1.05
  },
  "scenes": []
}
```

`scenes` phải có ít nhất ba scene, scene đầu là `hook` và scene cuối là `outro`.
Thông thường nên dùng một `hook`, từ bốn đến sáu `body` và một `outro`.

## Mẫu một scene `body`

```json
{
  "id": "body-1",
  "type": "body",
  "voiceText": "Google xử lý website qua ba bước: Crawling là thu thập dữ liệu, Indexing là phân tích và lưu nội dung, còn Ranking là xếp hạng kết quả tìm kiếm.",
  "templateId": "frame-bold-poster",
  "inputs": {
    "kicker": "NỀN TẢNG GOOGLE",
    "date": "01 · CƠ CHẾ",
    "figure": "01",
    "headline": ["3 BƯỚC", "GOOGLE", "HOẠT ĐỘNG"],
    "subtitle": "Crawling · Indexing · Ranking",
    "visual_kind": "flow",
    "visual_labels": ["Crawling", "Indexing", "Ranking"],
    "key_points": [
      "Crawling: thu thập dữ liệu",
      "Indexing: phân tích và lưu nội dung",
      "Ranking: xếp hạng kết quả"
    ],
    "footer_left": "SEO CƠ BẢN",
    "footer_right": "01 / 06"
  }
}
```

## Cách viết tiết kiệm nhất

### 1. Viết hoàn chỉnh trước khi chạy

Trước khi chạy pipeline, cần hoàn thiện cả:

- `voiceText`: lời đọc cuối cùng.
- `headline`: tối đa ba dòng ngắn.
- `subtitle`: một câu hoặc chuỗi từ khóa.
- `key_points`: ba đến bốn ý chính.
- `visual_labels`: ba đến bốn nhãn minh họa.
- `templateId`: template đã chọn.

Không để AI tự đoán các phần còn thiếu sau khi đã render.

### 2. Giữ `voiceText` ổn định

Cache TTS phụ thuộc vào nội dung `voiceText`. Chỉ cần đổi một dấu câu hoặc một từ,
scene đó sẽ phải gọi OmniVoice lại. Vì vậy hãy kiểm tra kỹ lời đọc trước lần chạy đầu.

Lời đọc nên:

- Dài khoảng 35–80 từ cho một scene body.
- Chỉ truyền đạt một ý chính.
- Dùng câu ngắn, có dấu chấm để tạo nhịp nghỉ.
- Viết số bằng chữ khi OmniVoice dễ đọc nhầm.
- Không chứa emoji, URL hoặc ký hiệu trang trí.

### 3. Đồng bộ chữ với voice

`key_points` và `visual_labels` phải tóm tắt đúng lời đọc, không thêm thông tin mới.
Mỗi ý chính nên ngắn, thường dưới 45 ký tự để vừa màn hình điện thoại.

### 4. Không đổi nhiều scene cùng lúc

Nếu cần sửa, chỉ sửa scene bị lỗi. Không đổi toàn bộ `voiceText`, `templateId` và
`inputs` cùng lúc nếu không cần thiết. Những scene không đổi sẽ được dùng cache.

## Chọn template và minh họa

- `frame-liquid-bg-hero`: mở đầu, câu hỏi, tiêu đề lớn.
- `frame-bold-poster`: nội dung giải thích, danh sách và quy trình.
- `frame-aicoding-comparison`: so sánh hai lựa chọn.
- `frame-aicoding-list`: danh sách nhiều ý.
- `frame-logo-outro`: kết thúc và kêu gọi theo dõi.

Các trường minh họa thường dùng với `frame-bold-poster`:

- `visual_kind`: `flow`, `pillars`, `compare`, `process`, `content` hoặc `metrics`.
- `visual_title`: tiêu đề ngắn cho khung ví dụ.
- `visual_note`: giải thích một câu cho người xem.
- `visual_labels`: nhãn ngắn hiển thị trong khung minh họa.
- `visual_details`: mô tả ngắn dưới từng nhãn.
- `visual_active`: số thứ tự của điểm cần nhấn mạnh.
- `key_points`: các ý tóm tắt có đánh số.

## Quy trình chạy tiết kiệm

1. Viết và kiểm tra toàn bộ `script.json`.
2. Chạy `npm run typecheck`.
3. Chạy `npm test`.
4. Render preview hoặc một scene trước nếu vừa đổi template.
5. Chạy pipeline đầy đủ.
6. Không xóa thư mục `voice`, `clips` hoặc `.pipeline-cache.json`.

```powershell
npm run typecheck
npm test
npm run pipeline -- output/test-video/script.json
```

## Khi nào cache bị tạo lại?

Scene sẽ tạo lại voice nếu thay đổi:

- `voiceText`.
- Mẫu voice, transcript, giới tính hoặc phong cách OmniVoice.
- Endpoint hoặc cấu hình TTS.

Scene sẽ render lại clip nếu thay đổi:

- `templateId`.
- `inputs`.
- `aspect`.
- Thời lượng scene.
- Nội dung file template.

Đây là hành vi mong muốn để tránh dùng output cũ không còn khớp nội dung.

## Checklist trước khi chạy

- [ ] Có `hook` ở đầu và `outro` ở cuối.
- [ ] Mỗi scene chỉ có một ý chính.
- [ ] `voiceText` đã là bản cuối.
- [ ] `headline`, `subtitle`, `key_points` khớp với voice.
- [ ] `visual_labels` ngắn và không bị trùng.
- [ ] Không có URL hoặc emoji trong `voiceText`.
- [ ] Không xóa cache nếu không muốn tạo lại audio/video.
