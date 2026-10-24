/* Foxy — إرسال ملفات وفويسات وفيديوهات وملفات صوت عبر Webhook
 * ---------------------------------------------------------------------------
 * الفكرة: نرفع الملف عبر Webhook ثم نأخذ رابط الملف ونرسله كرسالة داخل
 * شات الموقع (Firestore) فيظهر داخل موقعك فقط — التخزين الخارجي مجرد
 * "مخزن ملفات" فقط.
 *
 * يوجد Webhook احتياطي (foxy2): لو الأول تعطل أو رجّع خطأ، الرفع يتحول
 * تلقائياً للتاني بدون ما المستخدم يحس. ويمكن إضافة روابط أكثر من الكونسول:
 *   FoxyMedia.setWebhooks(['https://...', 'https://...'])
 */
(function () {
  'use strict';

  var DEFAULT_WEBHOOKS = [
    { name: 'foxy1', url: 'https://discord.com/api/webhooks/1552978778576126043/cK0Ma1EiF6SHi3rHPZyWHDELyrp3Z6DVIGuogM65t2IetlKDVQxlRpkSV-z7lHPZ2Ry_' },
    { name: 'foxy2', url: 'https://discord.com/api/webhooks/1552982276596563979/EK5hFCjMKVqqyPEle0deHOhicvGbjAJm-kXoKEvaAW3cPwAGIzUXv-H-mMDXY99niR2H' }
  ];
  var MAX_FILE_MB = 25;
  var orderCache = null;

  function validHook(u) { return typeof u === 'string' && u.indexOf('https://discord.com/api/webhooks/') === 0; }

  function getWebhooks() {
    try {
      var saved = localStorage.getItem('foxy_discord_webhooks');
      if (saved) {
        var arr = JSON.parse(saved);
        if (Array.isArray(arr) && arr.length) {
          var cleaned = arr.map(function (u, i) {
            return typeof u === 'string' ? { name: 'custom' + (i + 1), url: u } : u;
          }).filter(function (h) { return h && validHook(h.url); });
          if (cleaned.length) return cleaned;
        }
      }
      var single = localStorage.getItem('foxy_discord_webhook');
      if (single && validHook(single)) return [{ name: 'foxy1', url: single }];
    } catch (_) {}
    if (Array.isArray(window.FOXY_DISCORD_WEBHOOKS) && window.FOXY_DISCORD_WEBHOOKS.length) {
      var fromWin = window.FOXY_DISCORD_WEBHOOKS.filter(validHook).map(function (u, i) {
        return { name: 'win' + (i + 1), url: u };
      });
      if (fromWin.length) return fromWin;
    }
    if (typeof window.FOXY_DISCORD_WEBHOOK === 'string' && validHook(window.FOXY_DISCORD_WEBHOOK)) {
      return [{ name: 'foxy1', url: window.FOXY_DISCORD_WEBHOOK }];
    }
    return DEFAULT_WEBHOOKS.slice();
  }

  function orderedHooks() {
    var hooks = getWebhooks();
    if (orderCache) {
      var byUrl = {};
      hooks.forEach(function (h) { byUrl[h.url] = h; });
      var ordered = [];
      orderCache.forEach(function (u) { if (byUrl[u]) { ordered.push(byUrl[u]); delete byUrl[u]; } });
      Object.keys(byUrl).forEach(function (u) { ordered.push(byUrl[u]); });
      if (ordered.length) return ordered;
    }
    return hooks;
  }

  function markWorking(url) {
    var hooks = getWebhooks();
    var rest = hooks.map(function (h) { return h.url; }).filter(function (u) { return u !== url; });
    orderCache = [url].concat(rest);
  }

  function getWebhookURL() {
    var hooks = orderedHooks();
    return hooks.length ? hooks[0].url : '';
  }

  function setWebhookURL(url) {
    try {
      if (url && validHook(url)) {
        var rest = getWebhooks().filter(function (h) { return h.url !== url; }).map(function (h) { return h.url; });
        localStorage.setItem('foxy_discord_webhooks', JSON.stringify([url].concat(rest)));
        orderCache = null;
      } else {
        localStorage.setItem('foxy_discord_webhook', String(url || ''));
      }
    } catch (_) {}
  }

  function setWebhooks(urls) {
    try {
      var clean = (Array.isArray(urls) ? urls : [urls]).filter(validHook);
      if (!clean.length) return false;
      localStorage.setItem('foxy_discord_webhooks', JSON.stringify(clean));
      orderCache = null;
      return true;
    } catch (_) { return false; }
  }

  function kindOf(file, url) {
    var type = (file && file.type) || '';
    var name = (file && file.name) || String(url || '');
    if (type.indexOf('image/') === 0 || /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i.test(name)) return 'image';
    if (type.indexOf('video/') === 0 || /\.(mp4|webm|mov|m4v|mkv)$/i.test(name)) return 'video';
    if (type.indexOf('audio/') === 0 || /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm)$/i.test(name)) return 'audio';
    return 'file';
  }

  function formatSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function tryOnce(webhook, file, onProgress, onXhr) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', webhook + (webhook.indexOf('?') === -1 ? '?wait=true' : '&wait=true'));
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable && onProgress) {
          try { onProgress(Math.round((e.loaded / e.total) * 100)); } catch (_) {}
        }
      };
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var res = JSON.parse(xhr.responseText);
            var att = res && res.attachments && res.attachments[0];
            if (att && att.url) {
              resolve({ url: att.url, name: att.filename || file.name, size: att.size || file.size, contentType: file.type || '' });
            } else {
              reject(new Error('no-attachment-url'));
            }
          } catch (e) { reject(new Error('bad-response')); }
        } else if (xhr.status === 413) {
          reject(new Error('too-big:' + MAX_FILE_MB));
        } else {
          reject(new Error('hook-status:' + xhr.status));
        }
      };
      xhr.onerror = function () { reject(new Error('network')); };
      if (onXhr) { try { onXhr(xhr); } catch (_) {} }
      var fd = new FormData();
      var who = '';
      try { who = (window.currentUserProfile && window.currentUserProfile.displayName) || ''; } catch (_) {}
      fd.append('payload_json', JSON.stringify({ content: who ? ('📎 ' + who) : '📎 ملف من شات فوكسي' }));
      fd.append('file', file, file.name || 'file');
      xhr.send(fd);
    });
  }

  function uploadFileToDiscord(file, onProgress, onXhr) {
    if (!file) return Promise.reject(new Error('no-file'));
    var maxBytes = MAX_FILE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      return Promise.reject(new Error('too-big:' + MAX_FILE_MB));
    }
    var hooks = orderedHooks();
    if (!hooks.length) return Promise.reject(new Error('no-webhook'));
    var chain = Promise.reject(new Error('no-hook-tried'));
    hooks.forEach(function (hook) {
      chain = chain.catch(function (prevErr) {
        if (prevErr && prevErr.message && prevErr.message.indexOf('too-big') === 0) throw prevErr;
        return tryOnce(hook.url, file, onProgress, onXhr).then(function (res) {
          markWorking(hook.url);
          res.via = hook.name;
          return res;
        });
      });
    });
    return chain;
  }

  function openPicker(targetId, accept) {
    var input = document.getElementById('media-upload-input');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'media-upload-input';
      input.className = 'hidden';
      input.multiple = true;
      document.body.appendChild(input);
      input.addEventListener('change', function () {
        var files = Array.prototype.slice.call(input.files || []);
        var target = input.getAttribute('data-target') || 'server-chat-input';
        input.value = '';
        files.forEach(function (f) { queueFile(target, f); });
      });
    }
    input.setAttribute('data-target', targetId);
    input.setAttribute('accept', accept || 'video/*,audio/*,image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z,.apk');
    input.click();
  }

  function queueFile(targetId, file) {
    if (!file) return;
    if (file.type && file.type.indexOf('image/') === 0) {
      if (typeof window.__foxyQueueImage === 'function') { window.__foxyQueueImage(targetId, file); return; }
    }
    var maxBytes = MAX_FILE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      alert('الملف "' + file.name + '" كبير جداً (أقصى حجم ' + MAX_FILE_MB + 'MB).');
      return;
    }
    if (typeof window.addExternalAttachment !== 'function') {
      alert('نظام المرفقات غير جاهز بعد — حدّث الصفحة وحاول مجدداً.');
      return;
    }
    var item = window.addExternalAttachment(targetId, {
      name: file.name, size: file.size, mime: file.type,
      kind: kindOf(file), status: 'uploading', percent: 0
    });
    if (!item) return;
    uploadFileToDiscord(file, function (pct) {
      if (typeof window.updateExternalAttachment === 'function') window.updateExternalAttachment(targetId, item.id, { percent: pct });
    }, function (xhr) {
      if (typeof window.updateExternalAttachment === 'function') window.updateExternalAttachment(targetId, item.id, { xhr: xhr });
    }).then(function (res) {
      if (typeof window.updateExternalAttachment === 'function') {
        window.updateExternalAttachment(targetId, item.id, { status: 'ready', percent: 100, url: res.url, name: res.name, size: res.size });
      }
      window.addSystemMsg && window.addSystemMsg('✅ تم رفع "' + (file.name || 'الملف') + '" — اضغط إرسال لعرضه في الشات.', 'success');
    }).catch(function (err) {
      var msg = (err && err.message) || '';
      if (msg.indexOf('too-big') === 0) alert('الملف أكبر من ' + MAX_FILE_MB + 'MB.');
      else if (msg === 'no-webhook') alert('خدمة الرفع غير مضبوطة.');
      else alert('فشل رفع الملف. حاول مجدداً.');
      if (typeof window.updateExternalAttachment === 'function') window.updateExternalAttachment(targetId, item.id, { status: 'error' });
    });
  }

  var recorder = null, recChunks = [], recTimer = null, recElapsed = 0, recTarget = null, recStream = null;
  var recPaused = false, recAudioCtx = null, recAnalyser = null, recRaf = null;
  var recUI = null, recComposer = null;
  var recHistory = [], recLastDraw = 0, recLastAppend = 0;

  function fmtTime(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60); s = s % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  function composerFor(targetId) {
    var input = document.getElementById(targetId);
    if (!input || !input.parentElement) return null;
    return input.parentElement;
  }

  function drawWave() {
    recRaf = null;
    if (recPaused || !recAnalyser) return;
    var now = (window.performance && window.performance.now) ? window.performance.now() : Date.now();
    if (now - recLastDraw < 33) { recRaf = requestAnimationFrame(drawWave); return; }
    recLastDraw = now;
    var canvas = recUI ? recUI.querySelector('canvas') : null;
    if (!canvas) return;
    var W = canvas.width, H = canvas.height;
    var ctx = canvas.getContext('2d');
    var buf = new Uint8Array(recAnalyser.fftSize);
    recAnalyser.getByteTimeDomainData(buf);
    var peak = 0;
    for (var j = 0; j < buf.length; j += 4) {
      var v = Math.abs(buf[j] - 128) / 128;
      if (v > peak) peak = v;
    }
    if (peak < 0.015) peak = 0;
    var ratio = window.devicePixelRatio || 1;
    var colW = 3 * ratio, step = colW + 2 * ratio;
    var maxBars = Math.max(20, Math.floor(W / step) - 1);
    if (now - recLastAppend >= 80) {
      recLastAppend = now;
      var prev = recHistory.length ? recHistory[recHistory.length - 1] : 0;
      recHistory.push(prev * 0.35 + peak * 0.65);
      while (recHistory.length > maxBars) recHistory.shift();
    }
    ctx.clearRect(0, 0, W, H);
    var n = recHistory.length;
    for (var i = 0; i < n; i++) {
      var lvl = recHistory[i];
      var h = Math.min(H, Math.max(3 * ratio, lvl * H * 1.1));
      var x = (n - i) * step;
      ctx.fillStyle = lvl > 0.02 ? '#ef4444' : 'rgba(239,68,68,.30)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, (H - h) / 2, colW, h, 2); ctx.fill(); }
      else ctx.fillRect(x, (H - h) / 2, colW, h);
    }
    var liveH = Math.min(H, Math.max(3 * ratio, peak * H * 1.1));
    ctx.fillStyle = peak > 0.02 ? '#ef4444' : 'rgba(239,68,68,.30)';
    var lx = 0;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(lx, (H - liveH) / 2, colW, liveH, 2); ctx.fill(); }
    else ctx.fillRect(lx, (H - liveH) / 2, colW, liveH);
    recRaf = requestAnimationFrame(drawWave);
  }

  function buildRecUI() {
    var ui = document.createElement('div');
    ui.id = 'foxy-voice-rec-inline';
    ui.className = 'flex items-center gap-2 bg-slate-900/50 p-2 rounded-2xl border border-red-500/40 transition w-full';
    ui.innerHTML = '<span class="foxy-rec-dot2"></span>'
      + '<span class="foxy-rec-time2">00:00</span>'
      + '<canvas class="flex-1" height="36" style="min-width:0;height:36px"></canvas>'
      + '<button type="button" class="foxy-rec-pause" title="إيقاف مؤقت / استئناف">⏸</button>'
      + '<button type="button" class="foxy-rec-stop" title="إيقاف وإرسال">⏹ إرسال</button>'
      + '<button type="button" class="foxy-rec-cancel" title="إلغاء التسجيل">✖</button>';
    if (!document.getElementById('foxy-rec-style2')) {
      var st = document.createElement('style');
      st.id = 'foxy-rec-style2';
      st.textContent = '.foxy-rec-dot2{width:10px;height:10px;border-radius:50%;background:#ef4444;flex-shrink:0;animation:foxyBlink2 1s infinite;box-shadow:0 0 8px #ef4444}'
        + '.foxy-rec-dot2.paused{background:#f59e0b;box-shadow:none;animation:none}'
        + '@keyframes foxyBlink2{50%{opacity:.3}}'
        + '.foxy-rec-time2{color:#fff;font-weight:800;font-size:13px;font-variant-numeric:tabular-nums;flex-shrink:0;min-width:44px;text-align:center}'
        + '#foxy-voice-rec-inline canvas{background:rgba(239,68,68,.06);border-radius:10px}'
        + '#foxy-voice-rec-inline button{border:none;border-radius:10px;padding:8px 12px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;flex-shrink:0;transition:.15s}'
        + '#foxy-voice-rec-inline button:active{transform:scale(.93)}'
        + '.foxy-rec-stop{background:#22c55e;color:#04120a}'
        + '.foxy-rec-pause{background:rgba(245,158,11,.15);color:#fbbf24;border:1px solid rgba(245,158,11,.35)}'
        + '.foxy-rec-cancel{background:rgba(255,255,255,.08);color:#f87171}';
      document.head.appendChild(st);
    }
    ui.querySelector('.foxy-rec-pause').addEventListener('click', togglePauseRec);
    ui.querySelector('.foxy-rec-stop').addEventListener('click', stopAndAttach);
    ui.querySelector('.foxy-rec-cancel').addEventListener('click', cancelRec);
    return ui;
  }

  function sizeRecCanvas() {
    var canvas = recUI ? recUI.querySelector('canvas') : null;
    if (!canvas) return;
    var w = canvas.clientWidth || 260, ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(120, Math.floor(w * ratio));
    canvas.height = Math.floor(36 * ratio);
  }

  function showInlineRec(composer) {
    recComposer = composer;
    recUI = buildRecUI();
    composer.parentNode.insertBefore(recUI, composer);
    composer.classList.add('hidden');
    sizeRecCanvas();
    if (recAnalyser) {
      if (recRaf) cancelAnimationFrame(recRaf);
      recRaf = requestAnimationFrame(drawWave);
    }
  }

  function restoreComposer() {
    clearInterval(recTimer); recTimer = null;
    if (recRaf) { try { cancelAnimationFrame(recRaf); } catch (_) {} recRaf = null; }
    try { recAudioCtx && recAudioCtx.close(); } catch (_) {}
    recAudioCtx = null; recAnalyser = null;
    if (recComposer) { try { recComposer.classList.remove('hidden'); } catch (_) {} recComposer = null; }
    if (recUI && recUI.parentNode) { try { recUI.parentNode.removeChild(recUI); } catch (_) {} }
    recUI = null;
    var legacy = document.getElementById('foxy-voice-rec-bar');
    if (legacy) legacy.classList.add('hidden');
  }

  function ensureRecBar() {
    var bar = document.getElementById('foxy-voice-rec-bar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'foxy-voice-rec-bar';
    bar.className = 'hidden';
    bar.innerHTML = '<span class="foxy-rec-dot"></span><span id="foxy-rec-time">00:00</span>'
      + '<span class="foxy-rec-hint">جاري التسجيل…</span>'
      + '<button type="button" id="foxy-rec-stop">⏹ إرسال</button>'
      + '<button type="button" id="foxy-rec-cancel">✖</button>';
    document.body.appendChild(bar);
    document.getElementById('foxy-rec-stop').addEventListener('click', stopAndAttach);
    document.getElementById('foxy-rec-cancel').addEventListener('click', cancelRec);
    if (!document.getElementById('foxy-rec-style')) {
      var st = document.createElement('style');
      st.id = 'foxy-rec-style';
      st.textContent = '#foxy-voice-rec-bar{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;align-items:center;gap:10px;background:#111827f2;border:1px solid rgba(239,68,68,.5);color:#fff;border-radius:999px;padding:10px 16px;font-family:inherit;font-size:13px;font-weight:700;box-shadow:0 12px 40px rgba(0,0,0,.6)}'
        + '#foxy-voice-rec-bar.hidden{display:none}.foxy-rec-dot{width:10px;height:10px;border-radius:50%;background:#ef4444;animation:foxyBlink 1s infinite}@keyframes foxyBlink{50%{opacity:.3}}'
        + '#foxy-voice-rec-bar button{border:none;border-radius:999px;padding:6px 14px;font-family:inherit;font-weight:800;font-size:12px;cursor:pointer}'
        + '#foxy-rec-stop{background:#22c55e;color:#04120a}#foxy-rec-cancel{background:rgba(255,255,255,.1);color:#fff}';
      document.head.appendChild(st);
    }
    return bar;
  }

  window.toggleVoiceRecord = function (targetId) {
    if (recorder && recorder.state !== 'inactive') { stopAndAttach(); return; }
    startRec(targetId || 'server-chat-input');
  };

  function startRec(targetId) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('المتصفح لا يدعم تسجيل الصوت.');
      return;
    }
    if (!window.MediaRecorder) { alert('التسجيل غير مدعوم على هذا المتصفح.'); return; }
    recTarget = targetId;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      recStream = stream;
      recChunks = []; recElapsed = 0; recPaused = false;
      recHistory = []; recLastDraw = 0; recLastAppend = 0;
      var mime = '';
      if (window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus';
      else if (window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported('audio/webm')) mime = 'audio/webm';
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorder.ondataavailable = function (e) { if (e.data && e.data.size) recChunks.push(e.data); };
      recorder.onstop = function () {
        try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {}
      };
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          recAudioCtx = new AC();
          if (recAudioCtx.state === 'suspended') recAudioCtx.resume();
          var srcNode = recAudioCtx.createMediaStreamSource(stream);
          recAnalyser = recAudioCtx.createAnalyser();
          recAnalyser.fftSize = 2048;
          srcNode.connect(recAnalyser);
        }
      } catch (_) { recAnalyser = null; }
      recorder.start(250);
      var composer = composerFor(targetId);
      var timeEl = null;
      if (composer) {
        showInlineRec(composer);
        timeEl = recUI.querySelector('.foxy-rec-time2');
        window.addEventListener('resize', sizeRecCanvas);
      } else {
        var bar = ensureRecBar();
        bar.classList.remove('hidden');
        timeEl = document.getElementById('foxy-rec-time');
      }
      clearInterval(recTimer);
      recTimer = setInterval(function () {
        if (recPaused) return;
        recElapsed += 500;
        if (timeEl) timeEl.textContent = fmtTime(recElapsed);
        if (recElapsed >= 120000) stopAndAttach();
      }, 500);
    }).catch(function () {
      alert('تعذر الوصول للميكروفون — اسمح بالوصول من إعدادات المتصفح.');
    });
  }

  function togglePauseRec() {
    if (!recorder) return;
    try {
      if (recorder.state === 'recording' && typeof recorder.pause === 'function') {
        recorder.pause();
        recPaused = true;
      } else if (recorder.state === 'paused' && typeof recorder.resume === 'function') {
        recorder.resume();
        recPaused = false;
        var nowRs = (window.performance && window.performance.now) ? window.performance.now() : Date.now();
        recLastAppend = nowRs; recLastDraw = 0;
        if (recAnalyser && !recRaf) recRaf = requestAnimationFrame(drawWave);
      } else return;
    } catch (_) { return; }
    if (recUI) {
      var btn = recUI.querySelector('.foxy-rec-pause');
      var dot = recUI.querySelector('.foxy-rec-dot2');
      if (btn) btn.textContent = recPaused ? '▶' : '⏸';
      if (btn) btn.title = recPaused ? 'استئناف التسجيل' : 'إيقاف مؤقت';
      if (dot) dot.classList.toggle('paused', recPaused);
    }
  }
  window.togglePauseRec = togglePauseRec;

  function cancelRec() {
    try { if (recorder && recorder.state !== 'inactive') { recorder.ondataavailable = null; recorder.stop(); } } catch (_) {}
    try { recStream && recStream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {}
    recorder = null; recChunks = []; recPaused = false;
    window.removeEventListener('resize', sizeRecCanvas);
    restoreComposer();
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var voiceJobs = {};
  var OPT_BOX = { 'server-chat-input': 'server-chat-messages', 'home-dm-input': 'home-dm-messages', 'dm-input': 'dm-messages', 'chat-msg-input': 'chat-messages' };
  var SEND_BTN = { 'server-chat-input': 'server-chat-send-btn', 'home-dm-input': 'home-dm-send-btn', 'dm-input': 'dm-send-btn', 'chat-msg-input': 'send-btn' };

  function ensureOptStyle() {
    if (document.getElementById('foxy-opt-voice-style')) return;
    var st = document.createElement('style');
    st.id = 'foxy-opt-voice-style';
    st.textContent = '.foxy-opt-spin{width:18px;height:18px;flex-shrink:0;border:2.5px solid rgba(255,255,255,.18);border-top-color:#f59e0b;border-radius:50%;animation:foxyOptSpin .8s linear infinite}'
      + '@keyframes foxyOptSpin{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }

  function optRow(tempId) {
    try { return document.querySelector('[data-temp-voice="' + tempId + '"]'); } catch (_) { return null; }
  }

  function showOptimisticVoice(target, tempId, blobUrl, label) {
    var boxId = OPT_BOX[target];
    var box = boxId ? document.getElementById(boxId) : null;
    if (!box) return;
    ensureOptStyle();
    var me = {};
    try { me = window.currentUserProfile || {}; } catch (_) {}
    var nm = me.displayName || 'أنت';
    var initial = (String(nm).trim()[0] || 'أ').toUpperCase();
    var avatar = me.photoURL
      ? '<img src="' + escHtml(me.photoURL) + '" class="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="">'
      : '<span class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0" style="background:#0ea5e9">' + escHtml(initial) + '</span>';
    var row = document.createElement('div');
    row.setAttribute('data-temp-voice', tempId);
    row.className = 'flex gap-3 px-4 py-0.5 w-full items-start';
    row.innerHTML = avatar
      + '<div class="flex flex-col min-w-0 flex-1">'
      + '<div class="flex items-center gap-2 mb-0"><span class="text-[13px] font-bold" style="color:#10b981">أنت</span>'
      + '<span class="text-[9px] text-gray-500 font-medium">الآن</span>'
      + '<span class="text-[9px] text-amber-400 italic foxy-opt-status">جاري الإرسال…</span></div>'
      + '<div class="mt-2 flex items-center gap-2 max-w-md rounded-xl border border-dashed border-amber-400/40 bg-black/30 px-3 py-2">'
      + '<span class="foxy-opt-spin"></span>'
      + '<div class="min-w-0 flex-1"><div class="truncate text-[11px] font-bold text-gray-200">' + escHtml(label) + '</div>'
      + (blobUrl ? '<audio src="' + escHtml(blobUrl) + '" controls preload="metadata" class="w-full mt-1" style="height:32px"></audio>' : '')
      + '<div class="mt-1 h-1 rounded-full bg-white/10 overflow-hidden"><div class="foxy-opt-bar h-full rounded-full" style="width:0%;background:#f59e0b"></div></div>'
      + '<div class="foxy-opt-pct mt-0.5 text-[10px] font-bold text-amber-400">0%</div>'
      + '</div></div></div>';
    box.appendChild(row);
    try { box.scrollTop = box.scrollHeight; } catch (_) {}
  }

  function updateOptimisticVoice(tempId, pct) {
    var row = optRow(tempId); if (!row) return;
    var bar = row.querySelector('.foxy-opt-bar'), txt = row.querySelector('.foxy-opt-pct');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = pct + '% — جاري الإرسال…';
  }

  function removeOptimisticVoice(tempId, blobUrl) {
    var row = optRow(tempId);
    if (row && row.parentNode) { try { row.parentNode.removeChild(row); } catch (_) {} }
    if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch (_) {} }
    delete voiceJobs[tempId];
  }

  function failOptimisticVoice(tempId) {
    var row = optRow(tempId); if (!row) return;
    var spin = row.querySelector('.foxy-opt-spin');
    if (spin) spin.outerHTML = '<span class="foxy-opt-warn text-red-400 text-lg" style="flex-shrink:0">⚠</span>';
    var st = row.querySelector('.foxy-opt-status');
    if (st) { st.textContent = 'فشل الإرسال'; st.className = 'text-[9px] text-red-400 italic foxy-opt-status'; }
    var pct = row.querySelector('.foxy-opt-pct');
    if (pct) pct.innerHTML = '<button type="button" onclick="window.retryVoiceSend(\'' + tempId + '\')" class="text-blue-300 hover:underline ml-2">إعادة المحاولة</button>'
      + '<button type="button" onclick="window.dismissVoiceBubble(\'' + tempId + '\')" class="text-red-400 hover:underline ml-2">حذف</button>';
  }

  window.retryVoiceSend = function (tempId) {
    var job = voiceJobs[tempId]; if (!job || !job.file) return;
    var row = optRow(tempId); if (!row) return;
    var warn = row.querySelector('.foxy-opt-warn');
    if (warn) warn.outerHTML = '<span class="foxy-opt-spin"></span>';
    var st = row.querySelector('.foxy-opt-status');
    if (st) { st.textContent = 'جاري الإرسال…'; st.className = 'text-[9px] text-amber-400 italic foxy-opt-status'; }
    var pct = row.querySelector('.foxy-opt-pct'); if (pct) pct.textContent = '0%';
    var bar = row.querySelector('.foxy-opt-bar'); if (bar) bar.style.width = '0%';
    var item = (typeof window.addExternalAttachment === 'function') ? window.addExternalAttachment(job.target, {
      name: job.label, size: job.file.size, mime: job.file.type,
      kind: 'voice', status: 'uploading', percent: 0, autoSend: true
    }) : null;
    if (!item) return;
    job.item = item; job.xhr = null;
    voiceUpload(job);
  };

  window.dismissVoiceBubble = function (tempId) {
    var job = voiceJobs[tempId];
    if (job) {
      if (job.xhr) { try { job.xhr.abort(); } catch (_) {} }
      if (job.item && typeof window.removeAttachment === 'function') {
        try { window.removeAttachment(job.target, job.item.id); } catch (_) {}
      }
    }
    removeOptimisticVoice(tempId, job && job.blobUrl);
  };

  function startVoiceSend(target, file, secs) {
    var label = '🎙 فويس (' + fmtTime(secs * 1000) + ')';
    var tempId = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var blobUrl = '';
    try { blobUrl = URL.createObjectURL(file); } catch (_) {}
    showOptimisticVoice(target, tempId, blobUrl, label);
    var item = window.addExternalAttachment(target, {
      name: label, size: file.size, mime: file.type,
      kind: 'voice', status: 'uploading', percent: 0, autoSend: true
    });
    if (!item) { removeOptimisticVoice(tempId, blobUrl); return; }
    voiceJobs[tempId] = { key: tempId, target: target, file: file, label: label, blobUrl: blobUrl, item: item, xhr: null };
    voiceUpload(voiceJobs[tempId]);
  }

  function voiceUpload(job) {
    var target = job.target, file = job.file, tempId = job.key;
    uploadFileToDiscord(file, function (pct) {
      updateOptimisticVoice(tempId, pct);
      if (job.item && typeof window.updateExternalAttachment === 'function') window.updateExternalAttachment(target, job.item.id, { percent: pct });
    }, function (xhr) {
      job.xhr = xhr;
      if (job.item && typeof window.updateExternalAttachment === 'function') window.updateExternalAttachment(target, job.item.id, { xhr: xhr });
    }).then(function (res) {
      if (!voiceJobs[tempId]) return;
      if (job.item && typeof window.updateExternalAttachment === 'function') {
        window.updateExternalAttachment(target, job.item.id, { status: 'ready', percent: 100, url: res.url, size: res.size });
      }
      removeOptimisticVoice(tempId, job.blobUrl);
      setTimeout(function () {
        var btn = SEND_BTN[target] && document.getElementById(SEND_BTN[target]);
        if (btn) { try { btn.click(); } catch (_) {} }
      }, 200);
    }).catch(function () {
      if (!voiceJobs[tempId]) return;
      if (job.item && typeof window.removeAttachment === 'function') {
        try { window.removeAttachment(target, job.item.id); } catch (_) {}
      }
      job.item = null; job.xhr = null;
      failOptimisticVoice(tempId);
    });
  }

  function stopAndAttach() {
    if (!recorder || recorder.state === 'inactive') { window.removeEventListener('resize', sizeRecCanvas); restoreComposer(); return; }
    var target = recTarget || 'server-chat-input';
    var secs = Math.round(recElapsed / 1000);
    recorder.onstop = (function (orig) {
      return function () {
        try { orig && orig(); } catch (_) {}
        try { recStream && recStream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {}
        var blob = new Blob(recChunks, { type: (recorder && recorder.mimeType) || 'audio/webm' });
        recChunks = []; recorder = null; recPaused = false;
        window.removeEventListener('resize', sizeRecCanvas);
        restoreComposer();
        if (!blob.size) { alert('التسجيل فارغ — حاول مجدداً.'); return; }
        var file = new File([blob], 'voice-' + Date.now() + '.webm', { type: 'audio/webm' });
        if (typeof window.addExternalAttachment !== 'function') { alert('نظام المرفقات غير جاهز.'); return; }
        startVoiceSend(target, file, secs);
      };
    })(recorder.onstop);
    try { recorder.stop(); } catch (_) { window.removeEventListener('resize', sizeRecCanvas); restoreComposer(); }
  }

  window.FoxyMedia = {
    getWebhookURL: getWebhookURL,
    getWebhooks: getWebhooks,
    setWebhookURL: setWebhookURL,
    setWebhooks: setWebhooks,
    uploadFileToDiscord: uploadFileToDiscord,
    openPicker: openPicker,
    queueFile: queueFile,
    kindOf: kindOf,
    formatSize: formatSize,
    MAX_FILE_MB: MAX_FILE_MB
  };
})();
