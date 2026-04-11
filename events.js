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
   * @param {object} ev  - event object
   * @param {object} statsRef - Stats module
   */
  function applyEvent(ev, statsRef) {
    if (!ev || !ev.effects) return;
    ev.effects.forEach(eff => {
      if (eff.type === 'vital')  statsRef.modVital(eff.key, eff.delta);
      if (eff.type === 'fame')   statsRef.modFame(eff.delta);
      if (eff.type === 'attr')   statsRef.modAttr(eff.key, eff.delta);
    });
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

  return { EVENT_POOL, TIMELINE_EVENTS, rollRandom, applyEvent };
})();
