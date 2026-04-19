/**
 * origins.js — 玩家背景定義（2026-04-19 擴展至 8 出身）
 *
 * 設計意圖（見 docs/systems/origins.md）：
 *   背景 = 種子，不是劇本。每個背景：
 *     1. 給初始屬性修正（statMod） — 作用於 birth_traits 擲骰的 base
 *     2. 給初始特性（startingTraits）
 *     3. 開啟隱藏旗標（startingFlags / hiddenTag）
 *     4. 決定對某些 NPC 的初始好感（initialNpcAffection）
 *     5. 起手書（startingBooks）— 讀書系統入口
 *     6. 解鎖專屬事件池（exclusiveEvents）
 *
 * 起手書 = 沒落騎士 / 手工匠 / 信徒 / 貴族 有，其他 origin 靠後天。
 */
const Origins = {

  // ── 農家子弟 ────────────────────────────────────
  farmBoy: {
    id: 'farmBoy',
    name: '農家子弟',
    title: '燒毀村莊的倖存者',
    desc: '你的村莊被燒了。你被抓來這裡。你記得每一張臉。',
    locked: false,
    statMod: { STR: +2, CON: +3, DEX: -1, WIL: -1 },
    startingTraits: ['diligence', 'kindness'],
    startingFlags:  ['village_burned', 'story_lord_is_enemy'],
    startingItems:  [],
    startingBooks:  [],
    startingMoney:  0,
    hiddenTag:      'lord_is_enemy',
    initialNpcAffection: { dagiSlave: +5, oldSlave: +10 },
    endingAffinities: { revenge: +30, escape: +10, champion: -20, buyFreedom: 0 },
    difficultyScore: { survival: 1, social: 2, combat: 2, resource: 1 },
    exclusiveEvents: ['recognize_lord_banner', 'survivor_letter', 'farm_dream'],
    blockedEvents:   ['noble_seal_recognition'],
    openingNarrative: [
      '你記得那天。煙從田邊升起。',
      '你記得母親的最後一個眼神。',
      '你記得那個戴冠的人。',
      '現在，你被賣進了他的競技場。',
    ],
    assets: { portrait: null, background: null, cg: null, bgm: null },
  },

  // ── 落難貴族 ────────────────────────────────────
  nobleman: {
    id: 'nobleman',
    name: '落難貴族',
    title: '政治鬥爭的輸家',
    desc: '你家族破產了。你被迫賣身還債。你還不懂什麼叫「活下去」。',
    locked: false,
    statMod: { WIL: +2, DEX: +1, LUK: +2, STR: -2, CON: -2 },
    startingTraits: ['literate', 'prideful'],
    startingFlags:  ['family_fallen', 'story_debt_to_master'],
    startingItems:  ['family_pendant'],
    startingBooks:  ['merchant_ledger'],  // 起手帳本（已識字可直接讀）
    startingMoney:  20,
    hiddenTag:      'noble_born',
    initialNpcAffection: {
      officer: +5, overseer: +3, masterArtus: +5,
      melaKook: -5, dagiSlave: -10, orlan: 0,
    },
    endingAffinities: { buyFreedom: +30, champion: -10, revenge: 0, escape: +10 },
    difficultyScore: { survival: 3, social: 1, combat: 3, resource: 1 },
    exclusiveEvents: ['recognize_seal', 'secret_ally_letter', 'political_whisper'],
    blockedEvents:   ['farm_dream'],
    openingNarrative: [
      '你曾穿絲綢，飲金盞。',
      '然後一封密函、一場宴席、一把刀。',
      '家族的徽章被從牆上撤下。',
      '現在，你的雙手第一次握住真正的武器。',
    ],
    assets: { portrait: null, background: null, cg: null, bgm: null },
  },

  // ── 沒落騎士 ────────────────────────────────────
  ruinedKnight: {
    id: 'ruinedKnight',
    name: '沒落騎士',
    title: '失去家族榮光的刀鋒',
    desc: '你的家族早已敗落，但你的劍還記得怎麼揮。',
    locked: false,
    statMod: { STR: +2, DEX: +2, WIL: +1, CON: +1, LUK: -1 },
    startingTraits: ['literate', 'iron_will'],
    startingFlags:  ['knight_fallen', 'knows_swordsmanship'],
    startingItems:  [],
    startingBooks:  ['family_sword_manual'],  // 家傳劍譜
    startingMoney:  10,
    hiddenTag:      'former_knight',
    initialNpcAffection: { officer: +10, masterArtus: +3, orlan: +5 },
    endingAffinities: { champion: +20, revenge: +10, buyFreedom: +5, escape: 0 },
    difficultyScore: { survival: 2, social: 2, combat: 1, resource: 2 },
    exclusiveEvents: ['knight_memories', 'veteran_recognition'],
    blockedEvents:   [],
    openingNarrative: [
      '你家族的徽記早已落入泥土。',
      '劍柄的感覺你記得一清二楚。',
      '戰場、倒下的同袍、最後的號角。',
      '現在，他們叫你「奴隸」。',
    ],
    assets: { portrait: null, background: null, cg: null, bgm: null },
  },

  // ── 乞丐 ────────────────────────────────────
  beggar: {
    id: 'beggar',
    name: '乞丐',
    title: '從街頭被拖來的',
    desc: '沒有家人，沒有名字。被人捉來換幾個銅板。',
    locked: false,
    statMod: { AGI: +2, LUK: +2, CON: -1, WIL: -1 },
    startingTraits: ['survivor'],
    startingFlags:  ['street_survivor'],
    startingItems:  [],
    startingBooks:  [],
    startingMoney:  0,
    hiddenTag:      'street_born',
    initialNpcAffection: { melaKook: +5, dagiSlave: +5, orlan: +3, officer: -5 },
    endingAffinities: { escape: +20, buyFreedom: -10, champion: +5, revenge: 0 },
    difficultyScore: { survival: 1, social: 3, combat: 3, resource: 3 },
    exclusiveEvents: ['street_instinct', 'alley_memory'],
    blockedEvents:   ['noble_seal_recognition'],
    openingNarrative: [
      '沒有家。沒有屋頂。只有街角。',
      '活著就是每天找一口吃的。',
      '然後有一天，他們把你塞進麻袋。',
      '至少在這裡，會有飯吃。',
    ],
    assets: { portrait: null, background: null, cg: null, bgm: null },
  },

  // ── 手工匠 ────────────────────────────────────
  artisan: {
    id: 'artisan',
    name: '手工匠',
    title: '被債務壓垮的工坊主',
    desc: '你懂鐵，懂木，懂十指的技藝。但工坊欠了高利貸。',
    locked: false,
    statMod: { STR: +1, DEX: +2, CON: +2, WIL: +1, LUK: -1 },
    startingTraits: ['diligence', 'kindness'],
    startingFlags:  ['workshop_lost', 'craftsman_hands'],
    startingItems:  [],
    startingBooks:  ['herbal_recipe_tome'],  // 起手藍圖（見識門檻 5，要累積後才能讀）
    startingMoney:  15,
    hiddenTag:      'craftsman_born',
    initialNpcAffection: { blacksmithGra: +10, oldSlave: +5 },
    endingAffinities: { buyFreedom: +20, escape: +10, champion: 0, revenge: -5 },
    difficultyScore: { survival: 2, social: 2, combat: 2, resource: 1 },
    exclusiveEvents: ['craftsman_eye', 'workshop_memories'],
    blockedEvents:   [],
    openingNarrative: [
      '你的手指記得每一個工具。',
      '你做過一口好鐮刀，一把好斧頭。',
      '然後債主來了。你的工坊被燒了。',
      '現在，你的手要學會握劍。',
    ],
    assets: { portrait: null, background: null, cg: null, bgm: null },
  },

  // ── 罪犯 ────────────────────────────────────
  criminal: {
    id: 'criminal',
    name: '罪犯',
    title: '從牢裡換來的',
    desc: '你殺過人。法官給你選：絞架，還是競技場。',
    locked: false,
    statMod: { STR: +1, AGI: +2, WIL: +1, CON: +1, LUK: -2 },
    startingTraits: ['reckless'],
    startingFlags:  ['criminal_past', 'has_killed'],
    startingItems:  [],
    startingBooks:  [],
    startingMoney:  0,
    hiddenTag:      'criminal_born',
    initialNpcAffection: { orlan: -5, dagiSlave: -5, melaKook: -10, officer: +3 },
    endingAffinities: { champion: +15, escape: +10, revenge: +5, buyFreedom: -10 },
    difficultyScore: { survival: 2, social: 3, combat: 1, resource: 3 },
    exclusiveEvents: ['criminal_network', 'prison_connection'],
    blockedEvents:   [],
    openingNarrative: [
      '你不記得那人的臉了。',
      '血、一把刀、一個錯誤。',
      '然後法官說：競技場或絞架。',
      '至少，競技場還有一線生機。',
    ],
    assets: { portrait: null, background: null, cg: null, bgm: null },
  },

  // ── 賭徒 ────────────────────────────────────
  gambler: {
    id: 'gambler',
    name: '賭徒',
    title: '輸光了一切',
    desc: '你曾是酒館裡的傳奇。現在你的籌碼只剩自己。',
    locked: false,
    statMod: { DEX: +1, WIL: +1, LUK: +3, STR: -1, CON: -1 },
    startingTraits: ['silverTongue'],
    startingFlags:  ['gambler_past', 'knows_cards'],
    startingItems:  [],
    startingBooks:  [],
    startingMoney:  5,  // 賭徒袋底
    hiddenTag:      'gambler_born',
    initialNpcAffection: { orlan: +5, melaKook: -3, officer: -3 },
    endingAffinities: { buyFreedom: +20, escape: +5, champion: +10, revenge: -5 },
    difficultyScore: { survival: 2, social: 2, combat: 3, resource: 2 },
    exclusiveEvents: ['gambler_luck', 'card_memory'],
    blockedEvents:   [],
    openingNarrative: [
      '你賭過最後一枚金幣。',
      '你賭過戒指。然後是房子。然後是自己。',
      '骰子落下，你輸了。',
      '現在，你要用血賠這筆債。',
    ],
    assets: { portrait: null, background: null, cg: null, bgm: null },
  },

  // ── 信徒 ────────────────────────────────────
  believer: {
    id: 'believer',
    name: '信徒',
    title: '背棄神祇後被流放',
    desc: '你曾是神殿的一份子。然後你看見了不該看見的。',
    locked: false,
    statMod: { WIL: +3, CON: +1, LUK: +1, STR: -1, DEX: -1 },
    startingTraits: ['literate', 'kindness'],
    startingFlags:  ['priest_past', 'lost_faith'],
    startingItems:  [],
    startingBooks:  ['martyr_saint_life'],  // 殉道聖者列傳
    startingMoney:  0,
    hiddenTag:      'believer_born',
    initialNpcAffection: { melaKook: +10, oldSlave: +5, officer: -5 },
    endingAffinities: { revenge: +10, buyFreedom: +10, escape: +5, champion: -10 },
    difficultyScore: { survival: 2, social: 1, combat: 3, resource: 2 },
    exclusiveEvents: ['temple_memory', 'faith_whisper'],
    blockedEvents:   [],
    openingNarrative: [
      '你在神殿長大。你誦讀聖典。',
      '然後，你看見主祭藏著什麼。',
      '你說了真話。神殿放逐了你。',
      '現在，你的信仰要在血中重新鍛造。',
    ],
    assets: { portrait: null, background: null, cg: null, bgm: null },
  },

  // ── 流浪漢（鎖定，Phase 2）──────────────────────────
  vagabond: {
    id: 'vagabond',
    name: '流浪漢',
    title: '失憶者',
    desc: '你不記得自己是誰。也許這是一種祝福。',
    locked: true,
    lockReason: '此背景將於下個版本開放',
    assets: { portrait: null },
  },

  // ── 角鬥士之子（鎖定，Phase 2）──────────────────────
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
