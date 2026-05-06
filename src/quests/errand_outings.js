/**
 * errand_outings.js — 跑腿外出事件系統 v2（深度版、C 完整版）
 *
 * 設計：[docs/quests/errand-outings.md](../../docs/quests/errand-outings.md)
 *
 * 取代舊 src/content/events.js ERRAND_EVENTS（每 7 天硬觸發、3 個事件隨機）
 * 新版：
 *   - 每天 10% 機率擲、需主人好感 ≥ 30
 *   - 4 個源頭差異化（葛拉/梅拉/侍從/巴爺）— 各自條件 + 同行者 + 對白
 *   - 出門前對白（僕人傳話 + 同行者打招呼）
 *   - 路上閒聊 50% 機率（NPC 專屬八卦）
 *   - 中段隨機事件（撞小孩等、E-2 ~ E-7 階段加進來）
 *   - 回程獎勵（每源頭不同）
 *
 * 流程：
 *   trigger(day) → roll source → playDeparture() → maybeRollMid()
 *     → playReturn() → giveRewards()
 *
 * 公開 API：
 *   ErrandOutings.tryStart(newDay)    — DayCycle hook 入口
 *   ErrandOutings.testRun(sourceId)   — debug 強制觸發某源頭
 */
const ErrandOutings = (() => {

  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    }
  }

  // ═══════════════════════════════════════════════════
  // 4 源頭差異化定義
  // ═══════════════════════════════════════════════════
  const SOURCES = {

    // ─── 葛拉採購鍛造材料 ─────────────────────────
    blacksmith: {
      id: 'blacksmith',
      label: '葛拉採購',
      destination: '城南鐵料市集',
      companionName: '葛拉學徒',
      // 觸發條件
      requireGraAff:    30,
      requireMasterAff: 30,
      // 出門前同行者對白
      companionLines: [
        { speaker: '葛拉學徒', text: '⋯⋯走吧。要扛的東西多、別摸魚。' },
        { speaker: '葛拉學徒', text: '我師父說你力氣不錯。看你今天扛得動多少。' },
      ],
      // 路上閒聊（50% 觸發）
      pathChatter: [
        { speaker: '葛拉學徒', text: '⋯⋯你沒看過師父真的發火吧？' },
        { speaker: '葛拉學徒', text: '前陣子有人把他剛打的劍丟在地上。' },
        { speaker: '葛拉學徒', text: '⋯⋯他把那把劍當著那人的面熔了。' },
        { speaker: '葛拉學徒', text: '說「不配」。然後就回去打鐵了。' },
        { text: '（你想像那個畫面、忍不住笑了一下。）' },
      ],
      // 高好感（gra ≥ 60）解鎖的對白
      pathChatterHigh: [
        { speaker: '葛拉學徒', text: '⋯⋯師父不太常講他兒子。' },
        { speaker: '葛拉學徒', text: '但他偶爾會看著火、發很久的呆。' },
        { speaker: '葛拉學徒', text: '我猜⋯⋯他兒子以前也這樣陪他出來。' },
        { text: '（你沒接話。但記住了。）' },
      ],
      // 回程獎勵
      rewards: [
        { type: 'affection', key: 'blacksmithGra', delta: 3 },
        { type: 'vital',     key: 'mood',          delta: 5 },
        { type: 'flag',      key: 'gra_material_restocked'   },
      ],
      returnLog: '✦ 葛拉接過你扛回來的鐵料、點點頭。「⋯⋯不錯。」',
    },

    // ─── 梅拉買菜 ───────────────────────────────
    cook: {
      id: 'cook',
      label: '梅拉買菜',
      destination: '中央市集',
      companionName: '廚房小妹',
      requireMelaAff:   30,
      requireMasterAff: 30,
      companionLines: [
        { speaker: '廚房小妹', text: '⋯⋯哇你真的是奧林比利？我聽過你！' },
        { speaker: '廚房小妹', text: '梅拉嬸說別讓你拿太多、會壓壞你的肩。' },
        { text: '（她笑著走在你前面、籃子搖晃。）' },
      ],
      pathChatter: [
        { speaker: '廚房小妹', text: '⋯⋯你最喜歡吃什麼？' },
        { speaker: '廚房小妹', text: '我會記下來、跟梅拉嬸說。' },
        { speaker: '廚房小妹', text: '她很挑食材、但對訓練的人她會多放點肉。' },
        { text: '（你想了一下、講不出來。）' },
        { text: '（——你想吃的東西、家鄉那邊的、這城裡買不到。）' },
      ],
      pathChatterHigh: [
        { speaker: '廚房小妹', text: '⋯⋯給你。' },
        { text: '（她從圍裙裡掏出一塊用紙包的東西、塞給你。）' },
        { speaker: '廚房小妹', text: '糖塊。在路上吃、別讓人看到。' },
        { speaker: '廚房小妹', text: '梅拉嬸說的——她說你最近⋯⋯應該會想吃甜的。' },
        { text: '（甜味化在嘴裡、你忽然覺得很想哭。但你忍住了。）' },
      ],
      rewards: [
        { type: 'affection', key: 'melaKook', delta: 3 },
        { type: 'vital',     key: 'food',     delta: 30 },
        { type: 'vital',     key: 'mood',     delta: 8 },
      ],
      returnLog: '✦ 梅拉接過食材、把一碗熱湯推到你面前。「⋯⋯辛苦了、喝了。」',
    },

    // ─── 侍從送信給隔壁訓練所 ──────────────────────
    servant: {
      id: 'servant',
      label: '送信給對面',
      destination: '維努斯場側門',
      companionName: '主人侍從',
      requireServantAff: 20,
      requireMasterAff:  40,
      companionLines: [
        { speaker: '侍從', text: '⋯⋯走吧。送這封、就回。' },
        { speaker: '侍從', text: '對面那家——你看到誰都別理。' },
        { speaker: '侍從', text: '尤其是那個叫布魯圖的。聽到沒？' },
      ],
      pathChatter: [
        { speaker: '侍從', text: '⋯⋯你知道為什麼主人不直接派人去找蓋烏斯老爺嗎？' },
        { speaker: '侍從', text: '因為兩個老人、誰先開口誰就低一頭。' },
        { speaker: '侍從', text: '所以都派下人傳信、表面上是「公事公辦」。' },
        { text: '（你聽著、覺得這城裡的權貴遊戲很累。）' },
      ],
      pathChatterHigh: [
        { speaker: '侍從', text: '⋯⋯告訴你個事。' },
        { speaker: '侍從', text: '對面那家、他們的角鬥士有兩個其實不算「忠心」。' },
        { speaker: '侍從', text: '一個叫凱里烏斯、據說是被禁讀書才一直留著。' },
        { speaker: '侍從', text: '一個叫諾克斯、聽說是被欠薪好幾年。' },
        { speaker: '侍從', text: '⋯⋯主人有時會提到這些。我聽到了、跟你講。' },
        { text: '（侍從沒看你、繼續走。）' },
        { text: '（——這條情報你會記住。）', color: '#d4af37' },
      ],
      rewards: [
        { type: 'affection', key: 'masterServant', delta: 2 },
        { type: 'affection', key: 'masterArtus',   delta: 2 },
        { type: 'vital',     key: 'mood',          delta: 5 },
      ],
      returnLog: '✦ 侍從接過回信、轉身就走。「⋯⋯主人會記得這一筆。」',
    },

    // ─── 巴爺拿器材修補 ────────────────────────────
    overseer: {
      id: 'overseer',
      label: '巴爺拿器材',
      destination: '舊鐵匠街',
      companionName: '巴爺',
      requireOverseerAff: 50,
      requireMasterAff:   0,   // 巴爺自己出面、不用主人允許
      companionLines: [
        { speaker: '巴爺', text: '⋯⋯走、跟我去拿東西。' },
        { speaker: '巴爺', text: '別講話、聽我講就好。' },
        { text: '（巴爺步伐不快、但每一步都穩。你跟在他後面。）' },
      ],
      pathChatter: [
        { speaker: '巴爺', text: '⋯⋯這條街、20 年前我每天走。' },
        { speaker: '巴爺', text: '那時候我還在打。武器壞了、自己來這修。' },
        { speaker: '巴爺', text: '⋯⋯這家鐵匠、是我以前的對手介紹的。' },
        { speaker: '巴爺', text: '他打不死。每次都是平手。' },
        { speaker: '巴爺', text: '⋯⋯後來他傷了腿、退役。我再也沒見過他。' },
      ],
      pathChatterHigh: [
        { speaker: '巴爺', text: '⋯⋯你想知道那個對手叫什麼名字嗎？' },
        { text: '（你點頭。）' },
        { speaker: '巴爺', text: '⋯⋯他自己說他叫無名。' },
        { speaker: '巴爺', text: '但我後來聽人講、他應該姓德拉格。' },
        { speaker: '巴爺', text: '⋯⋯30 年前那家貴族、政變的時候沒了。' },
        { speaker: '巴爺', text: '他可能是倖存的。但這事我從沒講過。' },
        { text: '（你看著巴爺的背影、發現他的肩膀沉得不太自然。）', color: '#888' },
        { text: '（這條秘密你會記住。）', color: '#d4af37' },
      ],
      rewards: [
        { type: 'affection', key: 'overseer', delta: 5 },
        { type: 'vital',     key: 'mood',     delta: 5 },
        { type: 'flag',      key: 'overseer_warstory_heard' },
      ],
      returnLog: '✦ 巴爺把修好的器材交給你扛回去。「⋯⋯回去吧。」',
    },
  };

  // ═══════════════════════════════════════════════════
  // 觸發判斷
  // ═══════════════════════════════════════════════════

  /**
   * 主入口：DayCycle.onDayStart 呼叫
   * @returns {boolean} 是否觸發了跑腿
   */
  function tryStart(newDay) {
    if (!newDay || newDay < 5) return false;     // 太早
    if (Flags.has(`errand_done_day_${newDay}`)) return false;
    if (typeof teammates === 'undefined') return false;

    // 主人好感不夠 — 直接回（連最低差事都沒）
    const masterAff = teammates.getAffection('masterArtus');
    if (masterAff < 30) return false;

    // 10% 機率 / 天
    if (Math.random() > 0.10) return false;

    // 滾源頭：列出符合條件的，隨機抽一個
    const eligible = _getEligibleSources();
    if (eligible.length === 0) return false;
    const source = eligible[Math.floor(Math.random() * eligible.length)];

    // 標記今天已用
    Flags.set(`errand_done_day_${newDay}`, true);

    _runErrand(source);
    return true;
  }

  function _getEligibleSources() {
    const out = [];
    Object.values(SOURCES).forEach(src => {
      if (!_isEligible(src)) return;
      out.push(src);
    });
    return out;
  }

  function _isEligible(src) {
    if (typeof teammates === 'undefined') return false;
    const masterAff = teammates.getAffection('masterArtus');
    if (masterAff < (src.requireMasterAff || 0)) return false;

    if (typeof src.requireGraAff === 'number') {
      const a = teammates.getAffection('blacksmithGra');
      if (a < src.requireGraAff) return false;
    }
    if (typeof src.requireMelaAff === 'number') {
      const a = teammates.getAffection('melaKook');
      if (a < src.requireMelaAff) return false;
    }
    if (typeof src.requireServantAff === 'number') {
      const a = teammates.getAffection('masterServant');
      if (a < src.requireServantAff) return false;
    }
    if (typeof src.requireOverseerAff === 'number') {
      const a = teammates.getAffection('overseer');
      if (a < src.requireOverseerAff) return false;
    }
    return true;
  }

  // ═══════════════════════════════════════════════════
  // 主流程
  // ═══════════════════════════════════════════════════
  function _runErrand(src) {
    _log(`✦ 主人吩咐：你跟 ${src.companionName} 去 ${src.destination}。`, '#c8a060', true);

    if (typeof DialogueModal === 'undefined') {
      // fallback：純 log
      _giveRewards(src);
      return;
    }

    // 串：出門前對白 → 路上閒聊 → 中段事件 → 回程
    DialogueModal.play(_buildDepartureLines(src), {
      onComplete: () => _phasePathChatter(src),
    });
  }

  // ─── 階段 1：出門前對白 ────────────────────────
  function _buildDepartureLines(src) {
    const lines = [
      { text: '（一個僕人走到你身邊、低聲說。）' },
      { speaker: '僕人', text: `⋯⋯主人吩咐、你跟著 ${src.companionName} 去 ${src.destination}。挑東西回來。` },
      { speaker: '僕人', text: '主人說、相信你不會幹傻事。' },
      { speaker: '僕人', text: '城裡守衛很多。準時回來。' },
    ];
    // 加同行者打招呼
    src.companionLines.forEach(l => lines.push(l));
    lines.push({ text: '（你跟著走出側門。陽光比訓練場的耀眼。）' });
    return lines;
  }

  // ─── 階段 2：路上閒聊（50% 觸發）+ 中段事件（30% 機率）─
  function _phasePathChatter(src) {
    const chatter50 = Math.random() < 0.50;

    // 高好感才解鎖的對白（看哪個 NPC）
    const highAff = _hasHighAffWithCompanion(src);
    const lines = [];
    if (chatter50) {
      if (highAff && src.pathChatterHigh) {
        src.pathChatterHigh.forEach(l => lines.push(l));
      } else if (src.pathChatter) {
        src.pathChatter.forEach(l => lines.push(l));
      }
    }

    if (lines.length === 0) {
      _phaseMidEvent(src);
      return;
    }

    DialogueModal.play(lines, {
      onComplete: () => _phaseMidEvent(src),
    });
  }

  function _hasHighAffWithCompanion(src) {
    if (typeof teammates === 'undefined') return false;
    if (src.id === 'blacksmith') return teammates.getAffection('blacksmithGra') >= 60;
    if (src.id === 'cook')       return teammates.getAffection('melaKook')       >= 60;
    if (src.id === 'servant')    return teammates.getAffection('masterServant')  >= 60;
    if (src.id === 'overseer')   return teammates.getAffection('overseer')       >= 60;
    return false;
  }

  // ─── 階段 3：中段隨機事件（30% 機率撞小孩等）──────
  function _phaseMidEvent(src) {
    // E-2 將實作完整撞小孩 3 路徑、目前先 stub：30% 觸發但走純 log 版
    const triggerMid = Math.random() < 0.30;
    if (!triggerMid) {
      _phaseReturn(src);
      return;
    }
    // E-2/3/4/7 接管 — 先以 stub 帶過、保留 hook
    if (typeof ErrandOutings._tryChildBumpEvent === 'function') {
      ErrandOutings._tryChildBumpEvent(src, () => _phaseReturn(src));
    } else {
      _phaseReturn(src);
    }
  }

  // ─── 階段 4：回程 + 獎勵 ───────────────────────
  function _phaseReturn(src) {
    _giveRewards(src);
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play([
        { text: `（${src.companionName} 點點頭。「回去吧。」）` },
        { text: '（你跟著走回訓練場側門。陽光斜了。）' },
      ]);
    }
  }

  // ─── 獎勵套用 ───────────────────────────────
  function _giveRewards(src) {
    if (typeof Effects !== 'undefined' && Effects.apply) {
      Effects.apply(src.rewards, { source: 'errand:' + src.id });
    }
    if (src.returnLog) _log(src.returnLog, '#c8a060', true);
  }

  // ═══════════════════════════════════════════════════
  // 中段事件：撞小孩（E-2 完整版、3 路徑）
  // ═══════════════════════════════════════════════════
  // 設計：[docs/quests/errand-outings.md § 4](../../docs/quests/errand-outings.md)
  //   merciful 特性 → 扶起 + 拿到鳶尾紋飾、主人 -1（拖延）
  //   cruel 特性    → 怒瞪 + 走、主人 +1（準時）、推 pride 軸
  //   neutral       → 僵住、純劇情、無屬性
  //
  // E-3 加碼：50% 機率小孩家有護衛 → ChoiceModal（道歉/幹架/逃）
  // ═══════════════════════════════════════════════════
  function _tryChildBumpEvent(src, onComplete) {
    if (Flags.has('errand_child_bump_done')) {
      // 一個 run 只觸發一次
      onComplete && onComplete();
      return;
    }
    Flags.set('errand_child_bump_done', true);

    // E-3：50% 機率有護衛（占位、E-3 完整實作）
    const hasGuards = Math.random() < 0.50;
    if (hasGuards && typeof ErrandOutings._playGuardSplit === 'function') {
      ErrandOutings._playGuardSplit(src, onComplete);
      return;
    }

    // 3 路徑分流（依玩家特性）
    const path = _resolveChildBumpPath();
    _playChildBump(path, src, onComplete);
  }

  function _resolveChildBumpPath() {
    const p = Stats.player;
    if (!p || !Array.isArray(p.traits)) return 'neutral';
    if (p.traits.includes('cruel'))    return 'cruel';
    if (p.traits.includes('merciful')) return 'merciful';
    if (p.traits.includes('kindness')) return 'merciful';   // kindness 也走仁慈
    return 'neutral';
  }

  // ─── 共通開場 ─────────────────────────────────
  const _CHILD_BUMP_INTRO = [
    { text: '（人潮擁擠、你低著頭走、肩膀不時擦過陌生人。）' },
    { text: '——', effect: 'shake' },
    { text: '（一個小小的身影撞上你的腿、跌坐在地。）', effect: 'shake' },
    { speaker: '小孩', text: '嗚⋯⋯哇——!', color: '#ff8866' },
    { text: '（小孩沾著沙、嘴角發抖、抬頭看你。）' },
  ];

  function _playChildBump(path, src, onComplete) {
    let lines, effects, postLog;

    if (path === 'merciful') {
      lines = [
        ..._CHILD_BUMP_INTRO,
        // 玩家動作
        { text: '（你蹲下、把他扶起來、拍他衣服上的灰。）' },
        // 母親出現：恐懼
        { text: '（一個女人從人群中擠出來、衝過幾個攤販。）' },
        { speaker: '母親', text: '不要——! 不要打他!', color: '#ff6666', effect: 'shake' },
        { text: '（她伸手要拉走小孩、整張臉是恐懼。）' },
        // 認知轉變
        { text: '（她看見你的姿勢——你的手只是扶著、不是抓著。）' },
        { text: '（她愣住了。）' },
        // 母親給護身符
        { text: '（——你看到她從圍裙口袋裡掏出一塊布包。）' },
        { speaker: '母親', text: '⋯⋯這個給你。', color: '#88dd88' },
        { text: '（她塞進你的手裡、不等回應就拉著小孩離開。）' },
        { speaker: '小孩', text: '⋯⋯謝謝叔叔。', color: '#88ccff' },
        // 玩家打開
        { text: '（你打開布包——裡面是一塊小銅飾、繡著鳶尾花紋。）', color: '#d4af37' },
        { text: '（你把它收進懷裡。）' },
        // 同行者催促
        { speaker: src.companionName, text: '⋯⋯走吧。耽誤太久主人會問。' },
      ];
      effects = [
        { type: 'vital',     key: 'mood',           delta: 25 },
        { type: 'vital',     key: 'food',           delta: 20 },
        { type: 'exp',       key: 'STR',            delta: 0  },   // placeholder for kindness EXP — no key yet
        { type: 'affection', key: 'masterArtus',    delta: -1 },   // 拖延扣分
      ];
      postLog = '✦ 你扶起小孩、母親塞給你一塊「鳶尾紋飾」。但這拖延了時間、主人有點不滿。';
      // 推 mercy 軸
      if (typeof Moral !== 'undefined' && Moral.push) Moral.push('mercy', 'positive');
      // 給鳶尾紋飾 personalItem
      _grantIrisCharm();

    } else if (path === 'cruel') {
      lines = [
        ..._CHILD_BUMP_INTRO,
        // 玩家動作
        { text: '（你冷冷看著地上的小孩。）' },
        { text: '（——你沒蹲下。）' },
        { text: '（你瞪了他一眼、轉身要走。）' },
        // 母親出現：嚇到
        { text: '（一個女人從人群中擠出來。）' },
        { speaker: '母親', text: '不要——!', color: '#ff6666', effect: 'shake' },
        { text: '（她衝過來抱住小孩、整個人縮在小孩前面。）' },
        { text: '（她不敢抬頭看你。）' },
        { text: '（小孩在她懷裡發抖、嘴角的血沒擦。）' },
        { text: '（——你走了。）' },
        // 玩家內心
        { text: '⋯⋯' },
        { text: '（你頭也沒回。）' },
        { text: '（但你聽見小孩在哭。）' },
        { text: '（——我看起來像那樣？）', color: '#aa5050' },
        { text: '（——以後做夢、會看到那雙眼睛嗎？）', color: '#aa5050' },
        // 同行者
        { speaker: src.companionName, text: '⋯⋯這就對了。主人不會等你。' },
      ];
      effects = [
        { type: 'vital',     key: 'mood',           delta: -10 },
        { type: 'vital',     key: 'food',           delta: 20 },
        { type: 'affection', key: 'masterArtus',    delta: 1 },   // 準時、護衛回報「沒讓主人丟臉」
      ];
      postLog = '✦ 你冷冷走過。母親拉著小孩、不敢看你。但你準時回家了、主人沒怪你。';
      // 推 pride 軸 + reliability 反向
      if (typeof Moral !== 'undefined' && Moral.push) {
        Moral.push('pride',       'negative');     // prideful
        Moral.push('reliability', 'negative');     // 不可靠（對外人冷漠）
      }
      // 設 flag 觸發後續夢境
      Flags.set('errand_child_bump_cruel_dream', true);

    } else {
      // neutral 路徑
      lines = [
        ..._CHILD_BUMP_INTRO,
        // 玩家僵住
        { text: '（你愣住了。）' },
        { text: '（小孩在腳邊哭、沙土沾在他臉上。）' },
        { text: '（——你的手抬到一半、又放下。）' },
        // 母親默默拉走
        { text: '（一個女人衝過來抱住小孩、看了你一眼、拉他離開。）' },
        { text: '（沒有人說一句話。）' },
        // 玩家內心空虛
        { text: '⋯⋯' },
        { text: '（你站在原地。）' },
        { text: '（——我什麼都沒做。）', color: '#888' },
        { text: '（——但好像有什麼錯過了。）', color: '#888' },
        // 同行者
        { speaker: src.companionName, text: '⋯⋯人擠人、走快點。' },
        { text: '（你跟上去。）' },
      ];
      effects = [
        { type: 'vital', key: 'food', delta: 20 },   // 差事還是完成
      ];
      postLog = '（你什麼都沒做。但有什麼錯過了。）';
    }

    DialogueModal.play(lines, {
      onComplete: () => {
        if (typeof Effects !== 'undefined' && Effects.apply) {
          Effects.apply(effects, { source: 'errand:child_bump:' + path });
        }
        if (postLog) _log(postLog, path === 'merciful' ? '#d4af37' : (path === 'cruel' ? '#aa5050' : '#888'), true);
        onComplete && onComplete();
      },
    });
  }

  // ─── 給鳶尾紋飾 ─────────────────────────────
  function _grantIrisCharm() {
    const p = Stats.player;
    if (!Array.isArray(p.personalItems)) p.personalItems = [];
    if (p.personalItems.includes('dragow_iris')) return;   // 已有
    if (p.personalItems.length >= 6) {
      _log('（你的護符欄滿了、塞不下這塊鳶尾紋飾⋯⋯但你把它收在懷裡。）', '#888', false);
      return;
    }
    p.personalItems.push('dragow_iris');
    Flags.set('has_dragow_iris', true);
    if (typeof Stage !== 'undefined' && Stage.popupBig) {
      Stage.popupBig({
        icon: '🌸', title: '鳶尾紋飾', subtitle: '路人母親的謝禮',
        color: 'gold', duration: 1800, shake: false, sound: 'acquire',
      });
    }
  }

  // ═══════════════════════════════════════════════════
  // 公開 API
  // ═══════════════════════════════════════════════════
  return {
    SOURCES,
    tryStart,
    // E-2 / E-3 內部 hook（給 _phaseMidEvent 呼叫）
    _tryChildBumpEvent,
    // debug — console 直接觸發某源頭
    testRun: (sourceId) => {
      const src = SOURCES[sourceId];
      if (!src) {
        console.warn('[ErrandOutings] unknown source:', sourceId, '— available:', Object.keys(SOURCES));
        return;
      }
      _runErrand(src);
    },
    // debug — 直接演撞小孩某路徑
    testChildBump: (pathOrAuto) => {
      Flags.set('errand_child_bump_done', false);   // unlock
      const fakeSrc = SOURCES.cook;   // 用個源頭當載體
      if (pathOrAuto === 'merciful' || pathOrAuto === 'cruel' || pathOrAuto === 'neutral') {
        _playChildBump(pathOrAuto, fakeSrc);
      } else {
        const path = _resolveChildBumpPath();
        console.log('[ErrandOutings] auto path =', path);
        _playChildBump(path, fakeSrc);
      }
    },
  };
})();
