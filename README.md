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
- `/api/ingest` على Vercel يحوّل الرابط لبريفيو: oEmbed ← OpenGraph ← Jina Reader (للمواقع اللي تحجب السيرفرات مثل Dribbble و Behance، و `JINA_API_KEY` اختياري) ← Microlink، وبعدها sharp يطلع WebP بمقاسين + LQIP + palette، وتنحفظ في Vercel Blob
- منع التكرار: الرابط يتنظّف (tracking و `youtu.be`…) وينحسب له hash، ويصير جزء من الـ doc ID
- الكروت تتحدث live، وقائمة `⋯` فيها: فتح المصدر، نسخ، تغيير البريفيو، Retry، نقل، حذف مع تراجع
- **بنتو داخل المشروع (المراجع والوارد):** في الوارد، احتفظ / ارمِ على كل مربع، وسبب الوكيل يطلع مع الـ hover.
- **المقاسات:** كل مرجع ياخذ مربع على قد شكله (كبير، عريض، طويل، صغير)، والمربعات تتعبّى بدون فراغات وآخر صف يقفل كامل. الجوال عمودين، والكمبيوتر 6 أو 8، والكبير ما يتعدى ثلث الصفحة
- **صفحة المرجع:** الضغطة على الكرت تفتح المرجع (`?ref=…`): الفيديو بمشغّله، وصاحب العمل وملف أعماله، وتاريخ النشر، ووصفه من صفحته، وكيف انسوى، والبرامج المستخدمة، والوسوم، وملاحظاتك وملاحظات الوكيل. الأسهم تنقلك بين المراجع
- المعلومات تنسحب تلقائياً من الصفحة (JSON-LD، OpenGraph، oEmbed حق Vimeo، وصف YouTube)، والبرامج تنعرف من الوصف (Blender، Cinema 4D، After Effects…). اللي ما تعطيه الصفحة، الوكيل يدوّر عليه
- المواقع اللي تحجب السيرفرات (Dribbble و Behance) تنقرا عن طريق Jina Reader. ولو فشل، يطلع كرت بهوية المنصة وتقدر ترفع له screenshot أو تحط رابط صورة، والكرت ينعاد مرة كل زيارة
- مراجع الفيديو تتحرك عند الـ hover (loop مخزّن أو embed رسمي صامت)، ووحدة بس تشتغل في نفس الوقت، وما يشتغل شي مع reduced-motion

## الوكلاء (Phase 2)

- **الوكلاء** من قائمتك ← `/settings`: المفتاح يظهر مرة وحدة، ومعه إعداد Codex و Claude Code والتعليمات جاهزة.
- **MCP:** `https://<الدومين>/api/mcp` مع `Authorization: Bearer ilham_sk_…`
- **REST:** `/api/v1/projects` · `/api/v1/projects/{slug}` · `…/items` (POST لين 50) · `…/items/{id}` (GET، PATCH) · `…/items/{id}/notes` (POST) · `…/taste` · `/api/v1/runs`
- كل اللي يضيفه الوكيل يوصل لـ **✦ الوارد** في المشروع مع سببه، وأنت تحتفظ أو ترمي. المرفوض يعلّم `get_taste` ذوقك.
- **المراجعة إعداد:** من صفحة «الوكلاء» تقفلها للحساب كله (اقتراحات الوكيل تنضاف للمراجع مباشرة وعليها ✦)، ومن قائمة ⋯ في أي مشروع تختار له: «حسب الإعداد العام» أو «راجعها في الوارد» أو «أضفها مباشرة». الوكيل يشوف `review` في `list_projects` و`get_project`، و`add_inspiration` يرجّع `landedIn`.
- الوكيل يرسل مع كل مرجع معلوماته: `creator` و`creatorUrl` و`publishedAt` و`tools` و`process` و`note`. معلومات الصفحة نفسها تغلب لو موجودة.
- **الملاحظات:** `add_note` يترك لك ملاحظة على مرجع، و`get_item` يقرأ ردودك (`lastNoteBy: "user"` يعني إنك كتبت له).

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
