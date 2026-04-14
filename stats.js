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
    traits:       ['kindness'],             // 已激活特性 ID 陣列（positive/negative）
    // 🆕 D.6 v2: 已習得技能 ID 陣列（含被動與主動，被動自動生效）
    learnedSkills: [],
    ailments:     ['insomnia_disorder'],   // 🆕 Phase 1-D: 當前病痛 ID 陣列（見 Config.AILMENT_DEFS）
    title:        null,    // 額外稱號（字串 or null）
    fameBase:     0,       // 每場競技場獲勝的額外固定名聲

    // 🆕 Phase 1-D: 就寢狀態追蹤
    insomniaStreak:    0,  // 連續失眠天數（≥2 觸發失眠症）
    normalSleepStreak: 0,  // 連續正常睡眠天數（≥3 解除失眠症）
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
    // 🆕 D.6 v2：被動技能加成（動態從 learnedSkills 計算）
    const sk = {
      ATK:  _getSkillBonus('ATK'),  DEF:  _getSkillBonus('DEF'),
      ACC:  _getSkillBonus('ACC'),  CRT:  _getSkillBonus('CRT'),
      CDMG: _getSkillBonus('CDMG'), PEN:  _getSkillBonus('PEN'),
      BLK:  _getSkillBonus('BLK'),  BpWr: _getSkillBonus('BpWr'),
      EVA:  _getSkillBonus('EVA'),  SPD:  _getSkillBonus('SPD'),
    };

    let ATK  = Math.round(1.5*S  + 0.5*D  + w.ATK            + (eb.ATK ||0) + (bb.ATK ||0) + sk.ATK);
    let DEF  = Math.round(1.5*C  + 0.5*S  + ar.DEF + sh.DEF  + (eb.DEF ||0) + (bb.DEF ||0) + sk.DEF);
    let ACC  = Math.min(100, Math.round(60 + 0.5*D + 0.25*L + (w.ACC||0)  + (eb.ACC ||0) + (bb.ACC ||0) + sk.ACC));
    let CRT  = Math.min(75,  Math.round(0.25*D + 0.5*L + w.CRT            + (eb.CRT ||0) + (bb.CRT ||0) + sk.CRT));
    let CDMG = Math.min(300, Math.round(150 + 0.5*D + 0.25*L + 0.5*W + (w.CDMG||0) + (eb.CDMG||0) + (bb.CDMG||0) + sk.CDMG));
    let PEN  = Math.min(75,  Math.round(0.5*D + 0.5*S + w.PEN  + (eb.PEN||0) + (bb.PEN||0) + sk.PEN));
    let BLK  = Math.min(75,  Math.round(0.5*C + sh.BLK         + (eb.BLK ||0) + (bb.BLK ||0) + sk.BLK));
    let BpWr = Math.min(85,  Math.round(0.5*S + sh.BLK * 1.5   + (eb.BpWr||0) + (bb.BpWr||0) + sk.BpWr));
    let EVA  = Math.min(95,  Math.round(2*A   + 0.5*L + ar.EVA  + (eb.EVA ||0) + (bb.EVA ||0) + sk.EVA));
    let SPD  = Math.round(0.75*A + 0.25*D + w.SPD + ar.SPD      + (eb.SPD ||0) + (bb.SPD ||0) + sk.SPD);

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
      // 🆕 D.6: 強制整數化（防止舊 0.5 delta 累積產生小數）
      player[key] = Math.max(1, Math.round(player[key] + delta));
      renderAttributes();
      renderDerivedStats();
    }
  }

  /**
   * 🆕 D.6: 強制將六維屬性整數化（讀檔後呼叫一次，清除舊 0.5 delta 留下的小數）。
   */
  function sanitizeAttrsToInt() {
    ['STR','DEX','CON','AGI','WIL','LUK'].forEach(k => {
      if (typeof player[k] === 'number') {
        player[k] = Math.max(1, Math.round(player[k]));
      }
    });
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
    const val = player.money || 0;
    const el = document.getElementById('stat-money');
    if (el) el.textContent = val + ' 枚';
    const csEl = document.getElementById('cs-money');
    if (csEl) csEl.textContent = val;
  }

  // ── 🆕 經驗值系統（D.6 Phase 3 實作） ──────────────
  /**
   * 升級至下一級所需的 EXP。
   * 公式（DESIGN.md D.6）：ceil(10 * 1.15^(level - 10))
   *   STR 10→11: 10
   *   STR 15→16: 20
   *   STR 20→21: 40
   *   STR 25→26: 81
   *   STR 30→31: 163
   * @param {number} level 當前屬性等級
   * @returns {number} 所需 EXP 點數
   */
  function expToNext(level) {
    if (level < 10) level = 10;   // 底線
    return Math.ceil(10 * Math.pow(1.15, level - 10));
  }

  /**
   * 累加屬性 EXP（純累加，不自動升級）。
   * 🆕 D.6 v2：改為 EXP 單一資源模型——訓練只累積 EXP，升級與購買技能都由玩家
   *            手動花 EXP。EXP 不會自動轉成屬性。
   * @param {string} attr STR/DEX/CON/AGI/WIL/LUK
   * @param {number} delta 要累加的 EXP
   */
  function modExp(attr, delta) {
    if (!player.exp || player.exp[attr] === undefined) return;
    player.exp[attr] = Math.max(0, player.exp[attr] + delta);
  }

  /**
   * 🆕 D.6 v2：花費屬性 EXP 升級屬性。
   * 成本 = expToNext(current_level)。
   * 若 EXP 不足則回傳 false。
   * @param {string} attr STR/DEX/CON/AGI/WIL/LUK
   * @returns {boolean} 是否升級成功
   */
  function spendExpOnAttr(attr) {
    if (!player.exp || player.exp[attr] === undefined) return false;
    const cur  = player[attr] || 10;
    const cost = expToNext(cur);
    if ((player.exp[attr] || 0) < cost) return false;
    player.exp[attr] -= cost;
    player[attr]      = cur + 1;
    return true;
  }

  // ══════════════════════════════════════════════════
  // 🆕 D.6 v2：技能購買系統
  // ══════════════════════════════════════════════════

  /** 玩家是否已習得此技能 */
  function hasSkill(skillId) {
    return Array.isArray(player.learnedSkills) && player.learnedSkills.includes(skillId);
  }

  /**
   * 計算技能的實際 EXP 成本（含屬性門檻差額）。
   * 若玩家屬性低於 unlockReq，將升級差額 EXP 疊加到對應屬性的成本中。
   * @param {string} skillId
   * @returns {object|null} { STR:100, CON:50, ... } 或 null（找不到技能）
   */
  function getSkillCost(skillId) {
    const s = (typeof Skills !== 'undefined') ? Skills[skillId] : null;
    if (!s) return null;
    const baseCosts = s.expCosts || {};
    const req       = s.unlockReq || {};
    const result    = {};
    // 先複製基礎成本
    Object.keys(baseCosts).forEach(k => { result[k] = baseCosts[k]; });
    // 為每個屬性門檻疊加差額
    Object.entries(req).forEach(([attr, minLvl]) => {
      if (attr === 'fame') return;  // 名聲不納入 EXP 補差
      const cur = player[attr] || 10;
      if (cur < minLvl) {
        let catchUp = 0;
        for (let l = cur; l < minLvl; l++) catchUp += expToNext(l);
        result[attr] = (result[attr] || 0) + catchUp;
      }
    });
    return result;
  }

  /**
   * 檢查玩家是否能習得技能（包含 EXP 足夠、名聲門檻、尚未習得）。
   * @returns {{ok: boolean, reason?: string}}
   */
  function canLearnSkill(skillId) {
    const s = (typeof Skills !== 'undefined') ? Skills[skillId] : null;
    if (!s) return { ok: false, reason: '技能不存在' };
    if (hasSkill(skillId)) return { ok: false, reason: '已習得' };
    const req = s.unlockReq || {};
    if (req.fame && player.fame < req.fame) {
      return { ok: false, reason: `需名聲 ${req.fame}（現 ${player.fame}）` };
    }
    const costs = getSkillCost(skillId);
    for (const [attr, cost] of Object.entries(costs)) {
      const have = player.exp?.[attr] || 0;
      if (have < cost) {
        return { ok: false, reason: `${attr} EXP 不足（需 ${cost}，有 ${have}）` };
      }
    }
    return { ok: true };
  }

  /**
   * 習得技能：扣除 EXP、若屬性低於門檻則同步升到門檻、加入 learnedSkills。
   * @returns {boolean}
   */
  function learnSkill(skillId) {
    const check = canLearnSkill(skillId);
    if (!check.ok) return false;
    const s = Skills[skillId];
    const req = s.unlockReq || {};
    const costs = getSkillCost(skillId);
    // 扣 EXP
    Object.entries(costs).forEach(([attr, cost]) => {
      player.exp[attr] = Math.max(0, (player.exp[attr] || 0) - cost);
    });
    // 補升屬性到門檻
    Object.entries(req).forEach(([attr, minLvl]) => {
      if (attr === 'fame') return;
      if ((player[attr] || 10) < minLvl) player[attr] = minLvl;
    });
    if (!Array.isArray(player.learnedSkills)) player.learnedSkills = [];
    player.learnedSkills.push(skillId);
    // 被動技能生效靠 calcDerived 動態計算，不用額外 state
    renderAttributes();
    renderDerivedStats();
    return true;
  }

  /**
   * 取得所有已習得被動技能的特定派生屬性加總。
   * 在 calcDerived 中被呼叫，將被動加成融入六維/派生。
   */
  function _getSkillBonus(key) {
    if (!Array.isArray(player.learnedSkills)) return 0;
    let sum = 0;
    player.learnedSkills.forEach(id => {
      const s = (typeof Skills !== 'undefined') ? Skills[id] : null;
      if (s && s.passiveBonus && typeof s.passiveBonus[key] === 'number') {
        sum += s.passiveBonus[key];
      }
    });
    return sum;
  }

  // ── 🆕 技能點（D.6 legacy） ───────────────────
  // 保留 modSp 做向下相容（舊事件/效果可能仍在用），但 UI 已不再顯示 SP。
  function modSp(delta) {
    player.sp = Math.max(0, (player.sp || 0) + delta);
    if (delta > 0) player.spEarned = (player.spEarned || 0) + delta;
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
    modMoney,      // 🆕 D.1.6
    modExp,        // 🆕 D.6
    modSp,         // 🆕 D.6
    expToNext,          // 🆕 D.6 升級曲線查詢
    spendExpOnAttr,     // 🆕 D.6 v2 花 EXP 升屬性
    sanitizeAttrsToInt, // 🆕 D.6 舊存檔小數整數化
    // 🆕 D.6 v2: 技能購買
    hasSkill,
    getSkillCost,
    canLearnSkill,
    learnSkill,
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
