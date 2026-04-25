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

  // 🆕 2026-04-23 修：bare `addLog` 在 main.js IIFE 外部是 ReferenceError（會吞掉整個治療流程）
  //   統一走 Game.addLog，fallback 到 typeof addLog === 'function'
  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    } else {
      console.warn('[DoctorEvents] _log: no addLog available', text);
    }
  }

  // ══════════════════════════════════════════════════
  // 嘗試觸發醫療訪問
  // 呼叫時機：main.js 在 playMorning + flushDialogues 完成之後呼叫
  // ══════════════════════════════════════════════════
  function tryVisit() {
    const p = Stats.player;
    if (!p || p.day < 10) return false;
    if (typeof Flags === 'undefined') return false;
    if (_lastVisitDay === p.day) return false;       // 今天已訪問過

    // 🆕 2026-04-19：ailments 或 wounds 都可觸發訪視
    const hasAilment = Array.isArray(p.ailments) && p.ailments.length > 0;
    const hasWound   = (typeof Wounds !== 'undefined') && Wounds.hasAnyWound();
    if (!hasAilment && !hasWound) return false;

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
        _tryWoundHintsThenTreat();
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
      onComplete: () => _tryWoundHintsThenTreat(),
    });
  }

  // ══════════════════════════════════════════════════
  // 🆕 2026-04-19 重傷三階段暗示 → 密醫引薦
  // 🆕 2026-04-23 加：手術路線優先判斷（軌 2）
  // ══════════════════════════════════════════════════
  function _tryWoundHintsThenTreat() {
    if (typeof Wounds === 'undefined') { _openTreatmentChoice(); return; }
    const p = Stats.player;
    const severeCount = Wounds.countBySeverity(3);

    // 🆕 2026-04-23 軌 2：手術路線
    //   條件：重傷 ≥ 20 天 + 老默好感 ≥ 40 + 該部位還沒被 offered
    if (_trySurgeryOffer()) return;

    // Stage 3: 密醫引薦（條件：已有 doctor_hinted_black_doc flag + 之後至少 5 天）
    if (Flags.has('doctor_hinted_black_doc') && !Flags.has('got_black_doc_contact')) {
      const sinceHint = Flags.get('days_since_black_doc_hint') || 0;
      if (sinceHint >= 5) {
        _playBlackDocReferral();
        return;
      }
    }

    // Stage 2: 觀察期暗示（重傷 + 已有重傷 10+ 天 + 尚未觸發 Stage 2）
    if (severeCount > 0 && !Flags.has('doctor_hinted_black_doc')) {
      const hasLongSevereWound = Wounds.PARTS.some(part => {
        const w = Wounds.getWound(part);
        return w && w.severity === 3 && w.daysElapsed >= 10;
      });
      if (hasLongSevereWound) {
        _playObservationHint();
        return;
      }
    }

    // Stage 1: 首次重傷提醒（若今天第一次看到玩家有重傷）
    if (severeCount > 0 && !Flags.has('doctor_saw_severe_wound')) {
      Flags.set('doctor_saw_severe_wound', true);
      _playFirstSevereWarning();
      return;
    }

    // 無暗示 → 直接治療
    _openTreatmentChoice();
  }

  // ══════════════════════════════════════════════════
  // 🆕 2026-04-23 軌 2：手術路線
  //   條件：任一部位重傷 ≥ 20 天 + 老默好感 ≥ 40 + 尚未對該部位 offered
  //   選擇：接受 → 部位對應屬性永久 -3 + 重傷消失 + 疤痕特性
  //         拒絕 → 可之後再來，走 _openTreatmentChoice
  // ══════════════════════════════════════════════════
  const PART_TO_ATTR = { head: 'WIL', torso: 'CON', arms: 'STR', legs: 'AGI' };

  function _trySurgeryOffer() {
    const p = Stats.player;
    const aff = teammates.getAffection('doctorMo');
    if (aff < 40) return false;

    // 找到符合條件的部位
    let targetPart = null;
    Wounds.PARTS.forEach(part => {
      if (targetPart) return;
      const w = Wounds.getWound(part);
      if (!w || w.special) return;
      if (w.severity !== 3) return;
      if (w.daysElapsed < 20) return;
      if (Flags.has('surgery_offered_' + part)) return;
      targetPart = part;
    });
    if (!targetPart) return false;

    Flags.set('surgery_offered_' + targetPart, true);
    _playSurgeryOffer(targetPart);
    return true;
  }

  function _playSurgeryOffer(part) {
    const partName = Wounds.PART_NAMES[part];
    const attr = PART_TO_ATTR[part];
    const cost = 30;

    DialogueModal.play([
      { speaker: '老默', text: `你那${partName}——` },
      { text: '（他壓低聲音，確認門外沒有人。）' },
      { speaker: '老默', text: '不會自己好。我看了二十天了。' },
      { speaker: '老默', text: '我可以動手術。' },
      { speaker: '老默', text: '但你得接受——刀是冷的，留下來的疤也冷。' },
      { speaker: '老默', text: `你的${attr}永遠會差一截。但傷會消。` },
    ], {
      onComplete: () => _showSurgeryChoice(part, attr, partName, cost),
    });
  }

  function _showSurgeryChoice(part, attr, partName, cost) {
    const p = Stats.player;
    const canAfford = (p.money || 0) >= cost;

    ChoiceModal.show({
      id: 'doctor_surgery_' + part,
      icon: '🔪',
      title: '手術',
      body: `老默可以替你動刀處理${partName}的重傷。\n付 ${cost} 金。${attr} 永久 -3。但傷會消失。`,
      forced: true,
      choices: [
        {
          id: 'accept',
          label: `動刀（${cost} 金、${attr} -3）`,
          hint:  canAfford ? '一勞永逸' : `錢不夠（需 ${cost}、你有 ${p.money || 0}）`,
          _disabled: !canAfford,
          effects: [],
          resultDialogue: [
            { text: '（他把你按住桌上。）' },
            { text: '（刀的觸感——冷、短、直接。）' },
            { text: '（然後是長長的縫合。）' },
            { text: '（你出來的時候外面天黑了。傷沒了。但你知道那裡永遠會痛。）' },
          ],
          resultEffect: 'red-flash',
        },
        {
          id: 'decline',
          label: '不要',
          hint:  '寧願硬扛下去',
          effects: [],
          resultLog: '你搖頭。老默沒追問——他可以等。',
          logColor:  '#9a8c6a',
        },
      ],
    }, {
      onChoose: (choiceId) => {
        if (choiceId === 'accept' && canAfford) {
          _performSurgery(part, attr, cost);
        }
      },
    });
  }

  function _performSurgery(part, attr, cost) {
    const p = Stats.player;
    Stats.modMoney(-cost);
    // 扣屬性
    p[attr] = Math.max(1, (p[attr] || 10) - 3);
    // 清傷
    Wounds.heal(part);
    // 給疤痕特性
    if (!Array.isArray(p.scars)) p.scars = [];
    const scarId = `scar_${part}_surgery`;
    if (!p.scars.includes(scarId)) p.scars.push(scarId);

    teammates.modAffection('doctorMo', +5);
    Flags.set('had_surgery_' + part, true);
    Stats.advanceTime(240);  // 4 小時

    _log(`🔪 手術完成。${Wounds.PART_NAMES[part]}重傷消失、${attr} -3、獲得疤痕。`, '#cc7744', true);
    if (typeof SoundManager !== 'undefined') SoundManager.playSynth('acquire');
    if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
  }

  function _playFirstSevereWarning() {
    DialogueModal.play([
      { speaker: '老默', text: '……讓我看看。' },
      { text: '他的手指按壓你的傷口。你倒抽一口氣。' },
      { speaker: '老默', text: '這傷我只能幫你止血。' },
      { speaker: '老默', text: '深處的問題——骨頭錯位、神經壞了——' },
      { speaker: '老默', text: '我治不了。' },
      { text: '他沒抬頭，繼續處理你的傷口。' },
    ], { onComplete: () => _openTreatmentChoice() });
  }

  function _playObservationHint() {
    Flags.set('doctor_hinted_black_doc', true);
    Flags.set('days_since_black_doc_hint', 0);
    DialogueModal.play([
      { speaker: '老默', text: '……你還在練。' },
      { speaker: '老默', text: '忍著痛也練。' },
      { text: '他第一次正眼看你。眼裡有點什麼。' },
      { speaker: '老默', text: '我看得出來。你不是放棄的人。' },
      { speaker: '老默', text: '等你準備好——我有個朋友。' },
      { speaker: '老默', text: '住在城南巷子裡。' },
      { text: '你想問什麼，但他又低下頭繼續處理草藥。' },
    ], { onComplete: () => _openTreatmentChoice() });
  }

  function _playBlackDocReferral() {
    Flags.set('got_black_doc_contact', true);
    DialogueModal.play([
      { speaker: '老默', text: '那個朋友——' },
      { speaker: '老默', text: '他不是醫生。' },
      { speaker: '老默', text: '他做的事，神看了會皺眉。' },
      { text: '他從懷裡摸出一張摺好的紙條，放在桌上。' },
      { speaker: '老默', text: '但他能讓你重新跑、重新揮劍。' },
      { speaker: '老默', text: '代價是——你不會再是原本的你。' },
      { speaker: '老默', text: '自己決定。我只能帶你到這裡。' },
      { text: '你收起那張紙條。上面寫著城南某條巷子的暗號。' },
    ], {
      onComplete: () => {
        _log('✦ 獲得物品：密醫紙條（城南接頭暗號）', '#aa88cc', true);
        // 加入個人物品
        const p = Stats.player;
        if (!Array.isArray(p.personalItems)) p.personalItems = [];
        if (p.personalItems.length < 6 && !p.personalItems.includes('black_doc_contact')) {
          p.personalItems.push('black_doc_contact');
        }
        _openTreatmentChoice();
      }
    });
  }

  // ══════════════════════════════════════════════════
  // 🆕 2026-04-23：付費治療系統（軌 1）
  // ══════════════════════════════════════════════════
  //
  // 傷勢費用表（依嚴重度）
  //   輕傷  5 金 → 立刻痊癒
  //   中傷 15 金 → 進入加速期（7 天自癒，設 wound_treated_{part} flag）
  //   重傷 40 金 → 降級為中傷（severity-- 且 daysElapsed 重置）
  //
  // 好感折扣
  //   < 40: 全額
  //   40-59: 8 折
  //   60-79: 5 折
  //   80+: 5 折 + 每 7 天免費 1 次
  //
  const WOUND_COST = { 1: 5, 2: 15, 3: 40 };

  function _calcWoundCost(severity) {
    const aff = (typeof teammates !== 'undefined' && teammates.getAffection)
                  ? teammates.getAffection('doctorMo') : 0;
    const base = WOUND_COST[severity] || 0;

    // 每 7 天免費 1 次（好感 80+）
    if (aff >= 80) {
      const p = Stats.player;
      const nextFreeDay = Flags.get('doctor_next_free_day', 0);
      if (p.day >= nextFreeDay) return { cost: 0, free: true };
    }

    let mult = 1.0;
    if (aff >= 60) mult = 0.5;
    else if (aff >= 40) mult = 0.8;
    return { cost: Math.round(base * mult), free: false };
  }

  // ══════════════════════════════════════════════════
  // 開啟治療選擇（ailments + wounds 都能治）
  // ══════════════════════════════════════════════════
  function _openTreatmentChoice() {
    const p = Stats.player;

    // 收集所有可治項目
    const ailments = (p.ailments || []).slice();
    const woundsList = [];
    if (typeof Wounds !== 'undefined' && p.wounds) {
      Wounds.PARTS.forEach(part => {
        const w = p.wounds[part];
        if (w && !w.special && w.severity >= 1 && w.severity <= 3) {
          woundsList.push({ part, severity: w.severity });
        }
      });
    }

    if (ailments.length === 0 && woundsList.length === 0) {
      _log('——老默皺了皺眉：「你沒有需要處理的傷勢。」', '#9a8c6a', true);
      return;
    }

    const choices = [];

    // Ailment 選項（維持原本免費治療）
    ailments.forEach(aId => {
      const def = (Config.AILMENT_DEFS && Config.AILMENT_DEFS[aId]) || { name: aId, desc: '' };
      choices.push({
        id: 'heal_ailment_' + aId,
        label: '治療【' + def.name + '】',
        hint:  def.desc || '',
        effects: [],
      });
    });

    // 🆕 Wound 選項（付費）
    const playerMoney = p.money || 0;
    woundsList.forEach(({ part, severity }) => {
      const partName = Wounds.PART_NAMES[part];
      const sevName  = Wounds.SEVERITY_NAMES[severity];
      const { cost, free } = _calcWoundCost(severity);
      const canAfford = playerMoney >= cost;
      const costLabel = free ? '（免費・好感優待）' : `${cost} 金`;

      // 顯示效果預期
      let effectText = '';
      if (severity === 1) effectText = '→ 立刻痊癒';
      else if (severity === 2) effectText = '→ 加速癒合（7 天內）';
      else effectText = '→ 降為中傷（可再付費治）';

      choices.push({
        id: 'heal_wound_' + part,
        label: `治療【${partName}・${sevName}】· ${costLabel}`,
        hint:  canAfford ? effectText : `錢不夠（需 ${cost}、你有 ${playerMoney}）`,
        effects: [],
        _disabled: !canAfford,   // 標記無法選（顯示層處理）
      });
    });

    // 「不用了」
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
      body: `你身上的問題不只一個。他只能處理一個——說吧。\n（你有 ${playerMoney} 金）`,
      forced: true,
      choices,
    }, {
      onChoose: (choiceId) => {
        if (choiceId === 'decline') return;
        if (choiceId.startsWith('heal_ailment_')) {
          const aId = choiceId.replace('heal_ailment_', '');
          _performHeal(aId);
        } else if (choiceId.startsWith('heal_wound_')) {
          const part = choiceId.replace('heal_wound_', '');
          _performWoundHeal(part);
        }
      },
    });
  }

  // ══════════════════════════════════════════════════
  // 🆕 2026-04-23：傷勢治療（付費扣錢 + 戲劇化對白 + 震動）
  //   對白依部位 × 嚴重度分版本
  //   重傷治療最戲劇化：4 連痛叫 + 大震動，體現降級過程的痛
  // ══════════════════════════════════════════════════

  // 痛叫行助手（speaker=主角，帶 shake effect）
  const _PAIN = (text, big=false) =>
    ({ speaker: '主角', text, effect: big ? 'shake-big' : 'shake' });

  // 對白池：[part][severity] → lines[]
  const _WOUND_DIALOGUES = {
    arms: {
      1: [
        { speaker: '老默', text: '把袖子捲起來。' },
        { text: '（他的手指掃過你手臂的擦傷，一圈藥粉、一層紗布。）' },
        { speaker: '老默', text: '擦破皮而已。下次別這麼粗心。' },
      ],
      2: [
        { speaker: '老默', text: '把袖子捲起來。我看看。' },
        { text: '（他按壓腫起的地方。）' },
        _PAIN('痛!'),
        { speaker: '老默', text: '嗯。裡面有血腫。我要放出來。' },
        _PAIN('痛~~'),
        { speaker: '老默', text: '綁帶纏緊了。七天內別出力。' },
      ],
      3: [
        { speaker: '老默', text: '我幫你把繃帶打開看。' },
        _PAIN('痛~'),
        { speaker: '老默', text: '嗯⋯⋯傷得不輕。我先清洗一下。' },
        _PAIN('痛~~'),
        { speaker: '老默', text: '看來骨頭歪了。我幫你歸位。咬著這個。' },
        _PAIN('痛!'),
        _PAIN('痛痛痛!'),
        _PAIN('啊啊啊啊啊——!!!', true),
        { speaker: '老默', text: '固定好了。' },
        { speaker: '老默', text: '手臂保住了。但別馬上去揮重東西。' },
      ],
    },
    legs: {
      1: [
        { speaker: '老默', text: '腿——坐。' },
        { text: '（他蹲下來，輕輕擦過你小腿的擦傷。）' },
        { speaker: '老默', text: '小傷。走路注意點。' },
      ],
      2: [
        { speaker: '老默', text: '坐。把腿伸直。' },
        { text: '（他的手指順著膝蓋往下探。）' },
        _PAIN('啊!'),
        { speaker: '老默', text: '韌帶扭了。還好骨頭沒事。' },
        { speaker: '老默', text: '我幫你貼膏藥——會燙。' },
        _PAIN('痛~'),
        { speaker: '老默', text: '三天別走太遠。' },
      ],
      3: [
        { speaker: '老默', text: '腿——讓我看膝蓋。' },
        { text: '（他脫掉舊綁帶。）' },
        _PAIN('痛!'),
        { speaker: '老默', text: '血淤在裡面。我先放出來。' },
        _PAIN('啊~'),
        { speaker: '老默', text: '現在把骨頭歸位。咬著這塊布。' },
        _PAIN('唔!'),
        _PAIN('唔唔!!'),
        _PAIN('啊啊啊啊啊——!!!', true),
        { speaker: '老默', text: '上夾板了。' },
        { speaker: '老默', text: '三天別走路。不然白治。' },
      ],
    },
    torso: {
      1: [
        { speaker: '老默', text: '衣服掀開。' },
        { text: '（他替你上藥、換繃帶。）' },
        { speaker: '老默', text: '表皮而已。注意別感染。' },
      ],
      2: [
        { speaker: '老默', text: '衣服掀開。' },
        { text: '（他把耳朵貼在你胸前聽。）' },
        { speaker: '老默', text: '肋骨有裂。不嚴重。' },
        { speaker: '老默', text: '深呼吸。' },
        _PAIN('呼⋯⋯痛!'),
        { speaker: '老默', text: '我把綁帶纏緊。' },
        { speaker: '老默', text: '七天內別深呼吸、別笑、別咳嗽。' },
      ],
      3: [
        { speaker: '老默', text: '衣服全掀開。我聽聽。' },
        { text: '（他把耳朵貼在你胸前，很久。）' },
        { speaker: '老默', text: '三根肋骨斷了。其中一根歪進去了。' },
        { speaker: '老默', text: '我要把它扶出來。準備好。' },
        { speaker: '主角', text: '⋯⋯準備好了。' },
        { speaker: '老默', text: '吸一口氣。' },
        _PAIN('啊!'),
        { speaker: '老默', text: '再一口。' },
        _PAIN('啊啊!'),
        { speaker: '老默', text: '最後——' },
        _PAIN('啊啊啊啊啊——!!!', true),
        { speaker: '老默', text: '綁帶纏緊了。' },
        { speaker: '老默', text: '七天內不要笑、不要咳、不要打噴嚏。' },
      ],
    },
    head: {
      1: [
        { speaker: '老默', text: '讓我看看。' },
        { text: '（他擦過你額頭的擦傷。）' },
        { speaker: '老默', text: '沒事。注意別沾水。' },
      ],
      2: [
        { speaker: '老默', text: '讓我看眼睛。' },
        { text: '（他用手指檢查你瞳孔。）' },
        { speaker: '老默', text: '頭暈不暈?' },
        { speaker: '主角', text: '⋯⋯有點。' },
        { speaker: '老默', text: '輕微腦震盪。我給你草藥。' },
        { speaker: '老默', text: '頭上這口子要縫。' },
        _PAIN('痛~'),
        { speaker: '老默', text: '三天內別晃。' },
      ],
      3: [
        { speaker: '老默', text: '讓我看眼睛。' },
        { text: '（他用手指撐開你眼皮，拿燈照過去。）' },
        { speaker: '老默', text: '瞳孔反應不對。你記得今天是幾號嗎?' },
        { speaker: '主角', text: '⋯⋯' },
        { speaker: '老默', text: '沒事。我知道了。' },
        { speaker: '老默', text: '頭骨凹陷了一塊。我要把它頂回去。' },
        _PAIN('什麼?'),
        { speaker: '老默', text: '忍著。' },
        _PAIN('啊!'),
        _PAIN('啊啊!'),
        _PAIN('啊啊啊啊——!!!', true),
        { speaker: '老默', text: '好了。縫起來。' },
        { speaker: '老默', text: '三天內絕對不要晃腦袋。' },
      ],
    },
    // 精神傷（mind）用預設 fallback
  };

  function _getWoundDialogue(part, severity) {
    const byPart = _WOUND_DIALOGUES[part];
    if (byPart && byPart[severity]) return byPart[severity];
    // Fallback（主要給 mind 部位）
    const partName = Wounds.PART_NAMES[part] || part;
    const sevName  = Wounds.SEVERITY_NAMES[severity] || '傷勢';
    return [
      { speaker: '老默', text: `${partName}。讓我看看。` },
      { text: '（他熟練地處理了傷口。）' },
      { speaker: '老默', text: `${sevName}。好了。` },
    ];
  }

  function _performWoundHeal(part) {
    console.log('[DoctorEvents] _performWoundHeal called for part:', part);
    const p = Stats.player;
    const w = p.wounds && p.wounds[part];
    if (!w || w.special) {
      _log('——（找不到對應傷勢。）', '#cc3333', true);
      return;
    }

    const { cost, free } = _calcWoundCost(w.severity);
    const playerMoney = p.money || 0;
    if (playerMoney < cost) {
      _log(`——錢不夠（需 ${cost} 金）。老默把器械放回桌上，沒說話。`, '#cc3333', true);
      if (typeof SoundManager !== 'undefined') SoundManager.playSynth('debuff');
      return;
    }

    console.log(`[DoctorEvents] treating ${part}, sev=${w.severity}, cost=${cost}, free=${free}`);

    const partName = Wounds.PART_NAMES[part];
    const sevName  = Wounds.SEVERITY_NAMES[w.severity];
    const origSev  = w.severity;

    // 🆕 2026-04-23：治療數值立刻套用（對白純粹戲劇演出）
    if (cost > 0) {
      const ok = Stats.modMoney(-cost);
      console.log(`[DoctorEvents] modMoney(-${cost}) => ${ok}, money now = ${p.money}`);
    }
    if (free) Flags.set('doctor_next_free_day', p.day + 7);

    // 🆕 2026-04-25 修：付錢都直接痊癒（之前中傷 / 重傷只「進入加速期」、玩家覺得 bug）
    //   設計上：玩家付了錢就應該看到傷勢消失、不該還掛在角色頁
    //   重傷貴是因為要花更久才能治好（時間成本仍體現在 advanceTime 90 分鐘）
    Wounds.heal(part);
    let resultText;
    if (origSev === 1) {
      resultText = `✦ ${partName}${sevName}痊癒了。`;
    } else if (origSev === 2) {
      resultText = `✦ ${partName}處理完畢、傷已平復。`;
    } else {
      resultText = `✦ ${partName}重傷已徹底處理完畢。`;
    }

    // 時間 + 好感
    teammates.modAffection('doctorMo', +3);
    const timeCost = origSev === 3 ? 90 : origSev === 2 ? 60 : 30;
    Stats.advanceTime(timeCost);

    // 進場 log — 確認治療流程已啟動（走 _log 避免 ReferenceError）
    _log(`⚕ 你去找老默治療${partName}。`, '#aaaa88', false);

    // 先 render 一次（讓金錢 / 傷勢格立刻更新）
    if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();

    // 對白（對白失敗也不影響治療已完成的事實）
    const lines = _getWoundDialogue(part, origSev).slice();
    if (cost > 0 && !free) {
      lines.push({ speaker: '老默', text: `${cost} 金。不用謝。` });
    } else if (free) {
      lines.push({ speaker: '老默', text: '這次不收你的。別養成習慣。' });
    }

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => {
          // 🆕 2026-04-25：付錢治療成功後 — 大字 POPUP + 震動 + 綠光
          if (typeof Stage !== 'undefined' && Stage.popupBig) {
            Stage.popupBig({
              icon: '✦',
              title: '傷勢痊癒',
              subtitle: partName + '已平復',
              color: 'green',
              duration: 1600,
              shake: true,
              sound: 'acquire',
            });
          } else if (typeof SoundManager !== 'undefined') {
            SoundManager.playSynth('acquire');
          }
          _log(resultText, '#88cc77', true);
          if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
        },
      });
    } else {
      _log(resultText, '#88cc77', true);
    }
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

    // 🆕 2026-04-23：治療效果立刻套用（避免對白期間 throw 導致治療失效）
    p.ailments.splice(idx, 1);
    if (ailmentId === 'insomnia_disorder') {
      p.insomniaStreak = 0;
      p.normalSleepStreak = 0;
    }
    teammates.modAffection('doctorMo', +5);
    if (typeof Stats.advanceTime === 'function') Stats.advanceTime(240);

    // 先 render（數值變動立刻反映）
    if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();

    DialogueModal.play(lines, {
      onComplete: () => {
        // 結果 log（放在 onComplete 是為了播完對白再報訊）
        if (ailmentId === 'insomnia_disorder') {
          // 🆕 D.28：60% 根除（7 天免疫期）/ 40% 只是暫時壓制
          if (Math.random() < 0.60) {
            Flags.set('insomnia_immunity_until', p.day + 7);
            _log('⚕ 老默的藥很對症。你覺得頭腦清明——那種根深的疲憊消散了。', '#88d870', true);
          } else {
            _log('⚕ 藥暫時壓住了症狀。但那種疲憊還在底層——希望夠撐。', '#c8a060', false);
          }
        } else {
          _log(`⚕ 【${def.name}】已治癒。`, '#88d870', true);
        }
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
