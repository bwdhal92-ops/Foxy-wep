import {
  db as e,
  auth as t,
  rtdb as n,
  whenReady
} from "../firebase-config.js";
import {
  collection as i,
  addDoc as a,
  query as s,
  where as o,
  orderBy as d,
  onSnapshot as l,
  serverTimestamp as c,
  getDocs as r,
  doc as m,
  setDoc as u,
  updateDoc as updateMessageDoc,
  getDoc as w,
  increment as g,
  limit as p,
  limitToLast as h
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
  onAuthStateChanged as v
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  ref as y,
  set as f,
  get as x,
  update as I,
  remove as L,
  onDisconnect as C,
  onChildRemoved as D,
  onValue as b
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import {
  ChatBox as E,
  createMessageHTML as B
} from "./ui-chatcore.js?v=20260929-2";
import { escapeForAttribute, escapeForJsString } from "./sanitize.js";
import { createVoicePresence } from "./voice-presence-core.js?v=20260930-2";
import {
  createAvatarHTML as M
} from "./ui-avatar-banner.js?v=20260929-2";

function createDmActionBtn(title, action, ...args) {
  const escapedArgs = args.map(arg => escapeForAttribute(arg)).join("|");
  const icon = action === "handleMessageToolbarAction" && args.includes("forward")
    ? '<path d="M5 12h13"></path><path d="m13 6 6 6-6 6"></path>'
    : action === "handleMessageToolbarAction"
      ? '<path d="M19 12H5"></path><path d="m11 18-6-6 6-6"></path>'
      : '<circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"></circle><circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none"></circle>';
  return `<button type="button" class="message-action-btn" title="${escapeForAttribute(title)}" data-action="${escapeForAttribute(action)}" data-args="${escapeForAttribute(escapedArgs)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg></button>`;
}

function setupDmEventDelegation(container) {
  if (container._dmDelegationSetup) return;
  container._dmDelegationSetup = true;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.stopPropagation();

    const action = btn.dataset.action;
    const argsStr = btn.dataset.args || '';
    const args = argsStr ? argsStr.split('|') : [];

    switch (action) {
      case 'handleMessageToolbarAction': {
        if (typeof window.handleMessageToolbarAction === 'function' && args.length >= 3) {
          window.handleMessageToolbarAction(e, args[0], args[1], args[2]);
        }
        break;
      }
      case 'showMessageContextMenu': {
        if (typeof window.showMessageContextMenu === 'function' && args.length >= 3) {
          window.showMessageContextMenu(e, args[0], args[1], args[2]);
        }
        break;
      }
    }
  });

  container.addEventListener('click', (e) => {
    const replyEl = e.target.closest('.message-reply');
    if (!replyEl) return;
    const msgId = replyEl.dataset.msgId;
    if (msgId) {
      const target = document.querySelector(`[data-message-id='${CSS.escape(msgId)}']`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

let k = null,
  U = null;
window.currentChatDocId = null;
let S = 50,
  _ = !1;
window.openOneTimeImage = async function(messageId, attachmentIndex, context, url) {
  if (context === 'server') return window.openServerOneTimeImage?.(messageId, attachmentIndex, context, url);
  if (context !== 'dm' || !window.currentChatDocId || !messageId || !url) return;
  const uid = t.currentUser?.uid;
  if (!uid) return;
  try {
    const messageRef = m(e, 'direct_messages', window.currentChatDocId, 'messages', messageId);
    await updateMessageDoc(messageRef, { [`attachments.${attachmentIndex}.viewedBy.${uid}`]: { name: window.currentUserProfile?.displayName || window.__fb('app_chat.default_sender', 'مستخدم'), openedAt: Date.now() } });
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (_) { alert(window.__fb('js.img_open_fail', 'تعذر فتح الصورة.')); }
};
const N = new E("home-dm-messages", {
  context: "dm",
  infiniteScroll: !0,
  onLoadMore: e => {
    S = e, window.currentChatDocId && K(window.currentChatDocId, document.getElementById("home-dm-messages"))
  }
});
setupDmEventDelegation(N.container);
window.dmChat = N;
window.reloadDmMessages = function() {

  if (!window.currentChatDocId) return;
  try { U && U(); } catch (_) {}
  K(window.currentChatDocId, document.getElementById("home-dm-messages"))
};
let T = null,
  P = null,
  A = null,
  j = null,
  O = 0;
window.isDmCalling = !1, window.isCallInitiator = !1;
let R = null,
  q = null,
  F = null,
  H = null,
  dmPresenceKey = null,
  dmPresencePoll = null;
const DmVP = createVoicePresence({
  db: n,
  getPresencePath: (channelId, serverId) => {
    const key = dmPresenceKey;
    const me = t.currentUser?.uid;
    return key && me ? `/dm_call_presence/${key}/${me}` : null;
  },
  getActivityPath: () => null,
  getMyUid: () => t.currentUser?.uid,
  getMyProfile: () => window.currentUserProfile,
  getConnections: () => window.connections,
  getCalls: () => window.calls,
  getIsHost: () => window.isCallInitiator,
  getPresenceToken: () => window.dmPresenceToken,
  onPresenceChange: (filtered, type) => {
    if (type === "snapshot") {
      window.dmCallPresence = filtered;
      updateDmVoicePresenceUI();
      if (!String(window.currentOpenedDmUid || "").startsWith("group:")) return;
      try {
        const _states = Object.keys(filtered || {}).sort().map(uid => {
          const s = filtered[uid] || {};
          return `${uid}:${s.muted ? 1 : 0}:${s.deafened ? 1 : 0}:${s.screenActive ? 1 : 0}`;
        }).join("|");
        if (_states !== window._dmSidebarSig) {
          window._dmSidebarSig = _states;
          renderDmGroupMembersSidebar();
        }
      } catch (_) { try { renderDmGroupMembersSidebar(); } catch (_) {} }
      updateDmGroupSidebarStates();
    }
  },
  throttleMs: 45000,
  staleMs: 120000,
  signalLostMs: 120000,
  debugLabel: "dm-voice"
});
window.dmVoicePresenceCore = DmVP;

function dmDebug(event, details = {}) {
  window.foxyLog("info", "[Foxy][dm-debug] " + event, {
    ...details,
    currentUid: window.currentOpenedDmUid || null,
    chatDocId: window.currentChatDocId || null,
    groupCallId: window.activeDmGroupCallId || null,
    groupDocId: window.activeDmGroupDocId || null,
    groupMembers: (window.activeDmGroupMembers || []).map(member => member.uid),
    isDmCalling: !!window.isDmCalling,
    timestamp: new Date().toISOString()
  });
}

function deferDmCallWork(work) {
  requestAnimationFrame(() => setTimeout(work, 0));
}

function yieldDmCallPaint() {
  return new Promise(resolve => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });
}

function V(e, t) {
  return [e, t].sort().join("_")
}

function W() {
  const e = document.getElementById("home-inline-dm"),
    t = document.getElementById("home-dm-header-name"),
    n = document.getElementById("home-dm-messages"),
    i = document.getElementById("home-dm-input"),
    a = document.getElementById("home-dm-send-btn"),
    s = document.getElementById("dm-call-btn"),
    o = document.getElementById("home-friends-panels");
  if (e && t && n && i && a && o) return {
    mode: "inline",
    panel: e,
    homePanels: o,
    headerName: t,
    messagesContainer: n,
    dmInput: i,
    dmSendBtn: a,
    dmCallBtn: s
  };
  const d = document.getElementById("dm-modal"),
    l = document.getElementById("dm-header-name"),
    c = document.getElementById("dm-messages"),
    r = document.getElementById("dm-send-btn");
  return {
    mode: "modal",
    panel: d,
    homePanels: null,
    headerName: l,
    messagesContainer: c,
    dmInput: document.getElementById("dm-input"),
    dmSendBtn: r,
    dmCallBtn: null
  }
}

function z(e) {
  if (!e) return "16, 185, 129";
  let t = 0;
  for (let n = 0; n < e.length; n++) t = e.charCodeAt(n) + ((t << 5) - t);
  const n = Math.abs(t) % 360,
    i = .7 * (1 - Math.abs(1.1 - 1)),
    a = i * (1 - Math.abs(n / 60 % 2 - 1)),
    s = .55 - i / 2;
  let o, d, l;
  return n < 60 ? (o = i, d = a, l = 0) : n < 120 ? (o = a, d = i, l = 0) : n < 180 ? (o = 0, d = i, l = a) : n < 240 ? (o = 0, d = a, l = i) : n < 300 ? (o = a, d = 0, l = i) : (o = i, d = 0, l = a), `${Math.round(255*(o+s))}, ${Math.round(255*(d+s))}, ${Math.round(255*(l+s))}`
}
function renderDmVoiceParticipants() {
  const container = document.getElementById("dm-voice-avatars");
  if (!container) return;
  const members = Array.isArray(window.activeDmGroupMembers) && window.activeDmGroupMembers.length ? window.activeDmGroupMembers : [{ uid: window.activeCallFriendUid, displayName: window.currentOpenedDmName || window.__fb("js.friend", "صديق") }];
  const me = t.currentUser?.uid;
  const all = [{ uid: me, displayName: window.currentUserProfile?.displayName || window.__fb("web.t027", "أنا"), photoURL: window.currentUserProfile?.photoURL }, ...members.filter(member => member.uid && member.uid !== me)];
  let remoteAvatarAssigned = false;
  container.innerHTML = all.map(member => {
    const isMe = member.uid === me;
    const avatarId = isMe ? "dm-voice-my-avatar" : (!remoteAvatarAssigned ? (remoteAvatarAssigned = true, "dm-voice-friend-avatar") : "");
    const name = member.displayName || window.getFriendData?.(member.uid)?.displayName || window.__fb("app_chat.default_sender", "مستخدم");
    const photo = member.photoURL || window.getFriendData?.(member.uid)?.photoURL || "";

    const memberColor = (isMe ? window.currentUserProfile?.avatarColor || window.currentUserProfile?.bannerColor : window.state?.allUsers?.[member.uid]?.avatarColor || window.state?.allUsers?.[member.uid]?.bannerColor || window.getFriendData?.(member.uid)?.avatarColor || window.getFriendData?.(member.uid)?.bannerColor) || "";
    const src = getAvatarSrc(photo, name, 80, member.uid || name);
    const foxStyle = src === window.FOXY_AVATAR_MASK ? ` background-color:${escapeForAttribute(window.resolveProfileColor ? window.resolveProfileColor(member.uid || name, memberColor) : memberColor || "#5865f2")}; object-fit:contain;" class="${isMe ? "" : (window.dmCallStatus === "calling" ? "dm-ringing-pulse" : "")}"` : ` ${isMe ? "" : (window.dmCallStatus === "calling" ? "dm-ringing-pulse" : "")}"`;
    const state = window.dmCallPresence?.[member.uid] || {};
    const speaking = !!state.speaking;
    const muted = !!state.muted;
    const deafened = !!state.deafened;
    const screen = !!state.screenActive;
    return `<div class="dm-voice-avatar-item flex flex-col items-center gap-1 ${speaking ? "dm-member-speaking" : ""}" data-dm-member-uid="${escapeForAttribute(member.uid || "")}"><div class="relative dm-voice-avatar-wrap"><img ${avatarId ? `id="${avatarId}"` : ""} src="${escapeForAttribute(src)}" alt="${escapeForAttribute(name)}" width="40" height="40" loading="lazy" class="w-10 h-10 rounded-full border-2 border-slate-900 object-cover shadow-lg${foxStyle}><div class="dm-member-online-dot absolute -bottom-1 -right-1 w-3 h-3 ${isMe ? "bg-emerald-500" : "bg-gray-500"} rounded-full border-2 border-[#1e1f22]"></div><div class="dm-member-state-icons absolute -top-1 -left-1 flex items-center gap-0.5">${muted ? '<span class="dm-state-icon dm-state-muted" title="' + window.__fb('js.dm_mic_off', 'الميكروفون مغلق') + '">🎙️</span>' : ""}${deafened ? '<span class="dm-state-icon dm-state-deaf" title="' + window.__fb('js.dm_deaf', 'السماعة مغلقة') + '">🔇</span>' : ""}${screen ? '<span class="dm-state-icon dm-state-screen" title="' + window.__fb('js.dm_screen', 'مشاركة الشاشة نشطة') + '">▣</span>' : ""}</div></div><span class="dm-voice-name text-[10px] font-bold text-gray-300 whitespace-nowrap">${escapeForAttribute(isMe ? window.__fb("web.t027", "أنا") : name)}</span></div>`;
  }).join("");
  const add = document.getElementById("dm-group-add-btn");
  add && (members.length > 1 ? add.classList.remove("hidden") : add.classList.add("hidden"));
  if (String(window.currentOpenedDmUid || "").startsWith("group:")) renderDmGroupMembersSidebar();
}

function syncDmGroupActionButton() {
  const button = document.getElementById("dm-group-call-btn");
  if (!button) return;
  const inGroup = String(window.currentOpenedDmUid || "").startsWith("group:") && !!window.currentGroupDocId;
  const inCall = !!window.activeDmGroupCallId && !!window.isDmCalling;
  if (inGroup && !inCall) {
    button.title = window.__fb("js.pick_title_add_group", "إضافة أعضاء للمجموعة");
    button.setAttribute("aria-label", window.__fb("js.pick_title_add_group", "إضافة أعضاء للمجموعة"));
    button.classList.remove("text-gray-400", "hover:text-blue-400");
    button.classList.add("text-blue-400", "hover:text-blue-300");
    button.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12h6m-3-3v6M9 7a4 4 0 100 8 4 4 0 000-8zM2 21a7 7 0 0114 0"/></svg>';
  } else if (inGroup && inCall) {
    button.title = window.__fb("js.pick_title_add_people", "إضافة أشخاص للمكالمة");
    button.setAttribute("aria-label", window.__fb("js.pick_title_add_people", "إضافة أشخاص للمكالمة"));
    button.classList.remove("text-gray-400", "hover:text-blue-400");
    button.classList.add("text-emerald-400", "hover:text-emerald-300");
    button.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12h6m-3-3v6M9 7a4 4 0 100 8 4 4 0 000-8zM2 21a7 7 0 0114 0"/></svg>';
  } else {
    button.title = window.isDmCalling ? window.__fb("js.pick_title_add_people", "إضافة أشخاص للمكالمة") : window.__fb("js.pick_title_start", "إضافة أشخاص للمكالمة الجماعية");
    button.setAttribute("aria-label", button.title);
    button.classList.remove("text-blue-400", "hover:text-blue-300", "text-emerald-400", "hover:text-emerald-300");
    button.classList.add(window.isDmCalling ? "text-emerald-400" : "text-gray-400", window.isDmCalling ? "hover:text-emerald-300" : "hover:text-blue-400");
  }
}
function updateDmGroupSidebarStates() {

  const list = document.getElementById("dm-group-members-list");
  if (!list) return;
  const me = t.currentUser?.uid, _now = Date.now();
  list.querySelectorAll(".dm-group-member-row[data-uid]").forEach(row => {
    try {
      const uid = row.getAttribute("data-uid"), state = window.dmCallPresence?.[uid] || {};
      const dot = row.querySelector(".member-status-dot");
      if (dot) {
        const on = uid === me || (_now - (Number(state.timestamp) || 0) < 25000);
        dot.classList.toggle("status-online", on);
        dot.classList.toggle("status-offline", !on);
      }
      const sub = row.querySelector(".member-subtext");
      if (sub) {
        const txt = state.screenActive ? window.__fb("js.dm_sharing", "يشارك الشاشة") : state.muted ? window.__fb("js.dm_mic_off", "الميكروفون مغلق") : state.deafened ? window.__fb("js.dm_deaf", "السماعة مغلقة") : state.speaking ? window.__fb("js.dm_talking", "يتحدث الآن") : window.__fb("js.dm_incall", "في المكالمة");
        if (sub.textContent !== txt) sub.textContent = txt;
      }
    } catch (_) {}
  });
}
function updateDmVoicePresenceUI() {
  const _now = Date.now();
  document.querySelectorAll(".dm-voice-avatar-item[data-dm-member-uid]").forEach(item => {
    const uid = item.getAttribute("data-dm-member-uid"), state = window.dmCallPresence?.[uid] || {};

    const _fresh = uid === t.currentUser?.uid || (_now - (Number(state.timestamp) || 0) < 25000);
    item.classList.toggle("dm-member-speaking", !!state.speaking);
    item.querySelector(".dm-member-online-dot")?.classList.toggle("bg-emerald-500", _fresh);
    item.querySelector(".dm-member-online-dot")?.classList.toggle("bg-gray-500", !_fresh);
    const icons = item.querySelector(".dm-member-state-icons");
    if (icons) icons.innerHTML = `${state.muted ? '<span class="dm-state-icon dm-state-muted" title="' + window.__fb('js.dm_mic_off', 'الميكروفون مغلق') + '">🎙️</span>' : ""}${state.deafened ? '<span class="dm-state-icon dm-state-deaf" title="' + window.__fb('js.dm_deaf', 'السماعة مغلقة') + '">🔇</span>' : ""}${state.screenActive ? '<span class="dm-state-icon dm-state-screen" title="' + window.__fb('js.dm_screen', 'مشاركة الشاشة نشطة') + '">▣</span>' : ""}`;
  });
}
function ensureDmGroupMembersSidebar() {
  let sidebar = document.getElementById("dm-group-members-sidebar");
  if (sidebar) return sidebar;
  sidebar = document.createElement("aside");
  sidebar.id = "dm-group-members-sidebar";
  sidebar.className = "server-members-sidebar";
  sidebar.innerHTML = `<div class="glass rounded-2xl h-full flex flex-col overflow-hidden shadow-2xl border border-white/10 relative"><button type="button" class="absolute top-2 left-2 z-10 w-8 h-8 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-full text-gray-400 hover:text-white transition md:hidden" onclick="window.toggleDmGroupMembersSidebar()" aria-label="${window.__fb('app_voice.close_btn', 'إغلاق')}">×</button><div class="px-4 py-3 border-b border-white/5 bg-black/20"><p class="text-[11px] font-bold text-gray-300 uppercase tracking-widest">${window.__fb("js.grp_members", "أعضاء المجموعة")}</p><p id="dm-group-members-count" class="text-[10px] text-gray-500 mt-1"></p></div><div id="dm-group-members-list" class="flex-1 overflow-y-auto custom-scroll p-2 space-y-1 bg-black/10"></div></div>`;
  document.querySelector("#server-members-sidebar")?.parentElement?.appendChild(sidebar) || document.body.appendChild(sidebar);
  return sidebar;
}
function renderDmGroupMembersSidebar() {
  const sidebar = ensureDmGroupMembersSidebar(), list = sidebar.querySelector("#dm-group-members-list"), count = sidebar.querySelector("#dm-group-members-count");
  if (!list) return;
  const me = t.currentUser?.uid;
  const members = [{ uid: me, displayName: window.currentUserProfile?.displayName || window.__fb("web.t027", "أنا"), photoURL: window.currentUserProfile?.photoURL || "" }, ...(window.activeDmGroupMembers || [])].filter((member, index, all) => member?.uid && all.findIndex(item => item.uid === member.uid) === index);
  if (count) count.textContent = window.__f("js.participants", {n: members.length}, `${members.length} مشاركين`);
  list.innerHTML = members.map(member => {
    const state = window.dmCallPresence?.[member.uid] || {}, name = member.uid === me ? window.__fb("web.t027", "أنا") : member.displayName || window.__fb("app_chat.default_sender", "مستخدم");
    return `<div class="member-item dm-group-member-row" data-uid="${escapeForAttribute(member.uid)}"><div class="member-avatar-wrap">${M(member.photoURL, name, { size: 8, shape: "rounded-lg", border: "border border-white/10", identity: member.uid })}<span class="member-status-dot ${state.connected || member.uid === me ? "status-online" : "status-offline"}"></span></div><div class="member-info"><div class="member-name">${escapeForAttribute(name)}</div><div class="member-subtext">${state.screenActive ? window.__fb("js.dm_sharing", "يشارك الشاشة") : state.muted ? window.__fb("js.dm_mic_off", "الميكروفون مغلق") : state.deafened ? window.__fb("js.dm_deaf", "السماعة مغلقة") : state.speaking ? window.__fb("js.dm_talking", "يتحدث الآن") : window.__fb("js.dm_incall", "في المكالمة")}</div></div></div>`;
  }).join("");
}
window.toggleDmGroupMembersSidebar = function() {
  if (!String(window.currentOpenedDmUid || "").startsWith("group:")) return;
  const sidebar = ensureDmGroupMembersSidebar();
  renderDmGroupMembersSidebar();
  sidebar.classList.toggle("active");
};
function syncDmGroupMembersButton() {
  let button = document.getElementById("dm-group-members-toggle");
  if (!button) {
    const headerActions = document.querySelector("#dm-chat-header > div:last-child");
    if (headerActions) {
      button = document.createElement("button");
      button.id = "dm-group-members-toggle";
      button.className = "hidden text-gray-400 hover:text-white transition p-2 bg-white/5 rounded-xl hover:bg-blue-500/20";
      button.title = window.__fb("js.grp_members", "أعضاء المجموعة");
      button.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>';
      button.onclick = () => window.toggleDmGroupMembersSidebar();
      headerActions.insertBefore(button, headerActions.lastElementChild);
    }
  }
  if (button) button.classList.toggle("hidden", !String(window.currentOpenedDmUid || "").startsWith("group:"));
  const sidebar = document.getElementById("dm-group-members-sidebar");
  if (!String(window.currentOpenedDmUid || "").startsWith("group:") && sidebar) sidebar.classList.remove("active");
  if (String(window.currentOpenedDmUid || "").startsWith("group:")) renderDmGroupMembersSidebar();
}
function dmPresenceId() {
  const me = t.currentUser?.uid;
  return window.activeDmGroupCallId || (me && window.activeCallFriendUid ? V(me, window.activeCallFriendUid) : null);
}
function arabicCallDuration(seconds = 0) {
  const total = Math.max(0, Number(seconds) || 0), minutes = Math.floor(total / 60), hours = Math.floor(minutes / 60);
  if (hours > 0) return hours === 1 ? window.__fb("js.dur_h1", "ساعة") : hours === 2 ? window.__fb("js.dur_h2", "ساعتين") : window.__f("js.dur_hn", {n: hours}, `${hours} ساعات`);
  if (minutes > 0) return minutes === 1 ? window.__fb("js.dur_m1", "دقيقة") : minutes === 2 ? window.__fb("js.dur_m2", "دقيقتين") : window.__f("js.dur_mn", {n: minutes}, `${minutes} دقائق`);
  return window.__fb("js.moments", "بضع ثوانٍ");
}
function dmCallText(data, viewerUid) {
  const callerName = data.callerName || window.__fb("app_chat.default_sender", "مستخدم"), receiverName = data.receiverName || window.__fb("js.the_user", "المستخدم");
  const isCaller = data.callerId ? data.callerId === viewerUid : data.senderId === viewerUid;
  const duration = arabicCallDuration(data.durationSeconds);
  if (data.status === "completed") return isCaller ? window.__f("js.call_started", {dur: duration}, `بدأتَ مكالمة استمرت ${duration}`) : window.__f("js.call_started_by", {caller: callerName, dur: duration}, `${callerName} بدأ مكالمة استمرت ${duration}`);
  if (data.status === "missed") return isCaller ? window.__f("js.call_noanswer", {name: receiverName}, `لم يرد ${receiverName} على المكالمة`) : window.__f("js.call_missed", {caller: callerName, dur: duration}, `فاتتك مكالمة من ${callerName} استمرت ${duration}`);
  if (data.status === "declined") return data.senderId === viewerUid ? window.__fb("js.call_declined_you", "رفضتَ المكالمة") : window.__f("js.call_declined", {name: receiverName}, `${receiverName} رفض المكالمة`);
  if (data.status === "accepted") return data.senderId === viewerUid ? window.__fb("js.call_accepted_you", "قبلتَ المكالمة") : window.__f("js.call_accepted", {name: receiverName}, `${receiverName} قبل المكالمة`);
  return data.text || window.__fb("js.voice_call", "مكالمة صوتية");
}
async function addDmGroupEvent(docId, action, targetNames = []) {
  const me = t.currentUser?.uid;
  if (!me || !docId) return;
  const actorName = window.currentUserProfile?.displayName || window.__fb("app_chat.default_sender", "مستخدم");
  const text = action === "added" ? window.__f("js.grp_added", {actor: actorName, targets: targetNames.join(" و ")}, `${actorName} أضاف ${targetNames.join(" و ")} إلى المجموعة`) : window.__f("js.grp_call", {actor: actorName}, `${actorName} بدأ مكالمة جماعية`);
  try {
    await a(i(e, "direct_messages", docId, "messages"), { type: "group_event", action, actorId: me, actorName, targetNames, text, senderId: me, timestamp: c() });
    await u(m(e, "direct_messages", docId), { timestamp: c(), lastMessageText: text }, { merge: true });
  } catch (_) {}
}
async function updateDmPresence(patch = {}) {
  DmVP.writePresence(false, patch);
}
window.updateDmPresence = updateDmPresence;
function stopDmPresence() {
  DmVP.leavePresence();
  DmVP.unsubscribe();
  if (dmPresencePoll) { clearInterval(dmPresencePoll); dmPresencePoll = null; }
  dmPresenceKey = null;
  window.dmCallPresence = {};
}
function startDmPresence() {
  const me = t.currentUser?.uid, key = dmPresenceId();
  if (!me || !key || !n) return;
  stopDmPresence();
  dmPresenceKey = key;
  DmVP.subscribeToChannel(key, "dm");
  DmVP.setupAutoLeave();
  DmVP.writePresence(true, { speaking: false });
  dmPresencePoll = setInterval(() => DmVP.writePresence(false, {}), 15000);
}
async function G(n, d = 0, l = null) {
  let g = window.currentChatDocId;
  const p = t.currentUser?.uid;
  if (!p) return;
  if (l) try {
    const t = i(e, "direct_messages"),
      n = s(t, o("participants", "==", [p, l])),
      a = s(t, o("participants", "==", [l, p]));
    let d = await r(n);
    d.empty && (d = await r(a)), d.empty || (g = d.docs[0].id)
  } catch (e) {}
  if (!g) return;
  let h = "";
  d > 0 && (h = `${Math.floor(d/60).toString().padStart(2,"0")}:${(d%60).toString().padStart(2,"0")}`);
  try {
    const t = i(e, "direct_messages", g, "messages"),
      s = m(e, "direct_messages", g),
      o = await w(s),
      callText = "completed" === n ? window.__f("js.call_started", {dur: arabicCallDuration(d)}, `بدأتَ مكالمة استمرت ${arabicCallDuration(d)}`) : "accepted" === n ? window.__fb("js.call_accepted_you", "قبلتَ المكالمة") : "missed" === n ? window.__f("js.call_missed", {caller: (window.state?.allUsers?.[p]?.displayName || window.__fb("app_chat.default_sender", "مستخدم")), dur: arabicCallDuration(d)}, `فاتتك مكالمة من ${(window.state?.allUsers?.[p]?.displayName || "مستخدم")} استمرت ${arabicCallDuration(d)}`) : window.__fb("js.call_declined_you", "رفضتَ المكالمة");
    const targetUser = l ? (window.state?.allUsers?.[l] || window.getFriendData?.(l) || {}) : {};
    await a(t, {
      type: "call_log",
      status: n,
      durationSeconds: d,
      durationText: h,
      text: callText,
      callerId: n === "declined" || n === "accepted" ? l : p,
      receiverId: n === "declined" || n === "accepted" ? p : l,
      callerName: n === "declined" || n === "accepted" ? (targetUser.displayName || window.__fb("app_chat.default_sender", "مستخدم")) : ((window.currentUserProfile || {}).displayName || window.__fb("app_chat.default_sender", "مستخدم")),
      receiverName: targetUser.displayName || window.__fb("js.the_user", "المستخدم"),
      senderId: p,
      timestamp: c()
    });
    let r = [];
    o.exists() && (r = o.data().lastMessages || []);
    const v = {
      senderName: (window.currentUserProfile || {}).displayName || window.__fb("app_chat.default_sender", "مستخدم"),
      text: callText,
      senderId: p
    };
    r.push(v), r.length > 3 && r.shift(), await u(s, {
      timestamp: c(),
      lastMessageText: callText,
      lastMessages: r
    }, {
      merge: !0
    })
  } catch (e) {}
}

function K(n, a) {
  N.showLoading("border-emerald-500");
  const o = t.currentUser?.uid,
    c = i(e, "direct_messages", n, "messages"),
    r = s(c, d("timestamp", "asc"), h(S));
  U = l(r, snap => {
    if (window.currentChatDocId !== n) return;

    if (typeof window.notifyUser === 'function' && o) {
      try {
        snap.docChanges().forEach(change => {
          if (change.type === "added") {
            const data = change.doc.data();
            if (data.senderId && data.senderId !== o) {
              const msgTime = data.timestamp?.toDate ? data.timestamp.toDate().getTime() : Date.now();
              if (Date.now() - msgTime < 12000) {
                const isDMActive = document.getElementById("home-inline-dm") && !document.getElementById("home-inline-dm").classList.contains("hidden");
                if (document.visibilityState === 'hidden' || !isDMActive || window.currentOpenedDmUid !== data.senderId) {
                  window.notifyUser(window.__f("js.new_msg", {name: data.senderName || window.currentOpenedDmName || window.__fb('js.friend', 'صديق')}, `رسالة جديدة من ${data.senderName || window.currentOpenedDmName || 'صديق'}`), data.text || '');
                }
              }
            }
          }
        });
      } catch(err) { console.error(err); }
    }

    a && requestAnimationFrame(() => {
      if (window.currentOpenedDmUid) {
        const e = document.querySelector(`.sidebar-dm-item[data-uid="${window.currentOpenedDmUid}"]`);
        if (e) {
          const t = e.querySelector(".bg-red-500");
          t && t.remove()
        }
      }
const t = N.parseSnapshot(snap, e => function(e, t) {
        const n = e.data(),
          i = n.senderId === t,
          a = e.id,
          s = document.createElement("div");
        s.className = "flex w-full mb-1 group message-row", s.setAttribute("data-message-id", a), s.setAttribute("data-raw-text", n.text || ""), s.setAttribute("data-pending", e.metadata.hasPendingWrites || !1), s.setAttribute("data-reactions", JSON.stringify(n.reactions || {})), n.text && t && (n.text.includes(`<@${t}>`) || n.text.includes("@everyone") || n.text.includes("@here")) && s.classList.add("mention-highlight");
        let o = i ? window.__fb("app_chat.you_label", "أنت") : window.currentOpenedDmName || window.__fb("js.friend", "صديق");
        !i && n.senderName && (o = n.senderName);
        let d = i ? window.currentUserProfile?.photoURL : window.currentOpenedDmAvatar;
        if (n.senderPhotoURL && (d = n.senderPhotoURL), "group_event" === n.type) {
          const eventText = n.action === "added" ? window.__f("js.grp_added", {actor: n.actorName || window.__fb("app_chat.default_sender", "مستخدم"), targets: (n.targetNames || []).join(" و ")}, `${n.actorName} أضاف ${(n.targetNames || []).join(" و ")} إلى المجموعة`) : (n.text || window.__fb("js.grp_started", "بدأت مكالمة جماعية"));
          s.innerHTML = `<div class="dm-system-event text-center w-full py-2"><span class="text-[11px] text-gray-400">${escapeForAttribute(eventText)}</span><span class="block text-[9px] text-gray-600 mt-0.5">${escapeForAttribute(n.timestamp?.toDate ? n.timestamp.toDate().toLocaleTimeString((window.foxyI18n ? window.foxyI18n.getLang() : "ar"), { hour: "2-digit", minute: "2-digit" }) : "الآن")}</span></div>`;
          return s;
        }
        if (n.senderPhotoURL && (d = n.senderPhotoURL), "call_log" === n.type) {
          const e = n.timestamp && "function" == typeof n.timestamp.toDate ? n.timestamp.toDate().toLocaleTimeString((window.foxyI18n ? window.foxyI18n.getLang() : "ar"), {
              hour: "2-digit",
              minute: "2-digit"
            }) : window.__fb("js.now_ago", "الآن"),
            t = i ? "text-white" : "text-gray-200",
            l = M(d, o, {
              size: 9,
              shape: "circle",
              dotColor: i ? "background-color: rgb(16, 185, 129);" : "background-color: #334155;",
              shadow: "shadow-md",
              extra: "mt-0.5 border border-white/10"
            }),
            c = "completed" === n.status || "accepted" === n.status ? "text-emerald-400" : "text-red-400",
            r = escapeForAttribute(String(dmCallText(n, t))),
            m = "completed" === n.status || "accepted" === n.status ? '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.5 12.5l3.5 3.5 9-9"/></svg>' : '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
          s.innerHTML = `
            <div class="flex gap-3 hover:bg-white/[0.02] px-4 py-1 w-full transition items-start">
                <div class="flex-shrink-0">${l}</div>
                <div class="flex flex-col min-w-0 flex-1">
                    <div class="flex items-center gap-2 mb-0.5">
                        <span class="sender-name text-[13px] font-bold ${t}">${escapeForAttribute(o || window.__fb("app_chat.default_sender", "مستخدم"))}</span>
                        <span class="text-[9px] text-gray-500 font-medium">${escapeForAttribute(e)}</span>
                    </div>
                    <div class="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5 text-[11px] font-bold w-fit ${c}">${m}<span>${r}</span></div>
                </div>
            </div>
            <div class="message-actions-toolbar">
                ${createDmActionBtn(window.__fb("app_chat.ctx_reply", "رد"), "handleMessageToolbarAction", a, 'reply', 'dm')}
                ${createDmActionBtn(window.__fb("app_chat.ctx_forward", "توجيه"), "handleMessageToolbarAction", a, 'forward', 'dm')}
                ${createDmActionBtn(window.__fb("js.more", "المزيد"), "showMessageContextMenu", a, n.senderId, 'dm')}
            </div>
        `;
        return s
        }
        s.innerHTML = B({
          myUid: t,
          senderUid: n.senderId,
          senderName: o,
          senderPhotoURL: d,
          timestamp: n.timestamp,
          text: n.text || "",
          attachments: n.attachments || [],
          isForwarded: !!n.isForwarded,
          replyTo: n.replyTo || null,
          edited: !!n.edited,
          reactions: n.reactions || {},
          hasPendingWrites: e.metadata.hasPendingWrites,
          context: "dm",
          messageId: a,
          reactions: n.reactions || {}
        });
        return s
      }(e, o));
      N.applyRender(t)
    })
  })
}

function J(e, i, a = null) {
  const s = document.getElementById("dm-call-voice-bar"),
    o = document.getElementById("dm-chat-header");
  if (!s) return;
  if (window.activeDmGroupCallId && window.activeDmGroupName && i.displayName !== window.activeDmGroupName) return;
  s.setAttribute("data-call-title", i.displayName || window.__fb("js.voice_call", "مكالمة صوتية"));
  window.dmCallStatus = e;
  o && (o.classList.add("hidden"), o.classList.remove("flex")), window.isDmCalling = !0, F = i.uid, window.activeCallFriendUid = i.uid;
  //FIX: بداية مكالمة جديدة ⇒ بنمسح علامة "سبنا هذا المشارك" القديمة
  "function" == typeof window.__foxyClearLeftSessionPeers && window.__foxyClearLeftSessionPeers();
  syncDmGroupActionButton();
  const d = document.getElementById("home-call-badge");
  d && d.classList.remove("hidden"), s.classList.remove("hidden"), s.classList.add("flex");
  const l = document.getElementById("dm-voice-status"),
    c = document.getElementById("dm-voice-timer"),
    r = document.getElementById("dm-voice-my-avatar"),
    m = document.getElementById("dm-voice-friend-avatar"),
    u = window.state && window.state.allUsers && window.state.allUsers[i.uid] || {},
    w = window.currentUserProfile || {};
  m && (m.src = getAvatarSrc(u.photoURL, i.displayName || window.__fb("js.friend", "صديق"), 80, i.uid), u.photoURL ? window.clearFoxyImgBg && window.clearFoxyImgBg(m) : window.applyFoxyImgBg && window.applyFoxyImgBg(m, u.avatarColor || u.bannerColor, i.uid)), r && (r.src = getAvatarSrc(t.currentUser?.photoURL, w.displayName || window.__fb("web.t027", "أنا"), 80, t.currentUser?.uid), t.currentUser?.photoURL ? window.clearFoxyImgBg && window.clearFoxyImgBg(r) : window.applyFoxyImgBg && window.applyFoxyImgBg(r, w.avatarColor || w.bannerColor, t.currentUser?.uid));
  const g = document.getElementById("dm-voice-friend-name");
  g && (g.innerText = i.displayName || u.displayName || window.__fb("js.friend", "صديق"));

  deferDmCallWork(() => {
    dmDebug("J call UI", { mode: e, uid: i?.uid || null, name: i?.displayName || null, startTime: a });
    renderDmVoiceParticipants();
    if (typeof window.refreshDmSidebar === "function") window.refreshDmSidebar();

    if (typeof window.toggleDmCallLayout === "function") window.toggleDmCallLayout(localStorage.getItem("dmCallLayout") !== "expanded");
  });
  const p = document.getElementById("dm-voice-my-name");
  if (p && (p.innerText = w.displayName || window.__fb("web.t027", "أنا")), "calling" === e ? (l && (l.innerText = window.__fb("js.st_connecting", "جاري الاتصال...")), l && l.classList.add("text-emerald-400"), c && c.classList.add("hidden"), m && m.classList.add("dm-ringing-pulse"), O = 0) : "active" === e && (l && (l.innerText = window.__fb("js.active_call", "مكالمة نشطة")), l && l.classList.remove("text-emerald-400"), c && c.classList.remove("hidden"), m && m.classList.remove("dm-ringing-pulse"), Q(a), document.querySelectorAll(".dm-ringing-pulse").forEach(el => el.classList.remove("dm-ringing-pulse"))), t.currentUser?.uid) {
    const a = y(n, `/voice_presence/dms/${t.currentUser.uid}`);
    f(a, {
      inCall: !0,
      partnerUid: i.uid,
      mode: e,
      timestamp: Date.now()
    }), C(a).remove()
  }
  deferDmCallWork(() => startDmPresence());
}

window.updateDmSpeakingState = function(uid, speaking) {
  if (!window.isDmCalling) return;
  const me = t.currentUser?.uid;
  if (uid === "me" || uid === me) updateDmPresence({ speaking: !!speaking });
  const resolvedUid = uid === "me" ? me : (window.peerIdToUidMap?.[uid] || uid);
  const item = document.querySelector(`.dm-voice-avatar-item[data-dm-member-uid="${CSS.escape(resolvedUid || "")}"]`);
  item?.classList.toggle("dm-member-speaking", !!speaking);
};

function Q(e = null) {
  X(), O = e || Date.now();
  const t = document.getElementById("dm-voice-timer");
  j = setInterval(() => {
    const e = Date.now() - O,
      n = Math.floor(e / 1e3),
      i = Math.floor(n / 60).toString().padStart(2, "0"),
      a = (n % 60).toString().padStart(2, "0");
    t && (t.innerText = `${i}:${a}`)
  }, 1e3)
}

function X() {
  j && (clearInterval(j), j = null)
}
window.getColorFromUid = z, window.openDirectMessage = async function(d, l, preserveGroupSelection = false) {
  const p = t.currentUser?.uid;
  if (!p) return;
  dmDebug("openDirectMessage called", { requestedUid: d, requestedName: l, preserveGroupSelection });
  if (window.activeDmGroupCallId && !preserveGroupSelection && window.activeDmGroupDocId && (window.activeDmGroupMembers || []).some(member => member.uid === d)) {
    dmDebug("blocked individual open during group call", { requestedUid: d });
    if (window.currentChatDocId !== window.activeDmGroupDocId && typeof window.openDirectGroupMessage === "function") return window.openDirectGroupMessage(window.activeDmGroupDocId, [p, ...(window.activeDmGroupMembers || []).map(member => member.uid)], window.activeDmGroupName || window.__fb("js.group_call", "مكالمة جماعية"));
    return;
  }
  if (window.currentOpenedDmUid === d) {
    const e = W();
    if (e && e.panel && !e.panel.classList.contains("hidden")) return
  }

  if (!preserveGroupSelection) {
    window.currentGroupDocId = null;
    window.currentGroupParticipants = [];
    if (!window.activeDmGroupCallId) window.activeDmGroupMembers = [];
  }
  syncDmGroupActionButton();
  const h = W();
  ! function(e) {
    if ("inline" === e.mode) {
      "function" == typeof window.switchView && window.switchView("home");
      const t = document.getElementById("dm-modal");
      t && t.classList.add("hidden"), e.homePanels && e.homePanels.classList.add("hidden"), e.panel && e.panel.classList.remove("hidden");
      const n = document.querySelector(".home-view-header");
      n && n.classList.add("hidden"), "function" == typeof window.showMobileMainContent && window.showMobileMainContent()
    } else e.panel && e.panel.classList.remove("hidden")
  }(h);
  const {
    panel: v,
    headerName: I,
    messagesContainer: D,
    dmSendBtn: E,
    dmInput: B,
    dmCallBtn: M
  } = h;
  if (window.currentOpenedDmUid = d, window.currentOpenedDmName = l, window.currentOpenedDmAvatar = null, window.getActiveDmMembers = () => window.currentOpenedDmUid ? [{
      id: window.currentOpenedDmUid,
      displayName: window.currentOpenedDmName || window.__fb("js.friend", "صديق")
    }] : [], syncDmGroupMembersButton(), v) {
    syncDmGroupActionButton();
    const e = z(d);
    v.style.setProperty("--dm-accent-rgb", e), v.classList.remove("animate-view"), requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        v.classList.add("animate-view")
      })
    })
  }
  if (!preserveGroupSelection) {
    const T = z(d);
    document.querySelectorAll(".sidebar-dm-item").forEach(e => {
      e.getAttribute("data-uid") === d ? (e.classList.add("sidebar-dm-item-active"), e.style.setProperty("--dm-accent-rgb", T)) : (e.classList.remove("sidebar-dm-item-active"), e.style.removeProperty("--dm-accent-rgb"))
    });
  }

  setTimeout(() => { if (typeof window.initDmTyping === 'function') window.initDmTyping(d); }, 300);

  const P = document.getElementById("dm-call-voice-bar"),
    j = document.getElementById("dm-chat-header"),
    F = !window.activeDmGroupCallId && window.activeCallFriendUid === d;
  if (P && j && (F ? (j.classList.add("hidden"), j.classList.remove("flex"), P.classList.remove("hidden"), P.classList.add("flex")) : (j.classList.remove("hidden"), j.classList.add("flex"), P.classList.add("hidden"), P.classList.remove("flex"))), I) {
    if (!l) try {
      const t = await w(m(e, "users", d));
      if (t.exists()) {
        const e = t.data();
        l = e.displayName, window.currentOpenedDmName = l, window.currentOpenedDmAvatar = e.photoURL
      }
    } catch (e) {}
    I.innerText = l || window.__fb("app_chat.default_sender", "مستخدم"), I.style.color = "white", I.style.textShadow = "none", k && (k(), k = null);
    const t = document.getElementById("dm-header-status-dot");
    if (t) {
      const e = y(n, `/status/${d}`);
      k = b(e, e => {
        const n = e.val(),
          i = n && "online" === n.state && (!n.last_changed || Date.now() - n.last_changed < 12e4);
        t.classList.toggle("bg-emerald-500", i), t.classList.toggle("animate-pulse", i), t.classList.toggle("bg-gray-500", !i)
      })
    }
  }
  D && (D.innerHTML = '<div class="text-center text-xs text-gray-500 py-4">' + window.__fb('js.dm_loading', 'جاري تحميل الرسائل...') + '</div>'), E && B && (E.onclick = async () => {
    if (window.waitForAttachments) await window.waitForAttachments(B.id);
    const n = (window.extractMentionContent ? window.extractMentionContent(B) : void 0 !== B.value ? B.value : B.innerText).trim();
    let s = "";
    if (window.getAttachments) {
      const e = B.id,
        t = window.getAttachments(e).filter(e => "ready" === e.status && e.url);

      t.length > 0 && (s = "")
    }
    const hasAttachments = !!window.getAttachments?.(B.id).some(e => e.status === "ready" && e.url);
    const o = n + s;
    if (o || hasAttachments) try {
      !async function(n, s) {
        if (!s || !window.currentChatDocId) return;
        const o = t.currentUser?.uid;
        if (!o) return;
        const {
          dmInput: d
        } = W();
        d && (d.innerHTML = "");
        try {
          if (window.currentEditingMsgId && "dm" === window.currentEditingType) {
            const e = window.currentEditingMsgId;
            return window.cancelEditingMessage && window.cancelEditingMessage(), void await window.updateDmMessage(e, s)
          }
          const n = i(e, "direct_messages", window.currentChatDocId, "messages"),
            d = {
              senderId: o,
              senderPhotoURL: t.currentUser?.photoURL || "",
              text: s,
              timestamp: c(),
              type: "text"
            };
          const attachments = window.getAttachments?.(B.id).filter(item => item.status === 'ready' && item.url).map(item => ({ url: item.url, kind: item.kind || "image", name: item.name || item.file?.name || "ملف", size: item.size || 0, mime: item.mime || item.file?.type || "", oneTime: !!item.oneTime, viewedBy: {} })) || [];
          if (attachments.length) d.attachments = attachments;
          window.currentReplyToMsgId && "dm" === window.currentReplyToType && (d.replyTo = {
            msgId: window.currentReplyToMsgId,
            senderName: window.currentReplyData.senderName,
            text: window.currentReplyData.text
          }, window.cancelReplyMessage()), await a(n, d);
          const l = window.currentUserProfile || {},
            r = m(e, "direct_messages", window.currentChatDocId),
            p = await w(r);
          let h = [];
          p.exists() && (h = p.data().lastMessages || []);
          const v = {
            senderName: l.displayName || window.__fb("app_chat.default_sender", "مستخدم"),
            text: s.length > 50 ? s.substring(0, 47) + "..." : s,
            senderId: o
          };
          h.push(v), h.length > 3 && h.shift(), await u(r, {
            timestamp: c(),
            messageCount: g(1),
            lastSenderId: o,
            lastSenderName: l.displayName || window.__fb("app_chat.default_sender", "مستخدم"),
            lastMessageText: v.text,
            lastMessages: h
          }, {
            merge: !0
          })
        } catch (e) {
          alert(window.__fb("js.send_err", "حدث خطأ أثناء إرسال الرسالة."))
        }
  }(0, o), window.clearAttachments && window.clearAttachments(B.id)
    } catch (e) {}
  }, B.addEventListener("keydown", e => {
    "Enter" !== e.key || e.shiftKey || (e.preventDefault(), e.stopImmediatePropagation(), E.click())
  }), void 0 !== B.value ? B.value = "" : B.innerText = ""), M && !M._dmCallBound && (M.onclick = async () => {
    if (!n || !window.myId) return;
    "function" == typeof window.leaveVoiceChannel && await window.leaveVoiceChannel(!0);
    const e = window.currentUserProfile || {},
      t = y(n, `/incoming_calls/${d}`);
    const callerPeerId = window.peer?.id || window.myId;
    if (!callerPeerId) {
      if (typeof window.initPeer === 'function') await window.initPeer().catch(() => {});
      if (!window.peer?.open || !window.peer?.id) return;
    }
    f(t, {
      callerUid: p,
      callerPeerId: callerPeerId || window.peer.id,
      callerName: e.displayName || window.__fb("js.friend", "صديق"),
      timestamp: Date.now()
    }), C(t).remove();
    const i = b(t, e => {
        e.exists() || (q && (clearTimeout(q), q = null), window.isDmCalling && !O && setTimeout(() => {
          const e = V(p, d),
            t = y(n, `/active_calls/${e}`);
          x(t).then(e => {
            e.exists() || window.hideDmCallOverlay("record_missing")
          })
        }, 500), R = null, A && (A.pause(), A = null), i())
      }),
      a = V(p, d);
    H = y(n, `/active_calls/${a}`), f(H, {
      initiator: p,
      receiver: d,
      status: "calling",
      startTime: Date.now()
    }), C(H).remove(), R = t, q = setTimeout(() => {
      R && (L(R).catch(() => {}), R = null, window.hideDmCallOverlay("timeout"), "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.no_answer", "لم يتم الرد على المكالمة."), "info"))
    }, 45e3);
    const s = document.getElementById("peer-id-input"),
      o = document.getElementById("call-btn");
    s && o && (s.value = window.myId), "function" == typeof window.playChannelSound && (A && A.pause(), A = window.playChannelSound("dialing", !0)), window.isDmCalling = !0, window.isCallInitiator = !0, "function" == typeof window.__foxyClearLeftSessionPeers && window.__foxyClearLeftSessionPeers(), J("calling", {
      displayName: l,
      uid: d
    }, Date.now())
  }), U && (U(), U = null), window.currentChatDocId = null;
  try {
    const t = i(e, "direct_messages"),
      n = s(t, o("participants", "==", [p, d])),
      l = s(t, o("participants", "==", [d, p]));
    let u = await r(n);
    if (u.empty && (u = await r(l)), u.empty) {
      const e = await a(t, {
        participants: [p, d],
        timestamp: c()
      });
      window.currentChatDocId = e.id
    } else window.currentChatDocId = u.docs[0].id;
    window.currentChatDocId && w(m(e, "direct_messages", window.currentChatDocId)).then(e => {
      if (e.exists()) {
        const t = e.data();
        t.messageCount && localStorage.setItem(`dmReadCount_${p}_${window.currentChatDocId}`, t.messageCount.toString())
      }
    }).catch(e => {}), S = 50, _ = !1, N.reset(), window.__isLoadingMore = !1, K(window.currentChatDocId, D)
  } catch (e) {
    D && (D.innerHTML = '<div class="text-center text-xs text-red-500 py-4">' + window.__fb('js.msg_load_fail', 'حدث خطأ أثناء تحميل الرسائل.') + '</div>')
  }
}, window.openDirectGroupMessage = async function(docId, participants = [], groupName = window.__fb("js.group_call", "مكالمة جماعية")) {
  dmDebug("openDirectGroupMessage called", { docId, participants, groupName });
  const me = t.currentUser?.uid;
  const firstMember = participants.find(uid => uid !== me);
  if (!me || !docId || !firstMember) return;
  window.currentGroupDocId = docId;
  window.currentGroupParticipants = Array.isArray(participants) ? participants : [];
  window.activeDmGroupMembers = participants.filter(uid => uid !== me).map(uid => { const member = window.getFriendData?.(uid) || {}; return { uid, displayName: member.displayName || window.__fb("app_chat.default_sender", "مستخدم"), photoURL: member.photoURL || "" }; });
  await window.openDirectMessage(firstMember, groupName, true);
  window.currentOpenedDmName = groupName;
  window.currentOpenedDmUid = `group:${docId}`;
  window.currentChatDocId = docId;
  syncDmGroupActionButton();
  dmDebug("group chat selected", { docId, participants, groupName });
  syncDmGroupMembersButton();
  document.querySelectorAll(".sidebar-dm-item").forEach(item => item.classList.toggle("sidebar-dm-item-active", item.getAttribute("data-doc-id") === docId));
  K(docId, document.getElementById("home-dm-messages"));
  renderDmVoiceParticipants();
  if (window.activeDmGroupCallId && typeof J === "function") J("active", { uid: firstMember, displayName: groupName });
}, window.closeDirectMessage = function() {
  ! function() {
    const e = document.getElementById("home-inline-dm"),
      t = document.getElementById("home-friends-panels"),
      n = document.getElementById("dm-modal");
    e && e.classList.add("hidden"), t && t.classList.remove("hidden"), n && n.classList.add("hidden");
    const i = document.querySelector(".home-view-header");
    i && i.classList.remove("hidden")
  }(), document.querySelectorAll(".sidebar-dm-item").forEach(e => {
    e.classList.remove("sidebar-dm-item-active"), e.style.removeProperty("--dm-accent-rgb")
  }), U && (U(), U = null), N.destroy(), k && (k(), k = null), window.currentChatDocId = null, window.currentGroupDocId = null, window.currentGroupParticipants = null
}, window.sendSilentDm = async function(n, d, l = "text") {
  const p = t.currentUser?.uid;
  if (p && n && d) try {
    const t = i(e, "direct_messages"),
      h = s(t, o("participants", "==", [p, n])),
      v = s(t, o("participants", "==", [n, p]));
    let y, f = await r(h);
    f.empty && (f = await r(v)), y = f.empty ? (await a(t, {
      participants: [p, n],
      timestamp: c()
    })).id : f.docs[0].id;
    const x = i(e, "direct_messages", y, "messages"),
      I = {
        senderId: p,
        text: d,
        timestamp: c(),
        type: l
      };
    await a(x, I);
    const b = window.currentUserProfile || {},
      L = m(e, "direct_messages", y),
      C = await w(L);
    let D = C.exists() && C.data().lastMessages || [];
    const E = {
      senderName: b.displayName || window.__fb("app_chat.default_sender", "مستخدم"),
      text: d.length > 50 ? d.substring(0, 47) + "..." : d,
      senderId: p
    };
    D.push(E), D.length > 3 && D.shift(), await u(L, {
      timestamp: c(),
      messageCount: g(1),
      lastSenderId: p,
      lastSenderName: b.displayName || window.__fb("app_chat.default_sender", "مستخدم"),
      lastMessageText: d,
      lastMessages: D
    }, {
      merge: !0
    })
  } catch (e) {}
}, window.forwardMessageToDm = async function(n, d) {
  const p = t.currentUser?.uid;
  if (!p || !n || !d) return;
  try {
    const l = i(e, "direct_messages"),
      h = s(l, o("participants", "==", [p, n])),
      v = s(l, o("participants", "==", [n, p]));
    let y = await r(h);
    y.empty && (y = await r(v));
    const f = y.empty ? (await a(l, {
      participants: [p, n],
      timestamp: c()
    })).id : y.docs[0].id;
    const x = window.currentUserProfile || {},
      I = i(e, "direct_messages", f, "messages"),
      b = {
        senderId: p,
        senderPhotoURL: t.currentUser?.photoURL || x.photoURL || "",
        text: d,
        timestamp: c(),
        type: "text",
        isForwarded: !0
      };
    await a(I, b);
    const L = m(e, "direct_messages", f),
      C = await w(L);
    let D = C.exists() && C.data().lastMessages || [];
    D.push({
      senderName: x.displayName || window.__fb("app_chat.default_sender", "مستخدم"),
      text: d.length > 50 ? d.substring(0, 47) + "..." : d,
      senderId: p
    }), D.length > 3 && D.shift(), await u(L, {
      timestamp: c(),
      messageCount: g(1),
      lastSenderId: p,
      lastSenderName: x.displayName || window.__fb("app_chat.default_sender", "مستخدم"),
      lastMessageText: d,
      lastMessages: D
    }, {
      merge: !0
    });
    return f
  } catch (e) {
    console.error("[DM] Failed to forward message:", e);
    throw e
  }
}, (async () => { await whenReady(); v(t, e => {
  const i = e?.uid;
  if (!i || !n) return void(T && (T(), T = null));
  const a = y(n, `/incoming_calls/${i}`);
  let s = null,
    o = !1;
  T = b(a, e => {
    const t = e.val(),
      n = document.getElementById("incoming-call-modal"),
      i = document.getElementById("incoming-caller-name");
    t && dmDebug("incoming_calls update", { callerUid: t.callerUid || null, groupCallId: t.groupCallId || null, groupDocId: t.groupDocId || null, groupParticipants: t.groupParticipants || null, timestamp: t.timestamp || null });
    if (!t) return n && n.classList.add("hidden"), A && (A.pause(), A = null), !s || window.isDmCalling || o || G("missed", 0, s.callerUid), P = null, s = null, void(o = !1);
    if (s = t, o = !1, Date.now() - t.timestamp > 45e3) L(a).catch(() => {});
    else if (!P || P.timestamp !== t.timestamp) {
      P = t, i && (i.innerText = t.callerName);
      const e = document.getElementById("incoming-call-avatar");
      if (e) {
        const n = window.state && window.state.allUsers && window.state.allUsers[t.callerUid] || {},
          i = getAvatarSrc("", t.callerName || window.__fb("app_chat.default_sender", "مستخدم"), 80, t.callerUid || t.callerName);
        e.loading = "lazy", e.src = n.photoURL || i;

        n.photoURL ? window.clearFoxyImgBg && window.clearFoxyImgBg(e) : window.applyFoxyImgBg && window.applyFoxyImgBg(e, n.avatarColor || n.bannerColor, t.callerUid || t.callerName)
      }
      n && n.classList.remove("hidden"), "function" != typeof window.playChannelSound || A || (A = window.playChannelSound("call", !0)), "visible" !== document.visibilityState && function(e) {
        if (!("Notification" in window) || "granted" !== Notification.permission) return;
        const t = window.__f("js.incoming", {name: e}, `مكالمة واردة من ${e}`),
          n = {
            body: window.__fb("js.call_notify", "اضغط للرد أو الرفض للمكالمة الصوتية."),
            icon: "/assets/img/foxy.png",
            badge: "/assets/img/foxy.png",
            tag: "dm-call",
            renotify: !0,
            requireInteraction: !0,
            vibrate: [200, 100, 200, 100, 200, 100, 200],
            data: {
              action: "INCOMING_CALL",
              friendUid: P?.callerUid,
              friendName: P?.callerName
            },
            actions: [{
              action: "accept",
              title: window.__fb("js.call_accept_t", "رد ✅"),
              icon: "/assets/img/foxy.png"
            }, {
              action: "decline",
              title: window.__fb("js.call_decline_t", "رفض ❌"),
              icon: "/assets/img/foxy.png"
            }]
          };
        "serviceWorker" in navigator ? navigator.serviceWorker.ready.then(e => {
          e.showNotification(t, n)
        }) : new Notification(t, n)
      }(t.callerName)
    }
  });
  const d = y(n, "/active_calls");
  b(d, e => {
    if (window.activeDmGroupCallId || window.dmGroupStarting) return;
    const n = e.val(),
      i = t.currentUser?.uid;
    dmDebug("active_calls snapshot", { records: n ? Object.keys(n).map(key => ({ key, ...n[key] })) : [] });
    if (!n) return void(window.isDmCalling && setTimeout(() => {
      x(d).then(e => {
        !e.exists() && window.isDmCalling && window.hideDmCallOverlay("no_active_records")
      })
    }, 2e3));
    let a = null,
      s = null;
    for (const e in n)
      if (!n[e].groupCallId && (n[e].initiator === i || n[e].receiver === i)) {
        a = n[e], s = e;
        break
      } if (a) {
      const e = a.initiator === i ? a.receiver : a.initiator;
      if (window.isDmCalling && window.activeCallFriendUid === e) window.isDmCalling && "active" === a.status && window.updateDmCallOverlayStatus("active", a.startTime);
      else {
        const t = window.state && window.state.allUsers && window.state.allUsers[e] || {};
        window.isDmCalling = !0, window.activeCallFriendUid = e, J("active" === a.status ? "active" : "calling", {
          uid: e,
          displayName: t.displayName || window.__fb("js.friend", "صديق")
        }, a.startTime)
      }
    } else if (window.isDmCalling) {
      if (window.isCallInitiator && (!O || Date.now() - O < 800)) return;
      if (window.isCallInitiator && window.activeCallFriendUid) try { G("declined", 0, window.activeCallFriendUid); } catch(_e) {}
      window.hideDmCallOverlay("call_not_found")
    }
  });
  const l = document.getElementById("accept-call-btn"),
    c = document.getElementById("decline-call-btn");
  l && (l.onclick = async () => {
    window.foxyLog("info", '[Foxy][dm-accept] clicked', {P});
    const e = P;
    if (!e) return;
    dmDebug("accept clicked", { incoming: { callerUid: e.callerUid, groupCallId: e.groupCallId || null, groupDocId: e.groupDocId || null, groupParticipants: e.groupParticipants || null } });
    const i = t.currentUser?.uid;
    if (!i || !n) return;

    if (e.groupCallId) try {
      const groupSnap = await x(y(n, `/group_calls/${e.groupCallId}`));
      const groupData = groupSnap.val() || {};
      e.groupDocId = e.groupDocId || groupData.groupDocId || null;
      e.groupName = e.groupName || groupData.groupName || window.__fb("js.group_call", "مكالمة جماعية");
      if (!Array.isArray(e.groupParticipants) || e.groupParticipants.length < 2) e.groupParticipants = Object.keys(groupData.participants || {});
      if (!e.callerUid && groupData.callerUid) e.callerUid = groupData.callerUid;
      if (!e.callerPeerId && groupData.callerPeerId) e.callerPeerId = groupData.callerPeerId;
    } catch (_) {}
    dmDebug("accept normalized", { callerUid: e.callerUid, groupCallId: e.groupCallId || null, groupDocId: e.groupDocId || null, groupParticipants: e.groupParticipants || null });
    "function" == typeof window.leaveVoiceChannel && await window.leaveVoiceChannel(!0);
    try {
      if (typeof window.loadWebRTCTools === 'function' && !window.webrtcLoaded) await window.loadWebRTCTools();
      if ((!window.peer || window.peer.destroyed || window.peer.disconnected) && typeof window.initPeer === 'function') await window.initPeer();
      else if (window.peer && !window.peer.open && typeof window.rebuildPeer === 'function') window.rebuildPeer('dm-accept-peer-not-open');
      const _peerWaitStart = Date.now();
      while ((!window.peer || !window.peer.open || !window.peer.id) && Date.now() - _peerWaitStart < 15000) await new Promise(r => setTimeout(r, 100));
      window.foxyLog("info", '[Foxy][dm-accept] local peer state', {peerId:window.peer?.id || null, open:!!window.peer?.open, destroyed:!!window.peer?.destroyed});
    } catch (_peerInitError) { window.foxyLog("error", '[Foxy][dm-accept] local peer init failed', _peerInitError); }
    let a = e.callerPeerId;
    if (!a || a === e.callerUid) {

      try {
        const _activeCall = await x(y(n, `/active_calls/${V(i, e.callerUid)}`)).then(s => s.val()).catch(() => null);
        if (_activeCall?.initiatorPeerId) a = _activeCall.initiatorPeerId;
      } catch (_e) {}

      try {
        const _active = window._lastActiveCallsSnapshot || {};
        for (const _k in _active) { if (_active[_k].initiator === e.callerUid) { a = _active[_k].initiatorPeerId || _active[_k].callerPeerId || a; break; } }
      } catch(_e) {}
      if (!a || a === e.callerUid) a = window.uidToPeerIdMap?.[e.callerUid] || (window.peerIdToUidMap && Object.keys(window.peerIdToUidMap).find(k=>window.peerIdToUidMap[k]===e.callerUid));
      if (!a || a === e.callerUid) {
        window.foxyLog("error", '[Foxy][dm-accept] callerPeerId unavailable; refusing UID fallback', {callerUid:e.callerUid});
        if (typeof window.addSystemMsg === 'function') window.addSystemMsg(window.__fb('js.peer_not_found', 'تعذر العثور على اتصال الطرف الآخر. أعد المحاولة.'), 'error');
        return;
      }
      window.foxyLog("info", '[Foxy][dm-accept] callerPeerId resolved', {callerUid:e.callerUid, callerPeerId:a, source:e.callerPeerId ? 'incoming_calls' : 'active_calls_or_map'});
      }
      s = e.callerUid,
      o = e.callerName;
    if (e.groupCallId && Array.isArray(e.groupParticipants)) {
      window.activeDmGroupCallId = e.groupCallId;
      window.activeDmGroupDocId = e.groupDocId || null;
      window.activeDmGroupName = e.groupName || window.__fb("js.group_call", "مكالمة جماعية");
      window.activeDmGroupMembers = e.groupParticipants.filter(uid => uid !== i).map(uid => { const member = window.getFriendData?.(uid) || {}; return { uid, displayName: member.displayName || (uid === e.callerUid ? e.callerName : window.__fb('app_chat.default_sender', 'مستخدم')), photoURL: member.photoURL || '' }; });
    }
    try { G("accepted", 0, s); } catch (_e) {}
    try {
      window.isDmCalling = !0, window.isCallInitiator = !1, window.activeCallFriendUid = s;
      if (e.groupCallId && e.groupDocId && Array.isArray(e.groupParticipants) && typeof window.openDirectGroupMessage === "function") await window.openDirectGroupMessage(e.groupDocId, e.groupParticipants, e.groupName || window.__fb("js.group_call", "مكالمة جماعية"));
      else if (typeof window.openDirectMessage === "function") await window.openDirectMessage(s, o);

      J("active", {
        displayName: o,
        uid: s
      });

      try {
        const _stream = await (window.ensureLocalStream ? window.ensureLocalStream() : navigator.mediaDevices.getUserMedia({audio:true}));
        let _callerPeer = a;
        if (!_callerPeer || _callerPeer === s) {
          try { const _snap2 = await x(y(n, `/active_calls/${V(i,s)}`)).then(s=>s.val()).catch(()=>null); if (_snap2 && _snap2.initiatorPeerId) _callerPeer = _snap2.initiatorPeerId; } catch(_e) {}
          if (!_callerPeer || _callerPeer === s) _callerPeer = window.uidToPeerIdMap?.[s] || null;
        }
        if (_callerPeer && window.peer && !window.peer.destroyed && window.peer.open) {
          const _call2 = window.peer.call(_callerPeer, _stream);
          if (_call2 && typeof window.handleCall === 'function') window.handleCall(_call2);
          else if (_call2 && typeof handleCall === 'function') handleCall(_call2);
          window.foxyLog("info", '[Foxy][dm-accept] callee calling caller', {callerPeer:_callerPeer});
        } else window.foxyLog("error", '[Foxy][dm-accept] cannot call caller', {callerPeer:_callerPeer || null, localPeerId:window.peer?.id || null, peerOpen:!!window.peer?.open});
      } catch(_e) { window.foxyLog("warn", '[Foxy][dm-accept] peer.call failed', _e?.message||_e); }
      const l = V(i, s),
        c = y(n, `/active_calls/${l}`);
      H = c, await I(c, {
        status: "active",
        startTime: Date.now(),
        receiverPeerId: e.receiverPeerId || null,
        groupCallId: e.groupCallId || null,
        groupDocId: e.groupDocId || null
      }), c && C(c).remove(), await L(y(n, `/incoming_calls/${i}`)).catch(() => {});
      if (e.groupCallId) {
        I(y(n, `/group_calls/${e.groupCallId}/participants/${i}`), { status: "active" }).catch(() => {});
      }
    } catch (e) { window.foxyLog("error", '[Foxy][dm-accept] accept flow failed', e); }
  }), c && (c.onclick = async () => {
    const e = P;
    if (!e) return;
    const i = t.currentUser?.uid;
    if (!i || !n) return;
    o = !0, G("declined", 0, e.callerUid);
    const a = y(n, `/incoming_calls/${i}`);
    L(a).catch(() => {});
    const s = V(i, e.callerUid);
    L(y(n, `/active_calls/${s}`)).catch(() => {}), window.hideDmCallOverlay("declined")
  })
}); })(), "serviceWorker" in navigator && navigator.serviceWorker.addEventListener("message", e => {
  if (e.data)
    if ("OPEN_DM" === e.data.action) window.openDirectMessage(e.data.uid);
    else if ("ACCEPT_CALL" === e.data.action) window.openDirectMessage(e.data.uid, e.data.name).then(() => {
    const e = document.getElementById("accept-call-btn");
    e && e.click()
  });
  else if ("DECLINE_CALL" === e.data.action) {
    const e = document.getElementById("decline-call-btn");
    e && e.click()
  }
}), window.addEventListener("foxydeeplink", e => {
  try {
    const raw = e.detail && e.detail.url;
    if (!raw) return;
    const u = new URL(raw, window.location.href);
    let dm = u.searchParams.get("dm");
    if (!dm && u.hash && u.hash.indexOf("#dm-") === 0) dm = u.hash.substring(4).split("-")[0];
    if (dm && typeof window.openDirectMessage === "function") {
      if (typeof e.preventDefault === "function") e.preventDefault();
      window.openDirectMessage(decodeURIComponent(dm));
    }
  } catch (_) {}
}), window.addEventListener("load", () => {
  setTimeout(() => {
    const e = window.location.hash;
    if (e && e.startsWith("#dm-")) {
      const t = e.substring(4).split("-"),
        n = t[0],
        i = t.length > 1 && "accept" === t[1];
      window.history.replaceState(null, null, window.location.pathname), "function" == typeof window.openDirectMessage && window.openDirectMessage(n).then(() => {
        i && setTimeout(() => {
          const e = document.getElementById("accept-call-btn");
          e && e.click()
        }, 1500)
      })
    }
  }, 2500)
}), window.updateDmCallOverlayStatus = function(e, t = null) {
  const n = document.getElementById("dm-voice-status"),
    i = document.getElementById("dm-voice-timer"),
    a = document.getElementById("dm-voice-friend-avatar"),
    s = document.getElementById("dm-call-voice-bar");
  if ("active" === e) {
    if (s && s.classList.contains("hidden")) {
      s.classList.remove("hidden"), s.classList.add("flex");
      const e = document.getElementById("dm-chat-header");
      e && e.classList.add("hidden")
    }
    n && (n.innerText = window.__fb("js.active_call", "مكالمة نشطة")), n && n.classList.remove("text-emerald-400"), i && i.classList.remove("hidden"), a && a.classList.remove("dm-voice-pulse"), Q(t)
  }
}, window.hideDmCallOverlay = async function(e = "unspecified") {
  dmDebug("hide call overlay", { reason: e });
  const groupCallId = window.activeDmGroupCallId;
  const groupMembers = (window.activeDmGroupMembers || []).map(member => member.uid).filter(Boolean);
  const i = window.activeCallFriendUid,
    a = t.currentUser?.uid;
  if (window.isDmCalling && !O && window.isCallInitiator && i && ("timeout" === e || "call_not_found" === e || "record_missing" === e) && G("missed", 0, i), O) {
    const e = Math.floor((Date.now() - O) / 1e3);
    e > 0 && window.isCallInitiator && i && G("completed", e, i)
  }
  if (groupCallId) {
    try {
      L(y(n, `/group_calls/${groupCallId}`)).catch(() => {});
      for (const uid of groupMembers) {
        L(y(n, `/incoming_calls/${uid}`)).catch(() => {});
      }
    } catch (_) {}
  }
  stopDmPresence(), window.isDmCalling = !1, window.activeCallFriendUid = null, window.isCallInitiator = !1, window.activeDmGroupCallId = null, window.activeDmGroupDocId = null, window.activeDmGroupName = null, window.activeDmGroupMembers = [], X(), O = 0, A && (A.pause(), A = null);
  syncDmGroupActionButton();
  const s = document.getElementById("home-call-badge");
  if (s && s.classList.add("hidden"), a && i) {

    try { const _actId = V(a, i); L(y(n, `/active_calls/${_actId}`)).catch(()=>{}); } catch(_e) {}

    try { x(y(n, "/active_calls")).then(snap => { const val = snap.val() || {}; Object.entries(val).forEach(([k, v]) => { if ((v.initiator===a && v.receiver===i) || (v.initiator===i && v.receiver===a)) L(y(n, `/active_calls/${k}`)).catch(()=>{}); }); }).catch(()=>{}); } catch(_e) {}

    try { L(y(n, `/incoming_calls/${i}`)).catch(()=>{}); L(y(n, `/incoming_calls/${a}`)).catch(()=>{}); } catch(_e) {}
  }
  "function" == typeof window.refreshDmSidebar && window.refreshDmSidebar(), a && L(y(n, `/voice_presence/dms/${a}`)).catch(() => {});
  const o = document.getElementById("dm-call-voice-bar"),
    d = document.getElementById("dm-chat-header");
  o && (o.classList.add("hidden"), o.classList.remove("flex")), d && (d.classList.remove("hidden"), d.classList.add("flex"));
  const l = document.getElementById("dm-call-overlay");
  l && (l.classList.add("hidden"), l.classList.remove("flex")), q && (clearTimeout(q), q = null), R && (L(R).catch(() => {}), R = null);
  //FIX: hideDmCallOverlay بيتنادى في مواقف مش متعلقة بمكالمة DM أصلاً
  //(زي disconnectFromRoom لما نخرج من القناة الصوتية). وكان بيقتل
  //الميكروفون بتاع مستخدم داخل جلسة صوتية ⇒ recall بيستحيل ⇒ استرجاع
  //اتصال المشاهدة بيفشل ⇒ "الشير مش بيفتح" عند المشاهد.
  //بنوقف الميكروفون بس لو مفيش جلسة صوتية نشطة.
  try {
    const _voiceSessionActive = ("function" == typeof window.isVoiceSessionActive && window.isVoiceSessionActive())
      || !!(window.state && window.state.activeVoiceChannelId);
    if (!_voiceSessionActive && !window.currentHostId && "function" == typeof window.stopLocalStream) window.stopLocalStream();
  } catch (_) {}
}, window.toggleDmCallLayout = function(e) {
  const t = document.getElementById("dm-call-voice-bar"),
    n = document.getElementById("dm-voice-container"),
    i = document.getElementById("dm-voice-avatars"),
    a = document.querySelectorAll(".dm-voice-label"),
    s = document.getElementById("dm-layout-expand-icon"),
    o = document.getElementById("dm-layout-compact-icon"),
    d = [document.getElementById("dm-voice-my-avatar"), document.getElementById("dm-voice-friend-avatar")];
  t && (e ? (t.classList.add("dm-voice-compact"), t.classList.remove("flex-col", "p-5", "gap-4", "text-center"), t.classList.add("flex-row", "p-3", "justify-between"), n && (n.classList.add("items-center"), n.classList.remove("items-end", "text-right")), i && (i.classList.add("justify-center"), i.classList.remove("justify-end", "gap-6", "mb-2"), i.classList.add("-space-x-3", "mb-1")), a.forEach(e => e.classList.add("hidden")), d.forEach(e => {
    e && (e.classList.remove("w-14", "h-14"), e.classList.add("w-10", "h-10"))
  }), s && s.classList.remove("hidden"), o && o.classList.add("hidden"), localStorage.setItem("dmCallLayout", "compact"), document.querySelectorAll(".dm-voice-name").forEach(e => e.classList.add("hidden"))) : (t.classList.remove("dm-voice-compact"), t.classList.add("flex-col", "p-5", "gap-4", "text-center"), t.classList.remove("flex-row", "p-3", "justify-between"), n && (n.classList.add("items-center"), n.classList.remove("items-end")), i && (i.classList.add("gap-6", "mb-2"), i.classList.remove("-space-x-3", "mb-1")), a.forEach(e => e.classList.remove("hidden")), d.forEach(e => {
    e && (e.classList.remove("w-10", "h-10"), e.classList.add("w-14", "h-14"))
  }), s && s.classList.add("hidden"), o && o.classList.remove("hidden"), localStorage.setItem("dmCallLayout", "expanded"), document.querySelectorAll(".dm-voice-name").forEach(e => e.classList.remove("hidden"))))
}, window.deleteDmMessage = async function(t) {
  if (window.currentChatDocId) try {
    const n = m(e, "direct_messages", window.currentChatDocId, "messages", t);
    await deleteDoc(n);
    const a = i(e, "direct_messages", window.currentChatDocId, "messages"),
      o = s(a, d("timestamp", "desc"), p(1)),
      l = await r(o);
    let u = "",
      w = "";
    if (!l.empty) {
      const e = l.docs[0].data();
      u = e.text || "", "call_log" === e.type && (u = "completed" === e.status ? window.__f("js.log_ended", {dur: e.durationText}, `انتهت المكالمة (${e.durationText})`) : "accepted" === e.status ? window.__fb("js.log_accepted", "تم قبول المكالمة") : "missed" === e.status ? window.__fb("js.log_noanswer", "المكالمة انتهت دون رد") : window.__fb("js.log_declined", "تم رفض المكالمة")), w = e.senderId || ""
    }
    const h = m(e, "direct_messages", window.currentChatDocId),
      v = {
        messageCount: g(-1),
        lastMessageText: u.length > 50 ? u.substring(0, 47) + "..." : u,
        timestamp: c()
      };
    w && (v.lastSenderId = w), await updateDoc(h, v)
  } catch (e) {
    alert(window.__fb("js.msg_del_fail", "فشل حذف الرسالة"))
  }
}, window.addEventListener("load", () => {
  setTimeout(() => {
    "compact" === localStorage.getItem("dmCallLayout") && window.toggleDmCallLayout(!0)
  }, 1e3)
}), window.addEventListener("load", () => {
  const e = document.getElementById("dm-voice-hangup-btn"),
    t = document.getElementById("dm-voice-mute-btn"),
    n = document.getElementById("dm-voice-deafen-btn"),
    i = document.getElementById("dm-voice-layout-toggle");
  e && (e.onclick = () => {
    const e = document.getElementById("hangup-btn");
    e && e.click(), window.hideDmCallOverlay("manual")
  }), t && (t.onclick = () => {
    "function" == typeof window.toggleMute && window.toggleMute()
  }), n && (n.onclick = () => {
    "function" == typeof window.toggleDeafen && window.toggleDeafen()
  }), i && (i.onclick = () => {
    const e = document.getElementById("dm-call-voice-bar");
    if (!e) return;
    const t = e.classList.contains("dm-voice-compact");
    window.toggleDmCallLayout(!t)
  })
}), window.updateDmMessage = async function(t, n) {
  if (window.currentChatDocId) try {
    const i = m(e, "direct_messages", window.currentChatDocId, "messages", t);
    await updateDoc(i, {
      text: n,
      edited: !0,
      editedAt: c()
    })
  } catch (e) {
    throw e
  }
};

let _dmTypingUnsub = null, _dmTypingTimer = null, _dmTypingWriteTimer = null;
window.initDmTyping = function(friendUid) {
  const myUid = t.currentUser?.uid;
  if (!myUid || !friendUid || !n) return;
  const chatKey = [myUid, friendUid].sort().join('_');
  const inputs = [
    document.getElementById('home-dm-input'),
    document.getElementById('dm-input')
  ].filter(Boolean);
  inputs.forEach(input => {

    if (input._dmTypingBound) return;
    input._dmTypingBound = true;
    input.addEventListener('input', () => {
      const typRef = y(n, `typing/dm_${chatKey}/${myUid}`);

      clearTimeout(_dmTypingTimer);
      _dmTypingWriteTimer = setTimeout(() => {
        try {
          f(typRef, { name: window.currentUserProfile?.displayName || window.__fb('app_chat.default_sender', 'مستخدم'), ts: Date.now() });
        } catch (e) {}
        clearTimeout(_dmTypingTimer);
        _dmTypingTimer = setTimeout(() => { try { L(typRef); } catch (e) {} }, 3000);
      }, 400);
    });
  });

  if (_dmTypingUnsub) { _dmTypingUnsub(); _dmTypingUnsub = null; }
  const typPath = y(n, `typing/dm_${chatKey}`);
  _dmTypingUnsub = b(typPath, snap => {
    const val = snap.val() || {};
    const now = Date.now();
    const typers = Object.entries(val)
      .filter(([uid, d]) => uid !== myUid && d.ts && (now - d.ts) < 4000)
      .map(([_, d]) => d.name);
    ['dm-typing-indicator','home-dm-typing-indicator'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (typers.length === 0) { el.innerHTML = ''; el.classList.add('hidden'); return; }
      const text = window.__f("js.typing", {name: typers[0]}, `<strong>${typers[0]}</strong> يكتب...`);
      el.innerHTML = `<span class="typing-dots"><span></span><span></span><span></span></span>${text}`;
      el.classList.remove('hidden');
    });
  });
};
window.clearDmTyping = function(friendUid) {
  const myUid = t.currentUser?.uid;
  if (!myUid || !friendUid || !n) return;
  const chatKey = [myUid, friendUid].sort().join('_');
  try { L(y(n, `typing/dm_${chatKey}/${myUid}`)); } catch(e){}
  if (_dmTypingUnsub) { _dmTypingUnsub(); _dmTypingUnsub = null; }
};

(function() {
  const waitForOpenDmPeer = async (timeoutMs = 15000) => {
    const startedAt = Date.now();
    try {
      if (typeof window.loadWebRTCTools === 'function' && !window.webrtcLoaded) await window.loadWebRTCTools();
      if ((!window.peer || window.peer.destroyed || window.peer.disconnected) && typeof window.initPeer === 'function') await window.initPeer();
      else if (window.peer && !window.peer.open && typeof window.rebuildPeer === 'function') window.rebuildPeer('dm-call-peer-not-open');
    } catch (e) { window.foxyLog("warn", '[Foxy][dm-call] Peer initialization wait failed', e); }
    while (Date.now() - startedAt < timeoutMs) {
      const peer = window.peer;
      if (peer && !peer.destroyed && peer.open && peer.id) return peer.id;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  };
    window.startDmGroupCall = async function(customDocId = null, targetParticipants = null, customGroupName = null) {
    const myUid = window.state?.myUid || t.currentUser?.uid;
    if (!myUid) {
      if (typeof window.addSystemMsg === 'function') window.addSystemMsg(window.__fb('app_profile.login_required', 'يجب تسجيل الدخول أولاً'), 'warning');
      return;
    }

    const isCurrentGroup = String(window.currentOpenedDmUid || '').startsWith('group:');
    const groupDocId = customDocId || (isCurrentGroup ? window.currentOpenedDmUid.replace('group:', '') : null) || window.currentChatDocId || window.currentGroupDocId;
    const initialGroupName = customGroupName || window.currentOpenedDmName || document.getElementById('home-dm-header-name')?.innerText?.trim() || window.__fb('js.group_call', 'مكالمة جماعية');
    const callId = `group_${myUid}_${Date.now()}`;

    const bar = document.getElementById('dm-call-voice-bar');
    const header = document.getElementById('dm-chat-header');
    if (bar) { bar.classList.remove('hidden'); bar.classList.add('flex'); }
    if (header) { header.classList.add('hidden'); header.classList.remove('flex'); }
    const statusEl = document.getElementById('dm-voice-status');
    if (statusEl) {
      statusEl.innerText = window.__fb('js.calling_members', 'جاري الاتصال بالأعضاء...');
      statusEl.classList.add('text-emerald-400');
    }

    window.activeDmGroupCallId = callId;
    window.activeDmGroupDocId = groupDocId;
    window.activeDmGroupName = initialGroupName;
    window.isDmCalling = true;
    window.isCallInitiator = true;

    try {
      J('calling', { uid: myUid, displayName: initialGroupName }, Date.now());
    } catch (_) {}

    await yieldDmCallPaint();

    let participantUids = targetParticipants || window.currentGroupParticipants || null;

    if ((!participantUids || !participantUids.length) && Array.isArray(window.activeDmGroupMembers) && window.activeDmGroupMembers.length > 0) {
      participantUids = [myUid, ...window.activeDmGroupMembers.map(m => m.uid).filter(Boolean)];
    }

    if ((!participantUids || !participantUids.length) && groupDocId) {
      try {
        const snap = await w(m(e, 'direct_messages', groupDocId));
        if (snap && snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data?.participants)) participantUids = data.participants;
          if (!window.currentOpenedDmName && data?.groupName) window.currentOpenedDmName = data.groupName;
        }
      } catch (err) {
        window.foxyLog("warn", '[Foxy][dm-group-call] failed to load group doc', err);
      }
    }

    participantUids = [...new Set([myUid, ...(participantUids || [])].filter(Boolean))];
    const otherMembers = participantUids.filter(uid => uid !== myUid);

    if (!otherMembers.length) {
      if (typeof window.addSystemMsg === 'function') window.addSystemMsg(window.__fb('js.no_other_members', 'لا يوجد أعضاء آخرين في المجموعة للاتصال بهم'), 'warning');
      window.hideDmCallOverlay('no_members');
      return;
    }

    const groupName = customGroupName || window.currentOpenedDmName || initialGroupName || window.__f("js.group_call_n", {n: participantUids.length}, `مكالمة جماعية (${participantUids.length})`);
    window.activeDmGroupName = groupName;
    window.activeDmGroupMembers = participantUids.filter(uid => uid !== myUid).map(uid => {
      const friend = window.getFriendData?.(uid) || {};
      return { uid, displayName: friend.displayName || window.__fb('app_chat.default_sender', 'مستخدم'), photoURL: friend.photoURL || '' };
    });

    const groupLeadUid = otherMembers[0] || myUid;
    window.activeCallFriendUid = groupLeadUid;

    if (statusEl) {
      statusEl.innerText = window.__f("js.calling_all", {n: otherMembers.length}, `جاري الاتصال بجميع الأعضاء (${otherMembers.length})...`);
    }
    renderDmVoiceParticipants();

    try {
      const streamPromise = (async () => {
        try {
          if (window.ensureLocalStream) return await window.ensureLocalStream();
          if (navigator.mediaDevices?.getUserMedia) return await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (audioErr) {
          window.foxyLog("warn", '[Foxy][dm-group-call] audio stream initialization warning', audioErr);
        }
      })();

      window.dmGroupStarting = true;
      (async () => {
        try {
          const oldCalls = (await x(y(n, "/active_calls"))).val() || {};
          await Promise.all(Object.entries(oldCalls).filter(([, call]) => call && call.initiator === myUid && Date.now() - (call.startTime || 0) > 60000).map(([cId]) => L(y(n, `/active_calls/${cId}`))));
        } catch (_) {} finally { window.dmGroupStarting = false; }
      })();

      const [myPeerId] = await Promise.all([waitForOpenDmPeer(), streamPromise]);
      if (!myPeerId) {
        if (typeof window.addSystemMsg === 'function') window.addSystemMsg(window.__fb('js.voice_init_fail', 'تعذر تهيئة الاتصال الصوتي. أعد المحاولة.'), 'error');
        window.hideDmCallOverlay('peer_failed');
        return;
      }

      let resolvedDocId = groupDocId;
      if (!resolvedDocId) {
        const groupDoc = await a(i(e, 'direct_messages'), {
          participants: participantUids,
          isGroup: true,
          groupName,
          createdBy: myUid,
          timestamp: c()
        });
        resolvedDocId = groupDoc.id;
        window.activeDmGroupDocId = resolvedDocId;
      }

      const groupRef = y(n, `/group_calls/${callId}`);
      await f(groupRef, {
        callId,
        groupDocId: resolvedDocId,
        groupName,
        callerUid: myUid,
        callerPeerId: myPeerId,
        participants: participantUids.reduce((all, uid) => {
          all[uid] = { uid, status: uid === myUid ? 'active' : 'ringing' };
          return all;
        }, {}),
        status: 'calling',
        timestamp: Date.now()
      });

      await Promise.all(otherMembers.map(uid => f(y(n, `/incoming_calls/${uid}`), {
        callerUid: myUid,
        callerName: window.currentUserProfile?.displayName || window.__fb('app_chat.default_sender', 'مستخدم'),
        callerPeerId: myPeerId,
        groupCallId: callId,
        groupDocId: resolvedDocId,
        groupName,
        groupParticipants: participantUids,
        timestamp: Date.now()
      })));

      if (resolvedDocId) addDmGroupEvent(resolvedDocId, "started", []).catch(() => {});

      window.foxyLog("info", '[Foxy][dm-group-call] successfully ringing all group members', { callId, groupDocId: resolvedDocId, otherMembers });
    } catch (error) {
      window.foxyLog("error", '[Foxy][dm-group-call] failed to call group members', error);
      if (typeof window.addSystemMsg === 'function') window.addSystemMsg(window.__fb('js.call_finish_fail', 'تعذر إكمال الاتصال بالأعضاء.'), 'error');
      window.hideDmCallOverlay('call_failed');
    }
  };

  const bindDmCallBtn = () => {
    const btn = document.getElementById('dm-call-btn');
    if (!btn || btn._dmCallBound) return;
    btn._dmCallBound = true;
    btn.onclick = null;
    btn.addEventListener('click', async () => {
      const isGroup = String(window.currentOpenedDmUid || '').startsWith('group:') && !!window.currentGroupDocId;
      if (isGroup) {
        deferDmCallWork(() => window.foxyLog("info", '[Foxy][dm-call] group chat selected; calling all members directly', { currentUid: window.currentOpenedDmUid, groupDocId: window.currentChatDocId }));
        await window.startDmGroupCall();
        return;
      }
      let friendUid = window.currentOpenedDmUid || document.querySelector('.sidebar-dm-item-active')?.getAttribute('data-uid') || window.activeCallFriendUid;
      if (!friendUid) {
        const hdr = document.getElementById('home-dm-header-name');
        if (hdr && hdr.dataset && hdr.dataset.uid) friendUid = hdr.dataset.uid;
      }
      if (!friendUid) {
        const dmPanel = document.getElementById('home-inline-dm');
        if (dmPanel) {
          const activeDm = document.querySelector('.sidebar-dm-item-active');
          if (activeDm) friendUid = activeDm.getAttribute('data-uid');
        }
      }
      if (!friendUid) {
        try { const parts = window.location.pathname.split('/'); const last = parts[parts.length-1]; if (last && last.length > 10) friendUid = last; } catch(e) {}
      }
      if (String(friendUid || '').startsWith('group:')) {
        await window.startDmGroupCall();
        return;
      }
      if (!friendUid || friendUid === (window.state && window.state.myUid)) {
        window.foxyLog("warn", '[Foxy][dm-call] No valid friend UID', {friendUid, myUid: window.state && window.state.myUid});
        if (typeof window.addSystemMsg === 'function') window.addSystemMsg(window.__fb('js.no_user_call', 'لم يتم العثور على المستخدم للمكالمة'), 'warning');
        return;
      }
      const friendName = window.currentOpenedDmName || document.getElementById('home-dm-header-name')?.innerText?.trim() || window.__fb('js.friend', 'صديق');
      deferDmCallWork(() => window.foxyLog("info", '[Foxy][dm-call] Initiating', {friendUid, friendName}));
      try { if (typeof J === 'function') J('calling', {uid: friendUid, displayName: friendName}); else if (typeof window.showDmCallOverlay === 'function') window.showDmCallOverlay('calling', {uid: friendUid, displayName: friendName}); } catch(e) {}
      try {
        const bar = document.getElementById('dm-call-voice-bar');
        const header = document.getElementById('dm-chat-header');
        if (bar) { bar.classList.remove('hidden'); bar.classList.add('flex'); }
        if (header) { header.classList.add('hidden'); header.classList.remove('flex'); }
        window.isDmCalling = true; window.activeCallFriendUid = friendUid;
        const statusEl = document.getElementById('dm-voice-status');
        if (statusEl) { statusEl.innerText = window.__fb('js.st_connecting', 'جاري الاتصال...'); statusEl.classList.add('text-emerald-400'); }
      } catch(e) {}
      try {
        const myUid = (window.state && window.state.myUid) || (t && t.currentUser && t.currentUser.uid);
        if (!myUid) throw new Error('No myUid');
        await yieldDmCallPaint();
        const myPeerId = await waitForOpenDmPeer();
        if (!myPeerId) throw new Error('Peer is not ready');
        const callId = (typeof V === 'function' ? V(myUid, friendUid) : Date.now().toString());
        const incRef = y(n, '/incoming_calls/' + friendUid);
        await f(incRef, { callerUid: myUid, callerName: friendName, callerPeerId: myPeerId, timestamp: Date.now() });
        const actRef = y(n, '/active_calls/' + callId);
        await f(actRef, { initiator: myUid, receiver: friendUid, initiatorPeerId: myPeerId, receiverPeerId: window.uidToPeerIdMap?.[friendUid] || null, status: 'calling', startTime: Date.now() });
        window.isCallInitiator = true;
        window.foxyLog("info", '[Foxy][dm-call] Signaled via Firebase', {friendUid});

        try {
          const _stream = await (window.ensureLocalStream ? window.ensureLocalStream() : navigator.mediaDevices.getUserMedia({audio:true}));
          let _calleePeerId = window.uidToPeerIdMap?.[friendUid] || friendUid;

          try {
            const _snap = await x(y(n, '/active_calls/' + callId)).then(s=>s.val()).catch(()=>null);
            if (_snap && _snap.receiverPeerId) _calleePeerId = _snap.receiverPeerId;
          } catch(_e) {}
          if (_calleePeerId && _calleePeerId !== friendUid) {
            const _call = window.peer ? window.peer.call(_calleePeerId, _stream) : null;
            if (_call && typeof window.handleCall === 'function') window.handleCall(_call);
            else if (_call && typeof handleCall === 'function') handleCall(_call);
          } else {
            window.foxyLog("info", '[Foxy][dm-call] Waiting for callee to call back (no peerId yet)');
          }
        } catch(_e) { window.foxyLog("warn", '[Foxy][dm-call] peer.call failed', _e?.message || _e); }
      } catch (e) {
        window.foxyLog("error", '[Foxy][dm-call] Failed to signal', e);
        if (typeof window.addSystemMsg === 'function') window.addSystemMsg(window.__f('js.friend_call_fail', {err: (e.message||e)}, 'فشل بدء المكالمة: ' + (e.message||e)), 'error');
      }
    });
  };
  const bindDmPresenceControls = () => {
    const controls = document.getElementById("dm-voice-controls");
    if (controls && !document.getElementById("dm-voice-screen-btn")) {
      const screenBtn = document.createElement("button");
      screenBtn.id = "dm-voice-screen-btn";
      screenBtn.className = "w-9 h-9 flex items-center justify-center rounded-xl text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-all";
      screenBtn.title = window.__fb("app_voice.screen_share", "مشاركة الشاشة");
      screenBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h18v12H3zM8 21h8M12 17v4"/></svg>';
      screenBtn.onclick = () => {
        if (window.isScreenSharing) {
          if (typeof window.stopScreenShare === "function") window.stopScreenShare();
        } else if (typeof window.openScreenSettings === "function") window.openScreenSettings();
      };
      controls.insertBefore(screenBtn, document.getElementById("dm-voice-mute-btn"));
    }
    ["toggleMute", "toggleDeafen"].forEach(name => {
      const fn = window[name];
      if (typeof fn !== "function" || fn._dmPresenceWrapped) return;
      const wrapped = function(...args) {
        const result = fn.apply(this, args);
        setTimeout(() => updateDmPresence({ muted: !!window.isMuted, deafened: !!window.isDeafened, screenActive: !!window.isScreenSharing }), 0);
        return result;
      };
      wrapped._dmPresenceWrapped = true;
      window[name] = wrapped;
    });
  };
  const openGroupCallPicker = () => {
    const currentUid = window.currentOpenedDmUid;
    const friends = typeof window.getAllFriendTargets === 'function' ? window.getAllFriendTargets() : [];
    const myUid = window.state?.myUid || t.currentUser?.uid;
    const currentGroupMembers = new Set((window.currentGroupParticipants || []).filter(uid => uid && uid !== myUid));
    let modal = document.getElementById('dm-group-call-picker');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dm-group-call-picker';
      modal.className = 'fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-sm';
      document.body.appendChild(modal);
    }
    const isCurrentGroup = String(currentUid || '').startsWith('group:') && !!window.currentGroupDocId;
    const activeCall = !!window.activeDmGroupCallId;
    const alreadyIncluded = isCurrentGroup
      ? new Set(activeCall ? (window.activeDmGroupMembers || []).map(member => member.uid) : currentGroupMembers)
      : new Set();
    const targets = friends.filter(friend => friend.id && friend.id !== myUid && !alreadyIncluded.has(friend.id));
    if (!targets.length) return void alert(isCurrentGroup ? window.__fb('js.no_new_members', 'لا يوجد أعضاء جدد لإضافتهم.') : window.__fb('js.no_avail_friends', 'لا يوجد أصدقاء متاحون للمكالمة الجماعية.'));
    const selectedByDefault = new Set(currentUid && !isCurrentGroup ? [currentUid] : []);
    const anyActiveCall = !!window.isDmCalling;
    const pickerTitle = isCurrentGroup ? (activeCall ? window.__fb('js.pick_title_add_call', 'إضافة أعضاء للمكالمة') : window.__fb('js.pick_title_add_group', 'إضافة أعضاء للمجموعة')) : (anyActiveCall ? window.__fb('js.pick_title_add_people', 'إضافة أشخاص للمكالمة') : window.__fb('js.pick_title_start', 'إضافة أشخاص للمكالمة الجماعية'));
    const pickerHint = isCurrentGroup ? (activeCall ? window.__fb('js.pick_hint_call', 'اختر أشخاصًا لدعوتهم إلى المكالمة الحالية') : window.__fb('js.pick_hint_group', 'اختر الأصدقاء الذين تريد إضافتهم إلى المجموعة')) : window.__fb('js.pick_hint_start', 'اختر الأصدقاء ثم اضغط بدء الاتصال');
    const pickerAction = isCurrentGroup ? (activeCall ? window.__fb('js.pick_action_invite', 'دعوة للمكالمة') : window.__fb('js.pick_action_add', 'إضافة أعضاء')) : window.__fb('js.pick_action_start', 'بدء الاتصال');
    modal.innerHTML = `<div class="w-full max-w-md mx-4 bg-[#171923]/95 border border-blue-400/20 rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,.55)] overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="dm-group-call-title"><div class="p-5 bg-gradient-to-l from-blue-500/15 via-transparent to-emerald-500/10 border-b border-white/10 flex items-center justify-between"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-300 flex items-center justify-center"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m8-6a4 4 0 100-8 4 4 0 000 8m6-3v6m3-3h-6"/></svg></div><div><h3 id="dm-group-call-title" class="text-white font-bold">${pickerTitle}</h3><p class="text-[11px] text-gray-400 mt-1">${pickerHint}</p></div></div><button type="button" data-group-close class="w-9 h-9 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 text-xl transition">×</button></div><div class="px-5 pt-4 flex items-center justify-between"><span class="text-xs text-gray-400">${window.__fb("js.avail_friends", "الأصدقاء المتاحون")}</span><span data-group-count class="text-xs text-blue-300 font-bold"></span></div><div class="p-4 max-h-80 overflow-y-auto space-y-2 custom-scroll">${targets.map(friend => { const checked = selectedByDefault.has(friend.id); return `<label class="flex items-center gap-3 p-3 rounded-2xl border border-white/5 bg-white/[.03] hover:bg-blue-500/10 hover:border-blue-400/30 cursor-pointer transition"><input type="checkbox" value="${escapeForAttribute(friend.id)}" class="dm-group-target w-4 h-4 accent-blue-500" ${checked ? 'checked' : ''}><span class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-xs text-gray-200">${escapeForAttribute((friend.name || window.__fb('app_chat.default_sender', 'مستخدم')).trim().charAt(0))}</span><span class="text-sm text-gray-200 flex-1">${escapeForAttribute(friend.name || window.__fb('app_chat.default_sender', 'مستخدم'))}</span><span class="dm-group-check text-blue-300 ${checked ? '' : 'hidden'}">✓</span></label>`; }).join('')}</div><div class="p-5 border-t border-white/10 flex items-center justify-end gap-2 bg-black/10"><button type="button" data-group-close class="px-4 py-2.5 text-sm text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition">إلغاء</button><button type="button" data-group-start class="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/30 transition">${pickerAction}</button></div></div>`;
    modal.classList.remove('hidden');
    modal.querySelectorAll('[data-group-close]').forEach(btn => btn.onclick = () => modal.remove());
    const updatePickerState = () => {
      const checks = [...modal.querySelectorAll('.dm-group-target')];
      const count = checks.filter(input => input.checked).length;
      const countEl = modal.querySelector('[data-group-count]');
      if (countEl) countEl.textContent = window.__f("js.selected_n", {n: count}, `${count} محدد`);
      checks.forEach(input => input.closest('label')?.querySelector('.dm-group-check')?.classList.toggle('hidden', !input.checked));
    };
    modal.querySelectorAll('.dm-group-target').forEach(input => input.addEventListener('change', updatePickerState));
    modal.onclick = event => { if (event.target === modal) modal.remove(); };
    updatePickerState();
    modal.querySelector('[data-group-start]').onclick = async () => {
      const selected = [...modal.querySelectorAll('.dm-group-target:checked')].map(input => input.value);
      const myUid = window.state?.myUid || t.currentUser?.uid;
      if ((!window.activeDmGroupCallId && selected.length < 2) || (window.activeDmGroupCallId && !selected.length) || !myUid) return void alert(window.activeDmGroupCallId ? window.__fb('js.pick_one', 'اختر شخصًا واحدًا على الأقل.') : window.__fb('js.pick_two', 'اختر صديقين على الأقل.'));
      if (window.activeDmGroupCallId) {
        const existing = new Set((window.activeDmGroupMembers || []).map(member => member.uid).concat(myUid));
        const additions = selected.filter(uid => !existing.has(uid));
        if (!additions.length) return void alert(window.__fb('js.already_in_call', 'الأصدقاء المحددون موجودون بالفعل في المكالمة.'));
        try {
          const groupRef = y(n, `/group_calls/${window.activeDmGroupCallId}`);
          const newMembers = additions.reduce((all, uid) => (all[uid] = { uid, status: 'ringing' }, all), {});
          await I(groupRef, { [`participants`]: [...existing, ...additions].reduce((all, uid) => (all[uid] = { uid, status: uid === myUid ? 'active' : (existing.has(uid) ? 'active' : 'ringing') }, all), {}) });
          for (const uid of additions) await f(y(n, `/incoming_calls/${uid}`), { callerUid: myUid, callerName: window.currentUserProfile?.displayName || window.__fb('app_chat.default_sender', 'مستخدم'), callerPeerId: window.peer?.id || window.myId, groupCallId: window.activeDmGroupCallId, groupDocId: window.activeDmGroupDocId || null, groupName: window.activeDmGroupName || window.__fb('js.group_call', 'مكالمة جماعية'), groupParticipants: [...existing, ...additions], timestamp: Date.now() });
          window.activeDmGroupMembers = [...(window.activeDmGroupMembers || []), ...additions.map(uid => { const member = window.getFriendData?.(uid) || {}; return { uid, displayName: member.displayName || window.__fb('app_chat.default_sender', 'مستخدم'), photoURL: member.photoURL || '' }; })];
          await addDmGroupEvent(window.activeDmGroupDocId, "added", additions.map(uid => (window.getFriendData?.(uid) || {}).displayName || window.__fb("app_chat.default_sender", "مستخدم")));
          modal.remove(); renderDmVoiceParticipants();
          window.foxyLog("info", '[Foxy][dm-group-call] participants added', { callId: window.activeDmGroupCallId, additions });
        } catch (error) { window.foxyLog("error", '[Foxy][dm-group-call] add participants failed', error); alert(window.__fb('js.add_failed', 'تعذر إضافة المشاركين.')); }
        return;
      }
      if (isCurrentGroup) {
        const existing = new Set((window.currentGroupParticipants || []).filter(Boolean));
        const additions = selected.filter(uid => !existing.has(uid));
        if (!additions.length) return void alert(window.__fb('js.pick_new', 'اختر عضوًا جديدًا لإضافته إلى المجموعة.'));
        try {
          const groupRef = m(e, 'direct_messages', window.currentGroupDocId);
          const updatedParticipants = [...existing, ...additions];
          await u(groupRef, { participants: updatedParticipants, isGroup: true }, { merge: true });
          window.currentGroupParticipants = updatedParticipants;
          window.activeDmGroupMembers = updatedParticipants.filter(uid => uid !== myUid).map(uid => { const member = window.getFriendData?.(uid) || {}; return { uid, displayName: member.displayName || window.__fb('app_chat.default_sender', 'مستخدم'), photoURL: member.photoURL || '' }; });
          await addDmGroupEvent(window.currentGroupDocId, 'added', additions.map(uid => (window.getFriendData?.(uid) || {}).displayName || window.__fb('app_chat.default_sender', 'مستخدم')));
          modal.remove();
          syncDmGroupMembersButton();
          renderDmVoiceParticipants();
          if (typeof window.refreshDmSidebar === 'function') window.refreshDmSidebar();
        } catch (error) { window.foxyLog("error", '[Foxy][dm-group] add members failed', error); alert(window.__fb('js.add_members_fail', 'تعذر إضافة الأعضاء.')); }
        return;
      }
      modal.remove();
      await window.startDmGroupCall(null, selected);
    };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { bindDmCallBtn(); bindDmPresenceControls(); });
  else { bindDmCallBtn(); bindDmPresenceControls(); }
  document.addEventListener('click', async event => {
    if (event.target.closest('#dm-group-call-btn')) {

      openGroupCallPicker();
    } else if (event.target.closest('#dm-group-add-btn')) {
      openGroupCallPicker();
    }
  });
  setInterval(() => { bindDmCallBtn(); bindDmPresenceControls(); }, 2000);
})();
