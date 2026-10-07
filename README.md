# Ilham ✦ إلهام

منصة استلهام شخصية بروح Dribbble و Behance، للجوال والكمبيوتر.
المراجع تتجمع في مشاريع، تضيفها أنت أو الإيجنت، وكل كرت يوديك لصفحة العمل الأصلية.

- 📐 الخطة الكاملة: [`docs/PLAN.md`](docs/PLAN.md)
- 🎨 نظام التصميم ("The Light Table"): [`DESIGN.md`](DESIGN.md) · حقيقة المنتج: [`PRODUCT.md`](PRODUCT.md)
- 🧰 مهارات التصميم للإيجنت: [`.claude/skills/SOURCES.md`](.claude/skills/SOURCES.md)
- 🧱 Stack: Next.js 16 (App Router) · Tailwind v4 · Firebase (Firestore · Auth · Storage · Functions) · Vercel

## اللي شغال الحين (Phase 0 + 1)

- تسجيل دخول بـ Google أو برابط على الإيميل
- مشاريع: إنشاء، وإعادة تسمية، وحذف، وغلاف collage يتحدث لحاله
- إضافة رابط: `⌘V` في أي مكان، أو تسحب الرابط على الصفحة، أو زر الإضافة، أو صفحة `/add` (bookmarklet + مشاركة من أندرويد)
- Cloud Function تحوّل الرابط لبريفيو: oEmbed ← OpenGraph ← Microlink، وبعدها sharp يطلع WebP بمقاسين + LQIP + palette
- منع التكرار: الرابط يتنظّف (tracking و `youtu.be`…) وينحسب له hash، ويصير جزء من الـ doc ID
- الكروت تتحدث live، والضغطة تفتح العمل الأصلي، وقائمة `⋯` فيها: نسخ، تغيير البريفيو، Retry، نقل، حذف مع تراجع
- المواقع اللي تحجب السيرفرات (Dribbble و Behance): يطلع كرت fallback بهوية المنصة، وتقدر ترفع له screenshot أو تحط رابط صورة
- مراجع الفيديو تتحرك عند الـ hover (loop مخزّن أو embed رسمي صامت)، ووحدة بس تشتغل في نفس الوقت، وما يشتغل شي مع reduced-motion

## التشغيل محلياً (بدون ما تلمس Firebase الحقيقي)

```bash
npm install
npm --prefix functions install
npm run emulators          # Auth · Firestore · Storage · Functions على 127.0.0.1 (يحتاج Java 21)
npm run dev:emulators      # بنافذة ثانية → http://localhost:3000
```

```bash
npm test                   # unit tests (normalize · SSRF guard · metadata · colors)
npm run typecheck && npm run lint
```

## الإعداد لأول مرة على Firebase (مرة وحدة)

1. **Blaze plan:** من Firebase Console ← Usage and billing. وحط **budget alert** على $5 من Google Cloud Billing.
2. **Firestore:** Create database ← Standard ← المنطقة **`us-central1`** (ما تتغير بعدين).
3. **Storage:** Get started ← نفس المنطقة `us-central1` (عشان تبقى في الكوتا المجانية).
4. **Authentication:** فعّل **Google**، وفعّل **Email/Password** مع خيار **Email link (passwordless)**.
5. من جهازك:
   ```bash
   npx firebase-tools login
   npm run deploy:firebase   # rules + indexes + storage rules + functions
   ```
6. بعد ما تسجّل أنت، اقفل التسجيل الجديد من Authentication ← Settings ← User actions.

## النشر على Vercel

1. Import للريبو في Vercel.
2. أضف متغيرات `NEXT_PUBLIC_FIREBASE_*` من [`.env.example`](.env.example). القيم موجودة في Firebase ← Project settings ← Web app.
3. أضف دومين Vercel في Firebase ← Authentication ← Settings ← **Authorized domains**.

## هيكل الريبو

```
app/            صفحات Next.js (المشاريع · /p/[slug] · /add · /auth/finish)
components/     الواجهة (shell · projects · project · ui)
lib/            Firebase client · auth · طبقة البيانات
shared/         كود مشترك بين الواجهة والـ functions (normalize · colors · types)
functions/      Cloud Functions: ingestItem (رابط ← بريفيو) · syncProjectStats (العدادات والغلاف)
tests/          vitest
```
