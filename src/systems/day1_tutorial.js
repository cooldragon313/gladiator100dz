/**
 * day1_tutorial.js — Day 1 教學鏈（內心獨白式、不出 UI 提示）
 *
 * 設計：2026-04-29 user 反饋「兒子測試完全不知道要幹啥」
 * 哲學：CLAUDE.md「零介面提示、全部由 NPC 對話帶出」+ 玩家內心獨白
 *
 * 4 階段（依序觸發、每階段亮一個按鈕）：
 *   1. 鞭打發呆        — wakeup 結束後立刻演 → 訓練按鈕亮
 *   2. 第一次訓練完     — 內心感受 EXP 概念 → 休息按鈕亮
 *   3. 第一次休息（被抓）— 鞭打 + 內心 → 奧蘭出現邀冥想 → 冥想按鈕亮
 *   4. 第一次冥想完     — 奧蘭講協力 + 卡西烏斯解釋六維 → 教學完
 *
 * Flag 推進：
 *   tut_overseer_whipped  → 鞭打演完
 *   tut_first_train_done  → 第一次訓練完
 *   tut_first_rest_done   → 休息被抓 + 奧蘭邀完
 *   tut_first_meditate_done → 冥想 + 協力 + 六維解釋完（= 教學結束）
 *
 * Day 1 的 NPC 場景由 main.js rollDailyNPCs 鎖：teammates=[]、audience=[overseer]
 *   奧蘭在第 3 階段事件完成後動態加入 currentNPCs.teammates
 */
const Day1Tutorial = (() => {

  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    }
  }

  function getStep() {
    if (typeof Flags === 'undefined') return 'whipped';
    if (Flags.has('tut_first_meditate_done')) return 'done';
    if (Flags.has('tut_first_rest_done'))     return 'meditate';   // 該冥想
    if (Flags.has('tut_first_train_done'))    return 'rest';       // 該休息
    if (Flags.has('tut_overseer_whipped'))    return 'train';      // 該訓練
    return 'whip';                                                  // 該演鞭打
  }

  function isDone() {
    return getStep() === 'done';
  }

  /**
   * renderActionList 用：判斷此 actionId 是否該發亮。
   * 教學完成或 Day > 1 → 永遠不亮。
   *
   * 🆕 2026-04-29 改：訓練完後不亮按鈕、直接導向「點詳細升屬性」（既有金徽章）
   *   升屬性後再亮冥想（奧蘭已邀）。soloThink 階段移除。
   */
  function shouldGlowAction(actionId) {
    if (typeof Stats === 'undefined' || !Stats.player) return false;
    if (Stats.player.day !== 1) return false;
    const step = getStep();
    if (step === 'train'    && actionId === 'basicSwing') return true;
    if (step === 'meditate' && actionId === 'meditation') return true;
    return false;
  }

  // ══════════════════════════════════════════════════
  // 階段 1：wakeup 完成 → 鞭打發呆
  // ══════════════════════════════════════════════════
  function tryAfterWakeup() {
    if (typeof Flags === 'undefined') return;
    if (Flags.has('tut_overseer_whipped')) return;
    Flags.set('tut_overseer_whipped', true);

    if (typeof DialogueModal === 'undefined') {
      _log('塔倫長官：「愣著幹什麼？開練！」', '#cc6633', true);
      if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
      return;
    }

    DialogueModal.play([
      { text: '（你站在訓練場、不知所措。）' },
      { text: '（鞭子的聲音劃過空氣——還沒打到你、但離你很近。）' },
      { speaker: '塔倫長官', text: '愣著幹什麼？' },
      { speaker: '塔倫長官', text: '開練！' },
      { text: '（你低頭、緊握拳頭。）' },
      { text: '（你心想：⋯⋯先去找個項目訓練吧。）' },
      { text: '（你心想：免得等等真的被打。）' },
    ], {
      onComplete: () => {
        // 🆕 2026-04-29：有 origin 起手傷 → 演發現受傷 + 老默場景（強制治療流程）
        if (typeof Wounds !== 'undefined' && Wounds.hasAnyWound && Wounds.hasAnyWound()) {
          _playOriginWoundDiscovery();
          return;
        }
        // 沒傷 → 直接 popup「開始訓練」
        _showStartTrainingPopup();
      }
    });
  }

  // 🆕 2026-04-29：開場有傷 → 演「發現受傷」 + 老默強制治療流程
  function _playOriginWoundDiscovery() {
    const p = Stats.player;
    let worstPart = null, worstSev = 0;
    Wounds.PARTS.forEach(part => {
      const w = p.wounds[part];
      if (!w || w.special) return;        // 特殊傷另議、不走標準 forced flow
      if (w.severity > worstSev) { worstPart = part; worstSev = w.severity; }
    });
    if (!worstPart) {
      // 全是特殊傷、跳過 forced flow、直接訓練 popup
      _showStartTrainingPopup();
      return;
    }
    const partName = Wounds.PART_NAMES[worstPart] || '身體';
    const sevName  = Wounds.SEVERITY_NAMES[worstSev] || '傷';

    if (typeof Stage !== 'undefined' && Stage.popupBig) {
      Stage.popupBig({
        icon: '💔',
        title: `${partName}${sevName}！`,
        subtitle: '⋯⋯昨天的傷還沒好',
        color: 'red',
        duration: 1600,
        shake: worstSev >= 2,
        sound: 'hit_crit',
        onComplete: () => {
          if (typeof DoctorEvents !== 'undefined' && DoctorEvents.tryForcedTreatment) {
            DoctorEvents.tryForcedTreatment(worstPart, worstSev, 'capture');
          } else {
            _showStartTrainingPopup();
          }
        },
      });
    } else if (typeof DoctorEvents !== 'undefined' && DoctorEvents.tryForcedTreatment) {
      DoctorEvents.tryForcedTreatment(worstPart, worstSev, 'capture');
    } else {
      _showStartTrainingPopup();
    }
  }

  function _showStartTrainingPopup() {
    if (typeof Stage !== 'undefined' && Stage.popupBig) {
      Stage.popupBig({
        icon: '⚔', title: '開始訓練', subtitle: '訓練動作會發光、點下去就能開始',
        color: 'gold', duration: 1600, shake: false, sound: 'level_up',
        onComplete: () => {
          if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
        },
      });
    } else if (typeof Game !== 'undefined' && Game.renderAll) {
      Game.renderAll();
    }
  }

  // ══════════════════════════════════════════════════
  // 階段 2-4：訓練 / 休息 / 冥想 完成後 hook
  // ══════════════════════════════════════════════════
  function tryAfterAction(actionId) {
    if (typeof Flags === 'undefined') return;
    if (typeof Stats === 'undefined' || !Stats.player) return;
    if (Stats.player.day !== 1) return;
    if (!Flags.has('tut_overseer_whipped')) return;

    if (actionId === 'basicSwing' && !Flags.has('tut_first_train_done')) {
      Flags.set('tut_first_train_done', true);
      _playAfterFirstTrain();
      return;
    }
    // 🆕 2026-04-29 移除 soloThink 觸發（user 反饋：「點完屬性升級沒看到奧蘭」）
    //   奧蘭改在升屬性後觸發、走 tryAfterAttrUpgrade
    if (actionId === 'meditation' && Flags.has('tut_first_rest_done') && !Flags.has('tut_first_meditate_done')) {
      Flags.set('tut_first_meditate_done', true);
      _playAfterMeditation();
      return;
    }
  }

  // 🆕 2026-04-29 升屬性後觸發奧蘭邀冥想
  //   呼叫時機：main.js 升屬性按鈕成功後
  function tryAfterAttrUpgrade(attr) {
    if (typeof Flags === 'undefined') return;
    if (typeof Stats === 'undefined' || !Stats.player) return;
    if (Stats.player.day !== 1) return;
    if (!Flags.has('tut_first_train_done')) return;
    if (Flags.has('tut_first_rest_done')) return;   // 已演過奧蘭邀冥想

    Flags.set('tut_first_rest_done', true);
    _playOrlanInvite();
  }

  // 階段 2：訓練完 → 內心感受 EXP / 屬性
  function _playAfterFirstTrain() {
    if (typeof DialogueModal === 'undefined') {
      _log('（你心想：力氣好像增加了一點什麼⋯⋯）', '#88cc77', true);
      if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
      return;
    }
    DialogueModal.play([
      { text: '（你放下手裡的石頭。）' },
      { text: '（手酸——但是好的那種酸。）' },
      { text: '（你心想：⋯⋯力氣好像、增加了什麼。）' },
      { text: '（你心想：剛剛長官說「練了會變強」、原來是這意思？）' },
      { text: '（你低頭看手心。掌心裡沒東西、但你知道有東西進來了。）' },
      { text: '（你心想：右上角那個「詳細」⋯⋯應該可以查看吧？）' },
    ], {
      onComplete: () => {
        if (typeof Stage !== 'undefined' && Stage.popupBig) {
          Stage.popupBig({
            icon: '✦', title: '去看詳細', subtitle: '右上角「詳細」按鈕花 EXP 升屬性',
            color: 'gold', duration: 2000, shake: false, sound: 'level_up',
            onComplete: () => {
              _log('💡 點右上角「詳細」按鈕、花 EXP 把力量升一級。', '#d4af37', true);
              if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
            },
          });
        } else {
          _log('💡 點右上角「詳細」按鈕、花 EXP 升屬性。', '#d4af37', true);
          if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
        }
      }
    });
  }

  // 階段 3：升完屬性 → 奧蘭出現邀冥想
  function _playOrlanInvite() {
    if (typeof DialogueModal === 'undefined') {
      _log('奧蘭：「⋯⋯記得我嗎？我是同房的奧蘭。要不要一起打坐？」', '#88aacc', true);
      _addOrlanToScene();
      if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
      return;
    }
    DialogueModal.play([
      { text: '（你剛升完屬性、感覺身體裡的某個東西扎實了一點。）' },
      { text: '（有人從你身後拍了一下。）' },
      { speaker: '奧蘭', text: '嘿。' },
      { speaker: '奧蘭', text: '⋯⋯記得我嗎？我是同房的、奧蘭。' },
      { text: '（他笑了一下、看起來剛練完一輪。）' },
      { speaker: '奧蘭', text: '我看你練得挺認真。' },
      { speaker: '奧蘭', text: '要不要⋯⋯一起打坐？' },
      { speaker: '奧蘭', text: '我們家鄉的人相信、透過冥想能讓自己強大。' },
      { speaker: '奧蘭', text: '「相信自己」是一種很強的能力喔。' },
    ], {
      onComplete: () => {
        _addOrlanToScene();
        if (typeof Stage !== 'undefined' && Stage.popupBig) {
          Stage.popupBig({
            icon: '🧘', title: '一起冥想', subtitle: '奧蘭邀你打坐——冥想動作會發光',
            color: 'cyan', duration: 1800, shake: false, sound: 'acquire',
            onComplete: () => {
              if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
            },
          });
        } else if (typeof Game !== 'undefined' && Game.renderAll) {
          Game.renderAll();
        }
      }
    });
  }

  // 把奧蘭加進 currentNPCs.teammates（事件驅動加入）
  function _addOrlanToScene() {
    if (typeof window === 'undefined') return;
    const cur = (typeof GameState !== 'undefined') ? GameState.getCurrentNPCs() : null;
    if (!cur) return;
    if (!Array.isArray(cur.teammates)) cur.teammates = [];
    if (!cur.teammates.includes('orlan')) cur.teammates.push('orlan');
  }

  // 階段 4：冥想完 → 奧蘭講協力 + 卡西烏斯解釋六維
  function _playAfterMeditation() {
    if (typeof DialogueModal === 'undefined') {
      _log('奧蘭：「有朋友一起練、是不是真的比較有效率？」', '#88aacc', true);
      _log('卡西烏斯：「力氣、靈巧、體質、反應、意志、運氣——六種維度。練什麼、就強什麼。」', '#aabbcc', true);
      if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
      return;
    }
    DialogueModal.play([
      { text: '（你睜開眼。）' },
      { text: '（心比剛才靜一點。呼吸也順了。）' },
      { speaker: '奧蘭', text: '嘿。怎樣？' },
      { speaker: '奧蘭', text: '⋯⋯有朋友一起練、是不是真的比較有效率？' },
      { speaker: '奧蘭', text: '我師父說、「兩個人想同一件事、力量會加倍」。' },
      { speaker: '奧蘭', text: '我們倆現在的精神都比剛剛好——你感覺到了嗎？' },
      { text: '（卡西烏斯遠遠走過來、看了你一眼、停下。）' },
      { speaker: '卡西烏斯', text: '⋯⋯' },
      { speaker: '卡西烏斯', text: '力氣、靈巧、體質、反應、意志、運氣。' },
      { speaker: '卡西烏斯', text: '六種維度。' },
      { speaker: '卡西烏斯', text: '你練什麼、那個就會長。' },
      { speaker: '卡西烏斯', text: '練不夠、那個就空。' },
      { speaker: '卡西烏斯', text: '⋯⋯記住了。' },
      { text: '（他轉身走了、沒等你回話。）' },
      { text: '⋯⋯' },
      { text: '（你心想：⋯⋯我好像感覺到什麼、進入了身體裡。）' },
      { text: '（你心想：原來這就是「練了會變強」。）' },
    ], {
      onComplete: () => {
        if (typeof Stage !== 'undefined' && Stage.popupBig) {
          Stage.popupBig({
            icon: '✦', title: '教學完成', subtitle: '專心練哪個、就強哪個——剩下交給你',
            color: 'gold', duration: 2200, shake: false, sound: 'acquire',
            onComplete: () => {
              _log('✦ 教學完成。剩下時段自由訓練、就寢結束今天。', '#d4af37', true);
              if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
            },
          });
        } else {
          _log('✦ 教學完成。', '#d4af37', true);
          if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
        }
      }
    });
  }

  return {
    getStep,
    isDone,
    shouldGlowAction,
    tryAfterWakeup,
    tryAfterAction,
    tryAfterAttrUpgrade,   // 🆕 2026-04-29 升屬性後 → 奧蘭邀冥想
  };
})();
