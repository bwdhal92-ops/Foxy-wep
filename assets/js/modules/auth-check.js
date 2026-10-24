import {
  getDb,
  getAuth,
  getRtdb,
  getApp,
  whenReady
} from "./firebase-config.js";
import {
  onAuthStateChanged as s,
  signOut as i
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  doc as r,
  getDoc as n,
  onSnapshot as d
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
  ref as c,
  onValue as l,
  set as w,
  onDisconnect as u,
  serverTimestamp as m
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

let f = null;
let statusHeartbeat = null;
let redirectingToLogin = false;

whenReady().then(() => {
  const t = getAuth();
  const o = getRtdb();
  const a = getApp();
  
  window.rtdb = o;
  window.analytics = null;
  
  try {
    import("https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js").then(t => {
      window.analytics = t.getAnalytics(a)
    }).catch(t => console.warn("\u0641\u0634\u0644 \u062a\u062d\u0645\u064a\u0644 Firebase Analytics:", t))
  } catch (t) {
    console.warn("\u062e\u0637\u0623 \u0641\u064a \u062a\u0647\u064a\u0626\u0629 Analytics:", t)
  }

  s(t, async a => {
    if (f && clearTimeout(f), statusHeartbeat && (clearInterval(statusHeartbeat), statusHeartbeat = null), a) {
      f && clearTimeout(f), window.currentUserProfile = null;
      const currentRtdb = o || getRtdb();
      const e = currentRtdb ? c(currentRtdb, "/status/" + a.uid) : null,
        s = currentRtdb ? c(currentRtdb, ".info/connected") : null,
        publishOnlineStatus = () => {
          if (!e || document.visibilityState === "hidden" || "offline" === localStorage.getItem("user_status_pref")) return;
          w(e, { state: "online", last_changed: m() }).catch(() => {});
        };
      window.updateMyStatus = async t => {
        if (a) {
          localStorage.setItem("user_status_pref", t);
          try {
            if (e) {
              await w(e, {
                state: t,
                last_changed: m()
              });
            }
            document.querySelectorAll(".popout-status-dot, .sidebar-status-dot").forEach(e => {
              e.style.backgroundColor = "online" === t ? "#10b981" : "#64748b"
            }), window.addSystemMsg && window.addSystemMsg("online" === t ? window.__fb("app_auth.you_are_online", "\u0623\u0646\u062a \u0645\u062a\u0635\u0644 \u0627\u0644\u0622\u0646 \ud83d\udfe2") : window.__fb("app_auth.you_are_invisible", "\u0623\u0646\u062a \u0627\u0644\u0622\u0646 \u0641\u064a \u0648\u0636\u0639 \u0627\u0644\u062a\u062e\u0641\u064a \u26aa"))
          } catch (t) {
            console.warn("\u0641\u0634\u0644 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062d\u0627\u0644\u0629:", t)
          }
        }
      };
      if (s && e) {
        l(s, t => {
          if (!1 === t.val()) return;
          const o = localStorage.getItem("user_status_pref") || "online";
          u(e).set({
            state: "offline",
            last_changed: m()
          }).then(() => {
            "offline" === o ? null : publishOnlineStatus()
          }).catch(() => {})
        });
      }
      statusHeartbeat = setInterval(publishOnlineStatus, 6e4);
      window.addEventListener("focus", publishOnlineStatus);
      window.addEventListener("online", publishOnlineStatus);
      document.addEventListener("visibilitychange", () => {
        "visible" === document.visibilityState && publishOnlineStatus();
      });
      const i = r(getDb(), "users", a.uid),
        n = d(i, async t => {
          if (t.exists() || t.metadata.fromCache) {
            if (t.exists()) {
              window.currentUserProfile = t.data(), window.gifMode = window.currentUserProfile.gifMode || "all";
              const e = document.getElementById("current-user-email"),
                mobE = document.getElementById("mobile-current-user-email"),
                o = document.getElementById("sidebar-avatar"),
                s = document.getElementById("sidebar-initial");
              e && (e.removeAttribute("data-i18n"), e.textContent = window.currentUserProfile.displayName || window.__fb("app_chat.default_sender", "\u0645\u0633\u062a\u062e\u062f\u0645")), mobE && (mobE.removeAttribute("data-i18n"), mobE.textContent = window.currentUserProfile.displayName || window.__fb("app_chat.default_sender", "\u0645\u0633\u062a\u062e\u062f\u0645")), window.currentUserProfile.photoURL ? (o && (o.src = (window.isAnimatedImageUrl && window.isAnimatedImageUrl(window.currentUserProfile.photoURL) || /(?:^|[._-])gif(?:[._/?#]|$)/i.test(window.currentUserProfile.photoURL)) && !window._freezeGifsActive ? window.currentUserProfile.photoURL : window.getStaticAvatarSrc ? window.getStaticAvatarSrc(window.currentUserProfile.photoURL, 58) : 'https://wsrv.nl/?url=' + encodeURIComponent(window.currentUserProfile.photoURL) + '&w=58&h=58&fit=cover&output=webp', o.classList.remove("hidden")), s && s.classList.add("hidden")) : s && (s.textContent = (window.currentUserProfile.displayName || "\u0623")[0], s.classList.remove("hidden"), o && o.classList.add("hidden")), document.dispatchEvent(new CustomEvent("UserProfileLoaded", {
                detail: window.currentUserProfile,
                isFromCache: t.metadata.fromCache
              }))
            }
          } else try {
            const t = Math.floor(1e3 + 9e3 * Math.random()).toString(),
              e = a.displayName || window.__fb("app_auth.guest_name", "\u0636\u064a\u0641"),
              o = `${e}#${t}`,
              s = {
                uid: a.uid,
                displayName: e,
                tag: t,
                fullTag: o,
                photoURL: a.photoURL || "",
                createdAt: m(),
                lastLogin: m(),
                friends: []
              },
              {
                setDoc: r
              } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            await r(i, s)
          } catch (t) {
            console.error("\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0645\u0633\u062a\u0646\u062f \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645:", t)
          }
        }, t => {
          console.error("\u0641\u0634\u0644 \u062a\u062d\u0645\u064a\u0644 \u0645\u0644\u0641 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645:", t)
          document.dispatchEvent(new CustomEvent("UserProfileLoaded", {
            detail: {
              error: !0
            }
          }))
        });
      window.unsubscribeProfile = n
    } else {
      window.currentUserProfile = null;
      if (redirectingToLogin || /(?:^|\/)login\.html$/i.test(window.location.pathname)) return;
      f = setTimeout(() => {
        let curAuth = null;
        try {
          curAuth = getAuth();
        } catch (_) {}
        if (!curAuth?.currentUser && !/(?:^|\/)login\.html$/i.test(window.location.pathname)) {
          redirectingToLogin = true;
          window.location.replace("login.html");
        }
      }, 250);
    }
  }), window.logout = async () => {
    try {

      if (typeof window.leaveVoiceChannel === "function") {
        try { await window.leaveVoiceChannel(true); } catch (_) {}
      }
      if (typeof window.releaseVoiceSession === "function") {
        try { await window.releaseVoiceSession(); } catch (_) {}
      }
      if (typeof window.hardReset === "function") {
        try { window.hardReset(); } catch (_) {}
      }

      const curAuth = getAuth();
      const user = curAuth?.currentUser;
      const rtdbInst = getRtdb() || window.rtdb;
      if (user && rtdbInst) {
        try {
          const statusRef = c(rtdbInst, "/status/" + user.uid);
          await w(statusRef, { state: "offline", last_changed: m() });
        } catch (_) {}
      }

      if (typeof window.unsubscribeProfile === "function") {
        try { window.unsubscribeProfile(); } catch (_) {}
      }
      window.currentUserProfile = null;

      if (curAuth) {
        redirectingToLogin = true;
        await i(curAuth);
      }
    } catch (err) {
      console.warn("Logout cleanup warning:", err);
    } finally {
      window.location.replace("login.html");
    }
  }, document.addEventListener("DOMContentLoaded", () => {
    const t = document.getElementById("logout-btn");
    t && (t.onclick = window.logout)
  });
});
