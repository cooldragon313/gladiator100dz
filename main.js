/**
 * main.js — Core game engine
 * Depends on: stats.js, fields.js, npc.js, events.js, actions.js
 */
const Game = (() => {
  // ── Session state（同步至 GameState 模組）─────────────
  // 這些 local 變數是 main.js 內部快取，每個 mutation 都會同步到 GameState。
  // 外部模組請透過 GameState.getXxx() 存取，不要直接讀這裡。
  let currentFieldId = GameState.getFieldId();          // D.1.12: synced with GameState
  let currentNPCs    = GameState.getCurrentNPCs();
  const logHistory   = [];
  const MAX_LOG      = 80;

  // ── Time-slot constants ───────────────────────────────
  const SLOT_START = 360;   // 06:00 in minutes
  const SLOT_END   = 1320;  // 22:00 in minutes
  const SLOT_DUR   = 120;   // 2 hours per slot
  const SLOT_COUNT = 8;     // 06→22 = 8 × 2h

  // ── Daily NPC state ───────────────────────────────────
  // Pre-rolled at day start: { fieldId: { teammates:[], audience:[] } }
  // 同樣同步到 GameState（見 rollDailyNPCs）
  let dailyNPCMap     = {};
  let _lastNPCRollDay = -1;

  // ── 內部：同步 local state 到 GameState ───────────────
  function _syncField(id) {
    currentFieldId = id;
    GameState.setFieldId(id);
  }
  function _syncCurrentNPCs(data) {
    currentNPCs = data;
    GameState.setCurrentNPCs(data);
  }
  function _syncDailyMap(fieldId, data) {
    dailyNPCMap[fieldId] = data;
    GameState.setDailyNPCs(fieldId, data);
  }
  function _resetDailyMap() {
    dailyNPCMap = {};
    GameState.clearDailyNPCs();
  }
  function _syncLastRollDay(day) {
    _lastNPCRollDay = day;
    GameState.setLastNPCRollDay(day);
  }

  // ── Settings (D.1.7: 擴展為完整結構化設定) ──────────
  const SETTINGS_KEY = 'bairi_settings';

  /** 預設設定（所有類別 + 預設值） */
  function _defaultSettings() {
    return {
      audio: {
        master: 1.0,     // 0~1
        sfx:    1.0,     // 0~1
        bgm:    0.7,     // 0~1
        muted:  false,
      },
      display: {
        fontSize:      'medium',    // 'small' | 'medium' | 'large'
        textSpeed:     'normal',    // 'slow' | 'normal' | 'fast' | 'instant'
        reducedMotion: false,
      },
      gameplay: {
        battleSpeed:       1,        // 1 | 2 | 4 （倍率）
        showDamageNumbers: true,
        autoSave:          'action', // 'never' | 'action' | 'day'
        tutorialEnabled:   true,
      },
      accessibility: {
        colorblind:   false,
        highContrast: false,
      },
    };
  }

  let settings = _defaultSettings();

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // Deep merge：未知欄位用預設值補齊
        const def = _defaultSettings();
        settings = {
          audio:         { ...def.audio,         ...(saved.audio || {}) },
          display:       { ...def.display,       ...(saved.display || {}) },
          gameplay:      { ...def.gameplay,      ...(saved.gameplay || {}) },
          accessibility: { ...def.accessibility, ...(saved.accessibility || {}) },
        };
      }
    } catch (e) {
      console.warn('[Settings] load failed, using defaults:', e);
      settings = _defaultSettings();
    }

    // 向下相容：讀取舊的 sfx / music localStorage key
    const legacySfx   = localStorage.getItem('sfx');
    const legacyMusic = localStorage.getItem('music');
    if (legacySfx !== null)   settings.audio.sfx = parseInt(legacySfx) / 2;   // 0/1/2 → 0/0.5/1
    if (legacyMusic !== null) settings.audio.bgm = parseInt(legacyMusic) / 2;

    _applySettings();
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('[Settings] save failed:', e);
    }
    _applySettings();
  }

  /** 套用設定到對應的模組（SoundManager / CSS 變數等） */
  function _applySettings() {
    // 音量 → SoundManager
    if (typeof SoundManager !== 'undefined') {
      SoundManager.setMasterVol(settings.audio.master);
      SoundManager.setSfxVol(settings.audio.sfx);
      SoundManager.setBgmVol(settings.audio.bgm);
      SoundManager.mute(settings.audio.muted);
    }
    // 字體大小 → CSS variable
    const scaleMap = { small: 0.85, medium: 1.0, large: 1.2 };
    document.documentElement.style.setProperty(
      '--font-scale',
      scaleMap[settings.display.fontSize] || 1.0
    );
    // 動畫減少 → body class
    document.body?.classList.toggle('reduced-motion', settings.display.reducedMotion);
    // 色盲模式 → body class
    document.body?.classList.toggle('colorblind-mode', settings.accessibility.colorblind);
    document.body?.classList.toggle('high-contrast', settings.accessibility.highContrast);
  }

  loadSettings();

  // ── Log ───────────────────────────────────────────────
  function addLog(text, color = '#e0e0e0', italic = true) {
    logHistory.unshift({ text, color, italic });
    if (logHistory.length > MAX_LOG) logHistory.pop();
    renderLog();
  }

  function renderLog() {
    const el = document.getElementById('log-content');
    if (!el) return;
    el.innerHTML = logHistory.map(entry => {
      const style = `color:${entry.color};${entry.italic ? 'font-style:italic;' : ''}`;
      return `<p style="${style}">${entry.text.replace(/\n/g, '<br>')}</p>`;
    }).join('');
    // Always scroll to top so newest entry (unshifted to front) is visible
    el.scrollTop = 0;
  }

  // ── Time display ──────────────────────────────────────
  function renderTimeBar() {
    const p   = Stats.player;
    const pct = (p.time / 1440) * 100;
    const fill     = document.getElementById('time-bar-fill');
    const label    = document.getElementById('time-label');
    const dayEl    = document.getElementById('day-counter');
    const celestial= document.getElementById('time-celestial');

    if (fill)  fill.style.width = pct + '%';
    if (label) label.textContent = '第 ' + p.day + ' 天　' + Stats.getTimeStr();
    if (dayEl) dayEl.textContent = (100 - p.day + 1) + ' 天後 · 萬骸祭';

    // Sun / Moon
    if (celestial) {
      celestial.style.left = pct + '%';
      const hour = Math.floor(p.time / 60) % 24;
      const isSun = hour >= 8 && hour < 18;
      celestial.className = isSun ? 'sun' : 'moon';
    }
  }

  // ── 百日條 ────────────────────────────────────────────
  const DAY_W = 14; // px per day

  function _buildDayBar() {
    const inner = document.getElementById('hdb-inner');
    if (!inner) return;
    const totalW = 100 * DAY_W;
    inner.style.width = totalW + 'px';

    // Ticks
    for (let d = 1; d <= 100; d++) {
      const x = (d - 1) * DAY_W + DAY_W / 2;
      const tick = document.createElement('div');
      tick.className = 'hdb-tick' + (d % 5 === 0 ? ' hdb-tick-5' : '');
      tick.style.left = x + 'px';
      inner.appendChild(tick);
    }

    // 🆕 D.1.10: Event markers（從陣列取代舊的 object lookup）
    const markers = Events.getTimelineMarkers();
    markers.forEach(m => {
      const x = (m.day - 1) * DAY_W + DAY_W / 2;
      const marker = document.createElement('div');
      marker.className = 'hdb-event';
      marker.style.left = x + 'px';
      marker.title = `第 ${m.day} 天：${m.name}`;
      marker.innerHTML = `
        <span class="hdb-event-icon" style="color:${m.iconColor}">${m.icon}</span>
        <span class="hdb-event-name">${m.name}</span>
      `;
      inner.appendChild(marker);
    });
  }

  function renderDayBar() {
    const p     = Stats.player;
    const inner = document.getElementById('hdb-inner');
    const view  = document.getElementById('hdb-view');
    const past  = document.getElementById('hdb-past-fill');
    const todayIcon = document.getElementById('hdb-today-icon');
    if (!inner || !view) return;

    const viewW  = view.offsetWidth || 600;
    const todayX = (p.day - 1) * DAY_W + DAY_W / 2;
    const offset = viewW / 2 - todayX;

    inner.style.transform = `translateX(${offset}px)`;

    // Past fill width = from day 1 to today
    if (past) past.style.width = todayX + 'px';

    // Today icon — changes if today is a timeline event
    // 🆕 D.1.10: 用條件化查詢
    const tlEv = Events.getTimelineEvent(p.day);
    if (todayIcon) {
      todayIcon.textContent = tlEv ? tlEv.icon : '◆';
      todayIcon.style.color = tlEv ? tlEv.iconColor : 'var(--blood-lt)';
      todayIcon.style.filter = `drop-shadow(0 0 5px ${tlEv ? tlEv.iconColor : 'var(--blood-lt)'})`;
    }
  }

  // ── Timeline event trigger (called when day changes) ──
  let _lastTriggeredDay = 0;

  function checkTimelineEvent() {
    const p   = Stats.player;
    // 🆕 D.1.10: 使用條件化查詢
    const ev  = Events.getTimelineEvent(p.day);
    if (!ev || _lastTriggeredDay === p.day) return;
    _lastTriggeredDay = p.day;

    // Announcement
    addLog(`\n【第 ${p.day} 天 · ${ev.name}】\n${ev.logText}`, '#e8c870', true);
    showToast(`第 ${p.day} 天 ── ${ev.name}`, 5000);

    // Force scene + NPCs
    if (ev.forced) {
      _syncField(ev.forcedField);
      _syncCurrentNPCs(ev.forcedNPCs);
      renderAll();

      // Show battle trigger button inside scene area
      _showTimelineBattleBtn(ev);
    }
  }

  function _showTimelineBattleBtn(ev) {
    // Remove old if exists
    document.getElementById('timeline-battle-btn')?.remove();
    const npcArea = document.getElementById('npc-area');
    if (!npcArea) return;

    const btn = document.createElement('button');
    btn.id = 'timeline-battle-btn';
    btn.style.cssText = `
      margin-top:16px;
      padding:12px 40px;
      background:#1a0000;
      border:1px solid var(--blood-lt);
      color:#e87060;
      font-family:var(--font);
      font-size:22px;
      letter-spacing:.2em;
      cursor:pointer;
      transition:background .2s;
      box-shadow:0 0 16px rgba(192,57,43,.3);
    `;
    btn.textContent = ev.actionLabel || '進入戰鬥';
    btn.onmouseover = () => btn.style.background = '#2a0000';
    btn.onmouseout  = () => btn.style.background = '#1a0000';
    btn.onclick = () => {
      btn.remove();
      Battle.start(
        ev.opponent,
        () => { /* onWin: handle survival */ addLog('你贏得了這場戰鬥！', '#d4af37'); },
        () => { /* onLose: trigger death ending */ Endings.deathEnding(Stats.player.name); }
      );
    };
    npcArea.appendChild(btn);
  }

  // ── Scene info bar ────────────────────────────────────
  function renderSceneInfoBar() {
    const f = FIELDS[currentFieldId];
    const nameEl = document.getElementById('scene-name');
    if (nameEl && f) nameEl.textContent = f.name;
    Stats.renderFame();
  }

  // ── Scene view (background + watermark) ───────────────
  function renderSceneView() {
    const view = document.getElementById('scene-view');
    if (!view) return;
    // Remove all bg- classes
    view.className = view.className.replace(/\bbg-\S+/g, '').replace(/\bambient-\S+/g, '').trim();
    const f = FIELDS[currentFieldId];
    if (f) {
      view.classList.add(f.bgClass, f.ambientClass);
      // Watermark text
      const wm = document.getElementById('scene-watermark');
      if (wm) wm.textContent = f.name;
    }
  }

  // ── NPC slots ─────────────────────────────────────────
  function renderNPCSlots() {
    // Teammate slots (6 max)
    for (let i = 0; i < 6; i++) {
      const slot = document.getElementById('tm-slot-' + i);
      if (!slot) continue;
      const npcId = currentNPCs.teammates[i];
      if (npcId) {
        const npc = teammates.getNPC(npcId);
        slot.classList.add('occupied');
        slot.classList.remove('empty');
        slot.innerHTML = `<span class="npc-role-tag">${npc?.title || '隊友'}</span><span class="npc-name">${npc ? npc.name : npcId}</span>`;
        slot.onclick = () => onNPCClick(npcId);
      } else {
        slot.classList.remove('occupied');
        slot.classList.add('empty');
        slot.innerHTML = '<span class="npc-empty-label">—</span>';
        slot.onclick = null;
      }
    }
    // Audience slots (3 max)
    for (let i = 0; i < 3; i++) {
      const slot = document.getElementById('aud-slot-' + i);
      if (!slot) continue;
      const npcId = currentNPCs.audience[i];
      if (npcId) {
        const npc = teammates.getNPC(npcId);
        slot.classList.add('occupied');
        slot.classList.remove('empty');
        slot.innerHTML = `<span class="npc-role-tag aud-tag">${npc?.title || '觀眾'}</span><span class="npc-name">${npc ? npc.name : npcId}</span>`;
        slot.onclick = () => onNPCClick(npcId);
      } else {
        slot.classList.remove('occupied');
        slot.classList.add('empty');
        slot.innerHTML = '<span class="npc-empty-label">—</span>';
        slot.onclick = null;
      }
    }
  }

  // ── Scene buttons (left panel) ────────────────────────
  function renderSceneButtons() {
    const p = Stats.player;
    FIELD_SLOTS.forEach(slot => {
      const btn = document.getElementById('sbtn-' + slot.slot);
      if (!btn) return;
      const accessible = getSlotField(slot.slot, p);
      if (accessible) {
        btn.classList.remove('locked');
        btn.classList.toggle('active', accessible.id === currentFieldId);
        btn.querySelector('.sbtn-name').textContent = accessible.name;
        btn.onclick = () => switchField(accessible.id);
      } else {
        btn.classList.add('locked');
        btn.classList.remove('active');
        btn.querySelector('.sbtn-name').textContent = slot.label;
        btn.onclick = null;
      }
    });
  }

  // ── Daily NPC roll (once per day) ─────────────────────
  function rollDailyNPCs() {
    const p = Stats.player;
    if (_lastNPCRollDay === p.day) return;
    _syncLastRollDay(p.day);
    _resetDailyMap();
    Object.keys(FIELDS).forEach(fid => {
      _syncDailyMap(fid, rollFieldNPCs(fid));
    });
    // Sync currentNPCs for current field
    _syncCurrentNPCs(dailyNPCMap[currentFieldId] || { teammates: [], audience: [] });
  }

  // ── Time-slot helpers ──────────────────────────────────
  function currentSlotIndex() {
    return Math.max(0, Math.floor((Stats.player.time - SLOT_START) / SLOT_DUR));
  }

  function slotsRemaining() {
    return Math.max(0, SLOT_COUNT - currentSlotIndex());
  }

  // ── Render: time slots ─────────────────────────────────
  function renderTimeSlots() {
    const con = document.getElementById('time-slots');
    if (!con) return;
    const idx = currentSlotIndex();
    let html = '';
    for (let i = 0; i < SLOT_COUNT; i++) {
      const h0   = 6 + i * 2;
      const h1   = h0 + 2;
      const label = String(h0).padStart(2,'0') + '-' + String(h1).padStart(2,'0');
      const cls  = i < idx ? 'used' : (i === idx ? 'current' : 'future');
      html += `<div class="slot-box ${cls}"><span class="slot-h">${label}</span><div class="slot-dot"></div></div>`;
    }
    con.innerHTML = html;
  }

  // ── Render: location tabs ──────────────────────────────
  function renderLocationTabs() {
    const p   = Stats.player;
    const con = document.getElementById('location-tabs');
    if (!con) return;
    let html = '';
    FIELD_SLOTS.forEach(slot => {
      const f        = getSlotField(slot.slot, p);
      const isActive = f && f.id === currentFieldId;
      const isLocked = !f;
      const icon     = f ? (FIELDS[f.id]?.icon || slot.label[0]) : slot.label[0];
      const name     = f ? f.name : slot.label;
      html += `<button class="loc-tab${isActive ? ' active' : ''}${isLocked ? ' locked' : ''}"
        ${isLocked ? '' : `onclick="Game.switchField('${f.id}')"`}
        title="${name}">
        <span class="loc-tab-icon">${icon}</span>
        <span class="loc-tab-name">${name.slice(0, 3)}</span>
      </button>`;
    });
    con.innerHTML = html;
  }

  // ── Render: action list ────────────────────────────────
  function renderActionList() {
    const con = document.getElementById('action-list');
    if (!con) return;
    const p       = Stats.player;
    const npcs    = currentNPCs;
    const sLeft   = slotsRemaining();
    const allNPCs = [...(npcs.teammates || []), ...(npcs.audience || [])];

    // Day exhausted → only show sleep button
    if (sLeft <= 0) {
      con.innerHTML = `
        <div class="action-empty">今天的行動格已用盡。</div>
        <button class="action-btn-sleep" onclick="Game.doAction('_sleep')">就寢・迎接新的一天</button>`;
      return;
    }

    let html = '<div class="action-list-header">可用動作</div>';

    // Field-specific actions
    const fieldActs = getFieldActions(currentFieldId, p, npcs);

    // Dynamic NPC-chat actions (one per NPC present)
    const chatActs = allNPCs.map(npcId => {
      const npc = teammates.getNPC(npcId);
      if (!npc) return null;
      return {
        id: 'chat_' + npcId,
        name: `與${npc.name}交談`,
        desc: npc.title,
        slots: 1, staminaCost: 5, foodCost: 0,
        effects: [
          { type: 'affection', key: npcId, delta: 3 },
          { type: 'vital',     key: 'mood', delta: 5 },
        ],
      };
    }).filter(Boolean);

    const allActs = [...fieldActs, ...chatActs, ACTIONS.rest];

    allActs.forEach(act => {
      const noStamina = p.stamina < act.staminaCost;
      const noFood    = (act.foodCost || 0) > 0 && p.food < act.foodCost;
      const noSlots   = act.slots > sLeft;
      const disabled  = noStamina || noFood || noSlots;
      const reason    = noSlots ? '時間不足' : noStamina ? '體力不足' : noFood ? '飽食不足' : '';

      const costs = [`⏱${act.slots * 2}小時`];
      if (act.staminaCost > 0) costs.push(`⚡${act.staminaCost}`);
      if ((act.foodCost || 0) > 0) costs.push(`🍖${act.foodCost}`);

      const costStr  = costs.join(' · ');
      const warnStr  = reason ? ` · <span style="color:#cc4444;font-size:13px;">${reason}</span>` : '';
      const clickStr = disabled ? '' : `onclick="Game.doAction('${act.id}')"`;

      html += `<button class="action-btn" ${disabled ? 'disabled' : clickStr}>
        <div class="action-name">${act.name}</div>
        <div class="action-cost">${costStr}${warnStr}</div>
      </button>`;
    });

    // Sleep button always at bottom
    html += `<button class="action-btn-sleep" onclick="Game.doAction('_sleep')" style="margin-top:8px;">就寢・結束今天</button>`;
    con.innerHTML = html;
  }

  // ── Execute action ─────────────────────────────────────
  function doAction(actionId) {
    const p = Stats.player;

    // Special: end-of-day sleep
    if (actionId === '_sleep') {
      sleepEndDay();
      return;
    }

    // Resolve action definition (including dynamic chat actions)
    let act;
    if (actionId.startsWith('chat_')) {
      const npcId = actionId.slice(5);
      const npc   = teammates.getNPC(npcId);
      act = {
        id: actionId, slots: 1, staminaCost: 5, foodCost: 0,
        name: npc ? `與${npc.name}交談` : '交談',
        effects: [
          { type: 'affection', key: npcId, delta: 3 },
          { type: 'vital',     key: 'mood', delta: 5 },
        ],
      };
    } else {
      act = ACTIONS[actionId];
    }
    if (!act) return;

    // Guard: enough slots
    if (act.slots > slotsRemaining()) {
      showToast('今天沒有足夠的時間了。');
      SoundManager.playSfx('error');  // D.1.13 預留
      return;
    }
    // Guard: stamina
    if (p.stamina < act.staminaCost) {
      showToast('體力不足，無法執行此行動。');
      SoundManager.playSfx('error');  // D.1.13 預留
      return;
    }
    // Guard: food
    if ((act.foodCost || 0) > 0 && p.food < act.foodCost) {
      showToast('飽食度不足，無法執行此行動。');
      SoundManager.playSfx('error');  // D.1.13 預留
      return;
    }

    // D.1.13: 行動確認音效（未來填入實際路徑即可生效）
    SoundManager.playSfx(act.assets?.sfx?.activate || 'action_confirm');

    // Deduct costs
    if (act.staminaCost > 0) Stats.modVital('stamina', -act.staminaCost);
    if ((act.foodCost || 0) > 0) Stats.modVital('food', -act.foodCost);

    // ── Mood multiplier ──────────────────────────────────
    // 心情好（≥70）→ 正向效果 ×1.25；心情差（≤30）→ ×0.75
    function getMoodMult() {
      if (p.mood >= 70) return 1.25;
      if (p.mood <= 30) return 0.75;
      return 1.0;
    }
    const moodMult = getMoodMult();
    const moodDesc = moodMult > 1 ? '（心情佳 ×1.25）' : moodMult < 1 ? '（心情低落 ×0.75）' : '';

    // 🆕 D.1.9: 統一效果處理器
    Effects.apply(act.effects || [], {
      moodMult,
      currentNPCs,
      source: 'action:' + actionId,
    });

    // Advance time by slot(s)
    Stats.advanceTime(act.slots * SLOT_DUR);

    // Log — action header + brief effect summary
    const gainSummary = (act.effects || []).map(eff => {
      if (eff.type === 'attr')      return `${eff.key}${eff.delta > 0 ? '+' : ''}${eff.delta}`;
      if (eff.type === 'vital')     return `${eff.key}${eff.delta > 0 ? '+' : ''}${eff.delta}`;
      if (eff.type === 'affection') return `${eff.key}好感${eff.delta > 0 ? '+' : ''}${eff.delta}`;
      return '';
    }).filter(Boolean).join(' · ');
    addLog(`【${act.name}】${gainSummary ? '　' + gainSummary : ''}${moodDesc ? '　' + moodDesc : ''}`, '#c8a060', false);

    // Flavor text
    if (act.flavorText) addLog(act.flavorText, '#a89070', false);

    // Conditional effects (e.g. affection-gated bonuses)
    (act.conditionalEffects || []).forEach(ce => {
      const cond = ce.condition || {};
      let pass = false;
      if (cond.type === 'affection') {
        const aff = teammates.getAffection(cond.npcId);
        pass = aff >= (cond.min || 0) && aff <= (cond.max ?? Infinity);
      }
      if (!pass) return;
      // 🆕 D.1.9: 統一效果處理器（條件效果不吃心情加成）
      Effects.apply(ce.effects || [], {
        currentNPCs,
        source: 'conditional:' + actionId,
      });
      if (ce.flavorText) addLog(ce.flavorText, '#88b878', false);
    });

    // Post-action events
    _postActionEvents(act);

    saveGame();
    renderAll();
  }

  // ── Post-action events ─────────────────────────────────
  function _postActionEvents(act) {
    // 40% chance: action-specific event
    if (act.eventPool && act.eventPool.length > 0 && Math.random() < 0.40) {
      const evId = act.eventPool[Math.floor(Math.random() * act.eventPool.length)];
      const ev   = Events.getActionEvent(evId);
      if (ev) { _applyEventAndLog(ev); return; }
    }
    // 15% chance: generic field event
    if (Math.random() < 0.15) {
      const ev = Events.rollRandom();
      if (ev) _applyEventAndLog(ev);
    }
  }

  function _applyEventAndLog(ev) {
    if (!ev) return;
    addLog(ev.text, ev.color || '#aaa', true);
    // 🆕 D.1.9: 統一效果處理器（取代 Events.applyEvent + 手動 affection 同步）
    Effects.apply(ev.effects || [], {
      currentNPCs,
      source: 'event:' + (ev.id || 'unknown'),
    });
  }

  // ── Sleep / end day ────────────────────────────────────
  function sleepEndDay() {
    const p = Stats.player;
    if (p.day >= 100) {
      addLog('一百天到了。萬骸祭的鐘聲即將敲響。', '#8b0000', true);
      return;
    }

    // 🆕 D.1.11: Fire "day end" hooks (p.day 仍是舊的)
    DayCycle.fireDayEnd(p.day);

    // Overnight effects
    Stats.modVital('stamina', 40);
    Stats.modVital('mood',    5);
    Stats.modVital('food',  -12);  // overnight hunger

    // Advance to next day
    p.day  = Math.min(100, p.day + 1);
    p.time = SLOT_START;

    addLog(`\n────────────────────\n第 ${p.day} 天　天光未明，新的一天開始了。`, '#b8960c', false);

    // 🆕 D.1.11: Fire "day start" hooks (p.day 是新的)
    DayCycle.fireDayStart(p.day);

    // Roll new day's NPCs
    _syncLastRollDay(-1);
    rollDailyNPCs();

    saveGame();
    renderAll();
    checkTimelineEvent();
  }

  // ── Switch scene ──────────────────────────────────────
  function switchField(fieldId) {
    if (fieldId === currentFieldId) return;
    _syncField(fieldId);
    // Pull from today's NPC roll (no re-rolling on move)
    _syncCurrentNPCs(dailyNPCMap[fieldId] || rollFieldNPCs(fieldId));

    const f = FIELDS[fieldId];
    if (f) addLog(f.logText, '#ddd', true);

    // D.1.13: 切換 BGM（未來 FIELDS.assets.bgm 填入路徑即可生效）
    SoundManager.playSfx('menu_open');
    if (f?.assets?.bgm) SoundManager.playBgm(f.assets.bgm);
    // No time cost for moving — time advances only via actions
    const allNPCs = [...(currentNPCs.teammates || []), ...(currentNPCs.audience || [])];
    //現場所有的NPC都會有機率觸發事件
    renderAll();
  }

  // ══════════════════════════════════════════════════════
  // ARENA
  // ══════════════════════════════════════════════════════

  const ARENA_TIERS = [
    {
      minDay: 10, maxDay: 20,
      label: '初等場・試煉', color: '#8a8060',
      statsMin: 10, statsMax: 20,
      hpMin: 40, hpMax: 60,
      weaponPool: ['dagger', 'fists'],
      armorPool:  ['rags'],
      shieldPool: ['none'],
      fameMin: 3, fameMax: 8,
      titleStr: '試煉者',
    },
    {
      minDay: 20, maxDay: 40,
      label: '中等場・角鬥', color: '#b08040',
      statsMin: 20, statsMax: 25,
      hpMin: 60, hpMax: 80,
      weaponPool: ['shortSword', 'hammer', 'dagger', 'spear'],
      armorPool:  ['leather', 'rags'],
      shieldPool: ['woodShield', 'none'],
      fameMin: 6, fameMax: 14,
      titleStr: '角鬥士',
    },
    {
      minDay: 40, maxDay: 60,
      label: '上等場・血鬥', color: '#c05020',
      statsMin: 25, statsMax: 30,
      hpMin: 80, hpMax: 100,
      weaponPool: ['shortSword', 'spear', 'dagger', 'heavyAxe', 'longSword'],
      armorPool:  ['chainmail', 'leather'],
      shieldPool: ['ironShield', 'woodShield', 'none'],
      fameMin: 10, fameMax: 20,
      titleStr: '老手鬥士',
    },
    {
      minDay: 60, maxDay: 81,
      label: '精英場・死鬥', color: '#d03010',
      statsMin: 30, statsMax: 40,
      hpMin: 100, hpMax: 120,
      weaponPool: ['longSword', 'spear', 'warHammer', 'heavyAxe'],
      armorPool:  ['chainmail', 'ironPlate'],
      shieldPool: ['ironShield', 'none'],
      fameMin: 15, fameMax: 30,
      titleStr: '精英鬥士',
    },
  ];

  const ARENA_NAME_POOLS = [
    ['野豬男', '草包漢', '菜鳥甲', '無名丁', '初陣者', '膽怯兵', '蘆葦腿'],
    ['刀疤漢', '粗枝兵', '鐵拳男', '鈍刃客', '角鬥卒', '咆哮者', '亂刃兵'],
    ['老鴉兵', '戰場犬', '鐵腕客', '斷骨者', '廝殺翁', '血戰士', '硬皮漢'],
    ['暗刃客', '碎石者', '烈焰漢', '鐵血士', '戰狂兒', '屠殺者', '死鬥翁'],
  ];

  function _getArenaTier(day) {
    return ARENA_TIERS.find(t => day >= t.minDay && day < t.maxDay) || null;
  }

  function _arenaRandInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function _arenaPickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function _generateArenaOpponent(day) {
    const tier = _getArenaTier(day);
    if (!tier) return null;
    const tierIdx = ARENA_TIERS.indexOf(tier);
    const name = _arenaPickRandom(ARENA_NAME_POOLS[tierIdx]);
    const s = () => _arenaRandInt(tier.statsMin, tier.statsMax);
    return {
      name,
      title:        tier.titleStr,
      STR: s(), DEX: s(), CON: s(), AGI: s(), WIL: s(), LUK: s(),
      hpBase:       _arenaRandInt(tier.hpMin, tier.hpMax),
      weaponId:     _arenaPickRandom(tier.weaponPool),
      armorId:      _arenaPickRandom(tier.armorPool),
      shieldId:     _arenaPickRandom(tier.shieldPool),
      ai:           'normal',
      fame:         _arenaRandInt(5, 15 * (tierIdx + 1)),
      intimidation: 0,
      fameReward:   _arenaRandInt(tier.fameMin, tier.fameMax),
      tierColor:    tier.color,
      tierLabel:    tier.label,
    };
  }

  function renderArenaSection() {
    const sec = document.getElementById('arena-section');
    if (!sec) return;
    const p = Stats.player;
    const tier = _getArenaTier(p.day);
    const sLeft = slotsRemaining();

    if (!tier) {
      if (p.day < 10) {
        sec.innerHTML = `<div class="arena-locked"><span class="arena-lock-icon">🔒</span><span class="arena-lock-text">第10天開放競技場</span></div>`;
      } else {
        // Day 81+ or outside range
        sec.innerHTML = `<div class="arena-locked"><span class="arena-lock-icon">🔒</span><span class="arena-lock-text">競技場已關閉</span></div>`;
      }
      return;
    }

    const canFight = sLeft >= 1 && p.stamina >= 10;
    const disabledReason = !canFight ? (sLeft < 1 ? '時間不足' : '體力不足') : '';

    sec.innerHTML = `
      <button class="arena-btn${canFight ? '' : ' arena-btn-disabled'}"
        ${canFight ? 'onclick="Game.startArenaBattle()"' : ''}>
        <span class="arena-btn-icon">⚔</span>
        <div class="arena-btn-content">
          <div class="arena-btn-title">參戰競技場</div>
          <div class="arena-btn-tier" style="color:${tier.color}">${tier.label}${disabledReason ? ' · <span style="color:#cc4444;font-size:16px;">' + disabledReason + '</span>' : ''}</div>
        </div>
        <div class="arena-btn-cost">⏱2小時<br>⚡10</div>
      </button>`;
  }

  function startArenaBattle() {
    const p = Stats.player;
    const tier = _getArenaTier(p.day);
    if (!tier) { showToast('目前無法進入競技場。'); return; }
    if (slotsRemaining() < 1) { showToast('今天沒有足夠的時間了。'); return; }
    if (p.stamina < 10) { showToast('體力不足（需要10），無法參戰。'); return; }

    const opp = _generateArenaOpponent(p.day);
    if (!opp) return;

    // Deduct stamina only — time is deducted by _endBattle (same as timeline battles)
    Stats.modVital('stamina', -10);

    addLog(`【競技場】${tier.label}\n對手：${opp.name}（${opp.title}）\nSTR:${opp.STR} DEX:${opp.DEX} CON:${opp.CON} AGI:${opp.AGI} WIL:${opp.WIL} LUK:${opp.LUK}`, tier.color, true);

    Battle.startFromConfig(
      opp,
      () => {
        // onWin — fame already applied in battle.js _endBattle with rating multiplier
        const rating = Battle.getLastRating();
        if (rating === 'S') {
          addLog('主人和長官都注意到了這場完美的勝利。', '#d4af37', false);
        }
        saveGame();
        renderAll();
      },
      () => {
        // onLose
        addLog(`【競技場落敗】你在競技場上倒下了……`, '#8b0000', true);
        if (typeof Endings !== 'undefined' && Endings.deathEnding) {
          Endings.deathEnding(p.name);
        }
      }
    );
  }

  // ── NPC interaction placeholder ───────────────────────
  function onNPCClick(npcId) {
    const npc = teammates.getNPC(npcId);
    if (!npc) return;
    showToast(`【${npc.name}】${npc.desc}`);
  }

  // ── Full render pass ──────────────────────────────────
  function renderAll() {
    renderTimeBar();
    renderDayBar();
    renderSceneInfoBar();
    renderSceneView();
    renderNPCSlots();
    renderTimeSlots();
    renderLocationTabs();
    renderActionList();
    try { renderArenaSection(); } catch(e) { console.error('[Arena] render error:', e); }
    renderLog();
    Stats.renderAll();
    document.getElementById('player-name-display').textContent = Stats.player.name;
    checkTimelineEvent();
  }

  // ── Toast notification ────────────────────────────────
  function showToast(msg, duration = 3500) {
    let toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('visible'), duration);
  }

  // ── Detail modal (full character sheet) ──────────────
  function openDetailModal() {
    const modal = document.getElementById('modal-detail');
    if (!modal) return;
    _fillCharSheet();
    modal.classList.add('open');
  }

  function closeDetailModal() {
    document.getElementById('modal-detail')?.classList.remove('open');
  }

  function _fillCharSheet() {
    const p = Stats.player;
    const d = Stats.calcDerived();

    // Header
    const nameEl = document.getElementById('cs-name');
    if (nameEl) nameEl.textContent = p.name || '無名';
    const dayEl = document.getElementById('cs-day');
    if (dayEl) dayEl.textContent = p.day;
    const fameVal = document.getElementById('cs-fame-val');
    if (fameVal) fameVal.textContent = p.fame;
    const fameFill = document.getElementById('cs-fame-bar-fill');
    if (fameFill) fameFill.style.width = Math.min(100, p.fame) + '%';

    // ── Vital bars ──
    p.hpMax = p.hpBase + Math.round(2 * Stats.eff('CON'));
    p.hp = Math.min(p.hp, p.hpMax);
    [
      { id:'cs-bar-hp',      val:p.hp,      max:p.hpMax },
      { id:'cs-bar-stamina', val:p.stamina,  max:p.staminaMax },
      { id:'cs-bar-food',    val:p.food,     max:p.foodMax },
      { id:'cs-bar-mood',    val:p.mood,     max:p.moodMax },
    ].forEach(b => {
      const row = document.getElementById(b.id);
      if (!row) return;
      const pct = Math.round(b.val / b.max * 100);
      row.querySelector('.cs-bar-fill').style.width = pct + '%';
      row.querySelector('.cs-vital-num').textContent = b.val + '/' + b.max;
    });

    // ── Equipment ──
    const eqW = document.getElementById('cs-eq-weapon');
    const eqA = document.getElementById('cs-eq-armor');
    const eqS = document.getElementById('cs-eq-shield');
    if (eqW) eqW.textContent = p.equippedWeapon ? (Weapons[p.equippedWeapon]?.name || p.equippedWeapon) : '— 空手 —';
    if (eqA) eqA.textContent = p.equippedArmor  ? (Armors[p.equippedArmor]?.name  || p.equippedArmor)  : '— 破布 —';
    if (eqS) {
      const off = p.equippedOffhand;
      if (!off) {
        eqS.textContent = '— 無 —';
      } else if (Armors[off]) {
        eqS.textContent = Armors[off].name;          // 盾牌
      } else if (Weapons[off]) {
        eqS.textContent = Weapons[off].name + '（副）'; // 雙持
      } else {
        eqS.textContent = off;
      }
    }

    // ── 🆕 Resources（金錢 + SP） ──
    const moneyEl = document.getElementById('cs-money');
    if (moneyEl) moneyEl.textContent = p.money || 0;
    const spEl = document.getElementById('cs-sp');
    if (spEl) spEl.textContent = p.sp || 0;

    // ── Affection bars ──
    // 🆕 D.1.2: 好感度範圍 -100 ~ +100，bar 顯示正值部分（負值視覺處理留到 D.4）
    const affNpcs = ['master','officer','cassius','blacksmithGra','melaKook'];
    affNpcs.forEach(npcId => {
      const val = teammates.getAffection(npcId);
      const fill = document.getElementById('cs-aff-' + npcId);
      const num  = document.getElementById('cs-aff-' + npcId + '-n');
      if (fill) {
        // 正向用原色，負向暫時顯示 0 寬度（D.4 完整 UI）
        fill.style.width = Math.max(0, val) + '%';
        // 負向時變紅色（仇恨）
        if (val < 0) fill.style.background = 'linear-gradient(90deg, #8b0000, #c02020)';
      }
      if (num)  num.textContent  = val;  // 顯示真實數值（可能是負的）
    });

    // ── Six attribute cards ──
    ['STR','DEX','CON','AGI','WIL','LUK'].forEach(key => {
      const card = document.getElementById('cs-attr-' + key);
      if (!card) return;
      card.querySelector('.cs-attr-val').textContent = Math.round(Stats.eff(key));
    });

    // ── Derived stats (bar max = 200 for visual scaling) ──
    const DRV_MAX = { ACC:95, PEN:75, BLK:75, BpWr:85, SPD:100, CRT:75, CDMG:300, EVA:95 };
    const PCT_KEYS = new Set(['ACC','CRT','CDMG','BLK','BpWr','EVA']);
    Object.entries(d).forEach(([key, val]) => {
      const numEl  = document.getElementById('cs-drv-' + key);
      const barEl  = document.getElementById('cs-drv-bar-' + key);
      const maxV   = DRV_MAX[key] || 100;
      const pct    = Math.min(100, Math.round(val / maxV * 100));
      const rounded = Math.round(val);
      if (numEl) numEl.textContent = PCT_KEYS.has(key) ? rounded + '%' : rounded;
      if (barEl) barEl.style.width = pct + '%';
    });

    // ── Skills ──
    const skillList = document.getElementById('cs-skill-list');
    if (skillList) {
      const known = Object.values(Skills).filter(sk => _playerKnowsSkill(sk));
      if (known.length === 0) {
        skillList.innerHTML = '<div class="cs-skill-empty">尚未習得任何技能</div>';
      } else {
        skillList.innerHTML = known.map(sk => `
          <div class="cs-skill-item">
            <div class="cs-skill-name">${sk.name}</div>
            <div class="cs-skill-type">${sk.type === 'passive' ? '被動' : '主動'}</div>
            <div class="cs-skill-desc">${sk.desc}</div>
          </div>
        `).join('');
      }
    }
  }

  function _playerKnowsSkill(skill) {
    // Placeholder: check unlock requirements vs current stats
    const p = Stats.player;
    const req = skill.unlockReq || {};
    for (const [key, minVal] of Object.entries(req)) {
      if (key === 'fame') { if (p.fame < minVal) return false; }
      else { if (Stats.eff(key) < minVal) return false; }
    }
    return false; // default false until player actually learns skills
  }

  // ── Settings modal (D.1.7 重構為結構化) ──────────────
  function openSettingsModal() {
    const modal = document.getElementById('modal-settings');
    if (!modal) return;
    updateSettingsUI();
    modal.classList.add('open');
  }

  function closeSettingsModal() {
    document.getElementById('modal-settings')?.classList.remove('open');
  }

  /**
   * 取得/設定 nested 設定值，用路徑字串如 'audio.master'。
   */
  function _getSettingByPath(path) {
    const parts = path.split('.');
    let cur = settings;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }
  function _setSettingByPath(path, value) {
    const parts = path.split('.');
    let cur = settings;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  /** 把字串轉成正確的 JS 型別 */
  function _parseSettingValue(raw) {
    if (raw === 'true')  return true;
    if (raw === 'false') return false;
    const num = Number(raw);
    if (!isNaN(num) && raw.trim() !== '') return num;
    return raw;
  }

  function updateSettingsUI() {
    // 遍歷所有 vol-group，根據當前值 highlight 對應按鈕
    document.querySelectorAll('.vol-group[data-setting]').forEach(group => {
      const path = group.dataset.setting;
      const currentVal = _getSettingByPath(path);
      group.querySelectorAll('.vol-btn').forEach(btn => {
        const btnVal = _parseSettingValue(btn.dataset.val);
        btn.classList.toggle('active', btnVal === currentVal);
      });
    });
  }

  /**
   * 當玩家點擊設定按鈕時呼叫。
   */
  function setSetting(path, rawVal) {
    const val = _parseSettingValue(rawVal);
    _setSettingByPath(path, val);
    saveSettings();          // 會自動呼叫 _applySettings()
    updateSettingsUI();
  }

  // ── Save / Load ───────────────────────────────────────
  const SAVE_KEY = 'bairi_save_v1';

  function saveGame() {
    try {
      const p = Stats.player;
      const data = {
        version:      5,
        player:       { ...p,
                        inventory:     [...p.inventory],
                        affection:     { ...p.affection },
                        eqBonus:       { ...p.eqBonus  },
                        buffBonus:     { ...p.buffBonus },
                        combatStats:   { ...p.combatStats },
                        achievements:  [...(p.achievements || [])],
                        traits:        [...(p.traits       || [])],
                        // 🆕 v5 新欄位深拷貝
                        exp:           { ...(p.exp || {}) },
                        personalItems: [...(p.personalItems || [])],
                        pets:          { ...(p.pets || {}) },
                        scars:         [...(p.scars || [])],
                      },
        fieldId:      currentFieldId,
        gameState:    GameState.getSerializable(),  // 🆕 D.1.12: session state
        npcAffection: teammates.getAllAffection(),
        flags:        Flags.getAll(),                // v5: 故事旗標
        savedAt:      Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || ![2, 3, 4, 5].includes(data.version) || !data.player) return false;

      // Restore player
      const p = Stats.player;
      Object.assign(p, data.player);

      // 向下相容：舊存檔沒有這些欄位時補上預設值
      if (!Array.isArray(p.achievements)) p.achievements = [];
      if (!Array.isArray(p.traits))       p.traits       = [];
      if (p.title    === undefined)       p.title        = null;
      if (p.fameBase === undefined)       p.fameBase     = 0;
      p.combatStats.winStreak = p.combatStats.winStreak ?? 0;
      // v3→v4 遷移：equippedShield → equippedOffhand
      if (p.equippedOffhand === undefined) {
        p.equippedOffhand = p.equippedShield || null;
        delete p.equippedShield;
      }
      if (!p.staminaPenalty) p.staminaPenalty = { STR:0, DEX:0, CON:0, AGI:0, WIL:0, LUK:0 };

      // 🆕 v4→v5 欄位補齊（所有 D.1.4 + D.1.6 新增欄位）
      // 多部位裝備
      if (p.equippedHelmet === undefined) p.equippedHelmet = null;
      if (p.equippedChest  === undefined) p.equippedChest  = null;
      if (p.equippedArms   === undefined) p.equippedArms   = null;
      if (p.equippedLegs   === undefined) p.equippedLegs   = null;
      // 金錢
      if (p.money       === undefined) p.money       = 0;
      if (p.moneyEarned === undefined) p.moneyEarned = 0;
      if (p.moneySpent  === undefined) p.moneySpent  = 0;
      // EXP / SP
      if (!p.exp || typeof p.exp !== 'object') {
        p.exp = { STR:0, DEX:0, CON:0, AGI:0, WIL:0, LUK:0 };
      }
      if (p.sp       === undefined) p.sp       = 0;
      if (p.spEarned === undefined) p.spEarned = 0;
      // 個人物品 / 寵物 / 疤痕
      if (!Array.isArray(p.personalItems)) p.personalItems = [];
      if (!p.pets || typeof p.pets !== 'object') {
        p.pets = { companion: null, cell: null, outside: null };
      }
      if (!Array.isArray(p.scars)) p.scars = [];
      // 身分
      if (p.origin   === undefined) p.origin   = null;
      if (p.facility === undefined) p.facility = null;
      if (p.religion === undefined) p.religion = null;
      if (p.faction  === undefined) p.faction  = null;

      // Restore field + game state
      // 🆕 D.1.12: 統一從 GameState 還原 session state
      if (data.gameState) {
        GameState.loadFrom(data.gameState);
      } else {
        // 舊存檔（v4 或更早）只有 fieldId
        GameState.loadFrom({ fieldId: data.fieldId || 'dirtyCell' });
      }
      currentFieldId = GameState.getFieldId();
      currentNPCs    = GameState.getCurrentNPCs();

      // Restore NPC affection
      teammates.setAllAffection(data.npcAffection);

      // 🆕 v5: Restore story flags
      if (data.flags) Flags.loadFrom(data.flags);
      else            Flags.clear();

      return true;
    } catch (e) {
      console.warn('Load failed:', e);
      return false;
    }
  }

  function clearSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  function hasSave() {
    return !!localStorage.getItem(SAVE_KEY);
  }

  // ── Name entry modal ──────────────────────────────────
  function openNameModal() {
    // If a save exists, show continue/new-game choice instead
    if (hasSave()) {
      _showContinueModal();
      return;
    }
    document.getElementById('modal-name')?.classList.add('open');
    document.getElementById('name-input')?.focus();
  }

  function _showContinueModal() {
    const overlay = document.getElementById('modal-name');
    if (!overlay) return;
    // Temporarily replace modal content with continue/new-game UI
    const box = overlay.querySelector('.modal-box');
    if (!box) return;

    const raw  = localStorage.getItem(SAVE_KEY);
    let infoHtml = '';
    try {
      const d = JSON.parse(raw);
      const date = new Date(d.savedAt);
      const timeStr = `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
      infoHtml = `<p style="color:var(--text-dim);font-size:20px;margin:8px 0 4px;line-height:1.8;">
        ${d.player.name} ・ 第 ${d.player.day} 天<br>
        <span style="font-size:16px;color:var(--text-dim);">上次存檔：${timeStr}</span></p>`;
    } catch(e) {}

    box.innerHTML = `
      <div class="modal-header"><span class="modal-title">百日萬骸祭</span></div>
      <div class="modal-body">
        ${infoHtml}
      </div>
      <div class="modal-footer" style="flex-direction:column;gap:8px;">
        <button class="game-btn primary" id="btn-continue-game" style="width:100%;font-size:22px;letter-spacing:.2em;">繼續冒險</button>
        <button class="game-btn" id="btn-new-game" style="width:100%;font-size:18px;color:var(--text-dim);">新的命運（清除存檔）</button>
      </div>`;

    overlay.classList.add('open');

    document.getElementById('btn-continue-game')?.addEventListener('click', () => {
      overlay.classList.remove('open');
      rollDailyNPCs();
      const f = FIELDS[currentFieldId];
      if (f) addLog(`【繼續・第 ${Stats.player.day} 天】\n${f.logText}`, '#b8960c', true);
      renderAll();
    });

    document.getElementById('btn-new-game')?.addEventListener('click', () => {
      if (!confirm('確定開始新遊戲？目前存檔將被清除。')) return;
      clearSave();
      // Reset player to defaults
      Object.assign(Stats.player, {
        name:'無名', day:1, time:SLOT_START,
        fame:0, hp:100, hpMax:100, hpBase:80,
        stamina:50, staminaMax:100,
        food:50, foodMax:100,
        mood:50, moodMax:100,
        STR:10, DEX:10, CON:10, AGI:10, WIL:10, LUK:10,
        inventory:[], equippedWeapon:null, equippedArmor:null, equippedOffhand:null,
        // 🆕 多部位裝備
        equippedHelmet:null, equippedChest:null, equippedArms:null, equippedLegs:null,
        // 🆕 金錢
        money:0, moneyEarned:0, moneySpent:0,
        // 🆕 EXP / SP
        exp:{ STR:0, DEX:0, CON:0, AGI:0, WIL:0, LUK:0 },
        sp:0, spEarned:0,
        // 🆕 個人物品 / 寵物 / 疤痕
        personalItems:[],
        pets:{ companion:null, cell:null, outside:null },
        scars:[],
        // 🆕 身分
        origin:null, facility:null, religion:null, faction:null,
        // 其他
        affection:{ master:0, officer:0, blacksmith:0, cook:0 },
        achievements:[], traits:[], title:null, fameBase:0,
        staminaPenalty:{ STR:0, DEX:0, CON:0, AGI:0, WIL:0, LUK:0 },
        combatStats:{
          executionCount:0, spareCount:0, suppressCount:0,
          arenaWins:0, arenaLosses:0,
          sRankCount:0, aRankCount:0, totalTicks:0, winStreak:0,
        },
      });
      Flags.clear();          // 清空所有故事旗標
      GameState.reset();       // 🆕 D.1.12: 清空 session state
      currentFieldId = GameState.getFieldId();
      currentNPCs    = GameState.getCurrentNPCs();
      // Restore original name-entry form
      box.innerHTML = `
        <div class="modal-header"><span class="modal-title">你是誰</span></div>
        <div class="modal-body">
          <p style="color:var(--text-dim);font-size:24px;margin-bottom:12px;line-height:1.8">
            鐵鏈將你押入競技場。<br>他們問你的名字，不是因為在乎你——而是要刻在你的墓碑上。
          </p>
          <input type="text" id="name-input" maxlength="6" placeholder="輸入名字（最多六字）" autocomplete="off"/>
          <p class="name-hint">按 Enter 或點擊確認</p>
        </div>
        <div class="modal-footer">
          <button class="game-btn primary" id="btn-confirm-name">踏入命運</button>
        </div>`;
      document.getElementById('btn-confirm-name')?.addEventListener('click', confirmName);
      document.getElementById('name-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') confirmName();
      });
      document.getElementById('name-input')?.focus();
    });
  }

  function confirmName() {
    const input = document.getElementById('name-input');
    let name = (input?.value || '').trim().slice(0, 6) || '無名';
    Stats.player.name = name;
    document.getElementById('modal-name')?.classList.remove('open');
    rollDailyNPCs();
    const f = FIELDS[currentFieldId];
    if (f) addLog('【' + f.name + '】\n' + f.logText, '#ddd', true);
    saveGame();
    renderAll();
  }

  // ── Init ──────────────────────────────────────────────
  function init() {
    // Try to restore save first
    const loaded = loadGame();

    // Wire up detail / settings buttons
    document.getElementById('btn-detail')   ?.addEventListener('click', openDetailModal);
    document.getElementById('btn-settings') ?.addEventListener('click', openSettingsModal);
    document.getElementById('btn-close-detail')   ?.addEventListener('click', closeDetailModal);
    document.getElementById('btn-close-settings') ?.addEventListener('click', closeSettingsModal);
    document.getElementById('btn-confirm-name')   ?.addEventListener('click', confirmName);
    document.getElementById('name-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') confirmName();
    });
    // 🆕 D.1.7: Settings buttons — 所有 .vol-btn 透過父容器的 data-setting 路徑設定
    document.querySelectorAll('.vol-group[data-setting]').forEach(group => {
      const path = group.dataset.setting;
      group.querySelectorAll('.vol-btn').forEach(btn => {
        btn.addEventListener('click', () => setSetting(path, btn.dataset.val));
      });
    });
    // Leave game
    document.getElementById('btn-leave')?.addEventListener('click', () => {
      if (confirm('確定離開遊戲？')) window.location.href = 'index.html';
    });
    // Close modals on backdrop click
    document.querySelectorAll('.modal-overlay').forEach(m => {
      m.addEventListener('click', e => {
        if (e.target === m) m.classList.remove('open');
      });
    });

    // Build day bar structure (once)
    _buildDayBar();
    // Initial render
    renderAll();
    // Show name entry (or continue modal if save exists)
    openNameModal();

    if (loaded) {
      // Pre-roll NPCs silently so the UI is ready if they hit Continue immediately
      rollDailyNPCs();
    }
  }

  return { init, switchField, doAction, addLog, renderAll, showToast, openDetailModal, openSettingsModal, saveGame, clearSave, startArenaBattle };
})();

// Boot when DOM ready
document.addEventListener('DOMContentLoaded', Game.init);
