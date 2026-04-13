/**
 * stats.js — Player statistics, calculations, and bar rendering
 */
const Stats = (() => {
  const player = {
    name: '無名',
    day:  1,
    time: 360, // minutes since midnight (6:00)

    // ── Vitals ──
    fame:       0,
    hp:         100, hpMax:      100, hpBase: 80,
    stamina:    50,  staminaMax: 100,
    food:       50,  foodMax:    100,
    mood:       50,  moodMax:    100,

    // ── Six Base Attributes ──
    STR: 10, DEX: 10, CON: 10,
    AGI: 10, WIL: 10, LUK: 10,

    // ── Equipment bonuses (updated by equip/unequip) ──
    eqBonus: {
      STR:0, DEX:0, CON:0, AGI:0, WIL:0, LUK:0,
      ATK:0, DEF:0, ACC:0, PEN:0,
      BLK:0, BpWr:0, SPD:0, CRT:0, CDMG:0, EVA:0,
    },

    // ── Temporary buff bonuses ──
    buffBonus: {
      STR:0, DEX:0, CON:0, AGI:0, WIL:0, LUK:0,
      ATK:0, DEF:0, ACC:0, PEN:0,
      BLK:0, BpWr:0, SPD:0, CRT:0, CDMG:0, EVA:0,
    },

    // ── Affection levels per NPC ──
    // ⚠️ D.1.2: LEGACY 欄位，已不再寫入或讀取。
    // 所有好感度現在由 teammates 模組統一管理（npc.js）。
    // 保留此欄位僅為向下相容舊存檔。
    // 未來任何地方想查好感度：teammates.getAffection(npcId)
    affection: {
      master:    0,
      officer:   0,
      blacksmith:0,
      cook:      0,
    },

    // ── Inventory ──
    inventory: [],                    // 舊物品清單（向下相容，未來由 personalItems 取代）
    equippedWeapon:  null,
    equippedArmor:   null,             // 胸甲主槽（D.2 多部位系統啟用後由 equippedChest 取代）
    equippedOffhand: null,              // 盾牌 ID 或單手武器 ID（雙持）

    // ── 🆕 多部位裝備預留（D.2） ──
    equippedHelmet: null,   // 頭盔
    equippedChest:  null,   // 胸甲（啟用後替代 equippedArmor）
    equippedArms:   null,   // 護臂
    equippedLegs:   null,   // 護腿

    // ── 🆕 金錢系統（D.1.6） ──
    money:        0,        // 當前金錢
    moneyEarned:  0,        // 累積獲得（統計用）
    moneySpent:   0,        // 累積花費（統計用）

    // ── 🆕 經驗值系統（D.6） ──
    exp: { STR:0, DEX:0, CON:0, AGI:0, WIL:0, LUK:0 },
    sp:       0,            // 技能點
    spEarned: 0,            // 累積獲得（統計用）

    // ── 🆕 個人物品（D.3） ──
    personalItems: [],      // 最多 6 格（D.3 實作時加入上限檢查）

    // ── 🆕 寵物槽位（D.5） ──
    pets: {
      companion: null,       // 跟著玩家（狗/貓）
      cell:      null,       // 住在牢房（老鼠）
      outside:   null,       // 住在戶外（烏鴉/獵鷹）
    },

    // ── 🆕 疤痕（D.2 / C.1） ──
    scars: [],

    // ── 🆕 身分系統預留（D.11 模板對應） ──
    origin:   null,          // 玩家背景 ID（ORIGINS）
    facility: null,          // 訓練所 ID（FACILITIES）
    religion: null,          // 信仰 ID（DEITIES）
    faction:  null,          // 派系 ID

    // ── Combat statistics (累積戰績) ──
    combatStats: {
      executionCount: 0,   // 砍首累積次數
      spareCount:     0,   // 饒恕累積次數
      suppressCount:  0,   // 踩臉累積次數
      arenaWins:      0,   // 競技場勝場
      arenaLosses:    0,   // 競技場敗場
      sRankCount:     0,   // S 評分次數
      aRankCount:     0,   // A 評分次數
      totalTicks:     0,   // 累積戰鬥 tick 數（用於統計）
      winStreak:      0,   // 當前連勝場數（輸了歸 0）
    },

    // ── Stamina penalty (applied via eff()) ──
    staminaPenalty: { STR:0, DEX:0, CON:0, AGI:0, WIL:0, LUK:0 },

    // ── Achievements & Traits ──
    achievements: [],      // 已解鎖成就 ID 陣列
    traits:       [],      // 已激活特性 ID 陣列
    title:        null,    // 額外稱號（字串 or null）
    fameBase:     0,       // 每場競技場獲勝的額外固定名聲
  };

  // Effective attr = base + equipment bonus + buff bonus - stamina penalty
  function eff(attr) {
    return player[attr]
      + (player.eqBonus[attr]      || 0)
      + (player.buffBonus[attr]    || 0)
      - (player.staminaPenalty[attr] || 0);
  };

  function calcDerived() {
    const S = eff('STR'), D = eff('DEX'), C = eff('CON'),
          A = eff('AGI'), W = eff('WIL'), L = eff('LUK');
    const w  = (typeof TB_WEAPONS !== 'undefined' && TB_WEAPONS[player.equippedWeapon])
               ? TB_WEAPONS[player.equippedWeapon]  : { ATK:0, ACC:0, CRT:0, CDMG:0, SPD:0, PEN:0, route:'fury' };
    const ar = (typeof TB_ARMORS  !== 'undefined' && TB_ARMORS[player.equippedArmor])
               ? TB_ARMORS[player.equippedArmor]    : { DEF:0, SPD:0, EVA:0 };

    // ── 副手判定 ──────────────────────────────────────────
    const offId = player.equippedOffhand || 'none';
    const isOffhandShield = (offId !== 'none') && (typeof TB_SHIELDS !== 'undefined') && !!TB_SHIELDS[offId];
    const isOffhandWeapon = (offId !== 'none') && !isOffhandShield
                            && (typeof TB_WEAPONS !== 'undefined') && !!TB_WEAPONS[offId] && !TB_WEAPONS[offId].twoHanded;
    const isDualWield     = isOffhandWeapon;
    const sh  = isOffhandShield ? TB_SHIELDS[offId] : { BLK:0, DEF:0, SPD:0 };
    const offW = isDualWield    ? TB_WEAPONS[offId] : null;

    const eb = player.eqBonus, bb = player.buffBonus;

    let ATK  = Math.round(1.5*S  + 0.5*D  + w.ATK            + (eb.ATK ||0) + (bb.ATK ||0));
    let DEF  = Math.round(1.5*C  + 0.5*S  + ar.DEF + sh.DEF  + (eb.DEF ||0) + (bb.DEF ||0));
    let ACC  = Math.min(100, Math.round(60 + 0.5*D + 0.25*L + (w.ACC||0)  + (eb.ACC ||0) + (bb.ACC ||0)));
    let CRT  = Math.min(75,  Math.round(0.25*D + 0.5*L + w.CRT            + (eb.CRT ||0) + (bb.CRT ||0)));
    let CDMG = Math.min(300, Math.round(150 + 0.5*D + 0.25*L + 0.5*W + (w.CDMG||0) + (eb.CDMG||0) + (bb.CDMG||0)));
    let PEN  = Math.min(75,  Math.round(0.5*D + 0.5*S + w.PEN  + (eb.PEN||0) + (bb.PEN||0)));
    let BLK  = Math.min(75,  Math.round(0.5*C + sh.BLK         + (eb.BLK ||0) + (bb.BLK ||0)));
    let BpWr = Math.min(85,  Math.round(0.5*S + sh.BLK * 1.5   + (eb.BpWr||0) + (bb.BpWr||0)));
    let EVA  = Math.min(95,  Math.round(2*A   + 0.5*L + ar.EVA  + (eb.EVA ||0) + (bb.EVA ||0)));
    let SPD  = Math.round(0.75*A + 0.25*D + w.SPD + ar.SPD      + (eb.SPD ||0) + (bb.SPD ||0));

    // ── 雙持修正 ──────────────────────────────────────────
    if (isDualWield && offW) {
      ATK += Math.round(offW.ATK * 0.5);
      ACC  = Math.max(0, ACC - 5);
      SPD -= 3;
      BLK  = 0;
      BpWr = 0;
    }

    // ── 路線判定：副手覆蓋武器原始路線 ────────────────────
    let route;
    if (isOffhandShield)     route = 'fury';
    else if (isDualWield)    route = 'rage';
    else                     route = w.route || 'fury';

    const gaugeBonus = Math.min(0.30, Math.floor(W / 10) * 0.03);
    const spdBonus   = Math.min(0.30, SPD * 0.005);
    return { ATK, DEF, ACC, CRT, CDMG, PEN, BLK, BpWr, EVA, SPD, route, gaugeBonus, spdBonus };
  }
  // ── Render helpers ────────────────────────────────────

  function renderVitalBars() {
    player.hpMax = player.hpBase + Math.round(2 * eff('CON'));
    player.hp = Math.min(player.hp, player.hpMax);
    const defs = [
      { id:'bar-hp',      val: player.hp,      max: player.hpMax,      color:'#cc2200', label:'HP'   },
      { id:'bar-stamina', val: player.stamina,  max: player.staminaMax, color:'#cc7700', label:'體力' },
      { id:'bar-food',    val: player.food,     max: player.foodMax,    color:'#1e7a3a', label:'飽食度'},
      { id:'bar-mood',    val: player.mood,     max: player.moodMax,    color:'#2255aa', label:'心情' },
    ];
    defs.forEach(d => {
      const wrap = document.getElementById(d.id);
      if (!wrap) return;
      const pct = Math.max(0, Math.min(100, d.val / d.max * 100));
      wrap.querySelector('.bar-fill').style.width = pct + '%';
      wrap.querySelector('.bar-fill').style.background = d.color;
      wrap.querySelector('.bar-num').textContent = d.val + '/' + d.max;
    });
  }

  function renderAttributes() {
    const map = [
      ['力量', 'STR'], ['反應', 'AGI'],
      ['靈巧', 'DEX'], ['意志', 'WIL'],
      ['體質', 'CON'], ['幸運', 'LUK'],
    ];
    map.forEach(([label, key]) => {
      const el = document.getElementById('attr-' + key);
      if (el) el.textContent = Math.round(eff(key));
    });
  }

  function renderDerivedStats() {
    const d = calcDerived();
    const keys = ['ATK','DEF','ACC','PEN','BLK','BpWr','SPD','CRT','CDMG','EVA'];
    const pctKeys = new Set(['ACC','CRT','CDMG','BLK','BpWr','EVA']);
    keys.forEach(k => {
      const el = document.getElementById('drv-' + k);
      if (!el) return;
      el.textContent = pctKeys.has(k) ? d[k] + '%' : d[k];
    });
    // Route badge
    const routeEl = document.getElementById('drv-route');
    if (routeEl) {
      const routeLabels = { rage: '狂暴', focus: '集中', fury: '怒氣' };
      routeEl.textContent = routeLabels[d.route] || d.route;
      routeEl.className = 'route-badge route-' + d.route;
    }
  }

  function renderFame() {
    const el = document.getElementById('fame-bar-fill');
    if (el) el.style.width = Math.min(100, player.fame) + '%';
    const lbl = document.getElementById('fame-val');
    if (lbl) lbl.textContent = player.fame;
  }

  function renderAll() {
    renderVitalBars();
    renderAttributes();
    renderDerivedStats();
    renderFame();
    renderMoney();
  }

  // ── Modifiers ─────────────────────────────────────────

  // ── Stamina penalty ──────────────────────────────────
  // 體力 ≤30 → 所有基礎屬性 -2；≤15 → -4
  function updateStaminaPenalty() {
    const pen = player.stamina <= 15 ? 4
              : player.stamina <= 30 ? 2
              : 0;
    const ATTRS = ['STR','DEX','CON','AGI','WIL','LUK'];
    ATTRS.forEach(a => { player.staminaPenalty[a] = pen; });
    renderAttributes();
    renderDerivedStats();
  }

  function modVital(key, delta) {
    const maxKey = key + 'Max';
    player[key] = Math.max(0, Math.min(player[maxKey] || 100, player[key] + delta));
    if (key === 'stamina') updateStaminaPenalty();
    renderVitalBars();
  }

  function modFame(delta) {
    player.fame = Math.max(0, player.fame + delta);
    renderFame();
  }

  /**
   * 修改基礎屬性（STR/DEX/CON/AGI/WIL/LUK）。
   *
   * D.1.3: 下限從 0 改為 1。原因：
   *   - 避免未來公式 division-by-zero
   *   - 屬性 = 0 概念上等於「不存在」，不合理
   *   - 背景修正（如 STR-2）仍可安全運作
   *   - eff() 仍然可以透過 staminaPenalty/debuff 暫時降到 0 以下（戰鬥用）
   */
  function modAttr(key, delta) {
    if (player[key] !== undefined) {
      player[key] = Math.max(1, player[key] + delta);
      renderAttributes();
      renderDerivedStats();
    }
  }

  // ── 🆕 金錢系統（D.1.6） ─────────────────────
  /**
   * 修改金錢。
   * @param {number} delta 正數=獲得，負數=花費
   * @returns {boolean} 是否成功（花費時金錢不足會回傳 false）
   */
  function modMoney(delta) {
    if (delta < 0 && player.money + delta < 0) return false;  // 金錢不足
    player.money += delta;
    if (delta > 0) player.moneyEarned += delta;
    else           player.moneySpent  += -delta;
    renderMoney();
    return true;
  }

  function renderMoney() {
    const el = document.getElementById('stat-money');
    if (el) el.textContent = player.money;
    const csEl = document.getElementById('cs-money');
    if (csEl) csEl.textContent = player.money;
  }

  // ── 🆕 經驗值系統（D.6） ──────────────────────
  /**
   * 累加屬性 EXP，自動升級（若達門檻）。
   * 目前只累加不升級，D.6 實作時補上升級邏輯。
   * @param {string} attr STR/DEX/CON/AGI/WIL/LUK
   * @param {number} delta
   */
  function modExp(attr, delta) {
    if (!player.exp || player.exp[attr] === undefined) return;
    player.exp[attr] = Math.max(0, player.exp[attr] + delta);
    // D.6 實作時：檢查是否達到 expToNext 門檻 → 自動升級屬性 + 發 SP
  }

  // ── 🆕 技能點（D.6） ──────────────────────────
  function modSp(delta) {
    player.sp = Math.max(0, player.sp + delta);
    if (delta > 0) player.spEarned += delta;
  }

  // ── 🆕 Phase 1-C: 狀態等級查詢 ──────────────────
  /**
   * 取得某個數值的當前等級名稱。
   * 用於事件觸發條件判定（Phase 1-D/E）。
   *
   * @param {string} key 'food' | 'stamina' | 'mood' | 'hp'
   * @returns {string}   等級名稱（見 Config.THRESHOLDS）
   *
   * @example
   *   Stats.getVitalTier('food')  // 'normal' | 'hungry' | 'starving' 等
   */
  function getVitalTier(key) {
    if (typeof Config === 'undefined') return 'normal';
    return Config.getTier(key, player[key] || 0);
  }

  /**
   * 快速檢查某數值是否處於某等級或更糟。
   *
   * @param {string} key   'food' | 'stamina' | 'mood'
   * @param {string} tier  例如 'hungry', 'tired'
   * @returns {boolean}
   *
   * @example
   *   Stats.isVitalAtOrBelow('food', 'hungry')  // 餓或更糟 → true
   */
  function isVitalAtOrBelow(key, tier) {
    if (typeof Config === 'undefined') return false;
    const threshold = Config.THRESHOLDS[key]?.[tier];
    if (threshold === undefined) return false;
    return (player[key] || 0) <= threshold;
  }

  function getTimeStr() {
    const h = Math.floor(player.time / 60) % 24;
    const m = player.time % 60;
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  }

  function advanceTime(minutes) {
    player.time += minutes;
    if (player.time >= 1440) {
      player.time -= 1440;
      player.day = Math.min(100, player.day + 1);
    }
  }

  // Room tier based on fame
  function getRoomTier() {
    if (player.fame >= 60) return 'luxuryRoom';
    if (player.fame >= 20) return 'basicRoom';
    return 'dirtyCell';
  }

  return {
    player,
    eff,
    calcDerived,
    // 渲染
    renderAll,
    renderVitalBars,
    renderAttributes,
    renderDerivedStats,
    renderFame,
    renderMoney,
    // 修改器
    modVital,
    modFame,
    modAttr,
    modMoney,   // 🆕 D.1.6
    modExp,     // 🆕 D.6 預留
    modSp,      // 🆕 D.6 預留
    // 🆕 Phase 1-C 狀態等級查詢
    getVitalTier,
    isVitalAtOrBelow,
    // 時間
    getTimeStr,
    advanceTime,
    // 工具
    getRoomTier,
    updateStaminaPenalty,
  };
})();
