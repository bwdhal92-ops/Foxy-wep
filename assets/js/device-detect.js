/* ═══════════════════════════════════════════════════════════════════════
   Foxy — كشف نوع الجهاز الحقيقي
   ---------------------------------------------------------------
   مش بنعتمد على البكسل لوحده: بنجمع كذا إشارة مع بعض:
     1) Client Hints  (navigator.userAgentData.mobile / platform)
     2) User Agent parsing (أندرويد / آيفون / آيباد /EMOJI …)
     3) قدرات اللمس والـ hover (pointer: coarse / hover: none)
     4) مقاس الشاشة الحقيقي بالـ CSS px + الـ DPR
     5) الاتجاه (بورتريه / أفقي)
   النتيجة بتتحط على <html> قبل أول رسم للصفحة:
     data-device      = mobile | tablet | desktop
     data-touch       = true | false
     data-orientation = portrait | landscape
     data-layout      = mobile | mobile-landscape | desktop
   ومتاح كمان من JS:
     window.foxyDevice        { device, layout, touch, orientation, width, height, dpr }
     window.foxyIsMobile() / foxyIsTablet() / foxyIsDesktop()
     window.foxyIsTouch() / foxyIsLandscape() / foxyLayout()
     window.foxyRefreshDevice()
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var root = document.documentElement;
  if (!root || root.getAttribute("data-device-ready") === "1") return;
  root.setAttribute("data-device-ready", "1");

  var UA_MOBILE = /Android.*Mobile|webOS|iPhone|iPod|BlackBerry|BB10|IEMobile|Opera Mini|Opera Mobi|Windows Phone|Mobile Safari/i;
  var UA_TABLET = /iPad|Android(?!.*Mobile)|Tablet PC|Silk|Kindle|PlayBook|KFAPWI|SM-T|Nexus (7|9|10)|Android.*(Tab|Pad)/i;

  var nav = window.navigator || {};
  var ua = String(nav.userAgent || "");
  var uaData = nav.userAgentData || null;
  var maxTouch = Number(nav.maxTouchPoints || 0);
  var mq = window.matchMedia ? window.matchMedia.bind(window) : null;

  function mqMatches(query) {
    try { return !!(mq && mq(query).matches); } catch (_) { return false; }
  }

  var coarsePointer = mqMatches("(pointer: coarse)");
  var finePointer = mqMatches("(pointer: fine)");
  var hoverNone = mqMatches("(hover: none)");
  var isAndroidApp = !!(window.FoxyNativeApp && window.FoxyNativeApp.isAndroidApp);
  var isElectron = !isAndroidApp && (/Electron/i.test(ua) || !!window.electronAPI || !!window.electron || !!window.process?.versions?.electron);

  /* أصغر بُعد للشاشة بالـ CSS px — الموبايل صغير والتابلت كبير */
  function screenMinEdge() {
    var w = Number(window.screen?.width || 0);
    var h = Number(window.screen?.height || 0);
    if (!w || !h) return 0;
    return Math.min(w, h);
  }

  function looksTabletSized() {
    var minEdge = screenMinEdge();
    if (minEdge) return minEdge >= 600;
    var vw = window.innerWidth || 0;
    var vh = window.innerHeight || 0;
    return Math.min(vw, vh) >= 600;
  }

  function detectDevice() {
    /* 1) Client Hints — أدق إشارة في كروم/إيدج */
    if (uaData && typeof uaData.mobile === "boolean") {
      if (uaData.mobile) return "mobile";
      if ((coarsePointer || maxTouch > 0) && looksTabletSized()) return "tablet";
      return "desktop";
    }

    /* 2) آيباد على iPadOS 13+ بيبلّغ إنه Macintosh */
    if (/Macintosh/i.test(ua) && maxTouch > 1) return "tablet";

    /* 3) UA */
    if (UA_MOBILE.test(ua)) return "mobile";
    if (UA_TABLET.test(ua)) return "tablet";

    /* 4) جهاز لمس بدون ما يعلن نفسه (كثير من أجهزة الأندرويد) */
    if ((coarsePointer || maxTouch > 0) && !finePointer) {
      return looksTabletSized() ? "tablet" : "mobile";
    }
    if ((coarsePointer || maxTouch > 0) && hoverNone && looksTabletSized()) return "tablet";

    /* 5) ديسكتوب (أو تطبيق Electron) */
    return "desktop";
  }

  function isLandscape() {
    var w = window.innerWidth || 0;
    var h = window.innerHeight || 0;
    if (!w || !h) return false;
    return w > h;
  }

  /* ── التخطيط الفعلي: بيجمع نوع الجهاز + البكسل + الاتجاه ── */
  function computeLayout(device) {
    var w = window.innerWidth || 0;
    var h = window.innerHeight || 0;
    var landscape = w > h;
    var compact = w > 0 && w <= 768;

    if (device === "mobile") return landscape ? "mobile-landscape" : "mobile";
    /* التابلت يفضل تخطيط الديسكتوب (أعرض وأفقي) */
    if (device === "tablet") return "desktop";
    /* ديسكتوب في نافذة ضيقة → نفس واجهة الموبايل عشان تت-fit */
    if (compact) return landscape ? "mobile-landscape" : "mobile";
    return "desktop";
  }

  var lastSig = "";

  function apply() {
    var device = detectDevice();
    var layout = computeLayout(device);
    var touch = maxTouch > 0 || coarsePointer;
    var landscape = isLandscape();
    var w = window.innerWidth || 0;
    var h = window.innerHeight || 0;
    var sig = device + "|" + layout + "|" + (touch ? 1 : 0) + "|" + (landscape ? 1 : 0);

    if (window.foxyDevice) {
      window.foxyDevice.width = w;
      window.foxyDevice.height = h;
      window.foxyDevice.dpr = Number(window.devicePixelRatio || 1);
    }
    /* نفس الحالة؟ ما نكتبش في الـ DOM تاني */
    if (sig === lastSig) return window.foxyDevice;
    lastSig = sig;

    root.setAttribute("data-device", device);
    root.setAttribute("data-layout", layout);
    root.setAttribute("data-touch", touch ? "true" : "false");
    root.setAttribute("data-orientation", landscape ? "landscape" : "portrait");
    root.setAttribute("data-viewport", w + "x" + h);

    root.classList.toggle("is-mobile", device === "mobile");
    root.classList.toggle("is-tablet", device === "tablet");
    root.classList.toggle("is-desktop", device === "desktop");
    root.classList.toggle("is-touch", touch);
    root.classList.toggle("is-landscape", landscape);
    root.classList.toggle("is-portrait", !landscape);
    root.classList.toggle("layout-mobile", layout === "mobile");
    root.classList.toggle("layout-mobile-landscape", layout === "mobile-landscape");
    root.classList.toggle("layout-desktop", layout === "desktop");
    root.classList.toggle("is-electron", isElectron);

    window.foxyDevice = {
      device: device,
      layout: layout,
      touch: touch,
      coarse: coarsePointer,
      landscape: landscape,
      orientation: landscape ? "landscape" : "portrait",
      width: w,
      height: h,
      dpr: Number(window.devicePixelRatio || 1),
      screenMinEdge: screenMinEdge(),
      electron: isElectron,
      androidApp: isAndroidApp,
      ua: ua
    };
    document.dispatchEvent(new CustomEvent("foxy:devicechange", { detail: window.foxyDevice }));
    return window.foxyDevice;
  }

  /* ── واجهة برمجية بسيطة ── */
  window.foxyIsMobile = function () { return root.getAttribute("data-device") === "mobile"; };
  window.foxyIsTablet = function () { return root.getAttribute("data-device") === "tablet"; };
  window.foxyIsDesktop = function () { return root.getAttribute("data-device") === "desktop"; };
  window.foxyIsHandheld = function () { var d = root.getAttribute("data-device"); return d === "mobile" || d === "tablet"; };
  window.foxyIsTouch = function () { return root.getAttribute("data-touch") === "true"; };
  window.foxyIsLandscape = function () { return root.getAttribute("data-orientation") === "landscape"; };
  window.foxyLayout = function () { return root.getAttribute("data-layout") || "desktop"; };
  window.foxyIsPhoneLayout = function () { var l = window.foxyLayout(); return l === "mobile" || l === "mobile-landscape"; };
  window.foxyRefreshDevice = apply;

  /* ── إعادة الحساب عند تدوير الموبايل أو تغيير حجم النافذة ── */
  var raf = 0;
  function schedule() {
    if (raf) return;
    raf = window.requestAnimationFrame(function () {
      raf = 0;
      apply();
    });
  }
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("orientationchange", schedule, { passive: true });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", schedule, { passive: true });
  if (mq) {
    var mqChange = function () { schedule(); };
    ["pointer: coarse", "pointer: fine", "hover: none", "hover: hover"].forEach(function (q) {
      try {
        var m = mq(q);
        if (m.addEventListener) m.addEventListener("change", mqChange);
        else if (m.addListener) m.addListener(mqChange);
      } catch (_) {}
    });
  }

  apply();
})();
