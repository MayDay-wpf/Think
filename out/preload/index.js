"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  openai: {
    invoke: (channel, data) => electron.ipcRenderer.invoke(channel, data),
    send: (channel, data) => electron.ipcRenderer.send(channel, data),
    on: (channel, func) => {
      electron.ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
    off: (channel, func) => {
      electron.ipcRenderer.removeListener(channel, func);
    }
  },
  anthropic: {
    invoke: (channel, data) => electron.ipcRenderer.invoke(channel, data),
    send: (channel, data) => electron.ipcRenderer.send(channel, data),
    on: (channel, func) => {
      electron.ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
    off: (channel, func) => {
      electron.ipcRenderer.removeListener(channel, func);
    }
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
