/**
 * armors.js — Armor and shield definitions
 */
const Armors = {
  // ── Body armors ──
  rags: {
    id: 'rags', name: '破布', type: 'light',
    desc: '遮體而已，沒有任何防護效果。',
    eqBonus: { DEF: 0 },
    price: 0,
  },
  leatherArmor: {
    id: 'leatherArmor', name: '皮甲', type: 'light',
    desc: '輕便的皮革護甲，不妨礙移動。',
    eqBonus: { DEF: 12, SPD: 0 },
    price: 40,
  },
  thickLeather: {
    id: 'thickLeather', name: '加厚皮甲', type: 'light',
    desc: '多層鞣製皮革壓合，比普通皮甲吸衝擊。葛拉打的。',
    eqBonus: { DEF: 18, SPD: -1 },
    price: 70,
  },
  studdedLeather: {
    id: 'studdedLeather', name: '鉚釘皮甲', type: 'light',
    desc: '皮革上釘了鐵釘，兼顧防禦與輕便。能看出打造者的心思。',
    eqBonus: { DEF: 24, SPD: -2 },
    price: 110,
  },
  chainmail: {
    id: 'chainmail', name: '鏈甲', type: 'medium',
    desc: '由鐵環編織而成，比皮甲堅固，但重量也更大。',
    eqBonus: { DEF: 22, SPD: -5 },
    price: 80,
  },
  ironPlate: {
    id: 'ironPlate', name: '鐵板甲', type: 'heavy',
    desc: '幾乎刀槍不入，但你每走一步都像拖著鐵錨。',
    eqBonus: { DEF: 38, SPD: -15, EVA: -10 },
    price: 150,
  },

  // ── Shields (contribute BLK bonus) ──
  woodShield: {
    id: 'woodShield', name: '木盾', type: 'shield',
    desc: '乾燥的木頭做成的盾牌，兩三下就可能碎裂。',
    eqBonus: { BLK: 10, DEF: 5 },
    price: 20,
  },
  ironShield: {
    id: 'ironShield', name: '鐵盾', type: 'shield',
    desc: '厚實的鐵盾，擋住重擊的同時你的手臂也在顫抖。',
    eqBonus: { BLK: 22, DEF: 10, SPD: -3 },
    price: 70,
  },
};
