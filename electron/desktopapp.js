const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { app, BrowserWindow, ipcMain, Tray, Menu, desktopCapturer, shell } = require('electron');
const os = require('os');
const i18nMain = require('./i18n-main');
const { spawn } = require('child_process');

function logUpdater(msg) {
    try {
        const logPath = path.join(app.getPath('userData'), 'updater.log');
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
    } catch(e) {}
}

function logError(error) {
    try {
        const errorLogPath = path.join(app.getPath('userData'), 'error.log');
        const message = `[${new Date().toISOString()}] ${error.stack || error}\n`;
        fs.appendFileSync(errorLogPath, message);
    } catch (e) {
        console.error('Failed to write to error log', e);
    }
}

process.on('uncaughtException', (error) => {
    logError(error);
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logError(reason);
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

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
            measurementId: process.env.FIREBASE_MEASUREMENT_ID
        };
    }

    return { ...FALLBACK_FIREBASE_CONFIG };
}

const FALLBACK_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDwddv_-qEU0_5ZLTZTWCgox7VVvtxZx68",
    authDomain: "discord-94524.firebaseapp.com",
    databaseURL: "https://discord-94524-default-rtdb.firebaseio.com",
    projectId: "discord-94524",
    storageBucket: "discord-94524.firebasestorage.app",
    messagingSenderId: "25789751728",
    appId: "1:25789751728:web:60d7e38a4b8fc4f1b77675",
    measurementId: "G-J4YB8VD70Z"
};

const PUBLIC_LOCAL_PAGES = new Set(['/electron/externallogin.html']);
let localPort = 0;
const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://localhost:0`);
    const pathname = parsedUrl.pathname;

    if (pathname === '/auth-completed') {
        const idToken = parsedUrl.searchParams.get('idToken');
        const accessToken = parsedUrl.searchParams.get('accessToken');
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            windows[0].webContents.send('external-auth-success', { idToken, accessToken });
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <div style="background:#1e1e1e; color:white; height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:sans-serif; text-align:center;">
                <h1 style="color:#4CAF50;">${i18nMain.t("login_page.electron_login_success")}</h1>
                <p>${i18nMain.t("login_page.electron_login_close")}</p>
                <script>setTimeout(() => window.close(), 2000);</script>
            </div>
        `);
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

    let urlPath = req.url === '/' ? '/web.html' : pathname;

    const normalizedPath = path.normalize(urlPath).replace(/\\/g, '/');
    if (normalizedPath !== urlPath) {
        res.writeHead(403);
        res.end("Forbidden: Path traversal attempt detected");
        return;
    }

    const sensitivePaths = ['/firebase-config.json', '/.env', '/node_modules/', '/electron/', '/assets/js/firebase-config.js'];
    if (!PUBLIC_LOCAL_PAGES.has(normalizedPath) && sensitivePaths.some(p => normalizedPath.startsWith(p))) {
        res.writeHead(403);
        res.end("Forbidden: Access denied");
        return;
    }
    const filePath = path.join(__dirname, '..', normalizedPath);

    const allowedRoot = path.resolve(__dirname, '..');
    const resolvedFilePath = path.resolve(filePath);
    if (!resolvedFilePath.startsWith(allowedRoot)) {
        res.writeHead(403);
        res.end("Forbidden: Access denied");
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end("Not Found");
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
            '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
            '.svg': 'image/svg+xml', '.json': 'application/json',
            '.wav': 'audio/wav', '.mp3': 'audio/mpeg'
        };
        
        res.writeHead(200, { 
            'Content-Type': mimeTypes[ext] || 'text/plain',
            'Access-Control-Allow-Origin': '*' 
        });
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
} catch (e) {
    console.error('[Server] Failed to read port config', e);
}

function startInternalServer(port) {
    return new Promise((resolve, reject) => {
        server.listen(port, '127.0.0.1', () => {
            localPort = server.address().port;
            console.log(`[Server] Internal server running at http://localhost:${localPort}`);
            
            try {
                fs.writeFileSync(portConfigPath, JSON.stringify({ port: localPort }));
            } catch (e) {
                console.error('[Server] Failed to save port config', e);
            }
            resolve(localPort);
        });

        server.once('error', (e) => {
            if (e.code === 'EADDRINUSE') {
                console.warn(`[Server] Port ${port} is in use, trying a random port...`);
                startInternalServer(0).then(resolve).catch(reject);
            } else {
                reject(e);
            }
        });
    });
}

function waitForServer(port, maxAttempts = 20, intervalMs = 250) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        function check() {
            attempts++;
            const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
                res.resume();
                console.log(`[Server] Ready after ${attempts} attempt(s).`);
                resolve();
            });
            req.on('error', () => {
                if (attempts >= maxAttempts) {
                    reject(new Error(`[Server] Not ready after ${maxAttempts} attempts.`));
                } else {
                    setTimeout(check, intervalMs);
                }
            });
            req.end();
        }
        check();
    });
}

const CURRENT_VERSION = '1.0.0';
const GITHUB_REPO = 'dswdwsds/dis';

function logUpdater(msg) {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${msg}\n`;
    try {

        const logDir = app.isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '..');
        fs.appendFileSync(path.join(logDir, 'updater.log'), logMsg);
    } catch (e) {
        console.error("Log failed", e);
    }
}

async function checkForUpdates() {
    return new Promise((resolve) => {
        logUpdater(`Checking for updates... Current version: ${CURRENT_VERSION}`);
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_REPO}/releases/latest`,
            headers: { 'User-Agent': 'Electron-Updater-Foxy' }
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        logUpdater(`GitHub API Error (${res.statusCode})`);
                        return resolve(null);
                    }
                    const release = JSON.parse(data);
                    const asarAsset = release.assets?.find(asset => asset.name === 'app.asar');
                    
                    const cleanLatest = release.tag_name.replace('v', '');
                    const cleanCurrent = CURRENT_VERSION.replace('v', '');

                    if (asarAsset && cleanLatest !== cleanCurrent) {

                        const resourcesPath = app.isPackaged ? path.dirname(app.getAppPath()) : app.getAppPath();
                        const cachedPath = path.join(resourcesPath, `update-${release.tag_name}.asar`);
                        const isDownloaded = fs.existsSync(cachedPath);

                        logUpdater(`Update available: ${release.tag_name} (Cached: ${isDownloaded})`);
                        resolve({
                            version: release.tag_name,
                            asarUrl: asarAsset.browser_download_url,
                            isDownloaded: isDownloaded
                        });
                    } else {
                        logUpdater(`No update needed.`);
                        resolve(null);
                    }
                } catch (e) { 
                    logUpdater(`Parse error: ${e.message}`);
                    resolve(null); 
                }
            });
        }).on('error', (err) => {
            logUpdater(`Request error: ${err.message}`);
            resolve(null);
        });
    });
}

async function downloadUpdate(version, fileUrl) {
    const resourcesPath = app.isPackaged ? path.dirname(app.getAppPath()) : app.getAppPath();
    const updateFinalPath = path.join(resourcesPath, `update-${version}.asar`);
    const updateTempPath = updateFinalPath + '.tmp';

    logUpdater(`Starting download for ${version}. Destination: ${updateFinalPath}`);

    const originalNoAsar = process.noAsar;
    process.noAsar = true;

    const downloadFile = (url, destPath) => {
        return new Promise((resolve, reject) => {
            https.get(url, { headers: { 'User-Agent': 'Electron-Updater-Foxy' } }, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
                }
                if (response.statusCode !== 200) {
                    return reject(new Error(`Server error: ${response.statusCode}`));
                }

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
                dest.on('error', (err) => { 
                    dest.close(); 
                    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
                    reject(err); 
                });
            }).on('error', reject);
        });
    };

    try {
        await downloadFile(fileUrl, updateTempPath);
        if (fs.existsSync(updateFinalPath)) fs.unlinkSync(updateFinalPath);
        fs.renameSync(updateTempPath, updateFinalPath);
        
        const files = fs.readdirSync(resourcesPath);
        files.forEach(f => {
            if (f.startsWith('update-v') && f !== `update-${version}.asar`) {
                try { fs.unlinkSync(path.join(resourcesPath, f)); } catch(e){}
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
    
    const updateFileBase = files.find(f => f.startsWith('update-v') && f.endsWith('.asar'));
    if (!updateFileBase) return;

    const updateFile = path.join(resourcesPath, updateFileBase);
    const coreFile = path.join(resourcesPath, 'app.asar');
    const backupFile = path.join(resourcesPath, 'app.asar.old');

    logUpdater(`Found update file: ${updateFileBase}. Applying offline...`);
    try {
        if (fs.existsSync(backupFile)) fs.unlinkSync(backupFile);
        fs.renameSync(coreFile, backupFile);
        fs.renameSync(updateFile, coreFile);
        logUpdater(`Offline update applied successfully!`);
    } catch (e) {
        logUpdater(`Offline update failed: ${e.message}`);
    }
}

app.setName('Foxy');

app.commandLine.appendSwitch('disable-quic');

app.commandLine.appendSwitch('disable-features', 'ComputePressure');

if (process.platform === 'win32') {
    app.setAppUserModelId('Foxy');
}

ipcMain.on('google-login-external', () => {
    const { shell } = require('electron');
    shell.openExternal(`http://localhost:${localPort}/electron/externallogin.html?autostart=1`);
});

ipcMain.handle('open-external-url', async (_event, rawUrl) => {
    try {
        const parsed = new URL(String(rawUrl || ''));
        const allowed = parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'steam:' || parsed.protocol === 'steams:';
        if (!allowed) throw new Error('Unsupported external protocol');
        await shell.openExternal(parsed.toString());
        return true;
    } catch (error) {
        logError(error);
        return false;
    }
});

try {
    os.setPriority(process.pid, os.constants.priority.PRIORITY_HIGH);
    console.log('[Electron] Process priority set to HIGH');
} catch (e) {
    console.error('[Electron] Failed to set process priority', e);
}

const configPath = path.join(app.getPath('userData'), 'hw-accel-config.json');
let disableGPU = false;
try {
    if (fs.existsSync(configPath)) {
        const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        if (typeof savedConfig.disableGPU === 'boolean') {
            disableGPU = savedConfig.disableGPU;
        }
    } else {

        try {
            const userData = app.getPath('userData');
            if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true });
            fs.writeFileSync(configPath, JSON.stringify({ disableGPU: false }));
        } catch (e) { console.error('Failed to create config', e); }
    }
} catch (e) {
    console.error('Failed to read config', e);
}

if (disableGPU) {
    app.disableHardwareAcceleration();
    console.log('[Electron] Hardware acceleration DISABLED (GPU process fix)');
} else {
    console.log('[Electron] Hardware acceleration ENABLED');
}

let tray = null;
let overlayWindow = null;
let isQuitting = false;
let configCloseToTray = true;
let overlayIgnoreMouse = true;

const GAME_LIBRARY_PATH = path.join(app.getPath('userData'), 'game-library.json');
let gameLibrary = [];
let gameDetectionInterval = null;
let overlayVisibleForGame = false;
let isInVoiceForOverlay = false;

try {
  function createWindow () {
    const mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      title: 'Foxy',
      icon: path.join(__dirname, '../assets/img/foxy.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    mainWindow.setMenu(null);

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown') {
            if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
                mainWindow.webContents.toggleDevTools();
                event.preventDefault();
            }
        }
    });

    mainWindow.webContents.on('context-menu', (event, params) => {
        const { MenuItem } = require('electron');
        const menu = new Menu();

        if (params.editFlags.canCopy && params.selectionText.trim().length > 0) {
            menu.append(new MenuItem({ role: 'copy', label: i18nMain.t('app_context_menu.copy') }));
        }
        if (params.editFlags.canPaste) {
            menu.append(new MenuItem({ role: 'paste', label: i18nMain.t('app_context_menu.paste') }));
        }
        if (params.editFlags.canCut) {
            menu.append(new MenuItem({ role: 'cut', label: i18nMain.t('app_context_menu.cut') }));
        }

        if (menu.items.length > 0) {
            menu.append(new MenuItem({ type: 'separator' }));
        }

        menu.append(new MenuItem({ label: i18nMain.t('app_context_menu.reload'), role: 'reload' }));
        menu.append(new MenuItem({ label: i18nMain.t('app_context_menu.fullscreen'), role: 'togglefullscreen' }));
        
        menu.popup(mainWindow);
    });

    mainWindow.loadURL(`http://localhost:${localPort}/login.html`).catch(e => {
        fs.writeFileSync(path.join(__dirname, '../electron-error.log'), 'Load Error: ' + e.toString());
    });

    mainWindow.on('close', function (event) {
        if (!isQuitting && configCloseToTray) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });

    return mainWindow;
  }

app.whenReady().then(async () => {
    try { i18nMain.init(app.getPath('userData')); } catch (e) {}
    ipcMain.on('foxy-set-language', (_e, lang) => { i18nMain.set(String(lang || 'ar')); try { rebuildTrayMenu(lastTrayState); } catch (e) {} });
    ipcMain.handle('foxy-get-language', () => i18nMain.current());
    const { session } = require('electron');
    
    const allowedPermissions = ['media', 'microphone', 'camera', 'notifications', 'fullscreen'];
    
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        if (allowedPermissions.includes(permission)) {
            callback(true);
        } else {
            callback(false);
        }
    });
    
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
        return allowedPermissions.includes(permission);
    });

    session.defaultSession.setDevicePermissionHandler((details) => {
        return details.deviceType === 'media' && allowedPermissions.includes('microphone');
    });

    await startInternalServer(preferredPort);
    await waitForServer(localPort);
    const mainWindow = createWindow();
    console.log("[Main] App Data Path:", app.getPath('userData'));
    console.log("[Main] Updater Log Path:", path.join(app.getPath('userData'), 'updater.log'));

    overlayWindow = new BrowserWindow({
      width: 100,
      height: 100,
      transparent: true,
      frame: false,
      resizable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      focusable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });
    overlayWindow.setMenu(null);
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.loadFile(path.join(__dirname, 'overlay.html')).catch(e => {
      console.error('[Overlay] Failed to load overlay.html', e);
    });
    overlayWindow.on('closed', () => { overlayWindow = null; });

    var keepClickThrough = setInterval(function() {
      if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible() && overlayVisibleForGame) {
        overlayWindow.setIgnoreMouseEvents(true, { forward: true });
      }
    }, 500);

    function overlayExec(js) {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        try { overlayWindow.webContents.executeJavaScript(js).catch(() => {}); } catch(e) {}
      }
    }

    function setDefaultOverlayBounds() {
      if (!overlayWindow || overlayWindow.isDestroyed()) return;
      var displays = require('electron').screen.getPrimaryDisplay();
      var sw = displays.workAreaSize.width;
      var sh = displays.workAreaSize.height;

      overlayWindow.setBounds({
        x: 0, y: sh - 420,
        width: 260, height: 400
      });
    }

    ipcMain.on('voice-overlay-show', () => {
      isInVoiceForOverlay = true;
      overlayVisibleForGame = false;
      var enabledGames = gameLibrary.filter(function(g) { return g.enabled; });

      if (enabledGames.length === 0) {

        if (!overlayWindow || overlayWindow.isDestroyed()) return;
        setDefaultOverlayBounds();
        overlayWindow.showInactive();
        overlayWindow.setIgnoreMouseEvents(false);
        overlayExec('__overlayControl.show()');
      } else {

        checkGameDetection();
        startGameDetection();
      }
    });

    ipcMain.on('voice-overlay-hide', () => {
      isInVoiceForOverlay = false;
      overlayVisibleForGame = false;
      stopGameDetection();
      overlayExec('__overlayControl.hide()');
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.hide();
      }
    });

    ipcMain.on('voice-overlay-position', (event, pos) => {
      overlayExec('__overlayControl.setPosition("' + pos.replace(/[^a-z-]/g, '') + '")');
    });

    ipcMain.on('voice-overlay-members', (event, members) => {
      var js = '__overlayControl.updateMembers(' + JSON.stringify(members) + ')';
      overlayExec(js);
    });

    ipcMain.on('voice-overlay-speaking', (event, speakingIds) => {
      var js = '__overlayControl.updateSpeaking(' + JSON.stringify(speakingIds || []) + ')';
      overlayExec(js);
    });

    ipcMain.on('voice-overlay-hover', (event, hovered) => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setIgnoreMouseEvents(!hovered, { forward: true });
      }
    });

    loadGameLibrary();

    ipcMain.handle('browse-game-exe', async () => {
      var result = await require('electron').dialog.showOpenDialog({
        title: 'Select Game Executable',
        filters: [{ name: 'Games', extensions: ['exe'] }],
        properties: ['openFile']
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return null;
      }
      var fullPath = result.filePaths[0];
      var exeName = fullPath.split('\\').pop().split('/').pop();
      var cleanExe = exeName.trim();
      
      if (!/^[a-zA-Z0-9._-]+\.exe$/i.test(cleanExe)) {
        return { exe: null, error: 'Invalid executable name' };
      }

      var dup = gameLibrary.some(function(g) { return g.exe.toLowerCase() === cleanExe.toLowerCase(); });
      if (dup) {
        return { exe: null, duplicate: true, message: 'Game "' + cleanExe + '" is already in your library.' };
      }
      gameLibrary.push({ exe: cleanExe, enabled: true });
      saveGameLibrary();
      notifyGameLibraryChanged();
      if (isInVoiceForOverlay) { checkGameDetection(); startGameDetection(); }
      return { exe: cleanExe, duplicate: false };
    });

    ipcMain.handle('game-library-add', (event, exeName) => {
      if (!exeName || typeof exeName !== 'string') return { success: false, reason: 'invalid' };
      var clean = exeName.trim();
      if (!clean) return { success: false, reason: 'empty' };
      if (clean.toLowerCase().indexOf('.exe') === -1) clean += '.exe';
      
      if (!/^[a-zA-Z0-9._-]+\.exe$/i.test(clean)) {
        return { success: false, reason: 'invalid_name' };
      }
      
      var dup = gameLibrary.some(function(g) { return g.exe.toLowerCase() === clean.toLowerCase(); });
      if (dup) {
        return { success: false, reason: 'duplicate', exe: clean };
      }
      gameLibrary.push({ exe: clean, enabled: true });
      saveGameLibrary();
      notifyGameLibraryChanged();
      if (isInVoiceForOverlay) { checkGameDetection(); startGameDetection(); }
      return { success: true, exe: clean };
    });

    ipcMain.on('game-library-remove', (event, exeName) => {
      if (!exeName || typeof exeName !== 'string') return;

      if (!/^[a-zA-Z0-9._-]+\.exe$/i.test(exeName)) return;
      gameLibrary = gameLibrary.filter(function(g) { return g.exe.toLowerCase() !== exeName.toLowerCase(); });
      saveGameLibrary();
      notifyGameLibraryChanged();
      if (isInVoiceForOverlay && gameLibrary.filter(function(g){return g.enabled;}).length > 0) {
        checkGameDetection();
      }
    });

    ipcMain.on('game-library-toggle', (event, exeName, enabled) => {
      if (!exeName || typeof exeName !== 'string') return;

      if (!/^[a-zA-Z0-9._-]+\.exe$/i.test(exeName)) return;
      for (var i = 0; i < gameLibrary.length; i++) {
        if (gameLibrary[i].exe.toLowerCase() === exeName.toLowerCase()) {
          gameLibrary[i].enabled = !!enabled;
          break;
        }
      }
      saveGameLibrary();
      notifyGameLibraryChanged();
      if (isInVoiceForOverlay) { checkGameDetection(); }
    });

    ipcMain.handle('game-library-get', () => {
      return JSON.parse(JSON.stringify(gameLibrary));
    });

    ipcMain.handle('game-library-is-active', async () => {
      var info = await getActiveWindowInfo();
      if (!info || !info.name) return false;
      var lower = info.name.toLowerCase().replace('.exe', '');
      return gameLibrary.some(function(g) {
        return g.enabled && lower === g.exe.toLowerCase().replace('.exe', '');
      });
    });

    var detectionInProgress = false;
    var currentParentHwnd = 0;

    function setOverlayParent(gameHwnd) {
      if (!overlayWindow || overlayWindow.isDestroyed()) return;
      try {
        var hwndBuf = overlayWindow.getNativeWindowHandle();
        if (!hwndBuf || hwndBuf.length === 0) return;
        var overlayHwndHex = hwndBuf.toString('hex');

        while (overlayHwndHex.length < 16) overlayHwndHex = '0' + overlayHwndHex;

        const gameHwndNum = Number(gameHwnd);
        if (!Number.isInteger(gameHwndNum) || gameHwndNum <= 0) {
          console.error('[Overlay] Invalid gameHwnd:', gameHwnd);
          return;
        }
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
        
        require('child_process').execFile('powershell', [
          '-NoProfile', '-NonInteractive', '-Command', psScript, overlayHwndHex, gameHwndHex
        ], { timeout: 3000, windowsHide: true }, function() {});
      } catch(e) {}
      currentParentHwnd = gameHwnd;
    }

    function showOverlayForGame(info) {
      if (!overlayWindow || overlayWindow.isDestroyed()) return;
      if (overlayVisibleForGame) {

        if (info && info.bounds) {
          overlayWindow.setBounds({
            x: info.bounds.x, y: info.bounds.y,
            width: info.bounds.w, height: info.bounds.h
          });
        }
        return;
      }

      overlayWindow.setAlwaysOnTop(true, 'screen-saver');
      if (info && info.hwnd) {
        setOverlayParent(info.hwnd);

        overlayWindow.setBounds({ x: 0, y: 0, width: info.bounds.w, height: info.bounds.h });
      } else if (info && info.bounds) {
        overlayWindow.setBounds({
          x: info.bounds.x, y: info.bounds.y,
          width: info.bounds.w, height: info.bounds.h
        });
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
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.hide();
      }
    }

    function checkGameDetection() {
      if (!isInVoiceForOverlay || detectionInProgress) return;
      detectionInProgress = true;
      var enabledExes = gameLibrary.filter(function(g) { return g.enabled; });

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

      getActiveWindowInfo().then(function(info) {
        detectionInProgress = false;

        if (!info || !info.name) return;

        var lower = info.name.toLowerCase().replace('.exe', '');
        var matched = enabledExes.some(function(g) {
          return lower === g.exe.toLowerCase().replace('.exe', '');
        });
        if (matched) {
          if (overlayVisibleForGame) {

            if (info.bounds && overlayWindow && !overlayWindow.isDestroyed()) {
              var currentBounds = overlayWindow.getBounds();
              if (currentBounds.width !== info.bounds.w || currentBounds.height !== info.bounds.h) {
                overlayWindow.setBounds({
                  x: currentParentHwnd !== 0 ? 0 : info.bounds.x,
                  y: currentParentHwnd !== 0 ? 0 : info.bounds.y,
                  width: info.bounds.w, height: info.bounds.h
                });
              }
            }
          } else {
            showOverlayForGame(info);
          }
        } else if (overlayVisibleForGame) {
          hideOverlayForGame();
        }
      }).catch(function() {
        detectionInProgress = false;
      });
    }

    function startGameDetection() {
      if (gameDetectionInterval) return;
      gameDetectionInterval = setInterval(function() {
        checkGameDetection();
      }, 800);
    }

    function stopGameDetection() {
      if (gameDetectionInterval) {
        clearInterval(gameDetectionInterval);
        gameDetectionInterval = null;
      }
    }

    function loadGameLibrary() {
      try {
        if (fs.existsSync(GAME_LIBRARY_PATH)) {
          gameLibrary = JSON.parse(fs.readFileSync(GAME_LIBRARY_PATH, 'utf8'));
        }
      } catch (e) {}
      if (!Array.isArray(gameLibrary)) gameLibrary = [];
    }

    function saveGameLibrary() {
      try {
        fs.writeFileSync(GAME_LIBRARY_PATH, JSON.stringify(gameLibrary, null, 2));
      } catch (e) { console.error('[GameLib] Save failed', e); }
    }

    function notifyGameLibraryChanged() {
      BrowserWindow.getAllWindows().forEach(function(w) {
        if (!w.isDestroyed()) {
          w.webContents.send('game-library-changed', JSON.parse(JSON.stringify(gameLibrary)));
        }
      });
    }

    function getActiveWindowInfo() {
      return new Promise(function(resolve) {
        var psScript = [
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
          '[WinInfo]::Get()'
        ].join('\n');

        require('child_process').execFile('powershell', [
          '-NoProfile', '-NonInteractive', '-Command', psScript
        ], { timeout: 3000 }, function(err, stdout) {
          if (err) { resolve(null); return; }
          var out = stdout.trim();
          if (!out) { resolve(null); return; }
          var parts = out.split('|');
          if (parts.length < 6) { resolve(null); return; }
          resolve({
            hwnd: parseInt(parts[0], 10),
            name: parts[1],
            bounds: {
              x: parseInt(parts[2], 10) || 0,
              y: parseInt(parts[3], 10) || 0,
              w: parseInt(parts[4], 10) || 800,
              h: parseInt(parts[5], 10) || 600
            }
          });
        });
      });
    }

    ipcMain.on('toggle-hw-accel', (event, disable) => {

        if (typeof disable !== 'boolean') return;
        fs.writeFileSync(configPath, JSON.stringify({ disableGPU: disable }));
    });

    ipcMain.handle('check-for-updates', async () => {
        return await checkForUpdates();
    });

    ipcMain.handle('check-update-from-config', async (event, { latestVersion, downloadURL, force }) => {

        if (!latestVersion || typeof latestVersion !== 'string') return null;
        if (downloadURL && typeof downloadURL !== 'string') return null;
        
        const sanitizedVersion = latestVersion.replace(/[^a-zA-Z0-9.\-v]/g, '');
        if (sanitizedVersion !== latestVersion) return null;
        
        const cleanLatest = sanitizedVersion.replace('v', '');
        const cleanCurrent = CURRENT_VERSION.replace('v', '');
        
        if (force === true) {
            logUpdater(`Config update (forced by updateSource): ${sanitizedVersion}`);
            return {
                version: `v${cleanLatest}`,
                asarUrl: downloadURL || '',
                isDownloaded: false
            };
        }
        
        const latestParts = cleanLatest.split('.').map(Number);
        const currentParts = cleanCurrent.split('.').map(Number);
        for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
            const l = latestParts[i] || 0;
            const c = currentParts[i] || 0;
            if (l > c) {
                logUpdater(`Config update available: ${sanitizedVersion} (current: ${CURRENT_VERSION})`);
                return {
                    version: `v${cleanLatest}`,
                    asarUrl: downloadURL || '',
                    isDownloaded: false
                };
            }
            if (l < c) break;
        }
        logUpdater(`Config check: version ${sanitizedVersion} is not newer than ${CURRENT_VERSION}`);
        return null;
    });

    ipcMain.handle('get-app-version', () => {
        return CURRENT_VERSION;
    });

    ipcMain.handle('get-firebase-config', async () => {
        try {
            const fs = require('fs');
            const path = require('path');
            
            const configPath = path.join(app.getPath('userData'), 'firebase-config.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                return config;
            }
            
            if (process.env.FIREBASE_API_KEY) {
                return {
                    apiKey: process.env.FIREBASE_API_KEY,
                    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
                    databaseURL: process.env.FIREBASE_DATABASE_URL,
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
                    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
                    appId: process.env.FIREBASE_APP_ID,
                    measurementId: process.env.FIREBASE_MEASUREMENT_ID
                };
            }
            
            throw new Error('Firebase config not found. Create firebase-config.json in userData or set env vars.');
        } catch (e) {
            console.error('[Firebase Config] Failed to load:', e.message);
            throw e;
        }
    });

    ipcMain.handle('start-update-download', async (event, { version, url }) => {

        if (!version || typeof version !== 'string') return { success: false, error: 'Invalid version' };
        if (!url || typeof url !== 'string') return { success: false, error: 'Invalid URL' };
        
        try {
            const parsedUrl = new URL(url);
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                return { success: false, error: 'Invalid URL protocol' };
            }

            if (!parsedUrl.hostname.includes('github.com') && !parsedUrl.hostname.includes('githubusercontent.com')) {
                return { success: false, error: 'Untrusted download domain' };
            }
        } catch {
            return { success: false, error: 'Invalid URL format' };
        }
        
        const sanitizedVersion = version.replace(/[^a-zA-Z0-9.\-v]/g, '');
        if (sanitizedVersion !== version) return { success: false, error: 'Invalid version format' };
        
        try {
            await downloadUpdate(sanitizedVersion, url);
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.on('restart-app', () => {
        logUpdater(`User requested restart. Preparing swap script...`);
        
        if (app.isPackaged && process.platform === 'win32') {
            const appPath = app.getAppPath();
            const resourcesPath = path.dirname(appPath);
            const executablePath = process.execPath;
            const coreFile = path.join(resourcesPath, 'app.asar');
            const backupFile = path.join(resourcesPath, 'app.asar.old');

            const files = fs.readdirSync(resourcesPath);
            const updateFileBase = files.find(f => f.startsWith('update-v') && f.endsWith('.asar'));

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
                const bom = Buffer.from('\uFEFF', 'utf8');
                fs.writeFileSync(ps1File, Buffer.concat([bom, Buffer.from(psScript, 'utf8')]));

                const batchFile = path.join(os.tmpdir(), 'voicehub_launcher.bat');
                const batchScript = `@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1File}"
del "${ps1File}"
del "%~f0"
`;
                fs.writeFileSync(batchFile, Buffer.concat([bom, Buffer.from(batchScript, 'utf8')]));

                spawn('cmd.exe', ['/c', batchFile], { detached: true, stdio: 'ignore' }).unref();
                app.quit();
                return;
            }
        }
        
        logUpdater(`Normal restart (no update found or not packaged).`);
        app.relaunch();
        app.quit();
    });

    ipcMain.on('toggle-close-to-tray', (event, enabled) => {
        configCloseToTray = enabled;
    });

    ipcMain.on('toggle-run-on-startup', (event, enabled) => {
        app.setLoginItemSettings({
            openAtLogin: enabled,
            path: app.getPath("exe")
        });
    });

    ipcMain.handle('get-screen-sources', async () => {
        const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
        return sources.map(source => {
            return {
                id: source.id,
                name: source.name,
                thumbnail: source.thumbnail.toDataURL()
            }
        });
    });

    tray = new Tray(path.join(__dirname, '../assets/img/foxy.png'));
    tray.setToolTip('Foxy');

    function rebuildTrayMenu(state) {
        const template = [];
        template.push({ label: i18nMain.t('tray.show_app'), click: function () {
            mainWindow.show();
        }});

        if (state && state.inCall) {
            template.push({ type: 'separator' });
            
            template.push({
                label: i18nMain.t('app_context_menu.tray_mute'),
                type: 'checkbox',
                checked: state.isMuted,
                click: function () {
                    mainWindow.webContents.send('tray-action', 'toggle-mute');
                }
            });

            template.push({
                label: i18nMain.t('app_context_menu.tray_deafen'),
                type: 'checkbox',
                checked: state.isDeafened,
                click: function () {
                    mainWindow.webContents.send('tray-action', 'toggle-deafen');
                }
            });
            template.push({ type: 'separator' });
        }

        template.push({ label: i18nMain.t('app_context_menu.quit'), click: function () {
            isQuitting = true;
            app.quit();
        }});
        
        tray.setContextMenu(Menu.buildFromTemplate(template));
    }

    rebuildTrayMenu({ inCall: false, isMuted: false, isDeafened: false });

    let lastTrayState = { inCall: false, isMuted: false, isDeafened: false };
    ipcMain.on('update-tray-state', (event, state) => {
        lastTrayState = state || lastTrayState;
        rebuildTrayMenu(lastTrayState);
    });

    tray.on('click', () => {
        mainWindow.show();
    });

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) {
        const win = createWindow();
        tray.on('click', () => { win.show(); });
      }
    });

  }).catch(e => {
      fs.writeFileSync('electron-error.log', 'Ready Error: ' + e.toString());
  });

  function cleanup() {

    if (server && server.listening) {
      server.close();
    }
    if (gameDetectionInterval) {
      clearInterval(gameDetectionInterval);
      gameDetectionInterval = null;
    }
    if (healthMonitorInterval) {
      clearInterval(healthMonitorInterval);
      healthMonitorInterval = null;
    }
    if (micPulseInterval) {
      clearInterval(micPulseInterval);
      micPulseInterval = null;
    }
    if (keepClickThrough) {
      clearInterval(keepClickThrough);
      keepClickThrough = null;
    }
    if (ghostCleanupInterval) {
      clearInterval(ghostCleanupInterval);
      ghostCleanupInterval = null;
    }
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.destroy();
      overlayWindow = null;
    }
    if (tray) {
      tray.destroy();
      tray = null;
    }
  }

  app.on('before-quit', function () {
      isQuitting = true;
      cleanup();
  });

  app.on('window-all-closed', function () {
    cleanup();
    if (process.platform !== 'darwin') app.quit();
  });
} catch (e) {
  fs.writeFileSync('electron-error.log', 'Sync Error: ' + e.toString() + '\n' + e.stack);
}
