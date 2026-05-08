/**
 * wanguji.js — 萬骸祭最終戰（Day 100 5 Wave Gauntlet）
 *
 * 設計：[docs/quests/arena-events-roster.md § 6c1 + § 6.3 + § 6d](../../docs/quests/arena-events-roster.md)
 *
 * 流程：
 *   1. 5 wave 連續戰鬥（雜兵 1v3 → 重甲 1v1 → 雙刀 1v2 → 黑豹 1v1 → 凱德故意輸）
 *   2. wave 間 HP/體力小幅恢復（不滿血）
 *   3. Wave 5 凱德倒下 → 領主走下競技場
 *   4. ChoiceModal「最後決意」→ A 加冕（既有 ending）/ B 反撲（殘血群戰）/ C 衝動自選
 *
 * 此模組目前是 **stub 框架**：
 *   - Wave 配置已定（[arena-events-roster.md § 6c1.1](../../docs/quests/arena-events-roster.md)）
 *   - 戰鬥用既有 Battle.startFromConfig()，wave 串接靠 onWin callback chain
 *   - 「殘血反撲群戰」尚未實作（會跳到 Endings.playRebellion 直接給結局）
 *   - 詳細戰鬥腳本、敵人對白等待後續 polish
 *
 * 公開 API：
 *   - WangujiQuest.start()                 — Day 100 萬骸祭入口
 *   - WangujiQuest.testStartFromWave(N)    — 從第 N wave 開始（debug）
 */
const WangujiQuest = (() => {

  // ─── Wave 配置（來自 spec § 6c1.1）─────────────────
  const WAVE_CONFIGS = [
    // Wave 1：雜兵 1v3（暖身）— 🆕 2026-05-08 多人戰真做
    {
      id: 'wanguji_wave1',
      title: '萬骸祭・第一場',
      enemies: [
        {
          name: '雜兵・左', STR: 26, DEX: 28, CON: 28, AGI: 30, WIL: 22, LUK: 10,
          hpBase: 50, weaponId: 'shortSword', armorId: 'leatherArmor',
          ai: 'normal', fame: 3,
        },
        {
          name: '雜兵・中', STR: 30, DEX: 30, CON: 30, AGI: 30, WIL: 25, LUK: 10,
          hpBase: 60, weaponId: 'shortSword', armorId: 'leatherArmor',
          ai: 'normal', fame: 4,
        },
        {
          name: '雜兵・右', STR: 28, DEX: 26, CON: 30, AGI: 28, WIL: 24, LUK: 10,
          hpBase: 55, weaponId: 'shortSword', armorId: 'leatherArmor',
          ai: 'normal', fame: 3,
        },
      ],
      fameReward: 12,
      _recoverAfter: { hp: 30, stamina: 30 },
    },
    // Wave 2：重甲鬥士「磐石」
    {
      id: 'wanguji_wave2',
      name: '磐石',
      title: '萬骸祭・重甲鬥士',
      STR: 45, DEX: 25, CON: 60, AGI: 20, WIL: 40, LUK: 10,
      hpBase: 200,
      weaponId: 'warHammer', armorId: 'ironPlate', shieldId: 'ironShield',
      ai: 'cautious', fame: 15, fameReward: 20,
      _recoverAfter: { hp: 20, stamina: 20 },
    },
    // Wave 3：雙刀快攻組合 — 🆕 2026-05-08 真做 1v2
    {
      id: 'wanguji_wave3',
      title: '萬骸祭・快攻組合',
      enemies: [
        {
          name: '雙刀手・卡斯', STR: 32, DEX: 52, CON: 26, AGI: 55, WIL: 28, LUK: 14,
          hpBase: 110, weaponId: 'dagger', armorId: 'studdedLeather',
          ai: 'aggressive', fame: 8,
        },
        {
          name: '雙刀手・利歐', STR: 28, DEX: 50, CON: 28, AGI: 56, WIL: 30, LUK: 16,
          hpBase: 105, weaponId: 'dagger', armorId: 'studdedLeather',
          ai: 'aggressive', fame: 8,
        },
      ],
      fameReward: 22,
      _recoverAfter: { hp: 20, stamina: 20 },
    },
    // Wave 4：黑豹（獸）
    {
      id: 'wanguji_wave4',
      name: '黑豹',
      title: '萬骸祭・獸鬥',
      STR: 50, DEX: 70, CON: 35, AGI: 70, WIL: 20, LUK: 5,
      hpBase: 180,
      weaponId: 'fists', armorId: 'rags',  // 獸 = 無武器無甲
      ai: 'aggressive', fame: 20, fameReward: 25,
      isBeast: true,       // 🆕 2026-05-07：跳過砍首/饒 ChoiceModal
      _recoverAfter: { hp: 20, stamina: 20 },
    },
    // Wave 5：凱德（故意輸版本、屬性 -20%）
    {
      id: 'wanguji_wave5_kade',
      name: '無名者凱德',
      title: '萬骸祭・終局',
      STR: 48, DEX: 48, CON: 48, AGI: 48, WIL: 48, LUK: 20,
      hpBase: 280,
      weaponId: 'longSword_t3', armorId: 'studdedLeather',
      ai: 'cautious',   // 故意輸 — 不太進攻
      fame: 30, fameReward: 50,
      _isKade: true,
      _recoverAfter: null,   // 最後一戰、不再恢復
    },
  ];

  // ─── 內部狀態 ────────────────────────────────────
  let _currentWaveIdx = 0;
  let _onAllWavesDone = null;
  let _onAllWavesFail = null;

  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    }
  }

  function _recoverBetweenWaves(recover) {
    if (!recover) return;
    const p = Stats.player;
    if (!p) return;
    if (recover.hp && typeof Stats.modVital === 'function') {
      Stats.modVital('hp', recover.hp);
    }
    if (recover.stamina && typeof Stats.modVital === 'function') {
      Stats.modVital('stamina', recover.stamina);
    }
  }

  // 🆕 2026-05-08：等戰後對白播完才開下一 wave
  //   bug 1：固定 setTimeout 1500ms 後開下一場、砍首氣氛對白還在跑就被蓋
  //   bug 2（第一次修不夠）：戰鬥中 DialogueModal.play 被丟到 _deferredDuringBattle
  //   queue、onWaveWin fire 時 isOpen 還是 false、poll 立即過 → 之後 flushDeferred
  //   才播、又被新戰鬥蓋
  //   修：用 hasPending() 同時檢查 _isOpen / _queue / _deferredDuringBattle、
  //   且開頭先給 600ms 寬限讓 battle 的 flushDeferred(200ms) 跑完
  function _waitDialogueClose(cb, maxWaitMs) {
    const start = Date.now();
    const limit = maxWaitMs || 30000;
    const stillPending = () => {
      if (typeof DialogueModal === 'undefined') return false;
      if (typeof DialogueModal.hasPending === 'function') return DialogueModal.hasPending();
      return (typeof DialogueModal.isOpen === 'function') && DialogueModal.isOpen();
    };
    const poll = () => {
      if (!stillPending() || (Date.now() - start) > limit) {
        cb();
      } else {
        setTimeout(poll, 400);
      }
    };
    // 寬限 600ms：讓 battle._exitToScene 內 200ms 後的 flushDeferred 把 deferred 推到 _isOpen
    setTimeout(poll, 600);
  }

  // ─── 開始下一 wave（callback chain） ─────────────
  function _startWave(idx) {
    if (idx >= WAVE_CONFIGS.length) {
      _log('✦ 萬骸祭・全 wave 過關！', '#d4af37', true);
      if (typeof _onAllWavesDone === 'function') _onAllWavesDone();
      return;
    }
    _currentWaveIdx = idx;
    const cfg = WAVE_CONFIGS[idx];
    _log(`✦ Wave ${idx + 1}：${cfg.name}`, '#d4af37', true);

    const onWaveWin = () => {
      _log(`✦ Wave ${idx + 1} 過關`, '#a8d878', false);
      // 最後 wave (凱德) 不恢復、直接進入 ChoiceModal
      if (cfg._isKade) {
        _onKadeFalls();
        return;
      }
      _recoverBetweenWaves(cfg._recoverAfter);
      // 🆕 2026-05-08：等戰後對白關閉再開下一 wave（poll DialogueModal.isOpen）
      _waitDialogueClose(() => {
        setTimeout(() => _startWave(idx + 1), 800);   // 對白關後喘 800ms
      });
    };
    const onWaveLose = () => {
      _log(`✦ Wave ${idx + 1} 戰敗 — 萬骸祭結束`, '#d04040', true);
      if (typeof _onAllWavesFail === 'function') _onAllWavesFail(idx);
    };

    if (typeof Battle === 'undefined' || !Battle.startFromConfig) {
      console.error('[WangujiQuest] Battle.startFromConfig not available');
      return;
    }
    Battle.startFromConfig(cfg, onWaveWin, onWaveLose);
  }

  // ─── 凱德倒下後：領主走下競技場 + ChoiceModal ───
  function _onKadeFalls() {
    if (typeof Flags !== 'undefined') {
      Flags.set('kade_died_for_player', true);
      Flags.set('wanguji_completed', true);
    }

    // 凱德對白（小聲、只有玩家聽到）
    const kadeLines = [
      { text: '（凱德倒下。沒掙扎、沒抓你的手、就那樣放開。）' },
      { speaker: '凱德', text: '⋯⋯小弟⋯⋯把它做完。', color: '#bbaa66' },
      { text: '（觀眾爆。你站在凱德身上、滿身是血。）' },
      { text: '（你抬頭、看到領主從台上站起來。）' },
      { speaker: '提圖斯', text: '⋯⋯好。' },
      { text: '（提圖斯走下台階、進入競技場、走向你。）' },
      { text: '（衛兵 4 人跟著、阿圖斯也下來、整個城市的權貴看著。）' },
      { text: '（提圖斯走到離你不到三步遠。）' },
      { speaker: '提圖斯', text: '無名者倒了、你贏了。' },
      { speaker: '提圖斯', text: '⋯⋯說、你要什麼？' },
      { speaker: '提圖斯', text: '自由？金錢？我家當奴僕？' },
      { speaker: '提圖斯', text: '⋯⋯也可以、我給你個位子。當我這的人。' },
    ];

    const showChoice = () => {
      if (typeof ChoiceModal === 'undefined') {
        // fallback：直接走 A 路徑
        _routeA();
        return;
      }
      ChoiceModal.show({
        id: 'wanguji_final_choice',
        icon: '⚔',
        title: '最後決意',
        body: '提圖斯就在你眼前三步。所有人在看。',
        forced: true,
        choices: [
          { id: 'a', label: '⋯⋯領主大人、我選自由。', hint: '接受加冕、走標準結局' },
          { id: 'b', label: '⋯⋯領主大人、我有話對您說。', hint: '暗中給暗號、發動反撲（殘血群戰）' },
          { id: 'c', label: '（沉默、低頭）', hint: '看當下情緒決定' },
        ],
      }, {
        onChoose: (choiceId) => {
          if (choiceId === 'a') _routeA();
          else if (choiceId === 'b') _routeB();
          else _routeC();
        },
      });
    };

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(kadeLines, { onComplete: showChoice });
    } else {
      showChoice();
    }
  }

  // ─── A 路徑：標準過關（既有 ending） ─────────────
  function _routeA() {
    if (typeof Flags !== 'undefined') Flags.set('chose_route_a_coronation', true);
    _log('✦ 你接受加冕。', '#d4af37', true);
    if (typeof Endings !== 'undefined' && Endings.pickAndPlay) {
      Endings.pickAndPlay(true);
    }
  }

  // ─── B 路徑：殘血群戰反撲（stub — 待實作完整群戰）─
  function _routeB() {
    if (typeof Flags !== 'undefined') Flags.set('chose_route_b_rebellion', true);
    _log('✦ 你給了暗號。整座競技場炸開。', '#d04040', true);

    // TODO Phase 2: 實作完整殘血群戰
    //   目前 stub：依玩家好感 80+ NPC 數估算盟友數、隨機判定戰況、直接給結局
    const allyCount = _estimateAllyCount();
    // 隨機簡單判定（暫用、等真正群戰實作後改）
    const dice = Math.random();
    let ctx;
    if (allyCount >= 10 && dice < 0.6) {
      ctx = { allyCount, lordKilled: true, playerSurvived: true };          // 大勝 → freedom
    } else if (allyCount >= 5 && dice < 0.5) {
      ctx = { allyCount, lordKilled: true, playerSurvived: true };          // 小勝 → bloody（內部依 ac < 5 不到、用單獨判定）
      // 觸發 bloody 而不是 freedom：手動降到 bloody
      if (allyCount < 10) ctx.allyCount = 4;
    } else if (dice < 0.6) {
      ctx = { allyCount, lordKilled: true, playerSurvived: false };          // 殉道
    } else {
      ctx = { allyCount, lordKilled: false, playerSurvived: false };          // 失敗
    }

    if (typeof Endings !== 'undefined' && Endings.playRebellion) {
      Endings.playRebellion(ctx);
    }
  }

  // ─── C 路徑：玩家自選衝動或計畫（stub） ──────────
  function _routeC() {
    if (typeof Flags !== 'undefined') Flags.set('chose_route_c_silent', true);
    // 沉默低頭 = 走 A 路徑既有結局（玩家認慫、活下來）
    _log('✦ 你低下頭。提圖斯沒再追問、轉身上台。', '#888', false);
    if (typeof Endings !== 'undefined' && Endings.pickAndPlay) {
      Endings.pickAndPlay(true);
    }
  }

  // ─── 估算盟友數（用好感 + flag）─────────────────
  function _estimateAllyCount() {
    const p = Stats.player;
    if (!p) return 0;
    let count = 0;
    // 名字 NPC 好感 80+ 計入
    if (typeof Teammates !== 'undefined' && Teammates.npcs) {
      Object.values(Teammates.npcs).forEach(npc => {
        if (typeof npc.aff === 'number' && npc.aff >= 80) count++;
      });
    }
    // 招敵成功的維努斯場 NPC
    if (typeof Flags !== 'undefined') {
      if (Flags.has('vesnus_lucius_recruited')) count++;
      if (Flags.has('vesnus_nox_recruited')) count++;
    }
    return count;
  }

  // ══════════════════════════════════════════════════
  // 公開入口
  // ══════════════════════════════════════════════════
  function start(opts) {
    opts = opts || {};
    _onAllWavesDone = opts.onAllDone || (() => {});
    _onAllWavesFail = opts.onAnyFail || (() => {});
    _log('═══ 萬骸祭・5 Wave Gauntlet 開始 ═══', '#d4af37', true);
    _startWave(0);
  }

  function testStartFromWave(waveNum) {
    _onAllWavesDone = () => console.log('[Wanguji] all done');
    _onAllWavesFail = (i) => console.log('[Wanguji] failed at wave', i);
    _startWave(Math.max(0, Math.min(waveNum - 1, WAVE_CONFIGS.length - 1)));
  }

  return {
    start,
    testStartFromWave,
    WAVE_CONFIGS,
  };
})();
