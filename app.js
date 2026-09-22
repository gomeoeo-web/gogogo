// ===== 環島記帳 APP — Main Application =====
(function() {
  'use strict';

  // ===== State =====
  let state = {
    tripName: '',
    tripDays: 0,
    hasBudget: false,
    budget: 0,
    expenses: [],
    currentDay: 1,
    currentView: 'setup'
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function formatMoney(n) {
    return new Intl.NumberFormat('zh-TW').format(Math.round(n));
  }

  function getCategoryIcon(cat) {
    if (!cat) return '📦';
    return cat.split(' ')[0] || '📦';
  }

  function getTotalSpent() {
    return state.expenses.reduce((sum, e) => sum + e.amount, 0);
  }

  function getDayTotal(day) {
    return state.expenses.filter(e => e.day === day).reduce((sum, e) => sum + e.amount, 0);
  }

  function getDayExpenses(day) {
    return state.expenses.filter(e => e.day === day);
  }

  function getMaxDaySpent() {
    let max = 0;
    for (let d = 1; d <= state.tripDays; d++) {
      const t = getDayTotal(d);
      if (t > max) max = t;
    }
    return max;
  }

  function escHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(msg) {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  // ===== LocalStorage =====
  function saveState() {
    try {
      const toSave = { ...state };
      // Don't save photos in main state to avoid quota issues - save separately
      const expensesNoPhoto = toSave.expenses.map(e => ({ ...e, photo: e.photo ? 'HAS_PHOTO' : null }));
      toSave.expenses = expensesNoPhoto;
      localStorage.setItem('trip-tracker-state', JSON.stringify(toSave));

      // Save photos separately
      state.expenses.forEach(e => {
        if (e.photo && e.photo !== 'HAS_PHOTO') {
          try {
            localStorage.setItem('trip-photo-' + e.id, e.photo);
          } catch(err) {
            // If storage is full, skip photo
          }
        }
      });
    } catch(err) {
      console.warn('Storage save error:', err);
    }
  }

  function loadState() {
    const saved = localStorage.getItem('trip-tracker-state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.tripDays > 0) {
          // Restore photos
          parsed.expenses = parsed.expenses.map(e => {
            if (e.photo === 'HAS_PHOTO') {
              e.photo = localStorage.getItem('trip-photo-' + e.id) || null;
            }
            return e;
          });
          state = parsed;
          return true;
        }
      } catch(e) {}
    }
    return false;
  }

  function clearState() {
    // Clear photos
    state.expenses.forEach(e => {
      localStorage.removeItem('trip-photo-' + e.id);
    });
    localStorage.removeItem('trip-tracker-state');
    state = {
      tripName: '',
      tripDays: 0,
      hasBudget: false,
      budget: 0,
      expenses: [],
      currentDay: 1,
      currentView: 'setup'
    };
  }

  // ===== View Management =====
  function showView(viewId) {
    $$('.view').forEach(v => v.classList.remove('active'));
    const target = $('#view-' + viewId);
    if (target) {
      target.classList.add('active');
      target.classList.add('view-enter');
      setTimeout(() => target.classList.remove('view-enter'), 400);
    }
    state.currentView = viewId;

    const nav = $('#bottom-nav');
    if (viewId === 'setup') {
      nav.style.display = 'none';
    } else {
      nav.style.display = 'flex';
    }

    $$('.nav-item').forEach(n => n.classList.remove('active'));
    if (viewId === 'dashboard') $('#nav-dashboard').classList.add('active');
    else if (viewId === 'summary') $('#nav-summary').classList.add('active');
    else if (viewId === 'settings') $('#nav-settings').classList.add('active');

    if (viewId === 'dashboard') renderDashboard();
    else if (viewId === 'summary') renderSummary();
    else if (viewId === 'settings') renderSettings();
    else if (viewId === 'day-detail') renderDayDetail();

    saveState();
  }

  // ===== Render Dashboard =====
  function renderDashboard() {
    const total = getTotalSpent();

    $('#dash-title').textContent = state.tripName || '環島記帳';
    $('#dash-subtitle').textContent = '共 ' + state.tripDays + ' 天';

    const budgetEl = $('#budget-display');
    if (state.hasBudget && state.budget > 0) {
      const remaining = state.budget - total;
      const pct = Math.min((total / state.budget) * 100, 100);
      const over = total > state.budget;
      budgetEl.innerHTML =
        '<div class="budget-card">' +
          '<div class="budget-label">已花費 / 預算</div>' +
          '<div class="budget-amount"><span class="currency">$</span>' + formatMoney(total) + '</div>' +
          '<div class="budget-meta">' +
            '<div class="budget-meta-item">' +
              '<div class="budget-meta-label">預算上限</div>' +
              '<div class="budget-meta-value">$' + formatMoney(state.budget) + '</div>' +
            '</div>' +
            '<div class="budget-meta-item">' +
              '<div class="budget-meta-label">' + (over ? '超出預算' : '剩餘預算') + '</div>' +
              '<div class="budget-meta-value"' + (over ? ' style="color:#E8847A"' : '') + '>$' + formatMoney(Math.abs(remaining)) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="budget-progress">' +
            '<div class="progress-bar-bg">' +
              '<div class="progress-bar-fill' + (over ? ' over-budget' : '') + '" style="width:' + pct + '%"></div>' +
            '</div>' +
            '<div class="progress-text">' + pct.toFixed(1) + '%</div>' +
          '</div>' +
        '</div>';
    } else {
      const avgPerDay = state.tripDays > 0 ? total / state.tripDays : 0;
      budgetEl.innerHTML =
        '<div class="no-budget-card">' +
          '<div class="no-budget-total-label">總花費</div>' +
          '<div class="no-budget-total-amount"><span class="currency">$</span>' + formatMoney(total) + '</div>' +
          '<div class="no-budget-meta">' +
            '<div class="no-budget-meta-item">' +
              '<div class="no-budget-meta-label">日均花費</div>' +
              '<div class="no-budget-meta-value">$' + formatMoney(avgPerDay) + '</div>' +
            '</div>' +
            '<div class="no-budget-meta-item">' +
              '<div class="no-budget-meta-label">筆數</div>' +
              '<div class="no-budget-meta-value">' + state.expenses.length + ' 筆</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    // Day cards
    const dayCardsEl = $('#day-cards');
    let dayCardsHTML = '';
    for (let d = 1; d <= state.tripDays; d++) {
      const dayTotal = getDayTotal(d);
      const dayCount = getDayExpenses(d).length;
      dayCardsHTML +=
        '<div class="day-card' + (d === state.currentDay ? ' today' : '') + '" data-day="' + d + '">' +
          '<div class="day-card-label">DAY</div>' +
          '<div class="day-card-day">' + d + '</div>' +
          '<div class="day-card-amount">$' + formatMoney(dayTotal) + '</div>' +
          '<div class="day-card-items">' + dayCount + ' 筆花費</div>' +
        '</div>';
    }
    dayCardsEl.innerHTML = dayCardsHTML;

    dayCardsEl.querySelectorAll('.day-card').forEach(function(card) {
      card.addEventListener('click', function() {
        state.currentDay = parseInt(card.dataset.day);
        showView('day-detail');
      });
    });

    // Recent expenses (latest 10)
    const recentList = $('#recent-list');
    const recent = state.expenses.slice().sort(function(a, b) { return b.createdAt - a.createdAt; }).slice(0, 10);
    if (recent.length === 0) {
      recentList.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-icon">✎</div>' +
          '<div class="empty-text">尚未記錄任何花費<br>點擊下方 ＋ 開始記帳</div>' +
        '</div>';
    } else {
      recentList.innerHTML = recent.map(function(e) {
        return '<div class="expense-item" data-id="' + e.id + '">' +
          '<div class="expense-icon">' + getCategoryIcon(e.category) + '</div>' +
          '<div class="expense-info">' +
            '<div class="expense-name">' + escHTML(e.name) + '</div>' +
            '<div class="expense-day-tag">第 ' + e.day + ' 天 · ' + (e.category || '其他') + '</div>' +
          '</div>' +
          '<div class="expense-amount">$' + formatMoney(e.amount) + '</div>' +
          (e.photo ? '<div class="expense-photo-dot"></div>' : '') +
        '</div>';
      }).join('');

      recentList.querySelectorAll('.expense-item').forEach(function(item) {
        item.addEventListener('click', function() { openEditModal(item.dataset.id); });
      });
    }
  }

  // ===== Render Day Detail =====
  function renderDayDetail() {
    const day = state.currentDay;
    const dayTotal = getDayTotal(day);
    const expenses = getDayExpenses(day).sort(function(a, b) { return b.createdAt - a.createdAt; });

    $('#day-detail-title').textContent = '第 ' + day + ' 天';
    $('#day-detail-subtitle').textContent = state.tripName;
    $('#day-detail-amount').innerHTML = '<span class="currency">$</span>' + formatMoney(dayTotal);

    const listEl = $('#day-expense-list');
    if (expenses.length === 0) {
      listEl.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-icon">🌿</div>' +
          '<div class="empty-text">這天還沒有花費紀錄<br>開始記錄這天的旅途吧</div>' +
        '</div>';
    } else {
      listEl.innerHTML = expenses.map(function(e) {
        return '<div class="expense-item" data-id="' + e.id + '">' +
          '<div class="expense-icon">' + getCategoryIcon(e.category) + '</div>' +
          '<div class="expense-info">' +
            '<div class="expense-name">' + escHTML(e.name) + '</div>' +
            '<div class="expense-day-tag">' + (e.category || '其他') + '</div>' +
          '</div>' +
          '<div class="expense-amount">$' + formatMoney(e.amount) + '</div>' +
          (e.photo ? '<div class="expense-photo-dot"></div>' : '') +
        '</div>';
      }).join('');

      listEl.querySelectorAll('.expense-item').forEach(function(item) {
        item.addEventListener('click', function() { openEditModal(item.dataset.id); });
      });
    }
  }

  // ===== Render Summary =====
  function renderSummary() {
    const total = getTotalSpent();
    const avgPerDay = state.tripDays > 0 ? total / state.tripDays : 0;
    const maxDay = getMaxDaySpent();
    const expCount = state.expenses.length;

    var html =
      '<div class="summary-total-card">' +
        '<div class="summary-trip-name">' + escHTML(state.tripName) + '</div>' +
        '<div class="summary-total-amount"><span class="currency">$</span>' + formatMoney(total) + '</div>' +
        '<div class="summary-stats">' +
          '<div class="summary-stat">' +
            '<div class="summary-stat-label">日均花費</div>' +
            '<div class="summary-stat-value">$' + formatMoney(avgPerDay) + '</div>' +
          '</div>' +
          '<div class="summary-stat">' +
            '<div class="summary-stat-label">單日最高</div>' +
            '<div class="summary-stat-value">$' + formatMoney(maxDay) + '</div>' +
          '</div>' +
          '<div class="summary-stat">' +
            '<div class="summary-stat-label">總筆數</div>' +
            '<div class="summary-stat-value">' + expCount + ' 筆</div>' +
          '</div>' +
          '<div class="summary-stat">' +
            '<div class="summary-stat-label">' + (state.hasBudget ? '預算餘額' : '旅程天數') + '</div>' +
            '<div class="summary-stat-value">' + (state.hasBudget ? '$' + formatMoney(state.budget - total) : state.tripDays + ' 天') + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="section-title">每日花費明細</div>' +
      '<div class="day-breakdown">';

    for (var d = 1; d <= state.tripDays; d++) {
      var dt = getDayTotal(d);
      var dc = getDayExpenses(d).length;
      html +=
        '<div class="day-breakdown-item" data-day="' + d + '">' +
          '<div class="day-breakdown-left">' +
            '<div class="day-breakdown-num">' + d + '</div>' +
            '<div>' +
              '<div class="day-breakdown-label">第 ' + d + ' 天</div>' +
              '<div class="day-breakdown-count">' + dc + ' 筆花費</div>' +
            '</div>' +
          '</div>' +
          '<div class="day-breakdown-amount">$' + formatMoney(dt) + '</div>' +
        '</div>';
    }
    html += '</div>';

    $('#summary-content').innerHTML = html;

    $$('.day-breakdown-item').forEach(function(item) {
      item.addEventListener('click', function() {
        state.currentDay = parseInt(item.dataset.day);
        showView('day-detail');
      });
    });
  }

  // ===== Render Settings =====
  function renderSettings() {
    var settingsEl = $('#settings-content');
    settingsEl.innerHTML =
      '<div class="settings-card">' +
        '<div class="settings-card-title">旅程資訊</div>' +
        '<div class="settings-row">' +
          '<span class="settings-row-label">旅程名稱</span>' +
          '<span class="settings-row-value">' + escHTML(state.tripName) + '</span>' +
        '</div>' +
        '<div class="settings-row">' +
          '<span class="settings-row-label">旅程天數</span>' +
          '<span class="settings-row-value">' + state.tripDays + ' 天</span>' +
        '</div>' +
        '<div class="settings-row">' +
          '<span class="settings-row-label">預算</span>' +
          '<span class="settings-row-value">' + (state.hasBudget ? '$' + formatMoney(state.budget) : '未設定') + '</span>' +
        '</div>' +
        '<div class="settings-row">' +
          '<span class="settings-row-label">總花費</span>' +
          '<span class="settings-row-value">$' + formatMoney(getTotalSpent()) + '</span>' +
        '</div>' +
        '<div class="settings-row">' +
          '<span class="settings-row-label">記帳筆數</span>' +
          '<span class="settings-row-value">' + state.expenses.length + ' 筆</span>' +
        '</div>' +
      '</div>' +
      '<div class="settings-card">' +
        '<div class="settings-card-title">修改設定</div>' +
        '<div class="settings-row">' +
          '<span class="settings-row-label">修改旅程名稱</span>' +
          '<button class="settings-row-btn" id="btn-edit-name">修改</button>' +
        '</div>' +
        '<div class="settings-row">' +
          '<span class="settings-row-label">修改天數</span>' +
          '<button class="settings-row-btn" id="btn-edit-days">修改</button>' +
        '</div>' +
        '<div class="settings-row">' +
          '<span class="settings-row-label">修改預算</span>' +
          '<button class="settings-row-btn" id="btn-edit-budget">修改</button>' +
        '</div>' +
      '</div>' +
      '<div class="settings-card">' +
        '<div class="settings-card-title">資料管理</div>' +
        '<div class="settings-row">' +
          '<span class="settings-row-label">匯出記帳資料</span>' +
          '<button class="settings-row-btn" id="btn-export">匯出</button>' +
        '</div>' +
      '</div>' +
      '<div class="settings-actions">' +
        '<button class="btn-danger" id="btn-reset-all">重置所有資料</button>' +
      '</div>';

    $('#btn-edit-name').addEventListener('click', function() {
      var newName = prompt('請輸入新的旅程名稱', state.tripName);
      if (newName && newName.trim()) {
        state.tripName = newName.trim();
        saveState();
        renderSettings();
        showToast('旅程名稱已更新');
      }
    });

    $('#btn-edit-days').addEventListener('click', function() {
      var newDays = prompt('請輸入新的天數（1-90）', state.tripDays);
      var d = parseInt(newDays);
      if (d && d >= 1 && d <= 90) {
        state.tripDays = d;
        state.expenses = state.expenses.filter(function(e) { return e.day <= d; });
        saveState();
        renderSettings();
        showToast('旅程天數已更新');
      }
    });

    $('#btn-edit-budget').addEventListener('click', function() {
      var choice = prompt('輸入新預算金額（輸入 0 取消預算）', state.budget || '');
      if (choice !== null) {
        var b = parseInt(choice);
        if (b > 0) {
          state.hasBudget = true;
          state.budget = b;
        } else {
          state.hasBudget = false;
          state.budget = 0;
        }
        saveState();
        renderSettings();
        showToast(state.hasBudget ? '預算已更新' : '已取消預算');
      }
    });

    $('#btn-export').addEventListener('click', exportData);

    $('#btn-reset-all').addEventListener('click', function() {
      showConfirm('⚠️', '重置所有資料', '確定要清除所有記帳資料嗎？此操作無法復原。', function() {
        clearState();
        showView('setup');
        showToast('所有資料已清除');
      });
    });
  }

  // ===== Confirm Dialog =====
  function showConfirm(icon, title, text, onOk) {
    $('#confirm-icon').textContent = icon;
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    $('#confirm-dialog').classList.add('show');

    var okBtn = $('#confirm-ok');
    var cancelBtn = $('#confirm-cancel');

    var cleanup = function() {
      $('#confirm-dialog').classList.remove('show');
      okBtn.replaceWith(okBtn.cloneNode(true));
      cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    };

    okBtn.addEventListener('click', function() { cleanup(); onOk(); }, { once: true });
    cancelBtn.addEventListener('click', cleanup, { once: true });
  }

  // ===== Export Data =====
  function exportData() {
    var csv = '\uFEFF';
    csv += '旅程名稱,' + state.tripName + '\n';
    csv += '旅程天數,' + state.tripDays + '\n';
    csv += '預算,' + (state.hasBudget ? state.budget : '未設定') + '\n';
    csv += '總花費,' + getTotalSpent() + '\n\n';
    csv += '天數,分類,品項,金額\n';
    state.expenses.slice().sort(function(a, b) {
      return a.day - b.day || a.createdAt - b.createdAt;
    }).forEach(function(e) {
      csv += e.day + ',' + (e.category || '其他') + ',' + e.name + ',' + e.amount + '\n';
    });

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = state.tripName + '_記帳.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('已匯出 CSV 檔案');
  }

  // ===== Add Expense Modal =====
  var currentPhoto = null;

  function openAddModal(presetDay) {
    var modal = $('#add-modal');
    var form = $('#add-expense-form');
    form.reset();
    currentPhoto = null;

    var photoArea = $('#photo-area');
    photoArea.classList.remove('has-photo');
    $('#photo-preview').src = '';

    $$('.category-pill').forEach(function(p) { p.classList.remove('selected'); });
    $$('.category-pill')[0].classList.add('selected');

    var daySelect = $('#expense-day');
    daySelect.innerHTML = '';
    for (var d = 1; d <= state.tripDays; d++) {
      var opt = document.createElement('option');
      opt.value = d;
      opt.textContent = '第 ' + d + ' 天';
      if (d === (presetDay || state.currentDay)) opt.selected = true;
      daySelect.appendChild(opt);
    }

    modal.classList.add('show');
  }

  function closeAddModal() {
    var modal = $('#add-modal');
    modal.classList.add('closing');
    setTimeout(function() {
      modal.classList.remove('show', 'closing');
    }, 250);
  }

  // ===== Edit Expense Modal =====
  function openEditModal(expenseId) {
    var expense = state.expenses.find(function(e) { return e.id === expenseId; });
    if (!expense) return;

    $('#edit-expense-id').value = expense.id;
    $('#edit-expense-name').value = expense.name;
    $('#edit-expense-amount').value = expense.amount;

    var daySelect = $('#edit-expense-day');
    daySelect.innerHTML = '';
    for (var d = 1; d <= state.tripDays; d++) {
      var opt = document.createElement('option');
      opt.value = d;
      opt.textContent = '第 ' + d + ' 天';
      if (d === expense.day) opt.selected = true;
      daySelect.appendChild(opt);
    }

    $('#edit-modal').classList.add('show');
  }

  function closeEditModal() {
    $('#edit-modal').classList.remove('show');
  }

  // ===== Photo Viewer =====
  function openPhotoViewer(src) {
    if (!src) return;
    $('#photo-viewer-img').src = src;
    $('#photo-viewer').classList.add('show');
  }

  function closePhotoViewer() {
    $('#photo-viewer').classList.remove('show');
    $('#photo-viewer-img').src = '';
  }

  // ===== Event Listeners =====
  function init() {
    if (loadState() && state.tripDays > 0) {
      showView('dashboard');
    } else {
      showView('setup');
    }

    // Setup form - budget toggle
    $('#budget-toggle').addEventListener('change', function(e) {
      var wrapper = $('#budget-wrapper');
      if (e.target.checked) {
        wrapper.classList.add('show');
      } else {
        wrapper.classList.remove('show');
      }
    });

    // Setup form submit
    $('#setup-form').addEventListener('submit', function(e) {
      e.preventDefault();
      var name = $('#trip-name').value.trim();
      var days = parseInt($('#trip-days').value);
      var hasBudget = $('#budget-toggle').checked;
      var budget = parseInt($('#budget-amount').value) || 0;

      if (!name || !days || days < 1) {
        showToast('請填寫完整資訊');
        return;
      }

      state.tripName = name;
      state.tripDays = days;
      state.hasBudget = hasBudget && budget > 0;
      state.budget = budget;
      state.expenses = [];
      state.currentDay = 1;

      saveState();
      showView('dashboard');
      showToast(name + ' 旅程開始！');
    });

    // Bottom nav
    $('#nav-dashboard').addEventListener('click', function() { showView('dashboard'); });
    $('#nav-summary').addEventListener('click', function() { showView('summary'); });
    $('#nav-add').addEventListener('click', function() { openAddModal(); });
    $('#nav-days').addEventListener('click', function() { showView('summary'); });
    $('#nav-settings').addEventListener('click', function() { showView('settings'); });

    $('#btn-settings').addEventListener('click', function() { showView('settings'); });

    // Back buttons
    $('#btn-back-day').addEventListener('click', function() { showView('dashboard'); });
    $('#btn-back-settings').addEventListener('click', function() { showView('dashboard'); });

    // Add expense for specific day
    $('#btn-add-day-expense').addEventListener('click', function() { openAddModal(state.currentDay); });

    // Category pills
    $$('.category-pill').forEach(function(pill) {
      pill.addEventListener('click', function() {
        $$('.category-pill').forEach(function(p) { p.classList.remove('selected'); });
        pill.classList.add('selected');
      });
    });

    // Photo upload
    $('#photo-area').addEventListener('click', function(e) {
      if (e.target.closest('.photo-remove-btn')) return;
      $('#photo-input').click();
    });

    $('#photo-input').addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function(ev) {
        var img = new Image();
        img.onload = function() {
          var canvas = document.createElement('canvas');
          var maxW = 800, maxH = 800;
          var w = img.width, h = img.height;
          if (w > maxW) { h = h * maxW / w; w = maxW; }
          if (h > maxH) { w = w * maxH / h; h = maxH; }
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          currentPhoto = canvas.toDataURL('image/jpeg', 0.7);
          $('#photo-preview').src = currentPhoto;
          $('#photo-area').classList.add('has-photo');
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    $('#photo-remove').addEventListener('click', function(e) {
      e.stopPropagation();
      currentPhoto = null;
      $('#photo-preview').src = '';
      $('#photo-area').classList.remove('has-photo');
      $('#photo-input').value = '';
    });

    // Add expense form submit
    $('#add-expense-form').addEventListener('submit', function(e) {
      e.preventDefault();
      var name = $('#expense-name').value.trim();
      var amount = parseInt($('#expense-amount').value);
      var day = parseInt($('#expense-day').value);
      var catPill = $('.category-pill.selected');
      var category = catPill ? catPill.dataset.cat : '📦 其他';

      if (!name || !amount || amount <= 0) {
        showToast('請填寫品項名稱和金額');
        return;
      }

      state.expenses.push({
        id: genId(),
        name: name,
        amount: amount,
        day: day,
        category: category,
        photo: currentPhoto,
        createdAt: Date.now()
      });

      saveState();
      closeAddModal();
      showToast('已記錄 ' + name);

      if (state.currentView === 'dashboard') renderDashboard();
      else if (state.currentView === 'day-detail') renderDayDetail();
      else if (state.currentView === 'summary') renderSummary();
    });

    // Cancel add
    $('#btn-cancel-add').addEventListener('click', closeAddModal);
    $('#add-modal').addEventListener('click', function(e) {
      if (e.target === $('#add-modal')) closeAddModal();
    });

    // Edit expense form
    $('#edit-expense-form').addEventListener('submit', function(e) {
      e.preventDefault();
      var id = $('#edit-expense-id').value;
      var expense = state.expenses.find(function(ex) { return ex.id === id; });
      if (!expense) return;

      expense.name = $('#edit-expense-name').value.trim();
      expense.amount = parseInt($('#edit-expense-amount').value);
      expense.day = parseInt($('#edit-expense-day').value);

      saveState();
      closeEditModal();
      showToast('花費已更新');

      if (state.currentView === 'dashboard') renderDashboard();
      else if (state.currentView === 'day-detail') renderDayDetail();
      else if (state.currentView === 'summary') renderSummary();
    });

    $('#btn-cancel-edit').addEventListener('click', closeEditModal);

    // Delete expense
    $('#btn-delete-expense').addEventListener('click', function() {
      var id = $('#edit-expense-id').value;
      showConfirm('🗑️', '刪除花費', '確定要刪除這筆花費嗎？', function() {
        // Remove photo from storage
        localStorage.removeItem('trip-photo-' + id);
        state.expenses = state.expenses.filter(function(e) { return e.id !== id; });
        saveState();
        closeEditModal();
        showToast('已刪除花費');

        if (state.currentView === 'dashboard') renderDashboard();
        else if (state.currentView === 'day-detail') renderDayDetail();
        else if (state.currentView === 'summary') renderSummary();
      });
    });

    $('#edit-modal').addEventListener('click', function(e) {
      if (e.target === $('#edit-modal')) closeEditModal();
    });

    // Photo viewer
    $('#photo-viewer-close').addEventListener('click', closePhotoViewer);
    $('#photo-viewer').addEventListener('click', function(e) {
      if (e.target === $('#photo-viewer')) closePhotoViewer();
    });

    // Photo dot click on expense items
    document.addEventListener('click', function(e) {
      var dot = e.target.closest('.expense-photo-dot');
      if (dot) {
        var expItem = dot.closest('.expense-item');
        if (expItem) {
          var exp = state.expenses.find(function(ex) { return ex.id === expItem.dataset.id; });
          if (exp && exp.photo) {
            e.stopPropagation();
            e.preventDefault();
            openPhotoViewer(exp.photo);
          }
        }
      }
    }, true);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
