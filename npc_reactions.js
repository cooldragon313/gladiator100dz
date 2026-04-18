/**
 * npc_reactions.js — NPC reactions to big player choices
 *
 * 在玩家做出重大選擇（Day 5 三人試煉 / Day 60 偷藥 / Day 85 訣別）後，
 * 隔天清晨會有多位 NPC 分別走來表達立場。這不是事件觸發器，而是
 * 讓整個訓練所對玩家選擇的「情緒回聲」——透過 NPC 對白讓世界有反應。
 *
 * 載入順序：orlan_events.js 之後、main.js 之前。
 * 依賴：Flags, Stats
 *
 * API:
 *   NPCReactions.pickDaily(day)
 *     → 回傳 { id, lines, onComplete } 或 null
 *     由 main.js 串進 _pendingDialogues（晨起後播放）。
 */
const NPCReactions = (() => {
  // ══════════════════════════════════════════════════
  // Public: pickDaily — 回傳可 push 到 _pendingDialogues 的物件
  // ══════════════════════════════════════════════════
  function pickDaily(day) {
    // 一次只挑一個反應場景（避免一日塞太多過場）
    return _tryTrialReactions(day)
        || _tryStealingReactions(day)
        || _tryFarewellReactions(day)
        || _tryOrlanMourning(day)
        || null;
  }

  // ══════════════════════════════════════════════════
  // Helpers — 提供給 onComplete 使用
  // ══════════════════════════════════════════════════
  function _aff(npcId, delta) {
    if (typeof teammates !== 'undefined' && typeof teammates.modAffection === 'function') {
      teammates.modAffection(npcId, delta);
    }
  }
  function _log(text, color, flash = false) {
    if (typeof addLog === 'function') addLog(text, color, flash, flash);
  }

  // ══════════════════════════════════════════════════
  // Day 5 三人試煉後的反應
  // ══════════════════════════════════════════════════
  function _tryTrialReactions(day) {
    if (Flags.has('trial_reactions_done')) return null;
    if (day < 6) return null;
    if (!Flags.has('sol_dead') && !Flags.has('sol_survived_trial')) return null;

    Flags.set('trial_reactions_done', true);

    if (Flags.has('sol_dead')) return _buildSolDeadReactions();
    return _buildSolSpareReactions();
  }

  function _buildSolDeadReactions() {
    return {
      id: 'reactions_sol_dead',
      lines: [
        { text: '清晨。訓練場還蒙著一層灰。' },
        { text: '你走進大廳——沒有人看你。' },
        { text: '——或者說，所有人都看了你一眼，然後移開目光。' },
        { speaker: '梅拉塞', text: '……早。' },
        { speaker: '梅拉塞', text: '麵包放這了。' },
        { text: '她沒有像平常那樣多說一句。' },
        { text: '你看見她的眼睛是紅的。' },
        { speaker: '卡西烏斯', text: '我聽說了。長官很滿意。' },
        { speaker: '卡西烏斯', text: '……但我要你記得那孩子的臉。' },
        { speaker: '卡西烏斯', text: '別讓它變得太容易。' },
        { speaker: '奧蘭', text: '……你下手的時候有閉眼嗎？' },
        { speaker: '奧蘭', text: '算了，不要告訴我。' },
        { text: '他把麵包塞到你手裡，轉身走了。' },
        { speaker: '赫克特', text: '做得不錯嘛。' },
        { speaker: '赫克特', text: '我以前還以為你是那種會猶豫的。' },
        { speaker: '赫克特', text: '——看來我看錯了。這是好事。' },
        { text: '他拍了你肩膀。那種感覺像是被蟑螂爬過。' },
      ],
      onComplete: () => {
        _aff('melaKook', -8);
        _aff('cassius', -10);
        _aff('orlan', -15);
        _aff('hector', 12);
        _log('訓練所的空氣比昨天更冷了。', '#8899aa', true);
      },
    };
  }

  function _buildSolSpareReactions() {
    return {
      id: 'reactions_sol_spared',
      lines: [
        { text: '清晨。你醒來時，梅拉塞的食籃放在你枕邊。' },
        { speaker: '梅拉塞', text: '今天多一個饅頭。別問為什麼。' },
        { text: '她沒有多看你，但嘴角稍稍鬆開了一點。' },
        { speaker: '卡西烏斯', text: '長官昨晚臭著臉睡不著。' },
        { speaker: '卡西烏斯', text: '……我喜歡看他那樣。' },
        { speaker: '卡西烏斯', text: '你做得對，孩子。' },
        { speaker: '奧蘭', text: '謝謝你。' },
        { speaker: '奧蘭', text: '謝謝你……沒有變成那種人。' },
        { text: '他說完就低下頭，把自己的半塊麵包推到你面前。' },
        { speaker: '赫克特', text: '軟弱。' },
        { speaker: '赫克特', text: '這裡不是聖殿，是屠場。' },
        { speaker: '赫克特', text: '……不過我會記得你這種人是怎麼死的。' },
      ],
      onComplete: () => {
        _aff('melaKook', 8);
        _aff('cassius', 10);
        _aff('orlan', 15);
        _aff('hector', -10);
        _log('你感到背後有人輕輕拍了你一下。是幾個你不認識的鬥士。', '#d4af37', true);
      },
    };
  }

  // ══════════════════════════════════════════════════
  // 偷藥事件後的反應（事件當日之隔日）
  // ══════════════════════════════════════════════════
  function _tryStealingReactions(day) {
    if (Flags.has('stealing_reactions_done')) return null;
    if (!Flags.has('orlan_stealing_shown')) return null;

    Flags.set('stealing_reactions_done', true);

    if (Flags.has('betrayed_olan'))          return _buildBetrayReactions();
    if (Flags.has('shared_olans_punishment')) return _buildSharedPunishmentReactions();
    if (Flags.has('interceded_for_olan'))    return _buildIntercedeReactions();
    if (Flags.has('olan_crippled'))          return _buildSilenceReactions();
    return null;
  }

  function _buildBetrayReactions() {
    return {
      id: 'reactions_betray',
      lines: [
        { text: '清晨。食堂的空氣是死的。' },
        { text: '沒有人跟你打招呼。' },
        { text: '梅拉塞把食物放在桌上，轉身走了——連你的名字都沒叫。' },
        { speaker: '梅拉塞', text: '……你的麵包。' },
        { text: '是昨天剩下的，冷硬。' },
        { text: '你走到卡西烏斯那桌。他連頭都沒抬。' },
        { speaker: '卡西烏斯', text: '滾。' },
        { speaker: '卡西烏斯', text: '我不跟會把兄弟送上台子的人同桌。' },
        { text: '醫生老默從你身邊經過。' },
        { speaker: '老默', text: '以後你自己來領藥。' },
        { speaker: '老默', text: '我不會再多問一句。' },
        { text: '整個大廳都在等你離開——' },
        { text: '除了一個人。' },
        { speaker: '赫克特', text: '來坐這。' },
        { speaker: '赫克特', text: '我就知道你會是我這一類的人。' },
        { speaker: '赫克特', text: '別管他們。他們不懂往上爬的人長什麼樣。' },
        { text: '赫克特把一碟肉推到你面前。是比較好的那種。' },
        { speaker: '塔倫長官', text: '……聽說你做了對的選擇。' },
        { speaker: '塔倫長官', text: '值得獎勵。' },
      ],
      onComplete: () => {
        _aff('melaKook', -30);
        _aff('cassius', -50);
        _aff('doctorMo', -30);
        _aff('hector', 30);
        _aff('officer', 20);
        Flags.set('isolated_from_brothers', true);
        _log('訓練所裡幾乎沒有人願意跟你對視。', '#663344', true);
      },
    };
  }

  function _buildSharedPunishmentReactions() {
    return {
      id: 'reactions_shared',
      lines: [
        { text: '清晨。你背上的鞭痕還在滲血。' },
        { text: '你被扶起來的時候聽見有人輕聲說了一句話。' },
        { speaker: '梅拉塞', text: '……笨蛋。' },
        { speaker: '梅拉塞', text: '——但湯裡我多放了草藥。喝完。' },
        { speaker: '卡西烏斯', text: '你瘋了。' },
        { speaker: '卡西烏斯', text: '……但我敬你。' },
        { speaker: '卡西烏斯', text: '這裡很久沒有這種人了。' },
        { text: '醫生老默替你換藥時，手的動作特別輕。' },
        { speaker: '老默', text: '三百一十八個。' },
        { speaker: '老默', text: '你是我第一個……想要讓他好起來的。' },
        { speaker: '赫克特', text: '蠢。真蠢。' },
        { speaker: '赫克特', text: '——不過你等著。這種心軟遲早會害死你。' },
      ],
      onComplete: () => {
        _aff('melaKook', 15);
        _aff('cassius', 18);
        _aff('doctorMo', 15);
        _aff('orlan', 10);
        _aff('hector', -8);
        _log('訓練所的幾個兄弟在背後默默點頭。你看見了。', '#d4af37', true);
      },
    };
  }

  function _buildIntercedeReactions() {
    return {
      id: 'reactions_intercede',
      lines: [
        { text: '清晨。你去食堂的時候感覺到不少目光。' },
        { speaker: '梅拉塞', text: '……聽說你去求了主人？' },
        { speaker: '梅拉塞', text: '你是個奇怪的孩子。' },
        { speaker: '卡西烏斯', text: '替他說話是一回事。' },
        { speaker: '卡西烏斯', text: '但你也在主人面前低了頭。' },
        { speaker: '卡西烏斯', text: '……我還在想這對你意味著什麼。' },
        { speaker: '老默', text: '他的傷沒你想得那麼輕。' },
        { speaker: '老默', text: '十鞭——也夠讓一個人一輩子彎著背。' },
        { speaker: '老默', text: '但是……謝謝你。' },
        { speaker: '赫克特', text: '走後門的路子走得倒是熟。' },
        { speaker: '赫克特', text: '下次出事，我要不要也求你？' },
      ],
      onComplete: () => {
        _aff('melaKook', 5);
        _aff('cassius', 3);
        _aff('doctorMo', 10);
        _aff('orlan', 5);
        _aff('hector', -3);
        _log('你聽見奧蘭在背後不知道跟誰說：「他真的去了。」', '#c8a060', true);
      },
    };
  }

  function _buildSilenceReactions() {
    return {
      id: 'reactions_silence',
      lines: [
        { text: '清晨。你的腳還記得昨天被釘在地上的感覺。' },
        { text: '你走進食堂，沒有人停下吃飯。' },
        { speaker: '梅拉塞', text: '……麵包。' },
        { text: '她把盤子放下。沒有看你。' },
        { speaker: '卡西烏斯', text: '我懂。真的，我懂。' },
        { speaker: '卡西烏斯', text: '……但懂不代表不會讓我看不起你。' },
        { speaker: '老默', text: '他的背永遠直不起來了。' },
        { speaker: '老默', text: '我不怪你。' },
        { speaker: '老默', text: '——我怪的是那個讓你不敢動的地方。' },
        { text: '奧蘭從你身邊經過，沒有停下。' },
        { speaker: '赫克特', text: '你就是這種人嘛。' },
        { speaker: '赫克特', text: '站著看、活下去。沒什麼可恥的。' },
        { speaker: '赫克特', text: '——可恥的是覺得自己還有資格說對錯。' },
      ],
      onComplete: () => {
        _aff('melaKook', -10);
        _aff('cassius', -12);
        _aff('doctorMo', -5);
        _aff('hector', 5);
        _log('你看見奧蘭拖著受傷的背走遠。他沒回頭。', '#8899aa', true);
      },
    };
  }

  // ══════════════════════════════════════════════════
  // Day 85 訣別後的反應（隔日清晨）
  // ══════════════════════════════════════════════════
  function _tryFarewellReactions(day) {
    if (Flags.has('farewell_reactions_done')) return null;
    if (!Flags.has('orlan_farewell_shown')) return null;

    // 告發路線不播這組（反正奧蘭已經死了）
    if (Flags.has('betrayed_olan')) {
      Flags.set('farewell_reactions_done', true);
      return null;
    }

    Flags.set('farewell_reactions_done', true);

    if (Flags.has('orlan_will_fight_beside'))   return _buildFightBesideReactions();
    if (Flags.has('orlan_farewell_rejected'))   return _buildRejectedFarewellReactions();
    if (Flags.has('orlan_farewell_accepted'))   return _buildAcceptedFarewellReactions();
    return null;
  }

  function _buildFightBesideReactions() {
    return {
      id: 'reactions_fight_beside',
      lines: [
        { text: '清晨。離萬骸祭只剩下十幾天。' },
        { text: '訓練所的人知道了——奧蘭要跟你一起上。' },
        { speaker: '梅拉塞', text: '……帶他回來。' },
        { speaker: '梅拉塞', text: '你知道我不是在求你。' },
        { speaker: '梅拉塞', text: '我是在告訴你，我等著你們兩個都回來。' },
        { speaker: '卡西烏斯', text: '如果你們都成不了英雄，那這個地方就沒有英雄了。' },
        { speaker: '卡西烏斯', text: '——活下來。兩個都。' },
        { speaker: '老默', text: '我會把兩人份的藥準備好。' },
        { speaker: '老默', text: '——不是因為我相信你能贏。' },
        { speaker: '老默', text: '是因為我不想把三百一十九個名字再多加一個。' },
        { speaker: '赫克特', text: '帶著一個瘸子上台？' },
        { speaker: '赫克特', text: '……你是真的想死。' },
        { speaker: '赫克特', text: '——不過這畫面我會記得。' },
      ],
      onComplete: () => {
        _aff('melaKook', 10);
        _aff('cassius', 15);
        _aff('doctorMo', 10);
        _aff('hector', -5);
        _log('你發現奧蘭今天的步伐比較穩。他好像睡著過。', '#d4af37', true);
      },
    };
  }

  function _buildAcceptedFarewellReactions() {
    return {
      id: 'reactions_accepted_farewell',
      lines: [
        { text: '清晨。你一個人走進食堂。' },
        { speaker: '梅拉塞', text: '……他昨晚跟我道別了。' },
        { speaker: '梅拉塞', text: '他說謝謝我的湯。' },
        { speaker: '梅拉塞', text: '他以前從來不說謝謝的。' },
        { speaker: '卡西烏斯', text: '他替你去。' },
        { speaker: '卡西烏斯', text: '……這是他給你的最後一份禮物。' },
        { speaker: '卡西烏斯', text: '別糟蹋它。' },
        { speaker: '老默', text: '他來找過我，討了一些止痛藥。' },
        { speaker: '老默', text: '——我給了他雙倍。' },
        { speaker: '老默', text: '希望他上場時不會太痛。' },
      ],
      onComplete: () => {
        _aff('melaKook', 5);
        _aff('cassius', 3);
        _aff('doctorMo', 5);
        _log('你知道，你的百日不會真的只是你自己的百日。', '#c8a060', true);
      },
    };
  }

  function _buildRejectedFarewellReactions() {
    return {
      id: 'reactions_rejected_farewell',
      lines: [
        { text: '清晨。奧蘭被送走了。' },
        { text: '你拒絕了他代出戰——他被當成普通鬥士分配去別的場次。' },
        { speaker: '梅拉塞', text: '……他走之前沒有吃東西。' },
        { speaker: '梅拉塞', text: '我做了他最愛的那種粥。' },
        { speaker: '梅拉塞', text: '——結果放涼了。' },
        { speaker: '卡西烏斯', text: '你做得對。' },
        { speaker: '卡西烏斯', text: '……你真的覺得你做得對嗎？' },
        { speaker: '老默', text: '他臨走前問我要藥。' },
        { speaker: '老默', text: '——我給了。' },
        { speaker: '老默', text: '希望你不用再見到他。' },
      ],
      onComplete: () => {
        _aff('melaKook', -8);
        _aff('cassius', -5);
        _aff('doctorMo', -5);
        _log('你一整天都沒聽到奧蘭那雙拖鞋的聲音。', '#8899aa', true);
      },
    };
  }

  // ══════════════════════════════════════════════════
  // 奧蘭死後的哀悼序列（+1 / +4 / +10 天）
  // ══════════════════════════════════════════════════
  function _tryOrlanMourning(day) {
    if (!Flags.has('orlan_dead')) return null;
    const deathDay = Flags.get('orlan_died_day');
    if (typeof deathDay !== 'number') return null;
    const delta = day - deathDay;

    // 第 1 天（隔日）：第一波震盪
    if (delta >= 1 && !Flags.has('mourn1_done')) {
      Flags.set('mourn1_done', true);
      return Flags.has('betrayed_olan') ? _buildMournBetray1() : _buildMournDay1();
    }
    // 第 4 天：梅拉塞失去慣性
    if (delta >= 4 && !Flags.has('mourn4_done')) {
      Flags.set('mourn4_done', true);
      return _buildMournDay4();
    }
    // 第 10 天：老默把舊筆記給你
    if (delta >= 10 && !Flags.has('mourn10_done')) {
      Flags.set('mourn10_done', true);
      return _buildMournDay10();
    }
    return null;
  }

  function _buildMournDay1() {
    return {
      id: 'mourn_d1',
      lines: [
        { text: '清晨。你醒來時沒聽見他的呼吸聲。' },
        { text: '沒有。再也沒有了。' },
        { text: '食堂裡沒有人跟你說話。所有人都知道——他代你走了。' },
        { speaker: '梅拉塞', text: '……孩子。' },
        { speaker: '梅拉塞', text: '坐下吃東西。' },
        { speaker: '梅拉塞', text: '他昨天早上喝完了我煮的湯。' },
        { speaker: '梅拉塞', text: '他說——好。' },
        { text: '她轉身進廚房，很久沒出來。' },
        { speaker: '卡西烏斯', text: '他選了你。' },
        { speaker: '卡西烏斯', text: '你現在欠他的不是眼淚——是繼續走下去。' },
        { speaker: '老默', text: '我前幾天給他雙倍的止痛藥。' },
        { speaker: '老默', text: '……希望他上場時不會太痛。' },
        { speaker: '老默', text: '希望。' },
        { text: '你一整天都沒說話。晚上你把他床位上的毯子疊好——跟平常一樣的折法。' },
      ],
      onComplete: () => {
        Stats.modVital('mood', -25);
        _aff('melaKook', 5);
        _aff('cassius', 5);
        _aff('doctorMo', 5);
        _log('你好像永遠聽得見他那雙拖鞋的聲音。', '#8899aa', true);
      },
    };
  }

  function _buildMournBetray1() {
    return {
      id: 'mourn_betray_d1',
      lines: [
        { text: '清晨。訓練所裡沒有人跟你說早。' },
        { text: '他們知道昨晚的事。' },
        { text: '——奧蘭是因為你才上的處決台。' },
        { speaker: '梅拉塞', text: '……你的麵包。' },
        { text: '她放下盤子就走了。從那天起她再也沒叫過你的名字。' },
        { speaker: '卡西烏斯', text: '……' },
        { text: '他經過你身邊，沒停下。' },
        { speaker: '老默', text: '以後你的藥自己來領。' },
        { speaker: '老默', text: '——我不會再多說一個字。' },
        { speaker: '赫克特', text: '別理他們。' },
        { speaker: '赫克特', text: '你做的是聰明人的選擇。' },
        { speaker: '赫克特', text: '往上爬的人，從來都不回頭。' },
        { text: '他的手搭到你肩上。那重量你抖不掉。' },
      ],
      onComplete: () => {
        Stats.modVital('mood', -30);
        _aff('melaKook', -10);
        _aff('cassius', -15);
        _aff('doctorMo', -10);
        _aff('hector', 8);
        _log('訓練所從今以後不屬於你了。你只是還活在裡面。', '#663344', true);
      },
    };
  }

  function _buildMournDay4() {
    return {
      id: 'mourn_d4',
      lines: [
        { text: '第四天。你去食堂吃早餐。' },
        { text: '——食堂的鍋裡沒湯。' },
        { text: '梅拉塞站在灶台前很久，手裡拿著木勺。' },
        { speaker: '梅拉塞', text: '……抱歉。' },
        { speaker: '梅拉塞', text: '我每天煮兩人份，煮了快一年。' },
        { speaker: '梅拉塞', text: '今天起我得學會煮一人份了。' },
        { text: '她的手在抖。' },
        { text: '她給你一個麵包——還是熱的。' },
        { speaker: '梅拉塞', text: '這個是給你的。' },
        { speaker: '梅拉塞', text: '……他那份我就不做了。' },
        { text: '你接過麵包。那塊麵包沉得不像麵包。' },
      ],
      onComplete: () => {
        Stats.modVital('mood', -10);
        _aff('melaKook', 8);
        _log('你發現自己在找他的位置——然後想起那裡已經沒人了。', '#8899aa', true);
      },
    };
  }

  function _buildMournDay10() {
    return {
      id: 'mourn_d10',
      lines: [
        { text: '十天了。你以為你已經習慣了。' },
        { text: '晚上老默來找你。他手裡拿著一個舊本子。' },
        { speaker: '老默', text: '這是奧蘭以前在藥房幫我時記的。' },
        { speaker: '老默', text: '他字寫得歪，但每一個草藥名都記得很認真。' },
        { text: '他把本子翻開。最後一頁有一行歪歪的字——' },
        { text: '「替我妹妹記住他。她叫伊娜。」' },
        { speaker: '老默', text: '……他大概知道自己會先走。' },
        { speaker: '老默', text: '我把這個交給你。' },
        { speaker: '老默', text: '你比我有機會見到他妹妹。' },
        { text: '老默把本子放在你手心。離開前他拍了你肩膀一下——很輕。' },
      ],
      onComplete: () => {
        _aff('doctorMo', 15);
        Stats.modVital('mood', 10);
        Flags.set('has_orlan_notebook', true);
        Flags.set('olan_sister_truth_known', true);   // 奇蹟殘局結局條件
        _log('你把本子收好。你不知道這會不會送得到。但你會帶著它走。', '#d4af37', true);
      },
    };
  }

  // ══════════════════════════════════════════════════
  // Public API
  // ══════════════════════════════════════════════════
  return {
    pickDaily,
  };
})();
