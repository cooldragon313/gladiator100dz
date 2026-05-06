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
    _log('（蓋烏斯派法烏斯來、要跟你組隊打第三家。— P2-4 stub、後續實作完整版。）', '#888', false);
    return true;
  }

  // ═══════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════
  function init() {
    if (typeof DayCycle === 'undefined' || typeof DayCycle.onDayStart !== 'function') return;

    DayCycle.onDayStart('crossLudusEvents', (newDay) => {
      if (tryCooperationFight(newDay)) return;
      if (tryFriendlySparring(newDay)) return;
    }, 50);
  }

  init();

  return {
    init,
    tryFriendlySparring,
    tryCooperationFight,
    // debug
    testSparring: () => _playFriendlySparring(),
  };
})();
