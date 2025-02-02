import sqlite3 from 'sqlite3';
import { ipcMain } from 'electron';
import { databasePath } from './databaseServer';

// 获取模型使用的token统计数据
function getModelTokensStatistics(startDate, endDate) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(databasePath);
        let query = `
            SELECT 
                ModelName,
                SUM(InputTokens) as TotalInputTokens,
                SUM(OutputTokens) as TotalOutputTokens
            FROM UsageHistory
        `;

        const params = [];
        if (startDate && endDate) {
            query += ` WHERE CreatedAt >= ? AND CreatedAt <= ?`;
            params.push(startDate.toISOString(), endDate.toISOString());
        }

        query += ` GROUP BY ModelName`;

        db.all(query, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            
            const statistics = rows.map(row => ({
                modelName: row.ModelName,
                totalTokens: row.TotalInputTokens + row.TotalOutputTokens,
                inputTokens: row.TotalInputTokens,
                outputTokens: row.TotalOutputTokens
            }));
            
            resolve(statistics);
        });

        db.close();
    });
}

function getDailyTokensStatistics(startDate, endDate) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(databasePath);
        let query = `
            SELECT 
                date(CreatedAt) as Date,
                SUM(InputTokens + OutputTokens) as TotalTokens
            FROM UsageHistory
        `;

        const params = [];
        if (startDate && endDate) {
            query += ` WHERE CreatedAt >= ? AND CreatedAt <= ?`;
            params.push(startDate.toISOString(), endDate.toISOString());
        }

        query += ` GROUP BY date(CreatedAt)
                  ORDER BY Date ASC`;

        db.all(query, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            
            const statistics = rows.map(row => ({
                date: row.Date,
                totalTokens: row.TotalTokens
            }));
            
            resolve(statistics);
        });

        db.close();
    });
}

// 修改 IPC 监听器
ipcMain.handle('get-model-tokens-statistics', async (event, { startDate, endDate } = {}) => {
    try {
        const statistics = await getModelTokensStatistics(startDate ? new Date(startDate) : null, endDate ? new Date(endDate) : null);
        return statistics;
    } catch (error) {
        console.error('Error getting model tokens statistics:', error);
        throw error;
    }
});

ipcMain.handle('get-daily-tokens-statistics', async (event, { startDate, endDate } = {}) => {
    try {
        const statistics = await getDailyTokensStatistics(
            startDate ? new Date(startDate) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 默认一年
            endDate ? new Date(endDate) : new Date()
        );
        return statistics;
    } catch (error) {
        console.error('Error getting daily tokens statistics:', error);
        throw error;
    }
});

export { getModelTokensStatistics, getDailyTokensStatistics };