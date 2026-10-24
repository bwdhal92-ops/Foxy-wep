import { ref as U, set as P, update as E, remove as A, onValue as I, get as R, serverTimestamp, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const _serverTimestamp = serverTimestamp;

const _ghostOnce = (() => {
  const _last = new Map();
  return (key, minInterval = 300000) => {
    const now = Date.now();
    const last = _last.get(key) || 0;
    if (now - last < minInterval) return false;
    _last.set(key, now);
    return true;
  };
})();

let _pagehideBound = false;

function _bindPageLeave(leaveFn) {
  if (_pagehideBound) return;
  _pagehideBound = true;
  window.addEventListener("pagehide", leaveFn);
  window.addEventListener("beforeunload", leaveFn);
}

export function createVoicePresence(config) {
  const {
    db,
    getPresencePath,
    getActivityPath,
    getMyUid,
    getMyProfile,
    getConnections,
    getCalls,
    getIsHost,
    getPresenceToken,
    onPresenceChange,
    throttleMs = 45000,
    staleMs = 120000,
    signalLostMs = 120000,
    debugLabel = "voice"
  } = config;

  let _lastSig = null;
  let _lastWrite = 0;
  let _lastFullWrite = 0;
  let _unsub = null;
  let _rtdbWatched = false;
  let _rtdbWasConnected = true;

  function _buildPayload(override = {}) {
    const uid = getMyUid();
    const profile = getMyProfile();
    const isHost = getIsHost();
    const peerId = window.myId;
    const connected = !!uid && !!peerId && !window.peer?.destroyed;
    const presenceToken = getPresenceToken?.() || "";

    return {
      uid,
      peerId,
      presenceToken,
      name: profile?.displayName || "مستخدم",
      photoURL: profile?.photoURL || "",
      isHost: !!isHost,
      isStandby: !!(window.__foxyRoleFlag && window.__foxyRoleFlag.isStandby),
      connected,
      muted: !!window.isForceMuted,
      forceMuted: !!window.isForceMuted,
      deafened: !!document.getElementById("headphone-slash")?.classList.contains("hidden") === false,
      forceDeafened: !!window.isForceDeafened,
      screenSharing: !!document.getElementById("stop-screen-btn")?.classList.contains("hidden") === false,
      videoEnabled: !!window.isCameraEnabled,
      bannerColor: profile?.bannerColor || "",
      avatarColor: profile?.avatarColor || "",
      bannerURL: profile?.bannerURL || "",
      disconnectedAt: null,
      heartbeatAt: "function" === typeof _serverTimestamp ? _serverTimestamp() : Date.now(),
      ...override
    };
  }

  function _sig(payload) {
    const { heartbeatAt: _hb, ...rest } = payload;
    return JSON.stringify(rest);
  }

  async function writePresence(force = false, override = {}) {
    const uid = getMyUid();
    const path = getPresencePath();
    if (!uid || !path || !db) return;

    const payload = _buildPayload(override);
    const sig = _sig(payload);
    const now = Date.now();

    if (!force && sig === _lastSig && now - _lastWrite < throttleMs) {
      // heartbeat خفيف… بس كل فترة نرجّع نكتب العقدة كاملة، عشان لو حد مسحها
      // (أو مسحها شبح قديم) الملف يرجع بكل بياناته مش heartbeat لوحده.
      if (now - _lastFullWrite > 180000) {
        _lastFullWrite = now;
        await E(U(db, path), payload).catch(() => {});
        try { onDisconnect(U(db, path)).remove(); } catch (_) {}
        if (onPresenceChange) onPresenceChange(payload);
        return;
      }
      const ref = U(db, `${path}/heartbeatAt`);
      await P(ref, Date.now()).catch(() => {});
      return;
    }

    _lastSig = sig;
    _lastWrite = now;
    _lastFullWrite = now;

    const ref = U(db, path);
    await E(ref, payload).catch(() => {});
    try { onDisconnect(U(db, path)).remove(); } catch (_) {}

    if (onPresenceChange) onPresenceChange(payload);
  }

  async function leavePresence() {
    const uid = getMyUid();
    const presencePath = getPresencePath();
    const activityPath = getActivityPath();
    if (!uid || !db) return;

    if (presencePath) { try { onDisconnect(U(db, presencePath)).cancel(); } catch (_) {} }
    if (activityPath) { try { onDisconnect(U(db, activityPath)).cancel(); } catch (_) {} }

    _lastSig = null;
    _lastWrite = 0;

    if (presencePath) await A(U(db, presencePath)).catch(() => {});
    if (activityPath) await A(U(db, activityPath)).catch(() => {});
  }

  function subscribeToChannel(channelId, serverId) {
    if (_unsub) { _unsub(); _unsub = null; }

    const ownNodePath = getPresencePath(channelId, serverId);
    if (!ownNodePath || !db) return;
    const path = ownNodePath.replace(/\/[^/]+$/, "");

    _unsub = I(U(db, path), snap => {
      const raw = snap.val() || {};
      const filtered = filterGhosts(raw);
      if (onPresenceChange) onPresenceChange(filtered, "snapshot");
    });
  }

  function unsubscribe() {
    if (_unsub) { _unsub(); _unsub = null; }
  }

  function filterGhosts(rawMap) {
    const now = Date.now();
    const myUid = getMyUid();
    const connections = getConnections() || {};
    const calls = getCalls() || {};
    const result = {};
    // لو heartbeat جيّ من "المستقبل" (ساعة الجهاز مقدّمة) مايبقاش دليل حياة
    const futureSkewMs = 300000;

    for (const [uid, entry] of Object.entries(rawMap)) {
      if (!entry) continue;

      if (uid === myUid) {
        result[uid] = { ...entry };
        continue;
      }

      let _signalLost = false;
      const hb = entry.heartbeatAt;
      // heartbeat ناقص أو مش رقم أو من المستقبل = مش دليل حياة (كان بيتجاهله
      // الكود القديم خالص، فالعقدة القديمة/البايارة تفضل تظهر كشبح للأبد)
      const hbUsable = typeof hb === "number" && isFinite(hb) && hb > 0;
      const hbFromFuture = hbUsable && (hb - now > futureSkewMs);

      // دليل اتصال حقيقي (peer/call) — بيتفحص مرة واحدة للفرعين
      const pid = entry.peerId;
      const alive = !!(
        pid && connections[pid]?.conn?.open
      ) || !!(
        calls[pid]?.peerConnection && (
          calls[pid].peerConnection.connectionState === "connected" ||
          calls[pid].peerConnection.connectionState === "connecting"
        )
      ) || Object.values(connections).some(c => c?.uid === uid && c?.conn?.open);

      if (entry.disconnectedAt) {
        const dcAge = now - (entry.disconnectedAt || 0);
        if (!alive) {
          if (dcAge < signalLostMs) {
            _signalLost = true;
            if (_ghostOnce(`siglost:${uid}`, 60000)) {
              console.log(`[${debugLabel}] PEER_SIGNAL_LOST`, uid, `${Math.round(dcAge/1000)}s`);
            }
          } else {
            if (_ghostOnce(`ghostmark:${uid}`, 300000)) {
              console.log(`[${debugLabel}] GHOST_DISCONNECT_MARK`, uid, `${Math.round(dcAge/1000)}s`);
            }
            continue;
          }
        }
      }

      // الشبح: مفيش heartbeat موثوق (ناقص/قديم/مستقبلي) ومفيش اتصال حيّ
      if ((!hbUsable || hbFromFuture || now - hb > staleMs) && !alive) {
        if (_ghostOnce(`ghost:${uid}`, 300000)) {
          console.warn(`[${debugLabel}] إخفاء شبح`, { uid, ageMs: hbUsable ? now - hb : null, future: hbFromFuture, noHeartbeat: !hbUsable });
        }
        continue;
      }

      // عقدة مفيهاش أي بيانات حياة (اتمسحت وجالها heartbeat بس) = شبح
      if (!entry.uid && !entry.name && !entry.peerId && entry.connected !== true && !alive) {
        if (_ghostOnce(`ghostpartial:${uid}`, 300000)) {
          console.warn(`[${debugLabel}] إخفاء عقدة ناقصة`, { uid });
        }
        continue;
      }

      const out = { ...entry };
      if (_signalLost) out.connected = false, out.signalLost = true;
      result[uid] = out;
    }
    return result;
  }

  function watchRtdbConnection() {
    if (_rtdbWatched || !db) return;
    _rtdbWatched = true;
    try {
      I(U(db, ".info/connected"), snap => {
        const online = snap.val() === true;
        if (!online) {
          _rtdbWasConnected = false;
          _lastSig = null;
          return;
        }
        if (!_rtdbWasConnected) {
          _rtdbWasConnected = true;
          _lastSig = null;
          writePresence(true);
        }
      });
    } catch { _rtdbWatched = false; }
  }

  function setupAutoLeave() {
    _bindPageLeave(leavePresence);
    watchRtdbConnection();
  }

  return {
    writePresence,
    leavePresence,
    subscribeToChannel,
    unsubscribe,
    filterGhosts,
    setupAutoLeave,
    get throttleMs() { return throttleMs; },
    get staleMs() { return staleMs; }
  };
}