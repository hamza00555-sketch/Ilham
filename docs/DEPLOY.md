# النشر خطوة بخطوة (مجاني، بدون Blaze)

الإعداد كله مجاني وما يحتاج بطاقة:

- **Firebase على خطة Spark:** فيه Firestore و Auth بس.
- **Vercel Hobby:** يشغّل الموقع ومعالجة الروابط، ويحفظ البريفيوهات في Vercel Blob.

لو خلصت الكوتا المجانية، الخدمة توقف لين يتجدد الشهر أو اليوم. ما تنسحب منك فلوس.

> الوقت: 20 دقيقة تقريباً. اسم مشروع Firebase المستخدم هنا: `ilham-e2e04`.
> أسماء الأزرار مكتوبة بالإنجليزي مثل ما تطلع في الـ console.

---

## أ. Firebase (خطة Spark)

### 1. تأكد إن المشروع على Spark

1. افتح [console.firebase.google.com](https://console.firebase.google.com) واختار مشروع **ilham-e2e04**.
2. تحت يسار الصفحة لازم تشوف **Spark**. لا تضغط **Upgrade**.

### 2. أنشئ قاعدة Firestore

1. من القائمة: **Build ← Firestore Database ← Create database**.
2. لو سألك عن الـ edition، اختار **Standard edition**.
3. **Location:** اختار **`me-central2 (Dammam)`**، لأنه أقرب شي للخليج.
   - ⚠️ المكان **ما يتغير بعدين أبد**.
4. اختار **Start in production mode** ← **Create**. القواعد الصح بتنرفع في خطوة 5.

### 3. فعّل تسجيل الدخول

1. من القائمة: **Build ← Authentication ← Get started**.
2. **Sign-in method ← Google ← Enable**. اختار إيميلك في **Project support email** ← **Save**.
3. **Add new provider ← Email/Password**:
   - فعّل **Email/Password**.
   - وفعّل تحته **Email link (passwordless sign-in)**.
   - ← **Save**.

> على Spark، الدخول بالإيميل محدود بـ **5 رسائل باليوم**. Google هو الطريق الأساسي.

### 4. خذ مفتاح السيرفر (Service account)

هذا اللي يخلي Vercel يكتب في Firestore. **سري**: لا ترفعه على GitHub، ولا ترسله لأحد في شات.

1. ⚙️ **Project settings ← Service accounts**.
2. تحت **Firebase Admin SDK**: **Generate new private key ← Generate key**.
3. ينزل عندك ملف JSON. خلّه قريب، بتحتاجه في خطوة 7.

### 5. ارفع قواعد الحماية والـ index

**الطريقة الأسهل (من الـ console، بدون terminal):**

1. **Firestore Database ← Rules**:
   - امسح الموجود، والصق محتوى ملف [`firestore.rules`](../firestore.rules) من الريبو.
   - ← **Publish**.
2. **Firestore Database ← Indexes ← Composite ← Create index**:
   - **Collection ID:** `items`
   - **Fields:** `projectId` Ascending · `status` Ascending · `addedAt` Descending
   - **Query scope:** Collection
   - ← **Create**. ياخذ دقيقتين يجهز.

**أو من جهازك:** إذا عندك Node.js.

```bash
git clone https://github.com/hamza00555-sketch/Ilham && cd Ilham
npx firebase-tools login
npm run deploy:firebase      # يرفع firestore.rules و firestore.indexes.json
```

---

## ب. Vercel

### 6. استورد الريبو

1. افتح [vercel.com/new](https://vercel.com/new) ← **Import Git Repository** ← **hamza00555-sketch/Ilham** ← **Import**.
   - ما طلع الريبو؟ اضغط **Adjust GitHub App Permissions** وأضفه.
2. **Project Name:** `ilham`.
   - **Framework Preset:** بيطلع Next.js لحاله.
   - **Root Directory:** خلّه `./`.

### 7. حط المتغيرات قبل أول Deploy

افتح **Environment Variables**. تقدر تلصق كل السطور مرة وحدة في أول خانة، و Vercel يقسمها لحاله.

| Key | Value |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | من **Project settings ← General ← Your apps ← Web app ← SDK setup and configuration ← Config** |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `ilham-e2e04.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `ilham-e2e04` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `ilham-e2e04.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | من نفس الـ Config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | من نفس الـ Config |
| `FIREBASE_SERVICE_ACCOUNT` | افتح ملف الـ JSON من خطوة 4، وانسخ **كل** محتواه والصقه هنا |
| `ILHAM_ALLOWED_EMAILS` | إيميل Google اللي بتدخل فيه. لو أكثر من واحد: `a@x.com,b@y.com` |

لا تضيف `NEXT_PUBLIC_USE_EMULATORS`. هذا للتجربة المحلية بس.

بعدها اضغط **Deploy** وانتظر لين يخلص (دقيقتين تقريباً).

### 8. أنشئ مخزن البريفيوهات (Blob)

1. في صفحة المشروع على Vercel: **Storage ← Create Database ← Blob ← Continue**.
2. سمّه `ilham-previews`.
   - **Region:** اختار الأقرب لك (مثلاً **fra1** أو **iad1**).
   - ← **Create**.
3. اربطه بالمشروع **ilham** لكل البيئات (Production · Preview · Development) ← **Connect**.
   - هذا يضيف `BLOB_READ_WRITE_TOKEN` لحاله.
4. **Deployments ←** آخر deployment ← **⋯ ← Redeploy**. المتغيرات الجديدة ما تشتغل إلا على deploy جديد.

### 9. انسخ الدومين

من **Overview** في المشروع انسخ الدومين، مثل `ilham-xxxx.vercel.app`.

---

## ج. رجوع لـ Firebase

### 10. اسمح للدومين يسجل دخول

**Authentication ← Settings ← Authorized domains ← Add domain**:

- الصق الدومين **بدون** `https://`، مثل `ilham-xxxx.vercel.app`.
- ← **Add**.

لو ربطت دومين خاص بعدين، أضفه هنا بعد.

---

## د. جرّب

1. افتح الدومين ← **المتابعة بـ Google**.
2. سوّ مشروع جديد، والصق رابط YouTube. لازم يطلع البريفيو خلال ثواني.
3. جرّب رابط Dribbble. بيطلع كرت fallback لأن Dribbble يحجب السيرفرات. ارفع له screenshot من **أضف بريفيو**.

### لو صار شي

| اللي تشوفه | السبب | الحل |
|---|---|---|
| `auth/unauthorized-domain` أو "هذا الدومين مو مضاف" | خطوة 10 ناقصة | أضف الدومين في Authorized domains |
| "هذا الحساب مو ضمن المسموح لهم" | إيميلك مو في `ILHAM_ALLOWED_EMAILS` | صحّحه في Vercel ← Settings ← Environment Variables، وبعدها Redeploy |
| البريفيو يفشل دايماً، و Vercel ← **Logs** فيها `BLOB_READ_WRITE_TOKEN is not set` | خطوة 8 ناقصة، أو ما سويت Redeploy | اربط الـ Blob store وسوّ Redeploy |
| Logs فيها `FIREBASE_SERVICE_ACCOUNT` أو `invalid_grant` | الـ JSON ناقص أو ملصوق غلط | الصق الملف كامل من `{` إلى `}`، وسوّ Redeploy |
| المشاريع ما تنفتح، والـ console فيه `requires an index` | الـ index من خطوة 5 ما خلص | انتظر لين يصير **Enabled**، أو اضغط الرابط اللي في الخطأ |
| ما يقدر يحفظ (`permission-denied`) | القواعد ما انرفعت | ارفع `firestore.rules` (خطوة 5) |

---

## الحدود المجانية (وش يعني لك)

| الخدمة | المجاني | يكفي لـ |
|---|---|---|
| Firestore (Spark) | 1 GiB · 50K قراءة و 20K كتابة باليوم | استخدام يومي ثقيل لشخص أو فريق صغير |
| Vercel Blob (Hobby) | 1 GB · 10 GB نقل · 2,000 رفع بالشهر | ~6,000 مرجع مخزن، و ~1,000 مرجع جديد بالشهر |
| Vercel Functions (Hobby) | ضمن حصة حسابك | طلب واحد لكل مرجع |
| Auth | Google بدون حد عملي · Email link 5 باليوم | — |

> Vercel Hobby للاستخدام الشخصي. لو صار إلهام أداة شغل تجاري لاستوديو، انقل المشروع لـ Vercel Pro.
