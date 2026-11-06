# AI Auto Generate Video

Tạo video dọc từ `script.json` bằng HyperFrames, FFmpeg và OmniVoice
chạy trên máy local.

## 1. Chuẩn bị môi trường

### Windows

Cài các phần mềm sau:

1. **Node.js 22 trở lên:** https://nodejs.org/
2. **FFmpeg:** mở PowerShell bằng quyền Administrator và chạy:

   ```powershell
   winget install Gyan.FFmpeg
   ```

3. **Git:** https://git-scm.com/download/win
4. **Chrome hoặc Chromium:** HyperFrames dùng trình duyệt để render template.

Đóng và mở lại PowerShell, sau đó kiểm tra:

```powershell
node --version
npm --version
ffmpeg -version
ffprobe -version
git --version
```

## 2. Tải dự án

```powershell
cd "Đường dẫn muốn tạo dự án"
git clone https://github.com/JIoo1/AI_auto_video.git
cd AI_auto_video
npm install
```

Nếu repository của bạn dùng URL khác, thay URL trong lệnh `git clone`.

## 3. Cài và chạy OmniVoice

OmniVoice không được đóng gói trong repository vì model có kích thước lớn.
Bạn cần tải và cài OmniVoice riêng từ repository chính thức:

https://github.com/k2-fsa/OmniVoice

### Cài OmniVoice trên Windows

Mở **PowerShell mới**, đi tới thư mục OmniVoice:

```powershell
cd "Đường dẫn muốn lưu OmniVoice"
git clone https://github.com/k2-fsa/OmniVoice.git
cd OmniVoice
```

Chạy file cài đặt có sẵn của OmniVoice:

```powershell
.\setup.bat
```

`setup.bat` chỉ cần chạy khi cài lần đầu hoặc khi OmniVoice yêu cầu cài lại
môi trường/model.

### Khởi động OmniVoice

Mỗi lần muốn tạo video, mở PowerShell tại thư mục OmniVoice và chạy:

```powershell
$env:OMNIVOICE_PORT="8123"
.\run.bat
```

Giữ cửa sổ OmniVoice này mở trong suốt thời gian tạo video. Chờ server khởi
động xong trước khi chạy pipeline.

Nếu PowerShell chặn chạy file `.bat`, hãy mở **Command Prompt** tại thư mục
OmniVoice và chạy:

```cmd
set OMNIVOICE_PORT=8123
run.bat
```

Pipeline của dự án cần OmniVoice chạy tại:

```text
http://127.0.0.1:8123
```

Giữ cửa sổ OmniVoice đang chạy trong suốt thời gian tạo video. Kiểm tra server
bằng cách mở địa chỉ trên trình duyệt hoặc gọi:

```powershell
Invoke-WebRequest http://127.0.0.1:8123 -UseBasicParsing
```

Nếu nhận lỗi `ECONNREFUSED`, OmniVoice chưa chạy hoặc đang dùng cổng khác.

Pipeline gửi yêu cầu tạo giọng nói tới:

```text
POST http://127.0.0.1:8123/generate
```

Nếu mở được trang OmniVoice nhưng pipeline báo lỗi `404` tại `/generate`, bản
OmniVoice đang chạy không cung cấp API tương thích với project này. Khi đó cần
chạy API adapter có endpoint `/generate`, hoặc đổi `OMNIVOICE_ENDPOINT` sang
server tương thích; không nên đổi tùy ý sang `/tts` vì pipeline hiện dùng
`/generate` với các trường `ref_audio`, `ref_text`, `text`, `voice_gender` và
`speaking_style`.

## 4. Cấu hình OmniVoice và chọn giọng

Tạo file `.env.local` ở thư mục gốc dự án. File này không được commit lên
GitHub vì có trong `.gitignore`.

### Dùng giọng nam mẫu có sẵn

Nếu file sau có trong project:

```text
assets\voice-reference\vietnamese-male-middle-audio-019.wav
```

thì dùng cấu hình:

```env
TTS_PROVIDER=omnivoice
OMNIVOICE_ENDPOINT=http://127.0.0.1:8123
OMNIVOICE_VOICE_GENDER=male
OMNIVOICE_SPEAKING_STYLE=narrator
OMNIVOICE_REFERENCE_AUDIO=assets/voice-reference/vietnamese-male-middle-audio-019.wav
OMNIVOICE_REFERENCE_TEXT=Xin chào, mình là Thế Hào. Rất vui vì hôm nay chúng ta lại có dịp ngồi lại với nhau. Trong không gian nhỏ bé, nhưng đầy yêu thương.
TTS_CONCURRENCY=1
```

`OMNIVOICE_REFERENCE_TEXT` phải khớp chính xác với lời nói trong file WAV.
Nếu chia sẻ dự án công khai, chỉ sử dụng file WAV khi giấy phép dataset cho phép
phân phối lại.

### Dùng giọng riêng

1. Chuẩn bị một file WAV rõ tiếng, tốt nhất là mono và dài không quá 15 giây.
2. Chép file vào một thư mục local, ví dụ:

   ```text
   assets\voice-reference\my-voice.wav
   ```

3. Thay hai biến:

   ```env
   OMNIVOICE_REFERENCE_AUDIO=assets/voice-reference/my-voice.wav
   OMNIVOICE_REFERENCE_TEXT=Nội dung được nói chính xác trong file WAV
   ```

4. Chọn giới tính và phong cách:

   ```env
   OMNIVOICE_VOICE_GENDER=male
   OMNIVOICE_SPEAKING_STYLE=narrator
   ```

Mỗi lần đổi file mẫu hoặc transcript, pipeline sẽ tạo lại voice để bảo đảm
giọng mới được áp dụng.

## 5. Kiểm tra dự án

Chạy các lệnh sau trong thư mục dự án:

```powershell
npm run typecheck
npm test
```

Chỉ tiếp tục khi typecheck và test không báo lỗi.

Các lệnh kiểm tra và phát triển khác:

```powershell
# Biên dịch TypeScript
npm run build

# Chạy test ở chế độ theo dõi khi đang sửa code
npm run test:watch

# Chạy test và tạo báo cáo coverage
npm run coverage
```

Sau khi chạy `npm run test:watch`, nhấn `q` để thoát chế độ theo dõi.

## 6. Chuẩn bị kịch bản

Tạo thư mục output và file script:

```text
output\my-video\script.json
```

Kịch bản phải có:

- `"version": "1.0"`
- `"renderer": "hyperframes"`
- `"aspect": "9:16"`
- Ít nhất 3 scene.
- Scene đầu là `"type": "hook"`.
- Scene cuối là `"type": "outro"`.
- Mỗi scene có `id`, `voiceText`, `templateId` và `inputs`.

Ví dụ tối thiểu:

```json
{
  "version": "1.0",
  "renderer": "hyperframes",
  "aspect": "9:16",
  "metadata": {
    "title": "Video giới thiệu SEO",
    "source": {
      "url": "",
      "domain": "",
      "image": null
    },
    "channel": "SEO Beginner"
  },
  "voice": {
    "provider": "omnivoice",
    "speed": 1.05
  },
  "scenes": [
    {
      "id": "hook",
      "type": "hook",
      "voiceText": "SEO giúp website được nhiều người nhìn thấy hơn trên Google.",
      "templateId": "frame-liquid-bg-hero",
      "inputs": {
        "kicker": "KIẾN THỨC SEO",
        "headline": "SEO LÀ GÌ?",
        "subheadline": "Tăng lượt truy cập tự nhiên",
        "cta": "Bắt đầu",
        "brand": "SEO Beginner"
      }
    },
    {
      "id": "body-1",
      "type": "body",
      "voiceText": "Google xử lý website qua ba bước: Crawling, Indexing và Ranking.",
      "templateId": "frame-bold-poster",
      "inputs": {
        "kicker": "NỀN TẢNG GOOGLE",
        "date": "01 · CƠ CHẾ",
        "figure": "01",
        "headline": ["3 BƯỚC", "GOOGLE", "HOẠT ĐỘNG"],
        "subtitle": "Crawling · Indexing · Ranking",
        "key_points": [
          "Crawling: thu thập dữ liệu",
          "Indexing: lưu nội dung",
          "Ranking: xếp hạng kết quả"
        ],
        "visual_labels": ["Crawling", "Indexing", "Ranking"],
        "footer_left": "SEO CƠ BẢN",
        "footer_right": "01 / 01"
      }
    },
    {
      "id": "outro",
      "type": "outro",
      "voiceText": "Theo dõi kênh để xem thêm các kiến thức SEO dễ hiểu.",
      "templateId": "frame-logo-outro",
      "inputs": {
        "brand_name": "SEO Beginner",
        "tagline": "Kiến thức SEO dễ hiểu",
        "primary_url": ""
      }
    }
  ]
}
```

Đọc thêm quy tắc viết script tại
[SCRIPT-HUONG-DAN.vi.md](SCRIPT-HUONG-DAN.vi.md).

## 7. Tạo video hoàn chỉnh

Đảm bảo OmniVoice vẫn đang chạy, sau đó chạy:

```powershell
npm run pipeline -- output\my-video\script.json
```

Bạn cũng có thể chạy bằng đường dẫn tuyệt đối:

```powershell
npm run pipeline -- "C:\duong-dan\AI_auto_video\output\my-video\script.json"
```

Pipeline sẽ:

1. Kiểm tra `script.json`.
2. Tạo voice cho từng scene.
3. Ghép voice và khoảng nghỉ.
4. Thêm SFX nếu thư viện SFX đã được cài.
5. Render từng template.
6. Ghép các clip.
7. Mux voice vào video.

### Tải và chuẩn bị SFX (không bắt buộc)

Nếu muốn dùng thêm hiệu ứng âm thanh, tải thư viện SFX bằng:

```powershell
npm run sfx:download
```

Mặc định, file được tải vào thư mục `SFX`. Có thể giới hạn số file mỗi từ khóa:

```powershell
npm run sfx:download -- --max 3
```

Sau đó lọc các file có thời lượng từ 0,1 đến 3 giây vào thư mục mà pipeline
đọc được:

```powershell
npm run sfx:filter
```

Tùy chỉnh thư mục nguồn, thư mục đích hoặc thời lượng:

```powershell
npm run sfx:filter -- `
  --source SFX `
  --target assets\sfx `
  --min-sec 0.1 `
  --max-sec 3
```

Các lệnh SFX cần có `ffprobe` trong PATH. Chỉ tải và sử dụng âm thanh khi
nguồn cho phép sử dụng lại.

## 8. File kết quả

Sau khi chạy xong, mở thư mục:

```text
output\my-video\
```

Các file quan trọng:

```text
video.mp4       Video hoàn chỉnh có hình và tiếng
voice.mp3       Track voice riêng
script.txt      Nội dung để tạo phụ đề trong CapCut
video-silent.mp4 Video không có tiếng
```

## 9. Chạy lại nhanh và tiết kiệm

Pipeline lưu cache tại:

```text
output\my-video\.pipeline-cache.json
```

Không xóa các thư mục `voice` và `clips` nếu không cần. Khi chỉ sửa một scene,
pipeline sẽ dùng lại các scene không thay đổi.

- Đổi `voiceText`: scene đó phải tạo voice lại.
- Đổi `inputs` hoặc template: scene đó phải render lại.
- Chỉ đổi nội dung không liên quan: các scene khác vẫn được dùng cache.

Muốn buộc tạo lại một scene, xóa file tương ứng trong `voice` hoặc `clips`.

## 10. Các lỗi thường gặp

### `ECONNREFUSED 127.0.0.1:8123`

OmniVoice chưa chạy hoặc sai cổng. Khởi động OmniVoice và kiểm tra
`OMNIVOICE_ENDPOINT`.

### `ffmpeg is not recognized`

FFmpeg chưa được cài hoặc chưa có trong PATH. Cài lại bằng:

```powershell
winget install Gyan.FFmpeg
```

Sau đó mở PowerShell mới.

### Video không có tiếng

Mở đúng file `video.mp4`, không mở `video-silent.mp4`. Kiểm tra bằng:

```powershell
ffprobe -v error -show_streams output\my-video\video.mp4
```

Kết quả phải có cả stream `video` và `audio`.

## 11. Công nghệ sử dụng

- Node.js 22 trở lên.
- TypeScript và `tsx`.
- HyperFrames `0.6.94` để render HTML thành video.
- OmniVoice local để tạo giọng nói.
- FFmpeg/ffprobe để xử lý media.
