const fs = require('fs');
const path = require('path');

const SUPPORTED = ['ar', 'en', 'fr', 'es', 'de', 'tr', 'ru', 'pt'];
const cache = {};
let langFilePath = null;
let memLang = null;

function init(userDataPath) {
  try {
    if (userDataPath) langFilePath = path.join(userDataPath, 'foxy-lang.json');
  } catch (e) { /* ignore */ }
}

function i18nDir() {
  try {
    return path.join(__dirname, '..', 'assets', 'i18n');
  } catch (e) {
    return null;
  }
}

function unwrap(data, lang) {
  if (data && typeof data === 'object' && data[lang] && typeof data[lang] === 'object') return data[lang];
  return (data && typeof data === 'object') ? data : {};
}

function deepMerge(base, over) {
  const out = Object.assign({}, base);
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) &&
        out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], over[k]);
    } else {
      out[k] = over[k];
    }
  }
  return out;
}

function loadLang(lang) {
  if (cache[lang]) return cache[lang];
  const dir = i18nDir();
  let base = {};
  let data = {};
  try { base = unwrap(JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8')), 'en'); } catch (e) {}
  if (lang === 'en') {
    try { data = unwrap(JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8')), 'en'); } catch (e) {}
    cache[lang] = Object.keys(data).length ? data : base;
  } else {
    try { data = unwrap(JSON.parse(fs.readFileSync(path.join(dir, lang + '.json'), 'utf8')), lang); } catch (e) {}
    cache[lang] = deepMerge(base, data);
  }
  return cache[lang];
}

function current() {
  if (memLang && SUPPORTED.includes(memLang)) return memLang;
  try {
    if (langFilePath && fs.existsSync(langFilePath)) {
      const saved = JSON.parse(fs.readFileSync(langFilePath, 'utf8'));
      if (saved && SUPPORTED.includes(saved.lang)) return saved.lang;
    }
  } catch (e) {}
  return 'ar';
}

function set(lang) {
  if (!SUPPORTED.includes(lang)) return current();
  memLang = lang;
  try {
    if (langFilePath) fs.writeFileSync(langFilePath, JSON.stringify({ lang }, null, 2));
  } catch (e) {}
  return lang;
}

function t(key, vars) {
  const dict = loadLang(current());
  const parts = String(key).split('.');
  let cur = dict;
  for (const p of parts) {
    if (cur == null || cur[p] === undefined) { cur = null; break; }
    cur = cur[p];
  }
  let out = (typeof cur === 'string') ? cur : key;
  if (vars && typeof vars === 'object') {
    out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  }
  return out;
}

module.exports = { init, current, set, t, SUPPORTED };
