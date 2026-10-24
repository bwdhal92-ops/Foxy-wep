import {
  createAvatarHTML as e,
  createAvatarWrapper as t
} from "./ui-avatar-banner.js?v=20260929-2";
import { setSafeInnerHTML, escapeForAttribute, escapeForJsString } from "./sanitize.js";

const EMOJI_SHORTCODES = {};

(async function loadEmojiShortcodes() {
  try {
    const res = await fetch("assets/data/emoji-shortcodes.json");
    if (res.ok) {
      const data = await res.json();
      Object.assign(EMOJI_SHORTCODES, data);
      Object.assign(window.EMOJI_SHORTCODES, data);
    } else throw new Error("HTTP " + res.status);
  } catch (e) {
    console.warn("\u0641\u0634\u0644 \u062a\u062d\u0645\u064a\u0644 emoji-shortcodes.json:", e);
  }
})();

window.EMOJI_SHORTCODES = EMOJI_SHORTCODES;
const n = {
    activeInput: null,
    query: "",
    selectedIndex: 0,
    suggestions: [],
    isOpen: !1,
    mode: "mentions",
    selectedTimestamp: 0,
    activeRange: null
  },
  o = {
    "home-dm-input": [],
    "server-chat-input": [],
    "chat-msg-input": [],
    "dm-input": []
  };
const oneTimeByTarget = {};
let i = "true" === localStorage.getItem("uploadHighQuality");
export function toggleUploadQuality() {
  i = !i, localStorage.setItem("uploadHighQuality", i.toString()), a();
  const e = i ? window.__fb("js.upload_hq", "جودة أصلية (HQ)") : window.__fb("js.upload_comp", "توفير بيانات (Compressed)");
  window.addSystemMsg && window.addSystemMsg(window.__fb("app_chat.upload_mode_changed", "تم تغيير وضع الرفع إلى: ") + e, "info")
}

function a() {
  const e = "text-emerald-500",
    t = "text-gray-500";
  document.querySelectorAll("[data-composer-role='quality']").forEach(n => {
    const o = n;
    i ? (o.classList.remove(t), o.classList.add(e), o.title = window.__fb("js.upload_hq_on", "جودة أصلية (HQ) - مفعل")) : (o.classList.remove(e), o.classList.add(t), o.title = window.__fb("js.upload_comp_on", "توفير بيانات (Compressed) - مفعل"))
  })
}
window.toggleUploadQuality = toggleUploadQuality;
window.toggleOneTimeImage = function(targetId) {
  if (!targetId) return false;
  const attachments = o[targetId] || [];
  if (!attachments.length) return false;
  const enable = !attachments.every(item => item.oneTime);
  attachments.forEach(item => { item.oneTime = enable; });
  oneTimeByTarget[targetId] = enable;
  const button = document.querySelector(`[data-one-time-target="${CSS.escape(targetId)}"]`);
  if (button) {
    button.classList.toggle("text-amber-400", oneTimeByTarget[targetId]);
    button.classList.toggle("text-gray-500", !oneTimeByTarget[targetId]);
    button.setAttribute("aria-pressed", String(oneTimeByTarget[targetId]));
    button.title = oneTimeByTarget[targetId] ? window.__fb("js.once_title_on", "صورة تُفتح مرة واحدة - مفعّل") : window.__fb("js.once_title", "صورة تُفتح مرة واحدة");
  }
  window.addSystemMsg?.(enable ? window.__fb("js.once_msg_on", "سيتم إرسال الصور المحددة كصور تُفتح مرة واحدة.") : window.__fb("js.once_msg_off", "تم إلغاء وضع الفتح مرة واحدة للصور المحددة."), "info");
  d(targetId);
  return enable;
};
window.toggleServerComposerMenu = function(event) {
  event?.stopPropagation();
  window.foxyComposerToggleMenu?.('server-chat-input', event);
};
window.chooseServerComposerAction = function(action, targetId) {
  window.foxyComposerCloseMenus?.();
  var target = targetId || 'server-chat-input';
  if (action === 'smart') {

    if (window.FoxyMedia?.openPicker) { window.FoxyMedia.openPicker(target); return; }
    action = 'image';
  }
  if (action === 'image') {

    if (typeof window.foxyPickImage === 'function') {
      window.foxyPickImage(target);
      return;
    }
    const input = document.getElementById('image-upload-input');
    input?.setAttribute('data-target', target);
    input?.click();
    return;
  }
  if (action === 'media') {
    window.FoxyMedia?.openPicker(target);
    return;
  }
  if (action === 'voice') {
    window.toggleVoiceRecord?.(target);
    return;
  }
  if (action === 'poll') {
    if (target !== 'server-chat-input') {
      window.addSystemMsg?.(window.__fb('js.poll_server_only', 'إنشاء التصويت متاح في قنوات السيرفر فقط.'), 'info');
      return;
    }
    if (typeof window.openCreatePoll === 'function') window.openCreatePoll();
    else window.addSystemMsg?.(window.__fb('js.poll_disabled', 'ميزة إنشاء التصويت غير مفعلة في هذا السيرفر حالياً.'), 'info');
  }
};

const POLL_MIN_OPTIONS = 2, POLL_MAX_OPTIONS = 6;
let pollModalListenersBound = false;
function pollDenyMessage(ctx) {
  const r = ctx?.reason;
  if (r === "timeout") return window.__f("js.timeout_write", { mins: ctx.mins || 1 }, `لا يمكنك الكتابة. أنت مقيد (Timeout) لمدة ${ctx.mins || 1} دقيقة أخرى.`);
  if (r === "no-send") return window.__fb("js.no_send_perm", "لا تملك صلاحية إرسال الرسائل في هذه القناة.");
  if (r === "no-perm") return window.__fb("js.no_poll_perm", "لا تملك صلاحية إنشاء استطلاعات رأي في هذه القناة.");
  if (r === "locked") return window.__fb("js.chan_locked", "هذه القناة مغلقة للكتابة حالياً.");
  if (r === "no-channel") return window.__fb("js.no_text_channel", "اختر قناة كتابية أولاً.");
  return window.__fb("js.poll_unavailable", "تعذر فتح إنشاء التصويت حالياً.");
}
function refreshPollOptionButtons() {
  const box = document.getElementById("poll-options");
  if (!box) return;
  const rows = box.querySelectorAll(".poll-option-row");
  rows.forEach((row, i) => {
    const btn = row.querySelector(".poll-option-remove");
    if (btn) btn.style.display = rows.length > POLL_MIN_OPTIONS ? "" : "none";
    const inp = row.querySelector("input");
    if (inp) inp.placeholder = `الخيار ${i + 1}`;
  });
  const addBtn = document.getElementById("poll-add-option-btn");
  if (addBtn) addBtn.style.display = rows.length >= POLL_MAX_OPTIONS ? "none" : "";
}
window.addPollOptionInput = function(value = "") {
  const box = document.getElementById("poll-options");
  if (!box || box.children.length >= POLL_MAX_OPTIONS) return;
  const row = document.createElement("div");
  row.className = "poll-option-row flex gap-2";
  const inp = document.createElement("input");
  inp.type = "text"; inp.maxLength = 80; inp.value = value || "";
  inp.className = "poll-option-input flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-[16px] sm:text-sm focus:outline-none focus:border-emerald-500/50 text-white placeholder-gray-600 transition";
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); window.submitPoll?.(); } });
  const del = document.createElement("button");
  del.type = "button"; del.className = "poll-option-remove w-11 shrink-0 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition";
  del.title = "حذف الخيار";
  del.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
  del.addEventListener("click", () => { row.remove(); refreshPollOptionButtons(); });
  row.appendChild(inp); row.appendChild(del); box.appendChild(row);
  refreshPollOptionButtons();
};
window.openCreatePoll = function() {
  const ctx = typeof window.getServerComposerContext === "function" ? window.getServerComposerContext("create_polls") : { ok: true };
  if (!ctx.ok) { alert(pollDenyMessage(ctx)); return; }
  const modal = document.getElementById("poll-create-modal");
  if (!modal) return;
  const q = document.getElementById("poll-question");
  if (q) { q.value = ""; q.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); window.submitPoll?.(); } }; }
  const box = document.getElementById("poll-options");
  if (box) box.innerHTML = "";
  window.addPollOptionInput(); window.addPollOptionInput();
  modal.classList.remove("hidden"); modal.classList.add("flex");
  if (!pollModalListenersBound) {
    pollModalListenersBound = true;
    modal.addEventListener("click", e => { if (e.target === modal) window.closePollModal(); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && !document.getElementById("poll-create-modal")?.classList.contains("hidden")) window.closePollModal();
      if (e.key === "Escape" && !document.getElementById("poll-voters-modal")?.classList.contains("hidden")) window.closePollVoters();
    });
  }
  setTimeout(() => document.getElementById("poll-question")?.focus(), 60);
};
window.closePollModal = function() {
  const modal = document.getElementById("poll-create-modal");
  if (!modal) return;
  modal.classList.add("hidden"); modal.classList.remove("flex");
};
window.submitPoll = async function() {
  const ctx = typeof window.getServerComposerContext === "function" ? window.getServerComposerContext("create_polls") : null;
  if (!ctx || !ctx.ok) { alert(pollDenyMessage(ctx || {})); return; }
  const qInput = document.getElementById("poll-question");
  const question = (qInput?.value || "").trim().slice(0, 140);
  const options = [...document.querySelectorAll("#poll-options .poll-option-input")].map(i => (i.value || "").trim()).filter(Boolean).slice(0, POLL_MAX_OPTIONS);
  if (question.length < 2) { alert(window.__fb("js.poll_q_short", "اكتب سؤال التصويت أولاً.")); qInput?.focus(); return; }
  if (options.length < POLL_MIN_OPTIONS) { alert(window.__fb("js.poll_need_options", "أضف خيارين على الأقل للتصويت.")); return; }
  const btn = document.getElementById("poll-submit-btn");
  btn && (btn.disabled = true, btn.classList.add("opacity-50"));
  try {
    const { getDb } = await import("../firebase-config.js");
    const { collection, doc, addDoc, updateDoc, serverTimestamp, increment } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
    const db = getDb();
    if (!db) throw new Error("db-not-ready");
    const msgCol = collection(db, "servers", ctx.serverId, "channels", ctx.channelId, "messages");
    await addDoc(msgCol, {
      text: `📊 ${question}`,
      senderUid: ctx.myUid,
      senderName: ctx.displayName || "User",
      senderPhotoURL: ctx.photoURL || "",
      timestamp: serverTimestamp(),
      poll: { question, options, votes: {}, createdBy: ctx.myUid }
    });
    await Promise.all([
      updateDoc(doc(db, "servers", ctx.serverId, "channels", ctx.channelId), { messageCount: increment(1), lastMessageTimestamp: serverTimestamp() }),
      updateDoc(doc(db, "servers", ctx.serverId), { [`channelMessageCounts.${ctx.channelId}`]: increment(1), totalMessageCount: increment(1), updatedAt: serverTimestamp() })
    ]);
    window.closePollModal();
  } catch (e) {
    console.error("[poll] submit failed:", e);
    alert(window.__fb("js.send_fail", "فشل إرسال الرسالة"));
  } finally {
    btn && (btn.disabled = false, btn.classList.remove("opacity-50"));
  }
};
window.votePoll = async function(messageId, optionIdx, context) {
  try {
    if (context && context !== "server") return;
    const st = window.state;
    const sid = st?.activeServerId, cid = st?.activeChannelId, uid = st?.myUid;
    if (!sid || !cid || !uid || !messageId) return;
    const idx = Number(optionIdx);
    if (!Number.isInteger(idx) || idx < 0 || idx > POLL_MAX_OPTIONS - 1) return;
    const mem = st.serverMembersData?.[uid];
    if (mem && mem.timeoutUntil && mem.timeoutUntil > Date.now()) {
      alert(window.__f("js.timeout_write", { mins: Math.ceil((mem.timeoutUntil - Date.now()) / 6e4) }, "لا يمكنك الكتابة. أنت مقيد (Timeout)."));
      return;
    }
    const { getDb } = await import("../firebase-config.js");
    const { doc, getDoc, updateDoc, deleteField } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
    const db = getDb();
    if (!db) return;
    const ref = doc(db, "servers", sid, "channels", cid, "messages", messageId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const poll = snap.data()?.poll;
    if (!poll || !Array.isArray(poll.options) || idx >= poll.options.length) return;
    const cur = poll.votes?.[uid];
    if (Number(cur) === idx) await updateDoc(ref, { [`poll.votes.${uid}`]: deleteField() });
    else await updateDoc(ref, { [`poll.votes.${uid}`]: idx });
  } catch (e) {
    console.warn("[poll] vote failed:", e);
  }
};
function pollEsc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
window.closePollVoters = function() {
  const m = document.getElementById("poll-voters-modal");
  if (!m) return;
  m.classList.add("hidden"); m.classList.remove("flex");
};
window.showPollVoters = async function(messageId, context) {
  try {
    if (context && context !== "server") return;
    const st = window.state;
    const sid = st?.activeServerId, cid = st?.activeChannelId;
    if (!sid || !cid || !messageId) return;
    const modal = document.getElementById("poll-voters-modal");
    const list = document.getElementById("poll-voters-list");
    const sub = document.getElementById("poll-voters-sub");
    if (!modal || !list) return;
    list.innerHTML = '<div class="flex items-center justify-center py-8"><div class="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>';
    if (sub) sub.textContent = "";
    modal.classList.remove("hidden"); modal.classList.add("flex");
    const { getDb } = await import("../firebase-config.js");
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
    const db = getDb();
    if (!db) throw new Error("db-not-ready");
    const snap = await getDoc(doc(db, "servers", sid, "channels", cid, "messages", messageId));
    if (!snap.exists() || !snap.data()?.poll) {
      list.innerHTML = '<p class="text-xs text-gray-500 text-center py-6">التصويت غير موجود.</p>';
      return;
    }
    const poll = snap.data().poll;
    const options = (Array.isArray(poll.options) ? poll.options : []).map(o => String(o ?? "")).slice(0, 6);
    const votes = (poll.votes && typeof poll.votes === "object" && !Array.isArray(poll.votes)) ? poll.votes : {};
    const byOption = options.map(() => []);
    Object.entries(votes).forEach(([uid, v]) => {
      const i = Number(v);
      if (Number.isInteger(i) && i >= 0 && i < byOption.length) byOption[i].push(uid);
    });
    const total = Object.keys(votes).length;
    if (sub) sub.textContent = `${poll.question || ""} · ${total === 1 ? "صوت واحد" : (total === 2 ? "صوتان" : `${total} صوت`)}`;
    if (!total) {
      list.innerHTML = '<p class="text-xs text-gray-500 text-center py-6">لا توجد أصوات بعد — كن أول من يصوت.</p>';
      return;
    }
    const nameOf = async (uid) => {
      try {
        const m1 = st.serverMembersData?.[uid];
        if (m1?.displayName || m1?.name) return m1.displayName || m1.name;
        const m2 = st.globalUsersData?.[uid];
        if (m2?.displayName || m2?.name) return m2.displayName || m2.name;
        const u = await getDoc(doc(db, "users", uid));
        if (u.exists() && u.data()?.displayName) return u.data().displayName;
      } catch (e) {}
      return "مستخدم";
    };
    const groups = [];
    for (let i = 0; i < byOption.length; i++) {
      if (!byOption[i].length) continue;
      const uids = byOption[i];
      const names = await Promise.all(uids.map(nameOf));
      groups.push({ i, voters: uids.map((u, k) => ({ uid: u, name: names[k] })) });
    }
    const myUid = st?.myUid;
    list.innerHTML = groups.map(g => {
      const rows = g.voters.map(v => {
        const ch = pollEsc(v.name).trim().charAt(0) || "?";
        const isMe = myUid && v.uid === myUid;
        return `<div class="flex items-center gap-2.5 py-1.5"><span class="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center text-xs font-black shrink-0">${ch}</span><span class="text-xs font-bold text-gray-200 break-words flex-1">${pollEsc(v.name)}${isMe ? ' <span class="text-[9px] font-black text-emerald-400">· أنت</span>' : ""}</span></div>`;
      }).join("");
      return `<div class="bg-black/20 border border-white/5 rounded-xl p-3"><p class="text-xs font-black text-white mb-1 break-words">${pollEsc(options[g.i])} <span class="text-[10px] font-bold text-emerald-400">· ${g.voters.length}</span></p><div class="divide-y divide-white/5">${rows}</div></div>`;
    }).join("");
  } catch (e) {
    console.warn("[poll] voters failed:", e);
    const list = document.getElementById("poll-voters-list");
    if (list) list.innerHTML = '<p class="text-xs text-gray-500 text-center py-6">تعذر تحميل المصوتين.</p>';
  }
};
const r = [{
    id: "everyone",
    name: "everyone",
    get arabic() { return window.__fb("app_chat.mention_everyone", "الجميع"); },
    type: "command",
    get desc() { return window.__fb("app_chat.mention_everyone_desc", "إشارة للجميع في هذه القناة"); }
  }, {
    id: "here",
    name: "here",
    get arabic() { return window.__fb("app_chat.mention_online", "المتواجدون"); },
    type: "command",
    get desc() { return window.__fb("app_chat.mention_online_desc", "إشارة للمتواجدين حالياً"); }
  }, {
    id: "time",
    name: "time",
    get arabic() { return window.__fb("app_chat.mention_time", "الوقت الحالي"); },
    type: "command",
    get desc() { return window.__fb("app_chat.mention_time_desc", "إدراج توقيت ديناميكي يظهر حسب المنطقة الزمنية للمشاهد"); }
  }],
  s = [{
    code: "t",
    name: "Short Time",
    desc: "1:12 PM"
  }, {
    code: "T",
    name: "Long Time",
    desc: "1:12:11 PM"
  }, {
    code: "d",
    name: "Short Date",
    desc: "3/19/2026"
  }, {
    code: "D",
    name: "Long Date",
    desc: "March 19, 2026"
  }, {
    code: "f",
    name: "Short Date/Time",
    desc: "March 19, 2026 1:12 PM"
  }, {
    code: "F",
    name: "Long Date/Time",
    desc: "Thursday, March 19, 2026 1:12 PM"
  }, {
    code: "R",
    name: "Relative Time",
    desc: "2 minutes ago"
  }];

function h() {
  n.isOpen = false;
  n.suggestions = [];
  n.selectedIndex = 0;
  const popup = document.getElementById("mention-autocomplete-popup");
  if (popup) popup.classList.add("hidden");
}

function g() {
  const list = document.getElementById("mention-list-container");
  if (!list) return;
  list.textContent = "";
  n.suggestions.forEach((item, index) => {
    const button = document.createElement("button");
    const label = item.emoji || item.displayName || item.name || item.id || "";
    button.type = "button";
    button.className = `w-full flex items-center gap-2 px-2 py-1.5 rounded text-left ${index === n.selectedIndex ? "bg-white/10" : "hover:bg-white/5"}`;
    button.textContent = item.emoji ? `${item.emoji} ${label}` : label;
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", () => w(item));
    list.appendChild(button);
  });
}

function w(item) {
  const input = n.activeInput;
  const range = n.activeRange;
  if (!input || !range) return h();

  range.deleteContents();
  const chip = document.createElement("span");
  const label = item.emoji || item.displayName || item.name || item.id || "";
  chip.className = "mention-chip mention-chip-render";
  chip.contentEditable = "false";
  chip.dataset.mentionId = item.id || "";
  chip.textContent = item.emoji ? label : `${item.type === "channel" ? "#" : "@"}${label}`;
  range.insertNode(chip);
  range.setStartAfter(chip);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  h();
}

export function initMentions() {
  ["home-dm-input", "server-chat-input", "chat-msg-input", "dm-input"].forEach(e => {
      const t = document.getElementById(e);
      t && (t.addEventListener("input", e => function(e, t) {
        if ("time_formats" === n.mode) return;
        const o = window.getSelection();
        if (!o || !o.rangeCount) return;
        const i = o.getRangeAt(0),
          a = i.startContainer.textContent.substring(0, i.startOffset);

        const colonIdx = a.lastIndexOf(':');
        if (colonIdx !== -1 && (colonIdx === 0 || ' ' === a[colonIdx - 1] || '\n' === a[colonIdx - 1])) {
          const emojiQuery = a.substring(colonIdx + 1);
          if (emojiQuery.length >= 2 && !emojiQuery.includes(' ') && !emojiQuery.includes('\n')) {
            const matches = Object.entries(EMOJI_SHORTCODES)
              .filter(([code]) => code.includes(emojiQuery.toLowerCase()))
              .slice(0, 12)
              .map(([code, emoji]) => ({ id: code, emoji, name: code, type: 'emoji' }));
            if (matches.length > 0) {
              n.activeInput = t;
              n.activeRange = i.cloneRange();
              n.query = emojiQuery;
              n.mode = 'mentions';
              n.suggestions = matches;
              n.selectedIndex = 0;
              n.isOpen = true;
              const popup = document.getElementById('mention-autocomplete-popup');
              if (popup) {
                const rect = t.getBoundingClientRect();
                popup.style.left = `${rect.left}px`;
                popup.style.width = `${rect.width}px`;
                popup.style.bottom = window.innerHeight - rect.top + 10 + 'px';
                g();
                popup.classList.remove('hidden');
              }
              return;
            }
          }
        }

        const s = a.lastIndexOf("@"),
          c = a.lastIndexOf("#"),
          d = Math.max(s, c);
        if (-1 !== d && (0 === d || " " === a[d - 1] || "\n" === a[d - 1] || " " === a[d - 1])) {
          const e = a.substring(d + 1);
          if (!e.includes(" ") && !e.includes("\n")) return n.activeInput = t, n.activeRange = i.cloneRange(), n.query = e, void
          function(e, t = "@") {
            const o = document.getElementById("mention-autocomplete-popup");
            if (!o) return;
            let i = [];
            const a = n.activeInput && ("home-dm-input" === n.activeInput.id || "dm-input" === n.activeInput.id);
            if ("@" === t) {
              const t = r.filter(t => t.name.toLowerCase().includes(e.toLowerCase()) || t.arabic.includes(e));
              let n = [],
                o = [];
              a ? (n = "function" == typeof window.getActiveDmMembers ? window.getActiveDmMembers() : [], o = []) : (n = "function" == typeof window.getActiveServerMembers ? window.getActiveServerMembers() : [], o = "function" == typeof window.getActiveServerRoles ? window.getActiveServerRoles() : []), i = [...n.filter(t => t && (t.displayName || t.name) && (t.displayName || t.name).toLowerCase().includes(e.toLowerCase())).slice(0, 10), ...o.filter(t => t && t.name && t.name.toLowerCase().includes(e.toLowerCase()) && "@everyone" !== t.id && !1 !== t.mentionable).map(e => ({
                ...e,
                type: "role"
              }))], a || (i = [...i, ...t])
            } else "#" !== t || a || (i = ("function" == typeof window.getActiveServerChannels ? window.getActiveServerChannels() : []).filter(t => t && t.name && t.name.toLowerCase().includes(e.toLowerCase()) && "text" === t.type).map(e => ({
              ...e,
              type: "channel"
            })));
            n.suggestions = i, n.selectedIndex = 0, n.mode = "mentions", n.isOpen = n.suggestions.length > 0, n.isOpen ? (function() {
              const e = document.getElementById("mention-autocomplete-popup"),
                t = n.activeInput;
              if (!e || !t) return;
              const o = t.getBoundingClientRect();
              e.style.left = `${o.left}px`, e.style.width = `${o.width}px`, e.style.bottom = window.innerHeight - o.top + 10 + "px"
            }(), g(), o.classList.remove("hidden")) : o.classList.add("hidden")
          }(e, a[d])
        }
        h()
      }(0, t)), t.addEventListener("keydown", e => function(e) {
        if (n.isOpen) {
          if ("ArrowDown" === e.key) return e.preventDefault(), n.selectedIndex = (n.selectedIndex + 1) % n.suggestions.length, void g();
          if ("ArrowUp" === e.key) return e.preventDefault(), n.selectedIndex = (n.selectedIndex - 1 + n.suggestions.length) % n.suggestions.length, void g();
          if ("Enter" === e.key || "Tab" === e.key) return e.preventDefault(), e.stopImmediatePropagation(), void w(n.suggestions[n.selectedIndex]);
          if ("Escape" === e.key) return void h()
        }
        if ("Backspace" === e.key) {
          const t = window.getSelection();
          if (t && t.rangeCount > 0) {
            const n = t.getRangeAt(0);
            if (n.collapsed && 0 === n.startOffset) {
              const t = n.startContainer.previousSibling;
              t && (t.classList?.contains("mention-chip") || t.classList?.contains("time-chip")) && (e.preventDefault(), t.remove())
            }
          }
        }
      }(e)))
    }), a(),
    function() {
      const e = document.getElementById("drop-zone-overlay");
      if (!e) return;
      let t = 0;
      // ── سحب عنصر من جوه الصفحة (أيقونة سيرفر، أفاتار، صورة في رسالة)
      //    Chrome بيحط "Files" في dataTransfer.types للسحب ده، فمن غير التمييز
      //    ده منطقة "أفلت الصور هنا" كانت تظهر وإحساس إنه بينزّل ملف على الموقع.
      let internalDrag = false, dragResetTimer = null;
      window.addEventListener("dragstart", function () {
        internalDrag = true;
        clearTimeout(dragResetTimer);
        // احتياط لو dragend مجاش: نرجّع الحالة بعد ثانية ونص
        dragResetTimer = setTimeout(function () { internalDrag = false; }, 1500);
      }, true);
      const endInternalDrag = function () {
        internalDrag = false;
        clearTimeout(dragResetTimer);
      };
      window.addEventListener("dragend", endInternalDrag, true);
      window.addEventListener("drop", endInternalDrag, true);

      const isExternalFiles = function (ev) {
        if (internalDrag) return false;
        try {
          return !!(ev.dataTransfer && ev.dataTransfer.types && ev.dataTransfer.types.includes("Files"));
        } catch (_) { return false; }
      };
      const showZone = function () { e.classList.remove("hidden"); e.classList.add("flex"); };
      const hideZone = function () { t = 0; e.classList.add("hidden"); e.classList.remove("flex"); };

      window.addEventListener("dragenter", n => {
        n.preventDefault();
        if (!isExternalFiles(n)) return;
        t++, showZone()
      }, !1), window.addEventListener("dragleave", n => {
        n.preventDefault();
        if (internalDrag) return;
        t--, t <= 0 && hideZone()
      }, !1), window.addEventListener("dragover", e2 => {
        // منمنعش الافتراضي في السحب الداخلي عشان سحب العناصر والنص يشتغل عادي
        if (!isExternalFiles(e2)) return;
        e2.preventDefault()
      }, !1), window.addEventListener("drop", n => {
        n.preventDefault(), hideZone();
        if (internalDrag) return;
        const o = Array.from(n.dataTransfer.files);
        if (0 === o.length) return;
        const i = function() {
          const e = ["server-chat-input", "home-dm-input", "dm-input", "chat-msg-input"];
          for (const t of e) {
            const e = document.getElementById(t);
            if (e && null !== e.offsetParent) return t
          }
        }();
        i && o.forEach(e => {

          const maxMB = window.FoxyMedia?.MAX_FILE_MB || (window.remoteConfig?.features?.maxFileSize || 32);
          e.size > 1024 * maxMB * 1024 ? alert(window.__f("js.upload_too_big", {name: e.name, max: maxMB}, `الملف ${e.name} كبير جداً (أقصى حجم ${maxMB} ميجابايت).`)) : c(i, e)
        })
      }, !1)
    }();

  // ══════════════════════════════════════════════════════════════════════
  // لصق الصور بـ Ctrl+V (كان معطّلاً تماماً)
  // ══════════════════════════════════════════════════════════════════════
  // المشكلة: لم يكن هناك أي addEventListener("paste") في المشروع. فالـ
  // Snipping Tool / Greenshot / ShareX كلها تحط الصورة في الحافظة كـ
  // CF_DIB/PNG، والمتصفح عند اللصق في <input>/​<textarea> لا يستطيع إدخال
  // صورة — فيقع إمّا لا شيء، أو إمّا "نص" (اسم الملف/مسار) يُكتب داخل
  // صندوق الشات. بينما السحب والإفلات يعمل لأن له handler خاصاً.
  //
  // الحل: نقرأ الحافظة من كل المسارات الممكنة بالترتيب، ولو لقينا صورة
  // نمنع السلوك الافتراضي فوراً (preventDefault) وندخلها لنفس نظام
  // المرفقات الذي يستخدمه السحب.
  //
  // ⚠️ preventDefault لازم يتحصل بشكل متزامن قبل أي await، وإلا أكدب المتصفح
  // لصق النص الافتراضي قبله.
  (function addPasteImageSupport() {
    // نفس قائمة مربعات الشات التي يستخدمها السحب.
    var INPUT_IDS = ["server-chat-input", "home-dm-input", "dm-input", "chat-msg-input"];

    function _isChatInput(el) {
      if (!el || el.nodeType !== 1) return false;
      if (INPUT_IDS.indexOf(el.id) === -1) return false;
      // ⚠️ مربعات الشات هنا نوعان: <input>/<textarea> و <div contenteditable>.
      // (server-chat-input و home-dm-input دول divs). لو قصرنا الفحص على
      // TEXTAREA/INPUT فالمتصفح هيلصق <img> داخل الحقل القابل للتحرير
      // (data:image/base64 ضخم) بدل نظام المرفقات — وهذا كان الخطأ.
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return true;
      return el.isContentEditable === true;
    }
    // ينزف أي <img> تسلل داخل حقل قابل للتحرير (من لصق قديم قبل الإصلاح).
    // بدون ذلك يفضل الـ img جوه صندوق الكتابة ويُرسل مع النص.
    function _stripImgsFromEditable(el) {
      if (!el || !el.isContentEditable) return 0;
      var imgs = el.querySelectorAll("img");
      for (var i = 0; i < imgs.length; i++) {
        var im = imgs[i];
        var alt = im.getAttribute("alt") || "";
        if (alt && alt.length < 200) { try { im.replaceWith(document.createTextNode(alt)); } catch (e) { im.remove(); } }
        else { im.remove(); }
      }
      return imgs.length;
    }
    // نظّف الموجود أصلاً + راقب أي <img> جديد يتسرّب مستقبلاً.
    (function watchEditableComposers() {
      ["server-chat-input", "home-dm-input"].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        _stripImgsFromEditable(el);
        el.addEventListener("input", function () { _stripImgsFromEditable(el); });
        el.addEventListener("focus", function () { _stripImgsFromEditable(el); });
      });
    })();
    // نستخرج ملفاً صالحاً من الحافظة، أو null لو ما فيهوش صورة.
    function _extractImageFiles(cd) {
      if (!cd) return [];
      var out = [];

      // 1) المسار الأضمن: files (Chrome على ويندوز يعطي "image.png" هنا)
      if (cd.files && cd.files.length) {
        for (var i = 0; i < cd.files.length; i++) {
          var f = cd.files[i];
          if (f && /^image\//.test(f.type || "")) out.push(f);
        }
        if (out.length) return out;
      }

      // 2) items من نوع kind=file ⇒ getAsFile()
      //    بعض الأدوات (مثل Snipping Tool القديمة) لا تملأ files لكن
      //    تعبّئ items. لازم يتحقق قبل items النوعي أدناه.
      if (cd.items && cd.items.length) {
        for (var j = 0; j < cd.items.length; j++) {
          var it = cd.items[j];
          if (it.kind === "file") {
            var gaf = null;
            try { gaf = it.getAsFile(); } catch (e) { gaf = null; }
            if (gaf && /^image\//.test(gaf.type || "")) { out.push(gaf); continue; }
          }
        }
        if (out.length) return out;

        // 3) items نصية من نوع image/*: نفس الملف لكن عبر getType (promise).
        //    نجمّع الـ promises ونكمل في ثم()، لذا نرجعها مع علامة.
        var promised = [];
        for (var k = 0; k < cd.items.length; k++) {
          var it2 = cd.items[k];
          if (it2.kind === "string" && /^image\//.test(it2.type || "")) {
            (function (item) {
              promised.push(new Promise(function (resolve) {
                try {
                  item.getType(function (blob) {
                    if (!blob) return resolve(null);
                    resolve(new File([blob], _nameFor(item.type), { type: item.type }));
                  });
                } catch (e) { resolve(null); }
              }));
            })(it2);
          }
        }
        if (promised.length) return { promised: promised };
      }

      // 4) نص عادي يحتوي data:image/... أو رابط صورة — وهو غالباً سبب
      //    "بيتكتب داخل صندوق الشات كانه كتابة".
      var txt = "";
      try { txt = cd.getData("text/plain") || ""; } catch (e) {}
      if (txt) {
        var trimmed = txt.trim();
        var dataMatch = /^data:image\/(png|jpe?g|gif|webp|bmp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(trimmed);
        if (dataMatch) {
          try {
            var bin = atob(dataMatch[2].replace(/\s+/g, ""));
            var bytes = new Uint8Array(bin.length);
            for (var b = 0; b < bin.length; b++) bytes[b] = bin.charCodeAt(b);
            return [new File([bytes], _nameFor(dataMatch[1].toLowerCase()), { type: dataMatch[1].toLowerCase() })];
          } catch (e) {}
        }
        if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp|bmp)(\?\S*)?$/i.test(trimmed)) {
          return { url: trimmed };
        }
      }
      return [];
    }
    function _nameFor(mime) {
      var ext = String(mime || "image/png").split("/")[1] || "png";
      return "paste-" + Date.now() + "." + (ext === "jpeg" ? "jpg" : ext);
    }

    // ── مسار الضمان الأخير: navigator.clipboard.read() ──────────────────
    // يُستخدم فقط لو فشلت كل المسارات السابقة — وهي حالة نادرة (أداة تحط
    // CF_DIB وحده بلا تمثيل نصي ولا files).
    //
    // ⚠️ لماذا لا نستدعيه مباشرة؟ لأنه:
    //   (أ) يتطلب صلاحية clipboard-read صريحة
    //   (ب) يعطي تنبيهاً أمنياً في كل المتصفحات
    //   (ج) ثمنه أعلى من قيمته في المسار العادي
    // لذلك: استدعاؤه مرة واحدة فقط عند فشل كل شيء آخر، وبعد فحص الصلاحية.
    var _cbReadTried = false;
    function _fileFromNativeDataUrl(dataUrl) {
      var m = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(String(dataUrl || ""));
      if (!m) return null;
      try {
        var bin = atob(m[2].replace(/\s+/g, ""));
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new File([bytes], _nameFor(m[1]), { type: m[1] });
      } catch (_) {
        return null;
      }
    }
    function _tryAsyncClipboardRead(inputId) {
      // Android WebView: clipboard-read is not granted to web content, so the
      // app bridge reads the clipboard image natively and hands it back here.
      // Try this on every paste (it is cheap) before the one-shot browser path.
      if (typeof window.foxyReadClipboardImage === "function") {
        try {
          var nativeFile = _fileFromNativeDataUrl(window.foxyReadClipboardImage());
          if (nativeFile) {
            if (typeof c === "function") c(inputId, nativeFile);
            return;
          }
        } catch (_) {}
      }

      if (_cbReadTried) return;              // محاولة واحدة لكل صفحة — لا تزعج المستخدم
      if (!navigator.clipboard || typeof navigator.clipboard.read !== "function") return;
      _cbReadTried = true;
      Promise.resolve().then(function () {
        // افحص الصلاحية أولاً: لو مرفوضة لا داعي لطلب يرفض نفسه.
        if (navigator.permissions && navigator.permissions.query) {
          return navigator.permissions.query({ name: "clipboard-read" })
            .then(function (p) { return p.state !== "denied"; })
            .catch(function () { return true; });
        }
        return true;
      }).then(function (allowed) {
        if (!allowed) return null;
        return navigator.clipboard.read();
      }).then(function (items) {
        if (!items || !items.length) return;
        var imageItem = null, imageType = null;
        for (var i = 0; i < items.length; i++) {
          var t = (items[i].types || []).filter(function (x) { return /^image\//.test(x); })[0];
          if (t) { imageItem = items[i]; imageType = t; break; }
        }
        if (!imageItem) return;
        return imageItem.getType(imageType).then(function (blob) {
          if (!blob) return;
          var f = new File([blob], _nameFor(imageType), { type: imageType });
          if (typeof c === "function") c(inputId, f);
          if (window.FOXY_DEBUG) window.foxyLog && window.foxyLog("info", "[Foxy][paste] صورة من clipboard.read()", { target: inputId });
        });
      }).catch(function (e) {
        if (window.FOXY_DEBUG) window.foxyLog && window.foxyLog("info", "[Foxy][paste] clipboard.read() لم يُرجع صورة", { error: e && e.message });
      });
    }

    document.addEventListener("paste", function (ev) {
      var cd = ev.clipboardData || (window.clipboardData || null);
      if (!cd) return;
      // نتحكم فقط عندما يكون اللصق موجّهاً لمربع شات فعلي:
      //   إما هدف الحدث نفسه، أو العنصر الممسك بالتركيز.
      // ما عدا ذلك (تركيز على حقل آخر في الصفحة) نتركه للأصل — حتى لا
      // نسرق لصقاً موجّهاً لحقل اسم/رسالة/إعداد.
      var target = ev.target;
      var targetIsChat = _isChatInput(target);
      var activeIsChat = _isChatInput(document.activeElement);
      if (!targetIsChat && !activeIsChat) return;
      var inputId = targetIsChat ? target.id : document.activeElement.id;

      var res = _extractImageFiles(cd);
      if (!res || (Array.isArray(res) && !res.length)) {
        // ── لم نجد صورة في بيانات الحدث ──────────────────────────────
        // decision حرجة: هل نمنع الافتراضي؟
        //   لو في نص أو ملف ⇒ اتركوا المتصفح يتصرّف (وإلا أكون سرقت لصقاً).
        //   لو لا نص ولا ملف ⇒ اللصق الافتراضي كان سيفعل لا شيء على أي حال،
        //     وهذه بالضبط حالة CF_DIB الوحيد ⇒ آمن نأخذ زمام الأمور.
        var _txt = "";
        try { _txt = (cd.getData("text/plain") || "").trim(); } catch (e) {}
        var _hasFiles = !!(cd.files && cd.files.length);
        if (_txt || _hasFiles) return;             // لصق نصي/ملفي عادي — لا تلمسه
        ev.preventDefault();
        _tryAsyncClipboardRead(inputId);
        return;
      }

      // عنده صورة: منع الافتراضي فوراً (متزامن) ثم أضِف للمرفقات.
      ev.preventDefault();

      function _attach(f) {
        if (!f) return;
        try {
          var maxMB = window.FoxyMedia?.MAX_FILE_MB || window.remoteConfig?.features?.maxFileSize || 32;
          if (f.size && f.size > 1024 * maxMB * 1024) {
            alert(window.__f("js.upload_too_big", { name: f.name, max: maxMB }, `الملف ${f.name} كبير جداً (أقصى حجم ${maxMB} ميجابايت).`));
            return;
          }
          if (typeof c === "function") c(inputId, f);
        } catch (e) {
          window.foxyLog && window.foxyLog("warn", "[Foxy][paste] فشل إرفاق صورة ملصوقة", { error: e && e.message });
        }
      }

      if (Array.isArray(res)) {
        for (var i = 0; i < res.length; i++) _attach(res[i]);
      } else if (res.promised) {
        res.promised.forEach(function (p) { p.then(_attach).catch(function () {}); });
      } else if (res.url) {
        // رابط صورة: نحمّله محلياً حتى يُرسَل كملف (مثل السحب).
        fetch(res.url, { mode: "cors", cache: "force-cache" })
          .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.blob(); })
          .then(function (blob) {
            var nm = res.url.split("/").pop().split("?")[0] || "image.png";
            _attach(new File([blob], nm, { type: blob.type || "image/png" }));
          })
          .catch(function () {
            if (window.FOXY_DEBUG) window.foxyLog && window.foxyLog("info", "[Foxy][paste] تعذّر تحميل الرابط الملصوق", { url: res.url });
          });
      }
      window.FOXY_DEBUG && window.foxyLog && window.foxyLog("info", "[Foxy][paste] تم لصق صورة", { target: inputId });
    }, true); // capture: قبل أي handler آخر يتكتب نص
  })();

  const e = document.getElementById("image-upload-input");
  e && e.addEventListener("change", async e => {
    const t = Array.from(e.target.files),
      n = e.target.getAttribute("data-target"),
      replaceId = e.target.getAttribute("data-replace-id");
    if (t.length && n) {
      if (replaceId) {
        const existing = (o[n] || []).find(item => item.id === replaceId);
        if (existing?.xhr && existing.status === "uploading") existing.xhr.abort();
        if (existing?.preview) URL.revokeObjectURL(existing.preview);
        o[n] = (o[n] || []).filter(item => item.id !== replaceId);
      }
      for (const e of t) {
        const maxMB = window.FoxyMedia?.MAX_FILE_MB || window.remoteConfig?.features?.maxFileSize || 32;

        e.size > 1024 * maxMB * 1024 ? alert(window.__f("js.upload_too_big", {name: e.name, max: maxMB}, `الملف ${e.name} كبير جداً (أقصى حجم ${maxMB} ميجابايت).`)) : c(n, e)
      }
      e.target.value = "", e.target.removeAttribute("data-replace-id")
    }
  }), document.addEventListener("click", e => {
    const t = document.getElementById("mention-autocomplete-popup");
    !t || t.hidden || t.contains(e.target) || e.target.closest("#mention-autocomplete-popup") || h()
  })
}

function mediaKindOf(file) {
  if (window.FoxyMedia?.kindOf) return window.FoxyMedia.kindOf(file);
  const type = file?.type || '', name = file?.name || '';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(name)) return 'video';
  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(name)) return 'audio';
  return 'file';
}

function fmtDuration(sec) {
  if (!isFinite(sec) || sec < 0) return null;
  const s = Math.round(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const pad = v => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}
function videoQualityLabel(w, h) {
  if (!w || !h) return null;
  const long = Math.max(w, h), short = Math.min(w, h);
  const isPortrait = h > w;
  const base = isPortrait ? short : long;
  const buckets = [[3840, '4K'], [2560, '2K'], [1920, '1080p'], [1280, '720p'], [854, '480p'], [640, '360p']];
  for (const [px, label] of buckets) if (base >= px) return label;
  return `${base}p`;
}
function generateVideoPoster(file) {
  return new Promise(resolve => {
    if (!file || typeof file.type !== 'string' || !file.type.startsWith('video/')) return resolve(null);
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;
    const done = out => { if (settled) return; settled = true; clearTimeout(timer); try { video.removeAttribute('src'); video.load(); } catch (_) {} URL.revokeObjectURL(url); resolve(out); };
    const timer = setTimeout(() => done(null), 8000);
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
    const grab = () => {
      try {
        const w = video.videoWidth, h = video.videoHeight;
        if (!w || !h) return;
        const maxW = 320;
        const scale = Math.min(1, maxW / w);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        done({
          poster: canvas.toDataURL('image/jpeg', 0.7),
          duration: video.duration,
          width: w,
          height: h
        });
      } catch (e) { done(null); }
    };
    video.addEventListener('loadeddata', () => {

      const target = Math.min(1, (video.duration || 1) * 0.1);
      try { video.currentTime = target; } catch (_) {}
    });
    video.addEventListener('seeked', grab);
    video.addEventListener('error', () => done(null));
    document.body.appendChild(video);
    video.src = url;
    video.load();
  });
}
window.foxyVideoPoster = generateVideoPoster;
window.foxyFmtDuration = fmtDuration;

function c(e, t, prefill) {
  const n = {
    id: Math.random().toString(36).substring(2, 9),
    file: t,
    preview: t?.type?.startsWith("image/") ? URL.createObjectURL(t) : null,
    url: prefill?.url || null,
    name: prefill?.name || t?.name || "ملف",
    size: prefill?.size ?? t?.size ?? 0,
    mime: prefill?.mime || t?.type || "",
    kind: prefill?.kind || mediaKindOf(t),
    status: prefill?.status || "uploading",
    percent: prefill?.percent || 0,
    xhr: null,
    oneTime: false,
    poster: null,
    duration: null,
    width: null,
    height: null
  };
  o[e] || (o[e] = []), o[e].push(n), d(e);

  if (n.kind === "video" && t && !n.poster) {
    generateVideoPoster(t).then(res => {
      if (!res) return;
      n.poster = res.poster; n.duration = res.duration;
      n.width = res.width; n.height = res.height;
      d(e);
    }).catch(() => {});
  }

  if (n.kind === "image" && !prefill?.url) {
    (async function(e, t) {
    try {
      let n = t.file;
      i || (n = await compressImage(t.file));
      const o = await uploadToImgBB(n, e => {
        t.percent = e,
          function(e, t) {
            const n = document.getElementById(`progress-circle-${e}`),
              o = document.getElementById(`progress-text-${e}`);
            n && (n.style.strokeDashoffset = 100.5 - 1.005 * t), o && (o.textContent = `${t}%`)
          }(t.id, e)
      }, e => {
        t.xhr = e
      });
      t.url = o.url, t.delete_url = o.delete_url, t.status = "ready", d(e)
    } catch (n) {
      "abort" !== n.message && (t.status = "error", d(e))
    }
    })(e, n);
  } else if (!prefill?.url && window.FoxyMedia?.uploadFileToDiscord) {
    const file = t;
    window.FoxyMedia.uploadFileToDiscord(file, pct => {
      n.percent = pct;
      const bar = document.getElementById(`media-progress-${n.id}`);
      const txt = document.getElementById(`media-progress-text-${n.id}`);
      bar && (bar.style.width = pct + "%"), txt && (txt.textContent = pct + "%");
    }, xhr => { n.xhr = xhr;     }).then(res => {
      n.url = res.url;

      if (!n.userNamed) n.name = res.name || n.name;
      n.size = res.size || n.size;
      n.status = "ready"; n.percent = 100; d(e);
      window.addSystemMsg && window.addSystemMsg('✅ تم رفع "' + (file?.name || "الملف") + '" — اضغط إرسال لعرضه في الشات.', "success");
    }).catch(err => {
      if ((err?.message || "").startsWith("too-big")) alert(`الملف كبير جداً (أقصى حجم ${window.FoxyMedia.MAX_FILE_MB}MB).`);
      else if ((err?.message || "") !== "abort") alert("فشل رفع الملف. حاول مجدداً.");
      n.status = "error"; d(e);
    });
  } else if (prefill?.url) {
    n.status = "ready"; n.percent = 100; d(e);
  }
  return n;
}

window.addExternalAttachment = function(targetId, prefill) {
  o[targetId] || (o[targetId] = []);
  const item = {
    id: Math.random().toString(36).substring(2, 9),
    file: null, preview: null,
    url: prefill?.url || null,
    name: prefill?.name || "ملف",
    size: prefill?.size || 0,
    mime: prefill?.mime || "",
    kind: prefill?.kind || "file",
    status: prefill?.status || "uploading",
    percent: prefill?.percent || 0,
    xhr: prefill?.xhr || null,
    autoSend: !!prefill?.autoSend,
    oneTime: false
  };
  o[targetId].push(item); d(targetId);
  return item;
};
window.updateExternalAttachment = function(targetId, id, patch) {
  const item = (o[targetId] || []).find(x => x.id === id);
  if (!item) return;
  Object.assign(item, patch || {});
  if (patch?.percent != null && item.status === "uploading") {
    const bar = document.getElementById(`media-progress-${id}`);
    const txt = document.getElementById(`media-progress-text-${id}`);
    bar && (bar.style.width = patch.percent + "%"), txt && (txt.textContent = patch.percent + "%");
    return;
  }
  d(targetId);
};
window.__foxyQueueImage = function(targetId, file) { return c(targetId, file); };
window.cancelImageUpload = function(targetId) {
  (o[targetId] || []).forEach(item => { try { item.xhr?.abort(); } catch (_) {} item.preview && URL.revokeObjectURL(item.preview); });
  o[targetId] = []; d(targetId);
};

function d(e) {
  const t = document.getElementById(`${e}-attachments`);
  if (!t) return;
  const n = o[e] || [];

  const vis = n.filter(item => !(item.autoSend && item.status !== "error"));
  window.foxyComposerSyncCancel && window.foxyComposerSyncCancel(e, vis.length > 0);
  if (0 === vis.length) return t.classList.add("hidden"), void(t.innerHTML = "");
  t.classList.remove("hidden");
  const fmtSize = b => window.FoxyMedia?.formatSize ? window.FoxyMedia.formatSize(b) : (b ? Math.round(b/1024)+' KB' : '');
  const kindLabel = k => k === 'voice' ? 'فويس' : k === 'video' ? 'فيديو' : k === 'audio' ? 'صوت' : 'ملف';

  const ICON = {
    eye: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/><circle cx="12" cy="12" r="3" stroke-width="2"/></svg>',
    pencil: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>',
    trash: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>',
    play: '<svg class="w-7 h-7 translate-x-[1px]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v13.72a1 1 0 001.54.84l10.29-6.86a1 1 0 000-1.68L9.54 4.3A1 1 0 008 5.14z"/></svg>',
    audio: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z"/></svg>',
    file: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h6l6 6v8a4 4 0 01-4 4H7z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 3v6h6"/></svg>'
  };
  t.innerHTML = vis.map(item => {

    if (item.kind === 'video') {
      const nm = item.name || item.file?.name || 'فيديو';
      const dur = fmtDuration(item.duration);
      const qual = videoQualityLabel(item.width, item.height);
      const meta = [fmtSize(item.size), qual, dur].filter(Boolean).join(' · ');
      const btnBase = 'w-6 h-6 rounded flex items-center justify-center transition';
      return `
      <div style="width:220px;min-width:220px;max-width:220px" class="relative flex-shrink-0 overflow-hidden rounded-lg border border-white/15 bg-[#0b0d12] shadow-lg group" data-att-id="${escapeForAttribute(item.id)}">
        <div class="relative w-full aspect-video bg-black/60 flex items-center justify-center overflow-hidden">
          ${item.poster
            ? `<img src="${escapeForAttribute(item.poster)}" class="absolute inset-0 w-full h-full object-cover" alt="${escapeForAttribute(nm)}">`
            : `<div class="flex flex-col items-center gap-1 text-gray-500"><span class="text-2xl">🎥</span><span class="text-[9px] font-bold">جاري تجهيز المعاينة…</span></div>`}
          <button type="button" onclick="window.foxyPreviewVideoAttachment('${escapeForJsString(e)}', '${escapeForJsString(item.id)}')" class="relative z-10 w-11 h-11 rounded-full bg-black/60 border border-white/20 text-white hover:bg-black/75 hover:scale-105 transition flex items-center justify-center" title="${window.__fb('js.att_preview_video', 'معاينة قبل الإرسال')}">${ICON.play}</button>
          ${dur ? `<span class="absolute bottom-1 right-1 z-10 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono font-bold text-white">${escapeForAttribute(dur)}</span>` : ''}
          ${"uploading"===item.status?`<div class="absolute inset-0 z-20 flex items-center justify-center bg-black/55"><span class="text-[11px] font-black text-white">${item.percent||0}%</span></div>`:""}
          <div class="absolute top-1 left-1 z-30 flex items-center gap-0.5 rounded-md bg-[#17191f]/95 border border-white/10 px-1 py-0.5 shadow-xl">
            <button type="button" onclick="window.toggleAttachmentOneTime('${escapeForJsString(e)}', '${escapeForJsString(item.id)}')" class="h-6 px-1.5 rounded flex items-center justify-center gap-1 ${item.oneTime ? 'text-amber-400 bg-amber-500/10' : 'text-gray-300 hover:bg-white/10'}" title="${item.oneTime ? window.__fb('js.att_once_cancel', 'إلغاء فتح الفيديو مرة واحدة') : window.__fb('js.att_once', 'فتح الفيديو مرة واحدة')}"><span>${ICON.eye}</span><span class="text-[9px] whitespace-nowrap">${item.oneTime ? window.__fb('js.att_once_short', 'مرة واحدة') : window.__fb('js.att_normal', 'عادي')}</span></button>
            <button type="button" onclick="window.renameAttachment('${escapeForJsString(e)}', '${escapeForJsString(item.id)}')" class="${btnBase} text-gray-300 hover:text-white hover:bg-white/10" title="${window.__fb('js.att_rename', 'تغيير الاسم')}">${ICON.pencil}</button>
            <button type="button" onclick="window.removeAttachment('${escapeForJsString(e)}', '${escapeForJsString(item.id)}')" class="${btnBase} text-red-400 hover:text-red-300 hover:bg-red-500/20" title="${window.__fb('js.att_delete', 'حذف')}">${ICON.trash}</button>
          </div>
        </div>
        <div class="px-2 py-1.5 border-t border-white/10">
          <div class="truncate text-[10px] font-bold text-white" title="${escapeForAttribute(nm)}">${escapeForAttribute(nm)}</div>
          <div class="text-[9px] text-gray-400 truncate">${escapeForAttribute(meta || 'فيديو')}</div>
          ${"uploading"===item.status?`<div class="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden"><div id="media-progress-${escapeForAttribute(item.id)}" class="h-full bg-emerald-500 rounded-full transition-all" style="width:${item.percent||0}%"></div></div>`:""}
          ${"ready"===item.status?`<div class="mt-1 text-[9px] font-bold text-emerald-400">✅ جاهز للإرسال</div>`:""}
          ${"error"===item.status?`<div class="mt-1 text-[9px] font-bold text-red-400">${window.__fb('js.upload_failed', 'فشل الرفع')}</div>`:""}
        </div>
      </div>`;
    }
    if ((item.kind || 'image') !== 'image') {
      const nm = item.name || item.file?.name || 'ملف';
      const dur = (item.kind === 'audio' || item.kind === 'voice') ? fmtDuration(item.duration) : null;
      const meta = [fmtSize(item.size), kindLabel(item.kind), dur].filter(Boolean).join(' · ');
      const btnBase = 'w-6 h-6 rounded flex items-center justify-center transition';
      const rowIcon = item.kind === 'voice' ? '🎙' : (item.kind === 'audio' ? ICON.audio : ICON.file);
      return `
      <div style="width:268px;min-width:268px;max-width:268px" class="relative flex-shrink-0 overflow-hidden rounded-lg border border-white/15 bg-[#0b0d12] shadow-lg group" data-att-id="${escapeForAttribute(item.id)}">
        <div class="flex items-center gap-2 p-3">
          <span class="text-2xl shrink-0">${rowIcon}</span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-[11px] font-bold text-white" title="${escapeForAttribute(nm)}">${escapeForAttribute(nm.length > 32 ? nm.slice(0,32)+'…' : nm)}</div>
            <div class="text-[10px] text-gray-400 truncate">${escapeForAttribute(meta)}</div>
          </div>
          <div class="flex items-center gap-0.5 shrink-0">
            <button type="button" onclick="window.toggleAttachmentOneTime('${escapeForJsString(e)}', '${escapeForJsString(item.id)}')" class="h-6 px-1.5 rounded flex items-center justify-center gap-1 ${item.oneTime ? 'text-amber-400 bg-amber-500/10' : 'text-gray-300 hover:bg-white/10'}" title="${item.oneTime ? window.__fb('js.att_once_cancel', 'إلغاء فتح الملف مرة واحدة') : window.__fb('js.att_once', 'فتح الملف مرة واحدة')}"><span>${ICON.eye}</span><span class="text-[9px] whitespace-nowrap">${item.oneTime ? window.__fb('js.att_once_short', 'مرة واحدة') : window.__fb('js.att_normal', 'عادي')}</span></button>
            <button type="button" onclick="window.foxyPreviewAudioAttachment('${escapeForJsString(e)}', '${escapeForJsString(item.id)}')" class="${btnBase} text-gray-300 hover:text-white hover:bg-white/10" title="${window.__fb('js.att_preview_audio', 'استماع قبل الإرسال')}">${ICON.play}</button>
            <button type="button" onclick="window.renameAttachment('${escapeForJsString(e)}', '${escapeForJsString(item.id)}')" class="${btnBase} text-gray-300 hover:text-white hover:bg-white/10" title="${window.__fb('js.att_rename', 'تغيير الاسم')}">${ICON.pencil}</button>
            <button type="button" onclick="window.removeAttachment('${escapeForJsString(e)}', '${escapeForJsString(item.id)}')" class="${btnBase} text-red-400 hover:text-red-300 hover:bg-red-500/20" title="${window.__fb('js.att_delete', 'حذف')}">${ICON.trash}</button>
          </div>
        </div>
        ${"uploading"===item.status?`<div class="mx-3 mb-2 h-1.5 rounded-full bg-white/10 overflow-hidden"><div id="media-progress-${escapeForAttribute(item.id)}" class="h-full bg-emerald-500 rounded-full transition-all" style="width:${item.percent||0}%"></div></div><div id="media-progress-text-${escapeForAttribute(item.id)}" class="px-3 pb-2 text-[10px] font-bold text-emerald-400">${item.percent||0}% — جاري الرفع…</div>`:""}
        ${"ready"===item.status?`<div class="px-3 pb-2 text-[10px] font-bold text-emerald-400">✅ جاهز للإرسال</div>`:""}
        ${"error"===item.status?`<div class="px-3 pb-2 text-[10px] font-bold text-red-400">${window.__fb('js.upload_failed', 'فشل الرفع')}</div>`:""}
      </div>`;
    }
    return `
    <div style="width:176px;min-width:176px;max-width:176px;height:160px;min-height:160px;max-height:160px" class="relative flex-shrink-0 rounded-lg overflow-hidden border border-white/15 group bg-[#0b0d12] shadow-lg" data-att-id="${escapeForAttribute(item.id)}">
      <div class="absolute top-1 left-1 z-10 flex items-center gap-0.5 rounded-md bg-[#17191f]/95 border border-white/10 px-1 py-0.5 shadow-xl">
        <button type="button" onclick="window.toggleAttachmentOneTime('${escapeForJsString(e)}', '${escapeForJsString(item.id)}')" class="h-6 px-1.5 rounded hover:bg-white/10 ${item.oneTime ? 'text-amber-400 bg-amber-500/10' : 'text-gray-300'} flex items-center justify-center gap-1" title="${item.oneTime ? window.__fb('js.att_once_cancel', 'إلغاء فتح الصورة مرة واحدة') : window.__fb('js.att_once', 'فتح الصورة مرة واحدة')}"><span>◉</span><span class="text-[9px] whitespace-nowrap">${item.oneTime ? window.__fb('js.att_once_short', 'مرة واحدة') : window.__fb('js.att_normal', 'عادي')}</span></button>
        <button type="button" onclick="window.renameAttachment('${escapeForJsString(e)}', '${escapeForJsString(item.id)}')" class="w-6 h-6 rounded hover:bg-white/10 text-gray-300 hover:text-white flex items-center justify-center" title="${window.__fb('js.att_rename', 'تغيير الاسم')}">✎</button>
        <button type="button" onclick="window.removeAttachment('${escapeForJsString(e)}', '${escapeForJsString(item.id)}')" class="w-6 h-6 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 flex items-center justify-center" title="${window.__fb('js.att_delete', 'حذف الصورة')}">🗑</button>
      </div>
      <div style="width:176px;height:128px" class="flex items-center justify-center overflow-hidden"><img src="${escapeForAttribute(item.preview)}" style="max-width:176px;max-height:128px;width:auto;height:auto;object-fit:contain" class="${"uploading"===item.status?"opacity-35":""}" alt="${escapeForAttribute(item.file?.name || window.__fb('js.att_attached', 'صورة مرفقة'))}"></div>
      ${"uploading"===item.status?`<div class="absolute inset-x-0 top-0 h-32 flex items-center justify-center bg-black/20"><svg class="w-10 h-10 transform -rotate-90"><circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.15)" stroke-width="3" fill="transparent"/><circle id="progress-circle-${escapeForAttribute(item.id)}" cx="20" cy="20" r="16" stroke="currentColor" stroke-width="3" fill="transparent" stroke-dasharray="100.5" stroke-dashoffset="${100.5-1.005*item.percent}" class="text-emerald-500"/></svg><span id="progress-text-${escapeForAttribute(item.id)}" class="absolute text-[10px] font-bold text-white">${item.percent}%</span></div>`:""}
      ${"error"===item.status?`<div class="absolute inset-x-0 top-0 h-32 flex items-center justify-center bg-red-500/30"><span class="text-[10px] font-bold text-red-300">${window.__fb('js.upload_failed', 'فشل الرفع')}</span></div>`:""}
      <div class="absolute bottom-0 inset-x-0 h-8 px-2 flex items-center bg-[#08090d]/95 border-t border-white/10"><span class="truncate text-[10px] text-gray-300" title="${escapeForAttribute(item.name || item.file?.name || window.__fb('js.att_attached', 'صورة مرفقة'))}">${escapeForAttribute(item.name || item.file?.name || window.__fb('js.att_attached', 'صورة مرفقة'))}</span></div>
    </div>`;
  }).join('');
  const modeButton = document.querySelector(`[data-one-time-target="${CSS.escape(e)}"]`);
  if (modeButton) {
    const allOneTime = n.length > 0 && n.every(item => item.oneTime);
    modeButton.classList.toggle('text-amber-400', allOneTime);
    modeButton.classList.toggle('text-gray-500', !allOneTime);
    modeButton.setAttribute('aria-pressed', String(allOneTime));
    modeButton.title = allOneTime ? window.__fb('js.att_all_once', 'الصور المحددة تُفتح مرة واحدة - مفعّل') : window.__fb('js.att_enable_once', 'تفعيل الفتح مرة واحدة للصور المحددة');
  }
  return;
  const html = n.map(t => `\n        <div class="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-white/10 group bg-slate-800" data-att-id="${escapeForAttribute(t.id)}">\n            <img src="${escapeForAttribute(t.preview)}" class="w-full h-full object-cover ${"uploading"===t.status?"opacity-40":""}">\n            \n            ${"uploading"===t.status?`\n                <div class="absolute inset-0 flex flex-col items-center justify-center">\n                    <svg class="w-10 h-10 transform -rotate-90">\n                        <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.1)" stroke-width="3" fill="transparent" class="origin-center scale-[0.5] translate-x-10 translate-y-10" />\n                        <circle id="progress-circle-${escapeForAttribute(t.id)}" cx="20" cy="20" r="16" stroke="currentColor" stroke-width="3" fill="transparent" \n                            stroke-dasharray="100.5" stroke-dashoffset="${100.5-1.005*t.percent}"\n                            class="text-emerald-500 origin-center scale-[0.5] translate-x-10 translate-y-10 transition-all duration-300" />\n                    </svg>\n                    <span id="progress-text-${escapeForAttribute(t.id)}" class="text-[10px] font-bold text-white mt-1">${t.percent}%</span>\n                </div>\n            `:""}\n\n            ${"error"===t.status?'\n                <div class="absolute inset-0 flex items-center justify-center bg-red-500/20">\n                    <span class="text-[10px] font-bold text-red-400">\u0641\u0634\u0644!</span>\n                </div>\n            ':""}\n\n            \x3c!-- Remove Button --\x3e\n            <button onclick="window.removeAttachment('${escapeForJsString(e)}', '${escapeForJsString(t.id)}')" \n                class="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">\n                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
    `);
  t.innerHTML = html.join('');
}

window.previewAttachment = function(url) {
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
};

function foxyMediaOverlay(innerHtml) {
  document.getElementById('foxy-att-preview')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'foxy-att-preview';
  wrap.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm';
  wrap.innerHTML = `
    <div class="relative w-full max-w-2xl max-h-[86vh] overflow-hidden rounded-2xl border border-white/15 bg-[#0b0d12] shadow-2xl">
      <button type="button" onclick="document.getElementById('foxy-att-preview').remove()" class="absolute top-2 left-2 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white transition" title="${window.__fb('app_voice.close_btn', 'إغلاق')}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
      ${innerHtml}
    </div>`;
  wrap.addEventListener('click', ev => { if (ev.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
  const esc = ev => { if (ev.key === 'Escape') wrap.remove(); };
  document.addEventListener('keydown', esc, { once: true });
  return wrap;
}
function foxyLocalUrl(item) {
  if (item.file) {
    if (!item._localUrl) item._localUrl = URL.createObjectURL(item.file);
    return item._localUrl;
  }
  return item.url || null;
}
window.foxyPreviewVideoAttachment = function(targetId, attachmentId) {
  const item = (o[targetId] || []).find(x => x.id === attachmentId);
  if (!item) return;
  const src = foxyLocalUrl(item);
  if (!src) { window.showFoxyToast && window.showFoxyToast({ id: 'att-prev', tone: 'warn', title: '📼 الفيديو لسه بيتحمّل', body: 'استنى رفعه الأول.' }); return; }
  const dur = fmtDuration(item.duration);
  const wrap = foxyMediaOverlay(`
    <video src="${escapeForAttribute(src)}" controls autoplay playsinline class="w-full max-h-[72vh] bg-black"></video>
    <div class="px-4 py-3 border-t border-white/10">
      <div class="truncate text-xs font-bold text-white">${escapeForAttribute(item.name || 'فيديو')}</div>
      <div class="text-[10px] text-gray-400 mt-0.5">${escapeForAttribute([window.FoxyMedia?.formatSize ? window.FoxyMedia.formatSize(item.size) : '', videoQualityLabel(item.width, item.height), dur].filter(Boolean).join(' · '))}</div>
    </div>`);
  const v = wrap.querySelector('video');
  v && v.addEventListener('error', () => {
    window.showFoxyToast && window.showFoxyToast({ id: 'att-prev', tone: 'error', title: '📼 مقدرش تشغيل الفيديو', body: 'المتصفح ده مش بيدعم صيغة الملف ده. جرّب MP4 (H.264).' });
  });
};
window.foxyPreviewAudioAttachment = function(targetId, attachmentId) {
  const item = (o[targetId] || []).find(x => x.id === attachmentId);
  if (!item) return;
  const src = foxyLocalUrl(item);
  if (!src) { window.showFoxyToast && window.showFoxyToast({ id: 'att-prev', tone: 'warn', title: '🎵 الملف لسه بيتحمّل', body: 'استنى رفعه الأول.' }); return; }
  foxyMediaOverlay(`
    <audio src="${escapeForAttribute(src)}" controls autoplay class="w-full"></audio>
    <div class="px-4 py-3 border-t border-white/10">
      <div class="truncate text-xs font-bold text-white">${escapeForAttribute(item.name || 'ملف صوتي')}</div>
      <div class="text-[10px] text-gray-400 mt-0.5">${escapeForAttribute(fmtSize(item.size))}</div>
    </div>`);
};

window.renameAttachment = function(targetId, attachmentId) {
  const item = (o[targetId] || []).find(x => x.id === attachmentId);
  if (!item) return;
  document.getElementById('foxy-rename-modal')?.remove();
  const current = item.name || item.file?.name || 'ملف';
  const kind = item.kind === 'image' ? 'صورة' : item.kind === 'video' ? 'فيديو' : item.kind === 'voice' ? 'رسالة صوتية' : item.kind === 'audio' ? 'ملف صوتي' : 'ملف';
  const wrap = document.createElement('div');
  wrap.id = 'foxy-rename-modal';
  wrap.className = 'fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm';
  wrap.innerHTML = `
    <div class="w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-[#0b0d12] shadow-2xl">
      <div class="px-5 py-4 border-b border-white/10">
        <h3 class="text-sm font-black text-white">✎ تغيير اسم ${escapeForAttribute(kind)}</h3>
        <p class="text-[11px] text-gray-400 mt-0.5">الاسم اللي يظهر للم其他人 في الشات</p>
      </div>
      <div class="px-5 py-4">
        <input id="foxy-rename-input" type="text" maxlength="90" value="${escapeForAttribute(current)}"
               class="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-3 py-2.5 text-sm text-white outline-none transition"
               placeholder="اسم الملف">
        <div id="foxy-rename-hint" class="text-[10px] text-gray-500 mt-1.5"></div>
      </div>
      <div class="px-5 py-4 bg-black/20 border-t border-white/10 flex items-center gap-2 justify-end">
        <button type="button" id="foxy-rename-cancel" class="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition">إلغاء</button>
        <button type="button" id="foxy-rename-save" class="px-5 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white transition active:scale-95">حفظ الاسم</button>
      </div>
    </div>`;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = ev => {
    if (ev.key === 'Escape') { close(); return; }
    if (ev.key === 'Enter') { save(); }
  };
  const input = wrap.querySelector('#foxy-rename-input');
  const hint = wrap.querySelector('#foxy-rename-hint');
  const ext = (() => {
    const m = String(current).match(/(\.[A-Za-z0-9]{1,8})$/);
    return m ? m[1] : '';
  })();
  const base = ext ? current.slice(0, -ext.length) : current;
  hint.textContent = ext ? `الامتداد (${ext}) هيفضل زي ما هو` : 'مفيش امتداد — اكتب أي اسم';
  input.addEventListener('input', () => {

    const v = input.value.trim();
    if (ext && v && !/\.[A-Za-z0-9]{1,8}$/.test(v)) {
      hint.textContent = `الامتداد (${ext}) هيتضاف تلقائياً`;
    } else {
      hint.textContent = ext ? `الامتداد (${ext}) هيفضل زي ما هو` : 'مفيز امتداد — اكتب أي اسم';
    }
  });
  const save = () => {
    let v = input.value.trim();
    if (!v) { input.focus(); return; }

    if (ext && !/\.[A-Za-z0-9]{1,8}$/.test(v)) v += ext;
    item.name = v;
    item.userNamed = true;
    close();
    d(targetId);
    window.showFoxyToast && window.showFoxyToast({
      id: 'att-rename', tone: 'success', duration: 2600,
      title: '✅ تم تغيير الاسم', body: v
    });
  };
  wrap.querySelector('#foxy-rename-save').addEventListener('click', save);
  wrap.querySelector('#foxy-rename-cancel').addEventListener('click', close);
  wrap.addEventListener('click', ev => { if (ev.target === wrap) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(wrap);
  setTimeout(() => {
    input.focus();

    try { input.setSelectionRange(0, base.length); } catch (_) {}
  }, 40);
};
window.toggleAttachmentOneTime = function(targetId, attachmentId) {
  const item = (o[targetId] || []).find(entry => entry.id === attachmentId);
  if (!item) return;
  item.oneTime = !item.oneTime;
  d(targetId);
};
window.editAttachment = function(targetId, attachmentId) {
  const item = (o[targetId] || []).find(x => x.id === attachmentId);
  if (item && item.kind && item.kind !== "image" && window.FoxyMedia?.openPicker) {
    window.removeAttachment(targetId, attachmentId);
    window.FoxyMedia.openPicker(targetId);
    return;
  }
  const input = document.getElementById('image-upload-input');
  if (!input) return;
  input.setAttribute('data-target', targetId);
  input.setAttribute('data-replace-id', attachmentId);
  input.click();
};

window.getAttachments = function(targetId) {
  return (o[targetId] || []).map(item => ({ ...item, oneTime: !!item.oneTime }));
};
window.clearAttachments = function(targetId) {
  const items = o[targetId] || [];
  items.forEach(item => {
    if (item.preview) URL.revokeObjectURL(item.preview);
    if (item._localUrl) URL.revokeObjectURL(item._localUrl);
  });
  o[targetId] = [];
  d(targetId);
};
window.removeAttachment = function(targetId, attachmentId) {
  const items = o[targetId] || [];
  const index = items.findIndex(item => item.id === attachmentId);
  if (index < 0) return;
  const item = items[index];
  if (item.xhr && item.status === 'uploading') item.xhr.abort();
  item.preview && URL.revokeObjectURL(item.preview);
  item._localUrl && URL.revokeObjectURL(item._localUrl);
  items.splice(index, 1);
  d(targetId);
};
window.waitForAttachments = async function(targetId, timeoutMs = 120000) {
  const startedAt = Date.now();
  while ((o[targetId] || []).some(item => item.status === 'uploading')) {
    if (Date.now() - startedAt >= timeoutMs) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return window.getAttachments(targetId);
};

export function compressImage(file, maxWidth = 1920, maxHeight = 1920) {
  return new Promise((resolve, reject) => {
    if (!file || file.type === 'image/gif') return resolve(file);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = h * maxWidth / w; w = maxWidth; }
      if (h > maxHeight) { w = w * maxHeight / h; h = maxHeight; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Compression failed'));
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

export function uploadToImgBB(file, onProgress, onXhr) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.imgbb.com/1/upload?key=c69e6bed5411d61fc96f4ec1df949ae6');
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round(e.loaded / e.total * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          res.success ? resolve({ url: res.data.url, delete_url: res.data.delete_url }) : reject(new Error('ImgBB error: ' + res.error.message));
        } catch (e) { reject(new Error('Failed to parse ImgBB response')); }
      } else reject(new Error('ImgBB upload failed with status: ' + xhr.status));
    };
    xhr.onerror = () => reject(new Error('ImgBB network error'));
    if (onXhr) onXhr(xhr);
    const fd = new FormData();
    fd.append('image', file);
    xhr.send(fd);
  });
}
