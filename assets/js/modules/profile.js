import {
  db as e,
  auth as t,
  rtdb as n
} from "../firebase-config.js";
import {
  updateProfile as o,
  GoogleAuthProvider,
  linkWithPopup,
  reauthenticateWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  doc as a,
  updateDoc as i,
  getDoc as s
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
  ref as r,
  update as d
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import {
  createAvatarHTML as l,
  applyBannerStyle as c,
  applyAvatarToPair as m,
  getAvatarSrc as u
} from "./ui-avatar-banner.js?v=20260929-2";
window.pendingBannerURL = null, window.pendingBannerDelete = !1, window.pendingAvatarURL = null, window.pendingAvatarDelete = !1, window.pendingAvatarColor = null;
window.settingsOriginalValues = {};
window._settingsDirty = false;
window._socialLinks = {};
try { const _sl = localStorage.getItem("vh-user-socialLinks"); if (_sl) window._socialLinks = JSON.parse(_sl) || {}; } catch (e) {}
window._socialVerified = {};
try { const _sv = localStorage.getItem("vh-user-socialVerified"); if (_sv) window._socialVerified = JSON.parse(_sv) || {}; } catch (e) {}
window.SOCIAL_PLATFORMS = {
  facebook: { label: "فيسبوك", color: "#1877F2", bg: "rgba(24,119,242,.14)", border: "rgba(24,119,242,.45)", domains: ["facebook.com", "fb.com", "fb.watch"], placeholder: "https://facebook.com/username", svg: '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.5V11H8.5v3H11v7h2.5z"/></svg>' },
  instagram: { label: "انستقرام", color: "#E1306C", bg: "rgba(225,48,108,.14)", border: "rgba(225,48,108,.45)", domains: ["instagram.com", "instagr.am"], placeholder: "https://instagram.com/username", svg: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none"/></svg>' },
  twitter: { label: "تويتر (X)", color: "#e7e9ea", bg: "rgba(231,233,234,.12)", border: "rgba(231,233,234,.4)", domains: ["x.com", "twitter.com"], placeholder: "https://x.com/username", svg: '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L2 3h6.4l4.4 5.9L17.8 3zm-1.1 16.1h1.7L7.4 4.8H5.6l11.1 14.3z"/></svg>' },
  youtube: { label: "يوتيوب", color: "#FF0000", bg: "rgba(255,0,0,.13)", border: "rgba(255,0,0,.45)", domains: ["youtube.com", "youtu.be"], placeholder: "https://youtube.com/@channel", svg: '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23 12s0-3.8-.5-5.5c-.3-1-1-1.7-2-2C18.8 4 12 4 12 4s-6.8 0-8.5.5c-1 .3-1.7 1-2 2C1 8.2 1 12 1 12s0 3.8.5 5.5c.3 1 1 1.7 2 2 1.7.5 8.5.5 8.5.5s6.8 0 8.5-.5c1-.3 1.7-1 2-2 .5-1.7.5-5.5.5-5.5zM9.8 15.5v-7l6 3.5-6 3.5z"/></svg>' },
  tiktok: { label: "تيك توك", color: "#25F4EE", bg: "rgba(37,244,238,.12)", border: "rgba(37,244,238,.4)", domains: ["tiktok.com"], placeholder: "https://tiktok.com/@username", svg: '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 3c.4 2.3 1.9 3.8 4.5 4v3c-1.7 0-3.2-.5-4.5-1.4v6.6c0 3.8-2.7 6.3-6.1 6.3-3.3 0-5.9-2.5-5.9-5.8 0-3.4 2.8-5.9 6.4-5.7v3.2c-1.7-.4-3.3.7-3.3 2.5 0 1.5 1.2 2.6 2.7 2.6 1.6 0 2.8-1.2 2.8-3V3h2.9z"/></svg>' },
  twitch: { label: "تويتش", color: "#9146FF", bg: "rgba(145,70,255,.14)", border: "rgba(145,70,255,.5)", domains: ["twitch.tv"], placeholder: "https://twitch.tv/username", svg: '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 2L2.5 6v14h5v2h3l2-2h4l5-5V2H4zm15.5 12l-3 3h-4l-2 2v-2H7V4h12.5v10zM17 7h-2v5h2V7zm-4.5 0H10.5v5h2V7z"/></svg>' },
  kick: { label: "كيك", color: "#53FC18", bg: "rgba(83,252,24,.12)", border: "rgba(83,252,24,.45)", domains: ["kick.com"], placeholder: "https://kick.com/username", svg: '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 3h4v7h6l4-7h4l-5.5 8L22 21h-4l-3.5-5.5L12 18v3H4V3zm8 8.5V7l-1.5 2 1.5 2.5z"/></svg>' },
  steam: { label: "ستيم", color: "#66C0F4", bg: "rgba(102,192,244,.13)", border: "rgba(102,192,244,.5)", domains: ["steamcommunity.com", "steampowered.com", "store.steampowered.com", "s.team"], placeholder: "https://steamcommunity.com/id/username", svg: '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a10 10 0 00-9.9 8.6l5.7 2.4c.4-.6 1.1-1 1.9-1h.1l3.2-4.7v-.1c0-1.2 1-2.2 2.2-2.2s2.2 1 2.2 2.2-1 2.2-2.2 2.2h-.1l-4.6 3.3c0 .1 0 .1 0 .2 0 1-.8 1.8-1.8 1.8-.7 0-1.4-.4-1.7-1l-5.2 2.2A10 10 0 1012 2zm4.2 3.1c0-.6.5-1.1 1.1-1.1s1.1.5 1.1 1.1-.5 1.1-1.1 1.1-1.1-.5-1.1-1.1zM9.4 13.6c0-.5.4-.9.9-.9s.9.4.9.9-.4.9-.9.9-.9-.4-.9-.9zm3.4 5.1c-1.2 0-2.3-.6-3-1.5l1.8-.8c.3.4.9.6 1.4.5.8-.1 1.4-.9 1.3-1.7-.1-.8-.9-1.4-1.7-1.3-.3 0-.6.1-.8.3l1.5.6c.4.2.6.7.4 1.1-.2.4-.7.6-1.1.4l-1.9-.8c-.2.3-.3.7-.3 1 0 1 .8 1.9 1.9 1.9 1 0 1.9-.8 1.9-1.9h1.1c0 1.7-1.4 3-3 3l.5-1.1z"/></svg>' },
  epic: { label: "إيبك جيمز", color: "#FFFFFF", bg: "rgba(255,255,255,.10)", border: "rgba(255,255,255,.4)", domains: ["epicgames.com", "epicgames.store"], placeholder: "https://store.epicgames.com/u/username", svg: '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7 5h10a5 5 0 015 5v2.5a3.5 3.5 0 01-6.1 2.4L14.5 13.5h-5L8.1 14.9A3.5 3.5 0 012 12.5V10a5 5 0 015-5zm0 2.2A1.3 1.3 0 105.7 8.5 1.3 1.3 0 007 7.2zm10 0A1.3 1.3 0 1015.7 8.5 1.3 1.3 0 0017 7.2zM9.5 9.5h5v1.5h-5V9.5z"/></svg>' }
};
function normalizeSocialLinks(raw) {
  const out = {};
  try {
    if (!raw) return out;
    if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch (e) { return out; } }
    if (Array.isArray(raw)) { raw.forEach(it => { if (!it) return; const p = it.p || it.platform || it.k; const u = it.u || it.url || it.v; if (p && u && window.SOCIAL_PLATFORMS[p]) out[p] = String(u); }); return out; }
    if (typeof raw === "object") { Object.keys(raw).forEach(k => { if (window.SOCIAL_PLATFORMS[k] && raw[k]) out[k] = String(raw[k]); }); return out; }
  } catch (e) {}
  return out;
}
window.normalizeSocialLinks = normalizeSocialLinks;
window.getSocialLinks = function() { window._socialLinks = normalizeSocialLinks(window._socialLinks); return { ...window._socialLinks }; };
window.setSocialLinks = function(obj) { window._socialLinks = normalizeSocialLinks(obj); try { localStorage.setItem("vh-user-socialLinks", JSON.stringify(window._socialLinks)); } catch (e) {} window.renderSettingsSocialLinks(); };
window.renderSettingsSocialLinks = function() {
  const box = document.getElementById("settings-social-list");
  if (!box) return;
  const links = window.getSocialLinks();
  const keys = Object.keys(links);
  if (!keys.length) { box.innerHTML = '<span class="text-[10px] text-gray-600 font-bold px-1">لا توجد روابط بعد — أضف أول رابط لك.</span>'; return; }
  box.innerHTML = "";
  keys.forEach(p => {
    const meta = window.SOCIAL_PLATFORMS[p] || { label: p, color: "#fff", bg: "rgba(255,255,255,.08)", svg: "" };
    const url = links[p];
    const ver = (window._socialVerified || {})[p];
    const isVer = ver && ver.url === url;
    const vBadge = isVer ? ' <span style="color:#34d399">✓</span>' : "";
    let short = url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    if (short.length > 28) short = short.slice(0, 28) + "…";
    const chip = document.createElement("div");
    chip.className = "flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-xl border bg-black/40 max-w-full";
    chip.style.borderColor = meta.border || "rgba(255,255,255,.1)";
    chip.innerHTML = '<span class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style="color:' + meta.color + ';background:' + meta.bg + '">' + meta.svg + '</span>'
      + '<span class="flex flex-col min-w-0"><span class="text-[10px] font-black text-white leading-none">' + meta.label + vBadge + '</span><span class="text-[9px] font-mono text-gray-500 truncate max-w-[140px]" dir="ltr">' + short.replace(/</g, "&lt;") + '</span></span>'
      + '<button type="button" class="w-6 h-6 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 transition shrink-0" title="حذف"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>';
    chip.querySelector("button").addEventListener("click", () => window.removeSocialLink(p));
    chip.title = url + (isVer ? " — موثقة: " + (ver.title || "") : "");
    box.appendChild(chip);
  });
};
window.updateSocialInputDesign = function() {
  const sel = document.getElementById("settings-social-platform");
  const inp = document.getElementById("settings-social-url");
  const prev = document.getElementById("settings-social-preview");
  if (!sel) return;
  const meta = window.SOCIAL_PLATFORMS[sel.value];
  if (!meta) return;
  if (inp) {
    inp.placeholder = meta.placeholder || "https://...";
    inp.style.borderColor = meta.border || "rgba(255,255,255,.1)";
    inp.style.boxShadow = "0 0 0 1px " + (meta.bg || "transparent");
  }
  if (prev) {
    prev.style.color = meta.color;
    prev.style.background = meta.bg;
    prev.style.borderColor = meta.border;
    prev.innerHTML = meta.svg;
    prev.title = meta.label;
  }
  const hint = document.getElementById("settings-social-hint");
  if (hint && meta.domains) hint.textContent = "الرابط لازم يكون من: " + meta.domains.join("، ");
};
window.addSocialLink = function() {
  const sel = document.getElementById("settings-social-platform");
  const inp = document.getElementById("settings-social-url");
  if (!sel || !inp) return;
  const p = sel.value;
  const meta = window.SOCIAL_PLATFORMS[p];
  if (!meta) return;
  let u = (inp.value || "").trim();
  if (!u) { alert("الصق رابط صفحتك أولاً. مثال: " + (meta.placeholder || "")); inp.focus(); return; }
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  let host = "";
  try {
    const parsed = new URL(u);
    if (!["http:", "https:"].includes(parsed.protocol)) throw 0;
    host = (parsed.hostname || "").toLowerCase().replace(/^www\./, "");
    u = parsed.href;
  } catch (e) { alert("الرابط غير صالح. مثال: " + (meta.placeholder || "")); return; }
  const allowed = (meta.domains || []).map(d => d.toLowerCase());
  const ok = allowed.some(d => host === d || host.endsWith("." + d));
  if (!ok) { alert("رابط " + meta.label + " غير مقبول.\nلازم يكون من دومين: " + allowed.join(" أو ")); inp.focus(); return; }
  window._socialLinks = window.getSocialLinks();
  window._socialLinks[p] = u;
  try { localStorage.setItem("vh-user-socialLinks", JSON.stringify(window._socialLinks)); } catch (e) {}
  inp.value = "";
  window.renderSettingsSocialLinks();
  if (typeof window.showSettingsSaveBar === "function") window.showSettingsSaveBar();
};
window.removeSocialLink = function(p) {
  window._socialLinks = window.getSocialLinks();
  delete window._socialLinks[p];
  if (window._socialVerified) delete window._socialVerified[p];
  try { localStorage.setItem("vh-user-socialLinks", JSON.stringify(window._socialLinks)); localStorage.setItem("vh-user-socialVerified", JSON.stringify(window._socialVerified || {})); } catch (e) {}
  window.renderSettingsSocialLinks();
  window.renderYouTubeStatus && window.renderYouTubeStatus();
  if (typeof window.showSettingsSaveBar === "function") window.showSettingsSaveBar();
};
function setYouTubeStatus(msg, ok) {
  const el = document.getElementById("settings-youtube-status");
  if (!el) return;
  if (!msg) { el.classList.add("hidden"); el.textContent = ""; return; }
  el.classList.remove("hidden");
  el.style.color = ok === false ? "#f87171" : "#34d399";
  el.textContent = msg;
}
window.renderYouTubeStatus = function() {
  const v = (window._socialVerified || {}).youtube;
  if (v && v.url) setYouTubeStatus("✔ قناة موثقة: " + (v.title || v.url), true);
  else setYouTubeStatus("", true);
};
window.connectYouTube = async function() {
  const user = t.currentUser;
  if (!user) { alert(window.__fb("app_profile.login_required", "يجب تسجيل الدخول أولاً.")); return; }
  const btn = document.getElementById("settings-youtube-connect");
  setYouTubeStatus("جاري فتح نافذة Google...", true);
  btn && (btn.disabled = true, btn.classList.add("opacity-50"));
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/youtube.readonly");
    try { provider.setCustomParameters({ prompt: "consent" }); } catch (e) {}
    let cred = null;
    try {
      const res = await linkWithPopup(user, provider);
      cred = GoogleAuthProvider.credentialFromResult(res);
    } catch (e) {
      if (e && (e.code === "auth/provider-already-linked" || e.code === "auth/credential-already-in-use")) {
        const res = await reauthenticateWithPopup(user, provider);
        cred = GoogleAuthProvider.credentialFromResult(res);
      } else throw e;
    }
    const token = cred && cred.accessToken;
    if (!token) throw new Error("no-token");
    setYouTubeStatus("جاري جلب قناتك من YouTube...", true);
    const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=1", { headers: { Authorization: "Bearer " + token } });
    if (r.status === 403) { setYouTubeStatus("فعّل YouTube Data API v3 لمشروع Firebase من Google Cloud Console ثم حاول مجدداً.", false); return; }
    if (!r.ok) throw new Error("yt-" + r.status);
    const j = await r.json();
    const ch = j && j.items && j.items[0];
    if (!ch) { setYouTubeStatus("حساب Google ده مفيهوش قناة YouTube.", false); return; }
    const customUrl = ch.snippet && ch.snippet.customUrl;
    const url = customUrl ? "https://www.youtube.com/" + String(customUrl) : "https://www.youtube.com/channel/" + ch.id;
    const title = (ch.snippet && (ch.snippet.title || ch.snippet.customUrl)) || "قناتي";
    window._socialLinks = window.getSocialLinks();
    window._socialLinks.youtube = url;
    window._socialVerified = window._socialVerified || {};
    window._socialVerified.youtube = { title, url, at: Date.now() };
    try {
      localStorage.setItem("vh-user-socialLinks", JSON.stringify(window._socialLinks));
      localStorage.setItem("vh-user-socialVerified", JSON.stringify(window._socialVerified));
    } catch (e) {}
    window.renderSettingsSocialLinks();
    window.renderYouTubeStatus();
    if (typeof window.showSettingsSaveBar === "function") window.showSettingsSaveBar();
    setYouTubeStatus("✔ تم ربط: " + title + " — اضغط حفظ الإعدادات.", true);
  } catch (e) {
    console.warn("[youtube] connect failed:", e);
    const code = e && e.code;
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") setYouTubeStatus("اتقفلت النافذة قبل إتمام الربط.", false);
    else if (code === "auth/popup-blocked") setYouTubeStatus("المتصفح منع النافذة المنبثقة — اسمح بالنوافذ ثم حاول.", false);
    else setYouTubeStatus("فشل الربط. حاول مجدداً.", false);
  } finally {
    btn && (btn.disabled = false, btn.classList.remove("opacity-50"));
  }
};
window.renderPopoutSocials = function(elOrId, linksRaw) {
  const el = typeof elOrId === "string" ? document.getElementById(elOrId) : elOrId;
  if (!el) return;
  const links = normalizeSocialLinks(linksRaw);
  const keys = Object.keys(links);
  if (!keys.length) { el.innerHTML = ""; el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  el.innerHTML = "";
  keys.forEach(p => {
    const meta = window.SOCIAL_PLATFORMS[p];
    if (!meta) return;
    const a = document.createElement("a");
    a.href = links[p]; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.title = meta.label + " — " + links[p] + (((window._socialVerified || {})[p] || {}).url === links[p] ? " ✓ موثقة" : "");
    a.className = "w-8 h-8 rounded-lg flex items-center justify-center border hover:scale-110 active:scale-95 transition-transform";
    a.style.cssText = "color:" + meta.color + ";background:" + meta.bg + ";border-color:" + (meta.border || "rgba(255,255,255,.1)");
    a.innerHTML = meta.svg;
    a.addEventListener("click", e => e.stopPropagation());
    el.appendChild(a);
  });
};
export function initProfileSettings() {
  const s = document.getElementById("avatar-upload-input"),
    l = document.getElementById("avatar-upload-spinner"),
    c = document.getElementById("avatar-upload-percent"),
    m = document.getElementById("banner-upload-input"),
    u = document.getElementById("banner-upload-spinner");
  s && (s.addEventListener("change", async s => {
    const m = s.target.files[0];
    if (!m) return;
    if (!m.type.startsWith("image/")) return void alert(window.__fb("app_profile.select_valid_image", "يرجى اختيار ملف صورة صالح."));
    const u = t.currentUser;
    if (!u) return void alert(window.__fb("app_profile.login_required", "يجب تسجيل الدخول أولاً."));
    try {
      typeof window.openCropModal === "function" ? window.openCropModal(m, "avatar") : alert(window.__fb("app_profile.uploading", "جاري التحميل"))
    } catch (e) {
      alert(window.__fb("app_profile.upload_failed", "فشل رفع الصورة."))
    } finally {
      s.target.value = ""
    }
  }), m && m.addEventListener("change", async e => {
    const n = e.target.files[0];
    if (!n) return;
    if (!n.type.startsWith("image/")) return void alert(window.__fb("app_profile.select_valid_banner", "يرجى اختيار ملف صورة صالح للخلفية."));
    try {
      typeof window.openCropModal === "function" ? window.openCropModal(n, "banner") : alert(window.__fb("app_profile.uploading", "جاري التحميل"))
    } catch (e) {
      alert(window.__fb("app_profile.banner_upload_failed", "فشل رفع الخلفية."))
    } finally {
      e.target.value = ""
    }
  }))
}
async function w() {
  const s = t.currentUser;
  if (!s) return;
    const l = document.getElementById("settings-new-name"),
    c = document.getElementById("settings-bio"),
    m = document.getElementById("settings-banner-color"),
    u = document.getElementById("settings-allow-dms"),
    cust = document.getElementById("settings-custom-status"),
    w = l?.value?.trim(),
    g = c?.value?.trim() || "",
    f = m?.value || "#3b82f6",
    y = !u || u.checked,
    custStatus = cust?.value?.trim() || "";
  if (!w || w.length < 2) alert(window.__fb("js.name_short", "الاسم يجب أن يكون (حرفين على الأقل)"));
  else try {
    const t = document.getElementById("settings-header-save-btn"),
      l = document.querySelector("#settings-save-bar button.bg-emerald-600");
    h = '\n            <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>\n            ' + window.__fb("js.saving", "جاري الحفظ...") + '\n        ', t && (t.innerHTML = h), l && (l.innerHTML = h);
    const c = a(e, "users", s.uid),
      m = {
        displayName: w,
        bio: g,
        bannerColor: f,

        avatarColor: f,
        allowDMs: y,
        customStatus: custStatus,
        socialLinks: (typeof window.getSocialLinks === "function" ? window.getSocialLinks() : (window._socialLinks || {})),
        socialVerified: { ...(window._socialVerified || {}) }
      };
    window.pendingBannerDelete ? m.bannerURL = null : window.pendingBannerURL && (m.bannerURL = window.pendingBannerURL), window.pendingAvatarDelete ? m.photoURL = "" : window.pendingAvatarURL && (m.photoURL = window.pendingAvatarURL, window.pendingAvatarColor && (m.bannerColor = window.pendingAvatarColor, m.avatarColor = window.pendingAvatarColor)), window.pendingAvatarRandomColor && (m.avatarColor = window.pendingAvatarRandomColor, m.bannerColor = window.pendingAvatarRandomColor), await i(c, m), localStorage.setItem("vh-user-name", w), localStorage.setItem("vh-user-bio", g), localStorage.setItem("vh-user-bannerColor", m.bannerColor), localStorage.setItem("vh-user-avatarColor", m.avatarColor), localStorage.setItem("vh-user-allowDMs", y ? "1" : "0"), localStorage.setItem("vh-user-customStatus", custStatus), localStorage.setItem("vh-user-socialLinks", JSON.stringify(m.socialLinks || {})), localStorage.setItem("vh-user-socialVerified", JSON.stringify(m.socialVerified || {})), window._socialLinks = { ...(m.socialLinks || {}) }, window._socialVerified = { ...(m.socialVerified || {}) }, window.currentUserProfile && (window.currentUserProfile.socialLinks = { ...(m.socialLinks || {}) }), window.currentUserProfile && (window.currentUserProfile.socialVerified = { ...(m.socialVerified || {}) }), window.pendingBannerURL && localStorage.setItem("vh-user-bannerURL", window.pendingBannerURL), window.pendingBannerDelete && localStorage.removeItem("vh-user-bannerURL"), window.pendingAvatarURL && localStorage.setItem("vh-user-photoURL", window.pendingAvatarURL), window.pendingAvatarDelete && localStorage.removeItem("vh-user-photoURL"),     window.pendingBannerURL = null, window.pendingBannerDelete = !1, window.pendingAvatarURL && await o(s, {
      photoURL: window.pendingAvatarURL
    }), (window.pendingAvatarURL || window.pendingAvatarDelete) && updateLocalAvatarUI(window.pendingAvatarDelete ? "" : window.pendingAvatarURL), window.pendingAvatarURL = null, window.pendingAvatarDelete = !1, window.pendingAvatarColor = null, window.pendingAvatarRandomColor = null, syncProfileColorUI(m.avatarColor || m.bannerColor, s.uid), s.displayName !== w && await o(s, {
      displayName: w
    });
    const u = r(n, "users/" + s.uid);
    if (await d(u, {
        displayName: w
      }), window.connections && "function" == typeof window.sendSignalingCmd) {
      const e = s.photoURL || (window.currentUserProfile ? window.currentUserProfile.photoURL : "");
      window.myName = w;
      if (typeof window.foxyBroadcastPeerMessage === "function") window.foxyBroadcastPeerMessage({ type: "rename", name: w, photoURL: e });
      else Object.keys(window.connections).forEach(t => {
        window.sendSignalingCmd(t, {
          type: "rename",
          name: w,
          photoURL: e
        })
      })
    }
    "function" == typeof window.applyAudioSettings && await window.applyAudioSettings();
    localStorage.setItem("vh-bitrate", String(window.selectedBitrate || "48"));
    const maxVolInp = document.getElementById("max-volume-input");
    if (maxVolInp) localStorage.setItem("vh-max-volume", maxVolInp.value || "200");
    const maxV = localStorage.getItem("vh-max-volume") || "200";
    const ps = document.getElementById("peer-volume-slider");
    const ms = document.getElementById("member-volume-slider");
    if (ps) ps.max = maxV;
    if (ms) ms.max = maxV;
    const b = document.getElementById("settings-name-display");
    b && (b.textContent = w);
    const curEmail = document.getElementById("current-user-email");
    curEmail && (curEmail.removeAttribute("data-i18n"), curEmail.textContent = w);
    const mobEmail = document.getElementById("mobile-current-user-email");
    mobEmail && (mobEmail.removeAttribute("data-i18n"), mobEmail.textContent = w);
    p(), "function" == typeof window.addSystemMsg && window.addSystemMsg(window.__fb("js.settings_saved", "تم حفظ الإعدادات بنجاح! ✅"))
  } catch (e) {
    alert(window.__fb("js.save_error", "حدث خطأ في الحفظ."))
  } finally {
    (() => {
      document.getElementById("settings-header-save-btn") && (document.getElementById("settings-header-save-btn").innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> ' + window.__fb("js.save_settings", "حفظ الإعدادات") + '');
      const e = document.querySelector("#settings-save-bar button.bg-emerald-600");
      e && (e.innerHTML = window.__fb("js.save_settings", "حفظ الإعدادات"))
    })()
  }
  var h
}

function g() {
  window._settingsDirty = !0;
  const e = document.getElementById("settings-save-bar"),
    t = document.getElementById("settings-header-save-btn");
  e && (e.style.transform = "translateY(0)"), t && t.classList.remove("hidden")
}

function p(e = !1) {
  window._settingsDirty = !1;
  const t = document.getElementById("settings-save-bar"),
    n = document.getElementById("settings-header-save-btn");
  t && (t.style.transform = "translateY(100%)"), n && n.classList.add("hidden"), e && (window.pendingBannerURL = null, window.pendingBannerDelete = !1, window.pendingAvatarURL = null, window.pendingAvatarDelete = !1, window.pendingAvatarColor = null, window.pendingAvatarRandomColor = null, window._pendingProfileColor = null, h()), window._autoCloseAfterSave && (window._autoCloseAfterSave = !1, setTimeout(function() {
    if (typeof window.closeSettings === "function") window.closeSettings()
  }, 300))
}

function f(e, imgUrl = undefined) {
  const t = document.getElementById("settings-banner-preview"),
    n = document.getElementById("sidebar-popout-banner"),
    o = document.getElementById("settings-banner-hex"),
    a = document.getElementById("settings-banner-color"),
    i = imgUrl !== undefined ? imgUrl : (window.pendingBannerURL || window.currentUserProfile?.bannerURL && !window.pendingBannerDelete ? window.pendingBannerURL || window.currentUserProfile?.bannerURL : null);
  const identity = window.currentUserProfile?.uid || window.state?.myUid || window.currentUserProfile?.displayName || "User";
  c(t, i, e, identity), c(n, i, e, identity), o && (o.value = e.toUpperCase()), a && (a.value = e);

  window._pendingProfileColor = e;
  applyColorToAvatarFallbacks(e);
}

function applyColorToAvatarFallbacks(color) {
  if ("function" != typeof window.renderFoxyFallback || !color) return;
  const name = window.currentUserProfile?.displayName || t.currentUser?.displayName || "?",
    letter = window.getInitial ? window.getInitial(name) : "";
  document.querySelectorAll(".foxy-avatar-fox").forEach(fox => {
    const host = fox.parentElement;
    if (!host) return;
    host.style.backgroundColor = color;
    const span = host.querySelector(".foxy-avatar-letter");
    span && letter && (span.textContent = letter);
  });
}

function syncProfileColorUI(color, uid) {
  if (!color) return;
  try {
    localStorage.setItem("vh-user-bannerColor", color);
    localStorage.setItem("vh-user-avatarColor", color);
  } catch (e) {}
  if (window.currentUserProfile) {
    window.currentUserProfile.avatarColor = color;
    if (!window.currentUserProfile.bannerURL || window.pendingBannerDelete) window.currentUserProfile.bannerColor = color;
  }
  const banner = document.getElementById("settings-banner-preview");
  banner && ("function" == typeof window.applyBannerStyle) && window.applyBannerStyle(banner, window.pendingBannerURL || window.currentUserProfile?.bannerURL || null, color, uid || window.currentUserProfile?.uid || "User");
  const popoutBanner = document.getElementById("sidebar-popout-banner");
  popoutBanner && ("function" == typeof window.applyBannerStyle) && window.applyBannerStyle(popoutBanner, window.currentUserProfile?.bannerURL || null, color, uid || window.currentUserProfile?.uid || "User");
  window.currentUserProfile && updateLocalAvatarUI(window.currentUserProfile.photoURL || "");
}

function y() {
  window.pendingBannerDelete = !0, window.pendingBannerURL = null, f(document.getElementById("settings-banner-color")?.value || "#3b82f6");
  const e = document.getElementById("settings-remove-banner-btn");
  e && e.classList.add("hidden");
  const em = document.getElementById("settings-remove-banner-btn-mobile");
  em && em.classList.add("hidden"), g()
}

function x() {
  window.pendingAvatarDelete = !0, window.pendingAvatarURL = null, window.pendingAvatarColor = null;

  const newColor = "function" == typeof window.getRandomProfileColor ? window.getRandomProfileColor() : "#5865f2";
  window.pendingAvatarRandomColor = newColor;
  window._pendingProfileColor = newColor;
  const colorInput = document.getElementById("settings-banner-color");
  colorInput && (colorInput.value = newColor);
  f(newColor);
  updateLocalAvatarUI("");
  g()
}
async function h() {
  const n = t.currentUser;
  if (!n) {
    console.warn("No current user in refreshProfileSettingsUI (h)");
    return;
  }
  try {
    const docSnap = await s(a(e, "users", n.uid));
    const lsName = localStorage.getItem("vh-user-name") || "";
    const lsBio = localStorage.getItem("vh-user-bio") || "";
    const lsCustomStatus = localStorage.getItem("vh-user-customStatus") || "";
    const lsBannerColor = localStorage.getItem("vh-user-bannerColor") || "";
    const lsPhotoURL = localStorage.getItem("vh-user-photoURL") || "";
    const lsBannerURL = localStorage.getItem("vh-user-bannerURL") || "";
    const lsAllowDMs = localStorage.getItem("vh-user-allowDMs");
    const lsSocialRaw = localStorage.getItem("vh-user-socialLinks") || "";
    let lsSocial = {};
    try { lsSocial = normalizeSocialLinks(lsSocialRaw ? JSON.parse(lsSocialRaw) : {}); } catch (e) { lsSocial = {}; }
    if (docSnap.exists() && docSnap.data().socialLinks && !Object.keys(lsSocial).length) {
      try { lsSocial = normalizeSocialLinks(docSnap.data().socialLinks); } catch (e) {}
    } else if (docSnap.exists() && docSnap.data().socialLinks) {
      const fsSocial = normalizeSocialLinks(docSnap.data().socialLinks);
      Object.keys(fsSocial).forEach(k => { if (!lsSocial[k]) lsSocial[k] = fsSocial[k]; });
    }
    window._socialLinks = lsSocial;
    if (typeof window.renderSettingsSocialLinks === "function") window.renderSettingsSocialLinks();
    let lsVerified = {};
    try { const _sv = localStorage.getItem("vh-user-socialVerified"); lsVerified = _sv ? (JSON.parse(_sv) || {}) : {}; } catch (e) { lsVerified = {}; }
    if (docSnap.exists() && docSnap.data().socialVerified && !Object.keys(lsVerified).length) {
      try { lsVerified = docSnap.data().socialVerified || {}; } catch (e) {}
    } else if (docSnap.exists() && docSnap.data().socialVerified) {
      const fsVer = docSnap.data().socialVerified || {};
      Object.keys(fsVer).forEach(k => { if (!lsVerified[k]) lsVerified[k] = fsVer[k]; });
    }
    window._socialVerified = lsVerified;
    if (typeof window.renderYouTubeStatus === "function") window.renderYouTubeStatus();
    const oName = document.getElementById("settings-new-name");
    oName && (oName.value = lsName || (docSnap.exists() ? (docSnap.data().displayName || n.displayName || "") : ""));
    const bioEl = document.getElementById("settings-bio");
    bioEl && (bioEl.value = lsBio || (docSnap.exists() ? (docSnap.data().bio || "") : ""));
    const custEl = document.getElementById("settings-custom-status");
    custEl && (custEl.value = lsCustomStatus || (docSnap.exists() ? (docSnap.data().customStatus || "") : ""));

    const fsPhoto = docSnap.exists() ? docSnap.data().photoURL || "" : "";
    updateLocalAvatarUI(lsPhotoURL || fsPhoto || "");
    const iBtn = document.getElementById("settings-remove-banner-btn");
    const finalBannerURL = lsBannerURL || (docSnap.exists() ? docSnap.data().bannerURL : "");
    let bannerExists = !!finalBannerURL;
    if (iBtn && (bannerExists ? iBtn.classList.remove("hidden") : iBtn.classList.add("hidden")));
    const iBtnM = document.getElementById("settings-remove-banner-btn-mobile");
    if (iBtnM && (bannerExists ? iBtnM.classList.remove("hidden") : iBtnM.classList.add("hidden")));

    const fsAvatarColor = docSnap.exists() ? docSnap.data().avatarColor : "";
    f(fsAvatarColor || lsBannerColor || (docSnap.exists() ? (docSnap.data().bannerColor || "#5865f2") : "#5865f2"), finalBannerURL);
    if (lsAllowDMs !== null) {
      const t = document.getElementById("settings-allow-dms");
      t && (t.checked = lsAllowDMs === "1")
    } else if (docSnap.exists() && void 0 !== docSnap.data().allowDMs) {
      const t = document.getElementById("settings-allow-dms");
      t && (t.checked = docSnap.data().allowDMs)
    }
    const lsTheme = localStorage.getItem("vh-theme") || "dark";
    if ("function" == typeof window.setAppTheme && window.setAppTheme(lsTheme));
    const lsFontSize = localStorage.getItem("vh-font-size") || "100";
    if ("function" == typeof window.setAppFontSize) {
      window.setAppFontSize(lsFontSize);
      const t = document.getElementById("settings-font-size-slider");
      t && (t.value = lsFontSize);
      const n = document.getElementById("font-size-label");
      n && (n.textContent = lsFontSize + "%")
    }
    const uiPrefs = {
      music: localStorage.getItem("vh-music-volume") || "100",
      messages: localStorage.getItem("vh-message-size") || localStorage.getItem("vh-private-message-size") || localStorage.getItem("vh-public-message-size") || "100",
    };
    if (typeof window.setAppMusicVolume === "function") window.setAppMusicVolume(uiPrefs.music);
    if (typeof window.setAppMessageSize === "function") window.setAppMessageSize(uiPrefs.messages);
    [["settings-music-volume", uiPrefs.music, "settings-music-volume-label"], ["message-size", uiPrefs.messages, "message-size-label"]].forEach(([id, value, labelId]) => {
      const input = document.getElementById(id), label = document.getElementById(labelId);
      if (input) input.value = value;
      if (label) label.textContent = value + "%";
    });
    const lsCompact = localStorage.getItem("vh-compact-mode") === "1" || localStorage.getItem("vh-compact-mode") === "true";
    if ("function" == typeof window.toggleCompactMode) {
      window.toggleCompactMode(lsCompact);
      const t = document.getElementById("settings-compact-mode-slider");
      t && (t.value = lsCompact ? 1 : 0, "function" == typeof window.updateCompactLabel && window.updateCompactLabel(t.value));
    }
    const isTurbo = document.body.classList.contains("mode-turbo") || localStorage.getItem("vh-turbo-mode") === "true";
    const isStopGifs = isTurbo || localStorage.getItem("vh-stop-gifs") === "true";
    window.gifMode = isTurbo ? "none" : (window.currentUserProfile?.gifMode || "all");
    const stopGifsToggle = document.getElementById("stop-gifs-toggle");
    if (stopGifsToggle) stopGifsToggle.checked = isStopGifs;
    const turboToggle = document.getElementById("turbo-mode-toggle");
    if (turboToggle) turboToggle.checked = isTurbo;

    const lazyMediaToggle = document.getElementById("lazy-media-toggle");
    if (lazyMediaToggle) lazyMediaToggle.checked = "function" == typeof window.isLazyMediaEnabled ? window.isLazyMediaEnabled() : localStorage.getItem("vh-lazy-media") === "1";

    const lazyVideoToggle = document.getElementById("lazy-video-toggle");
    if (lazyVideoToggle) lazyVideoToggle.checked = "function" == typeof window.isLazyVideoEnabled ? window.isLazyVideoEnabled() : localStorage.getItem("vh-lazy-video") === "1";
    if ((isTurbo || isStopGifs || window._freezeGifsActive) && typeof window.setGifFreeze === "function") {
      window.setGifFreeze(true);
    }
    const o = document.getElementById("bitrate-slider"),
      i = document.getElementById("bitrate-val"),
      lsBitrate = localStorage.getItem("vh-bitrate");
    if (lsBitrate) {
      window.selectedBitrate = parseInt(lsBitrate);
      o && (o.value = lsBitrate);
      i && (i.textContent = lsBitrate + " kbps")
    } else o && window.selectedBitrate && (o.value = window.selectedBitrate, i && (i.textContent = `${window.selectedBitrate} kbps`));
    const lsMaxVol = localStorage.getItem("vh-max-volume");
    if (lsMaxVol) {
      const m = document.getElementById("max-volume-input");
      if (m) m.value = lsMaxVol;
      const s1 = document.getElementById("peer-volume-slider");
      const s2 = document.getElementById("member-volume-slider");
      if (s1) s1.max = lsMaxVol;
      if (s2) s2.max = lsMaxVol
    }
  } catch (err) {
    console.error("Error in refreshProfileSettingsUI (h):", err);
  }
}

function b(e, t = 512, n = 512, o = .8) {
  return new Promise(a => {
    const i = new FileReader;
    i.onload = i => {
      const s = new Image;
      s.onload = () => {
        const i = document.createElement("canvas");
        let r = s.width,
          d = s.height;
        r > d ? r > t && (d *= t / r, r = t) : d > n && (r *= n / d, d = n), i.width = r, i.height = d, i.getContext("2d").drawImage(s, 0, 0, r, d), i.toBlob(t => {
          a(new File([t], e.name, {
            type: "image/jpeg"
          }))
        }, "image/jpeg", o)
      }, s.src = i.target.result
    }, i.readAsDataURL(e)
  })
}

function v(e, t) {
  return new Promise((n, o) => {
    const a = new XMLHttpRequest;
    a.open("POST", "https://api.imgbb.com/1/upload?key=c69e6bed5411d61fc96f4ec1df949ae6"), a.upload.onprogress = e => {
      if (e.lengthComputable && t) {
        const n = Math.round(e.loaded / e.total * 100);
        t(n)
      }
    }, a.onload = () => {
      if (a.status >= 200 && a.status < 300) try {
        const e = JSON.parse(a.responseText);
        e.success ? n({
          url: e.data.url,
          delete_url: e.data.delete_url
        }) : o(new Error("ImgBB error: " + e.error.message))
      } catch (e) {
        o(new Error("Failed to parse ImgBB response"))
      } else o(new Error("ImgBB upload failed with status: " + a.status))
    }, a.onerror = () => o(new Error("ImgBB network error"));
    const i = new FormData;
    i.append("image", e), a.send(i)
  })
}
export function updateLocalAvatarUI(e) {
  const n = t.currentUser?.uid;
  const refreshedPhotoURL = e ? `${e}${e.includes("?") ? "&" : "?"}avatar_v=${Date.now()}` : "";

  const profileColor = "function" == typeof window.resolveProfileColor ? window.resolveProfileColor(n || window.currentUserProfile?.uid || "User", window.currentUserProfile?.avatarColor || window._pendingProfileColor || window.currentUserProfile?.bannerColor) : "";
  const displayName = t.currentUser?.displayName || window.currentUserProfile?.displayName || window.__fb("app_chat.default_sender", "مستخدم");
  m(document.getElementById("settings-avatar"), document.getElementById("settings-initial"), e, displayName, 80, profileColor, n);
  const settingsImg = document.getElementById("settings-avatar"),
    settingsInit = document.getElementById("settings-initial");
  settingsImg && settingsInit && (settingsImg.onerror = function() {
    this.classList.add("hidden"), window.renderFoxyFallback && window.renderFoxyFallback(settingsInit, displayName, profileColor, n)
  });
  m(document.getElementById("sidebar-avatar"), document.getElementById("sidebar-initial"), e, displayName, 80, profileColor, n);
  if (typeof setupGifHover === "function") setupGifHover("sidebar-avatar", "sidebar-avatar-animated", e);
  const sideImg = document.getElementById("sidebar-avatar"),
    sideInit = document.getElementById("sidebar-initial");
  sideImg && sideInit && (sideImg.onerror = function() {
    this.classList.add("hidden"), window.renderFoxyFallback && window.renderFoxyFallback(sideInit, displayName, profileColor, n)
  });
  m(document.getElementById("mobile-sidebar-avatar"), document.getElementById("mobile-sidebar-initial"), e, displayName, 80, profileColor, n);
  const o = document.getElementById("dm-voice-my-avatar");
  if (o) {
    o.src = u(e, displayName, 80);
    e ? (o.classList.remove("foxy-avatar-img"), o.style.backgroundColor = "", o.style.objectFit = "") : window.applyFoxyImgBg && window.applyFoxyImgBg(o, profileColor, n)
  }
  if (n) {
    document.querySelectorAll(`.server-voice-member-item[data-uid="${n}"] .server-voice-avatar`).forEach(t => {
      t.innerHTML = l(e, displayName, {
        size: "full",
        withOnError: !0,
        color: profileColor,
        identity: n
      })
    }), document.querySelectorAll(`#p-card-me .participant-initial, [data-uid="${n}"] .participant-initial`).forEach(t => {
      t.innerHTML = l(e, displayName, {
        size: "full",
        shape: "circle",
        withOnError: !0,
        color: profileColor,
        identity: n
      })
    }), document.querySelectorAll(".sender-name").forEach(t => {
      if (window.__fb("app_chat.you_label", "أنت") === t.innerText.trim()) {
        const n = t.closest(".flex.items-start");
        if (n) {
          const t = n.querySelector(".w-9.h-9.rounded-full");
          t && (t.innerHTML = l(e, displayName, {
            size: 9,
            shape: "circle",
            withOnError: !0,
            color: profileColor,
            identity: window.currentUserProfile?.uid || "User"
          }))
        }
      }
    })
  }
  if (n) {
    document.querySelectorAll(`.message-row[data-sender-uid="${CSS.escape(n)}"]`).forEach(row => {
      const avatarWrapper = row.firstElementChild;
      avatarWrapper && (avatarWrapper.innerHTML = l(refreshedPhotoURL, displayName, {
        size: 9,
        shape: "circle",
        withOnError: !0,
        direct: !0,
        color: profileColor,
        identity: n
      }));
    });
  }
  if (window.currentUserProfile && (window.currentUserProfile.photoURL = e), window.connections && "function" == typeof window.sendSignalingCmd) {
    const n = window.myName || t.currentUser?.displayName || (window.currentUserProfile ? window.currentUserProfile.displayName : window.__fb("app_chat.default_sender", "مستخدم"));
    if (typeof window.foxyBroadcastPeerMessage === "function") window.foxyBroadcastPeerMessage({ type: "rename", name: n, photoURL: e });
    else Object.keys(window.connections).forEach(t => {
      window.sendSignalingCmd(t, {
        type: "rename",
        name: n,
        photoURL: e
      })
    })
  }
  document.dispatchEvent(new CustomEvent("UserProfileUpdated", {
    detail: {
      photoURL: e
    }
  }));
  if (window._freezeGifsActive || document.body.classList.contains("mode-turbo") || "true" === localStorage.getItem("vh-turbo-mode") || "true" === localStorage.getItem("vh-stop-gifs")) {
    if (typeof window.setGifFreeze === "function") window.setGifFreeze(true);
  }
}
window.showMemberProfile = async function(t, n) {
  if (!n) return;
  t.preventDefault(), t.stopPropagation();
  const o = document.getElementById("member-profile-popout");
  if (!o) return;
  const i = document.getElementById("member-popout-name"),
    r = document.getElementById("member-popout-tag"),
    d = document.getElementById("member-popout-avatar"),
    l = document.getElementById("member-popout-initial"),
    u = document.getElementById("member-popout-banner"),
    b = document.getElementById("member-popout-bio"),
    cust = document.getElementById("member-popout-custom-status");

  const _cacheMember = _uid => {
    const st = window.state || {};
    const out = {};
    const sm = (st.serverMembersData && st.serverMembersData[_uid]) || (st.globalUsersData && st.globalUsersData[_uid]) || null;
    if (sm) Object.assign(out, sm);
    if (st.members) {
      const m = st.members.find(x => x.id === _uid || x.uid === _uid);
      m && Object.assign(out, m);
    }
    if ("function" == typeof window.getFriendData) {
      const f = window.getFriendData(_uid);
      f && Object.assign(out, f);
    }
    return Object.keys(out).length ? out : null;
  };
  const _paint = (src, _uid) => {
    if (!src) {
      i && (i.innerText = window.__fb("app_chat.default_sender", "مستخدم"));

      l && (l.innerText = "?", l.classList.remove("hidden")),
      d && (d.classList.add("hidden"), d.removeAttribute("src"));
      return;
    }
    const nm = src.displayName || src.name || window.__fb("app_chat.default_sender", "مستخدم");
    const col = "function" == typeof window.resolveProfileColor
      ? window.resolveProfileColor(_uid || nm, src.avatarColor || src.bannerColor)
      : (src.avatarColor || src.bannerColor);
    i && (i.innerText = nm),
    d && l && m(d, l, src.photoURL || src.avatarURL || "", nm, 80, col, _uid || nm),
    u && c(u, src.bannerURL || "", col),
    b && (b.innerText = src.bio || "", b.classList.toggle("hidden", !src.bio)),
    cust && (cust.innerText = src.customStatus || "", cust.classList.toggle("hidden", !src.customStatus)),
    window.renderPopoutSocials && window.renderPopoutSocials("member-popout-socials", src.socialLinks || {});
  };

  r && r.classList.add("hidden");
  const _uid0 = n;
  const _cached = _cacheMember(_uid0);
  _paint(_cached, _uid0);
  if (!_cached && i) i.innerText = window.__fb("app_loading.loading_profile", "جاري التحميل...");
  window.lastMemberIdForProfile = n,
  "function" == typeof window.positionContextMenu ? window.positionContextMenu(o, t, !1) : (o.classList.remove("hidden"), o.style.left = t.clientX + "px", o.style.top = t.clientY + "px"),
  "function" == typeof window.hideAllMenus && window.hideAllMenus(o, t);

  try {
    const snap = await s(a(e, "users", _uid0));
    if (snap.exists()) {
      const doc = snap.data();

      _paint({ ...(_cached || {}), ...doc }, _uid0);
    } else if (_cached) {
      _paint(_cached, _uid0);
    } else {
      _paint(null, _uid0);
    }
  } catch (err) {
    console.error("[profile] showMemberProfile: getDoc failed", err);

    if (i) i.title = String((err && err.message) || err || "");
    if (_cached) {
      if (b) {
        b.classList.remove("hidden");
        b.innerText = b.innerText ? b.innerText + " \u00b7 " + window.__fb("js.profile_partial", "تعذر تحميل البيانات الكاملة (الشبكة)") : window.__fb("js.profile_partial", "تعذر تحميل البيانات الكاملة (الشبكة)");
      }
    } else {
      i && (i.innerText = window.__fb("js.load_error", "خطأ في التحميل"));
    }
  }
}, document.addEventListener("DOMContentLoaded", () => {
  initProfileSettings(), window.updateLocalAvatarUI = updateLocalAvatarUI, window.saveProfileChanges = w, window.showSettingsSaveBar = g, window.hideSettingsSaveBar = p, window.updateBannerColorPreview = f, window.refreshProfileSettingsUI = h, window.removeBannerImage = y, window.removeAvatarImage = x, window.renderSettingsSocialLinks && window.renderSettingsSocialLinks(), window.renderYouTubeStatus && window.renderYouTubeStatus(), window.updateSocialInputDesign && window.updateSocialInputDesign();
  const _si = document.getElementById("settings-social-url");
  _si && _si.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); window.addSocialLink && window.addSocialLink(); } });
  const _sp = document.getElementById("settings-social-platform");
  _sp && _sp.addEventListener("change", () => window.updateSocialInputDesign && window.updateSocialInputDesign());
});

function handleLoadedProfile(t) {
  if (t && !t.error) {
    if (t.displayName) localStorage.setItem("vh-user-name", t.displayName);
    if (t.bio !== undefined) localStorage.setItem("vh-user-bio", t.bio || "");
    if (t.customStatus !== undefined) localStorage.setItem("vh-user-customStatus", t.customStatus || "");
    if (t.bannerColor) localStorage.setItem("vh-user-bannerColor", t.bannerColor);
    if (t.avatarColor) {
      localStorage.setItem("vh-user-avatarColor", t.avatarColor);

      window._pendingProfileColor = null, t.bannerColor || (t.bannerColor = t.avatarColor);
    }
    if (t.photoURL !== undefined) localStorage.setItem("vh-user-photoURL", t.photoURL || "");
    if (t.bannerURL !== undefined) localStorage.setItem("vh-user-bannerURL", t.bannerURL || "");
    if (t.allowDMs !== undefined) localStorage.setItem("vh-user-allowDMs", t.allowDMs ? "1" : "0");
    if (t.socialLinks !== undefined) {
      try {
        const sl = normalizeSocialLinks(t.socialLinks);
        window._socialLinks = sl;
        localStorage.setItem("vh-user-socialLinks", JSON.stringify(sl));
        if (window.currentUserProfile) window.currentUserProfile.socialLinks = sl;
      } catch (e) {}
    }
    if (t.socialVerified !== undefined) {
      try {
        const sv = t.socialVerified || {};
        window._socialVerified = sv;
        localStorage.setItem("vh-user-socialVerified", JSON.stringify(sv));
        if (window.currentUserProfile) window.currentUserProfile.socialVerified = sv;
      } catch (e) {}
    }

    updateLocalAvatarUI(t.photoURL || "");
    setTimeout(() => h(), 300)
  }
}
document.addEventListener("UserProfileLoaded", e => {
  handleLoadedProfile(e.detail)
});
if (window.currentUserProfile) {
  handleLoadedProfile(window.currentUserProfile)
}
