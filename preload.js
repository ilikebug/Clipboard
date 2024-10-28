const { clipboard, nativeImage, ipcRenderer } = require("electron");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Buffer } = require("buffer");

function GenerateMD5Hash(data, type) {
  if (type === "image") {
    const bitmap = data.getBitmap();
    // 只使用前 10KB 的图像数据来生成哈希
    const imageData = Buffer.from(bitmap).slice(0, 1024 * 1024);
    return crypto.createHash("md5").update(imageData).digest("hex");
  } else {
    return crypto.createHash("md5").update(data).digest("hex");
  }
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

// 添加防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

async function CheckSystemClipboard(callback) {
  let lastTextID = "";
  let lastImageID = "";
  let isProcessing = false;

  const checkClipboard = async () => {
    if (isProcessing) return;
    isProcessing = true;

    try {
      const text = clipboard.readText();
      const image = clipboard.readImage();

      // 检查文本
      const textID = GenerateMD5Hash(text, "text");
      if (text !== "" && textID !== lastTextID) {
        lastTextID = textID;
        callback({ type: "text", content: text, id: textID });
      }

      // 检查图片
      const imageID = GenerateMD5Hash(image, "image");
      if (!image.isEmpty() && imageID !== lastImageID) {
        lastImageID = imageID;
        const filePath = SaveFile(
          image.toPNG(),
          `clipboard_image_${imageID}.png`
        );
        callback({ type: "image", content: filePath, id: imageID });
      }
    } finally {
      isProcessing = false;
    }
  };

  const debouncedCheck = debounce(checkClipboard, 50); // 使用50毫秒的防抖

  // 每200毫秒检查一次剪贴板
  setInterval(debouncedCheck, 200);

  // 监听主进程发送的剪贴板变化事件
  ipcRenderer.on("clipboard-changed", debouncedCheck);
}

// 设置数据到系统剪贴板
function CopyToSystemClipboard(item) {
  try {
    if (item.type === "text") {
      clipboard.writeText(item.content);
    } else if (item.type === "image") {
      const data = fs.readFileSync(item.content);
      const image = nativeImage.createFromBuffer(data);
      clipboard.writeImage(image);
    }
  } catch (error) {
    console.error("复制到剪贴板失败:", error);
  }
}

function ExportSingleHistoryItem(item) {
  let content = "";
  let filePath = "";
  if (item.type === "image") {
    content = fs.readFileSync(item.content);
    filePath = utools.showSaveDialog({
      title: "导出图片",
      defaultPath: `clipboard_image_${Date.now()}.png`,
      filters: [{ name: "Images", extensions: ["png"] }],
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

function DeleteFile(filePath) {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
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

function ReadImageFile(filePath) {
  return fs.readFileSync(filePath);
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

  SaveFile,
  DeleteFile,
  ReadImageFile,

  Buffer,
};
