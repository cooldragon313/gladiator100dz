/**
 * doctor_events.js — 醫生老默治療系統（D.22）
 * ══════════════════════════════════════════════════
 * Phase 1 哲學：奴隸沒自主權 — 玩家不能主動去看醫生，
 * 而是主人（為了保護投資）派侍從帶玩家去醫療房。
 *
 * 觸發機制：
 *   - 玩家有病痛 / 傷勢時，DayCycle.onDayStart 檢查
 *   - 第一次：保證觸發（Day ≥ 10 且首次有 ailment）
 *   - 之後：隨機觸發（35% 機率/天），直到所有 ailment 都治完
 *
 * 治療機制：
 *   - 每次 visit 治好 1 個 ailment（玩家可選治哪個）
 *   - 治療本身免費，但有時間成本（消耗半天 = 2 slots）
 *   - 對話品質依玩家道德特性而異（likedTraits 觸發更溫暖的台詞）
 *
 * 特殊條件：
 *   - 如果奧蘭藥房懸念未解（saw_olan_at_apothecary 且未 resolved）→ 老默會暗示
 *
 * 依賴：
 *   - ChoiceModal, DialogueModal
 *   - teammates (npc.js, 讀取愛憎), Stats, Flags, Config.AILMENT_DEFS
 */
const DoctorEvents = (() => {

  // 本模組私有：最近一次訪問的天數（取代 doctor_visit_today flag）
  let _lastVisitDay = -1;

  // ══════════════════════════════════════════════════
  // 嘗試觸發醫療訪問
  // 呼叫時機：main.js 在 playMorning + flushDialogues 完成之後呼叫
  // ══════════════════════════════════════════════════
  function tryVisit() {
    const p = Stats.player;
    if (!p || p.day < 10) return false;
    if (typeof Flags === 'undefined') return false;
    if (_lastVisitDay === p.day) return false;       // 今天已訪問過
    if (!Array.isArray(p.ailments) || p.ailments.length === 0) return false;

    // 第一次保證觸發；之後 35% 機率
    const firstVisit = !Flags.has('met_doctor');
    if (!firstVisit && Math.random() >= 0.35) return false;

    _lastVisitDay = p.day;

    if (firstVisit) {
      _firstVisit();
    } else {
      _recurringVisit();
    }
    return true;
  }

  // ══════════════════════════════════════════════════
  // 第一次見面 — 完整演出
  // ══════════════════════════════════════════════════
  function _firstVisit() {
    const p = Stats.player;
    const hasApothecaryMystery = Flags.has('saw_olan_at_apothecary') && !Flags.has('olan_apothecary_resolved');

    const introLines = [
      { text: '一個侍從走進來，冷冷地說——' },
      { speaker: '侍從', text: '主人說你最近傷太多。影響訓練。' },
      { speaker: '侍從', text: '走吧——老默要看看你。' },
      { text: '你被帶到訓練所後方的一個小房間。' },
      { text: '空氣裡有烈酒和草藥混雜的味道。' },
      { text: '一個灰鬍子的男人坐在桌前，手裡握著一個小陶瓶。' },
      { speaker: '老默', text: '……坐。' },
      { text: '他喝了一口瓶裡的東西，然後把瓶子放下。' },
      { text: '那隻手完全沒抖。' },
      { speaker: '老默', text: '我是醫生。沒人叫我老默以外的名字——包括主人。' },
      { speaker: '老默', text: '你被帶來，代表你身上有東西在慢慢殺你。' },
      { speaker: '老默', text: '我會處理。但有些話先講清楚。' },
      { speaker: '老默', text: '我不會替你隱瞞傷勢。主人問起——我照實說。' },
      { speaker: '老默', text: '我也不會問你怎麼受傷的。那不是我的事。' },
    ];

    // 若有藥房懸念 → 老默多一句暗示
    if (hasApothecaryMystery) {
      introLines.push(
        { speaker: '老默', text: '另外——' },
        { speaker: '老默', text: '我這裡偶爾會少一些草藥。' },
        { speaker: '老默', text: '有時候是老鼠偷的。有時候不是。' },
        { text: '他看了你一眼。眼神裡有東西，但你讀不懂。' },
      );
    }

    DialogueModal.play(introLines, {
      onComplete: () => {
        Flags.set('met_doctor', true);
        teammates.modAffection('doctorMo', +5);
        _openTreatmentChoice();
      },
    });
  }

  // ══════════════════════════════════════════════════
  // 後續訪問 — 簡短對話
  // ══════════════════════════════════════════════════
  function _recurringVisit() {
    const p = Stats.player;
    const affMo = teammates.getAffection('doctorMo');

    // 依好感度展開不同開場
    let introLines;
    if (affMo >= 40) {
      introLines = [
        { text: '侍從又帶你來了老默那裡。' },
        { speaker: '老默', text: '……又是你。' },
        { text: '他沒抬頭，但你感覺得出來他的語氣裡有點東西。' },
        { speaker: '老默', text: '坐。讓我看看。' },
      ];
    } else {
      introLines = [
        { text: '侍從又把你帶到老默的房間。' },
        { speaker: '老默', text: '坐。' },
        { text: '他繼續研磨著手上的草藥。' },
      ];
    }

    DialogueModal.play(introLines, {
      onComplete: () => _openTreatmentChoice(),
    });
  }

  // ══════════════════════════════════════════════════
  // 開啟治療選擇（列出所有 ailment 讓玩家挑）
  // ══════════════════════════════════════════════════
  function _openTreatmentChoice() {
    const p = Stats.player;
    const list = (p.ailments || []).slice();
    if (list.length === 0) {
      addLog('——老默皺了皺眉：「你沒有需要處理的傷勢。」', '#9a8c6a', true, true);
      return;
    }

    const choices = list.map(aId => {
      const def = (Config.AILMENT_DEFS && Config.AILMENT_DEFS[aId]) || { name: aId, desc: '' };
      return {
        id: 'heal_' + aId,
        label: '治療【' + def.name + '】',
        hint:  def.desc || '',
        effects: [],   // 實際治療在 onChoose 執行，因為要從 ailments 陣列刪
        // 注意：沒有 type:'ailment_remove' 這個 dispatcher 類型，所以用 callback
      };
    });

    // 加一個「不用了」選項
    choices.push({
      id: 'decline',
      label: '不用了',
      hint: '你甚麼都不想讓他碰。',
      effects: [
        { type:'affection', key:'doctorMo', delta:-5 },
      ],
      resultLog: '你搖頭走出房間。老默沒有追問。',
      logColor:  '#9a8c6a',
    });

    ChoiceModal.show({
      id: 'doctor_treatment',
      icon: '⚕',
      title: '老默沉默地等你做決定',
      body: '你身上的問題不只一個。他只能處理一個——說吧。',
      forced: true,
      choices,
    }, {
      onChoose: (choiceId) => {
        if (choiceId === 'decline') return;
        const ailmentId = choiceId.replace(/^heal_/, '');
        _performHeal(ailmentId);
      },
    });
  }

  // ══════════════════════════════════════════════════
  // 實際治療（移除一個 ailment + 播對話 + 好感 + 時間扣除）
  // ══════════════════════════════════════════════════
  function _performHeal(ailmentId) {
    const p = Stats.player;
    if (!Array.isArray(p.ailments)) return;
    const idx = p.ailments.indexOf(ailmentId);
    if (idx < 0) return;

    const def = (Config.AILMENT_DEFS && Config.AILMENT_DEFS[ailmentId]) || { name: ailmentId };

    // 依 ailment 給不同敘述
    let lines;
    switch (ailmentId) {
      case 'insomnia_disorder':
        lines = [
          { speaker: '老默', text: '睡不著？' },
          { text: '他拿出一個小布包，倒出一些深色的草粉。' },
          { speaker: '老默', text: '這東西睡前配水吞下。三天後就會好。' },
          { speaker: '老默', text: '別跟別人說你有這個——在這裡，睡不著是弱點。' },
          { text: '你把草粉收下。他沒再多講什麼。' },
        ];
        break;
      case 'arm_injury':
        lines = [
          { speaker: '老默', text: '手臂。讓我看。' },
          { text: '他的手指冰冷但精準。按壓、拉伸、判斷。' },
          { speaker: '老默', text: '沒斷。但筋膜裂了。' },
          { text: '他從旁邊拿起一卷布，熟練地纏緊你的手臂。' },
          { speaker: '老默', text: '三天別出力。別逞強。' },
        ];
        break;
      case 'leg_injury':
        lines = [
          { speaker: '老默', text: '腿——坐。' },
          { text: '他蹲下來，輕輕按過你的小腿。' },
          { speaker: '老默', text: '膝蓋韌帶拉傷。走路注意。' },
          { text: '他拿出一張藥膏貼布。' },
          { speaker: '老默', text: '熱的。會痛。但有效。' },
        ];
        break;
      case 'torso_injury':
        lines = [
          { speaker: '老默', text: '肋骨。呼吸。' },
          { text: '他把耳朵貼在你胸前聽了幾秒。' },
          { speaker: '老默', text: '一根輕微裂痕。沒刺到肺。算運氣好。' },
          { text: '他拿出綁帶把你胸口纏緊。' },
          { speaker: '老默', text: '接下來七天別深呼吸。也別哭。' },
        ];
        break;
      default:
        lines = [
          { speaker: '老默', text: '嗯。' },
          { text: '他熟練地處理了傷口。' },
          { speaker: '老默', text: '好了。下一個。' },
        ];
    }

    DialogueModal.play(lines, {
      onComplete: () => {
        // 真正移除 ailment
        p.ailments.splice(idx, 1);
        // 對應 streak 重置
        if (ailmentId === 'insomnia_disorder') {
          p.insomniaStreak = 0;
          p.normalSleepStreak = 0;
        }

        // 時間成本（半天 = 2 slots）— 如果有 advanceTime
        if (typeof Stats.advanceTime === 'function') {
          Stats.advanceTime(240);  // 240 min = 4 小時 = 2 slots
        }

        // 好感 +5
        teammates.modAffection('doctorMo', +5);

        addLog(`⚕ 【${def.name}】已治癒。`, '#88d870', true, true);

        // 重新渲染
        if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
      },
    });
  }

  // ══════════════════════════════════════════════════
  // 序列化（讀檔後恢復 _lastVisitDay）
  // ══════════════════════════════════════════════════
  function serialize() {
    return { lastVisitDay: _lastVisitDay };
  }
  function restore(data) {
    if (data && typeof data.lastVisitDay === 'number') {
      _lastVisitDay = data.lastVisitDay;
    }
  }
  function reset() {
    _lastVisitDay = -1;
  }

  return {
    tryVisit,
    serialize,
    restore,
    reset,
    _firstVisit,  // debug
  };
})();
