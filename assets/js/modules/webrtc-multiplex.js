/*
 * Multiplex camera and screen video over the existing audio MediaConnection.
 * PeerJS is patched locally to reserve a sendrecv video transceiver before its
 * initial SDP offer. Screen viewers must already have a voice MediaConnection.
 */
(() => {
  const state = window.__foxyScreenShareState;
  const failedScreenPreviews = window._foxyScreenTrackFailedPeers || (window._foxyScreenTrackFailedPeers = new Set());
  const inlineJoinRetryTimers = new Map();
  const screenCallRecoveryTimers = new Map();
  const currentStream = () => state?.getStream?.() || window.localScreenStream || null;
  const setStream = stream => state?.setStream?.(stream);
  const setStarting = value => state?.setStarting?.(value);
  const activeCalls = () => Object.values(window.calls || {}).filter(call => call?.peerConnection);
  function isUsableCall(call) {
    const pc = call?.peerConnection;
    return !!pc && pc.signalingState !== "closed" && pc.connectionState !== "closed" && pc.connectionState !== "failed";
  }
  function hasFailedCallTransport(call) {
    if (!call) return true;
    const pc = call.peerConnection;
    //FIX: الـ PeerJS بيمسح الـ RTCPeerConnection لما الـ MediaConnection
    //يقفل (Negotiator.cleanup بيحطّ peerConnection = null). كنا بنعتبر
    //الحالة دي "سليمة" فبنوقف مسار الاسترجاع ونقول للمشاهد "لازم تتصل صوتياً"
    //وخلاص — مع إن الاتصال ممكن يتشال ويتعمل من جديد.
    if (!pc) return true;
    return pc.signalingState === "closed"
      || pc.connectionState === "closed"
      || pc.connectionState === "failed"
      || pc.iceConnectionState === "closed"
      || pc.iceConnectionState === "failed";
  }
  const diagnosticPcIds = new WeakMap();
  const diagnosticLastLoggedAt = new Map();
  let diagnosticPcSequence = 0;
  function diagnosticPcId(pc) {
    if (!pc) return null;
    if (!diagnosticPcIds.has(pc)) diagnosticPcIds.set(pc, "pc-" + (++diagnosticPcSequence));
    return diagnosticPcIds.get(pc);
  }
  function getScreenDiagnosticSnapshot(peerId, call = window.calls?.[peerId]) {
    const uid = window.peerIdToUidMap?.[peerId] || window.connections?.[peerId]?.uid || peerId || null;
    const matchingIds = new Set([peerId, window.uidToPeerIdMap?.[uid]].filter(Boolean));
    Object.keys(window.calls || {}).forEach(id => {
      if ((window.peerIdToUidMap?.[id] || window.connections?.[id]?.uid || id) === uid) matchingIds.add(id);
    });
    const pcEntries = new Map();
    matchingIds.forEach(id => {
      const mediaPc = window.calls?.[id]?.peerConnection;
      const connection = window.connections?.[id];
      const dataPc = connection?.conn?.peerConnection;
      [mediaPc, dataPc].filter(Boolean).forEach(pc => {
        const key = diagnosticPcId(pc);
        const entry = pcEntries.get(key) || {
          id: key,
          signaling: pc.signalingState || null,
          connection: pc.connectionState || null,
          ice: pc.iceConnectionState || null,
          transceivers: (pc.getTransceivers?.() || []).map(transceiver => ({
            mid: transceiver.mid ?? null,
            kind: transceiver.receiver?.track?.kind || transceiver.sender?.track?.kind || null,
            direction: transceiver.direction || null,
            currentDirection: transceiver.currentDirection || null,
            senderTrack: transceiver.sender?.track ? `${transceiver.sender.track.kind}:${transceiver.sender.track.readyState}` : null,
            receiverTrack: transceiver.receiver?.track ? `${transceiver.receiver.track.kind}:${transceiver.receiver.track.readyState}:${transceiver.receiver.track.muted ? "muted" : "unmuted"}` : null
          }))
        };
        entry.refs = [...new Set([...(entry.refs || []), mediaPc === pc ? "media-call" : null, dataPc === pc ? "data-connection" : null].filter(Boolean))];
        pcEntries.set(key, entry);
      });
    });
    const list = document.getElementById("participants-list");
    const cards = list ? Array.from(list.querySelectorAll(".screen-share-card")) : [];
    const matchedCards = cards.filter(card => {
      const cardUid = card.dataset.screenOwnerUid || "";
      const cardPeer = card.dataset.screenOwner || "";
      const suffix = card.id.startsWith("screen-share-card-") ? card.id.slice("screen-share-card-".length) : "";
      return [cardUid, cardPeer, suffix].some(value => value && (value === peerId || value === uid
        || (window.peerIdToUidMap?.[value] || window.connections?.[value]?.uid || value) === uid));
    });
    const activeVideo = call?._foxyRemoteVideoStream?.getVideoTracks?.() || call?.remoteVideoStream?.getVideoTracks?.() || [];
    const screenVideo = call?.remoteScreenStream?.getVideoTracks?.() || call?._foxyRemoteScreenStream?.getVideoTracks?.() || [];
    const dataConnection = window.connections?.[peerId]?.conn;
    return {
      peerId: peerId || null,
      uid,
      callPeerId: call?.peer || null,
      callType: call?.type || null,
      pcCountForUid: pcEntries.size,
      peerConnections: [...pcEntries.values()],
      dataConnection: dataConnection ? {
        type: dataConnection.type || null,
        open: !!dataConnection.open,
        readyState: dataConnection.dataChannel?.readyState || dataConnection.dataConnection?.readyState || null,
        bufferedAmount: dataConnection.dataChannel?.bufferedAmount ?? null,
        foxyDataOpen: dataConnection._foxyDataOpen ?? null
      } : null,
      callState: call?.peerConnection ? {
        signaling: call.peerConnection.signalingState,
        connection: call.peerConnection.connectionState,
        ice: call.peerConnection.iceConnectionState,
        videoSource: call._foxyVideoSource || call._foxyRemoteVideoSource || null,
        screenVideo: screenVideo.map(track => ({ state: track.readyState, muted: track.muted, id: track.id })),
        remoteVideo: activeVideo.map(track => ({ state: track.readyState, muted: track.muted, id: track.id }))
      } : null,
      shareCards: {
        countForOwner: matchedCards.length,
        total: cards.length,
        duplicateIds: matchedCards.map(card => card.id).filter((id, index, all) => all.indexOf(id) !== index),
        cards: matchedCards.map(card => ({
          id: card.id,
          owner: card.dataset.screenOwner || null,
          ownerUid: card.dataset.screenOwnerUid || null,
          inline: card.classList.contains("media-preview-inline"),
          loadingVisible: !card.querySelector(".media-preview-loading")?.hidden,
          label: card.querySelector(".media-preview-watch-label")?.textContent?.trim() || null,
          videoReadyState: card.querySelector(".media-preview-backdrop")?.readyState ?? null,
          videoTrackCount: card.querySelector(".media-preview-backdrop")?.srcObject?.getVideoTracks?.().length ?? 0
        }))
      },
      timestamp: new Date().toISOString()
    };
  }
  function screenDiagnostic(event, peerId, call, extra = {}, level = "info") {
    const data = { event, ...getScreenDiagnosticSnapshot(peerId, call), ...extra };
    const events = window.__foxyScreenDiagnosticEvents || (window.__foxyScreenDiagnosticEvents = []);
    events.push(data);
    if (events.length > 120) events.splice(0, events.length - 120);
    window.foxyDiagEvent?.("SCREEN_" + String(event).toUpperCase().replace(/[^A-Z0-9]+/g, "_"), "peer=" + (peerId || "unknown"), JSON.stringify(extra).slice(0, 220));
    if (level !== "info" || window.FOXY_SCREEN_DEBUG || window.FOXY_DEBUG) {
      const throttleKey = `${level}|${event}|${peerId || "unknown"}`;
      const now = Date.now();
      const throttleMs = level === "warn" ? 5000 : 0;
      const lastLoggedAt = diagnosticLastLoggedAt.get(throttleKey) || 0;
      if (!throttleMs || now - lastLoggedAt >= throttleMs) {
        diagnosticLastLoggedAt.set(throttleKey, now);
        while (diagnosticLastLoggedAt.size > 200) diagnosticLastLoggedAt.delete(diagnosticLastLoggedAt.keys().next().value);
        window.foxyLog?.(level, `[Foxy][screen-diag] ${event}`, data);
      }
    }
    return data;
  }
  function logScreenFlow(event, peerId, call, extra = {}) {
    const pc = call?.peerConnection;
    const transceiver = call?._foxyVideoTransceiver || pc?.getTransceivers?.().find(item =>
      item.receiver?.track?.kind === "video" || item.sender?.track?.kind === "video"
    );
    const track = currentStream()?.getVideoTracks?.()[0];
    window.foxyLog?.("info", `[Foxy][screen-flow] ${event}`, {
      peerId: peerId || null,
      uid: window.peerIdToUidMap?.[peerId] || window.connections?.[peerId]?.uid || null,
      callType: call?.type || null,
      signalingState: pc?.signalingState || null,
      connectionState: pc?.connectionState || null,
      iceConnectionState: pc?.iceConnectionState || null,
      screenSharing: !!window.isScreenSharing,
      localScreenTrack: track ? { id: track.id, state: track.readyState, muted: track.muted } : null,
      videoTransceiver: transceiver ? {
        mid: transceiver.mid ?? null,
        direction: transceiver.direction || null,
        currentDirection: transceiver.currentDirection || null,
        senderTrack: transceiver.sender?.track ? {
          id: transceiver.sender.track.id,
          state: transceiver.sender.track.readyState,
          kind: transceiver.sender.track.kind
        } : null
      } : null,
      ...extra,
      timestamp: new Date().toISOString()
    });
  }
  window.foxyScreenDebug = function(enabled = true) {
    window.FOXY_SCREEN_DEBUG = enabled !== false;
    console.info(`[Foxy][screen-diag] detailed logs ${window.FOXY_SCREEN_DEBUG ? "ON" : "OFF"}`);
    return window.FOXY_SCREEN_DEBUG;
  };
  window.foxyScreenDiagDump = function() {
    const peers = new Set([
      ...Object.keys(window.calls || {}),
      ...Object.keys(window.connections || {}),
      ...(window._foxyInlineScreenPeers || []),
      ...(window.currentScreenSource ? [window.currentScreenSource] : [])
    ]);
    const rows = [...peers].map(peerId => getScreenDiagnosticSnapshot(peerId)).filter(row =>
      row.callState || row.dataConnection || row.shareCards.countForOwner
    );
    //FIX: لقطة حية لكل participant — بتقول فين البث واقف بالظبط.
    const liveSnapshots = [...peers].map(peerId => {
      try { return screenWatchSnapshot(peerId, "dump"); } catch (_) { return null; }
    }).filter(Boolean);
    const report = {
      generatedAt: new Date().toISOString(),
      currentScreenSource: window.currentScreenSource || null,
      inlineScreenPeers: [...(window._foxyInlineScreenPeers || [])],
      screenOverlayVisible: !document.getElementById("screen-overlay")?.classList.contains("hidden"),
      totalShareCards: document.querySelectorAll("#participants-list .screen-share-card").length,
      duplicateScreenCardIds: [...document.querySelectorAll("#participants-list .screen-share-card")]
        .map(card => card.id).filter((id, index, all) => all.indexOf(id) !== index),
      peers: rows,
      liveSnapshots,
      recentScreenDiagnostics: (window.__foxyScreenDiagnosticEvents || []).slice(-30),
      recentScreenTrace: (window.__screenTrace || []).slice(-30)
    };
    console.log("[Foxy][screen-diag] report", report);
    return report;
  };
  function pruneScreenViewers() {
    const viewers = window.screenViewers;
    if (!(viewers instanceof Set)) return [];
    const groups = new Map;
    for (const peerId of [...viewers]) {
      const call = window.calls?.[peerId];
      if (!isUsableCall(call)) {
        viewers.delete(peerId);
        continue;
      }
      const uid = window.peerIdToUidMap?.[peerId] || window.connections?.[peerId]?.uid || peerId;
      const group = groups.get(uid) || [];
      group.push(peerId);
      groups.set(uid, group);
    }
    for (const [uid, peerIds] of groups) {
      if (peerIds.length < 2) continue;
      const canonical = window.uidToPeerIdMap?.[uid];
      const keep = peerIds.includes(canonical) ? canonical : peerIds.slice().sort((a, b) => String(a).localeCompare(String(b)))[0];
      peerIds.forEach(peerId => { if (peerId !== keep) viewers.delete(peerId); });
    }
    return [...viewers];
  }
  function resolveScreenControlPeerId(peerId) {
    const uid = window.peerIdToUidMap?.[peerId] || window.connections?.[peerId]?.uid || peerId;
    const candidates = new Set([peerId, window.uidToPeerIdMap?.[peerId], window.uidToPeerIdMap?.[uid]].filter(Boolean));
    Object.keys(window.connections || {}).forEach(candidate => {
      if ((window.connections?.[candidate]?.uid || window.peerIdToUidMap?.[candidate]) === uid) candidates.add(candidate);
    });
    return [...candidates].find(candidate => window.connections?.[candidate]?.conn?.open) || peerId;
  }
  function sendScreenControl(peerId, payload) {
    const target = resolveScreenControlPeerId(peerId);
    if (!window.connections?.[target]?.conn?.open) return false;
    window.sendSignalingCmd?.(target, payload);
    return true;
  }
  function clearScreenJoinRetry(peerId) {
    const timer = inlineJoinRetryTimers.get(peerId);
    if (timer) clearInterval(timer);
    inlineJoinRetryTimers.delete(peerId);
    const call = window.calls?.[peerId];
    if (call) call._foxyInlineScreenRetryTimer = null;
  }
  //FIX: بعد مغادرة المكالمة كان تيمر إعادة محاولة "screen-join-request" بتفضل
  //شغالة وبتبعث طلبات مشاهدة شاشة لزميل لسه في الغرفة، فيقوم الناشر يعلّق
  //الشاشة تاني ويرجّع الاتصال والبطاقات. دلوقتي بنمسح كل حالة المشاهدة
  //المحلية مرة واحدة عند الخروج.
  function resetScreenSessionState(peerId = null) {
    const targets = peerId
      ? [peerId]
      : Array.from(new Set([...inlineJoinRetryTimers.keys(), ...screenCallRecoveryTimers.keys()]));
    targets.forEach(id => {
      if (!id) return;
      clearScreenJoinRetry(id);
      const recovery = screenCallRecoveryTimers.get(id);
      if (recovery) clearInterval(recovery);
      screenCallRecoveryTimers.delete(id);
      failedScreenPreviews.delete(id);
      window._foxyInlineScreenPeers?.delete?.(id);
    });
    if (!peerId) {
      inlineJoinRetryTimers.clear();
      screenCallRecoveryTimers.clear();
      failedScreenPreviews.clear();
      window._foxyInlineScreenPeers?.clear?.();
    }
    if (window._foxyScreenTrackWait) {
      clearInterval(window._foxyScreenTrackWait);
      window._foxyScreenTrackWait = null;
    }
    window.currentScreenSource = null;
    window.currentScreenPeerId = null;
  }
  window.resetScreenSessionState = resetScreenSessionState;
  function startScreenJoinRetry(peerId, call) {
    if (!peerId || !call || inlineJoinRetryTimers.has(peerId)) return;
    let attempts = 0;
    const timer = setInterval(() => {
      // FIX: الـ peerId بيتغير بعد reCallPeer/استبدال MediaConnection،
      // فكل retry لازم يتحل للـ canonical الجديد بدل ما يبعت لعنوان ميت.
      const resolved = resolveScreenCallPeerId(peerId);
      const currentCall = window.calls?.[resolved] || window.calls?.[peerId] || call;
      const effectiveId = window.calls?.[resolved] ? resolved : peerId;
      const isRequestedView = window.currentScreenSource === peerId || window.currentScreenSource === effectiveId
        || window._foxyInlineScreenPeers?.has(peerId) || window._foxyInlineScreenPeers?.has(effectiveId);
      if (!isRequestedView || !isUsableCall(currentCall)) {
        clearScreenJoinRetry(peerId);
        return;
      }
      if (hasLiveRemoteScreenTrack(currentCall)) {
        clearScreenJoinRetry(peerId);
        failedScreenPreviews.delete(effectiveId);
        failedScreenPreviews.delete(peerId);
        window.updateParticipantMediaPreview?.(effectiveId);
        return;
      }
      // FIX: الـ PC لسه بيتصل أو الناشر لسه بيركب التراك — نستنى بدل ما نسبام join-request
      // كانت كل ثانية وتعمل استبدال MediaConnection في loop لا نهائي (26-29 مرة في اللوج).
      const pcState = currentCall?.peerConnection;
      const stillNegotiating = pcState && (pcState.signalingState === "have-local-offer"
        || pcState.signalingState === "have-remote-offer"
        || pcState.connectionState === "connecting" && attempts < 3);
      const attachInFlight = !!currentCall?._foxyScreenAttachPromise;
      if (stillNegotiating || attachInFlight) return;
      attempts++;
      requestScreenJoin(effectiveId, currentCall);
      if (attempts >= 8) {
        clearScreenJoinRetry(peerId);
        failedScreenPreviews.add(effectiveId);
        window._foxyInlineScreenPeers?.delete(effectiveId);
        // FIX: الـ PC متصل لكن مفيش تراك بعد 20 ثانية — غالبا بث ميت
        // (الناشر قفل من غير screen-stopped). امسح العلامة عشان الكارت
        // ميعلقش على "جاري تحميل البث"، وأي screen-ready جديد هيرجعها.
        if (currentCall?.peerConnection?.connectionState === "connected") {
          if (window.connections?.[effectiveId]) { window.connections[effectiveId].screenActive = false; delete window.connections[effectiveId].screenPeerId; }
          try { window.updateParticipantScreenStatus?.(effectiveId, false); } catch (_) {}
        }
        const uid = window.peerIdToUidMap?.[effectiveId] || window.connections?.[effectiveId]?.uid;
        const card = window.getParticipantScreenShareCard?.(effectiveId, uid);
        if (card) card._foxyMediaInlineActive = false;
        screenDiagnostic("inline-track-retry-timeout", effectiveId, currentCall, { attempts, retryWindowMs: attempts * 2500 }, "error");
        window.updateParticipantMediaPreview?.(effectiveId);
      }
    }, 2500);
    inlineJoinRetryTimers.set(peerId, timer);
    call._foxyInlineScreenRetryTimer = timer;
  }
  function recoverScreenMediaCall(peerId, options = {}) {
    if (!peerId || screenCallRecoveryTimers.has(peerId)) return screenCallRecoveryTimers.has(peerId);
    const call = window.calls?.[peerId];
    const pc = call?.peerConnection;
    //FIX: كان لازم تكون قناة الداتا لسه مفتوحة عشان الاسترجاع ينفع. لو
    //قناة الداتا قفلت مع الـ MediaConnection (نفس الـ PC) بقى مفيش وسيلة
    //ن signal بيها — بس recall بيعمل MediaConnection جديدة فيها قناة داتا
    //multiplexed من جديد، فبنسمح بالاسترجاع طول ما Participan لسه معروف.
    const peerKnown = !!(window.connections?.[peerId]
      || window.peerIdToUidMap?.[peerId]
      || window.uidToPeerIdMap?.[peerId]);
    const terminal = !call
      ? (peerKnown || !!window.connections?.[peerId]?.conn?.open)
      : hasFailedCallTransport(call);
    if (!terminal || typeof window.reCallPeer !== "function") return false;

    const inlinePeers = window._foxyInlineScreenPeers || (window._foxyInlineScreenPeers = new Set());
    if (options.inline) inlinePeers.add(peerId);
    else {
      window.currentScreenSource = peerId;
      window.currentScreenPeerId = peerId;
      const video = document.getElementById("screen-video");
      if (video) {
        video.muted = true;
        video.srcObject = null;
      }
      document.getElementById("screen-loading")?.classList.remove("hidden");
      window.showScreenViewUI?.(true);
    }
    failedScreenPreviews.delete(peerId);
    window.foxyLog?.("warn", "[Foxy][screen] إعادة إنشاء اتصال الصوت بعد طلب إعادة محاولة مشاهدة الشاشة", {
      peerId,
      uid: window.peerIdToUidMap?.[peerId] || window.connections?.[peerId]?.uid || null,
      signalingState: pc?.signalingState || "missing",
      connectionState: pc?.connectionState || "missing",
      iceConnectionState: pc?.iceConnectionState || "missing",
      timestamp: new Date().toISOString()
    });
    screenDiagnostic("viewer-call-recovery-start", peerId, call, { inline: !!options.inline, terminal: true }, "warn");
    // This is only called after an explicit click on the retry/watch control.
    // Clear the automatic recall cooldown once so the user's retry can proceed.
    window.clearRecallSlot?.(peerId);
    //FIX: allowReceiveOnly — الشاشة multiplexed على MediaConnection الصوت،
    //فالمشاهد محتاج اتصال وارد بس. من غير الخيار ده recall كان بيفشل فوراً
    //لأن الميكروفون مش متاح ⇒ استرجاع الاتصال مستحيل ⇒ الشير مش بيفتح.
    window.reCallPeer(peerId, "screen-watch-user-retry", { allowReceiveOnly: true });

    let attempts = 0;
    const timer = setInterval(() => {
      const activeView = window.currentScreenSource === peerId || inlinePeers.has(peerId);
      if (!activeView) {
        clearInterval(timer);
        screenCallRecoveryTimers.delete(peerId);
        return;
      }
      const resolvedPeerId = resolveScreenCallPeerId(peerId);
      const recoveredCall = window.calls?.[resolvedPeerId];
      if (isUsableCall(recoveredCall) && recoveredCall.peerConnection.connectionState === "connected") {
        clearInterval(timer);
        screenCallRecoveryTimers.delete(peerId);
        failedScreenPreviews.delete(resolvedPeerId);
        if (options.inline) inlinePeers.add(resolvedPeerId);
        screenDiagnostic("viewer-call-recovery-connected", resolvedPeerId, recoveredCall, { attempts, inline: !!options.inline });
        joinScreenShare(resolvedPeerId, null, { ...options, userInitiated: false, recoveryResume: true });
        return;
      }
      attempts++;
      if (attempts >= 40) {
        clearInterval(timer);
        screenCallRecoveryTimers.delete(peerId);
        failedScreenPreviews.add(peerId);
        if (options.inline) inlinePeers.delete(peerId);
        screenDiagnostic("viewer-call-recovery-timeout", peerId, window.calls?.[peerId], { attempts, inline: !!options.inline }, "error");
        window.foxyLog?.("error", "[Foxy][screen] انتهت مهلة استعادة اتصال الصوت بعد إعادة محاولة المشاهدة", {
          peerId,
          attempts,
          timestamp: new Date().toISOString()
        });
        if (!options.inline && window.currentScreenSource === peerId) window.stopScreenView?.();
        window.updateParticipantMediaPreview?.(peerId);
      }
    }, 500);
    screenCallRecoveryTimers.set(peerId, timer);
    window.updateParticipantMediaPreview?.(peerId);
    return true;
  }
  function resolveScreenCallPeerId(source) {
    const uid = window.peerIdToUidMap?.[source] || window.connections?.[source]?.uid || source;
    const candidates = new Set([source, window.uidToPeerIdMap?.[source], window.uidToPeerIdMap?.[uid]].filter(Boolean));
    Object.keys(window.calls || {}).forEach(peerId => {
      if ((window.peerIdToUidMap?.[peerId] || window.connections?.[peerId]?.uid) === uid) candidates.add(peerId);
    });
    // Keep a live call selected by the UI. Track and quality scores can change
    // during renegotiation, causing retries to jump between aliases of one user.
    if (isUsableCall(window.calls?.[source])) return source;
    const canonicalPeerId = window.uidToPeerIdMap?.[uid] || window.uidToPeerIdMap?.[source];
    if (canonicalPeerId && isUsableCall(window.calls?.[canonicalPeerId])) return canonicalPeerId;
    return [...candidates].filter(peerId => isUsableCall(window.calls?.[peerId]))
      .sort((a, b) => String(a).localeCompare(String(b)))[0]
      || [...candidates].sort((a, b) => String(a).localeCompare(String(b)))[0]
      || source;
  }
  function hasLiveRemoteScreenTrack(call) {
    if (!call) return false;
    //FIX: كان لازم `_foxyRemoteVideoSource === "screen"` أو screenActive في
    //سجل الاتصال. الاتنين بيبطّلوا بعد أي recall/إعادة اتصال (السجل بيتصنع
    //من الصفر) ⇒ البث بيوصل بس التطبيق بيقول "مفيش بث" وبيقفل المشاهدة.
    const knownScreen = call._foxyRemoteVideoSource === "screen"
      || !!window.connections?.[call.peer]?.screenActive
      || !!window.foxyIsWatchedScreenPeer?.(call);
    if (!knownScreen) return false;
    return !!findRenderableScreenTrack(call);
  }
  //FIX: التراك البعيد بيتحوّل لـ unmuted بس عند وصول أول حزمة RTP. قبل كده
  //كنّا بنرفض أي تراك muted ⇒ "جاري تحميل البث" طول الوقت وبعد 20 ثانية
  //بنقفل المشاهدة بحجة فشل. لو الـ transceiver فكّ الكتم مرة واحدة بنعتبره
  //قابل للعرض (المتصفح هيعرض أول ما الإطارات توصل).
  function findRenderableScreenTrack(call) {
    if (!call) return null;
    const tracks = [call.remoteScreenStream, call.remoteVideoStream, call._foxyRemoteVideoStream, call._foxyRemoteScreenStream]
      .flatMap(stream => stream?.getVideoTracks?.() || []);
    //FIX: نستثني الـ track dummy (2×2) اللي بيركّبه PeerJS على الـ
    //transceiver المحجوز — لحد ما الشاشة الحقيقية تتركّب.
    const real = tracks.filter(track => !window.isPlaceholderVideoTrack?.(track));
    const unmuted = real.find(track => track.readyState === "live" && !track.muted);
    if (unmuted) return unmuted;
    if (call._foxyScreenTrackUnmuted) {
      return real.find(track => track.readyState === "live") || null;
    }
    return null;
  }
  function getRemoteScreenStream(call) {
    const candidates = [call?.remoteScreenStream, call?.remoteVideoStream, call?._foxyRemoteVideoStream, call?._foxyRemoteScreenStream].filter(Boolean);
    return candidates.find(stream => stream.getVideoTracks?.().some(track => track.readyState === "live"))
      || candidates.find(stream => stream.getVideoTracks?.().length)
      || candidates[0]
      || null;
  }
  //FIX:-watchdog — لقطة كاملة لحالة المشاهدة كل ثانيتين. بتقول بالظبط فين
  //البث واقف: الـ PC؟ الـ track؟ الـ DOM؟ قناة الداتا؟ مين طلب_join؟
  const watchdogs = new Map();
  function describeVideoElement(el) {
    if (!el) return null;
    return {
      exists: true,
      hasSrc: !!el.srcObject,
      videoTracks: el.srcObject?.getVideoTracks?.().length || 0,
      readyState: el.readyState,
      paused: !!el.paused,
      width: el.videoWidth || 0,
      height: el.videoHeight || 0
    };
  }
  function screenWatchSnapshot(peerId, tag = "tick") {
    const resolved = resolveScreenCallPeerId(peerId);
    const call = window.calls?.[resolved] || window.calls?.[peerId] || null;
    const conn = window.connections?.[resolved] || window.connections?.[peerId] || null;
    const transceiver = call?._foxyVideoTransceiver
      || call?.peerConnection?.getTransceivers?.().find(t => t.receiver?.track?.kind === "video" || t.sender?.track?.kind === "video");
    const card = document.getElementById(`screen-share-card-${peerId}`)
      || document.getElementById(`screen-share-card-${conn?.uid || ""}`)
      || window.getParticipantScreenShareCard?.(peerId, conn?.uid);
    const snap = {
      tag,
      peerId,
      resolvedPeerId: resolved,
      callFound: !!call,
      callRegisteredInWindow: call ? window.calls?.[call.peer] === call : false,
      callPeerId: call?.peer || null,
      pcState: call?.peerConnection?.connectionState || null,
      signalingState: call?.peerConnection?.signalingState || null,
      iceState: call?.peerConnection?.iceConnectionState || null,
      remoteVideoSource: call?._foxyRemoteVideoSource || null,
      screenTrackUnmuted: !!call?._foxyScreenTrackUnmuted,
      remoteVideoTracks: (call?._foxyRemoteVideoStream?.getVideoTracks?.() || []).map(t => ({ id: t.id, state: t.readyState, muted: t.muted })),
      remoteScreenTracks: (call?.remoteScreenStream?.getVideoTracks?.() || []).map(t => ({ id: t.id, state: t.readyState, muted: t.muted })),
      transceiver: transceiver ? {
        mid: transceiver.mid ?? null,
        direction: transceiver.direction || null,
        currentDirection: transceiver.currentDirection || null,
        senderTrack: transceiver.sender?.track ? `${transceiver.sender.track.kind}:${transceiver.sender.track.readyState}` : null
      } : null,
      connType: conn?.conn?.type || null,
      connOpen: !!conn?.conn?.open,
      connHasDataChannel: !!conn?.conn?.dataChannel,
      dataChannelState: conn?.conn?.dataChannel?.readyState || null,
      screenActive: !!conn?.screenActive,
      connectionScreenPeerId: conn?.screenPeerId || null,
      joinRequestedAt: call?._foxyScreenJoinRequestedAt || null,
      joinAttachInFlight: !!call?._foxyScreenAttachPromise,
      currentScreenSource: window.currentScreenSource || null,
      inlinePeers: [...(window._foxyInlineScreenPeers || [])],
      failedPreviews: [...(window._foxyScreenTrackFailedPeers || [])],
      overlayVideo: describeVideoElement(document.getElementById("screen-video")),
      cardVideo: describeVideoElement(card?.querySelector(".media-preview-backdrop")),
      remoteVideoEl: describeVideoElement(document.getElementById(`remote-video-${conn?.uid || peerId}`)),
      timestamp: new Date().toISOString()
    };
    window.foxyLog?.("info", "[Foxy][screen-watch] لقطة", snap);
    //FIX: نسخة نصية مختصرة عشان اللوج المت-collapsed يبقى مفهوم.
    console.info("[Foxy][screen-watch] لقطة |",
      `tag=${snap.tag} peer=${snap.peerId} call=${snap.callFound}/${snap.callRegisteredInWindow} pc=${snap.pcState}/${snap.signalingState} src=${snap.remoteVideoSource} active=${snap.screenActive} vTracks=${snap.remoteVideoTracks.map(t => t.state + (t.muted ? "/muted" : "")).join(",") || "-"} tx=${snap.transceiver ? snap.transceiver.currentDirection + "/mid" + snap.transceiver.mid : "-"} conn=${snap.connType}/${snap.connOpen} dc=${snap.dataChannelState} overlay=${snap.overlayVideo ? (snap.overlayVideo.hasSrc ? snap.overlayVideo.videoTracks + "trk rs=" + snap.overlayVideo.readyState + " " + snap.overlayVideo.width + "x" + snap.overlayVideo.height : "no-src") : "no-el"} card=${snap.cardVideo ? (snap.cardVideo.hasSrc ? snap.cardVideo.videoTracks + "trk" : "no-src") : "no-el"}`);
    window.foxyDiagEvent?.("SCREEN_WATCH_SNAPSHOT", "peer=" + peerId, JSON.stringify(snap));
    return snap;
  }
  window.foxyScreenWatchSnapshot = screenWatchSnapshot;
  function startScreenWatchdog(peerId, durationMs = 30000) {
    if (!peerId) return;
    const existing = watchdogs.get(peerId);
    if (existing) clearInterval(existing);
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
      const snap = screenWatchSnapshot(peerId, `tick${ticks}`);
      const rendered = !!(snap.overlayVideo?.hasSrc && snap.overlayVideo?.videoTracks > 0)
        || !!(snap.cardVideo?.hasSrc && snap.cardVideo?.videoTracks > 0);
      if (rendered || ticks * 2000 >= durationMs) {
        clearInterval(timer);
        watchdogs.delete(peerId);
        window.foxyLog?.(rendered ? "info" : "error", "[Foxy][screen-watch] انتهت المراقبة", {
          peerId, rendered, ticks, ...snap
        });
      }
    }, 2000);
    watchdogs.set(peerId, timer);
    screenWatchSnapshot(peerId, "start");
  }
  function stopScreenWatchdog(peerId) {
    const timer = watchdogs.get(peerId);
    if (timer) clearInterval(timer);
    watchdogs.delete(peerId);
  }
  window.startScreenWatchdog = startScreenWatchdog;
  window.stopScreenWatchdog = stopScreenWatchdog;
  function requestScreenJoin(peerId, call) {
    const now = Date.now();
    if (now - (call?._foxyScreenJoinRequestedAt || 0) < 1200) return false;
    const sent = sendScreenControl(peerId, {
      type: "screen-join-request",
      viewerPeerId: window.peer?.id || window.myId,
      viewerUid: window.state?.myUid || window.myId
    });
    screenDiagnostic("join-request-send", peerId, call, {
      sent,
      signalingPeerId: resolveScreenControlPeerId(peerId),
      viewerPeerId: window.peer?.id || window.myId,
      viewerCountOnLocalShare: window.screenViewers?.size ?? null
    }, sent ? "info" : "warn");
    logScreenFlow("viewer-sent-join-request", peerId, call, {
      sent,
      signalingPeerId: resolveScreenControlPeerId(peerId),
      dataChannelOpen: !!window.connections?.[resolveScreenControlPeerId(peerId)]?.conn?.open
    });
    if (sent && call) call._foxyScreenJoinRequestedAt = now;
    return sent;
  }
  const broadcastVideoStatus = enabled => Object.keys(window.connections || {}).forEach(peerId => {
    window.sendSignalingCmd?.(peerId, { type: "video-status", enabled: !!enabled });
  });
  function getLocalScreenSourceQuality() {
    const track = currentStream()?.getVideoTracks?.()[0];
    const settings = track?.getSettings?.() || {};
    const selectedFps = parseInt(document.getElementById("screen-fps")?.value || "30", 10) || 30;
    return {
      width: Math.round(Number(settings.width) || 0),
      height: Math.round(Number(settings.height) || 0),
      frameRate: Math.round(Number(settings.frameRate) || selectedFps)
    };
  }
  function broadcastScreenSourceQuality() {
    if (!window.isScreenSharing) return false;
    const screenQuality = getLocalScreenSourceQuality();
    Object.keys(window.connections || {}).forEach(peerId => window.sendSignalingCmd?.(peerId, {
      type: "screen-status",
      active: true,
      peerId: window.currentScreenPeerId,
      screenQuality
    }));
    return true;
  }
  window.getLocalScreenSourceQuality = getLocalScreenSourceQuality;
  window.broadcastScreenSourceQuality = broadcastScreenSourceQuality;

  async function replaceActiveScreenStream(stream, oldStream = null) {
    const nextTrack = stream?.getVideoTracks?.()[0];
    if (!nextTrack || !window.isScreenSharing) return false;
    const previous = oldStream || currentStream();
    try { nextTrack.contentHint = parseInt(document.getElementById("screen-fps")?.value || "30", 10) >= 24 ? "motion" : "detail" } catch (_) {}
    const viewers = pruneScreenViewers();
    const previousTrack = previous?.getVideoTracks?.()[0] || null;
    const previousAudioTrack = previous?.getAudioTracks?.()[0] || null;
    const results = await Promise.allSettled(viewers.map(peerId => {
      const call = window.calls?.[peerId];
      return call ? window.replaceCallVideoTrack(call, nextTrack, "screen") : Promise.resolve();
    }));
    const nextAudioTrack = stream.getAudioTracks?.()[0] || null;
    const audioResults = await Promise.allSettled(viewers.map(peerId => {
      const call = window.calls?.[peerId];
      return call && window.replaceCallScreenAudioTrack
        ? window.replaceCallScreenAudioTrack(call, nextAudioTrack)
        : Promise.resolve();
    }));
    const failed = results.filter(result => result.status === "rejected").length + audioResults.filter(result => result.status === "rejected").length;
    if (failed) {
      await Promise.allSettled(viewers.map(async peerId => {
        const call = window.calls?.[peerId];
        if (!call) return;
        if (previousTrack) await window.replaceCallVideoTrack(call, previousTrack, "screen");
        await window.replaceCallScreenAudioTrack?.(call, previousAudioTrack);
      }));
      setStream(previous);
      if (stream && stream !== previous) stream.getTracks().forEach(track => { try { track.stop() } catch (_) {} });
      window.foxyLog?.("warn", "[Foxy][screen] أُلغي تبديل المصدر لأن بعض المشاهدين لم يستطيعوا استقباله", { failed });
      addSystemMsg(window.__fb("js.screen_src_fail", "⚠️ فشل الاتصال بالمصدر المختار"), "warning");
      return false;
    }
    setStream(stream);
    nextTrack.onended = () => window.stopScreenShare?.();
    broadcastScreenSourceQuality();
    if (previous && previous !== stream) previous.getTracks().forEach(track => { try { track.stop() } catch (_) {} });
    addSystemMsg(window.__fb("js.screen_src_changed", "✅ تم تغيير مصدر مشاركة الشاشة"));
    return failed === 0;
  }

  async function finalizeScreenShare() {
    const stream = currentStream();
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return false;
    if (window.isScreenSharing) return replaceActiveScreenStream(stream);

    setStarting(false);
    setStream(stream);
    try { track.contentHint = parseInt(document.getElementById("screen-fps")?.value || "30", 10) >= 24 ? "motion" : "detail" } catch (_) {}
    track.onended = () => window.stopScreenShare?.();
    window.isScreenSharing = true;
    window.currentScreenPeerId = window.myId || window.peer?.id || null;
    window.updateScreenViewerUI?.();

    // The video sender carries one source at a time. Screen takes priority;
    // camera capture can be restored when sharing ends.
    await Promise.allSettled(activeCalls().map(call =>
      call._foxyVideoSource === "camera"
        ? window.replaceCallVideoTrack?.(call, null, "camera")
        : Promise.resolve()
    ));
    broadcastVideoStatus(false);

    Object.keys(window.connections || {}).forEach(peerId => {
      window.sendSignalingCmd?.(peerId, {
        type: "screen-ready",
        name: "function" == typeof window.__foxySelfDisplayName ? window.__foxySelfDisplayName() : window.myName,
        screenPeerId: window.currentScreenPeerId,
        transport: "existing-media-call",
        screenQuality: getLocalScreenSourceQuality()
      });
    });
    // FIX: اللوج أثبت الناشر بياخد getDisplayMedia بنجاح لكن مفيش outbound-video
    // لأن join-request بيضيع (داتا بتقفل/peerId قديم) فمحدش بيعمل attach أبدا.
    // نركب التراك استباقيا على كل المكالمات الشغالة، والـ join-request يبقى تأكيد فقط.
    setTimeout(async () => {
      if (!window.isScreenSharing) return;
      const liveTrack = currentStream()?.getVideoTracks?.()[0];
      if (!liveTrack || liveTrack.readyState !== "live") return;
      const targets = pruneScreenViewers();
      const allUsable = activeCalls().filter(isUsableCall);
      const toAttach = [...new Set([...targets, ...allUsable.map(c => c.peer)])];
      for (const peerId of toAttach) {
        try {
          const call = window.calls?.[peerId];
          if (!isUsableCall(call) || call._foxyVideoSource === "screen") continue;
          if (call._foxyScreenAttachPromise) continue;
          if (call._foxyVideoSource === "camera") await window.replaceCallVideoTrack?.(call, null, "camera").catch(() => {});
          await window.replaceCallVideoTrack?.(call, liveTrack, "screen");
          const st = currentStream()?.getAudioTracks?.()[0] || null;
          await window.replaceCallScreenAudioTrack?.(call, st).catch(() => {});
          window.screenViewers?.add?.(peerId);
          window.setupAdaptiveBitrate?.(call);
          logScreenFlow("publisher-proactive-attached-screen-track", peerId, call, { videoTrackId: liveTrack.id });
        } catch (_) {}
      }
      window.updateScreenViewerUI?.();
    }, 1500);

    document.getElementById("start-screen-trigger")?.classList.add("hidden");
    document.getElementById("screen-active-controls")?.classList.remove("hidden");
    document.getElementById("stop-screen-btn")?.classList.remove("hidden");
    const button = document.getElementById("integrated-screen-btn");
    button?.classList.add("bg-emerald-500/20", "text-emerald-400", "border-emerald-500/30");
    button?.classList.remove("bg-white/5", "text-gray-300", "border-white/10");
    document.getElementById("integrated-screen-live")?.classList.remove("hidden");
    window.syncScreenShareUI?.();
    addSystemMsg(window.__fb("js.screen_sharing_now", "✅ أنت تشارك شاشتك الآن"));
    window.updateGlobalMediaStatus?.(undefined, undefined, true);
    window.updateDmPresence?.();
    window.updateParticipantScreenStatus?.("me", true, window.currentScreenPeerId);
    window.renderMainRoomParticipants?.(window.state?.activeVoiceChannelId);
    if (window._screenPeerAnnounceInterval) clearInterval(window._screenPeerAnnounceInterval);
    window._screenPeerAnnounceInterval = setInterval(() => {
      if (!window.isScreenSharing) return;
      Object.keys(window.connections || {}).forEach(peerId => {
        window.sendSignalingCmd?.(peerId, {
          type: "screen-peer-id-response",
          screenPeerId: window.currentScreenPeerId
        });
        //FIX: "screen-ready" كان بينبعت مرة واحدة بس وقت بداية الشير. لو
        //المشاهد عمل recall أو اتفصل ورجع، سجل connections[peerId] اتصنع من
        //الصفر وبيفقد screenActive ⇒ الواجهة مش عارفة إنه شير ⇒ البطاقة
        //فاضية والبث مش بيظهر. بنعيد الإعلان كل 15 ثانية.
        window.sendSignalingCmd?.(peerId, {
          type: "screen-ready",
          name: "function" == typeof window.__foxySelfDisplayName ? window.__foxySelfDisplayName() : window.myName,
          screenPeerId: window.currentScreenPeerId,
          transport: "existing-media-call",
          screenQuality: getLocalScreenSourceQuality()
        });
      });
    }, 15000);
    // FIX: المتأخر اللي دخل بعد بداية الشير أو اللي join-request بتاعه ضاع
    // (الداتا بتقفل كتير في اللوج) مكنش حد بيركبله التراك أبدا.
    // كل 5 ثواني نركب الشير لأي مكالمة usable لسه مش بتبعت شاشة.
    if (window._screenLateJoinAttachInterval) clearInterval(window._screenLateJoinAttachInterval);
    window._screenLateJoinAttachInterval = setInterval(async () => {
      if (!window.isScreenSharing) return;
      const liveTrack = currentStream()?.getVideoTracks?.()[0];
      if (!liveTrack || liveTrack.readyState !== "live") return;
      for (const call of activeCalls()) {
        try {
          if (!isUsableCall(call) || call._foxyVideoSource === "screen") continue;
          if (call._foxyScreenAttachPromise) continue;
          if (call.peerConnection?.signalingState !== "stable") continue;
          if (call._foxyVideoSource === "camera") await window.replaceCallVideoTrack?.(call, null, "camera").catch(() => {});
          await window.replaceCallVideoTrack?.(call, liveTrack, "screen");
          const st = currentStream()?.getAudioTracks?.()[0] || null;
          await window.replaceCallScreenAudioTrack?.(call, st).catch(() => {});
          window.screenViewers?.add?.(call.peer);
          window.setupAdaptiveBitrate?.(call);
          logScreenFlow("publisher-late-join-attached", call.peer, call, { videoTrackId: liveTrack.id });
        } catch (_) {}
      }
    }, 5000);
    if (window._screenMultiplexStatsInterval) clearInterval(window._screenMultiplexStatsInterval);
    window._screenMultiplexStatsInterval = setInterval(() => window.monitorScreenStats?.(), window.SCREEN_BITRATE?.CHECK_INTERVAL || 1000);
    window.screenTrace?.("multiplex-share-ready", { videoTrackId: track.id, peerCount: activeCalls().length });
    return true;
  }

  async function handleScreenJoinRequest(fromPeerId, requestedViewerPeerId, viewerUidHint) {
    const stream = currentStream();
    const track = stream?.getVideoTracks?.()[0];
    logScreenFlow("publisher-received-join-request", fromPeerId, window.calls?.[fromPeerId], {
      requestedViewerPeerId: requestedViewerPeerId || null,
      viewerUidHint: viewerUidHint || null,
      localTrackPresent: !!track
    });
    if (!window.isScreenSharing || !track) {
      screenDiagnostic("join-request-rejected-no-local-track", fromPeerId, null, {
        isScreenSharing: !!window.isScreenSharing,
        trackState: track?.readyState || "missing",
        requestedViewerPeerId: requestedViewerPeerId || null,
        viewerUidHint: viewerUidHint || null
      }, "warn");
      // FIX: قبل كده كنا نرجع false بصمت، فالمشاهد يفضل "جاري تحميل البث"
      // ويعيد المحاولة 8 مرات على بث ميت أصلا. نرد بالرفض عشان يقفل بسرعة.
      try { window.sendSignalingCmd?.(fromPeerId, { type: "screen-join-failed", reason: "not-sharing" }); } catch (_) {}
      return false;
    }
    const viewerUid = viewerUidHint || window.peerIdToUidMap?.[fromPeerId] || window.connections?.[fromPeerId]?.uid;
    const peerCandidates = [fromPeerId, requestedViewerPeerId, ...Object.keys(window.calls || {}).filter(candidate =>
      viewerUid && (window.peerIdToUidMap?.[candidate] || window.connections?.[candidate]?.uid) === viewerUid
    )].filter((value, index, list) => value && list.indexOf(value) === index);
    const peerId = peerCandidates.find(candidate => isUsableCall(window.calls?.[candidate]))
      || peerCandidates.find(candidate => window.calls?.[candidate]?.peerConnection)
      || fromPeerId;
    const call = window.calls?.[peerId];
    logScreenFlow("publisher-selected-peer-call", peerId, call, {
      fromPeerId,
      requestedViewerPeerId: requestedViewerPeerId || null,
      viewerUid: viewerUid || null,
      candidatePeerIds: peerCandidates
    });
    screenDiagnostic("join-request-call-selected", peerId, call, {
      fromPeerId,
      requestedViewerPeerId: requestedViewerPeerId || null,
      viewerUid: viewerUid || null,
      candidatePeerIds: peerCandidates,
      localScreenTrackState: track.readyState,
      existingViewerCount: window.screenViewers?.size ?? null
    }, isUsableCall(call) ? "info" : "warn");
    if (!isUsableCall(call)) {
      //FIX: تشخيص — لازم نعرف إن المشاهد اختار اتصال ميت. الأولوية بتاعة
      //الاختيار (fromPeerId الأول) ممكن تختار alias قديم.
      window.foxyLog?.("error", "[Foxy][screen-diag] لا يوجد اتصال صوتي صالح مع المشاهد", {
        fromPeerId,
        requestedViewerPeerId: requestedViewerPeerId || null,
        viewerUid: viewerUid || null,
        candidatePeerIds: peerCandidates,
        knownCalls: Object.keys(window.calls || {}),
        connections: Object.keys(window.connections || {}),
        timestamp: new Date().toISOString()
      });
      window.sendSignalingCmd?.(fromPeerId, { type: "screen-join-failed", reason: "voice-call-missing" });
      return false;
    }
    pruneScreenViewers();
    if (viewerUid && window.screenViewers) {
      window.screenViewers.forEach(existingPeerId => {
        const existingUid = window.peerIdToUidMap?.[existingPeerId] || window.connections?.[existingPeerId]?.uid || existingPeerId;
        if (existingPeerId === peerId || existingUid === viewerUid) window.screenViewers.delete(existingPeerId);
      });
    }
    failedScreenPreviews.delete(peerId);
    if (call._foxyScreenAttachPromise) return call._foxyScreenAttachPromise;
    call._foxyScreenAttachPromise = (async () => {
      const previousTrack = call._foxyVideoSender?.track || null;
      const previousSource = call._foxyVideoSource || null;
      try {
        if (call._foxyVideoSource !== "screen" || call._foxyVideoSender?.track !== track) {
          if (call._foxyVideoSource === "camera") await window.replaceCallVideoTrack(call, null, "camera");
          await window.replaceCallVideoTrack(call, track, "screen");
        }
        if (window.replaceCallScreenAudioTrack) {
          try { await window.replaceCallScreenAudioTrack(call, stream.getAudioTracks?.()[0] || null) } catch (_) {}
        }
        window.screenViewers?.add(peerId);
        window.setupAdaptiveBitrate?.(call);
        window.updateScreenViewerUI?.();
        logScreenFlow("publisher-attached-screen-track", peerId, call, {
          senderTrackMatchesCapture: call._foxyVideoSender?.track?.id === track.id,
          senderTrackId: call._foxyVideoSender?.track?.id || null,
          capturedTrackId: track.id,
          viewers: pruneScreenViewers()
        });
        screenDiagnostic("sender-track-attached", peerId, call, {
          source: "screen",
          localTrackId: track.id,
          localTrackState: track.readyState,
          viewers: pruneScreenViewers()
        });
        window.screenTrace?.("multiplex-viewer-attached", { viewerPeerId: peerId });
        return true;
      } catch (error) {
        if (previousTrack?.readyState === "live" && previousSource) {
          try { await window.replaceCallVideoTrack(call, previousTrack, previousSource, { silent: true }) } catch (_) {}
        }
        window.sendSignalingCmd?.(fromPeerId, { type: "screen-join-failed", reason: "replace-track-failed" });
        screenDiagnostic("sender-track-attach-failed", peerId, call, {
          source: "screen",
          errorName: error?.name || null,
          error: error?.message || String(error),
          requestedFromPeerId: fromPeerId
        }, "error");
        window.foxyLog?.("error", "[Foxy][screen] تعذر إرفاق الشاشة بالمرسل المحجوز", { peerId, message: error?.message });
        logScreenFlow("publisher-screen-track-attach-failed", peerId, call, {
          errorName: error?.name || null,
          error: error?.message || String(error),
          requestedFromPeerId: fromPeerId
        });
        return false;
      } finally {
        call._foxyScreenAttachPromise = null;
      }
    })();
    return call._foxyScreenAttachPromise;
  }

  async function handleScreenViewerLeft(peerId, uidHint) {
    const viewerUid = uidHint || window.peerIdToUidMap?.[peerId] || window.connections?.[peerId]?.uid || peerId;
    window.screenViewers?.forEach(viewerPeerId => {
      const uid = window.peerIdToUidMap?.[viewerPeerId] || window.connections?.[viewerPeerId]?.uid || viewerPeerId;
      if (viewerPeerId === peerId || uid === viewerUid) window.screenViewers.delete(viewerPeerId);
    });
    const callPeerId = resolveScreenCallPeerId(peerId);
    const call = window.calls?.[callPeerId] || window.calls?.[peerId];
    if (call?._foxyVideoSource === "screen") {
      try { await window.replaceCallVideoTrack(call, null, "screen") } catch (_) {}
    }
    try { await window.replaceCallScreenAudioTrack?.(call, null) } catch (_) {}
    window.updateScreenViewerUI?.();
  }

  async function stopScreenShare() {
    const oldStream = currentStream();
    setStarting(false);
    window.isScreenSharing = false;
    window.currentScreenPeerId = null;
    if (window._screenPeerAnnounceInterval) clearInterval(window._screenPeerAnnounceInterval);
    window._screenPeerAnnounceInterval = null;
    if (window._screenLateJoinAttachInterval) clearInterval(window._screenLateJoinAttachInterval);
    window._screenLateJoinAttachInterval = null;
    if (window._screenMultiplexStatsInterval) clearInterval(window._screenMultiplexStatsInterval);
    window._screenMultiplexStatsInterval = null;

    await Promise.allSettled(activeCalls().map(call =>
      call._foxyVideoSource === "screen"
        ? window.replaceCallVideoTrack?.(call, null, "screen")
        : Promise.resolve()
    ));
    await Promise.allSettled(activeCalls().map(call => window.replaceCallScreenAudioTrack?.(call, null)));
    Object.keys(window.connections || {}).forEach(peerId => window.sendSignalingCmd?.(peerId, { type: "screen-stopped" }));
    if (oldStream) oldStream.getTracks().forEach(track => { try { track.stop() } catch (_) {} });
    setStream(null);
    window.screenViewers?.clear();
    window.updateScreenViewerUI?.(0);
    if (document.fullscreenElement) document.exitFullscreen?.().catch?.(() => {});

    document.getElementById("start-screen-trigger")?.classList.remove("hidden");
    document.getElementById("screen-active-controls")?.classList.add("hidden");
    document.getElementById("stop-screen-btn")?.classList.add("hidden");
    const button = document.getElementById("integrated-screen-btn");
    button?.classList.add("bg-white/5", "text-gray-300", "border-white/10");
    button?.classList.remove("bg-emerald-500/20", "text-emerald-400", "border-emerald-500/30");
    document.getElementById("integrated-screen-live")?.classList.add("hidden");
    window.syncScreenShareUI?.();
    addSystemMsg(window.__fb("js.screen_stopped", "📺 توقفت مشاركة الشاشة"));
    window.updateGlobalMediaStatus?.(undefined, undefined, false);
    window.updateDmPresence?.();
    window.updateParticipantScreenStatus?.("me", false);
    window.renderMainRoomParticipants?.(window.state?.activeVoiceChannelId);

    if (window.isCameraEnabled && window.ensureCameraCapture) {
      try {
        const cameraTrack = await window.ensureCameraCapture();
        if (cameraTrack) {
          const restoreResults = await Promise.allSettled(activeCalls().map(call => window.replaceCallVideoTrack?.(call, cameraTrack, "camera")));
          const failures = restoreResults.filter(result => result.status === "rejected").length;
          if (failures) window.foxyLog?.("warn", "[Foxy][video] تعذرت استعادة الكاميرا لدى بعض الأقران", { failures });
        }
      } catch (error) {
        window.foxyLog?.("warn", "[Foxy][video] لم تتم استعادة الكاميرا بعد إيقاف الشاشة", { message: error?.message });
      }
    }
    broadcastVideoStatus(!!window.isCameraEnabled);
    window.screenTrace?.("multiplex-share-stopped");
  }

  async function joinScreenShare(source, ignoredScreenPeerId, options = {}) {
    const peerId = resolveScreenCallPeerId(source);
    const call = window.calls?.[peerId];
    screenDiagnostic("viewer-join-start", peerId, call, {
      source: source || null,
      inline: !!options?.inline,
      userInitiated: !!options?.userInitiated,
      recoveryResume: !!options?.recoveryResume
    });
    if (!isUsableCall(call)) {
      //FIX: كنا بنعتبر "مفيش MediaConnection" نهاية الطريق ونعرض رسالة
      //"لازم تتصل صوتياً" ونمشي. بس الشاشة بتتشير على نفس الـ MediaConnection
      //الصوت، فالمشاهد محتاج اتصال وارد — مش لازم يكون عنده صوت.
      //بنحاول نعيد الاتصال (recv-only) قبل ما نISIBLE رسالة الفشل.
      const wantsRecovery = !!(options?.userInitiated || options?.recoveryResume);
      if (wantsRecovery && recoverScreenMediaCall(peerId, options)) return true;
      failedScreenPreviews.add(peerId);
      window._foxyInlineScreenPeers?.delete(peerId);
      const uid = window.peerIdToUidMap?.[peerId] || window.connections?.[peerId]?.uid;
      const card = window.getParticipantScreenShareCard?.(peerId, uid);
      if (card) card._foxyMediaInlineActive = false;
      screenDiagnostic("viewer-join-blocked-no-usable-call", peerId, call, { source: source || null, userInitiated: !!options?.userInitiated, recoveryResume: !!options?.recoveryResume }, "error");
      window.updateParticipantMediaPreview?.(peerId);
      addSystemMsg(window.__fb("js.screen_voice_required", "تعذر فتح البث — جاري إعادة الاتصال بالمشارك..."), "warning");
      return false;
    }
    if (options?.userInitiated && hasFailedCallTransport(call) && recoverScreenMediaCall(peerId, options)) return true;

    if (options?.inline) {
      const inlinePeers = window._foxyInlineScreenPeers || (window._foxyInlineScreenPeers = new Set());
      const alreadyRequested = inlinePeers.has(peerId);
      inlinePeers.add(peerId);
      failedScreenPreviews.delete(peerId);
      if (options.userInitiated) {
        clearScreenJoinRetry(peerId);
        delete call._foxyScreenJoinRequestedAt;
      }
      if (!alreadyRequested || !hasLiveRemoteScreenTrack(call)) requestScreenJoin(peerId, call);
      if (!hasLiveRemoteScreenTrack(call)) startScreenJoinRetry(peerId, call);
      startScreenWatchdog(peerId);
      return true;
    }

    const alreadyViewing = window.currentScreenSource === peerId
      && !document.getElementById("screen-overlay")?.classList.contains("hidden");
    if (alreadyViewing && !options?.recoveryResume) {
      if (!options?.userInitiated || hasLiveRemoteScreenTrack(call)) return true;
      // The old early return swallowed retries when the overlay was already
      // open but its video track had died. A deliberate click should request
      // the track again over the existing media call.
      clearScreenJoinRetry(peerId);
      delete call._foxyScreenJoinRequestedAt;
      failedScreenPreviews.delete(peerId);
    }
    window.currentScreenSource = peerId;
    window.currentScreenPeerId = peerId;
    window.updateScreenViewerUI?.();
    window.showScreenViewUI?.(true);
    const video = document.getElementById("screen-video");
    if (video) {
      // Audio is routed through a dedicated element so the screen volume
      // control cannot affect the peer's microphone playback.
      video.muted = true;
      video.volume = window._foxyScreenVolume ?? 1;
      window.syncScreenAudioControls?.(window._foxyScreenAudioMuted ?? false);
    }
    window.syncRemoteScreenAudioPlayback?.(peerId);
    const loading = document.getElementById("screen-loading");
    const title = document.getElementById("screen-title");
    if (video) video.srcObject = null;
    loading?.classList.remove("hidden");
    if (title) title.textContent = window.__fb("js.screen_stream", "مشاركة الشاشة: ") + (window.connections?.[peerId]?.name || window.__fb("js.participant", "المشارك"));
    if (!hasLiveRemoteScreenTrack(call)) {
      requestScreenJoin(peerId, call);
      startScreenJoinRetry(peerId, call);
    }
    startScreenWatchdog(peerId);

    const showReceivedTrack = () => {
      // FIX: الـ call بتتبدل تحتنا بعد reCallPeer/استبدال MediaConnection،
      // والتراك بيوصل على الـ call الجديدة (sender perf شغال) لكن الانتظار
      // كان بيبص على القديمة فيقفل بـ timeout كاذب. نحل الجديد كل مرة.
      const livePeerId = resolveScreenCallPeerId(peerId);
      const liveCall = window.calls?.[livePeerId] || call;
      const isCurrentView = window.currentScreenSource === peerId || window.currentScreenSource === livePeerId;
      const isInlinePreview = !!window._foxyInlineScreenPeers?.has(peerId) || !!window._foxyInlineScreenPeers?.has(livePeerId);
      if (!isCurrentView && !isInlinePreview) return true;
      const stream = getRemoteScreenStream(liveCall);
      const liveTrack = findRenderableScreenTrack(liveCall);
      if (!liveTrack) {
        if (isInlinePreview) window.updateParticipantMediaPreview?.(livePeerId);
        return false;
      }
      if (liveCall._foxyScreenDiagReceivedTrackId !== liveTrack.id) {
        liveCall._foxyScreenDiagReceivedTrackId = liveTrack.id;
        screenDiagnostic("viewer-track-received", livePeerId, liveCall, {
          trackId: liveTrack.id,
          trackState: liveTrack.readyState,
          muted: liveTrack.muted,
          streamTrackCount: stream?.getTracks?.().length || 0
        });
      }
      delete liveCall._foxyScreenJoinRequestedAt;
      try { delete call._foxyScreenJoinRequestedAt; } catch (_) {}
      clearScreenJoinRetry(peerId);
      clearScreenJoinRetry(livePeerId);
      failedScreenPreviews.delete(peerId);
      failedScreenPreviews.delete(livePeerId);
      if (isCurrentView && video && video.srcObject !== stream) {
        video.muted = true;
        video.srcObject = stream;
        video.play?.().catch?.(() => {});
        window.syncRemoteScreenAudioPlayback?.(livePeerId);
      }
      window.updateParticipantMediaPreview?.(livePeerId);
      if (livePeerId !== peerId) window.updateParticipantMediaPreview?.(peerId);
      if (!isCurrentView) return true;
      loading?.classList.add("hidden");
      if (window._foxyScreenHealthPeer !== livePeerId) {
        window.stopScreenHealthMonitor?.();
        window.startScreenHealthMonitor?.(video);
        window._foxyScreenHealthPeer = livePeerId;
      }
      return true;
    };
    if (window._foxyScreenTrackWait) clearInterval(window._foxyScreenTrackWait);
    let ticks = 0;
    window._foxyScreenTrackWait = setInterval(() => {
      ticks++;
      if (showReceivedTrack() || ticks >= 40) {
        clearInterval(window._foxyScreenTrackWait);
        window._foxyScreenTrackWait = null;
        if (ticks >= 40 && !showReceivedTrack()) {
          loading?.classList.add("hidden");
          const livePeerId = resolveScreenCallPeerId(peerId);
          clearScreenJoinRetry(peerId);
          clearScreenJoinRetry(livePeerId);
          failedScreenPreviews.add(peerId);
          failedScreenPreviews.add(livePeerId);
          window._foxyInlineScreenPeers?.delete(peerId);
          window._foxyInlineScreenPeers?.delete(livePeerId);
          const uid = window.peerIdToUidMap?.[peerId] || window.connections?.[peerId]?.uid;
          const card = window.getParticipantScreenShareCard?.(peerId, uid) || document.getElementById(`screen-share-card-${peerId}`) || document.getElementById(`p-card-${uid}`);
          if (card) card._foxyMediaInlineActive = false;
          screenDiagnostic("viewer-track-timeout", peerId, window.calls?.[peerId] || call, {
            ticks,
            waitMs: ticks * 500,
            overlayStillVisible: !document.getElementById("screen-overlay")?.classList.contains("hidden")
          }, "error");
          if (window.currentScreenSource === peerId) window.stopScreenView?.();
          else {
            sendScreenControl(peerId, { type: "screen-viewer-left", uid: window.state?.myUid || window.myId });
            window.updateParticipantMediaPreview?.(peerId);
          }
          addSystemMsg(window.__fb("js.stream_timeout", "فشل في تحميل البث ❌ (انتهى الوقت)"), "warning");
        }
      }
    }, 500);
    showReceivedTrack();
    return true;
  }

  function closeScreenView(options = {}) {
    const peerId = window.currentScreenSource;
    const keepInline = !!options.keepInline || (!!peerId && window._foxyInlineScreenPeers?.has(peerId));
    if (peerId && !keepInline) sendScreenControl(peerId, {
      type: "screen-viewer-left",
      uid: window.myId || window.state?.myUid
    });
    if (peerId && !keepInline) clearScreenJoinRetry(peerId);
    const keepInlineTrackWait = !!options.keepInline && !!peerId && !!window._foxyInlineScreenPeers?.has(peerId);
    if (!keepInlineTrackWait) {
      if (window._foxyScreenTrackWait) clearInterval(window._foxyScreenTrackWait);
      window._foxyScreenTrackWait = null;
    }
    window.pipManager?.screenPipActive && document.pictureInPictureElement && (document.exitPictureInPicture?.().catch?.(() => {}), window.pipManager.screenPipActive = false, window.pipManager._updateScreenPipButton?.(false));
    if (document.fullscreenElement) document.exitFullscreen?.().catch?.(() => {});
    window.stopScreenHealthMonitor?.();
    window._foxyScreenHealthPeer = null;
    window.showScreenViewUI?.(false);
    const video = document.getElementById("screen-video");
    if (video) {
      try { video.pause() } catch (_) {}
      video.srcObject = null;
    }
    window.currentScreenSource = null;
    window.currentScreenPeerId = null;
    window.syncRemoteScreenAudioPlayback?.(null);
    window.updateScreenViewerUI?.();
    window.renderMainRoomParticipants?.(window.state?.activeVoiceChannelId);
    //FIX: لما المشاهدة تتقفل بالكامل (مش minimise) بنمسح تيمرات إعادة
    //محاولة طلب الشاشة بتاعت الزميل ده، عشان ما تفضلش بتبعث join-request
    //بعد ما نقفل المشاهدة.
    if (!keepInline) resetScreenSessionState(peerId || null);
  }

  function minimizeScreenViewToCard() {
    const source = window.currentScreenSource;
    if (!source) return false;
    const peerId = window.calls?.[source] ? source : window.uidToPeerIdMap?.[source] || source;
    const call = window.calls?.[peerId];
    const isScreen = !!(window._foxyInlineScreenPeers?.has(peerId) || window.connections?.[peerId]?.screenActive || call?._foxyRemoteVideoSource === "screen");
    if (isScreen) {
      const inlinePeers = window._foxyInlineScreenPeers || (window._foxyInlineScreenPeers = new Set());
      if (failedScreenPreviews.has(peerId)) inlinePeers.delete(peerId);
      else inlinePeers.add(peerId);
      const shareCard = window.getParticipantScreenShareCard?.(peerId, window.peerIdToUidMap?.[peerId] || window.connections?.[peerId]?.uid) || document.getElementById(`screen-share-card-${peerId}`);
      if (shareCard) shareCard._foxyMediaInlineActive = !failedScreenPreviews.has(peerId);
    } else {
      const uid = window.peerIdToUidMap?.[peerId] || window.connections?.[peerId]?.uid || source;
      const card = document.getElementById(`p-card-${uid}`) || document.getElementById(`p-card-${peerId}`);
      if (card) {
        card._foxyMediaInlineActive = true;
        card._foxyMediaInlineKind = "camera";
      }
    }
    closeScreenView({ keepInline: true });
    return true;
  }

  function stopScreenView() {
    const source = window.currentScreenSource;
    if (source) {
      const peerId = window.calls?.[source] ? source : window.uidToPeerIdMap?.[source] || source;
      window._foxyInlineScreenPeers?.delete(source);
      window._foxyInlineScreenPeers?.delete(peerId);
      clearScreenJoinRetry(source);
      clearScreenJoinRetry(peerId);
      const uid = window.peerIdToUidMap?.[peerId] || window.connections?.[peerId]?.uid || source;
      const card = document.getElementById(`p-card-${uid}`) || document.getElementById(`p-card-${peerId}`);
      if (card) card._foxyMediaInlineActive = false;
      const shareCard = window.getParticipantScreenShareCard?.(peerId, uid) || document.getElementById(`screen-share-card-${peerId}`);
      if (shareCard) shareCard._foxyMediaInlineActive = false;
    }
    closeScreenView();
    return true;
  }

  window.replaceActiveScreenStream = replaceActiveScreenStream;
  window.finalizeScreenShare = finalizeScreenShare;
  window.handleScreenJoinRequest = handleScreenJoinRequest;
  window.handleScreenViewerLeft = handleScreenViewerLeft;
  window.clearScreenJoinRetry = clearScreenJoinRetry;
  window.sendScreenControl = sendScreenControl;
  window.resolveScreenShareCallPeerId = resolveScreenCallPeerId;
  window.stopScreenShare = stopScreenShare;
  window.joinScreenShare = joinScreenShare;
  window.closeScreenView = closeScreenView;
  window.minimizeScreenViewToCard = minimizeScreenViewToCard;
  window.stopScreenView = stopScreenView;
  const screenOverlay = document.getElementById("screen-overlay");
  screenOverlay?.addEventListener("click", event => {
    if (!window.currentScreenSource) return;
    if (event.target.closest("button, a, input, select, textarea, #screen-top-bar, #fullscreen-controls")) return;
    if (document.fullscreenElement) return;
    if (document.pictureInPictureElement === document.getElementById("screen-video")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    minimizeScreenViewToCard();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && window._screenMultiplexStatsInterval) {
      clearInterval(window._screenMultiplexStatsInterval);
      window._screenMultiplexStatsInterval = null;
    } else if (!document.hidden && window.isScreenSharing && !window._screenMultiplexStatsInterval) {
      window._screenMultiplexStatsInterval = setInterval(() => window.monitorScreenStats?.(), window.SCREEN_BITRATE?.CHECK_INTERVAL || 1000);
    }
    if (!document.hidden) {
      const video = document.getElementById("screen-video");
      if (video?.srcObject) {
        // FIX: عند رجوع visibility، موبايل يعلق video في 1 فريم unless
        // نعيد play() بوضوح.
        try { video.play?.(); } catch (_) {}
        if (video.paused && video.srcObject) video.play().catch(() => {});
      }
    }
  });
})();
