const PipManager = {
  video: null,
  canvas: null,
  ctx: null,
  stream: null,
  isActive: !1,
  currentSpeaker: window.__fb("js.pip_none", "لا أحد يتحدث"),
  isSpeaking: !1,
  animationId: null,
  speakerQueue: new Set,
  screenPipActive: !1,
  _cachedFonts: {},
  init() {
    this.video = document.getElementById("voice-pip-video"), this.canvas = document.getElementById("voice-pip-canvas"), this.canvas && this.video && (this.ctx = this.canvas.getContext("2d"), this.stream = this.canvas.captureStream(15), this.video.srcObject = this.stream, this.video && this.video.isConnected && this.video.play().catch(e => {
      e.name
    }), this.video.addEventListener("enterpictureinpicture", () => {
      this.isActive = !0, this.startRendering()
    }), this.video.addEventListener("leavepictureinpicture", () => {
      this.isActive = !1, this.stopRendering()
    }), this.draw(), document.addEventListener("visibilitychange", () => {
      const e = "true" === localStorage.getItem("vh-auto-pip");
      if (document.hidden && e) {
        if ((navigator.userAgent.includes("Electron") || !/Android|iPhone|iPad/i.test(navigator.userAgent)) && !this.isInCall()) return;
        this.handleAutoPip()
      }
    }))
  },
  // FIX: استعادة الصوت (بدون 1-فريم) عند PiP
  _ensureAudioResume() {
    try {
      if (window.audioCtx && "suspended" === window.audioCtx.state) window.audioCtx.resume().catch(() => {});
      if (window.masterAudioMixer && window.masterAudioMixer.resume) window.masterAudioMixer.resume();
    } catch (_) {}
  },
  isInCall() {
    const e = document.getElementById("active-room-indicator"),
      t = document.getElementById("view-room"),
      i = document.getElementById("dm-call-voice-bar");
    return e && !e.classList.contains("hidden") || t && t.classList.contains("active-view") || i && !i.classList.contains("hidden")
  },
  async handleAutoPip() {
    if ("true" !== localStorage.getItem("vh-auto-pip")) return;
    if (document.pictureInPictureElement) return;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    // FIX: على موبايل، PiP يعلق في 1 فريم ويشلّ الصوت/الفيديو.
    // لا تفعل auto-PiP على موبايل أبدا.
    if (isMobile) return;
    const e = document.getElementById("screen-video");
    if (e && e.srcObject && e.srcObject.active) try {
      return await e.requestPictureInPicture(), this.screenPipActive = !0, void this._updateScreenPipButton(!0)
    } catch (e) {}
    if (this.isInCall()) try {
      this.video || this.init(), this.video && this.video.isConnected && await this.video.play().catch(e => {
        if ("AbortError" !== e.name) throw e
      }), await this.video.requestPictureInPicture()
    } catch (e) {}
  },
  async togglePip() {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      // FIX: PiP (canvas captureStream) على موبايل يعلق في 1 فريم ويشلّ الصوت.
      // أبقِ الصوت/الفيديو في overlay (غير عائم) على موبايل.
      "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.pip_mobile_disabled2", "⚠️ النافذة العائمة معطلة على الموبايل — الصوت/الفيديو في الشاشة للتشغيل سليم"), "warning");
      return;
    }
    if (this.video || this.init(), this.video) try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      this._ensureAudioResume();
    } else {
      this.video.isConnected && await this.video.play().catch(e => {
        if ("AbortError" !== e.name) throw e
      });
      await this.video.requestPictureInPicture();
      this._ensureAudioResume();
    }
    } catch (e) {
      "NotAllowedError" === e.name ? alert(window.__fb("js.pip_click", "يجب النقر على الزر لتفعيل النافذة العائمة.")) : alert(window.__fb("js.pip_unsupported", "عذراً، متصفحك لا يدعم هذه الخاصية أو حدث خطأ ما."))
    }
  },
  async toggleScreenPip() {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      // FIX: PiP لمشاركة الشاشة على موبايل يعلق في 1 فريم ويشلّ الصوت.
      // أبقِ البث في overlay (غير عائم) على موبايل.
      "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.pip_mobile_disabled", "⚠️ النافذة العائمة معطلة على الموبايل — ابقِ البث في الشاشة للتشغيل سليم"), "warning");
      return;
    }
    const e = document.getElementById("screen-video");
    if (e) {
    if (document.pictureInPictureElement) {
      if (document.pictureInPictureElement === e) return await document.exitPictureInPicture(), this.screenPipActive = !1, void this._updateScreenPipButton(!1);
      await document.exitPictureInPicture();
      this._ensureAudioResume();
    }
      if (e.srcObject) try {
        e.isConnected && await e.play().catch(e => {
          if ("AbortError" !== e.name) throw e
        });
        await e.requestPictureInPicture();
        this.screenPipActive = !0;
        this._updateScreenPipButton(!0);
        this._ensureAudioResume();
        const t = document.getElementById("screen-overlay");
        t && t.classList.add("hidden");
        const i = () => {
          this.screenPipActive = !1;
          this._updateScreenPipButton(!1);
          e.removeEventListener("leavepictureinpicture", i);
          if (e.srcObject && window.currentScreenSource) {
            const e = document.getElementById("screen-overlay");
            e && (e.classList.remove("hidden"), e.classList.add("flex"))
          }
        };
        e.addEventListener("leavepictureinpicture", i)
      } catch (e) {
        this.screenPipActive = !1;
        this._updateScreenPipButton(!1);
        "NotAllowedError" === e.name ? alert(window.__fb("js.pip_click", "يجب النقر على الزر لتفعيل النافذة العائمة.")) : alert(window.__fb("js.pip_unsupported", "عذراً، متصفحك لا يدعم هذه الخاصية أو حدث خطأ ما."))
      } else "function" == typeof addSystemMsg && addSystemMsg(window.__fb("js.pip_no_screen", "⚠️ لا يوجد بث شاشة نشط لعرضه في النافذة العائمة"))
    }
  },
  _updateScreenPipButton(e) {
    const t = document.getElementById("screen-pip-btn");
    t && (e ? (t.classList.add("bg-blue-500/20", "text-blue-400"), t.classList.remove("text-gray-400"), t.title = window.__fb("js.pip_close", "إغلاق النافذة العائمة")) : (t.classList.remove("bg-blue-500/20", "text-blue-400"), t.classList.add("text-gray-400"), t.title = window.__fb("js.pip_window", "نافذة عائمة")))
  },
  updateSpeaker(e, t) {

    t ? (this.speakerQueue.add(e), this.currentSpeaker = e, this.isSpeaking = !0) : (this.speakerQueue.delete(e), this.speakerQueue.size > 0 ? (this.currentSpeaker = Array.from(this.speakerQueue).pop(), this.isSpeaking = !0) : this.isSpeaking = !1)
  },
  stop() {
    this.screenPipActive && document.pictureInPictureElement && (document.exitPictureInPicture().catch(() => {}), this.screenPipActive = !1, this._updateScreenPipButton(!1)), document.pictureInPictureElement && document.exitPictureInPicture().catch(() => {}), this.stopRendering()
  },
  startRendering() {
    if (this.animationId) return;
    let e = performance.now();
    const t = i => {
      if (!this.isActive) return;
      this.animationId = requestAnimationFrame(t);
      const n = i - e;
      n >= 125 && (e = i - n % 125, this.draw())
    };
    this.animationId = requestAnimationFrame(t)
  },
  stopRendering() {
    this.animationId && (cancelAnimationFrame(this.animationId), this.animationId = null)
  },
  _setFont(e, t) {
    this._cachedFonts[e] !== t && (this._cachedFonts[e] = t, this.ctx.font = t)
  },
  draw() {
    const {
      ctx: e,
      canvas: t,
      currentSpeaker: i,
      isSpeaking: n
    } = this;
    if (!e) return;
    const s = t.width,
      c = t.height;
    e.fillStyle = "#1e1f22", e.fillRect(0, 0, s, c), e.fillStyle = "#3b82f6", e.fillRect(0, 0, s, 40), e.fillStyle = "white", e.textAlign = "center", this._setFont("header", "bold 18px sans-serif"), e.fillText("Discord Voice Overlay", s / 2, 28), e.fillStyle = n ? "#22c55e" : "#475569", e.beginPath(), e.arc(s / 2, c / 2 - 20, 60, 0, 2 * Math.PI), e.fill(), e.fillStyle = "white", this._setFont("initial", "bold 48px sans-serif");
    const r = i && window.__fb("js.pip_none", "لا أحد يتحدث") !== i ? i.charAt(0).toUpperCase() : "?";
    if (e.fillText(r, s / 2, c / 2 + 0), e.fillStyle = "white", this._setFont("name", "bold 24px sans-serif"), e.fillText(i, s / 2, c / 2 + 80), this._setFont("status", "16px sans-serif"), e.fillStyle = n ? "#4ade80" : "#94a3b8", e.fillText(n ? window.__fb("js.pip_talking", "يتحدث الآن...") : window.__fb("js.pip_muted", "صامت"), s / 2, c / 2 + 110), n) {
      const t = (Math.sin(Date.now() / 200) + 1) / 2;
      e.strokeStyle = `rgba(34, 197, 94, ${.2+.3*t})`, e.lineWidth = 4, e.beginPath(), e.arc(s / 2, c / 2 - 20, 65 + 10 * t, 0, 2 * Math.PI), e.stroke()
    }
  }
};
window.pipManager = PipManager, "complete" === document.readyState || "interactive" === document.readyState ? PipManager.init() : document.addEventListener("DOMContentLoaded", () => PipManager.init());