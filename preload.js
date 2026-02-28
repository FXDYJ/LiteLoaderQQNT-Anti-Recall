const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("anti_recall", {
    clearDb: () => ipcRenderer.invoke("LiteLoader.anti_recall.clearDb"),
    getNowConfig: () =>
        ipcRenderer.invoke("LiteLoader.anti_recall.getNowConfig"),
    saveConfig: (config) =>
        ipcRenderer.invoke("LiteLoader.anti_recall.saveConfig", config),
    getStats: () =>
        ipcRenderer.invoke("LiteLoader.anti_recall.getStats"),
    getDetailedStats: () =>
        ipcRenderer.invoke("LiteLoader.anti_recall.getDetailedStats"),
    getRecalledByPeer: (peerUid, limit, offset) =>
        ipcRenderer.invoke("LiteLoader.anti_recall.getRecalledByPeer", peerUid, limit, offset),
    searchRecalled: (keyword, limit, offset) =>
        ipcRenderer.invoke("LiteLoader.anti_recall.searchRecalled", keyword, limit, offset),
    getAllRecalled: (limit, offset) =>
        ipcRenderer.invoke("LiteLoader.anti_recall.getAllRecalled", limit, offset),
    getPeersWithRecalls: () =>
        ipcRenderer.invoke("LiteLoader.anti_recall.getPeersWithRecalls"),
    repatchCss: (callback) =>
        ipcRenderer.on(
            "LiteLoader.anti_recall.mainWindow.repatchCss",
            callback
        ),
    recallTip: (callback) =>
        ipcRenderer.on("LiteLoader.anti_recall.mainWindow.recallTip", callback),
    recallTipList: (callback) =>
        ipcRenderer.on(
            "LiteLoader.anti_recall.mainWindow.recallTipList",
            callback
        ),
});
