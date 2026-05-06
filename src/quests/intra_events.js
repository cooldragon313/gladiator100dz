/**
 * intra_events.js — 訓練所內部事件（P3 系列）
 *
 * 設計：[docs/quests/arena-events-roster.md § 3](../../docs/quests/arena-events-roster.md)
 *
 * 7 種場內事件:
 *   - P3-3 抬屍體 + 清房間（流動率附帶、本輪實作）
 *   - P3-4 偷竊（自己解決、stub 後續）
 *   - P3-5 派系選邊戰（赫克特派 vs 卡西烏斯派、本輪實作）
 *   - P3-6 狄圖斯伏筆 NPC（隨機新人、本輪實作）
 *   - P3-7 欺負新人 / 群毆 / 老默喝醉 / 廚房短缺（後續）
 *
 * 觸發：DayCycle.onDayStart（priority 55、跨訓練所事件之後）
 */
const IntraEvents = (() => {

  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    }
  }

  // ═══════════════════════════════════════════════════
  // P3-5 派系選邊戰（核心事件）
  // ═══════════════════════════════════════════════════
  // 赫克特派（陰招） vs 卡西烏斯派（傳統）
  // Day 30+ 觸發第一次、玩家選邊 → 同邊好感 +30 / 對立邊 -30
  // ═══════════════════════════════════════════════════
  function tryFactionFirstChoice(newDay) {
    if (newDay < 30) return false;
    if (Flags.has('faction_first_chosen')) return false;
    if (typeof teammates === 'undefined') return false;

    // 觸發：8% 機率 / 天、Day 30 後
    if (Math.random() > 0.08) return false;
    Flags.set('faction_first_chosen', 'pending');

    _playFactionFirstScene();
    return true;
  }

  function _playFactionFirstScene() {
    const introLines = [
      { text: '（午後訓練。陽光斜了。）' },
      { text: '（赫克特跟卡西烏斯在訓練場中央起爭執。）' },
      { speaker: '赫克特', text: '⋯⋯戰場不講規矩。能贏就行。' },
      { speaker: '卡西烏斯', text: '⋯⋯你那叫陰招、不叫戰術。' },
      { speaker: '赫克特', text: '陰招死人少。你那套會讓人死。' },
      { speaker: '卡西烏斯', text: '⋯⋯角鬥士也有尊嚴。' },
      { text: '（兩人對視。其他人停下動作看。）' },
      { speaker: '赫克特', text: '⋯⋯小子（指你）、你說呢？' },
      { text: '（場面瞬間安靜。）' },
    ];

    const showChoice = () => {
      if (typeof ChoiceModal === 'undefined') {
        _resolveFactionChoice('neutral');
        return;
      }
      ChoiceModal.show({
        id: 'faction_first_choice',
        icon: '⚖',
        title: '你選哪邊？',
        body: '赫克特跟卡西烏斯都在等你開口。這是場內第一次明顯選邊。',
        forced: true,
        choices: [
          { id: 'hector',   label: '⋯⋯赫克特說的對。能贏就行。',     hint: '加入陰招派、好感 +30 / 卡西烏斯派 -30' },
          { id: 'cassius',  label: '⋯⋯卡西烏斯說的對。我們有尊嚴。', hint: '加入傳統派、好感 +30 / 赫克特派 -30' },
          { id: 'neutral',  label: '⋯⋯我兩邊都覺得有道理。',          hint: '不選邊、兩邊都微微 -3' },
        ],
      }, {
        onChoose: (choiceId) => _resolveFactionChoice(choiceId),
      });
    };

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(introLines, { onComplete: showChoice });
    } else {
      showChoice();
    }
  }

  function _resolveFactionChoice(side) {
    Flags.set('faction_first_chosen', side);

    if (side === 'hector') {
      Flags.set('faction_aligned_hector', true);
      teammates.modAffection('hector', 30);
      teammates.modAffection('cassius', -30);
      // 推 pride 軸 + reliability 反向
      if (typeof Moral !== 'undefined' && Moral.push) {
        Moral.push('pride', 'negative');   // prideful（不擇手段）
      }
      const lines = [
        { text: '（赫克特笑了。）' },
        { speaker: '赫克特', text: '⋯⋯不錯。你懂。', color: '#aa7755' },
        { text: '（卡西烏斯瞪了你一眼、轉身走了。）' },
        { speaker: '卡西烏斯', text: '⋯⋯希望你不會後悔。', color: '#666' },
      ];
      if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
      _log('✦ 你選了赫克特派。赫克特好感 +30 / 卡西烏斯 -30', '#aa7755', true);

    } else if (side === 'cassius') {
      Flags.set('faction_aligned_cassius', true);
      teammates.modAffection('cassius', 30);
      teammates.modAffection('hector', -30);
      // 推 mercy 軸（傳統派看重榮譽 / 仁義）
      if (typeof Moral !== 'undefined' && Moral.push) {
        Moral.push('mercy', 'positive');
      }
      const lines = [
        { text: '（卡西烏斯點點頭、眼神柔和了一些。）' },
        { speaker: '卡西烏斯', text: '⋯⋯記住這話。', color: '#88aa66' },
        { text: '（赫克特冷哼一聲、轉身走了。）' },
        { speaker: '赫克特', text: '⋯⋯天真鬼。看你能撐到第幾天。', color: '#666' },
      ];
      if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
      _log('✦ 你選了卡西烏斯派。卡西烏斯好感 +30 / 赫克特 -30', '#88aa66', true);

    } else {
      teammates.modAffection('hector', -3);
      teammates.modAffection('cassius', -3);
      const lines = [
        { speaker: '赫克特', text: '⋯⋯哼、騎牆派。', color: '#aa7755' },
        { speaker: '卡西烏斯', text: '⋯⋯你早晚要選。', color: '#88aa66' },
        { text: '（兩人都沒滿意。）' },
      ];
      if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
      _log('✦ 你不選邊。兩邊都微微不爽（-3 / -3）。', '#888', true);
    }
  }

  // ═══════════════════════════════════════════════════
  // P3-6 狄圖斯伏筆 NPC
  // ═══════════════════════════════════════════════════
  // 隨機 Day 25-80 出場一次、給玩家寶藏線索
  // 早出（≤50）→ 完整故事 + 大獎勵
  // 晚出（≥70）→ 故事走不完、可能他先死
  // ═══════════════════════════════════════════════════
  function tryDetiusArrive(newDay) {
    if (Flags.has('detius_arrived')) return false;
    if (newDay < 25 || newDay > 80) return false;
    // 5% 機率 / 天、Day 25-80 之間預期某天會出
    if (Math.random() > 0.05) return false;
    Flags.set('detius_arrived', true);
    Flags.set('detius_arrived_day', newDay);

    _playDetiusArrival(newDay);
    return true;
  }

  function _playDetiusArrival(newDay) {
    const earlyArrival = newDay <= 50;
    const lines = [
      { text: '（早晨。訓練場新來一批奴隸。）' },
      { text: '（你看見一個瘦小的男人、眼神警戒、不太敢看人。）' },
      { speaker: '監督官', text: '⋯⋯這個叫狄圖斯。從北邊來的。', color: '#aa7755' },
      { speaker: '監督官', text: '⋯⋯帶他熟悉一下。' },
      { text: '（他抬頭看你、欲言又止、又低下頭。）' },
    ];

    if (earlyArrival) {
      lines.push({ text: '（——你覺得他眼神不太一樣。）' });
      lines.push({ text: '（——他像是有話想說、但不敢講。）', color: '#d4af37' });
    } else {
      lines.push({ text: '（——他來得有點晚。）' });
      lines.push({ text: '（你不知道他能撐多久。）', color: '#888' });
    }

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => {
          if (typeof teammates !== 'undefined') {
            // 給狄圖斯一個基準好感（玩家對他）
            // 但 Detius NPC 還沒在 npc.js 註冊、後續加
          }
          _log(`✦ 新人狄圖斯到了（Day ${newDay}）。${earlyArrival ? '你還有時間了解他。' : '時間不多了。'}`, earlyArrival ? '#d4af37' : '#888', true);
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════
  // P3-3 抬屍體 + 清房間（流動率附帶事件）
  // ═══════════════════════════════════════════════════
  // 觸發：每 7-10 天、隨機某個背景 NPC「沒回來」、玩家被叫去處理
  // 玩家動作：扛屍體出去燒、清房間、可能撿到死者小物
  // 獎勵：mood -5、reliability +1（履行職責）、偶爾撿到 storyReveal 物
  // ═══════════════════════════════════════════════════
  function tryCorpseHauling(newDay) {
    if (newDay < 10) return false;
    const lastHaul = Flags.get('last_corpse_haul_day') || 0;
    if (newDay - lastHaul < 7) return false;
    // 8% 機率 / 天
    if (Math.random() > 0.08) return false;

    Flags.set('last_corpse_haul_day', newDay);
    _playCorpseHauling();
    return true;
  }

  // 隨機名字池（背景奴隸）
  const _DEAD_NAMES = ['雷帝克斯', '俄薩', '昆迪', '沃克', '瑟卡', '尼歐'];
  // 死法
  const _DEATH_CAUSES = [
    '昨天競技場上沒回來',
    '昨晚發燒、今早人已經涼了',
    '訓練時被踢中胸口、半夜咳血走了',
    '上禮拜被賣去外地、剛聽說那邊死了',
    '上吊。沒人發現他什麼時候做的',
  ];
  // 撿到的小物（隨機）
  const _LEFT_BEHIND = [
    '一根半斷的縫衣針',
    '一塊磨平了字的木牌',
    '一張寫了一半的字條（你看不懂、是某種方言）',
    '一把鐵製的小刀',
    '半個發霉的麵包',
    null, null, null,   // 70% 機率沒撿到
  ];

  function _playCorpseHauling() {
    const name  = _DEAD_NAMES[Math.floor(Math.random() * _DEAD_NAMES.length)];
    const cause = _DEATH_CAUSES[Math.floor(Math.random() * _DEATH_CAUSES.length)];
    const found = _LEFT_BEHIND[Math.floor(Math.random() * _LEFT_BEHIND.length)];

    const lines = [
      { text: '（早晨。監督官在訓練場門口攔住你。）' },
      { speaker: '監督官', text: `⋯⋯${name}、${cause}。`, color: '#888' },
      { speaker: '監督官', text: '⋯⋯抬出去燒了。順便清他房間、東西該丟丟、能用的拿出來。' },
      { text: `（你跟另一個奴隸走進 ${name} 的小房間。）` },
      { text: '（很小。一張床。一個破袋子。一把訓練劍。）' },
      { text: '（你抬腳。他比你想像的輕。）' },
      { text: '⋯⋯' },
    ];

    if (found) {
      lines.push({ text: `（你在床底下撿到——${found}。）`, color: '#d4af37' });
      lines.push({ text: '（你不知道他為什麼留著這個。）' });
      lines.push({ text: '（你猶豫一下、把它放進口袋。）' });
    } else {
      lines.push({ text: '（房間很乾淨。沒什麼好撿的。）' });
      lines.push({ text: '（——也許他早就把所有值錢的東西都用掉了。）' });
    }

    lines.push({ text: '（你把屍體抬到院子角落、跟其他幾具一起。）' });
    lines.push({ text: '（火點起來。煙是甜的、但你知道是肉味。）', color: '#888' });
    lines.push({ text: '（你站著看了一會、轉身回訓練場。）' });
    lines.push({ text: `（——${name}。你會記住這個名字幾天。然後忘記。）`, color: '#666' });
    lines.push({ text: '（——這就是這裡。）' });

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => {
          if (typeof Stats !== 'undefined') {
            Stats.modVital('mood', -5);
          }
          if (typeof Moral !== 'undefined' && Moral.push) {
            Moral.push('reliability', 'positive');   // 履行職責
          }
          _log(`✦ ${name} 走了。你把他抬出去燒了。心情 -5。`, '#888', true);
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════
  function init() {
    if (typeof DayCycle === 'undefined' || typeof DayCycle.onDayStart !== 'function') return;

    DayCycle.onDayStart('intraEvents', (newDay) => {
      // 由早到晚試
      if (tryFactionFirstChoice(newDay)) return;
      if (tryDetiusArrive(newDay))      return;
      if (tryCorpseHauling(newDay))     return;
    }, 55);
  }

  init();

  return {
    init,
    tryFactionFirstChoice,
    tryDetiusArrive,
    tryCorpseHauling,
    // debug
    testFaction:  () => _playFactionFirstScene(),
    testDetius:   (day) => _playDetiusArrival(day || 30),
    testCorpse:   () => _playCorpseHauling(),
  };
})();
