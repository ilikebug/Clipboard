const { clipboard, nativeImage } = require("electron");
const crypto = require("crypto");
const fs = require("fs");
const { size } = require("lodash");
const path = require("path");
const os = require("os");

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
function CheckSystemClipboard() {
  const text = clipboard.readText();
  const image = clipboard.readImage();
  const files = clipboard
    .readBuffer("FileNameW")
    .toString("ucs2")
    .replace(/\0/g, "")
    .split("\r\n")
    .filter(Boolean);

  switch (true) {
    case text != "":
      return { type: "text", content: text };
    case !image.isEmpty():
      const imageDataUrl = image.toDataURL();
      return { type: "image", content: imageDataUrl };
    case files.length > 0:
      const filesContent = files.join(", ");
      return { type: "files", content: filesContent };
    default:
      return null;
  }
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

function GetMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  return {
    usage: (memoryUsage.rss / 1024 / 1024).toFixed(2) + " MB",
  };
}

function ReadFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    const importedFavorites = JSON.parse(data);
    return importedFavorites;
  } catch (error) {
    console.error("读取文件失败:", error);
    return null;
  }
}

function ExportFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, data);
  } catch (error) {
    console.error("导出收藏列表失败:", error);
  }
}

function Size(data) {
  return size(data).toFixed(2);
}

function getAppDataPath() {
  return path.join(os.homedir(), ".starclipboard");
}

function ensureAppDataDir() {
  const appDataPath = getAppDataPath();
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
  }
  return appDataPath;
}

// 添加这个函数来处理 base64 字符串
function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function saveFileToAppData(content, fileExtension) {
  const appDataPath = ensureAppDataDir();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
  const filePath = path.join(appDataPath, fileName);

  // 如果 content 是 base64 字符串，先转换为 ArrayBuffer
  if (typeof content === "string" && content.startsWith("data:")) {
    const base64Data = content.split(",")[1];
    const arrayBuffer = base64ToArrayBuffer(base64Data);
    fs.writeFileSync(filePath, new Uint8Array(arrayBuffer));
  } else {
    fs.writeFileSync(filePath, content);
  }

  return filePath;
}

function readFileFromAppData(filePath) {
  return fs.readFileSync(filePath);
}

function deleteFileFromAppData(filePath) {
  fs.unlinkSync(filePath);
}

// 修改 window.preload 对象
window.preload = {
  dbStorage: new DBStorage(),

  CheckSystemClipboard,
  CopyToSystemClipboard,

  GenerateMD5Hash,

  ExportSingleHistoryItem,

  GetMemoryUsage,

  ReadFile,
  ExportFile,

  Size,

  getAppDataPath,
  ensureAppDataDir,
  saveFileToAppData,
  readFileFromAppData,
  deleteFileFromAppData,
  base64ToArrayBuffer,
};
