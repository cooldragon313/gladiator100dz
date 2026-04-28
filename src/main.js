/**
 * main.js — Core game engine
 * Depends on: stats.js, fields.js, npc.js, events.js, actions.js
 */
const Game = (() => {
  // ── Session state（同步至 GameState 模組）─────────────
  // 這些 local 變數是 main.js 內部快取，每個 mutation 都會同步到 GameState。
  // 外部模組請透過 GameState.getXxx() 存取，不要直接讀這裡。
  //
  // 🆕 Phase 1 重構：訓練場是唯一場景（stdTraining）
  // 不再有場地切換概念，玩家永遠停留在訓練場
  // 房間品質（dirty/basic/luxury）改為休息事件的敘事描述
  const FIXED_FIELD = 'stdTraining';
  let currentFieldId = FIXED_FIELD;
  GameState.setFieldId(FIXED_FIELD);
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
  // 🆕 Phase 1 重構：_syncField 已移除（訓練場是唯一場景，不再切換）
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

  /**
   * 🆕 2026-04-19：訓練 EXP 獲得時跳對應屬性 emoji
   *   emoji 數 = ceil(expGain / 10), 上限 5
   *   size = 20 + (count-1) × 5 → 20/25/30/35/40
   */
  const _EXP_EMOJI_MAP = { STR:'💪', DEX:'🎯', CON:'🛡', AGI:'👟', WIL:'🧠', LUK:'🍀' };
  function _showExpEmoji(attr, expGain) {
    if (!expGain || expGain <= 0) return;
    const emoji = _EXP_EMOJI_MAP[attr];
    if (!emoji) return;
    const count = Math.min(5, Math.max(1, Math.ceil(expGain / 10)));
    const size = 15 + count * 5;  // 20, 25, 30, 35, 40
    const stage = document.getElementById('stage-center') || document.getElementById('scene-view');
    if (!stage) return;

    const div = document.createElement('div');
    div.className = 'exp-emoji-effect';
    div.style.fontSize = size + 'px';
    // 小幅隨機位移避免重疊
    const dx = Math.floor(Math.random() * 30) - 15;
    div.style.marginLeft = dx + 'px';
    div.innerHTML = emoji.repeat(count);
    stage.appendChild(div);
    setTimeout(() => { if (stage.contains(div)) stage.removeChild(div); }, 1600);
  }

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
      '30':  [
        '繼續！',
        '不許偷懶！',
        '動作再快一點！',
        '挺腰！抬頭！',
        '這才像樣。',
      ],
      '0':   [
        '盯著你呢。',
        '我在看著。',
        '別讓我說第二遍。',
      ],
      '-1':  [
        '跑起來你這廢物！',
        '給我用力推，你沒吃飽嗎你！',
        '再撐三下——沒做成功晚餐就沒你的份！',
        '連揮劍都揮不動，老子家狗都比你兇！',
        '再慢一拍，我就用鞭子教你什麼叫快！',
        '抬頭！挺腰！你這樣打贏得了誰？',
        '繼續偷懶啊？明天你試試看還有沒有飯吃！',
        '那叫動作嗎？老太婆搬柴都比你有力！',
        '呼吸穩一點，你喘成這樣還打個屁！',
        '沒力氣？我讓你晚上睡地板你就有力氣了！',
        '主人的錢是給你來這裡裝死的嗎？',
        '你這廢物，給我再做十下！',
      ],
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
      // 🆕 2026-04-23：-1 tier 門檻從 0 降到 -5（避免好感一掉到 0 就被罵廢物）
      const tier = aff >= 60 ? '60' : aff >= 30 ? '30' : aff >= -5 ? '0' : '-1';
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
  // 🆕 碎念跑馬燈（固定兩行，不擋 stage 不擠日誌）
  const _mumbleLines = [];
  function _pushMumbleTicker(html) {
    _mumbleLines.push(html);
    if (_mumbleLines.length > 2) _mumbleLines.shift();
    const el = document.getElementById('mumble-ticker');
    if (el) {
      el.innerHTML = _mumbleLines
        .map(h => `<div class="mumble-line">${h}</div>`)
        .join('');
    }
  }

  function addLog(text, color = '#e0e0e0', italic = true, flash = false) {
    logHistory.unshift({ text, color, italic });
    if (logHistory.length > MAX_LOG) logHistory.pop();
    renderLog();
    if (flash) _flashLogArea();
  }

  /** 🆕 D.12 v2: 日誌區金色脈動，提醒玩家有重要事件 */
  function _flashLogArea() {
    const el = document.getElementById('log-area');
    if (!el) return;
    el.classList.remove('log-flash');
    void el.offsetHeight;   // force reflow so animation restarts
    el.classList.add('log-flash');
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
    // 🆕 D.28：重建前先清掉舊 markers（讓動態揭露可以即時反映）
    inner.querySelectorAll('.hdb-tick, .hdb-event, .hdb-dyn-event').forEach(el => el.remove());
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
    //   D.28: getTimelineMarkers() 已內建 revealFlag 過濾，只回傳已揭露的
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

    // 🆕 D.28：動態賭局（主人下注）— 觸發後顯示
    if (typeof Events !== 'undefined' && Events.DYNAMIC_BETS) {
      Events.DYNAMIC_BETS.forEach(bet => {
        const triggered = (typeof Flags !== 'undefined')
                        && Flags.has(`bet_day${bet.candidateDay}_triggered`);
        if (!triggered) return;
        const x = (bet.candidateDay - 1) * DAY_W + DAY_W / 2;
        const marker = document.createElement('div');
        marker.className = 'hdb-event hdb-dyn-event';
        marker.style.left = x + 'px';
        marker.title = `第 ${bet.candidateDay} 天：${bet.name}`;
        marker.innerHTML = `
          <span class="hdb-event-icon" style="color:${bet.iconColor}">${bet.icon}</span>
          <span class="hdb-event-name">${bet.name}</span>
        `;
        inner.appendChild(marker);
      });
    }
  }

  // 🆕 D.28：百日條重建（當有新事件揭露時呼叫）
  function _rebuildDayBar() {
    _buildDayBar();
    renderDayBar();
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

    // 🆕 Day 5 三人考驗 — 特殊處理（索爾震撼教育）
    if (ev.id === 'trial' && !Flags.has('trial_completed')) {
      _triggerThreePersonTrial(ev);
      return;
    }

    // Announcement
    addLog(`\n【第 ${p.day} 天 · ${ev.name}】\n${ev.logText}`, '#e8c870', true);
    showToast(`第 ${p.day} 天 ── ${ev.name}`, 5000);

    // Force scene + NPCs
    if (ev.forced) {
      _syncCurrentNPCs(ev.forcedNPCs);
      renderAll();
      _showTimelineBattleBtn(ev);
    }
  }

  // ══════════════════════════════════════════════════
  // 🆕 Day 5 三人考驗 — 震撼教育
  // 「三個人進去，只有兩個人出來。」
  //
  // 選項 A：你上場打索爾 → 正常戰鬥 → 贏了索爾死
  // 選項 B：讓奧蘭上場 → 奧蘭一定輸 → 你必須選誰活
  // 選項 C：代替所有人 [WIL≥15 或 fame≥5] → 難度戰 → 贏了三人都活
  // 選項 D：沉默 → 長官暴怒 → 你被罰上場 + debuff → 高死亡風險
  // ══════════════════════════════════════════════════
  function _triggerThreePersonTrial(ev) {
    _syncCurrentNPCs(ev.forcedNPCs);
    renderAll();

    addLog(`\n【第 ${Stats.player.day} 天 · ${ev.name}】`, '#e8c870', true);
    showToast(`第 ${Stats.player.day} 天 ── ${ev.name}`, 5000);

    // 🆕 2026-04-20：Day 5 重寫為公開處決儀式
    //   主題：震撼教育 / 命是主人的 / 沒有投資價值 = 淘汰
    //   阿圖斯首次登場（陽台）/ 老鳥先清 / 索爾被指定
    const introLines = [
      { text: '訓練場中央。清晨。' },
      { text: '（你跟奧蘭、索爾被推到中央。）' },
      { text: '（但不只你們三個。）' },
      { text: '（場邊還有五、六個老鳥被押過來——身上有傷，昨晚挨過打。）' },
      { text: '（其他奴隸幾十個，圍成一圈。靜默。）' },

      { speaker: '塔倫長官', text: '今天是新人的第五天。' },
      { speaker: '塔倫長官', text: '阿圖斯大人說——沒有人有資格混飯吃。' },
      { text: '（他的目光掃過全場。）' },
      { speaker: '塔倫長官', text: '每過一段時間，我會淘汰不值得養的。' },
      { speaker: '塔倫長官', text: '今天，輪到這幾個。' },

      { text: '（你這時才懂——你們是被當例子的。）' },

      // ─── 阿圖斯首次登場（陽台）───
      { text: '（你第一次抬頭看陽台。）' },
      { text: '（他站在那裡。）' },
      { text: '（一個高大的身影。手裡拿著酒杯。）' },
      { text: '（臉看不清——陽光太強。）' },
      { text: '（他沒說話。只是看著。）' },

      { speaker: '塔倫長官', text: '大人說——這幾個老的，時間到了。' },
      { text: '（5-6 個老鳥被侍從帶走。沒有掙扎。他們早就知道。）' },

      { text: '（你聽見木牌撞擊的聲音。索爾的掛件。）' },
      { text: '（他的手在胸前握緊那塊木牌。）' },

      { text: '（然後塔倫轉向你們。）' },

      { speaker: '塔倫長官', text: '新人——' },
      { text: '（他抬頭看陽台，等指示。）' },
      { text: '（阿圖斯的目光從酒杯上方掃過你們三人。）' },
      { text: '（停在索爾身上——1 秒。）' },
      { text: '（然後移開。）' },

      { speaker: '塔倫長官', text: '索爾。出局。' },

      { text: '（沒有理由。沒有解釋。）' },
      { text: '（大人判斷——這個不值得繼續養。）' },

      { text: '（索爾沒反應。他早就知道。）' },
      { text: '（他低頭看自己的瘸腿一眼——像是跟它道別。）' },

      { speaker: '塔倫長官', text: '剩下兩個——你們決定誰動手。' },
      { speaker: '塔倫長官', text: '打贏的留。打輸的——也一起走。' },
      { speaker: '塔倫長官', text: '這是給所有人看的。' },
      { speaker: '塔倫長官', text: '你們的命，是主人的。' },
    ];

    DialogueModal.play(introLines, {
      onComplete: () => _showTrialChoice(ev),
    });
  }

  function _showTrialChoice(ev) {
    const p = Stats.player;
    const wil = (typeof Stats.eff === 'function') ? Stats.eff('WIL') : (p.WIL || 10);
    const canHeroic = wil >= 15 || (p.fame || 0) >= 5;

    const choices = [
      {
        id: 'fight_sol',
        label: '我上場',
        hint: '你走向沙地中央。索爾站到你對面。',
        resultLog: '你握緊武器，走上沙地。索爾站在你對面——他的眼神沒有恨意，只有接受。',
        logColor: '#c8a060',
      },
      {
        id: 'send_orlan',
        label: '讓奧蘭上場',
        hint: '你把奧蘭推了出去。',
        effects: [
          { type:'moral', axis:'reliability', side:'negative' },
          { type:'moral', axis:'loyalty', side:'negative' },
          { type:'affection', key:'orlan', delta:-20 },
        ],
        resultLog: '奧蘭看了你一眼。那一眼裡有恐懼——還有一點點不相信。',
        logColor: '#8899aa',
      },
    ];

    if (canHeroic) {
      choices.push({
        id: 'heroic',
        label: '我代替所有人',
        hint: (wil >= 15 ? '【意志】' : '【名聲】') + '「讓他們退下。我一個人上。」',
        effects: [
          { type:'moral', axis:'reliability', side:'positive', weight:2 },
          { type:'moral', axis:'pride', side:'negative' },
        ],
        resultLog: '你走到場中央。「讓他們退下——我一個人打。」長官挑起眉毛。「有膽識。」',
        logColor: '#e8d070',
      });
    } else {
      // 灰色不可選 — 但不說「意志不足」，只用敘事語言暗示
      // 玩家知道有第四條路但不知道具體條件 → Day 6 晨思才揭曉
      choices.push({
        id: 'heroic_locked',
        label: '我代替所有人',
        hint: '你想站出來——但雙腿像被釘在地上。你知道自己撐不住。',
        requireMinAttr: { WIL: 999 },   // 永遠不可選（純敘事鎖）
      });
    }

    choices.push({
      id: 'silence',
      label: '沉默',
      hint: '你什麼都不做。',
      effects: [
        { type:'moral', axis:'reliability', side:'negative', weight:2 },
        { type:'vital', key:'mood', delta:-20 },
      ],
      resultLog: '你站在原地。一秒。兩秒。三秒。',
      logColor: '#666',
    });

    ChoiceModal.show({
      id: 'three_person_trial',
      icon: '⚔',
      title: '三個人進去，兩個人出來',
      body: '長官在等你的反應。索爾在等。奧蘭在等。你必須做出選擇。',
      forced: true,
      choices,
    }, {
      onChoose: (choiceId) => _resolveTrialChoice(choiceId, ev),
    });
  }

  function _resolveTrialChoice(choiceId, ev) {
    Flags.set('trial_completed', true);

    if (choiceId === 'fight_sol') {
      // A：你 vs 索爾 → 索爾是農夫體格 + 瘸腿，比你稍強但不強太多
      // 🆕 2026-04-20：戰前對白加看瘸腿暗示（他知道自己是祭品）
      DialogueModal.play([
        { text: '你握緊武器走上沙地。' },
        { text: '索爾站在你對面。他沒有躲閃的意思。' },
        { speaker: '索爾', text: '……好好打。' },
        { text: '（他說話時，視線不自覺地落在自己右腿上。）' },
        { text: '（那條永遠好不了的瘸腿。）' },
        { text: '（他笑了一下——沒到眼睛。）' },
        { speaker: '索爾', text: '……我走得比你們所有人都慢。' },
        { speaker: '索爾', text: '該是時候了。' },
        { text: '（你突然懂了——他一直都知道。）' },
        { text: '（他一進這裡，就是這個結局。）' },
      ], {
        onComplete: () => {
          Battle.start('trialSol',
            () => _solDeathScene(),
            () => _trialPlayerLostToSol(),
            { sparring: true }   // 🆕 2026-04-20 劇情戰鬥 — 關閉斬首面板（結果由劇本決定）
          );
        },
      });

    } else if (choiceId === 'send_orlan') {
      // B：奧蘭 vs 索爾 → 奧蘭一定輸 → 你選誰活
      DialogueModal.play([
        { text: '奧蘭走上沙地。他的腿在抖。' },
        { text: '索爾看了你一眼。然後看向奧蘭。' },
        { text: '不到三招。奧蘭倒在地上。' },
        { text: '長官舉起手——叫停。' },
        { speaker: '塔倫長官', text: '敗者出局。但——' },
        { speaker: '塔倫長官', text: '我只問你一次。' },
        { speaker: '塔倫長官', text: '留哪個？' },
      ], {
        onComplete: () => {
          ChoiceModal.show({
            id: 'who_survives',
            icon: '💀',
            title: '留哪個？',
            body: '奧蘭躺在地上呻吟。索爾站在旁邊，一動不動。長官在等你的答案。',
            forced: true,
            choices: [
              {
                id: 'save_orlan',
                label: '留奧蘭',
                hint: '你伸手指向奧蘭。索爾閉上了眼。',
                effects: [
                  { type:'moral', axis:'loyalty', side:'positive' },
                ],
                resultLog: '索爾閉上了眼。他沒有掙扎。你看見他嘴唇動了一下——像是在說一個名字。不是你的。',
              },
              {
                id: 'save_sol',
                label: '留索爾',
                hint: '你伸手指向索爾。奧蘭的眼睛瞪大了。',
                effects: [
                  { type:'affection', key:'orlan', delta:-80 },
                  { type:'moral', axis:'loyalty', side:'negative', weight:3, lock:true },
                  { type:'flag', key:'abandoned_orlan_trial' },
                ],
                resultLog: '奧蘭的眼睛瞪大了。他張嘴想說什麼——但侍從已經把他拖走了。你聽見他的聲音在走廊裡迴盪，越來越遠。',
              },
            ],
          }, {
            onChoose: (subId) => {
              if (subId === 'save_orlan') {
                _solDies('索爾被帶走了。你再也沒有見到他。');
              } else {
                // 奧蘭被帶走 — 奧蘭重傷但不死（永駐角色），但關係破裂
                addLog('奧蘭被帶走了。你不知道他去了哪裡。', '#8899aa', true, true);
                Flags.set('orlan_severely_damaged', true);
                // 索爾活了 → 但他以後會記得你犧牲奧蘭救他
                teammates.modAffection('sol', 30);
                Flags.set('sol_survived_trial', true);
              }
            },
          });
        },
      });

    } else if (choiceId === 'heroic') {
      // C：你 vs 索爾（強化版）→ 贏了三人都活
      DialogueModal.play([
        { speaker: '塔倫長官', text: '……有膽識。' },
        { text: '他揮手讓奧蘭和索爾退到場邊。' },
        { speaker: '塔倫長官', text: '不過——既然你這麼有自信，我給你個更有意思的對手。' },
        { text: '場邊走出一個你沒見過的人。身上的傷疤比你的鍛鍊還多。' },
      ], {
        onComplete: () => {
          Battle.start('trialVeteran',   // 更強的對手（劊子手）— 🆕 2026-04-20 加 sparring:true 關斬首面板
            () => {
              // 贏了：三人都活
              DialogueModal.play([
                { text: '你贏了。全場安靜了一瞬——然後爆發出掌聲。' },
                { speaker: '塔倫長官', text: '……不錯。三個都留下。' },
                { text: '索爾看著你。他的嘴角動了一下——可能是笑。' },
                { text: '奧蘭衝過來抱住你的手臂。他在發抖。' },
              ], {
                onComplete: () => {
                  Flags.set('sol_survived_trial', true);
                  Flags.set('heroic_trial', true);
                  teammates.modAffection('orlan', 20);
                  teammates.modAffection('sol', 20);
                  teammates.modAffection('officer', 10);
                  Stats.modFame(5);
                  addLog('三個人都活了下來。', '#e8d070', true, true);
                  renderAll();
                },
              });
            },
            () => {
              // 🆕 2026-04-20 heroic 輸路徑完整重寫：你盡力了但世界不給機會
              DialogueModal.play([
                { text: '你的膝蓋先倒下。' },
                { text: '沙子進了你的眼睛。' },
                { text: '（你還活著。但你輸了。）' },

                { speaker: '塔倫長官', text: '……有膽識。' },
                { speaker: '塔倫長官', text: '但只有膽識，救不了誰。' },

                { text: '（他走到索爾面前。）' },
                { text: '（索爾沒有抵抗——但他看了你一眼。）' },
                { speaker: '索爾', text: '……你盡力了。' },
                { text: '（那是他留給你的最後一句話。）' },

                { text: '（劍光閃過。索爾倒下。）' },

                { text: '（你看著天空。）' },
                { text: '（你流淚了——但你說不清是因為什麼。）' },
                { text: '（你為一個認識五天的人流淚。）' },

                { text: '（奧蘭衝過來。他的手摸到你的臉——冷的。）' },
                { speaker: '奧蘭', text: '……活下去。' },
                { speaker: '奧蘭', text: '你得替他活下去。' },
              ], {
                onComplete: () => {
                  // 數值後果（參見 docs/quests/day5-sand-wash.md）
                  Stats.modVital('hp',   -30);
                  Stats.modVital('mood', -30);
                  Stats.modFame(+3);          // 長官記得膽識
                  // 頭部中傷（結構化傷勢）
                  if (typeof Wounds !== 'undefined' && Wounds.inflict) {
                    Wounds.inflict('head', 2, { source: 'heroic_trial_failed' });
                  }
                  // NPC 好感變動
                  if (typeof teammates !== 'undefined') {
                    teammates.modAffection('orlan',   +10);  // 感激你替他扛
                    teammates.modAffection('officer',  -5);  // 輸了畢竟輸了
                  }
                  // 道德軸
                  if (typeof Moral !== 'undefined') {
                    Moral.push('reliability', 'positive', { weight: 2 });
                  }
                  // 伏筆 flag（未來 NPC 事件呼應）
                  Flags.set('heroic_trial_failed', true);

                  // 索爾死（觸發掛件、alive=false 等）
                  _solDies('索爾倒在你眼前。你沒能救他。');
                  renderAll();
                },
              });
            },
            { sparring: true }   // 🆕 2026-04-20 劇情戰鬥 — 關斬首面板
          );
        },
      });

    } else {
      // D：沉默 → 長官暴怒 → 你被罰上場 + 高風險
      DialogueModal.play([
        { text: '你什麼都沒做。' },
        { text: '一秒。兩秒。三秒。' },
        { speaker: '塔倫長官', text: '……' },
        { text: '他走到你面前。' },
        { speaker: '塔倫長官', text: '沒有求生意志的東西，不值得投資。' },
        { text: '他一腳踢在你膝蓋上——你跪了下去。' },
        { speaker: '塔倫長官', text: '上場。現在。' },
        { text: '你被推到沙地中央。索爾站在你對面。' },
        { text: '你的膝蓋還在痛。你的眼前有些模糊。' },
      ], {
        onComplete: () => {
          // 受罰上場：HP -20（膝蓋傷） + mood 已扣
          Stats.modVital('hp', -20);
          teammates.modAffection('officer', -10);
          Battle.start('trialSol',
            () => _solDeathScene(),
            () => {
              // 沉默路線輸了 = 你死
              addLog('你倒在沙地上。長官轉過身。「處理掉。」', '#8b0000', true, true);
              if (typeof Endings !== 'undefined' && Endings.deathEnding) {
                Endings.deathEnding(Stats.player.name);
              }
            },
            { sparring: true }   // 🆕 2026-04-20 劇情戰鬥 — 關斬首面板
          );
        },
      });
    }
  }

  // ── 索爾死亡完整場景 ──
  function _solDeathScene() {
    const hasMeat = Flags.has('sol_gave_meat');
    const hasShield = Flags.has('sol_shielded_you');

    const lines = [
      { text: '索爾倒在沙地上。' },
      { text: '他沒有掙扎。甚至沒有閉眼。' },
      { text: '長官走過來，低頭看了一眼。' },
      { speaker: '塔倫長官', text: '……結束了。' },
      { text: '侍從上前把索爾拖走。沙地上留下一條長長的拖痕。' },
    ];

    // 根據之前的互動，加不同的情感尾段
    if (hasMeat) {
      lines.push(
        { text: '你想起昨晚那塊乾肉。' },
        { text: '他早就知道自己不會活過今天。' },
        { text: '那塊乾肉不是分享——是遺物。' },
      );
    }

    if (hasShield) {
      lines.push(
        { text: '你想起他擋鞭子的那個背影。' },
        { text: '那麼大的身體，倒下的時候卻那麼安靜。' },
      );
    }

    lines.push(
      { text: '訓練場恢復了安靜。好像什麼都沒發生過。' },
      { text: '但你知道——索爾有一個女兒。五歲。在某個地方等他回家。' },
      { text: '她永遠等不到了。' },
    );

    // 奧蘭的反應
    lines.push(
      { text: '你轉頭看奧蘭。他站在場邊，臉色慘白。' },
      { text: '他沒有哭。但他的手在發抖——從頭到尾。' },
    );

    DialogueModal.play(lines, {
      onComplete: () => {
        // 設 NPC 為已死
        if (typeof teammates !== 'undefined' && teammates.getNPC('sol')) {
          teammates.getNPC('sol').alive = false;
        }
        Flags.set('sol_dead', true);
        Flags.set('sol_died_day', Stats.player.day);

        // 情緒衝擊
        Stats.modVital('mood', -25);
        if (typeof teammates !== 'undefined') {
          teammates.modAffection('orlan', -5);   // 奧蘭也被嚇到了
        }

        addLog('——索爾已死。', '#663344', true, true);
        if (typeof SoundManager !== 'undefined') SoundManager.playSynth('sleep');  // 沉重的低音

        // 🆕 2026-04-20 撿拾掛件演出（A-贏 路徑 fancy 版）
        setTimeout(() => {
          DialogueModal.play([
            { text: '（你走到索爾身邊。）' },
            { text: '（他的手裡——木牌。）' },
            { text: '（女兒刻的。歪歪斜斜。「D」字樣。）' },
            { text: '（你接過。）' },
            { text: '（它比看起來重得多。）' },
          ], {
            onComplete: () => {
              _grantSolAmulet();
              _endOfSandWash();   // 🆕 主人 +5 + 塔倫宣布開放競技場
              renderAll();
            },
          });
        }, 800);
      },
    });
  }

  // 🆕 D.28：Day 5 試煉中，玩家挑「你 vs 索爾」但輸了
  //   原本的設計是「長官也處決索爾」—— 但玩家輸了索爾卻被拖走不合理。
  //   新邏輯：玩家被拖走、重傷，索爾因為贏了試煉而活下來（sol_survived_trial）。
  function _trialPlayerLostToSol() {
    const lines = [
      { text: '你倒在沙地上。' },
      { text: '索爾站在你頭頂——但他沒有補刀。' },
      { speaker: '索爾', text: '……起來吧。' },
      { text: '那是他能給你的最大善意。' },
      { speaker: '塔倫長官', text: '……廢物。拖下去。' },
      { text: '侍從抓住你的手臂。你臉貼在沙上被拖走——沙礫磨過你的眼睛。' },
      { text: '你不知道自己昏了多久。' },
      { text: '醒來時已經是夜裡。奧蘭在你旁邊。他的手在抖。' },
      { speaker: '奧蘭', text: '……你還活著。' },
      { speaker: '奧蘭', text: '索爾沒讓他們殺你——他贏了，所以他可以替你求情。' },
      { speaker: '奧蘭', text: '他說你是他的夥伴。' },
      { text: '你看不清奧蘭的臉。但你感覺到他的眼淚滴在你手背上。' },
    ];
    DialogueModal.play(lines, {
      onComplete: () => {
        Stats.modVital('hp',   -40);
        Stats.modVital('mood', -30);
        Stats.modFame(-5);
        if (!Array.isArray(Stats.player.ailments)) Stats.player.ailments = [];
        if (!Stats.player.ailments.includes('torso_injury')) {
          Stats.player.ailments.push('torso_injury');
        }
        // 索爾活下來了 — 贏了試煉就該活
        Flags.set('sol_survived_trial', true);
        Flags.set('trial_lost_to_sol',  true);
        // 奧蘭看到你回來，好感變化
        if (typeof teammates !== 'undefined') {
          teammates.modAffection('orlan', 8);
          teammates.modAffection('sol',   15);   // 索爾替你求情
          teammates.modAffection('officer', -8);  // 長官鄙視你
        }
        addLog('你活下來了。整個訓練所都知道你輸了——但索爾記得你。', '#8b0000', true, true);
        _endOfSandWash();   // 🆕 2026-04-25 沙洗結束 — 競技場開放（玩家輸了主人沒印象，但仍可參賽）
        renderAll();
      },
    });
  }

  // 保留舊 API 以防其他地方呼叫
  function _solDies(narrative) {
    addLog(narrative, '#8899aa', true, true);
    if (typeof teammates !== 'undefined' && teammates.getNPC('sol')) {
      teammates.getNPC('sol').alive = false;
    }
    Flags.set('sol_dead', true);
    Flags.set('sol_died_day', Stats.player.day);
    _grantSolAmulet();   // 🆕 2026-04-20 索爾死 → 獲得女兒掛件
    _endOfSandWash();    // 🆕 2026-04-25 主人 +5 + 塔倫宣布開放競技場
    renderAll();
  }

  /**
   * 🆕 2026-04-20：索爾死後獲得女兒的掛件（+LUK 1 永久）
   *   設計哲學: LUK 在主人面前一文不值 — 索爾戴著這個沒逃過死
   *   你繼承他的愛跟運氣，也繼承他的處境（Day 49 血戰再迴響主題）
   */
  function _grantSolAmulet() {
    const p = Stats.player;
    if (Flags.has('has_sol_amulet')) return;   // 避免重複給
    Flags.set('has_sol_amulet', true);
    if (!Array.isArray(p.personalItems)) p.personalItems = [];
    if (p.personalItems.length < 6 && !p.personalItems.includes('sol_amulet')) {
      p.personalItems.push('sol_amulet');
    }
    // 永久 +1 LUK（女兒的祝福）
    p.LUK = (p.LUK || 10) + 1;

    // 🆕 2026-04-23：獲得物品 popup + 音效（升級版反饋）
    if (typeof SoundManager !== 'undefined') SoundManager.playSynth('acquire');
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play([
        { text: '✦ 獲得物品' },
        { text: '【女兒的掛件】' },
        { text: '（一塊歪歪斜斜的木牌。女兒刻的「D」字。）' },
        { text: '永久 LUK +1' },
      ]);
    }

    addLog('✦ 你獲得了：女兒的掛件（LUK +1）', '#d4af37', true, true);
    addLog('「一塊歪歪斜斜的木牌。女兒刻的。」', '#a89070', false, false);
  }

  // 🆕 2026-04-25：沙洗結束 — 主人留下印象 + 塔倫宣布開放競技場
  //   兩個沙洗結局（贏 / 輸給索爾被拖走）都會觸發開放競技場
  //   但只有玩家「贏」（活下來、索爾死）才有 master +5 印象
  //   輸了被拖走的玩家 = 主人覺得你是廢物 → 沒印象
  function _endOfSandWash() {
    if (typeof Flags === 'undefined') return;
    if (Flags.has('sand_wash_aftermath_done')) return;
    Flags.set('sand_wash_aftermath_done', true);
    Flags.set('arena_unlocked', true);

    const playerWon = !Flags.has('trial_lost_to_sol');

    // 延遲一下、避免跟前面的 popup / amulet 演出搶畫面
    setTimeout(() => {
      // 玩家贏 → 主人對你留下第一印象（你活下來了 = 有用）
      if (playerWon && typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection('masterArtus', 5);
      }
      const lines = playerWon
        ? [
            { text: '（沙地上的痕跡還沒掃乾淨。）' },
            { text: '（塔倫長官走到你們面前。）' },
            { speaker: '塔倫長官', text: '聽好。' },
            { speaker: '塔倫長官', text: '從今天開始——你們可以報名參加競技場了。' },
            { speaker: '塔倫長官', text: '主人會看著你們。' },
            { speaker: '塔倫長官', text: '⋯⋯誰能上、誰被淘汰，就看你們自己。' },
            { text: '（他轉身走了。）' },
            { text: '（你身上的沙還沒拍乾淨。但你知道——這是你還能再呼吸一次的理由。）' },
          ]
        : [
            { text: '（你躺在床上。能感覺到的只有疼。）' },
            { text: '（外面遠遠傳來塔倫長官對其他人講話的聲音。）' },
            { speaker: '塔倫長官', text: '⋯⋯從今天開始，你們可以報名參加競技場了。' },
            { speaker: '塔倫長官', text: '能上場的——機會自己抓。' },
            { text: '（你聽得清楚。但他沒提到你。）' },
            { text: '（你也不知道自己還算不算「能上場」的那群人。）' },
          ];

      if (typeof DialogueModal !== 'undefined') {
        DialogueModal.play(lines, {
          onComplete: () => {
            const msg = playerWon
              ? '✦ 競技場已開放報名。主人對你有了第一印象。'
              : '✦ 競技場已開放報名。但主人沒注意到你。';
            addLog(msg, '#d4af37', true, true);
            renderAll();
          },
        });
      } else {
        addLog('✦ 競技場已開放報名。', '#d4af37', true, true);
      }
    }, 1500);
  }

  // 🆕 2026-04-25 TODO：達官顯貴客人事件（user 提案、未實作）
  //   構想：
  //     - 主人在 audience 時 + 額外 5% 機率 → 帶「客人 ???」進來
  //     - 客人是新 NPC（待設計）— 暫定 ID 'distinguishedGuest'
  //       可能是領主使者 / 鄰邦商人 / 競爭主人 / 賭徒
  //     - 觸發後：主人公開要求場內對打、無斬首系統（sparring 模式）
  //     - 對手：在場其他 teammate（最強的那個）
  //     - 戰鬥贏 → 客人 +X 好感、主人 +5、玩家 fame +小
  //     - 戰鬥輸 → 客人 -X、主人 -3、玩家挨笑
  //   設計目的：場外故事連結、給玩家 fame 來源 + 客人關係累積
  //   相關 docs/quests/distinguished-guest.md 還沒寫
  //   實作前要先：
  //     1. npc.js 加 distinguishedGuest NPC 定義
  //     2. 設計 4-5 種客人類型（一個 session 一種隨機）
  //     3. battle.js 已支援 sparring:true 模式（無斬首），可直接用
  //     4. 寫對話池、結算規則
  //   暫不實作、留待 user 確認設計後再開工。

  // 🆕 2026-04-25：競技場 3 連勝 → 主人召見（一次性）
  //   觸發條件：onWin 處檢查 winStreak >= 3 + flag master_summon_3wins_done 未 set
  //   🆕 2026-04-25c 平衡：原 +15/+5 → +8/+3（戰鬥獎勵全面 ×0.5）
  function _playMasterSummon3WinsScene() {
    const lines = [
      { text: '（侍從匆匆來找你。）' },
      { speaker: '侍從', text: '主人有請。' },
      { text: '（你被帶到主人房門口。塔倫長官已經站在那裡。）' },
      { text: '（塔倫的臉色很複雜——他好像沒料到主人這麼快就找你。）' },
      { speaker: '塔倫長官', text: '⋯⋯主人在等你。進去。' },
      { text: '（你推門進去。主人坐在窗邊喝酒、沒抬頭。）' },
      { speaker: '主人', text: '⋯⋯三場了。' },
      { speaker: '主人', text: '我以為你撐不過第二場。' },
      { text: '（他終於抬頭看你。）' },
      { speaker: '主人', text: '坐。' },
      { text: '（你坐下。他打量了你一會兒。）' },
      { speaker: '主人', text: '我手底下的人，三場連贏的不多。' },
      { speaker: '主人', text: '⋯⋯記住我的臉。' },
      { speaker: '主人', text: '以後該怎麼上場、該怎麼活——你自己想清楚。' },
      { text: '（他揮揮手。）' },
      { speaker: '主人', text: '回去吧。' },
      { text: '（你出來。塔倫的眼神變了——從複雜變成警惕。）' },
      { text: '（你不知道是好事還是壞事。）' },
    ];
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => {
          if (typeof teammates !== 'undefined') {
            teammates.modAffection('masterArtus', 8);
            teammates.modAffection('officer', 3);
          }
          addLog('✦ 主人記住了你的臉。（masterArtus +8、officer +3）', '#d4af37', true, true);
          renderAll();
        },
      });
    } else {
      if (typeof teammates !== 'undefined') {
        teammates.modAffection('masterArtus', 8);
        teammates.modAffection('officer', 3);
      }
      addLog('✦ 主人召見：你連勝三場、主人記住了你。（masterArtus +8）', '#d4af37', true, true);
    }
  }

  function _showTimelineBattleBtn(ev) {
    // Remove old if exists
    document.getElementById('timeline-battle-btn')?.remove();
    // 🆕 D.21 修正：放到 #stage-center 而不是 #npc-area
    //   原本 append 到 npc-area 會破壞 flex column space-between 結構，
    //   導致觀眾欄跟場地被擠到異常位置。改 append 到置中的 stage-center。
    const stageCenter = document.getElementById('stage-center');
    if (!stageCenter) return;

    const btn = document.createElement('button');
    btn.id = 'timeline-battle-btn';
    btn.style.cssText = `
      padding:14px 44px;
      background:#1a0000;
      border:2px solid var(--blood-lt);
      color:#e87060;
      font-family:var(--font);
      font-size:24px;
      font-weight:700;
      letter-spacing:.2em;
      cursor:pointer;
      transition:background .2s, transform .15s;
      box-shadow:0 0 24px rgba(192,57,43,.45), inset 0 0 16px rgba(192,57,43,.15);
      z-index:30;
      position:relative;
      animation: battle-btn-pulse 1.8s ease-in-out infinite;
    `;
    btn.textContent = ev.actionLabel || '進入戰鬥';
    btn.onmouseover = () => { btn.style.background = '#2a0000'; btn.style.transform = 'scale(1.05)'; };
    btn.onmouseout  = () => { btn.style.background = '#1a0000'; btn.style.transform = 'scale(1)'; };
    btn.onclick = () => {
      btn.remove();
      // 🆕 D.22c：戰前 DialogueModal 演出（情緒鋪墊）
      const preBattleLines = _buildPreBattleLines(ev);

      // 🆕 onLose 邏輯：Day 100 才真正死亡，其他日只是重傷
      const onWin  = () => {
        addLog('你贏得了這場戰鬥！', '#d4af37');
        // 🆕 戰鬥獎金（主人分你一點）
        const reward = 15 + Math.floor(Math.random() * 16);  // 15~30
        Stats.modMoney(reward);
        addLog(`侍從遞來一小袋銅幣。「大人說這是你的。」（+${reward}）`, '#c8a060', false);
        // 🆕 2026-04-25：競技場勝利 → 主人 / 塔倫好感（賺錢功勞）
        // 🆕 2026-04-25c 平衡：50 天就名聲 100 → 整體再 ×0.5、+2/+2 → +1/+1
        //   S/A bonus 也同時減半（+4/+4 for S、+2/+2 for A — 見 battle.js）
        if (typeof teammates !== 'undefined') {
          teammates.modAffection('masterArtus', 1);
          teammates.modAffection('officer', 1);
          addLog('(主人聽到消息了。塔倫長官也記下這一筆。)', '#c8a060', false);
        }
        // 🆕 2026-04-25：連 3 場勝 → 主人召見事件（一次性）
        //   觸發條件：winStreak >= 3 + 還沒觸發過
        //   給 master +20、officer +5 + 開啟主人首次親見對話
        const ws = (Stats.player.combatStats?.winStreak || 0);
        if (ws >= 3 && !Flags.has('master_summon_3wins_done')) {
          Flags.set('master_summon_3wins_done', true);
          // 延遲一下、避免跟前面的對話搶畫面
          setTimeout(() => _playMasterSummon3WinsScene(), 1800);
        }
        // 🆕 2026-04-25：戰鬥後機率標記武器需修（葛拉階段 3 觸發來源）
        if (typeof BlacksmithEvents !== 'undefined' && BlacksmithEvents.markWeaponNeedsRepair) {
          BlacksmithEvents.markWeaponNeedsRepair({ chance: 0.30 });
        }
        renderAll();
        // Day 100 萬骸祭獲勝 → 進入結局判定器
        if (ev.id === 'final_festival' && typeof Endings !== 'undefined' && typeof Endings.pickAndPlay === 'function') {
          setTimeout(() => { Endings.pickAndPlay(true); }, 600);
        }
      };
      const onLose = (ev.id === 'final_festival')
        ? () => { Endings.deathEnding(Stats.player.name); }   // Day 100 = 真死
        : () => {
          // 平日戰敗 = 重傷 + 恥辱，但不死
          DialogueModal.play([
            { text: '你倒在沙地上。視野模糊。' },
            { text: '觀眾的聲音像是從很遠的地方傳來。' },
            { text: '有人把你拖下場。你聽見長官的聲音——' },
            { speaker: '塔倫長官', text: '……下次再這樣，就不只是丟臉了。' },
          ], {
            onComplete: () => {
              Stats.modVital('hp',   -30);
              Stats.modVital('mood', -20);
              Stats.modFame(-10);
              // 加一個傷勢（如果還沒有）
              if (!Stats.player.ailments.includes('torso_injury')) {
                Stats.player.ailments.push('torso_injury');
                addLog('⚠️ 你在戰鬥中受了重傷。軀幹的疼痛讓你很難呼吸。', '#cc7733', true, true);
              }
              addLog('你敗了。但你還活著——這次。', '#8899aa', true, true);
              renderAll();
            },
          });
        };

      // 🆕 戰鬥前自動備份到 backup slot（死了可以回到這裡）
      if (typeof SaveSystem !== 'undefined') {
        const payload = _buildSavePayload();
        SaveSystem.saveToSlot('backup', payload);
      }

      // 🆕 D.28：戰前武器安全網——若沒裝備但身上有武器 → 自動裝備
      _ensureWeaponBeforeBattle();

      if (preBattleLines.length > 0 && typeof DialogueModal !== 'undefined') {
        DialogueModal.play(preBattleLines, {
          onComplete: () => { Battle.start(ev.opponent, onWin, onLose); },
        });
      } else {
        Battle.start(ev.opponent, onWin, onLose);
      }
    };
    stageCenter.appendChild(btn);
  }

  // 🆕 D.28：戰前安全網
  //   - 沒裝備武器但 inventory 有 → 自動裝備第一把
  //   - 什麼都沒有 → 維持空手（但 fists 基礎傷害已加強，不會完全打不贏）
  function _ensureWeaponBeforeBattle() {
    const p = Stats.player;
    if (!p) return;
    if (p.equippedWeapon) return;
    const inv = Array.isArray(p.weaponInventory) ? p.weaponInventory : [];
    if (inv.length > 0) {
      const first = inv[0];
      const wId = (typeof first === 'string') ? first : first?.id;
      if (wId) {
        p.equippedWeapon = wId;
        addLog(`你從身上撿起${(typeof Weapons !== 'undefined' && Weapons[wId]?.name) || '武器'}握在手裡。`, '#c8a060', true);
      }
    } else {
      addLog('你沒有武器。只能赤手空拳上場。', '#cc7733', true, true);
    }
  }

  // 🆕 D.22c：根據 timeline event 產生戰前對話
  function _buildPreBattleLines(ev) {
    const p = Stats.player;
    const lines = [];
    const olanAff = (typeof teammates !== 'undefined') ? teammates.getAffection('orlan') : 0;

    if (ev.id === 'trial') {
      // Day 5 基礎考驗
      lines.push({ text: '訓練場的沙地今天格外安靜。' });
      lines.push({ text: '長官站在觀台上，主人也親自到場。' });
      lines.push({ text: '這不是平常的練習——今天是你第一次真正的考驗。' });
      if (olanAff >= 30) {
        lines.push({ speaker: '奧蘭', text: '……別緊張。我看著你。' });
      }
      lines.push({ text: '你握緊武器。對面那個人，跟你一樣是奴隸。' });
      lines.push({ text: '贏，才能繼續走下去。' });
    } else if (ev.id === 'major_arena') {
      // Day 50 大型競技
      lines.push({ text: '整個競技場都動員了起來。' });
      lines.push({ text: '領主的使者也出現在觀台上。這場不只是娛樂。' });
      lines.push({ text: '你的名字已經傳出這片沙地——今天，你要讓更多人記住它。' });
      if (olanAff >= 50) {
        lines.push({ speaker: '奧蘭', text: '不管發生什麼，我都在這裡。' });
      }
    } else if (ev.id === 'rival_battle') {
      // Day 75 宿敵
      lines.push({ text: '你知道這一天遲早會來。' });
      lines.push({ text: '那個一直在暗中觀察你的人——今天終於走上了對面。' });
      lines.push({ text: '沒有退路，沒有第二次機會。' });
    } else if (ev.id === 'final_festival') {
      // Day 100 萬骸祭
      lines.push({ text: '一百天。你活過了一百天。' });
      lines.push({ text: '萬骸祭的號角已然吹響，整個城市都在震顫。' });
      lines.push({ text: '這是最後一場。' });
      lines.push({ text: '勝者得到一切——敗者化作萬骸祭的祭品。' });
    }
    return lines;
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
  // 🆕 2026-04-27 重構 v2：
  //   隊友 6 大格全給命名 NPC（不再聚合 recruit）
  //   Recruit 改成右側獨立列表 #recruit-side-list（頭像 + aff 色階）
  function renderNPCSlots() {
    // Step 1: 渲染 6 隊友大格（純命名 NPC）
    const namedTms = (currentNPCs.teammates || []).slice(0, 6);
    for (let i = 0; i < 6; i++) {
      const slot = document.getElementById('tm-slot-' + i);
      if (!slot) continue;
      const npcId = namedTms[i];
      if (npcId) {
        const npc = teammates.getNPC(npcId);
        slot.classList.add('occupied');
        slot.classList.remove('empty', 'recruit-group');
        const favorBadge = npc?.favoredAttr
          ? `<span class="npc-favor-badge">${npc.favoredAttr}</span>`
          : '';
        slot.innerHTML = `<span class="npc-role-tag">${npc?.title || '隊友'}</span><span class="npc-name">${npc ? npc.name : npcId}</span>${favorBadge}`;
        slot.onclick = () => onNPCClick(npcId);
      } else {
        slot.classList.remove('occupied', 'recruit-group');
        slot.classList.add('empty');
        slot.innerHTML = '<span class="npc-empty-label">—</span>';
        slot.onclick = null;
      }
    }

    // Step 2: 右側 recruit 列表（每 recruit 一個頭像、aff 三段色階）
    const sideList = document.getElementById('recruit-side-list');
    if (sideList) {
      const recruits = (typeof RecruitPool !== 'undefined' && RecruitPool._getActiveRecruits)
                         ? RecruitPool._getActiveRecruits() : [];
      sideList.innerHTML = recruits.map(r => {
        const aff = (typeof teammates !== 'undefined') ? teammates.getAffection(r.id) : 0;
        let tierCls = '';
        if (aff >= 90) tierCls = 'aff-tier-3';
        else if (aff >= 60) tierCls = 'aff-tier-2';
        else if (aff >= 30) tierCls = 'aff-tier-1';
        const initial = r.name.charAt(0);
        return `
          <div class="recruit-side-item ${tierCls}" data-recruit-id="${r.id}" title="${r.name} (${r.favoredAttr}) · 好感 ${aff}">
            <div class="recruit-portrait">${initial}</div>
            <span class="recruit-name">${r.name}</span>
            <span class="recruit-attr-tag">${r.favoredAttr}</span>
          </div>
        `;
      }).join('');
      // 點擊個別 recruit 顯示資訊
      sideList.querySelectorAll('[data-recruit-id]').forEach(el => {
        el.addEventListener('click', () => onNPCClick(el.dataset.recruitId));
      });
    }

    // 🆕 D.18：背景角鬥士小字條（右側疊著）
    _renderBackgroundStrip();

    // 🆕 2026-04-27 觀眾排序：主格優先序 主人 > 塔倫 > 巴爺、其他擠溢位
    const PRIORITY_AUDIENCE = ['masterArtus', 'officer', 'overseer'];
    const audAll = (currentNPCs.audience || []).slice();

    // Step 1: 把優先 NPC 排前面、其他保留原順序
    const main3 = [];
    const overflow = [];
    PRIORITY_AUDIENCE.forEach(id => {
      if (audAll.includes(id)) main3.push(id);
    });
    audAll.forEach(id => {
      if (PRIORITY_AUDIENCE.includes(id)) return;   // 已在 main3
      if (main3.length < 3) main3.push(id);
      else overflow.push(id);
    });

    // Step 2: 渲染 3 大格
    for (let i = 0; i < 3; i++) {
      const slot = document.getElementById('aud-slot-' + i);
      if (!slot) continue;
      const npcId = main3[i];
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

    // Step 3: 渲染溢位區 5 小格
    for (let i = 0; i < 5; i++) {
      const slot = document.getElementById('aud-overflow-' + i);
      if (!slot) continue;
      const npcId = overflow[i];
      if (npcId) {
        const npc = teammates.getNPC(npcId);
        slot.classList.add('occupied');
        slot.classList.remove('empty');
        slot.textContent = npc ? npc.name.charAt(0) : npcId.charAt(0);
        slot.title = npc?.name || npcId;
        slot.onclick = () => onNPCClick(npcId);
      } else {
        slot.classList.remove('occupied');
        slot.classList.add('empty');
        slot.textContent = '';
        slot.title = '';
        slot.onclick = null;
      }
    }
  }

  // 🆕 2026-04-25：好感變動發光反饋
  //   teammates.modAffection 觸發 → 找到對應 tm-slot/aud-slot → 加 CSS 動畫
  //   delta > 0 = 綠光、delta < 0 = 紅光
  function flashNpcSlot(npcId, color) {
    if (!npcId || !color) return;
    const cur = (typeof GameState !== 'undefined' && GameState.getCurrentNPCs)
                  ? GameState.getCurrentNPCs() : currentNPCs;
    if (!cur) return;
    // 🆕 2026-04-27 recruit 走獨立側欄、用 data-recruit-id 找
    const recruitEl = document.querySelector(`#recruit-side-list [data-recruit-id="${npcId}"]`);
    if (recruitEl) {
      const cls = (color === 'green') ? 'aff-glow-positive' : 'aff-glow-negative';
      recruitEl.classList.remove('aff-glow-positive', 'aff-glow-negative');
      void recruitEl.offsetWidth;
      recruitEl.classList.add(cls);
      setTimeout(() => recruitEl.classList.remove(cls), 1200);
      return;
    }
    const tmIdx  = (cur.teammates || []).indexOf(npcId);
    let slotEl = null;
    if (tmIdx  >= 0) {
      slotEl = document.getElementById('tm-slot-'  + tmIdx);
    } else {
      // 🆕 2026-04-27 觀眾分主格 + 溢位區、要按渲染後的位置找
      const PRIORITY_AUDIENCE = ['masterArtus', 'officer', 'overseer'];
      const audAll = (cur.audience || []).slice();
      const main3 = [];
      const overflow = [];
      PRIORITY_AUDIENCE.forEach(id => { if (audAll.includes(id)) main3.push(id); });
      audAll.forEach(id => {
        if (PRIORITY_AUDIENCE.includes(id)) return;
        if (main3.length < 3) main3.push(id);
        else overflow.push(id);
      });
      const mainIdx = main3.indexOf(npcId);
      const overflowIdx = overflow.indexOf(npcId);
      if (mainIdx >= 0)        slotEl = document.getElementById('aud-slot-' + mainIdx);
      else if (overflowIdx >= 0) slotEl = document.getElementById('aud-overflow-' + overflowIdx);
    }
    if (!slotEl) return;   // NPC 不在場 → 不顯示（合理：你看不到的人好感變了沒提示）

    const cls = (color === 'green') ? 'aff-glow-positive' : 'aff-glow-negative';
    slotEl.classList.remove('aff-glow-positive', 'aff-glow-negative');
    void slotEl.offsetWidth;   // 強制 reflow 才能重播動畫
    slotEl.classList.add(cls);
    setTimeout(() => slotEl.classList.remove(cls), 1200);
  }

  // 🆕 2026-04-24 狂熱進度徽章（左上角金色框）
  function _renderFervorBadge() {
    if (typeof Fervor === 'undefined') return;
    const view = document.getElementById('scene-view');
    if (!view) return;
    let badge = document.getElementById('fervor-badge');
    const status = Fervor.getStatusForUI();
    if (!status) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'fervor-badge';
      view.appendChild(badge);
    }
    badge.classList.toggle('breakthrough', status.source === 'breakthrough');
    const titleIcon = status.source === 'breakthrough' ? '🔥' : '⚡';
    const hint = status.source === 'breakthrough'
                   ? `去${status.trainName}（突破必經）`
                   : `去${status.trainName}`;
    // 進度條視覺化（5 格，每完成 1 個亮一格）— 不顯示「N/5」純數字
    let dots = '';
    for (let i = 0; i < status.target; i++) {
      dots += `<span class="fervor-dot${i < status.progress ? ' on' : ''}"></span>`;
    }
    badge.innerHTML = `
      <div class="fervor-title">${titleIcon} ${status.name}狂熱</div>
      <div class="fervor-dots">${dots}</div>
      <div class="fervor-hint">${hint}</div>
    `;
  }

  // 🆕 D.18 背景角鬥士小字條（右側疊層）
  function _renderBackgroundStrip() {
    if (typeof BackgroundGladiators === 'undefined') return;
    const view = document.getElementById('scene-view');
    if (!view) return;
    let strip = document.getElementById('bg-gladiator-strip');
    if (!strip) {
      strip = document.createElement('div');
      strip.id = 'bg-gladiator-strip';
      view.appendChild(strip);
    }
    const active = BackgroundGladiators.getActiveToday();
    if (!active.length) {
      strip.innerHTML = '';
      strip.style.display = 'none';
      return;
    }
    strip.style.display = '';
    strip.innerHTML = active.map(bg => {
      const fam    = BackgroundGladiators.getFamiliarity(bg.id);
      const passed = BackgroundGladiators.isFamiliar(bg.id);
      const cls    = passed ? 'bg-entry passed' : 'bg-entry';
      const famMark = passed
        ? '<span class="bg-partner">夥伴</span>'
        : '';   // 沒通過就不顯示數字，保持乾淨
      return `<div class="${cls}" id="bg-entry-${bg.id}" title="${bg.name}（偏好 ${bg.favoredAttr}）">
        <span class="bg-name">${bg.name}</span>
        <span class="bg-attr">${bg.favoredAttr}</span>
        ${famMark}
      </div>`;
    }).join('');
  }

  // 🆕 D.28：背景角鬥士在自己名字旁邊跳小泡泡（不吃 log 空間，不擋觀眾）
  //   html 可包含現成 class（mumble-gossip / mumble-synergy）來染色
  function _showBgBubble(bgId, html, cls = '') {
    const entry = document.getElementById(`bg-entry-${bgId}`);
    if (!entry) return;
    // 移除舊泡泡（只保留最新一個）
    const old = entry.querySelector('.bg-bubble');
    if (old) old.remove();
    const b = document.createElement('div');
    b.className = 'bg-bubble ' + cls;
    b.innerHTML = html;
    entry.appendChild(b);
    // 自動淡出
    setTimeout(() => { b.classList.add('bg-bubble-fade'); }, 4200);
    setTimeout(() => { if (b.parentNode) b.remove(); }, 5000);
  }

  // ── Daily NPC roll (once per day) ─────────────────────
  function rollDailyNPCs() {
    const p = Stats.player;

    // 🆕 D.18：背景角鬥士要在外層 early-return 之前就試著抽
    // （避免同日讀檔時跳過背景抽取，導致畫面空白）
    if (typeof BackgroundGladiators !== 'undefined') {
      const curField = FIELDS[currentFieldId];
      const weight   = curField && curField.favorWeight;
      BackgroundGladiators.rollDaily(p.day, weight);
    }

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
        foodGain = 28; moodGain = 12;
      } else if (melaAff >= 30) {
        text     = '🍴【早餐】廚娘多盛了幾勺豆子，你低頭道了謝。她嗯了一聲，算是回應。';
        foodGain = 22; moodGain = 8;
      } else {
        text     = '🍴【早餐】一份稀粥，半塊硬麵包。沒有味道，但填飽了肚子。';
        foodGain = daily.MEAL_FOOD_GAIN; moodGain = daily.MEAL_MOOD_GAIN;
      }
    } else if (mealType === 'lunch') {
      if (melaAff >= 60) {
        text     = '🍴【午餐】梅拉說了句「吃好點才有力氣打架」，語氣比往常柔和許多。';
        foodGain = 28; moodGain = 10;
      } else if (melaAff >= 30) {
        text     = '🍴【午餐】今天的燉豆多加了些鹽，比平常好吃一點。你猜是她故意的。';
        foodGain = 22; moodGain = 7;
      } else {
        text     = '🍴【午餐】依舊是那幾樣東西，分量勉強撐到下午。你吃得很快，沒有停下來品嚐。';
        foodGain = daily.MEAL_FOOD_GAIN; moodGain = daily.MEAL_MOOD_GAIN;
      }
    } else { // dinner
      if (melaAff >= 60) {
        text     = '🍴【晚餐】碗裡有一小塊肉，梅拉什麼都沒說。你也沒問。有些事不需要說出來。';
        foodGain = 32; moodGain = 14;
      } else if (melaAff >= 30) {
        text     = '🍴【晚餐】今晚的燉菜有肉味，雖然只是骨頭熬的湯。你喝完了整碗。';
        foodGain = 25; moodGain = 9;
      } else {
        text     = '🍴【晚餐】夜幕低垂，你沉默地吃完晚餐。今天又過了一天。';
        foodGain = daily.MEAL_FOOD_GAIN + 2; moodGain = daily.MEAL_MOOD_GAIN + 3;
      }
    }

    addLog(text, '#9dbf80', true);
    if (!isFull) Stats.modVital('food', foodGain);
    Stats.modVital('mood', moodGain);
  }

  /**
   * 🆕 Phase 1-D: 就寢事件 — 加權隨機選 sleep_normal / insomnia / nightmare
   * 在 sleepEndDay() 推進天數之前呼叫。
   *
   * 🆕 D.12 v2：接受可選的 forcedType 參數，由 sleepEndDay 預先 roll 後傳入，
   *              讓 Stage 動畫能提前知道要播哪一種就寢演出。
   */
  function _rollSleepType() {
    const p = Stats.player;
    const hasInsomniaDisorder = p.ailments?.includes('insomnia_disorder');

    let wNormal    = 60;
    let wInsomnia  = 25;
    let wNightmare = 15;

    if (p.mood <= 20)       { wInsomnia += 20; wNormal -= 15; }
    else if (p.mood <= 40)  { wInsomnia += 10; wNormal -= 8;  }

    if (p.stamina >= Config.THRESHOLDS.stamina.overcharged) { wInsomnia += 10; wNormal -= 8; }

    if (p.day >= 20) { wNightmare += 8; wNormal -= 5; }
    if (p.day >= 50) { wNightmare += 7; wNormal -= 5; }

    if (hasInsomniaDisorder) { wInsomnia += 15; wNormal -= 10; }

    // 🆕 WIL Tier 1：意志力抵抗失眠
    //   WIL 高 → insomnia 權重降低、normal 權重提高
    //   WIL 20 = insomnia −10, normal +8
    const wil = (typeof Stats.eff === 'function') ? Stats.eff('WIL') : (p.WIL || 10);
    const wilSleepBonus = Math.floor(wil * 0.5);
    wInsomnia  = Math.max(5, wInsomnia - wilSleepBonus);
    wNormal   += Math.floor(wilSleepBonus * 0.8);

    wNormal = Math.max(10, wNormal);

    const total = wNormal + wInsomnia + wNightmare;
    const roll  = Math.random() * total;

    if (roll < wNormal)                  return 'normal';
    if (roll < wNormal + wInsomnia)      return 'insomnia';
    return 'nightmare';
  }

  /**
   * 🆕 2026-04-24：睡眠加成 — normal sleep 時依條件累加 stamina/mood
   *   設計目的：玩家如果照顧好自己（吃飽、心情好、有伴），睡眠回得更多
   *
   * 🆕 2026-04-27 大幅放大：
   *   - 房間 3 tier 真正生效（之前 getRoomTier 寫好但沒用）
   *     dirtyCell（fame<20）= 無加成
   *     basicRoom（fame≥20）= +8 stamina +3 mood
   *     luxuryRoom（fame≥60）= +18 stamina +6 mood +5 HP
   *   - 兄弟在側擴大：分房後其他高好感 teammate (≥60) 可帶著一起睡
   *     設計理由：升級到大房間反而失去陪伴加成不合理
   */
  function _applySleepBonuses(p) {
    const bonuses = [];
    let stamBonus = 0;
    let moodBonus = 0;
    let hpBonus   = 0;

    // 🆕 條件 0：房間等級 — 主加成、最重要
    const roomTier = (typeof Stats.getRoomTier === 'function') ? Stats.getRoomTier() : 'dirtyCell';
    if (roomTier === 'luxuryRoom') {
      stamBonus += 18;
      moodBonus += 6;
      hpBonus   += 5;
      bonuses.push('🏛 主人賞賜的好房間 +18');
    } else if (roomTier === 'basicRoom') {
      stamBonus += 8;
      moodBonus += 3;
      bonuses.push('🛏 像樣的房間 +8');
    }
    // dirtyCell = 0 加成、不 push log

    // 條件 1：飽暖好眠（food ≥ 70）
    if ((p.food || 0) >= 70) {
      stamBonus += 5;
      bonuses.push('🍖 飽暖好眠 +5');
    }
    // 條件 2：心情舒坦（mood ≥ 70）
    if ((p.mood || 0) >= 70) {
      stamBonus += 5;
      bonuses.push('💭 心情舒坦 +5');
    }
    // 條件 3：身體找到節奏（連續 normal sleep ≥ 3）
    if ((p.normalSleepStreak || 0) >= 3) {
      stamBonus += 5;
      bonuses.push('💤 身體找到節奏 +5');
    }
    // 條件 4：有寵物在身邊（任一槽有寵物）
    if (p.pets && Object.values(p.pets).some(v => v && v.id)) {
      stamBonus += 3;
      bonuses.push('🐭 夜裡有伴 +3');
    }
    // 🆕 條件 5：兄弟在側 — 擴大判定
    //   優先順序：奧蘭未分房 → 任何高好感 teammate (≥60) 跟著升級到好房間
    const orlanWithMe = typeof Flags !== 'undefined' &&
                        !Flags.has('separated_from_olan') &&
                        !Flags.has('orlan_dead') &&
                        !Flags.has('betrayed_olan');
    if (orlanWithMe) {
      stamBonus += 3;
      moodBonus += 2;
      bonuses.push('🤝 兄弟在側 +3（奧蘭）');
    } else if (typeof teammates !== 'undefined' && teammates.getAffection) {
      // 🆕 找一個高好感 teammate 跟你升級進房間
      //   loyal companions 名單：cassius / hector / ursa / dagiSlave / oldSlave
      const loyalCandidates = ['cassius', 'ursa', 'dagiSlave', 'oldSlave', 'hector'];
      let bestId = null, bestAff = 60;   // 至少 60 才算
      loyalCandidates.forEach(id => {
        const npc = teammates.getNPC && teammates.getNPC(id);
        if (!npc || npc.alive === false) return;
        const aff = teammates.getAffection(id);
        if (aff > bestAff) { bestAff = aff; bestId = id; }
      });
      if (bestId) {
        const name = teammates.getNPC(bestId).name;
        stamBonus += 3;
        moodBonus += 2;
        bonuses.push(`🤝 兄弟在側 +3（${name}）`);
      }
    }

    if (stamBonus > 0) Stats.modVital('stamina', stamBonus);
    if (moodBonus > 0) Stats.modVital('mood', moodBonus);
    if (hpBonus   > 0) Stats.modVital('hp',   hpBonus);

    if (bonuses.length > 0) {
      addLog('　睡眠加成：' + bonuses.join(' · '), '#88aacc', false, false);
    }
  }

  function _triggerSleepEvent(forcedType) {
    const p = Stats.player;
    const daily = Config.DAILY;
    const hasInsomniaDisorder = p.ailments?.includes('insomnia_disorder');

    const sleepType = forcedType || _rollSleepType();

    // ── 就寢效果 ──────────────────────────────────
    const staminaMax = hasInsomniaDisorder
      ? (Config.AILMENT_DEFS.insomnia_disorder.sleepStaminaMax || 15)
      : daily.SLEEP_STAMINA_GAIN;

    const staminaGain = Math.min(staminaMax, daily.SLEEP_STAMINA_GAIN);

    // 🆕 HP 每日恢復（所有睡眠類型都恢復，但量不同）
    //   正常睡眠 +20 HP、失眠 +8、噩夢 +5
    //   有受傷 ailment 時減半
    const hasInjury = Array.isArray(p.ailments) &&
      p.ailments.some(a => a.includes('injury'));
    const injuryMult = hasInjury ? 0.5 : 1.0;

    if (sleepType === 'normal') {
      if (typeof SoundManager !== 'undefined') SoundManager.playSynth('sleep');
      addLog('🌙【就寢】你閉上眼，很快沉入黑暗。沒有夢，只有沉重的疲倦與虛空。', '#8b87b8', true);
      Stats.modVital('stamina', staminaGain);
      Stats.modVital('mood',    daily.SLEEP_MOOD_GAIN);
      Stats.modVital('hp', Math.round(20 * injuryMult));   // 🆕 HP 恢復

      // 🆕 2026-04-24：睡眠加成（滿足條件給額外體力）
      //   每個條件獨立累加。最多 +21 stamina。失眠/噩夢不適用——前提是「睡得好」。
      _applySleepBonuses(p);

      // 正常睡眠 → 重置失眠計數，累積正常睡眠天數
      p.insomniaStreak   = 0;
      p.normalSleepStreak = (p.normalSleepStreak || 0) + 1;
    } else if (sleepType === 'insomnia') {
      // 第一次睡不著 vs 連續睡不著：不同敘述，避免每晚都看到同一句
      const prevStreak = p.insomniaStreak || 0;
      if (prevStreak === 0) {
        addLog('🌙【就寢】可惡……怎麼會有睡不著的感覺？你閉上眼，卻只看見天花板。腦子裡一刻不停地轉。', '#c47a6e', true, true);
      } else if (prevStreak === 1) {
        addLog('🌙【就寢】又睡不著了。第二夜了。你開始懷疑是不是身體哪裡出了問題。', '#c47a6e', true, true);
      } else if (prevStreak === 2) {
        addLog('🌙【就寢】第三夜。你已經不奢求好眠，只求撐過黎明。天花板的裂縫你都數熟了。', '#c47a6e', true, true);
      } else {
        addLog('🌙【就寢】夜深了，但眼睛怎麼也合不上。腦子裡轉的全是訓練場的聲音。等你終於睡著，天色已開始泛白。', '#c47a6e', true, true);
      }
      Stats.modVital('stamina', Math.round(staminaGain * 0.45));
      Stats.modVital('mood',    -5);
      Stats.modVital('hp', Math.round(8 * injuryMult));    // 🆕 失眠也恢復一點 HP
      // 失眠計數 +1
      p.insomniaStreak   = prevStreak + 1;
      p.normalSleepStreak = 0;
    } else { // nightmare
      addLog('🌙【就寢】夢見鮮血。夢見沙土。夢見一張臉——你說不清楚是誰。驚醒時全身冷汗，天色才剛亮。', '#c47a6e', true, true);
      Stats.modVital('stamina', Math.round(staminaGain * 0.55));
      Stats.modVital('mood',    -12);
      Stats.modVital('hp', Math.round(5 * injuryMult));    // 🆕 噩夢只恢復極少 HP
      // 噩夢計入失眠（也算沒睡好）
      p.insomniaStreak   = (p.insomniaStreak || 0) + 1;
      p.normalSleepStreak = 0;
    }

    // ── 失眠症觸發 / 解除 ─────────────────────────
    // 防禦性：確保 ailments 是陣列（舊存檔可能沒有此欄位）
    if (!Array.isArray(p.ailments)) p.ailments = [];

    // 🆕 D.28：失眠症免疫期（老默根除過後 7 天內不重發）
    const immunityUntil = (typeof Flags !== 'undefined') ? Flags.get('insomnia_immunity_until', -1) : -1;
    const inImmunity = typeof immunityUntil === 'number' && p.day <= immunityUntil;

    if (p.insomniaStreak >= 4 && !p.ailments.includes('insomnia_disorder') && !inImmunity) {
      p.ailments.push('insomnia_disorder');
      addLog('⚕ 連續四夜無法充分休息——你感覺到某種根深蒂固的疲憊在蔓延。【失眠症】發作。', '#ff6868', true, true);
    }
    if (p.normalSleepStreak >= 3 && p.ailments.includes('insomnia_disorder')) {
      p.ailments = p.ailments.filter(a => a !== 'insomnia_disorder');
      p.insomniaStreak = 0;
      addLog('✦ 連續幾夜好眠，那種深層的疲憊終於消散了。【失眠症】已解除。', '#88d870', true, true);
    }
  }

  // ══════════════════════════════════════════════════
  // 🆕 D.18 訓練協力公式輔助
  // ══════════════════════════════════════════════════
  /**
   * 取得動作訓練的主要屬性（第一個 exp/attr 正向 delta 的 key）。
   * 用於判定「命名/背景 NPC 的 favoredAttr 是否匹配」。
   */
  function _getTrainedAttrKey(act) {
    const effs = act && act.effects;
    if (!Array.isArray(effs)) return null;
    for (const e of effs) {
      if ((e.type === 'exp' || e.type === 'attr') && typeof e.delta === 'number' && e.delta > 0) {
        return e.key;
      }
    }
    return null;
  }

  // 🆕 D.26：偷懶放空的動態代價（在場扣好感 / 無人時 30% 被抓）
  // 🆕 2026-04-25 v10：機率階梯 — 主人(5%) < 侍從(10%) < 塔倫(20%) < 監督(75%+)
  //   無人 = 25% 玩家好好休息時間（補 stamina）
  //   巴爺好感分段：< 30 抽打 / ≥ 30 大吼 / ≥ 60 假裝沒看到
  // 權威 NPC 的靜態扣分規則
  const _SLACKING_WATCHERS = {
    masterArtus:  { affDelta: -15, moodHit: -20, hpHit: -10, line: '「這傢伙好大狗膽——在我眼皮底下！」', color: '#663344' },
    officer:      { affDelta: -10, moodHit: -8,  hpHit: -5,  line: '塔倫長官冷冷地看你：「⋯⋯沒救的東西。」', color: '#cc6666' },
    overseer:     { affDelta: -3,  moodHit: -4,  hpHit: -5,  line: '巴爺揚起鞭子：「那邊那個！給我站起來！」', color: '#cc8844' },
    masterServant:{ affDelta: -5,  moodHit: -5,  hpHit: -2,  line: '侍從瞇起眼記下什麼：「我會報告大人的。」', color: '#a07060' },
    hector:       { affDelta:  2,  moodHit:  0,  hpHit:  0,  line: '赫克特遠遠地對你舉了舉下巴——「乾得漂亮。」', color: '#9a5a70', isAlly: true },
  };
  // 友善 NPC 在場的反應（不扣好感，但有台詞）
  const _SLACKING_FRIENDLY = {
    cassius:  { line: '卡西烏斯看見你——只是搖搖頭，沒說什麼。',      color: '#8a8a8a' },
    orlan:    { line: '奧蘭遠遠地看了你一眼。他什麼都沒說。',          color: '#8a8a8a' },
    melaKook: { line: '梅拉從廚房門口探頭，壓低聲音：「小聲點，孩子。」', color: '#c8a060' },
    doctorMo: { line: '老默恰好經過，他沒停下——但他的眼睛笑了一下。',   color: '#b0a080' },
  };

  /**
   * 🆕 2026-04-19 偷懶被抓鞭刑特效：強紅光 + 大震動 + HP -5 + 音效
   * 🆕 2026-04-24：改用 DialogueModal 演出（不只 log），玩家會看到「被抓」對話框
   * @param {Object} [opts]
   *   captor — 抓人者（'overseer' / 'officer' / 'masterServant'）；
   *            null = 同場有 watcher 一起看見的情境
   */
  function _playWhipPunishment(opts) {
    // 強紅光 + 大震動 + 音效（在開對話框前）
    if (typeof _flashStageRed === 'function') _flashStageRed(true);
    if (typeof _shakeGameRoot === 'function') _shakeGameRoot(true);
    if (typeof SoundManager !== 'undefined' && SoundManager.playSynth) {
      try { SoundManager.playSynth('injury'); } catch (e) { /* ignore */ }
    }

    // 對白：依 captor 變化主導者口氣 + HP 扣分階梯
    const captor = opts && opts.captor;
    // 🆕 v10：HP 扣分依抓人者（主人 -10 / 塔倫 -5 / 巴爺 -5 / 侍從 -2）
    const HP_LOSS = { masterArtus: -10, officer: -5, overseer: -5, masterServant: -2 };
    const hpHit = HP_LOSS[captor] !== undefined ? HP_LOSS[captor] : -5;
    Stats.modVital('hp', hpHit);
    // 🆕 v10：HP 扣分依抓人者（主人 -10 / 塔倫 -5 / 巴爺 -5 / 侍從 -2）— 已扣於上方 hpHit
    let scene;
    if (captor === 'masterArtus') {
      // 🆕 v10：主人在場 = 大忌、最重懲罰
      scene = [
        { text: '（你抬頭——主人就站在那裡。）' },
        { text: '（他笑了。）', effect: 'shake' },
        { speaker: '主人', text: '⋯⋯這傢伙。' },
        { speaker: '主人', text: '在我眼皮底下偷懶？好大狗膽。' },
        { text: '（他揮手。侍從衝上來。）', effect: 'shake-big' },
        { text: '（咻——！）', effect: 'shake-big' },
        { speaker: '主角', text: '啊——！' },
        { text: '（咻——！）', effect: 'shake-big' },
        { speaker: '主角', text: '啊啊——！！' },
        { speaker: '主人', text: '記住這個感覺。' },
        { text: '（他轉身走了。整個訓練場安靜得能聽見呼吸。）' },
      ];
    } else if (captor === 'officer') {
      scene = [
        { text: '（你以為沒人——但你錯了。）' },
        { speaker: '塔倫長官', text: '⋯⋯果然在這裡。' },
        { text: '（鞭子已經在他手裡。）', effect: 'shake' },
        { text: '（咻——！）', effect: 'shake-big' },
        { speaker: '主角', text: '啊——！' },
        { speaker: '塔倫長官', text: '⋯⋯沒救的東西。' },
        { text: '（他甩了甩鞭子，走了。）' },
      ];
    } else if (captor === 'masterServant') {
      scene = [
        { text: '（轉角——一雙眼睛盯住你。）' },
        { speaker: '侍從', text: '哦？躲在這裡？' },
        { text: '（他從袖子裡抽出短鞭。）', effect: 'shake' },
        { text: '（咻——！）', effect: 'shake-big' },
        { speaker: '主角', text: '唔——！' },
        { speaker: '侍從', text: '我會報告大人的。' },
      ];
    } else {
      // 預設：監督官巴爺（overseer，aff < 30 才會走到這）
      scene = [
        { text: '（你以為沒人——但你錯了。）' },
        { speaker: '巴爺', text: '那邊那個！給我站起來！' },
        { text: '（他衝過來，鞭子已經舉起。）', effect: 'shake' },
        { text: '（咻——！）', effect: 'shake-big' },
        { speaker: '主角', text: '啊——！' },
        { text: '（鞭子抽在你背上。火燒一樣的痛。）' },
        { speaker: '巴爺', text: '下次再讓我看到——就不只一鞭。' },
      ];
    }

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(scene, {
        onComplete: () => {
          const hpDisp = (typeof opts === 'object' && opts && typeof opts.captor === 'string')
                          ? ({masterArtus:-10,officer:-5,overseer:-5,masterServant:-2}[opts.captor] || -5)
                          : -5;
          addLog(`💥 鞭子抽在你背上。（❤️ ${hpDisp}）`, '#cc3333', true, true);
          if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
        },
      });
    } else {
      addLog('💥 鞭子抽在你背上。', '#cc3333', true, true);
    }
  }

  function _handleSlacking() {
    const teamIds = Array.isArray(currentNPCs?.teammates) ? currentNPCs.teammates : [];
    const audIds  = Array.isArray(currentNPCs?.audience)  ? currentNPCs.audience  : [];
    const present = [...teamIds, ...audIds];

    // 優先度：掃描「會處罰你的」在場 NPC
    const watchers = present.filter(id => _SLACKING_WATCHERS[id]);

    if (watchers.length > 0) {
      // 有權威 NPC 在場 → 直接扣
      // 心情加成減半（被瞪哪有心情爽）
      Stats.modVital('mood', -8);

      // 🆕 v10：依優先度選主導抓人者（masterArtus > officer > masterServant > overseer）
      //   主人在 = 大忌，蓋過其他人
      const PRIORITY = ['masterArtus', 'officer', 'masterServant', 'overseer'];
      const hostile = watchers.filter(id => !_SLACKING_WATCHERS[id].isAlly);
      let captor = null;
      for (const id of PRIORITY) {
        if (hostile.includes(id)) { captor = id; break; }
      }

      if (captor) {
        // 🆕 v10：巴爺好感分段判定（只對 overseer captor 適用）
        const overseerAff = (typeof teammates !== 'undefined' && teammates.getAffection)
                              ? teammates.getAffection('overseer') : 0;
        if (captor === 'overseer' && overseerAff >= 60) {
          // 假裝沒看到
          addLog('巴爺看了你一眼，沒走過來。「⋯⋯我這次當沒看到。下次別再讓我看見。」', '#c8a060', true, true);
          // 不扣 HP / 好感 -1（最輕）
          teammates.modAffection('overseer', -1);
          return;
        }
        if (captor === 'overseer' && overseerAff >= 30) {
          // 大吼但不打
          addLog('巴爺大吼：「你他媽再讓我看到一次——！」（他只是吼，沒動手。）', '#cc8844', true, true);
          teammates.modAffection('overseer', -1);
          Stats.modVital('mood', -3);
          return;
        }
        // 其餘情境 → 鞭刑（含 overseer aff < 30）
        _playWhipPunishment({ captor });
      }

      // 套用所有在場 watcher 的好感 / mood 扣分（不只 captor）
      watchers.forEach(id => {
        const rule = _SLACKING_WATCHERS[id];
        if (rule.affDelta) teammates.modAffection(id, rule.affDelta);
        if (rule.moodHit && !rule.isAlly) Stats.modVital('mood', rule.moodHit);
        addLog(rule.line, rule.color, true, true);
      });
      return;
    }

    // 沒權威 NPC → 檢查友善 NPC 反應（不扣分，只加敘述）
    const friends = present.filter(id => _SLACKING_FRIENDLY[id]);
    if (friends.length > 0) {
      const pick = friends[Math.floor(Math.random() * friends.length)];
      const rule = _SLACKING_FRIENDLY[pick];
      addLog(rule.line, rule.color, false, false);
      // 正常偷懶，沒被抓
      addLog('你找到一個角落，真的歇了一會。體力跟心情都回來一些。', '#d4af37', false, false);
      return;
    }

    // 🆕 v10：完全沒人在場 → 75% 玩家好好休息 / 25% 巡邏抓包
    //   (與 v9 相反 — 巴爺常駐 audience 0.85，能走到「無人」的場景大多是真沒人 = 玩家確實安全)
    if (Math.random() < 0.25) {
      // 抓人者機率階梯（主人 5% / 侍從 10% / 塔倫 20% / 監督 65%）
      const roll = Math.random();
      let caught;
      if (roll < 0.05)      caught = 'masterArtus';     // 主人最少出現、出現就慘
      else if (roll < 0.15) caught = 'masterServant';   // 侍從
      else if (roll < 0.35) caught = 'officer';         // 塔倫
      else                  caught = 'overseer';        // 監督官最常見

      const rule = _SLACKING_WATCHERS[caught];
      // 被抓 = 震怒版：扣更多
      const angryAff  = Math.round(rule.affDelta * 1.5);
      const angryMood = Math.round(rule.moodHit * 1.3);
      teammates.modAffection(caught, angryAff);
      Stats.modVital('mood', angryMood);
      // 鞭刑特效（DialogueModal 演出）
      _playWhipPunishment({ captor: caught });
      addLog('【被抓包】' + rule.line, rule.color, true, true);
      addLog(`你以為沒人在——但你錯了。額外扣心情與好感。`, '#cc5533', true, false);
    } else {
      // 平安偷懶成功
      addLog('你找了個背風處窩著，沒人來。體力跟心情都回來了。', '#d4af37', false, false);
      // 獎勵一點額外恢復
      Stats.modVital('stamina', 5);
    }
  }

  // 🆕 D.26：訓練屬性徽章（左側彩色標籤）
  const _ATTR_BADGE_LABEL = {
    STR: '力量',
    AGI: '敏捷',
    CON: '體質',
    WIL: '意志',
    DEX: '靈巧',
  };
  function _getAttrBadgeHtml(act) {
    // 優先：有屬性訓練 → 顯示屬性徽章
    const attrKey = _getTrainedAttrKey(act);
    if (attrKey && _ATTR_BADGE_LABEL[attrKey]) {
      return `<span class="attr-badge attr-${attrKey}">${_ATTR_BADGE_LABEL[attrKey]}</span>`;
    }
    // 其次：純心情/休息類動作 → 顯示心情徽章
    const effs = act && act.effects;
    if (Array.isArray(effs)) {
      const moodEff = effs.find(e => e.type === 'vital' && e.key === 'mood' && e.delta > 0);
      if (moodEff) return `<span class="attr-badge attr-MOOD">心情</span>`;
    }
    return '';
  }

  // 🆕 D.28：計算這個訓練今天有誰會協力（名單 + 亮燈狀態）
  //   tier: 0 在場但未協力（灰）/ 1 ×1.3（綠）/ 2 ×1.6（藍）/ 3 ×1.8（紫）
  //   背景角鬥士 familiar → tier 1，否則 0
  function _computeSynergyRoster(attrKey) {
    if (!attrKey) return [];
    const roster = [];
    // 命名隊友（在場 + favoredAttr 匹配）
    const teamIds = Array.isArray(currentNPCs?.teammates) ? currentNPCs.teammates : [];
    teamIds.forEach(id => {
      const npc = teammates.getNPC(id);
      if (!npc || npc.favoredAttr !== attrKey) return;
      const aff = teammates.getAffection(id);
      let tier = 0;
      if      (aff >= 90) tier = 3;
      else if (aff >= 60) tier = 2;
      else if (aff >= 30) tier = 1;
      roster.push({ id, name: npc.name, tier, isBg: false });
    });
    // 背景角鬥士（今日有露面）
    if (typeof BackgroundGladiators !== 'undefined') {
      const bgActive = BackgroundGladiators.getActiveToday() || [];
      bgActive.forEach(bg => {
        if (bg.favoredAttr !== attrKey) return;
        const tier = BackgroundGladiators.isFamiliar(bg.id) ? 1 : 0;
        roster.push({ id: bg.id, name: bg.name, tier, isBg: true });
      });
    }
    return roster;
  }

  function _renderSynergyRosterHtml(attrKey) {
    const roster = _computeSynergyRoster(attrKey);
    if (roster.length === 0) return '';
    const tierMult = { 1: '1.3', 2: '1.6', 3: '1.8' };
    const icons = roster.map(r => {
      const cls   = `syn-t${r.tier}${r.isBg ? ' syn-bg' : ''}`;
      const title = r.tier === 0
        ? `${r.name}（尚未協力）`
        : `${r.name}（協力 ×${tierMult[r.tier]}）`;
      return `<span class="syn-icon ${cls}" title="${title}">👤</span>`;
    }).join('');
    return `<div class="action-synergy">${icons}</div>`;
  }

  /**
   * 訓練所加成倍率（預留接口，Phase 2 S2 實作）。
   * 未來會從 FACILITIES[id].trainingBonus 讀取。
   */
  function _getFacilityBonusMult(/* fieldId */) {
    return 1.0;
  }

  /**
   * 訓練場裝備等級倍率（預留接口，Phase 2 裝備系統實作）。
   * 未來會從訓練器械的等級（木樁/沙袋/鐵人）讀取。
   */
  function _getTrainingEquipmentMult(/* fieldId */) {
    return 1.0;
  }

  /**
   * 護符 / 特性 / 屬性 / 寵物加成的百分比加總（預留接口）。
   * 例：護符 +10% + 特性「磨礪」+5% + 寵物陪伴 +5% → return 0.2
   */
  function _getItemBonusPct(/* trainedAttr */) {
    return 0;
  }

  // ══════════════════════════════════════════════════
  // 🆕 D.28：梅拉抓老鼠任務已移至 quests/mela_rat_quest.js
  //   白天由 _tryMouseQuest() 呼叫 MelaRatQuest.tryOffer()
  //   夜晚由 _resolveNonTrainingSlots() 檢查 MelaRatQuest.hasPending() 播放
  //   舊三階段實作保留為 fallback（未載入新模組時啟用）
  // ══════════════════════════════════════════════════
  function _tryMouseQuest(trainedAttr) {
    if (typeof MelaRatQuest !== 'undefined' && typeof MelaRatQuest.tryOffer === 'function') {
      // 新系統：交給 quest 模組（第二次起 trainedAttr 是重試觸發條件）
      MelaRatQuest.tryOffer(trainedAttr);
      return;
    }
    // ── fallback（舊版實作，新模組沒載入才跑）─────────
    const p = Stats.player;
    if (typeof teammates === 'undefined') return;
    const melaPresent = [...(currentNPCs.audience || [])].includes('melaKook');
    if (!melaPresent) return;
    const melaAff = teammates.getAffection('melaKook');

    // 第 1 次：抓老鼠
    if (!Flags.has('mouse_quest_1') && melaAff >= 25 && Math.random() < 0.15) {
      Flags.set('mouse_quest_1', true);
      Flags.set('mouse_quest_1_day', p.day);

      DialogueModal.play([
        { text: '訓練結束後，梅拉攔住你。' },
        { speaker: '梅拉', text: '那個……我有件事想拜託你。' },
        { speaker: '梅拉', text: '廚房最近老鼠多得嚇人。我一個人抓不完。' },
        { speaker: '梅拉', text: '你……可以幫我嗎？' },
      ], {
        onComplete: () => {
          const agi = (typeof Stats.eff === 'function') ? Stats.eff('AGI') : (p.AGI || 10);
          ChoiceModal.show({
            id: 'mouse_quest_1',
            icon: '🐭',
            title: '廚房的老鼠',
            body: '梅拉用期待的眼神看著你。',
            forced: true,
            choices: [
              {
                id: 'catch_spare',
                label: '幫她抓，但放了那隻老鼠',
                hint: '你抓住了一隻特別靈活的小灰鼠。牠在你手裡掙扎。',
                effects: [
                  { type:'vital', key:'stamina', delta:-15 },
                  { type:'affection', key:'melaKook', delta:10 },
                  { type:'vital', key:'mood', delta:8 },
                  { type:'moral', axis:'mercy', side:'positive' },
                  { type:'flag', key:'mouse_spared' },
                ],
                resultLog: '你把那隻小灰鼠放在牆角。牠看了你一眼——然後跑了。梅拉沒注意到。',
                logColor: '#c8a878',
              },
              {
                id: 'catch_kill',
                label: '幫她抓，全部處理掉',
                hint: '徹底清理，梅拉會很感謝。',
                effects: [
                  { type:'vital', key:'stamina', delta:-15 },
                  { type:'affection', key:'melaKook', delta:8 },
                  { type:'vital', key:'mood', delta:5 },
                ],
                resultLog: '你把老鼠全處理了。梅拉很感謝。「謝謝你。廚房終於乾淨了。」',
                logColor: '#c8a878',
              },
              {
                id: 'refuse',
                label: '沒空',
                effects: [
                  { type:'affection', key:'melaKook', delta:-3 },
                ],
                resultLog: '梅拉沒說什麼，但眼神暗了一下。',
                logColor: '#8899aa',
              },
            ],
          });
        },
      });
      return;
    }

    // 第 2 次：老鼠又出現了（需要之前饒了牠）
    if (Flags.has('mouse_spared') && !Flags.has('mouse_quest_2')
        && p.day >= (Flags.get('mouse_quest_1_day', 0) || p.day) + 3
        && Math.random() < 0.20) {
      Flags.set('mouse_quest_2', true);
      Flags.set('mouse_quest_2_day', p.day);

      DialogueModal.play([
        { text: '訓練的時候你注意到腳邊有東西在動。' },
        { text: '是一隻小灰鼠。看起來……很眼熟。' },
        { text: '牠蹲在沙地邊緣看著你，沒有跑。' },
      ], {
        onComplete: () => {
          ChoiceModal.show({
            id: 'mouse_quest_2',
            icon: '🐭',
            title: '那隻老鼠又來了',
            body: '牠記得你。',
            forced: false,
            choices: [
              {
                id: 'feed',
                label: '給牠一點食物',
                hint: 'food -5',
                effects: [
                  { type:'vital', key:'food', delta:-5 },
                  { type:'flag', key:'mouse_fed_1' },
                  { type:'moral', axis:'mercy', side:'positive' },
                ],
                resultLog: '你掰了一小塊麵包放在地上。牠湊過來吃了。吃完牠抬頭看了你一眼——然後慢慢離開。這次走得比上次慢。',
                logColor: '#c8a878',
              },
              {
                id: 'ignore',
                label: '不理牠',
                resultLog: '你繼續訓練。牠蹲了一會兒，然後離開了。',
                logColor: '#8899aa',
              },
            ],
          });
        },
      });
      return;
    }

    // 第 3 次：牠自己跑來了（需要餵過）
    if (Flags.has('mouse_fed_1') && !Flags.has('mouse_quest_3')
        && p.day >= (Flags.get('mouse_quest_2_day', 0) || p.day) + 2
        && Math.random() < 0.25) {
      Flags.set('mouse_quest_3', true);

      DialogueModal.play([
        { text: '你坐下來休息的時候，有什麼東西爬上了你的腳。' },
        { text: '是牠。那隻小灰鼠。' },
        { text: '牠沒有跑。牠蹭了蹭你的鞋。' },
        { text: '然後抬起頭，用那雙黑豆似的眼睛看著你。' },
      ], {
        onComplete: () => {
          ChoiceModal.show({
            id: 'mouse_quest_3',
            icon: '🐭',
            title: '牠不走了',
            body: '牠在等你做決定。',
            forced: false,
            choices: [
              {
                id: 'keep',
                label: '餵牠，讓牠留下',
                hint: 'food -5 · 獲得寵物「小灰」',
                effects: [
                  { type:'vital', key:'food', delta:-5 },
                  { type:'vital', key:'mood', delta:15 },
                  { type:'moral', axis:'mercy', side:'positive' },
                  { type:'flag', key:'pet_mouse_acquired' },
                ],
                resultLog: '你掰了一塊麵包。牠吃完，然後——爬上了你的肩膀。牠不走了。你叫牠「小灰」。',
                logColor: '#d9c28f',
              },
              {
                id: 'shoo',
                label: '趕走牠',
                resultLog: '你輕輕推了牠一下。牠看了你最後一眼，慢慢離開。你覺得有什麼東西輕輕刺了一下。',
                logColor: '#8899aa',
              },
            ],
          }, {
            onChoose: (choiceId) => {
              if (choiceId === 'keep') {
                // 🆕 寵物系統啟動
                p.pets = p.pets || { companion: null, cell: null, outside: null };
                p.pets.cell = { id: 'mouse_grey', name: '小灰', type: 'mouse', dayAcquired: p.day };
                addLog('🐭 小灰成為了你的夥伴。', '#d9c28f', true, true);
                if (typeof SoundManager !== 'undefined') SoundManager.playSynth('level_up');
                renderAll();
              }
            },
          });
        },
      });
      return;
    }
  }

  // 🗑️ 2026-04-23：舊 _tryHectorHarassment + clearHectorHarass 搬到
  //     src/npc/hector_events.js（依 hector_friendly_path / hector_hostile_path 分岔）

  // 🆕 2026-04-19 傷勢每日推進（自癒 / 自然癒合檢查）
  DayCycle.onDayStart('woundsDailyTick', () => {
    if (typeof Wounds !== 'undefined' && Wounds.onDayStart) {
      try { Wounds.onDayStart(); } catch (e) { console.error('[Wounds]', e); }
    }
    // 累加密醫暗示後的天數（用於 Stage 3 觸發）
    if (typeof Flags !== 'undefined' && Flags.has('doctor_hinted_black_doc') && !Flags.has('got_black_doc_contact')) {
      Flags.increment('days_since_black_doc_hint', 1);
    }
  }, 15);

  // 🗑️ 2026-04-23：舊 hectorDay8（撞肩試探）/ hectorDay15（賣情報）已廢棄
  //     改為 hector_events.js 的笑臉/臭臉雙路線：
  //       - Day 8 撞肩 → § 5.2 仇恨撞擊（aff ≤ -30 觸發，Phase 2）
  //       - Day 15 賣情報 → § 4.3 莫拉斯對打前觸發（Phase 2）
  //     Phase 1 暫不接，Phase 2 在 hector_events.js 補。

  // 赫克托 Day 40 受傷（你可以選擇救不救）
  DayCycle.onDayStart('hectorDay40', (newDay) => {
    if (newDay !== 40 || Flags.has('hector_day40_done')) return;
    if (Flags.has('hector_dead')) return;
    Flags.set('hector_day40_done', true);

    _pendingDialogues.push({
      id: 'hector_day40_injury',
      lines: [
        { text: '訓練場中央——有人倒在地上。' },
        { text: '是赫克托。他被烏爾薩狠狠摔了一下，動作不對勁。' },
        { text: '沒人走過去。每個人都在看，但每個人都繼續訓練。' },
        { text: '你站在那裡。沒人會責怪你不幫。' },
      ],
      onComplete: () => {
        ChoiceModal.show({
          id: 'hector_day40',
          icon: '🩸',
          title: '赫克托倒在地上',
          body: '他抬頭看你。沒有央求的意思。只是看。',
          forced: true,
          choices: [
            {
              id: 'help',
              label: '過去扶他',
              hint: '不是因為他值得——是因為你不想變成他那種人。',
              effects: [
                { type:'affection', key:'hector', delta:25 },
                { type:'vital', key:'stamina', delta:-10 },
                { type:'moral', axis:'mercy', side:'positive' },
                { type:'flag', key:'helped_hector' },
              ],
              resultLog: '你把他扶起來，送到醫療房。一路上他沒說話。到了門口他才開口：「我不會忘。」你不知道這是承諾還是威脅。',
              logColor: '#c8a060',
            },
            {
              id: 'call_doctor',
              label: '叫醫生',
              hint: '你不碰他，但也不會讓他死在這裡。',
              effects: [
                { type:'affection', key:'hector', delta:10 },
                { type:'affection', key:'doctorMo', delta:3 },
                { type:'moral', axis:'mercy', side:'positive' },
              ],
              resultLog: '你跑去叫老默。老默看了赫克托一眼。「嗯。」他處理了。赫克托後來找你：「謝了。雖然不是你親自做的——但你做了。」',
              logColor: '#c8a060',
            },
            {
              id: 'ignore',
              label: '繼續訓練',
              hint: '他害過你。你不欠他。',
              effects: [
                { type:'affection', key:'hector', delta:-20 },
                { type:'moral', axis:'mercy', side:'negative' },
              ],
              resultLog: '你轉過身繼續訓練。餘光瞥見赫克托慢慢爬起來，拖著腳走了。那天之後他看你的眼神變了——不是恨，是「記住了」。',
              logColor: '#8899aa',
            },
          ],
        });
      },
    });
  }, 26);

  // 🗑️ 2026-04-23：舊 hectorFestival（Day 25 秋祭嫁禍）已廢棄
  //     改為 hector_events.js § 5.4 嫁禍事件（臭臉路線、aff ≤ -20、Day ≥ 20、移除 day25_done 依賴）
  //     Phase 3 在 hector_events.js 補（含「痛扁他」私戰選項）。

  /**
   * 🆕 2026-04-24：旁觀切磋小事件（補體力 / 對沖懲罰）
   *   觸發條件：
   *     - p.day >= 3（避開 Day 1-2 開場）
   *     - 場上 ≥ 2 個隊友（除了主角）
   *     - p.stamina < staminaMax × 0.65（疲倦時才合理）
   *     - 今天還沒觸發（flag spectate_done_today）
   *     - 12% 機率/天
   *   效果：stamina +25 / mood +5（旁觀學習，不消耗時段）
   *   敘述：依參戰兩個 NPC 抽不同對白；卡西烏斯/赫克托/奧蘭/索爾各有風格
   */
  function _trySpectateSparring() {
    const p = Stats.player;
    if (!p || p.day < 3) return;
    if (typeof Flags === 'undefined') return;
    if (Flags.has('spectate_done_today')) return;

    // 疲倦時才觸發（避免滿體力玩家還拿白送 stamina）
    const staminaRatio = (p.stamina || 0) / Math.max(1, p.staminaMax || 100);
    if (staminaRatio >= 0.65) return;

    // 場上要有 ≥ 2 個隊友（除了主角）
    const teammates_ = Array.isArray(currentNPCs?.teammates) ? currentNPCs.teammates : [];
    const fighters = teammates_.filter(id => {
      // 主角不算（一般 currentNPCs.teammates 不含主角，但保險）
      if (id === 'player') return false;
      const npc = (typeof teammates !== 'undefined') ? teammates.getNPC(id) : null;
      return npc && npc.alive !== false;
    });
    if (fighters.length < 2) return;

    if (Math.random() >= 0.12) return;

    Flags.set('spectate_done_today', true);

    // 隨機抽兩個對打者
    const shuffled = [...fighters].sort(() => Math.random() - 0.5);
    const a = shuffled[0];
    const b = shuffled[1];

    const NAME = (id) => {
      const npc = teammates.getNPC(id);
      return npc ? (npc.name || id) : id;
    };

    // 對白：依參戰者組合給不同氣氛
    //   有卡西烏斯 → 老兵風格
    //   有赫克托 → 油條觀戰
    //   有奧蘭 → 兄弟切磋
    //   其他 → 通用
    let lines;
    if (a === 'cassius' || b === 'cassius') {
      const opponent = (a === 'cassius') ? b : a;
      lines = [
        { text: '訓練場中央。塔倫長官把你們圈起來。' },
        { speaker: '塔倫長官', text: `${NAME('cassius')}、${NAME(opponent)}——上場。其他人看好。` },
        { text: '（卡西烏斯走過你身邊，低聲說：）' },
        { speaker: '卡西烏斯', text: '看我換劍的時機。記著。' },
        { text: '（兩人持木劍對峙。一交手——卡西烏斯的腳步像沒動過，但對方已經被逼到圈外。）' },
        { text: '（你坐在沙地上，肩膀放鬆下來。沒人罵你不練。）' },
        { text: '（這比訓練本身還有用。）' },
      ];
    } else if (a === 'hector' || b === 'hector') {
      const opponent = (a === 'hector') ? b : a;
      lines = [
        { text: '訓練場上一陣騷動——赫克托被點名了。' },
        { speaker: '塔倫長官', text: `${NAME('hector')}、${NAME(opponent)}——上場。` },
        { text: '（赫克托走過你身邊，眨了眨眼。）' },
        { speaker: '赫克特', text: '坐下來。看戲。' },
        { text: '（他的木劍揮得花俏，但實打的兩下都很狠。對方很快被壓在地。）' },
        { text: '（赫克托收劍時，故意讓對手喘了一口氣才補上。）' },
        { text: '（你坐著休息——這節省下來的力氣，正好。）' },
      ];
    } else if (a === 'orlan' || b === 'orlan') {
      const opponent = (a === 'orlan') ? b : a;
      lines = [
        { text: '訓練後段。塔倫長官隨手點了名。' },
        { speaker: '塔倫長官', text: `${NAME('orlan')}、${NAME(opponent)}——你們兩個。` },
        { text: '（奧蘭緊張地看了你一眼。）' },
        { speaker: '奧蘭', text: '⋯⋯你看著就好，等我下來。' },
        { text: '（他打得不好——但他撐住了好幾下。對方最後還是把他壓倒。）' },
        { text: '（你在旁邊喘口氣。等下換你扶他起來。）' },
      ];
    } else {
      lines = [
        { text: '訓練場中央。塔倫長官把兩個人圈起來。' },
        { speaker: '塔倫長官', text: `${NAME(a)}、${NAME(b)}——上場。其他人看好。` },
        { text: '（兩人持木劍對峙。一上來就纏鬥起來。）' },
        { text: '（你坐在沙地邊。沒人在看你練不練。）' },
        { text: '（你可以喘口氣了。）' },
      ];
    }

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => {
          Stats.modVital('stamina', 25);
          Stats.modVital('mood', 5);
          addLog('🛡 你旁觀了一場切磋。沒人在意你站在哪。（⚡ +25 · 💭 +5）', '#88aacc', true, true);
          if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
        },
      });
    } else {
      Stats.modVital('stamina', 25);
      Stats.modVital('mood', 5);
      addLog('🛡 你旁觀了一場切磋，喘了口氣。', '#88aacc', true, true);
    }
  }

  // 每日清「今日已旁觀」flag
  DayCycle.onDayStart('clearSpectateDaily', () => {
    if (typeof Flags !== 'undefined') Flags.unset('spectate_done_today');
  }, 19);

  /**
   * 🆕 D.21 Option A：奧蘭藥房懸念觸發
   * 條件：
   *   - Day >= 8（給玩家先熟悉角色）
   *   - 未觸發過
   *   - 8% 機率
   *   - 奧蘭還活著
   * 效果：
   *   - 設 flag saw_olan_at_apothecary（MorningThoughts 隔日會 pick up）
   *   - 紀錄看到的那天
   *   - log 短敘述
   */
  function _tryOrlanApothecarySighting() {
    const p = Stats.player;
    if (!p || p.day < 8) return;
    if (typeof Flags === 'undefined') return;
    if (Flags.has('saw_olan_at_apothecary')) return;
    if (Flags.has('orlan_dead') || Flags.has('betrayed_olan')) return;
    if (Math.random() >= 0.08) return;

    Flags.set('saw_olan_at_apothecary');
    Flags.set('olan_apothecary_seen_day', p.day);

    addLog('—————————————————————', '#444', false);
    addLog('訓練結束回走廊的路上，你經過醫療房前。', '#9a8c6a', false);
    addLog('一個熟悉的身影閃了一下——是奧蘭。他看見你，慌張地擺手示意你別過來，然後消失在門後。', '#9a8c6a', true, false);
    addLog('—————————————————————', '#444', false);
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
        // 🆕 D.28：夜間事件窗口 — 優先級鏈
        //   1. 主線任務（抓老鼠 / 未來約會等）
        //   2. 正常靠牆恢復
        //   🗑️ 2026-04-24：舊強迫症補做彈窗廢除（狂熱系統取代，不需夜間補做）
        if (typeof MelaRatQuest !== 'undefined' && MelaRatQuest.hasPending && MelaRatQuest.hasPending()) {
          MelaRatQuest.playTonight();
          // 任務開始後 advance time 照常，任務內部會處理 flag
        } else {
          // 沒任務 → 走原本的靠牆恢復
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
      }

      Stats.advanceTime(SLOT_DUR);
      if (Stats.player.day > p.day) break;
    }

    // 🆕 Phase 1-E.2: 時段解算完後檢查飢餓危機（食物 ≤ 14 觸發選擇 modal）
    _checkHungerCritical();
  }

  /** 🆕 Phase 1-E.2: 飢餓臨界觸發 —— 食物 ≤ 14 且當日未觸發過就彈出 ChoiceModal */
  function _checkHungerCritical() {
    const p = Stats.player;
    if (p.food > 14) return;
    const dayKey = `hunger_critical_day_${p.day}`;
    if (Flags.has(dayKey)) return;
    if (typeof ChoiceModal === 'undefined' || typeof Events === 'undefined' || !Events.CHOICE_EVENTS) return;
    const ev = Events.CHOICE_EVENTS.hunger_critical;
    if (!ev) return;
    Flags.set(dayKey, true);
    ChoiceModal.show(ev);
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
  // 🆕 Phase 1 重構：訓練場是唯一場景，不再顯示場地切換 UI
  // 場景品質（豪華房間/破舊牢房）改為休息事件的敘事描述
  function renderLocationTabs() {
    const con = document.getElementById('location-tabs');
    if (!con) return;
    con.innerHTML = '';      // 完全清空，CSS 會將容器隱藏
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
    // 🆕 Phase 1-J.2: rest 的 fields 已是 'any'，會被 getFieldActions 自動包進列表，
    //                 不再需要手動 append ACTIONS.rest（修正雙重顯示）。
    const allActs = getFieldActions(currentFieldId, p, npcs)
      .filter(act => !act.hiddenFromList);

    // 🆕 D.26：偷懶類動作排到最後（讓訓練類排上面）
    allActs.sort((a, b) => {
      const aSlack = a._isSlacking ? 1 : 0;
      const bSlack = b._isSlacking ? 1 : 0;
      return aSlack - bSlack;
    });

    allActs.forEach(act => {
      const noStamina = p.stamina < act.staminaCost;
      const noFood    = (act.foodCost || 0) > 0 && p.food < act.foodCost;
      const noSlots   = act.slots > sLeft;
      const disabled  = noStamina || noFood || noSlots;
      const reason    = noSlots ? '時間不足' : noStamina ? '體力不足' : noFood ? '飽食不足' : '';

      // 🆕 預估實際體力消耗（含協力加成）
      let previewStaminaCost = act.staminaCost;
      if (act.staminaCost > 0 && (act.effects || []).some(e => e.type === 'exp' || e.type === 'attr')) {
        const tAttr = _getTrainedAttrKey(act);
        let sAdd = 0;
        if (tAttr) {
          (currentNPCs.teammates || []).forEach(nid => {
            const npc = teammates.getNPC(nid);
            if (!npc || npc.favoredAttr !== tAttr) return;
            const a = teammates.getAffection(nid);
            if      (a >= 90) sAdd += 0.7;
            else if (a >= 60) sAdd += 0.5;
            else if (a >= 30) sAdd += 0.3;
          });
          if (typeof BackgroundGladiators !== 'undefined') {
            BackgroundGladiators.getActiveToday().forEach(bg => {
              if (bg.favoredAttr !== tAttr) return;
              if (BackgroundGladiators.isFamiliar(bg.id)) sAdd += 0.2;
            });
          }
        }
        previewStaminaCost = Math.round(act.staminaCost * (1 + sAdd));
      }

      const costs = [`⏱${act.slots * 2}小時`];
      // 🆕 D.26：體力顯示 +/- 區分消耗/恢復
      const staminaRecovery = (act.effects || [])
        .filter(e => e.type === 'vital' && e.key === 'stamina' && e.delta > 0)
        .reduce((sum, e) => sum + e.delta, 0);
      const netStamina = staminaRecovery - previewStaminaCost;
      if (netStamina < 0) {
        const synergy = previewStaminaCost > act.staminaCost;
        costs.push(synergy ? `⚡${netStamina}（協力）` : `⚡${netStamina}`);
      } else if (netStamina > 0) {
        costs.push(`⚡+${netStamina}`);
      }
      if ((act.foodCost || 0) > 0) costs.push(`🍖-${act.foodCost}`);
      // 🆕 D.26：顯示心情變動
      const moodDelta = (act.effects || [])
        .filter(e => e.type === 'vital' && e.key === 'mood')
        .reduce((sum, e) => sum + e.delta, 0);
      if (moodDelta !== 0) {
        const sign = moodDelta > 0 ? '+' : '';
        costs.push(`💭${sign}${moodDelta}`);
      }

      // 🆕 受傷率預估（用實際消耗計算）
      let injuryHint = '';
      if (previewStaminaCost > 0 && (act.effects || []).some(e => e.type === 'exp' || e.type === 'attr')) {
        const ratio = previewStaminaCost / Math.max(1, p.stamina);
        let risk = 0.05;
        if      (ratio >= 2.0) risk += 0.50;
        else if (ratio >= 1.5) risk += 0.35;
        else if (ratio >= 1.0) risk += 0.20;
        else if (ratio >= 0.7) risk += 0.08;
        if (p.stamina <= 20) risk += 0.05;
        risk = Math.min(0.85, risk);

        if (risk >= 0.30) {
          injuryHint = ' <span class="injury-warn injury-high" title="受傷風險高">⚠</span>';
        } else if (risk >= 0.10) {
          injuryHint = ' <span class="injury-warn injury-mid" title="有受傷風險">⚠</span>';
        }
      }

      const costStr  = costs.join(' · ');
      // 🆕 D.28：移除「體力不足/時間不足」文字 — disabled 狀態已夠明顯，
      //         改用 button title 讓懸停仍看得見原因
      const titleAttr = reason ? `title="${reason}"` : '';
      const clickStr = disabled ? '' : `onclick="Game.doAction('${act.id}')"`;

      // 🆕 D.26：訓練屬性徽章（左側彩色標籤）
      const badgeHtml = _getAttrBadgeHtml(act);
      // 🆕 D.28：協力名單（今日在場的對應屬性 NPC）→ 擺在名字右側，省垂直空間
      const synergyAttr = _getTrainedAttrKey(act);
      const synergyHtml = _renderSynergyRosterHtml(synergyAttr);

      // 🆕 2026-04-24：狂熱期間訓練按鈕視覺強化
      //   對應狂熱屬性 → fervor-active（放大發光閃爍 + ⚡ icon）
      //   其他訓練 → fervor-dimmed（縮小變灰）
      let fervorClass = '';
      let fervorIcon = '';
      if (typeof Fervor !== 'undefined' && Fervor.isActive && Fervor.isActive()) {
        const activeAttr = Fervor.activeAttr();
        if (synergyAttr === activeAttr) {
          fervorClass = ' action-btn-fervor-active';
          fervorIcon  = '<span class="action-fervor-icon">⚡</span>';
        } else if (synergyAttr) {
          // 只 dim 其他訓練動作（休息/事件動作不 dim）
          fervorClass = ' action-btn-fervor-dimmed';
        }
      }

      html += `<button class="action-btn${fervorClass}" ${titleAttr} ${disabled ? 'disabled' : clickStr}>
        <div class="action-name">${badgeHtml}${fervorIcon}<span class="action-title">${act.name}${injuryHint}</span>${synergyHtml}</div>
        <div class="action-cost">${costStr}</div>
      </button>`;
    });

    // Sleep button always at bottom
    html += `<button class="action-btn-sleep" onclick="Game.doAction('_sleep')" style="margin-top:8px;">就寢・結束今天</button>`;
    con.innerHTML = html;
  }

  // ── Execute action ─────────────────────────────────────
  // 🆕 Stage/對話動畫中禁止操作
  let _uiLocked = false;

  function doAction(actionId) {
    // 🆕 動畫播放中 → 禁止操作
    if (_uiLocked) return;
    if (typeof DialogueModal !== 'undefined' && DialogueModal.isOpen()) return;
    // 🆕 D.28：戰鬥中禁止觸發其他動作
    if (typeof Battle !== 'undefined' && Battle.isActive && Battle.isActive()) return;

    const p = Stats.player;

    // Special: end-of-day sleep
    if (actionId === '_sleep') {
      // 🆕 2026-04-27 睡前先試三杯賭博（12% 機率、5 天 cd）
      //   有觸發 → 賭博啟動、玩家完成後再點睡才真的睡
      //   沒觸發 → 直接睡
      if (typeof GamblingQuest !== 'undefined' && GamblingQuest.tryNightOffer) {
        if (GamblingQuest.tryNightOffer()) {
          return;   // 賭博啟動、暫停睡覺
        }
      }
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
    // 🆕 D.6: 訓練動作現在用 type:'exp'；舊 type:'attr' 仍相容（soloThink/writeMemory 等個人動作）
    const hasAttrEffect = (act.effects || []).some(e => e.type === 'attr' || e.type === 'exp');
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

      // ── 🆕 2026-04-19：傷勢「好痛」觸發檢查 ──
      const trainingAttr = (act.effects || []).find(e => (e.type === 'attr' || e.type === 'exp'))?.key;
      if (trainingAttr && typeof Wounds !== 'undefined') {
        const painResult = Wounds.checkTrainingPain(trainingAttr);
        if (painResult && painResult.painTriggered) {
          // 訓練失敗：扣時間 + 扣體力，不得 EXP
          Stats.modVital('stamina', -act.staminaCost);
          if (act.foodCost) Stats.modVital('food', -act.foodCost);
          Stats.advanceTime(act.slots * SLOT_DUR);
          _resolveNonTrainingSlots();
          autoSave('action');
          renderAll();
          return;
        }

        // ── 🆕 低體力訓練時擲新傷勢 ──
        Wounds.rollLowStaminaInjury(trainingAttr);
      }
    }

    // ══════════════════════════════════════════════════
    // 🆕 Phase 1-E: 閾值軟修正（Soft-modify，影響訓練效率）
    // ══════════════════════════════════════════════════
    let thresholdMult = 1.0;
    let thresholdDesc = '';

    if (isTraining) {
      // 🆕 WIL Tier 1：意志力影響訓練品質
      //   WIL 高 → 更容易心流、更不容易擺爛
      //   公式：心流機率 +WIL×0.5%、擺爛機率 −WIL×0.3%
      const wil = (typeof Stats.eff === 'function') ? Stats.eff('WIL') : (p.WIL || 10);
      const wilFlowBonus    = wil * 0.005;   // WIL 20 = +10%
      const wilSlackerReduc = wil * 0.003;   // WIL 20 = -6%

      // mood_flow：心情 ≥ 80，(40% + WIL 加成) 機率進入心流（×1.5）
      const flowChance = Math.min(0.80, 0.40 + wilFlowBonus);
      if (p.mood >= 80 && Math.random() < flowChance) {
        thresholdMult *= 1.5;
        addLog('✨ 你的腦子出奇地清醒，每個動作都流暢到讓人不敢置信——你進入了心流。', '#ffe866', false);
        thresholdDesc += '（心流 ×1.5）';
      }
      // training_slacker：體力 ≤ 25，(25% − WIL 抵抗) 機率擺爛（×0.4）
      const slackerChance = Math.max(0.05, 0.25 - wilSlackerReduc);
      if (p.stamina <= 25 && Math.random() < slackerChance) {
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

      // ── 🆕 2026-04-19：傷勢對訓練 EXP 的影響 ──
      const trainingAttr2 = (act.effects || []).find(e => (e.type === 'attr' || e.type === 'exp'))?.key;
      if (trainingAttr2 && typeof Wounds !== 'undefined') {
        const expDec = Wounds.getTrainExpMultDec(trainingAttr2);
        if (expDec > 0) {
          thresholdMult *= (1 - expDec);
          thresholdDesc += `（帶傷 ×${(1 - expDec).toFixed(2)}）`;
        }
      }

      // ── 🆕 2026-04-19：見識訓練 EXP 加成 ──
      if (typeof Stats.getDiscernmentExpMult === 'function') {
        const dMult = Stats.getDiscernmentExpMult();
        if (dMult > 1.0) {
          thresholdMult *= dMult;
          thresholdDesc += `（見識 ×${dMult.toFixed(2)}）`;
        }
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

    // ══════════════════════════════════════════════════
    // 🆕 D.18 訓練協力總公式（取代 D.8c 簡化版）
    // ══════════════════════════════════════════════════
    // 公式：
    //   base × mood × 裝備 × (1+護符/特性/屬性/寵物加成) × 訓練所
    //       × ∏(命名協力) × ∏(背景協力) × (1 + 0.08 × 總人數)
    //   最終 clamp 至 ×15（mood 在 dispatcher 外層另外算，故不納入 cap）
    //
    // - 命名 NPC：favoredAttr 匹配才生效，三段 aff≥30/60/90 → ×1.3/1.6/1.8
    // - 背景 NPC：favoredAttr 匹配且熟悉度 ≥40 → ×1.3（單段）
    // - 人多熱鬧：無單獨上限，但會被 ×15 總 cap 蓋住
    // - 裝備/護符/訓練所加成：預留欄位，目前為 1.0
    const trainedAttr = _getTrainedAttrKey(act);
    const bgActive    = (typeof BackgroundGladiators !== 'undefined')
                          ? BackgroundGladiators.getActiveToday()
                          : [];
    let synergyMult = 1.0;
    let partnerCount = 0;       // 命名隊友數（保留給體力消耗/受傷邏輯）
    let storyNpcMult = 1.0;
    let bgNpcMult    = 1.0;

    if (hasAttrEffect) {
      // ── 命名隊友協力（三段門檻，需 favoredAttr 匹配） ──
      (currentNPCs.teammates || []).forEach(npcId => {
        if (!npcId) return;
        const npc = teammates.getNPC(npcId);
        if (!npc) return;
        const aff = teammates.getAffection(npcId);
        // partnerCount 用舊規則：只要 aff≥30 就算參與一起訓練（影響體力消耗）
        if (aff >= 30) partnerCount++;
        // 協力加成：必須 favoredAttr 匹配
        if (!trainedAttr || npc.favoredAttr !== trainedAttr) return;
        if      (aff >= 90) storyNpcMult *= 1.8;
        else if (aff >= 60) storyNpcMult *= 1.6;
        else if (aff >= 30) storyNpcMult *= 1.3;
      });

      // 🆕 2026-04-27 recruit 協力（aff 三段門檻、跟命名 NPC 同邏輯但弱化）
      //   aff < 30：無協力、暗色
      //   aff 30：×1.2（綠光）
      //   aff 60：×1.3（強綠光）
      //   aff 90：×1.5（金光閃爍）
      if (typeof RecruitPool !== 'undefined' && RecruitPool.getActiveByAttr && trainedAttr) {
        const recruitGroups = RecruitPool.getActiveByAttr();
        const matched = recruitGroups[trainedAttr] || [];
        matched.forEach(r => {
          if (r.alive === false) return;
          const aff = (typeof teammates !== 'undefined' && teammates.getAffection)
                        ? teammates.getAffection(r.id) : 0;
          if      (aff >= 90) { storyNpcMult *= 1.5; partnerCount++; }
          else if (aff >= 60) { storyNpcMult *= 1.3; partnerCount++; }
          else if (aff >= 30) { storyNpcMult *= 1.2; partnerCount++; }
          // aff < 30 = 不協力（純在場、無加成）
        });
      }

      // ── 背景角鬥士協力（單段 pass/no-pass） ──
      if (trainedAttr && bgActive.length > 0) {
        bgActive.forEach(bg => {
          if (bg.favoredAttr !== trainedAttr) return;
          if (BackgroundGladiators.isFamiliar(bg.id)) {
            bgNpcMult *= BackgroundGladiators.SYNERGY_MULT;
          }
        });
      }

      // ── 其他加成（預留欄位，接口就位） ──
      const facilityMult      = _getFacilityBonusMult(currentFieldId);        // 訓練所加成（暫 1.0）
      const equipmentMult     = _getTrainingEquipmentMult(currentFieldId);    // 訓練場裝備等級（暫 1.0）
      const itemBonusPct      = _getItemBonusPct(trainedAttr);                // 護符/特性/屬性/寵物加成百分比（暫 0）
      const itemMult          = 1 + itemBonusPct;

      // ── 人多熱鬧（命名 + 背景 + 觀眾都算）──
      const audienceCount = (currentNPCs.audience || []).length;
      const totalCrowd    = (currentNPCs.teammates || []).length + bgActive.length + audienceCount;
      const crowdMult     = 1 + 0.08 * totalCrowd;   // 無單獨上限

      // ── 乘積（不含 mood，mood 由 dispatcher 另外乘）──
      synergyMult = equipmentMult * itemMult * facilityMult * storyNpcMult * bgNpcMult * crowdMult;

      // ── ×15 硬上限（D.18）──
      if (synergyMult > 15) synergyMult = 15;
    }

    // 🆕 協力體力消耗（動態・依關係深度）
    //   命名 NPC：aff≥30 +0.3 / aff≥60 +0.5 / aff≥90 +0.7（需 favoredAttr 匹配）
    //   背景夥伴：熟悉 + 匹配 → +0.2
    //   目標：滿協力（3 story aff90 + 3 bg）= ×3.7 → 20×3.7 = 74（≈ 體力 60-75%）
    //   一天最多練 1~2 次，第 3 次 = 95% 受傷
    let staminaSynergyAdd = 0;
    if (hasAttrEffect && act.staminaCost > 0) {
      (currentNPCs.teammates || []).forEach(npcId => {
        if (!npcId) return;
        const npc = teammates.getNPC(npcId);
        if (!npc || !trainedAttr || npc.favoredAttr !== trainedAttr) return;
        const aff = teammates.getAffection(npcId);
        if      (aff >= 90) staminaSynergyAdd += 0.7;
        else if (aff >= 60) staminaSynergyAdd += 0.5;
        else if (aff >= 30) staminaSynergyAdd += 0.3;
      });
      if (trainedAttr) {
        bgActive.forEach(bg => {
          if (bg.favoredAttr !== trainedAttr) return;
          if (BackgroundGladiators.isFamiliar(bg.id)) staminaSynergyAdd += 0.2;
        });
      }
    }
    const staminaMult = 1 + staminaSynergyAdd;
    const effectiveStaminaCost = hasAttrEffect
      ? Math.round(act.staminaCost * staminaMult)
      : act.staminaCost;

    // 記錄扣除前的體力（受傷計算用）
    const staminaBefore = p.stamina;

    // Deduct costs（使用有效消耗值）
    if (effectiveStaminaCost > 0) Stats.modVital('stamina', -effectiveStaminaCost);
    if ((act.foodCost || 0) > 0) Stats.modVital('food', -act.foodCost);

    // 🆕 2026-04-24 狂熱（Fervor）效果（訓練動作才生效）
    //   練對 → mood +5 / 額外 stamina -5
    //   練錯 → mood -5 / 15% 擺爛（EXP ×0.5，由 effect_dispatcher 處理）
    let fervorSlackHit = false;
    if (hasAttrEffect && trainedAttr && typeof Fervor !== 'undefined' && Fervor.isActive()) {
      const moodDelta = Fervor.getMoodDelta(trainedAttr);
      if (moodDelta !== 0) Stats.modVital('mood', moodDelta);
      const extraStam = Fervor.getExtraStaminaCost(trainedAttr);
      if (extraStam > 0) Stats.modVital('stamina', -extraStam);
      // 擺爛擲骰（吐槽依「狂熱屬性 × 玩家正在做的錯誤訓練」對照）
      if (Math.random() < Fervor.getSlackChance(trainedAttr)) {
        fervorSlackHit = true;
        const line = Fervor.getSlackLine(trainedAttr);
        if (line) addLog(line, '#8899aa', true, false);
      }
    }

    // 🆕 D.1.9: 統一效果處理器
    // 🆕 Phase 1-E: thresholdMult（心流/擺爛/飢餓）折入 synergyMult 一起傳入
    const finalSynergyMult = synergyMult * thresholdMult;

    Effects.apply(act.effects || [], {
      moodMult,
      synergyMult: finalSynergyMult,
      currentNPCs,
      source: 'action:' + actionId,
      fervorSlackHit,   // 讓 effect_dispatcher 把 EXP ×0.5
    });
    // 🆕 D.6 v2：訓練只累積 EXP，不自動升級。升級請到角色頁手動花 EXP。

    // 🆕 2026-04-19 訓練成功跳 EXP emoji 特效（依實際 gain 計算數量/大小）
    if (hasAttrEffect) {
      const fervorMult = (typeof Fervor !== 'undefined' && Fervor.getExpMultiplier && trainedAttr)
                           ? Fervor.getExpMultiplier(trainedAttr) : 1.0;
      const slackMult  = fervorSlackHit ? 0.5 : 1.0;
      (act.effects || []).forEach(eff => {
        if ((eff.type === 'exp' || eff.type === 'attr') && eff.key && typeof eff.delta === 'number' && eff.delta > 0) {
          const finalGain = eff.delta * finalSynergyMult * moodMult * fervorMult * slackMult;
          _showExpEmoji(eff.key, finalGain);
        }
      });
    }

    // 🆕 2026-04-24 狂熱：訓練後記錄 + 觸發檢查（取代舊 Compulsion.onTraining）
    if (hasAttrEffect && trainedAttr && typeof Fervor !== 'undefined') {
      try { Fervor.onTraining(trainedAttr); } catch (e) { console.error('[Fervor]', e); }
    }

    // 🆕 D.26：偷懶放空的動態代價（在場扣好感 / 無人時 30% 被抓）
    if (act._isSlacking) _handleSlacking();

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
      if (eff.type === 'exp') {
        const actual = Math.round(eff.delta * finalSynergyMult * moodMult);
        return `${eff.key} EXP+${actual}`;
      }
      if (eff.type === 'vital')     return `${eff.key}${eff.delta > 0 ? '+' : ''}${eff.delta}`;
      if (eff.type === 'affection') return `${eff.key}好感${eff.delta > 0 ? '+' : ''}${eff.delta}`;
      return '';
    }).filter(Boolean).join(' · ');
    const extraDesc = [moodDesc, thresholdDesc].filter(Boolean).join(' ');
    addLog(`【${act.name}】${gainSummary ? '　' + gainSummary : ''}${extraDesc ? '　' + extraDesc : ''}`, '#c8a060', false);

    // 🆕 D.22b：訓練音效
    if (hasAttrEffect && typeof SoundManager !== 'undefined') {
      SoundManager.playSynth('sword_swing');
    }

    // ── 協力爆擊日誌（D.8c）─────────────────────────
    if (hasAttrEffect && synergyMult > 1.0) {
      // 🆕 D.28：標記協力發生過 → 讓 tutorial_hints 能觸發卡西烏斯的提示
      if (typeof TutorialHints !== 'undefined' && TutorialHints.markSynergyHappened) {
        TutorialHints.markSynergyHappened();
      }
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

    // 🆕 D.18：訓練時累積背景角鬥士的熟悉度 + 碎念/協力吶喊
    if (hasAttrEffect && typeof BackgroundGladiators !== 'undefined') {
      const newPartners = BackgroundGladiators.bumpOnTraining();
      // 🆕 剛成為夥伴的背景角鬥士跳出來打招呼
      if (newPartners.length > 0) {
        newPartners.forEach(bgId => {
          const bg = BackgroundGladiators.get(bgId);
          if (!bg) return;
          const greeting = BackgroundGladiators.getPartnerGreeting();
          addLog(`「${greeting}」——${bg.name}`, '#d9c28f', true, true);
        });
      }
      // 🆕 D.28：碎念改為在 NPC 名字旁邊跳小泡泡（不吃 log 空間，不擋觀眾）
      if (Math.random() < 0.70) {
        const m = BackgroundGladiators.getMumble();
        if (m && m.id) {
          const cls = (m.isGossip || m.isSignature) ? 'bb-gossip' : '';
          const prefix = (m.isGossip || m.isSignature) ? '💬 ' : '';
          _showBgBubble(m.id, `${prefix}「${m.line}」`, cls);
        }
      }
      // 協力觸發時 → 對應 NPC 泡泡（金色）
      if (bgNpcMult > 1.0 && trainedAttr) {
        const shouts = BackgroundGladiators.getSynergyShouts(trainedAttr, 2);
        shouts.forEach(s => {
          if (!s.id) return;
          _showBgBubble(s.id, `🔥「${s.line}」`, 'bb-synergy');
        });
      }
    }

    // 🆕 2026-04-25：訓練後在場 NPC 被動好感（觀眾 + 隊友都吃）
    //   觀眾型：melaKook / overseer / officer / masterArtus 等（依角色人設）
    //   隊友型：在場練同屬性 = 共鳴感 +1（匹配 favoredAttr 機率 50%）
    //          只在場 = 看你練 +1（不匹配 30%）
    //   赫克托敵對路線（hector_hostile_path）= 永遠不加（他不喜歡你）
    //   發亮特效已 modAffection hook 自動觸發（綠光好感、紅光惡感）
    if (hasAttrEffect && typeof teammates !== 'undefined') {
      // ─── 隊友被動好感（v10b 新加、2026-04-25b 平衡降、c 拉回有感）───
      //   匹配 favoredAttr：45% / +1（一起練同屬性 = 共鳴）
      //   不匹配：12% / +1（只是看你練）
      //   赫克托敵對路線跳過（他不會給你好感）
      //   🆕 2026-04-25c：之前 30%/8% × 愛憎倍率 0.3 round = 0 → 玩家 5 場全白練。
      //     已修 Math.round → 機率取整（npc.js _probRound）+ 機率拉到 45%/12%。
      const tmList = currentNPCs.teammates || [];
      const synergyHappened = (synergyMult > 1.0);   // 🆕 該場有發生協力爆擊
      tmList.forEach(npcId => {
        if (!npcId) return;
        const npc = teammates.getNPC(npcId);
        if (!npc) return;
        if (npc.alive === false) return;
        if (npcId === 'hector' && typeof Flags !== 'undefined' && Flags.has('hector_hostile_path')) return;
        const matchAttr = (trainedAttr && npc.favoredAttr === trainedAttr);
        // 🆕 2026-04-27 赫克特友善路線額外加成（dislike trait 太多、補償）
        let chance;
        if (matchAttr) {
          chance = (npcId === 'hector' && Flags && Flags.has('hector_friendly_path'))
                     ? 0.65 : 0.45;
        } else {
          chance = 0.12;
        }
        if (Math.random() < chance) {
          teammates.modAffection(npcId, 1);
        }
        // 🆕 2026-04-27 協力爆擊保證好感 — bypass trait dislike mult
        //   條件：trainedAttr === favoredAttr + 該場有 synergy
        //   設計：「他陪你一起練同樣的東西、實戰共鳴 = 不管討厭不討厭都記得」
        if (matchAttr && synergyHappened) {
          teammates.modAffection(npcId, 1, { bypassTrait: true });
        }
      });

      // 🆕 2026-04-27 recruit 也參與被動好感（同 favoredAttr 25% / 不同 5%）
      //   recruit 比較淡、機率比命名 NPC 低
      if (typeof RecruitPool !== 'undefined' && RecruitPool._getActiveRecruits) {
        RecruitPool._getActiveRecruits().forEach(r => {
          const matchAttr = (trainedAttr && r.favoredAttr === trainedAttr);
          const chance = matchAttr ? 0.25 : 0.05;
          if (Math.random() < chance) {
            teammates.modAffection(r.id, 1);
          }
        });
      }
    }

    // 🆕 2026-04-25：在場觀眾被動好感（觀眾型 NPC 規則）
    if (hasAttrEffect && typeof teammates !== 'undefined') {
      const aud = currentNPCs.audience || [];
      // 各觀眾型 NPC 的被動加成規則（依角色人設）
      //   chance: 每場訓練觸發機率（避免好感漲太快）
      //   base:   觸發時加分
      //   bonus:  特定屬性訓練加碼
      // 🆕 2026-04-25b 平衡降：訓練被動好感太快、4 場主人就紫色
      const PASSIVE_AFF_RULES = {
        // 梅拉：母親型 + AGI 特別愛
        melaKook:      { chance: 0.30, base: 1, bonus: { AGI: 1 } },
        // 巴爺：嚴師、常駐看你練 — 加分謹慎
        overseer:      { chance: 0.18, base: 1, bonus: {} },
        // 塔倫：看數字、平日罕見 — 出現時 +1（從 base 2 降）
        officer:       { chance: 0.25, base: 1, bonus: {} },
        // 主人：被動只是「印象」、主要靠競技場勝利通知
        masterArtus:   { chance: 0.30, base: 2, bonus: {} },   // 從 chance 0.50 base 3 降
        // 葛拉：鐵匠尊重肯下功夫的人
        blacksmithGra: { chance: 0.20, base: 1, bonus: {} },
        // 侍從：極少加分
        masterServant: { chance: 0.15, base: 1, bonus: {} },
        // 老默：醫生視角偶爾欣賞
        doctorMo:      { chance: 0.18, base: 1, bonus: {} },
      };
      aud.forEach(npcId => {
        const rule = PASSIVE_AFF_RULES[npcId];
        if (!rule) return;
        if (Math.random() >= rule.chance) return;   // 機率守衛
        const bonus = (trainedAttr && rule.bonus[trainedAttr]) || 0;
        const total = rule.base + bonus;
        if (total > 0) teammates.modAffection(npcId, total);
      });
    }

    // 🆕 抓老鼠任務觸發（梅拉好感 ≥ 25 + 她在場 + 隨機）
    //   第二次起，梅拉看到你練 AGI/DEX/WIL 也可能重新提議
    _tryMouseQuest(trainedAttr);

    // 🆕 2026-04-23：赫克托事件分岔（笑臉示好 / 臭臉騷擾）
    if (typeof HectorEvents !== 'undefined') {
      HectorEvents.tryFriendlyHint();
      HectorEvents.tryHarassment();
    }

    // 🆕 2026-04-25 v10：監督官巴爺主線事件
    if (typeof OverseerEvents !== 'undefined') {
      try {
        // 🆕 2026-04-27 達官顯貴 + 引爆事件（最高優先、會強制開戰）
        if (OverseerEvents.tryIgnitionEvent && OverseerEvents.tryIgnitionEvent()) {
          // 引爆事件已啟動、跳過其他鋪墊
        } else {
          OverseerEvents.tryTarrenPraise();         // 鋪墊期 — 塔倫稱讚 3 階段
          OverseerEvents.tryMelaHint();             // 🆕 鋪墊期 — 梅拉晚餐暗示
          OverseerEvents.tryTarrenAmbiguousOrder(); // 曖昧任務期 — 塔倫指令 2 個
          if (OverseerEvents.tryFireSneakyScene) OverseerEvents.tryFireSneakyScene();  // 🆕 2026-04-28 切磋陰招（長官+目標在場才播）
          OverseerEvents.tryCassiusHint();          // 回響期 — 卡西烏斯補刀
          OverseerEvents.tryEavesdrop();            // 證據期 — 偷聽密謀（條件嚴格）
          OverseerEvents.tryOverseerDrink();        // 選擇期 — 喝酒透漏選擇
        }
      } catch (e) { console.error('[OverseerEvents]', e); }
    }

    // 🆕 2026-04-24：旁觀切磋小事件（補體力 — 對沖偷懶/騷擾懲罰）
    _trySpectateSparring();

    // 🆕 D.21 Option A：奧蘭藥房懸念事件（隨機觸發）
    _tryOrlanApothecarySighting();

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

      injuryChance = Math.min(injuryChance, 0.95);   // 🆕 上限 95%（留 5% 奇蹟）

      if (Math.random() < injuryChance) {
        const part = act.injuryPart || '身體';
        // 受傷程度依超負荷比例分輕/重
        const isHeavy = overloadRatio >= 1.5 || synergyMult >= 3.0;
        if (isHeavy) {
          Stats.modVital('stamina', -25);
          Stats.modVital('mood',    -20);
          addLog(`🩸 ${part}重傷！極限超載的代價。（體力 -25　心情 -20）`, '#cc3333', false);
          if (typeof SoundManager !== 'undefined') SoundManager.playSynth('injury');
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

    // 🆕 D.22c：訓練次數追蹤（武器獎勵門檻用）
    if (hasAttrEffect) {
      Flags.increment('training_action_count', 1);
      _tryWeaponRewardCheck();

      // 🆕 金錢：連續訓練獎勵（每 5 次訓練 → 監督官注意 → 獎金 +8）
      const totalTrain = Flags.get('training_action_count', 0);
      if (totalTrain > 0 && totalTrain % 5 === 0 && !Flags.has(`train_bonus_${totalTrain}`)) {
        Flags.set(`train_bonus_${totalTrain}`, true);
        Stats.modMoney(8);
        addLog('監督官走過來丟了幾個銅幣在你腳邊。「不錯。繼續。」', '#c8a060', false);
      }
    }

    // 🆕 D.28：對話型教學提示（條件觸發，1~3 句帶過）
    _tryTutorialHint();

    // 🆕 D.1.8: 依設定自動存檔（寫到 auto slot，不影響手動槽）
    autoSave('action');
    renderAll();
  }

  // 🆕 D.28：對話型教學提示的觸發器
  //   由 doAction / sleepEndDay 結尾呼叫。
  //   每個 hint 透過 flag 鎖住只觸發一次。
  function _tryTutorialHint() {
    if (typeof TutorialHints === 'undefined') return;
    if (typeof DialogueModal === 'undefined') return;
    // 動畫中 / Modal 已開就延後
    if (_uiLocked) return;
    if (DialogueModal.isOpen && DialogueModal.isOpen()) return;
    const hint = TutorialHints.tryShow(Stats.player);
    if (hint) DialogueModal.play(hint.lines);
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
        const isStr   = (act.effects||[]).some(e => (e.type === 'attr' || e.type === 'exp') && e.key === 'STR');
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
        const isTraining = (act.effects||[]).some(e => e.type === 'attr' || e.type === 'exp');
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
  // ══════════════════════════════════════════════════
  // 🆕 D.12: NPC 故事事件掃描器（每晚就寢前呼叫）
  // ══════════════════════════════════════════════════
  /**
   * 掃描所有 NPC 的 storyReveals 中 type='event' 的段落，
   * 符合條件（好感/特性/屬性/旗標/...）且尚未觸發過的，
   * 依 chance roll 觸發。觸發後記錄到 player.seenReveals。
   *
   * 一晚可能觸發多個（但每段只會觸發一次）。
   */
  /**
   * 🆕 2026-04-19 情緒倍率（emotion modulator）
   *   特性影響事件 mood 起伏：
   *     cruel 冷酷     → ×0.5（家書？無聊。）
   *     prideful 驕傲  → ×0.7
   *     brooding 鬱結  → ×1.5（多愁善感）
   *     neurotic 神經質 → ×1.3
   *     blessed 神眷   → ×0.8（信念穩定）
   *     shadowed 暗影  → ×1.3（黑暗思維放大）
   *   多特性疊加（取乘積，clamp 0.2-3.0）
   */
  function _calcEmotionMult(p) {
    if (!p || !Array.isArray(p.traits)) return 1.0;
    let mult = 1.0;
    if (p.traits.includes('cruel'))    mult *= 0.5;
    if (p.traits.includes('prideful')) mult *= 0.7;
    if (p.traits.includes('brooding')) mult *= 1.5;
    if (p.traits.includes('neurotic')) mult *= 1.3;
    if (p.traits.includes('blessed'))  mult *= 0.8;
    if (p.traits.includes('shadowed')) mult *= 1.3;
    return Math.max(0.2, Math.min(3.0, mult));
  }

  function _scanStoryEvents() {
    if (typeof teammates === 'undefined' || !teammates.getPendingStoryEvents) return;
    const p = Stats.player;
    if (!Array.isArray(p.seenReveals)) p.seenReveals = [];

    const pending = teammates.getPendingStoryEvents(p);
    pending.forEach(({ reveal }) => {
      const chance = reveal.chance || 0;
      if (Math.random() >= chance) return;

      // 🆕 D.21：重量級 reveal 有 dialogueLines → 排入對話佇列（晨起後播）
      // 🆕 2026-04-19：支援 dialogueLines 為函式（依玩家 origin / traits 動態產生）
      //                支援 reveal.effects（播完對白後套 Effects.apply，可吃 emotion modulator）
      const rawLines = reveal.dialogueLines;
      const lines = (typeof rawLines === 'function') ? rawLines(p) : rawLines;
      if (Array.isArray(lines) && lines.length > 0) {
        _pendingDialogues.push({
          id:    reveal.id,
          lines: lines,
          onComplete: () => {
            if (Array.isArray(reveal.effects) && reveal.effects.length > 0 && typeof Effects !== 'undefined') {
              // 🆕 2026-04-19：emotion modulator — 特性影響情緒起伏
              const moodMult = _calcEmotionMult(p);
              const tweaked = reveal.effects.map(eff => {
                if (eff.type === 'vital' && eff.key === 'mood' && typeof eff.delta === 'number') {
                  return { ...eff, delta: Math.round(eff.delta * moodMult) };
                }
                return eff;
              });
              Effects.apply(tweaked, { source: 'story_reveal:' + reveal.id });
            }
          },
        });
      } else {
        // 輕量 reveal：直接 log + flash
        const color = reveal.logColor || '#c8b898';
        addLog(reveal.text, color, true, true);
      }
      p.seenReveals.push(reveal.id);

      // 未來 D.14 實作：reveal.grantItem → 把道具加到 personalItems
      // 目前先記錄到 Flags 以便後續系統讀取
      if (reveal.grantItem && typeof Flags !== 'undefined') {
        Flags.set('story_granted_' + reveal.grantItem, true);
      }

      // 🆕 D.21 Option A：reveal 觸發時設定 flag（用於 resolve 懸念）
      if (reveal.setFlag && typeof Flags !== 'undefined') {
        Flags.set(reveal.setFlag, true);
      }
      // 🆕 D.21 Option A：reveal 觸發時排入 MorningThoughts 回收佇列
      if (reveal.queueResolution && typeof MorningThoughts !== 'undefined') {
        MorningThoughts.queueResolution(reveal.queueResolution);
      }
    });
  }

  // 🆕 D.21：重量級對話佇列（晨起後串接播放）
  let _pendingDialogues = [];

  async function _flushDialogues() {
    if (typeof DialogueModal === 'undefined') { _pendingDialogues = []; return; }
    const list = _pendingDialogues.slice();
    _pendingDialogues = [];
    for (const d of list) {
      await new Promise(resolve => {
        DialogueModal.play(d.lines, {
          onComplete: () => {
            // 🆕 D.22c：支援 d.onComplete 自訂回呼（例：武器選擇事件接 ChoiceModal）
            if (typeof d.onComplete === 'function') {
              try { d.onComplete(); } catch (e) { console.error('[flushDialogues] onComplete error', e); }
            }
            resolve();
          },
        });
      });
    }
  }

  // 🆕 D.12 v2: 事件佇列——由 DayCycle 等內部系統在黑幕下 push，
  //              Stage.playSleep 結束後依序播放為小過場，確保玩家有感。
  let _pendingStageEvents = [];

  /** 推一個事件到佇列，Stage.playSleep 後會播放 */
  function queueStageEvent(evt) {
    if (!evt) return;
    _pendingStageEvents.push(evt);
  }

  /** 依序播放佇列中的事件（由 sleepEndDay 在 playSleep 完成後呼叫） */
  async function _flushStageEvents() {
    if (typeof Stage === 'undefined' || !Stage.playEvent) {
      _pendingStageEvents = [];
      return;
    }
    const events = _pendingStageEvents.slice();
    _pendingStageEvents = [];
    for (const evt of events) {
      try { await Stage.playEvent(evt); }
      catch (e) { console.error('[Stage] playEvent error', e); }
    }
  }

  async function sleepEndDay() {
    _uiLocked = true;   // 🆕 鎖住 UI 直到晨起演出全部完成
    const p = Stats.player;
    if (p.day >= 100) {
      addLog('一百天到了。萬骸祭的鐘聲即將敲響。', '#8b0000', true);
      _uiLocked = false;
      return;
    }

    // 🆕 D.12 v2：預先 roll 就寢類型，讓 Stage 動畫能提前決定要播哪一種演出
    const sleepType = _rollSleepType();

    if (typeof Stage !== 'undefined' && Stage.playSleep) {
      // 🆕 D.21：就寢演出保留黑幕，由 playMorning 接手晨起過場
      await Stage.playSleep({
        sleepType,
        onBlack: () => _sleepEndDayBody(sleepType),
        skipFinalOpen: true,
      });

      // 挑出今日晨思（可能為 null）
      let thoughtObj = null, thoughtLine = '';
      if (typeof MorningThoughts !== 'undefined') {
        thoughtObj = MorningThoughts.pickToday(Stats.player);
        if (thoughtObj) thoughtLine = MorningThoughts.getLine(thoughtObj);
      }

      await Stage.playMorning({
        assumeBlack: true,
        innerThought: thoughtLine,
      });

      // 標記為已顯示（必須在 playMorning 之後，以保留 shownCount 正確的輪播順序）
      if (thoughtObj && typeof MorningThoughts !== 'undefined') {
        MorningThoughts.markShown(thoughtObj, Stats.player);
      }

      // 黑幕掀開後，依序播放佇列中的事件（主人傳喚/任務/故事等）
      await _flushStageEvents();

      // 🆕 D.21：播放重量級對話（奧蘭初遇誓言等）
      await _flushDialogues();

      // 🆕 D.22：嘗試觸發醫生訪問（條件符合才會開）
      // 🆕 2026-04-25 修：tryVisit() 同步啟動 DialogueModal 後立刻 return；
      //   若同晨葛拉事件再呼叫 DialogueModal.play 會覆蓋掉老默的 _lines/_onComplete →
      //   結果就是玩家只看到一句、治療 onComplete 永不觸發、ailment 永遠沒清。
      //   修：老默若觸發，整套葛拉事件延到隔天再跑（一晚一場大事件就夠）。
      let doctorFired = false;
      if (typeof DoctorEvents !== 'undefined' && DoctorEvents.tryVisit) {
        try { doctorFired = !!DoctorEvents.tryVisit(); } catch (e) { console.error('[Doctor]', e); }
      }
      // 鐵匠葛拉事件鏈（階段 2 / 3 / 4 — 一個觸發後其他自動延後到下次晨起）
      if (!doctorFired && typeof BlacksmithEvents !== 'undefined') {
        try {
          if (BlacksmithEvents.tryFirstArmor()) { /* 階段 2 完成、不串其他 */ }
          else if (BlacksmithEvents.tryFirstRepair()) { /* 階段 3 */ }
          else if (BlacksmithEvents.tryWeaponUpgradeT2) { BlacksmithEvents.tryWeaponUpgradeT2(); }
        } catch (e) { console.error('[Blacksmith]', e); }
      }
      _uiLocked = false;   // 🆕 晨起演出全部完成，解鎖 UI
    } else {
      _sleepEndDayBody(sleepType);
      _flushStageEvents();
      _flushDialogues();
      let doctorFired = false;
      if (typeof DoctorEvents !== 'undefined' && DoctorEvents.tryVisit) {
        try { doctorFired = !!DoctorEvents.tryVisit(); } catch (e) { console.error('[Doctor]', e); }
      }
      // 鐵匠葛拉事件鏈（老默若觸發 → 葛拉延到隔天，避免 DialogueModal 覆蓋）
      if (!doctorFired && typeof BlacksmithEvents !== 'undefined') {
        try {
          // 葛拉事件鏈優先序：2 → 3 → 4 → 5 → 6 → 7 → 8（一晚最多一個）
          if (BlacksmithEvents.tryFirstArmor()) { /* 階段 2 */ }
          else if (BlacksmithEvents.tryFirstRepair()) { /* 階段 3 */ }
          else if (BlacksmithEvents.tryWeaponUpgradeT2()) { /* 階段 4 */ }
          else if (BlacksmithEvents.tryBlueprintCraft && BlacksmithEvents.tryBlueprintCraft()) { /* 階段 5 */ }
          else if (BlacksmithEvents.tryWeaponUpgradeT3 && BlacksmithEvents.tryWeaponUpgradeT3()) { /* 階段 6 */ }
          else if (BlacksmithEvents.tryArmorUpgrade && BlacksmithEvents.tryArmorUpgrade()) { /* 階段 7 */ }
          else if (BlacksmithEvents.tryHeirloomWeapon && BlacksmithEvents.tryHeirloomWeapon()) { /* 階段 8 */ }
        } catch (e) { console.error('[Blacksmith]', e); }
      }
      _uiLocked = false;   // 🆕 解鎖
    }
  }

  /** 就寢實際處理邏輯（天數推進、事件、rollNPCs、autoSave）。
   *  由 Stage.playSleep 的 onBlack 呼叫，保證在黑幕下執行。
   *  @param {string} [forcedSleepType] — sleepEndDay 預 roll 的類型，確保 Stage 動畫與 log 一致 */
  function _sleepEndDayBody(forcedSleepType) {
    const p = Stats.player;

    // 🆕 2026-04-19：睡前讀書（書櫃有書就推進進度）
    if (typeof Reading !== 'undefined' && Reading.tryBedtime) {
      try { Reading.tryBedtime(); } catch (e) { console.error('[Reading]', e); }
    }

    // 🆕 2026-04-24：狂熱日結（修剪滑動窗口 / 冷卻判斷）
    if (typeof Fervor !== 'undefined' && Fervor.onDayEnd) {
      try { Fervor.onDayEnd(); } catch (e) { console.error('[Fervor]', e); }
    }

    // 🆕 D.12: 就寢前先掃描 NPC 故事事件（夜間共鳴）
    _scanStoryEvents();

    // 🆕 D.1.11: Fire "day end" hooks (p.day 仍是舊的)
    DayCycle.fireDayEnd(p.day);

    // 🆕 Phase 1-D: 就寢事件（決定 normal/insomnia/nightmare + 失眠症邏輯）
    _triggerSleepEvent(forcedSleepType);

    // Overnight food cost（與就寢體力恢復分開）
    Stats.modVital('food', Config.DAILY.SLEEP_FOOD_COST);

    // 🆕 D.26：飽食度日結效果 — 餓肚子會心情差、身體虛
    const foodAfter = p.food;
    if (foodAfter < 20) {
      Stats.modVital('mood', -8);
      Stats.modVital('hp',   -5);
      addLog('【飢餓】肚子咕嚕叫了整晚，你睡得不安穩。心情和身體都在下墜。', '#cc5533', true, true);
    } else if (foodAfter < 30) {
      Stats.modVital('mood', -5);
      Stats.modVital('hp',   -3);
      addLog('【半飢】你整晚都感覺肚子沒填飽。', '#cc7733', false);
    } else if (foodAfter >= 70) {
      Stats.modVital('mood', 2);
      addLog('你吃得飽飽的，睡得也安穩。（心情 +2）', '#d4af37', false);
    }

    // Advance to next day
    p.day  = Math.min(100, p.day + 1);
    p.time = SLOT_START;

    addLog(`\n────────────────────\n第 ${p.day} 天　天光未明，新的一天開始了。`, '#b8960c', false);

    // 🆕 寵物每日被動效果（有寵物 → mood +2）
    if (p.pets) {
      const hasPet = Object.values(p.pets).some(v => v && v.id);
      if (hasPet) {
        Stats.modVital('mood', 2);
        addLog('🐭 小灰蹭了蹭你的手。今天好像沒那麼難熬。', '#c8a878', false);
      }
    }

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
  // 🆕 Phase 1 重構：場景切換已停用
  // 訓練場是唯一場景，所有 NPC 互動透過事件觸發
  // 此函式保留簽名以維持向下相容（被外部呼叫時不會 throw），但不會切換場地
  function switchField(_fieldId) {
    // no-op：訓練場是唯一場景
    return;
  }

  // ══════════════════════════════════════════════════════
  // ARENA
  // ══════════════════════════════════════════════════════

  // 🆕 2026-04-25 平衡調整：玩家 Day 50 ~ avg 26，舊 tier 太弱
  //   錨點：「avg 25 = T1 裝備」（中等場），上面 tier 往上推
  // 🆕 2026-04-25c 全面退回難度（cbfb6b5 整體拉太兇）
  //   設計原則：玩家是上升中的明星 — 應該大多場勝利、偶爾吃苦
  //   數值錨：對手平均屬性比玩家當期預期略低 2-4 點、武器低半 tier
  //   玩家當期預期屬性：D10 ~10、D30 ~20、D50 ~28、D70 ~34
  const ARENA_TIERS = [
    {
      minDay: 10, maxDay: 20,
      label: '初等場・試煉', color: '#8a8060',
      statsMin: 8, statsMax: 14,                      // avg 11（玩家 ~10）
      hpMin: 35, hpMax: 50,
      weaponPool: ['fists', 'fists', 'dagger'],       // 多數沒武器
      armorPool:  ['rags'],
      shieldPool: ['none'],
      fameMin: 3, fameMax: 8,
      titleStr: '試煉者',
    },
    {
      minDay: 20, maxDay: 40,
      label: '中等場・角鬥', color: '#b08040',
      statsMin: 16, statsMax: 22,                     // avg 19（玩家 ~20）
      hpMin: 50, hpMax: 70,
      weaponPool: ['dagger', 'dagger', 'shortSword', 'spear'],  // T1 但偏廉
      armorPool:  ['rags', 'leatherArmor'],
      shieldPool: ['none', 'woodShield'],
      fameMin: 6, fameMax: 14,
      titleStr: '角鬥士',
    },
    {
      minDay: 40, maxDay: 60,
      label: '上等場・血鬥', color: '#c05020',
      statsMin: 20, statsMax: 28,                     // avg 24（玩家 ~28）
      hpMin: 65, hpMax: 90,
      weaponPool: ['shortSword', 'spear', 'longSword', 'heavyAxe'],  // 純 T1
      armorPool:  ['leatherArmor', 'leatherArmor', 'chainmail'],
      shieldPool: ['woodShield', 'woodShield', 'ironShield', 'none'],
      fameMin: 12, fameMax: 22,
      titleStr: '老手鬥士',
    },
    {
      minDay: 60, maxDay: 81,
      label: '精英場・死鬥', color: '#d03010',
      statsMin: 26, statsMax: 34,                     // avg 30（玩家 ~34）
      hpMin: 90, hpMax: 115,
      weaponPool: ['longSword', 'warHammer', 'heavyAxe', 'shortSword_t2', 'spear_t2'],  // T1 為主、T2 偶爾
      armorPool:  ['chainmail', 'chainmail', 'leatherArmor'],
      shieldPool: ['ironShield', 'woodShield'],
      fameMin: 18, fameMax: 35,
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
        // 🆕 2026-04-25c：競技場戰敗 ≠ 死亡（之前的 deathEnding 過於嚴苛、玩家無法測試）
        //   設計：戰敗 = 重傷 + 恥辱 + 經濟損失，但保留命。Day 100 萬骸祭才是真死。
        //   參考既有 timeline battle onLose 寫法（main.js:1229）+ 真正用 Wounds 系統。
        DialogueModal.play([
          { text: '你倒在沙地上。視野模糊。' },
          { text: '觀眾發出失望的噓聲。有人砸了酒杯。' },
          { text: '兩個侍從把你拖下場。你聽見塔倫長官在主人耳邊低語——' },
          { speaker: '塔倫長官', text: '⋯⋯這次只是丟臉。再來一次，主人就要重新考慮。' },
        ], {
          onComplete: () => {
            // 重傷：隨機部位、嚴重度 2-3（依當前 HP 決定）
            const parts = ['torso', 'arms', 'legs', 'head'];
            const part  = parts[Math.floor(Math.random() * parts.length)];
            const severity = (p.hp <= p.hpMax * 0.2) ? 3 : 2;
            if (typeof Wounds !== 'undefined' && Wounds.inflict) {
              Wounds.inflict(part, severity, { source:'arena_loss', cameFromCombat:true });
              const partName = (Wounds.PART_NAMES && Wounds.PART_NAMES[part]) || part;
              const sevName  = (Wounds.SEVERITY_NAMES && Wounds.SEVERITY_NAMES[severity]) || (severity === 3 ? '重傷' : '中傷');
              addLog(`⚠️ 你的${partName}受了${sevName}。`, '#cc3333', true, true);
            }
            // 體力 / 心情 / 名聲懲罰（重 — 比訓練重傷重）
            Stats.modVital('hp',      -Math.max(20, Math.round(p.hpMax * 0.4)));   // HP 砍掉至少 20、至多 40%
            Stats.modVital('stamina', -30);
            Stats.modVital('mood',    -25);
            Stats.modFame(-15);
            // 主人 / 長官好感扣（賠錢丟臉）
            if (typeof teammates !== 'undefined') {
              teammates.modAffection('masterArtus', -5);
              teammates.modAffection('officer',     -3);
            }
            addLog('你敗了。但你還活著——這次。', '#8899aa', true, true);
            renderAll();
          },
        });
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
    _rebuildDayBar();   // 🆕 D.28：動態揭露 — 每次 render 都重建百日條
    renderSceneInfoBar();
    renderSceneView();
    _renderFervorBadge();   // 🆕 2026-04-24 狂熱進度徽章（左上金框）
    renderNPCSlots();
    renderTimeSlots();
    renderLocationTabs();
    renderActionList();
    try { renderArenaSection(); } catch(e) { console.error('[Arena] render error:', e); }
    renderLog();
    Stats.renderAll();
    document.getElementById('player-name-display').textContent = Stats.player.name;
    _updateDetailReadyBadge();
    checkTimelineEvent();
  }

  // 🆕 D.27：「詳細」按鈕上的升級提醒徽章
  //   任何屬性 EXP 夠升級 → 顯示金色數字（可升級的屬性數量）
  function _updateDetailReadyBadge() {
    const btn = document.getElementById('btn-detail');
    if (!btn) return;
    const p = Stats.player;
    if (!p || !p.exp) return;
    const attrs = ['STR','DEX','CON','AGI','WIL'];
    let readyCount = 0;
    for (const key of attrs) {
      const lvl  = p[key] || 10;
      const exp  = p.exp[key] || 0;
      const cost = Stats.expToNext(lvl);
      if (exp >= cost) readyCount++;
    }
    let badge = btn.querySelector('.detail-ready-badge');
    if (readyCount > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'detail-ready-badge';
        btn.appendChild(badge);
      }
      badge.textContent = readyCount;
    } else if (badge) {
      badge.remove();
    }
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
    _closeEquipmentPicker();     // 每次打開重置 picker
    _fillCharSheet();
    // 每次打開都回到「角色」tab
    _switchCharSheetTab('character');
    modal.classList.add('open');
  }

  function closeDetailModal() {
    _closeEquipmentPicker();
    document.getElementById('modal-detail')?.classList.remove('open');
  }

  /**
   * 切換角色頁的 tab。
   * @param {string} tabId 'character' | 'people' | 'achievements' | 'codex' | 'quests'
   */
  function _switchCharSheetTab(tabId) {
    // 換 tab 時關閉 picker（避免殘留）
    _closeEquipmentPicker();
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
    // 切到眾生 tab 時重新渲染（資料可能變了）
    if (tabId === 'people') _renderPeopleTab();
    // 🆕 切到技能 tab 時重新渲染
    if (tabId === 'skills') _renderSkillsTab();
  }

  // ══════════════════════════════════════════════════
  // 🆕 D.7 階段 B：角色頁渲染（拆成 14 個小函式）
  // ══════════════════════════════════════════════════

  // 裝備 6 槽定義
  const _EQUIP_SLOTS = [
    { id: 'weapon',  label: '主手', field: 'equippedWeapon',  source: 'weapons' },
    { id: 'offhand', label: '副手', field: 'equippedOffhand', source: 'offhand' },
    { id: 'helmet',  label: '頭盔', field: 'equippedHelmet',  source: 'helmet'  },
    { id: 'chest',   label: '胸甲', field: 'equippedArmor',   source: 'chest'   },
    { id: 'arms',    label: '護臂', field: 'equippedArms',    source: 'arms'    },
    { id: 'legs',    label: '護腿', field: 'equippedLegs',    source: 'legs'    },
  ];
  let _pickerOpenSlot = null;

  function _fillCharSheet() {
    // 🆕 D.6 v2: 開角色頁時整數化全部數值（屬性 + vitals + 名聲/金錢/SP）
    if (typeof Stats.sanitizeAttrsToInt  === 'function') Stats.sanitizeAttrsToInt();
    if (typeof Stats.sanitizeVitalsToInt === 'function') Stats.sanitizeVitalsToInt();
    _renderHeader();
    _renderVitals();
    _renderEquipmentSlots();
    _renderAmulets();
    _renderPets();
    _renderResources();
    _ensureHexSvg();        // 確保 SVG 靜態元素已建立
    _renderHexagon();       // 🆕 六角形玩家數值
    _renderDerivedGrid();   // 🆕 派生 10 項格子
    _renderAttrSpend();     // 🆕 D.6 屬性升級區
    _renderCurrentState();
    _renderTraits();
    _renderScars();
    _renderAilments();
    _renderMoralSpectrum();   // 🆕 D.21 Option C：道德光譜
    // 🆕 2026-04-19 傷勢
    if (typeof Wounds !== 'undefined' && Wounds.renderWoundsList) {
      try { Wounds.renderWoundsList('cs-wounds-list'); } catch (e) { console.error('[Wounds]', e); }
    }
    // 🆕 2026-04-19 書櫃
    if (typeof Reading !== 'undefined' && Reading.renderBookshelf) {
      try { Reading.renderBookshelf('cs-bookshelf'); } catch (e) { console.error('[Reading]', e); }
    }
    _renderSkills();
    _renderPeopleTab();
  }

  // ── R4.5: 道德光譜（D.21 / 基於 D.19 滑動窗口）──
  //   顯示 5 個道德軸的目前窗口狀態：● ○ ◐ 等符號呈現最近 3 筆行動
  //   搭配輕量描述 + 當前特性名稱
  function _renderMoralSpectrum() {
    const wrap = document.getElementById('cs-moral-spectrum');
    if (!wrap) return;
    if (typeof Moral === 'undefined') {
      wrap.style.display = 'none';
      return;
    }
    const p = Stats.player;
    Moral.ensureInit(p);

    const AXES = [
      { key:'reliability', name:'可靠 / 膽小', posId:'reliable',    negId:'coward'      },
      { key:'mercy',       name:'仁慈 / 殘忍', posId:'merciful',    negId:'cruel'       },
      { key:'loyalty',     name:'忠誠 / 投機', posId:'loyal',       negId:'opportunist' },
      { key:'pride',       name:'謙卑 / 驕傲', posId:'humble',      negId:'prideful'    },
      { key:'patience',    name:'耐心 / 衝動', posId:'patient',     negId:'impulsive'   },
    ];

    // 三個窗口格子 — 已填或空
    function renderWindow(hist) {
      const slots = [];
      for (let i = 0; i < 3; i++) {
        const entry = hist[i];
        let cls = 'slot-empty', sym = '·';
        if (entry === 'positive') { cls = 'slot-pos'; sym = '●'; }
        else if (entry === 'negative') { cls = 'slot-neg'; sym = '●'; }
        slots.push(`<span class="moral-slot ${cls}">${sym}</span>`);
      }
      return slots.join('');
    }

    const rows = AXES.map(axis => {
      const hist = Moral.getAxisHistory(axis.key) || [];
      const traits = p.traits || [];
      let trait = '', traitCls = 'moral-trait-none';
      if (traits.includes(axis.posId)) {
        const def = Config.TRAIT_DEFS[axis.posId];
        trait = '★ ' + (def ? def.name : axis.posId);
        traitCls = 'moral-trait-pos';
      } else if (traits.includes(axis.negId)) {
        const def = Config.TRAIT_DEFS[axis.negId];
        trait = '▼ ' + (def ? def.name : axis.negId);
        traitCls = 'moral-trait-neg';
      } else {
        trait = '— 未定 —';
      }
      return `
        <div class="moral-row">
          <span class="moral-axis-name">${axis.name}</span>
          <span class="moral-window">${renderWindow(hist)}</span>
          <span class="moral-trait ${traitCls}">${trait}</span>
        </div>
      `;
    }).join('');

    // 若 5 軸都沒任何行動 → 整區隱藏
    const hasAnyAction = AXES.some(a => (Moral.getAxisHistory(a.key) || []).length > 0);
    if (!hasAnyAction) {
      wrap.style.display = 'none';
      const title = wrap.previousElementSibling;
      if (title && title.classList.contains('cs-section-title') && title.textContent.trim() === '道德光譜') {
        title.style.display = 'none';
      }
      wrap.innerHTML = '';
      return;
    }
    wrap.style.display = '';
    const title = wrap.previousElementSibling;
    if (title && title.classList.contains('cs-section-title') && title.textContent.trim() === '道德光譜') {
      title.style.display = '';
    }
    wrap.innerHTML = rows;
  }

  // ── R0: Header ────────────────────────────────────
  function _renderHeader() {
    const p = Stats.player;
    const nameEl = document.getElementById('cs-name');
    if (nameEl) nameEl.textContent = p.name || '無名';

    // Fallback 立繪：姓名前兩字
    const portraitEl = document.getElementById('cs-portrait-fallback');
    if (portraitEl) portraitEl.textContent = (p.name || '無名').slice(0, 2);

    // Origin × Facility（Phase 2 S1/S2 之前 fallback）
    const originEl = document.getElementById('cs-origin');
    if (originEl) originEl.textContent = p.origin || '流浪者';
    const facilityEl = document.getElementById('cs-facility');
    if (facilityEl) facilityEl.textContent = p.facility || '無名訓練所';

    // World state（Phase 2 S4 之前 fallback）
    const wsEl = document.getElementById('cs-world-state');
    if (wsEl) {
      const ws = (typeof GameState !== 'undefined' && GameState.get && GameState.get('worldState')) || 'peace';
      wsEl.textContent = { peace:'和平', war:'戰亂期', plague:'瘟疫' }[ws] || '和平';
    }

    const dayEl = document.getElementById('cs-day');
    if (dayEl) dayEl.textContent = p.day;
    const fameVal = document.getElementById('cs-fame-val');
    if (fameVal) fameVal.textContent = p.fame;
    const fameFill = document.getElementById('cs-fame-bar-fill');
    if (fameFill) fameFill.style.width = Math.min(100, p.fame) + '%';
  }

  // ── L1: 狀態條 ────────────────────────────────────
  function _renderVitals() {
    const p = Stats.player;
    p.hpMax = p.hpBase + Math.round(2 * Stats.eff('CON'));
    p.hp = Math.round(Math.min(p.hp, p.hpMax));
    [
      { id:'cs-bar-hp',      val:p.hp,      max:p.hpMax },
      { id:'cs-bar-stamina', val:p.stamina, max:p.staminaMax },
      { id:'cs-bar-food',    val:p.food,    max:p.foodMax },
      { id:'cs-bar-mood',    val:p.mood,    max:p.moodMax },
    ].forEach(b => {
      const row = document.getElementById(b.id);
      if (!row) return;
      const pct = Math.round(b.val / b.max * 100);
      row.querySelector('.cs-bar-fill').style.width = pct + '%';
      row.querySelector('.cs-vital-num').textContent = b.val + '/' + b.max;
    });
  }

  // ── L2: 裝備 6 槽（動態生成） ─────────────────────
  function _renderEquipmentSlots() {
    const container = document.getElementById('cs-equip-slots');
    if (!container) return;
    const p = Stats.player;
    container.innerHTML = _EQUIP_SLOTS.map(slot => {
      const itemId = p[slot.field];
      const label  = _getEquipmentName(slot.source, itemId);
      const isEmpty = !itemId;
      const isActive = _pickerOpenSlot === slot.id;
      return `
        <button class="cs-equip-slot-btn ${isEmpty ? 'empty' : ''} ${isActive ? 'active' : ''}" data-slot="${slot.id}">
          <span class="cs-eqslot-label">${slot.label}</span>
          <span class="cs-eqslot-val">${label}</span>
          <span class="cs-eqslot-arrow">▸</span>
        </button>`;
    }).join('');
    // Bind clicks
    container.querySelectorAll('.cs-equip-slot-btn').forEach(btn => {
      btn.addEventListener('click', () => _openEquipmentPicker(btn.dataset.slot));
    });
  }

  /** 取得裝備顯示名稱 */
  function _getEquipmentName(source, itemId) {
    if (!itemId) return '—';
    if (source === 'weapons') return Weapons[itemId]?.name || itemId;
    if (source === 'offhand') {
      if (Armors[itemId])  return Armors[itemId].name;         // 盾牌
      if (Weapons[itemId]) return Weapons[itemId].name + '（副）'; // 雙持
      return itemId;
    }
    if (source === 'chest') return Armors[itemId]?.name || itemId;
    // helmet/arms/legs 尚無對應 item table（Phase 3 E10 D.2）
    return '—';
  }

  // ── 🆕 Equipment picker inline ─────────────────────
  function _openEquipmentPicker(slotId) {
    // 同槽再點 = 關閉
    if (_pickerOpenSlot === slotId) {
      _closeEquipmentPicker();
      return;
    }
    _pickerOpenSlot = slotId;
    const slot = _EQUIP_SLOTS.find(s => s.id === slotId);
    if (!slot) return;

    const panel = document.getElementById('cs-picker-panel');
    const title = document.getElementById('cs-picker-title');
    const list  = document.getElementById('cs-picker-list');
    if (!panel || !title || !list) return;

    title.textContent = '更換' + slot.label;

    const p = Stats.player;
    const currentId = p[slot.field];
    const options = _getPickerOptions(slot.source);

    if (options.length === 0) {
      list.innerHTML = '<div class="cs-picker-empty">目前沒有可用於此槽的裝備<br>（Phase 3 加入多部位裝備後可選擇）</div>';
    } else {
      // 「空手/解除」選項
      const unequipLabel = slot.source === 'weapons' ? '空手' :
                           slot.source === 'chest'   ? '破布' :
                           '—';
      const unequipItem = `
        <div class="cs-picker-item ${!currentId ? 'equipped' : ''}" data-item="">
          <div class="cs-picker-name">${unequipLabel}${!currentId ? '<span class="eq-tag">裝備中</span>' : ''}</div>
          <div class="cs-picker-desc">不裝備任何物品</div>
        </div>`;
      const itemHtml = options.map(it => {
        const equipped = (it.id === currentId);
        return `
          <div class="cs-picker-item ${equipped ? 'equipped' : ''}" data-item="${it.id}">
            <div class="cs-picker-name">${it.name}${equipped ? '<span class="eq-tag">裝備中</span>' : ''}</div>
            <div class="cs-picker-desc">${it.desc || ''}</div>
          </div>`;
      }).join('');
      list.innerHTML = unequipItem + itemHtml;
    }

    panel.classList.remove('hidden');
    list.querySelectorAll('.cs-picker-item').forEach(el => {
      el.addEventListener('click', () => _equipItem(slot, el.dataset.item));
    });

    // Refresh slot highlights
    _renderEquipmentSlots();
  }

  function _closeEquipmentPicker() {
    _pickerOpenSlot = null;
    const panel = document.getElementById('cs-picker-panel');
    if (panel) panel.classList.add('hidden');
    _renderEquipmentSlots();
  }

  /** 列出此 source 可選擇的裝備 */
  function _getPickerOptions(source) {
    if (source === 'weapons') {
      // 🆕 只列出玩家擁有的武器（weaponInventory），不是全部 Weapons 表
      const p = Stats.player;
      if (Array.isArray(p.weaponInventory) && p.weaponInventory.length > 0) {
        return p.weaponInventory.map(entry => {
          const w = Weapons[entry.id];
          if (!w) return null;
          const tierLabel = entry.tier > 0 ? ` +${entry.tier}` : '';
          return { ...w, name: w.name + tierLabel, _tier: entry.tier };
        }).filter(Boolean);
      }
      // fallback：還沒拿到武器時顯示空
      return [];
    }
    if (source === 'offhand') {
      // 盾牌（Armors type='shield'）+ 單手武器（可雙持）
      const shields = Object.values(Armors).filter(a => a.type === 'shield');
      const oneHanders = Object.values(Weapons).filter(w => w.id !== 'fists' && w.hands === 1);
      return [...shields, ...oneHanders];
    }
    if (source === 'chest') {
      const inv = Array.isArray(p.armorInventory) ? p.armorInventory : [];
      return inv.map(e => Armors[e.id]).filter(Boolean);
    }
    // helmet / arms / legs — 尚無資料表
    return [];
  }

  function _equipItem(slot, itemId) {
    const p = Stats.player;
    p[slot.field] = itemId || null;

    // 雙手武器時副手強制為空
    if (slot.id === 'weapon' && itemId && Weapons[itemId]?.hands === 2) {
      p.equippedOffhand = null;
    }
    // 副手裝單手武器時，如果主手是雙手武器，警告（就讓它裝不了）
    if (slot.id === 'offhand' && itemId && p.equippedWeapon && Weapons[p.equippedWeapon]?.hands === 2) {
      p[slot.field] = null;
    }

    // Re-render 整個 sheet（屬性會立即反映）
    _fillCharSheet();
    // 屬性條也會變，同步主 UI
    if (typeof Stats.renderAll === 'function') Stats.renderAll();
  }

  // ── L3: 護符 6 格（空狀態） ─────────────────────
  // 🆕 2026-04-20：個人物品定義（暫放，未來移至獨立 item_defs.js）
  const PERSONAL_ITEM_DEFS = {
    sol_amulet: {
      name: '女兒的掛件',
      icon: '🪵',
      effect: 'LUK +1',
      desc: '索爾女兒刻的木牌。歪歪斜斜的「D」字樣。',
    },
    black_doc_contact: {
      name: '密醫紙條',
      icon: '📜',
      effect: '城南接頭暗號',
      desc: '老默給的。寫著城南巷子的暗號。',
    },
    mars_token: {
      name: '馬爾斯的護腕',
      icon: '🔗',
      effect: 'ACC +2',
      desc: '老舊的青銅護腕。他臨死前送你的。',
    },
    family_pendant: {
      name: '家族項鍊',
      icon: '🧿',
      effect: '可換錢',
      desc: '貴族家族徽章。你偷偷藏下來的。',
    },
  };

  function _renderAmulets() {
    const el = document.getElementById('cs-amulets-grid');
    if (!el) return;
    // 🆕 2026-04-20：暫用護符 grid 顯示 personalItems（6 格上限）
    // Phase 3 D.3 會獨立出來做個人物品區塊
    const items = Stats.player.personalItems || [];
    const cells = Array.from({ length: 6 }).map((_, i) => {
      const itemId = items[i];
      if (!itemId) return '<div class="cs-amulet-cell">空</div>';
      const def = PERSONAL_ITEM_DEFS[itemId] || { name: itemId, icon: '●', effect: '', desc: '' };
      const tooltip = `${def.desc}${def.effect ? '\n效果：' + def.effect : ''}`;
      return `<div class="cs-amulet-cell has-item" title="${tooltip.replace(/"/g,'&quot;')}">
        <div class="ca-icon">${def.icon}</div>
        <div class="ca-name">${def.name}</div>
      </div>`;
    });
    el.innerHTML = cells.join('');
  }

  // ── L4: 寵物 3 槽 ────────────────────────────────
  function _renderPets() {
    const el = document.getElementById('cs-pets-list');
    if (!el) return;
    const p = Stats.player;
    const slots = [
      { key: 'companion', label: '同伴' },
      { key: 'cell',      label: '牢房' },
      { key: 'outside',   label: '戶外' },
    ];
    const hasPet = slots.some(s => p.pets?.[s.key]?.id);
    if (!hasPet) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    el.innerHTML = slots.map(s => {
      const pet = p.pets?.[s.key];
      if (!pet || !pet.id) return '';
      const icon = pet.type === 'mouse' ? '🐭' : '🐾';
      return `<div class="cs-equip-row">
        <span class="cs-equip-slot">${s.label}</span>
        <span class="cs-equip-val" style="color:#d9c28f">${icon} ${pet.name}</span>
      </div>`;
    }).filter(Boolean).join('');
  }

  // ── L5: 資源 ────────────────────────────────────
  function _renderResources() {
    const p = Stats.player;
    const moneyEl = document.getElementById('cs-money');
    if (moneyEl) moneyEl.textContent = p.money || 0;
    // 🆕 D.6 v2：SP 欄位已移除（改為 EXP 單一資源）
  }

  // ── R1: 六角形屬性圖 ─────────────────────────
  const _HEX_AXES = ['STR','DEX','CON','AGI','WIL','LUK'];
  // 六個軸角度：從頂點開始順時針（STR 頂、DEX 右上、CON 右下、AGI 底、WIL 左下、LUK 左上）
  const _HEX_ANGLES = [
    -Math.PI/2,                  // STR  top      (0,-1)
    -Math.PI/2 + Math.PI/3,      // DEX  top-right
    -Math.PI/2 + 2*Math.PI/3,    // CON  bottom-right
     Math.PI/2,                  // AGI  bottom   (0,+1)
     Math.PI/2 + Math.PI/3,      // WIL  bottom-left
     Math.PI/2 + 2*Math.PI/3,    // LUK  top-left
  ];
  const _HEX_CENTER = 150;
  const _HEX_MAX_R  = 85;   // 對應數值 100
  const _HEX_LABEL_R = 108;
  const _HEX_VAL_R   = 140;

  let _hexSvgReady = false;

  /** 初始化 SVG 靜態元素（只做一次：參考環、軸線、玩家多邊形、軸名/值文字） */
  function _ensureHexSvg() {
    const svg = document.getElementById('cs-hex-svg');
    if (!svg || _hexSvgReady) return;

    const ns = 'http://www.w3.org/2000/svg';
    const c  = _HEX_CENTER;
    svg.innerHTML = '';

    // 參考環：20 / 40 / 60 / 80 / 100（以玩家值對應）
    const ringVals = [20, 40, 60, 80, 100];
    ringVals.forEach((rv, idx) => {
      const r = (rv / 100) * _HEX_MAX_R;
      const pts = _HEX_ANGLES.map(a => {
        const x = c + r * Math.cos(a);
        const y = c + r * Math.sin(a);
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      const poly = document.createElementNS(ns, 'polygon');
      poly.setAttribute('points', pts);
      poly.setAttribute('class', 'cs-hex-ring' + (idx === ringVals.length - 1 ? ' ring-outer' : ''));
      svg.appendChild(poly);
    });

    // 從中心到各頂點的軸線
    _HEX_ANGLES.forEach(a => {
      const x2 = c + _HEX_MAX_R * Math.cos(a);
      const y2 = c + _HEX_MAX_R * Math.sin(a);
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', c);
      line.setAttribute('y1', c);
      line.setAttribute('x2', x2.toFixed(1));
      line.setAttribute('y2', y2.toFixed(1));
      line.setAttribute('class', 'cs-hex-axis');
      svg.appendChild(line);
    });

    // 🆕 Raw ghost 多邊形（虛線外框，代表原始屬性、無懲罰）
    //    必須在 eff 多邊形之前建立，讓 eff 的實心填充能畫在上面
    const playerRaw = document.createElementNS(ns, 'polygon');
    playerRaw.setAttribute('id', 'cs-hex-player-raw');
    playerRaw.setAttribute('points', '');
    svg.appendChild(playerRaw);

    // 玩家多邊形（eff 有效值，實心金色；由 _renderHexagon 填入）
    const player = document.createElementNS(ns, 'polygon');
    player.setAttribute('id', 'cs-hex-player');
    player.setAttribute('points', '');
    svg.appendChild(player);

    // 軸名（STR/DEX/...）+ 數值文字
    _HEX_AXES.forEach((key, i) => {
      const a = _HEX_ANGLES[i];
      const lx = c + _HEX_LABEL_R * Math.cos(a);
      const ly = c + _HEX_LABEL_R * Math.sin(a);
      const vx = c + _HEX_VAL_R   * Math.cos(a);
      const vy = c + _HEX_VAL_R   * Math.sin(a);

      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', lx.toFixed(1));
      label.setAttribute('y', ly.toFixed(1));
      label.setAttribute('class', 'cs-hex-label');
      label.setAttribute('dominant-baseline', 'middle');
      label.textContent = key;
      svg.appendChild(label);

      const val = document.createElementNS(ns, 'text');
      val.setAttribute('x', vx.toFixed(1));
      val.setAttribute('y', vy.toFixed(1));
      val.setAttribute('class', 'cs-hex-val');
      val.setAttribute('id', 'cs-hex-val-' + key);
      val.setAttribute('dominant-baseline', 'middle');
      val.textContent = '—';
      svg.appendChild(val);
    });

    _hexSvgReady = true;
  }

  /** 以玩家當前六維重繪多邊形與數值文字。允許超過 100（超出六角形外框）。
   *  繪製兩層多邊形：raw ghost（虛線，原始屬性）+ eff solid（實心，有效值）。
   *  兩者在有體力懲罰/裝備加成時會錯開，直觀呈現「實際戰鬥發揮」vs「本體等級」。
   */
  function _renderHexagon() {
    const c = _HEX_CENTER;
    const p = Stats.player;

    // 計算兩組值
    const rawVals = _HEX_AXES.map(k => p[k] || 0);
    const effVals = _HEX_AXES.map(k => Stats.eff(k));

    // Raw ghost 多邊形（以原始屬性繪製）
    const rawPts = rawVals.map((v, i) => {
      const r = Math.max(0, v) / 100 * _HEX_MAX_R;
      const a = _HEX_ANGLES[i];
      return (c + r * Math.cos(a)).toFixed(1) + ',' + (c + r * Math.sin(a)).toFixed(1);
    }).join(' ');
    const rawPoly = document.getElementById('cs-hex-player-raw');
    if (rawPoly) rawPoly.setAttribute('points', rawPts);

    // eff 實心多邊形（有效值，受懲罰影響）
    const vals = effVals;
    const pts = vals.map((v, i) => {
      const r = Math.max(0, v) / 100 * _HEX_MAX_R;
      const a = _HEX_ANGLES[i];
      const x = c + r * Math.cos(a);
      const y = c + r * Math.sin(a);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    const poly = document.getElementById('cs-hex-player');
    if (poly) poly.setAttribute('points', pts);
    // 文字顯示 raw 原始屬性；若有體力懲罰則附加 "−N"
    _HEX_AXES.forEach((k, i) => {
      const el = document.getElementById('cs-hex-val-' + k);
      if (!el) return;
      const raw = Math.round(rawVals[i]);
      const pen = Math.round((p.staminaPenalty && p.staminaPenalty[k]) || 0);
      el.textContent = pen > 0 ? `${raw} (−${pen})` : `${raw}`;
    });
  }

  // ── R2: 派生屬性（5×2 格子，無 bar，純字） ─────
  function _renderDerivedGrid() {
    const d = Stats.calcDerived();
    const PCT_KEYS = new Set(['ACC','CRT','CDMG','BLK','BpWr','EVA']);
    Object.entries(d).forEach(([key, val]) => {
      const el = document.getElementById('cs-drv-' + key);
      if (!el) return;
      const rounded = Math.round(val);
      el.textContent = PCT_KEYS.has(key) ? rounded + '%' : rounded;
    });
  }

  // ── 🆕 D.6 v2: 屬性升級區（EXP 條 + 花 EXP 升級） ─────
  // 訓練累積 EXP → 玩家在這裡手動花 EXP 升級。EXP 不足時按鈕灰掉。
  function _renderAttrSpend() {
    const container = document.getElementById('cs-attr-spend');
    if (!container) return;
    const p = Stats.player;

    container.innerHTML = _HEX_AXES.map(key => {
      const lvl  = p[key] || 10;
      const exp  = p.exp?.[key] || 0;
      const cost = Stats.expToNext(lvl);
      const pct  = Math.min(100, Math.round(exp / cost * 100));
      const canAfford = exp >= cost;
      // 🆕 體力懲罰顯示
      const pen = Math.round((p.staminaPenalty && p.staminaPenalty[key]) || 0);
      const penTag = pen > 0
        ? `<span class="cs-spend-pen" title="體力耗盡，當前實力 ${lvl - pen}">⚠ −${pen}</span>`
        : '';
      const tooltip = canAfford
        ? `花費 ${cost} EXP 升級 ${key}（${lvl} → ${lvl + 1}）`
        : `還差 ${cost - exp} EXP`;
      const readyCls = canAfford ? ' cs-spend-ready' : '';
      return `
        <div class="cs-spend-card${readyCls}">
          <div class="cs-spend-head">
            <span class="cs-spend-label">${key}</span>
            <span class="cs-spend-val">${lvl}${penTag}</span>
            <button class="cs-spend-btn${readyCls}" data-spend-attr="${key}" ${canAfford ? '' : 'disabled'}
                    title="${tooltip}">升級</button>
          </div>
          <div class="cs-spend-exp-row">
            <div class="cs-spend-exp-track"><div class="cs-spend-exp-fill" style="width:${pct}%"></div></div>
            <span class="cs-spend-exp-num">${exp}/${cost}</span>
          </div>
        </div>`;
    }).join('');

    // 綁定點擊
    container.querySelectorAll('.cs-spend-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const attr = btn.dataset.spendAttr;
        const p = Stats.player;
        const lvl = p[attr] || 10;
        const cost = Stats.expToNext(lvl);
        const ok = Stats.spendExpOnAttr(attr);
        if (ok) {
          // 🆕 2026-04-24：升級反饋三層 — 大字 POPUP + 對白 log + 數字 log
          _showLevelUpFeedback(attr, Stats.player[attr], cost);
          _fillCharSheet();
          if (typeof Stats.renderAll === 'function') Stats.renderAll();
          // 🆕 D.28：同步更新右上角「詳細」按鈕的升級徽章
          _updateDetailReadyBadge();
        } else {
          // 🆕 2026-04-24：失敗也許是 fervor 擋住了 — 給更具體訊息
          //   Fervor.checkBreakthroughNeeded 會吃掉這次升級並觸發狂熱
          if (typeof Fervor !== 'undefined' && Fervor.isActive && Fervor.isActive() && Fervor.activeAttr() === attr) {
            showToast('還在狂熱中，先去把訓練做完');
          } else if ((p.exp[attr] || 0) < cost) {
            showToast('EXP 不足');
          } else {
            // 大概率是剛剛 hook 觸發了狂熱（演出已經在跑）
            showToast('身體還沒準備好——先把這份感覺練進去');
          }
        }
      });
    });
  }

  // 🆕 2026-04-24：屬性升級反饋（大字 POPUP + 對白池）
  //   不在 Stage 出現數字（rule § 0.1）— 數字只在下方 log 行
  const _LEVEL_UP_LINES = {
    STR: [
      '（你扛起平常那塊石頭——它沒變輕，是你的肩膀變寬了。）',
      '（你揮拳。對手接的時候退了半步。他自己也沒料到。）',
      '（手心的繭又厚了一層。這層你會記得。）',
    ],
    DEX: [
      '（你抓飛過去的蒼蠅——抓到了。你自己嚇一跳。）',
      '（你拋接碎石的時候，手指像是知道每顆石頭的軌跡。）',
    ],
    CON: [
      '（你跑完三圈之後還能說話。昨天不行。）',
      '（被人撞到——你沒退。對方退了。）',
    ],
    AGI: [
      '（瓦罐從架上滑落——你接住了。沒看見它掉。動作先到。）',
      '（長官的鞭子甩過來——你閃了。閃完才意識到。）',
    ],
    WIL: [
      '（疼痛還在，但變成了你可以放在旁邊的東西。）',
      '（長官在罵你——他的聲音很遠。）',
    ],
    LUK: [
      '（早上踩到的那塊石頭——平常你會跌倒。今天沒有。）',
    ],
  };

  function _showLevelUpFeedback(attr, newLvl, cost) {
    const attrNameMap = { STR:'力量', DEX:'靈巧', CON:'體質', AGI:'反應', WIL:'意志', LUK:'運氣' };
    const attrName = attrNameMap[attr] || attr;
    const pool = _LEVEL_UP_LINES[attr] || [];
    const line = pool.length ? pool[Math.floor(Math.random() * pool.length)] : '';

    // 大字 POPUP（無數字）
    if (typeof Stage !== 'undefined' && Stage.popupBig) {
      Stage.popupBig({
        icon: '✦',
        title: `${attrName} 提升`,
        subtitle: '',
        color: 'gold',
        duration: 1500,
        shake: true,
        sound: 'level_up',
      });
    }
    // 下方 log：對白行（情緒）+ 數字行
    if (line) addLog(line, '#d4af37', true, false);
    addLog(`✦ ${attrName} → ${newLvl}（消耗 ${cost} EXP）`, '#e8d070', false, false);
  }

  // ── R3: 當前狀態 ────────────────────────────────
  function _renderCurrentState() {
    const p = Stats.player;
    const rEl = document.getElementById('cs-state-religion');
    const fEl = document.getElementById('cs-state-faction');
    const wEl = document.getElementById('cs-state-world');
    if (rEl) rEl.textContent = p.religion || '—';
    if (fEl) fEl.textContent = p.faction  || '—';
    if (wEl) {
      const ws = (typeof GameState !== 'undefined' && GameState.get && GameState.get('worldState')) || 'peace';
      wEl.textContent = { peace:'和平', war:'戰亂期', plague:'瘟疫' }[ws] || '和平';
    }
  }

  // ── R4: 特性（沿用 Phase 1-D） ─────────────────
  // 空的時候整個區塊 display:none — 不顯示「尚無特性」這種廢話
  function _renderTraits() {
    const p = Stats.player;
    const traitsList = document.getElementById('cs-traits-list');
    if (!traitsList) return;
    // 🆕 2026-04-24：強制呼叫 Fervor.ensureInit 清掉廢棄 _addict 特性
    //   （之前殘留在存檔的 STR_addict/WIL_addict 等不再屬於合法 trait）
    if (typeof Fervor !== 'undefined' && Fervor.ensureInit) Fervor.ensureInit(p);
    // 渲染前再過一次 — 任何 TRAIT_DEFS 找不到的特性（廢棄、拼錯、舊檔殘留）都不顯示
    const traits = (p.traits || []).filter(id => Config.TRAIT_DEFS && Config.TRAIT_DEFS[id]);
    if (traits.length === 0) {
      traitsList.innerHTML = '';
      traitsList.style.display = 'none';
    } else {
      traitsList.style.display = '';
      traitsList.innerHTML = traits.map(id => {
        const def = Config.TRAIT_DEFS[id];
        const name = def.name;
        const desc = def.desc || '';
        const cat  = def.category || 'positive';
        const prefix = cat === 'positive' ? '★' : '▼';
        const cls    = cat === 'positive' ? 'trait-positive' : 'trait-negative';
        return `<span class="trait-tag ${cls}" title="${desc}">
          <span class="trait-prefix">${prefix}</span>${name}
        </span>`;
      }).join('');
    }
  }

  // ── R5: 疤痕（Phase 4 C.1 之前空） ─────────────
  function _renderScars() {
    const el = document.getElementById('cs-scars-list');
    if (!el) return;
    const scars = Stats.player.scars || [];
    if (scars.length === 0) {
      el.innerHTML = '';
      el.style.display = 'none';
    } else {
      el.style.display = '';
      el.innerHTML = scars.map(s => {
        const name = s.name || s.id || '?';
        const desc = s.desc || '';
        return `<span class="trait-tag trait-scar" title="${desc}">✖ ${name}</span>`;
      }).join('');
    }
  }

  // ── R6: 病痛（沿用 Phase 1-D） ─────────────────
  function _renderAilments() {
    const p = Stats.player;
    const ailmentsList = document.getElementById('cs-ailments-list');
    if (!ailmentsList) return;
    const ailments = p.ailments || [];
    if (ailments.length === 0) {
      ailmentsList.innerHTML = '';
      ailmentsList.style.display = 'none';
    } else {
      ailmentsList.style.display = '';
      ailmentsList.innerHTML = ailments.map(id => {
        const def  = Config.AILMENT_DEFS[id];
        const name = def ? def.name : id;
        const desc = def ? def.desc : '';
        return `<span class="trait-tag trait-ailment" title="${desc}">
          <span class="trait-prefix">⚕</span>${name}
        </span>`;
      }).join('');
    }

    // 三區都空 → 連「人物特質」section title 也隱藏
    const wrap = document.getElementById('cs-traits-all');
    if (wrap) {
      const hasAny = (Stats.player.traits || []).length > 0
                  || (Stats.player.scars  || []).length > 0
                  || ailments.length > 0;
      wrap.style.display = hasAny ? '' : 'none';
      // 對應的 section title（前一個兄弟節點）也一起藏
      const prevTitle = wrap.previousElementSibling;
      if (prevTitle && prevTitle.classList.contains('cs-section-title')
          && prevTitle.textContent.trim() === '人物特質') {
        prevTitle.style.display = hasAny ? '' : 'none';
      }
    }
  }

  // ── R7: 技能 ────────────────────────────────────
  function _renderSkills() {
    const skillList = document.getElementById('cs-skill-list');
    if (!skillList) return;
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

  // ══════════════════════════════════════════════════
  // 關係圖 Tab（原「所有人」，由關係圖按鈕觸發）
  // ══════════════════════════════════════════════════
  /** 好感等級 → 顯示文字（文字跟 teammates.getAffectionLevel 的 9 層對齊） */
  const _AFF_TIER_LABELS = {
    loyal:      { text: '忠誠'      },
    devoted:    { text: '崇敬'      },
    friendly:   { text: '友好'      },
    acquainted: { text: '認識'      },
    neutral:    { text: '中立'      },
    annoyed:    { text: '不悅'      },
    disliked:   { text: '厭惡'      },
    hated:      { text: '憎恨'      },
    nemesis:    { text: '不共戴天'  },
  };

  /**
   * 好感數值 → 卡片背景 tier class（9 層，對齊 getAffectionLevel）
   *   ≥90 loyal / ≥70 devoted / ≥40 friendly / ≥10 acquainted /
   *   ≥-9 neutral / ≥-29 annoyed / ≥-59 disliked / ≥-89 hated / 其他 nemesis
   */
  function _affValueToCardCls(val) {
    if (val >= 90)  return 'tier-loyal';
    if (val >= 70)  return 'tier-devoted';
    if (val >= 40)  return 'tier-friendly';
    if (val >= 10)  return 'tier-acquainted';
    if (val >= -9)  return 'tier-neutral';
    if (val >= -29) return 'tier-annoyed';
    if (val >= -59) return 'tier-disliked';
    if (val >= -89) return 'tier-hated';
    return 'tier-nemesis';
  }

  function _renderPeopleTab() {
    const grid = document.getElementById('cs-people-grid');
    const summary = document.getElementById('cs-people-summary');
    if (!grid) return;

    const allAff = teammates.getAllAffection();
    const visible = Object.entries(allAff)
      .filter(([id, val]) => val !== 0 || (teammates.getNPC(id)?.baseAffection || 0) !== 0)
      .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a));

    if (summary) summary.textContent = `你已與 ${visible.length} 人建立連結`;

    if (visible.length === 0) {
      grid.innerHTML = '<div class="cs-people-empty">尚未與任何人建立連結。<br>訓練場的每一次互動都可能改變命運。</div>';
      return;
    }

    grid.innerHTML = visible.map(([npcId, val]) => {
      const npc = teammates.getNPC(npcId);
      const name = npc?.name || npcId;
      const tier = teammates.getAffectionLevel(npcId);
      const tierInfo = _AFF_TIER_LABELS[tier] || { text: tier, cardCls: 'tier-neutral' };
      const cardCls = _affValueToCardCls(val);
      const fallback = name.slice(0, 2);
      // 🆕 D.12：取當前可見的 flavor 文字（沒有就 fallback）
      const flavor = (teammates.getVisibleFlavor && teammates.getVisibleFlavor(npcId))
                     || '你對他知之甚少。';
      // 🆕 2026-04-19：死亡狀態顯示（保留資料，加 💀 + gray 類別）
      const isDead = npc?.alive === false;
      const deadCls = isDead ? ' is-dead' : '';
      const deadBadge = isDead ? '<span class="cs-person-dead-badge" title="已逝">💀</span>' : '';
      const deadOverlay = isDead ? '<div class="cs-person-dead-tag">已逝</div>' : '';
      return `
        <div class="cs-person-card ${cardCls}${deadCls}">
          <div class="cs-person-portrait">${fallback}${deadOverlay}</div>
          <div class="cs-person-info">
            <div class="cs-person-head">
              <span class="cs-person-name">${name}${deadBadge}</span>
              <span class="cs-person-tier">${tierInfo.text}</span>
            </div>
            <div class="cs-person-flavor">${flavor}</div>
          </div>
        </div>`;
    }).join('');
  }

  // ══════════════════════════════════════════════════
  // 🆕 D.6 v2：技能 Tab
  // ══════════════════════════════════════════════════
  function _renderSkillsTab() {
    const p = Stats.player;

    // ── 六屬性 EXP 總覽 ───────────────────────
    const summary = document.getElementById('cs-exp-summary');
    if (summary) {
      summary.innerHTML = _HEX_AXES.map(k => `
        <div class="cs-exp-cell">
          <div class="cs-exp-cell-k">${k} EXP</div>
          <div class="cs-exp-cell-v">${p.exp?.[k] || 0}</div>
        </div>
      `).join('');
    }

    // ── 技能卡片（被動 + 劇情 + 主動 全部顯示）─────────────
    // 🆕 2026-04-27：解開 active 過濾、主動技能整合到角色頁
    const grid = document.getElementById('cs-skills-grid');
    if (!grid) return;
    const all = Object.values(Skills).filter(s => s.type === 'passive' || s.type === 'active');

    grid.innerHTML = all.map(s => {
      const learned = Stats.hasSkill(s.id);
      const costs   = Stats.getSkillCost(s.id) || {};
      const req     = s.unlockReq || {};
      const check   = Stats.canLearnSkill(s.id);
      const isActive = s.type === 'active';

      // 硬門檻（名聲）檢查
      const fameGate = req.fame && p.fame < req.fame;

      // 卡片狀態類別
      let cls = isActive ? 'active-skill' : '';
      if (learned)        cls += ' learned';
      else if (s.storyOnly) cls += ' story-locked';
      else if (check.ok)  cls += ' learnable';
      else                cls += ' locked';

      // 🆕 2026-04-25c：劇情技能不顯示 EXP 成本（不能用 EXP 買）
      let costHtml;
      if (s.storyOnly) {
        costHtml = learned
          ? `<span class="cost-attr ok">✦ 劇情獲得</span>`
          : `<span class="cost-attr short">🔒 劇情獲得（${s.grantedBy ? 'flag: ' + s.grantedBy : '待解鎖'}）</span>`;
      } else {
        costHtml = Object.entries(costs).map(([attr, cost]) => {
          const have = p.exp?.[attr] || 0;
          const ok   = have >= cost;
          const curLvl = p[attr] || 10;
          const minLvl = req[attr] || 0;
          const hasCatchup = minLvl && curLvl < minLvl;
          const catchupNote = hasCatchup
            ? ` <span class="cost-extra">（含 ${attr} ${curLvl}→${minLvl} 補差）</span>`
            : '';
          return `<span class="cost-attr ${ok ? 'ok' : 'short'}">${attr} ${cost} EXP（有 ${have}）</span>${catchupNote}`;
        }).join('');
      }

      // 按鈕文字與狀態
      let btnHtml;
      if (learned) {
        btnHtml = `<button class="cs-skill-card-btn learned" disabled>✔ ${s.storyOnly ? '劇情獲得' : '已習得'}</button>`;
      } else if (s.storyOnly) {
        btnHtml = `<button class="cs-skill-card-btn" disabled>🔒 待解鎖</button>`;
      } else if (fameGate) {
        btnHtml = `<button class="cs-skill-card-btn" disabled title="需名聲 ${req.fame}">需名聲 ${req.fame}</button>`;
      } else if (check.ok) {
        btnHtml = `<button class="cs-skill-card-btn" data-learn-skill="${s.id}">習得</button>`;
      } else {
        btnHtml = `<button class="cs-skill-card-btn" disabled>${check.reason || 'EXP 不足'}</button>`;
      }

      // 效果敘述：被動 = 加成、主動 = 武器類別 + 體力 + CD
      let effectHtml;
      if (isActive) {
        const wcText = Array.isArray(s.weaponClassAny)
          ? s.weaponClassAny.map(c => ({sword:'劍',blunt:'錘',axe:'斧',spear:'槍',dagger:'匕',fist:'拳'}[c] || c)).join('/')
          : '';
        const cd  = s.cooldown ? `cd ${s.cooldown}` : '';
        const sta = s.staminaCost ? `⚡${s.staminaCost}` : '';
        effectHtml = `⚔ 主動 · ${wcText} · ${sta} · ${cd}`;
      } else if (s.passiveBonus && Object.keys(s.passiveBonus).length > 0) {
        effectHtml = Object.entries(s.passiveBonus).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`).join(' / ');
      } else {
        effectHtml = s.storyOnly ? '✦ 劇情' : '被動';
      }

      return `
        <div class="cs-skill-card ${cls}">
          <div class="cs-skill-card-head">
            <span class="cs-skill-card-name">${s.name}</span>
            <span class="cs-skill-card-type">${effectHtml}</span>
          </div>
          <div class="cs-skill-card-desc">${s.desc}</div>
          <div class="cs-skill-card-cost">${costHtml}</div>
          ${btnHtml}
        </div>
      `;
    }).join('');

    // 綁定習得按鈕
    grid.querySelectorAll('[data-learn-skill]').forEach(btn => {
      btn.addEventListener('click', () => {
        const skillId = btn.dataset.learnSkill;
        const ok = Stats.learnSkill(skillId);
        if (ok) {
          const s = Skills[skillId];
          addLog(`✦ 你習得了【${s.name}】！${s.desc}`, '#e8d070', true);
          _fillCharSheet();
          _renderSkillsTab();
          if (typeof Stats.renderAll === 'function') Stats.renderAll();
        } else {
          showToast('無法習得此技能');
        }
      });
    });
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
                      // 🆕 D.19 道德累積滑動窗口
                      moralHistory:  p.moralHistory ? JSON.parse(JSON.stringify(p.moralHistory)) : null,
                      moralLocks:    p.moralLocks   ? { ...p.moralLocks } : null,
                      // 🆕 2026-04-27 recruit 池（深拷貝、每個 recruit 是物件）
                      recruits:      Array.isArray(p.recruits)
                                       ? p.recruits.map(r => ({ ...r }))
                                       : [],
                    },
      fieldId:      currentFieldId,
      gameState:    GameState.getSerializable(),
      npcAffection: teammates.getAllAffection(),
      flags:        Flags.getAll(),
      // 🆕 D.18 背景角鬥士熟悉度
      backgroundGladiators: (typeof BackgroundGladiators !== 'undefined')
                              ? BackgroundGladiators.serialize()
                              : null,
      // 🆕 D.21 晨思系統狀態
      morningThoughts: (typeof MorningThoughts !== 'undefined')
                         ? MorningThoughts.serialize()
                         : null,
      // 🆕 D.22 醫生訪問狀態
      doctorEvents: (typeof DoctorEvents !== 'undefined')
                      ? DoctorEvents.serialize()
                      : null,
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

    // 🆕 D.6 v2：讀檔後立刻整數化（屬性 + vitals），清除舊存檔小數
    if (typeof Stats.sanitizeAttrsToInt  === 'function') Stats.sanitizeAttrsToInt();
    if (typeof Stats.sanitizeVitalsToInt === 'function') Stats.sanitizeVitalsToInt();

    // 向下相容：舊存檔沒有這些欄位時補上預設值
    if (!Array.isArray(p.achievements))  p.achievements  = [];
    if (!Array.isArray(p.traits))        p.traits        = [];
    if (!Array.isArray(p.ailments))      p.ailments      = [];   // 🆕 Phase 1-D
    // 🆕 2026-04-27 recruit 池讀檔後重新註冊到 NPC_DEFS（讓 affection / flashNpcSlot 找得到）
    if (!Array.isArray(p.recruits)) p.recruits = [];
    if (typeof teammates !== 'undefined' && teammates.registerRecruit) {
      p.recruits.forEach(r => teammates.registerRecruit(r));
    }
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

    // 🆕 2026-04-19 讀書系統（v5→v6 欄位）
    if (p.discernment  === undefined) p.discernment  = 0;
    if (!Array.isArray(p.bookshelf))  p.bookshelf    = [];
    if (p.focusBookId  === undefined) p.focusBookId  = null;
    if (!Array.isArray(p.readBooks))  p.readBooks    = [];
    if (p.dullardStage === undefined) p.dullardStage = 0;
    if (!Array.isArray(p.weaponInventory)) p.weaponInventory = [];
    // 🆕 2026-04-19 傷勢系統（v5→v6 欄位 / v6→v7 加 mind）
    if (!p.wounds || typeof p.wounds !== 'object') {
      p.wounds = { head:null, torso:null, arms:null, legs:null, mind:null };
    }
    ['head','torso','arms','legs','mind'].forEach(part => {
      if (p.wounds[part] === undefined) p.wounds[part] = null;
    });
    // 🆕 2026-04-19：staminaMax 連動 CON 重算（舊存檔可能是 100 固定）
    if (typeof Stats.eff === 'function') {
      const targetStaminaMax = 50 + Math.round(5 * Stats.eff('CON'));
      if (p.staminaMax !== targetStaminaMax) {
        p.staminaMax = targetStaminaMax;
        p.stamina = Math.min(p.stamina, p.staminaMax);
      }
    }
    // 🆕 2026-04-24 狂熱系統（取代舊強迫症 p.compulsion）
    //   Fervor.ensureInit 會自動處理舊存檔遷移（p.compulsion → p.fervor + 清 _addict 特性）
    if (typeof Fervor !== 'undefined' && Fervor.ensureInit) {
      try { Fervor.ensureInit(p); } catch (e) { console.error('[Fervor] init', e); }
    }

    // GameState
    if (data.gameState) {
      GameState.loadFrom(data.gameState);
    } else {
      GameState.loadFrom({ fieldId: data.fieldId || FIXED_FIELD });
    }
    // 🆕 Phase 1 重構：強制鎖定到訓練場（無論存檔記錄哪個場地）
    GameState.setFieldId(FIXED_FIELD);
    currentFieldId = FIXED_FIELD;
    currentNPCs    = GameState.getCurrentNPCs();

    // 🆕 2026-04-25 防作弊：從存檔還原 NPC roll 結果，避免 F5 重抽
    //   GameState.loadFrom 已還原 dailyNPCMap / lastNPCRollDay
    //   這裡同步 main.js module-local 變數，rollDailyNPCs 守衛才會生效
    dailyNPCMap     = {};
    if (data.gameState && data.gameState.dailyNPCMap) {
      Object.keys(data.gameState.dailyNPCMap).forEach(fid => {
        dailyNPCMap[fid] = data.gameState.dailyNPCMap[fid];
      });
    }
    _lastNPCRollDay = GameState.getLastNPCRollDay();

    // NPC affection
    teammates.setAllAffection(data.npcAffection);

    // 🆕 D.19：讀檔後確保道德狀態存在，並用記錄重算 earned traits
    if (typeof Moral !== 'undefined') {
      Moral.ensureInit(p);
      Moral.recomputeAll();
    }

    // 🆕 D.18 背景角鬥士熟悉度
    if (typeof BackgroundGladiators !== 'undefined') {
      if (data.backgroundGladiators) {
        BackgroundGladiators.restore(data.backgroundGladiators);
      } else {
        BackgroundGladiators.reset();
      }
    }

    // 🆕 D.21 晨思系統狀態
    if (typeof MorningThoughts !== 'undefined') {
      if (data.morningThoughts) {
        MorningThoughts.restore(data.morningThoughts);
      } else {
        MorningThoughts.reset();
      }
    }

    // 🆕 D.22 醫生訪問狀態
    if (typeof DoctorEvents !== 'undefined') {
      if (data.doctorEvents) {
        DoctorEvents.restore(data.doctorEvents);
      } else {
        DoctorEvents.reset();
      }
    }

    // Story flags
    if (data.flags) Flags.loadFrom(data.flags);
    else            Flags.clear();

    // 🆕 2026-04-19：從 flag 還原 NPC alive 狀態（避免讀檔後死人復活）
    _syncNpcAliveFromFlags();

    return true;
  }

  /**
   * 🆕 2026-04-19：依 flag 同步 NPC 的 alive 狀態
   *   npc.js 的 npc.alive 只是 runtime 狀態，不進 save。
   *   死亡/復活的真相在 flag 裡（sol_dead / orlan_dead / betrayed_olan）。
   *   必須在讀檔後 + 新遊戲後 + 死亡事件後 呼叫，確保 UI 跟戰鬥邏輯一致。
   */
  function _syncNpcAliveFromFlags() {
    if (typeof teammates === 'undefined') return;
    const setAlive = (id, isDead) => {
      const npc = teammates.getNPC(id);
      if (npc) npc.alive = isDead ? false : true;
    };
    setAlive('sol',   Flags.has('sol_dead'));
    setAlive('orlan', Flags.has('orlan_dead') || Flags.has('betrayed_olan'));
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
    // 🆕 第一次進入（沒存檔）→ 遊戲介紹 → 開場動畫 → 名字輸入
    _showGameIntro(() => _playOpeningCinematic(() => {
      document.getElementById('modal-name')?.classList.add('open');
      document.getElementById('name-input')?.focus();
    }));
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
        achievements:[], traits:[], title:null, fameBase:0,  // 🆕 2026-04-19 特性由 applyOrigin + 擲骰決定，不再預設 kindness
        // 🆕 Phase 1-D 病痛/睡眠追蹤
        ailments:[], insomniaStreak:0, normalSleepStreak:0,  // 不再預設失眠，靠連續壞睡自然觸發
        // 🆕 D.12 故事揭露系統：清空已觸發記錄
        seenReveals: [],
        // 🆕 D.19 道德累積滑動窗口：重置為空
        moralHistory: { reliability:[], mercy:[], loyalty:[], pride:[], patience:[] },
        moralLocks:   {},
        staminaPenalty:{ STR:0, DEX:0, CON:0, AGI:0, WIL:0, LUK:0 },
        combatStats:{
          executionCount:0, spareCount:0, suppressCount:0,
          arenaWins:0, arenaLosses:0,
          sRankCount:0, aRankCount:0, totalTicks:0, winStreak:0,
        },
        // 🆕 2026-04-19 讀書系統
        discernment:0, bookshelf:[], focusBookId:null, readBooks:[],
        dullardStage:0, weaponInventory:[], armorInventory:[{id:'rags'}],
        // 🆕 2026-04-19 傷勢系統（含 mind 部位）
        wounds: { head:null, torso:null, arms:null, legs:null, mind:null },
        // 🆕 2026-04-24 狂熱系統（取代舊 compulsion）
        fervor: {
          active: null, source: null, progress: 0, target: 5,
          targetLevel: null, startDay: null, naturalCooldownUntil: null,
          trainingLog: { STR:[], DEX:[], AGI:[], CON:[], WIL:[] },
          passedBreakthroughs: { STR:[], DEX:[], AGI:[], CON:[], WIL:[] },
        },
      });
      Flags.clear();          // 清空所有故事旗標
      GameState.reset();       // 🆕 D.1.12: 清空 session state
      // 🆕 Phase 2 S1 前哨：把 NPC 好感重置回 baseAffection（不然上一存檔的值會殘留）
      if (typeof teammates !== 'undefined' && teammates.NPC_DEFS) {
        const resetMap = {};
        Object.values(teammates.NPC_DEFS).forEach(npc => {
          resetMap[npc.id] = npc.baseAffection || 0;
        });
        teammates.setAllAffection(resetMap);
      }
      // 🆕 2026-04-19：新遊戲清空死亡狀態（上次 session 的 sol.alive=false 要還原）
      _syncNpcAliveFromFlags();
      // 🆕 D.18：重置背景角鬥士熟悉度
      if (typeof BackgroundGladiators !== 'undefined') {
        BackgroundGladiators.reset();
      }
      // 🆕 D.21：重置晨思系統狀態
      if (typeof MorningThoughts !== 'undefined') {
        MorningThoughts.reset();
      }
      // 🆕 D.22：重置醫生訪問狀態
      if (typeof DoctorEvents !== 'undefined') {
        DoctorEvents.reset();
      }
      // 🆕 Phase 1 重構：強制鎖定到訓練場
      GameState.setFieldId(FIXED_FIELD);
      currentFieldId = FIXED_FIELD;
      currentNPCs    = GameState.getCurrentNPCs();

      // 🆕 遊戲介紹 → 開場動畫 → 名字輸入
      _showGameIntro(() => _playOpeningCinematic(() => {
        // 動畫結束後顯示名字輸入
        box.innerHTML = `
          <div class="modal-header"><span class="modal-title">你是誰</span></div>
          <div class="modal-body">
            <p style="color:var(--text-dim);font-size:24px;margin-bottom:12px;line-height:1.8">
              他們問你的名字。<br>不是因為在乎你——而是要刻在你的墓碑上。
            </p>
            <input type="text" id="name-input" maxlength="6" placeholder="輸入名字（最多六字）" autocomplete="off"/>
            <p class="name-hint">按 Enter 或點擊確認</p>
          </div>
          <div class="modal-footer">
            <button class="game-btn primary" id="btn-confirm-name">踏入命運</button>
          </div>`;
        document.getElementById('modal-name')?.classList.add('open');
        document.getElementById('btn-confirm-name')?.addEventListener('click', confirmName);
        document.getElementById('name-input')?.addEventListener('keydown', e => {
          if (e.key === 'Enter') confirmName();
        });
        document.getElementById('name-input')?.focus();
      }));
    });
  }

  // ══════════════════════════════════════════════════
  // 🆕 遊戲介紹（測試用，讓朋友知道這是什麼遊戲）
  // ══════════════════════════════════════════════════
  function _showGameIntro(onComplete) {
    document.getElementById('modal-name')?.classList.remove('open');

    const ov = document.createElement('div');
    ov.style.cssText = `
      position:fixed; inset:0; z-index:9999;
      background:rgba(0,0,0,0.92); display:flex;
      align-items:center; justify-content:center;
      opacity:0; transition:opacity .8s;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      max-width:560px; padding:40px 44px;
      font-family:var(--font); line-height:2.0;
      color:#c0b8a0; text-align:center;
    `;
    box.innerHTML = `
      <div style="font-size:28px;font-weight:900;color:#c8a060;letter-spacing:.3em;margin-bottom:24px;">
        百 日 萬 骸 祭
      </div>
      <p style="font-size:16px;color:#aa9060;font-weight:700;letter-spacing:.15em;margin-bottom:16px;">
        你不是英雄。你是一筆投資。
      </p>
      <p style="font-size:14px;line-height:2.0;color:#9a8c70;text-align:left;">
        被賣進角鬥場的那天，你失去了名字、自由，和所有選擇的權利。<br>
        每天的生活只有四件事：訓練、吃飯、訓練、睡覺。<br><br>
        但在這片沙地上，你會遇到願意把最後半塊麵包塞給你的兄弟，<br>
        會遇到用冷眼決定你生死的主人，<br>
        也會遇到你無論如何都救不了的人。<br><br>
        你的每一個選擇都會被記住——被身邊的人，也被你自己。<br><br>
        第一百天，萬骸祭的號角響起。<br>
        整座城市都在看著你。
      </p>
      <button id="intro-start-btn" style="
        margin-top:28px; padding:14px 48px;
        background:transparent; border:1px solid rgba(200,160,80,0.4);
        color:#c8a060; font-family:var(--font);
        font-size:18px; font-weight:700; letter-spacing:.2em;
        cursor:pointer; transition:background .2s;
      ">活 下 去</button>
    `;

    ov.appendChild(box);
    document.body.appendChild(ov);
    requestAnimationFrame(() => requestAnimationFrame(() => { ov.style.opacity = 1; }));

    const btn = box.querySelector('#intro-start-btn');
    btn.onmouseover = () => { btn.style.background = 'rgba(200,160,80,0.1)'; };
    btn.onmouseout  = () => { btn.style.background = 'transparent'; };
    btn.onclick = () => {
      ov.style.opacity = 0;
      // 🆕 D.28：介紹頁按完「活下去」→ 百日條揭露 Day 100 萬骸祭
      if (typeof Flags !== 'undefined') Flags.set('timeline_festival_revealed', true);
      setTimeout(() => { ov.remove(); onComplete(); }, 800);
    };
  }

  // ══════════════════════════════════════════════════
  // 🆕 開場動畫：startscene.png + 打字機文字 + 標題
  // ══════════════════════════════════════════════════
  function _playOpeningCinematic(onComplete) {
    // 隱藏 name modal（等動畫完再開）
    document.getElementById('modal-name')?.classList.remove('open');

    // 🆕 先預載圖片（4MB PNG 可能要時間），載完才開始動畫
    const preload = new Image();
    preload.src = 'asset/startscene.jpg';

    function _startCinematic() {
      _doCinematic(onComplete);
    }
    if (preload.complete) {
      _startCinematic();
    } else {
      preload.onload  = _startCinematic;
      preload.onerror = _startCinematic;  // 圖片載入失敗也繼續（只是沒背景）
    }
  }

  function _doCinematic(onComplete) {
    // 🆕 先把遊戲畫面藏起來（避免介紹頁淡出時閃到 UI）
    const gameRoot = document.getElementById('game-root');
    if (gameRoot) gameRoot.style.visibility = 'hidden';

    // 建立全螢幕覆蓋層
    const ov = document.createElement('div');
    ov.id = 'opening-cinematic';
    ov.style.cssText = `
      position:fixed; inset:0; z-index:9999;
      background:#000; display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      opacity:0; transition:opacity 1.2s;
    `;

    // 背景圖（用 img 元素確保載入）
    const img = document.createElement('img');
    img.src = 'asset/startscene.jpg';
    img.style.cssText = `
      position:absolute; inset:0; width:100%; height:100%;
      object-fit:cover; opacity:0.7; filter:brightness(0.6);
    `;
    ov.appendChild(img);

    // 文字容器
    const textBox = document.createElement('div');
    textBox.style.cssText = `
      position:relative; z-index:2; max-width:580px;
      padding:30px 40px; text-align:center;
      font-family:var(--font); line-height:2.2;
    `;
    ov.appendChild(textBox);

    document.body.appendChild(ov);

    // 淡入
    requestAnimationFrame(() => requestAnimationFrame(() => { ov.style.opacity = 1; }));

    const lines = [
      { text: '鐵鏈把你拖進一間石牆的房間。', delay: 1500 },
      { text: '地上有半顆爛蘋果和一碗髒水。', delay: 1200 },
      { text: '', delay: 600 },
      { text: '有人把你推了一下。你重摔在地上。', delay: 1200 },
      { text: '', delay: 800 },
      { text: '「吃了。睡了。明天開始訓練。」', delay: 1500, color: '#aa9060', italic: false },
      { text: '', delay: 600 },
      { text: '門在你身後關上。', delay: 1000 },
      { text: '鐵鎖的聲音在走廊迴盪了很久。', delay: 1500 },
      { text: '', delay: 800 },
      { text: '你不知道這是哪裡。', delay: 1200 },
      { text: '你只知道——', delay: 800 },
      { text: '這裡的日子，絕對不會好過。', delay: 2000, color: '#c8a060' },
    ];

    let skipRequested = false;
    const skipHandler = (e) => {
      if (e.key === 'Control' || e.key === 'Escape') skipRequested = true;
    };
    document.addEventListener('keydown', skipHandler);

    // 逐行打字顯示
    let lineIdx = 0;
    function showNextLine() {
      if (skipRequested || lineIdx >= lines.length) {
        // 顯示標題 + 按鈕
        _showOpeningTitle(ov, textBox, () => {
          document.removeEventListener('keydown', skipHandler);
          ov.style.opacity = 0;
          setTimeout(() => {
            ov.remove();
            // 🆕 恢復遊戲畫面
            const gr = document.getElementById('game-root');
            if (gr) gr.style.visibility = '';
            onComplete();
          }, 800);
        });
        return;
      }

      const line = lines[lineIdx++];
      if (!line.text) {
        // 空行 = 停頓
        setTimeout(showNextLine, skipRequested ? 0 : line.delay);
        return;
      }

      const p = document.createElement('p');
      p.style.cssText = `
        color:${line.color || '#c0b8a0'}; font-size:20px;
        letter-spacing:.08em; opacity:0; transition:opacity .6s;
        ${line.italic === false ? '' : 'font-style:italic;'}
        margin:0; padding:2px 0;
      `;

      // 打字機效果
      const fullText = line.text;
      p.textContent = '';
      textBox.appendChild(p);
      requestAnimationFrame(() => { p.style.opacity = 1; });

      if (skipRequested) {
        p.textContent = fullText;
        setTimeout(showNextLine, 50);
        return;
      }

      let charIdx = 0;
      const typeInterval = setInterval(() => {
        if (skipRequested) {
          clearInterval(typeInterval);
          p.textContent = fullText;
          setTimeout(showNextLine, 50);
          return;
        }
        if (charIdx < fullText.length) {
          p.textContent += fullText[charIdx++];
        } else {
          clearInterval(typeInterval);
          setTimeout(showNextLine, line.delay);
        }
      }, 45);
    }

    setTimeout(showNextLine, 1500);  // 圖片淡入後開始
  }

  function _showOpeningTitle(ov, textBox, onDone) {
    // 🆕 D.28：拿掉最後的「百日萬骸祭」標題（使用者要求）
    //   只保留「……活下去。」按鈕結束開場
    const btn = document.createElement('button');
    btn.style.cssText = `
      display:block; margin:40px auto 0;
      padding:12px 40px; background:transparent;
      border:1px solid rgba(200,160,80,0.4); color:#c8a060;
      font-family:var(--font); font-size:18px; letter-spacing:.2em;
      cursor:pointer; opacity:0; transition:opacity .8s, background .2s;
    `;
    btn.textContent = '……活下去。';
    btn.onmouseover = () => { btn.style.background = 'rgba(200,160,80,0.1)'; };
    btn.onmouseout  = () => { btn.style.background = 'transparent'; };
    btn.onclick = onDone;
    textBox.appendChild(btn);
    requestAnimationFrame(() => requestAnimationFrame(() => { btn.style.opacity = 1; }));
  }

  function confirmName() {
    const input = document.getElementById('name-input');
    let name = (input?.value || '').trim().slice(0, 6) || '無名';
    Stats.player.name = name;
    document.getElementById('modal-name')?.classList.remove('open');
    // 🆕 Phase 2 S1 前哨：接下來選背景
    openOriginModal();
  }

  // ══════════════════════════════════════════════════
  // 🆕 玩家背景選擇 modal
  // ══════════════════════════════════════════════════
  let _selectedOrigin = null;

  function openOriginModal() {
    const modal = document.getElementById('modal-origin');
    if (!modal || typeof Origins === 'undefined') {
      // Origins 未載入 → 跳過選擇直接進遊戲
      _enterNewGame();
      return;
    }
    _selectedOrigin = null;
    _renderOriginGrid();
    _renderOriginDetail(null);
    const btn = document.getElementById('btn-confirm-origin');
    if (btn) btn.disabled = true;
    modal.classList.add('open');
  }

  function _renderOriginGrid() {
    const grid = document.getElementById('origin-grid');
    if (!grid) return;
    const ids = ['farmBoy', 'nobleman', 'vagabond', 'gladiatorSon'];
    grid.innerHTML = ids.map(id => {
      const o = Origins[id];
      if (!o) return '';
      const fallback = (o.name || '').slice(0, 2);
      const cls = ['origin-card'];
      if (o.locked) cls.push('locked');
      if (_selectedOrigin === id) cls.push('selected');
      return `
        <div class="${cls.join(' ')}" data-origin="${id}">
          <div class="origin-card-portrait">${fallback}</div>
          <div class="origin-card-info">
            <div class="origin-card-name">${o.name}</div>
            <div class="origin-card-title">${o.title || ''}</div>
          </div>
        </div>`;
    }).join('');
    grid.querySelectorAll('.origin-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.origin;
        const o = Origins[id];
        if (!o || o.locked) return;
        _selectedOrigin = id;
        _renderOriginGrid();                // 更新 selected 樣式
        _renderOriginDetail(id);
        const btn = document.getElementById('btn-confirm-origin');
        if (btn) btn.disabled = false;
      });
    });
  }

  function _renderOriginDetail(id) {
    const panel = document.getElementById('origin-detail');
    if (!panel) return;
    if (!id) {
      panel.classList.add('origin-detail-empty');
      panel.innerHTML = '<div class="origin-detail-placeholder">選擇一個背景來查看詳情</div>';
      return;
    }
    const o = Origins[id];
    if (!o) return;
    panel.classList.remove('origin-detail-empty');

    // 屬性修正 chips
    let chips = '';
    if (o.statMod) {
      chips = Object.entries(o.statMod).map(([k, v]) => {
        const cls = v > 0 ? 'positive' : 'negative';
        const sign = v > 0 ? '+' : '';
        return `<span class="origin-stat-chip ${cls}">${k} ${sign}${v}</span>`;
      }).join('');
    }

    panel.innerHTML = `
      <div class="origin-detail-name">${o.name}</div>
      <div class="origin-detail-title">${o.title || ''}</div>
      <div class="origin-detail-desc">${o.desc || ''}</div>
      <div class="origin-detail-stats">${chips}</div>
    `;
  }

  function confirmOrigin() {
    if (!_selectedOrigin) return;
    const modal = document.getElementById('modal-origin');
    if (modal) modal.classList.remove('open');
    const originId = _selectedOrigin;
    const o = Origins[originId];

    // 開場動畫已在 _playOpeningCinematic 處理
    Stats.applyOrigin(originId);

    // 🆕 2026-04-19：擲骰畫面（屬性變動 + 出生特性 + 2 次重擲 + 被抓受傷）
    if (typeof CharacterRoll !== 'undefined') {
      CharacterRoll.start(originId, () => {
        _enterNewGame();
      });
    } else {
      _enterNewGame();
    }
  }

  /** 新遊戲真正開始（rollNPCs、Day 1 起床演出、resolve meal、save、render） */
  function _enterNewGame() {
    // 🆕 2026-04-19 修 bug：強制重置 _lastNPCRollDay，避免上次遊戲的 module state
    //   讓 rollDailyNPCs 誤判「今天已 roll」→ 導致 Day 1 沒隊友沒觀眾
    _lastNPCRollDay = -1;
    rollDailyNPCs();
    renderAll();

    // 🆕 Day 1 起床演出：黑幕 → 獄卒踢門 → 睜眼 → 長官訓話
    _playDay1WakeUp(() => {
      const f = FIELDS[currentFieldId];
      if (f) addLog('【' + f.name + '】\n' + f.logText, '#ddd', true);
      _resolveNonTrainingSlots();
      saveGame();
      renderAll();
    });
  }

  // ══════════════════════════════════════════════════
  // 🆕 Day 1 起床演出（D.28 v2 — 依 origin 分支 + 特性互動）
  //   對應設計：docs/quests/day1-opening.md
  //   現階段只做 farmBoy 路徑（kindness + diligence）
  // ══════════════════════════════════════════════════
  /**
   * 🆕 2026-04-19：取得開場受傷狀態（for Day 1 wakeup 演出整合）
   *   回傳 null（無傷）或 { hasWounds:true, lines:[...] }
   *   lines 是已經預組好的對白陣列，wakeup 直接插入即可
   */
  function _getStructuredWound(p) {
    if (!p || !p.wounds || typeof Wounds === 'undefined') return null;
    const partNames = Wounds.PART_NAMES;
    const sevNames = Wounds.SEVERITY_NAMES;
    const SPECIAL_LINES = {
      concussion:    '（你的視野晃了。腦子裡嗡嗡響。這他媽頭裡面怎了？）',
      achilles_tear: '（你要站起來 — 腳跟一陣劇痛。你幾乎跪下。這腳⋯⋯斷了嗎？）',
      insomnia:      '（你已經兩天沒闔眼了。每個聲音都在耳裡放大。手指在抖。）',
      depression:    '（你醒著。但什麼都提不起勁。胸口像壓著石頭。起床幹嘛？什麼都沒意思。）',
    };

    // 蒐集所有受傷部位（一般 + 特殊）
    const woundedParts = [];
    Wounds.PARTS.forEach(part => {
      const w = p.wounds[part];
      if (!w) return;
      woundedParts.push({ part, w });
    });
    if (woundedParts.length === 0) return null;

    // 先觸發紅光震動（只一次）
    const lines = [
      { text: '（⋯⋯！）' },
      { text: '（劇痛。你差點倒下。）' },
      { text: '（馬的⋯⋯想起來了。）' },
    ];

    // 每個傷一行對白（特殊傷用專屬 / 一般傷用 origin 回憶）
    woundedParts.forEach(({ part, w }) => {
      if (w.special) {
        lines.push({ text: SPECIAL_LINES[w.special] || `（${Wounds.SPECIAL_DEFS[w.special]?.name}⋯⋯）` });
      } else {
        const memoryLine = (typeof BirthTraits !== 'undefined' && BirthTraits._getMemoryLine)
          ? BirthTraits._getMemoryLine(p.origin, part)
          : '你記不清。只記得很痛。';
        const partName = partNames[part] || '身體';
        const sevName = sevNames[w.severity] || '傷';
        lines.push({ text: `（${memoryLine}）` });
        if (w.severity >= 2) {
          lines.push({ text: `（這${partName}${sevName}⋯⋯沒幾天不會好。）` });
        }
      }
    });

    // 傷多的話給個收尾
    if (woundedParts.length >= 2) {
      lines.push({ text: '（⋯⋯全身上下沒幾個好地方。）' });
    }
    if (woundedParts.some(x => x.w.special)) {
      lines.push({ text: '（這傷⋯⋯也許永遠好不了了。）' });
    }

    return { hasWounds: true, lines };
  }

  async function _playDay1WakeUp(onComplete) {
    const p = Stats.player;
    const origin = p?.origin || 'farmBoy';
    const hasKindness = Array.isArray(p?.traits) && p.traits.includes('kindness');
    const hasCruel    = Array.isArray(p?.traits) && p.traits.includes('cruel');

    // 先閉眼（確保黑幕狀態）
    if (typeof Stage !== 'undefined') await Stage.closeEyes();

    // ── 場景 1：牢房感官（夏日清晨，黑幕中）──
    // 🆕 2026-04-19：整合受傷演出。有結構化傷勢時在翻身時觸發紅光 + 多傷對白
    const woundInfo = _getStructuredWound(p);   // null | { hasWounds:true, lines:[...] }
    await new Promise(resolve => {
      const lines = [
        { text: '（雞啼。遠遠一聲。）' },
        { text: '（夏天的悶——空氣還沒動。）' },
        { text: '（你的後頸都是汗。）' },
        { text: '（你舔了舔嘴唇——甜的。是血。）' },
        { text: '（你的牙齒有一顆在晃。）' },
        { text: '（你翻身——身上每個關節都痛。）' },
      ];
      if (woundInfo && woundInfo.hasWounds) {
        // 插入所有傷的對白（已在 _getStructuredWound 預組好）
        lines.push(...woundInfo.lines);
        // 觸發紅光 + 震動
        _flashStageRed && _flashStageRed();
        _shakeGameRoot && _shakeGameRoot();
      } else {
        // 沒結構化傷勢 — 保留原本瘀青敘述
        lines.push({ text: '（昨晚的瘀青還在，有些還腫。）' });
      }
      // 🆕 2026-04-24：建立「同批三人同房」背景（CANON — 你 + 奧蘭 + 索爾）
      //   讓後面奧蘭靠過來時玩家能 recognize「昨晚那個捲髮的」。
      //   索爾先不點名，只留「角落那個大個子」印象給 Day 5 沙洗收線。
      lines.push({ text: '（天色才剛亮。你側頭——你不是一個人。）' });
      lines.push({ text: '（昨晚他們把你推進來的時候，這間牢房裡已經塞了另外兩個人。）' });
      lines.push({ text: '（離你不遠蜷著一個捲髮的年輕人——比你矮一點，比你年輕一點。）' });
      lines.push({ text: '（他醒著。他在發抖。但他從進來到現在，一句話都沒說。）' });
      lines.push({ text: '（牢房最裡面的角落坐著另一個——高大、沒動、臉埋在手臂裡。像一塊放了很久的石頭。）' });
      lines.push({ text: '（三個人都是昨天才被押來的。你連他們的名字都不知道。）' });
      DialogueModal.play(lines, { onComplete: resolve });
    });

    // ── 場景 2：獄卒踢門 ──
    // 🆕 2026-04-24：台詞點出「三個新貨」，並補一段起床時看另外兩人的側寫
    await new Promise(resolve => {
      DialogueModal.play([
        { text: '砰——' },
        { text: '（鐵門撞開。聲音在石牆之間彈了好幾下。你的耳朵嗡的一聲。）' },
        { speaker: '獄卒', text: '起床！三個臭貨！' },
        { speaker: '獄卒', text: '還在睡？太陽都曬屁股了！' },
        { speaker: '獄卒', text: '給我滾起來——去訓練場集合！' },
        { speaker: '獄卒', text: '今天起你們是貨，不是人——懂嗎？' },
        { text: '（他踹你一腳。你撞到角落的牆。）' },
        { text: '（昨晚重摔的傷口又裂開了一點。）' },
        { text: '（那顆晃的牙齒——晃得更兇了。）' },
        { text: '（你側頭——捲髮那個已經爬起來了，手一直在抖，沒說話。他跟獄卒對上眼的瞬間立刻低頭。）' },
        { text: '（角落那個大個子還沒動。獄卒走過去，重重踢了他一腳——他才慢慢站起來。慢得像每個動作都很沉。）' },
        { text: '（你們三個互相看了一眼。沒人開口。然後被推出門。）' },
      ], { onComplete: resolve });
    });

    // ── 場景 3：玩家內心（依 origin）──
    await new Promise(resolve => {
      let lines;
      if (origin === 'nobleman') {
        // 🔒 貴族路徑（尚未解鎖，保留參考）
        lines = [
          { text: '（你坐起來。手還在抖。）' },
          { text: '（⋯⋯「訓練場」。你腦子裡閃過一段小時候讀過的書。）' },
          { text: '（⋯⋯「血洗」、「沙場認證」。書上寫的。）' },
          { text: '（你告訴自己不要胡思亂想。——但我一定要活下來。）' },
        ];
      } else {
        // farmBoy（預設）— 沒知識亂想
        lines = [
          { text: '（你沒說話。只是摸著自己的嘴角。）' },
          { text: '（「訓練場」——是什麼地方？你在村子裡只聽過「穀場」。）' },
          { text: '（大概也是排成一排做一樣的事吧。）' },
          { text: '（只是這次的工頭比較兇。）' },
        ];
      }
      DialogueModal.play(lines, { onComplete: resolve });
    });

    // 睜眼（走出牢房的瞬間，掀開黑幕）
    if (typeof Stage !== 'undefined') await Stage.openEyes();

    // ── 場景 3.5a：石走廊（Spartacus 氛圍 + 視覺伏筆 + 赫克特假善意）──
    await new Promise(resolve => {
      DialogueModal.play([
        { text: '（你走出牢房門。）' },
        { text: '（眼前是一條長長的、陰暗的石廊。）' },
        { text: '（空氣比牢房裡還悶。汗馬上又流出來了。）' },
        { text: '（牆上每隔幾步有一根火把。光線跳動。）' },
        { text: '（走廊裡已經有一些人——不是新進的。）' },
        { text: '（他們站著、靠牆、或拿著東西經過。）' },
        { text: '（他們盯著你。）' },
        { text: '（⋯⋯這些都是誰？）' },
        { text: '（你不自覺放慢了腳步。）' },
        // 疤臉視覺伏筆
        { text: '（靠牆站著一個男人。他的左臉有一條從眉骨到下巴的疤——又深又粗。）' },
        { text: '（⋯⋯這疤看起來真恐怖。是怎麼來的？）' },
        { text: '（他看你的時候連眼皮都沒眨。）' },
        // 假手視覺伏筆
        { text: '（再往前——一個男人走過。他的右手⋯⋯）' },
        { text: '（⋯⋯那個是木頭？假的手掌？）' },
        { text: '（木頭的指節還會動。他跟你四目相交——你先移開。）' },
        // 嘲諷壯漢
        { text: '（一個壯漢扛著一個破沙袋經過你身邊。他的手臂比你的大腿還粗。）' },
        { speaker: '壯漢', text: '（嘖）又一批？' },
        { speaker: '壯漢', text: '⋯⋯撐過一週再說吧。' },
        // 唾棄老鬥士
        { text: '（再往前——一個疤臉老鬥士吐了一口痰。剛好在你腳邊。）' },
        { speaker: '疤臉老鬥士', text: '哼～新鮮肉。' },
        { speaker: '疤臉老鬥士', text: '⋯⋯看你幾天後變成臭肉。' },
        // 血狼（種子鬥士伏筆）
        { text: '（突然——走廊裡的人全部停下來，然後讓開一條路。）' },
        { text: '（一個人走過。他戴著一條黑鐵鑄的頸圈。）' },
        { text: '（他沒有贅肉。他走路的樣子像刀。）' },
        { speaker: '???（小聲）', text: '⋯⋯那是「血狼」伍爾克。上一季二十七戰全勝。' },
        { speaker: '???（小聲）', text: '阿圖斯大人的招牌。' },
        { text: '（他沒看你。你也沒敢看他太久。）' },
        { text: '（你只記住了那條黑鐵頸圈，跟他走路的背影。）' },
        { text: '（他走遠了——走廊裡的空氣才鬆開。）' },
        // 赫克特的自來熟試探（Phase 1 設計：他對所有人都這麼起手，看玩家怎麼回應決定拉攏還是修理）
        { text: '（再走幾步，一個笑嘻嘻的男人靠過來。）' },
        { text: '（他的手拍了一下你肩膀——有點太熟了。）' },
        { speaker: '赫克特', text: '哎喲，新來的。' },
        { speaker: '赫克特', text: '別緊張嘛。我叫赫克特。' },
        { speaker: '赫克特', text: '這裡不難混——只要跟對人。' },
        { speaker: '赫克特', text: '有什麼不懂的，問我就對了。' },
        { text: '（這人是怎樣？）' },
        { text: '（他等你的反應。）' },
      ], { onComplete: resolve });
    });

    // 記錄玩家見過「血狼」伍爾克（未來對戰時引用）
    Flags.set('met_blood_wolf_day1', true);
    // 2026-04-24：移除 hector_fake_friendly_day1 — audit 已標記「後續無引用」，
    //   Phase 1 重寫後赫克特的友善/敵意由玩家選擇（hector_friendly_path / hector_hostile_path）
    //   決定，不再是「預設假善意」的舊框架。

    // 🆕 2026-04-23：玩家選擇 — 笑臉點頭 / 臭臉拒絕（分岔點）
    await new Promise(resolve => {
      if (typeof HectorEvents !== 'undefined' && HectorEvents.showDay1Choice) {
        HectorEvents.showDay1Choice(resolve);
      } else {
        resolve();
      }
    });

    // ── 場景 3.5b：特性即時互動（遇到達吉）──
    await new Promise(resolve => {
      let lines;
      if (hasCruel) {
        // cruel 路徑（農家預設不會，保險起見）
        lines = [
          { text: '（再往前——一個男孩擋在你路上，縮著身子哭。）' },
          { text: '（你沒思考——踢了他一腳。）' },
          { speaker: '男孩', text: '嗚啊——！' },
          { text: '（他摔在地上。獄卒在遠處聽到，抬頭看了一眼，又低頭啃他的饅頭。）' },
          { text: '（但後面有個捲髮的年輕人看見了。他的眼神變了。）' },
        ];
      } else if (hasKindness) {
        // farmBoy 預設路徑（kindness）
        lines = [
          { text: '（繼續往前——你看見一個男孩蹲在牆邊哭。）' },
          { text: '（他看起來比你小得多。他抓著自己的手腕在發抖。）' },
          { text: '（你沒多想——伸手把他扶起來。）' },
          { speaker: '你', text: '⋯⋯深呼吸。你站得起來。' },
          { speaker: '男孩（小聲）', text: '⋯⋯謝謝。' },
          { speaker: '男孩（小聲）', text: '我叫⋯⋯達吉。' },
          { text: '（你聽見後面有腳步聲。）' },
          { text: '（是另一個捲髮的年輕人——他剛好看到這一幕。）' },
          { text: '（他對你笑了一下。眼睛先彎的那種笑。）' },
        ];
      } else {
        // baseline（農家一定有 kindness，這個基本不會走到）
        lines = [
          { text: '（一個男孩擋在你路上。你繞過去，沒停。）' },
          { text: '（他看了你一眼。你沒看他。）' },
        ];
      }
      DialogueModal.play(lines, { onComplete: resolve });
    });

    // 🆕 D.28：套用特性互動效果（透過 Effects.apply 自動 log）
    if (hasCruel) {
      Effects.apply([
        { type:'affection', key:'dagiSlave', delta:-20 },
        { type:'affection', key:'orlan',     delta:-15 },
        { type:'flag', key:'day1_kicked_dagi' },
      ]);
    } else if (hasKindness) {
      Effects.apply([
        { type:'affection', key:'dagiSlave', delta:+15 },
        { type:'affection', key:'orlan',     delta:+10 },
        { type:'flag', key:'day1_helped_dagi' },
      ]);
    } else if (typeof teammates !== 'undefined') {
      Effects.apply([
        { type:'affection', key:'dagiSlave', delta:-3 },
      ]);
    }

    // ── 場景 4：走向訓練場（感官 + 器材細節）──
    await new Promise(resolve => {
      DialogueModal.play([
        { text: '（你走進訓練場。）' },
        { text: '（腳底是沙——早晨的沙還是涼的，但空氣已經悶了。）' },
        { text: '（場邊堆著幾個沙袋——有些已經破了，沙從裂口漏出來。）' },
        { text: '（一排木樁立在中央。每根木樁上都有被砍出來的凹痕，密密麻麻。）' },
        { text: '（兵器架上掛著練習武器——鈍的木劍、缺角的盾、無刃的斧。）' },
        { text: '（有些柄上的木紋已經被磨得光滑。）' },
        { text: '（你聞到血味、汗味，還有什麼東西在燒——是早餐的爐子？）' },
        { text: '（一排比你先到的人站在場中央——他們的眼睛裡沒有顏色。）' },
        { text: '（角落裡有人在練劍。每一下都像在砍一個他恨的人。）' },
        { text: '（蟲在某個地方叫。夏天的蟲。）' },
        { text: '（你站到隊伍後面。沒人看你。）' },
      ], { onComplete: resolve });
    });

    // ── 場景 5：塔倫訓話（修正版 — 阿圖斯大人的所有物） ──
    await new Promise(resolve => {
      DialogueModal.play([
        { text: '（一個人從高台走下來。他手裡拿著鞭子——但沒在用。）' },
        { speaker: '???', text: '嗯⋯⋯都到齊了？' },
        { text: '（他環視一圈。停在你身上半秒。——就半秒。）' },
        { speaker: '塔倫長官', text: '我叫塔倫。' },
        { speaker: '塔倫長官', text: '你們——知道你們現在在哪嗎？' },
        { text: '（沒人敢出聲。）' },
        { speaker: '塔倫長官', text: '這裡，是我們偉大的阿圖斯大人的訓練場。' },
        { speaker: '塔倫長官', text: '你們——都是阿圖斯大人的所有物。' },
        { speaker: '塔倫長官', text: '別忘了這件事。' },
        { speaker: '塔倫長官', text: '在這裡只有一個規則。我只說一次——你們給我聽好！' },
        { speaker: '塔倫長官', text: '吃飯、訓練、睡覺。' },
        { speaker: '塔倫長官', text: '——就那麼簡單。' },
        { speaker: '塔倫長官', text: '但能撐到後面的人，不多。' },
        { text: '（他停了一下。他的嘴角挑了一下。）' },
        { speaker: '塔倫長官', text: '然後——' },
        { speaker: '塔倫長官', text: '五天後，有一件事。' },
        { speaker: '塔倫長官', text: '我把它叫做「沙洗」。' },
        { speaker: '塔倫長官', text: '你們現在不需要知道那是什麼——到那天你們自會知道。' },
        { speaker: '塔倫長官', text: '希望那天，你們都不會讓我失望。' },
        { text: '（幾個人不敢出聲。你也是。）' },
        { speaker: '塔倫長官', text: '總之給我拿出吃奶的力氣練。五天！' },
        { speaker: '塔倫長官', text: '不然的話——' },
        { speaker: '塔倫長官', text: '——呵呵。' },
        { text: '（他的鞭子抽向地面，揚起塵沙。）' },
        { text: '（他沒說完。但所有人都懂。）' },
        { speaker: '塔倫長官', text: '散了。' },
      ], { onComplete: resolve });
    });

    // 塔倫介紹「沙洗」→ 百日條揭露 Day 5 + 記錄阿圖斯大人名字揭露
    Flags.set('timeline_sand_wash_revealed', true);
    Flags.set('met_officer', true);
    Flags.set('master_artus_name_known', true);

    // ── 場景 6：散場內心（依 origin）──
    await new Promise(resolve => {
      let lines;
      if (origin === 'nobleman') {
        // 🔒 貴族（未實作）
        lines = [
          { text: '（你的腦子裡有個詞在迴響：「沙洗」。）' },
          { text: '（⋯⋯書上有段。「以沙磨去不足之人」。）' },
          { text: '（你的手又開始抖。——我不能死在這種地方。）' },
        ];
      } else {
        // farmBoy
        lines = [
          { text: '（你沒動。你腦子裡還在回想「沙洗到底是啥」。）' },
          { text: '（把我們埋進去沙子裡面洗乾淨?）' },
          { text: '（這樣不就死了?）' },
        ];
      }
      DialogueModal.play(lines, { onComplete: resolve });
    });

    // ── 場景 6.5：鞭子醒來 🆕 ──
    // 玩家發呆太久，被訓練所規則教育
    _flashStageRed();
    _shakeGameRoot();
    if (typeof SoundManager !== 'undefined') SoundManager.playSynth('sword_swing');
    Stats.modVital('hp', -5);
    await new Promise(resolve => {
      DialogueModal.play([
        { text: '咻——！' },
        { text: '（一條鞭子抽在你背上。）' },
        { text: '（痛——！）' },
        { speaker: '???', text: '發呆？你以為這裡是你家後院？' },
        { text: '（你急忙回神。發現所有人都已經散開了——只有你還站在原地。）' },
        { text: '（你沒來得及看清打你的是誰。）' },
        { text: '（你急急忙忙往訓練器材那邊走。）' },
      ], { onComplete: resolve });
    });

    // ── 場景 7：奧蘭第一次接觸 ──
    await _playDay1OrlanMeet();

    // 🆕 D.28：Day 1 已經演了奧蘭初遇，把舊版 storyReveal 標為「已看過」避免重複
    if (!Array.isArray(Stats.player.seenReveals)) Stats.player.seenReveals = [];
    if (!Stats.player.seenReveals.includes('orlan_first_night_oath')) {
      Stats.player.seenReveals.push('orlan_first_night_oath');
    }

    onComplete();
  }

  // 🆕 D.28：舞台紅光閃動（被鞭等痛感演出）
  // 🆕 2026-04-24：strong 參數 — 紅光更紅、覆蓋更久（用於被鞭等重戲）
  function _flashStageRed(strong) {
    const view = document.getElementById('scene-view');
    if (!view) return;
    const flash = document.createElement('div');
    flash.className = strong ? 'stage-red-flash strong' : 'stage-red-flash';
    view.appendChild(flash);
    const dur = strong ? 1200 : 600;
    setTimeout(() => { if (flash.parentNode) flash.remove(); }, dur);
  }
  // 🆕 D.28：全畫面震動 / 🆕 2026-04-24：strong 參數 — 振幅 ×2、持續更久
  function _shakeGameRoot(strong) {
    const root = document.getElementById('game-root');
    if (!root) return;
    const cls = strong ? 'shake-pain-strong' : 'shake-pain';
    root.classList.remove('shake-pain', 'shake-pain-strong');
    void root.offsetHeight;   // force reflow
    root.classList.add(cls);
    const dur = strong ? 800 : 500;
    setTimeout(() => root.classList.remove(cls), dur);
  }

  // 🆕 Day 1 結尾：奧蘭握手（依玩家之前的表現變化）
  async function _playDay1OrlanMeet() {
    const p = Stats.player;
    const hasKindness = Array.isArray(p?.traits) && p.traits.includes('kindness');
    const hasCruel    = Array.isArray(p?.traits) && p.traits.includes('cruel');
    const helpedDagi  = Flags.has('day1_helped_dagi');
    const kickedDagi  = Flags.has('day1_kicked_dagi');

    // 基礎開場（所有路徑共通）
    // 2026-04-24 改寫：把「你好我叫奧蘭，以後請多指教」換成有溫度的版本
    //   - 先擔心你（「你沒事吧」）而不是社交自介
    //   - 摸手腕（妹妹印記，character file 招牌動作）
    //   - 壓低聲音（走廊、怕被獄卒聽到）
    //   - CANON 鐵則：只說「磨坊裡來的」，刻意不提主人家 6 年
    //   - 保留末尾「伸手 + 手指抖 + 文員的手」讓後續 cruel 分支接得上
    //   - recognize：他是「昨晚跟你同一間」的那個捲髮年輕人（前面牢房場景已鋪陳）
    await new Promise(resolve => {
      DialogueModal.play([
        { text: '（你感覺有人碰了你一下——很輕，像怕嚇到你。）' },
        { text: '（你轉頭。）' },
        { text: '（是昨晚跟你同一間牢房的那個捲髮年輕人。他剛才一整條走廊都沒敢靠近你——現在才鼓起勇氣。）' },
        { text: '（他比你矮一點。臉還沒長開。左手無意識地捏著自己右手腕——捏、鬆、又捏。）' },
        { speaker: '奧蘭（小聲）', text: '你⋯⋯你沒事吧？' },
        { text: '（他沒等你答，眼神已經在你身上掃過一遍——像在找傷口。）' },
        { speaker: '奧蘭', text: '我叫奧蘭。磨坊裡來的。' },
        { text: '（他停了一下，像要多說什麼，又嚥了回去。）' },
        { speaker: '奧蘭', text: '你也是⋯⋯昨天被推上車的？' },
        { text: '（你點頭。他肩膀鬆了一下，但又立刻繃回來。）' },
        { speaker: '奧蘭', text: '⋯⋯那就好。' },
        { speaker: '奧蘭', text: '我還以為，這裡面只有我一個新的。' },
        { text: '（他伸出手。你看見他的手指在抖。）' },
        { text: '（你看著那隻手——關節粗糙，但不像訓練過的手。像個文員的手。）' },
      ], { onComplete: resolve });
    });

    // cruel + 踢過達吉 → 奧蘭警戒
    if (kickedDagi || hasCruel) {
      await new Promise(resolve => {
        DialogueModal.play([
          { text: '（他伸手但沒伸完——他看過你踢達吉。他的眼神裡有警戒。）' },
          { speaker: '奧蘭', text: '我⋯⋯我不該來。' },
          { speaker: '奧蘭', text: '你⋯⋯別來找我就好。' },
          { text: '（他沒等你回應就走了。）' },
        ], { onComplete: resolve });
      });
      Effects.apply([
        { type:'affection', key:'orlan', delta:-5 },
        { type:'flag', key:'orlan_day1_wary' },
        { type:'flag', key:'orlan_initial_met' },
      ]);
      return;
    }

    // kindness + 救過達吉 → 奧蘭讚賞
    let preLines;
    if (helpedDagi) {
      preLines = [
        { text: '（他先看了達吉一眼，然後看你。）' },
        { speaker: '奧蘭', text: '你剛剛⋯⋯做的事情，我看到了。' },
        { speaker: '奧蘭', text: '⋯⋯謝謝你沒跨過他。' },
      ];
    } else {
      preLines = [];
    }

    await new Promise(resolve => {
      DialogueModal.play([
        ...preLines,
        { speaker: '奧蘭', text: '那個「沙洗」——你知道是什麼嗎？' },
        { text: '（你搖頭。）' },
        { speaker: '奧蘭', text: '我也不知道細節。' },
        // 🆕 2026-04-19：暗示奧蘭有主人家人脈（老僕人身分）
        { speaker: '奧蘭', text: '⋯⋯但我有聽過。' },
        { speaker: '奧蘭', text: '我有幾個舊朋友 — 晚點我探探看。' },
        { speaker: '奧蘭', text: '但塔倫長官看起來不是開玩笑的人。' },
        { text: '（他苦笑了一下。眼睛先彎起來的那種笑——但笑沒到眼睛。）' },
        { speaker: '奧蘭', text: '我們⋯⋯一起活下去吧？' },
      ], { onComplete: resolve });
    });

    // 三選項
    await new Promise(resolve => {
      if (typeof ChoiceModal === 'undefined') {
        // fallback：預設選第一個
        if (typeof teammates !== 'undefined') teammates.modAffection('orlan', +5);
        Flags.set('orlan_day1_oath', true);
        Flags.set('orlan_initial_met', true);
        resolve();
        return;
      }
      ChoiceModal.show({
        id:    'orlan_day1_handshake',
        icon:  '🤝',
        title: '奧蘭的手',
        body:  '他的手指在抖，但他伸給你了。',
        forced: true,
        choices: [
          {
            id:    'oath',
            label: '好，我們一起努力吧！',
            hint:  '（你握了他的手。）',
            effects: [
              { type: 'affection', key: 'orlan', delta: +5 },
              { type: 'flag', key: 'orlan_day1_oath' },
              { type: 'flag', key: 'orlan_initial_met' },
            ],
            resultLog: '你握了他的手。他的手比你想像的還冷——但他沒放。',
            logColor:  '#d4af37',
          },
          {
            id:    'nod',
            label: '（點頭）',
            hint:  '你沒說話，但你點了頭。',
            effects: [
              { type: 'affection', key: 'orlan', delta: +3 },
              { type: 'flag', key: 'orlan_initial_met' },
            ],
            resultLog: '你點了頭。他也點了頭。你們什麼都沒說——但什麼都知道。',
            logColor:  '#c8a060',
          },
          {
            id:    'reject',
            label: '⋯⋯我還不認識你。',
            hint:  '你沒握手。',
            effects: [
              { type: 'affection', key: 'orlan', delta: -2 },
              { type: 'flag', key: 'orlan_day1_rejected' },
              { type: 'flag', key: 'orlan_initial_met' },
            ],
            resultLog: '他收回手。他沒生氣——但那個笑消失了。',
            logColor:  '#8899aa',
          },
        ],
      }, {
        onChoose: () => resolve(),
      });
    });

    // 🆕 2026-04-24：索爾 Day 1 視覺印象（CANON 三人同批）
    //   Sol character file 鐵則：Day 1 完全不講話、瘸腿、空洞眼神、胸前掛女兒木牌（Day 5 遺物伏筆）。
    //   奧蘭當 narrator（他也只是同批新人，連名字都不知道）— 除非玩家剛拒絕了奧蘭。
    //   目的：讓玩家在 Day 5 沙洗時能 recall「那個角落的大個子」，而不是突然冒出一個陌生名字。
    const orlanRejected = Flags.has('orlan_day1_rejected');
    await new Promise(resolve => {
      const lines = [
        { text: '（你準備往訓練場走——眼角瞥到牆邊還靠著一個人。）' },
        { text: '（是牢房角落那個大個子。）' },
        { text: '（他沒加入走廊的人流。只是靠著牆，一隻腿伸得比較長——那條腿站起來看起來不太對勁。）' },
        { text: '（他看著遠方，什麼也沒看。）' },
        { text: '（你跟他對上眼。）' },
        { text: '（不是冷漠。也不是敵意。只是——什麼都沒有。）' },
        { text: '（他的眼神從你身上穿過去，落在牆後面的什麼地方。）' },
        { text: '（你注意到他胸前掛著一個歪歪斜斜的小木牌。像是什麼字——但距離太遠你看不清。）' },
      ];
      if (!orlanRejected) {
        // 奧蘭幫你做 narrator（他自己也只是同批新人）
        lines.push(
          { text: '（奧蘭順著你的視線看過去。他壓低聲音。）' },
          { speaker: '奧蘭（小聲）', text: '⋯⋯他也是昨天跟我們一起進來的。' },
          { speaker: '奧蘭', text: '但從昨天到現在，他一個字都沒說過。' },
          { speaker: '奧蘭', text: '我昨晚試著問過他——他沒看我。' },
          { speaker: '奧蘭', text: '⋯⋯我也不知道他叫什麼。' },
          { text: '（你跟奧蘭對看一眼。沒再說什麼。）' },
        );
      } else {
        // 玩家拒絕握手 — 奧蘭還在旁邊但沒搭話
        lines.push(
          { text: '（奧蘭在你後面幾步。他沒靠過來。他也在看那個大個子。）' },
          { text: '（你們三個人——昨天才被塞進同一間牢房。你們誰都不認識誰。）' },
        );
      }
      lines.push({ text: '（那個大個子沒動。你別開視線，繼續走。）' });
      DialogueModal.play(lines, { onComplete: resolve });
    });

    // 記錄玩家見過索爾（Day 5 沙洗時可引用）
    Flags.set('met_sol_day1', true);
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
    if (!act || !(act.effects||[]).some(e => e.type === 'attr' || e.type === 'exp')) return;
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

    // 效果先套（在黑幕下靜默執行）
    Effects.apply(ev.effects, { source: 'errand:' + ev.id });
    if (ev.flagSet) Flags.set(ev.flagSet, true);

    // 🆕 2026-04-25c：事件帶 dialogueLines 就走 DialogueModal（戲劇化演出）
    //   不帶就走原本 Stage.playEvent 小過場
    if (Array.isArray(ev.dialogueLines) && ev.dialogueLines.length > 0) {
      _pendingDialogues.push({
        lines: ev.dialogueLines,
        // onComplete 不需要 — 效果已在前面套完
      });
    } else {
      // 🆕 D.12 v2: 排入 Stage 事件佇列，Stage.playSleep 結束後播小過場
      //              用 log 的第一句當標題，其他行當內文
      const lines = ev.text.split('\n').filter(Boolean);
      queueStageEvent({
        title: '主人傳喚',
        icon:  '📜',
        lines,
        color: '#e8d070',
        holdMs: 2400,
      });
    }
    // 同時也寫進 log（含 flash，給歷史回看）
    addLog('【主人傳喚】\n' + ev.text, '#e8d070', true, true);

    // 🆕 2026-04-27 跑腿事件後嘗試 Lucius 相遇（first encounter or revisit）
    if (typeof LuciusEvents !== 'undefined') {
      try {
        // 第一次相遇（heard_about_cripple flag + 35% 機率）
        const firstEncounter = LuciusEvents.tryErrandEncounter();
        // 沒撞到第一次 → 試 revisit（已 met + kindness 1）
        if (!firstEncounter) LuciusEvents.tryRevisitEncounter();
      } catch (e) { console.error('[Lucius]', e); }
    }
  }, 35);

  // ══════════════════════════════════════════════════
  // 🆕 D.22c（重構）: 武器獎勵 — 訓練次數門檻觸發
  //
  //   核心哲學：主人買你來是要你為他賺錢。
  //   你訓練得夠勤 → 監督官回報 → 主人投資你 → 帶你去領武器。
  //   沒練夠 → Day 4 保底（考驗前強制給），但語氣是施捨。
  //
  //   觸發方式 A（被認可）：訓練次數 ≥ 6 → 即時觸發
  //   觸發方式 B（Day 4 保底）：DayCycle.onDayStart 檢查
  // ══════════════════════════════════════════════════

  // ══════════════════════════════════════════════════
  // 🆕 D.23 世界事件：Day 6-25（第一幕填充）
  // ══════════════════════════════════════════════════

  // ── Day 10 新人淘汰日 ──
  DayCycle.onDayStart('day10Elimination', (newDay) => {
    if (newDay !== 10) return;
    if (Flags.has('day10_done')) return;
    Flags.set('day10_done', true);

    const fame = Stats.player.fame || 0;
    const lines = [
      { text: '今天的訓練場比平常安靜。' },
      { text: '所有人被叫到場邊站好。長官手裡拿著一張名單。' },
      { speaker: '塔倫長官', text: '以下念到名字的，收拾東西。' },
      { speaker: '塔倫長官', text: '你們的買主不想再浪費糧食了。' },
      { text: '他念了三個名字。你不認識的人。' },
      { text: '他們被侍從帶走。沒有人反抗。' },
      { text: '走廊的盡頭傳來鐵門關上的聲音。' },
    ];
    if (fame >= 10) {
      lines.push({ text: '長官經過你的時候停了一秒。他看了你一眼——然後走過去了。' });
      lines.push({ text: '你知道那個眼神是什麼意思。你暫時是安全的。' });
    } else {
      lines.push({ text: '長官經過你的時候……你感覺到他的目光停留了比別人更久。' });
      lines.push({ text: '你不在名單上。但你知道——下一次未必。' });
      Stats.modVital('mood', -10);
    }
    _pendingDialogues.push({ id: 'day10_elimination', lines });
  }, 28);

  // ── Day 12 被安排切磋（第一次訓練後戰鬥） ──
  DayCycle.onDayStart('day12Sparring', (newDay) => {
    if (newDay !== 12) return;
    if (Flags.has('day12_done')) return;
    Flags.set('day12_done', true);

    _pendingDialogues.push({
      id: 'day12_sparring_intro',
      lines: [
        { text: '訓練進行到一半，監督官突然吹了哨。' },
        { speaker: '監督官', text: '你。出來。' },
        { text: '他指著你。然後指著場邊一個你沒太注意過的人。' },
        { speaker: '監督官', text: '切磋。讓我看看你這幾天練了什麼。' },
        { text: '那個人站到你對面。他比你早來幾個月——動作比你流暢。' },
        { speaker: '監督官', text: '不准殺。打到一方倒地為止。開始。' },
      ],
      onComplete: () => {
        // 切磋不顯示斬首/饒恕面板（{ sparring: true }）
        Battle.start('sparringPartner',
          () => {
            DialogueModal.play([
              { text: '你的對手被你打倒在地。他喘著氣，對你點了點頭。' },
              { speaker: '監督官', text: '……還行。' },
              { text: '那是你第一次從監督官嘴裡聽到「還行」這兩個字。' },
            ], {
              onComplete: () => {
                teammates.modAffection('overseer', 5);
                Stats.modFame(3);
                addLog('切磋獲勝！名聲 +3', '#d4af37', true, true);
                renderAll();
              },
            });
          },
          () => {
            DialogueModal.play([
              { text: '你倒在地上。沙子灌進嘴裡。' },
              { speaker: '監督官', text: '……不夠。' },
              { text: '他轉身走了。你爬起來，膝蓋在發抖。' },
            ], {
              onComplete: () => {
                Stats.modVital('mood', -10);
                addLog('切磋落敗。', '#8899aa', true, true);
                renderAll();
              },
            });
          },
          { sparring: true }   // 🆕 切磋模式：不顯示斬首/饒恕面板
        );
      },
    });
  }, 28);

  // ── Day 15 監督官公開訓話（秋季大賽日程） ──
  DayCycle.onDayStart('day15Speech', (newDay) => {
    if (newDay !== 15) return;
    if (Flags.has('day15_done')) return;
    Flags.set('day15_done', true);

    _pendingDialogues.push({
      id: 'day15_speech',
      lines: [
        { text: '所有人被叫到訓練場集合。' },
        { text: '監督官站在高台上。他的表情比平常更嚴肅。' },
        { speaker: '監督官', text: '聽好了。' },
        { speaker: '監督官', text: '秋季大賽的日期已經定了。第五十天。' },
        { speaker: '監督官', text: '從今天起，訓練強度會提高。' },
        { speaker: '監督官', text: '跟不上的人——' },
        { text: '他停頓了一下。' },
        { speaker: '監督官', text: '不需要我說。你們都看過了。' },
        { text: '你想到十天前被帶走的那三個人。' },
        { text: '訓練場上安靜得像有人在辦喪事。' },
      ],
    });
  }, 28);

  // ── Day 20 第二批奴隸到來 ──
  DayCycle.onDayStart('day20NewSlaves', (newDay) => {
    if (newDay !== 20) return;
    if (Flags.has('day20_done')) return;
    Flags.set('day20_done', true);

    _pendingDialogues.push({
      id: 'day20_new_arrivals',
      lines: [
        { text: '早上醒來，訓練場上多了幾張陌生的臉。' },
        { text: '三個人。被鐵鏈串在一起，跟你第一天一模一樣。' },
        { text: '他們的眼神裡還有恐懼。你突然想起——你剛來的時候也是那個樣子。' },
        { text: '但現在你看著他們，卻覺得很遠。' },
        { text: '有人對你行注目禮。也許是因為你手裡的武器，也許是因為你站的位置。' },
        { text: '你已經不是新人了。' },
      ],
    });
    // 背景角鬥士池可能在此時擴充（未來用）
    addLog('【第二批奴隸到來】訓練場上多了幾張新面孔。', '#c8a060', true, true);
  }, 28);

  // ── Day 25 秋祭（難得的放鬆日） ──
  DayCycle.onDayStart('day25Festival', (newDay) => {
    if (newDay !== 25) return;
    if (Flags.has('day25_done')) return;
    Flags.set('day25_done', true);

    const melaAff = (typeof teammates !== 'undefined') ? teammates.getAffection('melaKook') : 0;
    const olanAff = (typeof teammates !== 'undefined') ? teammates.getAffection('orlan') : 0;

    const lines = [
      { text: '今天是秋祭。訓練所難得地放了半天假。' },
      { text: '訓練場上沒有器械的碰撞聲——取而代之的是炊煙和笑聲。' },
    ];

    if (melaAff >= 30) {
      lines.push(
        { text: '梅拉在廚房裡忙了一整個早上。她做了一道你沒吃過的東西。' },
        { speaker: '梅拉', text: '秋祭特別的。嚐嚐。' },
        { text: '你嚐了一口。嘴裡突然有一種說不出的溫暖。' },
        { text: '你不知道是食物的味道，還是被人記得的感覺。' },
      );
      Stats.modVital('food', 30);
      Stats.modVital('mood', 20);
    } else {
      lines.push(
        { text: '梅拉做了特別料理。每個人都多分到一份。' },
        { text: '你吃了。比平常好吃。但也只是比平常好吃而已。' },
      );
      Stats.modVital('food', 20);
      Stats.modVital('mood', 10);
    }

    if (olanAff >= 40) {
      lines.push(
        { speaker: '奧蘭', text: '秋祭快樂。' },
        { text: '他遞給你一個小東西——是他用草編的，形狀像一隻鳥。' },
        { speaker: '奧蘭', text: '我小時候在磨坊常編這個。不值什麼錢，但……' },
        { text: '他沒說完，你也不需要他說完。' },
      );
      teammates.modAffection('orlan', 10);
    }

    lines.push(
      { text: '秋祭在傍晚結束了。明天又是訓練。' },
      { text: '但今天——今天還算不錯。' },
    );

    _pendingDialogues.push({ id: 'day25_festival', lines });
  }, 28);

  // ── 索爾 Day 2-4 小事件（在武器事件之前觸發） ──
  DayCycle.onDayStart('solEvents', (newDay) => {
    if (typeof teammates !== 'undefined' && teammates.getNPC('sol')?.alive === false) return;
    if (Flags.has('sol_dead')) return;

    if (newDay === 2 && !Flags.has('sol_day2')) {
      Flags.set('sol_day2', true);
      _pendingDialogues.push({
        id: 'sol_shield',
        lines: [
          { text: '訓練場上，監督官的鞭子毫無預警地落下——' },
          { text: '你來不及閃。' },
          { text: '一個巨大的影子擋在你前面。' },
          { text: '是索爾。鞭子抽在他背上，他沒出聲。' },
          { text: '監督官冷哼一聲，轉身走了。' },
          { text: '索爾看了你一眼，沒說話。然後回去繼續訓練。' },
        ],
      });
      Flags.set('sol_shielded_you', true);
      Stats.modVital('mood', 10);
      // 索爾擋完鞭後的暗示（指向 WIL 的重要性）
      _pendingDialogues[_pendingDialogues.length - 1].lines.push(
        { text: '你看著他的背影。他一步都沒退。' },
        { speaker: '索爾', text: '……在這裡，能活下去的不是最壯的。' },
        { speaker: '索爾', text: '是最不會倒的。' },
      );
    }

    if (newDay === 3 && !Flags.has('sol_day3')) {
      Flags.set('sol_day3', true);
      _pendingDialogues.push({
        id: 'sol_daughter',
        lines: [
          { text: '夜裡。你以為索爾睡了。' },
          { text: '但他突然開口——這是他進來以後第一次主動說話。' },
          { speaker: '索爾', text: '……我有個女兒。' },
          { speaker: '索爾', text: '五歲。' },
          { text: '他沒有再說下去。你也沒有問。' },
          { text: '牢房裡的沉默，比任何時候都重。' },
          { text: '過了很久，奧蘭輕聲開口。' },
          { speaker: '奧蘭', text: '……你有沒有覺得，冥想的人看起來不太一樣？' },
          { speaker: '奧蘭', text: '好像什麼都打不倒他們似的。' },
          { text: '你想了想。或許他說得對。' },
        ],
      });
    }

    if (newDay === 4 && !Flags.has('sol_day4')) {
      Flags.set('sol_day4', true);
      _pendingDialogues.push({
        id: 'sol_dried_meat',
        lines: [
          { text: '就寢前，索爾把一個小布包推到你面前。' },
          { text: '裡面是半塊乾肉——不知道他藏了多久，邊角已經發硬。' },
          { speaker: '索爾', text: '明天考驗。吃了。' },
          { text: '你看著他。' },
          { speaker: '索爾', text: '你比我有機會。' },
          { text: '他的眼神很平靜。太平靜了。' },
          { text: '你接下那塊乾肉。它比看起來重得多。' },
        ],
      });
      Stats.modVital('food', 15);
      Flags.set('sol_gave_meat', true);
    }
  }, 25);

  const WEAPON_TRAIN_THRESHOLD = 6;   // 6 次訓練 ≈ 1.5 天認真練

  // 訓練完成時即時檢查（路線 A）
  function _tryWeaponRewardCheck() {
    if (Flags.has('chose_starting_weapon')) return;
    const count = Flags.get('training_action_count', 0);
    if (count < WEAPON_TRAIN_THRESHOLD) return;
    _fireWeaponEvent('earned');
  }

  // 🆕 NPC 對大選擇的情緒回聲（Day 6 試煉後 / 偷藥後 / 訣別後）
  DayCycle.onDayStart('npcReactions', (newDay) => {
    if (typeof NPCReactions === 'undefined') return;
    const pending = NPCReactions.pickDaily(newDay);
    if (pending) _pendingDialogues.push(pending);
  }, 26);   // 在 solEvents(25) 之後，比 weaponSafetyNet(30) 之前

  // 🆕 NPC 之間的對立與羈絆衝突事件（選邊站）
  DayCycle.onDayStart('npcConflicts', (newDay) => {
    if (typeof NPCConflicts === 'undefined') return;
    // 若本日已經有反應事件排隊，就不再加衝突（避免一日太多過場）
    if (_pendingDialogues.length > 0) return;
    const pending = NPCConflicts.pickDaily(newDay);
    if (pending) _pendingDialogues.push(pending);
  }, 28);   // 在 npcReactions 之後

  // 🆕 D.28：對話型教學提示（新的一天早上條件如果達成就觸發一個）
  //   排在 NPC 反應 / 衝突之後，這樣劇情比教學優先
  DayCycle.onDayStart('tutorialHints', () => {
    if (typeof TutorialHints === 'undefined') return;
    if (_pendingDialogues.length > 0) return;   // 本日已有其他劇情不塞教學
    const hint = TutorialHints.tryShow(Stats.player);
    if (hint) _pendingDialogues.push({ id: hint.id, lines: hint.lines });
  }, 35);

  // 🆕 D.28：百日條動態揭露（主線）
  //   Day 40 監督官透露 Day 50 大型競技
  DayCycle.onDayStart('revealDay50', (newDay) => {
    if (newDay !== 40 || Flags.has('timeline_day50_revealed')) return;
    _pendingDialogues.push({
      id: 'reveal_day50',
      lines: [
        { text: '（訓練途中，監督官走過你身邊。）' },
        { speaker: '監督官', text: '下個月初，有一場大比賽。' },
        { speaker: '監督官', text: '大型競技——不是跟自己人打。' },
        { speaker: '監督官', text: '大人會親自來看。' },
        { speaker: '監督官', text: '⋯⋯別丟臉。' },
        { text: '（他走了。你記住了那個日期——第五十天。）' },
      ],
      onComplete: () => {
        Flags.set('timeline_day50_revealed', true);
        renderAll();   // 刷新百日條
      },
    });
  }, 40);

  //   Day 60 赫克托 or 卡西烏斯透露 Day 75 宿敵會戰
  DayCycle.onDayStart('revealDay75', (newDay) => {
    if (newDay !== 60 || Flags.has('timeline_day75_revealed')) return;
    // 用卡西烏斯講（比較有重量）
    _pendingDialogues.push({
      id: 'reveal_day75',
      lines: [
        { text: '（卡西烏斯擦著武器。他沒抬頭。）' },
        { speaker: '卡西烏斯', text: '有人在盯著你。' },
        { speaker: '卡西烏斯', text: '我聽過那傢伙的名字。上一季他砍了七個人。' },
        { speaker: '卡西烏斯', text: '他想親自試試你。' },
        { speaker: '卡西烏斯', text: '⋯⋯二十五天後，沙地上見。' },
        { text: '（他沒再說什麼。但你記住了。）' },
      ],
      onComplete: () => {
        Flags.set('timeline_day75_revealed', true);
        renderAll();
      },
    });
  }, 40);

  //   動態賭局（Phase 2）— 每個候補日前 7 天 roll 機率
  DayCycle.onDayStart('dynamicBetsReveal', (newDay) => {
    if (typeof Events === 'undefined' || !Events.DYNAMIC_BETS) return;
    Events.DYNAMIC_BETS.forEach(bet => {
      const revealDay = bet.candidateDay - bet.previewDaysBefore;
      if (newDay !== revealDay) return;
      const triggerFlag = `bet_day${bet.candidateDay}_triggered`;
      if (Flags.has(triggerFlag)) return;
      // roll
      if (Math.random() > bet.chance) return;
      // 觸發：設 flag + 排對白
      Flags.set(triggerFlag, true);
      Flags.set(`bet_day${bet.candidateDay}_opponent`, bet.opponent);
      _pendingDialogues.push({
        id: `bet_reveal_${bet.candidateDay}`,
        lines: bet.previewLines,
        onComplete: () => { renderAll(); },
      });
    });
  }, 45);

  // Day 4 安全網（路線 B）
  DayCycle.onDayStart('weaponSafetyNet', (newDay) => {
    if (newDay < 4) return;
    if (Flags.has('chose_starting_weapon')) return;
    _fireWeaponEvent('forced');
  }, 30);

  function _fireWeaponEvent(trigger) {
    Flags.set('chose_starting_weapon', true);
    const p = Stats.player;
    const trainCount = Flags.get('training_action_count', 0);
    const isFast = trigger === 'earned' && p.day <= 2;   // 兩天內就練到 6 次
    const isSlow = trigger === 'forced';                  // Day 4 保底

    // ── 根據速度選不同的前置對話 ──
    let introLines;
    if (isFast) {
      // 快速路線：被認可 + 給高一級武器
      introLines = [
        { text: '訓練結束後，監督官叫住你。' },
        { speaker: '監督官', text: '站住。' },
        { text: '他盯著你看了很久。然後轉頭對走過的侍從說了一句話。' },
        { text: '侍從離開。幾分鐘後他回來了。' },
        { speaker: '侍從', text: '大人看了監督官的報告。跟我來。' },
        { text: '他帶你走到訓練場邊的裝備庫。四把武器靜靜地掛在架上。' },
        { text: '每一把都有刮痕和鏽跡——它們的上一任主人已經不在了。' },
        { speaker: '裝備庫管理員', text: '你看起來面生啊——應該是前幾天那批買進來的。' },
        { speaker: '裝備庫管理員', text: '這麼快就被帶來領武器了？不錯嘛。我看好你。' },
        { text: '他拍了拍你的肩，然後從架子後方拿出一把稍微不一樣的。' },
        { speaker: '裝備庫管理員', text: '有前途的傢伙，先給你高一級的。你可別辜負我。' },
        { speaker: '裝備庫管理員', text: '選一把。壞了找葛拉。' },
      ];
      // 快速路線的獎勵：心情 +15、監督官好感 +8、主人好感 +5
      // 🆕 武器等級 +1（flag 標記，eqBonus 在選武器時額外加成 20%）
      Flags.set('weapon_bonus_tier', 1);
      Stats.modVital('mood', 15);
      if (typeof teammates !== 'undefined') {
        teammates.modAffection('overseer', 8);
        teammates.modAffection('masterArtus', 5);
      }
    } else if (isSlow) {
      // 慢速路線：施捨
      introLines = [
        { text: '侍從走進來，臉上沒有表情。' },
        { speaker: '侍從', text: '明天要考驗了。大人說給你一把武器。' },
        { speaker: '侍從', text: '別高興太早。武器只是讓你死得更體面。' },
        { text: '他帶你走到裝備庫。' },
        { speaker: '裝備庫管理員', text: '……到現在才來領？' },
        { speaker: '裝備庫管理員', text: '看起來你應該撐不久。最好加點油，轉個念吧。' },
        { text: '你感覺到一股不舒服的壓力。' },
        { speaker: '裝備庫管理員', text: '隨便挑一把。快點。' },
      ];
      // 慢速路線的懲罰：心情 -10
      Stats.modVital('mood', -10);
    } else {
      // 正常路線：中性
      introLines = [
        { text: '訓練結束後侍從來找你。' },
        { speaker: '侍從', text: '大人看了你最近的表現。跟我來。' },
        { text: '他帶你走到訓練場邊的裝備庫。' },
        { text: '四把武器靜靜地掛在架上。' },
        { speaker: '裝備庫管理員', text: '選一把。選了就是你的。壞了找葛拉。' },
      ];
    }

    // ── 用 DialogueModal 播前置 → 接 ChoiceModal 選武器 ──
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(introLines, { onComplete: () => _showWeaponChoice() });
    } else {
      _showWeaponChoice();
    }
  }

  function _showWeaponChoice() {
    ChoiceModal.show({
      id: 'starting_weapon',
      icon: '⚔',
      title: '選擇你的武器',
      body: '每把武器都有它的脾氣。選了就是你的夥伴——直到它斷，或你斷。',
      forced: true,
      choices: [
        {
          id: 'pick_shortSword',
          label: '短劍',
          hint: '攻守均衡，沒有弱點也沒有絕對強項。適合還不確定自己的人。（STR 偏向）',
          effects: [{ type:'flag', key:'weapon_type_blade' }],
          resultLog: '你拿起短劍，握柄剛好貼合你的手掌。它不算輕，但也不重。像是在說：「我什麼都能做——看你的了。」',
          logColor: '#c8a060',
        },
        {
          id: 'pick_dagger',
          label: '匕首',
          hint: '極快，適合找縫隙刺入要害。代價是每一刀都不夠深。（DEX 偏向）',
          effects: [{ type:'flag', key:'weapon_type_blade' }],
          resultLog: '匕首輕得像沒拿東西。但你握著它的時候，手指會不自覺收緊——它在教你什麼是「精準」。',
          logColor: '#c8a060',
        },
        {
          id: 'pick_hammer',
          label: '鐵錘',
          hint: '沉重暴力，一擊碎盾。但你得承受每次揮動的消耗。（STR+CON 偏向）',
          effects: [{ type:'flag', key:'weapon_type_blunt' }],
          resultLog: '你把鐵錘提起來。手臂的肌肉在抗議。但你知道——被這玩意打到的人不會有機會抗議。',
          logColor: '#c8a060',
        },
        {
          id: 'pick_spear',
          label: '長槍',
          hint: '距離就是安全。先手刺擊，不讓對手靠近。雙手持用，不能帶盾。（AGI 偏向）',
          effects: [{ type:'flag', key:'weapon_type_polearm' }],
          resultLog: '長槍比你想像的還長。你握住中段——它輕微地顫動，像有自己的脈搏。距離，就是你的優勢。',
          logColor: '#c8a060',
        },
      ],
    }, {
      onChoose: (choiceId) => {
        const WEAPON_MAP = {
          pick_shortSword: 'shortSword',
          pick_dagger:     'dagger',
          pick_hammer:     'hammer',
          pick_spear:      'spear',
        };
        const weaponId = WEAPON_MAP[choiceId];
        if (weaponId) {
          Stats.player.equippedWeapon = weaponId;
          const w = Weapons[weaponId];
          if (w) {
            // 🆕 快拿獎勵：武器等級 +1 → 各戰鬥屬性額外 +20%
            // 2026-04-23 統一後武器為 flat 結構，直接讀取 w.ATK 等欄位
            const tier = Flags.get('weapon_bonus_tier', 0);
            const mult = 1 + tier * 0.2;   // +1 = ×1.2
            const STAT_KEYS = ['ATK','ACC','CRT','CDMG','SPD','PEN'];
            STAT_KEYS.forEach(k => {
              if (typeof w[k] === 'number') {
                Stats.player.eqBonus[k] = (Stats.player.eqBonus[k] || 0) + Math.round(w[k] * mult);
              }
            });
          }
          const tierLabel = Flags.get('weapon_bonus_tier', 0) > 0 ? ' +1' : '';
          addLog(`⚔ 你選擇了【${w ? w.name : weaponId}${tierLabel}】作為你的武器。`, '#e8d070', true, true);
          if (typeof SoundManager !== 'undefined') SoundManager.playSynth('impact');

          // 🆕 記入玩家武器庫（未來角色頁裝備切換用）
          if (!Array.isArray(Stats.player.weaponInventory)) Stats.player.weaponInventory = [];
          Stats.player.weaponInventory.push({
            id: weaponId,
            tier: Flags.get('weapon_bonus_tier', 0),
          });

          renderAll();
        }
      },
    });
  }

  function init() {
    // Try to restore save first
    const loaded = loadGame();

    // Wire up detail / settings buttons
    document.getElementById('btn-detail')   ?.addEventListener('click', openDetailModal);
    document.getElementById('btn-settings') ?.addEventListener('click', openSettingsModal);
    document.getElementById('btn-help')     ?.addEventListener('click', () => {
      if (typeof HelpModal !== 'undefined') HelpModal.show();
    });
    document.getElementById('btn-close-detail')   ?.addEventListener('click', closeDetailModal);
    document.getElementById('btn-close-settings') ?.addEventListener('click', closeSettingsModal);

    // 🆕 D.1.15: 角色頁 tab 切換
    document.querySelectorAll('.cs-tab').forEach(btn => {
      btn.addEventListener('click', () => _switchCharSheetTab(btn.dataset.tab));
    });
    // 🆕 階段 B: 關係圖按鈕 → 開啟眾生 tab
    document.getElementById('btn-relations')?.addEventListener('click', () => {
      _switchCharSheetTab('people');
    });
    // 🆕 階段 B: Picker close 按鈕
    document.getElementById('cs-picker-close')?.addEventListener('click', _closeEquipmentPicker);
    document.getElementById('btn-confirm-name')   ?.addEventListener('click', confirmName);
    document.getElementById('name-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') confirmName();
    });
    // 🆕 Phase 2 S1 前哨：背景選擇確認
    document.getElementById('btn-confirm-origin')?.addEventListener('click', confirmOrigin);
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

  /** 🆕 Phase 1-E.2: debug 測試——直接開啟指定的 CHOICE_EVENTS 事件 */
  function testChoice(eventId) {
    if (typeof Events === 'undefined' || !Events.CHOICE_EVENTS) {
      console.warn('Events.CHOICE_EVENTS 未載入');
      return;
    }
    const ev = Events.CHOICE_EVENTS[eventId || 'hunger_critical'];
    if (!ev) {
      console.warn('找不到事件', eventId);
      return;
    }
    if (typeof ChoiceModal === 'undefined') {
      console.warn('ChoiceModal 未載入');
      return;
    }
    ChoiceModal.show(ev);
  }

  // 🆕 Debug：快速跳到指定天數（瀏覽器 console 輸入 Game.skipToDay(5)）
  //   會跳過中間所有事件，直接設定天數 + rollNPCs + renderAll
  //   專門用於測試，不用每次從 Day 1 跑起
  function skipToDay(targetDay) {
    const p = Stats.player;
    if (targetDay <= p.day) { console.warn('只能往前跳'); return; }
    console.log(`[Debug] 跳到 Day ${targetDay}（從 Day ${p.day}）`);
    p.day  = targetDay;
    p.time = 360;   // 06:00
    _syncLastRollDay(-1);
    rollDailyNPCs();
    DayCycle.fireDayStart(p.day);
    _resolveNonTrainingSlots();
    renderAll();
    checkTimelineEvent();
    addLog(`\n[Debug] 已跳到第 ${targetDay} 天`, '#ff6600', true);
  }

  return {
    init, switchField, doAction,
    addLog, renderAll, showToast,
    openDetailModal, openSettingsModal,
    saveGame, clearSave, startArenaBattle,
    autoSave,
    loadGameFromSlot,
    testChoice,
    skipToDay,    // 🆕 Debug 用
    // 🆕 2026-04-23：視覺特效公開 API（供 ChoiceModal、狂熱獲得等使用）
    flashStageRed: _flashStageRed,
    shakeGameRoot: _shakeGameRoot,
    // 🆕 2026-04-25：好感變動發光反饋（供 npc.js modAffection 呼叫）
    flashNpcSlot,
  };
})();

// Boot when DOM ready
document.addEventListener('DOMContentLoaded', Game.init);

// 🆕 Debug 快速存讀（F5 存 / F9 讀）
// 測試用：在關鍵事件前 F5，測完不同選項後 F9 回到存檔點
document.addEventListener('keydown', (e) => {
  if (e.key === 'F5') {
    e.preventDefault();
    const ok = Game.saveGame();
    Game.showToast(ok ? '💾 快存成功（F9 讀取）' : '存檔失敗', 2000);
  }
  if (e.key === 'F9') {
    e.preventDefault();
    const ok = Game.loadGameFromSlot && Game.loadGameFromSlot('slot_0');
    if (ok) {
      Game.showToast('📂 快讀成功', 2000);
      Game.renderAll();
    } else {
      Game.showToast('沒有存檔', 2000);
    }
  }
});
