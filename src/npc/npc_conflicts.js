/**
 * npc_conflicts.js — NPC conflict / bond events
 *
 * 訓練所裡的 NPC 之間存在固定的對立與羈絆：
 *   • 赫克特 ↔ 奧蘭（霸凌）
 *   • 赫克特 ↔ 卡西烏斯（嫉妒與輕蔑）
 *   • 塔倫長官 ↔ 老默（醫療方針衝突）
 *   • 塔倫長官 ↔ 梅拉塞（偷偷多給食物被抓）
 *   • 卡西烏斯 ↔ 奧蘭（護短）
 *
 * 每天清晨機率觸發一則「選邊站」事件——玩家必須在兩個 NPC 的立場之間選擇。
 *
 * 載入順序：orlan_events.js 之後、main.js 之前。
 * 依賴：Flags, Stats, DialogueModal, ChoiceModal, teammates (main.js), addLog (main.js)
 *
 * API:
 *   NPCConflicts.pickDaily(day)
 *     → { id, lines, onComplete } 或 null
 *     由 main.js 串進 _pendingDialogues（晨起後播放對話 → 選擇）
 */
const NPCConflicts = (() => {

  // CLAUDE.md 第 12 條：bare addLog 在外部模組是 ReferenceError
  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    } else {
      console.warn('[NPCConflicts] _log: no addLog available', text);
    }
  }

  // ══════════════════════════════════════════════════
  // Public: pickDaily
  // ══════════════════════════════════════════════════
  function pickDaily(day) {
    const eligible = _EVENTS.filter(ev => _isEligible(ev, day));
    if (eligible.length === 0) return null;

    // 每個事件有自己的觸發機率（每日各自獨立 roll，但一天最多一個）
    for (const ev of eligible) {
      if (Math.random() < (ev.chance || 0.25)) {
        Flags.set(`conflict_${ev.id}_fired`, true);
        return _buildPending(ev);
      }
    }
    return null;
  }

  function _isEligible(ev, day) {
    if (Flags.has(`conflict_${ev.id}_fired`)) return false;
    if (day < (ev.minDay || 0)) return false;
    if (ev.maxDay && day > ev.maxDay) return false;
    if (typeof ev.condition === 'function' && !ev.condition(day)) return false;
    return true;
  }

  function _buildPending(ev) {
    return {
      id:    `conflict_${ev.id}`,
      lines: ev.lines,
      onComplete: () => {
        if (typeof ChoiceModal === 'undefined') {
          // 退化：直接套用第一個選項
          _applyChoice(ev.choices[0]);
          return;
        }
        ChoiceModal.show({
          id:     `conflict_${ev.id}`,
          icon:   ev.icon || '⚔️',
          title:  ev.title,
          body:   ev.body || '你要站哪一邊？',
          forced: true,
          choices: ev.choices,
        });
      },
    };
  }

  function _applyChoice(choice) {
    if (typeof Effects !== 'undefined' && Array.isArray(choice.effects)) {
      Effects.apply(choice.effects, {});
    }
    if (choice.resultLog) {
      _log(choice.resultLog, choice.logColor || '#c8a060', false);
    }
  }

  // ══════════════════════════════════════════════════
  // 事件定義
  // ══════════════════════════════════════════════════
  const _EVENTS = [
    // ─────────────────────────────────────────────────
    // 1. 赫克特霸凌奧蘭（Day 8+，奧蘭還活著）
    // ─────────────────────────────────────────────────
    {
      id: 'hector_bullies_orlan',
      minDay: 8,
      maxDay: 84,
      chance: 0.38,
      condition: () =>
        !Flags.has('orlan_dead') &&
        !Flags.has('betrayed_olan') &&
        !Flags.has('separated_from_olan'),
      title: '食堂裡的碗',
      icon:  '🍲',
      body:  '你看見了，整個食堂也都看見了。',
      lines: [
        { text: '午餐。食堂裡吵雜，但某個角落突然安靜下來。' },
        { text: '赫克特把奧蘭的碗撥到地上。' },
        { speaker: '赫克特', text: '你這種人有資格坐我對面？' },
        { text: '奧蘭沒有動。只是低著頭。' },
        { speaker: '赫克特', text: '撿起來。用舌頭舔乾淨。' },
        { text: '食堂安靜了。所有人都在看——也在看你。' },
      ],
      choices: [
        {
          id: 'stand_for_orlan',
          label: '走過去，把碗撿起來',
          hint:  '「他的碗，我替他撿。」',
          effects: [
            { type: 'affection', key: 'hector',   delta: -18 },
            { type: 'affection', key: 'orlan',    delta: 12 },
            { type: 'affection', key: 'cassius',  delta: 8 },
            { type: 'affection', key: 'melaKook', delta: 5 },
            { type: 'moral', axis: 'loyalty', side: 'positive', weight: 1 },
          ],
          resultLog: '你走過去，撿起碗，放回奧蘭面前。赫克特看著你——那眼神你會記住。',
          logColor:  '#d9a84f',
        },
        {
          id: 'look_away',
          label: '低下頭，假裝沒看見',
          hint:  '有些仗打不起。',
          effects: [
            { type: 'affection', key: 'hector',   delta: 3 },
            { type: 'affection', key: 'orlan',    delta: -8 },
            { type: 'affection', key: 'melaKook', delta: -5 },
            { type: 'moral', axis: 'reliability', side: 'negative', weight: 1 },
          ],
          resultLog: '你繼續吃你的。背後的聲音慢慢淡掉——但奧蘭後來沒有再跟你坐同一桌。',
          logColor:  '#8899aa',
        },
        {
          id: 'side_with_hector',
          label: '【殘酷】跟著笑',
          hint:  '「舔啊，給大家看看。」',
          requireTrait: 'cruel',
          effects: [
            { type: 'affection', key: 'hector',   delta: 15 },
            { type: 'affection', key: 'orlan',    delta: -30 },
            { type: 'affection', key: 'cassius',  delta: -12 },
            { type: 'affection', key: 'melaKook', delta: -15 },
            { type: 'moral', axis: 'mercy', side: 'negative', weight: 2 },
          ],
          resultLog: '你笑了。幾個鬥士也跟著笑。奧蘭跪下去舔。赫克特把手搭到你肩上——像找到同類。',
          logColor:  '#663344',
        },
      ],
    },

    // ─────────────────────────────────────────────────
    // 2. 長官逼老默拒絕治療（Day 15+）
    // ─────────────────────────────────────────────────
    {
      id: 'officer_vs_doctor_medicine',
      minDay: 15,
      chance: 0.35,
      condition: () => typeof teammates !== 'undefined' &&
                       teammates.getNPC('doctorMo')?.alive !== false,
      title: '藥是留給誰的',
      icon:  '💊',
      body:  '你剛好在藥房門口。',
      lines: [
        { text: '你經過藥房，聽見裡面的爭吵。' },
        { speaker: '塔倫長官', text: '那個傷兵今天不准給藥。' },
        { speaker: '塔倫長官', text: '他傷成這樣還想上場？讓他自己熬。' },
        { speaker: '老默', text: '長官，他的感染已經上到肩膀了。' },
        { speaker: '老默', text: '今天不處理，明天就是截肢。' },
        { speaker: '塔倫長官', text: '那就截。' },
        { text: '老默沒有反駁。他只是看著你——他知道你站在門邊。' },
      ],
      choices: [
        {
          id: 'back_doctor',
          label: '替老默說話',
          hint:  '「長官，他治好了還能再替大人打幾場。」',
          effects: [
            { type: 'affection', key: 'officer',  delta: -12 },
            { type: 'affection', key: 'doctorMo', delta: 18 },
            { type: 'moral', axis: 'mercy', side: 'positive', weight: 1 },
          ],
          resultLog: '長官瞪了你一眼。「……治。治完自己負責他上不上場。」老默對你點點頭，眼神裡是你沒見過的東西。',
          logColor:  '#d9a84f',
        },
        {
          id: 'stay_silent_doc',
          label: '退後一步，裝沒聽到',
          hint:  '這不是你的事。',
          effects: [
            { type: 'affection', key: 'officer',  delta: 3 },
            { type: 'affection', key: 'doctorMo', delta: -8 },
            { type: 'moral', axis: 'reliability', side: 'negative', weight: 1 },
          ],
          resultLog: '你悄悄走開。第二天你看見那個傷兵——他的左手已經沒了。老默換藥時沒再看你。',
          logColor:  '#8899aa',
        },
        {
          id: 'side_officer',
          label: '附和長官',
          hint:  '「藥該留給更值得的人。」',
          effects: [
            { type: 'affection', key: 'officer',  delta: 12 },
            { type: 'affection', key: 'doctorMo', delta: -25 },
            { type: 'moral', axis: 'mercy', side: 'negative', weight: 2 },
          ],
          resultLog: '長官挑了挑眉。「這小子倒是會說話。」老默收起器材，什麼也沒說。從那天起他看你的眼神就不一樣了。',
          logColor:  '#663344',
        },
      ],
    },

    // ─────────────────────────────────────────────────
    // 3. 卡西烏斯 vs 赫克特 食堂挑釁（Day 20+）
    // ─────────────────────────────────────────────────
    {
      id: 'cassius_vs_hector_standoff',
      minDay: 20,
      chance: 0.32,
      condition: () => typeof teammates !== 'undefined' &&
                       teammates.getNPC('cassius')?.alive !== false &&
                       teammates.getNPC('hector')?.alive !== false,
      title: '兩隻狗對峙',
      icon:  '🥊',
      body:  '誰也不想先退。',
      lines: [
        { text: '食堂。卡西烏斯跟赫克特隔著桌子瞪著對方。' },
        { speaker: '卡西烏斯', text: '你上週的「意外」是怎麼發生的？' },
        { speaker: '卡西烏斯', text: '大家都知道你叫誰去把那雙靴子藏起來。' },
        { speaker: '赫克特', text: '老傢伙，你比較適合擔心你的膝蓋。' },
        { speaker: '赫克特', text: '聽說你最近走路有點不一樣了。' },
        { text: '兩人的手都在桌子底下。有人悄悄站起來挪開板凳。' },
        { text: '——他們都看了你一眼。' },
      ],
      choices: [
        {
          id: 'calm_cassius',
          label: '拉卡西烏斯一把',
          hint:  '「老大，他不值得。」',
          effects: [
            { type: 'affection', key: 'cassius', delta: 10 },
            { type: 'affection', key: 'hector',  delta: 5 },
            { type: 'moral', axis: 'patience', side: 'positive', weight: 1 },
          ],
          resultLog: '卡西烏斯冷哼一聲坐下。赫克特笑著走了——但他經過你時，多看了你一眼，像在記帳。',
          logColor:  '#c8a878',
        },
        {
          id: 'shove_hector',
          label: '把赫克特推開',
          hint:  '「滾。食堂不是你耍嘴皮的地方。」',
          effects: [
            { type: 'affection', key: 'cassius', delta: 8 },
            { type: 'affection', key: 'hector',  delta: -12 },
            { type: 'moral', axis: 'loyalty', side: 'positive', weight: 1 },
          ],
          resultLog: '赫克特站起來看著你很久。然後他笑了。「好——記住了。」卡西烏斯從鼻子裡哼了一聲，但他記得。',
          logColor:  '#d9a84f',
        },
        {
          id: 'egg_it_on',
          label: '【殘酷】煽動「打啊」',
          hint:  '你想看好戲。',
          requireTrait: 'cruel',
          effects: [
            { type: 'affection', key: 'cassius', delta: -10 },
            { type: 'affection', key: 'hector',  delta: -8 },
            { type: 'affection', key: 'melaKook', delta: -10 },
            { type: 'moral', axis: 'mercy', side: 'negative', weight: 1 },
          ],
          resultLog: '你笑著起鬨。兩人被你的話刺得更近——但最後誰也沒出手。只剩下你一個人還在笑。',
          logColor:  '#663344',
        },
        {
          id: 'slip_away',
          label: '悄悄離開',
          hint:  '這不是你的仗。',
          effects: [
            { type: 'affection', key: 'cassius', delta: -3 },
            { type: 'affection', key: 'hector',  delta: -3 },
          ],
          resultLog: '你端起盤子走到角落。背後很久才安靜下來——你沒看見到底誰先退。',
          logColor:  '#8899aa',
        },
      ],
    },

    // ─────────────────────────────────────────────────
    // 4. 梅拉塞被抓偷塞食物（Day 25+）
    // ─────────────────────────────────────────────────
    {
      id: 'mela_caught_feeding',
      minDay: 25,
      chance: 0.35,
      condition: () => typeof teammates !== 'undefined' &&
                       teammates.getAffection('melaKook') >= 20,
      title: '多出來的那個饅頭',
      icon:  '🍞',
      body:  '塔倫長官盯著你盤子裡的東西。',
      lines: [
        { text: '早餐。塔倫長官突然站在你桌邊。' },
        { speaker: '塔倫長官', text: '你盤子裡怎麼多一個？' },
        { text: '你看向廚房。梅拉塞在門口站著，手裡還拿著木勺，嘴唇很白。' },
        { speaker: '塔倫長官', text: '這老太婆又在搞小動作了。' },
        { speaker: '塔倫長官', text: '——她上次的警告還沒消。這次要不要送去……' },
        { text: '他看著你。等著你說話。' },
      ],
      choices: [
        {
          id: 'take_blame_for_mela',
          label: '是我自己拿的',
          hint:  '「我餓了，我自己多拿的。她不知道。」',
          effects: [
            { type: 'affection', key: 'officer',  delta: -8 },
            { type: 'affection', key: 'melaKook', delta: 25 },
            { type: 'vital',     key: 'hp',       delta: -10 },   // 你挨了一掌
            { type: 'moral', axis: 'loyalty', side: 'positive', weight: 1 },
          ],
          // 🆕 2026-04-24：CLAUDE.md 第 11 條反饋鐵律 — 扣 HP 一定要有震動 + 紅光 + 痛叫
          resultEffect: 'shake-and-flash',
          resultDialogue: [
            { speaker: '塔倫長官', text: '——蠢貨。' },
            { text: '（啪！）', effect: 'shake-big' },
            { speaker: '主角', text: '啊——!', effect: 'shake' },
            { text: '（你的臉被打到一邊去。嘴裡有鐵的味道。）' },
            { speaker: '塔倫長官', text: '下次自己拿自己吃完。' },
            { text: '（他轉身走了。）' },
            { text: '（梅拉塞站在門口很久——她沒有哭，但她看著你。）' },
          ],
          resultLog: '你替梅拉扛了那一巴掌。她欠你的，她記著。',
          logColor:  '#d9a84f',
        },
        {
          id: 'play_dumb',
          label: '裝傻',
          hint:  '「我也不知道為什麼會多。」',
          effects: [
            { type: 'affection', key: 'officer',  delta: 2 },
            { type: 'affection', key: 'melaKook', delta: -15 },
          ],
          // 🆕 NPC 反應 — 長官冷笑 + 梅拉沉默
          resultDialogue: [
            { speaker: '塔倫長官', text: '蠢蛋。' },
            { text: '（他把那個饅頭拿走。）' },
            { text: '（梅拉塞看著盤子，沒抬頭。）' },
            { text: '（晚餐她沒來食堂。據說她的肩膀有新的傷。）' },
          ],
          resultLog: '你裝沒事走過去。但你聽見梅拉的位置空了一晚。',
          logColor:  '#8899aa',
        },
        {
          id: 'sell_her_out',
          label: '是她塞給我的',
          hint:  '「大人，是她每天都多給我。」',
          effects: [
            { type: 'affection', key: 'officer',  delta: 10 },
            { type: 'affection', key: 'melaKook', delta: -50 },
            { type: 'affection', key: 'cassius',  delta: -10 },
            { type: 'moral', axis: 'loyalty', side: 'negative', weight: 2 },
          ],
          // 🆕 紅光 — 道德崩塌的視覺暗示
          resultEffect: 'red-flash',
          resultDialogue: [
            { text: '（你開口的瞬間——梅拉塞抬頭看你。）' },
            { text: '（那眼神，你一輩子忘不掉。）' },
            { speaker: '塔倫長官', text: '⋯⋯哦？很好。' },
            { text: '（長官帶人進廚房。梅拉沒抵抗。）' },
            { text: '（從那天起，你的湯裡再也沒有菜。）' },
          ],
          resultLog: '你出賣了她。長官很滿意。但你之後每一口湯都嚐得到那眼神。',
          logColor:  '#663344',
        },
      ],
    },

    // ─────────────────────────────────────────────────
    // 5. 奧蘭求你教訓赫克特（Day 35+，aff ≥ 30）
    // ─────────────────────────────────────────────────
    {
      id: 'orlan_asks_revenge',
      minDay: 35,
      maxDay: 84,
      chance: 0.4,
      condition: () =>
        !Flags.has('orlan_dead') &&
        !Flags.has('betrayed_olan') &&
        typeof teammates !== 'undefined' &&
        teammates.getAffection('orlan') >= 30 &&
        teammates.getNPC('hector')?.alive !== false,
      title: '奧蘭求你',
      icon:  '🙏',
      body:  '這是你第一次看見他這樣求人。',
      lines: [
        { text: '夜。奧蘭悄悄過來找你。' },
        { speaker: '奧蘭', text: '……他今天又拿走了我的毯子。' },
        { speaker: '奧蘭', text: '他每週都會。——沒有毯子我會咳得整晚。' },
        { speaker: '奧蘭', text: '我知道這不公平。' },
        { speaker: '奧蘭', text: '但你可不可以……去跟他說一次？' },
        { speaker: '奧蘭', text: '你說的話他會聽。' },
        { text: '他沒有抬頭。你看得到他耳朵發紅。' },
      ],
      choices: [
        {
          id: 'confront_hector',
          label: '好，我去',
          hint:  '隔天你直接找上赫克特。',
          effects: [
            { type: 'affection', key: 'orlan',  delta: 15 },
            { type: 'affection', key: 'hector', delta: -12 },
            { type: 'vital',     key: 'hp',     delta: -8 },    // 互撞一下
            { type: 'moral', axis: 'loyalty', side: 'positive', weight: 1 },
          ],
          // 🆕 2026-04-24：扣 HP 要有震動（鐵則 11）
          resultEffect: 'shake',
          resultDialogue: [
            { text: '（隔天，訓練後。你堵住赫克特。）' },
            { speaker: '主角', text: '把毯子還他。' },
            { speaker: '赫克特', text: '⋯⋯哦？' },
            { text: '（他靠過來。肩膀撞了你一下。）', effect: 'shake-big' },
            { speaker: '主角', text: '唔！' },
            { text: '（你沒退。你也撞回去。）' },
            { speaker: '赫克特', text: '行，算你狠。' },
            { text: '（他把毯子摔回奧蘭床上。但他沒忘記這一筆。）' },
          ],
          resultLog: '你替奧蘭討回了毯子——但赫克特記著這一帳。',
          logColor:  '#d9a84f',
        },
        {
          id: 'gently_refuse',
          label: '我幫不了你',
          hint:  '「奧蘭，我自己都……」',
          effects: [
            { type: 'affection', key: 'orlan', delta: -12 },
            { type: 'moral', axis: 'reliability', side: 'negative', weight: 1 },
          ],
          resultLog: '奧蘭點點頭，很快。他沒有追問什麼，但那晚他背對著你睡。你聽見他的咳嗽一整晚。',
          logColor:  '#8899aa',
        },
        {
          id: 'offer_own_blanket',
          label: '把自己的毯子給他',
          hint:  '「拿去。我年輕，撐得住。」',
          effects: [
            { type: 'affection', key: 'orlan',  delta: 20 },
            { type: 'vital',     key: 'mood',   delta: -5 },
            { type: 'vital',     key: 'hp',     delta: -5 },    // 夜裡受寒
            { type: 'moral', axis: 'mercy', side: 'positive', weight: 1 },
          ],
          // 🆕 對白演出（受寒不是劇烈傷，不需要 shake；用對話呈現）
          resultDialogue: [
            { text: '（你把毯子推過去。）' },
            { speaker: '主角', text: '拿去。我年輕，撐得住。' },
            { text: '（奧蘭愣住——接也不是，不接也不是。）' },
            { text: '（最後他把毯子分成兩半。）' },
            { speaker: '奧蘭', text: '⋯⋯一人一半。' },
            { text: '（那晚你們兩個都沒睡好。但你們都笑了。）' },
          ],
          resultLog: '一人一半。你們都沒睡好，但你們都笑了。',
          logColor:  '#c8a878',
        },
      ],
    },

    // ─────────────────────────────────────────────────
    // 6. 長官在訓練場多打奧蘭（Day 40+）
    // ─────────────────────────────────────────────────
    {
      id: 'officer_targets_orlan',
      minDay: 40,
      maxDay: 84,
      chance: 0.36,
      condition: () =>
        !Flags.has('orlan_dead') &&
        !Flags.has('betrayed_olan') &&
        typeof teammates !== 'undefined' &&
        teammates.getNPC('orlan')?.alive !== false,
      title: '第五鞭',
      icon:  '🔥',
      body:  '長官已經不是在「教訓」了。',
      lines: [
        { text: '訓練場。奧蘭做錯了一個動作。' },
        { text: '塔倫長官開始用鞭子。第一鞭、第二鞭、第三鞭——' },
        { text: '按規矩是三鞭。但長官沒停。' },
        { text: '第四鞭。第五鞭。' },
        { speaker: '塔倫長官', text: '這種廢料怎麼還活著。' },
        { text: '奧蘭整個人縮在地上，沒有聲音。' },
        { text: '你看見卡西烏斯的手握緊了——但他沒動。' },
        { text: '全場在等。' },
      ],
      choices: [
        {
          id: 'block_whip',
          label: '跑過去擋在前面',
          hint:  '「長官，這份他吃不下——我來。」',
          effects: [
            { type: 'affection', key: 'officer', delta: -15 },
            { type: 'affection', key: 'orlan',   delta: 30 },
            { type: 'affection', key: 'cassius', delta: 12 },
            { type: 'affection', key: 'melaKook', delta: 8 },
            { type: 'vital',     key: 'hp',      delta: -25 },
            { type: 'moral', axis: 'mercy', side: 'positive', weight: 2 },
          ],
          // 🆕 2026-04-24：高潮場面 — 連續鞭擊重震動 + 紅光（HP -25 嚴重傷）
          resultEffect: 'shake-and-flash',
          resultDialogue: [
            { text: '（你衝過去。跪下。背對奧蘭。）' },
            { speaker: '主角', text: '長官——這份他吃不下！' },
            { speaker: '塔倫長官', text: '⋯⋯有種。' },
            { text: '（咻——！）', effect: 'shake-big' },
            { speaker: '主角', text: '啊——！' },
            { text: '（咻——！）', effect: 'shake-big' },
            { speaker: '主角', text: '啊啊——！！' },
            { text: '（你的背已經破了。但你沒動。）' },
            { text: '（鞭子停了。）' },
            { speaker: '塔倫長官', text: '⋯⋯' },
            { text: '（他把鞭子摔到一邊，走了。）' },
            { text: '（卡西烏斯走過來扶你。沒說話。）' },
            { text: '（奧蘭哭了。第一次。）' },
          ],
          resultLog: '你替奧蘭擋了兩鞭。他這輩子記著。',
          logColor:  '#d9a84f',
        },
        {
          id: 'shout_stop',
          label: '大聲喊：「夠了！」',
          hint:  '你沒動，但你吼了。',
          effects: [
            { type: 'affection', key: 'officer', delta: -5 },
            { type: 'affection', key: 'orlan',   delta: 12 },
            { type: 'moral', axis: 'mercy', side: 'positive', weight: 1 },
          ],
          resultEffect: 'shake',
          resultDialogue: [
            { speaker: '主角', text: '夠了！' },
            { text: '（全場安靜。）', effect: 'shake' },
            { text: '（長官轉頭看你。）' },
            { speaker: '塔倫長官', text: '⋯⋯你是誰？' },
            { text: '（他停了鞭子。但他在你的訓練報告上加了幾筆。）' },
          ],
          resultLog: '你吼住了長官——但他記下了你。',
          logColor:  '#c8a878',
        },
        {
          id: 'do_nothing',
          label: '不動',
          hint:  '這不是你的仗。',
          effects: [
            { type: 'affection', key: 'orlan',   delta: -15 },
            { type: 'affection', key: 'melaKook', delta: -5 },
            { type: 'moral', axis: 'loyalty', side: 'negative', weight: 1 },
          ],
          resultDialogue: [
            { text: '（你低頭。看著自己的腳。）' },
            { text: '（鞭聲還在。第六、第七、第八。）' },
            { text: '（然後停了。）' },
            { text: '（奧蘭被拖走。他被抬過你身邊的時候——你沒有抬頭。）' },
            { text: '（那晚他沒跟你說話。）' },
            { text: '（他大概記得你站在哪。）' },
          ],
          resultLog: '你選擇了沉默。這份沉默會跟著你。',
          logColor:  '#8899aa',
        },
      ],
    },
  ];

  // ══════════════════════════════════════════════════
  // Public API
  // ══════════════════════════════════════════════════
  return {
    pickDaily,
    _EVENTS,   // expose for debugging
  };
})();
