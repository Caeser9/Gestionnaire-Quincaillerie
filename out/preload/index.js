"use strict";
const electron = require("electron");
const api = {
  getVersion: () => electron.ipcRenderer.invoke("app:getVersion"),
  getApiPort: () => electron.ipcRenderer.invoke("app:getApiPort"),
  getApiUrl: () => electron.ipcRenderer.invoke("app:getApiUrl"),
  printThermal: (base64Data) => electron.ipcRenderer.invoke("print:thermal", base64Data),
  printA4: (pdfBase64) => electron.ipcRenderer.invoke("print:a4", pdfBase64),
  saveFile: (defaultName, data) => electron.ipcRenderer.invoke("dialog:saveFile", defaultName, data),
  getLicenseStatus: () => electron.ipcRenderer.invoke("license:getStatus"),
  getLicenseMachineId: () => electron.ipcRenderer.invoke("license:getMachineId"),
  getLicenseModules: () => electron.ipcRenderer.invoke("license:getModules"),
  activateLicense: (params) => electron.ipcRenderer.invoke("license:activate", params),
  verifyLicense: () => electron.ipcRenderer.invoke("license:verify"),
  transferLicense: () => electron.ipcRenderer.invoke("license:transfer"),
  clearLicense: () => electron.ipcRenderer.invoke("license:clear"),
  getPendingActivation: () => electron.ipcRenderer.invoke("license:getPending"),
  retryPendingActivation: () => electron.ipcRenderer.invoke("license:retryPending")
};
electron.contextBridge.exposeInMainWorld("electronAPI", api);
