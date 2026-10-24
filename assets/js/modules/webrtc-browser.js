let browserActive = !1,
  isBrowserHost = !1,
  currentBrowserUrl = "";

function toggleSocialBrowser() {
  browserActive ? closeSocialBrowser() : openSocialBrowser()
}

function openSocialBrowser() {
  if (browserActive) return;
  browserActive = !0, isBrowserHost = !0, renderBrowserUI();
  const e = "https://www.google.com/search?igu=1";
  updateBrowserUrl(e), broadcastBrowserStatus("open", e), addSystemMsg(window.__fb("app_system_messages.social_browser_started", "📺 بدأت متصفحاً مشتركاً"))
}

function closeSocialBrowser() {
  if (!browserActive) return;
  browserActive = !1;
  const e = document.getElementById("social-browser-overlay");
  e && e.remove(), isBrowserHost && (broadcastBrowserStatus("close"), addSystemMsg(window.__fb("app_system_messages.social_browser_closed", "📺 أغلق المتصفح المشترك"))), isBrowserHost = !1
}

function renderBrowserUI() {
  const e = document.getElementById("social-browser-overlay");
  e && e.remove();
  const o = document.createElement("div");
  o.id = "social-browser-overlay", o.className = "fixed inset-0 z-[200] bg-[#111214] flex flex-col animate-in fade-in zoom-in duration-300";
  const r = isBrowserHost ? '\n        <div class="flex items-center gap-2 flex-1 max-w-2xl">\n            <div class="flex items-center bg-black/40 rounded-xl px-4 py-2 border border-white/10 w-full group focus-within:border-blue-500/50 transition-all">\n                <svg class="w-4 h-4 text-gray-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>\n                <input id="browser-address-bar" type="text" placeholder="' + window.__fb("app_chat.search_or_enter_url", "ابحث أو أدخل رابطاً...") + '" \n                    class="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-gray-600 font-medium"\n                    onkeypress="if(event.key === \'Enter\') window.navigateSocialBrowser(this.value)">\n            </div>\n            <button onclick="window.navigateSocialBrowser(document.getElementById(\'browser-address-bar\').value)" \n                class="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition shadow-lg shadow-blue-600/20 active:scale-95">\n                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>\n            </button>\n        </div>\n    ' : '\n        <div class="flex items-center gap-3 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">\n            <span class="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>\n            <span class="text-xs font-bold uppercase tracking-wider">" + window.__fb("js.watch_stream_title", "مشاهدة بث المتصفح") + "</span>\n        </div>\n    ';
  o.innerHTML = `\n        \x3c!-- Top Navigation Bar --\x3e\n        <div class="h-16 flex items-center justify-between px-6 bg-[#1e1f22] border-b border-white/5 shadow-xl z-20">\n            <div class="flex items-center gap-4">\n                <div class="flex items-center gap-1.5 p-1 bg-black/20 rounded-lg">\n                    <button class="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition" onclick="window.closeSocialBrowser()">\n                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>\n                    </button>\n                    <button class="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition" onclick="document.getElementById('social-browser-iframe').contentWindow.location.reload()">\n                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>\n                    </button>\n                </div>\n                <div class="h-6 w-px bg-white/10"></div>\n                <span id="browser-status-title" class="text-sm font-black text-gray-300 truncate max-w-[200px]">${window.__fb("js.shared_title", "المتصفح المشترك")}</span>\n            </div>\n\n            ${r}\n\n            <div class="flex items-center gap-2">\n                <button onclick="window.closeSocialBrowser()" class="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition active:scale-95 group">\n                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>\n                </button>\n            </div>\n        </div>\n\n        \x3c!-- Browser Content --\x3e\n        <div class="flex-1 relative bg-white overflow-hidden flex group/browser">\n            \x3c!-- ⚡ Smart Scroll Sync Zone (Host Only - Fallback for Web) --\x3e\n            ${isBrowserHost&&!window.electronAPI?'\n                <div id="virtual-scroll-bar" class="absolute left-0 top-0 bottom-0 w-4 bg-blue-500/0 hover:bg-blue-500/10 border-r border-transparent hover:border-blue-500/30 z-50 transition-all cursor-ns-resize group/scroll">\n                    <input type="range" min="0" max="100" value="0" orient="vertical" \n                        class="h-full w-full opacity-0 cursor-ns-resize"\n                        style="-webkit-appearance: slider-vertical;"\n                        oninput="window.syncBrowserScrollManual(this.value)">\n                    <div class="absolute top-1/2 left-full ml-2 -translate-y-1/2 bg-blue-600 text-white text-[8px] font-bold px-2 py-1 rounded opacity-0 group-hover/scroll:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl">\n                        اسحب للتمرير عند الجميع (Sync)\n                    </div>\n                </div>\n            ':""}\n\n            <div id="browser-viewport" class="flex-1 relative overflow-hidden bg-white">\n                \x3c!-- 🚀 Electron PRO Mode: Use <webview> to bypass security if available --\x3e\n                ${window.electronAPI?'\n                    <webview id="social-browser-iframe" class="w-full h-full border-none" \n                        src="about:blank" style="height: 100%; width: 100%;"\n                        disablewebsecurity nodeintegration></webview>\n                ':'\n                    <iframe id="social-browser-iframe" class="w-full h-full border-none transition-transform duration-300 origin-top shadow-2xl" \n                        src="about:blank" style="height: 6000px; width: 100%;"></iframe>\n                '}\n                ${isBrowserHost?"":'<div class="absolute inset-0 z-30 bg-transparent cursor-not-allowed"></div>'}\n            </div>\n            \n            \x3c!-- Loading Indicator --\x3e\n            <div id="browser-loader" class="absolute inset-0 bg-[#111214] flex flex-col items-center justify-center z-40 hidden">\n                <div class="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>\n                <p class="text-sm font-bold text-gray-400">جاري تحميل الصفحة...</p>\n            </div>\n        </div>\n\n        \x3c!-- Sync Footer --\x3e\n        <div class="h-10 bg-[#0f1016] border-t border-white/5 flex items-center justify-between px-6">\n            <div class="flex items-center gap-2">\n                <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>\n                <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">مزامنة نشطة</span>\n            </div>\n            <div id="browser-url-display" class="text-[10px] font-mono text-gray-600 truncate max-w-sm">about:blank</div>\n        </div>\n    `, document.body.appendChild(o);
  const t = document.getElementById("social-browser-iframe"),
    n = document.getElementById("browser-loader");
  if (t.onload = () => {
      n && n.classList.add("hidden")
    }, window.electronAPI && isBrowserHost && "WEBVIEW" === t.tagName) {
    const e = document.getElementById("virtual-scroll-bar");
    e && e.classList.add("hidden"), t.addEventListener("did-finish-load", () => {
      t.executeJavaScript("\n                window.addEventListener('scroll', () => {\n                    const percent = window.scrollY / (document.body.scrollHeight - window.innerHeight);\n                    console.log('Scroll sync:', percent);\n                    window.dispatchEvent(new CustomEvent('browser-scroll-sync', { detail: percent }));\n                });\n            ")
    }), t.addEventListener("ipc-message", e => {
      "browser-scroll-sync" === e.channel && broadcastBrowserStatus("scroll", e.args[0])
    }), setInterval(async () => {
      if (browserActive && isBrowserHost) try {
        const e = await t.executeJavaScript("window.scrollY / (document.body.scrollHeight - window.innerHeight)");
        void 0 === e || isNaN(e) || broadcastBrowserStatus("scroll", e)
      } catch (e) {}
    }, 500)
  }
}

function updateBrowserUrl(e, o = !1) {
  currentBrowserUrl = e;
  const r = document.getElementById("social-browser-iframe"),
    t = document.getElementById("browser-url-display"),
    n = document.getElementById("browser-loader"),
    s = document.getElementById("browser-address-bar");
  if (r && (n && n.classList.remove("hidden"), r.src = e, r.style.transform = "translateY(0px)"), t && (t.innerText = e), s && !o && (s.value = e), o) {
    const o = document.getElementById("browser-status-title");
    o && (o.innerText = window.__fb("js.live_for", "👀 عرض مباشر لـ ") + (e.length > 30 ? e.substring(0, 30) + "..." : e))
  }
}

function broadcastBrowserStatus(e, o) {
  const r = window.connections || {};
  Object.keys(r).length, Object.values(r).forEach(r => {
    if (r.conn && r.conn.open) try {
      r.conn.send({
        type: "browser-sync",
        action: e,
        value: o,
        hostName: window.myName
      })
    } catch (e) {}
  })
}
window.syncBrowserScrollManual = function(e) {
  if (!isBrowserHost) return;
  const o = e / 100,
    r = document.getElementById("social-browser-iframe");
  if (r) {
    const e = 4200 * o;
    r.style.transform = `translateY(-${e}px)`
  }
  broadcastBrowserStatus("scroll", o)
}, window.navigateSocialBrowser = function(e) {
  if (!isBrowserHost) return;
  let o = e.trim();
  o && (o.startsWith("http") || (o = !o.includes(".") || o.includes(" ") || o.startsWith("localhost") ? "https://www.google.com/search?igu=1&q=" + encodeURIComponent(o) : "https://" + o), updateBrowserUrl(o), broadcastBrowserStatus("url", o))
}, window.toggleSocialBrowser = toggleSocialBrowser, window.closeSocialBrowser = closeSocialBrowser, window.handleBrowserSync = function(e) {
  if (!isBrowserHost)
    if ("open" === e.action) browserActive = !0, isBrowserHost = !1, renderBrowserUI(), updateBrowserUrl(e.value, !0), window.addSystemMsg && window.addSystemMsg(window.__f("js.shared_open", {name: e.hostName}, `🌐 ${e.hostName} فتح متصفحاً مشتركاً`));
    else if ("close" === e.action) closeSocialBrowser(), window.addSystemMsg && window.addSystemMsg(window.__f("js.shared_close", {name: e.hostName}, `🌐 أغلق ${e.hostName} المتصفح`));
  else if ("url" === e.action) browserActive || (browserActive = !0, renderBrowserUI()), updateBrowserUrl(e.value, !0);
  else if ("scroll" === e.action) {
    const o = document.getElementById("social-browser-iframe");
    if (o) {
      const r = 4200,
        t = e.value * r;
      o.style.transform = `translateY(-${t}px)`
    }
  }
};