const {
  dbStorage,

  CheckSystemClipboard,
  CopyToSystemClipboard,

  GenerateMD5Hash,

  ExportSingleHistoryItem,

  GetMemoryUsage,

  ReadFile,
  ExportFile,
} = window.preload;

const CHECK_CLIPBOARD_INTERVAL = 200;
const SHOW_MEMORY_USAGE_INTERVAL = 1000;

const HISTORY_SORT_ID_LIST = "HISTORY_SORT_ID_LIST";
const FAVORITES_SORT_ID_LIST = "FAVORITES_SORT_ID_LIST";

const HISTORY_SECTION = "history";
const FAVORITES_SECTION = "favorites";
const SETTINGS_SECTION = "settings";

const defaultSettingsConfig = {
  maxHistoryCount: 100,
  pasteToSystem: true,
  showMemoryUsage: false,
};

let historySortIDList = [];
let historyListDataMap = {};

let favoritesSortIDList = [];
let favoritesListDataMap = {};

let searchKeyword = "";

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

let contentTools = null;
class ContentTools {
  renderContent(item) {
    switch (item.type) {
      case "text":
        return this.formatTextContent(item.content);
      case "image":
        // 使用缩略图或懒加载技术
        return `<img src="${item.content}" alt="Clipboard image" style="max-width: 100%; max-height: 100px;" loading="lazy">`;
      case "files":
        return `<p>文件: ${item.content}</p>`;
      default:
        return `<p>未知类型: ${item.type}</p>`;
    }
  }

  formatTextContent(text) {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlPattern, (url) => {
      return `<a href="${url}" class="link-mention" target="_blank">${url}</a>`;
    });
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  pasteContentToSystem() {
    if (utools.isMacOS()) {
      utools.simulateKeyboardTap("v", "command");
    } else {
      utools.simulateKeyboardTap("v", "ctrl");
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

    historyElement.querySelectorAll(".history-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (!e.target.closest("button")) {
          e.preventDefault();
          e.stopPropagation();
          const historyID = item.getAttribute("history-id");
          CopyToSystemClipboard(historyListDataMap[historyID]);
          if (settings.get().pasteToSystem) {
            contentTools.pasteContentToSystem();
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
          contentTools.pasteContentToSystem();
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
  }

  registerSettingsEvent() {
    document.getElementById("saveSettings").addEventListener("click", () => {
      const maxHistoryCount = document.getElementById("maxHistoryCount").value;
      const pasteToSystem = document.getElementById("pasteToSystem").checked;
      const showMemoryUsage =
        document.getElementById("showMemoryUsage").checked;
      settings.set({
        maxHistoryCount,
        pasteToSystem,
        showMemoryUsage,
      });
      showToast("设置保存成功");
    });

    document.getElementById("resetSettings").addEventListener("click", () => {
      settings.set(defaultSettingsConfig);
      showToast("设置重置成功");
      showSection(SETTINGS_SECTION);
    });
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
            contentTools.pasteContentToSystem();
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
          contentTools.pasteContentToSystem();
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

        const modal = createModal(
          "编辑标签",
          `
          <input type="text" id="tagInput" value="${currentTags}" placeholder="输入标签用逗号分隔">
        `
        );

        const confirmButton = modal.querySelector("#modalConfirm");
        const cancelButton = modal.querySelector("#modalCancel");
        const tagInput = modal.querySelector("#tagInput");

        confirmButton.addEventListener("click", () => {
          const newTags = tagInput.value;
          const tagArray = newTags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag !== "");
          favoritesList.editTags(favoritesID, tagArray);
          favoritesList.renderFavoritesList();
          document.body.removeChild(modal);
        });

        cancelButton.addEventListener("click", () => {
          document.body.removeChild(modal);
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

  registerClearHistoryEvent() {
    document.getElementById("clearHistory").addEventListener("click", () => {
      createConfirmationModal("确定要清空所有历史记录吗？", () => {
        historyList.clearHistoryList();
        showToast("历史记录已清空");
      });
    });
  }

  registerSearchEvent() {
    const searchInput = document.getElementById("search");
    searchInput.addEventListener(
      "input",
      (e) => {
        searchKeyword = e.target.value.trim();
        performSearch();
      },
      500
    );
  }
}

//----------------------------------//
//         History List             //
//----------------------------------//
let historyList = null;
class HistoryList {
  TimedCheckClipboard(t) {
    setInterval(() => {
      const clipboardData = CheckSystemClipboard();
      if (clipboardData == null) return;
      const success = this.addContentToHistoryList(clipboardData);
      if (success) {
        this.renderHistoryList();
      }
    }, t);
  }

  addContentToHistoryList(clipboardData) {
    const historyID = GenerateMD5Hash(clipboardData.content);
    const maxHistoryCount = settings.get().maxHistoryCount;
    if (historyListDataMap[historyID] == null) {
      if (historySortIDList.length >= maxHistoryCount) {
        const deleteID = historySortIDList.pop();
        dbStorage.setData(HISTORY_SORT_ID_LIST, historySortIDList);
        delete historyListDataMap[deleteID];
        dbStorage.removeData(deleteID);
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

  initHistoryList() {
    historySortIDList = dbStorage.getData(HISTORY_SORT_ID_LIST);
    if (historySortIDList == null) {
      historySortIDList = [];
    }
    for (const id of historySortIDList) {
      historyListDataMap[id] = dbStorage.getData(id);
    }
  }

  clearHistoryList() {
    for (const historyID of historySortIDList) {
      delete historyListDataMap[historyID];
      dbStorage.removeData(historyID);
    }
    historySortIDList = [];
    dbStorage.removeData(HISTORY_SORT_ID_LIST);
    this.renderHistoryList();
  }

  renderHistoryList(ids = historySortIDList) {
    const historyElement = document.getElementById("history");

    let historyItemHTMLList = [];
    for (const historyID of ids) {
      const historyItem = historyListDataMap[historyID];
      if (historyItem == null) continue;
      historyItemHTMLList.push(`
      <div class="history-item" history-id="${historyID}">
        <div class="content" title="${contentTools.escapeHtml(historyItem.content)}">
          ${contentTools.renderContent(historyItem)}
        </div>
        <div class="actions">
          <button class="copy-btn" history-id="${historyID}">复制</button>
          <button class="export-btn" history-id="${historyID}">导出</button>
          <button class="favorite-btn" history-id="${historyID}">收藏</button>
          <span class="timestamp">${new Date(historyItem.timestamp).toLocaleString()}</span>
        </div>
      </div>
    `);
    }
    historyElement.innerHTML = historyItemHTMLList.join("");
    registerEvent.registerHistoryItemEvent();
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
    for (const id of favoritesSortIDList) {
      favoritesListDataMap[id] = dbStorage.getData(id);
    }
  }

  addContentToFavoritesList(clipboardData) {
    const favoritesID = GenerateMD5Hash(clipboardData.content);
    if (favoritesListDataMap[favoritesID] == null) {
      favoritesSortIDList.unshift(favoritesID);
      dbStorage.setData(FAVORITES_SORT_ID_LIST, favoritesSortIDList);
      favoritesListDataMap[favoritesID] = {
        id: favoritesID,
        content: clipboardData.content,
        type: clipboardData.type,
        timestamp: Date.now(),
      };
      dbStorage.setData(favoritesID, favoritesListDataMap[favoritesID]);
    }
  }

  cancelFavorite(favoritesID) {
    const index = favoritesSortIDList.findIndex((id) => id == favoritesID);
    favoritesSortIDList.splice(index, 1);
    dbStorage.setData(FAVORITES_SORT_ID_LIST, favoritesSortIDList);
    delete favoritesListDataMap[favoritesID];
    dbStorage.removeData(favoritesID);
    this.renderFavoritesList();
  }

  renderFavoritesList(ids = favoritesSortIDList) {
    const favoritesElement = document.getElementById("favorites");
    let favoritesItemHTMLList = [];
    for (const favoritesID of ids) {
      let favoritesItem = favoritesListDataMap[favoritesID];
      if (favoritesItem == null) continue;
      favoritesItemHTMLList.push(`
      <div class="history-item favorite-item" favorites-id="${favoritesID}">
        <div class="content" title="${contentTools.escapeHtml(favoritesItem.content)}">
          ${contentTools.renderContent(favoritesItem)}
        </div>
        <div class="tags">
          ${this._renderTags(favoritesItem.tags)}
        </div>
        <div class="actions">
          <button class="copy-btn" favorites-id="${favoritesID}">复制</button>
          <button class="remove-favorite-btn" favorites-id="${favoritesID}">取消收藏</button>
          <button class="edit-tags-btn" favorites-id="${favoritesID}">编辑标签</button>
          <button class="open-link-btn" favorites-id="${favoritesID}">打开链接</button>
          <span class="timestamp">${new Date(favoritesItem.timestamp).toLocaleString()}</span>
        </div>
      </div>
      `);
    }
    favoritesElement.innerHTML = favoritesItemHTMLList.join("");
    registerEvent.registerFavoritesItemEvent();
  }

  _renderTags(tags) {
    if (!tags || !Array.isArray(tags)) {
      return "";
    }
    return tags.map((tag) => `<span class="tag">${tag}</span>`).join("");
  }

  editTags(favoritesID, tags) {
    favoritesListDataMap[favoritesID].tags = tags;
    dbStorage.setData(favoritesID, favoritesListDataMap[favoritesID]);
    this.renderFavoritesList();
  }

  searchFavorites(keyword) {
    this.renderFavoritesList(
      favoritesSortIDList.filter((id) => {
        if (favoritesListDataMap[id] == null) return false;
        if (keyword.startsWith("#")) {
          if (favoritesListDataMap[id].tags == null) return false;
          return favoritesListDataMap[id].tags.includes(keyword.slice(1));
        }
        return favoritesListDataMap[id].content.includes(keyword);
      })
    );
  }

  exportFavoritesList(filePath, data) {
    for (const [k, v] of Object.entries(data)) {
      if (v == null) delete data[k];
    }
    ExportFile(filePath, JSON.stringify(data));
  }

  importFavoritesList(filePath) {
    const data = ReadFile(filePath);
    if (data == null) return;
    for (const [_, v] of Object.entries(data)) {
      if (v == null) continue;
      this.addContentToFavoritesList(v);
    }
    this.renderFavoritesList();
  }

  clearFavoritesList() {
    for (const favoritesID of favoritesSortIDList) {
      delete favoritesListDataMap[favoritesID];
      dbStorage.removeData(favoritesID);
    }
    favoritesSortIDList = [];
    dbStorage.removeData(FAVORITES_SORT_ID_LIST);
    this.renderFavoritesList();
  }
}

function renderMemoryUsage() {
  setInterval(() => {
    const memoryUsageElement = document.getElementById("memory-usage");
    if (settings.get().showMemoryUsage) {
      memoryUsageElement.style.display = "block";
      const memoryInfo = GetMemoryUsage();
      const memoryInfoElement = document.getElementById("memory-info");
      memoryInfoElement.innerHTML = `
      <div class="memory-info-line">内存使用情况:</div>
      <div class="memory-info-line">Usage: ${memoryInfo.usage}</div>
      `;
    } else {
      memoryUsageElement.style.display = "none";
    }
  }, SHOW_MEMORY_USAGE_INTERVAL);
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

  const clearHistoryBtn = document.getElementById("clearHistory");
  const searchInput = document.getElementById("search");
  const importFavoritesBtn = document.getElementById("importFavorites");
  const exportFavoritesBtn = document.getElementById("exportFavorites");

  if (sectionId === HISTORY_SECTION || sectionId === FAVORITES_SECTION) {
    searchInput.style.display = "block";
    clearHistoryBtn.style.display =
      sectionId === HISTORY_SECTION ? "block" : "none";
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
    clearHistoryBtn.style.display = "none";
    searchInput.style.display = "none";
    importFavoritesBtn.style.display = "none";
    exportFavoritesBtn.style.display = "none";
  }

  if (sectionId === SETTINGS_SECTION) {
    document.getElementById("maxHistoryCount").value =
      settings.get().maxHistoryCount;
    document.getElementById("pasteToSystem").checked =
      settings.get().pasteToSystem;
    document.getElementById("showMemoryUsage").checked =
      settings.get().showMemoryUsage;
  }
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
  utools.hideMainWindow();
  utools.outPlugin();
}

utools.onPluginEnter(() => {
  // register event
  registerEvent.registerSidebarEvent();
  registerEvent.registerSettingsEvent();
  registerEvent.registerClearHistoryEvent();
  registerEvent.registerSearchEvent();
  registerEvent.registerFavoritesEvent();
  // need to render history list when the first enter app
  historyList.renderHistoryList();
  // need to render favorites list when the first enter app
  favoritesList.renderFavoritesList();
  // default show history section
  showSection(HISTORY_SECTION);
});

function initAPP() {
  settings = new Settings();
  settings.init();

  contentTools = new ContentTools();
  registerEvent = new RegisterEvent();

  // show memory usage
  renderMemoryUsage();
  adjustSidebarWidth();

  historyList = new HistoryList();
  historyList.initHistoryList();
  historyList.TimedCheckClipboard(CHECK_CLIPBOARD_INTERVAL);

  favoritesList = new FavoritesList();
  favoritesList.initFavoritesList();
}

initAPP();
