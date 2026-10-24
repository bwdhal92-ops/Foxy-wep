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
  urls: ["turn:aws-us-west-2-1.c.rstream.io:3478?transport=udp", "turn:aws-us-west-2-1.c.rstream.io:3478?transport=tcp", "turns:aws-us-west-2-1.c.rstream.io:5349?transport=udp", "turns:aws-us-west-2-1.c.rstream.io:5349?transport=tcp"],
  username: "v1:1789797682:api:19fccb1f:cmu7yx7bg000004jxylbswmhe",
  credential: "WTmTzORZ9mkgy0FDXgfBb6R1KPnl5gVaP/VOfzH91NI="
}, {
  urls: ["stun:stun.relay.metered.ca:80", "turn:standard.relay.metered.ca:80", "turn:standard.relay.metered.ca:443", "turn:standard.relay.metered.ca:443?transport=tcp", "turns:standard.relay.metered.ca:443?transport=tcp"],
  username: "0e907a25df78bdf663ae4ca8",
  credential: "vbjowbXIHJXBR9r8"
}, {
  urls: ["stun:openrelay.metered.ca:80", "turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443", "turn:openrelay.metered.ca:443?transport=tcp"],
  username: "openrelayproject",
  credential: "openrelayproject"
}, {
  urls: ["stun:fr-turn7.xirsys.com"],
  username: "vyNKPFIKqmdz-d5_kUDyOBbObrJO_HeaamoYUuRhr1uaK-iOMZb4PwEp4H48WeaNAAAAAGquJZRhZGFkYWQ=",
  credential: "c4ab67dc-b3ef-11f1-8171-e6237eaa29b2"
}, {
  urls: ["turn:fr-turn7.xirsys.com:80?transport=udp", "turn:fr-turn7.xirsys.com:3478?transport=udp", "turn:fr-turn7.xirsys.com:80?transport=tcp", "turn:fr-turn7.xirsys.com:3478?transport=tcp", "turns:fr-turn7.xirsys.com:443?transport=tcp", "turns:fr-turn7.xirsys.com:5349?transport=tcp"],
  username: "vyNKPFIKqmdz-d5_kUDyOBbObrJO_HeaamoYUuRhr1uaK-iOMZb4PwEp4H48WeaNAAAAAGquJZRhZGFkYWQ=",
  credential: "c4ab67dc-b3ef-11f1-8171-e6237eaa29b2"
}, {
  // قائمة STUN/TURN الكاملة مقصودة: تغطية أوسع لشبكات المنطقة
  // (symmetric NAT، CGNAT، شبكات مشغولة). الضغط على هذه السيرفرات لم يعد
  // قادماً من عدد الروابط، بل من تكرار فتح PCs اختبار — وهو ما عولج في
  // runWithConcurrency (بحد أقصى 2 متزامن) + قفل localStorage بساعتين
  // + ICE_PROBE_ATTEMPTS = 1. поэтому نُبقي كل العناوين كما هي.
  urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302", "stun:stun4.l.google.com:19302"]
}];

let sortedIceServers = null;
let iceSortingInProgress = false;
let iceSortPromise = null;
// تثبيت الترتيب طول الجلسة: بعد أول اختيار ناجح لا نعيد الترتيب تلقائياً
// (إعادة الاختبار الخلفية بعد استعادة الكاش فقط، وتؤثر على المكالمات الجديدة فقط)
let iceSessionLocked = false;
let iceBackgroundRefreshDone = false;
const ICE_PROBE_ATTEMPTS = 1;
const ICE_PROBE_TIMEOUT = 4000;
// أقصى عدد RTCPeerConnection اختبارية مفتوحة في نفس اللحظة.
// سابقاً: 7 سيرفرات × 3 محاولات = 21 PC متزامن لكل عميل.
// عند دخول العضو الخامس من نفس الراوتر كان ده يعني 105 PC اختبار
// متزامن من نفس الـ Public IP على 5 سيرفرات TURN مجانية => حظر/تأخير
// => فشل ICE شامل => عاصفة recall => تجميد. الآن بحد أقصى 2 في نفس اللحظة.
const ICE_PROBE_MAX_CONCURRENCY = 2;
const ICE_CACHE_KEY = "foxy_ice_sorted_v1";
const ICE_CACHE_TTL = 24 * 3600 * 1000;
// قفل مشترك: يمنع كل تبويب/عميل جديد من إعادة اختبار 21->2 PCsprobe
// على نفس الشبكة. TTL ساعتين. المفتاح عمومي على الأصل (origin) لأن
// نتيجة الاختبار واحدة لكل شبكة، والتكلفة هي ما نحصره.
const ICE_PROBE_LOCK_KEY = "foxy_ice_probe_lock_v2";
const ICE_PROBE_LOCK_TTL = 2 * 3600 * 1000;
// جلب credentials طازة من Metered API بدل الثابتة — مع fallback للثابتة لو فشل.
// ملحوظة: الـ API Key ظاهر في كود الواجهة (أي حد يقدر يجيب TURN على كوتتك)،
// راقب الـ Quota من الداشبورد، وانقل الجلب لـ backend لاحقاً لو الاستهلاك زاد.
const METERED_API_URL = "https://voicechatt.metered.live/api/v1/turn/credentials?apiKey=bd6ba07d724db688be572698a00470eca958";
const METERED_CRED_CACHE_KEY = "foxy_metered_creds_v1";
const METERED_CRED_TTL = 6 * 3600 * 1000;
let meteredRefreshPromise = null;
let rstreamRefreshPromise = null;
const RSTREAM_PROXY_URL = "api/rstream-turn.php";
const RSTREAM_CRED_CACHE_KEY = "foxy_rstream_creds_v1";
const RSTREAM_CRED_TTL = 8 * 60 * 1000; // أقل من ttl السيرفر (10 دقايق) عشان متستخدمش credential ميتة

function applyRstreamServers(data) {
  const list = Array.isArray(data) ? data : (data && data.urls ? [data] : []);
  if (!list.length) return false;
  const clean = list.filter(s => s && (Array.isArray(s.urls) || typeof s.urls === "string") && s.username && (s.credential || s.password));
  if (!clean.length) return false;
  const normalized = clean.map(s => ({
    urls: Array.isArray(s.urls) ? s.urls : [s.urls],
    username: s.username,
    credential: s.credential || s.password
  }));
  const idx = ICE_SERVERS.findIndex(s => (s.urls[0] || "").includes("rstream"));
  if (idx >= 0) ICE_SERVERS.splice(idx, 1, ...normalized);
  else ICE_SERVERS.splice(2, 0, ...normalized);
  return true;
}

async function refreshRstreamCredentials() {
  if (rstreamRefreshPromise) return rstreamRefreshPromise;
  rstreamRefreshPromise = (async () => {
    try {
      const raw = localStorage.getItem(RSTREAM_CRED_CACHE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && Array.isArray(p.list) && p.ts && Date.now() - p.ts < RSTREAM_CRED_TTL && applyRstreamServers(p.list)) {
          window.foxyLog("info", "[Foxy][ICE] RStream credentials من الكاش (طازة)");
          return true;
        }
      }
    } catch (_) {}
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => { try { ctrl.abort(); } catch (_) {} }, 6000);
      const res = await fetch(RSTREAM_PROXY_URL, { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(timer);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (data && data.error) throw new Error(data.error);
      if (applyRstreamServers(data)) {
        try { localStorage.setItem(RSTREAM_CRED_CACHE_KEY, JSON.stringify({ list: Array.isArray(data) ? data : [data], ts: Date.now() })); } catch (_) {}
        window.foxyLog("info", "[Foxy][ICE] RStream credentials طازة من الـ proxy ✅");
        return true;
      }
      throw new Error("empty list");
    } catch (e) {
      window.foxyLog("warn", "[Foxy][ICE] فشل جلب RStream credentials — fallback للثابتة", { err: (e && e.message) || String(e) });
      return false;
    }
  })();
  return rstreamRefreshPromise;
}

function applyMeteredServers(list) {
  if (!Array.isArray(list) || !list.length) return false;
  const clean = list.filter(s => s && (Array.isArray(s.urls) || typeof s.urls === "string"));
  if (!clean.length) return false;
  const idx = ICE_SERVERS.findIndex(s => (s.urls[0] || "").includes("standard.relay.metered"));
  const normalized = clean.map(s => ({
    urls: Array.isArray(s.urls) ? s.urls : [s.urls],
    username: s.username,
    credential: s.credential || s.password
  }));
  if (idx >= 0) ICE_SERVERS.splice(idx, 1, ...normalized);
  else ICE_SERVERS.splice(1, 0, ...normalized);
  return true;
}

function loadMeteredCredCache() {
  try {
    const raw = localStorage.getItem(METERED_CRED_CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !Array.isArray(p.list) || !p.ts) return null;
    if (Date.now() - p.ts > METERED_CRED_TTL) return null;
    return p.list;
  } catch (_) { return null; }
}

async function refreshMeteredCredentials() {
  if (meteredRefreshPromise) return meteredRefreshPromise;
  meteredRefreshPromise = (async () => {
    // كاش طازة (≤6 ساعات) يكفي — لا داعي لطلب جديد كل دخول
    const cached = loadMeteredCredCache();
    if (cached && applyMeteredServers(cached)) {
      window.foxyLog("info", "[Foxy][ICE] Metered credentials من الكاش (طازة)");
      return true;
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => { try { ctrl.abort(); } catch (_) {} }, 6000);
      const res = await fetch(METERED_API_URL, { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(timer);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (applyMeteredServers(data)) {
        try { localStorage.setItem(METERED_CRED_CACHE_KEY, JSON.stringify({ list: data, ts: Date.now() })); } catch (_) {}
        window.foxyLog("info", "[Foxy][ICE] Metered credentials طازة من الـ API ✅");
        return true;
      }
      throw new Error("empty list");
    } catch (e) {
      window.foxyLog("warn", "[Foxy][ICE] فشل جلب Metered credentials — fallback للثابتة", { err: (e && e.message) || String(e) });
      return false;
    }
  })();
  return meteredRefreshPromise;
}

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

// تشغيل مجموعة العمليات بتوازٍ محدود (ICE_PROBE_MAX_CONCURRENCY)
// بدل Promise.all الكامل. سابقاً: 21 PC اختبار في نفس اللحظة.
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
  // 1 محاولة لكل سيرفر (ICE_PROBE_ATTEMPTS) وبحد أقصى 2 PCs متزامنة.
  // النتيجة: 2 PCs في نفس اللحظة بدل 21 => ضغط TURN/free-STUN ينخفض
  // بنسبة 90%+, وهو سببантجميد الغرفة عند دخول العضو الخامس من نفس الراوتر.
  const probed = (await runWithConcurrency(ICE_SERVERS, ICE_PROBE_MAX_CONCURRENCY, async (s) => {
    const stunOnly = s.urls.every(u => String(u).startsWith("stun:"));
    const attempts = [];
    for (let k = 0; k < ICE_PROBE_ATTEMPTS; k++) {
      attempts.push(await testSingleServer(s, ICE_PROBE_TIMEOUT));
    }
    const ok = attempts.filter(a => a.latency < Infinity);
    const fails = ICE_PROBE_ATTEMPTS - ok.length;
    // اللي يفشل (كل المحاولات) يخرج بره الترتيب — ما عدا STUN الاحتياطي
    const eliminated = !stunOnly && fails >= ICE_PROBE_ATTEMPTS && ok.length === 0;
    let medianLatency = Infinity;
    let relayFound = false;
    if (!eliminated && ok.length > 0) {
      const sorted = ok.map(a => a.latency).sort((x, y) => x - y);
      medianLatency = sorted[Math.floor(sorted.length / 2)];
      relayFound = ok.some(a => a.relayFound);
      // TURN لازم relay فعلي؛ srflx وحده لا يكفي له
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

// ── قفل اختبار ICE المشترك ────────────────────────────────────────────
// يمنع "انفجار الـ probe" على نفس الشبكة. الإرجاع:
//   true  → هذا العميل هو المسؤول، نفّذ الاختبار وشارك النتيجة
//   false → أحد سبقنا على نفس الشبكة، استخدم الترتيب الثابت فوراً (0 PCs)
// الـ TTLFinite يضمن ألا يتجمد القفل للأبد.
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
    // تخزين معطل: لا نمنع المستخدم أبداً من دخول الغرفة
    return true;
  }
}
function releaseIceProbeSlot() {
  // القفل يبقى عادياً (النتيجة تُشارك). نحرّره فقط لو فشل الاختبار كلياً
  // حتى لا يبقى القفل مفعّلاً بلا نتيجة.
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
    // لو الكاش ناقص سيرفر (تحديث كود)، كمّل الباقي بالترتيب الافتراضي
    ICE_SERVERS.forEach(s => { if (!mapped.includes(s)) mapped.push(s); });
    if (!mapped.length) return null;
    return mapped;
  } catch (_) { return null; }
}

async function getSortedIceServers(opts = {}) {
  const forceFresh = !!(opts && opts.forceFresh);
  if (sortedIceServers && !forceFresh) return sortedIceServers;
  if (iceSortPromise && !forceFresh) return iceSortPromise;

  // جلب الـ credentials رخيص (fetch خلف كاش) ولا يفتح أي RTCPeerConnection،
  // فنتركه يعمل دائماً — هو اللي يحدّث قوائم السيرفرات.
  const refreshCreds = () => Promise.all([refreshMeteredCredentials(), refreshRstreamCredentials()]);

  // ── قفل الـ probe: قاسم واحد على الشبكة ────────────────────────────
  // بدون هذا القفل كان كل تبويب جديد (وكل عضو جديد الغرفة) يفتح
  // ICE_PROBE_MAX_CONCURRENCY PCs اختبار. 5 أعضاء على نفس الراوتر
  // = 10 PCs دفعة واحدة على نفس الـ Public IP. القفل يضمن عميلاً واحداً
  // فقط يفحص، والباقي يستخدم الترتيب الثابت فوراً ودون أي PCs.
  const hasSlot = forceFresh ? (claimIceProbeSlot(), true) : claimIceProbeSlot();

  // دخول فوري من الكاش: نرجّع آخر بطل فوراً، والاختبار (إن كان قفلنا
  // يسمح) يتعمل في الخلفية بهدوء.
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
    // القفل مفعّل ولا يوجد كاش محلي: نستخدم الترتيب الثابت بلا أي اختبار.
    sortedIceServers = ICE_SERVERS.slice();
    iceSessionLocked = true;
    window.foxyLog("info", "[Foxy][ICE] قفل اختبار ICE نشط — الترتيب الثابت بدون أي PCs إضافية");
    return sortedIceServers;
  }

  // مسار طازة (أول دخول أو يدوي): credentials طازة أولاً ثم benchmark
  iceSortPromise = refreshCreds().then(() => benchmarkIceServers()).then(sorted => {
    sortedIceServers = sorted;
    iceSessionLocked = true;
    iceSortingInProgress = false;
    // لو فشل الاختبار كلياً نحرّر القفل حتى يقدر عضو قادم إعادة المحاولة.
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

// PeerJS signaling server override (optional, for bad-cloud days).
// Default = PeerJS public cloud. To use your own server later:
// localStorage.setItem("foxy_peer_server", JSON.stringify({host:"your-vps.com", port:9000, path:"/peerjs", secure:false}))
// localStorage.removeItem("foxy_peer_server") // back to cloud
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

// ── تنظيف flag مسموم من محرّك LiveKit القديم ────────────────────────────────
// كان الكاتِب التلقائي الوحيد لـ voiceChat_forceRelay هو livekit-handler.js
// عند فشل الاتصال: كان يكتب "true" ⇒ iceTransportPolicy = "relay" ⇒ كل صوت
// المستخدم يمرّ عبر سيرفرات TURN عامة مجانية. ومع حذف ذلك الملف، أي مستخدم
// تسمّم flag عنده يبقى محبوساً على relay للأبد بلا سبب.
// التطهير هنا لمرة واحدة فقط (marker)، حتى لا نلغي اختياراً متعمّداً
// من الإعدادات في كل تحميل.
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
    // كان 10 — كل مكالمة تجمع مرشحين من ~20 سيرفر TURN قبل الاتصال،
    // ومع mesh من 5 أعضاء وrecall متكرر ده كان يخنق الجهاز والشبكة.
    // كان 2 — ومع 8 اتصالات WebRTC لكل عضو (قناة بيانات + مكالمة صوت)
    //Pooling مسبق = 16 تخصيص TURN مُحجوز لحظة إنشاء كل PC.
    // 1 الآن: gathering مسبق واحد فقط لكل PC؛ الباقي يجمع بـ trickle
    // أثناء التفاوض. لا يمس جودة الصوت إطلاقاً (التجميع فقط لا البتريت).
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
  // ICE gathers candidates from every configured server. Keep the strongest
  // known provider so a late generic relay candidate cannot overwrite
  // ExpressTURN in the indicator.
  const _prevProvider = activeTurnServer;
  n ? (activeTurnServer = "ExpressTURN", t = "⭐ ExpressTURN", r = "#34d399") : a && "ExpressTURN" !== activeTurnServer ? (activeTurnServer = "Metered", t = "🔵 Metered", r = "#60a5fa") : s && "ExpressTURN" !== activeTurnServer && "Metered" !== activeTurnServer ? (activeTurnServer = "RStream", t = "🟣 RStream", r = "#c084fc") : x && "ExpressTURN" !== activeTurnServer && "Metered" !== activeTurnServer && "RStream" !== activeTurnServer ? (activeTurnServer = "Xirsys", t = "🟠 Xirsys", r = "#fb923c") : !n && !a && !s && !x && "ExpressTURN" !== activeTurnServer && "Metered" !== activeTurnServer && "RStream" !== activeTurnServer && "Xirsys" !== activeTurnServer && e.includes("relay") && (activeTurnServer = "Relay (Unknown)"),
  // اللوق كان يتطبع مع كل مرشح relay (عشرات في الثانية مع 5 أعضاء) ويخنق
  // الثريد خصوصًا والـ DevTools مفتوحة. نسجل فقط عند تغير المزود.
  _prevProvider !== activeTurnServer && window.foxyLog("info", "[Foxy][ICE] تم اكتشاف مرشح ترحيل", {provider: n ? "ExpressTURN" : a ? "Metered" : s ? "RStream" : x ? "Xirsys" : "Relay (Unknown)", displayedProvider: activeTurnServer, timestamp: new Date().toISOString()}), updateTurnIndicator()
}

function updateTurnIndicator() {
  const e = document.getElementById("turn-server-indicator");
  e && ("ExpressTURN" === activeTurnServer ? (e.textContent = window.__fb("app_system_messages.express_turn_active", "⭐ ExpressTURN نشط"), e.className = "text-[10px] font-bold text-emerald-400 text-center mt-1") : "Metered" === activeTurnServer ? (e.textContent = window.__fb("app_system_messages.metered_active", "🔵 Metered نشط"), e.className = "text-[10px] font-bold text-blue-400 text-center mt-1") : "RStream" === activeTurnServer ? (e.textContent = "🟣 RStream نشط", e.className = "text-[10px] font-bold text-purple-400 text-center mt-1") : "Xirsys" === activeTurnServer ? (e.textContent = "🟠 Xirsys نشط", e.className = "text-[10px] font-bold text-orange-400 text-center mt-1") : "Relay (Unknown)" === activeTurnServer ? (e.textContent = window.__fb("js.relay_public", "🟢 ترحيل عام نشط"), e.className = "text-[10px] font-bold text-green-400 text-center mt-1") : (e.textContent = window.__fb("js.no_conn", "⏳ لم يتصل بعد"), e.className = "text-[10px] text-gray-500 text-center mt-1"))
}

function runNetworkDiagnostics() {
  const stunServers = ICE_SERVERS.filter(s => s.urls.some(u => u.startsWith("stun:")));
  if (stunServers.length === 0) return;
  const testServer = stunServers[0];
  try {
    const pc = new RTCPeerConnection({ iceServers: [testServer] });
    pc.createDataChannel("diag");
    pc.createOffer().then(offer => pc.setLocalDescription(offer));
    pc.onicecandidate = e => {
      if (!e.candidate) {
        pc.close();
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        console.warn("تحذير: خادم STUN لا يستجيب - قد تواجه مشاكل في الاتصال");
      }
      pc.close();
    };
  } catch (e) {
    console.warn("فشل اختبار STUN:", e);
  }
}
let p2pFailureCount = 0;
const P2P_FAILURE_THRESHOLD = 2;
function markP2pFailure() {
  p2pFailureCount++;
  if (p2pFailureCount >= P2P_FAILURE_THRESHOLD) {
    // Do not force relay automatically: the configured public TURN servers may
    // be expired/unreachable (401/701), which would turn a recoverable P2P
    // failure into a complete voice outage for every new connection.
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
  iceBackgroundRefreshDone = true; // يدوي = لا حاجة لخلفي تلقائي بعده
  sortedIceServers = null;
  iceSortPromise = null;
  meteredRefreshPromise = null; // يدوي = هات credentials طازة من الـ API
  rstreamRefreshPromise = null; // يدوي = هات RStream طازة من الـ proxy
  addSystemMsg && addSystemMsg(window.__fb("js.ice_rebench", "🔄 جاري إعادة اختبار سيرفرات ICE..."), "info");
  await getSortedIceServers({ forceFresh: true });
  addSystemMsg && addSystemMsg(window.__fb("js.ice_updated", "✅ تم تحديث ترتيب السيرفرات بنجاح!"), "success");
};
