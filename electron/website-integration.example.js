/**
 * Foxy — مثال تكامل الموقع مع تطبيق Electron (Site Wrapper)
 * ============================================================================
 * ضع هذا الكود في موقعك الإلكتروني (https://your-voice-chat-app.com).
 * يعمل بأمان في الحالتين:
 *  - داخل تطبيق Electron  → يستخدم window.electronAPI (الاختصار العالمي، التنبيهات...)
 *  - في المتصفح العادي    → يتجاهل التكامل تلقائياً بدون أي خطأ
 *
 * المتطلبات في الموقع: زر كتم بمعرّف #muteBtn + عنصر حالة #micStatus (اختياري)
 * ============================================================================
 */

(function () {
  'use strict';

  const isElectron =
    typeof window !== 'undefined' &&
    !!window.electronAPI &&
    window.electronAPI.isElectron === true;

  const micState = { muted: false, stream: null };

  async function initMicrophone() {
    try {
      micState.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[Foxy] Microphone ready');
      return micState.stream;
    } catch (err) {
      console.error('[Foxy] Microphone access denied:', err);
      return null;
    }
  }

  function setMuted(muted) {
    micState.muted = muted;

    if (micState.stream) {
      micState.stream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }

    updateMuteUI();

    if (isElectron && window.electronAPI.sendMuteState) {
      window.electronAPI.sendMuteState({ muted });
    }
  }

  function toggleMute() {
    setMuted(!micState.muted);
  }

  function updateMuteUI() {
    const btn = document.getElementById('muteBtn');
    const status = document.getElementById('micStatus');
    if (btn) {
      btn.textContent = micState.muted ? '🔇 مكتوم' : '🎙️ يعمل';
      btn.classList.toggle('muted', micState.muted);
    }
    if (status) status.textContent = micState.muted ? 'الميكروفون مكتوم' : 'الميكروفون يعمل';
  }

  if (isElectron && window.electronAPI.onGlobalMuteToggle) {
    window.electronAPI.onGlobalMuteToggle(() => {
      toggleMute();
      console.log('[Foxy] Global hotkey pressed → muted:', micState.muted);
    });
  }

  function notify(title, body) {
    if (isElectron && window.electronAPI.showNotification) {
      window.electronAPI.showNotification(title, body);
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }

  function onUserJoinedVoice(username) {
    notify('Foxy', `انضم ${username} إلى المحادثة الصوتية 🎧`);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initMicrophone();

    const btn = document.getElementById('muteBtn');
    if (btn) btn.addEventListener('click', toggleMute);

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMute();
      }
    });

    if (isElectron) console.log('[Foxy] Running inside Electron wrapper ✓');
  });

  window.foxyVoice = { toggleMute, setMuted, notify, onUserJoinedVoice, isElectron };
})();
