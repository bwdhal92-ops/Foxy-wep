window.chatHistory || (window.chatHistory = []);
var e = window.chatHistory;
import {
  createMessageHTML as t
} from "./ui-chatcore.js?v=20260929-2";
import { escapeForAttribute } from "./sanitize.js";
const n = document.getElementById("chat-messages");

function i(e) {
  return window.parseTimeMentions && window.parseTimeMentions !== i ? window.parseTimeMentions(e) : e && "string" == typeof e ? e.replace(/<t:(\d+):([tTdDfFR])>/g, (e, t, n) => window.getFormattedTimeLabel ? window.getFormattedTimeLabel(parseInt(t), n) : e) : e
}

function o(e, o, s, d = !1, r = !1) {
  const a = document.createElement("div"),
    m = i(o),
    w = window.currentUserProfile || {},
    c = w.uid || "",
    l = "vmsg-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    u = o && c && (o.includes(`<@${c}>`) || o.includes("@everyone") || o.includes("@here"));
  a.className = "flex w-full mb-1 group", u && a.classList.add("mention-highlight"), a.innerHTML = t({
    myUid: c,
    senderUid: r ? c : "other-" + l,
    senderName: e,
    senderPhotoURL: r && w.photoURL || "",
    timestamp: Date.now(),
    text: m,
    isForwarded: !1,
    replyTo: null,
    edited: !1,
    hasPendingWrites: !1,
    context: "dm",
    messageId: l
  }), n.appendChild(a), window.processPostRenderLinks && window.processPostRenderLinks(a), requestAnimationFrame(() => {
    n.scrollTop = n.scrollHeight
  })
}
n && (n.innerHTML = ""), window.addChatMsg = function(t, n, i = !1, r = "") {
  const s = (new Date).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit"
  });
  o(t, n, 0, !1, i), i || e.push({
    name: t,
    text: n,
    time: s,
    isSystem: !1
  });
  if (!i) {
    window.showChatToast(t, n, r);
    window.incrementChatUnread && window.incrementChatUnread()
  }
}, window.appendMessageUI = o, window.addSystemMsg = function(e, t) {
  if (!e) return;
  try {
    var n = document.getElementById("chat-messages");
    if (n) {
      var r = document.createElement("div");
      r.className = "flex items-center gap-2 px-4 py-1.5 w-full";
      var c = "text-gray-400";
      "error" === t && (c = "text-red-400"), "warning" === t && (c = "text-amber-400"), "success" === t && (c = "text-emerald-400"), "info" === t && (c = "text-blue-400");
      var l = document.createElement("span");
      l.className = "text-xs " + c, l.innerText = e, r.appendChild(l), n.appendChild(r), requestAnimationFrame(function() { n.scrollTop = n.scrollHeight; });
      var d = window.chatHistory;
      d && d.push({name:"",text:e,time:new Date().toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"}),isSystem:!0});
    }
  } catch(e) {}
}, window.isMessageInChat = function(t, n) {
  return e.some(e => e.text === t && e.time === n)
};
window.chatUnreadCount = 0;
window.showChatToast = function(e, t, n) {
  const i = document.getElementById("chat-toast-container");
  if (!i) return;
  const o = document.createElement("div");
  o.className = "chat-toast bg-[#1a1b1e]/90 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl transition-all duration-500 hover:bg-[#1a1b1e]";
  const safeName = escapeForAttribute(e);
  const safeMsg = escapeForAttribute(t.length > 60 ? t.substring(0, 60) + "..." : t);
  const a = n ? `<img class="w-7 h-7 rounded-full object-cover flex-shrink-0" src="${escapeForAttribute(n)}" alt="">` : `<div class="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold flex-shrink-0">${safeName.charAt(0)}</div>`;
  o.innerHTML = '<div class="flex items-center gap-2.5">' + a + '<div class="flex flex-col min-w-0"><span class="text-xs font-bold text-white truncate">' + safeName + '</span><span class="text-[11px] text-gray-300 truncate">' + safeMsg + '</span></div></div>';
  o.addEventListener("click", function() {
    window.toggleVoiceChatOverlay()
  });
  setTimeout(function() {
    o.classList.add("removing");
    setTimeout(function() {
      o.remove()
    }, 300)
  }, 4000)
  i.appendChild(o);
};
window.incrementChatUnread = function() {
  window.chatUnreadCount = (window.chatUnreadCount || 0) + 1;
  const e = document.getElementById("chat-unread-badge");
  if (e) {
    e.textContent = window.chatUnreadCount > 99 ? "99+" : window.chatUnreadCount;
    e.classList.remove("hidden")
  }
  window.syncReadAllNotificationsButton?.();
};

window.showChatToast = function(name, message, photoURL) {
  const container = document.getElementById("chat-toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "chat-toast bg-[#1a1b1e]/90 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl transition-all duration-500 hover:bg-[#1a1b1e]";
  const row = document.createElement("div");
  row.className = "flex items-center gap-2.5";
  const avatar = document.createElement("div");
  avatar.className = "w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold flex-shrink-0";
  avatar.textContent = String(name || "?").slice(0, 1);
  try {
    const parsed = new URL(String(photoURL || ""), window.location.origin);
    if (["http:", "https:"].includes(parsed.protocol)) {
      const image = document.createElement("img");
      image.className = "w-7 h-7 rounded-full object-cover flex-shrink-0";
      image.src = parsed.href; image.alt = ""; row.appendChild(image);
    } else row.appendChild(avatar);
  } catch { row.appendChild(avatar); }
  const content = document.createElement("div");
  content.className = "flex flex-col min-w-0";
  const title = document.createElement("span");
  title.className = "text-xs font-bold text-white truncate"; title.textContent = String(name || "");
  const body = document.createElement("span");
  body.className = "text-[11px] text-gray-300 truncate"; body.textContent = String(message || "").slice(0, 60);
  content.append(title, body); row.append(content); toast.appendChild(row);
  toast.onclick = () => window.toggleVoiceChatOverlay?.();
  setTimeout(() => { toast.classList.add("removing"); setTimeout(() => toast.remove(), 300); }, 4000);
  container.appendChild(toast);
};

window.showChatToast = function(name, message, photoURL) {
  const container = document.getElementById("chat-toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "chat-toast bg-[#1a1b1e]/90 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl transition-all duration-500 hover:bg-[#1a1b1e]";
  const row = document.createElement("div");
  row.className = "flex items-center gap-2.5";
  const avatar = document.createElement("div");
  avatar.className = "w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold flex-shrink-0";
  avatar.textContent = String(name || "?").slice(0, 1);
  try {
    const parsed = new URL(String(photoURL || ""), window.location.origin);
    if (["http:", "https:"].includes(parsed.protocol)) {
      const image = document.createElement("img");
      image.className = "w-7 h-7 rounded-full object-cover flex-shrink-0";
      image.src = parsed.href;
      image.alt = "";
      row.appendChild(image);
    } else row.appendChild(avatar);
  } catch { row.appendChild(avatar); }
  const content = document.createElement("div");
  content.className = "flex flex-col min-w-0";
  const title = document.createElement("span");
  title.className = "text-xs font-bold text-white truncate";
  title.textContent = String(name || "");
  const body = document.createElement("span");
  body.className = "text-[11px] text-gray-300 truncate";
  body.textContent = String(message || "").slice(0, 60);
  content.append(title, body); row.append(avatar, content); toast.appendChild(row);
  toast.addEventListener("click", () => window.toggleVoiceChatOverlay?.());
  setTimeout(() => { toast.classList.add("removing"); setTimeout(() => toast.remove(), 300); }, 4000);
  container.appendChild(toast);
};
window.chatUnreadCount = 0;
window.showChatToast = function(e, t, n) {
  const i = document.getElementById("chat-toast-container");
  if (!i) return;
  const o = document.createElement("div");
  o.className = "chat-toast bg-[#1a1b1e]/90 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl transition-all duration-500 hover:bg-[#1a1b1e]";
  const a = n ? `<img class="w-7 h-7 rounded-full object-cover flex-shrink-0" src="${n}" alt="">` : `<div class="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold flex-shrink-0">${e.charAt(0)}</div>`;
  const r = (t.length > 60 ? t.substring(0, 60) + "..." : t).replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  o.innerHTML = '<div class="flex items-center gap-2.5">' + a + '<div class="flex flex-col min-w-0"><span class="text-xs font-bold text-white truncate">' + e.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</span><span class="text-[11px] text-gray-300 truncate">' + r + '</span></div></div>';
  i.appendChild(o);
  o.onclick = function() {
    window.toggleVoiceChatOverlay()
  };
  setTimeout(function() {
    o.classList.add("removing");
    setTimeout(function() {
      o.remove()
    }, 300)
  }, 4000)
};
window.incrementChatUnread = function() {
  window.chatUnreadCount = (window.chatUnreadCount || 0) + 1;
  const e = document.getElementById("chat-unread-badge");
  if (e) {
    e.textContent = window.chatUnreadCount > 99 ? "99+" : window.chatUnreadCount;
    e.classList.remove("hidden")
  }
  window.syncReadAllNotificationsButton?.();
};
