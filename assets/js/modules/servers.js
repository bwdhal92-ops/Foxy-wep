import {
  db as e,
  auth as t,
  rtdb as n,
  whenReady,
  getDb,
  getAuth,
  getRtdb
} from "../firebase-config.js";
import {
  compressImage as i,
  uploadToImgBB as o
} from "./mentions.js?v=20260928-3";
import {
  ChatBox as r,
  createMessageHTML as s
} from "./ui-chatcore.js?v=20260929-2";
import {
  createVoicePresence
} from "./voice-presence-core.js?v=20260930-2";
import {
  createAvatarHTML as a,
  applyBannerStyle as c
} from "./ui-avatar-banner.js?v=20260929-2";
import { escapeForAttribute } from "./sanitize.js";
import {
  collection as d,
  doc as l,
  query as m,
  where as u,
  onSnapshot as v,
  getDoc as p,
  getDocs as h,
  setDoc as w,
  updateDoc as f,
  addDoc as g,
  orderBy as y,
  serverTimestamp as b,
  arrayUnion as x,
  arrayRemove as S,
  deleteDoc as C,
  limit as M,
  limitToLast as k,
  increment as L
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.Firebase = {
  get db() { return getDb() || e; },
  get auth() { return getAuth() || t; },
  get rtdb() { return getRtdb() || n; },
  collection: d,
  doc: l,
  query: m,
  where: u,
  onSnapshot: v,
  getDoc: p,
  getDocs: h,
  setDoc: w,
  updateDoc: f,
  addDoc: g,
  arrayUnion: x
};

window.isUserMemberOfServer = function(serverId) {
  if (typeof V !== 'undefined' && V.servers) {
    return V.servers.some(s => s.id === serverId);
  }
  return false;
};

window.getServerComposerContext = function(perm) {
  try {
    if (!V.activeServerId || !V.activeChannelId || "text" !== V.activeChannelType) return { ok: false, reason: "no-channel" };
    const ch = V.channels.find(e => e.id === V.activeChannelId);
    const mem = V.serverMembersData?.[V.myUid];
    if (mem && mem.timeoutUntil && mem.timeoutUntil > Date.now()) return { ok: false, reason: "timeout", mins: Math.ceil((mem.timeoutUntil - Date.now()) / 6e4) };
    if (!me("send_messages", ch)) return { ok: false, reason: "no-send" };
    if (perm && !me(perm, ch)) return { ok: false, reason: "no-perm" };
    if (ch?.isLocked) {
      let owner = false;
      try { owner = se()?.ownerUid === V.myUid; } catch (e) {}
      if (!owner && !me("administrator")) return { ok: false, reason: "locked" };
    }
    return { ok: true, serverId: V.activeServerId, channelId: V.activeChannelId, channel: ch, myUid: V.myUid, displayName: V.myProfile?.displayName || "User", photoURL: V.myProfile?.photoURL || (t.currentUser?.photoURL || "") };
  } catch (e) { return { ok: false, reason: "error" }; }
};

window.joinServerById = async function(serverId) {
  if (!V.myUid) {
    alert(window.__fb("app_profile.login_required", "يجب تسجيل الدخول أولاً"));
    return;
  }
  try {
    const firestoreDb = getDb() || e;
    if (!firestoreDb) {
      alert(window.__fb("js.db_not_ready", "قاعدة البيانات غير جاهزة بعد، يرجى المحاولة بعد لحظات"));
      return;
    }
    const sRef = l(firestoreDb, "servers", serverId);
    if (!(await p(sRef)).exists()) {
      alert(window.__fb("js.srv_not_found", "السيرفر غير موجود"));
      return;
    }
    await f(sRef, {
      memberUids: x(V.myUid),
      updatedAt: b()
    });
    await w(l(firestoreDb, "servers", serverId, "members", V.myUid), {
      joinMethod: "Join",
      joinedAt: b(),
      roles: [],
      effectivePermissions: {}
    }, {
      merge: !0
    });
    if (typeof Ve === 'function') {
      Ve(serverId);
    }

    if (typeof window.switchView === 'function') {
      window.switchView('home');
    }
  } catch (err) {
    console.error(err);
    alert(window.__fb("js.join_fail", "فشل الانضمام للسيرفر"));
  }
};

import {
  ref as U,
  onValue as I,
  set as P,
  update as E,
  onDisconnect as _,
  remove as A,
  get as R,
  serverTimestamp as _serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
window.gifStaticCache = window.gifStaticCache || {};
const V = {
    myUid: null,
    myProfile: null,
    servers: [],
    channels: [],
    activeServerId: null,
    activeChannelId: null,
    activeChannelType: null,
    cachedServerRects: [],
    serversUnsub: null,
    channelsUnsub: null,
    textMessagesUnsub: null,
    activeVoiceSessionRef: null,
    activeVoiceSessionKey: null,
    activeVoiceRoomCode: null,
    activeVoiceStartedAtMs: 0,
    activeVoiceChannelId: null,
    activeVoiceChannelName: null,
    activeVoiceServerId: null,
    isVoiceHost: !1,
    hostHeartbeatTimer: null,
    activeVoiceTimerInterval: null,
    members: [],
    membersUnsub: null,
    serverDocUnsub: null,
    memberStatuses: {},
    memberStatusUnsubs: {},
    voicePresenceUnsub: null,
    voicePresenceMap: {},
    activeVoiceSessionUnsub: null,
    serverRoles: {},
    rolesUnsub: null,
    serverMembersData: {},
    serverMembersDataUnsub: null,
    globalUsersData: {},
    voicePresenceServerId: null,
    speakingMembers: {},
    activeChannelVoicePresenceUnsub: null,
    activeChannelPresenceMap: {},
    prevActiveChannelPresenceMap: null,
    serverVoiceActivity: {},
    serverVoiceUnsubs: {},
    serverActivityUnsub: null,
    serverChatLimit: 50,
     serverChatCache: new Map,
     isServerLoadingMore: !1,
     presenceRefreshInterval: null,
     serverSelectionToken: 0,
     textMessagesToken: 0
  },
  T = new r("server-chat-messages", {
    context: "server",
    infiniteScroll: !0,
    onLoadMore: e => {
      V.serverChatLimit = e, Ie(V.activeServerId, V.activeChannelId)
    }
  });
window.serverChat = T, window.reloadServerMessages = function() {

  if (!V.activeServerId || !V.activeChannelId) return;
  V.serverChatCache && V.serverChatCache.clear();
  try { V.textMessagesUnsub && V.textMessagesUnsub(); } catch (_) {}
  Ie(V.activeServerId, V.activeChannelId)
}, document.addEventListener("visibilitychange", () => {
  document.hidden && V.cachedServerRects && V.cachedServerRects.length > 0 && (V.cachedServerRects = [])
}), window.addEventListener("blur", () => {
  V.cachedServerRects && V.cachedServerRects.length > 0 && (V.cachedServerRects = [])
});
const VP = createVoicePresence({
  db: n,
  getPresencePath: (channelId, serverId) => {
    const sid = serverId || V.activeVoiceServerId;
    const cid = channelId || V.activeVoiceChannelId;
    return sid && cid && V.myUid ? `/voice_presence/${sid}/${cid}/${V.myUid}` : null;
  },
  getActivityPath: () => V.activeVoiceServerId && V.myUid ? `/server_activity/${V.activeVoiceServerId}/${V.myUid}` : null,
  getMyUid: () => V.myUid,
  getMyProfile: () => V.myProfile,
  getConnections: () => window.connections,
  getCalls: () => window.calls,
  getIsHost: () => V.isVoiceHost,
  getPresenceToken: () => window.voicePresenceToken,
  onPresenceChange: (filtered, type) => {
    if (type === "snapshot") {
      // FIX: كان مستمع RTDB يفضل شغال بعد مغادرة القناة، فأي heartbeat
      // من زميل باقٍ في القناة كان بيعيد تعبئة خريطة الحضور وبيعمل schedulePeerDial
      // ⇒ إعادة اتصال بالمشارك بعد ما المستخدم غادر ⇒ بطاقات المشاركين وبطاقة
      // معاينة الشاشة بترجع تظهر من غير سبب. دلوقتي بنتجاهل السبنشن Snapshot
      // طالما مش في جلسة صوتية نشطة.
      const _inVoiceSession = !!(V.activeVoiceChannelId && V.activeVoiceStartedAtMs > 0);
      if (!_inVoiceSession) {
        V.activeChannelPresenceMap = {};
        V.prevActiveChannelPresenceMap = null;
        return;
      }
      V.activeChannelPresenceMap = filtered;
      V.activeVoiceChannelId && window.renderMainRoomParticipants?.(V.activeVoiceChannelId);
      try {
        Object.entries(filtered || {}).forEach(([uid, entry]) => {
          if (uid !== V.myUid && entry && entry.peerId && entry.connected !== false && window.connections && !window.connections[entry.peerId] && typeof window.schedulePeerDial === "function") {
            window.schedulePeerDial(entry.peerId, entry.name || "...", "presence-snap", uid);
          }
        });
      } catch (_) {}
    }
  },
  throttleMs: 45000,
  staleMs: 120000,
  signalLostMs: 120000,
  debugLabel: "server-voice"
});
window.voicePresenceCore = VP;
const j = {
  key: null,
  result: null,
  frameId: -1
};
let D = new Map,
  N = -1;

function O(e, t) {
  const n = performance.now();
  n - N > 100 && (N = n);
  const i = `${e}_${t}`;
  if (!D.has(i)) try {
    D.set(i, parseInt(localStorage.getItem(`readCount_${i}`)) || 0)
  } catch {
    D.set(i, 0)
  }
  return D.get(i)
}
let B = null,
  H = -1;

function q(e, t) {
  let n;
  return function() {
    const i = this,
      o = arguments;
    clearTimeout(n), n = setTimeout(() => {
      requestAnimationFrame(() => {
        e.apply(i, o)
      })
    }, t)
  }
}
const F = q(je, 300),
  z = q(fe, 200),
  J = q(he, 300),
  W = {
    create_instant_invite: 1n,
    kick_members: 2n,
    ban_members: 4n,
    administrator: 8n,
    manage_channels: 16n,
    manage_server: 32n,
    add_reactions: 64n,
    view_audit_log: 128n,
    priority_speaker: 256n,
    stream: 512n,
    view_channel: 1024n,
    send_messages: 2048n,
    send_tts_messages: 4096n,
    manage_messages: 8192n,
    embed_links: 16384n,
    attach_files: 32768n,
    read_message_history: 65536n,
    mention_everyone: 1n << 17n,
    use_external_emojis: 1n << 18n,
    view_guild_insights: 1n << 19n,
    connect: 1n << 20n,
    speak: 1n << 21n,
    mute_members: 1n << 22n,
    deafen_members: 1n << 23n,
    move_members: 1n << 24n,
    use_vad: 1n << 25n,
    change_nickname: 1n << 26n,
    manage_nicknames: 1n << 27n,
    manage_roles: 1n << 28n,
    manage_webhooks: 1n << 29n,
    manage_expressions: 1n << 30n,
    use_application_commands: 1n << 31n,
    request_to_speak: 1n << 32n,
    manage_events: 1n << 33n,
    manage_threads: 1n << 34n,
    create_public_threads: 1n << 35n,
    create_private_threads: 1n << 36n,
    use_external_stickers: 1n << 37n,
    send_messages_in_threads: 1n << 38n,
    use_embedded_activities: 1n << 39n,
    moderate_members: 1n << 40n,
    view_creator_monetization_analytics: 1n << 41n,
    use_soundboard: 1n << 42n,
    create_expressions: 1n << 43n,
    create_events: 1n << 44n,
    use_external_sounds: 1n << 45n,
    send_voice_messages: 1n << 46n
  };

function K(e) {
  const t = {};
  let n = 0n;
  try {
    null != e && "" !== String(e).trim() && (n = BigInt(String(e)))
  } catch (e) {
    return t
  }
  return Object.entries(W).forEach(([e, i]) => {
    (n & i) === i && (t[e] = !0)
  }), t.view_channel && (t.view_channels = !0), t.manage_channels && (t.manage_channel = !0), t.moderate_members && (t.timeout_members = !0), t
}

function G(e, t) {
  const n = {};
  return (e || []).forEach(e => {
    if (0 !== e.type) return;
    const i = t[e.id];
    if (!i) return;
    const o = function(e, t) {
      const n = K(e),
        i = K(t),
        o = {};
      return Object.keys(n).forEach(e => {
        o[e] = !0
      }), Object.keys(i).forEach(e => {
        o[e] = !1
      }), o
    }(e.allow, e.deny);
    Object.keys(o).length > 0 && (n[i] = o)
  }), n
}

function Z(e, t = [], n = null) {
  const i = {};
  return (n || Fe(e)).forEach(e => {
    ("@everyone" === e.id || t.includes(e.id)) && Object.entries(e.permissions || {}).forEach(([e, t]) => {
      !0 === t && (i[e] = !0)
    })
  }), i.view_channel && (i.view_channels = !0), i.view_channels && (i.view_channel = !0), i.manage_channel && (i.manage_channels = !0), i.manage_channels && (i.manage_channel = !0), i.create_invite && (i.create_instant_invite = !0), i.create_instant_invite && (i.create_invite = !0), i.timeout_members && (i.moderate_members = !0), i.moderate_members && (i.timeout_members = !0), i.video && (i.stream = !0), i.stream && (i.video = !0), i
}

function Y(e) {
  return document.getElementById(e)
}

function Q(e) {
  return e ? "number" == typeof e ? e : "function" == typeof e.toMillis ? e.toMillis() : "number" == typeof e.seconds ? 1e3 * e.seconds : 0 : 0
}

function X() {
  return Math.floor(1e5 + 9e5 * Math.random()).toString()
}

function ee(e) {
  e && (e.classList.remove("hidden"), e.id && e.id.endsWith("popup") && e.classList.add("flex"))
}

function te(e) {
  e && (e.classList.remove("flex"), e.classList.add("hidden"))
}

function ne() {
  "function" == typeof window.closeCreateMenu && window.closeCreateMenu()
}

function ie() {
  const e = V.activeVoiceStartedAtMs > 0 ? Date.now() - V.activeVoiceStartedAtMs : 0,
    t = V.activeVoiceStartedAtMs > 0 ? function(e) {
      const t = Math.max(0, Math.floor(e / 1e3)),
        n = Math.floor(t / 3600),
        i = Math.floor(t % 3600 / 60),
        o = t % 60;
      return n > 0 ? `${n.toString().padStart(2,"0")}:${i.toString().padStart(2,"0")}:${o.toString().padStart(2,"0")}` : `${i.toString().padStart(2,"0")}:${o.toString().padStart(2,"0")}`
    }(e) : "00:00",
    n = Y("voice-channel-session-timer");
  n && (V.activeVoiceStartedAtMs > 0 ? (n.textContent = t, n.classList.remove("hidden")) : (n.textContent = "00:00", n.classList.add("hidden")));
  const i = Y("active-room-timer");
  i && (i.textContent = t);
  const o = Y("room-header-timer");
  o && (o.textContent = t)
}

function oe() {
  V.activeVoiceTimerInterval && (clearInterval(V.activeVoiceTimerInterval), V.activeVoiceTimerInterval = null), "function" == typeof window.stopSessionTimer && window.stopSessionTimer()
}

function re(e) {
  return V.servers.find(t => t.id === e) || null
}

function se() {
  return re(V.activeServerId)
}

function ae() {
  return se()?.ownerUid === V.myUid
}

function ce() {
  return ae() || me("administrator") || me("manage_server")
}

function de(e = null) {
  return ae() || me("administrator") || me("manage_channels", e) || me("manage_channel", e)
}

function le() {
  return ae() || me("administrator") || me("manage_roles")
}

function me(e, t = null) {
  const n = se();
  if (!n || !V.myUid) return !1;
  const i = performance.now();
  (null === B || i - H > 16) && (B = new Map, H = i);
  const o = `${e}::${t?.id??""}::${n.id}::${V.myUid}`;
  if (B.has(o)) return B.get(o);
  let r = function(e, t, n) {
    if (n.ownerUid === V.myUid) return !0;
    const i = V.serverMembersData[V.myUid],
      o = i?.roles || [],
      r = Fe(n.id),
      s = r.filter(e => o.includes(e.id));
    if (s.some(e => e.permissions && e.permissions.administrator)) return !0;
    const a = (e, t) => !!e && (!0 === e[t] || "view_channel" === t && !0 === e.view_channels || "view_channels" === t && !0 === e.view_channel || "manage_channel" === t && !0 === e.manage_channels || "manage_channels" === t && !0 === e.manage_channel || "moderate_members" === t && !0 === e.timeout_members || "timeout_members" === t && !0 === e.moderate_members || "create_invite" === t && !0 === e.create_instant_invite || "create_instant_invite" === t && !0 === e.create_invite || "video" === t && !0 === e.stream || "stream" === t && !0 === e.video || "use_voice_activity" === t && !0 === e.use_vad || "use_vad" === t && !0 === e.use_voice_activity || "use_activities" === t && !0 === e.use_embedded_activities || "use_embedded_activities" === t && !0 === e.use_activities);
    if (t && t.permissionOverrides) {
      const n = t.permissionOverrides;
      let i = !1,
        r = !1;
      if ([...o, "@everyone"].forEach(t => {
          const o = n[t];
          var s, c;
          o && (a(o, e) && (i = !0), c = e, (s = o) && (!1 === s[c] || "view_channel" === c && !1 === s.view_channels || "view_channels" === c && !1 === s.view_channel || "manage_channel" === c && !1 === s.manage_channels || "manage_channels" === c && !1 === s.manage_channel || "moderate_members" === c && !1 === s.timeout_members || "timeout_members" === c && !1 === s.moderate_members || "create_invite" === c && !1 === s.create_instant_invite || "create_instant_invite" === c && !1 === s.create_invite || "video" === c && !1 === s.stream || "stream" === c && !1 === s.video || "use_voice_activity" === c && !1 === s.use_vad || "use_vad" === c && !1 === s.use_voice_activity) && (r = !0))
        }), i) return !0;
      if (r) return !1
    }
    if (s.some(t => a(t.permissions, e))) return !0;
    const c = r.find(e => "@everyone" === e.name || "@everyone" === e.id);
    return !(!c || !a(c.permissions, e)) || !!["view_channel", "connect", "speak", "send_messages", "read_message_history", "attach_files", "add_reactions", "manage_messages", "manage_channel", "create_instant_invite", "video", "stream", "use_voice_activity", "use_activities", "mute_members", "deafen_members", "move_members", "timeout_members"].includes(e) && (!t || !t.isLocked)
  }(e, t, n);
  return B.set(o, r), r
}

function isVoiceAdminUid(uid) {
  try {
    const srv = se();
    if (!srv || !uid) return false;
    if (srv.ownerUid === uid) return true;
    const m = V.serverMembersData && V.serverMembersData[uid];
    const roles = (m && m.roles) || [];
    if (!roles.length) return false;
    const all = (typeof Fe === "function" && Fe(srv.id)) || [];
    return all.some(r => roles.includes(r.id) && r.permissions && (r.permissions.administrator || r.permissions.kick_members || r.permissions.mute_members || r.permissions.deafen_members || r.permissions.move_members));
  } catch (_) { return false; }
}
window.isVoiceAdminUid = isVoiceAdminUid;
function ue() {
  if (document.querySelectorAll(".rail-server-btn").forEach(e => {
      e.classList.remove("rail-server-btn-active")
    }), !V.activeServerId) return;
  const e = Y(`rail-server-${V.activeServerId}`);
  e && e.classList.add("rail-server-btn-active")
}

function ve() {
  const e = se(),
    t = Y("server-channels-panel"),
    n = document.querySelector(".sidebar-chats-panel"),
    i = Y("active-server-name"),
    o = Y("active-server-id");
  if (!e) return t && t.classList.add("hidden"), n && n.classList.remove("hidden"), i && (i.textContent = window.__fb("web.t135", "السيرفر")), void(o && (o.textContent = "#------"));
  const r = "server" === ("function" == typeof window.getSidebarMode ? window.getSidebarMode() : "home");
  t && t.classList.toggle("hidden", !r), n && n.classList.toggle("hidden", r), i && (i.textContent = e.name || "Server"), o && (o.textContent = `#${e.id}`);
  const bw = Y("active-server-banner-wrap"), bi = Y("active-server-banner");
  if (bw) {
    const u = (e.bannerURL || "").trim();
    if (u) {
      bw.classList.remove("hidden");
      if (bi && bi.src !== u) bi.src = u;
    } else {
      bw.classList.add("hidden");
      if (bi) bi.removeAttribute("src");
    }
    // الهيدر بياخد الصورة خلفية لو السيرفر له بانر، وبيبقى بار صغير لو مفيش
    const header = bw.closest(".server-channels-header");
    if (header) header.classList.toggle("has-banner", !!u);
  }
  const s = Y("add-server-channel-btn");
  if (s) {
    const t = e.ownerUid === V.myUid;
    s.classList.toggle("hidden", !t)
  }
  r && "function" == typeof window.setSidebarMode && window.setSidebarMode("server", e.name || "")
}

function pe() {
  const e = Y("server-rail-list");
  if (!e) return;
  const t = V.servers.map(e => `rail-server-${e.id}`);
  Array.from(e.children).forEach(e => {
    e.id && e.id.startsWith("rail-server-") && !t.includes(e.id) && e.remove()
  }), V.servers.forEach((t, n) => {
    let i = Y(`rail-server-${t.id}`);
    const o = !i;
    o && (i = document.createElement("button"), i.type = "button", i.id = `rail-server-${t.id}`, i.className = "rail-server-btn relative group", i.draggable = !0, i.addEventListener("click", () => {
      Ve(t.id)
    }), i.addEventListener("contextmenu", e => {
      nt(e, t.id)
    }), i.addEventListener("dragstart", n => {
      n.dataTransfer.setData("text/plain", t.id), i.classList.add("opacity-50");
      const o = Array.from(e.querySelectorAll(".rail-server-btn:not(.opacity-50)"));
      V.cachedServerRects = o.map(e => ({
        id: e.id,
        rect: e.getBoundingClientRect()
      }))
    }), i.addEventListener("dragend", () => {
      i.classList.remove("opacity-50"), V.cachedServerRects = [];
      const e = Y("server-rail-list");
      e && e.querySelectorAll(".rail-server-btn").forEach(e => {
        e.classList.remove("drag-over-top", "drag-over-bottom", "bg-white/10")
      })
    })), i.title = `${t.name} (#${t.id})`;
    const r = t.photoURL || "",
      s = i.dataset.prevPhoto,
      c = t.name || "",
      d = i.dataset.prevName;
    (o || r !== s || c !== d) && (i.innerHTML = r ? a(r, t.name, {
      size: "full",
      shape: "rounded-2xl",
      extra: "pointer-events-none",
      direct: !0
    }) : (t.name || "S").slice(0, 2).toUpperCase(), i.dataset.prevPhoto = r, i.dataset.prevName = c);
    let l = i.querySelector(".voice-activity-badge");
    V.serverVoiceActivity[t.id] ? l || (l = document.createElement("div"), l.className = "voice-activity-badge absolute z-30 -top-1 -right-1.5 w-5 h-5 bg-slate-700 rounded-full flex items-center justify-center border-2 border-[#1e2124] animate-pop-in pointer-events-none", l.innerHTML = '\n                    <svg xmlns="http://www.w3.org/2000/svg" class="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">\n                        <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>\n                    </svg>\n                ', i.appendChild(l)) : l && l.remove();
    l && l.classList.add("z-30");
    let m = 0;
    t.channelMessageCounts && Object.entries(t.channelMessageCounts).forEach(([e, n]) => {
      const i = O(t.id, e);
      n > i && (m += n - i)
    });
    let u = i.querySelector(".unread-count-badge");
    if (m > 0) {
      const e = m > 99 ? "99+" : m.toString();
      u ? u.textContent !== e && (u.textContent = e) : (u = document.createElement("div"), u.className = "unread-count-badge z-30 absolute -bottom-1 -right-1.5 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center border-2 border-[#1e2124] text-[9px] font-bold text-white px-1 shadow-lg animate-pop-in pointer-events-none", u.textContent = e, i.appendChild(u))
    } else u && u.remove();
    o && e.appendChild(i), e.children[n] !== i && e.insertBefore(i, e.children[n])
  }), ue()
}

function he() {
  const e = Y("server-channels-list");
  if (!e) return;
  const t = Y("active-room-indicator");
  if (t && t.classList.toggle("hidden", !V.activeVoiceChannelId), De(), !V.activeServerId) return e.innerHTML = '<p class="text-xs text-gray-400 text-center py-4 opacity-85 font-bold">' + window.__fb("js.pick_srv", "اختر سيرفر") + '</p>', void e.removeAttribute("data-active-server");
  if (!V.channels.length) return e.innerHTML = '<p class="text-xs text-gray-400 text-center py-4 opacity-85 font-bold">' + window.__fb("js.no_channels", "لا توجد قنوات بعد") + '</p>', void e.removeAttribute("data-active-server");
  e.setAttribute("data-active-server", V.activeServerId);
  setupChannelRootDrop(e);
  const n = V.channels.filter(e => "category" === e.type || me("view_channel", e) || "voice" === e.type && V.activeVoiceChannelId === e.id && V.activeServerId == V.activeServerId),
    i = n.filter(e => "category" === e.type),
    o = n.filter(e => "text" === e.type),
    r = n.filter(e => "voice" === e.type),
    s = {},
    a = [];
  i.forEach(e => {
    s[e.id] = []
  }), o.forEach(e => {
    e.categoryId && s[e.categoryId] ? s[e.categoryId].push(e) : a.push(e)
  }), r.forEach(e => {
    e.categoryId && s[e.categoryId] ? s[e.categoryId].push(e) : a.push(e)
  });
  const c = se(),
    d = c && c.ownerUid === V.myUid,
    l = me("manage_channels") || d,
    m = i.filter(e => !!((s[e.id] || []).length > 0) || l);
  V.collapsedCategories || (V.collapsedCategories = new Set);
  const u = {},
    v = {};
  e.querySelectorAll(".server-channel-item").forEach(e => {
    const t = e.id.replace("ch-row-", "");
    u[t] = e
  }), e.querySelectorAll(".server-voice-members-wrap").forEach(e => {
    const t = e.id.replace("voice-members-", "");
    v[t] = e
  }), e.innerHTML = "";
  const p = document.createDocumentFragment(),
    h = (e, t) => {
      let n = u[e.id];
      n && window.FoxyBetterAnimations?.markSeen?.(n);
      !n && (n = document.createElement("button"), n.type = "button", n.id = `ch-row-${e.id}`, n.className = "server-channel-item", n.addEventListener("contextmenu", t => {
        t.preventDefault(), me("manage_channel", e) && window.showChannelContextMenu(t, e)
      }), "voice" === e.type && (n.addEventListener("dragover", e => {
        e.preventDefault(), n.classList.add("drag-over")
      }), n.addEventListener("dragleave", () => {
        n.classList.remove("drag-over")
      }), n.addEventListener("drop", t => {
        t.preventDefault(), n.classList.remove("drag-over");
        const i = t.dataTransfer.getData("text/plain");
        i && "function" == typeof window.moveVoiceMember && window.moveVoiceMember(i, e.id)
      })), n.addEventListener("click", async () => {
        "function" == typeof window.showMobileMainContent && window.showMobileMainContent(), await Re(e)
      })), n.classList.toggle("server-channel-item-active", e.id === V.activeChannelId);
      const i = "voice" === e.type && e.id === V.activeVoiceChannelId && V.activeServerId === V.activeVoiceServerId && null !== V.activeVoiceServerId && !!V.activeVoiceStartedAtMs;
      let o = "",
        r = "";
      const s = "voice" === e.type ? "🔊" : "#";
      if ("voice" === e.type) {
        const t = V.activeServerId === V.voicePresenceServerId ? we(e.id).length : 0;
        e.userLimit && e.userLimit > 0 && (r = `<span class="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded-md text-[9px] font-bold text-gray-400 ml-1 whitespace-nowrap">${t}/${e.userLimit}</span>`)
      }
      i && (o = '\n                <button type="button" onclick="event.stopPropagation(); window.toggleVoiceChatOverlay()" class="p-1 mx-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition" title="Show Text Chat" aria-label="Toggle text chat">\n                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>\n                </button>\n                <span id="voice-channel-session-timer" class="server-channel-timer-badge">00:00</span>\n            ');
      let a = "",
        c = !1;
      if ("text" === e.type) {
        const t = O(V.activeServerId, e.id),
          n = e.messageCount || 0;
        if (e.id === V.activeChannelId) n > t && function(e, t, n) {
          const i = `${e}_${t}`;
          localStorage.setItem(`readCount_${i}`, n), D.set(i, n)
        }(V.activeServerId, e.id, n.toString());
        else if (n > t) {
          c = !0;
          const e = n - t;
          a = `<div class="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md animate-pop-in ml-1">${e>99?"99+":e}</div>`
        }
      }
      const d = c ? "text-white opacity-100 drop-shadow-md" : "opacity-80";
      n.dataset.channelId = e.id;
      n.dataset.channelType = e.type;
      setupChannelDrag(n, e);
      return n.innerHTML = `\n            <span class="text-[11px] font-bold ${d} shrink-0">${s}</span>\n            <span class="text-[11px] font-bold ${d} truncate flex-1 md:pr-1">${e.name}</span>\n            <div class="flex items-center gap-1">\n                ${a}\n                ${r||o?`<div class="flex items-center gap-1">${r}${o}</div>`:""}\n            </div>\n        `, n
    };
  [...a, ...m].sort((e, t) => (e.position || 0) - (t.position || 0)).forEach(e => {
    if ("category" !== e.type) {
      const t = h(e);
      if (p.appendChild(t), "voice" === e.type) {
        let e = v[t.dataset.channelId];
        e && (window.FoxyBetterAnimations?.markSeen?.(e), window.FoxyBetterAnimations?.markSeenMany?.(e.querySelectorAll(".server-voice-member-item"))), e || (e = document.createElement("div"), e.id = `voice-members-${t.dataset.channelId}`, e.className = "server-voice-members-wrap"), p.appendChild(e)
      }
      return
    }
    const t = s[e.id] || [],
      n = V.collapsedCategories.has(e.id),
      i = document.createElement("div");
    i.className = "server-channel-category-wrap", i.setAttribute("data-category-id", e.id), setupCategoryDrag(i, e);
    const o = document.createElement("div");
    o.className = "server-channel-category-header", o.addEventListener("click", () => {
      V.collapsedCategories.has(e.id) ? V.collapsedCategories.delete(e.id) : V.collapsedCategories.add(e.id);
      const t = i.querySelector(".server-category-channels-list"),
        n = o.querySelector(".category-arrow"),
        r = V.collapsedCategories.has(e.id);
      t && t.classList.toggle("is-collapsed", r), n && n.classList.toggle("is-collapsed", r)
    }), o.addEventListener("contextmenu", t => {
      t.preventDefault(), me("manage_channel", e) && window.showCategoryContextMenu(t, e)
    }), o.innerHTML = `\n            <div class="flex items-center gap-1">\n                <span class="category-arrow ${n?"is-collapsed":""}">▼</span>\n                <span>${e.name}</span>\n            </div>\n            ${l?`\n            <button class="server-mini-btn w-4 h-4 p-0 flex items-center justify-center border-none bg-transparent opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity" onclick="event.stopPropagation(); window.openCreateChannelPopup('${e.id}')">\n                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>\n            </button>\n            `:""}\n        `, i.appendChild(o);
    const r = document.createElement("div");
    r.className = "server-category-channels-list", n && r.classList.add("is-collapsed"), t.sort((e, t) => (e.position || 0) - (t.position || 0)), t.forEach(e => {
      const t = h(e);
      if (r.appendChild(t), "voice" === e.type) {
        let e = v[t.dataset.channelId];
        e && (window.FoxyBetterAnimations?.markSeen?.(e), window.FoxyBetterAnimations?.markSeenMany?.(e.querySelectorAll(".server-voice-member-item"))), e || (e = document.createElement("div"), e.id = `voice-members-${t.dataset.channelId}`, e.className = "server-voice-members-wrap"), r.appendChild(e)
      }
    }), i.appendChild(r), p.appendChild(i)
  }), e.appendChild(p), fe(), ie(), Pe()
}

const _foxyLogAt = window._foxyLogAt || (window._foxyLogAt = {});
function _foxyOnce(key, ms) {
  ms = ms || 300000;
  const now = Date.now();
  const last = _foxyLogAt[key] || 0;
  if (now - last < ms) return false;
  _foxyLogAt[key] = now;
  return true;
}
window._foxyOnce = _foxyOnce;

function we(e) {
  const t = `${e}::${V.activeServerId}::${V.voicePresenceServerId}::${JSON.stringify(Object.keys(V.voicePresenceMap[e]||{}).sort())}::${JSON.stringify(Object.keys(V.speakingMembers))}`,
    n = performance.now();
  if (j.key === t && n - j.frameId < 16) return j.result;
  const i = function(e) {
    if (V.activeServerId !== V.voicePresenceServerId) return [];
    const t = V.voicePresenceMap[e] || {};
    const filtered = VP.filterGhosts(t);
    const n = [];
    return Object.keys(filtered).forEach(i => {
      const o = { ...filtered[i] };
      if (i === V.myUid) V.myProfile?.displayName && (o.name = V.myProfile.displayName), V.myProfile?.photoURL && (o.photoURL = V.myProfile.photoURL), o.bannerColor = V.myProfile?.bannerColor || o.bannerColor || "", o.avatarColor = V.myProfile?.avatarColor || o.avatarColor || "", o.bannerURL = V.myProfile?.bannerURL || "";
      else {
        const e = V.members ? V.members.find(e => e.id === i || e.uid === i) : null;
        if (e) o.name = e.displayName || e.name || o.name || window.__fb("app_chat.default_sender", "مستخدم"), o.photoURL = e.photoURL || e.avatarURL || o.photoURL || null, o.bannerURL = e.bannerURL || o.bannerURL || "", o.bannerColor = e.bannerColor || o.bannerColor || "", o.avatarColor = e.avatarColor || o.avatarColor || "";
        else if (V.serverMembersData && V.serverMembersData[i]) {
          const e = V.serverMembersData[i];
          o.name = e.displayName || e.name || o.name || window.__fb("app_chat.default_sender", "مستخدم"), o.photoURL = e.photoURL || e.avatarURL || o.photoURL || null, o.bannerColor = e.bannerColor || o.bannerColor || "", o.avatarColor = e.avatarColor || o.avatarColor || "", o.bannerURL = e.bannerURL || o.bannerURL || ""
        } else if (V.globalUsersData && V.globalUsersData[i]) {
          const e = V.globalUsersData[i];
          o.name = e.displayName || e.name || o.name || window.__fb("app_chat.default_sender", "مستخدم"), o.photoURL = e.photoURL || e.avatarURL || o.photoURL || null, o.bannerColor = e.bannerColor || o.bannerColor || "", o.avatarColor = e.avatarColor || o.avatarColor || "", o.bannerURL = e.bannerURL || o.bannerURL || ""
        } else o.name = o.name || window.__fb("app_chat.default_sender", "مستخدم"), o.bannerColor = o.bannerColor || "", o.avatarColor = o.avatarColor || "", o.bannerURL = o.bannerURL || ""
      }
      o.peerId && (window.peerIdToUidMap[o.peerId] = i), n.push({
        ...o,
        id: i,
        uid: i,
        speaking: !!V.speakingMembers[i],
        connected: !1 !== o.connected,
        localMuted: window.locallyMutedUids.has(i)
      })
    }), me("move_members") || me("administrator"), V.voicePatienceTimers && Object.keys(V.voicePatienceTimers).forEach(i => {
      if (i !== V.myUid && !t[i] && (!window.voiceKickedPeers || !window.voiceKickedPeers.has(i)) && V.activeChannelPresenceMap && void 0 === V.activeChannelPresenceMap[i] && V.activeVoiceChannelId === e) {
        const e = V.prevActiveChannelPresenceMap && V.prevActiveChannelPresenceMap[i] || {
          name: window.__fb("js.restoring", "مسترجع...")
        };
        n.push({
          id: i,
          uid: i,
          speaking: !1,
          signalLost: !0,
          ...e
        })
      }
    }), V.activeVoiceChannelId === e && V.myUid && !n.some(e => e.id === V.myUid) && V.activeServerId === V.activeVoiceServerId && n.push({
      id: V.myUid,
      uid: V.myUid,
      name: V.myProfile?.displayName || window.__fb("app_chat.you_label", "أنت"),
      photoURL: V.myProfile?.photoURL || null,
      connected: true,
      peerId: window.myId || undefined,
      speaking: !!V.speakingMembers[V.myUid],
      muted: !!document.getElementById("mic-off-path") && !document.getElementById("mic-off-path").classList.contains("hidden")
    }), n.sort((e, t) => e.id === V.myUid && t.id !== V.myUid ? -1 : e.id !== V.myUid && t.id === V.myUid ? 1 : (e.name || "").localeCompare(t.name || "", "ar")), n
  }(e);
  return j.key = t, j.result = i, j.frameId = n, i
}

function fe() {
  V.channels.filter(e => "voice" === e.type || "text" !== e.type && "category" !== e.type).forEach(e => {
    const t = Y(`voice-members-${e.id}`);
    if (!t) return;
    const n = we(e.id),
      i = new Set(n.map(e => e.uid));
    Array.from(t.children).forEach(e => {
      const t = e.getAttribute("data-uid");
      t && !i.has(t) && e.remove()
    }), n.length && n.forEach(n => {
      const i = `sidebar-voice-${e.id}-${n.uid}`;
      let o = document.getElementById(i);
      o && window.FoxyBetterAnimations?.markSeen?.(o);
       !o && (o = document.createElement("div"), o.id = i, o.className = "server-voice-member-item", o.setAttribute("data-uid", n.uid || ""), o.draggable = !0, o.addEventListener("dragstart", e => {
         e.dataTransfer.setData("text/plain", n.uid), e.dataTransfer.effectAllowed = "move", o.classList.add("dragging")
        }), o.addEventListener("dragend", () => o.classList.remove("dragging")), t.appendChild(o), o.addEventListener("contextmenu", e => {
          n.uid !== V.myUid && (e.preventDefault(), e.stopPropagation(), window.showMemberContextMenu(e, n.uid, n.name))
        })), (n.name || "U").charAt(0).toUpperCase();
      const r = n.uid === V.myUid,
        s = r ? window.isCameraEnabled : window.peersVideoStatus && window.peersVideoStatus[n.peerId] || n.videoEnabled,
        c = n.speaking ? "ring-2 ring-emerald-500 ring-offset-1 ring-offset-[#13141c] animate-pulse" : "",
        d = n.signalLost ? "opacity-50 grayscale contrast-50" : "";
      let l = "";
      if (n.screenSharing && !r && (l += window.currentScreenSource === (n.peerId || n.uid) ? '<button onclick="event.stopPropagation(); window.closeScreenView()" class="p-1 text-red-500 hover:bg-red-500/20 rounded-md transition animate-pulse" title="' + window.__fb("js.stop_watching", "إيقاف المشاهدة") + '">\n                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path></svg>\n                    </button>' : `<button onclick="event.stopPropagation(); window.joinScreenShare('${n.peerId||n.uid}', '${n.screenPeerId||"screen-"+(n.peerId||n.uid)}')" class="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded-md transition" title="${window.__fb("js.watch_stream", "مشاهدة البث")}">\n                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>\n                    </button>`), n.muted) {
        const e = n.forceMuted ? "text-red-500" : "text-gray-400";
        l += `<span title="${n.forceMuted?window.__fb("js.force_mute_on", "صامت إجبارياً من السيرفر"):window.__fb("js.mic_muted", "الميكروفون صامت")}" class="${e}">\n                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line stroke-linecap="round" stroke-linejoin="round" stroke-width="2" x1="2" y1="2" x2="22" y2="22"></line><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>\n                </span>`
      }
      if (n.localMuted && (l += '<span title="' + window.__fb("js.local_muted", "لقد كتمت صوت هذا المستخدم محلياً") + '" class="text-amber-500"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path></svg></span>'), n.deafened) {
        const e = n.forceDeafened ? "text-red-500" : "text-gray-400";
        l += `<span title="${n.forceDeafened?window.__fb("js.force_deaf_on", "الأصم إجباري من السيرفر"):window.__fb("js.sounds_muted", "الأصوات مكتومة")}" class="${e}"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 18v-6a9 9 0 0118 0v6M4 10a2 2 0 012 2v4a2 2 0 01-2 2H3a1 1 0 01-1-1v-7a1 1 0 011-1h1zm16 0h1a1 1 0 011 1v7a1 1 0 01-1 1h-1a2 2 0 01-2-2v-4a2 2 0 012-2z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></span>`
      }
      s && (l += '<span title="' + window.__fb("js.cam_on", "الكاميرا مفعّلة") + '" class="text-emerald-400"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg></span>');
      const m = ze(n.uid, V.activeServerId),
        u = m ? m.style : {
          dot: "",
          text: ""
        };

      let pingVal = null;
      if (window.peerRttMap && window.peerIdToUidMap) {
        const peerId = Object.keys(window.peerIdToUidMap).find(k => window.peerIdToUidMap[k] === n.uid);
        if (peerId && window.peerRttMap[peerId] != null) {
          const v = window.peerRttMap[peerId];
          let fresh = v >= 0 && v <= 10000;
          try {
            const ts = window.peerRttTs && window.peerRttTs[peerId];
            if (fresh && ts && Date.now() - ts > 20000) fresh = false;

            const _isSelf = peerId === window.myId || n.uid === V.myUid;
            if (fresh && !_isSelf && (!window.calls || !window.calls[peerId])) fresh = false;
          } catch (_) { fresh = false; }
          if (fresh) pingVal = v;
        }
      }

      const _isSelfRow = n.uid === V.myUid;
      const hasRealPing = pingVal != null;
      const pingColor = !hasRealPing ? "text-gray-500" : pingVal < 40 ? "text-emerald-400" : pingVal < 60 ? "text-amber-400" : "text-red-400";
      
      const avatarHTML = a(n.photoURL || "", n.name || window.__fb("app_chat.default_sender", "مستخدم"), {
        size: "full",
        withOnError: !0,
        identity: n.uid || n.name,
        color: n.avatarColor || n.bannerColor,
        extra: "bg-[#2b2d31] text-white/90 text-xs font-black"
      });
      const p = `\n                <div class="server-voice-avatar relative ${c} ${d}" style="${u.dot}">${avatarHTML}</div>\n                <div class="flex flex-col overflow-hidden">\n                    <div class="server-voice-name ${n.deafened?"text-gray-500 line-through decoration-gray-600/50":""} truncate flex items-center gap-1.5" style="${u.text}">\n                        ${n.name || window.__fb("app_chat.default_sender", "مستخدم")}\n                        ${n.connected?"":'<span class="text-[8px] px-1 bg-white/5 text-amber-500/80 rounded animate-pulse shrink-0">' + window.__fb("js.st_connecting", "جاري الاتصال...") + '</span>'}\n                    </div>\n                    <div class="flex items-center gap-1 leading-none mt-0.5">\n                        <span class="inline-block w-1.5 h-1.5 rounded-full ${!hasRealPing ? "bg-gray-500" : pingVal < 40 ? "bg-emerald-400" : "bg-amber-400"} animate-pulse"></span>\n                        <span class="text-[9px] font-mono ${pingColor} font-bold">${hasRealPing ? pingVal + "ms" : _isSelfRow ? window.__fb("js.ping_self", "أنت") : "…"}</span>\n                        ${n.signalLost?'<span class="text-[9px] text-amber-500/80 italic ml-1">فقدت الإشارة</span>':""}\n                    </div>\n                </div>\n                <div class="server-voice-flags flex items-center gap-1 ml-auto">${l}</div>\n            `;

      const _CONNECTING_BADGE = '<span class="text-\[8px\] px-1 bg-white\/5 text-amber-500\/80 rounded animate-pulse shrink-0">[^<]*<\/span>';
      const _SIGNAL_LOST = '<span class="text-\[9px\] text-amber-500\/80 italic ml-1">[^<]*<\/span>';
      const _stripDyn = (h) => h
        .replace(/\d+ms|…/g, "#ping")
        .replace(/\s?ring-2 ring-emerald-500 ring-offset-1 ring-offset-\[#13141c\] animate-pulse/g, "")
        .replace(/\s?opacity-50 grayscale contrast-50/g, "")
        .replace(new RegExp(_CONNECTING_BADGE, "g"), "")
        .replace(new RegExp(_SIGNAL_LOST, "g"), "")
        .replace(/text-(gray-500|emerald-400|amber-400|red-400)/g, "#pingc")
        .replace(/\s+/g, " ");
      const _cached = o.dataset.fullhtml || "";
      if (o.firstChild && _cached && _stripDyn(_cached) === _stripDyn(p)) {
        try {
            const _txt = hasRealPing ? pingVal + "ms" : _isSelfRow ? window.__fb("js.ping_self", "أنت") : "…";
          const _pingEl = o.querySelector("span.font-mono");
          if (_pingEl && _pingEl.textContent !== _txt) _pingEl.textContent = _txt;
          if (_pingEl) _pingEl.className = `text-[9px] font-mono ${pingColor} font-bold`;
          const _dot = o.querySelector("span.inline-block");
          if (_dot) _dot.className = `inline-block w-1.5 h-1.5 rounded-full ${!hasRealPing ? "bg-gray-500" : pingVal < 40 ? "bg-emerald-400" : "bg-amber-400"} animate-pulse`;
          const _av = o.querySelector(".server-voice-avatar");
          if (_av) {
            const _ring = ["ring-2", "ring-emerald-500", "ring-offset-1", "ring-offset-[#13141c]", "animate-pulse"];
            if (n.speaking) _av.classList.add(..._ring);
            else _ring.forEach(_c => _av.classList.remove(_c));

            _av.classList.toggle("opacity-50", !!n.signalLost);
            _av.classList.toggle("grayscale", !!n.signalLost);
            _av.classList.toggle("contrast-50", !!n.signalLost);
          }

          const _nameRow = o.querySelector(".server-voice-name");
          if (_nameRow) {
            const _has = !!_nameRow.querySelector("span.text-\\[8px\\]");
            if (n.connected && _has) _nameRow.querySelector("span.text-\\[8px\\]").remove();
            else if (!n.connected && !_has) {
              const _sp = document.createElement("span");
              _sp.className = "text-[8px] px-1 bg-white/5 text-amber-500/80 rounded animate-pulse shrink-0";
              _sp.textContent = window.__fb("js.st_connecting", "جاري الاتصال...");
              _nameRow.appendChild(_sp);
            }
          }

          const _lostEl = o.querySelector(".server-voice-flags, .flex.items-center.gap-1");
          void _lostEl;
          const _pingRow = _pingEl && _pingEl.parentElement;
          if (_pingRow) {
            const _hasLost = !!_pingRow.querySelector("span.italic");
            if (n.signalLost && !_hasLost) {
              const _sp = document.createElement("span");
              _sp.className = "text-[9px] text-amber-500/80 italic ml-1";
              _sp.textContent = "فقدت الإشارة";
              _pingRow.appendChild(_sp);
            } else if (!n.signalLost && _hasLost) {
              _pingRow.querySelector("span.italic").remove();
            }
          }
        } catch (_) {}
        o.dataset.fullhtml = p;
      } else if (o.innerHTML !== p) {
        o.innerHTML = p;
        o.dataset.fullhtml = p;
      }
    })
  }), V.activeVoiceChannelId && be(V.activeVoiceChannelId)
}

setInterval(() => { V.activeVoiceChannelId && !window.__voiceTransitioning && !document.hidden && be(V.activeVoiceChannelId) }, 20000);
window.state = V, window.peerIdToUidMap = {}, window.locallyMutedUids = new Set, window.getAllServerChannels = () => {
  const e = [];
  return V.servers.forEach(t => {
    V.channels.forEach(n => {
      n.serverId === t.id && e.push({
        id: n.id,
        name: n.name,
        serverId: t.id,
        serverName: t.name,
        type: "server"
      })
    })
  }), e
}, window.getActiveServerMembers = () => V.members, window.getActiveServerRoles = () => V.serverRoles[V.activeServerId] || [], window.getActiveServerChannels = () => V.channels, window.isMeInRole = e => {
  if (!V.myUid || !V.activeServerId) return !1;
  const t = V.serverMembersData[V.myUid];
  return !(!t || !t.roles) && (t.roles.includes(e) || "@everyone" === e)
}, window.switchChannelById = e => {
  const t = V.channels.find(t => t.id === e);
  t && (Re(t), "function" == typeof window.showMobileMainContent && window.showMobileMainContent())
}, window.updateSpeakingState = function(e, t) {
  if (window.isDmCalling) {
    if (typeof window.updateDmSpeakingState === "function") window.updateDmSpeakingState(e, t);
    const n = document.getElementById("dm-voice-my-avatar"),
      i = document.getElementById("dm-voice-friend-avatar"),
      o = "me" === e ? n : i;
    o && (t ? o.classList.add("ring-2", "ring-emerald-500", "ring-offset-2", "ring-offset-slate-900", "animate-pulse") : o.classList.remove("ring-2", "ring-emerald-500", "ring-offset-2", "ring-offset-slate-900", "animate-pulse"))
  }
  if (!V.activeVoiceChannelId) return;
  let n = null;
  if ("me" === e) n = V.myUid;
  else {
    const t = V.voicePresenceMap[V.activeVoiceChannelId] || {};
    for (const [i, o] of Object.entries(t))
      if (o.peerId === e) {
        n = i;
        break
      }
  }
  if (!n) return;

  if (!!V.speakingMembers[n] === !!t) {

  } else {
    V.speakingMembers[n] = t;
  }

  const _rowId = `sidebar-voice-${V.activeVoiceChannelId}-${n}`;
  const _row = document.getElementById(_rowId);
  if (_row) {
    const _av = _row.querySelector(".server-voice-avatar");
    if (_av) {
      if (t) _av.classList.add("ring-2", "ring-emerald-500", "ring-offset-1", "ring-offset-[#13141c]", "animate-pulse");
      else _av.classList.remove("ring-2", "ring-emerald-500", "ring-offset-1", "ring-offset-[#13141c]", "animate-pulse");
    }
  }
  let o = n === V.myUid ? "p-card-me" : `p-card-${n}`;
  const r = document.getElementById(o);
  r && (t ? r.classList.add("ring-[3px]", "ring-emerald-400") : r.classList.remove("ring-[3px]", "ring-emerald-400"))
}, window.playChannelSound = function(e, t = !1) {
  const n = {
    join: "Music/discord-join.mp3",
    leave: "Music/discord-leave.mp3",
    mute: "Music/discordmute_IZNcLx2.mp3",
    unmute: "Music/discord-unmute.mp3",
    deafen: "Music/discord-deafen_jvTyxZk.mp3",
    undeafen: "Music/discord-undeafen.mp3",
    call: "Music/discord-call-sound.mp3",
    dialing: "Music/discord-call-sound.mp3"
  } [e];
  if (!n) return null;
  const i = new Audio(n);
  const s = Math.max(0, Math.min(100, Number(localStorage.getItem("vh-music-volume") || 100))) / 100;
  return i.volume = .5 * s, i.loop = t, i.play().catch(e => {}), i
}, window.updateBrowserUrl = function(e, t) {
  const n = t ? `${t} | Foxy` : "Foxy";
  window.location.hash = e, document.title = n
}, window.resetActiveServer = function() {
  V.activeServerId = null, Me(), ke(), Ce(), Je(), We(), Te(), De(), (!document.body.classList.contains("in-settings") && updateBrowserUrl("/home", window.__fb("app_navigation.home", "الرئيسية"))), ue()
};
let ge = null,
  ye = null;

function be(e) {
  ye = e, ge || (ge = requestAnimationFrame(() => {
    ge = null,
      function() {
        const e = ye || window.state && window.state.activeVoiceChannelId,
          t = Y("participants-list");
        if (!t) return;
        const n = we(e),
          i = Array.from(t.children).filter(e => e.classList.contains("participant-card")).length;

        const _nextCount = String(i || n.length);
        if (t.getAttribute("data-count") !== _nextCount) t.setAttribute("data-count", _nextCount);
        if (e && n.length) {
          const e = new Set(n.map(e => e.uid));

          const _liveUids = new Set(), _livePeerIds = new Set();
          const _conns = window.connections || {}, _calls = window.calls || {};
          for (const _p in _conns) {
            const _c = _conns[_p] || {};
            const _pc = (_calls[_p] || {}).peerConnection;
            const _connOpen = !!(_c.conn && _c.conn.open);
            const _pcAlive = !!(_pc && ("connected" === _pc.connectionState || "connecting" === _pc.connectionState
              || "connected" === _pc.iceConnectionState || "completed" === _pc.iceConnectionState));
            // FIX: كان أي entry في connections (حتى لو مقفول/ميت) بيخلي
            // الكارت يتساقط من الحذف ⇒ العضو اللي يخرج من القناة كارتة
            // بيفضل في قائمة المشاركين لحد ما الـ ghost cleanup يشتغل
            // (30-45 ثانية). دلوقتي "حيّ" = قناة بيانات مفتوحة أو PC متصل.
            if (_connOpen || _pcAlive) {
              if (_c.uid) _liveUids.add(_c.uid);
              _livePeerIds.add(_p);
            }
          }

          for (const _k in (window.peerIdToUidMap || {})) {
            if (_livePeerIds.has(_k)) _liveUids.add(window.peerIdToUidMap[_k]);
            const _c = _conns[_k];
            if (_c && _c.uid && _livePeerIds.has(_k)) _liveUids.add(_c.uid);
          }
          Array.from(t.children).forEach(t => {
            const n = t.getAttribute("data-uid");
            if (n && !e.has(n)) {
              if (_liveUids.has(n) || _livePeerIds.has(n)) {
                if (_foxyOnce("cardkept:" + n)) {
              "function" == typeof window.foxyDiagEvent && window.foxyDiagEvent("CARD_KEPT_LIVE", "uid=" + n, "data-uid مش في الحضور بس في اتصال حيّ به ⇒ البطاقة اتسابت من الحذف");
            }
                return;
              }
              if (t.classList.contains("card-leave")) return;
              // FIX: كارت معاينة الشاشة بتاع العضو لازم يروح معاه فوراً
              window.removeScreenShareCardByUid && window.removeScreenShareCardByUid(n);
              t.classList.add("card-leave"), t.style.pointerEvents = "none", t._foxyLeaveTimer = setTimeout(() => {
                t._foxyLeaveTimer = null;
                t.remove();
                const e = window.state && window.state.activeVoiceChannelId;
                e && be(e)
              }, 250)
            }
          })
        }
        n.forEach(e => {

          const n = e.uid === V.myUid ? "me" : e.uid || e.peerId,
            i = e.uid === V.myUid ? "p-card-me" : `p-card-${e.uid}`;
          let o = document.getElementById(i) || document.querySelector(`.participant-card[data-uid="${e.uid}"]`);

          if (o && o.classList.contains("card-leave")) {
            o._foxyLeaveTimer && clearTimeout(o._foxyLeaveTimer), o._foxyLeaveTimer = null;
            o.classList.remove("card-leave"), o.style.pointerEvents = "", o.style.opacity = "";
          }
          if (!o) {
            o = document.createElement("div"), o.id = i, o.className = "participant-card group card-enter", o.setAttribute("data-uid", e.uid), setTimeout(() => {
              o && o.classList.remove("card-enter")
            }, 600);
            const r = e.photoURL;
            o.innerHTML = `\n                \x3c!-- Status LED --\x3e\n                <div id="media-led-${n}" class="card-status-dot bg-emerald-500 hidden"></div>\n\n                \x3c!-- Centered Avatar Container --\x3e\n                <div class="card-avatar-container">\n                    <div id="video-container-${n}" class="absolute inset-0 w-full h-full overflow-hidden select-none transition-opacity duration-300" style="opacity: 0; pointer-events: none;">\n                        <video id="remote-video-${n}" autoplay playsinline class="w-full h-full object-cover"></video>\n                    </div>\n                    \n                    <div class="avatar-fallback absolute inset-0 flex items-center justify-center bg-[#2b2d31]">\n                        ${a(r,e.name,{size:"full",withOnError:!0,identity:e.uid||e.name,color:e.avatarColor||e.bannerColor,extra:"bg-[#2b2d31]"})}\n                    </div>\n                </div>\n\n                \x3c!-- Name Pill --\x3e\n                <div class="card-name-pill">\n                    <span class="participant-name text-[11px] font-bold text-white/95 truncate">${e.name||window.__fb("js.connecting_name", "جاري الاتصال...")}</span>\n                    <div id="status-icons-${n}" class="flex gap-1 items-center empty:hidden"></div>\n                    <div class="conn-status-tag flex hidden" id="conn-status-${n}"></div>\n                </div>\n\n                \x3c!-- Viewer Count --\x3e\n                <div id="viewer-count-container-${n}" class="absolute top-4 left-4 hidden items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-md text-white rounded-lg border border-white/10 scale-90 transition-all z-20">\n                    <svg class="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>\n                    <span id="viewer-count-num-${n}" class="text-[10px] font-black">0</span>\n                </div>\n\n                \x3c!-- Screen Action Container --\x3e\n                <div id="screen-btn-container-${n}" class="absolute top-4 right-4 z-30 pointer-events-auto"></div>\n            `, o.addEventListener("contextmenu", t => {
              e.uid !== V.myUid && (t.preventDefault(), t.stopPropagation(), window.showMemberContextMenu(t, e.uid))
            }), t.appendChild(o), e.uid === V.myUid && (o.classList.add("cursor-pointer"), o.title = window.__fb("app_voice.toggle_preview_title", "انقر لتفعيل/إخفاء معاينة الكاميرا أو الشاشة"), o.addEventListener("click", () => {
              if (window.isCameraEnabled || window.isScreenSharing) {
                if (window.localPreviewEnabled = !window.localPreviewEnabled, window.addSystemMsg) {
                  const e = window.isScreenSharing ? window.__fb("app_voice.screen_share", "مشاركة الشاشة") : window.__fb("app_voice.camera", "الكاميرا");
                  window.addSystemMsg(window.localPreviewEnabled ? window.__f("js.preview_on", {thing: e}, `تم تفعيل معاينة ${e}`) : window.__f("js.preview_off", {thing: e}, `تم إخفاء معاينة ${e}`), "info")
                }
                const e = window.state && window.state.activeVoiceChannelId;
                e ? be(e) : "function" == typeof window.addParticipantUI && window.addParticipantUI("me", "function" == typeof window.__foxySelfDisplayName ? window.__foxySelfDisplayName() : window.myName)
              } else window.addSystemMsg && window.addSystemMsg(window.__fb("js.need_cam", "قم بتشغيل الكاميرا أو مشاركة الشاشة أولاً لتفعيل المعاينة."), "warning")
            }))
          }
          const r = e.bannerURL ? `url("${e.bannerURL}")` : e.avatarColor || e.bannerColor || "#1e1f22";
          o.getAttribute("data-bg") !== r && (c(o, e.bannerURL, e.avatarColor || e.bannerColor), o.setAttribute("data-bg", r)), o.classList.toggle("speaking", !!e.speaking);
          const s = e.uid === V.myUid,
            d = s ? window.isCameraEnabled || window.isScreenSharing : window.peersVideoStatus && window.peersVideoStatus[e.peerId] || e.videoEnabled,
            l = document.getElementById(`video-container-${n}`);
          if (l) {
            const e = document.getElementById(`remote-video-${n}`),
              t = !(!e || !e.srcObject),
              i = s ? d && window.localPreviewEnabled : d && t;
            if (l.style.opacity = i ? "1" : "0", l.style.pointerEvents = i ? "auto" : "none", l.classList.remove("hidden"), s && i) {
              const t = window.isScreenSharing ? window.localScreenStream : window.localStream;
              e && e.srcObject !== t && (e.srcObject = t, e.muted = !0, e.play().catch(e => {}))
            }
          }
          const m = o.querySelector(".avatar-fallback");
          const _pc = e.avatarColor || e.bannerColor || "";
          m && (m._avatarPhoto !== e.photoURL || m._avatarName !== e.name || m._avatarColor !== _pc) && (m._avatarPhoto = e.photoURL, m._avatarName = e.name, m._avatarColor = _pc, m.innerHTML = a(e.photoURL, e.name, {
            size: "full",
            withOnError: !0,
            identity: e.uid || e.name,
            color: _pc
          }));
          const u = document.getElementById(`media-led-${n}`);
          if (u) {
            const t = e.muted ? "none" : "connected",
              n = {
                connected: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]",
                none: "bg-gray-600 hidden"
              };
            u.className = `card-status-dot ${n[t]} transition-all duration-300`
          }
          const v = o.querySelector(".participant-name");
          v && v.textContent !== (e.name || window.__fb("js.guest_name", "زائر")) && (v.textContent = e.name || "زائر");
          const p = document.getElementById(`status-icons-${n}`);
          if (p) {
            let t = "";
            e.muted && (t += `<span id="mic-icon-${n}" class="text-gray-500"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="2" y1="2" x2="22" y2="22" stroke-width="2" stroke="currentColor"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v3" stroke-width="2" stroke="currentColor"/></svg></span>`), e.deafened && (t += `<span id="deaf-icon-${n}" class="text-gray-500"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 18v-6a9 9 0 0118 0v6M4 10a2 2 0 012 2v4a2 2 0 01-2 2H3a1 1 0 01-1-1v-7a1 1 0 011-1h1zm16 0h1a1 1 0 011 1v7a1 1 0 01-1 1h-1a2 2 0 01-2-2v-4a2 2 0 012-2z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></span>`), d && (t += '<span><svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></span>'), p.innerHTML !== t && (p.innerHTML = t)
          }
          const h = document.getElementById(`screen-btn-container-${n}`);
          if (h) {
            const t = h.getAttribute("data-state");
            if ("screen-watch" === t || "live" === t || "watch" === t);
            else {
              let t = "";
              e.screenSharing && !s ? t = window.currentScreenSource === (e.peerId || e.uid) ? '<button onclick="window.closeScreenView()" class="flex items-center gap-1 px-2 py-1 bg-red-500 text-white rounded-md text-[10px] font-black shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all scale-105">\n                            <span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>\n                            "<span>' + window.__fb("js.stop_btn", "إيقاف") + '</span>"\n                        </button>' : `<button onclick="window.joinScreenShare('${e.peerId||e.uid}', '${e.screenPeerId||"screen-"+(e.peerId||e.uid)}')" class="flex items-center gap-1 px-2 py-1 bg-emerald-500 text-white rounded-md text-[10px] font-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all">\n                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>\n                            <span>${window.__fb("js.watch", "مشاهدة")}</span>\n                        </button>` : d && !s && (t = `<button onclick="window.watchParticipantCamera('${n}')" class="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px] hover:bg-emerald-500 hover:text-white transition-all">\n                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>\n                        <span>${window.__fb("js.watch", "مشاهدة")}</span>\n                    </button>`), h.innerHTML !== t && (h.innerHTML = t)
            }
          }
          window.updateParticipantMediaPreview?.(e.peerId || e.uid, e);
          if (s) {
            const e = document.getElementById("preview-hint-me");
            if (e) {
              e.classList.toggle("hidden", !d);
              const t = e.querySelector("span");
              if (t) {
                const e = window.isScreenSharing ? window.__fb("app_voice.screen_share", "مشاركة الشاشة") : window.__fb("app_voice.camera", "الكاميرا");
                t.innerText = window.localPreviewEnabled ? window.__f("js.hide_preview", {x: e}, `انقر لإخفاء معاينة ${e}`) : window.__f("js.show_preview", {x: e}, `انقر لرؤية ${e}`)
              }
            }
          }
        }), Array.from(t.children).sort((e, t) => {
          if ("p-card-me" === e.id) return -1;
          if ("p-card-me" === t.id) return 1;
          const n = e.getAttribute("data-uid") || "",
            i = t.getAttribute("data-uid") || "";
          return n.localeCompare(i)
        }).forEach((e, n) => {
          t.children[n] !== e && t.insertBefore(e, t.children[n] || null)
        });
        const o = Y("room-status");
        o && (1 === n.length ? o.innerText = window.__fb("web.t030", "أنت وحدك") : o.innerText = window.__f("js.online_count", {n: n.length}, `${n.length} متواجدون`)), "function" == typeof window.updateScreenViewerUI && window.updateScreenViewerUI()
      }()
  }))
}

function xe(e) {
  const t = Y("home-friends-panels"),
    n = Y("home-header-tabs"),
    i = document.querySelector(".view-header.home-view-header"),
    o = "server" === ("function" == typeof window.getSidebarMode ? window.getSidebarMode() : V.activeServerId ? "server" : "home");
  t && t.classList.toggle("hidden", !e || o), n && n.classList.toggle("hidden", !e || o), i && i.classList.toggle("hidden", !e || o), De()
}

function Se(e) {
  const t = Y("home-server-chat");
  t && t.classList.toggle("hidden", !e)
}

function Ce() {
  V.textMessagesToken++, V.textMessagesUnsub && (V.textMessagesUnsub(), V.textMessagesUnsub = null)
}

function canReorderChannels() {
  const server = se();
  return !!(server && V.myUid && (server.ownerUid === V.myUid || me("manage_channels")));
}

async function saveChannelOrder() {
  if (!V.activeServerId || !canReorderChannels()) return;
  const list = Y("server-channels-list");
  if (!list) return;
  const updates = [];
  const positions = new Map();
  let topLevelPosition = 0;
  Array.from(list.children).forEach(item => {
    if (item.classList.contains("server-voice-members-wrap")) return;
    if (item.classList.contains("server-channel-category-wrap")) {
      const categoryId = item.dataset.categoryId;
      const categoryData = V.channels.find(channel => channel.id === categoryId);
      if (categoryData) positions.set(categoryId, topLevelPosition++);
      item.querySelectorAll(":scope > .server-category-channels-list > .server-channel-item").forEach((row, index) => {
        positions.set(row.dataset.channelId, index);
        const channel = V.channels.find(item => item.id === row.dataset.channelId);
        if (channel) channel.categoryId = categoryId;
      });
      return;
    }
    if (item.classList.contains("server-channel-item")) {
      positions.set(item.dataset.channelId, topLevelPosition++);
      const channel = V.channels.find(channel => channel.id === item.dataset.channelId);
      if (channel) channel.categoryId = null;
    }
  });
  V.channels.forEach(channel => {
    const position = positions.get(channel.id);
    if (position === undefined) return;
    channel.position = position;
    updates.push(f(l(e, "servers", V.activeServerId, "channels", channel.id), {
      position,
      categoryId: channel.type === "category" ? null : (channel.categoryId || null),
      updatedAt: b()
    }));
  });
  await Promise.all(updates);
}

function clearChannelDropIndicator() {
  document.querySelectorAll(".channel-drop-indicator, .channel-root-drop-hint").forEach(element => element.remove());
}

function placeChannelDropIndicator(parent, before, label) {
  clearChannelDropIndicator();
  const indicator = document.createElement("div");
  indicator.className = "channel-drop-indicator";
  indicator.dataset.label = label;
  parent.insertBefore(indicator, before || null);
}

function setupChannelDrag(row, channel) {
  if (!canReorderChannels() || row.dataset.dragReady) return;
  row.dataset.dragReady = "true";
  row.draggable = true;
  row.dataset.channelId = channel.id;
  row.addEventListener("dragstart", event => {

    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-foxy-channel", channel.id);
    event.dataTransfer.setData("application/x-foxy-drag-kind", "channel");
    row.classList.add("dragging");
  });
  row.addEventListener("dragend", event => {
    event.stopPropagation();
    row.classList.remove("dragging");
    clearChannelDropIndicator();
  });
  row.addEventListener("dragover", event => {
    if (!event.dataTransfer.types.includes("application/x-foxy-channel") || event.dataTransfer.getData("application/x-foxy-drag-kind") !== "channel") return;
    event.preventDefault();
    row.classList.add("drag-over");
    const after = event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
    const memberWrap = row.nextElementSibling?.classList.contains("server-voice-members-wrap") ? row.nextElementSibling : null;
    const before = after ? (memberWrap?.nextElementSibling || row.nextElementSibling) : row;
    placeChannelDropIndicator(row.parentElement, before, window.__fb("js.drop_here", "هنا"));
  });
  row.addEventListener("dragleave", () => {
    row.classList.remove("drag-over");
    clearChannelDropIndicator();
  });
  row.addEventListener("drop", async event => {
    event.preventDefault();
    event.stopPropagation();
    row.classList.remove("drag-over");
    clearChannelDropIndicator();
    const sourceId = event.dataTransfer.getData("application/x-foxy-channel");
    if (event.dataTransfer.getData("application/x-foxy-drag-kind") !== "channel") return;
    const source = document.querySelector(`[data-channel-id="${CSS.escape(sourceId)}"]`);
    if (!source || source === row || source.dataset.channelType === "category") return;
    const list = row.parentElement;
    const after = event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;

    const memberWrap = source.nextElementSibling?.classList.contains("server-voice-members-wrap") ? source.nextElementSibling : null;
    const group = document.createDocumentFragment();
    group.appendChild(source);
    if (memberWrap) group.appendChild(memberWrap);
    list.insertBefore(group, after ? row.nextElementSibling : row);
    try {
      await saveChannelOrder();
    } catch (error) {
      console.error("[Channels] Failed to save channel order", error);
      he();
    }
  });
}

function setupCategoryDrag(categoryWrap, category) {
  if (!canReorderChannels() || categoryWrap.dataset.dragReady) return;
  categoryWrap.dataset.dragReady = "true";
  categoryWrap.draggable = true;
  categoryWrap.dataset.channelId = category.id;
  categoryWrap.dataset.channelType = "category";
  categoryWrap.addEventListener("dragstart", event => {

    const dragTarget = event.target;
    if (dragTarget && typeof dragTarget.closest === "function" && dragTarget.closest(".server-channel-item, .server-voice-member-item, .server-voice-members-wrap")) return;
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-foxy-channel", category.id);
    event.dataTransfer.setData("application/x-foxy-drag-kind", "category");
    categoryWrap.classList.add("dragging");
  });
  categoryWrap.addEventListener("dragend", event => {
    event.stopPropagation();
    categoryWrap.classList.remove("dragging");
    clearChannelDropIndicator();
  });
  categoryWrap.addEventListener("dragover", event => {
    if (!event.dataTransfer.types.includes("application/x-foxy-channel")) return;
    const dragKind = event.dataTransfer.getData("application/x-foxy-drag-kind");
    const target = event.target;
    if (target?.closest?.(".server-channel-item, .server-voice-member-item, .server-voice-members-wrap")) return;
    event.preventDefault();
    categoryWrap.classList.add("drag-over");
    if (dragKind === "channel") {
      const targetList = categoryWrap.querySelector(":scope > .server-category-channels-list");
      targetList && placeChannelDropIndicator(targetList, null, window.__f("js.in_section", {name: category.name}, `داخل قسم ${category.name}`));
    } else if (dragKind === "category") {
      const after = event.clientY > categoryWrap.getBoundingClientRect().top + categoryWrap.offsetHeight / 2;
      placeChannelDropIndicator(categoryWrap.parentElement, after ? categoryWrap.nextElementSibling : categoryWrap, window.__fb("js.drop_here", "هنا"));
    }
  });
  categoryWrap.addEventListener("dragleave", () => {
    categoryWrap.classList.remove("drag-over");
    clearChannelDropIndicator();
  });
  categoryWrap.addEventListener("drop", async event => {
    event.preventDefault();
    event.stopPropagation();
    categoryWrap.classList.remove("drag-over");
    clearChannelDropIndicator();
    const sourceId = event.dataTransfer.getData("application/x-foxy-channel");
    const dragKind = event.dataTransfer.getData("application/x-foxy-drag-kind");
    const source = document.querySelector(`[data-channel-id="${CSS.escape(sourceId)}"]`);
    if (!source || source === categoryWrap) return;
    if (dragKind === "channel" && source.dataset.channelType !== "category") {
      const targetList = categoryWrap.querySelector(":scope > .server-category-channels-list");
      if (!targetList) return;
      const memberWrap = source.nextElementSibling?.classList.contains("server-voice-members-wrap") ? source.nextElementSibling : null;
      const after = event.clientY > categoryWrap.getBoundingClientRect().top + categoryWrap.offsetHeight / 2;
      memberWrap && memberWrap.remove();
      targetList.appendChild(source);
      memberWrap && targetList.appendChild(memberWrap);
      try {
        await saveChannelOrder();
      } catch (error) {
        console.error("[Channels] Failed to move channel into category", error);
        he();
      }
      return;
    }
    if (dragKind !== "category" || source.dataset.channelType !== "category") return;
    const after = event.clientY > categoryWrap.getBoundingClientRect().top + categoryWrap.offsetHeight / 2;
    categoryWrap.parentElement.insertBefore(source, after ? categoryWrap.nextElementSibling : categoryWrap);
    try {
      await saveChannelOrder();
    } catch (error) {
      console.error("[Channels] Failed to save category order", error);
      he();
    }
  });
}

function setupChannelRootDrop(list) {
  if (!list || list.dataset.channelDropReady) return;
  list.dataset.channelDropReady = "true";
  const clearRootDropHint = () => {
    clearChannelDropIndicator();
    list.classList.remove("channel-root-drag-over");
  };
  const showRootDropHint = () => {
    let hint = list.querySelector(".channel-root-drop-hint");
    if (!hint) {
      clearChannelDropIndicator();
      hint = document.createElement("div");
      hint.className = "channel-root-drop-hint";
      hint.textContent = window.__fb("js.place_here", "سيتم وضع القناة هنا خارج الأقسام");
      list.appendChild(hint);
    }
  };
  list.addEventListener("dragover", event => {
    if (!event.dataTransfer.types.includes("application/x-foxy-channel") || event.dataTransfer.getData("application/x-foxy-drag-kind") !== "channel") return;
    const target = event.target;
    if (target?.closest?.(".server-channel-category-wrap")) return;
    event.preventDefault();
    list.classList.add("channel-root-drag-over");
    showRootDropHint();
  });
  list.addEventListener("dragleave", event => {
    if (!list.contains(event.relatedTarget)) clearRootDropHint();
  });
  list.addEventListener("drop", async event => {
    event.preventDefault();
    event.stopPropagation();
    clearRootDropHint();
    const sourceId = event.dataTransfer.getData("application/x-foxy-channel");
    if (event.dataTransfer.getData("application/x-foxy-drag-kind") !== "channel") return;
    const source = document.querySelector(`[data-channel-id="${CSS.escape(sourceId)}"]`);
    if (!source || source.dataset.channelType === "category") return;
    const memberWrap = source.nextElementSibling?.classList.contains("server-voice-members-wrap") ? source.nextElementSibling : null;
    memberWrap && memberWrap.remove();
    list.appendChild(source);
    memberWrap && list.appendChild(memberWrap);
    try {
      await saveChannelOrder();
    } catch (error) {
      console.error("[Channels] Failed to move channel outside category", error);
      he();
    }
  });
}

function Me() {
  V.channelsUnsub && (V.channelsUnsub(), V.channelsUnsub = null)
}

function ke() {
  V.membersUnsub && (V.membersUnsub(), V.membersUnsub = null), V.serverDocUnsub && (V.serverDocUnsub(), V.serverDocUnsub = null), Object.values(V.memberStatusUnsubs || {}).forEach(e => {
    "function" == typeof e && e()
  }), V.memberStatusUnsubs = {}, V.memberStatuses = {}
}

function Le() {
  V.hostHeartbeatTimer && (clearInterval(V.hostHeartbeatTimer), V.hostHeartbeatTimer = null)
}
async function Ue() {
  "function" == typeof window.resetForceMute && window.resetForceMute(), V.presenceRefreshInterval && (clearInterval(V.presenceRefreshInterval), V.presenceRefreshInterval = null), Le(), oe(), V.activeVoiceSessionUnsub && (V.activeVoiceSessionUnsub(), V.activeVoiceSessionUnsub = null), V.voiceCmdUnsub && (V.voiceCmdUnsub(), V.voiceCmdUnsub = null), V.activeChannelVoicePresenceUnsub && (V.activeChannelVoicePresenceUnsub(), V.activeChannelVoicePresenceUnsub = null, V.activeChannelPresenceMap = {}, V.prevActiveChannelPresenceMap = null), V.activeVoiceStartedAtMs = 0, ie(), V.voicePatienceTimers && (Object.values(V.voicePatienceTimers).forEach(e => clearTimeout(e)), V.voicePatienceTimers = {});
  // FIX: مستمع حضور RTDB للقناة الصوتية مكانش بيتر-unsubscribe أبداً.
  // بعد المغادرة كان بيفضل يرد على أي heartbeat للزملاء الباقيين، فيعيد
  // تعبئة خريطة الحضور ويعيد الاتصال بالمشاركين (بطاقات + معاينة شاشة زائدة).
  try { VP.unsubscribe(); } catch (_) {}
  V.activeChannelVoicePresenceUnsub = null;
  const e = V.activeVoiceServerId,
    t = V.activeVoiceChannelId,
    i = V.activeVoiceSessionRef,
    o = V.isVoiceHost;
  if (e && t && V.myUid) {
    const i = U(n, `/voice_presence/${e}/${t}/${V.myUid}`);
    A(i).catch(() => {});
    const o = U(n, `/server_activity/${e}/${V.myUid}`);
    A(o).catch(() => {})
  }
  const r = (t ? we(t) : []).length <= 1;
  if (V.isVoiceHost = !1, V.activeVoiceSessionRef = null, V.activeVoiceSessionKey = null, V.activeVoiceRoomCode = null, V.activeVoiceStartedAtMs = 0, V.activeVoiceChannelId = null, V.activeVoiceServerId = null, window.voicePresenceToken = null, "function" == typeof window.playChannelSound && window.playChannelSound("leave"), i) try {
    r ? await C(i) : o && await w(i, {
      hostPeerId: "",
      heartbeatAt: 0,
      updatedAt: b()
    }, {
      merge: !0
    })
  } catch (e) {}
  //FIX: نقفل إشعار "متصل بالقناة الصوتية" مع مغادرة القناة.
  "function" == typeof window.closeVoiceCallNotification && window.closeVoiceCallNotification();
  he()
}

function Ie(t, o) {
  if (!t || !o) {
    console.warn("Ie aborted: serverId or channelId is missing", { serverId: t, channelId: o });
    return;
  }
  Ce();
  const messageToken = V.textMessagesToken,
    selectionToken = V.serverSelectionToken;
  const cacheKey = `${t}:${o}`;
  const restoredCache = T._restoredCacheKey === cacheKey;
  if (!restoredCache) T.showLoading();
  T._restoredCacheKey = null;

  setTimeout(() => {
    if (typeof window.listenServerTyping === 'function')
      window.listenServerTyping(t, o, V.myUid);
  }, 200);
  const i = d(e, "servers", t, "channels", o, "messages"),
    r = m(i, y("timestamp", "asc"), k(T.limit));

  V.textMessagesUnsub = v(r, snap => {
    if (messageToken !== V.textMessagesToken || selectionToken !== V.serverSelectionToken || V.activeServerId !== t || V.activeChannelId !== o) return;

    if (typeof window.notifyUser === 'function' && V.myUid) {
      try {
        snap.docChanges().forEach(change => {
          if (change.type === "added") {
            const d = change.doc.data();
            if (d.senderUid && d.senderUid !== V.myUid) {
              const msgTime = d.timestamp?.toDate ? d.timestamp.toDate().getTime() : Date.now();
              if (Date.now() - msgTime < 12000) {
                const text = d.text || "";
                const isMention = text.includes(`<@${V.myUid}>`) || text.includes("@everyone") || text.includes("@here");
                let isRoleMention = false;
                if (!isMention && window.isMeInRole) {
                  const re = /<@&(\w+)>/g;
                  let m;
                  while (null !== (m = re.exec(text))) {
                    if (window.isMeInRole(m[1])) {
                      isRoleMention = true;
                      break;
                    }
                  }
                }
                if (isMention || isRoleMention) {
                  window.notifyUser(window.__f("js.signal_from", {name: d.senderName || window.__fb("app_server_members.member", "عضو")}, `إشارة من ${d.senderName || window.__fb('app_server_members.member', 'عضو')}`), text);
                }
              }
            }
          }
        });
      } catch(err) { console.error(err); }
    }

    requestAnimationFrame(() => {
      if (messageToken !== V.textMessagesToken || selectionToken !== V.serverSelectionToken || V.activeServerId !== t || V.activeChannelId !== o) return;

      ! function(e) {
        const t = T.parseSnapshot(e, e => function(e, t) {
          const n = ze(e.senderUid, t),
            i = document.createElement("div");
          if (i.className = "flex w-full mb-1 group", i.setAttribute("data-message-id", e.id), i.setAttribute("data-raw-text", e.text || ""), i.setAttribute("data-pending", e.hasPendingWrites || !1), i.setAttribute("data-reactions", JSON.stringify(e.reactions || {})), i.setAttribute("data-poll", JSON.stringify(e.poll || null)), e.text && V.myUid) {
            const t = e.text.includes(`<@${V.myUid}>`) || e.text.includes("@everyone") || e.text.includes("@here");
            let n = !1;
            if (!t && window.isMeInRole) {
              const t = /<@&(\w+)>/g;
              let i;
              for (; null !== (i = t.exec(e.text));)
                if (window.isMeInRole(i[1])) {
                  n = !0;
                  break
                }
            }(t || n) && i.classList.add("mention-highlight")
          }
          const o = n ? {
            dot: n.style.dot,
            text: n.style.text
          } : null;
          return i.innerHTML = s({
            myUid: V.myUid,
            senderUid: e.senderUid,
            senderName: e.senderName,
            senderPhotoURL: e.senderPhotoURL,
            timestamp: e.timestamp,
            text: e.text,
            attachments: e.attachments || [],
            isForwarded: e.isForwarded,
            replyTo: e.replyTo,
            edited: e.edited,
            reactions: e.reactions,
            hasPendingWrites: e.hasPendingWrites,
            poll: e.poll,
            context: "server",
            roleDotStyle: o?.dot,
            roleTextStyle: o?.text,
            messageId: e.id
          }), i
        }({
          id: e.id,
          hasPendingWrites: e.metadata.hasPendingWrites,
          ...e.data({
            serverTimestamps: "estimate"
          })
        }, V.activeServerId));
        T.applyRender(t)
      }(snap)
    })
  })
}
async function $e() {
  const n = Y("server-chat-input");
  if (!n) return;
  const i = (window.extractMentionContent ? window.extractMentionContent(n) : n.innerText).trim();
  if (!V.activeServerId || !V.activeChannelId || "text" !== V.activeChannelType) return;
  if (window.waitForAttachments) await window.waitForAttachments("server-chat-input");
  const readyAttachments = window.getAttachments?.("server-chat-input").filter(item => item.status === "ready" && item.url) || [];
  const hasAttachments = readyAttachments.length > 0;

  const r = i;
  if (!r && !hasAttachments) return;
  const s = V.serverMembersData?.[V.myUid];
  if (s && s.timeoutUntil && s.timeoutUntil > Date.now()) {
    const e = Math.ceil((s.timeoutUntil - Date.now()) / 1e3 / 60);
    return void alert(window.__f("js.timeout_write", {mins: e}, `لا يمكنك الكتابة. أنت مقيد (Timeout) لمدة ${e} دقيقة أخرى.`))
  }
  const a = V.channels.find(e => e.id === V.activeChannelId);
  if (me("send_messages", a))
    if (!hasAttachments || me("attach_files", a)) {
      if (a?.isLocked) {
        const e = se()?.ownerUid === V.myUid,
          t = me("administrator");
        if (!e && !t) return void alert(window.__fb("js.chan_locked", "هذه القناة مغلقة للكتابة حالياً."))
      }
      try {
        if (window.currentEditingMsgId && "server" === window.currentEditingType) {
          const e = window.currentEditingMsgId;
          return window.cancelEditingMessage(), void await window.updateServerMessage(e, r)
        }
        const msgCol = d(e, "servers", V.activeServerId, "channels", V.activeChannelId, "messages"),
          msgData = {
            text: r,
            senderUid: V.myUid,
            senderName: V.myProfile?.displayName || "User",
            senderPhotoURL: V.myProfile?.photoURL || t.currentUser?.photoURL || "",
            timestamp: b()
          };
        const attachments = readyAttachments.map(item => ({ url: item.url, kind: item.kind || "image", name: item.name || item.file?.name || "ملف", size: item.size || 0, mime: item.mime || item.file?.type || "", oneTime: !!item.oneTime, viewedBy: {} }));
        if (attachments.length) msgData.attachments = attachments;
        n.innerHTML = "", window.clearAttachments && window.clearAttachments("server-chat-input");
        window.currentReplyToMsgId && "server" === window.currentReplyToType && (msgData.replyTo = {
          msgId: window.currentReplyToMsgId,
          senderName: window.currentReplyData.senderName,
          text: window.currentReplyData.text
        }, window.cancelReplyMessage()), await g(msgCol, msgData);
        const o = l(e, "servers", V.activeServerId, "channels", V.activeChannelId),
          s = l(e, "servers", V.activeServerId);
        await Promise.all([f(o, {
          messageCount: L(1),
          lastMessageTimestamp: b()
        }), f(s, {
          [`channelMessageCounts.${V.activeChannelId}`]: L(1),
          totalMessageCount: L(1),
          updatedAt: b()
        })])
      } catch (e) {
        alert(window.__fb("js.send_fail", "فشل إرسال الرسالة"))
      }
    } else alert(window.__fb("js.no_attach_perm", "لا تملك صلاحية إرفاق الملفات في هذه القناة."));
  else alert(window.__fb("js.no_send_perm", "لا تملك صلاحية إرسال الرسائل في هذه القناة."))
}

window.openServerOneTimeImage = async function(messageId, attachmentIndex, context, url) {
  if (context !== 'server' || !V.activeServerId || !V.activeChannelId || !messageId || !url) return;
  const uid = V.myUid || t.currentUser?.uid;
  if (!uid) return;
  try {
    const messageRef = l(e, 'servers', V.activeServerId, 'channels', V.activeChannelId, 'messages', messageId);
    await f(messageRef, { [`attachments.${attachmentIndex}.viewedBy.${uid}`]: { name: V.myProfile?.displayName || window.__fb('app_chat.default_sender', 'مستخدم'), openedAt: Date.now() } });
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (_) { alert(window.__fb('js.img_open_fail', 'تعذر فتح الصورة.')); }
};

function Pe() {

  "function" == typeof window.setVoicePanelRoomLabel ? window.setVoicePanelRoomLabel() : (function() {
    const e = Y("active-room-id-display");
    e && (e.textContent = V.activeVoiceServerId && V.activeVoiceChannelName ? `#${V.activeVoiceServerId} • ${V.activeVoiceChannelName}` : V.activeVoiceRoomCode || "—");
  })();
  const t = Y("my-id");
  t && (t.textContent = V.activeVoiceRoomCode || "------")
}

function Ee(e = V.isVoiceHost) {
  VP.writePresence(false, { isHost: !!e });
}
window.forwardMessageToServer = async (n, i, o) => {
  if (!n || !i || !o) return;
  const r = d(e, "servers", n, "channels", i, "messages"),
    s = {
      text: o,
      senderUid: V.myUid,
      senderName: V.myProfile?.displayName || "User",
      senderPhotoURL: V.myProfile?.photoURL || t.currentUser?.photoURL || "",
      timestamp: b(),
      isForwarded: !0
    };
  await g(r, s)
}, window.refreshMyVoicePresence = () => Ee(), window.removeGhostFromFirebase = function(e, t = null, i = null, o = !1) {

  if (!o) {
    try { window.foxyLog && window.foxyLog("warn", "[Foxy][presence] تم حجب حذف presence عن بُعد (بقاعدة P0-6)", {uid:e, serverId:t, channelId:i}); } catch (_) {}
    return
  }
  const s = t || V.activeVoiceServerId,
    r = i || V.activeVoiceChannelId;
  if (!(s && r && e && n)) return;
  A(U(n, `/voice_presence/${s}/${r}/${e}`)).catch(() => {});
  A(U(n, `/server_activity/${s}/${e}`)).catch(() => {})
}, window.updateGlobalMediaStatus = function(e, t, i, o, r) {
  if (!(V.activeVoiceServerId && V.activeVoiceChannelId && V.myUid && n)) return;
  const s = U(n, `/voice_presence/${V.activeVoiceServerId}/${V.activeVoiceChannelId}/${V.myUid}`),
    a = {};
  void 0 !== e && (a.muted = e), void 0 !== t && (a.deafened = t), void 0 !== i && (a.screenSharing = i), void 0 !== o && (a.forceMuted = o), void 0 !== r && (a.forceDeafened = r);
  const c = V.voicePresenceMap?.[V.activeVoiceChannelId]?.[V.myUid];
  c?.name || (a.name = V.myProfile?.displayName || window.__fb("app_chat.default_sender", "مستخدم")), c?.photoURL || (a.photoURL = V.myProfile?.photoURL || ""),   Object.keys(a).length > 0 && E(s, a).catch(e => {})
}, window.updateGlobalNamePresence = function(e) {

  V.activeVoiceServerId && V.activeVoiceChannelId && V.myUid && n && P(U(n, `/voice_presence/${V.activeVoiceServerId}/${V.activeVoiceChannelId}/${V.myUid}/name`), e)
};
let _e = null;
async function Ae(t, i = !1) {
  if (_e) return _e;
  let o;
  if (_e = new Promise(e => {
      o = e
    }), "function" == typeof window.loadWebRTCTools && (window.webrtcLoaded || ("function" == typeof showLoading && showLoading(window.__fb("js.voice_tools", "جاري تحميل أدوات الصوت...")), await window.loadWebRTCTools(), "function" == typeof hideLoading && hideLoading()), "function" == typeof window.initPeer && !window.myId)) {
    "function" == typeof showLoading && showLoading(window.__fb("js.voice_init", "جاري تهيئة الاتصال...")), window.initPeer();
    for (let e = 0; e < 50 && !window.myId; e++) await new Promise(e => setTimeout(e, 100));
    "function" == typeof hideLoading && hideLoading()
  }
  const r = V.activeServerId;
  if ("function" == typeof window.leaveVoiceChannel) {
    const _dmHangup = document.getElementById("dm-voice-hangup-btn"),
      _leaveRoom = document.getElementById("leave-room-btn");
    //FIX: كان بينادي leaveVoiceChannel (تفكيك كامل: كل الـ MediaConnections
    //+ الميكروفون + شاشة المشاهدة) في كل مرة بندخل فيها القناة — حتى لو
    //إحنا أصلاً في نفس القناة. ده كان بيكسر استرجاع اتصال المشاهدة وبيجبر
    //المتفرج يعمل recall كل مرة ⇒ "الشير مش بيفتح".
    const _alreadyInTarget = V.activeVoiceChannelId === (t && t.id) && V.activeVoiceServerId === V.activeServerId;
    (!_alreadyInTarget && (_dmHangup && !_dmHangup.classList.contains("hidden") || _leaveRoom && !_leaveRoom.classList.contains("hidden") || window.isDmCalling || V.activeVoiceChannelId)) && await window.leaveVoiceChannel(!0)
  }
  try {
    const o = se()?.ownerUid === V.myUid,
      a = me("administrator"),
      c = o || a;
    if (!me("connect", t) && !c) return void alert(window.__fb("js.no_join_perm", "لا تملك صلاحية الانضمام لهذه القناة."));
    if (t.isLocked && !c) return void alert(window.__fb("js.room_closed", "هذه الغرفة مغلقة حالياً."));
    const d = V.serverMembersData?.[V.myUid];
    if (d && d.timeoutUntil && d.timeoutUntil > Date.now()) {
      const e = Math.ceil((d.timeoutUntil - Date.now()) / 1e3 / 60);
      return void alert(window.__f("js.timeout_voice", {mins: e}, `لا يمكنك الانضمام للقنوات الصوتية. أنت مقيد (Timeout) لمدة ${e} دقيقة أخرى.`))
    }
    if (t.userLimit > 0 && !c && Object.keys(V.voicePresenceMap[t.id] || {}).length >= t.userLimit) return void alert(window.__fb("js.room_full", "هذه الغرفة وصلت للحد الأقصى من المستخدمين."));
    const m = (!me("speak", t) || t.isMuted) && !c;
    m && "function" == typeof window.toggleMute && window.toggleMute(!0), t.bitrate && (window.selectedBitrate = t.bitrate), "function" == typeof window.switchView && window.switchView("room"), "function" == typeof window.showRoomView && window.showRoomView(!m, i);
    const u = Y("p-card-me");
    u && u.classList.remove("hidden");
    try {
      "function" == typeof window.ensureLocalStream && await window.ensureLocalStream()
    } catch (e) {}
    if (!window.myId && "function" == typeof window.initPeer) {
      await window.initPeer();
      for (let e = 0; e < 30 && !window.myId; e++) await new Promise(e => setTimeout(e, 100))
    }
    if (!window.myId) {
      "function" == typeof showLoading && showLoading(window.__fb("js.voice_init2", "جاري تهيئة الاتصال الصوتي...")), window.addSystemMsg && window.addSystemMsg(window.__fb("js.voice_init3", "جاري تهيئة نظام الصوت، يرجى الانتظار..."), "info"), "function" == typeof window.initPeer && await window.initPeer();
      for (let e = 0; e < 50 && !window.myId; e++) await new Promise(e => setTimeout(e, 100));
      "function" == typeof hideLoading && hideLoading()
    }
    if (!window.myId) return window.addSystemMsg && window.addSystemMsg(window.__fb("js.voice_fail", "فشل الاتصال بنظام الصوت. يرجى التحقق من اتصالك بالإنترنت."), "error"), void alert(window.__fb("js.voice_fail2", "تعذر الاتصال بنظام الصوت حالياً. يرجى تحديث الصفحة أو المحاولة لاحقاً."));
    const v = `${r}_${t.id}`,
      h = l(e, "server_voice_sessions", v);
    let f = t.roomCode || X();
    try {
      V.activeVoiceSessionKey && V.activeVoiceSessionKey !== v && await Ue();
      const e = await p(h);
      let o = Date.now();
      if (e.exists()) {
        const t = e.data();
        f = t.roomCode || f, o = Number(t.startedAtMs || Date.now()), V.isVoiceHost = !1
      } else await w(h, {
        serverId: r,
        channelId: t.id,
        channelName: t.name,
        roomCode: f,
        startedAtMs: o,
        hostUid: V.myUid,
        updatedAt: b()
      }), V.isVoiceHost = !0, s = {
        serverId: r,
        channelId: t.id,
        channelName: t.name,
        roomCode: f,
        startedAtMs: o
      }, Le(), V.activeVoiceSessionRef && (V.hostHeartbeatTimer = setInterval(() => {
        V.isVoiceHost && V.activeVoiceSessionRef && window.myId && w(V.activeVoiceSessionRef, {
          ...s,
          hostPeerId: window.myId,
          hostUid: V.myUid,
          heartbeatAt: Date.now(),
          updatedAt: b()
        }, {
          merge: !0
        }).catch(() => {})
      }, 12e3));
      V.activeVoiceSessionKey = v, V.activeVoiceSessionRef = h, V.activeVoiceRoomCode = f, V.activeVoiceStartedAtMs = o, V.activeVoiceChannelId = t.id, V.activeVoiceChannelName = t.name, V.activeVoiceServerId = r, window.voicePresenceToken = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, "function" == typeof window.playChannelSound && window.playChannelSound("join"), oe(), V.activeVoiceStartedAtMs && (ie(), V.activeVoiceTimerInterval = setInterval(() => {
          !1 !== window.isAppVisible && ie()
        }, 1e3), "function" == typeof window.startSessionTimer && window.startSessionTimer(), V.presenceRefreshInterval && clearInterval(V.presenceRefreshInterval), V.presenceRefreshInterval = setInterval(() => {

          V.activeVoiceChannelId && V.myUid && Ee(V.isVoiceHost)
}, 20e3)), he(), "function" == typeof window.showRoomView && window.showRoomView(!0, i), "function" == typeof window.updateMyRoomPresence && window.updateMyRoomPresence(`${r}:${t.id}`), Ee(V.isVoiceHost),
        //FIX: إشعار "متصل بالقناة الصوتية" في شريط الإشعارات (زي ديسكورد).
        "function" == typeof window.showVoiceCallNotification && window.showVoiceCallNotification({
          channelName: t.name,
          serverName: (V.servers.find(e => e.id === r) || {}).name || "",
          serverId: r,
          channelId: t.id
        }),
        VP.subscribeToChannel(t.id, r),
        VP.setupAutoLeave(),
        //FIX: بداية جلسة صوتية جديدة ⇒ بنمسح علامات "سبنا المشاركين" القديمة
        //عشان الاتصال اللي جاي من الزملاء ميترفضش.
        "function" == typeof window.__foxyClearLeftSessionPeers && window.__foxyClearLeftSessionPeers(),
        (() => {
          const a = U(n, `/server_activity/${r}/${V.myUid}`);
          P(a, { ts: Date.now() }).catch(() => {});
          _(a).remove().catch(() => {});
          Pe();
          if (window.analytics && "function" == typeof window.analytics.logVoiceJoin) {
            const e = V.servers.find(e => e.id === r);
            const n = e ? e.name : "Unknown Server";
            const i = Object.keys(V.voicePresenceMap?.[t.id] || {}).length + 1;
            window.analytics.logVoiceJoin(r, n, t.id, t.name, i);
          }
          "function" == typeof window.addSystemMsg && window.addSystemMsg(window.__f("js.joined_voice", {name: t.name}, `دخلت القناة الصوتية: ${t.name}`));
          V.voiceCmdUnsub && (V.voiceCmdUnsub(), V.voiceCmdUnsub = null);
        })()
      const c = async (e, t) => {
        if (e && "remote-cmd" === e.type) {

          const _from = e.from || null;
          if (!_from || !isVoiceAdminUid(_from)) {
            try { window.foxyLog && window.foxyLog("warn", "[Foxy][security] تجاهل أمر صوتي من مرسل غير مشرف", { action: e.action, from: _from }); } catch (_) {}
            A(t).catch(() => {});
            return;
          }
          if ("kick" === e.action) "function" == typeof window.beforeHangup && window.beforeHangup(), "function" == typeof window.releaseVoiceSession && window.releaseVoiceSession(), "function" == typeof window.disconnectFromRoom && window.disconnectFromRoom(), "function" == typeof window.hardReset && window.hardReset(), "function" == typeof window.addSystemMsg && window.addSystemMsg(window.__fb("js.kicked_by_admin", "❌ تم طردك بواسطة المدير"));
          else if ("mute" === e.action) "function" == typeof window.toggleMute && window.toggleMute(!0), "function" == typeof window.addSystemMsg && window.addSystemMsg(window.__fb("js.mic_closed_admin", "❗ قام المدير بإغلاق المايك الخاص بك"));
          else if ("unmute" === e.action) "function" == typeof window.resetForceMute && window.resetForceMute(), "function" == typeof window.toggleMute && window.toggleMute(!1);
          else if ("deafen" === e.action) "function" == typeof window.toggleDeafen && window.toggleDeafen(!0), "function" == typeof window.addSystemMsg && window.addSystemMsg(window.__fb("js.deaf_closed_admin", "❗ قام المدير بإغلاق السماعة الخاصة بك"));
          else if ("undeafen" === e.action) "function" == typeof window.resetForceDeafen && window.resetForceDeafen(), "function" == typeof window.toggleDeafen && window.toggleDeafen(!1);
          else if ("move" === e.action) {
            const t = e.targetChannelId,
              n = V.channels.find(e => e.id === t);
            n && ("function" == typeof window.leaveVoiceChannel && await window.leaveVoiceChannel(!0), Ae(n))
          }
          A(t).catch(() => {})
        }
      }, l = U(n, `voice_commands/${V.activeServerId}/${t.id}/${V.myUid}`), m = U(n, `voice_commands/${V.activeServerId}/global/${V.myUid}`), u = I(l, e => c(e.val(), l)), g = I(m, e => c(e.val(), m));
      V.voiceCmdUnsub = () => {
        u(), g()
      }, d && (d.serverMuted && "function" == typeof window.toggleMute && window.toggleMute(!0), d.serverDeafened && "function" == typeof window.toggleDeafen && window.toggleDeafen(!0))
    } catch (e) {
      alert(window.__fb("js.voice_enter_fail", "فشل الدخول للقناة الصوتية"))
    }
  } finally {
    _e = null, o()
  }
  var s
}
async function Re(e, t = !1, n = !0) {
  if ("text" === e.type && V.activeChannelId === e.id) {
    const e = document.getElementById("home-server-chat");
    if (e && !e.classList.contains("hidden")) return
  }
  const i = se();
  const previousCacheKey = V.activeServerId && V.activeChannelId ? `${V.activeServerId}:${V.activeChannelId}` : null;
  const previousMessages = document.getElementById("server-chat-messages");
  if (previousCacheKey && previousMessages && previousMessages.innerHTML && V.activeChannelId !== e.id) {
    V.serverChatCache.set(previousCacheKey, {
      html: previousMessages.innerHTML,
      scrollTop: previousMessages.scrollTop,
      limit: T.limit
    });
  }
  const nextCacheKey = V.activeServerId ? `${V.activeServerId}:${e.id}` : null;
  const cachedMessages = nextCacheKey ? V.serverChatCache.get(nextCacheKey) : null;
  if (cachedMessages && previousMessages) {
    previousMessages.innerHTML = cachedMessages.html;
    T._restoredCacheKey = nextCacheKey;
    requestAnimationFrame(() => { previousMessages.scrollTop = cachedMessages.scrollTop || 0; });
  }
  if ("function" == typeof window.setSidebarMode && window.setSidebarMode("server", i?.name || ""), V.activeChannelId = e.id, V.activeChannelType = e.type, V.serverChatLimit = cachedMessages?.limit || 50, V.isServerLoadingMore = !1, T.reset(cachedMessages?.limit || 50), window.__isLoadingMore = !1, V.activeServerId && localStorage.setItem(`lastChannel_${V.activeServerId}`, e.id), he(), "text" === e.type) {
    "function" == typeof window.switchView && !document.body.classList.contains("in-settings") && window.switchView("home"), "function" == typeof window.closeDirectMessage && window.closeDirectMessage(), xe(!1), Se(!0);
    const t = document.getElementById("home-server-chat");
    t && (t.classList.remove("animate-view"), requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        t.classList.add("animate-view")
      })
    })), se();
    const n = Y("server-chat-server-name"),
      i = Y("server-chat-channel-name");
    const targetServerId = V.activeServerId || e?.serverId;
    n && (n.textContent = `# ${e.name}`), i && (i.textContent = ""), targetServerId && e?.id && Ie(targetServerId, e.id)
  } else {
    if (Se(!1), xe(!0), "function" == typeof window.closeDirectMessage && window.closeDirectMessage(), Ce(), !n) return V.activeChannelId = e.id, void he();
    V.activeVoiceChannelId ? V.activeVoiceChannelId === e.id && V.activeVoiceServerId === V.activeServerId ? ("function" == typeof window.switchView && window.switchView("room"), "function" == typeof window.showRoomView && window.showRoomView(!1, t)) : ("function" == typeof window.leaveVoiceChannel && await window.leaveVoiceChannel(!0), await Ae(e, t)) : await Ae(e, t), fe()
  }
}

function Ve(t) {
  const i = re(t);
  if (!t || V.activeServerId === t) {
    ue();
    ve();
    he();
    return;
  }
  const loadToken = ++V.serverSelectionToken;
  "function" == typeof window.setSidebarMode && window.setSidebarMode("server", i?.name || ""), V.activeServerId = t, V.activeChannelId = null, V.activeChannelType = null, updateBrowserUrl(`/server/${i?.name||t}`, i?.name || window.__fb("web.t135", "سيرفر")), xe(!0), Se(!1), Ce(), ue(), ve(), he(), De(),
    function(e) {
      Te(), V.voicePresenceServerId = e;
      const t = U(n, `/voice_presence/${e}`);
      V.voicePresenceUnsub = I(t, snapshot => {
        if (loadToken !== V.serverSelectionToken || V.activeServerId !== e) return;
        const raw = snapshot.val() || {};

        const memberSig = c => Object.keys(c || {}).sort().map(ch => `${ch}:${Object.keys(c[ch] || {}).sort().join(",")}`).join("|");
        const prevSig = memberSig(V.voicePresenceMap);
        V.voicePresenceMap = raw;
        const memberSetChanged = memberSig(V.voicePresenceMap) !== prevSig;

        if (memberSetChanged) {

          try {
            const _sid = e;
            const _act = !!raw[_sid] && Object.keys(raw[_sid] || {}).length > 0;
            V.serverVoiceActivity = V.serverVoiceActivity || {};
            if (!!V.serverVoiceActivity[_sid] !== _act) { V.serverVoiceActivity[_sid] = _act; pe(); }
          } catch (_) {}
          z(), J()
        } else {

          V.activeVoiceChannelId && "function" == typeof window.renderMainRoomParticipants && window.renderMainRoomParticipants(V.activeVoiceChannelId)
        }

      })
    }(t),
    function(t) {
      Me();
      const i = d(e, "servers", t, "channels");
      V.channelsUnsub = v(i, i => {
        if (loadToken !== V.serverSelectionToken || V.activeServerId !== t) return;
        V.channels = i.docs.map(e => ({
          id: e.id,
          ...e.data()
        })).sort((e, t) => {
          const n = void 0 !== e.position ? e.position : 0,
            i = void 0 !== t.position ? t.position : 0;
          return n !== i ? n - i : Q(e.createdAt) - Q(t.createdAt)
        });
        const o = {};
        if (V.channels.forEach(e => {
            "text" === e.type && (o[e.id] = e.messageCount || 0)
          }), f(l(e, "servers", t), {
            channelMessageCounts: o
          }).catch(e => {}), n && R(U(n, `/voice_presence/${t}`)).then(e => {
            if (e.exists()) {
              const i = Object.keys(e.val() || {}),
                o = new Set(V.channels.map(e => e.id));
              i.forEach(e => {
                o.has(e) || A(U(n, `/voice_presence/${t}/${e}`)).catch(e => {})
              })
            }
          }).catch(e => {}), J(), V.activeChannelId) V.channels.some(e => e.id === V.activeChannelId) || (V.activeChannelId = null, V.activeChannelType = null, J());
        else {
          const e = localStorage.getItem(`lastChannel_${t}`),
            n = V.channels.find(t => t.id === e);
          if (n)
            if ("voice" === n.type)
              if (V.activeVoiceChannelId === n.id && V.activeVoiceServerId === t) Re(n, !0, !0);
              else {
                const e = V.channels.find(e => "text" === e.type);
                e ? Re(e, !0) : Re(n, !0, !1)
              }
          else Re(n, !0);
          else {
            const e = V.channels.find(e => "text" === e.type);
            e ? Re(e, !0) : (V.activeChannelId = null, J())
          }
        }
      })
    }(t),
     function(t) {
       if (!t) return;
       ke();
       const serverId = t,
         i = l(e, "servers", serverId);
       V.serverDocUnsub = v(i, snapshot => {
        if (loadToken !== V.serverSelectionToken || V.activeServerId !== serverId) return;
        if (!snapshot.exists()) return;
        const i = snapshot.data().memberUids || [];
        if (!i.length) return V.members = [], void je();
        const o = d(e, "users"),
          r = i.slice(0, 250),
          s = [];
        for (let e = 0; e < r.length; e += 25) s.push(r.slice(e, e + 25));
        V.membersUnsub && V.membersUnsub();
        const a = [];
        V.membersUnsub = () => {
          a.forEach(e => e()), a.length = 0, Object.values(V.memberStatusUnsubs || {}).forEach(e => {
            "function" == typeof e && e()
          }), V.memberStatusUnsubs = {}
        }, V._allDocsMap ? V._allDocsMap.clear() : V._allDocsMap = new Map, s.forEach(e => {
          const t = m(o, u("uid", "in", e)),
            i = v(t, e => {
              e.docs.forEach(e => V._allDocsMap.set(e.id, {
                id: e.id,
                ...e.data()
              })),               V.members = r.filter(e => V._allDocsMap.has(e)).map(e => V._allDocsMap.get(e));
              const t = new Set(V.members.map(e => e.id));

              Object.keys(V.memberStatusUnsubs).forEach(e => {
                t.has(e) || (V.memberStatusUnsubs[e](), delete V.memberStatusUnsubs[e], delete V.memberStatuses[e])
              });
              let _statusChanged = false;
              V.members.forEach(e => {
                if (V.memberStatusUnsubs[e.id]) return;
                const t = U(n, "/status/" + e.id);
                V.memberStatusUnsubs[e.id] = I(t, t => {
                  const n = t.val();
                  const prev = V.memberStatuses[e.id];

                  const changed = (prev?.state !== n?.state) || (prev?.last_changed !== n?.last_changed);
                  V.memberStatuses[e.id] = n;
                  changed && F()
                });
                _statusChanged = true;
              });
              _statusChanged && F()
            }, e => {});

          a.push(i)
        })
      }, e => {})
    }(t);
  const o = window.requestIdleCallback || setTimeout;
  o(() => {
    ! function(t) {
      Je();
      const n = d(e, "servers", t, "roles"),
        i = m(n, y("name", "asc"));
       V.rolesUnsub = v(i, e => {
        if (loadToken !== V.serverSelectionToken || V.activeServerId !== t) return;
        const n = [];
        if (e.forEach(e => {
            n.push({
              id: e.id,
              ...e.data()
            })
          }), V.serverRoles[t] = n, V.activeServerId === t) {
          He(), je();
          const e = Y("role-editor-overlay");
          e && !e.classList.contains("hidden") && Ge()
        }
      })
    }(t)
  }, {
    timeout: 3e3
  }), o(() => {
    ! function(t) {
      We();
      const n = d(e, "servers", t, "members");
       V.serverMembersDataUnsub = v(n, n => {
        if (loadToken !== V.serverSelectionToken || V.activeServerId !== t) return;
        const i = Y("sstab-members"),
          o = i && !i.classList.contains("hidden");
        n.docChanges().forEach(e => {
          const t = e.doc.id,
            i = e.doc.data(),
            r = V.serverMembersData[t]?.roles || [];
          if (V.serverMembersData[t] = i, t === V.myUid && V.activeVoiceChannelId && (n.docChanges().find(e => e.doc.id === t)?.doc.data(), i.serverMuted && "function" == typeof window.toggleMute && (document.getElementById("mic-off-path") && !document.getElementById("mic-off-path").classList.contains("hidden") || (window.toggleMute(!0), window.addSystemMsg && window.addSystemMsg(window.__fb("js.mic_closed_admin", "❗ قام المدير بإغلاق المايك الخاص بك")))), i.serverDeafened && "function" == typeof window.toggleDeafen && (document.getElementById("headphone-slash") && !document.getElementById("headphone-slash").classList.contains("hidden") || (window.toggleDeafen(!0), window.addSystemMsg && window.addSystemMsg(window.__fb("js.deaf_closed_admin", "❗ قام المدير بإغلاق السماعة الخاصة بك"))))), o) {
            const e = i.roles || [];
            JSON.stringify(r) !== JSON.stringify(e) && function(e, t) {
              const n = document.querySelector(`[data-member-roles="${e}"]`);
              if (!n) return;
              const i = Fe(se().id),
                o = Array.from(n.querySelectorAll(".role-badge")).map(e => e.getAttribute("data-role-id")),
                r = (t || []).map(e => {
                  const t = i.find(t => t.id === e);
                  if (!t) return null;
                  const n = qe(t),
                    r = !o.includes(e);
                  return `<span data-role-id="${e}" class="role-badge ${r?"role-badge-anim":""} px-2 py-0.5 rounded text-[10px] font-bold" style="${n.dot.replace("background-color","background")}; color: white;">${t.name}</span>`
                }).filter(Boolean).join(" ");
              n.innerHTML = r + `\n        <button onclick="openMemberRolePicker(event, '${e}')" class="w-5 h-5 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-sm">\n            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"></path>\n            </svg>\n        </button>\n    `
            }(t, e)
          }
        }), He(), V.activeServerId === t && je(), async function(t) {
          if (!t || Ke.has(t)) return;
          if (!ae() && !le()) return;
          const n = [];
          if (Object.entries(V.serverMembersData || {}).forEach(([i, o]) => {
              const r = o.roles || [],
                s = Z(t, r);
              JSON.stringify(o.effectivePermissions || {}) !== JSON.stringify(s) && n.push(f(l(e, "servers", t, "members", i), {
                effectivePermissions: s,
                updatedAt: b()
              }))
            }), n.length) {
            Ke.add(t);
            try {
              await Promise.all(n)
            } catch (e) {} finally {
              Ke.delete(t)
            }
          }
        }(t)
      })
    }(t)
  }, {
    timeout: 5e3
  })
}

function Te() {
  V.voicePresenceUnsub && (V.voicePresenceUnsub(), V.voicePresenceUnsub = null), V.voicePresenceServerId = null
}

function je() {
  try {
    const e = Y("server-members-sidebar"),
      t = e?.querySelector(".flex-1.overflow-y-auto");
    if (!t) return;
    const n = se();
    if (!n) return void(t.innerHTML = '<div class="p-4 text-center text-gray-500 text-xs">' + window.__fb("js.pick_members_title", "اختر سيرفر لرؤية الأعضاء") + '</div>');
    const i = n.id,
      o = Fe(i),
      r = n.ownerUid,
      s = Date.now(),
      c = new Set(V.members.map(e => e.id));
    if (window.memberElementsCache) {
      for (const e of window.memberElementsCache.keys()) c.has(e) || window.memberElementsCache.delete(e);
      if (window.memberElementsCache.size > 500) {
        const e = Array.from(window.memberElementsCache.keys()),
          t = window.memberElementsCache.size - 500;
        for (let n = 0; n < t; n++) window.memberElementsCache.delete(e[n])
      }
    } else window.memberElementsCache = new Map;
    const d = {},
      l = [],
      m = [];
    o.forEach(e => {
      e.hoist && (d[e.id] = {
        role: e,
        members: []
      })
    });
    const u = new Set;
    if (window.connections && "object" == typeof window.connections)
      for (const e in window.connections) {
        const t = window.connections[e];
        t && t.uid && u.add(t.uid)
      }
    V.members.forEach(e => {
      const t = V.memberStatuses[e.id];
      let n = u.has(e.id);
      if (!n && t && t.state) {
        if (n = "online" === t.state, n && t.last_changed) {
          const e = Q(t.last_changed);
          Date.now() - e > 12e4 && (n = !1)
        }
      } else if (!n) {
        const t = Q(e.lastLogin);
        n = s - t < 3e5
      }
      if (n) {
        const t = ze(e.id, i);
        t && t.hoistRole && d[t.hoistRole.id] ? d[t.hoistRole.id].members.push(e) : l.push(e)
      } else m.push(e)
    });
    const v = (e, t) => {
        let n = window.memberElementsCache.get(e.id);
        const o = !n;
        return n || (n = document.createElement("div"), n.id = `member-row-${e.id}`, window.memberElementsCache.set(e.id, n)),
          function(e, t, n, i, o, r) {
            const s = (t.displayName || "U").charAt(0).toUpperCase(),
              c = ze(t.id, i),
              d = c ? c.style : {
                dot: "",
                text: "",
                color: "#334155"
              },
              l = t.id === o,

              m = `${d.dot} background: transparent;`,
              u = `${t.photoURL}|${n}|${d.text}|${t.displayName}|${t.customStatus || ''}|${t.avatarColor || t.bannerColor || ''}`;
            if (e.getAttribute("data-render-key") === u) return void e.classList.remove("animate-pop-in");
            e.setAttribute("data-render-key", u);
            const v = e.getAttribute("data-last-section"),
              p = String(n),
              h = null !== v && v !== p;
            e.setAttribute("data-last-section", p);
            const w = r || h;
            e.className = "member-item cursor-pointer " + (w ? "animate-pop-in" : ""), w && e.addEventListener("animationend", () => {
              e.classList.remove("animate-pop-in")
            }, {
              once: !0
            }), e.onclick = e => {
              "function" == typeof window.showMemberProfile && window.showMemberProfile(e, t.id)
            }, e.oncontextmenu = e => {
              e.preventDefault(), window.showMemberContextMenu(e, t.id, t.displayName || window.__fb("app_chat.default_sender", "مستخدم"))
            };
            const f = l ? '\n        <span class="ml-1 text-[#f1c40f]" title="' + window.__fb("js.owner_badge", "صاحب السيرفر") + '">\n            <svg class="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20">\n                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>\n            </svg>\n        </span>' : "";

            let g = a(t.photoURL || "", t.displayName || "U", {
              size: "full",
              withOnError: !0,
              identity: t.id,
              color: t.avatarColor || t.bannerColor
            }); e.innerHTML = `\n        <div class="member-avatar-wrap hover:opacity-80 transition" onclick="event.stopPropagation(); if(typeof window.showMemberProfile === 'function') window.showMemberProfile(event, '${t.id}')">\n            <div class="member-avatar flex items-center justify-center overflow-hidden" style="${m}">\n                ${g}\n            </div>\n            <div class="member-status-dot ${n?"status-online":"status-offline"}"></div>\n        </div>\n        <div class="member-info">\n            <div class="member-name flex items-center gap-1">\n                <span class="truncate" style="${d.text}">${t.displayName||window.__fb("app_chat.default_sender", "مستخدم")}</span>\n                ${f}\n            </div>\n            <div class="member-subtext">${t.customStatus ? `<span class="text-[10px] text-gray-400 block truncate max-w-[120px]" title="${t.customStatus}">${t.customStatus}</span>` : (n?window.__fb("js.online_dot", "متصل"):window.__fb("js.away_dot", "بعيد"))}</div>\n        </div>\n    `
          }(n, e, t, i, r, o), n
      },
      p = document.createDocumentFragment();
    if (o.forEach(e => {
        const t = d[e.id];
        if (t && t.members.length > 0) {
          t.members.sort((e, t) => (e.displayName || "").localeCompare(t.displayName || "", "ar"));
          const n = document.createElement("div");
          n.className = "mb-4", n.innerHTML = `\n                    <p class="text-[11px] font-bold text-gray-500 uppercase tracking-widest px-2 mb-2">\n                        ${e.name} — ${t.members.length}\n                    </p>\n                    <div class="space-y-1 member-items-container"></div>\n                `;
          const i = n.querySelector(".member-items-container");
          t.members.forEach(e => i.appendChild(v(e, !0))), p.appendChild(n)
        }
      }), l.length > 0) {
      l.sort((e, t) => (e.displayName || "").localeCompare(t.displayName || "", "ar"));
      const e = document.createElement("div");
      e.className = "mb-4", e.innerHTML = `\n                <p class="text-[11px] font-bold text-emerald-500/70 uppercase tracking-widest px-2 mb-2">\n                    ${window.__f("js.online_h", {n: l.length}, `متصل — ${l.length}`)}\n                </p>\n                <div class="space-y-1 member-items-container"></div>\n            `;
      const t = e.querySelector(".member-items-container");
      l.forEach(e => t.appendChild(v(e, !0))), p.appendChild(e)
    }
    if (m.length > 0) {
      m.sort((e, t) => (e.displayName || "").localeCompare(t.displayName || "", "ar"));
      const e = document.createElement("div");
      e.innerHTML = `\n                <p class="text-[11px] font-bold text-gray-500 uppercase tracking-widest px-2 mb-2">\n                    ${window.__f("js.offline_h", {n: m.length}, `غير متصل — ${m.length}`)}\n                </p>\n                <div class="space-y-1 member-items-container"></div>\n            `;
      const t = e.querySelector(".member-items-container");
      m.forEach(e => t.appendChild(v(e, !1))), p.appendChild(e)
    }
    0 === V.members.length ? t.innerHTML = '<div class="p-8 text-center text-gray-500 text-xs">' + window.__fb("js.no_members", "لا يوجد أعضاء في هذا السيرفر") + '</div>' : (t.innerHTML = "", t.appendChild(p)), "function" == typeof window.updateProfileBarRoleStyle && window.updateProfileBarRoleStyle()
  } catch (e) {}
}

function De() {
  const e = Y("home-members-toggle"),
    t = Y("room-members-toggle"),
    n = Y("server-members-sidebar"),
    i = !!V.activeServerId;
  e && e.classList.toggle("hidden", !i), t && t.classList.toggle("hidden", !i), !i && n && n.classList.remove("active")
}

function Ne() {
  if (!V.myUid) return;
  if (V.serversUnsub && V.listeningUid === V.myUid) return;
  V.serversUnsub && (V.serversUnsub(), V.serversUnsub = null), V.listeningUid = V.myUid;
  const t = m(d(e, "servers"), u("memberUids", "array-contains", V.myUid));
  V.serversUnsub = v(t, e => {
    const t = e.docs.map(e => ({
        id: e.id,
        ...e.data()
      })),
      i = V.myProfile?.serverOrder || [];
    if (i.length > 0 ? t.sort((e, t) => {
        const n = i.indexOf(e.id),
          o = i.indexOf(t.id);
        return -1 !== n && -1 !== o ? n - o : -1 !== n ? -1 : -1 !== o ? 1 : Q(e.createdAt) - Q(t.createdAt)
      }) : t.sort((e, t) => Q(e.createdAt) - Q(t.createdAt)), V.servers = t, pe(), V.activeServerId && !V.servers.some(e => e.id === V.activeServerId)) {
      V.activeServerId = null, V.activeChannelId = null, V.activeChannelType = null, V.channels = [], Me(), ve(), he(), Se(!1), xe(!0), Ce();
      const e = Y("server-members-sidebar");
      e && e.classList.add("hidden")
    }!V.initialRouteHandled && V.servers.length > 0 && (V.initialRouteHandled = !0, Oe())
  })
}
async function Oe() {
  if (document.body.classList.contains("in-settings")) return;
  const t = window.location.hash;
  if (!t || "#/home" === t) return window.resetActiveServer(), void("function" == typeof window.switchView && !document.body.classList.contains("in-settings") && window.switchView("home"));
  if (t.startsWith("#/join/")) {
    const n = decodeURIComponent(t.replace("#/join/", ""));
    return void(n && async function(t) {
      if (V.myUid) try {
        const n = d(e, "servers"),
          i = await h(n);
        let o = null,
          r = null,
          s = "";
        for (const n of i.docs) {
          const i = l(e, "servers", n.id, "invite-links", t),
            a = await p(i);
          if (a.exists()) {
            const e = a.data();
            if (!e.active) continue;
            if (e.expiresAt && new Date(e.expiresAt.toDate()) < new Date) continue;
            if (e.maxUses > 0 && e.currentUses >= e.maxUses) continue;
            o = {
              id: a.id,
              ...e
            }, r = n.id, s = e.serverName || n.data().name || window.__fb("web.t135", "سيرفر");
            break
          }
        }
        if (!o) return alert(window.__fb("js.invite_bad", "رابط الدعوة غير صالح أو منتهي الصلاحية")), void(window.location.hash = "/home");
        const a = re(r);
        if (a && a.memberUids?.includes(V.myUid)) return Ve(r), void(window.location.hash = "");
        if (!await window.uiConfirm(window.__f("js.invite_join_q", {name: s}, `هل تريد الانضمام إلى سيرفر "${s}" عبر رابط الدعوة؟`))) return void(window.location.hash = "/home");
        const c = l(e, "servers", r);
        await f(c, {
          memberUids: x(V.myUid),
          updatedAt: b()
        });
        const m = l(e, "servers", r, "members", V.myUid);
        (await p(m)).exists() || await w(m, {
          joinMethod: `Invite Link (${t})`,
          joinedAt: b(),
          roles: []
        });
        const u = l(e, "servers", r, "invite-links", t);
        await f(u, {
          currentUses: L(1),
          usedBy: x({
            uid: V.myUid,
            name: V.currentUserProfile?.displayName || window.__fb("app_chat.default_sender", "مستخدم"),
            joinedAt: b()
          })
        }), Ve(r), window.location.hash = ""
      } catch (e) {
        alert(window.__fb("js.invite_join_fail2", "فشل الانضمام عبر رابط الدعوة")), window.location.hash = "/home"
      }
    }(n))
  }
  if (t.startsWith("#/server/")) {
    const n = decodeURIComponent(t.replace("#/server/", "")),
      i = V.servers.find(e => e.name === n || e.id === n);
    i ? Ve(i.id) : async function(t) {
      try {
        const n = d(e, "servers");
        let i = m(n, u("name", "==", t)),
          o = await h(i);
        if (o.empty) {
          const n = l(e, "servers", t),
            i = await p(n);
          return void(i.exists() && Be(i.id, i.data().name))
        }
        const r = o.docs[0];
        Be(r.id, r.data().name)
      } catch (e) {}
    }(n)
  }
}

function Be(t, n) {
  const i = Y("join-invite-modal"),
    o = Y("join-invite-text"),
    r = Y("join-invite-accept-btn");
  i && o && r && (o.textContent = window.__f("js.invited_q", {name: n}, `لقد تمت دعوتك للانضمام إلى سيرفر "${n}". هل تود الدخول؟`), i.classList.remove("hidden"), r.onclick = async () => {
    r.disabled = !0, r.textContent = window.__fb("js.joining", "...جاري الانضمام"), await async function(t) {
      if (V.myUid) try {
        const n = l(e, "servers", t);
        await f(n, {
          memberUids: x(V.myUid),
          updatedAt: b()
        });
        const i = l(e, "servers", t, "members", V.myUid);
        (await p(i)).exists() || await w(i, {
          joinMethod: "Invite Link",
          joinedAt: b(),
          roles: []
        }), Ve(t)
      } catch (e) {
        alert(window.__fb("js.join_fail", "فشل الانضمام للسيرفر"))
      }
    }(t), i.classList.add("hidden"), r.disabled = !1, r.textContent = window.__fb("app_server.accept_invite", "قبول الدعوة")
  })
}
async function He() {
  const e = se(),
    t = Y("server-roles-list");
  if (!e || !t) return;
  t.innerHTML = "";
  const n = Fe(e.id);
  0 !== n.length ? t.innerHTML = n.map(e => {
    const t = qe(e);
    let n = 0;
    return Object.values(V.serverMembersData || {}).forEach(t => {
      t.roles && t.roles.includes(e.id) && n++
    }), `\n            <div class="home-card bg-white/5 flex justify-between items-center p-4 cursor-pointer hover:bg-white/10 transition group"\n                 onclick="openRoleEditor('${e.id}')">\n                <div class="flex items-center gap-3">\n                    <div class="w-3 h-3 rounded-full" style="${t.dot}"></div>\n                    <span class="font-bold text-white" style="${t.text}">${e.name}</span>\n                </div>\n                <div class="flex items-center gap-4">\n                    <span class="text-[10px] text-gray-400">${window.__f("js.role_members", {n: n}, `${n} أعضاء`)}</span>\n                    <button onclick="event.stopPropagation(); deleteRole('${e.id}')" \n                            class="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition opacity-0 group-hover:opacity-100" \n                            title="${window.__fb("js.role_del_title", "حذف الدور")}">\n                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />\n                        </svg>\n                    </button>\n                </div>\n            </div>\n        `
  }).join("") : t.innerHTML = '\n            <div class="col-span-full py-20 text-center">\n                <div class="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">\n                    <svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>\n                    </svg>\n                </div>\n                <h3 class="text-white font-bold mb-1">' + window.__fb("js.no_roles2", "لا توجد أدوار") + '</h3>\n                <p class="text-xs text-gray-500 mb-6">' + window.__fb("js.no_roles_hint2", "ابدأ بتنظيم سيرفرك عن طريق إنشاء أول دور للأعضاء.") + '</p>\n            </div>\n        '
}

function qe(e) {
  const t = e.color || "#3b82f6",
    n = e.style || "solid";
  let i = `background-color: ${t};`,
    o = `color: ${t};`;
  if ("gradient" === n) {
    const e = `linear-gradient(135deg, ${t}, #ffffff)`;
    i = `background: ${e};`, o = `background: ${e}; -webkit-background-clip: text; -webkit-text-fill-color: transparent;`
  } else "holographic" === n && (i = `background-color: ${t}; box-shadow: 0 0 10px ${t};`, o = `color: ${t}; text-shadow: 0 0 8px ${t};`);
  return {
    dot: i,
    text: o,
    color: t
  }
}

function Fe(e) {
  return V.serverRoles[e] || []
}

function ze(e, t) {
  const n = Fe(t),
    i = (V.serverMembersData[e] || {
      roles: []
    }).roles || [];
  if (!i.length) return null;
  const o = n.filter(e => i.includes(e.id));
  if (!o.length) return null;
  const r = [...o].sort((e, t) => (e.name || "").localeCompare(t.name || "", "ar")),
    s = r[0];
  return {
    role: s,
    hoistRole: r.find(e => !0 === e.hoist) || null,
    style: qe(s)
  }
}

function Je() {
  V.rolesUnsub && (V.rolesUnsub(), V.rolesUnsub = null)
}

function We() {
  V.serverMembersDataUnsub && (V.serverMembersDataUnsub(), V.serverMembersDataUnsub = null), V.serverMembersData = {}

    "function" == typeof window != "undefined" && window.dispatchEvent && window.dispatchEvent(new CustomEvent("MemberDataReady"))
}
window.toggleMembersSidebar = function() {
  const e = Y("server-members-sidebar");
  if (!e) return;
  if (!V.activeServerId) return e.classList.remove("active"), void e.classList.add("hidden");
  e.classList.remove("hidden");
  const nextActive = !e.classList.contains("active");
  if (nextActive) {
    e.classList.add("active");
    window.FoxyBetterAnimations?.animateSidebarVisibility(e, false);
  } else {
    const finish = () => e.classList.remove("active");
    window.FoxyBetterAnimations?.animateSidebarVisibility(e, true, undefined, finish) || finish();
  }
}, window.addEventListener("hashchange", Oe), window.openInviteFriendsPopup = async function(e) {
  const popup = Y("invite-friends-popup"),
    list = Y("invite-friends-list");
  if (!popup || !list) return;
  const serverId = e || V.activeServerId || (window.state && window.state.activeServerId) || "";
  popup.dataset.serverId = serverId;
  popup.classList.remove("hidden");

  const server = re(serverId) || (V.servers || []).find(s => s.id === serverId);
  const serverName = server?.name || window.__fb("web.t135", "السيرفر");

  const titleEl = Y("invite-modal-server-title");
  if (titleEl) titleEl.textContent = window.__f("js.invite_to", {server: serverName}, `دعوة أصدقاء إلى ${serverName}`);

  const channelEl = Y("invite-modal-active-channel");
  const activeChannelName = V.activeChannelName || (V.channels && V.channels.find(c => c.id === V.activeChannelId)?.name) || window.__fb("js.chan_general", "عام");
  if (channelEl) channelEl.textContent = activeChannelName;

  const linkOutput = Y("generated-link-output");
  if (linkOutput) {
    linkOutput.value = `${window.location.origin}/join/${serverId}`;
  }

  const searchInput = Y("invite-friends-search-input");
  if (searchInput) searchInput.value = "";

  list.innerHTML = '<p class="text-xs text-gray-400 text-center py-6">' + window.__fb("app_loading.loading_profile", "جاري التحميل...") + '</p>';

  if (!server) {
    list.innerHTML = '<div class="py-6 text-center text-gray-400 text-xs font-medium">' + window.__fb("js.srv_info_missing", "لم يتم العثور على معلومات السيرفر") + '</div>';
    return;
  }

  const memberUids = server.memberUids || [];
  const friendsUids = window.myFriendsUids || [];
  const removedFriends = new Set(window.myRemovedFriends || []);
  const eligibleFriends = friendsUids.filter(id => !memberUids.includes(id) && !removedFriends.has(id));

  if (eligibleFriends.length === 0) {
    list.innerHTML = '<div class="py-8 text-center text-gray-400 text-xs font-bold">' + window.__fb("js.no_friends_invite", "لا يوجد أصدقاء متاحون للدعوة حالياً") + '</div>';
    return;
  }

  window._allEligibleInviteFriends = eligibleFriends.map(uid => {
    const friendData = "function" == typeof window.getFriendData ? window.getFriendData(uid) : null;
    return {
      uid: uid,
      displayName: friendData?.displayName || window.__fb("js.friend", "صديق"),
      tag: friendData?.customStatus || friendData?.email || friendData?.displayName || "",
      photoURL: friendData?.photoURL || ""
    };
  });

  window.renderInviteFriendsList(window._allEligibleInviteFriends);
},
window.renderInviteFriendsList = function(friends) {
  const list = Y("invite-friends-list");
  if (!list) return;
  if (!friends || friends.length === 0) {
    list.innerHTML = '<div class="py-6 text-center text-gray-400 text-xs font-medium">' + window.__fb("js.no_match_search", "لم يتم العثور على أصدقاء يطابقون البحث") + '</div>';
    return;
  }

  list.innerHTML = friends.map(f => {
    const avatarHTML = "function" === typeof a ? a(f.photoURL, f.displayName, { size: 8, shape: "circle", withOnError: true, identity: f.id || f.uid, color: f.avatarColor || f.bannerColor, extra: "" }) : `<img src="${f.photoURL || ''}" class="w-8 h-8 rounded-full object-cover">`;
    
    return `
      <div class="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-all group/row" data-friend-uid="${f.uid}">
        <div class="flex items-center gap-3 min-w-0">
          <div class="shrink-0">${avatarHTML}</div>
          <div class="flex flex-col min-w-0">
            <span class="text-xs font-bold text-gray-100 truncate">${f.displayName}</span>
            <span class="text-[10px] text-gray-400 truncate">${f.tag}</span>
          </div>
        </div>
        <button type="button" 
          onclick="window.sendSingleServerInvite('${f.uid}', this)" 
          class="px-3.5 py-1.5 bg-[#2b2d31] hover:bg-emerald-600 text-white rounded-lg text-xs font-bold border border-white/10 hover:border-emerald-500/50 transition-all active:scale-95 shrink-0 shadow-sm">
          ${window.__fb("js.invite_btn", "دعوة")}
        </button>
      </div>
    `;
  }).join('');
},
window.filterInviteFriendsList = function(query) {
  const q = (query || '').toLowerCase().trim();
  const all = window._allEligibleInviteFriends || [];
  if (!q) {
    window.renderInviteFriendsList(all);
    return;
  }
  const filtered = all.filter(f => f.displayName.toLowerCase().includes(q) || f.tag.toLowerCase().includes(q));
  window.renderInviteFriendsList(filtered);
},
window.sendSingleServerInvite = async function(friendUid, btn) {
  const popup = Y("invite-friends-popup");
  const serverId = popup?.dataset.serverId || V.activeServerId;
  if (!serverId || !friendUid) return;

  if (btn) {
    btn.disabled = true;
    btn.textContent = window.__fb("js.sending_short", "جاري...");
  }

  try {
    const server = re(serverId);
    const serverName = server?.name || window.__fb("web.t135", "السيرفر");
    
    if (typeof window.sendDirectMessageSystem === 'function') {
      const inviteMsg = window.__f("js.dm_invite", {server: serverName, url: `${window.location.origin}/join/${serverId}`}, `دعوة للانضمام إلى سيرفر **${serverName}**:\n${window.location.origin}/join/${serverId}`);
      await window.sendDirectMessageSystem(friendUid, inviteMsg);
    }
    
    if (btn) {
      btn.className = "px-3.5 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold border border-emerald-500/30 shrink-0 cursor-default";
      btn.textContent = window.__fb("js.invited_done", "تمت الدعوة");
    }
  } catch (err) {
    console.error("Failed to send invite:", err);
    if (btn) {
      btn.disabled = false;
      btn.textContent = window.__fb("js.invite_btn", "دعوة");
    }
    alert(window.__fb("js.invite_send_fail", "حدث خطأ أثناء إرسال الدعوة."));
  }
},
window.openInviteLinkSettingsModal = function() {
  const modal = Y("invite-settings-modal");
  if (modal) modal.classList.remove("hidden");
},
window.closeInviteLinkSettingsModal = function() {
  const modal = Y("invite-settings-modal");
  if (modal) modal.classList.add("hidden");
},
window.toggleInviteLinkSettings = function() {
  window.openInviteLinkSettingsModal();
}, window.generateRandomInviteCode = function() {
  let e = "";
  for (let t = 0; t < 8; t++) e += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".charAt(Math.floor(62 * Math.random()));
  const t = Y("invite-link-code");
  t && (t.value = e)
}, window.generateInviteLink = async function() {
  const t = Y("invite-friends-popup"),
    n = t?.dataset.serverId;
  if (!n) return;
  const i = Y("invite-link-code"),
    o = Y("invite-expires-select"),
    r = Y("invite-max-uses-select"),
    s = Y("generated-invite-link"),
    a = Y("generated-link-output"),
    c = Y("generate-invite-link-btn");
  let d = (i?.value || "").trim();
  if (!d || d.length < 3) alert(window.__fb("js.code_min", "الرجاء إدخال كود الرابط (3 أحرف على الأقل)"));
  else if (/^[a-zA-Z0-9_-]+$/.test(d))
    if (d.length > 20) alert(window.__fb("js.code_long", "الكود طويل جداً (الحد الأقصى 20 حرف)"));
    else {
      c && (c.disabled = !0, c.textContent = window.__fb("js.creating", "جاري الإنشاء..."));
      try {
        const t = l(e, "servers", n, "invite-links", d);
        if ((await p(t)).exists()) return alert(window.__fb("js.code_used", "هذا الكود مستخدم بالفعل في هذا السيرفر")), void(c && (c.disabled = !1, c.textContent = window.__fb("js.gen_invite_link", "توليد رابط الدعوة")));
        const i = o?.value || "12h";
        let m = null;
        if ("never" !== i) {
          const e = Date.now(),
            t = {
              m: 6e4,
              h: 36e5,
              d: 864e5
            },
            n = i.match(/^(\d+)([mhd])$/);
          n && (m = new Date(e + parseInt(n[1]) * t[n[2]]))
        }
        const u = parseInt(r?.value || "0");
        await w(t, {
          code: d,
          creatorUid: V.myUid,
          creatorName: V.currentUserProfile?.displayName || window.__fb("app_chat.default_sender", "مستخدم"),
          serverId: n,
          serverName: re(n)?.name || window.__fb("web.t135", "سيرفر"),
          expiresAt: m,
          maxUses: u,
          currentUses: 0,
          usedBy: [],
          active: !0,
          createdAt: b()
        }), s && s.classList.remove("hidden"), a && (a.value = `${window.location.origin}/join/${d}`); if(typeof window.closeInviteLinkSettingsModal==="function") window.closeInviteLinkSettingsModal()
      } catch (e) {
        alert(window.__fb("js.create_inv_fail", "فشل إنشاء رابط الدعوة"))
      }
      c && (c.disabled = !1, c.textContent = window.__fb("js.gen_invite_link", "توليد رابط الدعوة"))
    }
  else alert(window.__fb("js.code_rules", "الكود يمكن أن يحتوي فقط على أحرف وأرقام و - و _"))
}, window.copyInviteLink = function() {
  const input = Y("generated-link-output");
  const btn = Y("invite-copy-btn");
  if (!input) return;
  input.select();
  input.setSelectionRange(0, 99999);
  const text = input.value;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  if (btn) {
    const origText = btn.textContent;
    btn.textContent = window.__fb("js.copied_link", "تم النسخ!");
    btn.className = "px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-md shrink-0";
    setTimeout(() => {
      btn.textContent = origText;
      btn.className = "px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md active:scale-95 shrink-0";
    }, 2000);
  }
}, window.copyText = function(e) {
  navigator.clipboard?.writeText(e).catch(() => {}), alert(window.__fb("js.link_copied", "تم نسخ الرابط"))
}, window.closeInviteFriendsPopup = function() {
  const e = Y("invite-friends-popup");
  e && e.classList.add("hidden")
}, window.sendServerInvites = async function() {
  const t = Y("invite-friends-popup"),
    n = Y("invite-friends-list"),
    i = t?.dataset.serverId;
  if (!i || !n) return;
  const o = n.querySelectorAll(".invite-friend-check:checked");
  if (0 === o.length) return;
  const r = re(i),
    s = r?.name || window.__fb("web.t135", "سيرفر"),
    a = Y("send-invites-btn");
  a && (a.disabled = !0, a.textContent = window.__fb("js.sending", "جاري الإرسال..."));
  let c = 0;
  for (const t of o) {
    const n = t.value;
    try {
      const t = d(e, "servers", i, "invites");
      if (await g(t, {
          fromUid: V.myUid,
          fromName: V.currentUserProfile?.displayName || window.__fb("app_chat.default_sender", "مستخدم"),
          toUid: n,
          serverId: i,
          serverName: s,
          status: "pending",
          timestamp: b()
        }), "function" == typeof window.sendSilentDm) {
        const e = `__SERVER_INVITE__${i}|${s}`;
        await window.sendSilentDm(n, e, "server_invite")
      }
      c++
    } catch (e) {}
  }
  window.closeInviteFriendsPopup(), c > 0 && alert(window.__f("js.invites_sent", {n: c}, `تم إرسال ${c} دعوة بنجاح`))
}, window.loadServerInvites = async function() {
  const t = Y("server-context-menu"),
    n = t && t.dataset.serverId || V.activeServerId;
  if (!n) return;
  const i = Y("server-invites-list");
  if (i) {
    i.innerHTML = '<p class="text-sm text-gray-400">' + window.__fb("app_loading.loading_profile", "جاري التحميل...") + '</p>';
    try {
      const t = V.myUid;
      let o = "";
      const r = d(e, "servers", n, "invite-links"),
        s = await h(r);
      s.empty || (o += '<p class="text-xs font-bold text-gray-400 mb-2">' + window.__fb("js.inv_links_h", "روابط الدعوة") + '</p>', s.forEach(e => {
        const n = e.data(),
          i = n.creatorUid === t,
          r = n.expiresAt && new Date(n.expiresAt.toDate()) < new Date,
          s = n.maxUses > 0 && n.currentUses >= n.maxUses,
          c = n.active ? r ? window.__fb("js.inv_expired", "منتهي") : s ? window.__fb("js.inv_done", "مكتمل") : window.__fb("js.inv_active", "نشط") : window.__fb("js.inv_off", "معطل"),
          d = !n.active || r ? "text-red-400" : s ? "text-yellow-400" : "text-emerald-400",
          l = n.expiresAt ? n.expiresAt.toDate().toLocaleString((window.foxyI18n ? window.foxyI18n.getLang() : "ar")) : window.__fb("web.t283", "لا ينتهي"),
          m = n.maxUses > 0 ? `${n.currentUses}/${n.maxUses}` : window.__f("js.unlimited_uses", {n: n.currentUses}, `${n.currentUses} / غير محدود`);
        o += `\n                    <div class="home-card bg-white/5 flex items-center justify-between p-4">\n                        <div class="flex items-center gap-3 min-w-0">\n                            ${a("",n.creatorName||window.__fb("app_chat.default_sender", "مستخدم"),{size:8,shape:"circle",initialOnly:!0,extra:i?"bg-blue-500/20 text-blue-400":"bg-emerald-500/20 text-emerald-400"})}\n                            <div class="min-w-0">\n                                <p class="text-sm font-bold text-white truncate">${i?window.__fb("app_chat.you_label", "أنت"):n.creatorName||window.__fb("app_chat.default_sender", "مستخدم")}</p>\n                                <p class="text-[10px] text-gray-500 font-mono">${n.code}</p>\n                                <p class="text-[9px] text-gray-600">${m} · ${l}</p>\n                            </div>\n                        </div>\n                        <div class="text-right flex-shrink-0">\n                            <p class="text-xs font-bold ${d}">${c}</p>\n                            <button onclick="copyText('${window.location.origin}/join/${n.code}')" class="text-[9px] text-blue-400 hover:text-blue-300 transition mt-1">${window.__fb("js.copy_link", "نسخ الرابط")}</button>\n                        </div>\n                    </div>\n                `
      }));
      const c = d(e, "servers", n, "invites"),
        l = m(c, y("timestamp", "desc"), M(100)),
        u = await h(l);
      u.empty || (o && (o += '<div class="border-t border-white/5 my-4"></div><p class="text-xs font-bold text-gray-400 mb-2">' + window.__fb("js.friend_invites_h", "دعوات الأصدقاء") + '</p>'), u.forEach(e => {
        const n = e.data(),
          i = n.fromUid === t,
          r = "accepted" === n.status ? window.__fb("js.inv_accepted", "مقبولة") : "declined" === n.status ? window.__fb("js.inv_declined", "مرفوضة") : window.__fb("js.inv_pending", "معلقة"),
          s = "accepted" === n.status ? "text-emerald-400" : "declined" === n.status ? "text-red-400" : "text-yellow-400",
          c = n.timestamp?.toDate?.()?.toLocaleString((window.foxyI18n ? window.foxyI18n.getLang() : "ar")) || "";
        o += `\n                    <div class="home-card bg-white/5 flex items-center justify-between p-4">\n                        <div class="flex items-center gap-3 min-w-0">\n                            ${a("",n.fromName||window.__fb("app_chat.default_sender", "مستخدم"),{size:8,shape:"circle",initialOnly:!0,extra:i?"bg-blue-500/20 text-blue-400":"bg-emerald-500/20 text-emerald-400"})}\n                            <div class="min-w-0">\n                                <p class="text-sm font-bold text-white truncate">${i?window.__fb("app_chat.you_label", "أنت"):n.fromName||window.__fb("app_chat.default_sender", "مستخدم")}</p>\n                                <p class="text-[10px] text-gray-500">${window.__f("js.invite_to_who", {who: (n.toUid===t?"أنت":n.toUid||"")}, `إلى ${n.toUid===t?"أنت":n.toUid||""}`)}</p>\n                            </div>\n                        </div>\n                        <div class="text-right flex-shrink-0">\n                            <p class="text-xs font-bold ${s}">${r}</p>\n                            <p class="text-[9px] text-gray-500">${c}</p>\n                        </div>\n                    </div>\n                `
      })), i.innerHTML = o || '<p class="text-sm text-gray-400">' + window.__fb("js.no_invites", "لا توجد دعوات حتى الآن.") + '</p>'
    } catch (e) {
      i.innerHTML = '<p class="text-sm text-red-400">' + window.__fb("js.invites_load_fail", "فشل تحميل الدعوات") + '</p>'
    }
  }
}, window.acceptServerInvite = async function(t) {
  if (t && V.myUid)
    if (re(t)) Ve(t);
    else try {
      const n = l(e, "servers", t),
        i = await p(n);
      if (!i.exists()) return void alert(window.__fb("js.srv_not_found", "السيرفر غير موجود"));
      const o = i.data().name || window.__fb("web.t135", "سيرفر");
      if (!await window.uiConfirm(window.__f("js.join_q", {name: o}, `هل تريد الانضمام إلى ${o}؟`))) return;
      await f(n, {
        memberUids: x(V.myUid),
        updatedAt: b()
      });
      const r = l(e, "servers", t, "members", V.myUid);
      (await p(r)).exists() || await w(r, {
        joinMethod: "Invite Link",
        joinedAt: b(),
        roles: []
      }), Ve(t)
    } catch (e) {
      alert(window.__fb("js.join_fail", "فشل الانضمام للسيرفر"))
    }
}, window.openCreateServerPopup = function() {
  ne();
  const e = Y("create-server-popup"),
    t = Y("create-server-name-input"),
    n = Y("create-server-template-input"),
    i = Y("create-server-template-container"),
    o = Y("toggle-server-template-btn");
  if (e && (ee(e), "function" == typeof pushModalState && pushModalState("create-server-popup")), t && (t.value = "", setTimeout(() => t.focus(), 30)), n && (n.value = ""), i && i.classList.add("hidden"), o) {
    const e = o.querySelector(".toggle-icon");
    e && (e.innerHTML = '\n                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path>\n                </svg>\n            ')
  }
}, window.closeCreateServerPopup = function() {
  te(Y("create-server-popup"));
  const e = Y("create-server-template-input"),
    t = Y("create-server-template-container"),
    n = Y("toggle-server-template-btn");
  if (e && (e.value = ""), t && t.classList.add("hidden"), n) {
    const e = n.querySelector(".toggle-icon");
    e && (e.innerHTML = '\n                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path>\n                </svg>\n            ')
  }
}, window.toggleServerTemplateInput = function() {
  const e = Y("create-server-template-container"),
    t = Y("toggle-server-template-btn");
  if (!e || !t) return;
  const n = e.classList.contains("hidden"),
    i = t.querySelector(".toggle-icon");
  if (n) {
    e.classList.remove("hidden"), i && (i.innerHTML = '\n                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 12H4"></path>\n                </svg>\n            ');
    const t = Y("create-server-template-input");
    t && setTimeout(() => t.focus(), 30)
  } else e.classList.add("hidden"), i && (i.innerHTML = '\n                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path>\n                </svg>\n            ')
}, window.submitCreateServerPopup = async function() {
  await async function() {
    const t = Y("create-server-name-input"),
      n = Y("create-server-template-input");
    if (!t) return;
    const i = t.value.trim();
    if (i)
      if (V.myUid) try {
        const o = X(),
          r = n ? n.value.trim() : "";
        let s = null;
        if (r) try {
          s = await async function(e) {
            if (!e) return null;
            const t = String(e).trim();
            if (/discord(?:app)?\.com\/invite\/|discord\.gg\//i.test(t)) throw new Error(window.__fb("js.tpl_discord_only", "رابط الدعوة لا يحتوي على تصميم السيرفر. استخدم رابط discord.new أو discord.com/template."));
            let n = t;
            try {
              const e = new URL(t.includes("://") ? t : `https://${t}`),
                i = e.pathname.split("/").filter(Boolean);
              if (e.hostname.includes("discord.new")) n = i[0] || n;
              else {
                const e = i.findIndex(e => "templates" === e || "template" === e); - 1 !== e && i[e + 1] && (n = i[e + 1])
              }
            } catch (e) {
              const i = t.match(/(?:discord\.new\/|templates?\/|name_or_id:\s*|load\s+name_or_id:\s*|load\s+)([a-zA-Z0-9_-]+)/i) || t.match(/^([a-zA-Z0-9_-]{6,})$/);
              n = i ? i[1] : t
            }
            n = n.replace(/[^\w-].*$/, "");
            try {
              "function" == typeof showLoading && showLoading(window.__fb("js.fetching_tpl", "جاري جلب قالب السيرفر..."));
              const e = await fetch(`https://discord.com/api/v9/guilds/templates/${n}`);
              if (e.ok) {
                const t = await e.json();
                if (t && t.serialized_source_guild) return t.serialized_source_guild;
                throw new Error(window.__fb("js.srv_no_data", "استجابة السيرفر لا تحتوي على بيانات."))
              }
              throw await e.text().catch(() => ""), new Error(`Discord API ${e.status}: ${e.statusText||"request failed"}`)
            } catch (e) {
              throw e
            } finally {
              "function" == typeof hideLoading && hideLoading()
            }
          }(r)
        } catch (e) {
          return void alert(window.__f("js.tpl_fail", {err: e.message||window.__fb("js.check_link", "تأكد من الرابط أو الكود")}, `فشل تحميل قالب السيرفر: ${e.message||"تأكد من الرابط أو الكود"}`))
        }
        const a = {
          id: o,
          name: i,
          ownerUid: V.myUid,
          memberUids: [V.myUid],
          createdAt: b(),
          channelsOrder: []
        };
        await w(l(e, "servers", o), a);

        try { n && await P(U(n, `server_admins/${o}/${V.myUid}`), true); } catch (_) {}
        let c = null,
          d = -1;
        if (s) {
          const t = s.roles || [],
            n = {};
          for (let i = 0; i < t.length; i++) {
            const r = t[i],
              s = "@everyone" === r.name,
              a = s ? "@everyone" : X();
            n[r.id] = a;
            const m = r.color ? "#" + r.color.toString(16).padStart(6, "0") : "#3498db";
            await w(l(e, "servers", o, "roles", a), {
              id: a,
              name: r.name,
              color: m,
              hoist: !!r.hoist,
              mentionable: !!r.mentionable,
              canManageServer: !1,
              canManageRoles: !1,
              canManageChannels: !1,
              canKick: !1,
              canBan: !1,
              permissions: K(r.permissions),
              order: i
            }), !s && i > d && (d = i, c = a)
          }
          const i = s.channels || [],
            r = {},
            a = {},
            m = i.filter(e => 4 === e.type);
          for (let t = 0; t < m.length; t++) {
            const i = m[t],
              s = "category-" + X();
            r[i.id] = s;
            const c = {
                id: s,
                name: i.name,
                type: "category",
                createdAt: b(),
                createdBy: V.myUid,
                position: i.position || t
              },
              d = G(i.permission_overwrites, n);
            Object.keys(d).length > 0 && (c.permissionOverrides = d, a[i.id] = d), await w(l(e, "servers", o, "channels", s), c)
          }
          for (let t = 0; t < i.length; t++) {
            const s = i[t];
            if (4 === s.type) continue;
            let c = null;
            if (0 !== s.type && 5 !== s.type || (c = "text"), 2 !== s.type && 13 !== s.type || (c = "voice"), c) {
              const i = "text" === c ? "text-" + X() : "voice-" + X(),
                d = {
                  id: i,
                  name: s.name,
                  type: c,
                  createdAt: b(),
                  createdBy: V.myUid,
                  isLocked: !1,
                  position: s.position || t
                };
              if (s.parent_id && r[s.parent_id] && (d.categoryId = r[s.parent_id], a[s.parent_id] && (d.permissionOverrides = {
                  ...a[s.parent_id]
                })), s.permission_overwrites && s.permission_overwrites.length > 0) {
                const e = G(s.permission_overwrites, n);
                Object.keys(e).length > 0 && (d.permissionOverrides = {
                  ...d.permissionOverrides || {},
                  ...e
                })
              }
              "voice" === c && (d.roomCode = X(), d.userLimit = s.user_limit || 0, d.bitrate = s.bitrate ? Math.round(s.bitrate / 1e3) : 64, d.isMuted = !1), await w(l(e, "servers", o, "channels", i), d)
            }
          }
        } else {
          const textCatId = "category-" + X(),
            voiceCatId = "category-" + X();
          await w(l(e, "servers", o, "channels", textCatId), {
            id: textCatId,
            name: window.__fb("js.ch_text", "النصوص"),
            type: "category",
            createdAt: b(),
            createdBy: V.myUid,
            position: 0
          }), await w(l(e, "servers", o, "channels", voiceCatId), {
            id: voiceCatId,
            name: window.__fb("js.ch_voice", "الصوتية"),
            type: "category",
            createdAt: b(),
            createdBy: V.myUid,
            position: 1
          }), await w(l(e, "servers", o, "channels", "text-general"), {
            id: "text-general",
            name: window.__fb("js.chan_general", "عام"),
            type: "text",
            categoryId: textCatId,
            createdAt: b(),
            createdBy: V.myUid,
            position: 0
          }), await w(l(e, "servers", o, "channels", "voice-general"), {
            id: "voice-general",
            name: window.__fb("js.voice_general", "صوتي عام"),
            type: "voice",
            categoryId: voiceCatId,
            roomCode: X(),
            createdAt: b(),
            createdBy: V.myUid,
            position: 0
          })
        };
        t.value = "", n && (n.value = ""), te(Y("create-server-popup"));
        const m = c ? [c] : [];
        await w(l(e, "servers", o, "members", V.myUid), {
          joinMethod: "Owner",
          joinedAt: b(),
          roles: m,
          effectivePermissions: Z(o, m)
        }), Ve(o)
      } catch (e) {
        alert(window.__fb("js.srv_create_fail", "فشل إنشاء السيرفر"))
      } else alert(window.__fb("app_profile.login_required", "يجب تسجيل الدخول أولاً"))
  }()
}, window.openJoinServerPopup = function() {
  ne();
  const e = Y("join-server-popup"),
    t = Y("join-server-id-input");
  e && (ee(e), "function" == typeof pushModalState && pushModalState("join-server-popup")), t && (t.value = "", setTimeout(() => t.focus(), 30))
}, window.closeJoinServerPopup = function() {
  te(Y("join-server-popup"))
}, window.submitJoinServerPopup = async function() {
  await async function() {
    const t = Y("join-server-id-input");
    if (!t) return;
    const n = t.value.trim();
    if (n)
      if (V.myUid) try {
        const i = l(e, "servers", n);
        if (!(await p(i)).exists()) return void alert(window.__fb("js.srv_not_found", "السيرفر غير موجود"));
        await f(i, {
          memberUids: x(V.myUid),
          updatedAt: b()
        }), await w(l(e, "servers", n, "members", V.myUid), {
          joinMethod: "Join",
          joinedAt: b(),
          roles: [],
          effectivePermissions: {}
        }, {
          merge: !0
        }), t.value = "", te(Y("join-server-popup")), Ve(n)
      } catch (e) {
        alert(window.__fb("js.join_fail", "فشل الانضمام للسيرفر"))
      } else alert(window.__fb("app_profile.login_required", "يجب تسجيل الدخول أولاً"))
  }()
}, window.openCreateChannelPopup = function(e = "", t = "text") {
  document.querySelectorAll(".discord-context-menu").forEach(e => e.classList.add("hidden"));
  const n = Y("create-channel-popup"),
    i = Y("create-channel-name-input"),
    o = Y("create-channel-type-input"),
    r = Y("create-channel-category-input"),
    s = Y("create-channel-category-container");
  r && (r.innerHTML = '<option value="">' + window.__fb("web.t156", "بدون تصنيف (Uncategorized)") + '</option>', (V.channels || []).filter(e => "category" === e.type).forEach(e => {
    const t = document.createElement("option");
    t.value = e.id, t.textContent = e.name, r.appendChild(t)
  }), r.value = e), o && ["text", "voice", "category"].includes(t) && (o.value = t), o && s && (s.style.display = "category" === o.value ? "none" : "block"), o && !o.dataset.listenerBound && (o.dataset.listenerBound = "true", o.addEventListener("change", e => {
    const t = Y("create-channel-category-container");
    t && (t.style.display = "category" === e.target.value ? "none" : "block")
  })), n && (ee(n), "function" == typeof pushModalState && pushModalState("create-channel-popup")), i && (i.value = "", setTimeout(() => i.focus(), 30))
}, window.closeCreateChannelPopup = function() {
  te(Y("create-channel-popup"))
}, window.submitCreateChannelPopup = async function() {
  await async function() {
    if (!V.activeServerId) return void alert(window.__fb("js.pick_srv_first", "اختر سيرفر أولاً"));
    const t = Y("create-channel-name-input"),
      n = Y("create-channel-type-input"),
      i = Y("create-channel-category-input");
    if (!t || !n) return;
    const o = t.value.trim(),
      r = n.value,
      s = i ? i.value : "";
    if (o && ("text" === r || "voice" === r || "category" === r))
      if (de()) try {
        const a = `${r}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,
          c = {
            id: a,
            name: o,
            type: r,
            createdAt: b(),
            createdBy: V.myUid,
            isLocked: !1,
            position: V.channels ? V.channels.length : 0
          };
        "voice" === r && (c.roomCode = X(), c.userLimit = 0, c.bitrate = 64, c.isMuted = !1), "category" !== r && s && (c.categoryId = s);
        const d = l(e, "servers", V.activeServerId, "channels", a),
          m = l(e, "servers", V.activeServerId);
        await Promise.all([w(d, c), f(m, {
          [`channelMessageCounts.${a}`]: 0,
          updatedAt: b()
        })]), t.value = "", n.value = "text", i && (i.value = ""), te(Y("create-channel-popup"))
      } catch (e) {
        alert(window.__fb("js.chan_create_fail", "فشل إنشاء القناة"))
      } else alert(window.__fb("js.no_chan_perm", "لا تملك صلاحية إدارة القنوات."))
  }()
}, window.closeServerTextChannel = function(e = !1) {
  Se(!1), Ce(), T.destroy(), V.activeChannelId = null, V.activeChannelType = null, he(), e || (xe(!0), "function" == typeof window.showMobileSidePanels && window.showMobileSidePanels())
}, window.closeVoiceChannelParticipants = function() {
  "function" == typeof window.showMobileSidePanels && window.showMobileSidePanels()
}, window.beforeHangup = function() {
  Ue()
}, window.selectServerById = function(e) {
  e && Ve(e)
}, window.handleServerAction = async function(t) {
  const n = Y("server-context-menu"),
    i = n && n.dataset.serverId || V.activeServerId;
  if (i) switch (n && (n.classList.add("hidden"), delete n.dataset.serverId), t) {
    case "invite":
      if (!ae() && !me("create_invite") && !me("create_instant_invite")) return void alert(window.__fb("js.no_inv_perm", "لا تملك صلاحية إنشاء دعوة لهذا السيرفر."));
      window.openInviteFriendsPopup(i);
      break;
    case "settings":
      if (!ce() && !le() && !de()) return void alert(window.__fb("js.no_settings_perm", "لا تملك صلاحية فتح إعدادات السيرفر."));
      "function" == typeof window.switchView && window.switchView("server-settings");
      break;
    case "create-channel":
      if (!de()) return void alert(window.__fb("js.no_chan_create", "لا تملك صلاحية إنشاء قنوات."));
      window.openCreateChannelPopup("", "text");
      break;
    case "create-category":
      if (!de()) return void alert(window.__fb("js.no_section_create", "لا تملك صلاحية إنشاء أقسام."));
      window.openCreateChannelPopup("", "category");
      break;
    case "leave":
      if (!V.myUid) return;
      const t = se();
      if (t && t.ownerUid === V.myUid) return void alert(window.__fb("js.no_leave_owner", "لا يمكنك مغادرة السيرفر وأنت المالك. يجب عليك حذف السيرفر أو نقل الملكية (قريباً)."));
      if (await window.uiConfirm(window.__fb("js.leave_confirm", "هل أنت متأكد من مغادرة السيرفر؟"))) try {
        const t = l(e, "servers", i);
        await f(t, {
          memberUids: S(V.myUid)
        })
      } catch (e) {
        alert(window.__fb("js.leave_fail", "فشل مغادرة السيرفر"))
      }
  }
}, window.deleteActiveServer = async function() {
  const t = se();
  if (t && V.myUid)
    if (t.ownerUid === V.myUid) {
      if (await window.uiPrompt(window.__f("js.del_confirm_name", {name: t.name||t.id}, `اكتب اسم السيرفر للحذف النهائي: ${t.name||t.id}`)) === (t.name || t.id)) try {
        "function" == typeof showLoading && showLoading(window.__fb("js.deleting_srv", "جاري حذف السيرفر..."));
        const [n, i, o] = await Promise.all([h(d(e, "servers", t.id, "channels")), h(d(e, "servers", t.id, "roles")), h(d(e, "servers", t.id, "members"))]), r = [], s = n.docs.map(n => h(d(e, "servers", t.id, "channels", n.id, "messages")));
        (await Promise.all(s)).forEach(e => {
          e.docs.forEach(e => {
            r.push(C(e.ref))
          })
        }), n.docs.forEach(e => {
          r.push(C(e.ref))
        }), i.docs.forEach(e => {
          r.push(C(e.ref))
        }), o.docs.forEach(e => {
          r.push(C(e.ref))
        }), await Promise.all(r), await C(l(e, "servers", t.id)), V.activeServerId = null, V.activeChannelId = null, V.activeChannelType = null, V.channels = [], "function" == typeof window.switchView && window.switchView("home"), pe(), ve(), he()
      } catch (e) {
        alert(window.__f("js.del_fail", {err: e.message||window.__fb("js.console_details", "راجع الكونسول للتفاصيل")}, `فشل حذف السيرفر: ${e.message||"راجع الكونسول للتفاصيل"}`))
      } finally {
        "function" == typeof hideLoading && hideLoading()
      }
    } else alert(window.__fb("js.only_owner_del", "صاحب السيرفر فقط يمكنه حذف السيرفر."))
}, window.transferServerOwnership = async function(t) {
  const n = se();
  if (!n || !V.myUid || !t) return;
  if (n.ownerUid !== V.myUid) return void alert(window.__fb("js.only_owner_transfer", "صاحب السيرفر فقط يمكنه نقل الملكية."));
  if (t === V.myUid) return;
  const i = (Qe[t] || V.globalUsersData[t] || {}).displayName || t;
  if (await window.uiConfirm(window.__f("js.transfer_q", {name: i}, `هل تريد نقل ملكية السيرفر إلى ${i}؟`))) try {
    await f(l(e, "servers", n.id), {
      ownerUid: t,
      memberUids: x(t),
      updatedAt: b()
    }),

    await (async () => { try {
      const _rtdb = getRtdb() || n;
      await P(U(_rtdb, `server_admins/${n.id}/${t}`), true);
      await A(U(_rtdb, `server_admins/${n.id}/${V.myUid}`)).catch(() => {});
    } catch (_) {} })(), alert(window.__fb("js.transfer_done", "تم نقل ملكية السيرفر.")), Xe(), ve()
  } catch (e) {
    alert(window.__f("js.transfer_fail", {err: e.message||window.__fb("js.console_details", "راجع الكونسول للتفاصيل")}, `فشل نقل الملكية: ${e.message||"راجع الكونسول للتفاصيل"}`))
  }
}, window.saveServerName = async function() {
  const t = Y("server-settings-name-input").value.trim(),
    n = Y("server-settings-photo-input")?.value?.trim() || "",
    banner = Y("server-settings-banner-input")?.value?.trim() || "",
    i = V.activeServerId;
  if (t && i)
    if (ce()) try {
      await f(l(e, "servers", i), {
        name: t,
        photoURL: n,
        bannerURL: banner
      }), alert(window.__fb("js.settings_updated", "تم تحديث إعدادات السيرفر بنجاح"));
      try {
        const s = se();
        if (s) { s.name = t; s.photoURL = n; s.bannerURL = banner; }
        ve();
      } catch (_) {}
    } catch (e) {
      alert(window.__fb("js.settings_update_fail", "فشل تحديث إعدادات السيرفر"))
    } else alert(window.__fb("js.no_manage_srv", "لا تملك صلاحية إدارة السيرفر."))
}, window.updateServerPhotoPreview = function() {
  const e = Y("server-settings-photo-input"),
    t = Y("server-settings-photo-preview"),
    n = Y("server-settings-photo-initial"),
    i = Y("server-settings-name-input");
  if (!e || !t || !n) return;
  const o = e.value.trim();
  o ? (t.src = o, t.classList.remove("hidden"), n.classList.add("hidden"), t.onerror = () => {
    t.classList.add("hidden"), n.classList.remove("hidden"), n.textContent = (i?.value || "S").slice(0, 2).toUpperCase()
  }) : (t.classList.add("hidden"), n.classList.remove("hidden"), n.textContent = (i?.value || "S").slice(0, 2).toUpperCase())
}, window.handleServerPhotoFile = async function(e) {
  if (!e) return;
  const t = Y("server-settings-photo-loading"),
    n = Y("server-settings-photo-input");
  t && (t.classList.remove("hidden"), t.classList.add("flex"));
  try {
    const t = await i(e),
      r = await o(t);
    r && r.url && (n && (n.value = r.url), window.updateServerPhotoPreview())
  } catch (e) {
    alert(window.__fb("js.img_upload_fail", "فشل رفع الصورة، يرجى المحاولة مرة أخرى."))
  } finally {
    t && (t.classList.add("hidden"), t.classList.remove("flex"))
  }
}, window.removeServerPhoto = function() {
  const e = Y("server-settings-photo-input");
  e && (e.value = "", window.updateServerPhotoPreview())
}, window.updateServerBannerPreview = function() {
  const e = Y("server-settings-banner-input"),
    t = Y("server-settings-banner-preview"),
    n = Y("server-settings-banner-empty");
  if (!e || !t || !n) return;
  const o = e.value.trim();
  o ? (t.src = o, t.classList.remove("hidden"), n.classList.add("hidden"), t.onerror = () => {
    t.classList.add("hidden"), n.classList.remove("hidden")
  }) : (t.removeAttribute("src"), t.classList.add("hidden"), n.classList.remove("hidden"))
}, window.handleServerBannerFile = async function(e) {
  if (!e) return;
  if (!e.type || !e.type.startsWith("image/")) return void alert(window.__fb("js.img_only", "اختر صورة فقط."));
  const t = Y("server-settings-banner-loading"),
    n = Y("server-settings-banner-input");
  t && (t.classList.remove("hidden"), t.classList.add("flex"));
  try {
    const t = await i(e),
      r = await o(t);
    r && r.url && (n && (n.value = r.url), window.updateServerBannerPreview())
  } catch (e) {
    alert(window.__fb("js.img_upload_fail", "فشل رفع الصورة، يرجى المحاولة مرة أخرى."))
  } finally {
    t && (t.classList.add("hidden"), t.classList.remove("flex"))
  }
}, window.removeServerBanner = function() {
  const e = Y("server-settings-banner-input");
  e && (e.value = "", window.updateServerBannerPreview())
}, window.switchServerSettingsTab = function(e) {
  document.querySelectorAll(".settings-nav-item").forEach(t => {
    t.classList.toggle("active", t.id === `snav-${e}`)
  }), document.querySelectorAll(".ss-tab-content").forEach(e => {
    e.classList.add("hidden"), e.classList.remove("active-tab")
  });
  const t = Y(`sstab-${e}`);
  t && (t.classList.remove("hidden"), t.classList.add("active-tab")), "members" === e ? Xe() : "roles" === e ? He() : "invites" === e && "function" == typeof window.loadServerInvites && window.loadServerInvites()
}, window.getMemberRoleStyle = ze, window.getMemberStatus = e => V.memberStatuses[e], window.getActiveServer = () => se();
const Ke = new Set;
async function Ge(e) {
  const t = Y("role-editor-sidebar-list");
  if (!t) return;
  const n = V.activeServerId;
  if (!n) return;
  const i = Fe(n);
  0 !== i.length ? t.innerHTML = i.map(t => {
    const n = qe(t),
      i = t.id === e;
    return `\n            <div onclick="openRoleEditor('${t.id}')" \n                 class="flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-white/5 transition group ${i?"bg-white/10":""}">\n                <div class="flex items-center gap-2 overflow-hidden">\n                    <div class="w-2.5 h-2.5 rounded-full shrink-0" style="${n.dot}"></div>\n                    <span class="text-sm font-medium truncate ${i?"text-white":"text-gray-400"}" style="${n.text}">${t.name}</span>\n                </div>\n                <button onclick="event.stopPropagation(); deleteRole('${t.id}')" \n                        class="p-1 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition opacity-0 group-hover:opacity-100"\n                        title="${window.__fb("js.delete_title", "حذف")}">\n                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />\n                    </svg>\n                </button>\n            </div>\n        `
  }).join("") : t.innerHTML = '\n            <div class="p-4 text-center">\n                <p class="text-[10px] text-gray-500 uppercase tracking-widest">' + window.__fb("js.no_roles", "لا توجد أدوار بعد") + '</p>\n                <p class="text-[11px] text-gray-400 mt-1">' + window.__fb("js.no_roles_hint", "ابدأ بإنشاء دورك الأول!") + '</p>\n            </div>\n        '
}

function Ze() {
  Y("role-editor-footer")?.classList.remove("hidden")
}

function Ye(e) {
  const t = Y("role-editor-overlay");
  if (!t) return;
  const n = t.getAttribute("data-selected-style") || "solid",
    i = Y("re-color-preview-circle"),
    o = Y("re-role-name-title"),
    r = t.getAttribute("data-active-role-id"),
    s = r ? document.querySelector(`#role-editor-sidebar-list [onclick*="${r}"]`) : null,
    a = s ? s.querySelector("div") : null,
    c = s ? s.querySelector("span") : null,
    d = (t, i = !1) => {
      if (t)
        if (t.style.background = "", t.style.backgroundColor = "", t.style.color = "", t.style.webkitBackgroundClip = "", t.style.webkitTextFillColor = "", t.style.textShadow = "", t.classList.remove("blur-[1px]", "animate-pulse", "role-style-holographic"), "solid" === n) i ? t.style.color = e : t.style.backgroundColor = e;
        else if ("gradient" === n) {
        const n = `linear-gradient(135deg, ${e}, #ffffff)`;
        i ? (t.style.background = n, t.style.webkitBackgroundClip = "text", t.style.webkitTextFillColor = "transparent") : t.style.background = n
      } else "holographic" === n && (i ? (t.style.color = e, t.style.textShadow = `0 0 10px ${e}, 0 0 20px ${e}`) : (t.style.backgroundColor = e, t.style.boxShadow = `0 0 15px ${e}`), t.classList.add("role-style-holographic", "animate-pulse"))
    };
  d(i), d(o, !0), d(a), d(c, !0);
  const l = Y("re-style-solid")?.querySelector(".w-6"),
    m = Y("re-style-gradient")?.querySelector(".w-6"),
    u = Y("re-style-holographic")?.querySelector(".w-6");
  l && (l.style.backgroundColor = e), m && (m.style.background = `linear-gradient(135deg, ${e}, #ffffff)`), u && (u.style.backgroundColor = e, u.style.boxShadow = `0 0 10px ${e}`)
}
window.openCreateRolePopup = function() {
  le() ? openRoleEditor() : alert(window.__fb("js.no_roles_perm", "لا تملك صلاحية إدارة الأدوار."))
}, window.openRoleEditor = function(e = null) {
  const t = Y("role-editor-overlay");
  if (!t) return;
  const n = V.activeServerId;
  if (!n) return;
  if (!le()) return void alert(window.__fb("js.no_roles_perm", "لا تملك صلاحية إدارة الأدوار."));
  t.classList.remove("hidden");
  const i = e && "null" !== e ? e : "";
  if (t.setAttribute("data-active-role-id", i), switchRoleEditorTab("display"), function() {
      const e = Y("re-color-grid");
      !e || e.children.length > 0 || ["#99A1AB", "#1ABC9C", "#2ECC71", "#3498DB", "#9B59B6", "#E91E63", "#F1C40F", "#E67E22", "#E74C3C", "#95A5A6", "#607D8B", "#11806A", "#1F8B4C", "#206694", "#71368A", "#AD1457", "#C27C0E", "#A84300", "#992D22", "#979C9F"].forEach(t => {
        const n = document.createElement("div");
        n.className = "w-8 h-8 rounded-lg cursor-pointer hover:scale-110 transition border border-white/5 re-color-swatch", n.style.backgroundColor = t, n.onclick = () => {
          Y("role-editor-overlay").setAttribute("data-selected-color", t), Ye(t), Ze()
        }, e.appendChild(n)
      })
    }(), Ge(e), e) {
    const i = Fe(n).find(t => t.id === e);
    if (i) {
      Y("re-input-name").value = i.name, Y("re-role-name-title").textContent = i.name;
      const e = i.permissions || {};
      t.querySelectorAll("input[data-perm]").forEach(t => {
        t.checked = !!e[t.getAttribute("data-perm")]
      });
      const n = i.color || "#3b82f6",
        o = i.style || "solid";
      t.setAttribute("data-selected-color", n), t.setAttribute("data-selected-style", o), selectRoleStyle(o, !1), Ye(n), Y("re-toggle-hoist") && (Y("re-toggle-hoist").checked = !!i.hoist), Y("re-toggle-mentionable") && (Y("re-toggle-mentionable").checked = !!i.mentionable)
    }
  } else Y("re-input-name").value = "new role", Y("re-role-name-title").textContent = "new role", t.setAttribute("data-selected-color", "#3b82f6"), t.setAttribute("data-selected-style", "solid"), selectRoleStyle("solid", !1), Ye("#3b82f6"), Y("re-toggle-hoist") && (Y("re-toggle-hoist").checked = !1), Y("re-toggle-mentionable") && (Y("re-toggle-mentionable").checked = !1), t.querySelectorAll("input[data-perm]").forEach(e => {
    e.checked = !1
  });
  Y("role-editor-footer").classList.add("hidden"), t.querySelectorAll("input, select").forEach(e => {
    e.onchange = Ze, e.oninput = () => {
      "re-input-name" === e.id && (Y("re-role-name-title").textContent = e.value || "new role"), Ze()
    }
  })
}, window.closeRoleEditor = function() {
  const e = Y("role-editor-overlay");
  e && e.classList.add("hidden")
}, window.switchRoleEditorTab = function(e) {
  document.querySelectorAll(".re-tab-btn").forEach(t => {
    t.classList.toggle("active", t.id === `retab-${e}-btn`)
  }), document.querySelectorAll(".re-pane").forEach(t => {
    t.classList.toggle("hidden", t.id !== `retab-${e}`)
  })
}, window.resetRoleChanges = function() {
  Y("role-editor-footer")?.classList.add("hidden")
}, window.saveRoleChanges = async function() {
  const t = Y("re-input-name").value.trim(),
    n = V.activeServerId;
  if (t && n)
    if (le()) try {
      const i = Y("role-editor-overlay"),
        o = {};
      i.querySelectorAll("input[data-perm]").forEach(e => {
        o[e.getAttribute("data-perm")] = e.checked
      });
      const r = i.getAttribute("data-active-role-id"),
        s = {
          name: t,
          color: i.getAttribute("data-selected-color") || "#3b82f6",
          style: i.getAttribute("data-selected-style") || "solid",
          permissions: o,
          hoist: !!Y("re-toggle-hoist")?.checked,
          mentionable: !!Y("re-toggle-mentionable")?.checked,
          updatedAt: b()
        };
      if (r && "" !== r && "null" !== r) {
        await f(l(e, "servers", n, "roles", r), s);
        const t = Fe(n).map(e => e.id === r ? {
            ...e,
            ...s,
            id: r
          } : e),
          i = Object.entries(V.serverMembersData || {}).map(([i, o]) => {
            const s = o.roles || [];
            return s.includes(r) ? f(l(e, "servers", n, "members", i), {
              effectivePermissions: Z(n, s, t),
              updatedAt: b()
            }) : null
          }).filter(Boolean);
        await Promise.all(i)
      } else {
        const t = await g(d(e, "servers", n, "roles"), s);
        i.setAttribute("data-active-role-id", t.id)
      }
      alert(window.__f("js.role_saved", {name: t}, `تم حفظ الدور: ${t}`)), Y("role-editor-footer")?.classList.add("hidden")
    } catch (e) {
      alert(window.__fb("js.role_save_fail", "حدث خطأ أثناء حفظ الدور"))
    } else alert(window.__fb("js.no_roles_perm", "لا تملك صلاحية إدارة الأدوار."))
}, window.deleteRole = async function(t) {
  const n = Y("role-editor-overlay"),
    i = t || n?.getAttribute("data-active-role-id"),
    o = V.activeServerId;
  if (i && "" !== i && o)
    if (le())
      if ("@everyone" !== i) {
        if (await window.uiConfirm(window.__fb("js.role_del_confirm", "هل أنت متأكد من حذف هذا الدور؟ سيؤدي ذلك إلى إزالته من جميع الأعضاء ولا يمكن التراجع عن هذه الخطوة."))) try {
          await C(l(e, "servers", o, "roles", i));
          const t = Object.entries(V.serverMembersData || {}),
            r = [];
          for (const [n, s] of t)
            if (s.roles && s.roles.includes(i)) {
              const t = l(e, "servers", o, "members", n),
                a = s.roles.filter(e => e !== i);
              r.push(f(t, {
                roles: a,
                effectivePermissions: Z(o, a),
                updatedAt: b()
              }))
            } r.length > 0 && await Promise.all(r), alert(window.__fb("js.role_deleted", "تم حذف الدور بنجاح")), n && n.getAttribute("data-active-role-id") === i && closeRoleEditor(), He(), Y("role-editor-overlay")?.classList.contains("hidden") || Ge(n?.getAttribute("data-active-role-id"))
        } catch (e) {
          alert(window.__fb("js.role_del_fail", "حدث خطأ أثناء حذف الدور"))
        }
      } else alert(window.__fb("js.role_everyone", "لا يمكن حذف دور @everyone الافتراضي"));
  else alert(window.__fb("js.no_roles_perm", "لا تملك صلاحية إدارة الأدوار."));
  else alert(window.__fb("js.role_missing", "لا يمكن حذف دور غير موجود"))
}, window.selectRoleStyle = function(e, t = !0) {
  const n = Y("role-editor-overlay");
  if (!n) return;
  n.setAttribute("data-selected-style", e), n.querySelectorAll(".re-style-card").forEach(e => {
    e.classList.remove("active");
    const t = e.querySelector("span");
    t && t.classList.replace("text-white", "text-gray-500")
  });
  const i = Y(`re-style-${e}`);
  if (i) {
    i.classList.add("active");
    const e = i.querySelector("span");
    e && e.classList.replace("text-gray-500", "text-white")
  }
  Ye(n.getAttribute("data-selected-color") || "#3b82f6"), t && Ze()
};
const Qe = {};
async function Xe() {
  const t = se(),
    n = Y("server-settings-members-list");
  if (!t || !n) return;
  const i = Y("member-select-all");
  i && (i.checked = !1), updateSelectedMembersCount(), "" === n.innerHTML.trim() && (n.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400 font-bold animate-pulse">' + window.__fb("js.members_loading", "جاري تحميل الأعضاء...") + '</td></tr>');
  try {
    const i = t.memberUids || [],
      o = [],
      r = i.filter(e => !Qe[e]);
    if (r.length > 0) {
      const t = r.map(t => p(l(e, "users", t)));
      (await Promise.all(t)).forEach((e, t) => {
        const n = r[t];
        e.exists() && (Qe[n] = e.data())
      });
      const n = Object.keys(Qe);
      if (n.length > 1e3)
        for (let e = 0; e < 200; e++) delete Qe[n[e]]
    }
    i.forEach(e => {
      Qe[e] && o.push({
        uid: e,
        ...Qe[e]
      })
    });
    let s = "";
    o.forEach(e => {
      const n = V.serverMembersData[e.uid] || {},
        i = n.joinMethod || window.__fb("js.unknown", "غير معروف"),
        o = function(e) {
          if (!e) return window.__fb("js.unknown", "غير معروف");
          const t = Q(e);
          if (!t) return window.__fb("js.unknown", "غير معروف");
          const n = Date.now() - t,
            i = Math.floor(n / 1e3),
            o = Math.floor(i / 60),
            r = Math.floor(o / 60),
            s = Math.floor(r / 24);
          return i < 60 ? window.__fb("js.now_ago", "الآن") : o < 60 ? window.__f("js.ago_min", {n: o}, `منذ ${o} دقيقة`) : r < 24 ? window.__f("js.ago_hr", {n: r}, `منذ ${r} ساعة`) : s < 7 ? window.__f("js.ago_day", {n: s}, `منذ ${s} يوم`) : new Date(t).toLocaleDateString((window.foxyI18n ? window.foxyI18n.getLang() : "ar"))
        }(e.lastLogin),
        r = Fe(t.id),
        c = (n.roles || []).map(e => {
          const t = r.find(t => t.id === e);
          if (!t) return null;
          const n = qe(t);
          return `<span data-role-id="${e}" class="role-badge px-2 py-0.5 rounded text-[10px] font-bold" style="${n.dot.replace("background-color","background")}; color: white;">${t.name}</span>`
        }).filter(Boolean).join(" "),
        d = e.uid === t.ownerUid,
        l = d ? "disabled" : "",
        m = d ? window.__fb("js.no_kick_owner", "لا يمكن طرد صاحب السيرفر") : window.__fb("js.select_kick", "تحديد للطرد");
      s += `\n                <tr class="hover:bg-white/5 transition border-b border-white/[0.02] ${d?"opacity-80":""}">\n                    <td class="p-4">\n                        <input type="checkbox" name="member-select" value="${e.uid}" \n                               ${l} title="${m}"\n                               onchange="updateSelectedMembersCount()"\n                               class="member-row-checkbox rounded border-white/10 bg-black/40 text-blue-600 focus:ring-blue-500/50 ${d?"cursor-not-allowed opacity-30":"cursor-pointer"}">\n                    </td>\n                    <td class="p-4 flex items-center gap-3">\n                        ${a("",e.displayName,{size:8,shape:"circle",initialOnly:!0,extra:"bg-slate-700 text-emerald-400"})}\n                        <div>\n                                                        <div class="font-bold text-white text-xs">${e.displayName||"Unknown"} ${d?'<span class="text-[9px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded ml-1">' + window.__fb("js.owner_small", "مالك") + '</span>':""}</div>
\n                            <div class="text-[9px] text-gray-500 font-mono">${e.uid}</div>\n                        </div>\n                    </td>\n                    <td class="p-4 text-[11px] text-gray-400">${o}</td>\n                    <td class="p-4 text-[11px] text-gray-400">${i}</td>\n                    <td class="p-4">\n                        <div data-member-roles="${e.uid}" class="flex flex-wrap gap-1.5 items-center">\n                            ${c}\n                            <button onclick="openMemberRolePicker(event, '${e.uid}')" class="w-5 h-5 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-sm">\n                                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"></path>\n                                </svg>\n                            </button>\n                        </div>\n                    </td>\n                    <td class="p-4">\n                        ${d?'<span class="text-[10px] text-amber-400 font-bold">المالك</span>':`\n                            <button onclick="transferServerOwnership('${e.uid}')"\n                                class="text-[11px] font-bold text-amber-400 hover:text-amber-300 transition">\n                                نقل الملكية\n                            </button>\n                        `}\n                    </td>\n                </tr>\n            `
    }), n.innerHTML = s
  } catch (e) {
    n.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-red-400">' + window.__fb("js.members_load_fail", "فشل تحميل الأعضاء") + '</td></tr>'
  }
}

function et() {
  const e = Y("cs-perm-roles-list");
  if (!e || !V.activeServerId) return;
  const t = Fe(V.activeServerId);
  let n = `<button class="cs-nav-btn ${"@everyone"===V.currentPermRoleId?"cs-nav-active":""}" \n                        onclick="window.selectChannelPermRole('@everyone')">@everyone</button>`;
  t.forEach(e => {
    n += `<button class="cs-nav-btn ${V.currentPermRoleId===e.id?"cs-nav-active":""}" \n                         onclick="window.selectChannelPermRole('${e.id}')">${e.name}</button>`
  }), e.innerHTML = n
}

function tt(e) {
  const t = V.editingChannel;
  if (!t) return;
  const n = t.permissionOverrides[e] || {};
  document.querySelectorAll("#cs-permissions-grid .cs-perm-btns").forEach(e => {
    const t = e.getAttribute("data-perm"),
      i = n[t];
    e.querySelectorAll("span").forEach(e => e.classList.remove("active")), !0 === i ? e.querySelector(".cs-perm-check").classList.add("active") : !1 === i ? e.querySelector(".cs-perm-x").classList.add("active") : e.querySelector(".cs-perm-slash").classList.add("active")
  })
}

function nt(e, t) {
  const n = t ? re(t) : se(),
    i = Y("server-context-menu");
  if (!n || !i) return;
  e.preventDefault();
  const o = V.activeServerId;
  t && (V.activeServerId = t), i.dataset.serverId = t || V.activeServerId || "";
  const r = Y("server-settings-option");
  r && r.classList.toggle("hidden", !(ce() || le() || de()));
  const s = Y("server-create-channel-option"),
    a = Y("server-create-category-option"),
    c = de();
  s && s.classList.toggle("hidden", !c), a && a.classList.toggle("hidden", !c), t && (V.activeServerId = o),   document.querySelectorAll(".discord-context-menu").forEach(e => {
    e !== i && e.classList.add("hidden")
  }), "function" == typeof window.positionContextMenu ? window.positionContextMenu(i, e, !1) : (i.style.left = e.clientX + "px", i.style.top = e.clientY + "px"), i.classList.remove("hidden")
}
window.toggleAllMembersSelections = function(e) {
  document.querySelectorAll(".member-row-checkbox:not(:disabled)").forEach(t => t.checked = e.checked), updateSelectedMembersCount()
}, window.updateSelectedMembersCount = function() {
  const e = document.querySelectorAll(".member-row-checkbox:checked").length,
    t = Y("bulk-kick-btn"),
    n = Y("selected-members-count");
  t && n && (n.textContent = e, t.classList.toggle("hidden", 0 === e))
}, window.kickSelectedMembers = async function() {
  const t = se();
  if (!t) return;
  const n = document.querySelectorAll(".member-row-checkbox:checked"),
    i = Array.from(n).map(e => e.value);
  if (0 !== i.length && await window.uiConfirm(window.__f("js.bulk_kick_q", {n: i.length}, `هل أنت متأكد من طرد ${i.length} عضو من السيرفر؟`))) try {
    const n = l(e, "servers", t.id);
    await f(n, {
      memberUids: S(...i)
    }), alert(window.__fb("js.bulk_kicked", "تم طرد الأعضاء بنجاح")), Xe()
  } catch (e) {
    alert(window.__fb("js.bulk_kick_fail", "حدث خطأ أثناء طرد الأعضاء"))
  }
}, window.openMemberRolePicker = function(e, t) {
  e && e.stopPropagation();
  const n = se(),
    i = Y("member-role-picker-modal"),
    o = Y("member-role-picker-list");
  if (!n || !i || !o) return;
  if (!le()) return void alert(window.__fb("js.no_roles_perm", "لا تملك صلاحية إدارة الأدوار."));
  const r = Fe(n.id),
    s = r.length,
    a = (V.serverMembersData[t] || {
      roles: []
    }).roles || [];
  o.innerHTML = r.map(e => {
    const n = a.includes(e.id),
      i = qe(e);
    return `\n            <div onclick="toggleMemberRole('${t}', '${e.id}')" class="role-picker-item flex items-center justify-between p-2 rounded-lg hover:bg-white/5 cursor-pointer transition">\n                <div class="flex items-center gap-3">\n                    <div class="w-2.5 h-2.5 rounded-full" style="${i.dot}"></div>\n                    <span class="text-[11px] font-medium text-gray-300">${e.name}</span>\n                </div>\n                <div class="w-3.5 h-3.5 rounded border ${n?"bg-emerald-600 border-emerald-600":"border-white/20"} flex items-center justify-center transition">\n                    ${n?'<svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M5 13l4 4L19 7"></path></svg>':""}\n                </div>\n            </div>\n        `
  }).join("");
  const c = e?.currentTarget,
    d = i.querySelector("div");
  if (c && d) {
    const e = c.getBoundingClientRect(),
      t = 220,
      n = 36 * s + 10;
    i.classList.remove("hidden"), d.style.position = "fixed", d.style.width = `${t}px`, d.style.left = e.left + e.width / 2 - t / 2 + "px", d.style.top = e.top - n - 4 + "px", d.classList.remove("animate-pop-up"), requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        d.classList.add("animate-pop-up")
      })
    })
  }
  const l = () => {
    closeMemberRolePicker(), window.removeEventListener("click", l)
  };
  setTimeout(() => window.addEventListener("click", l), 10)
}, window.closeMemberRolePicker = function() {
  te(Y("member-role-picker-modal"))
}, window.toggleMemberRole = async function(t, n) {
  const i = se();
  if (!i) return;
  if (!le()) return void alert(window.__fb("js.no_roles_perm", "لا تملك صلاحية إدارة الأدوار."));
  const o = l(e, "servers", i.id, "members", t),
    r = (V.serverMembersData[t] || {
      roles: []
    }).roles || [],
    s = r.includes(n) ? r.filter(e => e !== n) : Array.from(new Set([...r, n]));
  try {
    await w(o, {
      roles: s,
      effectivePermissions: Z(i.id, s),
      updatedAt: b()
    }, {
      merge: !0
    }), setTimeout(() => openMemberRolePicker(null, t), 50)
  } catch (e) {
    alert(window.__fb("js.rank_fail", "فشل تحديث الرتبة"))
  }
}, window.showCategoryContextMenu = function(e, t) {
  const n = Y("category-context-menu");
  n && (V.lastContextCategory = t, "function" == typeof window.positionContextMenu ? window.positionContextMenu(n, e, !1) : (n.style.left = e.clientX + "px", n.style.top = e.clientY + "px"), n.classList.remove("hidden"), setTimeout(() => {
    document.addEventListener("click", function o(r) {
      n.contains(r.target) || (n.classList.add("hidden"), document.removeEventListener("click", o))
    })
  }, 0))
}, window.handleCategoryAction = async function(t) {
  const i = V.lastContextCategory;
  Y("category-context-menu")?.classList.add("hidden");
  if (!i) return;
  if ("add_channel" === t) window.openCreateChannelPopup(i.id, "text");
  else if ("delete" === t && await window.uiConfirm(window.__fb("js.section_del_q", "هل أنت متأكد من حذف هذا القسم؟"))) try {
    const n = i.id,
      o = V.activeServerId;
    await C(l(e, "servers", o, "channels", n)), alert(window.__fb("js.section_deleted", "تم حذف القسم بنجاح"))
  } catch (e) {
    alert(window.__fb("js.section_del_fail", "فشل حذف القسم"))
  }
}, window.showChannelContextMenu = function(e, t) {
  const n = Y("channel-context-menu");
  n && (V.lastContextChannel = t, "function" == typeof window.positionContextMenu ? window.positionContextMenu(n, e, !1) : (n.style.left = e.clientX + "px", n.style.top = e.clientY + "px"), n.classList.remove("hidden"))
}, window.handleChannelAction = async function(t) {
  const i = V.lastContextChannel;
  if (Y("channel-context-menu")?.classList.add("hidden"), i)
    if (de(i)) {
      if ("settings" === t) window.openChannelSettings(i);
      else if ("delete" === t && await window.uiConfirm(window.__f("js.chan_del_q", {name: i.name}, `هل أنت متأكد من حذف القناة "${i.name}"؟`))) try {
        const t = i.id,
          o = V.activeServerId;
        await C(l(e, "servers", o, "channels", t)), n && A(U(n, `/voice_presence/${o}/${t}`)).catch(e => {}), alert(window.__fb("js.chan_deleted", "تم حذف القناة بنجاح"))
      } catch (e) {
        alert(window.__fb("js.chan_del_fail", "فشل حذف القناة"))
      }
    } else alert(window.__fb("js.no_chan_manage", "لا تملك صلاحية إدارة هذه القناة."))
}, window.openChannelSettings = function(e) {
  const t = Y("channel-settings-modal");
  if (!t) return;
  if (!de(e)) return void alert(window.__fb("js.no_chan_manage", "لا تملك صلاحية إدارة هذه القناة."));
  V.originalEditingChannel = JSON.parse(JSON.stringify(e)), V.originalEditingChannel.permissionOverrides || (V.originalEditingChannel.permissionOverrides = {}), V.editingChannel = {
    ...e,
    permissionOverrides: JSON.parse(JSON.stringify(e.permissionOverrides || {}))
  }, V.currentPermRoleId = "@everyone";
  const n = Y("cs-input-name");
  n && (n.value = e.name, n.oninput = () => checkChannelSettingsChanges());
  const i = Y("cs-check-locked");
  i && (i.checked = !!e.isLocked, i.onchange = () => checkChannelSettingsChanges());
  const o = Y("cs-voice-settings"),
    r = "voice" === e.type;
  if (o && o.classList.toggle("hidden", !r), r) {
    const t = Y("cs-input-user-limit");
    t && (t.value = e.userLimit || 0)
  }
  const s = Y("cs-check-private");
  s && (s.checked = !!e.isLocked, s.onchange = () => checkChannelSettingsChanges());
  const a = Y("cs-sidebar-channel");
  if (a) {
    const t = "voice" === e.type ? "🔊" : "#";
    a.textContent = `${t} ${e.name}`
  }
  const c = Y("cs-perm-voice-section");
  c && c.classList.toggle("hidden", !r);
  const _textPerm = Y("cs-perm-text-section");
  _textPerm && _textPerm.classList.toggle("hidden", r);
  et(), tt("@everyone"), window.csTab("overview"), Y("cs-save-bar")?.classList.add("hidden"), t.style.display = "flex", t.classList.remove("hidden")
}, window.resetChannelSettings = function() {
  V.originalEditingChannel && window.openChannelSettings(V.originalEditingChannel)
}, window.checkChannelSettingsChanges = function() {
  const e = V.editingChannel,
    t = V.originalEditingChannel,
    n = Y("cs-save-bar");
  if (!e || !t || !n) return;
  const i = Y("cs-input-name")?.value.trim(),
    o = !(!Y("cs-check-private")?.checked && !Y("cs-check-locked")?.checked),
    r = parseInt(Y("cs-input-user-limit")?.value) || 0;
  let s = !1;
  i !== t.name && (s = !0), o !== !!t.isLocked && (s = !0), "voice" === e.type && r !== (t.userLimit || 0) && (s = !0), JSON.stringify(e.permissionOverrides) !== JSON.stringify(t.permissionOverrides) && (s = !0), n.classList.toggle("hidden", !s)
}, window.closeChannelSettings = function() {
  const e = Y("channel-settings-modal");
  e && (e.classList.add("hidden"), e.style.display = "none"), V.editingChannel = null
}, window.csTab = function(e) {
  ["overview", "permissions"].forEach(t => {
    const n = Y(`cs-tab-${t}`),
      i = Y(`cs-nav-${t}`);
    n && n.classList.toggle("hidden", t !== e), i && i.classList.toggle("cs-nav-active", t === e)
  })
}, window.deleteChannelFromSettings = async function() {
  const t = V.editingChannel;
  if (t && V.activeServerId)
    if (de(t)) {
      if (await window.uiConfirm(window.__f("js.chan_del_q", {name: t.name}, `هل أنت متأكد من حذف القناة "${t.name}"؟`))) try {
        const i = t.id,
          o = V.activeServerId;
        await C(l(e, "servers", o, "channels", i)), n && A(U(n, `/voice_presence/${o}/${i}`)).catch(e => {}), alert(window.__fb("js.chan_deleted", "تم حذف القناة بنجاح")), window.closeChannelSettings()
      } catch (e) {
        alert(window.__fb("js.chan_del_fail", "فشل حذف القناة"))
      }
    } else alert(window.__fb("js.no_chan_manage", "لا تملك صلاحية إدارة هذه القناة."))
}, window.saveChannelSettings = async function() {
  const t = V.editingChannel;
  if (!t || !V.activeServerId) return;
  if (!de(t)) return void alert(window.__fb("js.no_chan_manage", "لا تملك صلاحية إدارة هذه القناة."));
  const n = Y("cs-input-name").value.trim();
  if (!n) return;
  const i = {
    name: n,
    isLocked: !(!Y("cs-check-private")?.checked && !Y("cs-check-locked")?.checked),
    permissionOverrides: t.permissionOverrides || {},
    updatedAt: b()
  };
  "voice" === t.type && (i.userLimit = parseInt(Y("cs-input-user-limit")?.value) || 0);
  try {
    await f(l(e, "servers", V.activeServerId, "channels", t.id), i), Y("cs-save-bar")?.classList.add("hidden"), V.originalEditingChannel = JSON.parse(JSON.stringify({
      ...t,
      ...i
    }))
  } catch (e) {
    alert(window.__fb("js.settings_save_fail", "فشل حفظ الإعدادات"))
  }
}, window.selectChannelPermRole = function(e) {
  V.currentPermRoleId = e, et(), tt(e)
}, window.toggleChannelPerm = function(e, t) {
  const n = e.parentElement,
    i = n.getAttribute("data-perm"),
    o = V.currentPermRoleId,
    r = V.editingChannel;
  r.permissionOverrides[o] || (r.permissionOverrides[o] = {}), n.querySelectorAll("span").forEach(e => e.classList.remove("active")), e.classList.add("active"), "allow" === t ? r.permissionOverrides[o][i] = !0 : "deny" === t ? r.permissionOverrides[o][i] = !1 : (delete r.permissionOverrides[o][i], 0 === Object.keys(r.permissionOverrides[o]).length && delete r.permissionOverrides[o]), window.checkChannelSettingsChanges(), document.getElementById("cs-save-bar")?.classList.remove("hidden")
}, window.showMemberContextMenu = function(e, t, n) {
  const i = Y("member-context-menu");
  if (!i) return;
  V.lastContextMemberUid = t, V.lastContextMemberName = n, V.lastContextEvent = e, window.lastContextMemberName = n;
  const o = t === V.myUid,
    r = Y("member-volume-section"),
    s = Y("member-actions-section");
  if (r && (r.classList.toggle("hidden", o), !o)) {
    const sliderEl = Y("member-volume-slider"),
      displayEl = Y("member-volume-display"),
      inputEl = Y("member-volume-input");
    if (sliderEl && displayEl) {
      let peerIdForSlider = null;
      if (V.activeChannelPresenceMap && V.activeChannelPresenceMap[t]) peerIdForSlider = V.activeChannelPresenceMap[t].peerId;
      else if (V.voicePresenceMap)
        for (const _ch in V.voicePresenceMap)
          if (V.voicePresenceMap[_ch][t]) {
            peerIdForSlider = V.voicePresenceMap[_ch][t].peerId;
            break
          } let displayVol = 100;
      if (peerIdForSlider) {
        if (window._volumeStore = window._volumeStore || {}, void 0 !== window._volumeStore[peerIdForSlider]) displayVol = Math.round(100 * window._volumeStore[peerIdForSlider]);
        else {
          const connForVol = window.connections && window.connections[peerIdForSlider];
          if (connForVol && void 0 !== connForVol.volumeRatio) displayVol = Math.round(100 * connForVol.volumeRatio);
          else {
            const audioForVol = document.getElementById("audio-" + peerIdForSlider);
            audioForVol && (displayVol = Math.round(100 * audioForVol.volume))
          }
        }
        const audioElForSlider = document.getElementById("audio-" + peerIdForSlider),
          muteCheckboxEl = Y("member-mute-checkbox"),
          muteTextEl = Y("member-mute-text");
        muteCheckboxEl && muteCheckboxEl.classList.toggle("checked", !!audioElForSlider && audioElForSlider.muted), muteTextEl && (muteTextEl.textContent = audioElForSlider && audioElForSlider.muted ? window.__fb("js.unmute_sound", "إلغاء كتم الصوت") : window.__fb("app_context_menu.mute_member", "كتم الصوت"))
      }
      sliderEl.max = localStorage.getItem("vh-max-volume") || "200", sliderEl.value = displayVol, inputEl && (inputEl.max = "999999", inputEl.value = displayVol), displayEl.innerText = `${displayVol}%`
    }
  }
  if (s && s.classList.toggle("hidden", o), o) Y("ctx-member-add-friend")?.classList.add("hidden"), Y("ctx-member-remove-friend")?.classList.add("hidden"), Y("ctx-member-kick")?.classList.add("hidden"), Y("ctx-member-kick-server")?.classList.add("hidden"), Y("ctx-member-timeout-section")?.classList.add("hidden"), Y("ctx-member-move-section")?.classList.add("hidden"), Y("member-friend-separator")?.classList.add("hidden");
  else {
    const o = window.myFriendsUids && window.myFriendsUids.includes(t),
      r = Y("ctx-member-add-friend"),
      s = Y("ctx-member-remove-friend"),
      a = Y("ctx-member-kick"),
      c = Y("member-friend-separator");
    r && r.classList.toggle("hidden", o), s && s.classList.toggle("hidden", !o);
    const d = me("move_members"),
      l = me("kick_members") || se()?.ownerUid === V.myUid,
      m = me("moderate_members") || se()?.ownerUid === V.myUid;
    let u = !(!window.connections || !window.connections[t]);
    !u && V.voicePresenceMap && (u = Object.values(V.voicePresenceMap).some(e => e && e[t])), a && a.classList.toggle("hidden", !(d && u)), Y("ctx-member-kick-server")?.classList.toggle("hidden", !l), Y("ctx-member-timeout-section")?.classList.toggle("hidden", !m);
    const v = Y("ctx-member-move-section"),
      p = Y("ctx-move-channels-list");
    if (v && p) {
      const e = d && u;
      if (v.classList.toggle("hidden", !e), e) {
        p.innerHTML = "";
        let e = null;
        if (V.voicePresenceMap)
          for (const n in V.voicePresenceMap)
            if (V.voicePresenceMap[n][t]) {
              e = n;
              break
            } V.channels.filter(e => "voice" === e.type).forEach(n => {
          const o = document.createElement("div");
          o.className = "context-menu-item flex justify-between items-center", n.id === e && o.classList.add("opacity-50", "pointer-events-none"), o.innerHTML = `\n                        <span class="truncate">${n.name}</span>\n                        ${n.id===e?'<span class="text-[9px] bg-white/10 px-1 rounded">' + window.__fb("js.current_badge", "الحالية") + '</span>':""}\n                    `, o.onclick = e => {
            e.stopPropagation(), window.moveVoiceMember(t, n.id), i.classList.add("hidden")
          }, p.appendChild(o)
        })
      }
    }
    const h = Y("ctx-member-server-mute"),
      w = Y("member-server-mute-checkbox");
    if (h && w) {
      const e = me("mute_members");
      if (h.classList.toggle("hidden", !(e && u)), e && u) {
        let e = null;
        if (V.voicePresenceMap)
          for (const n in V.voicePresenceMap)
            if (V.voicePresenceMap[n][t]) {
              e = V.voicePresenceMap[n][t];
              break
            } const n = !!e?.forceMuted;
        w.classList.toggle("checked", n);
        const i = h.querySelector("span");
        i && (i.textContent = n ? window.__fb("js.srv_unmute", "إلغاء كتم من السيرفر") : window.__fb("app_context_menu.server_mute", "كتم من السيرفر"));
        const o = me("deafen_members"),
          r = Y("ctx-member-server-deafen"),
          s = Y("member-server-deafen-checkbox");
        if (r?.classList.toggle("hidden", !o), o && s) {
          const t = !!e?.forceDeafened;
          s.classList.toggle("checked", t);
          const n = r.querySelector("span");
          n && (n.textContent = t ? window.__fb("js.srv_undeafen", "إلغاء أصم من السيرفر") : window.__fb("app_context_menu.server_deafen", "أصم من السيرفر"))
        }
      }
    }
    const f = Y("ctx-member-roles-section"),
      g = Y("ctx-roles-list");
    if (f && g) {
      const i = me("manage_roles") || se()?.ownerUid === V.myUid;
      g.innerHTML = "";
      const o = (V.serverMembersData[t] || {
          roles: []
        }).roles || [],
        r = Fe(V.activeServerId);
      r && r.length > 0 ? r.forEach(r => {
        const s = o.includes(r.id),
          a = document.createElement("div");
        a.className = "context-menu-item flex justify-between items-center", i || a.classList.add("pointer-events-none"), a.innerHTML = `\n                        <div class="flex items-center gap-2 overflow-hidden">\n                            <div class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${r.color||"#99aab5"}"></div>\n                            <span class="truncate">${r.name}</span>\n                        </div>\n                        ${s?'<svg class="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>':""}\n                    `, a.onclick = async o => {
          o.stopPropagation(), i && (await window.toggleMemberRole(t, r.id), window.showMemberContextMenu(e, t, n))
        }, g.appendChild(a)
      }) : g.innerHTML = '<div class="text-[10px] text-gray-500 text-center p-2">' + window.__fb("js.no_ranks", "لا توجد رتب") + '</div>'
    }
    if (c) {
      const e = !o || d && u;
      c.classList.toggle("hidden", !e)
    }
  }
  "function" == typeof window.positionContextMenu ? window.positionContextMenu(i, e, !0) : (i.style.left = e.clientX + "px", i.style.top = e.clientY + "px"), i.classList.remove("hidden");
  const a = Y("server-context-menu");
  a && a.classList.add("hidden")
}, window.handleMemberAction = function(t) {
  const i = V.lastContextMemberUid,
    o = V.lastContextEvent,
    r = Y("member-context-menu");
  if (r && r.classList.add("hidden"), i) switch (t) {
    case "profile":
      "function" == typeof window.openMemberProfile && window.openMemberProfile(o, i);
      break;
    case "message":
      "function" == typeof window.switchToHome && window.switchToHome(), "function" == typeof window.openDirectMessage ? window.openDirectMessage(i, V.lastContextMemberName || window.__fb("app_chat.default_sender", "مستخدم")) : "function" == typeof window.openDmWithUid ? window.openDmWithUid(i) : alert("Direct messages module not fully integrated.");
      break;
    case "mute": {
      const e = Y("member-mute-checkbox"),
        t = Y("member-mute-text");
      e && e.classList.toggle("checked");
      let n = null;
      if (V.activeChannelPresenceMap && V.activeChannelPresenceMap[i]) n = V.activeChannelPresenceMap[i].peerId;
      else if (V.voicePresenceMap)
        for (const e in V.voicePresenceMap)
          if (V.voicePresenceMap[e][i]) {
            n = V.voicePresenceMap[e][i].peerId;
            break
          } const o = n ? document.getElementById("audio-" + n) : null;
      if (o) {
        o.muted = !o.muted, o.muted ? window.locallyMutedUids.add(i) : window.locallyMutedUids.delete(i), t && (t.textContent = o.muted ? window.__fb("js.unmute_sound", "إلغاء كتم الصوت") : window.__fb("app_context_menu.mute_member", "كتم الصوت"));
        const e = o.muted ? window.__fb("js.did_mute", "تم كتم") : window.__fb("js.did_unmute", "تم تفعيل"),
          n = V.lastContextMemberName || i;
        window.addSystemMsg && window.addSystemMsg(window.__f("js.mute_local", {a: e, b: n}, `${e} صوت ${n} محلياً`)), window.refreshVoiceChannelMembers()
      } else alert(window.__fb("js.no_stream", "لم يتم العثور على تدفق صوتي لهذا العضو محلياً."));
      break
    }
    case "serverMute": {
      if (!me("mute_members")) {
        alert(window.__fb("js.no_mute_perm", "لا تملك صلاحية كتم الأعضاء في هذا السيرفر."));
        break
      }
      const t = V.activeServerId,
        o = !!(V.serverMembersData[i] || {}).serverMuted,
        r = o ? "unmute" : "mute",
        s = l(e, "servers", t, "members", i);
      w(s, {
        serverMuted: !o,
        updatedAt: b()
      }, {
        merge: !0
      }).then(() => {
        if (window.addSystemMsg) {
          const e = "mute" === r ? window.__fb("js.act_mute", "كتم") : window.__fb("js.act_unmute", "فتح كتم");
          window.addSystemMsg(window.__f("js.admin_muted_perm", {a: e, name: V.lastContextMemberName||i}, `تم ${e} ${V.lastContextMemberName||i} من قبل المدير (دائم).`))
        }
      }).catch(e => {});
      let a = null;
      if (V.voicePresenceMap)
        for (const e in V.voicePresenceMap)
          if (V.voicePresenceMap[e][i]) {
            a = e;
            break
          } if (a) {
        const e = U(n, `voice_commands/${t}/${a}/${i}`);
        P(e, {
          type: "remote-cmd",
          action: r,
          from: V.myUid,
          timestamp: Date.now()
        }).then(() => {
          setTimeout(() => A(e).catch(() => {}), 5e3)
        })
      }
      break
    }
    case "serverDeafen": {
      if (!i) break;
      if (!me("deafen_members")) {
        alert(window.__fb("js.no_deafen_perm", "لا تملك صلاحية أصم الأعضاء."));
        break
      }
      const t = V.activeServerId,
        o = !!(V.serverMembersData[i] || {}).serverDeafened,
        r = o ? "undeafen" : "deafen",
        s = l(e, "servers", t, "members", i);
      w(s, {
        serverDeafened: !o,
        updatedAt: b()
      }, {
        merge: !0
      }).then(() => {
        if (window.addSystemMsg) {
          const e = "deafen" === r ? window.__fb("js.deafen", "أصم") : window.__fb("js.undeafen", "إلغاء أصم");
          window.addSystemMsg(window.__f("js.admin_muted_perm", {a: e, name: V.lastContextMemberName||i}, `تم ${e} ${V.lastContextMemberName||i} من قبل المدير (دائم).`))
        }
      }).catch(e => {});
      let a = null;
      if (V.voicePresenceMap)
        for (const e in V.voicePresenceMap)
          if (V.voicePresenceMap[e][i]) {
            a = e;
            break
          } if (a) {
        const e = U(n, `voice_commands/${t}/${a}/${i}`);
        P(e, {
          type: "remote-cmd",
          action: r,
          from: V.myUid,
          timestamp: Date.now()
        }).then(() => {
          setTimeout(() => A(e).catch(() => {}), 5e3)
        })
      }
      break
    }
    case "addFriend":
      "function" == typeof window.sendFriendRequestFromCtx ? window.sendFriendRequestFromCtx(i) : alert(window.__fb("js.friends_na", "ميزة إضافة الأصدقاء غير متوفرة حالياً."));
      break;
    case "removeFriend":
      "function" == typeof window.removeFriend ? window.removeFriend(i) : alert(window.__fb("js.unfriend_na", "ميزة إزالة الأصدقاء غير متوفرة حالياً."));
      break;
    case "kick":
      "function" == typeof window.kickRoomMember ? window.kickRoomMember(i) : "function" == typeof window.kickPeer ? (window.currentCtxPeerId = i, window.kickPeer()) : alert(window.__fb("js.kick_na", "ميزة الطرد غير متوفرة حالياً."));
      break;
    case "kickFromServer": {
      if (!me("kick_members") && se()?.ownerUid !== V.myUid) {
        alert(window.__fb("js.no_kick_perm", "لا تملك صلاحيات كافية لطرد الأعضاء."));
        break
      }
      const t = V.activeServerId,
        o = l(e, "servers", t, "members", i),
        r = l(e, "servers", t),
        s = [C(o), f(r, {
          memberUids: S(i)
        })];
      Promise.all(s).then(async () => {
        if (window.addSystemMsg && window.addSystemMsg(window.__f("js.kicked_srv", {name: V.lastContextMemberName||i}, `تم طرد ${V.lastContextMemberName||i} من السيرفر.`)), n) {
          const e = U(n, `voice_commands/${t}/global/${i}`);
          P(e, {
            type: "remote-cmd",
            action: "kick",
            from: V.myUid,
            timestamp: Date.now()
          }).then(() => {
            setTimeout(() => A(e).catch(() => {}), 5e3)
          }).catch(() => {});
          try {
            const e = await R(U(n, `voice_presence/${t}`));
            if (e.exists()) {
              const o = e.val(),
                r = [];
              for (const e in o) o[e][i] && r.push(A(U(n, `voice_presence/${t}/${e}/${i}`)));
              r.length > 0 && await Promise.all(r)
            }
          } catch (e) {}
        }
      }).catch(e => {
        alert(window.__fb("js.kick_fail", "حدث خطأ أثناء طرد العضو."))
      });
      break
    }
    case "timeout_60":
    case "timeout_300":
    case "timeout_3600":
    case "timeout_86400":
    case "timeout_remove": {
      if (!me("moderate_members") && se()?.ownerUid !== V.myUid) {
        alert(window.__fb("js.no_timeout_perm", "لا تملك صلاحيات كافية لتقييد الأعضاء."));
        break
      }
      const n = "timeout_remove" === t ? 0 : parseInt(t.split("_")[1]),
        o = 0 === n ? null : Date.now() + 1e3 * n,
        r = l(e, "servers", V.activeServerId, "members", i);
      f(r, {
        timeoutUntil: o
      }).then(() => {
        if (window.addSystemMsg)
          if (0 === n) window.addSystemMsg(window.__f("js.untimeout_done", {name: V.lastContextMemberName||i}, `تم إزالة التقييد عن ${V.lastContextMemberName||i}`));
          else {
            const e = n < 3600 ? window.__f("js.unit_min", {n: n / 60}, n / 60 + " دقيقة") : n < 86400 ? window.__f("js.unit_hr", {n: n / 3600}, n / 3600 + " ساعة") : window.__fb("js.unit_day", "يوم كامل");
            window.addSystemMsg(window.__f("js.timeout_done", {name: V.lastContextMemberName||i, dur: e}, `تم إسكات ${V.lastContextMemberName||i} لمدة ${e}`))
          }
      }).catch(e => {
        alert(window.__fb("js.update_fail", "حدث خطأ أثناء التحديث."))
      });
      break
    }
    case "muteSoundboard": {
      const e = Y("member-soundboard-checkbox");
      e && e.classList.toggle("checked");
      break
    }
    case "disableVideo": {
      const e = Y("member-video-checkbox");
      e && e.classList.toggle("checked");
      break
    }
    case "mention":
      break;
    default:
      alert(`Action: ${t} for user: ${i}`)
  }
}, document.addEventListener("DOMContentLoaded", () => {
  const e = Y("member-volume-slider"),
    t = Y("member-volume-display"),
    n = Y("member-volume-input");
  e && e.addEventListener("input", e => {
    const n = e.target.value;
    t && (t.innerText = `${n}%`);
    const input = Y("member-volume-input");
    input && (input.value = n);
    const i = V.lastContextMemberUid;
    if (i) {
      let e = null;
      if (V.activeChannelPresenceMap && V.activeChannelPresenceMap[i]) e = V.activeChannelPresenceMap[i].peerId;
      else if (V.voicePresenceMap)
        for (const t in V.voicePresenceMap)
          if (V.voicePresenceMap[t][i]) {
            e = V.voicePresenceMap[t][i].peerId;
            break
          } e && window.adjustPeerVolume && window.adjustPeerVolume(e, n / 100)
    }
  }), n && n.addEventListener("input", e => {
    const value = Math.max(0, Math.min(999999, Number(e.target.value) || 0));
    n.value = value;
    t && (t.innerText = `${value}%`);
    if (Y("member-volume-slider")) Y("member-volume-slider").value = value;
    const memberUid = V.lastContextMemberUid;
    if (!memberUid) return;
    let peerId = null;
    if (V.activeChannelPresenceMap && V.activeChannelPresenceMap[memberUid]) peerId = V.activeChannelPresenceMap[memberUid].peerId;
    else if (V.voicePresenceMap)
      for (const serverId in V.voicePresenceMap)
        if (V.voicePresenceMap[serverId][memberUid]) {
          peerId = V.voicePresenceMap[serverId][memberUid].peerId;
          break
        }
    peerId && window.adjustPeerVolume && window.adjustPeerVolume(peerId, value / 100)
  })
}), window.refreshVoiceChannelMembers = function() {
  fe(), ie()
};
import {
  initMentions as it
} from "./mentions.js?v=20260928-3";
document.addEventListener("DOMContentLoaded", () => {
  ! function() {
    const t = Y("server-rail-list");
    if (t) {
      const n = () => {
        t.querySelectorAll(".rail-server-btn").forEach(e => {
          e.classList.remove("drag-over-top", "drag-over-bottom", "bg-white/10")
        })
      };
      t.addEventListener("dragover", e => {
        if (e.preventDefault(), !V.cachedServerRects || 0 === V.cachedServerRects.length) return;
        let t = null,
          n = 1 / 0;
        if (V.cachedServerRects.forEach(i => {
            const o = document.getElementById(i.id);
            if (!o) return;
            const r = i.rect,
              s = Math.abs(e.clientY - (r.top + r.height / 2));
            s < n && (n = s, t = o, t.rect = r), o.classList.remove("drag-over-top", "drag-over-bottom", "bg-white/10")
          }), t) {
          const n = e.clientY < t.rect.top + t.rect.height / 2;
          t.classList.add(n ? "drag-over-top" : "drag-over-bottom")
        }
      }), t.addEventListener("dragleave", e => {
        t.contains(e.relatedTarget) || n()
      }), t.addEventListener("drop", t => {
        t.preventDefault();
        const i = t.dataTransfer.getData("text/plain");
        if (!V.cachedServerRects || 0 === V.cachedServerRects.length) return;
        let o = null,
          r = 1 / 0;
        if (V.cachedServerRects.forEach(e => {
            const n = e.rect,
              i = Math.abs(t.clientY - (n.top + n.height / 2));
            i < r && (r = i, o = {
              id: e.id,
              rect: n
            })
          }), n(), V.cachedServerRects = [], i && o) {
          const n = o.id.replace("rail-server-", ""),
            r = t.clientY < o.rect.top + o.rect.height / 2;
          i !== n && function(t, n, i = !1) {
            const o = V.servers.findIndex(e => e.id === t);
            let r = V.servers.findIndex(e => e.id === n);
            if (-1 === o || -1 === r) return;
            const [s] = V.servers.splice(o, 1);
            r = V.servers.findIndex(e => e.id === n);
            let a = i ? r : r + 1;
            V.servers.splice(a, 0, s), pe(), async function() {
              if (!V.myUid) return;
              const t = V.servers.map(e => e.id);
              V.myProfile && (V.myProfile.serverOrder = t);
              try {
                await f(l(e, "users", V.myUid), {
                  serverOrder: t
                })
              } catch (e) {}
            }()
          }(i, n, r)
        }
      })
    }
    const n = Y("add-server-channel-btn");
    n && n.addEventListener("click", () => {
      V.activeServerId && window.openCreateChannelPopup()
    });
    const i = Y("server-chat-send-btn"),
      o = Y("server-chat-input");
    i && i.addEventListener("click", $e), o && o.addEventListener("keydown", e => {
      "Enter" !== e.key || e.shiftKey || (e.preventDefault(), e.stopImmediatePropagation(), i ? i.click() : $e())
    })
  }(),
  function() {
    const e = Y("create-popup"),
      t = Y("nav-create-btn");
    if (t && (t.title = window.__fb("app_server.create_join_server", "إنشاء / انضمام سيرفر")), !e) return;
    const n = e.querySelectorAll("button");
    if (n[0]) {
      const e = n[0].querySelectorAll("p");
      e[0] && (e[0].textContent = window.__fb("app_server.create_server", "إنشاء سيرفر")), e[1] && (e[1].textContent = window.__fb("app_server.create_server_desc", "أنشئ مجتمعك بمعرف ثابت"))
    }
    if (n[1]) {
      const e = n[1].querySelectorAll("p");
      e[0] && (e[0].textContent = window.__fb("app_server.join_server", "انضمام لسيرفر")), e[1] && (e[1].textContent = window.__fb("app_server.join_server_desc", "أدخل معرف السيرفر"))
    }
  }(), ve(), he(),
    function() {
      const e = document.querySelector(".server-channels-header"),
        t = Y("server-channels-list"),
        n = Y("server-context-menu");
      e && n && (e.addEventListener("contextmenu", nt), t && t.addEventListener("contextmenu", e => {
        (e.target === t || null === e.target.closest(".server-channel-category-wrap") && null === e.target.closest(".server-channel-item")) && nt(e)
      }), document.addEventListener("click", e => {
        n.contains(e.target) || (n.classList.add("hidden"), delete n.dataset.serverId)
      }), document.addEventListener("contextmenu", i => {
        i.defaultPrevented || e.contains(i.target) || t && t.contains(i.target) || n.contains(i.target) || (n.classList.add("hidden"), delete n.dataset.serverId)
      }))
    }(),
    function() {
      const e = Y("member-context-menu");
      e && (document.addEventListener("click", t => {
        e.contains(t.target) || e.classList.add("hidden")
      }), document.addEventListener("contextmenu", t => {
        t.target.closest(".member-item") || t.target.closest(".participant-card") || t.target.closest(".server-voice-member-item") || e.contains(t.target) || e.classList.add("hidden")
      }))
    }(),

    document.addEventListener("contextmenu", e => {
      const item = e.target.closest(".server-voice-member-item, .participant-card");
      if (!item) return;
      const menu = Y("member-context-menu");
      if (!menu) { window.foxyLog("warn", "[Foxy][member-menu] menu element not found"); return; }
      if (!menu.classList.contains("hidden") && menu.contains(e.target)) return;
      const uid = item.getAttribute("data-uid") || item.dataset.uid;
      window.foxyLog("info", "[Foxy][member-menu] delegated contextmenu", {uid, myUid: V.myUid, hasMenu: !!menu, itemId: item.id});
      if (!uid) { window.foxyLog("warn", "[Foxy][member-menu] no uid on item", item); return; }
      if (uid === V.myUid) { window.foxyLog("info", "[Foxy][member-menu] skip own uid"); return; }
      e.preventDefault();
      e.stopPropagation();
      const nameEl = item.querySelector(".server-voice-name, .participant-name");
      const name = nameEl ? nameEl.textContent.trim() : (item.getAttribute("data-name") || uid);
      window.foxyLog("info", "[Foxy][member-menu] calling showMemberContextMenu", {uid, name, x: e.clientX, y: e.clientY});
      window.showMemberContextMenu(e, uid, name);
    }),
    function() {
      const e = Y("channel-context-menu");
      e && (document.addEventListener("click", t => {
        e.contains(t.target) || e.classList.add("hidden")
      }), document.addEventListener("contextmenu", t => {
        t.target.closest(".server-channel-item") || e.contains(t.target) || e.classList.add("hidden")
      }))
    }(), it()
}), document.addEventListener("UserProfileUpdated", e => {
  const t = e.detail || null;
  t && (V.myProfile || (V.myProfile = {}), t.photoURL && (V.myProfile.photoURL = t.photoURL), t.displayName && (V.myProfile.displayName = t.displayName)), V.activeVoiceChannelId && (Ee(), fe())
}), document.addEventListener("UserProfileLoaded", e => {
  const n = e.detail || null;
  V.myProfile = n, V.myUid = n?.uid || t.currentUser?.uid || null, V.myUid && Ne()
});
import {
  onAuthStateChanged as ot
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
(async () => { await whenReady(); ot(t, e => {
  e ? (V.myUid = e.uid, window.currentUserProfile && (V.myProfile = window.currentUserProfile), Ne()) : (V.myUid = null, V.myProfile = null)
}); })(), window.currentUserProfile?.uid && (V.myProfile = window.currentUserProfile, V.myUid = window.currentUserProfile.uid, Ne());
function _hardLeave() {
  if (V.activeVoiceServerId && V.activeVoiceChannelId && V.myUid && n) {
    A(U(n, `/voice_presence/${V.activeVoiceServerId}/${V.activeVoiceChannelId}/${V.myUid}`)).catch(() => {});
    A(U(n, `/server_activity/${V.activeVoiceServerId}/${V.myUid}`)).catch(() => {});
  }
}
window.addEventListener("pagehide", _hardLeave);
window.addEventListener("beforeunload", _hardLeave);
window.releaseVoiceSession = Ue, window.isVoiceSessionActive = function() {
  return V.activeVoiceStartedAtMs > 0 || !!V.activeVoiceChannelId
}, window.moveVoiceMember = function(e, i) {
  if (!e || !i || !t.currentUser) return;
  const o = e === V.myUid,
    r = me("move_members");
  if (!o && !r) return void("function" == typeof window.addSystemMsg && window.addSystemMsg(window.__fb("js.no_move_perm", "لا تملك صلاحية نقل الأعضاء"), "error"));
  if (o) {
    const e = V.channels.find(e => e.id === i);
    return void(e && ("function" == typeof window.leaveVoiceChannel ? window.leaveVoiceChannel(!0).then(() => {
      Ae(e)
    }) : Ae(e)))
  }
  let s = null;
  if (V.voicePresenceMap)
    for (const [t, n] of Object.entries(V.voicePresenceMap))
      if (n && n[e]) {
        s = t;
        break
      } if (s && s !== i && n && V.activeServerId) {
    const o = U(n, `voice_commands/${V.activeServerId}/${s}/${e}`);
    P(o, {
      type: "remote-cmd",
      action: "move",
      targetChannelId: i,
      from: t.currentUser.uid,
      timestamp: Date.now()
    }).then(() => {
      setTimeout(() => {
        A(o).catch(() => {})
      }, 5e3)
    })
  }
}, window.kickRoomMember = function(e) {
  if (!e || !t.currentUser) return;
  let i = null,
    o = window.__fb("js.the_user", "المستخدم"),
    r = null;
  if (V.voicePresenceMap)
    for (const [t, n] of Object.entries(V.voicePresenceMap))
      if (n && n[e]) {
        i = t, o = n[e].name || o, r = n[e].peerId;
        break
      } if (r && window.connections && window.connections[r] && "function" == typeof window.sendSignalingCmd && window.sendSignalingCmd(r, {
      type: "remote-cmd",
      action: "kick"
    }), n && V.activeServerId && i) {
    const o = U(n, `voice_commands/${V.activeServerId}/${i}/${e}`);
    P(o, {
      type: "remote-cmd",
      action: "kick",
      from: t.currentUser.uid,
      timestamp: Date.now()
    }).then(() => {
      setTimeout(() => {
        A(o).catch(() => {})
      }, 5e3)
    })
  }
}, window.toggleServerSettingsSidebar = function() {
  const e = Y("ss-sidebar"),
    t = Y("ss-sidebar-overlay");
  e && t && (e.classList.contains("translate-x-full") ? (e.classList.remove("translate-x-full"), e.classList.add("translate-x-0"), t.classList.remove("hidden"), setTimeout(() => t.classList.remove("opacity-0"), 10)) : (e.classList.remove("translate-x-0"), e.classList.add("translate-x-full"), t.classList.add("opacity-0"), setTimeout(() => t.classList.add("hidden"), 300)))
}, window.deleteServerMessage = async function(t) {
  if (V.activeServerId && V.activeChannelId) try {
    const n = l(e, "servers", V.activeServerId, "channels", V.activeChannelId, "messages", t);
    await C(n);
    const i = l(e, "servers", V.activeServerId, "channels", V.activeChannelId),
      o = l(e, "servers", V.activeServerId);
    await Promise.all([f(i, {
      messageCount: L(-1)
    }), f(o, {
      [`channelMessageCounts.${V.activeChannelId}`]: L(-1),
      totalMessageCount: L(-1),
      updatedAt: b()
    })])
  } catch (e) {
    alert(window.__fb("js.msg_del_fail", "فشل حذف الرسالة"))
  }
}, window.toggleRoleEditorSidebar = function() {
  const e = Y("re-sidebar"),
    t = Y("re-sidebar-overlay");
  e && t && (e.classList.contains("translate-x-full") ? (e.classList.remove("translate-x-full"), e.classList.add("translate-x-0"), t.classList.remove("hidden"), setTimeout(() => t.classList.remove("opacity-0"), 10)) : (e.classList.remove("translate-x-0"), e.classList.add("translate-x-full"), t.classList.add("opacity-0"), setTimeout(() => t.classList.add("hidden"), 300)))
}, window.updateServerMessage = async function(t, n) {
  if (V.activeServerId && V.activeChannelId) try {
    const i = l(e, "servers", V.activeServerId, "channels", V.activeChannelId, "messages", t);
    await f(i, {
      text: n,
      edited: !0,
      editedAt: b()
    })
  } catch (e) {
    throw e
  }
}, window.renderMainRoomParticipants = be, window.stopServerActivityListener = function() {
  V.serverActivityUnsub && (V.serverActivityUnsub(), V.serverActivityUnsub = null)
}, window.joinVoiceChannel = Ae;

let _typingRef = null, _typingUnsub = null, _typingTimer = null, _typingWriteTimer = null;
window.initServerTyping = function() {
  const input = document.getElementById('server-chat-input');
  if (!input) return;
  input.addEventListener('input', () => {
    if (!V.activeServerId || !V.activeChannelId || !V.myUid) return;
    const typRef = U(n, `typing/server_${V.activeServerId}_${V.activeChannelId}/${V.myUid}`);

    clearTimeout(_typingWriteTimer);
    _typingWriteTimer = setTimeout(() => {
      try {
        P(typRef, { name: V.myProfile?.displayName || window.__fb('app_chat.default_sender', 'مستخدم'), ts: Date.now() });
      } catch (e) {}
      clearTimeout(_typingTimer);
      _typingTimer = setTimeout(() => { try { A(typRef); } catch (e) {} }, 3000);
    }, 400);
  });
};
window.listenServerTyping = function(serverId, channelId, myUid) {
  if (_typingUnsub) { _typingUnsub(); _typingUnsub = null; }
  if (!serverId || !channelId) return;
  const typPath = U(n, `typing/server_${serverId}_${channelId}`);
  _typingUnsub = I(typPath, snap => {
    const val = snap.val() || {};
    const now = Date.now();
    const typers = Object.entries(val)
      .filter(([uid, d]) => uid !== myUid && d.ts && (now - d.ts) < 4000)
      .map(([_, d]) => d.name);
    const el = document.getElementById('server-typing-indicator');
    if (!el) return;
    if (typers.length === 0) { el.innerHTML = ''; el.classList.add('hidden'); return; }
    const text = typers.length === 1
      ? window.__f("js.typing", {name: typers[0]}, `<strong>${typers[0]}</strong> يكتب...`)
      : typers.length === 2
      ? window.__f("js.typing2", {a: typers[0], b: typers[1]}, `<strong>${typers[0]}</strong> و<strong>${typers[1]}</strong> يكتبان...`)
      : window.__f("js.typingN", {a: typers[0], n: typers.length - 1}, `<strong>${typers[0]}</strong> و${typers.length - 1} آخرون يكتبون...`);
    el.innerHTML = `<span class="typing-dots"><span></span><span></span><span></span></span>${text}`;
    el.classList.remove('hidden');
  });
};
window.clearServerTyping = function() {
  if (!V.myUid || !V.activeServerId || !V.activeChannelId) return;
  try { A(U(n, `typing/server_${V.activeServerId}_${V.activeChannelId}/${V.myUid}`)); } catch(e){}
};

const _origSendServer = window.sendServerMessage || (() => {});
window._serverTypingInitDone = false;
document.addEventListener('DOMContentLoaded', () => {
  if (window._serverTypingInitDone) return;
  window._serverTypingInitDone = true;
  setTimeout(() => { window.initServerTyping && window.initServerTyping(); }, 1500);
});

window.pinServerMessage = async function(messageId) {
  if (!V.activeServerId || !V.activeChannelId) return;
  if (!me('administrator') && !me('manage_messages')) return alert(window.__fb('js.no_pin_perm', 'لا تملك صلاحية تثبيت الرسائل.'));
  const msgRef = l(e, 'servers', V.activeServerId, 'channels', V.activeChannelId, 'messages', messageId);
  const channelRef = l(e, 'servers', V.activeServerId, 'channels', V.activeChannelId);
  try {
    const msgSnap = await p(msgRef);
    if (!msgSnap.exists()) return;
    const msgData = msgSnap.data();
    const pinData = { ...msgData, messageId, pinnedAt: b(), pinnedBy: V.myUid, isPinned: true };
    const pinnedRef = l(e, 'servers', V.activeServerId, 'channels', V.activeChannelId, 'pinned', messageId);
    try {
      await w(pinnedRef, pinData);
    } catch (subCollectionError) {

      await f(msgRef, { isPinned: true, pinnedAt: pinData.pinnedAt, pinnedBy: V.myUid });
    }
    await f(channelRef, { pinnedCount: L(1) });
    window.addSystemMsg && window.addSystemMsg(window.__fb('js.pin_ok', '📌 تم تثبيت الرسالة بنجاح.'), 'success');
  } catch(err) { alert(window.__fb('js.pin_fail', 'فشل تثبيت الرسالة.')); }
};
window.unpinServerMessage = async function(messageId) {
  if (!V.activeServerId || !V.activeChannelId) return;
  try {
    const pinnedRef = l(e, 'servers', V.activeServerId, 'channels', V.activeChannelId, 'pinned', messageId);
    const channelRef = l(e, 'servers', V.activeServerId, 'channels', V.activeChannelId);
    const msgRef = l(e, 'servers', V.activeServerId, 'channels', V.activeChannelId, 'messages', messageId);
    const { deleteDoc: delDoc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    try { await delDoc(pinnedRef); } catch (subCollectionError) {}
    try { await f(msgRef, { isPinned: false }); } catch (messageError) {}
    await f(channelRef, { pinnedCount: L(-1) });
    window.addSystemMsg && window.addSystemMsg(window.__fb('js.unpin_ok', 'تم إلغاء تثبيت الرسالة.'), 'info');
    window.showPinnedMessages && window.showPinnedMessages();
  } catch(err) { alert(window.__fb('js.unpin_fail', 'فشل إلغاء التثبيت.')); }
};
window.jumpToServerMessage = function(messageId) {
  const modal = document.getElementById('pinned-messages-modal');
  const messages = document.getElementById('server-chat-messages');
  modal?.classList.add('hidden');
  if (!messageId || !messages) return;
  const selector = `[data-message-id="${CSS.escape(String(messageId))}"]`;
  const message = messages.querySelector(selector);
  if (!message) {
    window.addSystemMsg && window.addSystemMsg(window.__fb('js.pin_missing', 'الرسالة المثبتة غير موجودة في الرسائل المحمّلة حاليًا.'), 'info');
    return;
  }
  const row = message.classList.contains('message-row') ? message : (message.closest('.message-row') || message);
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const oldBackground = row.style.backgroundColor;
  const oldShadow = row.style.boxShadow;
  row.style.backgroundColor = 'rgba(59, 130, 246, 0.18)';
  row.style.boxShadow = '0 0 0 1px rgba(96, 165, 250, 0.55)';
  setTimeout(() => {
    row.style.backgroundColor = oldBackground;
    row.style.boxShadow = oldShadow;
  }, 2200);
};
window.showPinnedMessages = async function() {
  if (!V.activeServerId || !V.activeChannelId) return;
  const modal = document.getElementById('pinned-messages-modal');
  const list = document.getElementById('pinned-messages-list');
  if (!modal || !list) return;
  list.innerHTML = '<div class="text-center text-gray-500 text-sm py-8">' + window.__fb('app_loading.loading_profile', 'جاري التحميل...') + '</div>';
  modal.classList.remove('hidden');
  try {
    const { collection: col, getDocs: gDocs, orderBy: oBy, query: q } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    const pinnedCol = col(e, 'servers', V.activeServerId, 'channels', V.activeChannelId, 'pinned');
    let pinnedDocs = [];
    try {
      const snap = await gDocs(q(pinnedCol, oBy('pinnedAt', 'desc')));
      pinnedDocs = snap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    } catch (subCollectionError) {}
    if (!pinnedDocs.length) {
      const messagesCol = col(e, 'servers', V.activeServerId, 'channels', V.activeChannelId, 'messages');
      const messagesSnap = await gDocs(messagesCol);
      pinnedDocs = messagesSnap.docs
        .map(doc => ({ id: doc.id, data: doc.data() }))
        .filter(item => item.data.isPinned)
        .sort((a, b) => (b.data.pinnedAt?.toMillis?.() || 0) - (a.data.pinnedAt?.toMillis?.() || 0));
    }
    const snap = { empty: !pinnedDocs.length };
    if (snap.empty) { list.innerHTML = '<div class="text-center text-gray-500 text-sm py-8">' + window.__fb("web.t282", "لا توجد رسائل مثبتة") + '</div>'; return; }
    list.innerHTML = pinnedDocs.map(item => {
      const d = item.data;
      const time = d.pinnedAt?.toDate ? d.pinnedAt.toDate().toLocaleDateString('ar-EG') : '';
      const txt = (d.text || '').substring(0, 200);
      return `<div class="pinned-msg-item group cursor-pointer" onclick="window.jumpToServerMessage('${item.id}')">
        <div class="flex items-start gap-3">
          <div class="pinned-msg-pin-icon">📌</div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-bold text-white mb-1">${d.senderName || window.__fb('app_chat.default_sender', 'مستخدم')} <span class="text-gray-500 font-normal ml-2">${time}</span></p>
            <p class="text-xs text-gray-300 whitespace-pre-wrap break-words line-clamp-3">${txt}</p>
          </div>
          <button class="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 p-1 text-xs" onclick="window.unpinServerMessage('${item.id}')">✕</button>
        </div>
      </div>`;
    }).join('');
  } catch(err) { list.innerHTML = '<div class="text-center text-red-400 text-sm py-8">' + window.__fb("js.pins_load_fail", "فشل تحميل الرسائل المثبتة.") + '</div>'; }
};

window.toggleReaction = async function(messageId, emoji, context) {
  const myUid = V.myUid || (await import('../firebase-config.js').then(m => m.auth.currentUser?.uid));
  if (!myUid) return;
  try {
    const { doc: docRef, updateDoc, getDoc: gd, arrayUnion: aU, arrayRemove: aR, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    let msgRef;
    if (context === 'server' && V.activeServerId && V.activeChannelId) {
      msgRef = docRef(e, 'servers', V.activeServerId, 'channels', V.activeChannelId, 'messages', messageId);
    } else if (context === 'dm' && window.currentChatDocId) {
      msgRef = docRef(e, 'direct_messages', window.currentChatDocId, 'messages', messageId);
    } else return;
    const snap = await gd(msgRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const reactions = data.reactions || {};
    const emojiReactions = reactions[emoji] || {};
    const fieldPath = `reactions.${emoji}.${myUid}`;
    if (emojiReactions[myUid]) {

      const { deleteField } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
      const update = Object.keys(emojiReactions).length <= 1
        ? { [`reactions.${emoji}`]: deleteField() }
        : { [fieldPath]: deleteField() };
      await updateDoc(msgRef, update);
    } else {
      await updateDoc(msgRef, { [fieldPath]: true });
    }
  } catch(err) { console.warn('Reaction error', err); }
};

window._emojiPickerTarget = null;
const QUICK_EMOJIS = ['👍','❤️','😂','😮','😢','😡','🎉','🔥','👏','✅','🤔','💯','😍','🙏','💀','😭'];
QUICK_EMOJIS.push('🫡', '🤣', '😎', '🥳', '🤯', '👀', '💔', '✨', '🚀', '🎯', '🤝', '🙌', '🫶', '😴', '🤡', '😈');
window.emoCatLabel = function(c) { var m = {'تعابير':'js.emo_exp','حركات':'js.emo_anim','أشياء':'js.emo_things','طبيعة':'js.emo_nature','طعام':'js.emo_food'}; return m[c] ? window.__fb(m[c], c) : c; };
const ALL_EMOJIS = {
  'تعابير': ['😀','😃','😄','😁','😆','🥹','😅','😂','🤣','🥲','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','🙁','😕','😟','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠'],
  'حركات': ['👍','👎','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👋','🤚','🖐️','✋','🖖','🤏','💪','🦾','🙏','🤲','👐','🤝','👏','🙌'],
  'أشياء': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☯️','🔥','💥','✨','⭐','🌟','💫','🎉','🎊','🎈','🎁','🏆','🥇','🏅'],
  'طبيعة': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊'],
  'طعام': ['🍕','🍔','🍟','🌭','🌮','🌯','🍰','🎂','🍩','🍪','🍫','🍬','🍭','☕','🧋','🥤','🍺','🍻'],
};
window.showEmojiPicker = function(event, messageId, context) {
  event.stopPropagation();
  let picker = document.getElementById('emoji-picker-popup');
  if (picker) { picker.remove(); return; }
  window._emojiPickerTarget = { messageId, context };
  picker = document.createElement('div');
  picker.id = 'emoji-picker-popup';
  picker.className = 'emoji-picker-popup';

  const quick = QUICK_EMOJIS.map(e =>
    `<button type="button" class="emoji-btn" data-reaction-emoji="${escapeForAttribute(e)}">${e}</button>`
  ).join('');

  const cats = Object.keys(ALL_EMOJIS);
  const tabsHTML = cats.map((c, i) => `<button type="button" class="emoji-cat-tab ${i===0?'active':''}" data-emoji-cat="${escapeForAttribute(c)}">${window.emoCatLabel(c)}</button>`).join('');
  const gridsHTML = cats.map((c, i) => `<div class="emoji-cat-grid ${i===0?'':'hidden'}" data-cat="${c}">${
    ALL_EMOJIS[c].map(em => `<button type="button" class="emoji-btn" data-reaction-emoji="${escapeForAttribute(em)}">${em}</button>`).join('')
  }</div>`).join('');
  picker.innerHTML = `
    <div class="emoji-picker-quick">${quick}</div>
    <div class="emoji-picker-divider"></div>
    <div class="emoji-cat-tabs">${tabsHTML}</div>
    <div class="emoji-picker-grid-container custom-scroll">${gridsHTML}</div>
  `;
  picker.addEventListener('click', (ev) => {
    const emojiButton = ev.target.closest('[data-reaction-emoji]');
    if (emojiButton) {
      window.toggleReaction(messageId, emojiButton.dataset.reactionEmoji, context);
      picker.remove();
      return;
    }
    const categoryButton = ev.target.closest('[data-emoji-cat]');
    if (categoryButton) window.switchEmojiCat(categoryButton, categoryButton.dataset.emojiCat);
  });

  document.body.appendChild(picker);
  const rect = event.target.getBoundingClientRect();
  const ph = picker.offsetHeight || 320;
  const pw = picker.offsetWidth || 300;
  let top = rect.top - ph - 8;
  let left = rect.left;
  if (top < 8) top = rect.bottom + 8;
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
  picker.style.top = top + 'px';
  picker.style.left = left + 'px';
  setTimeout(() => { document.addEventListener('click', function _close(ev) { if (!picker.contains(ev.target)) { picker.remove(); document.removeEventListener('click', _close); } }); }, 10);
};
window.switchEmojiCat = function(btn, cat) {
  const picker = btn.closest('.emoji-picker-popup') || document.getElementById('emoji-picker-popup');
  if (!picker) return;
  picker.querySelectorAll('.emoji-cat-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  picker.querySelectorAll('.emoji-cat-grid').forEach(g => {
    g.classList.toggle('hidden', g.dataset.cat !== cat);
  });
};

window.showInputEmojiPicker = function(targetInputId) {
  let picker = document.getElementById('input-emoji-picker-popup');
  if (picker) { picker.remove(); return; }
  picker = document.createElement('div');
  picker.id = 'input-emoji-picker-popup';
  picker.className = 'emoji-picker-popup input-emoji-picker';
  const cats = Object.keys(ALL_EMOJIS);
  const tabsHTML = cats.map((c, i) => `<button type="button" class="emoji-cat-tab ${i===0?'active':''}" data-emoji-cat="${escapeForAttribute(c)}">${window.emoCatLabel(c)}</button>`).join('');
  const gridsHTML = cats.map((c, i) => `<div class="emoji-cat-grid ${i===0?'':'hidden'}" data-cat="${c}">${
    ALL_EMOJIS[c].map(em => `<button type="button" class="emoji-btn" data-input-emoji="${escapeForAttribute(em)}">${em}</button>`).join('')
  }</div>`).join('');
  picker.innerHTML = `
    <div class="emoji-cat-tabs">${tabsHTML}</div>
    <div class="emoji-picker-grid-container custom-scroll">${gridsHTML}</div>
  `;
  picker.addEventListener('click', (ev) => {
    const categoryButton = ev.target.closest('[data-emoji-cat]');
    if (categoryButton) {
      window.switchEmojiCat(categoryButton, categoryButton.dataset.emojiCat);
      return;
    }
    const emojiButton = ev.target.closest('[data-input-emoji]');
    if (!emojiButton) return;
    const input = document.getElementById(targetInputId);
    if (input) {
      input.focus();
      document.execCommand('insertText', false, emojiButton.dataset.inputEmoji);
    }
    picker.remove();
  });
  document.body.appendChild(picker);
  const btn = document.querySelector(`[data-emoji-target="${targetInputId}"]`);
  if (btn) {
    const rect = btn.getBoundingClientRect();
    const ph = 280, pw = 320;
    let top = rect.top - ph - 8;
    let left = rect.left;
    if (top < 8) top = rect.bottom + 8;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    picker.style.top = top + 'px'; picker.style.left = left + 'px';
  }
  setTimeout(() => { document.addEventListener('click', function _close2(ev) { if (!picker.contains(ev.target) && !ev.target.closest('[data-emoji-btn]')) { picker.remove(); document.removeEventListener('click', _close2); } }); }, 10);
};
