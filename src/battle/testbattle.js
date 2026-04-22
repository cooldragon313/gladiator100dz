/**
 * testbattle.js — Combat simulation & balance test bed
 * 包含：武器/護甲/護符/天賦資料、三條儀表系統、Boss AI、公式計算
 */

// ═══════════════════════════════════════════════════════
// 1. CONFIG
// ═══════════════════════════════════════════════════════
const TBC = {
  GAUGE_MAX:   100,
  GAUGE_DRAIN: { rage:5, focus:3, fury:2 },
  GAUGE_GAIN: {
    rage:  { take_hit:15, take_crit:25, land_hit:10, low_hp_bonus:12 },
    focus: { land_hit:12, dodge:20, land_crit:22, no_hit_streak:10 },
    fury:  { block:28, absorb:18, defend_stance:25, take_hit:10, take_pierce:-8 },
    // fury: block=格擋完全吸收+28, absorb=部分吸收+18, defend_stance=防禦動作+25
    //       take_hit=任意被擊中+10（基礎保底增量）
  },
  SPECIALS: {
    rage:  { name:'血怒',    color:'#cc2200', turns:3,
              atkMult:2.0, defMult:0.5, evaMult:0.0, postStaminaCost:30 },
    focus: { name:'絕對瞬息',color:'#4499ff', turns:2,
              accBonus:999, crtBonus:40, spdMult:1.5 },
    fury:  { name:'盾牆反擊',color:'#55aa55', turns:1,
              reactive:true, defBonus:999, counterMult:1.5 },
  },
  HIT_FLOOR: 10,
  HIT_CAP:   92,
};

// ═══════════════════════════════════════════════════════
// 2-3. WEAPONS / ARMORS / SHIELDS — 2026-04-23 統一事實源
// ═══════════════════════════════════════════════════════
// 資料從 src/content/weapons.js 和 src/content/armors.js 讀取
// 修改武器/護甲/盾數值請改那兩個檔案，不要改本檔
//
// TB_WEAPONS 直接指向 Weapons 物件
// TB_ARMORS  = Armors 中 type !== 'shield' 的子集 + 'none'
// TB_SHIELDS = Armors 中 type === 'shield' 的子集 + 'none'
// ═══════════════════════════════════════════════════════
const TB_WEAPONS = (typeof Weapons !== 'undefined') ? Weapons : {
  fists: { name:'空手', type:'unarmed', route:'rage', twoHanded:false,
           ATK:4, ACC:5, CRT:3, CDMG:8, SPD:5, PEN:0, swingTime:1, hitParts:['身體'], special:'none' }
};

const TB_ARMORS  = (() => {
  const m = { none: { name:'無', DEF:0, SPD:0, EVA:0 } };
  if (typeof Armors !== 'undefined') {
    Object.entries(Armors).forEach(([id, a]) => {
      if (a.type !== 'shield') m[id] = a;
    });
  }
  return m;
})();

const TB_SHIELDS = (() => {
  const m = { none: { name:'無', BLK:0, DEF:0, SPD:0 } };
  if (typeof Armors !== 'undefined') {
    Object.entries(Armors).forEach(([id, a]) => {
      if (a.type === 'shield') m[id] = a;
    });
  }
  return m;
})();

// ═══════════════════════════════════════════════════════
// 4. AMULETS
// ═══════════════════════════════════════════════════════
const TB_AMULETS = {
  none:         { name:'無',           flat:{} },
  luckyCharm:   { name:'破爛幸運符',    flat:{ LUK:5,  DEF:-3  } },
  masterRing:   { name:'主人賞賜戒指',  flat:{ STR:3,  DEX:3,  CON:3, AGI:3, WIL:3, LUK:3 } },
  gloryBadge:   { name:'鬥技徽章',     flat:{ ATK:5                      } },
  strengthRune: { name:'力量符文',      flat:{ STR:8,  gaugeBonus:0.15   } },
  focusGem:     { name:'集中寶石',      flat:{ DEX:6,  focusBonus:0.20   } },
  ironWill:     { name:'鐵意志符',      flat:{ WIL:10, debuffResist:0.30 } },
  bloodAmulet:  { name:'血祭護符',      flat:{ ATK:8,  hpMax:-20         } },
};

// ═══════════════════════════════════════════════════════
// 5. TRAITS / TALENTS
// ═══════════════════════════════════════════════════════
const TB_TRAITS = {
  none:          { name:'無特性',      isCombat:false },
  geniusLearn:   { name:'學習天才',    isCombat:false, trainBonus:0.30 },
  ironBody:      { name:'不死之身',    isCombat:false, hpBonusPct:0.20 },
  // ── 戰鬥型特性 ──────────────────────────────────────────
  bloodlust:     { name:'逆境覺醒',    isCombat:true,
                   desc:'HP<30%時ATK+25%',
                   check: (u)=> u.hp/u._hpMax < 0.30,
                   apply:(s)=> s.ATK = Math.round(s.ATK * 1.25) },
  weaponInstinct:{ name:'武器本能',    isCombat:true,
                   desc:'ACC+8%, CRT+10%',
                   check:()=>true,
                   apply:(s)=>{ s.ACC+=8; s.CRT+=10; } },
  predator:      { name:'獵人直覺',    isCombat:true,
                   desc:'對手HP高於自己時EVA+15',
                   check:(u,opp)=> opp.hp > u.hp,
                   apply:(s)=> s.EVA+=15 },
  unbreakable:   { name:'不屈',        isCombat:true,
                   desc:'首次被擊倒後下一擊×2',
                   check:()=>false,
                   apply:(s)=> s },
  coldEye:       { name:'冷靜眼',      isCombat:true,
                   desc:'每回合ACC+5（同對手，上限+20）',
                   perTurn:5, perTurnMax:20 },

  // ── 壓制/恐懼型特性 ────────────────────────────────────
  fierceface:    { name:'兇猛臉',    isCombat:true,
                   desc:'開場威嚇力+20%（傷疤與殺氣讓人膽怯）',
                   intimidation: 0.20 },
  killAura:      { name:'殺戮美學', isCombat:true,
                   desc:'首次命中對手後本場威嚇力追加+10%',
                   killIntimBonus: 0.10 },
  bloodLegend:   { name:'血腥傳說', isCombat:true,
                   desc:'自身名聲壓制效果×2',
                   famePressureMult: 2.0 },
  numbWill:      { name:'麻木意志', isCombat:true,
                   desc:'WIL抗壓上限從75%提升至90%，心如鐵石',
                   willCapBonus: 0.15 },
  lastStand:     { name:'背水一戰', isCombat:true,
                   desc:'HP<30%時免疫所有恐懼，並對敵方反轉施加+15%壓制',
                   lastStand: true },
  voidEyes:      { name:'虛空眼神', isCombat:true,
                   desc:'無視對手特性/被動威嚇，只受名聲壓制影響',
                   voidEyes: true },
};

// ═══════════════════════════════════════════════════════
// 6. ENEMIES / BOSSES
// ═══════════════════════════════════════════════════════
const TB_ENEMIES = {
  slaveRookie: {
    name:'新進奴隸', title:'雜魚',
    STR:8,  DEX:6,  CON:8,  AGI:6,  WIL:5,  LUK:5,  hpBase:40,
    weaponId:'dagger', armorId:'rags', shieldId:'none',
    traitId:'none',
    ai:'basic', passive:null, specialCD:99,
    fame:0, intimidation:0,
    desc:'毫無戰鬥經驗，靠本能揮舞武器。',
  },
  // 🆕 Day 5 三人考驗：索爾（農夫體格，比你稍強但不壓倒，有緊張感但能贏）
  trialSol: {
    name:'索爾', title:'沉默的大個子',
    STR:11, DEX:7,  CON:13, AGI:6,  WIL:10, LUK:5,  hpBase:50,
    weaponId:'fists', armorId:'rags', shieldId:'none',
    traitId:'none',
    ai:'basic', passive:null, specialCD:99,
    fame:0, intimidation:0,
    desc:'農夫出身的厚實身體。他不會閃，但每一拳都帶著不想死的重量。',
  },
  // 🆕 Day 5 英雄路線（C 選項）：更強的替代對手
  trialVeteran: {
    name:'無名老兵', title:'劊子手',
    STR:18, DEX:14, CON:18, AGI:12, WIL:14, LUK:10, hpBase:75,
    weaponId:'shortSword', armorId:'leatherArmor', shieldId:'none',
    traitId:'none',
    ai:'normal', passive:null, specialCD:99,
    fame:15, intimidation:0.03,
    desc:'身上的疤比你的歲數還多。他被叫來專門對付「有膽識」的新人。',
  },
  // 🆕 Day 12 切磋用：背景角鬥士（比你稍弱，練習用不會死）
  sparringPartner: {
    name:'訓練場老手', title:'切磋對手',
    STR:10, DEX:10, CON:10, AGI:10, WIL:8, LUK:8, hpBase:45,
    weaponId:'shortSword', armorId:'rags', shieldId:'none',
    traitId:'none',
    ai:'basic', passive:null, specialCD:99,
    fame:3, intimidation:0,
    desc:'比你早來幾個月的傢伙。不算強，但有經驗。',
  },

  // 🆕 Day 50 大型競技用：中階對手（gladiatorB 改名）
  gladiatorB: {
    name:'黑面鬥士', title:'中階角鬥士',
    STR:16, DEX:14, CON:16, AGI:12, WIL:12, LUK:10, hpBase:60,
    weaponId:'shortSword', armorId:'leatherArmor', shieldId:'none',
    traitId:'none',
    ai:'normal', passive:null, specialCD:99,
    fame:20, intimidation:0.02,
    desc:'臉上總是塗著黑色的顏料。他說那是戰友的血——你不確定他是認真的。',
  },

  arenaVet: {
    name:'競技場老手', title:'資深鬥士',
    STR:22, DEX:18, CON:20, AGI:16, WIL:15, LUK:12, hpBase:70,
    weaponId:'shortSword', armorId:'leatherArmor', shieldId:'woodShield',
    traitId:'none',
    ai:'normal', passive:null, specialCD:99,
    fame:35, intimidation:0.04,
    desc:'身上的傷疤多過臉上的皺紋。懂得把握時機，不會輕易露出破綻。',
  },

  // ═══════════════════════════════════════════════════════
  // 🆕 D.28：固定敵人（來自隔壁訓練所 / 地下勢力 / 野外）
  //   詳見 docs/enemies/
  // ═══════════════════════════════════════════════════════

  // 莫拉斯的鐵臂 — 隔壁訓練所招牌（Day 35 賭局對手）
  morras_ironarm: {
    name:'烏勒克', title:'「鐵臂」',
    STR:14, DEX:8,  CON:14, AGI:7,  WIL:11, LUK:5, hpBase:55,
    weaponId:'hammer', armorId:'leatherArmor', shieldId:'none',
    traitId:'none',
    ai:'normal', passive:null, specialCD:99,
    fame:22, intimidation:0.03,
    desc:'莫拉斯大人家的招牌鬥士。跨場二十二勝四敗。左臂有一條從手腕到肘窩的舊疤——所以叫「鐵臂」。',
  },

  // 海龍幫的影子 — 速度型刺客（Day 55-62 賭局）
  dragonbay_shadow: {
    name:'???', title:'「影子」',
    STR:9,  DEX:16, CON:10, AGI:15, WIL:12, LUK:8, hpBase:38,
    weaponId:'dagger', armorId:'rags', shieldId:'none',
    traitId:'none',
    ai:'normal', passive:null, specialCD:99,
    fame:0, intimidation:0.08,
    desc:'全身黑、面罩只露眼睛。海龍幫的代理鬥士——不是正規角鬥士。打起來的風格完全不同。',
  },

  // 毒牙 — 強盜首領（Day 55-70 外出押運）
  bandit_fang: {
    name:'葛雷德', title:'「毒牙」',
    STR:13, DEX:10, CON:12, AGI:11, WIL:8,  LUK:6, hpBase:48,
    weaponId:'heavyAxe', armorId:'leatherArmor', shieldId:'none',
    traitId:'none',
    ai:'normal', passive:null, specialCD:99,
    fame:0, intimidation:0.05,
    desc:'流民出身的強盜頭子。嘴巴不停，一邊打一邊罵。殺過至少十五個商隊護衛。',
  },

  // 夜鷹 — 夜間刺客（Day 65+ 夜間事件）
  assassin_nighthawk: {
    name:'???', title:'「夜鷹」',
    STR:11, DEX:15, CON:9,  AGI:16, WIL:13, LUK:7, hpBase:36,
    weaponId:'shortSword', armorId:'rags', shieldId:'none',
    traitId:'none',
    ai:'normal', passive:null, specialCD:99,
    fame:0, intimidation:0.06,
    desc:'全身黑、戴黑色指套。血環公會（？）的刺客。首擊極猛——如果你沒察覺他靠近。',
  },

  // 斑虎 — 野獸（Day 70+ 狩獵事件）
  tiger_striped: {
    name:'斑虎', title:'山林大虎',
    STR:18, DEX:12, CON:16, AGI:14, WIL:5,  LUK:8, hpBase:75,
    weaponId:'fists', armorId:'leatherArmor', shieldId:'none',   // fists 代表爪；暫用 leather 表獸皮
    traitId:'none',
    ai:'normal', passive:null, specialCD:99,
    fame:0, intimidation:0.10,
    desc:'成年公虎。左眼上有老傷疤，暗示牠跟人打過且活下來。無法溝通、無法逃。戰鬥節奏完全不同。',
  },

  // ── 固定三人眾 ────────────────────────────────────────
  gruen: {
    name:'葛倫', title:'鐵面・均衡男',
    STR:32, DEX:30, CON:36, AGI:30, WIL:35, LUK:28, hpBase:100,
    weaponId:'longSword', armorId:'chainmail', shieldId:'ironShield',
    traitId:'none',
    ai:'boss_gruen', passive:'regen5', specialCD:3,
    fame:85, intimidation:0.06,
    passiveDesc:'每回合回復 3 HP（上限50%最大值）',
    specialName:'反制姿態',
    specialDesc:'每3回合進入反制姿態。玩家若在此回合攻擊，傷害減半且葛倫直接反擊。',
    weakPoint:'EVA 最低——速度型連擊積累傷害最有效。',
    desc:'五年不敗的老將。攻守均衡讓任何人都找不到破口，被動回血讓消耗戰也很艱難。',
  },
  voda: {
    name:'沃達', title:'碎骨・蠻力怪',
    STR:55, DEX:34, CON:50, AGI:30, WIL:30, LUK:30, hpBase:120,
    weaponId:'warHammer', armorId:'ironPlate', shieldId:'none',
    traitId:'none',
    ai:'boss_voda', passive:'armorPierce40', specialCD:4,
    fame:90, intimidation:0.14,
    passiveDesc:'所有攻擊無視對手 40% DEF',
    specialName:'山崩',
    specialDesc:'每4回合蓄力一回合（跳過攻擊），下一擊傷害×2.5，觸發重傷判定。',
    weakPoint:'AGI/SPD 極低——集中力路線可在蓄力時搶先打斷山崩。',
    desc:'幾乎沒有智識，完全被訓練成殺人機器。被他正面打中哪怕一擊，你就知道什麼叫「骨折」。',
  },
  seira: {
    name:'賽拉', title:'幻影・快手刺客',
    STR:15, DEX:45, CON:14, AGI:44, WIL:35, LUK:38, hpBase:55,
    weaponId:'dagger', armorId:'leatherArmor', shieldId:'none',
    traitId:'none',
    ai:'boss_seira', passive:'firstCrit', specialCD:3,
    fame:75, intimidation:0.10,
    passiveDesc:'本場戰鬥第一擊必定暴擊',
    specialName:'三連刺',
    specialDesc:'每3回合發動三次快速攻擊，各自獨立計算命中與暴擊。',
    weakPoint:'HP 極低——怒氣盾牌路線能吸收連擊，一旦盾牆反擊壓制即可。',
    desc:'你不會看見她怎麼移動的。只有感受到劇痛的那一刻，才知道她已經在你背後了。',
  },
};

// ═══════════════════════════════════════════════════════
// 7. DERIVED STAT CALC
// ═══════════════════════════════════════════════════════
function TB_calcDerived(unit) {
  const S=unit.STR, D=unit.DEX, C=unit.CON,
        A=unit.AGI, W=unit.WIL, L=unit.LUK;
  const w  = TB_WEAPONS[unit.weaponId]  || TB_WEAPONS.fists;
  const ar = TB_ARMORS[unit.armorId]    || TB_ARMORS.rags;
  const am = TB_AMULETS[unit.amuletId]  || TB_AMULETS.none;
  const af = am.flat || {};

  // ── 副手判定 ──────────────────────────────────────────
  const offId = unit.offhandId || unit.shieldId || 'none';
  const isOffhandShield = (offId !== 'none') && !!TB_SHIELDS[offId];
  const isOffhandWeapon = (offId !== 'none') && !isOffhandShield && !!TB_WEAPONS[offId] && !TB_WEAPONS[offId].twoHanded;
  const isDualWield     = isOffhandWeapon;
  const sh = isOffhandShield ? TB_SHIELDS[offId] : TB_SHIELDS.none;
  const offW = isDualWield   ? TB_WEAPONS[offId] : null;

  // Apply amulet flat stat bonuses first
  const aS = S+(af.STR||0), aD = D+(af.DEX||0), aC = C+(af.CON||0),
        aA = A+(af.AGI||0), aW = W+(af.WIL||0), aL = L+(af.LUK||0);

  let ATK  = Math.round(1.5*aS + 0.5*aD + w.ATK  + (af.ATK||0));
  let DEF  = Math.round(1.5*aC + 0.5*aS + ar.DEF + sh.DEF);
  let ACC  = Math.min(100, Math.round(60 + 0.5*aD + 0.25*aL + (w.ACC||0) + (af.ACC||0)));
  let CRT  = Math.min(75,  Math.round(0.25*aD + 0.5*aL + w.CRT + (af.CRT||0)));
  let CDMG = Math.min(300, Math.round(150 + 0.5*aD + 0.25*aL + 0.5*aW + (w.CDMG||0) + (af.CDMG||0)));
  let PEN  = Math.min(75,  Math.round(0.5*aD + 0.5*aS + w.PEN + (af.PEN||0)));
  let BLK  = Math.min(75,  Math.round(0.5*aC + sh.BLK + (af.BLK||0)));          // 格擋觸發率%
  let BpWr = Math.min(85,  Math.round(0.5*aS + sh.BLK * 1.5 + (af.BpWr||0)));  // 格擋減傷率%
  let EVA  = Math.min(95,  Math.round(2*aA + 0.5*aL + ar.EVA + (af.EVA||0)));
  let SPD  = Math.round(0.75*aA + 0.25*aD + w.SPD + ar.SPD + (af.SPD||0));

  // ── 雙持修正 ──────────────────────────────────────────
  if (isDualWield && offW) {
    ATK += Math.round(offW.ATK * 0.5);   // 副手 ATK × 50%
    ACC  = Math.max(0, ACC - 5);          // 精度分散
    SPD -= 3;                              // 協調困難
    BLK  = 0;                              // 雙持無法格擋
    BpWr = 0;
  }

  // HP = 固定底數 + CON×2 + 護符加成
  let hpMax = unit.hpBase + Math.round(2 * aC);
  if (af.hpMax) hpMax += af.hpMax;
  // 特性：不死之身 +20% HP
  if (unit.traitId === 'ironBody') hpMax = Math.round(hpMax * 1.20);

  // Trait weapon instinct
  if (unit.traitId === 'weaponInstinct') { ACC = Math.min(100, ACC+8); CRT = Math.min(75, CRT+10); }

  // ── 路線判定：副手覆蓋武器原始路線 ────────────────────
  let route;
  if (isOffhandShield)     route = 'fury';    // 有盾 → 盾牆流
  else if (isDualWield)    route = 'rage';    // 雙持 → 狂暴流
  else                     route = w.route;   // 其他 → 武器原始路線

  // WIL提供儀表增益倍率（每10點WIL +3%，上限+30%）
  const gaugeBonus = Math.min(0.30, Math.floor(aW / 10) * 0.03);

  // SPD攻速加速率：每點SPD +0.5%，上限30%（武器揮速最多減30%）
  const spdBonus = Math.min(0.30, SPD * 0.005);

  return { ATK, DEF, ACC, CRT, CDMG, PEN, BLK, BpWr, EVA, SPD, hpMax, route, WIL:aW, gaugeBonus, spdBonus };
}

// ═══════════════════════════════════════════════════════
// 8. UNIT BUILDER
// ═══════════════════════════════════════════════════════
function TB_buildUnit(cfg, isPlayer=false) {
  const def = TB_ENEMIES[cfg.enemyId] || {};
  const u = {
    id:         cfg.enemyId || 'player',
    name:       cfg.name     || def.name  || '玩家',
    title:      cfg.title    || def.title || '',
    isPlayer,
    STR: cfg.STR ?? def.STR ?? 10,
    DEX: cfg.DEX ?? def.DEX ?? 10,
    CON: cfg.CON ?? def.CON ?? 10,
    AGI: cfg.AGI ?? def.AGI ?? 10,
    WIL: cfg.WIL ?? def.WIL ?? 10,
    LUK: cfg.LUK ?? def.LUK ?? 10,
    hpBase:   cfg.hpBase   || def.hpBase   || 100,
    weaponId:  cfg.weaponId  || def.weaponId  || 'fists',
    armorId:   cfg.armorId   || def.armorId   || 'rags',
    shieldId:  cfg.shieldId  || def.shieldId  || 'none',   // 向下相容（敵人仍用 shieldId）
    offhandId: cfg.offhandId || cfg.shieldId || def.shieldId || 'none',
    amuletId: cfg.amuletId || 'none',
    traitId:  cfg.traitId  || def.traitId  || 'none',
    passive:  def.passive  || null,
    specialCD: def.specialCD || 99,
    ai:        def.ai || (isPlayer ? 'player' : 'basic'),
    // 名聲與壓制
    fame:         cfg.fame         ?? def.fame         ?? 0,
    intimidation: cfg.intimidation ?? def.intimidation ?? 0,
    gauge:        0,
    gaugeRoute:   'fury', // set after derive
    gaugeActive:  null,   // 'rage'|'focus'|'fury' when special is on
    gaugeActiveLeft: 0,
    // Boss internal state
    _bossCD:      0,
    _charging:    false,
    _counterStance: false,
    _firstCritUsed: false,
    _coldEyeAcc:  0,
    _unbreakableUsed: false,
    // 壓制系統狀態
    _pressurePenalty:     0,
    _pressureFrom:        '',
    _killIntimBonus:      0,   // killAura 首擊後追加威嚇
    _lastStandTriggered:  false,
    injuries: [],
    statusEffects: [],
  };
  u.derived   = TB_calcDerived(u);
  u.hp        = u.derived.hpMax;
  u._hpMax    = u.derived.hpMax;
  u.gaugeRoute= u.derived.route;
  return u;
}

// ═══════════════════════════════════════════════════════
// 9. HIT / DAMAGE RESOLUTION
// ═══════════════════════════════════════════════════════
const BODY_PARTS_BY_TYPE = {
  unarmed:  ['軀幹','頭部','軀幹'],
  blade1h:  ['軀幹','手臂','腿部'],
  dual:     ['手臂','頭部','手臂','腿部'],
  polearm:  ['軀幹','腿部','軀幹'],
  heavy2h:  ['軀幹','手臂','軀幹','頭部'],
};
function TB_rollBodyPart(weaponId) {
  const w = TB_WEAPONS[weaponId] || TB_WEAPONS.fists;
  const pool = BODY_PARTS_BY_TYPE[w.type] || BODY_PARTS_BY_TYPE.blade1h;
  return pool[Math.floor(Math.random() * pool.length)];
}

function TB_rnd(min, max) { return Math.random()*(max-min)+min; }
function TB_clamp(v,mn,mx){ return Math.max(mn, Math.min(mx, v)); }

/**
 * Resolve one attack from attacker → defender.
 * Returns result object with narrative + effects.
 */
function TB_attack(atk, def, state, opts={}) {
  const aS = { ...atk.derived };
  const dS = { ...def.derived };

  const result = {
    type: 'attack', hit:false, crit:false, blocked:false,
    damage:0, counterDamage:0,
    gaugeGainAtk:0, gaugeGainDef:0,
    injuredPart:null, injuryLevel:null,
    log: '',
  };

  // ── Trait: 逆境覺醒 ──
  if (atk.traitId === 'bloodlust' && atk.hp / atk._hpMax < 0.30) {
    aS.ATK = Math.round(aS.ATK * 1.25);
  }
  // Trait: 獵人直覺
  if (def.traitId === 'predator' && def.hp > atk.hp) {
    dS.EVA += 15;
  }
  // Trait: 冷靜眼 (per-turn ACC bonus vs same opponent)
  if (atk.traitId === 'coldEye') {
    atk._coldEyeAcc = Math.min(atk._coldEyeAcc + 5, 20);
    aS.ACC += atk._coldEyeAcc;
  }

  // ── Active special modifiers ──
  if (atk.gaugeActive === 'rage') {
    aS.ATK = Math.round(aS.ATK * TBC.SPECIALS.rage.atkMult);
  }
  if (atk.gaugeActive === 'focus') {
    aS.ACC += 999; // guaranteed hit
    aS.CRT += TBC.SPECIALS.focus.crtBonus;
  }
  if (def.gaugeActive === 'rage') {
    dS.DEF  = Math.round(dS.DEF  * TBC.SPECIALS.rage.defMult);
    dS.EVA  = 0;
  }

  // ── 葛倫 counter stance ──
  if (def._counterStance && !opts.ignoreCounter) {
    def._counterStance = false;
    result.hit = true;
    result.damage = 0;
    const counter = Math.round(aS.ATK * 0.9);
    result.counterDamage = counter;
    result.log = `【反制】${def.name}輕鬆化解攻擊，以相同力道反擊！反擊 ${counter} 傷害！`;
    result.gaugeGainDef += 15;
    return result;
  }

  // ── 盾牆反擊 (reactive) ──
  if (def.gaugeActive === 'fury' && !opts.isCounter) {
    const rawForCounter = Math.round(aS.ATK * TB_rnd(0.9,1.1));
    result.hit = true; result.blocked = true; result.damage = 0;
    result.counterDamage = Math.round(rawForCounter * TBC.SPECIALS.fury.counterMult);
    result.log = `【盾牆反擊】${def.name}以盾硬接，瞬間反擊 ${result.counterDamage} 傷害！`;
    def.gaugeActive = null; def.gaugeActiveLeft = 0; def.gauge = 0;
    return result;
  }

  // ── Hit check ──
  const evaReduction = Math.max(0, (dS.EVA - 20)) * 0.7;
  let hitChance = TB_clamp(aS.ACC - evaReduction, TBC.HIT_FLOOR, TBC.HIT_CAP);
  const hitRoll = Math.random() * 100;

  if (hitRoll > hitChance) {
    result.hit = false;
    result.log = TB_missText(atk.name, def.name);
    if (def.gaugeRoute === 'focus') TB_gainGauge(def, TBC.GAUGE_GAIN.focus.dodge, result, 'def');
    return result;
  }
  result.hit = true;

  // ── Crit check ──
  if (atk.passive === 'firstCrit' && !atk._firstCritUsed) {
    result.crit = true;
    atk._firstCritUsed = true;
  } else {
    result.crit = Math.random() * 100 < aS.CRT;
  }

  // ── Raw damage ──
  let raw = aS.ATK * TB_rnd(0.88, 1.12);

  // Pen
  let penPct = TB_clamp(aS.PEN / 150, 0, 0.65);
  if (atk.passive === 'armorPierce40') penPct = TB_clamp(penPct + 0.40, 0, 0.85);

  let effDef = dS.DEF * (1 - penPct);
  let net = Math.max(1, raw - effDef);

  if (result.crit) net = Math.round(net * (aS.CDMG / 100));

  // ── Block ──
  if (dS.BLK > 0) {
    const blockEff = result.crit ? dS.BLK * 0.3 : dS.BLK * 0.7;
    if (net <= dS.BLK) {
      result.blocked = true;
      net = Math.max(0, net - blockEff);
      if (def.gaugeRoute === 'fury') TB_gainGauge(def, TBC.GAUGE_GAIN.fury.block, result, 'def');
    } else {
      net -= blockEff * 0.5;
      if (def.gaugeRoute === 'fury') TB_gainGauge(def, TBC.GAUGE_GAIN.fury.absorb, result, 'def');
    }
  }

  // 山崩 special hit (2.5x)
  if (opts.mountainCrash) net = Math.round(net * 2.5);

  // 三連刺 (each hit is independent, multiplier from caller)
  if (opts.tripleMult) net = Math.round(net * opts.tripleMult);

  result.damage = Math.round(net);

  // ── Injury check ──
  if (result.damage >= 40 || (result.crit && result.damage >= 20) || opts.mountainCrash) {
    result.injuredPart  = TB_rollBodyPart(atk.weaponId);
    result.injuryLevel  = result.damage >= 60 ? 'heavy' : 'medium';
  } else if (result.damage >= 20) {
    if (Math.random() < 0.25) {
      result.injuredPart = TB_rollBodyPart(atk.weaponId);
      result.injuryLevel = 'light';
    }
  }

  // ── Narrative ──
  result.log = TB_hitText(atk.name, def.name, result);

  // ── killAura：首次命中後追加威嚇力（只觸發一次）
  if (TB_TRAITS[atk.traitId]?.killIntimBonus && !atk._killIntimActivated) {
    atk._killIntimActivated = true;
    atk._killIntimBonus = (atk._killIntimBonus || 0) + TB_TRAITS[atk.traitId].killIntimBonus;
    // 重新計算並追加壓制（外部battle log由HTML層顯示）
  }

  // ── Gauge gains from landing hit ──
  if (atk.gaugeRoute === 'rage')  TB_gainGauge(atk, TBC.GAUGE_GAIN.rage.land_hit, result, 'atk');
  if (atk.gaugeRoute === 'focus') TB_gainGauge(atk,
    result.crit ? TBC.GAUGE_GAIN.focus.land_crit : TBC.GAUGE_GAIN.focus.land_hit, result, 'atk');
  if (def.gaugeRoute === 'rage')  TB_gainGauge(def,
    result.crit ? TBC.GAUGE_GAIN.rage.take_crit : TBC.GAUGE_GAIN.rage.take_hit, result, 'def');
  if (def.gaugeRoute === 'focus') TB_gainGauge(def, -10, result, 'def'); // 被打打斷集中，扣減較少
  if (def.gaugeRoute === 'fury')
    TB_gainGauge(def, TBC.GAUGE_GAIN.fury.take_hit, result, 'def'); // 任意被命中都+10

  return result;
}

function TB_gainGauge(unit, delta, result, side) {
  const old = unit.gauge;
  // WIL提升正向儀表增益（懲罰性扣減不受影響）
  const effective = delta > 0
    ? Math.round(delta * (1 + (unit.derived?.gaugeBonus || 0)))
    : delta;
  unit.gauge = TB_clamp(unit.gauge + effective, 0, TBC.GAUGE_MAX);
  const actual = unit.gauge - old;
  if (side === 'atk') result.gaugeGainAtk += actual;
  else result.gaugeGainDef += actual;
}

// ── Defend action (player chose defend) ──
function TB_defend(unit) {
  if (unit.gaugeRoute === 'fury') {
    TB_gainGauge(unit, TBC.GAUGE_GAIN.fury.defend_stance, {}, 'atk');
  }
  return { log: `${unit.name} 進入防禦姿態。`, gaugeGainAtk: TBC.GAUGE_GAIN.fury.defend_stance };
}

// ═══════════════════════════════════════════════════════
// 10. GAUGE DRAIN (end of turn)
// ═══════════════════════════════════════════════════════
function TB_endTurnGauge(unit) {
  if (unit.gaugeActive) {
    unit.gaugeActiveLeft--;
    if (unit.gaugeActiveLeft <= 0) {
      unit.gaugeActive = null;
      unit.gaugeActiveLeft = 0;
      return `（${TBC.SPECIALS[unit.gaugeRoute]?.name || '特殊狀態'} 結束）`;
    }
    return null;
  }
  // 儀表滿時不扣耗——等待玩家主動釋放
  if (unit.gauge >= TBC.GAUGE_MAX) return null;
  const drain = TBC.GAUGE_DRAIN[unit.gaugeRoute] || 4;
  TB_gainGauge(unit, -drain, {}, 'atk');
  return null;
}

// ── Release special ──
function TB_releaseSpecial(unit) {
  if (unit.gauge < TBC.GAUGE_MAX) return false;
  const sp = TBC.SPECIALS[unit.gaugeRoute];
  if (!sp) return false;
  unit.gauge = 0;
  unit.gaugeActive = unit.gaugeRoute;
  unit.gaugeActiveLeft = sp.turns;
  return true;
}

// ═══════════════════════════════════════════════════════
// 11. PRESSURE / FEAR SYSTEM  壓制與恐懼
// ═══════════════════════════════════════════════════════

/**
 * 計算 atk 對 def 施加的壓制懲罰百分比。
 * 回傳 { penalty, lastStandActive, famePct, wilAmp, traitIntim, totalIntim, wilResist }
 */
function TB_calcPressure(atk, def) {
  const atkFame   = atk.fame  || 0;
  const atkWIL    = atk.derived?.WIL  ?? atk.WIL  ?? 10;
  const defWIL    = def.derived?.WIL  ?? def.WIL  ?? 10;
  const atkTrait  = TB_TRAITS[atk.traitId] || {};
  const defTrait  = TB_TRAITS[def.traitId] || {};

  // ── 名聲壓制：每20點名聲 → -4%（血腥傳說特性可翻倍）
  let famePct = Math.floor(atkFame / 20) * 0.04;
  if (atkTrait.famePressureMult) famePct *= atkTrait.famePressureMult;

  // ── WIL放大：攻方每10點WIL → +1.2%威嚇
  const wilAmp = +(atkWIL * 0.0012).toFixed(4);

  // ── 特性/被動威嚇（虛空眼神可完全無視）
  let traitIntim = (atk.intimidation || 0) + (atkTrait.intimidation || 0)
                 + (atkTrait.killIntimBonus ? (atk._killIntimBonus || 0) : 0);
  if (defTrait.voidEyes) traitIntim = 0;

  const totalIntim = famePct + wilAmp + traitIntim;

  // ── 防方WIL抗壓（每點WIL 0.75%，麻木意志提升上限到90%）
  const defWilCap  = 0.75 + (defTrait.willCapBonus || 0);
  const wilResist  = Math.min(defWilCap, defWIL * 0.0075);

  // ── 背水一戰：HP<30%時完全免疫，轉為反向施壓
  const lastStandActive = !!(defTrait.lastStand && def.hp < def._hpMax * 0.30);
  if (lastStandActive) {
    return { penalty:0, lastStandActive:true, famePct, wilAmp, traitIntim, totalIntim, wilResist };
  }

  const penalty = +Math.max(0, Math.min(0.60, totalIntim * (1 - wilResist))).toFixed(4);
  return { penalty, lastStandActive:false, famePct, wilAmp, traitIntim, totalIntim, wilResist };
}

/**
 * 將壓制懲罰套用到 unit 的衍生數值（直接修改）。
 */
function TB_applyPressure(unit, penalty, fromName) {
  if (penalty <= 0) { unit._pressurePenalty = 0; return; }
  const d = unit.derived;
  const m = 1 - penalty;
  d.ATK  = Math.round(d.ATK  * m);
  d.DEF  = Math.round(d.DEF  * m);
  d.ACC  = Math.round(d.ACC  * m);
  d.EVA  = Math.round(d.EVA  * m);
  d.CRT  = Math.round(d.CRT  * m);
  d.CDMG = Math.round(d.CDMG * m);
  d.BLK  = Math.round(d.BLK  * m);
  d.BpWr = Math.round(d.BpWr * m);
  d.SPD  = Math.round(d.SPD  * m);
  unit._pressurePenalty = penalty;
  unit._pressureFrom    = fromName || '?';
}

/**
 * 背水一戰觸發：解除恐懼壓制，並對 opponent 施加15%反向壓制。
 * 需在 HP 首次跌破30%時由外部呼叫。
 * 回傳 true 表示本次觸發。
 */
function TB_triggerLastStand(unit, opponent) {
  if (unit._lastStandTriggered) return false;
  if (!TB_TRAITS[unit.traitId]?.lastStand) return false;
  if (unit.hp >= unit._hpMax * 0.30) return false;

  unit._lastStandTriggered = true;

  // 解除現有壓制
  if (unit._pressurePenalty > 0) {
    const restore = 1 / (1 - unit._pressurePenalty);
    const d = unit.derived;
    d.ATK  = Math.round(d.ATK  * restore);
    d.DEF  = Math.round(d.DEF  * restore);
    d.ACC  = Math.round(d.ACC  * restore);
    d.EVA  = Math.round(d.EVA  * restore);
    d.CRT  = Math.round(d.CRT  * restore);
    d.CDMG = Math.round(d.CDMG * restore);
    d.BLK  = Math.round(d.BLK  * restore);
    d.BpWr = Math.round(d.BpWr * restore);
    d.SPD  = Math.round(d.SPD  * restore);
    unit._pressurePenalty = 0;
  }

  // 對對手施加15%反向壓制（累加）
  const addPenalty = Math.min(0.60, (opponent._pressurePenalty || 0) + 0.15);
  TB_applyPressure(opponent, addPenalty, unit.name + '（背水一戰）');
  return true;
}

// ═══════════════════════════════════════════════════════
// 12. BOSS AI
// ═══════════════════════════════════════════════════════
/**
 * Returns { action, log, opts }
 * action: 'attack'|'defend'|'special_release'|'counter_stance'|'charge'|'mountain_crash'|'triple_stab'
 */
function TB_bossDecide(boss, player, state) {
  const hpPct = boss.hp / boss._hpMax;

  // Release special if gauge full
  if (boss.gauge >= TBC.GAUGE_MAX && boss.gaugeActive === null) {
    if (TB_releaseSpecial(boss)) {
      const sp = TBC.SPECIALS[boss.gaugeRoute];
      return { action: 'special_release', log: `【${boss.name}】【${sp.name}】`, opts:{} };
    }
  }

  // Mountain crash follow-up
  if (boss._charging) {
    boss._charging = false;
    return { action: 'mountain_crash',
      log: `【山崩】${boss.name} 全力砸下——地面震動！`, opts: { mountainCrash:true } };
  }

  boss._bossCD = (boss._bossCD||0) + 1;

  if (boss.ai === 'boss_gruen') {
    if (boss._bossCD >= boss.specialCD) {
      boss._bossCD = 0;
      boss._counterStance = true;
      return { action: 'counter_stance',
        log: `${boss.name} 重心下沉，進入反制姿態……`, opts:{} };
    }
    // Regen
    const regen = Math.min(5, Math.round(boss._hpMax * 0.5) - boss.hp);
    if (regen > 0) boss.hp = Math.min(boss._hpMax, boss.hp + regen);
    return { action: 'attack', log: '', opts:{} };
  }

  if (boss.ai === 'boss_voda') {
    if (boss._bossCD >= boss.specialCD) {
      boss._bossCD = 0;
      boss._charging = true;
      return { action: 'charge',
        log: `${boss.name} 雙腳踩穩，戰錘緩緩舉起……整個競技場都安靜了。`, opts:{} };
    }
    return { action: 'attack', log: '', opts:{} };
  }

  if (boss.ai === 'boss_seira') {
    if (boss._bossCD >= boss.specialCD) {
      boss._bossCD = 0;
      return { action: 'triple_stab',
        log: `【三連刺】${boss.name} 身影一閃——`, opts:{} };
    }
    // Dodge tendency: if HP high, try focus
    return { action: 'attack', log: '', opts:{} };
  }

  if (boss.ai === 'normal') {
    if (hpPct < 0.3 && Math.random() < 0.4)
      return { action: 'defend', log:`${boss.name}後退一步，進入防禦。`, opts:{} };
    return { action: 'attack', log:'', opts:{} };
  }

  return { action: 'attack', log:'', opts:{} };
}

// ═══════════════════════════════════════════════════════
// 12. NARRATIVE TEXT POOLS
// ═══════════════════════════════════════════════════════
const _MISS = [
  (a,d)=>`${a}的攻擊偏離，${d}側身躲開了。`,
  (a,d)=>`${d}向後退步，${a}劈空。`,
  (a,d)=>`${a}出手，${d}以最小幅度閃開那一擊。`,
  (a,d)=>`揮空了——${d}根本不在那個位置。`,
  (a,d)=>`${a}的攻勢被${d}讀穿，輕鬆躲開。`,
];
const _HIT = [
  (a,d,v)=>`${a}的攻擊命中${d}，造成 ${v} 傷害。`,
  (a,d,v)=>`${a}劃破${d}的防線，${v} 傷害！`,
  (a,d,v)=>`${d}沒能完全躲開，受到 ${v} 傷害。`,
  (a,d,v)=>`一記命中——${d} 受到 ${v} 傷害。`,
];
const _CRIT = [
  (a,d,v)=>`【暴擊】${a}精準命中要害！${d} 受到 ${v} 暴擊傷害！`,
  (a,d,v)=>`【暴擊】完美的一擊！${v} 傷害，${d}搖搖欲墜！`,
  (a,d,v)=>`【暴擊】${a}找到了破口——${v} 傷害！`,
];
function TB_missText(a,d){
  return _MISS[Math.floor(Math.random()*_MISS.length)](a,d);
}
function TB_hitText(a,d,r){
  if (r.crit) return _CRIT[Math.floor(Math.random()*_CRIT.length)](a,d,r.damage);
  if (r.blocked && r.damage > 0) return `${d}格擋了大部分傷害，仍受到 ${r.damage} 傷害。`;
  if (r.blocked && r.damage === 0) return `${d}完全格擋了這一擊！`;
  return _HIT[Math.floor(Math.random()*_HIT.length)](a,d,r.damage);
}

// ═══════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════
const TestBattle = {
  CONFIG: TBC,
  WEAPONS: TB_WEAPONS,
  ARMORS:  TB_ARMORS,
  SHIELDS: TB_SHIELDS,
  AMULETS: TB_AMULETS,
  TRAITS:  TB_TRAITS,
  ENEMIES: TB_ENEMIES,
  calcDerived: TB_calcDerived,
  buildUnit:   TB_buildUnit,
  attack:      TB_attack,
  defend:      TB_defend,
  releaseSpecial:   TB_releaseSpecial,
  endTurnGauge:     TB_endTurnGauge,
  bossDecide:       TB_bossDecide,
  gainGauge:        TB_gainGauge,
  calcPressure:     TB_calcPressure,
  applyPressure:    TB_applyPressure,
  triggerLastStand: TB_triggerLastStand,
};
