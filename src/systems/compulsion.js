/**
 * compulsion.js — 訓練狂熱系統（Fervor，2026-04-24 重寫）
 *
 * 設計對應：docs/systems/fervor.md
 * 取代舊 compulsion（強迫症）— 舊版懲罰玩家專精，跟遊戲哲學衝突。
 *
 * 四種狂熱（正面暫時特性）：
 *   STR_fervor 力量狂熱 / AGI_fervor 步法狂熱
 *   CON_fervor 鐵耐狂熱 / WIL_fervor 禪定覺醒
 *
 * 兩軌觸發：
 *   A. 自然：5 天內同屬性訓練累積 8 次 → 進入狂熱（獎勵專精）
 *   B. 瓶頸：屬性升到 20/30/40/50/60/70/80/90/100 必須通過一次狂熱（儀式）
 *
 * 狂熱期間（訓練動作）：
 *   - 練對屬性：EXP +25%、mood +5、stamina -5 額外、progress +1
 *   - 練別屬性：mood -5、15% 擺爛（EXP ×0.5）、progress 不變
 *
 * 結束條件：對應屬性訓練累積 5 次
 *   - 自然觸發：進入 14 天冷卻
 *   - 瓶頸觸發：設 `fervor_passed_{attr}_{level}` flag，回升級動作
 *
 * 資料結構：
 *   player.fervor = {
 *     active, source, progress, target, targetLevel, startDay,
 *     naturalCooldownUntil,
 *     trainingLog: { STR:[], AGI:[], CON:[], WIL:[] },
 *     passedBreakthroughs: { STR:[], AGI:[], CON:[], WIL:[] },
 *   }
 *
 * 向後相容：同時 export `Compulsion` alias（main.js 舊呼叫點暫時還會用），
 * 但 hasPendingTonight / playNightChoice / onNightPreempted 都改為 no-op
 * （狂熱不需要夜間補做，結束條件改為訓練 5 次）。
 */
const Fervor = (() => {

  // CLAUDE.md 第 12 條：bare addLog 在外部模組是 ReferenceError
  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    } else {
      console.warn('[Fervor] _log: no addLog available', text);
    }
  }

  const ATTRS = ['STR', 'AGI', 'CON', 'WIL'];

  const TRAIT_OF = {
    STR: 'STR_fervor',
    AGI: 'AGI_fervor',
    CON: 'CON_fervor',
    WIL: 'WIL_fervor',
  };

  const ATTR_NAME = {
    STR: '力量',
    AGI: '步法',
    CON: '鐵耐',
    WIL: '禪定',
  };

  const TRAIN_VERB = {
    STR: '揮砍 / 舉石',
    AGI: '步法',
    CON: '耐力',
    WIL: '冥想',
  };

  // 自然觸發：WINDOW 天內累積 TRIGGER 次
  const NATURAL_WINDOW  = 5;
  const NATURAL_TRIGGER = 8;
  // 結束：累積 TARGET 次對應訓練
  const DEFAULT_TARGET  = 5;
  // 自然觸發後冷卻天數
  const NATURAL_COOLDOWN_DAYS = 14;
  // 瓶頸門檻
  const BREAKTHROUGH_LEVELS = [20, 30, 40, 50, 60, 70, 80, 90, 100];

  // ══════════════════════════════════════════════════
  // 初始化 + 舊存檔遷移
  // ══════════════════════════════════════════════════

  function ensureInit(p) {
    const player = p || Stats.player;
    if (!player) return null;

    // 🆕 舊存檔遷移：player.compulsion → player.fervor（一次性）
    if (player.compulsion && !player.fervor) {
      _migrateFromCompulsion(player);
    }

    if (!player.fervor || typeof player.fervor !== 'object') {
      player.fervor = _blankState();
    }
    const f = player.fervor;
    // 補齊欄位（save schema 遷移安全）
    if (!f.trainingLog) f.trainingLog = { STR:[], AGI:[], CON:[], WIL:[] };
    if (!f.passedBreakthroughs) {
      f.passedBreakthroughs = { STR:[], AGI:[], CON:[], WIL:[] };
    }
    ATTRS.forEach(a => {
      if (!Array.isArray(f.trainingLog[a])) f.trainingLog[a] = [];
      if (!Array.isArray(f.passedBreakthroughs[a])) f.passedBreakthroughs[a] = [];
    });
    if (f.active === undefined) f.active = null;
    if (f.source === undefined) f.source = null;
    if (f.progress === undefined) f.progress = 0;
    if (f.target === undefined) f.target = DEFAULT_TARGET;
    if (f.targetLevel === undefined) f.targetLevel = null;
    if (f.startDay === undefined) f.startDay = null;
    if (f.naturalCooldownUntil === undefined) f.naturalCooldownUntil = null;
    return f;
  }

  function _blankState() {
    return {
      active: null,
      source: null,
      progress: 0,
      target: DEFAULT_TARGET,
      targetLevel: null,
      startDay: null,
      naturalCooldownUntil: null,
      trainingLog: { STR:[], AGI:[], CON:[], WIL:[] },
      passedBreakthroughs: { STR:[], AGI:[], CON:[], WIL:[] },
    };
  }

  function _migrateFromCompulsion(player) {
    // 丟掉舊資料（舊 _addict 特性一併清掉）
    player.fervor = _blankState();
    if (Array.isArray(player.traits)) {
      const removed = [];
      player.traits = player.traits.filter(t => {
        const isAddict = /_addict$/.test(t);
        if (isAddict) removed.push(t);
        return !isAddict;
      });
      if (removed.length > 0) {
        console.log('[Fervor] migrated: stripped legacy _addict traits:', removed);
      }
    }
    delete player.compulsion;
  }

  // ══════════════════════════════════════════════════
  // 狀態查詢
  // ══════════════════════════════════════════════════

  function isActive() {
    const f = ensureInit();
    return !!(f && f.active);
  }

  function activeAttr() {
    const f = ensureInit();
    return f ? f.active : null;
  }

  function getState() {
    return ensureInit();
  }

  // EXP 加成（effect_dispatcher 呼叫）
  function getExpMultiplier(attr) {
    const f = ensureInit();
    if (!f || !f.active) return 1.0;
    return (attr === f.active) ? 1.25 : 1.0;
  }

  // 心情變動（訓練動作呼叫，正值/負值依是否對應屬性）
  function getMoodDelta(attr) {
    const f = ensureInit();
    if (!f || !f.active) return 0;
    return (attr === f.active) ? +5 : -5;
  }

  // 額外體力消耗（練對屬性時）
  function getExtraStaminaCost(attr) {
    const f = ensureInit();
    if (!f || !f.active) return 0;
    return (attr === f.active) ? 5 : 0;
  }

  // 擺爛機率（練錯屬性時）
  function getSlackChance(attr) {
    const f = ensureInit();
    if (!f || !f.active) return 0;
    return (attr !== f.active) ? 0.15 : 0;
  }

  // 擺爛吐槽 log
  const SLACK_LINES_BY_ATTR = {
    STR: [
      '（你抬手的時候手心癢——想再握一次那塊石頭。）',
      '（你發現自己又在無意識握拳。）',
    ],
    AGI: [
      '（你跑到一半停下來——腳底發癢，像在催你走另一條路。）',
      '（你意識到自己在原地踏步。）',
    ],
    CON: [
      '（肩膀少了那份重量。你摸了下，下意識的。）',
      '（你發現自己在找東西扛。）',
    ],
    WIL: [
      '（腦袋嗡嗡的。你想找個角落坐下來。）',
      '（你意識到自己在練習的時候分神了——腦子想的是別的事。）',
    ],
  };

  function getSlackLine() {
    const f = ensureInit();
    if (!f || !f.active) return null;
    const pool = SLACK_LINES_BY_ATTR[f.active] || [];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ══════════════════════════════════════════════════
  // 訓練鉤子（doAction 成功後呼叫）
  // ══════════════════════════════════════════════════

  /**
   * 玩家做了 attr 訓練。
   *   - 若狂熱對應該屬性 → progress +1；達 target 結束
   *   - 若沒狂熱 → 記錄滑動窗口，檢查自然觸發
   */
  function onTraining(attr) {
    if (!ATTRS.includes(attr)) return;
    const f = ensureInit();
    const p = Stats.player;

    // 記滑動窗口
    f.trainingLog[attr].push(p.day);
    // 保留 NATURAL_WINDOW 天內的紀錄（含今天）
    f.trainingLog[attr] = f.trainingLog[attr].filter(d => d >= p.day - NATURAL_WINDOW + 1);

    // 有狂熱中
    if (f.active) {
      if (attr === f.active) {
        // 練對 → 進度 +1
        f.progress++;
        _log(`⚡ 【${ATTR_NAME[f.active]}狂熱】 ${f.progress} / ${f.target}`, '#d4af37', false);
        if (f.progress >= f.target) {
          _complete();
        }
      }
      // 練別屬性：effect_dispatcher 已經扣 mood/擺爛，這裡不重複
      return;
    }

    // 無狂熱 → 檢查自然觸發（冷卻中不觸發）
    if (_isInNaturalCooldown()) return;
    if (f.trainingLog[attr].length >= NATURAL_TRIGGER) {
      _trigger(attr, 'natural');
    }
  }

  function _isInNaturalCooldown() {
    const f = ensureInit();
    if (!f.naturalCooldownUntil) return false;
    return (Stats.player.day < f.naturalCooldownUntil);
  }

  // ══════════════════════════════════════════════════
  // 觸發 / 結束
  // ══════════════════════════════════════════════════

  function _trigger(attr, source, targetLevel) {
    const f = ensureInit();
    const p = Stats.player;
    if (!ATTRS.includes(attr)) return;
    if (f.active) return;  // 已有狂熱不重觸

    f.active = attr;
    f.source = source;
    f.progress = 0;
    f.target = DEFAULT_TARGET;
    f.targetLevel = (source === 'breakthrough') ? targetLevel : null;
    f.startDay = p.day;

    // 加正面特性（暫時）
    const traitId = TRAIT_OF[attr];
    if (!Array.isArray(p.traits)) p.traits = [];
    if (!p.traits.includes(traitId)) p.traits.push(traitId);

    _playTriggerScene(attr, source, targetLevel);
  }

  function _playTriggerScene(attr, source, targetLevel) {
    const name = ATTR_NAME[attr];
    const Game_ = (typeof Game !== 'undefined') ? Game : null;

    if (source === 'breakthrough') {
      // 瓶頸觸發：重量級演出
      if (Game_ && Game_.shakeGameRoot) Game_.shakeGameRoot();
      if (typeof SoundManager !== 'undefined') SoundManager.playSynth('acquire');

      const lines = [
        { text: '你坐下，準備花 EXP 升級。' },
        { text: '（但身體在抗拒。）' },
        { text: '（你發現——不夠。）' },
        { text: `（你缺的不是${name}，是某種「讓它屬於你」的過程。）` },
        { text: `⚡ 【${name}狂熱】啟動——突破就差這幾次。` },
      ];
      if (typeof DialogueModal !== 'undefined') {
        DialogueModal.play(lines, {
          onComplete: () => {
            _log(`⚡ 你進入【${name}狂熱】狀態（突破 ${targetLevel} 的必經儀式）。`, '#d4af37', true);
            _log(`　練${name}：EXP +25% / mood +5 · 練別的：mood -5 + 擺爛機率`, '#887766', false);
            if (Game_ && Game_.renderAll) Game_.renderAll();
          },
        });
      }
    } else {
      // 自然觸發：輕演出
      if (Game_ && Game_.shakeGameRoot) Game_.shakeGameRoot();
      if (typeof SoundManager !== 'undefined') SoundManager.playSynth('level_up');

      const lines = [
        { text: '（你感覺到身體正在說什麼。）' },
        { text: '（這幾天的訓練堆疊起來——你抓到什麼了。）' },
        { text: `⚡ 【${name}狂熱】進入狀態。` },
      ];
      if (typeof DialogueModal !== 'undefined') {
        DialogueModal.play(lines, {
          onComplete: () => {
            _log(`⚡ 你進入【${name}狂熱】狀態。`, '#d4af37', true);
            _log(`　練${name}：EXP +25% / mood +5 · 練別的：mood -5 + 擺爛機率`, '#887766', false);
            if (Game_ && Game_.renderAll) Game_.renderAll();
          },
        });
      }
    }
  }

  function _complete() {
    const f = ensureInit();
    const p = Stats.player;
    const attr = f.active;
    const source = f.source;
    const targetLevel = f.targetLevel;
    const name = ATTR_NAME[attr];

    // 移除特性
    const traitId = TRAIT_OF[attr];
    if (Array.isArray(p.traits)) {
      const idx = p.traits.indexOf(traitId);
      if (idx >= 0) p.traits.splice(idx, 1);
    }

    // 瓶頸通過：設 flag + 紀錄
    if (source === 'breakthrough' && targetLevel) {
      Flags.set(`fervor_passed_${attr}_${targetLevel}`);
      if (!f.passedBreakthroughs[attr].includes(targetLevel)) {
        f.passedBreakthroughs[attr].push(targetLevel);
      }
    }
    // 自然：進入冷卻
    if (source === 'natural') {
      f.naturalCooldownUntil = p.day + NATURAL_COOLDOWN_DAYS;
    }

    // 清 active
    f.active = null;
    f.source = null;
    f.progress = 0;
    f.target = DEFAULT_TARGET;
    f.targetLevel = null;
    f.startDay = null;

    // 演出
    if (typeof SoundManager !== 'undefined') SoundManager.playSynth('acquire');
    const msg = (source === 'breakthrough')
      ? `⚡ 【${name}狂熱】結束——你可以繼續突破到 ${targetLevel} 了。`
      : `⚡ 【${name}狂熱】結束。那種癮頭散了，你感覺到——你真的變強了。`;
    _log(msg, '#d4af37', true);
    if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
  }

  // ══════════════════════════════════════════════════
  // 瓶頸檢查（stats.js spendExpOnAttr 呼叫）
  // ══════════════════════════════════════════════════

  /**
   * 玩家試圖升到 targetLevel（= 當前屬性 +1）。
   * 若踩到 BREAKTHROUGH_LEVELS 且還沒通過該瓶頸狂熱 → 阻擋升級，觸發狂熱。
   * @returns {boolean} true = 阻擋升級（已觸發狂熱），false = 放行升級
   */
  function checkBreakthroughNeeded(attr, targetLevel) {
    if (!ATTRS.includes(attr)) return false;
    if (!BREAKTHROUGH_LEVELS.includes(targetLevel)) return false;
    const f = ensureInit();
    if (f.passedBreakthroughs[attr].includes(targetLevel)) return false;
    if (f.active === attr && f.source === 'breakthrough' && f.targetLevel === targetLevel) {
      // 狂熱已在進行中：還沒 complete 就繼續擋
      return true;
    }
    // 首次踩到 → 觸發狂熱
    _trigger(attr, 'breakthrough', targetLevel);
    return true;
  }

  // ══════════════════════════════════════════════════
  // UI：取得狂熱進度（主畫面框框）
  // ══════════════════════════════════════════════════

  function getStatusForUI() {
    const f = ensureInit();
    if (!f || !f.active) return null;
    return {
      attr: f.active,
      name: ATTR_NAME[f.active],
      progress: f.progress,
      target: f.target,
      source: f.source,
      targetLevel: f.targetLevel,
    };
  }

  // ══════════════════════════════════════════════════
  // Day cycle（日結）
  // ══════════════════════════════════════════════════

  function onDayEnd() {
    const f = ensureInit();
    const p = Stats.player;
    // 滑動窗口自動修剪（trainingLog 留 NATURAL_WINDOW 天）
    ATTRS.forEach(attr => {
      f.trainingLog[attr] = f.trainingLog[attr].filter(d => d >= p.day - NATURAL_WINDOW + 1);
    });
    // 冷卻自然過期（不主動清，靠 _isInNaturalCooldown 判斷）
  }

  // ══════════════════════════════════════════════════
  // 向後相容：舊 Compulsion API（main.js slot 7 + 舊呼叫點）
  // ══════════════════════════════════════════════════

  // 舊 API 保留為 no-op / 最小存根 — 避免舊呼叫點崩潰
  function hasPendingTonight() { return false; }
  function getPendingAttr()    { return null; }
  function playNightChoice(onComplete) { if (onComplete) onComplete(); }
  function onNightPreempted()  { /* no-op */ }
  function getDebugStatus() {
    const f = ensureInit();
    return { active: f?.active, progress: f?.progress, target: f?.target };
  }

  // 對外公開
  const API = {
    ATTRS,
    TRAIT_OF,
    ATTR_NAME,
    BREAKTHROUGH_LEVELS,
    ensureInit,
    onTraining,
    onDayEnd,
    // 狀態查詢
    isActive,
    activeAttr,
    getState,
    getStatusForUI,
    // 加成計算
    getExpMultiplier,
    getMoodDelta,
    getExtraStaminaCost,
    getSlackChance,
    getSlackLine,
    // 瓶頸
    checkBreakthroughNeeded,
    // 舊相容
    hasPendingTonight,
    getPendingAttr,
    playNightChoice,
    onNightPreempted,
    getDebugStatus,
  };

  return API;
})();

// 向後相容別名：main.js 舊呼叫點暫時用 Compulsion，逐步改 Fervor
const Compulsion = Fervor;
