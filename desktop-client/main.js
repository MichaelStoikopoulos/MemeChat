const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { io } = require('socket.io-client');
const SERVER_URL = require('./config').SERVER_URL.replace(/\/+$/, '');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
// Safety net only: the overlay normally hides itself once the renderer
// decides a drop is done (image/text timer, or a video's "ended" event).
// This just guarantees it can never get stuck open if that signal is lost.
const MAX_DROP_DISPLAY_MS = 60000;

// Prevent two copies of the app running at once (e.g. auto-start on login
// plus a manual launch) — that was causing every drop to show twice, once
// per running instance, each with its own overlay window and socket.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

app.on('second-instance', () => {
  // Someone tried to launch a second copy; just surface the link window
  // (useful for switching groups) instead of letting a duplicate run.
  createLinkWindow();
  if (linkWindow) {
    linkWindow.show();
    linkWindow.focus();
  }
});

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
    height: 280,
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
      autoplayPolicy: 'no-user-gesture-required',
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
    // Hiding/showing the window repeatedly can let other windows drift
    // above it on Windows even though it's still flagged topmost — re-assert
    // both the topmost level and the stacking order on every drop.
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.showInactive();
    overlayWindow.moveTop();

    // The renderer tells us (via 'hide-overlay') when the drop is actually
    // done — a video's real "ended" event, or a fixed timer for images/text.
    // This is just a backstop in case that signal never arrives.
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      overlayWindow.hide();
    }, MAX_DROP_DISPLAY_MS);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });
}

ipcMain.on('hide-overlay', () => {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (overlayWindow) overlayWindow.hide();
});

function startWithConfig(config) {
  if (!overlayWindow) createOverlayWindow();
  connectSocket(config);
  app.setLoginItemSettings({ openAtLogin: true });
}

ipcMain.handle('pair-request', async (event, { code }) => {
  const res = await fetch(`${SERVER_URL}/api/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'pairing_failed');
  }

  const config = {
    serverUrl: SERVER_URL,
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
