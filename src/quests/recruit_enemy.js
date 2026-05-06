/**
 * recruit_enemy.js — 招敵變友機制（P2-7）
 *
 * 設計：[docs/quests/arena-events-roster.md § 5](../../docs/quests/arena-events-roster.md)
 *
 * 5 步驟流程:
 *   1. 前期遇到（弱化版）— 友鄰切磋玩家打贏 + 選擇放過 → 觸發 seed flag
 *   2. 種子事件 — 對方賽後私下找玩家、留下「我欠你一次」
 *   3. 累積互動 — storyReveal / 給觸發品 → 好感 ≥ 60
 *   4. 正式邀請 — Day 60+ ChoiceModal「要不要勸他跳過來」
 *   5. 成功/失敗分歧 — 蓋烏斯暗殺鏈啟動
 *
 * 候選 NPC（2 個）:
 *   - vesnusCaelius (Caelius 凱里烏斯) — 帥氣劍士、被禁讀寫、觸發品 = 一本書
 *   - vesnusNox (諾克斯) — 鐵漢老兵、被欠薪、觸發品 = 金錢 200
 *
 * 觸發 hook:
 *   - cross_ludus_events.js 友鄰切磋 onWin 呼叫 seedRecruit()
 *   - DayCycle.onDayStart 檢查邀請條件、玩家好感 ≥ 60 + 已給觸發品 → 觸發邀請
 */
const RecruitEnemyQuest = (() => {

  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    }
  }

  // 候選 NPC 配置
  const CANDIDATES = {
    vesnusCaelius: {
      id: 'vesnusCaelius',
      name: '凱里烏斯',
      title: '維努斯場・帥氣劍士',
      seedLines: [
        { text: '（你站起身、他卻從沙地裡撐起。）' },
        { text: '（他看了你一眼、沒道謝、只是把武器丟到一邊。）' },
        { speaker: '凱里烏斯', text: '⋯⋯你大可一刀。', color: '#aa9966' },
        { speaker: '凱里烏斯', text: '為什麼？' },
        { text: '（你跟他講了幾句。他點點頭。）' },
        { speaker: '凱里烏斯', text: '⋯⋯記住這個。' },
        { speaker: '凱里烏斯', text: '我欠你一次。' },
        { text: '（他走進維努斯場的人群裡。）' },
      ],
      itemTrigger: 'literacy_book',   // 一本書（識字本）
      itemHint: '凱里烏斯被蓋烏斯禁止學讀寫。也許一本書能讓他看到不一樣的世界。',
    },
    vesnusNox: {
      id: 'vesnusNox',
      name: '諾克斯',
      title: '維努斯場・鐵漢老兵',
      seedLines: [
        { text: '（你站起身。他重重坐在沙地上、沒掙扎。）' },
        { speaker: '諾克斯', text: '⋯⋯為什麼不殺？', color: '#aa9966' },
        { text: '（你跟他講了幾句。他冷笑。）' },
        { speaker: '諾克斯', text: '⋯⋯老頭子像我這樣的、誰還會手下留情？' },
        { speaker: '諾克斯', text: '⋯⋯記住這筆。' },
        { speaker: '諾克斯', text: '蓋烏斯欠我兩年薪水。' },
        { speaker: '諾克斯', text: '⋯⋯我欠你一次。' },
        { text: '（他撐著起身、跛著走了。）' },
      ],
      itemTrigger: 'money',
      itemAmount: 200,
      itemHint: '諾克斯被蓋烏斯欠薪兩年。一筆現金可能讓他看到出口。',
    },
  };

  // ═══════════════════════════════════════════════════
  // 階段 1：友鄰切磋勝利 + 選擇放過 → 種子
  // ═══════════════════════════════════════════════════
  /**
   * 由 cross_ludus_events.js 友鄰切磋 onWin 呼叫
   * @param {string} npcId 對手 ID（vesnusCaelius / vesnusNox）
   */
  function trySeedFromSparring(npcId) {
    if (!CANDIDATES[npcId]) return false;
    const seedFlag = `recruit_seeded_${npcId}`;
    if (Flags.has(seedFlag)) return false;   // 已種過

    // 玩家有 mercy/kindness 特性 → 自動放過 → 種子
    // 沒特性 → 50% 機率玩家會「下意識手軟」（避免完全沒機會）
    const p = Stats.player;
    const isMerciful = Array.isArray(p.traits) && (p.traits.includes('merciful') || p.traits.includes('kindness'));
    if (!isMerciful && Math.random() > 0.5) return false;

    Flags.set(seedFlag, true);
    _playSeedEvent(npcId);
    return true;
  }

  function _playSeedEvent(npcId) {
    const cand = CANDIDATES[npcId];
    if (typeof DialogueModal === 'undefined') {
      _log(`✦ 你放過 ${cand.name}。他默默走了、但你能感覺到他心裡留下了什麼。`, '#aa9966', true);
      return;
    }
    DialogueModal.play(cand.seedLines, {
      onComplete: () => {
        // 給玩家對該 NPC 一個基準好感
        if (typeof teammates !== 'undefined') {
          teammates.modAffection(npcId, 10);
        }
        _log(`✦ 你放過 ${cand.name}。種下了種子。`, '#aa9966', true);
      },
    });
  }

  // ═══════════════════════════════════════════════════
  // 階段 2-3：累積好感（不用主動實作、跨訓練所事件 + 給東西）
  // ═══════════════════════════════════════════════════
  // - 友鄰切磋偶爾撞到對方 + 沒打 → +5 好感
  // - 玩家「給東西」（在 Day N 時、用 console 或事件 hook 給）
  //   會設 recruit_gave_trigger_${npcId} flag

  /**
   * 玩家給對方「觸發品」（書 / 錢）→ 推進到可邀請狀態
   *   未來可在 ChoiceModal 中作為「給東西」選項
   */
  function giveTriggerItem(npcId) {
    const cand = CANDIDATES[npcId];
    if (!cand) return false;
    const seedFlag = `recruit_seeded_${npcId}`;
    if (!Flags.has(seedFlag)) {
      _log('（你還沒跟他建立任何關係。）', '#888', false);
      return false;
    }
    const giveFlag = `recruit_gave_${npcId}`;
    if (Flags.has(giveFlag)) {
      _log('（你已經給過他了。）', '#888', false);
      return false;
    }

    // 檢查觸發品
    const p = Stats.player;
    if (cand.itemTrigger === 'literacy_book') {
      // 簡化：玩家有任一「文字書」都能用（books.js 中的識字類）
      const books = Array.isArray(p.bookshelf) ? p.bookshelf : [];
      if (books.length === 0) {
        _log('（你身邊沒有書能給他。）', '#888', false);
        return false;
      }
      // 不真的扣書（因為書是長期擁有資源）— 純標記
    } else if (cand.itemTrigger === 'money') {
      const need = cand.itemAmount || 200;
      if ((p.money || 0) < need) {
        _log(`（你現在沒有 ${need} 銅幣可以給他。）`, '#888', false);
        return false;
      }
      Stats.modMoney(-need);
    }

    Flags.set(giveFlag, true);
    if (typeof teammates !== 'undefined') teammates.modAffection(npcId, 20);
    _log(`✦ 你給了 ${cand.name} ${cand.itemTrigger === 'money' ? cand.itemAmount + ' 銅幣' : '一本書'}。他眼神不一樣了。`, '#d4af37', true);
    return true;
  }

  // ═══════════════════════════════════════════════════
  // 階段 4：正式邀請（Day 60+、好感 ≥ 60 + 給過觸發品）
  // ═══════════════════════════════════════════════════
  function tryInvite(newDay) {
    if (newDay < 60) return false;
    if (Flags.has('recruit_invite_done')) return false;
    if (typeof teammates === 'undefined') return false;

    // 檢查每個候選
    for (const npcId of Object.keys(CANDIDATES)) {
      const seedFlag = `recruit_seeded_${npcId}`;
      const giveFlag = `recruit_gave_${npcId}`;
      if (!Flags.has(seedFlag)) continue;
      if (!Flags.has(giveFlag)) continue;
      const aff = teammates.getAffection(npcId);
      if (aff < 60) continue;

      // 條件達成 → 30% 機率今天觸發邀請
      if (Math.random() > 0.30) continue;

      Flags.set('recruit_invite_done', true);
      _playInviteScene(npcId);
      return true;
    }
    return false;
  }

  function _playInviteScene(npcId) {
    const cand = CANDIDATES[npcId];
    const introLines = [
      { text: `（${cand.name} 在友鄰切磋的後場找你。沒有別人。）` },
      { speaker: cand.name, text: '⋯⋯小弟、我有話跟你講。', color: '#aa9966' },
      { speaker: cand.name, text: '⋯⋯你給我那個東西、我懂你的意思。' },
      { text: '（他壓低聲音。）' },
      { speaker: cand.name, text: '⋯⋯但我自己跑、被抓回去就死。' },
      { speaker: cand.name, text: '⋯⋯你要不要去跟阿圖斯講？' },
      { speaker: cand.name, text: '⋯⋯說你要把我「買過去」。' },
      { speaker: cand.name, text: '⋯⋯我可以裝病、裝廢、讓蓋烏斯不想要。' },
      { speaker: cand.name, text: '⋯⋯你跟阿圖斯談。' },
    ];

    if (typeof ChoiceModal === 'undefined') {
      // fallback：直接拒絕
      _resolveInvite(npcId, 'reject');
      return;
    }

    const showChoice = () => {
      ChoiceModal.show({
        id: 'recruit_invite_choice',
        icon: '⚖',
        title: `要不要勸 ${cand.name} 跳過來？`,
        body: '他願意幫忙。但風險在你身上 — 蓋烏斯會記恨。',
        forced: true,
        choices: [
          { id: 'persuade', label: '⋯⋯我去跟阿圖斯談。',  hint: '成功率看好感 + 主人好感、蓋烏斯會啟動暗殺鏈' },
          { id: 'reject',   label: '⋯⋯太危險了。我不行。', hint: '保險、無事、好感 -10' },
        ],
      }, {
        onChoose: (choiceId) => _resolveInvite(npcId, choiceId),
      });
    };

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(introLines, { onComplete: showChoice });
    } else {
      showChoice();
    }
  }

  function _resolveInvite(npcId, choiceId) {
    const cand = CANDIDATES[npcId];

    if (choiceId === 'reject') {
      if (typeof teammates !== 'undefined') teammates.modAffection(npcId, -10);
      _log(`✦ 你拒絕了 ${cand.name}。他點點頭、沒怪你、但不會再找你了。`, '#888', true);
      Flags.set(`recruit_rejected_${npcId}`, true);
      return;
    }

    // 試圖說服阿圖斯：機率判定
    //   主人好感 ≥ 50 + NPC 好感 ≥ 70 → 80% 成功
    //   主人好感 ≥ 30 → 50%
    //   否則 30%
    const masterAff = teammates.getAffection('masterArtus');
    const npcAff = teammates.getAffection(npcId);

    let successRate = 0.30;
    if (masterAff >= 50 && npcAff >= 70) successRate = 0.80;
    else if (masterAff >= 30) successRate = 0.50;

    const success = Math.random() < successRate;

    if (success) {
      _playInviteSuccess(npcId);
    } else {
      _playInviteFailure(npcId);
    }
  }

  function _playInviteSuccess(npcId) {
    const cand = CANDIDATES[npcId];
    const lines = [
      { text: '（你跟阿圖斯談了。）' },
      { speaker: '阿圖斯', text: `⋯⋯${cand.name}？我看看。` },
      { text: '（他想了一下。）' },
      { speaker: '阿圖斯', text: '⋯⋯好。我去找蓋烏斯談。' },
      { text: '（一週後、文書送到。）' },
      { text: `（${cand.name} 走進阿圖斯場、跟你打招呼。）` },
      { speaker: cand.name, text: '⋯⋯小弟。', color: '#88dd66' },
      { speaker: cand.name, text: '⋯⋯謝了。' },
      { text: '（他不講廢話、轉身去報到。）' },
      { text: '（——他現在是你的人了。）', color: '#d4af37' },
      { text: '（——但蓋烏斯會記恨。你要小心。）', color: '#ff8866' },
    ];

    Flags.set(`recruit_succeeded_${npcId}`, true);
    Flags.set('vesnus_assassination_chain_active', true);
    Flags.set('vesnus_assassination_start_day', Stats.player.day);
    if (typeof teammates !== 'undefined') {
      teammates.modAffection(npcId, 30);
      teammates.modAffection('gaius', -30);   // 蓋烏斯震怒
    }

    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    _log(`✦ ${cand.name} 來到阿圖斯場！蓋烏斯震怒、暗殺鏈啟動。`, '#88dd66', true);
  }

  function _playInviteFailure(npcId) {
    const cand = CANDIDATES[npcId];
    const lines = [
      { text: '（你跟阿圖斯談了。）' },
      { speaker: '阿圖斯', text: `⋯⋯${cand.name}？` },
      { text: '（他搖頭。）' },
      { speaker: '阿圖斯', text: '⋯⋯太貴。蓋烏斯不會肯。' },
      { speaker: '阿圖斯', text: '⋯⋯而且我也不想為了一個鬥士跟他撕破臉。' },
      { text: '（談話結束。）' },
      { text: '（隔天、你看到 ${cand.name} 在維努斯場、像什麼都沒發生。）'.replace('${cand.name}', cand.name) },
      { text: '（——但你知道蓋烏斯已經查到。）', color: '#ff8866' },
      { text: '（——他在準備什麼。）', color: '#ff8866' },
    ];

    Flags.set(`recruit_failed_${npcId}`, true);
    Flags.set('vesnus_assassination_chain_active', true);
    Flags.set('vesnus_assassination_start_day', Stats.player.day);
    if (typeof teammates !== 'undefined') teammates.modAffection('gaius', -20);

    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    _log(`✦ 阿圖斯不肯談。${cand.name} 留在維努斯場、但蓋烏斯已經查到、暗殺鏈啟動。`, '#aa5555', true);
  }

  // ═══════════════════════════════════════════════════
  // 階段 5：蓋烏斯暗殺鏈（觸發後一系列 hook）
  // ═══════════════════════════════════════════════════
  // 5 階段（依 day offset）：
  //   +5 食物下毒 / +6 追查 / +15 第一次暗殺 / +25 競技場下毒 / +35 黑爪登場
  //
  // 本輪實作 stub — 完整版另外做
  function checkAssassinationChain(newDay) {
    if (!Flags.has('vesnus_assassination_chain_active')) return;
    const startDay = Flags.get('vesnus_assassination_start_day') || newDay;
    const offset = newDay - startDay;

    if (offset === 5 && !Flags.has('vesnus_assn_food_poison_done')) {
      Flags.set('vesnus_assn_food_poison_done', true);
      _playFoodPoisonEvent();
    }
    // TODO 後續階段
  }

  function _playFoodPoisonEvent() {
    const melaAff = (typeof teammates !== 'undefined') ? teammates.getAffection('melaKook') : 0;
    if (melaAff >= 50) {
      // 梅拉警告、玩家不中毒
      const lines = [
        { speaker: '梅拉', text: '孩子⋯⋯今天這碗、別吃。', color: '#9dbf80' },
        { text: '（她壓低聲音、把碗從你面前拿走。）' },
        { speaker: '梅拉', text: '⋯⋯有人下毒。我聞得出。' },
        { speaker: '梅拉', text: '⋯⋯這事我去處理。你裝沒看到。' },
        { text: '（——蓋烏斯下手了。但你逃過一劫。）', color: '#ff8866' },
      ];
      if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
      Flags.set('vesnus_assn_food_poison_avoided', true);
    } else {
      // 玩家中毒
      const lines = [
        { text: '（你吃了一半的飯。）' },
        { text: '（——胃突然絞痛。）' },
        { text: '（——舌頭發麻。）' },
        { text: '（你倒在地上。）' },
        { speaker: '老默', text: '⋯⋯催吐！誰把他翻過來！', color: '#cc6666' },
        { text: '（半天後、你醒來。HP 大跌、體力虛脫。）' },
      ];
      if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
      Stats.modVital('hp', -30);
      Stats.modVital('stamina', -50);
      Stats.modVital('mood', -20);
    }
  }

  // ═══════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════
  function init() {
    if (typeof DayCycle === 'undefined' || typeof DayCycle.onDayStart !== 'function') return;
    DayCycle.onDayStart('recruitEnemy', (newDay) => {
      checkAssassinationChain(newDay);
      tryInvite(newDay);
    }, 60);
  }

  init();

  return {
    init,
    CANDIDATES,
    trySeedFromSparring,
    giveTriggerItem,
    tryInvite,
    checkAssassinationChain,
    // debug
    testSeed:    (npcId) => _playSeedEvent(npcId || 'vesnusCaelius'),
    testInvite:  (npcId) => _playInviteScene(npcId || 'vesnusCaelius'),
    testPoison:  () => _playFoodPoisonEvent(),
  };
})();
