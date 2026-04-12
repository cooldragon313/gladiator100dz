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
    affection: {
      master:    0,
      officer:   0,
      blacksmith:0,
      cook:      0,
    },

    // ── Inventory ──
    inventory: [],
    equippedWeapon:  null,
    equippedArmor:   null,
    equippedOffhand: null,   // 盾牌 ID 或單手武器 ID（雙持）

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

  function modAttr(key, delta) {
    if (player[key] !== undefined) {
      player[key] = Math.max(0, player[key] + delta);
      renderAttributes();
      renderDerivedStats();
    }
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
    renderAll,
    renderVitalBars,
    renderAttributes,
    renderDerivedStats,
    renderFame,
    modVital,
    modFame,
    modAttr,
    getTimeStr,
    advanceTime,
    getRoomTier,
    updateStaminaPenalty,
  };
})();
