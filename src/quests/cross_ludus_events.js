/**
 * cross_ludus_events.js — 跨訓練所事件（P2 系列）
 *
 * 設計：[docs/quests/arena-events-roster.md § 2](../../docs/quests/arena-events-roster.md)
 *
 * 5 種跨訓練所事件:
 *   - P2-3 友鄰切磋（每 7-10 天、隨機觸發）
 *   - P2-4 雙主人合作場（Day 35）
 *   - P2-5 雙主人陰招場（Day 60）
 *   - P2-6 互換新兵（Day 50 + Day 80）
 *   - P2-* 公開宴會撕逼（Day 75）
 *
 * 本輪實作 MVP：友鄰切磋（P2-3）— 其他留 stub / 後續迭代。
 *
 * 觸發：DayCycle.onDayStart hook
 * 依賴：DialogueModal / Battle / Flags / Stats / teammates
 */
const CrossLudusEvents = (() => {

  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    }
  }

  // ═══════════════════════════════════════════════════
  // P2-3 友鄰切磋（隨機 7-10 天觸發、Day 12+）
  // ═══════════════════════════════════════════════════
  // 維努斯場派一個 NPC 過來、跟玩家打非死戰、輸贏都活
  // 條件：Day ≥ 12 + 主人好感 ≥ 30 + 距離上次至少 7 天
  // 對手：依玩家當期屬性 ±3、隨機抽維努斯場 NPC（多半是布魯圖、奎因圖斯）
  // 獎勵：贏 → 金錢 30 + 名聲 5；輸 → 名聲 -3 + 對方碎念
  // ═══════════════════════════════════════════════════

  const FRIENDLY_SPAR_OPPONENTS = [
    {
      npcId: 'vesnusBrutus', name: '布魯圖', title: '維努斯場・大斧手',
      STR: 1.2, DEX: 0.7, CON: 1.0, AGI: 0.6, WIL: 0.8, LUK: 0.5,
      hpBase: 130,
      weaponId: 'heavyAxe', armorId: 'leatherArmor',
      taunts: [
        '⋯⋯阿圖斯這寵物、就這點力氣？',
        '你們那邊是垃圾場吧。',
        '回去叫蓋拉幫你打把好劍、別丟阿圖斯臉。',
      ],
    },
    {
      npcId: 'vesnusQuinctus', name: '奎因圖斯', title: '維努斯場・愛現男',
      STR: 0.9, DEX: 1.0, CON: 0.7, AGI: 1.2, WIL: 0.6, LUK: 0.8,
      hpBase: 110,
      weaponId: 'shortSword', armorId: 'leatherArmor',
      taunts: [
        '⋯⋯（他朝觀眾鞠躬、轉身對你笑了一下。）',
        '這是友誼賽、別緊張嘛、來吧。',
        '⋯⋯（他輕鬆閃開你前兩拳、像在跳舞。）',
      ],
    },
    {
      npcId: 'vesnusFaus', name: '法烏斯', title: '維努斯場・冷血執行者',
      STR: 1.0, DEX: 1.0, CON: 0.9, AGI: 0.9, WIL: 1.0, LUK: 0.7,
      hpBase: 130,
      weaponId: 'longSword', armorId: 'leatherArmor',
      taunts: [
        '⋯⋯', // 他不講話
        '⋯⋯', // 真的不講話
      ],
    },
    // 🆕 P2-7：招敵變友候選（凱里烏斯、諾克斯）— 也加進切磋池
    {
      npcId: 'vesnusCaelius', name: '凱里烏斯', title: '維努斯場・帥氣劍士',
      STR: 0.9, DEX: 1.1, CON: 0.8, AGI: 1.0, WIL: 0.9, LUK: 0.8,
      hpBase: 110,
      weaponId: 'shortSword', armorId: 'leatherArmor',
      taunts: [
        '⋯⋯（他看了你一眼、眼神平靜、沒有惡意。）',
        '⋯⋯來吧。我也想看看你練的是什麼。',
        '⋯⋯（他不說廢話、姿勢很穩。）',
      ],
    },
    {
      npcId: 'vesnusNox', name: '諾克斯', title: '維努斯場・鐵漢老兵',
      STR: 1.1, DEX: 0.7, CON: 1.2, AGI: 0.6, WIL: 0.9, LUK: 0.5,
      hpBase: 145,
      weaponId: 'warHammer', armorId: 'chainmail',
      taunts: [
        '⋯⋯老頭子上場、別客氣。',
        '⋯⋯（他喘了一聲、像是腰不太行。）',
        '⋯⋯打完讓我回去領薪水。如果蓋烏斯還記得欠我的話。',
      ],
    },
  ];

  function tryFriendlySparring(newDay) {
    if (!newDay || newDay < 12) return false;
    if (Flags.has(`spar_done_day_${newDay}`)) return false;
    if (typeof teammates === 'undefined') return false;

    const masterAff = teammates.getAffection('masterArtus');
    if (masterAff < 30) return false;

    // 上次切磋至少 7 天前
    const lastSpar = Flags.get('last_friendly_spar_day') || 0;
    if (newDay - lastSpar < 7) return false;

    // 10% 機率觸發
    if (Math.random() > 0.10) return false;

    Flags.set(`spar_done_day_${newDay}`, true);
    Flags.set('last_friendly_spar_day', newDay);

    _playFriendlySparring();
    return true;
  }

  function _playFriendlySparring() {
    const opp = FRIENDLY_SPAR_OPPONENTS[Math.floor(Math.random() * FRIENDLY_SPAR_OPPONENTS.length)];
    const taunt = opp.taunts[Math.floor(Math.random() * opp.taunts.length)];

    const introLines = [
      { text: '（侍從匆匆來通報。）' },
      { speaker: '侍從', text: '⋯⋯維努斯場派人來切磋。蓋烏斯老爺說「友誼賽、別動氣」。' },
      { text: '（你跟著侍從到訓練場中央。）' },
      { text: `（對面站著一個人——${opp.name}，${opp.title}。）` },
      { speaker: opp.name, text: taunt, color: '#aa7755' },
      { text: '（觀眾席稀稀落落、但有點氣氛。）' },
      { speaker: '阿圖斯', text: '⋯⋯非死戰。但不要丟我臉。' },
    ];

    const startBattle = () => {
      _log(`⚔【友鄰切磋】vs ${opp.name}（${opp.title}）`, '#aa7755', true);

      // 對手屬性依玩家當期動態調整（±3 浮動）
      const p = Stats.player;
      const pAvg = Math.round((p.STR + p.DEX + p.CON + p.AGI + p.WIL) / 5);
      const baseAttr = Math.max(15, pAvg + (Math.random() < 0.5 ? -2 : 2));   // ±2 浮動

      const oppCfg = {
        name: opp.name, title: opp.title,
        STR: Math.round(baseAttr * opp.STR),
        DEX: Math.round(baseAttr * opp.DEX),
        CON: Math.round(baseAttr * opp.CON),
        AGI: Math.round(baseAttr * opp.AGI),
        WIL: Math.round(baseAttr * opp.WIL),
        LUK: Math.round(baseAttr * opp.LUK),
        hpBase: opp.hpBase,
        weaponId: opp.weaponId, armorId: opp.armorId,
        ai: 'normal',
        fame: 8, fameReward: 8,
        sparring: true,   // 🆕 切磋模式 — 不顯示砍首面板
      };

      const onWin = () => {
        if (typeof Stats !== 'undefined') {
          Stats.modMoney(30);
          Stats.modFame(5);
        }
        if (typeof teammates !== 'undefined') {
          teammates.modAffection('masterArtus', 1);
          teammates.modAffection(opp.npcId, 2);   // 對手對你刮目相看
        }
        // 推 pride 軸（贏了切磋有點得意）
        if (typeof Moral !== 'undefined' && Moral.push) Moral.push('pride', 'positive');
        _log(`✦ 你贏了切磋。+30 銅幣、+5 名聲。${opp.name} 走前看了你一眼。`, '#88dd66', true);
        if (typeof DialogueModal !== 'undefined') {
          DialogueModal.play([
            { speaker: opp.name, text: '⋯⋯哼。今天算你運氣。', color: '#aa7755' },
            { text: '（他撣了撣袍子、轉身就走、沒回頭。）' },
            { speaker: '阿圖斯', text: '⋯⋯不錯。回去訓練。' },
          ]);
        }
        // 🆕 P2-7：招敵變友 — 若對手是候選 NPC、嘗試種下種子
        if (typeof RecruitEnemyQuest !== 'undefined' && RecruitEnemyQuest.trySeedFromSparring) {
          // 切磋對手目前是布魯圖/法烏斯/奎因圖斯（討厭鬼）— 暫無候選
          // 但留 hook 給未來擴充（如果切磋對手池加 Caelius/Nox）
          setTimeout(() => RecruitEnemyQuest.trySeedFromSparring(opp.npcId), 600);
        }
      };

      const onLose = () => {
        if (typeof Stats !== 'undefined') {
          Stats.modFame(-3);
          Stats.modVital('hp', -20);
          Stats.modVital('mood', -10);
        }
        _log(`✦ 你輸了切磋。-3 名聲、HP -20。${opp.name} 大笑。`, '#aa5050', true);
        if (typeof DialogueModal !== 'undefined') {
          DialogueModal.play([
            { speaker: opp.name, text: '哈、阿圖斯這寵物太弱了。', color: '#aa7755' },
            { text: '（他朝觀眾席揮手、走了。）' },
            { speaker: '阿圖斯', text: '⋯⋯（沒講話。但臉色很難看。）' },
          ]);
        }
      };

      if (typeof Battle !== 'undefined' && Battle.startFromConfig) {
        Battle.startFromConfig(oppCfg, onWin, onLose);
      } else {
        console.error('[CrossLudus] Battle.startFromConfig not available');
      }
    };

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(introLines, { onComplete: startBattle });
    } else {
      startBattle();
    }
  }

  // ═══════════════════════════════════════════════════
  // P2-4 雙主人合作場（Day 35、stub — Phase 2.5）
  // ═══════════════════════════════════════════════════
  function tryCooperationFight(newDay) {
    if (newDay !== 35) return false;
    if (Flags.has('coop_fight_d35_done')) return false;
    Flags.set('coop_fight_d35_done', true);
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play([
        { text: '（侍從匆匆來通報。）' },
        { speaker: '侍從', text: '⋯⋯今天阿圖斯跟蓋烏斯聯手派人打第三家。你要跟法烏斯組隊。' },
        { text: '（你跟著走到競技場、看到法烏斯已經在那等了。）' },
        { speaker: '法烏斯', text: '⋯⋯', color: '#888' },
        { text: '（他不講話、跟你站一起。）' },
        { text: '（——P2-4 完整 2v2 戰待後續實作。今天 stub 帶過：兩家聯手贏了。）' },
      ]);
    }
    if (typeof Stats !== 'undefined') {
      Stats.modFame(15);
      Stats.modMoney(50);
    }
    _log('✦ Day 35 雙主人合作場（stub）：贏了、+15 名聲 +50 銅幣。', '#88dd66', true);
    return true;
  }

  // ═══════════════════════════════════════════════════
  // P2-5 雙主人陰招場（Day 60、stub）
  // ═══════════════════════════════════════════════════
  function trySchemerFight(newDay) {
    if (newDay !== 60) return false;
    if (Flags.has('schemer_fight_d60_done')) return false;
    Flags.set('schemer_fight_d60_done', true);
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play([
        { text: '（賽前你聽到對手的劍聞起來不太對。）' },
        { text: '（你看到場邊的德基烏斯笑了一下。）' },
        { speaker: '德基烏斯', text: '⋯⋯祝你好運啊、阿圖斯這寵物。', color: '#aa7755' },
        { text: '（戰鬥中你發現對手武器塗了藥、招招要害。）' },
        { text: '（——這是蓋烏斯下的手。）' },
        { text: '（——P2-5 完整版待後續：DEBUFF + ChoiceModal 玩家可舉發 / 沉默 / 反陰）' },
        { text: '（暫時 stub：你撐贏了、知道是德基烏斯下的手。）' },
      ]);
    }
    if (typeof Stats !== 'undefined') Stats.modVital('hp', -25);
    if (typeof teammates !== 'undefined') teammates.modAffection('vesnusDecius', -20);
    Flags.set('decius_betrayal_witnessed', true);
    _log('✦ Day 60 雙主人陰招場（stub）：你被陰但贏了、HP -25。', '#aa7755', true);
    return true;
  }

  // ═══════════════════════════════════════════════════
  // P2-6 互換新兵（Day 50 + Day 80、stub）
  // ═══════════════════════════════════════════════════
  function tryCadetSwap(newDay) {
    if (newDay !== 50 && newDay !== 80) return false;
    const flag = `cadet_swap_d${newDay}_done`;
    if (Flags.has(flag)) return false;
    Flags.set(flag, true);
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play([
        { text: '（侍從來通報。）' },
        { speaker: '侍從', text: `⋯⋯主人吩咐、${newDay === 50 ? '今天' : '今天'}你要去維努斯場一週。蓋烏斯老爺借你「練手」。` },
        { text: '（你一週後回來。）' },
        { text: '（——P2-6 完整版待後續：UI 場景切換、見到蓋烏斯本人、知道對方訓練所內幕。）' },
        { text: '（暫時 stub：你帶回了一些八卦。對維努斯場了解 +1。）' },
      ]);
    }
    if (typeof teammates !== 'undefined') {
      teammates.modAffection('gaius', 5);   // 蓋烏斯短暫好感（演的）
      teammates.modAffection('vesnusCaelius', 10);  // 跟招敵候選混熟
      teammates.modAffection('vesnusNox', 10);
    }
    Flags.set(`cadet_swap_${newDay}_intel`, true);
    _log(`✦ Day ${newDay} 互換新兵（stub）：你回來了、對維努斯場 NPC 好感 +10。`, '#88dd66', true);
    return true;
  }

  // ═══════════════════════════════════════════════════
  // P2-* 公開宴會撕逼（Day 75、stub）
  // ═══════════════════════════════════════════════════
  function tryPublicBanquetBicker(newDay) {
    if (newDay !== 75) return false;
    if (Flags.has('public_banquet_d75_done')) return false;
    Flags.set('public_banquet_d75_done', true);
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play([
        { text: '（你被選為阿圖斯的隨從、出席公開宴會。）' },
        { text: '（阿圖斯跟蓋烏斯坐在主席台兩側。）' },
        { speaker: '蓋烏斯', text: '⋯⋯阿圖斯啊、聽說你最近運氣不錯。', color: '#aa7755' },
        { speaker: '阿圖斯', text: '⋯⋯比你前年那次「弔唁」運氣好。' },
        { text: '（場面瞬間冷。其他主人別過頭、假裝沒聽到。）' },
        { speaker: '蓋烏斯', text: '⋯⋯（他笑了。但眼神冷。）' },
        { text: '（你聽出來——這是他們 30 年的舊帳。）' },
        { text: '（——這條八卦你會記住。Phase 2 整合 § 6b.6 領主夜宴。）', color: '#d4af37' },
      ]);
    }
    Flags.set('public_banquet_witnessed', true);
    _log('✦ Day 75 公開宴會撕逼（stub）：你目擊兩主人 30 年舊帳的暗釘。', '#d4af37', true);
    return true;
  }

  // ═══════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════
  function init() {
    if (typeof DayCycle === 'undefined' || typeof DayCycle.onDayStart !== 'function') return;

    DayCycle.onDayStart('crossLudusEvents', (newDay) => {
      if (tryPublicBanquetBicker(newDay)) return;
      if (trySchemerFight(newDay)) return;
      if (tryCadetSwap(newDay)) return;
      if (tryCooperationFight(newDay)) return;
      if (tryFriendlySparring(newDay)) return;
    }, 50);
  }

  init();

  return {
    init,
    tryFriendlySparring,
    tryCooperationFight,
    trySchemerFight,
    tryCadetSwap,
    tryPublicBanquetBicker,
    // debug
    testSparring: () => _playFriendlySparring(),
  };
})();
