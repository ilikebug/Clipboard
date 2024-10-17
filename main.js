const { loadSettings, saveSettings: saveSettingsToStorage, loadClipboardHistory, removeHistoryItem, clearHistory, searchHistory, getClipboardHistory, getSettings, setSettings, exportSingleItem, addToFavorites, removeFromFavorites, getFavorites, loadFavorites, setClipboardHistory, checkClipboard } = window.preload;
// const { ipcRenderer } = require('electron');

let currentSearchKeyword = '';
// 在文件顶部添加一个新的变量
let currentSelectedIndex = -1;
// 在文件顶部添加一个新的变量来跟踪当前选中的按钮
let currentSelectedButton = 'history';

// 添加这个新函数来处理Tab键的切换
function handleTabNavigation(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    currentSelectedButton = currentSelectedButton === 'history' ? 'favorites' : 'history';
    showSection(currentSelectedButton);
  }
}

// 添加这个新函数来处理键盘事件
function handleKeyboardNavigation(e) {
  if (e.key === 'Tab') {
    handleTabNavigation(e);
    return;
  }

  const activeSection = document.querySelector('.content-section.active');
  const items = activeSection.querySelectorAll('.history-item, .favorite-item');
  if (items.length === 0) return;

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    currentSelectedIndex = (currentSelectedIndex > 0) ? currentSelectedIndex - 1 : items.length - 1;
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    currentSelectedIndex = (currentSelectedIndex < items.length - 1) ? currentSelectedIndex + 1 : 0;
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (currentSelectedIndex >= 0 && currentSelectedIndex < items.length) {
      const selectedItem = items[currentSelectedIndex];
      const index = parseInt(selectedItem.getAttribute('data-index'), 10);
      if (activeSection.id === 'history') {
        copyItem(index);
      } else if (activeSection.id === 'favorites') {
        copyFavoriteItem(index);
      }
    }
  }

  updateSelectedItem();
  scrollToSelectedItem();
}

// 添加这个新函数来更新选中项的视觉效果
function updateSelectedItem() {
  const activeSection = document.querySelector('.content-section.active');
  const items = activeSection.querySelectorAll('.history-item, .favorite-item');
  items.forEach((item, index) => {
    if (index === currentSelectedIndex) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

// 在文件开头添加以下函数
function showSection(sectionId) {
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.remove('active');
  });
  document.getElementById(sectionId).classList.add('active');
  
  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`#show${sectionId.charAt(0).toUpperCase() + sectionId.slice(1)}`).classList.add('active');

  // 更新当前选中的按钮
  currentSelectedButton = sectionId;

  // 控制清空历史按钮和搜索框的可见性
  const clearHistoryBtn = document.getElementById('clearHistory');
  const searchInput = document.getElementById('search');
  if (sectionId === 'history' || sectionId === 'favorites') {
    clearHistoryBtn.style.display = sectionId === 'history' ? 'block' : 'none';
    searchInput.style.display = 'block';
    // 切换页面时,保持搜索框的内容并触发搜索
    searchInput.value = currentSearchKeyword;
    
    // 根据当前页面设置搜索框的占位符文本
    if (sectionId === 'history') {
      searchInput.setAttribute('placeholder', '搜索历史记录...');
    } else {
      searchInput.setAttribute('placeholder', '搜索收藏...（使用 #标签 搜索标签）');
    }
    
    performSearch(currentSearchKeyword, sectionId);
  } else {
    clearHistoryBtn.style.display = 'none';
    searchInput.style.display = 'none';
  }

  // 如果显示的是设置页,载设置
  if (sectionId === 'settings') {
    loadSettingsUI();
  }

  // 重置选中索引并更新选中项
  currentSelectedIndex = -1;
  updateSelectedItem();
  
  // 如果是历史记录或收藏页面,将焦点设置到第一个项目
  if (sectionId === 'history' || sectionId === 'favorites') {
    const items = document.querySelectorAll(`#${sectionId} .history-item, #${sectionId} .favorite-item`);
    if (items.length > 0) {
      currentSelectedIndex = 0;
      updateSelectedItem();
      scrollToSelectedItem();
    }
  }
}

function updateHistory() {
  const history = window.preload.getClipboardHistory();
  const historyElement = document.getElementById('history');
  
  if (history === null || history.length === 0) {
    historyElement.innerHTML = '<div class="no-results">没有结果</div>';
    return;
  }

  // 只更新第一个元素,如果它不存在或者内容不同
  const firstItem = historyElement.querySelector('.history-item');
  if (!firstItem || firstItem.getAttribute('data-content') !== history[0].content) {
    const newItem = createHistoryItem(history[0], 0);
    if (firstItem) {
      historyElement.insertBefore(newItem, firstItem);
    } else {
      historyElement.appendChild(newItem);
    }
  }

  // 确保列表中的项目数量不超过设置的最大记录数
  const maxRecords = window.preload.getSettings().maxRecords;
  while (historyElement.children.length > maxRecords) {
    historyElement.removeChild(historyElement.lastChild);
  }
}

function renderContent(item) {
  switch (item.type) {
    case 'text':
      return `<pre>${item.content}</pre>`;
    case 'image':
      return `<img src="${item.content}" alt="Clipboard image" style="max-width: 100%; max-height: 200px;">`;
    case 'files':
      return `<p>文件: ${item.content}</p>`;
    default:
      return `<p>未知类型: ${item.type}</p>`;
  }
}

// 添加这个新函数来获取正确的快捷键组合
function getShortcutKey(key) {
  if (utools.isMacOS()) {
    return ['command', key];
  } else {
    // Windows 和 Linux
    return ['ctrl', key];
  }
}

// 修改 copyItem 函数
function copyItem(index) {
  const history = window.preload.getClipboardHistory();
  if (index >= 0 && index < history.length) {
    window.preload.copyToClipboard(history[index]);
    const pasteAfterCopy = window.preload.getPasteAfterCopySetting();
    if (pasteAfterCopy) {
      utools.hideMainWindow();
      pasteContent();
    } else {
      exitPlugin();
    }
  } else {
    console.error('无效的历史记录索引');
  }
}

// 修改 copyFavoriteItem 函数
function copyFavoriteItem(index) {
  const favorites = window.preload.getFavorites();
  if (index >= 0 && index < favorites.length) {
    window.preload.copyToClipboard(favorites[index]);
    const pasteAfterCopy = window.preload.getPasteAfterCopySetting();
    if (pasteAfterCopy) {
      utools.hideMainWindow();
      pasteContent();
    } else {
      exitPlugin();
    }
  } else {
    console.error('无效的收藏记录索引');
  }
}

// 新增 pasteContent 函数
function pasteContent() {
  const [modifier, key] = getShortcutKey('v');
  utools.simulateKeyboardTap(key, modifier);
  exitPlugin();
}

// 修改 exitPlugin 函数
function exitPlugin() {
  utools.outPlugin();
}

function removeItem(index) {
  removeHistoryItem(index);
  updateHistory();
}

function clearAllHistory() {
  clearHistory();
  updateHistory();
}

function saveSettings() {
  const maxRecords = parseInt(document.getElementById('maxRecords').value, 10);
  const pasteAfterCopy = document.getElementById('pasteAfterCopy').checked;
  console.log('Saving settings:', { maxRecords, pasteAfterCopy });
  const newSettings = {
    maxRecords: maxRecords,
    pasteAfterCopy: pasteAfterCopy
  };
  window.preload.setSettings(newSettings);
  window.preload.setPasteAfterCopySetting(pasteAfterCopy);
  updateHistoryWithNewMaxRecords(maxRecords);
  alert('设置已保存');
}

function updateHistoryWithNewMaxRecords(newMaxRecords) {
  let history = window.preload.getClipboardHistory();
  if (history.length > newMaxRecords) {
    history = history.slice(0, newMaxRecords);
    window.preload.setClipboardHistory(history);
  }
  updateHistory(history);
}

function updateFavorites(favorites = window.preload.getFavorites()) {
  const favoritesElement = document.getElementById('favorites');

  if (favorites.length === 0) {
    favoritesElement.innerHTML = '<div class="no-results">没有收藏项目</div>';
    return;
  }

  favoritesElement.innerHTML = favorites.map((item, index) => `
    <div class="history-item favorite-item" data-index="${index}">
      <div class="content" title="${escapeHtml(item.content)}">
        ${renderContent(item)}
      </div>
      <div class="tags">
        ${renderTags(item.tags)}
      </div>
      <div class="actions">
        <button class="copy-btn" data-index="${index}">复制</button>
        <button class="remove-favorite-btn" data-index="${index}">取消收藏</button>
        <button class="edit-tags-btn" data-index="${index}">编辑标签</button>
        <span class="timestamp">${new Date(item.timestamp).toLocaleString()}</span>
      </div>
    </div>
  `).join('');

  // 修改事件监听器
  favoritesElement.querySelectorAll('.favorite-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {  // 如果点击的不是按钮
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt(item.getAttribute('data-index'), 10);
        copyFavoriteItem(index);
      }
    });
  });

  // 为每个按钮添加单独的事件监听器
  favoritesElement.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(e.target.getAttribute('data-index'), 10);
      copyFavoriteItem(index);
    });
  });

  favoritesElement.querySelectorAll('.remove-favorite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(e.target.getAttribute('data-index'), 10);
      removeFromFavorites(index);
      updateFavorites();
    });
  });

  favoritesElement.querySelectorAll('.edit-tags-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(e.target.getAttribute('data-index'), 10);
      editTags(index);
    });
  });
}

function initializeApp() {
  loadSettings();
  loadClipboardHistory();
  loadFavorites();
  updateHistory();
  updateFavorites();

  // 添加侧边按钮事件监听器
  document.getElementById('showHistory').addEventListener('click', () => showSection('history'));
  document.getElementById('showFavorites').addEventListener('click', () => showSection('favorites'));
  document.getElementById('showSettings').addEventListener('click', () => showSection('settings'));

  // 调用函数来调整侧边栏宽度
  adjustSidebarWidth();

  // 在窗口大小改变时重新调整宽度
  window.addEventListener('resize', adjustSidebarWidth);

  // 初始显示历史记录
  showSection('history');

  const searchInput = document.getElementById('search');
  searchInput.addEventListener('input', (e) => {
    currentSearchKeyword = e.target.value.trim();
    const activeSection = document.querySelector('.content-section.active').id;
    performSearch(currentSearchKeyword, activeSection);
  });

  // 添加搜索提示
  searchInput.setAttribute('placeholder', '搜索...（在收藏中使用 #标签 搜索标签）');

  document.getElementById('clearHistory').addEventListener('click', clearAllHistory);
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('resetSettings').addEventListener('click', resetSettings);

  // 添加插件进入和退出的事件监听器
  utools.onPluginEnter(() => {
    updateHistory();
  });

  // 可以在这里执行一些清理操作
  utools.onPluginOut(() => {
    // 可以这里执行一些清理作
  });

  // 修改定时检查剪贴板的逻辑
  setInterval(() => {
    if (window.preload.checkClipboard() && window.preload.shouldUpdateHistory()) {
      updateHistory();
    }
  }, 100);

  // 添加键盘事件监听器
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      handleTabNavigation(e);
    } else {
      handleKeyboardNavigation(e);
    }
  });
}

initializeApp();

function adjustSidebarWidth() {
  const sidebar = document.getElementById('sidebar');
  const buttons = sidebar.querySelectorAll('.sidebar-btn');
  let maxWidth = 120; // 设置最小宽度为120px

  buttons.forEach(button => {
    const width = button.offsetWidth;
    if (width > maxWidth) {
      maxWidth = width;
    }
  });

  // 设置一个固定的宽度,确保能容纳最长的按钮文本
  const fixedWidth = Math.max(maxWidth + 40, 160); // 至少160px宽
  sidebar.style.width = `${fixedWidth}px`;

  // 将固定宽度应用到所有按钮
  buttons.forEach(button => {
    button.style.width = `${fixedWidth - 30}px`; // 减去边距
  });
}

// 添加以下函数来加载设置
function loadSettingsUI() {
  const settings = window.preload.getSettings();
  document.getElementById('maxRecords').value = settings.maxRecords;
  const pasteAfterCopyCheckbox = document.getElementById('pasteAfterCopy');
  if (pasteAfterCopyCheckbox) {
    pasteAfterCopyCheckbox.checked = settings.pasteAfterCopy;
  }
}

// 添加一个新的函数来执行搜索
function performSearch(keyword, sectionId) {
  if (sectionId === 'history') {
    const searchResults = window.preload.searchHistory(keyword);
    console.log('Search results in main:', searchResults); // 添加日志
    updateHistory(searchResults);
  } else if (sectionId === 'favorites') {
    const [searchKeyword, tagKeyword] = keyword.split('#').map(k => k.trim());
    const searchResults = window.preload.searchFavorites(searchKeyword, tagKeyword);
    console.log('Favorites search results:', searchResults); // 添加日志
    updateFavorites(searchResults);
  }
}

// 修 renderTags 函数
function renderTags(tags) {
  if (!tags || !Array.isArray(tags)) {
    return '';
  }
  return tags.map(tag => `<span class="tag">${tag}</span>`).join('');
}

// 添加这些新函数到 main.js 文件中

function createModal(title, content) {
  const modal = document.createElement('div');
  modal.className = 'modal';
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

function removeModal(modal) {
  document.body.removeChild(modal);
}

function editTags(index) {
  const favorites = window.preload.getFavorites();
  const item = favorites[index];
  const currentTags = item.tags ? item.tags.join(', ') : '';
  
  const modal = createModal('编辑标签', `
    <input type="text" id="tagInput" value="${currentTags}" placeholder="输入标签，用逗号分隔">
  `);

  const confirmButton = modal.querySelector('#modalConfirm');
  const cancelButton = modal.querySelector('#modalCancel');
  const tagInput = modal.querySelector('#tagInput');

  confirmButton.addEventListener('click', () => {
    const newTags = tagInput.value;
    const tagArray = newTags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
    window.preload.addToFavorites({...item, tags: tagArray});
    updateFavorites();
    removeModal(modal);
  });

  cancelButton.addEventListener('click', () => {
    removeModal(modal);
  });
}

// 在文件末尾添加以下 CSS
const style = document.createElement('style');
style.textContent = `
  .modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  .modal-content {
    background-color: white;
    padding: 20px;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
  .modal-actions {
    margin-top: 20px;
    text-align: right;
  }
  .modal-actions button {
    margin-left: 10px;
  }
  #tagInput {
    width: 100%;
    padding: 5px;
    margin-top: 10px;
  }
`;
document.head.appendChild(style);

// 添加重置设置的函数
function resetSettings() {
  const defaultSettings = { maxRecords: 100, pasteAfterCopy: true };
  setSettings(defaultSettings);
  loadSettingsUI();
  alert('设置已重置为默认值');
}

// 在文件中添加这个新函数
function scrollToSelectedItem() {
  const activeSection = document.querySelector('.content-section.active');
  const selectedItem = activeSection.querySelector('.history-item.selected, .favorite-item.selected');
  if (selectedItem) {
    selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// 添加 copyFavoriteItem 函数
function copyFavoriteItem(index) {
  const favorites = window.preload.getFavorites();
  if (index >= 0 && index < favorites.length) {
    window.preload.copyToClipboard(favorites[index]);
    const pasteAfterCopy = window.preload.getPasteAfterCopySetting();
    if (pasteAfterCopy) {
      utools.hideMainWindow();
      pasteContent();
    } else {
      exitPlugin();
    }
  } else {
    console.error('无效的收藏记录索引');
  }
}

// 添加一个辅助函数来转义HTML
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

// 修改搜索事件监听器
const searchInput = document.getElementById('search');
searchInput.addEventListener('input', debounce((e) => {
  currentSearchKeyword = e.target.value.trim();
  const activeSection = document.querySelector('.content-section.active').id;
  performSearch(currentSearchKeyword, activeSection);
}, 300)); // 300ms的延迟

// 在文件末尾添加 showToast 函数
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 100);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 2000);
}

// 在文件末尾添加以下 CSS
const toastStyle = document.createElement('style');
toastStyle.textContent = `
  .toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
  }
  .toast.show {
    opacity: 1;
  }
`;
document.head.appendChild(toastStyle);

// 添加新的 createHistoryItem 函数
function createHistoryItem(item, index) {
  const div = document.createElement('div');
  div.className = `history-item ${index === currentSelectedIndex ? 'selected' : ''}`;
  div.setAttribute('data-index', index);
  div.setAttribute('data-content', item.content);
  div.innerHTML = `
    <div class="content" title="${escapeHtml(item.content)}">
      ${renderContent(item)}
    </div>
    <div class="actions">
      <button class="copy-btn" data-index="${index}">复制</button>
      <button class="remove-btn" data-index="${index}">删除</button>
      <button class="export-btn" data-index="${index}">导出</button>
      <button class="favorite-btn" data-index="${index}">收藏</button>
      <span class="timestamp">${new Date(item.timestamp).toLocaleString()}</span>
    </div>
  `;
  
  // 添加事件监听器
  div.addEventListener('click', (e) => {
    if (!e.target.closest('button')) {
      e.preventDefault();
      e.stopPropagation();
      copyItem(index);
    }
  });
  
  div.querySelector('.copy-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    copyItem(index);
  });
  
  div.querySelector('.remove-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    removeItem(index);
  });
  
  div.querySelector('.export-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    exportSingleItem(index);
    showToast('导出成功');
  });
  
  div.querySelector('.favorite-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    addToFavorites(window.preload.getClipboardHistory()[index]);
    updateFavorites();
    showToast('收藏成功');
  });

  return div;
}

// 修改 updateHistory 函数
function updateHistory(history = window.preload.getClipboardHistory()) {
  const historyElement = document.getElementById('history');
  
  if (!history || history.length === 0) {
    historyElement.innerHTML = '<div class="no-results">没有结果</div>';
    return;
  }

  historyElement.innerHTML = history.map((item, index) => `
    <div class="history-item" data-index="${index}">
      <div class="content" title="${escapeHtml(item.content)}">
        ${renderContent(item)}
      </div>
      <div class="actions">
        <button class="copy-btn" data-index="${index}">复制</button>
        <button class="remove-btn" data-index="${index}">删除</button>
        <button class="export-btn" data-index="${index}">导出</button>
        <button class="favorite-btn" data-index="${index}">收藏</button>
        <span class="timestamp">${new Date(item.timestamp).toLocaleString()}</span>
      </div>
    </div>
  `).join('');

  // 重新添加事件监听器
  addHistoryItemEventListeners();
}

// 添加新的函数来为历史项添加事件监听器
function addHistoryItemEventListeners() {
  const historyElement = document.getElementById('history');
  historyElement.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt(item.getAttribute('data-index'), 10);
        copyItem(index);
      }
    });
  });

  historyElement.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(e.target.getAttribute('data-index'), 10);
      copyItem(index);
    });
  });

  historyElement.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(e.target.getAttribute('data-index'), 10);
      removeItem(index);
    });
  });

  historyElement.querySelectorAll('.export-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(e.target.getAttribute('data-index'), 10);
      exportSingleItem(index);
      showToast('导出成功');
    });
  });

  historyElement.querySelectorAll('.favorite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(e.target.getAttribute('data-index'), 10);
      addToFavorites(window.preload.getClipboardHistory()[index]);
      updateFavorites();
      showToast('收藏成功');
    });
  });
}
