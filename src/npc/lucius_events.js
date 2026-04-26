/**
 * lucius_events.js — 斷腳的盧基烏斯主線（拳法傳承）
 * ══════════════════════════════════════════════════
 * 設計：docs/quests/lucius-empty-hand.md
 * 角色：npc.js lucius
 *
 * 觸發鏈：
 *   段 1：暗示 — 卡西烏斯/老默事件中提到「Forum 那個瘸子」→ flag heard_about_cripple
 *   段 2：相遇 — 跑腿事件 35% + AGI/DEX 判定（撞牆 vs 閃過）
 *   段 3：學招 — 多次相遇 + 善意特性 → 教 4 招（赤手奪刃 / 借力反摔 / 要害打擊 / 關節破）
 *   段 5：T4 自悟（未來）
 *
 * 主要 API：
 *   LuciusEvents.tryErrandEncounter()  ← 由 errand_market_* 事件呼叫
 *   LuciusEvents.tryLearnNext()        ← 第 2+ 次相遇學招
 *
 * 善意獎勵階梯（每次見面結算）：
 *   1 個善意特性：基本對話、無 EXP
 *   2 個：DEX +200
 *   3 個：DEX +200 / AGI +200
 *   4 個：DEX +200 / AGI +200 / WIL +200
 */
const LuciusEvents = (() => {

  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    }
  }

  const KINDNESS_TRAITS = ['humble', 'merciful', 'kindness', 'reliable'];
  const SKILL_LEARN_ORDER = [
    { id: 'bareDisarm',    flag: 'lucius_taught_disarm',  name: '赤手奪刃' },
    { id: 'leverageThrow', flag: 'lucius_taught_throw',   name: '借力反摔' },
    { id: 'vitalStrike',   flag: 'lucius_taught_vital',   name: '要害打擊' },
    { id: 'jointBreaker',  flag: 'lucius_taught_joint',   name: '關節破' },
  ];

  function _hasAnyKindness() {
    const traits = (Stats.player && Stats.player.traits) || [];
    return KINDNESS_TRAITS.some(t => traits.includes(t));
  }

  function _countKindness() {
    const traits = (Stats.player && Stats.player.traits) || [];
    return KINDNESS_TRAITS.filter(t => traits.includes(t)).length;
  }

  // ══════════════════════════════════════════════════
  // 段 2：相遇判定 — 由 errand_market_* 事件呼叫
  // ══════════════════════════════════════════════════
  function tryErrandEncounter() {
    const p = Stats.player;
    if (!p) return false;
    if (typeof Flags === 'undefined') return false;

    if (!Flags.has('heard_about_cripple')) return false;
    if (Flags.has('met_lucius')) return false;
    if (Flags.has('lucius_brushed_off_rude')) return false;

    // 撞牆 cooldown 3 天
    const lastBump = Flags.get('lucius_last_bump_day', -99);
    if (p.day - lastBump < 3) return false;

    if (Math.random() >= 0.35) return false;

    // 閃避判定
    const agi = (typeof Stats.eff === 'function') ? Stats.eff('AGI') : (p.AGI || 10);
    const dex = (typeof Stats.eff === 'function') ? Stats.eff('DEX') : (p.DEX || 10);

    if (agi >= 18 && dex >= 15) {
      _playDodgeSuccess();
    } else {
      _playWallBump();
    }
    return true;
  }

  function _playWallBump() {
    const p = Stats.player;
    Flags.set('lucius_brushed_off', true);
    Flags.set('lucius_last_bump_day', p.day);

    if (typeof Stage !== 'undefined' && Stage.popupBig) {
      Stage.popupBig({
        icon: '💥', title: '撞上！', subtitle: '反應慢了一拍',
        color: 'red', duration: 1400, shake: true,
      });
    }
    if (typeof Game !== 'undefined' && Game.shakeGameRoot) Game.shakeGameRoot();

    // 數值懲罰
    Stats.modVital('hp', -10);
    Stats.modVital('mood', -8);

    // 對白
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play([
        { text: '（你正想閃過——但腿沒跟上反應。）', effect: 'shake' },
        { text: '（肩膀重重撞上市場柱子、你倒退兩步。）', effect: 'shake' },
        { speaker: '主角', text: '⋯⋯（鍛鍊還是不夠。反應慢了。）', color: '#cc7766' },
        { text: '（你扶著牆站起來、沒看清是什麼絆到你。）' },
        { text: '（一個獨腳老人縮回拐杖、低頭沒說話。）' },
        { text: '（你拍拍灰、繼續走。）' },
      ]);
    } else {
      _log('💥 你撞上市場柱子。HP -10、心情 -8。鍛鍊還是不夠。', '#cc7766', true);
    }
  }

  function _playDodgeSuccess() {
    if (typeof Stage !== 'undefined' && Stage.popupBig) {
      Stage.popupBig({
        icon: '✦', title: '閃過了', subtitle: '你的反應夠快',
        color: 'gold', duration: 1200,
      });
    }

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play([
        { text: '（你眼角餘光掃到拐杖橫出來——）' },
        { text: '（你下意識側身、繞過。）' },
        { text: '（你停下、轉頭看。一個獨腳老人坐在牆角、剛才差點撞到他。）' },
        { speaker: '盧基烏斯', text: '⋯⋯' },
        { text: '（他抬頭看你。眼神異常清醒。）' },
      ], {
        onComplete: () => _showApologyChoice()
      });
    } else {
      _showApologyChoice();
    }
  }

  function _showApologyChoice() {
    if (typeof ChoiceModal === 'undefined') return;
    const p = Stats.player;
    const hasMoney = (p.money || 0) >= 5;
    const hasFood  = (p.food  || 0) >= 10;

    ChoiceModal.show({
      id: 'lucius_first_encounter',
      icon: '🤲',
      title: '他看著你',
      body: '一個獨腳老人坐在牆角。\n你差點撞到他。\n\n你想怎麼回應？',
      forced: true,
      choices: [
        {
          id: 'apologize_money',
          label: '「對不起。」+ 給點銅錢（5）',
          hint: hasMoney ? '結個善緣' : `錢不夠（需 5、有 ${p.money || 0}）`,
          _disabled: !hasMoney,
          effects: [
            { type: 'money', delta: -5 },
            { type: 'flag',  key: 'met_lucius' },
            { type: 'flag',  key: 'lucius_kindness_1' },
          ],
          resultLog: '你掏出五枚銅錢放進他的破碗。他看了你一眼、什麼都沒說。',
          logColor: '#c8a060',
        },
        {
          id: 'apologize_food',
          label: '「對不起。沒事吧？」+ 給點食物',
          hint: hasFood ? '結個善緣' : `食物不夠（需 10、有 ${p.food || 0}）`,
          _disabled: !hasFood,
          effects: [
            { type: 'vital', key: 'food', delta: -10 },
            { type: 'flag',  key: 'met_lucius' },
            { type: 'flag',  key: 'lucius_kindness_1' },
          ],
          resultLog: '你撕一塊麵包遞過去。他猶豫了一下、接了。',
          logColor: '#c8a060',
        },
        {
          id: 'concern_only',
          label: '「⋯⋯沒事吧？」（純關心）',
          hint: '光問候、沒給東西',
          effects: [
            { type: 'flag', key: 'met_lucius' },
          ],
          resultLog: '他點點頭、沒說話。',
          logColor: '#9a8866',
        },
        {
          id: 'rude',
          label: '「閃開、別擋路。」',
          hint: '推開他繼續走',
          effects: [
            { type: 'flag',  key: 'lucius_brushed_off_rude' },
            { type: 'moral', axis: 'mercy', side: 'negative' },
          ],
          resultLog: '老人沒抬頭。但你走遠時、感覺背後有道目光。從此這條線你走不通了。',
          logColor: '#8899aa',
        },
      ],
    });
  }

  // ══════════════════════════════════════════════════
  // 段 3：學招 — 在 errand 事件後的「下一次」相遇觸發
  //   每次見面：先發善意 EXP 獎勵、再判斷是否教新招
  //   要靠 errand 觸發再次相遇（不限同一次跑腿）
  // ══════════════════════════════════════════════════
  function tryRevisitEncounter() {
    const p = Stats.player;
    if (!p) return false;
    if (typeof Flags === 'undefined') return false;

    if (!Flags.has('met_lucius')) return false;
    if (!Flags.has('lucius_kindness_1')) return false;
    if (!_hasAnyKindness()) return false;
    if (Flags.has('lucius_brushed_off_rude')) return false;

    // 距上次見面至少 3 天
    const lastVisit = Flags.get('lucius_last_visit_day', -99);
    if (p.day - lastVisit < 3) return false;

    if (Math.random() >= 0.35) return false;

    Flags.set('lucius_last_visit_day', p.day);

    // 🆕 2026-04-27 隱藏第 5 次相遇 — 4 招都學完 + 巴爺主線完成 + 還沒提過巴爺
    const allTaught = SKILL_LEARN_ORDER.every(s => Flags.has(s.flag));
    const overseerEnded = Flags.has('overseer_passed_torch') || Flags.has('overseer_kept_secret');
    if (allTaught && overseerEnded && !Flags.has('lucius_remembered_babrius')) {
      _playHiddenBabriusScene();
      return true;
    }

    // 該教第幾招？
    const nextSkill = SKILL_LEARN_ORDER.find(s => !Flags.has(s.flag));

    if (nextSkill) {
      // 第 2 招要玩家受過重傷、第 3 招要用過前 2 招
      if (nextSkill.id === 'leverageThrow') {
        const hasInjury = Stats.player.wounds && Object.values(Stats.player.wounds).some(w => w && w.severity);
        if (!hasInjury) {
          _playSimpleVisit();   // 先閒聊、不教招
          return true;
        }
      }
      if (nextSkill.id === 'vitalStrike') {
        const usedT1 = (Flags.get('lucius_skill_use_count', 0) >= 5);
        if (!usedT1) {
          _playSimpleVisit();
          return true;
        }
      }
      _playLearnSkillScene(nextSkill);
    } else {
      _playSimpleVisit();
    }
    return true;
  }

  function _playSimpleVisit() {
    _payKindnessBonus(false);
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play([
        { text: '（你又經過 Forum 邊緣的巷弄。）' },
        { speaker: '盧基烏斯', text: '⋯⋯小子。' },
        { text: '（他點點頭、沒多說。）' },
      ]);
    }
  }

  function _playLearnSkillScene(skill) {
    if (typeof DialogueModal === 'undefined') {
      _grantSkill(skill);
      return;
    }
    let lines;
    if (skill.id === 'bareDisarm') {
      lines = [
        { text: '（你又經過 Forum 邊緣的巷弄。獨腳老人看見你、這次抬起頭來。）' },
        { speaker: '盧基烏斯', text: '⋯⋯小子。又是你。' },
        { text: '（他打量你一下。）' },
        { speaker: '盧基烏斯', text: '我看你動作⋯⋯不像普通人。是訓練所的嗎？' },
        { text: '（你點點頭。）' },
        { speaker: '盧基烏斯', text: '⋯⋯' },
        { text: '（他沉默很久。）' },
        { speaker: '盧基烏斯', text: '我跟你說一件事。我以前也是。' },
        { speaker: '盧基烏斯', text: '⋯⋯然後就成這樣了。' },
        { text: '（他敲敲斷腿。）' },
        { speaker: '盧基烏斯', text: '⋯⋯要不要學一招？保命用的、沒武器也能活下去。' },
        { speaker: '盧基烏斯', text: '叫赤手奪刃。對方拿刀砍來、徒手撥開。' },
      ];
    } else if (skill.id === 'leverageThrow') {
      lines = [
        { text: '（你又來。傷還沒好。）' },
        { speaker: '盧基烏斯', text: '⋯⋯回來了。' },
        { text: '（他看你身上的傷。）' },
        { speaker: '盧基烏斯', text: '打不過、就別硬打。' },
        { speaker: '盧基烏斯', text: '我教你借力。對方力大、你就拿他的力反摔。' },
        { speaker: '盧基烏斯', text: '⋯⋯這招很奇怪。但有用。' },
      ];
    } else if (skill.id === 'vitalStrike') {
      lines = [
        { text: '（你又來。盧基烏斯這次認真看你。）' },
        { speaker: '盧基烏斯', text: '⋯⋯你練了。我看得出來。' },
        { speaker: '盧基烏斯', text: '我教你最後一招。' },
        { speaker: '盧基烏斯', text: '⋯⋯這招很危險。對你也是。' },
        { speaker: '盧基烏斯', text: '打人的頸動脈、對方就軟一陣子。' },
        { speaker: '盧基烏斯', text: '但你下手的時候、那個重量會跟你一輩子。' },
        { speaker: '盧基烏斯', text: '⋯⋯' },
      ];
    } else if (skill.id === 'jointBreaker') {
      lines = [
        { text: '（你又來。盧基烏斯沉默地看你一會兒。）' },
        { speaker: '盧基烏斯', text: '⋯⋯還有一招。' },
        { speaker: '盧基烏斯', text: '對方穿重甲、力氣再大也沒用。' },
        { speaker: '盧基烏斯', text: '我教你打關節。膝肘、不需要力氣、需要準。' },
        { speaker: '盧基烏斯', text: '⋯⋯這是我師父教我的最後一招。' },
        { text: '（他停下。）' },
        { speaker: '盧基烏斯', text: '⋯⋯後面就沒有了。他來不及教完。' },
      ];
    }
    DialogueModal.play(lines, {
      onComplete: () => _grantSkill(skill)
    });
  }

  function _grantSkill(skill) {
    if (!Stats.player.learnedSkills) Stats.player.learnedSkills = [];
    if (!Stats.player.learnedSkills.includes(skill.id)) {
      Stats.player.learnedSkills.push(skill.id);
    }
    Flags.set(skill.flag, true);
    _payKindnessBonus(true);
    _log(`✦ 你習得了【${skill.name}】（拳法 T1、weaponClass: fist）`, '#d4af37', true);
    if (typeof Stage !== 'undefined' && Stage.popupBig) {
      Stage.popupBig({
        icon: '👊', title: skill.name, subtitle: '盧基烏斯傳授',
        color: 'gold', duration: 1800, sound: 'acquire',
      });
    }
  }

  // 善意 EXP 獎勵階梯（每次見面結算）
  function _payKindnessBonus(isLearningScene) {
    const count = _countKindness();
    if (count < 2) return;   // 1 個只是門檻、無 bonus

    const bonuses = [];
    if (count >= 2) { Stats.modExp('DEX', 200); bonuses.push('DEX +200'); }
    if (count >= 3) { Stats.modExp('AGI', 200); bonuses.push('AGI +200'); }
    if (count >= 4) { Stats.modExp('WIL', 200); bonuses.push('WIL +200'); }

    let line;
    if (count === 2) line = '盧基烏斯：「⋯⋯你比我想的好一點。陪你練一下。」';
    else if (count === 3) line = '盧基烏斯：「⋯⋯你寬厚、又謙虛。這樣的人路難走。罷了、多幫你一點。」';
    else line = '盧基烏斯：「⋯⋯（他第一次正眼看你。）我看你真的⋯⋯難得。多陪你練幾下吧。」';

    _log(line + ` （${bonuses.join(' / ')}）`, '#d4af37', true);
  }

  // ══════════════════════════════════════════════════
  // 工具：紀錄拳法招式使用次數（按招分開計）
  //   存在 player.luciusSkillUsage = { bareDisarm: 5, leverageThrow: 3, ... }
  //   給 T2/T3 自悟用、各招分別計次
  // ══════════════════════════════════════════════════
  const FIST_BASE_IDS = ['bareDisarm', 'leverageThrow', 'vitalStrike', 'jointBreaker'];

  function _getSeriesKey(skillId) {
    // 從招 ID 取系列（bareDisarm / bareDisarm_t2 / bareDisarm_t3 → bareDisarm）
    if (!skillId) return null;
    return skillId.replace(/_t[23]$/, '');
  }

  function recordSkillUsage(skillId) {
    if (!skillId) return;
    const series = _getSeriesKey(skillId);
    if (!FIST_BASE_IDS.includes(series)) return;
    if (!Stats.player.luciusSkillUsage) Stats.player.luciusSkillUsage = {};
    Stats.player.luciusSkillUsage[series] = (Stats.player.luciusSkillUsage[series] || 0) + 1;
    // legacy 總計（保留向下相容）
    if (typeof Flags !== 'undefined') Flags.increment('lucius_skill_use_count', 1);

    // 🆕 自悟自動檢查（用完招後立刻判斷有沒有達標）
    _checkSelfRealize(series);
  }

  // ══════════════════════════════════════════════════
  // 🆕 2026-04-27 T2/T3 自悟系統
  //   T2 條件：該招用 ≥ 8 次 + AGI ≥ 25 + 還沒有 T2 + 付 EXP
  //   T3 條件：T2 有了 + 該招用 ≥ 12 次（T2 起算）+ AGI ≥ 30 + 付 EXP
  // ══════════════════════════════════════════════════
  function _checkSelfRealize(series) {
    if (typeof Flags === 'undefined') return;
    if (!series) return;
    const usage = (Stats.player.luciusSkillUsage || {})[series] || 0;
    const agiEff = (typeof Stats.eff === 'function') ? Stats.eff('AGI') : (Stats.player.AGI || 10);
    const dexEff = (typeof Stats.eff === 'function') ? Stats.eff('DEX') : (Stats.player.DEX || 10);

    // T2 自悟
    if (!Flags.has(`lucius_t2_${series.replace(/[A-Z]/g, m => m.toLowerCase())}`) &&
        !Flags.has(`lucius_t2_${_seriesShort(series)}`)) {
      const t2Flag = `lucius_t2_${_seriesShort(series)}`;
      if (!Flags.has(t2Flag) && usage >= 8 && agiEff >= 25) {
        // 檢查 EXP 夠
        const need = { AGI: 200, DEX: 100 };
        const have = { AGI: Stats.player.exp?.AGI || 0, DEX: Stats.player.exp?.DEX || 0 };
        if (have.AGI >= need.AGI && have.DEX >= need.DEX) {
          _offerSelfRealize(series, 2, t2Flag, need);
          return;
        }
      }
    }
    // T3 自悟
    const t2Flag = `lucius_t2_${_seriesShort(series)}`;
    const t3Flag = `lucius_t3_${_seriesShort(series)}`;
    if (Flags.has(t2Flag) && !Flags.has(t3Flag) && usage >= 12 && agiEff >= 30) {
      const need = { AGI: 350, DEX: 200 };
      const have = { AGI: Stats.player.exp?.AGI || 0, DEX: Stats.player.exp?.DEX || 0 };
      if (have.AGI >= need.AGI && have.DEX >= need.DEX) {
        _offerSelfRealize(series, 3, t3Flag, need);
      }
    }
  }

  function _seriesShort(series) {
    return ({ bareDisarm: 'disarm', leverageThrow: 'throw',
              vitalStrike: 'vital', jointBreaker: 'joint' })[series] || series;
  }

  function _offerSelfRealize(series, tier, flagKey, cost) {
    if (typeof ChoiceModal === 'undefined') {
      _grantSelfRealize(series, tier, flagKey, cost);
      return;
    }
    const skillName = ({ bareDisarm: '赤手奪刃', leverageThrow: '借力反摔',
                         vitalStrike: '要害打擊', jointBreaker: '關節破' })[series];
    ChoiceModal.show({
      id: `lucius_realize_${series}_t${tier}`,
      icon: '✦',
      title: `自悟：${skillName} T${tier}`,
      body: `你反覆用這招、突然領悟了更深的層次。\n要花 EXP 升級嗎？\n\n成本：AGI ${cost.AGI} EXP / DEX ${cost.DEX} EXP`,
      forced: true,
      choices: [
        {
          id: 'realize',
          label: `升級！（AGI ${cost.AGI} / DEX ${cost.DEX} EXP）`,
          effects: [],
          resultLog: `✦ 自悟成功！${skillName} 升到 T${tier}。`,
          logColor: '#d4af37',
        },
        {
          id: 'not_yet',
          label: '⋯⋯之後再說',
          hint: '（保留 EXP）',
          effects: [],
          resultLog: '你決定先撐著、之後再升。',
          logColor: '#9a8866',
        },
      ],
    }, {
      onChoose: (choiceId) => {
        if (choiceId === 'realize') _grantSelfRealize(series, tier, flagKey, cost);
      }
    });
  }

  function _grantSelfRealize(series, tier, flagKey, cost) {
    Stats.modExp('AGI', -cost.AGI);
    Stats.modExp('DEX', -cost.DEX);
    Flags.set(flagKey, true);

    const newSkillId = `${series}_t${tier}`;
    const oldSkillId = (tier === 2) ? series : `${series}_t2`;

    if (!Array.isArray(Stats.player.learnedSkills)) Stats.player.learnedSkills = [];
    // 移除舊階、加新階
    const oldIdx = Stats.player.learnedSkills.indexOf(oldSkillId);
    if (oldIdx >= 0) Stats.player.learnedSkills.splice(oldIdx, 1);
    if (!Stats.player.learnedSkills.includes(newSkillId)) {
      Stats.player.learnedSkills.push(newSkillId);
    }

    const skillName = ({ bareDisarm: '赤手奪刃', leverageThrow: '借力反摔',
                         vitalStrike: '要害打擊', jointBreaker: '關節破' })[series];
    if (typeof Stage !== 'undefined' && Stage.popupBig) {
      Stage.popupBig({
        icon: '✦', title: `${skillName} T${tier}`, subtitle: '你自悟了',
        color: 'gold', duration: 1800, sound: 'acquire',
      });
    }
    _log(`✦ 自悟！${skillName} 升到 T${tier}。`, '#d4af37', true);

    // 🆕 升 T3 後檢查 T4 條件（4 招都 T3 + AGI 35 + DEX 30 + WIL 25）
    if (tier === 3) _checkT4Realize();
  }

  // ══════════════════════════════════════════════════
  // 🆕 2026-04-27 隱藏第 5 次相遇 — 提到巴爺
  // 觸發：4 招都學完 + 巴爺主線完成 + 還沒提過
  // ══════════════════════════════════════════════════
  function _playHiddenBabriusScene() {
    Flags.set('lucius_remembered_babrius', true);

    if (typeof DialogueModal === 'undefined') {
      _log('盧基烏斯：「⋯⋯巴布魯斯。他活著。我以為他也死了。告訴他、斷腳的還記得他。」', '#aa88aa', true);
      return;
    }
    DialogueModal.play([
      { text: '（你又經過 Forum 邊緣的巷弄。）' },
      { text: '（盧基烏斯坐在那裡、一如既往。）' },
      { text: '（你猶豫了一下、開口。）' },
      { speaker: '主角', text: '⋯⋯我跟你提一個人。' },
      { speaker: '盧基烏斯', text: '⋯⋯誰？' },
      { speaker: '主角', text: '巴布魯斯。訓練所的監督官。退役角鬥士。' },
      { text: '（盧基烏斯停住。）' },
      { speaker: '盧基烏斯', text: '⋯⋯哦。' },
      { text: '（他笑了一下、聲音很乾。）' },
      { speaker: '盧基烏斯', text: '他活著。' },
      { speaker: '盧基烏斯', text: '⋯⋯我以為他也死了。' },
      { text: '（沉默。）' },
      { speaker: '盧基烏斯', text: '⋯⋯告訴他、斷腳的還記得他。' },
      { text: '（他不說話了。）' },
      { text: '（你後來才想起來、你忘了問他怎麼認識巴爺的。）' },
    ], {
      onComplete: () => {
        _log('💭 你忘了問他怎麼認識巴爺的。但有些事不需要問。', '#aa88aa', true);
        // 跟巴爺好感有 → 解鎖巴爺額外回應（之後巴爺主線可讀此 flag）
        if (typeof teammates !== 'undefined') {
          teammates.modAffection('lucius', +5, { bypassTrait: true });
        }
      }
    });
  }

  // ══════════════════════════════════════════════════
  // 🆕 2026-04-27 T4 自創招式 — 玩家自定名字
  // ══════════════════════════════════════════════════
  function _checkT4Realize() {
    if (typeof Flags === 'undefined') return;
    if (Flags.has('lucius_t4_created')) return;

    const allT3 = ['disarm', 'throw', 'vital', 'joint'].every(s => Flags.has(`lucius_t3_${s}`));
    if (!allT3) return;

    const agi = (typeof Stats.eff === 'function') ? Stats.eff('AGI') : 0;
    const dex = (typeof Stats.eff === 'function') ? Stats.eff('DEX') : 0;
    const wil = (typeof Stats.eff === 'function') ? Stats.eff('WIL') : 0;
    if (agi < 35 || dex < 30 || wil < 25) return;

    Flags.set('lucius_t4_created', true);
    _playT4CreationScene();
  }

  function _playT4CreationScene() {
    if (typeof DialogueModal === 'undefined') {
      _promptT4Name();
      return;
    }
    DialogueModal.play([
      { text: '（戰鬥結束。你倒在沙地上喘氣。）' },
      { text: '（腦中突然出現一個畫面——這個動作、你從來沒做過。）' },
      { text: '（但你確定它能用。）' },
      { text: '（盧基烏斯沒教過。他師父也沒教過。）' },
      { text: '（這招——是你自己悟出來的。）' },
      { speaker: '主角', text: '⋯⋯這是什麼？' },
      { text: '（你決定給它一個名字。）' },
    ], {
      onComplete: () => _promptT4Name(),
    });
  }

  function _promptT4Name() {
    // 系統決定主導屬性 → 效果類型
    const agi = (typeof Stats.eff === 'function') ? Stats.eff('AGI') : 0;
    const dex = (typeof Stats.eff === 'function') ? Stats.eff('DEX') : 0;
    const wil = (typeof Stats.eff === 'function') ? Stats.eff('WIL') : 0;
    let dominant = 'agi', effDesc = '';
    if (agi >= dex && agi >= wil) {
      dominant = 'agi';
      effDesc = '被攻擊時 50% 機率讓敵人下回合 miss + 自身 EVA +20（3 回合）';
    } else if (dex >= agi && dex >= wil) {
      dominant = 'dex';
      effDesc = '戰鬥開場第 1 回合、必中暴擊（無視所有防禦）';
    } else {
      dominant = 'wil';
      effDesc = 'HP < 30% 時 ATK +30 / CRT +20 / SPD +10（持續至戰鬥結束）';
    }

    let name = null;
    try {
      name = window.prompt(
        `✦ 你自創了一招拳法！\n\n效果：${effDesc}\n\n請給它一個名字（最多 6 字、Enter 跳過用「無名」）：`,
        ''
      );
    } catch (e) { name = null; }
    if (!name || !name.trim()) name = '無名';
    name = name.trim().slice(0, 6);

    // 寫進 player.luciusT4
    Stats.player.luciusT4 = { name, dominant, effDesc };

    // 加進 learnedSkills
    if (!Array.isArray(Stats.player.learnedSkills)) Stats.player.learnedSkills = [];
    if (!Stats.player.learnedSkills.includes('luciusT4')) {
      Stats.player.learnedSkills.push('luciusT4');
    }

    if (typeof Stage !== 'undefined' && Stage.popupBig) {
      Stage.popupBig({
        icon: '✨', title: name, subtitle: '你的拳法',
        color: 'gold', duration: 2400, sound: 'acquire', shake: true,
      });
    }
    _log(`✨ 你自創了【${name}】！效果：${effDesc}`, '#d4af37', true);
  }

  // ══════════════════════════════════════════════════
  // 公開 API
  // ══════════════════════════════════════════════════
  return {
    tryErrandEncounter,
    tryRevisitEncounter,
    recordSkillUsage,
  };
})();
