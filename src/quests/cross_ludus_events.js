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
  // P2-4 雙主人合作場（Day 35）— 2026-05-08 完整版
  // ═══════════════════════════════════════════════════
  // 4 幕結構：
  //   1. 侍從通報 + 走到競技場
  //   2. 戰前 — 兩主人客套 + ChoiceModal「跟法烏斯怎處」（3 選項影響獎勵）
  //   3. 戰鬥 — Stage.playEvent 模擬（不真做 2v2）+ 戰中對白
  //   4. 戰後 — 從 5 素材池抽 1 揭露兩主人 30 年舊帳一角 + 獎勵
  //
  // 跨主題：橫向張力（阿圖斯 + 蓋烏斯 30 年青梅竹馬+宿敵）
  // 對應 NPC：vesnusFaus（沉默冷血、最強執行者）
  // ═══════════════════════════════════════════════════

  // 5 個 30 年舊帳素材池（從 gaius.md / CANON.md）— 戰後玩家偷聽到一段
  const _OLD_GRUDGE_POOL = [
    {
      id: 'd35_grudge_livia',
      lines: [
        { speaker: '蓋烏斯', text: '⋯⋯倒是、聽說 Livia 最近常在後園走走？' },
        { speaker: '阿圖斯', text: '⋯⋯（他放下酒杯。）' },
        { speaker: '阿圖斯', text: '蓋烏斯。她的事不要再提。' },
        { text: '（你聽不太懂、但你聽得出阿圖斯的聲音冷了一度。）' },
      ],
    },
    {
      id: 'd35_grudge_horse',
      lines: [
        { speaker: '蓋烏斯', text: '⋯⋯那年的馬賽、你還記得？' },
        { speaker: '阿圖斯', text: '⋯⋯（沉默。）' },
        { speaker: '阿圖斯', text: '記得。我父親死那年。' },
        { speaker: '蓋烏斯', text: '⋯⋯哎、年紀大了、講起來都是傷。' },
        { text: '（蓋烏斯笑了。但笑沒到眼睛。）' },
      ],
    },
    {
      id: 'd35_grudge_neighbor',
      lines: [
        { speaker: '蓋烏斯', text: '⋯⋯倒是聽說、那位老朋友最近升了大臣。' },
        { speaker: '阿圖斯', text: '⋯⋯嗯。' },
        { speaker: '蓋烏斯', text: '當年我們聯手坑他那塊地、他到現在還記著。' },
        { speaker: '阿圖斯', text: '⋯⋯他記著、是好事。我們就還能用一次。' },
        { text: '（兩人對視一眼、像是談論天氣。）' },
      ],
    },
    {
      id: 'd35_grudge_funeral',
      lines: [
        { speaker: '蓋烏斯', text: '⋯⋯前幾年我去你府上弔唁、那塊地的事⋯⋯' },
        { speaker: '阿圖斯', text: '蓋烏斯。' },
        { speaker: '蓋烏斯', text: '（笑）哎好好、不提。' },
        { text: '（阿圖斯沒看他、繼續喝酒。）' },
      ],
    },
    {
      id: 'd35_grudge_petty',
      lines: [
        { speaker: '蓋烏斯', text: '⋯⋯這場贏得漂亮。' },
        { speaker: '阿圖斯', text: '⋯⋯你那個法烏斯、是個沒嘴的。' },
        { speaker: '蓋烏斯', text: '（笑）你那邊那個小子、倒是有戲。' },
        { text: '（這是兩人少數真正在「談論奴隸」的一刻。）' },
      ],
    },
  ];

  function tryCooperationFight(newDay) {
    if (newDay !== 35) return false;
    if (Flags.has('coop_fight_d35_done')) return false;
    Flags.set('coop_fight_d35_done', true);
    _coopAct1();
    return true;
  }

  // 幕一：侍從通報 + 走到競技場
  function _coopAct1() {
    if (typeof DialogueModal === 'undefined') {
      _coopAct4_reward('nodToFaus');   // fallback
      return;
    }
    DialogueModal.play([
      { text: '（清晨。侍從匆匆來通報。）' },
      { speaker: '侍從', text: '⋯⋯今天阿圖斯大人跟蓋烏斯老爺合作、要派人打外地來訪的米羅斯場。' },
      { speaker: '侍從', text: '主人指名你出戰、跟維努斯場的「法烏斯」組隊。' },
      { text: '（你還沒回神、就被推到競技場側門。）' },
      { text: '（沙地的熱氣已經升起來了。觀眾席半滿、城裡的人還在進場。）' },
      { text: '（你走出側門——看到那個男人。）' },
      { text: '（高、寬肩、武器拿得低。臉上沒表情。）' },
      { speaker: '法烏斯', text: '⋯⋯', color: '#888' },
      { text: '（他沒看你。沒打招呼。也沒走開。就站在那。）' },
      { text: '（你站到他旁邊三步遠的位置。等。）' },
    ], { onComplete: _coopAct2 });
  }

  // 幕二：戰前兩主人入場 + ChoiceModal
  function _coopAct2() {
    DialogueModal.play([
      { text: '（號角響。觀眾安靜下來。）' },
      { text: '（阿圖斯從南陽台走出來、慢慢坐下。）' },
      { text: '（蓋烏斯從北陽台走出來、舉起一杯酒、隔空敬阿圖斯。）' },
      { speaker: '蓋烏斯', text: '阿圖斯！這場合作、我等了半個月。', color: '#aa7755' },
      { speaker: '阿圖斯', text: '⋯⋯' },
      { text: '（阿圖斯點了下頭。沒舉杯。）' },
      { text: '（你看到阿圖斯的眼神——不冷、但也不熱。像在算一筆帳。）' },
      { text: '（沙地對面的門打開——米羅斯場的兩個戰士走出來。）' },
      { text: '（一個拿大劍、一個拿短斧。看起來打過幾年。）' },
    ], { onComplete: _coopChoice });
  }

  // 戰前抉擇：跟法烏斯怎處
  function _coopChoice() {
    if (typeof ChoiceModal === 'undefined') {
      _coopAct3('nodToFaus');
      return;
    }
    ChoiceModal.show({
      id: 'coop_d35_stance',
      icon: '⚔️',
      title: '法烏斯就在你身邊',
      body: '對面兩個米羅斯戰士在熱身。法烏斯沒看你。號角第二聲快響了。',
      forced: true,
      choices: [
        {
          id: 'nodToFaus',
          label: '跟法烏斯點頭示意',
          hint: '（合作就合作、不結盟就不結盟。）',
          effects: [
            { type: 'moral', axis: 'patience', side: 'positive' },
            { type: 'flag', key: 'coop_d35_nodded' },
          ],
          resultLog: '你對法烏斯點了下頭。他停頓半秒、回了一個極輕的點頭。',
          logColor: '#88aa66',
        },
        {
          id: 'silentSelf',
          label: '不講話、自顧自準備武器',
          hint: '（他不講話、那我也不講話。）',
          effects: [
            { type: 'moral', axis: 'pride', side: 'positive' },
          ],
          resultLog: '你低頭檢查武器。法烏斯也低頭檢查武器。兩人之間有三步、就像有一道牆。',
          logColor: '#888899',
        },
        {
          id: 'spyMaster',
          label: '偷瞄陽台兩個主人',
          hint: '（他們在玩什麼？）',
          effects: [
            { type: 'moral', axis: 'reliability', side: 'negative' },
            { type: 'flag', key: 'coop_d35_spied' },
          ],
          resultLog: '你抬頭——阿圖斯在算什麼、蓋烏斯在笑什麼。你看不出來。但你知道：這場戰鬥不只是戰鬥。',
          logColor: '#aa8855',
        },
      ],
    }, {
      onChoose: (choiceId) => _coopAct3(choiceId),
    });
  }

  // 幕三：戰鬥 — 🆕 2026-05-09 真做 2v2（player + 法烏斯 vs 兩米羅斯戰士）
  function _coopAct3(choiceId) {
    // 戰前最後敘述（依選擇略有不同）
    const introLines = (() => {
      if (choiceId === 'nodToFaus') {
        return [
          { text: '（號角響。）' },
          { text: '（法烏斯往左、你往右——你們心照不宣地分頭包夾。）' },
          { speaker: '法烏斯', text: '⋯⋯左邊那個交給我。', color: '#888' },
        ];
      } else if (choiceId === 'silentSelf') {
        return [
          { text: '（號角響。）' },
          { text: '（法烏斯往前衝。你也往前衝——沒配合、各打各的。）' },
          { text: '（對面兩個反而被你們的不配合搞亂了。）' },
        ];
      } else {
        return [
          { text: '（號角響。）' },
          { text: '（你慢了半拍——剛才偷瞄陽台、視線還沒回來。）' },
          { text: '（法烏斯瞥了你一眼——那一眼有「跟不上」的意思。）' },
        ];
      }
    })();

    const startBattle = () => {
      // 🆕 法烏斯（隊友）— 維努斯場的冷血執行者
      const fausCfg = {
        name: '法烏斯', title: '維努斯場・冷血執行者',
        STR: 38, DEX: 38, CON: 36, AGI: 36, WIL: 40, LUK: 12,
        hpBase: 130,
        weaponId: 'longSword', armorId: 'leatherArmor',
        ai: 'normal', fame: 8,
      };

      // 🆕 兩個米羅斯戰士（敵）— 大劍 + 短斧
      const enemy1 = {
        name: '米羅斯戰士・大劍', title: '訪場戰士',
        STR: 36, DEX: 28, CON: 35, AGI: 28, WIL: 30, LUK: 10,
        hpBase: 130,
        weaponId: 'longSword', armorId: 'chainmail',
        ai: 'normal', fame: 6,
      };
      const enemy2 = {
        name: '米羅斯戰士・短斧', title: '訪場戰士',
        STR: 32, DEX: 32, CON: 32, AGI: 38, WIL: 28, LUK: 12,
        hpBase: 110,
        weaponId: 'hammer', armorId: 'leatherArmor',
        ai: 'aggressive', fame: 6,
      };

      // 偷瞄路線：玩家戰前 HP -10%（慢了半拍的代價）
      if (choiceId === 'spyMaster' && typeof Stats !== 'undefined' && Stats.modVital) {
        const hpLoss = Math.round((Stats.player.hp || 100) * 0.10);
        Stats.modVital('hp', -hpLoss);
        _log(`✦ 你慢了半拍、HP -${hpLoss}（偷瞄陽台的代價）。`, '#aa7755', false);
      }

      const onWin = () => {
        // 法烏斯倒下也算贏（如果隊友死了用較弱的對白後續）
        Flags.set('coop_d35_battle_won', true);
        _coopAct4_reward(choiceId);
      };
      const onLose = () => {
        Flags.set('coop_d35_battle_lost', true);
        _coopApplyFailRewards(choiceId);
      };

      if (typeof Battle !== 'undefined' && Battle.startFromConfig) {
        Battle.startFromConfig({
          title: '雙主人合作場',
          fameReward: 25,
          enemies: [enemy1, enemy2],
          allies:  [fausCfg],
        }, onWin, onLose);
      } else {
        console.error('[CoopFight] Battle.startFromConfig not available');
        _coopAct4_reward(choiceId);
      }
    };

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(introLines, { onComplete: startBattle });
    } else {
      startBattle();
    }
  }

  // 失敗變體 — 戰敗的話、戰後對白較沉重、獎勵減半
  function _coopApplyFailRewards(choiceId) {
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play([
        { text: '（你倒在沙地上、視線模糊。）' },
        { text: '（觀眾安靜了——就一秒、然後米羅斯場那邊歡呼起來。）' },
        { text: '（陽台上、阿圖斯臉色很難看。）' },
        { speaker: '蓋烏斯', text: '⋯⋯阿圖斯啊、看來你訓練的不太夠。', color: '#aa7755' },
        { speaker: '阿圖斯', text: '⋯⋯', color: '#666' },
        { text: '（這場敗仗你吞了下去。）' },
      ], {
        onComplete: () => {
          if (typeof Stats !== 'undefined') {
            Stats.modFame(-15);
            Stats.modVital('mood', -20);
          }
          if (typeof teammates !== 'undefined' && teammates.modAffection) {
            teammates.modAffection('masterArtus', -5);
          }
          _log(`✦ 雙主人合作場戰敗。-15 名聲、阿圖斯好感 -5。`, '#aa5050', true);
        },
      });
    }
  }

  // 幕四：戰後 — 30 年舊帳揭露 + 獎勵
  function _coopAct4_reward(choiceId) {
    // 從 5 素材池抽一段
    const grudge = _OLD_GRUDGE_POOL[Math.floor(Math.random() * _OLD_GRUDGE_POOL.length)];

    const introLines = [
      { text: '（你跟法烏斯站在沙地中央、滿身是血。）' },
      { text: '（觀眾還在歡呼、但你的耳朵嗡嗡的、聽不清。）' },
      { text: '（陽台上、阿圖斯舉起酒杯、慢慢喝了一口。）' },
      { text: '（蓋烏斯也舉起酒杯、跟阿圖斯隔空敬。）' },
      { text: '（兩人對視。一秒。然後笑了——是「親兄弟」的笑。）' },
      { text: '（你聽到他們在陽台上、隔著風、講了一段話。）' },
      { text: '（你聽得不完整、只聽到——）' },
      { text: '———————————————————————', color: '#444' },
      ...grudge.lines,
      { text: '———————————————————————', color: '#444' },
      { text: '（你看了法烏斯一眼。他也聽到了。）' },
      { text: '（他沒講話、轉身往維努斯場的側門走。）' },
      { speaker: '法烏斯', text: '⋯⋯下次、別偷瞄主人。', color: '#888' },
      { text: '（——只有偷瞄那條的人會聽到這句。）' },
    ];

    // 偷瞄路線特別句
    const finalLines = (choiceId === 'spyMaster')
      ? introLines
      : introLines.filter(l => !l.text || !l.text.includes('別偷瞄主人'));

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(finalLines, { onComplete: () => _coopApplyRewards(choiceId, grudge.id) });
    } else {
      _coopApplyRewards(choiceId, grudge.id);
    }
  }

  function _coopApplyRewards(choiceId, grudgeId) {
    // 基本獎勵
    if (typeof Stats !== 'undefined') {
      Stats.modFame(25);
      if (Stats.modMoney) Stats.modMoney(80);
    }

    // 法烏斯好感分歧
    if (typeof teammates !== 'undefined' && teammates.modAffection) {
      if (choiceId === 'nodToFaus') {
        teammates.modAffection('vesnusFaus', 10);
      } else if (choiceId === 'silentSelf') {
        teammates.modAffection('vesnusFaus', 5);
      }
      // 偷瞄路線：0 / 法烏斯不爽
    }

    // 主人好感小漲（合作場立功）
    if (typeof teammates !== 'undefined' && teammates.modAffection) {
      teammates.modAffection('masterArtus', choiceId === 'spyMaster' ? 3 : 8);
    }

    // 玩家偷瞄到 30 年舊帳 → 設 storyReveal flag
    Flags.set('witnessed_30y_grudge_d35', true);
    Flags.set(`coop_d35_grudge_${grudgeId}`, true);

    // 偷瞄路線特別 flag（後續可用）
    if (choiceId === 'spyMaster') {
      Flags.set('coop_d35_spy_caught_by_faus', true);
    }

    // 戰鬥消耗（根據選擇）
    if (typeof Stats !== 'undefined') {
      if (choiceId === 'silentSelf') {
        Stats.modVital('hp', -10);   // 沒配合、有點傷
      } else if (choiceId === 'spyMaster') {
        Stats.modVital('hp', -15);   // 慢半拍、傷比較重
      }
      Stats.modVital('stamina', -20);
    }

    _log('✦ Day 35 雙主人合作場：贏了。+25 名聲 +80 銅幣。', '#88dd66', true);
    _log('（你聽到了一段不該聽到的對話。）', '#aa8855', false);
  }

  // ═══════════════════════════════════════════════════
  // P2-5 雙主人陰招場（Day 60）— 2026-05-08 完整版
  // ═══════════════════════════════════════════════════
  // 4 幕結構：
  //   1. 賽前 — 玩家發現對手武器塗毒（德基烏斯下的手）
  //   2. ChoiceModal「你怎處」3 選項：舉發 / 沉默上場 / 反陰
  //   3. 戰鬥 — 依選擇分流（戲劇敘述、不真做引擎）
  //   4. 戰後 — 揭露蓋烏斯陰招、設 flag、獎勵分歧
  //
  // 跨主題：橫向張力 — 蓋烏斯場暗中陰阿圖斯場（30 年競爭老套路）
  // 對應 NPC：vesnusDecius（滑頭、Day 60 主使者）
  // ═══════════════════════════════════════════════════

  function trySchemerFight(newDay) {
    if (newDay !== 60) return false;
    if (Flags.has('schemer_fight_d60_done')) return false;
    Flags.set('schemer_fight_d60_done', true);
    _schemerAct1();
    return true;
  }

  // 幕一：賽前發現陰招
  function _schemerAct1() {
    if (typeof DialogueModal === 'undefined') {
      _schemerApplyRewards('silent', 'd60_random');   // fallback
      return;
    }
    DialogueModal.play([
      { text: '（中午。你被叫進競技場。對手是隔壁訓練所的「鋼鐵」奧斯卡。）' },
      { text: '（你進備戰區、放下水袋、開始檢查武器。）' },
      { text: '（突然你聞到一股不對勁的氣味——酸的、像爛掉的果子摻金屬。）' },
      { text: '（你抬頭看備戰區另一頭——對手的武器。刀面有一層薄薄的暗色油漬。）' },
      { text: '（你瞇眼看清楚——刀刃外緣兩寸有刻意塗的東西。）' },
      { text: '（這不是普通的油。這是——毒。）' },
      { text: '（你環顧四周。場邊只有一個維努斯場的人在那看著你。）' },
      { speaker: '德基烏斯', text: '⋯⋯祝你好運啊、阿圖斯這寵物。', color: '#aa7755' },
      { text: '（他笑了一下。然後別過頭、繼續啃他的麵包。）' },
      { text: '（——是他下的手。）' },
      { text: '（你心臟猛跳。腦袋裡的選項在跑：）' },
      { text: '（舉發？被當沒證據。沉默？毒上身。或——你也來陰一手？）' },
    ], { onComplete: _schemerChoice });
  }

  // 幕二：3 選項
  function _schemerChoice() {
    if (typeof ChoiceModal === 'undefined') {
      _schemerAct3('silent');
      return;
    }
    ChoiceModal.show({
      id: 'scheme_d60_response',
      icon: '☠️',
      title: '對手的武器塗了毒',
      body: '你還有十分鐘上場。德基烏斯在場邊裝沒事。你怎麼處理？',
      forced: true,
      choices: [
        {
          id: 'report',
          label: '去找塔倫長官舉發',
          hint: '（沒證據、但這事該講。）',
          effects: [
            { type: 'moral', axis: 'reliability', side: 'positive' },
            { type: 'flag', key: 'scheme_d60_reported' },
          ],
          resultLog: '你跑去找塔倫。「⋯⋯老子去看看。」他臉色難看、但還是動身了。',
          logColor: '#88aa66',
        },
        {
          id: 'silent',
          label: '沉默上場、硬撐',
          hint: '（這場我自己撐。）',
          effects: [
            { type: 'moral', axis: 'patience', side: 'positive' },
            { type: 'flag', key: 'scheme_d60_silent' },
          ],
          resultLog: '你深呼吸、把毒這件事壓進腦底。準備上場。',
          logColor: '#888899',
        },
        {
          id: 'counter',
          label: '反陰——也在他武器上動手腳',
          hint: '（你陰我、我陰你。）',
          effects: [
            { type: 'moral', axis: 'reliability', side: 'negative' },
            { type: 'moral', axis: 'mercy',       side: 'negative' },
            { type: 'flag', key: 'scheme_d60_countered' },
          ],
          resultLog: '你趁對手沒看、用沙磨了他刀刃內側兩下、把刀變鈍一個段。你心臟跳得很快。',
          logColor: '#aa7755',
        },
      ],
    }, {
      onChoose: (choiceId) => _schemerAct3(choiceId),
    });
  }

  // 幕三：戰鬥（Stage.playEvent 模擬）
  function _schemerAct3(choiceId) {
    const lines = (() => {
      if (choiceId === 'report') {
        return [
          '塔倫去找了主辦的侍從。一陣討論。',
          '對手的武器被收走、換了一把場邊備用的。',
          '德基烏斯的臉色難看了一下、但他什麼都沒說。',
          '',
          '號角響。',
          '你跟「鋼鐵」奧斯卡正面打了一場。',
          '他的力氣大、但你的訓練在了。',
          '一招、兩招、三招——他的肩膀漏了。',
          '',
          '你劈下去。他倒在沙地上、舉起手。',
          '你停手、看向陽台。阿圖斯點了下頭。',
          '',
          '塔倫在場邊跟你交了一個眼神——是「做得好」的意思。',
        ];
      } else if (choiceId === 'silent') {
        return [
          '號角響。',
          '你上場。對手「鋼鐵」奧斯卡進攻。',
          '',
          '第三招——他的刀劃過你左臂。淺淺的、應該沒事。',
          '但兩秒後——你左臂麻了。',
          '心臟猛跳。視線開始模糊。',
          '',
          '（毒上身了。你比預期快。）',
          '',
          '你咬牙、把武器換到右手、低姿勢撐。',
          '他以為你倒、衝過來——你閃身、用右手一刀劈下去。',
          '他倒了。',
          '',
          '但你也撐不住、半跪在沙地上喘。',
          '觀眾爆掌聲——他們以為這是「英雄反敗為勝」。',
          '只有你知道你他媽差點死在塗毒的刀下。',
        ];
      } else {
        return [
          '號角響。',
          '對手「鋼鐵」奧斯卡衝過來、第一招——刀面崩了一片。',
          '（他的刀刃內側被你磨鈍了。他根本不知道。）',
          '',
          '他試著再揮——但出力的角度全錯。',
          '你輕鬆閃過、找他下盤、一刀劈倒。',
          '',
          '太順了。順得不像你的水準。',
          '阿圖斯陽台上的眼神變了一下——他不知道怎麼贏的。',
          '德基烏斯在場邊、突然站起來、走過來看刀。',
          '',
          '他看了刀、看了你。沒講話、走了。',
          '（他知道。但他不能講——講了等於承認他原本下了毒。）',
        ];
      }
    })();

    if (typeof Stage !== 'undefined' && Stage.playEvent) {
      Stage.playEvent({
        title: '雙主人陰招場',
        icon: '☠️',
        lines,
        color: choiceId === 'counter' ? '#aa6666' : '#cc6622',
        onComplete: () => _schemerAct4(choiceId),
      });
    } else {
      _schemerAct4(choiceId);
    }
  }

  // 幕四：戰後揭露 + 獎勵
  function _schemerAct4(choiceId) {
    const lines = [
      { text: '（你站在沙地中央、滿身汗。）' },
      { text: '（你抬頭——阿圖斯陽台上、蓋烏斯陽台上。）' },
      { text: '（蓋烏斯舉杯、一臉「親兄弟」的笑。）' },
      { speaker: '蓋烏斯', text: '⋯⋯阿圖斯！這小子撐住了！運氣不錯啊。', color: '#aa7755' },
      { speaker: '阿圖斯', text: '⋯⋯' },
      { text: '（阿圖斯沒回應。但他眼神冷了一度。）' },
      { text: '（——他知道。他知道蓋烏斯動了手腳。但他也知道、追究下去毀的是 30 年情義。）' },
      { text: '（蓋烏斯也知道阿圖斯知道。兩人都笑著、都裝沒事。）' },
      { text: '（——這就是兩家 30 年的方式。）' },
    ];

    // 各路線特殊收尾
    if (choiceId === 'report') {
      lines.push(
        { text: '（塔倫經過你身邊、低聲。）' },
        { speaker: '塔倫', text: '⋯⋯這次算你眼尖。下次別讓主人面子難看。', color: '#999999' },
        { text: '（——他的意思是：別再講出來。下次自己處理。）' },
      );
    } else if (choiceId === 'silent') {
      lines.push(
        { text: '（你回備戰區、體力幾乎掏空。老默已經在等。）' },
        { speaker: '老默', text: '⋯⋯誰下的手？', color: '#888' },
        { text: '（你抬眼看他。沒說。）' },
        { speaker: '老默', text: '⋯⋯算了。我去拿解毒的。', color: '#888' },
        { text: '（他知道——但他也不問了。）' },
      );
    } else {
      lines.push(
        { text: '（你回備戰區、心跳還沒平。）' },
        { text: '（你看著自己的手——剛才那把沙、磨在對手刀上的樣子。）' },
        { text: '（你想：第一次。下次會更快。）' },
        { text: '（——你不知道這算進步、還是墮落。）' },
      );
    }

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, { onComplete: () => _schemerApplyRewards(choiceId) });
    } else {
      _schemerApplyRewards(choiceId);
    }
  }

  function _schemerApplyRewards(choiceId) {
    // 共通 flag — 玩家確認蓋烏斯敵意
    Flags.set('decius_betrayal_witnessed', true);
    Flags.set(`scheme_d60_resolution_${choiceId}`, true);

    // 各路線獎勵分歧
    if (choiceId === 'report') {
      // 舉發：塔倫好感 + 主人好感 + 名聲、德基烏斯 -30
      if (typeof Stats !== 'undefined') {
        Stats.modFame(20);
        if (Stats.modMoney) Stats.modMoney(50);
      }
      if (typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection('officer',     5);
        teammates.modAffection('masterArtus', 5);
        teammates.modAffection('vesnusDecius', -30);
      }
      _log('✦ Day 60 陰招場（舉發）：贏了。+20 名聲 +50 銅幣。塔倫 / 主人好感漲、德基烏斯記恨。', '#88aa66', true);
    } else if (choiceId === 'silent') {
      // 沉默上場：撐贏、HP/stamina 大損、得「中毒」短期 ailment、名聲漲多
      if (typeof Stats !== 'undefined') {
        Stats.modFame(28);
        if (Stats.modMoney) Stats.modMoney(70);
        Stats.modVital('hp', -28);
        Stats.modVital('stamina', -35);
      }
      if (typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection('vesnusDecius', -20);
        teammates.modAffection('doctorMo',     5);   // 老默暗中尊重
      }
      // 中毒短期狀態（mood -5/天 持續 3 天）— 用 flag 模擬
      Flags.set('scheme_d60_poisoned_until_day', (Stats.player?.day || 60) + 3);
      _log('✦ Day 60 陰招場（沉默撐贏）：HP -28、stamina -35。+28 名聲 +70 銅幣。後 3 天會殘留毒（mood -5/天）。', '#aa7755', true);
    } else {
      // 反陰：贏、但隱藏 flag、德基烏斯察覺
      if (typeof Stats !== 'undefined') {
        Stats.modFame(18);
        if (Stats.modMoney) Stats.modMoney(45);
      }
      if (typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection('vesnusDecius', -10);   // 暗中察覺
      }
      // 隱藏 flag — 玩家走過陰招路線（後續事件可引用）
      Flags.set('player_played_dirty_d60', true);
      _log('✦ Day 60 陰招場（反陰）：贏了。+18 名聲 +45 銅幣。德基烏斯察覺、但他不能講。', '#aa6666', true);
    }
  }

  // ═══════════════════════════════════════════════════
  // P2-6 互換新兵（Day 50 + Day 80）— 2026-05-08 完整版
  // ═══════════════════════════════════════════════════
  // 兩天兩個方向：
  //   Day 50：玩家**被借去**維努斯場一週（5 幕、玩家視角體驗對面）
  //   Day 80：維努斯場**派人來**阿圖斯場（4 幕、玩家是接待方）
  //
  // 設計理由：
  //   橫向張力的「**親身接觸**」— 玩家在 Day 80 領主夜宴前
  //   要對「對面那訓練所」有立體印象（不只是名字、是真的見過裡面）
  //
  // 場景切換用敘事帶過（不真做 UI 切換、玩家還是阿圖斯場 UI 但對白構建情境）
  // ═══════════════════════════════════════════════════

  function tryCadetSwap(newDay) {
    if (newDay !== 50 && newDay !== 80) return false;
    const flag = `cadet_swap_d${newDay}_done`;
    if (Flags.has(flag)) return false;
    Flags.set(flag, true);

    if (newDay === 50) {
      _swapAct1_visit();   // 玩家去維努斯場
    } else {
      _swapAct1_host();    // 維努斯場派人來
    }
    return true;
  }

  // ═══════════════════════════════════════════════════
  // Day 50：玩家被借去維努斯場（5 幕）
  // ═══════════════════════════════════════════════════

  function _swapAct1_visit() {
    if (typeof DialogueModal === 'undefined') {
      _swapApplyVisitRewards('observer');
      return;
    }
    DialogueModal.play([
      { text: '（清晨。侍從來通知。）' },
      { speaker: '侍從', text: '⋯⋯主人吩咐、今天起你要去維努斯場一週。蓋烏斯老爺借你「練手」。' },
      { speaker: '侍從', text: '主人交代——「替我留意他們的訓練法」。其他不用講。' },
      { text: '（你點頭。侍從給了一個小布包——換洗衣服跟一些盤纏。）' },
      { text: '（——主人沒明說、但你聽得出來：這趟是去**偵察**、不只是練手。）' },
      { text: '（你跟著侍從走出阿圖斯場側門、轉過幾條街、來到一個比阿圖斯場大一倍的建築前。）' },
      { text: '（門口兩個守衛、佩劍、不像阿圖斯場的雜牌守衛、是制服統一的。）' },
      { text: '（——維努斯場到了。）' },
    ], { onComplete: _swapVisitAct2 });
  }

  function _swapVisitAct2() {
    DialogueModal.play([
      { text: '（你被帶進中庭。一進去你就傻了。）' },
      { text: '（**大理石地板**。中央有個噴泉。沙地用細白沙、不像阿圖斯場的混雜沙土。）' },
      { text: '（訓練場有教練站在一旁——進口教練、講話帶口音。）' },
      { text: '（鐵架上的武器——清一色精鐵以上、有幾把看起來是上品。）' },
      { text: '（——你心裡明白了：這就是為什麼維努斯場近 5 年大會冠軍幾乎全包。）' },
      { text: '（一個壯漢從訓練場走過來、滿身肌肉、肩上扛著大斧。）' },
      { speaker: '布魯圖', text: '⋯⋯阿圖斯場的小子？聽說我們蓋烏斯老爺借了你來練手？', color: '#aa7755' },
      { speaker: '布魯圖', text: '哈！垃圾場來的、別丟我們的臉。', color: '#aa7755' },
      { text: '（他大笑、走開。其他帥哥一起笑。）' },
      { text: '（你站在那、感覺被當成觀光景點看。）' },
      { text: '（這時——一個男人從上方階梯走下來。）' },
      { speaker: '蓋烏斯', text: '⋯⋯歡迎、孩子。阿圖斯把你借給我一週。', color: '#aa7755' },
      { speaker: '蓋烏斯', text: '我是蓋烏斯。這場上你想跟誰練都行。', color: '#aa7755' },
      { speaker: '蓋烏斯', text: '⋯⋯但記得、這裡的規矩跟阿圖斯場不一樣。' },
      { text: '（他笑。眼神冷。）' },
      { speaker: '蓋烏斯', text: '阿圖斯把你借過來、是因為他相信你。別讓他失望。', color: '#aa7755' },
      { text: '（——你聽得出來、這話有兩層意思。）' },
      { text: '（蓋烏斯轉身回階梯。布魯圖跟他下面的帥哥也散了。）' },
      { text: '（你站在中庭、要決定接下來一週怎麼過。）' },
    ], { onComplete: _swapVisitChoice });
  }

  function _swapVisitChoice() {
    if (typeof ChoiceModal === 'undefined') {
      _swapVisitAct4('observer');
      return;
    }
    ChoiceModal.show({
      id: 'cadet_swap_d50_approach',
      icon: '🏛️',
      title: '一週的時間。你要怎過？',
      body: '蓋烏斯說「跟誰練都行」、但你心裡清楚這場戲是阿圖斯派來偵察。',
      forced: true,
      choices: [
        {
          id: 'recruit_befriend',
          label: '混熟招敵候選（凱里烏斯 / 諾克斯）',
          hint: '（這兩個聽說對蓋烏斯不滿。）',
          effects: [
            { type: 'moral', axis: 'reliability', side: 'positive' },
            { type: 'flag', key: 'cadet_swap_d50_befriended_recruits' },
          ],
          resultLog: '你刻意找凱里烏斯跟諾克斯訓練。一週下來、兩人開始把你當「自己人」。',
          logColor: '#88aa66',
        },
        {
          id: 'spy_intel',
          label: '套情報（混 4 帥哥 + 偷聽蓋烏斯室）',
          hint: '（主人要的就是這個。）',
          effects: [
            { type: 'moral', axis: 'reliability', side: 'negative' },
            { type: 'flag', key: 'cadet_swap_d50_spied' },
          ],
          resultLog: '你裝親和混進 4 帥哥圈、偷聽到幾段蓋烏斯跟教練的對話。情報拿到了、但你也心虛。',
          logColor: '#aa8855',
        },
        {
          id: 'observer',
          label: '自己練不講話、純粹練功',
          hint: '（這場戲我不演。）',
          effects: [
            { type: 'moral', axis: 'patience', side: 'positive' },
            { type: 'flag', key: 'cadet_swap_d50_observer' },
          ],
          resultLog: '你選擇單純練功。教練的指導確實讓你進步——但 4 帥哥開始嫌你裝清高。',
          logColor: '#888899',
        },
      ],
    }, {
      onChoose: (choiceId) => _swapVisitAct4(choiceId),
    });
  }

  function _swapVisitAct4(choiceId) {
    let lines;
    if (choiceId === 'recruit_befriend') {
      lines = [
        '一週的訓練。',
        '',
        '你刻意湊到凱里烏斯——維努斯場的帥氣劍士。他話不多、但你看得出他壓抑著什麼。',
        '第三天他終於對你說了一句：',
        '凱里烏斯：「⋯⋯你那邊、能讀書嗎？」',
        '你說「有些人能」。他沉默了。',
        '',
        '諾克斯——一個鐵漢老兵。第五天他在喝酒時對你說：',
        '諾克斯：「⋯⋯蓋烏斯欠我兩年薪水了。」',
        '你沒講話。但他看著你的眼神不一樣了。',
        '',
        '一週結束。你帶著兩個人的情緒回阿圖斯場。',
      ];
    } else if (choiceId === 'spy_intel') {
      lines = [
        '一週的訓練。',
        '',
        '你混進 4 帥哥圈——布魯圖、德基烏斯、法烏斯、奎因圖斯。他們起初鄙視你、後來覺得你「不錯」。',
        '德基烏斯特別愛炫耀。第三天他喝酒時跟你說：',
        '德基烏斯：「我跟你講、上次阿圖斯場那場我搞過手腳⋯⋯」',
        '（他一下子止口。但太晚了。你記住了。）',
        '',
        '第五天你借送酒去蓋烏斯書房、聽到他對教練說：',
        '蓋烏斯：「⋯⋯阿圖斯這小子有天份。下次大會、安排個「意外」吧。」',
        '（你心臟猛跳。立刻退出書房。）',
        '',
        '一週結束。你帶著情報回阿圖斯場。但你心裡清楚——你也成了一個會搞陰招的人。',
      ];
    } else {
      lines = [
        '一週的訓練。',
        '',
        '你不講話、就練。維努斯場的進口教練實際上很厲害——他指出你出招的兩個壞習慣。',
        '你的劍法、那一週進步比阿圖斯場一個月還多。',
        '',
        '4 帥哥起初嫌你裝清高、後來懶得理你。',
        '蓋烏斯經過你身邊一次、說：「⋯⋯這小子有意思。阿圖斯沒看走眼。」',
        '',
        '你不知道這算誇獎、還是懷疑。',
        '一週結束。你帶著一些技術、回阿圖斯場。',
      ];
    }

    if (typeof Stage !== 'undefined' && Stage.playEvent) {
      Stage.playEvent({
        title: '在維努斯場的一週',
        icon: '🏛️',
        lines,
        color: '#aa9966',
        onComplete: () => _swapVisitAct5(choiceId),
      });
    } else {
      _swapVisitAct5(choiceId);
    }
  }

  function _swapVisitAct5(choiceId) {
    const lines = [
      { text: '（一週後。你回到阿圖斯場側門。）' },
      { text: '（你回宿舍、放下換洗衣服。一切像沒變、但又什麼都變了。）' },
      { text: '（侍從來通報——主人召見。）' },
      { text: '（你進到阿圖斯書房。他坐在椅子上、看你。）' },
      { speaker: '阿圖斯', text: '⋯⋯回來了。', color: '#aa9966' },
      { speaker: '阿圖斯', text: '說。', color: '#aa9966' },
      { text: '（你開口——但說什麼、取決於你這週怎過。）' },
    ];

    if (choiceId === 'recruit_befriend') {
      lines.push(
        { text: '（你說了凱里烏斯跟諾克斯的事。蓋烏斯怎對待他們、他們的不滿。）' },
        { speaker: '阿圖斯', text: '⋯⋯有意思。', color: '#aa9966' },
        { speaker: '阿圖斯', text: '記住這兩個名字。下次你需要他們的時候、知道怎麼開口。', color: '#aa9966' },
        { text: '（——他在鋪 P2-7 招敵變友的路。）' },
      );
    } else if (choiceId === 'spy_intel') {
      lines.push(
        { text: '（你把蓋烏斯的「意外」計畫跟德基烏斯的炫耀都報了。）' },
        { speaker: '阿圖斯', text: '⋯⋯你做得好。', color: '#aa9966' },
        { speaker: '阿圖斯', text: '蓋烏斯這混蛋、果然在搞鬼。', color: '#aa9966' },
        { text: '（他笑了。第一次你看到阿圖斯笑。）' },
        { speaker: '阿圖斯', text: '⋯⋯你今天表現不錯。回去休息。', color: '#aa9966' },
      );
    } else {
      lines.push(
        { text: '（你說「沒什麼特別、就練功」。）' },
        { speaker: '阿圖斯', text: '⋯⋯', color: '#aa9966' },
        { speaker: '阿圖斯', text: '你進步了。我看得出來。', color: '#aa9966' },
        { speaker: '阿圖斯', text: '⋯⋯但你也錯過機會。算了、回去吧。', color: '#aa9966' },
      );
    }

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, { onComplete: () => _swapApplyVisitRewards(choiceId) });
    } else {
      _swapApplyVisitRewards(choiceId);
    }
  }

  function _swapApplyVisitRewards(choiceId) {
    Flags.set('cadet_swap_50_intel', true);

    if (choiceId === 'recruit_befriend') {
      // 招敵候選好感大漲、鋪 P2-7
      if (typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection('vesnusCaelius', 20);
        teammates.modAffection('vesnusNox',     20);
        teammates.modAffection('gaius',         3);   // 蓋烏斯演的客套
      }
      if (typeof Stats !== 'undefined') {
        Stats.modFame(8);
        if (Stats.modMoney) Stats.modMoney(40);
      }
      Flags.set('recruit_groundwork_d50', true);   // P2-7 整合用
      _log('✦ Day 50 互換新兵（混招敵候選）：凱里烏斯/諾克斯 +20、+8 名聲 +40 銅幣。為招敵變友鋪路。', '#88aa66', true);
    } else if (choiceId === 'spy_intel') {
      // 主人 +15、拿到深層情報、但反派好感全 -
      if (typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection('masterArtus',  15);
        teammates.modAffection('vesnusDecius', -15);
        teammates.modAffection('gaius',        -10);   // 雖偷聽他不知、但玩家心理立場已變
      }
      if (typeof Stats !== 'undefined') {
        Stats.modFame(12);
        if (Stats.modMoney) Stats.modMoney(70);
      }
      Flags.set('player_knows_gaius_scheme', true);   // Day 60 陰招場可呼應
      Flags.set('decius_caught_bragging', true);
      _log('✦ Day 50 互換新兵（套情報）：主人 +15、+12 名聲 +70 銅幣。德基烏斯醜事入袋。', '#aa8855', true);
    } else {
      // 觀察者：屬性 +1（教練教的）、好感小漲、無情報
      if (typeof Stats !== 'undefined') {
        // 進口教練讓玩家屬性 +1（隨機）
        const attrPool = ['STR', 'DEX', 'AGI'];
        const picked = attrPool[Math.floor(Math.random() * attrPool.length)];
        Stats.modAttr(picked, 1);
        Stats.modFame(5);
        if (Stats.modMoney) Stats.modMoney(30);
        _log(`✦ Day 50 互換新兵（純練功）：${picked} +1（進口教練教的）、+5 名聲 +30 銅幣。`, '#888899', true);
      }
      if (typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection('gaius',        5);   // 蓋烏斯欣賞「不演的人」
        teammates.modAffection('masterArtus',  3);
      }
      Flags.set('vesnus_coach_taught_player', true);
    }
  }

  // ═══════════════════════════════════════════════════
  // Day 80：維努斯場派人來阿圖斯場（4 幕）
  // ═══════════════════════════════════════════════════

  function _swapAct1_host() {
    // 來訪者：依 Day 50 玩家的選擇分流
    //   - 若混過招敵候選 → 凱里烏斯來（已有交情、可鋪 P2-7）
    //   - 若套情報 → 德基烏斯來（敵意 + 試探）
    //   - 若純練功 → 隨機抽（蓋烏斯不在乎派誰）
    let visitor, visitorName;
    if (Flags.has('cadet_swap_d50_befriended_recruits')) {
      visitor = 'vesnusCaelius'; visitorName = '凱里烏斯';
    } else if (Flags.has('cadet_swap_d50_spied')) {
      visitor = 'vesnusDecius'; visitorName = '德基烏斯';
    } else {
      // 從 4 帥哥隨機抽
      const pool = [
        { id: 'vesnusBrutus',   name: '布魯圖' },
        { id: 'vesnusQuinctus', name: '奎因圖斯' },
        { id: 'vesnusFaus',     name: '法烏斯' },
      ];
      const picked = pool[Math.floor(Math.random() * pool.length)];
      visitor = picked.id; visitorName = picked.name;
    }

    Flags.set('cadet_swap_d80_visitor', visitor);

    if (typeof DialogueModal === 'undefined') {
      _swapHostApplyRewards('cordial', visitor, visitorName);
      return;
    }
    DialogueModal.play([
      { text: '（清晨。侍從來通報。）' },
      { speaker: '侍從', text: `⋯⋯主人吩咐、今天起蓋烏斯老爺派一個小子過來練手一週。${visitorName}。` },
      { speaker: '侍從', text: '主人說——你陪他訓練、別出事。' },
      { text: '（——上次你去他們場、這次他們派人來。30 年的兩家都這樣玩。）' },
      { text: '（你走到訓練場側門、看到他已經到了。）' },
    ], { onComplete: () => _swapHostAct2(visitor, visitorName) });
  }

  function _swapHostAct2(visitor, visitorName) {
    let firstLines;

    if (visitor === 'vesnusCaelius') {
      // 凱里烏斯：友善、之前混過、現在再續前緣
      firstLines = [
        { text: '（你看到凱里烏斯站在側門邊。他朝你點了點頭。）' },
        { speaker: '凱里烏斯', text: '⋯⋯沒想到我們這麼快又見面。', color: '#88aa66' },
        { speaker: '凱里烏斯', text: '蓋烏斯臨時派我來。我也不知道為什麼。' },
        { speaker: '凱里烏斯', text: '⋯⋯但能換個地方一週、我倒是樂意。' },
        { text: '（你看出他眼神有東西——他想跟你聊更多、但場合不對。）' },
      ];
    } else if (visitor === 'vesnusDecius') {
      // 德基烏斯：敵意、來探玩家是不是聽到他炫耀
      firstLines = [
        { text: '（你看到德基烏斯靠在牆邊、嗑瓜子。）' },
        { speaker: '德基烏斯', text: '⋯⋯哎喲、阿圖斯這寵物。', color: '#aa7755' },
        { speaker: '德基烏斯', text: '上次你來我家、我招待得不錯吧？' },
        { speaker: '德基烏斯', text: '⋯⋯記得我說過什麼嗎？', color: '#aa7755' },
        { text: '（——他在試探。他知道自己上次喝醉時說太多。）' },
      ];
    } else {
      // 4 帥哥隨機：純鄙視、不熟、來練手
      firstLines = [
        { text: `（你看到 ${visitorName} 站在訓練場、繞著沙地走。）` },
        { speaker: visitorName, text: '⋯⋯這場地比我們小一倍。', color: '#aa7755' },
        { speaker: visitorName, text: '空氣也悶。一週啊、撐撐看吧。' },
        { text: '（——他鄙視這裡。）' },
      ];
    }

    DialogueModal.play(firstLines, { onComplete: () => _swapHostChoice(visitor, visitorName) });
  }

  function _swapHostChoice(visitor, visitorName) {
    if (typeof ChoiceModal === 'undefined') {
      _swapHostApplyRewards('cordial', visitor, visitorName);
      return;
    }

    const intro = (visitor === 'vesnusCaelius')
      ? '凱里烏斯來了。一週。你想怎處？'
      : (visitor === 'vesnusDecius')
        ? '德基烏斯在試探你聽到什麼。一週的接待、你怎處？'
        : `${visitorName} 來了。鄙視這裡、但要待一週。`;

    ChoiceModal.show({
      id: 'cadet_swap_d80_host',
      icon: '🤝',
      title: '客人來了。一週的時間',
      body: intro,
      forced: true,
      choices: [
        {
          id: 'cordial',
          label: '熱情接待、跟對方混熟',
          hint: '（不管對方是誰、先把人情做出來。）',
          effects: [
            { type: 'moral', axis: 'patience',     side: 'positive' },
            { type: 'flag',  key: 'cadet_swap_d80_cordial' },
          ],
          resultLog: `你帶 ${visitorName} 走訓練場、介紹環境、找好位置給他練。`,
          logColor: '#88aa66',
        },
        {
          id: 'pump_intel',
          label: '套情報（旁敲側擊問維努斯場內幕）',
          hint: '（人都來了、不問可惜。）',
          effects: [
            { type: 'moral', axis: 'reliability', side: 'negative' },
            { type: 'flag',  key: 'cadet_swap_d80_pumped_intel' },
          ],
          resultLog: `你藉著訓練間歇、套了幾句 ${visitorName} 維努斯場的近況。`,
          logColor: '#aa8855',
        },
        {
          id: 'cold',
          label: '冷淡相待、就讓他在這待一週',
          hint: '（不必演戲。）',
          effects: [
            { type: 'moral', axis: 'pride', side: 'positive' },
            { type: 'flag',  key: 'cadet_swap_d80_cold' },
          ],
          resultLog: `你不主動、${visitorName} 也不勉強。一週默默過。`,
          logColor: '#888899',
        },
      ],
    }, {
      onChoose: (choiceId) => _swapHostAct4(choiceId, visitor, visitorName),
    });
  }

  function _swapHostAct4(choiceId, visitor, visitorName) {
    let lines = [];

    // 依「來訪者 × 玩家選擇」9 種組合的精簡分流
    if (visitor === 'vesnusCaelius' && choiceId === 'cordial') {
      lines = [
        '一週的訓練。',
        '',
        `凱里烏斯這週跟你練得勤。第四天他在沙地坐下、低聲對你說：`,
        `凱里烏斯：「⋯⋯阿圖斯場、確實比我們場有人味。」`,
        `他停了一下：「⋯⋯下次大會、如果有機會、我可能會跟你站同一邊。」`,
        '',
        '你心裡明白——他在暗示。P2-7 招敵變友的種子發芽了。',
      ];
    } else if (visitor === 'vesnusDecius' && choiceId === 'pump_intel') {
      lines = [
        '一週的訓練。',
        '',
        '你刻意跟德基烏斯近一點。他知道你在套——但他也想試你聽到什麼。',
        '第六天兩人喝酒、他說了一句：',
        '德基烏斯：「⋯⋯老子上次喝多了。你聽到的、就當沒聽到、明白？」',
        '',
        '你笑著點頭。但心裡知道——這把柄你會記住。',
      ];
    } else if (visitor === 'vesnusDecius' && choiceId === 'cold') {
      lines = [
        '一週的訓練。',
        '',
        '你不理他、他也不理你。但你能感覺到他的眼神——他在觀察你的反應。',
        '第七天臨走前他經過你身邊：',
        `德基烏斯：「⋯⋯你這小子、心思深啊。」`,
        '',
        '——他確認你聽到了。但你也沒承認。雙方都拿到底牌、誰也不敢翻。',
      ];
    } else if (choiceId === 'cordial') {
      lines = [
        '一週的訓練。',
        '',
        `${visitorName} 起初不爽、後來慢慢放鬆。他開始發現阿圖斯場雖然窮、但人情比較真。`,
        '一週結束、他臨走前對你點頭：',
        `${visitorName}：「⋯⋯下次有機會、回敬。」`,
        '',
        '不知道他下次回敬會是什麼。但這個人不會像之前那麼鄙視你了。',
      ];
    } else if (choiceId === 'pump_intel') {
      lines = [
        '一週的訓練。',
        '',
        `你旁敲側擊問了 ${visitorName} 幾段維努斯場近況。他講得不深、但有講就是情報。`,
        '主要拿到：蓋烏斯最近資金緊、進口教練的合約快到期。',
        '',
        '這條情報、可以給阿圖斯討好。',
      ];
    } else {
      lines = [
        '一週的訓練。',
        '',
        `你跟 ${visitorName} 各練各的。他鄙視你、你也不演。`,
        '一週很快過去。臨走前他經過你身邊：',
        `${visitorName}：「⋯⋯哼。」`,
        '',
        '沒戲、但也沒結仇。最少消耗的一週。',
      ];
    }

    if (typeof Stage !== 'undefined' && Stage.playEvent) {
      Stage.playEvent({
        title: `客人來了：${visitorName}`,
        icon: '🤝',
        lines,
        color: '#aa9966',
        onComplete: () => _swapHostApplyRewards(choiceId, visitor, visitorName),
      });
    } else {
      _swapHostApplyRewards(choiceId, visitor, visitorName);
    }
  }

  function _swapHostApplyRewards(choiceId, visitor, visitorName) {
    Flags.set('cadet_swap_80_intel', true);

    if (choiceId === 'cordial') {
      // 友善：對方好感 +20、自身名聲 +10
      if (typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection(visitor, 20);
      }
      if (typeof Stats !== 'undefined') {
        Stats.modFame(10);
        if (Stats.modMoney) Stats.modMoney(50);
      }
      // 凱里烏斯特別 → P2-7 招敵變友 +1 段鋪墊
      if (visitor === 'vesnusCaelius') {
        Flags.set('caelius_open_to_recruit', true);
        _log(`✦ Day 80 互換（友善：${visitorName}）：對方 +20、+10 名聲 +50 銅幣。凱里烏斯心動了。`, '#88aa66', true);
      } else {
        _log(`✦ Day 80 互換（友善：${visitorName}）：對方 +20、+10 名聲 +50 銅幣。`, '#88aa66', true);
      }
    } else if (choiceId === 'pump_intel') {
      // 套情報：主人 +10、拿維努斯場近況情報
      if (typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection('masterArtus', 10);
        teammates.modAffection(visitor, -5);
      }
      if (typeof Stats !== 'undefined') {
        Stats.modFame(8);
        if (Stats.modMoney) Stats.modMoney(60);
      }
      Flags.set('player_knows_vesnus_finance_d80', true);   // 維努斯場資金緊情報
      // 德基烏斯特別 → 雙方互拿底牌、後續事件可呼應
      if (visitor === 'vesnusDecius') {
        Flags.set('decius_mutual_blackmail', true);
      }
      _log(`✦ Day 80 互換（套情報：${visitorName}）：主人 +10、+8 名聲 +60 銅幣。維努斯場財務情報入袋。`, '#aa8855', true);
    } else {
      // 冷淡：對方無感、阿圖斯小爽（不引人注意）
      if (typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection('masterArtus', 3);
      }
      if (typeof Stats !== 'undefined') {
        Stats.modFame(5);
        if (Stats.modMoney) Stats.modMoney(30);
      }
      _log(`✦ Day 80 互換（冷淡：${visitorName}）：主人 +3、+5 名聲 +30 銅幣。最少消耗。`, '#888899', true);
    }
  }

  // ═══════════════════════════════════════════════════
  // P2-* 公開宴會撕逼（Day 75）— 2026-05-08 完整版
  // ═══════════════════════════════════════════════════
  // 5 幕結構（社交事件、非戰鬥）：
  //   1. 侍從通知 + 阿圖斯指示（隨從規矩）
  //   2. 抵達宴會 + 環境 + 主人們在場
  //   3. 兩主人席上互嗆（多段素材池揭露）
  //   4. ChoiceModal「玩家怎處」3 選項（湊熱鬧 / 偷聽 / 退角落）
  //   5. 結局分流 + 阿圖斯回程一句 + 獎勵
  //
  // 跨主題：間諜時刻、玩家是「隱形觀察者」、不戰鬥
  // 跟 P2-4 / Day 80 領主夜宴互相呼應同一素材池系統
  // ═══════════════════════════════════════════════════

  function tryPublicBanquetBicker(newDay) {
    if (newDay !== 75) return false;
    if (Flags.has('public_banquet_d75_done')) return false;
    Flags.set('public_banquet_d75_done', true);
    _banquetAct1();
    return true;
  }

  // 幕一：侍從通知 + 阿圖斯指示
  function _banquetAct1() {
    if (typeof DialogueModal === 'undefined') {
      _banquetApplyRewards('corner');
      return;
    }
    DialogueModal.play([
      { text: '（清晨。侍從來通知。）' },
      { speaker: '侍從', text: '⋯⋯今晚主人辦公開宴會、邀全城貴族跟訓練所主人。主人指名你當隨從。' },
      { speaker: '侍從', text: '記住三條：倒酒站主人左後方、別說話、別跟其他主人對眼。' },
      { text: '（你點頭。侍從走了。）' },
      { text: '（你心裡有底——這不是普通宴會。是阿圖斯在「讓人看到」他訓練的人。）' },
      { text: '（傍晚。侍從拿了一套乾淨衣服給你。粗布、但乾淨。）' },
      { text: '（你換上、跟侍從走過大宅長廊、進到後園的宴會廳。）' },
    ], { onComplete: _banquetAct2 });
  }

  // 幕二：抵達宴會 + 環境 + 主人們入場
  function _banquetAct2() {
    DialogueModal.play([
      { text: '（宴會廳。）' },
      { text: '（你從沒見過這種場面——大理石地板、銀燭台、長桌上烤全羊跟葡萄堆成山。）' },
      { text: '（阿圖斯坐主席之一、蓋烏斯坐另一席、中間隔了三個其他主人。）' },
      { text: '（你站到阿圖斯左後方、酒壺握緊。心跳聲在耳朵裡。）' },
      { text: '（——你嗅到一股奇怪的氣味。是那種「太多人裝著親切」的氣味。）' },
      { speaker: '主人甲（陌生）', text: '⋯⋯今年大會排名、阿圖斯場跟維努斯場兩家都得多。', color: '#999' },
      { speaker: '蓋烏斯', text: '哪裡哪裡、這幾年阿圖斯撐起一半半呢。', color: '#aa7755' },
      { speaker: '阿圖斯', text: '⋯⋯', color: '#aa9966' },
      { text: '（阿圖斯舉杯、淡淡點頭。沒說話。）' },
      { text: '（其他主人開始八卦、酒水流轉。你低著頭、倒酒。）' },
    ], { onComplete: _banquetAct3 });
  }

  // 幕三：兩主人多段互嗆（從素材池抽 2 段串起來）
  function _banquetAct3() {
    // 從 _OLD_GRUDGE_POOL 抽 2 段（不重複、避開太敏感的 funeral）
    const candidates = _OLD_GRUDGE_POOL.filter(g =>
      // 排除 P2-4 已抽過的（透過 flag 檢查）
      !Flags.has(`coop_d35_grudge_${g.id}`)
    );
    // 至少抽 2 段、優先 horse / neighbor / livia
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(2, shuffled.length));

    // 串起來（中間隔一段「冷場」描述）
    const lines = [
      { text: '（一個主人講了個笑話、其他人哄笑。氣氛鬆下。）' },
      { text: '（突然——蓋烏斯放下酒杯、轉向阿圖斯。）' },
    ];

    if (picked.length >= 1) {
      lines.push(...picked[0].lines);
      lines.push(
        { text: '（場面冷了一秒。一個主人別過頭、假裝在看牆上的畫。）' },
        { text: '（你倒酒的手停了一下、立刻接著倒。）' },
      );
    }

    if (picked.length >= 2) {
      lines.push(
        { text: '（過了一會、蓋烏斯又笑了起來、像剛才沒事一樣。）' },
        { text: '（但他舉起酒杯、又開了一槍。）' },
      );
      lines.push(...picked[1].lines);
      lines.push(
        { text: '（這次連阿圖斯都笑了。但笑得冷。）' },
      );
    }

    lines.push(
      { text: '（你看著兩個老人。）' },
      { text: '（30 年。每次見面就是這樣——表面親兄弟、底下用過去的傷口互相挖。）' },
      { text: '（其他主人都裝著看不見、但他們全部都聽見了。）' },
      { text: '（這是他們的「八卦」資產——下次跟對方喝酒時可以拿出來消遣的話題。）' },
    );

    DialogueModal.play(lines, { onComplete: () => _banquetChoice(picked) });
  }

  // 幕四：ChoiceModal「玩家怎處」
  function _banquetChoice(picked) {
    if (typeof ChoiceModal === 'undefined') {
      _banquetAct5('corner', picked);
      return;
    }
    ChoiceModal.show({
      id: 'banquet_d75_response',
      icon: '🍷',
      title: '你站在阿圖斯左後方',
      body: '酒壺空了。你需要去酒桶旁補。同時——你想怎麼處理這個機會？',
      forced: true,
      choices: [
        {
          id: 'show_loyalty',
          label: '湊到阿圖斯旁、配合他下一杯',
          hint: '（讓主人看到我可靠。）',
          effects: [
            { type: 'moral', axis: 'loyalty', side: 'positive' },
            { type: 'flag', key: 'banquet_d75_loyal' },
          ],
          resultLog: '你動作俐落、阿圖斯酒杯從沒空過。其他主人注意到了。',
          logColor: '#88aa66',
        },
        {
          id: 'eavesdrop',
          label: '裝忙、靠近主人們的桌子聽八卦',
          hint: '（這個我要聽完。）',
          effects: [
            { type: 'moral', axis: 'reliability', side: 'negative' },
            { type: 'flag', key: 'banquet_d75_eavesdropped' },
          ],
          resultLog: '你借著倒酒、湊到主桌邊、把每句話刻進腦袋。',
          logColor: '#aa8855',
        },
        {
          id: 'corner',
          label: '退到角落、不參與',
          hint: '（這場戲跟我沒關係。）',
          effects: [
            { type: 'moral', axis: 'patience', side: 'positive' },
            { type: 'flag', key: 'banquet_d75_corner' },
          ],
          resultLog: '你補滿酒壺、退到角落柱子旁。其他奴僕也站那。誰都沒看你。',
          logColor: '#888899',
        },
      ],
    }, {
      onChoose: (choiceId) => _banquetAct5(choiceId, picked),
    });
  }

  // 幕五：結局分流 + 阿圖斯回程一句
  function _banquetAct5(choiceId, picked) {
    const lines = [
      { text: '（夜深。宴會散了。其他主人陸續離開。）' },
      { text: '（你跟阿圖斯走過長廊、回阿圖斯場的路上。）' },
      { text: '（侍從在前、提燈籠。阿圖斯沒講話、走在你後面三步。）' },
    ];

    if (choiceId === 'show_loyalty') {
      lines.push(
        { text: '（走到一半、阿圖斯停下。）' },
        { speaker: '阿圖斯', text: '⋯⋯今晚不錯。', color: '#aa9966' },
        { speaker: '阿圖斯', text: '蓋烏斯多看了你三次。下次別讓他多看。', color: '#aa9966' },
        { text: '（——他在誇你、也在警告你。）' },
        { text: '（你低頭。阿圖斯繼續走。）' },
      );
    } else if (choiceId === 'eavesdrop') {
      lines.push(
        { text: '（阿圖斯走到大門前、停了下來。）' },
        { speaker: '阿圖斯', text: '⋯⋯你今晚靠太近。', color: '#aa9966' },
        { speaker: '阿圖斯', text: '記住：你聽到的不是你的。', color: '#aa9966' },
        { text: '（——他知道。）' },
        { speaker: '阿圖斯', text: '⋯⋯這次不追究。下次小心。', color: '#aa9966' },
        { text: '（他走進大門、沒回頭。）' },
      );
    } else {
      lines.push(
        { text: '（阿圖斯一路沒講話。到大門前才停了一下。）' },
        { speaker: '阿圖斯', text: '⋯⋯規矩、是你最大的資產。', color: '#aa9966' },
        { speaker: '阿圖斯', text: '今晚你做對了。', color: '#aa9966' },
        { text: '（一句、然後他走進大門。）' },
      );
    }

    lines.push(
      { text: '（你站在大門外、看著夜空。）' },
      { text: '（兩個老人 30 年的舊帳——你今晚看了個剖面。）' },
      { text: '（這座城市不只競技場。）' },
    );

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, { onComplete: () => _banquetApplyRewards(choiceId, picked) });
    } else {
      _banquetApplyRewards(choiceId, picked);
    }
  }

  function _banquetApplyRewards(choiceId, picked) {
    Flags.set('public_banquet_witnessed', true);

    // 標記抽到的素材（之後對白可引用）
    if (Array.isArray(picked)) {
      picked.forEach(g => Flags.set(`banquet_d75_grudge_${g.id}`, true));
    }

    // 路線分歧獎勵
    if (choiceId === 'show_loyalty') {
      if (typeof Stats !== 'undefined') {
        Stats.modFame(15);
        if (Stats.modMoney) Stats.modMoney(50);
      }
      if (typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection('masterArtus', 8);
      }
      _log('✦ Day 75 公開宴會（盡職隨從）：主人 +8、+15 名聲 +50 銅幣。', '#88aa66', true);
    } else if (choiceId === 'eavesdrop') {
      // 偷聽：主人小怒、但玩家拿到深層情報（隱藏 storyReveal）
      if (typeof Stats !== 'undefined') {
        Stats.modFame(8);
        if (Stats.modMoney) Stats.modMoney(30);
      }
      if (typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection('masterArtus', -3);
      }
      Flags.set('player_knows_30y_grudge_deep', true);   // 後續對白可引用
      _log('✦ Day 75 公開宴會（偷聽）：主人 -3、+8 名聲 +30 銅幣。但你拿到了珍貴情報。', '#aa8855', true);
    } else {
      if (typeof Stats !== 'undefined') {
        Stats.modFame(10);
        if (Stats.modMoney) Stats.modMoney(40);
      }
      if (typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection('masterArtus', 5);
      }
      _log('✦ Day 75 公開宴會（守規矩）：主人 +5、+10 名聲 +40 銅幣。', '#888899', true);
    }
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
