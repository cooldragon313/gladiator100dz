/**
 * stats.js — Player statistics, calculations, and bar rendering
 */
const Stats = (() => {
  const player = {
    name: '無名',
    day:  1,
    time: 480, // minutes since midnight (8:00)

    // ── Vitals ──
    fame:       0,
    hp:         100, hpMax:      100,
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
      BLK:0, SPD:0, CRT:0, CDMG:0, EVA:0,
    },

    // ── Temporary buff bonuses ──
    buffBonus: {
      STR:0, DEX:0, CON:0, AGI:0, WIL:0, LUK:0,
      ATK:0, DEF:0, ACC:0, PEN:0,
      BLK:0, SPD:0, CRT:0, CDMG:0, EVA:0,
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
    equippedWeapon: null,
    equippedArmor:  null,
    equippedShield: null,
  };

  // Effective attr = base + equipment bonus + buff bonus
  function eff(attr) {
    return player[attr] + (player.eqBonus[attr] || 0) + (player.buffBonus[attr] || 0);
  }

  function calcDerived() {
    const S = eff('STR'), D = eff('DEX'), C = eff('CON'),
          A = eff('AGI'), W = eff('WIL'), L = eff('LUK');
    const eq = player.eqBonus, bf = player.buffBonus;

    return {
      ATK:  Math.round(1.5*S + 0.5*D               + eq.ATK  + bf.ATK),
      DEF:  Math.round(1.5*C + 0.5*S               + eq.DEF  + bf.DEF),
      ACC:  Math.round(60   + 0.5*D + 0.25*L       + eq.ACC  + bf.ACC),
      PEN:  Math.round(0.5*D + 0.5*S               + eq.PEN  + bf.PEN),
      BLK:  Math.round(0.5*S + 0.25*C              + eq.BLK  + bf.BLK),
      SPD:  Math.round(0.75*A + 0.25*D             + eq.SPD  + bf.SPD),
      CRT:  Math.round(0.5*D + L                   + eq.CRT  + bf.CRT),
      CDMG: Math.round(150  + 1*D + 0.5*L          + eq.CDMG + bf.CDMG),
      EVA:  Math.round(2*A  + 0.5*L                + eq.EVA  + bf.EVA),
    };
  }

  // ── Render helpers ────────────────────────────────────

  function renderVitalBars() {
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
      if (el) el.textContent = eff(key);
    });
  }

  function renderDerivedStats() {
    const d = calcDerived();
    const keys = ['ATK','DEF','ACC','PEN','BLK','SPD','CRT','CDMG','EVA'];
    const pctKeys = new Set(['ACC','CRT','CDMG']);
    keys.forEach(k => {
      const el = document.getElementById('drv-' + k);
      if (!el) return;
      el.textContent = pctKeys.has(k) ? d[k] + '%' : d[k];
    });
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

  function modVital(key, delta) {
    const maxKey = key + 'Max';
    player[key] = Math.max(0, Math.min(player[maxKey] || 100, player[key] + delta));
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
  };
})();
