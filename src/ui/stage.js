/**
 * stage.js — 「舞台」模組：中央場景動畫層
 *
 * 中央的 #scene-view 是所有動畫/場景切換的容器，之後會逐步把「訓練場畫面」
 * 「任務 CG」「夢境」「傳喚」等都收進這層統一管理。
 *
 * 目前（第一版）只實作：
 *   Stage.playSleep(onBlack) — 上下黑幕閉眼、顯示 zzz 動畫、再掀開。
 *
 * 設計概念：
 *   - 閉眼用上下兩片 curtain（top/bottom）各占 50%，向中間滑動
 *   - 中間匯合後整片黑幕，播 zzz 動畫（飄浮、淡入淡出）
 *   - `onBlack` callback 在畫面完全黑的瞬間呼叫，讓呼叫端（sleepEndDay）
 *     在玩家看不到的情況下完成天數推進、NPC roll、事件觸發
 *   - 最後掀開眼簾，回到正常畫面
 */
const Stage = (() => {

  const STAGE_ID = 'scene-view';          // 現有的中央容器 id（未來 rename 為 stage）
  const CLOSE_MS      = 900;              // 閉眼耗時
  const BLACK_HOLD_MS = 1800;             // 全黑期間（zzz 顯示）
  const OPEN_MS       = 700;              // 掀眼耗時
  const ONBLACK_DELAY = 100;              // 閉眼完成後多等一下再呼叫 onBlack

  let _injected = false;

  /** 把 curtain + zzz overlay 注入到 #scene-view 中（只做一次） */
  function _ensureElements() {
    if (_injected) return;
    const stage = document.getElementById(STAGE_ID);
    if (!stage) return;

    const curtainTop = document.createElement('div');
    curtainTop.id = 'stage-curtain-top';
    curtainTop.className = 'stage-curtain stage-curtain-top';

    const curtainBot = document.createElement('div');
    curtainBot.id = 'stage-curtain-bot';
    curtainBot.className = 'stage-curtain stage-curtain-bot';

    const zzz = document.createElement('div');
    zzz.id = 'stage-zzz';
    zzz.className = 'stage-zzz hidden';
    // 三個錯位飄浮的 z
    zzz.innerHTML = `
      <span class="zzz-char zzz-1">z</span>
      <span class="zzz-char zzz-2">z</span>
      <span class="zzz-char zzz-3">z</span>
    `;

    stage.appendChild(curtainTop);
    stage.appendChild(curtainBot);
    stage.appendChild(zzz);
    _injected = true;
  }

  function _wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  /**
   * 等待兩個 animation frame，確保元素的初始 transform 已被瀏覽器
   * 提交（committed），之後改 class 才會觸發 transition。
   * 這是必要的：第一次呼叫 _ensureElements 後如果沒等，瀏覽器會把
   * 初始狀態與目標狀態「合併」成瞬間跳轉，沒有動畫。
   */
  function _nextPaint() {
    return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  /**
   * 閉眼：上下黑幕滑到中間合攏。
   */
  async function closeEyes() {
    _ensureElements();
    const top = document.getElementById('stage-curtain-top');
    const bot = document.getElementById('stage-curtain-bot');
    if (!top || !bot) return;
    // 強制瀏覽器先把初始 transform 畫一次，才能看到 transition
    await _nextPaint();
    // 額外強制 reflow（保險）
    void top.offsetHeight;
    top.classList.add('closed');
    bot.classList.add('closed');
    await _wait(CLOSE_MS);
  }

  /**
   * 掀眼：黑幕退回畫面外。
   */
  async function openEyes() {
    const top = document.getElementById('stage-curtain-top');
    const bot = document.getElementById('stage-curtain-bot');
    if (!top || !bot) return;
    top.classList.remove('closed');
    bot.classList.remove('closed');
    await _wait(OPEN_MS);
  }

  function showZzz() {
    const el = document.getElementById('stage-zzz');
    if (el) el.classList.remove('hidden');
  }
  function hideZzz() {
    const el = document.getElementById('stage-zzz');
    if (el) el.classList.add('hidden');
  }

  /**
   * 播放完整的就寢動畫：閉眼 → zzz → 掀眼。
   * onBlack 會在畫面全黑時被呼叫，讓呼叫端可以在幕後推進狀態。
   *
   * @param {Function|Object} arg — 相容舊呼叫法：傳 function 視為 onBlack。
   *                                 新呼叫法：{ sleepType, onBlack, onText } 物件。
   * @returns {Promise<void>}
   */
  async function playSleep(arg) {
    let onBlack, sleepType = 'normal', skipFinalOpen = false;
    if (typeof arg === 'function') onBlack = arg;
    else if (arg && typeof arg === 'object') {
      onBlack       = arg.onBlack;
      sleepType     = arg.sleepType || 'normal';
      skipFinalOpen = !!arg.skipFinalOpen;    // 🆕 D.21：留黑給 playMorning 接手
    }

    _ensureElements();
    _ensureOpeningOverlay();

    // 1. 閉眼
    await closeEyes();

    // 2. 幕後工作（玩家看不到）
    await _wait(ONBLACK_DELAY);
    if (typeof onBlack === 'function') {
      try { onBlack(); } catch (e) { console.error('[Stage] onBlack error', e); }
    }

    // 3. 依 sleepType 顯示不同視覺
    const overlay = document.getElementById('stage-opening');

    if (sleepType === 'normal') {
      // 正常睡眠：金色 zzz 飄浮
      showZzz();
      await _wait(BLACK_HOLD_MS);
      hideZzz();
    } else if (sleepType === 'insomnia') {
      // 失眠：zzz 短暫出現然後打斷，顯示內心低語
      showZzz();
      await _wait(700);
      hideZzz();
      if (overlay) {
        overlay.innerHTML = `<div class="opening-line insomnia-line">該死——今晚又沒睡好。</div>`;
        await _nextPaint();
        overlay.classList.add('visible');
        overlay.querySelector('.opening-line').classList.add('shown');
        await _wait(1600);
        overlay.classList.remove('visible');
        await _wait(OPENING_FADE_OUT_MS);
        overlay.innerHTML = '';
      }
    } else if (sleepType === 'nightmare') {
      // 噩夢：跳過 zzz，直接顯示紅色敘述
      if (overlay) {
        overlay.innerHTML = `
          <div class="opening-line nightmare-line">你夢見了鮮血。</div>
          <div class="opening-line nightmare-line">又是那張臉——你還是想不起來他是誰。</div>
        `;
        await _nextPaint();
        overlay.classList.add('visible');
        overlay.querySelectorAll('.opening-line').forEach((el, i) => {
          setTimeout(() => el.classList.add('shown'), i * 900);
        });
        await _wait(2600);
        overlay.classList.remove('visible');
        await _wait(OPENING_FADE_OUT_MS);
        overlay.innerHTML = '';
      }
    }

    // 4. 掀眼（skipFinalOpen 時保留黑幕給 playMorning 接手）
    if (!skipFinalOpen) await openEyes();
  }

  // ══════════════════════════════════════════════════
  // 🆕 Opening narrative（開場敘述）
  // ══════════════════════════════════════════════════
  const OPENING_LINE_INTERVAL = 1200;   // 每行之間的間隔（ms）
  const OPENING_HOLD_AFTER    = 1600;   // 最後一行顯示後停留時間
  const OPENING_FADE_OUT_MS   = 600;    // 敘述淡出時間

  let _openingInjected = false;

  function _ensureOpeningOverlay() {
    if (_openingInjected) return;
    _ensureElements();   // 確保 curtains 也在
    const stage = document.getElementById(STAGE_ID);
    if (!stage) return;
    const overlay = document.createElement('div');
    overlay.id = 'stage-opening';
    stage.appendChild(overlay);
    _openingInjected = true;
  }

  /**
   * 播放開場敘述：閉眼 → 文字逐行淡入 → 停留 → 文字淡出 → 掀眼。
   * @param {string[]} lines — 開場敘述多行文字
   * @param {Function} [onBlack] — 文字全黑期間呼叫（套用新遊戲狀態用）
   * @returns {Promise<void>}
   */
  async function playOpening(lines, onBlack) {
    _ensureOpeningOverlay();
    const overlay = document.getElementById('stage-opening');
    if (!overlay) return;

    // 1. 閉眼（黑幕合攏）
    await closeEyes();

    // 2. 幕後工作（玩家看不到）
    if (typeof onBlack === 'function') {
      try { onBlack(); } catch (e) { console.error('[Stage] onBlack error', e); }
    }

    // 3. 準備文字容器
    overlay.innerHTML = (lines || []).map(l =>
      `<div class="opening-line">${l}</div>`
    ).join('');
    await _nextPaint();
    overlay.classList.add('visible');

    // 4. 逐行淡入
    const lineEls = overlay.querySelectorAll('.opening-line');
    for (const el of lineEls) {
      el.classList.add('shown');
      await _wait(OPENING_LINE_INTERVAL);
    }

    // 5. 讓最後一行停留一下
    await _wait(OPENING_HOLD_AFTER);

    // 6. 整塊淡出
    overlay.classList.remove('visible');
    await _wait(OPENING_FADE_OUT_MS);
    overlay.innerHTML = '';

    // 7. 掀眼，回到訓練場
    await openEyes();
  }

  // ══════════════════════════════════════════════════
  // 🆕 D.12 v2: 通用事件小過場（playEvent）
  // ══════════════════════════════════════════════════
  /**
   * 在現有畫面上播放一段事件文字（不關眼），用於主人傳喚、任務觸發等需要
   * 停留感的非致命事件。視覺上：暗化背景 + 標題 + 多行文字逐行淡入 + 停留 + 淡出。
   *
   * @param {Object} opts
   *   - title:  事件標題（例如「主人傳喚」），可選
   *   - icon:   事件圖示 emoji（例如 📜），可選
   *   - lines:  字串陣列，每行獨立淡入
   *   - color:  強調色（預設金色）
   *   - holdMs: 最後一行停留時間（預設 2200）
   * @returns {Promise<void>}
   */
  async function playEvent(opts = {}) {
    _ensureOpeningOverlay();
    const overlay = document.getElementById('stage-opening');
    if (!overlay) return;

    const title  = opts.title  || '';
    const icon   = opts.icon   || '';
    const lines  = Array.isArray(opts.lines) ? opts.lines : [];
    const color  = opts.color  || '#e8d070';
    const holdMs = opts.holdMs || 2200;

    // 組 HTML：icon + title + 每行文字
    overlay.innerHTML = `
      ${icon  ? `<div class="event-icon" style="color:${color}">${icon}</div>` : ''}
      ${title ? `<div class="event-title" style="color:${color}">${title}</div>` : ''}
      ${lines.map(l => `<div class="opening-line event-line" style="color:${color}">${l}</div>`).join('')}
    `;
    await _nextPaint();
    overlay.classList.add('visible');

    // 🆕 2026-04-22: 內容高度超過容器時，切換成底部對齊 + 自動滾動
    const needsScroll = overlay.scrollHeight > overlay.clientHeight;
    if (needsScroll) overlay.classList.add('overflow');

    // 標題和 icon 先出現
    await _wait(300);

    // 逐行淡入
    const lineEls = overlay.querySelectorAll('.opening-line');
    for (const el of lineEls) {
      el.classList.add('shown');
      // 🆕 新行顯示後自動滾動到該行（若有溢出）
      if (needsScroll) {
        el.scrollIntoView({ block: 'end', behavior: 'smooth' });
      }
      await _wait(900);
    }

    // 停留
    await _wait(holdMs);

    // 淡出
    overlay.classList.remove('visible');
    overlay.classList.remove('overflow');   // 🆕 清除 overflow 狀態
    await _wait(OPENING_FADE_OUT_MS);
    overlay.innerHTML = '';
  }

  // ══════════════════════════════════════════════════
  // 🆕 D.21 晨起過場（playMorning）
  // ══════════════════════════════════════════════════
  // 流程：
  //   0.0s — 黑幕保持
  //   0.3s — 雞鳴淡入（italic 暗金）
  //   1.2s — 內心獨白淡入 + 打字機（灰斜體）
  //   內心獨白播完後 +0.6s → 黑幕掀開（reveal）
  //   掀完 → onComplete
  //
  // 按 Space / 點擊 → 跳過打字機
  // 按 Ctrl → 快速推進全部
  const MORNING_ROOSTER_HOLD_MS = 900;
  const MORNING_THOUGHT_TYPE_MS = 40;     // 打字機慢一點，讀起來更沉靜
  const MORNING_THOUGHT_HOLD_MS = 800;

  async function playMorning(opts = {}) {
    _ensureElements();
    const innerThought = opts.innerThought || '';
    const onComplete   = opts.onComplete;
    const assumeBlack  = !!opts.assumeBlack;  // true = 黑幕已經關閉（由 playSleep 接手），不重複閉眼

    // 1) 如果畫面還亮著，先閉眼
    if (!assumeBlack) await closeEyes();

    // 2) 注入晨起覆蓋層
    const stage = document.getElementById(STAGE_ID);
    if (!stage) { if (onComplete) onComplete(); return; }

    let overlay = document.getElementById('stage-morning-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'stage-morning-overlay';
      overlay.className = 'stage-morning-overlay';
      overlay.innerHTML = `
        <div class="morning-rooster" id="morning-rooster">🐓……咯咯咯……</div>
        <div class="morning-thought" id="morning-thought"></div>
      `;
      stage.appendChild(overlay);
    }
    overlay.classList.remove('fade-out');
    overlay.style.display = '';       // 🆕 確保上次 hide 後重新顯示
    const roosterEl  = document.getElementById('morning-rooster');
    const thoughtEl  = document.getElementById('morning-thought');
    if (roosterEl) { roosterEl.classList.remove('visible'); roosterEl.textContent = '🐓……咯咯咯……'; }
    if (thoughtEl) { thoughtEl.classList.remove('visible'); thoughtEl.textContent = ''; }

    // 允許玩家跳過
    let _skipRequested = false;
    const _skipHandler = (e) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Control') _skipRequested = true;
    };
    const _clickHandler = () => { _skipRequested = true; };
    document.addEventListener('keydown', _skipHandler);
    overlay.addEventListener('click', _clickHandler);

    // 3) 雞鳴淡入 + 🆕 音效
    await _wait(300);
    if (typeof SoundManager !== 'undefined') SoundManager.playSynth('rooster');
    if (roosterEl) roosterEl.classList.add('visible');
    await _wait(_skipRequested ? 0 : MORNING_ROOSTER_HOLD_MS);

    // 4) 內心獨白 — 打字機
    if (innerThought && thoughtEl) {
      thoughtEl.classList.add('visible');
      if (_skipRequested) {
        thoughtEl.textContent = innerThought;
      } else {
        for (let i = 0; i < innerThought.length; i++) {
          if (_skipRequested) { thoughtEl.textContent = innerThought; break; }
          thoughtEl.textContent += innerThought[i];
          await _wait(MORNING_THOUGHT_TYPE_MS);
        }
      }
      await _wait(_skipRequested ? 150 : MORNING_THOUGHT_HOLD_MS);
    }

    // 5) 淡出覆蓋層
    overlay.classList.add('fade-out');
    await _wait(400);
    if (roosterEl) roosterEl.classList.remove('visible');
    if (thoughtEl) thoughtEl.classList.remove('visible');
    // 🆕 修正：完全隱藏覆蓋層，避免擋住底下的 UI（戰鬥鈕等）
    overlay.style.display = 'none';

    // 移除事件
    document.removeEventListener('keydown', _skipHandler);
    overlay.removeEventListener('click', _clickHandler);

    // 6) 掀眼
    await openEyes();

    if (typeof onComplete === 'function') onComplete();
  }

  // ══════════════════════════════════════════════════
  // 🆕 2026-04-24 大字 POPUP（共用元件）
  //   用於：狂熱觸發/結束、屬性升級、未來重要獲得物
  //   螢幕中央大字 + 副標題、淡入淡出、配震動 + 音效。
  //   不出現數字（rule § 0.1）
  // ══════════════════════════════════════════════════
  /**
   * @param {Object} opts
   *   icon      — emoji 或符號（'⚡' / '✦' / '🔥'）
   *   title     — 大字標題
   *   subtitle  — 小字副標題（可選）
   *   color     — 'gold' (default) | 'red' | 'green' | 'cyan'
   *   duration  — 顯示總時長 ms (default 1800)
   *   shake     — true 觸發 game-root 震動 (default true)
   *   sound     — 'acquire' | 'level_up' | 'debuff' | null (default 'acquire')
   *   onComplete — popup 消失後呼叫
   */
  function popupBig(opts = {}) {
    const icon     = opts.icon     || '⚡';
    const title    = opts.title    || '';
    const subtitle = opts.subtitle || '';
    const color    = opts.color    || 'gold';
    const duration = opts.duration || 1800;
    const shake    = opts.shake !== false;
    const sound    = (opts.sound === undefined) ? 'acquire' : opts.sound;
    const onComplete = opts.onComplete;

    // 建立 / 取得 popup 容器
    let popup = document.getElementById('stage-popup-big');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'stage-popup-big';
      popup.className = 'stage-popup-big';
      document.body.appendChild(popup);
    }
    popup.className = 'stage-popup-big color-' + color;
    popup.innerHTML = `
      <div class="popup-icon">${icon}</div>
      <div class="popup-title">${title}</div>
      ${subtitle ? `<div class="popup-subtitle">${subtitle}</div>` : ''}
    `;

    // 重置動畫（強制 reflow）
    popup.style.animation = 'none';
    void popup.offsetWidth;
    popup.style.animation = `popupBigShow ${duration}ms ease-out forwards`;

    // 震動 + 音效
    if (shake && typeof Game !== 'undefined' && Game.shakeGameRoot) Game.shakeGameRoot();
    if (sound && typeof SoundManager !== 'undefined') SoundManager.playSynth(sound);

    // 結束 callback
    if (typeof onComplete === 'function') {
      setTimeout(() => { try { onComplete(); } catch (e) { console.error('[Stage.popupBig]', e); } }, duration);
    }
  }

  return {
    playSleep,
    playOpening,
    playEvent,
    playMorning,
    closeEyes,
    openEyes,
    showZzz,
    hideZzz,
    popupBig,   // 🆕 2026-04-24
  };
})();
