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
  // 🆕 2026-05-09 P2-8：食物下毒 + 追查事件 完整版
  function checkAssassinationChain(newDay) {
    if (!Flags.has('vesnus_assassination_chain_active')) return;
    const startDay = Flags.get('vesnus_assassination_start_day') || newDay;
    const offset = newDay - startDay;

    if (offset === 5 && !Flags.has('vesnus_assn_food_poison_done')) {
      Flags.set('vesnus_assn_food_poison_done', true);
      _playFoodPoisonEvent();
      return;
    }
    // 🆕 +6：追查事件（只在玩家被毒過、或梅拉勉強警告才觸發）
    if (offset === 6 && !Flags.has('vesnus_assn_poison_investigation_done')) {
      // 條件：玩家中毒過 OR 梅拉警告但要追查（avoided 但有調查衝動）
      const wasPoisoned   = Flags.has('vesnus_assn_food_poisoned');
      const wantsToInvestigate = Flags.has('vesnus_assn_food_poison_investigate');
      if (wasPoisoned || wantsToInvestigate) {
        Flags.set('vesnus_assn_poison_investigation_done', true);
        _playPoisonInvestigation(wasPoisoned);
      }
      return;
    }
    // TODO 後續階段（+15 / +25 / +35）
  }

  // 🆕 NPC 在場守衛
  function _isPresent(npcId) {
    if (typeof GameState === 'undefined' || !GameState.getCurrentNPCs) return true;   // 沒法判斷時假設在場
    const cur = GameState.getCurrentNPCs() || {};
    const list = [...(cur.teammates || []), ...(cur.audience || [])];
    return list.includes(npcId);
  }

  function _playFoodPoisonEvent() {
    const melaAff = (typeof teammates !== 'undefined') ? teammates.getAffection('melaKook') : 0;
    const melaPresent = _isPresent('melaKook');
    // 3-tier detection（per arena-events-roster.md § 5.4）
    let detected = false;
    if (melaPresent && melaAff >= 50) {
      detected = true;
    } else if (melaPresent && melaAff >= 30) {
      detected = Math.random() < 0.50;   // 半信半疑
    } else {
      detected = false;   // 好感不夠 / 梅拉不在場 → 必中毒
    }

    if (detected && melaAff >= 50) {
      _playMelaSavedYou(melaAff);
    } else if (detected && melaAff >= 30) {
      _playMelaHesitatedButCaught(melaAff);
    } else if (melaPresent && melaAff >= 30) {
      _playMelaMissedIt(melaAff);
    } else {
      _playPoisoned(melaAff, melaPresent);
    }
  }

  // 高好感（≥50）：梅拉穩穩接住
  function _playMelaSavedYou(aff) {
    const lines = [
      { text: '（午餐時段。你拿著碗剛走進食堂、梅拉抬頭看你一眼。）' },
      { text: '（她臉色立刻變了——她聞到了什麼。）' },
      { speaker: '梅拉', text: '⋯⋯孩子。今天這碗、別吃。', color: '#9dbf80' },
      { text: '（她伸手、把你的碗從手裡拿走。）' },
      { text: '（動作很快、又像在做平常事一樣自然——周圍沒人察覺。）' },
      { speaker: '梅拉', text: '⋯⋯這碗有東西、不對勁。我聞得出來。' },
      { speaker: '梅拉', text: '⋯⋯應該是哪個雜事的混進來的。我去查。' },
      { text: '（你看著她。）' },
      { speaker: '梅拉', text: '⋯⋯你裝沒看到。我來處理。' },
      { text: '（你低頭、接過她另一個剛盛的碗、坐下吃。）' },
      { text: '⋯⋯', color: '#666' },
      { text: '（——是蓋烏斯下手了。逃過一劫。）', color: '#aa8855' },
      { text: '（這碗熱粥、可能是這幾年最甜的一碗。）', color: '#aa8855' },
    ];
    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    Flags.set('vesnus_assn_food_poison_avoided', true);
    Flags.set('vesnus_assn_food_poison_investigate', true);   // 梅拉會追查、+6 事件觸發
    if (typeof teammates !== 'undefined' && teammates.modAffection) {
      teammates.modAffection('melaKook', 5);
    }
    if (typeof Stats !== 'undefined' && Stats.modVital) {
      Stats.modVital('mood', 5);
    }
    _log(`✦ 梅拉聞出毒、把碗拿走。（梅拉好感 ${aff}）逃過一劫、明天她會追查。`, '#88dd66', true);
  }

  // 中好感（30-49）通過 50% 擲骰：梅拉勉強察覺、不確定
  function _playMelaHesitatedButCaught(aff) {
    const lines = [
      { text: '（午餐時段。你拿著碗坐下。）' },
      { text: '（梅拉路過、瞥了你的碗一眼、停下。）' },
      { speaker: '梅拉', text: '⋯⋯（她皺眉。）', color: '#9dbf80' },
      { speaker: '梅拉', text: '孩子⋯⋯這碗、是哪鍋的？' },
      { text: '（你說不出來。她拿起碗、聞了聞。）' },
      { speaker: '梅拉', text: '⋯⋯', color: '#9dbf80' },
      { speaker: '梅拉', text: '⋯⋯不對。換一碗。' },
      { text: '（她沒講為什麼。但她臉色不對。）' },
      { text: '（你接過新的碗、低頭吃。）' },
      { text: '⋯⋯', color: '#666' },
      { text: '（——梅拉沒講、但你猜到了。）', color: '#aa8855' },
      { text: '（——她不是 100% 確定、但她寧可換一碗。）', color: '#aa8855' },
    ];
    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    Flags.set('vesnus_assn_food_poison_avoided', true);
    Flags.set('vesnus_assn_food_poison_investigate', true);
    if (typeof teammates !== 'undefined' && teammates.modAffection) {
      teammates.modAffection('melaKook', 3);
    }
    _log(`✦ 梅拉勉強察覺、把碗換掉（好感 ${aff}、運氣救了你）。`, '#aacc88', true);
  }

  // 中好感（30-49）擲骰失敗：梅拉路過沒看出來、玩家中毒
  function _playMelaMissedIt(aff) {
    const lines = [
      { text: '（午餐時段。你拿著碗坐下。）' },
      { text: '（梅拉路過你旁邊、瞥了一眼、繼續走。）' },
      { text: '（她停了半秒、又繼續走——可能只是在想晚餐要做什麼。）' },
      { text: '（你低頭、開始吃。）' },
      { text: '（兩口⋯⋯三口⋯⋯）' },
      { text: '⋯⋯', color: '#666' },
      { text: '（——突然胃絞了一下。）', effect: 'shake', color: '#cc6666' },
      { text: '（——舌根發麻。）', color: '#cc6666' },
      { text: '（碗從手裡掉到地上。砰一聲。）', effect: 'shake' },
      { speaker: '梅拉', text: '——孩子！', color: '#9dbf80' },
      { text: '（梅拉衝過來——但已經晚了。）' },
      { speaker: '老默', text: '⋯⋯催吐！誰幫我翻過來！', color: '#cc6666' },
      { text: '（你最後聽到的、是梅拉低聲咒罵自己。）', color: '#888' },
      { text: '（——她剛才路過時、好像聞到什麼、但沒確定。）', color: '#888' },
      { text: '⋯⋯', color: '#666' },
      { text: '（半天後、你醒來。胃還在抽。）' },
    ];
    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    Flags.set('vesnus_assn_food_poisoned', true);
    if (typeof Stats !== 'undefined' && Stats.modVital) {
      Stats.modVital('hp', -30);
      Stats.modVital('stamina', -50);
      Stats.modVital('mood', -20);
    }
    _log(`✦ 梅拉沒察覺到（好感 ${aff}、擲骰失敗）你中毒了。HP -30、體力 -50、心情 -20。`, '#cc6666', true);
  }

  // 低好感（< 30）或梅拉不在場：直接中毒
  function _playPoisoned(aff, melaPresent) {
    const lines = [
      { text: '（午餐時段。你拿著碗坐下。）' },
    ];
    if (!melaPresent) {
      lines.push({ text: '（今天梅拉不在廚房。新來的女僕端的飯。）' });
    } else {
      lines.push({ text: '（梅拉在廚房另一頭、忙著切菜、沒抬頭。）' });
      lines.push({ text: '（——她不認識你。也不會為了你多看一眼。）', color: '#888' });
    }
    lines.push(
      { text: '（你低頭、開始吃。）' },
      { text: '（兩口⋯⋯三口⋯⋯）' },
      { text: '⋯⋯', color: '#666' },
      { text: '（——胃突然絞痛。）', effect: 'shake', color: '#cc6666' },
      { text: '（——舌頭發麻、嘴裡是鐵味。）', color: '#cc6666' },
      { text: '（你想站起來——腿軟、跌坐回去。）', effect: 'shake' },
      { text: '（碗砸在地上。觀眾席（如果是用餐區的話）有人喊：「他吐了！」）' },
      { speaker: '老默', text: '⋯⋯催吐！誰把他翻過來、按住舌頭！', color: '#cc6666' },
      { text: '（你最後看到的、是天花板的橫樑。然後黑了。）', color: '#666' },
      { text: '⋯⋯', color: '#666' },
      { text: '（半天後、你醒來。胃像被人用木棍攪過。）' },
      { text: '（——是有人下毒。）', color: '#aa6666' },
      { text: '（——你不知道是誰、但你會查。）', color: '#aa6666' },
    );
    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    Flags.set('vesnus_assn_food_poisoned', true);
    if (typeof Stats !== 'undefined' && Stats.modVital) {
      Stats.modVital('hp', -30);
      Stats.modVital('stamina', -50);
      Stats.modVital('mood', -20);
    }
    _log(`✦ 你中毒了！（梅拉好感 ${aff}${melaPresent ? '' : '、不在場'}）HP -30、體力 -50、心情 -20。`, '#cc6666', true);
  }

  // ═══════════════════════════════════════════════════
  // 🆕 +6：追查下毒者事件
  // ═══════════════════════════════════════════════════
  // 玩家 / 梅拉聯手查毒源 → 揭露女僕被收買 → 1v1 戰鬥
  // 贏：抓到下毒者、知道是蓋烏斯買的（記 flag）
  // 輸：女僕逃走、毒源不明（之後別的暗殺事件繼續）
  function _playPoisonInvestigation(wasPoisoned) {
    const lines = [
      { text: wasPoisoned
          ? '（隔天清晨。你還沒完全恢復、但能站起來。）'
          : '（隔天清晨。梅拉一大早就在等你。）'
      },
    ];
    if (_isPresent('melaKook')) {
      lines.push(
        { speaker: '梅拉', text: '⋯⋯孩子。我查到了。', color: '#9dbf80' },
        { speaker: '梅拉', text: '⋯⋯昨天那碗、是新來的女僕蕾娜端的。' },
        { speaker: '梅拉', text: '⋯⋯她不在訓練所過夜、住在外面的客棧。' },
        { speaker: '梅拉', text: '⋯⋯我查了一下、她跟維努斯場的一個僕人有來往。' },
        { text: '（梅拉壓低聲音。）' },
        { speaker: '梅拉', text: '⋯⋯今天她中午會來領薪、你在門口攔她。' },
        { speaker: '梅拉', text: '⋯⋯別讓她跑了。' },
      );
    } else {
      lines.push(
        { text: '（你自己查了一夜——問廚房幫工、看食物進貨單。）' },
        { text: '（線索指向新來的女僕「蕾娜」——昨天唯一一個有機會碰到你那碗的人。）' },
        { text: '（她不在訓練所過夜、住在外面的客棧。）' },
        { text: '（你決定中午她回來領薪時、把她攔下來。）' },
      );
    }
    lines.push(
      { text: '⋯⋯', color: '#666' },
      { text: '（中午。她回來了——一個瘦小的女人、二十來歲、眼神閃避。）' },
      { text: '（你站在門口、擋住她的去路。）' },
      { speaker: '蕾娜', text: '⋯⋯讓開！我要去領薪！' },
      { speaker: wasPoisoned ? '玩家' : '玩家', text: '⋯⋯昨天的飯、是你下的吧。' },
      { text: '（她臉色一變——僵了一秒、然後從袖子裡抽出一把短匕首。）' },
      { speaker: '蕾娜', text: '⋯⋯你他媽別過來！' },
      { text: '（——她要拼。）', color: '#cc6666' },
    );

    const startBattle = () => {
      const renaCfg = {
        name: '蕾娜', title: '被收買的女僕',
        STR: 22, DEX: 38, CON: 22, AGI: 38, WIL: 18, LUK: 8,
        hpBase: 80,
        weaponId: 'dagger', armorId: 'rags',
        ai: 'aggressive', fame: 0,
      };
      const onWin = () => {
        Flags.set('vesnus_assn_poisoner_caught', true);
        _playInvestigationWinReveal();
      };
      const onLose = () => {
        Flags.set('vesnus_assn_poisoner_escaped', true);
        _playInvestigationLoseReveal();
      };
      if (typeof Battle !== 'undefined' && Battle.startFromConfig) {
        Battle.startFromConfig({
          title: '追查下毒者',
          fameReward: 5,
          enemies: [renaCfg],
          allies:  [],
        }, onWin, onLose);
      } else {
        _playInvestigationWinReveal();
      }
    };

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, { onComplete: startBattle });
    } else {
      startBattle();
    }
  }

  function _playInvestigationWinReveal() {
    const lines = [
      { text: '（蕾娜倒在門廊上、手裡的匕首掉在石板上。）' },
      { text: '（她沒死、只是斷了反抗的力。）' },
      { speaker: '玩家', text: '⋯⋯誰買的你？' },
      { speaker: '蕾娜', text: '⋯⋯（她別過頭、不講話。）' },
      { text: '（你拿起她的匕首、冷冷地放在她臉旁邊。）' },
      { speaker: '蕾娜', text: '⋯⋯維努斯場的⋯⋯一個叫德基烏斯的⋯⋯' },
      { speaker: '蕾娜', text: '⋯⋯給了我兩個月薪水。我家裡有人病了⋯⋯', color: '#888' },
      { text: '（她哭了。你看著她。）' },
      { text: '⋯⋯', color: '#666' },
      { text: '（你心裡知道——這個女人不是真兇。她是個工具。）', color: '#aa8855' },
      { text: '（真兇在維努斯場陽台上、優雅地喝著葡萄酒。）', color: '#aa8855' },
      { speaker: '塔倫', text: '⋯⋯這事我來辦。她送官府。', color: '#883333' },
      { text: '（塔倫不知什麼時候已經到了。他帶人把蕾娜拖走。）' },
      { text: '（——你站在門廊上、手裡還拿著她的匕首。）' },
      { text: '（——名聲 +5、阿圖斯場好感 +3、蓋烏斯/德基烏斯仇值 +1）', color: '#aa6666' },
    ];
    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    if (typeof Stats !== 'undefined') {
      Stats.modFame(5);
    }
    if (typeof teammates !== 'undefined' && teammates.modAffection) {
      teammates.modAffection('masterArtus', 3);
      teammates.modAffection('vesnusDecius', -10);
    }
    Flags.set('decius_betrayal_witnessed', true);   // 跟 P2-5 共用 flag
    _log('✦ 抓到下毒者蕾娜、揭露德基烏斯買兇。+5 名聲、阿圖斯 +3。', '#88dd66', true);
  }

  function _playInvestigationLoseReveal() {
    const lines = [
      { text: '（蕾娜抓住空檔、從你身邊溜過去。）' },
      { text: '（你想追、腿軟跌了一跤。）' },
      { text: '（她跑出大門、消失在街口。）' },
      { text: '⋯⋯', color: '#666' },
      { text: '（——她跑了。下毒的人逃了。）', color: '#888' },
      { text: '（——蓋烏斯這條線、你還沒查到。）', color: '#888' },
      { text: '（你回訓練場、什麼也沒講。）' },
    ];
    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    if (typeof Stats !== 'undefined') {
      Stats.modVital('mood', -10);
    }
    _log('✦ 蕾娜逃走、毒源未查明。心情 -10。', '#aa6666', true);
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
    testInvestigation: (poisoned) => _playPoisonInvestigation(!!poisoned),
  };
})();
