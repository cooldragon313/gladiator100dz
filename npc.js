/**
 * npc.js — NPC definitions and affection tracking
 *
 * D.1.5: NPC 結構擴展為完整模板（見 DESIGN.md D.11.7）
 * 加入所有未來系統需要的欄位（成長/人格/漸進揭露/連動/資產）。
 * 每個 NPC 只需填寫該填的欄位，其他由 _applyDefaults() 自動補齊。
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

    // ── Fellow gladiators (teammates) ──
    cassius: {
      id: 'cassius', name: '卡西烏斯',
      role: 'teammate',
      title: '老練劍士',
      desc: '在競技場存活超過五年的老兵。話不多，但每句話都值得記住。',
      baseAffection: 10,
      // 以下為範例填充（其他 NPC 先留空，逐步補齊）
      personality: 'loner',
      personalityDesc: '沉默寡言，但對新人有隱藏的耐心。重承諾，鄙視欺騙。',
      arriveDay: 1,
      hiddenQuestHints: {
        '40': '他凝視西邊的牆壁，像在看什麼不存在的東西。',
        '60': '他枕下似乎藏著一塊符牌。',
        '80': '「老兵的遺憾」下次交談將觸發。',
      },
    },

    dagiSlave: {
      id: 'dagiSlave', name: '達吉',
      role: 'teammate',
      title: '年輕奴隸',
      desc: '和你一樣剛被賣進來的年輕人。眼神裡還有尚未被磨滅的光。',
      baseAffection: 20,
      personality: 'support',
      arriveDay: 1,
    },

    ursa: {
      id: 'ursa', name: '烏爾薩',
      role: 'teammate',
      title: '重甲鬥士',
      desc: '身形如牛，性格卻比你想像的溫和。他的拳頭能把人打進地裡。',
      baseAffection: 5,
      personality: 'cautious',
      arriveDay: 1,
    },

    oldSlave: {
      id: 'oldSlave', name: '老篤',
      role: 'teammate',
      title: '垂死老奴',
      desc: '也許再過幾天就會死去。他說他曾是將軍，但沒有人相信他。',
      baseAffection: 30,
      personality: 'loner',
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
    },

    overseer: {
      id: 'overseer', name: '監督官',
      role: 'audience',
      title: '訓練監督',
      schedule: [
        // 14:00-16:00 在訓練場出現，其他時間 → 不強制出現（隨機決定）
        { hours: [14, 16], fields: ['oldTraining', 'stdTraining'] },
      ],
      desc: '嚴厲、精確、毫無憐憫。他訓練出來的人，要麼成為最強的鬥士，要麼死在訓練場。',
      baseAffection: 0,
      personality: 'aggressive',
    },

    officer: {
      id: 'officer', name: '塔倫長官',
      role: 'audience',
      title: '競技場長官',
      desc: '管理整個競技場的實權人物。他的一個眼神能讓你獲得特權，也能讓你消失。',
      baseAffection: 0,
      personality: 'cunning',
    },

    blacksmithGra: {
      id: 'blacksmithGra', name: '葛拉',
      role: 'audience',
      title: '鐵匠',
      desc: '沉默的工匠，打鐵三十年。他打造的武器從未在戰場上折斷——使用者倒是常常折斷。',
      baseAffection: 10,
      personality: 'loner',
    },

    melaKook: {
      id: 'melaKook', name: '梅拉',
      role: 'audience',
      title: '廚娘',
      schedule: [
        // 06:00-08:00、12:00-14:00、18:00-20:00 出現
        // 其他時段 → 不強制出現（隨機決定）
        { hours: [6, 12, 18], fields: ['kitchen'] },
      ],
      desc: '用廚房剩料也能做出讓人流淚的食物。她悄悄多塞給你的那口飯，你永遠記得。',
      baseAffection: 15,
      personality: 'support',
    },

    masterArtus: {
      id: 'masterArtus', name: '阿圖斯大人',
      role: 'audience',
      title: '競技場主人',
      desc: '你的所有者。冷靜、理性，將每一個角鬥士視為投資。你的生死，是他帳本上的數字。',
      baseAffection: 0,
      personality: 'cunning',
    },

    masterServant: {
      id: 'masterServant', name: '侍從',
      role: 'audience',
      title: '主人的侍從',
      desc: '對主人言聽計從。傳話、監視、記錄——他的眼睛隨時都在。',
      baseAffection: 5,
      personality: 'cautious',
    },

    // ⚠️ TEST_ONLY — 協力系統測試用，正式版刪除 ────────────
    test1: { id:'test1', name:'路人甲一', role:'teammate', title:'測試角色', baseAffection:65,
      schedule:[{ fields:['stdTraining','oldTraining'], hours:[6,8,10,12,14,16,18,20] }] },
    test2: { id:'test2', name:'路人甲二', role:'teammate', title:'測試角色', baseAffection:65,
      schedule:[{ fields:['stdTraining','oldTraining'], hours:[6,8,10,12,14,16,18,20] }] },
    test3: { id:'test3', name:'路人甲三', role:'teammate', title:'測試角色', baseAffection:65,
      schedule:[{ fields:['stdTraining','oldTraining'], hours:[6,8,10,12,14,16,18,20] }] },
    test4: { id:'test4', name:'路人甲四', role:'teammate', title:'測試角色', baseAffection:65,
      schedule:[{ fields:['stdTraining','oldTraining'], hours:[6,8,10,12,14,16,18,20] }] },
    test5: { id:'test5', name:'路人甲五', role:'teammate', title:'測試角色', baseAffection:65,
      schedule:[{ fields:['stdTraining','oldTraining'], hours:[6,8,10,12,14,16,18,20] }] },
    test6: { id:'test6', name:'路人甲六', role:'teammate', title:'測試角色', baseAffection:65,
      schedule:[{ fields:['stdTraining','oldTraining'], hours:[6,8,10,12,14,16,18,20] }] },
    // ⚠️ TEST_ONLY END ─────────────────────────────────────
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
   * 修改 NPC 好感度。
   * D.1.2 更新：允許負值（-100 ~ +100）。
   * 負值 = 仇恨，用於 D.4 仇恨系統。
   */
  function modAffection(npcId, delta) {
    const id = _resolveId(npcId);
    // 寬厚特性：正向好感成長速度 +20%
    if (delta > 0 && typeof Stats !== 'undefined' && Stats.player.traits?.includes('kindness')) {
      delta = Math.round(delta * 1.2);
    }
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

  return {
    NPC_DEFS,
    getAffection,
    modAffection,
    getAffectionLevel,   // D.1.2 / D.4 仇恨系統
    getNPC,
    getAllNPCs,          // D.1.5
    getAllAffection,
    setAllAffection,
  };
})();
