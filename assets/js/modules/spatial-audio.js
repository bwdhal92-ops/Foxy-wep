const spatialAudio = (() => {

  const state = {
    enabled: false,
    blend: 0.5,
    roomSize: 50,
    placementMode: 'arc',
    gridSize: 300,
    gridPadding: 40,
    peers: new Map(),
    positions: new Map(),
    audioCtx: null,
    pannerNodes: new Map(),
    stereoPannerNodes: new Map(),
    gainNodes: new Map(),
    masterGain: null,
    listenerNode: null,
    animationFrame: null,
    observerInterval: null,
    isRendering: false,
    muteTimeouts: new Map(),
    dragPeerId: null,
    dragTargetPos: {
      x: 0,
      y: 0
    },
    listenerX: 150,
    listenerY: 260,
    initialized: false,
    zoom: 1,
    panX: 0,
    panY: 0,

    renderRequested: false,
    waveTime: 0,
    uiElements: null,
    panLatestClientX: 0,
    panLatestClientY: 0,
    panPrevProcessedX: 0,
    panPrevProcessedY: 0,
    audioCtxDenied: false
  };

  const avatarImageCache = new Map();
  const AVATAR_CACHE_MAX = 100;

  let foxyMaskImage = null;
  let foxyMaskCallbacks = [];
  function getFoxyMaskImage(onLoaded) {
    if (foxyMaskImage && foxyMaskImage.complete && foxyMaskImage.naturalWidth > 0) return foxyMaskImage;
    if (!foxyMaskImage) {
      foxyMaskImage = new Image();
      foxyMaskImage.onload = () => {
        const cbs = foxyMaskCallbacks;
        foxyMaskCallbacks = [];
        cbs.forEach(cb => { try { cb(); } catch (_) {} });
      };
      foxyMaskImage.onerror = () => { foxyMaskImage = null; };
      foxyMaskImage.src = (window.FOXY_AVATAR_MASK || "assets/img/foxy-mask.png");
    }
    if (onLoaded) foxyMaskCallbacks.push(onLoaded);
    return foxyMaskImage;
  }

  function getCachedAvatarImage(url, onLoaded) {
    if (!url) return null;
    const isSameOrigin = url.startsWith("/") || url.startsWith(window.location.origin);
    const isGif = /\.gif/i.test(url) || /\/[^\/]*gif[^\/]*$/i.test(url);
    const finalUrl = isSameOrigin ? url : `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=40&h=40&fit=cover${isGif ? '' : '&output=webp'}`;

    if (avatarImageCache.has(finalUrl)) {
      const entry = avatarImageCache.get(finalUrl);
      if (entry.loaded) return entry.img;
      if (entry.failed) return null;
      if (onLoaded && !entry.callbacks.includes(onLoaded)) {
        entry.callbacks.push(onLoaded);
      }
      return entry.img;
    }

    const img = new Image();
    const entry = {
      img,
      loaded: false,
      failed: false,
      callbacks: onLoaded ? [onLoaded] : []
    };
    if (avatarImageCache.size >= AVATAR_CACHE_MAX) {
      const firstKey = avatarImageCache.keys().next().value;
      if (firstKey !== undefined) {
        const evicted = avatarImageCache.get(firstKey);
        if (evicted && !evicted.loaded && !evicted.failed) {
          evicted.img.src = '';
        }
        avatarImageCache.delete(firstKey);
      }
    }
    avatarImageCache.set(finalUrl, entry);
    img.crossOrigin = "anonymous";
    img.onload = () => {
      entry.loaded = true;
      entry.callbacks.forEach(cb => {
        try {
          cb();
        } catch (e) {}
      });
      entry.callbacks = [];
    };
    img.onerror = () => {
      entry.failed = true;
      entry.callbacks = [];
    };
    img.src = finalUrl;
    return null;
  }

  function initAudioContext() {
    if (state.audioCtx) return;
    state.audioCtx = new(window.AudioContext || window.webkitAudioContext)();

    state.audioCtx.onstatechange = () => {
      if (state.enabled && state.audioCtx.state === 'suspended') {
        state.audioCtx.resume().catch(() => {
          state.audioCtxDenied = true;
          showAudioResumeButton();
        });
      }
      if (state.audioCtx.state === 'running' && state.audioCtxDenied) {
        state.audioCtxDenied = false;
        hideAudioResumeButton();
      }
    };
    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', () => {
        if (state.enabled && state.audioCtx && state.audioCtx.state === 'suspended' && !state.audioCtxDenied) {
          state.audioCtx.resume().catch(() => {
            state.audioCtxDenied = true;
            showAudioResumeButton();
          });
        }
      });
    }

    state.masterGain = state.audioCtx.createGain();
    state.masterGain.gain.setValueAtTime(1, state.audioCtx.currentTime);
    state.masterGain.connect(state.audioCtx.destination);

    const listener = state.audioCtx.listener;
    const now = state.audioCtx.currentTime;
    if (listener.positionX) {
      listener.positionX.setValueAtTime(0, now);
      listener.positionY.setValueAtTime(0, now);
      listener.positionZ.setValueAtTime(0, now);
      listener.forwardX.setValueAtTime(0, now);
      listener.forwardY.setValueAtTime(1, now);
      listener.forwardZ.setValueAtTime(-1, now);
      listener.upX.setValueAtTime(0, now);
      listener.upY.setValueAtTime(0, now);
      listener.upZ.setValueAtTime(1, now);
    } else {
      listener.positionX.value = 0;
      listener.positionY.value = 0;
      listener.positionZ.value = 0;
    }
    state.listenerNode = listener;
  }

  function getOrCreatePanner(peerId) {
    if (state.pannerNodes.has(peerId)) return state.pannerNodes.get(peerId);
    if (!state.audioCtx) return null;
    const stereoPanner = state.audioCtx.createStereoPanner();
    stereoPanner.pan.setValueAtTime(0, state.audioCtx.currentTime);
    const gainNode = state.audioCtx.createGain();
    gainNode.gain.setValueAtTime(1, state.audioCtx.currentTime);
    const panner = state.audioCtx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 10000;
    panner.rolloffFactor = 1;
    const now = state.audioCtx.currentTime;
    panner.positionX.setValueAtTime(0, now);
    panner.positionY.setValueAtTime(0, now);
    panner.positionZ.setValueAtTime(1, now);
    stereoPanner.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(state.masterGain);
    state.stereoPannerNodes.set(peerId, stereoPanner);
    state.gainNodes.set(peerId, gainNode);
    state.pannerNodes.set(peerId, panner);
    return panner;
  }

  function connectStreamToPanner(peerId, stream) {
    if (!state.audioCtx || !stream) return;
    getOrCreatePanner(peerId);
    const stereoPanner = state.stereoPannerNodes.get(peerId);
    if (!stereoPanner) return;
    try {
      if (state.peers.has(peerId)) {
        const oldData = state.peers.get(peerId);
        if (oldData.source) oldData.source.disconnect();
      }
      const source = state.audioCtx.createMediaStreamSource(stream);
      source.connect(stereoPanner);
      state.peers.set(peerId, {
        stream,
        source
      });
    } catch (e) {
      console.warn('[SpatialAudio] Could not connect stream:', peerId, e);
    }
  }

  function disconnectPeer(peerId) {
    if (state.muteTimeouts.has(peerId)) {
      clearTimeout(state.muteTimeouts.get(peerId));
      state.muteTimeouts.delete(peerId);
    }
    const data = state.peers.get(peerId);
    if (data) {
      try {
        if (data.source) data.source.disconnect();
      } catch (e) {}
      state.peers.delete(peerId);
    }
    const stereoPanner = state.stereoPannerNodes.get(peerId);
    if (stereoPanner) {
      try {
        stereoPanner.disconnect();
      } catch (e) {}
      state.stereoPannerNodes.delete(peerId);
    }
    const gainNode = state.gainNodes.get(peerId);
    if (gainNode) {
      try {
        gainNode.disconnect();
      } catch (e) {}
      state.gainNodes.delete(peerId);
    }
    const panner = state.pannerNodes.get(peerId);
    if (panner) {
      try {
        panner.disconnect();
      } catch (e) {}
      state.pannerNodes.delete(peerId);
    }
    state.positions.delete(peerId);

    const connection = window.connections?.[peerId];
    const profile = window.peerProfiles?.get?.(peerId);
    const photoURL = connection?.photoURL || profile?.photoURL || null;
    if (photoURL) {
      const isSameOrigin = photoURL.startsWith("/") || photoURL.startsWith(window.location.origin);
      const finalUrl = isSameOrigin ? photoURL : `https://wsrv.nl/?url=${encodeURIComponent(photoURL)}&w=40&h=40&fit=cover${(/\.gif/i.test(photoURL)||/\/[^\/]*gif[^\/]*$/i.test(photoURL)) ? '' : '&output=webp'}`;
      const evictedEntry = avatarImageCache.get(finalUrl);
      if (evictedEntry && !evictedEntry.loaded && !evictedEntry.failed) {
        evictedEntry.img.src = '';
      }
      avatarImageCache.delete(finalUrl);
    }
  }

  function ensureAudioMuted(peerId, retries = 5) {
    const audioEl = document.getElementById("audio-" + peerId);
    if (audioEl) {
      audioEl.muted = true;
      state.muteTimeouts.delete(peerId);
    } else if (retries > 0) {
      const timeoutId = setTimeout(() => ensureAudioMuted(peerId, retries - 1), 150);
      state.muteTimeouts.set(peerId, timeoutId);
    }
  }

  function calculateDistance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  function calculateAngle(x, y) {
    const dx = x - state.listenerX;
    const dy = y - state.listenerY;
    if (dy === 0) return dx > 0 ? Math.PI / 2 : -Math.PI / 2;
    return Math.atan2(dx, dy);
  }

  function distributeArc(activePeerIds) {
    const count = activePeerIds.length;
    if (count === 0) return {};
    const radius = state.gridSize * 0.32;
    const startAngle = -Math.PI * 0.65;
    const endAngle = Math.PI * 0.65;
    const step = count > 1 ? (endAngle - startAngle) / (count - 1) : 0;
    const positions = {};
    activePeerIds.forEach((id, i) => {
      const angle = count > 1 ? startAngle + i * step : 0;
      positions[id] = {
        x: state.listenerX + radius * Math.sin(angle),
        y: state.listenerY - radius * Math.cos(angle)
      };
    });
    return positions;
  }

  function distributeLine(activePeerIds) {
    const count = activePeerIds.length;
    if (count === 0) return {};
    const positions = {};
    const lineWidth = state.gridSize * 0.7;
    const y = state.gridPadding + 30;
    const step = count > 1 ? lineWidth / (count - 1) : 0;
    const startX = (state.gridSize - lineWidth) / 2;
    activePeerIds.forEach((id, i) => {
      positions[id] = {
        x: startX + i * step,
        y: y
      };
    });
    return positions;
  }

  function distributeGrid(activePeerIds) {
    const count = activePeerIds.length;
    if (count === 0) return {};
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cellW = (state.gridSize - state.gridPadding * 2) / Math.max(cols, 1);
    const cellH = (state.gridSize * 0.55 - state.gridPadding * 2) / Math.max(rows, 1);
    const positions = {};
    activePeerIds.forEach((id, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions[id] = {
        x: state.gridPadding + col * cellW + cellW / 2,
        y: state.gridPadding + row * cellH + cellH / 2 + 10
      };
    });
    return positions;
  }

  function updatePositions() {
    const activeIds = Array.from(state.peers.keys());
    let newPositions;
    switch (state.placementMode) {
      case 'arc':
        newPositions = distributeArc(activeIds);
        break;
      case 'line':
        newPositions = distributeLine(activeIds);
        break;
      case 'grid':
        newPositions = distributeGrid(activeIds);
        break;
      case 'manual':
        newPositions = Object.fromEntries(state.positions);
        const missingIds = activeIds.filter(id => !state.positions.has(id));
        if (missingIds.length > 0) {
          const arcPositions = distributeArc(activeIds);
          missingIds.forEach(id => {
            newPositions[id] = arcPositions[id] || {
              x: state.gridSize / 2,
              y: state.gridSize * 0.3
            };
          });
        }
        break;
      default:
        newPositions = distributeArc(activeIds);
        break;
    }
    Object.entries(newPositions).forEach(([id, pos]) => {
      state.positions.set(id, pos);
    });
    applyAudioSpatialization();
    requestRender();
  }

  function applyAudioSpatialization() {
    if (!state.enabled || !state.audioCtx) return;
    const blend = state.blend;
    const maxOffset = state.gridSize / 2 - state.gridPadding;
    const now = state.audioCtx.currentTime;
    state.positions.forEach((pos, peerId) => {
      const stereoPanner = state.stereoPannerNodes.get(peerId);
      const gainNode = state.gainNodes.get(peerId);
      const panner = state.pannerNodes.get(peerId);
      if (!stereoPanner || !panner) return;
      const distance = calculateDistance(pos.x, pos.y, state.listenerX, state.listenerY);
      if (blend < 0.01) {
        stereoPanner.pan.setValueAtTime(0, now);
        if (gainNode) gainNode.gain.setValueAtTime(1, now);
        panner.positionX.setValueAtTime(0, now);
        panner.positionY.setValueAtTime(0, now);
        panner.positionZ.setValueAtTime(1, now);
        panner.refDistance = 10000;
        panner.rolloffFactor = 0;
      } else {
        const rawPan = (pos.x - state.listenerX) / maxOffset;
        stereoPanner.pan.setValueAtTime(Math.max(-1, Math.min(1, rawPan)) * blend, now);
        const distNorm = Math.min(1, distance / (state.gridSize * 0.6));
        const roomFactor = state.roomSize / 50;
        const attenuation = 1 / (1 + distNorm * distNorm * roomFactor * 3);
        if (gainNode) gainNode.gain.setValueAtTime(Math.max(0.1, attenuation), now);
        const distanceScale = 3.0;
        panner.positionX.setValueAtTime((pos.x - state.listenerX) / distanceScale * blend, now);
        panner.positionY.setValueAtTime(0, now);
        panner.positionZ.setValueAtTime(1 - Math.abs((pos.y - state.listenerY) / distanceScale) * blend, now);
        panner.refDistance = Math.max(0.5, 5.0 / Math.max(0.1, state.roomSize / 25));
        panner.rolloffFactor = Math.max(0.1, (state.roomSize / 50) * blend * 1.5);
      }
    });
  }

  function resetDefaults() {
    state.enabled = false;
    state.blend = 0.5;
    state.roomSize = 50;
    state.placementMode = 'arc';
    state.positions.clear();
    state.panX = 0;
    state.panY = 0;
    state.zoom = 1;
    updateUIState();
    if (state.observerInterval) {
      clearInterval(state.observerInterval);
      state.observerInterval = null;
    }
    if (state.audioCtx) state.audioCtx.suspend();
    state.stereoPannerNodes.forEach((sp) => {
      sp.pan.setValueAtTime(0, state.audioCtx?.currentTime || 0);
    });
    state.gainNodes.forEach((g) => {
      g.gain.setValueAtTime(1, state.audioCtx?.currentTime || 0);
    });
    state.pannerNodes.forEach((panner) => {
      const now = state.audioCtx?.currentTime || 0;
      panner.positionX.setValueAtTime(0, now);
      panner.positionY.setValueAtTime(0, now);
      panner.positionZ.setValueAtTime(1, now);
      panner.refDistance = 10000;
      panner.rolloffFactor = 0;
    });
    requestRender();
    if (window.switchAudioToMono) window.switchAudioToMono();
  }

  function switchAudioToSpatial() {
    document.querySelectorAll('audio[id^="audio-"]').forEach(audioEl => {
      audioEl.muted = true;
    });
  }

  function switchAudioToMono() {
    document.querySelectorAll('audio[id^="audio-"]').forEach(audioEl => {
      audioEl.muted = false;
    });
  }
  window.switchAudioToSpatial = switchAudioToSpatial;
  window.switchAudioToMono = switchAudioToMono;

  function setEnabled(val) {
    state.enabled = val;
    if (val) {
      initAudioContext();
      if (state.audioCtx && state.audioCtx.state === 'suspended') state.audioCtx.resume();
      updatePositions();
      reconnectAllPeers();
      switchAudioToSpatial();
    } else {
      const now = state.audioCtx?.currentTime || 0;
      state.stereoPannerNodes.forEach((sp) => {
        sp.pan.setValueAtTime(0, now);
      });
      state.gainNodes.forEach((g) => {
        g.gain.setValueAtTime(1, now);
      });
      state.pannerNodes.forEach((panner) => {
        panner.positionX.setValueAtTime(0, now);
        panner.positionY.setValueAtTime(0, now);
        panner.positionZ.setValueAtTime(1, now);
        panner.refDistance = 10000;
        panner.rolloffFactor = 0;
      });
      if (state.audioCtx) state.audioCtx.suspend();
      switchAudioToMono();
    }
    updateUIState();
    saveState();
  }

  function reconnectAllPeers() {
    if (!state.enabled || !window.calls) return;
    Object.entries(window.calls).forEach(([peerId, callObj]) => {
      if (callObj.remoteStream) connectStreamToPanner(peerId, callObj.remoteStream);
    });
  }

  function setBlend(val) {
    state.blend = Math.max(0, Math.min(1, val));
    applyAudioSpatialization();
    updateUIState();
    saveState();
  }

  function setRoomSize(val) {
    state.roomSize = Math.max(1, Math.min(500, val));
    applyAudioSpatialization();
    updateUIState();
    saveState();
  }

  function setPlacementMode(mode) {
    if (!['arc', 'line', 'grid', 'manual'].includes(mode)) return;
    state.placementMode = mode;
    if (state.enabled) updatePositions();
    updateUIState();
    saveState();
  }

  let canvas = null;
  let ctx = null;

  function initCanvas() {
    canvas = document.getElementById('spatial-grid-canvas');
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = state.gridSize * dpr;
    canvas.height = state.gridSize * dpr;
    canvas.style.width = `${state.gridSize}px`;
    canvas.style.height = `${state.gridSize}px`;
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseup', onCanvasMouseUp);
    canvas.addEventListener('mouseleave', onCanvasMouseUp);
    canvas.addEventListener('wheel', onCanvasWheel, {
      passive: false
    });
    canvas.addEventListener('touchstart', onCanvasTouchStart, {
      passive: false
    });
    canvas.addEventListener('touchmove', onCanvasTouchMove, {
      passive: false
    });
    canvas.addEventListener('touchend', onCanvasTouchEnd, {
      passive: false
    });
  }

  function requestRender() {
    state.renderRequested = true;
  }

  function renderGrid() {
    if (state.isRendering) return;
    state.isRendering = true;
    try {
      if (!canvas) initCanvas();
      if (!ctx || !canvas) return;
      const gs = state.gridSize;
      ctx.fillStyle = '#0a0b0e';
      ctx.fillRect(0, 0, gs, gs);
      ctx.save();
      ctx.translate(gs / 2 + state.panX, gs / 2 + state.panY);
      ctx.scale(state.zoom, state.zoom);
      ctx.translate(-gs / 2, -gs / 2);

      const halfView = gs / 2 / Math.max(state.zoom, 0.01) + gs * 0.5;
      const minC = gs / 2 - halfView;
      const maxC = gs / 2 + halfView;
      const step = 30;
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let i = Math.floor(minC / step) * step; i <= maxC; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, minC);
        ctx.lineTo(i, maxC);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(minC, i);
        ctx.lineTo(maxC, i);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(gs / 2, minC);
      ctx.lineTo(gs / 2, maxC);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(minC, gs / 2);
      ctx.lineTo(maxC, gs / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeRect(0, 0, gs, gs);
      ctx.restore();

      ctx.save();
      ctx.translate(gs / 2 + state.panX, gs / 2 + state.panY);
      ctx.scale(state.zoom, state.zoom);
      ctx.translate(-gs / 2, -gs / 2);

      if (state.enabled) {
        state.positions.forEach((pos, peerId) => {
          const isInCalls = window.calls && window.calls[peerId];
          const isInConnections = window.connections && window.connections[peerId];
          if (!isInCalls && !isInConnections) return;
          ctx.beginPath();
          ctx.moveTo(state.listenerX, state.listenerY);
          ctx.lineTo(pos.x, pos.y);
          ctx.strokeStyle = `rgba(139, 60, 255, ${0.1 + 0.2 * (1 - calculateDistance(pos.x, pos.y, state.listenerX, state.listenerY) / gs)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }

      const waveDuration = 120;
      state.positions.forEach((pos, peerId) => {
        const card = document.getElementById("p-card-" + peerId) || document.getElementById("p-card-" + (window.peerIdToUidMap?.[peerId] || ''));
        if (!card || !card.classList.contains("speaking")) return;
        for (let w = 0; w < 3; w++) {
          const phase = ((state.waveTime + w * waveDuration / 3) % waveDuration) / waveDuration;
          const radius = 14 + phase * 35;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(16, 185, 129, ${0.5 * (1 - phase)})`;
          ctx.lineWidth = 1.5 * (1 - phase) + 0.5;
          ctx.stroke();
        }
      });

      ctx.beginPath();
      ctx.arc(state.listenerX, state.listenerY, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      const myPhotoURL = (typeof auth !== 'undefined' && auth.currentUser?.photoURL) || window.currentUserProfile?.photoURL;
      let myImageDrawn = false;
      if (myPhotoURL) {
        const myImg = getCachedAvatarImage(myPhotoURL, () => requestRender());
        if (myImg && myImg.complete && myImg.naturalWidth > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(state.listenerX, state.listenerY, 13, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(myImg, state.listenerX - 14, state.listenerY - 14, 28, 28);
          ctx.restore();
          myImageDrawn = true;
        }
      }
      if (!myImageDrawn) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('You', state.listenerX, state.listenerY);
      }

      state.positions.forEach((pos, peerId) => {
        const isInCalls = window.calls && window.calls[peerId];
        const isInConnections = window.connections && window.connections[peerId];
        if (!isInCalls && !isInConnections) return;
        const name = getPeerName(peerId) || '';
        const isDragging = state.dragPeerId === peerId;
        const r = isDragging ? 14 : 12;
        const card = document.getElementById("p-card-" + peerId) || document.getElementById("p-card-" + (window.peerIdToUidMap?.[peerId] || ''));
        const isSpeaking = card && card.classList.contains("speaking");

        const grad2 = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r + 12);
        if (isSpeaking) {
          grad2.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
          grad2.addColorStop(0.5, 'rgba(16, 185, 129, 0.15)');
          grad2.addColorStop(1, 'rgba(16, 185, 129, 0)');
        } else if (isDragging) {
          grad2.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
          grad2.addColorStop(0.5, 'rgba(59, 130, 246, 0.15)');
          grad2.addColorStop(1, 'rgba(59, 130, 246, 0)');
        } else {
          grad2.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
          grad2.addColorStop(0.6, 'rgba(139, 92, 246, 0.08)');
          grad2.addColorStop(1, 'rgba(139, 92, 246, 0)');
        }
        ctx.fillStyle = grad2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isDragging ? '#3b82f6' : '#1e293b';
        ctx.fill();
        ctx.strokeStyle = isSpeaking ? '#10b981' : (isDragging ? '#60a5fa' : 'rgba(255,255,255,0.15)');
        ctx.lineWidth = isSpeaking ? 2.5 : (isDragging ? 2 : 1.5);
        ctx.stroke();

        const connection = window.connections?.[peerId];
        let photoURL = connection?.photoURL || null;
        if (!photoURL) {
          const profile = window.peerProfiles && window.peerProfiles.get ? window.peerProfiles.get(peerId) : null;
          photoURL = profile?.photoURL || null;
        }
        if (!photoURL) {
          const uid = window.peerIdToUidMap?.[peerId] || peerId;
          const peerCard = document.getElementById('p-card-' + uid);
          if (peerCard) {
            const imgEl = peerCard.querySelector('img[src]');
            if (imgEl && imgEl.src && !imgEl.src.includes('data:') && imgEl.naturalWidth > 0) photoURL = imgEl.src;
          }
        }
        let imageDrawn = false;
        if (photoURL) {
          const img = getCachedAvatarImage(photoURL, () => requestRender());
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r - 0.5, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(img, pos.x - r, pos.y - r, r * 2, r * 2);
            ctx.restore();
            imageDrawn = true;
          }
        }
        if (!imageDrawn) {

          const uid = window.peerIdToUidMap?.[peerId] || peerId;
          const fox = getFoxyMaskImage(() => requestRender());
          if (fox && fox.complete && fox.naturalWidth > 0) {
            const md = window.state?.serverMembersData?.[uid];
            const myColor = uid === window.myId ? window.currentUserProfile?.avatarColor : null;
            const color = isDragging ? '#3b82f6' : (window.resolveProfileColor ? window.resolveProfileColor(uid, myColor || md?.avatarColor || md?.bannerColor) : (myColor || md?.avatarColor || '#5865f2'));
            ctx.save();
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r - 0.5, 0, Math.PI * 2);
            ctx.clip();
            ctx.fillStyle = color;
            ctx.fillRect(pos.x - r, pos.y - r, r * 2, r * 2);
            ctx.drawImage(fox, pos.x - r, pos.y - r, r * 2, r * 2);
            ctx.restore();
            imageDrawn = true;
          }
        }
        if (!imageDrawn) {
          const initial = (name && name.length > 0) ? name.charAt(0).toUpperCase() : '?';
          ctx.fillStyle = isDragging ? '#fff' : '#94a3b8';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(initial, pos.x, pos.y);
        }
        const displayName = (name && name.length > 0) ? (name.length > 8 ? name.slice(0, 8) + '..' : name) : '';
        if (displayName) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.font = '7px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(displayName, pos.x, pos.y + r + 9);
        }
      });
      ctx.restore();
    } finally {
      state.isRendering = false;
    }
  }

  function onCanvasWheel(e) {
    if (!state.enabled) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = state.gridSize / rect.width;
    const scaleY = state.gridSize / rect.height;
    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;
    const relX = rawX - state.gridSize / 2;
    const relY = rawY - state.gridSize / 2;
    const zoomAmount = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(5.0, state.zoom * zoomAmount));
    state.panX = relX - (relX - state.panX) * (newZoom / state.zoom);
    state.panY = relY - (relY - state.panY) * (newZoom / state.zoom);
    state.zoom = newZoom;
    requestRender();
  }

  function getPeerName(peerId) {
    const conn = window.connections && window.connections[peerId];
    if (conn && conn.name && conn.name !== '...') return conn.name;
    const profile = window.peerProfiles && window.peerProfiles.get ? window.peerProfiles.get(peerId) : null;
    if (profile && profile.name) return profile.name;
    const uid = window.peerIdToUidMap && window.peerIdToUidMap[peerId];
    const cardId = uid || peerId;
    const card = document.getElementById('p-card-' + cardId);
    if (card) {
      const nameEl = card.querySelector('.participant-name');
      if (nameEl && nameEl.textContent.trim() && nameEl.textContent.trim() !== '...') return nameEl.textContent.trim();
    }
    return null;
  }

  let isPanning = false;

  function getCanvasPos(e) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = state.gridSize / rect.width;
    const scaleY = state.gridSize / rect.height;
    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;
    return {
      x: (rawX - state.gridSize / 2 - state.panX) / state.zoom + state.gridSize / 2,
      y: (rawY - state.gridSize / 2 - state.panY) / state.zoom + state.gridSize / 2,
    };
  }

  function getPeerAtPos(x, y) {
    const hitRadius = Math.max(18, 20 / state.zoom);
    for (const [id, pos] of state.positions) {
      if (calculateDistance(x, y, pos.x, pos.y) < hitRadius) return id;
    }
    return null;
  }

  function onCanvasMouseDown(e) {
    if (!state.enabled) return;
    const pos = getCanvasPos(e);
    if (!pos) return;
    const peerId = getPeerAtPos(pos.x, pos.y);
    if (peerId && state.placementMode === 'manual') {
      state.dragPeerId = peerId;
      state.dragTargetPos.x = pos.x;
      state.dragTargetPos.y = pos.y;
      isPanning = false;
      canvas.style.cursor = 'grabbing';
    } else {
      isPanning = true;
      state.panLatestClientX = state.panPrevProcessedX = e.clientX;
      state.panLatestClientY = state.panPrevProcessedY = e.clientY;
      canvas.style.cursor = 'move';
    }
  }

  function onCanvasMouseMove(e) {
    if (!state.enabled) return;
    if (state.dragPeerId && state.placementMode === 'manual') {
      const pos = getCanvasPos(e);
      if (pos) {
        state.dragTargetPos.x = pos.x;
        state.dragTargetPos.y = pos.y;
      }
    } else if (isPanning) {
      state.panLatestClientX = e.clientX;
      state.panLatestClientY = e.clientY;
    } else {
      const pos = getCanvasPos(e);
      if (pos) {
        const hover = getPeerAtPos(pos.x, pos.y);
        canvas.style.cursor = (hover && state.placementMode === 'manual') ? 'grab' : 'default';
      }
    }
  }

  function onCanvasMouseUp() {
    if (state.dragPeerId) {
      applyAudioSpatialization();
      saveState();
    }
    state.dragPeerId = null;
    isPanning = false;
    if (canvas) canvas.style.cursor = 'default';
  }

  function onCanvasTouchStart(e) {
    if (!state.enabled) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = state.gridSize / rect.width;
    const scaleY = state.gridSize / rect.height;
    const rawX = (touch.clientX - rect.left) * scaleX;
    const rawY = (touch.clientY - rect.top) * scaleY;
    const x = (rawX - state.gridSize / 2 - state.panX) / state.zoom + state.gridSize / 2;
    const y = (rawY - state.gridSize / 2 - state.panY) / state.zoom + state.gridSize / 2;
    const peerId = getPeerAtPos(x, y);
    if (peerId && state.placementMode === 'manual') {
      state.dragPeerId = peerId;
      state.dragTargetPos.x = x;
      state.dragTargetPos.y = y;
      isPanning = false;
    } else {
      isPanning = true;
      state.panLatestClientX = state.panPrevProcessedX = touch.clientX;
      state.panLatestClientY = state.panPrevProcessedY = touch.clientY;
    }
  }

  function onCanvasTouchMove(e) {
    if (!state.enabled) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (state.dragPeerId && state.placementMode === 'manual') {
      const rect = canvas.getBoundingClientRect();
      const scaleX = state.gridSize / rect.width;
      const scaleY = state.gridSize / rect.height;
      const rawX = (touch.clientX - rect.left) * scaleX;
      const rawY = (touch.clientY - rect.top) * scaleY;
      state.dragTargetPos.x = (rawX - state.gridSize / 2 - state.panX) / state.zoom + state.gridSize / 2;
      state.dragTargetPos.y = (rawY - state.gridSize / 2 - state.panY) / state.zoom + state.gridSize / 2;
    } else if (isPanning) {
      state.panLatestClientX = touch.clientX;
      state.panLatestClientY = touch.clientY;
    }
  }

  function onCanvasTouchEnd() {
    if (state.dragPeerId) {
      applyAudioSpatialization();
      saveState();
    }
    state.dragPeerId = null;
    isPanning = false;
  }

  function cacheUIElements() {
    state.uiElements = {
      toggle: document.getElementById('spatial-toggle'),
      blendSlider: document.getElementById('spatial-blend'),
      blendLabel: document.getElementById('spatial-blend-label'),
      roomSlider: document.getElementById('spatial-room-size'),
      roomLabel: document.getElementById('spatial-room-size-label'),
      modeBtns: document.querySelectorAll('.placement-mode-btn'),
    };
  }

  function updateUIState() {
    const el = state.uiElements;
    if (!el) return;

    if (el.toggle) el.toggle.checked = state.enabled;
    if (el.blendSlider) {
      el.blendSlider.value = state.blend * 100;
      el.blendSlider.disabled = !state.enabled;
    }
    if (el.blendLabel) {
      el.blendLabel.textContent = Math.round(state.blend * 100) + '%';
      el.blendLabel.classList.toggle('text-gray-600', !state.enabled);
      el.blendLabel.classList.toggle('text-blue-400', state.enabled);
    }
    if (el.roomSlider) {
      el.roomSlider.value = state.roomSize;
      el.roomSlider.disabled = !state.enabled;
    }
    if (el.roomLabel) {
      el.roomLabel.textContent = Math.round(state.roomSize) + ' m²';
      el.roomLabel.classList.toggle('text-gray-600', !state.enabled);
      el.roomLabel.classList.toggle('text-blue-400', state.enabled);
    }
    el.modeBtns.forEach((btn) => {
      const mode = btn.dataset.mode;
      const active = mode === state.placementMode;
      btn.classList.toggle('bg-blue-600/30', active && state.enabled);
      btn.classList.toggle('border-blue-500/50', active && state.enabled);
      btn.classList.toggle('text-blue-300', active && state.enabled);
      btn.classList.toggle('bg-white/5', !active || !state.enabled);
      btn.classList.toggle('border-white/10', !active || !state.enabled);
      btn.classList.toggle('text-gray-400', !active || !state.enabled);
      btn.disabled = !state.enabled;
    });
  }

  function showAudioResumeButton() {
    let btn = document.getElementById('spatial-audio-resume-btn');
    if (btn) return;
    btn = document.createElement('button');
    btn.id = 'spatial-audio-resume-btn';
    btn.textContent = window.__fb('js.spatial_unmute', 'اضغط لإعادة تفعيل الصوت');
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '9999',
      padding: '12px 24px',
      background: '#7c3aed',
      color: '#fff',
      border: 'none',
      borderRadius: '12px',
      fontSize: '14px',
      cursor: 'pointer',
      boxShadow: '0 4px 20px rgba(124,58,237,0.5)',
    });
    btn.onclick = () => {
      if (state.audioCtx && state.audioCtx.state === 'suspended') {
        state.audioCtx.resume().then(() => {
          state.audioCtxDenied = false;
          hideAudioResumeButton();
        }).catch(() => {});
      }
    };
    document.body.appendChild(btn);
  }

  function hideAudioResumeButton() {
    const btn = document.getElementById('spatial-audio-resume-btn');
    if (btn) btn.remove();
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;
    initCanvas();
    cacheUIElements();
    loadState();
    updateUIState();
    renderGrid();
    observeCallStreams();
    startAnimation();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (state.animationFrame) {
          cancelAnimationFrame(state.animationFrame);
          state.animationFrame = null;
        }
        if (state.observerInterval) {
          clearInterval(state.observerInterval);
          state.observerInterval = null;
        }
      } else if (state.initialized) {
        if (!state.animationFrame) {
          state.renderRequested = true;
          startAnimation();
        }
        if (!state.observerInterval) observeCallStreams();
      }
    });
    window.addEventListener('beforeunload', () => {
      if (state.observerInterval) clearInterval(state.observerInterval);
    });
  }

  function observeCallStreams() {
    if (state.observerInterval) clearInterval(state.observerInterval);
    state.observerInterval = setInterval(() => {

      if (!state.enabled) {
        if (state.peers.size) disconnectAll();
        return;
      }
      state.peers.forEach((_, peerId) => {
        if (!window.calls || !window.calls[peerId]) removePeer(peerId);
      });
      if (!window.calls) return;
      Object.entries(window.calls).forEach(([peerId, callObj]) => {
        if (callObj.remoteStream && !state.peers.has(peerId)) {
          if (state.audioCtx && state.audioCtx.state === 'suspended') {
            state.audioCtx.resume();
          }
          connectStreamToPanner(peerId, callObj.remoteStream);
          updatePositions();
          ensureAudioMuted(peerId);
        }
      });
    }, 1000);
  }

  function loadState() {
    try {
      const saved = localStorage.getItem('foxy_spatial_audio');
      if (saved) {
        const data = JSON.parse(saved);
        state.enabled = data.enabled || false;
        state.blend = data.blend ?? 0.5;
        state.roomSize = data.roomSize ?? 50;
        state.placementMode = data.placementMode || 'arc';
        if (data.positions) {
          Object.entries(data.positions).forEach(([k, v]) => state.positions.set(k, v));
        }
      }
    } catch (e) {}
  }

  let saveTimeout = null;

  function saveState() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveTimeout = null;
      try {
        const data = {
          enabled: state.enabled,
          blend: state.blend,
          roomSize: state.roomSize,
          placementMode: state.placementMode,
          positions: Object.fromEntries(state.positions),
        };
        localStorage.setItem('foxy_spatial_audio', JSON.stringify(data));
      } catch (e) {}
    }, 300);
  }

  function addPeer(peerId, stream) {
    connectStreamToPanner(peerId, stream);
    if (state.enabled) {
      updatePositions();
      ensureAudioMuted(peerId);
    }
  }

  function removePeer(peerId) {
    disconnectPeer(peerId);
    requestRender();
  }

  function getState() {
    return {
      ...state,
      positions: Object.fromEntries(state.positions)
    };
  }

  function setManualPosition(peerId, x, y) {
    if (state.placementMode !== 'manual') return;
    const maxOffset = Math.max(state.gridSize, state.gridSize / state.zoom);
    const minX = state.gridSize / 2 - maxOffset + state.gridPadding;
    const maxX = state.gridSize / 2 + maxOffset - state.gridPadding;
    const minY = state.gridSize / 2 - maxOffset + state.gridPadding;
    const maxY = state.gridSize / 2 + maxOffset - state.gridPadding;
    state.positions.set(peerId, {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y))
    });
    requestRender();
  }

  function startAnimation() {
    function loop() {
      if (!state.enabled) {
        state.animationFrame = null;
        return;
      }
      if (state.dragPeerId && state.placementMode === 'manual') {
        setManualPosition(state.dragPeerId, state.dragTargetPos.x, state.dragTargetPos.y);
        applyAudioSpatialization();
        state.renderRequested = true;
      }
      if (isPanning && canvas) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = state.gridSize / rect.width;
        const scaleY = state.gridSize / rect.height;
        state.panX += (state.panLatestClientX - state.panPrevProcessedX) * scaleX;
        state.panY += (state.panLatestClientY - state.panPrevProcessedY) * scaleY;
        state.panPrevProcessedX = state.panLatestClientX;
        state.panPrevProcessedY = state.panLatestClientY;
        state.renderRequested = true;
      }
      state.waveTime++;
      if (state.renderRequested) {
        state.renderRequested = false;
        renderGrid();
      }
      state.animationFrame = requestAnimationFrame(loop);
    }
    if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
    state.animationFrame = requestAnimationFrame(loop);
  }

  function disconnectAll() {
    for (const peerId of Array.from(state.peers.keys())) {
      try { disconnectPeer(peerId) } catch (_) {}
    }
    for (const t of Array.from(state.muteTimeouts.values())) {
      try { clearTimeout(t) } catch (_) {}
    }
    state.muteTimeouts.clear();
    state.positions.clear();
  }

  const api = {
    init,
    setEnabled,
    setBlend,
    setRoomSize,
    setPlacementMode,
    setManualPosition,
    resetDefaults,
    addPeer,
    removePeer,
    getState,
    updatePositions,
    renderGrid,
    saveState,
    startAnimation,
    disconnectPeer,
    disconnectAll,
    get audioCtx() {
      return state.audioCtx;
    },
    get enabled() {
      return state.enabled;
    },
  };

  window.spatialAudio = api;
  window.setSpatialAudioEnabled = setEnabled;
  window.setSpatialBlend = setBlend;
  window.setSpatialRoomSize = setRoomSize;
  window.setSpatialPlacementMode = setPlacementMode;
  window.resetSpatialAudio = resetDefaults;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }

  return api;
})();

export default spatialAudio;