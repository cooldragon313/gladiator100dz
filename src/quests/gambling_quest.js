/**
 * gambling_quest.js — 三杯藏球賭局觸發 + 結算
 * ══════════════════════════════════════════════════
 * 設計：docs/quests/gambling-shells.md
 *
 * 觸發：
 *   - 夜間 slot 7 / Day ≥ 8 / 12% 機率 / 5 天 cooldown
 *   - 在場至少 1 個 teammate
 * 賭金：每場固定 5 銅、結算淨輸贏
 * 全勝 → +1 LUK + 對白「看來我挺幸運」
 * 連 5 次全勝 → 幸運之星技能 (+5 LUK base)
 */
const GamblingQuest = (() => {

  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    }
  }

  // 由 main.js 在睡前 slot 7 呼叫
  function tryNightOffer() {
    const p = Stats.player;
    if (!p) return false;
    if (typeof Flags === 'undefined') return false;
    if (p.day < 8) return false;
    if (Flags.has(`gambling_offered_day_${p.day}`)) return false;

    // 5 天 cooldown
    const lastDay = Flags.get('gambling_last_day', -99);
    if (p.day - lastDay < 5) return false;

    // 12% 機率
    if (Math.random() >= 0.12) return false;

    // 找在場 teammate
    if (typeof GameState === 'undefined' || !GameState.getCurrentNPCs) return false;
    const cur = GameState.getCurrentNPCs() || {};
    const tms = (cur.teammates || []).filter(id => {
      const npc = (typeof teammates !== 'undefined') ? teammates.getNPC(id) : null;
      return npc && npc.alive !== false;
    });
    if (tms.length === 0) return false;

    Flags.set(`gambling_offered_day_${p.day}`, true);
    Flags.set('gambling_last_day', p.day);

    // 隨機抽一個 NPC 邀賭
    const inviterId = tms[Math.floor(Math.random() * tms.length)];
    _playInvite(inviterId);
    return true;
  }

  function _playInvite(inviterId) {
    const p = Stats.player;
    const npc = teammates.getNPC(inviterId);
    const name = npc?.name || inviterId;
    const hasMoney = (p.money || 0) >= 15;

    // 個性化對白
    const lines = _getInviteLines(inviterId, name);

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, {
        onComplete: () => _showInviteChoice(inviterId, name, hasMoney)
      });
    } else {
      _showInviteChoice(inviterId, name, hasMoney);
    }
  }

  function _getInviteLines(npcId, name) {
    if (npcId === 'orlan') {
      return [
        { text: '（夜了。其他人圍在火堆邊。）' },
        { text: '（奧蘭從懷裡掏出三個破陶杯。）' },
        { speaker: '奧蘭', text: '⋯⋯小子。我發現一個事情。' },
        { speaker: '奧蘭', text: '他們在玩這個東西。' },
        { speaker: '奧蘭', text: '⋯⋯要不要試試看。三場、一場 5 銅。' },
      ];
    }
    if (npcId === 'cassius') {
      return [
        { text: '（夜了。卡西烏斯走過來、手裡轉著三個杯子。）' },
        { speaker: '卡西烏斯', text: '來、活著無聊。' },
        { speaker: '卡西烏斯', text: '我教你一個老兵的小娛樂。' },
        { speaker: '卡西烏斯', text: '⋯⋯三場、一場 5 銅、別輸太慘啊小子。' },
      ];
    }
    if (npcId === 'hector') {
      return [
        { text: '（夜了。赫克特坐到火堆邊、笑著看你。）' },
        { speaker: '赫克特', text: '嘿、新人。' },
        { speaker: '赫克特', text: '賭一把？三場、一場 5 銅。' },
        { speaker: '赫克特', text: '我不會作弊⋯⋯啦。' },
      ];
    }
    if (npcId === 'dagiSlave') {
      return [
        { text: '（夜了。達吉沉默地走過來、放下三個杯子。）' },
        { speaker: '達吉', text: '⋯⋯' },
        { speaker: '達吉', text: '想試？' },
        { speaker: '達吉', text: '我手快、別怪我。' },
      ];
    }
    // 一般 / recruit
    return [
      { text: '（夜了。其他人圍在火堆邊。）' },
      { text: `（${name} 走過來、手裡轉著三個破陶杯。）` },
      { speaker: name, text: '來嘛、賭一把睡覺前。' },
      { speaker: name, text: '三杯一球、一場 5 銅錢。猜對你拿、猜錯我拿。' },
      { speaker: name, text: '玩三場、看誰幸運。' },
    ];
  }

  function _showInviteChoice(inviterId, name, hasMoney) {
    if (typeof ChoiceModal === 'undefined') return;
    const p = Stats.player;
    ChoiceModal.show({
      id: 'gambling_invite_' + inviterId,
      icon: '🎲',
      title: `${name} 邀你賭一把`,
      body: '三場、一場 5 銅。\n猜對你拿、猜錯他拿。\n全勝有額外好處。',
      forced: true,
      choices: [
        {
          id: 'play',
          label: '賭！',
          hint: hasMoney ? '進入小遊戲' : `錢不夠（需 15、有 ${p.money || 0}）`,
          _disabled: !hasMoney,
          effects: [],
          resultLog: `${name}: 「⋯⋯來、看你眼力。」`,
          logColor: '#c8a060',
        },
        {
          id: 'no_money',
          label: '⋯⋯我沒錢。',
          hint: '（被嫌棄）',
          requireFlag: null,   // 任何人都能選（即使有錢也能說「沒錢」推託）
          effects: [
            { type: 'affection', key: inviterId, delta: -1 },
          ],
          resultLog: `${name}: 「⋯⋯廢物。連賭都沒本錢。」`,
          logColor: '#cc6633',
        },
        {
          id: 'decline',
          label: '不睡了我累。',
          hint: '退出、不影響任何狀態',
          effects: [],
          resultLog: `${name}: 「⋯⋯隨你。」`,
          logColor: '#9a8866',
        },
      ],
    }, {
      onChoose: (choiceId) => {
        if (choiceId === 'play' && hasMoney) {
          _startMinigame(inviterId, name);
        }
      }
    });
  }

  function _startMinigame(inviterId, name) {
    if (typeof ShellsGame === 'undefined') {
      _log('（小遊戲模組未載入。）', '#cc6633', true);
      return;
    }
    const npc = teammates.getNPC(inviterId);
    const oppDEX = (npc && npc.favoredAttr === 'DEX') ? 25 : 15;
    const playerDEX = (typeof Stats.eff === 'function') ? Stats.eff('DEX') : 10;

    ShellsGame.play({
      oppDEX,
      playerDEX,
      rounds: 3,
      onComplete: ({ wins, losses }) => _settle(inviterId, name, wins, losses),
    });
  }

  function _settle(inviterId, name, wins, losses) {
    const p = Stats.player;
    // 賭金結算（每場 5）
    const moneyDelta = wins * 5 - losses * 5;
    Stats.modMoney(moneyDelta);

    if (wins === 3) {
      // 全勝
      Stats.modVital('mood', +8);
      Stats.modAttr('LUK', +1);
      teammates.modAffection(inviterId, +3, { bypassTrait: true });
      _log(`✦ 全勝！${name}: 「⋯⋯小子、你他媽運氣不錯。」（金錢 +${moneyDelta}、心情 +8、LUK +1）`, '#d4af37', true);
      if (typeof Stage !== 'undefined' && Stage.popupBig) {
        Stage.popupBig({
          icon: '🎲', title: '看來我挺幸運', subtitle: 'LUK +1',
          color: 'gold', duration: 1800, sound: 'acquire',
        });
      }
      // 連勝計數
      const streak = (Flags.get('gambling_perfect_streak', 0) || 0) + 1;
      Flags.set('gambling_perfect_streak', streak);
      // 連 5 次全勝 → 幸運之星
      if (streak >= 5 && !Flags.has('lucky_star_granted')) {
        Flags.set('lucky_star_granted', true);
        _grantLuckyStar();
      }
    } else if (wins === 2) {
      Stats.modVital('mood', +3);
      _log(`勝 2 敗 1：勉強有賺。金錢 +${moneyDelta}、心情 +3。`, '#c8a060', false);
      Flags.set('gambling_perfect_streak', 0);
    } else if (wins === 1) {
      Stats.modVital('mood', -3);
      _log(`勝 1 敗 2：小輸。金錢 ${moneyDelta}、心情 -3。`, '#aa7733', false);
      Flags.set('gambling_perfect_streak', 0);
    } else {
      Stats.modVital('mood', -8);
      teammates.modAffection(inviterId, -1);
      _log(`✗ 全輸！${name}: 「⋯⋯哈哈、小子下次再來。」（金錢 ${moneyDelta}、心情 -8）`, '#cc6633', true);
      Flags.set('gambling_perfect_streak', 0);
    }
  }

  function _grantLuckyStar() {
    const p = Stats.player;
    if (!Array.isArray(p.learnedSkills)) p.learnedSkills = [];
    if (!p.learnedSkills.includes('luckyStar')) {
      p.learnedSkills.push('luckyStar');
    }
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play([
        { text: '（你連著贏五場了。）' },
        { text: '（對手把手裡的杯子放下、看著你。）' },
        { text: '「⋯⋯小子。你他媽的是幸運之神看上的吧。」' },
        { text: '「⋯⋯算了。我輸得心服口服。」' },
        { text: '（你心裡也不知道是不是真的幸運。）' },
        { text: '（但你開始覺得——也許運氣是站你這邊的。）' },
      ], {
        onComplete: () => {
          _log('✦ 你獲得了【幸運之星】 — LUK +5。', '#d4af37', true);
          if (typeof Stage !== 'undefined' && Stage.popupBig) {
            Stage.popupBig({
              icon: '⭐', title: '幸運之星', subtitle: 'LUK +5',
              color: 'gold', duration: 2400, sound: 'acquire', shake: true,
            });
          }
        }
      });
    } else {
      _log('✦ 你獲得了【幸運之星】 — LUK +5。', '#d4af37', true);
    }
  }

  return { tryNightOffer };
})();
