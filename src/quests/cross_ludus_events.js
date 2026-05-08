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
