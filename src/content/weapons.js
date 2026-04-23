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
    type: 'unarmed', hands: 1, twoHanded: false,
    route: 'rage', swingTime: 1, cap: 15, special: 'none',
    hitParts: ['身體'],
    ATK: 4, ACC: 5, CRT: 3, CDMG: 8, SPD: 5, PEN: 0,
    desc: '一無所有。你的雙拳就是武器。',
    price: 0,
  },

  // ── 單手武器 ──────────────────────────────────────────
  dagger: {
    id: 'dagger', name: '匕首',
    type: 'blade1h', hands: 1, twoHanded: false,
    route: 'focus', swingTime: 2, cap: 10, special: 'none',
    hitParts: ['頸部', '身體'],
    ATK: 4, ACC: 8, CRT: 12, CDMG: 20, SPD: 12, PEN: 2,
    desc: '輕薄短小，極速連刺。在盔甲縫隙間尋找致命要害。',
    price: 40,
  },

  hammer: {
    id: 'hammer', name: '槌',
    type: 'blunt1h', hands: 1, twoHanded: false,
    route: 'rage', swingTime: 5, cap: 6, special: 'none',
    hitParts: ['頭', '手'],
    ATK: 12, ACC: 2, CRT: -2, CDMG: 0, SPD: -3, PEN: 10,
    desc: '鐵頭重錘，砸爛盾牌和骨頭都不在話下。準度差，但每一擊都讓人痛不欲生。',
    price: 45,
  },

  shortSword: {
    id: 'shortSword', name: '短劍',
    type: 'blade1h', hands: 1, twoHanded: false,
    route: 'fury', swingTime: 3, cap: 8, special: 'none',
    hitParts: ['身體'],
    ATK: 8, ACC: 5, CRT: 4, CDMG: 8, SPD: 2, PEN: 4,
    desc: '攻守均衡的主流武器。沒有特別強的地方，也沒有致命弱點。',
    price: 55,
  },

  // ── 雙手武器 ──────────────────────────────────────────
  spear: {
    id: 'spear', name: '長槍',
    type: 'polearm', hands: 2, twoHanded: true,
    route: 'focus', swingTime: 4, cap: 7, special: 'first_strike',
    hitParts: ['身體', '腳'],
    ATK: 8, ACC: 8, CRT: 5, CDMG: 5, SPD: 6, PEN: 15,
    desc: '保持距離即是優勢。槍尖突刺極快、穿透力強，往往率先發動攻擊。破板甲專精。',
    price: 70,
  },

  longSword: {
    id: 'longSword', name: '長劍',
    type: 'blade2h', hands: 2, twoHanded: true,
    route: 'fury', swingTime: 5, cap: 6, special: 'none',
    hitParts: ['身體', '頭'],
    ATK: 16, ACC: 3, CRT: 4, CDMG: 10, SPD: -3, PEN: 10,
    desc: '雙手持用的重型劍，每一擊都帶著毀滅性的力量。均衡而不失威力。',
    price: 100,
  },

  warHammer: {
    id: 'warHammer', name: '長槌',
    type: 'blunt2h', hands: 2, twoHanded: true,
    route: 'rage', swingTime: 10, cap: 3, special: 'concuss',
    hitParts: ['頭', '身體'],
    ATK: 18, ACC: 0, CRT: 0, CDMG: 0, SPD: -8, PEN: 18,
    desc: '最重的單件武器。砸中頭部可讓人直接失去意識，但揮動一次已是極限。',
    price: 90,
  },

  heavyAxe: {
    id: 'heavyAxe', name: '重斧',
    type: 'heavy2h', hands: 2, twoHanded: true,
    route: 'rage', swingTime: 9, cap: 4, special: 'none',
    hitParts: ['身體', '手'],
    ATK: 20, ACC: -5, CRT: 2, CDMG: 15, SPD: -10, PEN: 14,
    desc: '砍下去不是傷，是截斷。破甲、斷臂，讓人瞬間失去戰力——代價是你幾乎停在原地。',
    price: 110,
  },
};
