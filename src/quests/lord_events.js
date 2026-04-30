/**
 * lord_events.js — 領主提圖斯主線事件（P1B 系列）
 * ══════════════════════════════════════════════════
 * 設計：[docs/quests/arena-events-roster.md § 6b](../../docs/quests/arena-events-roster.md)
 *       [docs/characters/titus.md](../../docs/characters/titus.md)
 *
 * 5 個出場節點（Day 25/45/65/80/100）：
 *   - Day 25 春季大會 — 提圖斯首次遠望（log + flavor）
 *   - Day 45 白虎獸場 — 強推人虎對決（P1B-8、本檔目前 stub）
 *   - Day 65 領主訪訓練所 + 相認 storyReveal（P1B-3 — 本檔核心）
 *   - Day 80 領主夜宴 + 瓦倫演戲（P1B-6 — 本檔目前 stub）
 *   - Day 100 萬骸祭主席 — 已實作於 wanguji.js
 *
 * Day 65 是核心：對打訓練中震動 + 血味 → 農家 origin 觸發相認
 *   觸發 → 依 Moral.getDispositionType() 分流：
 *     impulsive → 6b.5a 衝動分支（衝出去衛兵戰、可能 GG / 殉道弒主 / AGI 高逃跑）
 *     calm     → 6b.5b 冷靜分支（強壓、設 revenge_plan_started flag、接 Day 80 + Day 100 反撲）
 *     neutral  → 6b.5c 玩家自選 ChoiceModal
 *
 * 依賴：Stage / DialogueModal / ChoiceModal / Flags / Stats / Moral / Endings
 */
const LordEvents = (() => {

  // ─── log helper（CLAUDE.md 第 12 條：bare addLog 是 ReferenceError）─
  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    } else {
      console.warn('[LordEvents] _log: no addLog available', text);
    }
  }

  // ─── DialogueModal + ChoiceModal 串接 helper ───────
  function _playIntroThenChoice(introLines, choiceOpts) {
    if (typeof DialogueModal !== 'undefined' && Array.isArray(introLines) && introLines.length > 0) {
      DialogueModal.play(introLines, {
        onComplete: () => {
          if (typeof ChoiceModal !== 'undefined') ChoiceModal.show(choiceOpts);
        },
      });
    } else {
      if (typeof ChoiceModal !== 'undefined') ChoiceModal.show(choiceOpts);
    }
  }

  function _isFarmboy() {
    const p = Stats.player;
    return p && p.origin === 'farmBoy';
  }

  // ══════════════════════════════════════════════════
  // Day 25：春季大會 — 提圖斯首次遠望
  // ══════════════════════════════════════════════════
  function _tryDay25SpringFestival() {
    const p = Stats.player;
    if (!p || p.day !== 25) return false;
    if (Flags.has('lord_first_seen_d25')) return false;
    Flags.set('lord_first_seen_d25', true);

    if (_isFarmboy()) {
      // 農家 origin：微疑惑、但不確定
      _log('（春季大會。你看到主席台上有個陌生的權貴——本城新領主、提圖斯。）', '#888', false);
      _log('（⋯⋯有點面熟。但你說不上來在哪見過。）', '#666', true);
      Flags.set('farmboy_lord_first_glimpse', true);
    } else {
      // 其他 origin：純權貴、無感
      _log('（春季大會。本城新領主提圖斯坐在主席台、嚴肅、不太笑。）', '#888', false);
    }
    return true;
  }

  // ══════════════════════════════════════════════════
  // Day 45：白虎獸場（P1B-8 stub — 待後續完整實作）
  // ══════════════════════════════════════════════════
  function _tryDay45WhiteTiger() {
    const p = Stats.player;
    if (!p || p.day !== 45) return false;
    if (Flags.has('lord_white_tiger_d45')) return false;
    Flags.set('lord_white_tiger_d45', true);
    // TODO P1B-8：實作完整白虎獸場戰鬥（特殊機制 — SPD 80 / ACC 100 / HP 250、需 DEX 高閃 / WIL 嚇）
    _log('（領主從遠方買了一頭白虎、宣布「人虎對決」。主人推你上去。）', '#a04020', true);
    _log('（⋯⋯這是 P1B-8 待實作的場景。先以 log 帶過。）', '#666', false);
    return true;
  }

  // ══════════════════════════════════════════════════
  // Day 65：領主訪訓練所 + 相認 storyReveal（P1B-3 核心）
  // ══════════════════════════════════════════════════
  function _tryDay65Visit() {
    const p = Stats.player;
    if (!p || p.day !== 65) return false;
    if (Flags.has('lord_visit_d65_done')) return false;
    Flags.set('lord_visit_d65_done', true);

    if (_isFarmboy()) {
      _playFarmboyRecognition();
    } else {
      _playGenericVisit();
    }
    return true;
  }

  // ── 非農家 origin：純權貴巡視 ────────────────────
  function _playGenericVisit() {
    const lines = [
      { text: '（侍從匆匆來通報——領主大人來訪。）' },
      { text: '（阿圖斯整理袍服、衝出去迎接。）' },
      { text: '（你被叫上場跟同訓練所的人對打、給領主看。）' },
      { speaker: '提圖斯', text: '⋯⋯不錯。' },
      { speaker: '阿圖斯', text: '謝大人賞識！' },
      { speaker: '提圖斯', text: '⋯⋯阿圖斯、賞他點酒。' },
      { text: '（領主只看了你一眼、轉身就走。整場訪問不到 10 分鐘。）' },
    ];
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines);
    } else {
      lines.forEach(l => _log(l.speaker ? `${l.speaker}：${l.text}` : l.text, '#888', false));
    }
    _log('✦ 主人賞了一杯酒。fame +5。', '#c8a060', true);
    if (typeof Stats !== 'undefined') Stats.modFame(5);
    if (typeof teammates !== 'undefined') teammates.modAffection('masterArtus', 1);
  }

  // ── 農家 origin：相認 storyReveal（核心戲）────────
  function _playFarmboyRecognition() {
    const recognitionLines = [
      { text: '（侍從匆匆來通報——領主大人來訪。）' },
      { text: '（阿圖斯整理袍服、衝出去迎接。）' },
      { text: '（領主跟阿圖斯坐在台上。）' },
      { text: '（你被抓上場跟同訓練所的人對打。）' },
      { text: '⋯⋯' },
      { text: '（震——）' },
      { text: '（對方一拳砸在你肋下。）' },
      { text: '（你後退一步、抬頭、看到台上那張臉。）' },
      { text: '（震——）' },
      { text: '（又一拳。這次打中你的眉骨。）' },
      { text: '（鮮血流下來、滑進你嘴裡。）' },
      { text: '⋯⋯' },
      { text: '（鐵的味道。）' },
      { text: '（不對——這味道你聞過。）' },
      { text: '（媽把你撲倒在柴堆後那天。）' },
      { text: '（她身上的血滴在你臉上、流進你嘴裡。）' },
      { text: '（同一個味道。）' },
      { text: '（你抬頭、再看一眼那張臉。）' },
      { text: '（——是他。）' },
      { text: '（火光裡、騎在馬上、下令的那張臉。）' },
      { text: '（前幾個月、就在你眼前。）' },
    ];

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(recognitionLines, {
        onComplete: () => _routeByDisposition(),
      });
    } else {
      recognitionLines.forEach(l => _log(l.text, '#888', false));
      _routeByDisposition();
    }
  }

  // ── Day 65 相認後：依 disposition 分流 ───────────
  function _routeByDisposition() {
    Flags.set('farmboy_recognized_lord', true);
    Flags.set('revenge_target_lord', true);

    const disposition = (typeof Moral !== 'undefined' && Moral.getDispositionType)
                          ? Moral.getDispositionType() : 'neutral';

    if (disposition === 'impulsive') {
      _routeImpulsive();
    } else if (disposition === 'calm') {
      _routeCalm();
    } else {
      _routeNeutralChoice();
    }
  }

  // ── 6b.5a 衝動分支：當場衝出去 ──────────────────
  function _routeImpulsive() {
    Flags.set('lord_impulse_charge', true);
    const lines = [
      { text: '（你的手指掐進掌心。）' },
      { text: '（——不能等。）' },
      { text: '（你撞翻訓練圍欄、撲向台上。）' },
      { text: '（——衛兵的長矛來得快。）' },
    ];
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, { onComplete: _resolveImpulseOutcome });
    } else {
      _resolveImpulseOutcome();
    }
  }

  // ── 衝動結果判定（依屬性）──────────────────────
  function _resolveImpulseOutcome() {
    const p = Stats.player;
    if (!p) return;
    const STR = Stats.eff('STR'), DEX = Stats.eff('DEX'), AGI = Stats.eff('AGI');

    // 殉道弒主：STR 50 + DEX 50 + AGI 50（夢幻）
    if (STR >= 50 && DEX >= 50 && AGI >= 50) {
      _log('✦ 你撞翻衛兵、撲上提圖斯的台、一刀刺進他胸口。', '#8b3030', true);
      if (typeof Endings !== 'undefined' && Endings.playImpulse) {
        setTimeout(() => Endings.playImpulse({ lordKilled: true }), 800);
      }
      return;
    }
    // AGI 高逃跑：AGI ≥ 60
    if (AGI >= 60) {
      _log('✦ 你閃身、翻牆、跳屋頂——衛兵追不上。', '#9a8050', true);
      if (typeof Endings !== 'undefined' && Endings.playImpulse) {
        setTimeout(() => Endings.playImpulse({ escaped: true }), 800);
      }
      return;
    }
    // 預設：失敗 GG
    _log('✦ 衛兵的長矛先到。你倒在沙地上、嘴裡是血。', '#5a2020', true);
    if (typeof Endings !== 'undefined' && Endings.playImpulse) {
      setTimeout(() => Endings.playImpulse({}), 800);
    }
  }

  // ── 6b.5b 冷靜分支：強壓、計畫 ──────────────────
  function _routeCalm() {
    Flags.set('revenge_plan_started', true);
    const lines = [
      { text: '（你低下頭。）' },
      { text: '（手指掐進掌心。）' },
      { text: '（——現在不行。）' },
      { text: '（——他有衛兵、你沒武器、阿圖斯在場、衝出去就是死。）' },
      { text: '（你聽到自己的呼吸。很慢。一下、一下。）' },
      { text: '（——記住這張臉。）' },
      { text: '（——記住這個感覺。）' },
      { text: '（你舉起手繼續打。）' },
      { text: '（對方的拳頭打在你身上、你完全沒感覺。）' },
    ];
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => {
          _log('✦ 你決定忍下來、計畫。Day 80 領主夜宴會繼續鋪墊。', '#666', true);
        },
      });
    }
  }

  // ── 6b.5c 中性分支：玩家自選 ──────────────────────
  function _routeNeutralChoice() {
    const introLines = [
      { text: '（你看到了那張臉。）' },
      { text: '（你的呼吸停了一下。）' },
      { text: '（——你怎麼辦？）' },
    ];
    _playIntroThenChoice(introLines, {
      id: 'lord_recognition_neutral_choice',
      icon: '⚔',
      title: '你怎麼辦？',
      body: '提圖斯就在台上。所有人都在看你打架。',
      forced: true,
      choices: [
        { id: 'charge',  label: '衝出去！',         hint: '走衝動分支（多半 GG）' },
        { id: 'endure',  label: '強壓下來、計畫',   hint: '走冷靜分支（接 Day 80 + Day 100）' },
        { id: 'ignore',  label: '假裝沒看到',       hint: '不復仇、活下來、夜思反覆煎熬' },
      ],
    }, {
      onChoose: (choiceId) => {
        if (choiceId === 'charge')      _routeImpulsive();
        else if (choiceId === 'endure') _routeCalm();
        else                            _routeIgnore();
      },
    });
  }

  // ── 假裝沒看到 ────────────────────────────────────
  function _routeIgnore() {
    Flags.set('lord_recognition_ignored', true);
    _log('（你低下頭、繼續打。手在抖。但你沒抬頭。）', '#666', false);
    _log('✦ 你選擇不復仇。但這天夜裡會反覆做夢。', '#888', true);
  }

  // ══════════════════════════════════════════════════
  // Day 80：領主夜宴 + 瓦倫演戲（P1B-6 stub）
  // ══════════════════════════════════════════════════
  function _tryDay80Banquet() {
    const p = Stats.player;
    if (!p || p.day !== 80) return false;
    if (Flags.has('lord_banquet_d80_done')) return false;

    // 出席條件：fame ≥ 30 + 阿圖斯好感 ≥ 50（被選為隨從）
    //   或冷靜分支自動觸發（已決定要復仇、會主動爭取出席）
    const fame = p.fame || 0;
    const masterAff = (typeof teammates !== 'undefined') ? teammates.getAffection('masterArtus') : 0;
    const calmRevenge = Flags.has('revenge_plan_started');
    const eligible = (fame >= 30 && masterAff >= 50) || calmRevenge;
    if (!eligible) return false;

    Flags.set('lord_banquet_d80_done', true);
    // TODO P1B-6：實作完整瓦倫演戲場景（鄰居名字錯誤 + 臉/手/講話 4 破綻）
    _log('（領主辦夜宴。你被選為隨從、出席。提圖斯讓「瓦倫」出來演戲。）', '#a04020', true);
    if (_isFarmboy()) {
      _log('（⋯⋯瓦倫講「老盧夏的養豬戶」。你們村是老麥可。沒人姓盧夏。）', '#a04020', true);
      _log('✦ 你確認了——他是兇手、瓦倫是假村民。', '#8b3030', true);
      Flags.set('lord_self_glorification_witnessed', true);
    } else {
      _log('（瓦倫講話太順、像背稿。但你不確定為什麼覺得不對。）', '#888', false);
    }
    return true;
  }

  // ══════════════════════════════════════════════════
  // 初始化：註冊 DayCycle 鉤子
  // ══════════════════════════════════════════════════
  function init() {
    if (typeof DayCycle === 'undefined' || typeof DayCycle.onDayStart !== 'function') return;

    DayCycle.onDayStart('lordMilestones', () => {
      // 由早到晚試
      if (_tryDay80Banquet()) return;
      if (_tryDay65Visit())   return;
      if (_tryDay45WhiteTiger()) return;
      if (_tryDay25SpringFestival()) return;
    }, 40);   // 一般內容優先度
  }

  // 模組載入時自動 init
  init();

  return {
    init,
    // 暴露給 console / 其他模組測試用
    _tryDay25SpringFestival,
    _tryDay45WhiteTiger,
    _tryDay65Visit,
    _tryDay80Banquet,
    // debug
    testRecognition: () => _playFarmboyRecognition(),
    testBanquet: () => _tryDay80Banquet(),
  };
})();
