const { contextBridge, ipcRenderer, webFrame } = require('electron');

webFrame.setZoomFactor(1);

window.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const target = e.deltaY < 0 ? 'zoom-in' : 'zoom-out';
    ipcRenderer.invoke(target).catch(() => {});
}, { passive: false });

contextBridge.exposeInMainWorld('electronAPI', {
    toggleHardwareAccel: (disable) => ipcRenderer.send('toggle-hw-accel', disable),
    toggleCloseToTray: (enabled) => ipcRenderer.send('toggle-close-to-tray', enabled),
    toggleRunOnStartup: (enabled) => ipcRenderer.send('toggle-run-on-startup', enabled),
    updateTrayState: (state) => ipcRenderer.send('update-tray-state', state),
    onTrayAction: (callback) => ipcRenderer.on('tray-action', (_event, action) => callback(action)),
    getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
    googleLoginExternal: () => ipcRenderer.send('google-login-external'),
    onExternalAuthSuccess: (callback) => ipcRenderer.on('external-auth-success', (_event, tokens) => callback(tokens)),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    checkUpdateFromConfig: (config) => ipcRenderer.invoke('check-update-from-config', config),
    startUpdateDownload: (url) => ipcRenderer.invoke('start-update-download', url),
    restartApp: () => ipcRenderer.send('restart-app'),
    getFirebaseConfig: () => ipcRenderer.invoke('get-firebase-config'),
    openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
    voiceOverlayShow: () => ipcRenderer.send('voice-overlay-show'),
    voiceOverlayHide: () => ipcRenderer.send('voice-overlay-hide'),
    voiceOverlaySetPosition: (pos) => ipcRenderer.send('voice-overlay-position', pos),
    voiceOverlayUpdateMembers: (members) => ipcRenderer.send('voice-overlay-members', members),
    voiceOverlayUpdateSpeaking: (speakingIds) => ipcRenderer.send('voice-overlay-speaking', speakingIds),
    voiceOverlaySetHover: (hovered) => ipcRenderer.send('voice-overlay-hover', hovered),
    getGameLibrary: () => ipcRenderer.invoke('game-library-get'),
    addGame: (exe) => ipcRenderer.invoke('game-library-add', exe),
    browseGameExe: () => ipcRenderer.invoke('browse-game-exe'),
    removeGame: (exe) => ipcRenderer.send('game-library-remove', exe),
    toggleGame: (exe, enabled) => ipcRenderer.send('game-library-toggle', exe, enabled),
    isGameActive: () => ipcRenderer.invoke('game-library-is-active'),
    onGameLibraryChanged: (callback) => ipcRenderer.on('game-library-changed', (_event, lib) => callback(lib)),
    isElectron: true,
    getPlatform: () => process.platform,
    onGlobalMuteToggle: (callback) => {
        const listener = (_event, state) => callback(state);
        ipcRenderer.on('global-mute-toggle', listener);
        return () => ipcRenderer.removeListener('global-mute-toggle', listener);
    },
    sendMuteState: (state) => ipcRenderer.send('mute-state-changed', state),
    showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),
    retryConnection: () => ipcRenderer.invoke('retry-connection'),
    zoomIn: () => ipcRenderer.invoke('zoom-in'),
    zoomOut: () => ipcRenderer.invoke('zoom-out'),
    zoomReset: () => ipcRenderer.invoke('zoom-reset'),
    getZoom: () => ipcRenderer.invoke('get-zoom'),
    onZoomChanged: (callback) => {
        const listener = (_event, info) => callback(info);
        ipcRenderer.on('zoom-changed', listener);
        return () => ipcRenderer.removeListener('zoom-changed', listener);
    },
    getServers: () => ipcRenderer.invoke('get-server-config'),
    chooseServer: (choice) => ipcRenderer.invoke('server-choice', choice),
    switchServer: (options) => ipcRenderer.invoke('switch-server-environment', options),
    onServerChanged: (callback) => {
        const listener = (_event, info) => callback(info);
        ipcRenderer.on('server-changed', listener);
        return () => ipcRenderer.removeListener('server-changed', listener);
    },
    setAppLanguage: (lang) => ipcRenderer.send('foxy-set-language', lang),
    getAppLanguage: () => ipcRenderer.invoke('foxy-get-language'),
});
