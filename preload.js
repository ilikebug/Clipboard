const fs = require('fs');
const path = require('path');
const { clipboard, nativeImage, dialog } = require('electron');

let clipboardHistory = [];
let settings = { maxRecords: 1000, pasteAfterCopy: false };
let isSearching = false;
let favorites = [];

// 在文件的顶部添加这个全局变量
let lastClipboardContent = '';

// 加载设置
function loadSettings() {
  const savedSettings = utools.dbStorage.getItem('clipboard_settings');
  if (savedSettings) {
    settings = { ...settings, ...JSON.parse(savedSettings) };
  }
}

// 保存设置
function saveSettings() {
  utools.dbStorage.setItem('clipboard_settings', JSON.stringify(settings));
}

// 加载剪贴板历史
function loadClipboardHistory() {
  const savedHistory = utools.dbStorage.getItem('clipboard_history');
  if (savedHistory) {
    clipboardHistory = JSON.parse(savedHistory);
  }
}

// 保存剪贴板历史
function saveClipboardHistory() {
  utools.dbStorage.setItem('clipboard_history', JSON.stringify(clipboardHistory));
}

// 添加到剪贴板历史
function addToClipboardHistory(type, content) {
  const timestamp = Date.now();
  
  // 检查是否已存在相同内容的记录
  const existingIndex = clipboardHistory.findIndex(item => item.content === content);
  
  // 如果存在，先删除旧记录
  if (existingIndex !== -1) {
    clipboardHistory.splice(existingIndex, 1);
  }
  
  // 添加新记录到顶部
  clipboardHistory.unshift({ type, content, timestamp });
  
  // 如果超出最大记录数，删除最旧的记录
  if (clipboardHistory.length > settings.maxRecords) {
    clipboardHistory.pop();
  }
  
  saveClipboardHistory();
}

// 检查剪贴板
function checkClipboard() {
  const text = clipboard.readText();
  const image = clipboard.readImage();
  const files = clipboard.readBuffer('FileNameW').toString('ucs2').replace(/\0/g, '').split('\r\n').filter(Boolean);

  let newItem = null;

  if (text && text !== lastClipboardContent) {
    newItem = { type: 'text', content: text };
    lastClipboardContent = text;
  } else if (!image.isEmpty() && image.toDataURL() !== lastClipboardContent) {
    newItem = { type: 'image', content: image.toDataURL() };
    lastClipboardContent = newItem.content;
  } else if (files.length > 0) {
    const filesContent = files.join(',');
    if (filesContent !== lastClipboardContent) {
      newItem = { type: 'files', content: filesContent };
      lastClipboardContent = filesContent;
    }
  }

  if (newItem) {
    addToClipboardHistory(newItem.type, newItem.content);
    return true;
  }

  return false;
}

// 复制到剪贴板
function copyToClipboard(item) {
  try {
    if (item.type === 'text') {
      clipboard.writeText(item.content);
    } else if (item.type === 'image') {
      const image = nativeImage.createFromDataURL(item.content);
      clipboard.writeImage(image);
    } else if (item.type === 'files') {
      clipboard.writeText(item.content); // 简化为文本复制
    }
  } catch (error) {
    console.error('复制到剪贴板失败:', error);
  }
}

// 删除历史记录项
function removeHistoryItem(index) {
  clipboardHistory.splice(index, 1);
  saveClipboardHistory();
}

// 清空历史记录
function clearHistory() {
  clipboardHistory = [];
  saveClipboardHistory();
}

// 搜索历史记录
function searchHistory(keyword) {
  if (!keyword.trim()) {
    return clipboardHistory;
  }
  
  const lowerKeyword = keyword.toLowerCase().trim();
  return clipboardHistory.filter(item => {
    if (item.type === 'text' || item.type === 'files') {
      return item.content.toLowerCase().includes(lowerKeyword);
    } else if (item.type === 'image') {
      return new Date(item.timestamp).toLocaleString().toLowerCase().includes(lowerKeyword);
    }
    return false;
  });
}

// 导出单条记录
function exportSingleItem(index) {
  if (index >= 0 && index < clipboardHistory.length) {
    const item = clipboardHistory[index];
    
    if (item.type === 'image') {
      // 处理图片导出
      const imageData = item.content.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(imageData, 'base64');
      const fileName = `clipboard_image_${Date.now()}.png`;
      
      const filePath = utools.showSaveDialog({
        title: '导出图片',
        defaultPath: fileName,
        filters: [{ name: 'Images', extensions: ['png'] }]
      });

      if (filePath) {
        fs.writeFileSync(filePath, buffer);
        console.log('图片已保存:', filePath);
      } else {
        console.log('保存被取消');
      }
    } else {
      // 处理其他类型的导出(保持原有逻辑)
      const content = JSON.stringify(item, null, 2);
      const fileName = `clipboard_item_${Date.now()}.json`;
      
      const filePath = utools.showSaveDialog({
        title: '导出单条记录',
        defaultPath: fileName,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });

      if (filePath) {
        fs.writeFileSync(filePath, content);
        console.log('文件已保存:', filePath);
      } else {
        console.log('保存被取消');
      }
    }
  } else {
    console.error('无效的历史记录索引');
  }
}

// 加载收藏项
function loadFavorites() {
  const savedFavorites = utools.dbStorage.getItem('clipboard_favorites');
  if (savedFavorites) {
    favorites = JSON.parse(savedFavorites);
  }
}

// 保存收藏项
function saveFavorites() {
  utools.dbStorage.setItem('clipboard_favorites', JSON.stringify(favorites));
}

// 添加到收藏
function addToFavorites(item) {
  const existingIndex = favorites.findIndex(fav => fav.content === item.content);
  if (existingIndex === -1) {
    favorites.unshift({...item, timestamp: Date.now()});
  } else {
    // 如果项目已存在，更新它
    favorites[existingIndex] = {...item, timestamp: Date.now()};
  }
  saveFavorites();
}

// 从收藏中移除
function removeFromFavorites(index) {
  favorites.splice(index, 1);
  saveFavorites();
}

// 插件进入时的处理
utools.onPluginEnter(({ code }) => {
  if (code === '星星剪贴板') {
    loadSettings();
    loadClipboardHistory();
    checkClipboard();
  }
});

// 插件准备就绪时的处理
utools.onPluginReady(() => {
  loadSettings();
  loadClipboardHistory();
  loadFavorites();
  setInterval(checkClipboard, 100);
});

// 添加新的搜索函数，持标签搜索
function searchFavorites(keyword, tag = '') {
  if (!keyword.trim() && !tag.trim()) {
    return favorites;
  }
  
  const lowerKeyword = keyword.toLowerCase().trim();
  const lowerTag = tag.toLowerCase().trim();
  
  return favorites.filter(item => {
    const contentMatch = (item.type === 'text' || item.type === 'files') && item.content.toLowerCase().includes(lowerKeyword);
    const dateMatch = item.type === 'image' && new Date(item.timestamp).toLocaleString().toLowerCase().includes(lowerKeyword);
    const tagMatch = lowerTag ? (item.tags && item.tags.some(t => t.toLowerCase().includes(lowerTag))) : true;
    
    return (contentMatch || dateMatch) && tagMatch;
  });
}

// 修改 window.preload 对象
window.preload = {
  loadSettings,
  saveSettings,
  loadClipboardHistory,
  saveClipboardHistory,
  checkClipboard,
  copyToClipboard,
  removeHistoryItem,
  clearHistory,
  searchHistory,
  getClipboardHistory: () => clipboardHistory,
  getSettings: () => settings,
  setSettings: (newSettings) => {
    settings = { ...settings, ...newSettings };
    saveSettings();
  },
  exportSingleItem,
  isSearching: () => isSearching,
  loadFavorites,
  saveFavorites,
  addToFavorites,
  removeFromFavorites,
  getFavorites: () => favorites,
  searchFavorites,
  setClipboardHistory: (newHistory) => {
    clipboardHistory = newHistory;
    saveClipboardHistory();
  },
  getPasteAfterCopySetting: () => settings.pasteAfterCopy,
  setPasteAfterCopySetting: (value) => {
    settings.pasteAfterCopy = value;
    saveSettings();
  },
};

// 修改定时检查剪贴板的逻辑
let lastCheckTime = 0;
const CHECK_INTERVAL = 100; // 100ms

function checkClipboardWrapper() {
  const now = Date.now();
  if (now - lastCheckTime >= CHECK_INTERVAL) {
    if (checkClipboard()) {
      updateHistory();
    }
    lastCheckTime = now;
  }
  requestAnimationFrame(checkClipboardWrapper);
}

// 在初始化时启动检查
requestAnimationFrame(checkClipboardWrapper);
