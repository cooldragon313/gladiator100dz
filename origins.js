/**
 * origins.js — 玩家背景定義（Phase 2 S1 前哨）
 *
 * 設計意圖（見 DESIGN.md 玩家背景系統）：
 *   背景 = 種子，不是劇本。每個背景：
 *     1. 給初始屬性修正（statMod）
 *     2. 給初始特性（startingTraits）
 *     3. 開啟隱藏旗標（startingFlags / hiddenTag）
 *     4. 決定對某些 NPC 的初始好感（initialNpcAffection）
 *     5. 解鎖專屬事件池（exclusiveEvents，Phase 2 事件系統接上後啟用）
 *
 * 2026-04-15 第一版：先做 farmBoy 與 nobleman 兩個範本，
 *                     vagabond 與 gladiatorSon 以鎖定狀態占位。
 */
const Origins = {

  // ── 農家子弟（完整）────────────────────────────────────
  farmBoy: {
    id: 'farmBoy',
    name: '農家子弟',
    title: '燒毀村莊的倖存者',
    desc: '你的村莊被燒了。你被抓來這裡。你記得每一張臉。',
    locked: false,

    // 屬性修正
    statMod: { STR: +2, CON: +3, DEX: -1, WIL: -1 },

    // 初始狀態
    startingTraits: ['diligence'],                       // 勤勉（暫用現有特性）
    startingFlags:  ['village_burned', 'story_lord_is_enemy'],
    startingItems:  [],
    startingMoney:  0,
    hiddenTag:      'lord_is_enemy',                     // Phase 2 事件條件用

    // NPC 初始好感（同是被擄的奴隸有親切感）
    initialNpcAffection: {
      dagiSlave: +5,
      oldSlave:  +10,
    },

    // 結局傾向（S6 命運抽取顯示用，Phase 2 接）
    endingAffinities: {
      revenge:    +30,
      escape:     +10,
      champion:   -20,
      buyFreedom:   0,
    },

    // 難度星數（S6 用）
    difficultyScore: {
      survival: 1,
      social:   2,
      combat:   2,
      resource: 1,
    },

    // 專屬事件池（Phase 2 接上）
    exclusiveEvents: [
      'recognize_lord_banner',
      'survivor_letter',
      'farm_dream',
    ],
    blockedEvents: [
      'noble_seal_recognition',
    ],

    // 開場敘述（Stage 播放）
    openingNarrative: [
      '你記得那天。煙從田邊升起。',
      '你記得母親的最後一個眼神。',
      '你記得那個戴冠的人。',
      '現在，你被賣進了他的競技場。',
    ],

    // 資產（未來接美術）
    assets: {
      portrait:   null,
      background: null,
      cg:         null,
      bgm:        null,
    },
  },

  // ── 落魄貴族（完整）────────────────────────────────────
  nobleman: {
    id: 'nobleman',
    name: '落魄貴族',
    title: '政治鬥爭的輸家',
    desc: '你的教養在這裡一文不值——或許不是。',
    locked: false,

    statMod: { WIL: +3, LUK: +2, STR: -2, CON: -1 },

    startingTraits: ['kindness'],                        // 寬厚（暫用現有特性，未來換成「博學」educated）
    startingFlags:  ['noble_fall', 'story_political_knowledge'],
    startingItems:  [],
    startingMoney:  20,                                  // 貴族隨身有一點積蓄
    hiddenTag:      'political_knowledge',

    // 貴族對權威人物有初始好感（他們能「看懂」彼此）
    initialNpcAffection: {
      masterArtus:  +10,
      officer:       +5,
      blacksmithGra: -5,                                 // 工匠對貴族有抵觸
    },

    endingAffinities: {
      buyFreedom: +30,
      champion:   -10,
      revenge:      0,
      escape:     +10,
    },

    difficultyScore: {
      survival: 3,
      social:   1,
      combat:   3,
      resource: 1,
    },

    exclusiveEvents: [
      'recognize_seal',
      'secret_ally_letter',
      'political_whisper',
    ],
    blockedEvents: [
      'farm_dream',
    ],

    openingNarrative: [
      '你曾穿絲綢，飲金盞。',
      '然後一封密函、一場宴席、一把刀。',
      '家族的徽章被從牆上撤下。',
      '現在，你的雙手第一次握住真正的武器。',
    ],

    assets: {
      portrait:   null,
      background: null,
      cg:         null,
      bgm:        null,
    },
  },

  // ── 流浪漢（鎖定：即將開放）──────────────────────────
  vagabond: {
    id: 'vagabond',
    name: '流浪漢',
    title: '失憶者',
    desc: '你不記得自己是誰。也許這是一種祝福。',
    locked: true,
    lockReason: '此背景將於下個版本開放',
    assets: { portrait: null },
  },

  // ── 角鬥士之子（鎖定：即將開放）──────────────────────
  gladiatorSon: {
    id: 'gladiatorSon',
    name: '角鬥士之子',
    title: '繼承父親的競技場',
    desc: '你的父親死在這個競技場。你自願回來。',
    locked: true,
    lockReason: '此背景將於下個版本開放',
    assets: { portrait: null },
  },

};
