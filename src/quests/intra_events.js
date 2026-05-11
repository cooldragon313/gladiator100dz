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

  // 🆕 2026-05-08：NPC 是否在場（給死人事件用）
  function _isPresent(npcId) {
    if (typeof GameState === 'undefined' || !GameState.getCurrentNPCs) return false;
    const cur = GameState.getCurrentNPCs() || {};
    const list = [...(cur.teammates || []), ...(cur.audience || [])];
    return list.includes(npcId);
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

    // 🆕 2026-05-08：梅拉戲份 — 死的是她每天煮飯給的人、她該有反應
    //   60% 機率出（梅拉在場才出）
    if (_isPresent('melaKook') && Math.random() < 0.6) {
      lines.push({ text: '（你經過食堂、梅拉在切菜、沒抬頭。）' });
      lines.push({ text: `（你猶豫了一下、低聲報出名字——${name}。）` });
      // 1/3 機率：梅拉知道死者的小細節（更打人）
      const dice = Math.random();
      if (dice < 0.33) {
        lines.push({ speaker: '梅拉', text: '⋯⋯他喜歡吃硬的那種。', color: '#5a4a2a' });
        lines.push({ text: '（她繼續切菜。但你看到她手停了一下。）', color: '#888' });
      } else if (dice < 0.66) {
        lines.push({ speaker: '梅拉', text: '⋯⋯哦。', color: '#5a4a2a' });
        lines.push({ text: '（她沒抬頭。把多出來的那塊麵包放進你的碗。）' });
        lines.push({ text: '（——她也記得他叫什麼。）', color: '#888' });
      } else {
        lines.push({ speaker: '梅拉', text: '⋯⋯（她點了一下頭。沒講話。）', color: '#5a4a2a' });
        lines.push({ text: '（你從袋子裡聽到一聲悶悶的、像是嘆氣。）', color: '#888' });
      }
      // 內心 OS（user 要求）— 三選一、跟梅拉反應對應
      lines.push({ text: '⋯⋯', color: '#666' });
      lines.push({ text: '（這裡每張碗的飯、都是她煮的。）', color: '#aa9966' });
      lines.push({ text: '（每個死掉的人、生前最後一口熱的、也是她給的。）', color: '#aa9966' });
      lines.push({ text: '（——這座訓練所裡、只有她記得他們。）', color: '#aa9966' });
    }

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
  // ═══════════════════════════════════════════════════
  // 🆕 2026-05-09 P3-4 INTRA_THIEF 偷竊事件
  // ═══════════════════════════════════════════════════
  // 觸發：每 10-20 天、Day 15+、6% 機率 / 天
  // 玩家自己解決：4 條路（打架 / 算了 / 偷回更多 / 嫁禍別人）
  function tryThief(newDay) {
    if (newDay < 15) return false;
    const last = Flags.get('last_thief_day') || 0;
    if (newDay - last < 10) return false;
    if (Math.random() > 0.06) return false;

    Flags.set('last_thief_day', newDay);
    _playThief();
    return true;
  }

  const _THIEF_NAMES = ['昆迪', '俄薩', '雷帝克斯', '沃克', '尼歐', '瑟卡'];
  const _STOLEN_ITEMS = ['一袋零錢（30 銅幣）', '一個護身銅墜', '半條乾肉', '你磨好的小刀'];

  function _playThief() {
    const thief = _THIEF_NAMES[Math.floor(Math.random() * _THIEF_NAMES.length)];
    const item  = _STOLEN_ITEMS[Math.floor(Math.random() * _STOLEN_ITEMS.length)];

    const lines = [
      { text: '（你下訓回房間、伸手摸床底——東西不見了。）' },
      { text: `（——${item}。昨天還在的。）`, color: '#aa6666' },
      { text: '（你愣了三秒、開始翻整個房間。沒有。）' },
      { text: '（你出門、繞了一圈訓練場。）' },
      { text: `（你看到 ${thief} 在牆角擦汗——那條乾肉的味道、從他袋子裡飄出來。）` },
      { text: '（——是他。）' },
      { text: '（你心裡的火上來了。但腦子也在跑：怎麼處理。）' },
    ];

    if (typeof DialogueModal === 'undefined') {
      _thiefResolve('confront', thief, item);
      return;
    }
    DialogueModal.play(lines, {
      onComplete: () => {
        if (typeof ChoiceModal === 'undefined') { _thiefResolve('confront', thief, item); return; }
        ChoiceModal.show({
          id: 'intra_thief_' + thief,
          icon: '🗡',
          title: '誰偷了你的東西',
          body: `${thief} 在牆角。你怎麼辦？`,
          forced: true,
          choices: [
            {
              id: 'confront', label: '直接過去找他幹一架',
              hint: '（拿回東西、給人看。）',
              effects: [{ type: 'moral', axis: 'pride', side: 'positive' }],
              resultLog: `你走過去、揪起 ${thief} 的衣領。他臉色慘白。`,
              logColor: '#cc6644',
            },
            {
              id: 'letgo', label: '算了、當作丟了',
              hint: '（一條乾肉而已。）',
              effects: [{ type: 'moral', axis: 'patience', side: 'positive' }],
              resultLog: '你深呼吸、轉身離開。心裡有點堵、但不打。',
              logColor: '#888899',
            },
            {
              id: 'steal_back', label: '晚上偷回更多',
              hint: '（他偷我一個、我偷他兩個。）',
              effects: [
                { type: 'moral', axis: 'reliability', side: 'negative' },
                { type: 'moral', axis: 'mercy', side: 'negative' },
              ],
              resultLog: `半夜你溜進 ${thief} 的房、把他袋子翻了個底朝天。`,
              logColor: '#aa7755',
            },
            {
              id: 'frame', label: '嫁禍別人',
              hint: '（讓監督官以為是另一個人偷的。）',
              effects: [
                { type: 'moral', axis: 'reliability', side: 'negative', weight: 2 },
                { type: 'moral', axis: 'mercy', side: 'negative' },
              ],
              resultLog: '你拿了一條乾肉、塞到另一個雜兵的床底。然後跟監督官講。',
              logColor: '#883333',
            },
          ],
        }, { onChoose: (id) => _thiefResolve(id, thief, item) });
      }
    });
  }

  function _thiefResolve(choiceId, thief, item) {
    let lines = [];
    if (choiceId === 'confront') {
      lines = [
        { text: `（你揪 ${thief} 的衣領、把他壓到牆上。）` },
        { speaker: thief, text: '⋯⋯對、是我。我餓了、我錯了。' },
        { text: '（他從袋子裡抖出 ${item} 還你。）'.replace('${item}', item) },
        { text: '（你揍了他兩拳、放他走。）' },
        { text: `（之後 ${thief} 看到你會繞道走、別人也知道你不好惹。）`, color: '#aa8855' },
      ];
      if (typeof Stats !== 'undefined') Stats.modVital('mood', 5);
      Flags.set(`thief_${thief}_confronted`, true);
    } else if (choiceId === 'letgo') {
      lines = [
        { text: '（你轉身回房、躺在床上看天花板。）' },
        { text: '（一條乾肉而已。但你心裡有點堵。）' },
        { text: '（——這裡每個人都餓。也包括你。）', color: '#aa8855' },
      ];
      if (typeof Stats !== 'undefined') Stats.modVital('mood', -3);
    } else if (choiceId === 'steal_back') {
      lines = [
        { text: `（半夜。你溜進 ${thief} 的房間。）` },
        { text: '（他睡得很沉。鼾聲均勻。）' },
        { text: '（你翻他袋子——你的東西在裡面、還有他自己的兩條乾肉、一小袋鹽。）' },
        { text: '（你全拿了。）' },
        { text: '⋯⋯', color: '#666' },
        { text: '（回床上、你睡不著。）' },
        { text: `（明天 ${thief} 會以為自己昨晚做了惡夢嗎？）`, color: '#888' },
      ];
      if (typeof Stats !== 'undefined') {
        Stats.modVital('mood', -5);
        if (Stats.modMoney) Stats.modMoney(20);
      }
    } else if (choiceId === 'frame') {
      const scapegoat = _THIEF_NAMES.filter(n => n !== thief)[Math.floor(Math.random() * 5)];
      lines = [
        { text: `（你拿了一條 ${thief} 袋裡的乾肉。）` },
        { text: `（半夜、你把它塞到 ${scapegoat} 的床底。）` },
        { text: '（隔天、你跟監督官講「我看到 ${name} 床底有東西」。）'.replace('${name}', scapegoat) },
        { text: `（${scapegoat} 被打了一頓、被罰睡馬廄三天。）` },
        { text: '⋯⋯', color: '#666' },
        { text: '（他不知道是你做的。但他眼神在找誰幹的。）', color: '#888' },
        { text: '（你低頭、繼續訓練。）', color: '#888' },
        { text: '（——這條你要記一輩子。）', color: '#aa6666' },
      ];
      if (typeof Stats !== 'undefined') Stats.modVital('mood', -10);
      Flags.set(`thief_framed_${scapegoat}`, true);
    }
    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    _log(`✦ 偷竊事件解決（${choiceId}）。`, '#aa8855', false);
  }

  // ═══════════════════════════════════════════════════
  // 🆕 P3-7a INTRA_BULLY 欺負新人
  // ═══════════════════════════════════════════════════
  // 觸發：新人到的隔天 / Day 20+、5% 機率 / 天、12 天 cooldown
  function tryBully(newDay) {
    if (newDay < 20) return false;
    const last = Flags.get('last_bully_day') || 0;
    if (newDay - last < 12) return false;
    if (Math.random() > 0.05) return false;
    Flags.set('last_bully_day', newDay);
    _playBully();
    return true;
  }

  function _playBully() {
    const newbieName = ['提歐', '伊里', '法庫斯', '小狄'][Math.floor(Math.random() * 4)];
    const lines = [
      { text: '（午後。你經過廁所角落、聽到悶悶的聲音。）' },
      { text: '（你繞過去看——三個老兵圍著一個新人。）' },
      { text: `（新人叫 ${newbieName}、上禮拜才來、瘦小、十六七歲。）` },
      { text: '（一個老兵把他按在牆上、另一個翻他口袋。）' },
      { speaker: '老兵', text: '⋯⋯新來的、規矩你不懂、我教你。', color: '#aa7755' },
      { speaker: newbieName, text: '⋯⋯求⋯⋯求你別⋯⋯', color: '#9999cc' },
      { text: '（沒人看到你。你站在轉角、可以走、也可以插手。）' },
    ];

    if (typeof DialogueModal === 'undefined') { _bullyResolve('intervene', newbieName); return; }
    DialogueModal.play(lines, {
      onComplete: () => {
        if (typeof ChoiceModal === 'undefined') { _bullyResolve('intervene', newbieName); return; }
        ChoiceModal.show({
          id: 'intra_bully_' + newDay,
          icon: '👊',
          title: '三個老兵在欺負新人',
          body: `${newbieName} 求饒中。你怎麼辦？`,
          forced: true,
          choices: [
            {
              id: 'intervene', label: '走過去、把他們攔下',
              hint: '（你也是被欺負過的。）',
              effects: [{ type: 'moral', axis: 'mercy', side: 'positive' }],
              resultLog: `你走過去、把按住 ${newbieName} 的老兵推開。`,
              logColor: '#88aa66',
            },
            {
              id: 'walk_by', label: '裝沒看到、走過去',
              hint: '（這裡每個人都這樣過來的。）',
              effects: [{ type: 'moral', axis: 'mercy', side: 'negative' }],
              resultLog: '你低頭、繞另一條路走。背後傳來悶哼聲。',
              logColor: '#888899',
            },
            {
              id: 'join', label: '加入老兵那邊、湊一手',
              hint: '（這就是規矩。）',
              effects: [
                { type: 'moral', axis: 'mercy', side: 'negative', weight: 2 },
                { type: 'moral', axis: 'pride', side: 'positive' },
              ],
              resultLog: `你走過去、跟老兵笑了一下、踢了 ${newbieName} 一腳。`,
              logColor: '#aa5555',
            },
          ],
        }, { onChoose: (id) => _bullyResolve(id, newbieName) });
      }
    });
  }

  function _bullyResolve(choiceId, newbie) {
    let lines = [];
    if (choiceId === 'intervene') {
      lines = [
        { text: '（你推開老兵、把新人擋在身後。）' },
        { speaker: '老兵', text: '⋯⋯你想插手？', color: '#aa7755' },
        { text: '（你沒講話、只是站著。手放在腰側、隨時可以動。）' },
        { text: '（三個老兵互看一眼——他們知道你打過幾場大的。）' },
        { speaker: '老兵', text: '⋯⋯算了、不值得。' },
        { text: '（他們散了。）' },
        { speaker: newbie, text: '⋯⋯謝⋯⋯謝謝⋯⋯', color: '#9999cc' },
        { text: '（他抖得說不出完整的話。你拍拍他的肩、轉身離開。）' },
        { text: '（——你想起 Day 1 的自己。）', color: '#aa8855' },
      ];
      if (typeof Stats !== 'undefined') Stats.modFame(2);
      Flags.set(`bully_intervened_${newbie}`, true);
    } else if (choiceId === 'walk_by') {
      lines = [
        { text: '（你低頭、繞道走。）' },
        { text: '（背後傳來壓抑的哭聲。然後是悶哼。）' },
        { text: '（你走得快一點、回房間。）' },
        { text: '（——這裡每個人都這樣過來的。對吧？）', color: '#888' },
        { text: '⋯⋯', color: '#666' },
      ];
      if (typeof Stats !== 'undefined') Stats.modVital('mood', -5);
    } else {
      lines = [
        { text: `（你走過去、加入。${newbie} 看到你的眼神——絕望。）` },
        { text: '（你踢了他兩腳、老兵笑著拍你的背。）' },
        { speaker: '老兵', text: '⋯⋯不錯。新人懂規矩了。', color: '#aa7755' },
        { text: '⋯⋯', color: '#666' },
        { text: `（${newbie} 之後再看到你會閃。）`, color: '#888' },
      ];
      if (typeof Stats !== 'undefined') {
        Stats.modVital('mood', -10);
        Stats.modFame(1);
      }
      Flags.set(`bully_joined_${newbie}`, true);
    }
    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    _log(`✦ 欺負新人事件（${choiceId}）。`, '#aa8855', false);
  }

  // ═══════════════════════════════════════════════════
  // 🆕 P3-7b INTRA_DOC 老默喝醉
  // ═══════════════════════════════════════════════════
  // 觸發：Day 40+、4% 機率 / 天、20 天 cooldown
  // 純劇情、深化老默
  function tryDocDrunk(newDay) {
    if (newDay < 40) return false;
    if (!_isPresent('doctorMo')) return false;
    const last = Flags.get('last_doc_drunk_day') || 0;
    if (newDay - last < 20) return false;
    if (Math.random() > 0.04) return false;
    Flags.set('last_doc_drunk_day', newDay);
    _playDocDrunk();
    return true;
  }

  function _playDocDrunk() {
    const lines = [
      { text: '（深夜。你睡不著、出去走走。）' },
      { text: '（訓練場角落、火盆邊、有個人坐著。）' },
      { text: '（——是老默。手裡一壺酒、半空。）' },
      { speaker: '老默', text: '⋯⋯哦、你⋯⋯', color: '#7a6a4a' },
      { text: '（他眼神虛、聲音含糊。）' },
      { text: '（你在他旁邊坐下。沒講話。）' },
      { text: '⋯⋯', color: '#666' },
    ];

    if (typeof DialogueModal === 'undefined') { _docDrunkResolve('listen'); return; }
    DialogueModal.play(lines, {
      onComplete: () => {
        if (typeof ChoiceModal === 'undefined') { _docDrunkResolve('listen'); return; }
        ChoiceModal.show({
          id: 'intra_doc_drunk_' + newDay,
          icon: '🍶',
          title: '老默喝醉了',
          body: '他想講話、但很少有人聽他。',
          forced: true,
          choices: [
            {
              id: 'listen', label: '陪他坐、聽他講',
              hint: '（他需要有人聽。）',
              effects: [
                { type: 'moral', axis: 'patience', side: 'positive' },
                { type: 'affection', key: 'doctorMo', delta: 5 },
              ],
              resultLog: '你坐到他身邊、把酒壺接過來、不喝、就放著。',
              logColor: '#88aa66',
            },
            {
              id: 'leave', label: '回房間睡',
              hint: '（你也累了。）',
              effects: [],
              resultLog: '你站起來、往房間走。回頭看了一眼老默、他低頭看著火。',
              logColor: '#888899',
            },
          ],
        }, { onChoose: (id) => _docDrunkResolve(id) });
      }
    });
  }

  function _docDrunkResolve(choiceId) {
    if (choiceId !== 'listen') {
      if (typeof DialogueModal !== 'undefined') {
        DialogueModal.play([
          { text: '（你回房、躺下。）' },
          { text: '（睡前你聽到外面、老默低聲念了一個名字。你沒聽清楚是誰。）', color: '#888' },
        ]);
      }
      return;
    }
    const lines = [
      { speaker: '老默', text: '⋯⋯三十年前、我在比拉斯城開過自己的醫館。', color: '#7a6a4a' },
      { speaker: '老默', text: '⋯⋯有一個小女孩、五歲、發燒一禮拜、家人帶來找我。' },
      { speaker: '老默', text: '⋯⋯我用我能用的所有藥、四天四夜沒睡。' },
      { speaker: '老默', text: '⋯⋯第五天早上她走了。在我手裡。' },
      { text: '⋯⋯', color: '#666' },
      { speaker: '老默', text: '⋯⋯她媽媽沒哭、沒罵我。只跟我講「謝謝你試過」。' },
      { speaker: '老默', text: '⋯⋯然後我就再也沒辦法在那城裡開業。' },
      { speaker: '老默', text: '⋯⋯不是被罵走的。是我自己走的。' },
      { text: '（火盆裡的炭爆了一下。他沒抬頭。）' },
      { speaker: '老默', text: '⋯⋯來這裡、是因為這裡的人都已經準備好死了。', color: '#7a6a4a' },
      { speaker: '老默', text: '⋯⋯我救不活也沒人怪我。' },
      { text: '⋯⋯', color: '#666' },
      { text: '（你看著他。沒問他那女孩叫什麼。）' },
      { text: '（——有些名字、不該讓他再說一次。）', color: '#aa8855' },
      { speaker: '老默', text: '⋯⋯小子、回去睡。我自己會走回去。', color: '#7a6a4a' },
      { text: '（你站起來、回房。）' },
      { text: '（明天他不會記得這晚講過什麼。）', color: '#888' },
      { text: '（但你會。）', color: '#aa8855' },
    ];
    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    Flags.set('doc_drunk_listened', true);
    _log('✦ 你陪老默坐了一晚、聽了他三十年前的故事。', '#aa8855', true);
  }

  // ═══════════════════════════════════════════════════
  // 🆕 P3-7c INTRA_FOOD 廚房短缺
  // ═══════════════════════════════════════════════════
  // 觸發：Day 20+、4% 機率、15 天 cooldown
  function tryFoodShortage(newDay) {
    if (newDay < 20) return false;
    const last = Flags.get('last_food_short_day') || 0;
    if (newDay - last < 15) return false;
    if (Math.random() > 0.04) return false;
    Flags.set('last_food_short_day', newDay);
    _playFoodShortage();
    return true;
  }

  function _playFoodShortage() {
    const lines = [
      { text: '（午餐時間。食堂排隊。）' },
      { text: '（梅拉表情不太對——大鍋裡的湯比平常少了一半。）' },
      { speaker: '梅拉', text: '⋯⋯今天進貨少了。每人半碗。', color: '#5a4a2a' },
      { text: '（你前面的人領了半碗、往位置走。）' },
      { text: '（輪到你——梅拉舀了一勺、小聲：）' },
      { speaker: '梅拉', text: '⋯⋯今天大家都半碗。', color: '#5a4a2a' },
      { text: '（你接過碗、轉身——看到角落新人 ${name} 坐著、碗已經空了、還在舔湯渣。）'
              .replace('${name}', '小狄') },
      { text: '（他比你瘦、剛來、沒打過硬仗、底子虛。）' },
    ];

    if (typeof DialogueModal === 'undefined') { _foodResolve('keep'); return; }
    DialogueModal.play(lines, {
      onComplete: () => {
        if (typeof ChoiceModal === 'undefined') { _foodResolve('keep'); return; }
        ChoiceModal.show({
          id: 'intra_food_' + Stats.player.day,
          icon: '🥣',
          title: '今天每人半碗',
          body: '新人小狄已經吃完。你怎麼辦？',
          forced: true,
          choices: [
            {
              id: 'keep', label: '自己吃自己的',
              hint: '（你也餓。明天還要訓練。）',
              effects: [],
              resultLog: '你坐下、慢慢吃完。沒看小狄。',
              logColor: '#888899',
            },
            {
              id: 'share', label: '分一半給小狄',
              hint: '（多一個人活也是活。）',
              effects: [
                { type: 'moral', axis: 'mercy', side: 'positive' },
                { type: 'vital', key: 'food', delta: -10 },
              ],
              resultLog: '你走到小狄旁邊、把碗倒一半進他碗裡。他抬頭看你、嘴張了又合上。',
              logColor: '#88aa66',
            },
            {
              id: 'snatch', label: '搶別人的（沒人看到）',
              hint: '（旁邊有個雜兵離開沒收碗。）',
              effects: [
                { type: 'moral', axis: 'reliability', side: 'negative' },
                { type: 'moral', axis: 'mercy', side: 'negative' },
              ],
              resultLog: '你瞄了一眼、伸手把那碗端走。回位置。',
              logColor: '#aa7755',
            },
          ],
        }, { onChoose: (id) => _foodResolve(id) });
      }
    });
  }

  function _foodResolve(choiceId) {
    let lines = [];
    if (choiceId === 'keep') {
      lines = [
        { text: '（你坐在自己位置、半碗喝完。胃還是空的。）' },
        { text: '（小狄繼續舔他的空碗。你沒看他。）' },
        { text: '⋯⋯', color: '#666' },
      ];
    } else if (choiceId === 'share') {
      lines = [
        { text: '（你走到小狄旁邊、把碗倒一半進他碗裡。）' },
        { speaker: '小狄', text: '⋯⋯你⋯⋯為什麼？' },
        { speaker: '玩家', text: '⋯⋯沒事。吃。' },
        { text: '（他低頭、慢慢喝。手在抖。）' },
        { text: '⋯⋯', color: '#666' },
        { text: '（梅拉從廚房門口看了一眼——你看到她點了下頭。）' },
        { text: '（——她記下了。）', color: '#aa8855' },
      ];
      if (typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection('melaKook', 3);
      }
      Flags.set('shared_food_with_newbie', true);
    } else {
      lines = [
        { text: '（你瞄了一眼——那雜兵真的沒回來收。）' },
        { text: '（你伸手、把他半碗湯端到自己位置。）' },
        { text: '（喝光、把空碗推回原位、像沒事一樣。）' },
        { text: '⋯⋯', color: '#666' },
        { text: '（後來那雜兵回來、找不到自己的碗、罵了一聲、走了。）' },
        { text: '（沒人知道是你。）', color: '#888' },
        { text: '（——但你知道。）', color: '#aa6666' },
      ];
      if (typeof Stats !== 'undefined' && Stats.modVital) Stats.modVital('food', 5);
    }
    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    _log(`✦ 廚房短缺事件（${choiceId}）。`, '#aa8855', false);
  }

  // ═══════════════════════════════════════════════════
  // 🆕 P3-7d INTRA_BET 詐賭事件
  // ═══════════════════════════════════════════════════
  // 觸發：Day 8+、6%/天、12 天 cooldown
  // 你路過骰子局、看到老兵在坑新人（暗中換骰子）
  function tryBet(newDay) {
    if (newDay < 8) return false;
    const last = Flags.get('last_bet_day') || 0;
    if (newDay - last < 12) return false;
    if (Math.random() > 0.06) return false;
    Flags.set('last_bet_day', newDay);
    _playBet();
    return true;
  }

  function _playBet() {
    const newbie = ['提歐', '小狄', '法庫斯', '伊里'][Math.floor(Math.random() * 4)];
    const pot = 30 + Math.floor(Math.random() * 30);   // 30-60 銅幣局
    const lines = [
      { text: '（晚上。後巷火堆邊、三個老兵圍著一個新人擲骰子。）' },
      { text: `（${newbie} 把口袋翻光、桌上堆著他全部的銅幣——${pot} 個。）` },
      { speaker: '老兵', text: '⋯⋯來、再一把就贏回來。', color: '#aa7755' },
      { text: '（你站在轉角看——其中一個老兵的左手在桌下動了一下。）' },
      { text: '（——他在換骰子。）', color: '#aa6666' },
      { text: `（${newbie} 沒看出來、興奮地把最後幾個銅幣推上桌。）` },
      { text: '（你可以走、可以動。）' },
    ];

    if (typeof DialogueModal === 'undefined') { _betResolve('walk', newbie, pot); return; }
    DialogueModal.play(lines, {
      onComplete: () => {
        if (typeof ChoiceModal === 'undefined') { _betResolve('walk', newbie, pot); return; }
        ChoiceModal.show({
          id: 'intra_bet_' + Stats.player.day,
          icon: '🎲',
          title: '老兵在坑新人',
          body: `${newbie} 全部 ${pot} 銅幣要輸了。你怎麼辦？`,
          forced: true,
          choices: [
            {
              id: 'expose',
              label: '走過去揭發、抓他換骰子',
              hint: '（看不下去。）',
              effects: [
                { type: 'moral', axis: 'reliability', side: 'positive' },
                { type: 'moral', axis: 'mercy', side: 'positive' },
              ],
              resultLog: '你走過去、一把按住老兵的左手。「⋯⋯亮出來。」',
              logColor: '#88aa66',
            },
            {
              id: 'warn',
              label: '把新人拉到旁邊、悄悄警告',
              hint: '（不撕破臉。）',
              effects: [{ type: 'moral', axis: 'mercy', side: 'positive' }],
              resultLog: `你走過去、拍 ${newbie} 的肩膀：「跟我來、有事。」`,
              logColor: '#88aa88',
            },
            {
              id: 'walk',
              label: '裝沒看到、走回去',
              hint: '（每個人都得學自己的代價。）',
              effects: [{ type: 'moral', axis: 'patience', side: 'positive' }],
              resultLog: '你低頭、繞另一條路回房。背後傳來歡呼跟咒罵。',
              logColor: '#888899',
            },
            {
              id: 'join',
              label: '加入老兵那邊、分一杯',
              hint: '（你也想要那筆錢。）',
              effects: [
                { type: 'moral', axis: 'reliability', side: 'negative', weight: 2 },
                { type: 'moral', axis: 'mercy', side: 'negative' },
              ],
              resultLog: '你走過去、跟老兵點頭一笑、坐下擲第一輪。',
              logColor: '#aa5555',
            },
          ],
        }, { onChoose: (id) => _betResolve(id, newbie, pot) });
      }
    });
  }

  function _betResolve(choiceId, newbie, pot) {
    let lines = [];
    if (choiceId === 'expose') {
      lines = [
        { text: '（你按住老兵的左手、拉開——掌心一個亮面骰子。）' },
        { speaker: '老兵', text: '⋯⋯（他臉色慘白。）', color: '#aa7755' },
        { text: '（其他兩個老兵想動、被你眼神壓住。）' },
        { speaker: newbie, text: '⋯⋯什⋯⋯什麼意思？' },
        { text: '（你把假骰子丟在桌上、把新人的銅幣推回他手裡。）' },
        { speaker: '玩家', text: '⋯⋯拿回去。下次別賭了。' },
        { text: `（${newbie} 抖著收銅幣、低頭走了。）` },
        { text: '（三個老兵看著你、沒人講話。）' },
        { text: '（你轉身走——你知道這幾個之後會找你麻煩。）', color: '#aa8855' },
      ];
      Flags.set('bet_exposed_cheaters', true);
      if (typeof Stats !== 'undefined') Stats.modFame(2);
    } else if (choiceId === 'warn') {
      lines = [
        { text: `（你走過去、拍 ${newbie} 的肩、把他帶到後面。）` },
        { speaker: '玩家', text: '⋯⋯他們在換骰子。你贏不了。' },
        { speaker: newbie, text: '⋯⋯真的？' },
        { speaker: '玩家', text: '⋯⋯回去要回你那 ${pot}。剩的別下了。'.replace('${pot}', pot) },
        { text: `（${newbie} 點頭、回去抓回他的銅幣、跑了。）` },
        { text: '（老兵罵了一聲、知道是你壞他們的局——但沒當場發作。）' },
        { text: '（——你做了對的事、但你跟那三個結了梁子。）', color: '#aa8855' },
      ];
      Flags.set(`bet_warned_${newbie}`, true);
    } else if (choiceId === 'walk') {
      lines = [
        { text: '（你低頭走過去、進房間、躺下。）' },
        { text: '（外面歡呼聲、然後是壓抑的哭聲。）' },
        { text: `（${newbie} 全輸了。明早他大概會懂這裡的規矩。）`, color: '#888' },
        { text: '⋯⋯', color: '#666' },
      ];
      if (typeof Stats !== 'undefined') Stats.modVital('mood', -3);
    } else {
      lines = [
        { text: '（你坐下、跟老兵交換一個眼神——他笑了、把假骰子推到你手邊。）' },
        { text: '（一輪、兩輪、三輪——${name} 把所有錢都輸了。）'.replace('${name}', newbie) },
        { text: '（散場後、老兵分你一份。）' },
        { speaker: '老兵', text: '⋯⋯收下。下次有局再叫你。', color: '#aa7755' },
        { text: `（你拿了。${Math.round(pot * 0.3)} 個銅幣、有點重。）` },
        { text: '⋯⋯', color: '#666' },
        { text: `（隔天 ${newbie} 看你的眼神不對。但他不敢講。）`, color: '#aa6666' },
      ];
      if (typeof Stats !== 'undefined') {
        if (Stats.modMoney) Stats.modMoney(Math.round(pot * 0.3));
        Stats.modVital('mood', -5);
      }
      Flags.set('bet_joined_cheaters', true);
    }
    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    _log(`✦ 詐賭事件（${choiceId}）。`, '#aa8855', false);
  }

  // ═══════════════════════════════════════════════════
  // 🆕 P3-7e INTRA_LIBRARY 找到舊書
  // ═══════════════════════════════════════════════════
  // 觸發：Day 20+、3%/天、25 天 cooldown
  // 死人/離開的角鬥士的房裡撿到一本書
  function tryLibraryBook(newDay) {
    if (newDay < 20) return false;
    if (typeof Books === 'undefined' || !Books.grantBook) return false;
    const last = Flags.get('last_library_day') || 0;
    if (newDay - last < 25) return false;
    if (Math.random() > 0.03) return false;

    // 找一本玩家還沒讀也沒在書櫃的書
    const p = Stats.player;
    const read  = Array.isArray(p.readBooks) ? p.readBooks : [];
    const shelf = Array.isArray(p.bookshelf) ? p.bookshelf.map(b => b.id) : [];
    const candidates = [
      'children_reader', 'common_words_3000', 'merchant_ledger',
      'old_general_memoir', 'odysseus_tale', 'martyr_saint_life',
      'family_sword_manual', 'berserker_fist_scroll', 'shield_wall_essay',
    ].filter(id => !read.includes(id) && !shelf.includes(id));
    if (candidates.length === 0) return false;
    if (shelf.length >= 5) return false;   // 書櫃滿了不觸發

    const bookId = candidates[Math.floor(Math.random() * candidates.length)];
    Flags.set('last_library_day', newDay);
    _playLibraryBook(bookId);
    return true;
  }

  function _playLibraryBook(bookId) {
    const dead = ['雷帝克斯', '俄薩', '昆迪', '沃克'][Math.floor(Math.random() * 4)];
    const lines = [
      { text: `（中午。監督官派你去清 ${dead} 的房間——他上禮拜走了。）` },
      { text: '（你翻床底、找到一個布包。）' },
      { text: '（裡面是一本舊書。封面磨得發毛、邊角焦了一塊。）' },
      { text: '（你掀開——字跡認真、像是被人讀過很多次。）' },
      { text: '（你把書塞進自己袋子。沒人會問。）' },
      { text: `（——${dead} 應該不會介意。）`, color: '#aa8855' },
    ];
    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    Books.grantBook(bookId);
    _log(`✦ 在死者房裡撿到一本舊書。`, '#99bbdd', true);
  }

  // ═══════════════════════════════════════════════════
  // 🆕 P3-7f INTRA_DREAM 共夢事件
  // ═══════════════════════════════════════════════════
  // 觸發：Day 30+、3%/天、20 天 cooldown、需有好感 ≥ 50 NPC 在場
  // 早晨某 NPC 跟你提起昨晚做的夢、玩家可選共鳴
  function tryDream(newDay) {
    if (newDay < 30) return false;
    const last = Flags.get('last_dream_day') || 0;
    if (newDay - last < 20) return false;
    if (Math.random() > 0.03) return false;

    // 找好感 ≥ 50 的在場 NPC
    const candidates = ['orlan', 'cassius', 'hector', 'melaKook', 'doctorMo'];
    const aff = (id) => (typeof teammates !== 'undefined' && teammates.getAffection)
      ? teammates.getAffection(id) : 0;
    const eligible = candidates.filter(id => aff(id) >= 50 && _isPresent(id));
    if (eligible.length === 0) return false;

    const npcId = eligible[Math.floor(Math.random() * eligible.length)];
    Flags.set('last_dream_day', newDay);
    _playDream(npcId);
    return true;
  }

  // 每個 NPC 的夢內容（觸動該角色的核心傷痛 / 過去）
  const _DREAM_LINES = {
    orlan: {
      speaker: '奧蘭',
      color: '#7a9c7a',
      lines: [
        { speaker: '奧蘭', text: '⋯⋯我昨晚夢到磨坊。', color: '#7a9c7a' },
        { speaker: '奧蘭', text: '⋯⋯我父親在轉石磨、轉得好慢。' },
        { speaker: '奧蘭', text: '⋯⋯我喊他、他沒抬頭。' },
        { speaker: '奧蘭', text: '⋯⋯醒來才想起來、他十年前就死了。' },
      ],
    },
    cassius: {
      speaker: '卡西烏斯',
      color: '#5a7a9a',
      lines: [
        { speaker: '卡西烏斯', text: '⋯⋯昨晚做了個老夢。', color: '#5a7a9a' },
        { speaker: '卡西烏斯', text: '⋯⋯我年輕時候在競技場、第一場大戰。' },
        { speaker: '卡西烏斯', text: '⋯⋯對手倒下舉手、我沒砍。' },
        { speaker: '卡西烏斯', text: '⋯⋯醒來覺得自己這輩子做對的事、那個下午算一次。' },
      ],
    },
    hector: {
      speaker: '赫克特',
      color: '#9a5a3a',
      lines: [
        { speaker: '赫克特', text: '⋯⋯他媽的夢到自己年輕時候。', color: '#9a5a3a' },
        { speaker: '赫克特', text: '⋯⋯沒這身傷的時候、跑得多快、抓鳥都行。' },
        { speaker: '赫克特', text: '⋯⋯醒來腰還是痠的。' },
        { speaker: '赫克特', text: '⋯⋯老了。沒救。' },
      ],
    },
    melaKook: {
      speaker: '梅拉',
      color: '#9dbf80',
      lines: [
        { speaker: '梅拉', text: '⋯⋯昨晚夢到我女兒。', color: '#9dbf80' },
        { speaker: '梅拉', text: '⋯⋯她五歲那年穿的小紅鞋、我幫她綁鞋帶。' },
        { speaker: '梅拉', text: '⋯⋯我醒來摸床邊、以為她還在。' },
        { speaker: '梅拉', text: '⋯⋯然後想起來、她已經三十歲了、嫁去外地。' },
        { speaker: '梅拉', text: '⋯⋯人老了、夢都不長進。' },
      ],
    },
    doctorMo: {
      speaker: '老默',
      color: '#7a6a4a',
      lines: [
        { speaker: '老默', text: '⋯⋯我昨晚夢到醫館的藥架。', color: '#7a6a4a' },
        { speaker: '老默', text: '⋯⋯排得整整齊齊、每瓶都有標籤。' },
        { speaker: '老默', text: '⋯⋯我伸手要拿一瓶、它就消失。' },
        { speaker: '老默', text: '⋯⋯我拿一瓶、它就消失。' },
        { speaker: '老默', text: '⋯⋯醒來時、我一身汗。' },
      ],
    },
  };

  function _playDream(npcId) {
    const def = _DREAM_LINES[npcId];
    if (!def) return;

    const lines = [
      { text: '（清晨。你伸懶腰、走到食堂。）' },
      { text: `（${def.speaker} 已經坐在那、看著遠處、像沒睡好。）` },
      ...def.lines,
      { text: '⋯⋯', color: '#666' },
    ];

    if (typeof DialogueModal === 'undefined') { _dreamResolve('share', npcId); return; }
    DialogueModal.play(lines, {
      onComplete: () => {
        if (typeof ChoiceModal === 'undefined') { _dreamResolve('share', npcId); return; }
        ChoiceModal.show({
          id: 'intra_dream_' + npcId,
          icon: '💭',
          title: `${def.speaker} 講完夢、看著你`,
          body: '你昨晚也做了一個類似的夢——還是隨便講講？',
          forced: true,
          choices: [
            {
              id: 'share',
              label: '⋯⋯我昨晚也做了一個夢。',
              hint: '（坦白告訴他。）',
              effects: [
                { type: 'moral', axis: 'patience', side: 'positive' },
                { type: 'affection', key: npcId, delta: 5 },
              ],
              resultLog: `你跟 ${def.speaker} 講了你的夢。他點頭、笑了一下。`,
              logColor: '#88aa66',
            },
            {
              id: 'silent',
              label: '⋯⋯（沉默）',
              hint: '（夢的事不好講。）',
              effects: [],
              resultLog: '你沒講話、坐他對面吃早餐。',
              logColor: '#888899',
            },
          ],
        }, { onChoose: (id) => _dreamResolve(id, npcId) });
      }
    });
  }

  function _dreamResolve(choiceId, npcId) {
    const def = _DREAM_LINES[npcId] || {};
    let lines = [];
    if (choiceId === 'share') {
      lines = [
        { text: '（你想了一下、開口。）' },
        { text: '（你講了一段——可能是家鄉、可能是還沒被抓那年的夏天。）' },
        { speaker: def.speaker, text: '⋯⋯（他聽完、點頭。）', color: def.color },
        { speaker: def.speaker, text: '⋯⋯不錯。你還記得。' },
        { text: '（兩人沉默吃完早餐。）' },
        { text: '（——你跟他之間多了一道線。）', color: '#aa8855' },
      ];
      Flags.set(`dream_shared_${npcId}`, true);
    } else {
      lines = [
        { text: '（你沒講話、低頭吃。）' },
        { speaker: def.speaker, text: '⋯⋯（他沒追問。）', color: def.color },
        { text: '（兩個人安安靜靜吃完。）' },
        { text: '（——他不會追、但你心裡有點什麼沒講出來。）', color: '#888' },
      ];
    }
    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    _log(`✦ 共夢事件（${def.speaker}、${choiceId}）。`, '#aa8855', false);
  }

  // ═══════════════════════════════════════════════════
  // 🆕 2026-05-09 P3-5b 赫克特試煉（派系深化）
  // ═══════════════════════════════════════════════════
  // 條件：Day 40+ + faction_aligned_hector + 赫克特 ≥ 50 + 一次性
  // 場景：赫克特把玩家拉到角落、要他證明「夠陰夠狠」
  // 任務：今晚去找對方派系一個雜兵、揍一頓
  function tryHectorTrial(newDay) {
    if (newDay < 40) return false;
    if (Flags.has('hector_trial_done')) return false;
    if (!Flags.has('faction_aligned_hector')) return false;
    if (typeof teammates === 'undefined') return false;
    if (teammates.getAffection('hector') < 50) return false;
    if (!_isPresent('hector')) return false;
    if (Math.random() > 0.10) return false;   // 10% 機率 / 天
    Flags.set('hector_trial_done', true);
    _playHectorTrial();
    return true;
  }

  function _playHectorTrial() {
    const targets = ['法庫斯', '小狄', '提歐'];
    const target = targets[Math.floor(Math.random() * targets.length)];

    const intro = [
      { text: '（傍晚。赫克特把你拉到牆角。）' },
      { speaker: '赫克特', text: '⋯⋯小子。我看你跟我這麼久了。', color: '#9a5a3a' },
      { speaker: '赫克特', text: '⋯⋯但你還沒證明過你「夠狠」。' },
      { speaker: '赫克特', text: '⋯⋯卡西烏斯派的有幾個雜兵、最近在到處說我們壞話。' },
      { speaker: '赫克特', text: `⋯⋯今晚去找 ${target}。揍一頓。讓他知道規矩。`, color: '#9a5a3a' },
      { speaker: '赫克特', text: '⋯⋯做得到、你就是我的人。做不到、就別再講話了。' },
    ];

    if (typeof DialogueModal === 'undefined') { _hectorTrialResolve('refuse', target); return; }
    DialogueModal.play(intro, {
      onComplete: () => {
        if (typeof ChoiceModal === 'undefined') { _hectorTrialResolve('refuse', target); return; }
        ChoiceModal.show({
          id: 'hector_trial',
          icon: '👊',
          title: '赫克特要你「證明自己」',
          body: `去揍 ${target} 一頓。你怎麼辦？`,
          forced: true,
          choices: [
            {
              id: 'accept',
              label: '接、今晚就去',
              hint: '（規矩就是規矩。）',
              effects: [
                { type: 'moral', axis: 'mercy', side: 'negative' },
                { type: 'moral', axis: 'reliability', side: 'negative' },
              ],
              resultLog: '你點頭。赫克特拍你的肩。「⋯⋯不錯。」',
              logColor: '#aa5555',
            },
            {
              id: 'half',
              label: '揍但不下重手',
              hint: '（揍個樣子給他看。）',
              effects: [
                { type: 'moral', axis: 'patience', side: 'positive' },
                { type: 'moral', axis: 'mercy', side: 'negative' },
              ],
              resultLog: '你點頭。心裡決定打到他不能還手就停。',
              logColor: '#aa8855',
            },
            {
              id: 'refuse',
              label: '拒絕、我不做這個',
              hint: '（這不是我加入派系的理由。）',
              effects: [
                { type: 'moral', axis: 'mercy', side: 'positive' },
                { type: 'moral', axis: 'reliability', side: 'positive' },
              ],
              resultLog: '你搖頭。赫克特愣了一下、臉色難看。',
              logColor: '#88aa66',
            },
          ],
        }, { onChoose: (id) => _hectorTrialResolve(id, target) });
      }
    });
  }

  function _hectorTrialResolve(choiceId, target) {
    if (choiceId === 'refuse') {
      const lines = [
        { speaker: '赫克特', text: '⋯⋯哼。', color: '#9a5a3a' },
        { speaker: '赫克特', text: '⋯⋯算了。你不是我的人。' },
        { speaker: '赫克特', text: '⋯⋯以後你打你的、我打我的。別擋路。' },
        { text: '（他轉身走了。沒看你。）' },
        { text: '⋯⋯', color: '#666' },
        { text: '（——你失去了赫克特派身分。）', color: '#aa6666' },
        { text: '（——但你也保住了你的人。）', color: '#aa8855' },
      ];
      if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
      Flags.unset('faction_aligned_hector');
      Flags.set('hector_faction_kicked_out', true);
      if (typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection('hector', -25);
        teammates.modAffection('cassius', 10);   // 卡西烏斯會聽到
      }
      _log(`✦ 赫克特試煉拒絕。退出赫克特派、赫克特 -25、卡西烏斯 +10。`, '#aa8855', true);
      return;
    }

    // accept / half — 進戰鬥
    const lines = [
      { text: '（晚上。你帶著悶火去訓練場後巷。）' },
      { text: `（${target} 一個人在那壓腿、沒帶武器。）` },
      { text: '（他抬頭——看到你、表情先愣再皺。）' },
      { speaker: target, text: `⋯⋯你⋯⋯有事？`, color: '#888' },
      { text: '（你沒回答。走過去。）' },
      { text: '（他看出你眼神不對、後退一步、伸手摸腰邊的訓練木棍。）' },
      ...(choiceId === 'half' ? [
        { text: '（你心裡決定——打到他不能還手就停。）', color: '#aa8855' },
      ] : [
        { text: '（你心裡決定——讓他記住規矩。）', color: '#aa5555' },
      ]),
    ];

    const startBattle = () => {
      // half 模式對手稍弱（玩家容易控制不下重手）
      const isHalf = (choiceId === 'half');
      const targetCfg = {
        name: target, title: '卡西烏斯派・雜兵',
        STR: isHalf ? 22 : 26,
        DEX: 24, CON: isHalf ? 22 : 28, AGI: 24, WIL: 22, LUK: 8,
        hpBase: isHalf ? 70 : 85,
        weaponId: 'fists', armorId: 'rags',   // 沒武器、訓練木棍當空手
        ai: 'cautious', fame: 1,
      };
      const onWin = () => {
        if (isHalf) {
          _hectorTrialPostBattle('half', target);
        } else {
          _hectorTrialPostBattle('accept', target);
        }
      };
      const onLose = () => {
        // 玩家輸 — 赫克特很失望
        const failLines = [
          { text: `（${target} 撐過了你的攻勢、反手把你壓在牆上。）` },
          { speaker: target, text: `⋯⋯你瘋了？我們有什麼仇？`, color: '#888' },
          { text: '（你沒回答、爬起來、走了。）' },
          { speaker: '赫克特', text: '⋯⋯連個雜兵都搞不定？滾。', color: '#9a5a3a' },
          { text: '（赫克特之後再也不正眼看你。）', color: '#aa6666' },
        ];
        if (typeof DialogueModal !== 'undefined') DialogueModal.play(failLines);
        if (typeof teammates !== 'undefined' && teammates.modAffection) {
          teammates.modAffection('hector', -15);
        }
        Flags.set('hector_trial_failed', true);
        _log('✦ 赫克特試煉戰敗、赫克特 -15。', '#aa5050', true);
      };
      Battle.startFromConfig({
        title: '赫克特試煉',
        fameReward: 0,
        enemies: [targetCfg],
        allies: [],
      }, onWin, onLose);
    };

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, { onComplete: startBattle });
    } else {
      startBattle();
    }
  }

  function _hectorTrialPostBattle(mode, target) {
    if (mode === 'half') {
      const lines = [
        { text: `（你揍倒 ${target}、停手。沒下重手、沒讓他斷骨。）` },
        { text: `（${target} 倒在地上喘、看著你、不講話。）` },
        { text: '⋯⋯', color: '#666' },
        { text: '（隔天早上。）' },
        { speaker: '赫克特', text: '⋯⋯聽說你打了。但他能走路。', color: '#9a5a3a' },
        { speaker: '赫克特', text: '⋯⋯不算數。' },
        { speaker: '赫克特', text: '⋯⋯算了。你還是我的人。但下次、別再手軟。' },
        { text: '（他走了。）' },
        { text: '⋯⋯', color: '#666' },
        { text: `（${target} 之後看你的眼神也變了——是驚訝、不是恨。）`, color: '#aa8855' },
        { text: '（——他知道你手下留情。）', color: '#aa8855' },
      ];
      if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
      if (typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection('hector', 5);
        teammates.modAffection('cassius', 3);   // 卡西烏斯會聽到、欣賞你的克制
      }
      Flags.set('hector_trial_half_completed', true);
      _log('✦ 赫克特試煉折衷、兩邊都記下。赫克特 +5、卡西烏斯 +3。', '#aa8855', true);
    } else {
      const lines = [
        { text: `（你揍 ${target} 揍到他爬不起來。）` },
        { text: '（鼻血、口吐白沫。）' },
        { text: '（你站直、轉身走。）' },
        { text: '⋯⋯', color: '#666' },
        { text: '（隔天早上。）' },
        { speaker: '赫克特', text: '⋯⋯聽說你揍他揍得很狠。', color: '#9a5a3a' },
        { speaker: '赫克特', text: '⋯⋯不錯。你是我的人了。' },
        { text: '（赫克特拍你的肩、笑了。）' },
        { text: '⋯⋯', color: '#666' },
        { text: `（${target} 進了老默的房間。三天後才出來。）`, color: '#888' },
        { text: '（——他看你的眼神是恨。）', color: '#aa6666' },
        { text: '（——卡西烏斯也聽到了。他不會再幫你。）', color: '#aa6666' },
      ];
      if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
      if (typeof teammates !== 'undefined' && teammates.modAffection) {
        teammates.modAffection('hector', 15);
        teammates.modAffection('cassius', -20);
      }
      Flags.set('hector_trial_completed', true);
      _log('✦ 赫克特試煉通過、赫克特 +15、卡西烏斯 -20。', '#aa5555', true);
    }
  }

  function init() {
    if (typeof DayCycle === 'undefined' || typeof DayCycle.onDayStart !== 'function') return;

    DayCycle.onDayStart('intraEvents', (newDay) => {
      // 🐛 2026-05-11 修：腳本事件日（如 Day 35 2v2 / Day 49 血戰 / Day 60 陰招 / Day 75 公開宴會 / Day 80 領主夜宴 / Day 90 凱德訪）
      //   隨機 intra 事件不要蓋掉、避免 DialogueModal 互搶
      //   症狀：testJump('day34') 睡到 35、tryBully 5% roll 中 → 蓋掉 2v2 戰鬥
      const SCRIPTED_DAYS = [25, 35, 45, 49, 50, 60, 65, 70, 72, 75, 80, 85, 90, 100];
      if (SCRIPTED_DAYS.includes(newDay)) return;

      // 由早到晚試（高優先順序在前）
      if (tryFactionFirstChoice(newDay)) return;
      if (tryHectorTrial(newDay))   return;   // 🆕 派系試煉
      if (tryDetiusArrive(newDay))      return;
      if (tryCorpseHauling(newDay))     return;
      // 🆕 2026-05-09：4 個新場內事件
      if (tryThief(newDay))         return;
      if (tryBully(newDay))         return;
      if (tryFoodShortage(newDay))  return;
      if (tryDocDrunk(newDay))      return;
      // 🆕 2026-05-09 第二批：詐賭 / 舊書 / 共夢
      if (tryBet(newDay))           return;
      if (tryLibraryBook(newDay))   return;
      if (tryDream(newDay))         return;
    }, 55);
  }

  init();

  return {
    init,
    tryFactionFirstChoice,
    tryDetiusArrive,
    tryCorpseHauling,
    tryThief, tryBully, tryDocDrunk, tryFoodShortage,
    tryBet, tryLibraryBook, tryDream,
    tryHectorTrial,
    // debug
    testFaction:  () => _playFactionFirstScene(),
    testDetius:   (day) => _playDetiusArrival(day || 30),
    testCorpse:   () => _playCorpseHauling(),
    testThief:        () => _playThief(),
    testBully:        () => _playBully(),
    testDocDrunk:     () => _playDocDrunk(),
    testFoodShortage: () => _playFoodShortage(),
    testBet:          () => _playBet(),
    testLibraryBook:  (id) => _playLibraryBook(id || 'children_reader'),
    testDream:        (npcId) => _playDream(npcId || 'orlan'),
    testHectorTrial:  () => _playHectorTrial(),
  };
})();
