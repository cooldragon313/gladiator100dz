/**
 * weapons.js — Weapon definitions (inventory / shop display)
 * eqBonus keys map to Stats.player.eqBonus and mirror TB_WEAPONS values.
 *
 * hands    : 1 = 單手, 2 = 雙手
 * hitParts : 該武器自然攻擊的身體部位（顯示用）
 */
const Weapons = {

  fists: {
    id: 'fists', name: '空手', type: 'unarmed', hands: 1,
    desc: '一無所有。你的雙拳就是武器。',
    hitParts: ['身體'],
    eqBonus: {},
    price: 0,
  },

  // ── 單手武器 ──────────────────────────────────────────
  dagger: {
    id: 'dagger', name: '匕首', type: 'blade', hands: 1,
    desc: '輕薄短小，極速連刺。在盔甲縫隙間尋找致命要害。',
    hitParts: ['頸部', '身體'],
    eqBonus: { ATK: 4, ACC: 8, CRT: 12, CDMG: 20, SPD: 12, PEN: 2 },
    price: 40,
  },

  hammer: {
    id: 'hammer', name: '槌', type: 'blunt', hands: 1,
    desc: '鐵頭重錘，砸爛盾牌和骨頭都不在話下。準度差，但每一擊都讓人痛不欲生。',
    hitParts: ['頭', '手'],
    eqBonus: { ATK: 12, ACC: 2, CRT: -2, SPD: -3, PEN: 10 },
    price: 45,
  },

  shortSword: {
    id: 'shortSword', name: '短劍', type: 'blade', hands: 1,
    desc: '攻守均衡的主流武器。沒有特別強的地方，也沒有致命弱點。',
    hitParts: ['身體'],
    eqBonus: { ATK: 8, ACC: 5, CRT: 4, CDMG: 8, SPD: 2, PEN: 4 },
    price: 55,
  },

  // ── 雙手武器 ──────────────────────────────────────────
  spear: {
    id: 'spear', name: '長槍', type: 'polearm', hands: 2,
    desc: '保持距離即是優勢。突刺速度快，穿透力強，往往率先發動攻擊。',
    hitParts: ['身體', '腳'],
    eqBonus: { ATK: 10, ACC: 6, CRT: 2, CDMG: 5, SPD: 6, PEN: 12 },
    price: 70,
  },

  longSword: {
    id: 'longSword', name: '長劍', type: 'blade', hands: 2,
    desc: '雙手持用的重型劍，每一擊都帶著毀滅性的力量。均衡而不失威力。',
    hitParts: ['身體', '頭'],
    eqBonus: { ATK: 16, ACC: 3, CRT: 4, CDMG: 10, SPD: -3, PEN: 5 },
    price: 100,
  },

  warHammer: {
    id: 'warHammer', name: '長槌', type: 'blunt', hands: 2,
    desc: '最重的單件武器。砸中頭部可讓人直接失去意識，但揮動一次已是極限。',
    hitParts: ['頭', '身體'],
    eqBonus: { ATK: 18, SPD: -8, PEN: 15 },
    price: 90,
  },

  heavyAxe: {
    id: 'heavyAxe', name: '重斧', type: 'axe', hands: 2,
    desc: '砍下去不是傷，是截斷。破甲、斷臂，讓人瞬間失去戰力——代價是你幾乎停在原地。',
    hitParts: ['身體', '手'],
    eqBonus: { ATK: 20, ACC: -5, CRT: 2, CDMG: 15, SPD: -10, PEN: 8 },
    price: 110,
  },
};
