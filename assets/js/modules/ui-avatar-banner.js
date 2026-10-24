import { PROFILE_COLORS, isValidProfileColor, resolveProfileColor as resolveColor, getRandomProfileColor as randomColor, getStableProfileColor, FALLBACK_PROFILE_COLOR } from "../profile-color.js";
export function getInitial(e) {
  return (e || "?").charAt(0).toUpperCase()
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function safeClassNames(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_\-\s\[\]#/:.]/g, "").trim();
}
function safeColor(value) {
  const color = String(value || "").trim();
  return /^(#[0-9a-f]{3,8}|rgb\([\d\s,.%]+\)|rgba\([\d\s,.%]+\)|[a-z]+)$/i.test(color) ? color : "#334155";
}
const FOXY_AVATAR_MASK = "assets/img/foxy-mask.png";
export function getDefaultAvatarColor(identity) {
  return getStableProfileColor(identity);
}
export function getRandomProfileColor() {
  return randomColor();
}
export function resolveProfileColor(identity, explicit) {
  return resolveColor(identity, explicit);
}
export { isValidProfileColor, FALLBACK_PROFILE_COLOR };
function foxyLayerHTML() {
  return `<img src="${FOXY_AVATAR_MASK}" class="foxy-avatar-fox" alt="" aria-hidden="true" draggable="false" onerror="this.style.display='none';var s=this.previousElementSibling;if(s&&s.classList.contains('foxy-avatar-letter'))s.style.display=''">`;
}
function foxyFallbackInner(letter) {
  return `<span class="foxy-avatar-letter" style="display:none">${escapeHtml(letter)}</span>${foxyLayerHTML()}`;
}
const FALLBACK_BG_CLASSES = ["bg-gradient-to-br", "from-blue-500", "to-indigo-600", "from-purple-500", "to-pink-500", "bg-blue-600", "bg-blue-500", "bg-slate-700", "bg-slate-600", "bg-slate-800"];
export function renderFoxyFallback(el, name, color, identity) {
  if (!el) return;
  const resolved = resolveProfileColor(identity, color);
  el.style.backgroundColor = resolved;
  el.style.backgroundImage = "none";
  for (const cls of FALLBACK_BG_CLASSES) el.classList.remove(cls);
  const positioned = el.classList.contains("absolute") || el.classList.contains("fixed") || el.classList.contains("sticky");
  if (!positioned) el.classList.add("relative");
  el.innerHTML = foxyFallbackInner(getInitial(name));
  return resolved;
}
export function applyFoxyImgBg(el, color, identity) {
  if (!el) return;
  el.classList.add("foxy-avatar-img");
  el.style.backgroundColor = resolveProfileColor(identity, color);
  el.style.objectFit = "contain";
}
export function clearFoxyImgBg(el) {
  if (!el) return;
  el.classList.remove("foxy-avatar-img");
  el.style.backgroundColor = "";
  el.style.objectFit = "";
}
export function isValidAvatarUrl(e) {
  if (!e || "string" != typeof e) return false;
  if (e.startsWith("data:") || e.startsWith("blob:")) return true;
  return /^https?:\/\//i.test(e);
}
export function getOptimizedSrc(e, t = 80) {
  if (!isValidAvatarUrl(e)) return "";
  if (e.startsWith("data:")) return e;
  const isAnimated = window.isAnimatedImageUrl ? window.isAnimatedImageUrl(e) : /(?:^|[._-])gif(?:[._/?#]|$)/i.test(e);
  if (!isAnimated) return "function" == typeof window.getOptimizedAvatar ? window.getOptimizedAvatar(e, t) : `https://wsrv.nl/?url=${encodeURIComponent(e)}&w=${t}&h=${t}&fit=cover&output=webp`;
  const frozen = (typeof window.isGifFreezeActive === "function" && window.isGifFreezeActive()) || window._freezeGifsActive;
  if (frozen) return "function" == typeof window.getStaticAvatarSrc ? window.getStaticAvatarSrc(e, t) : `https://wsrv.nl/?url=${encodeURIComponent(e)}&w=${t}&h=${t}&fit=cover&output=webp`;
  return e;
}
export function createAvatarHTML(e, t, r = {}) {
  const {
    size: a = 9,
    shape: o = "circle",
    dotColor: i,
    border: n = "",
    shadow: c = "",
    extra: s = "",
    withOnError: d = !1,
    initialOnly: l = !1,
    direct: direct = !1,
    identity: identity = t,
    color: color = ""
  } = r, u = i ? function(e) {
    if (!e) return "#334155";
    const t = e.match(/background-color:\s*([^;]+)/i);
    return t ? t[1].trim() : e
  }(i) : "", f = escapeHtml(getInitial(t)), m = "circle" === o ? "rounded-full" : safeClassNames(o), w = "full" === a ? "w-full h-full" : `w-${Number.isInteger(a) && a > 0 && a <= 96 ? a : 9} h-${Number.isInteger(a) && a > 0 && a <= 96 ? a : 9}`, p = safeClassNames(`${w} ${m} object-cover flex-shrink-0 ${n} ${c} ${s}`), h = safeClassNames(`${w} ${m} flex-shrink-0 flex items-center justify-center font-bold text-white overflow-hidden ${n} ${c} ${s}`),
  bg = safeColor(color || u || getDefaultAvatarColor(identity)), fb = () => `<div class="relative ${h}" style="background-color:${bg}">${foxyFallbackInner(getInitial(t))}</div>`;
  if (!isValidAvatarUrl(e) || l) return fb();
  try {
    if (window.failedImageUrls && window.failedImageUrls.has(e)) return fb();
  } catch (_) {}
  const animated = window.isAnimatedImageUrl ? window.isAnimatedImageUrl(e) : /(?:^|[._-])gif(?:[._/?#]|$)/i.test(e),
    v = animated ? getOptimizedSrc(e, "number" == typeof a ? Math.min(10 * a, 80) : 80) : direct ? e : getOptimizedSrc(e, "number" == typeof a ? Math.min(10 * a, 80) : 80),
    y = "";
  
  if (!v) return fb();
  try {
    if (window.failedImageUrls && window.failedImageUrls.has(v)) return fb();
  } catch (_) {}
  return `<div class="relative ${w} ${m} flex-shrink-0 overflow-hidden select-none">
    <div class="${h} absolute inset-0" style="background-color: ${bg}; z-index: 1;">${foxyFallbackInner(getInitial(t))}</div>
    <img src="${v}"${y} class="${p} absolute inset-0 w-full h-full" style="z-index: 2;" alt="${f}" onerror="try{window.failedImageUrls&&window.failedImageUrls.add(this.src)}catch(_){}this.style.opacity='0'; this.style.pointerEvents='none';">
  </div>`;
}
export function createAvatarWrapper(e, t = {}) {
  const {
    clickHandler: r = null,
    statusDot: a = !1,
    statusColor: o = "bg-emerald-500",
    statusSize: i = "w-3 h-3",
    statusBorder: n = "border-2 border-[#2b2d31]",
    wrapperExtra: c = ""
  } = t, s = r ? ` onclick="${r.replace(/"/g,"&quot;")}"` : "";
  return `<div class="relative flex-shrink-0 ${r?"cursor-pointer hover:opacity-80 transition":""} ${c}"${s}>${e}${a?`<div class="absolute -bottom-1 -right-1 ${i} ${o} rounded-full ${n}"></div>`:""}</div>`
}
export function applyBannerStyle(e, t, r, identity = "User") {
  if (e) {
    e.style.backgroundSize = "cover";
    e.style.backgroundPosition = "center";
    e.style.backgroundColor = resolveProfileColor(identity, r);

    if (t) {
      const n = window.isAnimatedImageUrl ? window.isAnimatedImageUrl(t) : /(?:^|[._-])gif(?:[._/?#]|$)/i.test(t);
      const frozen = (typeof window.isGifFreezeActive === "function" && window.isGifFreezeActive()) || window._freezeGifsActive;
      if (n ? e.dataset.origBanner = t : delete e.dataset.origBanner, frozen && n) {
      const n = "function" == typeof window.getStaticAvatarSrc ? window.getStaticAvatarSrc(t, 400) : `https://wsrv.nl/?url=${encodeURIComponent(t)}&w=400&h=400&fit=cover&output=webp`;
        e.style.backgroundImage = `url("${n}")`;
      } else {
        e.style.backgroundImage = "none";
        const a = new Image;
        e._bannerPreloader = a;
        a.onload = () => { 
          if (e._bannerPreloader === a) {
            e.style.backgroundImage = `url("${t}")`; 
          }
        };
        a.onerror = () => {
          e.style.backgroundImage = "none";
        };
        a.src = t;
      }
    } else {
      e.style.backgroundImage = "none";
      delete e.dataset.origBanner;
    }
  }
}
export function getAvatarSrc(e, t, r = 80, identity = t) {
  if (isValidAvatarUrl(e)) return getOptimizedSrc(e, r) || e;
  return FOXY_AVATAR_MASK
}
export function applyAvatarToPair(e, t, r, a, o = 80, color = "", identity = a) {
  if (!e && !t) return;
  const displayName = a;
  if (e) {
    clearFoxyImgBg(e);
  }
  if (r && isValidAvatarUrl(r)) {
    const optimized = getOptimizedSrc(r, o);
    if (e) {
      try {
        const isGif = typeof r === "string" && (r.toLowerCase().includes(".gif") || (window.isAnimatedImageUrl && window.isAnimatedImageUrl(r)));
        if (isGif) {
          e.dataset.gifA = r;
          if (!e.dataset.origSrc) e.dataset.origSrc = r;
        }
      } catch (_) {}
      e.src = optimized;
      e.classList.remove("hidden");
    e.onerror = function() {
      try { window.failedImageUrls && window.failedImageUrls.add(this.src); } catch (_) {}
      this.classList.add("hidden");
      if (t) {
        t.classList.remove("hidden");
        renderFoxyFallback(t, displayName, color, identity);
      }
    };
    }
    if (t) t.classList.add("hidden");
  } else {
    if (e) {
      e.classList.add("hidden");
      e.onerror = null;
      delete e.dataset.gifA;
    }
    if (t) {
      t.classList.remove("hidden");
      renderFoxyFallback(t, displayName, color, identity);
    }
  }
}
export function setupGifHover(e, t, r) {
  const a = document.getElementById(t),
    o = document.getElementById(e);
  if (!a || !o) return;
  const isGif = typeof r === "string" && !!r && (r.toLowerCase().includes(".gif") || (window.isAnimatedImageUrl && window.isAnimatedImageUrl(r)));
  const frozen = (typeof window.isGifFreezeActive === "function" && window.isGifFreezeActive()) || window._freezeGifsActive;
  if (isGif && !frozen) {
    try {
      if (!o.dataset.origSrc) o.dataset.origSrc = r;
      o.dataset.gifA = r;
    } catch (_) {}
    delete o.dataset.gifFreezeTried;
    try {
      const cur = o.getAttribute("src") || o.src || "";
      if (cur === r || cur.endsWith(r)) { o.src = ""; }
    } catch (_) {}
    o.src = r, o.classList.remove("hidden"), o.classList.remove("group-hover:opacity-0", "opacity-0"), a.classList.add("hidden");
    try { a.src = ""; } catch (_) {}
    a.classList.remove("opacity-0", "group-hover:opacity-100");
  } else if (isGif) {
    let staticSrc = r;
    try { staticSrc = (window.getStaticAvatarSrc && window.getStaticAvatarSrc(r, 58)) || r; } catch (_) {}
    try {
      if (!o.dataset.origSrc) o.dataset.origSrc = r;
      o.dataset.gifA = r;
    } catch (_) {}
    delete o.dataset.gifFreezeTried;
    o.src = staticSrc, o.classList.remove("hidden"), o.classList.remove("group-hover:opacity-0", "opacity-0"), a.classList.add("hidden"), a.src = "", a.classList.remove("opacity-0", "group-hover:opacity-100");
  } else { a.classList.add("hidden"), a.src = "", o.classList.remove("group-hover:opacity-0"); }
}
async function e(img) {
  if (!img) return;
  const t = img.src;
  if (!t || t.startsWith("data:")) return;
  try {
    if (t.includes("wsrv.nl") || t.includes("images.weserv.nl") || t.includes("ui-avatars.com")) return;
  } catch (_) {}
  if (img.dataset.gifFreezeTried === t) return;
  const isGif = t.includes(".gif") || (window.isAnimatedImageUrl && window.isAnimatedImageUrl(t)) || /(?:^|[._-])gif(?:[._/?#]|$)/i.test(t) || (img.dataset.gifA && img.dataset.gifA.includes(".gif")) || (img.dataset.origSrc && img.dataset.origSrc.includes(".gif"));
  if (!isGif) return;
  if (!img.dataset.origSrc) {
    img.dataset.origSrc = img.dataset.gifA || t;
  }
  img.dataset.gifFreezeTried = t;
  try {
    const r = await fetch(t),
      a = await r.blob(),
      o = await createImageBitmap(a),
      i = document.createElement("canvas");
    i.width = o.width, i.height = o.height, i.getContext("2d").drawImage(o, 0, 0), img.src = i.toDataURL(), o.close();
    return;
  } catch (_) {}
  try {
    const orig = img.dataset.origSrc || t;
    const fallback = (window.getStaticAvatarSrc && window.getStaticAvatarSrc(orig, 80)) || ("https://wsrv.nl/?url=" + encodeURIComponent(orig) + "&w=80&h=80&fit=cover&output=webp");
    if (fallback && fallback !== t && img.src === t) img.src = fallback;
  } catch (_) {}
}
async function t(el) {
  if (!el) return;
  const bg = el.style.backgroundImage;
  if (!bg || bg === "none" || bg.startsWith('url("data:')) return;
  const isGif = bg.includes(".gif") || /(?:^|[._-])gif(?:[._/?#]|$)/i.test(bg);
  if (isGif) {
    if (!el.dataset.origBg) {
      el.dataset.origBg = bg;
    }
    try {
      const r = bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (!r) return;
      const a = await fetch(r[1]),
        o = await a.blob(),
        i = await createImageBitmap(o),
        n = document.createElement("canvas");
      n.width = i.width, n.height = i.height, n.getContext("2d").drawImage(i, 0, 0), el.style.backgroundImage = "url(" + n.toDataURL() + ")", el.style.backgroundColor = "", i.close()
    } catch (e) {}
  }
}

function r() {
  document.querySelectorAll("img").forEach(item => e(item)), document.querySelectorAll('[style*="background-image"]').forEach(item => t(item))
}
void 0 === window._freezeGifsActive && (window._freezeGifsActive = !1);
new MutationObserver(mutations => {
  const frozenNow = window._freezeGifsActive || (typeof window.isGifFreezeActive === "function" && window.isGifFreezeActive());
  if (frozenNow) {
    for (const m of mutations) {
      if (m.type === "attributes") {
        if (m.target && m.target.nodeType === 1) {
          if (m.attributeName === "src" && m.target.tagName === "IMG") e(m.target);
          if (m.attributeName === "style" && m.target.style && m.target.style.backgroundImage) t(m.target);
        }
      } else if (m.type === "childList") {
        for (const n of m.addedNodes) {
          if (n && n.nodeType === 1) {
            if (n.matches && n.matches('[style*="background-image"]')) t(n);
            if (n.matches && n.matches("img")) e(n);
            if (n.querySelectorAll) {
              n.querySelectorAll('[style*="background-image"]').forEach(item => t(item));
              n.querySelectorAll("img").forEach(item => e(item));
            }
          }
        }
      }
    }
  }
}).observe(document.body || document.documentElement, {
  childList: !0,
  subtree: !0,
  attributes: !0,
  attributeFilter: ["src", "style"]
});
export function setGifFreeze(val) {
  const isTurbo = (document.body && document.body.classList.contains("mode-turbo")) || "true" === (typeof localStorage !== "undefined" && localStorage.getItem("vh-turbo-mode"));
  const active = Boolean(val || isTurbo);
  window._freezeGifsActive = active;
  const toStatic = (url, size) => {
    try {
      if (window.getStaticAvatarSrc) return window.getStaticAvatarSrc(url, size) || url;
    } catch (_) {}
    return "https://wsrv.nl/?url=" + encodeURIComponent(url) + "&w=" + (size || 80) + "&h=" + (size || 80) + "&fit=cover&output=webp";
  };
  const isGifUrl = (u) => {
    if (!u || typeof u !== "string" || u.startsWith("data:")) return false;
    try {
      if (u.includes("ui-avatars.com") || u.includes("wsrv.nl") || u.includes("images.weserv.nl")) return false;
    } catch (_) {}
    return u.toLowerCase().includes(".gif") || (window.isAnimatedImageUrl && window.isAnimatedImageUrl(u)) || /(?:^|[._-])gif(?:[._/?#]|$)/i.test(u);
  };
  if (active) {
    try {
      document.querySelectorAll("img").forEach(el => {
        try {
          const orig = el.dataset.origSrc || el.dataset.gifA || el.getAttribute("src") || el.src;
          const cur = el.src || orig;
          if (!isGifUrl(cur) && !isGifUrl(orig)) return;
          if (!el.dataset.origSrc) el.dataset.origSrc = orig;
          delete el.dataset.gifFreezeTried;
          const staticSrc = toStatic(el.dataset.origSrc, 80);
          if (staticSrc && el.src !== staticSrc) el.src = staticSrc;
        } catch (_) {}
      });
    } catch (_) {}
    try {
      ["sidebar-avatar-animated", "mobile-sidebar-avatar-animated", "rail-avatar-animated"].forEach(id => {
        const a = document.getElementById(id);
        if (a) { a.classList.add("hidden"); try { a.src = ""; } catch (_) {} a.classList.remove("opacity-0", "group-hover:opacity-100"); }
      });
      ["sidebar-avatar", "mobile-sidebar-avatar", "rail-avatar"].forEach(id => {
        const o = document.getElementById(id);
        if (o) o.classList.remove("group-hover:opacity-0", "opacity-0");
      });
      const photo = window.currentUserProfile && window.currentUserProfile.photoURL;
      if (photo && isGifUrl(photo) && typeof setupGifHover === "function") {
        try { setupGifHover("sidebar-avatar", "sidebar-avatar-animated", photo); } catch (_) {}
      }
    } catch (_) {}
    try {
      document.querySelectorAll("[data-orig-banner]").forEach(el => {
        try {
          const orig = el.dataset.origBanner;
          if (orig && isGifUrl(orig)) el.style.backgroundImage = 'url("' + toStatic(orig, 400) + '")';
        } catch (_) {}
      });
    } catch (_) {}
    r();
  } else {
    document.querySelectorAll("img[data-orig-src]").forEach(el => {
      try {
        el.src = el.dataset.origSrc;
      } catch (_) { try { el.src = el.dataset.origSrc; } catch (_) {} }
      delete el.dataset.origSrc;
      delete el.dataset.gifFreezeTried;
    });
    document.querySelectorAll("img[data-gif-a]").forEach(el => {
      try {
        const cur = el.getAttribute("src") || el.src || "";
        if (cur.includes("wsrv.nl") || cur.includes("images.weserv.nl")) el.src = el.dataset.gifA;
        else if (!cur || cur.startsWith("data:")) el.src = el.dataset.gifA;
      } catch (_) {}
      delete el.dataset.gifFreezeTried;
    });
    document.querySelectorAll("[data-orig-bg]").forEach(el => {
      el.style.backgroundImage = el.dataset.origBg, el.style.backgroundColor = "", delete el.dataset.origBg
    });
    document.querySelectorAll("[data-orig-banner]").forEach(el => {
      el.style.backgroundImage = `url("${el.dataset.origBanner}")`, el.style.backgroundColor = ""
    });
    try {
      const photo = window.currentUserProfile && window.currentUserProfile.photoURL;
      if (photo && typeof setupGifHover === "function") {
        try { setupGifHover("sidebar-avatar", "sidebar-avatar-animated", photo); } catch (_) {}
        try {
          const side = document.getElementById("sidebar-avatar");
          const isGif = typeof photo === "string" && (photo.toLowerCase().includes(".gif") || (window.isAnimatedImageUrl && window.isAnimatedImageUrl(photo)));
          if (side && isGif && side.src !== photo) side.src = photo;
          const anim = document.getElementById("sidebar-avatar-animated");
          if (anim) { anim.classList.add("hidden"); try { anim.src = ""; } catch (_) {} }
        } catch (_) {}
      } else {
        document.querySelectorAll("img").forEach(el => {
          try {
            const src = el.getAttribute("src") || el.src || "";
            const orig = el.dataset.gifA;
            if (orig && (src.includes("wsrv.nl") || src.includes("images.weserv.nl") || src.startsWith("data:"))) el.src = orig;
          } catch (_) {}
        });
      }
    } catch (_) {}
    try {
      const bannerURL = window.currentUserProfile && window.currentUserProfile.bannerURL;
      const bannerColor = (window.currentUserProfile && window.currentUserProfile.bannerColor) || "#3b82f6";
      const uid = (window.currentUserProfile && window.currentUserProfile.uid) || "User";
      ["sidebar-popout-banner", "member-popout-banner"].forEach(id => {
        try {
          const el = document.getElementById(id);
          if (el && typeof applyBannerStyle === "function") {
            const src = el.dataset.origBanner || bannerURL;
            if (src) applyBannerStyle(el, src, bannerColor, uid);
          }
        } catch (_) {}
      });
    } catch (_) {}
    try { if (typeof window.renderServerMembers === "function") window.renderServerMembers(); } catch (_) {}
    try { if (typeof window.renderServerRail === "function") window.renderServerRail(); } catch (_) {}
  }
}
export function initGifFreeze() {
  const e = "true" === (typeof localStorage !== "undefined" && localStorage.getItem("vh-stop-gifs")),
    t = (document.body && document.body.classList.contains("mode-turbo")) || "true" === (typeof localStorage !== "undefined" && localStorage.getItem("vh-turbo-mode"));
  const shouldFreeze = e || t;
  window._freezeGifsActive = shouldFreeze;
  if (shouldFreeze) {
    try { setGifFreeze(true); } catch (_) { try { r(); } catch (_) {} }
  }
  return shouldFreeze
}
window.createAvatarHTML = createAvatarHTML, window.createAvatarWrapper = createAvatarWrapper, window.applyBannerStyle = applyBannerStyle, window.getDefaultAvatarColor = getDefaultAvatarColor, window.getInitial = getInitial, window.getAvatarSrc = getAvatarSrc, window.applyAvatarToPair = applyAvatarToPair, window.setupGifHover = setupGifHover, window.setGifFreeze = setGifFreeze, window.initGifFreeze = initGifFreeze, window.getOptimizedSrc = getOptimizedSrc, window.getRandomProfileColor = getRandomProfileColor, window.resolveProfileColor = resolveProfileColor, window.isValidProfileColor = isValidProfileColor, window.renderFoxyFallback = renderFoxyFallback, window.applyFoxyImgBg = applyFoxyImgBg, window.clearFoxyImgBg = clearFoxyImgBg, window.FOXY_AVATAR_MASK = FOXY_AVATAR_MASK;
