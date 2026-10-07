/** Plain-language message for Firebase and network errors; never shows raw SDK text. */
export function friendlyError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code.includes("network-request-failed") || code === "unavailable") return "ما فيه اتصال. تأكد من الإنترنت وجرّب مرة ثانية.";
  if (code.includes("too-many-requests") || code === "resource-exhausted") return "محاولات كثيرة. انتظر شوي وجرّب.";
  if (code.includes("permission-denied") || code === "unauthenticated") return "ما عندك صلاحية لهذا. سجّل دخول مرة ثانية.";
  if (code.includes("invalid-email")) return "الإيميل مكتوب غلط.";
  if (code.includes("unauthorized-domain")) return "هذا الدومين مو مضاف في إعدادات Firebase Auth.";
  if (code.includes("quota-exceeded")) return "انتهت حصة الاستخدام لليوم.";
  if (code === "not-allowed") return "هذا الحساب مو ضمن المسموح لهم في إلهام.";
  if (code === "invalid-upload") return "الملف لازم يكون صورة.";
  return "صار خطأ غير متوقع. جرّب مرة ثانية.";
}
