import sqlite3 from 'sqlite3';
import fs from 'fs';
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join, extname, isAbsolute } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { console } from 'inspector';
const databaseDir = is.dev
  ? join(app.getAppPath(), 'src', 'database')
  : join(process.resourcesPath, 'database');

const databasePath = join(databaseDir, 'ify.db');
async function initializeDatabase() {

  // 检查数据库目录是否存在，不存在则创建
  if (!fs.existsSync(databaseDir)) {
    fs.mkdirSync(databaseDir, { recursive: true });
    console.log(`Database directory created at: ${databaseDir}`);
  }

  // 检查数据库文件是否存在
  if (fs.existsSync(databasePath)) {
    console.log('Database already exists. Skipping initialization.');
    return;
  }

  console.log('Database does not exist. Creating...');

  const db = new sqlite3.Database(databasePath, (err) => {
    if (err) {
      console.error('Error creating database:', err.message);
      return;
    }
    console.log('Connected to the ify.db database.');
  });

  try {
    // 创建Channels表
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
          IconPath: '@renderer/assets/icons/deepseek.svg',
          Name: 'DeepSeek',
          Code: 'deepseek',
          BaseURL: 'https://api.deepseek.com/v1',
          APIKey: 'sz-xxxxxxxxxx',
          IsEnabled: 1,
          Seq: 1
        },
        {
          IconPath: '@renderer/assets/icons/siliconcloud.svg',
          Name: 'SiliconFlow',
          Code: 'siliconflow',
          BaseURL: 'https://api.siliconflow.cn/v1',
          APIKey: 'sz-xxxxxxxxxx',
          IsEnabled: 1,
          Seq: 2
        },
        {
          IconPath: '@renderer/assets/icons/qwen.svg',
          Name: 'Qwen',
          Code: 'qwen',
          BaseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
          APIKey: 'sz-xxxxxxxxxx',
          IsEnabled: 1,
          Seq: 3
        },
        {
          IconPath: '@renderer/assets/icons/gemini.svg',
          Name: 'Gemini',
          Code: 'gemini',
          BaseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
          APIKey: 'sz-xxxxxxxxxx',
          IsEnabled: 1,
          Seq: 4
        },
        {
          IconPath: '@renderer/assets/icons/anthropic.svg',
          Name: 'Anthropic',
          Code: 'anthropic',
          BaseURL: 'https://api.anthropic.com',
          APIKey: 'sz-xxxxxxxxxx',
          IsEnabled: 1,
          Seq: 5
        },
        {
          IconPath: '@renderer/assets/icons/openai.svg',
          Name: 'OpenAI',
          Code: 'openai',
          BaseURL: 'https://api.openai.com/v1',
          APIKey: 'sz-xxxxxxxxxx',
          IsEnabled: 1,
          Seq: 6
        },
        {
          IconPath: '@renderer/assets/icons/ollama.svg',
          Name: 'Ollama',
          Code: 'ollama',
          BaseURL: 'http://localhost:11434/v1',
          APIKey: '',
          IsEnabled: 1,
          Seq: 7
        }
      ];

      db.run(createChannelsTable, async (err) => {
        if (err) reject(err);
        else {
          console.log('Channels table created.');
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
                ], (err) => {
                  if (err) rejectInsert(err);
                  else {
                    console.log(`${channel.Name} channel data inserted.`);
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

    // 创建Models表
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
          ChannelCode: 'openai',
          Nick: 'ChatGPT4O-Mini',
          Name: 'gpt-4o-mini',
          OverWriteBaseURL: '',
          OverWriteAPIKey: '',
          IsEnabled: 1,
          IsVisionModel: 1,
          Seq: 1
        },
        {
          ChannelCode: 'openai',
          Nick: 'ChatGPT4O-Latest',
          Name: 'chatgpt-4o-latest',
          OverWriteBaseURL: '',
          OverWriteAPIKey: '',
          IsEnabled: 1,
          IsVisionModel: 1,
          Seq: 2
        },
        {
          ChannelCode: 'openai',
          Nick: 'O1-Mini',
          Name: 'o1-mini',
          OverWriteBaseURL: '',
          OverWriteAPIKey: '',
          IsEnabled: 1,
          IsVisionModel: 0,
          Seq: 3
        },
        {
          ChannelCode: 'openai',
          Nick: 'O1-Preview',
          Name: 'o1-preview',
          OverWriteBaseURL: '',
          OverWriteAPIKey: '',
          IsEnabled: 1,
          IsVisionModel: 0,
          Seq: 4
        },
        {
          ChannelCode: 'deepseek',
          Nick: 'DeepSeek-Chat',
          Name: 'deepseek-chat',
          OverWriteBaseURL: '',
          OverWriteAPIKey: '',
          IsEnabled: 1,
          IsVisionModel: 0,
          Seq: 1
        },
        {
          ChannelCode: 'deepseek',
          Nick: 'DeepSeek-R1',
          Name: 'deepseek-reasoner',
          OverWriteBaseURL: '',
          OverWriteAPIKey: '',
          IsEnabled: 1,
          IsVisionModel: 0,
          Seq: 2
        }
      ];

      db.run(createModelsTable, async (err) => {
        if (err) reject(err);
        else {
          console.log('Models table created.');
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
                ], (err) => {
                  if (err) rejectInsert(err);
                  else {
                    console.log(`${model.Nick} model data inserted.`);
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

    // 创建ChatHistory表
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
          console.log('ChatHistory table created.');
          resolve();
        }
      });
    });

    // 创建Collection表
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
          console.log('Collection table created.');
          resolve();
        }
      });
    });

    // 创建UsageHistory表
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
          console.log('UsageHistory table created.');
          resolve();
        }
      });
    });

    // 创建AdvanceSettings表
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
          console.log('AdvanceSettings table created.');
          const insertDefaultData = `INSERT INTO AdvanceSettings (Temperature, TopP, MaxTokens, PresencePenalty, FrequencyPenalty, IsEnable) VALUES (?, ?, ?, ?, ?, ?)`;
          db.run(insertDefaultData, [0.0, 1.0, 2000, 0.0, 0.0, 0], (err) => {
            if (err) reject(err);
            else {
              console.log('Default data inserted into AdvanceSettings table.');
              resolve();
            }
          });
        }
      });
    });

    // 创建UserSettings表
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
          console.log('UserSettings table created.');
          const insertDefaultData = `INSERT INTO UserSettings (IsStream, IsAutoScroll, ModelAutoChange, HistoryLength) VALUES (?, ?, ?, ?)`;
          db.run(insertDefaultData, [1, 1, 1, 5], (err) => {
            if (err) reject(err);
            else {
              console.log('Default data inserted into UserSettings table.');
              resolve();
            }
          });
        }
      });
    });

    // 创建SearchEngine表
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
          console.log('SearchEngine table created.');
          const defaultSearchEngines = [
            {
              Name: 'Localhost',
              ImagePath: '@renderer/assets/searchengineicon/localhost.svg',
              Config: '{"proxy_port":"7890","count":"5"}',
              Seq: 1
            },
            {
              Name: 'Serper',
              ImagePath: '@renderer/assets/searchengineicon/serper.svg',
              Config: '{"baseurl":"https://google.serper.dev/search","apikey":"xxxxxxxxxx"}',
              Seq: 2
            }
          ];

          const insertDefaultData = `INSERT INTO SearchEngine (Name, ImagePath, Config, Seq) VALUES (?, ?, ?, ?)`;

          Promise.all(defaultSearchEngines.map(engine => {
            return new Promise((resolveInsert, rejectInsert) => {
              db.run(insertDefaultData, [
                engine.Name,
                engine.ImagePath,
                engine.Config,
                engine.Seq
              ], (err) => {
                if (err) rejectInsert(err);
                else {
                  console.log(`${engine.Name} search engine data inserted.`);
                  resolveInsert();
                }
              });
            });
          }))
            .then(() => resolve())
            .catch(error => reject(error));
        }
      });
    });


  } catch (error) {
    console.error('Error during database initialization:', error);
  } finally {
    // 统一在最后关闭数据库连接
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed.');
      }
    });
  }
}
export { initializeDatabase, databasePath };