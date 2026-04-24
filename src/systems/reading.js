/**
 * reading.js — 睡前讀書系統（2026-04-19）
 *
 * 設計對應：docs/systems/reading.md
 *
 * 流程：
 *   就寢事件 → Reading.tryBedtime()
 *     → 檢查書櫃
 *     → 挑一本書（專心書優先 / 多本無專心則隨機）
 *     → 計算倍率（見識、專心、貪多嚼不爛、勤勉特性）
 *     → advanceReading
 *     → 若讀完 → 觸發 onRead（books.js 處理）
 *     → 若文字書讀完且推進了傻福半醒/清醒 → 觸發警告對白 / 選擇
 *
 * 書櫃 UI 渲染：Reading.renderBookshelf()
 *   掛在角色頁「書櫃」tab，列出所有未讀書、進度、可標記專心書。
 */
const Reading = (() => {

  // CLAUDE.md 第 12 條：bare addLog 在外部模組是 ReferenceError
  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    } else {
      console.warn('[Reading] _log: no addLog available', text);
    }
  }

  // ═════════════════════════════════════════
  // 睡前讀書（主入口）
  // ═════════════════════════════════════════

  /**
   * 就寢時呼叫。檢查書櫃，可能推進某本書的進度。
   * @returns {object} { read: bool, bookId, finished: bool }
   */
  function tryBedtime() {
    const p = Stats.player;
    if (!Array.isArray(p.bookshelf) || p.bookshelf.length === 0) {
      // 勤勉特性 + 無書：什麼都不發生（不是每天都有事件）
      return { read: false };
    }

    // 勤勉玩家：無條件每晚讀（進度倍率正常）
    // 一般玩家：每晚都讀（睡前本來就會翻），只是倍率不同
    const shelf = p.bookshelf;
    let targetBook = null;

    // 選書邏輯
    if (p.focusBookId && shelf.some(b => b.id === p.focusBookId)) {
      targetBook = p.focusBookId;
    } else if (shelf.length === 1) {
      targetBook = shelf[0].id;
    } else {
      // 隨機抽一本
      targetBook = shelf[Math.floor(Math.random() * shelf.length)].id;
    }

    if (!targetBook) return { read: false };

    // 計算倍率
    const mult = _calcBedtimeMult(shelf.length, !!p.focusBookId);

    // 推進讀書
    const result = (typeof Books !== 'undefined') ? Books.advanceReading(targetBook, mult) : { finished: false };

    // 日誌
    const def = Books.get(targetBook);
    if (def) {
      if (result.blocked) {
        // 見識不足 — 不算讀（addLog 已在 books.js 處理）
      } else if (result.finished) {
        _log(`✨ 你讀完了《${def.name.replace(/[《》]/g, '')}》。`, '#ccaa55', true);
      } else {
        const percent = Math.round((result.newProgress / result.totalNights) * 100);
        _log(`📖 睡前讀《${def.name.replace(/[《》]/g, '')}》（${percent}%）`, '#88aacc', false);
      }
    }

    // 文字書讀完 → 檢查傻福階段切換
    if (result.finished && def && (def.type === 'literacy' || def.type === 'memoir')) {
      _checkDullardStageSwitch();
    }

    return { read: true, bookId: targetBook, finished: !!result.finished };
  }

  /**
   * 計算睡前讀書倍率。
   * 專心書：×1.0
   * 無專心 + 1-2 本：×1.0
   * 無專心 + 3 本：×0.7（貪多嚼不爛）
   * 無專心 + 4 本：×0.5
   * 無專心 + 5 本：×0.4
   * 勤勉特性 +0.1 額外加成
   */
  function _calcBedtimeMult(shelfCount, hasFocus) {
    let mult = 1.0;
    if (!hasFocus) {
      if (shelfCount === 3) mult = 0.7;
      else if (shelfCount === 4) mult = 0.5;
      else if (shelfCount >= 5) mult = 0.4;
    }
    // 勤勉 +0.1
    const p = Stats.player;
    if (Array.isArray(p.traits) && p.traits.includes('diligence')) {
      mult += 0.1;
    }
    return mult;
  }

  /**
   * 傻福階段切換事件。由 modDiscernment 在切換時觸發。
   */
  function _checkDullardStageSwitch() {
    const p = Stats.player;
    if (!Array.isArray(p.traits) || !p.traits.includes('dullard_lucky')) return;

    const stage = p.dullardStage || 0;

    // 半醒階段（見識 5-9）：觸發 NPC 警告（每次讀完文字書觸發一次）
    if (stage === 1 && !Flags.has('dullard_half_awakened_warned')) {
      Flags.set('dullard_half_awakened_warned', true);
      _showHalfAwakenWarning();
    }

    // 清醒階段（見識 10+）：觸發最終事件（拆除傻福）
    if (stage === 2 && !Flags.has('dullard_awakened')) {
      Flags.set('dullard_awakened', true);
      _showFullyAwaken();
    }
  }

  /**
   * 半醒警告對白（讀完文字書首次達成見識 5）。
   */
  function _showHalfAwakenWarning() {
    if (typeof DialogueModal === 'undefined') return;
    const lines = [
      { speaker: '...', text: '你感覺腦袋比以前清醒了一點。' },
      { speaker: '...', text: '以前覺得天大的笑話，現在看著只覺得⋯好像沒那麼好笑了。' },
      { speaker: '...', text: '但你一直喜歡笑的。你是喜歡的吧？' },
    ];
    DialogueModal.play(lines, { onEnd: () => _offerDullardChoice() });
  }

  /**
   * 半醒選擇：繼續讀 / 停在這裡。
   */
  function _offerDullardChoice() {
    if (typeof ChoiceModal === 'undefined') return;
    ChoiceModal.play({
      title: '你要繼續讀下去嗎？',
      description: '再讀更多書，你就會真正變「清醒」— 失去傻福所有加成。或者你可以停在這裡。',
      choices: [
        {
          text: '繼續，我想看見這個世界',
          onSelect: () => {
            Flags.set('dullard_chose_continue', true);
            _log('你決定繼續讀下去。', '#88aacc', false);
          },
        },
        {
          text: '夠了，我這樣挺好',
          onSelect: () => {
            // 捨棄所有文字書
            const p = Stats.player;
            if (Array.isArray(p.bookshelf)) {
              p.bookshelf = p.bookshelf.filter(b => {
                const def = Books.get(b.id);
                return def && !(def.type === 'literacy' || def.type === 'memoir');
              });
            }
            // 獲得粗識文字
            if (!Array.isArray(p.traits)) p.traits = [];
            if (!p.traits.includes('partial_literate')) {
              p.traits.push('partial_literate');
            }
            Flags.set('refused_awakening', true);
            _log('✦ 你獲得了新的特性：【粗識文字】', '#88cc77', true);
            _log('你決定停在這裡。', '#aaccaa', false);
          },
        },
      ],
    });
  }

  /**
   * 傻福完全清醒（見識達 10）。
   */
  function _showFullyAwaken() {
    if (typeof DialogueModal === 'undefined') return;
    const lines = [
      { speaker: '...', text: '你合上書的那一刻，感覺到什麼東西離開了你。' },
      { speaker: '...', text: '那個每天笑嘻嘻走進訓練場的你⋯⋯不在了。' },
      { speaker: '...', text: '取代他的，是一個知道世界有多大、人心有多深的你。' },
      { speaker: '...', text: '好事。也許吧。' },
    ];
    DialogueModal.play(lines, {
      onEnd: () => {
        // 移除 dullard_lucky 特性
        const p = Stats.player;
        if (Array.isArray(p.traits)) {
          const idx = p.traits.indexOf('dullard_lucky');
          if (idx >= 0) p.traits.splice(idx, 1);
        }
        // 加入識字 + WIL+2
        if (!p.traits.includes('literate')) p.traits.push('literate');
        p.WIL = (p.WIL || 10) + 2;
        _log('✧ 你失去了特性：【傻人傻福】', '#8899aa', false);
        _log('✦ 你獲得了特性：【識字】，WIL +2', '#88cc77', true);
      }
    });
  }

  // ═════════════════════════════════════════
  // 書櫃 UI
  // ═════════════════════════════════════════

  /**
   * 渲染書櫃 UI 到指定容器。
   * @param {string} containerId 容器 ID
   */
  function renderBookshelf(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const p = Stats.player;
    const shelf = Array.isArray(p.bookshelf) ? p.bookshelf : [];
    const discernment = p.discernment || 0;

    let html = '';
    html += `<div class="bookshelf-header">`;
    html += `  <div class="bs-discernment">見識 <strong>${discernment}</strong></div>`;
    html += `  <div class="bs-capacity">書櫃 ${shelf.length} / 5</div>`;
    html += `</div>`;

    if (shelf.length === 0) {
      html += `<div class="bookshelf-empty">你還沒有書。</div>`;
    } else {
      html += `<div class="bookshelf-list">`;
      shelf.forEach(entry => {
        const def = Books.get(entry.id);
        if (!def) return;
        const isFocus = (p.focusBookId === entry.id);
        const percent = Math.min(100, Math.round((entry.progress / entry.nights) * 100));
        const canReadNow = Books.canRead(entry.id);
        const typeIcon = { literacy:'📖', memoir:'📜', skill:'⚔', blueprint:'🔨', map:'🗺️' }[def.type] || '📖';
        const typeName = { literacy:'識字', memoir:'傳記', skill:'技能', blueprint:'藍圖', map:'秘文' }[def.type] || '書';

        html += `<div class="bookshelf-item ${isFocus ? 'is-focus' : ''} ${canReadNow ? '' : 'is-locked'}" data-book-id="${entry.id}">`;
        html += `  <div class="bs-book-title">${typeIcon} ${def.name}</div>`;
        html += `  <div class="bs-book-flavor">${def.flavor}</div>`;
        html += `  <div class="bs-book-progress">`;
        html += `    <div class="bs-progress-bar"><div class="bs-progress-fill" style="width:${percent}%"></div></div>`;
        html += `    <div class="bs-progress-text">${Math.round(entry.progress)}/${entry.nights} 晚（${typeName}）</div>`;
        html += `  </div>`;
        if (!canReadNow) {
          html += `  <div class="bs-book-locked">需見識 ≥ ${def.minDiscernment}</div>`;
        }
        html += `  <button class="bs-focus-btn" data-book-id="${entry.id}">${isFocus ? '✓ 專心讀' : '標記專心'}</button>`;
        html += `</div>`;
      });
      html += `</div>`;
    }

    // 貪多嚼不爛提示
    if (shelf.length >= 3 && !p.focusBookId) {
      html += `<div class="bookshelf-warning">⚠ 書太多了。設一本「專心讀」的書可以讀得更快。</div>`;
    }

    el.innerHTML = html;

    // 綁定專心書按鈕
    el.querySelectorAll('.bs-focus-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-book-id');
        p.focusBookId = (p.focusBookId === id) ? null : id;
        renderBookshelf(containerId);
      });
    });
  }

  return {
    tryBedtime,
    renderBookshelf,
    // 暴露給外部測試 / 事件手動觸發
    _checkDullardStageSwitch,
  };
})();
