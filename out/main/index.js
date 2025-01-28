"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const sqlite3 = require("sqlite3");
const fs = require("fs");
const inspector = require("inspector");
const promises = require("fs/promises");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");
const OpenAI = require("openai");
const tiktoken = require("js-tiktoken");
const axios = require("axios");
const httpsProxyAgent = require("https-proxy-agent");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const tiktoken__namespace = /* @__PURE__ */ _interopNamespaceDefault(tiktoken);
const icon = path.join(__dirname, "../../resources/icon.png");
const databaseDir = utils.is.dev ? path.join(electron.app.getAppPath(), "src", "database") : path.join(process.resourcesPath, "database");
const databasePath = path.join(databaseDir, "ify.db");
async function initializeDatabase() {
  if (!fs.existsSync(databaseDir)) {
    fs.mkdirSync(databaseDir, { recursive: true });
    inspector.console.log(`Database directory created at: ${databaseDir}`);
  }
  if (fs.existsSync(databasePath)) {
    inspector.console.log("Database already exists. Skipping initialization.");
    return;
  }
  inspector.console.log("Database does not exist. Creating...");
  const db = new sqlite3.Database(databasePath, (err) => {
    if (err) {
      inspector.console.error("Error creating database:", err.message);
      return;
    }
    inspector.console.log("Connected to the ify.db database.");
  });
  try {
    await new Promise((resolve, reject) => {
      const createChannelsTable = `CREATE TABLE Channels (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        ChannelsCode TEXT,
        IconPath TEXT,
        Name TEXT,
        BaseURL TEXT,
        APIKey TEXT,
        IsEnabled INTEGER DEFAULT 1,
        Seq INTEGER
      )`;
      const defaultChannels = [
        {
          IconPath: "@renderer/assets/icons/deepseek.svg",
          Name: "DeepSeek",
          Code: "deepseek",
          BaseURL: "https://api.deepseek.com/v1",
          APIKey: "sz-xxxxxxxxxx",
          IsEnabled: 1,
          Seq: 1
        },
        {
          IconPath: "@renderer/assets/icons/siliconcloud.svg",
          Name: "SiliconFlow",
          Code: "siliconflow",
          BaseURL: "https://api.siliconflow.cn/v1",
          APIKey: "sz-xxxxxxxxxx",
          IsEnabled: 1,
          Seq: 2
        },
        {
          IconPath: "@renderer/assets/icons/qwen.svg",
          Name: "Qwen",
          Code: "qwen",
          BaseURL: "https://api.siliconflow.cn/v1",
          APIKey: "sz-xxxxxxxxxx",
          IsEnabled: 1,
          Seq: 3
        },
        {
          IconPath: "@renderer/assets/icons/gemini.svg",
          Name: "Gemini",
          Code: "gemini",
          BaseURL: "https://api.siliconflow.cn/v1",
          APIKey: "sz-xxxxxxxxxx",
          IsEnabled: 1,
          Seq: 4
        },
        {
          IconPath: "@renderer/assets/icons/anthropic.svg",
          Name: "Anthropic",
          Code: "anthropic",
          BaseURL: "https://api.siliconflow.cn/v1",
          APIKey: "sz-xxxxxxxxxx",
          IsEnabled: 1,
          Seq: 5
        },
        {
          IconPath: "@renderer/assets/icons/openai.svg",
          Name: "OpenAI",
          Code: "openai",
          BaseURL: "https://api.openai.com/v1",
          APIKey: "sz-xxxxxxxxxx",
          IsEnabled: 1,
          Seq: 6
        },
        {
          IconPath: "@renderer/assets/icons/ollama.svg",
          Name: "Ollama",
          Code: "ollama",
          BaseURL: "http://localhost:11434/v1",
          APIKey: "",
          IsEnabled: 1,
          Seq: 7
        }
      ];
      db.run(createChannelsTable, async (err) => {
        if (err) reject(err);
        else {
          inspector.console.log("Channels table created.");
          try {
            const insertDefaultData = `INSERT INTO Channels (ChannelsCode, IconPath, Name, BaseURL, APIKey, IsEnabled, Seq) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            for (const channel of defaultChannels) {
              await new Promise((resolveInsert, rejectInsert) => {
                db.run(insertDefaultData, [
                  channel.Code,
                  channel.IconPath,
                  channel.Name,
                  channel.BaseURL,
                  channel.APIKey,
                  channel.IsEnabled,
                  channel.Seq
                ], (err2) => {
                  if (err2) rejectInsert(err2);
                  else {
                    inspector.console.log(`${channel.Name} channel data inserted.`);
                    resolveInsert();
                  }
                });
              });
            }
            resolve();
          } catch (error) {
            reject(error);
          }
        }
      });
    });
    await new Promise((resolve, reject) => {
      const createModelsTable = `CREATE TABLE Models (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        ChannelCode TEXT,
        Nick TEXT,
        Name TEXT,
        OverWriteBaseURL TEXT,
        OverWriteAPIKey TEXT,
        IsEnabled INTEGER DEFAULT 1,
        IsVisionModel INTEGER DEFAULT 0,
        Seq INTEGER
      )`;
      const defaultModels = [
        {
          ChannelCode: "openai",
          Nick: "ChatGPT4O-Mini",
          Name: "gpt-4o-mini",
          OverWriteBaseURL: "",
          OverWriteAPIKey: "",
          IsEnabled: 1,
          IsVisionModel: 1,
          Seq: 1
        },
        {
          ChannelCode: "openai",
          Nick: "ChatGPT4O-Latest",
          Name: "chatgpt-4o-latest",
          OverWriteBaseURL: "",
          OverWriteAPIKey: "",
          IsEnabled: 1,
          IsVisionModel: 1,
          Seq: 2
        },
        {
          ChannelCode: "openai",
          Nick: "O1-Mini",
          Name: "o1-mini",
          OverWriteBaseURL: "",
          OverWriteAPIKey: "",
          IsEnabled: 1,
          IsVisionModel: 0,
          Seq: 3
        },
        {
          ChannelCode: "openai",
          Nick: "O1-Preview",
          Name: "o1-preview",
          OverWriteBaseURL: "",
          OverWriteAPIKey: "",
          IsEnabled: 1,
          IsVisionModel: 0,
          Seq: 4
        },
        {
          ChannelCode: "deepseek",
          Nick: "DeepSeek-Chat",
          Name: "deepseek-chat",
          OverWriteBaseURL: "",
          OverWriteAPIKey: "",
          IsEnabled: 1,
          IsVisionModel: 0,
          Seq: 1
        },
        {
          ChannelCode: "deepseek",
          Nick: "DeepSeek-R1",
          Name: "deepseek-reasoner",
          OverWriteBaseURL: "",
          OverWriteAPIKey: "",
          IsEnabled: 1,
          IsVisionModel: 0,
          Seq: 2
        }
      ];
      db.run(createModelsTable, async (err) => {
        if (err) reject(err);
        else {
          inspector.console.log("Models table created.");
          try {
            const insertDefaultData = `INSERT INTO Models (ChannelCode, Nick, Name, OverWriteBaseURL, OverWriteAPIKey, IsEnabled, IsVisionModel, Seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            for (const model of defaultModels) {
              await new Promise((resolveInsert, rejectInsert) => {
                db.run(insertDefaultData, [
                  model.ChannelCode,
                  model.Nick,
                  model.Name,
                  model.OverWriteBaseURL,
                  model.OverWriteAPIKey,
                  model.IsEnabled,
                  model.IsVisionModel,
                  model.Seq
                ], (err2) => {
                  if (err2) rejectInsert(err2);
                  else {
                    inspector.console.log(`${model.Nick} model data inserted.`);
                    resolveInsert();
                  }
                });
              });
            }
            resolve();
          } catch (error) {
            reject(error);
          }
        }
      });
    });
    await new Promise((resolve, reject) => {
      const createChatHistoryTable = `CREATE TABLE ChatHistory (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        ChatId TEXT,
        GroupId TEXT,
        ChatTitle TEXT,
        ChannelCode TEXT,
        ModelName TEXT,
        UserContent TEXT,
        AssistantContent TEXT,
        ImageList TEXT,
        FileContent TEXT,
        FirstToeknUseTime TEXT,
        LastToeknUseTime TEXT,
        IsTop INTEGER DEFAULT 0,
        CollectionCode TEXT,
        CreatedAt TEXT
      )`;
      db.run(createChatHistoryTable, (err) => {
        if (err) reject(err);
        else {
          inspector.console.log("ChatHistory table created.");
          resolve();
        }
      });
    });
    await new Promise((resolve, reject) => {
      const createCollectionTable = `CREATE TABLE Collection (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        CollectionCode TEXT,
        Name TEXT,
        IsTop INTEGER DEFAULT 0,
        Seq INTEGER
      )`;
      db.run(createCollectionTable, (err) => {
        if (err) reject(err);
        else {
          inspector.console.log("Collection table created.");
          resolve();
        }
      });
    });
    await new Promise((resolve, reject) => {
      const createUsageHistoryTable = `CREATE TABLE UsageHistory (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        GroupId TEXT,
        ModelName TEXT,
        InputTokens INTEGER,
        OutputTokens INTEGER,
        CreatedAt TEXT
      )`;
      db.run(createUsageHistoryTable, (err) => {
        if (err) reject(err);
        else {
          inspector.console.log("UsageHistory table created.");
          resolve();
        }
      });
    });
    await new Promise((resolve, reject) => {
      const createAdvanceSettingsTable = `CREATE TABLE AdvanceSettings (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        Temperature REAL DEFAULT 0.0,
        TopP REAL DEFAULT 1.0,
        MaxTokens INTEGER DEFAULT 2000,
        PresencePenalty REAL DEFAULT 0.0,
        FrequencyPenalty REAL DEFAULT 0.0,
        IsEnable INTEGER DEFAULT 0
      )`;
      db.run(createAdvanceSettingsTable, (err) => {
        if (err) reject(err);
        else {
          inspector.console.log("AdvanceSettings table created.");
          const insertDefaultData = `INSERT INTO AdvanceSettings (Temperature, TopP, MaxTokens, PresencePenalty, FrequencyPenalty, IsEnable) VALUES (?, ?, ?, ?, ?, ?)`;
          db.run(insertDefaultData, [0, 1, 2e3, 0, 0, 0], (err2) => {
            if (err2) reject(err2);
            else {
              inspector.console.log("Default data inserted into AdvanceSettings table.");
              resolve();
            }
          });
        }
      });
    });
    await new Promise((resolve, reject) => {
      const createUserSettingsTable = `CREATE TABLE UserSettings (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        IsStream INTEGER DEFAULT 1,
        IsAutoScroll INTEGER DEFAULT 1,
        ModelAutoChange INTEGER DEFAULT 1,
        HistoryLength INTEGER DEFAULT 5
      )`;
      db.run(createUserSettingsTable, (err) => {
        if (err) reject(err);
        else {
          inspector.console.log("UserSettings table created.");
          const insertDefaultData = `INSERT INTO UserSettings (IsStream, IsAutoScroll, ModelAutoChange, HistoryLength) VALUES (?, ?, ?, ?)`;
          db.run(insertDefaultData, [1, 1, 1, 5], (err2) => {
            if (err2) reject(err2);
            else {
              inspector.console.log("Default data inserted into UserSettings table.");
              resolve();
            }
          });
        }
      });
    });
    await new Promise((resolve, reject) => {
      const createSearchEngineTable = `CREATE TABLE SearchEngine (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        Name TEXT,
        ImagePath TEXT,
        Config TEXT,
        Seq INTEGER
      )`;
      db.run(createSearchEngineTable, (err) => {
        if (err) reject(err);
        else {
          inspector.console.log("SearchEngine table created.");
          const defaultSearchEngines = [
            {
              Name: "Localhost",
              ImagePath: "@renderer/assets/searchengineicon/localhost.svg",
              Config: '{"proxy_port":"7890"}',
              Seq: 1
            },
            {
              Name: "Serper",
              ImagePath: "@renderer/assets/searchengineicon/serper.svg",
              Config: '{"baseurl":"https://google.serper.dev/search","apikey":"xxxxxxxxxx"}',
              Seq: 2
            }
          ];
          const insertDefaultData = `INSERT INTO SearchEngine (Name, ImagePath, Config, Seq) VALUES (?, ?, ?, ?)`;
          Promise.all(defaultSearchEngines.map((engine) => {
            return new Promise((resolveInsert, rejectInsert) => {
              db.run(insertDefaultData, [
                engine.Name,
                engine.ImagePath,
                engine.Config,
                engine.Seq
              ], (err2) => {
                if (err2) rejectInsert(err2);
                else {
                  inspector.console.log(`${engine.Name} search engine data inserted.`);
                  resolveInsert();
                }
              });
            });
          })).then(() => resolve()).catch((error) => reject(error));
        }
      });
    });
  } catch (error) {
    inspector.console.error("Error during database initialization:", error);
  } finally {
    db.close((err) => {
      if (err) {
        inspector.console.error("Error closing database:", err);
      } else {
        inspector.console.log("Database connection closed.");
      }
    });
  }
}
function setupModelSettingHandlers() {
  electron.ipcMain.handle("add-model", async (event, model) => {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(databasePath);
      db.get("SELECT MAX(Seq) as maxSeq FROM Models WHERE ChannelCode = ?", [model.channelCode], (err, row) => {
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
        ], function(err2) {
          if (err2) {
            console.error("数据库错误:", err2);
            db.close();
            reject(err2);
            return;
          }
          db.close();
          resolve({ id: this.lastID });
        });
      });
    });
  });
  electron.ipcMain.handle("add-channel", async (event, channel) => {
    try {
      return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(databasePath);
        db.get("SELECT MAX(Seq) as maxSeq FROM Channels", [], (err, row) => {
          if (err) {
            db.close();
            reject(err);
            return;
          }
          const nextSeq = (row.maxSeq || 0) + 1;
          const sql = `INSERT INTO Channels (ChannelsCode, IconPath, Name, BaseURL, APIKey, IsEnabled, Seq) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`;
          db.run(sql, [
            channel.channelsCode,
            channel.iconData,
            channel.name,
            channel.baseURL,
            channel.apiKey,
            channel.isEnabled ? 1 : 0,
            nextSeq
          ], function(err2) {
            if (err2) {
              reject(err2);
              return;
            }
            resolve({ id: this.lastID });
            db.close();
          });
        });
      });
    } catch (error) {
      console.error("Error adding channel:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("get-channels", async () => {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(databasePath);
      db.all("SELECT * FROM Channels ORDER BY Seq", [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
        db.close();
      });
    });
  });
  electron.ipcMain.handle("get-models", async () => {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(databasePath);
      db.all("SELECT * FROM Models ORDER BY Seq", [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
        db.close();
      });
    });
  });
  electron.ipcMain.handle("get-asset-path", async (event, filePath) => {
    try {
      let absolutePath;
      if (filePath.startsWith("@renderer")) {
        absolutePath = path.join(electron.app.getAppPath(), "src/renderer/src", filePath.replace("@renderer", ""));
      } else if (!path.isAbsolute(filePath)) {
        absolutePath = path.join(electron.app.getAppPath(), filePath);
      } else {
        absolutePath = filePath;
      }
      const data = await fs.promises.readFile(absolutePath);
      const extension = path.extname(absolutePath).toLowerCase();
      const mimeType = {
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif"
      }[extension] || "image/png";
      return `data:${mimeType};base64,${data.toString("base64")}`;
    } catch (error) {
      console.error("Error converting image to base64:", error);
      return "";
    }
  });
  electron.ipcMain.handle("delete-model", async (event, modelId) => {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(databasePath);
      const sql = "DELETE FROM Models WHERE Id = ?";
      db.run(sql, [modelId], function(err) {
        if (err) {
          reject(err);
          console.error("数据库错误:", err);
          return;
        }
        resolve({ success: true });
        db.close();
      });
    });
  });
  electron.ipcMain.handle("update-model", async (event, model) => {
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
      ], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ success: true });
        db.close();
      });
    });
  });
  electron.ipcMain.handle("delete-channel", async (event, channelCode) => {
    const db = new sqlite3.Database(databasePath);
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run("DELETE FROM Models WHERE ChannelCode = ?", [channelCode], (err) => {
          if (err) {
            db.run("ROLLBACK");
            db.close();
            reject(err);
            return;
          }
          db.run("DELETE FROM Channels WHERE ChannelsCode = ?", [channelCode], (err2) => {
            if (err2) {
              db.run("ROLLBACK");
              db.close();
              reject(err2);
              return;
            }
            db.run("COMMIT", (err3) => {
              db.close();
              if (err3) {
                reject(err3);
                return;
              }
              resolve({ success: true });
            });
          });
        });
      });
    });
  });
  electron.ipcMain.handle("update-channel", async (event, channel) => {
    try {
      let iconData = channel.iconPath;
      if (channel.iconData) {
        iconData = channel.iconData;
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
        ], function(err) {
          db.close();
          if (err) {
            reject(err);
            return;
          }
          resolve({ success: true });
        });
      });
    } catch (error) {
      console.error("Error updating channel:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("update-channels-order", async (event, channels) => {
    const db = new sqlite3.Database(databasePath);
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare("UPDATE Channels SET Seq = ? WHERE ChannelsCode = ?");
        let hasError = false;
        channels.forEach((channel, index) => {
          stmt.run([index + 1, channel.ChannelsCode], (err) => {
            if (err && !hasError) {
              hasError = true;
              console.error("更新渠道顺序失败:", err);
              db.run("ROLLBACK");
              db.close();
              reject(err);
            }
          });
        });
        stmt.finalize((err) => {
          if (err && !hasError) {
            db.run("ROLLBACK");
            db.close();
            reject(err);
            return;
          }
          db.run("COMMIT", (err2) => {
            db.close();
            if (err2 && !hasError) {
              reject(err2);
              return;
            }
            resolve({ success: true });
          });
        });
      });
    });
  });
  electron.ipcMain.handle("update-models-order", async (event, models) => {
    const db = new sqlite3.Database(databasePath);
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare("UPDATE Models SET Seq = ? WHERE Id = ?");
        let hasError = false;
        models.forEach((model) => {
          stmt.run([model.Seq, model.Id], (err) => {
            if (err && !hasError) {
              hasError = true;
              console.error("更新模型顺序失败:", err);
              db.run("ROLLBACK");
              db.close();
              reject(err);
            }
          });
        });
        stmt.finalize((err) => {
          if (err && !hasError) {
            db.run("ROLLBACK");
            db.close();
            reject(err);
            return;
          }
          db.run("COMMIT", (err2) => {
            db.close();
            if (err2 && !hasError) {
              reject(err2);
              return;
            }
            resolve({ success: true });
          });
        });
      });
    });
  });
}
function initializeChatServer() {
  electron.ipcMain.handle("get-models-chat", async () => {
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
        const modelList = results.map((row) => ({
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
  electron.ipcMain.handle("get-chat-history", async (event, { page = 1, pageSize = 20, searchKey = "" }) => {
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
      const countQuery = `
        SELECT COUNT(DISTINCT ChatId) as total
        FROM ChatHistory
        WHERE ChatTitle LIKE ? OR UserContent LIKE ? OR AssistantContent LIKE ?
      `;
      db.get(countQuery, [searchPattern, searchPattern, searchPattern], (err, totalRow) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }
        db.all(query, [searchPattern, searchPattern, searchPattern, pageSize, offset], (err2, results) => {
          if (err2) {
            db.close();
            reject(err2);
            return;
          }
          const response = {
            total: totalRow.total,
            page,
            pageSize,
            data: results.map((row) => ({
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
  electron.ipcMain.handle("delete-chat", async (event, chatId) => {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(databasePath);
      const query = `
        DELETE FROM ChatHistory
        WHERE ChatId = ?
      `;
      db.run(query, [chatId], (err) => {
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
  electron.ipcMain.handle("delete-chat-groupId", async (event, groupId) => {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(databasePath);
      const query = `
        DELETE FROM ChatHistory
        WHERE GroupId = ?
      `;
      db.run(query, [groupId], (err) => {
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
  electron.ipcMain.handle("get-chat-detail", async (event, chatId) => {
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
        const chatDetail = results.map((row) => ({
          id: row.Id,
          chatId: row.ChatId,
          groupId: row.GroupId,
          title: row.ChatTitle,
          channelCode: row.ChannelCode,
          modelName: row.ModelName,
          userContent: row.UserContent,
          assistantContent: row.AssistantContent,
          imageList: row.ImageList ? JSON.parse(row.ImageList) : [],
          fileList: row.FileContent ? JSON.parse(row.FileContent).map((fileStr) => JSON.parse(fileStr)) : [],
          isTop: row.IsTop === 1,
          collectionCode: row.CollectionCode,
          createdAt: row.CreatedAt
        }));
        db.close();
        resolve(chatDetail);
      });
    });
  });
  electron.ipcMain.handle("read-file-content", async (event, filePath, fileType) => {
    try {
      const buffer = await promises.readFile(filePath);
      switch (fileType) {
        case "application/pdf":
          const pdfData = await pdf(buffer);
          return pdfData.text;
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          const result = await mammoth.extractRawText({ buffer });
          return result.value;
        default:
          return buffer.toString("utf-8");
      }
    } catch (error) {
      console.error("读取文件失败:", error);
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
    const cleanImageList = Array.isArray(imageList) ? imageList.map((img) => String(img)) : [];
    const serializedImageList = JSON.stringify(cleanImageList);
    const cleanFileList = Array.isArray(fileList) ? fileList : [];
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
    ], function(err) {
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
    db.run(query, [groupId, modelName, inputTokens, outputTokens], function(err) {
      db.close();
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}
function getAdvanceSettings() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath);
    db.get("SELECT * FROM AdvanceSettings LIMIT 1", (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
      db.close();
    });
  });
}
function updateAdvanceSettings(settings) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath);
    const { Temperature, TopP, MaxTokens, PresencePenalty, FrequencyPenalty, IsEnable } = settings;
    db.run(
      "UPDATE AdvanceSettings SET Temperature = ?, TopP = ?, MaxTokens = ?, PresencePenalty = ?, FrequencyPenalty = ?, IsEnable = ? WHERE Id = 1",
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
function registerAdvanceSettingsHandlers() {
  electron.ipcMain.handle("get-advance-settings", async () => {
    try {
      const settings = await getAdvanceSettings();
      return settings;
    } catch (error) {
      console.error("获取高级设置失败:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("update-advance-settings", async (event, settings) => {
    try {
      await updateAdvanceSettings(settings);
      return { success: true };
    } catch (error) {
      console.error("Update settings error:", error);
      throw { message: error.message || "Database operation failed" };
    }
  });
}
function getUserSettings() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath);
    db.get("SELECT * FROM UserSettings LIMIT 1", (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
      db.close();
    });
  });
}
function updateUserSettings(settings) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath);
    const { IsStream, IsAutoScroll, ModelAutoChange, HistoryLength } = settings;
    db.run(
      "UPDATE UserSettings SET IsStream = ?, IsAutoScroll = ?, ModelAutoChange = ?, HistoryLength = ? WHERE Id = 1",
      [IsStream, IsAutoScroll, ModelAutoChange, HistoryLength],
      function(err) {
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
function setupGeneralSettingsHandlers() {
  electron.ipcMain.handle("get-user-settings", async () => {
    try {
      const settings = await getUserSettings();
      return settings;
    } catch (error) {
      console.error("Error getting user settings:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("update-user-settings", async (_, settings) => {
    try {
      const result = await updateUserSettings(settings);
      return result;
    } catch (error) {
      console.error("Error updating user settings:", error);
      throw error;
    }
  });
}
class YahooService {
  constructor(proxyport) {
    this.clientInitialized = false;
    this.clientInitializing = null;
    this.proxyPort = proxyport;
  }
  async ensureClientInitialized() {
    if (this.clientInitialized) return;
    if (!this.clientInitializing) {
      this.clientInitializing = this.initializeClient();
    }
    await this.clientInitializing;
    this.clientInitialized = true;
  }
  async initializeClient() {
    try {
      this.client = axios.create({
        timeout: 1e4,
        httpsAgent: new httpsProxyAgent.HttpsProxyAgent(`http://127.0.0.1:${this.proxyPort}`),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
          "Accept": "text/html,application/xhtml+xml...",
          "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7..."
        }
      });
    } catch (err) {
      console.error("初始化客户端错误:", err);
      this.client = axios.create({
        timeout: 1e4,
        httpsAgent: new httpsProxyAgent.HttpsProxyAgent("http://127.0.0.1:7890"),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
          "Accept": "text/html,application/xhtml+xml...",
          "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7..."
        }
      });
    }
  }
  async search(query) {
    await this.ensureClientInitialized();
    const encodedQuery = encodeURIComponent(query);
    const url = `https://sg.search.yahoo.com/search?p=${encodedQuery}&ei=UTF-8`;
    try {
      const response = await this.client.get(url);
      const html = response.data;
      const result = this.parseResults(html);
      return result;
    } catch (err) {
      console.error("搜索错误:", err.message);
      return {
        code: 500,
        msg: "搜索失败"
      };
    }
  }
  fetchUrl(url) {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          "Host": "sg.search.yahoo.com",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
          "Accept": "text/html,application/xhtml+xml...",
          "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7..."
        }
      };
      https.get(url, options, (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => resolve(data));
      }).on("error", reject);
    });
  }
  parseResults(html) {
    try {
      const titleRegex = /<h3[^>]*class="title"[^>]*>.*?<a[^>]*>(.*?)<\/a>/g;
      const titles = [...html.matchAll(titleRegex)].map((m) => m[1].replace(/<[^>]+>/g, "")).filter((title) => title && !title.includes("Images") && !title.includes("Videos"));
      const contentRegex = /<span class="fc-falcon">(.*?)<\/span>/g;
      const contents = [...html.matchAll(contentRegex)].map((m) => m[1].replace(/<[^>]+>/g, "")).map((content) => content.replace(/&ldquo;|&rdquo;|&hellip;/g, ""));
      const urlRegex = /<h3[^>]*class="title"[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>/g;
      const urls = [...html.matchAll(urlRegex)].map((m) => {
        try {
          const url = new URL(m[1]);
          return url.searchParams.get("RU") || m[1];
        } catch {
          return m[1];
        }
      }).filter((url) => url && !url.includes("/images/") && !url.includes("/video/"));
      const results = [];
      for (let i = 0; i < Math.min(5, titles.length); i++) {
        if (titles[i] && contents[i] && urls[i]) {
          results.push({
            title: titles[i].trim(),
            content: contents[i].trim(),
            url: urls[i].trim()
          });
        }
      }
      return {
        code: 200,
        msg: "获取成功",
        data: results
      };
    } catch (err) {
      console.error("解析错误:", err);
      return {
        code: 500,
        msg: "解析失败",
        data: []
      };
    }
  }
}
class SerperService {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }
  async search(query) {
    try {
      const response = await axios.post(
        this.baseUrl,
        { q: query },
        {
          headers: {
            "X-API-KEY": this.apiKey,
            "Content-Type": "application/json"
          }
        }
      );
      if (response.data && response.data.organic) {
        return {
          code: 200,
          data: response.data.organic.map((item) => ({
            title: item.title,
            url: item.link,
            content: item.snippet
          })),
          msg: "success"
        };
      }
      return {
        code: 500,
        data: null,
        msg: "No results found"
      };
    } catch (error) {
      return {
        code: 500,
        data: null,
        msg: error.message
      };
    }
  }
}
function getPreferredSearchEngine() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath);
    const query = "SELECT * FROM SearchEngine ORDER BY Seq LIMIT 1";
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
function setupSearchEngineHandlers() {
  electron.ipcMain.handle("get-search-engines", async () => {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(databasePath);
      const query = "SELECT * FROM SearchEngine ORDER BY Seq";
      db.all(query, [], (err, rows) => {
        db.close();
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  });
  electron.ipcMain.handle("update-search-engine-config", async (event, data) => {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(databasePath);
      const query = "UPDATE SearchEngine SET Config = ? WHERE Id = ?";
      db.run(query, [data.config, data.id], function(err) {
        db.close();
        if (err) {
          reject(err);
          return;
        }
        resolve({ success: true, changes: this.changes });
      });
    });
  });
  electron.ipcMain.handle("update-search-engines-order", async (event, engines) => {
    const db = new sqlite3.Database(databasePath);
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare("UPDATE SearchEngine SET Seq = ? WHERE Id = ?");
        engines.forEach((engine) => {
          stmt.run([engine.Seq, engine.Id]);
        });
        stmt.finalize();
        db.run("COMMIT", (err) => {
          db.close();
          if (err) {
            reject(err);
            return;
          }
          resolve({ success: true });
        });
      });
    });
  });
}
async function handleWebSearch(toolCalls) {
  if (!toolCalls || !toolCalls.length) return null;
  const searchCall = toolCalls.find((call) => call.function.name === "web_search");
  if (!searchCall) return null;
  try {
    const { keywords } = JSON.parse(searchCall.function.arguments);
    if (!keywords) return null;
    const preferredEngine = await getPreferredSearchEngine();
    if (!preferredEngine) {
      console.error("No preferred search engine found");
      return null;
    }
    const config = JSON.parse(preferredEngine.Config);
    let searchService;
    switch (preferredEngine.Name) {
      case "Localhost":
        searchService = new YahooService(config.proxy_port);
        break;
      case "Serper":
        searchService = new SerperService(config.apikey, config.baseurl);
        break;
      default:
        searchService = new YahooService(config.proxy_port);
    }
    const response = await searchService.search(keywords);
    if (response.code !== 200 || !response.data) {
      console.error("Search failed:", response.msg);
      return null;
    }
    const formattedResults = response.data.map(
      (result) => `Title: ${result.title}
 Url: ${result.url}
 Abstract: ${result.content}
`
    ).join("\n");
    return formattedResults;
  } catch (error) {
    console.error("Search error:", error);
    return null;
  }
}
const webSearchTool = {
  tools: [{
    type: "function",
    function: {
      name: "web_search",
      description: "Generate search keywords based on user queries and perform the search.",
      parameters: {
        type: "object",
        properties: {
          keywords: {
            type: "string",
            description: "Key search terms extracted from user queries."
          }
        },
        required: ["keywords"]
      }
    }
  }],
  tool_choice: {
    type: "function",
    function: { name: "web_search" }
  }
};
class OpenAIService {
  constructor(apiKey, baseURL) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || "https://api.openai.com/v1"
    });
    this.currentSession = null;
  }
  async stopGeneration() {
    if (this.abortController) {
      try {
        this.abortController.abort();
        if (this.currentSession) {
          const { messages, options, accumulatedResponse, totalInputTokens, totalOutputTokens } = this.currentSession;
          const chatId = options.chatId;
          const groupId = options.groupId;
          const channel = options.channel;
          if (accumulatedResponse) {
            const userContent = messages[messages.length - 1].content;
            const imageList = messages.filter((msg) => msg.images && msg.images.length > 0).map((msg) => msg.images).flat();
            const fileList = messages.filter((msg) => msg.files && msg.files.length > 0).map((msg) => msg.files).flat();
            await saveChatHistory(
              chatId,
              groupId,
              userContent,
              accumulatedResponse,
              options.model || "gpt-4o-mini",
              channel,
              imageList,
              fileList
            );
            if (totalInputTokens > 0 && totalOutputTokens > 0) {
              await saveUsageHistory(
                groupId,
                options.model,
                totalInputTokens,
                totalOutputTokens
              );
            } else {
              const model = options.model;
              const enc = await tiktoken__namespace.encodingForModel("gpt-4o");
              try {
                let inputTokens = 0;
                for (const msg of messages) {
                  const content = msg.content;
                  console.log("content:" + content);
                  inputTokens += enc.encode(content).length;
                }
                const outputTokens = enc.encode(accumulatedResponse).length;
                console.log("Calculated tokens:", inputTokens, outputTokens);
                if (inputTokens > 0 || outputTokens > 0) {
                  await saveUsageHistory(
                    groupId,
                    model,
                    inputTokens,
                    outputTokens
                  );
                }
              } finally {
              }
            }
          }
          this.currentSession = null;
        }
        this.abortController = null;
      } catch (error) {
        console.error("Error during stopGeneration:", error);
      } finally {
        this.currentSession = null;
        this.abortController = null;
      }
    }
  }
  async _processSearchResults(searchResults, requestMessages, options) {
    if (!searchResults) return null;
    requestMessages.push({
      role: "user",
      content: `# Language using the user's language.

                      # Current time:${(/* @__PURE__ */ new Date()).toLocaleString()} 

                      # Please answer the user's question based on the search results provided below.

                      # Ensure your response is accurate and objective, citing relevant information from the search results and including links to the sources
                      ：
${searchResults}`
    });
    const completion = await this.client.chat.completions.create({
      model: options.model || "gpt-4o-mini",
      messages: requestMessages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      presence_penalty: options.presencePenalty,
      frequency_penalty: options.frequencyPenalty,
      top_p: options.topP,
      stream: options.stream || false
    });
    return completion;
  }
  async chatCompletion(messages, options = {}) {
    try {
      console.log("Starting chatCompletion with messages:", messages);
      const chatId = options.chatId;
      const groupId = options.groupId;
      const channel = options.channel;
      const requestMessages = messages.map((msg) => this._formatMessage(msg));
      const hasOnlineMessage = messages.some((msg) => msg.online);
      const completion = await this.client.chat.completions.create({
        model: options.model || "gpt-4o-mini",
        messages: requestMessages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        presence_penalty: options.presencePenalty,
        frequency_penalty: options.frequencyPenalty,
        top_p: options.topP,
        ...hasOnlineMessage && webSearchTool
      });
      const userContent = messages[messages.length - 1].content;
      const imageList = messages.filter((msg) => msg.images && msg.images.length > 0).map((msg) => msg.images).flat();
      const fileList = messages.filter((msg) => msg.files && msg.files.length > 0).map((msg) => msg.files).flat();
      let assistantContent = "";
      if (completion.choices[0].message.tool_calls) {
        const searchResults = await handleWebSearch(completion.choices[0].message.tool_calls);
        const newCompletion = await this._processSearchResults(searchResults, requestMessages, options);
        if (newCompletion) {
          assistantContent = newCompletion.choices[0].message.content;
        }
      } else {
        assistantContent = completion.choices[0].message.content;
      }
      await saveChatHistory(
        chatId,
        groupId,
        userContent,
        assistantContent,
        options.model || "gpt-4o-mini",
        channel,
        imageList,
        fileList
      );
      if (completion.usage) {
        await saveUsageHistory(
          groupId,
          options.model,
          completion.usage.prompt_tokens,
          completion.usage.completion_tokens
        );
      }
      return {
        chatId,
        groupId,
        content: assistantContent,
        usage: completion.usage
      };
    } catch (error) {
      console.error("OpenAI API Error:", error);
      throw error;
    }
  }
  async streamChatCompletion(messages, options = {}, onData) {
    this.currentSession = {
      messages,
      options,
      accumulatedResponse: "",
      totalInputTokens: 0,
      totalOutputTokens: 0
    };
    console.log(messages);
    try {
      this.abortController = new AbortController();
      const chatId = options.chatId;
      const groupId = options.groupId;
      const channel = options.channel;
      const hasOnlineMessage = messages.some((msg) => msg.online);
      let accumulatedResponse = "";
      const requestMessages = messages.map((msg) => this._formatMessage(msg));
      console.log("requestMessages:", requestMessages);
      const stream = await this.client.chat.completions.create({
        model: options.model || "gpt-4o-mini",
        messages: requestMessages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        presence_penalty: options.presencePenalty,
        frequency_penalty: options.frequencyPenalty,
        top_p: options.topP,
        stream: true,
        ...hasOnlineMessage && webSearchTool
      });
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let accumulatedToolCalls = /* @__PURE__ */ new Map();
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        const reasoningContent = chunk.choices[0]?.delta?.reasoning_content || "";
        const toolCalls = chunk.choices[0]?.delta?.tool_calls;
        if (toolCalls) {
          for (const toolCall of toolCalls) {
            if (!accumulatedToolCalls.has(toolCall.index)) {
              accumulatedToolCalls.set(toolCall.index, {
                id: toolCall.id,
                function: {
                  name: toolCall.function?.name || "",
                  arguments: ""
                }
              });
            }
            const accumulated = accumulatedToolCalls.get(toolCall.index);
            if (toolCall.function?.arguments) {
              accumulated.function.arguments += toolCall.function.arguments;
            }
            try {
              const json = JSON.parse(accumulated.function.arguments);
              const searchResults = await handleWebSearch([accumulated]);
              if (searchResults) {
                const newStream = await this._processSearchResults(searchResults, requestMessages, { ...options, stream: true });
                for await (const newChunk of newStream) {
                  const newContent = newChunk.choices[0]?.delta?.content || "";
                  if (newContent) {
                    accumulatedResponse += newContent;
                    this.currentSession.accumulatedResponse = accumulatedResponse;
                    onData(newContent, false);
                  }
                  if (newChunk.usage) {
                    totalInputTokens = newChunk.usage.prompt_tokens;
                    totalOutputTokens = newChunk.usage.completion_tokens;
                  }
                }
                accumulatedToolCalls.delete(toolCall.index);
              }
            } catch (e) {
              continue;
            }
          }
        }
        if (content) {
          accumulatedResponse += content;
          this.currentSession.accumulatedResponse = accumulatedResponse;
          onData(content, false);
        }
        if (reasoningContent) {
          accumulatedResponse += reasoningContent;
          this.currentSession.accumulatedResponse = accumulatedResponse;
          onData(reasoningContent, false);
        }
        if (chunk.usage) {
          totalInputTokens = chunk.usage.prompt_tokens;
          totalOutputTokens = chunk.usage.completion_tokens;
        }
      }
      const userContent = messages[messages.length - 1].content;
      const imageList = messages.filter((msg) => msg.images && msg.images.length > 0).map((msg) => msg.images).flat();
      const fileList = messages.filter((msg) => msg.files && msg.files.length > 0).map((msg) => msg.files).flat();
      await saveChatHistory(
        chatId,
        groupId,
        userContent,
        accumulatedResponse,
        options.model || "gpt-4o-mini",
        channel,
        imageList,
        fileList
      );
      if (totalInputTokens > 0 || totalOutputTokens > 0) {
        await saveUsageHistory(
          groupId,
          options.model,
          totalInputTokens,
          totalOutputTokens
        );
      }
      onData("", true);
    } catch (error) {
      console.error("ERROR NAME:", error.name);
      if (error.name === "TypeError") {
        console.log("Request aborted");
        onData("", true);
        return;
      }
      onData(`Error: ${error.message}`, false);
      onData("", true);
      throw error;
    } finally {
      this.abortController = null;
    }
  }
  _formatMessage(msg) {
    if (msg.images && msg.images.length > 0) {
      return {
        role: msg.sender === "user" ? "user" : "assistant",
        content: [
          {
            type: "text",
            text: msg.content + (msg.files && msg.files.length > 0 ? "\nFiles: " + msg.files.map((file) => file.toString()).join(", ") : "")
          },
          ...msg.images.map((img) => ({
            type: "image_url",
            image_url: { url: img }
          }))
        ]
      };
    }
    return {
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.files && msg.files.length > 0 ? msg.content + "\nFiles: " + msg.files.map((file) => file.toString()).join(", ") : msg.content
    };
  }
}
let openaiService = null;
function initOpenAIHandlers() {
  electron.ipcMain.handle("openai:init", (event, { apiKey, baseURL }) => {
    openaiService = new OpenAIService(apiKey, baseURL);
  });
  electron.ipcMain.handle("openai:chat", async (event, { messages, options }) => {
    if (!openaiService) throw new Error("OpenAI service not initialized");
    return await openaiService.chatCompletion(messages, options);
  });
  electron.ipcMain.on("openai:stream-chat", async (event, { messages, options }) => {
    if (!openaiService) {
      event.reply("openai:stream-error", "OpenAI service not initialized");
      return;
    }
    try {
      await openaiService.streamChatCompletion(
        messages,
        options,
        (content, isDone) => {
          event.reply("openai:stream-data", { content, isDone });
        }
      );
    } catch (error) {
      event.reply("openai:stream-error", error.message);
    }
  });
  electron.ipcMain.on("openai:stop-generation", () => {
    if (openaiService) {
      openaiService.stopGeneration();
    }
  });
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    transparent: true,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "rgba(0,0,0,0)",
      height: 35,
      symbolColor: "white"
    },
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(async () => {
  utils.electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.ipcMain.on("ping", () => console.log("pong"));
  await initializeDatabase();
  setupModelSettingHandlers();
  initializeChatServer();
  registerAdvanceSettingsHandlers();
  setupGeneralSettingsHandlers();
  initOpenAIHandlers();
  setupSearchEngineHandlers();
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
