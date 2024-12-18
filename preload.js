const { clipboard, nativeImage } = require("electron");
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

async function CheckSystemClipboard(callback) {
  let lastTextID = "";
  let lastImageID = "";
  let isProcessing = false;
  let clipboardQueue = []; // 添加队列来存储剪贴板变化

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
        clipboardQueue.push({ type: "text", content: text, id: textID });
      }

      // 检查图片
      const imageID = GenerateMD5Hash(image, "image");
      if (!image.isEmpty() && imageID !== lastImageID) {
        lastImageID = imageID;
        const filePath = SaveFile(
          image.toPNG(),
          `clipboard_image_${imageID}.png`
        );
        clipboardQueue.push({ type: "image", content: filePath, id: imageID });
      }

      // 处理队列中的所有项
      while (clipboardQueue.length > 0) {
        const item = clipboardQueue.shift();
        await callback(item);
      }
    } finally {
      isProcessing = false;
    }
  };

  // 使用更短的检查间隔，确保能捕获到快速的变化
  setInterval(checkClipboard, 20); // 每20ms检查一次
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

async function OcrImage(image, ak, sk) {
  return await ocr(image, ak, sk);
}

async function ocr(image, ak, sk) {
  var options = {
    method: "POST",
    url:
      "https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=" +
      (await getAccessToken(ak, sk)),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    data: {
      detect_direction: "false",
      paragraph: "false",
      probability: "false",
      multidirectional_recognize: "false",
      image: image,
    },
  };

  // 返回新的 Promise
  return new Promise((resolve, reject) => {
    fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: new URLSearchParams(options.data),
    })
      .then((response) => response.json())
      .then((data) => {
        resolve(data?.words_result || []);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

function getAccessToken(ak, sk) {
  let options = {
    method: "POST",
    url:
      "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=" +
      ak +
      "&client_secret=" +
      sk,
  };
  return new Promise((resolve, reject) => {
    fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: new URLSearchParams(options.data),
    })
      .then((response) => response.json())
      .then((res) => {
        resolve(res.access_token);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

window.services = {
  OcrImage: OcrImage,
};

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

  OcrImage,
};
