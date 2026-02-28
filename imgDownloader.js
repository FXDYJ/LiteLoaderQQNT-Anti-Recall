//大部分摘自LLOneBot
const { RkeyManager } = require("./rkeyManager.js");
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const IMAGE_HTTP_HOST = "https://gchat.qpic.cn";
const IMAGE_HTTP_HOST_NT = "https://multimedia.nt.qq.com.cn";

class ImgDownloader {
  constructor() {
    this.rkeyManager = new RkeyManager("https://llob.linyuchen.net/rkey");
    this.saveDir = "";
    this.maxFileSizeMB = 50;
    this.db = null;
    this.accountId = "";
  }

  /**
   * Configure the downloader for immediate file saving.
   * @param {object} options - { saveDir, maxFileSizeMB, db, accountId }
   */
  configure(options) {
    if (options.saveDir) this.saveDir = options.saveDir;
    if (options.maxFileSizeMB != null) this.maxFileSizeMB = options.maxFileSizeMB;
    if (options.db) this.db = options.db;
    if (options.accountId) this.accountId = options.accountId;
  }

  async getImageUrl(element) {
    if (!element) {
      return "";
    }
    const url = element.originImageUrl; // 没有域名
    const md5HexStr = element.md5HexStr;
    if (url) {
      const parsedUrl = new URL(IMAGE_HTTP_HOST + url); //临时解析拼接
      const imageAppid = parsedUrl.searchParams.get("appid");
      const isNewPic = imageAppid && ["1406", "1407"].includes(imageAppid);
      if (isNewPic) {
        let rkey = parsedUrl.searchParams.get("rkey");
        if (rkey) {
          return IMAGE_HTTP_HOST_NT + url;
        }
        const rkeyData = await this.rkeyManager.getRkey();
        rkey =
          imageAppid === "1406" ? rkeyData.private_rkey : rkeyData.group_rkey;
        return IMAGE_HTTP_HOST_NT + url + rkey;
      } else {
        // 老的图片url，不需要rkey
        return IMAGE_HTTP_HOST + url;
      }
    } else if (md5HexStr) {
      // 没有url，需要自己拼接
      return `${IMAGE_HTTP_HOST}/gchatpic_new/0/0-0-${md5HexStr.toUpperCase()}/0`;
    }
    this.output("Pic url get error:", element);
    return "";
  }

  /**
   * Save media files (images/videos/files) immediately upon receiving a message.
   * Copies local files to plugin data directory and records them in the database.
   * @param {object} msgItem - The message object
   * @param {string} msgId - The message ID
   */
  async saveMediaFiles(msgItem, msgId) {
    if (!Array.isArray(msgItem?.elements) || !this.saveDir) return;

    const maxBytes = (this.maxFileSizeMB || 50) * 1024 * 1024;

    for (let el of msgItem.elements) {
      try {
        // Images
        if (el?.picElement) {
          const pic = el.picElement;
          const sourcePath = pic.sourcePath;
          if (sourcePath && fs.existsSync(sourcePath)) {
            let fileSize = 0;
            try { fileSize = fs.statSync(sourcePath).size; } catch (e) { this.output("Cannot stat file:", sourcePath, e.message); }
            if (fileSize > 0 && fileSize <= maxBytes) {
              const destDir = path.join(this.saveDir, "images");
              if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
              const destPath = path.join(destDir, path.basename(sourcePath));
              try {
                if (!fs.existsSync(destPath)) {
                  fs.copyFileSync(sourcePath, destPath);
                }
              } catch (e) { this.output("Copy file error:", e.message); }
              if (this.db) {
                this.db.insertFile(
                  msgId, this.accountId, el.elementId || "",
                  "image", pic.fileName || path.basename(sourcePath),
                  fileSize, sourcePath, destPath
                );
              }
            }
          }
        }

        // Videos
        if (el?.videoElement) {
          const video = el.videoElement;
          const sourcePath = video.filePath;
          if (sourcePath && fs.existsSync(sourcePath)) {
            let fileSize = 0;
            try { fileSize = fs.statSync(sourcePath).size; } catch (e) { this.output("Cannot stat file:", sourcePath, e.message); }
            if (fileSize > 0 && fileSize <= maxBytes) {
              const destDir = path.join(this.saveDir, "videos");
              if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
              const destPath = path.join(destDir, path.basename(sourcePath));
              try {
                if (!fs.existsSync(destPath)) {
                  fs.copyFileSync(sourcePath, destPath);
                }
              } catch (e) { this.output("Copy file error:", e.message); }
              if (this.db) {
                this.db.insertFile(
                  msgId, this.accountId, el.elementId || "",
                  "video", video.fileName || path.basename(sourcePath),
                  fileSize, sourcePath, destPath
                );
              }
            }
          }
        }

        // Files
        if (el?.fileElement) {
          const file = el.fileElement;
          const sourcePath = file.filePath;
          if (sourcePath && fs.existsSync(sourcePath)) {
            let fileSize = 0;
            try { fileSize = fs.statSync(sourcePath).size; } catch (e) { this.output("Cannot stat file:", sourcePath, e.message); }
            if (fileSize > 0 && fileSize <= maxBytes) {
              const destDir = path.join(this.saveDir, "files");
              if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
              const destPath = path.join(destDir, path.basename(sourcePath));
              try {
                if (!fs.existsSync(destPath)) {
                  fs.copyFileSync(sourcePath, destPath);
                }
              } catch (e) { this.output("Copy file error:", e.message); }
              if (this.db) {
                this.db.insertFile(
                  msgId, this.accountId, el.elementId || "",
                  "file", file.fileName || path.basename(sourcePath),
                  fileSize, sourcePath, destPath
                );
              }
            }
          }
        }
      } catch (e) {
        this.output("Save media file error:", e.message);
      }
    }
  }

  // 下载被撤回的图片（抄自Lite-Tools）
  async downloadPic(msgItem) {
    if (!Array.isArray(msgItem?.elements)) {
      return;
    }
    for (let el of msgItem.elements) {
      if (el?.picElement) {
        const pic = el.picElement;
        const thumbMap = new Map([
          [0, pic.sourcePath],
          [198, pic.sourcePath],
          [720, pic.sourcePath],
        ]);
        const picUrl = await this.getImageUrl(el.picElement);
        this.output(
          "Download lost pic(s)... url=",
          picUrl,
          "msgId=",
          msgItem.msgId,
          "to=",
          pic.sourcePath
        );
        let pictureRequireDownload = false;
        try {
          pictureRequireDownload = fs.statSync(pic.sourcePath).size <= 100; //错误的图片
        } catch (_) {}
        if (!fs.existsSync(pic.sourcePath) || pictureRequireDownload) {
          this.output("Download pic:", `${picUrl}`, " to ", pic.sourcePath);
          try {
            const body = await this.request(`${picUrl}`);
            try {
              JSON.parse(body);
              this.output("Picture already expired.", picUrl, pic.sourcePath); //过期
            } catch (_) {
              fs.mkdirSync(path.dirname(pic.sourcePath), { recursive: true });
              fs.writeFileSync(pic.sourcePath, body);
            }
          } catch (e) {
            this.output("Download pic failed:", e.message);
          }
        } else {
          this.output("Pic already existed, skip.", pic.sourcePath);
        }

        // 修复本地数据中的错误
        if (
          pic?.thumbPath &&
          (pic.thumbPath instanceof Array || pic.thumbPath instanceof Object)
        ) {
          pic.thumbPath = thumbMap;
        }
      }
    }
  }

  async request(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith("https") ? https : http;
      const req = protocol.get(url);
      req.on("error", (error) => {
        this.output("Download error", error);
        reject(error);
      });
      req.on("response", (res) => {
        // 发生跳转就继续请求
        if (res.statusCode >= 300 && res.statusCode <= 399) {
          return resolve(this.request(res.headers.location));
        }
        const chunks = [];
        res.on("error", (error) => {
          this.output("Download error", error);
          reject(error);
        });
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      });
    });
  }

  output(...args) {
    console.log("\x1b[32m%s\x1b[0m", "Anti-Recall:", ...args);
  }
}

module.exports.ImgDownloader = ImgDownloader;
