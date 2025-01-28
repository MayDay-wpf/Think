import sqlite3 from 'sqlite3';
import { ipcMain } from 'electron';
import { databasePath } from './databaseServer';

// 获取高级设置
function getAdvanceSettings() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath);
    db.get('SELECT * FROM AdvanceSettings LIMIT 1', (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
      db.close();
    });
  });
}

// 更新高级设置
function updateAdvanceSettings(settings) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath);
    const { Temperature, TopP, MaxTokens, PresencePenalty, FrequencyPenalty, IsEnable } = settings;
    
    db.run(
      'UPDATE AdvanceSettings SET Temperature = ?, TopP = ?, MaxTokens = ?, PresencePenalty = ?, FrequencyPenalty = ?, IsEnable = ? WHERE Id = 1',
      [Temperature, TopP, MaxTokens, PresencePenalty, FrequencyPenalty, IsEnable],
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
        db.close();
      }
    );
  });
}

// 注册IPC处理器
export function registerAdvanceSettingsHandlers() {
  ipcMain.handle('get-advance-settings', async () => {
    try {
      const settings = await getAdvanceSettings();
      return settings;
    } catch (error) {
      console.error('获取高级设置失败:', error);
      throw error;
    }
  });

  ipcMain.handle('update-advance-settings', async (event, settings) => {
    try {
      await updateAdvanceSettings(settings);
      return { success: true };
    } catch (error) {
      console.error('Update settings error:', error);
      throw { message: error.message || 'Database operation failed' };
    }
  });
}