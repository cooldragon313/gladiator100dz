/**
 * midgame_bosses.js — 中段大 BOSS 5 場（P4）
 *
 * 設計：[docs/quests/arena-events-roster.md § 6.1](../../docs/quests/arena-events-roster.md)
 *
 * BOSS 名冊：
 *   B1 鐵骨阿巴      Day 30  墊腳石 + 教「不屈」概念
 *   B3 快刀沙洛      Day 55  招敵變友候選（玩家放過 → 種子）
 *   B4 血斧穆爾      Day 68  死戰（強制傷勢、輸贏都流血）
 *   B5 黑爪          蓋烏斯暗殺鏈 +35 觸發（recruit_enemy.js 內 hook）
 *   B6 七勝者塔倫弟  Day 88  終極對手前哨戰（全平衡敵）
 *
 * 注意：B2 領主白虎 Day 45 已在 lord_events.js 實作（獸鬥）
 *       B7 萬骸祭 Wave 1-5 在 wanguji.js
 *
 * 觸發：DayCycle.onDayStart hook
 */
const MidgameBosses = (() => {

  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    }
  }

  // ═══════════════════════════════════════════════════
  // B1 鐵骨阿巴（Day 30）— 墊腳石 + 教「不屈」
  // ═══════════════════════════════════════════════════
  function tryIronBoneAba(newDay) {
    if (newDay !== 30) return false;
    if (Flags.has('boss_b1_aba_done')) return false;
    Flags.set('boss_b1_aba_done', true);
    _playIronBoneAba();
    return true;
  }

  function _playIronBoneAba() {
    const intro = [
      { text: '（中等場、第一次「有人聽過名字」的對手。）' },
      { text: '（侍從押你走通道、塔倫長官在門口。）' },
      { speaker: '塔倫', text: '⋯⋯今天是「鐵骨」阿巴。撐住別倒。', color: '#883333' },
      { speaker: '塔倫', text: '⋯⋯他打人像石牆。但你也要學一件事——倒下去之前、咬牙站著。' },
      { text: '（你走出通道。）' },
      { text: '（場另一頭——一個矮壯的男人、四十出頭、滿臉舊疤、像花崗岩。）' },
      { speaker: '阿巴', text: '⋯⋯來吧、小子。', color: '#776655' },
    ];

    const startBattle = () => {
      const aba = {
        name: '鐵骨阿巴', title: '中等場・墊腳石',
        STR: 35, DEX: 22, CON: 50, AGI: 18, WIL: 38, LUK: 12,
        hpBase: 200,
        weaponId: 'longSword', armorId: 'ironPlate',
        ai: 'cautious', fame: 12, fameReward: 25,
      };
      Battle.startFromConfig({
        title: '鐵骨阿巴',
        fameReward: 25,
        enemies: [aba],
        allies:  [],
      }, _onWinAba, _onLoseAba);
    };
    DialogueModal.play(intro, { onComplete: startBattle });
  }

  function _onWinAba() {
    Flags.set('boss_b1_aba_won', true);
    DialogueModal.play([
      { text: '（阿巴跪在沙地上、舉起手。）' },
      { speaker: '阿巴', text: '⋯⋯不錯。撐到最後。', color: '#776655' },
      { speaker: '阿巴', text: '⋯⋯記住這一場。下次別人打你像我這樣硬、你就知道怎麼撐。' },
      { text: '（他自己起身、走回對面通道。）' },
      { speaker: '塔倫', text: '⋯⋯不錯。學會「不屈」這事、比贏這場還值錢。', color: '#883333' },
      { text: '（——你獲得永久特性「不屈」：致命一擊鎖死 1 HP + 5 回合 +30% ATK）', color: '#d4af37' },
    ]);
    if (typeof Stats !== 'undefined') {
      if (!Array.isArray(Stats.player.traits)) Stats.player.traits = [];
      if (!Stats.player.traits.includes('unyielding')) {
        Stats.player.traits.push('unyielding');
      }
      Stats.modFame(10);
    }
    if (typeof teammates !== 'undefined' && teammates.modAffection) {
      teammates.modAffection('officer', 5);   // 塔倫認可
    }
    _log('🛡 鐵骨阿巴敗、獲得永久特性「不屈」+10 名聲、塔倫 +5。', '#d4af37', true);
  }

  function _onLoseAba() {
    Flags.set('boss_b1_aba_lost', true);
    DialogueModal.play([
      { text: '（你倒在沙地。觀眾噓聲。）' },
      { speaker: '阿巴', text: '⋯⋯沒事、再練幾年。', color: '#776655' },
      { speaker: '塔倫', text: '⋯⋯（他沒講話、只是嘆氣。）', color: '#883333' },
    ]);
    if (typeof Stats !== 'undefined') Stats.modFame(-5);
    _log('🛡 鐵骨阿巴勝。-5 名聲。', '#aa5050', true);
  }

  // ═══════════════════════════════════════════════════
  // B3 快刀沙洛（Day 55）— 招敵變友候選
  // ═══════════════════════════════════════════════════
  function tryFastBladeSarro(newDay) {
    if (newDay !== 55) return false;
    if (Flags.has('boss_b3_sarro_done')) return false;
    Flags.set('boss_b3_sarro_done', true);
    _playFastBladeSarro();
    return true;
  }

  function _playFastBladeSarro() {
    const intro = [
      { text: '（上等場。觀眾席滿了一半、貴族包廂也來了人。）' },
      { text: '（場另一頭——一個瘦削的劍士、年紀跟你差不多、眼神平靜。）' },
      { speaker: '沙洛', text: '⋯⋯聽過你。', color: '#5577aa' },
      { speaker: '沙洛', text: '⋯⋯阿圖斯場最近的那個。' },
      { text: '（他不講廢話、姿勢很穩。）' },
    ];

    const startBattle = () => {
      const sarro = {
        name: '快刀沙洛', title: '上等場・劍客',
        STR: 30, DEX: 50, CON: 28, AGI: 45, WIL: 32, LUK: 15,
        hpBase: 130,
        weaponId: 'shortSword', armorId: 'studdedLeather',
        ai: 'aggressive', fame: 18, fameReward: 35,
      };
      Battle.startFromConfig({
        title: '快刀沙洛',
        fameReward: 35,
        enemies: [sarro],
        allies:  [],
      }, _onWinSarro, _onLoseSarro);
    };
    DialogueModal.play(intro, { onComplete: startBattle });
  }

  function _onWinSarro() {
    Flags.set('boss_b3_sarro_won', true);
    // 戰勝後 ChoiceModal — 砍首 vs 放過
    if (typeof ChoiceModal === 'undefined') {
      _sarroAfter('execute');
      return;
    }
    ChoiceModal.show({
      id: 'boss_sarro_finish',
      icon: '⚔',
      title: '沙洛跪在沙地上',
      body: '他舉起左手——意思是「我認」。觀眾喊砍首。你怎麼辦？',
      forced: true,
      choices: [
        {
          id: 'spare',
          label: '放過他',
          hint: '（他打得乾淨、不是該死的人。）',
          effects: [
            { type: 'moral', axis: 'mercy', side: 'positive' },
            { type: 'flag', key: 'sarro_spared' },
          ],
          resultLog: '你收劍、轉身。觀眾失望聲、但有人鼓掌。',
          logColor: '#88aa66',
        },
        {
          id: 'execute',
          label: '砍首',
          hint: '（觀眾要血。）',
          effects: [
            { type: 'moral', axis: 'mercy', side: 'negative' },
          ],
          resultLog: '你揮劍。沙洛的眼睛在最後一秒閃過一絲驚訝。',
          logColor: '#cc4444',
        },
      ],
    }, { onChoose: _sarroAfter });
  }

  function _sarroAfter(choiceId) {
    if (choiceId === 'spare') {
      DialogueModal.play([
        { text: '（你收劍、轉身走。）' },
        { text: '（沙洛站起來、跟你交換一個眼神——是「我欠你一次」的眼神。）' },
        { text: '（——招敵變友的種子已經種下。）', color: '#aa8855' },
      ]);
      // 種子 flag — recruit_enemy.js 可讀
      if (typeof RecruitEnemyQuest !== 'undefined' && RecruitEnemyQuest.trySeedFromSparring) {
        // 沙洛不在現有 candidate 列表、用 generic flag
        Flags.set('sarro_friendly_seed', true);
      }
      if (typeof Stats !== 'undefined') Stats.modFame(20);
    } else {
      DialogueModal.play([
        { text: '（觀眾爆。沙洛倒下、不再動。）' },
        { text: '（——你殺了他。乾淨利落。）', color: '#888' },
        { text: '（場邊有人在記錄你的名字。）' },
      ]);
      if (typeof Stats !== 'undefined') Stats.modFame(30);
    }
    _log(`⚔ 快刀沙洛敗（${choiceId}）。`, '#d4af37', true);
  }

  function _onLoseSarro() {
    Flags.set('boss_b3_sarro_lost', true);
    DialogueModal.play([
      { text: '（你倒下。沙洛把劍尖點在你脖子上、然後收回。）' },
      { speaker: '沙洛', text: '⋯⋯下次再戰。', color: '#5577aa' },
      { text: '（他放過你。觀眾沒喊、但有人在場邊記錄這場。）' },
    ]);
    if (typeof Stats !== 'undefined') Stats.modFame(-10);
    _log('⚔ 快刀沙洛勝、放過你。-10 名聲。', '#aa5050', true);
  }

  // ═══════════════════════════════════════════════════
  // B4 血斧穆爾（Day 68）— 死戰、強制傷勢
  // ═══════════════════════════════════════════════════
  // 注意：原 spec Day 70、避開 kade_events Day 70 四強選拔
  function tryBloodAxeMul(newDay) {
    if (newDay !== 68) return false;
    if (Flags.has('boss_b4_mul_done')) return false;
    Flags.set('boss_b4_mul_done', true);
    _playBloodAxeMul();
    return true;
  }

  function _playBloodAxeMul() {
    const intro = [
      { text: '（精英場。觀眾席破紀錄滿。）' },
      { text: '（場另一頭——一個高大、滿身血漬的男人。）' },
      { text: '（他的斧頭、一邊掛著乾掉的肉屑。）' },
      { speaker: '穆爾', text: '⋯⋯沒有不流血的勝利。', color: '#883a3a' },
      { speaker: '穆爾', text: '⋯⋯今天、你的、我的、都流。' },
      { text: '（你心裡一沉——這場無論輸贏都會見血。）', color: '#aa6666' },
    ];

    const startBattle = () => {
      const mul = {
        name: '血斧穆爾', title: '精英場・死戰士',
        STR: 50, DEX: 28, CON: 45, AGI: 24, WIL: 40, LUK: 8,
        hpBase: 220,
        weaponId: 'heavyAxe', armorId: 'chainmail',
        ai: 'aggressive', fame: 25, fameReward: 50,
      };
      Battle.startFromConfig({
        title: '血斧穆爾',
        fameReward: 50,
        enemies: [mul],
        allies:  [],
      }, _onWinMul, _onLoseMul);
    };
    DialogueModal.play(intro, { onComplete: startBattle });
  }

  function _applyForcedWound(severity) {
    if (typeof Wounds !== 'undefined' && Wounds.applyWound) {
      const parts = ['head', 'torso', 'arms', 'legs'];
      const part = parts[Math.floor(Math.random() * parts.length)];
      Wounds.applyWound(part, severity);
      return part;
    }
    return null;
  }

  function _onWinMul() {
    Flags.set('boss_b4_mul_won', true);
    // 強制傷勢（severity 2、即使勝）
    const part = _applyForcedWound(2);
    const partName = { head: '頭', torso: '軀幹', arms: '手臂', legs: '腿' }[part] || '身體';
    DialogueModal.play([
      { text: '（穆爾的斧頭高舉到一半——你劍尖戳進他喉嚨。）' },
      { text: '（他眼神先愣、再笑、再倒下。）' },
      { speaker: '穆爾', text: '⋯⋯說過了⋯⋯都流⋯⋯', color: '#883a3a' },
      { text: '（你站著喘、低頭看自己——${part}上一道大口子、血滲透布甲。）'.replace('${part}', partName) },
      { text: '（你贏了。但這場勝、留下了印子。）', color: '#aa6666' },
      { text: '（——獲得 ${part} 中度傷勢。）'.replace('${part}', partName), color: '#cc6644' },
    ]);
    if (typeof Stats !== 'undefined') Stats.modFame(40);
    _log(`🪓 血斧穆爾敗。+40 名聲、${partName}中度傷勢。`, '#d4af37', true);
  }

  function _onLoseMul() {
    Flags.set('boss_b4_mul_lost', true);
    // 失敗也強制嚴重傷勢（severity 3）
    const part = _applyForcedWound(3);
    const partName = { head: '頭', torso: '軀幹', arms: '手臂', legs: '腿' }[part] || '身體';
    DialogueModal.play([
      { text: '（穆爾一斧劈下、你來不及格擋——${part}見骨。）'.replace('${part}', partName) },
      { text: '（你倒下。視線一片紅。）', color: '#cc4444' },
      { speaker: '穆爾', text: '⋯⋯說過了。', color: '#883a3a' },
      { text: '（觀眾哀嚎、侍從衝上場把你抬走。）' },
      { text: '（——獲得 ${part} 重度傷勢。）'.replace('${part}', partName), color: '#cc4444' },
    ]);
    if (typeof Stats !== 'undefined') Stats.modFame(-15);
    _log(`🪓 血斧穆爾勝。-15 名聲、${partName}重傷。`, '#aa5050', true);
  }

  // ═══════════════════════════════════════════════════
  // B5 黑爪（蓋烏斯暗殺鏈 +35 觸發、不固定 Day）
  // ═══════════════════════════════════════════════════
  // 由 recruit_enemy.js checkAssassinationChain 在 offset 35 呼叫
  // 戰前無對白（突襲）— 直接 Battle.startFromConfig
  function playBlackClaw() {
    if (Flags.has('boss_b5_claw_done')) return;
    Flags.set('boss_b5_claw_done', true);

    const intro = [
      { text: '（深夜。你訓練完回房。）' },
      { text: '（房門已經被人從裡面打開了。）' },
      { text: '（火光裡——一個黑衣人坐在你的床邊、磨刀。）' },
      { text: '（他抬頭、笑了一下、沒講話。）', color: '#aa6666' },
      { text: '（——直接動手。）', color: '#cc4444' },
    ];

    const startBattle = () => {
      const claw = {
        name: '黑爪', title: '蓋烏斯買來的殺手',
        STR: 38, DEX: 50, CON: 32, AGI: 48, WIL: 35, LUK: 10,
        hpBase: 160,
        weaponId: 'dagger', armorId: 'studdedLeather',
        ai: 'aggressive', fame: 0, fameReward: 0,
      };
      Battle.startFromConfig({
        title: '黑爪',
        fameReward: 30,
        enemies: [claw],
        allies:  [],
      }, _onWinClaw, _onLoseClaw);
    };
    DialogueModal.play(intro, { onComplete: startBattle });
  }

  function _onWinClaw() {
    Flags.set('boss_b5_claw_won', true);
    DialogueModal.play([
      { text: '（黑爪倒下、嘴角還是笑的。）' },
      { speaker: '黑爪', text: '⋯⋯下個⋯⋯會更狠⋯⋯', color: '#aa6666' },
      { text: '（他斷氣。你翻他口袋——一塊蓋烏斯場的銅令牌、半張潦草字條。）' },
      { text: '（字條上：「事後付清。德。」）', color: '#aa6666' },
      { text: '（——德基烏斯。蓋烏斯讓他付的錢。）', color: '#aa6666' },
      { text: '（你把令牌跟字條收進貼身布袋——以後可能用得到。）' },
    ]);
    if (typeof Stats !== 'undefined') {
      Stats.modFame(15);
      Stats.modVital('mood', -10);   // 殺人在房裡的心理代價
    }
    if (typeof teammates !== 'undefined' && teammates.modAffection) {
      teammates.modAffection('gaius', -20);
      teammates.modAffection('vesnusDecius', -15);
    }
    Flags.set('decius_betrayal_witnessed', true);
    Flags.set('have_gaius_token_evidence', true);
    _log('🗡 黑爪敗、撿到蓋烏斯場令牌+字條。+15 名聲、蓋烏斯 -20。', '#d4af37', true);
  }

  function _onLoseClaw() {
    Flags.set('boss_b5_claw_lost', true);
    DialogueModal.play([
      { text: '（你倒在房裡的血泊中。）' },
      { text: '（——意識模糊間、聽到老默的聲音。）' },
      { speaker: '老默', text: '⋯⋯催命！誰來幫我！', color: '#cc6666' },
      { text: '（你撐了過來、但黑爪跑了。）' },
      { text: '（——蓋烏斯這條線、還沒結束。）', color: '#aa6666' },
    ]);
    if (typeof Stats !== 'undefined') {
      Stats.modVital('hp', -50);
      Stats.modFame(-20);
    }
    _log('🗡 黑爪勝、逃走。-50 HP、-20 名聲。', '#aa5050', true);
  }

  // ═══════════════════════════════════════════════════
  // B6 七勝者塔倫弟（Day 88）— 終極對手前哨戰
  // ═══════════════════════════════════════════════════
  // 全平衡敵、考驗玩家全方位能力
  function trySevenWinTalente(newDay) {
    if (newDay !== 88) return false;
    if (Flags.has('boss_b6_talente_done')) return false;
    Flags.set('boss_b6_talente_done', true);
    _playSevenWinTalente();
    return true;
  }

  function _playSevenWinTalente() {
    const intro = [
      { text: '（傳奇場。觀眾席整個城市都來了。）' },
      { text: '（陽台上、領主提圖斯也親自出席。）' },
      { text: '（場另一頭——一個中年男人、銀色短鬚、姿勢端正。）' },
      { speaker: '塔倫弟', text: '⋯⋯七勝者，還欠一勝就退役。', color: '#5a5a8a' },
      { speaker: '塔倫弟', text: '⋯⋯希望你給我一個值得的對手。' },
      { text: '（你看著他——這是你打過最強的人。）', color: '#aa8855' },
      { speaker: '塔倫弟', text: '⋯⋯來吧。' },
    ];

    const startBattle = () => {
      const talente = {
        name: '塔倫弟', title: '七勝者・傳奇',
        STR: 45, DEX: 45, CON: 45, AGI: 45, WIL: 45, LUK: 25,
        hpBase: 250,
        weaponId: 'longSword', armorId: 'studdedLeather',
        ai: 'normal', fame: 40, fameReward: 80,
      };
      Battle.startFromConfig({
        title: '七勝者塔倫弟',
        fameReward: 80,
        enemies: [talente],
        allies:  [],
      }, _onWinTalente, _onLoseTalente);
    };
    DialogueModal.play(intro, { onComplete: startBattle });
  }

  function _onWinTalente() {
    Flags.set('boss_b6_talente_won', true);
    DialogueModal.play([
      { text: '（你的劍尖點在塔倫弟的喉嚨上、停住。）' },
      { text: '（他閉眼、笑了。）' },
      { speaker: '塔倫弟', text: '⋯⋯第八勝、給你了。', color: '#5a5a8a' },
      { speaker: '塔倫弟', text: '⋯⋯這場、我退役。' },
      { text: '（他自己退開、舉起雙手認輸。）' },
      { text: '（觀眾起立、歡呼像浪。）' },
      { text: '（陽台上、領主提圖斯點了一下頭——他記住了你的名字。）', color: '#aa8855' },
      { speaker: '塔倫弟', text: '⋯⋯小子。Day 100 萬骸祭、好好打。', color: '#5a5a8a' },
      { text: '（——獲得永久特性「傳奇之敵」+50 名聲、領主好感 +10。）', color: '#d4af37' },
    ]);
    if (typeof Stats !== 'undefined') {
      Stats.modFame(50);
      if (!Array.isArray(Stats.player.traits)) Stats.player.traits = [];
      if (!Stats.player.traits.includes('legendaryFoe')) {
        Stats.player.traits.push('legendaryFoe');
      }
    }
    if (typeof teammates !== 'undefined' && teammates.modAffection) {
      teammates.modAffection('lordTitus', 10);
    }
    _log('⚔ 七勝者塔倫弟敗、獲得「傳奇之敵」特性 +50 名聲、領主 +10。', '#d4af37', true);
  }

  function _onLoseTalente() {
    Flags.set('boss_b6_talente_lost', true);
    DialogueModal.play([
      { text: '（塔倫弟劍指你脖子、停住。）' },
      { speaker: '塔倫弟', text: '⋯⋯不錯。值得這場。', color: '#5a5a8a' },
      { text: '（他收劍、自己走離。）' },
      { text: '（觀眾沒噓——他們知道對手是傳奇。）' },
      { text: '（陽台上、領主沒走、看著你被抬下場。）', color: '#888' },
    ]);
    if (typeof Stats !== 'undefined') {
      Stats.modFame(10);   // 對傳奇輸也有名聲
    }
    _log('⚔ 七勝者塔倫弟勝、放過你。+10 名聲（對傳奇輸也算）。', '#aa6666', true);
  }

  // ═══════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════
  function init() {
    if (typeof DayCycle === 'undefined' || typeof DayCycle.onDayStart !== 'function') return;

    DayCycle.onDayStart('midgameBosses', (newDay) => {
      if (tryIronBoneAba(newDay))     return;
      if (tryFastBladeSarro(newDay))  return;
      if (tryBloodAxeMul(newDay))     return;
      if (trySevenWinTalente(newDay)) return;
    }, 45);   // 45 = 比 cross_ludus (50) 高、比 lord_events 低
  }

  init();

  return {
    init,
    tryIronBoneAba, tryFastBladeSarro, tryBloodAxeMul, trySevenWinTalente,
    playBlackClaw,   // 由 recruit_enemy.js 暗殺鏈 +35 呼叫
    // debug
    testAba:     () => _playIronBoneAba(),
    testSarro:   () => _playFastBladeSarro(),
    testMul:     () => _playBloodAxeMul(),
    testClaw:    () => playBlackClaw(),
    testTalente: () => _playSevenWinTalente(),
  };
})();
