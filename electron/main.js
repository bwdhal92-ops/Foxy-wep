/**
 * Foxy — Site Wrapper + Full Desktop Capabilities (Main Process)
 * =====================================================
 * يفتح رابط الموقع الخارجي (مستقرة foxy.xo.je / تجريبية abdo3.xo.je)
 * مع تحديث فوري للواجهة، ويدمج جميع قدرات desktopapp.js القديمة:
 *  - الأمان: nodeIntegration:false / contextIsolation:true / sandbox:true
 *  - تقييد التنقل لرابط الموقع فقط + الروابط الخارجية في متصفح النظام
 *  - Global Hotkey (Ctrl+Shift+M) + System Tray + Offline Fallback
 *  - مشاركة الشاشة، دخول جوجل الخارجي، فتح الروابط، إعدادات النظام
 *  - Firebase Config، نظام التحديث التلقائي (ASAR)، Overlays، كشف الألعاب
 *
 * التشغيل:  npm run start:wrapper
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const os = require('os');
const { spawn } = require('child_process');
const {
  app, BrowserWindow, ipcMain, Tray, Menu,
  desktopCapturer, shell, globalShortcut, Notification, session,
} = require('electron');
const i18nMain = require('./i18n-main');

const SERVERS = {

  stable: { key: 'stable', label: 'المستقرة', host: 'foxy.xo.je', url: 'https://foxy.xo.je/login.html' },
  beta: { key: 'beta', label: 'التجريبية 🧪', host: 'abdo3.xo.je', url: 'https://abdo3.xo.je/login.html' },
};

const ALLOWED_ORIGINS = new Set(Object.values(SERVERS).map((s) => new URL(s.url).origin));
const MUTE_HOTKEY = 'CommandOrControl+Shift+M';

const FALLBACK_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDwddv_-qEU0_5ZLTZTWCgox7VVvtxZx68',
  authDomain: 'discord-94524.firebaseapp.com',
  databaseURL: 'https://discord-94524-default-rtdb.firebaseio.com',
  projectId: 'discord-94524',
  storageBucket: 'discord-94524.firebasestorage.app',
  messagingSenderId: '25789751728',
  appId: '1:25789751728:web:60d7e38a4b8fc4f1b77675',
  measurementId: 'G-J4YB8VD70Z',
};

const serverConfigPath = path.join(app.getPath('userData'), 'server-config.json');

function getServerConfig() {
  const defaults = { preferredServer: 'stable', dontShowServerSelector: false };
  try {
    if (fs.existsSync(serverConfigPath)) {
      const saved = JSON.parse(fs.readFileSync(serverConfigPath, 'utf8'));
      if (saved.preferredServer !== 'stable' && saved.preferredServer !== 'beta') {
        saved.preferredServer = 'stable';
      }
      return {
        preferredServer: saved.preferredServer,
        dontShowServerSelector: !!saved.dontShowServerSelector,
      };
    }
  } catch (e) { console.error('[Server] Failed to read server config', e); }
  return defaults;
}

function saveServerConfig(cfg) {
  try {
    const safe = {
      preferredServer: cfg.preferredServer === 'beta' ? 'beta' : 'stable',
      dontShowServerSelector: !!cfg.dontShowServerSelector,
    };
    fs.writeFileSync(serverConfigPath, JSON.stringify(safe, null, 2));
    return safe;
  } catch (e) { console.error('[Server] Failed to save server config', e); return cfg; }
}

function isUrlAllowed(url) {
  if (typeof url !== 'string') return false;
  if (url.startsWith('file://')) return true;
  try {
    return ALLOWED_ORIGINS.has(new URL(url).origin);
  } catch { return false; }
}

const CURRENT_VERSION = '1.0.0';
const GITHUB_REPO = 'dswdwsds/dis';

let mainWindow = null;
let selectorWindow = null;
let tray = null;
let overlayWindow = null;
let isQuitting = false;
let configCloseToTray = true;
let trayState = { inCall: false, isMuted: false, isDeafened: false };

let currentServerKey = getServerConfig().preferredServer;
let currentServerUrl = SERVERS[currentServerKey].url;

function logUpdater(msg) {
  try {
    const logDir = app.isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '..');
    fs.appendFileSync(path.join(logDir, 'updater.log'), `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) { console.error('Log failed', e); }
}

function logError(error) {
  try {
    const errorLogPath = path.join(app.getPath('userData'), 'error.log');
    fs.appendFileSync(errorLogPath, `[${new Date().toISOString()}] ${error.stack || error}\n`);
  } catch (e) { console.error('Failed to write to error log', e); }
}

process.on('uncaughtException', (error) => { logError(error); console.error('Uncaught Exception:', error); });
process.on('unhandledRejection', (reason, promise) => { logError(reason); console.error('Unhandled Rejection at:', promise, 'reason:', reason); });

app.setName('Foxy');
app.commandLine.appendSwitch('disable-quic');
app.commandLine.appendSwitch('disable-features', 'ComputePressure');
if (process.platform === 'win32') app.setAppUserModelId('Foxy');

try {
  os.setPriority(process.pid, os.constants.priority.PRIORITY_HIGH);
  console.log('[Electron] Process priority set to HIGH');
} catch (e) { console.error('[Electron] Failed to set process priority', e); }

const hwConfigPath = path.join(app.getPath('userData'), 'hw-accel-config.json');
let disableGPU = false;
try {
  if (fs.existsSync(hwConfigPath)) {
    const saved = JSON.parse(fs.readFileSync(hwConfigPath, 'utf8'));
    if (typeof saved.disableGPU === 'boolean') disableGPU = saved.disableGPU;
  } else {
    try { fs.writeFileSync(hwConfigPath, JSON.stringify({ disableGPU: false })); } catch (e) { console.error('Failed to create config', e); }
  }
} catch (e) { console.error('Failed to read config', e); }
if (disableGPU) { app.disableHardwareAcceleration(); console.log('[Electron] Hardware acceleration DISABLED'); }
else console.log('[Electron] Hardware acceleration ENABLED');

const gpuMarkerPath = path.join(app.getPath('userData'), 'gpu-crash-marker');
let keepGpuMarker = false;
let softwareRendering = process.argv.includes('--foxy-software-rendering');
try { fs.mkdirSync(app.getPath('userData'), { recursive: true }); } catch (e) {}
function applySoftwareRendering() {
  softwareRendering = true;

  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('in-process-gpu');
}
if (!softwareRendering && fs.existsSync(gpuMarkerPath)) {
  console.log('[Electron] Previous run crashed — starting with software rendering');
  applySoftwareRendering();
}
try { fs.writeFileSync(gpuMarkerPath, new Date().toISOString()); } catch (e) {}
function relaunchWithSoftwareRendering(reason) {
  console.log(`[Electron] ${reason} — relaunching with software rendering...`);
  keepGpuMarker = true;
  try { fs.writeFileSync(gpuMarkerPath, 'software-forced'); } catch (e) {}
  app.relaunch({ args: process.argv.slice(1).concat(['--foxy-software-rendering']) });
  app.quit();
}
function relaunchNoSandbox() {
  console.error('[Electron] All renderers die sandboxed — relaunching without renderer sandbox...');
  keepGpuMarker = true;
  try { fs.writeFileSync(gpuMarkerPath, 'software-forced'); } catch (e) {}
  try { fs.writeFileSync(noSandboxMarkerPath, new Date().toISOString()); } catch (e) {}

  const args = process.argv.slice(1);
  if (!args.includes('--foxy-software-rendering')) args.push('--foxy-software-rendering');
  if (!args.includes('--foxy-no-sandbox')) args.push('--foxy-no-sandbox');
  app.relaunch({ args });
  app.quit();
}
function gpuLooksBroken() {
  try {
    const s = app.getGPUFeatureStatus() || {};
    const keys = ['gpu_compositing', 'webgl', 'webgl2', 'canvas_oop_rasterization', 'rasterization', 'video_decode'];
    return !keys.some((k) => /hardware|^enabled/.test(String(s[k] || '')));
  } catch (e) { return false; }
}

const noSandboxMarkerPath = path.join(app.getPath('userData'), 'no-sandbox-marker');
let noSandbox = process.argv.includes('--foxy-no-sandbox');
if (!noSandbox) {
  try {
    if (fs.existsSync(noSandboxMarkerPath)) {
      console.log('[Electron] Renderer sandbox previously fatal — starting with --no-sandbox');
      noSandbox = true;
    }
  } catch (e) {}
}
if (noSandbox) app.commandLine.appendSwitch('no-sandbox');

function getLocalFirebaseConfig() {
  try {
    const configPath = path.join(app.getPath('userData'), 'firebase-config.json');
    if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) { console.error('[Server] Failed to read firebase-config.json', e); }
  if (process.env.FIREBASE_API_KEY) {
    return {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID,
    };
  }

  return { ...FALLBACK_FIREBASE_CONFIG };
}

const PUBLIC_LOCAL_PAGES = new Set([
  '/electron/externallogin.html',
  '/electron/server-selector.html',
  '/electron/offline.html',
  '/electron/overlay.html',
]);
let localPort = 0;
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, 'http://localhost:0');
  const pathname = parsedUrl.pathname;

  if (pathname === '/auth-completed') {
    const idToken = parsedUrl.searchParams.get('idToken');
    const accessToken = parsedUrl.searchParams.get('accessToken');
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) windows[0].webContents.send('external-auth-success', { idToken, accessToken });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <div style="background:#1e1e1e; color:white; height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:sans-serif; text-align:center;">
        <h1 style="color:#4CAF50;">${i18nMain.t("login_page.electron_login_success")}</h1>
        <p>${i18nMain.t("login_page.electron_login_close")}</p>
        <script>setTimeout(() => window.close(), 2000);</script>
      </div>`);
    return;
  }

  if (pathname === '/config') {
    const cfg = getLocalFirebaseConfig();
    if (!cfg) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Firebase config not found. Create firebase-config.json in userData or set env vars.' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(cfg));
    return;
  }

  const urlPath = req.url === '/' ? '/web.html' : pathname;
  const normalizedPath = path.normalize(urlPath).replace(/\\/g, '/');
  if (normalizedPath !== urlPath) { res.writeHead(403); res.end('Forbidden: Path traversal attempt detected'); return; }
  const sensitivePaths = ['/firebase-config.json', '/.env', '/node_modules/', '/electron/', '/assets/js/firebase-config.js'];
  if (!PUBLIC_LOCAL_PAGES.has(normalizedPath) && sensitivePaths.some((p) => normalizedPath.startsWith(p))) { res.writeHead(403); res.end('Forbidden: Access denied'); return; }
  const filePath = path.join(__dirname, '..', normalizedPath);
  const allowedRoot = path.resolve(__dirname, '..');
  if (!path.resolve(filePath).startsWith(allowedRoot)) { res.writeHead(403); res.end('Forbidden: Access denied'); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
      '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
      '.svg': 'image/svg+xml', '.json': 'application/json',
      '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  });
});

const portConfigPath = path.join(app.getPath('userData'), 'port-config.json');
let preferredPort = 36542;
try {
  if (fs.existsSync(portConfigPath)) {
    const savedPort = JSON.parse(fs.readFileSync(portConfigPath, 'utf8')).port;
    if (savedPort) preferredPort = savedPort;
  }
} catch (e) { console.error('[Server] Failed to read port config', e); }

function startInternalServer(port) {
  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      localPort = server.address().port;
      console.log(`[Server] Internal server running at http://localhost:${localPort}`);
      try { fs.writeFileSync(portConfigPath, JSON.stringify({ port: localPort })); }
      catch (e) { console.error('[Server] Failed to save port config', e); }
      resolve(localPort);
    });
    server.once('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        console.warn(`[Server] Port ${port} is in use, trying a random port...`);
        startInternalServer(0).then(resolve).catch(reject);
      } else reject(e);
    });
  });
}

function waitForServer(port, maxAttempts = 20, intervalMs = 250) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    (function check() {
      attempts++;
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => { res.resume(); resolve(); });
      req.on('error', () => {
        if (attempts >= maxAttempts) reject(new Error(`[Server] Not ready after ${maxAttempts} attempts.`));
        else setTimeout(check, intervalMs);
      });
      req.end();
    })();
  });
}

async function checkForUpdates() {
  return new Promise((resolve) => {
    logUpdater(`Checking for updates... Current version: ${CURRENT_VERSION}`);
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      headers: { 'User-Agent': 'Electron-Updater-Foxy' },
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) { logUpdater(`GitHub API Error (${res.statusCode})`); return resolve(null); }
          const release = JSON.parse(data);
          const asarAsset = release.assets?.find((a) => a.name === 'app.asar');
          const cleanLatest = release.tag_name.replace('v', '');
          const cleanCurrent = CURRENT_VERSION.replace('v', '');
          if (asarAsset && cleanLatest !== cleanCurrent) {
            const resourcesPath = app.isPackaged ? path.dirname(app.getAppPath()) : app.getAppPath();
            const isDownloaded = fs.existsSync(path.join(resourcesPath, `update-${release.tag_name}.asar`));
            logUpdater(`Update available: ${release.tag_name} (Cached: ${isDownloaded})`);
            resolve({ version: release.tag_name, asarUrl: asarAsset.browser_download_url, isDownloaded });
          } else { logUpdater('No update needed.'); resolve(null); }
        } catch (e) { logUpdater(`Parse error: ${e.message}`); resolve(null); }
      });
    }).on('error', (err) => { logUpdater(`Request error: ${err.message}`); resolve(null); });
  });
}

async function downloadUpdate(version, fileUrl) {
  const resourcesPath = app.isPackaged ? path.dirname(app.getAppPath()) : app.getAppPath();
  const updateFinalPath = path.join(resourcesPath, `update-${version}.asar`);
  const updateTempPath = updateFinalPath + '.tmp';
  logUpdater(`Starting download for ${version}. Destination: ${updateFinalPath}`);
  const originalNoAsar = process.noAsar;
  process.noAsar = true;

  const downloadFile = (url, destPath) => new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Electron-Updater-Foxy' } }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) return reject(new Error(`Server error: ${response.statusCode}`));
      const expectedSha256 = response.headers['x-content-sha256'];
      const hash = crypto.createHash('sha256');
      const dest = fs.createWriteStream(destPath);
      response.pipe(dest);
      response.on('data', (chunk) => hash.update(chunk));
      dest.on('finish', () => {
        dest.close();
        const actualSha256 = hash.digest('hex');
        if (expectedSha256 && actualSha256 !== expectedSha256) {
          fs.unlinkSync(destPath);
          return reject(new Error(`Checksum mismatch: expected ${expectedSha256}, got ${actualSha256}`));
        }
        resolve();
      });
      dest.on('error', (err) => { dest.close(); if (fs.existsSync(destPath)) fs.unlinkSync(destPath); reject(err); });
    }).on('error', reject);
  });

  try {
    await downloadFile(fileUrl, updateTempPath);
    if (fs.existsSync(updateFinalPath)) fs.unlinkSync(updateFinalPath);
    fs.renameSync(updateTempPath, updateFinalPath);
    fs.readdirSync(resourcesPath).forEach((f) => {
      if (f.startsWith('update-v') && f !== `update-${version}.asar`) {
        try { fs.unlinkSync(path.join(resourcesPath, f)); } catch (e) {}
      }
    });
    logUpdater(`Update ${version} downloaded and verified.`);
    process.noAsar = originalNoAsar;
    return updateFinalPath;
  } catch (err) {
    process.noAsar = originalNoAsar;
    if (fs.existsSync(updateTempPath)) fs.unlinkSync(updateTempPath);
    logUpdater(`Download error: ${err.message}`);
    throw err;
  }
}

function handleAsarSwitch() {
  if (!app.isPackaged) return;
  const resourcesPath = path.dirname(app.getAppPath());
  const files = fs.readdirSync(resourcesPath);
  const updateFileBase = files.find((f) => f.startsWith('update-v') && f.endsWith('.asar'));
  if (!updateFileBase) return;
  const updateFile = path.join(resourcesPath, updateFileBase);
  const coreFile = path.join(resourcesPath, 'app.asar');
  const backupFile = path.join(resourcesPath, 'app.asar.old');
  logUpdater(`Found update file: ${updateFileBase}. Applying offline...`);
  try {
    if (fs.existsSync(backupFile)) fs.unlinkSync(backupFile);
    fs.renameSync(coreFile, backupFile);
    fs.renameSync(updateFile, coreFile);
    logUpdater('Offline update applied successfully!');
  } catch (e) { logUpdater(`Offline update failed: ${e.message}`); }
}
handleAsarSwitch();

const ZOOM_STEP = 0.5;
const ZOOM_MIN = -3;
const ZOOM_MAX = 3;
const zoomConfigPath = path.join(app.getPath('userData'), 'zoom-config.json');

function getSavedZoomLevel() {
  try {
    if (fs.existsSync(zoomConfigPath)) {
      const v = JSON.parse(fs.readFileSync(zoomConfigPath, 'utf8')).zoomLevel;
      if (typeof v === 'number' && isFinite(v)) {
        return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));
      }
    }
  } catch (e) {}
  return 0;
}
function saveZoomLevel(level) {
  try { fs.writeFileSync(zoomConfigPath, JSON.stringify({ zoomLevel: level })); } catch (e) {}
}
function zoomPercent(level) {
  return Math.round(Math.pow(1.2, level) * 100);
}
function getZoomInfo() {
  const level = (mainWindow && !mainWindow.isDestroyed())
    ? mainWindow.webContents.getZoomLevel()
    : getSavedZoomLevel();
  return { level, percent: zoomPercent(level) };
}

function applyZoom(delta) {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  let level = delta === 'reset' ? 0 : mainWindow.webContents.getZoomLevel() + delta;
  level = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, level)) * 2) / 2;
  mainWindow.webContents.setZoomLevel(level);
  saveZoomLevel(level);
  const info = { level, percent: zoomPercent(level) };
  if (!mainWindow.webContents.isDestroyed()) mainWindow.webContents.send('zoom-changed', info);
  return info;
}

function createWindow(targetUrl) {
  const startUrl = typeof targetUrl === 'string' && targetUrl ? targetUrl : currentServerUrl;
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Foxy',
    icon: path.join(__dirname, '../assets/img/foxy.png'),
    autoHideMenuBar: true,
    backgroundColor: '#02040b',
    webPreferences: {

      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.setMenu(null);
  mainWindow.webContents.setZoomLevel(getSavedZoomLevel());
  mainWindow.loadURL(startUrl);

  const mainBornAt = Date.now();
  let mainRecovered = false;
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    const reason = details && details.reason;
    console.error(`[Main] render-process-gone: ${reason}`);
    if (mainRecovered || noSandbox) return;
    if (reason !== 'crashed' && reason !== 'oom' && reason !== 'launch-failed') return;
    if (Date.now() - mainBornAt > 30000) return;
    mainRecovered = true;
    console.error('[Main] renderer died at startup — relaunching without renderer sandbox...');
    relaunchNoSandbox();
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      } else if (input.control && !input.alt && !input.meta) {

        const k = String(input.key || '').toLowerCase();
        if (k === '=' || k === '+' || k === 'equal' || k === 'add') {
          applyZoom(ZOOM_STEP);
          event.preventDefault();
        } else if (k === '-' || k === '_' || k === 'subtract') {
          applyZoom(-ZOOM_STEP);
          event.preventDefault();
        } else if (k === '0' || k === 'num0') {
          applyZoom('reset');
          event.preventDefault();
        }
      }
    }
  });

  mainWindow.webContents.on('context-menu', (event, params) => {
    const { MenuItem } = require('electron');
    const menu = new Menu();
    if (params.editFlags.canCopy && params.selectionText.trim().length > 0) {
      menu.append(new MenuItem({ role: 'copy', label: i18nMain.t('app_context_menu.copy') }));
    }
    if (params.editFlags.canPaste) menu.append(new MenuItem({ role: 'paste', label: i18nMain.t('app_context_menu.paste') }));
    if (params.editFlags.canCut) menu.append(new MenuItem({ role: 'cut', label: i18nMain.t('app_context_menu.cut') }));
    if (menu.items.length > 0) menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({ label: i18nMain.t('app_context_menu.reload'), role: 'reload' }));
    menu.append(new MenuItem({ label: i18nMain.t('app_context_menu.fullscreen'), role: 'togglefullscreen' }));
    menu.popup(mainWindow);
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isUrlAllowed(url)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isUrlAllowed(url) && !url.startsWith('file://')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    console.error(`[Wrapper] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
    mainWindow.loadURL(`http://localhost:${localPort}/electron/offline.html?sw=${softwareRendering ? '1' : '0'}`);
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting && configCloseToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { if (mainWindow === global.mainWindowRef) global.mainWindowRef = null; });

  return mainWindow;
}

let selectorWindowChosen = false;
let selectorRebuilding = false;
let selectorAttempts = 0;
const SELECTOR_MAX_ATTEMPTS = 3;

function createSelectorWindow() {
  selectorAttempts = 0;
  selectorRebuilding = false;
  buildSelectorWindow();
  return selectorWindow;
}

function buildSelectorWindow() {
  selectorAttempts++;
  selectorWindow = new BrowserWindow({
    width: 480,
    height: 600,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: i18nMain.t('electron.select_title'),
    icon: path.join(__dirname, '../assets/img/foxy.png'),
    autoHideMenuBar: true,
    backgroundColor: '#02040b',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  selectorWindow.setMenu(null);

  const selectorUrl = `http://localhost:${localPort}/electron/server-selector.html?sw=${softwareRendering ? '1' : '0'}`;
  console.log('[Selector] loading:', selectorUrl);

  selectorWindow.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    console.error(`[Selector] did-fail-load ${code} ${desc} ${url} main=${isMainFrame}`);
  });
  selectorWindow.webContents.on('render-process-gone', (_e, details) => {
    const reason = details && details.reason;
    console.error('[Selector] render-process-gone:', reason);

    if (reason !== 'crashed' && reason !== 'oom' && reason !== 'launch-failed') return;
    if (selectorWindowChosen) return;
    if (selectorAttempts >= SELECTOR_MAX_ATTEMPTS) {
      if (!noSandbox) {

        relaunchNoSandbox();
        return;
      }
      console.error('[Selector] renderers still dying even unsandboxed — showing fallback message');
      if (selectorWindow && !selectorWindow.isDestroyed()) {
        selectorWindow.loadURL('data:text/html,<meta charset="utf-8"><body style="background:#02040b;color:#e4f0ff;font-family:sans-serif;display:flex;height:100vh;margin:0;align-items:center;justify-content:center;text-align:center"><div><h2>" + i18nMain.t("tray.selector_fail_h") + "</h2><p>" + i18nMain.t("tray.selector_fail_p") + "</p></div></body>');
      }
      return;
    }
    console.log(`[Selector] rebuilding window (attempt ${selectorAttempts + 1}/${SELECTOR_MAX_ATTEMPTS})...`);
    selectorRebuilding = true;
    const dead = selectorWindow;
    selectorWindow = null;
    try { dead.destroy(); } catch (e) {}
    setTimeout(() => {
      selectorRebuilding = false;
      if (selectorWindowChosen) return;
      if (mainWindow && !mainWindow.isDestroyed()) return;
      buildSelectorWindow();
    }, 1500);
  });
  selectorWindow.once('ready-to-show', () => {
    if (selectorWindow && !selectorWindow.isDestroyed()) { selectorWindow.show(); selectorWindow.focus(); }
  });
  let selectorRetried = false;
  function loadSelectorPage() {
    if (!selectorWindow || selectorWindow.isDestroyed()) return;
    selectorWindow.loadURL(selectorUrl).catch((e) => {
      console.error('[Selector] loadURL failed:', e && e.message);
      if (!selectorRetried && selectorWindow && !selectorWindow.isDestroyed()) {
        selectorRetried = true;
        setTimeout(loadSelectorPage, 1500);
      }
    });
  }
  loadSelectorPage();

  selectorWindow.on('closed', () => {
    if (selectorWindowChosen || selectorRebuilding) return;
    selectorWindow = null;
    if (!mainWindow || mainWindow.isDestroyed()) {
      openMainWithServer(currentServerKey, { remember: false });
    }
  });

  return selectorWindow;
}

function openMainWithServer(serverKey, { remember = true } = {}) {
  const key = serverKey === 'beta' ? 'beta' : 'stable';
  currentServerKey = key;
  currentServerUrl = SERVERS[key].url;
  if (remember) saveServerConfig({ ...getServerConfig(), preferredServer: key });
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow(currentServerUrl);
  } else {
    mainWindow.loadURL(currentServerUrl);
  }
  rebuildTrayMenu();
  return { server: key, url: currentServerUrl };
}

function switchServerEnvironment({ server, showSelectorNextLaunch = false } = {}) {
  if (showSelectorNextLaunch) {

    const cfg = saveServerConfig({ ...getServerConfig(), dontShowServerSelector: false });
    rebuildTrayMenu();
    return { success: true, ...cfg, servers: SERVERS };
  }
  if (server !== 'stable' && server !== 'beta') {
    return { success: false, error: 'Invalid server. Use "stable" or "beta".' };
  }
  openMainWithServer(server, { remember: true });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('server-changed', { server, url: currentServerUrl });
  }
  return { success: true, server, url: currentServerUrl };
}

function createTray() {
  tray = new Tray(path.join(__dirname, '../assets/img/foxy.png'));
  tray.setToolTip(softwareRendering ? i18nMain.t('tray.tooltip_sw') : i18nMain.t('tray.tooltip'));
  rebuildTrayMenu();
  tray.on('click', () => toggleWindowVisibility());
}

function toggleWindowVisibility() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isVisible()) mainWindow.hide();
  else { mainWindow.show(); mainWindow.focus(); }
}

function rebuildTrayMenu() {
  if (!tray) return;
  const template = [
    { label: i18nMain.t('tray.show_hide'), click: () => toggleWindowVisibility() },
  ];

  if (trayState.inCall) {
    template.push({ type: 'separator' });
    template.push({
      label: i18nMain.t('app_context_menu.tray_mute'),
      type: 'checkbox',
      checked: trayState.isMuted,
      click: () => sendMuteToggle(),
    });
    template.push({
      label: i18nMain.t('app_context_menu.tray_deafen'),
      type: 'checkbox',
      checked: trayState.isDeafened,
      click: () => sendDeafenToggle(),
    });
    template.push({ type: 'separator' });
  } else {
    template.push({
      label: trayState.isMuted ? i18nMain.t('tray.mic_on') : i18nMain.t('tray.mic_off'),
      click: () => sendMuteToggle(),
    });
    template.push({ type: 'separator' });
  }

  template.push({
    label: i18nMain.t('app_context_menu.quit'),
    click: () => { isQuitting = true; app.quit(); },
  });

  template.push({ type: 'separator' });
  const serverCfg = getServerConfig();
  template.push({
    label: i18nMain.t('tray.server'),
    submenu: [
      {
        label: i18nMain.t('tray.stable', { host: SERVERS.stable.host }),
        type: 'radio',
        checked: currentServerKey === 'stable',
        click: () => switchServerEnvironment({ server: 'stable' }),
      },
      {
        label: i18nMain.t('tray.beta', { host: SERVERS.beta.host }),
        type: 'radio',
        checked: currentServerKey === 'beta',
        click: () => switchServerEnvironment({ server: 'beta' }),
      },
      { type: 'separator' },
      {
        label: i18nMain.t('tray.show_selector'),
        type: 'checkbox',
        checked: !serverCfg.dontShowServerSelector,
        click: (item) => {
          saveServerConfig({ ...serverCfg, dontShowServerSelector: !item.checked });
          rebuildTrayMenu();
        },
      },
    ],
  });

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function sendMuteToggle() {
  trayState.isMuted = !trayState.isMuted;
  rebuildTrayMenu();
  if (mainWindow && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('tray-action', 'toggle-mute');
    mainWindow.webContents.send('global-mute-toggle', { muted: trayState.isMuted });
  }
}

function sendDeafenToggle() {
  if (mainWindow && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('tray-action', 'toggle-deafen');
  }
}

const MUTE_HOTKEYS = [MUTE_HOTKEY, 'CommandOrControl+Alt+M'];
let registeredHotkey = null;
function registerGlobalHotkeys() {
  for (const hk of MUTE_HOTKEYS) {
    try {
      if (globalShortcut.register(hk, () => sendMuteToggle())) {
        registeredHotkey = hk;
        console.log(`[Wrapper] Global hotkey registered: ${hk}`);
        return;
      }
    } catch (e) {}
    console.warn(`[Wrapper] Hotkey busy or failed, trying fallback: ${hk}`);
  }
  console.error('[Wrapper] No global hotkey available — use the Tray menu or the website mute button');
}

function setupPermissions() {
  const ses = session.defaultSession;
  const ALLOWED = new Set(['media', 'microphone', 'audio-capture', 'camera', 'notifications', 'fullscreen']);
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media' || ALLOWED.has(permission)) callback(true);
    else { console.warn(`[Wrapper] Blocked permission request: ${permission}`); callback(false); }
  });
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'media' || ALLOWED.has(permission));
  ses.setDevicePermissionHandler(() => true);
}

function registerIpcHandlers() {

  ipcMain.on('google-login-external', () => {
    shell.openExternal(`http://localhost:${localPort}/electron/externallogin.html?autostart=1`);
  });

  ipcMain.handle('open-external-url', async (_event, rawUrl) => {
    try {
      const parsed = new URL(String(rawUrl || ''));
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Unsupported external protocol');
      await shell.openExternal(parsed.toString());
      return true;
    } catch (error) { logError(error); return false; }
  });

  ipcMain.on('toggle-hw-accel', (event, disable) => {
    if (typeof disable !== 'boolean') return;
    fs.writeFileSync(hwConfigPath, JSON.stringify({ disableGPU: disable }));
  });
  ipcMain.on('toggle-close-to-tray', (event, enabled) => { configCloseToTray = !!enabled; });
  ipcMain.on('toggle-run-on-startup', (event, enabled) => {
    app.setLoginItemSettings({ openAtLogin: !!enabled, path: app.getPath('exe') });
  });

  ipcMain.handle('get-screen-sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
    return sources.map((s) => ({ id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL() }));
  });

  ipcMain.on('update-tray-state', (event, state) => {
    if (state && typeof state === 'object') {
      trayState = {
        inCall: !!state.inCall,
        isMuted: !!state.isMuted,
        isDeafened: !!state.isDeafened,
      };
      rebuildTrayMenu();
    }
  });

  ipcMain.on('mute-state-changed', (_event, state) => {
    if (state && typeof state.muted === 'boolean') {
      trayState.isMuted = state.muted;
      rebuildTrayMenu();
    }
  });

  ipcMain.handle('zoom-in', async () => applyZoom(ZOOM_STEP));
  ipcMain.handle('zoom-out', async () => applyZoom(-ZOOM_STEP));
  ipcMain.handle('zoom-reset', async () => applyZoom('reset'));
  ipcMain.handle('get-zoom', async () => getZoomInfo());

  ipcMain.on('show-notification', (_event, { title, body } = {}) => {
    if (Notification.isSupported()) {
      new Notification({ title: String(title || 'Foxy'), body: String(body || '') }).show();
    }
  });

  ipcMain.handle('retry-connection', async () => {
    try {
      if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createWindow(currentServerUrl);
      else await mainWindow.loadURL(currentServerUrl);
      return true;
    } catch { return false; }
  });

  ipcMain.handle('get-server-config', async () => ({
    servers: SERVERS,
    current: currentServerKey,
    currentUrl: currentServerUrl,
    hotkey: registeredHotkey,
    softwareRendering,
    sandboxDisabled: noSandbox,
    ...getServerConfig(),
  }));

  ipcMain.handle('switch-server-environment', async (_event, options) => {
    if (!options || typeof options !== 'object') return { success: false, error: 'Invalid options' };
    const opts = {};
    if (typeof options.server === 'string') opts.server = options.server;
    if (options.showSelectorNextLaunch === true) opts.showSelectorNextLaunch = true;
    return switchServerEnvironment(opts);
  });

  ipcMain.handle('server-choice', async (_event, choice) => {
    if (!choice || (choice.server !== 'stable' && choice.server !== 'beta')) {
      return { success: false, error: 'Invalid server choice' };
    }
    saveServerConfig({
      preferredServer: choice.server,
      dontShowServerSelector: choice.dontShow === true,
    });
    currentServerKey = choice.server;
    currentServerUrl = SERVERS[choice.server].url;
    selectorWindowChosen = true;
    if (selectorWindow && !selectorWindow.isDestroyed()) selectorWindow.close();
    selectorWindow = null;
    mainWindow = createWindow(currentServerUrl);
    rebuildTrayMenu();
    return { success: true, server: currentServerKey, url: currentServerUrl };
  });

  ipcMain.handle('get-firebase-config', async () => {
    const configPath = path.join(app.getPath('userData'), 'firebase-config.json');
    if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (process.env.FIREBASE_API_KEY) {
      return {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID,
      };
    }
    throw new Error('Firebase config not found. Create firebase-config.json in userData or set env vars.');
  });

  ipcMain.handle('check-for-updates', async () => checkForUpdates());
  ipcMain.handle('check-update-from-config', async (event, { latestVersion, downloadURL, force }) => {
    if (!latestVersion || typeof latestVersion !== 'string') return null;
    if (downloadURL && typeof downloadURL !== 'string') return null;
    const sanitizedVersion = latestVersion.replace(/[^a-zA-Z0-9.\-v]/g, '');
    if (sanitizedVersion !== latestVersion) return null;
    const cleanLatest = sanitizedVersion.replace('v', '');
    const cleanCurrent = CURRENT_VERSION.replace('v', '');
    if (force === true) {
      logUpdater(`Config update (forced by updateSource): ${sanitizedVersion}`);
      return { version: `v${cleanLatest}`, asarUrl: downloadURL || '', isDownloaded: false };
    }
    const latestParts = cleanLatest.split('.').map(Number);
    const currentParts = cleanCurrent.split('.').map(Number);
    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const l = latestParts[i] || 0;
      const c = currentParts[i] || 0;
      if (l > c) {
        logUpdater(`Config update available: ${sanitizedVersion} (current: ${CURRENT_VERSION})`);
        return { version: `v${cleanLatest}`, asarUrl: downloadURL || '', isDownloaded: false };
      }
      if (l < c) break;
    }
    logUpdater(`Config check: version ${sanitizedVersion} is not newer than ${CURRENT_VERSION}`);
    return null;
  });
  ipcMain.handle('get-app-version', () => CURRENT_VERSION);
  ipcMain.handle('start-update-download', async (event, { version, url }) => {
    if (!version || typeof version !== 'string') return { success: false, error: 'Invalid version' };
    if (!url || typeof url !== 'string') return { success: false, error: 'Invalid URL' };
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) return { success: false, error: 'Invalid URL protocol' };
      if (!parsedUrl.hostname.includes('github.com') && !parsedUrl.hostname.includes('githubusercontent.com')) {
        return { success: false, error: 'Untrusted download domain' };
      }
    } catch { return { success: false, error: 'Invalid URL format' }; }
    const sanitizedVersion = version.replace(/[^a-zA-Z0-9.\-v]/g, '');
    if (sanitizedVersion !== version) return { success: false, error: 'Invalid version format' };
    try { await downloadUpdate(sanitizedVersion, url); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.on('restart-app', () => {
    logUpdater('User requested restart. Preparing swap script...');
    if (app.isPackaged && process.platform === 'win32') {
      const appPath = app.getAppPath();
      const resourcesPath = path.dirname(appPath);
      const executablePath = process.execPath;
      const coreFile = path.join(resourcesPath, 'app.asar');
      const backupFile = path.join(resourcesPath, 'app.asar.old');
      const updateFileBase = fs.readdirSync(resourcesPath).find((f) => f.startsWith('update-v') && f.endsWith('.asar'));
      if (updateFileBase) {
        const updateFile = path.join(resourcesPath, updateFileBase);
        const winExecutable = executablePath.replace(/\//g, '\\');
        const winCore = coreFile.replace(/\//g, '\\');
        const winUpdate = updateFile.replace(/\//g, '\\');
        const winBackup = backupFile.replace(/\//g, '\\');
        const ps1File = path.join(os.tmpdir(), 'voicehub_update.ps1');
        const processName = path.basename(winExecutable, '.exe');
        logUpdater(`Found update: ${updateFileBase}. Launching swap script...`);
        const psScript = `
$ErrorActionPreference = 'Continue'
Write-Host "--- Foxy Update Script ---" -ForegroundColor Cyan
Write-Host "Step 1: Closing application..."
Stop-Process -Name "${processName}" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "Step 2: Swapping files..."
try {
    if (Test-Path -LiteralPath "${winBackup}") { Remove-Item -LiteralPath "${winBackup}" -Force }
    Move-Item -LiteralPath "${winCore}" -Destination "${winBackup}" -Force
    Move-Item -LiteralPath "${winUpdate}" -Destination "${winCore}" -Force
    Write-Host "SUCCESS: Update applied!" -ForegroundColor Green
    Write-Host "Step 3: Restarting..."
    Start-Process -FilePath "${winExecutable}"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to close..."
}
`;
        const bom = Buffer.from('﻿', 'utf8');
        fs.writeFileSync(ps1File, Buffer.concat([bom, Buffer.from(psScript, 'utf8')]));
        const batchFile = path.join(os.tmpdir(), 'voicehub_launcher.bat');
        fs.writeFileSync(batchFile, Buffer.concat([bom, Buffer.from(
          `@echo off\npowershell -NoProfile -ExecutionPolicy Bypass -File "${ps1File}"\ndel "${ps1File}"\ndel "%~f0"\n`, 'utf8')]));
        spawn('cmd.exe', ['/c', batchFile], { detached: true, stdio: 'ignore' }).unref();
        app.quit();
        return;
      }
    }
    logUpdater('Normal restart (no update found or not packaged).');
    app.relaunch();
    app.quit();
  });

  registerOverlayIpc();
  registerGameLibraryIpc();
}

const GAME_LIBRARY_PATH = path.join(app.getPath('userData'), 'game-library.json');
let gameLibrary = [];
let gameDetectionInterval = null;
let overlayVisibleForGame = false;
let isInVoiceForOverlay = false;
let detectionInProgress = false;
let currentParentHwnd = 0;
let keepClickThrough = null;

function overlayExec(js) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    try { overlayWindow.webContents.executeJavaScript(js).catch(() => {}); } catch (e) {}
  }
}

function setDefaultOverlayBounds() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const { screen } = require('electron');
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  overlayWindow.setBounds({ x: 0, y: sh - 420, width: 260, height: 400 });
}

function registerOverlayIpc() {
  ipcMain.on('voice-overlay-show', () => {
    isInVoiceForOverlay = true;
    overlayVisibleForGame = false;
    ensureOverlayWindow();
    const enabledGames = gameLibrary.filter((g) => g.enabled);
    if (enabledGames.length === 0) {
      if (!overlayWindow || overlayWindow.isDestroyed()) return;
      setDefaultOverlayBounds();
      overlayWindow.showInactive();
      overlayWindow.setIgnoreMouseEvents(false);
      overlayExec('__overlayControl.show()');
    } else { checkGameDetection(); startGameDetection(); }
  });
  ipcMain.on('voice-overlay-hide', () => {
    isInVoiceForOverlay = false;
    overlayVisibleForGame = false;
    stopGameDetection();
    overlayExec('__overlayControl.hide()');
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
  });
  ipcMain.on('voice-overlay-position', (event, pos) => {
    overlayExec('__overlayControl.setPosition("' + String(pos || '').replace(/[^a-z-]/g, '') + '")');
  });
  ipcMain.on('voice-overlay-members', (event, members) => {
    overlayExec('__overlayControl.updateMembers(' + JSON.stringify(members) + ')');
  });
  ipcMain.on('voice-overlay-speaking', (event, speakingIds) => {
    overlayExec('__overlayControl.updateSpeaking(' + JSON.stringify(speakingIds || []) + ')');
  });
  ipcMain.on('voice-overlay-hover', (event, hovered) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setIgnoreMouseEvents(!hovered, { forward: true });
    }
  });
}

function loadGameLibrary() {
  try {
    if (fs.existsSync(GAME_LIBRARY_PATH)) gameLibrary = JSON.parse(fs.readFileSync(GAME_LIBRARY_PATH, 'utf8'));
  } catch (e) {}
  if (!Array.isArray(gameLibrary)) gameLibrary = [];
}
function saveGameLibrary() {
  try { fs.writeFileSync(GAME_LIBRARY_PATH, JSON.stringify(gameLibrary, null, 2)); }
  catch (e) { console.error('[GameLib] Save failed', e); }
}
function notifyGameLibraryChanged() {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send('game-library-changed', JSON.parse(JSON.stringify(gameLibrary)));
  });
}
function getActiveWindowInfo() {
  return new Promise((resolve) => {
    const psScript = [
      'Add-Type -TypeDefinition @\'',
      'using System; using System.Runtime.InteropServices; using System.Diagnostics;',
      'public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }',
      'public class WinInfo {',
      '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
      '  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);',
      '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out int pid);',
      '  public static string Get() {',
      '    IntPtr h = GetForegroundWindow();',
      '    if (h == IntPtr.Zero) return null;',
      '    int pid = 0; GetWindowThreadProcessId(h, out pid);',
      '    RECT r; GetWindowRect(h, out r);',
      '    try {',
      '      Process p = Process.GetProcessById(pid);',
      '      return h.ToInt64().ToString() + "|" + p.ProcessName + ".exe|" + r.Left + "|" + r.Top + "|" + (r.Right - r.Left) + "|" + (r.Bottom - r.Top);',
      '    } catch { return null; }',
      '  }',
      '}',
      '\'@',
      '[WinInfo]::Get()',
    ].join('\n');
    require('child_process').execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScript],
      { timeout: 3000 }, (err, stdout) => {
        if (err) return resolve(null);
        const parts = stdout.trim().split('|');
        if (parts.length < 6) return resolve(null);
        resolve({
          hwnd: parseInt(parts[0], 10),
          name: parts[1],
          bounds: {
            x: parseInt(parts[2], 10) || 0,
            y: parseInt(parts[3], 10) || 0,
            w: parseInt(parts[4], 10) || 800,
            h: parseInt(parts[5], 10) || 600,
          },
        });
      });
  });
}

function setOverlayParent(gameHwnd) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  try {
    const hwndBuf = overlayWindow.getNativeWindowHandle();
    if (!hwndBuf || hwndBuf.length === 0) return;
    let overlayHwndHex = hwndBuf.toString('hex');
    while (overlayHwndHex.length < 16) overlayHwndHex = '0' + overlayHwndHex;
    const gameHwndNum = Number(gameHwnd);
    if (!Number.isInteger(gameHwndNum) || gameHwndNum <= 0) return;
    const gameHwndHex = gameHwndNum.toString(16).padStart(16, '0');
    const psScript = `
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class WinParent {
  [DllImport("user32.dll")] public static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);
  public static void Set(string childHex, string parentHex) {
    IntPtr child = new IntPtr(long.Parse(childHex, System.Globalization.NumberStyles.HexNumber));
    IntPtr parent = new IntPtr(long.Parse(parentHex, System.Globalization.NumberStyles.HexNumber));
    SetParent(child, parent);
  }
}
'@
[WinParent]::Set($args[0], $args[1])
`.trim();
    require('child_process').execFile('powershell',
      ['-NoProfile', '-NonInteractive', '-Command', psScript, overlayHwndHex, gameHwndHex],
      { timeout: 3000, windowsHide: true }, () => {});
  } catch (e) {}
  currentParentHwnd = gameHwnd;
}

function showOverlayForGame(info) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  if (overlayVisibleForGame) {
    if (info && info.bounds) {
      overlayWindow.setBounds({ x: info.bounds.x, y: info.bounds.y, width: info.bounds.w, height: info.bounds.h });
    }
    return;
  }
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  if (info && info.hwnd) {
    setOverlayParent(info.hwnd);
    overlayWindow.setBounds({ x: 0, y: 0, width: info.bounds.w, height: info.bounds.h });
  } else if (info && info.bounds) {
    overlayWindow.setBounds({ x: info.bounds.x, y: info.bounds.y, width: info.bounds.w, height: info.bounds.h });
  }
  overlayWindow.showInactive();
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayExec('__overlayControl.show()');
  overlayVisibleForGame = true;
}

function hideOverlayForGame() {
  if (!overlayVisibleForGame) return;
  overlayVisibleForGame = false;
  overlayExec('__overlayControl.hide()');
  if (currentParentHwnd !== 0 && overlayWindow && !overlayWindow.isDestroyed()) {
    setOverlayParent(0);
    currentParentHwnd = 0;
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
}

function checkGameDetection() {
  if (!isInVoiceForOverlay || detectionInProgress) return;
  detectionInProgress = true;
  const enabledExes = gameLibrary.filter((g) => g.enabled);
  if (enabledExes.length > 0 && !overlayVisibleForGame) {
    if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
      overlayExec('__overlayControl.hide()');
      overlayWindow.hide();
    }
  }
  if (enabledExes.length === 0) {
    if (overlayVisibleForGame) hideOverlayForGame();
    detectionInProgress = false;
    return;
  }
  getActiveWindowInfo().then((info) => {
    detectionInProgress = false;
    if (!info || !info.name) return;
    const lower = info.name.toLowerCase().replace('.exe', '');
    const matched = enabledExes.some((g) => lower === g.exe.toLowerCase().replace('.exe', ''));
    if (matched) {
      if (overlayVisibleForGame) {
        if (info.bounds && overlayWindow && !overlayWindow.isDestroyed()) {
          const cur = overlayWindow.getBounds();
          if (cur.width !== info.bounds.w || cur.height !== info.bounds.h) {
            overlayWindow.setBounds({
              x: currentParentHwnd !== 0 ? 0 : info.bounds.x,
              y: currentParentHwnd !== 0 ? 0 : info.bounds.y,
              width: info.bounds.w, height: info.bounds.h,
            });
          }
        }
      } else showOverlayForGame(info);
    } else if (overlayVisibleForGame) hideOverlayForGame();
  }).catch(() => { detectionInProgress = false; });
}

function startGameDetection() {
  if (gameDetectionInterval) return;
  gameDetectionInterval = setInterval(() => checkGameDetection(), 800);
}
function stopGameDetection() {
  if (gameDetectionInterval) { clearInterval(gameDetectionInterval); gameDetectionInterval = null; }
}

function registerGameLibraryIpc() {
  loadGameLibrary();
  ipcMain.handle('browse-game-exe', async () => {
    const result = await require('electron').dialog.showOpenDialog({
      title: 'Select Game Executable',
      filters: [{ name: 'Games', extensions: ['exe'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) return null;
    const cleanExe = result.filePaths[0].split('\\').pop().split('/').pop().trim();
    if (!/^[a-zA-Z0-9._-]+\.exe$/i.test(cleanExe)) return { exe: null, error: 'Invalid executable name' };
    const dup = gameLibrary.some((g) => g.exe.toLowerCase() === cleanExe.toLowerCase());
    if (dup) return { exe: null, duplicate: true, message: 'Game "' + cleanExe + '" is already in your library.' };
    gameLibrary.push({ exe: cleanExe, enabled: true });
    saveGameLibrary();
    notifyGameLibraryChanged();
    if (isInVoiceForOverlay) { checkGameDetection(); startGameDetection(); }
    return { exe: cleanExe, duplicate: false };
  });
  ipcMain.handle('game-library-add', (event, exeName) => {
    if (!exeName || typeof exeName !== 'string') return { success: false, reason: 'invalid' };
    let clean = exeName.trim();
    if (!clean) return { success: false, reason: 'empty' };
    if (clean.toLowerCase().indexOf('.exe') === -1) clean += '.exe';
    if (!/^[a-zA-Z0-9._-]+\.exe$/i.test(clean)) return { success: false, reason: 'invalid_name' };
    const dup = gameLibrary.some((g) => g.exe.toLowerCase() === clean.toLowerCase());
    if (dup) return { success: false, reason: 'duplicate', exe: clean };
    gameLibrary.push({ exe: clean, enabled: true });
    saveGameLibrary();
    notifyGameLibraryChanged();
    if (isInVoiceForOverlay) { checkGameDetection(); startGameDetection(); }
    return { success: true, exe: clean };
  });
  ipcMain.on('game-library-remove', (event, exeName) => {
    if (!exeName || typeof exeName !== 'string') return;
    if (!/^[a-zA-Z0-9._-]+\.exe$/i.test(exeName)) return;
    gameLibrary = gameLibrary.filter((g) => g.exe.toLowerCase() !== exeName.toLowerCase());
    saveGameLibrary();
    notifyGameLibraryChanged();
    if (isInVoiceForOverlay && gameLibrary.filter((g) => g.enabled).length > 0) checkGameDetection();
  });
  ipcMain.on('game-library-toggle', (event, exeName, enabled) => {
    if (!exeName || typeof exeName !== 'string') return;
    if (!/^[a-zA-Z0-9._-]+\.exe$/i.test(exeName)) return;
    for (let i = 0; i < gameLibrary.length; i++) {
      if (gameLibrary[i].exe.toLowerCase() === exeName.toLowerCase()) { gameLibrary[i].enabled = !!enabled; break; }
    }
    saveGameLibrary();
    notifyGameLibraryChanged();
    if (isInVoiceForOverlay) checkGameDetection();
  });
  ipcMain.handle('game-library-get', () => JSON.parse(JSON.stringify(gameLibrary)));
  ipcMain.handle('game-library-is-active', async () => {
    const info = await getActiveWindowInfo();
    if (!info || !info.name) return false;
    const lower = info.name.toLowerCase().replace('.exe', '');
    return gameLibrary.some((g) => g.enabled && lower === g.exe.toLowerCase().replace('.exe', ''));
  });
}

function ensureOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow;
  overlayWindow = new BrowserWindow({
    width: 100, height: 100,
    transparent: true, frame: false, resizable: true,
    alwaysOnTop: true, skipTaskbar: true, show: false, focusable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  overlayWindow.setMenu(null);
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  const overlayPage = `http://localhost:${localPort}/electron/overlay.html`;

  let overlayRetried = false;
  function loadOverlayPage() {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    overlayWindow.loadURL(overlayPage).catch(() => {
      if (!overlayRetried && overlayWindow && !overlayWindow.isDestroyed()) {
        overlayRetried = true;
        console.warn('[Overlay] load failed, retrying once...');
        setTimeout(() => {
          if (!overlayWindow || overlayWindow.isDestroyed()) return;
          overlayWindow.loadURL(overlayPage).catch(() => {
            console.warn('[Overlay] disabled for this session');
            try { overlayWindow.destroy(); } catch (e) {}
            overlayWindow = null;
          });
        }, 2000);
      }
    });
  }
  loadOverlayPage();
  overlayWindow.on('closed', () => { overlayWindow = null; });

  keepClickThrough = setInterval(() => {
    if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible() && overlayVisibleForGame) {
      overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    }
  }, 500);
  return overlayWindow;
}

function cleanup() {
  if (server && server.listening) server.close();
  if (gameDetectionInterval) { clearInterval(gameDetectionInterval); gameDetectionInterval = null; }
  if (keepClickThrough) { clearInterval(keepClickThrough); keepClickThrough = null; }
  if (overlayWindow && !overlayWindow.isDestroyed()) { overlayWindow.destroy(); overlayWindow = null; }
  if (selectorWindow && !selectorWindow.isDestroyed()) { selectorWindow.destroy(); selectorWindow = null; }
  if (tray) { tray.destroy(); tray = null; }
}

const isRelaunchChild = process.argv.includes('--foxy-software-rendering') || process.argv.includes('--foxy-no-sandbox');
function startApp() {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {

    if (!softwareRendering && gpuLooksBroken()) {
      relaunchWithSoftwareRendering('GPU features unavailable (software-only/blocklisted)');
      return;
    }
    i18nMain.init(app.getPath('userData'));
    setupPermissions();
    registerIpcHandlers();
    ipcMain.on('foxy-set-language', (_e, lang) => {
      i18nMain.set(String(lang || 'ar'));
      try { rebuildTrayMenu(); } catch (e) {}
    });
    ipcMain.handle('foxy-get-language', () => i18nMain.current());
    await startInternalServer(preferredPort);
    await waitForServer(localPort);

    createTray();
    registerGlobalHotkeys();
    console.log('[Main] App Data Path:', app.getPath('userData'));

    const cfg = getServerConfig();
    currentServerKey = cfg.preferredServer;
    currentServerUrl = SERVERS[currentServerKey].url;
    if (cfg.dontShowServerSelector) {
      mainWindow = createWindow(currentServerUrl);
    } else {
      createSelectorWindow();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow(currentServerUrl);
      else if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
    });
  }).catch((e) => {
    try { fs.writeFileSync('electron-error.log', 'Ready Error: ' + e.toString()); } catch (_) {}
  });

  app.on('before-quit', () => { isQuitting = true; cleanup(); });
  app.on('window-all-closed', () => {

    if (selectorRebuilding) return;
    cleanup();
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();

    if (!keepGpuMarker) {
      try { if (fs.existsSync(gpuMarkerPath)) fs.unlinkSync(gpuMarkerPath); } catch (e) {}
    }
    if (tray) { tray.destroy(); tray = null; }
  });
}

const gotLock = app.requestSingleInstanceLock();
if (gotLock) {
  startApp();
} else if (isRelaunchChild) {
  console.log('[Electron] Waiting for previous instance to exit (relaunch)...');
  let lockTries = 20;
  const waitForLock = () => {
    if (app.requestSingleInstanceLock()) startApp();
    else if (lockTries-- > 0) setTimeout(waitForLock, 500);
    else app.quit();
  };
  waitForLock();
} else {
  app.quit();
}
