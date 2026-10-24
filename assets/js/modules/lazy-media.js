
const STORAGE_KEY = "vh-lazy-media";
const VIDEO_STORAGE_KEY = "vh-lazy-video";
const BLUR_SIZE = 32;

let probesInFlight = 0;
const MAX_PROBES = 20;

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}

export function fmtBytes(bytes) {
  const b = Number(bytes) || 0;
  if (!b || b < 0) return "";
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(2) + " MB";
}

export function isLazyMediaEnabled() {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch (_) { return false; }
}

export function isLazyVideoEnabled() {
  try { return localStorage.getItem(VIDEO_STORAGE_KEY) === "1"; } catch (_) { return false; }
}

function blurUrl(url) {
  return "https://wsrv.nl/?url=" + encodeURIComponent(url) + "&w=" + BLUR_SIZE + "&h=" + BLUR_SIZE + "&fit=cover&blur=18&output=webp&q=30";
}

const LOAD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"></path><path d="M7 11l5 5 5-5"></path><path d="M4 20h16"></path></svg>';

export function lazyImageHTML(opts) {
  const o = opts || {};
  const url = o.url;
  if (!url) return "";
  const sizeText = fmtBytes(o.size);
  const label = o.label || window.__fb("js.lazy_load_image", "اضغط للتحميل");
  return '<div class="lazy-media" data-lazy-url="' + esc(url) + '"'
    + ' data-lazy-style="' + esc(o.imgStyle || "") + '"'
    + ' data-lazy-class="' + esc(o.imgClass || "") + '"'
    + ' data-lazy-alt="' + esc(o.alt || "") + '"'
    + ' data-lazy-onerr="' + (o.removeOnError ? "1" : "0") + '"'
    + ' style="' + esc(o.boxStyle || "") + '">'
    + '<img class="lazy-media-blur" src="' + esc(blurUrl(url)) + '" alt="" aria-hidden="true" loading="lazy" decoding="async" onerror="this.style.visibility=\'hidden\'">'
    + '<button type="button" class="lazy-media-btn" onclick="window.loadLazyMediaImage(this)">'
    + LOAD_ICON
    + '<span class="lazy-media-label">' + esc(label) + '</span>'
    + '<span class="lazy-media-size" dir="ltr"' + (sizeText ? "" : ' data-lazy-probe="1"') + '>' + esc(sizeText) + '</span>'
    + '</button></div>';
}

export function loadLazyMediaImage(btn) {
  const host = btn && btn.closest ? btn.closest(".lazy-media") : null;
  if (!host || host.classList.contains("is-loading")) return;
  const url = host.dataset.lazyUrl;
  if (!url) return;
  host.classList.add("is-loading");
  btn.innerHTML = '<span class="lazy-media-spinner" aria-hidden="true"></span>'
    + '<span class="lazy-media-label">' + esc(window.__fb("js.lazy_loading_image", "جاري التحميل...")) + '</span>';

  const real = document.createElement("img");
  real.src = url;
  real.alt = host.dataset.lazyAlt || "";
  if (host.dataset.lazyStyle) real.style.cssText = host.dataset.lazyStyle;
  if (host.dataset.lazyClass) real.className = host.dataset.lazyClass;
  if (host.dataset.lazyOnerr === "1") {
    real.onerror = function () { this.closest("a")?.remove(); };
  }

  const proxy = document.createElement("img");
  proxy.decoding = "async";
  proxy.alt = "";
  proxy.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:3";
  const blur = host.querySelector(".lazy-media-blur");
  blur ? host.insertBefore(proxy, blur.nextSibling) : host.insertBefore(proxy, host.firstChild);

  const reset = () => {
    host.classList.remove("is-loading");
    try { proxy.remove(); } catch (_) {}
    btn.innerHTML = LOAD_ICON
      + '<span class="lazy-media-label">' + esc(window.__fb("js.lazy_load_failed", "فشل التحميل — اضغط للتجربة")) + '</span>';
  };
  proxy.onload = () => { host.replaceWith(real); };
  proxy.onerror = reset;
  proxy.src = url;
}

function probeSize(host) {
  const out = host.querySelector(".lazy-media-size[data-lazy-probe]");
  if (!out) return;
  if (probesInFlight >= MAX_PROBES) return;
  probesInFlight++;
  try {
    fetch(host.dataset.lazyUrl, { method: "HEAD", mode: "cors" })
      .then(res => {
        const len = res && res.ok ? res.headers.get("content-length") : null;
        if (len) out.textContent = fmtBytes(len);
      })
      .catch(() => {})
      .then(() => { probesInFlight--; });
  } catch (_) { probesInFlight--; }
}

const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>';

export function lazyVideoHTML(opts) {
  const o = opts || {};
  const url = o.url;
  if (!url) return "";
  const sizeText = fmtBytes(o.size);
  const label = o.label || window.__fb("js.lazy_load_video", "اضغط للتشغيل");
  return '<div class="lazy-media lazy-media-video" data-lazy-url="' + esc(url) + '"'
    + ' data-lazy-style="' + esc(o.videoStyle || "") + '"'
    + ' data-lazy-class="' + esc(o.videoClass || "") + '"'
    + ' style="' + esc(o.boxStyle || "") + '">'
    + '<button type="button" class="lazy-media-btn" onclick="window.loadLazyMediaVideo(this)">'
    + '<span class="lazy-media-play">' + PLAY_ICON + '</span>'
    + '<span class="lazy-media-label">' + esc(label) + '</span>'
    + '<span class="lazy-media-size" dir="ltr"' + (sizeText ? "" : ' data-lazy-probe="1"') + '>' + esc(sizeText) + '</span>'
    + '</button></div>';
}

export function loadLazyMediaVideo(btn) {
  const host = btn && btn.closest ? btn.closest(".lazy-media-video") : null;
  if (!host || host.classList.contains("is-loading")) return;
  const url = host.dataset.lazyUrl;
  if (!url) return;
  host.classList.add("is-loading");
  btn.innerHTML = '<span class="lazy-media-spinner" aria-hidden="true"></span>'
    + '<span class="lazy-media-label">' + esc(window.__fb("js.lazy_loading_video", "جاري التحميل...")) + '</span>';

  const real = document.createElement("video");
  real.src = url;
  real.controls = true;
  real.playsInline = true;
  real.preload = "metadata";
  if (host.dataset.lazyStyle) real.style.cssText = host.dataset.lazyStyle;
  if (host.dataset.lazyClass) real.className = host.dataset.lazyClass;
  const reset = () => {
    host.classList.remove("is-loading");
    try { proxy.remove(); } catch (_) {}
    btn.innerHTML = PLAY_ICON
      + '<span class="lazy-media-label">' + esc(window.__fb("js.lazy_load_failed_video", "فشل التحميل — اضغط للتجربة")) + '</span>';
    btn.onclick = function () { loadLazyMediaVideo(btn); };
  };
  real.addEventListener("error", reset);

  const proxy = document.createElement("video");
  proxy.preload = "metadata";
  proxy.muted = true;
  proxy.playsInline = true;
  proxy.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:3";
  let settled = false;
  const done = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    host.replaceWith(real);
  };
  const timer = setTimeout(done, 4000);
  proxy.addEventListener("loadeddata", done);
  proxy.addEventListener("error", reset);
  host.appendChild(proxy);
  proxy.src = url;
  proxy.load();
}

export function hydrateLazyMedia(root) {
  const scope = root && root.querySelectorAll ? root : document;
  if (isLazyMediaEnabled()) {
    const list = scope.querySelectorAll(".lazy-media[data-lazy-url]:not(.lazy-media-video)");
    for (let i = 0; i < list.length; i++) probeSize(list[i]);
  }
  if (isLazyVideoEnabled()) {
    const vids = scope.querySelectorAll(".lazy-media-video[data-lazy-url]");
    for (let i = 0; i < vids.length; i++) probeSize(vids[i]);
  }
}
function refreshOpenChats() {
  try { window.reloadServerMessages && window.reloadServerMessages(); } catch (_) {}
  try { window.reloadDmMessages && window.reloadDmMessages(); } catch (_) {}
}

export function toggleLazyMedia(on) {
  const value = !!on;
  try { localStorage.setItem(STORAGE_KEY, value ? "1" : "0"); } catch (_) {}
  const box = document.getElementById("lazy-media-toggle");
  if (box && box.checked !== value) box.checked = value;
  if (value) hydrateLazyMedia(document);
  refreshOpenChats();
}

export function toggleLazyVideo(on) {
  const value = !!on;
  try { localStorage.setItem(VIDEO_STORAGE_KEY, value ? "1" : "0"); } catch (_) {}
  const box = document.getElementById("lazy-video-toggle");
  if (box && box.checked !== value) box.checked = value;
  if (value) hydrateLazyMedia(document);
  refreshOpenChats();
}

export function initLazyMedia() {
  const value = isLazyMediaEnabled();
  const box = document.getElementById("lazy-media-toggle");
  if (box) box.checked = value;
  const videoValue = isLazyVideoEnabled();
  const videoBox = document.getElementById("lazy-video-toggle");
  if (videoBox) videoBox.checked = videoValue;
  if (value || videoValue) {
    hydrateLazyMedia(document);
  }
  return value;
}

export function initLazyVideo() {
  const value = isLazyVideoEnabled();
  const box = document.getElementById("lazy-video-toggle");
  if (box) box.checked = value;
  return value;
}

window.isLazyMediaEnabled = isLazyMediaEnabled;
window.isLazyVideoEnabled = isLazyVideoEnabled;
window.loadLazyMediaImage = loadLazyMediaImage;
window.loadLazyMediaVideo = loadLazyMediaVideo;
window.hydrateLazyMedia = hydrateLazyMedia;
window.lazyImageHTML = lazyImageHTML;
window.lazyVideoHTML = lazyVideoHTML;
window.toggleLazyMedia = toggleLazyMedia;
window.toggleLazyVideo = toggleLazyVideo;
window.initLazyMedia = initLazyMedia;
window.initLazyVideo = initLazyVideo;
