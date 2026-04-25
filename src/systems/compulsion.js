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

  // 🆕 2026-04-24：5 attr 統一表（含 DEX）
  const ATTRS = ['STR', 'DEX', 'AGI', 'CON', 'WIL'];

  const TRAIT_OF = {
    STR: 'STR_fervor',
    DEX: 'DEX_fervor',
    AGI: 'AGI_fervor',
    CON: 'CON_fervor',
    WIL: 'WIL_fervor',
  };

  // attr → 中文名（rework plan § 1）
  const ATTR_NAME = {
    STR: '力量',
    DEX: '靈巧',
    AGI: '反應',
    CON: '體質',
    WIL: '意志',
  };

  // attr → 對應訓練動作中文名
  const TRAIN_NAME = {
    STR: '推舉石頭',
    DEX: '投接碎石',
    AGI: '亂棍格擋',
    CON: '杖擊承受',
    WIL: '打坐冥想',
  };

  // action.id → attr （for 擺爛吐槽：知道玩家現在在做什麼錯動作）
  const ACTION_TO_ATTR = {
    basicSwing:   'STR',
    preciseStab:  'DEX',
    footwork:     'AGI',
    endurance:    'CON',
    meditation:   'WIL',
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

    // 🆕 2026-04-24：永久清除廢棄 _addict 特性
    //   不只在遷移時清 — 每次 ensureInit 都掃一次。
    //   理由：玩家可能用「新版開的存檔（已有 fervor）但 traits 殘留 _addict」這種狀態，
    //   migration 條件判斷不到，所以單獨無條件 strip。
    _stripDeprecatedAddictTraits(player);

    if (!player.fervor || typeof player.fervor !== 'object') {
      player.fervor = _blankState();
    }
    const f = player.fervor;
    // 補齊欄位（save schema 遷移安全）
    if (!f.trainingLog) f.trainingLog = { STR:[], DEX:[], AGI:[], CON:[], WIL:[] };
    if (!f.passedBreakthroughs) {
      f.passedBreakthroughs = { STR:[], DEX:[], AGI:[], CON:[], WIL:[] };
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

  // 🆕 2026-04-24：永久 strip 廢棄 _addict 特性（每次 ensureInit 都跑）
  function _stripDeprecatedAddictTraits(player) {
    if (!Array.isArray(player.traits)) return;
    const before = player.traits.length;
    const removed = [];
    player.traits = player.traits.filter(t => {
      const isAddict = /_addict$/.test(t);
      if (isAddict) removed.push(t);
      return !isAddict;
    });
    if (removed.length > 0) {
      console.log('[Fervor] stripped deprecated _addict traits:', removed,
                  `(${before} → ${player.traits.length})`);
    }
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
      trainingLog: { STR:[], DEX:[], AGI:[], CON:[], WIL:[] },
      passedBreakthroughs: { STR:[], DEX:[], AGI:[], CON:[], WIL:[] },
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

  // 🆕 2026-04-24：擺爛吐槽（rework plan § 4）
  //   依「狂熱屬性 × 玩家正在做的錯誤訓練屬性」對照
  //   使玩家感覺到：你的身體在抗議、它想做別的
  const SLACK_BY_FERVOR_AND_WRONG = {
    STR: {
      DEX: '（你抓著石頭——但你的手想要更重的東西。）',
      CON: '（棍子打下來——你想反推回去。）',
      AGI: '（閃身——但你的拳頭已經握緊了。）',
      WIL: '（你坐著，但腦袋裡全是石頭該怎麼舉。）',
    },
    DEX: {
      STR: '（你抱著石頭——指尖在發癢，想抓更小的東西。）',
      CON: '（棍子打下來——你的手指想去接它，差點被打到頭。）',
      AGI: '（你閃了——但你想伸手抓那根棍子。）',
      WIL: '（你坐著，但手指在膝蓋上模擬接東西。）',
    },
    CON: {
      STR: '（你舉得起來——但你想被壓一下。重一點。）',
      DEX: '（你接著小石頭——這太輕了。）',
      AGI: '（你閃了——但你寧願讓棍子打到，看撐不撐得住。）',
      WIL: '（你坐著，但身體想起身找個東西扛。）',
    },
    AGI: {
      STR: '（你舉得起來——但太慢了。你想要動起來。）',
      DEX: '（你抓到了——但這太準了。沒有閃的空間。）',
      CON: '（棍子打下來——你想閃的，但你不能動。）',
      WIL: '（你閉眼。腦袋裡全是該閃的方向。）',
    },
    WIL: {
      STR: '（你舉著。腦袋裡有東西在浮起來——你想坐下來。）',
      DEX: '（你接著。但你的呼吸沒節奏了。）',
      CON: '（棍子打下來——你想閉眼。但閉眼會被打到。）',
      AGI: '（你閃了——但你想停下來。坐下來。）',
    },
  };

  /**
   * 取得擺爛吐槽。
   * @param {string} wrongAttr — 玩家正在練的（錯）屬性
   */
  function getSlackLine(wrongAttr) {
    const f = ensureInit();
    if (!f || !f.active) return null;
    if (!wrongAttr || wrongAttr === f.active) return null;
    const pool = SLACK_BY_FERVOR_AND_WRONG[f.active];
    if (!pool) return null;
    return pool[wrongAttr] || `（你正在練${TRAIN_NAME[wrongAttr] || ''}——但你的身體想去做${TRAIN_NAME[f.active]}。）`;
  }

  // 🆕 2026-04-24：練對屬性的進度回饋（rework plan § 3）
  //   N/5 不顯示在對白裡（進徽章顯示），這裡只給感受句池
  const PROGRESS_LINES = {
    STR: [
      '（推完。手感越來越穩。）',
      '（這次推得比上次省力。）',
      '（指節熱起來了——好的那種熱。）',
    ],
    DEX: [
      '（接完。手指越來越聽話。）',
      '（這次拋得比上次準。）',
      '（手指像在跟石頭對話。）',
    ],
    CON: [
      '（撐完。腳跟沒動。）',
      '（這次的棍子比較輕。其實一樣重。）',
      '（呼吸找回節奏了。）',
    ],
    AGI: [
      '（閃完。沒看到也擋住了。）',
      '（這次比上次快半拍。）',
      '（眼睛跟手對上了。）',
    ],
    WIL: [
      '（睜眼。剛剛沒走神。）',
      '（這次坐得比上次穩。）',
      '（呼吸跟心跳對上了。）',
    ],
  };

  function getProgressLine(attr) {
    const pool = PROGRESS_LINES[attr];
    if (!pool || !pool.length) return null;
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
        // 🆕 2026-04-24：log 用感受句不顯示 N/5（數字進徽章）
        const line = getProgressLine(attr);
        if (line) _log(line, '#d4af37', false);
        if (f.progress >= f.target) {
          _complete();
        } else {
          // 沒到 target → 觸發 renderAll 讓徽章進度條更新
          if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
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

  // 🆕 2026-04-24：自然觸發對白池（rework plan § 2，每 attr 3 句）
  const TRIGGER_NATURAL = {
    STR: [
      { text: '（這幾天推石頭，你出力不一樣了。）' },
      { text: '（剛剛端碗的時候——指頭夾得太用力，碗裂了。）' },
    ],
    DEX: [
      { text: '（這幾天的投接，你的手指變敏了。）' },
      { text: '（剛剛抓飛過來的蒼蠅——抓到了。你自己嚇一跳。）' },
    ],
    CON: [
      { text: '（這幾天被棍子打——你的身體變了。）' },
      { text: '（剛剛被人撞到肩膀——對方退了兩步，你沒動。）' },
    ],
    AGI: [
      { text: '（這幾天的格擋，你的眼睛變了。）' },
      { text: '（剛剛瓦罐從架上滑落——你接住了。你不是看的，是動作先到。）' },
    ],
    WIL: [
      { text: '（這幾天的打坐，你的腦子變了。）' },
      { text: '（剛剛長官對面那個人在罵你——你聽得很清楚，但他的聲音很遠。）' },
    ],
  };

  // 🆕 2026-04-24：瓶頸觸發對白池（rework plan § 2，每 attr 4 句）
  const TRIGGER_BREAKTHROUGH = {
    STR: [
      { text: '（你想——這幾天累積夠了吧。）' },
      { text: '（你蹲下試了一塊石頭。）' },
      { text: '（舉得起來——但放下的時候，肩膀晃了一下。）' },
      { text: '（還沒。你需要再推幾次，讓這份力氣真的住進骨頭。）' },
    ],
    DEX: [
      { text: '（你想——這幾天的手感應該夠了。）' },
      { text: '（你撿起一顆碎石拋了一次。）' },
      { text: '（接到了——但接的時候手指僵了一下。）' },
      { text: '（還沒。你需要再投幾次，讓那份精準刻進指尖。）' },
    ],
    CON: [
      { text: '（你想——這幾天的身板應該成形了。）' },
      { text: '（你讓人輕輕用棍子敲了肩膀一下。）' },
      { text: '（沒倒——但腳跟離地了半寸。）' },
      { text: '（還沒。你需要再被打幾次，讓這身肉真的長到骨頭上。）' },
    ],
    AGI: [
      { text: '（你想——這幾天的眼睛應該夠快了。）' },
      { text: '（你閉眼，讓人朝你揮一棍。）' },
      { text: '（你閃開了——但比對方的棍尾慢了一拍。）' },
      { text: '（還沒。你需要再格幾次，讓那份反射真的成為本能。）' },
    ],
    WIL: [
      { text: '（你想——這幾天的心應該定了。）' },
      { text: '（你坐下來，閉眼。）' },
      { text: '（坐住了——但腦子裡有一段話一直在跑。）' },
      { text: '（還沒。你需要再坐幾次，讓那份靜真的沉到底。）' },
    ],
  };

  function _playTriggerScene(attr, source, targetLevel) {
    const attrName  = ATTR_NAME[attr];
    const trainName = TRAIN_NAME[attr];

    // 對白池：先播 DialogueModal → 結尾接大字 POPUP + 提示 log
    const lines = (source === 'breakthrough')
                    ? (TRIGGER_BREAKTHROUGH[attr] || []).slice()
                    : (TRIGGER_NATURAL[attr]      || []).slice();

    const popupTitle    = `${attrName}狂熱`;
    const popupSubtitle = (source === 'breakthrough') ? '突破前的必經儀式' : '你進入了狂熱狀態';

    const finishWithPopup = () => {
      // 大字 POPUP（rule § 0.2）
      if (typeof Stage !== 'undefined' && Stage.popupBig) {
        Stage.popupBig({
          icon: '⚡',
          title: popupTitle,
          subtitle: popupSubtitle,
          color: 'gold',
          duration: 1800,
          shake: true,
          sound: (source === 'breakthrough') ? 'acquire' : 'level_up',
          onComplete: () => {
            _log(`⚡ 你進入【${attrName}狂熱】。去${trainName}吧——練 5 次就會結束。`, '#d4af37', true);
            _log(`　練${attrName}：EXP +25% / mood +5 · 練別的會分心：mood -5 + 機率擺爛`, '#887766', false);
            if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
          },
        });
      } else {
        _log(`⚡ 你進入【${attrName}狂熱】。去${trainName}吧。`, '#d4af37', true);
        if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
      }
    };

    if (lines.length > 0 && typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, { onComplete: finishWithPopup });
    } else {
      finishWithPopup();
    }
  }

  // 🆕 2026-04-24：自然結束對白（rework plan § 2，每 attr 1 句）
  const COMPLETE_LINE = {
    STR: '（你放下石頭。手沒抖。你知道——這感覺進入你的身體了。）',
    DEX: '（你接完最後一顆碎石。指尖沒亂。它是你的了。）',
    CON: '（你撐完最後一棍。腳跟沒離地。這身肉是你的了。）',
    AGI: '（你格完最後一棍。沒看，但擋住了。這份反射是你的了。）',
    WIL: '（你睜開眼。聲音都還在，但都跟你無關了。這份靜是你的了。）',
  };

  function _complete() {
    const f = ensureInit();
    const p = Stats.player;
    const attr = f.active;
    const source = f.source;
    const targetLevel = f.targetLevel;
    const attrName = ATTR_NAME[attr];

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

    // 大字 POPUP（rule § 0.2 — 結束場面要看得到）
    const popupSubtitle = (source === 'breakthrough') ? `突破` : '完成';
    const finishLog = () => {
      const line = COMPLETE_LINE[attr];
      if (line) _log(line, '#d4af37', true);
      if (source === 'breakthrough' && targetLevel) {
        _log(`　現在你可以去花 EXP 把${attrName}升到 ${targetLevel} 了。`, '#887766', false);
      }
      if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
    };

    if (typeof Stage !== 'undefined' && Stage.popupBig) {
      Stage.popupBig({
        icon: '⚡',
        title: `${attrName}狂熱 · ${popupSubtitle}`,
        subtitle: '這份感覺，是你的了',
        color: 'gold',
        duration: 1800,
        shake: true,
        sound: 'acquire',
        onComplete: finishLog,
      });
    } else {
      finishLog();
    }
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
      trainName: TRAIN_NAME[f.active],
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
    TRAIN_NAME,                  // 🆕 attr → 訓練動作中文名
    ACTION_TO_ATTR,              // 🆕 action.id → attr
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
    getProgressLine,             // 🆕
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
