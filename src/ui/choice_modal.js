/**
 * choice_modal.js — 玩家選擇 modal（Phase 1-E.2 / E.11）
 *
 * 通用的「玩家需要做決定」UI 元件。支援：
 *   - 多選項（2~5 個）
 *   - 選項條件鎖（特性/屬性/origin/好感/旗標）
 *   - 效果 / 旗標寫入 / 敘事結果 log
 *   - 加權隨機結果（rolls）
 *   - forced: 強制選擇，無法關閉
 *
 * 使用範例：
 *   ChoiceModal.show({
 *     id:    'hunger_critical',
 *     title: '飢餓難耐',
 *     icon:  '🍞',
 *     body:  '你已經兩天沒好好吃東西...',
 *     forced: true,
 *     choices: [
 *       {
 *         id: 'endure',
 *         label: '忍著',
 *         hint:  '什麼都不做，繼續熬',
 *         effects: [ { type:'vital', key:'mood', delta:-10 } ],
 *         resultLog: '你咬牙忍住。',
 *       },
 *       {
 *         id: 'beg',
 *         label: '乞討',
 *         rolls: [
 *           { weight: 50, effects: [{type:'vital',key:'food',delta:25}], log:'有人給了你麵包。' },
 *           { weight: 50, effects: [{type:'vital',key:'mood',delta:-15}], log:'被路人啐了一口。' },
 *         ],
 *       },
 *     ],
 *   });
 *
 * 資料欄位（choice）：
 *   id               — 選項 ID（唯一）
 *   label            — 按鈕上顯示的文字
 *   hint             — 按鈕下方小字提示（可選）
 *   requireTrait     — 需要此特性才能看到此選項
 *   requireNoTrait   — 需要「沒有」此特性
 *   requireAnyTrait  — 需要任一特性 ['trait1','trait2']
 *   requireOrigin    — 限此 origin
 *   requireOriginNot — 排除此 origin
 *   requireMinAttr   — { WIL: 15 } 屬性最低
 *   requireFlag      — 需某旗標
 *   requireAffection — { npcId: min } 好感門檻
 *   effects          — 確定性效果陣列（與 rolls 擇一）
 *   rolls            — 加權隨機結果 [{ weight, effects, log }, ...]
 *   flagSet          — 選完後要設的旗標
 *   grantItem        — 選完後給的道具（留給 D.14）
 *   resultLog        — 選完後的 log 文字（若有 rolls 則改用 rolls[i].log）
 *   logColor         — log 顏色
 */
const ChoiceModal = (() => {
  let _activeEvent  = null;
  let _activeChoices = [];
  let _injected     = false;

  function _ensureElements() {
    if (_injected) return;
    const existing = document.getElementById('modal-choice');
    if (existing) { _injected = true; return; }

    const html = `
      <div class="modal-overlay" id="modal-choice">
        <div class="modal-box choice-modal-box">
          <div class="choice-header">
            <span class="choice-icon" id="choice-icon"></span>
            <span class="choice-title" id="choice-title"></span>
          </div>
          <div class="choice-body" id="choice-body"></div>
          <div class="choice-options" id="choice-options"></div>
          <button class="choice-close" id="choice-close" title="關閉">✕</button>
        </div>
      </div>
    `;
    const wrap = document.createElement('div');
    wrap.innerHTML = html.trim();
    document.body.appendChild(wrap.firstChild);
    _injected = true;

    // Bind close button
    const closeBtn = document.getElementById('choice-close');
    if (closeBtn) closeBtn.addEventListener('click', () => _closeIfAllowed());
  }

  /** 檢查單個選項是否對當前玩家可見（條件都符合才顯示） */
  function _choiceVisible(choice, player) {
    const p = player;
    const traits   = p.traits || [];
    const ailments = p.ailments || [];
    const c = choice;

    if (c.requireTrait && !traits.includes(c.requireTrait)) return false;
    if (c.requireNoTrait && traits.includes(c.requireNoTrait)) return false;
    if (c.requireAnyTrait) {
      if (!c.requireAnyTrait.some(t => traits.includes(t))) return false;
    }
    if (c.requireAnyAilment) {
      if (!c.requireAnyAilment.some(a => ailments.includes(a))) return false;
    }
    if (c.requireOrigin && p.origin !== c.requireOrigin) return false;
    if (c.requireOriginNot && p.origin === c.requireOriginNot) return false;
    if (c.requireMinAttr) {
      for (const [attr, min] of Object.entries(c.requireMinAttr)) {
        const v = (typeof Stats !== 'undefined' && Stats.eff) ? Stats.eff(attr) : (p[attr] || 0);
        if (v < min) return false;
      }
    }
    if (c.requireFlag && typeof Flags !== 'undefined' && !Flags.has(c.requireFlag)) return false;
    if (c.requireAffection && typeof teammates !== 'undefined') {
      for (const [npcId, min] of Object.entries(c.requireAffection)) {
        if (teammates.getAffection(npcId) < min) return false;
      }
    }
    return true;
  }

  /** 加權隨機從 rolls 陣列選一個 */
  function _rollWeighted(rolls) {
    const total = rolls.reduce((s, r) => s + (r.weight || 1), 0);
    let n = Math.random() * total;
    for (const r of rolls) {
      n -= (r.weight || 1);
      if (n <= 0) return r;
    }
    return rolls[rolls.length - 1];
  }

  /**
   * 主 API：顯示選擇 modal。
   * @param {Object} eventData — 事件資料（見檔頭註解）
   * @param {Object} [opts]
   *   - onChoose(choiceId, resolvedOutcome) 選完後回呼
   */
  function show(eventData, opts = {}) {
    _ensureElements();
    if (!eventData || !Array.isArray(eventData.choices)) {
      console.warn('[ChoiceModal] invalid eventData', eventData);
      return;
    }

    _activeEvent = eventData;
    const player = (typeof Stats !== 'undefined') ? Stats.player : null;
    if (!player) return;

    // 過濾可見選項
    _activeChoices = eventData.choices.filter(c => _choiceVisible(c, player));

    if (_activeChoices.length === 0) {
      console.warn('[ChoiceModal] 所有選項都被過濾掉了', eventData.id);
      return;
    }

    // 填入 header / body
    const iconEl  = document.getElementById('choice-icon');
    const titleEl = document.getElementById('choice-title');
    const bodyEl  = document.getElementById('choice-body');
    if (iconEl)  iconEl.textContent = eventData.icon  || '';
    if (titleEl) titleEl.textContent = eventData.title || '';
    if (bodyEl)  bodyEl.innerHTML = (eventData.body || '').replace(/\n/g, '<br>');

    // 渲染選項按鈕
    const optionsEl = document.getElementById('choice-options');
    if (optionsEl) {
      optionsEl.innerHTML = _activeChoices.map((c, idx) => `
        <button class="choice-option" data-idx="${idx}">
          <div class="choice-option-label">${c.label || '—'}</div>
          ${c.hint ? `<div class="choice-option-hint">${c.hint}</div>` : ''}
        </button>
      `).join('');
      optionsEl.querySelectorAll('.choice-option').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          _handleChoice(idx, opts.onChoose);
        });
      });
    }

    // forced 模式：隱藏關閉鈕，背景點擊不關
    const closeBtn = document.getElementById('choice-close');
    if (closeBtn) closeBtn.style.display = eventData.forced ? 'none' : '';

    // 顯示 modal
    const modal = document.getElementById('modal-choice');
    if (modal) modal.classList.add('open');
  }

  function _handleChoice(idx, onChoose) {
    const choice = _activeChoices[idx];
    if (!choice) return;

    // 決定結果：rolls 優先，否則用 choice 本身的 effects/resultLog
    let resolved = choice;
    if (Array.isArray(choice.rolls) && choice.rolls.length > 0) {
      resolved = _rollWeighted(choice.rolls);
    }

    // 套效果
    if (Array.isArray(resolved.effects) && typeof Effects !== 'undefined') {
      Effects.apply(resolved.effects, { source: 'choice:' + (_activeEvent.id || '') + ':' + (choice.id || '') });
    }

    // 寫 log
    const logText  = resolved.log || resolved.resultLog || choice.resultLog;
    const logColor = resolved.logColor || choice.logColor || _activeEvent.logColor || '#e8d070';
    if (logText) {
      if (typeof Game !== 'undefined' && Game.addLog) {
        Game.addLog(logText, logColor, true, true);
      } else if (typeof addLog === 'function') {
        // fallback（main.js 內部）
        addLog(logText, logColor, true, true);
      }
    }

    // 設 flag
    if (choice.flagSet && typeof Flags !== 'undefined') {
      Flags.set(choice.flagSet, true);
    }

    // 關閉 modal
    _close();

    // 回呼
    if (typeof onChoose === 'function') {
      try { onChoose(choice.id, resolved); } catch (e) { console.error('[ChoiceModal] onChoose error', e); }
    }

    // 重新渲染遊戲 UI
    if (typeof Game !== 'undefined' && Game.renderAll) {
      Game.renderAll();
    }
  }

  function _closeIfAllowed() {
    if (_activeEvent && _activeEvent.forced) return;
    _close();
  }

  function _close() {
    const modal = document.getElementById('modal-choice');
    if (modal) modal.classList.remove('open');
    _activeEvent  = null;
    _activeChoices = [];
  }

  return {
    show,
  };
})();
