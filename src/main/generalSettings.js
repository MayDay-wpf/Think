import sqlite3 from 'sqlite3';
import { ipcMain, BrowserWindow } from 'electron';
import { databasePath } from './databaseServer';

// 获取用户设置
function getUserSettings() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath);
    db.get('SELECT * FROM UserSettings LIMIT 1', (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
      db.close();
    });
  });
}

// 更新用户设置
function updateUserSettings(settings) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath);
    const { IsStream, IsAutoScroll, ModelAutoChange, HistoryLength } = settings;

    db.run(
      'UPDATE UserSettings SET IsStream = ?, IsAutoScroll = ?, ModelAutoChange = ?, HistoryLength = ? WHERE Id = 1',
      [IsStream, IsAutoScroll, ModelAutoChange, HistoryLength],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true, changes: this.changes });
        }
        db.close();
      }
    );
  });
}

// 设置 IPC 监听器
function setupGeneralSettingsHandlers() {
  // 获取设置
  ipcMain.handle('get-user-settings', async () => {
    try {
      const settings = await getUserSettings();
      return settings;
    } catch (error) {
      console.error('Error getting user settings:', error);
      throw error;
    }
  });

  // 更新设置
  ipcMain.handle('update-user-settings', async (_, settings) => {
    try {
      const result = await updateUserSettings(settings);
      return result;
    } catch (error) {
      console.error('Error updating user settings:', error);
      throw error;
    }
  });

  // 获取窗口置顶状态
  ipcMain.handle('get-always-on-top', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      return win.isAlwaysOnTop();
    }
    return false;
  });

  // 切换窗口置顶状态
  ipcMain.handle('toggle-always-on-top', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      const isAlwaysOnTop = win.isAlwaysOnTop();
      win.setAlwaysOnTop(!isAlwaysOnTop);
      return !isAlwaysOnTop;
    }
    return false;
  });
}

export { setupGeneralSettingsHandlers };