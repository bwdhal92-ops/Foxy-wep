// ===== لون البروفايل (avatarColor / bannerColor) =====
// مصدر واحد للحقيقة: باليت الألوان + helpers.
// بيتستخدم في login.html (إنشاء الحساب) و web.html (عرض الأفاتار والغلاف).
// ملاحظة: لازم يفضل نضيف من غير أي side effects عشان login.html بيستورده قبل الـ DOM.

export const PROFILE_COLORS = ["#5865f2", "#3b82f6", "#06b6d4", "#10b981", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899", "#a855f7", "#8b5cf6", "#14b8a6"];
export const FALLBACK_PROFILE_COLOR = "#5865f2";

const COLOR_VALUE_RE = /^(#[0-9a-f]{3,8}|rgb\([\d\s,.%]+\)|rgba\([\d\s,.%]+\))$/i;

export function isValidProfileColor(value) {
  return COLOR_VALUE_RE.test(String(value || "").trim());
}

export function identityHash(value) {
  let hash = 2166136261;
  for (const char of String(value || "User")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// لون عشوائي — بيتاخد مرة واحدة بس وقت إنشاء الحساب وبيتحفظ في الفايربور
// عشان كل المستخدمين (وأي عميل تاني) يشوفوا نفس اللون لنفس المستخدم.
export function getRandomProfileColor() {
  return PROFILE_COLORS[Math.floor(Math.random() * PROFILE_COLORS.length)];
}

// لو المستخدم مالوش لون محفوظ، نرجع لون ثابت مشتق من الـ uid
// (مش عشوائي) عشان يفضل اللون واحد عند كل الناس لحد ما يتحفظ.
export function getStableProfileColor(identity) {
  return PROFILE_COLORS[identityHash(identity) % PROFILE_COLORS.length];
}

export function resolveProfileColor(identity, explicit) {
  return isValidProfileColor(explicit) ? String(explicit).trim() : getStableProfileColor(identity);
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
}

// الأسود والرمادي القريب منهم لا يصلح كخلفية، فبنستبعدهم.
function isUsableBannerColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max >= 24 && (max - min) >= 12;
}

// بيقرأ اللون الغالب من صورة واحدة (50x50) وبيتجاهل الشفاف والأسود والأبيض.
// بيرجع null عند أي فشل — والمتصفح بيستخدم اللون العشوائي ساعتها.
function readDominantColor(img) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 50;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 50, 50);
    const data = ctx.getImageData(0, 0, 50, 50).data;
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (avg < 20 || avg > 235) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    if (count === 0) return null;
    const hex = rgbToHex(r / count, g / count, b / count);
    return isUsableBannerColor(hex) ? hex : null;
  } catch (_) {
    // الـ canvas اتلوّث بسبب CORS — نرجع null والـ caller يجرب الطريقة اللي بعدها
    return null;
  }
}

function loadForCanvas(src, timeoutMs) {
  return new Promise(resolve => {
    const img = new Image();
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = src;
  });
}

// بيسحب اللون الغالب من صورة (بروفايل جوجل مثلاً) عشان الغلاف يكون قريب من صورة الأفاتار.
// الأسود/الأبيض القريب منهم ما يصلحش كخلفية، فبنستبعدهم والمتصفح بي fallback على اللون العشوائي.
//
// استراتيجيتين بالترتيب:
//   1) تحميل مباشر — أسرع، وبيشتغل لو السيرفر بيبعت CORS (زي imgbb). بنمهله شوية.
//   2) wsrv.nl كـ proxy — ضرروري للصور اللي مبعتش CORS (زي صور جوجل).
// سقف الزمن مهم: الدالة دي بتتسنّاها أثناء تسجيل الدخول،
// فمفيش انتظار مفتوح — كل محاولة ليها تايم آوت واضح وبعدها بنرجع لون عشوائي.
export async function extractPhotoColor(url, directTimeoutMs = 1500, proxyTimeoutMs = 4000) {
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  if (typeof Image === "undefined" || typeof document === "undefined") return null;
  const direct = await loadForCanvas(url, directTimeoutMs);
  if (direct) {
    const color = readDominantColor(direct);
    if (color) return color;
  }
  if (!proxyTimeoutMs) return null;
  const viaProxy = await loadForCanvas("https://wsrv.nl/?url=" + encodeURIComponent(url) + "&w=50&h=50&fit=cover&output=jpg", proxyTimeoutMs);
  return viaProxy ? readDominantColor(viaProxy) : null;
}

// ===== منطق التهيئة المستخدم عند الدخول =====
// بيرجّع الحقول اللي لازم تتكتب في مستند المستخدم (أو null لو مفيش تغيير).
// baseColor: لون من مستند المستخدم الحالي (bannerColor القديم) لو موجود.
export async function buildProfileColorPatch(userDoc, photoURL, baseColor) {
  const hasPhoto = !!photoURL && /^https?:\/\//i.test(photoURL);
  // المستخدم حط غلاف صورة => مش محتاجين لون خالص، سيب اللون زي ما هو.
  const hasBannerImage = !!(userDoc && userDoc.bannerURL);
  const current = isValidProfileColor(userDoc && userDoc.avatarColor) ? String(userDoc.avatarColor).trim() : "";
  const legacy = isValidProfileColor(baseColor) ? String(baseColor).trim() : "";

  // مستخدم جديد أو مالوش لون خالص: نجيب لون من صورة جوجل لو موجودة، وإلا عشوائي.
  if (!current) {
    let picked = null;
    if (hasPhoto) picked = await extractPhotoColor(photoURL);
    if (!picked) picked = legacy && isUsableBannerColor(legacy) ? legacy : getRandomProfileColor();
    const patch = { avatarColor: picked };
    // نلمس bannerColor بس لو مفيش غلاف صورة (الخلاف بيتقفل بلون مطابق للأفاتار).
    if (!hasBannerImage) patch.bannerColor = picked;
    return patch;
  }

  // المستخدم عنده لون بس دايماً على `#3b82f6` الافتراضي القديم وماتغيرش من أول مرة
  // وعنده صورة جوجل من غير غلاف صورة => نجدد اللون من الصورة (أول مرة بس).
  const looksUntouched = !legacy || legacy === FALLBACK_PROFILE_COLOR;
  if (!hasBannerImage && hasPhoto && looksUntouched) {
    const picked = await extractPhotoColor(photoURL);
    if (picked) return { avatarColor: picked, bannerColor: picked };
  }
  if (!hasBannerImage && userDoc && userDoc.bannerColor === undefined) {
    return { bannerColor: current };
  }
  return null;
}
