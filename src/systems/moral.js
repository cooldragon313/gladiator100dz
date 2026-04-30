/**
 * moral.js — 道德累積特性系統（D.19）
 * ══════════════════════════════════════════════════
 * 管理玩家「近期行為模式」→ 特性賦予/移除 的滑動窗口邏輯。
 *
 * 哲學：
 *   - 人物的標籤，來自「最近的行為」而不是「一輩子的總和」
 *   - 100 天太短，沒有「一輩子」— 每個選擇都該有機會被下一個覆蓋
 *   - 滑動窗口 = 「別人最近幾次看你做什麼」
 *
 * 運作：
 *   - 每個道德軸存最後 N=3 筆行動記錄
 *   - 窗口「全部同向」→ 獲得該側特性（push 進 player.traits）
 *   - 窗口「出現反向」→ 該軸的現有特性被移除（變中性）
 *   - 重複橫跳 = 永遠拿不到特性 = 「你什麼都不是」
 *
 * 關鍵事件：
 *   - 傳入 weight: 3 → 一口氣 push 三筆，直接定型
 *   - 傳入 locked: true → 標記該軸鎖住，後續行為無效（極少用，留給劇情重量級事件）
 *
 * 五個道德軸（對應 config.js TRAIT_DEFS 的 moralAxis）：
 *   reliability :  reliable ↔ coward
 *   mercy       :  merciful ↔ cruel
 *   loyalty     :  loyal    ↔ opportunist
 *   pride       :  humble   ↔ prideful
 *   patience    :  patient  ↔ impulsive
 *
 * 存檔：序列化 player.moralHistory + player.moralLocks
 */
const Moral = (() => {

  const WINDOW_SIZE = 3;

  // 軸 → { positive: traitId, negative: traitId }
  const AXIS_TRAITS = {
    reliability: { positive: 'reliable',  negative: 'coward'      },
    mercy:       { positive: 'merciful',  negative: 'cruel'       },
    loyalty:     { positive: 'loyal',     negative: 'opportunist' },
    pride:       { positive: 'humble',    negative: 'prideful'    },
    patience:    { positive: 'patient',   negative: 'impulsive'   },
  };

  const ALL_AXES = Object.keys(AXIS_TRAITS);

  /** 取得軸的所有相關 trait id（用於清理） */
  function axisTraits(axis) {
    const t = AXIS_TRAITS[axis];
    return t ? [t.positive, t.negative] : [];
  }

  /** 初始化玩家道德狀態 */
  function ensureInit(player) {
    if (!player.moralHistory) {
      player.moralHistory = {};
      ALL_AXES.forEach(axis => { player.moralHistory[axis] = []; });
    }
    if (!player.moralLocks) {
      player.moralLocks = {};
    }
    if (!Array.isArray(player.traits)) {
      player.traits = [];
    }
  }

  /**
   * 推入一筆道德行動記錄，並重算特性。
   *
   * @param {string} axis      'reliability' | 'mercy' | 'loyalty' | 'pride' | 'patience'
   * @param {string} side      'positive' | 'negative'
   * @param {object} [opts]
   * @param {number} [opts.weight=1]  push 幾筆（關鍵事件用 3 = 一次定型）
   * @param {boolean} [opts.lock=false]  鎖住此軸，之後的 push 無效（劇情重量級事件）
   * @returns {{added: string[], removed: string[]}}  本次變動的 trait
   */
  function push(axis, side, opts = {}) {
    const player = (typeof Stats !== 'undefined') ? Stats.player : null;
    if (!player) return { added: [], removed: [] };
    ensureInit(player);

    if (!AXIS_TRAITS[axis]) {
      console.warn('[Moral] unknown axis:', axis);
      return { added: [], removed: [] };
    }
    if (side !== 'positive' && side !== 'negative') {
      console.warn('[Moral] invalid side:', side);
      return { added: [], removed: [] };
    }
    if (player.moralLocks[axis]) {
      // 已鎖 → 忽略
      return { added: [], removed: [] };
    }

    const weight = Math.max(1, Math.min(opts.weight || 1, WINDOW_SIZE));
    const hist   = player.moralHistory[axis] || (player.moralHistory[axis] = []);

    for (let i = 0; i < weight; i++) {
      hist.push(side);
    }
    // 裁剪到窗口大小
    while (hist.length > WINDOW_SIZE) hist.shift();

    if (opts.lock) player.moralLocks[axis] = true;

    return recomputeAxis(axis);
  }

  /**
   * 重算單一軸的特性。根據窗口內容決定加 / 刪哪些 trait。
   */
  function recomputeAxis(axis) {
    const player = Stats.player;
    ensureInit(player);

    const hist = player.moralHistory[axis] || [];
    const pair = AXIS_TRAITS[axis];
    const result = { added: [], removed: [] };

    // 先移除該軸的所有現有 trait
    const before = new Set(player.traits);
    const both   = axisTraits(axis);
    both.forEach(tid => {
      const i = player.traits.indexOf(tid);
      if (i >= 0) player.traits.splice(i, 1);
    });

    // 滿窗且全同向 → 賦予該側
    if (hist.length >= WINDOW_SIZE && hist.every(s => s === hist[0])) {
      const tid = (hist[0] === 'positive') ? pair.positive : pair.negative;
      if (!player.traits.includes(tid)) player.traits.push(tid);
    }

    // 算出 added / removed
    const after = new Set(player.traits);
    before.forEach(t => { if (!after.has(t) && both.includes(t)) result.removed.push(t); });
    after.forEach(t  => { if (!before.has(t) && both.includes(t)) result.added.push(t); });

    return result;
  }

  /** 清空某軸的窗口（例如某些劇情事件重啟計數） */
  function clearAxis(axis) {
    const player = Stats.player;
    ensureInit(player);
    if (player.moralHistory[axis]) player.moralHistory[axis] = [];
    return recomputeAxis(axis);
  }

  /** 全部重算（讀檔後用） */
  function recomputeAll() {
    ALL_AXES.forEach(recomputeAxis);
  }

  /** 取得玩家目前所有 earned traits（用於 UI 顯示） */
  function getEarnedTraits() {
    const player = (typeof Stats !== 'undefined') ? Stats.player : null;
    if (!player) return [];
    ensureInit(player);
    const all = [];
    ALL_AXES.forEach(axis => {
      axisTraits(axis).forEach(tid => {
        if (player.traits.includes(tid)) all.push(tid);
      });
    });
    return all;
  }

  /** 取得某軸目前的窗口狀態（用於 UI 顯示） */
  function getAxisHistory(axis) {
    const player = (typeof Stats !== 'undefined') ? Stats.player : null;
    if (!player) return [];
    ensureInit(player);
    return [...(player.moralHistory[axis] || [])];
  }

  // ══════════════════════════════════════════════════
  // 🆕 2026-05-01：衝動 vs 冷靜傾向判定（Day 65 領主相認分支用）
  //   設計：[docs/quests/arena-events-roster.md § 6b.5](../../docs/quests/arena-events-roster.md)
  //   - impulsive：玩家有 prideful (pride 軸 negative) 或 impulsive (patience 軸 negative)
  //   - calm：玩家有 humble (pride 軸 positive) 或 patient (patience 軸 positive)
  //   - neutral：兩者都沒、Day 65 觸發時讓玩家自選
  //   未來可擴充：出生特性「暴怒/不屈」歸 impulsive、「沉著/堅忍」歸 calm
  // ══════════════════════════════════════════════════
  const IMPULSIVE_TRAITS = ['prideful', 'impulsive'];
  const CALM_TRAITS      = ['humble', 'patient'];

  /**
   * 取得玩家「衝動 vs 冷靜」傾向
   * @returns {'impulsive' | 'calm' | 'neutral'}
   */
  function getDispositionType() {
    const player = (typeof Stats !== 'undefined') ? Stats.player : null;
    if (!player || !Array.isArray(player.traits)) return 'neutral';
    const traits = player.traits;
    const isImpulsive = IMPULSIVE_TRAITS.some(t => traits.includes(t));
    const isCalm      = CALM_TRAITS.some(t => traits.includes(t));
    // 兩者都有 → 衝動勝出（更戲劇）
    if (isImpulsive) return 'impulsive';
    if (isCalm)      return 'calm';
    return 'neutral';
  }

  return {
    WINDOW_SIZE,
    AXIS_TRAITS,
    ALL_AXES,
    ensureInit,
    push,
    clearAxis,
    recomputeAxis,
    recomputeAll,
    getEarnedTraits,
    getAxisHistory,
    getDispositionType,   // 🆕 2026-05-01
  };
})();
