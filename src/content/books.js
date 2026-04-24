/**
 * books.js — 讀書系統書本資料（2026-04-19）
 *
 * 設計對應：docs/systems/reading.md + docs/systems/books-catalog.md
 *
 * 五大分類：
 *   literacy   識字本       推進見識 + 傻福衰退
 *   memoir     傳記 / 哲學   推進見識 + 獲得特性
 *   skill      技能秘術     獲得戰鬥技能（不推見識）
 *   blueprint  藍圖         觸發鍛造 / 醫生事件
 *   map        藏寶 / 秘密   觸發地點探索 / 陰謀任務
 *
 * 文字書 vs 非文字書：
 *   文字書（literacy + memoir）— 會推進見識，影響傻福衰退
 *   非文字書（skill + blueprint + map）— 不推進見識，傻福玩家可安心讀
 */
const Books = (() => {

  // CLAUDE.md 第 12 條：bare addLog 在外部模組是 ReferenceError
  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    } else {
      console.warn('[Books] _log: no addLog available', text);
    }
  }

  const BOOK_DEFS = {

    // ═════════════════════════════════════════
    // 識字本（Literacy）— 3 本
    // ═════════════════════════════════════════

    children_reader: {
      id: 'children_reader',
      name: '《百字蒙書》',
      type: 'literacy',
      nights: 6,
      discernmentGain: 2,
      minDiscernment: 0,
      flavor: '手指沾口水，一個字一個字指著讀。',
      onRead: {
        effects: [
          { type: 'attr', key: 'WIL', delta: 1 },
          { type: 'discernment', delta: 2 },
          { type: 'flag', key: 'read_children_reader' },
        ],
      },
    },

    common_words_3000: {
      id: 'common_words_3000',
      name: '《三千常用字》',
      type: 'literacy',
      nights: 8,
      discernmentGain: 3,
      minDiscernment: 2,
      flavor: '翻過蒙書之後，下一本。字變難了。',
      onRead: {
        effects: [
          { type: 'attr', key: 'WIL', delta: 2 },
          { type: 'discernment', delta: 3 },
          { type: 'flag', key: 'read_common_words' },
        ],
        grantTrait: 'literate',  // 若還沒識字就獲得
      },
    },

    merchant_ledger: {
      id: 'merchant_ledger',
      name: '《商賈帳本要義》',
      type: 'literacy',
      nights: 5,
      discernmentGain: 1,
      minDiscernment: 5,
      flavor: '主人說，能讀帳的奴隸比單純能打的值三倍。',
      onRead: {
        effects: [
          { type: 'attr', key: 'WIL', delta: 1 },
          { type: 'discernment', delta: 1 },
          { type: 'money', delta: 50 },
          { type: 'flag', key: 'can_read_ledger' },
        ],
      },
    },

    // ═════════════════════════════════════════
    // 傳記 / 哲學（Memoir）— 3 本
    // ═════════════════════════════════════════

    old_general_memoir: {
      id: 'old_general_memoir',
      name: '《老將軍回憶錄》',
      type: 'memoir',
      nights: 7,
      discernmentGain: 1,
      minDiscernment: 3,
      flavor: '一個老人寫的仗。他活下來了 — 靠什麼？',
      onRead: {
        effects: [
          { type: 'discernment', delta: 1 },
          { type: 'flag', key: 'read_general_memoir' },
        ],
        grantTrait: 'iron_will',
      },
    },

    odysseus_tale: {
      id: 'odysseus_tale',
      name: '《奧德修斯傳》',
      type: 'memoir',
      nights: 8,
      discernmentGain: 2,
      minDiscernment: 4,
      flavor: '一個靠智慧而非力量回家的人。',
      onRead: {
        effects: [
          { type: 'discernment', delta: 2 },
          { type: 'flag', key: 'read_odysseus' },
        ],
        grantTrait: 'cunning',
      },
    },

    martyr_saint_life: {
      id: 'martyr_saint_life',
      name: '《殉道聖者列傳》',
      type: 'memoir',
      nights: 6,
      discernmentGain: 1,
      minDiscernment: 3,
      flavor: '為信念而死的人，他們後悔過嗎？',
      onRead: {
        effects: [
          { type: 'discernment', delta: 1 },
          { type: 'moral', axis: 'pride', side: 'positive', weight: 1 },
          { type: 'flag', key: 'read_martyr' },
        ],
        grantTrait: 'faithful',
      },
    },

    // ═════════════════════════════════════════
    // 技能秘術（Skill）— 3 本（無見識門檻）
    // ═════════════════════════════════════════

    family_sword_manual: {
      id: 'family_sword_manual',
      name: '《林氏家傳劍譜》',
      type: 'skill',
      nights: 5,
      discernmentGain: 0,
      minDiscernment: 0,
      flavor: '你家族留給你的最後一件東西。紙張發黃，字跡模糊。',
      onRead: {
        effects: [
          { type: 'flag', key: 'read_family_manual' },
        ],
        grantSkill: 'sweep_slash',
      },
    },

    berserker_fist_scroll: {
      id: 'berserker_fist_scroll',
      name: '《血怒拳譜》',
      type: 'skill',
      nights: 4,
      discernmentGain: 0,
      minDiscernment: 0,
      flavor: '字少圖多。翻到後面全是沾血的拳印。',
      onRead: {
        effects: [
          { type: 'moral', axis: 'mercy', side: 'negative', weight: 1 },
          { type: 'flag', key: 'read_berserker' },
        ],
        grantSkill: 'berserker_rage',
      },
    },

    shield_wall_essay: {
      id: 'shield_wall_essay',
      name: '《盾牆心訣》',
      type: 'skill',
      nights: 5,
      discernmentGain: 0,
      minDiscernment: 0,
      flavor: '一個活過二十年的老兵寫的。盾不是擋，是問候。',
      onRead: {
        effects: [
          { type: 'flag', key: 'read_shield_wall' },
        ],
        grantSkill: 'shield_wall',
      },
    },

    // ═════════════════════════════════════════
    // 藍圖（Blueprint）— 2 本
    // ═════════════════════════════════════════

    twin_blade_schematic: {
      id: 'twin_blade_schematic',
      name: '《雙刃合鑄法殘篇》',
      type: 'blueprint',
      nights: 4,
      discernmentGain: 0,
      minDiscernment: 5,
      flavor: '兩把破劍熔在一起 — 鐵匠說這是可能的。',
      onRead: {
        effects: [
          { type: 'flag', key: 'knows_twin_blade_recipe' },
        ],
        triggerEvent: 'blacksmith_twinblade_offer',
      },
    },

    herbal_recipe_tome: {
      id: 'herbal_recipe_tome',
      name: '《草藥配方集》',
      type: 'blueprint',
      nights: 5,
      discernmentGain: 0,
      minDiscernment: 5,
      flavor: '老默的筆記。字跡很亂，但方子清楚。',
      onRead: {
        effects: [
          { type: 'flag', key: 'knows_herbal_recipes' },
        ],
        triggerEvent: 'doctor_mo_herbal_offer',
      },
    },

    // ═════════════════════════════════════════
    // 藏寶圖 / 秘密（Map）— 2 本
    // ═════════════════════════════════════════

    red_cliff_treasure_map: {
      id: 'red_cliff_treasure_map',
      name: '《赤崖藏寶圖殘片》',
      type: 'map',
      nights: 3,
      discernmentGain: 0,
      minDiscernment: 8,
      flavor: '奧蘭塞給你這張紙 — 他的眼睛在發光。',
      onRead: {
        effects: [
          { type: 'flag', key: 'has_red_cliff_map' },
        ],
        triggerEvent: 'red_cliff_expedition',
      },
    },

    master_son_plot: {
      id: 'master_son_plot',
      name: '《塔倫少主密函》',
      type: 'map',
      nights: 4,
      discernmentGain: 0,
      minDiscernment: 10,
      flavor: '一封不該被你看到的信。裡面有計畫。',
      onRead: {
        effects: [
          { type: 'flag', key: 'knows_heir_plot' },
        ],
        triggerEvent: 'master_heir_choice',
      },
    },

  };

  // ═════════════════════════════════════════
  // 讀書流程 API
  // ═════════════════════════════════════════

  /**
   * 玩家獲得一本書。加到書櫃（上限 5）。
   * 若書櫃已滿，回傳 'full'；已讀過回傳 'already_read'；成功回傳 'added'。
   */
  function grantBook(bookId) {
    const p = Stats.player;
    const def = BOOK_DEFS[bookId];
    if (!def) return 'not_found';
    if (!Array.isArray(p.readBooks)) p.readBooks = [];
    if (!Array.isArray(p.bookshelf)) p.bookshelf = [];
    if (p.readBooks.includes(bookId)) return 'already_read';
    if (p.bookshelf.some(b => b.id === bookId)) return 'already_in_shelf';
    if (p.bookshelf.length >= 5) return 'full';
    p.bookshelf.push({ id: bookId, progress: 0, nights: def.nights });
    _log(`📖 你獲得了《${def.name.replace(/[《》]/g, '')}》。`, '#99bbdd', true);
    return 'added';
  }

  /**
   * 檢查見識門檻。若不符，回傳 false。
   */
  function canRead(bookId) {
    const p = Stats.player;
    const def = BOOK_DEFS[bookId];
    if (!def) return false;
    const d = p.discernment || 0;
    return d >= (def.minDiscernment || 0);
  }

  /**
   * 檢查文字書 / 非文字書。
   */
  function isTextBook(bookId) {
    const def = BOOK_DEFS[bookId];
    if (!def) return false;
    return def.type === 'literacy' || def.type === 'memoir';
  }

  /**
   * 推進單一本書的閱讀進度（睡前讀書時呼叫）。
   * @param {string} bookId
   * @param {number} mult 進度倍率（專心書 1.0 / 貪多嚼不爛 < 1.0）
   * @returns {object} { finished, newProgress, totalNights }
   */
  function advanceReading(bookId, mult = 1.0) {
    const p = Stats.player;
    const entry = (p.bookshelf || []).find(b => b.id === bookId);
    if (!entry) return { finished: false };

    // 見識門檻檢查（以防書被 grant 時沒檢查）
    if (!canRead(bookId)) {
      _log(`《${BOOK_DEFS[bookId].name.replace(/[《》]/g, '')}》太深奧了，你還看不懂。`, '#aa8866', false);
      return { finished: false, blocked: true };
    }

    // 讀書速度倍率（見識越高越快）
    const speedMult = (typeof Stats.getReadingSpeedMult === 'function') ? Stats.getReadingSpeedMult() : 1.0;
    const progressGain = mult * (1 / speedMult);  // mult * 有效倍率（見識高 1/speedMult 大）

    entry.progress = (entry.progress || 0) + progressGain;
    const done = entry.progress >= entry.nights;

    if (done) {
      return completeBook(bookId);
    }
    return { finished: false, newProgress: entry.progress, totalNights: entry.nights };
  }

  /**
   * 讀完一本書，觸發 onRead 效果。
   */
  function completeBook(bookId) {
    const p = Stats.player;
    const def = BOOK_DEFS[bookId];
    if (!def) return { finished: false };

    // 從書櫃移除
    if (Array.isArray(p.bookshelf)) {
      p.bookshelf = p.bookshelf.filter(b => b.id !== bookId);
    }
    // 清除專心書（若正是這本）
    if (p.focusBookId === bookId) p.focusBookId = null;
    // 加入已讀清單
    if (!Array.isArray(p.readBooks)) p.readBooks = [];
    if (!p.readBooks.includes(bookId)) p.readBooks.push(bookId);

    // Stage 過場
    if (typeof Stage !== 'undefined' && typeof Stage.playEvent === 'function') {
      const iconMap = {
        literacy:  '📖',
        memoir:    '📜',
        skill:     '⚔',
        blueprint: '🔨',
        map:       '🗺️',
      };
      Stage.playEvent({
        title: `讀完 ${def.name}`,
        icon:  iconMap[def.type] || '📖',
        lines: [def.flavor],
        color: '#d4c68a',
      });
    }

    // 套用 onRead 效果
    if (def.onRead) {
      if (Array.isArray(def.onRead.effects) && typeof Effects !== 'undefined') {
        Effects.apply(def.onRead.effects);
      }
      // 授予特性（若玩家沒有）
      if (def.onRead.grantTrait) {
        if (!Array.isArray(p.traits)) p.traits = [];
        if (!p.traits.includes(def.onRead.grantTrait)) {
          p.traits.push(def.onRead.grantTrait);
          const tdef = (typeof Config !== 'undefined' && Config.TRAIT_DEFS) ? Config.TRAIT_DEFS[def.onRead.grantTrait] : null;
          if (tdef) {
            _log(`✦ 你獲得了新的特性：【${tdef.name}】`, '#88cc77', true);
          }
        }
      }
      // 授予技能
      if (def.onRead.grantSkill && typeof Stats.learnSkill === 'function') {
        Stats.learnSkill(def.onRead.grantSkill);
        _log(`⚔ 你領悟了新招式。`, '#ccaa55', true);
      }
      // 觸發後續事件（延遲 N 天內機率觸發）
      if (def.onRead.triggerEvent && typeof Flags !== 'undefined') {
        Flags.set('pending_event_' + def.onRead.triggerEvent, true);
      }
    }

    // 傻福階段檢查（文字書才會推見識，modDiscernment 內會自動判定）
    // 半醒觸發時的警告對白在 reading.js 處理

    return { finished: true, bookId, def };
  }

  /**
   * 取得書本定義。
   */
  function get(bookId) {
    return BOOK_DEFS[bookId] || null;
  }

  /**
   * 取得所有書 ID（for debug）。
   */
  function listAll() {
    return Object.keys(BOOK_DEFS);
  }

  return {
    BOOK_DEFS,
    grantBook,
    canRead,
    isTextBook,
    advanceReading,
    completeBook,
    get,
    listAll,
  };
})();
