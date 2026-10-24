import {
  db as e,
  auth as t,
  rtdb as n
} from "./firebase-config.js";
function broadcastPeerPayload(message) {
  if (typeof window.foxyBroadcastPeerMessage === "function") return window.foxyBroadcastPeerMessage(message);
  const payload = JSON.stringify(message);
  Object.values(window.connections || {}).forEach(record => {
    const connection = record?.conn;
    if (!connection?.send) return;
    if (connection.type === "media") connection.send(payload);
    else if (connection.open) connection.send(message);
  });
}
window.escapeMessageHTML = function(str) {
  if (!str) return "";
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
};
window.isMuted = localStorage.getItem("isMuted") === "true";
window.isDeafened = localStorage.getItem("isDeafened") === "true";
window.analytics = null, "requestIdleCallback" in window ? requestIdleCallback(() => {
  import("./modules/analytics.js").then(e => {
    window.analytics = e
  }).catch(err => console.warn('[Analytics] Failed to load:', err))
}, {
  timeout: 3e3
}) : setTimeout(() => {
  import("./modules/analytics.js").then(e => {
    window.analytics = e
  }).catch(err => console.warn('[Analytics] Failed to load:', err))
}, 2e3), window.checkUpdate = async e => {
  e && (e.disabled = !0, e.classList.add("opacity-50"), e.innerText = window.__fb("app_loading.loading_profile", "جاري التحميل..."));
  try {
    if (window.electronAPI && "function" == typeof window.electronAPI.checkForUpdates) try {
      const e = await window.electronAPI.checkForUpdates();
      if (e) return e.isDownloaded ? void c() : void a(e.version, async () => {
        const t = document.getElementById("update-status-msg");
        t && (t.innerText = window.__fb("app_loading.loading_profile", "جاري التحميل..."));
        const n = await window.electronAPI.startUpdateDownload({
          version: e.version,
          url: e.asarUrl
        });
        n.success ? c() : (window.addSystemMsg && window.addSystemMsg(window.__fb("app_settings.update_status_failed", "فشل تحميل التحديث: ") + n.error, "error"), r())
      })
    } catch (err) {
      console.warn('[Update] Electron update check failed:', err);
    }
    // Android has no Electron updater: read the APK update from the same
    // Firestore config and hand the download to the native DownloadManager.
    if (window.FoxyNativeApp && window.FoxyNativeApp.isAndroidApp) {
      try {
        const { db } = await import("./firebase-config.js");
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        const snap = await getDoc(doc(db, "app-config", "global"));
        const cfg = snap.exists() ? snap.data() : {};
        const upd = cfg.updates || {};
        const latest = String(
          upd.androidVersion ?? cfg.androidVersion ?? upd.latestVersion ?? cfg.latestVersion ?? ""
        ).replace(/^v/, "");
        const url = upd.androidDownloadURL ?? cfg.androidDownloadURL ?? upd.downloadURL ?? cfg.downloadURL ?? "";
        const current = String(await window.electronAPI.getAppVersion()).replace(/^v/, "");
        if (latest && latest !== current && url) {
          return a("v" + latest, async () => {
            const res = await window.electronAPI.startUpdateDownload({ version: "v" + latest, url });
            if (res && res.success) c();
            else {
              window.addSystemMsg && window.addSystemMsg(
                window.__fb("app_settings.update_status_failed", "فشل تحميل التحديث: ") + ((res && res.error) || ""),
                "error"
              );
              r();
            }
          });
        }
        window.addSystemMsg && window.addSystemMsg(
          window.__fb("app_loading.already_latest", "أنت تستخدم أحدث إصدار بالفعل."),
          "success"
        );
      } catch (err) {
        console.warn('[Update] Android update check failed:', err);
        window.addSystemMsg && window.addSystemMsg(
          window.__fb("app_loading.update_check_failed", "فشل التحقق من التحديثات"),
          "error"
        );
      }
      return;
    }
    if (window.electronAPI) return;
    if (!("serviceWorker" in navigator)) return void(window.addSystemMsg && window.addSystemMsg(window.__fb("app_loading.browser_no_sw", "متصفحك لا يدعم التحديث التلقائي"), "error"));
    try {
      const e = await navigator.serviceWorker.ready;
      window.addSystemMsg && window.addSystemMsg(window.__fb("app_loading.checking_updates", "جاري التحقق من وجود تحديثات..."), "info"), await e.update(), await new Promise(e => setTimeout(e, 1500)), e.waiting || e.installing ? window.addSystemMsg && window.addSystemMsg(window.__fb("app_loading.update_found", "تم العثور على تحديث! سيظهر زر التحديث قريباً."), "success") : window.addSystemMsg && window.addSystemMsg(window.__fb("app_loading.already_latest", "أنت تستخدم أحدث إصدار بالفعل."), "success")
    } catch (err) {
      console.warn('[Update] SW update check failed:', err);
    }
  } catch (err) {
    window.addSystemMsg && window.addSystemMsg(window.__fb("app_loading.update_check_failed", "فشل التحقق من التحديثات"), "error")
  } finally {
    e && (e.disabled = !1, e.classList.remove("opacity-50"), window.electronAPI ? e.innerText = window.__fb("app_loading.check_updates_app", "التحقق من تحديثات البرنامج") : e.innerText = window.__fb("app_loading.check_updates_website", "التحقق من تحديثات الموقع"))
  }
}, window.electronAPI && setTimeout(() => async function() {
  if (window.electronAPI) try {
    const {
      db: e
    } = await import("./firebase-config.js"), {
      doc: t,
      getDoc: n
    } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js"), a = await n(t(e, "app-config", "global")), r = a.exists() ? a.data() : {}, c = await window.electronAPI.getAppVersion(), l = `v${c}`, u = r.maintenance?.enabled ?? r.killSwitch ?? !1, w = r.maintenance?.message ?? r.killSwitchMessage ?? window.__fb("js.maintenance", "البرنامج متوقف مؤقتاً لأعمال الصيانة. يرجى المحاولة لاحقاً.");
    if (!0 === u) return void
    function(e) {
      document.getElementById("custom-update-modal")?.remove();
      const t = document.createElement("div");
      t.id = "killswitch-screen", t.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.98);backdrop-filter:blur(20px);display:flex;align-items:center;justify-content:center;z-index:999999;", t.innerHTML = `\n        <div style="text-align:center;padding:40px;max-width:400px;">\n            <div style="width:80px;height:80px;background:rgba(239,68,68,0.15);border:2px solid rgba(239,68,68,0.3);\n                border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;">\n                <svg width="40" height="40" fill="none" stroke="#ef4444" stroke-width="2" viewBox="0 0 24 24">\n                    <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>\n                </svg>\n            </div>\n            <h2 style="color:white;font-size:22px;font-weight:800;margin:0 0 14px;">${window.__fb("js.unavailable", "Foxy غير متاح")}</h2>\n            <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0;">${e}</p>\n        </div>\n    `, document.body.appendChild(t)
    }(w);
    const _isAndroidApp = !!(window.FoxyNativeApp && window.FoxyNativeApp.isAndroidApp);
    const _updateUrl = _isAndroidApp
      ? (r.updates?.androidDownloadURL ?? r.androidDownloadURL ?? r.updates?.downloadURL ?? r.downloadURL)
      : (r.updates?.downloadURL ?? r.downloadURL);
    // Never apply the desktop min-version / expired-version lists to the APK:
    // the Android build has its own version line and must only be forced by
    // Android-specific config. Otherwise a desktop release would block it.
    const m = _isAndroidApp
      ? (r.updates?.androidMinVersion ?? r.androidMinVersion)
      : (r.updates?.minVersion ?? r.minVersion);
    if (m && function(e, t) {
        const n = e.replace("v", "").split(".").map(Number),
          o = t.replace("v", "").split(".").map(Number);
        for (let e = 0; e < Math.max(n.length, o.length); e++) {
          const t = n[e] || 0,
            i = o[e] || 0;
          if (t > i) return 1;
          if (t < i) return -1
        }
        return 0
      }(c, m.replace("v", "")) < 0) return void s(l, _updateUrl);
    const expiredVersions = _isAndroidApp
      ? (r.updates?.androidExpiredVersions ?? [])
      : (r.updates?.expiredVersions ?? r.expiredVersions ?? []);
    const expiredList = Array.isArray(expiredVersions) ? expiredVersions : [expiredVersions];
    const currentBare = l.replace(/^v/, "");
    if (expiredList.some(v => String(v ?? "").replace(/^v/, "") === currentBare)) return void s(l, _updateUrl);
    const p = await window.electronAPI.checkForUpdates();
    if (_isAndroidApp) {
      // Native has no auto-updater; use the APK fields directly. Only force
      // the modal for a forced release, and never block an optional update.
      const latest = String(
        r.updates?.androidVersion ?? r.androidVersion ?? r.updates?.latestVersion ?? r.latestVersion ?? ""
      ).replace(/^v/, "");
      const current = c.replace(/^v/, "");
      const forced = r.updates?.isForced ?? (!0 === r.updateType || "forced" === r.updateType);
      if (latest && latest !== current && _updateUrl && forced) {
        d({ version: "v" + latest, asarUrl: _updateUrl, isDownloaded: false });
      }
      return;
    }
    if (!p) return;
    _updateUrl && (p.asarUrl = _updateUrl), o = p, r.updates?.isForced ?? (!0 === r.updateType || "forced" === r.updateType) ? d(p) : (i(), p.isDownloaded ? i(!0) : sessionStorage.getItem("update-notified") || (sessionStorage.setItem("update-notified", "1"), function(e) {
      const t = document.createElement("div");
      t.id = "optional-update-toast", t.innerHTML = `\n        <div style="position:fixed;bottom:24px;right:24px;background:linear-gradient(135deg,#1e1f22,#2d2f34);\n            border:1px solid rgba(59,130,246,0.4);border-radius:16px;padding:16px 20px;\n            display:flex;align-items:center;gap:14px;z-index:99998;max-width:340px;\n            box-shadow:0 20px 40px rgba(0,0,0,0.5);animation:slideInRight 0.4s ease;">\n            <div style="width:40px;height:40px;background:#3b82f6;border-radius:12px;display:flex;\n                align-items:center;justify-content:center;flex-shrink:0;">\n                <svg width="20" height="20" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24">\n                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>\n                </svg>\n            </div>\n            <div style="flex:1;min-width:0;">\n                <p style="color:white;font-weight:700;font-size:13px;margin:0 0 3px;">${window.__f("js.upd_avail", {v: e}, `تحديث ${e} متاح`)}</p>\n                <p style="color:#94a3b8;font-size:11px;margin:0;">${window.__fb("js.upd_hint", "اضغط للتحديث أو تحقق من الإعدادات لاحقاً")}</p>\n            </div>\n            <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">\n                <button onclick="document.getElementById('optional-update-toast').remove();\n                    if(_pendingUpdateInfo) showCustomUpdateModal(_pendingUpdateInfo.version, async()=>{ await handleUpdateDownload(_pendingUpdateInfo); });"\n                    style="background:#3b82f6;color:white;border:none;padding:6px 12px;border-radius:8px;\n                    font-size:11px;font-weight:700;cursor:pointer;">${window.__fb("app_loading.update_button", "تحديث")}</button>\n                <button onclick="document.getElementById('optional-update-toast').remove();"\n                    style="background:transparent;color:#64748b;border:1px solid rgba(255,255,255,0.08);\n                    padding:5px 10px;border-radius:6px;font-size:10px;cursor:pointer;">${window.__fb("js.dismiss", "تجاهل")}</button>\n            </div>\n        </div>\n        <style>@keyframes slideInRight{from{opacity:0;transform:translateX(50px);}to{opacity:1;transform:translateX(0);}}</style>\n    `, document.body.appendChild(t), setTimeout(() => t?.remove(), 12e3)
    }(p.version)))
  } catch (e) {
    setTimeout(() => window.checkUpdate(), 5e3)
  }
}(), 3e3), window.isAppVisible = !document.hidden, document.addEventListener("visibilitychange", () => {
  window.isAppVisible = !document.hidden
});
let o = null;

function i(e = !1) {
  const t = document.getElementById("nav-settings-btn");
  if (!t) return;
  let n = document.getElementById("update-rail-badge");
  if (n || (n = document.createElement("div"), n.id = "update-rail-badge", n.style.cssText = "\n            position: absolute; top: -3px; right: -3px;\n            width: 10px; height: 10px; border-radius: 50%;\n            border: 2px solid #1e1f22; cursor: pointer;\n            animation: pulseBadge 2s infinite;\n        ", n.title = window.__fb("js.upd_ready_badge", "يوجد تحديث متاح"), n.onclick = () => {
      o && (e || o.isDownloaded ? c() : a(o.version, async () => {
        await async function(e) {
          const t = document.getElementById("update-status-msg"),
            n = document.getElementById("update-progress-container"),
            o = document.getElementById("update-progress-bar");
          n && n.classList.remove("hidden"), t && (t.innerText = window.__fb("app_loading.loading_profile", "جاري التحميل..."));
          let d = 0;
          const a = setInterval(() => {
              d = Math.min(d + 5 * Math.random(), 95), o && (o.style.width = d + "%")
            }, 300),
            s = await window.electronAPI.startUpdateDownload({
              version: e.version,
              url: e.asarUrl
            });
          clearInterval(a), s.success ? (o && (o.style.width = "100%"), t && (t.innerText = window.__fb("js.dl_done", "✅ اكتمل التحميل!")), i(!0), setTimeout(() => {
            r(), c()
          }, 1e3)) : (t && (t.innerText = window.__fb("js.dl_fail", "❌ فشل التحميل")), window.addSystemMsg && window.addSystemMsg(window.__fb("app_settings.update_status_failed", "فشل تحميل التحديث: ") + s.error, "error"), setTimeout(() => r(), 2e3))
        }(o)
      }))
    }, t.style.position = "relative", t.appendChild(n)), n.style.background = e ? "#ef4444" : "#3b82f6", n.title = e ? window.__fb("js.upd_ready_install", "التحديث جاهز للتثبيت") : window.__fb("js.upd_ready_badge", "يوجد تحديث متاح"), !document.getElementById("update-badge-style")) {
    const e = document.createElement("style");
    e.id = "update-badge-style", e.textContent = "@keyframes pulseBadge { 0%,100%{transform:scale(1);} 50%{transform:scale(1.3);} }", document.head.appendChild(e)
  }
}

function d(e) {
  document.getElementById("custom-update-modal")?.remove();
  const t = document.createElement("div");
  t.id = "forced-update-screen", t.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.95);backdrop-filter:blur(20px);display:flex;align-items:center;justify-content:center;z-index:999999;", t.innerHTML = `\n        <div style="background:linear-gradient(135deg,#1e1f22,#2d2f34);border:1px solid rgba(239,68,68,0.3);\n            border-radius:24px;padding:40px;width:420px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,0.7);">\n            <div style="width:70px;height:70px;background:linear-gradient(135deg,#ef4444,#f97316);border-radius:20px;\n                display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">\n                <svg width="35" height="35" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24">\n                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>\n                </svg>\n            </div>\n            <h2 style="color:white;font-size:22px;font-weight:800;margin:0 0 10px;">${window.__fb("js.force_upd", "تحديث إجباري مطلوب")}</h2>\n            <p style="color:#94a3b8;font-size:14px;margin:0 0 25px;line-height:1.6;">\n                الإصدار ${e.version} مطلوب للاستمرار في استخدام Foxy.<br>جاري التحميل تلقائياً...\n            </p>\n            <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px;margin-bottom:20px;">\n                <div id="forced-progress-bar-bg" style="background:rgba(255,255,255,0.1);border-radius:8px;height:8px;overflow:hidden;">\n                    <div id="forced-progress-bar" style="background:linear-gradient(90deg,#3b82f6,#6366f1);height:100%;width:0%;border-radius:8px;transition:width 0.3s;"></div>\n                </div>\n                <p id="forced-status" style="color:#64748b;font-size:12px;margin:10px 0 0;">${window.__fb("app_network.connecting", "جاري الاتصال...")}</p>\n            </div>\n        </div>\n    `, document.body.appendChild(t), (async () => {
    const t = document.getElementById("forced-status"),
      n = document.getElementById("forced-progress-bar");
    t && (t.innerText = window.__fb("app_loading.loading_profile", "جاري التحميل..."));
    let o = 0;
    const i = setInterval(() => {
        o = Math.min(o + 8 * Math.random(), 90), n && (n.style.width = o + "%")
      }, 400),
      a = await window.electronAPI.startUpdateDownload({
        version: e.version,
        url: e.asarUrl
      });
    clearInterval(i), n && (n.style.width = "100%"), a.success ? (t && (t.innerText = window.__fb("js.dl_done_restart", "✅ اكتمل التحميل! جاري إعادة التشغيل...")), setTimeout(() => window.electronAPI.restartApp(), 2e3)) : (t && (t.innerText = window.__fb("js.dl_fail_retry", "❌ فشل التحميل. أعد المحاولة.")), setTimeout(() => d(e), 5e3))
  })()
}

function a(e, t) {
  document.getElementById("custom-update-modal")?.remove();
  const n = document.createElement("div");
  n.id = "custom-update-modal", n.style = "\n        position: fixed; top: 0; left: 0; width: 100%; height: 100%;\n        background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);\n        display: flex; align-items: center; justify-content: center; z-index: 99999;\n        animation: fadeIn 0.3s ease;\n    ", n.innerHTML = `\n        <div style="background: #1e1f22; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 30px; width: 400px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5); animation: zoomIn 0.3s ease;">\n            <div style="width: 60px; height: 60px; background: #3b82f6; border-radius: 15px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">\n                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>\n            </div>\n            <h2 style="color: white; margin-bottom: 10px; font-size: 20px;">${window.__fb("js.upd_new", "تحديث جديد متاح!")}</h2>\n            <p style="color: #94a3b8; font-size: 14px; margin-bottom: 25px;">${window.__f("js.upd_ready_q", {v: e}, `إصدار Foxy ${e} جاهز للتحميل. هل تريد البدء الآن؟`)}</p>\n            \n            <div id="update-progress-container" class="hidden" style="background:rgba(255,255,255,0.05);border-radius:12px;padding:12px;margin-bottom:20px;">\n                <div style="background:rgba(255,255,255,0.1);border-radius:8px;height:6px;overflow:hidden;">\n                    <div id="update-progress-bar" style="background:#3b82f6;height:100%;width:0%;transition:width 0.3s;"></div>\n                </div>\n                <div id="update-status-msg" style="color: #3b82f6; font-size: 12px; margin-top: 8px; font-weight: bold;">${window.__fb("js.preparing", "جاري التحضير...")}</div>\n            </div>\n\n            <div style="display: flex; gap: 10px;">\n                <button id="close-update-btn" style="flex: 1; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: white; cursor: pointer; font-weight: bold;">${window.__fb("js.upd_later", "ليس الآن")}</button>\n                <button id="accept-update-btn" style="flex: 2; padding: 12px; border-radius: 12px; border: none; background: #3b82f6; color: white; cursor: pointer; font-weight: bold; shadow: 0 4px 15px rgba(59,130,246,0.3);">${window.__fb("js.upd_install", "تحميل وتثبيت")}</button>\n            </div>\n        </div>\n        <style>\n            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }\n            @keyframes zoomIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }\n            #accept-update-btn:hover { background: #2563eb; transform: translateY(-2px); transition: 0.2s; }\n            #close-update-btn:hover { background: rgba(255,255,255,0.05); }\n        </style>\n    `, document.body.appendChild(n), document.getElementById("close-update-btn").onclick = r, document.getElementById("accept-update-btn").onclick = t
}

function s(e, t = null) {
  document.getElementById("expired-version-screen")?.remove();
  const n = document.createElement("div");
  n.id = "expired-version-screen", n.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.95);backdrop-filter:blur(20px);display:flex;align-items:center;justify-content:center;z-index:999999;", n.innerHTML = `\n        <div style="background:linear-gradient(135deg,#1e1f22,#2d2f34);border:1px solid rgba(245,158,11,0.3);\n            border-radius:24px;padding:40px;width:420px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,0.7);">\n            <div style="width:70px;height:70px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:20px;\n                display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">\n                <svg width="35" height="35" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24">\n                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>\n                </svg>\n            </div>\n            <h2 style="color:white;font-size:22px;font-weight:800;margin:0 0 10px;">${window.__fb("js.expired", "إصدار منتهي الصلاحية")}</h2>\n            <p style="color:#94a3b8;font-size:14px;margin:0 0 25px;line-height:1.6;">\n                ${window.__f("js.expired_msg", {v: `<span style="color:#f59e0b;font-weight:700;">${e}</span>`}, `الإصدار <span style="color:#f59e0b;font-weight:700;">${e}</span> لم يعد مدعوماً.<br>يرجى تحميل أحدث إصدار للاستمرار.`)}\n            </p>\n            <button id="download-latest-btn" style="width:100%;padding:14px;border-radius:12px;border:none;background:#f59e0b;color:white;cursor:pointer;font-weight:bold;font-size:16px;">${window.__fb("js.dl_latest", "تحميل الإصدار الأخير")}</button>\n        </div>\n    `, document.body.appendChild(n), document.getElementById("download-latest-btn").onclick = () => {
    if (window.FoxyNativeApp?.isAndroidApp && t && window.electronAPI?.startUpdateDownload) {
      window.electronAPI.startUpdateDownload({ version: e, url: t }).catch(() => {});
      return;
    }
    t ? window.open(t, "_blank") : "function" == typeof window.downloadDesktopApp && window.downloadDesktopApp()
  }
}

function r() {
  const e = document.getElementById("custom-update-modal");
  e && (e.style.opacity = "0", e.style.transition = "0.3s", setTimeout(() => e.remove(), 300))
}

function c() {
  r();
  const e = document.createElement("div");
  e.id = "custom-update-modal", e.style = "\n        position: fixed; top: 0; left: 0; width: 100%; height: 100%;\n        background: rgba(0,0,0,0.85); backdrop-filter: blur(10px);\n        display: flex; align-items: center; justify-content: center; z-index: 99999;\n    ", e.innerHTML = '\n        <div style="background: #1e1f22; border: 2px solid #10b981; border-radius: 20px; padding: 30px; width: 400px; text-align: center; box-shadow: 0 0 30px rgba(16,185,129,0.2);">\n            <div style="width: 60px; height: 60px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">\n                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>\n            </div>\n                        <h2 style="color: white; margin-bottom: 10px;">' + window.__fb("js.dl_complete", "اكتمل التحميل!") + '</h2>\n            <p style="color: #94a3b8; font-size: 14px; margin-bottom: 25px;">' + window.__fb("js.dl_complete_msg", "تم تحميل التحديث بنجاح. يجب إعادة تشغيل البرنامج الآن لتثبيت التحديث.") + '</p>\n            <button id="restart-app-btn" style="width: 100%; padding: 14px; border-radius: 12px; border: none; background: #10b981; color: white; cursor: pointer; font-weight: bold; font-size: 16px;">' + window.__fb("js.restart_now", "إعادة التشغيل الآن") + '</button>\n        </div>\n    '
, document.body.appendChild(e), document.getElementById("restart-app-btn").onclick = () => {
    window.electronAPI.restartApp()
  }
}!async function() {
  const e = document.querySelector(".app-version"),
    t = document.querySelector('button[onclick*="window.checkUpdate"]');
  if (window.electronAPI && "function" == typeof window.electronAPI.getAppVersion) {
    const n = await window.electronAPI.getAppVersion();
    e && (e.innerText = `foxy-v${n} ${window.__fb("js.tag_app", "(برنامج)")}`), t && (t.innerText = window.__fb("app_loading.check_updates_app", "التحقق من تحديثات البرنامج"))
  } else {
    if (e) {
      e.innerText = window.__fb("js.ver_web_loading", "foxy-web (جاري التحميل...)");
      try {
        const t = await fetch("/sw.js", {
            cache: "no-store"
          }),
          n = (await t.text()).match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
        n && n[1] ? e.innerText = `${n[1]} ${window.__fb("app_settings.version_browser", "(متصفح)")}` : e.innerText = window.__fb("js.ver_web", "foxy-web (متصفح)")
      } catch (t) {
        e.innerText = window.__fb("js.ver_web", "foxy-web (متصفح)")
      }
    }
    t && (t.innerText = window.__fb("app_loading.check_updates_website", "التحقق من تحديثات الموقع"))
  }
}(), window.downloadDesktopApp = async function() {
    let e = "https://www.mediafire.com/file/igotdg0fxzowh41/Foxy.exe/file";
    try {
      const {
        db: t
      } = await import("./firebase-config.js"), {
        doc: n,
        getDoc: a
      } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js"), s = await a(n(t, "app-config", "global"));
      if (s.exists()) {
        const t = s.data();
        e = t.updates?.downloadURL || t.downloadURL || e
      }
    } catch (t) {}
    window.open(e, "_blank", "noopener")
  },
  function() {
    const e = !window.electronAPI,
      t = window.foxyLayout ? "desktop" === window.foxyLayout() : window.innerWidth > 768;
    if (!e || !t) return;
    const n = document.getElementById("nav-download-app-btn");
    n && n.classList.remove("hidden"), localStorage.getItem("app-banner-dismissed") || setTimeout(() => {
      const e = document.createElement("div");
      e.id = "app-install-banner", e.innerHTML = '\n            <div style="\n                position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);\n                background: linear-gradient(135deg, #1e1f22 0%, #2d2f34 100%);\n                border: 1px solid rgba(59,130,246,0.4);\n                box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.1);\n                border-radius: 20px; padding: 20px 24px;\n                display: flex; align-items: center; gap: 18px;\n                z-index: 99998; max-width: 480px; width: calc(100vw - 48px);\n                animation: bannerSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;\n            ">\n                <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #6366f1); border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">\n                    <svg width="24" height="24" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24">\n                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>\n                    </svg>\n                </div>\n                <div style="flex: 1; min-width: 0;">\n                    <p style="color: white; font-weight: 700; font-size: 14px; margin: 0 0 4px; line-height: 1.7; text-align: start; unicode-bidi: plaintext;">' + window.__fb("js.try_desktop", "🚀 جرب تطبيق Foxy للكمبيوتر") + '</p>\n                    <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.7; text-align: start; unicode-bidi: plaintext;">' + window.__fb("js.try_desktop_d", "أداء أفضل، إشعارات فورية وتجربة أكثر سلاسة") + '</p>\n                </div>\n                <div style="display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;">\n                    <button onclick="window.downloadDesktopApp(); document.getElementById(\'app-install-banner\').remove(); localStorage.setItem(\'app-banner-dismissed\',\'1\');" style="\n                        background: #3b82f6; color: white; border: none; padding: 8px 16px;\n                        border-radius: 10px; font-weight: 700; font-size: 12px; cursor: pointer;\n                        white-space: nowrap; line-height: 1.6; transition: background 0.2s;\n                    " onmouseover="this.style.background=\'#2563eb\'" onmouseout="this.style.background=\'#3b82f6\'">' + window.__fb("js.dl_free", "📥 تحميل مجاناً") + '</button>\n                    <button onclick="document.getElementById(\'app-install-banner\').remove(); localStorage.setItem(\'app-banner-dismissed\',\'1\');" style="\n                        background: transparent; color: #64748b; border: 1px solid rgba(255,255,255,0.08);\n                        padding: 6px 12px; border-radius: 8px; font-size: 11px; cursor: pointer;\n                        white-space: nowrap; line-height: 1.6; transition: color 0.2s;\n                    " onmouseover="this.style.color=\'#94a3b8\'" onmouseout="this.style.color=\'#64748b\'">' + window.__fb("js.no_thanks", "لا شكراً") + '</button>\n                </div>\n            </div>\n            <style>\n                @keyframes bannerSlideUp {\n                    from { opacity: 0; transform: translateX(-50%) translateY(30px); }\n                    to   { opacity: 1; transform: translateX(-50%) translateY(0);    }\n                }\n            </style>\n        ', (e.firstElementChild || e).setAttribute("dir", document.documentElement.dir || "rtl"), document.body.appendChild(e)
    }, 8e3)
  }(), _foxyBtn("send-btn", async () => {
    if (window.waitForAttachments) await window.waitForAttachments("chat-msg-input");
    const e = (window.foxyComposerText ? window.foxyComposerText(chatMsgInput) : chatMsgInput.value).trim();
    let t = "";
    if (window.getAttachments) {
      const e = window.getAttachments("chat-msg-input").filter(e => "ready" === e.status && e.url);
      e.length > 0 && (t = "\n" + e.map(e => e.url).join(" "))
    }
    const n = e + t;
  n && (broadcastPeerPayload({
    type: "chat",
    msg: n
  }), addChatMsg(window.__fb("app_chat.you_label", "أنت"), n, !0), window.foxyComposerClear && window.foxyComposerClear(chatMsgInput), window.syncFullscreenMediaUI && window.syncFullscreenMediaUI())
}, "chat send"), (chatMsgInput ? chatMsgInput.addEventListener("keydown", e => {
    "Enter" === e.key && !e.shiftKey && (e.preventDefault(), document.getElementById("send-btn").click())
  }) : void 0), window.isForceDeafened = !1, window.toggleDeafen = function(e) {

    !0 === e && (window.isForceDeafened = !0), window.isForceDeafened && !0 !== e ? window.isDeafened = !0 : window.isDeafened = void 0 !== e ? e : !window.isDeafened, "undefined" != typeof isDeafened && (isDeafened = window.isDeafened), document.querySelectorAll("audio").forEach(e => e.muted = window.isDeafened);
    const t = document.getElementById("screen-video");
    t && (t.muted = !0), window.syncRemoteScreenAudioPlayback?.(), "undefined" != typeof connections && broadcastPeerPayload({
      type: "deafen-status",
      deafened: window.isDeafened,
      forceDeafened: window.isForceDeafened
    });
    const n = document.getElementById("deafen-btn");
    if (n) {
      const e = window.isForceDeafened || window.isDeafened ? "bg-red-500/10" : "bg-white/5",
        t = window.isForceDeafened ? "text-red-500" : window.isDeafened ? "text-red-400" : "text-slate-400";
      n.className = `voice-mini-btn transition-all ${e} ${t}`
    }
    const o = document.getElementById("headphone-slash");
    o && o.classList.toggle("hidden", !window.isDeafened);
    const i = document.getElementById("dm-call-deafen-btn"),
      d = document.getElementById("dm-voice-deafen-btn"),
      a = document.getElementById("mobile-deafen-btn"),
      s = document.getElementById("integrated-deafen-btn"),
      r = document.getElementById("integrated-headphone-slash");
    if (s && (s.classList.toggle("bg-red-500/20", window.isDeafened), s.classList.toggle("text-red-400", window.isDeafened), r && r.classList.toggle("hidden", !window.isDeafened)), i && (i.classList.toggle("bg-red-500/20", window.isDeafened), i.classList.toggle("text-red-400", window.isDeafened)), d) {
      d.classList.toggle("bg-red-500/20", window.isDeafened), d.classList.toggle("text-red-400", window.isDeafened), d.classList.toggle("text-slate-400", !window.isDeafened), d.classList.toggle("bg-white/5", !window.isDeafened);
      const e = document.getElementById("dm-voice-headphone-slash");
      e && e.classList.toggle("hidden", !window.isDeafened)
    }
    if (a) {
      a.classList.toggle("is-active", window.isDeafened);
      const e = document.getElementById("mobile-headphone-slash");
      e && e.classList.toggle("hidden", !window.isDeafened)
    }
    "function" == typeof window.updateGlobalMediaStatus && window.updateGlobalMediaStatus(void 0, window.isDeafened, void 0, window.isForceMuted, window.isForceDeafened), "function" == typeof window.updateDmPresence && window.updateDmPresence(), "function" == typeof updatePlayerStatusUI && updatePlayerStatusUI("me", null, window.isDeafened, !1, window.isForceMuted, window.isForceDeafened), "function" == typeof window.playChannelSound && window.playChannelSound(window.isDeafened ? "deafen" : "undeafen"), localStorage.setItem("isDeafened", window.isDeafened)
  }, window.toggleMute = function(e) {
    !0 === e && (window.isForceMuted = !0);
    const i = window.isMuted;
    if (window.isForceMuted && !0 !== e ? (window.isMuted = !0, void 0 === e && "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.mic_blocked", "لا يمكنك فتح الميكروفون في هذه الغرفة حالياً"), "error")) : window.isMuted = void 0 !== e ? e : !window.isMuted, "undefined" != typeof isMuted && (isMuted = window.isMuted), void 0 !== e && i === window.isMuted) return;
    "undefined" != typeof localStream && localStream && (localStream.getAudioTracks()[0].enabled = !window.isMuted), "undefined" != typeof connections && broadcastPeerPayload({
      type: "mic-status",
      muted: window.isMuted,
      forceMuted: window.isForceMuted
    });
    const d = document.getElementById("mute-btn");
    if (d) {
      const e = window.isForceMuted ? "bg-red-500/10" : window.isMuted ? "bg-white/5" : "bg-emerald-500/10",
        t = window.isForceMuted ? "text-red-500" : window.isMuted ? "text-slate-400" : "text-emerald-400";
      d.className = `p-2 flex-1 rounded-lg flex flex-col items-center gap-1 transition-all ${e} ${t}`;
      const n = document.getElementById("mic-off-path");
      n && (n.classList.remove("text-red-400", "text-slate-400"), n.classList.add(window.isForceMuted ? "text-red-500" : "text-slate-400"))
    }
    const a = document.getElementById("mic-on-path"),
      s = document.getElementById("mic-off-path");
    a && a.classList.toggle("hidden", window.isMuted), s && s.classList.toggle("hidden", !window.isMuted);
    const r = document.getElementById("mobile-mic-btn-main");
    r && (r.classList.toggle("is-active", window.isMuted), window.isForceMuted ? r.classList.add("bg-red-500/20", "text-red-500", "border-red-500/30") : r.classList.remove("bg-red-500/20", "text-red-500", "border-red-500/30"));
    const c = document.getElementById("mobile-mic-on-path"),
      l = document.getElementById("mobile-mic-off-path");
    c && c.classList.toggle("hidden", window.isMuted), l && l.classList.toggle("hidden", !window.isMuted);
    const u = document.getElementById("dm-call-mute-btn"),
      w = document.getElementById("dm-voice-mute-btn");
    if (u && (u.classList.toggle("bg-red-500/20", window.isMuted || window.isForceMuted), u.classList.toggle("text-red-400", window.isMuted || window.isForceMuted)), w) {
      w.classList.toggle("bg-red-500/20", window.isMuted || window.isForceMuted), w.classList.toggle("text-red-400", window.isMuted || window.isForceMuted), w.classList.toggle("bg-emerald-500/10", !window.isMuted && !window.isForceMuted), w.classList.toggle("text-emerald-400", !window.isMuted && !window.isForceMuted);
      const e = document.getElementById("dm-voice-mic-on-path"),
        t = document.getElementById("dm-voice-mic-off-path");
      e && e.classList.toggle("hidden", window.isMuted || window.isForceMuted), t && t.classList.toggle("hidden", !window.isMuted && !window.isForceMuted)
    }
    "function" == typeof window.updateGlobalMediaStatus && window.updateGlobalMediaStatus(window.isMuted, void 0, void 0, window.isForceMuted, window.isForceDeafened), "function" == typeof window.updateDmPresence && window.updateDmPresence(), "function" == typeof updatePlayerStatusUI && updatePlayerStatusUI("me", window.isMuted, null, !1, window.isForceMuted, window.isForceDeafened), "function" == typeof window.playChannelSound && window.playChannelSound(window.isMuted ? "mute" : "unmute"), "function" == typeof window.syncFullscreenMediaUI && window.syncFullscreenMediaUI(), localStorage.setItem("isMuted", window.isMuted)
  }, _foxyBtn("mute-btn", function(e) {
    e && e.stopPropagation(), window.toggleMute()
  }, "voice mic toggle");

function _foxyBtn(id, handler, label) {
  var el = document.getElementById(id);
  if (!el) {
    if (window.FOXY_DEBUG) window.foxyLog("warn", "[Foxy][ui] زر غير موجود: " + id + " (" + label + ") — تم تجاوزه بأمان", {
      url: location.pathname, readyState: document.readyState
    });
    return false;
  }
  el.onclick = handler;
  return true;
}
_foxyBtn("mute-btn", function(e) {
  e && e.stopPropagation(), window.toggleMute()
}, "voice mic toggle");
const l = document.getElementById("deafen-btn");
l && (l.onclick = function(e) {
  e && e.stopPropagation(), "function" == typeof window.toggleDeafen && window.toggleDeafen()
}), window.syncScreenShareUI = function() {
  const isSharing = !!(window.isScreenSharing || (window.localScreenStream?.getVideoTracks?.().some(e => "ended" !== e.readyState)));

   const startBtn = document.getElementById("start-screen-trigger");
   const stopBtn = document.getElementById("stop-screen-btn");
   const activeControls = document.getElementById("screen-active-controls");
   if (startBtn) startBtn.classList.toggle("hidden", isSharing);
   if (stopBtn) stopBtn.classList.toggle("hidden", !isSharing);
   if (activeControls) activeControls.classList.toggle("hidden", !isSharing);

  const mobileExtraBtn = document.getElementById("mobile-screen-btn");
  if (mobileExtraBtn) {
    const iconContainer = document.getElementById("mobile-screen-icon-container");
    const iconStart = document.getElementById("mobile-screen-icon-start");
    const iconStop = document.getElementById("mobile-screen-icon-stop");
    const textSpan = document.getElementById("mobile-screen-text");

    if (isSharing) {
      mobileExtraBtn.classList.add("screen-share-active");
      mobileExtraBtn.classList.add("bg-red-500/10", "text-red-400", "border-red-500/30", "hover:bg-red-500/20");
      mobileExtraBtn.classList.remove("bg-white/5", "text-gray-300", "border-white/10", "hover:bg-white/10");
      if (iconContainer) {
        iconContainer.classList.add("bg-red-500/20", "text-red-400");
        iconContainer.classList.remove("bg-blue-500/10", "text-blue-400", "group-hover:bg-blue-500/20");
      }
      if (iconStart) iconStart.classList.add("hidden");
      if (iconStop) iconStop.classList.remove("hidden");
      if (textSpan) textSpan.textContent = window.__fb("app_voice.stop_sharing", "إيقاف المشاركة");
    } else {
      mobileExtraBtn.classList.remove("screen-share-active");
      mobileExtraBtn.classList.add("bg-white/5", "text-gray-300", "border-white/10", "hover:bg-white/10");
      mobileExtraBtn.classList.remove("bg-red-500/10", "text-red-400", "border-red-500/30", "hover:bg-red-500/20");
      if (iconContainer) {
        iconContainer.classList.add("bg-blue-500/10", "text-blue-400", "group-hover:bg-blue-500/20");
        iconContainer.classList.remove("bg-red-500/20", "text-red-400");
      }
      if (iconStart) iconStart.classList.remove("hidden");
      if (iconStop) iconStop.classList.add("hidden");
      if (textSpan) textSpan.textContent = window.__fb("web.t154", "بث الشاشة");
    }
  }

  const mobileMainBtn = document.getElementById("mobile-screen-btn-main");
  if (mobileMainBtn) {
    const mainStartPath = document.getElementById("mobile-screen-main-icon-start");
    const mainStopPath = document.getElementById("mobile-screen-main-icon-stop");

    if (isSharing) {
      mobileMainBtn.classList.add("screen-share-active");
      mobileMainBtn.classList.add("bg-red-500/20", "text-red-400", "border-red-500/30", "hover:bg-red-500/30", "is-active");
      mobileMainBtn.classList.remove("bg-white/5", "text-gray-300", "border-white/10");
      mobileMainBtn.title = window.__fb("js.share_stop_t", "إيقاف مشاركة الشاشة");
      if (mainStartPath) mainStartPath.classList.add("hidden");
      if (mainStopPath) mainStopPath.classList.remove("hidden");
    } else {
      mobileMainBtn.classList.remove("screen-share-active");
      mobileMainBtn.classList.add("bg-white/5", "text-gray-300", "border-white/10");
      mobileMainBtn.classList.remove("bg-red-500/20", "text-red-400", "border-red-500/30", "hover:bg-red-500/30", "is-active");
      mobileMainBtn.title = window.__fb("app_navigation.screen_share_title_btn", "مشاركة الشاشة");
      if (mainStartPath) mainStartPath.classList.remove("hidden");
      if (mainStopPath) mainStopPath.classList.add("hidden");
    }
  }

  const integratedBtn = document.getElementById("integrated-screen-btn");
  const integratedLive = document.getElementById("integrated-screen-live");
  if (integratedBtn) {
    if (isSharing) {
      integratedBtn.classList.add("bg-emerald-500/20", "text-emerald-400", "border-emerald-500/30");
      integratedBtn.classList.remove("bg-white/5", "text-gray-300", "border-white/10");
    } else {
      integratedBtn.classList.add("bg-white/5", "text-gray-300", "border-white/10");
      integratedBtn.classList.remove("bg-emerald-500/20", "text-emerald-400", "border-emerald-500/30");
    }
  }
  if (integratedLive) integratedLive.classList.toggle("hidden", !isSharing);
}, window.toggleIntegratedScreenShare = function() {
  const isSharing = !!(window.isScreenSharing || (document.getElementById("stop-screen-btn") && !document.getElementById("stop-screen-btn").classList.contains("hidden")) || (window.localScreenStream?.getVideoTracks?.().some(e => "ended" !== e.readyState)));
  if (isSharing) {
    "function" == typeof stopScreenShare && stopScreenShare();
  } else {
    "function" == typeof openScreenSettings && openScreenSettings();
  }
}, window.isCameraEnabled = window.isCameraEnabled || !1;
let u = !1;
window.toggleCamera = async function() {
  if (u) return;
  u = !0;
  const e = window.isCameraEnabled;
  window.isCameraEnabled = !window.isCameraEnabled;
  const t = window.syncCameraUI || ((e = !1) => {
    [{
      id: "video-active-room-btn",
      on: "video-active-on-path",
      off: "video-active-off-path"
    }, {
      id: "mobile-video-btn-main",
      on: "mobile-video-on-path-main",
      off: "mobile-video-off-path-main"
    }, {
      id: "mobile-video-btn-extra",
      on: "mobile-video-on-path-extra",
      off: "mobile-video-off-path-extra"
    }].forEach(t => {
      const n = document.getElementById(t.id);
      if (!n) return;
      e ? (n.classList.add("opacity-50", "animate-pulse"), n.disabled = !0) : (n.classList.remove("opacity-50", "animate-pulse"), n.disabled = !1, t.id.startsWith("mobile-") ? n.classList.toggle("is-active", window.isCameraEnabled) : window.isCameraEnabled ? (n.classList.add("bg-emerald-500/20", "text-emerald-400", "border-emerald-500/30"), n.classList.remove("bg-white/5", "text-gray-300", "border-white/10")) : (n.classList.add("bg-white/5", "text-gray-300", "border-white/10"), n.classList.remove("bg-emerald-500/20", "text-emerald-400", "border-emerald-500/30")));
      const o = document.getElementById(t.on),
        i = document.getElementById(t.off);
      o && o.classList.toggle("hidden", !window.isCameraEnabled), i && i.classList.toggle("hidden", window.isCameraEnabled)
    }), "function" == typeof window.syncFullscreenMediaUI && window.syncFullscreenMediaUI()
  });
  window.syncCameraUI = t, t(!0);
  try {
    if (window.isCameraEnabled) {
      const cameraTrack = await window.ensureCameraCapture();
      if (!cameraTrack) throw new Error("Camera capture is unavailable");
      // A single video m-line can carry either the camera or the screen. Screen
      // share takes priority; the camera track is retained for restoration.
      if (!window.isScreenSharing) {
        const attachResults = await Promise.allSettled(Object.values(window.calls || {}).map(call =>
          window.replaceCallVideoTrack ? window.replaceCallVideoTrack(call, cameraTrack, "camera") : Promise.resolve()
        ));
        const attachFailures = attachResults.filter(result => result.status === "rejected").length;
        if (attachFailures) window.foxyLog?.("warn", "[Foxy][video] تعذر توصيل الكاميرا لبعض الأقران", { failures: attachFailures });
      }
    } else {
      const detachResults = await Promise.allSettled(Object.values(window.calls || {}).map(call =>
        call?._foxyVideoSource === "camera" && window.replaceCallVideoTrack
          ? window.replaceCallVideoTrack(call, null, "camera")
          : Promise.resolve()
      ));
      const detachFailures = detachResults.filter(result => result.status === "rejected").length;
      if (detachFailures) window.foxyLog?.("warn", "[Foxy][video] تعذر إيقاف الكاميرا لدى بعض الأقران", { failures: detachFailures });
      window.stopCameraCapture?.();
    }
    "undefined" != typeof connections && broadcastPeerPayload({
      type: "video-status",
      enabled: window.isCameraEnabled && !window.isScreenSharing
    }), "function" == typeof window.updateGlobalMediaStatus && window.updateGlobalMediaStatus(void 0, void 0, void 0, void 0, void 0), "function" == typeof window.refreshMyVoicePresence && window.refreshMyVoicePresence(), "function" == typeof updatePlayerStatusUI && updatePlayerStatusUI("me", null, null, !1, !1, !1), "function" == typeof window.updateAllCallBitrates && window.updateAllCallBitrates(), "function" == typeof window.refreshVoiceChannelMembers && window.refreshVoiceChannelMembers()
  } catch (n) {
    window.isCameraEnabled = e;
    window.isCameraEnabled || window.stopCameraCapture?.();
    t(!1);
    "NotAllowedError" === n.name ? "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.cam_denied", "تم رفض الوصول للكاميرا. يرجى تفعيل الصلاحية من إعدادات المتصفح."), "error") : "NotReadableError" !== n.name && "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.cam_fail", "فشل في تشغيل الكاميرا. يرجى المحاولة مرة أخرى."), "error")
  } finally {
    u = !1, t(!1)
  }
};
const w = document.getElementById("settings-mini-btn");
w && w.addEventListener("click", e => {
  e.stopPropagation()
}), window.resetForceMute = function() {
  window.isForceMuted = !1
}, window.resetForceDeafen = function() {
  window.isForceDeafened = !1
}, _foxyBtn("call-btn", () => {
  const e = document.getElementById("peer-id-input").value.trim();
  const _myId = window.myId || window.state?.myUid || "";
  if (e && e !== _myId) {
    "undefined" != typeof isGuest && (isGuest = !0),     connectToPeer(e), window.showRoomView && window.showRoomView();

    window.__voiceManualRoomId = e;
    "function" == typeof window.setVoicePanelRoomLabel && window.setVoicePanelRoomLabel(), "function" == typeof window.startSessionTimer && window.startSessionTimer()
  }
}, "peer call"), window.leaveVoiceChannel = async function(e = !1) {
  const t = document.getElementById("active-room-indicator"),
    n = document.getElementById("view-room"),
    o = document.getElementById("dm-call-voice-bar");
  const inVoiceSession = "function" == typeof window.isVoiceSessionActive && window.isVoiceSessionActive();
  //FIX: تشخيص — مين اللي بيطلب مغادرة القناة الصوتية؟ (كان بيحصل بشكل
  //متكرر وبيقتل اتصال المشاهدة). الستاك مش ظاهر في اللوج فبنطبعه هنا.
  try {
    window.foxyLog?.("warn", "[Foxy][voice] مغادرة القناة الصوتية", {
      forced: !!e,
      activeVoiceChannelId: window.state?.activeVoiceChannelId || null,
      calls: Object.keys(window.calls || {}).length,
      stack: (new Error().stack || "").split("\n").slice(2, 8).map(line => line.trim()).join(" <- "),
      timestamp: new Date().toISOString()
    });
  } catch (_) {}
  return !(t && !t.classList.contains("hidden") || n && n.classList.contains("active-view") || o && !o.classList.contains("hidden") || window.isDmCalling || inVoiceSession) || (window.__voiceTransitioning = !0, window.analytics && "function" == typeof window.analytics.logVoiceLeave && window.analytics.logVoiceLeave(), "function" == typeof window.beforeHangup && window.beforeHangup(), "function" == typeof window.releaseVoiceSession && await window.releaseVoiceSession(), "function" == typeof window.disconnectFromRoom && window.disconnectFromRoom(), window.__voiceTransitioning = !1, !0)
}, _foxyBtn("hangup-btn", async () => {
  await window.leaveVoiceChannel()
}, "hang up");
let m = 0;
window.onbeforeunload = () => {
  try {
    if ("function" == typeof window.leaveVoiceChannel) window.leaveVoiceChannel(!0);
    const activePeer = window.peer;
    const activeConnections = window.connections || {};
    activePeer && (Object.values(activeConnections).forEach(connection => {
      try {
        connection?.conn?.close?.();
      } catch (_) {}
    }), activePeer.destroy?.());
  } catch (_) {

  }
}, window.addEventListener("pagehide", () => {
  "function" == typeof window.pipManager?.stop && window.pipManager.stop()
}), window.addEventListener("pageshow", async e => {
  await new Promise(r => setTimeout(r, 500));
  "function" == typeof window.restoreLocalStreamIfNeeded && window.restoreLocalStreamIfNeeded();
  if (e.persisted && window.peer && (window.peer.disconnected || window.peer.destroyed)) {
    "function" == typeof window.rebuildPeer && setTimeout(() => window.rebuildPeer(), 1e3)
  }
}), "function" == typeof initializeUI ? initializeUI() : window.addEventListener("load", () => {
  "function" == typeof initializeUI && initializeUI()
}), window.addEventListener("online", () => {

  addSystemMsg(window.__fb("js.net_back", "تم استعادة اتصال الإنترنت. جاري الاستعادة بدون فصل...")), updateSignalingStatus("online"), "function" == typeof window.setNetBanner && window.setNetBanner("reconnecting"), "function" == typeof window._gentleNetRecovery ? window._gentleNetRecovery("browser-online-main") : ("function" == typeof hardReset && window.peer && window.peer.destroyed && hardReset("browser-online-main-peer-destroyed"))
}), window.addEventListener("offline", () => {
  addSystemMsg(window.__fb("js.net_gone", "انقطع اتصال الإنترنت. بانتظار العودة...")), updateSignalingStatus("error"), "function" == typeof window.setNetBanner && window.setNetBanner("offline")
}), window.testExpressTurn = async function() {
  addSystemMsg(window.__fb("js.ice_testing", "🚀 جاري اختبار جميع سيرفرات ICE للعثور على الأفضل..."));
  const servers = sortedIceServers || ICE_SERVERS;
  let bestName = "Unknown", bestLatency = Infinity;

  for (const server of servers) {
    const name = server.urls[0].includes("expressturn") ? "ExpressTURN"
      : server.urls[0].includes("metered") ? "Metered"
      : server.urls[0].includes("openrelay") ? "OpenRelay"
      : server.urls[0].includes("google") ? "Google STUN" : "Unknown";

    try {
      const result = await testSingleServer(server, 6000);
      if (result.latency < Infinity) {
        const emoji = result.relayFound ? "✅" : "📡";
        addSystemMsg(`${emoji} ${name}: ${result.latency}ms ${result.relayFound ? "(relay)" : "(STUN)"}`);
        if (result.latency < bestLatency) {
          bestLatency = result.latency;
          bestName = name;
        }
      } else {
        addSystemMsg(window.__f("js.ice_noanswer", {name: name}, `❌ ${name}: لم يستجب`));
      }
    } catch (_) {
      addSystemMsg(window.__f("js.ice_error", {name: name}, `❌ ${name}: خطأ`));
    }
  }

  if (bestLatency < Infinity) {
    addSystemMsg(window.__f("js.ice_best", {name: bestName, ms: bestLatency}, `🏆 أفضل سيرفر: ${bestName} (${bestLatency}ms)`));
    await window.rebenchmarkIce();
  } else {
    addSystemMsg(window.__fb("js.ice_all_fail", "❌ فشل اختبار جميع السيرفرات"));
  }
}, window.applyAudioSettings = async function() {
  const e = ++m;
  "function" == typeof window.showSettingsSaveBar && window.hideSettingsSaveBar();
  const t = document.getElementById("echo-cancel")?.checked ?? !0,
    n = document.getElementById("noise-gate-mode"),
    o = n ? n.value : "ai-hybrid",
    quickNoiseEnabled = localStorage.getItem("noiseSuppressionEnabled") !== "false",
    i = quickNoiseEnabled && ("ai-frozen" === o || "ai-dynamic" === o || "ai-obs" === o || "ai-hybrid" === o),
    d = quickNoiseEnabled && !i && "standard" === o;
  addSystemMsg(window.__fb("js.audio_updating", "جاري تحديث إعدادات الصوت والجودة..."));
  const a = {
    echoCancellation: t,
    noiseSuppression: d,
    autoGainControl: !i,
    googEchoCancellation: t,
    googExperimentalEchoCancellation: t,
    googAutoGainControl: !i,
    googNoiseSuppression: d,
    googHighpassFilter: !0,
    googTypingNoiseDetection: !0,
    googAudioMirroring: !1
  };
  try {
    await ensureLocalStream();
    let t = await navigator.mediaDevices.getUserMedia({
      audio: a
    });
    if (e !== m) return void t.getTracks().forEach(e => e.stop());
    if (i && "function" == typeof window.applyAiNoiseSuppression) {
      const n = await window.applyAiNoiseSuppression(t, o);
      if (e !== m) return t.getTracks().forEach(e => e.stop()), void(n && n !== t && n.getTracks().forEach(e => e.stop()));
      n && (t = n)
    } else "function" == typeof window.stopAiNoiseSuppression && window.stopAiNoiseSuppression();
    if (e !== m) return void t.getTracks().forEach(e => e.stop());
    const n = t.getAudioTracks()[0];
    n.enabled = !isMuted;
    const d = localStream,
      s = Object.values(calls).map(async e => {
        const t = e.peerConnection.getSenders().find(e => e.track && "audio" === e.track.kind);
        t && (await t.replaceTrack(n), updateCallBitrate(e))
      });
    if (await Promise.all(s), d && d !== t) try {
      d.getTracks().forEach(e => e.stop())
    } catch (err) {
      console.warn('[Audio] Failed to stop old stream tracks:', err);
    }
    localStream = t, window.localStream = localStream, "function" == typeof visualize && visualize(localStream, "me"), addSystemMsg(window.__f("js.settings_bitrate", {q: window.selectedBitrate||48}, `✅ تم تحديث الإعدادات بنجاح. الجودة الحالية: ${window.selectedBitrate||48} kbps`))
  } catch (e) {
    addSystemMsg(window.__fb("js.mic_fail", "⚠️ تعذر تحديث إعدادات الميكروفون. تأكد من إعطاء الصلاحيات."))
  }
}, window.updateNoiseSuppressionToggleUI = function() {
  const e = document.getElementById("noise-suppression-toggle");
  if (!e) return;
  const slash = document.getElementById("noise-suppression-off-slash");
  const t = localStorage.getItem("noiseSuppressionEnabled"),
    n = "false" !== t && ("true" === t || (localStorage.getItem("noiseGateMode") || "ai-hybrid") !== "none");
  e.classList.toggle("text-emerald-400", n), e.classList.toggle("text-gray-500", !n), slash && slash.classList.toggle("hidden", n), e.title = n ? window.__fb("web.h005", "عزل الضوضاء: مفعل") : window.__fb("js.noise_off", "عزل الضوضاء: متوقف"), e.setAttribute("aria-pressed", String(n));
}, window.toggleNoiseSuppression = async function() {
  const e = document.getElementById("noise-gate-mode"),
    t = localStorage.getItem("noiseSuppressionEnabled"),
    n = "false" !== t && ("true" === t || (e?.value || localStorage.getItem("noiseGateMode") || "ai-hybrid") !== "none");
  if (n) {
    const t = e?.value || localStorage.getItem("noiseGateMode") || "ai-hybrid";
    "none" !== t && localStorage.setItem("noiseSuppressionPreviousMode", t), localStorage.setItem("noiseSuppressionEnabled", "false"), localStorage.setItem("noiseGateMode", "none"), e && (e.value = "none"), "function" == typeof window.setActiveNoiseMode && window.setActiveNoiseMode("none")
  } else {
    const t = localStorage.getItem("noiseSuppressionPreviousMode") || "standard";
    localStorage.setItem("noiseSuppressionEnabled", "true"), localStorage.setItem("noiseGateMode", t), e && (e.value = t), "function" == typeof window.setActiveNoiseMode && window.setActiveNoiseMode(t)
  }
  window.updateNoiseSuppressionToggleUI(), "function" == typeof window.applyAudioSettings && await window.applyAudioSettings()
}, window.logout = async function() {
  if (await window.uiConfirm(window.__fb("app_dialogs.logout_confirm", "هل أنت متأكد من رغبتك في تسجيل الخروج؟"))) try {
    if ("function" == typeof window.leaveVoiceChannel) { try { await window.leaveVoiceChannel(!0); } catch (_) {} }
    if (window.voicePresenceCore && "function" == typeof window.voicePresenceCore.leavePresence) { try { await window.voicePresenceCore.leavePresence(); } catch (_) {} }
    await t.signOut(), window.location.reload()
  } catch (err) {
    console.error('[Auth] Logout failed:', err);
  }
}, document.addEventListener("DOMContentLoaded", () => {
  "function" == typeof window.updateNoiseSuppressionToggleUI && window.updateNoiseSuppressionToggleUI();
  const e = document.getElementById("bitrate-slider"),
    t = document.getElementById("bitrate-val");
  e && t && e.addEventListener("input", e => {
      const n = e.target.value;
      t.textContent = `${n} kbps`, window.selectedBitrate = parseInt(n), localStorage.setItem("vh-bitrate", n), typeof updateAllCallBitrates === "function" && updateAllCallBitrates(parseInt(n)), "function" == typeof window.showSettingsSaveBar && window.showSettingsSaveBar()
    }),
    function() {
      const e = document.querySelectorAll(".noise-mode-card"),
        t = document.getElementById("noise-gate-mode");

      function n(n) {
        t && (t.value = n), e.forEach(e => {
          const t = e.dataset.mode === n,
            o = e.querySelector(".mode-dot"),
            i = e.querySelector('input[type="radio"]'),
            d = e.querySelector(".echo-sub-option");
            e.classList.remove("border-blue-500/40", "bg-blue-500/5", "border-purple-500/40", "bg-purple-500/5", "border-emerald-500/40", "bg-emerald-500/5"), e.classList.add("border-white/5", "bg-black/20"), o && (o.classList.remove("bg-blue-500", "border-blue-500", "bg-purple-500", "border-purple-500", "bg-emerald-500", "border-emerald-500", "bg-white/30", "border-white/30"), o.classList.add("border-white/20")), d && d.classList.add("hidden"), t && (e.classList.remove("border-white/5", "bg-black/20"), i && (i.checked = !0), "ai-hybrid" === n ? (e.classList.add("border-emerald-500/40", "bg-emerald-500/5"), o && (o.classList.remove("border-white/20"), o.classList.add("bg-emerald-500", "border-emerald-500"))) : "standard" === n ? (e.classList.add("border-blue-500/40", "bg-blue-500/5"), o && (o.classList.remove("border-white/20"), o.classList.add("bg-blue-500", "border-blue-500")), d && d.classList.remove("hidden")) : (e.classList.add("border-white/10", "bg-white/5"), o && (o.classList.remove("border-white/20"), o.classList.add("bg-white/30", "border-white/30"))))
        })
      }
      e.length && t && (n(localStorage.getItem("noiseGateMode") || "ai-hybrid"), e.forEach(e => {
        e.addEventListener("click", () => {
          const o = e.dataset.mode;
          n(o), t.value = o, localStorage.setItem("noiseGateMode", o), "function" == typeof window.showSettingsSaveBar && window.showSettingsSaveBar()
        })
      }), window.setActiveNoiseMode = n)
    }()
}), "undefined" != typeof selectedBitrate && (window.selectedBitrate = selectedBitrate), window.setExpressTurnPrimary = function() {
  localStorage.setItem("voiceChat_expressTurnActive", "true"), addSystemMsg(window.__fb("js.rebench", "⭐ جاري إعادة اختبار السيرفرات...")), window.rebenchmarkIce && window.rebenchmarkIce()
}, document.addEventListener("DOMContentLoaded", () => {
  const e = document.getElementById("mobile-output-btn");
  if (e) {
    const t = document.getElementById("mobile-output-speaker-icon"),
      n = document.getElementById("mobile-output-phone-icon");
    if (t && n) {
      const e = "speaker" === window.currentAudioOutput;
      t.classList.toggle("hidden", !e), n.classList.toggle("hidden", e)
    }
    e.onclick = async () => {
      if ("function" == typeof window.toggleAudioOutput) {
        const e = await window.toggleAudioOutput(),
          t = document.getElementById("mobile-output-speaker-icon"),
          n = document.getElementById("mobile-output-phone-icon");
        if (t && n) {
          const o = "speaker" === e;
          t.classList.toggle("hidden", !o), n.classList.toggle("hidden", o), "function" == typeof addSystemMsg && addSystemMsg(o ? window.__fb("js.spk_on", "تم التبديل لمكبر الصوت") : window.__fb("js.spk_off", "تم التبديل لسماعة الهاتف"))
        }
      }
    }
  }
  "Notification" in window && "granted" !== Notification.permission && "denied" !== Notification.permission && Notification.requestPermission();
  const t = document.querySelector(".sidebar-profile-bottom");
  t && (t.onclick = e => {
    e.stopPropagation(), window.toggleProfilePopout()
  })
}), window.toggleProfilePopout = function(e) {
  const t = document.getElementById("user-profile-popout");
  if (!t) return;
  const n = t.classList.contains("hidden"),
    o = void 0 !== e ? e : n;
  t.classList.toggle("hidden", !o), o && window.openUserProfile()
}, window.openUserProfile = function(e) {
  const n = t?.currentUser?.uid;
  if (!n) return;
  const o = document.getElementById("user-profile-popout");
  if (!o) return;
  const i = document.getElementById("current-user-email"),
    d = (document.getElementById("sidebar-avatar"), document.getElementById("sidebar-initial"), document.getElementById("sidebar-popout-name")),
    a = document.getElementById("sidebar-popout-avatar"),
    s = document.getElementById("sidebar-popout-initial"),
    r = document.getElementById("sidebar-popout-banner");
  if (d && (d.innerText = i ? i.innerText : t.currentUser.displayName || window.__fb("app_chat.default_sender", "مستخدم")), a && s) {
    const e = window.currentUserProfile?.photoURL;

    const color = window.resolveProfileColor ? window.resolveProfileColor(n, window.currentUserProfile?.avatarColor || window.currentUserProfile?.bannerColor) : window.currentUserProfile?.bannerColor;
    window.applyAvatarToPair(a, s, e, t.currentUser?.displayName, 80, color, n)
  }
  if (r) {
    const e = window.currentUserProfile?.bannerURL || window.state?.serverMembersData?.[n]?.bannerURL,
      t = window.currentUserProfile?.avatarColor || window.currentUserProfile?.bannerColor || window.state?.serverMembersData?.[n]?.bannerColor;
    window.applyBannerStyle(r, e, t, n)
  }
  const l = document.getElementById("sidebar-popout-bio");
  l && (l.innerText = window.currentUserProfile?.bio || "", l.classList.toggle("hidden", !window.currentUserProfile?.bio));
  try {
    const _sl = window.currentUserProfile?.socialLinks || window._socialLinks || JSON.parse(localStorage.getItem("vh-user-socialLinks") || "{}");
    if (typeof window.renderPopoutSocials === "function") window.renderPopoutSocials("sidebar-popout-socials", _sl || {});
  } catch (e) {}
  o.style.bottom = "80px", o.style.left = "82px", o.style.top = "auto", o.style.transformOrigin = "bottom left", o.classList.remove("hidden"), o.classList.add("animate-in", "fade-in", "zoom-in", "duration-200"), document.getElementById("member-profile-popout")?.classList.add("hidden")
}, window.openMemberProfile = function(e, n) {
  if (!n) return;
  if (n === t?.currentUser?.uid) return window.openUserProfile(e);
  const o = document.getElementById("member-profile-popout");
  if (!o) return;
  window.lastMemberIdForProfile = n;
  let i = {
    displayName: window.__fb("app_chat.default_sender", "مستخدم"),
    photoURL: null,
    bannerURL: null,
    avatarColor: null,
    bannerColor: window.getDefaultAvatarColor ? window.getDefaultAvatarColor(n) : "#c34815",
    bio: "",
    socialLinks: {}
  };
  if (window.state) {
    if (window.state.members) {
      const e = window.state.members.find(e => e.id === n || e.uid === n);
      e && (i.displayName = e.displayName || e.name || i.displayName, i.photoURL = e.photoURL || e.avatarURL || i.photoURL, i.bannerURL = e.bannerURL || i.bannerURL, i.avatarColor = e.avatarColor || i.avatarColor, i.bannerColor = e.avatarColor || e.bannerColor || i.bannerColor, i.socialLinks = e.socialLinks || i.socialLinks)
    }
    if (window.state.serverMembersData && window.state.serverMembersData[n]) {
      const e = window.state.serverMembersData[n];
      i.displayName = e.displayName || e.name || i.displayName, i.photoURL = e.photoURL || e.avatarURL || i.photoURL, i.bannerURL = e.bannerURL || i.bannerURL, i.avatarColor = e.avatarColor || i.avatarColor, i.bannerColor = e.avatarColor || e.bannerColor || i.bannerColor, i.bio = e.bio || i.bio, i.socialLinks = e.socialLinks || i.socialLinks
    }
    if (window.state.globalUsersData && window.state.globalUsersData[n]) {
      const e = window.state.globalUsersData[n];
      i.displayName = ("مستخدم" === i.displayName ? (e.displayName || e.name || i.displayName) : i.displayName), i.photoURL = e.photoURL || e.avatarURL || i.photoURL, i.avatarColor = e.avatarColor || i.avatarColor, i.bannerColor = e.avatarColor || e.bannerColor || i.bannerColor, i.bio = e.bio || i.bio, i.socialLinks = e.socialLinks || i.socialLinks
    }
  }
  const d = document.getElementById("member-popout-name"),
    a = document.getElementById("member-popout-avatar"),
    s = document.getElementById("member-popout-initial"),
    r = document.getElementById("member-popout-banner");
  d && (d.innerText = i.displayName), a && s && window.applyAvatarToPair(a, s, i.photoURL, i.displayName, 80, i.avatarColor || i.bannerColor, n), r && window.applyBannerStyle(r, i.bannerURL, i.avatarColor || i.bannerColor, n);
  const l = document.getElementById("member-popout-bio");
  l && (l.innerText = i.bio || "", l.classList.toggle("hidden", !i.bio));
  try { if (typeof window.renderPopoutSocials === "function") window.renderPopoutSocials("member-popout-socials", i.socialLinks || {}); } catch (e) {}
  try {
    Promise.resolve().then(async () => {
      try {
        const { doc: _doc, getDoc: _get } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        const { db: _db } = await import("./firebase-config.js");
        const _snap = await _get(_doc(_db, "users", n));
        if (_snap && _snap.exists()) {
          const _data = _snap.data() || {};
          if (_data.bio && l && !l.innerText) { l.innerText = _data.bio; l.classList.remove("hidden"); }
          if (typeof window.renderPopoutSocials === "function" && _data.socialLinks) window.renderPopoutSocials("member-popout-socials", _data.socialLinks || {});
          try {
            if (window.state) {
              window.state.serverMembersData = window.state.serverMembersData || {};
              window.state.serverMembersData[n] = { ...(window.state.serverMembersData[n] || {}), bio: _data.bio || i.bio, socialLinks: _data.socialLinks || i.socialLinks };
              window.state.globalUsersData = window.state.globalUsersData || {};
              window.state.globalUsersData[n] = { ...(window.state.globalUsersData[n] || {}), bio: _data.bio || i.bio, socialLinks: _data.socialLinks || i.socialLinks };
            }
          } catch (e) {}
        }
      } catch (e) {}
    });
  } catch (e) {}
  o.style.bottom = "auto", o.style.left = "auto", o.style.right = "auto", o.style.top = "auto", o.style.transformOrigin = "center center", o.style.width = "300px", o.style.maxHeight = "min(500px, 85vh)", o.style.overflowY = "auto", o.style.overflowX = "hidden", window.lastOpenedMenu = o, window.lastOpenedEvent = e, o.style.visibility = "hidden", o.classList.remove("hidden"), requestAnimationFrame(() => {
    const t = o.offsetHeight || 400,
      n = document.getElementById("server-members-sidebar");
    if (n && n.contains(e.target) && n.classList.contains("active")) {
      const i = n.getBoundingClientRect();
      let d = i.left - 300 - 8;
      d < 10 && (d = i.right + 8);
      let a = e.clientY - 60;
      a + t > window.innerHeight - 10 && (a = window.innerHeight - t - 10), a < 10 && (a = 10), o.style.left = d + "px", o.style.top = a + "px"
    } else "function" == typeof window.positionContextMenu ? window.positionContextMenu(o, e) : (o.style.left = `${e.clientX}px`, o.style.top = `${e.clientY}px`);
    o.style.visibility = "visible", o.classList.add("animate-in", "fade-in", "zoom-in", "duration-200"), document.getElementById("user-profile-popout")?.classList.add("hidden")
  })
};
let p = null;

function g() {
  if (!p) try {
    p = new(window.AudioContext || window.webkitAudioContext);
    const e = p.createOscillator(),
      t = p.createGain();
    t.gain.value = 0, e.connect(t), t.connect(p.destination), e.start(), "suspended" === p.state && p.resume()
  } catch (err) {
    console.warn('[Audio] Failed to create AudioContext:', err);
  }
}
document.addEventListener("click", g, {
    once: !0
  }), document.addEventListener("touchstart", g, {
    once: !0,
    passive: !0
  }), document.addEventListener("mousedown", g, {
    once: !0
  }), document.addEventListener("visibilitychange", () => {
    "visible" === document.visibilityState && p && "suspended" === p.state && p.resume()
  }), window.setAppTheme = function(e) {
    document.body.classList.remove("theme-light", "theme-amoled"), "light" === e ? document.body.classList.add("theme-light") : "amoled" === e && document.body.classList.add("theme-amoled"), ["dark", "light", "amoled"].forEach(t => {
      const n = document.getElementById(`theme-btn-${t}`);
      n && (n.style.borderColor = t === e ? "#3b82f6" : "transparent")
    }), localStorage.setItem("vh-theme", e)
  }, window.setAppFontSize = function(e) {
    document.documentElement.style.fontSize = e / 100 * 15 + "px", localStorage.setItem("vh-font-size", e)
  }, window.setAppMusicVolume = function(e) {
    const t = Math.max(0, Math.min(100, Number(e) || 0));
    localStorage.setItem("vh-music-volume", String(t));
    return t
  }, window.playSettingsSoundPreview = function() {
    const e = new Audio("Music/discord-join.mp3");
    e.volume = (Number(localStorage.getItem("vh-music-volume") || 100) / 100) * .5;
    e.play().catch(() => {});
    e.addEventListener("ended", () => e.remove());
  }, window.setAppMessageSize = function(e) {
    const t = Math.max(80, Math.min(150, Number(e) || 100));
    document.documentElement.style.setProperty("--message-scale", t / 100);
    localStorage.setItem("vh-message-size", String(t))
  }, window.toggleCompactMode = function(e) {
    "undefined" != typeof localStorage && localStorage.setItem("vh-compact-mode", e);
    const t = document.documentElement;
    "1" === e || !0 === e ? (t.classList.add("compact-mode"), document.body.classList.add("mode-compact")) : (t.classList.remove("compact-mode"), document.body.classList.remove("mode-compact"))
  }, window.toggleTurboMode = function(e) {
    localStorage.setItem("vh-turbo-mode", !0 === e || "true" === e);
    const t = document.querySelector(".main-content-area");
    t && (e ? t.classList.add("turbo-mode") : t.classList.remove("turbo-mode"))
  }, window.toggleAutoPip = function(e) {
    "undefined" != typeof localStorage && localStorage.setItem("vh-auto-pip", e)
  }, window.toggleHardwareAccel = function(e) {
    "undefined" != typeof localStorage && localStorage.setItem("vh-disable-hw-accel", (!e).toString()), window.electronAPI && "function" == typeof window.electronAPI.toggleHardwareAccel && window.electronAPI.toggleHardwareAccel(!e), alert(window.__fb("js.hw_restart", "سيتم تطبيق إعداد تسريع الأجهزة (Hardware Acceleration) عند إعادة تشغيل التطبيق."))
  }, document.addEventListener("error", e => {
    if ("IMG" === e.target.tagName) {
      const t = e.target;
      if (t.dataset.fallbackApplied) return;
      const n = t.src;
      if (n) {
        window.failedImageUrls = window.failedImageUrls || new Set, window.failedImageUrls.add(n);
        try {
          const e = new URL(n);
          if ("wsrv.nl" === e.hostname || "images.weserv.nl" === e.hostname) {
            const t = e.searchParams.get("url");
            t && window.failedImageUrls.add(t)
          }
        } catch (e) {}
      }
      if (t.dataset.fallbackApplied = "true", !n) return;
      window.failedImageUrls && window.failedImageUrls.has(n) || (window.failedImageUrls = window.failedImageUrls || new Set, window.failedImageUrls.add(n));
      try {
        const e = new URL(n);
        if ("wsrv.nl" === e.hostname || "images.weserv.nl" === e.hostname) {
          const t = e.searchParams.get("url");
          t && window.failedImageUrls.add(t)
        }
      } catch (e) {}

      const scope = t.parentElement;
      const foxyHost = scope && (scope.querySelector(".foxy-avatar-fox") || scope.querySelector(".foxy-avatar-letter"));
      if (foxyHost) return void (t.classList.add("hidden"), foxyHost.classList.remove("hidden"));
      if (n.includes("ui-avatars.com") || n.includes("foxy-mask.png")) {
        t.classList.add("hidden");
        const e = scope && scope.querySelector('[id*="-initial"]');
        return void (e && e.classList.remove("hidden"))
      }

      const altName = t.alt || "User";
      const fallbackColor = window.getDefaultAvatarColor ? window.getDefaultAvatarColor(altName).replace("#", "") : "5865f2";

      t.classList.add("hidden");
      t.style.backgroundColor = `#${fallbackColor}`;
      return void 0
    }
  }, !0), window.toggleTurboMode = function(e, t = !1) {
    if (e) {
      document.body.classList.add("mode-turbo");
      const e = document.getElementById("turbo-modal");
      e && !t && e.classList.remove("hidden"), "function" != typeof addSystemMsg || t || addSystemMsg(window.__fb("js.turbo_on", "تم تفعيل وضع التيربو: تم إيقاف المؤثرات البصرية لزيادة الأداء."), "info")
    } else document.body.classList.remove("mode-turbo"), "function" != typeof addSystemMsg || t || addSystemMsg(window.__fb("js.turbo_off", "تم تعطيل وضع التيربو: عادت المؤثرات البصرية للعمل."), "info");
    [document.getElementById("turbo-mode-toggle"), document.getElementById("turbo-quick-toggle"), document.getElementById("turbo-voice-btn"), document.getElementById("turbo-quick-btn")].forEach(t => {
      t && ("checkbox" === t.type && (t.checked = e), "turbo-voice-btn" === t.id && (e ? (t.classList.replace("bg-amber-500/10", "bg-amber-500"), t.classList.replace("text-amber-500", "text-black")) : (t.classList.replace("bg-amber-500", "bg-amber-500/10"), t.classList.replace("text-black", "text-amber-500"))))
    });
    const n = document.getElementById("turbo-quick-btn");
    if (n && (e ? (n.classList.replace("bg-amber-500/10", "bg-amber-500"), n.classList.replace("text-amber-500", "text-black")) : (n.classList.replace("bg-amber-500", "bg-amber-500/10"), n.classList.replace("text-black", "text-amber-500"))));
    if (e) {
      window.gifMode = "none";
      "function" == typeof window.setGifFreeze && window.setGifFreeze(!0);
      const stopToggle = document.getElementById("stop-gifs-toggle");

      if (stopToggle) stopToggle.checked = "true" === localStorage.getItem("vh-stop-gifs");
    } else {
      const stopPref = "true" === localStorage.getItem("vh-stop-gifs");
      const stopToggle = document.getElementById("stop-gifs-toggle");
      if (stopToggle) stopToggle.checked = stopPref;
      "function" == typeof window.setGifFreeze && window.setGifFreeze(stopPref);
      if (!stopPref) {
        window.gifMode = window.currentUserProfile?.gifMode || "all";
      }
    }
    "function" == typeof window.refreshVizTurboMode && window.refreshVizTurboMode(), "function" == typeof window.renderServerMembers && window.renderServerMembers(), "function" == typeof window.renderServerRail && window.renderServerRail(), localStorage.setItem("vh-turbo-mode", !0 === e || "true" === e)
  }, window.toggleStopGifs = function(e) {
    localStorage.setItem("vh-stop-gifs", !0 === e || "true" === e);
    const shouldFreeze = Boolean(e || document.body.classList.contains("mode-turbo") || "true" === localStorage.getItem("vh-turbo-mode"));
    "function" == typeof window.setGifFreeze ? window.setGifFreeze(shouldFreeze) : (window._freezeGifsActive = shouldFreeze);
    if (!shouldFreeze) {
      window.gifMode = window.currentUserProfile?.gifMode || "all";
    } else {
      window.gifMode = "none";
    }
    try { if (typeof window.renderServerMembers === "function") window.renderServerMembers(); } catch (_) {}
    try { if (typeof window.renderServerRail === "function") window.renderServerRail(); } catch (_) {}
  }, window.toggleHardwareAccel = function(e) {
    localStorage.setItem("vh-disable-hw-accel", (!e).toString()), window.electronAPI && "function" == typeof window.electronAPI.toggleHardwareAccel && window.electronAPI.toggleHardwareAccel(!e), "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.restart_apply", "سيتم تطبيق التغييرات بعد إعادة تشغيل التطبيق."), "info")
  }, window.toggleCloseToTray = function(e) {
    localStorage.setItem("vh-close-to-tray", e.toString()), window.electronAPI && "function" == typeof window.electronAPI.toggleCloseToTray && window.electronAPI.toggleCloseToTray(e)
  }, window.toggleRunOnStartup = function(e) {
    localStorage.setItem("vh-run-on-startup", e.toString()), window.electronAPI && "function" == typeof window.electronAPI.toggleRunOnStartup && window.electronAPI.toggleRunOnStartup(e)
  }, document.addEventListener("DOMContentLoaded", () => {
    const e = document.getElementById("turbo-modal");
    e && e.addEventListener("click", t => {
      t.target === e && e.classList.add("hidden")
    })
  }),
  function() {
    const e = localStorage.getItem("vh-theme") || "dark",
      t = localStorage.getItem("vh-font-size") || "100",
      n = "true" === localStorage.getItem("vh-compact-mode"),
      o = "true" === localStorage.getItem("vh-turbo-mode");
    window.setAppTheme(e), window.setAppFontSize(t), window.setAppMessageSize(localStorage.getItem("vh-message-size") || localStorage.getItem("vh-private-message-size") || localStorage.getItem("vh-public-message-size") || "100"), window.setAppMusicVolume(localStorage.getItem("vh-music-volume") || "100"), window.toggleCompactMode(n), window.toggleTurboMode(o, !0);
    const i = document.getElementById("settings-font-size-slider");
    i && (i.value = t);
    const d = document.getElementById("font-size-label");
    d && (d.textContent = t + "%");
    const a = document.getElementById("settings-compact-mode-slider");
    a && (a.value = n ? 1 : 0, "function" == typeof window.updateCompactLabel && window.updateCompactLabel(a.value));
    const s = document.getElementById("auto-pip-toggle"),
      r = "true" === localStorage.getItem("vh-auto-pip");
    s && (s.checked = r);
    const c = document.getElementById("turbo-mode-toggle");
    c && (c.checked = o);
    const l = document.getElementById("stop-gifs-toggle"),

      u = "true" === localStorage.getItem("vh-stop-gifs");
      "function" == typeof window.initGifFreeze && window.initGifFreeze();
    if (l && (l.checked = u), "function" == typeof window.initLazyMedia && window.initLazyMedia(), navigator.userAgent.includes("Electron")) {      const e = document.getElementById("hardware-accel-container");
      e && e.classList.remove("hidden");
      const t = "true" === localStorage.getItem("vh-disable-hw-accel"),
        n = document.getElementById("hardware-accel-toggle");
      n && (n.checked = !t);
      const o = document.getElementById("close-to-tray-container");
      o && o.classList.remove("hidden");
      const i = "false" !== localStorage.getItem("vh-close-to-tray"),
        d = document.getElementById("close-to-tray-toggle");
      d && (d.checked = i);
      const a = document.getElementById("run-on-startup-container");
      a && a.classList.remove("hidden");
      const s = "true" === localStorage.getItem("vh-run-on-startup"),
        r = document.getElementById("run-on-startup-toggle");
      r && (r.checked = s), window.electronAPI && ("function" == typeof window.electronAPI.toggleCloseToTray && window.electronAPI.toggleCloseToTray(i), "function" == typeof window.electronAPI.toggleRunOnStartup && window.electronAPI.toggleRunOnStartup(s), setInterval(() => {
        if ("function" == typeof window.electronAPI.updateTrayState) {
          const e = !!window.pipManager && window.pipManager.isInCall();
          window.electronAPI.updateTrayState({
            inCall: e,
            isMuted: window.isMuted || !1,
            isDeafened: window.isDeafened || !1
          })
        }
      }, 1e3), "function" == typeof window.electronAPI.onTrayAction && window.electronAPI.onTrayAction(e => {
        "toggle-mute" === e ? "function" == typeof window.toggleMute && window.toggleMute() : "toggle-deafen" === e && "function" == typeof window.toggleDeafen && window.toggleDeafen()
      }))
    }
  }(), window.hideContextMenu = function() {
    const e = document.getElementById("custom-context-menu");
    e && e.classList.add("hidden")
  }, window.toggleFullscreen = function() {
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(e => {})
  }, (() => {
    if (navigator.userAgent.includes("Electron")) return;
    const e = document.getElementById("custom-context-menu"),
      t = document.getElementById("ctx-selection-group");
    document.addEventListener("contextmenu", n => {
      const i = window.getSelection().toString().trim();
      if (n.defaultPrevented) {
        if (i) {
          const visible = document.querySelector(".discord-context-menu:not(.hidden)");
          if (visible && !visible.querySelector(".ctx-copy-item")) {
            const sep = document.createElement("div"); sep.className = "context-menu-separator ctx-copy-sep";
            const item = document.createElement("div"); item.className = "context-menu-item ctx-copy-item";
            item.innerHTML = '<svg class="w-4 h-4 ml-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg><span>' + window.__fb("js.copy_sel", "نسخ النص المحدد") + '</span>';
            item.onclick = () => { navigator.clipboard.writeText(window.getSelection().toString().trim()); visible.classList.add("hidden"); };
            visible.insertBefore(item, visible.firstChild);
            visible.insertBefore(sep, visible.firstChild);
          }
        }
        return;
      }
      const o = n.target.closest('button, input, textarea, a, select, [contenteditable="true"], [role="button"], #custom-context-menu');
      o && 0 === i.length || (n.preventDefault(), e && (i.length > 0 ? t?.classList.remove("hidden") : t?.classList.add("hidden"), "function" == typeof window.positionContextMenu ? window.positionContextMenu(e, n) : (e.style.left = `${n.clientX}px`, e.style.top = `${n.clientY}px`, e.classList.remove("hidden"))))
    }), "function" == typeof window.syncCameraUI && window.syncCameraUI()
  })();
(function() {
  var F = '#3b82f6', T = '#1e293b';
  function r(s) {
    if (s.classList.contains('opacity-0') || s.getAttribute('orient') === 'vertical') return;
    var min = parseFloat(s.min) || 0, max = parseFloat(s.max) || 100, val = parseFloat(s.value) || 0, pct = Math.max(0, Math.min(100, (val - min) / (max - min) * 100)), dir = document.documentElement.dir === 'rtl' ? 'to left' : 'to right';
    s.style.background = 'linear-gradient(' + dir + ', ' + F + ' ' + pct + '%, ' + T + ' ' + pct + '%)';
  }
  function a(s) { r(s); s.addEventListener('input', function() { r(this); }); }

  try {
    var d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (d && d.configurable) {
      Object.defineProperty(HTMLInputElement.prototype, 'value', {
        get: function() { return d.get.call(this); },
        set: function(v) {
          d.set.call(this, v);
          if (this.type === 'range') r(this);
        }
      });
    }
  } catch(e) {}

  document.querySelectorAll('input[type="range"]').forEach(a);

  function resync() { document.querySelectorAll('input[type="range"]').forEach(function(s) { r(s); }); }
  document.addEventListener('DOMContentLoaded', function() { setTimeout(resync, 0); });
  window.addEventListener('load', function() { setTimeout(resync, 0); });

  var o = new MutationObserver(function(m) { m.forEach(function(mut) { mut.addedNodes.forEach(function(n) { if (n.nodeType === 1) { if (n.matches && n.matches('input[type="range"]')) { a(n); } else if (n.querySelectorAll) { n.querySelectorAll('input[type="range"]').forEach(a); } } }); }); });
  o.observe(document.documentElement, { childList: true, subtree: true });
})();
