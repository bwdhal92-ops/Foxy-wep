(() => {
  const tabs = {
    profile: { title: "الملف الشخصي", titleKey: "app_settings.profile_tab" },
    voice: { title: "الصوت والفيديو", titleKey: "app_settings.voice_tab" },
    privacy: { title: "الخصوصية", titleKey: "app_settings.privacy_section" },
    performance: { title: "الأداء", titleKey: "app_settings.performance_section" },
    appearance: { title: "المظهر", titleKey: "app_settings.appearance_tab" },
    language: { title: "اللغة 🌐", titleKey: "app_settings.language_tab" },
    about: { title: "حول التطبيق", titleKey: "app_settings.about_tab" }
  };

  // تصنيف أقسام الإعدادات حسب محتواها (وليس حسب ترتيبها) حتى لا يتكرر قسم في أكثر من تبويب
  const sectionRules = [
    { tab: "profile", match: el => !!el.querySelector('[data-i18n="app_profile.profile"]') || !!el.querySelector("#settings-banner-preview") },
    { tab: "voice", match: el => !!el.querySelector('[data-i18n="app_settings.voice_settings_header"]') || !!el.querySelector("#mic-options-container") },
    { tab: "voice", match: el => !!el.querySelector('[data-i18n="web.t025"]') },
    { tab: "privacy", match: el => !!el.querySelector('[data-i18n="app_settings.privacy_section"]') },
    { tab: "performance", match: el => !!el.querySelector('[data-i18n="web.t098"]') },
    { tab: "appearance", match: el => !!el.querySelector('[data-i18n="web.t143"]') },
    { tab: "about", match: el => !!el.querySelector('[data-i18n="web.t199"]') },
    { tab: "about", match: el => !!el.querySelector('[data-i18n="app_settings.danger_zone"]') },
    { tab: "language", match: el => el.id === "settings-language-section" || !!el.querySelector('[data-i18n="app_settings.language_tab"]') }
  ];

  const isMobile = () => window.foxyIsPhoneLayout ? window.foxyIsPhoneLayout() : window.matchMedia("(max-width: 767px)").matches;
  const byId = id => document.getElementById(id);

  function setSidebar(open) {
    const sidebar = byId("settings-sidebar");
    const overlay = byId("settings-sidebar-overlay");
    if (!sidebar || !overlay || !isMobile()) return;

    sidebar.classList.toggle("translate-x-full", !open);
    sidebar.classList.toggle("translate-x-0", open);
    if (open) {
      overlay.classList.remove("hidden");
      requestAnimationFrame(() => overlay.classList.remove("opacity-0"));
    } else {
      overlay.classList.add("opacity-0");
      window.setTimeout(() => overlay.classList.add("hidden"), 300);
    }
  }

  window.toggleSettingsSidebar = () => {
    const sidebar = byId("settings-sidebar");
    if (!sidebar) return;
    setSidebar(sidebar.classList.contains("translate-x-full"));
  };

  window.switchSettingsTab = tabName => {
    if (!tabs[tabName]) return;

    document.querySelectorAll(".settings-tab-content").forEach(section => {
      section.classList.toggle("active-settings-tab", section.dataset.settingsTab === tabName);
    });
    document.querySelectorAll("[data-settings-tab]").forEach(button => {
      if (button.classList.contains("settings-nav-item")) {
        button.classList.toggle("active", button.dataset.settingsTab === tabName);
      }
    });
    const title = byId("settings-active-title");
    if (title) {
      const tab = tabs[tabName];
      let label = tab.title;
      try {
        if (tab.titleKey && window.foxyI18n) {
          const v = window.foxyI18n.t(tab.titleKey);
          if (v && v !== tab.titleKey) label = v;
        }
      } catch (e) {}
      title.textContent = label;
    }
    const scrollArea = byId("settings-tabs-scroll");
    if (scrollArea) scrollArea.scrollTo({ top: 0, behavior: "smooth" });
    setSidebar(false);
  };

  // يزيل النسخ المكررة من قسم اللغة (يظهر في أكثر من تبويب أحياناً)
  function dedupeLanguageBlocks(root, content) {
    const headings = Array.from(root.querySelectorAll('[data-i18n="app_settings.language_tab"]'));
    const blocks = [];
    headings.forEach(heading => {
      const block = heading.closest(".space-y-6") || heading.parentElement;
      if (block && blocks.indexOf(block) === -1) blocks.push(block);
    });
    if (blocks.length < 2) return;
    const keep = blocks.find(block => block.parentElement === content) || blocks[0];
    blocks.forEach(block => {
      if (block === keep) return;
      console.warn("[Settings] تم حذف نسخة مكررة من قسم اللغة");
      block.remove();
    });
  }

  function createTabs() {
    const content = byId("settings-tabs-content");
    if (!content || content.dataset.tabsReady === "true") return;
    const scroll = byId("settings-tabs-scroll");
    if (scroll) dedupeLanguageBlocks(scroll, content);
    const nodes = Array.from(content.children);
    if (!nodes.length) return;

    const groups = {};
    const leftovers = [];

    nodes.forEach(node => {
      // إزالة أي نسخة مكررة (نفس الـ id) حتى لا يتكرر قسم داخل أكثر من تبويب
      if (node.id && byId(node.id) !== node) {
        console.warn("[Settings] تم حذف قسم مكرر:", node.id);
        node.remove();
        return;
      }
      let placed = false;
      for (const rule of sectionRules) {
        let hit = false;
        try { hit = !!rule.match(node); } catch (_) { hit = false; }
        if (!hit) continue;
        if (!groups[rule.tab]) groups[rule.tab] = [];
        if (groups[rule.tab].indexOf(node) !== -1) break;
        groups[rule.tab].push(node);
        placed = true;
        break;
      }
      if (!placed) leftovers.push(node);
    });

    if (!Object.keys(groups).length) return;

    Object.keys(tabs).forEach(tabName => {
      const group = groups[tabName];
      if (!group || !group.length) return;
      const section = document.createElement("section");
      section.className = "settings-tab-content";
      section.dataset.settingsTab = tabName;
      group.forEach(node => section.appendChild(node));
      content.appendChild(section);
    });

    if (leftovers.length) {
      // العناصر المخفية (checkboxInputs etc) تفضل مكانها، وما Visible منها يروح لقسم مخفي
      const visible = leftovers.filter(node => {
        const tag = (node.tagName || "").toLowerCase();
        const isHiddenInput = (tag === "input" || tag === "select" || tag === "textarea") &&
          (node.type === "hidden" || node.classList.contains("hidden"));
        return !isHiddenInput && !node.classList.contains("hidden");
      });
      if (visible.length) {
        const extra = document.createElement("section");
        extra.className = "settings-tab-content";
        extra.dataset.settingsTab = "extra";
        visible.forEach(node => extra.appendChild(node));
        content.appendChild(extra);
        console.warn("[Settings] أقسام غير مصنفة:", visible.length);
      }
    }

    content.dataset.tabsReady = "true";
    window.switchSettingsTab("profile");
  }

  const isRTL = () => document.documentElement.dir !== "ltr";
  function enableEdgeSwipe() {
    let gesture = null;
    document.addEventListener("touchstart", event => {
      const view = byId("view-settings");
      const sidebar = byId("settings-sidebar");
      if (!isMobile() || !view || view.classList.contains("hidden-view") || !sidebar) return;
      const touch = event.touches[0];
      const isOpen = !sidebar.classList.contains("translate-x-full");
      const inSidebar = !!event.target.closest?.("#settings-sidebar");
      const interactive = !!event.target.closest?.("button, input, textarea, select, [contenteditable]");
      if ((!isOpen && !interactive) || (isOpen && inSidebar)) {
        gesture = { x: touch.clientX, y: touch.clientY, opening: !isOpen };
        console.info("[Settings Gesture] swipe started", { view: "view-settings", sidebar: isOpen ? "open" : "closed", x: touch.clientX });
      }
    }, { passive: true });

    document.addEventListener("touchmove", event => {
      if (!gesture) return;
      const touch = event.touches[0];
      const dx = touch.clientX - gesture.x;
      const dy = touch.clientY - gesture.y;
      if (Math.abs(dy) > Math.abs(dx)) {
        gesture = null;
        return;
      }
      if (gesture.opening ? (isRTL() ? dx >= 0 : dx <= 0) : (isRTL() ? dx <= 0 : dx >= 0)) return;
      if (event.cancelable) event.preventDefault();
      const sidebar = byId("settings-sidebar");
      if (sidebar) {
        sidebar.style.transition = "none";
        const pct = Math.max(0, Math.min(100, Math.abs(dx) / 256 * 100));
        const progress = isRTL()
          ? (gesture.opening ? 100 - pct : pct)
          : (gesture.opening ? -(100 - pct) : -pct);
        sidebar.style.transform = `translateX(${progress}%)`;
      }
    }, { passive: false });

    document.addEventListener("touchend", event => {
      if (!gesture) return;
      const dx = event.changedTouches[0].clientX - gesture.x;
      const sidebar = byId("settings-sidebar");
      if (sidebar) {
        sidebar.style.transition = "";
        sidebar.style.transform = "";
      }
      const rtlE = isRTL();
      if (gesture.opening && (rtlE ? dx < -60 : dx > 60)) {
        console.info("[Settings Gesture] opening settings sidebar", { deltaX: Math.round(dx) });
        setSidebar(true);
      } else if (!gesture.opening && (rtlE ? dx > 60 : dx < -60)) {
        console.info("[Settings Gesture] closing settings sidebar", { deltaX: Math.round(dx) });
        setSidebar(false);
      }
      gesture = null;
    }, { passive: true });
  }

  const initialize = () => {
    createTabs();
    enableEdgeSwipe();
    document.addEventListener("languageChanged", () => {
      try {
        const activeBtn = document.querySelector(".settings-nav-item.active");
        const key = activeBtn && activeBtn.dataset.settingsTab;
        const title = byId("settings-active-title");
        if (key && tabs[key] && title) {
          let label = tabs[key].title;
          if (tabs[key].titleKey && window.foxyI18n) {
            const v = window.foxyI18n.t(tabs[key].titleKey);
            if (v && v !== tabs[key].titleKey) label = v;
          }
          title.textContent = label;
        }
      } catch (e) {}
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
