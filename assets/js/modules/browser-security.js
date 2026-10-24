// Defence-in-depth for the shared browser.  Remote content must never run as an
// Electron WebView with Node privileges, even if a future UI change re-adds one.
function replaceUnsafeSharedBrowserWebviews(root = document) {
  root.querySelectorAll?.('webview#social-browser-iframe').forEach(webview => {
    const frame = document.createElement('iframe');
    frame.id = webview.id;
    frame.className = webview.className;
    frame.src = webview.src || 'about:blank';
    frame.style.cssText = webview.style.cssText;
    frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-downloads');
    frame.referrerPolicy = 'no-referrer';
    webview.replaceWith(frame);
  });
}

new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) replaceUnsafeSharedBrowserWebviews(node);
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true });

const originalNavigateSharedBrowser = window.navigateSocialBrowser;
window.navigateSocialBrowser = value => {
  const input = String(value || '').trim();
  if (!input) return;
  const candidate = /^https?:\/\//i.test(input) ? input : input.includes('.') && !/\s/.test(input) ? `https://${input}` : `https://www.google.com/search?igu=1&q=${encodeURIComponent(input)}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return;
    originalNavigateSharedBrowser?.(url.href);
  } catch {
    return;
  }
};
