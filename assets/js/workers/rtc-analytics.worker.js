/* =============================================================================
 * Foxy — RTC Analytics Worker
 * =============================================================================
 * Runs entirely OFF the main thread. Owns:
 *   - getStats() report analysis (RTT smoothing, loss, jitter, concealment,
 *     jitter-buffer delay, measured uplink)
 *   - a RAW worst-case window used to penalise links that spike
 *   - per-peer health scoring and Primary / Standby host election
 *   - voice_presence tree diffing (member signature + member id list)
 *
 * The main thread never parses a stats report beyond a single flat extraction
 * pass that pulls ~13 numbers; everything else happens here.
 *
 * NOTE ON WHAT IS NOT HERE: a browser-hosted Mini-SFU relay was designed and
 * then removed. A browser cannot forward RTP, so any in-browser relay must
 * decode and RE-ENCODE (a generational quality loss), and the "zero audio gap
 * on fallback" requirement provably cancels the bandwidth saving it was meant
 * to provide: keeping the mesh up is exactly what guarantees the gap is zero,
 * and keeping the mesh up means upload stays N-1. The raw-measurement
 * instrumentation built for it was kept and repurposed - see the spike
 * penalty in rescore(), which makes the host election ignore averages.
 *
 * Loaded as a CLASSIC worker (new Worker(url)) - not an ES module - because
 * the project has no bundler. assets/js/workers is explicitly excluded from
 * minify/obfuscate (see build-compress.js / build-encrypt.js).
 * ========================================================================== */

'use strict';

// ── Tuning ────────────────────────────────────────────────────────────────
var RTT_FLOOR_INIT = 150;     // first sample seeds low so one spike decays fast
var RTT_MAX_VALID = 10000;    // anything above this is a corrupt measurement
var LOSS_SMOOTH = 0.35;       // EMA factor for loss (lower = smoother)
var JITTER_SMOOTH = 0.35;
var EWMA_FAST = 0.7, EWMA_SLOW = 0.3;

// Election hysteresis. Without these the host flaps on every score wobble,
// which is far worse than a slightly sub-optimal host.
var ELECTION_MIN_HOLD_MS = 45000;  // keep a host at least this long
var ELECTION_MARGIN = 12;          // challenger must beat incumbent by this
var ELECTION_GRACE_MS = 20000;     // ignore challengers for this long after start
var STALE_PEER_MS = 45000;         // no stats for this long => not a candidate
// Worst-case window half-life. Long enough to keep a real stall on the record,
// short enough that one bad minute does not disqualify a peer forever.
var WINDOW_DECAY_MS = 120000;

// ── State ─────────────────────────────────────────────────────────────────
var peers = new Map();      // peerId -> history record
var selfStatic = null;      // device capability snapshot (never changes)
var lastElectionAt = 0;
var electedPrimary = null;
var electedStandby = null;
var bootAt = Date.now();

// ── Helpers ───────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }
function isNum(v) { return typeof v === 'number' && isFinite(v); }

function newRecord() {
  return {
    uid: null,
    name: null,
    lastSeen: 0,
    // smoothed, for DISPLAY and for the average part of the score
    rtt: null, rttPrev: null, spikeStreak: 0,
    lossPct: 0, jitterMs: 0,
    concealPct: 0, silentSharePct: 0, jbDelayMs: 0,
    uplinkKbps: 0, availOutKbps: 0,
    // raw + unsmoothed: the spike penalty must never read an EMA, because an
    // average hides exactly the stalls that make a peer a bad host.
    rawLossPct: null, rawRttMs: null, bweAt: 0,
    // worst-case window, decayed toward 0 in runElection()
    winRttMax: 0, winLossMax: 0, winSamples: 0,
    // raw counters for the delta maths
    cPacketsLost: 0, cPacketsRecv: 0, cBytesSent: 0, cSamples: 0,
    cConcealed: 0, cSilent: 0, cJbDelay: 0, cJbEmitted: 0, lastBytesTs: 0,
    frozenStreak: 0, connected: false,
    score: 50
  };
}

// ── Static device capability (sent once from the main thread) ─────────────
function setSelfStatic(msg) {
  selfStatic = {
    cores: Math.max(1, num(msg.cores) || 1),
    memoryGb: num(msg.memoryGb) || 0,
    downlinkMbps: num(msg.downlinkMbps) || 0,
    uplinkMbps: num(msg.uplinkMbps) || 0,
    effectiveType: msg.effectiveType || 'unknown',
    mobile: !!msg.mobile,
    saveData: !!msg.saveData,
    ua: msg.ua || ''
  };
}

// Diagnostic only. It does NOT influence the election: a device profile is a
// static guess made once at join, whereas the health score is built from live
// measurements, and a static guess should never override a measurement.
function deviceProfile() {
  if (!selfStatic) return { cores: 0, mobile: false, headroom: 0 };
  var coreScore = clamp((selfStatic.cores - 2) / 6, 0, 1);
  var memScore = selfStatic.memoryGb > 0 ? clamp((selfStatic.memoryGb - 2) / 6, 0, 1) : 0.4;
  var mobilePenalty = selfStatic.mobile ? 0.45 : 1.0;
  return {
    cores: selfStatic.cores,
    mobile: selfStatic.mobile,
    memoryGb: selfStatic.memoryGb,
    headroom: clamp((coreScore * 0.6 + memScore * 0.4) * mobilePenalty, 0, 1)
  };
}

// ── Stats analysis ────────────────────────────────────────────────────────
// msg: { peerId, uid, name, connected, ts, s: { flat numbers from the report } }
function ingestStats(msg) {
  var id = msg.peerId;
  if (!id) return;
  var r = peers.get(id);
  if (!r) { r = newRecord(); peers.set(id, r); }
  r.uid = msg.uid || r.uid;
  r.name = msg.name || r.name;
  r.lastSeen = msg.ts || Date.now();
  r.connected = msg.connected !== false;

  var s = msg.s || {};

  // ---- RTT with spike rejection (for the DISPLAYED value) ----------------
  // A single delayed RTCP (busy main thread, WiFi contention, pair switch) can
  // read 800ms then fall back to 12ms. The raw value stays raw for the spike
  // penalty; only the displayed value is smoothed, or the indicator strobes.
  var rawRtt = isNum(s.rttMs) && s.rttMs >= 0 && s.rttMs <= RTT_MAX_VALID ? s.rttMs : null;
  if (rawRtt !== null) {
    var prev = isNum(r.rtt) ? r.rtt : Math.min(rawRtt, RTT_FLOOR_INIT);
    if (rawRtt > Math.max(300, prev * 3) && prev < 300) {
      r.spikeStreak++;
      if (r.spikeStreak < 2) {
        r.rttPrev = prev;                 // hold the good value for one sample
      } else {
        r.rtt = rawRtt; r.spikeStreak = 0;
      }
    } else {
      r.rtt = Math.round(prev * EWMA_SLOW + rawRtt * EWMA_FAST);
      r.spikeStreak = 0;
    }
    r.rawRttMs = rawRtt;
  }

  // ---- Loss / jitter (EMA, for display + the average part of the score) ---
  if (isNum(s.lossPct) && s.lossPct >= 0 && s.lossPct <= 100) {
    r.lossPct = r.lossPct * (1 - LOSS_SMOOTH) + s.lossPct * LOSS_SMOOTH;
  }
  if (isNum(s.jitterMs) && s.jitterMs >= 0 && s.jitterMs <= 5000) {
    r.jitterMs = r.jitterMs * (1 - JITTER_SMOOTH) + s.jitterMs * JITTER_SMOOTH;
  }

  // ---- RAW instantaneous loss, from counter DELTAS ------------------------
  // fractionLost is cumulative: after one early glitch a long-lived call keeps
  // a >0 value forever, which would make it useless as a "is this link clean
  // right now" signal. Deltas give the honest instantaneous figure.
  var prevRecv = r.cPacketsRecv, prevLost = r.cPacketsLost;
  var dRecv = num(s.packetsReceived) - prevRecv;
  var dLost = num(s.packetsLost) - prevLost;
  if (dRecv > 0 || dLost > 0) {
    var dTotal = dRecv + dLost;
    r.rawLossPct = dTotal > 0 ? (100 * dLost / dTotal) : 0;
    r.cPacketsRecv = num(s.packetsReceived);
    r.cPacketsLost = num(s.packetsLost);
  }
  // If nothing new arrived that is silence, not evidence of a good link: we do
  // not refresh the reading, so the window simply ages out.

  // ---- worst-case rolling window ------------------------------------------
  if (r.rawRttMs !== null && r.rawRttMs > r.winRttMax) r.winRttMax = r.rawRttMs;
  if (r.rawLossPct !== null && r.rawLossPct > r.winLossMax) r.winLossMax = r.rawLossPct;
  r.winSamples++;

  // ---- Concealment / silence share ---------------------------------------
  // Distinguishes "the network dropped voice" (high conceal, low silent share)
  // from "the sender is quiet" (high conceal, ~100% silent = DTX / gate / the
  // VAD suppressor). Only the former should count against a peer.
  if (s.totalSamples > r.cSamples) {
    var dSamp = s.totalSamples - r.cSamples;
    var dCon = Math.max(0, s.concealedSamples - r.cConcealed);
    var dSil = Math.max(0, s.silentConcealedSamples - r.cSilent);
    if (dSamp > 0) {
      r.concealPct = parseFloat((100 * dCon / dSamp).toFixed(1));
      r.silentSharePct = dCon > 0 ? Math.round(100 * dSil / dCon) : 0;
    }
    var dEmit = Math.max(1, s.jitterBufferEmitted - r.cJbEmitted);
    r.jbDelayMs = Math.round(1000 * Math.max(0, s.jitterBufferDelay - r.cJbDelay) / dEmit);
  }
  r.cSamples = Math.max(r.cSamples, num(s.totalSamples));
  r.cConcealed = Math.max(r.cConcealed, num(s.concealedSamples));
  r.cSilent = Math.max(r.cSilent, num(s.silentConcealedSamples));
  r.cJbDelay = Math.max(r.cJbDelay, num(s.jitterBufferDelay));
  r.cJbEmitted = Math.max(r.cJbEmitted, num(s.jitterBufferEmitted));

  // ---- Measured uplink ----------------------------------------------------
  // outbound-rtp bytesSent is monotonic; convert to kbps over real elapsed
  // time. This is the only honest uplink figure available without a bandwidth
  // probe, and it is what the diagnostics report.
  if (s.bytesSent > r.cBytesSent && r.cBytesSent > 0) {
    var dtSec = ((msg.ts || 0) - (r.lastBytesTs || 0)) / 1000;
    if (dtSec > 0.5) {
      var kbps = ((s.bytesSent - r.cBytesSent) * 8) / dtSec / 1000;
      r.uplinkKbps = Math.round(r.uplinkKbps ? r.uplinkKbps * 0.6 + kbps * 0.4 : kbps);
      r.lastBytesTs = msg.ts || r.lastBytesTs;
    }
  } else if (s.bytesSent > 0) {
    r.lastBytesTs = msg.ts || r.lastBytesTs;
  }
  r.cBytesSent = Math.max(r.cBytesSent, num(s.bytesSent));

  // ---- advertised available outgoing bitrate ------------------------------
  if (isNum(s.availableOutgoingBitrate) && s.availableOutgoingBitrate > 0) {
    r.availOutKbps = Math.round(s.availableOutgoingBitrate / 1000);
    r.bweAt = msg.ts || Date.now();
  }

  // ---- frozen-packet streak ----------------------------------------------
  r.frozenStreak = (dRecv === 0 && dLost === 0 && r.connected && !s.remoteMuted)
    ? r.frozenStreak + 1 : 0;

  rescore(r);
  return r;
}

// ── Scoring ───────────────────────────────────────────────────────────────
function rescore(r) {
  var rtt = isNum(r.rtt) ? r.rtt : 150;
  var s = 100;
  s -= clamp((rtt - 60) / 12, 0, 45);              // 60ms -> 0, 600ms -> 45
  s -= clamp(r.lossPct * 6, 0, 35);                // 0% -> 0, ~6% -> 35
  s -= clamp((r.jitterMs - 8) / 1.2, 0, 15);
  // Concealment only hurts when it is NOT explained by the sender being quiet.
  var unexplainedConceal = r.concealPct * (1 - clamp(r.silentSharePct / 80, 0, 1));
  s -= clamp(unexplainedConceal * 3, 0, 20);

  // ---- spike penalty ------------------------------------------------------
  // An EMA is the right input for "how does this link feel on average" and
  // exactly the wrong input for "should this peer be the room's HOST". A peer
  // that averages 40ms but spikes to 900ms every few seconds would otherwise
  // look healthy while intermittently stalling, and it would be handed the
  // whole room's chat-history sync and private-room approvals. So the worst
  // sample in the window is penalised on top of the average.
  if (r.winRttMax > rtt) s -= clamp((r.winRttMax - rtt) / 6, 0, 20);
  if (r.winLossMax > r.lossPct) s -= clamp((r.winLossMax - r.lossPct) * 4, 0, 25);

  if (!r.connected) s = Math.min(s, 12);
  if (r.frozenStreak >= 3) s = Math.min(s, 10);
  r.score = Math.round(clamp(s, 0, 100));
}

// ── Election ──────────────────────────────────────────────────────────────
function runElection(selfPeerId) {
  var now = Date.now();
  var candidates = [];
  var selfRec = peers.get(selfPeerId);

  // Decay the worst-case window toward zero so one bad stretch does not
  // disqualify a peer indefinitely.
  peers.forEach(function (r) {
    var age = now - r.lastSeen;
    if (age > WINDOW_DECAY_MS) { r.winRttMax = 0; r.winLossMax = 0; r.winSamples = 0; return; }
    var k = clamp(1 - age / WINDOW_DECAY_MS, 0, 1);
    r.winRttMax *= k;
    r.winLossMax *= k;
  });

  if (selfRec && selfRec.connected) {
    candidates.push({ peerId: selfPeerId, score: selfRec.score, self: true, uid: selfRec.uid });
  }
  var staleCut = now - STALE_PEER_MS;
  peers.forEach(function (r, id) {
    if (id === selfPeerId) return;
    if (!r.connected || r.lastSeen < staleCut) return;
    candidates.push({ peerId: id, score: r.score, self: false, uid: r.uid });
  });

  candidates.sort(function (a, b) { return b.score - a.score; });

  var primary = candidates[0] || null;
  var standby = candidates[1] || null;
  var changed = false;

  if (primary) {
    var incumbentScore = electedPrimary ? scoreOf(electedPrimary) : -1;
    var primarySelf = electedPrimary === selfPeerId;
    var tooSoon = now - lastElectionAt < ELECTION_MIN_HOLD_MS;
    var tooEarly = now - bootAt < ELECTION_GRACE_MS;
    var beats = primarySelf
      ? primary.score >= incumbentScore
      : primary.score >= incumbentScore + ELECTION_MARGIN;
    if (!electedPrimary || (!tooSoon && !tooEarly && beats)) {
      changed = electedPrimary !== primary.peerId;
      electedPrimary = primary.peerId;
      lastElectionAt = now;
    }
  } else {
    electedPrimary = null;
  }
  electedStandby = standby && standby.peerId !== electedPrimary ? standby.peerId : null;

  return {
    primary: electedPrimary,
    standby: electedStandby,
    isPrimarySelf: electedPrimary === selfPeerId,
    isStandbySelf: electedStandby === selfPeerId,
    candidates: candidates.map(function (c) {
      return { peerId: c.peerId, uid: c.uid || null, score: c.score, self: !!c.self };
    }),
    changed: changed,
    at: now
  };
}

function scoreOf(peerId) { var r = peers.get(peerId); return r ? r.score : -1; }

// ── Presence tree diffing ─────────────────────────────────────────────────
// The main thread used to JSON.stringify every channel x member on every single
// onValue snapshot, twice, then rebuild the whole map. That is pure CPU and
// belongs here.
function diffPresence(tree) {
  var sig = [];
  var ids = [];
  var channels = tree || {};
  for (var ch in channels) {
    if (!Object.prototype.hasOwnProperty.call(channels, ch)) continue;
    var members = channels[ch] || {};
    var keys = [];
    for (var uid in members) {
      if (Object.prototype.hasOwnProperty.call(members, uid)) keys.push(uid);
    }
    keys.sort();
    sig.push(ch + ':' + keys.join(','));
    for (var i = 0; i < keys.length; i++) ids.push(ch + '/' + keys[i]);
  }
  sig.sort();
  return { signature: sig.join('|'), memberIds: ids };
}

// ── Message plumbing ──────────────────────────────────────────────────────
self.onmessage = function (ev) {
  var msg = ev.data || {};
  try {
    switch (msg.type) {
      case 'hello':
      case 'selfStatic':
        setSelfStatic(msg);
        post({ type: 'selfStaticAck' });
        break;

      case 'stats':
        if (msg.batch) {
          for (var i = 0; i < msg.batch.length; i++) ingestStats(msg.batch[i]);
        } else {
          ingestStats(msg);
        }
        post({ type: 'statsAck', peerId: msg.peerId, at: Date.now() });
        break;

      case 'elect':
        post(Object.assign({ type: 'election' }, runElection(msg.selfPeerId)));
        break;

      case 'poll': {
        var out = [];
        peers.forEach(function (r, id) {
          out.push({
            peerId: id, uid: r.uid, name: r.name, connected: r.connected,
            rtt: r.rtt, lossPct: Math.round(r.lossPct * 10) / 10,
            jitterMs: Math.round(r.jitterMs), concealPct: r.concealPct,
            silentSharePct: r.silentSharePct, jbDelayMs: r.jbDelayMs,
            uplinkKbps: r.uplinkKbps, availOutKbps: r.availOutKbps,
            score: r.score,
            rawRttMs: r.rawRttMs, rawLossPct: r.rawLossPct, bweAt: r.bweAt,
            winRttMax: Math.round(r.winRttMax), winLossMax: r.winLossMax,
            winSamples: r.winSamples,
            frozenStreak: r.frozenStreak, lastSeen: r.lastSeen
          });
        });
        post({ type: 'pollResult', requestId: msg.requestId, peers: out, at: Date.now() });
        break;
      }

      case 'presenceDiff':
        post(Object.assign(
          { type: 'presenceDiffResult', requestId: msg.requestId },
          diffPresence(msg.tree)
        ));
        break;

      case 'drop':
        peers.delete(msg.peerId);
        if (electedPrimary === msg.peerId) electedPrimary = null;
        if (electedStandby === msg.peerId) electedStandby = null;
        post({ type: 'dropAck', peerId: msg.peerId });
        break;

      case 'clear':
        peers.clear();
        electedPrimary = null;
        electedStandby = null;
        lastElectionAt = 0;
        post({ type: 'clearAck' });
        break;

      case 'diag':
        post({
          type: 'diagResult', requestId: msg.requestId,
          peerCount: peers.size,
          electedPrimary: electedPrimary,
          electedStandby: electedStandby,
          selfStatic: selfStatic,
          device: deviceProfile(),
          tuning: {
            electionMinHoldMs: ELECTION_MIN_HOLD_MS,
            electionMargin: ELECTION_MARGIN,
            electionGraceMs: ELECTION_GRACE_MS,
            stalePeerMs: STALE_PEER_MS,
            windowDecayMs: WINDOW_DECAY_MS
          }
        });
        break;
    }
  } catch (e) {
    post({ type: 'workerError', message: (e && e.message) || String(e) });
  }
};

function post(obj) { self.postMessage(obj); }
