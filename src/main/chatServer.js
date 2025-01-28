import { ipcMain } from 'electron';
import sqlite3 from 'sqlite3';
import { databasePath } from './databaseServer';
import { readFile } from 'fs/promises';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

function initializeChatServer() {
  // 获取模型列表
  ipcMain.handle('get-models-chat', async () => {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(databasePath);
      const query = `
        SELECT 
          m.*,
          c.IconPath,
          c.BaseURL as ChannelBaseURL,
          c.APIKey as ChannelAPIKey,
          c.Seq as ChannelSeq
        FROM Models m
        LEFT JOIN Channels c ON m.ChannelCode = c.ChannelsCode
        WHERE m.IsEnabled = 1 AND c.IsEnabled = 1
        ORDER BY c.Seq ASC, m.Seq ASC
      `;

      db.all(query, [], (err, results) => {
        if (err) {
          reject(err);
          return;
        }

        const modelList = results.map(row => ({
          value: row.Name,
          label: row.Nick || row.Name,
          svg: row.IconPath,
          baseURL: row.OverWriteBaseURL || row.ChannelBaseURL,
          apiKey: row.OverWriteAPIKey || row.ChannelAPIKey,
          isVisionModel: row.IsVisionModel === 1,
          channel: row.ChannelCode
        }));

        db.close();
        resolve(modelList);
      });
    });
  });

  // 获取聊天历史记录（分页）
  ipcMain.handle('get-chat-history', async (event, { page = 1, pageSize = 20, searchKey = '' }) => {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(databasePath);
      const offset = (page - 1) * pageSize;
      const searchPattern = `%${searchKey}%`;

      const query = `
        WITH FirstChats AS (
          SELECT 
            ChatId,
            MIN(CreatedAt) as FirstCreatedAt
          FROM ChatHistory
          WHERE ChatTitle LIKE ? OR UserContent LIKE ? OR AssistantContent LIKE ?
          GROUP BY ChatId
        )
        SELECT 
          ch.*
        FROM ChatHistory ch
        INNER JOIN FirstChats fc 
          ON ch.ChatId = fc.ChatId 
          AND ch.CreatedAt = fc.FirstCreatedAt
        ORDER BY ch.CreatedAt DESC
        LIMIT ? OFFSET ?
      `;

      // 获取总记录数的查询
      const countQuery = `
        SELECT COUNT(DISTINCT ChatId) as total
        FROM ChatHistory
        WHERE ChatTitle LIKE ? OR UserContent LIKE ? OR AssistantContent LIKE ?
      `;

      // 先获取总数，再获取分页数据
      db.get(countQuery, [searchPattern, searchPattern, searchPattern], (err, totalRow) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }

        db.all(query, [searchPattern, searchPattern, searchPattern, pageSize, offset], (err, results) => {
          if (err) {
            db.close();
            reject(err);
            return;
          }

          const response = {
            total: totalRow.total,
            page,
            pageSize,
            data: results.map(row => ({
              id: row.Id,
              chatId: row.ChatId,
              groupId: row.GroupId,
              title: row.ChatTitle,
              channelCode: row.ChannelCode,
              modelName: row.ModelName,
              userContent: row.UserContent,
              assistantContent: row.AssistantContent,
              imageList: row.ImageList ? JSON.parse(row.ImageList) : [],
              isTop: row.IsTop === 1,
              collectionCode: row.CollectionCode,
              createdAt: row.CreatedAt
            }))
          };

          db.close();
          resolve(response);
        });
      });
    });
  });

  // 删除聊天历史记录
  ipcMain.handle('delete-chat', async (event, chatId) => {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(databasePath);
      const query = `
        DELETE FROM ChatHistory
        WHERE ChatId = ?
      `;
      db.run(query, [chatId], err => {
        if (err) {
          db.close();
          reject(err);
          return;
        }
        db.close();
        resolve();
      });
    });
  });

  // 删除单条聊天历史记录
  ipcMain.handle('delete-chat-groupId', async (event, groupId) => {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(databasePath);
      const query = `
        DELETE FROM ChatHistory
        WHERE GroupId = ?
      `;
      db.run(query, [groupId], err => {
        if (err) {
          db.close();
          reject(err);
          return;
        }
        db.close();
        resolve();
      });
    });
  });

  // 获取聊天内容详情根据chatId
  ipcMain.handle('get-chat-detail', async (event, chatId) => {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(databasePath);
      const query = `
        SELECT *
        FROM ChatHistory
        WHERE ChatId = ?
        ORDER BY CreatedAt ASC
      `;

      db.all(query, [chatId], (err, results) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }

        const chatDetail = results.map(row => ({
          id: row.Id,
          chatId: row.ChatId,
          groupId: row.GroupId,
          title: row.ChatTitle,
          channelCode: row.ChannelCode,
          modelName: row.ModelName,
          userContent: row.UserContent,
          assistantContent: row.AssistantContent,
          imageList: row.ImageList ? JSON.parse(row.ImageList) : [],
          fileList: row.FileContent ? JSON.parse(row.FileContent).map(fileStr => JSON.parse(fileStr)) : [],
          isTop: row.IsTop === 1,
          collectionCode: row.CollectionCode,
          createdAt: row.CreatedAt
        }));

        db.close();
        resolve(chatDetail);
      });
    });
  });

  // 读取非文本文件内容
  ipcMain.handle('read-file-content', async (event, filePath, fileType) => {
    try {
      const buffer = await readFile(filePath);

      switch (fileType) {
        case 'application/pdf':
          const pdfData = await pdf(buffer);
          return pdfData.text;

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          const result = await mammoth.extractRawText({ buffer });
          return result.value;

        default:
          // 对于其他类型的文件，尝试直接读取文本
          return buffer.toString('utf-8');
      }
    } catch (error) {
      console.error('读取文件失败:', error);
      throw error;
    }
  });

}
async function saveChatHistory(chatId, groupId, userContent, assistantContent, modelName, channelCode, imageList = [], fileList = []) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath);
    const query = `
      INSERT INTO ChatHistory (
        ChatId, GroupId, ModelName, ChannelCode,
        UserContent, AssistantContent, ImageList, FileContent, CreatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `;

    const cleanImageList = Array.isArray(imageList)
      ? imageList.map(img => String(img))
      : [];
    const serializedImageList = JSON.stringify(cleanImageList);

    const cleanFileList = Array.isArray(fileList)
      ? fileList
      : [];
    const serializedFileList = JSON.stringify(cleanFileList);

    db.run(query, [
      chatId,
      groupId,
      modelName,
      channelCode,
      userContent,
      assistantContent,
      serializedImageList,
      serializedFileList
    ], function (err) {
      db.close();
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

async function saveUsageHistory(groupId, modelName, inputTokens, outputTokens) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath);
    const query = `
      INSERT INTO UsageHistory (
        GroupId, ModelName, InputTokens, OutputTokens, CreatedAt
      ) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
    `;

    db.run(query, [groupId, modelName, inputTokens, outputTokens], function (err) {
      db.close();
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

export {
  initializeChatServer,
  saveChatHistory,
  saveUsageHistory
};