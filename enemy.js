/**
 * enemy.js — Enemy definitions for combat encounters
 */
const Enemies = {
  slaveRookie: {
    id: 'slaveRookie', name: '新進奴隸',
    desc: '和你一樣剛入場的可憐蟲。',
    hp: 60, ATK: 12, DEF: 5, ACC: 55, EVA: 8, SPD: 18,
    loot: [{ itemId: 'bread', chance: 0.4 }],
    fameReward: 2, xpReward: 10,
  },
  gladiatorB: {
    id: 'gladiatorB', name: '三流鬥士',
    desc: '有過幾場勝利，開始有些自以為是。',
    hp: 90, ATK: 22, DEF: 15, ACC: 62, EVA: 12, SPD: 24,
    loot: [{ itemId: 'herb', chance: 0.3 }],
    fameReward: 5, xpReward: 25,
  },
  arenaVet: {
    id: 'arenaVet', name: '競技場老手',
    desc: '戰痕累累，每一道傷疤都是一個死去對手的記憶。',
    hp: 140, ATK: 38, DEF: 28, ACC: 70, EVA: 18, SPD: 32,
    loot: [{ itemId: 'tonic', chance: 0.35 }, { itemId: 'herb', chance: 0.5 }],
    fameReward: 12, xpReward: 60,
  },
  champion: {
    id: 'champion', name: '競技場冠軍',
    desc: '主人最引以為傲的武器，百日祭典最可能的勝者。',
    hp: 220, ATK: 58, DEF: 45, ACC: 78, EVA: 25, SPD: 42,
    loot: [],
    fameReward: 30, xpReward: 150,
  },
};
