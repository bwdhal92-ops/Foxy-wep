import { getDb, getAuth, getRtdb, whenReady } from "./firebase-config.js";
import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { ref as rtdbRef, set as rtdbSet } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const $ = id => document.getElementById(id);
let apps = [];
let active = null;
let db = null;
let rtdb = null;
let auth = null;
let currentUser = null;
let unsubscribeApps = null;
let unsubscribeServers = null;
let servers = [];
let pendingAppId = null;
let visibleClientSecret = "";

const toast = message => {
  const element = $("toast");
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 2200);
};
const makeId = () => String(Math.floor(1e17 + Math.random() * 9e17));
const makeKey = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, "0")).join("");
const makeBotToken = () => `sitebot_${makeKey()}${makeKey().slice(0, 8)}`;
const hashToken = async token => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))), value => value.toString(16).padStart(2, "0")).join("");
const appsRef = () => collection(db, "developerApplications", currentUser.uid, "apps");
const appRef = appId => doc(db, "developerApplications", currentUser.uid, "apps", appId);
const siteIcon = "assets/img/foxy.webp";
const imageFor = item => item.photoURL || item.iconUrl || item.iconURL || item.icon || item.imageUrl || item.image || item.avatarUrl || siteIcon;
const makeIcon = (item, className) => {
  const image = document.createElement("img");
  image.className = className;
  image.src = imageFor(item);
  image.alt = item.name || "icon";
  image.onerror = () => { image.onerror = null; image.src = siteIcon; };
  return image;
};

const permissionGroups = {
  general: [
    ["Administrator", 3], ["View Audit Log", 7], ["Manage Server", 5], ["Manage Roles", 28],
    ["Manage Channels", 4], ["Kick Members", 1], ["Ban Members", 2], ["Create Instant Invite", 0],
    ["Change Nickname", 26], ["Manage Nicknames", 27], ["Manage Expressions", 43], ["Create Expressions", 43],
    ["Manage Webhooks", 29], ["View Channels", 10], ["Manage Events", 33], ["Create Events", 44],
    ["Moderate Members", 40], ["View Server Insights", 19], ["View Server Subscription Insights", 41]
  ],
  text: [
    ["Send Messages", 11], ["Create Public Threads", 35], ["Create Private Threads", 36],
    ["Send Messages in Threads", 38], ["Send TTS Messages", 12], ["Manage Messages", 13],
    ["Pin Messages", 13], ["Manage Threads", 34], ["Embed Links", 14], ["Attach Files", 15],
    ["Read Message History", 16], ["Mention Everyone", 17], ["Use External Emojis", 18],
    ["Use External Stickers", 37], ["Add Reactions", 6], ["Use Slash Commands", 31],
    ["Use Embedded Activities", 39], ["Use External Apps", 50], ["Create Polls", 49],
    ["Bypass Slowmode", 20], ["Send Voice Messages", 46]
  ],
  voice: [
    ["Connect", 20], ["Speak", 21], ["Video", 32], ["Mute Members", 22], ["Deafen Members", 23],
    ["Move Members", 24], ["Use Voice Activity", 25], ["Priority Speaker", 8], ["Request To Speak", 32],
    ["Use Embedded Activities", 39], ["Use Soundboard", 34], ["Use External Sounds", 45], ["Set Voice Channel Status", 48]
  ]
};

function renderPermissionGroups() {
  Object.entries(permissionGroups).forEach(([group, permissions]) => {
    const container = $(`${group}-permissions`);
    container.innerHTML = "";
    permissions.forEach(([label, bit], index) => {
      const id = `permission-${group}-${index}`;
      const wrapper = document.createElement("label");
      wrapper.className = "permission-option";
      wrapper.innerHTML = `<input type="checkbox" id="${id}" data-permission-bit="${bit}"><span>${label}</span>`;
      wrapper.querySelector("input").onchange = updatePermissionsInteger;
      container.appendChild(wrapper);
    });
  });
}

function getPermissionState() {
  const state = {};
  document.querySelectorAll("[data-permission-bit]").forEach(input => { state[input.id] = input.checked; });
  return state;
}

function setPermissionState(state = {}) {
  document.querySelectorAll("[data-permission-bit]").forEach(input => { input.checked = state[input.id] === true; });
  updatePermissionsInteger();
}

function renderCommands(commands = []) {
  const list = $("commands-list");
  list.innerHTML = "";
  if (!commands.length) { list.appendChild(emptyState(window.__fb("dev.cmd_empty", "لا توجد أوامر مضافة"))); return; }
  commands.forEach((command, index) => {
    const row = document.createElement("div");
    row.className = "command-row";
    row.innerHTML = '<input class="command-name" maxlength="32" placeholder="ping"><input class="command-description" maxlength="100" placeholder="' + window.__fb('dev.cmd_desc_ph', 'وصف الأمر') + '"><button type="button" class="command-remove">' + window.__fb("dev.cmd_del", "حذف") + '</button>';
    row.querySelector(".command-name").value = command.name || "";
    row.querySelector(".command-description").value = command.description || "";
    row.querySelector(".command-remove").onclick = () => { active.commands.splice(index, 1); renderCommands(active.commands); };
    list.appendChild(row);
  });
}

function readCommands() {
  return Array.from(document.querySelectorAll(".command-row")).map(row => ({
    name: row.querySelector(".command-name").value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32),
    description: row.querySelector(".command-description").value.trim().slice(0, 100)
  })).filter(command => command.name);
}

function updatePermissionsInteger() {
  let total = 0n;
  document.querySelectorAll("[data-permission-bit]:checked").forEach(input => { total |= 1n << BigInt(input.dataset.permissionBit); });
  $("permissions-integer").textContent = total.toString();
}

function renderApps() {
  const list = $("app-list");
  list.innerHTML = "";
  apps.forEach(app => {
    const button = document.createElement("button");
    button.className = `app-item ${active?.id === app.id ? "active" : ""}`;
    button.innerHTML = '<span class="app-item-icon"></span>';
    button.querySelector(".app-item-icon").appendChild(makeIcon(app, "portal-icon-image"));
    const name = document.createElement("span");
    name.textContent = app.name || "Untitled App";
    button.appendChild(name);
    button.onclick = () => selectApp(app.id);
    list.appendChild(button);
  });
  $("empty-create-btn").classList.toggle("hidden", apps.length > 0);
  renderApplicationLists();
}

function emptyState(message) {
  const item = document.createElement("div");
  item.className = "empty-state";
  item.textContent = message;
  return item;
}

function renderApplicationLists() {
  [$("home-app-list"), $("applications-list")].forEach((list, index) => {
    list.innerHTML = "";
    if (!apps.length) { list.appendChild(emptyState(window.__fb("dev.apps_empty", "لا توجد تطبيقات بعد"))); return; }
    apps.forEach(app => {
      const card = document.createElement("button");
      card.className = "portal-list-item";
      card.innerHTML = '<span class="list-icon"></span><span class="list-copy"></span><span class="list-arrow">←</span>';
      card.querySelector(".list-icon").appendChild(makeIcon(app, "portal-list-image"));
      card.querySelector(".list-copy").innerHTML = `<strong></strong><small></small>`;
      card.querySelector("strong").textContent = app.name || "Untitled App";
      card.querySelector("small").textContent = `Application ID: ${app.id}`;
      card.onclick = () => selectApp(app.id);
      list.appendChild(card);
    });
  });
}

function renderServerLists() {
  [$("home-server-list"), $("servers-list")].forEach(list => {
    list.innerHTML = "";
    if (!servers.length) { list.appendChild(emptyState(window.__fb("dev.srv_empty", "لا توجد سيرفرات أنشأتها بعد"))); return; }
    servers.forEach(server => {
      const card = document.createElement("div");
      card.className = "portal-list-item server-list-item";
      card.innerHTML = '<span class="list-icon"></span><span class="list-copy"><strong></strong><small></small></span>';
      card.querySelector(".list-icon").appendChild(makeIcon(server, "portal-list-image"));
      card.querySelector("strong").textContent = server.name || "Untitled Server";
      card.querySelector("small").textContent = `Server ID: ${server.id}`;
      list.appendChild(card);
    });
  });
  renderInstallServers();
}

function renderInstallServers() {
  const list = $("install-server-list");
  if (!list) return;
  list.innerHTML = "";
  if (!servers.length) { list.appendChild(emptyState(window.__fb("dev.install_empty", "لا توجد سيرفرات متاحة للتثبيت"))); return; }
  servers.forEach(server => {
    const row = document.createElement("div");
    row.className = "install-server-row";
    row.innerHTML = '<span class="list-icon"></span><span class="list-copy"><strong></strong><small></small></span><button type="button">Add Bot</button>';
    row.querySelector(".list-icon").appendChild(makeIcon(server, "portal-list-image"));
    row.querySelector("strong").textContent = server.name || "Untitled Server";
    row.querySelector("small").textContent = `Server ID: ${server.id}`;
    row.querySelector("button").onclick = () => installBot(server.id);
    list.appendChild(row);
  });
}

async function installBot(serverId) {
  if (!active || !currentUser) return toast(window.__fb("dev.open_login", "افتح تطبيقًا وسجل الدخول أولًا"));
  try {
    await setDoc(doc(db, "botInstallations", `${active.id}_${serverId}`), {
      appId: active.id, serverId, ownerUid: currentUser.uid,
      permissionsInteger: active.permissionsInteger || "0", installedAt: serverTimestamp(), enabled: true
    }, { merge: true });
    toast(window.__fb("dev.bot_added", "تمت إضافة البوت إلى السيرفر"));
  } catch (error) { console.error("[Developer Portal] install failed", error); toast(window.__fb("dev.bot_add_fail", "تعذر إضافة البوت")); }
}

function setPortalView(view) {
  document.querySelectorAll(".portal-view,#app-view").forEach(item => item.classList.add("hidden"));
  const target = view === "applications" ? "applications-view" : view === "servers" ? "servers-view" : "home-view";
  $(target).classList.remove("hidden");
  if (view !== "applications") active = view === "home" ? active : active;
}

function selectApp(appId) {
  active = apps.find(app => app.id === appId);
  if (!active) return;
  document.querySelectorAll(".portal-view").forEach(item => item.classList.add("hidden"));
  visibleClientSecret = "";
  $("welcome-view").classList.add("hidden");
  $("app-view").classList.remove("hidden");
  $("app-title").textContent = active.name || "Untitled App";
  $("app-name").value = active.name || "";
  $("app-description").value = active.description || "";
  $("app-tags").value = active.tags || "";
  $("app-id").textContent = active.id;
  $("app-key").textContent = active.publicKey || "—";
  $("oauth-client-id").textContent = active.id;
  $("app-creator").textContent = active.ownerName || active.ownerEmail || currentUser?.displayName || currentUser?.email || window.__fb("dev.current_account", "الحساب الحالي");
  $("app-creator-id").textContent = `User ID: ${active.ownerUid || currentUser?.uid || "—"}`;
  $("client-secret-value").textContent = "Hidden for security";
  $("copy-client-secret-btn").disabled = true;
  $("install-link").textContent = `${window.location.origin}/developer.html#install/${encodeURIComponent(active.id)}`;
  $("bot-name").textContent = active.name || "Untitled App";
  $("bot-token-value").textContent = window.__fb("dev.token_hidden", "التوكن مخفي؛ استخدم Reset Token لإنشاء توكن جديد");
  $("copy-bot-token-btn").disabled = true;
  renderCommands(active.commands || []);
  $("user-install").checked = active.userInstall !== false;
  $("guild-install").checked = active.guildInstall !== false;
  $("redirect-uri").value = active.redirectUri || "";
  $("oauth-scopes").value = active.oauthScopes || "identify email applications.commands";
  $("public-bot").checked = active.publicBot !== false;
  $("message-intent").checked = active.messageIntent === true;
  $("member-intent").checked = active.memberIntent === true;
  setPermissionState(active.permissions || {});
  $("presence-state").value = active.presenceState || "Playing Solo";
  $("presence-details").value = active.presenceDetails || "Competitive";
  $("presence-image").value = active.presenceImage || "";
  $("presence-image-text").value = active.presenceImageText || "";
  $("presence-app-name").textContent = active.name || window.__fb("dev.app_name", "اسم التطبيق");
  $("presence-state-preview").textContent = $("presence-state").value;
  $("presence-details-preview").textContent = $("presence-details").value;
  renderApps();
}

async function saveApp(app) {
  if (!currentUser) { toast(window.__fb("dev.login_first", "يجب تسجيل الدخول أولًا")); return false; }
  await setDoc(appRef(app.id), { ...app, updatedAt: serverTimestamp() }, { merge: true });
  return true;
}

async function newApp() {
  if (!currentUser) { toast(window.__fb("dev.login_first_create", "يجب تسجيل الدخول أولًا لإنشاء تطبيق")); return; }
  const app = {
    id: makeId(), publicKey: makeKey(), name: "New Application", description: "", tags: "",
    ownerUid: currentUser.uid,
    ownerEmail: currentUser.email || "",
    ownerName: currentUser.displayName || currentUser.email || "",
    userInstall: true, guildInstall: true, publicBot: true, commands: [], createdAt: serverTimestamp()
  };
  try {
    pendingAppId = app.id;
    await setDoc(appRef(app.id), app);
    toast(window.__fb("dev.app_created", "تم إنشاء التطبيق وحفظه في Firebase"));
  } catch (error) {
    pendingAppId = null;
    console.error("[Developer Portal] create failed", error);
    toast(window.__fb("dev.app_create_fail", "تعذر إنشاء التطبيق في Firebase"));
  }
}

async function updateGeneral() {
  if (!active) return;
  active.name = $("app-name").value.trim() || "Untitled App";
  active.description = $("app-description").value;
  active.tags = $("app-tags").value;
  try {
    if (await saveApp(active)) toast(window.__fb("dev.saved_fb", "تم حفظ التغييرات في Firebase"));
  } catch (error) { console.error("[Developer Portal] update failed", error); toast(window.__fb("dev.save_fail", "تعذر حفظ التغييرات")); }
}

async function saveSection(message) {
  if (!active) return;
  Object.assign(active, {
    userInstall: $("user-install").checked, guildInstall: $("guild-install").checked,
    redirectUri: $("redirect-uri").value.trim(), oauthScopes: $("oauth-scopes").value.trim(),
    publicBot: $("public-bot").checked, messageIntent: $("message-intent").checked,
    memberIntent: $("member-intent").checked, presenceState: $("presence-state").value,
    presenceDetails: $("presence-details").value, presenceImage: $("presence-image").value,
    presenceImageText: $("presence-image-text").value,
    permissions: getPermissionState(),
    permissionsInteger: $("permissions-integer").textContent,
    commands: readCommands()
  });
  try {
    if (await saveApp(active)) {
      rtdb = rtdb || getRtdb();
      if (rtdb && active.tokenHash) await rtdbSet(rtdbRef(rtdb, `siteBots/${active.id}/commands`), active.commands || []);
      toast(message);
    }
  } catch (error) { console.error("[Developer Portal] section save failed", error); toast(window.__fb("js.settings_save_fail", "تعذر حفظ الإعدادات")); }
}

async function deleteActiveApp() {
  if (!active || !currentUser || !confirm(window.__fb("dev.confirm_del", "هل تريد حذف التطبيق؟"))) return;
  try {
    await deleteDoc(appRef(active.id));
    active = null;
    $("app-view").classList.add("hidden");
    $("welcome-view").classList.remove("hidden");
    toast(window.__fb("dev.app_deleted", "تم حذف التطبيق"));
  } catch (error) { console.error("[Developer Portal] delete failed", error); toast(window.__fb("dev.app_del_fail", "تعذر حذف التطبيق")); }
}

function bindEvents() {
  document.querySelectorAll(".top-links a").forEach(link => link.onclick = event => {
    event.preventDefault();
    const view = link.getAttribute("href").slice(1) || "home";
    history.replaceState(null, "", `#${view}`);
    setPortalView(view);
  });
  document.querySelectorAll(".tab").forEach(tab => tab.onclick = () => {
    document.querySelectorAll(".tab,.tab-panel").forEach(item => item.classList.remove("active", "active-panel"));
    tab.classList.add("active");
    $(`tab-${tab.dataset.tab}`).classList.add("active-panel");
  });
  $("new-app-btn").onclick = $("empty-create-btn").onclick = $("welcome-create-btn").onclick = newApp;
  $("applications-create-btn").onclick = newApp;
  $("save-general-btn").onclick = updateGeneral;
  $("save-install-btn").onclick = () => saveSection(window.__fb("dev.installed_saved", "تم حفظ إعدادات التثبيت"));
  $("save-oauth-btn").onclick = () => saveSection(window.__fb("dev.oauth_saved", "تم حفظ إعدادات OAuth2"));
  $("save-bot-btn").onclick = () => saveSection(window.__fb("dev.bot_saved", "تم حفظ إعدادات البوت"));
  $("delete-app-btn").onclick = deleteActiveApp;
  document.querySelectorAll("[data-copy]").forEach(button => button.onclick = () => {
    navigator.clipboard?.writeText($(button.dataset.copy).textContent);
    toast(window.__fb("dev.copied", "تم النسخ"));
  });
  $("reset-token-btn").onclick = async () => {
    if (!active || !currentUser) return;
    const token = makeBotToken();
    try {
      if (active.tokenHash) await deleteDoc(doc(db, "botTokens", active.tokenHash));
      active.tokenHash = await hashToken(token);
      active.tokenCreatedAt = serverTimestamp();
      await saveApp(active);
      await setDoc(doc(db, "botTokens", active.tokenHash), {
        appId: active.id,
        ownerUid: currentUser.uid,
        createdAt: serverTimestamp(),
        revoked: false
      });
      rtdb = rtdb || getRtdb();
      if (rtdb) await rtdbSet(rtdbRef(rtdb, `siteBots/${active.id}`), {
        tokenHash: active.tokenHash,
        ownerUid: currentUser.uid,
        enabled: true,
        commands: active.commands || {}
      });
      $("bot-token-value").textContent = token;
      $("copy-bot-token-btn").disabled = false;
      $("copy-bot-token-btn").onclick = () => { navigator.clipboard?.writeText(token); toast(window.__fb("dev.token_copied", "تم نسخ Bot Token")); };
      toast(window.__fb("dev.token_once_more", "احفظ التوكن الآن؛ لن يظهر مرة أخرى"));
    } catch (error) { console.error("[Developer Portal] token creation failed", error); toast(window.__fb("dev.token_fail", "تعذر إنشاء Bot Token")); }
  };
  $("add-command-btn").onclick = () => {
    if (!active) return;
    active.commands = active.commands || [];
    active.commands.push({ name: "", description: "" });
    renderCommands(active.commands);
    document.querySelector(".command-name:last-of-type")?.focus();
  };
  $("reset-secret-btn").onclick = () => {
    if (!active) return;
    visibleClientSecret = makeKey();
    $("client-secret-value").textContent = visibleClientSecret;
    $("copy-client-secret-btn").disabled = false;
    $("copy-client-secret-btn").onclick = () => {
      navigator.clipboard?.writeText(visibleClientSecret);
      toast(window.__fb("dev.secret_copied", "تم نسخ Client Secret"));
    };
    toast(window.__fb("dev.secret_once", "سيظهر Client Secret الآن فقط؛ انسخه واحفظه في Backend آمن"));
  };
  ["presence-state", "presence-details"].forEach(id => $(id).oninput = () => {
    $("presence-state-preview").textContent = $("presence-state").value;
    $("presence-details-preview").textContent = $("presence-details").value;
  });
  $("account-menu-btn").onclick = event => {
    event.stopPropagation();
    const popover = $("account-popover");
    const isOpen = !popover.classList.contains("hidden");
    popover.classList.toggle("hidden", isOpen);
    $("account-menu-btn").setAttribute("aria-expanded", String(!isOpen));
  };
  document.addEventListener("click", event => {
    if (!event.target.closest(".account-menu-wrap")) {
      $("account-popover").classList.add("hidden");
      $("account-menu-btn").setAttribute("aria-expanded", "false");
    }
  });
  $("theme-toggle").onclick = () => document.body.classList.toggle("light");
  $("logout-btn").onclick = async () => {
    try {
      await signOut(auth);
      toast(window.__fb("dev.logged_out", "تم تسجيل الخروج"));
      $("account-popover").classList.add("hidden");
    } catch (error) { console.error("[Developer Portal] logout failed", error); toast(window.__fb("dev.logout_fail", "تعذر تسجيل الخروج")); }
  };
  $("copy-permissions-btn").onclick = () => {
    navigator.clipboard?.writeText($("permissions-integer").textContent);
    toast(window.__fb("dev.perm_copied", "تم نسخ Permissions Integer"));
  };
}

async function startFirebase() {
  try {
    await whenReady();
    db = getDb();
    auth = getAuth();
    rtdb = getRtdb();
    if (!db || !auth) throw new Error("Firebase services are unavailable");
    onAuthStateChanged(auth, user => {
      currentUser = user;
      unsubscribeApps?.();
      unsubscribeServers?.();
      unsubscribeApps = null;
      unsubscribeServers = null;
      apps = [];
      servers = [];
      active = null;
      renderApps();
      renderServerLists();
      if (!user) {
        $("account-menu-name").textContent = window.__fb("dev.login_btn", "تسجيل الدخول");
        $("account-avatar").textContent = "?";
        $("popover-name").textContent = window.__fb("dev.not_logged", "غير مسجل الدخول");
        $("popover-email").textContent = window.__fb("dev.login_home", "سجل الدخول من الصفحة الرئيسية");
        $("app-view").classList.add("hidden");
        $("welcome-view").classList.remove("hidden");
        toast(window.__fb("dev.login_apps", "سجل الدخول أولًا لعرض تطبيقاتك"));
        return;
      }
      const accountName = user.displayName || user.email?.split("@")[0] || window.__fb("dev.account_fb", "الحساب");
      const accountInitial = accountName.charAt(0).toUpperCase();
      $("account-menu-name").textContent = accountName;
      $("popover-name").textContent = user.displayName || accountName;
      $("popover-email").textContent = user.email || `User ID: ${user.uid}`;
      $("account-avatar").textContent = accountInitial;
      $("popover-avatar").textContent = accountInitial;
      if (user.photoURL) {
        [$("account-avatar"), $("popover-avatar")].forEach(element => {
          element.textContent = "";
          element.style.backgroundImage = `url(${JSON.stringify(user.photoURL)})`;
        });
      }
      unsubscribeApps = onSnapshot(appsRef(), snapshot => {
        apps = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
        apps.forEach(app => {
          if (!app.ownerUid) {
            setDoc(appRef(app.id), {
              ownerUid: user.uid,
              ownerEmail: user.email || "",
              ownerName: user.displayName || user.email || ""
            }, { merge: true }).catch(error => console.warn("[Developer Portal] owner metadata update failed", error));
          }
        });
        apps.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        renderApps();
        if (pendingAppId && apps.some(app => app.id === pendingAppId)) {
          const createdAppId = pendingAppId;
          pendingAppId = null;
          selectApp(createdAppId);
        } else if (active && apps.some(app => app.id === active.id) && !$('app-view').classList.contains('hidden')) {
          selectApp(active.id);
        }
      }, error => { console.error("[Developer Portal] read failed", error); toast(window.__fb("dev.apps_load_fail", "تعذر تحميل تطبيقاتك من Firebase")); });
      unsubscribeServers = onSnapshot(query(collection(db, "servers"), where("ownerUid", "==", user.uid)), snapshot => {
        servers = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
        renderServerLists();
      }, error => { console.error("[Developer Portal] servers read failed", error); servers = []; renderServerLists(); });
    });
  } catch (error) { console.error("[Developer Portal] Firebase unavailable", error); toast(window.__fb("dev.fb_fail", "تعذر الاتصال بـ Firebase")); }
}

bindEvents();
renderPermissionGroups();
renderApps();
startFirebase();

document.addEventListener("languageChanged", () => {
  try {
    renderApps();
    renderServerLists();
    if (active) {
      renderCommands(active.commands || []);
      $("app-title").textContent = active.name || "Untitled App";
      $("bot-name").textContent = active.name || "Untitled App";
      $("presence-app-name").textContent = active.name || window.__fb("dev.app_name", "اسم التطبيق");
      $("app-creator").textContent = active.ownerName || active.ownerEmail || currentUser?.displayName || currentUser?.email || window.__fb("dev.current_account", "الحساب الحالي");
    }
    if (!currentUser) {
      $("account-menu-name").textContent = window.__fb("dev.login_btn", "تسجيل الدخول");
      $("popover-name").textContent = window.__fb("dev.not_logged", "غير مسجل الدخول");
      $("popover-email").textContent = window.__fb("dev.login_home", "سجل الدخول من الصفحة الرئيسية");
    }
  } catch (e) {}
});
