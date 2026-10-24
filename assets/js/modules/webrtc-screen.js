let screenStream, screenStatInterval, screenViewers = new Set;
window.screenViewers = screenViewers;
const remoteScreenViewerLists = window._foxyRemoteScreenViewerLists || (window._foxyRemoteScreenViewerLists = new Map());
var screenHealthInterval = null;
window.screenHealthInterval = null;
let screenTraceSeq = 0;
let selectedScreenCodec = 'h264';
function screenTrace(e, t = {}) {
  const n = {
    seq: ++screenTraceSeq,
    event: e,
    screenPeerId: window.currentScreenPeerId || null,
    basePeer: window.peer ? {id:window.peer.id || null, open:!!window.peer.open, disconnected:!!window.peer.disconnected, destroyed:!!window.peer.destroyed} : null,
    sourceUid: window.currentScreenSource || null,
    sharing: !!window.isScreenSharing,
    videoTracks: screenStream?.getVideoTracks?.().map(e => ({state:e.readyState, muted:e.muted})) || [],
    audioTracks: screenStream?.getAudioTracks?.().map(e => ({state:e.readyState, muted:e.muted})) || [],
    viewers: screenViewers.size,
    timestamp: new Date().toISOString(),
    ...t
  };
  window.__screenTrace = (window.__screenTrace || []).concat(n).slice(-100);
  console.info("[Foxy][screen-trace]", n)
}
window.screenTrace = screenTrace;
let currentScreenSources = [],
  screenPickerResVal = 720;
async function replaceActiveScreenStream(e) {
  screenTrace("replace-stream-start");
  const t = e?.getVideoTracks?.()[0];
  if (!t || !screenStream) return !1;
  const n = screenStream;
  for (const peerId of screenViewers) {
    const call = window.calls?.[peerId];
    if (call) try { await window.replaceCallVideoTrack(call, t, "screen") } catch (error) {
      window.foxyLog?.("warn", "[Foxy][screen] تعذر تبديل مصدر الشاشة للمشارك", { peerId, message: error?.message });
    }
  }
  screenStream = e;
  window.localScreenStream = e;
  try {
    t.contentHint = parseInt(document.getElementById("screen-fps")?.value || "30") >= 30 ? "motion" : "detail"
  } catch (e) {}
  t.onended = () => stopScreenShare();
  n.getTracks().forEach(e => e.stop());
  addSystemMsg(window.__fb("js.screen_src_changed", "✅ تم تغيير مصدر مشاركة الشاشة"));
  return !0
}

async function changeActiveScreenResolution(e) {
  const t = parseInt(e), n = screenStream?.getVideoTracks?.()[0];
  if (!n || !t) return !1;
  const r = {
    360: [640, 360],
    480: [854, 480],
    720: [1280, 720],
    1080: [1920, 1080],
    1440: [2560, 1440],
    2160: [3840, 2160]
  }[t] || [1920, 1080];
  try {
    await n.applyConstraints({
      width: { ideal: r[0], max: r[0] },
      height: { ideal: r[1], max: r[1] },
      frameRate: { ideal: parseInt(document.getElementById("screen-fps")?.value || "30") }
    });
    // 720p محتاج ~4.5Mbps و1080p ~8Mbps عشان مايبقاش فيها blocks.
    // MIN_NORMAL اتحطَّل أعلى (.7x) عشان أول تنازل مايهبطش لجودة سيئة،
    // وMAX 1.7x يعطي مجال أعلى للشبكات القوية.
    const i = { 360: 1400, 480: 2500, 720: 4500, 1080: 8000, 1440: 12000, 2160: 16000 }[t] || 4500;
    SCREEN_BITRATE.START = i;
    SCREEN_BITRATE.MIN_NORMAL = Math.round(i * .7);
    SCREEN_BITRATE.MIN = Math.max(800, Math.round(i * .22));
    SCREEN_BITRATE.MAX = Math.round(i * 1.7);
    screenViewers.forEach(peerId => {
      const call = window.calls?.[peerId];
      call?.peerConnection && applyBitrateCeiling(call, i)
    });
    const o = document.getElementById("screen-res");
    o && (o.value = String(t));
    window.broadcastScreenSourceQuality?.();
    addSystemMsg(window.__f("js.screen_res_changed", {r: t}, `✅ تم تغيير دقة مشاركة الشاشة إلى ${t}p`));
    return !0
  } catch (e) {
    addSystemMsg(window.__fb("js.screen_res_locked", "⚠️ هذا المصدر لا يسمح بتغيير الدقة أثناء المشاركة"), "warning");
    return !1
  }
}

function openScreenSourceSwitcher() {
  if (!window.isScreenSharing || !screenStream) return;
  const e = document.getElementById("screen-quality-btn") || document.getElementById("stop-screen-btn");
  let t = document.getElementById("screen-resolution-menu");
  if (t) return t.remove();
  t = document.createElement("div");
  t.id = "screen-resolution-menu";
  t.className = "screen-resolution-menu";
  t.innerHTML = `<div class="screen-resolution-title">${window.__fb("web.h007", "جودة المشاركة")}</div>${[360,480,720,1080,1440,2160].map(e => `<button type="button" data-resolution="${e}">${e}p</button>`).join("")}`;
  document.body.appendChild(t);
  const n = e?.getBoundingClientRect();
  n && (t.style.top = `${Math.min(window.innerHeight - t.offsetHeight - 10, n.bottom + 8)}px`, t.style.left = `${Math.max(10, n.left + n.width - t.offsetWidth)}px`);
  t.querySelectorAll("[data-resolution]").forEach(e => e.addEventListener("click", async () => {
    await changeActiveScreenResolution(e.dataset.resolution);
    t.remove()
  }));
  setTimeout(() => document.addEventListener("click", function n(e) {
    t.contains(e.target) || (t.remove(), document.removeEventListener("click", n))
  }, { once: !0 }), 0)
}

window.openScreenSourceSwitcher = openScreenSourceSwitcher;

function prioritizeCodecsInSDP(e) {
  if (!e) return e;
  const t = e.split("\r\n");
  let n = -1;
  const r = [],
    i = [];
  for (let e = 0; e < t.length; e++) {
    const o = t[e];
    if (o.startsWith("m=video ") && (n = e), o.startsWith("a=rtpmap:")) {
      const e = o.match(/^a=rtpmap:(\d+)\s+(\w+)\//i);
      if (e) {
        const t = e[1],
          n = e[2].toUpperCase();
        "H264" === n ? r.push(t) : "AV1" === n && i.push(t)
      }
    }
  }
  if (-1 === n) return e;
  const o = t[n].split(" ");
  if (o.length < 4) return e;
  const c = o.slice(0, 3),
    a = o.slice(3),
    s = [...i, ...r],
    d = a.filter(e => !s.includes(e)),
    l = [...c, ...s, ...d].join(" ");
  return t[n] = l, t.join("\r\n")
}

function hookPeerConnectionSDP(e) {
  if (!e || e._sdpHooked) return;
  let t = !1;
  if (e.getTransceivers && "undefined" != typeof RTCRtpSender && RTCRtpSender.getCapabilities) try {
    const n = RTCRtpSender.getCapabilities("video");
    if (n && n.codecs) {
      const r = [selectedScreenCodec, ...["h264", "av01", "vp9", "vp8"].filter(c => c !== selectedScreenCodec)],
        i = [...n.codecs].sort((e, t) => {
          const n = e.mimeType.toLowerCase().split("/")[1],
            i = t.mimeType.toLowerCase().split("/")[1],
            o = r.indexOf(n),
            c = r.indexOf(i);
          return (-1 === o ? 999 : o) - (-1 === c ? 999 : c)
        });
      e.getTransceivers().forEach(e => {
        e.sender && e.sender.track && "video" === e.sender.track.kind && (e.setCodecPreferences(i), t = !0)
      })
    }
  } catch (e) {}
  if (t) e._sdpHooked = !0;
  else if (e._sdpHooked = !0, e.setLocalDescription) {
    const t = e.setLocalDescription;
    e.setLocalDescription = async function(n) {
      try {
        return n && n.sdp && (n.sdp = prioritizeCodecsInSDP(n.sdp)), await t.apply(e, [n])
      } catch (e) {
        throw e
      }
    }
  }
}
// افتراضيات أعلى: البixelation في ثوانت الألعاب سببه الأكبر bitrate قليل
// بالنسبة للدقة/الحركة. الرفع من START (بدل MIN) معناه: نبدأ عالي،
// والحلقة التكيفية تنزل فقط لو فيه فقدان/تأخر فعلي — فالشبكة القوية
// تاخد جودة نظيفة، والضعيفة تتنازل تلقائياً زي ما كانت.
let SCREEN_BITRATE = {
  MAX: 10000,
  START: 6000,
  MIN_NORMAL: 3000,
  MIN: 1200,
  RECOVER: 1.05,
  CHECK_INTERVAL: 1e3
};
const viewerBitrateState = new Map;
let screenShareStarting = !1;
window._screenShareStarting = !1;
window.SCREEN_BITRATE = SCREEN_BITRATE;
window.__foxyScreenShareState = {
  getStream: () => screenStream,
  setStream: stream => { screenStream = stream || null; window.localScreenStream = stream || null; },
  setStarting: value => { screenShareStarting = !!value; window._screenShareStarting = !!value; },
  getStarting: () => screenShareStarting
};

function screenShareErrorReason(e) {
  const name = e && e.name || "";
  const insecure = !window.isSecureContext;
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return {
        tone: "warn",
        title: window.__fb("js.ss_err_denied_t", "🚫 المermission مرفوضة للمشاركة"),
        body: insecure
          ? window.__fb("js.ss_err_https", "الموقع مش شغال على HTTPS — مشاركة الشاشة محتاجة اتصال آمن. جرّب تشغّله على localhost أو HTTPS.")
          : window.__fb("js.ss_err_denied_b", "متاحك رفضت المشاركة، أو المتصفح طلب إذن ورفضته. جرّب تاني وتأكد إنك داخل الغرفة الصوتية."),
        err: e
      };
    case "NotSupportedError":
      return (() => {
        const why = screenShareUnsupportedReason();
        return {
          tone: "error",
          title: why.title,
          body: why.body,
          err: e
        };
      })();
    case "NotFoundError":
    case "DevicesNotFoundError":
      return {
        tone: "error",
        title: window.__fb("js.ss_err_nosource_t", "❗ مفيش مصدر شاشة"),
        body: window.__fb("js.ss_err_nosource_b", "المتصفح مالقيش شاشة أو نافذة تنشارك. جرّب تاني بعد ما تفتح حاجة على الشاشة." ),
        err: e
      };
    case "NotReadableError":
    case "TrackStartError":
      return {
        tone: "error",
        title: window.__fb("js.ss_err_busy_t", "🔒 الشاشة مشغولة"),
        body: window.__fb("js.ss_err_busy_b", "تطبيق تاني بيستخدم الكاميرا/الشاشة. اقفل أي تطبيقshare شغال و جرّب تاني." ),
        err: e
      };
    case "InvalidStateError":
      return {
        tone: "warn",
        title: window.__fb("js.ss_err_state_t", "⚠️ الحالة غلط"),
        body: window.__fb("js.ss_err_state_b", "المتصفح رفض الطلب في الحالة الحالية. تأكد إنك داخل الغرفة الصوتية و جرّب تاني." ),
        err: e
      };
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return {
        tone: "warn",
        title: window.__fb("js.ss_err_res_t", "⚙️ الجودة دي مش متاحة"),
        body: window.__fb("js.ss_err_res_b", "جرّب جودة أقل (360p أو 480p) — الموبايل غالبًا مش بيقبل الدقة العالية في المشاركة." ),
        err: e
      };
    case "AbortError":
      return {
        tone: "warn",
        title: window.__fb("js.ss_err_abort_t", "⛔ المشاركة اتلغت"),
        body: window.__fb("js.ss_err_abort_b", "المتصفح أوقف طلب المشاركة. جرّب تاني." ),
        err: e
      };
    case "TypeError":
      return {
        tone: "error",
        title: window.__fb("js.ss_err_type_t", "🧩 إعدادات غير مدعومة"),
        body: insecure
          ? window.__fb("js.ss_err_https2", "الموقع مش HTTPS — مشاركة الشاشة معطلة أصلاً على الاتصال غير الآمن." )
          : window.__fb("js.ss_err_type_b", "المتصفح رفض_constraints المشاركة. جرّب جودة أقل أو فرمت للمتصفح." ),
        err: e
      };
    default:
      return {
        tone: "error",
        title: window.__fb("js.ss_err_fail_t", "⚠️ فشل بدء مشاركة الشاشة"),
        body: (e && e.message) || String(e || ""),
        err: e
      };
  }
}

function reportScreenShareError(e) {
  const info = screenShareErrorReason(e);
  console.error("[Foxy][screen-share] فشل:", e, info);
  if ("function" == typeof addSystemMsg)
    addSystemMsg(window.__fb("js.screen_start_fail", "⚠️ فشل بدء مشاركة الشاشة") + (e && e.name ? ` (${e.name})` : ""), "error");
  if ("function" == typeof window.showFoxyToast)
    window.showFoxyToast({ id: "screen-share-error", tone: info.tone, title: info.title, body: info.body, duration: 12000 });
  else if ("function" == typeof window.uiAlert)
    window.uiAlert((info.title || "") + "\n" + (info.body || ""));
  return info;
}

window.foxyScreenShareDiagnostics = function() {
  const md = navigator.mediaDevices;
  const ua = navigator.userAgent;
  const chromeVer = (ua.match(/(?:Chrome|CriOS)\/(\d+)/) || [])[1] || null;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  const inApp = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|BytedanceWebview|Twitter|Instagram/i.test(ua);
  return {
    secureContext: !!window.isSecureContext,
    hasMediaDevices: !!md,
    hasGetDisplayMedia: !!(md && md.getDisplayMedia),
    isMobileUA: /iPhone|iPad|iPod|Android/i.test(ua),
    isAndroid,
    isIOS: isIOS,
    isAndroid: isAndroid,
    inAppBrowser: inApp,
    chromeVersion: chromeVer,
    maxTouchPoints: navigator.maxTouchPoints,
    innerWidth: window.innerWidth,
    standalone: !!(navigator.standalone || window.matchMedia("(display-mode: standalone)").matches),
    electron: !!window.electronAPI && !(window.FoxyNativeApp && window.FoxyNativeApp.isAndroidApp),
    androidApp: !!(window.FoxyNativeApp && window.FoxyNativeApp.isAndroidApp),
    stuck: !!window._screenShareStarting,
    protocol: location.protocol,
    host: location.host,
    ua: ua
  };
};

function screenShareUnsupportedReason() {
  const d = window.foxyScreenShareDiagnostics ? window.foxyScreenShareDiagnostics() : {};
  if (!window.isSecureContext) {
    return {
      title: "🔒 الموقع مش على HTTPS",
      body: `أنت على ${location.protocol}// — المتصفح بيمنع مشاركة الشاشة نهائياً إلا على HTTPS. اطلب رابط https من الموقع.`,
      canUploadInstead: true
    };
  }
  if (d.inAppBrowser) {
    return {
      title: "📱 متصفح جوّه تطبيق",
      body: "المتصفح الداخلي (فيسبوك/انستجرام/واتساب) بيمنع مشاركة الشاشة. افتح نفس الرابط في Chrome مباشرة.",
      canUploadInstead: true
    };
  }
  if (d.androidApp) {
    return {
      title: "📱 مشاركة الشاشة غير جاهزة في هذا الإصدار",
      body: "حدّث تطبيق Foxy لآخر إصدار من داخل التطبيق، ثم أعد المحاولة. النسخة الحالية لا تحتوي على محرك المشاركة الأصلية.",
      canUploadInstead: true
    };
  }
  if (d.isAndroid) {
    return {
      title: "📱 كروم على أندرويد ما بيشاركش الشاشة",
      body: "دي محدودية في نظام أندرويد نفسه — كروم على الموبايل بيوفّر الكاميرا والميك بس مش شاشة الجهاز، فمفيش أي تحديث أو إعداد هيحلها. الحل: افتح الموقع على الكمبيوتر، أو استخدم التطبيق، أو صوّر الشاشة وارفعها كصورة من زرار 📎.",
      canUploadInstead: true
    };
  }
  if (d.isIOS) {
    return {
      title: "📱 iOS / iPadOS ما بيشاركش الشاشة",
      body: "سفاري على iOS ما بيقدّمش مشاركة شاشة كاملة. الحل: افتح الموقع على الكمبيوتر، أو استخدم التطبيق، أو صوّر الشاشة وارفعها كصورة من زرار 📎.",
      canUploadInstead: true
    };
  }
  return {
    title: "📱 مشاركة الشاشة غير مدعومة على هذا المتصفح",
    body: "المتصفح آمن (HTTPS ✓) لكنه بيوفّرش getDisplayMedia. الحل: افتح الموقع على الكمبيوتر، أو جرّب متصفح تاني.",
    canUploadInstead: true
  };
}
window.foxyScreenShareUnsupportedReason = screenShareUnsupportedReason;

window.foxyMarkScreenShareButton = function () {
  const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  if (supported) return true;
  const isTouch = window.foxyIsHandheld ? window.foxyIsHandheld() : /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024);
  if (!isTouch) return false;
  const title = "مشاركة الشاشة غير متاحة على موبايل المتصفح — صوّر الشاشة وارفعها كصورة";
  ["mobile-screen-btn", "mobile-screen-btn-main", "integrated-screen-btn", "start-screen-trigger"]
    .forEach(id => {
      const b = document.getElementById(id);
      if (b) b.title = title;
    });
  return false;
};

async function startScreenShare() {

  const localShareActive = !!(screenShareStarting || screenStream?.getVideoTracks?.().some(e => "ended" !== e.readyState));
  if (localShareActive) {
    "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.screen_active_busy", "⚠️ مشاركة الشاشة مفعّلة بالفعل أو ما زالت قيد البدء."), "warning");
    return
  }
  screenShareStarting = !0;
  window._screenShareStarting = !0;
  setTimeout(() => {
    screenShareStarting && !screenStream && (screenShareStarting = !1, window._screenShareStarting = !1)
  }, 6e4);
  const e = document.getElementById("screen-res").value,
    t = document.getElementById("screen-fps").value,
    n = parseInt(e),
    r = window.foxyIsHandheld ? window.foxyIsHandheld() : /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0 && window.innerWidth <= 1024,
    i = {
      video: !!r || {
        width: {
          ideal: {
            2160: 3840,
            1440: 2560,
            1080: 1920,
            720: 1280,
            480: 854,
            360: 640
          } [n] || 1920
        },
        height: {
          ideal: n
        },
        frameRate: {
          ideal: parseInt(t)
        }
      },
      //FIX: getDisplayMedia بياخد `audio` كـ boolean مش كـ constraints object.
      //قيود المايكروفون (echoCancellation / googTypingNoiseDetection) هنا بتخلّي
      //المتصفح يتجاهل مسار الصوت بالكامل ⇒ audioTracks: Array(0) ⇒ مفيش صوت
      //شير خالص والسلايدر ميبقاش ليه تأثير. لازم: audio: true + systemAudio.
      audio: !r
    },
    o = `screen-${window.myId||Math.floor(1e5+9e5*Math.random()).toString()}-${Date.now()}`,
    c = parseInt(t),
    a = {
      360: {
        15: [80, 100, 300, 600],
        30: [100, 200, 500, 1e3],
        60: [150, 400, 800, 1500]
      },
      480: {
        15: [150, 200, 500, 1200],
        30: [200, 400, 1e3, 2e3],
        60: [300, 800, 1800, 3e3]
      },
      720: {
        15: [300, 500, 1200, 2500],
        30: [400, 900, 1500, 3500],
        60: [500, 1500, 3500, 5500]
      },
      1080: {
        15: [500, 1e3, 2500, 5e3],
        30: [600, 1500, 3500, 6500],
        60: [800, 2500, 5500, 8500]
      },
      1440: {
        15: [800, 2e3, 4500, 8e3],
        30: [1e3, 3e3, 7e3, 12e3],
        60: [1200, 5e3, 11e3, 18e3]
      },
      2160: {
        15: [1500, 4e3, 8e3, 15e3],
        30: [2e3, 6e3, 12e3, 22e3],
        60: [3e3, 1e4, 2e4, 35e3]
      }
    } [n]?.[c] || [1e3, 2e3, 4e3, 6e3];
  //FIX: Chrome 122+ — من غير systemAudio:"include" المتصفح بيعرض خيار
  //"مشاركة صوت التبويب" بس (وليس صوت النظام) فالشاشة بتيجي بدون صوت خالص
  //والسلايدر ميبقى مالهوش تأثير. الخيارات دي بتخلي المتصفح يعرض خيار
  //مشاركة صوت النظام (حسب دعم النظام).
  if (!r) {
    try {
      i.systemAudio = "include";
      i.selfBrowserSurface = "include";
      i.surfaceSwitching = "include";
      i.preferCurrentTab = false;
    } catch (_) {}
  }
  console.info("[Foxy][screen-share] بدء مشاركة الشاشة", {
    sourcePeerId: o,
    resolution: n,
    fps: c,
    mobile: r,
    requestedAudio: !!i.audio,
    systemAudioRequested: i.systemAudio || null,
    timestamp: new Date().toISOString()
  });
  SCREEN_BITRATE.MIN = a[0], SCREEN_BITRATE.MIN_NORMAL = a[1], SCREEN_BITRATE.START = a[2], SCREEN_BITRATE.MAX = a[3];
  try {
    if (window.electronAPI && !(window.FoxyNativeApp && window.FoxyNativeApp.isAndroidApp)) {
      await window.electronAPI.getScreenSources();
      const e = document.getElementById("screen-sources-container"),
        t = document.getElementById("screen-picker-modal");
      if (e && t) return currentScreenSources = await window.electronAPI.getScreenSources(), screenPickerResVal = n, t.classList.remove("hidden"), void switchScreenPickerTab("window");
      screenStream = await navigator.mediaDevices.getDisplayMedia(i)
    } else {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {

        screenShareStarting = !1, window._screenShareStarting = !1;
        const d = window.foxyScreenShareDiagnostics ? window.foxyScreenShareDiagnostics() : {};
        const err = d.secureContext === false
          ? { name: "TypeError", message: window.__fb("js.ss_err_https3", "getDisplayMedia غير متاح: الموقع مش على HTTPS.") }
          : { name: "NotSupportedError", message: window.__fb("js.ss_err_noapi", "getDisplayMedia غير متاح في هذا المتصفح.") };
        console.error("[Foxy][screen-share] getDisplayMedia غير مدعوم", d);
        "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.screen_unsupported", "⚠️ متصفحك الحالي لا يدعم ميزة مشاركة الشاشة"), "error");
        reportScreenShareError(err);
        return
      }
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia(i)
      } catch (e) {
        if (!i.audio) throw e;
        console.warn("[Foxy][screen-share] تعذر طلب صوت مشاركة الشاشة، إعادة المحاولة بدون صوت", e);
        i.audio = !1, screenStream = await navigator.mediaDevices.getDisplayMedia(i)
      }
    }
    console.info("[Foxy][screen-share] تم الحصول على MediaStream", {
      videoTracks: screenStream?.getVideoTracks?.().map(e => ({readyState:e.readyState, label:e.label, settings:e.getSettings?.()})),
      audioTracks: screenStream?.getAudioTracks?.().map(e => ({readyState:e.readyState, label:e.label, settings:e.getSettings?.()}))
    });
    //FIX: لو طلبنا صوت بس المتصفح رجّع 0 track ⇒ مفيش صوت شير خالص والسلايدر
    //مش هيعمل حاجة. نقول للمستخدم يفعّل "مشاركة صوت النظام/التبويب" من نافذة
    //الاختيار بدل ما يفتكر إن التطبيق باظ.
    if (i.audio && !screenStream?.getAudioTracks?.().length) {
      window.foxyLog?.("warn", "[Foxy][screen-share] مشاركة الشاشة اتعملت بدون مسار صوت", {
        requestedAudio: true,
        systemAudioRequested: i.systemAudio || null,
        hint: "فعّل خيار 'مشاركة صوت النظام/التبويب' من نافذة اختيار الشاشة",
        timestamp: new Date().toISOString()
      });
      addSystemMsg?.(window.__fb("js.screen_no_audio", "⚠️ مشاركة الشاشة بدون صوت — فعّل 'مشاركة صوت النظام' من نافذة الاختيار"), "warning");
    }
    startAdaptiveBitrateMonitor();
    window.finalizeScreenShare ? window.finalizeScreenShare(o) : finalizeScreenShare(o)
  } catch (e) {

    screenShareStarting = !1, window._screenShareStarting = !1;
    screenStream && screenStream.getTracks().forEach(t => { try { t.stop() } catch (_) {} });
    screenStream = null;
    reportScreenShareError(e);
  }
}

function finalizeScreenShare() { return false; }

function handleScreenJoinRequest() { return false; }

function switchScreenPickerTab(e) {
  const t = document.getElementById("sp-tab-windows"),
    n = document.getElementById("sp-tab-screens"),
    r = document.getElementById("screen-sources-container");
  t && n && r && ("window" === e ? (t.className = "flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 bg-blue-600 text-white shadow-lg shadow-blue-500/20", n.className = "flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 text-gray-400 hover:text-white hover:bg-white/5") : (n.className = "flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 bg-blue-600 text-white shadow-lg shadow-blue-500/20", t.className = "flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 text-gray-400 hover:text-white hover:bg-white/5"), renderScreenSources(e))
}

function renderScreenSources(e) {
  const t = document.getElementById("screen-sources-container");
  if (!t) return;
  for (; t.firstChild;) t.firstChild.onclick && (t.firstChild.onclick = null), t.removeChild(t.firstChild);
  const n = currentScreenSources.filter(t => "window" === e ? t.id.startsWith("window:") : t.id.startsWith("screen:"));
  if (0 === n.length) return void(t.innerHTML = `<div class="col-span-2 py-10 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">${window.__f("js.no_sources", {what: "window"===e?window.__fb("js.src_windows", "نوافذ مفتوحة"):window.__fb("js.src_screens", "شاشات متصلة")}, `لا يوجد ${"window"===e?"نوافذ مفتوحة":"شاشات متصلة"} حالياً`)}</div>`);
  const r = {
      2160: 3840,
      1440: 2560,
      1080: 1920,
      720: 1280,
      480: 854,
      360: 640
    },
    i = document.getElementById("screen-fps")?.value || "30",
    o = `screen-${window.myId||"anonymous"}`;
  n.forEach(e => {
    const n = document.createElement("div");
    n.className = "group relative bg-[#0d0e13]/40 rounded-[1.5rem] overflow-hidden border border-white/5 hover:border-blue-500 transition-all cursor-pointer hover:shadow-2xl hover:shadow-blue-500/10 active:scale-[0.98]", n.innerHTML = `\n            <div class="aspect-video w-full bg-black/40 flex items-center justify-center overflow-hidden border-b border-white/5">\n                <img src="${e.thumbnail}" class="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700">\n            </div>\n            <div class="p-4 bg-[#2b2d31]/50 backdrop-blur-sm">\n                <p class="text-[10px] font-black text-gray-300 truncate tracking-tight uppercase">${e.name}</p>\n            </div>\n        `, n.onclick = async () => {
      document.getElementById("screen-picker-modal").classList.add("hidden");
      try {
        const previousScreenStream = screenStream;
        screenStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: "desktop",
              echoCancellation: !0,
              noiseSuppression: !0,
              autoGainControl: !0
            }
          },
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: e.id,
              maxWidth: r[screenPickerResVal] || 1920,
              maxHeight: screenPickerResVal,
              maxFrameRate: parseInt(i)
            }
          }
        }), window.isScreenSharing
          ? window.replaceActiveScreenStream?.(screenStream, previousScreenStream)
          : (window.finalizeScreenShare ? window.finalizeScreenShare(o) : finalizeScreenShare(o))
      } catch (e) {
        addSystemMsg(window.__fb("js.screen_src_fail", "⚠️ فشل الاتصال بالمصدر المختار"), "error")
      }
    }, t.appendChild(n)
  })
}

function updateScreenSenderParameters(sender, update) {
  if (typeof window.updateSenderEncodingParameters === "function") {
    return window.updateSenderEncodingParameters(sender, update);
  }
  const apply = async (includeNetworkPriority, includePriority) => {
    const params = sender.getParameters();
    if (!params.encodings || !params.encodings.length) params.encodings = [{}];
    update(params, includeNetworkPriority, includePriority);
    await sender.setParameters(params);
  };
  return apply(true, true).catch(async error => {
    try {
      await apply(false, true);
    } catch (_) {
      try { await apply(false, false); } catch (_) { throw error; }
    }
  });
}

function setupAdaptiveBitrate(e) {
  e && e.peerConnection && (hookPeerConnectionSDP(e.peerConnection), viewerBitrateState.set(e.peer, {
    currentBitrate: SCREEN_BITRATE.START,
    stableCount: 0,
    lastBytesSent: 0,
    lastTimestamp: 0,
    lastPacketsLost: 0,
    lastPacketsSent: 0,
    consecutiveStableCycles: 0,
    dbrLoweredTimeout: 0,
    avgRtt: 0,
    rttHistory: [],
    _fpsCap: parseInt(document.getElementById("screen-fps")?.value || "30"),
    _scaled: !1
  }), setTimeout(() => {
    e.peerConnection && e.peerConnection.getSenders().forEach(t => {
      if (t.track && "video" === t.track.kind) {
        const r = document.getElementById("screen-fps"),
          i = r ? parseInt(r.value) : 30;
        updateScreenSenderParameters(t, (n, includeNetworkPriority, includePriority) => {
          n.encodings[0].maxBitrate = Math.round(1e3 * SCREEN_BITRATE.START);
          n.encodings[0].maxFramerate = i;
          if (includePriority) n.encodings[0].priority = "low";
          else delete n.encodings[0].priority;
          if (includeNetworkPriority) n.encodings[0].networkPriority = "low";
          else delete n.encodings[0].networkPriority;
          n.degradationPreference = "maintain-framerate";
        }).catch(t => {
          applyBitrateCeiling(e, SCREEN_BITRATE.START)
        })
      }
    })
  }, 100))
}
window.handleScreenJoinRequest = handleScreenJoinRequest, window.switchScreenPickerTab = switchScreenPickerTab;
let lastQualitySent = {};

// kbps = هدف البت رايت (كيلوبت/ث) — null يتركه زي ما هو.
// scale = تصغير الدقة (2 = نص الدقة) — 1 أو null = بدون تصغير.
// fps = سقف الفريمات — null يتركه زي ما هو.
function applyBitrateCeiling(e, t, n, fps) {
  if (!e || !e.peerConnection) return;
  const r = Date.now(),
    i = t >= .8 * SCREEN_BITRATE.MAX ? "good" : t >= .4 * SCREEN_BITRATE.MAX ? "fair" : "poor",
    o = e.peer.split("-")[1] || e.peer,
    c = lastQualitySent[o];
  (!c || c.level !== i || r - c.time > 3e3) && (lastQualitySent[o] = {
    level: i,
    time: r
  }, window.connections && window.connections[o] && window.connections[o].conn && window.connections[o].conn.open && window.connections[o].conn.send({
    type: "stream-quality",
    level: i,
    bitrate: Math.round(t)
  })), e.peerConnection.getSenders().forEach(e => {
    if (e.track && "video" === e.track.kind) {
      updateScreenSenderParameters(e, (r, includeNetworkPriority, includePriority) => {
        r.encodings && r.encodings.length || (r.encodings = [{}]);
        if (includePriority) r.encodings[0].priority = "low";
        else delete r.encodings[0].priority;
        if (includeNetworkPriority) r.encodings[0].networkPriority = "low";
        else delete r.encodings[0].networkPriority;
        // Keep the current bitrate when no new ceiling was requested.
        Number.isFinite(t) && t > 0 && (r.encodings[0].maxBitrate = Math.round(1e3 * t));
        r.degradationPreference = "maintain-framerate";
        // scaleResolutionDownBy should be an integer for broad Chromium compatibility.
        n && n > 1 && (r.encodings[0].scaleResolutionDownBy = n) || n === 1 && delete r.encodings[0].scaleResolutionDownBy;
        Number.isFinite(fps) && fps > 0 && (r.encodings[0].maxFramerate = fps);
      }).catch(() => {});
    }
  })
}

function applyBitrate(e, t) {
  applyBitrateCeiling(e, t)
}

function stopScreenShare() {
  stopAdaptiveBitrateMonitor();
  return false;
}
let isJoiningScreen = !1;
function hasRenderableScreenTrack(video) {
  return !!video && video.readyState >= 2
    && !!video.srcObject?.getVideoTracks?.().some(track => track.readyState === "live" && !track.muted);
}
async function waitForPeerJsReady(e = 15000) {
  const t = Date.now();
  while (Date.now() - t < e) {
    const n = window.peer;
    if (!n || n.destroyed || n.open) return !0;
    if (n.disconnected) try { n.reconnect?.() } catch (e) {}
    await new Promise(e => setTimeout(e, 250))
  }
  console.warn("[Foxy][screen-join] انتهت مهلة انتظار خادم PeerJS قبل إنشاء Peer المشاهدة", {
    peerOpen: !!window.peer?.open,
    peerDisconnected: !!window.peer?.disconnected,
    timestamp: new Date().toISOString()
  });
  return !1
}
function recoverScreenSignalingConnection(e) {
  const sourceUid = window.connections?.[e]?.uid || window.peerIdToUidMap?.[e] || e,
    replacement = Object.entries(window.connections || {}).find(([t, n]) => t !== e && n?.uid === sourceUid && n.conn?.open),
    presenceReplacement = Object.entries(window.state?.activeChannelPresenceMap || {}).find(([t, n]) => t === sourceUid && n?.connected && n.peerId && n.peerId !== e),
    t = replacement?.[0] || presenceReplacement?.[1]?.peerId || window.uidToPeerIdMap?.[e] || e,
    n = window.connections?.[t],
    r = n?.name || window.__fb("js.participant", "المشارك");
  if (t !== e && n?.conn?.open) {
    console.info("[Foxy][screen-join] تم العثور على Peer بديل لنفس المستخدم", {oldPeerId:e, newPeerId:t, uid:sourceUid});
    return t
  }
  if (n?.conn?.open) return t;
  console.warn("[Foxy][screen-join] قناة البيانات غير متصلة، محاولة استعادتها", {sourceId:e, peerId:t, uid:sourceUid, hadStaleConnection:!!n, pending:!!window.pendingConnections?.has(t)});
  if (n && n.conn && !n.conn.open) try { n.conn.close() } catch (e) {}
  if (window.connections?.[t] && !window.connections[t].conn?.open) delete window.connections[t];
  if (typeof window.schedulePeerDial === "function" && !window.pendingConnections?.has(t)) {

    try { window.schedulePeerDial(t, r, "screen-reconnect") } catch (e) { console.error("[Foxy][screen-join] فشل طلب استعادة قناة البيانات", e) }
  } else if (typeof window.connectToPeer === "function" && !window.pendingConnections?.has(t)) {
    try { window.connectToPeer(t, r, "screen-reconnect") } catch (e) { console.error("[Foxy][screen-join] فشل طلب استعادة قناة البيانات", e) }
  }
  return t
}
function logScreenJoinFailure(e, t, n = {}) {
  const s = window.uidToPeerIdMap?.[e] || e;
  const r = {
    sourceUid: e,
    peerId: t,
    reason: n.reason || "unknown",
    retry: n.retry || 0,
    dataChannelOpen: !!(window.connections && window.connections[s]?.conn?.open),
    knownScreenPeerId: window.connections && window.connections[s]?.screenPeerId || null,
    currentScreenSource: window.currentScreenSource || null,
    timestamp: new Date().toISOString()
  };
  console.error("[Foxy][screen-join] فشل فتح مشاهدة البث", r);
  window.__lastScreenJoinFailure = r;
  window.__screenJoinFailures = (window.__screenJoinFailures || []).concat(r).slice(-10);
  try {
    localStorage.setItem("foxy:last-screen-join-failure", JSON.stringify(r))
  } catch (e) {}
  try {
    window.dispatchEvent(new CustomEvent("foxy:screen-join-failed", { detail: r }))
  } catch (e) {}
}
window._screenRemoteStoppedAt = window._screenRemoteStoppedAt || 0;
window._pendingScreenResume = window._pendingScreenResume || null;
window._lastScreenAutoResumeAt = window._lastScreenAutoResumeAt || 0;
window._currentScreenPeerIdRequested = window._currentScreenPeerIdRequested || null;

window._autoResumeScreenOnNewId = function(peerKey, newScreenId) {
  try {
    const src = window.currentScreenSource;
    if (!src || !newScreenId) return;
    const uidOfKey = (window.peerIdToUidMap && window.peerIdToUidMap[peerKey]) || null;
    const peerOfSrc = (window.uidToPeerIdMap && window.uidToPeerIdMap[src]) || null;
    const same = (peerKey === src) || (uidOfKey && uidOfKey === src) || (peerOfSrc && peerOfSrc === peerKey) || (window.connections?.[peerKey]?.uid === src);
    if (!same) return;
    if (window._currentScreenPeerIdRequested === newScreenId) {
      const _v = document.getElementById("screen-video");
      if (hasRenderableScreenTrack(_v)) return;
    }
    if (Date.now() - (window._lastScreenAutoResumeAt || 0) < 5000) return;
    window._lastScreenAutoResumeAt = Date.now();
    console.info("[Foxy][screen-watch] معرف بث جديد من المشارك — إعادة اتصال تلقائية", {sourceUid: src, newScreenId, timestamp: new Date().toISOString()});
    if (typeof window.joinScreenShare === "function") window.joinScreenShare(src, newScreenId, { recoveryResume: true });
  } catch(_){}
};

window._onScreenSignalingReopened = function(peerId) {
  try {
    const pending = window._pendingScreenResume;
    if (!window.currentScreenSource && pending && pending.sourceUid) {
      const sig = (window.uidToPeerIdMap && window.uidToPeerIdMap[pending.sourceUid]) || pending.sourceUid;
      if (sig === peerId || peerId === pending.sourceUid) {
        window._pendingScreenResume = null;
        const sid = window.connections?.[sig]?.screenPeerId || window._pendingScreenPeerId || null;
        if (sid && typeof window.joinScreenShare === "function") window.joinScreenShare(pending.sourceUid, sid, { recoveryResume: true });
        else try { sendSignalingCmd(sig, {type:"request-screen-peer-id"}); } catch(_){}
      }
      return;
    }
    const src = window.currentScreenSource;
    if (!src) {
      const uidOf = key => window.peerIdToUidMap?.[key] || window.connections?.[key]?.uid || key;
      const inlinePeer = [...(window._foxyInlineScreenPeers || [])]
        .find(key => key === peerId || uidOf(key) === uidOf(peerId));
      if (inlinePeer && typeof window.joinScreenShare === "function") {
        const resolved = window.resolveScreenShareCallPeerId?.(inlinePeer) || inlinePeer;
        const call = window.calls?.[resolved];
        if (call) delete call._foxyScreenJoinRequestedAt;
        window.joinScreenShare(resolved, null, { inline: true, recoveryResume: true });
      }
      return;
    }
    const uidOfKey = (window.peerIdToUidMap && window.peerIdToUidMap[peerId]) || null;
    const peerOfSrc = (window.uidToPeerIdMap && window.uidToPeerIdMap[src]) || null;
    const same = (peerId === src) || (uidOfKey && uidOfKey === src) || (peerOfSrc && peerOfSrc === peerId) || (window.connections?.[peerId]?.uid === src);
    if (!same) return;
    const v = document.getElementById("screen-video");
    if (hasRenderableScreenTrack(v)) return;
    window._pendingScreenPeerId = null;
    try { sendSignalingCmd(peerId, { type: "request-screen-peer-id" }); } catch(_){}
    setTimeout(() => {
      if (window.currentScreenSource !== src) return;
      const vv = document.getElementById("screen-video");
      if (hasRenderableScreenTrack(vv)) return;
      const sid = window._pendingScreenPeerId || window.connections?.[peerId]?.screenPeerId || window.connections?.[src]?.screenPeerId || null;
      window._pendingScreenPeerId = null;
      if (sid && typeof window.joinScreenShare === "function") window.joinScreenShare(src, sid, { recoveryResume: true });
    }, 1200);
  } catch(_){}
};
window._screenJoinStartAt = window._screenJoinStartAt || 0;

function shouldKeepWaitingScreen(sourceUid, retry) {
  try {
    if (window._screenRemoteStoppedAt && Date.now() - window._screenRemoteStoppedAt < 30000) return false;

    if ("undefined" != typeof navigator && navigator.onLine === false) return true;
    const elapsed = Date.now() - (window._screenJoinStartAt || Date.now());
    if (elapsed > 180000) return false;
    const sig = (window.uidToPeerIdMap && window.uidToPeerIdMap[sourceUid]) || sourceUid;
    const conn = (window.connections && (window.connections[sig] || window.connections[sourceUid])) || null;
    if (conn && (conn.screenActive || (conn.conn && conn.conn.open))) return true;
    const presence = window.state && window.state.activeChannelPresenceMap && window.state.activeChannelPresenceMap[sourceUid];
    if (presence && presence.connected) return true;
    if (elapsed < 60000) return true;
    return false;
  } catch (_) { return retry < 10; }
}
function screenRetryDelayMs(retry) {
  return Math.min(2000 + (retry || 0) * 800, 8000);
}
async function joinScreenShare() { return false; }

async function checkScreenFrozen() {
  try {
    const pc = window.calls?.[window.currentScreenSource]?.peerConnection;
    if (!pc || pc.connectionState === "closed" || pc.connectionState === "failed" || pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed") {
      window._screenFreeze = { streak: 0, lastDecoded: -1 };
      window._handleDeadScreen(!pc ? "no-pc" : ("pc-" + (pc.iceConnectionState || pc.connectionState)));
      return;
    }
    const stats = await pc.getStats();
    let dec = -1;
    stats.forEach(s => { if (s && "inbound-rtp" === s.type && "video" === s.kind && "undefined" != typeof s.framesDecoded) dec = s.framesDecoded; });
    const F = window._screenFreeze = window._screenFreeze || { streak: 0, lastDecoded: -1 };
    if (dec >= 0 && F.lastDecoded >= 0 && dec === F.lastDecoded) {
      F.streak++;
      if (F.streak >= 3) {
        F.streak = 0;
        window._handleDeadScreen("frozen-frames");
      }
    } else {
      F.streak = 0;
      if (dec >= 0) F.lastDecoded = dec;
    }
  } catch (_) {}
}
function startScreenHealthMonitor(e) {
  stopScreenHealthMonitor();
  let t = 0,
    n = 0;
  window._screenFreeze = { streak: 0, lastDecoded: -1 };
  window.screenHealthInterval = setInterval(() => {
    if (e && e.srcObject) {
      if (e.currentTime === t && e.readyState >= 2 ? (n++, n >= 3 && (e.buffered && e.buffered.length > 0 && (e.currentTime = e.buffered.end(e.buffered.length - 1) - .1), n = 0)) : n = 0, t = e.currentTime, e.buffered && e.buffered.length > 0) {
        const t = e.buffered.end(e.buffered.length - 1);
        t - e.currentTime > 8 && (e.currentTime = t - 1.5)
      }
      window.calls?.[window.currentScreenSource]?.peerConnection && logReceiverStats(window.calls?.[window.currentScreenSource]?.peerConnection)
      try { checkScreenFrozen(); } catch (_) {}
    } else if (window.currentScreenSource && !isJoiningScreen) {
      window._handleDeadScreen("no-stream-element");
    } else stopScreenHealthMonitor()
  }, 4e3)
}

function stopScreenHealthMonitor() {
  window.screenHealthInterval && (clearInterval(window.screenHealthInterval), window.screenHealthInterval = null)
}
window.startScreenHealthMonitor = startScreenHealthMonitor;
window.stopScreenHealthMonitor = stopScreenHealthMonitor;
let lastReceiverStats = {
  framesDecoded: 0,
  framesDropped: 0,
  timestamp: 0,
  totalFreezesDuration: 0,
  totalFreezesCount: 0,
  bytesReceived: 0,
  packetsLost: 0,
  jitter: 0
};
window.__screenPerfLog = window.__screenPerfLog || [];
async function logReceiverStats(e) {
  try {
    const stats = await e.getStats();
    let inbound = null;
    stats.forEach(s => { if ("inbound-rtp" === s.type && "video" === s.kind) inbound = s; });
    if (!inbound) return;
    const now = inbound.timestamp;
    const dt = (now - lastReceiverStats.timestamp) / 1e3;
    if (dt > 0 && lastReceiverStats.timestamp > 0) {
      const decodedDelta = (inbound.framesDecoded || 0) - lastReceiverStats.framesDecoded;
      const droppedDelta = (inbound.framesDropped || 0) - lastReceiverStats.framesDropped;
      const bytesDelta = (inbound.bytesReceived || 0) - lastReceiverStats.bytesReceived;
      const freezeDurDelta = (inbound.totalFreezesDuration || 0) - lastReceiverStats.totalFreezesDuration;
      const freezeCntDelta = (inbound.totalFreezesCount || 0) - lastReceiverStats.totalFreezesCount;
      const packetsLostDelta = (inbound.packetsLost || 0) - lastReceiverStats.packetsLost;
      const fps = decodedDelta / dt;
      const dropRate = (decodedDelta + droppedDelta) > 0 ? (droppedDelta / (decodedDelta + droppedDelta) * 100) : 0;
      const bitrateKbps = bytesDelta * 8 / dt / 1000;
      const jitterMs = (inbound.jitter || 0) * 1000;
      const width = inbound.frameWidth || 0, height = inbound.frameHeight || 0;
      const freezesPerMin = freezeCntDelta / dt * 60;

      let reason = "good";
      if (fps < 12 && dropRate < 10) reason = "sender-cpu-or-encode-limit";
      else if (dropRate > 12) reason = "packet-loss-or-congestion";
      else if (jitterMs > 60) reason = "jitter-high";
      else if (freezeDurDelta > 800) reason = "freeze-long";
      else if (bitrateKbps < 350 && (width >= 1280)) reason = "bitrate-too-low-for-resolution";
      else if (fps < 18) reason = "low-fps";
      const isWeak = dropRate > 10 || fps < 15 || freezeDurDelta > 500 || jitterMs > 80 || packetsLostDelta > 15;
      const level = isWeak ? "poor" : dropRate > 5 || fps < 22 ? "fair" : "good";
      const entry = {
        fps: fps.toFixed(1),
        dropRate: dropRate.toFixed(1) + "%",
        bitrateKbps: Math.round(bitrateKbps),
        resolution: width ? `${width}x${height}` : "unknown",
        jitterMs: Math.round(jitterMs),
        freezeDurMs: Math.round(freezeDurDelta),
        freezeCount: freezeCntDelta,
        packetsLostDelta,
        reason,
        level,
        timestamp: new Date().toISOString()
      };
      window.__screenPerfLog.push(entry);
      if (window.__screenPerfLog.length > 80) window.__screenPerfLog.shift();

      const shouldLog = isWeak || (Date.now() % 12000 < 4100);
      if (shouldLog) {
        console.info("[Foxy][screen-perf][viewer]", {
          ...entry,
          isWeakNet: isWeak,
          hint: isWeak ? (reason === "sender-cpu-or-encode-limit" ? window.__fb("js.q_hint_cpu", "المُرسل محدود CPU/ترميز — قلل الدقة") : reason === "bitrate-too-low-for-resolution" ? window.__fb("js.q_hint_bitrate", "البت رايت منخفض للدقة — سيخفض الدقة تلقائياً") : window.__fb("js.q_hint_net", "شبكة المشاهد ضعيفة — سيُخفض البت رايت تلقائياً لمنع التقطيع")) : window.__fb("js.q_hint_stable", "مستقر"),
          peerId: window.calls?.[window.currentScreenSource] ? "active" : "unknown"
        });

        if (typeof window.updateScreenQualityIndicator === "function" && isWeak) {
          try { window.updateScreenQualityIndicator(level, Math.round(bitrateKbps)); } catch(_){}
        }
      }
    }
    lastReceiverStats = {
      framesDecoded: inbound.framesDecoded || 0,
      framesDropped: inbound.framesDropped || 0,
      timestamp: now,
      totalFreezesDuration: inbound.totalFreezesDuration || 0,
      totalFreezesCount: inbound.totalFreezesCount || 0,
      bytesReceived: inbound.bytesReceived || 0,
      packetsLost: inbound.packetsLost || 0,
      jitter: inbound.jitter || 0
    };
  } catch (err) {}
}

function closeScreenView() {}

const SCREEN_VOLUME_ICON_ON = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5 6 9H3v6h3l5 4V5z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.5 8.5a5 5 0 010 7m2.5-9.5a9 9 0 010 12"/>';
const SCREEN_VOLUME_ICON_OFF = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5 6 9H3v6h3l5 4V5z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M22 9l-6 6m0-6l6 6"/>';
function updateScreenAudioControlState(muted) {
  const isMuted = typeof muted === "boolean" ? muted : !!(window._foxyScreenAudioMuted ?? false);
  const icon = document.getElementById("screen-volume-icon");
  if (icon) {
    icon.innerHTML = isMuted ? SCREEN_VOLUME_ICON_OFF : SCREEN_VOLUME_ICON_ON;
    icon.classList.toggle("text-red-500", isMuted);
    icon.classList.toggle("text-gray-400", !isMuted);
  }
  const button = document.getElementById("screen-volume-button");
  if (button) {
    button.setAttribute("aria-pressed", String(!isMuted));
    button.setAttribute("aria-label", isMuted
      ? window.__fb("js.screen_vol_muted", "مستوى صوت مشاركة الشاشة (مكتوم)")
      : window.__fb("js.screen_vol_label", "مستوى صوت مشاركة الشاشة"));
    button.title = isMuted
      ? window.__fb("js.screen_vol_muted", "مستوى صوت مشاركة الشاشة (مكتوم)")
      : window.__fb("js.screen_vol_label", "مستوى صوت مشاركة الشاشة");
  }
}
window.syncScreenAudioControls = updateScreenAudioControlState;
let screenVolumeControl = null;
function toggleScreenVolumeControl(e) {
  e && e.stopPropagation();
  if (screenVolumeControl) {
    screenVolumeControl.remove();
    screenVolumeControl = null;
    return
  }
  const t = document.getElementById("screen-video"),
    n = document.getElementById("screen-volume-button");
  if (!t || !n) return;
  const r = n.getBoundingClientRect(),
    i = document.createElement("div");
  i.id = "screen-volume-control";
  i.className = "fixed z-[9999] flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1e2124]/95 border border-white/10 backdrop-blur-xl shadow-2xl";
  i.style.top = `${Math.round(r.bottom + 8)}px`;
  i.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
  //FIX: لو المشاركة本身 مفيهاش مسار صوت، السلايدر ميبقاش ليه لازمة
  //(مفيش صوت يتحكم فيه). بنوضح للمستخدم بدل ما يظن إن التطبيق باظ.
  const _hasScreenAudio = (() => {
    try {
      //FIX: كنا بنبص على الـ call بالـ peerId مباشرة بس، فلو currentScreenSource
      //كان UID (أو الـ call اتغيّر) بنقول "مفيش صوت" والمستخدم مش بيعرف السبب.
      //بنستخدم نفس منطق التشغيل الفعلي عشان القرار يطلع صح.
      const call = (window.findScreenAudioCall && window.findScreenAudioCall(window.currentScreenSource))
        || (window.currentScreenSource ? (window.calls?.[window.currentScreenSource] || null) : null);
      const tracks = call?._foxyRemoteScreenAudioStream?.getAudioTracks?.() || [];
      return tracks.some(track => track.readyState === "live" && !track.disabled);
    } catch (_) { return false; }
  })();
  if (!_hasScreenAudio) {
    i.innerHTML = '<span class="text-[10px] text-amber-300/90 font-bold">' + window.__fb("js.screen_no_audio_short", "لا يوجد صوت في هذه المشاركة") + '</span>';
    (document.fullscreenElement || document.body).appendChild(i);
    screenVolumeControl = i;
    return
  }
  i.innerHTML = '<span class="text-[10px] text-gray-300 font-bold">' + window.__fb("js.vol_label", "الصوت") + '</span><input id="screen-volume-slider" type="range" min="0" max="100" step="1" class="w-24 accent-emerald-500 cursor-pointer" aria-label="مستوى صوت مشاركة الشاشة">';
  (document.fullscreenElement || document.body).appendChild(i);
  const o = i.querySelector("#screen-volume-slider");
  const initialLevel = Math.max(0, Math.min(1, Number(window._foxyScreenVolume ?? t.volume ?? 1)));
  o.value = String(Math.round(initialLevel * 100));
  //FIX: لو العنصر اللي بيشغّل صوت الشاشة اتغيّر مصدره أو وقف، السلايدر
  //يبقى بلا تأثير. بنرجّع حالة الصوت الفعلية مع فتح اللوحة.
  window.applyScreenAudioVolume?.(initialLevel, { muted: window._foxyScreenAudioMuted ?? false, peerId: window.currentScreenSource });
  o.addEventListener("input", () => {
    const e = Number(o.value);
    const level = Math.max(0, Math.min(1, e / 100));
    window._foxyScreenVolume = level;
    if (level > 0) window._foxyScreenLastAudibleVolume = level;
    const muted = level === 0;
    window._foxyScreenAudioMuted = muted;
    const t = document.getElementById("screen-video");
    if (t) {
      t.muted = true;
      t.volume = level;
    }
    //FIX: كانت بنكتفي بتعديل حالة-element الفيديو (وهو مكتوم أصلاً) فالسلايدر
    //ماكانش بيعمل حاجة. دلوقتي بنعدّل عنصر الصوت اللي بيشغّل صوت الشاشة
    //نفسه + بنمنع أي مسار تاني من تشغيل نفس الصوت.
    window.applyScreenAudioVolume?.(level, { muted, peerId: window.currentScreenSource });
    window.setRemoteScreenAudioSettings?.({ muted, volume: level, peerId: window.currentScreenSource });
    updateScreenAudioControlState(muted);
  });
  screenVolumeControl = i
}
window.toggleScreenVolumeControl = toggleScreenVolumeControl;
function bindScreenAudioVolumeButton() {
  const e = document.getElementById("screen-volume-button");
  if (e && !e._foxyVolumeButtonBound) {
    e._foxyVolumeButtonBound = true;
    e.addEventListener("click", t => {
    t.preventDefault();
    t.stopPropagation();
    toggleScreenVolumeControl(t)
    });
  }
  updateScreenAudioControlState(window._foxyScreenAudioMuted ?? false);
}
bindScreenAudioVolumeButton();
document.addEventListener("DOMContentLoaded", bindScreenAudioVolumeButton);
document.addEventListener("click", e => {
  if (e.target.closest("#screen-volume-button")) return;
  if (screenVolumeControl && !e.target.closest("#screen-volume-control")) {
    screenVolumeControl.remove();
    screenVolumeControl = null
  }
});
let monitorRoundRobin = 0,
  lastBroadcastedScreenViewerSignature = "";
async function monitorScreenStats() {
  const e = [...screenViewers].map(peerId => window.calls?.[peerId]).filter(call =>
      call && call._foxyVideoSource === "screen" && call.peerConnection
    ),
    t = new Set(e.map(e => e.peer));
  for (const e of viewerBitrateState.keys()) t.has(e) || viewerBitrateState.delete(e);
  if (0 === e.length) return;
  const n = monitorRoundRobin % e.length,
    r = [];
  for (let t = 0; t < Math.min(e.length, 3); t++) r.push(e[(n + t) % e.length]);
  monitorRoundRobin += r.length;
  for (const e of r) try {
    if (!e.peerConnection || "closed" === e.peerConnection.connectionState) continue;
    const t = await e.peerConnection.getStats();
    let n = viewerBitrateState.get(e.peer),
      r = 0,
      i = 0,
      o = 0,
      c = 0,
      a = 0,
      s = "none",
      d = 0;
    const l = Date.now();
    let w = null,
      u = null;
    if (t.forEach(e => {
        "candidate-pair" === e.type && "succeeded" === e.state && (void 0 !== e.currentRoundTripTime && (r = 1e3 * e.currentRoundTripTime), void 0 !== e.totalRoundTripTime && (u = e.totalRoundTripTime / e.responsesReceived * 1e3)), "remote-inbound-rtp" === e.type && "video" === e.kind && (void 0 !== e.roundTripTime && (r = 1e3 * e.roundTripTime), void 0 !== e.jitter && (i = 1e3 * e.jitter), void 0 !== e.packetsLost && (o = e.packetsLost)), "outbound-rtp" === e.type && "video" === e.kind && (a = e.bytesSent || 0, c = e.packetsSent || 0, s = e.qualityLimitationReason || "none", e.timestamp && n && (d = (e.timestamp - n.lastTimestamp) / 1e3))
      }), !n) {
      n = {
        currentBitrate: SCREEN_BITRATE.START,
        stableCount: 0,
        lastBytesSent: a,
        lastTimestamp: Date.now(),
        lastPacketsLost: o,
        lastPacketsSent: c,
        consecutiveStableCycles: 0,
        dbrLoweredTimeout: 0,
        avgRtt: 0,
        rttHistory: []
      }, viewerBitrateState.set(e.peer, n);
      continue
    }
    d <= 0 && (d = SCREEN_BITRATE.CHECK_INTERVAL / 1e3);
    const _prevBytes = n.lastBytesSent || a;
    const _sentKbps = d > 0 ? Math.round((_prevBytes ? (a - _prevBytes) * 8 / d / 1000 : 0)) : 0;
    const p = c - n.lastPacketsSent,
      m = o - n.lastPacketsLost;
    let S = 0;
    p > 0 && m > 0 && (S = m / (p + m) * 100), n.lastPacketsLost = o, n.lastPacketsSent = c, n.lastBytesSent = a, n.lastTimestamp = Date.now(), n.rttHistory.push(r), n.rttHistory.length > 5 && n.rttHistory.shift(), w = u || (n.rttHistory.length > 0 ? n.rttHistory.reduce((e, t) => e + t, 0) / n.rttHistory.length : r);
    const h = SCREEN_BITRATE.MAX;

    const highLatency = null !== w && w > 400,
      hasLoss = S > 5,
      highJitter = i > 90,
      limited = "bandwidth" === s || "cpu" === s;

    {
      const isWeakSender = highLatency || hasLoss || highJitter || limited;
      const dbg = {
        viewer: e.peer.slice(0, 10),
        sentKbps: _sentKbps,
        targetKbps: Math.round(n.currentBitrate),
        rttMs: Math.round(w || r || 0),
        jitterMs: Math.round(i),
        lossPct: S.toFixed(1),
        limitReason: s,
        isWeak: isWeakSender,
        action: isWeakSender ? "lower-to-avoid-freeze" : (n.currentBitrate < h ? "raise-slowly" : "at-max"),
        hint: isWeakSender ? (limited && s === "cpu" ? window.__fb("js.q_hint_cpu2", "CPU محدود — جرّب تقليل الدقة") : hasLoss ? window.__fb("js.q_hint_loss", "فقدان حزم — سيُخفّض البت رايت تلقائياً لمنع التقطيع") : highLatency ? window.__fb("js.q_hint_lag", "تأخر عالٍ — سيُخفّض البت رايت") : window.__fb("js.q_hint_jitter", "جيتر عالٍ — سيُخفّض البت رايت")) : window.__fb("js.q_hint_raise", "مستقر — سيرفع الجودة تدريجياً للوصول لأفضل دقة")
      };
      const _k = "__lastSenderLog_" + e.peer;
      const _now = Date.now();
      const shouldLog = isWeakSender || _now - (window[_k] || 0) > 6000;
      if (shouldLog) {
        window[_k] = _now;
        if (isWeakSender) console.info("[Foxy][screen-perf][sender]", dbg);
        else if (_now % 13000 < 1200) console.info("[Foxy][screen-perf][sender]", dbg);
        window.__screenPerfLog = window.__screenPerfLog || [];
        window.__screenPerfLog.push({ sender: dbg, t: new Date().toISOString() });
        if (window.__screenPerfLog.length > 100) window.__screenPerfLog.shift();
      }
    }
        // ── سياسة التنازل الجديدة: FPS قبل الدقة قبل البت رايت ──────────
    // التقطيع (frames dropping) أقل اهمية بصرياً من الـpixel blocks،
    // والحل القديم كان يخفض البت رايت أول حاجة ⇒ صورة مموّهة/مبِلَّكة.
    // الترتيب الجديد:
    //   1) شديدة (CPU محدود / RTT>400 / فقد>12%): FPS 15 + تصغير دقة.
    //   2) متوسطة (فقد>4% / RTT>250 / jitter>90): FPS 24 + خفوت خفيف.
    //   3) خفيفة: FPS زي الاختار (30) + خفوت 5% بس.
    const _lossSevere = limited || highLatency || S > 12;
    const _moderate = !_lossSevere && (S > 4 || highJitter || (null !== w && w > 250));
    const _fpsSel = parseInt(document.getElementById("screen-fps")?.value || "30");
    let _fpsCap = _fpsSel, _scale = null;
    if (_lossSevere) {
      _fpsCap = 15;
      _scale = limited && "cpu" === s ? 2 : (S > 12 || highLatency ? 2 : null)
    } else if (_moderate) _fpsCap = Math.min(24, _fpsSel);
    if (highLatency || hasLoss || limited || highJitter) {
      let _cut = _lossSevere ? (limited && "cpu" === s ? .14 : .12) : _moderate ? .07 : .05;
      _cut = Math.max(.05, Math.min(.18, _cut));
      const _target = Math.max(SCREEN_BITRATE.MIN, n.currentBitrate * (1 - _cut));
      if (n.currentBitrate - _target > 50 || _scale || n._fpsCap !== _fpsCap) {
        n.currentBitrate = _target;
        n._fpsCap = _fpsCap;
        if (_scale && _scale > 1) n._scaled = !0;
        applyBitrateCeiling(e, _target, _scale, _fpsCap);
        n.dbrLoweredTimeout = l + 1500;
        n.consecutiveStableCycles = 0
      }
    } else if (n.currentBitrate < h && l > (n.dbrLoweredTimeout || 0)) {
      n.consecutiveStableCycles++;
      if (n.consecutiveStableCycles >= 2) {
        // الاستقرار رجّع: ارفع البت رايت ورجّع FPS الأصلي وألغي تصغير الدقة.
        const u = Math.min(h, n.currentBitrate * 1.08);
        n._fpsCap = _fpsSel;
        (u !== n.currentBitrate || n._scaled) && (n.currentBitrate = u, applyBitrateCeiling(e, u, 1, _fpsSel), n._scaled = !1);
        n.consecutiveStableCycles = 0
      }
    } else n.consecutiveStableCycles = 0
  } catch (t) {
    viewerBitrateState.delete(e.peer)
  }
}

function adjustVideoBitrate(e, t) {
  applyBitrate(e, t)
}

function updateScreenViewerUI(e = null) {
  const normalizeViewer = value => {
    const peerId = String(value || "");
    if (!peerId) return null;
    const legacyId = peerId.startsWith("viewer-") ? peerId.slice("viewer-".length) : peerId;
    const record = connections?.[legacyId] || Object.values(connections || {}).find(item => item?.uid === legacyId || item?.name === peerId);
    return {
      uid: record?.uid || window.peerIdToUidMap?.[legacyId] || legacyId,
      name: record?.name || window.state?.serverMembersData?.[window.peerIdToUidMap?.[legacyId] || legacyId]?.name || peerId,
      type: "peer"
    };
  };
  const localByUid = new Map;
  screenViewers.forEach(peerId => {
    const viewer = normalizeViewer(peerId);
    if (viewer) localByUid.set(viewer.uid, viewer);
  });
  const localViewers = [...localByUid.values()];
  const localCount = localViewers.length;
  const remoteEntry = window.currentScreenSource ? getRemoteViewerListEntry(window.currentScreenSource) : null;
  const displayedViewers = window.currentScreenSource ? (remoteEntry?.viewers || []) : localViewers;
  const count = Number.isFinite(e) && !window.currentScreenSource ? Math.max(0, e) : displayedViewers.length;
  const countNode = document.getElementById("screen-viewer-count");
  if (countNode) {
    countNode.textContent = String(count);
    countNode.classList.toggle("animate-pulse", count > 0);
    countNode.classList.toggle("text-emerald-400", count > 0);
    countNode.classList.toggle("text-blue-400", count === 0);
  }
  const signature = JSON.stringify({
    viewers: localViewers.map(viewer => viewer.uid).sort(),
    peers: [...screenViewers].map(String).sort()
  });
  if (window.isScreenSharing && signature !== lastBroadcastedScreenViewerSignature) {
    lastBroadcastedScreenViewerSignature = signature;
    const payload = {
      type: "screen-viewer-count",
      count: localCount,
      viewers: localViewers
    };
    [...screenViewers].forEach(peerId => {
      if (window.sendScreenControl) window.sendScreenControl(peerId, payload);
      else sendSignalingCmd(peerId, payload);
    });
  } else if (!window.isScreenSharing) lastBroadcastedScreenViewerSignature = "";
  window.updateParticipantViewerCount?.("me", localCount);
  if (typeof window.toggleParticipantWatchingMe === "function") {
    Object.keys(connections || {}).forEach(peerId => window.toggleParticipantWatchingMe(connections[peerId]?.uid || peerId, false));
    localViewers.forEach(viewer => window.toggleParticipantWatchingMe(viewer.uid, true));
  }
  if (document.getElementById("screen-viewers-modal")) window.refreshScreenViewersModal?.();
}
function getRemoteViewerListEntry(source) {
  const sourceUid = window.peerIdToUidMap?.[source] || window.connections?.[source]?.uid || source;
  for (const [ownerPeerId, entry] of remoteScreenViewerLists) {
    const ownerUid = window.peerIdToUidMap?.[ownerPeerId] || window.connections?.[ownerPeerId]?.uid || ownerPeerId;
    if (ownerPeerId === source || ownerUid === sourceUid) return entry;
  }
  return null;
}
window.setRemoteScreenViewerList = function(ownerPeerId, viewers) {
  if (!ownerPeerId || !Array.isArray(viewers)) return;
  const unique = new Map;
  viewers.forEach(viewer => {
    if (!viewer || typeof viewer !== "object") return;
    const uid = String(viewer.uid || "").trim();
    if (!uid) return;
    unique.set(uid, { uid, name: String(viewer.name || uid).slice(0, 120), type: "peer" });
  });
  remoteScreenViewerLists.set(String(ownerPeerId), { viewers: [...unique.values()], receivedAt: Date.now() });
  if (window.currentScreenSource) updateScreenViewerUI();
};
window.clearRemoteScreenViewerList = function(ownerPeerId) {
  if (!ownerPeerId) return;
  const ownerUid = window.peerIdToUidMap?.[ownerPeerId] || window.connections?.[ownerPeerId]?.uid || ownerPeerId;
  for (const key of remoteScreenViewerLists.keys()) {
    const keyUid = window.peerIdToUidMap?.[key] || window.connections?.[key]?.uid || key;
    if (key === ownerPeerId || keyUid === ownerUid) remoteScreenViewerLists.delete(key);
  }
  if (window.currentScreenSource) updateScreenViewerUI();
};
window.getScreenViewersList = function() {
  if (window.currentScreenSource) return getRemoteViewerListEntry(window.currentScreenSource)?.viewers || [];
  const viewers = new Map;
  for (const peerId of screenViewers) {
    if (typeof peerId !== "string") continue;
    const legacyId = peerId.startsWith("viewer-") ? peerId.slice("viewer-".length) : peerId;
    const record = connections?.[legacyId] || Object.values(connections || {}).find(item => item?.uid === legacyId || item?.name === peerId);
    const uid = record?.uid || window.peerIdToUidMap?.[legacyId] || legacyId;
    viewers.set(uid, { uid, name: record?.name || window.__fb("js.unknown_peer", "مشارك مجهول"), type: "peer" });
  }
  return [...viewers.values()];
}, window.updateScreenViewerUI = updateScreenViewerUI, window.removeScreenViewerByUid = function(uid) {
  if (!screenViewers) return;
  const removed = [];
  screenViewers.forEach(peerId => {
    const legacyId = typeof peerId === "string" && peerId.startsWith("viewer-") ? peerId.slice("viewer-".length) : peerId;
    const record = connections?.[legacyId] || Object.values(connections || {}).find(item => item?.uid === legacyId);
    if (peerId === uid || legacyId === uid || record?.uid === uid || window.peerIdToUidMap?.[legacyId] === uid) removed.push(peerId);
  });
  removed.forEach(peerId => {
    screenViewers.delete(peerId), void 0 !== viewerBitrateState && viewerBitrateState.delete(peerId)
  }), updateScreenViewerUI()
}, window.startScreenShare = startScreenShare, window.stopScreenShare = stopScreenShare, window.joinScreenShare = joinScreenShare, window.closeScreenView = closeScreenView, window.monitorScreenStats = monitorScreenStats, document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      const video = document.getElementById("screen-video");
      if (video?.srcObject) {
        try { video.play?.(); } catch (_) {}
      }
    }
}), window.updateScreenQualityIndicator = function(e, t) {
  const n = document.getElementById("screen-quality-indicator"),
    r = document.getElementById("screen-quality-icon"),
    i = document.getElementById("screen-quality-kbps");
  n && r && i && (n.classList.remove("hidden"), n.classList.add("flex"), i.textContent = `${t}kbps`, "good" === e ? (r.className = "w-3 h-3 text-emerald-400", i.className = "text-[9px] font-mono text-emerald-400") : "fair" === e ? (r.className = "w-3 h-3 text-yellow-400", i.className = "text-[9px] font-mono text-yellow-400") : (r.className = "w-3 h-3 text-red-500", i.className = "text-[9px] font-mono text-red-500"))
};

const screenCodecHints = {
  h264: "الأكثر توافقاً مع المتصفحات وكروت الشاشة (تسريع عتادي)",
  vp9: "توازن جيد بين الجودة والأداء",
  av1: "أفضل ضغط، يحتاج كارت شاشة حديث جداً",
  vp8: "توافق أساسي، أقل كفاءة في الضغط"
};

function showCodecError(msg) {
  if (typeof window.showFoxyToast === "function") {
    window.showFoxyToast({ id: "screen-codec-err", tone: "error", title: "ترميز غير مدعوم", body: msg, duration: 8000 });
  } else if (typeof addSystemMsg === "function") {
    addSystemMsg("⚠️ " + msg, "error");
  } else {
    alert(msg);
  }
}

function applyScreenCodec(codec) {
  const supported = ["h264", "vp9", "av1", "vp8"];
  if (!supported.includes(codec)) {
    showCodecError("هذا الترميز غير مدعوم");
    return;
  }
  selectedScreenCodec = codec;
  const hintEl = document.getElementById("screen-codec-hint");
  if (hintEl) hintEl.textContent = screenCodecHints[codec] || "";

  Object.values(window.calls || {}).forEach(call => {
    if (!call?.peerConnection || !call.peerConnection.getTransceivers) return;
    call.peerConnection.getTransceivers().forEach(t => {
      if (t.sender && t.sender.track && t.sender.track.kind === "video") {
        try {
          const caps = RTCRtpSender.getCapabilities("video");
          const match = caps.codecs.find(c => c.mimeType.toLowerCase() === `video/${codec}`);
          if (!match) {
            showCodecError(`الترميز ${codec.toUpperCase()} غير مدعوم في هذا المتصفح`);
            return;
          }
          t.setCodecPreferences([match]);
        } catch (err) {
          console.error("[Foxy][screen] فشل تعيين الترميز", err);
        }
      }
    });
  });
}

window.getSelectedScreenCodec = () => selectedScreenCodec;
window.setSelectedScreenCodec = applyScreenCodec;
window.screenCodecHints = screenCodecHints;
window.screenAdaptiveBitrateEnabled = true;

// ── التحكم الديناميكي الاحترافي في البت رايت (OBS Style) ─────────────────
const ADAPTIVE_BITRATE_CFG = {
  CHECK_INTERVAL: 250,
  STABLE_MS: 1500,
  ADD_KBPS: 150,
  MIN_KBPS: 800,
  LIGHT_RTT: 100,
  SEVERE_RTT: 200,
  LIGHT_LOSS: 2,
  SEVERE_LOSS: 10
};

let adaptiveBitrateTimer = null;
let adaptivePeerBitrate = new Map();

function getAdaptivePeer(peerId, targetKbps) {
  if (!adaptivePeerBitrate.has(peerId)) {
    adaptivePeerBitrate.set(peerId, { current: targetKbps, target: targetKbps, stableSince: null });
  }
  return adaptivePeerBitrate.get(peerId);
}
let adaptiveLastStats = new Map();

async function readCongestionSignals(pc) {
  return new Promise((resolve) => {
    try {
      pc.getStats().then((report) => {
        let rtt = 0, lost = 0, sent = 0;
        report.forEach((s) => {
          if (s.type === 'candidate-pair' && s.state === 'succeeded' && s.currentRoundTripTime != null) {
            rtt = s.currentRoundTripTime * 1000;
          }
          if (s.type === 'outbound-rtp' && s.kind === 'video') {
            lost += s.packetsLost || 0;
            sent += s.packetsSent || 0;
          }
        });
        const lossPct = sent > 0 ? (lost / sent) * 100 : 0;
        resolve({ rtt, lossPct });
      }).catch(() => resolve({ rtt: 0, lossPct: 0 }));
    } catch (e) { resolve({ rtt: 0, lossPct: 0 }); }
  });
}

async function adjustOnePeer(call) {
  const pc = call && call.peerConnection;
  if (!pc) return;
  const peerId = call.peer || call.id;
  const target = SCREEN_BITRATE.START || 4000;
  const st = getAdaptivePeer(peerId, target);
  if (st.current == null) st.current = target;

  const sig = await readCongestionSignals(pc);
  const now = Date.now();

  // حساب الدلتا (فقدان الحزم في آخر 250ms فقط، ليس تراكمي)
  let deltaLossPct = 0;
  const last = adaptiveLastStats.get(peerId) || { lost: 0, sent: 0, time: now };
  const dlost = sig.lost - last.lost;
  const dsent = sig.sent - last.sent;
  adaptiveLastStats.set(peerId, { lost: sig.lost, sent: sig.sent, time: now });
  if (dsent > 0) deltaLossPct = (dlost / dsent) * 100;

  let changed = false;

  if (deltaLossPct >= ADAPTIVE_BITRATE_CFG.SEVERE_LOSS || sig.rtt >= ADAPTIVE_BITRATE_CFG.SEVERE_RTT) {
    st.current = Math.max(ADAPTIVE_BITRATE_CFG.MIN_KBPS, Math.round(st.current * 0.65));
    st.stableSince = null;
    changed = true;
  } else if (deltaLossPct >= ADAPTIVE_BITRATE_CFG.LIGHT_LOSS || sig.rtt >= ADAPTIVE_BITRATE_CFG.LIGHT_RTT) {
    st.current = Math.max(ADAPTIVE_BITRATE_CFG.MIN_KBPS, Math.round(st.current * 0.90));
    st.stableSince = null;
    changed = true;
  } else {
    if (st.stableSince == null) st.stableSince = now;
    if (now - st.stableSince >= ADAPTIVE_BITRATE_CFG.STABLE_MS && st.current < st.target) {
      st.current = Math.min(st.target, st.current + ADAPTIVE_BITRATE_CFG.ADD_KBPS);
      st.stableSince = now;
      changed = true;
    }
  }

  if (changed) {
    try {
      pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'video') {
          const params = sender.getParameters();
          if (!params.encodings || !params.encodings.length) params.encodings = [{}];
          params.encodings[0].maxBitrate = Math.round(st.current * 1000);
          sender.setParameters(params);
        }
      });
    } catch (e) {}
  }
}

function startAdaptiveBitrateMonitor() {
  stopAdaptiveBitrateMonitor();
  adaptiveBitrateTimer = setInterval(() => {
    Object.values(window.calls || {}).forEach((call) => {
      if (call && call.peerConnection && call._foxyVideoSource === 'screen') {
        adjustOnePeer(call);
      }
    });
  }, ADAPTIVE_BITRATE_CFG.CHECK_INTERVAL);
}

function stopAdaptiveBitrateMonitor() {
  if (adaptiveBitrateTimer) {
    clearInterval(adaptiveBitrateTimer);
    adaptiveBitrateTimer = null;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("screen-codec");
  const hint = document.getElementById("screen-codec-hint");
  if (!sel || !hint) return;
  hint.textContent = screenCodecHints[sel.value] || "";
  sel.addEventListener("change", (e) => {
    applyScreenCodec(e.target.value);
    hint.textContent = screenCodecHints[e.target.value] || "";
  });
});
