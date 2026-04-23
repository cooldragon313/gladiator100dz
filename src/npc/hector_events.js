/**
 * hector_events.js — 赫克托劇情線 (2026-04-23 重設計 Phase 1)
 * ══════════════════════════════════════════════════
 * 取代舊的 main.js hectorDay8/15/25/harass 散落實作。
 * 核心：Day 1 玩家選笑臉/臭臉 → 兩條路線分岔。
 *
 * 路線 flag：
 *   hector_friendly_path — Day 1 笑臉點頭
 *   hector_hostile_path  — Day 1 臭臉拒絕
 *
 * Phase 1 實作：
 *   - showDay1Choice(onComplete) — 走廊相遇後彈 ChoiceModal
 *   - tryFriendlyHint()  — 笑臉路線：Day 2-12 示好事件池（8+1 條）
 *   - tryHarassment()    — 臭臉路線：日常騷擾（6 事件，震動 + 心想）
 *   - 每日清 flag 鉤子
 *
 * 後續 Phase（未實作）：§ 5.2 仇恨撞擊 / § 5.3 介入保護 / § 4.3 賣情報 /
 *                         § 5.4 私戰 / § 4.5 黑市三功能 / § 6 Day 40 NPC 反應。
 *
 * 依賴：ChoiceModal, DialogueModal, Flags, Stats, teammates, GameState,
 *       SoundManager（可選）, Game（可選，for shakeGameRoot/flashStageRed）。
 */
const HectorEvents = (() => {

  // ══════════════════════════════════════════════════
  // helpers
  // ══════════════════════════════════════════════════
  function _isHectorPresent() {
    if (typeof GameState === 'undefined' || !GameState.getCurrentNPCs) return false;
    const cur = GameState.getCurrentNPCs() || {};
    const list = cur.teammates || [];
    return list.includes('hector');
  }

  function _getAff() {
    if (typeof teammates === 'undefined') return 0;
    return teammates.getAffection ? teammates.getAffection('hector') : 0;
  }

  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    }
  }

  // ══════════════════════════════════════════════════
  // § 3 Day 1 走廊分岔（ChoiceModal）
  // ══════════════════════════════════════════════════
  /**
   * 由 _playDay1WakeUp 在赫克托走廊對白結束後呼叫。
   * 設下 hector_friendly_path 或 hector_hostile_path flag + 好感變動。
   * @param {Function} onDone — 選完 + resultDialogue 播完後呼叫
   */
  function showDay1Choice(onDone) {
    if (typeof ChoiceModal === 'undefined') {
      if (typeof onDone === 'function') onDone();
      return;
    }

    ChoiceModal.show({
      id: 'hector_day1_branch',
      icon: '🐍',
      title: '赫克特在等你反應',
      body: '他手還搭在你肩上。笑容還沒收。',
      forced: true,
      choices: [
        {
          id: 'smile_back',
          label: '笑臉點頭',
          hint: '（難得有人給好臉色⋯⋯）',
          effects: [
            { type: 'flag', key: 'hector_friendly_path' },
            { type: 'affection', key: 'hector', delta: 5 },
          ],
          resultDialogue: [
            { speaker: '赫克特', text: '嗯，識相。' },
            { speaker: '赫克特', text: '有事找我。' },
            { text: '（他拍拍你肩膀，往前走了。）' },
          ],
          resultLog: '你選擇接受赫克特的靠近。你還不知道這代表什麼。',
          logColor: '#9a5a70',
        },
        {
          id: 'push_away',
          label: '臭臉——「滾開啦。」',
          hint: '（這人笑得太假。）',
          effects: [
            { type: 'flag', key: 'hector_hostile_path' },
            { type: 'affection', key: 'hector', delta: -10 },
          ],
          resultEffect: 'shake',
          resultDialogue: [
            { text: '（他停住。笑容沒變，但眼神不一樣了。）' },
            { speaker: '赫克特', text: '⋯⋯哦？' },
            { speaker: '赫克特', text: '好。給我記住。' },
            { text: '（他哼了一聲走了。）' },
          ],
          resultLog: '你拒絕了他的靠近。從今天起，他盯上你了。',
          logColor: '#8899aa',
        },
      ],
    }, {
      onChoose: () => {
        if (typeof onDone === 'function') {
          try { onDone(); } catch (e) { console.error('[HectorEvents] onDone error', e); }
        }
      },
    });
  }

  // ══════════════════════════════════════════════════
  // § 4.1 笑臉路線：示好事件池（Day 2-12 隨機）
  // ══════════════════════════════════════════════════
  // 觸發率 25%/天、最多 1/天、共 8+1 條（第 9 條 10% 機率特別版：塞糖）
  const FRIENDLY_HINTS = [
    {
      id: 'hint_officer',
      lines: [
        { text: '（訓練空檔，赫克特湊過來，小聲。）' },
        { speaker: '赫克特', text: '長官在的時候別偷懶——他是會抽人的。' },
        { text: '（他拍拍你手臂走了。）' },
      ],
    },
    {
      id: 'hint_cassius',
      lines: [
        { text: '（赫克特經過你身邊，下巴朝場上那個疤臉男人努了努。）' },
        { speaker: '赫克特', text: '那個姓卡的（卡西烏斯），別惹他。老兵。' },
        { speaker: '赫克特', text: '要他教你可以，不要他踢你那種。' },
      ],
    },
    {
      id: 'hint_mela',
      lines: [
        { text: '（赫克特端著一塊麵包走過。）' },
        { speaker: '赫克特', text: '累了就去找廚娘。' },
        { speaker: '赫克特', text: '她會唸你，但偶爾會多給你一口飯。' },
      ],
    },
    {
      id: 'hint_smith',
      lines: [
        { text: '（赫克特瞄了一眼你的武器。）' },
        { speaker: '赫克特', text: '那玩意兒鈍了吧？' },
        { speaker: '赫克特', text: '壞了找葛拉，別自己修——手藝不到位反而更糟。' },
      ],
    },
    {
      id: 'hint_doctor',
      lines: [
        { text: '（赫克特看見你在揉肩膀。）' },
        { speaker: '赫克特', text: '傷成那樣還練？老默那邊有藥。' },
        { speaker: '赫克特', text: '付錢就是了。比你多躺一天賺得回來。' },
      ],
    },
    {
      id: 'hint_master_pick',
      lines: [
        { text: '（赫克特擦著手靠過來。）' },
        { speaker: '赫克特', text: '主人看誰多兩眼——' },
        { speaker: '赫克特', text: '那個人下一場準要被派出場。' },
        { text: '（他朝訓練場一瞥。意思很明白。）' },
      ],
    },
    {
      id: 'hint_sleep',
      lines: [
        { text: '（赫克特伸了個懶腰。）' },
        { speaker: '赫克特', text: '競技場前一晚睡飽。' },
        { speaker: '赫克特', text: '上次有人沒睡好，第一回合就躺下了。' },
      ],
    },
    {
      id: 'hint_morras',
      lines: [
        { text: '（赫克特壓低聲音。）' },
        { speaker: '赫克特', text: '隔壁莫拉斯訓練所最近要派人來。' },
        { speaker: '赫克特', text: '提前準備。那群人⋯⋯有點不一樣。' },
      ],
    },
  ];

  // 第 9 條：10% 機率替換為「塞糖」特別版
  const FRIENDLY_HINT_SUGAR = {
    id: 'hint_sugar',
    lines: [
      { text: '（赫克特摸過你袋子——）' },
      { text: '（你感覺他塞了東西進去。）' },
      { speaker: '赫克特', text: '謝了。下次記得我。' },
      { text: '（你掏出來看——一顆糖。還帶著體溫。）' },
    ],
    // 特別版額外給 money + aff
    extraEffects: [
      { type: 'money', delta: 3 },
      { type: 'affection', key: 'hector', delta: 3 },  // 合計 +8
    ],
  };

  /**
   * 在訓練後呼叫（見 main.js _doAction 尾段）。
   * 條件：笑臉路線 + Day 2-12 + 赫克特在場 + 今日未觸發 + 25% 機率。
   */
  function tryFriendlyHint() {
    if (typeof Flags === 'undefined' || !Flags.has('hector_friendly_path')) return;
    const p = (typeof Stats !== 'undefined') ? Stats.player : null;
    if (!p || p.day < 2 || p.day > 12) return;
    if (!_isHectorPresent()) return;
    if (Flags.has('hector_hint_today')) return;
    if (Math.random() >= 0.25) return;

    Flags.set('hector_hint_today', true);

    // 10% 機率塞糖，否則從 8 條抽一條（避開已播過的）
    let picked;
    if (Math.random() < 0.10) {
      picked = FRIENDLY_HINT_SUGAR;
    } else {
      const pool = FRIENDLY_HINTS.filter(h => !Flags.has(`hector_${h.id}_done`));
      if (pool.length === 0) return;   // 全播完不再觸發
      picked = pool[Math.floor(Math.random() * pool.length)];
    }
    Flags.set(`hector_${picked.id}_done`, true);

    // 播放 + 結算
    const playCb = () => {
      // 基本效果
      if (typeof Stats !== 'undefined') Stats.modVital('mood', 6);
      if (typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection('hector', 5);
      }
      // 塞糖額外效果
      if (Array.isArray(picked.extraEffects) && typeof Effects !== 'undefined') {
        Effects.apply(picked.extraEffects, { source: 'hector:' + picked.id });
      }
      if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
    };

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(picked.lines, { onComplete: playCb });
    } else {
      // fallback：log 摘要
      _log('赫克特又來跟你套近乎了。', '#9a5a70', false);
      playCb();
    }
  }

  // ══════════════════════════════════════════════════
  // § 5.1 臭臉路線：日常騷擾事件池（Day 2-30）
  // ══════════════════════════════════════════════════
  // 觸發率 20%/天（Day 2-5 略高 28% 讓玩家早點感受到）
  // 全部 6 事件：震動 + 主角心想。其中事件 6（踩腳）40% 觸發反抗 ChoiceModal。
  const HARASS_EVENTS = [
    {
      id: 'harass_bread',
      weight: 15,
      lines: [
        { text: '（你走到放午餐的木板——）' },
        { text: '（空了。）', effect: 'shake' },
        { text: '（赫克特在角落慢慢舔他手指。他對你笑。）' },
        { speaker: '主角', text: '（這混蛋⋯⋯又偷我飯。）' },
      ],
      effects: () => {
        if (typeof Stats === 'undefined') return;
        Stats.modVital('food', -5);
        Stats.modVital('mood', -3);
      },
    },
    {
      id: 'harass_sandbag',
      weight: 15,
      lines: [
        { text: '（你正專心在揮擊——）' },
        { text: '砰！（你旁邊的沙袋被踢翻了，沙灑了一地。）', effect: 'shake' },
        { text: '（赫克特在遠處吹口哨，裝作沒事。）' },
        { speaker: '主角', text: '（這混蛋又來小動作。）' },
      ],
      effects: () => {
        if (typeof Stats === 'undefined') return;
        Stats.modVital('mood', -3);
        Stats.modVital('stamina', -2);
      },
    },
    {
      id: 'harass_shoulder',
      weight: 15,
      lines: [
        { text: '（你背對通道——）' },
        { text: '（肩膀突然被撞！）', effect: 'shake-big' },
        { speaker: '赫克特', text: '喔，不好意思。' },
        { text: '（他完全沒有不好意思的樣子。）' },
        { speaker: '主角', text: '（最好是沒看到。）' },
      ],
      effects: () => {
        if (typeof Stats === 'undefined') return;
        Stats.modVital('mood', -5);
        Stats.modVital('hp', -2);
      },
    },
    {
      id: 'harass_taunt',
      weight: 15,
      lines: [
        { text: '（赫克特經過你身邊，壓低聲音。）' },
        { speaker: '赫克特', text: '你今天練得不錯。' },
        { speaker: '赫克特', text: '可惜——不夠格。' },
        { text: '（他笑著走了。）', effect: 'shake' },
        { speaker: '主角', text: '（⋯⋯閉嘴。）' },
      ],
      effects: () => {
        if (typeof Stats === 'undefined') return;
        Stats.modVital('mood', -3);
      },
    },
    {
      id: 'harass_water',
      weight: 15,
      lines: [
        { text: '（訓練後你拿起水壺。）' },
        { text: '（喝了一口——）' },
        { text: '（嘎吱。）', effect: 'shake' },
        { text: '（沙。）' },
        { text: '（你吐出來，抬頭——赫克特在遠處，正在看你喝。）' },
        { speaker: '主角', text: '（⋯⋯這王八蛋。）' },
      ],
      effects: () => {
        if (typeof Stats === 'undefined') return;
        Stats.modVital('mood', -5);
        Stats.modVital('food', -3);
      },
    },
    {
      id: 'harass_foot',
      weight: 15,
      lines: [
        { text: '（赫克特走過你身邊——）' },
        { text: '（狠狠踩在你腳上。）', effect: 'shake-big' },
        { speaker: '赫克特', text: '喔。' },
        { text: '（他還在笑。）' },
        { text: '（整個訓練場都在看。）' },
      ],
      effects: () => {
        if (typeof Stats === 'undefined') return;
        Stats.modVital('mood', -3);
      },
      // 🆕 40% 機率觸發反抗 ChoiceModal
      resistChoice: true,
    },
  ];

  function _pickHarassEvent() {
    // 優先抽未播過的；全播過則從完整池再抽（loop 階段可以重複）
    const fresh = HARASS_EVENTS.filter(e => !Flags.has(`hector_${e.id}_played`));
    const pool = fresh.length > 0 ? fresh : HARASS_EVENTS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function _showHarassResistChoice() {
    if (typeof ChoiceModal === 'undefined') return;
    ChoiceModal.show({
      id: 'hector_harass_resist',
      icon: '💢',
      title: '整個訓練場都在看',
      body: '赫克特還在笑。你腳上的痛感在燒。',
      forced: true,
      choices: [
        {
          id: 'glare',
          label: '回瞪他',
          hint: '（不值得動手，但不能沒反應。）',
          effects: [
            { type: 'vital', key: 'mood', delta: 3 },
            { type: 'affection', key: 'hector', delta: -3 },
            { type: 'moral', axis: 'pride', side: 'negative' },   // prideful 有骨氣
          ],
          resultLog: '你抬頭直視他。他笑了一下，但笑裡多了一點你看不懂的東西——那是「這小子不好玩」。',
          logColor: '#c8a060',
        },
        {
          id: 'endure',
          label: '忍下來',
          hint: '（⋯⋯不值得。）',
          effects: [
            { type: 'moral', axis: 'patience', side: 'positive' },
          ],
          resultLog: '你低頭繼續走。他在你背後笑得更大聲。腳上的痛今晚還會跟著你。',
          logColor: '#8899aa',
        },
        {
          id: 'shove',
          label: '把他推開',
          hint: '（我他媽受夠了。）',
          effects: [
            { type: 'vital', key: 'stamina', delta: -5 },
            { type: 'affection', key: 'hector', delta: -8 },
            { type: 'moral', axis: 'patience', side: 'negative' },
          ],
          resultEffect: 'shake',
          resultDialogue: [
            { text: '（你雙手重重推在他胸口。）' },
            { text: '（他踉蹌退了兩步——）' },
            { speaker: '赫克特', text: '⋯⋯嘖。' },
            { speaker: '赫克特', text: '你很有種嘛。' },
            { text: '（他走了。但你知道這還沒完。）' },
          ],
          resultLog: '你推開了他。整個訓練場安靜了半秒。然後繼續運轉。',
          logColor: '#cc7744',
        },
      ],
    });
  }

  /**
   * 在訓練後呼叫（見 main.js _doAction 尾段）。
   * 條件：臭臉路線 + Day ≥ 2 + 赫克特在場 + 今日未觸發 + 機率閾值。
   */
  function tryHarassment() {
    if (typeof Flags === 'undefined' || !Flags.has('hector_hostile_path')) return;
    const p = (typeof Stats !== 'undefined') ? Stats.player : null;
    if (!p || p.day < 2 || p.day > 30) return;
    if (!_isHectorPresent()) return;
    if (Flags.has('hector_harass_today')) return;

    // Day 2-5 略高（28%）讓玩家早點感受、Day 6+ 降為 20%
    const threshold = (p.day <= 5) ? 0.28 : 0.20;
    if (Math.random() >= threshold) return;

    Flags.set('hector_harass_today', true);

    const ev = _pickHarassEvent();
    Flags.set(`hector_${ev.id}_played`, true);

    const afterPlay = () => {
      if (typeof ev.effects === 'function') {
        try { ev.effects(); } catch (e) { console.error('[HectorEvents]', e); }
      }
      if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();

      // 事件 6 踩腳 → 40% 機率彈反抗 ChoiceModal
      if (ev.resistChoice && Math.random() < 0.40) {
        setTimeout(() => _showHarassResistChoice(), 280);
      }
    };

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(ev.lines, { onComplete: afterPlay });
    } else {
      _log('赫克特又找你麻煩了。', '#aa7755', false);
      afterPlay();
    }
  }

  // ══════════════════════════════════════════════════
  // 初始化：註冊每日清 flag 鉤子
  // ══════════════════════════════════════════════════
  function init() {
    if (typeof DayCycle === 'undefined' || typeof DayCycle.onDayStart !== 'function') return;
    DayCycle.onDayStart('clearHectorDaily', () => {
      if (typeof Flags === 'undefined') return;
      Flags.unset('hector_hint_today');
      Flags.unset('hector_harass_today');
    }, 19);
  }

  // 自動初始化
  if (typeof DayCycle !== 'undefined') {
    init();
  } else if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', init);
  }

  return {
    showDay1Choice,
    tryFriendlyHint,
    tryHarassment,
    init,
  };
})();
