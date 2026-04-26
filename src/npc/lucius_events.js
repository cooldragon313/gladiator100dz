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
  // 工具：紀錄拳法招式使用次數（給未來 T2/T3 自悟用）
  // ══════════════════════════════════════════════════
  function recordSkillUsage(skillId) {
    if (!skillId) return;
    if (typeof Flags === 'undefined') return;
    const fistSkills = ['bareDisarm', 'leverageThrow', 'vitalStrike', 'jointBreaker'];
    if (!fistSkills.includes(skillId)) return;
    Flags.increment('lucius_skill_use_count', 1);
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
