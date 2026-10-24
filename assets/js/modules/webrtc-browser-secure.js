let browserActive = false;
let isBrowserHost = false;

function broadcastBrowserStatus(action, value) {
  Object.keys(window.connections || {}).forEach(peerId => {
    window.sendSignalingCmd?.(peerId, { type: 'browser-sync', action, value, hostName: window.myName || window.__fb('js.host_fb', 'المضيف') });
  });
}

function normaliseBrowserUrl(value) {
  const input = String(value || '').trim();
  if (!input) return null;
  const candidate = /^https?:\/\//i.test(input) ? input : input.includes('.') && !/\s/.test(input)
    ? `https://${input}`
    : `https://www.google.com/search?igu=1&q=${encodeURIComponent(input)}`;
  try {
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function updateBrowserUrl(url, viewer = false) {
  const frame = document.getElementById('social-browser-iframe');
  const address = document.getElementById('browser-address-bar');
  const display = document.getElementById('browser-url-display');
  if (frame) frame.src = url;
  if (address && !viewer) address.value = url;
  if (display) display.textContent = url;
}

function renderBrowserUI() {
  document.getElementById('social-browser-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'social-browser-overlay';
  overlay.className = 'fixed inset-0 z-[200] bg-[#111214] flex flex-col';
  const header = document.createElement('div');
  header.className = 'h-16 flex items-center gap-3 px-6 bg-[#1e1f22] border-b border-white/5';
  const close = document.createElement('button');
  close.className = 'p-2 text-red-400'; close.textContent = '×'; close.onclick = closeSocialBrowser;
  header.appendChild(close);
  if (isBrowserHost) {
    const address = document.createElement('input');
    address.id = 'browser-address-bar'; address.type = 'url';
    address.className = 'flex-1 bg-black/40 rounded-xl px-4 py-2 text-white';
    address.placeholder = window.__fb('app_chat.search_or_enter_url', 'ابحث أو أدخل رابطاً...');
    address.onkeydown = event => { if (event.key === 'Enter') navigateSocialBrowser(address.value); };
    header.appendChild(address);
  } else {
    const label = document.createElement('span'); label.textContent = window.__fb('js.shared_watch', 'مشاهدة المتصفح المشترك'); label.className = 'text-blue-400 font-bold'; header.appendChild(label);
  }
  const frame = document.createElement('iframe');
  frame.id = 'social-browser-iframe'; frame.className = 'flex-1 border-0 bg-white';
  frame.sandbox = 'allow-scripts allow-forms allow-popups allow-downloads';
  frame.referrerPolicy = 'no-referrer'; frame.src = 'about:blank';
  const footer = document.createElement('div'); footer.className = 'h-10 px-6 flex items-center text-xs text-gray-500';
  const display = document.createElement('span'); display.id = 'browser-url-display'; display.textContent = 'about:blank'; footer.appendChild(display);
  overlay.append(header, frame, footer); document.body.appendChild(overlay);
}

function openSocialBrowser() {
  if (browserActive) return;
  browserActive = true; isBrowserHost = true; renderBrowserUI();
  const url = 'https://www.google.com/search?igu=1'; updateBrowserUrl(url); broadcastBrowserStatus('open', url);
}

function closeSocialBrowser() {
  if (!browserActive) return;
  const wasHost = isBrowserHost; browserActive = false; isBrowserHost = false;
  document.getElementById('social-browser-overlay')?.remove();
  if (wasHost) broadcastBrowserStatus('close');
}

function navigateSocialBrowser(value) {
  if (!isBrowserHost) return;
  const url = normaliseBrowserUrl(value);
  if (!url) return;
  updateBrowserUrl(url); broadcastBrowserStatus('url', url);
}

window.toggleSocialBrowser = () => browserActive ? closeSocialBrowser() : openSocialBrowser();
window.closeSocialBrowser = closeSocialBrowser;
window.navigateSocialBrowser = navigateSocialBrowser;
window.handleBrowserSync = message => {
  if (isBrowserHost) return;
  if (message.action === 'close') return closeSocialBrowser();
  if (message.action === 'open') { browserActive = true; isBrowserHost = false; renderBrowserUI(); }
  if ((message.action === 'open' || message.action === 'url') && normaliseBrowserUrl(message.value)) updateBrowserUrl(message.value, true);
};
