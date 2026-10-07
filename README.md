# Ilham ✦ إلهام

منصة استلهام شخصية بروح Dribbble و Behance، للجوال والكمبيوتر.
المراجع تتجمع في مشاريع، تضيفها أنت أو الإيجنت، وكل كرت يوديك لصفحة العمل الأصلية.

- 📐 الخطة الكاملة: [`docs/PLAN.md`](docs/PLAN.md)
- 🎨 نظام التصميم ("The Light Table"): [`DESIGN.md`](DESIGN.md) · حقيقة المنتج: [`PRODUCT.md`](PRODUCT.md)
- 🧰 مهارات التصميم للإيجنت: [`.claude/skills/SOURCES.md`](.claude/skills/SOURCES.md)
- 🚀 النشر خطوة بخطوة (مجاني، بدون Blaze): [`docs/DEPLOY.md`](docs/DEPLOY.md)
- 🧱 Stack: Next.js 16 (App Router) · Tailwind v4 · Firebase Spark (Firestore · Auth) · Vercel (route handlers · Blob)

## اللي شغال الحين (Phase 0 + 1)

- تسجيل دخول بـ Google أو برابط على الإيميل
- مشاريع: إنشاء، وإعادة تسمية، وحذف، وغلاف collage يتحدث لحاله
- إضافة رابط: `⌘V` في أي مكان، أو تسحب الرابط على الصفحة، أو زر الإضافة، أو صفحة `/add` (bookmarklet + مشاركة من أندرويد)
- `/api/ingest` على Vercel يحوّل الرابط لبريفيو: oEmbed ← OpenGraph ← Microlink، وبعدها sharp يطلع WebP بمقاسين + LQIP + palette، وتنحفظ في Vercel Blob
- منع التكرار: الرابط يتنظّف (tracking و `youtu.be`…) وينحسب له hash، ويصير جزء من الـ doc ID
- الكروت تتحدث live، والضغطة تفتح العمل الأصلي، وقائمة `⋯` فيها: نسخ، تغيير البريفيو، Retry، نقل، حذف مع تراجع
- المواقع اللي تحجب السيرفرات (Dribbble و Behance): يطلع كرت fallback بهوية المنصة، وتقدر ترفع له screenshot أو تحط رابط صورة
- مراجع الفيديو تتحرك عند الـ hover (loop مخزّن أو embed رسمي صامت)، ووحدة بس تشتغل في نفس الوقت، وما يشتغل شي مع reduced-motion

## الوكلاء (Phase 2)

- **مفاتيح الوكلاء** من قائمتك ← `/settings`: المفتاح يظهر مرة وحدة، ومعه إعداد Codex و Claude Code والتعليمات جاهزة.
- **MCP:** `https://<الدومين>/api/mcp` مع `Authorization: Bearer ilham_sk_…`
- **REST:** `/api/v1/projects` · `/api/v1/projects/{slug}` · `…/items` (POST لين 50) · `…/items/{id}` (PATCH) · `…/taste` · `/api/v1/runs`
- كل اللي يضيفه الوكيل يوصل لـ **✦ الوارد** في المشروع مع سببه، وأنت تحتفظ أو ترمي. المرفوض يعلّم `get_taste` ذوقك.

## التشغيل محلياً (بدون ما تلمس Firebase الحقيقي)

```bash
npm install
npm run emulators          # Auth · Firestore على 127.0.0.1 (يحتاج Java 21)
npm run dev:emulators      # بنافذة ثانية → http://localhost:3000
```

الـ route handlers تشتغل داخل `next dev`، والبريفيوهات تنحفظ في `.blobs/` بدل Vercel Blob.

```bash
npm test                   # unit tests (normalize · SSRF guard · metadata · colors)
npm run typecheck && npm run lint
```

## النشر

كل الخطوات بالترتيب في [`docs/DEPLOY.md`](docs/DEPLOY.md): Firebase على Spark (مجاني بدون بطاقة)، وبعدها Vercel مع Blob store.

## هيكل الريبو

```
app/            صفحات Next.js (المشاريع · /p/[slug] · /add · /auth/finish)
components/     الواجهة (shell · projects · project · ui)
lib/            Firebase client · auth · طبقة البيانات
app/api/        ingest · sync · keys · v1 (REST للوكلاء) · mcp · dev-blob (محلي بس)
server/         كود السيرفر بس: firebase-admin · auth · blob · stats · ingest/ · agent/ (keys · service · schemas)
shared/         كود مشترك بين الواجهة والسيرفر (normalize · colors · types · video)
tests/          vitest
```
