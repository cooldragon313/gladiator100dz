/**
 * dialogue_modal.js — 重量級對話系統 L2（D.21）
 * ══════════════════════════════════════════════════
 * 用於「任務脊椎事件」的暫停式對話演出：
 *   - 打字機動畫（預設 28ms/字）
 *   - Space / Enter / 點擊 → 跳過打字機 / 前進下一句
 *   - Ctrl 按下 → 秒過整段對話（重複玩家的朋友）
 *   - 最末可串接 ChoiceModal
 *
 * 不用於：碎念、戰鬥 log、訓練回饋、日常 storyReveal flavor。
 * 那些是自動流，繼續使用 addLog。
 *
 * 使用範例：
 *   DialogueModal.play([
 *     { speaker: '奧蘭', text: '……你叫什麼？' },
 *     { speaker: '你',   text: '（你告訴他你的名字。）' },
 *     { speaker: '奧蘭', text: '我叫奧蘭。磨坊來的，沒揮過劍。' },
 *     { speaker: '奧蘭', text: '我們一起活下去吧。' },
 *   ], {
 *     onComplete: () => { /* 進 ChoiceModal 或 log 結果 * / }
 *   });
 *
 * 依賴：無（純 DOM）
 * 載入順序：choice_modal.js 之後即可
 */
const DialogueModal = (() => {

  const TYPE_SPEED_MS = 28;        // 普通速度 ~35 字/秒
  const TYPE_SPEED_FAST_MS = 4;    // 按住 Ctrl 時的速度

  let _isOpen     = false;
  let _lines      = [];
  let _lineIdx    = 0;
  let _typeTimer  = null;
  let _typeIdx    = 0;
  let _fullyShown = false;
  let _ctrlDown   = false;
  let _onComplete = null;
  let _injected   = false;
  let _hintShown  = false;   // 首次開啟時在右下角提示 Space / Ctrl

  // ══════════════════════════════════════════════════
  // DOM 建立
  // ══════════════════════════════════════════════════
  function _ensureElements() {
    if (_injected) return;
    if (document.getElementById('modal-dialogue')) { _injected = true; return; }

    const html = `
      <div class="modal-overlay dialogue-overlay" id="modal-dialogue">
        <div class="dialogue-dim"></div>
        <div class="dialogue-box" id="dialogue-box">
          <div class="dialogue-speaker" id="dialogue-speaker"></div>
          <div class="dialogue-text"    id="dialogue-text"></div>
          <div class="dialogue-continue" id="dialogue-continue">▼</div>
        </div>
      </div>
    `;
    const wrap = document.createElement('div');
    wrap.innerHTML = html.trim();
    document.body.appendChild(wrap.firstChild);
    _injected = true;

    // 點擊任意處推進
    document.getElementById('modal-dialogue').addEventListener('click', () => {
      if (_isOpen) _advance();
    });
  }

  // ══════════════════════════════════════════════════
  // 主 API
  // ══════════════════════════════════════════════════
  /**
   * 播放一段對話。
   * @param {Array} lines  字串陣列或物件陣列 [{ speaker, text }, ...]
   * @param {Object} [opts]
   * @param {Function} [opts.onComplete]  最後一句播完後呼叫
   */
  function play(lines, opts = {}) {
    _ensureElements();
    if (!Array.isArray(lines) || lines.length === 0) {
      if (typeof opts.onComplete === 'function') opts.onComplete();
      return;
    }

    // 正規化：字串 → 物件
    _lines = lines.map(l => {
      if (typeof l === 'string') return { text: l };
      return l;
    });
    _lineIdx = 0;
    _onComplete = opts.onComplete || null;
    _isOpen = true;

    const modal = document.getElementById('modal-dialogue');
    modal.classList.add('open');

    // 首次出現時在右下角顯示按鍵提示（只顯示一次）
    if (!_hintShown) {
      _showKeyHint();
      _hintShown = true;
    }

    _showCurrentLine();
  }

  function _showCurrentLine() {
    const line = _lines[_lineIdx];
    if (!line) { _close(); return; }

    const speakerEl = document.getElementById('dialogue-speaker');
    const textEl    = document.getElementById('dialogue-text');
    const contEl    = document.getElementById('dialogue-continue');

    if (speakerEl) {
      speakerEl.textContent = line.speaker || '';
      speakerEl.style.display = line.speaker ? '' : 'none';
    }
    if (textEl) textEl.textContent = '';
    if (contEl) contEl.style.display = 'none';
    _fullyShown = false;
    _typeIdx = 0;

    // 按住 Ctrl → 瞬間全顯
    if (_ctrlDown) {
      if (textEl) textEl.textContent = line.text;
      _fullyShown = true;
      if (contEl) contEl.style.display = '';
      // Ctrl 下還會自動前進到下一句（避免每句都要按一下）
      setTimeout(() => { if (_ctrlDown && _isOpen) _advance(); }, 60);
      return;
    }

    clearInterval(_typeTimer);
    const speed = _ctrlDown ? TYPE_SPEED_FAST_MS : TYPE_SPEED_MS;
    _typeTimer = setInterval(() => {
      if (_typeIdx < line.text.length) {
        textEl.textContent += line.text[_typeIdx++];
      } else {
        clearInterval(_typeTimer);
        _fullyShown = true;
        if (contEl) contEl.style.display = '';
      }
    }, speed);
  }

  function _advance() {
    if (!_isOpen) return;
    if (!_fullyShown) {
      // 跳過打字機 → 顯示完整當句
      clearInterval(_typeTimer);
      const line = _lines[_lineIdx];
      if (line) {
        const textEl = document.getElementById('dialogue-text');
        if (textEl) textEl.textContent = line.text;
      }
      _fullyShown = true;
      const contEl = document.getElementById('dialogue-continue');
      if (contEl) contEl.style.display = '';
      return;
    }
    // 下一句
    _lineIdx++;
    if (_lineIdx >= _lines.length) {
      _close();
    } else {
      _showCurrentLine();
    }
  }

  function _close() {
    _isOpen = false;
    clearInterval(_typeTimer);
    const modal = document.getElementById('modal-dialogue');
    if (modal) modal.classList.remove('open');
    const cb = _onComplete;
    _onComplete = null;
    _lines = [];
    _lineIdx = 0;
    if (typeof cb === 'function') {
      try { cb(); } catch (e) { console.error('[DialogueModal] onComplete error', e); }
    }
  }

  // ══════════════════════════════════════════════════
  // 按鍵提示（右下角淡入淡出，只顯示一次）
  // ══════════════════════════════════════════════════
  function _showKeyHint() {
    let hint = document.getElementById('dialogue-key-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'dialogue-key-hint';
      hint.className = 'dialogue-key-hint';
      hint.innerHTML = '💡 <strong>Space</strong> 繼續 · 按住 <strong>Ctrl</strong> 秒過';
      document.body.appendChild(hint);
    }
    hint.classList.add('show');
    setTimeout(() => { hint.classList.remove('show'); }, 5000);
  }

  // ══════════════════════════════════════════════════
  // 鍵盤控制
  // ══════════════════════════════════════════════════
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Control') _ctrlDown = true;
    if (!_isOpen) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      _advance();
    }
    // Ctrl 首次按下時也會觸發一次 advance，讓當句立刻完成
    if (e.key === 'Control' && !_fullyShown) {
      clearInterval(_typeTimer);
      const line = _lines[_lineIdx];
      if (line) {
        const textEl = document.getElementById('dialogue-text');
        if (textEl) textEl.textContent = line.text;
      }
      _fullyShown = true;
      // 接著自動前進
      setTimeout(() => { if (_ctrlDown && _isOpen) _advance(); }, 60);
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Control') _ctrlDown = false;
  });

  return {
    play,
    isOpen: () => _isOpen,
  };
})();
