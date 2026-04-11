/**
 * weapons.js — Weapon definitions
 * eqBonus keys map directly to Stats.player.eqBonus
 */
const Weapons = {
  fists: {
    id: 'fists', name: '空手', type: 'unarmed',
    desc: '一無所有。你的雙拳就是武器。',
    eqBonus: { ATK: 0 },
    price: 0,
  },
  rustySword: {
    id: 'rustySword', name: '生鏽短刀', type: 'blade',
    desc: '從垃圾堆裡找出來的廢鐵，但削進肉裡照樣能要命。',
    eqBonus: { ATK: 8, ACC: -5 },
    price: 0,
  },
  ironSword: {
    id: 'ironSword', name: '標準鐵劍', type: 'blade',
    desc: '競技場配發的制式武器，不算好但也不算爛。',
    eqBonus: { ATK: 18, ACC: 0 },
    price: 50,
  },
  spear: {
    id: 'spear', name: '長矛', type: 'polearm',
    desc: '保持距離就是優勢，突刺速度讓人難以招架。',
    eqBonus: { ATK: 15, SPD: 5, PEN: 8 },
    price: 60,
  },
  heavyAxe: {
    id: 'heavyAxe', name: '重斧', type: 'axe',
    desc: '破甲利器，一擊足以讓盾牌碎裂。代價是你的移動速度。',
    eqBonus: { ATK: 28, PEN: 12, SPD: -8 },
    price: 80,
  },
  masterBlade: {
    id: 'masterBlade', name: '葛拉之劍', type: 'blade',
    desc: '由鐵匠葛拉親手打造，百日祭典前夕流出的極品。',
    eqBonus: { ATK: 35, ACC: 8, CRT: 5, SPD: 3 },
    price: 200,
  },
};
