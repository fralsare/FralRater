// FralRater — Electron main process.
// Opens the app in a standalone window (no browser). Works on Windows and Linux.
'use strict';

const { app, BrowserWindow, Menu, shell } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

// Single instance: focus the existing window instead of opening a second app.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function waitForServer(port, tries = 100) {
  const ping = () =>
    new Promise((resolve) => {
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 500 }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  return (async () => {
    for (let i = 0; i < tries; i++) {
      if (await ping()) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  })();
}

function spawnServer(port) {
  return spawn('node', [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(port) },
    stdio: 'inherit',
  });
}

let win = null;
let serverProc = null;

async function createWindow() {
  const port = await findFreePort();
  serverProc = spawnServer(port);
  const up = await waitForServer(port);
  if (!up) {
    process.stderr.write(`FralRater: server did not start on port ${port}\n`);
    serverProc.kill();
    app.quit();
    return;
  }

  Menu.setApplicationMenu(null);

  win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    title: 'FralRater',
    backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Security: never leave the local server.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:')) return { action: 'deny' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Right-click menu with Cut/Copy/Paste so the mouse works everywhere.
  win.webContents.on('context-menu', (e, params) => {
    e.preventDefault();
    const menu = Menu.buildFromTemplate([
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut', enabled: params.editable },
      { role: 'copy', enabled: params.editable || params.selectionText.length > 0 },
      { role: 'paste', enabled: params.editable },
      { role: 'delete', enabled: params.editable },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editable },
    ]);
    menu.popup({ window: win });
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}`)) e.preventDefault();
  });

  await win.loadURL(`http://127.0.0.1:${port}/`);
  win.setTitle('FralRater');
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProc) serverProc.kill();
  app.quit();
});

app.on('before-quit', () => {
  if (serverProc) serverProc.kill();
});
