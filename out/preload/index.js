"use strict";
const electron = require("electron");
const api = {
  getVersion: () => electron.ipcRenderer.invoke("app:getVersion"),
  getApiPort: () => electron.ipcRenderer.invoke("app:getApiPort"),
  getApiUrl: () => electron.ipcRenderer.invoke("app:getApiUrl"),
  printThermal: (base64Data) => electron.ipcRenderer.invoke("print:thermal", base64Data),
  printA4: (pdfBase64) => electron.ipcRenderer.invoke("print:a4", pdfBase64),
  saveFile: (defaultName, data) => electron.ipcRenderer.invoke("dialog:saveFile", defaultName, data)
};
electron.contextBridge.exposeInMainWorld("electronAPI", api);
