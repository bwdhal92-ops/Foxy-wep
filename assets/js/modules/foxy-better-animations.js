/*
 * Foxy-native BetterAnimations bridge.
 * Discord's BetterDiscord hooks cannot run in a normal website, so this file
 * applies the same useful visual presets to Foxy's DOM and dynamic content.
 */
(() => {
  "use strict";

  const STORAGE = {
    enabled: "foxy-ba-enabled",
    preset: "foxy-ba-preset",
    speed: "foxy-ba-speed"
  };
  const validPresets = new Set(["fade", "slip", "slide", "scale", "point", "blur", "flip", "drawer"]);
  const state = {
    enabled: localStorage.getItem(STORAGE.enabled) !== "false",
    preset: validPresets.has(localStorage.getItem(STORAGE.preset)) ? localStorage.getItem(STORAGE.preset) : "slip",
    speed: Math.max(50, Math.min(200, Number(localStorage.getItem(STORAGE.speed)) || 100))
  };
  // All BetterAnimations logs removed by user request (2026-09-21):
  // per-element/per-view animation logging spammed the console.
  // The helper is kept as a no-op so existing call sites need no changes.
  const log = () => {};
  const activeAnimations = new Set();
  const MAX_ACTIVE_ANIMATIONS = 24;
  const MAX_ANIMATIONS_PER_FRAME = 8;
  const lastAnimated = new WeakMap();
  const animatedKeys = new Set();
  const nativeAnimations = new WeakMap();
  const visibilityAnimations = new WeakMap();
  const queuedAnimations = new Map();
  let animationFrameQueued = false;

  function queueAnimation(element, preset) {
    if (!(element instanceof Element)) return;
    queuedAnimations.set(element, preset);
    if (animationFrameQueued) return;
    animationFrameQueued = true;
    requestAnimationFrame(() => {
      animationFrameQueued = false;
      const batch = Array.from(queuedAnimations.entries()).slice(0, MAX_ANIMATIONS_PER_FRAME);
      queuedAnimations.clear();
      batch.forEach(([target, name]) => animate(target, name, { defer: false }));
    });
  }
  const seen = new WeakSet();
  let suppressed = false;

  function reduced() {
    return document.body?.classList.contains("mode-turbo");
  }

  function sync() {
    if (!document.body) return;
    document.body.classList.toggle("foxy-ba-enabled", state.enabled);
    document.body.classList.toggle("foxy-ba-disabled", !state.enabled);
    document.body.classList.toggle("foxy-ba-force-motion", state.enabled && !document.body.classList.contains("mode-turbo"));
    document.body.dataset.foxyBaPreset = state.preset;
    document.documentElement.style.setProperty("--foxy-ba-duration", `${280 / (state.speed / 100)}ms`);
  }

  function animate(element, preset = state.preset, options = {}) {
    if (!(element instanceof Element) || !state.enabled || reduced()) return element;
    if (activeAnimations.size >= MAX_ACTIVE_ANIMATIONS && !activeAnimations.has(element)) return element;
    const name = validPresets.has(preset) ? preset : state.preset;
    const previous = lastAnimated.get(element);
    const className = `foxy-ba-${name}`;
    const isChannel = element.matches(".server-channel-item");
    const isMessage = element.matches(".message-row");
    const stableId = isChannel
      ? element.dataset.channelId || element.id
      : isMessage ? element.dataset.messageId || element.id : "";
    const stableKey = stableId ? `${isChannel ? "channel" : "message"}:${stableId}:${name}` : "";
    if (stableKey && animatedKeys.has(stableKey)) {
      return element;
    }
    if (element.classList.contains(className) || (previous && previous.name === name && performance.now() - previous.time < 1000)) {
      return element;
    }
    lastAnimated.set(element, { name, time: performance.now() });
    if (stableKey) animatedKeys.add(stableKey);

    const hadAnimation = element.classList.contains("foxy-ba-animated");
    element.classList.remove("foxy-ba-animated", ...Array.from(validPresets, value => `foxy-ba-${value}`));
    if (options.restart && hadAnimation) void element.offsetWidth;
    activeAnimations.add(element);
    if (element.isConnected) element.classList.add("foxy-ba-animated", `foxy-ba-${name}`);
    // Do not touch the DOM from animationend: large message lists can make
    // that event force an expensive layout recalculation. CSS finishes the
    // animation by itself; this timer only releases the concurrency slot.
    window.setTimeout(() => activeAnimations.delete(element), 420);
    return element;
  }

  function playNative(element, preset = state.preset) {
    if (!(element instanceof Element) || !state.enabled || reduced()) return element;
    const name = validPresets.has(preset) ? preset : state.preset;
    const keyframes = {
      fade: [{ opacity: 0 }, { opacity: 1 }],
      slip: [{ opacity: 0, transform: "translateY(42px)" }, { opacity: 1, transform: "translateY(0)" }],
      slide: [{ opacity: 0, transform: "translateX(64px)" }, { opacity: 1, transform: "translateX(0)" }],
      scale: [{ opacity: 0, transform: "scale(.72)" }, { opacity: 1, transform: "scale(1)" }],
      point: [{ opacity: 0, transform: "scale(.35) translateY(18px)" }, { opacity: 1, transform: "scale(1) translateY(0)" }],
      blur: [{ opacity: 0, filter: "blur(18px)", transform: "scale(1.04)" }, { opacity: 1, filter: "blur(0)", transform: "scale(1)" }],
      flip: [{ opacity: 0, transform: "perspective(900px) rotateY(-82deg) scale(.88)" }, { opacity: 1, transform: "perspective(900px) rotateY(0) scale(1)" }],
      drawer: [{ opacity: 0, transform: "translateX(100%) scale(.96)" }, { opacity: 1, transform: "translateX(0) scale(1)" }]
    }[name];
    nativeAnimations.get(element)?.cancel();
    const animation = element.animate(keyframes, {
      duration: 280 / (state.speed / 100),
      easing: "cubic-bezier(.2, .8, .2, 1)",
      fill: "both"
    });
    nativeAnimations.set(element, animation);
    return element;
  }

  function motionDisabled() {
    if (!state.enabled || reduced()) return true;
    if (document.body?.classList.contains("foxy-ba-disabled")) return true;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches && !document.body?.classList.contains("foxy-ba-force-motion")) return true;
    return false;
  }

  function animateSidebarVisibility(element, hidden, preset = state.preset, onFinish) {
    if (!(element instanceof Element)) return;
    visibilityAnimations.get(element)?.cancel();

    if (motionDisabled()) {
      onFinish?.();
      return;
    }

    const name = validPresets.has(preset) ? preset : state.preset;
    const mobile = window.matchMedia?.('(max-width: 700px)').matches;
    const slideTransform = mobile ? 'translateY(110%)' : 'translateX(100%)';
    const hiddenFrame = {
      fade: { opacity: 0 },
      slip: { opacity: 0, transform: slideTransform },
      slide: { opacity: 0, transform: slideTransform },
      drawer: { opacity: 0, transform: slideTransform },
      scale: { opacity: 0, transform: 'scaleX(.72)' },
      point: { opacity: 0, transform: 'scaleX(.72)' },
      blur: { opacity: 0, filter: 'blur(18px)' },
      flip: { opacity: 0, transform: 'perspective(900px) rotateY(82deg) scale(.88)' }
    }[name] || { opacity: 0 };
    const visibleFrame = { opacity: 1, transform: 'none', filter: 'blur(0)' };
    const duration = Math.max(1, Math.round(280 / (state.speed / 100)));
    const animation = element.animate(hidden ? [visibleFrame, hiddenFrame] : [hiddenFrame, visibleFrame], {
      duration: duration,
      easing: 'cubic-bezier(.2, .8, .2, 1)',
      fill: 'both'
    });
    visibilityAnimations.set(element, animation);
    let finished = false;
    const finishOnce = () => {
      if (finished) return;
      finished = true;
      if (visibilityAnimations.get(element) !== animation) return;
      onFinish?.();
      animation.cancel();
      visibilityAnimations.delete(element);
    };
    animation.onfinish = finishOnce;
    // Safety net: the hidden/visible state must always be applied even if
    // onfinish never fires, otherwise the panel keeps occupying space.
    window.setTimeout(finishOnce, duration + 120);
    return animation;
  }

  function markNew(node) {
    if (suppressed || !(node instanceof Element)) return;
    const targets = [
      [".message-row", "slip"],
      [".member-item, .server-voice-member-item", "slip"],
      [".server-channel-item", "slide"],
      [".rail-server-btn", "scale"],
      [".home-card, .settings-preview-card", "point"],
      [".profile-popout, .discord-context-menu, [role='dialog'], .modal", "point"],
      ["#server-members-sidebar, #settings-sidebar", "drawer"]
    ];
    for (const [selector, preset] of targets) {
      if (!node.matches(selector) && !node.querySelector(selector)) continue;
      const elements = node.matches(selector) ? [node] : Array.from(node.querySelectorAll(selector));
      elements.forEach(element => {
        if (seen.has(element)) return;
        seen.add(element);
        queueAnimation(element, state.preset);
      });
    }
  }

  let contentObserver = null;
  const CONTENT_OBSERVER_CONFIG = { childList: true, subtree: true };
  function observeDynamicContent() {
    contentObserver = new MutationObserver(records => records.forEach(record => {
      record.addedNodes.forEach(markNew);
    }));
    contentObserver.observe(document.body, CONTENT_OBSERVER_CONFIG);
  }
  function suppressContentObserver(value) {
    if (!contentObserver) return;
    if (value) contentObserver.disconnect();
    else contentObserver.observe(document.body, CONTENT_OBSERVER_CONFIG);
  }

  function observeViews() {
    new MutationObserver(records => records.forEach(record => {
      const element = record.target;
      if (!(element instanceof Element) || record.attributeName !== "class") return;
      const previous = record.oldValue || "";
      const current = String(element.className || "");
      const isSettingsTab = element.matches(".settings-tab-content");
      const becameVisible = isSettingsTab && !previous.includes("active-settings-tab") && current.includes("active-settings-tab");
      if (becameVisible) {
        animate(element, state.preset);
      }
    })).observe(document.body, { attributes: true, attributeFilter: ["class"], attributeOldValue: true, subtree: true });
  }

  function bindNavigation() {
    document.addEventListener("click", event => {
      const target = event.target.closest?.(".settings-nav-item, .rail-btn, .rail-server-btn, .server-channel-item");
      if (!target || !state.enabled || reduced()) return;
      if (target.matches(".server-channel-item")) return;
      if (target.matches(".rail-server-btn") && target.classList.contains("rail-server-btn-active")) return;
      target.classList.remove("foxy-ba-animated", ...Array.from(validPresets, value => `foxy-ba-${value}`));
      lastAnimated.delete(target);
      queueAnimation(target, state.preset);
    }, { passive: true });
  }

  function replayVisible() {
    if (!state.enabled || reduced()) return;
    const activeView = document.querySelector(".discord-view:not(.hidden-view)");
    const elements = activeView ? [
      ...activeView.querySelectorAll(".settings-tab-content.active-settings-tab, .home-card, .glass, .discord-context-menu:not(.hidden), [role='dialog']:not(.hidden)"),
      ...Array.from(activeView.querySelectorAll(".message-row, .member-item, .server-channel-item")).slice(-8)
    ] : [];
    elements.slice(0, MAX_ACTIVE_ANIMATIONS).forEach(element => {
      if (element.getClientRects().length) animate(element, state.preset);
    });
  }

  window.FoxyBetterAnimations = {
    animate,
    markSeen(element) {
      if (element instanceof Element) seen.add(element);
      return element;
    },
    markSeenMany(elements) {
      if (elements) Array.from(elements).forEach(element => element instanceof Element && seen.add(element));
      return elements;
    },
    suppress(value) {
      suppressed = !!value;
      suppressContentObserver(suppressed);
      return suppressed;
    },
    animateView(element) {
      animatedKeys.clear();
      element?.classList.remove("foxy-ba-animated", ...Array.from(validPresets, value => `foxy-ba-${value}`));
      lastAnimated.delete(element);
      log(window.__fb("js.ba_view", "تبديل واجهة"), { id: element?.id || "unknown", preset: state.preset });
      return playNative(element, state.preset);
    },
    resetCycle() {
      animatedKeys.clear();
    },
    animateSidebarMode(mode) {
      animatedKeys.clear();
      const selectors = mode === "server"
        ? "#server-channels-panel"
        : ".sidebar-chats-panel";
      document.querySelectorAll(selectors).forEach(element => {
        if (!element.getClientRects().length) return;
        element.classList.remove("foxy-ba-animated", ...Array.from(validPresets, value => `foxy-ba-${value}`));
        lastAnimated.delete(element);
        playNative(element, state.preset);
      });
      log(window.__fb("js.ba_sidebar_mode", "تبديل وضع الشريط الجانبي"), { mode, preset: state.preset });
    },
    animateSidebarVisibility,
    getState: () => ({ ...state }),
    setEnabled(value) {
      state.enabled = value !== false;
      localStorage.setItem(STORAGE.enabled, String(state.enabled));
      sync();
      log(state.enabled ? window.__fb("js.ba_on", "تم تفعيل الحركات") : window.__fb("js.ba_off", "تم إيقاف الحركات"), { preset: state.preset, speed: state.speed });
    },
    setPreset(value) {
      if (!validPresets.has(value)) return;
      state.preset = value;
      localStorage.setItem(STORAGE.preset, value);
      replayVisible();
      log(window.__fb("js.ba_preset", "تم تغيير نمط الحركة"), { preset: state.preset });
    },
    setSpeed(value) {
      state.speed = Math.max(50, Math.min(200, Number(value) || 100));
      localStorage.setItem(STORAGE.speed, String(state.speed));
      sync();
      log(window.__fb("js.ba_speed", "تم تغيير سرعة الحركة"), { speed: state.speed });
    }
  };

  function init() {
    sync();
    const toggle = document.getElementById("foxy-animations-toggle");
    const preset = document.getElementById("foxy-animations-preset");
    const speed = document.getElementById("foxy-animations-speed");
    const speedLabel = document.getElementById("foxy-animations-speed-label");
    if (toggle) {
      toggle.checked = state.enabled;
      toggle.addEventListener("change", () => window.FoxyBetterAnimations.setEnabled(toggle.checked));
    }
    if (preset) {
      preset.value = state.preset;
      preset.addEventListener("change", () => window.FoxyBetterAnimations.setPreset(preset.value));
    }
    if (speed) {
      speed.value = String(state.speed);
      if (speedLabel) speedLabel.textContent = `${state.speed}%`;
      speed.addEventListener("input", () => {
        window.FoxyBetterAnimations.setSpeed(speed.value);
        if (speedLabel) speedLabel.textContent = `${speed.value}%`;
      });
    }
    document.querySelectorAll(".discord-view:not(.hidden-view), .settings-tab-content.active-settings-tab").forEach(element => animate(element, "fade"));
    document.querySelectorAll(".message-row, .member-item, .server-channel-item, .home-card").forEach(element => {
      seen.add(element);
      if (element.matches(".server-channel-item")) {
        const id = element.dataset.channelId || element.id;
        if (id) animatedKeys.add(`channel:${id}:${state.preset}`)
      }
    });
    observeDynamicContent();
    observeViews();
    bindNavigation();
    log(window.__fb("js.ba_layer", "تم تشغيل طبقة الحركات"), {
      enabled: state.enabled,
      preset: state.preset,
      speed: state.speed,
      turbo: document.body.classList.contains("mode-turbo"),
      reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false,
      forcedByFoxySetting: document.body.classList.contains("foxy-ba-force-motion")
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
