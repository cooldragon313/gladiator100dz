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
   * 每個條目對應某天觸發的特殊事件。
   * icon      : 百日條上顯示的符號
   * iconColor : 符號顏色
   * type      : 'forced_battle' | 'final' | 'story'
   * forced    : true = 當天只能待在 forcedField，無法切換場景
   * forcedNPCs: 強制出現的 NPC 列表
   * opponent  : 戰鬥對手 (Enemies key)
   * actionLabel: 觸發戰鬥的按鈕文字
   */
  const TIMELINE_EVENTS = {
    5: {
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
    50: {
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
    75: {
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
    100: {
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
  };

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

  return { EVENT_POOL, ACTION_EVENTS, TIMELINE_EVENTS, rollRandom, applyEvent, getActionEvent };
})();
