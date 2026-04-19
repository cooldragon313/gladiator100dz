/**
 * birth_traits.js — 出生特性擲骰系統（2026-04-19）
 *
 * 設計對應：docs/systems/traits.md § 出生特性軸組
 *
 * 5 軸互斥 × 正負稀有各 1% 獨立擲骰：
 *   智力軸 intelligence   天才 / 傻人傻福（正）/ 愚鈍（負）
 *   體質軸 constitution   鐵人（正）/ 病弱（負）
 *   運勢軸 luck           福星高照（正）/ 厄運之子（負）
 *   心性軸 spirit         神眷之子（正）/ 暗影纏身（負）
 *   天賦軸 gift           天生戰士（正）/ 膽小如鼠（負）
 *
 * 擲骰邏輯（每軸）：
 *   1% 擲正面 → 命中就選擇（同軸可能有兩個正面時隨機其一）
 *   1% 擲負面 → 命中就負面
 *   正負都命中 → 正面優先
 *   都沒命中 → 軸上沒有特性
 *
 * 重擲 2 次：玩家可以拒絕結果，最多重擲 2 次，第 3 次強制接受。
 */
const BirthTraits = (() => {

  // 軸定義：每軸的正負特性清單
  const AXIS_GROUPS = {
    intelligence: {
      positive: ['genius', 'dullard_lucky'],
      negative: ['dull'],
    },
    constitution: {
      positive: ['ironclad'],
      negative: ['sickly'],
    },
    luck: {
      positive: ['fortunate'],
      negative: ['cursed'],
    },
    spirit: {
      positive: ['blessed'],
      negative: ['shadowed'],
    },
    gift: {
      positive: ['born_warrior'],
      negative: ['cowardly'],
    },
  };

  // 正負稀有機率（每軸獨立擲骰）
  const RARE_PROB = 0.01;

  /**
   * 擲一整組出生特性。回傳特性 ID 陣列（可能為空）。
   */
  function rollAll() {
    const result = [];
    Object.entries(AXIS_GROUPS).forEach(([axis, group]) => {
      const rolledPositive = Math.random() < RARE_PROB;
      const rolledNegative = Math.random() < RARE_PROB;

      if (rolledPositive) {
        // 同軸可能有多個正面（如智力軸的天才/傻福），隨機挑一個
        const pool = group.positive;
        result.push(pool[Math.floor(Math.random() * pool.length)]);
      } else if (rolledNegative) {
        const pool = group.negative;
        result.push(pool[Math.floor(Math.random() * pool.length)]);
      }
    });
    return result;
  }

  /**
   * 擲六維屬性。基於 origin 的 statMod，在基礎 10 上 ±2 隨機。
   * @param {object} statMod origin 的 statMod（{ STR:+2, ... }）
   * @returns {object} { STR, DEX, CON, AGI, WIL, LUK }
   */
  function rollStats(statMod) {
    const attrs = ['STR', 'DEX', 'CON', 'AGI', 'WIL', 'LUK'];
    const out = {};
    attrs.forEach(a => {
      const mod = (statMod && typeof statMod[a] === 'number') ? statMod[a] : 0;
      const base = 10 + mod;
      const variance = Math.floor(Math.random() * 5) - 2;  // -2 ~ +2
      out[a] = Math.max(3, base + variance);  // 至少 3
    });
    return out;
  }

  /**
   * 計算一組出生特性的稀有度（幾個稀有特性）。
   */
  function countRare(traitIds) {
    if (!Array.isArray(traitIds)) return 0;
    if (typeof Config === 'undefined' || !Config.TRAIT_DEFS) return traitIds.length;
    return traitIds.filter(id => {
      const def = Config.TRAIT_DEFS[id];
      return def && def.isRare;
    }).length;
  }

  /**
   * 取得特性的中文名。
   */
  function nameOf(traitId) {
    if (typeof Config !== 'undefined' && Config.TRAIT_DEFS && Config.TRAIT_DEFS[traitId]) {
      return Config.TRAIT_DEFS[traitId].name;
    }
    return traitId;
  }

  /**
   * 取得特性的描述。
   */
  function descOf(traitId) {
    if (typeof Config !== 'undefined' && Config.TRAIT_DEFS && Config.TRAIT_DEFS[traitId]) {
      return Config.TRAIT_DEFS[traitId].desc;
    }
    return '';
  }

  /**
   * 取得特性的分類（positive / negative）。
   */
  function categoryOf(traitId) {
    if (typeof Config !== 'undefined' && Config.TRAIT_DEFS && Config.TRAIT_DEFS[traitId]) {
      return Config.TRAIT_DEFS[traitId].category;
    }
    return 'positive';
  }

  /**
   * 套用擲骰結果到 player。
   * @param {object} stats      { STR, DEX, CON, AGI, WIL, LUK }
   * @param {Array}  birthTraits  特性 ID 陣列
   */
  function applyRoll(stats, birthTraits) {
    const p = Stats.player;
    // 覆寫屬性
    Object.entries(stats).forEach(([attr, val]) => {
      p[attr] = Math.max(1, Math.round(val));
    });

    // 加入特性（避免重複）
    if (!Array.isArray(p.traits)) p.traits = [];
    birthTraits.forEach(tid => {
      if (!p.traits.includes(tid)) p.traits.push(tid);
    });

    // 套用特性的屬性加成（CON +3 / LUK -3 等）
    // 這些加成在 TRAIT_DEFS.desc 中描述，但要實際生效，寫進 p.eqBonus 或直接修屬性
    // 這裡我們直接修屬性（永久加成）
    birthTraits.forEach(tid => {
      _applyTraitPermanentMod(tid);
    });

    // 重算 hpMax
    if (typeof Stats.eff === 'function') {
      p.hpMax = (p.hpBase || 80) + Math.round(2 * Stats.eff('CON'));
      p.hp = p.hpMax;
    }
  }

  /**
   * 套用稀有特性的永久屬性加成。
   */
  function _applyTraitPermanentMod(traitId) {
    const p = Stats.player;
    const mods = {
      genius:       { WIL: +2 },
      dullard_lucky:{ WIL: -2 },
      dull:         { WIL: -3 },
      ironclad:     { CON: +3 },
      sickly:       { CON: -3 },
      fortunate:    { LUK: +3 },
      cursed:       { LUK: -3 },
      // blessed / shadowed / born_warrior / cowardly 為行為修正，不改屬性
    };
    const mod = mods[traitId];
    if (mod) {
      Object.entries(mod).forEach(([attr, delta]) => {
        p[attr] = Math.max(1, (p[attr] || 10) + delta);
      });
    }
  }

  /**
   * 套用被抓受傷（角色生成結尾）。
   *
   * 擲骰邏輯：
   *   總命中率 15%
   *     → 嚴重度：輕傷 60% / 中傷 30% / 重傷 10%
   *     → 部位：依 origin 有微量偏好，基本隨機
   *     → HP/food/mood 小幅損失（固定）
   * 沒命中 → 只有小幅 food/mood 損失，不受傷
   *
   * @param {string} originId
   * @returns {object} { injured, part, severity, memoryLine }
   */
  function applyCaptureInjury(originId) {
    const p = Stats.player;

    // 基礎損失（每個人都有，被抓過程本來就累）
    const loss = _baseLossByOrigin(originId);
    p.hp   = Math.max(1,  p.hp   - loss.hp);
    p.food = Math.max(5,  p.food - loss.food);
    p.mood = Math.max(5,  p.mood - loss.mood);

    // 擲傷勢骰
    const hit = Math.random() < 0.15;
    if (!hit) {
      return { injured: false };
    }

    // 嚴重度：輕 60 / 中 30 / 重 10
    const roll = Math.random();
    let severity = 1;
    if (roll < 0.10) severity = 3;
    else if (roll < 0.40) severity = 2;
    else severity = 1;

    // 部位：依 origin 加權，但隨機為主
    const part = _rollInjuryPart(originId);

    // 施加傷勢（由 Wounds 模組統一處理）
    if (typeof Wounds !== 'undefined') {
      Wounds.inflict(part, severity, { source: 'capture' });
    }

    // 回憶對白一句（依 origin × 部位）
    const memoryLine = _getMemoryLine(originId, part);

    return {
      injured: true,
      part,
      severity,
      memoryLine,
      hpLoss: loss.hp,
      foodLoss: loss.food,
      moodLoss: loss.mood,
    };
  }

  function _baseLossByOrigin(originId) {
    // 被抓過程的基礎 HP / food / mood 損失（與傷勢獨立）
    switch (originId) {
      case 'farmBoy':       return { hp: 10, food: 20, mood: 25 };
      case 'nobleman':      return { hp:  8, food: 15, mood: 40 };
      case 'ruinedKnight':  return { hp: 15, food: 10, mood: 20 };
      case 'beggar':        return { hp:  5, food: 25, mood: 15 };
      case 'artisan':       return { hp:  8, food: 15, mood: 20 };
      case 'criminal':      return { hp: 10, food: 10, mood: 10 };
      case 'gambler':       return { hp:  8, food: 18, mood: 25 };
      case 'believer':      return { hp:  6, food: 15, mood: 15 };
      default:              return { hp: 10, food: 15, mood: 20 };
    }
  }

  function _rollInjuryPart(originId) {
    // 不同 origin 有不同部位偏好（加權）
    const weights = {
      farmBoy:      { torso: 3, legs: 2, arms: 2, head: 1 },    // 村莊混戰傷軀幹
      nobleman:     { torso: 3, head: 2, legs: 2, arms: 1 },    // 被打下馬車
      ruinedKnight: { arms: 3, torso: 2, legs: 2, head: 1 },    // 劍下傷
      beggar:       { legs: 3, arms: 2, torso: 2, head: 1 },    // 街頭奔逃
      artisan:      { arms: 3, torso: 2, legs: 2, head: 1 },    // 工作傷
      criminal:     { torso: 2, arms: 2, legs: 2, head: 2 },    // 獄中隨機毆打
      gambler:      { torso: 3, arms: 2, legs: 2, head: 1 },    // 被討債的揍
      believer:     { head: 3, torso: 2, arms: 1, legs: 2 },    // 宗教迫害
    };
    const w = weights[originId] || { torso: 1, legs: 1, arms: 1, head: 1 };
    const pool = [];
    Object.entries(w).forEach(([part, cnt]) => {
      for (let i = 0; i < cnt; i++) pool.push(part);
    });
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function _getMemoryLine(originId, part) {
    // Origin × 部位 回憶對白矩陣
    const memories = {
      farmBoy: {
        legs:  '村子燒的那天 — 跑的時候腳踩斷過。',
        head:  '父親倒下時 — 有什麼砸到我。',
        arms:  '搶鐮刀擋人時 — 被砍了一刀。',
        torso: '馬賊用棍子捶過我，胸口到現在還喘不過氣。',
      },
      nobleman: {
        legs:  '被踢下馬車 — 腳骨斷過一次。',
        head:  '家臣的刀柄掃過來，眼前黑了好一陣子。',
        arms:  '掙扎時 — 手被扭到後面。',
        torso: '肋骨被靴子踹碎。每吸一口氣都痛。',
      },
      ruinedKnight: {
        legs:  '最後一戰 — 馬被打倒，腿壓在下面。',
        head:  '頭盔被砸凹了。之後老是頭暈。',
        arms:  '拿劍的手 — 中了一刀，肌肉沒修好。',
        torso: '鎧甲擋不下那一擊。肋骨到現在還凸。',
      },
      beggar: {
        legs:  '街頭被馬車輾過。當時差點死掉。',
        head:  '被人追打時撞到柱子。有時候還聽見嗡嗡聲。',
        arms:  '搶食物時被咬。傷口化膿過。',
        torso: '長年餓出來的虛。隨便一打就痛。',
      },
      artisan: {
        legs:  '工坊大火時 — 樑倒下來壓到腳。',
        head:  '被債主的人用棍子打過頭。',
        arms:  '手指曾經斷過。做木工時留下的。',
        torso: '被討債的用椅子砸過肚子。裡面傷了什麼。',
      },
      criminal: {
        legs:  '逃跑時被箭射到。箭頭還在裡面。',
        head:  '昨夜獄卒用鞋底拍我的臉。',
        arms:  '上次獄裡鬥毆留的。骨頭沒接好。',
        torso: '被打得差點咳血。到現在深呼吸還會痛。',
      },
      gambler: {
        legs:  '欠錢沒還 — 被討債的打折了。',
        head:  '賭桌翻掉時 — 酒壺砸過來。',
        arms:  '手腕被人折過一次。作弊被抓到的代價。',
        torso: '輸光那夜被連踹數腳。',
      },
      believer: {
        legs:  '神殿放逐我時 — 是用鞭子趕出去的。',
        head:  '最後一次禱告 — 被石頭砸中。',
        arms:  '揭露主祭時 — 被信眾拽著打。',
        torso: '神職者的杖打在我背上。那印子還在。',
      },
    };
    return memories[originId]?.[part] || '你記不清怎麼傷的了。只記得很痛。';
  }

  return {
    AXIS_GROUPS,
    rollAll,
    rollStats,
    countRare,
    nameOf,
    descOf,
    categoryOf,
    applyRoll,
    applyCaptureInjury,
  };
})();
