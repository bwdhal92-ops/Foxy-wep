function optimizeAudioSDP(e) {
  if (!e) return e;
  let t = e.split("\r\n"),
    o = null;
  for (let e of t)
    if (e.startsWith("a=rtpmap:") && e.toLowerCase().includes("opus/48000")) {
      const t = e.match(/a=rtpmap:(\d+)/i);
      if (t) {
        o = t[1];
        break
      }
    } if (o)
    for (let e = 0; e < t.length; e++) t[e].startsWith(`a=fmtp:${o}`) && (t[e].includes("usedtx=1") || (t[e] += ";usedtx=1"), t[e].includes("useinbandfec=1") || (t[e] += ";useinbandfec=1"));
  else
    for (let e = 0; e < t.length; e++) t[e].startsWith("a=fmtp:") && (t[e].includes("useinbandfec=1") || t[e].includes("minptime=")) && (t[e].includes("usedtx=1") || (t[e] += ";usedtx=1"));
  return t.join("\r\n")
}
if ("undefined" != typeof RTCPeerConnection) {
  const e = RTCPeerConnection.prototype.setLocalDescription;
  RTCPeerConnection.prototype.setLocalDescription = function(t) {
    return t && t.sdp && (t.sdp = optimizeAudioSDP(t.sdp)), e.apply(this, [t])
  }
}
let peer, localStream, myId, currentHostId = "",
  connections = {},
  calls = {},
  isMuted = localStorage.getItem("isMuted") === "true",
  isDeafened = localStorage.getItem("isDeafened") === "true",
  isForceMuted = !1,
  isCameraEnabled = !1,
  selectedMicId = localStorage.getItem("selectedMicrophoneId") || "default",
  selectedSpeakerId = localStorage.getItem("selectedSpeakerId") || "default",
  selectedCameraId = localStorage.getItem("selectedCameraId") || "default",
  savedNoiseGateMode = localStorage.getItem("noiseGateMode") || "ai-hybrid";
window.isMuted = isMuted, window.isDeafened = isDeafened, window.isForceMuted = isForceMuted, window.isCameraEnabled = isCameraEnabled, window.localPreviewEnabled = !1, window.localStream = localStream, window.connections = connections, window.calls = calls, window.selectedSpeakerId = selectedSpeakerId;
const reCallTimers = {};
window.voiceKickedPeers = new Set, window.locallyDeadUids = new Set;
const iceRestartAttempts = {};

window.isPeerIdShaped = function(v) {
  if ("string" != typeof v || !v) return !1;
  if (v === window.myId) return !0;
  return /^[a-z0-9]{6,10}-[a-z0-9]{6,16}$/i.test(v);
};

// ── حارس "سبنا هذا المشارك" ───────────────────────────────────────────────
//FIX: بعد مغادرة جلسة (مكالمة/قناة صوتية) كان الطرف التاني يقدر يرجّع
// الاتصال من غير سبب (heartbeat حضور / إعادة محاولة شاشة) فيظهر
// participant card + بطاقة معاينة شاشة زايدة وأنا مش داخل أي مكالمة.
// بنسجّل مين سبناه وبنرفض أي اتصال وارد منهم لحد ما نبدأ جلسة جديدة.
window.__foxyLeftSessionPeers = window.__foxyLeftSessionPeers || new Map();
window.__foxyInActiveCallSession = function() {
  try {
    if (window.isDmCalling) return true;
    if (window.state && window.state.activeVoiceChannelId && window.state.activeVoiceStartedAtMs > 0) return true;
    if ("function" == typeof window.isVoiceSessionActive && window.isVoiceSessionActive()) return true;
  } catch (_) {}
  return false;
};
window.__foxyMarkLeftSessionPeers = function(peerIds) {
  try {
    const map = window.__foxyLeftSessionPeers;
    const now = Date.now();
    (peerIds || []).forEach(id => { if (id) map.set(id, now); });
  } catch (_) {}
};
window.__foxyClearLeftSessionPeers = function(peerId) {
  try {
    const map = window.__foxyLeftSessionPeers;
    if (!map) return;
    if (peerId) map.delete(peerId);
    else map.clear();
  } catch (_) {}
};
window.__foxyShouldRejectIncomingCall = function(peerId, windowMs) {
  try {
    if (!peerId) return false;
    if (window.__foxyInActiveCallSession()) return false;
    const map = window.__foxyLeftSessionPeers;
    if (!map) return false;
    const at = map.get(peerId);
    if (!at) return false;
    const max = Number(windowMs) > 0 ? Number(windowMs) : 90000;
    if (Date.now() - at > max) {
      map.delete(peerId);
      return false;
    }
    return true;
  } catch (_) {
    return false;
  }
};

// ── الأسماء: displayName بدون وسم "#tag" ──────────────────────────────────
//FIX: window.myName = fullTag ("الاسم#1234")،Intro كان بيبعت ده للزملاء
//⇒ الكارت بيعرض "الاسم#1234" والي كان بيعرضه من الحضور بيعرض "الاسم" بس.
// بنوحّد: نبعث displayName، ولو جاي من زميل قديم بنشيل الوسم.
window.__foxySelfDisplayName = function() {
  try {
    const profile = window.currentUserProfile;
    const name = profile && (profile.displayName || profile.name);
    if (name && String(name).trim()) return String(name).trim();
    const raw = String(window.myName || "").trim();
    return raw.replace(/\s*#\d{3,}\s*$/, "");
  } catch (_) {
    return window.myName || "";
  }
};
window.__foxyResolvePeerName = function(uid, fallback) {
  const raw = String(fallback == null ? "" : fallback).trim();
  try {
    const known =
      (uid && window.state?.activeChannelPresenceMap?.[uid]?.name) ||
      (uid && window.state?.allUsers?.[uid]?.displayName) ||
      (uid && window.state?.serverMembersData?.[uid]?.displayName) ||
      (uid && window.getFriendData?.(uid)?.displayName);
    if (known && String(known).trim()) return String(known).trim();
  } catch (_) {}
  const stripped = raw.replace(/\s*#\d{3,}\s*$/, "");
  return stripped || raw;
};

window.resolvePeerUid = function(peerId, fromIntro) {
  try {
    var st = window.state || {};

    if (fromIntro && fromIntro !== peerId && !window.isPeerIdShaped(fromIntro)) return fromIntro;

    var mapped = (window.peerIdToUidMap || {})[peerId];
    if (mapped && !window.isPeerIdShaped(mapped)) return mapped;

    var maps = [st.activeChannelPresenceMap || {}];
    var vm = st.voicePresenceMap || {};
    for (var k in vm) if (vm[k]) maps.push(vm[k]);
    for (var i = 0; i < maps.length; i++) {
      var m = maps[i];
      for (var uid in m) {
        var e = m[uid];
        if (e && e.peerId === peerId && !window.isPeerIdShaped(uid)) return uid;
      }
    }

    var cs = window.connections || {};
    for (var p in cs) {
      var c = cs[p];
      if (p !== peerId && c && c.uid && c.uid !== peerId && !window.isPeerIdShaped(c.uid)) return c.uid;
    }
  } catch (_) {}
  return "";
};
let mediaRequestPromise = null,
  cachedDevices = null,
  lastDeviceEnumerateTime = 0;
let cameraStream = null,
  cameraRequestPromise = null;
window.localCameraStream = null;
async function getEnumerateDevices(forceRefresh) {
  const e = Date.now();
  if (forceRefresh || !cachedDevices || e - lastDeviceEnumerateTime > 4e3) {
    cachedDevices = await navigator.mediaDevices.enumerateDevices();
    lastDeviceEnumerateTime = e;
  }
  return cachedDevices;
}
let roomMode = "public",
  pendingApprovals = {},
  isGuest = !1,
  wakeLock = null,
  silentStreamCtx = null,
  micTestCtx = null;
async function initPeer() {
  if (peer && !peer.destroyed && window.myId) return;
  // لا تُحاول تهيئة الاتصال إن لم تتوفر مكتبة PeerJS — بدلاً من رمي
  // ReferenceError غير مُلتقط كان يُسقط setupUserProfile والمستخدم.
  if (typeof Peer === "undefined") {
    window.foxyVoiceAvailable = !1;
    window.foxyLog("error", "[Foxy][peer-trace] initPeer متوقفة — PeerJS غير متاح", {
      url: location.href,
      timestamp: new Date().toISOString()
    });
    "function" == typeof window.updateSignalingStatus && window.updateSignalingStatus("unavailable");
    return;
  }
  if (typeof getSortedIceServers === 'function' && !sortedIceServers) {
    addSystemMsg && addSystemMsg(window.__fb("js.rtc_ice_testing", "🔍 جاري اختبار أحسن سيرفر ICE..."), "info");
    await getSortedIceServers();
  }
  preloadAiModule();
  await initAudioOutput();
  setupPeer();
  if (typeof window.monitorPing === 'function') window.monitorPing();
  startConnectionHealthMonitor();
  startMicPulse();
  startKeepAliveAudio();

  try { if (window.masterAudioMixer) window.masterAudioMixer.restore(); } catch (_) {}
  try { if (window.setVadGate && window.getVadGate && window.getVadGate().want) window.setVadGate(true); } catch (_) {}
  try {
    if (window.rtcFailover) window.rtcFailover.start();
  } catch (e) {
    window.foxyLog("warn", "[Foxy][rtc] فشل تشغيل منسّق Failover", { error: e && e.message });
  }
  // كاسح الاتصالات المعلّقة: يمنع تراكم PCs "زومبي" من اتصالات لم تكتمل أبداً
  try { if (window.startPendingSweep) window.startPendingSweep(); } catch (e) {
    window.foxyLog("warn", "[Foxy][rtc] فشل تشغيل كاسح المعلّقين", { error: e && e.message });
  }
}
async function ensureLocalStream(e = 0) {
  if (mediaRequestPromise) return mediaRequestPromise;
  mediaRequestPromise = _doEnsureLocalStream(e);
  try {
    return await mediaRequestPromise
  } finally {
    mediaRequestPromise = null
  }
}
async function _doEnsureLocalStream(e = 0) {
  if (localStream) {
    const t = localStream.getAudioTracks();
    if (t.some(e => "ended" === e.readyState || e.muted)) {
      stopLocalStream()
    }
  }
  if (localStream) {
    // Camera capture has its own stream and reserved video sender. Keep the
    // MediaStream passed to PeerJS calls audio-only.
    localStream.getVideoTracks().forEach(track => {
      try { track.stop() } catch (_) {}
      try { localStream.removeTrack(track) } catch (_) {}
    });
    return localStream
  }
  "function" == typeof showLoading && showLoading(window.__fb("js.mic_check", "جاري فحص الميكروفون..."));
  try {
    const e = document.getElementById("echo-cancel"),
      t = document.getElementById("noise-suppress"),
      o = !e || e.checked,
      n = document.getElementById("noise-gate-mode"),
      i = n ? n.value : savedNoiseGateMode,
      a = "ai-frozen" === i || "ai-dynamic" === i || "ai-obs" === i || "ai-hybrid" === i;
    localStorage.setItem("noiseGateMode", i), savedNoiseGateMode = i;
    const r = !a && (t ? t.checked : "standard" === i),
      c = {
        audio: {
          deviceId: "default" !== selectedMicId ? {
            exact: selectedMicId
          } : void 0,
          echoCancellation: o,
          noiseSuppression: r,
          autoGainControl: !a,
          channelCount: 1,
          latency: 0,
          voiceIsolation: !0,
          googEchoCancellation: o,
          googExperimentalEchoCancellation: o,
          googAutoGainControl: !a,
          googExperimentalAutoGainControl: !a,
          googNoiseSuppression: r,
          googExperimentalNoiseSuppression: r,
          googHighpassFilter: !0,
          googTypingNoiseDetection: !0,
          googBeamforming: !0,
          googArraySpatialNoiseSuppression: !0,
          googAudioMirroring: !1
        },
        video: !1
      };
    try {
      if (localStream = await navigator.mediaDevices.getUserMedia(c), a && "function" == typeof applyAiNoiseSuppression) {
        const e = await applyAiNoiseSuppression(localStream, i);
        e && (localStream = e)
      }
      window.localStream = localStream
    } catch (e) {
      throw e
    }
    return localStream.getAudioTracks()[0].enabled = !isMuted, visualize(localStream, "me"), "function" == typeof window.checkHardwareMute && window.checkHardwareMute("join"), "function" == typeof hideLoading && hideLoading(), requestWakeLock(), "function" == typeof window.refreshMyVoicePresence && window.refreshMyVoicePresence(), localStream
  } catch (t) {
    if ("function" == typeof hideLoading && hideLoading(), "NotReadableError" === t.name && e < 1) return stopLocalStream(), selectedMicId = "default", await new Promise(e => setTimeout(e, 1e3)), mediaRequestPromise = null, await ensureLocalStream(e + 1);
    try {
      silentStreamCtx = new(window.AudioContext || window.webkitAudioContext);
      const e = silentStreamCtx.createMediaStreamDestination();
      //FIX: كان الـ fallback ده بيسيب window.localStream قديم/فاضي مع إن
      //localStream اتظبط. consumers اللي شغالة كـ module (direct-messages,
      //servers) بيشوفوا window.localStream بس — فلازم يتزامن الاتنين.
      return localStream = e.stream, window.localStream = localStream, localStream.getAudioTracks().forEach(e => e.enabled = !1), isMuted = !0, window.isMuted = !0, "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.rtc_listen_only", "🎧 لم يتم السماح بالميكروفون. تم الدخول في وضع الاستماع فقط."), "warning"), requestWakeLock(), localStream
    } catch (e) {
      return null
    }
  }
}

async function ensureCameraCapture(forceRefresh = false) {
  if (!window.isCameraEnabled || !navigator.mediaDevices?.getUserMedia) return null;
  if (cameraRequestPromise) return cameraRequestPromise;
  const currentTrack = cameraStream?.getVideoTracks?.()[0];
  if (!forceRefresh && currentTrack && currentTrack.readyState === "live") return currentTrack;
  cameraRequestPromise = (async () => {
    const oldStream = cameraStream;
    let nextStream;
    try {
      nextStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: "default" !== selectedCameraId ? { exact: selectedCameraId } : void 0,
          width: { ideal: 480 },
          height: { ideal: 360 },
          frameRate: { ideal: 15, max: 20 }
        },
        audio: false
      });
    } catch (_) {
      // Retry with browser-selected defaults if a device rejects our preferred
      // low-cost camera constraints.
      nextStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    const nextTrack = nextStream.getVideoTracks()[0];
    if (!nextTrack) {
      nextStream.getTracks().forEach(track => track.stop());
      throw new Error("The camera did not return a video track");
    }
    try { nextTrack.contentHint = "motion" } catch (_) {}
    cameraStream = nextStream;
    window.localCameraStream = nextStream;
    if (oldStream && oldStream !== nextStream) oldStream.getTracks().forEach(track => { try { track.stop() } catch (_) {} });
    return nextTrack;
  })();
  try {
    return await cameraRequestPromise;
  } finally {
    cameraRequestPromise = null;
  }
}

function stopCameraCapture() {
  if (cameraStream) cameraStream.getTracks().forEach(track => { try { track.stop() } catch (_) {} });
  cameraStream = null;
  window.localCameraStream = null;
}

async function refreshCameraCapture() {
  const track = await ensureCameraCapture(true);
  if (!track) return null;
  await Promise.all(Object.values(window.calls || {}).map(call => {
    if (!call || call._foxyVideoSource === "screen" || !window.replaceCallVideoTrack) return Promise.resolve();
    return window.replaceCallVideoTrack(call, track, "camera").catch(error => {
      window.foxyLog?.("warn", "[Foxy][video] تعذر تحديث مسار الكاميرا", { peerId: call.peer, message: error?.message });
    });
  }));
  return track;
}
window.ensureCameraCapture = ensureCameraCapture;
window.stopCameraCapture = stopCameraCapture;
window.refreshCameraCapture = refreshCameraCapture;

function stopLocalStream() {
  if ("function" == typeof window.stopAiNoiseSuppression && window.stopAiNoiseSuppression(), localStream && (localStream.getTracks().forEach(e => {
      e.stop()
    }), localStream = null), silentStreamCtx) {
    try {
      silentStreamCtx.close()
    } catch (e) {}
    silentStreamCtx = null
  }
  //FIX: window.localStream كان بيفضل ماسك ستريم ميت — consumers اللي شغالة
  //كـ module (direct-messages / servers) بتعتمد عليه وبتفتكر إن الميك لسه شغال.
  window.localStream = null;
}

//FIX: مشاركة الشاشة بتتشير على نفس MediaConnection الخاص بالصوت، فالمشاهد
//مش محتاج ميكروفون — محتاج اتصال وارد بس. قبل كده لو الميكروفون مش متاح
//(وضع استماع فقط / الميك مشغول على نفس الجهاز / الميك اتقطع) كان:
//  1) recall بيفشل خالص ⇒ استرجاع اتصال المشاهدة مستحيل.
//  2) المكالمة الواردة ما بتتردش ⇒ مفيش MediaConnection ⇒ الشير مش بيفتح.
//بنعمل استريم "سيلينت" حيّ بنفس shape الـ m-lines (صوت + فيديو + صوت شاشة)
//عشان الاتصال يكمّل والبث يوصل.
let receiveOnlyCtx = null;
let receiveOnlyDestination = null;
function getReceiveOnlyStream() {
  const existing = localStream;
  if (existing && existing.active && existing.getTracks().some(track => track.readyState === "live")) return existing;
  try {
    if (!receiveOnlyCtx || receiveOnlyCtx.state === "closed") {
      receiveOnlyCtx = new (window.AudioContext || window.webkitAudioContext)();
      receiveOnlyDestination = null;
    }
    if (receiveOnlyCtx.state === "suspended") receiveOnlyCtx.resume?.().catch(() => {});
    let track = receiveOnlyDestination?.stream?.getAudioTracks?.()[0];
    if (!track || track.readyState !== "live") {
      receiveOnlyDestination = receiveOnlyCtx.createMediaStreamDestination();
      track = receiveOnlyDestination.stream.getAudioTracks()[0];
    }
    if (!track || track.readyState !== "live") return null;
    try { track.enabled = false; } catch (_) {}
    return receiveOnlyDestination.stream;
  } catch (_) {
    try { return new MediaStream(); } catch (__) { return null; }
  }
}
window.getReceiveOnlyStream = getReceiveOnlyStream;
window.closeReceiveOnlyStream = function() {
  try { receiveOnlyDestination && receiveOnlyDestination.stream.getTracks().forEach(track => track.stop()); } catch (_) {}
  try { receiveOnlyCtx && receiveOnlyCtx.close(); } catch (_) {}
  receiveOnlyCtx = null;
  receiveOnlyDestination = null;
};

function showMicError() {
  const e = document.getElementById("rtc-error-modal");
  e && e.remove();
  const t = document.createElement("div");
  t.id = "rtc-error-modal", t.className = "fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md", t.style.animation = "popIn 0.3s ease forwards", t.innerHTML = '\n        <div class="p-8 rounded-[2rem] max-w-sm w-full text-center border border-amber-500/30 shadow-2xl" style="background: rgba(15,16,22,0.95);">\n            <div class="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 text-amber-400">\n                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>\n            </div>\n            <h3 class="text-xl font-black mb-3 text-white">' + window.__fb("js.mic_error_t", "مشكلة في الميكروفون") + '</h3>\n            <p class="text-gray-400 text-sm mb-6 leading-relaxed">' + window.__fb("js.mic_error_d", "لم نتمكن من الوصول للميكروفون. يمكنك الاستمرار في وضع الاستماع فقط، أو إعادة تحميل الصفحة للسماح بالتصاريح.") + '</p>\n            <div class="flex flex-col gap-2.5">\n                <button id="rtc-error-continue-btn" class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition active:scale-95 shadow-lg shadow-emerald-500/20">' + window.__fb("js.mic_continue", "متابعة بدون ميكروفون 🎧") + '</button>\n                <button id="rtc-error-reload-btn" class="w-full py-3.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-2xl font-bold transition border border-white/10 active:scale-95">' + window.__fb("js.mic_reload", "إعادة تحميل الصفحة") + '</button>\n            </div>\n        </div>\n    ', document.body.appendChild(t), document.getElementById("rtc-error-continue-btn").addEventListener("click", () => {
    t.remove()
  }), document.getElementById("rtc-error-reload-btn").addEventListener("click", () => {
    location.reload()
  }), t.addEventListener("click", e => {
    e.target === t && t.remove()
  })
}

function setupPeer() {
  // ⛔ كان: peer = new Peer(myId, {...}) ⇒ إذا فشل تحميل مكتبة PeerJS
  // (CDN 503 / إنترنت مقطوع / مُحجوب) فالـ ReferenceError كان يُطلق
  // كاستثناء غير مُلتقط داخل initPeer، فيتداعى إلى setupUserProfile
  // ويجعل المستخدم عاجزاً حتى عن مغادرة الغرفة الصوتية.
  if (typeof Peer === "undefined") {
    window.foxyVoiceAvailable = !1;
    const msg = window.__fb
      ? window.__fb("js.peer_missing", "⚠️ محرك الاتصال غير متاح (تعذّر تحميل مكتبة الاتصال). تحقق من الشبكة ثم أعد تحميل الصفحة.")
      : "engine unavailable";
    window.foxyLog("error", "[Foxy][peer-trace] مكتبة PeerJS غير محمّلة — تم إيقاف تهيئة الاتصال بأمان", {
      hadWindowPeer: typeof window.Peer,
      url: location.href,
      timestamp: new Date().toISOString()
    });
    "function" == typeof addSystemMsg && addSystemMsg(msg, "error");
    "function" == typeof window.updateSignalingStatus && window.updateSignalingStatus("unavailable");
    return;
  }
  window.foxyVoiceAvailable = !0;
  const e = "undefined" != typeof crypto && "function" == typeof crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).substring(2, 10);
  myId = `${Date.now().toString(36)}-${e}`, window.myId = myId;
  window.FOXY_DEBUG && window.foxyLog("info", "[Foxy][peer-trace] إنشاء Peer أساسي", {peerId:myId, previousPeerId:window.peer?.id || null, reason:window._peerRebuildReason || "initial", timestamp:new Date().toISOString()});
  window._peerRebuildReason = null;
  const t = getIceConfig();
  peer = new Peer(myId, {
    config: t,
    debug: 0,
    pingInterval: 5e3,
    ...("function" == typeof getPeerServerOptions ? getPeerServerOptions() : {})
  }), window.peer = peer, "function" == typeof showLoading && showLoading(window.__fb("app_loading.connecting", "جاري الاتصال بالسيرفر...")),   peer.on("open", e => {
    window.FOXY_DEBUG && window.foxyLog("info", "[Foxy][peer-trace] Peer الأساسي أصبح مفتوحًا", {peerId:e, timestamp:new Date().toISOString()});
    "function" == typeof hideLoading && hideLoading();
    try {
      const nb = document.getElementById("net-status-banner");
      "function" == typeof window.setNetBanner && window.setNetBanner(nb && !nb.classList.contains("hidden") ? "online" : "hide");
    } catch (_) {}
    const t = document.getElementById("my-id");
    t && (t.innerText = e), currentHostId && currentHostId !== myId || (currentHostId = e, window.currentHostId = e, window.updateMyRoomPresence && window.updateMyRoomPresence(currentHostId)), updateHostUI(currentHostId, myId, connections), window.updateSignalingStatus && window.updateSignalingStatus("online"), o = 0, "function" == typeof window.resetP2pFailureCount && window.resetP2pFailureCount(), window.ghostCleanupInterval || (window.ghostCleanupInterval = setInterval(() => {
      "function" == typeof window.cleanupGhosts && window.cleanupGhosts()
    }, 15e3)), "function" == typeof window.refreshMyVoicePresence && window.refreshMyVoicePresence()
  });
  let o = 0;
  peer.on("disconnected", () => {
    window.foxyLog("warn", "[Foxy][peer-trace] Peer الأساسي انفصل", {peerId:peer?.id || myId, destroyed:!!peer?.destroyed, disconnectCount:o + 1, timestamp:new Date().toISOString()});
    if (window.updateSignalingStatus && window.updateSignalingStatus("reconnecting"), peer.destroyed) return;
    try { "function" == typeof window.setNetBanner && window.setNetBanner("undefined" != typeof navigator && navigator.onLine === false ? "offline" : "reconnecting"); } catch (_) {}

    if ("undefined" != typeof navigator && navigator.onLine === false) {
      window.FOXY_DEBUG && window.foxyLog("info", "[Foxy][peer-trace] الجهاز أوفلاين تمامًا — انتظار حدث online بدون محاولات", {peerId: peer?.id || myId, timestamp: new Date().toISOString()});
      return;
    }
    o++;
    const e = Math.min(1e3 * Math.pow(2, o), 15e3);
    if (o <= 1 && "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.rtc_reconnecting", "انقطع الاتصال بالخادم. جاري محاولة استعادة الاتصال تلقائياً..."), "warning"), o > 8) return "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.rtc_reconnect_fail", "⚠️ فشل استعادة الاتصال بالخادم. جاري إعادة بناء الاتصال..."), "warning"), void rebuildPeer("signaling-disconnect-retries-exhausted");
    window.foxyLog("warn", "[Foxy][peer-trace] جدولة reconnect بخادم الإشارة", {attempt:o, delayMs:e, timestamp:new Date().toISOString()});
    setTimeout(() => {
      peer && peer.disconnected && !peer.destroyed && peer.reconnect()
    }, e)
  }), peer.on("call", async e => {
    // FIX: بعد ما المستخدم يغادر مكالمة/قناة صوتية، لو الطرف التاني بعت
    // اتصال جديد (بسبب heartbeat حضور أو إعادة محاولة شاشة) كان بينقبل
    // ويتصل تاني ⇒ بطاقات مشاركين زايدة + معاينة شاشة بتفضل ظاهرة بعد
    // المغادرة. بنرفض الاتصال لو إحنا سبنا هذا Participant من شوية
    // ولسه مفيش جلسة صوتية/مكالمة نشطة.
    if ("function" == typeof window.__foxyShouldRejectIncomingCall && window.__foxyShouldRejectIncomingCall(e && e.peer)) {
      window.foxyLog && window.foxyLog("warn", "[Foxy][webrtc] رفض اتصال وارد بعد مغادرة جلسة", {peerId:e && e.peer, timestamp:new Date().toISOString()});
      try { e && e.close && e.close(); } catch (_) {}
      return;
    }
    //FIX: لو الميكروفون مش متاح (وضع استماع فقط / الميك مشغول على نفس
    //الجهاز / الميك اتقطع) كانت المكالمة الواردة ما بتتردش خالص ⇒ مفيش
    //MediaConnection ⇒ مشاركة الشاشة مش بتفتح عند المشاهد خالص.
    //بنرد دايماً — وبستريم سيلينت لو مفيش ميكروفون نشط.
    let t = null;
    try {
      t = await ensureLocalStream();
    } catch (_) {
      t = null;
    }
    const _answerStream = t || localStream || window.getReceiveOnlyStream?.() || null;
    if (!_answerStream) {
      window.foxyLog?.("warn", "[Foxy][webrtc] تعذر تجهيز ستريم للرد على مكالمة واردة", { peerId: e && e.peer, timestamp: new Date().toISOString() });
      try { e && e.close && e.close(); } catch (_) {}
      return;
    }
    try {
      e.answer(_answerStream);
      handleCall(e);
      "function" == typeof window.setupDataConn && window.setupDataConn(e, !1);
    } catch (err) {
      window.foxyLog?.("warn", "[Foxy][webrtc] فشل الرد على المكالمة الواردة", { peerId: e && e.peer, message: err?.message || String(err) });
      try { e && e.close && e.close(); } catch (_) {}
    }
  }), peer.on("error", e => {
    window.foxyLog("error", "[Foxy][peer-trace] خطأ Peer الأساسي", {peerId:peer?.id || myId, type:e?.type || null, message:e?.message || String(e), timestamp:new Date().toISOString()});
    if ("peer-unavailable" === e.type) {
      const t = e.message.match(/Could not connect to peer (.*)/);
      if (t && t[1]) {
        const unavailablePeer = t[1].trim();

        window.foxyLog("warn", "[Foxy][peer-trace] تعذر الوصول لـ Peer — انتظار بدل الإسقاط الفوري", {peerId:unavailablePeer, timestamp:new Date().toISOString()});
        // ⛔ كان يُغلق calls[] فقط ويترك الـ DataConnection المعلّقة ت parties
        // PeerConnection مفتوحة بلا مُستقبِل (تسريب "زومبي" يظهر في
        // chrome://webrtc-internals بحالة connecting forever).
        // ✅ الآن: نُغلق المسارين معاً عبر مُسجّل المعلّقين.
        if (typeof _forceClosePendingDial === "function") {
          _forceClosePendingDial(unavailablePeer, "peer-unavailable");
        } else {
          if (calls[unavailablePeer]) {
            try { calls[unavailablePeer].close(); } catch (_) {}
            delete calls[unavailablePeer];
          }
        }

        const _pu = window._peerUnavailableMiss = window._peerUnavailableMiss || {};
        const _n = (_pu[unavailablePeer] = (_pu[unavailablePeer] || 0) + 1);
        if (_n <= 6) {
          window.foxyLog("info", "[Foxy][peer-trace] إعادة محاولة الوصول لـ Peer", {peerId:unavailablePeer, attempt:_n, timestamp:new Date().toISOString()});
          if (typeof window.reCallPeer === "function") {
            setTimeout(() => {
              try {
                if (window.connections && window.connections[unavailablePeer]) window.reCallPeer(unavailablePeer, "peer-unavailable-retry");
              } catch (_) {}
            }, 3000);
          }
        } else {
          window.foxyLog("warn", "[Foxy][peer-trace] انتهت المحاولات — سيُزال العضو من الغرفة", {peerId:unavailablePeer, attempts:_n, timestamp:new Date().toISOString()});

          setTimeout(() => { try { delete window._peerUnavailableMiss[unavailablePeer]; } catch (_) {} }, 3e4);
        }
      }
      return;
    }
    if (Object.keys(calls).length > 0 && ("network" === e.type || "disconnect" === e.type)) return void (window.updateSignalingStatus && window.updateSignalingStatus("reconnecting"));
    const t = {
      network: window.__fb("js.err_net", "مشكلة في الشبكة. جاري المحاولة..."),
      "server-error": window.__fb("js.err_srv", "خادم الاتصال غير متاح حالياً."),
      "socket-error": window.__fb("js.err_sock", "خطأ في الاتصال بالسيرفر."),
      disconnect: window.__fb("js.err_disc", "فصل الاتصال عن خادم الإشارة.")
    } [e.type];
    if (t && "function" == typeof addSystemMsg) {
      const e = window.lastPeerErrorTime || 0;
      Date.now() - e > 3e4 && (addSystemMsg(t, "error"), window.lastPeerErrorTime = Date.now())
    }
    "function" == typeof hideLoading && hideLoading()
  }), peer.on("connection", e => {
    // FIX: نفس حارس الاتصال الوارد — قناة البيانات الواردة كانت بتعمل
    // participant card لوحدها بعد ما نخرج من المكالمة.
    if ("function" == typeof window.__foxyShouldRejectIncomingCall && window.__foxyShouldRejectIncomingCall(e && e.peer)) {
      window.foxyLog && window.foxyLog("warn", "[Foxy][webrtc] رفض قناة بيانات واردة بعد مغادرة جلسة", {peerId:e && e.peer, timestamp:new Date().toISOString()});
      try { e && e.close && e.close(); } catch (_) {}
      return;
    }
    setupDataConn(e, !0)
  })
}

window.adoptHostRole = function(newHostId, reason) {
  if (!newHostId || newHostId === currentHostId) return false;
  const prev = currentHostId;
  currentHostId = newHostId;
  window.currentHostId = newHostId;
  const becameHost = newHostId === myId;
  if (becameHost) isGuest = !1;
  try { updateHostUI(currentHostId, myId, connections) } catch (_) {}
  try {
    if (window.state) window.state.isVoiceHost = becameHost;
  } catch (_) {}
  window.foxyLog && window.foxyLog("info", "[Foxy][host] تغيّر دور المضيف", {
    from: prev, to: newHostId, becameHost, reason: reason || "unknown",
    timestamp: new Date().toISOString()
  });

  try {
    if (typeof window.foxyBroadcastPeerMessage === "function") {
      window.foxyBroadcastPeerMessage({ type: "host-update", hostId: currentHostId });
    } else Object.values(connections).forEach(e => {
      if (e && e.conn && e.conn.open) e.conn.send({ type: "host-update", hostId: currentHostId });
    });
  } catch (_) {}
  return true;
};

function teardownAllPeerMedia(reason) {
  try { window.reCallInProgress && window.reCallInProgress.clear() } catch (_) {}
  try { for (const k in reCallTimers) clearTimeout(reCallTimers[k]), delete reCallTimers[k] } catch (_) {}
  try { window.clearAllRecallSlots && window.clearAllRecallSlots() } catch (_) {}
  try { window.clearAllDialSlots && window.clearAllDialSlots() } catch (_) {}

  try { window.masterAudioMixer && window.masterAudioMixer.isEnabled() && window.masterAudioMixer.disable() } catch (_) {}

  try { window.__foxyVadStop && window.__foxyVadStop() } catch (_) {}

  try { window.rtcFailover && window.rtcFailover.stop() } catch (_) {}
  try { window.stopPendingSweep && window.stopPendingSweep() } catch (_) {}
  try { window.teardownAllVisualizers && window.teardownAllVisualizers() } catch (_) {}
  try { const a = document.getElementById("audios"); a && (a.innerHTML = "") } catch (_) {}
  try { window.spatialAudio && typeof window.spatialAudio.disconnectAll === "function" && window.spatialAudio.disconnectAll() } catch (_) {}
  try { window.audioCtx && window.audioCtx.suspend && window.audioCtx.suspend().catch(() => {}) } catch (_) {}
  try { window._lastRecallAt = {} } catch (_) {}
  try { window.peerRttMap = {}; window.peerRttTs = {} } catch (_) {}
  try { window._volumeStore = {} } catch (_) {}
  try { window._ghostSuspectAt = {} } catch (_) {}
  try { window.peersVideoStatus = {} } catch (_) {}
  try { window.iceRestartAttempts && Object.keys(window.iceRestartAttempts).forEach(k => delete window.iceRestartAttempts[k]) } catch (_) {}
  try {
    window._participantExitTimers && Object.values(window._participantExitTimers).forEach(t => clearTimeout(t));
    window._participantExitTimers = {};
  } catch (_) {}
  try { window.FOXY_DEBUG && window.foxyLog("info", "[Foxy][teardown] تفكيك موارد WebRTC", { reason, timestamp: new Date().toISOString() }) } catch (_) {}
}
window.teardownAllPeerMedia = teardownAllPeerMedia;

function hardReset(t = "manual") {
  window.foxyLog("error", "[Foxy][reset] إعادة تشغيل كاملة لنظام الاتصال — هذا هو الحدث اللي بيغيّر الـ PeerJS ID", {reason:t, hadCalls:Object.keys(calls||{}).length, hadConnections:Object.keys(connections||{}).length, wasScreenSharing:!!window.isScreenSharing, stack:(new Error().stack||"").split("\n").slice(2,7).map(s=>s.trim()).join(" <- "), timestamp:new Date().toISOString()});
  window.reCallInProgress && window.reCallInProgress.clear(), "function" == typeof window.stopSessionTimer && window.stopSessionTimer(), "function" == typeof showLoading && showLoading(window.__fb("js.rtc_rebuilding", "جاري إعادة تشغيل النظام...")), "function" == typeof window.hideDmCallOverlay && window.hideDmCallOverlay(), "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.rtc_full_reboot", "جاري عمل إعادة تشغيل كاملة لنظام الاتصال...")), Object.values(calls).forEach(e => e.close()), Object.values(connections).forEach(e => e.conn.close()), "function" == typeof window.stopScreenShare && window.stopScreenShare(), "function" == typeof window.closeScreenView && window.closeScreenView(), peer && peer.destroy(), isGuest = !1, currentHostId = "", window.currentHostId = "", window.isCameraEnabled = !1, void 0 !== isCameraEnabled && (isCameraEnabled = !1), "function" == typeof window.syncCameraUI && window.syncCameraUI(), window.updateMyRoomPresence && window.updateMyRoomPresence("");
  for (const e in connections) delete connections[e];
  for (const e in calls) delete calls[e];
  teardownAllPeerMedia("hardReset:" + t);
  stopLocalStream(), stopCameraCapture(), "function" == typeof window.closeReceiveOnlyStream && window.closeReceiveOnlyStream(), releaseWakeLock(), setTimeout(() => initPeer(), 1e3)
}

function rebuildPeer(reason) {
  window._peerRebuildReason = reason || (peer?.disconnected ? "peer-disconnected-rebuild" : "peer-health-rebuild");
  window.foxyLog("warn", "[Foxy][peer-trace] بدء إعادة بناء Peer الأساسي — الـ ID هيتغير", {reason:window._peerRebuildReason, oldPeerId:peer?.id || myId, connections:Object.keys(connections || {}), calls:Object.keys(calls || {}), stack:(new Error().stack||"").split("\n").slice(2,6).map(s=>s.trim()).join(" <- "), timestamp:new Date().toISOString()});
  const e = peer,
    t = (Object.keys(calls), {});
  if (Object.keys(connections).forEach(e => {
      t[e] = {
        name: connections[e].name,
        uid: connections[e].uid
      }
    }), e && !e.destroyed) try {
    e.destroy()
  } catch (e) {}
  for (const e in calls) delete calls[e];
  for (const e in connections) delete connections[e];
  teardownAllPeerMedia("rebuildPeer:" + (window._peerRebuildReason || reason));
  setupPeer();
  const o = setInterval(() => {
    peer && !peer.disconnected && !peer.destroyed && window.myId && (clearInterval(o), "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.rtc_rebuilt", "✅ تم إعادة بناء الاتصال بنجاح. جاري إعادة الاتصال بالمشاركين...")), "function" == typeof window.refreshMyVoicePresence && window.refreshMyVoicePresence(), Object.keys(t).forEach((e, o) => {
      const n = t[e];
      setTimeout(() => {
        "function" == typeof window.connectToPeer && peer && !peer.destroyed && window.connectToPeer(e, n.name || "...")
      }, 1500 + 500 * o)
    }))
  }, 500);
  setTimeout(() => clearInterval(o), 2e4)
}
let healthMonitorInterval = null,
  micPulseInterval = null;

function broadcastRtcStatus() {
  if (0 === Object.keys(connections).length) return;
  if (typeof window.foxyBroadcastPeerMessage === "function") {
    window.foxyBroadcastPeerMessage({ type: "mic-status", muted: !!window.isMuted, forceMuted: !!window.isForceMuted });
    window.foxyBroadcastPeerMessage({ type: "deafen-status", deafened: !!window.isDeafened, forceDeafened: !!window.isForceDeafened });
    window.foxyBroadcastPeerMessage({ type: "video-status", enabled: !!window.isCameraEnabled && !window.isScreenSharing });
    return;
  }
  Object.values(connections).forEach(e => {
    if (e.conn && e.conn.open) try {
      e.conn.send({ type: "mic-status", muted: !!window.isMuted, forceMuted: !!window.isForceMuted });
      e.conn.send({ type: "deafen-status", deafened: !!window.isDeafened, forceDeafened: !!window.isForceDeafened });
      e.conn.send({ type: "video-status", enabled: !!window.isCameraEnabled && !window.isScreenSharing });
    } catch (_) {}
  });
}

function startMicPulse() {
  micPulseInterval && clearInterval(micPulseInterval), micPulseInterval = setInterval(() => {
    peer && !peer.destroyed && 0 !== Object.keys(connections).length && broadcastRtcStatus()
  }, 3e4)
}

function stopMicPulse() {
  micPulseInterval && (clearInterval(micPulseInterval), micPulseInterval = null)
}

function startConnectionHealthMonitor() {
  healthMonitorInterval && clearInterval(healthMonitorInterval), healthMonitorInterval = setInterval(() => {
    if (!peer) return;
    if (document.hidden) return;
    if ("undefined" != typeof navigator && navigator.onLine === false) return;
    if (peer.destroyed) return void rebuildPeer("health-monitor-peer-destroyed");
    if (peer.disconnected) {
      window.foxyLog("warn", "[Foxy][health] الفحص الدوري وجد الـ Peer منفصلًا عن خادم الإشارة", {peerId:peer.id, timestamp:new Date().toISOString()});
      window.updateSignalingStatus && window.updateSignalingStatus("reconnecting");
      try {
        peer.reconnect()
      } catch (e) {
        rebuildPeer("health-monitor-reconnect-error")
      }
      return
    }
    const e = Object.keys(calls);
    if (0 === e.length) return;
    let t = 0,
      o = e.length,
      r = [];
    e.forEach(e => {
      const o = calls[e];
      if (!o || !o.peerConnection) return r.push({peer:e, state:"no-peerConnection"}), void t++;
      const n = o.peerConnection.iceConnectionState,
        i = o.peerConnection.connectionState;
      "connected" !== n && "completed" !== n || delete iceRestartAttempts[e], r.push({peer:e, ice:n, conn:i, name:connections[e]?.name||null});
      if ("disconnected" === n || "failed" === n || "failed" === i)
        if (t++, "disconnected" === n && "closed" !== i) {

          if (iceRestartAttempts[e] = (iceRestartAttempts[e] || 0) + 1, iceRestartAttempts[e] <= 2) {
            window.foxyLog("warn", "[Foxy][health] مكالمة متقطعة — انتظار (بدون restartIce)، إعادة فحص", {peerId:e, attempt:iceRestartAttempts[e], connState:i, timestamp:new Date().toISOString()});
          } else delete iceRestartAttempts[e], window.foxyLog("warn", "[Foxy][health] انقطاع مستمر، جدولة reCallPeer بنفس الـTracks", {peerId:e, connState:i, timestamp:new Date().toISOString()}), "function" == typeof window.reCallPeer && setTimeout(() => window.reCallPeer(e, "ice-disconnected-sustained"), 500 + 1500 * Math.random())
        } else "failed" !== n && "failed" !== i || (delete iceRestartAttempts[e], window.foxyLog("warn", "[Foxy][health] مكالمة بحالة failed، جدولة reCallPeer", {peerId:e, iceState:n, connState:i, timestamp:new Date().toISOString()}), "function" == typeof window.reCallPeer && setTimeout(() => window.reCallPeer(e, "ice-or-conn-failed-health"), 500 + 1500 * Math.random()))
    });
    const unhealthySnapshot = t > 0 || r.some(s => "no-peerConnection" === s.state || "disconnected" === s.ice || "failed" === s.ice || "failed" === s.conn);
    unhealthySnapshot ? window.foxyLog("warn", "[Foxy][health] الفحص الدوري: توجد مكالمات غير سليمة", {snapshot:r, deadCount:t, total:o, allDead:t === o && o > 0, timestamp:new Date().toISOString()}) : window.FOXY_DEBUG && window.foxyLog("info", "[Foxy][health] الفحص الدوري: كل المكالمات سليمة ✅", {calls:r.map(s => `${s.name||s.peer}:${s.ice}/${s.conn}`).join(", "), timestamp:new Date().toISOString()});

    t === o && o > 0 ? window._allDeadStreak = (window._allDeadStreak || 0) + 1 : window._allDeadStreak = 0, window._allDeadStreak >= 3 && (window._allDeadStreak = 0, "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.all_lost", "⚠️ انقطع الاتصال مع جميع المشاركين. جاري إعادة البناء..."), "warning"), rebuildPeer("all-calls-unhealthy-sustained-30s"))

  }, 1e4)
}

function stopConnectionHealthMonitor() {
  healthMonitorInterval && (clearInterval(healthMonitorInterval), healthMonitorInterval = null), stopMicPulse()
}
window.broadcastRtcStatus = broadcastRtcStatus, window.stopMicPulse = stopMicPulse, window.initPeer = initPeer, window.ensureLocalStream = ensureLocalStream, window.stopLocalStream = stopLocalStream, window.hardReset = hardReset, window.setupPeer = setupPeer, window.rebuildPeer = rebuildPeer, window.connections = connections, window.iceRestartAttempts = iceRestartAttempts;
let cameraPreviewStreams = [];
async function stopCameraPreviews() {
  cameraPreviewStreams.forEach(e => e.getTracks().forEach(e => e.stop())), cameraPreviewStreams = []
}
window.stopCameraPreviews = stopCameraPreviews, window.openCameraSelector = async function() {
  const e = document.getElementById("camera-selector-modal");
  e && e.classList.add("active"), await refreshMediaDevices()
}, window.closeCameraSelector = async function() {
  const e = document.getElementById("camera-selector-modal");
  e && e.classList.remove("active"), await stopCameraPreviews()
};
async function refreshMediaDevices() {
  try {
    await stopCameraPreviews();
    const e = (await getEnumerateDevices()).some(e => e.label);
    if (!localStream && !e) {
      try {
        (await navigator.mediaDevices.getUserMedia({
          audio: !0
        })).getTracks().forEach(e => e.stop())
      } catch (e) {}
      try {
        (await navigator.mediaDevices.getUserMedia({
          video: !0
        })).getTracks().forEach(e => e.stop())
      } catch (e) {}
      cachedDevices = null, lastDeviceEnumerateTime = 0
    }
    const t = await getEnumerateDevices(),
      sysDefMic = t.find(e => "audioinput" === e.kind && "default" === e.deviceId),
      o = t.filter(e => "audioinput" === e.kind && "default" !== e.deviceId && "communications" !== e.deviceId),
      n = document.getElementById("mic-options-container"),
      i = document.getElementById("current-mic-name");
    if (selectedMicId && "default" !== selectedMicId && "communications" !== selectedMicId && !o.some(e => e.deviceId === selectedMicId)) { selectedMicId = "default"; try { localStorage.setItem("selectedMicrophoneId", "default"); } catch (e) {} }
    const isDefMic = "default" === selectedMicId || "communications" === selectedMicId,
      sysDefMicLabel = sysDefMic && sysDefMic.label ? sysDefMic.label : window.__fb("js.mic_default", "الميكروفون الافتراضي"),
      defMicItem = `\n                        <div onclick="selectMediaDevice('default', 'mic')" class="custom-dropdown-item flex items-center justify-between gap-2 p-3 rounded-xl cursor-pointer ${isDefMic?"active":"hover:bg-white/5"}">\n                            <div class="flex items-center gap-3 min-w-0 flex-1">\n                                <div class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDefMic?"mic-active-dot":"bg-white/10"}"></div>\n                                <span class="text-[11px] font-bold break-all whitespace-normal ${isDefMic?"text-blue-400":"text-gray-300"}">${sysDefMicLabel} <span class="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-black">${window.__fb("js.sys_default_badge", "افتراضي")}</span></span>\n                            </div>\n                            ${isDefMic?'<svg class="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>':""}\n                        </div>`;
    n && (n.innerHTML = defMicItem + (0 === o.length ? '<div class="p-4 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest opacity-50">' + window.__fb("js.mic_none", "لا توجد ميكروفونات") + '</div>' : o.map(e => {
      const t = e.deviceId === selectedMicId;
      return `\n                        <div onclick="selectMediaDevice('${e.deviceId}', 'mic')" class="custom-dropdown-item flex items-center justify-between gap-2 p-3 rounded-xl cursor-pointer ${t?"active":"hover:bg-white/5"}">\n                            <div class="flex items-center gap-3 min-w-0 flex-1">\n                                <div class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${t?"mic-active-dot":"bg-white/10"}"></div>\n                                <span class="text-[11px] font-bold break-all whitespace-normal ${t?"text-blue-400":"text-gray-300"}">${e.label||window.__fb("js.mic_fb", "ميكروفون")}</span>\n                            </div>\n                            ${t?'<svg class="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>':""}\n                        </div>`
    }).join("")));
    const a = o.find(e => e.deviceId === selectedMicId);
    i && (i.removeAttribute("data-i18n"), i.innerText = isDefMic ? sysDefMicLabel : a ? a.label || window.__fb("js.mic_fb", "ميكروفون") : window.__fb("js.mic_default", "الميكروفون الافتراضي"));
    const sysDefSpk = t.find(e => "audiooutput" === e.kind && "default" === e.deviceId),
      r = t.filter(e => "audiooutput" === e.kind && "default" !== e.deviceId && "communications" !== e.deviceId),
      c = document.getElementById("speaker-options-container"),
      s = document.getElementById("current-speaker-name");
    if (selectedSpeakerId && "default" !== selectedSpeakerId && "communications" !== selectedSpeakerId && !r.some(e => e.deviceId === selectedSpeakerId)) { selectedSpeakerId = "default"; window.selectedSpeakerId = "default"; try { localStorage.setItem("selectedSpeakerId", "default"); } catch (e) {} }
    const isDefSpk = "default" === selectedSpeakerId || "communications" === selectedSpeakerId,
      sysDefSpkLabel = sysDefSpk && sysDefSpk.label ? sysDefSpk.label : window.__fb("js.spk_default", "جهاز الإخراج الافتراضي"),
      defSpkItem = `\n                        <div onclick="selectMediaDevice('default', 'speaker')" class="custom-dropdown-item flex items-center justify-between gap-2 p-3 rounded-xl cursor-pointer ${isDefSpk?"active":"hover:bg-white/5"}">\n                            <div class="flex items-center gap-3 min-w-0 flex-1">\n                                <div class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDefSpk?"speaker-active-dot":"bg-white/10"}"></div>\n                                <span class="text-[11px] font-bold break-all whitespace-normal ${isDefSpk?"text-blue-400":"text-gray-300"}">${sysDefSpkLabel} <span class="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-black">${window.__fb("js.sys_default_badge", "افتراضي")}</span></span>\n                            </div>\n                            ${isDefSpk?'<svg class="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>':""}\n                        </div>`;
    c && (c.innerHTML = defSpkItem + (0 === r.length ? '<div class="p-4 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest opacity-50">' + window.__fb("js.spk_none", "لا توجد سماعات") + '</div>' : r.map(e => {
      const t = e.deviceId === selectedSpeakerId;
      return `\n                        <div onclick="selectMediaDevice('${e.deviceId}', 'speaker')" class="custom-dropdown-item flex items-center justify-between gap-2 p-3 rounded-xl cursor-pointer ${t?"active":"hover:bg-white/5"}">\n                            <div class="flex items-center gap-3 min-w-0 flex-1">\n                                <div class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${t?"speaker-active-dot":"bg-white/10"}"></div>\n                                <span class="text-[11px] font-bold break-all whitespace-normal ${t?"text-blue-400":"text-gray-300"}">${e.label||window.__fb("js.spk_fb", "سماعة")}</span>\n                            </div>\n                            ${t?'<svg class="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>':""}\n                        </div>`
    }).join("")));
    const d = r.find(e => e.deviceId === selectedSpeakerId);
    s && (s.removeAttribute("data-i18n"), s.innerText = isDefSpk ? sysDefSpkLabel : d ? d.label || window.__fb("js.spk_fb", "سماعة") : window.__fb("js.spk_default", "جهاز الإخراج الافتراضي"));
    if (window.setAllAudioOutputs) { try { const _sp = window.setAllAudioOutputs(isDefSpk ? "" : selectedSpeakerId); _sp && _sp.catch && _sp.catch(() => {}); } catch (e) {} }
    const l = t.filter(e => "videoinput" === e.kind),
      u = document.getElementById("camera-preview-grid"),
      w = document.getElementById("current-camera-name"),
      m = l.find(e => e.deviceId === selectedCameraId) || l[0];
    if (w && (w.removeAttribute("data-i18n"), w.innerText = m ? m.label || window.__fb("js.cam_unknown", "كاميرا غير معروفة") : window.__fb("js.cam_none_found", "لم يتم العثور على كاميرا")), u)
      if (u.innerHTML = "", 0 === l.length) u.innerHTML = '\n                    <div class="col-span-2 p-8 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-gray-500">\n                        <svg class="w-8 h-8 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>\n                        <span class="text-xs font-bold">' + window.__fb("js.cam_none", "لا توجد كاميرات متاحة") + '</span>\n                    </div>';
      else
        for (const e of l) {
          const t = e.deviceId === selectedCameraId || "default" === selectedCameraId && 0 === l.indexOf(e),
            o = document.createElement("div");
          o.className = "camera-card group relative aspect-video bg-black rounded-2xl overflow-hidden border-2 transition cursor-pointer " + (t ? "border-blue-500 shadow-lg shadow-blue-500/20" : "border-white/5 hover:border-white/20"), o.onclick = () => {
            window.changeCamera(e.deviceId), window.showSettingsSaveBar && window.showSettingsSaveBar()
          }, o.innerHTML = `\n                        <video autoplay playsinline muted class="w-full h-full object-cover"></video>\n                        <div class="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">\n                            <p class="text-[10px] font-bold text-white truncate">${e.label||window.__fb("js.cam_fb", "كاميرا")}</p>\n                        </div>\n                        ${t?'\n                        <div class="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in">\n                            <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>\n                        </div>':""}\n                    `, u.appendChild(o);
          const n = document.getElementById("camera-selector-modal");
          if (n && n.classList.contains("active")) try {
            const t = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: {
                  exact: e.deviceId
                },
                width: 320,
                height: 180
              }
            });
            cameraPreviewStreams.push(t), o.querySelector("video").srcObject = t
          } catch (e) {
            o.innerHTML += '<div class="absolute inset-0 bg-red-500/10 flex items-center justify-center"><span class="text-[8px] font-bold text-red-400">' + window.__fb("js.mic_preview_fail", "فشل في المعاينة") + '</span></div>'
          }
        }
  } catch (e) {}
}
async function changeSpeaker(e) {
  if (selectedSpeakerId = e, window.selectedSpeakerId = e, localStorage.setItem("selectedSpeakerId", e), "setSinkId" in HTMLAudioElement.prototype) {
    const t = "default" === e || "communications" === e ? "" : e;
    await window.setAllAudioOutputs(t), addSystemMsg(window.__fb("js.spk_switched", "تم تبديل جهاز الإخراج بنجاح."))
  } else addSystemMsg(window.__fb("js.spk_unsupported", "تغيير جهاز الإخراج غير مدعوم في هذا المتصفح."), "error");
  refreshMediaDevices()
}
async function changeCamera(e) {
  selectedCameraId !== e && (selectedCameraId = e, localStorage.setItem("selectedCameraId", e), window.isCameraEnabled && (await refreshCameraCapture(), addSystemMsg(window.__fb("js.cam_switched", "تم تبديل الكاميرا بنجاح."))), window.closeCameraSelector && window.closeCameraSelector(), refreshMediaDevices())
}
async function changeMicrophone(e) {
  if (selectedMicId !== e || !localStream) {
    if (selectedMicId = e, localStorage.setItem("selectedMicrophoneId", e), localStream) try {
      const t = localStorage.getItem("noiseGateMode") || "ai-hybrid",
        o = ["ai-frozen", "ai-dynamic", "ai-obs", "ai-hybrid"].includes(t),
        n = document.getElementById("echo-cancel")?.checked ?? !0,
        i = !o && (document.getElementById("noise-suppress")?.checked ?? !0),
        a = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: "default" === e || "communications" === e ? void 0 : {
              exact: e
            },
            echoCancellation: n,
            noiseSuppression: i,
            autoGainControl: !o,
            googEchoCancellation: n,
            googExperimentalEchoCancellation: n,
            googAutoGainControl: !o,
            googExperimentalAutoGainControl: !o,
            googNoiseSuppression: i,
            googExperimentalNoiseSuppression: i,
            googHighpassFilter: !0,
            googAudioMirroring: !1
          }
        });
      let r = a;
      if (o && "function" == typeof applyAiNoiseSuppression) {
        const e = await applyAiNoiseSuppression(a, t);
        e && (r = e)
      }
      const c = r.getAudioTracks()[0];
      c.enabled = !isMuted;
      const s = localStream,
        d = Object.values(calls).map(e => {
          const t = e.peerConnection.getSenders().find(e => e.track && "audio" === e.track.kind);
          return t ? t.replaceTrack(c) : Promise.resolve()
        });
          await Promise.all(d), localStream = r, window.localStream = localStream, s && s !== r && s.getTracks().forEach(e => e.stop()), visualize(localStream, "me"), "function" == typeof window.checkHardwareMute && window.checkHardwareMute("switch"), addSystemMsg(window.__fb("js.mic_switched", "تم تبديل الميكروفون بنجاح."))
    } catch (e) {
      addSystemMsg(window.__fb("js.mic_switch_fail", "فشل في تبديل الميكروفون. تأكد من التوصيلات."), "error")
    }
    refreshMediaDevices()
  }
}
window.toggleMediaDropdown = function(e, t) {
  e && e.stopPropagation();
  const o = "mic" === t,
    n = document.getElementById(o ? "mic-dropdown-list" : "speaker-dropdown-list"),
    i = document.getElementById(o ? "mic-dropdown-arrow" : "speaker-dropdown-arrow");
  if (document.querySelectorAll(".custom-dropdown-list").forEach(e => {
      e !== n && e.classList.remove("active")
    }), document.querySelectorAll('[id$="-dropdown-arrow"]').forEach(e => {
      e !== i && (e.style.transform = "rotate(0deg)")
    }), n) {
    const e = n.classList.toggle("active");
    i && (i.style.transform = e ? "rotate(180deg)" : "rotate(0deg)")
  }
}, window.selectMediaDevice = function(e, t) {
  "mic" === t ? window.changeMicrophone(e) : window.changeSpeaker(e), window.showSettingsSaveBar && window.showSettingsSaveBar(), document.querySelectorAll(".custom-dropdown-list").forEach(e => e.classList.remove("active")), document.querySelectorAll('[id$="-dropdown-arrow"]').forEach(e => e.style.transform = "rotate(0deg)")
}, document.addEventListener("click", e => {
  e.target.closest(".relative") || (document.querySelectorAll(".custom-dropdown-list").forEach(e => e.classList.remove("active")), document.querySelectorAll('[id$="-dropdown-arrow"]').forEach(e => e.style.transform = "rotate(0deg)"))
}), window.refreshMicrophoneList = refreshMediaDevices, window.refreshMediaDevices = refreshMediaDevices, window.changeSpeaker = changeSpeaker, window.changeCamera = changeCamera, window.changeMicrophone = changeMicrophone;
let micTestStream = null,
  micTestInterval = null;
async function toggleMicTest() {
  const e = document.getElementById("mic-test-btn"),
    t = document.getElementById("mic-test-meter");
  if (e && t) {
    if (micTestStream) return stopMicTest(), e.innerText = window.__fb("js.mic_test", "فحص الميكروفون"), e.classList.remove("bg-red-500", "hover:bg-red-600"), e.classList.add("bg-blue-600", "hover:bg-blue-700"), void(t.style.width = "0%");
    try {
      e.innerText = window.__fb("js.mic_test_stop", "إيقاف الفحص"), e.classList.remove("bg-blue-600", "hover:bg-blue-700"), e.classList.add("bg-red-500", "hover:bg-red-600"), micTestStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: "default" !== selectedMicId ? {
            exact: selectedMicId
          } : void 0
        }
      }), micTestCtx = new(window.AudioContext || window.webkitAudioContext);
      const o = micTestCtx.createAnalyser(),
        n = micTestCtx.createMediaStreamSource(micTestStream);
      o.fftSize = 256, n.connect(o);
      const i = new Uint8Array(o.frequencyBinCount);
      micTestInterval = setInterval(() => {
        o.getByteFrequencyData(i);
        let e = 0;
        for (let t = 0; t < i.length; t++) e += i[t];
        const n = e / i.length,
          a = Math.min(100, n / 128 * 100);
        t.style.width = a + "%"
      }, 50)
    } catch (e) {
      stopMicTest(), addSystemMsg(window.__fb("js.mic_test_fail", "تعذر بدء فحص الميكروفون."), "error")
    }
  }
}

function stopMicTest() {
  if (micTestStream && (micTestStream.getTracks().forEach(e => e.stop()), micTestStream = null), micTestInterval && (clearInterval(micTestInterval), micTestInterval = null), micTestCtx) {
    try {
      micTestCtx.close()
    } catch (e) {}
    micTestCtx = null
  }
}
window.stopMicTest = stopMicTest, window.toggleMicTest = toggleMicTest, window.disconnectFromRoom = function() {
  // FIX: نسجّل مين سبناهم قبل ما نمسحهم ⇒ أي اتصال وارد منهم بعد المغادرة
  // يترفض (بيمنع ظهور بطاقة مشارك + بطاقة معاينة شاشة بعد ما نخرج).
  try {
    window.__foxyMarkLeftSessionPeers && window.__foxyMarkLeftSessionPeers(Array.from(new Set([
      ...Object.keys(connections || {}),
      ...Object.keys(calls || {})
    ])));
  } catch (_) {}
  window.reCallInProgress && window.reCallInProgress.clear(), "function" == typeof window.stopSessionTimer && window.stopSessionTimer(), "function" == typeof window.hideDmCallOverlay && window.hideDmCallOverlay(), "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.rtc_left_voice", "لقد غادرت الغرفة الصوتية.")), Object.values(calls).forEach(e => e.close()), Object.values(connections).forEach(e => e.conn.close()),
  // FIX: الـ mediaCall كان بيفضل مفتوح في الحالات اللي الـ conn هي DataConnection
  // (mediaCall منفصل) ⇒ الاتصال كان بيفضل شغال بعد المغادرة والطرف التاني بيعيد
  // إرسال intro فيرجع يظهر في قائمة المشاركين.
  Object.values(connections).forEach(e => { try { e.mediaCall && e.mediaCall !== e.conn && e.mediaCall.close && e.mediaCall.close(); } catch (_) {} }),
  "function" == typeof window.stopScreenShare && window.stopScreenShare(), "function" == typeof window.closeScreenView && window.closeScreenView(), "function" == typeof window.resetScreenSessionState && window.resetScreenSessionState(), isGuest = !1, currentHostId = "", window.currentHostId = "", window.isCameraEnabled = !1, void 0 !== isCameraEnabled && (isCameraEnabled = !1), "function" == typeof window.syncCameraUI && window.syncCameraUI(), window.updateMyRoomPresence && window.updateMyRoomPresence("");
  for (const e in connections) delete connections[e];
  for (const e in calls) delete calls[e];
  for (const e in reCallTimers) clearTimeout(reCallTimers[e]), delete reCallTimers[e];
  teardownAllPeerMedia("disconnectFromRoom");
  stopLocalStream(), stopCameraCapture(), "function" == typeof window.stopMicTest && window.stopMicTest(), releaseWakeLock();
  const e = document.getElementById("audios");
  e && (e.innerHTML = "");
  const t = document.getElementById("participants-list");
  t && (t.innerHTML = "");
  // FIX: بطاقات معاينة الشاشة (screen-share-card) كانت بتفضل في القائمة
  document.querySelectorAll("#participants-list .screen-share-card").forEach(card => card.remove());
  const o = document.getElementById("active-room-indicator");
  o && o.classList.add("hidden")
};
let shouldHaveWakeLock = !1,
  isRequestingWakeLock = !1;
async function requestWakeLock() {
  if (!isRequestingWakeLock && "wakeLock" in navigator) {
    isRequestingWakeLock = !0, shouldHaveWakeLock = !0;
    try {
      if (null !== wakeLock) return void(isRequestingWakeLock = !1);
      wakeLock = await navigator.wakeLock.request("screen"), wakeLock.addEventListener("release", () => {
        wakeLock && (wakeLock = null)
      })
    } catch (e) {
      e.name
    } finally {
      isRequestingWakeLock = !1
    }
  }
  startKeepAliveAudio()
}

function releaseWakeLock() {
  if (shouldHaveWakeLock = !1, null !== wakeLock) {
    const e = wakeLock;
    wakeLock = null, e.release().catch(e => {})
  }
  stopKeepAliveAudio()
}
let _keepAliveAudio = null;
function startKeepAliveAudio() {
  if (_keepAliveAudio) return;
  try {
    const e = new Audio();
    e.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAMA";
    e.loop = !0, e.volume = 0, e.play().then(() => {
      _keepAliveAudio = e
    }).catch(() => {})
  } catch (e) {}
}
function stopKeepAliveAudio() {
  if (_keepAliveAudio) {
    try {
      _keepAliveAudio.pause(), _keepAliveAudio.src = ""
    } catch (e) {}
    _keepAliveAudio = null
  }
}
window.startKeepAliveAudio = startKeepAliveAudio, window.stopKeepAliveAudio = stopKeepAliveAudio;
window.restoreLocalStreamIfNeeded = async function() {
  if (!window.myId) return;
  let needsNew = !1;
  if (localStream) {
    const e = localStream.getAudioTracks();
    needsNew = 0 === e.length || e.some(e => "ended" === e.readyState || e.muted)
  }
  if (!needsNew) {
    const hadCalls = Object.keys(calls).length > 0;
    if (!hadCalls || window.peer && (window.peer.disconnected || window.peer.destroyed)) {
      window.peer && (window.peer.disconnected || window.peer.destroyed) && "function" == typeof window.rebuildPeer && setTimeout(() => window.rebuildPeer("visibility-peer-disconnected"), 500)
    }
    Object.keys(calls).forEach(e => {
      const t = calls[e]?.peerConnection;
      if (t && ("failed" === t.iceConnectionState || "disconnected" === t.iceConnectionState || "failed" === t.connectionState)) {
        "function" == typeof window.reCallPeer && setTimeout(() => window.reCallPeer(e, "unhealthy-call-on-visibility"), 800)
      }
    });
    return
  }
  const hadCalls = Object.keys(calls).length > 0;
  stopLocalStream();
  try {
    await ensureLocalStream();
    const t = localStream.getAudioTracks()[0];
    if (t) {
      t.enabled = !isMuted;
      if (hadCalls) {
        Object.values(calls).forEach(e => {
          const n = e.peerConnection.getSenders().find(e => e.track && "audio" === e.track.kind);
          n && n.replaceTrack(t)
        });
        Object.keys(calls).forEach(e => {
          const n = calls[e]?.peerConnection?.getSenders().find(e => e.track && "audio" === e.track.kind);
          (!n || !n.track) && "function" == typeof window.reCallPeer && setTimeout(() => window.reCallPeer(e, "sender-missing-after-stream-swap"), 800)
        })
      }
    }
  } catch (e) {}
  if (window.peer && (window.peer.disconnected || window.peer.destroyed)) {
    "function" == typeof window.rebuildPeer && setTimeout(() => window.rebuildPeer("visibility-peer-disconnected-late"), 1500)
  }
}, document.addEventListener("visibilitychange", () => {
  if ("visible" === document.visibilityState) {
    shouldHaveWakeLock && null === wakeLock && requestWakeLock();
    window.restoreLocalStreamIfNeeded();
    !_keepAliveAudio && Object.keys(calls).length > 0 && startKeepAliveAudio()
  }
}), window.currentAudioOutput = localStorage.getItem("selectedAudioOutput") || "speaker", window.currentAudioOutputDeviceId = "", window.initAudioOutput = async function() {
  try {
    const e = (await navigator.mediaDevices.enumerateDevices()).filter(e => "audiooutput" === e.kind);
    if ("speaker" === window.currentAudioOutput) {
      const t = e.find(e => e.label.toLowerCase().includes("speaker") || e.label.toLowerCase().includes("loudspeaker") || e.label.toLowerCase().includes("مكبر"));
      window.currentAudioOutputDeviceId = t ? t.deviceId : ""
    } else window.currentAudioOutputDeviceId = ""
  } catch (e) {}
}, window.setAllAudioOutputs = async function(e) {
  if (!("setSinkId" in HTMLAudioElement.prototype)) return;
  const t = document.querySelectorAll("#audios audio");
  for (const o of t) try {
    await o.setSinkId(e)
  } catch (e) {}
}, window.toggleAudioOutput = async function() {
  const e = "speaker" === window.currentAudioOutput ? "phone" : "speaker";
  try {
    const t = (await navigator.mediaDevices.enumerateDevices()).filter(e => "audiooutput" === e.kind);
    let o = "";
    if ("speaker" === e) {
      const e = t.find(e => e.label.toLowerCase().includes("speaker") || e.label.toLowerCase().includes("loudspeaker") || e.label.toLowerCase().includes("مكبر"));
      e && (o = e.deviceId)
    } else o = "";
    return await window.setAllAudioOutputs(o), window.currentAudioOutput = e, localStorage.setItem("selectedAudioOutput", e), window.currentAudioOutputDeviceId = o, e
  } catch (e) {
    return window.currentAudioOutput
  }
}, window.initPeer = initPeer, window.setupPeer = setupPeer, window.ensureLocalStream = ensureLocalStream;
let aiAudioCtx = null,
  aiNoiseNode = null,
  aiGtcrnNode = null,
  aiGtcrnWasmBinary = null,
  aiGainNode = null,
  aiPreloadPromise = null,
  aiRawSourceStream = null,
  aiSourceNodes = [],
  aiApplying = !1,
  aiGeneration = 0;

window.gtcrnStatus = "idle";
window.gtcrnStatusDetail = "";
window.getGtcrnStatus = () => ({
  status: window.gtcrnStatus,
  detail: window.gtcrnStatusDetail
});

function preloadAiModule() {
  return aiPreloadPromise || (window.AudioContext || window.webkitAudioContext ? (aiPreloadPromise = (async () => {
    try {
      const e = new(window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48e3
      });
      "suspended" === e.state && await e.resume();

      await e.audioWorklet.addModule("assets/js/libs/gtcrn-processor.js?v=20260921-5");
      await e.close()
    } catch (e) {}
  })(), aiPreloadPromise) : null)
}
async function applyAiNoiseSuppression(e, t = "ai-hybrid") {
  const o = ++aiGeneration;
  if (aiApplying)
    for (let e = 0; e < 10 && (await new Promise(e => setTimeout(e, 200)), aiApplying); e++);
  if (o !== aiGeneration) return e;
  aiApplying = !0;
  try {
    if (!window.AudioContext && !window.webkitAudioContext) return e;
    if (aiAudioCtx && aiNoiseNode) try {
      if (aiSourceNodes.forEach(e => {
          try {
            e.disconnect()
          } catch (e) {}
        }), aiSourceNodes = [], aiRawSourceStream && aiRawSourceStream !== e) try {
        aiRawSourceStream.getTracks().forEach(e => e.stop())
      } catch (e) {}
      aiRawSourceStream = e, aiNoiseNode.disconnect(), aiGtcrnNode && aiGtcrnNode.disconnect(), aiGainNode && (aiGainNode.disconnect(), aiGainNode.gain.value = 0);
      const o = aiAudioCtx.createMediaStreamSource(e);
      aiSourceNodes.push(o), aiGainNode ? o.connect(aiGainNode) : o.connect(aiGtcrnNode || aiNoiseNode), aiGainNode && (aiGtcrnNode ? aiGainNode.connect(aiGtcrnNode).connect(aiNoiseNode) : aiGainNode.connect(aiNoiseNode));
      const n = aiAudioCtx.createMediaStreamDestination();
      return aiNoiseNode.connect(n), aiNoiseNode.port.postMessage({
        type: "setMode",
        mode: t
      }), aiGainNode && (aiGainNode.gain.setValueAtTime(0, aiAudioCtx.currentTime), aiGainNode.gain.linearRampToValueAtTime(1, aiAudioCtx.currentTime + .3)), n.stream
    } catch (e) {
      try {
        await aiAudioCtx.close()
      } catch (e) {}
      aiAudioCtx = null, aiNoiseNode = null, aiGtcrnNode = null, aiGainNode = null, aiRawSourceStream = null, aiSourceNodes = []
    }
    if (aiAudioCtx = new(window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48e3
      }), "suspended" === aiAudioCtx.state && await aiAudioCtx.resume(), o !== aiGeneration || "closed" === aiAudioCtx.state) return e;
    if (aiSourceNodes = [], aiRawSourceStream = e, aiPreloadPromise) try {
      await aiPreloadPromise
    } catch (e) {}
    if (o !== aiGeneration || "closed" === aiAudioCtx.state) return e;
    if (await aiAudioCtx.audioWorklet.addModule("assets/js/libs/gtcrn-processor.js?v=20260921-5"), await aiAudioCtx.audioWorklet.addModule("assets/js/libs/rnnoise-processor.js?v=20260921-5"), o !== aiGeneration || "closed" === aiAudioCtx.state) return e;
    if (!aiGtcrnWasmBinary) {
      const gtcrnResponse = await fetch("assets/js/libs/gtcrn.wasm", { cache: "force-cache" });
      if (!gtcrnResponse.ok) throw new Error(`GTCRN WASM HTTP ${gtcrnResponse.status}`);
      aiGtcrnWasmBinary = await gtcrnResponse.arrayBuffer();
    }
    aiGtcrnNode = new AudioWorkletNode(aiAudioCtx, "gtcrn-audio-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { wasmBinary: aiGtcrnWasmBinary }
    });
    window.gtcrnStatus = "loading";
    window.gtcrnStatusDetail = window.__fb("js.gtcrn_loading", "جاري تحميل نموذج GTCRN داخل AudioWorklet");
    aiGtcrnNode.port.onmessage = event => {
      if (event.data?.type === "ready") {
        window.gtcrnStatus = "ready";
        window.gtcrnStatusDetail = window.__fb("js.gtcrn_run", "GTCRN يعمل الآن بجانب RNNoise");
        window.foxyLog("info", "[Foxy][audio] GTCRN-WASM تم تحميله ويعمل بنجاح");
        "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.gtcrn_on", "🧠 GTCRN + RNNoise يعملان الآن"), "success");
      } else if (event.data?.type === "error") {
        window.gtcrnStatus = "failed";
        window.gtcrnStatusDetail = event.data.error || window.__fb("js.gtcrn_unknown_fail", "فشل غير معروف في تحميل GTCRN");
        window.foxyLog("error", "[Foxy][audio] فشل تحميل GTCRN-WASM", event.data.error);
        "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.gtcrn_fail", "⚠️ فشل GTCRN، يعمل RNNoise كبديل"), "warning");
      }
    };
    aiNoiseNode = new AudioWorkletNode(aiAudioCtx, "rnnoise-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1]
    }), aiGainNode = aiAudioCtx.createGain(), aiGainNode.gain.value = 0;
    const n = aiAudioCtx.createMediaStreamSource(e);
    aiSourceNodes.push(n), n.connect(aiGainNode), aiGainNode.connect(aiGtcrnNode).connect(aiNoiseNode);
    const i = aiAudioCtx.createMediaStreamDestination();
    aiNoiseNode.connect(i);
    const a = await new Promise(e => {
      let t = !1;
      const o = setTimeout(() => {
        t || (aiNoiseNode.port.postMessage("ping"), setTimeout(() => {
          t || (t = !0, e(!1))
        }, 2e3))
      }, 8e3);
      aiNoiseNode.port.onmessage = n => {
        "ready" === n.data?.type ? (clearTimeout(o), t = !0, e(n.data.success)) : "status" === n.data?.type && (clearTimeout(o), t = !0, e(n.data.ready))
      }
    });
    return o === aiGeneration && aiAudioCtx && "closed" !== aiAudioCtx.state ? a ? (aiGainNode.gain.setValueAtTime(0, aiAudioCtx.currentTime), aiGainNode.gain.linearRampToValueAtTime(1, aiAudioCtx.currentTime + .3), aiNoiseNode.port.postMessage({
      type: "setMode",
      mode: t
    }), "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.ai_noise_on", "🧠 عزل الضوضاء بالذكاء الاصطناعي يعمل الآن")), i.stream) : ("function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.ai_model_fail", "⚠️ فشل تحميل نموذج AI. تم الرجوع للعزل العادي."), "warning"), aiGainNode.gain.value = 1, i.stream) : e
  } catch (t) {
    if ("loading" === window.gtcrnStatus) {
      window.gtcrnStatus = "failed";
      window.gtcrnStatusDetail = t?.message || String(t);
      window.foxyLog("error", "[Foxy][audio] تعذر تشغيل GTCRN-WASM", t);
    }
    return "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.ai_noise_fail", "⚠️ فشل تفعيل عزل الذكاء الاصطناعي. سيتم استخدام العزل العادي."), "warning"), e
  } finally {
    aiApplying = !1
  }
}
window._lastHwMuteToast = window._lastHwMuteToast || 0;
window.checkHardwareMute = function(ctx) {
  try {
    const tr = window.localStream && window.localStream.getAudioTracks()[0];
    if (!tr) return false;
    if (!tr._foxyMuteHook) {
      tr._foxyMuteHook = true;
      tr.onmute = function() {
        try {
          const inVoice = (window.calls && Object.keys(window.calls).length) || (window.state && window.state.activeVoiceChannelId);
          if (inVoice && "function" == typeof window.showFoxyToast) window.showFoxyToast({ id: "hw-mute", tone: "error", title: window.__fb("js.hw_muted_t", "🔇 الميك اتقفل من الجهاز"), body: window.__fb("js.hw_muted_d", "نظام التشغيل أو السماعة كتمت الميكروفون — افتحه من زرار السماعة أو إعدادات الصوت."), duration: 8000 });
        } catch (_) {}
      };
      tr.onunmute = function() {
        try { const el = document.getElementById("foxy-toast-hw-mute"); el && el.remove(); } catch (_) {}
      };
    }
    if (tr.muted) {
      "function" == typeof window.showFoxyToast && window.showFoxyToast({ id: "hw-mute", tone: "error", title: window.__fb("js.hw_muted_join_t", "🎧 الميك مقفول من الجهاز أو السماعة"), body: window.__fb("js.hw_muted_join_d", "دخلت المكالمة والميك مكتوم من الزرار/النظام — محدش هيسمعك لحد ما تفتحه."), duration: 9000 });
      return true;
    }
    if (window.isMuted) return false;
    if (window.aiAudioCtx) return false;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      window._hwMuteCtx = window._hwMuteCtx || new AC();
      const cx = window._hwMuteCtx;
      if (cx.state === "suspended") cx.resume().catch(function() {});
      const src = cx.createMediaStreamSource(window.localStream);
      const an = cx.createAnalyser();
      an.fftSize = 64;
      src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      let peak = 0, runs = 0;
      const iv = setInterval(function() {
        try {
          if (cx.state !== "running") return;
          an.getByteFrequencyData(buf);
          let s = 0;
          for (let i = 0; i < buf.length; i++) s += buf[i];
          peak = Math.max(peak, s / buf.length);
          if (++runs >= 6) {
            clearInterval(iv);
            try { src.disconnect(); } catch (_) {}
            const cur = window.localStream && window.localStream.getAudioTracks()[0];
            if (cur && !cur.muted && !window.isMuted && peak < 1 && Date.now() - (window._lastHwMuteToast || 0) > 60000) {
              window._lastHwMuteToast = Date.now();
              "function" == typeof window.showFoxyToast && window.showFoxyToast({ id: "hw-mute", tone: "warn", title: window.__fb("js.hw_silent_t", "🔇 مفيش صوت واصل من الميك"), body: window.__fb("js.hw_silent_d", "الميك مفتوح بس مفيش أي صوت واصل — اتأكد أنه مش مكتوم من السماعة/الجهاز أو متوصل صح."), duration: 9000 });
            }
          }
        } catch (_) { try { clearInterval(iv); } catch (_) {} }
      }, 250);
    } catch (_) {}
  } catch (_) {}
  return false;
},
window.currentUserProfile && "function" == typeof initPeer && !document.body.classList.contains("in-settings") && initPeer(), window.stopAiNoiseSuppression = function() {
  if (aiGeneration++, aiSourceNodes.forEach(e => {
      try {
        e.disconnect()
      } catch (e) {}
    }), aiSourceNodes = [], aiAudioCtx && (aiAudioCtx.close().catch(() => {}), aiAudioCtx = null, aiNoiseNode = null, aiGtcrnNode = null, aiGainNode = null), aiRawSourceStream) {
    try {
      aiRawSourceStream.getTracks().forEach(e => e.stop())
    } catch (e) {}
    aiRawSourceStream = null
  }
}, window.applyAiNoiseSuppression = applyAiNoiseSuppression;

window._gentleNetRecovery = window._gentleNetRecovery || function(reason) {
  try {
    window.FOXY_DEBUG && window.foxyLog("info", "[Foxy][network] استعادة لطيفة بدون فصل", {reason: reason || "unknown", timestamp: new Date().toISOString()});
    if ("undefined" != typeof navigator && navigator.onLine === false) {
      window.updateSignalingStatus && window.updateSignalingStatus("reconnecting");
      return;
    }
    if (window.peer && !window.peer.destroyed && window.peer.disconnected) {
      try { window.peer.reconnect(); } catch (_) {}
    } else if ((!window.peer || window.peer.destroyed) && typeof window.rebuildPeer === "function") {
      window.rebuildPeer("gentle-recovery-peer-destroyed:" + (reason || "unknown"));
      return;
    }
    if (typeof window.refreshMyVoicePresence === "function" && window.myId) {
      try { window.refreshMyVoicePresence(); } catch (_) {}
    }
    Object.keys(window.calls || {}).forEach(function(pid) {
      try {
        const pc = window.calls[pid] && window.calls[pid].peerConnection;
        const ice = pc && pc.iceConnectionState;
        if (!pc || ice === "disconnected" || ice === "failed") {
          if (typeof window.reCallPeer === "function") window.reCallPeer(pid, "gentle-recovery:" + (reason || "unknown"));
        }
      } catch (_) {}
    });
    const src = window.currentScreenSource;
    if (src) {
      const v = document.getElementById("screen-video");
      const hasLiveVideoTrack = !!v?.srcObject?.getVideoTracks?.().some(track => track.readyState === "live" && !track.muted);
      if (!hasLiveVideoTrack || v.readyState < 2) {
        const sig = (window.uidToPeerIdMap && window.uidToPeerIdMap[src]) || src;
        try { window.sendSignalingCmd && window.sendSignalingCmd(sig, { type: "request-screen-peer-id" }); } catch (_) {}
        setTimeout(function() {
          if (window.currentScreenSource !== src) return;
          const vv = document.getElementById("screen-video");
          const hasLiveVideoTrack = !!vv?.srcObject?.getVideoTracks?.().some(track => track.readyState === "live" && !track.muted);
          if (hasLiveVideoTrack && vv.readyState >= 2) return;
          const sid = window._pendingScreenPeerId || (window.connections && (window.connections[sig] || {}) && (window.connections[sig] || {}).screenPeerId) || null;
          window._pendingScreenPeerId = null;
          if (sid && typeof window.joinScreenShare === "function") window.joinScreenShare(src, sid, { recoveryResume: true });
        }, 1500);
      }
    }
    if (window.isScreenSharing && window.currentScreenPeerId) {
      setTimeout(function() {
        if (!window.isScreenSharing || !window.currentScreenPeerId) return;
        Object.keys(window.connections || {}).forEach(function(pid) {
          try { window.sendSignalingCmd(pid, { type: "screen-ready", name: "function" == typeof window.__foxySelfDisplayName ? window.__foxySelfDisplayName() : window.myName, screenPeerId: window.currentScreenPeerId, screenQuality: window.getLocalScreenSourceQuality?.() }); } catch (_) {}
        });
      }, 1500);
    }
  } catch (_) {}
};
let _lastConnectionType = navigator.connection ? navigator.connection.type + "|" + navigator.connection.effectiveType : "unknown";
navigator.connection && navigator.connection.addEventListener("change", () => {
  const currentType = navigator.connection ? navigator.connection.type + "|" + navigator.connection.effectiveType : "unknown";
  const typeChanged = currentType !== _lastConnectionType;
  _lastConnectionType = currentType;
  window.foxyLog("warn", "[Foxy][network] المتصفح أطلق حدث تغيير في حالة الشبكة", {currentType, typeChanged, activeCalls:Object.keys(window.calls||{}).length, willHardReset:typeChanged && Object.keys(window.calls||{}).length > 0 && /none|slow-2g|offline/.test(currentType), timestamp:new Date().toISOString()});
  setTimeout(() => {
    if (typeChanged && Object.keys(window.calls || {}).length > 0) {
      const isSevere = /none|slow-2g|offline/.test(currentType) || currentType.includes("none");
      if (isSevere) {

        addSystemMsg?.(window.__fb("js.rtc_net_changed", "🔄 تم اكتشاف تغيير في الشبكة. جاري الاستعادة بدون فصل..."));
        "function" == typeof window._gentleNetRecovery && window._gentleNetRecovery("browser-connection-type-changed:" + currentType);
      } else {
        window.FOXY_DEBUG && window.foxyLog("info", "[Foxy][network] تغيير نوع الشبكة طفيف (4g↔3g) — recall بنفس الـTracks بدون restartIce", {currentType, activeCalls:Object.keys(window.calls||{}).length});
        Object.keys(window.calls||{}).forEach(_pid => {
          if (typeof window.reCallPeer === "function") try { window.reCallPeer(_pid, "network-type-flap-recall"); } catch(e) {}
        });
      }
      return;
    }
    "object" == typeof window.connections && Object.keys(window.connections).filter(e => {
      const t = window.calls?.[e],
        o = t?.peerConnection?.iceConnectionState;
      return "disconnected" === o || "failed" === o
    }).forEach(e => {
      "function" == typeof window.reCallPeer && window.reCallPeer(e, "network-change-unhealthy-call")
    })
  }, 2e3)
}), window.addEventListener("online", () => {
  window.foxyLog("warn", "[Foxy][network] المتصفح أطلق حدث online", {activeCalls:Object.keys(window.calls||{}).length, willHardReset:Object.keys(window.calls||{}).length > 0, timestamp:new Date().toISOString()});
  setTimeout(() => {

    "function" == typeof window._gentleNetRecovery && window._gentleNetRecovery("browser-online-event")
  }, 2e3)
});
if (navigator.mediaDevices) {
  // إعادة بناء المسار الصوتي بالكامل بعد تغيّر جهاز حقيقي.
  // مُنفصلة عن كشف التغيّر حتى نضمن استدعاءها من مسار واحد فقط.
  async function rebuildAfterDeviceChange() {
    cachedDevices = null, lastDeviceEnumerateTime = 0;
    const noiseMode = localStorage.getItem("noiseGateMode") || "ai-hybrid",
      isAiMode = ["ai-frozen", "ai-dynamic", "ai-obs", "ai-hybrid"].includes(noiseMode),
      echoOn = document.getElementById("echo-cancel")?.checked ?? !0,
      noiseOn = !isAiMode && (document.getElementById("noise-suppress")?.checked ?? !0),
      c = {
        audio: {
          deviceId: "default" !== selectedMicId ? { exact: selectedMicId } : void 0,
              echoCancellation: echoOn,
              noiseSuppression: noiseOn,
              autoGainControl: !isAiMode,
              channelCount: 1,
              latency: 0,
              googEchoCancellation: echoOn,
              googExperimentalEchoCancellation: echoOn,
              googAutoGainControl: !isAiMode,
              googExperimentalAutoGainControl: !isAiMode,
              googNoiseSuppression: noiseOn,
              googExperimentalNoiseSuppression: noiseOn,
              googHighpassFilter: !0,
              googAudioMirroring: !1
            }
          };
        try {
          let e = await navigator.mediaDevices.getUserMedia(c);
          if (isAiMode && "function" == typeof applyAiNoiseSuppression) {
            const t = await applyAiNoiseSuppression(e, noiseMode);
            t && (e = t)
          }
          const s = e.getAudioTracks()[0];
          s.enabled = !isMuted;
          const o = localStream,
            a = Object.values(calls).map(n => {
              const i = n.peerConnection.getSenders().find(e => e.track && "audio" === e.track.kind);
              return i ? i.replaceTrack(s) : Promise.resolve()
            });
          await Promise.all(a), localStream = e, window.localStream = localStream, o && o !== e && o.getTracks().forEach(e => e.stop()), visualize(localStream, "me"), addSystemMsg(window.__fb("js.rtc_devices_changed", "🔄 تم اكتشاف تغيير في أجهزة الصوت، تم تحديث الميكروفون."))
        } catch (e) {}
        refreshMediaDevices()
  }

  // ── كشف تغيّر الجهاز (بدون فتح المايك) ───────────────────────────────
  // ⛔ كان هنا: getUserMedia({audio:!0}) ثم مقارنة label ثم إيقاف التراكات.
  // أي أن كل حدث devicechange كان يفتح الميكروفون كاملاً (ظاهر كـ
  // getUserMedia في chrome://webrtc-internals — التوقيت 18:51:09 / 18:51:11 /
  // 18:51:49 في سجلك ثلاثة استدعاءات متتالية) لمجرد قراءة اسم الجهاز.
  //
  // ✅ الآن: نقرأ الأسماء من enumerateDevices() فقط — لا فتح مايك، ولا
  // إعادة بناء لسلسلة GTCRN+RNNoise بلا سبب.
  //
  // وأهم تصحيح: المنطق القديم كان يقارن اسم "الجهاز الافتراضي" باسم
  // تراكنا، فإذا كان المستخدم اختار جهازاً محدداً (غير الافتراضي) كانت
  // النتيجة دائماً "مختلف" ⇒ إعادة بناء كاملة عند كل حدث. نُصحَّح الآن:
  // نعيد البناء فقط إذا **جهازنا الحالي** اختفى فعلاً من النظام.
  let _deviceChangeTimer = null;
  navigator.mediaDevices.addEventListener("devicechange", () => {
    _deviceChangeTimer && (clearTimeout(_deviceChangeTimer), _deviceChangeTimer = null);
    _deviceChangeTimer = setTimeout(async () => {
      _deviceChangeTimer = null;
      if (!window.localStream) { try { await refreshMediaDevices(); } catch (e) {} return; }
      try {
        const tracks = window.localStream.getAudioTracks();
        // 1) تراك انتهى فعلاً ⇒ إعادة بناء
        if (tracks.some(tr => "ended" === tr.readyState)) { rebuildAfterDeviceChange(); return; }
        // 2) جهازنا الحالي لم يعد موجوداً في enumerateDevices() ⇒ إعادة بناء
        let inputs = [];
        try {
          inputs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audioinput");
        } catch (e) { inputs = []; }
        const curLabel = (tracks[0] && tracks[0].label) || "";
        const stillPresent = !curLabel || inputs.some(d => d.label === curLabel);
        if (stillPresent) {
          // لا شيء تغيّر: حدّث الواجهة فقط
          refreshMediaDevices();
        } else {
          if (window.FOXY_DEBUG) window.foxyLog("info", "[Foxy][audio] اختفى جهاز المايك الحالي — إعادة بناء", { label: curLabel });
          rebuildAfterDeviceChange();
        }
      } catch (e) {}
    }, 600);
  });
}
let _lastDetectedIPs = null;
let _networkCheckInterval = null;

// ⛔ كان: new RTCPeerConnection({iceServers:[Google STUN]}) + createOffer +
// setLocalDescription عند كل نبضة (كل 15 ثانية، للأبد). يعني اتصال WebRTC
// كامل مع تجميع ICE كامل، تظهر فوق المكالمات الحقيقية في
// chrome://webrtc-internals، وتتنافس معها على المعالج وخيط الواجهة والشبكة.
//
// ✅ الآن: نقرأ المرشح srflx من getStats() لاتصال موجود بالفعل. كل RTCPeerConnection
// تعمل الآن تحتوي أصلاً على local-candidate(candidateType=srflx) بعنوانك
// العام — فنحصل على نفس المعلومة بصفر اتصالات جديدة.
// ملاحظة أمان: مراقب تغيّر الشبكة لا يحتاج أن يعمل ولا مرة واحدة عند عدم
// وجود مكالمات، و_checkNetworkChange يرجع مبكراً في تلك الحالة أصلاً.
async function _detectLocalIPs() {
  var ips = [];
  try {
    var pools = [window.calls, window.connections];
    for (var p = 0; p < pools.length && !ips.length; p++) {
      var list = pools[p] || {};
      for (var peerId in list) {
        if (!Object.prototype.hasOwnProperty.call(list, peerId)) continue;
        var pc = (list[peerId] && list[peerId].peerConnection)
              || (list[peerId] && list[peerId].conn && list[peerId].conn.peerConnection);
        if (!pc || typeof pc.getStats !== 'function') continue;
        try {
          var report = await pc.getStats();
          report.forEach(function (s) {
            if (!s || s.type !== 'local-candidate') return;
            if (s.candidateType !== 'srflx' || !s.address) return;
            if (ips.indexOf(s.address) === -1) ips.push(s.address);
          });
        } catch (e) { /* اتجاه واحد فقط */ }
        if (ips.length) break;
      }
    }
  } catch (e) {}
  return ips;
}
let _networkChangeStrikes = 0;
async function _checkNetworkChange() {
  if (document.hidden || Object.keys(calls).length === 0) return;
  const current = await _detectLocalIPs();
  if (!current || current.length === 0) return;
  window.FOXY_DEBUG && window.foxyLog("info", "[Foxy][network] نتيجة فحص دوري لعناوين ICE العامة", {ips:current, previous:_lastDetectedIPs, strikes:_networkChangeStrikes, activeCalls:Object.keys(calls).length, timestamp:new Date().toISOString()});
  if (_lastDetectedIPs && _lastDetectedIPs.length > 0) {
    const changed = _lastDetectedIPs.some(ip => !current.includes(ip)) || current.some(ip => !_lastDetectedIPs.includes(ip));
    if (changed) {
      _networkChangeStrikes++;
      window.foxyLog("warn", "[Foxy][network] تغير مشتبه به في عناوين ICE العامة، بانتظار التأكيد قبل إعادة التشغيل", { previous: _lastDetectedIPs, current, strikes: _networkChangeStrikes });
      if (_networkChangeStrikes >= 2) {
        _networkChangeStrikes = 0;
        _lastDetectedIPs = current;
        addSystemMsg?.(window.__fb("js.rtc_net_changed2", "🔄 تم اكتشاف تغيير حقيقي في عنوان الشبكة (VPN/شبكة). جاري الاستعادة بدون إيقاف الشير..."));

        "function" == typeof rebuildPeer && rebuildPeer("network-ip-changed");
        setTimeout(() => { "function" == typeof window._gentleNetRecovery && window._gentleNetRecovery("network-ip-changed-late"); }, 4000);
        return;
      }
    } else {
      _networkChangeStrikes = 0;
    }
  }
  _lastDetectedIPs = current;
}
window._startNetworkMonitor = function() {
  if (_networkCheckInterval) return;
  // لا فحص عند البداية: لا مكالمات ⇒ لا local-candidate(srflx) جاهز،
  // وترك أي فحص هناك يعني إنشاء اتصال وهمي أو قراءة فارغة.
  // _checkNetworkChange يتخطى الدور كاملاً عند عدم وجود مكالمات.
  _networkCheckInterval = setInterval(_checkNetworkChange, 15000);
};
setTimeout(() => { "function" == typeof window._startNetworkMonitor && window._startNetworkMonitor(); }, 5000);
