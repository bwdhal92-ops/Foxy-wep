const MIC_ON_SVG = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><g><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line stroke-linecap="round" stroke-linejoin="round" stroke-width="2" x1="12" y1="19" x2="12" y2="22"></line></g></svg>',
  MIC_OFF_SVG = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><g><line stroke-linecap="round" stroke-linejoin="round" stroke-width="2" x1="2" y1="2" x2="22" y2="22"></line><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line stroke-linecap="round" stroke-linejoin="round" stroke-width="2" x1="12" y1="19" x2="12" y2="22"></line></g></svg>',
  DEAFEN_SVG = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 18v-6a9 9 0 0118 0v6M4 10a2 2 0 012 2v4a2 2 0 01-2 2H3a1 1 0 01-1-1v-7a1 1 0 011-1h1zm16 0h1a1 1 0 011 1v7a1 1 0 01-1 1h-1a2 2 0 01-2-2v-4a2 2 0 012-2z" /></svg>',
  DEAFEN_SVG_SLASH = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 18v-6a9 9 0 0118 0v6M4 10a2 2 0 012 2v4a2 2 0 01-2 2H3a1 1 0 01-1-1v-7a1 1 0 011-1h1zm16 0h1a1 1 0 011 1v7a1 1 0 01-1 1h-1a2 2 0 01-2-2v-4a2 2 0 012-2zM6 18L18 6M6 6l12 12" /></svg>',
  RESYNC_SVG = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>',
  SIGNAL_LED_SVG = '<circle cx="6" cy="6" r="4" fill="currentColor" />';

const FAILED_IMAGE_URLS_MAX = 500;
const _rawFailedImageUrls = window.failedImageUrls || new Set;
window.failedImageUrls = new Proxy(_rawFailedImageUrls, {
  get(t, p) {
    const v = t[p];
    return typeof v === "function" ? v.bind(t) : v;
  },
  set(t, p, v) {
    if (p === "add") {
      const before = t.size;
      t.add(v);

      if (t.size > FAILED_IMAGE_URLS_MAX) {
        const it = t.values();
        for (let n = t.size - FAILED_IMAGE_URLS_MAX; n > 0; n--) {
          const old = it.next().value;
          if (old === undefined) break;
          t.delete(old);
        }
      }
      void before;
      return true;
    }
    t[p] = v;
    return true;
  }
});
window.isAnimatedImageUrl = e => typeof e === "string" && /(?:^|[._-])gif(?:[._/?#]|$)/i.test(e);
window.isTurboActive = function() {
  try {
    if (document.body && document.body.classList.contains("mode-turbo")) return true;
    if (typeof localStorage !== "undefined" && localStorage.getItem("vh-turbo-mode") === "true") return true;
  } catch (_) {}
  return false;
};
window.isGifFreezeActive = function() {
  try {
    if (window._freezeGifsActive) return true;
    if (document.body && document.body.classList.contains("mode-turbo")) return true;
    if (typeof localStorage !== "undefined") {
      if (localStorage.getItem("vh-stop-gifs") === "true") return true;
      if (localStorage.getItem("vh-turbo-mode") === "true") return true;
    }
  } catch (_) {}
  return false;
};
window.getStaticAvatarSrc = function(url, size) {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (!/^https?:\/\//i.test(url)) return "";
  if (url.includes("ui-avatars.com")) return url;
  if (url.includes("wsrv.nl") || url.includes("images.weserv.nl")) return url;
  try {
    const s = Math.max(32, Math.min(512, Number(size) || 80));
    return "https://wsrv.nl/?url=" + encodeURIComponent(url) + "&w=" + s + "&h=" + s + "&fit=cover&output=webp";
  } catch (_) { return url; }
};
window.getOptimizedAvatar = (e) => {
  if (!e || "string" != typeof e) return e;
  if (e.startsWith("data:") || e.startsWith("blob:")) return e;
  if (/^https?:\/\//i.test(e)) return e;
  return "";
};
window.selectedBitrate = 48;
let timerInterval, callStartTime, currentCtxPeerId = null;
const chatMessages = document.getElementById("chat-messages"),
  nameInput = document.getElementById("user-name-input"),
  nameModal = document.getElementById("name-modal"),
  participantsList = document.getElementById("participants-list"),
  roomStatus = document.getElementById("room-status"),
  callBtn = document.getElementById("call-btn"),
  hangupBtn = document.getElementById("hangup-btn"),
  chatMsgInput = document.getElementById("chat-msg-input");
let uiInitialized = !1;

function initializeUI() {
  if (uiInitialized) return;
  uiInitialized = !0, window.currentUserProfile ? setupUserProfile() : document.addEventListener("UserProfileLoaded", () => {
    setupUserProfile()
  });
  const e = "true" === localStorage.getItem("voiceChat_forceRelay"),
    t = document.getElementById("force-relay");
  t && (t.checked = e, t.onchange = function() {
    localStorage.setItem("voiceChat_forceRelay", this.checked)
  });
  const n = document.getElementById("room-mode");
  n && (n.onchange = function() {
    if (window.myId !== window.currentHostId) return alert(window.__fb("js.room_private_warn", "فقط صاحب الغرفة يمكنه تغيير الخصوصية!")), void(this.value = roomMode || "public");
    window.roomMode = this.value, addSystemMsg(window.__f("js.room_now", {state: "public" === this.value ? window.__fb("js.room_open", "مفتوحة للجميع") : window.__fb("js.room_locked", "مغلقة (تحتاج موافقة)")}, "الغرفة الآن " + ("public" === this.value ? "مفتوحة للجميع" : "مغلقة (تحتاج موافقة)"))), Object.keys(connections).forEach(e => {
      sendSignalingCmd(e, {
        type: "sync",
        roomMode: window.roomMode
      })
    })
  }), "function" == typeof window.updateSliderTrack && window.updateSliderTrack(document.getElementById("bitrate-slider"))
  // ⛔ أُزيل استدعاء runNetworkDiagnostics() من هنا.
  // كان ينشئ RTCPeerConnection كامل + createDataChannel + createOffer +
  // تجميع ICE مقابل سيرفر STUN، عند كل تحديث لواجهة الإعدادات — أي أن
  // مجرد تحريك شريط البتريت كان يفتح PeerConnection حقيقية تتنافس مع
  // المكالمات الجارية على المعالج والنطاق والشبكة وعلى الخيط الرئيسي
  // (وهي تظهر كـ RTCPeerConnection إضافية في chrome://webrtc-internals).
  // لا يعتمد عليها أي سلوك:
  // هي مجرد console.warn عند فشل STUN. لذلك حُذفت الدالة معاً.
}

function setupUserProfile() {
  if (!window.currentUserProfile) return;
  const e = window.currentUserProfile;
  window.myName = e.fullTag;
  const t = e.displayName.charAt(0).toUpperCase(),
    n = e.photoURL,
    o = document.getElementById("my-name-tag"),
    i = document.getElementById("my-initial");
  o && (o.innerText = window.myName), i && (i.innerText = t);
  const r = document.getElementById("sidebar-initial"),
    a = document.getElementById("sidebar-avatar"),
    s = document.getElementById("rail-initial"),
    l = document.getElementById("rail-avatar"),
    d = document.getElementById("mobile-sidebar-initial"),
    c = document.getElementById("mobile-sidebar-avatar"),
    m = document.getElementById("current-user-email"),
    u = document.getElementById("mobile-current-user-email");
  m && (m.removeAttribute("data-i18n"), m.innerText = e.displayName), u && (u.removeAttribute("data-i18n"), u.innerText = e.displayName);

  const profileColor = "function" == typeof window.resolveProfileColor ? window.resolveProfileColor(e.uid || window.state?.myUid || e.displayName, e.avatarColor || e.bannerColor) : "";
  applyAvatarToPair(a, r, n, e.displayName, 80, profileColor, e.uid || e.displayName), applyAvatarToPair(l, s, n, e.displayName, 80, profileColor, e.uid || e.displayName), applyAvatarToPair(c, d, n, e.displayName, 80, profileColor, e.uid || e.displayName), n && setupGifHover("sidebar-avatar", "sidebar-avatar-animated", n);

  "function" == typeof window.setVoicePanelRoomLabel && window.setVoicePanelRoomLabel(), "function" == typeof initPeer && !document.body.classList.contains("in-settings") && initPeer()
}

function showLoading(e) {
  const t = document.getElementById("loading-overlay"),
    n = document.getElementById("loading-text");
  t && n && (n.innerText = e || window.__fb("app_loading.connecting", "جاري الاتصال بالسيرفر..."), t.style.display = "flex")
}

function hideLoading() {
  const e = document.getElementById("loading-overlay");
  e && (e.style.display = "none")
}

function startSessionTimer() {
  timerInterval && clearInterval(timerInterval), callStartTime = Date.now();
  const e = document.getElementById("session-timer");
  e && (e.classList.remove("hidden"), e.innerText = "00:00:00"), timerInterval = setInterval(updateTimerDisplay, 1e3)
}

function updateTimerDisplay() {
  const e = Date.now() - callStartTime,
    t = Math.floor(e / 36e5),
    n = Math.floor(e % 36e5 / 6e4),
    o = Math.floor(e % 6e4 / 1e3),
    i = document.getElementById("session-timer");
  i && (i.innerText = (t > 0 ? t.toString().padStart(2, "0") + ":" : "") + n.toString().padStart(2, "0") + ":" + o.toString().padStart(2, "0"))
}

function stopSessionTimer() {
  clearInterval(timerInterval);
  const e = document.getElementById("session-timer");
  e && (e.classList.add("hidden"), e.innerText = "00:00:00")
}
window.showMobileMainContent = () => document.body.classList.add("mobile-main-open"), window.showMobileSidePanels = () => document.body.classList.remove("mobile-main-open"), window.initializeUI = initializeUI, window.showLoading = showLoading, window.hideLoading = hideLoading, window.startSessionTimer = startSessionTimer, window.stopSessionTimer = stopSessionTimer, window.attachScrollAnchoring = e => {
  if (!e || e.hasScrollAnchoring) return;
  e.hasScrollAnchoring = !0, e.style.overflowAnchor = "none";
  let t = e.scrollHeight;
  const n = () => {
    if (window.__isLoadingMore) return;
    const n = e.scrollHeight;
    n !== t && ((e.scrollTop + e.clientHeight >= t - 150 || 0 === t) && (e.scrollTop = n), t = n)
  };

  const _scheduleAnchor = () => {
    if (e._anchorRaf) return;
    e._anchorRaf = requestAnimationFrame(() => {
      e._anchorRaf = null;
      n()
    })
  };
  new MutationObserver(() => {
    _scheduleAnchor()
  }).observe(e, {
    childList: !0,
    subtree: !0,
    attributes: !0,
    attributeFilter: ["class", "src", "style"]
  }), e.addEventListener("load", () => {
    _scheduleAnchor()
  }, !0), e.addEventListener("error", () => {
    _scheduleAnchor()
  }, !0), new ResizeObserver(() => {
    _scheduleAnchor()
  }).observe(e)
};
