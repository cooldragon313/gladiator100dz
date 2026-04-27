/**
 * weapons.js — 武器單一事實源（2026-04-23 統一後 + Sprint 2 公式落實）
 *
 * 結構為 flat（所有戰鬥欄位直接在物件上，不再用 eqBonus 包）：
 *   - 基礎屬性：ATK, ACC, CRT, CDMG, SPD, PEN（給 TB_calcDerived 用）
 *   - 戰鬥 metadata：type, hands, twoHanded, route, swingTime, cap, special, hitParts
 *   - 顯示：name, desc, price
 *
 * 2026-04-23 Sprint 2 改動：
 *   - 新增 cap 欄位（每武器獨立攻速上限，取代舊共用 6.5 cap）
 *     對應 battle-system.md § 7.1 各武器極限速度表
 *   - 長槍改成「趙子龍風」：ATK 10→8, ACC 6→8, CRT 2→5, PEN 12→15
 *   - 雙手武器 PEN 加強：長劍 5→10, 重斧 8→14, 長槌 15→18
 *   - 長槌 swingTime 8→10（物理極限最慢）
 *
 * testbattle.js 的 TB_WEAPONS alias 到本檔。修改武器數值只改這裡。
 */
const Weapons = {

  fists: {
    id: 'fists', name: '空手',
    type: 'unarmed', weaponClass: 'fist', hands: 1, twoHanded: false,
    route: 'rage', swingTime: 1, cap: 15, special: 'none',
    hitParts: ['身體'],
    ATK: 4, ACC: 5, CRT: 3, CDMG: 8, SPD: 5, PEN: 0,
    desc: '一無所有。你的雙拳就是武器。',
    price: 0,
  },

  // ── 單手武器 ──────────────────────────────────────────
  dagger: {
    id: 'dagger', name: '匕首',
    type: 'blade1h', weaponClass: 'dagger', hands: 1, twoHanded: false,
    route: 'focus', swingTime: 2, cap: 10, special: 'none',
    hitParts: ['頸部', '身體'],
    ATK: 4, ACC: 8, CRT: 12, CDMG: 20, SPD: 12, PEN: 2,
    desc: '輕薄短小，極速連刺。在盔甲縫隙間尋找致命要害。',
    price: 40,
  },

  hammer: {
    id: 'hammer', name: '槌',
    type: 'blunt1h', weaponClass: 'blunt', hands: 1, twoHanded: false,
    // 🆕 2026-04-27 平衡：原 ATK 12 / ACC 2 / swingTime 5 → 槌打不死人也不疼
    //   修：ATK 12→16、ACC 2→5、swingTime 5→4、CDMG 0→25（重擊風味）
    route: 'rage', swingTime: 4, cap: 6, special: 'none',
    hitParts: ['頭', '手'],
    ATK: 16, ACC: 5, CRT: -2, CDMG: 25, SPD: -3, PEN: 12,
    desc: '鐵頭重錘，砸爛盾牌和骨頭都不在話下。準度差，但每一擊都讓人痛不欲生。',
    price: 45,
  },

  shortSword: {
    id: 'shortSword', name: '短劍',
    type: 'blade1h', weaponClass: 'sword', hands: 1, twoHanded: false,
    route: 'fury', swingTime: 3, cap: 8, special: 'none',
    hitParts: ['身體'],
    ATK: 8, ACC: 5, CRT: 4, CDMG: 8, SPD: 2, PEN: 4,
    desc: '攻守均衡的主流武器。沒有特別強的地方，也沒有致命弱點。',
    price: 55,
  },

  // ── 雙手武器 ──────────────────────────────────────────
  spear: {
    id: 'spear', name: '長槍',
    type: 'polearm', weaponClass: 'spear', hands: 2, twoHanded: true,
    route: 'focus', swingTime: 4, cap: 7, special: 'first_strike',
    hitParts: ['身體', '腳'],
    ATK: 8, ACC: 8, CRT: 5, CDMG: 5, SPD: 6, PEN: 15,
    desc: '保持距離即是優勢。槍尖突刺極快、穿透力強，往往率先發動攻擊。破板甲專精。',
    price: 70,
  },

  longSword: {
    id: 'longSword', name: '長劍',
    type: 'blade2h', weaponClass: 'sword', hands: 2, twoHanded: true,
    route: 'fury', swingTime: 5, cap: 6, special: 'none',
    hitParts: ['身體', '頭'],
    ATK: 16, ACC: 3, CRT: 4, CDMG: 10, SPD: -3, PEN: 10,
    desc: '雙手持用的重型劍，每一擊都帶著毀滅性的力量。均衡而不失威力。',
    price: 100,
  },

  warHammer: {
    id: 'warHammer', name: '長槌',
    type: 'blunt2h', weaponClass: 'blunt', hands: 2, twoHanded: true,
    // 🆕 2026-04-27 平衡：ATK 18→24、ACC 0→3、swingTime 10→8、CDMG 0→35
    //   雙手大鈍器、應該是「砸中就重傷」的感覺
    route: 'rage', swingTime: 8, cap: 3, special: 'concuss',
    hitParts: ['頭', '身體'],
    ATK: 24, ACC: 3, CRT: 0, CDMG: 35, SPD: -8, PEN: 22,
    desc: '最重的單件武器。砸中頭部可讓人直接失去意識，但揮動一次已是極限。',
    price: 90,
  },

  heavyAxe: {
    id: 'heavyAxe', name: '重斧',
    type: 'heavy2h', weaponClass: 'axe', hands: 2, twoHanded: true,
    route: 'rage', swingTime: 9, cap: 4, special: 'none',
    hitParts: ['身體', '手'],
    ATK: 20, ACC: -5, CRT: 2, CDMG: 15, SPD: -10, PEN: 14,
    desc: '砍下去不是傷，是截斷。破甲、斷臂，讓人瞬間失去戰力——代價是你幾乎停在原地。',
    price: 110,
  },

  // ══════════════════════════════════════════════════════════
  // 🆕 2026-04-25 葛拉 T2 升級武器（rework spec § 4）
  //   數值規律：每 tier 加 ATK/PEN/ACC/CRT 各 +1~2、price ×2~3
  //   來源：blacksmith_events 階段 4「武器升級 T2」
  // ══════════════════════════════════════════════════════════

  dagger_t2: {
    id: 'dagger_t2', name: '尖刃匕首',
    baseId: 'dagger', tier: 2,
    type: 'blade1h', weaponClass: 'dagger', hands: 1, twoHanded: false,
    route: 'focus', swingTime: 2, cap: 11, special: 'none',
    hitParts: ['頸部', '身體'],
    ATK: 5, ACC: 10, CRT: 14, CDMG: 22, SPD: 13, PEN: 3,
    desc: '葛拉打的精改版。刃口更利、握把更穩。「能在縫裡找到肉的一把。」',
    price: 90,
  },

  hammer_t2: {
    id: 'hammer_t2', name: '鐵頭重槌',
    baseId: 'hammer', tier: 2,
    type: 'blunt1h', weaponClass: 'blunt', hands: 1, twoHanded: false,
    // 🆕 2026-04-27 平衡：跟著 T1 buff 一起拉 — ATK 14→18 / ACC 3→6 / CDMG 2→28 / swingTime 5→4
    route: 'rage', swingTime: 4, cap: 7, special: 'none',
    hitParts: ['頭', '手'],
    ATK: 18, ACC: 6, CRT: -1, CDMG: 28, SPD: -2, PEN: 13,
    desc: '葛拉的鐵頭。比原版重一點、但平衡更好。砸下去骨頭碎得脆。',
    price: 100,
  },

  shortSword_t2: {
    id: 'shortSword_t2', name: '精鐵短劍',
    baseId: 'shortSword', tier: 2,
    type: 'blade1h', weaponClass: 'sword', hands: 1, twoHanded: false,
    route: 'fury', swingTime: 3, cap: 9, special: 'none',
    hitParts: ['身體'],
    ATK: 10, ACC: 6, CRT: 5, CDMG: 10, SPD: 3, PEN: 5,
    desc: '葛拉鍛的版本。鐵更純、刃更直。揮起來像是手的延伸。',
    price: 120,
  },

  spear_t2: {
    id: 'spear_t2', name: '鐵頭長槍',
    baseId: 'spear', tier: 2,
    type: 'polearm', weaponClass: 'spear', hands: 2, twoHanded: true,
    route: 'focus', swingTime: 4, cap: 8, special: 'first_strike',
    hitParts: ['身體', '腳'],
    ATK: 10, ACC: 9, CRT: 6, CDMG: 6, SPD: 7, PEN: 17,
    desc: '槍頭加固、桿身打過。比一般的長槍快半拍——這半拍就是別人的命。',
    price: 150,
  },

  longSword_t2: {
    id: 'longSword_t2', name: '精鐵長劍',
    baseId: 'longSword', tier: 2,
    type: 'blade2h', weaponClass: 'sword', hands: 2, twoHanded: true,
    route: 'fury', swingTime: 5, cap: 7, special: 'none',
    hitParts: ['身體', '頭'],
    ATK: 18, ACC: 4, CRT: 5, CDMG: 12, SPD: -2, PEN: 12,
    desc: '葛拉花了三天。「拿好。別當柴砍。」',
    price: 220,
  },

  warHammer_t2: {
    id: 'warHammer_t2', name: '鐵頭長槌',
    baseId: 'warHammer', tier: 2,
    type: 'blunt2h', weaponClass: 'blunt', hands: 2, twoHanded: true,
    // 🆕 2026-04-27 平衡：跟著 T1 buff 一起拉 — ATK 20→27 / ACC 1→4 / CDMG 2→38 / swingTime 10→8
    route: 'rage', swingTime: 8, cap: 4, special: 'concuss',
    hitParts: ['頭', '身體'],
    ATK: 27, ACC: 4, CRT: 1, CDMG: 38, SPD: -7, PEN: 23,
    desc: '葛拉重新配重的版本。重得更穩、揮得更可預測。',
    price: 200,
  },

  heavyAxe_t2: {
    id: 'heavyAxe_t2', name: '精鐵重斧',
    baseId: 'heavyAxe', tier: 2,
    type: 'heavy2h', weaponClass: 'axe', hands: 2, twoHanded: true,
    route: 'rage', swingTime: 9, cap: 5, special: 'none',
    hitParts: ['身體', '手'],
    ATK: 22, ACC: -3, CRT: 3, CDMG: 17, SPD: -9, PEN: 16,
    desc: '葛拉打的版本。斧刃更厚、削骨像削木。',
    price: 240,
  },
};

// 🆕 2026-04-25b：階段 5 秘法產出 — 雙刃短劍（雙持、副手 ATK 不打折）
//   來源：blacksmith_twinblade_offer 事件（玩家讀過 twin_blade_schematic 書）
Object.assign(Weapons, {
  twinblade: {
    id: 'twinblade', name: '雙刃短劍',
    baseId: 'shortSword', tier: 2.5,    // 介於 T2 和 T3 之間（特殊獨特）
    type: 'blade1h', weaponClass: 'sword', hands: 1, twoHanded: false,
    route: 'fury', swingTime: 3, cap: 10, special: 'twin_blade',
    hitParts: ['身體', '頸部'],
    ATK: 9, ACC: 7, CRT: 8, CDMG: 12, SPD: 4, PEN: 6,
    desc: '兩把破劍熔在一起的奇怪武器。揮起來像短劍——但副手能用上長劍的力道。葛拉花了三天打成的。',
    price: 0,   // 不可賣
    twinBladeOffhandMult: 0.7,   // 副手 ATK 維持 0.7（一般副手 0.5）
  },

  // 🆕 階段 8 傳家武器（tier 4，葛拉好感 80+ + 神眷/鐵人特性才解鎖）
  shortSword_t4: {
    id: 'shortSword_t4', name: '葛拉之劍',
    baseId: 'shortSword', tier: 4,
    type: 'blade1h', weaponClass: 'sword', hands: 1, twoHanded: false,
    route: 'fury', swingTime: 3, cap: 11, special: 'gra_signature',
    hitParts: ['身體', '頭'],
    ATK: 16, ACC: 9, CRT: 9, CDMG: 16, SPD: 6, PEN: 10,
    desc: '葛拉這輩子打過最好的劍。劍背刻著兩個字——他的名字。「拿好。⋯⋯這把不該斷。」',
    price: 0,
  },
  longSword_t4: {
    id: 'longSword_t4', name: '葛拉雙手劍',
    baseId: 'longSword', tier: 4,
    type: 'blade2h', weaponClass: 'sword', hands: 2, twoHanded: true,
    route: 'fury', swingTime: 5, cap: 9, special: 'gra_signature',
    hitParts: ['身體', '頭'],
    ATK: 26, ACC: 7, CRT: 8, CDMG: 18, SPD: 0, PEN: 18,
    desc: '葛拉的傳家。「這是我這輩子最後一把這樣的劍。⋯⋯帶它出去。別讓它斷在你之前。」',
    price: 0,
  },
});

const WEAPON_TIER_UPGRADE_T4 = {
  shortSword_t3: 'shortSword_t4',
  longSword_t3:  'longSword_t4',
  // 其他系列 T4 待補（先做 user 最常用的兩把）
};

// 🆕 2026-04-25：T1 → T2 升級對照表（葛拉用）
const WEAPON_TIER_UPGRADE = {
  dagger:     'dagger_t2',
  hammer:     'hammer_t2',
  shortSword: 'shortSword_t2',
  spear:      'spear_t2',
  longSword:  'longSword_t2',
  warHammer:  'warHammer_t2',
  heavyAxe:   'heavyAxe_t2',
};

// 🆕 2026-04-25b：T2 → T3 升級對照表（葛拉階段 6 用）
//   T3 武器有「鋼」字、價格再 ×2、數值再 +1~2
const WEAPON_TIER_UPGRADE_T3 = {
  dagger_t2:     'dagger_t3',
  hammer_t2:     'hammer_t3',
  shortSword_t2: 'shortSword_t3',
  spear_t2:      'spear_t3',
  longSword_t2:  'longSword_t3',
  warHammer_t2:  'warHammer_t3',
  heavyAxe_t2:   'heavyAxe_t3',
};

// 🆕 2026-04-25b：T3 武器資料（葛拉階段 6 升級產出）
//   每 tier 加 ATK/PEN/ACC/CRT 各 +1~2、price ×2~3
Object.assign(Weapons, {
  dagger_t3: {
    id: 'dagger_t3', name: '鋼刺匕首',
    baseId: 'dagger', tier: 3,
    type: 'blade1h', weaponClass: 'dagger', hands: 1, twoHanded: false,
    route: 'focus', swingTime: 2, cap: 12, special: 'none',
    hitParts: ['頸部', '身體'],
    ATK: 6, ACC: 12, CRT: 16, CDMG: 24, SPD: 14, PEN: 5,
    desc: '葛拉用鋼錠重新淬煉的版本。刃口能在縫裡找到要害——不只一次。',
    price: 200,
  },
  hammer_t3: {
    id: 'hammer_t3', name: '鋼頭重槌',
    baseId: 'hammer', tier: 3,
    type: 'blunt1h', weaponClass: 'blunt', hands: 1, twoHanded: false,
    // 🆕 2026-04-27 平衡：跟著 T1/T2 buff 一起拉 — ATK 16→21 / ACC 4→7 / CDMG 4→32 / swingTime 5→4
    route: 'rage', swingTime: 4, cap: 8, special: 'none',
    hitParts: ['頭', '手'],
    ATK: 21, ACC: 7, CRT: 0, CDMG: 32, SPD: -1, PEN: 15,
    desc: '葛拉的鋼頭。砸下去骨頭碎得乾淨。「這把不會壞。」',
    price: 230,
  },
  shortSword_t3: {
    id: 'shortSword_t3', name: '鍛造短劍',
    baseId: 'shortSword', tier: 3,
    type: 'blade1h', weaponClass: 'sword', hands: 1, twoHanded: false,
    route: 'fury', swingTime: 3, cap: 10, special: 'none',
    hitParts: ['身體'],
    ATK: 12, ACC: 7, CRT: 6, CDMG: 12, SPD: 4, PEN: 7,
    desc: '葛拉用三天三夜鍛打的版本。「拿好。這把不該斷在你手上。」',
    price: 280,
  },
  spear_t3: {
    id: 'spear_t3', name: '鋼尖長槍',
    baseId: 'spear', tier: 3,
    type: 'polearm', weaponClass: 'spear', hands: 2, twoHanded: true,
    route: 'focus', swingTime: 4, cap: 9, special: 'first_strike',
    hitParts: ['身體', '腳'],
    ATK: 12, ACC: 10, CRT: 7, CDMG: 7, SPD: 8, PEN: 19,
    desc: '槍頭是純鋼、桿是硬木。刺出去的距離比任何長槍多半步——半步就是別人的命。',
    price: 340,
  },
  longSword_t3: {
    id: 'longSword_t3', name: '鍛造長劍',
    baseId: 'longSword', tier: 3,
    type: 'blade2h', weaponClass: 'sword', hands: 2, twoHanded: true,
    route: 'fury', swingTime: 5, cap: 8, special: 'none',
    hitParts: ['身體', '頭'],
    ATK: 20, ACC: 5, CRT: 6, CDMG: 14, SPD: -1, PEN: 14,
    desc: '葛拉這輩子打過最好的劍之一。劍背刻著一個小印——他的名字。',
    price: 480,
  },
  warHammer_t3: {
    id: 'warHammer_t3', name: '鍛造長槌',
    baseId: 'warHammer', tier: 3,
    type: 'blunt2h', weaponClass: 'blunt', hands: 2, twoHanded: true,
    // 🆕 2026-04-27 平衡：跟著 T1/T2 buff 一起拉 — ATK 22→30 / ACC 2→5 / CDMG 4→42 / swingTime 10→8
    route: 'rage', swingTime: 8, cap: 5, special: 'concuss',
    hitParts: ['頭', '身體'],
    ATK: 30, ACC: 5, CRT: 2, CDMG: 42, SPD: -6, PEN: 25,
    desc: '葛拉用配重塊重新平衡的版本。揮起來像揮一根鐵指——有點輕。',
    price: 440,
  },
  heavyAxe_t3: {
    id: 'heavyAxe_t3', name: '鍛造重斧',
    baseId: 'heavyAxe', tier: 3,
    type: 'heavy2h', weaponClass: 'axe', hands: 2, twoHanded: true,
    route: 'rage', swingTime: 9, cap: 6, special: 'none',
    hitParts: ['身體', '手'],
    ATK: 24, ACC: -1, CRT: 4, CDMG: 19, SPD: -8, PEN: 18,
    desc: '葛拉打了五天才滿意。「這把斷誰的胳膊都不是它的錯。」',
    price: 520,
  },
});
