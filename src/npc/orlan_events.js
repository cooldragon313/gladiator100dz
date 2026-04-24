/**
 * orlan_events.js — 奧蘭主線事件系統（D.20）
 * ══════════════════════════════════════════════════
 * 奧蘭（orlan）是遊戲唯一的「永駐兄弟」NPC：
 *   - 第一天跟主角同一輛車被押進訓練所
 *   - 第 1~30 天同房
 *   - 第 30 天左右因主人賞識升級房間被迫分開
 *   - 第 60 天偷藥被抓的關鍵抉擇
 *   - 第 85 天強制訣別 — 他代你出戰
 *
 * 一般 flavor 與背景對話交由 npc.js 的 storyReveals 處理（5 flavor + 5 event）。
 * 本檔只管「脊椎事件」與「生死關頭援手」這類需要 ChoiceModal / 條件 gate 的部分。
 *
 * 觸發機制：
 *   - Day 30 房間升級：DayCycle.onDayStart + master_aff ≥ 50 + fame ≥ 30
 *   - Day 60 偷藥事件：onDayStart + Day ≥ 60 + flag player_near_death_d60
 *   - Day 85 訣別：onDayStart + Day >= 85
 *   - 生死關頭援手：戰鬥 / 訓練低血時 OrlanEvents.tryDeathSave() 呼叫
 *
 * 依賴：
 *   - ChoiceModal (choice_modal.js)
 *   - teammates (npc.js)
 *   - Flags, Stats, Moral
 */
const OrlanEvents = (() => {

  // ══════════════════════════════════════════════════
  // CLAUDE.md 第 12 條：bare addLog 在外部模組是 ReferenceError
  // 統一走 Game.addLog，fallback typeof addLog 檢查
  // ══════════════════════════════════════════════════
  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    } else {
      console.warn('[OrlanEvents] _log: no addLog available', text);
    }
  }

  // ══════════════════════════════════════════════════
  // 🆕 D.21 helper：先播 DialogueModal 敘述 → 再開啟 ChoiceModal
  // 如果 DialogueModal 不存在就直接開 ChoiceModal（fallback）
  // ══════════════════════════════════════════════════
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

  // ══════════════════════════════════════════════════
  // 房間升級（Day 30+ 條件觸發）
  // ══════════════════════════════════════════════════
  // 條件：master_aff ≥ 50 AND fame ≥ 30 AND 未觸發過 AND day ≥ 30
  // 效果：強制分房、Flag separated_from_olan，之後獨自就寢首三晚 mood -15 + 失眠機率升高
  //
  // pride 特性的玩家：選項「拒絕」會多一段敘述（「我不需要這種特權」）但結果相同
  // （你無法真正拒絕主人的決定，只是情緒反應不同）
  function _tryRoomUpgrade() {
    const p = Stats.player;
    if (!p || p.day < 30) return false;
    if (Flags.has('separated_from_olan')) return false;
    if (Flags.has('orlan_room_upgrade_shown')) return false;
    const masterAff = teammates.getAffection('masterArtus');
    const fame = p.fame || 0;
    if (masterAff < 50 || fame < 30) return false;

    Flags.set('orlan_room_upgrade_shown', true);

    const hasPride = Array.isArray(p.traits) && p.traits.includes('prideful');

    const choices = [
      {
        id:    'accept',
        label: '接受賞賜',
        hint:  '「是，謝謝主人的厚愛。」',
        effects: [
          { type:'flag', key:'separated_from_olan' },
          { type:'affection', key:'masterArtus', delta:5 },
          { type:'moral', axis:'pride', side:'negative' },  // 接受特權算一點驕傲
        ],
        resultLog: '你收拾好行囊走出牢房。奧蘭沒抬頭——只是用指節輕輕敲了敲自己的心口，做出「沒事」的手勢。',
        logColor:  '#c47a6e',
      },
      {
        id:    'refuse',
        label: '試圖拒絕',
        hint:  '「我……不需要獨立房間。」',
        effects: [
          { type:'flag', key:'separated_from_olan' },   // 無論如何都會被強制執行
          { type:'flag', key:'olan_tried_to_refuse' },  // 但這個旗標會改變奧蘭後續的態度
          { type:'affection', key:'masterArtus', delta:-10 },
          { type:'fame', delta:-3 },
          { type:'affection', key:'orlan', delta:20 },
          { type:'moral', axis:'loyalty', side:'positive' },
          { type:'moral', axis:'humble',  side:'positive' },
        ],
        resultLog: '侍從冷笑。「這不是在徵詢你的意見。」一天後你還是被強制搬走——但奧蘭看見了你的嘗試。那晚他塞了一塊比平時大兩倍的麵包到你手裡。',
        logColor:  '#d9a84f',
      },
    ];

    // pride 玩家的額外選項：傲然接受
    if (hasPride) {
      choices.push({
        id:    'proud_accept',
        label: '這是我應得的',
        hint:  '【驕傲】你看也不看奧蘭一眼。',
        effects: [
          { type:'flag', key:'separated_from_olan' },
          { type:'affection', key:'masterArtus', delta:10 },
          { type:'affection', key:'orlan', delta:-25 },
          { type:'moral', axis:'pride', side:'negative', weight:2 },
        ],
        resultLog: '你走出牢房，沒回頭。奧蘭看著你的背影很久。那晚他沒有再塞麵包給你。',
        logColor:  '#8899aa',
      });
    }

    // 🆕 D.21：用 DialogueModal 先演出，再開 ChoiceModal
    const introLines = [
      { text: '一個你不太熟悉的侍從走進來。' },
      { speaker: '侍從', text: '阿圖斯大人吩咐——' },
      { speaker: '侍從', text: '為了表現優異的鬥士，特地安排了獨立房間。' },
      { speaker: '侍從', text: '今晚就遷過去。' },
      { text: '你看向奧蘭。' },
      { text: '他正在整理床鋪。' },
      { text: '他聽見了。' },
      { text: '——但他沒有抬頭。' },
    ];

    _playIntroThenChoice(introLines, {
      id:    'orlan_room_upgrade',
      icon:  '🚪',
      title: '房間升級',
      body:  '你該怎麼回應？',
      forced: true,
      choices,
      logColor: '#d9a84f',
    });
    return true;
  }

  // ══════════════════════════════════════════════════
  // 偷藥事件（Day 60 左右，需要重傷過）
  // ══════════════════════════════════════════════════
  // 條件：Day ≥ 60 AND flag player_was_nearly_dead AND 未觸發過
  // 四選項驅動 reliability 軸（替他分擔 → reliable / 沉默 → coward）
  function _tryStealMedicine() {
    const p = Stats.player;
    if (!p || p.day < 60) return false;
    if (Flags.has('orlan_stealing_shown')) return false;
    if (!Flags.has('player_was_nearly_dead')) return false;

    Flags.set('orlan_stealing_shown', true);

    const hasIronWill = Array.isArray(p.traits) && p.traits.includes('iron_will');

    const choices = [
      {
        id:    'take_blame',
        label: '站出去替他分擔鞭刑',
        hint:  '「那個藥，是我要他拿的。」',
        effects: [
          { type:'vital', key:'hp',   delta:-40 },
          { type:'vital', key:'mood', delta:-10 },
          { type:'affection', key:'orlan',       delta:30 },
          { type:'affection', key:'cassius',     delta:15 },
          { type:'affection', key:'melaKook',    delta:10 },
          { type:'affection', key:'masterArtus', delta:-15 },
          { type:'flag', key:'shared_olans_punishment' },
          { type:'moral', axis:'reliability', side:'positive', weight:3 },
        ],
        resultLog: '你走出去，接下了本該給他的鞭刑。疼痛讓眼前發黑。奧蘭在你耳邊輕聲說了一句話，你沒聽清——但你看見他在哭。',
        logColor:  '#d9a84f',
      },
      {
        id:    'stay_silent',
        label: '沉默站著看',
        hint:  '你的腳動不了。',
        effects: [
          { type:'vital', key:'mood', delta:-30 },
          { type:'affection', key:'orlan',    delta:-40 },
          { type:'affection', key:'cassius',  delta:-10 },
          { type:'affection', key:'melaKook', delta:-15 },
          { type:'flag', key:'guilt_olan' },
          { type:'flag', key:'olan_crippled' },
          { type:'moral', axis:'reliability', side:'negative', weight:3 },
        ],
        resultLog: '你的腳像被釘在地上。鞭聲落下的每一下，你都聽得清清楚楚。奧蘭沒有哭喊——只是最後抬頭看了你一眼。那一眼你會記到死。',
        logColor:  '#8899aa',
      },
      {
        id:    'intercede',
        label: '跑去跟主人求情',
        hint:  '「求大人寬恕，他是為我偷的。」',
        requireAffection: { masterArtus: 30 },
        effects: [
          { type:'affection', key:'masterArtus', delta:-20 },
          { type:'fame',      delta:-5 },
          { type:'affection', key:'orlan',       delta:15 },
          { type:'flag', key:'interceded_for_olan' },
          { type:'moral', axis:'loyalty',     side:'positive' },
          { type:'moral', axis:'reliability', side:'positive' },
        ],
        resultLog: '阿圖斯大人皺起眉。「你倒是會求人。」他揮手讓侍從只打了十鞭——輕罰。奧蘭沒看你，但你知道他記住了這一切。',
        logColor:  '#c8a878',
      },
      {
        id:    'betray',
        label: '【鐵意志】告發奧蘭是為自己而偷',
        hint:  '你用冷靜的眼神看著他。',
        requireTrait: 'iron_will',
        effects: [
          { type:'affection', key:'masterArtus', delta:25 },
          { type:'affection', key:'orlan',       delta:-100 },
          { type:'affection', key:'cassius',     delta:-30 },
          { type:'affection', key:'melaKook',    delta:-40 },
          { type:'flag', key:'betrayed_olan' },
          { type:'moral', axis:'loyalty', side:'negative', weight:3, lock:true },
        ],
        resultLog: '你的聲音很平。「他自己要偷的。別的什麼都沒有。」整個訓練場靜了一瞬。阿圖斯大人的嘴角輕輕上揚——那是讚許。奧蘭的表情你不敢看。',
        logColor:  '#663344',
      },
    ];

    // 🆕 D.21：用 DialogueModal 先演出被抓現場，再開 ChoiceModal
    const introLines = [
      { text: '訓練場中央被侍從押了一個人。' },
      { text: '——是奧蘭。' },
      { text: '他被按在沙地上，頭髮被揪住。' },
      { speaker: '侍從', text: '這個東西，昨晚試圖從主人的藥房偷藥。' },
      { text: '阿圖斯大人從陽台上淡淡地看著。' },
      { text: '奧蘭抬頭看了你一眼——很快地。' },
      { text: '你看見他嘴角的血。' },
      { speaker: '侍從', text: '告訴大家這藥是要給誰的。' },
      { text: '奧蘭搖頭。' },
      { text: '侍從踢了他一腳。' },
      { text: '你感覺到整個訓練場都在看你。' },
      { text: '——你必須做出選擇。' },
    ];

    _playIntroThenChoice(introLines, {
      id:    'orlan_stealing_medicine',
      icon:  '💊',
      title: '奧蘭被抓了',
      body:  '你要怎麼做？',
      forced: true,
      choices,
      logColor: '#d9a84f',
    });
    return true;
  }

  // ══════════════════════════════════════════════════
  // 最終訣別（Day 85 強制）
  // ══════════════════════════════════════════════════
  // 規則：
  //   - fame ≥ 60 且擁有 shared_olans_punishment flag → 自動出現「拒絕他代出戰」選項
  //   - prideful 特性 → 多一個傲然反應選項
  //   - betrayed_olan → 奧蘭不出現，改為「他昨晚被處決」的訊息
  function _tryFarewell() {
    const p = Stats.player;
    if (!p || p.day < 85) return false;
    if (Flags.has('orlan_farewell_shown')) return false;

    Flags.set('orlan_farewell_shown', true);

    // 已告發路線 — 奧蘭不會出現
    if (Flags.has('betrayed_olan')) {
      _log('侍從來通知你：昨晚奧蘭在牢裡被處決了。他沒留下任何話。', '#663344', true);
      // 移除 orlan teammates
      if (typeof teammates !== 'undefined' && teammates.getNPC('orlan')) {
        teammates.getNPC('orlan').alive = false;
      }
      Flags.set('orlan_dead', true);
      Flags.set('orlan_died_day', p.day);
      return true;
    }

    const hasPride = Array.isArray(p.traits) && p.traits.includes('prideful');
    const hasHighFame = (p.fame || 0) >= 60;
    const savedHimBefore = Flags.has('shared_olans_punishment');

    const choices = [
      {
        id:    'accept_tearfully',
        label: '接受他的決定',
        hint:  '「……謝謝你，奧蘭。」',
        effects: [
          { type:'affection', key:'orlan', delta:10 },
          { type:'vital', key:'mood', delta:-20 },
          { type:'flag', key:'orlan_farewell_accepted' },
          { type:'moral', axis:'loyalty', side:'positive' },
        ],
        resultLog: '你點點頭。奧蘭笑了——眼睛先彎起來的那種笑。他伸手拍了拍你的肩。「去吧。別回頭。」',
        logColor:  '#d9a84f',
      },
    ];

    // 高名聲路線：你可以拒絕讓他替你出戰
    if (hasHighFame && savedHimBefore) {
      choices.push({
        id:    'refuse_replacement',
        label: '【名聲】不要，這是我的戰鬥',
        hint:  '「我不會讓別人替我死。」',
        effects: [
          { type:'fame', delta:-10 },       // 破壞契約，名聲略受影響
          { type:'affection', key:'orlan', delta:30 },
          { type:'affection', key:'cassius', delta:10 },
          { type:'flag', key:'orlan_refused_replacement' },
          { type:'flag', key:'orlan_will_fight_beside' },  // 共同出戰條件
          { type:'moral', axis:'reliability', side:'positive', weight:2 },
          { type:'moral', axis:'pride', side:'negative' },  // 這不是驕傲，是責任
        ],
        resultLog: '你搖頭。「奧蘭，我不讓任何人替我死。」他愣住了，張嘴又閉上。很久之後他才說：「……那我們一起走到最後吧。」他的眼眶紅了。',
        logColor:  '#e8d070',
      });
    }

    // pride 特性的額外選項：粗暴拒絕
    if (hasPride) {
      choices.push({
        id:    'arrogant_refuse',
        label: '【驕傲】我不需要你可憐我',
        hint:  '你把手從他肩上撥開。',
        effects: [
          { type:'affection', key:'orlan', delta:-30 },
          { type:'flag', key:'orlan_farewell_rejected' },
          { type:'moral', axis:'pride', side:'negative', weight:2 },
        ],
        resultLog: '你冷冷地看他。「我不需要你可憐我。」奧蘭的臉僵住。他點點頭，沒再說什麼。隔天他還是代你出場了——但這次他沒跟你告別。',
        logColor:  '#8899aa',
      });
    }

    // 🆕 D.21：用 DialogueModal 演出訣別前置，再開 ChoiceModal
    const introLines = [
      { text: '訓練結束後，奧蘭在訓練場等你。' },
      { text: '他站在沙地的邊緣，背對著落日。' },
      { speaker: '奧蘭', text: '……我得告訴你一件事。' },
      { text: '他轉過身。你看不清他的表情。' },
      { speaker: '奧蘭', text: '我跟阿圖斯大人簽了協議。' },
      { speaker: '奧蘭', text: '下週的前哨賽——我代你出場。' },
      { text: '你張了張嘴，一個字都說不出來。' },
      { speaker: '奧蘭', text: '你不是為了我一個人活下去的。' },
      { speaker: '奧蘭', text: '你要活過百日祭典。' },
      { speaker: '奧蘭', text: '讓我妹妹聽到你的名字。' },
      { speaker: '奧蘭', text: '我的名字她記不住——但你的，會。' },
      { text: '他終於笑了。眼睛先彎起來的那種笑。' },
      { text: '你感覺胸口被人掏空。' },
    ];

    _playIntroThenChoice(introLines, {
      id:    'orlan_final_farewell',
      icon:  '⚔️',
      title: '他簽了協議',
      body:  '你要怎麼回應？',
      forced: true,
      choices,
      logColor: '#d9a84f',
    });
    return true;
  }

  // ══════════════════════════════════════════════════
  // 生死關頭援手（aff ≥ 80 + 仁慈或寬厚）
  // ══════════════════════════════════════════════════
  // 呼叫時機：玩家 HP 即將歸零（戰鬥 / 訓練重傷 / 鞭刑）
  // 條件：
  //   - 奧蘭 aff ≥ 80
  //   - 奧蘭還活著（未 betrayed/dead）
  //   - 玩家有 merciful 或 kindness 特性（他才會不顧一切衝上來）
  //   - 一次性（flag orlan_death_save_used）
  // 效果：
  //   - HP 回到 30（避免死亡）
  //   - 加一個 flag player_was_nearly_dead（後續劇情用）
  //   - 奧蘭 aff +10
  //   - 播出敘述
  function tryDeathSave() {
    const p = Stats.player;
    if (!p) return false;
    if (Flags.has('orlan_death_save_used')) return false;
    if (Flags.has('orlan_dead') || Flags.has('betrayed_olan')) return false;
    const aff = teammates.getAffection('orlan');
    if (aff < 80) return false;
    const traits = p.traits || [];
    if (!traits.includes('merciful') && !traits.includes('kindness')) return false;

    Flags.set('orlan_death_save_used', true);
    Flags.set('player_was_nearly_dead', true);

    // 回復 HP
    const heal = 30 - (p.hp || 0);
    if (heal > 0) Stats.modVital('hp', heal);
    Stats.modVital('mood', +10);
    teammates.modAffection('orlan', +10);

    // 觸發敘述
    _log('—————————————————————', '#444', false);
    _log('你眼前一片漆黑。', '#8899aa', false);
    _log('你以為這就是結束。', '#8899aa', false);
    _log('—————————————————————', '#444', false);
    _log('你睜開眼。奧蘭的臉就在你上方，眉頭皺成一團，嘴唇在發抖。', '#d9a84f', true);
    _log('「……終於活了。」他說。聲音沙啞。「你這個混蛋，終於活了。」', '#e8d070', true);
    _log('你想笑，但胸口太痛。你只能看著他。', '#d9a84f', false);
    _log('他沒有鬆開握住你肩膀的手，很久。', '#c8a878', false);
    _log('—————————————————————', '#444', false);

    return true;
  }

  // ══════════════════════════════════════════════════
  // 初始化：註冊 DayCycle 鉤子
  // ══════════════════════════════════════════════════
  function init() {
    if (typeof DayCycle === 'undefined' || typeof DayCycle.onDayStart !== 'function') return;

    // 每日開始時嘗試觸發各階段事件（按優先度）
    DayCycle.onDayStart('orlanMilestones', () => {
      // Day 85 最高優先度（訣別）
      if (_tryFarewell()) return;
      // Day 60+ 偷藥事件
      if (_tryStealMedicine()) return;
      // Day 30+ 房間升級
      if (_tryRoomUpgrade()) return;
    });

    // 訣別後一週左右，奧蘭在前哨賽戰死（accept / reject 路線都會死）
    DayCycle.onDayStart('orlanPrelimDeath', (newDay) => {
      if (Flags.has('orlan_dead')) return;
      if (Flags.has('orlan_will_fight_beside')) return;  // 並肩路線不在前哨賽死
      const accepted = Flags.has('orlan_farewell_accepted');
      const rejected = Flags.has('orlan_farewell_rejected');
      if (!accepted && !rejected) return;
      // Day 85 訣別 → Day 92 左右的前哨賽
      if (newDay < 92) return;

      if (typeof teammates !== 'undefined' && teammates.getNPC('orlan')) {
        teammates.getNPC('orlan').alive = false;
      }
      Flags.set('orlan_dead', true);
      Flags.set('orlan_died_day', newDay);
      // 訊息留在 log — 細節情緒回聲交給 npc_reactions
      const lastWord = accepted
        ? '「……告訴他，我替他走了一段。」'
        : '「……他會活下去的。那就夠了。」';
      _log(`前哨賽的消息傳回來——奧蘭沒能活著走出場。他最後說的是：${lastWord}`, '#663344', true);
    }, 20);
  }

  // 自動初始化（需要 DayCycle 已載入）
  if (typeof DayCycle !== 'undefined') {
    init();
  } else {
    // 延遲到 DOMContentLoaded
    if (typeof document !== 'undefined') {
      document.addEventListener('DOMContentLoaded', init);
    }
  }

  return {
    init,
    tryDeathSave,
    // Expose for debugging
    _tryRoomUpgrade,
    _tryStealMedicine,
    _tryFarewell,
  };
})();
