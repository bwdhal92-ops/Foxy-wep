let activeTurnServer = "unknown";
function classifyIceEndpoint(e, t, n = "") {
  const r = String(e || "");
  let i = r.includes("expressturn") || r.includes("51.158.") ? "ExpressTURN" : r.includes("rstream") ? "RStream" : r.includes("xirsys") ? "Xirsys" : r.includes("metered") || r.includes("relay.metered") ? "Metered" : r.includes("google") ? "Google STUN" : r.includes("openrelay") ? "OpenRelay" : r.startsWith("turn") ? "TURN (unknown)" : r.startsWith("stun") ? "STUN (unknown)" : "unknown";
  const o = 401 === Number(t) || /unauthorized|credential|auth/i.test(String(n)) ? "turn-server-credentials" : 701 === Number(t) || /lookup|establish|timeout|network|interface/i.test(String(n)) ? "network-or-turn-server" : "unknown";
  return {provider:i, cause:o, url:r, errorCode:t || null, errorText:n || null}
}
window.classifyIceEndpoint = classifyIceEndpoint;
const ICE_SERVERS = [{
  urls: ["turn:free.expressturn.com:3478", "turn:free.expressturn.com:3478?transport=tcp"],
  username: "000000002102707868",
  credential: "FICCI0lZ8TPEmHBWHM4Cx0OWPWY="
}, {
  urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302", "stun:stun4.l.google.com:19302"]
}];

let sortedIceServers = null;
let iceSortingInProgress = false;
let iceSortPromise = null;

let iceSessionLocked = false;
let iceBackgroundRefreshDone = false;
const ICE_PROBE_ATTEMPTS = 1;
const ICE_PROBE_TIMEOUT = 4000;

const ICE_PROBE_MAX_CONCURRENCY = 2;
const ICE_CACHE_KEY = "foxy_ice_sorted_v1";
const ICE_CACHE_TTL = 24 * 3600 * 1000;

const ICE_PROBE_LOCK_KEY = "foxy_ice_probe_lock_v2";
const ICE_PROBE_LOCK_TTL = 2 * 3600 * 1000;

let meteredRefreshPromise = null;
let rstreamRefreshPromise = null;
/* سيرفرات Metered / RStream / Xirsys اتشالوا من قائمة ICE نهائياً (طلب المالك).
   ExpressTURN + STUN جوجل بس. الدالتين الاتنين no-op عشان أي مسار قديم
   (كاش أو استدعاء متبقي) ما يرجّعش السيرفرات المحذوفة تاني. */
function applyRstreamServers() { return false; }
async function refreshRstreamCredentials() { return true; }
function applyMeteredServers() { return false; }
async function refreshMeteredCredentials() { return true; }

try {
  ["foxy_metered_creds_v1", "foxy_rstream_creds_v1", "foxy_ice_sorted_v1"].forEach(function (k) {
    if (localStorage.getItem(k)) localStorage.removeItem(k)
  })
} catch (_) {}

function testSingleServer(server, timeout = 5000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let resolved = false;

    const pc = new RTCPeerConnection({
      iceServers: [server],
      iceTransportPolicy: "relay",
      iceCandidatePoolSize: 0
    });

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        try { pc.close(); } catch (_) {}
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve({ server, latency: Infinity, relayFound: false, stunOnly: server.urls.every(u => u.startsWith("stun:")) });
    }, timeout);

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const c = e.candidate;
      if (c.type === "relay" || (server.urls.some(u => u.startsWith("stun:")) && c.type === "srflx")) {
        const latency = Date.now() - startTime;
        clearTimeout(timer);
        cleanup();
        resolve({ server, latency, relayFound: c.type === "relay", stunOnly: false });
      }
    };

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        cleanup();
        resolve({ server, latency: Infinity, relayFound: false, stunOnly: server.urls.every(u => u.startsWith("stun:")) });
      }
    };

    pc.createDataChannel("probe");
    pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(() => {
      clearTimeout(timer);
      cleanup();
      resolve({ server, latency: Infinity, relayFound: false, stunOnly: false });
    });
  });
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = new Array(Math.max(1, Math.min(limit, items.length))).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await worker(items[i], i);
      } catch (_) {
        results[i] = null;
      }
    }
  });
  await Promise.all(runners);
  return results;
}

async function benchmarkIceServers() {

  const probed = (await runWithConcurrency(ICE_SERVERS, ICE_PROBE_MAX_CONCURRENCY, async (s) => {
    const stunOnly = s.urls.every(u => String(u).startsWith("stun:"));
    const attempts = [];
    for (let k = 0; k < ICE_PROBE_ATTEMPTS; k++) {
      attempts.push(await testSingleServer(s, ICE_PROBE_TIMEOUT));
    }
    const ok = attempts.filter(a => a.latency < Infinity);
    const fails = ICE_PROBE_ATTEMPTS - ok.length;

    const eliminated = !stunOnly && fails >= ICE_PROBE_ATTEMPTS && ok.length === 0;
    let medianLatency = Infinity;
    let relayFound = false;
    if (!eliminated && ok.length > 0) {
      const sorted = ok.map(a => a.latency).sort((x, y) => x - y);
      medianLatency = sorted[Math.floor(sorted.length / 2)];
      relayFound = ok.some(a => a.relayFound);

      if (!stunOnly && !relayFound) {
        medianLatency = Infinity;
      }
    }
    return { server: s, latency: eliminated ? Infinity : medianLatency, relayFound: eliminated ? false : relayFound, stunOnly, successes: ok.length, fails, eliminated };
  })).filter(Boolean);

  probed.sort((a, b) => {
    if (a.eliminated && !b.eliminated) return 1;
    if (!a.eliminated && b.eliminated) return -1;
    if (a.stunOnly && !b.stunOnly) return 1;
    if (!a.stunOnly && b.stunOnly) return -1;
    if (a.relayFound && !b.relayFound) return -1;
    if (!a.relayFound && b.relayFound) return 1;
    return a.latency - b.latency;
  });

  const best = probed.find(r => !r.eliminated && r.latency < Infinity);
  if (best) {
    const name = best.server.urls[0].includes("expressturn") ? "ExpressTURN"
      : best.server.urls[0].includes("rstream") ? "RStream"
      : best.server.urls[0].includes("xirsys") ? "Xirsys"
      : best.server.urls[0].includes("metered") ? "Metered"
      : best.server.urls[0].includes("openrelay") ? "OpenRelay"
      : best.server.urls[0].includes("google") ? "Google STUN" : "Unknown";

    window.foxyLog("info", "[Foxy][ICE] أفضل سيرفر:", { server: name, medianMs: best.latency, successes: best.successes });
  } else {
    window.foxyLog("warn", "[Foxy][ICE] كل سيرفرات TURN فشلت — سيتم استخدام الترتيب الافتراضي مع STUN fallback");
  }
  const dropped = probed.filter(r => r.eliminated).map(r =>
    r.server.urls[0].includes("expressturn") ? "ExpressTURN"
      : r.server.urls[0].includes("rstream") ? "RStream"
      : r.server.urls[0].includes("xirsys") ? "Xirsys"
      : r.server.urls[0].includes("openrelay") ? "OpenRelay"
      : r.server.urls[0].includes("standard.relay.metered") ? "Metered" : r.server.urls[0]);
  if (dropped.length) window.foxyLog("warn", "[Foxy][ICE] سيرفرات مستبعدة (فشلت كل المحاولات):", dropped);

  return probed.map(r => r.server);
}

function saveIceCache(sorted) {
  try {
    const order = sorted.map(s => s.urls[0]);
    localStorage.setItem(ICE_CACHE_KEY, JSON.stringify({ order, ts: Date.now() }));
  } catch (_) {}
}

function claimIceProbeSlot() {
  try {
    const raw = localStorage.getItem(ICE_PROBE_LOCK_KEY);
    const now = Date.now();
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.ts && (now - p.ts) < ICE_PROBE_LOCK_TTL) return false;
    }
    localStorage.setItem(ICE_PROBE_LOCK_KEY, JSON.stringify({ ts: now }));
    return true;
  } catch (_) {

    return true;
  }
}
function releaseIceProbeSlot() {

  try {
    const raw = localStorage.getItem(ICE_PROBE_LOCK_KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (!p || (Date.now() - (p.ts || 0)) < ICE_PROBE_LOCK_TTL) {
      localStorage.removeItem(ICE_PROBE_LOCK_KEY);
    }
  } catch (_) {}
}

function loadIceCache() {
  try {
    const raw = localStorage.getItem(ICE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.order) || !parsed.ts) return null;
    if (Date.now() - parsed.ts > ICE_CACHE_TTL) return null;
    const mapped = parsed.order
      .map(url0 => ICE_SERVERS.find(s => s.urls[0] === url0))
      .filter(Boolean);

    ICE_SERVERS.forEach(s => { if (!mapped.includes(s)) mapped.push(s); });
    if (!mapped.length) return null;
    return mapped;
  } catch (_) { return null; }
}

async function getSortedIceServers(opts = {}) {
  const forceFresh = !!(opts && opts.forceFresh);
  if (sortedIceServers && !forceFresh) return sortedIceServers;
  if (iceSortPromise && !forceFresh) return iceSortPromise;

  const refreshCreds = () => Promise.all([refreshMeteredCredentials(), refreshRstreamCredentials()]);

  const hasSlot = forceFresh ? (claimIceProbeSlot(), true) : claimIceProbeSlot();

  if (!forceFresh && !iceSessionLocked) {
    const cached = loadIceCache();
    if (cached) {
      sortedIceServers = cached;
      iceSessionLocked = true;
      if (hasSlot) {
        window.foxyLog("info", "[Foxy][ICE] دخول فوري من الكاش — إعادة اختبار هادئة في الخلفية...");
        if (!iceBackgroundRefreshDone) {
          iceBackgroundRefreshDone = true;
          setTimeout(() => {
            refreshCreds().then(() => benchmarkIceServers()).then(fresh => {
              sortedIceServers = fresh;
              saveIceCache(fresh);
              const b = fresh[0] ? fresh[0].urls[0] : "unknown";
              window.foxyLog("info", "[Foxy][ICE] تحديث خلفي صامت اكتمل (للمكالمات الجديدة فقط):", b);
            }).catch(() => {});
          }, 3000);
        }
      } else {
        window.foxyLog("info", "[Foxy][ICE] قفل اختبار ICE نشط على هذه الشبكة — استخدام الكاش فوراً (0 PCs)");
      }
      return sortedIceServers;
    }
  }

  if (!hasSlot) {

    sortedIceServers = ICE_SERVERS.slice();
    iceSessionLocked = true;
    window.foxyLog("info", "[Foxy][ICE] قفل اختبار ICE نشط — الترتيب الثابت بدون أي PCs إضافية");
    return sortedIceServers;
  }

  iceSortPromise = refreshCreds().then(() => benchmarkIceServers()).then(sorted => {
    sortedIceServers = sorted;
    iceSessionLocked = true;
    iceSortingInProgress = false;

    if (!sorted.length) releaseIceProbeSlot();
    saveIceCache(sorted);
    return sorted;
  }).catch(() => {
    releaseIceProbeSlot();
    iceSortingInProgress = false;
    sortedIceServers = ICE_SERVERS.slice();
    return sortedIceServers;
  });

  iceSortingInProgress = true;
  return iceSortPromise;
}

function getPeerServerOptions() {
  try {
    const raw = localStorage.getItem("foxy_peer_server");
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.host) {
        return { host: p.host, port: p.port || 443, path: p.path || "/", secure: p.secure !== false };
      }
    }
  } catch (_) {}
  return {};
}
window.getPeerServerOptions = getPeerServerOptions;

(function migrateForceRelayFlag() {
  var MARKER = "foxy_force_relay_migrated_v1";
  try {
    if (localStorage.getItem(MARKER)) return;
    localStorage.setItem(MARKER, "1");
    if (localStorage.getItem("voiceChat_forceRelay") === "true") {
      localStorage.setItem("voiceChat_forceRelay", "false");
      window.foxyLog && window.foxyLog("info", "[Foxy][ICE] تم تصفير force-relay المتبقّي من محرّك LiveKit القديم (لم يبق هناك كاتِب تلقائي)", {
        timestamp: new Date().toISOString()
      });
    }
  } catch (_) {}
})();

function getIceConfig(e = !1) {
  const t = document.getElementById("force-relay"),
    r = t ? t.checked : "true" === localStorage.getItem("voiceChat_forceRelay");
  return {
    iceServers: sortedIceServers || ICE_SERVERS,

    iceCandidatePoolSize: 1,
    iceTransportPolicy: r && !e ? "relay" : "all",
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    sdpSemantics: "unified-plan"
  }
}

function detectActiveTurnServer(e) {
  if (!e) return;
  let t = "Relay (Unknown)",
    r = "#10b981";
  const n = e.includes("expressturn") || e.includes("51.158.") || e.includes("212.47.") || e.includes("62.210."),
    a = e.includes("metered") || e.includes("172.232.") || e.includes("74.207.") || e.includes("104.200."),
    s = e.includes("rstream"),
    x = e.includes("xirsys");

  const _prevProvider = activeTurnServer;
  n ? (activeTurnServer = "ExpressTURN", t = "⭐ ExpressTURN", r = "#34d399") : a && "ExpressTURN" !== activeTurnServer ? (activeTurnServer = "Metered", t = "🔵 Metered", r = "#60a5fa") : s && "ExpressTURN" !== activeTurnServer && "Metered" !== activeTurnServer ? (activeTurnServer = "RStream", t = "🟣 RStream", r = "#c084fc") : x && "ExpressTURN" !== activeTurnServer && "Metered" !== activeTurnServer && "RStream" !== activeTurnServer ? (activeTurnServer = "Xirsys", t = "🟠 Xirsys", r = "#fb923c") : !n && !a && !s && !x && "ExpressTURN" !== activeTurnServer && "Metered" !== activeTurnServer && "RStream" !== activeTurnServer && "Xirsys" !== activeTurnServer && e.includes("relay") && (activeTurnServer = "Relay (Unknown)"),

  _prevProvider !== activeTurnServer && (optimizeIceForSession(activeTurnServer), window.foxyLog("info", "[Foxy][ICE] تم اكتشاف مرشح ترحيل", {provider: n ? "ExpressTURN" : a ? "Metered" : s ? "RStream" : x ? "Xirsys" : "Relay (Unknown)", displayedProvider: activeTurnServer, timestamp: new Date().toISOString()})), updateTurnIndicator()
}

let _iceSessionOptimized = false;
function _providerIndex(provider) {
  const find = sub => ICE_SERVERS.findIndex(s => String(s.urls[0] || "").includes(sub));
  return "ExpressTURN" === provider ? find("expressturn") : -1
}
function _trimUrls(server) {
  const urls = Array.isArray(server.urls) ? server.urls : [server.urls];

  const udp = urls.find(u => u.includes("transport=tcp") ? !1 : !u.startsWith("turns:")), tcp = urls.find(u => u.includes("transport=tcp"));
  const out = [udp || urls[0]];
  if (tcp && tcp !== udp) out.push(tcp);
  return Array.from(new Set(out))
}
function optimizeIceForSession(provider) {
  if (_iceSessionOptimized) return;
  const idx = _providerIndex(provider);
  if (idx < 0) return;
  const active = ICE_SERVERS[idx];
  if (!active) return;
  const backupIdx = ICE_SERVERS.findIndex((s, i) => i !== idx && /turn:/.test(String(s.urls[0] || "")));
  const google = ICE_SERVERS.findIndex(s => /stun.*google\.com/.test(String(s.urls[0] || "")));
  const trimmed = [Object.assign({}, active, {urls: _trimUrls(active)})];
  if (backupIdx >= 0) trimmed.push(Object.assign({}, ICE_SERVERS[backupIdx], {urls: _trimUrls(ICE_SERVERS[backupIdx])}));
  if (google >= 0) trimmed.push(ICE_SERVERS[google]);
  ICE_SERVERS.splice(0, ICE_SERVERS.length, ...trimmed);

  sortedIceServers = trimmed;
  _iceSessionOptimized = true;
  if (window.FOXY_DEBUG) console.log("[ICE] تم تقليل قائمة سيرفرات ICE للجلسة:", trimmed.map(s => s.urls[0]))
}

function updateTurnIndicator() {
  const e = document.getElementById("turn-server-indicator");
  e && ("ExpressTURN" === activeTurnServer ? (e.textContent = window.__fb("app_system_messages.express_turn_active", "⭐ ExpressTURN نشط"), e.className = "text-[10px] font-bold text-emerald-400 text-center mt-1") : "Metered" === activeTurnServer ? (e.textContent = window.__fb("app_system_messages.metered_active", "🔵 Metered نشط"), e.className = "text-[10px] font-bold text-blue-400 text-center mt-1") : "RStream" === activeTurnServer ? (e.textContent = "🟣 RStream نشط", e.className = "text-[10px] font-bold text-purple-400 text-center mt-1") : "Xirsys" === activeTurnServer ? (e.textContent = "🟠 Xirsys نشط", e.className = "text-[10px] font-bold text-orange-400 text-center mt-1") : "Relay (Unknown)" === activeTurnServer ? (e.textContent = window.__fb("js.relay_public", "🟢 ترحيل عام نشط"), e.className = "text-[10px] font-bold text-green-400 text-center mt-1") : (e.textContent = window.__fb("js.no_conn", "⏳ لم يتصل بعد"), e.className = "text-[10px] text-gray-500 text-center mt-1"))
}

let p2pFailureCount = 0;
const P2P_FAILURE_THRESHOLD = 2;
function markP2pFailure() {
  p2pFailureCount++;
  if (p2pFailureCount >= P2P_FAILURE_THRESHOLD) {

    window.foxyLog("warn", "[Foxy][network] فشل اتصال P2P أكثر من مرة؛ لن يتم إجبار Relay تلقائيًا لأن خوادم TURN غير مؤكدة الصلاحية.", {
      failureCount: p2pFailureCount,
      forceRelay: false,
      timestamp: new Date().toISOString()
    });
    p2pFailureCount = 0;
    return false;
  }
  return false;
}
function resetP2pFailureCount() { p2pFailureCount = 0; }
window.markP2pFailure = markP2pFailure;
window.resetP2pFailureCount = resetP2pFailureCount;
window.getSortedIceServers = getSortedIceServers;
window.rebenchmarkIce = async function() {
  iceSessionLocked = false;
  iceBackgroundRefreshDone = true;
  sortedIceServers = null;
  iceSortPromise = null;
  meteredRefreshPromise = null;
  rstreamRefreshPromise = null;
  addSystemMsg && addSystemMsg(window.__fb("js.ice_rebench", "🔄 جاري إعادة اختبار سيرفرات ICE..."), "info");
  await getSortedIceServers({ forceFresh: true });
  addSystemMsg && addSystemMsg(window.__fb("js.ice_updated", "✅ تم تحديث ترتيب السيرفرات بنجاح!"), "success");
};