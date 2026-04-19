/**
 * character_roll.js — 角色生成擲骰畫面（2026-04-19）
 *
 * 流程：
 *   confirmOrigin()
 *     → Stats.applyOrigin(originId)（加初始特性 + 好感 + 起手書）
 *     → CharacterRoll.start(originId, onComplete)
 *       → 首次擲骰（屬性 + 出生特性）顯示
 *       → 玩家可重擲 2 次 / 接受
 *       → 接受後套用 applyRoll
 *       → 播放被抓受傷敘事
 *       → onComplete()
 *
 * 對應設計：docs/systems/traits.md § 出生特性軸組
 */
const CharacterRoll = (() => {

  let _originId = null;
  let _onComplete = null;
  let _rerollsLeft = 2;
  let _currentRoll = null;   // { stats, traits }

  /**
   * 啟動擲骰流程。
   */
  function start(originId, onComplete) {
    _originId = originId;
    _onComplete = onComplete;
    _rerollsLeft = 2;
    _rollOnce();
    _show();
  }

  function _rollOnce() {
    const o = (typeof Origins !== 'undefined') ? Origins[_originId] : null;
    const statMod = o?.statMod || {};
    _currentRoll = {
      stats:  BirthTraits.rollStats(statMod),
      traits: BirthTraits.rollAll(),
    };
  }

  function _show() {
    const overlay = document.getElementById('modal-char-roll');
    if (!overlay) {
      _buildModal();
      return _show();
    }
    overlay.classList.add('open');
    _renderContent();
  }

  function _hide() {
    const overlay = document.getElementById('modal-char-roll');
    if (overlay) overlay.classList.remove('open');
  }

  function _buildModal() {
    // 動態建立 modal（如果 HTML 沒放）
    const html = `
      <div class="modal-overlay" id="modal-char-roll">
        <div class="modal-box char-roll-box">
          <div class="modal-header">
            <span class="modal-title">命運之骰</span>
          </div>
          <div class="modal-body" id="char-roll-body">
          </div>
          <div class="modal-footer">
            <button class="game-btn" id="btn-char-roll-reroll">重擲</button>
            <button class="game-btn primary" id="btn-char-roll-accept">接受命運</button>
          </div>
        </div>
      </div>
    `;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstElementChild);

    // 綁定按鈕
    document.getElementById('btn-char-roll-reroll').addEventListener('click', _onReroll);
    document.getElementById('btn-char-roll-accept').addEventListener('click', _onAccept);
  }

  function _renderContent() {
    const body = document.getElementById('char-roll-body');
    if (!body || !_currentRoll) return;

    let html = '';
    html += `<p class="char-roll-intro">這是你被擲給這個世界的樣子。</p>`;

    // 屬性區塊
    html += `<div class="char-roll-section">`;
    html += `<div class="char-roll-sec-title">六維</div>`;
    html += `<div class="char-roll-stats">`;
    const stats = _currentRoll.stats;
    Object.entries(stats).forEach(([attr, val]) => {
      html += `<div class="char-roll-stat"><div class="crs-key">${attr}</div><div class="crs-val">${val}</div></div>`;
    });
    html += `</div></div>`;

    // 出生特性區塊
    html += `<div class="char-roll-section">`;
    html += `<div class="char-roll-sec-title">出生特性</div>`;
    if (_currentRoll.traits.length === 0) {
      html += `<div class="char-roll-none">普通人。沒有天賦，也沒有詛咒。</div>`;
    } else {
      _currentRoll.traits.forEach(tid => {
        const name = BirthTraits.nameOf(tid);
        const desc = BirthTraits.descOf(tid);
        const cat  = BirthTraits.categoryOf(tid);
        const cls  = cat === 'negative' ? 'negative' : 'positive';
        html += `<div class="char-roll-trait ${cls}">`;
        html += `  <div class="crt-name">${name}</div>`;
        html += `  <div class="crt-desc">${desc}</div>`;
        html += `</div>`;
      });
    }
    html += `</div>`;

    // 重擲提示
    html += `<div class="char-roll-reroll-info">還可重擲 <strong>${_rerollsLeft}</strong> 次</div>`;

    body.innerHTML = html;

    // 更新重擲按鈕狀態
    const rerollBtn = document.getElementById('btn-char-roll-reroll');
    if (rerollBtn) {
      rerollBtn.disabled = (_rerollsLeft <= 0);
      rerollBtn.textContent = _rerollsLeft > 0 ? `重擲（還剩 ${_rerollsLeft} 次）` : '不能再擲了';
    }
  }

  function _onReroll() {
    if (_rerollsLeft <= 0) return;
    _rerollsLeft--;
    _rollOnce();
    _renderContent();
  }

  function _onAccept() {
    _hide();
    // 套用擲骰結果
    if (_currentRoll) {
      BirthTraits.applyRoll(_currentRoll.stats, _currentRoll.traits);
    }
    // 播放被抓受傷敘事
    _playCaptureInjury(() => {
      if (typeof _onComplete === 'function') _onComplete();
    });
  }

  /**
   * 被抓受傷敘事（新版：15% 擲傷 → 若受傷則紅光震動 + 回憶）。
   */
  function _playCaptureInjury(onDone) {
    const injury = BirthTraits.applyCaptureInjury(_originId);

    if (!injury.injured) {
      // 沒受傷，輕描淡寫帶過
      const lines = [
        { text: '（被抓來這裡的路不是好走的。）' },
        { text: '（繩索磨破了皮。饑餓啃著你的胃。）' },
        { text: '（你舔了舔嘴唇，告訴自己：還活著。）' },
      ];
      if (typeof DialogueModal !== 'undefined') {
        DialogueModal.play(lines, {
          onComplete: () => {
            if (typeof addLog === 'function') {
              addLog(`（❤️-${injury.hpLoss} · 🍖-${injury.foodLoss} · 💭-${injury.moodLoss}）`, '#887766', false, false);
            }
            if (typeof onDone === 'function') onDone();
          }
        });
      } else {
        if (typeof onDone === 'function') onDone();
      }
      return;
    }

    // 受傷了 — 震動紅光 + 回憶
    const partNames = { head:'頭部', torso:'軀幹', arms:'手臂', legs:'腿部' };
    const sevNames = { 1:'輕傷', 2:'中傷', 3:'重傷' };
    const partName = partNames[injury.part] || '身體';
    const sevName = sevNames[injury.severity] || '傷';

    // 先閃紅光 + 震動
    _flashRedAndShake();

    const lines = [
      { text: '（被抓來這裡的路不是好走的。）' },
      { text: '（你站起來 — ⋯⋯！）' },
      { text: '（劇痛。你差點倒下。）' },
      { text: '（⋯⋯馬的。想起來了。）' },
      { text: `（${injury.memoryLine}）` },
    ];

    // 嚴重傷多一句
    if (injury.severity >= 2) {
      lines.push({ text: `（這${partName}${sevName}⋯⋯沒幾天不會好。）` });
    }
    if (injury.severity === 3) {
      lines.push({ text: `（也許⋯⋯永遠都好不了了。）` });
    }

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => {
          // 日誌摘要
          if (typeof addLog === 'function') {
            addLog(`💥 ${partName}${sevName}（❤️-${injury.hpLoss} · 🍖-${injury.foodLoss} · 💭-${injury.moodLoss}）`, '#cc3333', true, true);
          }
          if (typeof onDone === 'function') onDone();
        }
      });
    } else {
      if (typeof onDone === 'function') onDone();
    }
  }

  function _flashRedAndShake() {
    const root = document.getElementById('game-root') || document.body;
    if (root) {
      root.classList.add('bt-flash-red');
      root.classList.add('bt-shake');
      setTimeout(() => {
        root.classList.remove('bt-flash-red');
        root.classList.remove('bt-shake');
      }, 700);
    }
  }

  return {
    start,
  };
})();
