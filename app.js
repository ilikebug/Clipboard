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

let contentTools = null;
class ContentTools {
  renderContent(item) {
    if (item.type === "image") {
      return `
        <div class="image-container">
          <div class="loading-spinner"></div>
          <img src="${item.content}" 
               alt="Clipboard image" 
               style="max-width: 100%; max-height: 100px; display: none;" 
               onload="this.style.display='inline'; this.previousElementSibling.style.display='none';"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
          <p style="display: none;">无法加载图片</p>
        </div>
      `;
    }
    switch (item.type) {
      case "text":
        return this.formatTextContent(item.content);
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
    document.getElementById("saveSettings").addEventListener("click", () => {
      const maxHistoryCount = document.getElementById("maxHistoryCount").value;
      const pasteToSystem = document.getElementById("pasteToSystem").checked;
      const ocrAk = document.getElementById("ocrAk").value;
      const ocrSk = document.getElementById("ocrSk").value;
      settings.set({ maxHistoryCount, pasteToSystem, ocrAk, ocrSk });
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

    // 搜索框失去焦点时的处理
    searchInput.addEventListener("blur", (e) => {
      // 如果不是点击了列表项,就保持焦点在搜索框
      const activeElement = document.activeElement;
      if (
        !activeElement.closest(".history-item") &&
        !activeElement.closest(".favorite-item")
      ) {
        e.target.focus();
      }
    });
  }

  // 添加处理键盘事件的新方法
  handleKeyDown(event) {
    // 如果是可输入字符且不是功能键
    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      const searchInput = document.getElementById("search");
      // 如果搜索框可见
      if (searchInput.style.display !== "none") {
        searchInput.focus();
        // 不要阻止默认行为,让字符能输入到搜索框
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
  addContentToHistoryList(clipboardData) {
    const historyID = clipboardData.id;
    const maxHistoryCount = settings.get().maxHistoryCount;
    // 添加检查确保不会添加 null 值
    if (clipboardData && clipboardData.content) {
      if (historyListDataMap[historyID] == null) {
        if (historySortIDList.length >= maxHistoryCount) {
          const deleteID = historySortIDList.pop();
          if (
            historyListDataMap[deleteID].type === "image" &&
            favoritesListDataMap[deleteID] == null
          ) {
            DeleteFile(historyListDataMap[deleteID].content);
          }
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
    historyElement.innerHTML = ""; // 清空现有内容

    const batchSize = 10; // 每批渲染的项目数
    let currentIndex = 0;

    const renderBatch = () => {
      const fragment = document.createDocumentFragment();
      const endIndex = Math.min(currentIndex + batchSize, ids.length);

      for (let i = currentIndex; i < endIndex; i++) {
        const historyID = ids[i];
        const historyItem = historyListDataMap[historyID];
        if (historyItem == null) continue;

        const itemElement = document.createElement("div");
        itemElement.className = "history-item";
        itemElement.setAttribute("history-id", historyID);
        itemElement.innerHTML = `
          <div class="content">
            ${contentTools.renderContent(historyItem)}
          </div>
          <div class="actions">
            <button class="copy-btn" history-id="${historyID}">复制</button>
            <button class="export-btn" history-id="${historyID}">导出</button>
            <button class="favorite-btn" history-id="${historyID}">收藏</button>
            <button class="ocr-btn" history-id="${historyID}">OCR</button>
            <span class="timestamp">${new Date(historyItem.timestamp).toLocaleString()}</span>
          </div>
        `;
        fragment.appendChild(itemElement);
      }

      historyElement.appendChild(fragment);
      currentIndex = endIndex;

      if (currentIndex < ids.length) {
        // 如果还有更多项目要渲染，安排下一批
        requestAnimationFrame(renderBatch);
      } else {
        // 所有项目都已渲染完毕，注册事件
        registerEvent.registerHistoryItemEvent();
      }
    };

    // 开始渲染第一批
    renderBatch();
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
    let favoritesID = clipboardData.id;
    if (favoritesListDataMap[favoritesID] == null) {
      favoritesSortIDList.unshift(favoritesID);
      dbStorage.setData(FAVORITES_SORT_ID_LIST, favoritesSortIDList);
      favoritesListDataMap[favoritesID] = {
        id: favoritesID,
        content: clipboardData.content,
        type: clipboardData.type,
        tags: clipboardData.tags,
        timestamp: Date.now(),
      };
      dbStorage.setData(favoritesID, favoritesListDataMap[favoritesID]);
    }
  }

  cancelFavorite(favoritesID) {
    const index = favoritesSortIDList.findIndex((id) => id == favoritesID);
    if (
      favoritesListDataMap[favoritesID].type === "image" &&
      historyListDataMap[favoritesID] == null
    ) {
      DeleteFile(favoritesListDataMap[favoritesID].content);
    }
    favoritesSortIDList.splice(index, 1);
    dbStorage.setData(FAVORITES_SORT_ID_LIST, favoritesSortIDList);
    delete favoritesListDataMap[favoritesID];
    dbStorage.removeData(favoritesID);
    this.renderFavoritesList();
  }

  renderFavoritesList(ids = favoritesSortIDList) {
    const favoritesElement = document.getElementById("favorites");
    favoritesElement.innerHTML = ""; // 清空现有内容

    const batchSize = 10; // 每批渲染的项目数
    let currentIndex = 0;

    const renderBatch = () => {
      const fragment = document.createDocumentFragment();
      const endIndex = Math.min(currentIndex + batchSize, ids.length);

      for (let i = currentIndex; i < endIndex; i++) {
        const favoritesID = ids[i];
        const favoritesItem = favoritesListDataMap[favoritesID];
        if (favoritesItem == null) continue;

        const itemElement = document.createElement("div");
        itemElement.className = "history-item favorite-item";
        itemElement.setAttribute("favorites-id", favoritesID);
        itemElement.innerHTML = `
          <div class="content">
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
            <button class="ocr-btn" favorites-id="${favoritesID}">OCR</button>
            <span class="timestamp">${new Date(favoritesItem.timestamp).toLocaleString()}</span>
          </div>
        `;
        fragment.appendChild(itemElement);
      }

      favoritesElement.appendChild(fragment);
      currentIndex = endIndex;

      if (currentIndex < ids.length) {
        // 如果还有更多项目要渲染，安排下一批
        requestAnimationFrame(renderBatch);
      } else {
        // 所项目都已渲染完毕，注册事件
        registerEvent.registerFavoritesItemEvent();
      }
    };

    // 开始渲染第一批
    renderBatch();
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
  utools.hideMainWindow();
  utools.outPlugin();
}

function initAPP() {
  settings = new Settings();
  settings.init();

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
