import sqlite3 from 'sqlite3'
import { promises as fsPromises } from 'fs'
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { databasePath } from './databaseServer'
import { join, extname, isAbsolute } from 'path'


function setupModelSettingHandlers() {
    // 添加新模型的处理器
    ipcMain.handle('add-model', async (event, model) => {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(databasePath);

            // 获取同一渠道下的最大 Seq 值
            db.get('SELECT MAX(Seq) as maxSeq FROM Models WHERE ChannelCode = ?', [model.channelCode], (err, row) => {
                if (err) {
                    db.close();
                    reject(err);
                    return;
                }

                const nextSeq = (row.maxSeq || 0) + 1;
                const sql = `INSERT INTO Models (ChannelCode, Nick, Name, OverWriteBaseURL, OverWriteAPIKey, IsEnabled, IsVisionModel, Seq) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

                db.run(sql, [
                    model.channelCode,
                    model.nick,
                    model.name,
                    model.overWriteBaseURL,
                    model.overWriteAPIKey,
                    model.isEnabled ? 1 : 0,
                    model.isVisionModel ? 1 : 0,
                    nextSeq
                ], function (err) {
                    if (err) {
                        console.error('数据库错误:', err);
                        db.close();
                        reject(err);
                        return;
                    }
                    db.close();
                    resolve({ id: this.lastID });
                });
            });
        });
    })

    // 添加新渠道的处理器
    ipcMain.handle('add-channel', async (event, channel) => {
        try {
            return new Promise((resolve, reject) => {
                const db = new sqlite3.Database(databasePath)

                // 首先获取当前最大的 Seq 值
                db.get('SELECT MAX(Seq) as maxSeq FROM Channels', [], (err, row) => {
                    if (err) {
                        db.close()
                        reject(err)
                        return
                    }

                    const nextSeq = (row.maxSeq || 0) + 1
                    const sql = `INSERT INTO Channels (ChannelsCode, IconPath, Name, BaseURL, APIKey, IsEnabled, Seq) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`

                    db.run(sql, [
                        channel.channelsCode,
                        channel.iconData,
                        channel.name,
                        channel.baseURL,
                        channel.apiKey,
                        channel.isEnabled ? 1 : 0,
                        nextSeq
                    ], function (err) {
                        if (err) {
                            reject(err)
                            return
                        }
                        resolve({ id: this.lastID })
                        db.close()
                    })
                })
            })
        } catch (error) {
            console.error('Error adding channel:', error)
            throw error
        }
    })

    // 获取渠道的处理器
    ipcMain.handle('get-channels', async () => {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(databasePath);
            db.all('SELECT * FROM Channels ORDER BY Seq', [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
                db.close();
            });
        });
    })

    // 获取模型列表的处理器
    ipcMain.handle('get-models', async () => {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(databasePath);
            db.all('SELECT * FROM Models ORDER BY Seq', [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
                db.close();
            });
        });
    })

    // 添加资源路径处理器
    ipcMain.handle('get-asset-path', async (event, filePath) => {
        try {
            let absolutePath
            // 处理不同类型的路径
            if (filePath.startsWith('@renderer')) {
                absolutePath = join(app.getAppPath(), 'src/renderer/src', filePath.replace('@renderer', ''))
            } else if (!isAbsolute(filePath)) {
                absolutePath = join(app.getAppPath(), filePath)
            } else {
                absolutePath = filePath
            }

            // 读取文件并转换为 base64
            const data = await fsPromises.readFile(absolutePath)
            const extension = extname(absolutePath).toLowerCase()
            const mimeType = {
                '.svg': 'image/svg+xml',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif'
            }[extension] || 'image/png'

            return `data:${mimeType};base64,${data.toString('base64')}`
        } catch (error) {
            console.error('Error converting image to base64:', error)
            return '' // 返回空字符串表示转换失败
        }
    })

    // 删除模型的处理器
    ipcMain.handle('delete-model', async (event, modelId) => {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(databasePath);
            const sql = 'DELETE FROM Models WHERE Id = ?';

            db.run(sql, [modelId], function (err) {
                if (err) {
                    reject(err);
                    console.error('数据库错误:', err);
                    return;
                }
                resolve({ success: true });
                db.close();
            });
        });
    });

    // 更新模型的处理器
    ipcMain.handle('update-model', async (event, model) => {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(databasePath);
            const sql = `UPDATE Models 
                   SET ChannelCode = ?, Nick = ?, Name = ?, 
                       OverWriteBaseURL = ?, OverWriteAPIKey = ?, 
                       IsEnabled = ?, IsVisionModel = ?
                   WHERE Id = ?`;

            db.run(sql, [
                model.channelCode,
                model.nick,
                model.name,
                model.overWriteBaseURL,
                model.overWriteAPIKey,
                model.isEnabled ? 1 : 0,
                model.isVisionModel ? 1 : 0,
                model.id
            ], function (err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ success: true });
                db.close();
            });
        });
    })

    // 删除渠道的处理器
    ipcMain.handle('delete-channel', async (event, channelCode) => {
        const db = new sqlite3.Database(databasePath)

        return new Promise((resolve, reject) => {
            // 开始事务
            db.serialize(() => {
                db.run('BEGIN TRANSACTION')

                // 首先删除该渠道下的所有模型
                db.run('DELETE FROM Models WHERE ChannelCode = ?', [channelCode], (err) => {
                    if (err) {
                        db.run('ROLLBACK')
                        db.close()
                        reject(err)
                        return
                    }

                    // 然后删除渠道
                    db.run('DELETE FROM Channels WHERE ChannelsCode = ?', [channelCode], (err) => {
                        if (err) {
                            db.run('ROLLBACK')
                            db.close()
                            reject(err)
                            return
                        }

                        db.run('COMMIT', (err) => {
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
        })
    })

    // 更新渠道的处理器
    ipcMain.handle('update-channel', async (event, channel) => {
        try {
            let iconData = channel.iconPath // 使用传入的原图片数据

            // 如果有新的图标数据，则使用新数据
            if (channel.iconData) {
                iconData = channel.iconData
            }

            return new Promise((resolve, reject) => {
                const db = new sqlite3.Database(databasePath);
                const sql = `UPDATE Channels 
                         SET IconPath = ?, Name = ?, BaseURL = ?, 
                             APIKey = ?, IsEnabled = ?
                         WHERE ChannelsCode = ?`;

                db.run(sql, [
                    iconData,
                    channel.name,
                    channel.baseURL,
                    channel.apiKey,
                    channel.isEnabled ? 1 : 0,
                    channel.channelsCode
                ], function (err) {
                    db.close();
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({ success: true });
                });
            });
        } catch (error) {
            console.error('Error updating channel:', error);
            throw error;
        }
    });

    // 更新渠道排序的处理器
    ipcMain.handle('update-channels-order', async (event, channels) => {
        const db = new sqlite3.Database(databasePath)

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION')

                // 批量更新渠道的 Seq 值
                const stmt = db.prepare('UPDATE Channels SET Seq = ? WHERE ChannelsCode = ?')

                let hasError = false
                channels.forEach((channel, index) => {
                    stmt.run([index + 1, channel.ChannelsCode], (err) => {
                        if (err && !hasError) {
                            hasError = true
                            console.error('更新渠道顺序失败:', err)
                            db.run('ROLLBACK')
                            db.close()
                            reject(err)
                        }
                    })
                })

                stmt.finalize((err) => {
                    if (err && !hasError) {
                        db.run('ROLLBACK')
                        db.close()
                        reject(err)
                        return
                    }

                    db.run('COMMIT', (err) => {
                        db.close()
                        if (err && !hasError) {
                            reject(err)
                            return
                        }
                        resolve({ success: true })
                    })
                })
            })
        })
    })

    // 更新模型排序的处理器
    ipcMain.handle('update-models-order', async (event, models) => {
        const db = new sqlite3.Database(databasePath)
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION')

                // 批量更新模型的 Seq 值
                const stmt = db.prepare('UPDATE Models SET Seq = ? WHERE Id = ?')

                let hasError = false
                models.forEach(model => {
                    stmt.run([model.Seq, model.Id], (err) => {
                        if (err && !hasError) {
                            hasError = true
                            console.error('更新模型顺序失败:', err)
                            db.run('ROLLBACK')
                            db.close()
                            reject(err)
                        }
                    })
                })

                stmt.finalize((err) => {
                    if (err && !hasError) {
                        db.run('ROLLBACK')
                        db.close()
                        reject(err)
                        return
                    }

                    db.run('COMMIT', (err) => {
                        db.close()
                        if (err && !hasError) {
                            reject(err)
                            return
                        }
                        resolve({ success: true })
                    })
                })
            })
        })
    })
}

export { setupModelSettingHandlers };