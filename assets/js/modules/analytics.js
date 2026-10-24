import {
  db as e,
  auth as t
} from "../firebase-config.js";
import {
  collection as n,
  addDoc as a,
  updateDoc as r,
  doc as i,
  serverTimestamp as o,
  increment as s
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
let c = null,
  l = null;
export async function logVoiceJoin(r, i, s, u, f) {
  if (t.currentUser) try {
    const m = t.currentUser.uid,
      p = {
        uid: m,
        userEmail: t.currentUser.email || "Guest",
        displayName: t.currentUser.displayName || "Guest",
        serverId: r,
        serverName: i || "Unknown Server",
        channelId: s,
        channelName: u || "Unknown Channel",
        joinedAt: o(),
        participantCountAtJoin: f || 1,
        status: "active",
        platform: window.FoxyNativeApp?.isAndroidApp ? "Android" : (window.electronAPI ? "Desktop" : "Web")
      },
      d = await a(n(e, "voice_analytics"), p);
    c = d.id, l = Date.now()
  } catch (e) {}
}
export async function logVoiceLeave() {
  if (c) try {
    const t = Date.now(),
      n = Math.floor((t - l) / 1e3),
      a = i(e, "voice_analytics", c);
    await r(a, {
      leftAt: o(),
      duration: n,
      status: "completed"
    }), c = null, l = null
  } catch (e) {}
}