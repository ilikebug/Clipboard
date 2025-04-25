const {
  dbStorage,

  CheckSystemClipboard,
  CopyToSystemClipboard,

  GenerateMD5Hash,

  ExportSingleHistoryItem,

  ReadFavoritesFile,
  ExportFavoritesFile,

  SaveFile,
  DeleteFile,
  ReadImageFile,

  OcrImage,
} = window.preload;

const HISTORY_SORT_ID_LIST = "HISTORY_SORT_ID_LIST";
const FAVORITES_SORT_ID_LIST = "FAVORITES_SORT_ID_LIST";

const HISTORY_SECTION = "history";
const FAVORITES_SECTION = "favorites";
const SETTINGS_SECTION = "settings";

const defaultSettingsConfig = {
  maxHistoryCount: 100,
  pasteToSystem: true,
  ocrAk: "",
  ocrSk: "",
};

let historySortIDList = [];
let historyListDataMap = {};

let favoritesSortIDList = [];
let favoritesListDataMap = {};

let searchKeyword = "";

let currentSelectedTab = "history";

let settings = null;
class Settings {
  init() {
    this.settingsConfig = defaultSettingsConfig;
    const dbSettings = dbStorage.getData("settings");
    if (dbSettings) {
      this.settingsConfig = dbSettings;
    }
  }

  get() {
    return this.settingsConfig;
  }

  set(settingsConfig) {
    this.settingsConfig = settingsConfig;
    dbStorage.setData("settings", settingsConfig);
  }
}

class ThemeManager {
  constructor() {
    this.defaultConfig = {
      mode: 'light',
      preset: 'classic',
      customColors: {
        primary: '#4a90e2',
        secondary: '#5a5de8'
      }
    };

    // 预设主题配置
    this.presets = {
      classic: {
        light: {
          primary: '#4a90e2',
          secondary: '#5a5de8',
          background: '#ffffff',
          text: '#333333',
          border: '#e0e0e0',
          hover: '#f5f5f5',
          active: '#e8e8e8'
        },
        dark: {
          primary: '#4a90e2',
          secondary: '#5a5de8',
          background: '#1a1a1a',
          text: '#ffffff',
          border: '#333333',
          hover: '#2a2a2a',
          active: '#3a3a3a'
        }
      },
      modern: {
        light: {
          primary: '#00bcd4',
          secondary: '#ff4081',
          background: '#ffffff',
          text: '#2c3e50',
          border: '#ecf0f1',
          hover: '#f6f8f9',
          active: '#edf1f2'
        },
        dark: {
          primary: '#00bcd4',
          secondary: '#ff4081',
          background: '#2c3e50',
          text: '#ecf0f1',
          border: '#34495e',
          hover: '#2c3e50',
          active: '#34495e'
        }
      }
    };

    this.currentConfig = { ...this.defaultConfig };
    this.init();
  }

  init() {
    // 从存储中加载主题配置
    const savedConfig = dbStorage.getData('themeConfig');
    if (savedConfig) {
      this.currentConfig = { ...this.defaultConfig, ...savedConfig };
    }

    // 初始化系统主题监听
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addListener((e) => this.handleSystemThemeChange(e));
    }

    // 应用当前主题
    this.applyTheme();
    
    // 初始化UI
    this.initUI();
  }

  initUI() {
    const modeSelect = document.getElementById('themeMode');
    const presetSelect = document.getElementById('themePreset');
    const customSection = document.getElementById('customThemeSection');
    const primaryColor = document.getElementById('primaryColor');
    const secondaryColor = document.getElementById('secondaryColor');

    if (modeSelect) modeSelect.value = this.currentConfig.mode;
    if (presetSelect) presetSelect.value = this.currentConfig.preset;
    if (primaryColor) primaryColor.value = this.currentConfig.customColors.primary;
    if (secondaryColor) secondaryColor.value = this.currentConfig.customColors.secondary;

    if (customSection) {
      customSection.style.display = 
        this.currentConfig.preset === 'custom' ? 'block' : 'none';
    }
  }

  handleSystemThemeChange(e) {
    if (this.currentConfig.mode === 'system') {
      this.applyTheme();
    }
  }

  getEffectiveTheme() {
    if (this.currentConfig.mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return this.currentConfig.mode;
  }

  applyTheme() {
    const theme = this.getEffectiveTheme();
    const preset = this.currentConfig.preset;
    const root = document.documentElement;

    // 设置主题属性
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-preset', preset);

    // 获取当前预设的颜色方案
    let colors;
    if (preset === 'custom') {
      colors = {
        primary: this.currentConfig.customColors.primary,
        secondary: this.currentConfig.customColors.secondary,
        background: theme === 'dark' ? '#1a1a1a' : '#ffffff',
        text: theme === 'dark' ? '#ffffff' : '#333333',
        border: theme === 'dark' ? '#333333' : '#e0e0e0',
        hover: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
        active: theme === 'dark' ? '#3a3a3a' : '#e8e8e8'
      };
    } else {
      colors = this.presets[preset][theme];
    }

    // 应用颜色变量
    root.style.setProperty('--primary-color', colors.primary);
    root.style.setProperty('--secondary-color', colors.secondary);
    root.style.setProperty('--background-color', colors.background);
    root.style.setProperty('--text-color', colors.text);
    root.style.setProperty('--border-color', colors.border);
    root.style.setProperty('--hover-color', colors.hover);
    root.style.setProperty('--active-color', colors.active);
    root.style.setProperty('--header-bg', 
      `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`);

    // 保存配置
    dbStorage.setData('themeConfig', this.currentConfig);
  }

  resetTheme() {
    this.currentConfig = { ...this.defaultConfig };
    this.applyTheme();
    this.initUI();
  }
}

class ImageLoader {
  constructor() {
    this.loadingImages = new Map();
    this.setupImageLoadingObserver();
  }

  setupImageLoadingObserver() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img && img.hasAttribute('data-src')) {
            const imagePath = img.getAttribute('data-src');
            console.log('开始加载图片:', imagePath);
            
            // 直接在这里处理图片加载，而不是调用 handleImageElement
            const container = img.closest('.image-container');
            if (!container) {
              console.error('找不到图片容器元素');
              return;
            }

            const spinner = container.querySelector('.loading-spinner');
            const errorMsg = container.querySelector('.error-message');

            // 创建新的图片对象用于预加载
            const preloadImg = new Image();
            
            preloadImg.onload = () => {
              console.log('图片加载成功:', imagePath);
              
              // 直接使用当前上下文中的元素引用
              if (spinner) spinner.style.display = 'none';
              if (errorMsg) errorMsg.style.display = 'none';
              
              img.src = imagePath;
              img.style.display = 'block';
              img.style.opacity = '1';
              img.classList.add('loaded');
              img.removeAttribute('data-src');
              
              // 停止观察这个图片
              this.observer.unobserve(img);
            };

            preloadImg.onerror = (error) => {
              console.error('图片加载失败:', imagePath, error);
              if (spinner) spinner.style.display = 'none';
              if (errorMsg) {
                errorMsg.textContent = '图片加载失败';
                errorMsg.style.display = 'block';
              }
              if (img) img.style.display = 'none';
              
              // 停止观察这个图片
              this.observer.unobserve(img);
            };

            // 开始加载图片
            preloadImg.src = imagePath;
          }
        }
      });
    }, {
      root: null,
      rootMargin: '50px',
      threshold: 0.1
    });
  }

  handleImageElement(imgElement) {
    if (!imgElement || !imgElement.id) {
      console.error('无效的图片元素');
      return;
    }

    try {
      const container = imgElement.closest('.image-container');
      if (!container) {
        console.error('找不到图片容器元素');
        return;
      }

      const spinner = container.querySelector('.loading-spinner');
      const errorMsg = container.querySelector('.error-message');
      
      // 重置状态
      if (spinner) spinner.style.display = 'block';
      if (errorMsg) {
        errorMsg.style.display = 'none';
        errorMsg.textContent = '';
      }

      // 获取图片路径
      let imagePath = imgElement.getAttribute('data-src');
      console.log('原始图片路径:', imagePath);

      // 处理路径
      imagePath = this.normalizeImagePath(imagePath);
      console.log('处理后的图片路径:', imagePath);

      if (!imagePath) {
        throw new Error('图片路径无效');
      }

      // 创建新的图片对象用于预加载
      const preloadImg = new Image();
      
      preloadImg.onload = () => {
        console.log('图片加载成功:', imagePath);
        
        // 确保所有需要的元素都存在
        const targetImg = document.getElementById(imgElement.id);
        const targetContainer = targetImg ? targetImg.closest('.image-container') : null;
        const targetSpinner = targetContainer ? targetContainer.querySelector('.loading-spinner') : null;
        const targetError = targetContainer ? targetContainer.querySelector('.error-message') : null;

        // 安全地更新 DOM
        if (targetSpinner) {
          targetSpinner.style.display = 'none';
          console.log('隐藏加载动画');
        }
        if (targetError) {
          targetError.style.display = 'none';
          console.log('隐藏错误信息');
        }
        if (targetImg) {
          console.log('更新图片显示状态');
          targetImg.src = imagePath;
          targetImg.style.display = 'block';
          targetImg.style.opacity = '1';
          targetImg.classList.add('loaded');
          targetImg.removeAttribute('data-src');
        } else {
          console.error('找不到目标图片元素:', imgElement.id);
        }
      };

      preloadImg.onerror = (error) => {
        console.error('图片加载失败:', imagePath, error);
        const targetContainer = document.getElementById(imgElement.id)?.closest('.image-container');
        if (targetContainer) {
          this.showError(targetContainer, '图片加载失败');
        }
      };

      // 开始加载图片
      preloadImg.src = imagePath;

    } catch (error) {
      console.error('图片处理错误:', error);
      const targetContainer = document.getElementById(imgElement.id)?.closest('.image-container');
      if (targetContainer) {
        this.showError(targetContainer, error.message || '图片处理出错');
      }
    }
  }

  showError(container, message) {
    if (!container) return;

    const spinner = container.querySelector('.loading-spinner');
    const errorMsg = container.querySelector('.error-message');
    const img = container.querySelector('.clipboard-image');

    if (spinner) spinner.style.display = 'none';
    if (errorMsg) {
      errorMsg.textContent = message;
      errorMsg.style.display = 'block';
    }
    if (img) img.style.display = 'none';
  }

  normalizeImagePath(path) {
    if (!path) {
      console.error('路径为空');
      return null;
    }

    try {
      // 移除多余的 file:// 前缀
      let normalizedPath = path;
      
      // 如果路径以 file:// 开头，移除它
      if (normalizedPath.startsWith('file://')) {
        normalizedPath = normalizedPath.substring(7);
      }

      // 解码 URL
      normalizedPath = decodeURIComponent(normalizedPath);

      // 检查文件是否存在
      console.log('检查文件是否存在:', normalizedPath);
      const fileExists = window.preload.ReadImageFile(normalizedPath);
      
      if (!fileExists) {
        console.error('图片文件不存在:', normalizedPath);
        return null;
      }

      // 重新添加 file:// 前缀
      return 'file://' + normalizedPath;

    } catch (error) {
      console.error('路径处理错误:', error);
      return null;
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.loadingImages.clear();
  }
}

class ContentTools {
  constructor() {
    this.imageLoader = new ImageLoader();
    this.lastPasteTime = 0;
    this.minPasteInterval = 50;
  }

  renderContent(item) {
    if (!item || !item.type) {
      console.error('无效的内容项:', item);
      return '';
    }

    if (item.type === "image") {
      try {
        const imagePath = this.normalizeImagePath(item.content);
        if (!imagePath) {
          console.error('图片路径无效:', item.content);
          return '<p class="error-message">无效的图片路径</p>';
        }

        const ids = this.generateIds(item.id);
        return this.createImageContainer(imagePath, ids);
      } catch (error) {
        console.error('渲染图片内容时出错:', error);
        return '<p class="error-message">图片渲染失败</p>';
      }
    }
    
    return this.renderOtherContent(item);
  }

  normalizeImagePath(content) {
    if (!content) return null;
    
    try {
      // 移除重复的 file:// 前缀
      let normalizedPath = content.replace(/^(file:\/\/)+/g, 'file://');
      
      // 确保路径是绝对路径
      if (!normalizedPath.startsWith('file://')) {
        normalizedPath = 'file://' + normalizedPath;
      }
      
      // 解码 URL
      normalizedPath = decodeURIComponent(normalizedPath);
      
      // 验证文件是否存在
      const pathWithoutProtocol = normalizedPath.replace(/^file:\/\//g, '');
      if (!window.preload.ReadImageFile(pathWithoutProtocol)) {
        console.error('图片文件不存在:', pathWithoutProtocol);
        return null;
      }
      
      return normalizedPath;
    } catch (error) {
      console.error('处理图片路径时出错:', error);
      return null;
    }
  }

  generateIds(itemId) {
    const uniqueId = itemId || Date.now() + Math.random().toString(36).substr(2, 9);
    return {
      container: `image-container-${uniqueId}`,
      image: `img-${uniqueId}`,
      spinner: `spinner-${uniqueId}`,
      error: `error-${uniqueId}`
    };
  }

  createImageContainer(imagePath, ids) {
    return `
      <div class="image-container" id="${ids.container}">
        <div class="loading-spinner" id="${ids.spinner}"></div>
        <img src="${imagePath}" 
             id="${ids.image}"
             class="clipboard-image"
             alt="剪贴板图片" 
             style="max-width: 100%; max-height: 100px; display: none;"
             loading="lazy"
             onerror="this.parentElement.querySelector('.error-message').style.display='block'; this.style.display='none';">
        <p class="error-message" 
           id="${ids.error}" 
           style="display: none; text-align: center; color: #999;">
           无法加载图片
        </p>
      </div>
    `;
  }

  renderOtherContent(item) {
    switch (item.type) {
      case "text":
        return this.formatTextContent(item.content);
      default:
        return `<p>未知类型: ${item.type}</p>`;
    }
  }

  formatTextContent(text) {
    if (!text) return '';
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlPattern, (url) => {
      return `<a href="${url}" class="link-mention" target="_blank">${url}</a>`;
    });
  }

  pasteContentToSystem() {
    const now = Date.now();
    // 检查是否距离上次粘贴操作太近
    if (now - this.lastPasteTime < this.minPasteInterval) {
      return;
    }
    
    this.lastPasteTime = now;
    
    // 根据操作系统选择合适的粘贴快捷键
    if (utools.isMacOS()) {
      utools.simulateKeyboardTap("v", "command");
    } else {
      utools.simulateKeyboardTap("v", "ctrl");
    }
  }

  destroy() {
    if (this.imageLoader) {
      this.imageLoader.destroy();
    }
  }
}

//----------------------------------//
//         Register Event           //
//----------------------------------//
let registerEvent = null;
class RegisterEvent {
  registerHistoryItemEvent() {
    const historyElement = document.getElementById("history");

    // 先移除所有已存在的事件监听器
    const oldItems = historyElement.querySelectorAll(".history-item");
    oldItems.forEach(item => {
      const newItem = item.cloneNode(true);
      item.parentNode.replaceChild(newItem, item);
    });

    historyElement.querySelectorAll(".history-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (!e.target.closest("button")) {
          e.preventDefault();
          e.stopPropagation();
          const historyID = item.getAttribute("history-id");
          CopyToSystemClipboard(historyListDataMap[historyID]);
          if (settings.get().pasteToSystem) {
            setTimeout(() => {
              contentTools.pasteContentToSystem();
            }, 10);
          }
          exitAPP();
        }
      });
    });

    historyElement.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const historyID = e.target.getAttribute("history-id");
        CopyToSystemClipboard(historyListDataMap[historyID]);
        if (settings.get().pasteToSystem) {
          setTimeout(() => {
            contentTools.pasteContentToSystem();
          }, 10);
        }
        exitAPP();
      });
    });

    historyElement.querySelectorAll(".export-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const historyID = e.target.getAttribute("history-id");
        if (ExportSingleHistoryItem(historyListDataMap[historyID])) {
          showToast("导出成功");
        } else {
          showToast("导出失败");
        }
      });
    });

    historyElement.querySelectorAll(".favorite-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const historyID = e.target.getAttribute("history-id");
        favoritesList.addContentToFavoritesList(historyListDataMap[historyID]);
        favoritesList.renderFavoritesList();
        showToast("收藏成功");
      });
    });

    historyElement.querySelectorAll(".ocr-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const historyID = e.target.getAttribute("history-id");
        if (historyListDataMap[historyID].type === "image") {
          if (
            !settings.get().ocrAk ||
            !settings.get().ocrSk ||
            settings.get().ocrAk == "" ||
            settings.get().ocrSk == ""
          ) {
            showToast("请先设置OCR App Key和Secret Key");
            return;
          }
          const image = ReadImageFile(historyListDataMap[historyID].content);
          OcrImage(
            image.toString("base64"),
            settings.get().ocrAk,
            settings.get().ocrSk
          ).then((result) => {
            console.log(result);
            if (result.length == 0) {
              showToast("OCR 失败");
              return;
            }
            let text = "";
            for (const item of result) {
              text += item.words + "\n";
            }
            historyList.addContentToHistoryList({
              id: GenerateMD5Hash(text),
              content: text,
              type: "text",
            });
            historyList.renderHistoryList();
            showToast("OCR 成功, 已添加到历史记录");
          });
        } else {
          showToast("当前内容不是图片");
        }
      });
    });
  }

  registerSidebarEvent() {
    document
      .getElementById("showHistory")
      .addEventListener("click", () => showSection(HISTORY_SECTION));

    document
      .getElementById("showFavorites")
      .addEventListener("click", () => showSection(FAVORITES_SECTION));

    document
      .getElementById("showSettings")
      .addEventListener("click", () => showSection(SETTINGS_SECTION));

    // 添加键盘事件监听
    document.addEventListener("keydown", this.handleKeyDown.bind(this));
  }

  registerSettingsEvent() {
    const maxHistoryCount = document.getElementById("maxHistoryCount");
    const pasteToSystem = document.getElementById("pasteToSystem");
    const ocrAk = document.getElementById("ocrAk");
    const ocrSk = document.getElementById("ocrSk");
    const clearHistory = document.getElementById("clearHistory");
    const clearFavorites = document.getElementById("clearFavorites");
    const resetTheme = document.getElementById("resetTheme");
    const themeMode = document.getElementById("themeMode");
    const themePreset = document.getElementById("themePreset");
    const primaryColor = document.getElementById("primaryColor");
    const secondaryColor = document.getElementById("secondaryColor");

    // 检查元素是否存在并添加事件监听器
    if (maxHistoryCount) {
      maxHistoryCount.addEventListener("change", (e) => {
        const value = parseInt(e.target.value);
        if (isNaN(value) || value < 1) {
          e.target.value = settings.get().maxHistoryCount;
          return;
        }
        const settingsConfig = settings.get();
        settingsConfig.maxHistoryCount = value;
        settings.set(settingsConfig);
      });
    }

    if (pasteToSystem) {
      pasteToSystem.addEventListener("change", (e) => {
        const settingsConfig = settings.get();
        settingsConfig.pasteToSystem = e.target.checked;
        settings.set(settingsConfig);
      });
    }

    if (ocrAk) {
      ocrAk.addEventListener("change", (e) => {
        const settingsConfig = settings.get();
        settingsConfig.ocrAk = e.target.value;
        settings.set(settingsConfig);
      });
    }

    if (ocrSk) {
      ocrSk.addEventListener("change", (e) => {
        const settingsConfig = settings.get();
        settingsConfig.ocrSk = e.target.value;
        settings.set(settingsConfig);
      });
    }

    if (clearHistory) {
      clearHistory.addEventListener("click", () => {
        createConfirmationModal("确定要清除所有历史记录吗？", () => {
          historyList.clearHistoryList();
        });
      });
    }

    if (clearFavorites) {
      clearFavorites.addEventListener("click", () => {
        createConfirmationModal("确定要清除所有收藏吗？", () => {
          favoritesList.clearFavoritesList();
        });
      });
    }

    // 主题相关事件
    if (resetTheme) {
      resetTheme.addEventListener("click", () => {
        window.themeManager.resetTheme();
        showToast("主题已重置");
      });
    }

    if (themeMode) {
      themeMode.addEventListener("change", (e) => {
        window.themeManager.currentConfig.mode = e.target.value;
        window.themeManager.applyTheme();
      });
    }

    if (themePreset) {
      themePreset.addEventListener("change", (e) => {
        window.themeManager.currentConfig.preset = e.target.value;
        const customSection = document.getElementById("customThemeSection");
        if (customSection) {
          customSection.style.display = e.target.value === "custom" ? "block" : "none";
        }
        window.themeManager.applyTheme();
      });
    }

    if (primaryColor) {
      primaryColor.addEventListener("change", (e) => {
        window.themeManager.currentConfig.customColors.primary = e.target.value;
        if (window.themeManager.currentConfig.preset === "custom") {
          window.themeManager.applyTheme();
        }
      });
    }

    if (secondaryColor) {
      secondaryColor.addEventListener("change", (e) => {
        window.themeManager.currentConfig.customColors.secondary = e.target.value;
        if (window.themeManager.currentConfig.preset === "custom") {
          window.themeManager.applyTheme();
        }
      });
    }
  }

  registerFavoritesItemEvent() {
    const favoritesElement = document.getElementById("favorites");

    favoritesElement.querySelectorAll(".favorite-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (!e.target.closest("button")) {
          e.preventDefault();
          e.stopPropagation();
          const favoritesID = item.getAttribute("favorites-id");
          CopyToSystemClipboard(favoritesListDataMap[favoritesID]);
          if (settings.get().pasteToSystem) {
            setTimeout(() => {
              contentTools.pasteContentToSystem();
            }, 10);
          }
          exitAPP();
        }
      });
    });

    favoritesElement.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const favoritesID = e.target.getAttribute("favorites-id");
        CopyToSystemClipboard(favoritesListDataMap[favoritesID]);
        if (settings.get().pasteToSystem) {
          setTimeout(() => {
            contentTools.pasteContentToSystem();
          }, 10);
        }
        exitAPP();
      });
    });

    favoritesElement.querySelectorAll(".remove-favorite-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const favoritesID = e.target.getAttribute("favorites-id");
        favoritesList.cancelFavorite(favoritesID);
        showToast("取消收藏成功");
      });
    });

    favoritesElement.querySelectorAll(".edit-tags-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const favoritesID = e.target.getAttribute("favorites-id");
        const favoritesItem = favoritesListDataMap[favoritesID];
        const currentTags = favoritesItem.tags
          ? favoritesItem.tags.join(", ")
          : "";

        const searchInput = document.getElementById("search");
        // 在打开模态框前暂时取消搜索框的焦点
        searchInput.blur();

        const modal = createModal(
          "编辑标签",
          `
          <input type="text" id="tagInput" value="${currentTags}" placeholder="输入标签用逗号分隔">
        `
        );

        const confirmButton = modal.querySelector("#modalConfirm");
        const cancelButton = modal.querySelector("#modalCancel");
        const tagInput = modal.querySelector("#tagInput");

        // 自动聚焦到标签输入框
        setTimeout(() => {
          tagInput.focus();
        }, 100);

        confirmButton.addEventListener("click", () => {
          const newTags = tagInput.value;
          const tagArray = newTags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag !== "");
          favoritesList.editTags(favoritesID, tagArray);
          favoritesList.renderFavoritesList();
          document.body.removeChild(modal);
          // 恢复搜索框焦点
          searchInput.focus();
        });

        cancelButton.addEventListener("click", () => {
          document.body.removeChild(modal);
          // 恢复搜索框焦点
          searchInput.focus();
        });
      });
    });

    favoritesElement.querySelectorAll(".open-link-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const favoritesID = e.target.getAttribute("favorites-id");
        const favoritesItem = favoritesListDataMap[favoritesID];
        if (favoritesItem.type === "text" && favoritesItem.content) {
          openLink(favoritesItem.content);
        } else {
          showToast("无效的URL");
        }
      });
    });

    favoritesElement.querySelectorAll(".ocr-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const favoritesID = e.target.getAttribute("favorites-id");
        if (favoritesListDataMap[favoritesID].type === "image") {
          if (
            !settings.get().ocrAk ||
            !settings.get().ocrSk ||
            settings.get().ocrAk == "" ||
            settings.get().ocrSk == ""
          ) {
            showToast("请先设置OCR App Key和Secret Key");
            return;
          }
          const image = ReadImageFile(
            favoritesListDataMap[favoritesID].content
          );
          OcrImage(
            image.toString("base64"),
            settings.get().ocrAk,
            settings.get().ocrSk
          ).then((result) => {
            if (result.length == 0) {
              showToast("OCR 失败");
              return;
            }
            let text = "";
            for (const item of result) {
              text += item.words + "\n";
            }
            historyList.addContentToHistoryList({
              id: GenerateMD5Hash(text),
              content: text,
              type: "text",
            });
            historyList.renderHistoryList();
            showToast("OCR 成功, 已添加到历史记录");
          });
        }
      });
    });
  }

  registerFavoritesEvent() {
    document.getElementById("importFavorites").addEventListener("click", () => {
      const filePath = utools.showOpenDialog({
        title: "导入收藏列表",
        filters: [{ name: "JSON", extensions: ["json"] }],
        properties: ["openFile"],
      });
      if (filePath) {
        favoritesList.importFavoritesList(filePath[0]);
        showToast("收藏列表导入成功");
      }
    });

    document.getElementById("exportFavorites").addEventListener("click", () => {
      const filePath = utools.showSaveDialog({
        title: "导出收藏列表",
        defaultPath: "favorites.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (filePath) {
        favoritesList.exportFavoritesList(filePath, favoritesListDataMap);
        showToast("收藏列表导出成功");
      }
    });
  }

  registerSearchEvent() {
    const searchInput = document.getElementById("search");

    // 搜索输入事件
    searchInput.addEventListener(
      "input",
      (e) => {
        searchKeyword = e.target.value.trim();
        performSearch();
      },
      500
    );

    // 修改失去焦点的处理逻辑
    searchInput.addEventListener("blur", (e) => {
      // 检查当前活动元素是否是标签输入框或模态框内的元素
      const activeElement = document.activeElement;
      if (
        !activeElement.closest(".history-item") &&
        !activeElement.closest(".favorite-item") &&
        !activeElement.closest(".modal") && // 添加对模态框的检查
        !activeElement.id === "tagInput" // 添加对标签输入框的检查
      ) {
        e.target.focus();
      }
    });
  }

  // 添加处理键盘事件的新方法
  handleKeyDown(event) {
    // 如果当前焦点在模态框内或标签输入框上,不处理键盘事件
    const activeElement = document.activeElement;
    if (activeElement.closest(".modal") || activeElement.id === "tagInput") {
      return;
    }

    // 如果是可输入字符且不是功能键
    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      const searchInput = document.getElementById("search");
      // 如果搜索框可见且当前不在编辑标签
      if (searchInput.style.display !== "none") {
        searchInput.focus();
        return;
      }
    }

    if (event.key === "Tab") {
      event.preventDefault();
      this.switchFocusedButton();
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      this.navigateList(event.key === "ArrowUp" ? -1 : 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      this.activateCurrentItem();
    } else if (event.key === "Escape") {
      event.preventDefault();
      // 如果模态框打开,则关闭模态框
      const modal = document.querySelector(".modal");
      if (modal) {
        document.body.removeChild(modal);
        document.getElementById("search").focus();
        return;
      }
      exitAPP();
    }
  }

  switchFocusedButton() {
    const buttons = ["history", "favorites"];
    const currentIndex = buttons.indexOf(currentSelectedTab);
    const nextIndex = (currentIndex + 1) % buttons.length;
    currentSelectedTab = buttons[nextIndex];
    this.updateButtonFocus();
    showSection(
      currentSelectedTab === "favorites" ? FAVORITES_SECTION : HISTORY_SECTION
    );
  }

  updateButtonFocus() {
    document.querySelectorAll(".sidebar-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    document
      .getElementById(
        `show${currentSelectedTab.charAt(0).toUpperCase() + currentSelectedTab.slice(1)}`
      )
      .classList.add("active");
  }

  navigateList(direction) {
    const activeSection = document.querySelector(".content-section.active");
    const items = activeSection.querySelectorAll(
      ".history-item, .favorite-item"
    );
    if (items.length === 0) return;

    currentSelectedItem += direction;
    if (currentSelectedItem < 0) currentSelectedItem = items.length - 1;
    if (currentSelectedItem >= items.length) currentSelectedItem = 0;

    items.forEach((item, index) => {
      item.classList.toggle("selected", index === currentSelectedItem);
    });

    // 确保选中的项目可见
    items[currentSelectedItem].scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }

  activateCurrentItem() {
    const activeSection = document.querySelector(".content-section.active");
    const selectedItem = activeSection.querySelector(
      ".history-item.selected, .favorite-item.selected"
    );
    if (selectedItem) {
      const copyBtn = selectedItem.querySelector(".copy-btn");
      const dataID =
        copyBtn.getAttribute("history-id") ||
        copyBtn.getAttribute("favorites-id");
      const data = historyListDataMap[dataID] || favoritesListDataMap[dataID];
      if (data) {
        CopyToSystemClipboard(data);
        if (settings.get().pasteToSystem) {
          setTimeout(() => {
            contentTools.pasteContentToSystem();
          }, 10);
        }
        exitAPP();
      }
    }
  }

  // 添加更新标签选中状态的方法
  updateTabSelection() {
    const historyButton = document.getElementById("showHistory");
    const favoritesButton = document.getElementById("showFavorites");

    historyButton.classList.toggle("active", currentSelectedTab === "history");
    favoritesButton.classList.toggle(
      "active",
      currentSelectedTab === "favorites"
    );
  }
}

//----------------------------------//
//         History List             //
//----------------------------------//
let historyList = null;
class HistoryList {
  constructor() {
    this.observer = null;
    this.setupIntersectionObserver();
  }

  setupIntersectionObserver() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.hasAttribute('data-src')) {
            img.src = img.getAttribute('data-src');
            img.removeAttribute('data-src');
            img.style.display = 'block';
          }
        }
      });
    }, {
      root: null,
      rootMargin: '50px',
      threshold: 0.1
    });
  }

  addContentToHistoryList(clipboardData) {
    const historyID = clipboardData.id;
    const maxHistoryCount = settings.get().maxHistoryCount;
    
    // 添加检查确保不会添加 null 值
    if (clipboardData && clipboardData.content) {
      if (historyListDataMap[historyID] == null) {
        if (historySortIDList.length >= maxHistoryCount) {
          const deleteID = historySortIDList.pop();
          // 只有当该项不在收藏列表中时才删除文件
          if (
            historyListDataMap[deleteID].type === "image" &&
            !favoritesSortIDList.includes(deleteID)
          ) {
            DeleteFile(historyListDataMap[deleteID].content);
          }
          dbStorage.setData(HISTORY_SORT_ID_LIST, historySortIDList);
          delete historyListDataMap[deleteID];
          // 只有当该项不在收藏列表中时才从数据库中删除
          if (!favoritesSortIDList.includes(deleteID)) {
            dbStorage.removeData(deleteID);
          }
        }
        historySortIDList.unshift(historyID);
        dbStorage.setData(HISTORY_SORT_ID_LIST, historySortIDList);
        historyListDataMap[historyID] = {
          id: historyID,
          content: clipboardData.content,
          type: clipboardData.type,
          timestamp: Date.now(),
        };
        dbStorage.setData(historyID, historyListDataMap[historyID]);
      } else {
        const index = historySortIDList.findIndex((id) => id == historyID);
        if (index == 0) {
          return false;
        }
        historySortIDList.splice(index, 1);
        historySortIDList.unshift(historyID);
        dbStorage.setData(HISTORY_SORT_ID_LIST, historySortIDList);
      }
      return true;
    }
    return false;
  }

  initHistoryList() {
    historySortIDList = dbStorage.getData(HISTORY_SORT_ID_LIST);
    if (historySortIDList == null) {
      historySortIDList = [];
    }
    // 添加过滤步骤
    historySortIDList = historySortIDList.filter((id) => {
      const data = dbStorage.getData(id);
      if (data) {
        historyListDataMap[id] = data;
        return true;
      }
      return false;
    });
    dbStorage.setData(HISTORY_SORT_ID_LIST, historySortIDList);
  }

  clearHistoryList() {
    for (const historyID of historySortIDList) {
      if (
        historyListDataMap[historyID] != null &&
        historyListDataMap[historyID].type === "image" &&
        favoritesListDataMap[historyID] == null
      ) {
        DeleteFile(historyListDataMap[historyID].content);
      }
      delete historyListDataMap[historyID];
      dbStorage.removeData(historyID);
    }
    historySortIDList = [];
    dbStorage.removeData(HISTORY_SORT_ID_LIST);
    this.renderHistoryList();
  }

  renderHistoryList(ids = historySortIDList) {
    const historyElement = document.getElementById("history");
    if (!historyElement) {
      console.error('找不到历史记录容器元素');
      return;
    }

    // 清空现有内容
    historyElement.innerHTML = '';

    // 创建一个文档片段来存储所有新元素
    const fragment = document.createDocumentFragment();

    // 遍历所有历史记录
    ids.forEach(historyID => {
      const historyItem = historyListDataMap[historyID];
      if (!historyItem) return;

      const itemElement = document.createElement('div');
      itemElement.className = 'history-item';
      itemElement.setAttribute('history-id', historyID);

      // 准备内容容器
      const contentDiv = document.createElement('div');
      contentDiv.className = 'content';

      if (historyItem.type === "image") {
        try {
          const imagePath = historyItem.content;
          if (!imagePath) {
            contentDiv.innerHTML = '<p class="error-message">无效的图片路径</p>';
          } else {
            // 检查文件是否存在
            const pathWithoutProtocol = imagePath.replace(/^file:\/\//g, '');
            const fileExists = window.preload.ReadImageFile(pathWithoutProtocol);

            if (!fileExists) {
              contentDiv.innerHTML = '<p class="error-message">图片文件不存在</p>';
            } else {
              const containerId = `image-container-${historyID}`;
              const imageId = `img-${historyID}`;
              
              contentDiv.innerHTML = `
                <div class="image-container" id="${containerId}">
                  <div class="loading-spinner" style="display: block;"></div>
                  <img id="${imageId}"
                       class="clipboard-image"
                       alt="剪贴板图片" 
                       style="max-width: 100%; max-height: 100px; display: none; opacity: 0;"
                       loading="lazy">
                  <p class="error-message" style="display: none;">无法加载图片</p>
                </div>
              `;

              // 等待 DOM 更新后加载图片
              setTimeout(() => {
                const container = document.getElementById(containerId);
                const img = document.getElementById(imageId);
                const spinner = container?.querySelector('.loading-spinner');
                const errorMsg = container?.querySelector('.error-message');

                if (img && container) {
                  // 创建预加载图片
                  const preloadImg = new Image();
                  preloadImg.onload = () => {
                    if (spinner) spinner.style.display = 'none';
                    if (errorMsg) errorMsg.style.display = 'none';
                    img.src = imagePath;
                    img.style.display = 'block';
                    img.style.opacity = '1';
                  };
                  preloadImg.onerror = () => {
                    if (spinner) spinner.style.display = 'none';
                    if (errorMsg) {
                      errorMsg.textContent = '图片加载失败';
                      errorMsg.style.display = 'block';
                    }
                    img.style.display = 'none';
                  };
                  preloadImg.src = imagePath;
                }
              }, 0);
            }
          }
        } catch (error) {
          console.error('处理图片时出错:', error);
          contentDiv.innerHTML = '<p class="error-message">图片处理失败</p>';
        }
      } else {
        contentDiv.innerHTML = contentTools.renderOtherContent(historyItem);
      }

      // 添加操作按钮
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'actions';
      actionsDiv.innerHTML = `
        <button class="copy-btn" history-id="${historyID}">复制</button>
        <button class="export-btn" history-id="${historyID}">导出</button>
        <button class="favorite-btn" history-id="${historyID}">收藏</button>
        <button class="ocr-btn" history-id="${historyID}">OCR</button>
        <span class="timestamp">${new Date(historyItem.timestamp).toLocaleString()}</span>
      `;

      itemElement.appendChild(contentDiv);
      itemElement.appendChild(actionsDiv);
      fragment.appendChild(itemElement);
    });

    // 添加所有元素
    historyElement.appendChild(fragment);

    // 注册事件监听器
    registerEvent.registerHistoryItemEvent();
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  searchHistory(keyword) {
    this.renderHistoryList(
      historySortIDList.filter((id) => {
        if (historyListDataMap[id] == null) return false;
        return historyListDataMap[id].content.includes(keyword);
      })
    );
  }
}

//----------------------------------//
//         Favorites List           //
//----------------------------------//
let favoritesList = null;
class FavoritesList {
  initFavoritesList() {
    favoritesSortIDList = dbStorage.getData(FAVORITES_SORT_ID_LIST);
    if (favoritesSortIDList == null) {
      favoritesSortIDList = [];
    }
    // 过滤掉无效的ID并保存有效数据
    favoritesSortIDList = favoritesSortIDList.filter(id => {
      const data = dbStorage.getData(id);
      if (data && data.content) {
        favoritesListDataMap[id] = data;
        return true;
      }
      return false;
    });
    // 更新存储的ID列表
    dbStorage.setData(FAVORITES_SORT_ID_LIST, favoritesSortIDList);
  }

  addContentToFavoritesList(clipboardData) {
    if (!clipboardData || !clipboardData.id || !clipboardData.content) {
      console.error('Invalid clipboard data:', clipboardData);
      return false;
    }

    let favoritesID = clipboardData.id;
    if (favoritesListDataMap[favoritesID] == null) {
      favoritesSortIDList.unshift(favoritesID);
      dbStorage.setData(FAVORITES_SORT_ID_LIST, favoritesSortIDList);
      
      const favoriteItem = {
        id: favoritesID,
        content: clipboardData.content,
        type: clipboardData.type || 'text',
        tags: clipboardData.tags || [],
        timestamp: Date.now(),
      };
      
      favoritesListDataMap[favoritesID] = favoriteItem;
      dbStorage.setData(favoritesID, favoriteItem);
      return true;
    }
    return false;
  }

  cancelFavorite(favoritesID) {
    const index = favoritesSortIDList.findIndex((id) => id == favoritesID);
    if (index === -1) return;

    // 只有当该项不在历史记录中时才删除文件
    if (
      favoritesListDataMap[favoritesID].type === "image" &&
      !historySortIDList.includes(favoritesID)
    ) {
      DeleteFile(favoritesListDataMap[favoritesID].content);
    }
    
    favoritesSortIDList.splice(index, 1);
    dbStorage.setData(FAVORITES_SORT_ID_LIST, favoritesSortIDList);
    delete favoritesListDataMap[favoritesID];
    // 只有当该项不在历史记录中时才从数据库中删除
    if (!historySortIDList.includes(favoritesID)) {
      dbStorage.removeData(favoritesID);
    }
    this.renderFavoritesList();
  }

  renderFavoritesList(ids = favoritesSortIDList) {
    const favoritesElement = document.getElementById("favorites");
    favoritesElement.innerHTML = ""; // 清空现有内容

    const fragment = document.createDocumentFragment();

    ids.forEach(favoritesID => {
      const favoritesItem = favoritesListDataMap[favoritesID];
      if (!favoritesItem) return;

      const itemElement = document.createElement("div");
      itemElement.className = "history-item favorite-item";
      itemElement.setAttribute("favorites-id", favoritesID);

      // 准备内容容器
      const contentDiv = document.createElement("div");
      contentDiv.className = "content";

      if (favoritesItem.type === "image") {
        try {
          const imagePath = favoritesItem.content;
          if (!imagePath) {
            contentDiv.innerHTML = '<p class="error-message">无效的图片路径</p>';
          } else {
            // 检查文件是否存在
            const pathWithoutProtocol = imagePath.replace(/^file:\/\//g, '');
            const fileExists = window.preload.ReadImageFile(pathWithoutProtocol);

            if (!fileExists) {
              contentDiv.innerHTML = '<p class="error-message">图片文件不存在</p>';
            } else {
              const containerId = `image-container-fav-${favoritesID}`;
              const imageId = `img-fav-${favoritesID}`;
              
              contentDiv.innerHTML = `
                <div class="image-container" id="${containerId}">
                  <div class="loading-spinner" style="display: block;"></div>
                  <img id="${imageId}"
                       class="clipboard-image"
                       alt="剪贴板图片" 
                       style="max-width: 100%; max-height: 100px; display: none; opacity: 0;"
                       loading="lazy">
                  <p class="error-message" style="display: none;">无法加载图片</p>
                </div>
              `;

              // 等待 DOM 更新后加载图片
              setTimeout(() => {
                const container = document.getElementById(containerId);
                const img = document.getElementById(imageId);
                const spinner = container?.querySelector('.loading-spinner');
                const errorMsg = container?.querySelector('.error-message');

                if (img && container) {
                  // 创建预加载图片
                  const preloadImg = new Image();
                  preloadImg.onload = () => {
                    if (spinner) spinner.style.display = 'none';
                    if (errorMsg) errorMsg.style.display = 'none';
                    img.src = imagePath;
                    img.style.display = 'block';
                    img.style.opacity = '1';
                  };
                  preloadImg.onerror = () => {
                    if (spinner) spinner.style.display = 'none';
                    if (errorMsg) {
                      errorMsg.textContent = '图片加载失败';
                      errorMsg.style.display = 'block';
                    }
                    img.style.display = 'none';
                  };
                  preloadImg.src = imagePath;
                }
              }, 0);
            }
          }
        } catch (error) {
          console.error('处理图片时出错:', error);
          contentDiv.innerHTML = '<p class="error-message">图片处理失败</p>';
        }
      } else {
        contentDiv.innerHTML = contentTools.renderContent(favoritesItem);
      }

      // 添加标签
      const tagsDiv = document.createElement("div");
      tagsDiv.className = "tags";
      tagsDiv.innerHTML = this._renderTags(favoritesItem.tags);

      // 添加操作按钮
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "actions";
      actionsDiv.innerHTML = `
        <button class="copy-btn" favorites-id="${favoritesID}">复制</button>
        <button class="remove-favorite-btn" favorites-id="${favoritesID}">取消收藏</button>
        <button class="edit-tags-btn" favorites-id="${favoritesID}">编辑标签</button>
        <button class="open-link-btn" favorites-id="${favoritesID}">打开链接</button>
        <button class="ocr-btn" favorites-id="${favoritesID}">OCR</button>
        <span class="timestamp">${new Date(favoritesItem.timestamp).toLocaleString()}</span>
      `;

      itemElement.appendChild(contentDiv);
      itemElement.appendChild(tagsDiv);
      itemElement.appendChild(actionsDiv);
      fragment.appendChild(itemElement);
    });

    // 添加所有元素
    favoritesElement.appendChild(fragment);

    // 注册事件监听器
    registerEvent.registerFavoritesItemEvent();
  }

  _renderTags(tags) {
    if (!tags || !Array.isArray(tags)) {
      return "";
    }
    return tags.map((tag) => `<span class="tag">${tag}</span>`).join("");
  }

  editTags(favoritesID, tags) {
    favoritesListDataMap[favoritesID].tags = String(tags).split(",");
    dbStorage.setData(favoritesID, favoritesListDataMap[favoritesID]);
    this.renderFavoritesList();
  }

  searchFavorites(keyword) {
    this.renderFavoritesList(
      favoritesSortIDList.filter((id) => {
        if (favoritesListDataMap[id] == null) return false;
        if (keyword.startsWith("#")) {
          return this.tagsIncludes(
            favoritesListDataMap[id].tags,
            keyword.split("#")[1]
          );
        }
        return favoritesListDataMap[id].content.includes(keyword);
      })
    );
  }

  tagsIncludes(tags, keyword) {
    if (tags == null) return false;
    for (const tag of tags) {
      if (tag.includes(keyword)) return true;
    }
    return false;
  }

  exportFavoritesList(filePath, data) {
    for (const [k, v] of Object.entries(data)) {
      if (v == null) delete data[k];
      if (v.type === "image") {
        data[k].content = ReadImageFile(v.content);
      }
    }
    ExportFavoritesFile(filePath, JSON.stringify(data));
  }

  importFavoritesList(filePath) {
    const data = ReadFavoritesFile(filePath);
    if (data == null) return;
    for (const [_, v] of Object.entries(data)) {
      if (v == null) continue;
      if (v.type === "image") {
        // 检查 Buffer 是否可用，如果不可用，使用替代方法
        if (window.preload.Buffer && window.preload.Buffer.from) {
          v.content = SaveFile(
            window.preload.Buffer.from(v.content.data),
            `clipboard_image_${v.id}.png`
          );
        } else {
          // 使用替代方法，例如 Uint8Array
          v.content = SaveFile(
            new Uint8Array(v.content.data),
            `clipboard_image_${v.id}.png`
          );
        }
      }
      this.addContentToFavoritesList(v);
    }
    this.renderFavoritesList();
  }

  clearFavoritesList() {
    for (const favoritesID of favoritesSortIDList) {
      if (
        favoritesListDataMap[favoritesID] != null &&
        favoritesListDataMap[favoritesID].type === "image" &&
        historyListDataMap[favoritesID] == null
      ) {
        DeleteFile(favoritesListDataMap[favoritesID].content);
      }
      delete favoritesListDataMap[favoritesID];
      dbStorage.removeData(favoritesID);
    }
    favoritesSortIDList = [];
    dbStorage.removeData(FAVORITES_SORT_ID_LIST);
    this.renderFavoritesList();
  }
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 2000);
}

function showSection(sectionId = HISTORY_SECTION) {
  if (sectionId === FAVORITES_SECTION) {
    favoritesList.renderFavoritesList();
    currentSelectedTab = "favorites";
  } else if (sectionId === HISTORY_SECTION) {
    currentSelectedTab = "history";
  }
  document.querySelectorAll(".content-section").forEach((section) => {
    section.classList.remove("active");
  });
  document.getElementById(sectionId).classList.add("active");

  document.querySelectorAll(".sidebar-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document
    .querySelector(
      `#show${sectionId.charAt(0).toUpperCase() + sectionId.slice(1)}`
    )
    .classList.add("active");

  const searchInput = document.getElementById("search");
  const importFavoritesBtn = document.getElementById("importFavorites");
  const exportFavoritesBtn = document.getElementById("exportFavorites");

  if (sectionId === HISTORY_SECTION || sectionId === FAVORITES_SECTION) {
    searchInput.style.display = "block";
    importFavoritesBtn.style.display =
      sectionId === FAVORITES_SECTION ? "block" : "none";
    exportFavoritesBtn.style.display =
      sectionId === FAVORITES_SECTION ? "block" : "none";

    if (sectionId === HISTORY_SECTION) {
      searchInput.setAttribute("placeholder", "搜索历史记录...");
    } else {
      searchInput.setAttribute(
        "placeholder",
        "搜索收藏...（使用 #标签 搜索标签）"
      );
    }
  } else {
    searchInput.style.display = "none";
    importFavoritesBtn.style.display = "none";
    exportFavoritesBtn.style.display = "none";
  }

  if (sectionId === SETTINGS_SECTION) {
    document.getElementById("maxHistoryCount").value =
      settings.get().maxHistoryCount;
    document.getElementById("pasteToSystem").checked =
      settings.get().pasteToSystem;
    document.getElementById("ocrAk").value = settings.get().ocrAk;
    document.getElementById("ocrSk").value = settings.get().ocrSk;
  }

  // 重置当前选中的项目
  currentSelectedItem = -1;
  // 移除所有项目的选中状态
  document.querySelectorAll(".history-item, .favorite-item").forEach((item) => {
    item.classList.remove("selected");
  });

  // 更新当前焦点按钮
  currentSelectedTab =
    sectionId === SETTINGS_SECTION
      ? "settings"
      : sectionId === FAVORITES_SECTION
        ? "favorites"
        : "history";
  registerEvent.updateButtonFocus();

  // 在函数末尾添加:
  registerEvent.updateTabSelection();

  searchInput.blur();
}

function openLink(url) {
  try {
    const validUrl = new URL(url);
    utools.shellOpenExternal(validUrl.href);
  } catch (e) {
    showToast("无效的URL");
  }
}

function createModal(title, content) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content">
      <h2>${title}</h2>
      ${content}
      <div class="modal-actions">
        <button id="modalCancel">取消</button>
        <button id="modalConfirm">确定</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function createConfirmationModal(message, onConfirm) {
  const modal = createModal("清除历史", `<p>${message}</p>`);

  const confirmButton = modal.querySelector("#modalConfirm");
  const cancelButton = modal.querySelector("#modalCancel");

  confirmButton.addEventListener("click", () => {
    onConfirm();
    document.body.removeChild(modal);
  });

  cancelButton.addEventListener("click", () => {
    document.body.removeChild(modal);
  });
}

function performSearch() {
  const activeSection = document.querySelector(".content-section.active").id;
  if (activeSection === HISTORY_SECTION) {
    historyList.searchHistory(searchKeyword);
  } else {
    favoritesList.searchFavorites(searchKeyword);
  }
}

function adjustSidebarWidth() {
  const sidebar = document.getElementById("sidebar");
  const buttons = sidebar.querySelectorAll(".sidebar-btn");
  let maxWidth = 120;

  buttons.forEach((button) => {
    const width = button.offsetWidth;
    if (width > maxWidth) {
      maxWidth = width;
    }
  });

  const fixedWidth = Math.max(maxWidth + 40, 160);
  sidebar.style.width = `${fixedWidth}px`;

  buttons.forEach((button) => {
    button.style.width = `${fixedWidth - 30}px`;
  });
}

function exitAPP() {
  searchKeyword = "";
  document.getElementById("search").value = "";
  if (contentTools) {
    contentTools.destroy();
  }
  utools.hideMainWindow();
  utools.outPlugin();
}

function initAPP() {
  settings = new Settings();
  settings.init();

  // 初始化主题管理器
  window.themeManager = new ThemeManager();

  contentTools = new ContentTools();

  // register event
  registerEvent = new RegisterEvent();
  registerEvent.registerSidebarEvent();
  registerEvent.registerSettingsEvent();
  registerEvent.registerSearchEvent();
  registerEvent.registerFavoritesEvent();
  registerEvent.updateButtonFocus();

  historyList = new HistoryList();
  historyList.initHistoryList();
  historyList.renderHistoryList();

  favoritesList = new FavoritesList();
  favoritesList.initFavoritesList();
  favoritesList.renderFavoritesList();

  showSection(HISTORY_SECTION);
  adjustSidebarWidth();

  CheckSystemClipboard(async (clipboardData) => {
    await historyList.addContentToHistoryList(clipboardData);
    historyList.renderHistoryList();
  });

  // 检查必要的 preload 函数是否都已正确加载
  const requiredPreloadFunctions = [
    "dbStorage",
    "CheckSystemClipboard",
    "CopyToSystemClipboard",
    "GenerateMD5Hash",
    "ExportSingleHistoryItem",
    "ReadFavoritesFile",
    "ExportFavoritesFile",
    "SaveFile",
    "DeleteFile",
    "ReadImageFile",
    "Buffer",
  ];

  for (const func of requiredPreloadFunctions) {
    if (typeof window.preload[func] === "undefined") {
      console.error(`预加载函数 ${func} 未定义。请检查 preload.js 文件。`);
    }
  }
}

initAPP();

