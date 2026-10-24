function getParticipantScreenState(e) {
  const t = window.connections?.[e],
    n = t?.uid || window.peerIdToUidMap?.[e] || e,
    r = [e, ...Object.keys(window.connections || {}).filter(peerId =>
      (window.connections?.[peerId]?.uid || window.peerIdToUidMap?.[peerId]) === n
    )].map(peerId => window.connections?.[peerId]).filter(Boolean),
    i = window.state?.activeChannelPresenceMap?.[n] || window.state?.activeChannelPresenceMap?.[e],
    activeConnection = r.find(connection => connection.screenActive);
  return {
    active: !!(activeConnection || i?.screenSharing),
    peerId: activeConnection?.screenPeerId || r.find(connection => connection.screenPeerId)?.screenPeerId || i?.screenPeerId || `screen-${n}`,
    screenQuality: r.find(connection => connection.screenActive && connection.screenQuality)?.screenQuality
      || r.find(connection => connection.screenQuality)?.screenQuality
      || i?.screenQuality
  }
}

function resolveParticipantPeerId(identity) {
  if (!identity) return "";
  const hasLiveCall = peerId => {
    const pc = window.calls?.[peerId]?.peerConnection;
    return !!pc && pc.signalingState !== "closed" && pc.connectionState !== "closed" && pc.connectionState !== "failed";
  };
  if (hasLiveCall(identity)) return identity;

  const mappedUid = window.peerIdToUidMap?.[identity] || window.connections?.[identity]?.uid;
  const candidates = [window.uidToPeerIdMap?.[identity], mappedUid && window.uidToPeerIdMap?.[mappedUid]];
  for (const candidate of candidates) if (candidate && hasLiveCall(candidate)) return candidate;

  const activeAlias = Object.entries(window.peerIdToUidMap || {}).find(([peerId, uid]) =>
    uid === identity && hasLiveCall(peerId)
  )?.[0];
  if (activeAlias) return activeAlias;
  if (window.connections?.[identity] || window.calls?.[identity]) return identity;
  return candidates.find(Boolean) || identity;
}

function resolveScreenSharePeerId(preferredPeerId, uid) {
  const aliases = new Set([preferredPeerId, window.uidToPeerIdMap?.[uid]].filter(Boolean));
  Object.keys(window.calls || {}).forEach(peerId => {
    if ((window.connections?.[peerId]?.uid || window.peerIdToUidMap?.[peerId]) === uid) aliases.add(peerId);
  });
  const usable = peerId => {
    const pc = window.calls?.[peerId]?.peerConnection;
    return !!pc && pc.signalingState !== "closed" && pc.connectionState !== "closed" && pc.connectionState !== "failed";
  };
  // Keep the call selected by the participant card. Scoring by live tracks or
  // quality made the selected peer ID change while renegotiation was in flight.
  if (preferredPeerId && usable(preferredPeerId)) return preferredPeerId;
  const canonicalPeerId = window.uidToPeerIdMap?.[uid];
  if (canonicalPeerId && usable(canonicalPeerId)) return canonicalPeerId;
  return [...aliases].filter(usable).sort((a, b) => String(a).localeCompare(String(b)))[0]
    || [...aliases].sort((a, b) => String(a).localeCompare(String(b)))[0]
    || preferredPeerId;
}

function ensureMediaPreviewOverlay(card) {
  let overlay = card.querySelector(".media-preview-overlay");
  if (overlay) {
    bindMediaPreviewExpand(card);
    return overlay;
  }

  overlay = document.createElement("div");
  overlay.className = "media-preview-overlay";
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");

  const live = document.createElement("div");
  live.className = "media-preview-live";
  live.innerHTML = '<span class="media-preview-live-dot"></span><span>LIVE</span>';

  const quality = document.createElement("span");
  quality.className = "media-preview-quality";
  quality.hidden = true;

  const status = document.createElement("div");
  status.className = "media-preview-status";
  status.append(live, quality);

  const action = document.createElement("button");
  action.type = "button";
  action.className = "media-preview-watch";
  action.innerHTML = '<svg class="media-preview-watch-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="m10 9 5 3-5 3V9Z" fill="currentColor"/></svg><span class="media-preview-watch-label"></span><svg class="media-preview-watch-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  action.addEventListener("click", event => {
    event.stopPropagation();
    const state = card._foxyMediaPreviewState;
    if (!state) return;
    if (!state.inlineActive) {
      card._foxyMediaInlineActive = true;
      card._foxyMediaInlineKind = state.kind;
      if (state.kind === "screen") {
        window.joinScreenShare?.(state.peerId, state.screenPeerId, { inline: true, userInitiated: true });
      }
      window.updateParticipantMediaPreview?.(state.peerId);
      return;
    }
    expandParticipantMediaCard(card, state);
  });

  const loading = document.createElement("div");
  loading.className = "media-preview-loading";
  loading.hidden = true;
  loading.setAttribute("role", "status");
  loading.innerHTML = '<span class="media-preview-loading-spinner" aria-hidden="true"></span><span class="media-preview-loading-label"></span>';

  const avatar = document.createElement("span");
  avatar.className = "media-preview-avatar";
  avatar.setAttribute("aria-hidden", "true");

  const name = document.createElement("span");
  name.className = "media-preview-name";

  const source = document.createElement("span");
  source.className = "media-preview-source";

  const streamer = document.createElement("div");
  streamer.className = "media-preview-streamer";
  streamer.append(avatar, name, source);

  const moreButton = document.createElement("button");
  moreButton.type = "button";
  moreButton.className = "media-preview-more";
  moreButton.setAttribute("aria-label", window.__fb("js.stream_options", "خيارات البث"));
  moreButton.setAttribute("aria-haspopup", "menu");
  moreButton.setAttribute("aria-expanded", "false");
  moreButton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';

  const menu = document.createElement("div");
  menu.className = "media-preview-menu";
  menu.hidden = true;
  menu.setAttribute("role", "menu");
  menu.addEventListener("click", event => event.stopPropagation());
  menu._foxyMediaPreviewOverlay = overlay;
  menu._foxyMediaPreviewButton = moreButton;
  menu._foxyMediaPreviewCard = card;

  const makeMenuButton = (className, label, action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className || "media-preview-menu-item";
    button.setAttribute("role", "menuitem");
    button.textContent = label;
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      action?.();
    });
    return button;
  };

  const stopWatching = makeMenuButton("media-preview-menu-item is-danger", window.__fb("js.stop_watching", "إيقاف المشاهدة"), () => {
    const state = card._foxyMediaPreviewState;
    if (state) stopParticipantMediaPreview(card, state);
    closeMediaPreviewMenu(menu);
  });
  const muteRow = document.createElement("label");
  muteRow.className = "media-preview-menu-toggle";
  muteRow.innerHTML = `<span>${window.__fb("js.mute", "كتم الصوت")}</span><input class="media-preview-mute" type="checkbox" aria-label="${window.__fb("js.mute", "كتم الصوت")}">`;
  muteRow.addEventListener("click", event => event.stopPropagation());
  muteRow.querySelector("input").addEventListener("change", event => {
    applyParticipantMediaMute(card._foxyMediaPreviewState, event.currentTarget.checked);
  });

  const volumeRow = document.createElement("label");
  volumeRow.className = "media-preview-volume";
  const volumeLabel = document.createElement("span");
  volumeLabel.textContent = window.__fb("js.stream_volume", "مستوى الصوت");
  const volume = document.createElement("input");
  volume.type = "range";
  volume.min = "0";
  volume.max = "100";
  volume.value = "100";
  volume.setAttribute("aria-label", volumeLabel.textContent);
  volume.addEventListener("pointerdown", event => event.stopPropagation());
  volume.addEventListener("click", event => event.stopPropagation());
  volume.addEventListener("input", () => applyParticipantMediaVolume(card._foxyMediaPreviewState, Number(volume.value) / 100));
  volumeRow.append(volumeLabel, volume);

  const pip = makeMenuButton("media-preview-menu-item", window.__fb("js.pop_out_stream", "فتح في نافذة عائمة"), () => {
    const state = card._foxyMediaPreviewState;
    if (!state) return;
    if (!state.inlineActive) {
      state.inlineActive = true;
      card._foxyMediaInlineActive = true;
      card._foxyMediaInlineKind = state.kind;
      if (state.kind === "screen") window.joinScreenShare?.(state.peerId, state.screenPeerId, { inline: true, userInitiated: true });
      window.updateParticipantMediaPreview?.(state.peerId);
    }
    expandParticipantMediaCard(card, state);
    let attempts = 0;
    const openPipWhenReady = () => {
      const video = document.getElementById("screen-video");
      if (video?.srcObject) {
        window.pipManager?.toggleScreenPip?.();
      } else if (++attempts < 12) {
        setTimeout(openPipWhenReady, 100);
      }
    };
    setTimeout(openPipWhenReady, 100);
    closeMediaPreviewMenu(menu);
  });

  const moreOptions = makeMenuButton("media-preview-menu-item has-submenu", window.__fb("js.more_options", "خيارات إضافية"), () => {
    submenu.hidden = !submenu.hidden;
  });
  const submenu = document.createElement("div");
  submenu.className = "media-preview-submenu";
  submenu.hidden = true;
  const diagnostics = makeMenuButton("media-preview-menu-item", window.__fb("js.stream_diagnostics", "تشخيص البث"), () => window.openScreenShareDiagnostics?.());
  const copyStreamId = makeMenuButton("media-preview-menu-item", window.__fb("js.copy_stream_id", "نسخ معرّف البث"), async () => {
    const state = card._foxyMediaPreviewState;
    const value = state?.screenPeerId || state?.peerId;
    if (!value) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(String(value));
      window.showFoxyToast?.({ id: "media-preview-copy-id", tone: "success", title: window.__fb("js.copied", "تم النسخ"), body: String(value), duration: 2500 });
    } catch (_) {
      window.addSystemMsg?.(String(value), "info");
    }
  });
  submenu.append(
    diagnostics,
    copyStreamId
  );

  moreButton.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    const open = menu.hidden;
    document.querySelectorAll(".media-preview-menu:not([hidden])").forEach(other => {
      if (other !== menu) closeMediaPreviewMenu(other);
    });
    if (!open) {
      closeMediaPreviewMenu(menu);
      return;
    }
    menu.hidden = false;
    moreButton.setAttribute("aria-expanded", "true");
    const state = card._foxyMediaPreviewState;
    stopWatching.hidden = !(state?.inlineActive || (state?.kind === "screen" && window._foxyInlineScreenPeers?.has(state.peerId)));
    diagnostics.hidden = state?.kind !== "screen";
    const mute = menu.querySelector(".media-preview-mute");
    const video = document.getElementById("screen-video");
    const peerAudio = state?.peerId && document.getElementById("audio-" + state.peerId);
    mute.checked = state?.kind === "screen"
      ? (window._foxyScreenAudioMuted ?? false)
      : !!peerAudio?.muted;
    volume.value = String(Math.round((state?.kind === "screen" ? (window._foxyScreenVolume ?? video?.volume ?? 1) : (window.connections?.[state?.peerId]?.volumeRatio ?? 1)) * 100));
    submenu.hidden = true;
    const rect = moreButton.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const useBelow = below >= Math.min(260, above) || below >= above;
    const available = Math.max(80, Math.min(320, useBelow ? below : above));
    const top = useBelow ? rect.bottom + 8 : Math.max(8, rect.top - available - 8);
    const left = Math.max(8, Math.min(window.innerWidth - Math.min(240, window.innerWidth - 16) - 8, rect.right - Math.min(240, window.innerWidth - 16)));
    menu.classList.add("is-portal");
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.maxHeight = `${available}px`;
    document.body.appendChild(menu);
  });

  menu.append(stopWatching, muteRow, volumeRow, pip, moreOptions, submenu);
  overlay.append(status, action, streamer, loading, moreButton, menu);
  if (!window._foxyMediaPreviewMenusBound) {
    window._foxyMediaPreviewMenusBound = true;
    document.addEventListener("click", event => {
      document.querySelectorAll(".media-preview-menu:not([hidden])").forEach(openMenu => {
        if (openMenu.contains(event.target) || openMenu._foxyMediaPreviewButton?.contains(event.target)) return;
        closeMediaPreviewMenu(openMenu);
      });
    });
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      document.querySelectorAll(".media-preview-menu:not([hidden])").forEach(openMenu => {
        closeMediaPreviewMenu(openMenu);
      });
    });
  }
  card.appendChild(overlay);
  bindMediaPreviewExpand(card);
  return overlay;
}

function stopParticipantMediaPreview(card, state) {
  if (!card || !state) return;
  if (state.kind === "screen") {
    const inlinePeers = window._foxyInlineScreenPeers;
    inlinePeers?.delete(state.peerId);
    if (window.currentScreenSource === state.peerId || window.currentScreenSource === window.peerIdToUidMap?.[state.peerId]) {
      window.stopScreenView?.();
    } else {
      const message = {
        type: "screen-viewer-left",
        uid: window.state?.myUid || window.myId
      };
      if (window.sendScreenControl) window.sendScreenControl(state.peerId, message);
      else window.sendSignalingCmd?.(state.peerId, message);
    }
  } else if (window.currentScreenSource === state.peerId || window.currentScreenSource === window.peerIdToUidMap?.[state.peerId]) {
    window.closeScreenView?.();
  }
  card._foxyMediaInlineActive = false;
  state.inlineActive = false;
  card.classList.remove("media-preview-inline");
  window.updateParticipantMediaPreview?.(state.peerId);
}

function closeMediaPreviewMenu(menu) {
  if (!menu) return;
  menu.hidden = true;
  const submenu = menu.querySelector(".media-preview-submenu");
  if (submenu) submenu.hidden = true;
  menu.classList.remove("is-portal");
  menu.style.removeProperty("top");
  menu.style.removeProperty("left");
  menu.style.removeProperty("right");
  menu.style.removeProperty("max-height");
  menu._foxyMediaPreviewOverlay?.appendChild(menu);
  menu._foxyMediaPreviewButton?.setAttribute("aria-expanded", "false");
}

function closeMediaPreviewMenuForCard(card) {
  if (!card) return;
  document.querySelectorAll(".media-preview-menu.is-portal").forEach(menu => {
    if (menu._foxyMediaPreviewCard === card) closeMediaPreviewMenu(menu);
  });
}

function applyParticipantMediaMute(state, muted) {
  if (!state) return;
  if (state.kind === "screen") {
    window._foxyScreenAudioMuted = !!muted;
    const video = document.getElementById("screen-video");
    if (!muted && (window._foxyScreenVolume ?? video?.volume ?? 1) <= 0) {
      window._foxyScreenVolume = Math.max(0.05, Math.min(1, Number(window._foxyScreenLastAudibleVolume) || 1));
    }
    if (video) video.muted = true;
    window.applyScreenAudioVolume?.(window._foxyScreenVolume ?? video?.volume ?? 1, { muted: !!muted, peerId: state.peerId });
    window.setRemoteScreenAudioSettings?.({ muted: !!muted, volume: window._foxyScreenVolume ?? video?.volume ?? 1, peerId: state.peerId });
    window.syncScreenAudioControls?.(!!muted);
  } else {
    const audio = document.getElementById("audio-" + state.peerId);
    if (audio) audio.muted = !!muted;
  }
}

function applyParticipantMediaVolume(state, volume) {
  if (!state) return;
  const bounded = Math.max(0, Math.min(1, Number(volume) || 0));
  if (state.kind === "screen") {
    window._foxyScreenVolume = bounded;
    const video = document.getElementById("screen-video");
    if (bounded > 0) {
      window._foxyScreenLastAudibleVolume = bounded;
      window._foxyScreenAudioMuted = false;
    } else {
      window._foxyScreenAudioMuted = true;
    }
    if (video) video.muted = true;
    window.applyScreenAudioVolume?.(bounded, { muted: window._foxyScreenAudioMuted, peerId: state.peerId });
    window.setRemoteScreenAudioSettings?.({ muted: window._foxyScreenAudioMuted, volume: bounded, peerId: state.peerId });
    window.syncScreenAudioControls?.(window._foxyScreenAudioMuted);
  } else if (window.adjustPeerVolume) {
    window.adjustPeerVolume(state.peerId, bounded);
  } else {
    const audio = document.getElementById("audio-" + state.peerId);
    if (audio) audio.volume = bounded;
  }
}

function expandParticipantMediaCard(card, state = card?._foxyMediaPreviewState) {
  if (!card || !state?.inlineActive) return false;
  if (state.kind === "screen") window.joinScreenShare?.(state.peerId, state.screenPeerId, { userInitiated: true });
  else window.watchParticipantCamera?.(state.peerId);
  return true;
}

function bindMediaPreviewExpand(card) {
  if (!card || card._foxyMediaExpandBound) return;
  card._foxyMediaExpandBound = true;
  card.addEventListener("click", event => {
    if (event.target.closest("button, a, input, select, textarea, [role='button'], .media-preview-menu")) return;
    const state = card._foxyMediaPreviewState;
    if (!state?.inlineActive) return;
    event.preventDefault();
    event.stopPropagation();
    expandParticipantMediaCard(card, state);
  });
}

function disposeScreenShareCard(shareCard) {
  if (!shareCard) return;
  closeMediaPreviewMenuForCard(shareCard);
  const video = shareCard.querySelector(".media-preview-backdrop");
  if (video) {
    video.pause();
    video.srcObject = null;
  }
  shareCard.remove();
}

function getParticipantScreenShareCard(peerId, uid, dedupe = true) {
  const identity = new Set([peerId, uid].filter(Boolean).map(String));
  const normalizeUid = value => window.peerIdToUidMap?.[value] || window.connections?.[value]?.uid || value;
  const targetUids = new Set([...identity].map(normalizeUid));
  const prefix = "screen-share-card-";
  const matches = Array.from(document.querySelectorAll(".screen-share-card")).filter(card => {
    const ownerPeer = card.getAttribute("data-screen-owner") || "";
    const ownerUid = card.getAttribute("data-screen-owner-uid") || "";
    const idSuffix = card.id.startsWith(prefix) ? card.id.slice(prefix.length) : "";
    return identity.has(ownerPeer) || identity.has(ownerUid) || identity.has(idSuffix)
      || targetUids.has(normalizeUid(ownerPeer)) || targetUids.has(normalizeUid(ownerUid)) || targetUids.has(normalizeUid(idSuffix));
  });
  if (!matches.length) return null;

  if (matches.length > 1) {
    const ids = matches.map(card => card.id);
    window.foxyLog?.("warn", "[Foxy][screen-diag] توجد بطاقات شير مكررة لنفس المشارك قبل التنظيف", {
      peerId,
      uid,
      count: matches.length,
      duplicateIdCount: ids.length - new Set(ids).size,
      cards: matches.map(card => ({ id: card.id, owner: card.dataset.screenOwner || null, ownerUid: card.dataset.screenOwnerUid || null })),
      timestamp: new Date().toISOString()
    });
    window.foxyDiagEvent?.("SCREEN_DUPLICATE_CARDS", "uid=" + (uid || "unknown"), "count=" + matches.length + " duplicateIds=" + (ids.length - new Set(ids).size));
  }

  const canonicalId = prefix + (uid || peerId);
  matches.sort((a, b) => {
    const aSequence = Number.isFinite(a._foxyPinnedSequence) ? a._foxyPinnedSequence : Number.MAX_SAFE_INTEGER;
    const bSequence = Number.isFinite(b._foxyPinnedSequence) ? b._foxyPinnedSequence : Number.MAX_SAFE_INTEGER;
    return aSequence - bSequence;
  });
  const shareCard = matches[0];
  if (dedupe) {
    matches.slice(1).forEach(disposeScreenShareCard);
    if ((uid || peerId) && shareCard.id !== canonicalId) shareCard.id = canonicalId;
  }
  return shareCard;
}

window.getParticipantScreenShareCard = getParticipantScreenShareCard;

function removeScreenShareCard(uid, peerId) {
  if (peerId && !getParticipantScreenState(peerId).active) window._foxyInlineScreenPeers?.delete(peerId);
  const identity = new Set([uid, peerId].filter(Boolean).map(String));
  const normalizeUid = value => window.peerIdToUidMap?.[value] || window.connections?.[value]?.uid || value;
  const targetUids = new Set([...identity].map(normalizeUid));
  const prefix = "screen-share-card-";
  const matches = Array.from(document.querySelectorAll(".screen-share-card")).filter(card => {
    const idSuffix = card.id.startsWith(prefix) ? card.id.slice(prefix.length) : "";
    const ownerUid = card.getAttribute("data-screen-owner-uid") || "";
    const ownerPeer = card.getAttribute("data-screen-owner") || "";
    return identity.has(ownerUid)
      || identity.has(ownerPeer)
      || identity.has(idSuffix)
      || targetUids.has(normalizeUid(ownerUid))
      || targetUids.has(normalizeUid(ownerPeer))
      || targetUids.has(normalizeUid(idSuffix));
  });
  const removed = matches.length > 0;
  matches.forEach(disposeScreenShareCard);
  if (removed) window.sortParticipantsUI?.();
}

// FIX: بتستخدمها قائمة المشاركين لما العضو يخرج من القناة، عشان كارت
// معاينة الشاشة بتاعه يروح مع كارت العضو فورًا.
window.removeScreenShareCardByUid = function(uid) {
  if (!uid) return;
  try {
    removeScreenShareCard(uid, uid);
  } catch (_) {}
};

function updateDedicatedScreenShareCard(options) {
  const { visible, previewEnabled = true, peerId, uid, memberCard, connection, call, screenState, snapshot } = options;
  const shareCardId = "screen-share-card-" + (uid || peerId);
  let shareCard = null;
  if (!visible) {
    removeScreenShareCard(uid, peerId);
    return;
  }

  const participantsList = document.getElementById("participants-list");
  if (!participantsList) return;
  const exactIdMatches = Array.from(participantsList.querySelectorAll("[id]")).filter(card => card.id === shareCardId);
  if (exactIdMatches.length > 1) {
    window.foxyLog?.("error", "[Foxy][screen-diag] تكرار حرفي لـID بطاقة الشير داخل DOM", {
      id: shareCardId,
      count: exactIdMatches.length,
      ownerPeerIds: exactIdMatches.map(card => card.dataset.screenOwner || null),
      ownerUids: exactIdMatches.map(card => card.dataset.screenOwnerUid || null),
      timestamp: new Date().toISOString()
    });
    window.foxyDiagEvent?.("SCREEN_DUPLICATE_ID", "id=" + shareCardId, "count=" + exactIdMatches.length);
  }
  shareCard = getParticipantScreenShareCard(peerId, uid) || document.getElementById(shareCardId);
  if (!shareCard) {
    shareCard = document.createElement("div");
    shareCard.className = "participant-card group media-preview-active media-preview-screen screen-share-card card-enter";
    window._foxyScreenShareCardSequence = (Number(window._foxyScreenShareCardSequence) || 0) + 1;
    shareCard._foxyPinnedSequence = window._foxyScreenShareCardSequence;
    shareCard.innerHTML = '<video class="media-preview-backdrop" autoplay muted playsinline aria-hidden="true"></video>';
    shareCard.addEventListener("contextmenu", event => {
      const ownerUid = shareCard.getAttribute("data-screen-owner-uid");
      if (!ownerUid) return;
      event.preventDefault();
      event.stopPropagation();
      const name = shareCard.querySelector(".media-preview-name")?.textContent?.trim() || ownerUid;
      window.showMemberContextMenu?.(event, ownerUid, name);
    });
    participantsList.appendChild(shareCard);
    window.foxyDiagEvent?.("SCREEN_CARD_CREATED", "uid=" + (uid || "unknown"), "peer=" + peerId);
    if (window.FOXY_SCREEN_DEBUG || window.FOXY_DEBUG) window.foxyLog?.("info", "[Foxy][screen-diag] إنشاء بطاقة شير", { id: shareCardId, peerId, uid, timestamp: new Date().toISOString() });
  } else if (window.FOXY_SCREEN_DEBUG || window.FOXY_DEBUG) {
    window.foxyLog?.("info", "[Foxy][screen-diag] إعادة استخدام بطاقة الشير الموجودة", { id: shareCard.id, peerId, uid, timestamp: new Date().toISOString() });
  }
  shareCard.id = shareCardId;
  shareCard.setAttribute("data-screen-owner", peerId);
  shareCard.setAttribute("data-screen-owner-uid", uid || peerId);

  const streamVideo = shareCard.querySelector(".media-preview-backdrop");
  const sourceVideo = memberCard.querySelector("video[id^='remote-video-']");
  const streamCandidates = [call?._foxyRemoteScreenStream, call?.remoteScreenStream, call?._foxyRemoteVideoStream, call?.remoteVideoStream, sourceVideo?.srcObject].filter(Boolean);
  //FIX: الـ PeerJS بيركّب track dummy (2×2 أسود) على الـ transceiver المحجوز
  //عشان m=video يتفاوض sendrecv. لازم نستثنيه من الكارت (مش نعرض شاشة سودا
  //ولا نعتبره "البث وصل").
  const _isPlaceholder = track => {
    if (window.isPlaceholderVideoTrack) return !!window.isPlaceholderVideoTrack(track);
    try {
      const s = track?.getSettings?.() || {};
      const w = Number(s.width) || 0, h = Number(s.height) || 0;
      return !!(w && h && w <= 4 && h <= 4);
    } catch (_) { return false; }
  };
  const _hasRealVideo = candidate => !!candidate?.getVideoTracks?.().some(item => !_isPlaceholder(item));
  const stream = streamCandidates.find(candidate => _hasRealVideo(candidate) && candidate.getVideoTracks?.().some(item => item.readyState === "live"))
    || streamCandidates.find(candidate => _hasRealVideo(candidate) && candidate.getVideoTracks?.().length)
    || streamCandidates.find(candidate => _hasRealVideo(candidate))
    || null;
  const previewStream = previewEnabled ? stream : null;
  //FIX: تشخيص — لو البطاقة مالهاش ستريم رغم إن فيه مكالمة، عايزين نعرف
  //فين بالظبط البث واقف (التراك موصلش؟ الـ source مش معروف؟ الـ peerId مختلف؟)
  //ملحوظة: لازم يبقى بعد تعريف inlineActive (كان قبله وبيعمل ReferenceError
  //⇒	updateDedicatedScreenShareCard كان بيقع ⇒ البطاقة مش بتتحدّث خالص).
  if (!previewStream) {
    const _sig = [
      !!call,
      call?._foxyRemoteVideoStream?.getVideoTracks?.().length || 0,
      call?.remoteScreenStream?.getVideoTracks?.().length || 0,
      call?._foxyRemoteVideoSource || "none",
      !!connection?.screenActive,
      previewEnabled
    ].join("|");
    if (shareCard._foxyScreenCardDiagSig !== _sig) {
      shareCard._foxyScreenCardDiagSig = _sig;
      const _diag = {
        peerId,
        uid: uid || null,
        hasCall: !!call,
        callRegistered: call ? window.calls?.[call.peer] === call : false,
        remoteVideoTracks: call?._foxyRemoteVideoStream?.getVideoTracks?.().length || 0,
        remoteScreenTracks: call?.remoteScreenStream?.getVideoTracks?.().length || 0,
        remoteVideoSource: call?._foxyRemoteVideoSource || null,
        screenTrackUnmuted: !!call?._foxyScreenTrackUnmuted,
        connectionScreenActive: !!connection?.screenActive,
        previewEnabled,
        inlineActive: !!(shareCard._foxyMediaInlineActive || window._foxyInlineScreenPeers?.has(peerId)),
        timestamp: new Date().toISOString()
      };
      //FIX: اللوج المت-collapsed بيخفي المعلومات. بنطبع سطر نصي مختصر كمان.
      console.warn("[Foxy][screen-diag] بطاقة معاينة الشير بدون ستريم |",
        `peer=${peerId} call=${!!call} reg=${_diag.callRegistered} vTracks=${_diag.remoteVideoTracks} sTracks=${_diag.remoteScreenTracks} src=${_diag.remoteVideoSource} unmuted=${_diag.screenTrackUnmuted} screenActive=${_diag.connectionScreenActive} inline=${_diag.inlineActive}`);
      window.foxyLog?.("warn", "[Foxy][screen-diag] بطاقة معاينة الشير بدون ستريم", _diag);
    }
  }
  if (streamVideo && streamVideo.srcObject !== previewStream) {
    if (!previewStream) streamVideo.pause();
    streamVideo.srcObject = previewStream;
  }
  if (streamVideo && previewStream && streamVideo.paused) streamVideo.play?.().catch?.(() => {});

  const tracks = stream?.getVideoTracks?.() || [];
  const track = tracks.find(item => item.readyState === "live") || tracks[0];
  //FIX: التراك البعيد بيفضل muted لحد ما أول حزمة RTP توصل. لو اعتمدنا على
  // !muted بس، البطاقة هتفضل "جاري توصيل البث" وبعدين "إعادة محاولة" رغم
  // إن البث واصل. بنقبل أي تراك اتفك كتمه مرة واحدة.
  const seenUnmuted = !!call?._foxyScreenTrackUnmuted;
  const hasPlayableTrack = tracks.some(item => item.readyState === "live" && (!item.muted || seenUnmuted));
  shareCard.classList.toggle("media-preview-has-track", !!track);
  const inlineActive = !!(shareCard._foxyMediaInlineActive || window._foxyInlineScreenPeers?.has(peerId));
  const joinFailed = !!(!hasPlayableTrack && window._foxyScreenTrackFailedPeers?.has(peerId));
  shareCard._foxyMediaInlineActive = inlineActive;
  shareCard._foxyMediaInlineKind = "screen";
  shareCard.classList.toggle("media-preview-inline", inlineActive);

  const memberName = memberCard.querySelector(".participant-name")?.textContent?.trim();
  const name = (memberName && memberName !== "..." ? memberName : "")
    || connection.name || snapshot?.name || window.__fb("js.participant", "المشارك");
  const overlay = ensureMediaPreviewOverlay(shareCard);
  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  const loading = overlay.querySelector(".media-preview-loading");
  if (loading) {
    loading.hidden = !inlineActive || hasPlayableTrack;
    const text = loading.querySelector(".media-preview-loading-label");
    if (text) text.textContent = window.__fb("js.stream_loading", "جاري تحميل البث...");
  }
  const button = overlay.querySelector(".media-preview-watch");
  if (button) {
    button.disabled = false;
    button.setAttribute("aria-label", inlineActive
      ? window.__fb("js.expand_stream", "تكبير البث")
      : joinFailed ? window.__fb("js.retry_stream", "إعادة محاولة الاتصال بالبث")
      : window.__fb("js.watch_stream", "مشاهدة البث"));
  }
  const label = overlay.querySelector(".media-preview-watch-label");
  if (label) label.textContent = joinFailed
    ? window.__fb("js.retry_stream", "إعادة محاولة الاتصال بالبث")
    : inlineActive && !hasPlayableTrack
    ? window.__fb("js.stream_connecting", "جاري توصيل البث...")
    : window.__fb(inlineActive ? "js.expand_stream" : "js.watch_stream", inlineActive ? "تكبير البث" : "مشاهدة البث");
  const nameNode = overlay.querySelector(".media-preview-name");
  if (nameNode) nameNode.textContent = name;
  const sourceNode = overlay.querySelector(".media-preview-source");
  if (sourceNode) sourceNode.textContent = window.__fb("app_voice.screen_share", "مشاركة الشاشة");

  const profileImage = Array.from(memberCard.querySelectorAll(".avatar-fallback img"))
    .find(image => !image.classList.contains("foxy-avatar-fox"));
  const avatar = overlay.querySelector(".media-preview-avatar");
  if (avatar) {
    const imageUrl = profileImage?.currentSrc || profileImage?.src || "";
    const currentImage = avatar.querySelector("img");
    if (imageUrl && (!currentImage || currentImage.src !== imageUrl)) {
      avatar.replaceChildren();
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("error", () => image.remove(), { once: true });
      avatar.appendChild(image);
    } else if (!imageUrl && !currentImage) {
      avatar.textContent = name.slice(0, 1).toUpperCase();
    }
  }

  const sourceQuality = [connection.screenQuality, snapshot?.screenQuality, screenState.screenQuality]
    .find(value => value && (Number(value.height) > 0 || Number(value.frameRate) > 0)) || {};
  const height = Number(sourceQuality.height) || 0;
  const fps = Number(sourceQuality.frameRate) || 0;
  const qualityText = [height ? Math.round(height) + "p" : "", fps ? Math.round(fps) + " FPS" : ""].filter(Boolean).join(" / ");
  const quality = overlay.querySelector(".media-preview-quality");
  if (quality) {
    quality.textContent = qualityText;
    quality.hidden = !qualityText;
  }

  shareCard._foxyMediaPreviewState = {
    kind: "screen",
    peerId,
    screenPeerId: connection.screenPeerId || snapshot?.screenPeerId || screenState.peerId || ("screen-" + peerId),
    inlineActive
  };
  window.sortParticipantsUI?.();
}

function updateParticipantMediaPreview(identity, snapshot = null) {
  let peerId = resolveParticipantPeerId(identity);
  const uid = window.peerIdToUidMap?.[peerId] || window.connections?.[peerId]?.uid || snapshot?.uid || identity;
  const card = document.getElementById(`p-card-${uid}`) || document.getElementById(`p-card-${peerId}`) || document.querySelector(`.participant-card[data-uid="${uid}"]`);
  if (!card) return;

  let connection = window.connections?.[peerId] || window.connections?.[uid] || {};
  let call = window.calls?.[peerId] || window.calls?.[uid];
  const presence = window.state?.activeChannelPresenceMap?.[uid] || window.state?.activeChannelPresenceMap?.[peerId];
  let screenState = {};
  try { screenState = getParticipantScreenState(peerId); } catch (_) {}

  const isSelf = peerId === window.myId || uid === window.myId || uid === window.state?.myUid;
  const isScreen = !isSelf && !!(snapshot?.screenSharing || snapshot?.screenActive || screenState.active || connection.screenActive || presence?.screenSharing);
  const cameraFlag = window.peersVideoStatus?.[peerId] ?? window.peersVideoStatus?.[uid] ?? snapshot?.videoEnabled ?? connection.videoEnabled;
  const isCamera = !isSelf && !isScreen && (!!cameraFlag || call?._foxyRemoteVideoSource === "camera");
  if (isScreen) {
    peerId = resolveScreenSharePeerId(peerId, uid);
    connection = window.connections?.[peerId] || connection;
    call = window.calls?.[peerId] || call;
    try { screenState = getParticipantScreenState(peerId); } catch (_) {}
  }
  const kind = isScreen ? "screen" : isCamera ? "camera" : null;
  if (card._foxyMediaInlineKind && card._foxyMediaInlineKind !== kind) card._foxyMediaInlineActive = false;
  if (kind) card._foxyMediaInlineKind = kind;
  const inlineActive = !!(kind && card._foxyMediaInlineActive);
  const screenOverlay = document.getElementById("screen-overlay");
  const overlayExpanded = !!document.getElementById("participants-list")?.classList.contains("has-active-screen");
  const watching = !!kind && window.currentScreenSource &&
    (window.currentScreenSource === peerId || window.currentScreenSource === uid || resolveParticipantPeerId(window.currentScreenSource) === peerId) &&
    screenOverlay && overlayExpanded;
  const show = !!kind && !watching;

  if (isScreen) {
    card.classList.remove("media-preview-active", "media-preview-screen", "media-preview-camera", "media-preview-has-track");
    card.classList.add("has-screen");
    const oldPreview = card.querySelector(".media-preview-overlay");
    if (oldPreview) {
      oldPreview.hidden = true;
      oldPreview.setAttribute("aria-hidden", "true");
      const oldButton = oldPreview.querySelector(".media-preview-watch");
      if (oldButton) oldButton.disabled = true;
    }
    const video = card.querySelector("video[id^='remote-video-']");
    const videoContainer = card.querySelector("[id^='video-container-']");
    if (!card._foxyScreenPreviewOriginal) {
      card._foxyScreenPreviewOriginal = {
        srcObject: video?.srcObject || null,
        opacity: videoContainer?.style.opacity || "",
        pointerEvents: videoContainer?.style.pointerEvents || ""
      };
    }
    if (video?.srcObject) video.srcObject = null;
    if (videoContainer) {
      videoContainer.style.opacity = "0";
      videoContainer.style.pointerEvents = "none";
    }
    // Keep the dedicated tile mounted while its stream is open in #screen-overlay.
    // Removing it here made it get recreated on minimize, which changed its grid slot.
    updateDedicatedScreenShareCard({ visible: true, previewEnabled: !overlayExpanded, peerId, uid, memberCard: card, connection, call, screenState, snapshot });
    return;
  }

  removeScreenShareCard(uid, peerId);
  card.classList.remove("has-screen");
  if (card._foxyScreenPreviewOriginal) {
    const original = card._foxyScreenPreviewOriginal;
    const video = card.querySelector("video[id^='remote-video-']");
    const videoContainer = card.querySelector("[id^='video-container-']");
    const hasCamera = !!(cameraFlag || call?._foxyRemoteVideoSource === "camera");
    const cameraStream = hasCamera ? (call?._foxyRemoteVideoStream || original.srcObject) : null;
    if (video) video.srcObject = cameraStream || null;
    if (videoContainer) {
      videoContainer.style.opacity = cameraStream ? "1" : "0";
      videoContainer.style.pointerEvents = cameraStream ? "auto" : "none";
    }
    card._foxyScreenPreviewOriginal = null;
  }

  card.classList.toggle("media-preview-active", show);
  card.classList.toggle("media-preview-screen", show && kind === "screen");
  card.classList.toggle("media-preview-camera", show && kind === "camera");
  card.classList.toggle("media-preview-inline", show && inlineActive);
  const overlay = card.querySelector(".media-preview-overlay") || (show ? ensureMediaPreviewOverlay(card) : null);
  if (!overlay) return;
  overlay.hidden = !show;
  overlay.setAttribute("aria-hidden", String(!show));
  const button = overlay.querySelector(".media-preview-watch");
  if (button) button.disabled = !show;
  if (!show) {
    card.classList.remove("media-preview-has-track");
    card._foxyMediaPreviewState = null;
    return;
  }

  const video = card.querySelector("video[id^='remote-video-']");
  const tracks = video?.srcObject?.getVideoTracks?.() || call?._foxyRemoteVideoStream?.getVideoTracks?.() || [];
  const track = tracks.find(item => item.readyState === "live") || tracks[0];
  const hasPlayableTrack = tracks.some(item => item.readyState === "live" && !item.muted);
  card.classList.toggle("media-preview-has-track", !!track);
  const loading = overlay.querySelector(".media-preview-loading");
  if (loading) {
    loading.hidden = !inlineActive || hasPlayableTrack;
    const text = loading.querySelector(".media-preview-loading-label");
    if (text) text.textContent = kind === "screen"
      ? window.__fb("js.stream_loading", "جاري تحميل البث...")
      : window.__fb("js.camera_loading", "جاري تحميل الكاميرا...");
  }

  const memberName = card.querySelector(".participant-name")?.textContent?.trim();
  const name = (memberName && memberName !== "..." ? memberName : "")
    || connection.name || snapshot?.name || window.__fb("js.participant", "المشارك");
  const label = overlay.querySelector(".media-preview-watch-label");
  const actionKey = inlineActive ? "js.expand_stream" : kind === "screen" ? "js.watch_stream" : "js.watch_camera";
  const actionFallback = inlineActive ? "تكبير العرض" : kind === "screen" ? "مشاهدة البث" : "مشاهدة الكاميرا";
  if (button) button.setAttribute("aria-label", window.__fb(actionKey, actionFallback));
  if (label) label.textContent = inlineActive && !hasPlayableTrack
    ? window.__fb("js.stream_connecting", "جاري توصيل البث...")
    : window.__fb(actionKey, actionFallback);
  const nameNode = overlay.querySelector(".media-preview-name");
  if (nameNode) nameNode.textContent = name;
  const sourceNode = overlay.querySelector(".media-preview-source");
  if (sourceNode) sourceNode.textContent = kind === "screen" ? window.__fb("app_voice.screen_share", "مشاركة الشاشة") : window.__fb("app_voice.camera", "الكاميرا");

  const profileImage = Array.from(card.querySelectorAll(".avatar-fallback img"))
    .find(image => !image.classList.contains("foxy-avatar-fox"));
  const avatar = overlay.querySelector(".media-preview-avatar");
  if (avatar) {
    const imageUrl = profileImage?.currentSrc || profileImage?.src || "";
    const currentImage = avatar.querySelector("img");
    if (imageUrl && (!currentImage || currentImage.src !== imageUrl)) {
      avatar.replaceChildren();
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("error", () => image.remove(), { once: true });
      avatar.appendChild(image);
    } else if (!imageUrl && !currentImage) {
      avatar.textContent = name.slice(0, 1).toUpperCase();
    }
  }

  const settings = track?.getSettings?.() || {};
  const height = settings.height || video?.videoHeight || 0;
  const fps = settings.frameRate || 0;
  const qualityText = [height ? `${Math.round(height)}p` : "", fps ? `${Math.round(fps)} FPS` : ""].filter(Boolean).join(" / ");
  const quality = overlay.querySelector(".media-preview-quality");
  if (quality) {
    quality.textContent = qualityText;
    quality.hidden = !qualityText;
  }

  card._foxyMediaPreviewState = {
    kind,
    peerId,
    screenPeerId: connection.screenPeerId || snapshot?.screenPeerId || screenState.peerId || `screen-${peerId}`,
    inlineActive
  };
}

window.updateParticipantMediaPreview = updateParticipantMediaPreview;
window.refreshParticipantMediaPreviews = function() {
  document.querySelectorAll(".participant-card[data-uid]").forEach(card => {
    updateParticipantMediaPreview(card.getAttribute("data-uid"));
  });
};

function addParticipantUI(e, t, n = null) {

  if ("string" != typeof t || !t.trim()) t = "...";
  if ("..." === t && e === (window.state?.myUid || window.myId)) t = window.currentUserProfile?.displayName || window.myName || t;

  const _pUid = window.connections?.[e]?.uid || e;
  const _pRendered = !!(document.getElementById("p-card-" + e) || document.querySelector(`.participant-card[data-uid="${_pUid}"]`));
  window._participantLogThrottle = window._participantLogThrottle || new Map();
  const _pNow = Date.now(), _pLast = window._participantLogThrottle.get(_pUid) || 0;
  if (!_pRendered || _pNow - _pLast > 3e4) {
    window._participantLogThrottle.set(_pUid, _pNow);
    window.foxyLog("info", "[Foxy][participants] إضافة/تحديث مشارك", {
      peerId: e,
      uid: _pUid,
      name: t,
      alreadyRendered: _pRendered,
      connectionState: window.connections?.[e]?.conn?.open ? "open" : window.connections?.[e]?.conn?.connectionState || "unknown",
      timestamp: new Date().toISOString()
    });
  }

  let i = e;
  const _connUid = window.connections?.[e]?.uid;
  if (_connUid && _connUid !== e && !("function" == typeof window.isPeerIdShaped && window.isPeerIdShaped(_connUid))) {
    i = _connUid;
  } else {
    const _r = "function" == typeof window.resolvePeerUid ? window.resolvePeerUid(e, _connUid) : "";
    if (_r) {
      i = _r;
      if (window.connections?.[e]) window.connections[e].uid = _r;
      window.peerIdToUidMap && (window.peerIdToUidMap[e] = _r);
    }
  }
  if (window._participantExitTimers?.[i]) {
    clearTimeout(window._participantExitTimers[i]);
    delete window._participantExitTimers[i];
    window.foxyLog("info", "[Foxy][participants] إلغاء حذف مؤجل بعد عودة المشارك", {peerId:e, uid:i});
  }
  const o = i === (window.state?.myUid || window.myId) ? "me" : i;
  // FIX: في القناة الصوتية خريطة الحضور هي المرجع الوحيد لمن هو في القناة.
  // لو الـ intro وصلنا لعضو مش في الخريطة ⇒ هو خرج (أو اتصال قديم بعد
  // إعادة بناء شبكة) ⇒ منعملوش كارت، وإلا الكارت بيرجع تاني ويعلق.
  if ("me" !== o && window.state?.activeVoiceChannelId) {
    const _pmap = window.state?.activeChannelPresenceMap || {};
    if (Object.keys(_pmap).length && !_pmap[i]) {
      window.foxyLog?.("info", "[Foxy][participants] تجاهل مشارك مش في خريطة الحضور", {
        peerId: e,
        uid: i,
        name: t,
        timestamp: new Date().toISOString()
      });
      return;
    }
  }
  let a = document.getElementById("p-card-" + o) || document.getElementById("p-card-" + e) || document.querySelector(`.participant-card[data-uid="${i}"]`);

  let r = !a;
  if (a && a.classList.contains("card-leave")) {
    a._foxyLeaveTimer && clearTimeout(a._foxyLeaveTimer);
    a._foxyLeaveTimer = null;
    a.classList.remove("card-leave");
    a.style.pointerEvents = "";
    r = !1;
    "function" == typeof window.foxyDiagEvent && window.foxyDiagEvent("CARD_REVIVED", "uid=" + i, "بطاقة كانت في طور المغادرة رجعت قبل ما تتحذف — أُلغي مؤقت الحذف وأُعيد إحياءها");
  }
  r && (a = document.createElement("div"), a.id = "p-card-" + o, a.setAttribute("data-uid", i), a.className = "participant-card group"), a.classList.remove("participant-signal-lost"), a.style.opacity = "1";
  "function" == typeof window.foxyDiagEvent && window.foxyDiagEvent(r ? "CARD_CREATED" : "CARD_UPDATED", "uid=" + i, (r ? "بطاقة جديدة" : "بطاقة موجودة") + " — الاسم المعروض=" + ("..." === t ? "جاري الاتصال..." : t));

  const _shownName = "..." === t ? window.__fb("js.connecting_name", "جاري الاتصال...") : t;
  if (!r) {
    const _nameEl = a.querySelector(".participant-name");
    if (_nameEl && _nameEl.textContent !== _shownName) {
      _nameEl.textContent = _shownName;
      sortParticipantsUI();
    }
  }
  const d = n || window.connections?.[e]?.photoURL || ("me" === o ? auth.currentUser?.photoURL || window.currentUserProfile?.photoURL : null),
    s = "me" === o && window.localPreviewEnabled && (window.isCameraEnabled || window.isScreenSharing),
    c = "me" === o && !s;
  if (r && (a.innerHTML = `\n            \x3c!-- Status LED --\x3e\n            <div id="media-led-${o}" class="card-status-dot bg-emerald-500 hidden"></div>\n\n            \x3c!-- Centered Avatar Container --\x3e\n            <div class="card-avatar-container">\n                <div id="video-container-${o}" class="absolute inset-0 w-full h-full overflow-hidden select-none transition-opacity duration-300" \n                    style="opacity: ${c?"0":"1"}; pointer-events: ${c?"none":"auto"}">\n                    <video id="remote-video-${o}" autoplay playsinline class="w-full h-full object-cover"></video>\n                </div>\n                \n                <div class="avatar-fallback absolute inset-0 flex items-center justify-center bg-[#2b2d31]">\n                    ${window.createAvatarHTML(d,t,{size:"full",withOnError:!0,identity:i,color:("me"===o?window.currentUserProfile?.avatarColor||window.currentUserProfile?.bannerColor:"")||(window.state?.serverMembersData?.[i]?.avatarColor||window.state?.members?.find((m)=>m.id===i||m.uid===i)?.avatarColor||window.getFriendData?.(i)?.avatarColor||window.state?.serverMembersData?.[i]?.bannerColor||window.state?.members?.find((m)=>m.id===i||m.uid===i)?.bannerColor||window.getFriendData?.(i)?.bannerColor||""),extra:"bg-[#2b2d31] text-white/90 text-xl font-black"})}\n                </div>\n            </div>\n\n            \x3c!-- Name Pill --\x3e\n            <div class="card-name-pill">\n                <span class="participant-name text-[11px] font-bold text-white/95 truncate">${"..."===t?window.__fb("js.connecting_name", "جاري الاتصال..."):t}</span>\n                <div id="status-icons-${o}" class="flex gap-1 items-center empty:hidden"></div>\n                <div class="conn-status-tag flex hidden" id="conn-status-${o}"></div>\n            </div>\n\n            \x3c!-- Viewer Count --\x3e\n            <div id="viewer-count-container-${o}" class="absolute top-4 left-4 hidden items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-md text-white rounded-lg border border-white/10 scale-90 transition-all z-20">\n                <svg class="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>\n                <span id="viewer-count-num-${o}" class="text-[10px] font-black">0</span>\n            </div>\n\n            \x3c!-- Screen Action Container --\x3e\n            <div id="screen-btn-container-${o}" class="absolute top-4 right-4 z-30 pointer-events-auto"></div>\n        `, "function" == typeof window.getMemberRoleStyle && "function" == typeof window.getActiveServer)) {
    const e = window.state && window.state.activeServerId || "function" == typeof window.getActiveServer && window.getActiveServer()?.id;
    if (e) {
      const t = window.getMemberRoleStyle(i, e);
      if (t && t.style) {
        const e = a.querySelector(".participant-initial"),
          n = a.querySelector(".participant-name");
        e && e.setAttribute("style", t.style.dot), n && n.setAttribute("style", t.style.text)
      }
    }
  }
  "me" === o && (a.classList.add("cursor-pointer"), a.title = window.__fb("app_voice.toggle_preview_title", "انقر لتفعيل/إخفاء معاينة الكاميرا أو الشاشة"), a.onclick = () => {
    if (window.isCameraEnabled || window.isScreenSharing) {
      if (window.localPreviewEnabled = !window.localPreviewEnabled, window.addSystemMsg) {
        const e = window.isScreenSharing ? window.__fb("app_voice.screen_share", "مشاركة الشاشة") : window.__fb("app_voice.camera", "الكاميرا");
        window.addSystemMsg(window.localPreviewEnabled ? window.__f("js.preview_on", {thing: e}, `تم تفعيل معاينة ${e}`) : window.__f("js.preview_off", {thing: e}, `تم إخفاء معاينة ${e}`), "info")
      }
      const e = window.state && window.state.activeVoiceChannelId,
        n = window.renderMainRoomParticipants || ("undefined" != typeof renderMainRoomParticipants ? renderMainRoomParticipants : null);
      n && e ? n(e) : addParticipantUI(o, t)
    } else window.addSystemMsg && window.addSystemMsg(window.__fb("js.need_cam", "قم بتشغيل الكاميرا أو مشاركة الشاشة أولاً لتفعيل المعاينة."), "warning")
  }, s && setTimeout(() => {
    const e = a.querySelector("video");
    e && (e.srcObject = window.isScreenSharing ? window.localScreenStream : window.localCameraStream)
  }, 50)), r && participantsList.appendChild(a), sortParticipantsUI(), "function" == typeof window.refreshVoiceChannelMembers && window.refreshVoiceChannelMembers(), "function" == typeof window.updateScreenViewerUI && window.updateScreenViewerUI(), updateParticipantMediaPreview(e)
}

function removeParticipantUI(e) {

  try {
    var _cid = (window.connections || {})[e];
    var _cuid = _cid && _cid.uid || e;
    var _pc = (window.calls || {})[e] && (window.calls || {})[e].peerConnection;
    var _pres = (window.state || {}).activeChannelPresenceMap && (window.state || {}).activeChannelPresenceMap[_cuid];
    "function" == typeof window.foxyDiagEvent && window.foxyDiagEvent("CARD_REMOVE", "uid=" + _cuid,
      "طلب حذف البطاقة. dc=" + (_cid && _cid.conn ? (_cid.conn.open ? "open" : "closed") : "none") +
      " pc=" + (_pc ? _pc.connectionState : "none") +
      " presence=" + (_pres ? "موجود" : "غايب") +
      " cardOnScreen=" + (!!(document.getElementById("p-card-" + _cuid) || document.getElementById("p-card-" + e))));
  } catch (_) {}
  window.foxyLog("warn", "[Foxy][participants] إزالة مشارك من الواجهة", {
    peerId: e,
    uid: window.connections?.[e]?.uid || e,
    hasConnection: !!window.connections?.[e],
    timestamp: new Date().toISOString()
  });
  const t = window.connections && window.connections[e] && window.connections[e].uid || e,
    n = t === (window.state?.myUid || window.myId) ? "me" : t,
    i = document.getElementById("p-card-" + n),
    o = document.getElementById("p-card-" + e),
    a = e => {
      e && !e.classList.contains("card-leave") && (closeMediaPreviewMenuForCard(e), e.classList.add("card-leave"), e.style.pointerEvents = "none", e._foxyLeaveTimer = setTimeout(() => {
        e._foxyLeaveTimer = null;
        e.remove(), sortParticipantsUI(), "function" == typeof window.refreshVoiceChannelMembers && window.refreshVoiceChannelMembers()
      }, 250))
    };
  removeScreenShareCard(t, e), i && a(i), o && o !== i && a(o), i || o || (sortParticipantsUI(), "function" == typeof window.refreshVoiceChannelMembers && window.refreshVoiceChannelMembers())
}

function updateRoomCount(e) {
  const t = e + 1;
  roomStatus.innerText = t > 1 ? window.__f("js.online_n", {n: t}, `متصل (${t})`) : window.__fb("web.t030", "أنت وحدك"), callBtn.classList.toggle("hidden", t > 1), hangupBtn.classList.toggle("hidden", 1 === t), "function" == typeof window.refreshVoiceChannelMembers && window.refreshVoiceChannelMembers()
}

function sortParticipantsUI() {
  const e = document.getElementById("participants-list"),
    t = document.getElementById("screen-overlay");
  if (!e) return;
  const orderByUid = window._foxyParticipantOrderByUid || (window._foxyParticipantOrderByUid = new Map());
  const getParticipantOrder = card => {
    const uid = card.getAttribute("data-uid") || card.id.replace("p-card-", "");
    let order = orderByUid.get(uid);
    if (!Number.isFinite(order)) {
      order = (Number(window._foxyParticipantSortSequence) || 0) + 1;
      window._foxyParticipantSortSequence = order;
      orderByUid.set(uid, order);
      while (orderByUid.size > 256) orderByUid.delete(orderByUid.keys().next().value);
    }
    card._foxyParticipantSortOrder = order;
    return order;
  };
  const n = Array.from(e.children).filter(card => card.id && card.id.startsWith("p-card-"));
  // Assign a persistent room order once. Sorting by display name made a
  // participant and their share tile jump whenever an alias/rename arrived.
  n.forEach(getParticipantOrder);
  n.sort((e, t) => {
    const n = e.id.replace("p-card-", ""),
      i = t.id.replace("p-card-", "");
    if ("me" === n) return -1;
    if ("me" === i) return 1;
    return e._foxyParticipantSortOrder - t._foxyParticipantSortOrder
  });

  const shareCandidates = Array.from(e.children).filter(card => card.classList.contains("screen-share-card"));
  const canonicalUid = value => value
    ? String(window.connections?.[value]?.uid || window.peerIdToUidMap?.[value] || value)
    : "";
  const seenShareOwners = new Set;
  shareCandidates.forEach(card => {
    const ownerPeer = card.getAttribute("data-screen-owner") || "";
    const ownerUid = card.getAttribute("data-screen-owner-uid") || "";
    const idSuffix = card.id.startsWith("screen-share-card-") ? card.id.slice("screen-share-card-".length) : "";
    const ownerKey = canonicalUid(ownerUid || ownerPeer || idSuffix);
    if (seenShareOwners.has(ownerKey)) {
      window.foxyLog?.("warn", "[Foxy][screen-diag] إزالة بطاقة شير مكررة للمالك نفسه", {
        ownerKey,
        id: card.id,
        ownerPeer,
        ownerUid,
        timestamp: new Date().toISOString()
      });
      window.foxyDiagEvent?.("SCREEN_CARD_DEDUPED", "uid=" + ownerKey, "id=" + card.id);
      disposeScreenShareCard(card);
      return;
    }
    seenShareOwners.add(ownerKey);
  });
  if (t?.parentElement === e && document.fullscreenElement === t) {
    // Moving descendants around a fullscreen element can reshuffle grid slots
    // even if the fullscreen node itself is skipped by insertBefore.
    const count = String(e.children.length - 1);
    if (e.getAttribute("data-count") !== count) e.setAttribute("data-count", count);
    return;
  }
  const shareCards = Array.from(e.children)
    .filter(card => card.classList.contains("screen-share-card"))
    .sort((a, b) => (a._foxyPinnedSequence ?? 0) - (b._foxyPinnedSequence ?? 0));
  const participantByUid = new Map(n.map(card => {
    const uid = card.getAttribute("data-uid") || card.id.slice("p-card-".length);
    return [canonicalUid(uid), card];
  }));
  const sharesByOwner = new Map;
  const orphanShares = [];
  shareCards.forEach(card => {
    const ownerUid = canonicalUid(card.getAttribute("data-screen-owner-uid")
      || card.getAttribute("data-screen-owner")
      || card.id.slice("screen-share-card-".length));
    const ownerCard = participantByUid.get(ownerUid);
    if (!ownerCard) {
      orphanShares.push(card);
      return;
    }
    const ownerShares = sharesByOwner.get(ownerCard) || [];
    ownerShares.push(card);
    sharesByOwner.set(ownerCard, ownerShares);
  });
  // Keep all participant cards first and group every share tile together at
  // the end of the grid, regardless of its owner's position or reconnect order.
  const orderedShareCards = [...sharesByOwner.values()].flat().concat(orphanShares)
    .sort((a, b) => (a._foxyPinnedSequence ?? Number.MAX_SAFE_INTEGER) - (b._foxyPinnedSequence ?? Number.MAX_SAFE_INTEGER));

  const cardSet = new Set([...n, ...shareCards]);
  const otherChildren = Array.from(e.children).filter(child => child !== t && !cardSet.has(child));
  const orderedChildren = [...(t?.parentElement === e ? [t] : []), ...n, ...otherChildren, ...orderedShareCards];
  orderedChildren.forEach((child, idx) => {
    if (e.children[idx] !== child && !(child === t && document.fullscreenElement === t)) {
      e.insertBefore(child, e.children[idx] || null);
    }
  });
  const _c = String(e.children.length - (t ? 1 : 0));

  if (e.getAttribute("data-count") !== _c) e.setAttribute("data-count", _c)
}

function updateHostUI(e, t, n) {
  sortParticipantsUI(), "function" == typeof window.refreshVoiceChannelMembers && window.refreshVoiceChannelMembers()
}

function updatePlayerStatusUI(e, t, n, i = !1, o = !1, a = !1) {
  let r = e,
    d = document.getElementById("p-card-" + r);
  if (!d && window.peerIdToUidMap && window.peerIdToUidMap[e] && (r = window.peerIdToUidMap[e], d = document.getElementById("p-card-" + r)), !d) return;
  let s = d.querySelector("#status-icons-" + r);
  if (!s) return;
  if (d.classList.toggle("speaking", i), null !== t) {
    let e = document.getElementById(`mic-icon-${r}`);
    t ? (e || (e = document.createElement("span"), e.id = `mic-icon-${r}`, e.innerHTML = MIC_OFF_SVG, s.insertBefore(e, s.firstChild)), e.className = o ? "text-red-500" : "text-gray-500") : e?.remove()
  }
  if (null !== n) {
    let e = document.getElementById(`deaf-icon-${r}`);
    n ? (e || (e = document.createElement("span"), e.id = `deaf-icon-${r}`, e.innerHTML = DEAFEN_SVG_SLASH, s.appendChild(e)), e.className = a ? "text-red-500" : "text-gray-500") : e?.remove()
  }
  const c = "me" === r || r === window.myId || e === window.myId,
    l = c ? window.isCameraEnabled : void 0 !== window.peersVideoStatus && window.peersVideoStatus[e],
    w = document.getElementById(`video-container-${r}`),
    p = document.getElementById(`remote-video-${r}`),
    u = document.getElementById(`screen-btn-container-${r}`);
  let m = document.getElementById(`video-icon-status-${r}`);
  if (l) {
    if (d.classList.add("has-video"), m || (m = document.createElement("span"), m.id = `video-icon-status-${r}`, m.innerHTML = '<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>', s.appendChild(m)), w)
      if (c) w.style.opacity = "1", w.style.pointerEvents = "auto", (window.localCameraStream || window.localScreenStream) && p && p.srcObject !== (window.isScreenSharing ? window.localScreenStream : window.localCameraStream) && (p.srcObject = window.isScreenSharing ? window.localScreenStream : window.localCameraStream, p.muted = !0, p.isConnected && p.play().catch(e => {
        e.name
      })), u && "live" !== u.getAttribute("data-state") && (u.setAttribute("data-state", "live"), u.innerHTML = '<div class="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-md border border-emerald-500/30">\n                            <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>\n                            <span class="text-[9px] font-black uppercase">LIVE VIDEO</span>\n                        </div>');
      else {
        const t = document.getElementById(`remote-video-${r}`),
          n = !(!t || !t.srcObject),
          i = l && n;
        w.style.opacity = i ? "1" : "0", w.style.pointerEvents = i ? "auto" : "none";
        const o = document.getElementById("p-card-" + r),
          a = o ? o.querySelector(".participant-initial") : null;
        if (a && (a.style.opacity = "1", a.style.pointerEvents = "auto"), u) {
          const t = e;
          connections[t]?.screenActive || window.peerIdToUidMap && connections[window.uidToPeerIdMap?.[t]]?.screenActive ? "screen-watch" !== u.getAttribute("data-state") && (u.setAttribute("data-state", "screen-watch"), u.innerHTML = `\n                                    <button onclick="window.joinScreenShare('${t}', 'screen-${t}', {userInitiated:true})" \n                                        class="flex items-center gap-1 px-2 py-1 bg-emerald-500 text-white rounded-md text-[10px] font-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all">\n                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>\n                                        <span>${window.__fb("js.watch", "مشاهدة")}</span>\n                                    </button>\n                                `) : "watch" !== u.getAttribute("data-state") && (u.setAttribute("data-state", "watch"), u.innerHTML = `\n                                <button onclick="window.watchParticipantCamera('${e}')" \n                                    class="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500 text-white rounded-md text-[10px] font-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all">\n                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>\n                                    <span>${window.__fb("js.watch", "مشاهدة")}</span>\n                                </button>\n                            `)
        }
      }
  } else {
    d.classList.remove("has-video"), m && m.remove(), w && (w.style.opacity = "0", w.style.pointerEvents = "none", p && (p.srcObject = null));
    const t = getParticipantScreenState(e).active;
    u && (t && !c ? "screen-watch" !== u.getAttribute("data-state") && (u.setAttribute("data-state", "screen-watch"), u.innerHTML = `\n                            <button onclick="window.joinScreenShare('${e}', 'screen-${e}', {userInitiated:true})" \n                                class="flex items-center gap-1 px-2 py-1 bg-emerald-500 text-white rounded-md text-[10px] font-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all">\n                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>\n                                <span>${window.__fb("js.watch", "مشاهدة")}</span>\n                            </button>\n                        `) : t || "" === u.innerHTML || (u.setAttribute("data-state", "none"), u.innerHTML = ""))
  }
  const h = getParticipantScreenState(e).active;
  d.classList.toggle("has-screen", !!h), updateParticipantMediaPreview(e)
}
window.updateMediaLed = function(e, t, n = null) {
  const i = document.getElementById("media-led-" + e),
    o = document.getElementById("p-card-" + e);
  if (!i) return;
  i.className = `card-status-dot ${{connected:"bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]",poor_quality:"bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]",fair_quality:"bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]",checking:"bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]",failed:"bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]",none:"bg-gray-600",signal_lost:"bg-amber-500 animate-pulse"}[t]||"bg-gray-600"} transition-all duration-300`, i.classList.toggle("hidden", "none" === t);
  let a = {
    connected: window.__fb("js.q_excellent", "جودة الاتصال ممتازة"),
    poor_quality: window.__fb("js.q_poor", "جودة الاتصال ضعيفة (فقدان حزم أو تأخير)"),
    fair_quality: window.__fb("js.q_mid", "جودة الاتصال متوسطة"),
    checking: window.__fb("js.q_checking", "جاري التحقق من الاتصال..."),
    failed: window.__fb("js.q_failed", "فشل الاتصال"),
    signal_lost: window.__fb("js.q_lost", "فقدت الإشارة، جاري إعادة المحاولة...")
  } [t] || "";
  if (!n || "connected" !== t && "poor_quality" !== t && "fair_quality" !== t || (a += `\n(RTT: ${n.rtt}ms | Loss: ${n.loss}% | Jitter: ${n.jitter}ms | Conceal: ${null != n.concealed ? n.concealed : "?"}%)`), i.title = a, o) {
    const n = document.getElementById("conn-status-" + e);
    const _isLost = "signal_lost" === t || "failed" === t;
    _isLost ? (o.classList.add("participant-signal-lost"), o.style.opacity = "0.7", n && (n.textContent = window.__fb("js.reconnecting", "(جاري إعادة الاتصال)"), n.classList.remove("hidden"))) : (o.classList.remove("participant-signal-lost"), o.style.opacity = "1", n && (n.textContent = "", n.classList.add("hidden")))
  }
}, window.updateParticipantViewerCount = function(e, t) {
  let n = document.getElementById("viewer-count-container-" + e),
    i = document.getElementById("viewer-count-num-" + e);
  if ("me" === e || e === window.myId) {
    if (!n) {
      const t = document.getElementById("p-card-" + e);
      if (t) {
        const o = t.querySelector(".absolute.inset-0");
        o && (n = document.createElement("div"), n.id = "viewer-count-container-" + e, n.className = "absolute top-2 right-2 hidden flex items-center gap-1.5 px-2 py-0.5 bg-black/60 backdrop-blur-md text-white rounded-lg border border-white/10 shadow-lg scale-90 origin-top-right transition-all", n.innerHTML = `\n                        <svg class="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />\n                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />\n                        </svg>\n                        <span id="viewer-count-num-${e}" class="text-[10px] font-black">0</span>\n                    `, o.appendChild(n), i = n.querySelector("#viewer-count-num-" + e))
      }
    }
    if (n && !n._foxyViewerModalBound) {
      n._foxyViewerModalBound = true;
      n.classList.add("cursor-pointer");
      n.title = window.__fb("js.viewer_list", "اضغط لمشاهدة قائمة المشاهدين");
      n.setAttribute("role", "button");
      n.tabIndex = 0;
      n.addEventListener("click", event => {
        event.stopPropagation();
        window.showScreenViewersModal?.();
      });
      n.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        window.showScreenViewersModal?.();
      });
    }
    n && i && (t > 0 ? (i.textContent = t, n.classList.remove("hidden"), n.classList.add("flex")) : (n.classList.add("hidden"), n.classList.remove("flex")))
  } else n && n.classList.add("hidden")
}, window.toggleParticipantWatchingMe = function(e, t) {
  let n = document.getElementById("watching-me-eye-" + e);
  if (!n) {
    const t = document.getElementById("p-card-" + e);
    if (t) {
      const i = t.querySelector(".absolute.inset-0");
      i && (n = document.createElement("div"), n.id = "watching-me-eye-" + e, n.className = "absolute top-2 right-2 hidden items-center justify-center p-1 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30 shadow-lg scale-90 origin-top-right transition-all animate-pulse", n.title = window.__fb("js.watching_you", "هذا المستخدم يشاهد شاشتك"), n.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>', i.appendChild(n))
    }
  }
  n && (n.classList.toggle("hidden", !t), n.classList.toggle("flex", t))
}, window.addParticipantUI = addParticipantUI, window.removeParticipantUI = removeParticipantUI, window.updateRoomCount = updateRoomCount, window.sortParticipantsUI = sortParticipantsUI, window.updateHostUI = updateHostUI, window.updatePlayerStatusUI = updatePlayerStatusUI, window.updateMediaLed = updateMediaLed, window.updateParticipantViewerCount = updateParticipantViewerCount, window.toggleParticipantWatchingMe = toggleParticipantWatchingMe;

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) requestAnimationFrame(sortParticipantsUI);
});

function observeParticipantCardOrder() {
  const list = document.getElementById("participants-list");
  if (!list) {
    document.addEventListener("DOMContentLoaded", observeParticipantCardOrder, { once: true });
    return;
  }
  if (list._foxyCardOrderObserver) return;

  let sortScheduled = false;
  const scheduleSort = () => {
    if (sortScheduled) return;
    sortScheduled = true;
    requestAnimationFrame(() => {
      sortScheduled = false;
      sortParticipantsUI();
    });
  };
  list._foxyCardOrderObserver = new MutationObserver(records => {
    if (records.some(record => record.type === "childList" && (record.addedNodes.length || record.removedNodes.length))) {
      scheduleSort();
    }
  });
  list._foxyCardOrderObserver.observe(list, { childList: true });
  // Run once after installing the observer so cards already present in the
  // DOM are corrected too; later additions (including async participant cards)
  // get the same final ordering after their render completes.
  scheduleSort();
}

observeParticipantCardOrder();
