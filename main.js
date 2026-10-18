// PoeBaphomet — processo principal (Electron)
import { app, BrowserWindow, ipcMain, dialog, utilityProcess } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  detectGamePath,
  isValidGamePath,
  backupExists,
  restoreOriginal,
  COLORMODS_CATEGORIES,
} from './core/patcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 800,
    title: 'PoeBaphomet',
    autoHideMenuBar: true,
    backgroundColor: '#14161c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

app.whenReady().then(() => {
  ipcMain.handle('detect-game', () => detectGamePath());
  ipcMain.handle('validate-game', (_e, p) => isValidGamePath(p));
  ipcMain.handle('backup-exists', (_e, p) => backupExists(p));
  ipcMain.handle('get-colormods', () => COLORMODS_CATEGORIES.map((c) => ({
    name: c.name,
    items: c.items.map(([name, color, enabled]) => ({ name, color, enabled })),
  })));

  ipcMain.handle('browse-game', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecione a pasta do Path of Exile',
      properties: ['openDirectory'],
    });
    if (res.canceled || !res.filePaths.length) return null;
    return res.filePaths[0];
  });

  // Aplicação roda num processo separado (utilityProcess) — a interface continua respondendo
  ipcMain.handle('apply', (_e, gamePath, config) => {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const child = utilityProcess.fork(path.join(__dirname, 'core', 'apply-worker.cjs'), [], {
        serviceName: 'poebaphomet-apply',
      });
      child.postMessage({ gamePath, config });
      child.on('message', (msg) => {
        if (msg.type === 'progress') {
          send('progress', { phase: msg.phase, detail: msg.detail, percent: msg.percent });
        } else if (msg.type === 'done') {
          finish({ ok: true, files: msg.files });
          child.kill();
        } else if (msg.type === 'error') {
          finish({ ok: false, message: msg.message });
          child.kill();
        }
      });
      child.on('exit', () => {
        finish({ ok: false, message: 'O processo de aplicação encerrou inesperadamente.' });
      });
    });
  });

  ipcMain.handle('restore', async (_e, gamePath) => {
    try {
      restoreOriginal(gamePath, (phase, detail) => {
        send('progress', { phase, detail });
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, message: String(err && err.message ? err.message : err) };
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
