const { clipboard, nativeImage } = require("electron");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { size } = require("lodash");
const clipboardWatcher = require("electron-clipboard-watcher");

function GenerateMD5Hash(data) {
  return crypto.createHash("md5").update(data).digest("hex");
}

class DBStorage {
  // 获取数据库
  getData(key) {
    return utools.dbStorage.getItem(key);
  }

  // 设置数据库
  setData(key, value) {
    utools.dbStorage.setItem(key, value);
  }

  // 删除数据库
  removeData(key) {
    utools.dbStorage.removeItem(key);
  }
}

// 检查系统剪贴板
function CheckSystemClipboard(callback) {
  clipboardWatcher({
    watchDelay: 1000,
    onTextChange: (text) => {
      callback({ type: "text", content: text });
    },
    onImageChange: (image) => {
      const imageDataUrl = image.toDataURL();
      callback({ type: "image", content: imageDataUrl });
    },
    onFilesChange: (files) => {
      callback({ type: "files", content: files });
    },
  });
}

// 设置数据到系统剪贴板
function CopyToSystemClipboard(item) {
  try {
    if (item.type === "text") {
      clipboard.writeText(item.content);
    } else if (item.type === "image") {
      const image = nativeImage.createFromDataURL(item.content);
      clipboard.writeImage(image);
    } else if (item.type === "files") {
      clipboard.writeBuffer(
        "FileNameW",
        Buffer.from(item.content.split(", ").join("\0") + "\0", "ucs2")
      );
    }
  } catch (error) {
    console.error("复制到剪贴板失败:", error);
  }
}

function ExportSingleHistoryItem(item) {
  let content = "";
  let filePath = "";
  if (item.type === "image") {
    const imageData = item.content.replace(/^data:image\/\w+;base64,/, "");
    content = Buffer.from(imageData, "base64");
    filePath = utools.showSaveDialog({
      title: "导出图片",
      defaultPath: `clipboard_image_${Date.now()}.png`,
      filters: [{ name: "Images", extensions: ["png"] }],
    });
  } else if (item.type === "files") {
    content = item.content;
    filePath = utools.showSaveDialog({
      title: "导出文件列表",
      defaultPath: `clipboard_files_${Date.now()}.txt`,
      filters: [{ name: "Text", extensions: ["txt"] }],
    });
  } else {
    content = item.content;
    filePath = utools.showSaveDialog({
      title: "导出文本",
      defaultPath: `clipboard_text_${Date.now()}.txt`,
      filters: [{ name: "Text", extensions: ["txt"] }],
    });
  }

  if (filePath) {
    fs.writeFileSync(filePath, content);
    return true;
  } else {
    return false;
  }
}

function ReadFavoritesFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    const importedFavorites = JSON.parse(data);
    return importedFavorites;
  } catch (error) {
    console.error("读取文件失败:", error);
    return null;
  }
}

function ExportFavoritesFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, data);
  } catch (error) {
    console.error("导出收藏列表失败:", error);
  }
}

function Size(data) {
  return size(data).toFixed(2);
}

function ReadFile(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    console.error("读取本地文件失败:", error);
    return null;
  }
}

function DeleteFile(filePath) {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    console.error("删除文件失败:", error);
    return false;
  }
}

function SaveFile(content, fileName) {
  try {
    const appDataPath = utools.getPath("userData");
    const storageDir = path.join(appDataPath, "clipboard_storage");

    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const filePath = path.join(storageDir, fileName);
    fs.writeFileSync(filePath, content);
    return filePath;
  } catch (error) {
    console.error("存储文件失败:", error);
    return null;
  }
}

// 修改 window.preload 对象
window.preload = {
  dbStorage: new DBStorage(),

  CheckSystemClipboard,
  CopyToSystemClipboard,

  GenerateMD5Hash,

  ExportSingleHistoryItem,

  ReadFavoritesFile,
  ExportFavoritesFile,

  Size,

  ReadFile,
  SaveFile,
  DeleteFile,
};
