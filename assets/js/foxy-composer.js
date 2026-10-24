/* ══════════════════════════════════════════════════════════════════════════
   Composer موحّد لصناديق كتابة الشات (رسالة خاصة / قناة سيرفر / شات الغرفة)
   ──────────────────────────────────────────────────────────────────────────
   المشكلة: نفس صندوق الكتابة كان مكتوب 4 مرات في web.html (DM، سيرفر،
   فويس، مودال DM) بكلاسيس مختلفة وأزرار مختلفة — فأي تعديل بيتعمل في
   مكان ومينساش في الباقي.

   الحل: الكود كله في مكان واحد (<template id="foxy-composer-template">
   في web.html)، وكل صندوق بيتركّب من نقطة تركيب واحدة:

     <div data-foxy-composer
          data-composer-input="home-dm-input"
          data-composer-send="home-dm-send-btn"
          data-composer-attach="media|menu"
           data-composer-buttons="attach,camera,voice,one-time,quality,cancel"
          data-composer-typing="home-dm-typing-indicator"
          data-composer-aria="app_chat.dm_aria_label"
          data-composer-aria-text="رسالة خاصة"
          data-composer-ph-key="app_chat.dm_placeholder"
          data-composer-ph-text="اكتب رسالتك الخاصة هنا..."></div>

   الملف ده كلاسيك (مش module) وبيتحمّل في آخر الـ body، فبيتركّب الصندوق
   أثناء تحليل الصفحة وقبل ما أي module يشيل العناصر.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var TPL_ID = "foxy-composer-template";

  function build(host) {
    var tpl = document.getElementById(TPL_ID);
    if (!tpl || !host) return null;
    var inputId = host.getAttribute("data-composer-input");
    if (!inputId) return null;

    var attach = host.getAttribute("data-composer-attach") || "menu";
    var buttons = (host.getAttribute("data-composer-buttons") || "attach,voice,quality")
      .split(",")
      .map(function (s) { return s.trim(); })
      .filter(Boolean);

    var map = {
      "__INPUT__": inputId,
      "__SEND__": host.getAttribute("data-composer-send") || (inputId + "-send-btn"),
      "__ATTACH_I18N__": "web.h033",
      "__ATTACH_TITLE__": "إرفاق ملف أو إنشاء تصويت",
      "__ARIA__": host.getAttribute("data-composer-aria") || "",
      "__ARIA_TEXT__": host.getAttribute("data-composer-aria-text") || "رسالة",
      "__PH_KEY__": host.getAttribute("data-composer-ph-key") || "",
      "__PH_TEXT__": host.getAttribute("data-composer-ph-text") || "اكتب رسالتك..."
    };

    var html = tpl.innerHTML;
    Object.keys(map).forEach(function (key) {
      html = html.split(key).join(map[key]);
    });

    host.innerHTML = html;
    var root = host.firstElementChild;
    if (!root) return null;

    // ننسخ إعدادات التركيب على الصندوق نفسه، فأي كود بيلاقيه عن طريق
    // data-composer-target (زي window.foxyComposerAttach) بيقرأ نفس القيم
    // من غير ما يحتاج يعرف نقطة التركيب الأصلية.
    root.setAttribute("data-composer-attach", attach);
    root.setAttribute("data-composer-buttons", buttons.join(","));

    // نشيل الأزرار اللي الصندوق ده مش محتاجها، ونربط مؤشر الكتابة لو موجود.
    Array.prototype.forEach.call(root.querySelectorAll("[data-composer-role]"), function (el) {
      var role = el.getAttribute("data-composer-role");
      if (role === "typing") {
        var typingId = host.getAttribute("data-composer-typing");
        if (typingId) el.id = typingId;
        else el.remove();
        return;
      }
      // قائمة الإرفاق (رفع/فويس/تصويت) ثابتة في كل الصناديق.
      if (role === "menu" || role === "poll") return;
      if (buttons.indexOf(role) === -1) el.remove();
    });

    // الـ i18n بيكتب في placeholder (مش data-placeholder) — فنخلي الـ contenteditable يقراه.
    var inputEl = document.getElementById(inputId);
    if (inputEl && inputEl.hasAttribute("data-i18n-placeholder") && window.MutationObserver) {
      var syncPlaceholder = function () {
        var ph = inputEl.getAttribute("placeholder");
        if (ph) inputEl.setAttribute("data-placeholder", ph);
      };
      new MutationObserver(syncPlaceholder).observe(inputEl, { attributes: true, attributeFilter: ["placeholder"] });
    }

    return root;
  }

  function mountAll() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-foxy-composer]"), function (host) {
      if (host.getAttribute("data-composer-ready")) return;
      host.setAttribute("data-composer-ready", "1");
      build(host);
    });
  }

  /* قراءة/تفريغ نص الصندوق — يدعم <input> و <div contenteditable> */
  window.foxyComposerText = function (el) {
    if (!el) return "";
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return el.value || "";
    return el.innerText || "";
  };
  window.foxyComposerClear = function (el) {
    if (!el) return;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") el.value = "";
    else el.innerHTML = "";
  };

  /* زر الإرفاق: بيفتح قائمة الصندوق (رفع ملف / فويس / تصويت)،
     ولو الصندوق معدّي على "media" بيفتح منتقي الوسائط على طول. */
  window.foxyComposerAttach = function (inputId, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var root = document.querySelector('[data-composer-target="' + inputId + '"]');
    var action = root && root.getAttribute("data-composer-attach");
    if (action !== "media" && typeof window.foxyComposerToggleMenu === "function") {
      window.foxyComposerToggleMenu(inputId, ev);
      return;
    }
    if (window.FoxyMedia && window.FoxyMedia.openPicker) { window.FoxyMedia.openPicker(inputId); return; }
    if (typeof window.foxyPickImage === "function") { window.foxyPickImage(inputId); return; }
    var input = document.getElementById("image-upload-input");
    if (input) { input.setAttribute("data-target", inputId); input.click(); }
  };

  /* كل صندوق له قائمة إرفاق خاصة بيه (متكرّرة من القالب)، فبنتحكم فيهم كلهم */
  window.foxyComposerCloseMenus = function () {
    document.querySelectorAll('[data-composer-role="menu"]').forEach(function (menu) {
      menu.classList.add("hidden");
    });
  };

  window.foxyComposerToggleMenu = function (inputId, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var root = document.querySelector('[data-composer-target="' + inputId + '"]');
    var menu = root && root.querySelector('[data-composer-role="menu"]');
    if (!menu) return;
    var wasHidden = menu.classList.contains("hidden");
    window.foxyComposerCloseMenus();
    if (wasHidden) menu.classList.remove("hidden");
  };

  /* أي دوسة بره القائمة بتقفلها */
  document.addEventListener("click", function (ev) {
    if (!document.querySelector('[data-composer-role="menu"]:not(.hidden)')) return;
    if (ev.target.closest && ev.target.closest('[data-composer-role="menu"]')) return;
    if (ev.target.closest && ev.target.closest('[data-composer-role="attach"]')) return;
    window.foxyComposerCloseMenus();
  });

  /* Escape بيقفل القائمة المفتوحة */
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    window.foxyComposerCloseMenus();
  });

  /* زر "إلغاء الرفع" يظهر فقط لما يكون في مرفقات معلّقة على الصندوق */
  window.foxyComposerSyncCancel = function (inputId, hasItems) {
    var host = document.querySelector('[data-composer-target="' + inputId + '"]');
    if (!host) return;
    var btn = host.querySelector('[data-composer-role="cancel"]');
    if (btn) btn.classList.toggle("hidden", !hasItems);
  };

  /* placeholder صناديق الـ contenteditable يتبع اللغة المختارة */
  document.addEventListener("languageChanged", function () {
    Array.prototype.forEach.call(document.querySelectorAll("[data-composer-target]"), function (root) {
      var input = document.getElementById(root.getAttribute("data-composer-target"));
      if (!input) return;
      var ph = input.getAttribute("placeholder");
      if (ph) input.setAttribute("data-placeholder", ph);
    });
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();

  window.FoxyComposer = { mountAll: mountAll, build: build };
})();
