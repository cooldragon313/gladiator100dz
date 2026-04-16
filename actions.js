/**
 * actions.js — Action definitions available at each field
 *
 * Each action:
 *   id          : unique key
 *   name        : display name (Chinese)
 *   desc        : one-line description
 *   slots       : number of 2-hour blocks consumed (1 or 2)
 *   staminaCost : stamina consumed before execution
 *   foodCost    : extra food consumed (default 0)
 *   fields      : array of fieldIds where available, or 'any'
 *   requireNPC  : 'teammate' | specific npcId — NPC must be present
 *   effects     : [{ type:'vital'|'attr'|'affection'|'fame', key, delta }]
 *   eventPool   : [eventId, ...] — IDs that may fire post-action (40% chance)
 *   risk        : true = flavour flag for risky actions
 *
 *   hiddenFromList : 🆕 Phase 1-A (奴隸循環設計)
 *                    true = 不顯示在玩家主動行動列表上。
 *                    定義保留，未來由事件系統觸發（勞動請求/傳喚/切磋邀請等）。
 *                    對應 Part E.2：玩家無法主動找 NPC、拜訪權威、申請勞動。
 */

const ACTIONS = {

  // 🆕 Phase 1 重構：訓練場是唯一場景，所有玩家可主動執行的動作都改為 'any'
  // 房間品質（豪華/破舊）改為休息事件的敘事描述，由名聲決定
  rest: {
    id: 'rest', name: '休息',
    desc: '靜靜待著，讓身體稍作恢復。',
    slots: 1, staminaCost: 0, foodCost: 0,
    fields: 'any',
    effects: [
      { type: 'vital', key: 'stamina', delta: 15 },
    ],
  },

  // nap 已移除（Phase 1-D）：改由 sleep_normal / nightmare 等強制事件取代
  soloThink: {
    id: 'soloThink', name: '獨自沉思',
    desc: '面壁沉思，磨礪意志與心性。',
    slots: 1, staminaCost: 5, foodCost: 0,
    fields: 'any',
    effects: [
      { type: 'exp',   key: 'WIL',  delta: 4 },
      { type: 'vital', key: 'mood', delta: 5 },
    ],
  },


  // ── 訓練場 ───────────────────────────────────────────────
  // 🆕 Phase 1 重構：訓練場是唯一場景（stdTraining）
  // 🆕 Phase 1-J.2：五個主動訓練動作對應 STR / DEX / CON / AGI / WIL，
  //                 全部 staminaCost 20、1 slot、每項 +0.5 對應屬性。
  //                 （LUK 不可練，留給事件/運氣系統；sparring 仍為隊友邀請事件）
  // injuryPart：受傷部位（輕量版 v1）。
  basicSwing: {
    id: 'basicSwing', name: '基礎揮砍',
    desc: '反覆揮動武器，磨礪攻擊動作。',
    slots: 1, staminaCost: 20, foodCost: 10,
    fields: ['stdTraining'],
    effects: [{ type: 'exp', key: 'STR', delta: 8 }],
    eventPool: ['overseerWatch', 'trainingInjury'],
    injuryPart: '手臂',
  },
  preciseStab: {
    id: 'preciseStab', name: '精準刺擊',
    desc: '對木樁反覆刺擊，鍛鍊手眼協調與出手精度。',
    slots: 1, staminaCost: 20, foodCost: 10,
    fields: ['stdTraining'],
    effects: [{ type: 'exp', key: 'DEX', delta: 8 }],
    eventPool: ['overseerWatch', 'trainingInjury'],
    injuryPart: '手部',
  },
  endurance: {
    id: 'endurance', name: '耐力訓練',
    desc: '全副武裝奔跑，強化體質與持久力。',
    slots: 1, staminaCost: 20, foodCost: 12,
    fields: ['stdTraining'],
    effects: [{ type: 'exp', key: 'CON', delta: 8 }],
    eventPool: ['overseerWatch', 'trainingInjury'],
    injuryPart: '軀幹',
  },
  footwork: {
    id: 'footwork', name: '步法練習',
    desc: '反覆移動步伐，提高靈敏與閃躲能力。',
    slots: 1, staminaCost: 20, foodCost: 10,
    fields: ['stdTraining'],
    effects: [{ type: 'exp', key: 'AGI', delta: 8 }],
    eventPool: ['overseerWatch', 'trainingInjury'],
    injuryPart: '腿部',
  },
  meditation: {
    id: 'meditation', name: '冥想調息',
    desc: '靜坐調整呼吸，強化意志，恢復心情與體力。',
    slots: 1, staminaCost: 0, foodCost: 0,   // 靜坐不消耗體力
    fields: ['stdTraining'],
    effects: [
      { type: 'exp',   key: 'WIL',     delta: 8  },
      { type: 'vital', key: 'mood',    delta: 10 },
      { type: 'vital', key: 'stamina', delta: 8  },  // 調息本身是一種恢復
    ],
    // 精神訓練：不設 eventPool（不會有身體受傷事件）
  },
  sparring: {
    id: 'sparring', name: '切磋對練',
    desc: '與在場隊友切磋，提升攻擊與反應速度。',
    slots: 1, staminaCost: 20, foodCost: 8,
    fields: ['stdTraining'],
    requireNPC: 'teammate',
    hiddenFromList: true,    // Phase 1-A: 改為隊友主動邀請事件（Phase 1-H）
    effects: [
      { type: 'exp', key: 'STR', delta: 5 },
      { type: 'exp', key: 'DEX', delta: 5 },
    ],
    eventPool: ['sparringBond', 'overseerWatch'],
    injuryPart: '手部',
  },

  // ── 廚房 ─────────────────────────────────────────────────
    helpCook: {
    id: 'helpCook', name: '幫廚娘打雜',
    desc: '搭把手，說不定能混到額外食物和好感。',
    slots: 1, staminaCost: 10, foodCost: 0,
    fields: ['kitchen'],
    requireNPC: 'melaKook',
    hiddenFromList: true,    // 🆕 Phase 1-A: 改為梅拉透過主人派遣（Phase 1-F）
    effects: [
      { type: 'vital',     key: 'food',     delta: 15 },
      { type: 'affection', key: 'melaKook', delta: 5  },
        ],
    eventPool: ['melaSecret', 'melaChat'],
  },
  stealFood: {
    id: 'stealFood', name: '偷食物',
    desc: '趁人不注意順手帶走一些。風險不小。',
    slots: 1, staminaCost: 0, foodCost: 0,
    fields: ['kitchen'],
    hiddenFromList: true,    // 🆕 Phase 1-A: 改為飢餓閾值觸發事件（Phase 1-E）
    effects: [{ type: 'vital', key: 'food', delta: 20 }],
    // 2/3 chance of stealSuccess event (benign), 1/3 stealCaught (punishes)
    eventPool: ['stealSuccess', 'stealSuccess', 'stealCaught'],
    risk: true,
  },

  // ── 鍛造坊 ───────────────────────────────────────────────
  watchSmith: {
    id: 'watchSmith', name: '觀摩打鐵',
    desc: '沉默地看葛拉鍛打，感受技藝的重量。',
    slots: 1, staminaCost: 5, foodCost: 0,
    fields: ['forge'],
    hiddenFromList: true,    // 🆕 Phase 1-A: 改為葛拉主動邀請（Phase 1-F）
    effects: [
      { type: 'attr',      key: 'DEX',          delta: 0.2 },
      { type: 'affection', key: 'blacksmithGra', delta: 2  },
    ],
    eventPool: ['graStory'],
  },
  requestRepair: {
    id: 'requestRepair', name: '委託修繕裝備',
    desc: '把武器交給葛拉，換來好感與信任。',
    slots: 1, staminaCost: 0, foodCost: 0,
    fields: ['forge'],
    requireNPC: 'blacksmithGra',
    hiddenFromList: true,    // 🆕 Phase 1-A: 改為裝備耐久度觸發事件（Phase 2）
    effects: [
      { type: 'affection', key: 'blacksmithGra', delta: 5 },
    ],
    eventPool: ['graRepair'],
  },

  // ── 長官房 ───────────────────────────────────────────────
  visitOfficer: {
    id: 'visitOfficer', name: '拜訪長官',
    desc: '不知道他今天心情如何。',
    slots: 1, staminaCost: 0, foodCost: 0,
    fields: ['officerRoom'],
    requireNPC: 'officer',
    hiddenFromList: true,    // 🆕 Phase 1-A: 改為長官傳喚制度（Phase 1-G）
    effects: [],
    eventPool: ['officerMission', 'officerCold', 'officerPraise'],
  },

  // ── 主人房 ───────────────────────────────────────────────
  visitMaster: {
    id: 'visitMaster', name: '拜見主人',
    desc: '走進那個充滿香料氣息的房間。',
    slots: 1, staminaCost: 0, foodCost: 0,
    fields: ['masterRoom'],
    requireNPC: 'masterArtus',
    hiddenFromList: true,    // 🆕 Phase 1-A: 改為主人傳喚制度（Phase 1-G）
    effects: [],
    eventPool: ['masterEval', 'masterGift', 'masterWarning'],
  },

  // ── 市集 ─────────────────────────────────────────────────
  // 🆕 Phase 1-A: 市集動作全部隱藏，改為「主人派你去採購」事件（Phase 1-I）
  browseMarket: {
    id: 'browseMarket', name: '閒逛市集',
    desc: '在人群中走動，感受外面的世界。',
    slots: 1, staminaCost: 5, foodCost: 0,
    fields: ['market'],
    hiddenFromList: true,    // 🆕 Phase 1-I 事件化
    effects: [{ type: 'vital', key: 'mood', delta: 12 }],
    eventPool: ['marketThief', 'marketRumor', 'marketFan'],
  },
  buyFood: {
    id: 'buyFood', name: '購買食物',
    desc: '花點錢買些乾糧備用。',
    slots: 1, staminaCost: 0, foodCost: 0,
    fields: ['market'],
    hiddenFromList: true,    // 🆕 Phase 1-I 事件化（採購任務）
    effects: [{ type: 'vital', key: 'food', delta: 30 }],
    eventPool: ['marketThief'],
  },

  // ── 出城 ─────────────────────────────────────────────────
  // 🆕 Phase 1-A: 出城動作改為劇情觸發（押運/戰爭徵召等），非玩家主動
  outdoorTrain: {
    id: 'outdoorTrain', name: '野外自主訓練',
    desc: '在護衛視線下，享受難得的自由訓練。',
    slots: 1, staminaCost: 25, foodCost: 8,
    fields: ['cityExit'],
    hiddenFromList: true,    // 🆕 劇情觸發
    effects: [
      { type: 'attr',  key: 'STR',  delta: 0.4 },
      { type: 'attr',  key: 'AGI',  delta: 0.4 },
      { type: 'vital', key: 'mood', delta: 8   },
    ],
  },
  gatherHerbs: {
    id: 'gatherHerbs', name: '採集草藥',
    desc: '在荒野邊緣尋找可用的植物與食材。',
    slots: 1, staminaCost: 10, foodCost: 0,
    fields: ['cityExit'],
    hiddenFromList: true,    // 🆕 劇情觸發
    effects: [
      { type: 'vital', key: 'food', delta: 15 },
      { type: 'vital', key: 'mood', delta: 5  },
    ],
    eventPool: ['herbFind', 'wildAnimal'],
  },
  contemplateNature: {
    id: 'contemplateNature', name: '遙望天際',
    desc: '城牆外的天空很寬闊。讓自己暫時忘記身分。',
    slots: 1, staminaCost: 0, foodCost: 0,
    fields: ['cityExit'],
    hiddenFromList: true,    // 🆕 劇情觸發
    effects: [
      { type: 'vital', key: 'mood', delta: 15 },
      { type: 'attr',  key: 'WIL', delta: 0.1 },
    ],
  },
};

/**
 * D.1.2 移除：NPC_AFF_KEY legacy 映射已不再需要。
 * 現在所有好感度都透過 teammates.getAffection() / modAffection() 統一處理，
 * 且 npc.js 內部支援 legacy 別名（master/blacksmith/cook）自動解析。
 */

/**
 * Returns action definitions available in the given field right now.
 * @param {string}   fieldId
 * @param {object}   playerRef   — Stats.player
 * @param {{ teammates:string[], audience:string[] }} npcsPresent
 * @returns {object[]}
 */
function getFieldActions(fieldId, playerRef, npcsPresent) {
  const allNPCs = [
    ...(npcsPresent.teammates || []),
    ...(npcsPresent.audience  || []),
  ];
  
  // Current slot start hour: 06, 08, 10 … 20
  const currentHour = 6 + Math.max(0, Math.floor((playerRef.time - 360) / 120)) * 2;

  return Object.values(ACTIONS).filter(act => {
    if (act.fields !== 'any' && !act.fields.includes(fieldId)) return false;
    // Time restriction: if timeHours defined, current slot must be one of them
    if (act.timeHours && !act.timeHours.includes(currentHour)) return false;
    if (act.requireNPC) {
      if (act.requireNPC === 'teammate') {
        return npcsPresent.teammates && npcsPresent.teammates.length > 0;
      }
      return allNPCs.includes(act.requireNPC);
    }
    return true;
  });
}
