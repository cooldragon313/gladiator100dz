/**
 * events.js — Event system (scene events, random events, story triggers)
 * Expand each event with choices + consequences as the game grows.
 */
const Events = (() => {

  const EVENT_POOL = {
    // ── Random field events ──────────────────────────────
    stumble: {
      id: 'stumble',
      trigger: 'random',
      weight: 10,
      text: '你踩到一塊鬆動的石板，踉蹌了一下。腳踝隱隱作痛。',
      effects: [{ type: 'vital', key: 'stamina', delta: -5 }],
    },
    foundRation: {
      id: 'foundRation',
      trigger: 'random',
      weight: 8,
      text: '地板縫隙裡藏著半塊硬麵包，不知道是誰留下的。你迅速吞下。',
      effects: [{ type: 'vital', key: 'food', delta: 10 }],
    },
    guardInsult: {
      id: 'guardInsult',
      trigger: 'random',
      weight: 12,
      text: '一名獄卒路過，冷笑著對你說了幾句難聽的話。你低下頭，忍住了。',
      effects: [{ type: 'vital', key: 'mood', delta: -8 }],
    },
    crowdCheer: {
      id: 'crowdCheer',
      trigger: 'random',
      weight: 5,
      text: '遠處傳來觀眾的呼喊聲，某場鬥技正在進行。那聲音讓你腎上腺素微微上升。',
      effects: [{ type: 'vital', key: 'mood', delta: 5 }],
    },
    nightmares: {
      id: 'nightmares',
      trigger: 'random',
      weight: 7,
      text: '夜裡做了噩夢，夢中全是血與沙土。醒來時全身僵硬，神情恍惚。',
      effects: [
        { type: 'vital', key: 'mood',    delta: -10 },
        { type: 'vital', key: 'stamina', delta: -5  },
      ],
    },
  };

  /**
   * Roll a random event weighted by `weight`.
   * Returns an event object or null.
   */
  function rollRandom() {
    const pool = Object.values(EVENT_POOL).filter(e => e.trigger === 'random');
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    for (const ev of pool) {
      r -= ev.weight;
      if (r <= 0) return ev;
    }
    return null;
  }

  /**
   * Apply an event's effects to the game state.
   *
   * D.1.9 更新：現在委派給統一的 Effects.apply()。
   * 保留此函式作為向下相容的入口，但建議直接使用 Effects.apply(ev.effects)。
   *
   * @param {object} ev         - event object
   * @param {object} [statsRef] - 舊 API 留存（不再使用），保留參數簽名避免呼叫端壞掉
   */
  function applyEvent(ev, statsRef) {
    if (!ev || !ev.effects) return;
    if (typeof Effects !== 'undefined') {
      Effects.apply(ev.effects, { source: 'event:' + (ev.id || 'legacy') });
    } else {
      // Fallback：Effects 未載入時的最小實作（理論上不會發生）
      const s = statsRef || Stats;
      ev.effects.forEach(eff => {
        if (eff.type === 'vital') s.modVital(eff.key, eff.delta);
        if (eff.type === 'fame')  s.modFame(eff.delta);
        if (eff.type === 'attr')  s.modAttr(eff.key, eff.delta);
      });
    }
  }

  // ── Timeline Events (百日條) ──────────────────────────
  /**
   * D.1.10 重構：從「天數 → 單一事件」改為「事件池 + 條件篩選」。
   *
   * 每個條目欄位：
   *   day         : 天數（必須）
   *   priority    : 優先度（多個事件符合條件時，高者勝；預設 10）
   *   conditions  : 觸發條件（見 _matchConditions）
   *   icon/iconColor/name/type/forced/forcedField/forcedNPCs/opponent/actionLabel/logText
   *
   * conditions 支援的鍵：
   *   flag       : 'x' or ['x','y']（必須全部為 true）
   *   flagNot    : 同上（必須全部為 false）
   *   origin     : 'farmBoy' （玩家背景必須是這個）
   *   originNot  : 'farmBoy' （玩家背景不能是這個）
   *   facility   : 訓練所 ID
   *   worldState : 'warTime' / 'plague' / ...
   *   worldStateNot: 同上
   *   minFame    : 最低名聲
   *   maxFame    : 最高名聲
   *   minDay     : 最低天數（通常與 day 一致）
   *
   * 範例（未來可加入）：
   *   { day: 5, priority: 20, conditions: { worldState: 'warTime' },
   *     id: 'trial_war', ... }  // 戰亂時版本
   *   { day: 5, priority: 10, conditions: {},
   *     id: 'trial', ... }      // 和平預設版本
   */
  const TIMELINE_EVENTS = [
    // Day 5：基礎考驗（通用）
    {
      day: 5,
      priority: 10,
      conditions: {},
      id: 'trial',
      name: '基礎考驗',
      icon: '⚔',
      iconColor: '#cc7700',
      type: 'forced_battle',
      forced: true,
      forcedField: 'oldTraining',
      forcedNPCs: {
        teammates: ['cassius', 'dagiSlave', 'ursa', 'oldSlave'],
        audience:  ['officer', 'masterArtus'],
      },
      opponent: 'slaveRookie',
      actionLabel: '進入考驗',
      logText: '訓練場的沙地今天格外安靜。\n長官站在觀台上，主人也親自到場。\n這不是平常的練習——今天是你第一次真正的考驗。\n贏，才能繼續走下去。',
    },

    // Day 50：大型競技（通用）
    {
      day: 50,
      priority: 10,
      conditions: {},
      id: 'major_arena',
      name: '大型競技',
      icon: '★',
      iconColor: '#d4af37',
      type: 'forced_battle',
      forced: true,
      forcedField: 'stdTraining',
      forcedNPCs: {
        teammates: ['cassius', 'ursa'],
        audience:  ['officer', 'masterArtus', 'overseer'],
      },
      opponent: 'gladiatorB',
      actionLabel: '踏上沙場',
      logText: '第五十天。整個競技場都動員了起來。\n領主的使者也出現在觀台上，這場競技不只是娛樂。\n你的名字已傳出這片沙地——今天，你要讓更多人記住它。',
    },

    // Day 75：宿敵會戰（通用）
    {
      day: 75,
      priority: 10,
      conditions: {},
      id: 'rival_battle',
      name: '宿敵會戰',
      icon: '⚔',
      iconColor: '#c0392b',
      type: 'forced_battle',
      forced: true,
      forcedField: 'stdTraining',
      forcedNPCs: {
        teammates: ['cassius'],
        audience:  ['officer', 'masterArtus'],
      },
      opponent: 'arenaVet',
      actionLabel: '迎戰宿敵',
      logText: '你知道這一天遲早會來。\n那個一直在暗中觀察你的人——今天終於走上了對面。\n沒有退路，沒有第二次機會。\n贏，或者死。',
    },

    // Day 100：萬骸祭（終局）
    {
      day: 100,
      priority: 10,
      conditions: {},
      id: 'final_festival',
      name: '萬骸祭',
      icon: '🔥',
      iconColor: '#8b0000',
      type: 'final',
      forced: true,
      forcedField: 'stdTraining',
      forcedNPCs: {
        teammates: ['cassius', 'dagiSlave', 'ursa'],
        audience:  ['officer', 'masterArtus', 'overseer'],
      },
      opponent: 'champion',
      actionLabel: '踏入萬骸祭',
      logText: '一百天。你活過了一百天。\n萬骸祭的號角已然吹響，整個城市都在震顫。\n這是最後一場。\n勝者得到一切——敗者化作萬骸祭的祭品。',
    },
  ];

  // ── Timeline condition matcher ────────────────────────
  /**
   * 檢查條件是否符合當前遊戲狀態。
   * 所有鍵都是 AND 關係（全部必須符合才算 pass）。
   */
  function _matchConditions(cond) {
    if (!cond || typeof cond !== 'object') return true;

    const p = (typeof Stats !== 'undefined') ? Stats.player : null;

    // flag / flagNot（支援字串或陣列）
    if (cond.flag && typeof Flags !== 'undefined') {
      const flags = Array.isArray(cond.flag) ? cond.flag : [cond.flag];
      if (!Flags.hasAll(flags)) return false;
    }
    if (cond.flagNot && typeof Flags !== 'undefined') {
      const flags = Array.isArray(cond.flagNot) ? cond.flagNot : [cond.flagNot];
      if (!Flags.hasNone(flags)) return false;
    }

    // 身分
    if (cond.origin    && p && p.origin   !== cond.origin)    return false;
    if (cond.originNot && p && p.origin   === cond.originNot) return false;
    if (cond.facility  && p && p.facility !== cond.facility)  return false;

    // 世界狀態（來自 GameState）
    if (cond.worldState && typeof GameState !== 'undefined') {
      if (GameState.getWorldState() !== cond.worldState) return false;
    }
    if (cond.worldStateNot && typeof GameState !== 'undefined') {
      if (GameState.getWorldState() === cond.worldStateNot) return false;
    }

    // 名聲
    if (cond.minFame !== undefined && p && p.fame < cond.minFame) return false;
    if (cond.maxFame !== undefined && p && p.fame > cond.maxFame) return false;

    // 天數下限（通常跟 day 一致，但也能用於「至少第 X 天後才觸發」）
    if (cond.minDay !== undefined && p && p.day < cond.minDay) return false;

    return true;
  }

  /**
   * 取得指定天數的時間軸事件。
   * 多個符合條件的事件中，回傳 priority 最高的。
   * 沒有符合則回傳 null。
   *
   * @param {number} day
   * @returns {object|null}
   */
  function getTimelineEvent(day) {
    const candidates = TIMELINE_EVENTS.filter(
      ev => ev.day === day && _matchConditions(ev.conditions)
    );
    if (candidates.length === 0) return null;
    // 按 priority 降序，回傳第一個
    candidates.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return candidates[0];
  }

  /**
   * 取得所有時間軸事件的「顯示 marker」（for 百日條 UI）。
   * 目前直接返回所有事件，未來可根據當前狀態過濾（隱藏不滿足條件的）。
   *
   * @returns {Array<{day, name, icon, iconColor}>}
   */
  function getTimelineMarkers() {
    // 按 day + priority 去重：同一天只顯示 priority 最高的
    const byDay = {};
    TIMELINE_EVENTS.forEach(ev => {
      if (!byDay[ev.day] || (ev.priority || 0) > (byDay[ev.day].priority || 0)) {
        byDay[ev.day] = ev;
      }
    });
    return Object.values(byDay).map(ev => ({
      day:       ev.day,
      name:      ev.name,
      icon:      ev.icon,
      iconColor: ev.iconColor,
    }));
  }

  // ── Action Event Pool ─────────────────────────────
  const ACTION_EVENTS = {
    goodDream: {
      id: 'goodDream',
      text: '你夢到了某個早已忘卻的地方，陽光、麥田、和某個模糊的臉。醒來時心頭多了幾分暖意。',
      color: '#8899cc',
      effects: [{ type: 'vital', key: 'mood', delta: 12 }],
    },
    overseerWatch: {
      id: 'overseerWatch',
      text: '監督官停在你旁邊看了一會兒，沒說什麼，轉身離開。你不知道這代表滿意還是失望。',
      color: '#999999',
      effects: [],
    },
    overseerNod: {
      id: 'overseerNod',
      text: '監督官罕見地點了點頭。「還不壞。」這兩個字，勝過任何讚美。',
      color: '#ccaa55',
      effects: [
        { type: 'vital', key: 'mood', delta: 8 },
        { type: 'fame',  key: 'fame', delta: 1 },
      ],
    },
    trainingInjury: {
      id: 'trainingInjury',
      text: '練習中用力過猛，手腕傳來一陣刺痛。不算嚴重，但今天之後最好別再逞強。',
      color: '#cc4444',
      effects: [
        { type: 'vital', key: 'stamina', delta: -10 },
        { type: 'vital', key: 'mood',    delta: -5  },
      ],
    },
    sparringBond: {
      id: 'sparringBond',
      text: '對練結束後，對方拍了拍你的肩膀，什麼也沒說。但那個動作讓你感覺到某種連結。',
      color: '#66aacc',
      effects: [{ type: 'vital', key: 'mood', delta: 10 }],
    },
    melaChat: {
      id: 'melaChat',
      text: '梅拉趁人不注意悄悄多塞給你一塊烤餅，擠了下眼睛。「吃飽了才打得贏。」',
      color: '#88cc77',
      effects: [
        { type: 'vital', key: 'food', delta: 10 },
        { type: 'vital', key: 'mood', delta: 8  },
      ],
    },
    blackCooking: {
      id: 'blackCooking',
      text: '今天的肉不知道是什麼，顏色有點不對。你強忍著吞下去，胃裡隱隱作痛。',
      color: '#888844',
      effects: [
        { type: 'vital', key: 'food',    delta: -5 },
        { type: 'vital', key: 'stamina', delta: -8 },
      ],
    },
    melaSecret: {
      id: 'melaSecret',
      text: '梅拉壓低聲音說，上週有個鬥士吃了獄卒的暗虧。她沒說細節，但眼神裡有警示。',
      color: '#aaaa66',
      effects: [{ type: 'vital', key: 'mood', delta: 5 }],
    },
    stealCaught: {
      id: 'stealCaught',
      text: '伸手的瞬間，梅拉的眼睛對上了你的。她沒吼叫，只是平靜地說：「下次這樣，我去報告。」你把食物放回去，背脊發涼。',
      color: '#cc4444',
      effects: [
        { type: 'vital',     key: 'food',     delta: -20 },
        { type: 'affection', key: 'melaKook', delta: -5  },
        { type: 'vital',     key: 'mood',     delta: -10 },
      ],
    },
    stealSuccess: {
      id: 'stealSuccess',
      text: '沒人注意到。你把食物藏進衣服裡，心跳加速。',
      color: '#888888',
      effects: [],
    },
    graStory: {
      id: 'graStory',
      text: '葛拉沒有停手，但嘴裡吐出幾個字：「我打過的最好的劍，送給了一個不會用的人。」你沒問後續，他也沒說。',
      color: '#aa8855',
      effects: [{ type: 'vital', key: 'mood', delta: 6 }],
    },
    graRepair: {
      id: 'graRepair',
      text: '葛拉拿起你的武器翻看了一下，哼了一聲。「等到明天。」你知道明天拿到的，絕對比今天交的好。',
      color: '#aa8855',
      effects: [{ type: 'vital', key: 'mood', delta: 8 }],
    },
    officerMission: {
      id: 'officerMission',
      text: '長官示意你坐下，翻開一份文書。「下週有場非正式的表演賽，你上。」這不是商量。',
      color: '#8899bb',
      effects: [
        { type: 'vital', key: 'mood', delta: -5 },
        { type: 'fame',  key: 'fame', delta: 2  },
      ],
    },
    officerCold: {
      id: 'officerCold',
      text: '長官抬起頭，淡淡掃了你一眼，然後繼續翻文書，沒有說一個字。你在門口站了很久，最後悄悄退出去。',
      color: '#888888',
      effects: [{ type: 'vital', key: 'mood', delta: -8 }],
    },
    officerPraise: {
      id: 'officerPraise',
      text: '長官難得開口：「最近看到你在訓練場，有在用心。」就這一句，卻讓你心情好了整個上午。',
      color: '#ccaa55',
      effects: [
        { type: 'vital',     key: 'mood',    delta: 15 },
        { type: 'affection', key: 'officer', delta: 3  },
      ],
    },
    masterEval: {
      id: 'masterEval',
      text: '主人靜靜地看了你很久，最後說：「你比我預期的耐打。」這是讚美，你決定這麼解讀。',
      color: '#d4af37',
      effects: [
        { type: 'vital', key: 'mood', delta: 10 },
        { type: 'fame',  key: 'fame', delta: 1  },
      ],
    },
    masterGift: {
      id: 'masterGift',
      text: '主人從桌上拿起一瓶小藥劑推給你。「訓練之前喝。」沒有解釋。你選擇相信。',
      color: '#d4af37',
      effects: [
        { type: 'vital', key: 'stamina', delta: 20 },
        { type: 'vital', key: 'mood',    delta: 5  },
      ],
    },
    masterWarning: {
      id: 'masterWarning',
      text: '主人沒有抬頭，只是說：「我的投資要有回報。若是沒有，帳本上的數字就得調整。」你知道那意味著什麼。',
      color: '#cc3300',
      effects: [{ type: 'vital', key: 'mood', delta: -15 }],
    },
    marketThief: {
      id: 'marketThief',
      text: '人群中一個輕微的碰觸，你的荷包變輕了一些。等你察覺，那個身影早已不見。',
      color: '#cc4444',
      effects: [{ type: 'vital', key: 'mood', delta: -8 }],
    },
    marketRumor: {
      id: 'marketRumor',
      text: '攤販壓低聲音說，萬骸祭今年會有來自北境的劍客。沒有人知道這消息是真是假，但它讓你的胃緊了一下。',
      color: '#aaaaaa',
      effects: [{ type: 'vital', key: 'mood', delta: -5 }],
    },
    marketFan: {
      id: 'marketFan',
      text: '一個年輕人認出了你，激動地說見過你上次的比賽。你接受了他的讚美，心情好了一點。',
      color: '#88aacc',
      effects: [
        { type: 'vital', key: 'mood', delta: 10 },
        { type: 'fame',  key: 'fame', delta: 1  },
      ],
    },
    herbFind: {
      id: 'herbFind',
      text: '你找到了一叢野薑，和幾株不知名的香草。帶回去也許能用上。',
      color: '#66aa66',
      effects: [{ type: 'vital', key: 'food', delta: 8 }],
    },
    wildAnimal: {
      id: 'wildAnimal',
      text: '草叢裡竄出一隻受傷的野兔，驚得你退了兩步。牠跑掉了，但你的心跳還沒平靜下來。',
      color: '#aaaaaa',
      effects: [{ type: 'vital', key: 'stamina', delta: -5 }],
    },
  };

  function getActionEvent(evId) {
    return ACTION_EVENTS[evId] || null;
  }

  // ══════════════════════════════════════════════════
  // 🆕 Phase 1-F: NPC 注意事件池
  // ══════════════════════════════════════════════════
  /**
   * 當 notice_count 累積達門檻時觸發。
   * text    : 敘事文字
   * color   : log 顏色
   * effects : 套用效果
   */
  const NPC_NOTICE_EVENTS = {

    gra_notice_invite: {
      id: 'gra_notice_invite',
      npcId: 'blacksmithGra',
      text: '葛拉一言不發地走到你身邊，用下巴示意鍛造坊的方向。「有空來看看。」他的聲音像鐵塊落在石板上。',
      color: '#b8860b',
      effects: [
        { type: 'affection', key: 'blacksmithGra', delta: 5 },
        { type: 'vital',     key: 'mood',          delta: 8 },
      ],
      // 解鎖 watchSmith 動作（下次在鍛造坊時可用）
      flagSet: 'gra_invited_to_forge',
    },

    mela_notice_food: {
      id: 'mela_notice_food',
      npcId: 'melaKook',
      text: '梅拉從圍裙口袋裡摸出一個用布包著的東西，悄悄塞到你手裡，眼神掃了一圈確定沒人看見。「快吃，別說是我給的。」',
      color: '#9dbf80',
      effects: [
        { type: 'vital',     key: 'food',     delta: 20 },
        { type: 'vital',     key: 'mood',     delta: 10 },
        { type: 'affection', key: 'melaKook', delta: 5  },
      ],
    },

    overseer_notice_task: {
      id: 'overseer_notice_task',
      npcId: 'overseer',
      text: '訓練結束後，監督官把你叫住。「你，訓練場清掃。其他人散了。」這不是建議。',
      color: '#aa7755',
      effects: [
        { type: 'vital', key: 'stamina', delta: -10 },
        { type: 'vital', key: 'mood',    delta: -5  },
      ],
      // 完成勞動任務：給一點好感累積（長官看到你服從）
      flagSet: 'overseer_assigned_task',
    },

  };

  function getNoticeEvent(evId) {
    return NPC_NOTICE_EVENTS[evId] || null;
  }

  // ══════════════════════════════════════════════════
  // 🆕 Phase 1-G: 傳喚事件池
  // ══════════════════════════════════════════════════
  /**
   * 由 DayCycle.onDayStart 條件判斷後呼叫。
   * doneFlag : 觸發後立刻 set，防止重複觸發。
   * conditions: 同 _matchConditions 格式。
   * effects   : 套用效果（可含 affection / vital / fame / money）。
   */
  const SUMMON_EVENTS = [

    // 主人第一次傳喚（名聲 ≥ 15，初見）
    {
      id:        'master_first_eval',
      doneFlag:  'summon_master_first_done',
      conditions:{ minFame: 15, flagNot: 'summon_master_first_done' },
      text:      '今早一名侍從走到你面前，低聲說：「大人要見你。」你跟著他穿過幾道迴廊，走進那個瀰漫香料氣味的房間。\n阿圖斯大人坐在椅子上，打量你片刻，像在估算一件貨物的價值。「你的成績……還不差。繼續這樣。」他揮手示意你退下，談話就此結束。',
      color:     '#b8960c',
      effects:   [
        { type: 'vital',     key: 'mood',        delta: -5 },
        { type: 'affection', key: 'masterArtus', delta: 3  },
      ],
    },

    // 主人好感累積後的贈禮傳喚（好感 ≥ 30，未觸發）
    {
      id:        'master_gift',
      doneFlag:  'summon_master_gift_done',
      conditions:{ flagNot: 'summon_master_gift_done' },
      minAffection: { npcId: 'masterArtus', min: 30 },
      text:      '侍從帶來一個小皮袋，放在你手上就轉身離開。裡面是幾枚銅幣和一塊乾肉——主人的賞賜，沒有任何附帶說明。\n你懂那個意思：你讓他滿意了。',
      color:     '#b8960c',
      effects:   [
        { type: 'money',     delta: 10              },
        { type: 'vital',     key: 'food', delta: 15 },
        { type: 'vital',     key: 'mood', delta: 12 },
        { type: 'affection', key: 'masterArtus', delta: 2 },
      ],
    },

    // 長官定期點名（每 12 天）
    {
      id:         'officer_check',
      doneFlag:   null,   // 用 day-based flag 控制，見 main.js
      conditions: {},
      text:       '「停。」訓練場上監督官的聲音突然響起。他把你叫出隊伍，在你面前停下，眼睛像刀一樣掃過你全身。\n「你最近訓練的樣子——還可以。但別以為我沒注意到偷懶的時候。」他轉身走掉，沒有等你回答。',
      color:      '#aa8855',
      effects:    [
        { type: 'vital', key: 'mood', delta: -3 },
      ],
    },

    // 長官任務派遣（名聲 ≥ 25，未做過）
    {
      id:        'officer_mission',
      doneFlag:  'summon_officer_mission_done',
      conditions:{ minFame: 25, flagNot: 'summon_officer_mission_done' },
      text:      '長官把你叫進辦公室，門關上後他靠著桌子說：「下個月有場小型公演，我需要一個撐得住場面的人。你去。」\n這不是詢問。你點頭。他把一張排程表塞到你手裡，補上一句：「別讓我失望。」',
      color:     '#aa8855',
      effects:   [
        { type: 'fame',      delta: 3               },
        { type: 'vital',     key: 'mood', delta: 8  },
        { type: 'affection', key: 'officer', delta: 5 },
      ],
      flagSet:   'officer_mission_assigned',
    },

  ];

  /**
   * 取得傳喚事件（by id）。
   */
  function getSummonEvent(evId) {
    return SUMMON_EVENTS.find(e => e.id === evId) || null;
  }

  // ══════════════════════════════════════════════════
  // 🆕 Phase 1-H: 切磋邀請事件
  // ══════════════════════════════════════════════════
  const SPARRING_INVITE_EVENTS = {

    sparring_by_cassius: {
      id: 'sparring_by_cassius', npcId: 'cassius',
      text: '卡西烏斯走到你旁邊，把一柄木劍扔給你。「過來。」他沒有多餘的話，但眼神裡有某種認可。\n你們對打了一個時段——他很快，你學到了東西。',
      color: '#6699cc',
      effects: [
        { type: 'attr',      key: 'STR',    delta: 0.3 },
        { type: 'attr',      key: 'DEX',    delta: 0.3 },
        { type: 'vital',     key: 'stamina',delta: -15 },
        { type: 'vital',     key: 'mood',   delta: 10  },
        { type: 'affection', key: 'cassius',delta: 3   },
      ],
    },

    sparring_by_dagi: {
      id: 'sparring_by_dagi', npcId: 'dagiSlave',
      text: '達吉拍了拍你的手臂，眼睛亮著。「喂，要不要比劃一下？我最近學了個新招。」\n他技巧生疏但熱情，你們打得滿頭大汗，笑了幾下。',
      color: '#6699cc',
      effects: [
        { type: 'attr',      key: 'AGI',       delta: 0.3 },
        { type: 'vital',     key: 'stamina',   delta: -12 },
        { type: 'vital',     key: 'mood',      delta: 15  },
        { type: 'affection', key: 'dagiSlave', delta: 5   },
      ],
    },

    sparring_by_ursa: {
      id: 'sparring_by_ursa', npcId: 'ursa',
      text: '烏爾薩走過來，低頭看著你說：「我需要一個陪練。你不介意吧。」這是他少見的主動。\n他的力道驚人，光是接住他的攻擊就讓你雙臂發麻。',
      color: '#6699cc',
      effects: [
        { type: 'attr',      key: 'STR',   delta: 0.4 },
        { type: 'attr',      key: 'CON',   delta: 0.2 },
        { type: 'vital',     key: 'stamina',delta: -20 },
        { type: 'vital',     key: 'mood',   delta: 8   },
        { type: 'affection', key: 'ursa',   delta: 3   },
      ],
    },

  };

  // 預設切磋事件（npcId 未對應到專屬版本時用）
  const SPARRING_DEFAULT = {
    id: 'sparring_generic',
    text: '他朝你點頭，把木劍遞過來。你們對打了一陣，彼此都磨礪到了什麼。',
    color: '#6699cc',
    effects: [
      { type: 'attr',  key: 'STR', delta: 0.2 },
      { type: 'attr',  key: 'DEX', delta: 0.2 },
      { type: 'vital', key: 'stamina', delta: -10 },
      { type: 'vital', key: 'mood',    delta: 6   },
    ],
  };

  function getSparringEvent(npcId) {
    return SPARRING_INVITE_EVENTS[`sparring_by_${npcId}`] || { ...SPARRING_DEFAULT, npcId };
  }

  // ══════════════════════════════════════════════════
  // 🆕 Phase 1-I: 主人派遣採購事件
  // ══════════════════════════════════════════════════
  const ERRAND_EVENTS = [

    {
      id:   'errand_market_food',
      text: '今早侍從帶來指示：「大人要你去市集採買補給，下午前回來。」護衛跟在你三步外，但你還是感受到難得的空氣。\n市集嘈雜、充滿氣味，你按清單買完，順手打量了一下周圍的人。',
      color: '#9dbf80',
      effects: [
        { type: 'vital', key: 'food', delta: 25 },
        { type: 'vital', key: 'mood', delta: 12 },
        { type: 'money', delta: 3 },                              // 剩餘零錢
        { type: 'affection', key: 'masterArtus', delta: +3 },     // 🆕 完成跑腿，主人信任 +
      ],
      flagSet: null,
    },

    {
      id:   'errand_market_rumor',
      text: '市集跑腿途中，隔壁攤的老人壓低聲音對你說：「最近有個傳言，說競技場要辦什麼大型公演…… 那個名額很搶手。」\n你裝作沒聽見，付了錢走人。腦子裡卻反覆轉著那句話。',
      color: '#9dbf80',
      effects: [
        { type: 'vital', key: 'food', delta: 20 },
        { type: 'vital', key: 'mood', delta: 8  },
        { type: 'fame',  delta: 1 },                              // 開始被市井聽說
        { type: 'affection', key: 'masterArtus', delta: +3 },     // 🆕
      ],
      flagSet: 'heard_arena_rumor',
    },

    {
      id:   'errand_market_incident',
      text: '回程時有個小孩衝出來撞了你，摔在地上哭。你停下來把他扶起——護衛皺眉催你快走。\n小孩的母親衝上來，眼神從恐懼轉為感謝。你沒說什麼，跟著護衛離開。',
      color: '#9dbf80',
      effects: [
        { type: 'vital', key: 'food', delta: 20 },
        { type: 'vital', key: 'mood', delta: 18 },
        { type: 'affection', key: 'masterArtus', delta: +2 },     // 🆕 扶小孩可能讓護衛不悅，主人好感 +2（比純跑腿少）
      ],
      flagSet: null,
    },

  ];

  function getErrandEvent() {
    // 隨機抽一個跑腿事件
    return ERRAND_EVENTS[Math.floor(Math.random() * ERRAND_EVENTS.length)];
  }

  return {
    EVENT_POOL,
    ACTION_EVENTS,
    NPC_NOTICE_EVENTS,
    SUMMON_EVENTS,
    SPARRING_INVITE_EVENTS,
    ERRAND_EVENTS,
    TIMELINE_EVENTS,
    rollRandom,
    applyEvent,
    getActionEvent,
    getNoticeEvent,
    getSummonEvent,
    getSparringEvent,
    getErrandEvent,
    // 🆕 D.1.10 條件化時間軸事件
    getTimelineEvent,
    getTimelineMarkers,
  };
})();
