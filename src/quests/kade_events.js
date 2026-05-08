/**
 * kade_events.js — 凱德主線（P1C 系列）
 *
 * 設計：[docs/quests/arena-events-roster.md § 6.3](../../docs/quests/arena-events-roster.md)
 *       [docs/characters/kade.md](../../docs/characters/kade.md)
 *
 * 5 個出場節點（Day 100 已實作於 wanguji.js）:
 *   - Day 25 春季大會 — 面熟 #1（模糊識覺）
 *   - Day 49 血戰宴會 — 面熟 #2（持續、視線擦過）
 *   - Day 70 四強選拔 — 面熟 #3（對視、暗示）
 *   - Day 80 領主夜宴 — 相認爆發點（觸發詞「小弟」）
 *   - Day 90 凱德夜訪 — 決定故意輸（核心悲劇場景）
 *   - Day 100 萬骸祭 Wave 5 — wanguji.js _onKadeFalls()
 *
 * 觸發：DayCycle.onDayStart 統一掛鉤
 * 整合：Day 80 串接於 lord_events.js _tryDay80Banquet 的後續（領主夜宴瓦倫戲後）
 *
 * 依賴：DialogueModal / Flags / Stats / teammates / Moral
 */
const KadeEvents = (() => {

  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    }
  }

  function _isFarmboy() {
    const p = Stats.player;
    return p && p.origin === 'farmBoy';
  }

  // ══════════════════════════════════════════════════
  // Day 25 — 春季大會（面熟 #1 · 模糊）
  // ══════════════════════════════════════════════════
  function _tryDay25() {
    const p = Stats.player;
    if (!p || p.day !== 25) return false;
    if (Flags.has('kade_first_glimpse_d25')) return false;
    Flags.set('kade_first_glimpse_d25', true);

    const lines = [
      { text: '（你跟著阿圖斯一行人走進大廣場。）' },
      { text: '（人很多。鼓聲很響。觀眾席擠滿了人。）' },
      { speaker: '阿圖斯', text: '⋯⋯抬頭。看到那個披深色斗篷的沒？' },
      { text: '（你抬頭。）' },
      { text: '（他指的是主席台旁邊一個男人。深褐色斗篷、單獨站著、沒跟其他選手扎堆。）' },
      { speaker: '阿圖斯', text: '⋯⋯那是「無名者」。' },
      { speaker: '阿圖斯', text: '30 連勝零敗。城裡的傳奇。' },
      { speaker: '阿圖斯', text: '⋯⋯給我看清楚。那種人才叫角鬥士。' },
      { text: '（你看著那個身影。）' },
      { text: '（——他正好抬頭、視線越過人群、停在你身上一秒。）' },
      { text: '（——然後又移開。）' },
      { text: '⋯⋯' },
    ];

    // 農家 origin 多兩句模糊識覺
    if (_isFarmboy()) {
      lines.push({ text: '（他的臉⋯⋯）' });
      lines.push({ text: '（——你皺眉。）' });
      lines.push({ text: '（——你覺得有點熟、但你不知道為什麼。）', color: '#888' });
      lines.push({ text: '（你被擄走之後、家鄉的事都模糊了。）' });
      lines.push({ text: '（也許只是長得像某個人吧。）' });
    } else {
      lines.push({ text: '（他散發出一種你說不上來的氣場。）' });
      lines.push({ text: '（——讓你不敢直視太久。）' });
    }

    lines.push({ speaker: '阿圖斯', text: '⋯⋯走、別站著看。' });
    lines.push({ text: '（你跟上。）' });
    lines.push({ text: '（但那個身影、留在你腦袋角落。）' });

    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    return true;
  }

  // ══════════════════════════════════════════════════
  // Day 49 — 血戰宴會（面熟 #2 · 持續）
  // ══════════════════════════════════════════════════
  function _tryDay49() {
    const p = Stats.player;
    if (!p || p.day !== 49) return false;
    if (Flags.has('kade_second_glimpse_d49')) return false;
    if (!Flags.has('kade_first_glimpse_d25')) return false;   // 必先見過 Day 25
    Flags.set('kade_second_glimpse_d49', true);

    const lines = [
      { text: '（宴會。煙霧、酒香、男人的笑聲。）' },
      { text: '（你端著酒壺、繞著桌子走。）' },
      { text: '（阿圖斯坐主位、跟蓋烏斯談。）' },
      { text: '（你倒到第三輪、抬頭。）' },
      { text: '（——你看到他了。）', color: '#aa7755' },
      { text: '（他在另一桌、跟一個老主人坐著。沒講話、慢慢喝酒。）' },
      { text: '（你站在原地、酒壺半傾。）' },
      { text: '⋯⋯' },
    ];

    if (_isFarmboy()) {
      lines.push({ text: '（——又是他。）' });
      lines.push({ text: '（春季大會那個。）' });
      lines.push({ text: '（你的手在抖、酒差點灑出來。）', color: '#888' });
    } else {
      lines.push({ text: '（——「無名者」。）' });
      lines.push({ text: '（你聽過他的名字、但今天才這麼近看到。）' });
    }

    lines.push({ text: '（他抬頭、看了你一眼。）' });
    lines.push({ text: '（——這次比較久。三秒、四秒？）' });
    lines.push({ text: '（——他的眉毛動了一下。）', color: '#aa7755' });
    lines.push({ text: '（——但他沒站起來、沒講話。）' });
    lines.push({ text: '（——他低頭、繼續喝酒。）' });
    lines.push({ speaker: '阿圖斯', text: '⋯⋯酒。' });
    lines.push({ text: '（你回神、繼續倒。）' });
    lines.push({ text: '（離開那桌時、你忍不住又看了一眼。）' });
    lines.push({ text: '（——他正在看你。）' });
    lines.push({ text: '（——你們的眼神對到。）' });
    lines.push({ text: '（——他別過頭。）' });
    lines.push({ text: '⋯⋯' });
    lines.push({ text: '（你跟著阿圖斯回到隊伍。）' });
    lines.push({ text: '（一整晚、你都不太敢看那個方向。）' });
    if (_isFarmboy()) {
      lines.push({ text: '（但你的胃在翻。）', color: '#aa7755' });
    }

    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    return true;
  }

  // ══════════════════════════════════════════════════
  // Day 70 — 四強選拔（面熟 #3 · 對視）
  // ══════════════════════════════════════════════════
  function _tryDay70() {
    const p = Stats.player;
    if (!p || p.day !== 70) return false;
    if (Flags.has('kade_third_glimpse_d70')) return false;
    Flags.set('kade_third_glimpse_d70', true);
    Flags.set('kade_recognition_imminent', true);

    const lines = [
      { text: '（四強決賽結束。「無名者」舉劍、觀眾爆。）' },
      { text: '（你站在阿圖斯隊伍旁、看著他走下沙地。）' },
      { text: '（他卸甲、把劍交給隨從、朝出口走。）' },
      { text: '（剛好——剛好——他要從你這邊出去。）' },
      { text: '（你站直、低頭。）' },
      { text: '（你不敢看他。）' },
      { text: '（他走過你身邊。）' },
      { text: '（停了一秒。）' },
      { text: '⋯⋯' },
      { text: '（——他的腳步聲停了。）', color: '#aa7755' },
      { text: '（——他在看你。你能感覺到。）' },
      { text: '（你抬頭。）' },
      { text: '（凱德——「無名者」——站在離你三步遠的地方。）' },
      { text: '（汗、血、塵土。眼睛是疲憊的。）' },
      { text: '（他張了一下嘴。要說什麼。）' },
      { text: '⋯⋯' },
      { text: '（——但他什麼都沒說。）' },
      { text: '（他點了一下頭。極輕。像是跟自己確認某件事。）', color: '#d4af37' },
      { text: '（然後走了。）' },
      { text: '（你站在原地、心臟很快。）' },
      { speaker: '阿圖斯', text: '⋯⋯動什麼？跟上。' },
      { text: '（你跟上。但你知道——）' },
    ];

    if (_isFarmboy()) {
      lines.push({ text: '（——他認得你。）', color: '#aa5050' });
      lines.push({ text: '（——他在等什麼。）', color: '#aa5050' });
    } else {
      lines.push({ text: '（——他剛剛在看你的眼神、你看不懂。）' });
      lines.push({ text: '（——但他似乎知道你是誰。）' });
    }

    if (typeof DialogueModal !== 'undefined') DialogueModal.play(lines);
    return true;
  }

  // ══════════════════════════════════════════════════
  // Day 80 — 領主夜宴 · 相認（爆發點）
  // ══════════════════════════════════════════════════
  // 此事件由 lord_events.js _tryDay80Banquet 結束後觸發
  // （瓦倫演戲完、玩家確認復仇之後、繼續倒酒走到凱德那桌）
  // 條件：農家 origin（非農家不會被叫「小弟」、走簡化版）+ 已見過 Day 70
  // ══════════════════════════════════════════════════
  function tryDay80Recognition() {
    const p = Stats.player;
    if (!p) return false;
    if (Flags.has('kade_recognized')) return false;
    if (p.day < 80) return false;

    // 必須已經到了 Day 80 領主夜宴出席的玩家
    if (!Flags.has('lord_banquet_d80_done')) return false;

    if (_isFarmboy()) {
      _playDay80FarmboyRecognition();
    } else {
      _playDay80GenericRecognition();
    }
    Flags.set('kade_recognized', true);
    return true;
  }

  function _playDay80FarmboyRecognition() {
    const lines = [
      { text: '（瓦倫演完戲、回主人廳側邊站好。眾人繼續喝酒。）' },
      { text: '（你也繼續倒酒。但你的手在抖。）' },
      { text: '（——提圖斯是兇手。）' },
      { text: '（——你今晚必須裝作什麼都沒看到。）' },
      { text: '（你倒到主人廳深處的一桌。沒抬頭。）' },
      { speaker: '凱德', text: '⋯⋯小弟。', color: '#d4af37' },
      { text: '（你的手停了。）', effect: 'shake' },
      { text: '（你抬頭。）' },
      { text: '（凱德坐在那桌。獨自坐著、沒帶隨從、沒人跟他講話。）' },
      { text: '（他在看你。）' },
      { text: '⋯⋯' },
      { text: '（——「小弟」。）', color: '#d4af37' },
      { text: '（——這個詞你十年沒聽過了。）' },
      { text: '（——只有家鄉那邊的人才這樣叫。）' },
      { text: '（——只有他這樣叫過你。）' },
      { text: '（——凱哥？？？）', color: '#aa5050', effect: 'shake' },
      { speaker: '凱德', text: '⋯⋯跟我來一下。' },
      { text: '（他放下酒杯、慢慢站起來、走向廁所方向。）' },
      { text: '（沒人注意。所有人都在聽阿圖斯講話。）' },
      { text: '（你跟著走。）' },
      { text: '（兩人退到柱子後面。）' },
      { text: '⋯⋯' },
      { speaker: '凱德', text: '⋯⋯你怎麼會在這裡？' },
      { text: '（你的喉嚨乾的。）' },
      { speaker: '玩家', text: '⋯⋯凱哥？' },
      { speaker: '凱德', text: '⋯⋯是你⋯⋯' },
      { text: '（他閉了一下眼。）' },
      { speaker: '凱德', text: '⋯⋯我以為我認錯人了。從春季大會就一直⋯⋯' },
      { text: '（他沒說完。）' },
      { speaker: '凱德', text: '⋯⋯你怎麼會被擄到這城裡？' },
      { text: '（你看著他。）' },
      { text: '（你想了一下要不要講。）' },
      { text: '（——你決定講。）' },
      { speaker: '玩家', text: '⋯⋯我們村被滅了。' },
      { text: '（凱德的臉色變了。）', color: '#aa5050' },
      { speaker: '凱德', text: '⋯⋯什麼？' },
      { speaker: '玩家', text: '⋯⋯就在幾個月前。我躲過了。被抓來這裡。' },
      { speaker: '凱德', text: '⋯⋯你騙我。' },
      { speaker: '玩家', text: '⋯⋯我親眼看到的。' },
      { speaker: '玩家', text: '⋯⋯媽媽⋯⋯' },
      { text: '（你講不下去。）' },
      { text: '（凱德沒講話。臉色慢慢變白。）' },
      { text: '（他扶著柱子。）' },
      { text: '⋯⋯' },
      { speaker: '凱德', text: '⋯⋯我以前每月寄錢回去。' },
      { speaker: '凱德', text: '⋯⋯我主人說都有寄到。' },
      { speaker: '凱德', text: '⋯⋯說我家人都好。' },
      { text: '（你低頭。沒講話。）' },
      { speaker: '凱德', text: '⋯⋯都是假的。', color: '#aa5050' },
      { speaker: '凱德', text: '⋯⋯這幾年⋯⋯都是假的。' },
      { text: '⋯⋯' },
      { text: '（他別過頭、深深吸一口氣。）' },
      { text: '（你看到他的肩膀在抖。但他沒哭。）' },
      { text: '（——他不是會哭的人。但你能看出。）' },
      { speaker: '凱德', text: '⋯⋯村裡⋯⋯誰還活著？' },
      { speaker: '玩家', text: '⋯⋯我不知道。我只知道⋯⋯' },
      { text: '（你猶豫了一下。）' },
      { speaker: '玩家', text: '⋯⋯只知道滅村的人不是敵國軍。' },
      { speaker: '凱德', text: '⋯⋯什麼？' },
      { speaker: '玩家', text: '⋯⋯是這城的領主。提圖斯。' },
      { speaker: '玩家', text: '⋯⋯他剛剛在那廳裡演戲說自己「救了村民」。' },
      { text: '（凱德的眼睛瞇了一下。）' },
      { text: '（沉默了很久。）' },
      { speaker: '凱德', text: '⋯⋯' },
      { speaker: '凱德', text: '⋯⋯我知道了。' },
      { speaker: '凱德', text: '⋯⋯回去吧。別讓人發現我們講話。' },
      { text: '（他從柱子後走出去、回他那桌。坐下、繼續喝酒、像什麼都沒發生。）' },
      { text: '（你也回去倒酒。手還在抖。）' },
      { text: '（——但你知道。）' },
      { text: '（——他知道了。）' },
      { text: '（——他會做點什麼。但你不知道是什麼。）', color: '#d4af37' },
    ];

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => {
          Flags.set('kade_truth_known', true);
          Flags.set('kade_called_player_xiaodi', true);
          if (typeof teammates !== 'undefined') teammates.modAffection('kade', 30);
          _log('✦ 凱哥認出你了。他知道家鄉的真相了。', '#d4af37', true);
        },
      });
    }
  }

  function _playDay80GenericRecognition() {
    // 非農家：簡化版、凱德只是「同情角鬥士」
    const lines = [
      { text: '（你倒酒到「無名者」那桌。他抬頭。）' },
      { speaker: '凱德', text: '⋯⋯你也是阿圖斯家的？' },
      { text: '（你點頭。）' },
      { speaker: '凱德', text: '⋯⋯保重。在這城裡活下去。' },
      { text: '（他舉杯、跟自己乾。沒再講話。）' },
      { text: '（你繼續倒酒。但他那一句話、你會記住。）' },
    ];
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => {
          if (typeof teammates !== 'undefined') teammates.modAffection('kade', 10);
          _log('✦ 「無名者」對你點了頭。', '#888', false);
        },
      });
    }
  }

  // ══════════════════════════════════════════════════
  // 🆕 2026-05-09 Day 85 — 凱德消化（酒館偶遇、補 80→90 空檔）
  // ══════════════════════════════════════════════════
  // 條件：kade_truth_known + Day 85
  // 場景：玩家被派出去跑腿、路過酒館、看到凱德獨自買醉
  // 設計用意：消化期、玩家親眼看他崩到底、為 Day 90 「把命給你用」鋪情緒
  function _tryDay85() {
    const p = Stats.player;
    if (!p || p.day !== 85) return false;
    if (Flags.has('kade_processing_d85')) return false;
    if (!Flags.has('kade_truth_known')) return false;
    Flags.set('kade_processing_d85', true);
    _playDay85();
    return true;
  }

  function _playDay85() {
    const lines = [
      { text: '（午後。阿圖斯派你出門領一批東西。）' },
      { text: '（你經過城南那條老巷的時候、聞到濃酒味。）' },
      { text: '（巷口酒館——你停了一秒。）' },
      { text: '（往裡看了一眼。）' },
      { text: '⋯⋯' },
      { text: '（——他在那。）', color: '#aa7755' },
      { text: '（凱德坐在最裡邊的角落、桌上四個空酒壺、第五個半空。）' },
      { text: '（他穿便裝、沒帶劍、頭髮亂的。）' },
      { text: '（他看到你了。但他沒打招呼。）' },
      { text: '（你猶豫了一下、走進去、坐他對面。）' },
      { text: '⋯⋯', color: '#666' },
      { speaker: '凱德', text: '⋯⋯小弟、走吧。', color: '#d4af37' },
      { speaker: '凱德', text: '⋯⋯這個地方不適合你。' },
      { speaker: '玩家', text: '⋯⋯' },
      { text: '（你沒走。）' },
      { text: '（凱德苦笑了一下、把酒壺推給你。）' },
      { speaker: '凱德', text: '⋯⋯你不喝？我也不勉強。', color: '#d4af37' },
      { text: '（他自己又灌了一口。）' },
      { text: '⋯⋯', color: '#666' },
      { speaker: '凱德', text: '⋯⋯我這幾天想了很多事。', color: '#d4af37' },
      { speaker: '凱德', text: '⋯⋯我家鄉那條河。' },
      { speaker: '凱德', text: '⋯⋯小時候我跟你爸去釣魚。' },
      { speaker: '凱德', text: '⋯⋯你爸還在嗎？' },
      { speaker: '玩家', text: '⋯⋯我不知道。被擄那天⋯⋯沒看到他。' },
      { text: '（凱德點點頭。沒講話。）' },
      { text: '（他喝了一口酒、看著桌面。）' },
      { text: '⋯⋯', color: '#666' },
      { speaker: '凱德', text: '⋯⋯你知道嗎、小弟。', color: '#d4af37' },
      { speaker: '凱德', text: '⋯⋯我這個自由人、有什麼意思？' },
      { speaker: '凱德', text: '⋯⋯沒地方回。沒人等。沒事可做。' },
      { speaker: '凱德', text: '⋯⋯我以前以為打贏 30 場就能離開。' },
      { speaker: '凱德', text: '⋯⋯打贏了。沒走。為什麼？' },
      { speaker: '凱德', text: '⋯⋯因為我不知道走去哪。' },
      { text: '（他又喝。酒從嘴角流下來、他沒擦。）' },
      { text: '⋯⋯', color: '#666' },
      { speaker: '凱德', text: '⋯⋯我寄回去的錢。', color: '#aa5050' },
      { speaker: '凱德', text: '⋯⋯這些年的錢。' },
      { speaker: '凱德', text: '⋯⋯都進了那個王八的口袋。' },
      { speaker: '凱德', text: '⋯⋯說是寄了、其實沒寄。' },
      { speaker: '凱德', text: '⋯⋯我去問他、他說「你母親早死了、你寄了也是浪費」。' },
      { text: '（他停了。）' },
      { speaker: '凱德', text: '⋯⋯他連我媽什麼時候死的都不肯講。', color: '#aa5050' },
      { speaker: '凱德', text: '⋯⋯我五年沒回家。我什麼都不知道。' },
      { text: '⋯⋯', color: '#666' },
      { text: '（你看著他。不知道要說什麼。）' },
      { text: '（凱德抬頭看你、眼神是濕的、但沒掉淚。）' },
      { speaker: '凱德', text: '⋯⋯小弟。', color: '#d4af37' },
      { speaker: '凱德', text: '⋯⋯你還年輕。你還能做事。' },
      { speaker: '凱德', text: '⋯⋯我不一樣。' },
      { speaker: '凱德', text: '⋯⋯我這把骨頭、做不了別的了。' },
      { text: '（他低頭、又喝了一口。）' },
      { speaker: '凱德', text: '⋯⋯走吧。我自己再坐一下。' },
      { text: '（你猶豫。）' },
      { speaker: '玩家', text: '⋯⋯凱哥⋯⋯' },
      { speaker: '凱德', text: '⋯⋯走。', color: '#d4af37' },
      { text: '（你站起來。慢慢走出酒館。）' },
      { text: '⋯⋯', color: '#666' },
      { text: '（你回頭看了一眼——）' },
      { text: '（——凱德沒抬頭。他在跟自己的酒壺講話。）', color: '#888' },
      { text: '（你聽不到他在說什麼。）', color: '#888' },
      { text: '⋯⋯', color: '#666' },
      { text: '（你走出巷子、繼續去領東西。）' },
      { text: '（——他要做什麼、你心裡有預感了。）', color: '#aa5050' },
      { text: '（——但你阻止不了他。）', color: '#aa5050' },
    ];

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => {
          if (typeof teammates !== 'undefined' && teammates.modAffection) {
            teammates.modAffection('kade', 10);
          }
          if (typeof Stats !== 'undefined' && Stats.modVital) {
            Stats.modVital('mood', -10);   // 看他這樣很沉重
          }
          if (typeof Moral !== 'undefined' && Moral.push) {
            Moral.push('mercy', 'positive');
          }
          _log('✦ 你看到凱哥在城南酒館買醉、聽他講家鄉。心情 -10、凱德 +10。', '#aa8855', true);
        },
      });
    }
  }

  // ══════════════════════════════════════════════════
  // Day 90 — 凱德夜訪（決定故意輸、核心悲劇）
  // ══════════════════════════════════════════════════
  // 條件：已相認（kade_truth_known）+ Day ≥ 90
  // 結果：設 kade_will_throw_fight + 強化大反撲入口情緒
  // ══════════════════════════════════════════════════
  function _tryDay90() {
    const p = Stats.player;
    if (!p || p.day !== 90) return false;
    if (Flags.has('kade_visited_player_d90')) return false;
    if (!Flags.has('kade_truth_known')) return false;
    Flags.set('kade_visited_player_d90', true);

    _playDay90Visit();
    return true;
  }

  function _playDay90Visit() {
    const lines = [
      { text: '（夜深。你睡不著、躺著看天花板。）' },
      { text: '（——窸窣。）' },
      { text: '（圍牆那邊有聲音。）' },
      { text: '（你坐起來。）' },
      { text: '（一個身影翻過圍牆、輕輕落地、走向你的房間。）' },
      { text: '（你伸手摸床邊那把訓練劍。）' },
      { text: '⋯⋯' },
      { speaker: '凱德', text: '⋯⋯小弟、是我。', color: '#d4af37' },
      { text: '（你放下劍。）' },
      { text: '（凱德走進來、坐在你床邊的木凳上。）' },
      { text: '（房間很暗。月光從窗縫透進一條。）' },
      { text: '（他坐了很久才講話。）' },
      { text: '⋯⋯' },
      { speaker: '凱德', text: '⋯⋯睡了沒？' },
      { speaker: '玩家', text: '⋯⋯沒。' },
      { speaker: '凱德', text: '⋯⋯我想了五天了。' },
      { speaker: '凱德', text: '⋯⋯沒睡好。' },
      { speaker: '凱德', text: '我每晚都喝、喝不醉。' },
      { text: '（沉默。）' },
      { speaker: '凱德', text: '⋯⋯你知道嗎、小弟。' },
      { speaker: '凱德', text: '⋯⋯我自由人有什麼用？' },
      { text: '（你沒回答。）' },
      { speaker: '凱德', text: '我除了打架什麼都不會。' },
      { speaker: '凱德', text: '⋯⋯不會種田、不會做生意、不會當官。' },
      { speaker: '凱德', text: '我這幾年想過、賺夠錢就回家蓋大房子。' },
      { speaker: '凱德', text: '⋯⋯找個老婆。' },
      { speaker: '凱德', text: '⋯⋯讓我媽不用再幫人洗衣服。' },
      { text: '（他停了。）' },
      { speaker: '凱德', text: '⋯⋯我媽死了。', color: '#aa5050' },
      { speaker: '凱德', text: '⋯⋯我家被燒了。' },
      { speaker: '凱德', text: '⋯⋯我這幾年寄回去的錢、全在養那個騙我的主人的小老婆。' },
      { text: '（沉默。月光照在他臉上。看得出他沒哭、但眼睛是紅的。）' },
      { text: '⋯⋯' },
      { speaker: '凱德', text: '⋯⋯我有想過。' },
      { speaker: '凱德', text: '⋯⋯去殺我主人。' },
      { speaker: '凱德', text: '⋯⋯然後跑。' },
      { speaker: '凱德', text: '⋯⋯但我跑去哪？' },
      { speaker: '凱德', text: '⋯⋯沒地方去。' },
      { text: '⋯⋯' },
      { speaker: '凱德', text: '⋯⋯所以我想了五天。' },
      { speaker: '凱德', text: '⋯⋯想到的就是——' },
      { text: '（他抬頭看你。）' },
      { speaker: '凱德', text: '⋯⋯Day 100、你要上場跟我打。', color: '#d4af37' },
      { speaker: '玩家', text: '⋯⋯' },
      { speaker: '凱德', text: '⋯⋯放輕鬆。' },
      { speaker: '凱德', text: '⋯⋯我會給你機會。' },
      { speaker: '玩家', text: '⋯⋯什麼意思？' },
      { speaker: '凱德', text: '⋯⋯領主下來那一刻、看你的。' },
      { speaker: '凱德', text: '⋯⋯我把命給你用。', color: '#d4af37' },
      { speaker: '凱德', text: '⋯⋯別客氣。' },
      { text: '⋯⋯' },
      { speaker: '玩家', text: '⋯⋯凱哥⋯⋯' },
      { text: '（你不知道要說什麼。）' },
      { text: '（凱德笑了一下。苦笑。）' },
      { speaker: '凱德', text: '⋯⋯小弟。' },
      { speaker: '凱德', text: '⋯⋯你別替我難過。' },
      { speaker: '凱德', text: '⋯⋯我這幾年、活得已經夠久了。' },
      { speaker: '凱德', text: '⋯⋯就是不知道為什麼活下來。' },
      { speaker: '凱德', text: '⋯⋯現在知道了。' },
      { text: '（他站起來。）' },
      { speaker: '凱德', text: '⋯⋯你做你該做的。' },
      { speaker: '凱德', text: '⋯⋯我做我能做的。' },
      { speaker: '凱德', text: '⋯⋯就這樣。' },
      { text: '（他走到窗邊。）' },
      { text: '（停了一下。）' },
      { speaker: '凱德', text: '⋯⋯小弟。' },
      { speaker: '凱德', text: '⋯⋯如果你後來活下來——' },
      { speaker: '凱德', text: '⋯⋯記得家鄉那條河。', color: '#d4af37' },
      { speaker: '凱德', text: '⋯⋯記得就好。' },
      { text: '（他翻出窗。沒回頭。）' },
      { text: '⋯⋯' },
      { text: '（你坐在床上。月光照進來。）' },
      { text: '（你不知道現在是什麼感覺。）' },
      { text: '（——感激？難過？憤怒？）' },
      { text: '（——都是。也都不是。）' },
      { text: '（——他要把命給你用。）', color: '#aa5050' },
      { text: '（——你不能讓他白死。）', color: '#aa5050' },
    ];

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => {
          Flags.set('kade_will_throw_fight', true);
          if (typeof teammates !== 'undefined') teammates.modAffection('kade', 30);
          // 推 mercy 軸（玩家收到了大愛）
          if (typeof Moral !== 'undefined' && Moral.push) Moral.push('mercy', 'positive');
          _log('✦ 凱哥決定 Day 100 把命給你用。', '#d4af37', true);
        },
      });
    }
  }

  // ══════════════════════════════════════════════════
  // 初始化：DayCycle 鉤子
  // ══════════════════════════════════════════════════
  function init() {
    if (typeof DayCycle === 'undefined' || typeof DayCycle.onDayStart !== 'function') return;

    DayCycle.onDayStart('kadeMilestones', () => {
      if (_tryDay90()) return;
      if (_tryDay85()) return;   // 🆕 2026-05-09 Day 85 凱德消化
      // Day 80 走 lord_events 後續、不在這邊主動觸發（避免雙重）
      if (_tryDay70()) return;
      if (_tryDay49()) return;
      if (_tryDay25()) return;
    }, 45);   // 一般內容、領主線之後
  }

  init();

  return {
    init,
    // 內部 try* 暴露給 console / 其他模組
    _tryDay25, _tryDay49, _tryDay70, _tryDay85, _tryDay90,
    tryDay80Recognition,   // 公開 — lord_events.js Day 80 結束後呼叫
    // debug
    testDay25:  () => _tryDay25(),
    testDay49:  () => _tryDay49(),
    testDay70:  () => _tryDay70(),
    testDay80:  () => _isFarmboy() ? _playDay80FarmboyRecognition() : _playDay80GenericRecognition(),
    testDay85:  () => _playDay85(),
    testDay90:  () => _playDay90Visit(),
  };
})();
