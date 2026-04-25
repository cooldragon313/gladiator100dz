/**
 * mela_rat_quest.js — 梅拉塞的抓老鼠夜間任務（D.28）
 * 設計文件：docs/quests/mela-rat.md
 *
 * 結構：
 *   白天提議（tryOffer）→ 玩家接受 → 夜晚（slot 7）觸發（playTonight）
 *   → 三階段判定（WIL → AGI → DEX）→ 成功則三選一（放生/殺/養）
 *
 * 所有門檻數字寫在這裡，玩家絕對看不到（見 docs/philosophy/numbers-hiding.md）。
 *
 * 載入順序：main.js 之前。依賴 Flags, Stats, DialogueModal, ChoiceModal, teammates, addLog
 */
const MelaRatQuest = (() => {

  // CLAUDE.md 第 12 條：bare addLog 在外部模組是 ReferenceError
  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    } else {
      console.warn('[MelaRatQuest] _log: no addLog available', text);
    }
  }

  // ══════════════════════════════════════════════════
  // 門檻（內部用，玩家不可見）
  // ══════════════════════════════════════════════════
  const WIL_NEEDED = 15;
  const AGI_NEEDED = 18;
  const DEX_NEEDED = 18;
  const MELA_AFF_OFFER = 25;
  const OFFER_CHANCE = 0.10;   // 每次資格檢查通過時的觸發機率

  // ══════════════════════════════════════════════════
  // Helpers
  // ══════════════════════════════════════════════════
  function _hasTrait(id) {
    const p = Stats.player;
    return Array.isArray(p.traits) && p.traits.includes(id);
  }

  // 依特性挑對白（負面 > 正面 > baseline）
  //   variants: { prideful:[lines], cruel:[lines], ..., baseline:[lines] }
  function _pickByTrait(variants) {
    const order = [
      'cruel', 'prideful', 'coward', 'impulsive', 'opportunist', 'neurotic',
      'kindness', 'merciful', 'humble', 'reliable', 'iron_will', 'loyal', 'patient',
    ];
    for (const t of order) {
      if (_hasTrait(t) && variants[t]) return variants[t];
    }
    return variants.baseline || [];
  }

  function _play(lines, onComplete) {
    if (!lines || lines.length === 0) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }
    if (typeof DialogueModal === 'undefined') {
      // Fallback：沒 DialogueModal 就 _log
      lines.forEach(ln => _log((ln.speaker ? `【${ln.speaker}】` : '') + (ln.text || ''), '#c8a060', false));
      if (typeof onComplete === 'function') onComplete();
      return;
    }
    DialogueModal.play(lines, { onComplete });
  }

  // ══════════════════════════════════════════════════
  // 白天提議（tryOffer） — 由 main.js 在訓練後檢查
  // ══════════════════════════════════════════════════
  function tryOffer(trainedAttr) {
    // 🆕 D.28：已成功通關 → 不再觸發
    if (Flags.has('mela_rat_passed')) return false;

    // 正在進行中（接了還沒做） → 不觸發新的
    if (Flags.has('mela_rat_accepted')) return false;

    const p = Stats.player;

    // ═══ 第一次提議路徑 ═══
    if (!Flags.has('mela_rat_offered')) {
      const aff = (typeof teammates !== 'undefined') ? teammates.getAffection('melaKook') : 0;
      if (aff < MELA_AFF_OFFER) return false;
      // 🆕 2026-04-19：梅拉本人必須在觀眾區（不能她沒出現任務卻冒出來）
      if (!_isMelaPresent()) return false;
      // 檢查三種訓練各做過至少一次（透過 exp）
      const hasAGI = (p.exp?.AGI || 0) > 0;
      const hasDEX = (p.exp?.DEX || 0) > 0;
      const hasWIL = (p.exp?.WIL || 0) > 0;
      if (!hasAGI || !hasDEX || !hasWIL) return false;
      if (Math.random() > OFFER_CHANCE) return false;

      Flags.set('mela_rat_offered', true);
      _playOfferIntro();
      return true;
    }

    // ═══ 失敗 / 拒絕後重試路徑 🆕 ═══
    // 條件分兩種：
    //   A. 失敗過（接了沒抓到）：1 天冷卻、25% 機率、aff ≥ 25
    //   B. 拒絕過（mela_rat_declined）：5 天冷卻、25% 機率、aff ≥ 35（重新贏信任）
    // 共同：剛練 AGI/DEX/WIL + 梅拉在場
    if (Flags.has('mela_rat_done')) {
      if (!['AGI', 'DEX', 'WIL'].includes(trainedAttr)) return false;
      const melaPresent = _isMelaPresent();
      if (!melaPresent) return false;

      const declined = Flags.has('mela_rat_declined');
      const aff = (typeof teammates !== 'undefined') ? teammates.getAffection('melaKook') : 0;
      const cooldownDays   = declined ? 5  : 1;
      const affThreshold   = declined ? 35 : MELA_AFF_OFFER;

      // 好感門檻
      if (aff < affThreshold) return false;
      // 冷卻
      const doneDay = Flags.get('mela_rat_done_day');
      if (typeof doneDay === 'number' && p.day - doneDay < cooldownDays) return false;
      // 機率
      if (Math.random() > 0.25) return false;

      // 清除失敗 / 拒絕狀態，重新進入提議流程
      Flags.unset('mela_rat_done');
      Flags.unset('mela_rat_done_day');
      Flags.unset('mela_rat_declined');
      Flags.unset('mela_rat_failed_stage1');
      Flags.unset('mela_rat_failed_stage2');
      Flags.unset('mela_rat_failed_stage3');
      Flags.unset('mela_rat_accepted');

      if (declined) _playReOfferAfterDecline();
      else          _playReOfferIntro();
      return true;
    }

    return false;
  }

  // 檢查梅拉是否在當前場景（觀眾或隊友區）
  function _isMelaPresent() {
    if (typeof GameState === 'undefined' || typeof GameState.getCurrentNPCs !== 'function') {
      return false;
    }
    const npcs = GameState.getCurrentNPCs() || {};
    const audience = npcs.audience  || [];
    const teams    = npcs.teammates || [];
    return audience.includes('melaKook') || teams.includes('melaKook');
  }

  // 🆕 D.28：失敗後再次提議的對白
  function _playReOfferIntro() {
    _play([
      { speaker: '梅拉塞', text: '喂，小子。過來一下。' },
      { text: '（她在擦手。動作比平常慢。）' },
      { speaker: '梅拉塞', text: '我看你這幾天練得挺勤的——' },
      { speaker: '梅拉塞', text: '那件⋯⋯廚房老鼠的事，你還記得嗎？' },
      { text: '（你點頭。）' },
      { speaker: '梅拉塞', text: '那隻小子還沒抓到。' },
      { speaker: '梅拉塞', text: '你⋯⋯要不要再試試？' },
    ], _showOfferChoice);
  }

  // 🆕 2026-04-24：拒絕後再次提議的對白（不同口氣 — 暗示她記得你之前推掉）
  function _playReOfferAfterDecline() {
    _play([
      { speaker: '梅拉塞', text: '小子。' },
      { text: '（她叫住你。聲音比平常硬。）' },
      { speaker: '梅拉塞', text: '上次⋯⋯算了。' },
      { speaker: '梅拉塞', text: '我看你最近練得不錯。手腳都快了。' },
      { speaker: '梅拉塞', text: '那隻老鼠還在廚房。' },
      { text: '（她沒看你。）' },
      { speaker: '梅拉塞', text: '⋯⋯這次要不要試？' },
    ], _showOfferChoice);
  }

  function _playOfferIntro() {
    _play([
      { speaker: '梅拉塞', text: '小子……我觀察你幾天了。' },
      { speaker: '梅拉塞', text: '我需要你的幫忙。放心，我跟主人說過了——這事你辦成了以後，有你好處。' },
      { speaker: '梅拉塞', text: '晚上晚餐結束後來廚房。（八點到十點那段。）' },
      { text: '（你心裡：「她要我幹嘛？」）' },
      { speaker: '梅拉塞', text: '廚房最近鬧老鼠。食物被咬得坑坑巴巴，你們吃的也不舒服吧——' },
      { speaker: '梅拉塞', text: '這小子狡猾得很。你要有足夠的耐心，等得住。速度要夠快——他跑起來像一縷煙。' },
      { speaker: '梅拉塞', text: '手要巧——他滑溜得像油。' },
      { speaker: '梅拉塞', text: '三樣缺一不可。你看看自己夠不夠。' },
    ], _showOfferChoice);
  }

  function _showOfferChoice() {
    if (typeof ChoiceModal === 'undefined') {
      // fallback：直接接
      Flags.set('mela_rat_accepted', true);
      _playAcceptedFollowup();
      return;
    }
    ChoiceModal.show({
      id: 'mela_rat_offer',
      icon: '🐁',
      title: '梅拉塞的請託',
      body: '廚房今晚八點鬧老鼠。接嗎？',
      forced: true,
      choices: [
        {
          id: 'accept',
          label: '我試試',
          hint: '晚上八點到廚房。',
          effects: [{ type: 'flag', key: 'mela_rat_accepted' }],
        },
        {
          id: 'decline',
          label: '下次吧',
          hint: '她記著——下次想試要等好感更深。',
          // 🆕 2026-04-24 fix bug：拒絕也要設 mela_rat_done + done_day，
          //   並標記 declined 以便重試路徑用不同冷卻 / 不同對白
          effects: [
            { type: 'flag', key: 'mela_rat_done' },
            { type: 'flag', key: 'mela_rat_declined' },
          ],
          resultLog: '梅拉沒生氣，但她別過頭去：「⋯⋯行。你有你的理由。」',
          logColor: '#c8a060',
        },
      ],
    }, {
      onChoose: (choiceId) => {
        if (choiceId === 'accept') _playAcceptedFollowup();
        // 🆕 2026-04-24：拒絕時記下完成日（給重試路徑算冷卻用）
        if (choiceId === 'decline') {
          Flags.set('mela_rat_done_day', Stats.player.day);
        }
      },
    });
  }

  function _playAcceptedFollowup() {
    const lines = _pickByTrait({
      prideful: [{ speaker: '梅拉塞', text: '不就一隻老鼠，鼻子也不用抬那麼高吧——至於嗎你。我這輩子最受不了你這種人。' }],
      cruel:    [{ speaker: '梅拉塞', text: '你想對牠怎樣，我懶得管——但別在我廚房亂來。我不想看到。' }],
      coward:   [{ speaker: '梅拉塞', text: '牠比你怕你。真的——牠會先跑。你別慌。' }],
      kindness: [{ speaker: '梅拉塞', text: '到時候，想怎處理你決定就好，但是還是要提醒仁慈在這裡不是個好個性。' }],
      merciful: [{ speaker: '梅拉塞', text: '能放就放的人，我看得到。但那隻先抓到再說，再決定怎麼辦。' }],
      humble:   [{ speaker: '梅拉塞', text: '不用謙虛啦——你沒能力我也不會看上你。' }],
      neurotic: [{ speaker: '梅拉塞', text: '緊張？呵——慢慢來，孩子。別想太多了，該上就上。' }],
      baseline: [
        { speaker: '梅拉塞', text: '好了——早點去吧。我等你回來。' },
        { text: '（她塞了一塊溫的麵包到你手裡。）' },
      ],
    });
    _play(lines);
  }

  // ══════════════════════════════════════════════════
  // 夜間觸發（由 main.js 在 slot 7 呼叫）
  // ══════════════════════════════════════════════════
  function hasPending() {
    return Flags.has('mela_rat_accepted') && !Flags.has('mela_rat_done');
  }

  function playTonight() {
    if (!hasPending()) return;
    _playEntranceMurmur();
  }

  function _playEntranceMurmur() {
    const murmur = _pickByTrait({
      prideful: [{ text: '（一隻老鼠。不用兩分鐘。）' }],
      cruel:    [{ text: '（抓到要不要加菜？烤一下應該還行。）' }],
      kindness: [{ text: '（希望不用傷到那小東西……）' }],
      neurotic: [{ text: '（要是沒抓到梅拉會失望嗎？要是被咬了會不會感染？我要不要帶手套？）' }],
      coward:   [{ text: '（老鼠……牠有牙齒吧？會不會咬我？）' }],
      iron_will:[{ text: '（沒有多餘的念頭。你走向廚房。）' }],
      baseline: [{ text: '（八點了。要先去廚房……真的能抓到嗎？）' }],
    });
    _play([
      ...murmur,
      { text: '（廚房門口。梅拉壓低聲音。）' },
      { speaker: '梅拉塞', text: '小聲點。老鼠大概都這時間會出現——都躲在那邊牆角那一堆麻袋裡。' },
      { speaker: '梅拉塞', text: '交給你了，不然最近食物都被咬得坑坑巴巴，你們吃起來也不舒服吧。' },
      { speaker: '梅拉塞', text: '加油，我看好你。要是真抓到了——有你好處。' },
      { text: '（梅拉退到廚房邊。你得自己靠近。）' },
    ], _stage1Wait);
  }

  // ──────────────────────────────────────────────────
  // 階段 1：等待（WIL 判定）
  // ──────────────────────────────────────────────────
  function _stage1Wait() {
    _play([
      { text: '（你蹲在牆角陰影裡。不敢動。）' },
      { text: '（時間過得很慢。廚房傳來鍋子的熱氣味。）' },
      { text: '（你看見麻袋後面有一個小小的鼻尖在動。）' },
    ], () => {
      if (Stats.eff('WIL') >= WIL_NEEDED) _stage1Success();
      else _stage1Fail();
    });
  }

  function _stage1Success() {
    _play([
      { text: '（你屏住呼吸。）' },
      { text: '（你不敢動。不敢眨眼。）' },
      { text: '（你盯了很久……）' },
      { text: '（老鼠似乎放下了戒心。）' },
      { text: '（牠慢慢爬出來——離你不到三步遠。）' },
      { text: '（你心裡暗喊：就是現在！）' },
    ], _stage2Chase);
  }

  function _stage1Fail() {
    _play([
      { text: '（你等了沒多久就耐不住。）' },
      { text: '（你腿麻了、鼻子癢、心也躁。）' },
      { text: '（你忍不住動了一下——）' },
      { text: '（老鼠一瞬間竄入牆縫。沒了。）' },
      { text: '（你心裡暗罵：可惡。早知道該耐心點等他放下戒心⋯⋯）' },
      { speaker: '梅拉塞', text: '（從門口）……今天就到這吧。' },
      { speaker: '梅拉塞', text: '下次你要真的靜得下來。' },
    ], () => {
      Flags.set('mela_rat_failed_stage1', true);
      _applyConsolation(5);
      _finishQuest();
    });
  }

  // ──────────────────────────────────────────────────
  // 階段 2：追捕（AGI 判定）
  // ──────────────────────────────────────────────────
  function _stage2Chase() {
    _play([
      { text: '（你從陰影衝出去。）' },
      { text: '（老鼠反應極快——牠往門下的縫隙鑽。）' },
      { text: '（你伸手、撲、跌一跤——）' },
    ], () => {
      if (Stats.eff('AGI') >= AGI_NEEDED) _stage2Success();
      else _stage2Fail();
    });
  }

  function _stage2Success() {
    _play([
      { text: '（但你剛好撐住、翻身、再撲上去——）' },
      { text: '（你擦著老鼠的尾巴了。）' },
      { text: '（再一步，你能抓到。）' },
    ], _stage3Grab);
  }

  function _stage2Fail() {
    _play([
      { text: '（你剛衝出去，老鼠已經溜過你腳邊。）' },
      { text: '（你踉蹌。老鼠鑽進了水槽底下的縫。）' },
      { text: '（你心裡暗罵：這賊小子跑那麼快，看來沒點速度會追不到⋯⋯）' },
      { speaker: '梅拉塞', text: '……算了，別追了，那裡鑽不進去。' },
      { speaker: '梅拉塞', text: '今天這樣了。下次你得更快點。' },
    ], () => {
      Flags.set('mela_rat_failed_stage2', true);
      _applyConsolation(30);
      _finishQuest();
    });
  }

  // ──────────────────────────────────────────────────
  // 階段 3：擒拿（DEX 判定）
  // ──────────────────────────────────────────────────
  function _stage3Grab() {
    _play([
      { text: '（你追到廚房角落。）' },
      { text: '（老鼠回頭看你。牠的尾巴在抖。）' },
      { text: '（你伸出手——）' },
    ], () => {
      if (Stats.eff('DEX') >= DEX_NEEDED) _stage3Success();
      else _stage3Fail();
    });
  }

  function _stage3Success() {
    _play([
      { text: '（左手一甩、右手一扣。）' },
      { text: '（抓到了——小小的身體在你手裡拼命掙扎。）' },
      { text: '（牠吱吱吱地叫。但牠跑不掉了。）' },
    ], _fullSuccessThanks);
  }

  function _stage3Fail() {
    _play([
      { text: '（你撲上去——雙手一抓——）' },
      { text: '（撲空。老鼠從指縫間竄走。）' },
      { text: '（你看著自己空空的掌心。）' },
      { text: '（你心裡暗罵：可惡，這傢伙怎那麼靈巧⋯⋯手得更巧才抓得住這東西。）' },
      { speaker: '梅拉塞', text: '……差一點點啊。' },
      { speaker: '梅拉塞', text: '你差一點就成了。' },
    ], () => {
      Flags.set('mela_rat_failed_stage3', true);
      _applyConsolation(60);
      _finishQuest();
    });
  }

  // ──────────────────────────────────────────────────
  // 全通過
  // ──────────────────────────────────────────────────
  function _fullSuccessThanks() {
    _play([
      { text: '（你握著老鼠走向廚房門口。梅拉看見你。）' },
      { speaker: '梅拉塞', text: '好樣的——我就說我看好你。' },
      { speaker: '梅拉塞', text: '謝啦。放心，你幫我這忙我不會虧待你的。' },
    ], _fullSuccessTraitLine);
  }

  function _fullSuccessTraitLine() {
    const lines = _pickByTrait({
      cruel:    [{ speaker: '梅拉塞', text: '——但這隻小東西之後你怎處理是你的事。別在我看得見的地方。' }],
      prideful: [{ speaker: '梅拉塞', text: '別得意太早。你只是抓到一隻老鼠而已。' }],
      kindness: [
        { speaker: '梅拉塞', text: '⋯⋯你會好好處理牠吧？我知道你會。' },
        { text: '（她沒追問，但眼神柔。）' },
      ],
      merciful: [{ speaker: '梅拉塞', text: '看你那表情——我猜你會放牠走。也好，這小子沒傷到誰。' }],
      humble:   [{ speaker: '梅拉塞', text: '你沒那種得意樣——我挺喜歡。' }],
      coward:   [{ speaker: '梅拉塞', text: '你手還在抖呢，小子。深呼吸。你做到了。' }],
      neurotic: [{ speaker: '梅拉塞', text: '別慌——結束了。把牠拿穩就好。' }],
      iron_will:[{ speaker: '梅拉塞', text: '你眼神穩——難得。很好。' }],
      baseline: [{ speaker: '梅拉塞', text: '這小子交給你處理了。我先走了。' }],
    });
    _play(lines, _fullSuccessEnding);
  }

  function _fullSuccessEnding() {
    _play([
      { text: '（梅拉轉身進廚房深處。）' },
      { text: '（你看著手上那隻小老鼠。牠已經不叫了——只是縮著。）' },
      { text: '（牠的眼睛是黑的。）' },
    ], _showFateChoice);
  }

  // ──────────────────────────────────────────────────
  // 三選一（放生 / 殺 / 養）
  // ──────────────────────────────────────────────────
  function _showFateChoice() {
    if (typeof ChoiceModal === 'undefined') {
      _finishQuest();
      return;
    }
    ChoiceModal.show({
      id: 'mela_rat_fate',
      icon: '🐁',
      title: '這隻小老鼠你要怎麼辦？',
      body: '牠在你手裡縮著，眼睛是黑的。',
      forced: true,
      choices: [
        {
          id: 'spare',
          label: '放牠走',
          hint: '「你張開手——」',
          effects: [
            { type: 'moral',     axis: 'mercy', side: 'positive' },
            { type: 'affection', key: 'melaKook', delta: 10 },
            { type: 'vital',     key: 'food', delta: 20 },
            { type: 'flag',      key: 'mouse_spared' },
          ],
          resultLog: '你張開手。牠愣了一秒——然後飛快鑽進牆縫。牠沒回頭。',
          logColor:  '#d4af37',
        },
        {
          id: 'kill',
          label: '殺掉',
          hint: '「⋯⋯一聲都沒叫。」',
          effects: [
            { type: 'moral',     axis: 'mercy', side: 'negative' },
            { type: 'affection', key: 'melaKook', delta: 10 },
            { type: 'vital',     key: 'food', delta: 25 },
            { type: 'flag',      key: 'mouse_killed' },
          ],
          resultLog: '你握緊手。輕輕一擰。一聲都沒叫。',
          logColor:  '#663344',
        },
        {
          id: 'tame',
          label: '試試養牠',
          hint: '「放進口袋⋯⋯」',
          effects: [
            { type: 'affection', key: 'melaKook', delta: 5 },
            { type: 'vital',     key: 'food', delta: 15 },
            { type: 'flag',      key: 'mouse_tamed_attempt' },
          ],
          resultLog: '你把牠放進口袋。牠動了一下——然後靜了。',
          logColor:  '#c8a060',
        },
      ],
    }, {
      onChoose: (choiceId) => _playFateReaction(choiceId),
    });
  }

  function _playFateReaction(choice) {
    let variants = null;
    if (choice === 'spare') {
      variants = {
        kindness: [{ speaker: '梅拉塞', text: '我就知道你會。⋯⋯這種心腸，在這不好過。撐著點。' }],
        merciful: [{ speaker: '梅拉塞', text: '我就知道你會。⋯⋯這種心腸，在這不好過。撐著點。' }],
        cruel:    [{ speaker: '梅拉塞', text: '哼——你今天難得。是不是累了。' }],
        prideful: [{ speaker: '梅拉塞', text: '放生也挺有面子的嘛？行，走吧。' }],
        baseline: [{ speaker: '梅拉塞', text: '⋯⋯好。回去睡吧。' }],
      };
    } else if (choice === 'kill') {
      variants = {
        cruel: [
          { speaker: '梅拉塞', text: '你這種人，我沒話跟你說。但是一碗湯給你——算是酬勞。' },
          { text: '（她不看你。）' },
        ],
        kindness: [
          { speaker: '梅拉塞', text: '⋯⋯你下得了手啊。' },
          { text: '（她看了你一眼，沒多說。那眼神你忘不了。）' },
        ],
        merciful: [
          { speaker: '梅拉塞', text: '你動手了——？⋯⋯算了。湯熱好了。' },
          { text: '（她的眼神變了一下。）' },
        ],
        neurotic: [{ speaker: '梅拉塞', text: '別想那麼多。牠沒痛苦——是我用那種方式煮的。' }],
        baseline: [{ speaker: '梅拉塞', text: '⋯⋯我收下牠。明天的湯比較鹹是我的事。' }],
      };
    } else if (choice === 'tame') {
      variants = {
        kindness: [{ speaker: '梅拉塞', text: '這很像你會做的事。小心點——在這裡養東西，一天都怕長。' }],
        neurotic: [{ speaker: '梅拉塞', text: '你得先學會不要怕牠。深呼吸，捏點食物。牠會認你。' }],
        prideful: [{ speaker: '梅拉塞', text: '你覺得養隻老鼠很特別？⋯⋯行吧，只要別出事。' }],
        baseline: [{ speaker: '梅拉塞', text: '養？你？⋯⋯好吧。別讓長官看見那東西。' }],
      };
    }
    const lines = variants ? _pickByTrait(variants) : [];
    // 🆕 D.28：完整通關 → 標記 passed（未來不會再提議）
    _play(lines, _finishQuestPassed);
  }

  // ══════════════════════════════════════════════════
  // 獎勵 / 結束
  // ══════════════════════════════════════════════════
  function _applyConsolation(percent) {
    // 慰問獎：percent% 的完整獎勵（完整是 20 食物 + 10 好感）
    const food = Math.max(1, Math.round(20 * percent / 100));
    const aff  = Math.max(1, Math.round(10 * percent / 100));
    // 🆕 敘述 log 先秀（讓玩家知道發生了什麼）
    let line;
    if (percent <= 10) {
      line = '（梅拉塞嘆了口氣，還是塞了一小塊麵包給你。）';
    } else if (percent <= 40) {
      line = '（梅拉塞搖搖頭，給了你一塊麵包跟一口湯。）「下次別再失手。」';
    } else {
      line = '（梅拉塞把一份完整的食物端給你。）「你差一點就成了——算你有心。」';
    }
    _log(line, '#c8a060', true);
    // 🆕 透過 Effects.apply 套用 + 自動 log 獎勵總結
    if (typeof Effects !== 'undefined') {
      Effects.apply([
        { type:'vital', key:'food', delta: food },
        { type:'affection', key:'melaKook', delta: aff },
      ]);
    } else {
      Stats.modVital('food', food);
      if (typeof teammates !== 'undefined') teammates.modAffection('melaKook', aff);
    }
  }

  function _finishQuest() {
    Flags.set('mela_rat_done', true);
    // 🆕 D.28：記錄完成日，用於重試冷卻
    Flags.set('mela_rat_done_day', Stats.player?.day || 0);
    if (typeof Game !== 'undefined' && typeof Game.renderAll === 'function') {
      Game.renderAll();
    }
  }

  // 🆕 D.28：完整通關（三階段全過）時呼叫，額外設 mela_rat_passed
  //   → 未來不會再次提議
  function _finishQuestPassed() {
    Flags.set('mela_rat_passed', true);
    _finishQuest();
  }

  // ══════════════════════════════════════════════════
  // Public API
  // ══════════════════════════════════════════════════
  return {
    tryOffer,
    hasPending,
    playTonight,
    // Debug
    _forceOffer: () => { Flags.unset('mela_rat_offered'); _playOfferIntro(); },
    _forceTonight: playTonight,
  };
})();
