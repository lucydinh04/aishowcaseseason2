# Ahamove AI Showcase 2026 — Production Registration Package

## Architecture

Browser on Vercel  
→ `/api/register` (Vercel Serverless Function)  
→ Google Apps Script Web App  
→ Google Sheet + confirmation email

Google Sheet đã được tạo sẵn:
https://docs.google.com/spreadsheets/d/1kJdRrGM_InkhAGkKs-JIZY-JEI4O7SGfJeOE485A06E/edit

## Folder structure

```text
/
├── index.html
├── INTRO_final.mp4
├── INTRO_final_poster.jpg
├── vercel.json
├── .env.example
├── api/
│   └── register.js
└── apps-script/
    ├── Code.gs
    ├── EmailTemplate.html
    └── appsscript.json
```

## Step 1 — Cài Apps Script

1. Mở Google Sheet:
   https://docs.google.com/spreadsheets/d/1kJdRrGM_InkhAGkKs-JIZY-JEI4O7SGfJeOE485A06E/edit
2. Chọn `Extensions → Apps Script`.
3. Xóa code mặc định.
4. Tạo / cập nhật các file:
   - `Code.gs` → copy nội dung `apps-script/Code.gs`
   - `EmailTemplate.html` → New file → HTML → copy nội dung tương ứng
   - `appsscript.json` → Project Settings → bật `Show "appsscript.json" manifest file` → thay manifest
5. Trong Apps Script chọn function `setupProduction` → Run.
6. Approve quyền Google Sheets + Mail.
7. Mở Execution log và copy `apiSecret`.

## Step 2 — Deploy Apps Script Web App

`Deploy → New deployment → Web app`

- Execute as: **Me**
- Who has access: **Anyone**

Bấm Deploy và copy URL có đuôi `/exec`.

> Dùng URL `/exec`, không dùng `/dev`.

## Step 3 — Cấu hình Vercel

Vào `Project → Settings → Environment Variables`, thêm:

```text
APPS_SCRIPT_WEB_APP_URL=<URL /exec vừa deploy>
REGISTRATION_SHARED_SECRET=<apiSecret từ setupProduction>
```

Áp dụng cho Production (và Preview nếu muốn test Preview).

Redeploy project sau khi thêm env.

## Step 4 — Deploy website

Có thể:
- push folder này lên GitHub rồi Import vào Vercel; hoặc
- dùng Vercel CLI.

Không cần framework/build step riêng. Vercel sẽ serve `index.html` và nhận `/api/register.js` là Serverless Function.

## Google Sheet

Tabs đã có sẵn:
- `Registrations`: dữ liệu đăng ký + trạng thái review
- `Email Log`: log email xác nhận / email BTC
- `Config`: deadline, domain email, admin email, URL website...

Các config quan trọng:
- `FORM_OPEN = TRUE`
- `FORM_DEADLINE = 2026-09-21 23:59:59`
- `SHOWCASE_DATE = 25/09/2026`
- `ALLOWED_EMAIL_DOMAIN = ahamove.com`
- `REJECT_DUPLICATE = TRUE`
- `ADMIN_EMAILS`: có thể thêm email BTC, ngăn cách bằng dấu phẩy
- `EVENT_SITE_URL`: điền URL Vercel sau khi website live

## Logic production đã có

- Server-side validation
- Chặn submit sau deadline
- Chỉ nhận email domain cấu hình
- Team tối thiểu 2, tối đa 3 thành viên
- Member 3 phải đủ cả tên + email
- Chặn một email xuất hiện ở nhiều submission
- Lock chống double-submit race condition
- Registration ID riêng cho từng submission
- Ghi Google Sheet
- Gửi confirmation email đến từng thành viên
- Optional email notification cho BTC
- Email log
- Honeypot bot protection
- Shared secret giữa Vercel ↔ Apps Script
- Không expose Apps Script URL / secret ra browser
- Error handling rõ ràng ở form

## Email xác nhận

Subject:
`[AI SHOWCASE 2026] Đã nhận đăng ký · <Tên Use Case>`

Email xác nhận có:
- Mã đăng ký
- Hình thức
- Use Case
- Danh sách tham gia
- Ngày AI Showcase dự kiến
- Note: đây là xác nhận đã nhận dữ liệu, chưa phải shortlist

## Test trước khi public

1. Đăng ký cá nhân bằng email @ahamove.com.
2. Kiểm tra:
   - form hiện registration ID;
   - row mới xuất hiện trong `Registrations`;
   - email confirmation tới inbox;
   - `email_status = sent`.
3. Thử đăng ký lại cùng email → phải bị chặn duplicate.
4. Test team 2 người.
5. Test team 3 người.
6. Test thiếu một field của member 3 → phải bị chặn.
7. Sau khi test xong, xóa test rows khỏi Sheet nếu cần.


## Kiểm tra 2 asset mới trước khi deploy

### Visual hệ sinh thái trên website
Visual đã được embed trực tiếp vào `index.html` bằng Base64.
Vì vậy mở riêng `index.html` vẫn phải thấy visual, không phụ thuộc file ảnh rời.

### Logo Ahamove trong email
Email production dùng `cid:ahamoveLogo` + `inlineImages`, nên logo chỉ render trong email thật.

Sau khi paste `Code.gs` + `EmailTemplate.html` vào Apps Script:
1. Chọn function `testConfirmationEmail`
2. Bấm Run
3. Approve quyền nếu được hỏi
4. Kiểm tra inbox của tài khoản Apps Script

Bạn cũng có thể mở `EMAIL_PREVIEW.html` để xem trước layout/logo mà không cần gửi email.


## Orbit + background update
- Visual Ahamove/globe hiện đã được bổ sung lại orbit rings động để sinh động hơn.
- Background website đã đổi sang artwork công nghệ mới.
- Logo email đã đổi theo logo mới bạn cung cấp.


## V2 Multi-scene 3D

Website V2 đổi visual khi đi qua từng scene:

1. Hero — AI Core Orbit
2. Bối cảnh — AI Network Globe
3. Dấu ấn Mùa 1 — Memory Crystal / 8 pioneers
4. Điều kiện — Proof Cube
5. Giải thưởng — Impact Monolith
6. BGK — Council Signal Node
7. Đăng ký — AI Registration Portal

Tất cả đều được dựng procedural bằng Three.js trong `index.html`; không cần thêm model GLB.
Transition dùng crossfade + scale + rotation nhẹ để giữ performance và continuity.


## V3 Image-led multi-scene

Bản V3 dùng 2 key visual theo đúng brief:

- Hero / Bối cảnh / Điều kiện / BGK / Đăng ký → `visual_hero_ecosystem.png`
- Dấu ấn Mùa 1 → ẩn visual để tập trung vào video recap
- Giải thưởng và cơ hội phát triển → `visual_prize_studytour.png`

Hệ thống multi-scene giờ chuyển bằng:
- fade
- translate
- scale
- rotateX / rotateY nhẹ

Không dùng flip 180°, nên visual vẫn giữ được cảm giác 3D mà không bị biến dạng.


## Criteria visual update
- Section **Điều kiện / Giải pháp thật. Người dùng thật. Kết quả thật.** dùng key visual riêng `visual_criteria_realproof.png`.
- `index.html` và `PREVIEW_SELF_CONTAINED.html` đã embed trực tiếp asset dưới dạng base64 để tránh lỗi path asset khi preview.


## Criteria layout refinement
- Visual for **Điều kiện** has been shifted further left (`x:-118`) and reduced slightly (`scale:.86`) to avoid colliding with the headline/cards.


## V3 update – BGK + Orbit
- Section **BGK** now uses an embedded self-contained judge visual (`visualJudges`) to avoid broken asset links.
- Added rotating **orbit ring animations** around the global 3D visual stage for a more dynamic motion feel.
- Included `visual_judges_bgk.png` in the package as a backup asset, while both `index.html` and `PREVIEW_SELF_CONTAINED.html` keep the BGK visual embedded inline.


## V4 Centered Layout
- Global scene frame standardized to 1360px and navigation to 1440px.
- Criteria robot visual moved fully to the left; copy/cards occupy the right column.
- Context / Prize / Judges alternate left-copy/right-visual inside one centered composition.
- Season 1 stays centered.
- Registration visual is hidden to prioritize a centered production form.


## V5 Hero Video
- Hero uses `hero_yes_ai_do.mp4` as an autoplay / muted / loop background banner.
- `hero_yes_ai_do_poster.jpg` is the fallback poster.
- The fixed 3D visual is hidden in Hero and resumes from the Bối cảnh section.


## Hero Video Fix
Hero video now follows the supplied reference structure:
- absolute full-bleed media layer
- autoplay / loop / muted / playsinline
- content above the video via z-index
- gradient overlay for readability
- embedded MP4 + embedded poster inside HTML to eliminate asset-path failures
- lightweight scroll parallax


## Registration visual cleanup
- Removed the Season 1 soft badge “8 đội thi tiên phong” next to “Mùa 1”.
- Removed the criteria rule line about 1 person / 1 team.
- Registration scene now uses `asset:'galaxy'`: orbit + aura only, with all 3D image assets hidden.


## V6 Hero HQ
- Hero source re-encoded from the original `Yes ai do.mp4`.
- Native resolution preserved at 2560×1440.
- H.264 High profile, CRF 20, yuv420p, faststart.
- Hero MP4 and poster remain embedded in HTML to avoid asset-path failures.
- Only Hero video quality/grade was changed; all other website content stays untouched.


## V7 fixes
- Registration departments renamed to `Central Operations` and `Supply Operations`.
- Prize cards include inline visual icons:
  - Top 1: plane / Study Tour
  - Top 2: VNĐ
  - Top 3: Rising Star
- Season 1 video is centered at max-width 920px, 16:9, `object-fit: contain`.
- Production index points to `./INTRO_final.mp4` and has a `/INTRO_final.mp4` fallback.
- Self-contained preview embeds the Season 1 video/poster to eliminate artifact-preview path issues.


## V8 Music + Idea Icon
- Top 2 icon changed from `₫` to a vector lightbulb / idea icon.
- Background music uses `INTRO_1.mp3`.
- Audio duration: 130.1s.
- Music attempts autoplay with sound and loops continuously.
- Because Chrome/Safari may block autoplay-with-sound for new visits, the site automatically unlocks playback on the user's first pointer/touch/key/wheel interaction.
- A subtle bottom-left music toggle is included.
- MP3 is embedded in the HTML to avoid asset-path failures, and the physical `INTRO_1.mp3` is also included in the deploy package.


## V9 Smooth transitions
Only transition behavior was refined:
- 3D/image scene changes now interpolate position / scale / rotation / opacity instead of jumping.
- Active visual crossfades with softer scale transition.
- Orbit/aura briefly breathe during each scene switch.
- Section content fades + translates + lightly blurs on enter/exit.
- Hero video dissolves into the galaxy background while leaving Hero.
- Lenis wheel smoothing increased slightly.
- No content, form, backend, prize data, or media assets were changed.


## V10 Audio Fix
- Replaced embedded data-URI MP3 with physical `./INTRO_1.mp3`.
- Immediate autoplay is attempted on page load.
- If autoplay-with-sound is blocked by Chrome/Safari, a small `Bật âm thanh` pill appears.
- First pointer/touch/key interaction directly calls `audio.play()` to satisfy browser gesture policies.
- Background music pauses while the Season 1 video plays and resumes afterwards.
- Existing bottom-left music toggle is retained.


## V12 Scroll-back transition fix
- Removed overlapping scrubbed entrance/exit tweens on section content.
- `onEnter` / `onEnterBack` always restore content to full visibility.
- `onLeave` / `onLeaveBack` only soften content after it leaves the viewport.
- Old tweens are killed before new ones run, preventing stale opacity/blur states.
- Added pageshow/focus restore for the currently visible section.
- 3D/orbit transitions, content, form, backend, audio and media are unchanged.


## V13 Visual sharpness
- Source artwork was verified at 1254–1312px; blur was caused by browser rendering, not low-resolution assets.
- Removed heavy CSS drop-shadow filters from the raster 3D artwork.
- Reduced inactive scale from 0.94 to 0.985 and shortened image crossfade.
- Stage opacity now settles much faster.
- Orbit/aura temporarily dim during scene handoff so the new 3D object stays visually dominant.
- Scene activation starts earlier, reducing the period where a visual is half-visible.
- Layout, copy, form, backend, music and section-content transitions are unchanged.


## V14 Audience / Season 1 cleanup
- Removed `ĐỐI TƯỢNG — Toàn bộ Ahamovers — tech & non-tech` from Bối cảnh.
- Replaced the Criteria participation pill with:
  `ĐỐI TƯỢNG — Toàn bộ Ahamovers — Tech & Non-tech`.
- Removed the idea/lightbulb icon from the Mùa 1 badge; badge now shows text only.
- No other content, visual, form, backend, audio or transition logic was changed.


## V15 3D transition controller fix
- Replaced IntersectionObserver ownership for 3D visuals with viewport-center ownership.
- The section crossing the center of the viewport is now the single source of truth for the active visual.
- Previous 3D artwork is explicitly hidden before the next artwork is shown.
- Register state is enforced as galaxy-only; judge artwork cannot remain behind the form.
- Rapid trackpad / wheel scroll no longer leaves stale artwork visible.
- Content/layout/form/backend/audio were not changed.


## V16 Crisp 3D render
- Verified source images are 1254–1312px and sufficiently sharp.
- Removed transform scale/rotation from the raster PNG rendering path.
- Scene size changes now use actual CSS `width/right/top` geometry instead of transform scaling.
- Raster artwork transitions only by opacity.
- Mouse parallax is applied only to aura/orbit FX, never to the PNG itself.
- This avoids Chrome compositor resampling that made Context / Criteria / Prize look softer than BGK.
