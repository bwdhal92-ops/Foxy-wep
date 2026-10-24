
(function () {
  "use strict";
  if (window.__foxyDiagInstalled) return;
  window.__foxyDiagInstalled = true;

  var RING_MAX = 400;
  var TICK_MS = 3000;
  var DEDUPE_MS = 20000;
  var PERSIST_MS = 15000;

  var ring = [];
  var lastSeen = {};
  var firstSeen = {};
  var anomalies = {};

  function now() { return Date.now(); }

  function short(v, n) {
    n = n || 22;
    if (v == null) return "∅";
    v = String(v);
    return v.length > n ? v.slice(0, n) + "…" : v;
  }

  function peerState(peerId) {
    var conn = (window.connections || {})[peerId] || {};
    var call = (window.calls || {})[peerId] || {};
    var pc = call.peerConnection || null;
    var uid = conn.uid || (window.peerIdToUidMap || {})[peerId] || null;
    var pres = uid && (window.state || {}).activeChannelPresenceMap
      ? (window.state.activeChannelPresenceMap || {})[uid] : null;
    var cardId = conn.uid === (window.state || {}).myUid || peerId === (window.state || {}).myUid
      ? "p-card-me"
      : (uid ? "p-card-" + uid : null);
    return {
      peerId: short(peerId, 20),
      uid: short(uid, 24),
      name: short(conn.name, 18),
      dc: conn.conn ? (conn.conn.open ? "open" : (conn.conn.readyState || "closed")) : "none",
      pc: pc ? (pc.connectionState || "?") : "none",
      ice: pc ? (pc.iceConnectionState || "?") : "none",
      pres: pres ? ("connected=" + (pres.connected !== false) + " peerId=" + (pres.peerId ? "yes" : "MISSING")) : "ABSENT",
      hbAge: pres && pres.heartbeatAt ? Math.round((now() - pres.heartbeatAt) / 1000) + "s" : "-",
      card: cardId ? (document.getElementById(cardId) ? "yes" : "NO") : "-"
    };
  }

  function fmtState(s) {
    return "peer=" + s.peerId + " uid=" + s.uid + " name=" + s.name +
      " dc=" + s.dc + " pc=" + s.pc + " ice=" + s.ice +
      " presence[" + s.pres + " hb=" + s.hbAge + "] card=" + s.card;
  }

  function flag(code, subject, detail) {
    var key = code + "|" + subject;
    var t = now();
    if (!firstSeen[key]) firstSeen[key] = t;
    var age = t - firstSeen[key];

    if (age < PERSIST_MS && code !== "CARD_MISSING_PC_ALIVE" &&
        code !== "CONN_NO_UID" && code !== "EVICT_LIVE_PEER") {
      return;
    }
    if (lastSeen[key] && t - lastSeen[key] < DEDUPE_MS) return;
    lastSeen[key] = t;

    var a = anomalies[code] || (anomalies[code] = { count: 0, last: 0, subjects: [] });
    a.count++; a.last = t;
    if (a.subjects.indexOf(subject) === -1 && a.subjects.length < 8) a.subjects.push(subject);

    var msg = "[Foxy][DIAG] " + code + " (" + age / 1000 + "s) " + subject + " — " + detail;
    try { window.foxyLog && window.foxyLog("error", msg); } catch (_) {}
    if (!window.__foxyDiagHinted) {
      window.__foxyDiagHinted = true;
      try {
        console.warn("[Foxy][DIAG] ⇦ خلل مرصود. لما المشكلة تظهر، افتح الكونسول واكتب:  foxyDiagDump()  " +
          "ثم انسخ المخرَج كله وأرسله — التقرير فيه السبب والرقم اللي يحدده.");
      } catch (_) {}
    }
    record({ t: t, code: code, subject: subject, detail: detail, age: age });
  }

  function record(ev) {
    ring.push(ev);
    if (ring.length > RING_MAX) ring.shift();
  }

  var evRate = {};
  window.foxyDiagEvent = function (code, subject, detail) {
    try {
      var k = code + "|" + (subject || "");
      var last = evRate[k] || 0;
      var t = now();
      var c = (evRate[k + "#n"] || 0) + 1;
      evRate[k + "#n"] = c;
      if (t - last < 10000) return;
      evRate[k] = t;
      record({
        t: t, code: code, subject: subject || "",
        detail: detail || "", repeat: c
      });
    } catch (_) {}
  };

  function tick() {
    var st = window.state || {};
    var chan = st.activeVoiceChannelId;
    if (!chan) return;
    var myUid = st.myUid;
    var map = st.activeChannelPresenceMap || {};
    var conns = window.connections || {};
    var calls = window.calls || {};
    var peerIds = Object.keys(conns);
    var liveCount = peerIds.length;

    if (liveCount > 0 && 0 === Object.keys(map).length) {
      flag("PRESENCE_EMPTY", "channel=" + chan,
        "خريطة الحضور فاضية (" + 0 + " عضو) رغم وجود " + liveCount + " اتصال محلي — snapshot ناقصة من RTDB. أي قاعدة تنظيف تعتمد على Presence هتعتبر الكل راح.");
    }

    if (myUid && !map[myUid]) {
      flag("OWN_PRESENCE_MISSING", "uid=" + short(myUid, 24),
        "عقدة حضوري مش في activeChannelPresenceMap ⇒ الشارة الكهرمانية \"جاري الاتصال...\" هتظهر فوق اسمي، وأنا مش موجود عند حد. محاولات الكتابة: " +
        (window._lastPresenceWrite ? Math.round((now() - window._lastPresenceWrite) / 1000) + "s من آخر كتابة" : "لا يوجد"));
    }

    Object.keys(map).forEach(function (uid) {
      var p = map[uid] || {};
      if (uid === myUid || !p.disconnectedAt) return;
      var ageS = Math.round((now() - p.disconnectedAt) / 1000);
      if (ageS < 300) return;
      var live = Object.keys(conns).some(function (pid) {
        var c = conns[pid] || {}, pc = (calls[pid] || {}).peerConnection;
        return (c.uid === uid && c.conn && c.conn.open) ||
          (p.peerId && pid === p.peerId && pc && pc.connectionState === "connected");
      });
      if (!live) {
        flag("STALE_DISCONNECT_NODE", "uid=" + short(uid, 24),
          "disconnectedAt من " + ageS + "ث وبلا اتصال حيّ — العقدة مخفية بالعرض بس ما اتمسحتش. " +
          "(غير ضار: لا تُمسح إلا عند حذف القناة أو مغادرة العضوة الصريحة)");
      }
    });

    peerIds.forEach(function (pid) {
      var s = peerState(pid);
      var pc = calls[pid] && calls[pid].peerConnection;
      var isLegacyScreenPeer = pid && pid.indexOf("screen-") === 0;
      var pcAlive = pc && ("connected" === pc.connectionState || "connecting" === pc.connectionState ||
                           "completed" === pc.iceConnectionState || "connected" === pc.iceConnectionState);

      if (s.uid && s.uid !== "∅" && s.card === "NO" && pcAlive) {
        flag("CARD_MISSING_PC_ALIVE", "uid=" + s.uid,
          "فيه PeerConnection شغّال والحضور موجود بس مافيش بطاقة في #participants-list. " + fmtState(s));
      }

      var cardId = s.uid === "∅" ? null : "p-card-" + s.uid;
      var el = cardId && document.getElementById(cardId);
      if (el && el.classList.contains("card-leave")) {
        flag("CARD_STUCK_LEAVING", "uid=" + s.uid,
          "البطاقة لسه عليها card-leave (opacity:0) بعد " +
          (el._foxyLeaveTimer ? "مؤقت الحذف لسه شغّال" : "المؤقت خلص والعنصر اترك") +
          " ⇒将是 غير مرئية/محذوفة. " + fmtState(s));
      }

      if (pcAlive && s.dc !== "open" && s.dc !== "none" && !isLegacyScreenPeer) {
        flag("CHANNEL_DOWN_PC_UP", "uid=" + s.uid,
          "قناة البيانات مقفولة لكن مسار الصوت/الفيديو شغّال ⇒ الصوت بيوصل والكارت/البيانات بيتمسحوا. SCTP مالهاش keepalive. " + fmtState(s));
      }

      var c = conns[pid] || {};
      // FIX: أقران screen-* القدام (نسخة قبل الـ multiplex) مالهمش uid/presence
      // وكانوا بيطلعوا CONN_NO_UID وCHANNEL_DOWN_PC_UP كاذب ويخلوا الشير يبان معلق.
      if ((!c.uid || "..." === c.name) && s.uid === "∅" && !isLegacyScreenPeer) {
        flag("CONN_NO_UID", "peer=" + short(pid, 20),
          "اتصال من غير uid/اسم (intro ما وصلش أو اتنسى). " + fmtState(s));
      }

      var pres = s.uid !== "∅" && map[s.uid];
      if (pres && !pres.peerId && pres.connected !== false && s.uid !== myUid) {
        flag("PRESENCE_MISSING_PEERID", "uid=" + s.uid,
          "عقدة الحضور موجودة و connected=true بس peerId مفقود ⇒ لا scheduler يتصل بيه، وأي كود يفترض peerId هيتخطّاه. " + fmtState(s));
      }
    });

    if (s.uid !== "∅" && "function" == typeof window.isPeerIdShaped && window.isPeerIdShaped(s.uid)) {
      flag("UID_IS_PEERID", "peer=" + short(pid, 20),
        "connections[" + short(pid, 20) + "].uid = " + s.uid +
        " وده peerId مش Firebase uid ⇒ الكارت بيتسمّى غلط وbe() بيمسحه. " + fmtState(s));
    }

    var list = document.getElementById("participants-list");
    if (list) {
      Array.prototype.forEach.call(list.children, function (el) {
        if (!el.id || el.id.indexOf("p-card-") !== 0) return;
        var uid = el.getAttribute("data-uid");
        if (!uid || uid === myUid) return;
        if (map[uid]) return;
        var isSig = Object.keys(conns).some(function (p) { return (conns[p] || {}).uid === uid; });
        if (isSig) return;
        flag("CARD_NO_PRESENCE", "uid=" + short(uid, 24),
          "في بطاقة على الشاشة بس مافيش حضور لها وولا اتصال — شبح واجهة.");
      });
    }
  }

  window.foxyDiagDump = function () {
    var st = window.state || {};
    var conns = window.connections || {};
    var calls = window.calls || {};
    var map = st.activeChannelPresenceMap || {};
    var lines = [];
    var i;

    lines.push("════ Foxy RTC diagnostic ════ " + new Date().toISOString());
    lines.push("channel=" + (st.activeVoiceChannelId || "none") +
      " myUid=" + short(st.myUid, 24) + " myPeerId=" + short(window.myId, 20) +
      " online=" + (navigator.onLine !== false) + " hidden=" + !!document.hidden);
    lines.push("counts: presence=" + Object.keys(map).length +
      " connections=" + Object.keys(conns).length +
      " calls=" + Object.keys(calls).length +
      " cards=" + (function () {
        var l = document.getElementById("participants-list");
        if (!l) return 0;
        try {
          return l.querySelectorAll ? l.querySelectorAll(".participant-card").length
            : Array.prototype.filter.call(l.children || [], function (c) {
                return c.className && c.className.indexOf("participant-card") !== -1;
              }).length;
        } catch (_) { return "?"; }
      })());

    lines.push("");
    lines.push("── per-peer ──");
    Object.keys(conns).forEach(function (pid) { lines.push("  " + fmtState(peerState(pid))); });
    if (!Object.keys(conns).length) lines.push("  (no connections)");

    lines.push("");
    lines.push("── presence entries ──");
    Object.keys(map).forEach(function (uid) {
      var p = map[uid] || {};
      lines.push("  uid=" + short(uid, 24) + " name=" + short(p.name, 20) +
        " peerId=" + (p.peerId ? "yes" : "MISSING") +
        " connected=" + (p.connected !== false) +
        " hbAge=" + (p.heartbeatAt ? Math.round((now() - p.heartbeatAt) / 1000) + "s" : "-") +
        " token=" + (p.presenceToken ? short(p.presenceToken, 12) : "MISSING"));
    });
    if (!Object.keys(map).length) lines.push("  (presence map EMPTY)");

    lines.push("");
    lines.push("── anomalies detected ──");
    var codes = Object.keys(anomalies);
    if (!codes.length) lines.push("  none");
    codes.forEach(function (c) {
      var a = anomalies[c];
      lines.push("  " + c + " x" + a.count + " last=" + new Date(a.last).toISOString() +
        " subjects=" + a.subjects.join(","));
    });

    lines.push("");
    lines.push("── last " + Math.min(ring.length, 60) + " events ──");
    for (i = Math.max(0, ring.length - 60); i < ring.length; i++) {
      var e = ring[i];
      lines.push("  " + new Date(e.t).toISOString().slice(11, 23) + " " +
        e.code + (e.subject ? " [" + e.subject + "]" : "") +
        (e.repeat > 1 ? " (x" + e.repeat + ")" : "") +
        (e.detail ? " — " + e.detail : ""));
    }

    var out = lines.join("\n");
    try { console.log(out); } catch (_) {}
    try { window.foxyLog("info", "[Foxy][DIAG] اكتمل التقرير — انسخ الكونسول كله وأرسله"); } catch (_) {}
    return out;
  };

  window.foxyDiag = function (verbose) {
    window.FOXY_DIAG_VERBOSE = verbose !== false;
    try { console.info("[Foxy][DIAG] verbose=" + window.FOXY_DIAG_VERBOSE +
      " — window.foxyDiagDump() يطبع التقرير الكامل"); } catch (_) {}
  };
  window.foxyDiagOff = function () {
    if (window.__foxyDiagTimer) { clearInterval(window.__foxyDiagTimer); window.__foxyDiagTimer = null; }
    try { console.info("[Foxy][DIAG] stopped"); } catch (_) {}
  };

  function start() {
    if (window.__foxyDiagTimer) return;
    window.__foxyDiagTimer = setInterval(function () { try { tick(); } catch (_) {} }, TICK_MS);
    window.__foxyDiagTimer.unref && window.__foxyDiagTimer.unref();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
