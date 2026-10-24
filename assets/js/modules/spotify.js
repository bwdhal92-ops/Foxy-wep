(() => {
  const CLIENT_ID = "1d879482c8de45179f99bc2e90457031";
  const PRODUCTION_REDIRECT = "https://foxy.xo.je/login.html";
  const REDIRECT_URI = location.hostname === "foxy.xo.je"
    ? PRODUCTION_REDIRECT
    : `${location.origin}/login.html`;
  const ACCESS_KEY = "foxy-spotify-access-token";
  const REFRESH_KEY = "foxy-spotify-refresh-token";
  const EXPIRES_KEY = "foxy-spotify-expires-at";
  const VERIFIER_KEY = "foxy-spotify-pkce-verifier";
  const STATE_KEY = "foxy-spotify-oauth-state";

  const randomString = length => {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => (byte % 36).toString(36)).join("");
  };

  const base64Url = buffer => btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  async function createChallenge(verifier) {
    return base64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  }

  function hasConnection() {
    return !!localStorage.getItem(ACCESS_KEY);
  }

  function render() {
    const connected = hasConnection();
    const status = document.getElementById("spotify-connection-status");
    const connect = document.getElementById("spotify-connect-btn");
    const open = document.getElementById("spotify-open-btn");
    const disconnect = document.getElementById("spotify-disconnect-btn");
    if (status) status.textContent = connected ? window.__fb("js.sp_connected", "حساب Spotify متصل") : window.__fb("js.sp_connect_hint", "اربط حسابك لفتح Spotify بسرعة");
    if (connect) {
      connect.textContent = connected ? window.__fb("js.sp_linked", "تم ربط Spotify") : window.__fb("js.sp_link", "ربط حساب Spotify");
      connect.classList.toggle("hidden", connected);
    }
    if (open) open.classList.toggle("hidden", !connected);
    if (disconnect) disconnect.classList.toggle("hidden", !connected);
  }

  window.spotifyConnect = async () => {
    try {
      const verifier = randomString(64);
      const state = randomString(24);
      localStorage.setItem(VERIFIER_KEY, verifier);
      localStorage.setItem(STATE_KEY, state);
      const challenge = await createChallenge(verifier);
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: REDIRECT_URI,
        code_challenge_method: "S256",
        code_challenge: challenge,
        state,
        scope: "user-read-private user-read-email user-read-currently-playing user-read-playback-state"
      });
      console.info("[Spotify] Starting PKCE authorization", { redirectUri: REDIRECT_URI });
      location.href = `https://accounts.spotify.com/authorize?${params}`;
    } catch (error) {
      console.error("[Spotify] Could not start authorization", error);
      alert(window.__fb("js.spotify_fail", "تعذر بدء ربط Spotify. حاول مرة أخرى."));
    }
  };

  window.openSpotify = () => window.open("https://open.spotify.com/", "_blank", "noopener,noreferrer");

  window.spotifyDisconnect = () => {
    [ACCESS_KEY, REFRESH_KEY, EXPIRES_KEY, VERIFIER_KEY, STATE_KEY].forEach(key => localStorage.removeItem(key));
    console.info("[Spotify] Account disconnected");
    render();
  };

  async function exchangeCode() {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (!code) return;
    const state = params.get("state");
    const savedState = localStorage.getItem(STATE_KEY);
    const verifier = localStorage.getItem(VERIFIER_KEY);
    if (!verifier || !state || state !== savedState) {
      console.error("[Spotify] OAuth state verification failed");
      history.replaceState({}, document.title, location.pathname);
      return;
    }
    try {
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: verifier
        })
      });
      if (!response.ok) throw new Error(`Spotify token exchange failed: ${response.status}`);
      const token = await response.json();
      localStorage.setItem(ACCESS_KEY, token.access_token);
      if (token.refresh_token) localStorage.setItem(REFRESH_KEY, token.refresh_token);
      localStorage.setItem(EXPIRES_KEY, String(Date.now() + (token.expires_in || 3600) * 1000));
      localStorage.removeItem(VERIFIER_KEY);
      localStorage.removeItem(STATE_KEY);
      console.info("[Spotify] Account connected");
      history.replaceState({}, document.title, location.pathname);
      if (location.pathname.endsWith("/login.html")) {
        location.replace("/web.html");
      } else {
        render();
      }
    } catch (error) {
      console.error("[Spotify] Token exchange failed", error);
      history.replaceState({}, document.title, location.pathname);
    }
  }

  if (location.search.includes("code=")) exchangeCode();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render, { once: true });
  else render();
})();
