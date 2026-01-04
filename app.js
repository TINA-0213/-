// ------------- 页面判断：区分首页/填写页面/展示页面 -------------
const isRecordPage = window.location.pathname.includes('record.html'); // 填写页面
const isDetailPage = window.location.pathname.includes('detail.html'); // 展示页面
const isIndexPage = !isRecordPage && !isDetailPage; // 首页

// 获取元素（根据页面动态获取）
let diaryContent = null;
let uploadBtn = null;
let saveBtn = null;
let photoPreview = null;
// 首页日历+弹窗元素
let prevBtn = null;
let nextBtn = null;
let currentYearMonthEl = null;
let monthDaysEl = null;
let dateSelectMask = null;
let dateSelectModal = null;
let yearSelect = null;
let monthSelect = null;
let cancelModal = null;
let confirmModal = null;
let fullDiaryList = document.getElementById('fullDiaryList'); // 展示页面完整列表
let currentPhoto = null;

// 全局变量：当前显示的年月（初始化为系统当前年月）
let currentDisplayYear = new Date().getFullYear();
let currentDisplayMonth = new Date().getMonth(); // 0-11 对应 1-12月
// 年份选择范围：当前年份前后各5年（可自定义调整）
const YEAR_RANGE = 5;

// 工具函数1：格式化日期为 YYYY-MM-DD（用于分组和记录日期对比）
function formatDateToYMD(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 工具函数2：格式化日期为 中文显示（如：2026年01月04日）
function formatDateToCN(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}年${month}月${day}日`;
}

// 工具函数3：获取所有有记录的日期（格式：YYYY-MM-DD）
function getRecordDates() {
  const recordDates = new Set(); // 用Set去重，避免同一日期多条记录重复标亮
  const allDiaries = JSON.parse(localStorage.getItem('myDiaries')) || [];
  
  allDiaries.forEach(diary => {
    if (diary.time) {
      // 解析本地时间字符串，提取YYYY-MM-DD
      const dateObj = new Date(diary.time);
      const dateStr = formatDateToYMD(dateObj);
      recordDates.add(dateStr);
    }
  });

  return Array.from(recordDates);
}

// 工具函数4：更新当前年月显示文本
function updateCurrentYearMonthText() {
  if (!currentYearMonthEl) return;
  currentYearMonthEl.textContent = `${currentDisplayYear}年${currentDisplayMonth + 1}月`;
}

// 工具函数5：删除单条记录（根据记录ID，仅执行删除逻辑）
function deleteDiaryRecord(recordId) {
  // 1. 获取本地存储的所有记录
  let allDiaries = JSON.parse(localStorage.getItem('myDiaries')) || [];
  if (!Array.isArray(allDiaries)) allDiaries = [];

  // 2. 过滤掉要删除的记录（匹配recordId）
  allDiaries = allDiaries.filter(diary => {
    return diary.id !== parseInt(recordId);
  });

  // 3. 重新存储到本地
  localStorage.setItem('myDiaries', JSON.stringify(allDiaries));

  // 4. 重新渲染detail页面
  if (isDetailPage) {
    loadFullDiaries();
  }
}

// 工具函数6：卡片内容回弹（隐藏删除键）
function resetCardContent(cardContent) {
  if (cardContent) {
    cardContent.style.transform = 'translateX(0)';
  }
}

// ------------- 1. 首页核心功能：左右按钮切换+弹窗快速选择，双重兼容 -------------
if (isIndexPage) {
  // 初始化首页所有元素（日历+弹窗+左右按钮）
  function initAllElements() {
    // 日历+左右按钮元素
    prevBtn = document.getElementById('prevBtn');
    nextBtn = document.getElementById('nextBtn');
    currentYearMonthEl = document.getElementById('currentYearMonth');
    monthDaysEl = document.getElementById('monthDays');
    // 弹窗元素
    dateSelectMask = document.getElementById('dateSelectMask');
    dateSelectModal = document.getElementById('dateSelectModal');
    yearSelect = document.getElementById('yearSelect');
    monthSelect = document.getElementById('monthSelect');
    cancelModal = document.getElementById('cancelModal');
    confirmModal = document.getElementById('confirmModal');
  }

  // 初始化年份选择框（填充前后5年的选项）
  function initYearSelect() {
    if (!yearSelect) return;
    yearSelect.innerHTML = ''; // 清空原有选项
    const currentYear = new Date().getFullYear();
    // 填充年份选项：currentYear - YEAR_RANGE 到 currentYear + YEAR_RANGE
    for (let y = currentYear - YEAR_RANGE; y <= currentYear + YEAR_RANGE; y++) {
      const option = document.createElement('option');
      option.value = y;
      option.textContent = y + '年';
      // 默认选中当前显示的年份
      if (y === currentDisplayYear) {
        option.selected = true;
      }
      yearSelect.appendChild(option);
    }
  }

  // 初始化月份选择框（填充1-12月）
  function initMonthSelect() {
    if (!monthSelect) return;
    monthSelect.innerHTML = ''; // 清空原有选项
    // 填充月份选项：1-12月（对应value 0-11）
    for (let m = 0; m < 12; m++) {
      const option = document.createElement('option');
      option.value = m;
      option.textContent = (m + 1) + '月';
      // 默认选中当前显示的月份
      if (m === currentDisplayMonth) {
        option.selected = true;
      }
      monthSelect.appendChild(option);
    }
  }

  // 生成当前显示年月对应的日历
  function generateCurrentMonthCalendar() {
    if (!monthDaysEl) return;
    monthDaysEl.innerHTML = ''; // 清空原有日期

    // 1. 获取当前显示月份的关键信息
    const firstDayOfMonth = new Date(currentDisplayYear, currentDisplayMonth, 1).getDay(); // 当月第一天是星期几（0=周日）
    const daysInMonth = new Date(currentDisplayYear, currentDisplayMonth + 1, 0).getDate(); // 当月总天数
    const recordDates = getRecordDates(); // 所有有记录的日期
    const today = new Date(); // 系统今日日期
    // 判断是否是系统当前年月（用于标记今日日期）
    const isSystemCurrentMonth = (today.getFullYear() === currentDisplayYear) && (today.getMonth() === currentDisplayMonth);

    // 2. 填充前置空白（当月第一天之前的星期空白）
    for (let i = 0; i < firstDayOfMonth; i++) {
      const emptyDayEl = document.createElement('div');
      emptyDayEl.className = 'month-day-item';
      monthDaysEl.appendChild(emptyDayEl);
    }

    // 3. 填充当月所有日期
    for (let day = 1; day <= daysInMonth; day++) {
      const dayItemEl = document.createElement('div');
      dayItemEl.className = 'month-day-item';
      dayItemEl.textContent = day;

      // 格式化当前日期为YYYY-MM-DD，用于对比是否有记录
      const dateObj = new Date(currentDisplayYear, currentDisplayMonth, day);
      const currentDateStr = formatDateToYMD(dateObj);

      // 标记系统今日日期（仅当显示年月与系统当前年月一致时）
      if (isSystemCurrentMonth && (day === today.getDate())) {
        dayItemEl.classList.add('today');
      }

      // 若该日期有记录，添加淡绿色标亮样式，并绑定点击跳转事件
      if (recordDates.includes(currentDateStr)) {
        dayItemEl.classList.add('has-record');
        // 点击标亮日期，跳转至detail页面
        dayItemEl.addEventListener('click', function() {
          window.location.href = 'detail.html';
        });
      }

      monthDaysEl.appendChild(dayItemEl);
    }
  }

  // 显示年月选择弹窗（遮罩+弹窗都显示）
  function showDateModal() {
    if (!dateSelectMask || !dateSelectModal) return;
    dateSelectMask.style.display = 'block';
    dateSelectModal.style.display = 'block';
    // 每次显示弹窗时，重新初始化选择框选中状态（确保与当前显示年月一致）
    initYearSelect();
    initMonthSelect();
  }

  // 隐藏年月选择弹窗（遮罩+弹窗都隐藏）
  function hideDateModal() {
    if (!dateSelectMask || !dateSelectModal) return;
    dateSelectMask.style.display = 'none';
    dateSelectModal.style.display = 'none';
  }

  // 左按钮点击事件：切换到上一个月（自动跨年份，仅跳转一个月）
  function bindPrevBtnEvent() {
    if (!prevBtn) return;
    // 先移除可能存在的重复事件（保险措施）
    prevBtn.removeEventListener('click', handlePrevClick);
    // 绑定单次事件
    prevBtn.addEventListener('click', handlePrevClick);
  }

  // 左按钮点击处理函数（单独提取，方便移除重复事件）
  function handlePrevClick() {
    currentDisplayMonth--;
    // 若月份小于0（即1月之前），年份减1，月份设为11（12月）
    if (currentDisplayMonth < 0) {
      currentDisplayYear--;
      currentDisplayMonth = 11;
    }
    updateCurrentYearMonthText(); // 更新年月显示
    generateCurrentMonthCalendar(); // 重新生成日历
  }

  // 右按钮点击事件：切换到下一个月（自动跨年份，仅跳转一个月）
  function bindNextBtnEvent() {
    if (!nextBtn) return;
    // 先移除可能存在的重复事件（保险措施）
    nextBtn.removeEventListener('click', handleNextClick);
    // 绑定单次事件
    nextBtn.addEventListener('click', handleNextClick);
  }

  // 右按钮点击处理函数（单独提取，方便移除重复事件）
  function handleNextClick() {
    currentDisplayMonth++;
    // 若月份大于11（即12月之后），年份加1，月份设为0（1月）
    if (currentDisplayMonth > 11) {
      currentDisplayYear++;
      currentDisplayMonth = 0;
    }
    updateCurrentYearMonthText(); // 更新年月显示
    generateCurrentMonthCalendar(); // 重新生成日历
  }

  // 绑定年月文本点击事件（显示弹窗）
  function bindYearMonthClickEvent() {
    if (!currentYearMonthEl) return;
    currentYearMonthEl.addEventListener('click', function() {
      showDateModal();
    });
  }

  // 绑定取消按钮事件（隐藏弹窗，不更新年月）
  function bindCancelModalEvent() {
    if (!cancelModal) return;
    cancelModal.addEventListener('click', function() {
      hideDateModal();
    });
  }

  // 绑定确认按钮事件（更新年月+隐藏弹窗+重新生成日历）
  function bindConfirmModalEvent() {
    if (!confirmModal || !yearSelect || !monthSelect) return;
    confirmModal.addEventListener('click', function() {
      // 获取选中的年份和月份
      const selectedYear = parseInt(yearSelect.value);
      const selectedMonth = parseInt(monthSelect.value);
      // 更新全局年月变量
      currentDisplayYear = selectedYear;
      currentDisplayMonth = selectedMonth;
      // 更新页面年月显示
      updateCurrentYearMonthText();
      // 重新生成日历
      generateCurrentMonthCalendar();
      // 隐藏弹窗
      hideDateModal();
    });
  }

  // 绑定遮罩层点击事件（点击遮罩隐藏弹窗）
  function bindMaskClickEvent() {
    if (!dateSelectMask) return;
    dateSelectMask.addEventListener('click', function() {
      hideDateModal();
    });
  }

  // 初始化所有功能（左右按钮+弹窗+日历）
  function initCalendarAndModal() {
    initAllElements();
    updateCurrentYearMonthText(); // 初始化年月显示
    generateCurrentMonthCalendar(); // 初始化日历
    initYearSelect(); // 初始化年份选择框
    initMonthSelect(); // 初始化月份选择框
    bindPrevBtnEvent(); // 绑定左按钮切换事件
    bindNextBtnEvent(); // 绑定右按钮切换事件
    bindYearMonthClickEvent(); // 绑定年月文本点击弹窗事件
    bindCancelModalEvent(); // 绑定取消按钮事件
    bindConfirmModalEvent(); // 绑定确认按钮事件
    bindMaskClickEvent(); // 绑定遮罩点击事件
  }

  // 仅执行一次初始化
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initCalendarAndModal();
  } else {
    document.addEventListener('DOMContentLoaded', initCalendarAndModal);
  }
}

// ------------- 2. 填写页面：保存逻辑（无修改） -------------
if (isRecordPage) {
  // 强制初始化元素
  diaryContent = document.getElementById('diaryContent');
  uploadBtn = document.getElementById('uploadPhoto');
  saveBtn = document.getElementById('saveDiary');
  photoPreview = document.getElementById('photoPreview');

  // 照片上传 + 实时预览功能
  if (uploadBtn) {
    uploadBtn.addEventListener('click', function() {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.click();

      fileInput.addEventListener('change', function(e) {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
          const reader = new FileReader();
          reader.onload = function(e) {
            currentPhoto = e.target.result;
            photoPreview.src = currentPhoto;
            photoPreview.style.display = 'block';
          }
          reader.readAsDataURL(selectedFile);
        }
      });
    });
  }

  // 保存记录：无弹窗，直接存储并跳转detail
  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      const diaryContentVal = diaryContent ? diaryContent.value.trim() : '';

      // 内容为空时不保存
      if (!diaryContentVal) {
        return;
      }

      // 创建记录对象（仅保留核心字段，无标题）
      const newDiary = {
        id: new Date().getTime(), // 时间戳作为唯一ID，用于删除
        content: diaryContentVal,
        photo: currentPhoto,
        time: new Date().toLocaleString()
      };

      // 存储到本地
      let allDiaries = JSON.parse(localStorage.getItem('myDiaries')) || [];
      if (!Array.isArray(allDiaries)) allDiaries = [];
      allDiaries.unshift(newDiary);
      localStorage.setItem('myDiaries', JSON.stringify(allDiaries));

      // 清空填写内容
      diaryContent.value = '';
      currentPhoto = null;
      photoPreview.src = '';
      photoPreview.style.display = 'none';

      // 直接跳转detail页面
      window.location.href = 'detail.html';
    });
  }
}

// ------------- 3. 展示页面：完整功能（仅左滑显示删除键+点击弹窗确认删除） -------------
if (isDetailPage) {
  // 左滑相关全局变量（新增isSlided滑动标记）
  let touchStartX = 0; // 触摸起始X坐标
  let touchMoveX = 0; // 触摸移动X坐标
  let currentDiaryCard = null; // 当前触摸的记录卡片
  let currentContentWrap = null; // 当前触摸的卡片内容容器
  const minSlideOffset = 10; // 最小滑动偏移量
  const maxSlideOffset = 120; // 最大滑动偏移量
  const showDeleteOffset = 80; // 露出完整删除键的偏移量
  let isSlided = false; // 滑动标记：是否发生真实左滑行为

  // 触摸开始事件：初始化滑动标记和偏移量
  function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    currentDiaryCard = e.currentTarget;
    currentContentWrap = currentDiaryCard.querySelector('.diary-card-content');
    if (currentContentWrap) {
      currentContentWrap.style.transform = 'translateX(0)';
    }
    isSlided = false; // 初始化：未发生滑动
  }

  // 触摸移动事件：仅左滑时移动内容层，并标记真实滑动
  function handleTouchMove(e) {
    if (!currentContentWrap || !currentDiaryCard) return;
    touchMoveX = e.touches[0].clientX;
    const offsetX = touchMoveX - touchStartX;
    // 仅处理左滑（偏移量<0）且在最大偏移范围内
    if (offsetX < 0 && Math.abs(offsetX) <= maxSlideOffset) {
      currentContentWrap.style.transform = `translateX(${offsetX}px)`;
      // 当偏移量达到最小阈值，标记为已发生真实滑动
      if (Math.abs(offsetX) >= minSlideOffset) {
        isSlided = true;
      }
    }
  }

  // 触摸结束事件：仅真实左滑才保持删除键显示，否则回弹
  function handleTouchEnd() {
    if (!currentContentWrap || !currentDiaryCard) return;
    const offsetX = touchMoveX - touchStartX;

    // 有效滑动判定：左滑 + 偏移量达标 + 发生真实滑动
    if (offsetX < 0 && Math.abs(offsetX) >= minSlideOffset && isSlided) {
      // 固定偏移量，完整露出删除键
      currentContentWrap.style.transform = `translateX(-${showDeleteOffset}px)`;
    } else {
      // 无效操作（点击/轻微抖动/右滑）：内容层回弹
      resetCardContent(currentContentWrap);
    }

    // 重置所有全局变量
    touchStartX = 0;
    touchMoveX = 0;
    currentDiaryCard = null;
    currentContentWrap = null;
    isSlided = false;
  }

  // 删除键点击事件：弹出确认弹窗，确认后删除，取消后回弹
  function handleDeleteTipClick(e) {
    e.stopPropagation(); // 阻止事件冒泡，避免触发卡片触摸事件
    const deleteTip = e.target;
    const diaryCard = deleteTip.closest('.diary-card');
    const cardContent = diaryCard.querySelector('.diary-card-content');
    const recordId = diaryCard.getAttribute('data-id');

    // 弹出确认弹窗
    const isConfirm = confirm('确认要删除这条记录吗？删除后无法恢复！');
    if (isConfirm) {
      // 用户确认：执行删除
      deleteDiaryRecord(recordId);
    } else {
      // 用户取消：卡片内容回弹，隐藏删除键
      resetCardContent(cardContent);
    }
  }

  // 记录分组函数：按日期分组并倒序排列
  function groupDiariesByDate(allDiaries) {
    const dateGroups = {};
    allDiaries.forEach(diary => {
      if (diary.time) {
        const dateObj = new Date(diary.time);
        const dateStr = formatDateToYMD(dateObj);
        const dateCN = formatDateToCN(dateObj);
        if (!dateGroups[dateStr]) {
          dateGroups[dateStr] = {
            dateCN: dateCN,
            diaries: []
          };
        }
        dateGroups[dateStr].diaries.push(diary);
      }
    });

    // 按日期倒序排列分组
    const sortedDateKeys = Object.keys(dateGroups).sort((a, b) => new Date(b) - new Date(a));
    const sortedDateGroups = [];
    sortedDateKeys.forEach(key => {
      sortedDateGroups.push(dateGroups[key]);
    });
    return sortedDateGroups;
  }

  // 加载记录列表：渲染所有分组和卡片
  function loadFullDiaries() {
    if (!fullDiaryList) {
      fullDiaryList = document.getElementById('fullDiaryList');
      if (!fullDiaryList) return;
    }

    fullDiaryList.innerHTML = '';
    let allDiaries = JSON.parse(localStorage.getItem('myDiaries')) || [];
    if (!Array.isArray(allDiaries)) allDiaries = [];

    // 无记录时显示提示
    if (allDiaries.length === 0) {
      fullDiaryList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">暂无碎碎念记录，快去新增吧～</p>';
      return;
    }

    // 按日期分组并渲染
    const sortedDateGroups = groupDiariesByDate(allDiaries);
    sortedDateGroups.forEach(group => {
      const dateGroupEl = document.createElement('div');
      dateGroupEl.className = 'date-group';

      // 创建日期标题
      const dateGroupTitleEl = document.createElement('h4');
      dateGroupTitleEl.className = 'date-group-title';
      dateGroupTitleEl.textContent = group.dateCN;
      dateGroupEl.appendChild(dateGroupTitleEl);

      // 渲染该日期下的所有记录卡片
      group.diaries.sort((a, b) => b.id - a.id).forEach(diary => {
        const diaryCard = document.createElement('div');
        diaryCard.className = 'diary-card';
        diaryCard.setAttribute('data-id', diary.id);

        // 创建删除键
        const deleteTip = document.createElement('div');
        deleteTip.className = 'diary-delete-tip';
        deleteTip.textContent = '删除';
        deleteTip.addEventListener('click', handleDeleteTipClick);

        // 创建卡片内容容器
        const cardContentWrap = document.createElement('div');
        cardContentWrap.className = 'diary-card-content';
        let cardHtml = `
          <span class="card-time">记录时间：${diary.time || '未知时间'}</span>
          <p class="card-content">${diary.content || '无内容'}</p>
        `;
        // 有照片则渲染照片
        if (diary.photo) {
          cardHtml += `<img src="${diary.photo}" class="card-photo" alt="记录照片">`;
        }
        cardContentWrap.innerHTML = cardHtml;

        // 组装卡片
        diaryCard.appendChild(cardContentWrap);
        diaryCard.appendChild(deleteTip);

        // 绑定触摸事件
        diaryCard.addEventListener('touchstart', handleTouchStart);
        diaryCard.addEventListener('touchmove', handleTouchMove);
        diaryCard.addEventListener('touchend', handleTouchEnd);

        dateGroupEl.appendChild(diaryCard);
      });

      fullDiaryList.appendChild(dateGroupEl);
    });
  }

  // 初始化加载记录列表
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    loadFullDiaries();
  } else {
    document.addEventListener('DOMContentLoaded', loadFullDiaries);
  }
}
