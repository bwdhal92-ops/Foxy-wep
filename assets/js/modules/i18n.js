/* Foxy i18n — multi-language core (ar, en, fr, es, de, tr, ru, pt)
 * - localStorage key: foxy-lang (shared across landing / app / login)
 * - fallback chain: lang -> en -> ar -> key
 * - supports: data-i18n, data-i18n-placeholder, data-i18n-title, data-i18n-aria, data-i18n-content (meta)
 * - auto-fills any <select class="foxy-lang-select">
 * - handles rtl/ltr + fonts, dispatches `languageChanged`
 */
(function () {
  'use strict';

  if (typeof window !== 'undefined') {
    window.__ = window.__ || function (k) { return k; };
    window.__fb = window.__fb || function (k, fb) { return fb !== undefined ? fb : k; };
    window.__f = window.__f || function (k, vars, fb) {
      var tpl = (fb !== undefined ? fb : k);
      if (typeof tpl !== 'string') return tpl;
      if (vars && typeof vars === 'object') {
        tpl = tpl.replace(/\{(\w+)\}/g, function (_, key) {
          return vars[key] !== undefined ? vars[key] : '{' + key + '}';
        });
      }
      return tpl;
    };
  }

  var STORAGE_KEY = 'foxy-lang';
  var BASE_LANG = 'en';

  var I18N_BASE = (function () {
    try {
      var src = (document.currentScript && document.currentScript.src) || '';
      var i = src.indexOf('/assets/js/i18n.js');
      if (i !== -1) return src.slice(0, i + 1);
      var scripts = document.getElementsByTagName('script');
      for (var k = scripts.length - 1; k >= 0; k--) {
        var s2 = scripts[k].src || '';
        var j = s2.indexOf('/assets/js/i18n.js');
        if (j !== -1) return s2.slice(0, j + 1);
      }
    } catch (e) {}
    return '';
  })();

  var SUPPORTED = {
    ar: { name: 'العربية', native: 'العربية', flag: '🇸🇦', dir: 'rtl', font: "'Cairo','Tajawal',sans-serif" },
    en: { name: 'English', native: 'English', flag: '🇬🇧', dir: 'ltr', font: "'Outfit','Inter',sans-serif" },
    fr: { name: 'French', native: 'Français', flag: '🇫🇷', dir: 'ltr', font: "'Outfit','Inter',sans-serif" },
    es: { name: 'Spanish', native: 'Español', flag: '🇪🇸', dir: 'ltr', font: "'Outfit','Inter',sans-serif" },
    de: { name: 'German', native: 'Deutsch', flag: '🇩🇪', dir: 'ltr', font: "'Outfit','Inter',sans-serif" },
    tr: { name: 'Turkish', native: 'Türkçe', flag: '🇹🇷', dir: 'ltr', font: "'Outfit','Inter',sans-serif" },
    ru: { name: 'Russian', native: 'Русский', flag: '🇷🇺', dir: 'ltr', font: "'Outfit','Inter',sans-serif" },
    pt: { name: 'Portuguese', native: 'Português', flag: '🇧🇷', dir: 'ltr', font: "'Outfit','Inter',sans-serif" }
  };

  function supportedList() { return Object.keys(SUPPORTED); }

  function detectBrowserLang() {
    try {
      var candidates = [];
      try {
        if (Array.isArray(navigator.languages) && navigator.languages.length) {
          candidates = candidates.concat(navigator.languages);
        }
      } catch (e) {}
      if (navigator.language) candidates.push(navigator.language);
      if (navigator.userLanguage) candidates.push(navigator.userLanguage);
      for (var i = 0; i < candidates.length; i++) {
        var short = String(candidates[i] || '').toLowerCase().slice(0, 2);
        if (SUPPORTED[short]) return short;
      }
      return 'ar';
    } catch (e) { return 'ar'; }
  }

  function getStoredLang() {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      if (s && SUPPORTED[s]) return s;
    } catch (e) {}
    return null;
  }

  function getSavedLang() {
    var stored = getStoredLang();
    if (stored) return stored;
    return detectBrowserLang();
  }

  var currentLang = getSavedLang();
  var cache = {};
  var rawCache = {};

  function unwrap(data, lang) {
    if (!data) return {};
    if (data[lang] && typeof data[lang] === 'object') return data[lang];
    return data;
  }

  function isPlainObj(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
  }

  function deepMerge(base, over) {
    var out = {};
    var k;
    for (k in base) {
      if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    }
    for (k in over) {
      if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
      if (isPlainObj(over[k]) && isPlainObj(out[k])) out[k] = deepMerge(out[k], over[k]);
      else out[k] = over[k];
    }
    return out;
  }

  function fetchJson(lang) {
    return fetch(I18N_BASE + 'assets/i18n/' + lang + '.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('i18n 404 ' + lang);
        return res.json();
      })
      .then(function (data) { return unwrap(data, lang); })
      .catch(function () { return null; });
  }

  function loadLang(lang) {
    if (cache[lang]) return Promise.resolve(cache[lang]);
    var wantBase = lang !== BASE_LANG ? fetchJson(BASE_LANG) : Promise.resolve(null);
    return Promise.all([wantBase, fetchJson(lang)]).then(function (parts) {
      var baseData = parts[0] || {};
      var langData = parts[1] || {};
      var merged;
      if (lang === BASE_LANG) {
        merged = langData && Object.keys(langData).length ? langData : {};
        if (!Object.keys(merged).length) {
          return fetchJson('ar').then(function (ar) {
            merged = ar || {};
            rawCache[lang] = langData;
            cache[lang] = merged;
            return merged;
          });
        }
      } else {
        merged = deepMerge(baseData || {}, langData || {});
      }
      rawCache[lang] = langData;
      cache[lang] = merged;
      return merged;
    });
  }

  function getNested(obj, path) {
    if (!obj || !path) return null;
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || cur[parts[i]] === undefined) return null;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function t(key, vars) {
    var dict = cache[currentLang] || {};
    var v = getNested(dict, key);
    if (v == null && currentLang !== BASE_LANG && cache[BASE_LANG]) {
      v = getNested(cache[BASE_LANG], key);
    }
    if (v == null && currentLang !== 'ar' && cache['ar']) {
      v = getNested(cache['ar'], key);
    }
    if (v == null) return key;
    if (typeof v !== 'string') return v;
    if (vars && typeof vars === 'object') {
      v = v.replace(/\{(\w+)\}/g, function (_, k) {
        return vars[k] !== undefined ? vars[k] : '{' + k + '}';
      });
    }
    return v;
  }

  function applyToElement(el, dict) {
    var key, val;
    if (el.hasAttribute('data-i18n')) {
      if ((el.id === 'current-user-email' || el.id === 'mobile-current-user-email') && window.currentUserProfile && window.currentUserProfile.displayName) {
        el.removeAttribute('data-i18n');
        return;
      }
      if (el.id === 'current-mic-name' || el.id === 'current-speaker-name' || el.id === 'current-camera-name') {
        el.removeAttribute('data-i18n');
        return;
      }
      key = el.getAttribute('data-i18n');
      val = getNested(dict, key);
      if (val == null && cache[BASE_LANG]) val = getNested(cache[BASE_LANG], key);
      if (typeof val === 'string') {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.setAttribute('placeholder', val);
        else if (el.tagName === 'IMG') el.setAttribute('alt', val);
        else if (el.tagName === 'META') el.setAttribute('content', val);
        else if (el.tagName === 'TITLE') el.textContent = val;
        else el.innerHTML = val;
      }
    }
    if (el.hasAttribute('data-i18n-placeholder')) {
      key = el.getAttribute('data-i18n-placeholder');
      val = getNested(dict, key);
      if (val == null && cache[BASE_LANG]) val = getNested(cache[BASE_LANG], key);
      if (typeof val === 'string') el.setAttribute('placeholder', val);
    }
    if (el.hasAttribute('data-i18n-title')) {
      key = el.getAttribute('data-i18n-title');
      val = getNested(dict, key);
      if (val == null && cache[BASE_LANG]) val = getNested(cache[BASE_LANG], key);
      if (typeof val === 'string') el.setAttribute('title', val);
    }
    if (el.hasAttribute('data-i18n-aria')) {
      key = el.getAttribute('data-i18n-aria');
      val = getNested(dict, key);
      if (val == null && cache[BASE_LANG]) val = getNested(cache[BASE_LANG], key);
      if (typeof val === 'string') el.setAttribute('aria-label', val);
    }
    if (el.hasAttribute('data-i18n-content')) {
      key = el.getAttribute('data-i18n-content');
      val = getNested(dict, key);
      if (val == null && cache[BASE_LANG]) val = getNested(cache[BASE_LANG], key);
      if (typeof val === 'string') el.setAttribute('content', val);
    }
  }

  function applyTranslation(dict) {
    dict = dict || cache[currentLang] || {};
    try {
      document.querySelectorAll('[data-i18n],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria],[data-i18n-content]').forEach(function (el) {
        applyToElement(el, dict);
      });
    } catch (e) {}
    syncSelectors();
    if (typeof window.foxyApplySettingsI18n === 'function') {
      try { window.foxyApplySettingsI18n(dict, currentLang); } catch (e) {}
    }
  }

  function applyDocumentAttrs() {
    var info = SUPPORTED[currentLang] || SUPPORTED.ar;
    try {
      document.documentElement.lang = currentLang;
      document.documentElement.dir = info.dir;
      document.body.style.fontFamily = info.font + ",'Cairo',sans-serif";
    } catch (e) {}
  }

  function optionLabel(code) {
    var info = SUPPORTED[code];
    if (!info) return code;
    return info.flag + '  ' + info.native;
  }

  function syncSelectors() {
    try {
      document.querySelectorAll('select.foxy-lang-select, select#foxy-lang-select').forEach(function (sel) {
        if (!sel.options.length || sel.dataset.i18nReady !== 'true') {
          sel.innerHTML = '';
          supportedList().forEach(function (code) {
            var opt = document.createElement('option');
            opt.value = code;
            opt.textContent = optionLabel(code);
            sel.appendChild(opt);
          });
          sel.dataset.i18nReady = 'true';
        } else {
          Array.prototype.forEach.call(sel.options, function (opt) {
            if (SUPPORTED[opt.value]) opt.textContent = optionLabel(opt.value);
          });
        }
        sel.value = currentLang;
      });
      var cur = document.getElementById('foxy-lang-current');
      if (cur) {
        var info = SUPPORTED[currentLang];
        cur.textContent = info.flag + ' ' + info.native;
      }
    } catch (e) {}
  }

  function setLang(lang, opts) {
    if (!SUPPORTED[lang]) return Promise.resolve(currentLang);
    opts = opts || {};
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    try {
      if (window.electronAPI && window.electronAPI.setAppLanguage) window.electronAPI.setAppLanguage(lang);
    } catch (e) {}
    applyDocumentAttrs();
    return loadLang(lang).then(function (dict) {
      applyTranslation(dict);
      try {
        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: lang } }));
      } catch (e) {}
      if (opts.updateUrl !== false) {
        try {
          var url = new URL(window.location.href);
          url.searchParams.set('lang', lang);
          window.history.replaceState({}, '', url.toString());
        } catch (e) {}
      }
      return lang;
    });
  }

  function init() {
    try {
      var url = new URL(window.location.href);
      var q = url.searchParams.get('lang');
      if (q && SUPPORTED[q]) {
        currentLang = q;
        try { localStorage.setItem(STORAGE_KEY, q); } catch (e) {}
      } else if (!getStoredLang()) {
        try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (e) {}
      }
    } catch (e) {}
    applyDocumentAttrs();
    loadLang(currentLang).then(function (dict) {
      if (currentLang !== BASE_LANG && !cache[BASE_LANG]) {
        return loadLang(BASE_LANG).then(function () { return dict; });
      }
      return dict;
    }).then(function (dict) {
      applyTranslation(dict);
    });

    var timer = null;
    function schedule() {
      if (timer) return;
      timer = setTimeout(function () {
        timer = null;
        var dict = cache[currentLang];
        if (dict) applyTranslation(dict);
      }, 250);
    }
    try {
      var obs = new MutationObserver(function (mutations) {
        var needs = false;
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.type === 'childList' && (m.addedNodes || []).length) { needs = true; break; }
        }
        if (needs) schedule();
      });
      obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch (e) {}

    document.addEventListener('change', function (e) {
      var el = e.target;
      if (el && (el.classList && el.classList.contains('foxy-lang-select') || el.id === 'foxy-lang-select')) {
        if (el.value && el.value !== currentLang) setLang(el.value);
      }
    });
  }

  window.__ = t;
  window.__fb = function (key, fb) {
    try {
      var v = t(key);
      if (v == null || v === key) return fb !== undefined ? fb : key;
      return v;
    } catch (e) { return fb !== undefined ? fb : key; }
  };
  window.__f = function (key, vars, fb) {
    var tpl;
    try {
      var v = t(key);
      tpl = (v == null || v === key) ? (fb !== undefined ? fb : key) : v;
    } catch (e) { tpl = fb !== undefined ? fb : key; }
    if (typeof tpl !== 'string') return tpl;
    if (vars && typeof vars === 'object') {
      tpl = tpl.replace(/\{(\w+)\}/g, function (_, k) {
        return vars[k] !== undefined ? vars[k] : '{' + k + '}';
      });
    }
    return tpl;
  };
  window.foxyI18n = {
    getLang: function () { return currentLang; },
    setLang: setLang,
    t: t,
    tfb: window.__fb,
    tf: window.__f,
    getSupported: function () { return SUPPORTED; },
    getSupportedList: supportedList,
    loadLang: loadLang,
    apply: function () { return loadLang(currentLang).then(applyTranslation); },
    retranslate: function () { return loadLang(currentLang).then(applyTranslation); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
