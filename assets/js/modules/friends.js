import {
  db as e,
  auth as t,
  rtdb as n
} from "../firebase-config.js";
import {
  collection as i,
  doc as s,
  query as o,
  where as a,
  getDocs as r,
  addDoc as d,
  onSnapshot as c,
  setDoc as l,
  getDoc as u,
  updateDoc as m,
  arrayUnion as p,
  arrayRemove as f,
  serverTimestamp as w
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
  ref as g,
  onValue as y
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import {
  createAvatarHTML as h,
  createAvatarWrapper as x
} from "./ui-avatar-banner.js?v=20260929-2";
let b, v, U, L, C = {},
  M = {},
  E = {},
  T = {},
  k = new Map,
  I = {},
  N = [],
  B = 0;
async function S(n, c = !1) {
  const l = t.currentUser?.uid;
  if (!l) return;
  let m = null,
    p = null;
  try {
    if (c) {
      const t = s(e, "users", n);
      if (m = await u(t), !m.exists()) return void alert(window.__fb("app_friends.user_not_found", "لم يتم العثور على هذا المستخدم."));
      p = m.data()
    } else {
      const t = i(e, "users"),
        s = o(t, a("fullTag", "==", n)),
        d = await r(s);
      if (d.empty) return void alert(window.__fb("app_friends.user_not_found_with_tag", "لم يتم العثور على مستخدم بهذا الاسم والمعرف."));
      m = d.docs[0], p = m.data()
    }
    if (p.uid === l) return void alert(window.__fb("app_friends.cannot_add_self", "لا يمكنك إرسال طلب صداقة لنفسك."));
    if (p.friends && p.friends.includes(l)) return void alert(window.__fb("app_friends.already_friends", "أنتم أصدقاء بالفعل."));
    if (p.blocked && p.blocked.includes(l)) return void alert(window.__fb("app_friends.cannot_send_request", "لا يمكنك إرسال طلب صداقة لهذا المستخدم."));
    const t = i(e, "friend_requests"),
      f = o(t, a("fromUid", "==", l), a("toUid", "==", p.uid), a("status", "==", "pending"));
    if (!(await r(f)).empty) return void alert(window.__fb("app_friends.request_pending", "لقد قمت بإرسال طلب صداقة مسبقاً وهو قيد الانتظار."));
    await d(i(e, "friend_requests"), {
      fromUid: l,
      toUid: p.uid,
      status: "pending",
      timestamp: w()
    }), alert(window.__fb("app_friends.request_sent", "تم إرسال طلب الصداقة إلى ") + (p.fullTag||p.displayName) + "!")
  } catch (e) {
    alert(window.__fb("app_friends.request_error", "حدث خطأ أثناء إرسال الطلب."))
  }
}
window.getAllFriendTargets = () => {
  const e = new Set(window.myRemovedFriends || []);
  return Object.values(T).filter(t => !e.has(t.uid)).map(e => ({
    id: e.uid,
    name: e.displayName || window.__fb("app_chat.default_sender", "مستخدم"),
    type: "dm",
    photoURL: e.photoURL
  }))
}, document.addEventListener("UserProfileLoaded", e => {
  const t = e.detail;
  t && H(t.uid)
}), window.myFriendsTags = [], window.myFriendsUids = [], document.addEventListener("DOMContentLoaded", () => {
  const e = document.getElementById("add-friend-btn"),
    t = document.getElementById("friend-tag-input");
  b = document.getElementById("my-friends-list"), v = document.getElementById("online-friends-list"), U = document.getElementById("sidebar-dm-list"), L = document.getElementById("incoming-requests-list"), e && t && e.addEventListener("click", async () => {
    const n = t.value.trim();
    n.includes("#") ? (e.disabled = !0, await S(n), t.value = "", e.disabled = !1) : alert(window.__fb("js.enter_tag", "الرجاء إدخال الاسم مع المعرف، مثال: User#1234"))
  })
});
let R = !1;

function H(t) {
  if (R === t) return;
  R = t,
    function(t) {
      const n = i(e, "invitations"),
        r = o(n, a("toUid", "==", t), a("status", "==", "pending"));
      c(r, t => {
        t.docChanges().forEach(t => {
          if ("added" === t.type) {
            const n = t.doc.data();
            ! function(t, n) {
              const i = document.getElementById("room-invite-toast"),
                o = document.getElementById("invite-message-text"),
                a = document.getElementById("accept-invite-btn"),
                r = document.getElementById("decline-invite-btn");
              if (!(i && o && a && r)) return;
              o.innerText = window.__f("js.room_invite", {name: n.fromName}, `${n.fromName} يدعوك للانضمام إلى الغرفة الخاصة به.`), i.classList.remove("hidden"), setTimeout(() => {
                i.classList.remove("opacity-0", "-translate-y-4"), i.classList.add("opacity-100", "translate-y-0")
              }, 10);
              const d = async n => {
                i.classList.remove("opacity-100", "translate-y-0"), i.classList.add("opacity-0", "-translate-y-4"), setTimeout(() => i.classList.add("hidden"), 500);
                try {
                  await m(s(e, "invitations", t), {
                    status: n
                  })
                } catch (e) {}
              };
              a.onclick = () => {
                d("accepted");
                const e = document.getElementById("peer-id-input"),
                  t = document.getElementById("call-btn");
                e && t && (e.value = n.roomId, t.click())
              }, r.onclick = () => {
                d("declined")
              }
            }(t.doc.id, n)
          }
        })
      })
    }(t),
    function(t) {
      const n = i(e, "direct_messages"),
        s = o(n, a("participants", "array-contains", t));
      c(s, async e => {
        if (!U) return;
        B++;
        const n = B;
        if (e.empty) return void(U && (U.innerHTML = '<p class="text-xs text-gray-400 text-center py-4 opacity-85 font-bold">' + window.__fb("js.no_chats", "لا توجد محادثات بعد") + '</p>'));
        const i = new Map;
        e.forEach(e => {
          const n = e.data(),
            s = (Array.isArray(n.participants) ? n.participants : []).find(e => e !== t);
          const isGroup = !!n.isGroup && Array.isArray(n.participants) && n.participants.length > 2,
            key = isGroup ? `group:${e.id}` : s;
          if (!key) return;
          const o = j(n.timestamp),
            a = n.messageCount || 0,
            r = i.get(key);
          (!r || o > r.ms) && i.set(key, {
            uid: key,
            ts: n.timestamp,
            ms: o,
            docId: e.id,
            isGroup,
            groupName: n.groupName || window.__fb("js.group_call", "مكالمة جماعية"),
            groupParticipants: n.participants || [],
            messageCount: a,
            lastSenderId: n.lastSenderId,
            lastMessageText: n.lastMessageText,
            lastSenderName: n.lastSenderName
          }), a > (k.get(e.id) || 0) && (n.lastSenderId && n.lastSenderId !== t && (window.currentChatDocId === e.id && "hidden" !== document.visibilityState || function(e, t, n, i) {
            if (!("Notification" in window)) return;
            if ("granted" !== Notification.permission) return;
            "function" == typeof window.playChannelSound && window.playChannelSound("message");
            const s = window.__f("js.new_msg", {name: e}, `رسالة جديدة من ${e}`);
            let o = t;
            n && Array.isArray(n) && n.length > 1 && (o = n.map(e => `${e.senderName}: ${e.text}`).join("\n"));
            const a = {
              body: o,
              icon: "/assets/img/foxy.png",
              badge: "/assets/img/foxy.png",
              tag: `dm-notif-${i||"global"}`,
              renotify: !0,
              data: {
                url: (function () {
                  try {
                    var u = new URL(window.location.href);
                    if (i) u.hash = "dm-" + encodeURIComponent(i);
                    return u.toString();
                  } catch (_) {
                    return window.location.href;
                  }
                })(),
                friendUid: i
              }
            };
            if ("serviceWorker" in navigator) navigator.serviceWorker.ready.then(e => {
              e.showNotification(s, a).then(() => {}).catch(e => {})
            });
            else try {
              const e = new Notification(s, a);
              e.onclick = () => {
                window.focus(), e.close()
              }
            } catch (e) {}
          }(n.lastSenderName || window.__fb("app_chat.default_sender", "مستخدم"), n.lastMessageText || window.__fb("js.sent_msg", "أرسل لك رسالة"), n.lastMessages, key)), k.set(e.id, a))
        });
        const s = new Set(window.myRemovedFriends || []),
          o = Array.from(i.values()).filter(e => e.isGroup || !s.has(e.uid)).sort((e, t) => t.ms - e.ms);
        N = o, 0 !== o.length ? P(t, o, n) : U && (U.innerHTML = '<p class="text-xs text-gray-400 text-center py-4 opacity-85 font-bold">' + window.__fb("js.no_chats", "لا توجد محادثات بعد") + '</p>')
      })
    }(t),
    function(t) {
      const n = i(e, "friend_requests"),
        r = o(n, a("toUid", "==", t), a("status", "==", "pending"));
      c(r, async t => {
        if (!L) return;
        L.innerHTML = "";
        const n = document.getElementById("requests-badge"),
          i = t.size;
        if (n && (i > 0 ? (n.textContent = i > 9 ? "9+" : i, n.classList.remove("hidden")) : n.classList.add("hidden")), "function" == typeof window.updateHomeUnreadBadge && (window.homeUnreadCounts.friendRequests = i, window.updateHomeUnreadBadge()), "function" == typeof window.updateOnlineFriendCounters && window.updateOnlineFriendCounters(), t.empty) L.innerHTML = '<p class="text-xs text-gray-400 text-center py-4 opacity-85 font-bold">' + window.__fb("app_friends.no_pending_requests", "لا يوجد طلبات معلقة") + '</p>';
        else
          for (const n of t.docs) {
            const t = n.data(),
              i = n.id;
            try {
              const n = await u(s(e, "users", t.fromUid));
              q(i, n.exists() ? {
                uid: t.fromUid,
                ...n.data()
              } : {
                uid: t.fromUid,
                displayName: window.__fb("app_chat.default_sender", "مستخدم"),
                tag: "----",
                photoURL: ""
              })
            } catch {
              q(i, {
                uid: t.fromUid,
                displayName: window.__fb("app_chat.default_sender", "مستخدم"),
                tag: "----",
                photoURL: ""
              })
            }
          }
      })
    }(t);
  const r = g(n, "/voice_presence/dms/");
  y(r, e => {
    M = e.val() || {}, "function" == typeof window.refreshDmSidebar && window.refreshDmSidebar(), D()
  }), c(s(e, "users", t), async t => {
    if (t.exists() && b) {
      const i = t.data(),
        o = i.friends || [],
        a = new Set(o);
      Object.keys(E).forEach(e => {
        a.has(e) || ("function" == typeof E[e] && E[e](), delete E[e], delete C[e], delete T[e])
      }), window.myFriendsTags = [], window.myFriendsUids = o, window.myRemovedFriends = i.removed_friends || [];
      const r = o.filter(e => !T[e]);
      if (r.length > 0) {
        const t = 8;
        for (let n = 0; n < r.length; n += t) {
          const i = r.slice(n, n + t);
          try {
            await Promise.all(i.map(async t => {
              const n = await u(s(e, "users", t));
              n.exists() && (T[t] = {
                uid: t,
                ...n.data()
              })
            }))
          } catch (e) {}
          await new Promise(e => setTimeout(e, 0))
        }
      }
      for (const e of o) {
        const t = T[e];
        if (t && t.fullTag && !window.myFriendsTags.includes(t.fullTag) && window.myFriendsTags.push(t.fullTag), !E[e]) {
          const t = g(n, `/status/${e}`);
          E[e] = y(t, t => {
            C[e] = t.val(), D()
          })
        }
      }
      D()
    }
  }, e => {})
}
window.currentUserProfile && window.currentUserProfile.uid && H(window.currentUserProfile.uid), document.addEventListener("UserProfileLoaded", e => {
  const t = e.detail;
  t && t.uid && H(t.uid)
});
let F = null;

function D() {
  b && (F && cancelAnimationFrame(F), F = requestAnimationFrame(() => {
    b.innerHTML = "", v && (v.innerHTML = "");
    const e = Object.keys(T),
      t = new Set(window.myRemovedFriends || []),
      n = e.filter(e => !t.has(e));
    if (0 === n.length) return b.innerHTML = '<p class="text-xs text-gray-400 text-center py-4 opacity-85">' + window.__fb("app_home_tabs.no_friends_yet", "ليس لديك أصدقاء بعد") + '</p>', void(v && (v.innerHTML = '<p class="text-xs text-gray-400 text-center py-4 opacity-85">' + window.__fb("app_home_tabs.no_friends_online", "لا يوجد أصدقاء متصلون حالياً") + '</p>'));
    let i = 0;
    for (const e of n) {
      const t = T[e];
      t && (z(t, b) && v && (z(t, v), i++))
    }
    0 === i && v && (v.innerHTML = '<p class="text-xs text-gray-400 text-center py-4 opacity-85">' + window.__fb("app_home_tabs.no_friends_online", "لا يوجد أصدقاء متصلون حالياً") + '</p>')
  }))
}

function j(e) {
  return e ? "number" == typeof e ? e : "function" == typeof e.toMillis ? e.toMillis() : "number" == typeof e.seconds ? 1e3 * e.seconds : 0 : 0
}

function _(e, t) {
  const n = function(e) {
      if (!e || "function" != typeof e.toDate) return window.__fb("js.no_time", "بدون وقت");
      try {
        return e.toDate().toLocaleString("ar-EG", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit"
        })
      } catch {
        return window.__fb("js.no_time", "بدون وقت")
      }
    }(t),
    i = e.displayName || window.__fb("app_chat.default_sender", "مستخدم"),
    s = (e.tag, () => {
      e.isGroup && typeof window.openDirectGroupMessage === 'function' ? window.openDirectGroupMessage(e.docId, e.groupParticipants, i) : window.openDirectMessage && window.openDirectMessage(e.uid, i)
    });
  if (U) {
    const t = C[e.uid];
    let o = t && "online" === t.state;
    if (o && t.last_changed) {
      const e = j(t.last_changed);
      Date.now() - e > 12e4 && (o = !1)
    }
    const a = o ? "bg-emerald-500" : "bg-gray-500",
      r = e.isGroup ? window.currentChatDocId === e.docId : window.currentOpenedDmUid === e.uid,
      d = !e.isGroup && !window.activeDmGroupCallId && window.activeCallFriendUid === e.uid,
      c = M[e.uid] && M[e.uid].inCall,
      l = c ? M[e.uid].mode : null,
      u = document.createElement("button");
    if (u.type = "button", u.className = "sidebar-dm-item " + (r || d ? "sidebar-dm-item-active" : ""), u.setAttribute("data-uid", e.uid), e.docId && u.setAttribute("data-doc-id", e.docId), u.setAttribute("data-message-count", String(e.messageCount || 0)), r || d) {
      const t = "function" == typeof window.getColorFromUid ? window.getColorFromUid(e.uid) : "59, 130, 246";
      u.style.setProperty("--dm-accent-rgb", t)
    }
    u.innerHTML = `\n            ${x(h(e.photoURL,i,{size:8,shape:"rounded-lg",border:"border border-white/10"}),{statusDot:!0,statusColor:a,statusSize:"w-2.5 h-2.5",statusBorder:"border-2 border-[#2b2d31]",wrapperExtra:"shrink-0"})}\n            <div class="flex flex-col min-w-0 flex-1 relative pr-1 text-right">\n                <div class="flex items-center justify-between gap-1">\n                    <span class="text-xs font-bold ${e.unreadCount?"text-white":"text-gray-300"} truncate">${i}</span>\n                    <div class="flex items-center gap-1">\n                        ${d?'\n                            <div class="bg-emerald-500 text-white p-0.5 rounded-md animate-pulse shadow-sm" title="' + window.__fb("js.in_call_with", "أنت معه في مكالمة") + '">\n                                <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">\n                                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 004.529 4.53l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path>\n                                </svg>\n                            </div>\n                        ':c?`\n                            <div class="${"calling"===l?"bg-amber-500/20 text-amber-500":"bg-white/10 text-emerald-400"} p-0.5 rounded-md shadow-sm" title="${"calling"===l?window.__fb("js.waiting_answer", "في انتظار الرد..."):window.__fb("js.in_other_call", "في مكالمة أخرى")}">\n                                <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">\n                                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 004.529 4.53l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path>\n                                </svg>\n                            </div>\n                        `:""}\n                    </div>\n                </div>\n                <span class="text-[10px] text-gray-400 truncate">${n}</span>\n                ${e.unreadCount?`<div class="absolute left-0 top-1/2 -translate-y-1/2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md animate-pop-in">${e.unreadCount>99?"99+":e.unreadCount}</div>`:""}\n            </div>\n        `, u.addEventListener("click", s), U.appendChild(u)
  }
}
async function P(t, i, o) {
  if (B !== o) return;
  const a = i.filter(e => !e.isGroup && !T[e.uid]).map(e => e.uid);
  if (a.length > 0) try {
    await Promise.all(a.map(async t => {
      const n = await u(s(e, "users", t));
      n.exists() && (T[t] = {
        uid: t,
        ...n.data()
      })
    }))
  } catch (e) {}
  if (B !== o) return;
  let r = 0;
  const d = [];
  for (const n of i) {
    let i = 0;
    const o = parseInt(localStorage.getItem(`dmReadCount_${t}_${n.docId}`)) || 0;
    n.messageCount > o && (window.currentChatDocId === n.docId ? (localStorage.setItem(`dmReadCount_${t}_${n.docId}`, n.messageCount.toString()), i = 0) : (i = n.messageCount - o, r += i)), !n.isGroup && (I[n.uid] || (I[n.uid] = c(s(e, "users", n.uid), e => {
      if (e.exists()) {
        const i = {
          uid: n.uid,
          ...e.data()
        };
        if (!T[n.uid] || T[n.uid].displayName !== i.displayName || T[n.uid].photoURL !== i.photoURL) {
          T[n.uid] = i;
          const e = ++B;
          P(t, N, e)
        }
      }
    })));
    const a = n.isGroup ? {
      uid: n.uid,
      displayName: n.groupName || window.__fb("js.group_call", "مكالمة جماعية"),
      tag: window.__f("js.participants", {n: n.groupParticipants?.length || 0}, `${n.groupParticipants?.length || 0} مشاركين`),
      photoURL: "",
      isGroup: true,
      groupParticipants: n.groupParticipants || [],
      unreadCount: i
    } : T[n.uid] || {
      uid: n.uid,
      displayName: window.__fb("app_chat.default_sender", "مستخدم"),
      tag: "----",
      photoURL: "",
      unreadCount: i
    };
    a.unreadCount = i, a.docId = n.docId, a.isGroup = !!n.isGroup, a.groupParticipants = n.groupParticipants || [], a.groupName = n.groupName || a.groupName, a.messageCount = n.messageCount, d.push({
      friendData: a,
      ts: n.ts
    })
  }
  requestAnimationFrame(() => {
    U && (U.innerHTML = "");
    for (const e of d) _(e.friendData, e.ts);
    "function" == typeof window.updateHomeUnreadBadge && (window.homeUnreadCounts.dms = r, window.updateHomeUnreadBadge()), "function" == typeof window.updateOnlineFriendCounters && window.updateOnlineFriendCounters()
  }), i.forEach(e => {
    if (!E[e.uid]) {
      const t = g(n, `/status/${e.uid}`);
      E[e.uid] = y(t, t => {
        const n = t.val();
        if (C[e.uid] = n, D(), U) {
          const t = U.querySelector(`[data-uid="${e.uid}"]`);
          if (t) {
            const e = t.querySelector(".absolute.-bottom-1.-right-1");
            if (e) {
              const t = n && "online" === n.state && (!n.last_changed || Date.now() - n.last_changed < 12e4);
              e.classList.toggle("bg-emerald-500", t), e.classList.toggle("bg-gray-500", !t)
            }
          }
        }
      })
    }
  })
}

function q(e, t) {
  const n = document.createElement("div");
  n.className = "flex items-center justify-between bg-slate-800/50 p-3 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition", n.innerHTML = `\n        <div class="flex items-center gap-3">\n            ${h(t.photoURL,t.displayName,{size:10,shape:"rounded-xl",border:"border border-white/10"})}\n            <div class="flex flex-col">\n                <span class="text-sm font-bold text-white">${t.displayName}</span>\n                <span class="text-xs text-gray-400">#${t.tag}</span>\n                <span class="text-[10px] text-yellow-500/80 mt-0.5">${window.__fb("js.req_pending", "⏳ طلب صداقة معلق")}</span>\n            </div>\n        </div>\n        <div class="flex gap-1.5">\n            <button onclick="handleRequest('${e.replace(/'/g,"\\'")}', '${t.uid.replace(/'/g,"\\'")}', 'accept')" class="p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 rounded-xl transition" title="${window.__fb("web.t272", "قبول")}">\n                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>\n            </button>\n            <button onclick="handleRequest('${e.replace(/'/g,"\\'")}', '${t.uid.replace(/'/g,"\\'")}', 'reject')" class="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-xl transition" title="${window.__fb("web.t214", "رفض")}">\n                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>\n            </button>\n        </div>\n    `, L.appendChild(n)
}

function z(e, t) {
  const n = document.createElement("div");
  n.className = "flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5 mt-2 transition hover:bg-white/10 cursor-pointer";
  let i = !1,
    s = window.__fb("app_network.disconnected", "غير متصل"),
    o = "bg-gray-500";
  const a = C[e.uid];
  if (a && a.state && (i = "online" === a.state, i && a.last_changed)) {
    const e = j(a.last_changed);
    Date.now() - e > 12e4 && (i = !1)
  }
  i && (window.__fb("js.recently", "متصل مؤخراً"), o = "bg-emerald-500");
  const r = document.createElement("div");
  r.className = "flex gap-1";
  const d = document.createElement("button");
  d.onclick = () => {
    window.openDirectMessage && window.openDirectMessage(e.uid, e.displayName)
  }, d.className = "p-2 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl text-emerald-400 transition", d.title = window.__fb("web.t293", "مراسلة"), d.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>';
  const c = document.createElement("div");
  c.className = "relative";
  const l = document.createElement("button");
  return l.className = "p-2 text-gray-400 hover:bg-white/10 rounded-xl transition", l.title = window.__fb("js.more", "المزيد"), l.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>', l.addEventListener("click", t => {
    t.stopPropagation(), document.querySelectorAll(".friend-action-menu").forEach(e => e.remove());
    const n = document.createElement("div");
    n.className = "friend-action-menu fixed flex flex-col bg-slate-800/95 border border-white/10 rounded-xl shadow-2xl w-36 overflow-hidden z-[9999] backdrop-blur-md", n.innerHTML = `\n            <button onclick="window.removeFriend('${e.uid.replace(/'/g,"\\'")}')" class="px-4 py-2.5 text-xs text-right text-red-400 hover:bg-red-500/10 transition border-b border-white/5">${window.__fb("js.remove_friend_btn", "🗑 حذف الصديق")}</button>\n            <button onclick="window.blockUser('${e.uid.replace(/'/g,"\\'")}')" class="px-4 py-2.5 text-xs text-right text-orange-400 hover:bg-orange-500/10 transition">${window.__fb("js.block_btn", "⛔ حظر")}</button>\n        `;
    const i = l.getBoundingClientRect();
    n.style.top = `${i.bottom+6}px`, n.style.left = i.left - 80 + "px", document.body.appendChild(n);
    const s = e => {
      n.contains(e.target) || (n.remove(), document.removeEventListener("click", s, {
        capture: !0
      }))
    };
    setTimeout(() => document.addEventListener("click", s, {
      capture: !0
    }), 10)
  }), c.appendChild(l), r.appendChild(d), r.appendChild(c), n.innerHTML = `\n        ${x(h(e.photoURL,e.displayName,{size:10,shape:"rounded-xl",border:"border border-white/10"}),{statusDot:!0,statusColor:o,statusSize:"w-3 h-3",statusBorder:"border-2 border-slate-900"})}\n        <div class="flex flex-col flex-grow">\n            <span class="text-sm font-bold text-white">${e.displayName}</span>\n            <span class="text-xs text-gray-400">#${e.tag}</span>\n        </div>\n    `, n.appendChild(r), t ? t.appendChild(n) : b.appendChild(n), i
}
window.refreshDmSidebar = () => {
  const e = t.currentUser?.uid;
  e && N.length > 0 && P(e, N, ++B)
}, window.handleRequest = async function(n, i, o) {
  const a = t.currentUser?.uid;
  if (a) try {
    const t = s(e, "friend_requests", n);
    if ("accept" === o) {
      const n = s(e, "users", a);
      await m(n, {
        friends: p(i)
      });
      const o = s(e, "users", i);
      await m(o, {
        friends: p(a)
      }), await m(t, {
        status: "accepted"
      }), alert(window.__fb("js.req_accepted", "تم قبول طلب الصداقة بنجاح!"))
    } else "reject" === o && await m(t, {
      status: "rejected"
    })
  } catch (e) {
    alert(window.__fb("js.req_error", "حدث خطأ أثناء معالجة الطلب."))
  }
}, window.getFriendData = function(e) {
  return T[e] || null
}, window.removeFriend = async function(n) {
  const i = t.currentUser?.uid;
  if (i && await window.uiConfirm(window.__fb("js.confirm_unfriend", "هل أنت متأكد من حذف هذا الصديق؟"))) try {
    const t = s(e, "users", i);
    await m(t, {
      removed_friends: p(n)
    }), alert(window.__fb("js.unfriended", "تم حذف الصديق بنجاح."))
  } catch (e) {
    alert(window.__fb("js.unfriend_err", "حدث خطأ أثناء حذف الصديق."))
  }
}, window.blockUser = async function(n) {
  const i = t.currentUser?.uid;
  if (i && await window.uiConfirm(window.__fb("js.confirm_block", "هل أنت متأكد من حظر هذا المستخدم؟ لن يتمكن من إرسال طلبات صداقة لك مجدداً."))) try {
    const t = s(e, "users", i);
    await m(t, {
      removed_friends: p(n),
      blocked: p(n)
    }), alert(window.__fb("js.blocked", "تم حظر المستخدم بنجاح."))
  } catch (e) {
    alert(window.__fb("js.block_err", "حدث خطأ أثناء حظر المستخدم."))
  }
}, window.inviteFriendToRoom = async function(n) {
  const s = t.currentUser?.uid,
    o = window.currentUserProfile;
  if (s && o && window.currentHostId) try {
    await d(i(e, "invitations"), {
      fromUid: s,
      fromName: o.displayName || window.__fb("js.friend", "صديق"),
      toUid: n,
      roomId: window.currentHostId,
      status: "pending",
      timestamp: w()
    }), alert(window.__fb("js.room_invite_sent", "تم إرسال الدعوة للغرفة بنجاح!"))
  } catch (e) {
    alert(window.__fb("js.room_invite_err", "حدث خطأ أثناء إرسال الدعوة للغرفة."))
  } else alert(window.__fb("js.need_room", "يجب أن تكون متصلاً بغرفة حتى تتمكن من دعوة الأصدقاء."))
}, window.updateMyRoomPresence = async function(n) {
  const i = t.currentUser?.uid;
  if (i) try {
    const t = s(e, "users", i);
    await m(t, {
      currentRoom: n || ""
    })
  } catch (e) {}
}, window.sendFriendRequestFromCtx = async function(e, t = !0) {
  if (!e) return void alert(window.__fb("js.no_user_data", "لا يمكن جلب بيانات المستخدم."));
  const n = document.getElementById("ctx-add-friend");
  n && (n.disabled = !0, n.innerHTML = "<span>" + window.__fb("js.sending", "جاري الإرسال...") + "</span>"), await S(e, t);
  const i = document.getElementById("member-context-menu");
  i && i.classList.add("hidden"), n && (n.disabled = !1, n.innerHTML = "<span>" + window.__fb("app_context_menu.add_friend", "➕ إضافة كصديق") + "</span>")
}, window._updateDisplayName = async function(n) {
  const i = t.currentUser?.uid;
  if (i && n) try {
    const t = s(e, "users", i),
      o = await u(t);
    if (!o.exists()) return;
    const a = `${n}#${o.data().tag||"0000"}`;
    await m(t, {
      displayName: n,
      fullTag: a
    }), window.currentUserProfile && (window.currentUserProfile.displayName = n, window.currentUserProfile.fullTag = a, window.myName = a, document.dispatchEvent(new CustomEvent("UserProfileLoaded", {
      detail: window.currentUserProfile
    })));
    const r = document.getElementById("my-name-tag"),
      d = document.getElementById("current-user-email"),
      mobD = document.getElementById("mobile-current-user-email"),
      c = document.getElementById("settings-name-display"),
      l = n.charAt(0).toUpperCase(),
      p = document.getElementById("sidebar-initial"),
      f = document.getElementById("rail-initial"),
      w = document.getElementById("settings-initial"),
      curPhoto = o.data().photoURL || window.currentUserProfile?.photoURL || "",
      color = "function" == typeof window.resolveProfileColor ? window.resolveProfileColor(i, o.data().avatarColor || o.data().bannerColor) : "",

      setInitial = el => {
        if (!el) return;
        curPhoto || "function" != typeof window.renderFoxyFallback ? (el.innerText = l, el.style.backgroundColor = "") : window.renderFoxyFallback(el, n, color, i)
      };
    r && (r.innerText = n), d && (d.removeAttribute("data-i18n"), d.innerText = n), mobD && (mobD.removeAttribute("data-i18n"), mobD.innerText = n), c && (c.innerText = n), setInitial(p), setInitial(f), setInitial(w), window.foxyBroadcastPeerMessage ? window.foxyBroadcastPeerMessage({ type: "rename", name: a }) : window.connections && Object.values(window.connections).forEach(e => {
      e.conn && e.conn.open && e.conn.send({ type: "rename", name: a })
    }), "function" == typeof window.renderServerMembers && window.renderServerMembers(), document.getElementById("server-settings-members-list") && "function" == typeof window.loadServerSettingsMembers && window.loadServerSettingsMembers(), "function" == typeof window.refreshVoiceChannelMembers && window.refreshVoiceChannelMembers(), "function" == typeof window.updateGlobalNamePresence && window.updateGlobalNamePresence(a), alert(window.__f("js.name_changed", {name: a}, `✅ تم تغيير الاسم إلى: ${a}`))
  } catch (e) {
    alert(window.__fb("js.name_err", "حدث خطأ أثناء حفظ الاسم."))
  }
};
