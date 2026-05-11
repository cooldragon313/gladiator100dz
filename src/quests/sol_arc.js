/**
 * sol_arc.js — 索爾存活 5 階段 Arc (Phase 1 實作 2026-05-12)
 * ══════════════════════════════════════════════════
 * 規格主檔：docs/quests/sol-arc.md
 *
 * Phase 1 範圍（本檔）：
 *   - offerSpareSol(killCallback)：戰勝索爾後若 HP 高、彈饒他選項
 *   - _playSaveSolBranch()：跪求主人對白 → 設債務 + skim
 *   - applyMoneySkim(delta)：私財扣抵 wrapper（Stats.modMoney 呼叫前先走這個）
 *   - tryDebtClearedCeremony()：每次扣款後檢查、清零時放演出
 *   - tryTarunQualifiedNotify()：訓練達 30 次後、塔倫主動通知（每日 hook）
 *
 * Phase 2-5（未實作）：見 sol-arc.md
 *   - tryWakeUpDay15()：索爾養傷 10 天醒對白
 *   - tryCoverSlacking()：偷懶遮掩
 *   - tryNightWatchTip()：守夜情報
 *   - 治療抉擇期、戰友期、結局忠誠期⋯
 *
 * 依賴：ChoiceModal, DialogueModal, Flags, Stats, teammates, DayCycle,
 *       SoundManager（可選）, Game（可選 for shake/popup）。
 */
const SolArc = (() => {

  // ══════════════════════════════════════════════════
  // 常數
  // ══════════════════════════════════════════════════
  const DEBT_INITIAL = 200;       // 救索爾代價（100 買價 + 100 罰金、user 2026-05-12）
  const HP_THRESHOLD = 0.70;      // S/A 級碾壓判定（HP > 70%）
  const TRAIN_GATE   = 30;        // 競技場訓練門檻

  // ══════════════════════════════════════════════════
  // helpers
  // ══════════════════════════════════════════════════
  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    }
  }

  function _modAff(npcId, delta) {
    if (typeof teammates !== 'undefined' && teammates.modAffection) {
      teammates.modAffection(npcId, delta);
    }
  }

  // ══════════════════════════════════════════════════
  // § 1.1 戰勝索爾後、判定是否提供饒他選項
  // ══════════════════════════════════════════════════
  /**
   * 由 main.js _resolveTrialChoice → 戰勝索爾的 onWin 呼叫。
   * 若 HP > 70%（S/A 碾壓條件）→ 彈饒他 ChoiceModal、選了結則 onKillCallback() (走原本 _solDeathScene)。
   * 否則直接走 onKillCallback()（沒得選）。
   * @param {Function} onKillCallback _solDeathScene 或同等
   */
  function offerSpareSol(onKillCallback) {
    const p = (typeof Stats !== 'undefined') ? Stats.player : null;
    if (!p) { if (onKillCallback) onKillCallback(); return; }

    const hpMax = p.hpMax || p._hpMax || 100;
    const hpPct = p.hp / hpMax;

    // 不符碾壓條件 → 直接死、不彈饒他選項
    if (hpPct < HP_THRESHOLD) {
      if (onKillCallback) onKillCallback();
      return;
    }

    if (typeof ChoiceModal === 'undefined') {
      if (onKillCallback) onKillCallback();
      return;
    }

    ChoiceModal.show({
      id: 'sol_spare_or_kill',
      icon: '⚔',
      title: '你的劍在他喉嚨上',
      body: '索爾閉著眼。等。\n（場內所有人靜了半秒。）',
      forced: true,
      choices: [
        {
          id: 'kill',
          label: '了結',
          hint: '（拿掛件、走原本流程。）',
          resultLog: '你了結了他。觀眾沒有聲音。',
          logColor: '#cc6666',
        },
        {
          id: 'spare',
          label: '⋯⋯讓他活著',
          hint: '（你不知道為什麼、但你做不到。）',
          resultLog: '你把劍收回。',
          logColor: '#aa9966',
        },
      ],
    }, {
      onChoose: (id) => {
        if (id === 'kill') {
          if (onKillCallback) onKillCallback();
        } else {
          _playSpareConfirmation(onKillCallback);
        }
      },
    });
  }

  // ══════════════════════════════════════════════════
  // § 1.2 撤回確認（長官警告 + 玩家最後機會反悔）
  // ══════════════════════════════════════════════════
  function _playSpareConfirmation(onKillCallback) {
    if (typeof DialogueModal === 'undefined') {
      _playSaveSolBranch();
      return;
    }
    DialogueModal.play([
      { text: '（你把劍收回。場內所有人靜了半秒。）' },
      { text: '（其他奴隸看著你。沒有罵聲——他們沒見過。）' },
      { speaker: '塔倫長官', text: '⋯⋯快、了結他。', color: '#cc6666' },
      { speaker: '塔倫長官', text: '主人在看。', color: '#cc6666' },
    ], {
      onComplete: () => {
        ChoiceModal.show({
          id: 'sol_spare_confirm',
          icon: '⚠️',
          title: '長官在催',
          body: '索爾還躺在沙地上。主人在陽台。',
          forced: true,
          choices: [
            {
              id: 'commit',
              label: '我不殺他。',
              hint: '（你看著主人那邊。）',
              resultLog: '你站直了。觀眾席安靜。',
              logColor: '#aa9966',
            },
            {
              id: 'recant',
              label: '⋯⋯算了。',
              hint: '（你舉起劍。）',
              resultLog: '你還是了結了他。',
              logColor: '#cc6666',
            },
          ],
        }, {
          onChoose: (id) => {
            if (id === 'recant') {
              if (onKillCallback) onKillCallback();
            } else {
              _playSaveSolBranch();
            }
          },
        });
      },
    });
  }

  // ══════════════════════════════════════════════════
  // § 1.3 主人裁決對白（饒他主流程）
  // ══════════════════════════════════════════════════
  function _playSaveSolBranch() {
    if (typeof DialogueModal === 'undefined') {
      _applySaveSolConsequences();
      return;
    }
    DialogueModal.play([
      { text: '（陽台上、阿圖斯放下酒杯。第一次正眼看你。）' },
      { speaker: '阿圖斯', text: '⋯⋯有意思。', color: '#d4af37' },
      { speaker: '阿圖斯', text: '新來的、你叫什麼名字？', color: '#d4af37' },
      { text: '（你報名。）' },
      { speaker: '阿圖斯', text: '你為什麼要救他？', color: '#d4af37' },
    ], {
      onComplete: () => _showMasterAskWhy(),
    });
  }

  function _showMasterAskWhy() {
    if (typeof ChoiceModal === 'undefined') {
      _playMasterVerdict();
      return;
    }
    ChoiceModal.show({
      id: 'sol_spare_why',
      icon: '🐍',
      title: '阿圖斯在等你答話',
      body: '（陽台上他放下酒杯、看著你。）',
      forced: true,
      choices: [
        {
          id: 'brother',
          label: '「他是我兄弟。」',
          effects: [{ type: 'moral', axis: 'loyalty', side: 'positive' }],
          resultLog: '你說出了那兩個字。',
          logColor: '#aa9966',
        },
        {
          id: 'shielded',
          label: '「他擋過我。」',
          effects: [{ type: 'moral', axis: 'reliability', side: 'positive' }],
          resultLog: '你想起 Day 2 的那道鞭痕。',
          logColor: '#aa9966',
        },
        {
          id: 'dunno',
          label: '「⋯⋯我不知道。」',
          effects: [{ type: 'moral', axis: 'patience', side: 'positive' }],
          resultLog: '你說的是實話。',
          logColor: '#888888',
        },
      ],
    }, {
      onChoose: () => _playMasterVerdict(),
    });
  }

  function _playMasterVerdict() {
    if (typeof DialogueModal === 'undefined') {
      _playPostMasterScene();
      return;
    }
    DialogueModal.play([
      { text: '（阿圖斯看了索爾一眼。瘸腿、傷口、要死不活。）' },
      { text: '（他低頭了一會。）' },
      { speaker: '阿圖斯', text: '⋯⋯', color: '#d4af37' },
      { speaker: '阿圖斯', text: '我花了 100 銅幣買他。', color: '#d4af37' },
      { text: '（他重新坐下、拿起酒杯。）' },
      { speaker: '阿圖斯', text: '你想救他、可以！', color: '#d4af37' },
      { speaker: '阿圖斯', text: '我也不養無用人——你想救他、就連他那份一起賺給我！', color: '#d4af37' },
      { speaker: '阿圖斯', text: '未來你在競技場賺到的、該歸你那份——歸我。', color: '#d4af37' },
      { speaker: '阿圖斯', text: '觀眾丟的、戰利品分的——歸我。', color: '#d4af37' },
      { speaker: '阿圖斯', text: '在你賺滿 200 之前、你都沒有得分。', color: '#d4af37' },
      { speaker: '阿圖斯', text: '你的私財是零。', color: '#d4af37' },
      { speaker: '阿圖斯', text: '他、我會找老默看看。', color: '#d4af37' },
      { speaker: '阿圖斯', text: '養好傷——他要回來繼續訓練。', color: '#d4af37' },
      { text: '（他揮揮手、示意散場。）' },
      // ── 塔倫補刀（含抽鞭） ──
      { text: '（塔倫長官壓低聲音、走近。）' },
      { speaker: '塔倫長官', text: '⋯⋯沒長幾根毛就學人裝英雄？', color: '#cc6666' },
      { speaker: '塔倫長官', text: '看來給你訓練太少。', color: '#cc6666' },
      { speaker: '塔倫長官', text: '今天開始——別讓我看到你偷懶——', color: '#cc6666', effect: 'shake-and-flash' },
      { text: '（鞭子在你旁邊的沙地上劃過一道線。沙飛起來。）' },
      { speaker: '塔倫長官', text: '欠主人的、你要一毛都別想少。', color: '#cc6666' },
      { speaker: '塔倫長官', text: '等等收拾好傷口、給我開始訓練。', color: '#cc6666' },
      { speaker: '塔倫長官', text: '準備進競技場、好好幫主人賺錢吧。', color: '#cc6666' },
      { text: '（他啐了一口、走了。）' },
      // ── 赫克特插話 ──
      { text: '（塔倫走遠後、你還在沙地上。）' },
      { text: '（一個身影靠過來。手裡草桿、眼睛半瞇。是赫克特。）' },
      { speaker: '赫克特', text: '⋯⋯新人。', color: '#9a5a3a' },
      { speaker: '赫克特', text: '我跟你講件事。', color: '#9a5a3a' },
      { speaker: '赫克特', text: '在這——', color: '#9a5a3a' },
      { speaker: '赫克特', text: '別讓別人覺得你好欺負。', color: '#9a5a3a' },
      { text: '（他朝你身後啐了一口。）' },
      { speaker: '赫克特', text: '⋯⋯你今天看起來、特別好欺負。', color: '#9a5a3a' },
      { text: '（他笑了一下、轉身走了。）' },
    ], {
      onComplete: () => {
        if (typeof Flags !== 'undefined') Flags.set('hector_noticed_save_sol', true);
        _playPostMasterScene();
      },
    });
  }

  // ══════════════════════════════════════════════════
  // § 1.5 主角 OS + 走向醫療室 + 老默對白（2026-05-12 取代 popup）
  // ══════════════════════════════════════════════════
  function _playPostMasterScene() {
    if (typeof DialogueModal === 'undefined') {
      _applySaveSolConsequences();
      return;
    }
    DialogueModal.play([
      // ── 主角 OS（無 speaker、內心獨白）──
      { text: '（主人今天肯定是很不高興⋯⋯）' },
      { text: '（欠他的錢⋯⋯）' },
      { text: '（看著地上的索爾⋯⋯）' },
      { text: '（算了⋯⋯總算是相識一場、剛進來他也很照顧我⋯⋯）' },
      { text: '（就這樣吧。）' },
      { text: '（你彎腰扶起索爾、走向醫療室。）' },
      // ── 切到醫療室、老默 ──
      { text: '（醫療室。空氣裡有烈酒和草藥味。）' },
      { speaker: '老默', text: '新人。', color: '#7a6a4a' },
      { speaker: '老默', text: '剛剛有人進來通報。', color: '#7a6a4a' },
      { speaker: '老默', text: '聽說你剛進來就惹惱主人——你也挺有種的。', color: '#7a6a4a' },
      { text: '（他擦了擦手、看了索爾一眼。）' },
      { speaker: '老默', text: '⋯⋯你要逞能、別死太快阿。', color: '#7a6a4a' },
      { speaker: '老默', text: '主人沒收到錢可是會發脾氣、別讓我們也被遷怒了。', color: '#7a6a4a' },
      { text: '（他扶索爾躺下。）' },
      { speaker: '老默', text: '這傢伙我會看著他。', color: '#7a6a4a' },
      { speaker: '老默', text: '我剛看了一下、傷口不算太重、不過應該會躺個幾天。', color: '#7a6a4a' },
      { speaker: '老默', text: '你就回訓練所好好訓練吧⋯⋯', color: '#7a6a4a' },
    ], {
      onComplete: () => _applySaveSolConsequences(),
    });
  }

  // ══════════════════════════════════════════════════
  // § 1.4 套用救索爾的數值後果 + 結算 popup
  // ══════════════════════════════════════════════════
  function _applySaveSolConsequences() {
    if (typeof Flags === 'undefined' || typeof Stats === 'undefined') return;
    const p = Stats.player;

    // Flag
    Flags.set('saved_sol', true);
    Flags.set('sol_recovering', true);
    Flags.set('sol_recovery_start_day', p.day);
    Flags.set('debt_to_master', DEBT_INITIAL);   // 200
    Flags.set('master_skim_active', true);
    Flags.set('trial_completed', true);     // 共用既有 flag、避免重觸發
    Flags.set('met_doctor', true);           // 🆕 順便、玩家認識老默了

    // 索爾標記養傷中（NPC.alive 不動、但 sol_recovering 旗標讓場內不出現）
    // 好感
    _modAff('masterArtus', -15);
    _modAff('officer', -10);
    _modAff('doctorMo', 3);    // 🆕 老默對你印象「有種」

    // 🆕 2026-05-12：不開 popup、改用 § 1.5 老默 scene 自然帶過（user 反饋）
    //   數值靜默套用、玩家從 NPC 卡片 / 對白看到細節
    _log('✦ 你救了索爾。欠主人 200 銅幣、訓練 30 次才能上競技場。', '#aa9966', true);

    if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
  }

  // ══════════════════════════════════════════════════
  // § 1.5 私財扣抵 wrapper（被 Stats.modMoney 呼叫）
  // ══════════════════════════════════════════════════
  /**
   * 在 Stats.modMoney 套用 delta 之前先攔截、若有債務、扣抵到 0 為止。
   * @param {number} delta 增量（只攔截正值、負值直接放行）
   * @returns {number} 實際進玩家口袋的 delta（≥ 0）
   */
  function applyMoneySkim(delta) {
    if (!delta || delta <= 0) return delta;
    if (typeof Flags === 'undefined') return delta;
    if (!Flags.has('master_skim_active')) return delta;

    const debt = Flags.get('debt_to_master', 0);
    if (debt <= 0) {
      Flags.unset('master_skim_active');
      return delta;
    }

    const taken = Math.min(delta, debt);
    const newDebt = debt - taken;
    Flags.set('debt_to_master', newDebt);

    _log(`✦ 主人扣下 ${taken} 銅幣（剩 ${newDebt} 還清）`, '#aa6666', false);

    if (newDebt <= 0) {
      Flags.unset('master_skim_active');
      Flags.set('master_debt_cleared', true);
      // 延一 tick 觸發演出（避免跟當前事件搶 modal）
      setTimeout(_playDebtClearedCeremony, 600);
    }

    return delta - taken;   // 剩餘進玩家口袋（通常 = 0）
  }

  // ══════════════════════════════════════════════════
  // § 1.6 還清演出
  // ══════════════════════════════════════════════════
  function _playDebtClearedCeremony() {
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play([
        { text: '（侍從走進訓練場、找你。）' },
        { speaker: '侍從', text: '主人說——你那筆還完了。' },
        { text: '（他遞給你一個小布袋。）' },
        { speaker: '侍從', text: '這是今天結算剩餘的。' },
        { text: '（拿了也不看裡面多少就收下。）' },
        { speaker: '侍從', text: '下一場、上競技場。' },
        { text: '（他轉身走了。）' },
      ], {
        onComplete: () => {
          if (typeof Stage !== 'undefined' && Stage.popupBig) {
            Stage.popupBig({
              icon:     '💰',
              title:    '你還清了主人的本錢',
              subtitle: '打賞 / 戰利品 進你私財',
              color:    '#d4af37',
              shake:    true,
            });
          }
          if (typeof SoundManager !== 'undefined' && SoundManager.playSynth) {
            SoundManager.playSynth('achievement');
          }
          if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
        },
      });
    }
    _log('✦ 你還清了主人的本錢。打賞 / 戰利品 進你私財。', '#d4af37', true);
  }

  // ══════════════════════════════════════════════════
  // § 1.7 訓練 30 次門檻：達標後塔倫主動通知
  // ══════════════════════════════════════════════════
  function tryTarunQualifiedNotify() {
    if (typeof Flags === 'undefined') return;
    if (Flags.has('arena_training_qualified')) return;     // 已通知過
    if (!Flags.has('arena_unlocked')) return;              // 沙洗還沒做完
    const count = Flags.get('training_action_count', 0);
    if (count < TRAIN_GATE) return;

    Flags.set('arena_training_qualified', true);

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play([
        { text: '（清晨。塔倫長官走到你面前、稍稍點頭。）' },
        { speaker: '塔倫長官', text: '⋯⋯練得可以了。', color: '#cc6666' },
        { speaker: '塔倫長官', text: '下次派遣，輪到你。', color: '#cc6666' },
        { text: '（他轉身走了。）' },
      ]);
    }
    _log('✦ 競技場合格通知：下次派遣輪到你。', '#d4af37', true);
  }

  // ══════════════════════════════════════════════════
  // 初始化：註冊每日鉤子
  // ══════════════════════════════════════════════════
  function init() {
    if (typeof DayCycle === 'undefined' || typeof DayCycle.onDayStart !== 'function') return;
    DayCycle.onDayStart('solArcMaintenance', () => {
      tryTarunQualifiedNotify();
      // Phase 2 wakeUpDay15 / coverSlacking / nightWatch 在這加（待實作）
    }, 30);
  }

  // 自動初始化
  if (typeof DayCycle !== 'undefined') {
    init();
  } else if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', init);
  }

  // ══════════════════════════════════════════════════
  // 公開 API
  // ══════════════════════════════════════════════════
  return {
    init,
    offerSpareSol,          // Day 5 戰勝後 hook
    applyMoneySkim,         // Stats.modMoney 內部呼叫
    tryTarunQualifiedNotify,
    // debug
    _testSaveSolBranch: _playSaveSolBranch,
    _testDebtCleared:   _playDebtClearedCeremony,
    DEBT_INITIAL,
    TRAIN_GATE,
  };
})();
