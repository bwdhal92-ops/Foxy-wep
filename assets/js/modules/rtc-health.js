/* =============================================================================
 * Foxy — RTC Health Facade (main thread)
 * =============================================================================
 * Thin bridge between the WebRTC layer and rtc-analytics.worker.js.
 *
 * Responsibilities:
 *   - own the Worker lifecycle (and fall back to identical main-thread maths
 *     if Worker construction fails, e.g. strict file:// or CSP)
 *   - one flat extraction pass per getStats() report, then post ~12 numbers
 *     to the worker. No analysis, no string building, no history on this side.
 *   - publish window.rtcHealth for the UI / diagnostics
 *
 * Loaded as a CLASSIC script via loadWebRTCTools (no import/export).
 * ========================================================================== */

(function () {
  'use strict';

  var WORKER_URL = 'assets/js/workers/rtc-analytics.worker.js';

  var COLLECT_MS = 5000;
  var ELECT_MS = 6000;
  var PEERS_PER_TICK = 2;

  var worker = null;
  var workerOk = false;
  var selfPeerId = null;
  var tick = 0;
  var collectTimer = null;
  var electTimer = null;

  var localPeers = {};
  var localSelfStatic = null;
  var localElection = null;

  var listeners = { election: [], stats: [] };
  var lastStatsAt = 0;
  var statsSamples = 0;

  function readSelfStatic() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    return {
      cores: navigator.hardwareConcurrency || 4,
      memoryGb: (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory > 0) ? navigator.deviceMemory : 0,
      downlinkMbps: c && typeof c.downlink === 'number' ? c.downlink : 0,
      uplinkMbps: c && typeof c.uplink === 'number' ? c.uplink : 0,
      effectiveType: c && c.effectiveType ? c.effectiveType : 'unknown',
      saveData: !!(c && c.saveData),
      mobile: /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent),
      ua: navigator.userAgent
    };
  }

  function boot() {
    selfPeerId = window.myId || null;
    var stat = readSelfStatic();
    localSelfStatic = stat;

    if (typeof Worker === 'undefined') {
      degrade('Worker غير مدعوم في هذا المتصفح');
      return;
    }
    try {
      worker = new Worker(WORKER_URL);
      worker.onmessage = onWorkerMessage;
      worker.onerror = function (e) {
        if (window.foxyLog) window.foxyLog('warn', '[Foxy][health] خطأ في WebWorker التحليلي — التحويل للحساب على Main Thread', { error: e && e.message });
        degrade('worker onerror');
      };
      worker.postMessage(Object.assign({ type: 'selfStatic' }, stat));
      workerOk = true;
    } catch (e) {
      if (window.foxyLog) window.foxyLog('warn', '[Foxy][health] تعذر تشغيل WebWorker — التحويل للحساب على Main Thread', { error: e && e.message });
      degrade('worker construct failed');
    }
  }

  function degrade(reason) {
    if (worker) { try { worker.terminate(); } catch (_) {} worker = null; }
    workerOk = false;
    if (window.foxyLog) window.foxyLog('info', '[Foxy][health] وضع بديل: تحليل الإحصاءات على Main Thread', { reason });
    localPeers = {};
    localSelfStatic = readSelfStatic();
    startLoops();
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function localIngest(m) {
    var r = localPeers[m.peerId] || (localPeers[m.peerId] = {
      rtt: null, spike: 0, loss: 0, jit: 0, cRecv: 0, frozen: 0, conn: true, last: 0
    });
    r.last = m.ts || Date.now();
    r.conn = m.connected !== false;
    var s = m.s || {};
    if (typeof s.rttMs === 'number' && s.rttMs >= 0 && s.rttMs <= 10000) {
      var prev = typeof r.rtt === 'number' ? r.rtt : Math.min(s.rttMs, 150);
      if (s.rttMs > Math.max(300, prev * 3) && prev < 300) {
        r.spike++;
        if (r.spike >= 2) { r.rtt = s.rttMs; r.spike = 0; }
      } else { r.rtt = Math.round(prev * 0.3 + s.rttMs * 0.7); r.spike = 0; }
    }
    if (typeof s.lossPct === 'number') r.loss = r.loss * 0.65 + s.lossPct * 0.35;
    if (typeof s.jitterMs === 'number') r.jit = r.jit * 0.65 + s.jitterMs * 0.35;
    if (s.packetsReceived === r.cRecv && r.conn && !s.remoteMuted) r.frozen++; else r.frozen = 0;
    r.cRecv = Math.max(r.cRecv, s.packetsReceived || 0);
    return r;
  }

  function localScore(r) {
    var rtt = typeof r.rtt === 'number' ? r.rtt : 150;
    var sc = 100 - clamp((rtt - 60) / 12, 0, 45) - clamp(r.loss * 6, 0, 35) - clamp((r.jit - 8) / 1.2, 0, 15);
    if (!r.conn) sc = Math.min(sc, 12);
    if (r.frozen >= 3) sc = Math.min(sc, 10);
    return Math.round(clamp(sc, 0, 100));
  }

  function localElect() {
    var now = Date.now();
    var list = [];
    var self = localPeers[selfPeerId];
    if (self && self.conn) list.push({ peerId: selfPeerId, score: localScore(self) });
    var cut = now - 45000;
    for (var id in localPeers) {
      if (id === selfPeerId || !localPeers[id].conn || localPeers[id].last < cut) continue;
      list.push({ peerId: id, score: localScore(localPeers[id]) });
    }
    list.sort(function (a, b) { return b.score - a.score; });
    localElection = {
      primary: list[0] ? list[0].peerId : null,
      standby: list[1] ? list[1].peerId : null,
      isPrimarySelf: list[0] ? list[0].peerId === selfPeerId : false,
      isStandbySelf: list[1] ? list[1].peerId === selfPeerId : false,
      candidates: list,
      changed: false,
      at: now
    };
    return localElection;
  }

  function onWorkerMessage(ev) {
    var m = ev.data || {};
    if (m.type === 'election') {
      lastStatsAt = Date.now();
      emit('election', m);
    } else if (m.type === 'workerError') {
      if (window.foxyLog) window.foxyLog('warn', '[Foxy][health] خطأ داخل WebWorker', { error: m.message });
    }
  }

  function emit(kind, payload) {
    var arr = listeners[kind] || [];
    for (var i = 0; i < arr.length; i++) {
      try { arr[i](payload); } catch (_) {}
    }
  }

  function extractStats(sample) {
    var out = {
      rttMs: -1, lossPct: -1, jitterMs: -1, concealPct: -1,
      bytesSent: -1, packetsLost: -1, packetsReceived: -1,
      totalSamples: -1, concealedSamples: -1, silentConcealedSamples: -1,
      jitterBufferDelay: -1, jitterBufferEmitted: -1, availableOutgoingBitrate: -1
    };
    sample.forEach(function (r) {
      if (!r) return;
      if (r.type === 'candidate-pair' && r.state === 'succeeded') {
        if (typeof r.currentRoundTripTime === 'number') out.rttMs = Math.round(r.currentRoundTripTime * 1000);
        if (typeof r.availableOutgoingBitrate === 'number') out.availableOutgoingBitrate = r.availableOutgoingBitrate;
      } else if (r.type === 'remote-inbound-rtp' && r.kind === 'audio') {
        if (typeof r.roundTripTime === 'number' && out.rttMs < 0) out.rttMs = Math.round(r.roundTripTime * 1000);
        if (typeof r.fractionLost === 'number' && out.lossPct < 0) out.lossPct = r.fractionLost * 100;
        if (typeof r.jitter === 'number' && out.jitterMs < 0) out.jitterMs = Math.round(r.jitter * 1000);
      } else if (r.type === 'inbound-rtp' && r.kind === 'audio') {
        if (typeof r.packetsLost === 'number') out.packetsLost = r.packetsLost;
        if (typeof r.packetsReceived === 'number') out.packetsReceived = r.packetsReceived;
        if (typeof r.jitter === 'number' && out.jitterMs < 0) out.jitterMs = Math.round(r.jitter * 1000);
        if (typeof r.totalSamplesReceived === 'number') out.totalSamples = r.totalSamplesReceived;
        if (typeof r.concealedSamples === 'number') out.concealedSamples = r.concealedSamples;
        if (typeof r.silentConcealedSamples === 'number') out.silentConcealedSamples = r.silentConcealedSamples;
        if (typeof r.jitterBufferDelay === 'number') out.jitterBufferDelay = r.jitterBufferDelay;
        if (typeof r.jitterBufferEmittedCount === 'number') out.jitterBufferEmitted = r.jitterBufferEmittedCount;
      } else if (r.type === 'outbound-rtp' && r.kind === 'audio') {
        if (typeof r.bytesSent === 'number') out.bytesSent = r.bytesSent;
      }
    });
    return out;
  }

  function remoteMutedHint(peerId) {
    try {
      var uid = (window.connections && window.connections[peerId] && window.connections[peerId].uid) ||
        (window.peerIdToUidMap && window.peerIdToUidMap[peerId]) || null;
      if (!uid) return false;
      var p = (window.state && window.state.activeChannelPresenceMap && window.state.activeChannelPresenceMap[uid]) || null;
      if (p && (p.muted || p.forceMuted)) return true;
      var a = document.getElementById('audio-' + peerId);
      var tr = a && a.srcObject && a.srcObject.getAudioTracks && a.srcObject.getAudioTracks()[0];
      if (tr && (tr.muted || !tr.enabled)) return true;
      return !!window.isDeafened;
    } catch (_) { return false; }
  }

  function collectOnce() {
    if (document.hidden) return;
    var calls = window.calls || {};
    var ids = Object.keys(calls);
    if (!ids.length) return;

    var batch;
    if (ids.length > PEERS_PER_TICK) {
      var start = (tick * PEERS_PER_TICK) % ids.length;
      batch = [];
      for (var i = 0; i < PEERS_PER_TICK; i++) batch.push(ids[(start + i) % ids.length]);
    } else {
      batch = ids;
    }
    tick++;

    var payload = [];
    var jobs = [];
    for (var k = 0; k < batch.length; k++) {
      (function (pid) {
        var call = calls[pid];
        var pc = call && call.peerConnection;
        if (!pc || typeof pc.getStats !== 'function') return;
        var entry = {
          peerId: pid,
          uid: (window.connections && window.connections[pid] && window.connections[pid].uid) || (window.peerIdToUidMap && window.peerIdToUidMap[pid]) || null,
          name: (window.connections && window.connections[pid] && window.connections[pid].name) || null,
          connected: true,
          ts: Date.now(),
          s: null
        };
        jobs.push(pc.getStats().then(function (report) {
          entry.s = extractStats(report);
          entry.s.remoteMuted = remoteMutedHint(pid);
          payload.push(entry);
        }).catch(function () {}));
      })(batch[k]);
    }

    Promise.all(jobs).then(function () {
      if (!payload.length) return;
      statsSamples++;
      if (workerOk && worker) {
        worker.postMessage({ type: 'stats', batch: payload });
      } else {
        for (var i = 0; i < payload.length; i++) localIngest(payload[i]);
      }
      for (var j = 0; j < payload.length; j++) {
        try {
          var e = payload[j];
          if (typeof e.s.rttMs === 'number' && e.s.rttMs >= 0) {
            window.peerRttMap = window.peerRttMap || {};
            window.peerRttTs = window.peerRttTs || {};
            window.peerRttMap[e.peerId] = e.s.rttMs;
            window.peerRttTs[e.peerId] = e.ts;
          }
        } catch (_) {}
      }
      emit('stats', payload);
    }).catch(function () {});
  }

  function runElection() {
    selfPeerId = window.myId || selfPeerId;
    if (workerOk && worker) {
      worker.postMessage({ type: 'elect', selfPeerId: selfPeerId });
    } else {
      emit('election', localElect());
    }
  }

  function startLoops() {
    stopLoops();
    collectTimer = setInterval(collectOnce, COLLECT_MS);
    electTimer = setInterval(runElection, ELECT_MS);
    document.addEventListener('visibilitychange', function onVis() {
      if (!document.hidden) { runElection(); collectOnce(); }
    });
  }

  function stopLoops() {
    if (collectTimer) { clearInterval(collectTimer); collectTimer = null; }
    if (electTimer) { clearInterval(electTimer); electTimer = null; }
  }

  var api = {
    start: function () {
      if (api._started) return;
      api._started = true;
      boot();
      startLoops();
    },
    stop: function () {
      api._started = false;
      stopLoops();
      if (worker) { try { worker.terminate(); } catch (_) {} worker = null; workerOk = false; }
    },
    isWorkerBacked: function () { return workerOk; },
    forget: function (peerId) {
      if (!peerId) return;
      if (workerOk && worker) {
        try { worker.postMessage({ type: 'drop', peerId: peerId }); } catch (_) {}
      }
      delete localPeers[peerId];
    },
    on: function (kind, fn) { (listeners[kind] = listeners[kind] || []).push(fn); },
    getSelfStatic: function () { return localSelfStatic || readSelfStatic(); },
    getLocalElection: function () { return localElection; },
    diag: function () {
      if (workerOk && worker) {
        return new Promise(function (resolve) {
          var id = 'd' + Date.now();
          var h = function (ev) {
            if (ev.data && ev.data.type === 'diagResult' && ev.data.requestId === id) {
              worker.removeEventListener('message', h);
              resolve(ev.data);
            }
          };
          worker.addEventListener('message', h);
          worker.postMessage({ type: 'diag', requestId: id });
          setTimeout(function () { worker.removeEventListener('message', h); resolve({ error: 'timeout' }); }, 2000);
        });
      }
      return Promise.resolve({
        mode: 'main-thread-fallback',
        peerCount: Object.keys(localPeers).length,
        selfStatic: localSelfStatic,
        election: localElection
      });
    },
    extractStats: extractStats
  };
  window.rtcHealth = api;
  window.foxyHealthDiag = api.diag;
})();
