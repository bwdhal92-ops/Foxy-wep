/* =============================================================================
 * Foxy — Host Election & Warm Failover Coordinator
 * =============================================================================
 * Replaces the ad-hoc "lexicographically smallest peerId wins" rule that
 * webrtc-base.js used ([...Object.keys(connections), myId].sort()[0]) with a
 * score-driven election computed off-thread in rtc-analytics.worker.js.
 *
 * ── Why this is CONVERGENT and not just "everyone votes" ────────────────────
 * Every client measures a different RTT to every other client, so pure local
 * voting diverges: A thinks A is the best host, B thinks B is. We therefore
 * separate opinion from authority:
 *
 *   opinion    = worker election (who *I* think should be host, and who the
 *                standby should be) - used only to pick a candidate
 *   authority  = the `isHost: true` flag in voice_presence
 *
 * Exactly one member holds isHost. Because presence now uses
 * onDisconnect().remove() (round 1), a crashed host's presence node vanishes
 * immediately on the server, and the highest-scoring remaining member claims
 * the role in the same tick. That is both convergent and fast, and it needs no
 * consensus protocol.
 *
 * ── Honest failover budget (not marketing) ────────────────────────────────
 *   control-plane takeover (announce + local state)   <  50 ms
 *   new ICE + DTLS + first RTP                         150-800 ms (LAN)
 *                                                       500-3000 ms (internet)
 * The audible gap is therefore WebRTC connection setup, not our code. Getting
 * end-to-end under 50 ms would require a permanently pre-established redundant
 * inbound stream at the standby for every speaker, which DOUBLES total room
 * upload - the exact opposite of what this system is for. We do not do that.
 *
 * Loaded as a CLASSIC script. No import/export.
 * ========================================================================== */

(function () {
  'use strict';

  var TAKEOVER_GRACE_MS = 4000;
  var HOST_PING_MS = 2500;
  var HOST_PONG_TIMEOUT_MS = 6000;
  var CLAIM_COOLDOWN_MS = 8000;
  var TAKEOVER_DIAL_STAGGER_MS = 350;

  var state = {
    started: false,
    opinion: null,
    primaryPeerId: null,
    standbyPeerId: null,
    isPrimary: false,
    isStandby: false,
    primarySuspectAt: 0,
    lastPongAt: 0,
    claimTimer: null,
    pingTimer: null,
    lastClaimAt: 0,
    failovers: 0,
    lastFailoverAt: 0
  };

  function log(level, msg, data) {
    try { window.foxyLog && window.foxyLog(level, msg, Object.assign({ timestamp: new Date().toISOString() }, data || {})); } catch (_) {}
  }
  function sys(key, fb) { return (window.__fb && window.__fb(key, fb)) || fb; }

  function publishRole() {
    try {
      var st = window.state;
      if (!st) return;
      if (st.isVoiceHost !== state.isPrimary) st.isVoiceHost = state.isPrimary;
      window.__foxyRoleFlag = { isStandby: state.isStandby };
      if (typeof window.refreshMyVoicePresence === 'function') window.refreshMyVoicePresence();
    } catch (e) {
      log('warn', '[Foxy][failover] فشل نشر الدور', { error: e && e.message });
    }
  }

  function claimHost(reason) {
    if (state.isPrimary) return false;
    var now = Date.now();
    if (now - state.lastClaimAt < CLAIM_COOLDOWN_MS) return false;
    state.lastClaimAt = now;
    state.isPrimary = true;
    state.isStandby = false;
    state.primaryPeerId = window.myId;
    state.failovers++;
    state.lastFailoverAt = now;
    state.primarySuspectAt = 0;

    log('warn', '[Foxy][failover] claiming-host', {
      reason, failovers: state.failovers, opinion: summariseOpinion()
    });
    if (window.addSystemMsg) {
      window.addSystemMsg(sys('js.elected_host', '👑 تم انتخابك كـ Primary Host للغرفة'), 'info');
    }

    if (typeof window.adoptHostRole === 'function') {
      try { window.adoptHostRole(window.myId, 'claim:' + reason); } catch (e) {
        log('warn', '[Foxy][failover] adoptHostRole فشل', { error: e && e.message });
      }
    } else {
      try {
        window.currentHostId = window.myId;
        window.isGuest = false;
        if (typeof window.updateHostUI === 'function') {
          window.updateHostUI(window.myId, window.myId, window.connections || {});
        }
      } catch (_) {}
    }

    broadcast({ type: 'host-claim', hostId: window.myId, at: Date.now() });

    warmMediaAfterTakeover(null);

    publishRole();
    return true;
  }

  function warmMediaAfterTakeover(skipPeerId) {
    if (typeof window.schedulePeerDial !== 'function') return;
    var ids = Object.keys(window.connections || {}).filter(function (pid) {
      if (pid === window.myId) return false;
      if (skipPeerId && pid === skipPeerId) return false;
      return true;
    });
    ids.forEach(function (pid, i) {
      var nm = (window.connections[pid] && window.connections[pid].name) || '';
      setTimeout(function () {
        var c = window.connections[pid];
        if (c && c.conn && c.conn.open) return;
        window.schedulePeerDial(pid, nm, 'failover-warm');
      }, i * TAKEOVER_DIAL_STAGGER_MS);
    });
    if (!ids.length) log('info', '[Foxy][failover] لا أعضاء بانتظار اتصال وسائط بعد الاستلام');
  }

  function broadcast(msg) {
    var cs = window.connections || {};
    for (var pid in cs) {
      try {
        if (cs[pid] && cs[pid].conn && cs[pid].conn.open) cs[pid].conn.send(msg);
      } catch (_) {}
    }
  }

  function startHostPing() {
    stopHostPing();
    state.lastPongAt = Date.now();
    state.pingTimer = setInterval(function () {
      if (document.hidden) return;
      var pid = state.primaryPeerId;
      if (!pid || pid === window.myId) { state.lastPongAt = Date.now(); return; }
      var conn = window.connections && window.connections[pid];
      if (!conn || !conn.conn || !conn.conn.open) { onPrimaryLost('data-channel-closed', true); return; }
      try { conn.conn.send({ type: 'host-ping', at: Date.now() }); }
      catch (e) { onPrimaryLost('send-failed', true); }
    }, HOST_PING_MS);
  }
  function stopHostPing() {
    if (state.pingTimer) { clearInterval(state.pingTimer); state.pingTimer = null; }
  }

  function onPrimaryLost(reason, hard) {
    if (state.isPrimary || !state.primaryPeerId) return;
    var now = Date.now();
    if (!state.primarySuspectAt) {
      state.primarySuspectAt = hard ? now - TAKEOVER_GRACE_MS : now;
      log('warn', '[Foxy][failover] primary-suspect', {
        primary: state.primaryPeerId, reason, hard: !!hard
      });
    }
    if (now - state.primarySuspectAt < TAKEOVER_GRACE_MS) return;
    if (!state.isStandby) {
      stopHostPing();
      return;
    }
    if (state.claimTimer) return;
    state.claimTimer = setTimeout(function () {
      state.claimTimer = null;
      if (state.isPrimary) return;
      var stillThere = state.primaryPeerId && (window.connections && window.connections[state.primaryPeerId]);
      if (stillThere && stillThere.conn && stillThere.conn.open &&
          (Date.now() - state.lastPongAt) < HOST_PONG_TIMEOUT_MS) {
        log('info', '[Foxy][failover] host-recovered — cancelled takeover');
        state.primarySuspectAt = 0;
        return;
      }
      claimHost(reason || 'standby-timeout');
    }, 0);
  }

  function reconcileFromPresence() {
    try {
      var st = window.state;
      if (!st || !st.activeVoiceChannelId) return;
      var map = (st.activeChannelPresenceMap && st.activeChannelPresenceMap[st.activeVoiceChannelId]) ||
        (st.voicePresenceMap && st.voicePresenceMap[st.activeVoiceChannelId]);
      if (!map || typeof map !== 'object') return;
      var hostPeerId = null, hostUid = null;
      for (var uid in map) {
        if (!Object.prototype.hasOwnProperty.call(map, uid)) continue;
        var m = map[uid];
        if (m && m.isHost && m.connected && m.peerId) { hostPeerId = m.peerId; hostUid = uid; break; }
      }
      if (hostPeerId === window.myId) {
        if (!state.isPrimary) { state.isPrimary = true; state.isStandby = false; publishRole(); }
        state.primaryPeerId = window.myId;
        stopHostPing();
        return;
      }
      if (hostPeerId) {
        if (state.primaryPeerId !== hostPeerId) {
          log('info', '[Foxy][failover] host-authority', { host: hostPeerId, uid: hostUid });
          state.primaryPeerId = hostPeerId;
          state.isPrimary = false;
          state.primarySuspectAt = 0;
          if (typeof window.adoptHostRole === 'function') {
            try { window.adoptHostRole(hostPeerId, 'presence'); } catch (_) {}
          } else {
            window.currentHostId = hostPeerId;
            if (typeof window.updateHostUI === 'function') {
              window.updateHostUI(hostPeerId, window.myId, window.connections || {});
            }
          }
        }
        if (state.primaryPeerId !== window.myId && !state.pingTimer) startHostPing();
        return;
      }
      if (state.isPrimary) return;
      if (state.standbyPeerId === window.myId || isBestLocalCandidate()) {
        claimHost('no-host-in-presence');
      }
    } catch (e) {
      log('warn', '[Foxy][failover] reconcile فشل', { error: e && e.message });
    }
  }

  function isBestLocalCandidate() {
    if (!state.opinion || !state.opinion.candidates || !state.opinion.candidates.length) return false;
    var best = state.opinion.candidates[0];
    return !!best && best.peerId === window.myId;
  }

  function summariseOpinion() {
    if (!state.opinion || !state.opinion.candidates) return [];
    return state.opinion.candidates.map(function (c) {
      return (c.peerId || '').slice(-6) + ':' + c.score;
    });
  }

  function applyElection(el) {
    if (!el) return;
    var prevStandby = state.standbyPeerId;
    state.opinion = el;
    state.standbyPeerId = (el.standby && el.standby !== window.myId && el.standby !== state.primaryPeerId)
      ? el.standby : null;
    if (state.standbyPeerId !== prevStandby) {
      state.isStandby = state.standbyPeerId === window.myId;
      if (state.isStandby !== (prevStandby === window.myId)) {
        log('info', '[Foxy][failover] standby-role', { isStandby: state.isStandby, opinion: summariseOpinion() });
        publishRole();
      }
    }
    if (window.updateHostElectionUI) {
      try { window.updateHostElectionUI(state); } catch (_) {}
    }
  }

  function handleCtlMessage(msg, fromPeer) {
    if (!msg) return;
    switch (msg.type) {
      case 'host-ping':
        try {
          var c = window.connections && window.connections[fromPeer];
          if (c && c.conn && c.conn.open) c.conn.send({ type: 'host-pong', at: Date.now() });
        } catch (_) {}
        break;
      case 'host-pong':
        if (fromPeer === state.primaryPeerId) {
          state.lastPongAt = Date.now();
          if (state.primarySuspectAt) {
            state.primarySuspectAt = 0;
            log('info', '[Foxy][failover] host-alive — cancelled suspicion');
            if (state.claimTimer) { clearTimeout(state.claimTimer); state.claimTimer = null; }
          }
        }
        break;
      case 'host-claim':
        if (!msg.hostId || msg.hostId === window.myId) return;
        if (state.primaryPeerId === msg.hostId) return;
        log('info', '[Foxy][failover] remote-claim', { host: msg.hostId, from: fromPeer });
        state.primaryPeerId = msg.hostId;
        state.isPrimary = false;
        state.primarySuspectAt = 0;
        stopHostPing();
        startHostPing();
        if (typeof window.adoptHostRole === 'function') {
          try { window.adoptHostRole(msg.hostId, 'remote-claim'); } catch (_) {}
        } else {
          window.currentHostId = msg.hostId;
          if (typeof window.updateHostUI === 'function') {
            window.updateHostUI(msg.hostId, window.myId, window.connections || {});
          }
        }
        if (window.addSystemMsg) {
          window.addSystemMsg(sys('js.new_host', '👑 تم انتخاب مضيف جديد للغرفة'), 'info');
        }
        break;
    }
  }

  if (typeof window.registerRtcControlHandler === 'function') {
    window.registerRtcControlHandler(handleCtlMessage);
  } else {
    window.__foxyRtcControlHandlers = window.__foxyRtcControlHandlers || [];
    window.__foxyRtcControlHandlers.push(handleCtlMessage);
  }

  function watchPeerExit() {
    if (state._exitHooked) return;
    state._exitHooked = true;
    var orig = window.handleExit;
    if (typeof orig !== 'function') return;
    window.handleExit = function (peerId) {
      var r = orig.apply(this, arguments);
      try {
        if (window.rtcHealth && typeof window.rtcHealth.forget === 'function') window.rtcHealth.forget(peerId);
        if (peerId === state.standbyPeerId) state.standbyPeerId = null;
        if (peerId === state.primaryPeerId) onPrimaryLost('peer-exit', true);
      } catch (_) {}
      return r;
    };
  }

  var api = {
    state: state,
    start: function () {
      if (state.started) return;
      state.started = true;
      if (!window.rtcHealth) {
        log('warn', '[Foxy][failover] rtcHealth غير محمّل — انتخاب المضيف معطّل');
        return;
      }
      window.rtcHealth.on('election', applyElection);
      window.rtcHealth.start();
      watchPeerExit();

      var iv = setInterval(reconcileFromPresence, 2000);
      window.addEventListener('beforeunload', function () { clearInterval(iv); });

      log('info', '[Foxy][failover] coordinator-started', {
        workerBacked: window.rtcHealth.isWorkerBacked(),
        cores: (window.rtcHealth.getSelfStatic() || {}).cores
      });
    },
    stop: function () {
      state.started = false;
      stopHostPing();
      if (state.claimTimer) { clearTimeout(state.claimTimer); state.claimTimer = null; }
      if (window.rtcHealth) { try { window.rtcHealth.stop(); } catch (_) {} }
    },
    handleControl: handleCtlMessage,
    reconcile: reconcileFromPresence,
    getState: function () { return state; },
    forceFailover: function () {
      if (state.isPrimary) { log('warn', '[Foxy][failover] forceFailover:_we_are_primary'); return false; }
      state.primarySuspectAt = Date.now() - TAKEOVER_GRACE_MS - 1;
      onPrimaryLost('manual', true);
      return true;
    }
  };

  window.rtcFailover = api;
})();
