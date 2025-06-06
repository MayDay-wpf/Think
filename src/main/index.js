import { app, shell, BrowserWindow, ipcMain, desktopCapturer, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initializeDatabase } from './databaseServer'
import { setupModelSettingHandlers } from './modelsettings'
import { initializeChatServer } from './chatServer'
import { registerAdvanceSettingsHandlers } from './advanceSettings'
import { setupGeneralSettingsHandlers } from './generalSettings'
import { initOpenAIHandlers } from './ai/ipc/openai'
import { initAnthropicHandlers } from './ai/ipc/anthropic'
import { setupSearchEngineHandlers } from './searchengineSetting'
import { getModelTokensStatistics, getDailyTokensStatistics } from './statistics'
import { UpdateHandler } from './updater'
import Screenshots from 'electron-screenshots'

let updateHandler = null;
function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    show: false,
    transparent: true,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: 'rgba(0,0,0,0)',
      height: 35,
      symbolColor: 'white'
    },
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  // 初始化更新处理器
  if (!updateHandler) {
    updateHandler = new UpdateHandler(mainWindow);
  }
}
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
  // 初始化数据库
  await initializeDatabase()
  // 设置模型设置处理程序
  setupModelSettingHandlers()
  // 初始化聊天处理器
  initializeChatServer()
  // 注册高级设置处理程序
  registerAdvanceSettingsHandlers()
  // 设置通用设置处理程序
  setupGeneralSettingsHandlers()
  // 初始化 OpenAI 处理程序
  initOpenAIHandlers()
  // 初始化 Anthropic 处理程序
  initAnthropicHandlers()
  // 设置搜索引擎处理程序
  setupSearchEngineHandlers()
  // 获取模型统计信息
  getModelTokensStatistics()
  getDailyTokensStatistics()
  // Create window
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('open-external-link', async (event, url) => {
  try {
    await shell.openExternal(url);
  } catch (error) {
    console.error('Failed to open external link:', error);
    throw error;
  }
});

let captureArea = null;

ipcMain.handle('select-capture-area', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  // 始终隐藏窗口
  win.hide();

  try {
    const screenshots = new Screenshots();
    const result = await new Promise((resolve) => {
      screenshots.on('ok', (e, buffer, bounds) => {
        resolve(bounds);
      });
      screenshots.on('cancel', () => {
        resolve(null);
      });
      screenshots.startCapture();
    });

    // 截图完成后显示窗口
    win.show();

    if (!result) return null;

    captureArea = {
      x: Math.round(result.bounds.x),
      y: Math.round(result.bounds.y),
      width: Math.round(result.bounds.width),
      height: Math.round(result.bounds.height)
    };

    return captureArea;
  } catch (error) {
    console.error('Area selection error:', error);
    win.show();
    throw error;
  }
});

ipcMain.handle('capture-selected-area', async (event, option) => {
  if (!captureArea) return null;

  try {
    // 获取发送事件的窗口
    const win = BrowserWindow.fromWebContents(event.sender);
    // 临时隐藏窗口进行截图
    if (option.hideWindow) {
      win.hide();
    }
    await new Promise(resolve => setTimeout(resolve, 100)); // 等待窗口完全隐藏
    const displays = screen.getAllDisplays();
    const targetDisplay = displays.find(display => {
      const bounds = display.bounds;
      return (
        captureArea.x >= bounds.x &&
        captureArea.y >= bounds.y &&
        captureArea.x + captureArea.width <= bounds.x + bounds.width &&
        captureArea.y + captureArea.height <= bounds.y + bounds.height
      );
    });

    if (!targetDisplay) return null;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: targetDisplay.bounds.width,
        height: targetDisplay.bounds.height
      }
    });

    const targetSource = sources.find(source =>
      source.display_id === targetDisplay.id.toString()
    );

    if (!targetSource) return null;

    const tempWin = new BrowserWindow({
      show: false,
      width: captureArea.width,    // 设置为选区宽度
      height: captureArea.height,  // 设置为选区高度
      webPreferences: {
        offscreen: true,
        backgroundThrottling: false
      }
    });

    // 使用 HTML 设置图片大小和样式，避免滚动条
    const html = `
      <html>
        <body style="margin: 0; overflow: hidden;">
          <img src="${targetSource.thumbnail.toDataURL()}" 
               style="position: absolute; 
                      left: ${-1 * (captureArea.x - targetDisplay.bounds.x)}px;
                      top: ${-1 * (captureArea.y - targetDisplay.bounds.y)}px;
                      width: ${targetDisplay.bounds.width}px;
                      height: ${targetDisplay.bounds.height}px;">
        </body>
      </html>
    `;

    await tempWin.loadURL(`data:text/html,${encodeURIComponent(html)}`);
    await new Promise(resolve => setTimeout(resolve, 200));

    const image = await tempWin.webContents.capturePage();
    tempWin.destroy();
    if (option.hideWindow) {
      win.show();
    }
    return image.toDataURL();
  } catch (error) {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (option.hideWindow) {
      win.show();
    }
    console.error('Capture error:', error);
    throw error;
  }
});

ipcMain.handle('clear-capture-area', () => {
  captureArea = null;
  return true;
});
// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
