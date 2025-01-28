import sqlite3 from 'sqlite3'
import { ipcMain } from 'electron'
import { databasePath } from './databaseServer'

// 获取首选的搜索引擎
export function getPreferredSearchEngine() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath);
    const query = 'SELECT * FROM SearchEngine ORDER BY Seq LIMIT 1';

    db.get(query, [], (err, row) => {
      db.close();
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

export function setupSearchEngineHandlers() {
  // 获取所有搜索引擎
  ipcMain.handle('get-search-engines', async () => {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(databasePath)
      const query = 'SELECT * FROM SearchEngine ORDER BY Seq'

      db.all(query, [], (err, rows) => {
        db.close()
        if (err) {
          reject(err)
          return
        }
        resolve(rows)
      })
    })
  })

  // 更新搜索引擎配置
  ipcMain.handle('update-search-engine-config', async (event, data) => {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(databasePath)
      const query = 'UPDATE SearchEngine SET Config = ? WHERE Id = ?'

      db.run(query, [data.config, data.id], function (err) {
        db.close()
        if (err) {
          reject(err)
          return
        }
        resolve({ success: true, changes: this.changes })
      })
    })
  })

  // 更新搜索引擎排序
  ipcMain.handle('update-search-engines-order', async (event, engines) => {
    const db = new sqlite3.Database(databasePath)

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION')

        const stmt = db.prepare('UPDATE SearchEngine SET Seq = ? WHERE Id = ?')

        engines.forEach(engine => {
          stmt.run([engine.Seq, engine.Id])
        })

        stmt.finalize()

        db.run('COMMIT', err => {
          db.close()
          if (err) {
            reject(err)
            return
          }
          resolve({ success: true })
        })
      })
    })
  })
}