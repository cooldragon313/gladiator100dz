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

  // 幕三：戰鬥（用 Stage.playEvent 模擬、不真做 2v2）
  function _coopAct3(choiceId) {
    const lines = (() => {
      if (choiceId === 'nodToFaus') {
        return [
          '號角響。',
          '法烏斯往左、你往右——你們**心照不宣**地分頭包夾。',
          '',
          '法烏斯的劍長而沉。對面拿大劍那個被他第一招逼退。',
          '你這邊——短斧那個衝過來、你後退一步、找他下盤。',
          '一招、兩招——他的腿露出來了。',
          '',
          '你劈下去。沙地一片紅。',
          '另一邊、法烏斯一劍刺穿大劍那個的胸口。',
          '',
          '兩個米羅斯戰士都倒了。場上靜了一秒、然後觀眾爆掌聲。',
        ];
      } else if (choiceId === 'silentSelf') {
        return [
          '號角響。',
          '法烏斯往前衝。你也往前衝——你們**沒配合、各打各的**。',
          '',
          '對面兩個米羅斯戰士反而被你們的「不配合」搞亂了——他們以為要分兵、結果發現你們各打各的。',
          '法烏斯硬碰硬、被大劍那個劃到肩。',
          '你跟短斧那個對到——你硬上、用力氣換力氣。',
          '',
          '最後你倒了短斧的、法烏斯也倒了大劍的。',
          '沒漂亮、但贏了。',
        ];
      } else {
        return [
          '號角響。',
          '你**慢了半拍**——剛才偷瞄陽台、視線還沒回來。',
          '對面短斧那個衝過來、你及時格擋、但慢了一個動作。',
          '',
          '法烏斯瞥了你一眼——那一眼有「跟不上」的意思。',
          '他自己快速解決大劍那個、然後過來補你這邊。',
          '',
          '兩個米羅斯戰士都倒了。',
          '但這場勝利、是法烏斯撐的。',
        ];
      }
    })();

    if (typeof Stage !== 'undefined' && Stage.playEvent) {
      Stage.playEvent({
        title: '雙主人合作場',
        icon: '⚔️',
        lines,
        color: '#cc6622',
        onComplete: () => _coopAct4_reward(choiceId),
      });
    } else {
      _coopAct4_reward(choiceId);
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
