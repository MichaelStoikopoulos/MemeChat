const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { io } = require('socket.io-client');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const DROP_DISPLAY_MS = 8000;

let linkWindow = null;
let overlayWindow = null;
let socket = null;
let hideTimer = null;

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function createLinkWindow() {
  if (linkWindow) {
    linkWindow.focus();
    return;
  }
  linkWindow = new BrowserWindow({
    width: 420,
    height: 360,
    resizable: false,
    title: 'Link this device',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  linkWindow.setMenuBarVisibility(false);
  linkWindow.loadFile(path.join(__dirname, 'link.html'));
  linkWindow.on('closed', () => {
    linkWindow = null;
  });
}

function createOverlayWindow() {
  const display = screen.getPrimaryDisplay();
  overlayWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setIgnoreMouseEvents(true);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function connectSocket(config) {
  if (socket) socket.disconnect();

  socket = io(config.serverUrl, { auth: { token: config.token } });

  socket.on('drop', (payload) => {
    if (!overlayWindow) return;
    overlayWindow.webContents.send('show-drop', payload);
    overlayWindow.showInactive();

    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      overlayWindow.hide();
    }, DROP_DISPLAY_MS);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });
}

function startWithConfig(config) {
  if (!overlayWindow) createOverlayWindow();
  connectSocket(config);
  app.setLoginItemSettings({ openAtLogin: true });
}

ipcMain.handle('pair-request', async (event, { serverUrl, code }) => {
  const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'pairing_failed');
  }

  const config = {
    serverUrl: serverUrl.replace(/\/$/, ''),
    token: data.token,
    groupId: data.groupId,
    groupName: data.groupName,
  };
  saveConfig(config);

  startWithConfig(config);

  if (linkWindow) linkWindow.close();
  return config;
});

app.whenReady().then(() => {
  const config = loadConfig();
  if (config) {
    startWithConfig(config);
  } else {
    createLinkWindow();
  }

  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    app.quit();
  });

  globalShortcut.register('CommandOrControl+Shift+L', () => {
    createLinkWindow();
  });
});

// No-op: keep running in the background (as an invisible overlay) even
// when the link window is closed, instead of Electron's default quit-on-
// all-windows-closed behavior.
app.on('window-all-closed', () => {});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
