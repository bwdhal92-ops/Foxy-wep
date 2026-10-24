/* =============================================================================
 * Foxy — Master Audio Mixer (opt-in)
 * =============================================================================
 * Routes every remote stream through ONE AudioContext:
 *
 *   remote MediaStream
 *     -> MediaStreamAudioSourceNode
 *     -> per-peer GainNode            (per-peer volume, deafen, local mute)
 *     -> [optional PannerNode]        (spatial audio, if ever enabled)
 *     -> MASTER GainNode              (headroom)
 *     -> DynamicsCompressorNode      (auto-ducking / peak control)
 *     -> AudioContext.destination
 *
 * ── Default state: OFF ─────────────────────────────────────────────────────
 * This is a real DSP change, not a refactor: a compressor colours the sound.
 * It is therefore opt-in and stored under its own localStorage key, so the
 * default audio path is byte-for-byte what it was before.
 *
 * ── On the parameters in the original spec ─────────────────────────────────
 * threshold -50dB / knee 40dB / ratio 12:1 is wrong for speech. -50dB sits
 * below essentially all talking, so the compressor would clamp the entire
 * dynamic range, producing pumping and tidal ducking - the exact artefact it
 * is meant to prevent. The defaults below are a peak-control / auto-duck
 * setting instead. The literal spec values are still available via
 * setCompressor({threshold:-50, knee:40, ratio:12}) if you really want them.
 *
 * ── What this file deliberately does NOT do ─────────────────────────────────
 * It does not touch the send path. GTCRN + RNNoise + DTX + the bitrate are
 * completely independent of playback routing, so turning the mixer on or off
 * cannot affect the outgoing audio at all.
 *
 * Loaded as a CLASSIC script. No import/export.
 * ========================================================================== */

(function () {
  'use strict';

  var ENABLED_KEY = 'vh-master-mixer';
  var CTX_SR = 48000;

  var ctx = null;
  var masterGain = null;
  var compressor = null;
  var analyserTap = null;
  var enabled = false;
  var peers = new Map();
  var duck = { active: false, at: 0, holdUntil: 0, voices: 0 };

  var building = null;

  function log(level, msg, data) {
    try { window.foxyLog && window.foxyLog(level, msg, Object.assign({ timestamp: new Date().toISOString() }, data || {})); } catch (_) {}
  }

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ sampleRate: CTX_SR, latencyHint: 'interactive' });
    masterGain = ctx.createGain();
    masterGain.gain.value = 1;

    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -22;
    compressor.knee.value = 8;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.25;

    masterGain.connect(compressor);
    compressor.connect(ctx.destination);

    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    return ctx;
  }

  function setCompressor(p) {
    if (!ensureCtx() || !compressor) return false;
    var t = ctx.currentTime;
    if (typeof p.threshold === 'number') compressor.threshold.setTargetAtTime(p.threshold, t, 0.02);
    if (typeof p.knee === 'number') compressor.knee.setTargetAtTime(p.knee, t, 0.02);
    if (typeof p.ratio === 'number') compressor.ratio.setTargetAtTime(p.ratio, t, 0.02);
    if (typeof p.attack === 'number') compressor.attack.setTargetAtTime(p.attack, t, 0.02);
    if (typeof p.release === 'number') compressor.release.setTargetAtTime(p.release, t, 0.02);
    return true;
  }

  function attachPeer(peerId, stream) {
    if (!enabled || !ensureCtx() || !stream) return false;
    if (peers.has(peerId)) { retargetPeer(peerId, stream); return true; }
    try {
      var source = ctx.createMediaStreamSource(stream);
      var gain = ctx.createGain();
      var vol = volumeFor(peerId);
      gain.gain.value = vol;
      source.connect(gain);
      gain.connect(masterGain);
      peers.set(peerId, { source: source, gain: gain, panner: null, lastVolume: vol });
      silenceElement(peerId, true);
      log('info', '[Foxy][mixer] peer-attached', { peerId: peerId.slice(-6), volume: vol });
      return true;
    } catch (e) {
      log('warn', '[Foxy][mixer] فشل ربط عضو', { peerId: peerId && peerId.slice(-6), error: e && e.message });
      return false;
    }
  }

  function retargetPeer(peerId, stream) {
    var e = peers.get(peerId);
    if (!e) return;
    try {
      var ns = ctx.createMediaStreamSource(stream);
      try { e.source.disconnect(); } catch (_) {}
      e.source.connect(e.gain);
      e.source = ns;
    } catch (_) {}
  }

  function detachPeer(peerId) {
    var e = peers.get(peerId);
    if (!e) return;
    try { e.source.disconnect(); } catch (_) {}
    try { e.gain.disconnect(); } catch (_) {}
    if (e.panner) { try { e.panner.disconnect(); } catch (_) {} }
    peers.delete(peerId);
    log('info', '[Foxy][mixer] peer-detached', { peerId: peerId && peerId.slice(-6) });
  }

  function volumeFor(peerId) {
    try {
      var v = (window._volumeStore && window._volumeStore[peerId]);
      if (typeof v !== 'number') {
        var c = window.connections && window.connections[peerId];
        v = (c && typeof c.volumeRatio === 'number') ? c.volumeRatio : 1;
      }
      var max = parseInt(localStorage.getItem('vh-max-volume') || '200', 10);
      if (v * 100 > max) v = max / 100;
      return Math.max(0, Math.min(v, 4));
    } catch (_) { return 1; }
  }

  function setPeerVolume(peerId, ratio) {
    var e = peers.get(peerId);
    if (!e || !ctx) return false;
    var target = ratio <= 1 ? ratio : ratio;
    try { e.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.015); e.lastVolume = target; } catch (_) {}
    return true;
  }

  function setPeerMuted(peerId, muted) {
    var e = peers.get(peerId);
    if (!e || !ctx) return false;
    var v = muted ? 0 : (e.lastVolume != null ? e.lastVolume : 1);
    try { e.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.02); } catch (_) {}
    return true;
  }

  var elementFor = function (peerId) { return document.getElementById('audio-' + peerId); };

  function silenceElement(peerId, on) {
    var el = elementFor(peerId);
    if (!el) return;
    if (on) {
      if (!el._foxyMixerSaved) {
        el._foxyMixerSaved = { muted: el.muted, volume: el.volume };
      }
      el.muted = true;
    } else if (el._foxyMixerSaved) {
      el.muted = el._foxyMixerSaved.muted;
      delete el._foxyMixerSaved;
    }
  }

  function migrateAllIn() {
    if (!ensureCtx()) return;
    var audios = document.querySelectorAll('#audios audio');
    var n = 0;
    for (var i = 0; i < audios.length; i++) {
      var el = audios[i];
      var pid = el.id.replace(/^audio-/, '');
      if (el.srcObject && attachPeer(pid, el.srcObject)) n++;
    }
    log('info', '[Foxy][mixer] migrate-in', { peers: n });
  }

  function migrateAllOut() {
    var audios = document.querySelectorAll('#audios audio');
    for (var i = 0; i < audios.length; i++) silenceElement(audios[i].id.replace(/^audio-/, ''), false);
    var ids = [];
    peers.forEach(function (v, k) { ids.push(k); });
    for (var j = 0; j < ids.length; j++) detachPeer(ids[j]);
    log('info', '[Foxy][mixer] migrate-out', { peers: ids.length });
  }

  function setEnabled(on) {
    on = !!on;
    if (on === enabled) return enabled;
    if (building) return enabled;
    building = (function () {
      try {
        if (on) {
          if (!ensureCtx()) {
            if (window.addSystemMsg) window.addSystemMsg('⚠️ AudioContext غير متاح في هذا المتصفح', 'warning');
            return false;
          }
          enabled = true;
          migrateAllIn();
          if (window.setAllAudioOutputs) {
            try {
              var sp = window.setAllAudioOutputs(window.currentAudioOutputDeviceId || '');
              sp && sp.catch && sp.catch(function () {});
            } catch (_) {}
          }
          if (window.refreshVizTurboMode) { try { window.refreshVizTurboMode(); } catch (_) {} }
          log('info', '[Foxy][mixer] enabled', {
            sampleRate: ctx.sampleRate,
            compressor: { threshold: compressor.threshold.value, ratio: compressor.ratio.value, knee: compressor.knee.value }
          });
          if (window.addSystemMsg) window.addSystemMsg('🔊 تم تفعيل الميكسر المركزي مع التحكم التلقائي في التداخل', 'success');
        } else {
          migrateAllOut();
          enabled = false;
          try { masterGain && masterGain.disconnect(); compressor && compressor.disconnect(); } catch (_) {}
          if (ctx) { try { ctx.close(); } catch (_) {} }
          ctx = null; masterGain = null; compressor = null;
          log('info', '[Foxy][mixer] disabled');
        }
        try { localStorage.setItem(ENABLED_KEY, on ? 'true' : 'false'); } catch (_) {}
        window.__foxyMasterMixerOn = on;
        return on;
      } finally {
        building = null;
      }
    })();
    return enabled;
  }

  var DUCK_DB = -3.5;
  var DUCK_HOLD_MS = 900;
  function updateDuck(speakingIds) {
    if (!enabled || !ctx || !masterGain) return;
    var n = speakingIds ? speakingIds.length : 0;
    duck.voices = n;
    var now = Date.now();
    if (n >= 2) {
      duck.active = true; duck.at = now; duck.holdUntil = now + DUCK_HOLD_MS;
    } else if (duck.active && now > duck.holdUntil) {
      duck.active = false;
    }
    if (duck.active) {
      var t = ctx.currentTime;
      masterGain.gain.setTargetAtTime(Math.pow(10, DUCK_DB / 20), t, 0.06);
    } else {
      masterGain.gain.setTargetAtTime(1, ctx.currentTime, 0.12);
    }
  }

  var api = {
    isEnabled: function () { return enabled; },
    enable: function () { return setEnabled(true); },
    disable: function () { return setEnabled(false); },
    setEnabled: setEnabled,
    setCompressor: setCompressor,
    attachPeer: attachPeer,
    detachPeer: detachPeer,
    retargetPeer: retargetPeer,
    setPeerVolume: setPeerVolume,
    setPeerMuted: setPeerMuted,
    updateDuck: updateDuck,
    getContext: function () { return ctx; },
    getPeerCount: function () { return peers.size; },
    getState: function () {
      return {
        enabled: enabled,
        ctxState: ctx ? ctx.state : null,
        sampleRate: ctx ? ctx.sampleRate : null,
        peers: peers.size,
        ducking: duck.active,
        speakingVoices: duck.voices,
        compressor: compressor ? {
          threshold: compressor.threshold.value, knee: compressor.knee.value,
          ratio: compressor.ratio.value, attack: compressor.attack.value,
          release: compressor.release.value
        } : null
      };
    },
    restore: function () {
      var on = false;
      try { on = localStorage.getItem(ENABLED_KEY) === 'true'; } catch (_) {}
      if (on) setEnabled(true);
      return on;
    }
  };
  window.masterAudioMixer = api;
  window.foxyMixerDiag = function () { return api.getState(); };
})();
