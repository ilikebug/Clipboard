const { loadSettings, saveSettings: saveSettingsToStorage, loadClipboardHistory, removeHistoryItem, clearHistory, searchHistory, getClipboardHistory, getSettings, setSettings, exportSingleItem, addToFavorites, removeFromFavorites, getFavorites, loadFavorites, setClipboardHistory, checkClipboard } = window.preload;
// const { ipcRenderer } = require('electron');

let currentSearchKeyword = '';
// 在文件顶部添加一个新的变量
let currentSelectedIndex = -1;

// 添加这个新函数来处理键盘事件
function handleKeyboardNavigation(e) {
  const historyItems = document.querySelectorAll('.history-item');
  if (historyItems.length === 0) return;

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    currentSelectedIndex = (currentSelectedIndex > 0) ? currentSelectedIndex - 1 : historyItems.length - 1;
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    currentSelectedIndex = (currentSelectedIndex < historyItems.length - 1) ? currentSelectedIndex + 1 : 0;
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (currentSelectedIndex >= 0 && currentSelectedIndex < historyItems.length) {
      copyItem(currentSelectedIndex);
    }
  }

  updateSelectedItem();
  scrollToSelectedItem(); // 添加这一行
}

// 添加这个新函数来更新选中项的视觉效果
function updateSelectedItem() {
  const historyItems = document.querySelectorAll('.history-item');
  historyItems.forEach((item, index) => {
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

  // 控制清空历史按钮和搜索框的可见性
  const clearHistoryBtn = document.getElementById('clearHistory');
  const searchInput = document.getElementById('search');
  if (sectionId === 'history' || sectionId === 'favorites') {
    clearHistoryBtn.style.display = sectionId === 'history' ? 'block' : 'none';
    searchInput.style.display = 'block';
    // 切换页面时，保持搜索框的内容并触发搜索
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

  // 如果显示的是设置页面，加载设置
  if (sectionId === 'settings') {
    loadSettingsUI();
  }

  if (sectionId === 'history') {
    currentSelectedIndex = -1;
    updateSelectedItem();
  }
}

function updateHistory(history = window.preload.getClipboardHistory()) {
  const historyElement = document.getElementById('history');
  
  if (history === null || history.length === 0) {
    historyElement.innerHTML = '<div class="no-results">没有结果</div>';
    return;
  }

  historyElement.innerHTML = history.map((item, index) => `
    <div class="history-item ${index === currentSelectedIndex ? 'selected' : ''}" data-index="${index}">
      <div class="content">
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

  // 为收藏按钮添加事件监听器
  historyElement.querySelectorAll('.favorite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'), 10);
      addToFavorites(history[index]);
      updateFavorites();
    });
  });

  // 修改 history-item 的点击事件
  historyElement.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {  // 如果点击的不是按钮
        const index = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        copyItem(index);
      }
    });
  });

  // 修改复制按钮的点击事件
  historyElement.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'), 10);
      copyItem(index);
    });
  });

  historyElement.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'), 10);
      removeItem(index);
    });
  });

  historyElement.querySelectorAll('.export-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'), 10);
      exportSingleItem(index);
    });
  });

  // 在历史列表后，如果当前显示的是历史页面，则滚动到顶部
  if (document.getElementById('history').classList.contains('active')) {
    document.getElementById('history').scrollTop = 0;
  }

  // 在历史列表更新后,重置当前选中索引
  currentSelectedIndex = -1;
  updateSelectedItem();
  scrollToSelectedItem(); // 添加这一行
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

// 修改 copyItem 函数
function copyItem(index) {
  const history = window.preload.getClipboardHistory();
  if (index >= 0 && index < history.length) {
    window.preload.copyToClipboard(history[index]);
    exitPlugin(); // 添加这行
  } else {
    console.error('无效的历史记录索引');
  }
}

// 添加新的 exitPlugin 函数
function exitPlugin() {
  utools.hideMainWindow();
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
  const newSettings = {
    maxRecords: maxRecords
  };
  // 在这里可以轻松添加更多设置项的保存
  setSettings(newSettings);
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
      <div class="content">
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

  // 修改 favorite-item 的点击事件
  favoritesElement.querySelectorAll('.favorite-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {  // 如果点击的不是按钮
        const index = parseInt(item.getAttribute('data-index'), 10);
        window.preload.copyToClipboard(favorites[index]);
        exitPlugin(); // 添加这行
      }
    });
  });

  // 修改复制按钮的点击事件
  favoritesElement.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'), 10);
      window.preload.copyToClipboard(favorites[index]);
      exitPlugin(); // 添加这行
    });
  });

  favoritesElement.querySelectorAll('.remove-favorite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'), 10);
      removeFromFavorites(index);
      updateFavorites();
    });
  });

  // 添加编辑标签按钮的事件监听器
  favoritesElement.querySelectorAll('.edit-tags-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // 阻止事件冒泡
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

  // 添加侧边栏按钮事件监听器
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
    // 可以在这里执行一些清理操作
  });

  // 修改定时检查剪贴板的逻辑
  setInterval(() => {
    if (window.preload.checkClipboard()) {
      updateHistory();
    }
  }, 100);

  // 添加键盘事件监听器
  document.addEventListener('keydown', handleKeyboardNavigation);
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

  // 设置一个固定的宽度，确保能容纳最长的按钮文本
  const fixedWidth = Math.max(maxWidth + 40, 160); // 至少160px宽
  sidebar.style.width = `${fixedWidth}px`;

  // 将固定宽度应用到所有按钮
  buttons.forEach(button => {
    button.style.width = `${fixedWidth - 30}px`; // 减去边距
  });
}

// 添加以下函数来加载设置
function loadSettingsUI() {
  const settings = getSettings();
  document.getElementById('maxRecords').value = settings.maxRecords;
  // 在这里可以轻松添加更多设置项的加载
}

// 添加一个新的函数来执行搜索
function performSearch(keyword, sectionId) {
  if (sectionId === 'history') {
    const searchResults = window.preload.searchHistory(keyword);
    updateHistory(searchResults);
  } else if (sectionId === 'favorites') {
    const [searchKeyword, tagKeyword] = keyword.split('#').map(k => k.trim());
    const searchResults = window.preload.searchFavorites(searchKeyword, tagKeyword);
    updateFavorites(searchResults);
  }
}

// 修改 renderTags 函数
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
  const defaultSettings = { maxRecords: 1000 };
  setSettings(defaultSettings);
  loadSettingsUI();
  alert('设置已重置为默认值');
}

// 在文件中添加这个新函数
function scrollToSelectedItem() {
  const selectedItem = document.querySelector('.history-item.selected');
  if (selectedItem) {
    selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}