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
  // § 引爆事件 — 主人公開稱讚（v10 核心）
  // ══════════════════════════════════════════════════
  // TODO 整合點：需在「玩家漂亮贏一場跨訓練所對戰」後觸發
  //   建議 hook 位置：
  //     - battle.js Battle.start() 的 onWin callback
  //     - 或 main.js arena 勝利結算處
  //   觸發條件提案：
  //     - 跨訓練所戰鬥勝利
  //     - 沒受重傷（HP > 50%）
  //     - 對手強敵（fame ≥ 一定值 / 等級偏高）
  //     - p.day >= 30 + fame >= 30
  //   觸發後呼叫：OverseerEvents.tryIgnitionEvent()
  function tryIgnitionEvent() {
    if (typeof Flags === 'undefined') return;
    if (Flags.has('master_noticed_player')) return;
    Flags.set('master_noticed_player', true);
    Flags.set('tarren_calculating', true);

    if (typeof DialogueModal === 'undefined') {
      _log('主人公開稱讚你：「這傢伙今天打得不錯。去給老默看看。」塔倫笑著拍你肩膀，眼神不對勁。', '#d4af37', true);
      return;
    }
    DialogueModal.play([
      { text: '（你贏了。觀眾的歡呼還沒停。）' },
      { text: '（你站在沙地中央喘氣、血還沒擦。）' },
      { text: '（看台上、主人站起來。）' },
      { speaker: '主人', text: '（拍了兩下手。）' },
      { speaker: '主人', text: '這傢伙今天打得不錯。' },
      { speaker: '主人', text: '去給老默看看，幫他把傷口整理一下。' },
      { text: '（他坐回去、繼續喝酒。）' },
      { text: '（你旁邊——塔倫長官走過來、拍了拍你肩膀。）' },
      { speaker: '塔倫長官', text: '（笑著）這新人最近表現不錯。也很認真。' },
      { text: '（他笑著走開。但他的眼神——你說不清那眼神是什麼。）' },
      { text: '（內心獨白：⋯⋯主人剛剛叫了我的名字。）' },
    ], {
      onComplete: () => {
        _log('✦ 主人開始注意到你了。從今天起、你不只是個角鬥士。', '#d4af37', true);
      }
    });
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
      onChoose: () => {
        Flags.increment('tarren_orders_completed', 1);
      }
    });
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
    ], {
      onComplete: () => _showDoctorHintChoice()
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
            { text: '（他站起來走了。）' },
          ],
          resultLog: '你終於知道「巴爺」這個名字的由來了。',
          logColor: '#9a8a8a',
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
        // 老兵之眼 — 注意：使用者要求標記未來給、不在這裡實際給
        // 目前先 set flag 標示「應該獲得 老兵之眼」、實際 grant 待後續事件
        // 但若 user 想立刻給：取消下面註解
        // if (!Array.isArray(p.learnedSkills)) p.learnedSkills = [];
        // if (!p.learnedSkills.includes('veteran_eye')) p.learnedSkills.push('veteran_eye');
        // _log('✦ 你獲得了【老兵之眼】 — 看破對手 1 個弱點、對應屬性 +20%。', '#d4af37', true);
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
    // 引爆期
    tryIgnitionEvent,       // TODO 戰鬥勝利 hook
    // 曖昧任務期
    tryTarrenAmbiguousOrder,// 訓練後 hook
    // 回響期
    tryDoctorHint,          // TODO 治療結束 hook
    tryCassiusHint,         // 訓練後 hook
    // 證據期
    tryEavesdrop,           // TODO 主人召喚 hook
    // 選擇期
    tryOverseerDrink,       // TODO 睡前 hook
  };
})();
