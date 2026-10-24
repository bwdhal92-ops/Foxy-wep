! function() {
  let t = 0,
    e = 0,
    n = !1,
    i = null,
    o = 0,
    s = null;
  const l = () => ("ontouchstart" in window || navigator.maxTouchPoints > 0) && window.matchMedia("(max-width: 1024px)").matches;
  const isSettingsViewActive = () => {
    const e = document.getElementById("view-settings");
    return !!(e && !e.classList.contains("hidden-view"));
  };
  document.addEventListener("touchstart", a => {
    if (!l()) return;
    t = a.touches[0].clientX, e = a.touches[0].clientY, n = !1, s = null, i = null;
    const r = document.getElementById("voice-chat-overlay"),
      d = document.getElementById("server-members-sidebar"),
      c = document.getElementById("ss-sidebar"),
      m = document.getElementById("re-sidebar");
    if (c && !c.classList.contains("translate-x-full") && (document.documentElement.dir !== "ltr" ? t > window.innerWidth - 256 : t < 256)) i = c, o = 0;
    else if (m && !m.classList.contains("translate-x-full") && (document.documentElement.dir !== "ltr" ? t > window.innerWidth - 256 : t < 256)) i = m, o = 0;
    else if (r && r.classList.contains("active")) {
      i = r;
      const t = document.getElementById("chat-messages");
      o = t ? t.scrollTop : 0
    } else if (d && d.classList.contains("active")) {
      i = d;
      const t = d.querySelector(".flex-1.overflow-y-auto");
      o = t ? t.scrollTop : 0
    } else {
      const t = document.querySelector(".mobile-integrated-bar");
      if (t && t.contains(a.target)) {
        i = t, o = 0;
        const e = document.getElementById("mobile-extra-options");
        e && (e.dataset.initialMaxH = e.offsetHeight)
      }
    }
  }, {
    passive: !0
  }), document.addEventListener("touchmove", a => {
    if (!l()) return;
    const r = a.touches[0].clientX,
      d = a.touches[0].clientY,
      c = r - t,
      m = d - e;
    if (n || (Math.abs(c) > 10 || Math.abs(m) > 10) && (n = !0, s = Math.abs(c) > Math.abs(m) ? "horizontal" : "vertical", "function" == typeof window.toggleProfilePopout && window.toggleProfilePopout(!1)), n) {

      if (isSettingsViewActive()) return;
      let t = !1;
      if ("horizontal" === s ? a.composedPath().some(t => {
          if (!(t instanceof HTMLElement)) return !1;
          const e = window.getComputedStyle(t);
          return !("auto" !== e.overflowX && "scroll" !== e.overflowX || t.scrollWidth <= t.clientWidth) && (c > 0 ? t.scrollLeft > 0 : c < 0 && t.scrollLeft < t.scrollWidth - t.clientWidth - 1)
        }) || (t = !0) : "vertical" === s && i && m > 0 && o <= 5 && (t = !0), t && a.cancelable && a.preventDefault(), t)
        if ("horizontal" === s) {
          const t = document.querySelector(".discord-main"),
            e = document.body.classList.contains("mobile-main-open");
          if (i === document.getElementById("ss-sidebar") || i === document.getElementById("re-sidebar")) {
            const rtlS = document.documentElement.dir !== "ltr", closeDx = rtlS ? c : -c;
            if (closeDx > 0) {
              const t = Math.min(100, closeDx / 256 * 100);
              i.style.transition = "none", i.style.transform = `translateX(${rtlS ? t : -t}%)`
            }
          } else if (t) {
            const n = document.getElementById("view-server-settings"),
              i = n && !n.classList.contains("hidden-view"),
              o = document.getElementById("role-editor-overlay"),
              s = o && !o.classList.contains("hidden"),
              l = (document.querySelector(".discord-layout"), document.getElementById("left-panel")),
              a = document.getElementById("icon-rail");
            if (!i && !s) {
              let n = 0;
              const rtlM = document.documentElement.dir !== "ltr";
              rtlM ? (e ? c < 0 && (n = Math.max(-100, c / window.innerWidth * 100), t.style.transition = "none", t.style.transform = `translateX(${n}%)`, document.body.classList.add("is-swiping-main")) : c > 0 && (n = Math.min(0, c / window.innerWidth * 100 - 100), t.style.transition = "none", t.style.transform = `translateX(${n}%)`, t.style.visibility = "visible", t.style.pointerEvents = "all", document.body.classList.add("is-swiping-main"))) : (e ? c > 0 && (n = Math.min(100, c / window.innerWidth * 100), t.style.transition = "none", t.style.transform = `translateX(${n}%)`, document.body.classList.add("is-swiping-main")) : c < 0 && (n = Math.max(0, 100 + c / window.innerWidth * 100), t.style.transition = "none", t.style.transform = `translateX(${n}%)`, t.style.visibility = "visible", t.style.pointerEvents = "all", document.body.classList.add("is-swiping-main")))
            }
          }
        } else if ("vertical" === s && i)
        if (i.classList.contains("mobile-integrated-bar")) {
          const t = document.getElementById("mobile-extra-options"),
            e = document.getElementById("mobile-pull-handle"),
            n = t && !t.classList.contains("hidden");
          if (m > 0 && n) {
            const n = parseInt(t.dataset.initialMaxH || 0);
            if (n > 0) {
              const i = Math.max(0, n - m);
              t.style.transition = "none", t.style.maxHeight = `${i}px`, e && (e.style.transition = "none", e.style.transform = `translateY(${.3*m}px)`)
            }
          } else if (m < 0 && !n) {
            const t = Math.max(-40, m / window.innerHeight * 100);
            i.style.transition = "none", i.style.transform = `translateY(${t}px)`
          }
        } else if (m > 0 && o <= 5) {
        const t = Math.min(110, m / window.innerHeight * 110);
        i.style.transition = "none", i.style.transform = `translateY(${t}%)`
      }
    }
  }, {
    passive: !1
  }), document.addEventListener("touchend", a => {
    if (!l()) return;
    if (isSettingsViewActive()) {
      n = !1, s = null, i = null;
      return;
    }
    const r = a.changedTouches[0].clientX,
      d = a.changedTouches[0].clientY,
      c = r - t,
      m = d - e,
      y = document.querySelector(".discord-main");
    y && (y.style.transition = "", y.style.transform = "", y.style.visibility = "", y.style.pointerEvents = ""), i && (i.classList.contains("mobile-integrated-bar") || (i.style.transition = "", i.style.transform = "")), document.body.classList.remove("is-swiping-main");
    const u = document.getElementById("left-panel"),
      f = document.getElementById("icon-rail");
    if (u && (u.style.transition = "", u.style.transform = ""), f && (f.style.transition = "", f.style.transform = ""), "horizontal" === s)
      if (i === document.getElementById("ss-sidebar")) (document.documentElement.dir !== "ltr" ? c > 60 : c < -60) && "function" == typeof window.toggleServerSettingsSidebar && window.toggleServerSettingsSidebar();
      else if (i === document.getElementById("re-sidebar")) (document.documentElement.dir !== "ltr" ? c > 60 : c < -60) && "function" == typeof window.toggleRoleEditorSidebar && window.toggleRoleEditorSidebar();
    else {
      const t = document.getElementById("view-server-settings"),
        e = t && !t.classList.contains("hidden-view"),
        n = document.getElementById("role-editor-overlay"),
        i = n && !n.classList.contains("hidden");
      if (!e && !i) {
        const t = document.body.classList.contains("mobile-main-open");
        Math.abs(c) > 60 && (document.documentElement.dir !== "ltr" ? (c > 0 && !t ? window.showMobileMainContent() : c < 0 && t && window.showMobileSidePanels()) : (c < 0 && !t ? window.showMobileMainContent() : c > 0 && t && window.showMobileSidePanels()))
      }
    } else if ("vertical" === s && i)
      if (i.classList.contains("mobile-integrated-bar")) {
        const t = document.getElementById("mobile-extra-options"),
          e = document.getElementById("mobile-pull-handle"),
          n = t && !t.classList.contains("hidden");
        m < -60 && !n ? "function" == typeof window.toggleMobileMoreOptions && window.toggleMobileMoreOptions() : m > 30 && n && "function" == typeof window.toggleMobileMoreOptions && window.toggleMobileMoreOptions();
        const o = i;
        requestAnimationFrame(() => {
          o && (o.style.transition = "", o.style.height = "", o.style.maxHeight = "", o.style.transform = ""), t && (t.style.transition = "", t.style.transform = "", t.style.maxHeight = ""), e && (e.style.transition = "", e.style.transform = "")
        })
      } else m > 60 && o <= 5 && ("server-members-sidebar" === i.id ? window.toggleMembersSidebar() : window.toggleVoiceChatOverlay());
    n = !1, s = null, i = null
  }, {
    passive: !0
  })
}();
