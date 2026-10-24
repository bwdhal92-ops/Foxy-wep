window.uiReady = !1;
(function initUI() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() { window.uiReady = !0; });
  } else {
    window.uiReady = !0;
  }
})();