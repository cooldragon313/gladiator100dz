/**
 * wounds.js — 傷勢系統（2026-04-19）
 *
 * 四部位：head / torso / arms / legs
 * 三級嚴重度：1=輕傷 / 2=中傷 / 3=重傷
 *
 * 設計對應：docs/systems/wounds.md
 *
 * 資料結構：
 *   player.wounds = {
 *     head:  null | { severity, source, daysElapsed, cameFromCombat },
 *     torso: null | ...,
 *     arms:  null | ...,
 *     legs:  null | ...,
 *   }
 *
 * 載入順序：stats.js 之後（會用 Stats.player）
 */
const Wounds = (() => {

  // ══════════════════════════════════════════════════
  // 常數
  // ══════════════════════════════════════════════════

  const PARTS = ['head', 'torso', 'arms', 'legs', 'mind'];  // 🆕 2026-04-19 加 mind 部位（精神傷）
  const PART_NAMES = { head: '頭部', torso: '軀幹', arms: '手臂', legs: '腿部', mind: '精神' };

  /**
   * 部位 → 主要屬性減免
   * 受傷後從 eff() 扣除
   */
  const PART_STAT_MOD = {
    head:  { WIL: true },
    torso: { CON: true },
    arms:  { STR: true },
    legs:  { AGI: true },
    mind:  { WIL: true },   // 精神傷也影響 WIL
  };

  /**
   * 🆕 2026-04-19 特殊傷（比重傷更重的永久類傷，通常需要改造人）
   *   資料格式：player.wounds.{part} = { special: 'concussion' }
   *   取代原 ailment 系統（concussion/achilles_tear/insomnia/depression）
   */
  const SPECIAL_DEFS = {
    concussion: {
      id: 'concussion',
      name: '腦震盪',
      part: 'head',
      statPenalty: { WIL: 8 },
      expMultDec: 0.40,    // 訓練 EXP ×0.6
      desc: '頭部重擊，視野晃動，思考遲鈍。讀書失效。',
    },
    achilles_tear: {
      id: 'achilles_tear',
      name: '阿基里斯腱撕裂',
      part: 'legs',
      statPenalty: { AGI: 8 },
      expMultDec: 0.50,    // AGI 訓練 ×0.5
      desc: '腳跟的傷讓你幾乎跪下。跑動完全失效。',
    },
    insomnia: {
      id: 'insomnia',
      name: '失眠症',
      part: 'mind',
      statPenalty: {},
      expMultDec: 0.15,    // 所有訓練 ×0.85（疲勞）
      desc: '長期失眠傷及神經。夜間恢復崩壞。',
      passiveOnRest: { stamina: -3, mood: -3 },
      sleepStaminaMax: 15,
    },
    depression: {
      id: 'depression',
      name: '憂鬱症',
      part: 'mind',
      statPenalty: {},
      expMultDec: 0.10,    // 所有訓練 ×0.9
      moodCapReduce: 15,
      desc: '深層的黑暗蔓延整個精神。mood 上限降低。',
    },
  };

  /**
   * 嚴重度 → 屬性減免量
   */
  const SEVERITY_STAT_DEC = { 1: 2, 2: 4, 3: 6 };

  /**
   * 嚴重度 → 訓練 EXP 倍率扣減
   */
  const SEVERITY_EXP_DEC = { 1: 0.10, 2: 0.20, 3: 0.30 };

  /**
   * 嚴重度 → 中文名
   */
  const SEVERITY_NAMES = { 1: '輕傷', 2: '中傷', 3: '重傷' };

  /**
   * 訓練類型 → 對應部位（用於「好痛」觸發檢查）
   * 主屬性 + 次要高風險部位（多個部位都可觸發）
   */
  const TRAIN_PART_MAP = {
    STR: ['arms', 'torso'],
    DEX: ['arms'],
    CON: ['torso', 'legs'],
    AGI: ['legs'],
    WIL: ['head'],
    LUK: [],   // 幸運訓練不受部位影響
  };

  // ══════════════════════════════════════════════════
  // 初始化 / 取得
  // ══════════════════════════════════════════════════

  function ensureInit(p) {
    const player = p || Stats.player;
    if (!player.wounds || typeof player.wounds !== 'object') {
      player.wounds = { head: null, torso: null, arms: null, legs: null, mind: null };
    }
    PARTS.forEach(part => {
      if (player.wounds[part] === undefined) player.wounds[part] = null;
    });
    return player.wounds;
  }

  function getWound(part) {
    ensureInit();
    return Stats.player.wounds[part];
  }

  function hasAnyWound() {
    ensureInit();
    return PARTS.some(p => Stats.player.wounds[p] !== null);
  }

  function countBySeverity(severity) {
    ensureInit();
    return PARTS.filter(p => {
      const w = Stats.player.wounds[p];
      return w && w.severity === severity;
    }).length;
  }

  // ══════════════════════════════════════════════════
  // 施加傷勢
  // ══════════════════════════════════════════════════

  /**
   * 對某部位施加傷勢。
   * @param {string} part     'head'|'torso'|'arms'|'legs'
   * @param {number} severity 1|2|3
   * @param {object} [opts]   { source, cameFromCombat }
   * @returns {object} 新的傷勢物件
   */
  function inflict(part, severity, opts = {}) {
    if (!PARTS.includes(part)) return null;
    if (severity < 1 || severity > 3) return null;
    ensureInit();
    const p = Stats.player;

    const existing = p.wounds[part];
    // 若已有傷勢，取 max
    if (existing && existing.severity >= severity) {
      // 不降級，但 daysElapsed 歸零
      existing.daysElapsed = 0;
      return existing;
    }

    const wound = {
      severity,
      source:          opts.source          || 'unknown',
      daysElapsed:     0,
      cameFromCombat:  !!opts.cameFromCombat,
    };
    p.wounds[part] = wound;

    // 重算屬性（派生值由 calcDerived 呼叫 eff() 自動吃到）
    if (typeof Stats.renderAll === 'function') Stats.renderAll();

    return wound;
  }

  /**
   * 🆕 2026-04-19 施加特殊傷（concussion/achilles_tear/insomnia/depression）
   */
  function inflictSpecial(specialId, opts = {}) {
    const def = SPECIAL_DEFS[specialId];
    if (!def) return null;
    ensureInit();
    const p = Stats.player;
    const part = def.part;

    // 若該部位已有特殊傷且同類 → 不重疊
    const existing = p.wounds[part];
    if (existing && existing.special === specialId) return existing;

    // 特殊傷覆蓋一般傷（特殊更嚴重）
    const wound = {
      special: specialId,
      source: opts.source || 'unknown',
      daysElapsed: 0,
    };
    p.wounds[part] = wound;

    if (typeof Stats.renderAll === 'function') Stats.renderAll();
    return wound;
  }

  /**
   * 取得部位傷勢的完整效果定義（一般 + 特殊通用介面）
   */
  function getWoundEffect(part) {
    ensureInit();
    const w = Stats.player.wounds[part];
    if (!w) return null;
    if (w.special) {
      return { type: 'special', ...SPECIAL_DEFS[w.special] };
    }
    return { type: 'normal', severity: w.severity };
  }

  /**
   * 部位 × 嚴重度 升級（輕→中 / 中→重）。
   */
  function upgradeSeverity(part) {
    ensureInit();
    const w = Stats.player.wounds[part];
    if (!w) return null;
    if (w.severity >= 3) return w;
    w.severity++;
    w.daysElapsed = 0;
    if (typeof Stats.renderAll === 'function') Stats.renderAll();
    return w;
  }

  // ══════════════════════════════════════════════════
  // 恢復
  // ══════════════════════════════════════════════════

  /**
   * 手動治癒某部位（老默介入或改造後）。
   */
  function heal(part) {
    ensureInit();
    Stats.player.wounds[part] = null;
    if (typeof Stats.renderAll === 'function') Stats.renderAll();
  }

  /**
   * 每日開始時呼叫（DayCycle hook）。
   *   輕傷：3-5 天自癒
   *   中傷：不治療 15 天自癒 / 治療過後 5-8 天
   *   重傷：不自然恢復（除非特殊條件）
   */
  function onDayStart() {
    ensureInit();
    const p = Stats.player;
    const isResting = (typeof GameState !== 'undefined' && GameState.wasLastActionRest && GameState.wasLastActionRest());

    PARTS.forEach(part => {
      const w = p.wounds[part];
      if (!w) return;
      w.daysElapsed = (w.daysElapsed || 0) + 1;

      // 依嚴重度決定自癒閾值
      let threshold = 999;
      if (w.severity === 1) {
        threshold = 4;  // 3-5 天中間值
      } else if (w.severity === 2) {
        const treated = Flags.has('wound_treated_' + part);
        threshold = treated ? 7 : 15;
      }

      if (w.daysElapsed >= threshold) {
        heal(part);
        if (typeof addLog === 'function') {
          addLog(`✦ 你的${PART_NAMES[part]}${SEVERITY_NAMES[w.severity]}痊癒了。`, '#88cc77', true, true);
        }
      }
    });

    // 檢查重傷自然癒合條件（WIL ≥ 20 + 老默好感 ≥ 80 + 養傷 30 天以上）
    _tryNaturalRecoverySevere();
  }

  /**
   * 重傷自然癒合（意志力路線）。
   */
  function _tryNaturalRecoverySevere() {
    const p = Stats.player;
    if (!p.wounds) return;
    const wil = (typeof Stats.eff === 'function') ? Stats.eff('WIL') : p.WIL;
    if (wil < 20) return;

    const aff = (typeof teammates !== 'undefined' && teammates.getAffection)
                  ? teammates.getAffection('doctorMo') : 0;
    if (aff < 80) return;

    // 找到已受重傷 30+ 天的部位
    PARTS.forEach(part => {
      const w = p.wounds[part];
      if (!w || w.severity !== 3) return;
      if (w.daysElapsed < 30) return;
      if (Flags.has('natural_recovery_triggered_' + part)) return;

      // 觸發自然癒合事件
      Flags.set('natural_recovery_triggered_' + part, true);
      _playNaturalRecoveryScene(part);
    });
  }

  function _playNaturalRecoveryScene(part) {
    const p = Stats.player;
    const partName = PART_NAMES[part];

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play([
        { speaker: '老默', text: '你這傷⋯⋯我看了幾個月。' },
        { speaker: '老默', text: `照理你的${partName}不該好。` },
        { speaker: '老默', text: '但你每天訓練、忍痛、不放棄。' },
        { speaker: '老默', text: '⋯⋯你的意志力，連神都得讓三分。' },
        { speaker: '...', text: `（${partName}重傷 → 中傷）` },
      ], {
        onComplete: () => {
          const w = p.wounds[part];
          if (w) { w.severity = 2; w.daysElapsed = 0; }
          // 給獎勵特性
          if (!Array.isArray(p.traits)) p.traits = [];
          const reward = p.traits.includes('iron_will') ? 'unbreakable' : 'iron_will';
          if (!p.traits.includes(reward)) {
            p.traits.push(reward);
            const def = (typeof Config !== 'undefined') ? Config.TRAIT_DEFS[reward] : null;
            if (def && typeof addLog === 'function') {
              addLog(`✦ 你獲得了新的特性：【${def.name}】`, '#88cc77', true, true);
            }
          }
          if (typeof Stats.renderAll === 'function') Stats.renderAll();
        }
      });
    }
  }

  // ══════════════════════════════════════════════════
  // 屬性減免查詢（由 Stats.eff 呼叫）
  // ══════════════════════════════════════════════════

  /**
   * 取得某屬性因傷勢產生的減免量。
   * Stats.eff(attr) 會自動扣除此值。
   */
  function getAttrPenalty(attr) {
    ensureInit();
    const p = Stats.player;
    let total = 0;
    PARTS.forEach(part => {
      const w = p.wounds[part];
      if (!w) return;
      // 🆕 特殊傷：使用 SPECIAL_DEFS.statPenalty
      if (w.special) {
        const sdef = SPECIAL_DEFS[w.special];
        if (sdef && sdef.statPenalty && sdef.statPenalty[attr]) {
          total += sdef.statPenalty[attr];
        }
        return;
      }
      // 一般傷
      const map = PART_STAT_MOD[part];
      if (map && map[attr]) {
        total += SEVERITY_STAT_DEC[w.severity] || 0;
      }
    });
    return total;
  }

  /**
   * 取得訓練某屬性的 EXP 倍率扣減。
   * 若該屬性對應部位有傷，回傳扣減比例（0~1）。
   * 🆕 特殊傷也納入計算（用 SPECIAL_DEFS.expMultDec）。
   * 🆕 mind 部位（insomnia/depression）對所有訓練都扣減。
   */
  function getTrainExpMultDec(attr) {
    const parts = TRAIN_PART_MAP[attr];
    if (!Array.isArray(parts) || parts.length === 0) return 0;
    ensureInit();
    const p = Stats.player;
    let maxDec = 0;

    // 一般傷 × 部位對應
    parts.forEach(part => {
      const w = p.wounds[part];
      if (!w) return;
      let dec = 0;
      if (w.special) {
        const sdef = SPECIAL_DEFS[w.special];
        dec = sdef?.expMultDec || 0;
      } else {
        dec = SEVERITY_EXP_DEC[w.severity] || 0;
      }
      if (dec > maxDec) maxDec = dec;
    });

    // 🆕 mind 傷對所有訓練都扣減（失眠/憂鬱）
    const mindW = p.wounds.mind;
    if (mindW && mindW.special) {
      const sdef = SPECIAL_DEFS[mindW.special];
      const mindDec = sdef?.expMultDec || 0;
      if (mindDec > maxDec) maxDec = mindDec;
    }

    return maxDec;
  }

  // ══════════════════════════════════════════════════
  // 訓練「好痛」觸發
  // ══════════════════════════════════════════════════

  /**
   * 低體力訓練時，擲新傷勢機率。
   * 依體力分層：
   *   stamina > 50    → 0%（安全）
   *   stamina 30-50   → 5% 輕傷
   *   stamina 15-30   → 15% 輕傷 / 3% 中傷
   *   stamina < 15    → 30% 輕傷 / 10% 中傷 / 2% 重傷
   *   stamina < 5     → 50% 中傷 / 15% 重傷
   *
   * @param {string} attr 訓練的目標屬性
   * @returns {object|null} 若受傷則回傳 { part, severity }；否則 null
   */
  function rollLowStaminaInjury(attr) {
    const p = Stats.player;
    const stamina = p.stamina || 0;
    const parts = TRAIN_PART_MAP[attr];
    if (!Array.isArray(parts) || parts.length === 0) return null;

    // 依體力分層擲骰
    let lightProb = 0, mediumProb = 0, severeProb = 0;
    if (stamina > 50) {
      return null;
    } else if (stamina >= 30) {
      lightProb = 0.05;
    } else if (stamina >= 15) {
      lightProb = 0.15; mediumProb = 0.03;
    } else if (stamina >= 5) {
      lightProb = 0.30; mediumProb = 0.10; severeProb = 0.02;
    } else {
      mediumProb = 0.50; severeProb = 0.15;
    }

    const roll = Math.random();
    let severity = 0;
    if (roll < severeProb) severity = 3;
    else if (roll < severeProb + mediumProb) severity = 2;
    else if (roll < severeProb + mediumProb + lightProb) severity = 1;
    if (severity === 0) return null;

    // 選擇部位（從訓練對應部位隨機）
    const part = parts[Math.floor(Math.random() * parts.length)];
    inflict(part, severity, { source: 'low_stamina_training' });

    // 敘事 + 特效
    _playNewInjuryScene(attr, part, severity);
    _flashRedAndShake();

    return { part, severity };
  }

  function _playNewInjuryScene(attr, part, severity) {
    const partName = PART_NAMES[part];
    const sevName = SEVERITY_NAMES[severity];
    const lines = [
      '（你硬撐著揮出一劍。）',
      `（${partName}一陣撕裂般的劇痛。）`,
      `（你低頭看 — 你把自己練傷了。${sevName}。）`,
    ];
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines.map(t => ({ text: t })), {});
    }
    if (typeof addLog === 'function') {
      addLog(`💥 你練傷了 — ${partName}${sevName}。`, '#cc3333', true, true);
    }
  }

  /**
   * 訓練時檢查「好痛」觸發。
   * @param {string} attr 訓練的目標屬性
   * @returns {object} { painTriggered, hpLoss, staminaLoss, abortExp, severity, part }
   */
  function checkTrainingPain(attr) {
    const parts = TRAIN_PART_MAP[attr];
    if (!Array.isArray(parts) || parts.length === 0) return { painTriggered: false };
    ensureInit();
    const p = Stats.player;

    // 找到有傷的對應部位（嚴重度最高者）
    let worstPart = null;
    let worstSev = 0;
    parts.forEach(part => {
      const w = p.wounds[part];
      if (w && w.severity > worstSev) {
        worstPart = part;
        worstSev = w.severity;
      }
    });
    if (!worstPart) return { painTriggered: false };

    // 觸發率：輕 30% / 中 60% / 重 90%
    const triggerProb = { 1: 0.30, 2: 0.60, 3: 0.90 }[worstSev] || 0;
    const roll = Math.random();
    if (roll > triggerProb) return { painTriggered: false };

    // 觸發好痛
    const hpLoss = { 1: 3, 2: 8, 3: 15 }[worstSev] || 0;
    const staminaLoss = { 1: 10, 2: 20, 3: 30 }[worstSev] || 0;

    // 機率升級傷勢（中/重才有）
    let upgraded = false;
    if (worstSev === 2 && Math.random() < 0.10) {
      upgradeSeverity(worstPart);
      upgraded = true;
    } else if (worstSev === 3 && Math.random() < 0.05) {
      // 重傷已經最高，不升級 — 但代表嚴重痛苦
    }

    // 敘事
    _playPainScene(attr, worstPart, worstSev, upgraded);

    // 套用效果
    Stats.modVital('hp', -hpLoss);
    Stats.modVital('stamina', -staminaLoss);

    // UI 特效
    _flashRedAndShake();

    return {
      painTriggered: true,
      hpLoss,
      staminaLoss,
      abortExp: true,   // 觸發好痛 → 訓練 EXP 歸零
      severity: worstSev,
      part: worstPart,
    };
  }

  function _playPainScene(attr, part, severity, upgraded) {
    const partName = PART_NAMES[part];
    const lines = _getPainLines(attr, part, severity);
    if (typeof DialogueModal !== 'undefined' && lines.length > 0) {
      DialogueModal.play(lines.map(text => ({ text })), {});
    }
    if (typeof addLog === 'function') {
      addLog(`💥 你的${partName}${SEVERITY_NAMES[severity]}發作。這次訓練失敗了。`, '#cc3333', true, true);
      if (upgraded) {
        addLog(`⚠ 傷勢加重 → ${SEVERITY_NAMES[severity + 1] || '重傷'}`, '#cc3333', true, true);
      }
    }
  }

  function _getPainLines(attr, part, severity) {
    const db = {
      legs: [
        ['你剛跑出三步，膝蓋就一陣刺痛。', '你蹲下來喘氣。今天練不下去了。'],
        ['腿傳來像火燒一樣的疼。', '你勉強撐著 — 撐不住。', '你倒下去了。'],
        ['腳一落地就傳來鑽心的痛。', '你直接跪在地上，臉色發白。', '訓練官皺眉。「下去，沒你的份。」'],
      ],
      arms: [
        ['你舉起木劍。', '手臂一陣電流般的麻痛，木劍落地。', '你看著自己的手 — 它在抖。'],
        ['你咬牙揮出一劍 — 啪！手指不聽使喚。', '劍柄滑出。你彎腰，心臟狂跳。'],
        ['你連劍都抬不起來。', '手臂像一根被擰過的破布。', '你站在那裡，兩手空空。'],
      ],
      torso: [
        ['你深吸一口氣 — 肋骨一陣尖叫。', '你彎下腰，喘氣困難。'],
        ['你每動一下都像刀在肋間切。', '你背靠牆，汗如雨下。'],
        ['一個普通的彎腰 — 你的肋骨痛到失去知覺。', '你癱坐在地，不能動彈。'],
      ],
      head: [
        ['你閉上眼想集中精神。', '一陣劇烈頭痛像針扎太陽穴。', '你甚至想不起剛才要想什麼。'],
        ['頭腦像塞滿了羊毛。', '你讀了三遍同一行，還是不懂。', '你放棄了。'],
        ['視野扭曲了一瞬間 — 兩個訓練場。', '你按著太陽穴。', '什麼都想不了。'],
      ],
    };
    const pool = db[part];
    if (!pool) return [];
    return pool[Math.min(severity, pool.length) - 1];
  }

  function _flashRedAndShake() {
    // 簡版：閃一下紅 + 搖晃 game-root
    const root = document.getElementById('game-root') || document.body;
    if (root) {
      root.classList.add('bt-flash-red');
      root.classList.add('bt-shake');
      setTimeout(() => {
        root.classList.remove('bt-flash-red');
        root.classList.remove('bt-shake');
      }, 600);
    }
  }

  // ══════════════════════════════════════════════════
  // UI 渲染
  // ══════════════════════════════════════════════════

  // 🆕 2026-04-23：計算癒合進度敘述
  //   回傳：「X 天後自癒」/「需治療」等給 tooltip 用
  function _getProgressText(part, w) {
    if (!w) return '';
    if (w.severity === 1) {
      const remain = Math.max(0, 4 - (w.daysElapsed || 0));
      return remain > 0 ? `${remain} 天後自癒` : '即將痊癒';
    }
    if (w.severity === 2) {
      const treated = (typeof Flags !== 'undefined') && Flags.has('wound_treated_' + part);
      const threshold = treated ? 7 : 15;
      const remain = Math.max(0, threshold - (w.daysElapsed || 0));
      const stateText = treated ? '治療中' : '未治療';
      if (remain > 0) return `${stateText}・${remain} 天後自癒`;
      return '即將痊癒';
    }
    // 重傷
    const days = w.daysElapsed || 0;
    if (days >= 20) return '需要手術（找老默）';
    if (days >= 10) return `重傷 ${days} 天・找老默`;
    return `重傷 ${days} 天・不會自癒`;
  }

  function renderWoundsList(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    ensureInit();
    const p = Stats.player;

    const active = PARTS.filter(part => p.wounds[part]);
    if (active.length === 0) {
      el.style.display = 'contents';
      el.innerHTML = '';
      return;
    }

    el.style.display = 'contents';
    let html = '';
    active.forEach(part => {
      const w = p.wounds[part];
      if (w.special) {
        const sdef = SPECIAL_DEFS[w.special];
        const name = sdef?.name || w.special;
        const desc = sdef?.desc || '';
        html += `<span class="trait-tag trait-wound-special" title="${desc}">`;
        html += `<span class="trait-prefix">⚠</span>${name}`;
        html += `</span>`;
        return;
      }
      const sevClass = ['', 'light', 'medium', 'severe'][w.severity];
      const sevName  = SEVERITY_NAMES[w.severity];
      const partName = PART_NAMES[part];
      // 🆕 2026-04-23：tooltip 含進度敘述
      const progress = _getProgressText(part, w);
      const tooltip  = `${partName}・${sevName}（${w.daysElapsed} 天）\n${progress}`;
      // 🆕 在標籤上顯示簡短進度（重傷玩家最需要看到）
      const shortProgress = w.severity === 3
        ? (w.daysElapsed >= 20 ? ' 💉' : '')   // 手術可用時加針頭圖示
        : '';
      html += `<span class="trait-tag trait-wound-${sevClass}" title="${tooltip}">`;
      html += `<span class="trait-prefix">🩹</span>${partName}・${sevName}${shortProgress}`;
      html += `</span>`;
    });
    el.innerHTML = html;
  }

  // ══════════════════════════════════════════════════
  // Public
  // ══════════════════════════════════════════════════

  return {
    PARTS,
    PART_NAMES,
    SEVERITY_NAMES,
    SPECIAL_DEFS,                     // 🆕
    TRAIN_PART_MAP,
    ensureInit,
    getWound,
    getWoundEffect,                   // 🆕
    hasAnyWound,
    countBySeverity,
    inflict,
    inflictSpecial,                   // 🆕
    upgradeSeverity,
    heal,
    onDayStart,
    getAttrPenalty,
    getTrainExpMultDec,
    checkTrainingPain,
    rollLowStaminaInjury,
    renderWoundsList,
  };
})();
