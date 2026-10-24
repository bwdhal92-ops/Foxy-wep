const isTouchDevice = () => window.foxyIsTouch ? window.foxyIsTouch() : window.matchMedia("(pointer: coarse)").matches;
let fsInactivityTimeout, normalTopBarVisible = !1;

function getTopBar() {
  return document.getElementById("screen-top-bar")
}

function setNormalTopBarVisible(e) {
  const t = getTopBar();
  t && (normalTopBarVisible = e, e ? (t.classList.remove("opacity-0", "pointer-events-none"), t.classList.add("opacity-100", "pointer-events-auto")) : (t.classList.add("opacity-0", "pointer-events-none"), t.classList.remove("opacity-100", "pointer-events-auto")))
}

function updateSliderTrack(e) {
  if (!e) return;
  const t = e.min || 0,
    n = e.max || 100,
    o = (e.value - t) / (n - t) * 100;
  e.style.background = `linear-gradient(to left, #3b82f6 ${o}%, #1e293b ${o}%)`
}
{
  const bitrateSlider = document.getElementById("bitrate-slider");
  const bitrateVal = document.getElementById("bitrate-val");
  if (bitrateSlider) {
    bitrateSlider.oninput = function() {
      window.selectedBitrate = parseInt(this.value), (bitrateVal ? bitrateVal.innerText = `${window.selectedBitrate} kbps` : null), updateSliderTrack(this), "function" == typeof window.updateAllCallBitrates && window.updateAllCallBitrates()
    };
    bitrateSlider.value = window.selectedBitrate || 48;
    updateSliderTrack(bitrateSlider);
  }
  if (bitrateVal) {
    bitrateVal.innerText = `${window.selectedBitrate||48} kbps`;
  }
}
 window.showRenameModal = function() {
  const e = document.getElementById("rename-modal"),
    t = document.getElementById("new-name-input");
  e && t && (t.value = myName, e.classList.remove("hidden"), e.classList.add("flex"), t.focus())
}, window.closeRenameModal = function() {
  document.getElementById("rename-modal")?.classList.add("hidden")
}, window.showApprovalToast = function(e, t) {
  const n = document.getElementById("approval-toast"),
    o = document.getElementById("approval-name");
  n && o && (o.innerText = window.__f("js.wants_join", {name: t}, `${t} يريد الانضمام...`), n.classList.remove("hidden"), document.getElementById("approve-btn").onclick = () => {
    n.classList.add("hidden"), "function" == typeof processApprovedJoin && processApprovedJoin(e)
  }, (function () {
    var _rb = document.getElementById("reject-btn");

    if (_rb) _rb.onclick = () => {
      n.classList.add("hidden"), "function" == typeof processRejectedJoin && processRejectedJoin(e)
    };
  })())
}, window.updateSignalingStatus = function(e) {
  const t = document.getElementById("signaling-status");
  if (!t) return;
  t.classList.remove("hidden");
  const n = {
      online: {
        text: window.__fb("js.st_online", "متصل"),
        class: "bg-emerald-500/10 text-emerald-500"
      },
      reconnecting: {
        text: window.__fb("js.st_connecting", "جاري الاتصال..."),
        class: "bg-amber-500/10 text-amber-500"
      },
      error: {
        text: window.__fb("js.st_error", "خطأ خادم"),
        class: "bg-red-500/10 text-red-500"
      }
    },
    o = n[e] || n.online;
  t.innerText = o.text, t.className = `text-[9px] px-2 py-0.5 rounded-full font-bold ${o.class}`
  "function" == typeof window.setVoicePanelState && window.setVoicePanelState({online:"online",reconnecting:"connecting",error:"error"}[e] || "online")
}, window.setVoicePanelState = function(state, force) {

  try {
    var dot = document.getElementById("voice-status-dot"),
      lbl = document.getElementById("voice-status-label");
    if (!dot || !lbl) return;
    var ind = document.getElementById("active-room-indicator");

    if (ind && ind.classList.contains("hidden")) state = "idle";
    var conf = {
      online: { txt: window.__fb("js.st_online", "متصل صوتياً"), dot: "w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]", text: "text-[13px] font-bold text-emerald-500 tracking-tight leading-none uppercase" },
      connecting: { txt: window.__fb("js.st_connecting", "جاري الاتصال..."), dot: "w-2 h-2 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]", text: "text-[13px] font-bold text-amber-500 tracking-tight leading-none uppercase" },
      offline: { txt: window.__fb("js.voice_offline", "لا يوجد اتصال نت"), dot: "w-2 h-2 bg-red-500 rounded-full", text: "text-[13px] font-bold text-red-500 tracking-tight leading-none uppercase" },
      error: { txt: window.__fb("js.voice_lost", "انقطع الاتصال"), dot: "w-2 h-2 bg-red-500 rounded-full", text: "text-[13px] font-bold text-red-500 tracking-tight leading-none uppercase" },
      idle: { txt: window.__fb("js.voice_idle", "غير متصل"), dot: "w-2 h-2 bg-gray-500 rounded-full", text: "text-[13px] font-bold text-gray-500 tracking-tight leading-none uppercase" }
    }[state];
    if (!conf) return;
    if (!force && window.__voicePanelState === state) return;
    window.__voicePanelState = state;
    dot.className = conf.dot;
    lbl.className = conf.text;
    lbl.textContent = conf.txt;
  } catch (_) {}
}, window.setVoicePanelRoomLabel = function() {

  try {
    var el = document.getElementById("active-room-id-display");
    if (!el) return;
    var st = window.state || {}, txt;
    if (st.activeVoiceServerId && st.activeVoiceChannelName) {
      txt = "#" + st.activeVoiceServerId + " • " + st.activeVoiceChannelName;
    } else if (window.__voiceManualRoomId) {
      txt = window.__fb("js.voice_room_of", "غرفة") + " " + window.__voiceManualRoomId;
    } else if (st.activeVoiceRoomCode) {
      txt = window.__fb("js.voice_room_code", "كود الغرفة") + " " + st.activeVoiceRoomCode;
    } else {
      txt = "—";
    }
    if (el.textContent !== txt) el.textContent = txt;
  } catch (_) {}
}, window.syncVoicePanelStatus = function() {

  try {
    if ("undefined" != typeof navigator && navigator.onLine === false) return window.setVoicePanelState("offline", true);
    var p = window.peer;
    if (!p) return window.setVoicePanelState("idle", true);
    if (p.destroyed) return window.setVoicePanelState("error", true);
    if (p.disconnected) return window.setVoicePanelState("connecting", true);
    if (!window.myId) return window.setVoicePanelState("connecting", true);
    var ind = document.getElementById("active-room-indicator");
    return window.setVoicePanelState(ind && ind.classList.contains("hidden") ? "idle" : "online", true);
  } catch (_) {}
}; (function() {
  try {
    if (window.__voicePanelTimer) return;
    window.__voicePanelTimer = setInterval(function() {
      window.syncVoicePanelStatus && window.syncVoicePanelStatus();
    }, 4000);
    window.__voicePanelTimer.unref && window.__voicePanelTimer.unref();
  } catch (_) {}
  try {
    window.addEventListener("online", function() { window.syncVoicePanelStatus && window.syncVoicePanelStatus(); });
    window.addEventListener("offline", function() { window.syncVoicePanelStatus && window.syncVoicePanelStatus(); });
  } catch (_) {}
})();
window.showFoxyToast = function(o) {
  try {
    o = o || {};
    const tone = o.tone || "info";
    const conf = {
      info: { ring: "border-blue-500/30", bg: "bg-blue-500/15", tx: "text-blue-400", icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' },
      success: { ring: "border-emerald-500/30", bg: "bg-emerald-500/15", tx: "text-emerald-400", icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>' },
      warn: { ring: "border-amber-500/30", bg: "bg-amber-500/15", tx: "text-amber-400", icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>' },
      error: { ring: "border-red-500/30", bg: "bg-red-500/15", tx: "text-red-400", icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>' },
      mic: { ring: "border-red-500/30", bg: "bg-red-500/15", tx: "text-red-400", icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/>' }
    }[tone] || null;
    const c = conf || { ring: "border-blue-500/30", bg: "bg-blue-500/15", tx: "text-blue-400", icon: "" };
    let stack = document.getElementById("foxy-toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "foxy-toast-stack";
      stack.className = "fixed bottom-6 right-6 z-[300] flex flex-col gap-2 items-end pointer-events-none";
      document.body.appendChild(stack);
    }
    if (o.id) {
      const dup = document.getElementById("foxy-toast-" + o.id);
      if (dup) { dup.remove(); }
    }
    const el = document.createElement("div");
    if (o.id) el.id = "foxy-toast-" + o.id;
    el.className = `pointer-events-auto w-[320px] max-w-[calc(100vw-3rem)] bg-[#18191c]/95 backdrop-blur-xl border ${c.ring} rounded-2xl shadow-2xl p-3 flex items-start gap-3 transition-all duration-300`;
    el.style.animation = "foxyToastIn .3s ease";
    el.innerHTML = `<div class="w-9 h-9 rounded-xl ${c.bg} ${c.tx} flex items-center justify-center shrink-0"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">${c.icon}</svg></div><div class="flex-1 min-w-0"><p class="text-[13px] font-black text-white leading-snug"></p><p class="text-[11px] text-gray-400 leading-relaxed mt-0.5"></p><div class="toast-actions flex gap-2 mt-2"></div></div><button class="toast-close text-gray-500 hover:text-white transition shrink-0 -mt-0.5" aria-label="إغلاق"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>`;
    el.querySelector("p").textContent = o.title || "";
    el.querySelectorAll("p")[1].textContent = o.body || "";
    const actBox = el.querySelector(".toast-actions");
    if (o.action && o.action.label) {
      const b = document.createElement("button");
      b.className = "px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition";
      b.textContent = o.action.label;
      b.onclick = (ev) => { ev.stopPropagation(); try { o.action.onClick && o.action.onClick(); } catch (_) {} el.remove(); };
      actBox.appendChild(b);
    } else actBox.remove();
    if (!o.title) el.querySelector("p").remove();
    if (!o.body) el.querySelectorAll("p")[o.title ? 0 : 1]?.remove();
    el.querySelector(".toast-close").onclick = (ev) => { ev.stopPropagation(); el.remove(); };
    stack.appendChild(el);
    while (stack.children.length > 4) stack.firstChild.remove();
    const ms = (o.duration === 0) ? 0 : (o.duration || 5000);
    if (ms > 0) setTimeout(() => { try { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 320); } catch (_) {} }, ms);
    return el;
  } catch (_) { return null; }
}, window.showMutedTalkToast = function() {
  window.showFoxyToast({
    id: "muted-talk",
    tone: "mic",
    title: window.__fb("js.muted_talk_t", "🎤 الميك مقفول وانت بتتكلم!"),
    body: window.__fb("js.muted_talk_d", "محدش سامعك — دوس على الزرار لفتح الميك."),
    duration: 6000,
    action: {
      label: window.__fb("js.unmute_now", "فتح الميك"),
      onClick: () => { "function" == typeof window.toggleMute && window.toggleMute(false); }
    }
  });
}, window.setNetBanner = function(state) {
  try {
    let b = document.getElementById("net-status-banner");
    if (!b) {
      b = document.createElement("div");
      b.id = "net-status-banner";
      b.className = "fixed top-4 left-1/2 -translate-x-1/2 z-[300] hidden";
      document.body.appendChild(b);
    }
    if (!state || state === "hide") { b.classList.add("hidden"); b.innerHTML = ""; return; }
    const conf = {
      offline: { cls: "border-red-500/40 bg-red-950/90 text-red-300", dot: "bg-red-500 animate-ping", txt: window.__fb("js.net_banner_off", "📡 انقطع الإنترنت عندك — بانتظار العودة...") },
      reconnecting: { cls: "border-amber-500/40 bg-amber-950/90 text-amber-300", dot: "bg-amber-400 animate-pulse", txt: window.__fb("js.net_banner_retry", "🔄 جاري استعادة الاتصال بدون فصل...") },
      online: { cls: "border-emerald-500/40 bg-emerald-950/90 text-emerald-300", dot: "bg-emerald-400", txt: window.__fb("js.net_banner_ok", "✅ تمت استعادة الاتصال") }
    }[state];
    if (!conf) { b.classList.add("hidden"); return; }
    b.classList.remove("hidden");
    b.innerHTML = `<div class="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border ${conf.cls} backdrop-blur-xl shadow-2xl text-[12px] font-black"><span class="relative flex w-2.5 h-2.5"><span class="absolute inline-flex w-full h-full rounded-full opacity-60 ${conf.dot}"></span><span class="relative inline-flex w-2.5 h-2.5 rounded-full bg-current"></span></span><span></span></div>`;
    b.querySelector("span:last-child").textContent = conf.txt;
    if (state === "online") setTimeout(() => { "function" == typeof window.setNetBanner && window.setNetBanner("hide"); }, 3500);
  } catch (_) {}
}, window.isWatchingScreenSource = function(key) {
  try {
    const src = window.currentScreenSource;
    if (!src || !key) return false;
    if (src === key) return true;
    const uidOf = (k) => (window.peerIdToUidMap && window.peerIdToUidMap[k]) || (window.connections && window.connections[k] && window.connections[k].uid) || k;
    return uidOf(src) === uidOf(key);
  } catch (_) { return false; }
}, window.updateParticipantScreenStatus = function(e, t, n) {
  let o = document.getElementById(`screen-btn-container-${e}`);
  if (!o && window.peerIdToUidMap && window.peerIdToUidMap[e]) {
    const t = window.peerIdToUidMap[e];
    o = document.getElementById(`screen-btn-container-${t}`)
  }
  o && (t ? "me" === e || e === window.myId ? o.innerHTML = '\n                <div class="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 text-red-500 rounded-md border border-red-500/30 animate-pulse">\n                    <span class="w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>\n                    <span class="text-[10px] font-black tracking-tighter uppercase">LIVE</span>\n                </div>\n            ' : o.innerHTML = ("function" == typeof window.isWatchingScreenSource && window.isWatchingScreenSource(e) ? `\n                <button onclick="window.closeScreenView()" \n                    class="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg border border-red-500/20 hover:border-red-500 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-red-500/10">\n                    <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background:currentColor"></span>\n                    <span class="text-[11px] font-bold tracking-wide">${window.__fb("js.stop_btn", "إيقاف")}</span>\n                </button>` : `\n                <button onclick="window.joinScreenShare('${e}', '${n}')" \n                    class="group/screen flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg border border-emerald-500/20 hover:border-emerald-500 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/10">\n                    <svg class="w-3.5 h-3.5 group-hover/screen:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />\n                    </svg>\n                    <span class="text-[11px] font-bold tracking-wide">${window.__fb("js.watch", "مشاهدة")}</span>\n                </button>\n            `) : o.innerHTML = "")
  window.updateParticipantMediaPreview?.(e)
}, window.updateScreenViewerUI = function() {
  const e = window.getScreenViewersList ? window.getScreenViewersList() : [],
    t = e.length,
    n = document.getElementById("screen-viewer-count");
  if (n && (n.innerText = `${t}`, t > 0 ? (n.className = "text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/30 transition-all font-bold animate-pulse", n.title = window.__fb("js.viewer_list", "اضغط لمشاهدة قائمة المشاهدين")) : (n.className = "text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/20 cursor-pointer hover:bg-blue-500/30 transition-all font-bold", n.title = window.__fb("js.no_viewers", "لا يوجد أحد يشاهد حالياً"))), "function" == typeof window.toggleParticipantWatchingMe) {
    const t = window.connections || {};
    Object.keys(t).forEach(e => window.toggleParticipantWatchingMe(e, !1)), e.forEach(e => {
      e.uid && e.uid !== window.myId && window.toggleParticipantWatchingMe(e.uid, !0)
    })
  }
}, window.showScreenViewersModal = function() {
  const e = window.getScreenViewersList ? window.getScreenViewersList() : [],
    t = document.getElementById("screen-viewers-modal");
  t && t.remove();
  const n = document.createElement("div");
  n.id = "screen-viewers-modal", n.className = "fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in";
  let o = "";
  if (0 === e.length) o = '\n            <div class="flex flex-col items-center justify-center py-8 text-gray-400 text-center">\n                <svg class="w-12 h-12 mb-3 text-gray-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />\n                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />\n                </svg>\n                <p class="text-sm font-bold text-gray-300">' + window.__fb("js.no_viewers_now", "لا يوجد أحد يشاهد شاشتك حالياً") + '</p>\n                <p class="text-xs text-gray-500 mt-1">' + window.__fb("js.no_viewers_hint", "عندما ينضم أي شخص لمشاهدة البث سيظهر هنا.") + '</p>\n            </div>\n        ';
  else {
    const t = window.connections || {};
    e.forEach(e => {
      let n = "";
      e.uid && t[e.uid] && t[e.uid].photoURL ? n = t[e.uid].photoURL : e.uid === window.myId && "undefined" != typeof auth && auth.currentUser?.photoURL && (n = auth.currentUser.photoURL);
      const s = window.createAvatarHTML(n, e.name, {
        size: 10,
        shape: "circle",
        identity: e.uid || e.name,

        color: (e.uid === window.myId
          ? (window.currentUserProfile?.avatarColor || window.currentUserProfile?.bannerColor || "")
          : (window.state?.serverMembersData?.[e.uid]?.avatarColor || window.state?.serverMembersData?.[e.uid]?.bannerColor || "")),
        border: "border border-blue-500/30",
        extra: "bg-blue-600/30 text-blue-400 text-sm"
      });
      o += `\n                <div class="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all">\n                    ${s}\n                    <div class="flex-1 min-w-0 text-right">\n                        <p class="text-sm font-bold text-gray-100 truncate">${e.name}</p>\n                        <p class="text-[10px] text-gray-400 mt-0.5">${e.uid===window.myId?window.__fb("js.you_short", "أنت"):window.__fb("js.viewer_connected", "مشاهد متصل")}</p>\n                    </div>\n                    <div class="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20 text-[10px] font-black uppercase">\n                        <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>\n                        ${window.__fb("js.active_badge", "نشط")}\n                    </div>\n                </div>\n            `
    })
  }
  n.innerHTML = `\n        <div class="w-full max-w-md mx-4 bg-[#18191c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden transform scale-95 transition-all duration-300">\n            \x3c!-- Modal Header --\x3e\n            <div class="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-black/20">\n                <div class="flex items-center gap-2">\n                    <div class="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center ml-2">\n                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />\n                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />\n                        </svg>\n                    </div>\n                    <h3 class="text-sm font-black text-gray-100">${window.__f("js.current_viewers", {n: e.length}, `المشاهدون الحاليون (${e.length})`)}</h3>\n                </div>\n                <button onclick="document.getElementById('screen-viewers-modal').remove()" class="text-gray-400 hover:text-white transition-colors">\n                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />\n                    </svg>\n                </button>\n            </div>\n            \n            \x3c!-- Modal Content --\x3e\n            <div class="p-5 max-h-[350px] overflow-y-auto space-y-2 custom-scrollbar">\n                ${o}\n            </div>\n            \n            \x3c!-- Modal Footer --\x3e\n            <div class="px-5 py-4 border-t border-white/5 bg-black/10 flex justify-end">\n                <button onclick="document.getElementById('screen-viewers-modal').remove()" \n                    class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95">\n                    إغلاق\n                </button>\n            </div>\n        </div>\n    `, document.body.appendChild(n), n.addEventListener("click", e => {
    e.target === n && n.remove()
  })
}, window.updateScreenQualityIndicator = function(e, t) {
  const n = document.getElementById("screen-quality-indicator");
  if (!n) return;
  n.classList.remove("hidden");
  const o = {
      good: {
        text: window.__fb("js.q_best", "ممتاز"),
        class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      },
      fair: {
        text: window.__fb("js.q_avg", "متوسط"),
        class: "bg-amber-500/10 text-amber-400 border-amber-500/20"
      },
      poor: {
        text: window.__fb("js.q_weak", "ضعيف"),
        class: "bg-red-500/10 text-red-400 border-red-500/20"
      }
    },
    s = o[e] || o.good;
  n.innerText = `${s.text} (${t} kbps)`, n.className = `text-[9px] px-1.5 py-0.5 rounded-full border ${s.class} transition-all duration-300`
}, window.showScreenViewUI = function(e) {
  console.info("[Foxy][screen-ui] تحديث واجهة المشاهدة", {show:!!e, caller:(new Error().stack || "").split("\n")[2]?.trim(), timestamp:new Date().toISOString()});
  if (!e) {
    const e = document.getElementById("screen-quality-indicator");
    e && e.classList.add("hidden")
  }
  const t = document.getElementById("screen-overlay"),
    n = document.getElementById("participants-list");

  if (e && t && n && t.parentElement !== n && document.fullscreenElement !== t) n.prepend(t);
  if (t && (window.foxyLayout && "mobile" === window.foxyLayout() ? (t.classList.toggle("screen-visible", e), t.classList.remove("hidden")) : e ? (t.style.display = "flex", t.classList.remove("hidden")) : (t.style.display = "", t.classList.add("hidden"))), n && n.classList.toggle("has-active-screen", e), e && "function" == typeof window.sortParticipantsUI && window.sortParticipantsUI(), t && isTouchDevice())
    if (e) t.addEventListener("touchend", handleNormalScreenTap);
    else {
      t.removeEventListener("touchend", handleNormalScreenTap);
      const e = document.getElementById("screen-top-bar");
      e && (e.classList.add("opacity-0", "pointer-events-none"), e.classList.remove("opacity-100", "pointer-events-auto"))
    }
  else if (t)
    if (e) t.addEventListener("mouseenter", () => setNormalTopBarVisible(!0)), t.addEventListener("mouseleave", () => setNormalTopBarVisible(!1)), t.addEventListener("click", e => {
      e.target.closest("button") || setNormalTopBarVisible(!normalTopBarVisible)
    });
    else {
      const e = document.getElementById("screen-top-bar");
      e && (e.classList.add("opacity-0", "pointer-events-none"), e.classList.remove("opacity-100", "pointer-events-auto"))
    }
  if (e && t) requestAnimationFrame(() => {
    if (!document.getElementById("screen-overlay")) return;
    t.classList.remove("hidden");
    t.style.display = "flex";
    n && n.classList.add("has-active-screen");
  });
  window.refreshParticipantMediaPreviews?.(), syncScreenOverlayVideoState()
}, window.toggleFullScreen = function() {
  const e = document.getElementById("screen-overlay");
  document.fullscreenElement ? document.exitFullscreen() : e.requestFullscreen().catch(e => {})
};
let fsControlsVisible = !1;

function setFullscreenControlsVisible(e) {
  const t = document.getElementById("fullscreen-controls"),
    n = getTopBar();
  fsControlsVisible = e, e ? (t && (t.classList.remove("opacity-0", "pointer-events-none", "translate-y-4"), t.classList.add("opacity-100", "pointer-events-auto", "translate-y-0")), n && (n.classList.remove("opacity-0", "pointer-events-none"), n.classList.add("opacity-100", "pointer-events-auto"))) : (t && (t.classList.add("opacity-0", "pointer-events-none", "translate-y-4"), t.classList.remove("opacity-100", "pointer-events-auto", "translate-y-0")), n && (n.classList.add("opacity-0", "pointer-events-none"), n.classList.remove("opacity-100", "pointer-events-auto")))
}

function handleNormalScreenTap(e) {
  document.fullscreenElement || e.target.closest("button") || setNormalTopBarVisible(!normalTopBarVisible)
}

function showFullscreenControls() {
  const e = document.getElementById("fullscreen-controls"),
    t = getTopBar();
  e && (setFullscreenControlsVisible(!0), isTouchDevice() || (clearTimeout(fsInactivityTimeout), fsInactivityTimeout = setTimeout(() => {
    e.matches(":hover") || t && t.matches(":hover") || setFullscreenControlsVisible(!1)
  }, 3e3)))
}

function hideFullscreenControls() {
  document.fullscreenElement && setFullscreenControlsVisible(!1)
}

function handleFullscreenTap(e) {
  e.target.closest("button") || e.target.closest("#fullscreen-controls") || e.target.closest("#screen-top-bar") || setFullscreenControlsVisible(!fsControlsVisible)
}

/* مزامنة حالة الفيديو جوه الـ overlay: لو مفيش بث شغّال الـ overlay ماياخدش مساحة */
function syncScreenOverlayVideoState() {
  const t = document.getElementById("screen-overlay"),
    n = document.getElementById("screen-video");
  if (!t || !n) return;
  const active = !!n.srcObject && n.readyState >= 2;
  t.classList.toggle("has-video", active);
}
window.syncScreenOverlayVideoState = syncScreenOverlayVideoState;

document.addEventListener("DOMContentLoaded", () => {
  const n = document.getElementById("screen-video");
  if (!n) return;
  ["loadeddata", "playing", "pause", "emptied", "stalled"].forEach(ev => n.addEventListener(ev, syncScreenOverlayVideoState));
  syncScreenOverlayVideoState();
});

function showCameraInOverlay(e, t) {
  window.showScreenViewUI(!0);
  const n = document.getElementById("screen-video"),
    o = document.getElementById("screen-loading"),
    s = document.getElementById("screen-title");
  if (o && o.classList.add("hidden"), s) {
    const e = window.uidToPeerIdMap?.[t] || t,
      n = window.connections && window.connections[e]?.name || window.__fb("js.participant", "المشارك");
    s.textContent = window.__fb("js.cam_stream", "بث الكاميرا: ") + n
  }
  n && (n.srcObject = e, n.isConnected && n.play().catch(e => {
    e.name
  })), window.currentScreenSource = t, window.refreshParticipantMediaPreviews?.(), syncScreenOverlayVideoState()
}
document.addEventListener("fullscreenchange", () => {
  const e = document.getElementById("screen-overlay"),
    t = document.getElementById("fullscreen-controls"),
    n = getTopBar();
  document.fullscreenElement === e ? (e.removeEventListener("touchend", handleNormalScreenTap), isTouchDevice() ? (e.addEventListener("touchend", handleFullscreenTap), setFullscreenControlsVisible(!1)) : (e.addEventListener("mousemove", showFullscreenControls), t && (t.addEventListener("mouseenter", showFullscreenControls), t.addEventListener("click", showFullscreenControls)), n && n.addEventListener("mouseenter", showFullscreenControls), showFullscreenControls())) : (clearTimeout(fsInactivityTimeout), e.removeEventListener("mousemove", showFullscreenControls), e.removeEventListener("touchend", handleFullscreenTap), t && (t.removeEventListener("mouseenter", showFullscreenControls), t.removeEventListener("click", showFullscreenControls), t.classList.add("opacity-0", "pointer-events-none", "translate-y-4"), t.classList.remove("opacity-100", "pointer-events-auto", "translate-y-0")), n && (n.removeEventListener("mouseenter", showFullscreenControls), n.classList.add("opacity-0", "pointer-events-none"), n.classList.remove("opacity-100", "pointer-events-auto")), fsControlsVisible = !1, normalTopBarVisible = !1, isTouchDevice() && e && e.addEventListener("touchend", handleNormalScreenTap))
}), window.syncFullscreenMediaUI = function() {
  const e = document.getElementById("fullscreen-mic-on"),
    t = document.getElementById("fullscreen-mic-off"),
    n = document.getElementById("fullscreen-mic-btn");
  e && t && (e.classList.toggle("hidden", window.isMuted), t.classList.toggle("hidden", !window.isMuted)), n && (n.classList.toggle("bg-red-500/20", window.isMuted || window.isForceMuted), n.classList.toggle("text-red-400", window.isMuted || window.isForceMuted), n.classList.toggle("bg-white/5", !window.isMuted && !window.isForceMuted), n.classList.toggle("text-gray-300", !window.isMuted && !window.isForceMuted));
  const o = document.getElementById("fullscreen-video-on"),
    s = document.getElementById("fullscreen-video-off"),
    r = document.getElementById("fullscreen-video-btn"),
    d = window.isCameraEnabled;
  o && s && (o.classList.toggle("hidden", !d), s.classList.toggle("hidden", d)), r && (r.classList.toggle("bg-emerald-500/20", d), r.classList.toggle("text-emerald-400", d), r.classList.toggle("bg-white/5", !d), r.classList.toggle("text-gray-300", !d))
}, window.openScreenSettings = function() {
  const localStreamActive = !!(window.localScreenStream?.getVideoTracks?.().some(e => "ended" !== e.readyState) || window._screenShareStarting);
  if (localStreamActive) {
    "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.share_busy", "⚠️ لا يمكن فتح مشاركة شاشة أخرى قبل إيقاف المشاركة الحالية."), "warning");
    return
  }
  const e = document.getElementById("screen-settings-modal");
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {

    const d = window.foxyScreenShareDiagnostics ? window.foxyScreenShareDiagnostics() : {};
    const why = window.foxyScreenShareUnsupportedReason ? window.foxyScreenShareUnsupportedReason() : {
      title: "📱 مشاركة الشاشة غير مدعومة",
      body: "المتصفح مش بيوفّر getDisplayMedia."
    };
    const isTouch = window.foxyIsHandheld ? window.foxyIsHandheld() : !!(d.isMobileUA || (d.maxTouchPoints > 0 && d.innerWidth <= 1024));
    console.warn("[Foxy][screen-share] getDisplayMedia غير متاح", d, why);
    "function" == typeof window.showFoxyToast && window.showFoxyToast({
      id: "screen-share-error", tone: isTouch ? "warn" : "error",
      title: why.title, body: why.body, duration: isTouch ? 9000 : 0
    });
    "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.screen_unsupported", "⚠️ متصفحك الحالي لا يدعم ميزة مشاركة الشاشة") + " — " + why.title, "error");
    return
  }
  e?.classList.remove("hidden"), e?.classList.add("flex")
}, window.closeScreenSettings = function() {
  const e = document.getElementById("screen-settings-modal");
  e && (e.classList.add("hidden"), e.classList.remove("flex"))
}, window.confirmStartScreen = function() {

  window.closeScreenSettings(), "function" == typeof startScreenShare && startScreenShare()
}, window.openScreenShareDiagnostics = function() {
  const e = window.foxyScreenShareDiagnostics ? window.foxyScreenShareDiagnostics() : {};
  const t = `secure=${e.secureContext} getDisplayMedia=${e.hasGetDisplayMedia} mobile=${e.isMobileUA} touch=${e.maxTouchPoints} standalone=${e.standalone} stuck=${e.stuck} electron=${e.electron} width=${e.innerWidth}`;
  console.info("[Foxy][screen-share] diagnostics", e);
  "function" == typeof window.showFoxyToast && window.showFoxyToast({
    id: "screen-share-diag", tone: e.secureContext && e.hasGetDisplayMedia ? "success" : "error", duration: 0,
    title: e.secureContext && e.hasGetDisplayMedia ? "✅ مشاركة الشاشة مدعومة هنا" : "❌ مشاركة الشاشة غير مدعومة",
    body: t
  });
  return e
}, window.watchParticipantCamera = function(e) {
  let t = e;
  if (window.uidToPeerIdMap && window.uidToPeerIdMap[e]) t = window.uidToPeerIdMap[e];
  else if (window.peerIdToUidMap)
    for (const [n, o] of Object.entries(window.peerIdToUidMap))
      if (o === e) {
        t = n;
        break
      } window.showScreenViewUI(!0);
  const n = document.getElementById("screen-video"),
    o = document.getElementById("screen-loading"),
    s = document.getElementById("screen-title");
  if (window.currentScreenSource = e, o && o.classList.remove("hidden"), s) {
    const e = window.connections && window.connections[t]?.name || window.__fb("js.participant", "المشارك");
    s.textContent = window.__fb("js.cam_stream", "بث الكاميرا: ") + e
  }
  window.refreshParticipantMediaPreviews?.();
  n && (n.srcObject = null);
  const r = () => {
    if (document.getElementById("screen-overlay")?.classList.contains("hidden") || window.currentScreenSource !== e) return !0;
    const s = window.calls && window.calls[t];
    let r = null;
    if (s?.remoteVideoStream) r = s.remoteVideoStream;
    else if (s?.remoteStream?.getVideoTracks?.().length) r = new MediaStream(s.remoteStream.getVideoTracks());
    else {
      const n = document.getElementById(`remote-video-${e}`);
      if (n && n.srcObject) r = n.srcObject;
      else {
        const e = document.getElementById(`remote-video-${t}`);
        e && e.srcObject && (r = e.srcObject)
      }
    }
    return !!r && (o && o.classList.add("hidden"), n && n.srcObject !== r && (n.srcObject = r, n.isConnected && n.play().catch(e => {
      e.name
    })), !0)
  };
  if (!r()) {
    let e = 0;
    const t = setInterval(() => {
      e++, (r() || e > 50) && (clearInterval(t), e > 50 && o && s && (s.textContent = window.__fb("js.stream_timeout", "فشل في تحميل البث ❌ (انتهى الوقت)")))
    }, 500)
  }
}, window.updateSliderTrack = updateSliderTrack, window.positionContextMenu = function(e, t, n = !1) {
  if (!e || !t) return;
  e.classList.remove("hidden"), window.lastOpenedMenu = e, window.lastOpenedEvent = t;
  const o = e.id.includes("profile-popout");
  o || (e.style.maxHeight = "none", e.style.overflowY = "visible"), e.style.left = "auto", e.style.right = "auto", e.style.top = "auto", e.style.bottom = "auto";
  const s = e.getBoundingClientRect(),
    r = s.width || (o ? 300 : 224),
    d = s.height || 400;
  let i = t.clientX,
    a = t.clientY;
  i = i + r > window.innerWidth ? Math.max(10, i - r - 5) : Math.min(i + 5, window.innerWidth - r - 10);
  const c = window.innerHeight - a - 10;
  const hasSubmenu = !!e.querySelector(".ctx-submenu-container");
  c < d && a - 10 > c ? a = Math.max(10, a - d - 5) : (a = Math.min(a + 5, window.innerHeight - d - 10), c < d && (e.style.maxHeight = c + "px", hasSubmenu ? (e.style.overflowY = "visible", e.style.overflowX = "visible") : e.style.overflowY = "auto")), e.style.left = i + "px", e.style.top = a + "px";

  {
    const rect = e.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 8) e.style.top = Math.max(8, window.innerHeight - rect.height - 8) + "px";
    if (rect.top < 8) e.style.top = "8px";
    if (rect.right > window.innerWidth - 8) e.style.left = Math.max(8, window.innerWidth - rect.width - 8) + "px";
    if (rect.left < 8) e.style.left = "8px";
  }

  if (hasSubmenu) {
    e.style.overflowY = "visible"; e.style.overflowX = "visible"; e.style.maxHeight = "none";

    {
      const rect2 = e.getBoundingClientRect();
      if (rect2.bottom > window.innerHeight - 8) e.style.top = Math.max(8, window.innerHeight - rect2.height - 8) + "px";
      if (rect2.right > window.innerWidth - 8) e.style.left = Math.max(8, window.innerWidth - rect2.width - 8) + "px";
    }
    const subWidth = 188;
    const flipIfNeeded = () => {
      const menuRect = e.getBoundingClientRect();
      const spaceLeft = menuRect.left, spaceRight = window.innerWidth - menuRect.right;
      e.querySelectorAll(".ctx-submenu-container").forEach(sub => {
        const needRight = spaceLeft < subWidth + 10 && spaceRight > spaceLeft;
        if (needRight) { sub.style.right = "auto"; sub.style.left = "100%"; sub.style.paddingRight = "0"; sub.style.paddingLeft = "8px"; }
        else { sub.style.right = "100%"; sub.style.left = "auto"; sub.style.paddingRight = "8px"; sub.style.paddingLeft = "0"; }
      });
    };
    flipIfNeeded();

    e.querySelectorAll(".ctx-submenu-container .ctx-submenu").forEach(subMenu => {
      const container = subMenu.closest(".ctx-submenu-container");
      if (!container) return;
      const parentItem = container.closest(".context-menu-item");
      if (!parentItem) return;
      const adjustSubTop = () => {
        const subRect = subMenu.getBoundingClientRect();
        if (subRect.bottom > window.innerHeight - 8) {
          const overflow = subRect.bottom - (window.innerHeight - 8);
          container.style.top = `-${overflow + 4}px`;
        } else container.style.top = "0px";
      };
      parentItem.addEventListener("mouseenter", adjustSubTop);
    });

    e.querySelectorAll(".context-menu-item").forEach(item => {
      const sub = item.querySelector(".ctx-submenu-container");
      if (sub && !sub._smartFlipBound) { sub._smartFlipBound = true; item.addEventListener("mouseenter", flipIfNeeded); }
    });
  }
}, window.hideAllMenus = (e = null, t = null) => {
  ["member-context-menu", "message-context-menu", "server-context-menu", "channel-context-menu", "channel-list-context-menu", "server-channel-header-menu", "user-profile-popout", "member-profile-popout", "custom-context-menu"].forEach(n => {
    const o = document.getElementById(n);
    if (o && !o.classList.contains("hidden")) {
      if (t && o === window.lastOpenedMenu && t === window.lastOpenedEvent) return;
      if (e && (e === o || o.contains(e))) return;
      if ("user-profile-popout" === n && e?.closest(".sidebar-profile-bottom")) return;
      o.classList.add("hidden")
    }
  })
}, document.addEventListener("mousedown", e => {
  window.hideAllMenus(e.target, e)
}), document.addEventListener("contextmenu", e => {
  if (!e.defaultPrevented) window.hideAllMenus(e.target, e)
});
const peerVolSlider = document.getElementById("peer-volume-slider");
if (peerVolSlider) {
  peerVolSlider.oninput = function() {
    const e = parseInt(this.value, 10);
    const volVal = document.getElementById("ctx-vol-val");
    if (volVal) volVal.innerText = e + "%";
    updateSliderTrack(this);
    if (currentCtxPeerId) {
      if ("function" == typeof window.adjustPeerVolume) window.adjustPeerVolume(currentCtxPeerId, e / 100);
      else {
        const t = document.getElementById("audio-" + currentCtxPeerId);
        t && (t.volume = e / 100);
      }
    }
  };
}
const ctxMuteLocal = document.getElementById("ctx-mute-local");
if (ctxMuteLocal) {
  ctxMuteLocal.onclick = function() {
    if (!currentCtxPeerId) return;
    const e = document.getElementById("audio-" + currentCtxPeerId);
    if (e) {
      e.muted = !e.muted;
      const indicator = document.getElementById("ctx-mute-indicator");
      if (indicator) indicator.className = e.muted ? "w-2 h-2 rounded-full bg-red-500" : "w-2 h-2 rounded-full bg-transparent";
      const ctxName = document.getElementById("ctx-name");
      const nameText = ctxName ? ctxName.innerText : window.__fb("app_chat.default_sender", "المستخدم");
      if (typeof addSystemMsg === "function") addSystemMsg(e.muted?window.__f("js.muted_local", {name: nameText}, `تم كتم صوت ${nameText} محلياً`):window.__f("js.unmuted_local", {name: nameText}, `تم تفعيل صوت ${nameText} محلياً`));
    }
  };
}
window.remoteMutePeer = async function() {
  currentCtxPeerId && await window.uiConfirm(window.__f("js.confirm_mute_all", {name: document.getElementById("ctx-name").innerText}, `هل أنت متأكد من إغلاق المايك لـ ${document.getElementById("ctx-name").innerText} عند الجميع؟`)) && sendSignalingCmd(currentCtxPeerId, {
    type: "remote-cmd",
    action: "mute"
  })
}, window.kickPeer = function() {
  if (!currentCtxPeerId) return;
  const e = document.getElementById("ctx-name")?.innerText || window.lastContextMemberName || window.__fb("app_chat.default_sender", "المستخدم");
  window.voiceKickedPeers && window.voiceKickedPeers.add(currentCtxPeerId), sendSignalingCmd(currentCtxPeerId, {
    type: "remote-cmd",
    action: "kick"
  }), addSystemMsg(window.__f("js.kicked_channel", {name: e}, `تم طرد ${e} من القناة.`))
}, window.toggleVoiceChatOverlay = function() {
  const e = document.getElementById("voice-chat-overlay");
  e && e.classList.toggle("active")
}, window.showMessageContextMenu = window.showMessageContextMenu || function(e, t, n, o) {
  e.preventDefault();
  const s = document.getElementById("message-context-menu");
  if (!s) return;
  window.lastContextMessageId = t, window.lastContextMessageType = o;
  const myUid = window.state?.myUid || window.currentUserProfile?.uid;
  const isOwner = n && myUid && n === myUid;
  const activeServer = (window.state?.servers || []).find(r => r.id === window.state?.activeServerId);
  const isServerOwner = myUid && activeServer?.ownerUid === myUid;
  const d = document.getElementById("msg-ctx-delete");
  if (d) d.classList.toggle("hidden", !isOwner && !isServerOwner);
  const i = document.getElementById("msg-ctx-edit");
  if (i) i.classList.toggle("hidden", !isOwner);
  positionContextMenu(s, e, !1)
}, window.handleMessageAction = async function(e) {
  const t = window.lastContextMessageId,
    n = window.lastContextMessageType,
    o = document.getElementById("message-context-menu");
  if (o && o.classList.add("hidden"), t)
    if ("copy" === e) {
      const e = document.querySelector(`[data-message-id="${t.replace(/"/g,"\\\"")}"]`),
        n = e ? e.getAttribute("data-raw-text") || e.querySelector(".message-content")?.innerText : "";
      n && navigator.clipboard.writeText(n).then(() => {
        "function" == typeof window.addSystemMsg && window.addSystemMsg(window.__fb("js.copied", "تم نسخ النص"))
      })
    } else "edit" === e ? "function" == typeof window.startEditingMessage && window.startEditingMessage(t, n) : "reply" === e ? window.startReplyMessage(t, n) : "forward" === e ? window.startForwardMessage(t, n) : "delete" === e && await window.uiConfirm(window.__fb("js.confirm_del_msg", "هل أنت متأكد من حذف هذه الرسالة؟")) && ("server" === n && "function" == typeof window.deleteServerMessage ? await window.deleteServerMessage(t) : "dm" === n && "function" == typeof window.deleteDmMessage && await window.deleteDmMessage(t))
}, window.handleMessageToolbarAction = function(e, t, n, o) {
  if (e.stopPropagation(), "reply" === n) {
    if (!o) {
      const e = document.querySelector(`[data-message-id="${t}"]`);
      e && (e.closest("#server-chat-messages") ? o = "server" : (e.closest("#home-dm-messages") || e.closest("#dm-messages")) && (o = "dm"))
    }
    o && "function" == typeof window.startReplyMessage && window.startReplyMessage(t, o)
  } else if ("forward" === n) {
    if (!o) {
      const e = document.querySelector(`[data-message-id="${t}"]`);
      e && (e.closest("#server-chat-messages") ? o = "server" : (e.closest("#home-dm-messages") || e.closest("#dm-messages")) && (o = "dm"))
    }
    o && "function" == typeof window.startForwardMessage && window.startForwardMessage(t, o)
  }
}, window.startEditingMessage = function(e, t) {
  const n = document.querySelector(`[data-message-id="${e}"]`);
  if (!n) return;
  const o = n.getAttribute("data-raw-text") || "";
  if (window.currentEditingMsgId = e, window.currentEditingType = t, "server" === t) {
    const e = document.getElementById("server-chat-input"),
      t = document.getElementById("server-edit-bar");
    if (e && t) {
      e.innerText = o, t.classList.remove("hidden"), e.focus();
      const n = document.createRange(),
        s = window.getSelection();
      n.selectNodeContents(e), n.collapse(!1), s.removeAllRanges(), s.addRange(n)
    }
  } else if ("dm" === t) {
    const e = document.getElementById("home-dm-input"),
      t = document.getElementById("dm-edit-bar");
    if (e && t) {
      e.innerText = o, t.classList.remove("hidden"), e.focus();
      const n = document.createRange(),
        s = window.getSelection();
      n.selectNodeContents(e), n.collapse(!1), s.removeAllRanges(), s.addRange(n)
    }
  }
}, window.startReplyMessage = function(e, t) {
  const n = document.querySelector(`[data-message-id="${e}"]`);
  if (!n) return;
  window.currentEditingMsgId && window.cancelEditingMessage();
  const o = n.querySelector(".sender-name")?.innerText || window.__fb("app_chat.default_sender", "مستخدم"),
    s = n.getAttribute("data-raw-text") || "";
  if (window.currentReplyToMsgId = e, window.currentReplyToType = t, window.currentReplyData = {
      senderName: o,
      text: s
    }, "server" === t) {
    const e = document.getElementById("server-chat-input"),
      t = document.getElementById("server-reply-bar"),
      n = document.getElementById("server-reply-name"),
      r = document.getElementById("server-reply-text");
    e && t && (n.innerText = o, r.innerText = s.length > 50 ? s.substring(0, 50) + "..." : s, t.classList.remove("hidden"), e.focus())
  } else if ("dm" === t) {
    const e = document.getElementById("home-dm-input"),
      t = document.getElementById("dm-reply-bar"),
      n = document.getElementById("dm-reply-name"),
      r = document.getElementById("dm-reply-text");
    e && t && (n.innerText = o, r.innerText = s.length > 50 ? s.substring(0, 50) + "..." : s, t.classList.remove("hidden"), e.focus())
  }
}, window.cancelReplyMessage = function() {
  window.currentReplyToMsgId = null, window.currentReplyData = null;
  const e = window.currentReplyToType;
  if (window.currentReplyToType = null, "server" === e) {
    const e = document.getElementById("server-reply-bar");
    e && e.classList.add("hidden")
  } else if ("dm" === e) {
    const e = document.getElementById("dm-reply-bar");
    e && e.classList.add("hidden")
  }
}, window.startForwardMessage = function(e, t) {
  const n = document.querySelector(`[data-message-id="${e}"]`);
  if (!n) return;
  const o = n.getAttribute("data-raw-text") || "";
  window.currentForwardText = o;
  const s = document.getElementById("forward-modal");
  if (s) {
    s.classList.remove("hidden"), window.populateForwardTargets();
    const e = document.getElementById("forward-search-input");
    e && (e.value = "", e.focus(), e.hasListener || (e.hasListener = !0, e.addEventListener("input", e => {
      window.populateForwardTargets(e.target.value)
    })))
  }
}, window.closeForwardModal = function() {
  const e = document.getElementById("forward-modal");
  e && e.classList.add("hidden"), window.currentForwardText = null
}, window.populateForwardTargets = function(e = "") {
  const t = document.getElementById("forward-targets-list");
  if (!t) return;
  t.innerHTML = "";
  const n = e.toLowerCase(),
    o = [..."function" == typeof window.getAllServerChannels ? window.getAllServerChannels() : [], ..."function" == typeof window.getAllFriendTargets ? window.getAllFriendTargets() : []].filter(e => e.name.toLowerCase().includes(n) || e.serverName && e.serverName.toLowerCase().includes(n));
  0 !== o.length ? o.forEach(e => {
    const n = document.createElement("div");
    n.className = "flex items-center justify-between p-2 hover:bg-white/5 rounded-xl transition group cursor-pointer";
    let o = "",
      s = "";
    "server" === e.type ? (o = '<div class="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center text-gray-300 font-bold text-lg">#</div>', s = `<span class="text-[10px] text-gray-500">${e.serverName}</span>`) : (o = window.createAvatarHTML(e.photoURL || "", e.name, {
      size: 10,
      shape: "xl",
      border: "border border-white/10"
    }), s = '<span class="text-[10px] text-gray-500">' + window.__fb("js.private_badge", "رسالة خاصة") + '</span>'), n.innerHTML = `\n            <div class="flex items-center gap-3">\n                ${o}\n                <div class="flex flex-col">\n                    <span class="text-sm font-bold text-gray-200">${e.name}</span>\n                    ${s}\n                </div>\n            </div>\n            <button onclick="window.confirmForward('${e.id}', '${e.type}', '${e.name.replace(/'/g,"\\'")}', '${e.serverId||""}')" \n                class="px-4 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500 text-xs font-bold rounded-lg transition hover:text-white">\n                ${window.__fb("app_chat.ctx_forward", "توجيه")}\n            </button>\n        `, n.onclick = t => {
      "BUTTON" !== t.target.tagName && window.confirmForward(e.id, e.type, e.name, e.serverId || "")
    }, t.appendChild(n)
  }) : t.innerHTML = '<div class="p-8 text-center text-gray-500 text-sm">' + window.__fb("js.no_search_results", "لم يتم العثور على نتائج") + '</div>'
}, window.confirmForward = async function(e, t, n, o) {
  if (window.currentForwardText) try {
    "server" === t ? "function" == typeof window.forwardMessageToServer && await window.forwardMessageToServer(o, e, window.currentForwardText) : "function" == typeof window.forwardMessageToDm && await window.forwardMessageToDm(e, window.currentForwardText), "function" == typeof window.addSystemMsg && window.addSystemMsg(window.__f("js.forwarded_ok", {name: n}, `تم توجيه الرسالة بنجاح إلى ${n}`)), window.closeForwardModal()
  } catch (e) {
    alert(window.__fb("js.forward_fail", "فشل توجيه الرسالة."))
  }
}, window.cancelForwardMessage = function() {
  window.currentForwardData = null;
  const e = document.getElementById("server-forward-bar"),
    t = document.getElementById("dm-forward-bar");
  e && e.classList.add("hidden"), t && t.classList.add("hidden")
}, window.cancelEditingMessage = function() {
  window.currentEditingMsgId = null;
  const e = window.currentEditingType;
  if (window.currentEditingType = null, "server" === e) {
    const e = document.getElementById("server-chat-input"),
      t = document.getElementById("server-edit-bar");
    e && (e.innerHTML = ""), t && t.classList.add("hidden")
  } else if ("dm" === e) {
    const e = document.getElementById("home-dm-input"),
      t = document.getElementById("dm-edit-bar");
    e && (e.innerHTML = ""), t && t.classList.add("hidden")
  }
}, document.addEventListener("keydown", e => {
  "Escape" === e.key && (window.currentEditingMsgId ? window.cancelEditingMessage() : window.currentReplyToMsgId ? window.cancelReplyMessage() : window.currentForwardData && window.cancelForwardMessage())
});

const originalShowScreenViewersModal = window.showScreenViewersModal;
window.showScreenViewersModal = function() {
  const fullscreenElement = document.fullscreenElement;
  originalShowScreenViewersModal && originalShowScreenViewersModal();
  const modal = document.getElementById("screen-viewers-modal");
  if (modal) modal.dataset.viewerSignature = JSON.stringify((window.getScreenViewersList?.() || []).map(viewer => [viewer.uid, viewer.name]));
  fullscreenElement && modal && fullscreenElement.appendChild(modal)
};
window.refreshScreenViewersModal = function() {
  const modal = document.getElementById("screen-viewers-modal");
  if (!modal) return;
  const signature = JSON.stringify((window.getScreenViewersList?.() || []).map(viewer => [viewer.uid, viewer.name]));
  if (modal.dataset.viewerSignature !== signature) window.showScreenViewersModal?.();
};
