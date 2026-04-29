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
   */
  function shouldGlowAction(actionId) {
    if (typeof Stats === 'undefined' || !Stats.player) return false;
    if (Stats.player.day !== 1) return false;
    const step = getStep();
    if (step === 'train'    && actionId === 'basicSwing') return true;
    if (step === 'rest'     && actionId === 'soloThink')  return true;
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
    });
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
    if (actionId === 'soloThink' && Flags.has('tut_first_train_done') && !Flags.has('tut_first_rest_done')) {
      Flags.set('tut_first_rest_done', true);
      _playRestCaughtAndOrlanInvite();
      return;
    }
    if (actionId === 'meditation' && Flags.has('tut_first_rest_done') && !Flags.has('tut_first_meditate_done')) {
      Flags.set('tut_first_meditate_done', true);
      _playAfterMeditation();
      return;
    }
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
    ], {
      onComplete: () => {
        if (typeof Stage !== 'undefined' && Stage.popupBig) {
          Stage.popupBig({
            icon: '✦', title: '經驗累積', subtitle: '右上角「詳細」可以查看屬性、夠多 EXP 能升級',
            color: 'green', duration: 2000, shake: false, sound: 'level_up',
            onComplete: () => {
              _log('💡 訓練累積 EXP、右上角「詳細」可以花 EXP 升屬性。先試試其他動作吧。', '#88cc77', false);
              if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
            },
          });
        } else {
          _log('💡 訓練累積 EXP、右上角「詳細」可以花 EXP 升屬性。', '#88cc77', false);
          if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
        }
      }
    });
  }

  // 階段 3：休息被抓 + 奧蘭出現邀冥想
  function _playRestCaughtAndOrlanInvite() {
    if (typeof DialogueModal === 'undefined') {
      _log('塔倫長官：「誰准你休息了？」', '#cc6633', true);
      _log('奧蘭：「⋯⋯記得我嗎？我是同房的奧蘭。要不要一起打坐？」', '#88aacc', true);
      _addOrlanToScene();
      if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
      return;
    }
    DialogueModal.play([
      { text: '（你正打算靠牆打盹⋯⋯）' },
      { text: '（一個鞭頭從旁邊掃過、釘進牆裡。）' },
      { speaker: '塔倫長官', text: '誰准你休息了？' },
      { text: '（你低頭、不敢說話。）' },
      { text: '（你心想：⋯⋯看來長官在的時候、皮還是繃緊點好。）' },
      { text: '（塔倫嘖了一聲、繼續往別處巡。）' },
      { text: '⋯⋯' },
      { text: '（你還沒回過神、有人從你身後拍了一下。）' },
      { speaker: '奧蘭', text: '嘿。' },
      { speaker: '奧蘭', text: '⋯⋯記得我嗎？我是同房的、奧蘭。' },
      { text: '（他嘴角還在抖、看起來也是剛被嚇到。）' },
      { speaker: '奧蘭', text: '我看你需要喘口氣。' },
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
  };
})();
