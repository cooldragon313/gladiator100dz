/**
 * npc.js — NPC definitions and affection tracking
 *
 * D.1.5: NPC 結構擴展為完整模板（見 DESIGN.md D.11.7）
 * 加入所有未來系統需要的欄位（成長/人格/漸進揭露/連動/資產）。
 * 每個 NPC 只需填寫該填的欄位，其他由 _applyDefaults() 自動補齊。
 *
 * 🆕 D.12 故事揭露系統（見 DESIGN.md D.12）：
 *   每個 NPC 可以填 storyReveals: [...] 陣列，裡面每個元素是一段 reveal。
 *
 *   type: 'flavor'   — 關係圖卡片常駐顯示（依條件顯示最高可見的一段）
 *   type: 'event'    — 事件型，晚間就寢時隨機 roll 觸發一次
 *
 *   條件欄位（都是可選的，除 affection 外）：
 *     affection:        最低好感門檻（必填）
 *     requireAnyTrait:  ['insomnia_disorder', 'neurotic']  任一即可
 *     requireAnyAilment:['insomnia_disorder']              任一即可
 *     requireMinAttr:   { WIL: 15 }                        屬性最低值
 *     requireFlag:      'story_lord_is_enemy'              需特定旗標
 *     requireOrigin:    'farmBoy'                           限背景
 *     requireItemTag:   'marco_charm'                       身上需有帶此 tag 的物品
 *     chance:           0.3                                 觸發機率（event 型必填）
 *     onceOnly:         true                                觸發過就不再（event 預設 true）
 *     grantItem:        'marcoCharm'                        觸發時贈送道具
 *     logColor:         '#8899aa'                           事件 log 顏色
 */
const teammates = (() => {

  // ══════════════════════════════════════════════════
  // NPC 預設欄位（D.11.7 模板）
  // ══════════════════════════════════════════════════
  /**
   * 回傳一組完整的 NPC 預設欄位。
   * 在 NPC_DEFS 初始化時用來補齊未明確指定的欄位。
   */
  function _defaultNpcFields() {
    return {
      // 基本（必須由 NPC_DEFS override）
      id:    '',
      name:  '',
      title: '',
      desc:  '',
      role:  'teammate',       // teammate | officer | audience
      baseAffection: 0,

      // ── D.18 訓練協力偏好 ──────────────────────
      // favoredAttr: 'STR' | 'DEX' | 'CON' | 'AGI' | 'WIL' | null
      //   - 只有當玩家訓練「此屬性」時，該 NPC 才提供協力加成
      //   - 命名 NPC 三段門檻：aff≥30 ×1.3 / aff≥60 ×1.6 / aff≥90 ×1.8
      //   - 故事 NPC 可先留 null，待角色定位明確再補
      //   ⚠️ 新增命名 NPC 時請明示 favoredAttr（null 也要明示）
      favoredAttr: null,

      // ── D.19 特性愛憎 ────────────────────────────
      // likedTraits / dislikedTraits: { traitId: intensity(1~3) }
      //   1 = 小偏好（小加成/小懲罰）
      //   2 = 中偏好
      //   3 = 強烈偏好（接近封鎖或大幅加速）
      // 效果在 teammates.modAffection() 套用（見 npc.js 下方）
      likedTraits:    {},
      dislikedTraits: {},

      // ── 成長系統（D.11.5 S3 / S3 NPC 原型） ─────
      archetype:   null,        // power | agile | balanced | tank | berserker
      growthRate:  1.0,         // 每日成長速率倍率
      baseStats:   null,        // { STR, DEX, CON, AGI, WIL, LUK }

      // ── 人格 ───────────────────────────────────
      personality:     null,    // aggressive | cautious | support | loner | cunning
      personalityDesc: null,    // 好感 40 解鎖的文字描述

      // ── 時間軸 ────────────────────────────────
      arriveDay: 1,             // 什麼時候出現在訓練所
      leaveDay:  null,          // 固定離開天數（null = 除非死亡/事件）

      // ── 排程（保留現有欄位） ───────────────────
      schedule: null,           // [{ hours: [...], fields: [...] }]

      // ── 漸進揭露資料（D.11.16） ────────────────
      background: null,         // 好感 ≥80 解鎖：完整背景故事
      secrets:    [],           // 好感 ≥80 解鎖：[{id, text}]
      weaknesses: [],           // 仇恨 ≥40 解鎖：戰術弱點
      fears:      [],           // 仇恨 ≥60 解鎖：恐懼
      hiddenQuestHints: {},     // { '40':'...', '60':'...', '80':'...' }

      // ── 連動系統 ──────────────────────────────
      questlineId: null,        // F4 任務連結
      religion:    null,        // E8 信仰（DEITIES id）
      faction:     null,        // E7 派系
      petReactions:{},          // { petId: +5/-10 }

      // ── 存活狀態（runtime 會變） ──────────────
      alive: true,

      // ── 語音台詞 ──────────────────────────────
      voiceLines: null,         // { greet, win, lose, death }

      // ── 資產（D.11.1） ───────────────────────
      assets: {
        portrait: null,         // 立繪 'asset/image/npc/xxx.webp'
        icon:     null,         // 小頭像
        bgm:      null,         // 遭遇主題曲
        sfx: {
          greet: null,
          death: null,
        },
      },
    };
  }

  // ══════════════════════════════════════════════════
  // NPC 定義（D.11.7 模板 — 每個 NPC 只填該填的）
  // ══════════════════════════════════════════════════
  const NPC_DEFS = {

    // ── 永駐兄弟（D.20 奧蘭主線） ──────────────────
    // 與主角同一天被押進訓練所。磨坊主人獨子，父親為救妹妹把他賣掉。
    // 永久出現（fields.js chance:1.0），永駐同房（Day 1-30），分房後依舊每日在場。
    // 故事主軸：同命兄弟 → 分道揚鑣 → 交會再別 → 最終訣別。
    // 核心張力：他比你弱，卻總想保護你；你越強，他越想替你死。
    orlan: {
      id: 'orlan', name: '奧蘭',
      role: 'teammate',
      title: '同命兄弟',
      desc: '跟你同一輛車被押進來的年輕人。磨坊主人獨子，沒揮過劍。第一夜就伸手對你說「我們一起活下去吧」。',
      baseAffection: 25,
      personality: 'support',
      favoredAttr: 'WIL',   // 🆕 D.18：意志代表，補齊五屬性空缺
      // 🆕 D.19：他最愛善良的人，最怕你變成殘忍的人
      //   coward 只有 1 分 — 他太了解恐懼，不忍心責怪膽小
      //   cruel  3 分   — 他最怕你變成那種人
      likedTraits:    { kindness:3, merciful:3, reliable:2, loyal:2, humble:1 },
      dislikedTraits: { cruel:3, opportunist:2, coward:1, prideful:1 },

      personalityDesc: '主動溫暖，話不多，但該說的話都會先說。笑的時候眼睛先彎起來。',
      arriveDay: 1,

      // ── 完整背景（aff ≥ 80 才解鎖） ──
      background: '磨坊主人獨子。被賣進訓練所前從沒揮過劍。表面說法是「父親欠貴族債務被用他抵押」，真相是妹妹得了血咳症，父親為了籌每月兩次的昂貴藥劑，把他賣了換錢。他不恨，他認為這是對的。他永遠不敢告訴你這件事——怕你覺得他家人狠心。',

      // ── 秘密（aff ≥ 70 才解鎖） ──
      secrets: [
        { id:'sister_truth', text:'他父親沒欠債。妹妹得了血咳症，父親賣他換藥錢。' },
        { id:'mill_smell',   text:'他偶爾還會夢見磨坊的味道。壓碎麥子的陽光味。' },
      ],

      // ── 故事揭露：10 段（5 flavor + 5 event） ──
      storyReveals: [
        // ── Flavor 段：關係圖卡片常駐顯示 ──────────────────
        {
          id:        'orlan_first_night_flavor',
          type:      'flavor',
          affection: 25,
          text:      '他每晚睡前都會說一句「晚安」。即使你從來沒回應。',
        },
        {
          id:        'orlan_bad_joke_flavor',
          type:      'flavor',
          affection: 35,
          text:      '他有一個關於葛拉鐵匠鬍子的笑話。他已經講過三次了。每次都是自己先笑出來——而你每次都不懂笑點在哪。',
        },
        {
          id:        'orlan_mill_memory_flavor',
          type:      'flavor',
          affection: 50,
          text:      '他談到磨坊的時候聲音會變輕。「壓碎的麥子會有一種陽光的味道。」他說。「你這輩子大概沒聞過那個味道。」',
        },
        {
          id:        'orlan_wrist_flavor',
          type:      'flavor',
          affection: 65,
          text:      '他講到家人的時候會不自覺摸左手腕。那裡什麼都沒有——但他摸得很習慣，像那裡本來應該有什麼。',
        },
        {
          id:        'orlan_silent_love_flavor',
          type:      'flavor',
          affection: 80,
          text:      '他把自己的半塊麵包塞給你的那個夜晚，你已經記不清有幾次了。他每次都說同一句：「別說話。明天訓練我不用太多力。」',
        },

        // ── Event 段：事件觸發 / 重複觸發 ──────────────────

        // 1) 第一夜的誓言 — 強制觸發，一次性
        //   🆕 D.21：使用 DialogueModal 重量級對話演出（每句要玩家按 Space 繼續）
        {
          id:        'orlan_first_night_oath',
          type:      'event',
          affection: 0,
          chance:    1.0,
          onceOnly:  true,
          logColor:  '#d9a84f',
          text:      '「……你叫什麼？」牢房裡的男孩問。你告訴他。「我叫奧蘭。磨坊裡來的，沒揮過劍。」他伸出手——在黑暗裡。「我們一起活下去吧。」',
          dialogueLines: [
            { text: '牢房很冷。你蜷在角落，盯著黑暗。' },
            { text: '身邊的另一個奴隸動了動。' },
            { speaker: '???', text: '……你叫什麼？' },
            { text: '一個還沒變聲完全的男孩的聲音。' },
            { text: '你告訴他你的名字。' },
            { speaker: '???', text: '我叫奧蘭。' },
            { speaker: '奧蘭', text: '磨坊裡來的，沒揮過劍。' },
            { speaker: '奧蘭', text: '你呢？是哪裡人？' },
            { text: '奧蘭遲疑了一下，然後伸出手。' },
            { text: '你看不清他的表情——只看見那隻手在黑暗中。' },
            { speaker: '奧蘭', text: '……我們一起活下去吧。' },
          ],
        },

        // 2) 分食麵包 — 低食物時重複觸發
        {
          id:        'orlan_share_bread',
          type:      'event',
          affection: 30,
          chance:    0.40,
          onceOnly:  false,   // 可重複觸發
          text:      '半夜你餓得睡不著。奧蘭翻了個身，把半塊麵包塞進你手裡。「別說話。」他低聲說。「明天訓練我不用太多力。」',
          logColor:  '#c8a878',
        },

        // 3) 那個笑話 — 低心情時重複觸發（重複率刻意高）
        {
          id:        'orlan_bad_joke_event',
          type:      'event',
          affection: 25,
          chance:    0.35,
          onceOnly:  false,
          text:      '「欸。」奧蘭戳你。「你知道為什麼葛拉鐵匠的鬍子那麼長嗎？因為他沒時間刮，怕一刮下去，手裡打的鐵就涼了。」他自己先笑出來。你面無表情。這是這週第幾次了？',
          logColor:  '#b09060',
        },

        // 4) 惡夢的安慰 — 失眠症時觸發
        {
          id:              'orlan_nightmare_comfort',
          type:            'event',
          affection:       50,
          requireAnyAilment:['insomnia_disorder'],
          chance:          0.40,
          onceOnly:        false,
          text:            '你在黑暗中驚醒。奧蘭的手輕輕放在你的肩上。「我也睡不著。」他說。「沒事的——沒事的。」他就那樣陪著你，直到你再次睡著。',
          logColor:        '#8899cc',
        },

        // 5) 妹妹的真相 — 關鍵揭露，一次性
        {
          id:              'orlan_sister_truth_reveal',
          type:            'event',
          affection:       70,
          requireMinAttr:  { WIL: 12 },
          chance:          0.45,
          onceOnly:        true,
          text:            '訓練完奧蘭把你拉到場邊。「我要告訴你一件事。」他開口。「之前跟你講的父親欠債的故事——那是假的。」他停了很久。「妹妹得了血咳症。父親為了救她，把我賣了。」他苦笑。「我不想讓你覺得他家人狠心。」',
          logColor:        '#d9a84f',
        },
      ],
    },

    // ── Fellow gladiators (teammates) ──
    cassius: {
      id: 'cassius', name: '卡西烏斯',
      role: 'teammate',
      title: '老練劍士',
      desc: '在競技場存活超過五年的老兵。話不多，但每句話都值得記住。',
      baseAffection: 10,
      personality: 'loner',
      favoredAttr: 'CON',   // 🆕 D.18：存活 5 年的老兵 — 體質代表
      // 🆕 D.19：老兵看重可靠與耐心，最討厭投機和膽小
      likedTraits:    { reliable:3, patient:2, iron_will:2, humble:1 },
      dislikedTraits: { coward:3, opportunist:2, prideful:2, impulsive:1 },

      personalityDesc: '沉默寡言，但對新人有隱藏的耐心。重承諾，鄙視欺騙。',
      arriveDay: 1,
      // 🆕 D.12 故事揭露系統：範本 NPC
      // 故事主幹：卡西烏斯的戰友馬可死在西牆邊的訓練意外。
      //          他每晚重複做同一個夢——夢到自己沒能及時出手。
      //          枕頭下的符牌是馬可留的，他每晚摩挲它直到睡著。
      storyReveals: [
        // ── Flavor 段：關係圖卡片常駐顯示 ──────────────────────
        {
          id:        'cassius_quiet',
          type:      'flavor',
          affection: 10,
          text:      '他很少說話。每天揮劍的時間永遠比別人多一個小時。',
        },
        {
          id:        'cassius_sleep_issue',
          type:      'flavor',
          affection: 40,
          text:      '最近他夜裡睡得不安穩。你看過他凝視西邊的牆——像在看一個不存在的人。',
        },
        {
          id:        'cassius_charm',
          type:      'flavor',
          affection: 60,
          text:      '他枕頭下似乎壓著一塊老舊的符牌。邊角被磨得發亮，像被人反覆摩挲了幾千次。',
        },
        {
          id:        'cassius_two_names',
          type:      'flavor',
          affection: 80,
          text:      '他願意讓你看他的劍。劍柄內側刻著兩個名字——一個是他的，另一個比他的深得多。',
        },

        // ── Event 段：夜間共鳴觸發（一次性） ────────────────────
        {
          id:              'cassius_whisper_night',
          type:            'event',
          affection:       40,
          requireAnyTrait: ['insomnia_disorder', 'neurotic'],  // 失眠或神經質的人才聽得見
          chance:          0.30,
          onceOnly:        true,
          text:            '深夜裡你聽見他低聲念著一個名字——「馬可」。他念得很慢，像怕那個名字散掉。',
          logColor:        '#8899aa',
        },
        {
          id:              'cassius_shared_silence',
          type:            'event',
          affection:       60,
          requireAnyAilment:['insomnia_disorder'],             // 只給失眠症的人
          chance:          0.50,
          onceOnly:        true,
          text:            '你睜眼時與他對視。兩個失眠者在黑暗中沉默了很久。他先移開眼睛，然後輕輕說：「我也是。」',
          logColor:        '#aa99cc',
        },
        {
          id:              'cassius_charm_touch',
          type:            'event',
          affection:       80,
          requireMinAttr:  { WIL: 15 },                         // 意志夠強才能承接託付
          chance:          0.25,
          onceOnly:        true,
          text:            '他把那塊符牌塞進你手裡。「如果哪天我撐不下去，」他說，「幫我把它扔到西牆外。別問為什麼。」',
          logColor:        '#e8d070',
          grantItem:       'marcoCharm',                        // 下次實作 item 層時會真的給出物品
        },
      ],
    },

    dagiSlave: {
      id: 'dagiSlave', name: '達吉',
      role: 'teammate',
      title: '年輕奴隸',
      desc: '和你一樣剛被賣進來的年輕人。眼神裡還有尚未被磨滅的光。',
      baseAffection: 20,
      personality: 'support',
      favoredAttr: 'DEX',   // 🆕 D.18：標準訓練所唯一的 DEX 協力來源（窮中藏寶）
      // 🆕 D.19：年輕人崇拜仁慈與忠誠，害怕殘忍
      likedTraits:    { merciful:3, kindness:2, loyal:2, reliable:1 },
      dislikedTraits: { cruel:3, opportunist:2, prideful:1 },
      arriveDay: 1,
    },

    ursa: {
      id: 'ursa', name: '烏爾薩',
      role: 'teammate',
      title: '重甲鬥士',
      desc: '身形如牛，性格卻比你想像的溫和。他的拳頭能把人打進地裡。',
      baseAffection: 5,
      personality: 'cautious',
      favoredAttr: 'CON',   // 🆕 D.18：重甲鬥士 — 耐打派（從 STR 調整為更貼合訓練所 CON/WIL 定位）
      // 🆕 D.19：溫和巨漢欣賞善意，討厭恃強凌弱
      likedTraits:    { kindness:2, merciful:2, reliable:2, humble:1 },
      dislikedTraits: { cruel:3, prideful:2, opportunist:1 },
      arriveDay: 1,
    },

    oldSlave: {
      id: 'oldSlave', name: '老篤',
      role: 'teammate',
      title: '垂死老奴',
      desc: '也許再過幾天就會死去。他說他曾是將軍，但沒有人相信他。',
      baseAffection: 30,
      personality: 'loner',
      favoredAttr: 'WIL',   // 🆕 D.18：將軍出身 — 意志代表
      // 🆕 D.19：將軍看重紀律，最恨背叛與衝動
      likedTraits:    { patient:3, iron_will:3, loyal:2, humble:1 },
      dislikedTraits: { opportunist:3, impulsive:2, coward:2 },
      arriveDay: 1,
    },

    // ── Authority figures ──
    prisonGuard: {
      id: 'prisonGuard', name: '獄卒',
      role: 'officer',
      title: '牢房守衛',
      desc: '表情木然，從不多說一個字。手中的鑰匙決定你是否能呼吸新鮮空氣。',
      baseAffection: 0,
      personality: 'cunning',
      // 🆕 D.19：獄卒只認聽話的，討厭反骨
      likedTraits:    { humble:2, patient:1 },
      dislikedTraits: { prideful:3, impulsive:2, opportunist:1 },
    },

    overseer: {
      id: 'overseer', name: '監督官',
      role: 'audience',
      title: '訓練監督',
      schedule: [
        // 14:00-16:00 在訓練場出現，其他時間 → 不強制出現（隨機決定）
        { hours: [14, 16], fields: ['stdTraining'] },
      ],
      desc: '嚴厲、精確、毫無憐憫。他訓練出來的人，要麼成為最強的鬥士，要麼死在訓練場。',
      baseAffection: 0,
      personality: 'aggressive',
      // 🆕 D.19：嚴師愛勤勉鐵意志，恨懶散膽小
      likedTraits:    { iron_will:3, diligence:2, cruel:2, prideful:1 },
      dislikedTraits: { coward:3, merciful:2, impulsive:1 },
    },

    officer: {
      id: 'officer', name: '塔倫長官',
      role: 'audience',
      title: '競技場長官',
      desc: '管理整個競技場的實權人物。他的一個眼神能讓你獲得特權，也能讓你消失。',
      baseAffection: 0,
      personality: 'cunning',
      // 🆕 D.19：存活派的長官 — 最愛耐心可靠，恨衝動投機
      likedTraits:    { reliable:3, patient:3, loyal:2, iron_will:1 },
      dislikedTraits: { impulsive:3, opportunist:3, coward:2, prideful:1 },
    },

    blacksmithGra: {
      id: 'blacksmithGra', name: '葛拉',
      role: 'audience',
      title: '鐵匠',
      desc: '沉默的工匠，打鐵三十年。他打造的武器從未在戰場上折斷——使用者倒是常常折斷。',
      baseAffection: 10,
      personality: 'loner',
      // 🆕 D.19：匠人尊重專注與謙虛，看不起浮誇
      likedTraits:    { diligence:3, patient:2, humble:2 },
      dislikedTraits: { prideful:3, opportunist:2, impulsive:1 },
    },

    melaKook: {
      id: 'melaKook', name: '梅拉',
      role: 'audience',
      title: '廚娘',
      // Phase 1-J：廚房場景已移除，梅拉改為事件觸發出現（用餐事件等）
      desc: '用廚房剩料也能做出讓人流淚的食物。她悄悄多塞給你的那口飯，你永遠記得。',
      baseAffection: 15,
      personality: 'support',
      // 🆕 D.19：廚娘母親般的溫柔，最愛善良的孩子，最厭殘忍
      likedTraits:    { kindness:3, merciful:3, humble:2, reliable:1 },
      dislikedTraits: { cruel:3, prideful:2, opportunist:1 },
    },

    masterArtus: {
      id: 'masterArtus', name: '阿圖斯大人',
      role: 'audience',
      title: '競技場主人',
      desc: '你的所有者。冷靜、理性，將每一個角鬥士視為投資。你的生死，是他帳本上的數字。',
      baseAffection: 0,
      personality: 'cunning',
      // 🆕 D.19：精算的主人 — 最愛能賺錢的殘忍鐵血，最厭軟弱的膽小
      likedTraits:    { cruel:3, reliable:3, iron_will:2, loyal:1 },
      dislikedTraits: { coward:3, merciful:2, opportunist:2, impulsive:1 },
    },

    masterServant: {
      id: 'masterServant', name: '侍從',
      role: 'audience',
      title: '主人的侍從',
      desc: '對主人言聽計從。傳話、監視、記錄——他的眼睛隨時都在。',
      baseAffection: 5,
      personality: 'cautious',
      // 🆕 D.19：侍從鏡像主人的價值觀，強度稍弱
      likedTraits:    { reliable:2, loyal:2, humble:1 },
      dislikedTraits: { coward:2, impulsive:1, opportunist:1 },
    },

  };

  // ══════════════════════════════════════════════════
  // 初始化：為每個 NPC 補齊預設欄位（deep-merge assets）
  // ══════════════════════════════════════════════════
  function _applyDefaults() {
    Object.keys(NPC_DEFS).forEach(id => {
      const npc = NPC_DEFS[id];
      const defaults = _defaultNpcFields();

      // 淺層補齊：只有 npc 沒有的 key 才從 defaults 帶入
      for (const key in defaults) {
        if (npc[key] === undefined) npc[key] = defaults[key];
      }

      // Deep-merge assets（因為 npc.assets 可能只定義了一部分欄位）
      const userAssets = npc.assets || {};
      const defaultAssets = defaults.assets;
      npc.assets = {
        portrait: userAssets.portrait ?? defaultAssets.portrait,
        icon:     userAssets.icon     ?? defaultAssets.icon,
        bgm:      userAssets.bgm      ?? defaultAssets.bgm,
        sfx: {
          ...defaultAssets.sfx,
          ...(userAssets.sfx || {}),
        },
      };
    });
  }

  _applyDefaults();

  // ══════════════════════════════════════════════════
  // Runtime affection state
  // ══════════════════════════════════════════════════
  // Key: npcId, Value: current affection (-100 ~ +100, D.4 仇恨系統)
  const affectionMap = {};

  // D.1.2: legacy key aliases for backward compat with fields.js / 舊存檔
  const AFF_ALIASES = {
    master:     'masterArtus',
    blacksmith: 'blacksmithGra',
    cook:       'melaKook',
    // officer → officer 已是 canonical
  };

  function _resolveId(id) {
    return AFF_ALIASES[id] || id;
  }

  Object.values(NPC_DEFS).forEach(npc => {
    affectionMap[npc.id] = npc.baseAffection;
  });

  /**
   * 取得 NPC 好感度。
   * 範圍 -100 ~ +100（D.4 仇恨系統）。
   * 未見過的 NPC 回傳 0（中立）。
   * 支援 legacy 別名（master/blacksmith/cook）。
   */
  function getAffection(npcId) {
    const id = _resolveId(npcId);
    return affectionMap[id] || 0;
  }

  /**
   * 🆕 D.19：依玩家特性 vs NPC 愛憎清單，計算好感變動倍率。
   *
   * 規則（強度 1~3）：
   *   計算「喜好淨分」 = Σ(liked intensity) − Σ(disliked intensity)
   *   淨分 →  +3    +2    +1    0     -1    -2    -3(含以下)
   *   倍率 → ×1.5  ×1.3  ×1.15 ×1.0  ×0.8  ×0.5  ×0.3
   *
   * 只對正向 delta（好感成長）作用；負向（仇恨增加）不受影響。
   */
  function _computeTraitAffMult(npc) {
    const player = (typeof Stats !== 'undefined') ? Stats.player : null;
    if (!player || !Array.isArray(player.traits) || !npc) return 1.0;
    const liked    = npc.likedTraits    || {};
    const disliked = npc.dislikedTraits || {};
    let score = 0;
    player.traits.forEach(tid => {
      if (liked[tid])    score += liked[tid];
      if (disliked[tid]) score -= disliked[tid];
    });
    if (score >= 3)  return 1.5;
    if (score === 2) return 1.3;
    if (score === 1) return 1.15;
    if (score === 0) return 1.0;
    if (score === -1) return 0.8;
    if (score === -2) return 0.5;
    return 0.3; // ≤ -3
  }

  /**
   * 修改 NPC 好感度。
   * D.1.2 更新：允許負值（-100 ~ +100）。
   * 負值 = 仇恨，用於 D.4 仇恨系統。
   * D.19 更新：正向 delta 會乘上 trait 愛憎倍率。
   */
  function modAffection(npcId, delta) {
    const id  = _resolveId(npcId);
    const npc = NPC_DEFS[id];
    // 寬厚特性：正向好感成長速度 +20%
    if (delta > 0 && typeof Stats !== 'undefined' && Stats.player.traits?.includes('kindness')) {
      delta = delta * 1.2;
    }
    // 🆕 D.19：特性愛憎倍率（只作用於正向）
    if (delta > 0 && npc) {
      const mult = _computeTraitAffMult(npc);
      if (mult !== 1.0) {
        delta = delta * mult;
      }
    }
    delta = Math.round(delta);
    affectionMap[id] = Math.max(-100, Math.min(100, (affectionMap[id] || 0) + delta));
  }

  /**
   * 取得好感度等級名稱（9 級，D.4）。
   */
  function getAffectionLevel(npcId) {
    const v = getAffection(npcId);
    if (v >= 90)   return 'loyal';       // 忠誠
    if (v >= 70)   return 'devoted';     // 崇敬
    if (v >= 40)   return 'friendly';    // 友好
    if (v >= 10)   return 'acquainted';  // 認識
    if (v >= -9)   return 'neutral';     // 中立
    if (v >= -29)  return 'annoyed';     // 不悅
    if (v >= -59)  return 'disliked';    // 厭惡
    if (v >= -89)  return 'hated';       // 憎恨
    return 'nemesis';                    // 不共戴天
  }

  function getNPC(npcId) {
    const id = _resolveId(npcId);
    return NPC_DEFS[id] || null;
  }

  function getAllAffection() {
    return { ...affectionMap };
  }

  function setAllAffection(map) {
    if (!map) return;
    Object.keys(affectionMap).forEach(id => {
      if (map[id] !== undefined) affectionMap[id] = map[id];
    });
  }

  /**
   * D.1.5: 取得所有 NPC 定義（含擴展後的欄位）。
   * 未來 ELITE_DEFS 會另外建立，目前用這個遍歷 NPC 百科等 UI。
   */
  function getAllNPCs() {
    return NPC_DEFS;
  }

  // ══════════════════════════════════════════════════
  // 🆕 D.12 故事揭露系統：helper 函式
  // ══════════════════════════════════════════════════

  /**
   * 檢查一段 reveal 是否通過所有條件。
   * @param {object} reveal
   * @param {object} player — Stats.player
   * @param {number} currentAff — 當前好感度
   */
  function _revealPassesConditions(reveal, player, currentAff) {
    if (!reveal) return false;
    if ((reveal.affection || 0) > currentAff) return false;

    if (reveal.requireAnyTrait) {
      const traits = player.traits || [];
      if (!reveal.requireAnyTrait.some(t => traits.includes(t))) return false;
    }
    if (reveal.requireAnyAilment) {
      const ailments = player.ailments || [];
      if (!reveal.requireAnyAilment.some(a => ailments.includes(a))) return false;
    }
    if (reveal.requireMinAttr) {
      for (const [attr, min] of Object.entries(reveal.requireMinAttr)) {
        const v = (typeof Stats !== 'undefined' && Stats.eff) ? Stats.eff(attr) : (player[attr] || 0);
        if (v < min) return false;
      }
    }
    if (reveal.requireFlag && typeof Flags !== 'undefined' && !Flags.has(reveal.requireFlag)) return false;
    if (reveal.requireOrigin && player.origin !== reveal.requireOrigin) return false;
    // requireItemTag 留待 D.14 實作，先跳過
    return true;
  }

  /**
   * 取得此 NPC 當前可見的最高段 flavor 文字。
   * 條件都要符合：好感門檻 + requireAnyTrait/Ailment/MinAttr/Flag/Origin。
   * 會選出 affection 最高的那一段（更深入的描述優先）。
   *
   * @param {string} npcId
   * @param {object} [player] — 預設用 Stats.player
   * @returns {string|null}
   */
  function getVisibleFlavor(npcId, player) {
    const id  = _resolveId(npcId);
    const npc = NPC_DEFS[id];
    if (!npc || !Array.isArray(npc.storyReveals)) return null;
    const p = player || (typeof Stats !== 'undefined' ? Stats.player : null);
    if (!p) return null;

    const currentAff = getAffection(id);
    const flavors = npc.storyReveals
      .filter(r => (r.type || 'flavor') === 'flavor')
      .filter(r => _revealPassesConditions(r, p, currentAff))
      .sort((a, b) => (b.affection || 0) - (a.affection || 0));  // 最高門檻優先
    return flavors.length > 0 ? flavors[0].text : null;
  }

  /**
   * 取得所有符合條件的 event 型 reveal（尚未觸發過的）。
   * 由事件掃描器呼叫（_scanStoryEvents）。
   *
   * @param {object} [player] — 預設用 Stats.player
   * @returns {Array<{ npcId, reveal }>}
   */
  function getPendingStoryEvents(player) {
    const p = player || (typeof Stats !== 'undefined' ? Stats.player : null);
    if (!p) return [];
    const seen = new Set(p.seenReveals || []);
    const pending = [];

    Object.values(NPC_DEFS).forEach(npc => {
      if (!Array.isArray(npc.storyReveals)) return;
      const aff = getAffection(npc.id);
      npc.storyReveals.forEach(r => {
        if ((r.type || 'flavor') !== 'event') return;
        if (seen.has(r.id)) return;
        if (!_revealPassesConditions(r, p, aff)) return;
        pending.push({ npcId: npc.id, reveal: r });
      });
    });
    return pending;
  }

  return {
    NPC_DEFS,
    getAffection,
    modAffection,
    getAffectionLevel,   // D.1.2 / D.4 仇恨系統
    getNPC,
    getAllNPCs,          // D.1.5
    getAllAffection,
    setAllAffection,
    // 🆕 D.12 故事揭露系統
    getVisibleFlavor,
    getPendingStoryEvents,
  };
})();
