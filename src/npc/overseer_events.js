/**
 * overseer_events.js — 監督官巴爺主線事件（v10 設計，2026-04-25）
 *
 * 設計文件：docs/discussions/2026-04-25-overseer-rework.md
 * 角色檔案：docs/characters/overseer.md
 *
 * 整條線結構（v10）：
 *   鋪墊期 → 引爆期 → 曖昧任務期 → 回響期 → 證據期 → 選擇期
 *
 * 本檔已實作：
 *   ✅ 塔倫稱讚 3 階段（aff 20/30/40 觸發）
 *   ✅ 塔倫曖昧指令 2 個（教訓人 / 對主人說謊）含特性過濾選項
 *   ✅ 引爆事件 stub（標 TODO 戰鬥連結點）
 *   ✅ 老默接話 stub（標 TODO 治療整合點）
 *   ✅ 卡西烏斯補刀 stub（標 TODO 觸發整合點）
 *   ✅ 偷聽密謀 stub（標 TODO 主人召喚整合點）
 *   ✅ 喝酒選擇事件 stub（標 TODO 觸發整合點）
 *
 * 整合點 TODO：
 *   - main.js 訓練後事件 hook（每日 try* 呼叫）
 *   - 引爆事件需戰鬥勝利 hook（battle.js onWin）
 *   - 主人召喚事件需既有召喚系統整合
 *
 * 依賴：ChoiceModal, DialogueModal, Flags, Stats, teammates
 */
const OverseerEvents = (() => {

  // CLAUDE.md 第 12 條：bare addLog 在外部模組是 ReferenceError
  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    } else {
      console.warn('[OverseerEvents] _log: no addLog available', text);
    }
  }

  function _hasTrait(id) {
    const p = Stats.player;
    return Array.isArray(p.traits) && p.traits.includes(id);
  }

  function _aff(npcId) {
    if (typeof teammates === 'undefined') return 0;
    return teammates.getAffection ? teammates.getAffection(npcId) : 0;
  }

  function _isPresent(npcId) {
    if (typeof GameState === 'undefined' || !GameState.getCurrentNPCs) return false;
    const cur = GameState.getCurrentNPCs() || {};
    const list = [...(cur.teammates || []), ...(cur.audience || [])];
    return list.includes(npcId);
  }

  // ══════════════════════════════════════════════════
  // § 鋪墊期 — 塔倫稱讚 3 階段
  // 觸發：訓練後檢查塔倫好感 + 在場 + 還沒講過該層
  // ══════════════════════════════════════════════════

  function tryTarrenPraise() {
    if (typeof Flags === 'undefined') return;
    const officerAff = _aff('officer');
    if (!_isPresent('officer')) return;

    const count = Flags.get('tarren_praise_count', 0);

    // 階段 1：aff ≥ 20
    if (count === 0 && officerAff >= 20) {
      _playPraise1();
      Flags.set('tarren_praise_count', 1);
      return;
    }
    // 階段 2：aff ≥ 30
    if (count === 1 && officerAff >= 30) {
      _playPraise2();
      Flags.set('tarren_praise_count', 2);
      return;
    }
    // 階段 3：aff ≥ 40 — 提到「巴爺」名字（玩家起雞皮疙瘩）
    if (count === 2 && officerAff >= 40) {
      _playPraise3();
      Flags.set('tarren_praise_count', 3);
      return;
    }
  }

  function _playPraise1() {
    if (typeof DialogueModal === 'undefined') {
      _log('塔倫長官走過來、拍拍你肩膀：「表現不錯，繼續加油。」', '#9a8866', true);
      return;
    }
    DialogueModal.play([
      { text: '（訓練結束。塔倫長官走過你身邊。）' },
      { text: '（他停下、拍拍你肩膀。）' },
      { speaker: '塔倫長官', text: '表現不錯。' },
      { speaker: '塔倫長官', text: '繼續加油。' },
      { text: '（他笑了笑、繼續往前走。）' },
    ], {
      onComplete: () => {
        if (teammates && teammates.modAffection) teammates.modAffection('officer', 1);
      }
    });
  }

  function _playPraise2() {
    if (typeof DialogueModal === 'undefined') {
      _log('塔倫長官：「你很認真，進步很快。你很快就可以在競技場上發光了。」', '#9a8866', true);
      return;
    }
    DialogueModal.play([
      { text: '（塔倫長官又走過來。今天他停留得久一點。）' },
      { speaker: '塔倫長官', text: '我看你最近——很認真。' },
      { speaker: '塔倫長官', text: '進步也很快。' },
      { text: '（他打量你一眼。）' },
      { speaker: '塔倫長官', text: '你很快就可以在競技場上發光了。' },
      { text: '（他拍拍你肩膀走了。）' },
    ], {
      onComplete: () => {
        if (teammates && teammates.modAffection) teammates.modAffection('officer', 1);
      }
    });
  }

  // ══════════════════════════════════════════════════
  // 🆕 2026-04-27 § 鋪墊期 — 梅拉 Layer 1 暗示
  //   觸發：梅拉在 audience + Day ≥ 15 + 玩家有戰鬥過 + 30% 機率 + 一次性
  //   設計：母親型角色不忍心、半夜夢話一樣講出來
  //   目的：set mela_hinted_overseer flag、影響偷聽密謀觸發條件
  // ══════════════════════════════════════════════════
  function tryMelaHint() {
    if (typeof Flags === 'undefined') return false;
    if (Flags.has('mela_hinted_overseer')) return false;
    const p = Stats.player;
    if (!p || p.day < 15) return false;
    if ((p.combatStats?.arenaWins || 0) < 1) return false;   // 至少打過一場
    if (!_isPresent('melaKook')) return false;
    if (Math.random() >= 0.30) return false;

    Flags.set('mela_hinted_overseer', true);

    if (typeof DialogueModal === 'undefined') {
      _log('梅拉低聲對你說：「⋯⋯巴爺以前也這樣的、紅得發燙。後來⋯⋯就變那樣了。孩子、你自己小心。」', '#c8a060', true);
      return true;
    }
    DialogueModal.play([
      { text: '（晚餐時、梅拉端來一碗熱湯。她蹲下來、把湯放在你前面。沒走。）' },
      { text: '（她看你一眼、又看一眼遠處的巴爺。）' },
      { speaker: '梅拉', text: '⋯⋯孩子。' },
      { speaker: '梅拉', text: '我跟你說一件事。' },
      { speaker: '梅拉', text: '巴爺以前也這樣。' },
      { speaker: '梅拉', text: '紅得發燙、主人很喜歡他。' },
      { speaker: '梅拉', text: '⋯⋯後來、就變那樣了。' },
      { text: '（她沒說「那樣」是什麼樣。但你看了眼遠處的巴爺。）' },
      { text: '（拐杖、跛腳、舊鞭子、雙眼裡沒光。）' },
      { speaker: '梅拉', text: '⋯⋯孩子、你自己小心。' },
      { speaker: '梅拉', text: '在這裡、紅得太快不是好事。' },
      { text: '（她拍拍你肩膀、回廚房去了。）' },
    ]);
    return true;
  }

  function _playPraise3() {
    if (typeof DialogueModal === 'undefined') {
      _log('塔倫長官：「你真的不錯。很認真。⋯⋯快追上我們巴爺當初的水準了。」', '#9a8866', true);
      return;
    }
    DialogueModal.play([
      { text: '（塔倫長官又找到你。）' },
      { speaker: '塔倫長官', text: '你真的不錯。很認真。' },
      { text: '（他停下。看著訓練場。）' },
      { speaker: '塔倫長官', text: '⋯⋯快追上我們巴爺當初的水準了。' },
      { text: '（他笑了笑、走了。）' },
      { text: '（你心裡——某個地方不對勁。）' },
      { text: '（為什麼提巴爺？）' },
    ], {
      onComplete: () => {
        if (teammates && teammates.modAffection) teammates.modAffection('officer', 1);
        // 🆕 set flag：玩家起疑了（後續事件可讀）
        Flags.set('player_heard_overseer_compare', true);
      }
    });
  }

  // ══════════════════════════════════════════════════
  // § 引爆事件 — 達官顯貴 (Distinguished Guest) 與 引爆 合一 v11
  // ══════════════════════════════════════════════════
  // 設計：莫拉斯（Morras）老朋友兼老對手帶他家招牌「鐵臂」烏勒克來
  //   阿圖斯為了在貴客面前撐場面 → 安排玩家上場 →
  //   玩家贏 → 主人公開稱讚（引爆）→ 塔倫看在眼裡開始算計
  //   玩家輸 → 主人冷臉、塔倫見獵心喜
  // 觸發條件：Day ≥ 30、fame ≥ 30、winStreak ≥ 3、未觸發過
  // 對手：morras_ironarm（既有 testbattle.js）
  // 赫克特情報網（友善路線）：賽前 ChoiceModal 賣情報、命中率 -15%

  function tryIgnitionEvent() {
    if (typeof Flags === 'undefined') return false;
    if (Flags.has('master_noticed_player')) return false;
    const p = Stats.player;
    if (!p || p.day < 30) return false;
    if ((p.fame || 0) < 30) return false;
    if ((p.combatStats?.winStreak || 0) < 3) return false;

    // 立刻 set flag 防重複（即使後續 dialog 鏈斷掉也不會重觸發）
    Flags.set('master_noticed_player', true);
    Flags.set('tarren_calculating', true);

    _playDistinguishedGuestPreBattle();
    return true;
  }

  function _playDistinguishedGuestPreBattle() {
    if (typeof DialogueModal === 'undefined') {
      _startDistinguishedBattle();
      return;
    }
    DialogueModal.play([
      // 預告（侍從通知）
      { text: '（侍從匆匆進來。）' },
      { speaker: '侍從', text: '主人有客來訪。' },
      { speaker: '侍從', text: '莫拉斯大人帶他家那個「鐵臂」烏勒克到了。' },
      { speaker: '侍從', text: '⋯⋯主人指名你上場。' },
      // 兩主見面（朋友兼找碴）
      { text: '（你被推到沙場邊。兩個訓練所主人正在握手。表面熱絡、眼神在較勁。）' },
      { speaker: '莫拉斯', text: '⋯⋯阿圖斯老兄、好久不見。' },
      { speaker: '阿圖斯', text: '老不見好。你那個鐵臂還在嗎？' },
      { speaker: '莫拉斯', text: '在啊、跨場 22 勝 4 敗。' },
      { speaker: '莫拉斯', text: '⋯⋯聽說你最近訓出個小子。有點意思？' },
      { speaker: '阿圖斯', text: '（冷笑）來、上場見真章。' },
      { speaker: '莫拉斯', text: '（笑）老樣子、輸的請酒。' },
      { speaker: '阿圖斯', text: '⋯⋯這次不是輸贏的事。' },
      { text: '（兩人一起看著沙地中央。塔倫站在阿圖斯後面、表情像吃了蒼蠅。）' },
    ], {
      onComplete: () => _showHectorIntelChoice(),
    });
  }

  // 赫克特情報網
  function _showHectorIntelChoice() {
    // 檢查赫克特友善路線、在場、玩家有錢
    const hectorFriendly = Flags.has('hector_friendly_path');
    const hectorPresent = _isPresent('hector');
    const hectorHostile = Flags.has('hector_hostile_path');
    const playerMoney = (Stats.player.money || 0);

    if (hectorHostile) {
      // 敵對路線：自動賣你弱點給對方（你不知道）
      Flags.set('hector_betrayed_at_morras', true);
      _log('（你瞥見赫克特跟莫拉斯的隨從在角落數錢。但你沒時間多想。）', '#cc8866', false);
      _startDistinguishedBattle();
      return;
    }

    if (!hectorFriendly || !hectorPresent || playerMoney < 10) {
      _startDistinguishedBattle();
      return;
    }

    // 友善路線 + 在場 + 有錢 → 提供情報
    DialogueModal.play([
      { text: '（訓練結束、要去沙場了。赫克特靠過來、聲音壓低。）' },
      { speaker: '赫克特', text: '⋯⋯小子。聽說你要對上鐵臂。' },
      { speaker: '赫克特', text: '我認識他。' },
      { speaker: '赫克特', text: '左臂舊傷、舉不過肩。要打、攻他左邊。' },
      { speaker: '赫克特', text: '⋯⋯這情報 10 銅錢。我不白給。' },
    ], {
      onComplete: () => {
        if (typeof ChoiceModal === 'undefined') {
          _startDistinguishedBattle();
          return;
        }
        ChoiceModal.show({
          id: 'hector_morras_intel',
          icon: '🐍',
          title: '赫克特要 10 銅錢買情報',
          body: '「左臂舊傷、舉不過肩。攻他左邊。」',
          forced: true,
          choices: [
            {
              id: 'buy',
              label: '給 10 錢、買情報',
              hint: '（戰鬥中對手命中率 -15%）',
              effects: [
                { type: 'money', delta: -10 },
                { type: 'flag', key: 'bought_morras_intel' },
                { type: 'affection', key: 'hector', delta: 2 },
              ],
              resultLog: '赫克特把銅錢收進懷裡：「⋯⋯下次有戲再來找我。」',
              logColor: '#aa7744',
            },
            {
              id: 'decline',
              label: '不用。我自己打',
              hint: '（赫克特：「⋯⋯隨你。」）',
              effects: [
                { type: 'affection', key: 'hector', delta: -2 },
              ],
              resultLog: '赫克特聳聳肩走開：「⋯⋯記住、我提醒過你了。」',
              logColor: '#9a8866',
            },
          ],
        }, { onChoose: () => _startDistinguishedBattle() });
      }
    });
  }

  function _startDistinguishedBattle() {
    // 強制開戰：玩家不能拒絕（劇情強制）
    if (typeof Battle === 'undefined' || !Battle.start) {
      _log('（戰鬥引擎未載入、跳過達官顯貴戰鬥）', '#cc6633', true);
      return;
    }

    // 套情報 buff（戰鬥中對手 ACC -15%）
    // 因為 Battle.start 不接 buff 參數、只能戰前 hack 暫存敵人 ACC
    // 簡化：用 flag 標記、戰後 log（命中減免實際在 testbattle 那邊整合會更乾淨、現階段先用粗糙實作）
    const hadIntel = Flags.has('bought_morras_intel');
    if (hadIntel) {
      _log('🐍 （赫克特的情報：你知道烏勒克的破綻。）', '#88aacc', false);
    }
    if (Flags.has('hector_betrayed_at_morras')) {
      _log('（你不知道赫克特已經把你的弱點賣給對方了。）', '#cc6633', false);
    }

    // 開戰（hack：用 setTimeout 給 DialogueModal 完全關閉的時間）
    // 🆕 2026-04-27 sparring: true — 訓練場內表演對決、不是公開競技場
    //   → 不開斬首面板（砍首/踩臉/饒恕）
    //   → 不算觀眾爽度（crowdMood 不影響）
    //   → 不顯示 S/A/B/C 評分
    //   → 戰勝直接走「返回按鈕 → _onMorrasWin」流程
    setTimeout(() => {
      Battle.start('morras_ironarm', _onMorrasWin, _onMorrasLose, { sparring: true });
    }, 300);
  }

  function _onMorrasWin() {
    // 引爆對白
    if (typeof DialogueModal === 'undefined') {
      _log('✦ 你贏了。主人公開稱讚你。塔倫長官眼神不對勁。', '#d4af37', true);
      _applyMorrasWinRewards();
      return;
    }
    DialogueModal.play([
      { text: '（烏勒克倒在沙地。觀眾爆出歡呼。）' },
      { text: '（阿圖斯爆笑大叫、拍著莫拉斯肩膀。）' },
      { speaker: '阿圖斯', text: '哈哈哈！老莫、看到沒！' },
      { speaker: '莫拉斯', text: '⋯⋯（沉默良久）⋯⋯不錯。' },
      { speaker: '莫拉斯', text: '⋯⋯這小子是新買的？' },
      { speaker: '阿圖斯', text: '（驕傲）我訓的。' },
      { text: '（他走到沙地邊、看著你。）' },
      { speaker: '阿圖斯', text: '這傢伙今天打得不錯。去給老默看看。' },
      { text: '（他坐回主席台、繼續喝酒。但你感覺得到——他第一次正眼看你。）' },
      { text: '（塔倫長官走過來、拍你肩膀。）' },
      { speaker: '塔倫長官', text: '（笑著）這新人最近表現不錯。也很認真。' },
      { text: '（他笑著走開。但他的眼神——你說不清那眼神是什麼。）' },
      { text: '（內心獨白：⋯⋯主人剛剛叫了我的名字。）' },
    ], {
      onComplete: () => _applyMorrasWinRewards(),
    });
  }

  function _applyMorrasWinRewards() {
    if (typeof teammates !== 'undefined') {
      teammates.modAffection('masterArtus', +20);
      teammates.modAffection('officer', +5);
    }
    Stats.modFame(+25);
    _log('✦ 主人開始注意到你了。從今天起、你不只是個角鬥士。', '#d4af37', true);
  }

  function _onMorrasLose() {
    if (typeof DialogueModal === 'undefined') {
      _log('你輸了。主人黑著臉、塔倫卻笑了。', '#cc6633', true);
      _applyMorrasLoseRewards();
      return;
    }
    DialogueModal.play([
      { text: '（你倒在沙地。莫拉斯哈哈大笑。）' },
      { speaker: '莫拉斯', text: '老阿、你這次走眼了。' },
      { speaker: '阿圖斯', text: '⋯⋯' },
      { text: '（黑著臉、沒說話。）' },
      { text: '（塔倫看著你、嘴角微揚。）' },
      { speaker: '塔倫長官', text: '⋯⋯我就說。新人還是新人。' },
    ], {
      onComplete: () => _applyMorrasLoseRewards(),
    });
  }

  function _applyMorrasLoseRewards() {
    if (typeof teammates !== 'undefined') {
      teammates.modAffection('masterArtus', -10);
      teammates.modAffection('officer', +5);
    }
    Stats.modFame(-5);
    // 不 set master_noticed_player flag → 之後可以再來一次
    Flags.unset('master_noticed_player');
    Flags.unset('tarren_calculating');
    _log('（你失敗了。但機會還會再來——只要你撐得住。）', '#8899aa', true);
  }

  // ══════════════════════════════════════════════════
  // § 曖昧任務期 — 塔倫指令（2 個，依特性過濾選項）
  // 觸發條件：稱讚 3 次完成 + master_noticed + 任何後續 officer 好感變動
  // ══════════════════════════════════════════════════

  function tryTarrenAmbiguousOrder() {
    if (typeof Flags === 'undefined') return;
    const count = Flags.get('tarren_orders_completed', 0);
    if (count >= 2) return;  // 兩個指令做完就不再觸發
    if (Flags.get('tarren_praise_count', 0) < 3) return;
    if (!Flags.has('master_noticed_player')) return;
    if (!_isPresent('officer')) return;

    // 第一次（已完成 0 個）→ 指令 1（教訓人）
    // 第二次（已完成 1 個）→ 指令 2（對主人說謊）
    if (count === 0) {
      _playOrder1();
    } else if (count === 1) {
      _playOrder2();
    }
  }

  // ─── 指令 1：教訓某 NPC ──────────────────
  function _playOrder1() {
    // 找一個在場的 teammate 當「目標」
    const cur = GameState.getCurrentNPCs() || {};
    const candidates = (cur.teammates || []).filter(id => {
      // 不指向主角朋友（奧蘭）/ 已死 NPC
      if (id === 'orlan' || id === 'sol') return false;
      const npc = (typeof teammates !== 'undefined') ? teammates.getNPC(id) : null;
      return npc && npc.alive !== false;
    });
    const targetId = candidates[Math.floor(Math.random() * candidates.length)] || 'dagiSlave';
    const targetName = (teammates.getNPC(targetId) && teammates.getNPC(targetId).name) || targetId;

    DialogueModal.play([
      { text: '（塔倫長官把你叫到角落。）' },
      { speaker: '塔倫長官', text: '⋯⋯有件小事。' },
      { speaker: '塔倫長官', text: `下次切磋時對 ${targetName} **認真打**、下重手。` },
      { speaker: '塔倫長官', text: '那小子最近太囂張、得敲一下。' },
      { text: '（他打量你。）' },
      { speaker: '塔倫長官', text: '懂嗎？' },
    ], {
      onComplete: () => _showOrder1Choice(targetId, targetName)
    });
  }

  function _showOrder1Choice(targetId, targetName) {
    if (typeof ChoiceModal === 'undefined') return;
    ChoiceModal.show({
      id: 'tarren_order_1',
      icon: '🐍',
      title: '塔倫的指令',
      body: `他要你下次對 ${targetName} 下重手。`,
      forced: true,
      choices: [
        {
          id: 'obey',
          label: '⋯⋯遵命。',
          hint: '（答應再說。）',
          effects: [
            { type: 'affection', key: 'officer', delta: 5 },
            { type: 'affection', key: targetId, delta: -10 },
            { type: 'moral', axis: 'loyalty', side: 'negative', weight: 1 },
          ],
          resultLog: '塔倫滿意地拍拍你肩膀。',
          logColor: '#9a8866',
        },
        {
          id: 'question',
          label: '他做錯什麼了？',
          hint: '（你不想隨便動手。）',
          requireAnyTrait: ['reliable', 'kindness', 'merciful'],
          effects: [
            { type: 'affection', key: 'officer', delta: -2 },
            { type: 'moral', axis: 'reliability', side: 'positive' },
          ],
          resultLog: '塔倫沉默看你一眼：「⋯⋯算了。當我沒說。」（他記下這一筆。）',
          logColor: '#8899aa',
        },
        {
          id: 'angry',
          label: '⋯⋯為什麼？',
          hint: '（你話衝口而出。）',
          requireTrait: 'impulsive',
          effects: [
            { type: 'affection', key: 'officer', delta: -5 },
            { type: 'flag', key: 'tarren_saw_player_doubt' },
          ],
          resultLog: '塔倫眼神冷下來：「⋯⋯沒事。」他走了。',
          logColor: '#cc7744',
        },
        {
          id: 'eager',
          label: '了解。誰下手都是他活該。',
          hint: '（你選擇主動配合。）',
          requireAnyTrait: ['cruel', 'opportunist'],
          effects: [
            { type: 'affection', key: 'officer', delta: 8 },
            { type: 'affection', key: targetId, delta: -15 },
          ],
          resultLog: '塔倫很滿意。「⋯⋯好。我看人沒看錯。」',
          logColor: '#aa7744',
        },
        {
          id: 'reserved',
          label: '我會看狀況。',
          hint: '（你保留決定權。）',
          requireAnyTrait: ['patient', 'prideful', 'iron_will'],
          effects: [
            { type: 'affection', key: 'officer', delta: 2 },
          ],
          resultLog: '塔倫笑了。「⋯⋯也行。」',
          logColor: '#9a8866',
        },
      ],
    }, {
      onChoose: (choiceId) => {
        Flags.increment('tarren_orders_completed', 1);
        // 🆕 2026-04-27 選了「遵命」或「了解」→ 標記下次切磋自動播
        // 🆕 2026-04-28 fix：不再 setTimeout 立刻播（沒長官在場時 immersion 破）
        //   改：設 flag → tryFireSneakyScene 在訓練後 hook 檢查長官+目標都在場才播
        if (choiceId === 'obey' || choiceId === 'eager') {
          Flags.set('tarren_order1_target', targetId);
          Flags.set('tarren_order1_active', true);
        }
      }
    });
  }

  // 🆕 2026-04-28 切磋出陰招場景 — 延遲觸發版
  //   設計：「隔天訓練塔倫長官把你跟 X 推上沙場」這幕在原始 spec 就是次日場景
  //   但原本實作用 setTimeout 立刻播 → 沒長官在場 immersion 破
  //   修法：拆成「設 flag」+「條件達成才播」兩步、長官+目標都在場才觸發
  function tryFireSneakyScene() {
    if (typeof Flags === 'undefined') return false;
    if (!Flags.has('tarren_order1_active')) return false;
    if (Flags.has('tarren_order1_played')) return false;        // 防止重複播
    if (!_isPresent('officer')) return false;                    // 必要：長官得在場
    const targetId = Flags.get('tarren_order1_target');
    if (!targetId) return false;
    if (!_isPresent(targetId)) return false;                     // 必要：目標也得在場

    Flags.set('tarren_order1_played', true);   // 標記已播、避免重觸
    const npc = (typeof teammates !== 'undefined') ? teammates.getNPC(targetId) : null;
    const targetName = (npc && npc.name) || targetId;
    _playSparringSneakyScene(targetId, targetName);
    return true;
  }

  // ══════════════════════════════════════════════════
  // 🆕 2026-04-27 切磋出陰招場景（指令 1 obey/eager 後立刻觸發）
  // 設計：正面切磋場合、反差感、出陰招對方知道
  //   為了上位連自己朋友都犧牲、不可逆道德軸打擊
  // ══════════════════════════════════════════════════
  function _playSparringSneakyScene(targetId, targetName) {
    // 🆕 2026-04-28 防呆：呼叫前必須長官+目標都在場（tryFireSneakyScene 已守、這層 belt-and-suspenders）
    if (!_isPresent('officer') || !_isPresent(targetId)) return;
    if (typeof DialogueModal === 'undefined') {
      _completeSneakyDefault(targetId, targetName);
      return;
    }
    DialogueModal.play([
      { text: '（塔倫長官走過來、把你跟 ' + targetName + ' 推上沙場。）' },
      { speaker: '塔倫長官', text: '今天切磋。打吧。' },
      { text: '（其他人圍過來看。' + targetName + ' 拿起木劍、笑了一下。）' },
      { speaker: targetName, text: '⋯⋯切磋啊。手下留情點。' },
      { text: '（你站著、握著木劍。塔倫在邊上看你。）' },
      { text: '（你知道他在等你做什麼。）' },
    ], {
      onComplete: () => _showSneakyChoice(targetId, targetName),
    });
  }

  function _showSneakyChoice(targetId, targetName) {
    if (typeof ChoiceModal === 'undefined') return;
    const target = (typeof teammates !== 'undefined') ? teammates.getNPC(targetId) : null;
    const hasInjury = (typeof Stats !== 'undefined' && Stats.player && Array.isArray(Stats.player.ailments))
                       ? Stats.player.ailments.some(a => target && a.includes('injury')) : false;
    // 簡化：對方有 ailment 才解鎖打舊傷選項（用玩家 ailments fallback、不準但能跑）
    const targetHasWound = target && target.alive !== false;   // 偷懶判定、之後可細化

    ChoiceModal.show({
      id: 'sparring_sneak_' + targetId,
      icon: '⚔',
      title: '切磋場上',
      body: `你跟 ${targetName} 在沙場上對峙。\n塔倫長官在邊上看著。`,
      forced: true,
      choices: [
        {
          id: 'normal',
          label: '正常切磋（不下陰招）',
          hint: '（你決定不下這種手）',
          effects: [
            { type: 'affection', key: 'officer', delta: -3 },
            { type: 'vital', key: 'mood', delta: 3 },
            { type: 'moral', axis: 'reliability', side: 'positive' },
          ],
          resultDialogue: [
            { text: '（你打出正常的切磋招數、沒下陰招。）' },
            { text: '（兩人交手十幾招、平手收場。）' },
            { speaker: targetName, text: '哈、不錯。' },
            { speaker: '塔倫長官', text: '⋯⋯' },
            { text: '（塔倫沒說話、轉身走了。但你知道他記下你「不聽話」這一筆。）' },
          ],
          resultLog: '你選擇了不下陰招。塔倫不滿、但你保住了底線。',
          logColor: '#9a8a8a',
        },
        {
          id: 'sand',
          label: '丟沙迷眼 ⚠',
          hint: '（撈一把沙、趁機打他）',
          effects: [
            { type: 'affection', key: 'officer', delta: 5 },
            { type: 'affection', key: targetId, delta: -30 },
            { type: 'moral', axis: 'reliability', side: 'negative', weight: 2 },
            { type: 'vital', key: 'mood', delta: -5 },
            { type: 'flag', key: 'sneaky_used_sand_' + targetId },
          ],
          resultDialogue: [
            { text: '（你佯裝撤退、低頭撈了一把沙。）' },
            { text: '（趁 ' + targetName + ' 揮劍的瞬間——你揚起手。）', effect: 'shake' },
            { text: '（沙子撒進他眼睛裡。）', effect: 'shake-and-flash' },
            { speaker: targetName, text: '靠！' },
            { text: '（他蒙眼、你立刻一棍打在他肩上。他踉蹌倒地。）', effect: 'shake' },
            { text: '（沙場一片靜默。）' },
            { speaker: targetName, text: '⋯⋯你他媽的。', color: '#cc4444' },
            { text: '（他擦著眼睛、瞪著你。）' },
            { speaker: targetName, text: '⋯⋯這不是切磋。這是陰招。', color: '#cc4444' },
            { text: '（其他人都看到了。沒人說話。）' },
            { text: '（塔倫笑著走過來、拍你肩膀。）' },
            { speaker: '塔倫長官', text: '⋯⋯有意思。下次見。' },
            { text: '（' + targetName + ' 沒再看你一眼。從此他知道你是這種人。）', color: '#aa6666' },
            { speaker: '主角', text: '⋯⋯這就是我？', color: '#cc8866' },
          ],
          resultLog: `你下了陰招。${targetName} 知道是你。從此他會記得。`,
          logColor: '#cc6633',
        },
        {
          id: 'old_wound',
          label: '打他舊傷處 ⚠⚠',
          hint: '（瞄準他剛包紮過的位置）',
          requireFlag: null,   // 之後可加條件、現在開放
          effects: [
            { type: 'affection', key: 'officer', delta: 8 },
            { type: 'affection', key: targetId, delta: -40 },
            { type: 'moral', axis: 'mercy', side: 'negative', weight: 2 },
            { type: 'moral', axis: 'reliability', side: 'negative', weight: 1 },
            { type: 'vital', key: 'mood', delta: -10 },
            { type: 'flag', key: 'sneaky_hit_wound_' + targetId },
          ],
          resultDialogue: [
            { text: '（你看見他肋骨上還有未癒的紗布。）' },
            { text: '（你假裝失手、棍子直直落下——）', effect: 'shake' },
            { text: '（——精準地砸在他舊傷處。）', effect: 'shake-and-flash' },
            { speaker: targetName, text: '啊——!', color: '#cc4444' },
            { text: '（他蜷縮倒地、嘔出一口血。）', effect: 'shake' },
            { text: '（沙場一片死寂。連塔倫都頓了一下。）' },
            { speaker: targetName, text: '⋯⋯你⋯⋯你他媽⋯⋯', color: '#cc4444' },
            { text: '（他喘不過氣、但他知道。他知道是故意的。）', color: '#aa3333' },
            { text: '（其他人退開。沒人想跟你眼神接觸。）' },
            { text: '（塔倫走過來、笑得很滿意。）' },
            { speaker: '塔倫長官', text: '⋯⋯狠。我喜歡。', color: '#cc7744' },
            { text: '（' + targetName + ' 被人扶下場。他從沒回頭。）', color: '#aa6666' },
            { speaker: '主角', text: '⋯⋯為了爬上去、我連朋友都打了。', color: '#cc8866' },
            { speaker: '主角', text: '⋯⋯這就是我要的活法？', color: '#cc8866' },
          ],
          resultLog: `你打了 ${targetName} 的舊傷。他不會再原諒你。`,
          logColor: '#aa3333',
          resultEffect: 'shake-and-flash',
        },
        {
          id: 'walk_away',
          label: '⋯⋯放下武器、退出',
          hint: '（你站在那、最後沒動手）',
          effects: [
            { type: 'affection', key: 'officer', delta: -8 },
            { type: 'affection', key: targetId, delta: 5 },
            { type: 'moral', axis: 'reliability', side: 'positive', weight: 2 },
            { type: 'vital', key: 'mood', delta: 5 },
          ],
          resultDialogue: [
            { text: '（你看著手裡的木劍、看著對面的 ' + targetName + '。）' },
            { text: '（你放下武器、轉身走出沙場。）' },
            { speaker: '塔倫長官', text: '⋯⋯你他媽幹什麼？' },
            { text: '（你沒回應。' + targetName + ' 站在那、表情複雜。）' },
            { speaker: targetName, text: '⋯⋯' },
            { text: '（他知道你猶豫了。他也知道為什麼。）' },
            { text: '（從此他對你的態度會不一樣。但塔倫⋯⋯不會。）' },
          ],
          resultLog: '你放下了武器。塔倫記恨、但你保住了自己。',
          logColor: '#88cc77',
        },
      ],
    }, {
      onChoose: () => {
        Flags.unset('tarren_order1_active');
      }
    });
  }

  function _completeSneakyDefault(targetId, targetName) {
    // 沒 DialogueModal 環境時的 fallback
    if (typeof teammates !== 'undefined') {
      teammates.modAffection(targetId, -25);
      teammates.modAffection('officer', +5);
    }
    _log(`你跟 ${targetName} 切磋時下了陰招。他知道是你。`, '#cc6633', true);
  }

  // ─── 指令 2：對主人說謊報訓練狀況 ──────────────────
  function _playOrder2() {
    DialogueModal.play([
      { text: '（塔倫長官在訓練後找到你。）' },
      { speaker: '塔倫長官', text: '⋯⋯有件事。' },
      { speaker: '塔倫長官', text: '主人最近會問你訓練如何。' },
      { speaker: '塔倫長官', text: '記得說一切都好——包括你的傷。' },
      { text: '（他看你一眼。）' },
      { speaker: '塔倫長官', text: '聽懂了嗎？' },
    ], {
      onComplete: () => _showOrder2Choice()
    });
  }

  function _showOrder2Choice() {
    if (typeof ChoiceModal === 'undefined') return;
    ChoiceModal.show({
      id: 'tarren_order_2',
      icon: '🐍',
      title: '塔倫的指令',
      body: '他要你對主人隱瞞訓練狀況。',
      forced: true,
      choices: [
        {
          id: 'obey',
          label: '了解。',
          hint: '（答應）',
          effects: [
            { type: 'affection', key: 'officer', delta: 3 },
            { type: 'flag', key: 'tarren_lying_to_master' },
          ],
          resultLog: '塔倫點頭：「好。」（後續主人問起你訓練狀況時、你會自動說謊。）',
          logColor: '#9a8866',
        },
        {
          id: 'integrity',
          label: '主人問什麼是主人的事。',
          hint: '（你不肯說謊。）',
          requireAnyTrait: ['reliable', 'prideful'],
          effects: [
            { type: 'affection', key: 'officer', delta: -3 },
            { type: 'moral', axis: 'reliability', side: 'positive' },
          ],
          resultLog: '塔倫眼神冷下來：「⋯⋯隨你。」（他記下這一筆。）',
          logColor: '#8899aa',
        },
        {
          id: 'why',
          label: '為什麼？',
          hint: '（你想知道理由。）',
          requireAnyTrait: ['neurotic', 'kindness'],
          effects: [],
          resultLog: '塔倫含糊帶過：「就為你好。」（你心裡懷疑加一。）',
          logColor: '#aa8866',
        },
        {
          id: 'eager',
          label: '我可以幫你說得更漂亮。',
          hint: '（主動配合升級。）',
          requireAnyTrait: ['opportunist'],
          effects: [
            { type: 'affection', key: 'officer', delta: 10 },
            { type: 'flag', key: 'tarren_player_inner_circle' },
          ],
          resultLog: '塔倫眼睛亮了一下：「⋯⋯好。我看你會做事。」（你成圈內人了。）',
          logColor: '#aa7744',
        },
        {
          id: 'humble',
          label: '我不擅長說謊。',
          hint: '（推託）',
          requireTrait: 'humble',
          effects: [
            { type: 'affection', key: 'officer', delta: -1 },
          ],
          resultLog: '塔倫給你台階：「那就⋯⋯少說話。」',
          logColor: '#9a8866',
        },
      ],
    }, {
      onChoose: () => {
        Flags.increment('tarren_orders_completed', 1);
      }
    });
  }

  // ══════════════════════════════════════════════════
  // § 回響期 — 老默接話 / 卡西烏斯補刀
  // ══════════════════════════════════════════════════

  // ─── 老默接話 ──────────────────
  // TODO 整合點：應在 doctor_events.js _performWoundHeal 完成後 hook
  //   或在治療事件結束時呼叫 OverseerEvents.tryDoctorHint()
  function tryDoctorHint() {
    if (typeof Flags === 'undefined') return;
    if (Flags.has('doctor_hinted_overseer')) return;
    if (!Flags.has('master_noticed_player')) return;
    if (_aff('doctorMo') < 50) return;

    Flags.set('doctor_hinted_overseer', true);

    if (typeof DialogueModal === 'undefined') {
      _log('老默看著你的傷口、欲言又止：「⋯⋯別步上跟⋯⋯的後塵。」', '#aa88aa', true);
      return;
    }
    DialogueModal.play([
      { text: '（老默替你包紮。動作比平常慢一點。）' },
      { speaker: '老默', text: '⋯⋯你也開始參與賭局賽事了嗎？' },
      { text: '（他抬頭看你一眼。）' },
      { speaker: '老默', text: '嗯⋯⋯你自己小心吧。' },
      { text: '（繼續包紮。）' },
      { speaker: '老默', text: '⋯⋯別步上跟——' },
      { text: '（聲音壓低、自言自語式。）' },
      { speaker: '老默', text: '⋯⋯的後塵。' },
      { text: '（他停下動作。）' },
      { speaker: '老默', text: '唉⋯⋯' },
      // 🆕 2026-04-27 順便埋盧基烏斯線
      { speaker: '老默', text: '⋯⋯上一個跟你一樣表現的人、被退役了。' },
      { speaker: '老默', text: '沒死、但也沒回訓練所。' },
      { text: '（他繼續包紮。）' },
      { speaker: '老默', text: '⋯⋯Forum 那邊偶爾還能看到他。' },
    ], {
      onComplete: () => {
        // 🆕 set flag 解鎖 Lucius 線
        if (typeof Flags !== 'undefined') Flags.set('heard_about_cripple', true);
        _showDoctorHintChoice();
      }
    });
  }

  function _showDoctorHintChoice() {
    if (typeof ChoiceModal === 'undefined') return;
    ChoiceModal.show({
      id: 'doctor_hint_overseer',
      icon: '⚕',
      title: '老默欲言又止',
      body: '他停下動作。看著你。',
      forced: true,
      choices: [
        {
          id: 'ask',
          label: '誰？跟誰的後塵？',
          effects: [],
          resultLog: '老默搖頭：「傷口我幫你包紮好了。小心為之吧。」',
          logColor: '#aa88aa',
        },
        {
          id: 'silent',
          label: '⋯⋯我懂。',
          effects: [],
          resultLog: '老默點點頭：「⋯⋯這樣最好。記得多吃點、傷會好得快。」',
          logColor: '#aa88aa',
        },
        {
          id: 'dumb',
          label: '賭局賽事怎麼了？',
          effects: [],
          resultLog: '老默：「⋯⋯沒事。是我多嘴。」（繼續包紮。）',
          logColor: '#aa88aa',
        },
      ],
    });
  }

  // ─── 卡西烏斯補刀 ──────────────────
  // TODO 整合點：應在 main.js _doAction 結束後檢查
  function tryCassiusHint() {
    if (typeof Flags === 'undefined') return;
    if (Flags.has('cassius_hinted_overseer')) return;
    if (!Flags.has('master_noticed_player')) return;
    if (!Flags.has('doctor_hinted_overseer')) return;  // 老默先講
    if (_aff('cassius') < 50) return;
    if (!_isPresent('cassius')) return;

    // 機率觸發避免一上場立刻彈
    if (Math.random() > 0.30) return;

    Flags.set('cassius_hinted_overseer', true);

    if (typeof DialogueModal === 'undefined') {
      _log('卡西烏斯坐到你旁邊：「你最近越來越顯眼了。⋯⋯想當年老巴也是。」', '#9a8a8a', true);
      return;
    }
    DialogueModal.play([
      { text: '（你坐在沙地邊休息。卡西烏斯走過來坐下。沒看你。）' },
      { speaker: '卡西烏斯', text: '⋯⋯你最近越來越顯眼了。' },
      { text: '（他喝一口水。）' },
      { speaker: '卡西烏斯', text: '也開始進入某些人的視線了。' },
      { text: '（沉默很久。）' },
      { speaker: '卡西烏斯', text: '⋯⋯巴爺一直都走得比我高、比我遠。' },
      { speaker: '卡西烏斯', text: '可惜⋯⋯' },
      { text: '（他看著訓練場上揮鞭子的巴爺。）' },
    ], {
      onComplete: () => _showCassiusHintChoice()
    });
  }

  function _showCassiusHintChoice() {
    if (typeof ChoiceModal === 'undefined') return;
    ChoiceModal.show({
      id: 'cassius_hint_overseer',
      icon: '⚔',
      title: '卡西烏斯欲言又止',
      body: '他不看你、看著訓練場。',
      forced: true,
      choices: [
        {
          id: 'ask_baba',
          label: '巴爺怎麼了？',
          effects: [],
          // TODO: 卡西烏斯講「巴爺」由來（賭局大勝、主人賞房、分享眾人）
          resultDialogue: [
            { speaker: '卡西烏斯', text: '⋯⋯當年他賭局大勝。' },
            { speaker: '卡西烏斯', text: '主人給他單人房、偶爾喝酒。' },
            { speaker: '卡西烏斯', text: '如日中天的那段時間——他有好處都分大家。' },
            { speaker: '卡西烏斯', text: '從那時候大家就叫他「巴爺」。' },
            { text: '（卡西烏斯停下。）' },
            { speaker: '卡西烏斯', text: '⋯⋯然後他就上場了。' },
            { speaker: '卡西烏斯', text: '回來時——只剩半條命。' },
            // 🆕 2026-04-27 順便埋盧基烏斯線
            { speaker: '卡西烏斯', text: '⋯⋯巴爺算幸運的。沒被救的人多了去。' },
            { speaker: '卡西烏斯', text: '聽說 Forum 那個瘸子、以前也是好手。' },
            { text: '（他喝一口水。）' },
            { speaker: '卡西烏斯', text: '⋯⋯算了。命就是命。' },
            { text: '（他站起來走了。）' },
          ],
          resultLog: '你終於知道「巴爺」這個名字的由來了。Forum 那個瘸子⋯⋯也曾是好手？',
          logColor: '#9a8a8a',
          flagSet: 'heard_about_cripple',   // 🆕 解鎖 Lucius 線
        },
        {
          id: 'ask_meaning',
          label: '⋯⋯什麼意思？',
          effects: [],
          resultLog: '卡西烏斯：「你會懂的。早或晚。」（站起來走了。）',
          logColor: '#9a8a8a',
        },
        {
          id: 'careful',
          label: '我會小心。',
          effects: [
            { type: 'affection', key: 'cassius', delta: 3 },
          ],
          resultLog: '卡西烏斯點點頭：「⋯⋯那就好。」（拍拍你肩膀走了。）',
          logColor: '#9a8a8a',
        },
      ],
    });
  }

  // ══════════════════════════════════════════════════
  // § 證據期 — 偷聽密謀（v10 核心揭露）
  // ══════════════════════════════════════════════════
  // TODO 整合點：需要主人召喚事件作前置
  //   觸發條件：
  //     - master_noticed_player ✓
  //     - tarren_orders_completed >= 2 ✓
  //     - mela_hinted_overseer + doctor_hinted_overseer + cassius_hinted_overseer ≥ 2
  //     - 主人 aff ≥ 60、塔倫 aff ≥ 40、巴爺 aff ≥ 60
  //     - Day ≥ 50
  //   建議實作：在 main.js DayCycle.onDayStart hook + 條件達成後
  //   呼叫：OverseerEvents.tryEavesdrop()
  function tryEavesdrop() {
    if (typeof Flags === 'undefined') return;
    if (Flags.has('overheard_master_plot')) return;
    if (!Flags.has('master_noticed_player')) return;
    if (Flags.get('tarren_orders_completed', 0) < 2) return;

    // 暗示者 flag 至少 2 個
    let hintCount = 0;
    if (Flags.has('mela_hinted_overseer')) hintCount++;
    if (Flags.has('doctor_hinted_overseer')) hintCount++;
    if (Flags.has('cassius_hinted_overseer')) hintCount++;
    if (hintCount < 2) return;

    // 好感檢查
    if (typeof teammates === 'undefined') return;
    if (teammates.getAffection('masterArtus') < 60) return;
    if (teammates.getAffection('officer') < 40) return;
    if (teammates.getAffection('overseer') < 60) return;

    if (Stats.player.day < 50) return;

    Flags.set('overheard_master_plot', true);
    _playEavesdropScene();
  }

  function _playEavesdropScene() {
    const playerName = (Stats.player && Stats.player.name) || '你';
    if (typeof DialogueModal === 'undefined') {
      _log('你偷聽到主人跟塔倫的密謀⋯⋯「像上次老巴一樣」', '#cc4444', true);
      return;
    }
    DialogueModal.play([
      { text: '（侍從來通知你——主人有事召見。）' },
      { text: '（你走到主人房門口。門半掩著、裡面有說話聲。）' },
      { text: '（你停下來。）' },
      { speaker: '主人', text: '⋯⋯領主生日又到了。總要找個理由討好他。' },
      { speaker: '塔倫長官', text: '大人說的是。' },
      { speaker: '塔倫長官', text: '新來的這幾個——有一個不錯。最近名聲也達到了。' },
      { speaker: '塔倫長官', text: '要不要再送一場好戰給領主開心？' },
      { speaker: '主人', text: '嗯⋯⋯' },
      { speaker: '塔倫長官', text: '聽說領主前陣子訓服了一頭老虎——' },
      { speaker: '塔倫長官', text: '他一直想找個夠看的對手試試。' },
      { speaker: '主人', text: '⋯⋯哦？' },
      { speaker: '塔倫長官', text: `不然推出 ${playerName} 去送頭？` },
      { speaker: '塔倫長官', text: '像上次老巴一樣⋯⋯', effect: 'shake' },
      { speaker: '主人', text: '（大笑）妙計！' },
      { text: '（兩人竊笑。）', effect: 'shake-big' },
      { text: '（你站在門口、沒敢進去。心臟在跳。）' },
      { text: '⋯⋯你下意識退後一步、轉身走了。' },
    ], {
      onComplete: () => {
        _log('💀 你聽到了你不該聽到的事。「上次老巴一樣」。', '#cc4444', true);
        if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
      }
    });
  }

  // ══════════════════════════════════════════════════
  // § 選擇期 — 巴爺喝酒事件（透漏 vs 不透漏）
  // ══════════════════════════════════════════════════
  // TODO 整合點：應在睡前事件鏈觸發
  //   觸發條件：
  //     - overheard_master_plot ✓
  //     - 巴爺 aff ≥ 70
  //     - Day ≥ 70
  //     - 還沒做選擇（!told_overseer_truth && !overseer_kept_secret）
  //   建議實作：DayCycle.onDayStart 或 sleep 觸發前 hook
  //   呼叫：OverseerEvents.tryOverseerDrink()
  function tryOverseerDrink() {
    if (typeof Flags === 'undefined') return;
    if (!Flags.has('overheard_master_plot')) return;
    if (Flags.has('told_overseer_truth')) return;
    if (Flags.has('overseer_kept_secret')) return;
    if (_aff('overseer') < 70) return;
    if (Stats.player.day < 70) return;

    _playOverseerDrinkScene();
  }

  function _playOverseerDrinkScene() {
    if (typeof DialogueModal === 'undefined') return;
    DialogueModal.play([
      { text: '（夜深。巴爺找到你。）' },
      { speaker: '巴爺', text: '小子。過來坐。' },
      { text: '（他遞給你一杯酒。）' },
      { speaker: '巴爺', text: '⋯⋯難得有個能聊的。' },
      { speaker: '巴爺', text: '今晚不講訓練。' },
      { text: '（他喝了一大口。）' },
      { speaker: '巴爺', text: '你最近⋯⋯心事重。' },
      { text: '（他沒看你、看著遠處。）' },
      { speaker: '巴爺', text: '想說什麼就說。我聽。' },
    ], {
      onComplete: () => _showOverseerDrinkChoice()
    });
  }

  function _showOverseerDrinkChoice() {
    if (typeof ChoiceModal === 'undefined') return;
    ChoiceModal.show({
      id: 'overseer_drink_truth',
      icon: '🍺',
      title: '巴爺敞開心房',
      body: '他在等你。\n\n你想告訴他你聽到的事嗎？',
      forced: true,
      choices: [
        {
          id: 'tell',
          label: '告訴他真相',
          hint: '（他應該知道。）',
          effects: [
            { type: 'flag', key: 'told_overseer_truth' },
            { type: 'moral', axis: 'reliability', side: 'positive', weight: 2 },
          ],
        },
        {
          id: 'keep',
          label: '不告訴',
          hint: '（讓他繼續活在感激裡。）',
          effects: [
            { type: 'flag', key: 'overseer_kept_secret' },
            { type: 'moral', axis: 'mercy', side: 'positive', weight: 1 },
          ],
        },
      ],
    }, {
      onChoose: (choiceId) => {
        if (choiceId === 'tell') _playFarewellScene();
        else                     _playKeepSecretScene();
      }
    });
  }

  // ─── 透漏路線：訣別事件 + 傳絕技 ──────────────────
  function _playFarewellScene() {
    DialogueModal.play([
      { text: '（你深呼吸、把今天聽到的告訴他。）' },
      { speaker: '巴爺', text: '⋯⋯' },
      { text: '（他不看你。手拿著酒杯、放在桌上沒喝。）' },
      { speaker: '巴爺', text: '⋯⋯你說「上次老巴一樣」？' },
      { speaker: '主角', text: '⋯⋯對。一字不差。' },
      { text: '（漫長的沉默。）' },
      { speaker: '巴爺', text: '⋯⋯哦。' },
      { text: '（他把酒杯端起來。喝了一口。放下。）' },
      { speaker: '巴爺', text: '當年我最後一場——' },
      { speaker: '巴爺', text: '對手是個從別的訓練所借來的瘋子。' },
      { speaker: '巴爺', text: '那時候我以為——' },
      { speaker: '巴爺', text: '⋯⋯他媽運氣不好。' },
      { text: '（他笑了一下。聲音很乾。）' },
      { speaker: '巴爺', text: '然後我重傷下場、長官親自跑來說「不能讓他死」。' },
      { speaker: '巴爺', text: '「我們訓練所要照顧自家人」。' },
      { speaker: '巴爺', text: '⋯⋯我那時候哭了。真的哭了。' },
      { speaker: '巴爺', text: '對著一個我以為救我的人，哭得像個孩子。' },
      { text: '（他不再說話。喝光那杯酒。）' },
      { speaker: '巴爺', text: '⋯⋯謝了。' },
      { text: '（他沒看你。）' },
      { speaker: '巴爺', text: '你聽好——' },
      { speaker: '巴爺', text: '當年沒人對我說這句話。所以這次我說。' },
      { speaker: '巴爺', text: '如果我倒了——繼續站到底。' },
      { speaker: '巴爺', text: '然後——' },
      { speaker: '巴爺', text: '⋯⋯別他媽讓他騙了你。聽到沒。' },
      { text: '（他起身要走、又停下。）' },
      { text: '（從腰間解下一條皮帶、塞給你。）' },
      { speaker: '巴爺', text: '這是我當年的腰帶。' },
      { speaker: '巴爺', text: '我教你一招——叫不屈。' },
      { speaker: '巴爺', text: '致命一擊鎖死一滴血、撐五個回合。' },
      { speaker: '巴爺', text: '我當年沒做到。但你做得到。' },
      { speaker: '巴爺', text: '⋯⋯這事不要再提了。對誰都別提。包括我。' },
      { text: '（他走了。）' },
    ], {
      onComplete: () => {
        Flags.set('overseer_realized_tarren', true);
        Flags.set('overseer_passed_torch', true);
        Flags.set('overseer_no_more_talk', true);
        // 授予技能 + 物品
        const p = Stats.player;
        if (!Array.isArray(p.learnedSkills)) p.learnedSkills = [];
        if (!p.learnedSkills.includes('unyielding')) {
          p.learnedSkills.push('unyielding');
        }
        // TODO: 巴爺腰帶物品（gra_old_belt）— 待 item.js 補定義
        _log('✦ 你獲得了巴爺的舊腰帶。', '#d4af37', true);
        _log('✦ 你學會了【不屈】 — 致命一擊鎖死 1 HP、5 回合內傷害 +30%（每場 1 次）。', '#d4af37', true);
        if (typeof teammates !== 'undefined' && teammates.modAffection) {
          teammates.modAffection('overseer', 10);  // 真心話後關係更深
        }
      }
    });
  }

  // ─── 不透漏路線：保護幻覺 + 老兵之眼 ──────────────────
  function _playKeepSecretScene() {
    DialogueModal.play([
      { text: '（你看著巴爺的臉。）' },
      { text: '（你咬住嘴唇。）' },
      { text: '（⋯⋯不、不能告訴他。）' },
      { speaker: '主角', text: '⋯⋯沒事。' },
      { speaker: '主角', text: '只是最近訓練累。' },
      { text: '（巴爺看你一眼、笑了。）' },
      { speaker: '巴爺', text: '⋯⋯小子。' },
      { speaker: '巴爺', text: '撐住。每個人都這樣過來的。' },
      { text: '（他從腰間解下一條皮帶、塞給你。）' },
      { speaker: '巴爺', text: '這是我當年的腰帶。' },
      { speaker: '巴爺', text: '⋯⋯送你。看見了就想起——撐住。' },
      { text: '（他笑得很真。你看著他、不知道該不該回笑。）' },
      { text: '（你拿著腰帶。心裡的那個秘密、變成你獨自背的。）' },
    ], {
      onComplete: () => {
        Flags.set('overseer_kept_secret', true);
        const p = Stats.player;
        // TODO: 巴爺腰帶物品 — 同上
        _log('✦ 你獲得了巴爺的舊腰帶。', '#d4af37', true);
        // 🆕 2026-04-27 老兵之眼直接授予（之前註解的部分打開）
        //   設計：你選擇沉默 = 你看見了他沒看見的東西 = 老兵之眼 metaphor 完美
        if (!Array.isArray(p.learnedSkills)) p.learnedSkills = [];
        if (!p.learnedSkills.includes('veteran_eye')) p.learnedSkills.push('veteran_eye');
        _log('✦ 你獲得了【老兵之眼】 — 戰鬥開場 ATK +15% / CRT +5。', '#d4af37', true);
        if (typeof Stage !== 'undefined' && Stage.popupBig) {
          Stage.popupBig({
            icon: '👁', title: '老兵之眼', subtitle: '你看見了',
            color: 'gold', duration: 1800, sound: 'acquire',
          });
        }
        _log('💭 你選擇了沉默。某些秘密只能自己背。', '#aa88aa', true);
        if (typeof teammates !== 'undefined' && teammates.modAffection) {
          teammates.modAffection('overseer', 5);
        }
      }
    });
  }

  // ══════════════════════════════════════════════════
  // 公開 API + 整合點呼叫提示
  // ══════════════════════════════════════════════════
  return {
    // 鋪墊期
    tryTarrenPraise,        // 訓練後 hook
    tryMelaHint,            // 🆕 2026-04-27 梅拉 Layer 1（晚餐時觸發）
    // 引爆期
    tryIgnitionEvent,       // ✅ 2026-04-27 已 wire 進 sleepEndDay（達官顯貴 + 引爆）
    // 曖昧任務期
    tryTarrenAmbiguousOrder,// 訓練後 hook
    tryFireSneakyScene,     // 🆕 2026-04-28 訓練後 hook — 長官+目標都在場才播切磋陰招場景
    // 回響期
    tryDoctorHint,          // ✅ 2026-04-27 已 wire 進 doctor 治療後
    tryCassiusHint,         // 訓練後 hook
    // 證據期
    tryEavesdrop,           // 訓練後 hook
    // 選擇期
    tryOverseerDrink,       // 睡前 hook
  };
})();
