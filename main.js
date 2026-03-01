const fs = require("fs");
const path = require("path");
const { app, ipcMain, dialog } = require("electron");
const { ImgDownloader } = require("./imgDownloader.js");
const { Database, MemoryDatabase } = require("./database.js");

var configFilePath = "";
var pluginDataDir = path.join(LiteLoader.path.data, "anti_recall");

const imgDownloader = new ImgDownloader();
var db = null;
var myUid = "";
var cleanupCounter = 0;
const CLEANUP_INTERVAL = 100; // Only check cleanup every N messages

const EMPTY_STATS = { totalMessages: 0, totalRecalled: 0, totalFiles: 0, totalFileSize: 0, dbSize: 0 };

// ---- In-memory log buffer for diagnostics ----
const LOG_MAX_ENTRIES = 500;
var logBuffer = [];

function addLog(level, ...args) {
  const entry = {
    time: new Date().toISOString(),
    level: level,
    message: args.map(a => {
      if (a instanceof Error) return a.stack || a.message;
      if (typeof a === "object") { try { return JSON.stringify(a); } catch (_) { return String(a); } }
      return String(a);
    }).join(" "),
  };
  logBuffer.push(entry);
  if (logBuffer.length > LOG_MAX_ENTRIES) {
    logBuffer = logBuffer.slice(logBuffer.length - LOG_MAX_ENTRIES);
  }
}

var sampleConfig = {
  mainColor: "#ff6d6d",
  saveDb: true,
  enableShadow: true,
  enableTip: true,
  isAntiRecallSelfMsg: false,
  maxMsgSaveLimit: 50000,
  deleteMsgCountPerTime: 2000,
  maxFileSaveSizeMB: 50,
  maxFileSaveLimit: 5000,
  deleteFileCountPerTime: 500,
  saveMediaImmediately: true,
  showRecaller: true,
};

var nowConfig = {};

function initConfig() {
  fs.writeFileSync(
    configFilePath,
    JSON.stringify(sampleConfig, null, 2),
    "utf-8"
  );
}

function loadConfig() {
  if (!fs.existsSync(configFilePath)) {
    addLog("INFO", "Config file not found, creating default config at:", configFilePath);
    initConfig();
    return { ...sampleConfig };
  } else {
    try {
      const loaded = JSON.parse(fs.readFileSync(configFilePath, "utf-8"));
      addLog("INFO", "Config loaded successfully from:", configFilePath);
      // Merge with defaults for any missing keys
      return { ...sampleConfig, ...loaded };
    } catch (e) {
      addLog("ERROR", "Config parse error, using defaults:", e.message);
      output("Config parse error, using defaults:", e.message);
      return { ...sampleConfig };
    }
  }
}

function saveConfig() {
  fs.writeFileSync(configFilePath, JSON.stringify(nowConfig, null, 2), "utf-8");
}

onLoad();

async function onLoad() {
  addLog("INFO", "Plugin loading... data dir:", pluginDataDir);
  if (!fs.existsSync(pluginDataDir)) {
    fs.mkdirSync(pluginDataDir, { recursive: true });
    addLog("INFO", "Created plugin data directory:", pluginDataDir);
  }
  configFilePath = path.join(pluginDataDir, "config.json");
  nowConfig = loadConfig();
  saveConfig();

  // Initialize SQLite database
  if (nowConfig.saveDb) {
    try {
      addLog("INFO", "Initializing SQLite database...");
      db = new Database(pluginDataDir);
      db.open();
      addLog("INFO", "SQLite database opened successfully. Path:", db.dbPath);
      output("SQLite database opened successfully.");
    } catch (e) {
      addLog("ERROR", "Failed to open SQLite database:", e.stack || e.message);
      addLog("WARN", "Falling back to in-memory database. Anti-recall will work but stored messages will be lost on restart.");
      output("SQLite unavailable, using in-memory fallback. Anti-recall still works.");
      try {
        db = new MemoryDatabase(pluginDataDir);
        db.open();
        addLog("INFO", "In-memory fallback database initialized successfully.");
      } catch (e2) {
        addLog("ERROR", "Failed to initialize in-memory fallback:", e2.stack || e2.message);
        db = null;
      }
    }
  } else {
    addLog("INFO", "Database saving is disabled in config (saveDb=false).");
  }

  // Configure image downloader for immediate file saving
  const mediaSaveDir = path.join(pluginDataDir, "media");
  if (!fs.existsSync(mediaSaveDir)) {
    fs.mkdirSync(mediaSaveDir, { recursive: true });
  }
  imgDownloader.configure({
    saveDir: mediaSaveDir,
    maxFileSizeMB: nowConfig.maxFileSaveSizeMB,
    db: db,
    accountId: myUid,
  });

  // ---- IPC Handlers ----

  ipcMain.handle(
    "LiteLoader.anti_recall.getNowConfig",
    async (event, message) => {
      return nowConfig;
    }
  );

  ipcMain.handle("LiteLoader.anti_recall.saveConfig", async (event, config) => {
    nowConfig = { ...sampleConfig, ...config };
    sendChatWindowsMessage("LiteLoader.anti_recall.mainWindow.repatchCss");
    saveConfig();

    // Update downloader config
    imgDownloader.configure({
      maxFileSizeMB: nowConfig.maxFileSaveSizeMB,
      db: db,
      accountId: myUid,
    });
  });

  ipcMain.handle("LiteLoader.anti_recall.clearDb", async (event, message) => {
    return new Promise((resolve) => {
      dialog
        .showMessageBox({
          type: "warning",
          title: "警告",
          message: "清空所有已储存的撤回消息后不可恢复，是否确认清空？",
          buttons: ["确定", "取消"],
          cancelId: 1,
        })
        .then(async (idx) => {
          if (idx.response == 0) {
            if (db) {
              db.clearAll(myUid || "");
            }
            dialog.showMessageBox({
              type: "info",
              title: "提示",
              message: "清空完毕，之前保存的所有已撤回消息均被删除。",
              buttons: ["确定"],
            });
          }
          resolve();
        });
    });
  });

  ipcMain.handle("LiteLoader.anti_recall.getStats", async () => {
    if (!db) return EMPTY_STATS;
    return db.getStats(myUid || "");
  });

  ipcMain.handle("LiteLoader.anti_recall.getDetailedStats", async () => {
    if (!db) return EMPTY_STATS;
    return db.getDetailedStats(myUid || "");
  });

  ipcMain.handle("LiteLoader.anti_recall.getRecalledByPeer", async (event, peerUid, limit, offset) => {
    if (!db) return [];
    return db.getRecalledByPeer(peerUid, myUid || "", limit || 50, offset || 0);
  });

  ipcMain.handle("LiteLoader.anti_recall.searchRecalled", async (event, keyword, limit, offset) => {
    if (!db) return [];
    return db.searchRecalled(myUid || "", keyword, limit || 50, offset || 0);
  });

  ipcMain.handle("LiteLoader.anti_recall.getAllRecalled", async (event, limit, offset) => {
    if (!db) return [];
    return db.getAllRecalled(myUid || "", limit || 50, offset || 0);
  });

  ipcMain.handle("LiteLoader.anti_recall.getPeersWithRecalls", async () => {
    if (!db) return [];
    return db.getPeersWithRecalls(myUid || "");
  });

  ipcMain.handle("LiteLoader.anti_recall.getLogs", async () => {
    return logBuffer.slice();
  });

  ipcMain.handle("LiteLoader.anti_recall.getDiagnostics", async () => {
    return {
      pluginDataDir: pluginDataDir,
      configFilePath: configFilePath,
      dbPath: db ? db.dbPath : path.join(pluginDataDir, "anti_recall.db"),
      dbInitialized: !!db,
      dbIsMemoryFallback: db ? !!db._isMemory : false,
      dbFileExists: fs.existsSync(path.join(pluginDataDir, "anti_recall.db")),
      saveDbEnabled: nowConfig.saveDb,
      myUid: myUid || "(not captured yet)",
      configLoaded: Object.keys(nowConfig).length > 0,
      totalLogEntries: logBuffer.length,
    };
  });

  app.on("quit", async () => {
    output("Closing db...");
    if (db) {
      db.close();
    }
  });
}

function sendChatWindowsMessage(message, ...args) {
  for (var window of mainWindowObjs) {
    if (window.isDestroyed()) continue;
    window.webContents.send(message, ...args);
  }
}

var mainWindowObjs = [];

/**
 * Extract recaller information from a revokeElement.
 * @returns {{ uid: string, name: string }}
 */
function extractRecallerInfo(revokeElement) {
  let uid = "";
  let name = "";
  if (!revokeElement) return { uid, name };

  // Try to get recaller from wording list (group recall by admin)
  if (Array.isArray(revokeElement.wording)) {
    for (const w of revokeElement.wording) {
      if (w && w.userUid) {
        uid = w.userUid;
        name = w.userNick || w.userName || "";
        break;
      }
    }
  }
  // Fallback to operator info
  if (!uid && revokeElement.operatorUid) {
    uid = revokeElement.operatorUid;
    name = revokeElement.operatorNick || "";
  }
  // Fallback: try origMsgSenderUid
  if (!uid && revokeElement.origMsgSenderUid) {
    uid = revokeElement.origMsgSenderUid;
  }
  return { uid, name };
}

function onBrowserWindowCreated(window) {
  window.webContents.on("did-stop-loading", () => {
    //只针对主界面和独立聊天界面生效
    if (
      window.webContents.getURL().indexOf("#/main/message") != -1 ||
      window.webContents.getURL().indexOf("#/chat") != -1
    ) {
      mainWindowObjs.push(window);

      const original_send =
        (window.webContents.__qqntim_original_object &&
          window.webContents.__qqntim_original_object.send) ||
        window.webContents.send;

      const patched_send = async function (channel, ...args) {
        try {
          if (args.length >= 2) {
            //MessageList IPC 中能看到消息全量更新内容
            if (
              args.some(
                (item) =>
                  item &&
                  item.hasOwnProperty("msgList") &&
                  item.msgList != null &&
                  item.msgList instanceof Array &&
                  item.msgList.length > 0
              )
            ) {
              var currentMsgPeer = "";
              var needUpdateIdx = [];

              for (let idx in args[1].msgList) {
                let item = args[1].msgList[idx];
                currentMsgPeer = item.peerUid;
                if (item.msgType == 5 && item.subMsgType == 4) {
                  if (
                    item.elements[0].grayTipElement != null &&
                    item.elements[0].grayTipElement.revokeElement != null &&
                    (nowConfig.isAntiRecallSelfMsg ||
                      !item.elements[0].grayTipElement.revokeElement.isSelfOperate)
                  ) {
                    needUpdateIdx.push(idx);
                  }
                }
              }

              needUpdateIdx.sort((a, b) => b - a);

              for (let i of needUpdateIdx) {
                let recallTipMsg = args[1].msgList[i];
                let currMsgId = recallTipMsg.msgId;

                // Try to get message from database
                let dbMsg = db ? db.getMessage(currMsgId, myUid || "") : null;

                let originalMsg = null;
                let fromName = "";
                let recallerInfo = { uid: "", name: "" };

                // Extract recaller info
                const revokeEl = recallTipMsg.elements[0]?.grayTipElement?.revokeElement;
                if (revokeEl) {
                  recallerInfo = extractRecallerInfo(revokeEl);
                }

                if (dbMsg != null) {
                  originalMsg = dbMsg.msg_data;
                  fromName = "database";

                  // Mark as recalled if not already
                  if (db && !dbMsg.is_recalled) {
                    db.markRecalled(currMsgId, myUid || "", recallerInfo.uid, recallerInfo.name);
                  }
                  addLog("INFO", "Recall detected (msgList). msgId:", currMsgId, "recovered from:", fromName, "recaller:", recallerInfo.name || recallerInfo.uid || "unknown");
                } else {
                  addLog("WARN", "Recall detected (msgList) but message not in DB. msgId:", currMsgId, "db:", db ? "initialized" : "null", "accountId:", myUid || "(empty)");
                }

                if (originalMsg != null && originalMsg instanceof Object) {
                  let msg = Object.assign({}, originalMsg);
                  msg.isOnlineMsg = true;
                  await imgDownloader.downloadPic(msg);
                  output("Detected recall, intercepted and recovered from " + fromName);

                  for (let key in msg) {
                    if (
                      ["msgSeq", "cntSeq", "clientSeq", "sendStatus", "emojiLikesList"].includes(key)
                    ) {
                      continue;
                    }
                    let newValue = msg[key];
                    let oldValue = recallTipMsg[key];
                    let value = newValue;
                    if (
                      ["msgAttrs", "msgMeta", "generalFlags"].includes(key) &&
                      newValue instanceof Object &&
                      oldValue instanceof Object
                    ) {
                      for (let k in oldValue) {
                        if (oldValue.hasOwnProperty(k)) {
                          delete oldValue[k];
                        }
                      }
                      value = Object.assign(oldValue, newValue);
                    }
                    recallTipMsg[key] = value;
                  }
                }
              }

              // Send recalled message IDs for rendering
              let recalledIds = [];
              if (db) {
                recalledIds = db.getRecalledMsgIds(myUid || "");
              }
              original_send.call(
                window.webContents,
                "LiteLoader.anti_recall.mainWindow.recallTipList",
                recalledIds.filter((id) => {
                  // Filter to current peer context
                  if (!currentMsgPeer) return true;
                  const m = db ? db.getMessage(id, myUid || "") : null;
                  return !m || m.peer_uid === currentMsgPeer;
                }),
                // Pass recaller info map
                (() => {
                  const map = {};
                  for (const id of recalledIds) {
                    const m = db ? db.getMessage(id, myUid || "") : null;
                    if (m && m.recaller_name) {
                      map[id] = m.recaller_name;
                    }
                  }
                  return map;
                })()
              );
            }

            //增量更新 IPC
            if (
              args.some(
                (item) =>
                  item &&
                  item.hasOwnProperty("cmdName") &&
                  item.cmdName != null
              )
            ) {
              let args1 = args[1];
              if (args1 == null) return;

              // Capture account UID
              if (args1.cmdName.indexOf("onProfileDetailInfoChanged") != -1) {
                if (args1.payload && args1.payload.info && args1.payload.info.uid) {
                  myUid = args1.payload.info.uid;
                  imgDownloader.configure({ accountId: myUid });
                  addLog("INFO", "Account UID captured:", myUid);
                  output("Account UID captured:", myUid);
                }
              }

              //拦截撤回IPC
              if (
                args1.cmdName != null &&
                (args1.cmdName.indexOf("onMsgInfoListUpdate") != -1 ||
                  args1.cmdName.indexOf("onActiveMsgInfoUpdate") != -1) &&
                args1.payload != null &&
                args1.payload.msgList instanceof Array &&
                args1.payload.msgList.length > 0 &&
                args1.payload.msgList[0].msgType == 5 &&
                args1.payload.msgList[0].subMsgType == 4
              ) {
                let msgList = args1.payload.msgList[0];

                if (
                  msgList.elements[0].grayTipElement != null &&
                  msgList.elements[0].grayTipElement.revokeElement != null &&
                  (nowConfig.isAntiRecallSelfMsg ||
                    !msgList.elements[0].grayTipElement.revokeElement.isSelfOperate)
                ) {
                  // Extract recaller info
                  const revokeEl = msgList.elements[0].grayTipElement.revokeElement;
                  const recallerInfo = extractRecallerInfo(revokeEl);

                  // Mark message as recalled in database
                  if (db) {
                    const existingMsg = db.getMessage(msgList.msgId, myUid || "");
                    if (existingMsg) {
                      db.markRecalled(msgList.msgId, myUid || "", recallerInfo.uid, recallerInfo.name);
                      addLog("INFO", "Recall detected (incremental IPC). msgId:", msgList.msgId, "recaller:", recallerInfo.name || recallerInfo.uid || "unknown", "accountId:", myUid || "(empty)");
                      await imgDownloader.downloadPic(existingMsg.msg_data);
                    } else {
                      addLog("WARN", "Recall detected but message not found in DB. msgId:", msgList.msgId, "accountId:", myUid || "(empty)");
                    }
                  } else {
                    addLog("WARN", "Recall detected but db is null. msgId:", msgList.msgId);
                  }

                  original_send.call(
                    window.webContents,
                    "LiteLoader.anti_recall.mainWindow.recallTip",
                    msgList.msgId,
                    nowConfig.showRecaller ? recallerInfo.name : ""
                  );

                  args[1].cmdName = "none";
                  args[1].payload.msgList.pop();

                  addLog("INFO", "Recall intercepted (incremental). Recaller:", recallerInfo.name || "unknown");
                  output("Detected recall, intercepted. Recaller:", recallerInfo.name || "unknown");
                }
              }
              //接到消息 - 保存到数据库
              else if (
                (args1.cmdName != null &&
                  args1.payload != null &&
                  (args1.cmdName.indexOf("onRecvMsg") != -1 ||
                    args1.cmdName.indexOf("onRecvActiveMsg") != -1) &&
                  args1.payload.msgList instanceof Array) ||
                (args1.cmdName != null &&
                  args1.cmdName.indexOf("onAddSendMsg") != -1 &&
                  args1.payload != null &&
                  args1.payload.msgRecord != null) ||
                (args1.cmdName != null &&
                  args1.cmdName.indexOf("onMsgInfoListUpdate") != -1 &&
                  args1.payload != null &&
                  args1.payload.msgList instanceof Array)
              ) {
                let msgList =
                  args1.payload.msgList instanceof Array
                    ? args1.payload.msgList
                    : [args1.payload.msgRecord];

                for (let msg of msgList) {
                  let msgId = msg.msgId;

                  // Save to SQLite database
                  if (db && nowConfig.saveDb) {
                    db.insertMessage(
                      msgId,
                      myUid || "",
                      msg.peerUid || "",
                      msg.senderUid || "",
                      msg.sendNickName || msg.sendMemberName || "",
                      msg.chatType || 0,
                      msg.msgTime ? msg.msgTime * 1000 : Date.now(),
                      msg
                    );
                    addLog("DEBUG", "Message saved to DB. msgId:", msgId, "peer:", msg.peerUid || "", "sender:", msg.sendNickName || msg.sendMemberName || "", "accountId:", myUid || "(empty)");

                    // Immediately save media files
                    if (nowConfig.saveMediaImmediately) {
                      imgDownloader.saveMediaFiles(msg, msgId).catch((e) => {
                        addLog("ERROR", "Save media error:", e.message, "msgId:", msgId);
                        output("Save media error:", e.message);
                      });
                    }
                  }

                  // Clean up old messages periodically (throttled)
                  if (db && nowConfig.saveDb) {
                    cleanupCounter++;
                    if (cleanupCounter >= CLEANUP_INTERVAL) {
                      cleanupCounter = 0;
                      const stats = db.getStats(myUid || "");
                      if (stats.totalMessages > (nowConfig.maxMsgSaveLimit || 50000)) {
                        db.cleanOldMessages(myUid || "", nowConfig.maxMsgSaveLimit - (nowConfig.deleteMsgCountPerTime || 2000));
                      }
                      if (nowConfig.saveMediaImmediately && stats.totalFiles > (nowConfig.maxFileSaveLimit || 5000)) {
                        db.cleanOldFiles(myUid || "", nowConfig.maxFileSaveLimit - (nowConfig.deleteFileCountPerTime || 500));
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          addLog("ERROR", "NTQQ Anti-Recall Error:", e.stack || e.message);
          output(
            "NTQQ Anti-Recall Error: ",
            e,
            "Please report this to https://github.com/xh321/LiteLoaderQQNT-Anti-Recall/issues, thank you"
          );
        }

        return original_send.call(window.webContents, channel, ...args);
      };

      if (window.webContents.__qqntim_original_object)
        window.webContents.__qqntim_original_object.send = patched_send;
      else window.webContents.send = patched_send;

      addLog("INFO", "Anti-Recall loaded for window:", window.webContents.getURL());
      output(
        "NTQQ Anti-Recall loaded for window: " + window.webContents.getURL()
      );
    }
  });
}

function output(...args) {
  console.log("\x1b[32m%s\x1b[0m", "Anti-Recall:", ...args);
}

module.exports = {
  onBrowserWindowCreated,
};
