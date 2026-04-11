/**
 * battle.js — Battle interface (shell)
 * 戰鬥邏輯留待後續定義，本版本建立 UI 框架。
 *
 * 使用: Battle.start(enemyId, onWin, onLose)
 */
const Battle = (() => {

  let _styleInjected = false;
  function _injectStyle() {
    if (_styleInjected) return;
    _styleInjected = true;
    const s = document.createElement('style');
    s.textContent = `
      #battle-overlay {
        position: fixed; inset: 0; z-index: 5000;
        background: rgba(0,0,0,.92);
        display: flex; flex-direction: column;
        font-family: 'Noto Serif TC', Georgia, serif;
        color: #c8b898;
        opacity: 0; transition: opacity .5s ease;
      }
      #battle-overlay.b-visible { opacity: 1; }

      #battle-header {
        display: flex; align-items: center; justify-content: center;
        padding: 14px;
        border-bottom: 1px solid #3a2a18;
        background: #0f0c09;
        font-size: 18px; font-weight: 700;
        letter-spacing: .2em; color: #d4af37;
      }

      #battle-combatants {
        display: flex; align-items: stretch;
        gap: 0; border-bottom: 1px solid #3a2a18;
        flex-shrink: 0;
      }

      .b-fighter {
        flex: 1; padding: 20px 24px;
        display: flex; flex-direction: column; gap: 8px;
      }
      .b-fighter.b-player { border-right: 1px solid #3a2a18; }
      .b-fighter-name {
        font-size: 18px; font-weight: 700;
        letter-spacing: .1em; color: #e8d8b0;
        margin-bottom: 4px;
      }
      .b-fighter-title { font-size: 12px; color: #6a5a48; letter-spacing: .1em; margin-bottom:8px; }

      .b-hp-bar-wrap { display:flex; align-items:center; gap:8px; }
      .b-hp-label { font-size:12px; color:#6a5a48; width:20px; }
      .b-hp-track {
        flex:1; height:12px; background:#0a0806;
        border:1px solid #3a2a18; border-radius:2px; overflow:hidden;
      }
      .b-hp-fill { height:100%; transition:width .4s ease; }
      .b-hp-fill.player-fill { background:#cc2200; }
      .b-hp-fill.enemy-fill  { background:#8b0000; }
      .b-hp-num { font-size:12px; color:#6a5a48; width:52px; text-align:right; }

      .b-stat-row { display:flex; flex-wrap:wrap; gap:6px 14px; margin-top:4px; }
      .b-stat { font-size:12px; color:#6a5a48; }
      .b-stat span { color:#c8a060; font-weight:700; }

      /* ── Battle log ── */
      #battle-log {
        flex: 1; overflow-y: auto;
        padding: 14px 20px;
        font-size: 14px; line-height: 1.9;
        scrollbar-width: thin;
        scrollbar-color: #3a2a18 transparent;
        background: #0a0806;
      }
      .b-log-line { margin-bottom: 3px; }
      .b-log-line.b-hit   { color: #e87060; }
      .b-log-line.b-miss  { color: #6a5a48; }
      .b-log-line.b-sys   { color: #d4af37; font-style:italic; }
      .b-log-line.b-crit  { color: #ffb700; font-weight:700; }

      /* ── Action bar ── */
      #battle-actions {
        display: flex; gap: 0;
        border-top: 1px solid #3a2a18;
        flex-shrink: 0;
      }
      .b-action-btn {
        flex: 1; padding: 16px 8px;
        background: #0f0c09;
        border: none; border-right: 1px solid #3a2a18;
        color: #c8b898;
        font-family: inherit; font-size: 16px;
        letter-spacing: .12em; cursor: pointer;
        transition: background .2s, color .2s;
        display: flex; flex-direction: column;
        align-items: center; gap: 4px;
      }
      .b-action-btn:last-child { border-right: none; }
      .b-action-btn:hover:not(:disabled) { background: #1a1410; color: #e8d8b0; }
      .b-action-btn:disabled { opacity: .35; cursor: not-allowed; }
      .b-action-btn .b-action-icon { font-size: 22px; }
      .b-action-btn .b-action-label { font-size: 13px; letter-spacing:.1em; }
      .b-action-btn .b-action-cost { font-size: 11px; color:#6a5a48; }

      /* ── Coming soon notice ── */
      #battle-placeholder {
        position:absolute; inset:0;
        background:rgba(0,0,0,.7);
        display:flex; flex-direction:column;
        align-items:center; justify-content:center;
        gap:12px; pointer-events:none;
      }
      #battle-placeholder .bp-title {
        font-size:20px; font-weight:700;
        color:#d4af37; letter-spacing:.2em;
      }
      #battle-placeholder .bp-sub {
        font-size:13px; color:#6a5a48; letter-spacing:.15em;
      }
    `;
    document.head.appendChild(s);
  }

  // ── State ──────────────────────────────────────────
  let _state = null;
  let _onWin  = null;
  let _onLose = null;

  // ── Build UI ───────────────────────────────────────
  function _buildUI(player, enemy) {
    document.getElementById('battle-overlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'battle-overlay';
    ov.style.position = 'fixed';
    document.body.appendChild(ov);
    requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('b-visible')));

    // Header
    const hdr = document.createElement('div');
    hdr.id = 'battle-header';
    hdr.textContent = '— 戰　鬥 —';
    ov.appendChild(hdr);

    // Combatants
    const comb = document.createElement('div');
    comb.id = 'battle-combatants';
    ov.appendChild(comb);

    // Player side
    const pSide = _buildFighter(player, 'player');
    comb.appendChild(pSide);

    // VS
    const vs = document.createElement('div');
    vs.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:0 16px;color:#3a2a18;font-size:22px;font-weight:900;flex-shrink:0;';
    vs.textContent = 'VS';
    comb.appendChild(vs);

    // Enemy side
    const eSide = _buildFighter(enemy, 'enemy');
    comb.appendChild(eSide);

    // Log
    const log = document.createElement('div');
    log.id = 'battle-log';
    ov.appendChild(log);

    // Actions
    const actions = document.createElement('div');
    actions.id = 'battle-actions';
    ov.appendChild(actions);

    const btnDefs = [
      { icon: '⚔', label: '攻擊', cost: '體力 -10', id: 'btn-attack' },
      { icon: '🛡', label: '防禦', cost: '體力 -5',  id: 'btn-defend' },
      { icon: '✦', label: '技能', cost: '條件解鎖', id: 'btn-skill',  disabled: true },
      { icon: '💨', label: '逃跑', cost: '名聲 -5',  id: 'btn-flee'  },
    ];
    btnDefs.forEach(def => {
      const btn = document.createElement('button');
      btn.className = 'b-action-btn';
      btn.id = def.id;
      if (def.disabled) btn.disabled = true;
      btn.innerHTML = `
        <span class="b-action-icon">${def.icon}</span>
        <span class="b-action-label">${def.label}</span>
        <span class="b-action-cost">${def.cost}</span>
      `;
      btn.addEventListener('click', () => _onAction(def.id));
      actions.appendChild(btn);
    });

    // Placeholder notice (remove when combat is implemented)
    const ph = document.createElement('div');
    ph.id = 'battle-placeholder';
    ph.innerHTML = `
      <div class="bp-title">⚔ 戰鬥系統建構中</div>
      <div class="bp-sub">介面已就緒 · 戰鬥邏輯待實裝</div>
    `;
    ov.appendChild(ph);

    return { ov, log };
  }

  function _buildFighter(data, side) {
    const div = document.createElement('div');
    div.className = 'b-fighter b-' + side;
    div.id = 'b-fighter-' + side;
    const hpPct = Math.round((data.hp / data.hpMax) * 100);
    div.innerHTML = `
      <div class="b-fighter-name">${data.name}</div>
      <div class="b-fighter-title">${data.title || ''}</div>
      <div class="b-hp-bar-wrap">
        <span class="b-hp-label">HP</span>
        <div class="b-hp-track"><div class="b-hp-fill ${side}-fill" id="b-hp-fill-${side}" style="width:${hpPct}%"></div></div>
        <span class="b-hp-num" id="b-hp-num-${side}">${data.hp}/${data.hpMax}</span>
      </div>
      <div class="b-stat-row">
        <span class="b-stat">ATK <span>${data.ATK}</span></span>
        <span class="b-stat">DEF <span>${data.DEF}</span></span>
        <span class="b-stat">ACC <span>${data.ACC}%</span></span>
        <span class="b-stat">SPD <span>${data.SPD}</span></span>
        <span class="b-stat">EVA <span>${data.EVA}</span></span>
      </div>
    `;
    return div;
  }

  function _log(logEl, text, cls = '') {
    const line = document.createElement('div');
    line.className = 'b-log-line' + (cls ? ' ' + cls : '');
    line.innerHTML = text;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // ── Action handler (placeholder) ──────────────────
  function _onAction(actionId) {
    const logEl = document.getElementById('battle-log');
    if (!logEl || !_state) return;
    _log(logEl, `[ ${actionId} 功能待實裝 ]`, 'b-sys');
  }

  // ── Public: start ──────────────────────────────────
  /**
   * @param {string}   enemyId  - key from Enemies object
   * @param {Function} onWin    - callback when player wins
   * @param {Function} onLose   - callback when player loses
   */
  function start(enemyId, onWin, onLose) {
    _injectStyle();
    _onWin  = onWin  || (() => {});
    _onLose = onLose || (() => {});

    // Build player combat data from Stats
    const p = (typeof Stats !== 'undefined') ? Stats.player : { name:'玩家', hp:100, hpMax:100 };
    const d = (typeof Stats !== 'undefined') ? Stats.calcDerived() : { ATK:10, DEF:10, ACC:60, SPD:20, EVA:10 };
    const playerCombat = {
      name:  p.name,
      title: '角鬥士',
      hp: p.hp, hpMax: p.hpMax,
      ATK: d.ATK, DEF: d.DEF, ACC: d.ACC, SPD: d.SPD, EVA: d.EVA,
    };

    // Enemy data
    const enemyDef = (typeof Enemies !== 'undefined') ? Enemies[enemyId] : null;
    const enemyCombat = enemyDef ? {
      name: enemyDef.name, title: enemyDef.desc || '',
      hp: enemyDef.hp, hpMax: enemyDef.hp,
      ATK: enemyDef.ATK, DEF: enemyDef.DEF,
      ACC: enemyDef.ACC, SPD: enemyDef.SPD, EVA: enemyDef.EVA,
    } : {
      name: '未知對手', title: '', hp: 80, hpMax: 80,
      ATK: 15, DEF: 10, ACC: 60, SPD: 20, EVA: 10,
    };

    _state = { player: playerCombat, enemy: enemyCombat, turn: 0 };

    const { ov, log } = _buildUI(playerCombat, enemyCombat);

    // Intro log
    _log(log, `對手：<strong>${enemyCombat.name}</strong>`, 'b-sys');
    if (enemyDef) _log(log, enemyDef.desc || '', 'b-sys');
    _log(log, '──────────────', 'b-miss');
    _log(log, '⚔ 戰鬥開始！', 'b-sys');
    _log(log, '（戰鬥邏輯尚未實裝，點按鈕後回報結果）', 'b-miss');

    // Close button (temp)
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'position:absolute;top:10px;right:14px;background:none;border:1px solid #3a2a18;color:#6a5a48;font-family:inherit;font-size:12px;padding:4px 10px;cursor:pointer;letter-spacing:.1em;z-index:1;';
    closeBtn.textContent = '離開戰鬥';
    closeBtn.onclick = close;
    ov.appendChild(closeBtn);
  }

  function close() {
    const ov = document.getElementById('battle-overlay');
    if (!ov) return;
    ov.style.opacity = 0;
    setTimeout(() => ov.remove(), 500);
    _state = null;
  }

  return { start, close };
})();
