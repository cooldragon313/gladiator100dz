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

  // 🆕 Phase 1-B: 時段類型分類（Part E.2）
  //
  // Slot index  時間          類型           玩家可操作？
  // ────────────────────────────────────────────────────
  //  0          06:00~08:00   meal 早餐     自動觸發事件
  //  1          08:00~10:00   training 1   玩家選訓練
  //  2          10:00~12:00   training 2   玩家選訓練
  //  3          12:00~14:00   meal 午餐    自動觸發事件
  //  4          14:00~16:00   training 3   玩家選訓練
  //  5          16:00~18:00   training 4   玩家選訓練
  //  6          18:00~20:00   meal 晚餐    自動觸發事件
  //  7          20:00~22:00   rest         自動或事件
  //             22:00         sleep        就寢事件
  const SLOT_TYPES = [
    'meal',      // 0: 早餐
    'training',  // 1: 上午訓練 1
    'training',  // 2: 上午訓練 2
    'meal',      // 3: 午餐
    'training',  // 4: 下午訓練 1
    'training',  // 5: 下午訓練 2
    'meal',      // 6: 晚餐
    'rest',      // 7: 晚間休息
  ];

  // 每種類型的顯示名稱（for UI）
  const SLOT_TYPE_LABELS = {
    training: '訓練',
    meal:     '用餐',
    rest:     '休息',
    sleep:    '就寢',
  };

  // 每種類型的顯示圖示（for UI）
  const SLOT_TYPE_ICONS = {
    training: '⚔',
    meal:     '🍴',
    rest:     '💤',
    sleep:    '🌙',
  };

  /**
   * 取得某個 slot index 的類型。
   */
  function getSlotType(slotIdx) {
    return SLOT_TYPES[slotIdx] || 'rest';
  }

  /**
   * 訓練格總數（不含 meal/rest）。
   */
  const TRAINING_SLOT_COUNT = SLOT_TYPES.filter(t => t === 'training').length;

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
        language:      'zh-TW',     // 🆕 D.1.14: 'zh-TW' | 'zh-CN' | 'en' | 'ja'
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
    // 🆕 D.1.14: 語言 → I18N
    if (typeof I18N !== 'undefined' && settings.display.language) {
      I18N.setLang(settings.display.language);
    }
  }

  loadSettings();

  // ══════════════════════════════════════════════════════
  // 舞台視覺函式（D.8b / D.8c）
  // ══════════════════════════════════════════════════════

  /** 動作特效文字浮現在 #stage-center 上方 */
  function _showActionEffect(name, mult) {
    const layer = document.getElementById('action-fx-layer');
    if (!layer) return;
    layer.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'action-effect ';
    if      (mult >= 10) el.className += 'fx-legendary';
    else if (mult >= 4)  el.className += 'fx-mega';
    else if (mult >= 2)  el.className += 'fx-crit';
    else if (mult > 1)   el.className += 'fx-synergy';
    else                 el.className += 'fx-normal';
    el.textContent = name;
    layer.appendChild(el);
    const dur = mult >= 10 ? 3100 : mult >= 4 ? 2700 : 2300;
    setTimeout(() => { if (layer.contains(el)) layer.removeChild(el); }, dur);
  }

  /** 協力台詞泡泡（隊友列下方） */
  const _SYNERGY_QUOTES = [
    ['加油！',    '繼續！',       '不錯嘛！'],       // ×1~2
    ['一起來！',  '團結！',       '這才對！'],       // ×2~4
    ['無三不成禮！','天下無敵！', '這才是力量！'],   // ×4~10
    ['傳說誕生了！','前所未見！', '神話啊！'],       // ×10+
  ];

  function _showSynergyBubbles(npcIds, mult) {
    const container = document.getElementById('synergy-bubbles');
    if (!container) return;
    container.innerHTML = '';
    const qi = mult >= 10 ? 3 : mult >= 4 ? 2 : mult >= 2 ? 1 : 0;
    const quotes = _SYNERGY_QUOTES[qi];
    let idx = 0;
    (npcIds || []).forEach((npcId, i) => {
      if (!npcId) return;
      const aff = teammates.getAffection(npcId);
      if (aff < 30) return;
      const bubble = document.createElement('div');
      bubble.className = 'synergy-bubble' + (aff >= 60 ? ' bubble-partner' : '');
      bubble.style.animationDelay = (i * 0.13) + 's';
      bubble.textContent = quotes[idx % quotes.length];
      idx++;
      container.appendChild(bubble);
    });
    setTimeout(() => { container.innerHTML = ''; }, 4500);
  }

  /** 觀眾評語（依 NPC 好感度隨機出現） */
  const _AUD_COMMENTS = {
    masterArtus: {
      '60':  ['不錯。',       '有點意思。',     '繼續。'],
      '30':  ['...（點頭）',  '還算賣力。'],
      '0':   [],
      '-1':  ['希望這投資值得。'],
    },
    melaKook: {
      '60':  ['這小子挺俊俏的...', '加油！', '嘻嘻...'],
      '30':  ['努力呢。',          '不錯嘛。'],
      '0':   ['...'],
      '-1':  [],
    },
    overseer: {
      '30':  ['繼續訓練！',   '不許偷懶！'],
      '0':   ['盯著你呢。'],
      '-1':  ['廢物。'],
    },
  };

  function _showAudienceComments(audNpcIds, act) {
    const container = document.getElementById('audience-speech');
    if (!container) return;
    container.innerHTML = '';
    (audNpcIds || []).forEach((npcId, i) => {
      if (!npcId) return;
      const map = _AUD_COMMENTS[npcId];
      if (!map) return;
      if (Math.random() > 0.55) return;   // 55% 機率才說話
      const aff = teammates.getAffection(npcId);
      const tier = aff >= 60 ? '60' : aff >= 30 ? '30' : aff >= 0 ? '0' : '-1';
      const pool = map[tier] || [];
      if (!pool.length) return;
      const npc  = teammates.getNPC(npcId);
      const el   = document.createElement('div');
      el.className = 'aud-speech';
      el.style.animationDelay = (i * 0.22) + 's';
      el.innerHTML = `<span class="aud-speech-name">${npc?.name || npcId}：</span>${pool[Math.floor(Math.random() * pool.length)]}`;
      container.appendChild(el);
    });
    setTimeout(() => { container.innerHTML = ''; }, 4200);
  }

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

  /**
   * 剩餘的可用「訓練」格數。
   * 🆕 Phase 1-B: 只計算 training 類型的 slot，meal/rest 不計。
   */
  function slotsRemaining() {
    const idx = currentSlotIndex();
    let remaining = 0;
    for (let i = idx; i < SLOT_COUNT; i++) {
      if (SLOT_TYPES[i] === 'training') remaining++;
    }
    return remaining;
  }

  /**
   * 取得「總」剩餘時段數（含 meal/rest，用於判斷今天是否結束）。
   */
  function totalSlotsRemaining() {
    return Math.max(0, SLOT_COUNT - currentSlotIndex());
  }

  // ══════════════════════════════════════════════════
  // 🆕 Phase 1-D: 用餐事件
  // ══════════════════════════════════════════════════
  /**
   * 依好感度與隨機性選出用餐敘事，輸出 log 並套用效果。
   * @param {'breakfast'|'lunch'|'dinner'} mealType
   */
  function _triggerMealEvent(mealType) {
    const p     = Stats.player;
    const melaAff = teammates.getAffection('melaKook');
    const daily = Config.DAILY;

    // ── 共用：失眠症被動（rest slot 在 _resolveNonTrainingSlots 處理，
    //   meal slot 的失眠症扣除在這裡一併執行）
    if (p.ailments?.includes('insomnia_disorder')) {
      Stats.modVital('stamina', -3);
      Stats.modVital('mood',    -3);
    }

    // ── 飽食時可能跳過食物效果（仍有心情/NPC 互動）
    const isFull = p.food >= Config.THRESHOLDS.food.overStuffed;

    let text, foodGain, moodGain;

    if (mealType === 'breakfast') {
      if (melaAff >= 60) {
        text     = '🍴【早餐】梅拉把一個水煮蛋悄悄塞進你的碗底，目光輕柔地移開。你快速吃掉，心裡暖了一下。';
        foodGain = 40; moodGain = 12;
      } else if (melaAff >= 30) {
        text     = '🍴【早餐】廚娘多盛了幾勺豆子，你低頭道了謝。她嗯了一聲，算是回應。';
        foodGain = 35; moodGain = 8;
      } else {
        text     = '🍴【早餐】一份稀粥，半塊硬麵包。沒有味道，但填飽了肚子。';
        foodGain = daily.MEAL_FOOD_GAIN; moodGain = daily.MEAL_MOOD_GAIN;
      }
    } else if (mealType === 'lunch') {
      if (melaAff >= 60) {
        text     = '🍴【午餐】梅拉說了句「吃好點才有力氣打架」，語氣比往常柔和許多。';
        foodGain = 40; moodGain = 10;
      } else if (melaAff >= 30) {
        text     = '🍴【午餐】今天的燉豆多加了些鹽，比平常好吃一點。你猜是她故意的。';
        foodGain = 35; moodGain = 7;
      } else {
        text     = '🍴【午餐】依舊是那幾樣東西，分量勉強撐到下午。你吃得很快，沒有停下來品嚐。';
        foodGain = daily.MEAL_FOOD_GAIN; moodGain = daily.MEAL_MOOD_GAIN;
      }
    } else { // dinner
      if (melaAff >= 60) {
        text     = '🍴【晚餐】碗裡有一小塊肉，梅拉什麼都沒說。你也沒問。有些事不需要說出來。';
        foodGain = 42; moodGain = 14;
      } else if (melaAff >= 30) {
        text     = '🍴【晚餐】今晚的燉菜有肉味，雖然只是骨頭熬的湯。你喝完了整碗。';
        foodGain = 38; moodGain = 9;
      } else {
        text     = '🍴【晚餐】夜幕低垂，你沉默地吃完晚餐。今天又過了一天。';
        foodGain = daily.MEAL_FOOD_GAIN + 5; moodGain = daily.MEAL_MOOD_GAIN + 3;
      }
    }

    addLog(text, '#9dbf80', true);
    if (!isFull) Stats.modVital('food', foodGain);
    Stats.modVital('mood', moodGain);
  }

  /**
   * 🆕 Phase 1-D: 就寢事件 — 加權隨機選 sleep_normal / insomnia / nightmare
   * 在 sleepEndDay() 推進天數之前呼叫。
   */
  function _triggerSleepEvent() {
    const p = Stats.player;
    const daily = Config.DAILY;
    const hasInsomniaDisorder = p.ailments?.includes('insomnia_disorder');

    // ── 動態權重 ──────────────────────────────────
    // 基礎：normal 60 / insomnia 25 / nightmare 15
    let wNormal    = 60;
    let wInsomnia  = 25;
    let wNightmare = 15;

    // 心情差 → 失眠+
    if (p.mood <= 20)       { wInsomnia += 20; wNormal -= 15; }
    else if (p.mood <= 40)  { wInsomnia += 10; wNormal -= 8;  }

    // 體力過剩 → 失眠+（睡不著）
    if (p.stamina >= Config.THRESHOLDS.stamina.overcharged) { wInsomnia += 10; wNormal -= 8; }

    // 遊戲天數越高 → 噩夢稍多
    if (p.day >= 20)  { wNightmare += 8; wNormal -= 5;  }
    if (p.day >= 50)  { wNightmare += 7; wNormal -= 5;  }

    // 已有失眠症 → 正常睡覺很難
    if (hasInsomniaDisorder) { wInsomnia += 25; wNormal -= 20; }

    wNormal = Math.max(10, wNormal);  // 正常睡眠最少保留 10%

    const total = wNormal + wInsomnia + wNightmare;
    const roll  = Math.random() * total;

    let sleepType;
    if (roll < wNormal)               sleepType = 'normal';
    else if (roll < wNormal + wInsomnia) sleepType = 'insomnia';
    else                               sleepType = 'nightmare';

    // ── 就寢效果 ──────────────────────────────────
    const staminaMax = hasInsomniaDisorder
      ? (Config.AILMENT_DEFS.insomnia_disorder.sleepStaminaMax || 15)
      : daily.SLEEP_STAMINA_GAIN;

    const staminaGain = Math.min(staminaMax, daily.SLEEP_STAMINA_GAIN);

    if (sleepType === 'normal') {
      addLog('🌙【就寢】你閉上眼，很快沉入黑暗。沒有夢，只有沉重的疲倦與虛空。', '#8b87b8', true);
      Stats.modVital('stamina', staminaGain);
      Stats.modVital('mood',    daily.SLEEP_MOOD_GAIN);
      // 正常睡眠 → 重置失眠計數，累積正常睡眠天數
      p.insomniaStreak   = 0;
      p.normalSleepStreak = (p.normalSleepStreak || 0) + 1;
    } else if (sleepType === 'insomnia') {
      addLog('🌙【就寢】夜深了，但眼睛怎麼也合不上。腦子裡轉的全是訓練場的聲音。等你終於睡著，天色已開始泛白。', '#c47a6e', true);
      Stats.modVital('stamina', Math.round(staminaGain * 0.45));
      Stats.modVital('mood',    -5);
      // 失眠計數 +1
      p.insomniaStreak   = (p.insomniaStreak || 0) + 1;
      p.normalSleepStreak = 0;
    } else { // nightmare
      addLog('🌙【就寢】夢見鮮血。夢見沙土。夢見一張臉——你說不清楚是誰。驚醒時全身冷汗，天色才剛亮。', '#c47a6e', true);
      Stats.modVital('stamina', Math.round(staminaGain * 0.55));
      Stats.modVital('mood',    -12);
      // 噩夢計入失眠（也算沒睡好）
      p.insomniaStreak   = (p.insomniaStreak || 0) + 1;
      p.normalSleepStreak = 0;
    }

    // ── 失眠症觸發 / 解除 ─────────────────────────
    if (p.insomniaStreak >= 2 && !p.ailments.includes('insomnia_disorder')) {
      p.ailments.push('insomnia_disorder');
      addLog('⚕ 連續兩夜無法充分休息——你感覺到某種根深蒂固的疲憊在蔓延。【失眠症】發作。', '#ff6868', true);
    }
    if (p.normalSleepStreak >= 3 && p.ailments.includes('insomnia_disorder')) {
      p.ailments = p.ailments.filter(a => a !== 'insomnia_disorder');
      p.insomniaStreak = 0;
      addLog('✦ 連續幾夜好眠，那種深層的疲憊終於消散了。【失眠症】已解除。', '#88d870', true);
    }
  }

  /**
   * 🆕 Phase 1-D: 自動解決當前的 meal/rest 時段，直到進入 training 時段或日末。
   * meal 分支→ _triggerMealEvent()，rest 分支→被動恢復（Phase 1-E 再事件化）。
   */
  function _resolveNonTrainingSlots() {
    const p = Stats.player;
    let safeguard = 10;
    while (safeguard-- > 0) {
      const idx = currentSlotIndex();
      if (idx >= SLOT_COUNT) break;
      const type = SLOT_TYPES[idx];
      if (type === 'training') break;

      const daily = Config.DAILY;
      if (type === 'meal') {
        const mealType = idx === 0 ? 'breakfast' : idx === 3 ? 'lunch' : 'dinner';
        _triggerMealEvent(mealType);
      } else if (type === 'rest') {
        // Phase 1-E 會改為事件；目前保留安靜恢復
        addLog('【傍晚】訓練結束，你靠在牆邊喘了口氣。', '#8899aa', true);
        Stats.modVital('stamina', daily.REST_STAMINA_GAIN);
        Stats.modVital('mood',    daily.REST_MOOD_GAIN);
        // 失眠症：rest 時段額外被動消耗
        if (p.ailments?.includes('insomnia_disorder')) {
          const passive = Config.AILMENT_DEFS.insomnia_disorder.passiveOnRest;
          if (passive) {
            Stats.modVital('stamina', passive.stamina || 0);
            Stats.modVital('mood',    passive.mood    || 0);
          }
        }
      }

      Stats.advanceTime(SLOT_DUR);
      if (Stats.player.day > p.day) break;
    }
  }

  // ── Render: time slots ─────────────────────────────────
  // 🆕 Phase 1-B: 不同 slot type 顯示不同圖示與顏色
  function renderTimeSlots() {
    const con = document.getElementById('time-slots');
    if (!con) return;
    const idx = currentSlotIndex();
    let html = '';
    for (let i = 0; i < SLOT_COUNT; i++) {
      const h0   = 6 + i * 2;
      const h1   = h0 + 2;
      const label = String(h0).padStart(2,'0') + '-' + String(h1).padStart(2,'0');
      const type = SLOT_TYPES[i];
      const icon = SLOT_TYPE_ICONS[type] || '';
      const cls  = [
        'slot-box',
        'slot-' + type,
        i < idx ? 'used' : (i === idx ? 'current' : 'future'),
      ].join(' ');
      const title = `${label} ・ ${SLOT_TYPE_LABELS[type] || type}`;
      html += `<div class="${cls}" title="${title}">
                 <span class="slot-h">${label}</span>
                 <span class="slot-icon">${icon}</span>
               </div>`;
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

    // Day exhausted → only show sleep button
    if (sLeft <= 0) {
      con.innerHTML = `
        <div class="action-empty">今天的行動格已用盡。</div>
        <button class="action-btn-sleep" onclick="Game.doAction('_sleep')">就寢・迎接新的一天</button>`;
      return;
    }

    let html = '<div class="action-list-header">可用動作</div>';

    // Field-specific actions
    // 🆕 Phase 1-A: 移除動態聊天（chat_XXX）
    // 「你是奴隸，你不能主動找 NPC 聊天」— 所有 NPC 互動改為事件驅動
    // 同時過濾掉 hiddenFromList 動作（visitOfficer/visitMaster/sparring 等）
    // 這些動作定義仍然保留，未來會由事件系統觸發（Phase 1-F~H）
    const fieldActs = getFieldActions(currentFieldId, p, npcs)
      .filter(act => !act.hiddenFromList);

    const allActs = [...fieldActs, ACTIONS.rest];

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

    // ── 是否含屬性效果（Phase 1-E 需要提前判斷）──────
    const hasAttrEffect = (act.effects || []).some(e => e.type === 'attr');
    const isTraining    = hasAttrEffect && act.staminaCost > 0;

    // ══════════════════════════════════════════════════
    // 🆕 Phase 1-E: 閾值強制中斷（Pre-check）
    // ══════════════════════════════════════════════════
    if (isTraining) {
      // ── fatigue_force：體力 ≤ 10，100% 強制取消訓練 ──
      if (p.stamina <= 10) {
        addLog('【力竭】你的膝蓋一軟，幾乎跌倒。你根本沒力氣舉起武器。今天到此為止。', '#cc7733', true);
        Stats.modVital('stamina', 5);   // 強制休息回一點體力
        Stats.advanceTime(act.slots * SLOT_DUR);
        _resolveNonTrainingSlots();
        autoSave('action');
        renderAll();
        return;
      }
      // ── mood_despair：心情 ≤ 9，100% 強制取消訓練 ──
      if (p.mood <= 9) {
        addLog('【崩潰】你站在訓練場上，腦子一片空白。你不知道自己為什麼還在這裡。', '#cc7733', true);
        Stats.modVital('mood', -5);   // 自我螺旋
        Stats.advanceTime(act.slots * SLOT_DUR);
        _resolveNonTrainingSlots();
        autoSave('action');
        renderAll();
        return;
      }
    }

    // ══════════════════════════════════════════════════
    // 🆕 Phase 1-E: 閾值軟修正（Soft-modify，影響訓練效率）
    // ══════════════════════════════════════════════════
    let thresholdMult = 1.0;
    let thresholdDesc = '';

    if (isTraining) {
      // mood_flow：心情 ≥ 80，40% 機率進入心流（×1.5）
      if (p.mood >= 80 && Math.random() < 0.40) {
        thresholdMult *= 1.5;
        addLog('✨ 你的腦子出奇地清醒，每個動作都流暢到讓人不敢置信——你進入了心流。', '#ffe866', false);
        thresholdDesc += '（心流 ×1.5）';
      }
      // training_slacker：體力 ≤ 25，25% 機率擺爛（×0.4）
      if (p.stamina <= 25 && Math.random() < 0.25) {
        thresholdMult *= 0.4;
        addLog('😮‍💨 你有氣無力地揮著武器，這算訓練嗎？效果大打折扣。', '#aa7733', false);
        thresholdDesc += '（擺爛 ×0.4）';
      }
      // hunger_minor：飽食 ≤ 30，25% 機率輕度飢餓（×0.75）
      if (p.food <= 30 && Math.random() < 0.25) {
        thresholdMult *= 0.75;
        addLog('🫙 肚子開始咕嚕叫，注意力難以集中。', '#aa7733', false);
        thresholdDesc += '（飢餓 ×0.75）';
      }
    }

    // ── Mood multiplier ──────────────────────────────────
    function getMoodMult() {
      if (p.mood >= 70) return 1.25;
      if (p.mood <= 30) return 0.75;
      return 1.0;
    }
    const moodMult = getMoodMult();
    const moodDesc = moodMult > 1 ? '（心情佳 ×1.25）' : moodMult < 1 ? '（心情低落 ×0.75）' : '';

    // ── 協力倍率（D.8c）+ 體力消耗倍率 ──────────────
    let synergyMult = 1.0;
    let partnerCount = 0;
    if (hasAttrEffect) {
      (currentNPCs.teammates || []).forEach(npcId => {
        if (!npcId) return;
        const aff = teammates.getAffection(npcId);
        if      (aff >= 60) { synergyMult *= 1.6; partnerCount++; }
        else if (aff >= 30) { synergyMult *= 1.3; partnerCount++; }
      });
    }

    // 協力體力消耗倍率（訓練動作才套用，上限 70）
    const _STAMINA_MULT = [1.0, 1.2, 1.5, 1.8, 2.1, 2.5];
    const staminaMult = (hasAttrEffect && act.staminaCost > 0)
      ? _STAMINA_MULT[Math.min(partnerCount, 5)]
      : 1.0;
    const effectiveStaminaCost = hasAttrEffect
      ? Math.min(Math.round(act.staminaCost * staminaMult), 70)
      : act.staminaCost;

    // 記錄扣除前的體力（受傷計算用）
    const staminaBefore = p.stamina;

    // Deduct costs（使用有效消耗值）
    if (effectiveStaminaCost > 0) Stats.modVital('stamina', -effectiveStaminaCost);
    if ((act.foodCost || 0) > 0) Stats.modVital('food', -act.foodCost);

    // 🆕 D.1.9: 統一效果處理器
    // 🆕 Phase 1-E: thresholdMult（心流/擺爛/飢餓）折入 synergyMult 一起傳入
    const finalSynergyMult = synergyMult * thresholdMult;
    Effects.apply(act.effects || [], {
      moodMult,
      synergyMult: finalSynergyMult,
      currentNPCs,
      source: 'action:' + actionId,
    });

    // Advance time by slot(s)
    Stats.advanceTime(act.slots * SLOT_DUR);

    // 🆕 Phase 1-B: 自動解決當前的 meal/rest 時段
    // （這樣玩家訓練完不會看到「用餐時段」的空白畫面）
    _resolveNonTrainingSlots();

    // Log — action header + brief effect summary
    const gainSummary = (act.effects || []).map(eff => {
      if (eff.type === 'attr') {
        const actual = Math.round(eff.delta * finalSynergyMult * moodMult * 100) / 100;
        return `${eff.key}+${actual}`;
      }
      if (eff.type === 'vital')     return `${eff.key}${eff.delta > 0 ? '+' : ''}${eff.delta}`;
      if (eff.type === 'affection') return `${eff.key}好感${eff.delta > 0 ? '+' : ''}${eff.delta}`;
      return '';
    }).filter(Boolean).join(' · ');
    const extraDesc = [moodDesc, thresholdDesc].filter(Boolean).join(' ');
    addLog(`【${act.name}】${gainSummary ? '　' + gainSummary : ''}${extraDesc ? '　' + extraDesc : ''}`, '#c8a060', false);

    // ── 協力爆擊日誌（D.8c）─────────────────────────
    if (hasAttrEffect && synergyMult > 1.0) {
      const multStr = synergyMult.toFixed(1);
      if (synergyMult >= 10) {
        addLog(`🌟 傳說爆擊！協力 ×${multStr}`, '#cc44ff', false);
      } else if (synergyMult >= 4) {
        addLog(`💥 超協力爆擊！×${multStr}`, '#44aaff', false);
      } else if (synergyMult >= 2) {
        addLog(`⚡ 協力爆擊！×${multStr}`, '#44aaff', false);
      } else {
        addLog(`（協力加成 ×${multStr}）`, '#44bb44', false);
      }
    }

    // Flavor text
    if (act.flavorText) addLog(act.flavorText, '#a89070', false);

    // ── 受傷判定 v2（Phase 1-E 重構）────────────────
    // 核心邏輯：「訓練強度過高」才受傷，擺爛不受傷。
    // 主要驅動因子：超負荷比例 + 協力倍率；體虛只有輕微加成。
    if (hasAttrEffect && act.staminaCost > 0 && thresholdMult >= 1.0) {
      // thresholdMult < 1.0（擺爛/飢餓）→ 跳過，沒有過度施力就不受傷

      // 協力加乘消耗提示
      if (staminaMult > 1.0) {
        addLog(`（協力消耗 ×${staminaMult.toFixed(1)}　體力 -${effectiveStaminaCost}）`, '#aa7733', false);
      }

      let injuryChance = 0.05; // 基礎 5%

      // ── 超負荷比例（主要驅動）────────────────────
      // ratio = 本次消耗 / 扣除前體力：比例越高越危險
      const overloadRatio = effectiveStaminaCost / Math.max(1, staminaBefore);
      if      (overloadRatio >= 2.0) injuryChance += 0.50; // 消耗超過現有體力兩倍
      else if (overloadRatio >= 1.5) injuryChance += 0.35; // 消耗超過體力 1.5 倍
      else if (overloadRatio >= 1.0) injuryChance += 0.20; // 剛好耗盡
      else if (overloadRatio >= 0.7) injuryChance += 0.08; // 高強度但未耗盡

      // ── 絕對透支量（超負荷越深，額外疊加）────────
      const overDraft = Math.max(0, effectiveStaminaCost - staminaBefore);
      injuryChance += overDraft * 0.015; // 每點透支 +1.5%

      // ── 協力強度（多人高倍協力本身就是極限訓練）──
      if      (synergyMult >= 6.0) injuryChance += 0.30;
      else if (synergyMult >= 3.0) injuryChance += 0.18;
      else if (synergyMult >= 1.8) injuryChance += 0.08;

      // ── 體虛輕微加成（身體弱，小傷也更難撐）──────
      if (staminaBefore <= 20) injuryChance += 0.05;

      injuryChance = Math.min(injuryChance, 0.85);

      if (Math.random() < injuryChance) {
        const part = act.injuryPart || '身體';
        // 受傷程度依超負荷比例分輕/重
        const isHeavy = overloadRatio >= 1.5 || synergyMult >= 3.0;
        if (isHeavy) {
          Stats.modVital('stamina', -25);
          Stats.modVital('mood',    -20);
          addLog(`🩸 ${part}重傷！極限超載的代價。（體力 -25　心情 -20）`, '#cc3333', false);
        } else {
          Stats.modVital('stamina', -12);
          Stats.modVital('mood',    -8);
          addLog(`⚠️ ${part}輕傷。訓練強度稍微超出負荷。（體力 -12　心情 -8）`, '#cc7733', false);
        }
      }
    }

    // ── 舞台視覺效果（D.8b / D.8c）──────────────────────
    _showActionEffect(act.name, finalSynergyMult);
    if (hasAttrEffect && finalSynergyMult > 1.0) {
      _showSynergyBubbles(currentNPCs.teammates, finalSynergyMult);
    }
    _showAudienceComments(currentNPCs.audience, act);

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

    // 🆕 Phase 1-F: NPC 注意系統掃描
    _scanNpcNotice(act);

    // 🆕 Phase 1-H: 切磋邀請（訓練後隊友可能主動邀請）
    _checkSparringInvite(act);

    // Post-action events
    _postActionEvents(act);

    // 🆕 D.1.8: 依設定自動存檔（寫到 auto slot，不影響手動槽）
    autoSave('action');
    renderAll();
  }

  // ══════════════════════════════════════════════════
  // 🆕 Phase 1-F: NPC 注意系統
  // ══════════════════════════════════════════════════

  /**
   * NPC 注意規則定義表。
   * condition(p, act, npcsPresent) → boolean
   */
  const _NPC_NOTICE_RULES = [
    {
      npcId:     'blacksmithGra',
      threshold: 3,
      eventId:   'gra_notice_invite',
      condition: (p, act, npcs) => {
        const inScene = [...(npcs.teammates||[]), ...(npcs.audience||[])].includes('blacksmithGra');
        const isStr   = (act.effects||[]).some(e => e.type === 'attr' && e.key === 'STR');
        return inScene && isStr;
      },
    },
    {
      npcId:     'melaKook',
      threshold: 2,
      eventId:   'mela_notice_food',
      condition: (p, act, npcs) => {
        const inScene  = [...(npcs.teammates||[]), ...(npcs.audience||[])].includes('melaKook');
        const isHungry = p.food <= 30;
        const hasAff   = teammates.getAffection('melaKook') >= 30;
        return inScene && isHungry && hasAff;
      },
    },
    {
      npcId:     'overseer',
      threshold: 4,
      eventId:   'overseer_notice_task',
      condition: (p, act, npcs) => {
        const inScene    = [...(npcs.teammates||[]), ...(npcs.audience||[])].includes('overseer');
        const isTraining = (act.effects||[]).some(e => e.type === 'attr');
        return inScene && isTraining;
      },
    },
  ];

  /**
   * 每次訓練動作完成後呼叫。
   * 掃描在場 NPC，符合條件 → 累積 notice_count；達門檻 → 觸發注意事件。
   */
  function _scanNpcNotice(act) {
    const p    = Stats.player;
    const npcs = currentNPCs;

    for (const rule of _NPC_NOTICE_RULES) {
      const todayKey  = `notice_today_${rule.npcId}`;
      const countKey  = `notice_count_${rule.npcId}`;

      // 今天已觀察過這個 NPC → 跳過
      if (Flags.has(todayKey)) continue;

      // 條件不符 → 跳過
      if (!rule.condition(p, act, npcs)) continue;

      // 累積計數 + 鎖定今日
      const newCount = Flags.increment(countKey);
      Flags.set(todayKey, true);

      // 達門檻 → 觸發保證事件
      if (newCount >= rule.threshold) {
        Flags.set(countKey, 0);   // 計數歸零，重新觀察
        const ev = Events.getNoticeEvent(rule.eventId);
        if (ev) {
          addLog(ev.text, ev.color || '#aaaaaa', false);
          if (ev.effects) {
            Effects.apply(ev.effects, { source: 'notice:' + ev.id });
          }
          if (ev.flagSet) Flags.set(ev.flagSet, true);
        }
      }
    }
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

    // 🆕 Phase 1-D: 就寢事件（決定 normal/insomnia/nightmare + 失眠症邏輯）
    _triggerSleepEvent();

    // Overnight food cost（與就寢體力恢復分開）
    Stats.modVital('food', Config.DAILY.SLEEP_FOOD_COST);

    // Advance to next day
    p.day  = Math.min(100, p.day + 1);
    p.time = SLOT_START;

    addLog(`\n────────────────────\n第 ${p.day} 天　天光未明，新的一天開始了。`, '#b8960c', false);

    // 🆕 D.1.11: Fire "day start" hooks (p.day 是新的)
    DayCycle.fireDayStart(p.day);

    // Roll new day's NPCs
    _syncLastRollDay(-1);
    rollDailyNPCs();

    // 🆕 Phase 1-D: 06:00 是早餐時段，觸發早餐事件
    _resolveNonTrainingSlots();

    // 🆕 D.1.8: 每日結束自動存檔（即使 autoSave 設為 'day' 也會寫入）
    autoSave('day');
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
        // 🆕 D.1.8: 競技場勝利後自動存檔（算作一次重大行動）
        autoSave('action');
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
    // 🆕 D.1.15: 每次打開都回到「角色」tab
    _switchCharSheetTab('character');
    modal.classList.add('open');
  }

  function closeDetailModal() {
    document.getElementById('modal-detail')?.classList.remove('open');
  }

  /**
   * 🆕 D.1.15: 切換角色頁的 tab。
   * @param {string} tabId 'character' | 'people' | 'achievements' | 'codex' | 'quests'
   */
  function _switchCharSheetTab(tabId) {
    // 切換按鈕的 active 狀態
    document.querySelectorAll('.cs-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    // 切換內容 hidden 狀態
    document.querySelectorAll('.cs-tab-content').forEach(panel => {
      const isActive = panel.dataset.tabContent === tabId;
      panel.classList.toggle('active', isActive);
      panel.classList.toggle('hidden',  !isActive);
    });
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
    // 🆕 D.1.15: 動態生成好感度列表（不再硬編碼 5 個 NPC）
    // 只顯示「有資料」的 NPC（未見過的 NPC 不顯示，留給 Phase 1 的 NPC 百科）
    const affList = document.getElementById('cs-aff-list');
    if (affList) {
      const allAff = teammates.getAllAffection();
      // 過濾：只顯示好感度 != 0 或有基礎好感的 NPC
      const visible = Object.entries(allAff)
        .filter(([npcId, val]) => val !== 0 || (teammates.getNPC(npcId)?.baseAffection || 0) !== 0)
        // 依好感度絕對值降序（重要的在前）
        .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a));

      if (visible.length === 0) {
        affList.innerHTML = '<div class="cs-aff-empty" style="color:var(--text-dim);font-size:16px;padding:8px 4px;font-style:italic;">尚未與任何人建立連結</div>';
      } else {
        affList.innerHTML = visible.map(([npcId, val]) => {
          const npc = teammates.getNPC(npcId);
          const name = npc ? npc.name : npcId;
          const pct  = Math.max(0, val);  // 負值顯示為 0 寬度（D.4 完整 UI 之前）
          const isHate = val < 0;
          const barStyle = isHate
            ? 'background: linear-gradient(90deg, #8b0000, #c02020);'
            : '';
          return `
            <div class="cs-aff-row">
              <span class="cs-aff-name">${name}</span>
              <div class="cs-aff-bar-track">
                <div class="cs-aff-bar-fill" style="width:${pct}%; ${barStyle}"></div>
              </div>
              <span class="cs-aff-num" style="${isHate ? 'color:#c02020;' : ''}">${val}</span>
            </div>`;
        }).join('');
      }
    }

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

    // ── 🆕 Phase 1-D: Traits ──
    const traitsList = document.getElementById('cs-traits-list');
    if (traitsList) {
      const traits = p.traits || [];
      if (traits.length === 0) {
        traitsList.innerHTML = '<div class="cs-traits-empty">尚無特性</div>';
      } else {
        traitsList.innerHTML = '<div class="cs-traits-list">' + traits.map(id => {
          const def = Config.TRAIT_DEFS[id];
          const name = def ? def.name : id;
          const desc = def ? def.desc : '';
          const cat  = def ? def.category : 'positive';
          const prefix = cat === 'positive' ? '★' : '▼';
          const cls    = cat === 'positive' ? 'trait-positive' : 'trait-negative';
          return `<span class="trait-tag ${cls}" title="${desc}">
            <span class="trait-prefix">${prefix}</span>${name}
          </span>`;
        }).join('') + '</div>';
      }
    }

    // ── 🆕 Phase 1-D: Ailments ──
    const ailmentsList = document.getElementById('cs-ailments-list');
    if (ailmentsList) {
      const ailments = p.ailments || [];
      if (ailments.length === 0) {
        ailmentsList.innerHTML = '<div class="cs-traits-empty" style="color:var(--text-dim)">無病痛</div>';
      } else {
        ailmentsList.innerHTML = '<div class="cs-traits-list">' + ailments.map(id => {
          const def  = Config.AILMENT_DEFS[id];
          const name = def ? def.name : id;
          const desc = def ? def.desc : '';
          return `<span class="trait-tag trait-ailment" title="${desc}">
            <span class="trait-prefix">⚕</span>${name}
          </span>`;
        }).join('') + '</div>';
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

  // ── Save / Load (D.1.8: 透過 SaveSystem 多槽位管理) ──
  // 預設的手動存檔槽位。未來加多槽位 UI 時可由選單決定。
  const DEFAULT_MANUAL_SLOT = 'slot_0';

  /**
   * 建立完整的存檔 payload（純資料物件）。
   * 和讀取邏輯對稱，方便 SaveSystem 和其他模組使用。
   */
  function _buildSavePayload() {
    const p = Stats.player;
    return {
      version:      5,
      player:       { ...p,
                      inventory:     [...p.inventory],
                      affection:     { ...p.affection },
                      eqBonus:       { ...p.eqBonus  },
                      buffBonus:     { ...p.buffBonus },
                      combatStats:   { ...p.combatStats },
                      achievements:  [...(p.achievements || [])],
                      traits:        [...(p.traits       || [])],
                      ailments:      [...(p.ailments     || [])],   // 🆕 Phase 1-D
                      exp:           { ...(p.exp || {}) },
                      personalItems: [...(p.personalItems || [])],
                      pets:          { ...(p.pets || {}) },
                      scars:         [...(p.scars || [])],
                    },
      fieldId:      currentFieldId,
      gameState:    GameState.getSerializable(),
      npcAffection: teammates.getAllAffection(),
      flags:        Flags.getAll(),
      savedAt:      Date.now(),
    };
  }

  /**
   * 把存檔 payload 套用到當前遊戲狀態。
   * 包含所有向下相容的欄位補齊邏輯。
   */
  function _applySavePayload(data) {
    if (!data || ![2, 3, 4, 5].includes(data.version) || !data.player) return false;

    // Restore player
    const p = Stats.player;
    Object.assign(p, data.player);

    // 向下相容：舊存檔沒有這些欄位時補上預設值
    if (!Array.isArray(p.achievements))  p.achievements  = [];
    if (!Array.isArray(p.traits))        p.traits        = [];
    if (!Array.isArray(p.ailments))      p.ailments      = [];   // 🆕 Phase 1-D
    if (p.title              === undefined) p.title              = null;
    if (p.fameBase           === undefined) p.fameBase           = 0;
    if (p.insomniaStreak     === undefined) p.insomniaStreak     = 0;  // 🆕 Phase 1-D
    if (p.normalSleepStreak  === undefined) p.normalSleepStreak  = 0;  // 🆕 Phase 1-D
    p.combatStats.winStreak = p.combatStats.winStreak ?? 0;

    // v3→v4 遷移：equippedShield → equippedOffhand
    if (p.equippedOffhand === undefined) {
      p.equippedOffhand = p.equippedShield || null;
      delete p.equippedShield;
    }
    if (!p.staminaPenalty) p.staminaPenalty = { STR:0, DEX:0, CON:0, AGI:0, WIL:0, LUK:0 };

    // v4→v5 欄位補齊（D.1.4 + D.1.6 新增欄位）
    if (p.equippedHelmet === undefined) p.equippedHelmet = null;
    if (p.equippedChest  === undefined) p.equippedChest  = null;
    if (p.equippedArms   === undefined) p.equippedArms   = null;
    if (p.equippedLegs   === undefined) p.equippedLegs   = null;
    if (p.money       === undefined) p.money       = 0;
    if (p.moneyEarned === undefined) p.moneyEarned = 0;
    if (p.moneySpent  === undefined) p.moneySpent  = 0;
    if (!p.exp || typeof p.exp !== 'object') {
      p.exp = { STR:0, DEX:0, CON:0, AGI:0, WIL:0, LUK:0 };
    }
    if (p.sp       === undefined) p.sp       = 0;
    if (p.spEarned === undefined) p.spEarned = 0;
    if (!Array.isArray(p.personalItems)) p.personalItems = [];
    if (!p.pets || typeof p.pets !== 'object') {
      p.pets = { companion: null, cell: null, outside: null };
    }
    if (!Array.isArray(p.scars)) p.scars = [];
    if (p.origin   === undefined) p.origin   = null;
    if (p.facility === undefined) p.facility = null;
    if (p.religion === undefined) p.religion = null;
    if (p.faction  === undefined) p.faction  = null;

    // GameState
    if (data.gameState) {
      GameState.loadFrom(data.gameState);
    } else {
      GameState.loadFrom({ fieldId: data.fieldId || 'dirtyCell' });
    }
    currentFieldId = GameState.getFieldId();
    currentNPCs    = GameState.getCurrentNPCs();

    // NPC affection
    teammates.setAllAffection(data.npcAffection);

    // Story flags
    if (data.flags) Flags.loadFrom(data.flags);
    else            Flags.clear();

    return true;
  }

  /**
   * 存檔到預設手動槽位（保留向下相容的 API）。
   */
  function saveGame() {
    try {
      const payload = _buildSavePayload();
      return SaveSystem.saveToSlot(DEFAULT_MANUAL_SLOT, payload);
    } catch (e) {
      console.warn('Save failed:', e);
      return false;
    }
  }

  /**
   * 自動存檔（依 settings.gameplay.autoSave）。
   * 寫到 auto 槽位，不影響手動槽。
   */
  function autoSave(reason) {
    try {
      const mode = settings?.gameplay?.autoSave || 'action';
      if (mode === 'never') return;
      if (reason === 'day' && mode !== 'day' && mode !== 'action') return;
      if (reason === 'action' && mode !== 'action') return;

      const payload = _buildSavePayload();
      SaveSystem.saveToSlot(SaveSystem.AUTO_SLOT, payload);
    } catch (e) {
      console.warn('AutoSave failed:', e);
    }
  }

  /**
   * 讀取最新的存檔（手動或自動，以時間戳較新者優先）。
   * 向下相容的 API。
   */
  function loadGame() {
    try {
      const latestSlot = SaveSystem.getLatest();
      if (!latestSlot) return false;
      const data = SaveSystem.loadFromSlot(latestSlot);
      if (!data) return false;
      return _applySavePayload(data);
    } catch (e) {
      console.warn('Load failed:', e);
      return false;
    }
  }

  /**
   * 從指定槽位讀取（未來 UI 用）。
   */
  function loadGameFromSlot(slotId) {
    const data = SaveSystem.loadFromSlot(slotId);
    if (!data) return false;
    return _applySavePayload(data);
  }

  /**
   * 清除所有存檔。
   */
  function clearSave() {
    SaveSystem.clearAll();
  }

  /**
   * 是否有任何存檔可讀。
   */
  function hasSave() {
    return SaveSystem.hasAnySave();
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

    // 🆕 D.1.8: 從 SaveSystem 取最新槽位的 metadata 顯示
    let infoHtml = '';
    try {
      const latestSlot = SaveSystem.getLatest();
      const m = latestSlot ? SaveSystem.getSlotMetadata(latestSlot) : null;
      if (m) {
        const date = new Date(m.savedAt);
        const timeStr = `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
        const slotLabel = latestSlot === 'auto' ? '自動存檔' : `槽位 ${latestSlot.replace('slot_','')}`;
        infoHtml = `<p style="color:var(--text-dim);font-size:20px;margin:8px 0 4px;line-height:1.8;">
          ${m.playerName} ・ 第 ${m.day} 天 ・ 名聲 ${m.fame}<br>
          <span style="font-size:16px;color:var(--text-dim);">${slotLabel} ・ ${timeStr}</span></p>`;
      }
    } catch(e) { /* ignore */ }

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
      // 🆕 Phase 1-B: 載入後如果在 meal/rest 時段，自動解決
      _resolveNonTrainingSlots();
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
    // 🆕 Phase 1-B: 新遊戲從 06:00 開始，直接跳過早餐時段進入訓練
    _resolveNonTrainingSlots();
    saveGame();
    renderAll();
  }

  // ── Init ──────────────────────────────────────────────

  // 🆕 Phase 1-F: 每天開始清除 notice_today_* flags（防止同天重複計數）
  DayCycle.onDayStart('clearNoticeToday', (newDay) => {
    const todayFlags = Object.keys(Flags.getByPrefix('notice_today_'));
    todayFlags.forEach(k => Flags.unset(k));
  }, 20);

  // ══════════════════════════════════════════════════
  // 🆕 Phase 1-G: 傳喚系統
  // ══════════════════════════════════════════════════

  /**
   * 觸發一個傳喚事件：輸出敘事 log 並套用效果。
   */
  function _triggerSummonEvent(ev) {
    if (!ev) return;
    addLog(ev.text, ev.color || '#b8960c', true);
    if (ev.effects) Effects.apply(ev.effects, { source: 'summon:' + ev.id });
    if (ev.doneFlag) Flags.set(ev.doneFlag, true);
    if (ev.flagSet)  Flags.set(ev.flagSet,  true);
  }

  // 每天開始：掃描傳喚條件（priority 30，在早餐之後）
  DayCycle.onDayStart('checkSummons', (newDay) => {
    const p = Stats.player;

    // 只在奇數天做隨機傳喚，減少頻率
    // 主人第一次傳喚
    {
      const ev = Events.getSummonEvent('master_first_eval');
      if (ev && !Flags.has(ev.doneFlag) && p.fame >= 15) {
        _triggerSummonEvent(ev);
        return;
      }
    }

    // 主人贈禮（好感 ≥ 30）
    {
      const ev = Events.getSummonEvent('master_gift');
      if (ev && !Flags.has(ev.doneFlag) &&
          teammates.getAffection('masterArtus') >= 30) {
        _triggerSummonEvent(ev);
        return;
      }
    }

    // 長官任務派遣（名聲 ≥ 25）
    {
      const ev = Events.getSummonEvent('officer_mission');
      if (ev && !Flags.has(ev.doneFlag) && p.fame >= 25) {
        _triggerSummonEvent(ev);
        return;
      }
    }

    // 長官定期點名（每 12 天，用 day flag 防重複）
    if (newDay % 12 === 0 && !Flags.has(`officer_check_day_${newDay}`)) {
      const ev = Events.getSummonEvent('officer_check');
      if (ev) {
        _triggerSummonEvent(ev);
        Flags.set(`officer_check_day_${newDay}`, true);
      }
    }
  }, 30);

  // ══════════════════════════════════════════════════
  // 🆕 Phase 1-H: 切磋邀請系統
  // ══════════════════════════════════════════════════

  /**
   * 訓練動作完成後呼叫。
   * 在場隊友好感 ≥ 50，20% 機率主動邀請切磋。
   * 每個 NPC 每天最多邀請一次。
   */
  function _checkSparringInvite(act) {
    if (!act || !(act.effects||[]).some(e => e.type === 'attr')) return;
    const npcs = currentNPCs.teammates || [];
    for (const npcId of npcs) {
      const todayKey = `sparring_invite_today_${npcId}`;
      if (Flags.has(todayKey)) continue;
      if (teammates.getAffection(npcId) < 50) continue;
      if (Math.random() >= 0.20) continue;

      Flags.set(todayKey, true);
      const ev = Events.getSparringEvent(npcId);
      const npc = teammates.getNPC(npcId);
      addLog(ev.text, ev.color || '#6699cc', false);
      Effects.apply(ev.effects, { source: 'sparring:' + npcId });
      break; // 一次只發生一個切磋
    }
  }

  // 每天清除切磋今日鎖
  DayCycle.onDayStart('clearSparringToday', (newDay) => {
    Object.keys(Flags.getByPrefix('sparring_invite_today_')).forEach(k => Flags.unset(k));
  }, 21);

  // ══════════════════════════════════════════════════
  // 🆕 Phase 1-I: 主人採購派遣
  // ══════════════════════════════════════════════════

  // 每 7 天派一次跑腿（偏移 3，避開第 1 天）
  DayCycle.onDayStart('checkMasterErrand', (newDay) => {
    if (newDay < 4) return;
    if ((newDay - 3) % 7 !== 0) return;
    if (Flags.has(`errand_done_day_${newDay}`)) return;

    Flags.set(`errand_done_day_${newDay}`, true);
    const ev = Events.getErrandEvent();
    if (!ev) return;
    addLog(ev.text, ev.color || '#9dbf80', true);
    Effects.apply(ev.effects, { source: 'errand:' + ev.id });
    if (ev.flagSet) Flags.set(ev.flagSet, true);
  }, 35);

  function init() {
    // Try to restore save first
    const loaded = loadGame();

    // Wire up detail / settings buttons
    document.getElementById('btn-detail')   ?.addEventListener('click', openDetailModal);
    document.getElementById('btn-settings') ?.addEventListener('click', openSettingsModal);
    document.getElementById('btn-close-detail')   ?.addEventListener('click', closeDetailModal);
    document.getElementById('btn-close-settings') ?.addEventListener('click', closeSettingsModal);

    // 🆕 D.1.15: 角色頁 tab 切換
    document.querySelectorAll('.cs-tab').forEach(btn => {
      btn.addEventListener('click', () => _switchCharSheetTab(btn.dataset.tab));
    });
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

  return {
    init, switchField, doAction,
    addLog, renderAll, showToast,
    openDetailModal, openSettingsModal,
    saveGame, clearSave, startArenaBattle,
    // 🆕 D.1.8 存檔槽管理
    autoSave,
    loadGameFromSlot,
  };
})();

// Boot when DOM ready
document.addEventListener('DOMContentLoaded', Game.init);
