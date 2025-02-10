import { autoUpdater } from 'electron-updater'
import { ipcMain, app, BrowserWindow, dialog } from 'electron'
import log from 'electron-log'

export class UpdateHandler {
    constructor(mainWindow) {
        this.mainWindow = mainWindow
    
        // 配置自动更新
        autoUpdater.autoDownload = false
        autoUpdater.autoInstallOnAppQuit = true
        autoUpdater.allowDowngrade = false
        autoUpdater.logger = console
        
        // 开发环境下强制启用更新检查
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
            console.error('更新错误:', err)
            this.sendStatusToWindow('error', {
                message: err.message,
                code: err.code,
                stack: err.stack
            })
        })

        // 检查更新
        autoUpdater.on('checking-for-update', () => {
            log.info('检查更新中...')
            console.log('检查更新中...')
            this.sendStatusToWindow('checking')
        })

        // 有可用更新
        autoUpdater.on('update-available', (info) => {
            log.info('发现新版本:', info)
            console.log('发现新版本:', info.version)
            // 确保数据格式正确
            const updateData = {
                version: info.version,
                releaseNotes: info.releaseNotes || '',
                releaseDate: info.releaseDate || new Date().toISOString()
            }
            log.info('发送更新状态到渲染进程:', updateData)
            this.sendStatusToWindow('available', updateData)
        })

        // 没有可用更新
        autoUpdater.on('update-not-available', (info) => {
            log.info('当前已是最新版本')
            console.log('当前已是最新版本')
            this.sendStatusToWindow('not-available', info)
        })

        // 更新下载进度
        autoUpdater.on('download-progress', (progressObj) => {
            log.info('下载进度:', progressObj)
            console.log('下载进度:', progressObj)
            this.sendStatusToWindow('progress', {
                percent: progressObj.percent,
                transferred: progressObj.transferred,
                total: progressObj.total,
                bytesPerSecond: progressObj.bytesPerSecond,
                delta: progressObj.delta
            })
        })

        // 更新下载完成
        autoUpdater.on('update-downloaded', (info) => {
            log.info('更新下载完成，准备安装', info)
            console.log('更新下载完成，准备安装', info)
            this.sendStatusToWindow('downloaded', {
                version: info.version,
                releaseNotes: info.releaseNotes,
                releaseDate: info.releaseDate
            })
        })

        // 监听来自渲染进程的检查更新请求
        ipcMain.handle('check-for-updates', async () => {
            try {
                // 添加环境信息日志
                log.info('当前环境:', {
                    isDev: process.env.NODE_ENV === 'development',
                    version: app.getVersion(),
                    platform: process.platform,
                    arch: process.arch
                })
                
                // 检查更新配置
                log.info('更新配置:', {
                    feedURL: autoUpdater.getFeedURL(),
                    forceDevUpdateConfig: autoUpdater.forceDevUpdateConfig,
                    allowDowngrade: autoUpdater.allowDowngrade
                })
                
                const updateCheckResult = await autoUpdater.checkForUpdates()
                log.info('检查更新结果:', updateCheckResult)
                return updateCheckResult
            } catch (error) {
                log.error('检查更新失败:', {
                    message: error.message,
                    code: error.code,
                    stack: error.stack,
                    name: error.name
                })
                throw error
            }
        })

        // 监听来自渲染进程的开始下载请求
        ipcMain.handle('start-download', async () => {
            try {
                log.info('开始下载更新...')
                console.log('开始下载更新...')
                log.info('下载配置信息:', {
                    autoDownload: autoUpdater.autoDownload,
                    downloadPath: app.getPath('downloads'),
                    feedURL: autoUpdater.getFeedURL()
                })
                const result = await autoUpdater.downloadUpdate()
                log.info('下载操作返回结果:', result)
                return result
            } catch (error) {
                log.error('下载更新失败:', error)
                console.error('下载更新失败:', error)
                throw {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                }
            }
        })

        ipcMain.handle('show-message-box', async (event, options) => {
            return dialog.showMessageBox(BrowserWindow.getFocusedWindow(), options)
        })
        
        // 添加关闭所有窗口的处理
        ipcMain.handle('close-all-windows', () => {
            BrowserWindow.getAllWindows().forEach(window => {
                window.close()
            })
        })
        
        // 修改安装更新的处理
        ipcMain.handle('quit-and-install', () => {
            try {
                log.info('开始执行安装更新...')
                console.log('开始执行安装更新...')
                
                // 强制立即安装
                autoUpdater.quitAndInstall(true, true)
            } catch (error) {
                log.error('安装更新失败:', error)
                console.error('安装更新失败:', error)
                throw error
            }
        })

        ipcMain.handle('get-app-version', () => {
            return app.getVersion()
        })
    }

    sendStatusToWindow(status, data) {
        try {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                log.info('准备发送状态到窗口:', { status, data })
                this.mainWindow.webContents.send('update-status', { 
                    status, 
                    data: data || {} 
                })
                log.info('状态发送完成')
            } else {
                log.warn('主窗口不可用，无法发送状态')
            }
        } catch (error) {
            log.error('发送更新状态失败:', error)
            console.error('发送更新状态失败:', error)
        }
    }
}