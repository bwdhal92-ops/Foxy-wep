window.calls = window.calls || {};
const reCallInProgress = new Set;
window.reCallInProgress = reCallInProgress;

const _dshort = (v, n) => {
  try {
    n = n || 20;
    if (v == null) return "∅";
    v = String(v);
    return v.length > n ? v.slice(0, n) + "…" : v;
  } catch (_) { return "?" }
};
function _foxySay(code, subject, detail) {
  try { "function" == typeof window.foxyDiagEvent && window.foxyDiagEvent(code, subject, detail); } catch (_) {}
}

const peerGainNodes = new Map,
  callQualityHistory = new Map;

const RECALL_COOLDOWN_MS = 30000;
const RECALL_BACKOFF_MS = [5000, 10000, 20000, 30000, 30000, 45000];
const RECALL_MAX_ATTEMPTS = 6;
const _recallState = new Map();

function _recallSlot(peerId) {
  let s = _recallState.get(peerId);
  if (!s) _recallState.set(peerId, s = { nextAt: 0, attempt: 0, timer: null });
  return s;
}
function _clearRecallSlot(peerId) {
  const s = _recallState.get(peerId);
  if (s) {
    if (s.timer) clearTimeout(s.timer);
    _recallState.delete(peerId);
  }
}
window.clearRecallSlot = _clearRecallSlot;
window.clearAllRecallSlots = function() {
  for (const k of Array.from(_recallState.keys())) _clearRecallSlot(k);
};

function getCallVideoSender(call) {
  if (!call?.peerConnection || call.peerConnection.signalingState === "closed") return null;
  if (call._foxyVideoSender) return call._foxyVideoSender;
  const transceiver = call.peerConnection.getTransceivers?.().find(item =>
    item.receiver?.track?.kind === "video" || item.sender?.track?.kind === "video"
  );
  if (transceiver?.sender) {
    call._foxyVideoTransceiver = transceiver;
    call._foxyVideoSender = transceiver.sender;
    return transceiver.sender;
  }
  return null;
}

function addTrackOnce(stream, track) {
  if (stream && track && !stream.getTracks().some(existing => existing.id === track.id)) stream.addTrack(track);
}

if (typeof window._foxyScreenVolume !== "number") window._foxyScreenVolume = 1;
if (typeof window._foxyScreenAudioMuted !== "boolean") window._foxyScreenAudioMuted = false;

function getScreenAudioCall(peerId) {
  if (!peerId) return null;
  if (window.calls?.[peerId]) return window.calls[peerId];
  const mappedPeerId = window.uidToPeerIdMap?.[peerId];
  if (mappedPeerId && window.calls?.[mappedPeerId]) return window.calls[mappedPeerId];
  const resolvedPeerId = Object.keys(window.calls || {}).find(id =>
    window.peerIdToUidMap?.[id] === peerId || window.connections?.[id]?.uid === peerId
  );
  return resolvedPeerId ? window.calls[resolvedPeerId] : null;
}

function hasLiveScreenAudioTrack(call) {
  try {
    return !!call?._foxyRemoteScreenAudioStream?.getAudioTracks?.().some(track => track.readyState === "live");
  } catch (_) { return false; }
}

//FIX: كنا بنرجع الـ call المباشر حتى لو مفيهوش صوت شاشة، فـ sync كان بيقفل
//(pause) العنصر الصوت المشترك والمصدر بينقلب لـ null ⇒ عنصر الصوت مش
//يشتغل/Sلايدر مبيبقاش ليه أي تأثير. دلوقتي بنفضّل الـ call اللي فيه صوت
//شاشة حيّ فعلاً، وبعدين بنرجع للـ call المباشر كحل أخير.
function findScreenAudioCall(peerId) {
  const direct = getScreenAudioCall(peerId);
  if (direct && hasLiveScreenAudioTrack(direct)) return direct;
  const calls = Object.values(window.calls || {}).filter(call => hasLiveScreenAudioTrack(call));
  return calls[0] || direct || null;
}
window.findScreenAudioCall = findScreenAudioCall;

// The screen-audio transceiver is the one reserved right after the video one
// (audio order = mic, video, screen-audio). The originator knows it by
// reference, but the answerer only learns about it from the remote
// description, so it has to be resolved from the transceiver list.
//
//FIX: كان فيه شرط "الـ transceiver ده مش اللي ماسك الـ track الحالي" وبيرجّع
//null في حالة المستقبِل — لأن التراك الواصل على المستقبِل هو نفسه
//track الـ receiver ⇒ الـ screen audio كان بيتوجّه لمسار الميكروفون
//(وبالتالي السلايدر ميبقاش ليه أي تأثير).
function resolveScreenAudioTransceiver(call, currentTrackId) {
  if (!call) return null;
  const pc = call.peerConnection;
  if (!pc || typeof pc.getTransceivers !== "function") return call._foxyScreenAudioTransceiver || null;
  let transceivers = [];
  try { transceivers = pc.getTransceivers() || []; } catch (_) { return call._foxyScreenAudioTransceiver || null; }
  const audioTransceivers = transceivers.filter(transceiver =>
    transceiver.receiver?.track?.kind === "audio" || transceiver.sender?.track?.kind === "audio");
  // A single audio channel can only be the microphone, never the screen audio.
  if (audioTransceivers.length < 2) return call._foxyScreenAudioTransceiver || null;
  const videoIndex = transceivers.findIndex(transceiver =>
    transceiver.receiver?.track?.kind === "video" || transceiver.sender?.track?.kind === "video");
  const afterVideo = audioTransceivers.filter(transceiver => transceivers.indexOf(transceiver) > videoIndex);
  const picked = afterVideo[afterVideo.length - 1] || audioTransceivers[audioTransceivers.length - 1];
  if (picked) call._foxyScreenAudioTransceiver = picked;
  return picked;
}
window.resolveScreenAudioTransceiver = resolveScreenAudioTransceiver;

// Pulls the screen audio out of the microphone stream when it was routed
// there by mistake, so the share volume actually controls what is heard.
function moveScreenAudioOutOfMicStream(call) {
  if (!call) return false;
  const transceiver = resolveScreenAudioTransceiver(call);
  const screenTrackId = transceiver?.receiver?.track?.id;
  if (!screenTrackId) return false;
  // Never touch the microphone channel.
  try {
    const audioTransceivers = (call.peerConnection?.getTransceivers?.() || []).filter(item =>
      item.receiver?.track?.kind === "audio" || item.sender?.track?.kind === "audio");
    if (audioTransceivers.length > 1 && audioTransceivers[0] === transceiver) return false;
  } catch (_) {}
  const micStream = call._foxyRemoteAudioStream;
  if (!micStream || typeof micStream.getAudioTracks !== "function") return false;
  const misplaced = micStream.getAudioTracks().filter(track => track.id === screenTrackId);
  if (!misplaced.length) return false;
  call._foxyRemoteScreenAudioStream ||= new MediaStream();
  misplaced.forEach(track => {
    try { micStream.removeTrack(track); } catch (_) {}
    addTrackOnce(call._foxyRemoteScreenAudioStream, track);
  });
  const tracks = [
    ...(call._foxyRemoteAudioStream?.getTracks?.() || []),
    ...(call._foxyRemoteVideoStream?.getTracks?.() || [])
  ];
  call.remoteStream = tracks.length ? new MediaStream(tracks) : null;
  return true;
}
window.moveScreenAudioOutOfMicStream = moveScreenAudioOutOfMicStream;

//FIX: صوت مشاركة الشاشة لازم يتشغل من عنصر واحد بس (remote-screen-audio)
//عشان سلايدر الصوت يكون هو المتحكم الوحيد فيه. لو نفس التراك وصل لعنصر
//تاني (زي عنصر الميكروفون audio-<peer>) الصوت بيفضل شغال بكامل مستواه
//والسلايدر بيبان كأنه "مش بيعمل حاجة". بنشيل التراك من أي عنصر تاني.
function isolateScreenAudioTrack(track) {
  if (!track) return false;
  let removed = false;
  try {
    document.querySelectorAll('audio[id^="audio-"]').forEach(el => {
      const stream = el.srcObject;
      if (!stream || typeof stream.getAudioTracks !== "function") return;
      if (!stream.getAudioTracks().some(item => item.id === track.id)) return;
      try { stream.removeTrack(track); removed = true; } catch (_) {}
    });
  } catch (_) {}
  try {
    peerGainNodes.forEach(entry => {
      const cloned = entry?.clonedStream;
      if (!cloned || typeof cloned.getAudioTracks !== "function") return;
      if (!cloned.getAudioTracks().some(item => item.id === track.id)) return;
      try { cloned.removeTrack(track); removed = true; } catch (_) {}
    });
  } catch (_) {}
  //FIX: عنصر الفيديو (الشاشة أو بطاقات المعاينة) ممكن يكون شايل تراك صوت
  //الشاشة ⇒ بيشغّله بكامل مستواه بعيد عن السلايدر. بنكتمه (الفيديو بيفضل
  //شغال طبيعي، الصوت بس هو اللي بيتقفل).
  try {
    document.querySelectorAll("video").forEach(el => {
      const stream = el.srcObject;
      if (!stream || typeof stream.getAudioTracks !== "function") return;
      if (!stream.getAudioTracks().some(item => item.id === track.id)) return;
      try { el.muted = true; } catch (_) {}
    });
  } catch (_) {}
  return removed;
}
window.isolateScreenAudioTrack = isolateScreenAudioTrack;

function getScreenAudioElement() {
  let audio = document.getElementById("remote-screen-audio");
  if (!audio) {
    audio = document.createElement("audio");
    audio.id = "remote-screen-audio";
    audio.autoplay = true;
    audio.playsInline = true;
    audio.setAttribute("playsinline", "");
    (document.getElementById("audios") || document.body).appendChild(audio);
  }
  return audio;
}
window.getScreenAudioElement = getScreenAudioElement;

let _screenVolumeWatchdogTimer = null;
function stopScreenVolumeWatchdog() {
  if (_screenVolumeWatchdogTimer) {
    clearInterval(_screenVolumeWatchdogTimer);
    _screenVolumeWatchdogTimer = null;
  }
}

// حارس خلفي: لو عنصر الصوت اتغيّر مصدره أو اتعمله pause أو تراك الشاشة
//رجع يتسرّب لعنصر الميكروفون، بنرجّعه لمكانه ونرجّع مستوى الصوت تاني.
function startScreenVolumeWatchdog(active) {
  if (!active) {
    stopScreenVolumeWatchdog();
    return;
  }
  if (_screenVolumeWatchdogTimer) return;
  _screenVolumeWatchdogTimer = setInterval(() => {
    try {
      if (!window.currentScreenSource) {
        stopScreenVolumeWatchdog();
        return;
      }
      const expected = Number(window._foxyScreenVolume ?? 1);
      const muted = !!(window._foxyScreenAudioMuted ?? false);
      const audio = document.getElementById("remote-screen-audio");
      const call = findScreenAudioCall(window.currentScreenSource);
      const tracks = call?._foxyRemoteScreenAudioStream?.getAudioTracks?.() || [];
      const leaked = tracks.some(track => Array.from(document.querySelectorAll('audio[id^="audio-"]'))
        .some(el => el.srcObject?.getAudioTracks?.().some(item => item.id === track.id)));
      const volumeOff = !!audio && Math.abs(audio.volume - expected) > 0.01;
      const muteOff = !!audio && audio.muted !== (!!window.isDeafened || muted || expected === 0);
      const sourceOff = !!audio && !!call?._foxyRemoteScreenAudioStream
        && audio.srcObject !== call._foxyRemoteScreenAudioStream;
      if (leaked || volumeOff || muteOff || sourceOff) {
        applyScreenAudioVolume(expected, { muted, peerId: window.currentScreenSource });
      }
    } catch (_) {}
  }, 2000);
}

//FIX: نقطة التحكم الواحدة في مستوى صوت مشاركة الشاشة. أي حد يغيّر الصوت
//(السلايدر / قائمة المشارك / الكارت) لازم يمر من هنا عشان العنصر اللي
//بيشغّل الصوت فعلاً يتحدّث معاه.
function applyScreenAudioVolume(level, options = {}) {
  const numeric = Number(level);
  const bounded = Math.max(0, Math.min(1, Number.isFinite(numeric) ? numeric : 1));
  window._foxyScreenVolume = bounded;
  if (bounded > 0) window._foxyScreenLastAudibleVolume = bounded;
  const muted = typeof options.muted === "boolean" ? !!options.muted : bounded === 0;
  window._foxyScreenAudioMuted = muted;
  const peerId = options.peerId || window.currentScreenSource;
  const call = findScreenAudioCall(peerId);
  const stream = call?._foxyRemoteScreenAudioStream || null;
  const tracks = stream?.getAudioTracks?.() || [];
  tracks.forEach(track => isolateScreenAudioTrack(track));
  const audio = getScreenAudioElement();
  const hasLive = tracks.some(track => track.readyState === "live");
  if (hasLive) {
    if (audio.srcObject !== stream) audio.srcObject = stream;
    audio.volume = bounded;
    audio.muted = !!window.isDeafened || muted || bounded === 0;
    if (window.currentAudioOutputDeviceId && audio.setSinkId && audio.sinkId !== window.currentAudioOutputDeviceId) {
      audio.setSinkId(window.currentAudioOutputDeviceId).catch(() => {});
    }
    if (audio.paused) audio.play?.().catch?.(() => audio.setAttribute("data-playback-blocked", "true"));
  } else {
    audio.volume = bounded;
    audio.muted = true;
    if (audio.srcObject) {
      audio.pause();
      audio.srcObject = null;
    }
  }
  const screenVideo = document.getElementById("screen-video");
  if (screenVideo) {
    screenVideo.volume = bounded;
    screenVideo.muted = true;
  }
  startScreenVolumeWatchdog(hasLive);
  return bounded;
}
window.applyScreenAudioVolume = applyScreenAudioVolume;

// تشخيص سريع: حالة صوت مشاركة الشاشة من ناحية كل العناصر (بنستدعيها من
// الكونسول: foxyScreenAudioState())
window.foxyScreenAudioState = function() {
  try {
    const audio = document.getElementById("remote-screen-audio");
    const peerId = window.currentScreenSource;
    const call = findScreenAudioCall(peerId);
    const tracks = call?._foxyRemoteScreenAudioStream?.getAudioTracks?.() || [];
    const leaks = [];
    document.querySelectorAll("audio, video").forEach(el => {
      const hit = el.srcObject?.getAudioTracks?.().some(item => tracks.some(t => t.id === item.id));
      if (hit) leaks.push({ id: el.id || el.className, tag: el.tagName, muted: el.muted, volume: el.volume });
    });
    return {
      currentScreenSource: peerId || null,
      callPeer: call?.peer || null,
      savedVolume: window._foxyScreenVolume ?? null,
      savedMuted: window._foxyScreenAudioMuted ?? null,
      elementFound: !!audio,
      elementVolume: audio?.volume ?? null,
      elementMuted: audio?.muted ?? null,
      elementPaused: audio?.paused ?? null,
      elementHasStream: !!audio?.srcObject,
      trackIds: tracks.map(t => ({ id: t.id, state: t.readyState, muted: t.muted })),
      playingElsewhere: leaks
    };
  } catch (error) {
    return { error: String(error?.message || error) };
  }
};

function syncRemoteScreenAudioPlayback(peerId = window.currentScreenSource) {
  const audio = getScreenAudioElement();

  const call = peerId ? findScreenAudioCall(peerId) : null;
  if (call) moveScreenAudioOutOfMicStream(call);
  const stream = call?._foxyRemoteScreenAudioStream || null;
  const tracks = stream?.getAudioTracks?.() || [];
  tracks.forEach(track => isolateScreenAudioTrack(track));
  const hasLiveTrack = tracks.some(track => track.readyState === "live");
  if (!call || !hasLiveTrack) {
    audio.pause();
    if (audio.srcObject) audio.srcObject = null;
    startScreenVolumeWatchdog(false);
    return false;
  }

  const volume = Math.max(0, Math.min(1, Number(window._foxyScreenVolume ?? 1)));
  audio.volume = volume;
  audio.muted = !!window.isDeafened || (window._foxyScreenAudioMuted ?? false) || volume === 0;
  if (audio.srcObject !== stream) audio.srcObject = stream;
  if (window.currentAudioOutputDeviceId && audio.setSinkId && audio.sinkId !== window.currentAudioOutputDeviceId) {
    audio.setSinkId(window.currentAudioOutputDeviceId).catch(() => {});
  }
  audio.play?.().catch?.(() => audio.setAttribute("data-playback-blocked", "true"));
  startScreenVolumeWatchdog(true);
  return true;
}
window.syncRemoteScreenAudioPlayback = syncRemoteScreenAudioPlayback;
window.setRemoteScreenAudioSettings = function({ muted, volume, peerId } = {}) {
  const numeric = Number(volume);
  const bounded = Number.isFinite(numeric)
    ? Math.max(0, Math.min(1, numeric))
    : Number(window._foxyScreenVolume ?? 1);
  applyScreenAudioVolume(bounded, {
    muted: typeof muted === "boolean" ? muted : undefined,
    peerId: peerId || window.currentScreenSource
  });
  syncRemoteScreenAudioPlayback(peerId || window.currentScreenSource);
  return bounded;
};

const _foxyRemoteTrackListeners = new WeakMap();
function bindRemoteTrackUnmute(call, track, transceiver) {
  if (_foxyRemoteTrackListeners.has(track)) return;
  const listener = () => {
    if (track.kind === "video") {
      //FIX: التراك البعيد بيتحوّل لـ unmuted بس عند وصول أول حزمة RTP، وبنفس
      //اللحظة دي ممكن يفضل muted في الـ IDL attribute. بنسجّل إن البث اشتغل
      //عشان طبقة المشاهدة ماConsiderش البث "مش موجود" وتقفل التحميل بالـ timeout.
      call._foxyScreenTrackUnmuted = true;
      const isScreenExpected = call._foxyRemoteVideoSource === "screen"
        || !!window.connections?.[call.peer]?.screenActive
        || window.currentScreenSource === call.peer
        || window.peerIdToUidMap?.[window.currentScreenSource] === call.peer
        || isWatchedScreenPeer(call);
      const detail = {
        peerId: call.peer,
        uid: window.peerIdToUidMap?.[call.peer] || window.connections?.[call.peer]?.uid || null,
        trackId: track.id,
        trackState: track.readyState,
        source: call._foxyRemoteVideoSource || (isScreenExpected ? "screen-status-pending" : "unknown"),
        mid: transceiver?.mid ?? null,
        connectionState: call.peerConnection?.connectionState || null,
        iceConnectionState: call.peerConnection?.iceConnectionState || null,
        timestamp: new Date().toISOString()
      };
      window.foxyDiagEvent?.(isScreenExpected ? "SCREEN_REMOTE_VIDEO_UNMUTED" : "REMOTE_VIDEO_UNMUTED", "peer=" + call.peer, JSON.stringify(detail));
      if (window.FOXY_SCREEN_DEBUG || window.FOXY_DEBUG || isScreenExpected) {
        window.foxyLog?.("info", "[Foxy][screen-diag] استقبل الطرف الآخر أول إطار فيديو/فك الكتم", detail);
      }
    }
    routeRemoteTrack(call, track, transceiver);
  };
  _foxyRemoteTrackListeners.set(track, listener);
  track.addEventListener?.("unmute", listener, { once: true });
  const cleanups = call._foxyCleanupCallbacks || (call._foxyCleanupCallbacks = []);
  cleanups.push(() => {
    track.removeEventListener?.("unmute", listener);
    if (_foxyRemoteTrackListeners.get(track) === listener) _foxyRemoteTrackListeners.delete(track);
  });
}

//FIX: البث multiplexed على نفس الـ video transceiver بتاع الكاميرا، فلو
//المستخدم بيشاهد شاشة Participant معيّن ⇒ التراك البعيد ده هو الشير
//بالتأكيد. كنا بنتطلبه `_foxyRemoteVideoSource === "screen"` بس — ودي
//بتيجي من رسالة "video-source-status" اللي ممكن تتلخبط/تضيع بعد recall ⇒
//البث بيوصل بس الواجهة مش بتعرضه.
//FIX: الـ PeerJS بيركّب track dummy (canvas أسود 2×2) على الـ transceiver
//المحجوز عشان m=video يتفاوض sendrecv في الاتجاهين (RFC 8829: من غير track
//الـ offer بيطلع recvonly ⇒ الناشر مش بيقدر يبعت الشاشة). الـ dummy ده بيوصل
//للمشاهد كـ track فيديو حيّ 2×2، فلازم نتجاهله لحد ما الشاشة الحقيقية تتركّب.
function isPlaceholderVideoTrack(track) {
  if (!track) return true;
  try {
    if (track._foxyPlaceholder) return true;
    const settings = track.getSettings?.() || {};
    const width = Number(settings.width) || 0;
    const height = Number(settings.height) || 0;
    if (width && height && width <= 4 && height <= 4) return true;
  } catch (_) {}
  return false;
}
window.isPlaceholderVideoTrack = isPlaceholderVideoTrack;

function isWatchedScreenPeer(call) {
  if (!call) return false;
  const peer = call.peer;
  if (!peer) return false;
  const src = window.currentScreenSource;
  if (src && (src === peer
    || window.uidToPeerIdMap?.[src] === peer
    || window.peerIdToUidMap?.[peer] === src
    || window.connections?.[src]?.uid === window.peerIdToUidMap?.[peer])) return true;
  const inline = [...(window._foxyInlineScreenPeers || [])];
  return inline.some(id => id === peer
    || window.uidToPeerIdMap?.[id] === peer
    || window.peerIdToUidMap?.[peer] === id
    || window.connections?.[peer]?.uid === id);
}
window.foxyIsWatchedScreenPeer = isWatchedScreenPeer;

function routeRemoteTrack(call, track, transceiver) {
  if (!call || !track) return;
  if (track.kind === "audio") {
    const screenAudioTransceiver = resolveScreenAudioTransceiver(call, track.id);
    const screenAudioTrack = screenAudioTransceiver?.receiver?.track;
    const alreadyScreenAudio = !!call._foxyRemoteScreenAudioStream?.getAudioTracks?.().some(item => item.id === track.id);
    const isScreenAudio = alreadyScreenAudio || !!((transceiver && screenAudioTransceiver === transceiver) || (screenAudioTrack && screenAudioTrack.id === track.id));
    if (isScreenAudio) {
      call._foxyRemoteScreenAudioStream ||= new MediaStream();
      addTrackOnce(call._foxyRemoteScreenAudioStream, track);
      // The screen audio must never reach the microphone playback element.
      try { call._foxyRemoteAudioStream?.removeTrack?.(track); } catch (_) {}
      isolateScreenAudioTrack(track);
      bindRemoteTrackUnmute(call, track, transceiver);
      const inlineScreenPeer = [...(window._foxyInlineScreenPeers || [])].some(peerId =>
        peerId === call.peer
        || window.uidToPeerIdMap?.[peerId] === call.peer
        || window.peerIdToUidMap?.[call.peer] === peerId
        || window.connections?.[call.peer]?.uid === peerId
      );
      if (window.currentScreenSource === call.peer || window.uidToPeerIdMap?.[window.currentScreenSource] === call.peer || inlineScreenPeer) {
        syncRemoteScreenAudioPlayback(call.peer);
      }
    } else {
      call._foxyRemoteAudioStream ||= new MediaStream();
      addTrackOnce(call._foxyRemoteAudioStream, track);
    }
  } else if (track.kind === "video") {
    call._foxyRemoteVideoStream ||= new MediaStream();
    addTrackOnce(call._foxyRemoteVideoStream, track);
    const uid = window.peerIdToUidMap?.[call.peer] || call.peer;
    const video = document.getElementById(`remote-video-${uid}`) || document.getElementById(`remote-video-${call.peer}`);
    if (video && video.srcObject !== call._foxyRemoteVideoStream) {
      video.srcObject = call._foxyRemoteVideoStream;
      video.play?.().catch?.(() => {});
    }
    //FIX: تشخيص — لازم نعرف إن التراك البعيد وصل للمشاهد فعلاً وإيه حالته
    //وقت وصوله. اللوج ده كان بيختفي لما isScreenExpected كان false.
    window.foxyLog?.("info", "[Foxy][screen-diag] استلام تراك فيديو بعيد", {
      peerId: call.peer,
      uid: window.peerIdToUidMap?.[call.peer] || window.connections?.[call.peer]?.uid || null,
      trackId: track.id,
      trackState: track.readyState,
      muted: track.muted,
      callRegistered: window.calls?.[call.peer] === call,
      remoteVideoSource: call._foxyRemoteVideoSource || null,
      screenActive: !!window.connections?.[call.peer]?.screenActive,
      currentScreenSource: window.currentScreenSource || null,
      inlinePeers: [...(window._foxyInlineScreenPeers || [])],
      timestamp: new Date().toISOString()
    });
    console.info("[Foxy][screen-diag] استلام تراك فيديو بعيد |",
      `peer=${call.peer} track=${track.id.slice(0, 8)} state=${track.readyState} muted=${track.muted} reg=${window.calls?.[call.peer] === call} src=${call._foxyRemoteVideoSource || "-"} active=${!!window.connections?.[call.peer]?.screenActive}`);
    bindRemoteTrackUnmute(call, track, transceiver);
    if ((!track.muted || call._foxyScreenTrackUnmuted)
      && !isPlaceholderVideoTrack(track)
      && (call._foxyRemoteVideoSource === "screen" || isWatchedScreenPeer(call))
      && (window.currentScreenSource === call.peer || window.uidToPeerIdMap?.[window.currentScreenSource] === call.peer)) {
      const screenVideo = document.getElementById("screen-video");
      const screenStream = call.remoteScreenStream || call._foxyRemoteVideoStream;
      if (screenVideo && screenVideo.srcObject !== screenStream) {
        screenVideo.srcObject = screenStream;
        screenVideo.play?.().catch?.(() => {});
        document.getElementById("screen-loading")?.classList.add("hidden");
      }
    }
  }
  const tracks = [
    ...(call._foxyRemoteAudioStream?.getTracks?.() || []),
    ...(call._foxyRemoteVideoStream?.getTracks?.() || [])
  ];
  call.remoteStream = tracks.length ? new MediaStream(tracks) : null;
  call.remoteVideoStream = call._foxyRemoteVideoStream || null;
  const screenTracks = [
    ...(call._foxyRemoteVideoStream?.getTracks?.() || []),
    ...(call._foxyRemoteScreenAudioStream?.getTracks?.() || [])
  ];
  call.remoteScreenStream = screenTracks.length ? new MediaStream(screenTracks) : null;
  if ((call._foxyRemoteVideoSource === "screen" || isWatchedScreenPeer(call))
    && (window.currentScreenSource === call.peer || window.uidToPeerIdMap?.[window.currentScreenSource] === call.peer)) {
    const screenVideo = document.getElementById("screen-video");
    if (screenVideo) screenVideo.muted = true;
    if (screenVideo && call.remoteScreenStream && screenVideo.srcObject !== call.remoteScreenStream) {
      screenVideo.srcObject = call.remoteScreenStream;
      screenVideo.play?.().catch?.(() => {});
    }
    syncRemoteScreenAudioPlayback(call.peer);
  }
  if (track.kind === "video") window.updateParticipantMediaPreview?.(call.peer);
}

//FIX: الـ peerId ممكن يختلف بين الاتصال والرسالة (لما الـ PeerJS id يتغير
//بعد rebuild أو لما يكون فيه أكثر من alias لنفس المستخدم). كنا بنرجع
//مباشرة لو مفيش call بالـ peerId ده ⇒ الواجهة مش بتعرف إن ده شير ⇒
//البطاقة فاضية والبث مش بيظهر.
function resolveCallPeerIdByUid(peerId) {
  if (!peerId) return null;
  if (window.calls?.[peerId]) return peerId;
  const uid = window.peerIdToUidMap?.[peerId] || window.connections?.[peerId]?.uid || null;
  if (!uid) return null;
  const canonical = window.uidToPeerIdMap?.[uid];
  if (canonical && window.calls?.[canonical]) return canonical;
  const found = Object.keys(window.calls || {}).find(id =>
    (window.peerIdToUidMap?.[id] || window.connections?.[id]?.uid) === uid
  );
  return found || null;
}

function setRemoteVideoSourceStatus(peerId, source, enabled, extra = {}) {
  const resolvedPeerId = resolveCallPeerIdByUid(peerId) || peerId;
  const call = window.calls?.[resolvedPeerId];
  //FIX: لو الـ MediaConnection اتعمل من جديد (recall / إعادة اتصال) سجل
  //connections[peerId] بيتصنع من الصفر → screenActive بيضيع. والناشر مش
  //بيبعت "screen-ready" تاني (بيبعته مرة واحدة بس وقت بداية الشير). النتيجة:
  //الواجهة مش عارفة إن ده شير ⇒ updateParticipantMediaPreview بيعتبره كاميرا
  //⇒ بطاقة الشير بتفضل فاضية والبث مش بيظهر. بنعلّم الاتصال إنه شير هنا.
  if (enabled && source === "screen") {
    const connection = window.connections?.[resolvedPeerId] || window.connections?.[peerId];
    if (connection) {
      connection.screenActive = true;
      const screenPeerId = extra.screenPeerId || call?._foxyScreenPeerId || null;
      if (screenPeerId) {
        connection.screenPeerId = screenPeerId;
        if (call) call._foxyScreenPeerId = screenPeerId;
      }
    }
    try { window.updateParticipantScreenStatus?.(resolvedPeerId, true, extra.screenPeerId || call?._foxyScreenPeerId || null); } catch (_) {}
  }
  if (!call) {
    window.updateParticipantMediaPreview?.(resolvedPeerId);
    return;
  }
  call._foxyRemoteVideoSource = enabled ? source : null;
  call._foxyRemoteVideoEnabled = !!enabled;
  if (enabled && call._foxyRemoteVideoStream) {
    call._foxyRemoteVideoStream.getVideoTracks().forEach(track => routeRemoteTrack(call, track));
  }
  if (!enabled && window.currentScreenSource === peerId) {
    const screenVideo = document.getElementById("screen-video");
    if (screenVideo) screenVideo.srcObject = null;
    document.getElementById("screen-loading")?.classList.remove("hidden");
  }
  window.updateParticipantMediaPreview?.(resolvedPeerId);
}
window.setRemoteVideoSourceStatus = setRemoteVideoSourceStatus;
window.resolveCallPeerIdByUid = resolveCallPeerIdByUid;

async function setCallVideoParameters(sender, source) {
  if (!sender?.track || typeof sender.getParameters !== "function" || typeof sender.setParameters !== "function") return;
  try {
    await updateSenderEncodingParameters(sender, (params, includeNetworkPriority, includePriority) => {
      params.degradationPreference = source === "screen" ? "maintain-framerate" : "balanced";
      params.encodings[0].maxFramerate = source === "screen"
        ? Math.min(30, Math.max(5, parseInt(document.getElementById("screen-fps")?.value || "15", 10) || 15))
        : 15;
      params.encodings[0].maxBitrate = source === "screen" ? 3500000 : 200000;
      params.encodings.forEach(encoding => {
        if (includePriority) encoding.priority = "low";
        else delete encoding.priority;
        if (includeNetworkPriority) encoding.networkPriority = "low";
        else delete encoding.networkPriority;
      });
      if (source === "camera") params.encodings[0].scaleResolutionDownBy = 1;
      else delete params.encodings[0].scaleResolutionDownBy;
    });
  } catch (error) {
    window.foxyLog?.("info", "[Foxy][video] تعذر تطبيق سقف الجودة على المرسل", { source, message: error?.message });
  }
}

async function replaceCallVideoTrack(call, track, source = "camera", options = {}) {
  if (!call?.peerConnection || call.peerConnection.signalingState === "closed") throw new Error("MediaConnection is closed");
  const sender = getCallVideoSender(call);
  if (!sender) throw new Error("This peer has no pre-allocated video transceiver");
  if (track && track.kind !== "video") throw new TypeError("The reserved transceiver only accepts video tracks");
  try {
    await sender.replaceTrack(track || null);
  } catch (firstError) {
    if (!track) throw firstError;
    // A lower capture envelope often resolves InvalidModificationError or
    // implementation-specific codec limits without renegotiating the audio PC.
    try {
      await track.applyConstraints({
        width: { max: 1280 },
        height: { max: 720 },
        frameRate: { max: 15 }
      });
    } catch (_) {}
    try {
      await sender.replaceTrack(track);
    } catch (retryError) {
      retryError.cause ||= firstError;
      throw retryError;
    }
  }
  call._foxyVideoSource = track ? source : null;
  sender._foxyVideoSource = track ? source : null;
  //FIX: الـ track dummy (كانvas أسود) كان واقف على الـ sender عشان الـ m-line
  //يتفاوض sendrecv. أول ما التراك الحقيقي يتركب، الـ dummy بيبقى مش لازم ⇒
  //نوقفه (عشان مايرندرش ولا يستهلك CPU) ونفضّ المرجع.
  if (call._foxyDummyVideoTrack && call._foxyDummyVideoTrack !== track && call._foxyDummyVideoTrack !== sender.track) {
    try { call._foxyDummyVideoTrack.stop(); } catch (_) {}
    call._foxyDummyVideoTrack = null;
    call._foxyDummyVideoCanvas = null;
  }
  if (track) await setCallVideoParameters(sender, source);
  //FIX: تشخيص — لازم نعرف: (1) التراك اتركّب فعلاً على الـ sender؟ (2) الـ
  //transceiver اتجاهه صح؟ (3) رسالة "video-source-status" اتبعتت للمشاهد؟
  //لو (3) فشل، المشاهد مش هيعرف إن ده شير ⇒ "جاري تحميل" للأبد.
  const _tx = call.peerConnection?.getTransceivers?.().find(t => t.sender === sender);
  const _diag = {
    peerId: call.peer,
    source,
    requestedTrackId: track?.id || null,
    requestedTrackState: track?.readyState || null,
    senderTrackId: sender.track?.id || null,
    senderTrackState: sender.track?.readyState || null,
    senderTrackMatches: !!track && sender.track?.id === track.id,
    transceiverMid: _tx?.mid ?? null,
    transceiverDirection: _tx?.direction || null,
    transceiverCurrentDirection: _tx?.currentDirection || null,
    pcConnectionState: call.peerConnection?.connectionState || null,
    pcSignalingState: call.peerConnection?.signalingState || null,
    timestamp: new Date().toISOString()
  };
  let _announce = "skipped";
  if (!options.silent) {
    const dataConnection = window.connections?.[call.peer]?.conn;
    const _payload = {
      type: "video-source-status",
      source,
      enabled: !!track,
      screenPeerId: source === "screen" ? (window.myId || window.peer?.id || "") : undefined
    };
    if (dataConnection?.open) {
      try {
        const _ok = dataConnection.send(_payload);
        _announce = _ok ? "sent" : "send-returned-false";
      } catch (err) {
        _announce = "send-threw:" + (err?.message || String(err));
      }
    } else {
      _announce = "data-channel-not-open";
    }
    //FIX: لو القناة مش مفتوحة لسه، الرسالة بتضيع (DataConnection.send بيرمي
    //NotOpenYet). من غير "video-source-status" المشاهد مش هيعرف إن ده شير
    //⇒ بيفضل "جاري تحميل" للأبد. بنعيد المحاولة شوية.
    if (_announce !== "sent") {
      [800, 2000, 4000].forEach(delay => {
        setTimeout(() => {
          try {
            const conn = window.connections?.[call.peer]?.conn;
            if (!conn) return;
            conn.send(_payload);
            window.foxyLog?.("info", "[Foxy][screen-diag] إعادة إعلان مصدر الفيديو", {
              peerId: call.peer, source, delay, timestamp: new Date().toISOString()
            });
          } catch (_) {}
        }, delay);
      });
    }
  }
  window.foxyLog?.(source === "screen" ? "info" : "info", "[Foxy][screen-diag] تم استبدال مسار الفيديو", {
    ..._diag,
    announce: _announce,
    connType: window.connections?.[call.peer]?.conn?.type || null,
    connOpen: !!window.connections?.[call.peer]?.conn?.open
  });
  console.info("[Foxy][screen-diag] تم استبدال مسار الفيديو |",
    `peer=${call.peer} src=${source} track=${track?.id?.slice(0, 8) || "-"} sender=${sender.track?.id?.slice(0, 8) || "-"}/${sender.track?.readyState || "-"} match=${_diag.senderTrackMatches} tx=${_diag.transceiverMid}/${_diag.transceiverDirection}/${_diag.transceiverCurrentDirection} pc=${_diag.pcConnectionState}/${_diag.pcSignalingState} announce=${_announce}`);
  return sender;
}

async function replaceCallScreenAudioTrack(call, track) {
  if (!call?.peerConnection || call.peerConnection.signalingState === "closed") throw new Error("MediaConnection is closed");
  //FIX: الـ sender كان متاح بس لو الطرف ده هو اللي عمل الـ offer. لو كان
  //الـ answerer الـ sender مش موجود ⇒ مسار صوت الشاشة مكانش بيشتغل أصلاً
  //والخطأ كان متسكوت. بنحل الـ transceiver من الـ PC مباشرة.
  const transceiver = call._foxyScreenAudioTransceiver || resolveScreenAudioTransceiver(call);
  if (transceiver) call._foxyScreenAudioTransceiver = transceiver;
  const sender = call._foxyScreenAudioSender || transceiver?.sender;
  if (!sender) throw new Error("This peer has no pre-allocated screen-audio transceiver");
  if (track && track.kind !== "audio") throw new TypeError("The screen-audio transceiver only accepts audio tracks");
  await sender.replaceTrack(track || null);
  sender._foxyScreenAudioActive = !!track;
  if (track) await applyFoxySenderPriority(sender, "high").catch(() => {});
  return sender;
}

window.getCallVideoSender = getCallVideoSender;
window.routeRemoteVideoTrack = routeRemoteTrack;
window.replaceCallVideoTrack = replaceCallVideoTrack;
window.replaceCallScreenAudioTrack = replaceCallScreenAudioTrack;

const _foxySenderParameterQueues = new WeakMap();
function updateSenderEncodingParameters(sender, update) {
  if (!sender || typeof sender.getParameters !== "function" || typeof sender.setParameters !== "function") return Promise.resolve(false);
  const previous = _foxySenderParameterQueues.get(sender) || Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    const apply = async (includeNetworkPriority, includePriority) => {
      const params = sender.getParameters();
      if (!params.encodings || !params.encodings.length) params.encodings = [{}];
      update(params, includeNetworkPriority, includePriority);
      await sender.setParameters(params);
    };
    try {
      await apply(true, true);
    } catch (firstError) {
      try {
        await apply(false, true);
      } catch (_) {
        try {
          await apply(false, false);
        } catch (_) {
          throw firstError;
        }
      }
    }
    return true;
  });
  _foxySenderParameterQueues.set(sender, task);
  task.then(() => {
    if (_foxySenderParameterQueues.get(sender) === task) _foxySenderParameterQueues.delete(sender);
  }, () => {
    if (_foxySenderParameterQueues.get(sender) === task) _foxySenderParameterQueues.delete(sender);
  });
  return task;
}

function applyFoxySenderPriority(sender, priority) {
  return updateSenderEncodingParameters(sender, (params, includeNetworkPriority, includePriority) => {
    params.encodings.forEach(encoding => {
      if (includePriority) encoding.priority = priority;
      else delete encoding.priority;
      if (includeNetworkPriority) encoding.networkPriority = priority;
      else delete encoding.networkPriority;
    });
  });
}

window.updateSenderEncodingParameters = updateSenderEncodingParameters;
window.applyFoxySenderPriority = applyFoxySenderPriority;

function recallAllowedNow(peerId) {
  if (!peerId) return false;
  const s = _recallSlot(peerId);
  const now = Date.now();
  if (now < s.nextAt) return false;
  if (s.attempt >= RECALL_MAX_ATTEMPTS) {
    if (s.attempt === RECALL_MAX_ATTEMPTS) {
      s.attempt++;
      window.foxyLog("warn", "[Foxy][recall] وصلنا للحد الأقصى لمحاولات الاستعادة — نوقف تجديد هذا الاتصال مؤقتاً (لن نحرق المعالج)", {
        peerId, name: connections?.[peerId]?.name || null, timestamp: new Date().toISOString()
      });
    }

    s.nextAt = now + 180000;
    s.attempt = 0;
    return false;
  }
  s.nextAt = now + RECALL_COOLDOWN_MS;
  s.attempt++;
  return true;
}

function applyCallMediaPriorities(call) {
  if (!call?.peerConnection) return;
  call.peerConnection.getSenders().forEach(sender => {
    if (!sender.track) return;
    const priority = sender.track.kind === "audio" ? "high" : "low";
    applyFoxySenderPriority(sender, priority).catch(() => {});
  });
}

function addCallPeerConnectionListener(call, eventName, listener, options) {
  if (typeof window.foxyAddPeerConnectionListener === "function") {
    return window.foxyAddPeerConnectionListener(call, eventName, listener, options);
  }
  const pc = call?.peerConnection;
  if (!pc?.addEventListener) return false;
  pc.addEventListener(eventName, listener, options);
  const disposers = call._foxyPcListenerDisposers || (call._foxyPcListenerDisposers = []);
  disposers.push(() => pc.removeEventListener(eventName, listener, options));
  return true;
}

function handleCall(e) {
  if (!e || !e.peer) {
    window.foxyLog("error", "[Foxy][webrtc] تم تجاهل مكالمة صوتية غير صالحة بعد انقطاع PeerJS", {
      hasCall: !!e,
      peerId: e?.peer || null,
      peerServerOpen: !!window.peer?.open,
      peerDisconnected: !!window.peer?.disconnected,
      timestamp: new Date().toISOString()
    });
    return null
  }
  window.calls = window.calls || {};

  const _prevCall = window.calls[e.peer];
  if (_prevCall && _prevCall !== e) {
    try { _prevCall._foxySuperseded = true; } catch (_) {}
    try { cleanupPeerResources(e.peer); } catch (_) {}
    try {
      window._foxySupersededCount = (window._foxySupersededCount || 0) + 1;
      const replacementDetail = {
        peerId: e.peer,
        uid: window.peerIdToUidMap?.[e.peer] || window.connections?.[e.peer]?.uid || null,
        total: window._foxySupersededCount,
        oldPc: _prevCall.peerConnection ? {
          signaling: _prevCall.peerConnection.signalingState,
          connection: _prevCall.peerConnection.connectionState,
          ice: _prevCall.peerConnection.iceConnectionState
        } : null,
        newPc: e.peerConnection ? {
          signaling: e.peerConnection.signalingState,
          connection: e.peerConnection.connectionState,
          ice: e.peerConnection.iceConnectionState
        } : null,
        screenActive: !!window.connections?.[e.peer]?.screenActive,
        screenViewSourceMatch: window.currentScreenSource === e.peer || window.peerIdToUidMap?.[window.currentScreenSource] === e.peer,
        timestamp: new Date().toISOString()
      };
      window.foxyLog && window.foxyLog("warn", "[Foxy][screen-diag] استبدال MediaConnection لنفس Peer", replacementDetail);
      window.foxyDiagEvent?.("MEDIA_CALL_REPLACED", "peer=" + e.peer, JSON.stringify(replacementDetail));
    } catch (_) {}
  }
  window.calls[e.peer] = e, updateMediaLed(e.peer, "checking");
  //FIX: تشخيص — نطبع ترتيب الـ m-lines (transceivers) لكل اتصال. لو،
  //الـ offerer والـ answerer عندهم ترتيب مختلف، الفيديو مش هيمشي في اتجاه
  //واحد بس (والمشاهد هو الـ answerer دايماً لما يكون آخر واحد داخل).
  try {
    const _tx = (e.peerConnection?.getTransceivers?.() || []).map(t => ({
      mid: t.mid ?? null,
      kind: t.receiver?.track?.kind || t.sender?.track?.kind || null,
      direction: t.direction || null,
      currentDirection: t.currentDirection || null,
      senderTrack: t.sender?.track ? `${t.sender.track.kind}:${t.sender.track.readyState}:${t.sender.track.enabled ? "on" : "off"}` : null,
      receiverTrack: t.receiver?.track ? `${t.receiver.track.kind}:${t.receiver.track.readyState}:${t.receiver.track.muted ? "muted" : "live"}` : null
    }));
    window.foxyLog?.("info", "[Foxy][screen-diag] ترتيب مسارات الاتصال", {
      peerId: e.peer,
      uid: window.peerIdToUidMap?.[e.peer] || window.connections?.[e.peer]?.uid || null,
      isOutgoing: !!e._foxyOutgoing,
      hasLocalStream: !!localStream,
      localStreamTracks: (localStream?.getTracks?.() || []).map(t => `${t.kind}:${t.readyState}:${t.enabled ? "on" : "off"}`),
      transceivers: _tx,
      dataChannelLabel: e.dataChannel?.label || null,
      dataChannelState: e.dataChannel?.readyState || null,
      timestamp: new Date().toISOString()
    });
    console.info("[Foxy][screen-diag] ترتيب مسارات الاتصال |",
      `peer=${e.peer} local=[${(localStream?.getTracks?.() || []).map(t => t.kind + ":" + t.readyState + ":" + (t.enabled ? "on" : "off")).join(",")}] tx=[${_tx.map(t => `${t.mid}/${t.kind}/${t.direction}/${t.currentDirection}/${t.senderTrack || "-"}`).join(" | ")}] dc=${e.dataChannel?.label || "-"}/${e.dataChannel?.readyState || "-"}`);
  } catch (_) {}
  // FIX: الاستبدال كان بيمسح تراك الشير المرفق على الـ call القديمة،
  // فالمشاهد يفضل على "جاري التحميل" والناشر يفضل يعمل attach من جديد في loop.
  // ننقل حالة الشير للـ call الجديدة ونعيد الإرفاق مرة واحدة بعد استقرار الـ PC.
  try {
    const prevWasScreenSender = _prevCall && _prevCall._foxyVideoSource === "screen";
    const prevWasScreenViewer = _prevCall && (_prevCall._foxyRemoteVideoSource === "screen" || _prevCall._foxyScreenDiagReceivedTrackId);
    const amPublisher = !!(window.isScreenSharing && (window.screenViewers?.has?.(e.peer) || prevWasScreenSender));
    const amViewer = window.currentScreenSource === e.peer
      || window.peerIdToUidMap?.[window.currentScreenSource] === e.peer
      || !!window._foxyInlineScreenPeers?.has?.(e.peer)
      || prevWasScreenViewer;
    if (prevWasScreenViewer && !e._foxyRemoteVideoSource) e._foxyRemoteVideoSource = "screen";
    if (amPublisher) {
      window.screenViewers?.add?.(e.peer);
      //FIX: المشاهد لو عمل recall أو اتفصل ورجع، سجل connections[peerId]
      //بيتصنع من الصفر وبيفقد screenActive. الناشر كان بيبعت "screen-ready"
      //مرة واحدة بس وقت بداية الشير ⇒ المشاهد الجديد مبيعرفش إن ده شير
      //⇒ بطاقة الشير بتفضل فاضية. بنعيد الإعلان للزبون الجديد.
      try {
        window.sendSignalingCmd?.(e.peer, {
          type: "screen-ready",
          name: "function" == typeof window.__foxySelfDisplayName ? window.__foxySelfDisplayName() : window.myName,
          screenPeerId: window.currentScreenPeerId,
          transport: "existing-media-call",
          screenQuality: window.getLocalScreenSourceQuality?.()
        });
      } catch (_) {}
      const retryKey = "__foxyScreenReattach_" + e.peer;
      if (!window[retryKey]) {
        window[retryKey] = true;
        setTimeout(async () => {
          window[retryKey] = false;
          try {
            const cur = window.calls?.[e.peer];
            if (cur !== e || !window.isScreenSharing) return;
            if (cur._foxyVideoSource === "screen" && cur._foxyVideoSender?.track?.readyState === "live") return;
            const track = window.__foxyScreenShareState?.getStream?.()?.getVideoTracks?.()[0]
              || window.localScreenStream?.getVideoTracks?.()[0];
            if (!track || track.readyState !== "live") return;
            if (cur._foxyScreenAttachPromise) return;
            await window.replaceCallVideoTrack?.(cur, track, "screen");
            const st = window.localScreenStream?.getAudioTracks?.()[0] || null;
            await window.replaceCallScreenAudioTrack?.(cur, st).catch(() => {});
            window.setupAdaptiveBitrate?.(cur);
          } catch (_) {}
        }, 1200);
      }
    } else if (amViewer && e._foxyScreenDiagReceivedTrackId) {
      // المشاهد كان مستقبل تراك قبل الاستبدال — نطلب join واحد فقط بدل storm
      try { delete e._foxyScreenJoinRequestedAt; } catch (_) {}
    }
  } catch (_) {}
  const screenContext = !!window.connections?.[e.peer]?.screenActive
    || window.currentScreenSource === e.peer
    || window.peerIdToUidMap?.[window.currentScreenSource] === e.peer;
  if (screenContext || window.FOXY_SCREEN_DEBUG || window.FOXY_DEBUG) {
    const registeredDetail = {
      peerId: e.peer,
      uid: window.peerIdToUidMap?.[e.peer] || window.connections?.[e.peer]?.uid || null,
      hasPreviousCall: !!_prevCall,
      pc: e.peerConnection ? {
        signaling: e.peerConnection.signalingState,
        connection: e.peerConnection.connectionState,
        ice: e.peerConnection.iceConnectionState
      } : null,
      timestamp: new Date().toISOString()
    };
    window.foxyLog?.("info", "[Foxy][screen-diag] تسجيل MediaConnection للمشارك", registeredDetail);
    window.foxyDiagEvent?.("MEDIA_CALL_REGISTERED", "peer=" + e.peer, JSON.stringify(registeredDetail));
  }
  applyCallMediaPriorities(e);
  addCallPeerConnectionListener(e, "track", event => {
    if (event.track?.kind === "video") {
      const isScreenExpected = e._foxyRemoteVideoSource === "screen"
        || !!window.connections?.[e.peer]?.screenActive
        || window.currentScreenSource === e.peer
        || window.peerIdToUidMap?.[window.currentScreenSource] === e.peer
        || isWatchedScreenPeer(e);
      const detail = {
        peerId: e.peer,
        uid: window.peerIdToUidMap?.[e.peer] || window.connections?.[e.peer]?.uid || null,
        trackId: event.track.id,
        trackState: event.track.readyState,
        muted: event.track.muted,
        mid: event.transceiver?.mid ?? null,
        direction: event.transceiver?.currentDirection || event.transceiver?.direction || null,
        connectionState: e.peerConnection?.connectionState || null,
        iceConnectionState: e.peerConnection?.iceConnectionState || null,
        screenExpected: isScreenExpected,
        timestamp: new Date().toISOString()
      };
      window.foxyDiagEvent?.(isScreenExpected ? "SCREEN_REMOTE_VIDEO_TRACK" : "REMOTE_VIDEO_TRACK", "peer=" + e.peer, JSON.stringify(detail));
      if (isScreenExpected || window.FOXY_SCREEN_DEBUG || window.FOXY_DEBUG) {
        window.foxyLog?.("info", "[Foxy][screen-diag] وصل حدث مسار فيديو عبر مكالمة الصوت", detail);
      }
    }
    routeRemoteTrack(e, event.track, event.transceiver);
  });
  if (window.isCameraEnabled && !window.isScreenSharing && window.ensureCameraCapture && window.replaceCallVideoTrack) {
    window.ensureCameraCapture().then(track => track && window.replaceCallVideoTrack(e, track, "camera")).catch(error => {
      window.foxyLog?.("warn", "[Foxy][video] تعذر توصيل الكاميرا بالمكالمة الجديدة", { peerId: e.peer, message: error?.message });
    });
  }
  const t = setTimeout(() => {
    document.getElementById("audio-" + e.peer)?.srcObject || updateMediaLed(e.peer, "failed")
  }, 12e3);
  const callCleanups = e._foxyCleanupCallbacks || (e._foxyCleanupCallbacks = []);
  callCleanups.push(() => clearTimeout(t));
  callCleanups.push(() => {
    e._foxyRemoteAudioStream = null;
    e._foxyRemoteVideoStream = null;
    e._foxyRemoteScreenAudioStream = null;
    e.remoteScreenStream = null;
  });
  addCallPeerConnectionListener(e, "connectionstatechange", () => {
    const t = e.peerConnection.connectionState;
    updateMediaLed(e.peer, t),     "connected" === t && (updateCallBitrate(e), e.localFailureCount = 0, delete reCallTimers[e.peer], "function" == typeof _clearRecallSlot && _clearRecallSlot(e.peer), "function" == typeof window.updateDmCallOverlayStatus && window.updateDmCallOverlayStatus("active")), "failed" === t && handleConnectionFailure(e.peer)

  }), e.on("close", () => {
    clearTimeout(t);
    const isScreenContext = !!window.connections?.[e.peer]?.screenActive
      || window.currentScreenSource === e.peer
      || window.peerIdToUidMap?.[window.currentScreenSource] === e.peer;
    if (isScreenContext || window.FOXY_SCREEN_DEBUG || window.FOXY_DEBUG) {
      const closeDetail = {
        peerId: e.peer,
        uid: window.peerIdToUidMap?.[e.peer] || window.connections?.[e.peer]?.uid || null,
        superseded: !!e._foxySuperseded,
        signaling: e.peerConnection?.signalingState || null,
        connection: e.peerConnection?.connectionState || null,
        ice: e.peerConnection?.iceConnectionState || null,
        timestamp: new Date().toISOString()
      };
      window.foxyLog?.("warn", "[Foxy][screen-diag] إغلاق MediaConnection", closeDetail);
      window.foxyDiagEvent?.("MEDIA_CALL_CLOSED", "peer=" + e.peer, JSON.stringify(closeDetail));
    }
    window.foxyCleanupConnectionResources?.(e);
  }), addCallPeerConnectionListener(e, "iceconnectionstatechange", () => {
    const t = e.peerConnection.iceConnectionState;
    if ("disconnected" === t || "failed" === t ? updateMediaLed(e.peer, "signal_lost") : "connected" !== t && "completed" !== t || updateMediaLed(e.peer, "connected"), "disconnected" === t) {

      reCallTimers[e.peer] || (reCallTimers[e.peer] = setTimeout(() => {
        if (delete reCallTimers[e.peer], !e || !e.peerConnection || e._foxySuperseded) return;
        const n = e.peerConnection.iceConnectionState;
        "disconnected" !== n && "failed" !== n || calls[e.peer] && !calls[e.peer]._foxySuperseded && reCallPeer(e.peer, "ice-" + n + "-sustained-6s")
      }, 6e3))
    } else if ("failed" === t) {

      reCallTimers[e.peer] || (reCallTimers[e.peer] = setTimeout(() => {
        if (delete reCallTimers[e.peer], !e || !e.peerConnection || e._foxySuperseded) return;
        const n = e.peerConnection.iceConnectionState;
        "failed" !== n && "disconnected" !== n || calls[e.peer] && !calls[e.peer]._foxySuperseded && reCallPeer(e.peer, "ice-" + n)
      }, 1500))
    }
    "connected" !== t && "completed" !== t && "closed" !== t || (clearTimeout(reCallTimers[e.peer]), delete reCallTimers[e.peer])
  }), addCallPeerConnectionListener(e, "icecandidate", e => {
    e.candidate && e.candidate.candidate.includes("relay") && "function" == typeof detectActiveTurnServer && detectActiveTurnServer(e.candidate.candidate)
  }), e.on("stream", n => {
    n.getTracks().forEach(track => routeRemoteTrack(e, track));
    const screenAudioIds = new Set([
      e._foxyScreenAudioTransceiver?.receiver?.track?.id,
      resolveScreenAudioTransceiver(e)?.receiver?.track?.id,
      ...(e._foxyRemoteScreenAudioStream?.getAudioTracks?.().map(track => track.id) || [])
    ].filter(Boolean));
    const microphoneTracks = n.getAudioTracks().filter(track => !screenAudioIds.has(track.id));
    moveScreenAudioOutOfMicStream(e);
    //FIX: لو تراك الشاشة وصل لعنصر الميكروفون، الصوت بيفضل شغال بكامل
    //مستواه والسلايدر مبيأثرش. بنفصله من أي عنصر تاني غير عنصر الصوت
    //الخاص بالشاشة.
    (e._foxyRemoteScreenAudioStream?.getAudioTracks?.() || []).forEach(track => isolateScreenAudioTrack(track));
    if (!microphoneTracks.length) return;
    e._foxyRemoteAudioStream ||= new MediaStream();
    microphoneTracks.forEach(track => addTrackOnce(e._foxyRemoteAudioStream, track));
    n = e._foxyRemoteAudioStream;
    clearTimeout(t), updateMediaLed(e.peer, "connected"), e.remoteStream = new MediaStream([
      ...n.getTracks(),
      ...(e._foxyRemoteVideoStream?.getTracks?.() || [])
    ]);
    const o = vizStates.get(e.peer);
    if (o) {
      o.running = !1;
      try {
        o.source.disconnect()
      } catch (e) {}
      try { o.analyzer && o.analyzer.disconnect() } catch (e) {}
      vizStates.delete(e.peer)
    }
    let i = document.getElementById("audio-" + e.peer);
    if (i || (i = document.createElement("audio"), i.id = "audio-" + e.peer, i.autoplay = !0, i.muted = !!window.isDeafened, i.playsinline = !0, i.setAttribute("playsinline", ""), document.getElementById("audios").appendChild(i), window.currentAudioOutputDeviceId && i.setSinkId && i.setSinkId(window.currentAudioOutputDeviceId).catch(e => {})), peerGainNodes.has(e.peer)) {
      const t = document.getElementById("audio-" + e.peer);
      if (t) {
        const e = t._customMuted || !1;
        try {
          delete t.muted
        } catch (e) {}
        t.muted = e, delete t._customMuted
      }
      const n = peerGainNodes.get(e.peer);
      try {
        n.gainNode.disconnect(), n.clonedStream.getTracks().forEach(e => e.stop())
      } catch (e) {}
      peerGainNodes.delete(e.peer)
    }
    i.srcObject = n, window._volumeStore = window._volumeStore || {};
    const a = void 0 !== window._volumeStore[e.peer] ? window._volumeStore[e.peer] : connections[e.peer] && void 0 !== connections[e.peer].volumeRatio ? connections[e.peer].volumeRatio : 1;
    "function" == typeof window.adjustPeerVolume && window.adjustPeerVolume(e.peer, a), i.play().then(() => {
      i.removeAttribute("data-playback-blocked")
    }).catch(() => {

      i.setAttribute("data-playback-blocked", "true")
    });

    try {
      if (window.masterAudioMixer && window.masterAudioMixer.isEnabled()) {
        window.masterAudioMixer.retargetPeer(e.peer, n), window.masterAudioMixer.attachPeer(e.peer, n);
      }
    } catch (_) {}
    const c = window.peerIdToUidMap && window.peerIdToUidMap[e.peer] || e.peer,
      d = document.getElementById("remote-video-" + c) || document.getElementById("remote-video-" + e.peer);
    d && e._foxyRemoteVideoStream && (d.srcObject = e._foxyRemoteVideoStream, d.play().catch(e => {})), visualize(n.clone(), e.peer)
  })
}

function handleConnectionFailure(e) {
  const t = calls[e];
  if (!t) return;
  t.localFailureCount = (t.localFailureCount || 0) + 1;
  window.foxyLog("warn", "[Foxy][recall] فشل حالة اتصال مكالمة صوتية", {peerId:e, failureCount:t.localFailureCount, iceState:t.peerConnection?.iceConnectionState, connState:t.peerConnection?.connectionState, timestamp:new Date().toISOString()});
  if (typeof window.updateMediaLed === "function") window.updateMediaLed(e, "signal_lost");

  function _presenceFreshForCall(pid) {
    try {
      const uid = (window.connections && window.connections[pid] && window.connections[pid].uid) || (window.peerIdToUidMap && window.peerIdToUidMap[pid]) || null;
      if (!uid) return false;
      const entry = (window.state && window.state.activeChannelPresenceMap && window.state.activeChannelPresenceMap[uid]) || null;

      return !!(entry && entry.connected && (Date.now() - (entry.heartbeatAt || 0) < 90000));
    } catch (_) { return false; }
  }
  if (t.localFailureCount <= 4) {
    setTimeout(() => {
      if (calls[e] && typeof reCallPeer === "function") reCallPeer(e, "connection-failed#" + t.localFailureCount);
    }, 4e3);
  } else if (t.localFailureCount <= 7) {
    if (t.localFailureCount === 5 && typeof window.markP2pFailure === "function") window.markP2pFailure();
    setTimeout(() => {
      if (calls[e] && typeof reCallPeer === "function") reCallPeer(e, "connection-failed#" + t.localFailureCount);
    }, 8e3);
  } else {
    const dataOpen = !!(window.connections && window.connections[e] && window.connections[e].conn && window.connections[e].conn.open);
    if (dataOpen || _presenceFreshForCall(e)) {
      window.foxyLog("info", "[Foxy][recall] الطرف لسه موجود (حضور/قناة) — استمرار المحاولة بدل الإسقاط", {peerId:e, failureCount:t.localFailureCount, timestamp:new Date().toISOString()});
      t.localFailureCount = 5;
      setTimeout(() => {
        if (calls[e] && typeof reCallPeer === "function") reCallPeer(e, "connection-failed-persist#" + t.localFailureCount);
      }, 8e3);
      return;
    }
    handleExit(e);
    if (typeof window.markP2pFailure === "function") window.markP2pFailure();
  }
}

function reCallPeer(e, t = "unspecified", o = {}) {

  if ("undefined" != typeof navigator && navigator.onLine === false) {
    window.foxyLog("info", "[Foxy][recall] تخطي recall — الجهاز أوفلاين", { peerId: e, reason: t });
    return;
  }

  //FIX: مشاركة الشاشة multiplexed على نفس MediaConnection الخاص بالصوت، فالمشاهد
  //مش محتاج ميكروفون — محتاج اتصال وارد بس. قبل كده recall كان بيتوقف هنا
  //لأن الميكروفون مش متاح (وضع استماع فقط / الميك مشغول على نفس الجهاز /
  //الميك اتقطع) ⇒ استرجاع اتصال المشاهدة مستحيل ⇒ "الشير مش بيفتح".
  const _localUsable = !!localStream && !!localStream.active
    && localStream.getTracks().some(tr => tr.readyState === "live");
  let _callStream = localStream;
  if (!_localUsable) {
    const _receiveOnly = o.allowReceiveOnly ? window.getReceiveOnlyStream?.() : null;
    if (!_receiveOnly) {
      window.foxyLog("warn", "[Foxy][recall] تخطي recall — لا يوجد localStream نشط (لن نطلب ميك/كاميرا جديد)", { peerId: e, reason: t });
      reCallInProgress.delete(e);
      return;
    }
    _callStream = _receiveOnly;
    window.foxyLog?.("info", "[Foxy][recall] استعادة اتصال استقبال فقط (لا يوجد ميكروفون نشط)", {
      peerId: e,
      reason: t,
      timestamp: new Date().toISOString()
    });
  }
  const liveTracks = _callStream.getTracks().filter(tr => tr.readyState === "live");
  if (!liveTracks.length) {
    window.foxyLog("warn", "[Foxy][recall] تخطي recall — كل التراكات ended", { peerId: e, reason: t });
    reCallInProgress.delete(e);
    return;
  }

  try {
    const _cur = calls[e] && calls[e].peerConnection;
    const _cs = _cur && _cur.connectionState;
    const _is = _cur && _cur.iceConnectionState;
    if (("connecting" === _cs || "new" === _cs || "checking" === _is) &&
        /network-type-flap|network-change-unhealthy|gentle-recovery/i.test(t || "")) {
      reCallInProgress.delete(e);
      return;
    }
  } catch (_) {}

  if (!recallAllowedNow(e)) {
    _foxySay("RECALL_BLOCKED", "peer=" + _dshort(e, 20), "الاستعادة اتمنعت بسبب cooldown/backoff (السبب: " + t + ") — المحاولات المتبقية محدودة");
    reCallInProgress.delete(e);
    return;
  }
  const _slot = _recallSlot(e);

  const _backoff = _slot.attempt <= 1 ? 0 : RECALL_BACKOFF_MS[Math.min(_slot.attempt, RECALL_BACKOFF_MS.length - 1)];

  const _run = () => {
    if (!reCallInProgress.has(e)) {
      try { window._lastRecallAt = window._lastRecallAt || {}; window._lastRecallAt[e] = Date.now(); } catch (_) {}
      window.FOXY_DEBUG ? window.foxyLog("warn", "[Foxy][recall] إعادة مزامنة مكالمة صوتية", {peerId:e, reason:t, attempt:_slot.attempt, name:connections[e]?.name||null, peerOpen:!!(window.peer?.open && !window.peer.disconnected && !window.peer.destroyed), stack:(new Error().stack||"").split("\n").slice(2,7).map(s=>s.trim()).join(" <- "), timestamp:new Date().toISOString()}) : window.foxyLog("warn", "[Foxy][recall] إعادة مزامنة مكالمة صوتية", {peerId:e, reason:t, attempt:_slot.attempt, name:connections[e]?.name||null, timestamp:new Date().toISOString()});
      reCallInProgress.add(e), "undefined" != typeof iceRestartAttempts ? delete iceRestartAttempts[e] : window.iceRestartAttempts && delete window.iceRestartAttempts[e], addSystemMsg(_callStream === localStream ? window.__f("js.resync", {name: connections[e]?.name||e}, `🔄 إعادة مزامنة الصوت مع ${connections[e]?.name||e}...`) : window.__f("js.resync_receive_only", {name: connections[e]?.name||e}, `🔄 جاري استعادة اتصال الاستقبال مع ${connections[e]?.name||e}...`));
      const oldCall = calls[e];
      if (oldCall) {
        // A recall intentionally replaces this MediaConnection. Mark it first
        // so setupDataConn's close handler won't run handleExit() and trigger a
        // second, presence-driven peer.call() while this recall is dialing.
        oldCall._foxySuperseded = true;
        oldCall._foxyCloseReason = "recall-replacement:" + t;
        try { oldCall.close(); } catch (_) {}
        if (calls[e] === oldCall) delete calls[e];
      }

      if (_slot.timer) { clearTimeout(_slot.timer); _slot.timer = null; }
      try {
        const n = peer.call(e, _callStream, { reliable: true, metadata: { foxyMux: true } });
        n ? (addCallPeerConnectionListener(n, "connectionstatechange", () => {
          "connected" === n.peerConnection.connectionState && (reCallInProgress.delete(e), _clearRecallSlot(e))
        }, {
          once: !0
        }), handleCall(n), "function" == typeof window.setupDataConn && window.setupDataConn(n, true)) : (window.foxyLog("error", "[Foxy][recall] peer.call رجع null (الإشارة غير جاهزة)", {peerId:e, reason:t}), reCallInProgress.delete(e))
      } catch (n) {
        window.foxyLog("error", "[Foxy][recall] فشل إنشاء المكالمة أثناء إعادة المزامنة", {peerId:e, reason:t, error:n?.message||String(n)}), reCallInProgress.delete(e)
      }
      setTimeout(() => reCallInProgress.delete(e), 1e4)
    }
  };

  if (_backoff > 0) {

    if (_slot.timer) clearTimeout(_slot.timer);
    _slot.timer = setTimeout(() => {
      _slot.timer = null;
      if (!calls[e] && !(window.connections && window.connections[e] && window.connections[e].conn && window.connections[e].conn.open)) {
        window.foxyLog("info", "[Foxy][recall] أُلغي الـ Recall المؤجّل — الاتصال عاد من الطرف الآخر", { peerId: e, reason: t });
        _clearRecallSlot(e);
        return;
      }
      _run();
    }, _backoff + Math.round(Math.random() * 700));
  } else {
    _run();
  }
}

function cleanupPeerResources(e) {

  try {
    if (window.masterAudioMixer && window.masterAudioMixer.isEnabled()) window.masterAudioMixer.detachPeer(e);
  } catch (_) {}
  const t = vizStates.get(e);
  if (t) {
    t.running = !1;
    if (t._holdTimer) { clearTimeout(t._holdTimer); t._holdTimer = null; }

    try { t.source && t.source.disconnect() } catch (e) {}
    try { t.analyzer && t.analyzer.disconnect() } catch (e) {}
    vizStates.delete(e)
  }
  if (peerGainNodes.has(e)) {
    const t = peerGainNodes.get(e);
    try { t.gainNode.disconnect(), t.clonedStream.getTracks().forEach(e => e.stop()) } catch (e) {}
    peerGainNodes.delete(e)
  }
  const n = document.getElementById("audio-" + e);
  if (n) {
    if (Object.prototype.hasOwnProperty.call(n, "_customMuted") || void 0 !== n._customMuted) {
      const e = n.muted;
      delete n.muted, n.muted = e, delete n._customMuted
    }

    try { n.pause() } catch (e) {}
    try { n.srcObject = null } catch (e) {}
    try { n.remove() } catch (e) {}
  }
  if (calls[e]) {
    try {
      calls[e].close()
    } catch (e) {}
    delete calls[e]
  }
  callQualityHistory.delete(e)

  if (typeof _clearRecallSlot === "function") _clearRecallSlot(e);
  if (reCallTimers[e]) { clearTimeout(reCallTimers[e]); delete reCallTimers[e]; }
  try { delete iceRestartAttempts[e] } catch (_) {}

  try {
    window.peerRttMap && delete window.peerRttMap[e];
    window.peerRttTs && delete window.peerRttTs[e];
    window._lastRecallAt && delete window._lastRecallAt[e];
    window._volumeStore && delete window._volumeStore[e];
    window._ghostSuspectAt && delete window._ghostSuspectAt[e];
  } catch (_) {}

  try {
    if (window.spatialAudio && typeof window.spatialAudio.disconnectPeer === "function") {
      window.spatialAudio.disconnectPeer(e);
    }
  } catch (_) {}
}

function handleExit(e) {
  const t = connections[e] && connections[e].uid || window.peerIdToUidMap && window.peerIdToUidMap[e];
  window.foxyLog("warn", "[Foxy][webrtc] بدء تنظيف اتصال مشارك", {
    peerId:e,
    uid:t,
    name:connections[e]?.name || null,
    connectionState:connections[e]?.conn?.peerConnection?.connectionState || "unknown",
    dataOpen:!!connections[e]?.conn?.open,
    timestamp:new Date().toISOString()
  });
  const replacement = t && Object.entries(connections || {}).find(([n, r]) => n !== e && r?.uid === t && r.conn?.open),
    presenceReplacement = t && Object.entries(window.state?.activeChannelPresenceMap || {}).find(([n, r]) => n === t && r?.connected && r.peerId && r.peerId !== e);
  if (replacement || presenceReplacement) {
    window.FOXY_DEBUG && window.foxyLog("info", "[Foxy][webrtc] تجاهل تنظيف اتصال قديم لأن هناك اتصالًا بديلًا", {
      oldPeerId:e,
      uid:t,
      replacementPeerId:replacement?.[0] || presenceReplacement?.[1]?.peerId || null,
      timestamp:new Date().toISOString()
    });
    if (connections[e]) {
      cleanupPeerResources(e);
      delete connections[e];
      updateRoomCount(Object.keys(connections).length)
    }
    return
  }
  if (!connections[e]) {
    window.FOXY_DEBUG && window.foxyLog("info", "[Foxy][webrtc] تجاهل إغلاق مكرر لاتصال تم تنظيفه بالفعل", {peerId:e, uid:t, timestamp:new Date().toISOString()});
    return
  }
  const n = connections[e].name || e;
  if (cleanupPeerResources(e), document.getElementById("audio-" + e)?.remove(), e === currentHostId) {

    if ("function" == typeof window.adoptHostRole) {
      const remaining = [...Object.keys(connections), myId].filter(x => x !== e).sort();
      remaining.length && window.adoptHostRole(remaining[0], "host-left");
    } else {
      const e2 = [...Object.keys(connections), myId].sort();
      currentHostId = e2[0], window.currentHostId = currentHostId, currentHostId === myId && (isGuest = !1, addSystemMsg(window.__fb("js.new_host", "أنت الآن المضيف الجديد للغرفة"))), updateHostUI(currentHostId, myId, connections)
    }
  }
  delete connections[e], updateRoomCount(Object.keys(connections).length);
  const exitUid = t || e;
  window._participantExitTimers = window._participantExitTimers || {};
  clearTimeout(window._participantExitTimers[exitUid]);
  window._participantExitTimers[exitUid] = setTimeout(() => {
    const _presenceEntry = window.state?.activeChannelPresenceMap?.[exitUid] || Object.values(window.state?.voicePresenceMap || {}).flatMap(ch => Object.entries(ch || {})).find(([uid]) => uid === exitUid)?.[1];

    const activeReplacement = Object.values(window.connections || {}).some(e => e?.uid === exitUid && (e.conn?.open || e.conn?.connectionState === "connected"));
    const activePresence = !!_presenceEntry;
    const _deviceOffline = "undefined" != typeof navigator && navigator.onLine === false;
    if (activeReplacement || activePresence || _deviceOffline) {
      _foxySay("EXIT_DEFERRER_CANCEL", "uid=" + _dshort(exitUid, 24), "سبب الإلغاء: " + (activeReplacement ? "اتصال بديل حيّ" : activePresence ? "الحضور موجود (connected=" + !!_presenceEntry?.connected + ", hb=" + Math.round((Date.now() - (_presenceEntry?.heartbeatAt || 0)) / 1000) + "s)" : "الجهاز أوفلاين") + " ⇒ لم تُحذف البطاقة");
      window.FOXY_DEBUG && window.foxyLog("info", "[Foxy][webrtc] تم إلغاء حذف المشارك — ما زال في الغرفة", {uid:exitUid, activeReplacement, activePresence, presenceConnected:!!_presenceEntry?.connected, deviceOffline:_deviceOffline, heartbeatAge: _presenceEntry ? Date.now() - (_presenceEntry.heartbeatAt||0) : null});
      delete window._participantExitTimers[exitUid];
      return
    }

    try {
      const _map = window.peerIdToUidMap;
      if (_map) {
        const _hasLive = Object.values(window.connections || {}).some(_c => _c && _c.uid === exitUid && (_c.conn?.open || _c.conn?.connectionState === "connected" || _c.conn?.peerConnection?.connectionState === "connected"));
        if (!_hasLive) for (const _k in _map) _map[_k] === exitUid && delete _map[_k];
      }
    } catch (_) {}
    window.locallyDeadUids && window.locallyDeadUids.add(exitUid);
    _foxySay("EXIT_DEFERRER_EVICT", "uid=" + exitUid, "الحضور غايب ⇒ حُذفت البطاقة محلياً. لو تكرر نفس العضو ⇒ غالباً قناة البيانات سقطت (انظر CHANNEL_DOWN_PC_UP)");
    "function" == typeof window.removeParticipantUI ? window.removeParticipantUI(exitUid) : document.getElementById("p-card-" + exitUid)?.remove();
    "function" == typeof window.playChannelSound && window.playChannelSound("leave");
    "function" == typeof addSystemMsg && addSystemMsg(window.__f("js.left_rtc", {name: n}, `${n} غادر (WebRTC Disconnected)`));
    delete window._participantExitTimers[exitUid];
    // FIX: التأجيل كان 12 ثانية ⇒ الكارت بيفضل معلّق بعد ما صاحبه يخرج.
    // 4 ثواني كافية (فيهم فحص الحضور اللي بيمنع الحذف لو لسه في الغرفة).
  }, 4000);
  0 === Object.keys(connections).length && ("function" == typeof window.stopSessionTimer && window.stopSessionTimer(), addSystemMsg(window.__fb("js.room_empty", "الغرفة فارغة الآن، تم إيقاف جلسة النشاط.")))
}
const vizStates = new Map,
  _isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent),
  _vizBuf = new Uint8Array(32);
let _vizInterval = _isMobileDevice ? 60 : 30,
  _speakingHoldMs = 80;

window.refreshVizTurboMode = function() {
  const turbo = "function" == typeof window.isTurboActive && window.isTurboActive();
  _vizInterval = turbo ? (_isMobileDevice ? 100 : 80) : (_isMobileDevice ? 60 : 30);
  _speakingHoldMs = turbo ? 160 : 80;
};
try { window.refreshVizTurboMode(); } catch (_) {}

function visualize(e, t) {
  if (vizStates.has(t)) {
    var old = vizStates.get(t);
    if (old && old.source) try { old.source.disconnect(); } catch(e) {}

    if (old && old.analyzer) try { old.analyzer.disconnect(); } catch(e) {}
    old && old._holdTimer && (clearTimeout(old._holdTimer), old._holdTimer = null);
    vizStates.delete(t);
  }
  window.audioCtx || (window.audioCtx = new(window.AudioContext || window.webkitAudioContext));
  const n = window.audioCtx,
    o = n.createMediaStreamSource(e),
    i = n.createAnalyser();
  i.fftSize = 32, o.connect(i), new Uint8Array(i.frequencyBinCount);
  const a = {
    lastMutedState: !1,
    lastSpeakingState: !1,
    running: !0,
    timerId: null,
    source: o,
    analyzer: i
  };
  vizStates.set(t, a), window._globalVizTimer || (window._globalVizTimer = setTimeout(window._globalVizLoop, _vizInterval))
}

function teardownAllVisualizers() {
  try {
    if (window._globalVizTimer) { clearTimeout(window._globalVizTimer); window._globalVizTimer = null; }
    for (const [, st] of vizStates) {
      try { st._holdTimer && clearTimeout(st._holdTimer) } catch (_) {}
      try { st.source && st.source.disconnect() } catch (_) {}
      try { st.analyzer && st.analyzer.disconnect() } catch (_) {}
      st.running = !1;
    }
    vizStates.clear();
  } catch (_) {}
  try { window.audioCtx && window.audioCtx.suspend && window.audioCtx.suspend().catch(() => {}); } catch (_) {}
}
window.teardownAllVisualizers = teardownAllVisualizers;

function cleanupGhosts() {
  window._ghostSuspectAt = window._ghostSuspectAt || {};
  try {
    //FIX: إعادة الاتصال بالزملاء كانت بتتغلع من خريطة الحضور حتى بعد ما
    // المستخدم يغادر القناة (الخريطة بتتملى تاني من مستمع RTDB)، فالمستخدم
    // كان بيرجع يتصل بصحبه بعد ما غادر وبتظهر بطاقاتشارك زايدة.
    // الحل: الاتصال بالحضور مسموح بس وأنا داخل جلسة صوتية فعلاً.
    const _inVoiceSession = !!(window.state && window.state.activeVoiceChannelId && window.state.activeVoiceStartedAtMs > 0);
    if (_inVoiceSession && window.state && window.state.activeChannelPresenceMap) {
      Object.entries(window.state.activeChannelPresenceMap).forEach(([uid, entry]) => {
        if (uid !== window.state.myUid && entry && entry.peerId && entry.connected !== false && window.connections && !window.connections[entry.peerId] && typeof window.schedulePeerDial === "function") {
          window.schedulePeerDial(entry.peerId, entry.name || "...", "presence-join", uid);
        }
      });
    }
  } catch (_) {}
  if (0 === Object.keys(connections).length) return;
  let e = !1;
  if (Object.keys(connections).forEach(t => {

      try {
        const _uid = connections[t] && connections[t].uid;
        const _map = window.state && window.state.activeChannelPresenceMap;
        if (_uid && _map && _uid !== window.state.myUid && !_map[_uid]) {

          const _mapEmpty = 0 === Object.keys(_map).length;
          const _pc = calls[t] && calls[t].peerConnection;
          const _cs = _pc && _pc.connectionState, _is = _pc && _pc.iceConnectionState;
          const _pcAlive = !!(_pc && ("connected" === _cs || "connecting" === _cs || "connected" === _is || "completed" === _is));
          if (_mapEmpty || _pcAlive) {
            _foxySay("GHOST_SKIP", "peer=" + _dshort(t, 20), _mapEmpty ? "خريطة الحضور فاضية = مش محمّلة، مش متروكة ⇒ تخطّي" : "PC حيّ (pc=" + _cs + " ice=" + _is + ") ⇒ العضو موجود فعلاً، تخطّي رغم غياب المفتاح");
            (window._ghostGoneAt = window._ghostGoneAt || {}) && delete window._ghostGoneAt[t];
            return;
          }
          const _gone = window._ghostGoneAt = window._ghostGoneAt || {};
          // FIX: مهلة السماح كانت 30 ثانية ⇒ كارت العضو اللي خرج كان بيفضل
          // معلّق في قائمة المشاركين. 10 ثواني كافية لتفادي التذبذب.
          if (Date.now() - (_gone[t] || (_gone[t] = Date.now())) < 1e4) {
            _foxySay("GHOST_GRACE", "peer=" + _dshort(t, 20), "مفتاح الحضور غايب، في انتظار (0s-10s). mapSize=" + Object.keys(_map).length + " pc=" + (_cs || "none"));
            return;
          }
          delete _gone[t];
          delete window._ghostSuspectAt[t];
          window.foxyLog("warn", "[Foxy][ghosts] عضو خرج من الحضور — تنظيف", {peerId:t, name:connections[t]?.name||null, uid:_uid, mapSize:Object.keys(_map).length, connState:_cs||null, iceState:_is||null, timestamp:new Date().toISOString()}), cleanupPeerResources(t), removeParticipantUI(t), delete connections[t], e = !0;
          return;
        }
        (window._ghostGoneAt = window._ghostGoneAt || {}) && delete window._ghostGoneAt[t];
      } catch (_) {}
      const n = connections[t].conn;
      if (n && n.open) {
        delete window._ghostSuspectAt[t];
        return;
      }

      try {
        const uid = connections[t] && connections[t].uid;
        const entry = uid && window.state && window.state.activeChannelPresenceMap && window.state.activeChannelPresenceMap[uid];

        const _pc2 = calls[t] && calls[t].peerConnection;
        if (_pc2 && ("connected" === _pc2.connectionState || "connecting" === _pc2.connectionState || "connected" === _pc2.iceConnectionState || "completed" === _pc2.iceConnectionState)) {
          delete window._ghostSuspectAt[t];
          return;
        }
        if (entry && entry.connected && (Date.now() - (entry.heartbeatAt || 0) < 90000)) {
          delete window._ghostSuspectAt[t];
          return;
        }
      } catch (_) {}
      const since = window._ghostSuspectAt[t] || (window._ghostSuspectAt[t] = Date.now());
      if (Date.now() - since < 15000) return;
      delete window._ghostSuspectAt[t];
      window.foxyLog("warn", "[Foxy][ghosts] تنظيف مشارك بقناة مغلقة", {peerId:t, name:connections[t]?.name||null, uid:connections[t]?.uid||null, timestamp:new Date().toISOString()}), cleanupPeerResources(t), removeParticipantUI(t), delete connections[t], e = !0
    }), e && (updateRoomCount(Object.keys(connections).length), window.state && window.state.activeChannelPresenceMap)) {
    const e = window.state.activeChannelPresenceMap;
    //FIX: نفس guard بتاع فوق — إعادة الاتصال بالحضور لازم تكون بس وأنا
    // داخل جلسة صوتية، وإلا المستخدم بيرجع يتصل بصحبه بعد ما غادر.
    const _inVoiceSession2 = !!(window.state && window.state.activeVoiceChannelId && window.state.activeVoiceStartedAtMs > 0);
    if (_inVoiceSession2) Object.keys(e).forEach(t => {
      const n = e[t];

      t !== window.state.myUid && n.peerId && n.connected && window.connections && !window.connections[n.peerId] && "function" == typeof window.schedulePeerDial && (window.FOXY_DEBUG && window.foxyLog("info", "[Foxy][ghosts] إعادة اتصال بمشارك موجود في الحضور لكنه غير متصل محليًا", {uid:t, targetPeerId:n.peerId, name:n.name||null, timestamp:new Date().toISOString()}), window.schedulePeerDial(n.peerId, n.name, "ghost-reconnect"))
    })
  }
}
window._lastMutedTalkToast = window._lastMutedTalkToast || 0;

const VAD_ONSET_HIGH = 9;
const VAD_ONSET_LOW  = 4;
const VAD_HANGOVER_MS = 260;
const VAD_WATCHDOG_MS = 3000;
const VAD_PROBE_MS    = 400;
const VAD_CEILING_MS  = 8000;

const _vad = {
  enabled: false, open: true, lastVoiceAt: 0,
  gatedAt: 0, probeUntil: 0, suppressions: 0,
  tapStream: null, tapSource: null, tapAnalyser: null, tapBuf: null
};

function _vadWant() {
  try { return localStorage.getItem('vh-vad-gate') === 'true'; } catch (e) { return false; }
}

function _vadOutboundTrack() {
  try {
    var s = window.localStream;
    if (!s) return null;
    var at = s.getAudioTracks();
    return (at && at[0]) ? at[0] : null;
  } catch (e) { return null; }
}

function _vadSetOutbound(shouldSend) {
  var tr = _vadOutboundTrack();
  if (!tr) return false;
  var want = !!shouldSend && !window.isMuted;
  if (tr.enabled === want) return false;
  try { tr.enabled = want; return true; } catch (e) { return false; }
}

function _vadEnsureTap() {
  if (_vad.tapAnalyser && _vad.tapStream) {

    var cur = window.localStream;
    if (cur && _vad.tapSourceOf !== cur) {
      _vadReleaseTap();
    } else {
      return true;
    }
  }
  var src = window.localStream;
  if (!src) return false;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    var ac = window.audioCtx || (window.audioCtx = new AC({ sampleRate: 48000, latencyHint: 'interactive' }));
    if (ac.state === 'suspended') ac.resume().catch(function () {});
    var tracks = src.getAudioTracks();
    if (!tracks || !tracks[1]) {

      var s1 = ac.createMediaStreamSource(src);
      _vad.tapSource = s1; _vad.tapSourceOf = src;
    } else {
      var s2 = ac.createMediaStreamSource(new MediaStream([tracks[1]]));
      _vad.tapSource = s2; _vad.tapSourceOf = src;
    }
    var an = ac.createAnalyser();
    an.fftSize = 32;
    _vad.tapSource.connect(an);
    _vad.tapAnalyser = an;
    _vad.tapBuf = new Uint8Array(an.frequencyBinCount);
    return true;
  } catch (e) {
    _vad.tapAnalyser = null;
    return false;
  }
}

function _vadReleaseTap() {
  try { _vad.tapSource && _vad.tapSource.disconnect(); } catch (e) {}
  try { _vad.tapAnalyser && _vad.tapAnalyser.disconnect(); } catch (e) {}
  _vad.tapSource = null; _vad.tapAnalyser = null; _vad.tapSourceOf = null;
}

function _vadLevel() {
  if (!_vad.tapAnalyser || !_vad.tapBuf) return -1;
  try {
    _vad.tapAnalyser.getByteFrequencyData(_vad.tapBuf);
    var s = 0;
    for (var i = 0; i < _vad.tapBuf.length; i++) s += _vad.tapBuf[i];
    return s / _vad.tapBuf.length;
  } catch (e) { return -1; }
}

function _vadTick() {
  if (!_vad.enabled) return;
  var tr = _vadOutboundTrack();
  if (!tr) return;
  var now = Date.now();

  if (window.isMuted) { _vad.open = false; _vadSetOutbound(true); return; }

  if (!_vadEnsureTap()) return;
  var lvl = _vadLevel();
  if (lvl < 0) { _vadSetOutbound(true); _vad.open = true; return; }

  if (!_vad.open && now < _vad.probeUntil) {
    if (lvl > VAD_ONSET_HIGH) { _vad.open = true; _vad.gatedAt = 0; _vadSetOutbound(true); }
    return;
  }
  if (!_vad.open && now > _vad.probeUntil && _vad.gatedAt) {

    var silentFor = now - _vad.gatedAt;
    var forced = silentFor > VAD_CEILING_MS || (lvl <= 0.5 && silentFor > VAD_WATCHDOG_MS);
    if (forced) {
      _vad.probeUntil = now + VAD_PROBE_MS;
      _vad.open = true;
      _vadSetOutbound(true);
      window.FOXY_DEBUG && window.foxyLog('info', '[Foxy][vad] إعادة فحص إجبارية', { silentForMs: silentFor, level: Math.round(lvl) });
    }
  }

  if (lvl > VAD_ONSET_HIGH) {
    _vad.lastVoiceAt = now;
    if (!_vad.open) {
      _vad.open = true; _vad.gatedAt = 0;
      if (_vadSetOutbound(true)) {
        _vad.suppressions++;
        window.FOXY_DEBUG && window.foxyLog('info', '[Foxy][vad] استُؤنف الإرسال', { level: Math.round(lvl) });
      }
    }
    return;
  }

  if (_vad.open && lvl < VAD_ONSET_LOW && (now - _vad.lastVoiceAt) > VAD_HANGOVER_MS) {
    _vad.open = false;
    _vad.gatedAt = now;
    _vadSetOutbound(false);
  }
}

var _vadTimer = null;
function _vadStart() {
  if (_vadTimer) clearInterval(_vadTimer);
  _vadTimer = setInterval(_vadTick, 60);
  document.addEventListener('visibilitychange', function () {

    if (!document.hidden) { _vad.open = true; _vad.gatedAt = 0; _vadSetOutbound(true); }
  });
}
function _vadStop() {
  if (_vadTimer) { clearInterval(_vadTimer); _vadTimer = null; }
  _vadReleaseTap();
  _vad.open = true;
  _vadSetOutbound(true);
}

window.setVadGate = function (on) {
  _vad.enabled = !!on;
  try { localStorage.setItem('vh-vad-gate', on ? 'true' : 'false'); } catch (e) {}
  if (on) { _vad.open = true; _vad.gatedAt = 0; _vad.lastVoiceAt = Date.now(); _vadSetOutbound(true); if (!_vadTimer) _vadStart(); }
  else _vadStop();
  return _vad.enabled;
};
window.getVadGate = function () {
  return { enabled: _vad.enabled, open: _vad.open, suppressions: _vad.suppressions, want: _vadWant() };
};
window.__foxyVadTick = _vadTick;
window.__foxyVadStop = _vadStop;
window._detectMutedTalk = function(vizEntry, buf) {
  try {
    if (!window.isMuted) { vizEntry._mutedTalkMs = 0; return; }
    const inVoice = (window.calls && Object.keys(window.calls).length > 0) || (window.state && window.state.activeVoiceChannelId);
    if (!inVoice || document.hidden || !vizEntry.analyzer) { vizEntry._mutedTalkMs = 0; return; }
    vizEntry.analyzer.getByteFrequencyData(buf);
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i];
    if (s / buf.length > 12) {
      vizEntry._mutedTalkMs = (vizEntry._mutedTalkMs || 0) + _vizInterval;
      if (vizEntry._mutedTalkMs > 900 && Date.now() - (window._lastMutedTalkToast || 0) > 30000) {
        window._lastMutedTalkToast = Date.now();
        "function" == typeof window.showMutedTalkToast && window.showMutedTalkToast();
      }
    } else vizEntry._mutedTalkMs = 0;
  } catch (_) {}
};
window._globalVizLoop = function() {
  if (window.audioCtx && "suspended" === window.audioCtx.state && window.audioCtx.resume().catch(() => {}), document.hidden) return void(window._globalVizTimer = null);
  const e = _vizBuf;
  for (const [t, n] of vizStates.entries())
    if (n.running)
      if (calls[t] || "me" === t)
        if ("me" === t && (window.isMuted || "undefined" != typeof isMuted && isMuted)) !0 === n.lastMutedState && !1 === n.lastSpeakingState || (n._holdTimer && (clearTimeout(n._holdTimer), n._holdTimer = null), n.lastMutedState = !0, n.lastSpeakingState = !1, updatePlayerStatusUI("me", !0, null, !1), "function" == typeof window.updateSpeakingState && window.updateSpeakingState("me", !1), "function" == typeof window._detectMutedTalk && window._detectMutedTalk(n, e));
        else {
          n.analyzer.getByteFrequencyData(e);
          const o = e.reduce((e, t) => e + t) / e.length > 5,
            i = "me" === t && !0 === n.lastMutedState;
          if (n.lastMutedState = !1, o !== n.lastSpeakingState || i) {
            if (o) {
              const r = n._holdTimer;
              r && (clearTimeout(r), n._holdTimer = null);
              n.lastSpeakingState = !0;
              "function" == typeof window.updateSpeakingState && window.updateSpeakingState(t, !0);
              window.pipManager && window.pipManager.updateSpeaker("me" === t ? window.__fb("web.t027", "أنا") : connections[t]?.name || t, !0)
            } else
              n._holdTimer || (n._holdTimer = setTimeout(() => {
                n._holdTimer = null, n.lastSpeakingState = !1;
                "function" == typeof window.updateSpeakingState && window.updateSpeakingState(t, !1);
                window.pipManager && window.pipManager.updateSpeaker("me" === t ? window.__fb("web.t027", "أنا") : connections[t]?.name || t, !1)
              }, _speakingHoldMs));
            i && updatePlayerStatusUI(t, "me" !== t && null, null, o)
          }

        }
  else n._holdTimer && (clearTimeout(n._holdTimer), n._holdTimer = null), n.source.disconnect(), n.analyzer && n.analyzer.disconnect(), n.lastSpeakingState && "function" == typeof window.updateSpeakingState && window.updateSpeakingState(t, !1), n.running = !1, vizStates.delete(t);
  else vizStates.delete(t);
  vizStates.size > 0 ? window._globalVizTimer = setTimeout(window._globalVizLoop, _vizInterval) : window._globalVizTimer = null
}, document.addEventListener("visibilitychange", () => {
  document.hidden ? window._globalVizTimer && (clearTimeout(window._globalVizTimer), window._globalVizTimer = null) : vizStates.size > 0 && !window._globalVizTimer && (window._globalVizTimer = setTimeout(window._globalVizLoop, _vizInterval))
});
let pingIntervalStarted = !1;

function monitorPing() {
  pingIntervalStarted || (pingIntervalStarted = !0, setInterval(() => {
    if (document.hidden) return;
    if (!document.getElementById("ping-display")) return;
    if (_isMobileDevice && "undefined" != typeof connections && 0 === Object.keys(connections).length) return;

    const _nowTs = Date.now();
    const peerRtts = window.peerRttMap ? Object.keys(window.peerRttMap)
      .filter(k => {
        const v = window.peerRttMap[k];
        if (typeof v !== "number" || v < 0 || v > 10000) return false;
        try {
          const ts = window.peerRttTs && window.peerRttTs[k];
          if (ts && _nowTs - ts > 20000) return false;
        } catch (_) {}
        try {
          if (!window.calls || !window.calls[k]) return false;
        } catch (_) { return false; }
        return true;
      })
      .map(k => window.peerRttMap[k])
      .sort((a, b) => a - b) : [];
    if (peerRtts.length) {
      const median = peerRtts[Math.floor(peerRtts.length / 2)];
      const label = `Ping: ${median} ms`;
      if (window._lastPingLabel !== label) {
        window._lastPingLabel = label;
        requestAnimationFrame(() => {
          const e = document.getElementById("ping-display");
          if (e && e.innerText !== label) e.innerText = label;
          e && (e.className = median > 1e3 ? "text-[11px] font-mono text-red-500 font-bold animate-pulse" : median > 400 ? "text-[11px] font-mono text-amber-500" : "text-[11px] font-mono text-emerald-400/70")
        });
      }
      return;
    }
    let n = navigator.connection && navigator.connection.rtt > 0 ? navigator.connection.rtt : null;
    if (null !== n) {
      requestAnimationFrame(() => {
        const e = document.getElementById("ping-display");
        e && (e.innerText = `Ping: ${n} ms`, e.className = n > 1e3 ? "text-[11px] font-mono text-red-500 font-bold animate-pulse" : n > 400 ? "text-[11px] font-mono text-amber-500" : "text-[11px] font-mono text-emerald-400/70")
      })
    } else {

      const e = performance.now();
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => { try { ctrl.abort(); } catch (_) {} }, 3500);
        fetch("/assets/img/foxy.png?t=" + Date.now(), {
          cache: "no-store", signal: ctrl.signal
        }).then(() => {
          clearTimeout(timer);
          const t = Math.round(performance.now() - e);
          if (!(t >= 0 && t <= 10000)) return;
          const label = `Ping: ${t} ms`;
          if (window._lastPingLabel === label) return;
          window._lastPingLabel = label;
          requestAnimationFrame(() => {
            const e = document.getElementById("ping-display");
            if (e && e.innerText !== label) e.innerText = label;
            e && (e.className = t > 1e3 ? "text-[11px] font-mono text-red-500 font-bold animate-pulse" : t > 400 ? "text-[11px] font-mono text-amber-500" : "text-[11px] font-mono text-emerald-400/70")
          })
        }).catch(() => { try { clearTimeout(timer); } catch (_) {} })
      } catch (_) {}
    }
  }, _isMobileDevice ? 15e3 : 8e3))
}

function updateCallBitrate(e, t = null) {
  const n = t || window.selectedBitrate || 48;
  if (!e?.peerConnection) return;
  e.peerConnection.getSenders().forEach(sender => {
    if (!sender.track) return;
    if ("audio" === sender.track.kind) {
      updateSenderEncodingParameters(sender, params => {
        params.encodings[0].maxBitrate = 1e3 * n;
      }).then(() => applyFoxySenderPriority(sender, "high")).catch(() => {});
    }
    if ("video" === sender.track.kind) {
      updateSenderEncodingParameters(sender, params => {
        params.encodings[0].maxBitrate = 2e5;
      }).then(() => applyFoxySenderPriority(sender, "low")).catch(() => {});
    }
  })
}

function updateAllCallBitrates(e = null) {
  Object.values(calls).forEach(t => {
    t.peerConnection && "connected" === t.peerConnection.connectionState && updateCallBitrate(t, e)
  });

  "function" == typeof applyCameraAdaptiveParams && applyCameraAdaptiveParams()
}

var _camAdapt = {
  downBy: 1,
  tick: 0,
  stableUp: 0,
  coolUntil: 0,
  initialized: false
};
var CAM_ADAPT_KEY = "vh-cam-adapt";
var CAM_SCALES = [1, 2, 3];

function _camAdaptOverride() {
  var v = parseInt(localStorage.getItem(CAM_ADAPT_KEY) ?? "-1", 10);
  return -1 === v || isNaN(v) ? -1 : v;
}
function _camTargetScale() {
  var manual = _camAdaptOverride();
  if (manual === 0) return 2;
  if (manual === 1) return 1;
  return _camAdapt.downBy;
}
function _cameraSenders() {
  var out = [];
  Object.values(window.calls || {}).forEach(function (c) {
    if (!c || !c.peerConnection || "connected" !== c.peerConnection.connectionState) return;
      c.peerConnection.getSenders().forEach(function (s) {
        //FIX: الـ track dummy (كانvas أسود 2×2) مش كاميرا — نستثنيه من تعديل
        //معاملات الكاميرا.
        if (s.track && s.track._foxyDummy) return;
        if (s.track && "video" === s.track.kind && s._foxyVideoSource !== "screen") out.push(s);
      });
  });
  return out;
}

function _preferCameraCodecs(pc) {
  try {
    if ("function" !== typeof RTCRtpReceiver || !RTCRtpReceiver.getCapabilities) return;
    var caps = RTCRtpReceiver.getCapabilities("video");
    if (!caps || !caps.codecs || !caps.codecs.length) return;
    var rank = ["video/H264", "video/VP8", "video/VP9"];
    var sorted = caps.codecs.slice().sort(function (a, b) {
      var ia = rank.indexOf(a.mimeType);
      var ib = rank.indexOf(b.mimeType);
      return (-1 === ia ? 99 : ia) - (-1 === ib ? 99 : ib);
    });
    if (!pc.getTransceivers) return;
    pc.getTransceivers().forEach(function (tr) {
      if (tr.sender && tr.sender.track && "video" === tr.sender.track.kind && tr.setCodecPreferences && sorted.length) tr.setCodecPreferences(sorted);
    });
  } catch (_) {}
}
function _applyCameraParams(sender) {
    try {
      if (!sender || !sender.track || "video" !== sender.track.kind || sender._foxyVideoSource === "screen") return;
      //FIX: الـ track dummy (كانvas أسود) مش كاميرا.
      if (sender.track._foxyDummy) return;
    if ("motion" !== sender.track.contentHint) sender.track.contentHint = "motion";
    updateSenderEncodingParameters(sender, (p, includeNetworkPriority, includePriority) => {
      p.degradationPreference = "balanced";
      p.encodings[0].maxFramerate = 15;
      p.encodings[0].maxBitrate = 200000;
      p.encodings[0].scaleResolutionDownBy = _camTargetScale();
      p.encodings.forEach(encoding => {
        if (includePriority) encoding.priority = "low";
        else delete encoding.priority;
        if (includeNetworkPriority) encoding.networkPriority = "low";
        else delete encoding.networkPriority;
      });
    }).catch(function () {});
  } catch (_) {}
}
function applyCameraAdaptiveParams() {
  _cameraSenders().forEach(_applyCameraParams);
}
async function _adaptCameraTick() {
  var senders = _cameraSenders();
  if (!senders.length) return;

  if (!Number.isFinite(_camAdapt.tick)) _camAdapt.tick = 0;
  var s = senders[_camAdapt.tick++ % senders.length];
  var pc = s && s._pcRef;
  if (!pc) {

    for (var id in window.calls) {
      var c = window.calls[id];
      if (c && c.peerConnection && "connected" === c.peerConnection.connectionState && c.peerConnection.getSenders().indexOf(s) !== -1) {
        pc = c.peerConnection;
        s._pcRef = pc;
        _preferCameraCodecs(pc);
        break;
      }
    }
  }
  if (!pc) return;
  var stats;
  try {
    stats = await pc.getStats();
  } catch (_) {
    return;
  }
  var reason = "";
  var target = 0;
  var frames = 0;
  var w = 0;
  var h = 0;
  var fps = 0;
  stats.forEach(function (r) {
    if ("outbound-rtp" !== r.type || "video" !== r.kind) return;
    reason = r.qualityLimitationReason || reason;
    target = r.targetBitrate || target;
    frames = r.framesSent || frames;
    w = r.frameWidth || w;
    h = r.frameHeight || h;
    fps = r.framerateSent || fps;
  });
  if (!frames) return;
  _camAdapt.lastReason = reason;
  _camAdapt.lastWidth = w;
  _camAdapt.lastHeight = h;
  _camAdapt.lastFps = Math.round(fps);
  _camAdapt.lastTarget = Math.round(target / 1000);

  if (-1 !== _camAdaptOverride()) return;
  var idx = CAM_SCALES.indexOf(_camAdapt.downBy);
  -1 === idx && (idx = 0);
  var next = idx;
  if ("cpu" === reason || "bandwidth" === reason) {
    next = Math.min(CAM_SCALES.length - 1, idx + 1);
    _camAdapt.stableUp = 0;
  } else if (reason) {

    next = Math.min(CAM_SCALES.length - 1, idx + 1);
    _camAdapt.stableUp = 0;
  } else if (Date.now() < _camAdapt.coolUntil) {
    return;
  } else if (_camAdapt.stableUp >= 2) {

    next = Math.max(0, idx - 1);
    _camAdapt.stableUp = 0;
    _camAdapt.coolUntil = Date.now() + 10000;
  } else {
    _camAdapt.stableUp++;
  }
  if (next === idx) return;
  _camAdapt.downBy = CAM_SCALES[next];
  applyCameraAdaptiveParams();
}
function startCameraAdaptive() {
  if (_camAdapt.initialized) return;
  _camAdapt.initialized = true;
  try {
    var saved = parseInt(localStorage.getItem(CAM_ADAPT_KEY) ?? "-1", 10);
    if (-1 !== saved && !isNaN(saved)) _camAdapt.downBy = 2 === saved ? 2 : 1;
  } catch (_) {}
}
window.setCameraAdaptiveMode = function (mode) {

  var m = "auto" === mode ? -1 : "safer" === mode ? 0 : 1;
  localStorage.setItem(CAM_ADAPT_KEY, String(m));
  "auto" === mode && (_camAdapt.downBy = 1, _camAdapt.stableUp = 0);
  applyCameraAdaptiveParams();
  return m;
};
window.getCameraAdaptiveState = function () {
  return {
    mode: -1 === _camAdaptOverride() ? "auto" : 0 === _camAdaptOverride() ? "saver" : "full",
    scale: _camTargetScale(),
    width: _camAdapt.lastWidth || 0,
    height: _camAdapt.lastHeight || 0,
    fps: _camAdapt.lastFps || 0,
    targetKbps: _camAdapt.lastTarget || 0,
    reason: _camAdapt.lastReason || "none"
  };
};
async function logCallQuality(e) {
  const t = calls[e];
  if (t?.peerConnection) try {
    const n = await t.peerConnection.getStats();
    let o = 0,
      i = 0,
      a = 0,
      c = 0,
      d = 0,
      r = 0,
      cs = 0,
      ts = 0,
      ss = 0,
      jbd = 0,
      jbe = 0;
    n.forEach(e => {
      "inbound-rtp" === e.type && "audio" === e.kind && (o = e.packetsLost || 0, i = e.packetsReceived || 0, a = e.jitter || 0, cs = e.concealedSamples || 0, ts = e.totalSamplesReceived || 0, ss = e.silentConcealedSamples || 0, jbd = e.jitterBufferDelay || 0, jbe = e.jitterBufferEmittedCount || 0), "remote-inbound-rtp" === e.type && "audio" === e.kind && (c = Math.round(1e3 * (e.roundTripTime || 0)), d = 100 * (e.fractionLost || 0), r = Math.round(1e3 * (e.jitter || 0))), "candidate-pair" === e.type && "succeeded" === e.state && void 0 !== e.currentRoundTripTime && (c = Math.round(1e3 * e.currentRoundTripTime))
    });

    let concealPct = 0, silentShare = 0, jbDelayMs = 0;
    const _prevQ = callQualityHistory.get(e);
    if (_prevQ && ts > (_prevQ.totalSamples || 0)) {
      const dTs = ts - _prevQ.totalSamples,
        dCs = Math.max(0, cs - (_prevQ.concealedSamples || 0)),
        dSs = Math.max(0, ss - (_prevQ.silentConcealedSamples || 0));
      if (dTs > 0) {
        concealPct = parseFloat((100 * dCs / dTs).toFixed(1));
        silentShare = dCs > 0 ? Math.round(100 * dSs / dCs) : 0;
      }
      const dJbe = Math.max(1, jbe - (_prevQ.jbEmitted || 0));
      jbDelayMs = Math.round(1000 * Math.max(0, jbd - (_prevQ.jbDelay || 0)) / dJbe);
    }
    let s = "connected";
    const l = callQualityHistory.get(e),
      u = Date.now();
    let p = l?.lastWarningAt || 0;

    const _peerUid = window.peerIdToUidMap?.[e] || null;
    const _presence = _peerUid ? (window.state?.voicePresenceMap?.[window.state?.activeVoiceChannelId]?.[_peerUid] || window.state?.activeChannelPresenceMap?.[_peerUid] || window.state?.voicePresenceMap?.["voice-general"]?.[_peerUid]) : null;
    const _remoteMuted = !!(_presence?.muted || _presence?.forceMuted);
    const _remoteTrackMuted = (() => { try { const a = document.getElementById("audio-" + e); const tr = a?.srcObject?.getAudioTracks?.()[0]; return tr ? (tr.muted || !tr.enabled) : false; } catch(_) { return false; }})();
    const _isDeafened = !!window.isDeafened;
    if (i === (l?.packetsReceived || 0) && "connected" === t.peerConnection.connectionState) {
      if (_remoteMuted || _remoteTrackMuted || _isDeafened) {

        t._frozenCount = 0;
      } else {
        t._frozenCount = (t._frozenCount || 0) + 1, (3 === t._frozenCount || 5 === t._frozenCount) && window.foxyLog("warn", "[Foxy][quality] لا حزم صوت جديدة واصلة (سكوت/DTX أم تجمد حقيقي؟)", {peerId:e, name:connections[e]?.name||null, packetsReceived:i, frozenCount:t._frozenCount, willRecallAtCount:6, remoteMuted:_remoteMuted, trackMuted:_remoteTrackMuted, isDeafened:_isDeafened, timestamp:new Date().toISOString(), hint: _remoteMuted ? "الطرف الآخر كاتم الميك — طبيعي" : "تحدّث بصوت عالٍ لاختبار; لو يبقى 0 فهناك تجمد حقيقي"}), t._frozenCount >= 6 && (window.foxyLog("error", "[Foxy][quality] تفعيل reCallPeer بسبب تجمد الحزم — لو الطرف الآخر ساكت فهذه إنذار خاطئ", {peerId:e, name:connections[e]?.name||null, packetsReceived:i, rttMs:c, lossPct:g, remoteMuted:_remoteMuted, timestamp:new Date().toISOString()}), t._frozenCount = 0, reCallPeer(e, "frozen-audio-packets"))
      }
    } else ((t._frozenCount || 0) > 0 && window.foxyLog("info", "[Foxy][quality] عاد تدفق الحزم، تصفير عداد التجمد", {peerId:e, packetsReceived:i, previousFrozenCount:t._frozenCount, timestamp:new Date().toISOString()}), t._frozenCount = 0);
    let w = 0;
    if (l) {
      const t = o - l.packetsLost,
        n = t + (i - l.packetsReceived);
      n > 50 && (w = t / n * 100, w > 5) && u - p > 12e4 && (addSystemMsg(window.__f("js.low_q", {name: connections[e]?.name||e, loss: w.toFixed(1)}, `⚠️ جودة الصوت مع ${connections[e]?.name||e} متدنية (فقدان حزم: ${w.toFixed(1)}%)`)), p = u)
    }
    const m = Math.round(Math.max(1e3 * a, r)),
      g = parseFloat(Math.max(w, d).toFixed(1));

    let dispRtt = c;
    if (c >= 0 && c <= 10000) {

      const _prev = (typeof t._rttSmooth === "number" && t._rttSmooth >= 0) ? t._rttSmooth : Math.min(c, 150);
      if (c > Math.max(300, _prev * 3) && _prev < 300) {
        t._spikeStreak = (t._spikeStreak || 0) + 1;
        if (t._spikeStreak < 2) { dispRtt = Math.round(_prev); }
        else { t._rttSmooth = c; t._spikeStreak = 0; }
      } else {
        t._rttSmooth = Math.round(_prev * 0.7 + c * 0.3);
        dispRtt = t._rttSmooth;
        t._spikeStreak = 0;
      }
    }
    if (!(dispRtt >= 0 && dispRtt <= 10000)) {
      try { window.peerRttMap && delete window.peerRttMap[e]; } catch (_) {}
    } else {
      window.peerRttMap || (window.peerRttMap = {}), window.peerRttMap[e] = dispRtt;
      window.peerRttTs || (window.peerRttTs = {}), window.peerRttTs[e] = Date.now();
    }
    dispRtt > 300 || g > 8 || m > 100 ? s = "poor_quality" : (dispRtt > 150 || g > 2 || m > 40) && (s = "fair_quality"), s !== t._lastQLevel && ("connected" === s || "poor_quality" === s || "fair_quality" === s) && (Date.now() - (t._lastQLogAt || 0) > 30000 || "poor_quality" === s) && (t._lastQLogAt = Date.now(), window.foxyLog("info", "[Foxy][quality] تغير تقييم جودة الصوت", {peerId:e, name:connections[e]?.name||null, from:t._lastQLevel||null, to:s, rttMs:dispRtt, rawRttMs:c, lossPct:g, jitterMs:m, concealPct, silentShare, jbDelayMs})), t._lastQLevel = s, !t.peerConnection || "connected" !== t.peerConnection.connectionState || "connected" !== t.peerConnection.iceConnectionState && "completed" !== t.peerConnection.iceConnectionState || "function" == typeof window.updateMediaLed && window.updateMediaLed(e, s, {
      rtt: dispRtt,
      loss: g,
      jitter: m,
      concealed: concealPct
    }), callQualityHistory.set(e, {
      packetsLost: o,
      packetsReceived: i,
      timestamp: u,
      lastWarningAt: p,
      totalSamples: ts,
      concealedSamples: cs,
      silentConcealedSamples: ss,
      jbDelay: jbd,
      jbEmitted: jbe
    })
  } catch (e) {}
}

async function foxyAudioDiag(peerId) {
  const out = {};
  const ids = peerId ? [peerId] : Object.keys(window.calls || {});
  for (const pid of ids) {
    try {
      const call = window.calls && window.calls[pid];
      const pc = call && call.peerConnection;
      if (!pc) { out[pid] = { error: "no-call" }; continue; }
      const stats = await pc.getStats();
      let ib = null, rib = null, pair = null;
      const cands = {};
      stats.forEach(s => {
        if ("inbound-rtp" === s.type && "audio" === s.kind) ib = s;
        else if ("remote-inbound-rtp" === s.type && "audio" === s.kind) rib = s;
        else if ("candidate-pair" === s.type && s.nominated) pair = s;
        else if ("local-candidate" === s.type || "remote-candidate" === s.type) cands[s.id] = s;
      });
      if (!pair) stats.forEach(s => {
        if (!pair && "candidate-pair" === s.type && "succeeded" === s.state && null != s.currentRoundTripTime) pair = s;
      });
      const row = {
        name: (window.connections && window.connections[pid] && window.connections[pid].name) || pid,
        conn: pc.connectionState, ice: pc.iceConnectionState
      };
      if (ib) {
        const lost = ib.packetsLost || 0, recv = ib.packetsReceived || 0;
        row.packets = recv;
        row.lossPct = recv > 0 ? parseFloat((100 * lost / (lost + recv)).toFixed(1)) : 0;
        row.jitterMs = Math.round(1000 * (ib.jitter || 0));
        const tSr = ib.totalSamplesReceived || 0, cSr = ib.concealedSamples || 0, sSr = ib.silentConcealedSamples || 0;
        row.concealPct = tSr > 0 ? parseFloat((100 * cSr / tSr).toFixed(1)) : 0;
        row.silentSharePct = cSr > 0 ? Math.round(100 * sSr / cSr) : 0;
        const je = ib.jitterBufferEmittedCount || 0;
        row.jbDelayMs = je > 0 ? Math.round(1000 * (ib.jitterBufferDelay || 0) / je) : 0;
      }
      if (rib && null != rib.roundTripTime) row.rttMs = Math.round(1000 * rib.roundTripTime);
      if (pair) {
        if (null == row.rttMs && null != pair.currentRoundTripTime) row.rttMs = Math.round(1000 * pair.currentRoundTripTime);
        const lc = cands[pair.localCandidateId] || {}, rc = cands[pair.remoteCandidateId] || {};
        row.path = (lc.candidateType || "?") + "/" + (pair.protocol || rc.protocol || "?") + "->" + (rc.candidateType || "?");
        row.viaRelay = "relay" === rc.candidateType || "relay" === lc.candidateType;
      }
      row.verdict = row.lossPct > 5 || (row.concealPct > 5 && row.silentSharePct < 50) ? "network-loss (path drops voice)"
        : row.concealPct > 5 ? "sender-silent-or-gated (DTX/mute/noise-gate)"
        : "sender-mic-or-CPU-gate OR local-playback (compare: one peer = their side, all peers = yours)";
      out[pid] = row;
    } catch (err) { out[pid] = { error: (err && err.message) || String(err) }; }
  }
  try { window.foxyLog && window.foxyLog("info", "[Foxy][audio-diag]", out); } catch (_) {}
  return out;
}
monitorPing(), window.monitorPing = monitorPing, window.foxyAudioDiag = foxyAudioDiag, window.handleCall = handleCall, window.reCallPeer = reCallPeer, window.handleExit = handleExit, window.visualize = visualize, window.cleanupGhosts = cleanupGhosts, window.updateAllCallBitrates = updateAllCallBitrates, window.updateCallBitrate = updateCallBitrate, window.monitorPing = monitorPing, window._volumeStore = window._volumeStore || {}, window.adjustPeerVolume = function(e, t) {
  if (!e) return;
  const maxVolSetting = parseInt(localStorage.getItem("vh-max-volume") || "200", 10);
  if (t * 100 > maxVolSetting) t = maxVolSetting / 100;
  connections[e] && (connections[e].volumeRatio = t), window._volumeStore[e] = t;

  try {
    if (window.masterAudioMixer && window.masterAudioMixer.isEnabled()) {
      window.masterAudioMixer.setPeerVolume(e, t);
      return;
    }
  } catch (_) {}
  const n = document.getElementById("audio-" + e);
  if (!n || !n.srcObject) return;
  if (t <= 1) {
    if (Object.prototype.hasOwnProperty.call(n, "_customMuted") || void 0 !== n._customMuted) {
      const e = n.muted;
      delete n.muted, n.muted = e, delete n._customMuted
    }
    if (n.volume = t, peerGainNodes.has(e)) {
      const t = peerGainNodes.get(e);
      try {
        t.gainNode.disconnect(), t.clonedStream.getTracks().forEach(e => e.stop())
      } catch (e) {}
      peerGainNodes.delete(e)
    }
    return
  }
  if (n.volume = 0, window.audioCtx || (window.audioCtx = new(window.AudioContext || window.webkitAudioContext)), !peerGainNodes.has(e)) {
    const o = n.srcObject.clone(),
      i = window.audioCtx.createMediaStreamSource(o),
      a = window.audioCtx.createGain();
    i.connect(a), a.connect(window.audioCtx.destination), Object.defineProperty(n, "muted", {
      get: function() {
        return this._customMuted || !1
      },
      set: function(n) {
        this._customMuted = n;
        const o = window._volumeStore && void 0 !== window._volumeStore[e] ? window._volumeStore[e] : t;
        a.gain.value = n ? 0 : o
      },
      configurable: !0
    }), peerGainNodes.set(e, {
      gainNode: a,
      clonedStream: o
    })
  }
  const o = peerGainNodes.get(e),
    i = n.muted;
  o.gainNode.gain.value = i ? 0 : t
};
var _callHealthTimer = null;
function _startCallHealthCheck() {
  if (_callHealthTimer) return;
  if (typeof startCameraAdaptive === "function") startCameraAdaptive();
  _callHealthTimer = setInterval(function() {
    if (document.hidden) return;
    var ids = Object.keys(window.calls || {});
    window._healthTick = (window._healthTick || 0) + 1;

    var batch = ids.length > 3 ? ids.filter(function(_, i) { return (i + window._healthTick) % 2 === 0; }) : ids;
    batch.forEach(function(e) {
      var t = document.getElementById("audio-" + e);
      if (t && t.srcObject) {
        var n = t.srcObject.getAudioTracks();
        if (0 === n.length || "ended" === n[0].readyState) return void reCallPeer(e, "remote-audio-track-ended");
        t.paused && !window.isDeafened && t.play().catch(function(){});
      }
      logCallQuality(e);
    });
    if (typeof _adaptCameraTick === "function") _adaptCameraTick().catch(function() {});
  }, 5000);
}
function _stopCallHealthCheck() {
  if (_callHealthTimer) { clearInterval(_callHealthTimer); _callHealthTimer = null; }
}
document.addEventListener("visibilitychange", function() {
  document.hidden ? _stopCallHealthCheck() : _startCallHealthCheck();
});
_startCallHealthCheck();

let _audioPlaybackRetryTimer = null;
function retryRemoteAudioPlayback() {
  if (window.isDeafened || _audioPlaybackRetryTimer) return;
  _audioPlaybackRetryTimer = setTimeout(() => {
    _audioPlaybackRetryTimer = null;
    document.querySelectorAll('audio[id^="audio-"], audio#remote-screen-audio').forEach(audio => {
      if (!audio.srcObject || audio.muted || !audio.paused) return;
      audio.play().then(() => {
        audio.removeAttribute("data-playback-blocked");
      }).catch(() => {
        audio.setAttribute("data-playback-blocked", "true");
      });
    });
  }, 0);
}
document.addEventListener("pointerdown", retryRemoteAudioPlayback, true);
document.addEventListener("keydown", retryRemoteAudioPlayback, true);
