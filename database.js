const path = require("path");
const fs = require("fs");

class Database {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.db = null;
    this.dbPath = path.join(dataDir, "anti_recall.db");
  }

  open() {
    const BetterSqlite3 = require("better-sqlite3");
    this.db = new BetterSqlite3(this.dbPath);

    // Enable WAL mode for better concurrent read performance
    this.db.pragma("journal_mode = WAL");

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        msg_id TEXT NOT NULL,
        account_id TEXT NOT NULL DEFAULT '',
        peer_uid TEXT DEFAULT '',
        sender_uid TEXT DEFAULT '',
        sender_name TEXT DEFAULT '',
        chat_type INTEGER DEFAULT 0,
        msg_time INTEGER DEFAULT 0,
        msg_data TEXT DEFAULT '{}',
        is_recalled INTEGER DEFAULT 0,
        recall_time INTEGER DEFAULT 0,
        recaller_uid TEXT DEFAULT '',
        recaller_name TEXT DEFAULT '',
        created_at INTEGER DEFAULT 0,
        UNIQUE(msg_id, account_id)
      );

      CREATE TABLE IF NOT EXISTS saved_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        msg_id TEXT NOT NULL,
        account_id TEXT NOT NULL DEFAULT '',
        element_id TEXT DEFAULT '',
        file_type TEXT DEFAULT '',
        file_name TEXT DEFAULT '',
        file_size INTEGER DEFAULT 0,
        original_path TEXT DEFAULT '',
        saved_path TEXT DEFAULT '',
        created_at INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_messages_msg_id ON messages(msg_id);
      CREATE INDEX IF NOT EXISTS idx_messages_account ON messages(account_id);
      CREATE INDEX IF NOT EXISTS idx_messages_peer ON messages(peer_uid);
      CREATE INDEX IF NOT EXISTS idx_messages_recalled ON messages(is_recalled);
      CREATE INDEX IF NOT EXISTS idx_messages_time ON messages(msg_time);
      CREATE INDEX IF NOT EXISTS idx_files_msg ON saved_files(msg_id);
    `);

    // Prepare commonly used statements
    this._stmtInsertMsg = this.db.prepare(`
      INSERT OR REPLACE INTO messages
        (msg_id, account_id, peer_uid, sender_uid, sender_name, chat_type, msg_time, msg_data, created_at)
      VALUES (@msg_id, @account_id, @peer_uid, @sender_uid, @sender_name, @chat_type, @msg_time, @msg_data, @created_at)
    `);

    this._stmtGetMsg = this.db.prepare(
      `SELECT * FROM messages WHERE msg_id = ? AND account_id = ?`
    );

    this._stmtMarkRecalled = this.db.prepare(`
      UPDATE messages SET is_recalled = 1, recall_time = ?, recaller_uid = ?, recaller_name = ?
      WHERE msg_id = ? AND account_id = ?
    `);

    this._stmtInsertFile = this.db.prepare(`
      INSERT INTO saved_files
        (msg_id, account_id, element_id, file_type, file_name, file_size, original_path, saved_path, created_at)
      VALUES (@msg_id, @account_id, @element_id, @file_type, @file_name, @file_size, @original_path, @saved_path, @created_at)
    `);

    this._stmtGetRecalledMsgIds = this.db.prepare(
      `SELECT msg_id FROM messages WHERE account_id = ? AND is_recalled = 1`
    );

    return this;
  }

  insertMessage(msgId, accountId, peerUid, senderUid, senderName, chatType, msgTime, msgData) {
    try {
      this._stmtInsertMsg.run({
        msg_id: msgId,
        account_id: accountId,
        peer_uid: peerUid || "",
        sender_uid: senderUid || "",
        sender_name: senderName || "",
        chat_type: chatType || 0,
        msg_time: msgTime || 0,
        msg_data: JSON.stringify(msgData),
        created_at: Date.now(),
      });
    } catch (e) {
      this._output("Insert message error:", e.message);
    }
  }

  getMessage(msgId, accountId) {
    try {
      const row = this._stmtGetMsg.get(msgId, accountId);
      if (row) {
        row.msg_data = JSON.parse(row.msg_data);
      }
      return row || null;
    } catch (e) {
      this._output("Get message error:", e.message);
      return null;
    }
  }

  markRecalled(msgId, accountId, recallerUid, recallerName) {
    try {
      this._stmtMarkRecalled.run(
        Date.now(),
        recallerUid || "",
        recallerName || "",
        msgId,
        accountId
      );
    } catch (e) {
      this._output("Mark recalled error:", e.message);
    }
  }

  getRecalledMsgIds(accountId) {
    try {
      return this._stmtGetRecalledMsgIds.all(accountId).map((r) => r.msg_id);
    } catch (e) {
      this._output("Get recalled msg ids error:", e.message);
      return [];
    }
  }

  getRecalledByPeer(peerUid, accountId, limit = 50, offset = 0) {
    try {
      const rows = this.db
        .prepare(
          `SELECT * FROM messages WHERE peer_uid = ? AND account_id = ? AND is_recalled = 1
           ORDER BY recall_time DESC LIMIT ? OFFSET ?`
        )
        .all(peerUid, accountId, limit, offset);
      return rows.map((r) => {
        try { r.msg_data = JSON.parse(r.msg_data); } catch (_) {}
        return r;
      });
    } catch (e) {
      this._output("Get recalled by peer error:", e.message);
      return [];
    }
  }

  searchRecalled(accountId, keyword, limit = 50, offset = 0) {
    try {
      const rows = this.db
        .prepare(
          `SELECT * FROM messages WHERE account_id = ? AND is_recalled = 1
           AND msg_data LIKE ? ORDER BY recall_time DESC LIMIT ? OFFSET ?`
        )
        .all(accountId, `%${keyword}%`, limit, offset);
      return rows.map((r) => {
        try { r.msg_data = JSON.parse(r.msg_data); } catch (_) {}
        return r;
      });
    } catch (e) {
      this._output("Search recalled error:", e.message);
      return [];
    }
  }

  getAllRecalled(accountId, limit = 50, offset = 0) {
    try {
      const rows = this.db
        .prepare(
          `SELECT * FROM messages WHERE account_id = ? AND is_recalled = 1
           ORDER BY recall_time DESC LIMIT ? OFFSET ?`
        )
        .all(accountId, limit, offset);
      return rows.map((r) => {
        try { r.msg_data = JSON.parse(r.msg_data); } catch (_) {}
        return r;
      });
    } catch (e) {
      this._output("Get all recalled error:", e.message);
      return [];
    }
  }

  getPeersWithRecalls(accountId) {
    try {
      return this.db
        .prepare(
          `SELECT peer_uid, MAX(sender_name) as sender_name, chat_type, COUNT(*) as recall_count
           FROM messages WHERE account_id = ? AND is_recalled = 1
           GROUP BY peer_uid ORDER BY MAX(recall_time) DESC`
        )
        .all(accountId);
    } catch (e) {
      this._output("Get peers error:", e.message);
      return [];
    }
  }

  insertFile(msgId, accountId, elementId, fileType, fileName, fileSize, originalPath, savedPath) {
    try {
      this._stmtInsertFile.run({
        msg_id: msgId,
        account_id: accountId,
        element_id: elementId || "",
        file_type: fileType || "",
        file_name: fileName || "",
        file_size: fileSize || 0,
        original_path: originalPath || "",
        saved_path: savedPath || "",
        created_at: Date.now(),
      });
    } catch (e) {
      this._output("Insert file error:", e.message);
    }
  }

  getStats(accountId) {
    try {
      const totalMessages = this.db
        .prepare(`SELECT COUNT(*) as count FROM messages WHERE account_id = ?`)
        .get(accountId).count;
      const totalRecalled = this.db
        .prepare(`SELECT COUNT(*) as count FROM messages WHERE account_id = ? AND is_recalled = 1`)
        .get(accountId).count;
      const totalFiles = this.db
        .prepare(`SELECT COUNT(*) as count FROM saved_files WHERE account_id = ?`)
        .get(accountId).count;
      const totalFileSize = this.db
        .prepare(`SELECT COALESCE(SUM(file_size), 0) as total_size FROM saved_files WHERE account_id = ?`)
        .get(accountId).total_size;
      let dbSize = 0;
      try {
        if (fs.existsSync(this.dbPath)) dbSize = fs.statSync(this.dbPath).size;
      } catch (_) {}

      return { totalMessages, totalRecalled, totalFiles, totalFileSize, dbSize };
    } catch (e) {
      this._output("Get stats error:", e.message);
      return { totalMessages: 0, totalRecalled: 0, totalFiles: 0, totalFileSize: 0, dbSize: 0 };
    }
  }

  getDetailedStats(accountId) {
    try {
      const basic = this.getStats(accountId);

      const topRecallers = this.db
        .prepare(
          `SELECT recaller_name, COUNT(*) as count FROM messages
           WHERE account_id = ? AND is_recalled = 1 AND recaller_name != ''
           GROUP BY recaller_name ORDER BY count DESC LIMIT 10`
        )
        .all(accountId);

      const topPeers = this.db
        .prepare(
          `SELECT peer_uid, COUNT(*) as count FROM messages
           WHERE account_id = ? AND is_recalled = 1
           GROUP BY peer_uid ORDER BY count DESC LIMIT 10`
        )
        .all(accountId);

      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recallByDay = this.db
        .prepare(
          `SELECT date(recall_time / 1000, 'unixepoch', 'localtime') as day, COUNT(*) as count
           FROM messages WHERE account_id = ? AND is_recalled = 1 AND recall_time > ?
           GROUP BY day ORDER BY day`
        )
        .all(accountId, sevenDaysAgo);

      const fileTypes = this.db
        .prepare(
          `SELECT file_type, COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size
           FROM saved_files WHERE account_id = ?
           GROUP BY file_type`
        )
        .all(accountId);

      const recentRecalls = this.db
        .prepare(
          `SELECT msg_id, peer_uid, sender_name, recaller_name, recall_time
           FROM messages WHERE account_id = ? AND is_recalled = 1
           ORDER BY recall_time DESC LIMIT 5`
        )
        .all(accountId);

      return {
        ...basic,
        topRecallers,
        topPeers,
        recallByDay,
        fileTypes,
        recentRecalls,
      };
    } catch (e) {
      this._output("Get detailed stats error:", e.message);
      return this.getStats(accountId);
    }
  }

  cleanOldMessages(accountId, keepCount) {
    try {
      this.db
        .prepare(
          `DELETE FROM messages WHERE account_id = ? AND is_recalled = 0
           AND id NOT IN (SELECT id FROM messages WHERE account_id = ? ORDER BY created_at DESC LIMIT ?)`
        )
        .run(accountId, accountId, keepCount);
    } catch (e) {
      this._output("Clean old messages error:", e.message);
    }
  }

  cleanOldFiles(accountId, keepCount) {
    try {
      const toDelete = this.db
        .prepare(
          `SELECT saved_path FROM saved_files WHERE account_id = ?
           AND id NOT IN (SELECT id FROM saved_files WHERE account_id = ? ORDER BY created_at DESC LIMIT ?)`
        )
        .all(accountId, accountId, keepCount);

      for (const file of toDelete) {
        if (file.saved_path && fs.existsSync(file.saved_path)) {
          try { fs.unlinkSync(file.saved_path); } catch (_) {}
        }
      }

      this.db
        .prepare(
          `DELETE FROM saved_files WHERE account_id = ?
           AND id NOT IN (SELECT id FROM saved_files WHERE account_id = ? ORDER BY created_at DESC LIMIT ?)`
        )
        .run(accountId, accountId, keepCount);
    } catch (e) {
      this._output("Clean old files error:", e.message);
    }
  }

  clearAll(accountId) {
    try {
      this.db.prepare("DELETE FROM messages WHERE account_id = ?").run(accountId);

      const files = this.db
        .prepare("SELECT saved_path FROM saved_files WHERE account_id = ?")
        .all(accountId);
      for (const file of files) {
        if (file.saved_path && fs.existsSync(file.saved_path)) {
          try { fs.unlinkSync(file.saved_path); } catch (_) {}
        }
      }
      this.db.prepare("DELETE FROM saved_files WHERE account_id = ?").run(accountId);
    } catch (e) {
      this._output("Clear all error:", e.message);
    }
  }

  close() {
    if (this.db) {
      try {
        this.db.close();
      } catch (_) {}
      this.db = null;
    }
  }

  _output(...args) {
    console.log("\x1b[32m%s\x1b[0m", "Anti-Recall DB:", ...args);
  }
}

/**
 * In-memory fallback database used when better-sqlite3 is unavailable.
 * Implements the same interface as Database but stores data in Maps.
 * Data is lost on restart but keeps core anti-recall working.
 */
class MemoryDatabase {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.dbPath = path.join(dataDir, "anti_recall.db");
    this._messages = new Map(); // key: `${msgId}|${accountId}`
    this._files = [];
    this._isMemory = true;
  }

  open() {
    return this;
  }

  _key(msgId, accountId) {
    return msgId + "|" + (accountId || "");
  }

  insertMessage(msgId, accountId, peerUid, senderUid, senderName, chatType, msgTime, msgData) {
    try {
      const key = this._key(msgId, accountId);
      this._messages.set(key, {
        msg_id: msgId,
        account_id: accountId || "",
        peer_uid: peerUid || "",
        sender_uid: senderUid || "",
        sender_name: senderName || "",
        chat_type: chatType || 0,
        msg_time: msgTime || 0,
        msg_data: typeof msgData === "object" ? JSON.parse(JSON.stringify(msgData)) : msgData,
        is_recalled: 0,
        recall_time: 0,
        recaller_uid: "",
        recaller_name: "",
        created_at: Date.now(),
      });
    } catch (e) {
      this._output("Insert message error:", e.message);
    }
  }

  getMessage(msgId, accountId) {
    try {
      const row = this._messages.get(this._key(msgId, accountId));
      if (!row) return null;
      const copy = { ...row };
      if (typeof copy.msg_data === "object" && copy.msg_data !== null) {
        copy.msg_data = JSON.parse(JSON.stringify(copy.msg_data));
      }
      return copy;
    } catch (e) {
      this._output("Get message error:", e.message);
      return null;
    }
  }

  markRecalled(msgId, accountId, recallerUid, recallerName) {
    try {
      const row = this._messages.get(this._key(msgId, accountId));
      if (row) {
        row.is_recalled = 1;
        row.recall_time = Date.now();
        row.recaller_uid = recallerUid || "";
        row.recaller_name = recallerName || "";
      }
    } catch (e) {
      this._output("Mark recalled error:", e.message);
    }
  }

  getRecalledMsgIds(accountId) {
    try {
      const ids = [];
      for (const row of this._messages.values()) {
        if (row.account_id === accountId && row.is_recalled === 1) {
          ids.push(row.msg_id);
        }
      }
      return ids;
    } catch (e) {
      this._output("Get recalled msg ids error:", e.message);
      return [];
    }
  }

  getRecalledByPeer(peerUid, accountId, limit = 50, offset = 0) {
    try {
      const rows = [];
      for (const row of this._messages.values()) {
        if (row.peer_uid === peerUid && row.account_id === accountId && row.is_recalled === 1) {
          rows.push({ ...row });
        }
      }
      rows.sort((a, b) => b.recall_time - a.recall_time);
      return rows.slice(offset, offset + limit);
    } catch (e) {
      this._output("Get recalled by peer error:", e.message);
      return [];
    }
  }

  searchRecalled(accountId, keyword, limit = 50, offset = 0) {
    try {
      const rows = [];
      const kw = (keyword || "").toLowerCase();
      for (const row of this._messages.values()) {
        if (row.account_id === accountId && row.is_recalled === 1) {
          const dataStr = typeof row.msg_data === "object" ? JSON.stringify(row.msg_data) : String(row.msg_data);
          if (dataStr.toLowerCase().includes(kw)) {
            rows.push({ ...row });
          }
        }
      }
      rows.sort((a, b) => b.recall_time - a.recall_time);
      return rows.slice(offset, offset + limit);
    } catch (e) {
      this._output("Search recalled error:", e.message);
      return [];
    }
  }

  getAllRecalled(accountId, limit = 50, offset = 0) {
    try {
      const rows = [];
      for (const row of this._messages.values()) {
        if (row.account_id === accountId && row.is_recalled === 1) {
          rows.push({ ...row });
        }
      }
      rows.sort((a, b) => b.recall_time - a.recall_time);
      return rows.slice(offset, offset + limit);
    } catch (e) {
      this._output("Get all recalled error:", e.message);
      return [];
    }
  }

  getPeersWithRecalls(accountId) {
    try {
      const peerMap = new Map();
      for (const row of this._messages.values()) {
        if (row.account_id === accountId && row.is_recalled === 1) {
          const existing = peerMap.get(row.peer_uid);
          if (existing) {
            existing.recall_count++;
            if (row.recall_time > existing._max_recall_time) {
              existing._max_recall_time = row.recall_time;
              existing.sender_name = row.sender_name;
            }
          } else {
            peerMap.set(row.peer_uid, {
              peer_uid: row.peer_uid,
              sender_name: row.sender_name,
              chat_type: row.chat_type,
              recall_count: 1,
              _max_recall_time: row.recall_time,
            });
          }
        }
      }
      const result = Array.from(peerMap.values());
      result.sort((a, b) => b._max_recall_time - a._max_recall_time);
      for (const r of result) delete r._max_recall_time;
      return result;
    } catch (e) {
      this._output("Get peers error:", e.message);
      return [];
    }
  }

  insertFile(msgId, accountId, elementId, fileType, fileName, fileSize, originalPath, savedPath) {
    try {
      this._files.push({
        msg_id: msgId,
        account_id: accountId || "",
        element_id: elementId || "",
        file_type: fileType || "",
        file_name: fileName || "",
        file_size: fileSize || 0,
        original_path: originalPath || "",
        saved_path: savedPath || "",
        created_at: Date.now(),
      });
    } catch (e) {
      this._output("Insert file error:", e.message);
    }
  }

  getStats(accountId) {
    try {
      let totalMessages = 0;
      let totalRecalled = 0;
      for (const row of this._messages.values()) {
        if (row.account_id === accountId) {
          totalMessages++;
          if (row.is_recalled === 1) totalRecalled++;
        }
      }
      let totalFiles = 0;
      let totalFileSize = 0;
      for (const f of this._files) {
        if (f.account_id === accountId) {
          totalFiles++;
          totalFileSize += f.file_size || 0;
        }
      }
      return { totalMessages, totalRecalled, totalFiles, totalFileSize, dbSize: 0 };
    } catch (e) {
      this._output("Get stats error:", e.message);
      return { totalMessages: 0, totalRecalled: 0, totalFiles: 0, totalFileSize: 0, dbSize: 0 };
    }
  }

  getDetailedStats(accountId) {
    return this.getStats(accountId);
  }

  cleanOldMessages(accountId, keepCount) {
    try {
      const entries = [];
      for (const [key, row] of this._messages.entries()) {
        if (row.account_id === accountId && row.is_recalled === 0) {
          entries.push({ key, created_at: row.created_at });
        }
      }
      entries.sort((a, b) => b.created_at - a.created_at);
      const toRemove = entries.slice(keepCount);
      for (const e of toRemove) {
        this._messages.delete(e.key);
      }
    } catch (e) {
      this._output("Clean old messages error:", e.message);
    }
  }

  cleanOldFiles(accountId, keepCount) {
    try {
      const matching = this._files
        .map((f, i) => ({ ...f, _idx: i }))
        .filter((f) => f.account_id === accountId);
      matching.sort((a, b) => b.created_at - a.created_at);
      const toRemove = matching.slice(keepCount);
      const removeIndices = new Set(toRemove.map((r) => r._idx));

      for (const r of toRemove) {
        if (r.saved_path && fs.existsSync(r.saved_path)) {
          try { fs.unlinkSync(r.saved_path); } catch (_) {}
        }
      }
      this._files = this._files.filter((_, i) => !removeIndices.has(i));
    } catch (e) {
      this._output("Clean old files error:", e.message);
    }
  }

  clearAll(accountId) {
    try {
      for (const [key, row] of this._messages.entries()) {
        if (row.account_id === accountId) {
          this._messages.delete(key);
        }
      }

      const remaining = [];
      for (const f of this._files) {
        if (f.account_id === accountId) {
          if (f.saved_path && fs.existsSync(f.saved_path)) {
            try { fs.unlinkSync(f.saved_path); } catch (_) {}
          }
        } else {
          remaining.push(f);
        }
      }
      this._files = remaining;
    } catch (e) {
      this._output("Clear all error:", e.message);
    }
  }

  close() {
    this._messages.clear();
    this._files = [];
  }

  _output(...args) {
    console.log("\x1b[32m%s\x1b[0m", "Anti-Recall MemDB:", ...args);
  }
}

module.exports.Database = Database;
module.exports.MemoryDatabase = MemoryDatabase;
