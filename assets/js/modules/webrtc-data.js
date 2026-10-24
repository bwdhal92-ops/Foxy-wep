var pendingConnections = window.pendingConnections || new Set();
// ── سجل الاتصالات المعلّقة (P0: تسريب PCs "زومبي") ─────────────────────────
// pendingConnections كان Set منفصل لا يراه أي منظّف:
//  • cleanupGhosts و handleExit يمشيان على connections فقط
//  • connections[peerId] لا يُكتب إلا عند نجاح open
//  • فإذا رحل العضو بينما كنا نتصل به، تبقى الـ DataConnection "connecting"
//    للأبد، ومعها MediaConnection — PeerConnection كاملة لا تُغلق أبداً.
//  الدليل في سجل chrome://webrtc-internals: dc_0owlmqdlo4un و undefined
//  بحالة state=connecting و iceState=new بلا أي تغيّر.
//
// الآن نسجّل كل اتصال معلّق مع عمره، ونمسح المتجاوز للعمر المحدود.
var _pendingDials = new Map();   // peerId -> { dc, at, tries }
// عمر أقصى قبل مسح اتصال معلّق. كبير عن قصد: تخصيص TURN على شبكة سيئة
// قد يأخذ 20-30 ثانية حقيقية، ولا نريد قطع محاولة سليمة.
var PENDING_DIAL_MAX_MS = 45000;
var _pendingSweepTimer = null;
function _registerPendingDial(peerId, dc) {
  if (!peerId) return;
  var cur = _pendingDials.get(peerId);
  if (cur) {
    cur.dc = dc;
    cur.tries = (cur.tries || 0) + 1;
  } else {
    _pendingDials.set(peerId, { dc: dc, at: Date.now(), tries: 1 });
  }
}
function _unregisterPendingDial(peerId) {
  _pendingDials.delete(peerId);
  try { pendingConnections.delete(peerId); } catch (e) {}
}
// يُغلق اتصالاً معلّقاً فعلاً: الـ DC + المكالمة الوسيطية + تنظيف كامل.
function _forceClosePendingDial(peerId, reason) {
  var rec = _pendingDials.get(peerId);
  _unregisterPendingDial(peerId);
  clearDialSlot(peerId);
  if (rec && rec.dc) {
    try { rec.dc._foxyZombie = true; } catch (_) {}
    try { rec.dc.close(); } catch (_) {}
  }
  if (calls[peerId]) {
    try { calls[peerId]._foxySuperseded = true; } catch (_) {}
    try { calls[peerId].close(); } catch (_) {}
    delete calls[peerId];
  }
  if (typeof cleanupPeerResources === "function") {
    try { cleanupPeerResources(peerId); } catch (_) {}
  }
  window._foxyZombieSweeps = (window._foxyZombieSweeps || 0) + 1;
  window.foxyLog("warn", "[Foxy][webrtc] مسح اتصال معلّق بلا تقدم (منع تراكم PCs)", {
    peerId: peerId, reason: reason,
    ageMs: rec ? Date.now() - rec.at : null,
    zombieSweeps: window._foxyZombieSweeps,
    timestamp: new Date().toISOString()
  });
}
// مسح دوري للاتصالات المعلّقة التي تجاوزت العمر الأقصى.
function sweepPendingDials() {
  if (document.hidden) return;
  var now = Date.now();
  var stale = [];
  _pendingDials.forEach(function (rec, peerId) {
    // وصل الاتصال فعلاً؟ إنها only يكون في connections.
    const activeConn = connections[peerId]?.conn;
    const signalingReady = activeConn?.type === "media" ? !!activeConn._foxyDataOpen : !!activeConn?.open;
    if (activeConn && signalingReady) {
      _unregisterPendingDial(peerId);
      return;
    }
    if (now - rec.at > PENDING_DIAL_MAX_MS) stale.push(peerId);
  });
  for (var i = 0; i < stale.length; i++) _forceClosePendingDial(stale[i], "sweep:stale-" + PENDING_DIAL_MAX_MS + "ms");
}
window.sweepPendingDials = sweepPendingDials;
window.startPendingSweep = function () {
  if (_pendingSweepTimer) return;
  // كل 15 ثانية كافية — العمر الأقصى 45 ثانية يمنع القتل المبكر.
  _pendingSweepTimer = setInterval(sweepPendingDials, 15000);
  window.FOXY_DEBUG && window.foxyLog && window.foxyLog("info", "[Foxy][webrtc] مُسجّل كاسح الاتصالات المعلّقة", { maxAgeMs: PENDING_DIAL_MAX_MS });
};
window.stopPendingSweep = function () {
  if (_pendingSweepTimer) { clearInterval(_pendingSweepTimer); _pendingSweepTimer = null; }
};
window.FOXY_DEBUG = window.FOXY_DEBUG || false;

window.foxyAddPeerConnectionListener = function(connection, eventName, listener, options) {
  const pc = connection?.peerConnection;
  if (!pc?.addEventListener) return false;
  pc.addEventListener(eventName, listener, options);
  const disposers = connection._foxyPcListenerDisposers || (connection._foxyPcListenerDisposers = []);
  disposers.push(() => pc.removeEventListener(eventName, listener, options));
  return true;
};
window.foxyCleanupPeerConnectionListeners = function(connection) {
  const disposers = connection?._foxyPcListenerDisposers;
  if (!disposers) return;
  connection._foxyPcListenerDisposers = null;
  disposers.splice(0).forEach(dispose => { try { dispose(); } catch (_) {} });
};
window.foxyCleanupConnectionResources = function(connection) {
  window.foxyCleanupPeerConnectionListeners(connection);
  const callbacks = connection?._foxyCleanupCallbacks;
  if (!callbacks) return;
  connection._foxyCleanupCallbacks = null;
  callbacks.splice(0).forEach(cleanup => { try { cleanup(); } catch (_) {} });
};

window.foxyBroadcastPeerMessage = function(message, peerIds) {
  let serialized;
  try { serialized = typeof message === "string" ? message : JSON.stringify(message); } catch (_) { return 0; }
  if (typeof serialized !== "string") return 0;
  const records = window.connections || {};
  const ids = Array.isArray(peerIds) ? peerIds : Object.keys(records);
  let sent = 0;
  ids.forEach(peerId => {
    const connection = records[peerId]?.conn;
    if (!connection || typeof connection.send !== "function") return;
    if (connection.type === "media") {
      if (!connection.peerConnection || connection._foxyClosed) return;
      if (connection.send(serialized)) sent++;
    } else if (connection.open) {
      connection.send(message);
      sent++;
    }
  });
  return sent;
};

function _foxySay(code, subject, detail) {
  try { "function" == typeof window.foxyDiagEvent && window.foxyDiagEvent(code, subject, detail); } catch (_) {}
}
function setupDataConn(e, n = !1) {
  if (e?.type === "media" && connections[e.peer]?.conn?.type === "data") {
    connections[e.peer].mediaCall = e;
    return;
  }
  window.FOXY_DEBUG && window.foxyLog("info", "[Foxy][webrtc] تهيئة قناة بيانات", {peerId:e.peer, outgoing:n, open:e.open, timestamp:new Date().toISOString()});
  if (e.peerConnection && !e.peerConnection._foxyDiagnosticsHooked) {
    e.peerConnection._foxyDiagnosticsHooked = !0;
    window.foxyAddPeerConnectionListener(e, "connectionstatechange", () => {

      const _st = e.peerConnection.connectionState;
      if (!window.FOXY_DEBUG && "failed" !== _st && "disconnected" !== _st) return;
      const t = connections?.[e.peer];
      window.foxyLog(("failed" === _st || "disconnected" === _st) ? "warn" : "info", "[Foxy][webrtc] تغيرت حالة الاتصال", {peerId:e.peer, user: t?.name || null, uid:t?.uid || window.peerIdToUidMap?.[e.peer] || null, state:_st, iceState:e.peerConnection.iceConnectionState, diagnosis:"failed" === _st || "failed" === e.peerConnection.iceConnectionState ? "peer-or-network-connection" : "normal", timestamp:new Date().toISOString()})
    });
    window.foxyAddPeerConnectionListener(e, "iceconnectionstatechange", () => {
      const _ist = e.peerConnection.iceConnectionState;
      if (!window.FOXY_DEBUG && "failed" !== _ist && "disconnected" !== _ist) return;
      const t = connections?.[e.peer];
      window.foxyLog(("failed" === _ist || "disconnected" === _ist) ? "warn" : "info", "[Foxy][webrtc] تغيرت حالة ICE", {peerId:e.peer, user:t?.name || null, uid:t?.uid || window.peerIdToUidMap?.[e.peer] || null, state:_ist, connectionState:e.peerConnection.connectionState, diagnosis:"failed" === _ist ? "peer-or-network-connection" : "normal", timestamp:new Date().toISOString()})
    });
    window._iceErrorThrottle = window._iceErrorThrottle || new Map();

    const _errAgg = { count: 0, byProvider: {}, lastUrl: null, lastCode: null, timer: null, reported: false };
    e._foxyIceErrorState = _errAgg;
    const cleanupCallbacks = e._foxyCleanupCallbacks || (e._foxyCleanupCallbacks = []);
    cleanupCallbacks.push(() => {
      if (_errAgg.timer) clearTimeout(_errAgg.timer);
      _errAgg.timer = null;
      e._foxyIceErrorState = null;
    });
    const _flushIceErrors = () => {
      _errAgg.timer = null;
      if (!_errAgg.count || _errAgg.reported) return;
      _errAgg.reported = true;
      const providers = Object.keys(_errAgg.byProvider);
      const worst = providers.map(p => ({ p, n: _errAgg.byProvider[p] })).sort((a, b) => b.n - a.n)[0];
      const _k = e.peer + '|summary';
      const _now = Date.now();
      if (window._iceErrorThrottle.get(_k) && _now - window._iceErrorThrottle.get(_k) < 45000) return;
      window._iceErrorThrottle.set(_k, _now);
      window.foxyLog("warn", "[Foxy][webrtc] أخطاء ICE مُجمَّعة (اتجاه واحد)", {
        peerId: e.peer,
        user: (connections && connections[e.peer] && connections[e.peer].name) || null,
        total: _errAgg.count,
        providers: _errAgg.byProvider,
        dominant: worst ? worst.p + ' x' + worst.n : null,
        lastErrorCode: _errAgg.lastCode,

        note: 'turn-failures-are-normal-unless-connection-fails',
        timestamp: new Date().toISOString()
      });
    };
    window.foxyAddPeerConnectionListener(e, "icecandidateerror", n => {
      _errAgg.count++;
      _errAgg.lastUrl = n.url || null;
      _errAgg.lastCode = n.errorCode || null;
      let _provider = 'unknown';
      try {
        if ("function" == typeof window.classifyIceEndpoint) _provider = window.classifyIceEndpoint(n.url, n.errorCode, n.errorText).provider;
      } catch (_) {}
      _errAgg.byProvider[_provider] = (_errAgg.byProvider[_provider] || 0) + 1;
      if (_errAgg.timer) clearTimeout(_errAgg.timer);
      _errAgg.timer = setTimeout(_flushIceErrors, 3000);
    });

    window.foxyAddPeerConnectionListener(e, "connectionstatechange", () => {
      var _st = e.peerConnection.connectionState;
      if ("failed" === _st) { _errAgg.reported = false; _flushIceErrors(); }
    });
  }
  e.on("error", errorEvent => window.foxyLog("error", "[Foxy][webrtc] خطأ في قناة البيانات", {peerId:e.peer, type:errorEvent?.type, message:errorEvent?.message, outgoing:n, timestamp:new Date().toISOString()}));
  const t = async () => {
    var introToken = null;
    if ("undefined" != typeof auth && auth.currentUser) {
      try { introToken = await auth.currentUser.getIdToken(); } catch(e) {}
    }
    window.FOXY_DEBUG && window.foxyLog("info", "[Foxy][webrtc] قناة البيانات مفتوحة", {peerId:e.peer, outgoing:n, connectionState:e.peerConnection?.connectionState || "unknown"});
    e.send({
      type: "intro",
      //FIX: كنا بنبعث window.myName (= "الاسم#1234") ⇒ الكارت عند الزميل
      //بيعرض الاسم مع رقم. بنبعث displayName بس (زي الحضور بالظبط).
      name: "function" == typeof window.__foxySelfDisplayName ? window.__foxySelfDisplayName() : window.myName,

      uid: ("undefined" != typeof auth ? auth.currentUser?.uid : null) || window.state?.myUid || window.currentUserProfile?.uid || "",
      photoURL: ("undefined" != typeof auth ? auth.currentUser?.photoURL : null) || window.currentUserProfile?.photoURL || "",
      presenceToken: window.voicePresenceToken || "",
      via: e.metadata?.via || window.__fb("js.room_id_fb", "معرف الغرفة"),
      authToken: introToken,
      videoEnabled: !!window.isCameraEnabled && !window.isScreenSharing,
      videoSource: window.calls?.[e.peer]?._foxyVideoSource || null
    }), _foxySay("DC_OPEN", "peer=" + e.peer, "قناة البيانات مفتوحة — نُخرجها من قائمة المعلّق"), _unregisterPendingDial(e.peer), (function () {

      try {
        const _prevDc = connections[e.peer];
        if (_prevDc && _prevDc.conn && _prevDc.conn !== e) {
          if (e.type === "media" && _prevDc.conn.type === "data") {
            _prevDc.mediaCall = e;
            return;
          }
          if (_prevDc.conn.type === "media" && e.type === "data") {
            _prevDc.mediaCall = _prevDc.conn;
          } else {
            try { _prevDc.conn._foxySuperseded = true; } catch (_) {}
            try { _prevDc.conn.close(); } catch (_) {}
          }
        }
      } catch (_) {}
    })(), connections[e.peer] = e.type === "media" && connections[e.peer]?.conn?.type === "data"
      ? { ...connections[e.peer], mediaCall: e }
      : {
        ...(connections[e.peer] || {}),
        conn: e,
        mediaCall: e.type === "media" ? e : (connections[e.peer]?.mediaCall || null),
        name: connections[e.peer]?.name || "...",
        established: !1
      }, window.isScreenSharing && window.currentScreenPeerId && e.send({
      type: "screen-ready",
      name: "function" == typeof window.__foxySelfDisplayName ? window.__foxySelfDisplayName() : window.myName,
      screenPeerId: window.currentScreenPeerId
    }), "function" == typeof window._onScreenSignalingReopened && window._onScreenSignalingReopened(e.peer), n && currentHostId && currentHostId !== myId && isGuest && connections[currentHostId] && e.peer !== currentHostId && connections[currentHostId].conn.send({
      type: "bridge-new-peer",
      peerId: e.peer
    }), e.peerConnection && (window.foxyAddPeerConnectionListener(e, "icecandidate", e => {
      e.candidate && e.candidate.candidate.includes("relay") && "function" == typeof detectActiveTurnServer && detectActiveTurnServer(e.candidate.candidate)
    }), window.foxyAddPeerConnectionListener(e, "icecandidateerror", e => {
      e.url
    }))
  };
  const mediaMux = e.type === "media";
  if (mediaMux) e.on("foxy-data-close", () => {
    if (e._foxyFallbackStarted) return;
    setTimeout(() => openMultiplexDataFallback(e.peer, e, "multiplex-channel-closed"), 500);
  });
  (mediaMux ? e._foxyDataOpen : e.open) ? t() : e.on(mediaMux ? "foxy-data-open" : "open", t), e.on("data", t => {

    if ("keepalive" === t?.type) return;
    const o = e.peer;
    if (t?.type === "intro" || t?.type === "intro-ack") {
      const timer = window._foxyMuxFallbackTimers?.[o];
      if (timer) clearTimeout(timer);
      if (window._foxyMuxFallbackTimers) delete window._foxyMuxFallbackTimers[o];
    }
    ["sync", "screen-ready", "screen-stopped", "screen-status", "screen-join-request", "screen-peer-id-response", "screen-viewer-joined", "screen-viewer-left"].includes(t?.type) && window.FOXY_DEBUG && window.foxyLog("info", "[Foxy][webrtc] رسالة تشخيصية", {peerId:o, type:t.type, payload:t, timestamp:new Date().toISOString()});
    if (!connections[o]) connections[o] = {
        conn: e,
        name: "...",
        established: !1
      };
    if ((t?.type === "screen-ready" || t?.type === "screen-status") && connections[o]) {
      if (t.screenQuality) {
        const quality = t.screenQuality;
        connections[o].screenQuality = {
          width: Math.max(0, Math.round(Number(quality.width) || 0)),
          height: Math.max(0, Math.round(Number(quality.height) || 0)),
          frameRate: Math.max(0, Math.round(Number(quality.frameRate) || 0))
        };
      } else if (t.type === "screen-status" && !t.active) {
        delete connections[o].screenQuality;
      }
    }
    if (t?.type === "screen-stopped" && connections[o]) delete connections[o].screenQuality;
    if ("intro" === t.type) {
      if (t.authToken) {
        try {
          var _payload = JSON.parse(atob(t.authToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
          if (_payload.user_id && _payload.user_id !== t.uid) {
            e.send({type:"rejected",reason:"auth_failed"});
            return void handleExit(e.peer);
          }
        } catch(e) {}
      }
      if (typeof t.videoEnabled === "boolean") {
        window.peersVideoStatus = window.peersVideoStatus || {};
        window.peersVideoStatus[o] = t.videoEnabled;
        if (typeof updatePlayerStatusUI === "function") updatePlayerStatusUI(o, null, null, !1, !1, !1);
      }
      if (t.videoSource) window.setRemoteVideoSourceStatus?.(o, t.videoSource, true);
      if (window.locallyDeadUids && t.uid && window.locallyDeadUids.delete(t.uid), "private" === roomMode && myId === currentHostId && !connections[o].approved) return pendingApprovals[o] = {
        name: t.name,
        conn: e,
        via: t.via
      }, void("function" == typeof showApprovalToast && showApprovalToast(o, t.name));
      if (e.send({
          type: "intro-ack"
        }), window.isScreenSharing && window.currentScreenPeerId && e.send({
          type: "screen-ready",
          name: "function" == typeof window.__foxySelfDisplayName ? window.__foxySelfDisplayName() : window.myName,
          screenPeerId: window.currentScreenPeerId,
          screenQuality: window.getLocalScreenSourceQuality?.()
        }), myId !== currentHostId || isGuest) currentHostId && currentHostId !== myId && e.send({
        type: "host-update",
        hostId: currentHostId
      });
      else {
        const n = Object.keys(connections).filter(e => e !== o),
          t = (window.chatHistory || []).slice(-50),
          r = {};
        n.forEach(e => {
          document.getElementById("p-card-" + e), r[e] = {
            muted: !!document.getElementById(`mic-icon-${e}`),
            deafened: !!document.getElementById(`deaf-icon-${e}`),
            screenActive: !!connections[e]?.screenActive,
            screenPeerId: connections[e]?.screenPeerId
          }
        }), r[myId] = {
          muted: isMuted,
          deafened: isDeafened,
          forceMuted: !!window.isForceMuted,
          forceDeafened: !!window.isForceDeafened,
          videoEnabled: !!window.isCameraEnabled && !window.isScreenSharing,
          photoURL: ("undefined" != typeof auth ? auth.currentUser?.photoURL : null) || window.currentUserProfile?.photoURL || "",
          screenActive: !!screenStream,
          screenPeerId: `screen-${myId}`
        }, e.send({
          type: "sync",
          peers: n,
          hostId: currentHostId,
          roomMode: roomMode,
          history: t,
          peerStates: r
        }), screenStream && e.send({
          type: "screen-status",
          active: !0,
          peerId: `screen-${myId}`,
          screenQuality: window.getLocalScreenSourceQuality?.()
        })
      }

      {
        const _introUid = t.uid;
        const _isJunk = !_introUid || _introUid === o || ("function" == typeof window.isPeerIdShaped && window.isPeerIdShaped(_introUid));
        const _resolved = _isJunk ? ("function" == typeof window.resolvePeerUid ? window.resolvePeerUid(o, _introUid) : "") : _introUid;
        if (_isJunk) {
          _foxySay("UID_REPAIRED", "peer=" + o, "intro.uid كان = " + JSON.stringify(_introUid) + " (فارغ أو شكله peerId) ⇒ حُلّ من الحضور ⇒ " + (_resolved || "لسه ملقيناش، الكارت هيتسمّى بالـ peerId لحد ما يتعرف"));
          window.foxyLog("warn", "[Foxy][webrtc] intro.uid غير صالح — تم حله من الحضور", {peerId:o, introUid:_introUid, resolvedUid:_resolved || null, name:t.name || null, timestamp:new Date().toISOString()});
        }
        t.uid = _resolved;
        connections[o].uid = _resolved;
        if (_resolved) window.peerIdToUidMap && (window.peerIdToUidMap[o] = _resolved);
      }
      //FIX: الاسم اللي جاي في الـ intro ممكن يكون "الاسم#1234" (نسخة قديمة
      // كانت بتبعث fullTag) ⇒ بنوحّده على displayName الموجود عندنا.
      const _peerName = "function" == typeof window.__foxyResolvePeerName
        ? window.__foxyResolvePeerName(t.uid, t.name)
        : t.name;
      if (connections[o].name = _peerName, connections[o].photoURL = t.photoURL, connections[o].presenceToken = t.presenceToken || "", !connections[o].established) {
        const isAlreadyInUi = document.getElementById("p-card-" + o) || (t.uid && document.getElementById("p-card-" + t.uid));
        const recentlyJoined = window._recentlyJoinedPeers && (window._recentlyJoinedPeers[o] || (t.uid && window._recentlyJoinedPeers[t.uid]));
        addParticipantUI(o, _peerName, t.photoURL);
        if (typeof window.playChannelSound === "function" && !isAlreadyInUi && !recentlyJoined) {
          window.foxyLog("info", "[Foxy][sound] تشغيل صوت انضمام مشارك", {peerId:o, uid:t.uid, name:_peerName, alreadyInUi:!!isAlreadyInUi, recentlyJoined:!!recentlyJoined, outgoing:n});
          window.playChannelSound("join");
          window._recentlyJoinedPeers = window._recentlyJoinedPeers || {};
          window._recentlyJoinedPeers[o] = Date.now();
          if (t.uid) window._recentlyJoinedPeers[t.uid] = Date.now();
          setTimeout(() => {
            if (window._recentlyJoinedPeers) {
              delete window._recentlyJoinedPeers[o];
              if (t.uid) delete window._recentlyJoinedPeers[t.uid];
            }
          }, 15000);
        } else {

          window._joinSoundLogThrottle = window._joinSoundLogThrottle || new Map();
          const _jsNow = Date.now(), _jsLast = window._joinSoundLogThrottle.get(o) || 0;
          if (_jsNow - _jsLast > 6e4) {
            window._joinSoundLogThrottle.set(o, _jsNow);
            console.debug("[Foxy][sound] لم يتم تشغيل صوت الانضمام", {peerId:o, name:t.name, hasSoundFunction:typeof window.playChannelSound === "function", outgoing:n, alreadyInUi:!!isAlreadyInUi, recentlyJoined:!!recentlyJoined})
          }
        }
      }
      connections[o].established = true;
      if (!connections[o].announced) {
        const e = t.via && t.via !== _peerName ? t.via : window.__fb("js.room_id_fb", "معرف الغرفة");
        o !== currentHostId && (addSystemMsg(window.__f("js.joined_via", {a: _peerName, b: e}, `${_peerName} دخل الغرفة عن طريق ${e}`)), connections[o].announced = !0)
      }
      e.send({
        type: "mic-status",
        muted: isMuted,
        forceMuted: !!window.isForceMuted
      }), e.send({
        type: "deafen-status",
        deafened: isDeafened,
        forceDeafened: !!window.isForceDeafened
      }), e.send({
        type: "video-status",
        enabled: !!window.isCameraEnabled && !window.isScreenSharing
      }), updateRoomCount(Object.keys(connections).length)
    } else if ("remote-cmd" === t.type) {

      const _senderUid = (connections[o] && connections[o].uid) || (window.peerIdToUidMap && window.peerIdToUidMap[o]) || null;
      if (!_senderUid || (typeof window.isVoiceAdminUid === "function" ? !window.isVoiceAdminUid(_senderUid) : true)) {
        try { window.foxyLog && window.foxyLog("warn", "[Foxy][security] تجاهل أمر P2P من مرسل غير مشرف", { peer: o, uid: _senderUid, action: t.action }); } catch (_) {}
      } else if ("mute" === t.action) ("function" == typeof window.toggleMute && window.toggleMute(!0), addSystemMsg(window.__fb("js.mic_closed_admin", "❗ قام المدير بإغلاق المايك الخاص بك")));
      else if ("kick" === t.action) ("function" == typeof window.beforeHangup && window.beforeHangup(), "function" == typeof window.releaseVoiceSession && window.releaseVoiceSession(), "function" == typeof window.disconnectFromRoom && window.disconnectFromRoom(), "function" == typeof window.hardReset && window.hardReset(), addSystemMsg(window.__fb("js.kicked_room", "❌ تم طردك من الغرفة بواسطة المدير")));
    }
    else if ("rtc-nudge" === t.type) {

      window.FOXY_DEBUG && window.foxyLog("info", "[Foxy][webrtc] تجاهل rtc-nudge (التبديل التلقائي ملغي)", {from:o, timestamp:new Date().toISOString()});
    }     else if ("browser-sync" === t.type) "function" == typeof window.handleBrowserSync && window.handleBrowserSync(t);

    else if ("screen-join-request" === t.type) {
      const call = window.calls?.[o];
      window.foxyLog?.("info", "[Foxy][screen-flow] وصل طلب مشاهدة الشير عبر قناة الداتا", {
        fromPeerId: o,
        viewerPeerId: t.viewerPeerId || null,
        viewerUid: t.viewerUid || null,
        dataConnectionType: e.type || null,
        dataChannelState: e.dataChannel?.readyState || null,
        callFound: !!call,
        callConnectionState: call?.peerConnection?.connectionState || null,
        timestamp: new Date().toISOString()
      });
      if (typeof window.handleScreenJoinRequest === "function") {
        try {
          Promise.resolve(window.handleScreenJoinRequest(o, t.viewerPeerId, t.viewerUid)).catch(error => {
            window.foxyLog?.("error", "[Foxy][screen-flow] رفض معالج طلب مشاهدة الشير", {
              fromPeerId: o,
              errorName: error?.name || null,
              error: error?.message || String(error),
              timestamp: new Date().toISOString()
            });
          });
        } catch (error) {
          window.foxyLog?.("error", "[Foxy][screen-flow] تعطل معالج طلب مشاهدة الشير", {
            fromPeerId: o,
            errorName: error?.name || null,
            error: error?.message || String(error),
            timestamp: new Date().toISOString()
          });
        }
      } else {
        window.foxyLog?.("error", "[Foxy][screen-flow] وصل طلب الشير لكن المعالج غير محمل", { fromPeerId: o });
      }
    }
    else if ("host-ping" === t.type || "host-pong" === t.type || "host-claim" === t.type) {

      try {
        var _hs = window.__foxyRtcControlHandlers;
        if (_hs) for (var _hi = 0; _hi < _hs.length; _hi++) {
          try { _hs[_hi](t, o); } catch (_) {}
        }
      } catch (_) {}
    }
    else if ("sync" === t.type || "host-update" === t.type) {

      if (!isGuest && myId === currentHostId && Object.keys(connections).length > 0 && t.hostId !== myId) return;
      if (t.hostId && t.hostId !== currentHostId) {
        if (isGuest && t.hostId === myId) return;
        currentHostId = t.hostId, window.currentHostId = t.hostId, updateHostUI(currentHostId, myId, connections), "sync" === t.type && (isGuest = !0)
      }
      if (t.roomMode) {
        roomMode = t.roomMode;
        const e = document.getElementById("room-mode");
        e && (e.value = roomMode)
      }
      "sync" === t.type && t.peers && (t.history && t.history.forEach(e => {
        if (!isMessageInChat(e.text, e.time)) {
          const n = e.name === window.myName || "أنت" === e.name || ("function" == typeof window.__foxySelfDisplayName && e.name === window.__foxySelfDisplayName());
          appendMessageUI(e.name, e.text, e.time, e.isSystem, n)
        }
      }), t.peerStates && Object.keys(t.peerStates).forEach(e => {
        const n = t.peerStates[e],
          o = e === myId ? "me" : e;
        setTimeout(() => {
          if (void 0 === window.peersVideoStatus && (window.peersVideoStatus = {}), void 0 !== n.videoEnabled && (window.peersVideoStatus[e] = n.videoEnabled), updatePlayerStatusUI(o, n.muted, n.deafened, !1, !!n.forceMuted, !!n.forceDeafened), n.photoURL) {
            connections[e] && (connections[e].photoURL = n.photoURL);
            const t = document.querySelector(`#p-card-${o} .participant-initial`);
            const _uid1 = (connections[e] && connections[e].uid) || (window.peerIdToUidMap && window.peerIdToUidMap[e]) || null;
            t && !t.querySelector("img") && (t.innerHTML = window.createAvatarHTML(n.photoURL, n.name || n.displayName, {
              size: "full",
              withOnError: !0,
              identity: _uid1 || o,
              color: (window.state && window.state.serverMembersData && _uid1 && window.state.serverMembersData[_uid1] && (window.state.serverMembersData[_uid1].avatarColor || window.state.serverMembersData[_uid1].bannerColor)) || (e === myId && window.currentUserProfile && window.currentUserProfile.avatarColor) || ""
            }))
          }
          n.screenActive && e !== myId && "function" == typeof updateParticipantScreenStatus && updateParticipantScreenStatus(e, !0, n.screenPeerId)
        }, 1e3)
      }))
    } else if ("peer-joined" === t.type || "bridge-new-peer" === t.type);
    else if ("chat" === t.type) addChatMsg(connections[o].name, t.msg, !1, connections[o].photoURL || "");
    else if ("mic-status" === t.type) updatePlayerStatusUI(o, t.muted, null, !1, !!t.forceMuted, !1);
    else if ("deafen-status" === t.type) updatePlayerStatusUI(o, null, t.deafened, !1, !1, !!t.forceDeafened);
    else if ("rename" === t.type) {
      const e = connections[o].name;
      //FIX: لو الزميل بعت الاسم مع "#1234" بنشيل الوسم ونعرض displayName بس
      const _renamed = t.name ? ("function" == typeof window.__foxyResolvePeerName ? window.__foxyResolvePeerName(connections[o] && connections[o].uid, t.name) : t.name) : t.name;
      _renamed && (connections[o].name = _renamed), t.photoURL && (connections[o].photoURL = t.photoURL);
      const n = connections[o].name,
        r = connections[o].photoURL,
        i = document.querySelector(`#p-card-${o} .participant-name`);
      i && (i.innerText = n);
      const d = document.querySelector(`#p-card-${o} .participant-initial`);
      const _uid2 = (connections[o] && connections[o].uid) || (window.peerIdToUidMap && window.peerIdToUidMap[o]) || null;
      d && (d.innerHTML = window.createAvatarHTML(r, n, {
        size: "full",
        withOnError: !0,
        identity: _uid2 || o,
        color: (window.state && window.state.serverMembersData && _uid2 && window.state.serverMembersData[_uid2] && (window.state.serverMembersData[_uid2].avatarColor || window.state.serverMembersData[_uid2].bannerColor)) || ""
      }));
      const c = document.querySelector(`.server-voice-member-item[data-uid="${o}"] .server-voice-name`);
      c && (c.innerText = n);
      const s = document.querySelector(`.server-voice-member-item[data-uid="${o}"] .server-voice-avatar`);
      s && (s.innerHTML = window.createAvatarHTML(r, n, {
        size: "full",
        withOnError: !0,
        identity: _uid2 || o,
        color: (window.state && window.state.serverMembersData && _uid2 && window.state.serverMembersData[_uid2] && (window.state.serverMembersData[_uid2].avatarColor || window.state.serverMembersData[_uid2].bannerColor)) || ""
      })), window.updateParticipantMediaPreview?.(_uid2 || o), e !== n && (addSystemMsg(window.__f("js.renamed", {a: e, b: n}, `${e} غير اسمه إلى ${n}`)), "function" == typeof sortParticipantsUI && sortParticipantsUI())
    } else "video-status" === t.type ? (void 0 === window.peersVideoStatus && (window.peersVideoStatus = {}), window.peersVideoStatus[o] = t.enabled, "function" == typeof updatePlayerStatusUI && updatePlayerStatusUI(o, null, null, !1, !1, !1), "function" == typeof window.refreshVoiceChannelMembers && window.refreshVoiceChannelMembers()) : "video-enabled" === t.type || "video-disabled" === t.type ? (void 0 === window.peersVideoStatus && (window.peersVideoStatus = {}), window.peersVideoStatus[o] = "video-enabled" === t.type, "function" == typeof updatePlayerStatusUI && updatePlayerStatusUI(o, null, null, !1, !1, !1), "function" == typeof window.refreshVoiceChannelMembers && window.refreshVoiceChannelMembers()) : "screen-ready" === t.type ? (connections[o] && (connections[o].screenActive = !0, connections[o].screenPeerId = t.screenPeerId), "function" == typeof updateParticipantScreenStatus && updateParticipantScreenStatus(o, !0, t.screenPeerId), (() => { const _v = document.getElementById("screen-video"); const _watching = window.currentScreenSource === o && _v && _v.srcObject && _v.readyState >= 2; if (_watching) return; window._screenRemoteStoppedAt = 0, "function" == typeof window._autoResumeScreenOnNewId && window._autoResumeScreenOnNewId(o, t.screenPeerId), addSystemMsg(window.__f("js.screen_started", {name: t.name||window.__fb("js.participant", "المشارك")}, `📺 بدأ ${t.name||"المشارك"} بمشاركة شاشته`)) })()) : "screen-stopped" === t.type ? (connections[o] && (connections[o].screenActive = !1, delete connections[o].screenPeerId), "function" == typeof updateParticipantScreenStatus && updateParticipantScreenStatus(o, !1), window.currentScreenSource === o && (window._screenRemoteStoppedAt = Date.now(), window._pendingScreenResume = null, "function" == typeof closeScreenView && closeScreenView())) : "stream-quality" === t.type ? "function" == typeof updateScreenQualityIndicator && updateScreenQualityIndicator(t.level, t.bitrate) : "screen-status" === t.type ? (connections[o] && (connections[o].screenActive = t.active, connections[o].screenPeerId = t.peerId), "function" == typeof updateParticipantScreenStatus && updateParticipantScreenStatus(o, t.active, t.peerId)) : "screen-viewer-joined" === t.type ? window.isScreenSharing && (window.screenViewers?.add(o), "function" == typeof updateScreenViewerUI && updateScreenViewerUI()) : "screen-viewer-left" === t.type ? "function" == typeof window.removeScreenViewerByUid && window.removeScreenViewerByUid(o) : "request-screen-peer-id" === t.type ? window.isScreenSharing && window.currentScreenPeerId && e.send({
      type: "screen-peer-id-response",
      screenPeerId: window.currentScreenPeerId
    }) : "screen-peer-id-response" === t.type ? t.screenPeerId && t.screenPeerId !== window._pendingScreenPeerId && (window._pendingScreenPeerId = t.screenPeerId) : "intro-ack" === t.type ? (connections[o].established = !0) : "rejected" === t.type && (alert(window.__fb("js.owner_reject", "❌ عذراً، المالك رفض طلب انضمامك لهذه الغرفة.")), location.reload())
  }),   e.on("data", message => {
    if (!message || typeof message !== "object") return;
    //FIX: تشخيص — لازم نعرف إيه الرسائل اللي بتوصل فعلاً للمشاهد. لو
    //"video-source-status" مش بيوصل، المشاهد مش هيعرف إن ده شير.
    if (String(message.type || "").startsWith("screen") || message.type === "video-source-status") {
      window.foxyLog?.("info", "[Foxy][screen-diag] رسالة واردة من المشارك", {
        peerId: e.peer,
        type: message.type,
        source: message.source || null,
        enabled: message.enabled ?? null,
        screenPeerId: message.screenPeerId || null,
        reason: message.reason || null,
        hasCallForPeer: !!window.calls?.[e.peer],
        resolvedCallPeerId: window.resolveCallPeerIdByUid?.(e.peer) || null,
        connType: e.type || null,
        connOpen: !!e.open,
        timestamp: new Date().toISOString()
      });
    }
    if (message.type === "screen-ready" || message.type === "screen-stopped") {
      //FIX: الـ peerId في الرسالة ممكن يختلف عن المفتاح في connections (alias
      //لما الـ PeerJS id يتغير). كنا بنعمل connections[o].screenActive من غير
      //ما نتحقق ⇒ السجل الجديد (بعد recall) بيفقد العلامة ⇒ الواجهة مش
      //بتعرف إن ده شير ⇒ بطاقة الشير فاضية والبث مش بيظهر.
      const _pid = window.resolveCallPeerIdByUid?.(e.peer) || e.peer;
      const _conn = window.connections?.[_pid] || window.connections?.[e.peer];
      if (_conn) {
        if (message.type === "screen-ready") {
          _conn.screenActive = true;
          if (message.screenPeerId) _conn.screenPeerId = message.screenPeerId;
        } else {
          _conn.screenActive = false;
          delete _conn.screenPeerId;
        }
      }
      window.updateParticipantMediaPreview?.(_pid);
    }
    if (message.type === "video-source-status") {
      window.setRemoteVideoSourceStatus?.(e.peer, message.source, message.enabled, { screenPeerId: message.screenPeerId || null });
    } else if (message.type === "screen-viewer-count") {
      if (Array.isArray(message.viewers)) window.setRemoteScreenViewerList?.(e.peer, message.viewers);
    } else if (message.type === "screen-stopped") {
      window.clearRemoteScreenViewerList?.(e.peer);
      const ownerUid = window.peerIdToUidMap?.[e.peer] || window.connections?.[e.peer]?.uid || e.peer;
      const source = window.currentScreenSource;
      const sourceUid = source && (window.peerIdToUidMap?.[source] || window.connections?.[source]?.uid || source);
      if (source && ownerUid === sourceUid) window.stopScreenView?.();
    } else if (message.type === "screen-viewer-left") {
      window.handleScreenViewerLeft?.(e.peer, message.uid);
    } else if (message.type === "screen-join-failed") {
      const failedUid = window.peerIdToUidMap?.[e.peer] || window.connections?.[e.peer]?.uid;
      const failedMediaPeer = window.resolveScreenShareCallPeerId?.(e.peer)
        || (failedUid && window.uidToPeerIdMap?.[failedUid])
        || e.peer;
      const failedCall = window.calls?.[failedMediaPeer] || window.calls?.[e.peer];
      const reason = message.reason || "unspecified";
      const isTransientVoiceCallRace = reason === "voice-call-missing";
      if (!isTransientVoiceCallRace) document.getElementById("screen-loading")?.classList.add("hidden");
      window.foxyLog?.(isTransientVoiceCallRace ? "warn" : "error", "[Foxy][screen-diag] استقبلنا رفض طلب مشاهدة الشاشة", {
        signalingPeerId: e.peer,
        mediaPeerId: failedMediaPeer,
        uid: failedUid || null,
        reason,
        transient: isTransientVoiceCallRace,
        callState: failedCall?.peerConnection ? {
          signaling: failedCall.peerConnection.signalingState,
          connection: failedCall.peerConnection.connectionState,
          ice: failedCall.peerConnection.iceConnectionState
        } : null,
        dataConnection: window.connections?.[e.peer]?.conn ? {
          type: window.connections[e.peer].conn.type || null,
          open: !!window.connections[e.peer].conn.open,
          dataChannel: window.connections[e.peer].conn.dataChannel?.readyState || null
        } : null,
        shareCardCount: document.querySelectorAll("#participants-list .screen-share-card").length,
        timestamp: new Date().toISOString()
      });
      window.foxyDiagEvent?.("SCREEN_JOIN_FAILED", "peer=" + e.peer, "mediaPeer=" + failedMediaPeer + " reason=" + reason);
      if (window.calls?.[e.peer]) delete window.calls[e.peer]._foxyScreenJoinRequestedAt;
      if (window.calls?.[failedMediaPeer]) delete window.calls[failedMediaPeer]._foxyScreenJoinRequestedAt;
      if (isTransientVoiceCallRace) {
        const sourceUid = failedUid || window.peerIdToUidMap?.[failedMediaPeer] || window.connections?.[failedMediaPeer]?.uid || failedMediaPeer;
        const inlineRequested = !!(window._foxyInlineScreenPeers?.has(e.peer) || window._foxyInlineScreenPeers?.has(failedMediaPeer));
        const isCurrentView = window.currentScreenSource === e.peer || window.currentScreenSource === failedMediaPeer
          || !!window.currentScreenSource && (window.peerIdToUidMap?.[window.currentScreenSource] || window.connections?.[window.currentScreenSource]?.uid) === sourceUid;
        // This rejection is commonly a race with a voice-PC reconnect. Keep the
        // user's watch intent and retry timer alive; the new MediaConnection's
        // data-open hook will resend the request when the voice PC is back.
        window.foxyLog?.("info", "[Foxy][screen-diag] الاحتفاظ بطلب المشاهدة بعد رفض مؤقت", {
          signalingPeerId: e.peer,
          mediaPeerId: failedMediaPeer,
          inlineRequested,
          isCurrentView,
          retryTimerActive: !!window.calls?.[failedMediaPeer]?._foxyInlineScreenRetryTimer,
          timestamp: new Date().toISOString()
        });
        if (inlineRequested || isCurrentView) return;
      }
      window.clearScreenJoinRetry?.(e.peer);
      window.clearScreenJoinRetry?.(failedMediaPeer);
      // FIX: الناشر قال "أنا مش مشير أصلا" — امسح علامة الشير الميتة عشان
      // الكارت ميظهرش "جاري تحميل البث" للأبد ويرجع يعمل auto-join في loop.
      if (reason === "not-sharing") {
        [e.peer, failedMediaPeer].forEach(pid => {
          if (window.connections?.[pid]) { window.connections[pid].screenActive = false; delete window.connections[pid].screenPeerId; }
        });
        try { window.updateParticipantScreenStatus?.(failedMediaPeer, false); } catch (_) {}
      }
      const failedPeers = window._foxyScreenTrackFailedPeers || (window._foxyScreenTrackFailedPeers = new Set());
      failedPeers.add(e.peer);
      failedPeers.add(failedMediaPeer);
      window._foxyInlineScreenPeers?.delete(e.peer);
      window._foxyInlineScreenPeers?.delete(failedMediaPeer);
      const failedCard = window.getParticipantScreenShareCard?.(failedMediaPeer, failedUid) || document.getElementById(`screen-share-card-${failedMediaPeer}`) || document.getElementById(`p-card-${failedUid}`);
      if (failedCard) failedCard._foxyMediaInlineActive = false;
      const currentUid = window.currentScreenSource && (window.peerIdToUidMap?.[window.currentScreenSource] || window.connections?.[window.currentScreenSource]?.uid || window.currentScreenSource);
      if (window.currentScreenSource === e.peer || window.currentScreenSource === failedMediaPeer || currentUid && currentUid === failedUid) window.stopScreenView?.();
      else window.updateParticipantMediaPreview?.(failedMediaPeer);
      addSystemMsg(window.__fb("js.screen_voice_required", "تعذر استقبال الشاشة عبر اتصال الصوت الحالي. أعد الاتصال بالمشارك وحاول مرة أخرى."), "warning");
    }
  }),   e.on("close", () => {
    window.foxyCleanupConnectionResources?.(e);
    if (e._foxyIceErrorState?.timer) clearTimeout(e._foxyIceErrorState.timer);
    e._foxyIceErrorState = null;
    _unregisterPendingDial(e.peer);
    if (e._foxySuperseded) { try { pendingConnections.delete(e.peer); } catch (_) {} return; }
    _foxySay("DC_CLOSE", "peer=" + e.peer, "قناة البيانات أُغلقت — هيتبنى handleExit (والكشف بعد 12ث)");
    window.foxyLog("warn", "[Foxy][webrtc] قناة البيانات أُغلقت", {peerId:e.peer, hadConnection:!!connections[e.peer], timestamp:new Date().toISOString()});
    pendingConnections.delete(e.peer);
    handleExit(e.peer);
  })
}

function openMultiplexDataFallback(peerId, mediaCall, reason) {
  if (!mediaCall || mediaCall._foxyFallbackStarted || connections[peerId]?.conn?.type === "data") return false;
  if (!mediaCall.peerConnection || mediaCall.peerConnection.signalingState === "closed" || !window.peer || window.peer.destroyed) return false;
  mediaCall._foxyFallbackStarted = true;
  const fallbackDetail = {
    peerId,
    uid: window.peerIdToUidMap?.[peerId] || connections[peerId]?.uid || null,
    reason: reason || "unspecified",
    mediaCallPc: {
      signaling: mediaCall.peerConnection.signalingState,
      connection: mediaCall.peerConnection.connectionState,
      ice: mediaCall.peerConnection.iceConnectionState
    },
    multiplexDataOpen: !!mediaCall._foxyDataOpen,
    multiplexDataChannel: mediaCall.dataChannel?.readyState || null,
    note: "compatibility fallback may add a separate data PeerConnection",
    timestamp: new Date().toISOString()
  };
  window.foxyLog?.("warn", "[Foxy][screen-diag] بدء قناة بيانات توافقية منفصلة بعد تعذر قناة MediaConnection", fallbackDetail);
  window.foxyDiagEvent?.("MULTIPLEX_DATA_FALLBACK", "peer=" + peerId, "reason=" + fallbackDetail.reason + " mediaPc=" + fallbackDetail.mediaCallPc.connection + " dc=" + fallbackDetail.multiplexDataChannel);
  try {
    const fallback = window.peer.connect(peerId, {
      reliable: true,
      metadata: { via: "function" == typeof window.__foxySelfDisplayName ? window.__foxySelfDisplayName() : window.myName, foxyFallback: true, reason }
    });
    if (!fallback) {
      mediaCall._foxyFallbackStarted = false;
      window.foxyLog?.("error", "[Foxy][screen-diag] peer.connect أعاد null لقناة البيانات التوافقية", fallbackDetail);
      return false;
    }
    _registerPendingDial(peerId, fallback);
    setupDataConn(fallback, true);
    window.foxyLog?.("info", "[Foxy][screen-diag] تم إنشاء DataConnection التوافقية", {
      ...fallbackDetail,
      fallbackType: fallback.type || null,
      fallbackOpen: !!fallback.open,
      fallbackDataChannel: fallback.dataChannel?.readyState || null
    });
    return true;
  } catch (error) {
    mediaCall._foxyFallbackStarted = false;
    window.foxyLog?.("error", "[Foxy][screen-diag] فشل إنشاء DataConnection التوافقية", {
      ...fallbackDetail,
      errorName: error?.name || null,
      error: error?.message || String(error)
    });
    window.foxyLog?.("warn", "[Foxy][webrtc] تعذر فتح قناة بيانات توافقية", { peerId, reason, message: error?.message });
    return false;
  }
}

const DIAL_COOLDOWN_MS = 20000;
const DIAL_BACKOFF_MS = [0, 6000, 15000, 30000, 45000];
const DIAL_MAX_ATTEMPTS = 8;
const _dialState = new Map();

function _dialSlot(peerId) {
  let s = _dialState.get(peerId);
  if (!s) _dialState.set(peerId, s = { nextAt: 0, attempt: 0, timer: null, uid: null });
  return s;
}
function clearDialSlot(peerId) {
  const s = _dialState.get(peerId);
  if (s) {
    if (s.timer) clearTimeout(s.timer);
    _dialState.delete(peerId);
  }
}
window.clearDialSlot = clearDialSlot;
window.clearAllDialSlots = function() {
  for (const k of Array.from(_dialState.keys())) clearDialSlot(k);
};

const DIAL_YIELD_BASE_MS = 4000;
function isFairDialWinner(myUid, theirUid) {
  if (!myUid || !theirUid) return true;
  return String(myUid) < String(theirUid);
}

function schedulePeerDial(peerId, name, reason, theirUid) {
  if (!peerId || !window.peer) return;
  if (window.connections && window.connections[peerId]) { clearDialSlot(peerId); return; }
  if (window.pendingConnections && window.pendingConnections.has(peerId)) { clearDialSlot(peerId); return; }

  const s = _dialSlot(peerId);
  const now = Date.now();
  if (now < s.nextAt) {
_foxySay("DIAL_DEFERRED", "peer=" + peerId, "الطلب اتأجل للتبريد/cooldown، سبب=" + (reason || "?") + " — يتبقّى " + Math.round((s.nextAt - now) / 1000) + "ث. محاولات=" + s.attempt);
    return;
  }
  if (s.attempt >= DIAL_MAX_ATTEMPTS) {
    if (s.attempt === DIAL_MAX_ATTEMPTS) {
      s.attempt++;
      window.foxyLog && window.foxyLog("warn", "[Foxy][dial] استُنفدت محاولات الاتصال — إيقاف مؤقت لهذا العضو (حماية المعالج)", {
        peerId, name, timestamp: new Date().toISOString()
      });
    }
    s.nextAt = now + 120000;
    s.attempt = 0;
    return;
  }
  s.nextAt = now + DIAL_COOLDOWN_MS;
  s.attempt++;

  let delay = DIAL_BACKOFF_MS[Math.min(s.attempt, DIAL_BACKOFF_MS.length - 1)] +
    Math.round(Math.random() * 800);

  if (s.attempt === 1 && theirUid && !isFairDialWinner(window.state && window.state.myUid, theirUid)) {
    delay = Math.max(delay, DIAL_YIELD_BASE_MS) + Math.round(Math.random() * 600);
    if (window.FOXY_DEBUG) window.foxyLog("info", "[Foxy][dial] yielding first dial (tiebreak)", { peerId, theirUid, delay });
  }

  if (s.timer) clearTimeout(s.timer);
  s.timer = setTimeout(() => {
    s.timer = null;

    if (window.connections && window.connections[peerId]) { clearDialSlot(peerId); return; }
    if (window.pendingConnections && window.pendingConnections.has(peerId)) return;
    if (window.peer && (window.peer.disconnected || window.peer.destroyed)) return;
    connectToPeer(peerId, name || "...");
  }, delay);
}
window.schedulePeerDial = schedulePeerDial;

async function connectToPeer(e, n = "...", t = null) {
  if (!connections[e] && !pendingConnections.has(e)) {
    //FIX: إحنا اللي بنتصل بالزميل ⇒ يعني جلسة مقصودة، فبنشيل علامة
    //"سبنا هذا المشارك" عشان ما يتحرفضش الاتصال.
    try { window.__foxyClearLeftSessionPeers && window.__foxyClearLeftSessionPeers(e); } catch (_) {}
    if (!peer || peer.destroyed || peer.disconnected) {
      window.foxyLog("warn", "[Foxy][webrtc] تجاهل طلب اتصال لأن قناة الإشارة غير جاهزة", {targetPeer:e, exists:!!peer, destroyed:!!peer?.destroyed, disconnected:!!peer?.disconnected, timestamp:new Date().toISOString()});
      try {
        if (peer && !peer.destroyed) peer.reconnect();
        else if ("function" == typeof window.rebuildPeer) window.rebuildPeer();
      } catch (_) {}
      return;
    }

    clearDialSlot(e);
    pendingConnections.add(e);
    !isGuest || currentHostId !== myId && currentHostId || (currentHostId = e, window.currentHostId = e, updateHostUI(currentHostId, myId, connections));
    try {
      const mediaStream = await ensureLocalStream();
      if (!mediaStream) throw new Error("Local audio stream is unavailable");
      const call = peer.call(e, mediaStream, {
        reliable: true,
        metadata: { via: t || ("function" == typeof window.__foxySelfDisplayName ? window.__foxySelfDisplayName() : window.myName), foxyMux: true }
      });
      if (!call) throw new Error("PeerJS did not create the media connection");
      _registerPendingDial(e, call);
      handleCall(call);
      setupDataConn(call, true);

      // Older clients ignore app messages on the MediaConnection channel.
      // Use a standard DataConnection only if they never answer this intro.
      window._foxyMuxFallbackTimers = window._foxyMuxFallbackTimers || {};
      clearTimeout(window._foxyMuxFallbackTimers[e]);
      window._foxyMuxFallbackTimers[e] = setTimeout(() => {
        delete window._foxyMuxFallbackTimers[e];
        const record = connections[e];
        const mediaCall = window.calls?.[e];
        if (record?.established || record?.conn?.type === "data" || mediaCall?._foxyDataOpen || !mediaCall) return;
        openMultiplexDataFallback(e, mediaCall, "multiplex-channel-timeout");
      }, window.__FOXY_PEERJS_MULTIPLEX__ ? 12000 : 0);
    } catch (error) {
      pendingConnections.delete(e);
      _unregisterPendingDial(e);
      window.foxyLog?.("error", "[Foxy][webrtc] فشل إنشاء مكالمة الصوت والبيانات المدمجة", { peerId: e, message: error?.message || String(error) });
    }
  }
}

function sendSignalingCmd(e, n) {
  connections[e] && connections[e].conn.open && connections[e].conn.send(n)
}
  window.pendingConnections = pendingConnections, window.setupDataConn = setupDataConn, window.connectToPeer = connectToPeer, window.sendSignalingCmd = sendSignalingCmd;

window.__foxyRtcControlHandlers = window.__foxyRtcControlHandlers || [];
window.registerRtcControlHandler = function(fn) {
  if (typeof fn === 'function' && window.__foxyRtcControlHandlers.indexOf(fn) === -1) {
    window.__foxyRtcControlHandlers.push(fn);
  }
};
