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
  // Day 45：白虎獸場（P1B-8 完整實作）
  // ══════════════════════════════════════════════════
  // 設計：[arena-events-roster.md § 6.2](../../docs/quests/arena-events-roster.md)
  //   羅馬 venatio（獸鬥）— 領主買白虎、強推玩家對決
  //   白虎屬性：高 SPD/AGI（暴衝難先攻）+ 低 WIL（怕嚇）+ 低 DEF（脆但難打到）
  //   玩家提示（透過 log）：DEX 高 → 閃避；WIL 高 → 嚇牠
  //   勝：fame +50 + 「白虎獵者」永久特性 + 領主好感
  //   敗：重傷退場（不死、Day 100 才真死）
  // ══════════════════════════════════════════════════
  function _tryDay45WhiteTiger() {
    const p = Stats.player;
    if (!p || p.day !== 45) return false;
    if (Flags.has('lord_white_tiger_d45')) return false;
    Flags.set('lord_white_tiger_d45', true);

    const introLines = [
      { text: '（侍從匆匆來通報。）' },
      { speaker: '侍從', text: '⋯⋯領主大人有令——今日獸場、人虎對決。' },
      { text: '（阿圖斯臉色不太好、但點頭。）' },
      { speaker: '阿圖斯', text: '⋯⋯把他推上去。' },
      { text: '（你被押進競技場。場中央——）' },
      { text: '（一頭白虎、籠中發出低吼。）' },
      { text: '（牠的眼睛是藍的。比你想像的大。）' },
      { speaker: '提圖斯', text: '——開籠。' },
      { text: '（鐵柵升起。白虎踏出來、繞著沙地走。）' },
      { text: '（你握緊武器。手心全是汗。）' },
      // 提示 log（給玩家戰術線索）
      { text: '（——牠的速度比人快。閃過第一擊是關鍵。）', color: '#888' },
      { text: '（——牠不怕劍、但怕吼。意志強的人喊一聲、能讓牠退一步。）', color: '#888' },
    ];

    const startTigerBattle = () => {
      _log('🐅【白虎獸場】Day 45 領主強推、人虎對決開始。', '#c04020', true);

      const tigerCfg = {
        name: '白虎',
        title: '領主從遠方買來的異獸',
        STR: 30, DEX: 60, CON: 30, AGI: 70, WIL: 10, LUK: 5,
        hpBase: 250,
        weaponId: 'fists',   // 獸 = 無武器（爪牙從 STR 算）
        armorId:  'rags',    // 獸 = 無甲（DEF 低）
        shieldId: 'none',
        ai: 'aggressive',
        fame: 30,
        fameReward: 50,
        isBeast: true,       // 🆕 2026-05-07：跳過砍首/饒 ChoiceModal、用獸氣氛
      };

      const onWin = () => {
        _log('🐅 白虎倒下。觀眾爆。', '#c04020', true);
        _log('✦ 名聲 +50（fame reward 自動結算）', '#d4af37', false);
        // 加「白虎獵者」永久特性
        if (Stats.player && Array.isArray(Stats.player.traits)) {
          if (!Stats.player.traits.includes('whiteTigerHunter')) {
            Stats.player.traits.push('whiteTigerHunter');
            _log('✦ 獲得永久特性：白虎獵者', '#d4af37', true);
          }
        }
        // 領主好感（提圖斯第一次「多看一眼」）
        if (typeof teammates !== 'undefined') {
          teammates.modAffection('titus', 5);
          teammates.modAffection('masterArtus', 3);
        }
        Flags.set('white_tiger_won', true);
        // 後話對白
        if (typeof DialogueModal !== 'undefined') {
          DialogueModal.play([
            { text: '（觀眾起立、歡呼。）' },
            { text: '（你站在白虎屍體旁、喘氣。）' },
            { text: '（你抬頭、看到提圖斯在主席台上。）' },
            { text: '（他點了一下頭。沒笑。但眼神不一樣了。）' },
            { speaker: '提圖斯', text: '⋯⋯這個鬥士、留著。' },
          ]);
        }
      };

      const onLose = () => {
        _log('🐅 白虎撲倒了你。觀眾尖叫。', '#c04020', true);
        _log('✦ 你倒在沙地上、白虎的爪子離你脖子三寸。', '#8b3030', true);
        // 重傷但不死（Day 100 才真死）
        Stats.modVital('hp', -50);
        Stats.modVital('stamina', -40);
        Stats.modVital('mood', -30);
        Stats.modFame(-15);
        Flags.set('white_tiger_lost', true);
        // 對白演出
        if (typeof DialogueModal !== 'undefined') {
          DialogueModal.play([
            { text: '（侍從衝上場、用棍棒把白虎引開。）' },
            { text: '（白虎被拖回籠子。你被抬下場。）' },
            { speaker: '阿圖斯', text: '⋯⋯（沉默）' },
            { speaker: '阿圖斯', text: '⋯⋯沒死就回去訓練。' },
            { text: '（你聽到提圖斯在台上說話。）' },
            { speaker: '提圖斯', text: '⋯⋯可惜。' },
          ]);
        }
      };

      if (typeof Battle !== 'undefined' && Battle.startFromConfig) {
        Battle.startFromConfig(tigerCfg, onWin, onLose);
      } else {
        console.error('[LordEvents] Battle.startFromConfig not available');
      }
    };

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(introLines, { onComplete: startTigerBattle });
    } else {
      startTigerBattle();
    }
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
  // Day 80：領主夜宴 + 瓦倫演戲（P1B-6 完整實作）
  // ══════════════════════════════════════════════════
  // 設計：[arena-events-roster.md § 6b.6](../../docs/quests/arena-events-roster.md)
  // 出席條件：fame ≥ 30 + 阿圖斯好感 ≥ 50、或冷靜分支已啟動
  //
  // 瓦倫的 4 個破綻（從表面到深層）：
  //   1. 鄰居名字錯（「老盧夏的養豬戶」、玩家家鄉真的是老麥可）— 農家 origin 限定
  //   2. 臉（白、沒曬痕、鬢角修過）
  //   3. 手（沒繭、指甲修過）
  //   4. 講話風格（太順、像背稿）
  // 非農家 origin 只看到後 3 層、聽不出第 1 層
  // ══════════════════════════════════════════════════
  function _tryDay80Banquet() {
    const p = Stats.player;
    if (!p || p.day !== 80) return false;
    if (Flags.has('lord_banquet_d80_done')) return false;

    const fame = p.fame || 0;
    const masterAff = (typeof teammates !== 'undefined') ? teammates.getAffection('masterArtus') : 0;
    const calmRevenge = Flags.has('revenge_plan_started');
    const eligible = (fame >= 30 && masterAff >= 50) || calmRevenge;
    if (!eligible) return false;

    Flags.set('lord_banquet_d80_done', true);

    if (_isFarmboy()) {
      _playBanquetFarmboy();
    } else {
      _playBanquetGeneric();
    }
    return true;
  }

  // ── 農家 origin：完整 4 破綻 → 確認復仇 ──────────
  function _playBanquetFarmboy() {
    const lines = [
      // ── 場景設置 ────────────────────────
      { text: '（領主在自家莊園辦夜宴。）' },
      { text: '（阿圖斯、蓋烏斯、其他主人、城裡權貴都在。）' },
      { text: '（你被選為隨從——倒酒、站在主人身後。）' },
      { text: '（席間有人提到「平亂之功」。眾人舉杯。）' },
      { speaker: '阿圖斯', text: '敬領主大人——保我邊境平安。' },
      { speaker: '蓋烏斯', text: '⋯⋯願您再立大功。' },
      { text: '（眾人乾杯。）' },
      { speaker: '提圖斯', text: '⋯⋯算不上什麼。當時情勢、不得不為。' },
      { text: '（某主人靠近一點。）' },
      { speaker: '某主人', text: '不、不、領主太謙了。聽說您救了整村的人？' },
      { speaker: '提圖斯', text: '——這個倒是真的。' },
      { speaker: '提圖斯', text: '我帶人上去時、敵國掠奪隊還在屠村。我們殺進去、把活的救出來。' },
      { speaker: '提圖斯', text: '⋯⋯瓦倫、過來。' },
      { text: '（一個 30 多歲的男人從旁邊走出來、低頭、規矩、穿乾淨僕人服。）' },
      { speaker: '提圖斯', text: '這位就是當天我從那村救出來的。瓦倫、跟大人們講講。' },

      // ── 瓦倫開講 ────────────────────────
      { speaker: '瓦倫', text: '⋯⋯那天、敵國軍隊衝進來、燒了我家。' },

      // ── 破綻 1（農家專屬）：鄰居名字錯 ──
      { speaker: '瓦倫', text: '隔壁老盧夏的養豬戶救了我一戶、我躲到他家後院豬圈裡。' },
      { text: '（你倒酒的手停了一下。）' },
      { text: '（瓦倫？這個名字不熟。）' },
      { text: '（——老盧夏？）' },
      { text: '（你們村的養豬戶是老麥可。從你還沒記事就在養。）' },
      { text: '（沒人姓盧夏。村裡每一戶你都認識。）' },
      { text: '（——他根本不是我們村的人。）', color: '#ff8866' },

      // ── 瓦倫繼續 ─────────────────────────
      { speaker: '瓦倫', text: '後來⋯⋯後來領主大人帶兵殺到、把那些畜生砍了。' },
      { speaker: '瓦倫', text: '我從豬圈裡爬出來、就看到大人騎在馬上、像神一樣⋯⋯' },
      { text: '（眾人感嘆。有人哽咽。）' },

      // ── 破綻 2：臉 ────────────────────────
      { text: '（你抬頭看瓦倫的臉。）' },
      { text: '（皮膚白、沒風吹日曬的痕跡。）' },
      { text: '（鬢角修過、下巴乾淨。）' },
      { text: '（——這不是農夫的臉。）', color: '#ff8866' },

      // ── 破綻 3：手 ────────────────────────
      { text: '（你低頭看瓦倫的手。手放在桌邊。）' },
      { text: '（指甲修過、指節沒曬痕、掌心⋯⋯沒繭。）' },
      { text: '（——這不是握過鋤頭的手。）', color: '#ff8866' },

      // ── 破綻 4：講話風格 ───────────────────
      { text: '（你再聽他講。）' },
      { text: '（用詞太順、太漂亮。）' },
      { text: '（真的倖存者講話該哽住、該抖、該不知道從哪講起。）' },
      { text: '（你想起你媽病重那年、村裡的人來探望、講話都是斷的、句子接不起來的。）' },
      { text: '（——這是背過的台詞。）', color: '#ff8866' },
      { text: '（——他是被買來、教好了演這齣的。）', color: '#ff8866' },

      // ── 主人們繼續吹捧 ──────────────────────
      { speaker: '某主人', text: '⋯⋯領主真是仁德之人。' },
      { speaker: '提圖斯', text: '⋯⋯都是該做的。' },

      // ── 玩家確認復仇 ────────────────────────
      { text: '（你的眼睛慢慢轉向提圖斯。）' },
      { text: '（提圖斯正笑著舉杯、接受眾人敬酒。）' },
      { text: '（你終於明白了。）' },
      { text: '（他不是「敵國人」。）' },
      { text: '（他是自己人。）' },
      { text: '（他殺了你村、然後升官、現在還在這裡——演自己是英雄。）', color: '#ff5544' },
      { text: '（你的手指掐住酒壺。）' },
      { text: '（壺裡的酒晃了。）' },
      { text: '（沒人發現。你站好。）' },
      { text: '（——我要殺了他。）', color: '#ff5544' },
      { text: '（——我要讓所有人知道他做了什麼。）', color: '#ff5544' },
    ];

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => {
          Flags.set('lord_self_glorification_witnessed', true);
          _log('✦ 你確認了——提圖斯是兇手、瓦倫是買來的演員。', '#8b3030', true);
          _log('（這是你最後一次跟他面對面、之前。）', '#666', false);
          // 推 pride 軸（玩家看到不公而沒當場發作 = 隱忍）
          if (typeof Moral !== 'undefined' && Moral.push) {
            Moral.push('patience', 'positive');
          }
          // 🆕 2026-05-07 P1C-5：瓦倫戲後接凱德相認場景（如果條件符合）
          if (typeof KadeEvents !== 'undefined' && KadeEvents.tryDay80Recognition) {
            setTimeout(() => KadeEvents.tryDay80Recognition(), 800);
          }
        },
      });
    } else {
      lines.forEach(l => _log(l.speaker ? `${l.speaker}：${l.text}` : l.text, '#888', false));
      Flags.set('lord_self_glorification_witnessed', true);
      if (typeof KadeEvents !== 'undefined' && KadeEvents.tryDay80Recognition) {
        KadeEvents.tryDay80Recognition();
      }
    }
  }

  // ── 非農家 origin：3 個破綻、無法確認 ──────────
  function _playBanquetGeneric() {
    const lines = [
      { text: '（領主在自家莊園辦夜宴。）' },
      { text: '（你被選為隨從——倒酒、站在主人身後。）' },
      { speaker: '提圖斯', text: '⋯⋯瓦倫、過來。跟大人們講講當年的事。' },
      { text: '（一個 30 多歲的男人走出來、低頭、規矩、穿乾淨僕人服。）' },
      { speaker: '瓦倫', text: '⋯⋯那天、敵國軍隊衝進來、燒了我家。我躲在豬圈裡⋯⋯' },
      { speaker: '瓦倫', text: '後來領主大人帶兵殺到、把那些畜生砍了⋯⋯' },
      { text: '（你聽著、覺得哪裡不對。）' },
      { text: '（瓦倫的臉太白、沒曬痕。）' },
      { text: '（手沒繭、指甲修過。）' },
      { text: '（講話太順、像背稿。）' },
      { text: '（——他不像是農夫。）' },
      { text: '（但你不確定為什麼有人要演這齣。）' },
      { speaker: '某主人', text: '⋯⋯領主真是仁德之人。' },
      { speaker: '提圖斯', text: '⋯⋯都是該做的。' },
      { text: '（夜宴繼續。你倒著酒。心裡有疑問、但問不出口。）' },
    ];
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => {
          Flags.set('lord_banquet_seen_anomaly', true);
          _log('✦ 你看到了什麼不對勁、但說不上來。', '#888', false);
        },
      });
    } else {
      lines.forEach(l => _log(l.speaker ? `${l.speaker}：${l.text}` : l.text, '#888', false));
    }
  }

  // ══════════════════════════════════════════════════
  // P1B-7：偽旗深層 storyReveal（農家 origin 限定、Day 65 相認後陪隨復仇煎熬）
  // ══════════════════════════════════════════════════
  // 設計：4 個固定 day 觸發點、玩家 Day 65 相認後內心慢慢滾動的真相層次
  //   Day 70：媽媽倒下時最後一句話（記憶碎片）
  //   Day 75：訓練場背景士兵閒聊「那場邊境平亂」（暗示偽旗）
  //   Day 85：盔甲破綻 — 「敵國軍隊」用的是帝國制式裝備
  //   Day 92：村裡每張臉的回憶（推進復仇決心）
  //
  // 條件：farmBoy origin + farmboy_recognized_lord + 對應 day
  // 推道德軸：每次 patience 軸 +（隱忍累積）
  // ══════════════════════════════════════════════════

  function _farmboyDeepRevealEligible() {
    const p = Stats.player;
    if (!p) return false;
    if (!_isFarmboy()) return false;
    return Flags.has('farmboy_recognized_lord');
  }

  function _tryDay70MotherWords() {
    const p = Stats.player;
    if (!p || p.day !== 70) return false;
    if (Flags.has('lord_deep_d70')) return false;
    if (!_farmboyDeepRevealEligible()) return false;
    Flags.set('lord_deep_d70', true);

    const lines = [
      { text: '（夜裡你睡不著。）' },
      { text: '（柴堆後那一刻、媽撲倒在你身上。）' },
      { text: '（她最後說了什麼？）' },
      { text: '⋯⋯' },
      { text: '（——「躲好。」）' },
      { text: '（——「不要叫。」）' },
      { text: '（——「找你爸的弟弟⋯⋯」）' },
      { text: '（你還沒等她說完、她就沒聲音了。）' },
      { text: '（你爸的弟弟。叔叔。在城北。）' },
      { text: '（你不知道他活著沒。）' },
      { text: '（你不知道你能不能去找他。）' },
      { text: '（——但這個名字、你會記住。）', color: '#ff8866' },
    ];
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => {
          if (typeof Moral !== 'undefined' && Moral.push) Moral.push('patience', 'positive');
        },
      });
    }
    return true;
  }

  function _tryDay75BackgroundChatter() {
    const p = Stats.player;
    if (!p || p.day !== 75) return false;
    if (Flags.has('lord_deep_d75')) return false;
    if (!_farmboyDeepRevealEligible()) return false;
    Flags.set('lord_deep_d75', true);

    const lines = [
      { text: '（早上、你在訓練場掃地。）' },
      { text: '（兩個老兵在牆角抽煙、沒注意到你。）' },
      { speaker: '老兵 A', text: '⋯⋯那場「邊境平亂」啊。' },
      { speaker: '老兵 B', text: '提圖斯升領主就靠那一手。' },
      { speaker: '老兵 A', text: '⋯⋯你當時也在？' },
      { speaker: '老兵 B', text: '⋯⋯（沉默）' },
      { speaker: '老兵 B', text: '別問。' },
      { speaker: '老兵 A', text: '⋯⋯這麼說、是真的？' },
      { speaker: '老兵 B', text: '我說別問。' },
      { text: '（兩人沉默了一會。）' },
      { speaker: '老兵 A', text: '⋯⋯我表哥也在那場。' },
      { speaker: '老兵 A', text: '回來後三個月就上吊了。' },
      { text: '（老兵 B 沒講話、把煙掐了。）' },
      { text: '（你低頭繼續掃地。耳朵卻在震。）' },
      { text: '（——所以那不是真的「敵國軍隊」。）', color: '#ff8866' },
      { text: '（——當年參戰的人、自己都活不下去。）', color: '#ff8866' },
    ];
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => {
          if (typeof Moral !== 'undefined' && Moral.push) Moral.push('patience', 'positive');
        },
      });
    }
    return true;
  }

  function _tryDay85ArmorSlip() {
    const p = Stats.player;
    if (!p || p.day !== 85) return false;
    if (Flags.has('lord_deep_d85')) return false;
    if (!_farmboyDeepRevealEligible()) return false;
    Flags.set('lord_deep_d85', true);

    const lines = [
      { text: '（領主府衛兵跟著阿圖斯來訓練場巡視。）' },
      { text: '（你站在角落、等他們離開。）' },
      { text: '（你看到衛兵的胸甲。）' },
      { text: '（——銅釘的排列。）' },
      { text: '（——肩膀上那個獅頭。）' },
      { text: '（——皮帶扣的形狀。）' },
      { text: '⋯⋯' },
      { text: '（你想起那天、媽撲倒你之後、你從柴堆縫看出去。）' },
      { text: '（衝進村裡的「敵國軍隊」、肩膀上也有獅頭。）' },
      { text: '（皮帶扣是一樣的。）' },
      { text: '（銅釘排列⋯⋯一模一樣。）', color: '#ff8866' },
      { text: '（你以前以為是巧合。或記錯了。）' },
      { text: '（現在你知道。）' },
      { text: '（——那群人穿的、就是帝國軍隊的甲。）', color: '#ff5544' },
      { text: '（——只是把外面的記號改了。）', color: '#ff5544' },
    ];
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => {
          if (typeof Moral !== 'undefined' && Moral.push) Moral.push('patience', 'positive');
          // 強化復仇決心
          Flags.set('false_flag_armor_match_seen', true);
        },
      });
    }
    return true;
  }

  function _tryDay92VillageFaces() {
    const p = Stats.player;
    if (!p || p.day !== 92) return false;
    if (Flags.has('lord_deep_d92')) return false;
    if (!_farmboyDeepRevealEligible()) return false;
    Flags.set('lord_deep_d92', true);

    const lines = [
      { text: '（剩下八天。萬骸祭。）' },
      { text: '（夜裡你閉上眼、想看到媽的臉。）' },
      { text: '（但你看到的不只她。）' },
      { text: '⋯⋯' },
      { text: '（——老麥可的養豬戶。他每天早上跟你打招呼。）' },
      { text: '（——隔壁的銅匠老阿圖。他打過你第一把鐮刀。）' },
      { text: '（——磨坊的莉莎嬸。她送過你媽止咳的藥草。）' },
      { text: '（——河邊釣魚的老頭、你不知道他名字、但他會分你魚。）' },
      { text: '（——所有的孩子、玩跳房子的、捉迷藏的、跟你一起放牛的。）' },
      { text: '（——他們每一張臉。）', color: '#ff8866' },
      { text: '（你不能讓他們白死。）' },
      { text: '（你不能讓提圖斯演英雄。）' },
      { text: '（八天。再撐八天。）', color: '#ff5544' },
    ];
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => {
          if (typeof Moral !== 'undefined' && Moral.push) Moral.push('patience', 'positive');
          Flags.set('village_faces_remembered', true);
        },
      });
    }
    return true;
  }

  // ══════════════════════════════════════════════════
  // 初始化：註冊 DayCycle 鉤子
  // ══════════════════════════════════════════════════
  function init() {
    if (typeof DayCycle === 'undefined' || typeof DayCycle.onDayStart !== 'function') return;

    DayCycle.onDayStart('lordMilestones', () => {
      // 由早到晚試（一個 day 只會 fire 一個）
      if (_tryDay92VillageFaces())   return;
      if (_tryDay85ArmorSlip())      return;
      if (_tryDay80Banquet())        return;
      if (_tryDay75BackgroundChatter()) return;
      if (_tryDay70MotherWords())    return;
      if (_tryDay65Visit())          return;
      if (_tryDay45WhiteTiger())     return;
      if (_tryDay25SpringFestival()) return;
    }, 40);   // 一般內容優先度
  }

  // 模組載入時自動 init
  init();

  return {
    init,
    // 內部 try* 暴露給 console / 其他模組（會檢查 day + flag）
    _tryDay25SpringFestival,
    _tryDay45WhiteTiger,
    _tryDay65Visit,
    _tryDay70MotherWords,
    _tryDay75BackgroundChatter,
    _tryDay80Banquet,
    _tryDay85ArmorSlip,
    _tryDay92VillageFaces,
    // debug — 不檢查 day、直接演對白；戰鬥事件需先 Stats.player.day = N
    testRecognition: () => _playFarmboyRecognition(),
    testBanquet:     () => _isFarmboy() ? _playBanquetFarmboy() : _playBanquetGeneric(),
  };
})();
