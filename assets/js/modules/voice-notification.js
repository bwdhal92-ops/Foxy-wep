//FIX: إشعار "متصل بالقناة الصوتية" (زي ديسكورد) بيظهر في شريط الإشعارات
//طول ما المستخدم متصل بقناة صوتية، وبيقبل 3 أزرار:
//  - كتم الصوت (deafen) / إلغاء الكتم
//  - كتم المايك (mute) / إلغاء الكتم
//  - قطع الاتصال (disconnect)
//والضغط على الإشعار نفسه بيرجّع المستخدم للمكالمة.
//
// الشغل بيتبعت للـ Service Worker عشان يقدر يستقبل الضغط على الأزرار
//(Notification العادي في المتصفح مش بيعرف actions).
const VOICE_NOTIF_TAG = "foxy-voice-call";

let _voiceNotifState = null;
let _voiceNotifShown = false;

function _voiceNotifOptions(state) {
  const muted = !!state.muted;
  const deafened = !!state.deafened;
  const body = state.serverName
    ? `${state.channelName || ""} • ${state.serverName}`.trim()
    : (state.channelName || "");
  return {
    body,
    tag: VOICE_NOTIF_TAG,
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [60, 40, 60],
    icon: "/assets/img/foxy.png",
    badge: "/assets/img/foxy.png",
    actions: [
      {
        action: "deafen",
        title: deafened
          ? window.__fb("js.voice_btn_undeafen", "إلغاء كتم الصوت")
          : window.__fb("js.voice_btn_deafen", "كتم الصوت")
      },
      {
        action: "mute",
        title: muted
          ? window.__fb("js.voice_btn_unmute", "إلغاء كتم المايك")
          : window.__fb("js.voice_btn_mute", "كتم المايك")
      },
      {
        action: "disconnect",
        title: window.__fb("js.voice_btn_disconnect", "قطع الاتصال")
      }
    ],
    data: {
      type: "voice-call",
      channelName: state.channelName || "",
      serverName: state.serverName || "",
      serverId: state.serverId || "",
      channelId: state.channelId || "",
      url: window.location.href
    }
  };
}

async function _showVoiceNotif(state) {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "denied") return false;
  if (Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch (_) {}
    if (Notification.permission !== "granted") return false;
  }
  const title = window.__fb("js.voice_connected_title", "تم الاتصال الصوتي — اضغط للرجوع");
  const options = _voiceNotifOptions(state);
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      // نفس الـ tag ⇒ الإشعار القديم يتحدّث مكانه بدل ما يتزاكم.
      const existing = await registration.getNotifications({ tag: VOICE_NOTIF_TAG });
      existing.forEach(item => { try { item.close(); } catch (_) {} });
      await registration.showNotification(title, options);
    } else {
      const notification = new Notification(title, options);
      notification.onclick = () => { try { window.focus(); } catch (_) {} notification.close(); };
    }
    _voiceNotifShown = true;
    return true;
  } catch (error) {
    window.foxyLog?.("warn", "[Foxy][voice-notif] تعذر عرض الإشعار", { message: error?.message });
    return false;
  }
}

// بيظهر (أو تحدّث) إشعار الاتصال الصوتي.
window.showVoiceCallNotification = function(state = {}) {
  try {
    // The Android app already shows a native foreground-service notification
    // with mute / stop-sharing actions; a second web notification duplicates it.
    if (window.FoxyNativeApp?.isAndroidApp) return false;
    _voiceNotifState = {
      channelName: state.channelName || "",
      serverName: state.serverName || "",
      serverId: state.serverId || "",
      channelId: state.channelId || "",
      muted: state.muted ?? !!window.isMuted,
      deafened: state.deafened ?? !!window.isDeafened
    };
    return _showVoiceNotif(_voiceNotifState);
  } catch (_) {
    return false;
  }
};

// تحديث حالة الكتم في الإشعار (بتقفل القديم وتعيد عرضه عشان الأزرار تتحدّث).
window.updateVoiceCallNotification = function(patch = {}) {
  if (!_voiceNotifState) return false;
  if (typeof patch.muted === "boolean") _voiceNotifState.muted = patch.muted;
  if (typeof patch.deafened === "boolean") _voiceNotifState.deafened = patch.deafened;
  if ("channelName" in patch) _voiceNotifState.channelName = patch.channelName || "";
  if ("serverName" in patch) _voiceNotifState.serverName = patch.serverName || "";
  return _showVoiceNotif(_voiceNotifState);
};

// يقفل إشعار الاتصال الصوتي (لما يخرج من القناة).
window.closeVoiceCallNotification = function() {
  _voiceNotifState = null;
  _voiceNotifShown = false;
  if (!("serviceWorker" in navigator)) return false;
  navigator.serviceWorker.ready.then(async registration => {
    try {
      const existing = await registration.getNotifications({ tag: VOICE_NOTIF_TAG });
      existing.forEach(item => { try { item.close(); } catch (_) {} });
    } catch (_) {}
  }).catch(() => {});
  return true;
};

window.isVoiceCallNotificationVisible = function() { return _voiceNotifShown; };

// استقبال ضغطات الأزرار من الـ Service Worker.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", event => {
    const message = event.data;
    if (!message || !message.action) return;
    switch (message.action) {
      case "VOICE_MUTE":
        window.toggleMute?.();
        break;
      case "VOICE_DEAFEN":
        window.toggleDeafen?.();
        break;
      case "VOICE_DISCONNECT":
        window.leaveVoiceChannel?.();
        break;
      case "VOICE_FOCUS":
        try { window.focus(); } catch (_) {}
        break;
      default:
        break;
    }
  });
}
