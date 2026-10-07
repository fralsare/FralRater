// FralRater — Electron main process.
// Opens the app in a standalone window (no browser). Works on Windows and Linux.
//
// The UI is a static bundle (public/). In dev, server.js serves it for
// browser use; here the main process serves the same files over a local
// HTTP server on a free port — no external `node` binary needed, which is
// what makes the packaged app (AppImage/deb/rpm/exe) work.
'use strict';

const { app, BrowserWindow, Menu, shell } = require('electron');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

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

// Minimal static file server for the app bundle, bound to 127.0.0.1.
function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        let rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
        const file = path.normalize(path.join(ROOT, rel));
        if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }
        fs.stat(file, (err, stat) => {
          if (err || !stat.isFile()) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size });
          fs.createReadStream(file).pipe(res);
        });
      } catch (e) {
        res.writeHead(500);
        res.end('Server error');
      }
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
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

let win = null;
let httpServer = null;

async function createWindow() {
  const port = await findFreePort();
  httpServer = await startServer(port);
  process.stderr.write(`FralRater local server: http://127.0.0.1:${port}\n`);
  const up = await waitForServer(port);
  if (!up) {
    process.stderr.write(`FralRater: local server did not start on port ${port}\n`);
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

function shutdown() {
  if (httpServer) httpServer.close();
  app.quit();
}

app.on('window-all-closed', shutdown);
app.on('before-quit', shutdown);
