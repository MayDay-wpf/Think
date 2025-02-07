import { autoUpdater } from 'electron-updater'
import { ipcMain } from 'electron'

export class UpdateHandler {
    constructor(mainWindow) {
        this.mainWindow = mainWindow
        if (process.env.NODE_ENV === 'development') {
            autoUpdater.forceDevUpdateConfig = true
        }
        // 配置更新服务器地址
        autoUpdater.setFeedURL({
            provider: 'github',
            owner: 'MayDay-wpf',
            repo: 'Think'
        })

        // 检查更新错误
        autoUpdater.on('error', (err) => {
            this.sendStatusToWindow('error', err)
        })

        // 检查更新
        autoUpdater.on('checking-for-update', () => {
            this.sendStatusToWindow('checking')
        })

        // 有可用更新
        autoUpdater.on('update-available', (info) => {
            this.sendStatusToWindow('available', info)
        })

        // 没有可用更新
        autoUpdater.on('update-not-available', (info) => {
            this.sendStatusToWindow('not-available', info)
        })

        // 更新下载进度
        autoUpdater.on('download-progress', (progressObj) => {
            this.sendStatusToWindow('progress', progressObj)
        })

        // 更新下载完成
        autoUpdater.on('update-downloaded', (info) => {
            this.sendStatusToWindow('downloaded', info)
        })

        // 监听来自渲染进程的检查更新请求
        ipcMain.handle('check-for-updates', () => {
            autoUpdater.checkForUpdates()
        })

        // 监听来自渲染进程的安装更新请求
        ipcMain.handle('quit-and-install', () => {
            autoUpdater.quitAndInstall()
        })

        ipcMain.handle('start-download', () => {
            autoUpdater.downloadUpdate()
        })
    }

    sendStatusToWindow(status, data) {
        this.mainWindow.webContents.send('update-status', { status, data })
    }
}