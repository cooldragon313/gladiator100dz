/**
 * affixes.js — 裝備詞綴系統（20 個詞綴）
 *
 * 設計：[docs/systems/equipment-rework.md § 3](../../docs/systems/equipment-rework.md)
 *
 * 詞綴 = 武器/護甲身上的「橫向」修飾符。
 * 玩家可以在葛拉鋪鍛新詞綴（50 金 + 葛拉好感 70+ + 上紫以上品質）
 * 升級品質時也會自動加新詞綴（普白→精藍 +1、精藍→上紫 +1、上紫→傳金 +1）
 *
 * 每件武器最多 3 詞綴、護甲最多 2 詞綴。
 *
 * 結構：
 *   id: '...'              — 程式 ID
 *   name: '...'            — 中文名（會接「的」變前綴）
 *   slot: 'weapon'|'armor' — 適用裝備類別
 *   passive: { ATK, ACC, CRT, SPD, PEN, CDMG, DEF, EVA }  — 戰鬥被動加成
 *   active: { type, ... }  — 主動效果（命中時觸發）— Phase 3 才接戰鬥引擎、目前 stub
 *   tier: 1|2|3            — 詞綴稀有度（影響掉落 / 鍛造機率）
 */
const Affixes = (() => {

  const AFFIX_DEFS = {
    // ═══════════════════════════════════════════════════
    // 武器 14 個（被動 11 + 主動 3）
    // ═══════════════════════════════════════════════════

    // T1 純加成（容易抽到）
    sharp: {
      id: 'sharp', name: '鋒利', slot: 'weapon', tier: 1,
      passive: { ATK: 2 },
      desc: 'ATK +2',
    },
    precise: {
      id: 'precise', name: '精準', slot: 'weapon', tier: 1,
      passive: { ACC: 3 },
      desc: 'ACC +3',
    },
    swift: {
      id: 'swift', name: '飛快', slot: 'weapon', tier: 1,
      passive: { SPD: 2 },
      desc: 'SPD +2',
    },
    piercing: {
      id: 'piercing', name: '穿甲', slot: 'weapon', tier: 1,
      passive: { PEN: 3 },
      desc: 'PEN +3（無視 3 點 DEF）',
    },

    // T2 中階（小機率抽）
    lethal: {
      id: 'lethal', name: '致命', slot: 'weapon', tier: 2,
      passive: { CRT: 5 },
      desc: 'CRT +5（暴擊機率）',
    },
    crushing: {
      id: 'crushing', name: '重擊', slot: 'weapon', tier: 2,
      passive: { CDMG: 20 },
      desc: 'CDMG +20（暴擊傷害）',
    },
    vibrating: {
      id: 'vibrating', name: '顫鳴', slot: 'weapon', tier: 2,
      passive: { ATK: 1, SPD: 1 },
      desc: 'ATK +1 / SPD +1（雙屬）',
    },
    honed: {
      id: 'honed', name: '精鍛', slot: 'weapon', tier: 2,
      passive: { ATK: 1, CRT: 2 },
      desc: 'ATK +1 / CRT +2（鋒利+暴擊）',
    },
    windborne: {
      id: 'windborne', name: '狂風', slot: 'weapon', tier: 2,
      passive: { SPD: 3, EVA: 1 },
      desc: 'SPD +3 / EVA +1',
    },

    // T3 稀有（極端 build 用）
    balanced: {
      id: 'balanced', name: '平衡', slot: 'weapon', tier: 3,
      passive: { ATK: 1, ACC: 1, CRT: 1, SPD: 1, PEN: 1 },
      desc: 'ATK/ACC/CRT/SPD/PEN 各 +1（雜燴系）',
    },
    roaring: {
      id: 'roaring', name: '嘶吼', slot: 'weapon', tier: 3,
      passive: {},
      active: { type: 'opening', enemySpdDelta: -3 },
      desc: '戰鬥開場敵 SPD -3（開戰壓制）',
    },

    // 主動效果（Phase 3 接戰鬥引擎、目前掛上但無戰鬥效果）
    vampiric: {
      id: 'vampiric', name: '嗜血', slot: 'weapon', tier: 3, isActive: true,
      passive: {},
      active: { type: 'onHit', heal: 0.05 },
      desc: '命中時回 5% 損傷 HP（Phase 3 接戰鬥引擎）',
    },
    flaming: {
      id: 'flaming', name: '灼燒', slot: 'weapon', tier: 3, isActive: true,
      passive: {},
      active: { type: 'onHit', dotTurns: 3, dotDmg: 5 },
      desc: '命中時敵燒 3 回合（每回合 5 損傷）（Phase 3）',
    },
    reaping: {
      id: 'reaping', name: '死神', slot: 'weapon', tier: 3, isActive: true,
      passive: {},
      active: { type: 'execute', threshold: 0.30, atkMult: 1.50 },
      desc: '對 HP < 30% 敵人 ATK +50%（Phase 3）',
    },

    // ═══════════════════════════════════════════════════
    // 護甲 6 個（被動 5 + 主動 1）
    // ═══════════════════════════════════════════════════

    sturdy: {
      id: 'sturdy', name: '厚實', slot: 'armor', tier: 1,
      passive: { DEF: 3 },
      desc: 'DEF +3',
    },
    vigilant: {
      id: 'vigilant', name: '機警', slot: 'armor', tier: 1,
      passive: { EVA: 3 },
      desc: 'EVA +3',
    },
    steadfast: {
      id: 'steadfast', name: '沉穩', slot: 'armor', tier: 2,
      passive: { DEF: 1, SPD: 1 },
      desc: 'DEF +1 / SPD +1（不挨揍）',
    },
    warding: {
      id: 'warding', name: '護身', slot: 'armor', tier: 2,
      passive: { DMG_REDUCE: 3 },
      desc: '受擊傷害 -3（直接減傷、Phase 3 接引擎）',
    },
    weighty: {
      id: 'weighty', name: '重壓', slot: 'armor', tier: 2,
      passive: { DEF: 5, SPD: -1 },
      desc: 'DEF +5 / SPD -1（重甲走得堅實）',
    },
    riposting: {
      id: 'riposting', name: '反擊', slot: 'armor', tier: 3, isActive: true,
      passive: {},
      active: { type: 'onTaken', chance: 0.30, reflectDmg: 5 },
      desc: '被擊後 30% 機率反 5 損傷（Phase 3）',
    },
  };

  // ═══════════════════════════════════════════════════
  // API
  // ═══════════════════════════════════════════════════

  function getDef(id) { return AFFIX_DEFS[id] || null; }
  function getName(id) { return AFFIX_DEFS[id]?.name || id; }
  function getDesc(id) { return AFFIX_DEFS[id]?.desc || ''; }

  /**
   * 列出指定裝備類別 + tier 範圍 + 排除已有的詞綴
   * @param {string} slot 'weapon' / 'armor'
   * @param {number} maxTier 最高 tier（粗灰=1 / 良品=1 / 精品=2 / 上品=2 / 傳家=3）
   * @param {Array<string>} exclude 已有的詞綴 ID
   */
  function getRollPool(slot, maxTier, exclude) {
    const ex = new Set(exclude || []);
    return Object.values(AFFIX_DEFS).filter(a =>
      a.slot === slot && a.tier <= maxTier && !ex.has(a.id)
    );
  }

  /**
   * 隨機抽一個詞綴。低 tier 機率比較高。
   * @returns {string|null} 詞綴 id
   */
  function rollAffix(slot, maxTier, exclude) {
    const pool = getRollPool(slot, maxTier, exclude);
    if (pool.length === 0) return null;
    // tier 1 機率 60%、tier 2 機率 30%、tier 3 機率 10%（如果 maxTier 限制）
    const t1 = pool.filter(a => a.tier === 1);
    const t2 = pool.filter(a => a.tier === 2);
    const t3 = pool.filter(a => a.tier === 3);
    const r = Math.random();
    let bucket;
    if (r < 0.60 && t1.length > 0) bucket = t1;
    else if (r < 0.90 && t2.length > 0) bucket = t2;
    else if (t3.length > 0) bucket = t3;
    else bucket = pool;
    return bucket[Math.floor(Math.random() * bucket.length)].id;
  }

  /**
   * 品質決定可抽詞綴的最高 tier
   *   crude  → 1
   *   common → 1
   *   fine   → 2
   *   superb → 2
   *   legendary → 3
   */
  function maxTierForQuality(quality) {
    if (quality === 'legendary') return 3;
    if (quality === 'superb') return 2;
    if (quality === 'fine')   return 2;
    return 1;
  }

  /**
   * 品質決定詞綴上限數量
   *   crude  → 0
   *   common → 0
   *   fine   → 1
   *   superb → 2
   *   legendary → 3
   */
  function maxAffixCountForQuality(quality) {
    if (quality === 'legendary') return 3;
    if (quality === 'superb') return 2;
    if (quality === 'fine')   return 1;
    return 0;
  }

  /**
   * 計算詞綴的被動戰鬥加成總和（給 testbattle.js 用）
   * @param {Array<string>} affixIds
   * @returns {object} { ATK, ACC, CRT, SPD, PEN, CDMG, DEF, EVA, DMG_REDUCE }
   */
  function computePassiveBonus(affixIds) {
    const bonus = { ATK:0, ACC:0, CRT:0, SPD:0, PEN:0, CDMG:0, DEF:0, EVA:0, DMG_REDUCE:0 };
    if (!Array.isArray(affixIds)) return bonus;
    affixIds.forEach(id => {
      const def = AFFIX_DEFS[id];
      if (!def || !def.passive) return;
      Object.keys(def.passive).forEach(k => {
        if (typeof bonus[k] === 'number') bonus[k] += def.passive[k];
      });
    });
    return bonus;
  }

  /** 詞綴名前綴（多個用「、」連、按字母序）*/
  function formatPrefix(affixIds) {
    if (!Array.isArray(affixIds) || affixIds.length === 0) return '';
    const sorted = [...affixIds].sort();
    return sorted.map(id => getName(id)).join('、') + '的';
  }

  return {
    AFFIX_DEFS,
    getDef, getName, getDesc,
    getRollPool, rollAffix,
    maxTierForQuality, maxAffixCountForQuality,
    computePassiveBonus,
    formatPrefix,
  };
})();
