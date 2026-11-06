# Báo cáo tối ưu dự án

## Đã tối ưu những gì?

- **Cache voice:** Không gọi lại OmniVoice nếu lời thoại và cấu hình giọng không đổi.
- **Cache clip:** Không render lại cảnh không bị thay đổi.
- **Cache video cuối:** Không ghép audio và video lại nếu đầu vào không đổi.
- **Kiểm tra lỗi:** Dùng `ffprobe` để kiểm tra video có đủ hình, tiếng và thời lượng.
- **Ổn định giọng đọc:** Toàn bộ video dùng cùng một mẫu giọng nam.
- **Nội dung trực quan hơn:** Mỗi cảnh có tiêu đề, ý chính, nhãn và minh họa.
- **Kiểm thử:** Typecheck đạt và 24/24 bài test thành công.
- **Agent hỗ trợ:** Có Agent riêng cho nội dung SEO, hiệu năng và kiểm tra chất lượng.

## Hiệu quả ước tính

| Tình huống | Nhanh hơn khoảng |
|---|---:|
| Tạo video lần đầu | 0–10% |
| Chạy lại không đổi nội dung | 90–98% |
| Chỉ sửa một cảnh | 70–90% |

Lần đầu vẫn cần tạo toàn bộ voice và render toàn bộ cảnh nên không nhanh hơn
nhiều. Hiệu quả lớn nhất xuất hiện ở các lần chỉnh sửa sau.

## Tiết kiệm AI và chi phí

- OmniVoice chạy local nên không tính phí theo số lần tạo voice.
- HyperFrames và FFmpeg cũng chạy local.
- Viết `script.json` đầy đủ ngay từ đầu giúp giảm số lần gọi AI sửa kịch bản.
- Dùng CSS/SVG hoặc ảnh local thay vì tạo ảnh AI cho từng cảnh.
- Không xóa thư mục `voice`, `clips` và file `.pipeline-cache.json`.

## Cách chạy

```powershell
npm run typecheck
npm test
npm run pipeline -- output/test-video/script.json
```

## Kết luận

Dự án hiện đã tối ưu tốt cho việc chỉnh sửa và render lại video. Khi chỉ sửa một
cảnh, hệ thống chủ yếu tạo lại đúng phần đó thay vì chạy lại toàn bộ video.
