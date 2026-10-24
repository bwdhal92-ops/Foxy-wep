import {
  createAvatarHTML as e,
  createAvatarWrapper as t
} from "./ui-avatar-banner.js?v=20260929-2";
import { setSafeInnerHTML, escapeForAttribute, escapeForJsString } from "./sanitize.js";

import { isLazyMediaEnabled, lazyImageHTML, hydrateLazyMedia, isLazyVideoEnabled, lazyVideoHTML } from "./lazy-media.js?v=20260928-1";

export function formatMessageTime(e) {
  if (!e) return "";
  try {
    if ("number" == typeof e) return new Date(e).toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit"
    });
    if ("function" == typeof e.toDate) return e.toDate().toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit"
    });
    if (e.seconds) return new Date(1e3 * e.seconds).toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit"
    })
  } catch (e) {}
  return ""
}

function createActionButton(title, action, ...args) {
  const escapedArgs = args.map(arg => escapeForAttribute(arg)).join("|");
  const icon = action === "showEmojiPicker"
    ? '<circle cx="12" cy="12" r="9"></circle><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"></circle><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"></circle><path d="M8 14c1.2 1.6 2.8 2.4 4 2.4s2.8-.8 4-2.4"></path>'
    : action === "handleMessageToolbarAction" && args.includes("forward")
      ? '<path d="M5 12h13"></path><path d="m13 6 6 6-6 6"></path>'
      : action === "handleMessageToolbarAction"
        ? '<path d="M19 12H5"></path><path d="m11 18-6-6 6-6"></path>'
        : '<circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"></circle><circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none"></circle>';
  return `<button type="button" class="message-action-btn" title="${escapeForAttribute(title)}" data-action="${escapeForAttribute(action)}" data-args="${escapeForAttribute(escapedArgs)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg></button>`;
}

function renderReactionsHTML(reactions, myUid, messageId, context) {
  const map = reactions || {};
  const visible = Object.entries(map).filter(([, uids]) => uids && typeof uids === 'object' && Object.keys(uids).length > 0);
  if (!visible.length) return '';
  return `<div class="msg-reactions-row">${visible.map(([emoji, uids]) =>
    `<button type="button" class="msg-reaction-chip ${uids[myUid] ? 'reacted' : ''}" data-action="toggleReaction" data-args="${escapeForAttribute([messageId, emoji, context].join('|'))}">${escapeForAttribute(emoji)} <span>${Object.keys(uids).length}</span></button>`
  ).join('')}</div>`;
}

function updateReactionRow(row, html) {
  const current = row.querySelector('.msg-reactions-row');
  if (current) {
    if (html) current.outerHTML = html;
    else current.remove();
    return;
  }
  if (!html) return;
  const host = row.querySelector('.message-content')?.parentElement;
  const previews = host?.querySelector('.message-rich-previews');
  if (host) previews ? previews.insertAdjacentHTML('afterend', html) : host.insertAdjacentHTML('beforeend', html);
}

function generateRichPreviews(text = "") {
  const urls = [...String(text).matchAll(/https?:\/\/[^\s<>"']+/gi)]
    .map(match => match[0].replace(/[),.;!?]+$/, ""))
    .filter((url, index, all) => all.indexOf(url) === index)
    .slice(0, 4);
  if (!urls.length) return "";
  return `<div class="message-rich-previews flex flex-col gap-2 mt-2 max-w-md">${urls.map(url => {
    const safeUrl = escapeForAttribute(url);
    const lowerUrl = url.toLowerCase().split("?")[0];
    if (/\.(gif|png|jpe?g|webp|avif|svg)$/i.test(lowerUrl)) {

      if (isLazyMediaEnabled()) {
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" data-lightbox-src="${safeUrl}" class="block rounded-xl overflow-hidden border border-white/10 bg-black/20 hover:border-blue-400/50 transition" style="max-width:100%">${lazyImageHTML({
          url: url,
          alt: window.__fb("js.img_preview", "معاينة الصورة"),
          boxStyle: "min-width:200px;min-height:140px;max-width:100%;max-height:288px",
          imgStyle: "",
          imgClass: "max-h-72 max-w-full object-contain cursor-zoom-in",
          removeOnError: true
        })}</a>`;
      }
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="block rounded-xl overflow-hidden border border-white/10 bg-black/20 hover:border-blue-400/50 transition"><img src="${safeUrl}" data-lightbox-src="${safeUrl}" loading="lazy" class="max-h-72 max-w-full object-contain cursor-zoom-in" alt="${window.__fb('js.img_preview', 'معاينة الصورة')}" onerror="this.closest('a')?.remove()"></a>`;
    }
    if (/\.(mp4|webm|mov|m4v)$/i.test(lowerUrl)) {

      if (isLazyVideoEnabled()) {
        return lazyVideoHTML({
          url: url,
          boxStyle: "width:min(320px,100%)",
          videoClass: "max-h-72 max-w-full rounded-xl border border-white/10 bg-black/30",
          videoStyle: "width:100%;object-fit:contain"
        });
      }
      return `<video src="${safeUrl}" controls preload="metadata" class="max-h-72 max-w-full rounded-xl border border-white/10 bg-black/30"></video>`;
    }
    if (/\.(mp3|wav|ogg|oga|opus|m4a)$/i.test(lowerUrl)) {
      return `<audio src="${safeUrl}" controls class="w-full"></audio>`;
    }
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" data-preview-url="${safeUrl}" class="message-link-preview flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-blue-300 hover:bg-blue-500/10 hover:border-blue-400/40 transition break-all text-xs"><span class="text-base">🔗</span><span>${safeUrl}</span></a>`;
  }).join("")}</div>`;
}
window.generateRichPreviews = generateRichPreviews;

async function hydrateRichPreviews(root) {
  const cards = (root || document).querySelectorAll?.(".message-link-preview[data-preview-url]:not([data-preview-loaded])") || [];
  for (const card of cards) {
    const url = card.getAttribute("data-preview-url");
    if (!url) continue;
    card.setAttribute("data-preview-loaded", "1");
    try {
      const parsedUrl = new URL(url);
      const youtubeMatch = parsedUrl.hostname.replace(/^www\./, "").match(/^(?:youtube\.com|youtu\.be)$/i) && (
        parsedUrl.hostname.replace(/^www\./, "").toLowerCase() === "youtu.be"
          ? parsedUrl.pathname.slice(1)
          : parsedUrl.searchParams.get("v") || parsedUrl.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/)?.[1]
      );
      const tiktokHost = /^(?:www\.|m\.)?tiktok\.com$|^(?:vm|vt)\.tiktok\.com$/i.test(parsedUrl.hostname);
      let tiktokMatch = tiktokHost
        ? parsedUrl.pathname.match(/\/@[^/]+\/(?:video|photo)\/(\d+)/i)?.[1]
          || parsedUrl.pathname.match(/\/v\/(\d+)/i)?.[1]
        : null;
      if (youtubeMatch) {
        const videoUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeMatch)}`;
        const youtubeResponse = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`, { cache: "force-cache" });
        if (youtubeResponse.ok) {
          const youtubeData = await youtubeResponse.json();
          card.outerHTML = `<div class="message-youtube-preview flex flex-col gap-2 mt-1 max-w-lg rounded-xl overflow-hidden border border-white/10 bg-black/30" data-preview-loaded="1"><iframe src="https://www.youtube.com/embed/${encodeURIComponent(youtubeMatch)}?rel=0&modestbranding=1&playsinline=1" title="${escapeForAttribute(youtubeData.title || "فيديو YouTube")}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" class="w-full aspect-video border-0" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe><a href="${escapeForAttribute(videoUrl)}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 p-2 text-xs hover:bg-white/[0.04] transition"><img src="https://i.ytimg.com/vi/${encodeURIComponent(youtubeMatch)}/hqdefault.jpg" loading="lazy" class="w-16 h-9 rounded object-cover shrink-0" alt=""><span class="min-w-0 flex flex-col gap-0.5"><strong class="text-xs text-white truncate">${escapeForAttribute(youtubeData.title || "فيديو YouTube")}</strong><small class="text-[10px] text-red-400 truncate">YouTube · ${escapeForAttribute(youtubeData.author_name || "")}</small></span></a></div>`;
          continue;
        }
      }
      if (tiktokHost) {

        const tiktokResponse = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { cache: "force-cache" });
        if (tiktokResponse.ok) {
          const tiktokData = await tiktokResponse.json();
          tiktokMatch ||= tiktokData.html?.match(/data-video-id=["'](\d+)["']/i)?.[1];
          if (tiktokMatch) {
            const playerUrl = `https://www.tiktok.com/player/v1/${encodeURIComponent(tiktokMatch)}?controls=1&description=1&music_info=1`;
            const thumbnail = tiktokData.thumbnail_url
              ? `<img src="${escapeForAttribute(tiktokData.thumbnail_url)}" loading="lazy" class="w-16 h-20 rounded object-cover shrink-0" alt="" onerror="this.remove()">`
              : "";
            card.outerHTML = `<div class="message-tiktok-preview flex flex-col gap-2 mt-1 max-w-sm rounded-xl overflow-hidden border border-white/10 bg-black/30" data-preview-loaded="1"><iframe src="${playerUrl}" title="${escapeForAttribute(tiktokData.title || window.__fb("js.tiktok_fb", "فيديو TikTok"))}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" class="w-full border-0" style="aspect-ratio:9/16;max-height:520px" allow="fullscreen" allowfullscreen></iframe><a href="${escapeForAttribute(url)}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 p-2 text-xs hover:bg-white/[0.04] transition">${thumbnail}<span class="min-w-0 flex flex-col gap-0.5"><strong class="text-xs text-white line-clamp-2">${escapeForAttribute(tiktokData.title || window.__fb("js.tiktok_fb", "فيديو TikTok"))}</strong><small class="text-[10px] text-cyan-400 truncate">TikTok · ${escapeForAttribute(tiktokData.author_name || "")}</small></span></a></div>`;
            continue;
          }
        }
      }
      const twitchHost = /^(?:www\.)?twitch\.tv$/i.test(parsedUrl.hostname);
      const twitchChannel = twitchHost ? parsedUrl.pathname.match(/^\/([a-z0-9_]{4,25})\/?$/i)?.[1] : null;
      if (twitchChannel) {

        const parent = window.location.hostname || 'localhost';
        const playerUrl = `https://player.twitch.tv/?channel=${encodeURIComponent(twitchChannel)}&parent=${encodeURIComponent(parent)}&autoplay=false`;
        card.outerHTML = `<div class="message-twitch-preview flex flex-col gap-2 mt-1 max-w-lg rounded-xl overflow-hidden border border-purple-500/20 bg-black/30" data-preview-loaded="1"><iframe src="${escapeForAttribute(playerUrl)}" title="Twitch · ${escapeForAttribute(twitchChannel)}" loading="lazy" class="w-full aspect-video border-0" allow="autoplay; fullscreen" allowfullscreen></iframe><a href="${escapeForAttribute(url)}" target="_blank" rel="noopener noreferrer" class="p-2 text-xs text-purple-300 hover:bg-white/[0.04] transition">Twitch · ${escapeForAttribute(twitchChannel)}</a></div>`;
        continue;
      }
      const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true`, { cache: "force-cache" });
      if (!response.ok) continue;
      const payload = await response.json();
      const data = payload?.data || {};
      const title = data.title || data.publisher || new URL(url).hostname;
      const description = data.description || "";
      const image = data.image?.url || data.logo?.url || "";
      card.innerHTML = `${image ? `<img src="${escapeForAttribute(image)}" loading="lazy" class="w-16 h-16 rounded-lg object-cover shrink-0" alt="" onerror="this.remove()">` : '<span class="text-xl shrink-0">🔗</span>'}<span class="min-w-0 flex flex-col gap-0.5"><strong class="text-xs text-white truncate">${escapeForAttribute(title)}</strong>${description ? `<small class="text-[10px] text-gray-400 line-clamp-2">${escapeForAttribute(description)}</small>` : `<small class="text-[10px] text-gray-500 truncate">${escapeForAttribute(new URL(url).hostname)}</small>`}</span>`;
      card.classList.add("p-2");
    } catch (error) {

    }
  }
}

let latexLoadPromise;
async function hydrateLatex(root) {
  const nodes = [...((root || document).querySelectorAll?.('.message-content') || [])]
    .filter(node => !node.dataset.latexChecked && /\\\(|\\\[|\$\$/.test(node.textContent || ''));
  if (!nodes.length) return;
  nodes.forEach(node => { node.dataset.latexChecked = '1'; });
  window.MathJax = window.MathJax || { tex: { inlineMath: [['\\(', '\\)'], ['$', '$']], displayMath: [['\\[', '\\]'], ['$$', '$$']] } };
  latexLoadPromise ||= new Promise((resolve, reject) => {
    if (window.MathJax?.typesetPromise) return resolve();
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  try {
    await latexLoadPromise;
    if (window.MathJax?.typesetPromise) await window.MathJax.typesetPromise(nodes);
  } catch (_) { /* MathJax is optional when offline. */ }
}

/* ── مشغّل الفويس بستايل واتساب: زر أزرق + موجة + مدة + سرعة ── */
const voicePeakCache = {};
let foxyVoiceAudio = null, foxyVoiceCurrent = null;

function ensureVoiceStyle() {
  if (document.getElementById('foxy-voice-style')) return;
  const st = document.createElement('style');
  st.id = 'foxy-voice-style';
  st.textContent = '.foxy-voice-msg{direction:ltr}'
    + '.foxy-vp-play{width:38px;height:38px;border-radius:50%;background:#0ea5e9;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:none;cursor:pointer;transition:transform .15s,background .15s;padding:0}'
    + '.foxy-vp-play:hover{background:#0284c7;transform:scale(1.06)}'
    + '.foxy-vp-play svg{width:18px;height:18px}'
    + '.foxy-vp-wave{flex:1;display:flex;align-items:center;gap:2px;height:32px;min-width:0;cursor:pointer}'
    + '.foxy-vp-wave span{flex:1;min-width:2px;border-radius:2px;background:rgba(255,255,255,.22);transition:background .1s}'
    + '.foxy-vp-wave span.on{background:#0ea5e9}'
    + '.foxy-vp-time{font-size:11px;color:#94a3b8;font-variant-numeric:tabular-nums;flex-shrink:0;min-width:32px;text-align:center}'
    + '.foxy-vp-speed{font-size:11px;font-weight:800;color:#e2e8f0;background:rgba(255,255,255,.08);border:none;border-radius:8px;padding:3px 7px;cursor:pointer;flex-shrink:0;font-family:inherit}'
    + '.foxy-vp-speed:hover{background:rgba(255,255,255,.15)}';
  document.head.appendChild(st);
}

function fmtVoiceTime(s) {
  s = Number(s);
  if (!isFinite(s) || s < 0) s = 0;
  s = Math.floor(s);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function bubbleDuration(b) {
  try {
    const audio = foxyVoiceAudio;
    const url = b.getAttribute('data-voice-url');
    if (audio && audio.src === url && audio.duration && isFinite(audio.duration)) return audio.duration;
  } catch (_) {}
  return parseFloat(b.getAttribute('data-voice-dur')) || 0;
}

function ensureRealDuration(audioEl, cb) {
  try {
    const d = audioEl.duration;
    if (d && isFinite(d)) { cb(d); return; }
  } catch (_) { cb(0); return; }
  let done = false;
  const finish = (val) => {
    if (done) return; done = true;
    try { audioEl.removeEventListener('durationchange', onDur); } catch (_) {}
    cb(val);
  };
  const onDur = () => {
    try {
      const nd = audioEl.duration;
      if (nd && isFinite(nd)) { try { audioEl.currentTime = 0; } catch (_) {} finish(nd); }
    } catch (_) {}
  };
  try {
    audioEl.addEventListener('durationchange', onDur);
    audioEl.currentTime = 1e7;
  } catch (_) { finish(0); return; }
  setTimeout(() => {
    let nd = 0;
    try { nd = audioEl.duration; } catch (_) {}
    finish(nd && isFinite(nd) ? nd : 0);
  }, 5000);
}

function paintVoiceBars(root, peaks) {
  const wave = root.querySelector('.foxy-vp-wave');
  if (!wave) return;
  wave.innerHTML = peaks.map(p => `<span style="height:${Math.max(12, Math.round(p * 100))}%"></span>`).join('');
}

// مضيفات لا ترسل Access-Control-Allow-Origin أبداً ⇒ decodeAudioData مستحيل
// عبر fetch، وكل محاولة تهدر جولة شبكة + خطأ CORS في الكونسول مع كل رسم.
// نعرفها مسبقاً ونذهب مباشرة لقمم اصطناعية (بلا أي طلب).
const VOICE_PEAK_CORS_BLOCKED_HOSTS = [
  'cdn.discordapp.com', 'media.discordapp.net', 'discordapp.com',
  'discord.com', 'images-ext-1.discordapp.net'
];
function voicePeakHostIsCorsBlocked(url) {
  try {
    const h = new URL(url, location.href).hostname;
    return VOICE_PEAK_CORS_BLOCKED_HOSTS.some(d => h === d || h.endsWith('.' + d));
  } catch (_) { return false; }
}
function syntheticVoicePeaks(url, count) {
  let h = 0;
  for (const c of String(url)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const peaks = [];
  let x = h || 7;
  for (let i = 0; i < count; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; peaks.push(0.15 + (x % 85) / 100); }
  return peaks;
}
async function loadVoicePeaks(url, count) {
  if (voicePeakCache[url]) return voicePeakCache[url];
  if (voicePeakHostIsCorsBlocked(url)) {
    const p0 = syntheticVoicePeaks(url, count);
    voicePeakCache[url] = p0;
    return p0;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = await res.arrayBuffer();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('no-ac');
    const ctx = new AC();
    const audio = await ctx.decodeAudioData(buf);
    try { ctx.close(); } catch (_) {}
    const ch = audio.getChannelData(0);
    const raw = [];
    const seg = Math.max(1, Math.floor(ch.length / count));
    let gmax = 0;
    for (let i = 0; i < count; i++) {
      let m = 0;
      for (let j = i * seg; j < (i + 1) * seg; j += 7) {
        const v = Math.abs(ch[j] || 0);
        if (v > m) m = v;
      }
      raw.push(m);
      if (m > gmax) gmax = m;
    }

    const peaks = raw.map(m => {
      if (!gmax) return 0.15;
      const n = m / gmax;
      return Math.min(1, 0.12 + Math.pow(n, 0.75) * 0.95);
    });
    voicePeakCache[url] = peaks;
    return peaks;
  } catch (_) {
    const peaks = syntheticVoicePeaks(url, count);
    voicePeakCache[url] = peaks;
    return peaks;
  }
}

function getVoiceAudio() {
  if (!foxyVoiceAudio) {
    foxyVoiceAudio = new Audio();
    foxyVoiceAudio.preload = 'metadata';
    foxyVoiceAudio.addEventListener('timeupdate', onVoiceTick);
    foxyVoiceAudio.addEventListener('ended', onVoiceEnd);
    foxyVoiceAudio.addEventListener('loadedmetadata', () => {
      const b = foxyVoiceCurrent;
      if (!b || !b.isConnected) return;
      if (foxyVoiceAudio.duration && isFinite(foxyVoiceAudio.duration)) {
        const t = b.querySelector('.foxy-vp-time');
        if (t && !b.classList.contains('playing')) t.textContent = fmtVoiceTime(foxyVoiceAudio.duration);
      }
      if (b._pendingSeek != null) {
        const effD = bubbleDuration(b);
        if (effD) {
          try { foxyVoiceAudio.currentTime = b._pendingSeek * effD; } catch (_) {}
          b._pendingSeek = null;
        }
      }
    });
  }
  return foxyVoiceAudio;
}

function setVoicePlayingUI(root, playing) {
  root.querySelector('.foxy-vp-ic-play')?.classList.toggle('hidden', playing);
  root.querySelector('.foxy-vp-ic-pause')?.classList.toggle('hidden', !playing);
  root.classList.toggle('playing', playing);
}

function resetVoicePaint(root) {
  root.querySelectorAll('.foxy-vp-wave span').forEach(s => s.classList.remove('on'));
  const t = root.querySelector('.foxy-vp-time');
  if (t) t.textContent = fmtVoiceTime(bubbleDuration(root));
}

function onVoiceTick() {
  const b = foxyVoiceCurrent;
  if (!b || !b.isConnected || !foxyVoiceAudio) return;
  const d = bubbleDuration(b), c = foxyVoiceAudio.currentTime || 0;
  const bars = b.querySelectorAll('.foxy-vp-wave span');
  const p = d ? c / d : 0;
  bars.forEach((s, i) => s.classList.toggle('on', (i + 1) / bars.length <= p));

  const t = b.querySelector('.foxy-vp-time');
  if (t) t.textContent = fmtVoiceTime(Math.max(0, d - c));
}

function onVoiceEnd() {
  const b = foxyVoiceCurrent;
  foxyVoiceCurrent = null;
  if (!b || !b.isConnected) return;
  setVoicePlayingUI(b, false);
  resetVoicePaint(b);
}

function toggleVoiceBubble(b) {
  const audio = getVoiceAudio();
  const url = b.getAttribute('data-voice-url') || '';
  if (foxyVoiceCurrent === b && !audio.paused) {
    audio.pause();
    setVoicePlayingUI(b, false);
    return;
  }
  if (foxyVoiceCurrent && foxyVoiceCurrent !== b && foxyVoiceCurrent.isConnected) {
    setVoicePlayingUI(foxyVoiceCurrent, false);
    foxyVoiceCurrent.classList.remove('playing');
    try { resetVoicePaint(foxyVoiceCurrent); } catch (_) {}
  }
  foxyVoiceCurrent = b;
  try {
    if (audio.src !== url) { audio.src = url; audio.load(); }
  } catch (_) {}
  audio.playbackRate = parseFloat(b.getAttribute('data-speed') || '1') || 1;
  const pr = audio.play();
  if (pr && pr.catch) pr.catch(() => {});
  setVoicePlayingUI(b, true);
}

function cycleVoiceSpeed(b) {
  const steps = [1, 1.5, 2];
  const cur = parseFloat(b.getAttribute('data-speed') || '1') || 1;
  const next = steps[(steps.indexOf(cur) + 1 + steps.length) % steps.length];
  b.setAttribute('data-speed', String(next));
  const btn = b.querySelector('.foxy-vp-speed');
  if (btn) btn.textContent = String(next) + 'X';
  if (foxyVoiceCurrent === b && foxyVoiceAudio) {
    try { foxyVoiceAudio.playbackRate = next; } catch (_) {}
  }
}

function seekVoiceBubble(b, e) {
  const wave = b.querySelector('.foxy-vp-wave');
  if (!wave) return;
  const r = wave.getBoundingClientRect();
  if (!r.width) return;
  const ratio = Math.min(0.999, Math.max(0, (e.clientX - r.left) / r.width));
  const audio = getVoiceAudio();
  const url = b.getAttribute('data-voice-url') || '';
  if (foxyVoiceCurrent && foxyVoiceCurrent !== b && foxyVoiceCurrent.isConnected) {
    setVoicePlayingUI(foxyVoiceCurrent, false);
    foxyVoiceCurrent.classList.remove('playing');
    try { resetVoicePaint(foxyVoiceCurrent); } catch (_) {}
  }
  foxyVoiceCurrent = b;
  try {
    if (audio.src !== url) { audio.src = url; audio.load(); }
  } catch (_) {}
  audio.playbackRate = parseFloat(b.getAttribute('data-speed') || '1') || 1;
  if (audio.duration && isFinite(audio.duration)) {
    try { audio.currentTime = ratio * audio.duration; } catch (_) {}
  } else {
    b._pendingSeek = ratio;
  }
  const pr = audio.play();
  if (pr && pr.catch) pr.catch(() => {});
  setVoicePlayingUI(b, true);
}

export function initVoicePlayers(root) {
  ensureVoiceStyle();
  const scope = root && root.querySelectorAll ? root : document;
  if (!scope.querySelectorAll) return;
  const bubbles = scope.querySelectorAll('.foxy-voice-msg:not([data-vinit])');
  bubbles.forEach(b => {
    b.setAttribute('data-vinit', '1');
    b.setAttribute('data-speed', '1');
    const url = b.getAttribute('data-voice-url') || '';
    const fallbackDur = parseFloat(b.getAttribute('data-voice-dur')) || 0;
    const timeEl = b.querySelector('.foxy-vp-time');
    if (timeEl) timeEl.textContent = fmtVoiceTime(fallbackDur);
    paintVoiceBars(b, new Array(42).fill(0.45));
    loadVoicePeaks(url, 42).then(peaks => { if (b.isConnected) paintVoiceBars(b, peaks); });
    try {
      const probe = new Audio();
      probe.preload = 'metadata';
      probe.src = url;
      probe.addEventListener('loadedmetadata', () => {
        if (!b.isConnected || b.classList.contains('playing')) return;
        const show = (d) => {
          if (!b.isConnected || b.classList.contains('playing')) return;
          const t = b.querySelector('.foxy-vp-time');
          if (t) t.textContent = fmtVoiceTime(d || fallbackDur);
        };
        if (probe.duration && isFinite(probe.duration)) show(probe.duration);
        else ensureRealDuration(probe, show);
      });
    } catch (_) {}
    const playBtn = b.querySelector('.foxy-vp-play');
    if (playBtn) playBtn.addEventListener('click', ev => { ev.stopPropagation(); toggleVoiceBubble(b); });
    const speedBtn = b.querySelector('.foxy-vp-speed');
    if (speedBtn) speedBtn.addEventListener('click', ev => { ev.stopPropagation(); cycleVoiceSpeed(b); });
    const wave = b.querySelector('.foxy-vp-wave');
    if (wave) wave.addEventListener('click', ev => { ev.stopPropagation(); seekVoiceBubble(b, ev); });
  });
}
window.initVoicePlayers = initVoicePlayers;

window.processPostRenderLinks = async function(root) {
  await hydrateRichPreviews(root);
  await hydrateLatex(root);

  try { hydrateLazyMedia(root); } catch (_) {}
  try { initVoicePlayers(root); } catch (_) {}
};

export function renderPollHTML(poll, myUid, messageId, context) {
  if (!poll || !Array.isArray(poll.options)) return "";
  const options = poll.options.map(o => String(o ?? "")).filter(t => t.trim().length > 0).slice(0, 6);
  if (options.length < 2) return "";
  const votes = (poll.votes && typeof poll.votes === "object" && !Array.isArray(poll.votes)) ? poll.votes : {};
  const counts = options.map((_, idx) => Object.values(votes).filter(v => Number(v) === idx).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const myVoteRaw = myUid != null ? votes[myUid] : undefined;
  const myVote = myVoteRaw === undefined || myVoteRaw === null ? -1 : Number(myVoteRaw);
  const votedLabel = window.__fb("js.poll_voted", "صوتك");
  const votesLabel = total === 1 ? "صوت واحد" : (total === 2 ? "صوتان" : `${total} صوت`);
  const totalLabel = window.__f ? window.__f("js.poll_total", { count: total }, `${votesLabel}`) : votesLabel;
  const btns = options.map((opt, idx) => {
    const c = counts[idx] || 0;
    const pct = total > 0 ? Math.round((c / total) * 100) : 0;
    const isMine = myVote === idx;
    return `<button type="button" data-action="votePoll" data-args="${escapeForAttribute(messageId)}|${idx}|${escapeForAttribute(context || "server")}" class="poll-option-btn relative w-full text-right rounded-lg border px-3 py-2 transition overflow-hidden ${isMine ? "border-emerald-500/60 bg-emerald-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20"}">`
      + `<span class="absolute inset-y-0 right-0 ${isMine ? "bg-emerald-500/15" : "bg-white/[0.06]"}" style="width:${pct}%"></span>`
      + `<span class="relative flex items-center justify-between gap-2"><span class="text-xs font-bold ${isMine ? "text-emerald-300" : "text-gray-200"} break-words flex-1">${escapeForAttribute(opt)}${isMine ? ` <span class="text-[9px] font-black text-emerald-400">✓ ${escapeForAttribute(votedLabel)}</span>` : ""}</span>`
      + `<span class="text-[10px] font-mono ${isMine ? "text-emerald-300" : "text-gray-500"} shrink-0">${c} · ${pct}%</span></span></button>`;
  }).join("");
  return `<div class="poll-card mt-2 rounded-xl border border-emerald-500/20 bg-black/30 p-3 max-w-md">`
    + `<div class="flex items-center gap-1.5 mb-2"><span class="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 5c0-1.1.9-2 2-2h16a2 2 0 1 1 0 4H4a2 2 0 0 1-2-2ZM2 12c0-1.1.9-2 2-2h6a2 2 0 1 1 0 4H4a2 2 0 0 1-2-2ZM4 17a2 2 0 1 0 0 4h12a2 2 0 1 0 0-4H4Z"/></svg></span><span class="text-[10px] font-black text-emerald-400 uppercase tracking-wider">${escapeForAttribute(window.__fb("js.poll_badge", "تصويت"))}</span></div>`
    + `<div class="space-y-1.5">${btns}</div>`
    + `<div class="flex items-center justify-between gap-2 mt-2"><p class="text-[10px] text-gray-500">${escapeForAttribute(totalLabel)} · ${escapeForAttribute(window.__fb("js.poll_hint", "اضغط للتصويت — الضغط مجددًا يسحب صوتك"))}</p>`
    + `<button type="button" data-action="showPollVoters" data-args="${escapeForAttribute(messageId)}|${escapeForAttribute(context || "server")}" class="text-[10px] font-black text-emerald-400 hover:text-emerald-300 hover:underline shrink-0 transition">${escapeForAttribute(window.__fb("js.poll_who", "من صوّت؟"))}</button></div></div>`;
}

export function resolveMemberColor(uid, displayName) {
  const st = window.state || {};
  const pick = o => (o && (o.avatarColor || o.bannerColor)) || "";
  let c = pick(st.serverMembersData && st.serverMembersData[uid]) ||
          pick(st.globalUsersData && st.globalUsersData[uid]) ||
          pick(st.members && st.members.find(x => x.id === uid || x.uid === uid));
  if (!c && "function" == typeof window.getFriendData) c = pick(window.getFriendData(uid));
  const id = uid || displayName;
  return "function" == typeof window.resolveProfileColor
    ? window.resolveProfileColor(id, c)
    : (c || "#334155");
}

export function repairRenderedAvatarColours() {
  let n = 0;
  try {
    document.querySelectorAll(".message-avatar-profile-trigger[data-uid]").forEach(el => {
      const uid = el.getAttribute("data-uid");
      if (!uid || uid === (window.currentUserProfile && window.currentUserProfile.uid) || uid === window.myUid) return;
      const box = el.querySelector("div[style*='background-color']");
      if (!box) return;
      const letter = box.querySelector(".foxy-avatar-letter");

      if (box.querySelector("img[src*='http']")) return;
      const want = resolveMemberColor(uid, letter ? letter.textContent : "");
      if (box.style.backgroundColor && box.style.backgroundColor.toLowerCase() === String(want).toLowerCase()) return;
      box.style.backgroundColor = want;
      box.style.backgroundImage = "none";
      n++;
    });
  } catch (_) {}
  if (n && window.FOXY_DEBUG) console.log("[chat] repainted " + n + " avatar colour(s)");
  return n;
}
if ("function" == typeof window !== "undefined") {
  window.resolveMemberColor = resolveMemberColor;
  window.repairRenderedAvatarColours = repairRenderedAvatarColours;
  const _run = () => setTimeout(() => { try { window.repairRenderedAvatarColours && window.repairRenderedAvatarColours(); } catch (_) {} }, 300);
  window.addEventListener("MemberDataReady", _run);
  document.addEventListener("visibilitychange", () => { "visible" === document.visibilityState && _run(); });
}
export function createMessageHTML(i) {
  const {
    myUid: n,
    senderUid: o,
    senderName: s,
    senderPhotoURL: r,
    timestamp: a,
    text: l,
    isForwarded: c,
    replyTo: d,
    edited: p,
    hasPendingWrites: h,
    context: g,
    roleDotStyle: w,
    roleTextStyle: m,
    messageId: u,
    poll: pollData
  } = i, f = o === n, v = formatMessageTime(a);
  let x = s || window.__fb("app_chat.default_sender", "مستخدم");
  f && (x = window.__fb("app_chat.you_label", "أنت"));
  const M = m || (f ? "color: rgb(16, 185, 129);" : "color: #e2e8f0;"),
    currentPhoto = f ? (window.currentUserProfile?.photoURL || r) : r,

    avatarColor = f ? (window.currentUserProfile?.avatarColor || window.currentUserProfile?.bannerColor || "") : resolveMemberColor(o, x),
    y = e(currentPhoto, x, {
      size: 9,
      shape: "circle",
      identity: o || x,
      color: avatarColor,

      dotColor: avatarColor || "#334155",
      shadow: "shadow-md",
      extra: "mt-0.5" + ("dm" === g ? " border border-white/10" : ""),
      direct: !0
    }),
    _ = t(y, {
      clickHandler: null,
      wrapperExtra: "flex-shrink-0"
    });
  let L = l || "";
  window.escapeMessageHTML && (L = window.escapeMessageHTML(L)), window.stripImageLinks && (L = window.stripImageLinks(L)), window.parseTimeMentions && (L = window.parseTimeMentions(L)), window.parseUserMentions && (L = window.parseUserMentions(L)), window.parseRoleMentions && (L = window.parseRoleMentions(L)), window.parseChannelMentions && (L = window.parseChannelMentions(L)), window.parseMarkdown && (L = window.parseMarkdown(L)), window.parseURLs && (L = window.parseURLs(L));
  const reactionsHTML = renderReactionsHTML(i.reactions, n, u, g);
  const pollHTML = renderPollHTML(pollData, n, u, g);
  const avatarWithProfile = `<div class="message-avatar-profile-trigger cursor-pointer" data-action="showMemberProfile" data-uid="${escapeForAttribute(o)}">${_}</div>`;
  const replyHTML = d ? `<div class="mb-1 p-1.5 px-2 bg-white/5 border-l-2 border-blue-400 rounded-md text-[11px] opacity-80 cursor-pointer hover:opacity-100 transition-opacity flex flex-col gap-0.5 message-reply" data-msg-id="${escapeForAttribute(d.msgId)}"><span class="font-bold text-blue-300">${window.__f("js.reply_to", {name: escapeForAttribute(d.senderName)}, `الرد على ${escapeForAttribute(d.senderName)}:`)}</span><span class="text-gray-400 italic truncate">${escapeForAttribute(d.text)}</span></div>` : "";
  const forwardedHTML = c ? '<div class="text-[10px] text-gray-500 mb-1 flex items-center gap-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3"><polyline points="15 17 20 12 15 7"></polyline><path d="M4 18v-2a4 4 0 0 1 4-4h12"></path></svg>' + window.__fb("js.forwarded", "رسالة موجهة") + '</div>' : "";
  const editedHTML = p ? '<span class="text-[10px] text-gray-500 mr-1">(\u0645\u0639\u062f\u0644\u0629)</span>' : "";
  const pendingHTML = f && h ? '<span class="text-[9px] text-gray-400 italic ml-1">\u062c\u0627\u0631\u064a \u0627\u0644\u0625\u0631\u0633\u0627\u0644...</span>' : "";
  const sentHTML = f && !h ? '<span class="text-[10px] text-emerald-500 ml-1 mt-0.5" title="' + window.__fb('js.sent_title', 'تم الإرسال') + '"><svg class="w-3.5 h-3.5 inline pb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></span>' : "";
  const fmtBytes = b => { b = Number(b) || 0; if (!b) return ""; if (b < 1024) return b + " B"; if (b < 1048576) return (b / 1024).toFixed(1) + " KB"; return (b / 1048576).toFixed(2) + " MB"; };
  const kindIcon = k => k === "video" ? "🎥" : (k === "audio" ? "🎵" : (k === "voice" ? "🎙" : "📎"));
  const guessKind = a => {
    if (a?.kind && a.kind !== "image") return a.kind;
    const u = String(a?.url || "").toLowerCase().split("?")[0];
    const m = String(a?.mime || "").toLowerCase();
    if (m.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/.test(u)) return "video";
    if (m.startsWith("audio/") || /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus)$/.test(u)) return "audio";
    if (!/\.(png|jpe?g|gif|webp|avif|svg|bmp)$/.test(u) && (m.startsWith("application/") || m.startsWith("text/") || /\.(pdf|zip|rar|7z|doc|docx|xls|xlsx|ppt|pptx|txt|apk|exe)$/.test(u))) return "file";
    return a?.kind || "image";
  };
  const attachmentsHTML = Array.isArray(i.attachments) ? i.attachments.map((attachment, index) => {
    if (!attachment?.url) return '';
    const kind = guessKind(attachment);
    const safeName = attachment.name || "ملف";
    if (kind === "video") {

      if (isLazyVideoEnabled()) {
        return lazyVideoHTML({
          url: attachment.url,
          size: attachment.size,
          boxStyle: "margin-top:.5rem;width:min(420px,100%)",
          videoClass: "max-h-72 max-w-full rounded-xl border border-white/10 bg-black/40",
          videoStyle: "width:100%;object-fit:contain"
        });
      }
      return `<video src="${escapeForAttribute(attachment.url)}" controls preload="metadata" playsinline class="mt-2 max-h-72 max-w-full rounded-xl border border-white/10 bg-black/40" style="max-width:min(420px,100%)"></video>`;
    }
    if (kind === "audio" || kind === "voice") {
      if (kind === "voice") {
        let durSecs = 0;
        const durMatch = String(safeName || "").match(/\((\d+):(\d{2})\)/);
        if (durMatch) durSecs = (parseInt(durMatch[1], 10) || 0) * 60 + (parseInt(durMatch[2], 10) || 0);
        return `<div class="foxy-voice-msg mt-2 flex items-center gap-2.5 max-w-md rounded-2xl border border-white/10 bg-black/30 pl-2 pr-3 py-2" dir="ltr" data-voice-url="${escapeForAttribute(attachment.url)}" data-voice-dur="${durSecs}" title="${escapeForAttribute(safeName || "رسالة صوتية")}">`
          + `<button type="button" class="foxy-vp-play" title="تشغيل / إيقاف"><svg class="foxy-vp-ic-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg><svg class="foxy-vp-ic-pause hidden" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg></button>`
          + `<div class="foxy-vp-wave" title="اضغط للتقديم"></div>`
          + `<span class="foxy-vp-time">0:00</span>`
          + `<button type="button" class="foxy-vp-speed" title="سرعة التشغيل">1X</button></div>`;
      }
      return `<div class="mt-2 flex items-center gap-2 max-w-md rounded-xl border border-white/10 bg-black/30 px-3 py-2"><span class="text-xl shrink-0">🎵</span><div class="min-w-0 flex-1"><div class="truncate text-[11px] font-bold text-gray-200">${escapeForAttribute(safeName)}</div><audio src="${escapeForAttribute(attachment.url)}" controls preload="metadata" class="w-full mt-1" style="height:32px"></audio></div></div>`;
    }
    if (kind === "file") {
      return `<a href="${escapeForAttribute(attachment.url)}" target="_blank" rel="noopener noreferrer" download="${escapeForAttribute(safeName)}" class="mt-2 flex items-center gap-3 max-w-md rounded-xl border border-white/10 bg-white/[0.04] hover:bg-blue-500/10 hover:border-blue-400/40 transition px-3 py-2.5"><span class="text-2xl shrink-0">${kindIcon(kind)}</span><span class="min-w-0 flex-1"><span class="block truncate text-xs font-bold text-white">${escapeForAttribute(safeName)}</span><span class="block text-[10px] text-gray-400">${escapeForAttribute(fmtBytes(attachment.size))} · اضغط للتحميل</span></span><span class="text-blue-300 text-lg shrink-0">⬇</span></a>`;
    }

    if (attachment.oneTime && (kind === "video" || kind === "audio" || kind === "voice")) {
      const isMedia = kind === "video" ? "فيديو" : kind === "audio" ? "ملف صوتي" : "رسالة صوتية";
      const ico = kind === "video" ? "🎬" : "🎵";
      const viewer2 = Object.values(attachment.viewedBy || {})[0];
      if (viewer2 && f) return `<div class="mt-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-400/20 rounded-xl px-3 py-2 inline-flex items-center gap-2">${window.__f("js.opened_by", {name: escapeForAttribute(viewer2.name || window.__fb("app_chat.default_sender", "مستخدم"))}, `👁 فتحها ${escapeForAttribute(viewer2.name || "مستخدم")}`)}</div>`;
      if (f) return `<div class="mt-2 text-[11px] text-gray-500 bg-white/5 border border-white/10 rounded-xl px-3 py-2 inline-flex items-center gap-2">🔒 ${escapeForAttribute(isMedia)} تُفتح مرة واحدة · بانتظار الفتح</div>`;
      if (viewer2) return `<div class="mt-2 text-[11px] text-gray-500 bg-white/5 border border-white/10 rounded-xl px-3 py-2 inline-flex items-center gap-2">🔒 تم فتح ${escapeForAttribute(isMedia)} مرة واحدة</div>`;
      return `<button type="button" class="one-time-image-card mt-2 w-56 max-w-full min-h-24 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-4 text-right hover:bg-amber-500/20 transition" data-action="openOneTimeImage" data-message-id="${escapeForAttribute(u)}" data-attachment-index="${index}" data-context="${escapeForAttribute(g)}" data-image-url="${escapeForAttribute(attachment.url)}"><span class="block text-amber-300 font-bold text-sm">🔒 ${escapeForAttribute(isMedia)} تُفتح مرة واحدة</span><span class="block text-[11px] text-amber-200/70 mt-1">اضغط للعرض — لن تتمكن من فتحها مجددًا</span><span class="block text-[10px] text-gray-400/70 mt-1 truncate">${escapeForAttribute(safeName)}</span></button>`;
    }
    if (!attachment.oneTime) {

      if (isLazyMediaEnabled()) {
        return `<a href="${escapeForAttribute(attachment.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;width:max-content;max-width:100%;height:auto;max-height:176px;line-height:0" class="mt-2 rounded-xl overflow-hidden border border-white/10 bg-black/20">${lazyImageHTML({
          url: attachment.url,
          size: attachment.size,
          alt: window.__fb("js.att_attached", "صورة مرفقة"),
          boxStyle: "min-width:180px;min-height:132px;max-width:224px;max-height:176px",
          imgStyle: "display:block;width:auto;height:auto;max-width:224px;max-height:176px;object-fit:contain"
        })}</a>`;
      }
      return `<a href="${escapeForAttribute(attachment.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;width:max-content;max-width:100%;height:auto;max-height:176px;line-height:0" class="mt-2 rounded-xl overflow-hidden border border-white/10 bg-black/20"><img src="${escapeForAttribute(attachment.url)}" loading="lazy" style="display:block;width:auto;height:auto;max-width:224px;max-height:176px;object-fit:contain" alt="${window.__fb('js.att_attached', 'صورة مرفقة')}"></a>`;
    }
    const viewer = Object.values(attachment.viewedBy || {})[0];
    if (viewer && f) return `<div class="mt-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-400/20 rounded-xl px-3 py-2 inline-flex items-center gap-2">${window.__f("js.opened_by", {name: escapeForAttribute(viewer.name || window.__fb('app_chat.default_sender', 'مستخدم'))}, `👁 فتحها ${escapeForAttribute(viewer.name || 'مستخدم')}`)}</div>`;
    if (f) return `<div class="mt-2 text-[11px] text-gray-500 bg-white/5 border border-white/10 rounded-xl px-3 py-2 inline-flex items-center gap-2">window.__fb("js.once_waiting", "🔒 صورة تُفتح مرة واحدة · بانتظار الفتح")</div>`;
    if (viewer) return `<div class="mt-2 text-[11px] text-gray-500 bg-white/5 border border-white/10 rounded-xl px-3 py-2 inline-flex items-center gap-2">window.__fb("js.once_opened", "🔒 تم فتح الصورة مرة واحدة")</div>`;
    return `<button type="button" class="one-time-image-card mt-2 w-56 max-w-full min-h-24 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-4 text-right hover:bg-amber-500/20 transition" data-action="openOneTimeImage" data-message-id="${escapeForAttribute(u)}" data-attachment-index="${index}" data-context="${escapeForAttribute(g)}" data-image-url="${escapeForAttribute(attachment.url)}"><span class="block text-amber-300 font-bold text-sm">${window.__fb("js.once_card_t", "🔒 صورة تُفتح مرة واحدة")}</span><span class="block text-[11px] text-amber-200/70 mt-1">${window.__fb("js.once_card_d", "اضغط لعرض الصورة — لن تتمكن من فتحها مجددًا")}</span></button>`;
  }).join('') : '';
  return `
        <div data-message-id="${escapeForAttribute(u)}" data-sender-uid="${escapeForAttribute(o)}" data-context="${escapeForAttribute(g)}" data-attachments="${escapeForAttribute(JSON.stringify(i.attachments || []))}" class="flex gap-3 hover:bg-white/[0.02] px-4 py-0.5 w-full transition items-start message-row">
            ${avatarWithProfile}
            <div class="flex flex-col min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-0">
                    <span class="sender-name text-[13px] font-bold${"voice"!==g?" cursor-pointer hover:underline":""}" style="${M}" data-action="showMemberProfile" data-uid="${escapeForAttribute(o)}">
                        ${escapeForAttribute(x)}
                    </span>
                    <span class="text-[9px] text-gray-500 font-medium">${escapeForAttribute(v)}</span>
                    ${pendingHTML}
                    ${sentHTML}
                </div>
                <div class="message-content text-[13px] text-gray-200 leading-normal whitespace-pre-wrap break-words inline-block">${forwardedHTML}${replyHTML}${L}${attachmentsHTML}${pollHTML}${editedHTML}</div>
                ${window.generateRichPreviews?window.generateRichPreviews(l||""):""}
                ${reactionsHTML}
            </div>
        </div>
        <div class="message-actions-toolbar">
            ${createActionButton(window.__fb("js.react", "تعامل"), "showEmojiPicker", u, g)}
            ${createActionButton(window.__fb("app_chat.ctx_reply", "رد"), "handleMessageToolbarAction", u, 'reply', g)}
            ${createActionButton(window.__fb("app_chat.ctx_forward", "توجيه"), "handleMessageToolbarAction", u, 'forward', g)}
            ${createActionButton(window.__fb("js.more", "المزيد"), "showMessageContextMenu", u, o, g)}
        </div>
    `
}

function setupMessageEventDelegation(container) {
  if (container._delegationSetup) return;
  container._delegationSetup = true;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.stopPropagation();

    const action = btn.dataset.action;
    const argsStr = btn.dataset.args || '';
    const args = argsStr ? argsStr.split('|') : [];

    switch (action) {
      case 'showMemberProfile': {
        const uid = btn.dataset.uid;
        if (uid && typeof window.showMemberProfile === 'function') {
          window.showMemberProfile(e, uid);
        }
        break;
      }
      case 'toggleReaction': {
        if (typeof window.toggleReaction === 'function' && args.length >= 3) {
          window.toggleReaction(args[0], args[1], args[2]);
        }
        break;
      }
      case 'showEmojiPicker': {
        if (typeof window.showEmojiPicker === 'function' && args.length >= 2) {
          window.showEmojiPicker(e, args[0], args[1]);
        }
        break;
      }
      case 'handleMessageToolbarAction': {
        if (typeof window.handleMessageToolbarAction === 'function' && args.length >= 3) {
          window.handleMessageToolbarAction(e, args[0], args[1], args[2]);
        }
        break;
      }
      case 'showMessageContextMenu': {
        if (typeof window.showMessageContextMenu === 'function' && args.length >= 3) {
          window.showMessageContextMenu(e, args[0], args[1], args[2]);
        }
        break;
      }
      case 'openOneTimeImage': {
        window.openOneTimeImage?.(btn.dataset.messageId, Number(btn.dataset.attachmentIndex), btn.dataset.context, btn.dataset.imageUrl);
        break;
      }
      case 'votePoll': {
        if (typeof window.votePoll === 'function' && args.length >= 3) {
          window.votePoll(args[0], Number(args[1]), args[2]);
        }
        break;
      }
      case 'showPollVoters': {
        if (typeof window.showPollVoters === 'function' && args.length >= 2) {
          window.showPollVoters(args[0], args[1]);
        }
        break;
      }
    }
  });

  container.addEventListener('click', (e) => {
    const replyEl = e.target.closest('.message-reply');
    if (!replyEl) return;
    const msgId = replyEl.dataset.msgId;
    if (msgId) {
      const target = document.querySelector(`[data-message-id='${CSS.escape(msgId)}']`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

export class ChatBox {
  constructor(e, t = {}) {
    this.container = document.getElementById(e), this.container && (this.options = Object.assign({
      context: "server",
      infiniteScroll: !0,
      loadMoreIncrement: 20,
      initialLimit: 50,
      createMessageElement: null
    }, t), this._limit = this.options.initialLimit, this._isLoadingMore = !1, this._scrollTop = 0, this._scrollHeight = 0, this._clientHeight = 0, this._hasInfiniteScroll = !1, this._currentSnap = null, window.attachScrollAnchoring && window.attachScrollAnchoring(this.container))
    if (this.container) {
      setupMessageEventDelegation(this.container);
    }
  }
  parseSnapshot(e, t) {
    const i = this.container;
    if (!i) return null;
    const n = !this._isLoadingMore && ("" === i.innerHTML || i.querySelector(".text-center.text-xs") || i.querySelector(".animate-spin"));
    if (this._currentSnap = e, n && (i.innerHTML = ""), e.empty) return i.innerHTML = '<div class="text-center text-xs text-gray-500 py-4">' + window.__fb("js.no_msgs", "لا توجد رسائل بعد") + '</div>', null;
    const o = {
      prependItems: [],
      appendItems: [],
      processedRows: [],
      prependTarget: null,
      isInitial: n
    };
    if (typeof e.docChanges !== 'function') {
      console.warn("e.docChanges is not a function. e is:", e);
      return null;
    }
    return e.docChanges().forEach(e => {
      if ("added" === e.type) {
        const existing = i.querySelector(`[data-message-id="${e.doc.id}"]`);
        if (existing) {

          try {
            const d = e.doc.data({ serverTimestamps: "estimate" }) || {};
            const serverPending = !!e.doc.metadata.hasPendingWrites;
            const rowPending = existing.getAttribute("data-pending") === "true";
            const serverPoll = JSON.stringify(d.poll || null);
            const rowPoll = existing.getAttribute("data-poll") || "null";
            const serverText = d.text || "";
            const rowText = existing.getAttribute("data-raw-text") || "";
            if (rowPending !== serverPending || rowPoll !== serverPoll || rowText !== serverText) {
              const fresh = t ? t(e.doc) : null;
              fresh && (existing.replaceWith(fresh), window.processPostRenderLinks && window.processPostRenderLinks(fresh));
            }
          } catch (_) {}
          return;
        }
        const s = t ? t(e.doc) : null;
        if (!s) return;
        n || this._isLoadingMore || s.classList.add("animate-view"), (this._isLoadingMore || 0 === e.newIndex) && i.firstChild ? (o.prependItems.push(s), o.prependTarget = o.prependTarget || i.firstChild) : o.appendItems.push(s), o.processedRows.push(s)
      } else if ("modified" === e.type) {
        const n = i.querySelector(`[data-message-id="${e.doc.id}"]`);
        if (!n) return;
        const o = e.doc.data({
          serverTimestamps: "estimate"
          }),
          s = n.getAttribute("data-raw-text"),
          r = o.edited || !1,
          a = n.querySelector(".message-content")?.innerHTML.includes("(\u0645\u0639\u062f\u0644\u0629)"),
          l = "true" === n.getAttribute("data-pending"),
          reactions = JSON.stringify(o.reactions || {}),
          attachments = JSON.stringify(o.attachments || []),
          poll = JSON.stringify(o.poll || null),
          oldPoll = n.getAttribute("data-poll") || "null",
          messageGroup = n.closest(".group") || n,
          oldReactions = messageGroup.getAttribute("data-reactions") || "{}";
        const contentChanged = s !== o.text || r !== a;
        const reactionsChanged = reactions !== oldReactions;
        const attachmentsChanged = n.getAttribute("data-attachments") !== attachments;
        const pollChanged = poll !== oldPoll;
        const pendingChanged = l !== e.doc.metadata.hasPendingWrites;
        if (contentChanged || pendingChanged || reactionsChanged || attachmentsChanged || pollChanged) {
          messageGroup.setAttribute("data-reactions", reactions);
          n.setAttribute("data-poll", poll);

          const onlyReactionsChanged = !contentChanged && !pollChanged && reactionsChanged;
          if (onlyReactionsChanged) {
            updateReactionRow(n, renderReactionsHTML(o.reactions, this.options.myUid || window.currentUserProfile?.uid || window.myUid || "", e.doc.id, this.options.context));
          } else {
            const i = t ? t(e.doc) : null;
            i && (n.replaceWith(i), window.processPostRenderLinks && window.processPostRenderLinks(i))
          }
        }
      } else if ("removed" === e.type) {
        const t = i.querySelector(`[data-message-id="${e.doc.id}"]`);
        t && t.remove()
      }
    }), o
  }
  applyRender(e) {
    const t = this.container;
    if (!t || !e) return;
    const {
      prependItems: i,
      appendItems: n,
      processedRows: o,
      prependTarget: s,
      isInitial: r
    } = e;
    let a = 0,
      l = 0,
      c = 0;
    r || (a = this._scrollHeight || t.scrollHeight, l = void 0 !== this._scrollTop ? this._scrollTop : t.scrollTop, c = this._clientHeight || t.clientHeight);
    const d = document.createDocumentFragment();
    i.forEach(e => d.appendChild(e)), d.childNodes.length > 0 && t.insertBefore(d, s);
    const p = document.createDocumentFragment();
    if (n.forEach(e => p.appendChild(e)), p.childNodes.length > 0 && t.appendChild(p), o.forEach(e => {
        window.processPostRenderLinks && window.processPostRenderLinks(e)
      }), "" !== t.innerHTML) {
      if (this._isLoadingMore) {
        const e = l + (t.scrollHeight - a);
        t.scrollTop = e;
        requestAnimationFrame(() => {
          const n = l + (t.scrollHeight - a);
          t.scrollTop = n, this._isLoadingMore = !1, window.__isLoadingMore = !1, this._scrollTop = n, this._scrollHeight = t.scrollHeight
        })
      } else if (l + c >= a - 100 || 0 === a || r) {
        const e = t.scrollHeight;
        t.scrollTop = e, this._scrollTop = e, this._scrollHeight = e
      }
      this.options.infiniteScroll && !this._hasInfiniteScroll && (this._hasInfiniteScroll = !0, t.addEventListener("scroll", () => {
        this._scrollTop = t.scrollTop, this._scrollHeight = t.scrollHeight, this._clientHeight = t.clientHeight, t.scrollTop <= 5 && !this._isLoadingMore && this._currentSnap && this._currentSnap.size >= this._limit && (this._isLoadingMore = !0, window.__isLoadingMore = !0, this._limit += this.options.loadMoreIncrement, this.options.onLoadMore && this.options.onLoadMore(this._limit))
      }, {
        passive: !0
      }))
    } else t.innerHTML = '<div class="text-center text-xs text-gray-500 py-4">' + window.__fb("js.no_msgs", "لا توجد رسائل بعد") + '</div>'
  }
  showLoading(e = "border-blue-500") {
    this._isLoadingMore || (this.container.innerHTML = `<div class="flex items-center justify-center h-full"><div class="animate-spin rounded-full h-8 w-8 border-b-2 ${e}"></div></div>`)
  }
  reset(e = this.options.initialLimit) {
    this._limit = e, this._isLoadingMore = !1, window.__isLoadingMore = !1, this._scrollTop = 0, this._scrollHeight = 0, this._clientHeight = 0, this._currentSnap = null
  }
  get limit() {
    return this._limit
  }
  get isLoadingMore() {
    return this._isLoadingMore
  }
  destroy() {
    this.reset(), this._hasInfiniteScroll = !1
  }
}
