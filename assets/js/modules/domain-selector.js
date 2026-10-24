(function () {
  var host = window.location.hostname;
  if (host !== 'abdo3.xo.je') return;

  var css = document.createElement('style');
  css.textContent = '@keyframes doFadeIn{0%{opacity:0;transform:scale(0.96)}100%{opacity:1;transform:scale(1)}}@keyframes doFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}@keyframes doPulse{0%,100%{box-shadow:0 0 20px rgba(0,238,255,0.3)}50%{box-shadow:0 0 50px rgba(0,238,255,0.6)}}';
  document.head.appendChild(css);

  var o = document.createElement('div');
  o.id = 'domain-overlay';
  o.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#02040b;display:flex;align-items:center;justify-content:center;flex-direction:column;direction:rtl;font-family:\'Cairo\',sans-serif;animation:doFadeIn 0.6s ease;overflow:hidden';

  o.innerHTML =
    '<div style="position:fixed;inset:0;background-image:linear-gradient(rgba(0,238,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,238,255,0.025) 1px,transparent 1px);background-size:60px 60px;pointer-events:none"></div>' +
    '<div style="position:absolute;width:500px;height:500px;border-radius:50%;background:rgba(0,238,255,0.08);filter:blur(90px);top:-15%;right:-8%;pointer-events:none"></div>' +
    '<div style="position:absolute;width:420px;height:420px;border-radius:50%;background:rgba(255,31,114,0.08);filter:blur(90px);bottom:-15%;left:-8%;pointer-events:none"></div>' +
    '<div style="position:relative;z-index:10;text-align:center;max-width:520px;padding:2rem">' +
    '<div style="animation:doFloat 4s ease-in-out infinite">' +
    '<img src="assets/img/foxy.png" alt="Foxy" style="width:100px;height:100px;border-radius:28px;box-shadow:0 0 40px rgba(0,238,255,0.35);margin:0 auto 1.5rem;display:block">' +
    '</div>' +
    '<div style="font-size:0.85rem;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:#00eeff;background:rgba(0,238,255,0.08);border:1px solid rgba(0,238,255,0.22);padding:0.35rem 1.2rem;border-radius:100px;display:inline-block;margin-bottom:1.25rem">⚠️ نسخة تجريبية</div>' +
    '<h1 style="font-size:clamp(1.8rem,5vw,2.6rem);font-weight:900;color:#e4f0ff;margin:0 0 0.75rem;line-height:1.3">اختر النسخة التي تريد</h1>' +
    '<p style="color:rgba(164,210,255,0.55);font-size:1.05rem;line-height:1.8;margin:0 0 2.5rem">أنت الآن في النسخة التجريبية من فوكسي. يمكنك الاستمرار هنا أو الانتقال للنسخة المستقرة.</p>' +
    '<div style="display:flex;gap:1.25rem;justify-content:center;flex-wrap:wrap">' +
    '<button id="do-experimental" style="display:inline-flex;align-items:center;gap:0.75rem;padding:1.1rem 2.4rem;border-radius:50px;font-weight:800;font-size:1rem;cursor:pointer;border:none;font-family:\'Cairo\',sans-serif;background:linear-gradient(135deg,#00eeff,#8b3cff);color:#fff;box-shadow:0 8px 32px rgba(0,238,255,0.35);transition:all 0.35s cubic-bezier(0.175,0.885,0.32,1.275);animation:doPulse 3s ease-in-out infinite">🚀 استمر في النسخة التجريبية</button>' +
    '<a href="https://foxy.xo.je/" style="display:inline-flex;align-items:center;gap:0.75rem;padding:1.1rem 2.4rem;border-radius:50px;font-weight:800;font-size:1rem;cursor:pointer;border:1.5px solid rgba(0,238,255,0.35);font-family:\'Cairo\',sans-serif;background:transparent;color:#00eeff;text-decoration:none;transition:all 0.35s cubic-bezier(0.175,0.885,0.32,1.275)">النسخة المستقرة ←</a>' +
    '</div>' +
    '</div>';

  document.documentElement.style.overflow = 'hidden';
  document.body.prepend(o);

  document.getElementById('do-experimental').addEventListener('click', function () {
    o.style.opacity = '0';
    o.style.transition = 'opacity 0.5s ease';
    setTimeout(function () {
      o.remove();
      document.documentElement.style.overflow = '';
    }, 500);
  });

  o.addEventListener('mouseenter', function () {
    document.documentElement.style.overflow = 'hidden';
  });
})();
