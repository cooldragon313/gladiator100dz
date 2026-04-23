/**
 * compulsion.js — 訓練強迫症系統（2026-04-19）
 *
 * 設計對應：docs/systems/compulsion.md
 *
 * 四種強迫症（連 5 天同訓練養成）：
 *   STR_addict 力癮 / AGI_addict 敏癮 / CON_addict 韌癮 / WIL_addict 禪癮
 *
 * 機制三層獎懲：
 *   1. 白天做對應訓練 → mood +3（滿足）+ 訓練獎勵照給
 *   2. 當天沒做 → 夜間 slot 7 彈出選擇：
 *      [練] 補做訓練 + mood +5（無 NPC 加成）
 *      [不練] mood -5 × 累進（最多 -15，連續 3 次觸發失眠）
 *   3. 被主線任務 / 約會占用 slot 7 → 等同「被迫拒絕」累進
 *
 * 解除條件：連續 10 天不做 → 減輕，20 天 → 完全解除
 *
 * 資料結構：
 *   player.compulsion = {
 *     buildUp:  { STR:N, AGI:N, CON:N, WIL:N },   // 養成階段連續做天數
 *     didToday: { STR:false, ... },                // 今日已做（晨起重置）
 *     absent:   { STR_addict:N, ... },             // 擁有後連續不做天數
 *     anxiety:  { STR_addict:N, ... },             // 夜間拒絕累進次數
 *   }
 */
const Compulsion = (() => {

  const ATTRS = ['STR', 'AGI', 'CON', 'WIL'];
  const TRAIT_OF = {
    STR: 'STR_addict',
    AGI: 'AGI_addict',
    CON: 'CON_addict',
    WIL: 'WIL_addict',
  };
  const ATTR_OF = {
    STR_addict: 'STR',
    AGI_addict: 'AGI',
    CON_addict: 'CON',
    WIL_addict: 'WIL',
  };
  const NAME_OF = {
    STR: '力量',
    AGI: '步法',
    CON: '耐力',
    WIL: '冥想',
  };

  const BUILDUP_DAYS = 5;    // 連續多少天養成
  const WARN_START = 3;      // 第 N 天開始警告
  const RELIEF_DAYS = 10;    // 減輕所需天數
  const REMOVE_DAYS = 20;    // 完全解除所需天數

  // ══════════════════════════════════════════════════
  // 初始化 / 取得
  // ══════════════════════════════════════════════════

  function ensureInit(p) {
    const player = p || Stats.player;
    if (!player.compulsion || typeof player.compulsion !== 'object') {
      player.compulsion = {
        buildUp:  { STR: 0, AGI: 0, CON: 0, WIL: 0 },
        didToday: { STR: false, AGI: false, CON: false, WIL: false },
        absent:   { STR_addict: 0, AGI_addict: 0, CON_addict: 0, WIL_addict: 0 },
        anxiety:  { STR_addict: 0, AGI_addict: 0, CON_addict: 0, WIL_addict: 0 },
      };
    }
    // 缺欄位補齊
    const c = player.compulsion;
    if (!c.buildUp)  c.buildUp  = { STR:0, AGI:0, CON:0, WIL:0 };
    if (!c.didToday) c.didToday = { STR:false, AGI:false, CON:false, WIL:false };
    if (!c.absent)   c.absent   = { STR_addict:0, AGI_addict:0, CON_addict:0, WIL_addict:0 };
    if (!c.anxiety)  c.anxiety  = { STR_addict:0, AGI_addict:0, CON_addict:0, WIL_addict:0 };
    ATTRS.forEach(a => {
      if (c.buildUp[a]  === undefined) c.buildUp[a]  = 0;
      if (c.didToday[a] === undefined) c.didToday[a] = false;
      if (c.absent[TRAIT_OF[a]]  === undefined) c.absent[TRAIT_OF[a]]  = 0;
      if (c.anxiety[TRAIT_OF[a]] === undefined) c.anxiety[TRAIT_OF[a]] = 0;
    });
    return c;
  }

  function hasTrait(traitId) {
    const p = Stats.player;
    return Array.isArray(p.traits) && p.traits.includes(traitId);
  }

  // ══════════════════════════════════════════════════
  // 訓練觸發（doAction 訓練成功時呼叫）
  // ══════════════════════════════════════════════════

  /**
   * 玩家做了 attr 訓練。
   *   - 若已有對應強迫症 → mood +3（滿足）
   *   - 養成階段：累加 buildUp，達 5 天獲得強迫症
   *   - 標記 didToday = true
   */
  function onTraining(attr) {
    if (!ATTRS.includes(attr)) return;
    const c = ensureInit();
    c.didToday[attr] = true;

    // 已擁有 → 滿足
    const traitId = TRAIT_OF[attr];
    if (hasTrait(traitId)) {
      Stats.modVital('mood', +3);
      // 擁有後「連續不做」計數歸零
      c.absent[traitId] = 0;
      c.anxiety[traitId] = 0;
      if (typeof addLog === 'function') {
        addLog(`（${NAME_OF[attr]}訓練讓你覺得踏實。mood +3）`, '#887766', false, false);
      }
      return;
    }

    // 養成階段
    c.buildUp[attr]++;

    // 警告期對白
    if (c.buildUp[attr] === WARN_START) {
      if (typeof addLog === 'function') {
        addLog(`（你開始覺得沒練${NAME_OF[attr]}會不自在⋯⋯）`, '#aa7733', false, false);
      }
    } else if (c.buildUp[attr] === BUILDUP_DAYS - 1) {
      if (typeof addLog === 'function') {
        addLog(`（你的身體在催促你回到${NAME_OF[attr]}訓練場。）`, '#cc7733', true, false);
      }
    }

    // 達 5 天 → 獲得強迫症
    if (c.buildUp[attr] >= BUILDUP_DAYS && !hasTrait(traitId)) {
      _grantAddict(attr);
    }
  }

  // 🆕 2026-04-23：戲劇化獲得流程（震動 + 內心獨白 + 特性 popup）
  //   原流程只有兩行 log，玩家無感。
  //   新流程：畫面震動 → DialogueModal 連續 4 行內心獨白 → 特性 popup
  const _MONOLOGUE = {
    STR: [
      { text: '（你的掌心還記得那塊石頭的重量。）' },
      { text: '（連續幾天舉石——今天沒碰，手就是癢。）' },
      { text: '（你發現自己無意識地握緊拳頭，又放開。）' },
      { text: '（不然趁睡前再去推兩下好了⋯⋯）' },
    ],
    AGI: [
      { text: '（連續跑了幾天。今天沒跑。）' },
      { text: '（你的腿在酸，不是累——是癢。）' },
      { text: '（你發現自己在原地踏步，停不下來。）' },
      { text: '（不然趁睡前再去跑一趟好了⋯⋯）' },
    ],
    CON: [
      { text: '（肩膀習慣了那份重量——今天沒扛。）' },
      { text: '（你的身體像少了什麼支撐。）' },
      { text: '（你伸手摸向肩膀，下意識的。）' },
      { text: '（不然趁睡前去扛一下⋯⋯一下就好。）' },
    ],
    WIL: [
      { text: '（連續幾天打坐。今天沒坐。）' },
      { text: '（腦袋嗡嗡的，呼吸找不到節奏。）' },
      { text: '（你想起盤腿那個姿勢——身體在催。）' },
      { text: '（不然趁睡前坐一會兒⋯⋯好好整理一下。）' },
    ],
  };

  function _grantAddict(attr) {
    const p = Stats.player;
    const traitId = TRAIT_OF[attr];
    if (!Array.isArray(p.traits)) p.traits = [];
    if (p.traits.includes(traitId)) return;

    // 加特性
    p.traits.push(traitId);
    const def = (typeof Config !== 'undefined') ? Config.TRAIT_DEFS[traitId] : null;
    const traitName = def ? def.name : traitId;
    const attrName = NAME_OF[attr];

    const finishPopup = () => {
      if (typeof addLog === 'function') {
        addLog(`▼ 你獲得了新的特性：【${traitName}】`, '#e68080', true, true);
        addLog(`你的${attrName}訓練已成為一種戒不掉的習慣。`, '#c878a0', false, false);
      }
    };

    // 視覺特效：震動（暗示這是身體層級的事）
    const Game_ = (typeof Game !== 'undefined') ? Game : null;
    if (Game_ && typeof Game_.shakeGameRoot === 'function') Game_.shakeGameRoot();

    // 獨白：4 行內心戲
    const lines = _MONOLOGUE[attr] || [];
    if (lines.length > 0 && typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, { onComplete: finishPopup });
    } else {
      finishPopup();
    }
  }

  // ══════════════════════════════════════════════════
  // 日結（sleepEndDay 呼叫）
  // ══════════════════════════════════════════════════

  /**
   * 日結時呼叫：
   *   - 養成階段：若當日沒做 → buildUp 歸零（連續中斷）
   *   - 擁有強迫症：若當日沒做 → 夜間補做彈窗已在 slot 7 處理；這裡計算 absent（解除用）
   *   - 重置 didToday（準備下一天）
   */
  function onDayEnd() {
    const c = ensureInit();

    ATTRS.forEach(attr => {
      const traitId = TRAIT_OF[attr];
      const didToday = c.didToday[attr];

      if (hasTrait(traitId)) {
        // 已擁有強迫症
        if (didToday) {
          // 今天做了 → 歸零 absent/anxiety（onTraining 已處理但保險）
          c.absent[traitId] = 0;
          c.anxiety[traitId] = 0;
        } else {
          // 今天沒做 → absent +1
          c.absent[traitId]++;

          // 減輕閾值
          if (c.absent[traitId] === RELIEF_DAYS) {
            if (typeof addLog === 'function') {
              addLog(`（你感覺${NAME_OF[attr]}的焦慮慢慢淡了。）`, '#88aacc', false, false);
            }
          }

          // 完全解除
          if (c.absent[traitId] >= REMOVE_DAYS) {
            _removeAddict(attr);
          }
        }
      } else {
        // 沒強迫症 — 沒做就 buildUp 歸零（連續中斷）
        if (!didToday) {
          c.buildUp[attr] = 0;
        }
      }

      // 重置下一天
      c.didToday[attr] = false;
    });
  }

  function _removeAddict(attr) {
    const p = Stats.player;
    const traitId = TRAIT_OF[attr];
    if (!Array.isArray(p.traits)) return;
    const idx = p.traits.indexOf(traitId);
    if (idx >= 0) {
      p.traits.splice(idx, 1);
      const def = (typeof Config !== 'undefined') ? Config.TRAIT_DEFS[traitId] : null;
      if (def && typeof addLog === 'function') {
        addLog(`✦ 你克服了【${def.name}】。`, '#88cc77', true, true);
      }
      // 清空狀態
      const c = ensureInit();
      c.absent[traitId] = 0;
      c.anxiety[traitId] = 0;
      c.buildUp[attr] = 0;
      Flags.set('overcame_' + traitId, true);
    }
  }

  // ══════════════════════════════════════════════════
  // 夜間補做彈窗（slot 7 = 20-22h）
  // ══════════════════════════════════════════════════

  /**
   * 是否有待補做的強迫症（呼叫 playNightChoice 之前檢查）。
   */
  function hasPendingTonight() {
    const c = ensureInit();
    for (const attr of ATTRS) {
      const traitId = TRAIT_OF[attr];
      if (hasTrait(traitId) && !c.didToday[attr]) return true;
    }
    return false;
  }

  /**
   * 取得今晚需要補做的第一個強迫症（多個的話只處理一個，其他累進焦慮）。
   */
  function getPendingAttr() {
    const c = ensureInit();
    for (const attr of ATTRS) {
      const traitId = TRAIT_OF[attr];
      if (hasTrait(traitId) && !c.didToday[attr]) return attr;
    }
    return null;
  }

  /**
   * 彈出夜間選擇 ChoiceModal。
   *   onComplete 會在玩家做完選擇後呼叫，讓 slot 7 外層繼續處理。
   */
  function playNightChoice(onComplete) {
    const attr = getPendingAttr();
    if (!attr) { if (onComplete) onComplete(); return; }
    const traitId = TRAIT_OF[attr];
    const name = NAME_OF[attr];
    const c = ensureInit();

    if (typeof ChoiceModal === 'undefined') {
      // Fallback：自動選「不練」
      _applyRefuse(attr);
      if (onComplete) onComplete();
      return;
    }

    // 🆕 2026-04-19：對白改為玩家角色的內心獨白，移除後台數字
    //   依 attr 微調用詞，讓每類訓練的「癮」有自己的語氣
    const verbMap = {
      STR: { do: '手癢了⋯⋯一個人我也要去練一下。',      refuse: '手癢不練，今晚可能難睡覺了。' },
      AGI: { do: '腳停不下來。我去繞兩圈。',              refuse: '腳底發癢，壓也壓不住。' },
      CON: { do: '肺裡滿滿的 — 得跑一跑才順。',           refuse: '身體裡有一股氣出不去。' },
      WIL: { do: '腦子停不下來。去靜坐一下。',            refuse: '思緒像蚊子一樣叮著我。' },
    };
    const verbs = verbMap[attr] || verbMap.STR;

    ChoiceModal.show({
      id: 'compulsion_' + traitId,
      icon: '💢',
      title: `你的身體記得該做${name}訓練了`,
      body: '你停在牢房裡。手指不自覺地動。',
      forced: true,
      choices: [
        {
          id: 'do_it',
          label: '去練',
          hint: `（${verbs.do}）`,
          effects: [],
        },
        {
          id: 'refuse',
          label: '不練',
          hint: `（${verbs.refuse}）`,
          effects: [],
        },
      ],
    }, {
      onChoose: (cid) => {
        if (cid === 'do_it') _applyDoIt(attr);
        else                 _applyRefuse(attr);
        if (onComplete) onComplete();
      },
    });
  }

  /**
   * 被主線任務 / 約會占用 slot 7 → 算「被迫拒絕」（一次累進）。
   * 由 slot 7 外層 preempt 時呼叫。
   */
  function onNightPreempted() {
    const attr = getPendingAttr();
    if (!attr) return;
    _applyRefuse(attr, { preempted: true });
  }

  function _applyDoIt(attr) {
    const p = Stats.player;
    const name = NAME_OF[attr];
    const traitId = TRAIT_OF[attr];

    // 訓練獎勵：簡版 — 加對應屬性 EXP + mood +5
    // 沒 NPC 加成（跟正常 doAction 的 synergy 不同）
    // 使用一個固定值，跟基礎揮砍相當
    const baseExp = 5;  // 約等於 delta 0.5 × 10 coeff
    Stats.modExp(attr, baseExp);
    Stats.modVital('mood', +5);
    Stats.modVital('stamina', -15);  // 補做耗體力

    // 記 didToday = true（避免日結再扣 absent）
    const c = ensureInit();
    c.didToday[attr] = true;
    c.absent[traitId] = 0;
    c.anxiety[traitId] = 0;

    if (typeof addLog === 'function') {
      addLog(`💪 你回到訓練場補做${name}訓練。身體終於平靜下來。`, '#88aacc', true, true);
      addLog(`（${attr} EXP +${baseExp} · mood +5 · stamina -15）`, '#887766', false, false);
    }

    // 補做時也要檢查傷勢（Wounds 系統）
    if (typeof Wounds !== 'undefined' && Wounds.rollLowStaminaInjury) {
      Wounds.rollLowStaminaInjury(attr);
    }
  }

  function _applyRefuse(attr, opts = {}) {
    const c = ensureInit();
    const traitId = TRAIT_OF[attr];
    const name = NAME_OF[attr];

    c.anxiety[traitId]++;
    const streak = c.anxiety[traitId];
    const moodLoss = Math.min(15, 5 * streak);
    Stats.modVital('mood', -moodLoss);

    // 對白分層
    if (typeof addLog === 'function') {
      let line;
      if (streak === 1) {
        line = `（你躺在床上，腦中一直閃過${name}訓練場的畫面。mood -${moodLoss}）`;
      } else if (streak === 2) {
        line = `（你開始流汗。手不自覺地握拳又鬆開。mood -${moodLoss}）`;
      } else {
        line = `（焦慮像潮水拍打。你整夜無眠。mood -${moodLoss} / hp -10）`;
      }
      if (opts.preempted) {
        line = '（你今晚另有要事。身體的焦躁只能硬壓下去。mood -' + moodLoss + '）';
      }
      addLog(line, '#c03838', true, false);
    }

    // 連續 3 次 → 失眠症 + hp -10
    if (streak >= 3) {
      Stats.modVital('hp', -10);
      const p = Stats.player;
      if (!Array.isArray(p.ailments)) p.ailments = [];
      if (!p.ailments.includes('insomnia_disorder')) {
        p.ailments.push('insomnia_disorder');
        if (typeof addLog === 'function') {
          addLog(`▼ 焦慮發作 — 你獲得【失眠症】。`, '#e68080', true, true);
        }
      }
    }
  }

  // ══════════════════════════════════════════════════
  // UI
  // ══════════════════════════════════════════════════

  /**
   * 顯示當前養成階段進度（debug / 未來 tooltip 用）
   */
  function getDebugStatus() {
    const c = ensureInit();
    return {
      buildUp:  { ...c.buildUp },
      active:   ATTRS.filter(a => hasTrait(TRAIT_OF[a])),
      absent:   { ...c.absent },
      anxiety:  { ...c.anxiety },
    };
  }

  return {
    ATTRS,
    TRAIT_OF,
    NAME_OF,
    ensureInit,
    onTraining,
    onDayEnd,
    hasPendingTonight,
    getPendingAttr,
    playNightChoice,
    onNightPreempted,
    getDebugStatus,
  };
})();
