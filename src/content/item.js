/**
 * item.js — Consumable and misc item definitions
 */
const Items = {
  bread: {
    id: 'bread', name: '硬麵包', type: 'consumable',
    desc: '乾硬難嚼，但總比沒有好。',
    use: [{ type: 'vital', key: 'food', delta: 20 }],
  },
  herb: {
    id: 'herb', name: '草藥', type: 'consumable',
    desc: '簡單的止血草藥，能緩解輕微傷口。',
    use: [{ type: 'vital', key: 'hp', delta: 15 }],
  },
  shovel: {
    id: 'shovel', name: '鐵鏟', type: 'tool',
    desc: '用於礦坑勞動的粗糙鐵鏟。（保留用）',
    use: [],
  },
  tonic: {
    id: 'tonic', name: '體力藥水', type: 'consumable',
    desc: '鐵匠特製的秘方，喝下後渾身發熱、力量倍增。',
    use: [{ type: 'vital', key: 'stamina', delta: 30 }],
  },
  wine: {
    id: 'wine', name: '廉價烈酒', type: 'consumable',
    desc: '用廢料釀成的劣質烈酒。能讓你忘記一切，包括疼痛。',
    use: [
      { type: 'vital', key: 'mood',    delta: 20 },
      { type: 'vital', key: 'stamina', delta: -10 },
    ],
  },
};
