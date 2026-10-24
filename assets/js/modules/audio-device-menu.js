/* Foxy — قائمة أجهزة الصوت بستايل ديسكورد
 * ---------------------------------------------------------------------------
 * سهم صغير جنب زر المايك والسماعة في الشريط الجانبي:
 *  - سهم المايك → أجهزة الإدخال (تبديل حي) + اختبار مستوى المايك + إعدادات الصوت
 *  - سهم السماعة → أجهزة الإخراج (تبديل حي) + مستوى الصوت العام + إعدادات الصوت
 * يعيد استخدام البنية الموجودة: changeMicrophone / changeSpeaker / setAllAudioOutputs
 */
(function () {
  'use strict';

  var openKind = null;
  var meterStream = null, meterRAF = null, meterCtx = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function ensureStyle() {
    if (document.getElementById('foxy-adm-style')) return;
    var st = document.createElement('style');
    st.id = 'foxy-adm-style';
    st.textContent = '.voice-mini-chevron{width:24px;height:28px;min-width:24px;min-height:24px;border:none;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#64748b;background:transparent;cursor:pointer;transition:filter .15s;padding:0;flex-shrink:0}'
      + '.voice-mini-chevron:hover{filter:brightness(1.35)}'
      + '.voice-mini-chevron:hover{color:#fff;background:rgba(255,255,255,.1)}'
      + '.voice-mini-chevron svg{transition:transform .2s}'
      + '.voice-mini-chevron.open svg{transform:rotate(180deg)}'
      + '.voice-mini-chevron.open{color:#fff}'
      + '#audio-device-popup{position:fixed;z-index:99999;width:264px;max-width:calc(100vw - 24px);background:#1e1f22;border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.7);overflow:hidden;animation:foxyAdmIn .15s ease}'
      + '@keyframes foxyAdmIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'
      + '#audio-device-popup.hidden{display:none}'
      + '.adp-head{padding:12px 14px 8px;font-size:11px;font-weight:800;color:#e2e8f0}'
      + '.adp-sub{padding:0 14px 6px;font-size:10px;color:#64748b}'
      + '.adp-list{max-height:220px;overflow-y:auto;padding:0 8px}'
      + '.adp-item{display:flex;align-items:center;gap:8px;width:100%;text-align:start;background:none;border:none;border-radius:10px;padding:8px 10px;cursor:pointer;color:#cbd5e1;font-size:12px;font-weight:700;transition:.12s;font-family:inherit}'
      + '.adp-item:hover{background:rgba(255,255,255,.07);color:#fff}'
      + '.adp-item.active{color:#60a5fa}'
      + '.adp-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.15);flex-shrink:0}'
      + '.adp-item.active .adp-dot{background:#3b82f6;box-shadow:0 0 6px #3b82f6}'
      + '.adp-check{width:14px;height:14px;color:#60a5fa;flex-shrink:0;margin-inline-start:auto}'
      + '.adp-meter-wrap{padding:8px 14px 4px}'
      + '.adp-meter{height:6px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}'
      + '.adp-meter>div{height:100%;width:0%;border-radius:99px;background:linear-gradient(90deg,#22c55e,#eab308,#ef4444);transition:width .06s linear}'
      + '.adp-vol-row{display:flex;align-items:center;gap:8px;padding:8px 14px 4px;color:#cbd5e1;font-size:12px;font-weight:700}'
      + '.adp-vol-row input{flex:1;accent-color:#3b82f6}'
      + '.adp-vol-pct{font-size:11px;color:#94a3b8;min-width:38px;text-align:end;font-variant-numeric:tabular-nums}'
      + '.adp-foot{border-top:1px solid rgba(255,255,255,.06);margin-top:6px;padding:6px 8px 8px;display:flex;gap:6px}'
      + '.adp-foot button{flex:1;background:none;border:none;border-radius:10px;padding:8px;font-size:12px;font-weight:800;color:#94a3b8;cursor:pointer;transition:.12s;font-family:inherit}'
      + '.adp-foot button:hover{background:rgba(255,255,255,.07);color:#fff}'
      + '.adp-devrow{display:flex;align-items:center;gap:10px;width:100%;text-align:start;background:none;border:none;border-radius:10px;padding:9px 10px;cursor:pointer;color:#fff;font-family:inherit;transition:.12s}'
      + '.adp-devrow:hover{background:rgba(255,255,255,.07)}'
      + '.adp-devrow .t{font-size:12px;font-weight:800}'
      + '.adp-devrow .s{font-size:10px;color:#94a3b8;font-weight:600;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.adp-chev{color:#94a3b8;flex-shrink:0;margin-inline-start:auto}'
      + '#audio-device-sub{position:fixed;z-index:100000;width:264px;max-width:calc(100vw - 24px);background:#1e1f22;border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.7);overflow:hidden;animation:foxyAdmIn .15s ease}'
      + '#audio-device-sub.hidden{display:none}'
      + '.adp-back{display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;border-bottom:1px solid rgba(255,255,255,.06);padding:10px 12px;cursor:pointer;color:#e2e8f0;font-size:12px;font-weight:800;font-family:inherit}'
      + '.adp-back:hover{background:rgba(255,255,255,.05)}'
      + '.adp-radio{position:relative;width:18px;height:18px;border-radius:50%;border:2px solid #6b7280;flex-shrink:0}'
      + '.adp-radio.on{border-color:#3b82f6}'
      + '.adp-radio.on::after{content:"";position:absolute;inset:3px;border-radius:50%;background:#3b82f6;box-shadow:0 0 8px #3b82f6}'
      + '.adp-dev-ic{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;color:#9ca3af;flex-shrink:0}'
      + '.adp-dev-ic svg{width:18px;height:18px}';
    document.head.appendChild(st);
  }

  function popup() {
    var p = document.getElementById('audio-device-popup');
    if (p) return p;
    p = document.createElement('div');
    p.id = 'audio-device-popup';
    p.className = 'hidden';
    p.innerHTML = '<div class="adp-head" id="adp-title"></div>'
      + '<div class="adp-sub" id="adp-sub"></div>'
      + '<div class="adp-list custom-scroll" id="adp-list"></div>'
      + '<div id="adp-extra"></div>'
      + '<div class="adp-foot"><button type="button" id="adp-test" style="display:none"></button>'
      + '<button type="button" id="adp-settings" style="display:flex;align-items:center;justify-content:center;gap:8px"><svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M10.56 1.1c-.46.05-.7.53-.64.98.18 1.16-.19 2.2-.98 2.53-.8.33-1.79-.15-2.49-1.1-.27-.36-.78-.52-1.14-.24-.77.59-1.45 1.27-2.04 2.04-.28.36-.12.87.24 1.14.96.7 1.43 1.7 1.1 2.49-.33.8-1.37 1.16-2.53.98-.45-.07-.93.18-.99.64a11.1 11.1 0 0 0 0 2.88c.06.46.54.7.99.64 1.16-.18 2.2.19 2.53.98.33.8-.14 1.79-1.1 2.49-.36.27-.52.78-.24 1.14.59.77 1.27 1.45 2.04 2.04.36.28.87.12 1.14-.24.7-.95 1.7-1.43 2.49-1.1.8.33 1.16 1.37.98 2.53-.07.45.18.93.64.99a11.1 11.1 0 0 0 2.88 0c.46-.06.7-.54.64-.99-.18-1.16.19-2.2.98-2.53.8-.33 1.79.14 2.49 1.1.27.36.78.52 1.14.24.77-.59 1.45-1.27 2.04-2.04.28-.36.12-.87-.24-1.14-.96-.7-1.43-1.7-1.1-2.49.33-.8 1.37-1.16 2.53-.98.45.07.93-.18.99-.64a11.1 11.1 0 0 0 0-2.88c-.06-.46-.54-.7-.99-.64-1.16.18-2.2-.19-2.53-.98-.33-.8.14-1.79 1.1-2.49.36-.27.52-.78.24-1.14a11.07 11.07 0 0 0-2.04-2.04c-.36-.28-.87-.12-1.14.24-.7.96-1.7 1.43-2.49 1.1-.8-.33-1.16-1.37-.98-2.53.07-.45-.18-.93-.64-.99a11.1 11.1 0 0 0-2.88 0ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clip-rule="evenodd"/></svg><span>إعدادات الصوت</span></button></div>';
    document.body.appendChild(p);
    document.getElementById('adp-settings').addEventListener('click', function () {
      closeMenu();
      try {
        if (typeof window.switchView === 'function') window.switchView('settings');
        if (typeof window.switchSettingsTab === 'function') window.switchSettingsTab('voice');
      } catch (_) {}
    });
    document.getElementById('adp-test').addEventListener('click', function () { toggleMeter(); });
    var sub = document.createElement('div');
    sub.id = 'audio-device-sub';
    sub.className = 'hidden';
    document.body.appendChild(sub);
    document.addEventListener('click', function (e) {
      if (!openKind) return;
      var pp = document.getElementById('audio-device-popup');
      var sp = document.getElementById('audio-device-sub');
      var inMain = pp && pp.contains(e.target);
      var inSub = sp && sp.contains(e.target);
      if (!inMain && !inSub && !e.target.closest('.voice-mini-chevron')) closeMenu();
      else if (inMain && !inSub) closeSub();
    }, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
    return p;
  }

  function setChevrons() {
    ['mic-menu-btn', 'speaker-menu-btn'].forEach(function (id, i) {
      var b = document.getElementById(id);
      if (!b) return;
      var kind = i === 0 ? 'mic' : 'speaker';
      b.classList.toggle('open', openKind === kind);
    });
  }

  function syncChevron(btnId, chevId) {
    var main = document.getElementById(btnId), chev = document.getElementById(chevId);
    if (!main || !chev) return;
    try {
      var cs = window.getComputedStyle(main);
      if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') chev.style.background = cs.backgroundColor;
      else chev.style.background = '';
      if (cs.color) chev.style.color = cs.color;
      if (cs.borderRadius && cs.borderRadius !== '0px') chev.style.borderRadius = cs.borderRadius;
    } catch (_) {}
  }

  function syncAllChevrons() {
    syncChevron('mute-btn', 'mic-menu-btn');
    syncChevron('deafen-btn', 'speaker-menu-btn');
  }

  try {
    [['mute-btn', 'mic-menu-btn'], ['deafen-btn', 'speaker-menu-btn']].forEach(function (pair) {
      var main = document.getElementById(pair[0]);
      if (!main || !main.parentNode) return;
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].attributeName === 'class') { syncChevron(pair[0], pair[1]); break; }
        }
      }).observe(main, { attributes: true, attributeFilter: ['class'] });
    });
  } catch (_) {}
  syncAllChevrons();

  function closeMenu() {
    openKind = null;
    stopMeter();
    closeSub();
    var p = document.getElementById('audio-device-popup');
    if (p) p.classList.add('hidden');
    setChevrons();
  }

  function closeSub() {
    var sp = document.getElementById('audio-device-sub');
    if (sp) sp.classList.add('hidden');
  }

  async function ensureWebRTC() {
    try {
      if (typeof window.loadWebRTCTools === 'function') await window.loadWebRTCTools();
    } catch (_) {}
  }

  async function getDevices() {
    try {
      var devs = await navigator.mediaDevices.enumerateDevices();
      if (!devs.some(function (d) { return d.label; })) {
        try {
          var s = await navigator.mediaDevices.getUserMedia({ audio: true });
          s.getTracks().forEach(function (t) { t.stop(); });
          devs = await navigator.mediaDevices.enumerateDevices();
        } catch (_) {}
      }
      return devs;
    } catch (_) { return []; }
  }

  function selectedId(kind) {
    try {
      if (kind === 'mic') return localStorage.getItem('selectedMicrophoneId') || 'default';
      return localStorage.getItem('selectedSpeakerId') || 'default';
    } catch (_) { return 'default'; }
  }

  function deviceRows(devs, kind, current, icon) {
    var defLabel = kind === 'mic' ? 'الميكروفون الافتراضي' : 'جهاز الإخراج الافتراضي';
    var sysDef = devs.find(function (d) {
      return (kind === 'mic' ? d.kind === 'audioinput' : d.kind === 'audiooutput') && d.deviceId === 'default';
    });
    var list = devs.filter(function (d) {
      return (kind === 'mic' ? d.kind === 'audioinput' : d.kind === 'audiooutput')
        && d.deviceId !== 'default' && d.deviceId !== 'communications';
    });
    var isDef = current === 'default' || current === 'communications';
    var html = rowHtml('default', (sysDef && sysDef.label) || defLabel, isDef, icon);
    if (!list.length) {
      html += '<div style="padding:10px;text-align:center;font-size:10px;font-weight:700;color:#64748b">لا توجد أجهزة أخرى</div>';
    } else {
      html += list.map(function (d) {
        return rowHtml(d.deviceId, d.label || (kind === 'mic' ? 'ميكروفون' : 'سماعة'), d.deviceId === current, icon);
      }).join('');
    }
    return html;
  }

  function rowHtml(id, label, active, icon) {
    return '<button type="button" class="adp-item" data-dev-id="' + esc(id) + '">'
      + '<span class="adp-dev-ic">' + (icon || '') + '</span>'
      + '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:12px">' + esc(label) + '</span>'
      + '<span class="adp-radio' + (active ? ' on' : '') + '"></span>'
      + '</button>';
  }

  function stopMeter() {
    if (meterRAF) { try { cancelAnimationFrame(meterRAF); } catch (_) {} meterRAF = null; }
    if (meterStream) { try { meterStream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {} meterStream = null; }
    if (meterCtx) { try { meterCtx.close(); } catch (_) {} meterCtx = null; }
    var btn = document.getElementById('adp-test');
    if (btn && openKind === 'mic') btn.textContent = 'اختبار المايك';
  }

  async function toggleMeter() {
    if (meterStream) { stopMeter(); return; }
    var bar = document.getElementById('adp-meter-bar');
    var btn = document.getElementById('adp-test');
    try {
      var sel = selectedId('mic');
      meterStream = await navigator.mediaDevices.getUserMedia({
        audio: sel && sel !== 'default' ? { deviceId: { exact: sel } } : true
      });
      var AC = window.AudioContext || window.webkitAudioContext;
      meterCtx = new AC();
      var analyser = meterCtx.createAnalyser();
      analyser.fftSize = 256;
      meterCtx.createMediaStreamSource(meterStream).connect(analyser);
      var data = new Uint8Array(analyser.frequencyBinCount);
      if (btn) btn.textContent = '⏹ إيقاف الاختبار';
      var tick = function () {
        if (!meterStream) return;
        analyser.getByteFrequencyData(data);
        var sum = 0;
        for (var i = 0; i < data.length; i++) sum += data[i];
        var pct = Math.min(100, (sum / data.length / 128) * 100);
        if (bar) bar.style.width = pct + '%';
        meterRAF = requestAnimationFrame(tick);
      };
      tick();
    } catch (_) {
      stopMeter();
      alert('تعذر الوصول للميكروفون — اسمح بالوصول من إعدادات المتصفح.');
    }
  }

  function masterVolume() {
    try { return Math.min(100, Math.max(0, parseInt(localStorage.getItem('foxy_output_volume') || '100', 10) || 0)); }
    catch (_) { return 100; }
  }

  function applyMasterVolume(v) {
    v = Math.min(100, Math.max(0, Math.round(v)));
    try { localStorage.setItem('foxy_output_volume', String(v)); } catch (_) {}
    document.querySelectorAll('audio').forEach(function (a) { try { a.volume = v / 100; } catch (_) {} });
    var pct = document.getElementById('adp-vol-pct');
    if (pct) pct.textContent = v + '%';
    var slider = document.getElementById('adp-vol-slider');
    if (slider && String(slider.value) !== String(v)) slider.value = String(v);
  }
  window.setFoxyOutputVolume = applyMasterVolume;

  try {
    new MutationObserver(function (muts) {
      var v = masterVolume();
      if (v === 100) return;
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (!n || n.nodeType !== 1) return;
          if (n.tagName === 'AUDIO') { try { n.volume = v / 100; } catch (_) {} }
          else if (n.querySelectorAll) n.querySelectorAll('audio').forEach(function (a) { try { a.volume = v / 100; } catch (_) {} });
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}

  var MIC_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2"/><line stroke-linecap="round" x1="12" y1="19" x2="12" y2="22"/></svg>';
  var SPK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>';

  function currentLabel(kind, devs, current) {
    var isDef = current === 'default' || current === 'communications';
    var pool = (devs || []).filter(function (d) {
      return (kind === 'mic' ? d.kind === 'audioinput' : d.kind === 'audiooutput');
    });
    if (isDef) {
      var sys = pool.find(function (d) { return d.deviceId === 'default'; });
      return (sys && sys.label) || (kind === 'mic' ? 'الميكروفون الافتراضي' : 'جهاز الإخراج الافتراضي');
    }
    var hit = pool.find(function (d) { return d.deviceId === current; });
    return (hit && hit.label) || (kind === 'mic' ? 'ميكروفون' : 'سماعة');
  }

  async function renderMenu(kind) {
    var p = popup();
    closeSub();
    var title = document.getElementById('adp-title');
    var sub = document.getElementById('adp-sub');
    var list = document.getElementById('adp-list');
    var extra = document.getElementById('adp-extra');
    var testBtn = document.getElementById('adp-test');
    stopMeter();
    title.textContent = kind === 'mic' ? 'الميكروفون' : 'السماعة';
    sub.textContent = 'جاري قراءة الأجهزة…';
    list.innerHTML = '';
    extra.innerHTML = '';
    testBtn.style.display = 'none';
    var devs = await getDevices();
    if (!openKind) return;
    var current = selectedId(kind);
    sub.textContent = '';
    var devLabel = kind === 'mic' ? 'جهاز الإدخال' : 'جهاز الإخراج';
    list.innerHTML = '<button type="button" class="adp-devrow" id="adp-open-sub">'
      + '<span style="min-width:0;flex:1"><span class="t" style="display:block">' + devLabel + '</span>'
      + '<span class="s" style="display:block">' + esc(currentLabel(kind, devs, current)) + '</span></span>'
      + '<svg class="adp-chev" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path fill="currentColor" d="M9.3 5.3a1 1 0 0 0 0 1.4l5.29 5.3-5.3 5.3a1 1 0 1 0 1.42 1.4l6-6a1 1 0 0 0 0-1.4l-6-6a1 1 0 0 0-1.42 0Z"/></svg>'
      + '</button>';
    document.getElementById('adp-open-sub').addEventListener('click', function (e) {
      try { e.stopPropagation(); } catch (_) {}
      openDeviceSub(kind, devs);
    });
    if (kind === 'mic') {
      testBtn.style.display = '';
      testBtn.textContent = 'اختبار المايك';
      extra.innerHTML = '<div class="adp-meter-wrap"><div class="adp-meter"><div id="adp-meter-bar"></div></div></div>';
    } else {
      var v = masterVolume();
      extra.innerHTML = '<div class="adp-vol-row"><span style="font-size:10px;color:#94a3b8;font-weight:800">مستوى الصوت</span></div>'
        + '<div class="adp-vol-row" style="padding-top:0"><span class="adp-dev-ic" style="width:26px;height:26px">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:15px;height:15px"><path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg></span>'
        + '<input type="range" id="adp-vol-slider" min="0" max="100" value="' + v + '" class="discord-slider" style="flex:1;accent-color:#3b82f6">'
        + '<span class="adp-vol-pct" id="adp-vol-pct">' + v + '%</span></div>';
      var slider = document.getElementById('adp-vol-slider');
      if (slider) slider.addEventListener('input', function () { applyMasterVolume(parseInt(slider.value, 10) || 0); });
    }
  }

  function openDeviceSub(kind, devs) {
    var sp = document.getElementById('audio-device-sub');
    if (!sp) return;
    var main = document.getElementById('audio-device-popup');
    var current = selectedId(kind);
    var icon = kind === 'mic' ? MIC_SVG : SPK_SVG;
    var head = kind === 'mic' ? 'جهاز الإدخال' : 'جهاز الإخراج';
    var html = '<button type="button" class="adp-back" id="adp-sub-back">'
      + '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>'
      + '<span>' + head + '</span></button>'
      + '<div class="adp-list custom-scroll" style="padding:8px">' + deviceRows(devs, kind, current, icon) + '</div>';
    sp.innerHTML = html;
    sp.querySelectorAll('[data-dev-id]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        try { e.stopPropagation(); } catch (_) {}
        pickDevice(kind, btn.getAttribute('data-dev-id'));
      });
    });
    document.getElementById('adp-sub-back').addEventListener('click', function (e) {
      try { e.stopPropagation(); } catch (_) {}
      closeSub();
    });
    try {
      var r = main.getBoundingClientRect();
      var w = 272;
      sp.style.top = Math.max(8, r.top) + 'px';
      sp.style.bottom = 'auto';
      if (r.right + 8 + w <= window.innerWidth) sp.style.left = (r.right + 8) + 'px';
      else if (r.left - 8 - w >= 8) sp.style.left = (r.left - 8 - w) + 'px';
      else sp.style.left = Math.max(8, r.left) + 'px';
    } catch (_) {}
    sp.classList.remove('hidden');
  }

  async function pickDevice(kind, id) {
    await ensureWebRTC();
    try {
      if (kind === 'mic') {
        if (typeof window.changeMicrophone === 'function') await window.changeMicrophone(id);
      } else {
        if (typeof window.changeSpeaker === 'function') await window.changeSpeaker(id);
      }
    } catch (_) {}
    closeSub();
    if (openKind === kind) renderMenu(kind);
  }

  window.toggleAudioDeviceMenu = async function (ev, kind) {
    if (ev) { try { ev.stopPropagation(); } catch (_) {} }
    ensureStyle();
    syncAllChevrons();
    if (openKind === kind) { closeMenu(); return; }
    openKind = kind;
    setChevrons();
    var p = popup();
    var btn = ev && ev.currentTarget;
    p.classList.remove('hidden');
    try {
      if (btn && btn.getBoundingClientRect) {
        var r = btn.getBoundingClientRect();
        p.style.left = Math.max(8, Math.min(window.innerWidth - 276, r.left - 40)) + 'px';
        p.style.top = 'auto';
        p.style.bottom = Math.max(8, window.innerHeight - r.top + 10) + 'px';
      } else {
        p.style.left = '12px';
        p.style.bottom = '90px';
      }
    } catch (_) {}
    await renderMenu(kind);
  };
  window.closeAudioDeviceMenu = closeMenu;
})();
