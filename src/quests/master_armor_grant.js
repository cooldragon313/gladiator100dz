/**
 * master_armor_grant.js — 主人賜護飾線（3 條：護臂/護腿/頭盔 + 第 4 件傳家三選一）
 *
 * 設計：[docs/systems/equipment-rework.md § 4.1](../../docs/systems/equipment-rework.md)
 *
 * 觸發時機：
 *   - tryGrantsAfterArenaWin() — 競技場勝利後呼叫（battle.js _endBattle 內）
 *   - 自動依當前 arenaWins 數推進該推進的條線
 *
 * 條線推進門檻：
 *   護臂線：5 / 15 / 25 場勝 → 布護臂 / 布精護臂 / 布上等護臂
 *   護腿線：8 / 18 / 28 場勝 → 皮護腿 / 皮精護腿 / 皮上等護腿
 *   頭盔線：12 / 22 / 32 場勝 → 鐵頭盔 / 鐵精頭盔 / 鐵上等頭盔
 *
 * 第 4 件傳家：35 場勝 + 5 連勝 + 至少一次 S 評
 *   ChoiceModal 三選一定型（布斗篷/皮甲套/鐵鎧甲）
 *
 * Flag 命名：master_armor_arm_1/2/3, master_armor_leg_1/2/3, master_armor_helm_1/2/3,
 *           master_heirloom_chosen, master_heirloom_choice
 */
const MasterArmorGrant = (() => {

  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    }
  }

  // ─── 三條護飾線設定 ────────────────────────────────
  const LINES = {
    arm: {
      name: '護臂線',
      thresholds: [5, 15, 25],
      armorIds: ['clothArm', 'clothArm_fine', 'clothArm_superb'],
      qualities: ['common', 'fine', 'superb'],
      flagPrefix: 'master_armor_arm_',
      labels: ['布護臂', '布精護臂', '布上等護臂'],
    },
    leg: {
      name: '護腿線',
      thresholds: [8, 18, 28],
      armorIds: ['leatherLeg', 'leatherLeg_fine', 'leatherLeg_superb'],
      qualities: ['common', 'fine', 'superb'],
      flagPrefix: 'master_armor_leg_',
      labels: ['皮護腿', '皮精護腿', '皮上等護腿'],
    },
    helm: {
      name: '頭盔線',
      thresholds: [12, 22, 32],
      armorIds: ['ironHelm', 'ironHelm_fine', 'ironHelm_superb'],
      qualities: ['common', 'fine', 'superb'],
      flagPrefix: 'master_armor_helm_',
      labels: ['鐵頭盔', '鐵精頭盔', '鐵上等頭盔'],
    },
  };

  // ─── 主人對白依階段 ────────────────────────────────
  // 🆕 2026-04-29 加強進階感 — 主人愈來愈把你當回事
  const STAGE_DIALOGUES = [
    [   // 階段 1（第 1 件）— 試水溫
      { text: '（侍從來把你帶到主人廳。盒子很普通、沒什麼裝飾。）' },
      { speaker: '阿圖斯', text: '⋯⋯不錯。' },
      { speaker: '阿圖斯', text: '給你件像樣的。先穿著、別摔。' },
    ],
    [   // 階段 2（第 2 件）— 升級
      { text: '（侍從又來了。這次盒子上有家族徽。）' },
      { speaker: '阿圖斯', text: '上次那件、我看你穿得勤。' },
      { speaker: '阿圖斯', text: '⋯⋯換一件好的。我家匠人重新校過、貴一倍。' },
      { speaker: '阿圖斯', text: '去把舊的丟了——那件對你已經不夠了。' },
    ],
    [   // 階段 3（第 3 件）— 真投資
      { text: '（這次主人親自把盒子打開。裡頭墊著絲布。）' },
      { speaker: '阿圖斯', text: '我認真考慮投資你了。' },
      { speaker: '阿圖斯', text: '⋯⋯這件不便宜。葛拉看了三遍才肯放手。' },
      { speaker: '阿圖斯', text: '別讓它在你身上斷。也別丟。我會記得。' },
    ],
  ];

  // ══════════════════════════════════════════════════
  // 主入口：競技場勝利後呼叫、檢查推進
  // ══════════════════════════════════════════════════
  function tryGrantsAfterArenaWin() {
    if (typeof Flags === 'undefined') return;
    const cs = Stats.player.combatStats;
    if (!cs) return;
    const wins = cs.arenaWins || 0;
    const sCount = cs.sRankCount || 0;
    const streak = cs.winStreak || 0;

    // 三條線檢查
    Object.keys(LINES).forEach(key => {
      const line = LINES[key];
      for (let i = 0; i < line.thresholds.length; i++) {
        const flag = line.flagPrefix + (i + 1);
        if (Flags.has(flag)) continue;
        if (wins < line.thresholds[i]) return;   // 還沒達標、後面也不用看
        // 達標 + 還沒給 → 給
        Flags.set(flag, true);
        _grantArmor(line.armorIds[i], line.qualities[i], i, line.labels[i]);
        return;   // 一次只演一場、避免連發
      }
    });

    // 第 4 件傳家觸發
    if (!Flags.has('master_heirloom_chosen')
        && wins >= 35 && streak >= 5 && sCount >= 1) {
      _playHeirloomChoice();
    }
  }

  // ─── 給單件護飾（演主人對白 + push inventory）─────
  function _grantArmor(armorId, quality, stageIdx, label) {
    const armor = (typeof Armors !== 'undefined') ? Armors[armorId] : null;
    if (!armor) {
      console.error('[MasterArmorGrant] 找不到 armor:', armorId);
      return;
    }

    const lines = STAGE_DIALOGUES[stageIdx] || STAGE_DIALOGUES[0];
    const finishWith = () => {
      _addToInventory(armorId, quality);
      _log(`✦ 主人賜：「${label}」（${_qualityName(quality)}）`, '#d4af37', true);
      if (typeof Stage !== 'undefined' && Stage.popupBig) {
        Stage.popupBig({
          icon: '⚜', title: armor.name, subtitle: '主人賞賜',
          color: 'gold', duration: 1800, shake: false, sound: 'acquire',
          onComplete: () => {
            if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
          },
        });
      } else if (typeof Game !== 'undefined' && Game.renderAll) {
        Game.renderAll();
      }
    };

    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play(lines, { onComplete: finishWith });
    } else {
      finishWith();
    }
  }

  // ─── 第 4 件傳家三選一 ────────────────────────────
  function _playHeirloomChoice() {
    if (typeof DialogueModal === 'undefined' || typeof ChoiceModal === 'undefined') {
      // fallback：直接給平衡型
      Flags.set('master_heirloom_chosen', true);
      Flags.set('master_heirloom_choice', 'leather');
      _addToInventory('heirloomLeather', 'legendary');
      _log('✦ 主人傳家：皮傳家家徽（平衡 build）', '#ffaa20', true);
      return;
    }

    DialogueModal.play([
      { text: '（侍從帶你進主人廳。今天廳裡擺了三個檀木小盒——比你想像的小得多。）' },
      { speaker: '阿圖斯', text: '⋯⋯到了這份上、給你選一件吧。' },
      { speaker: '阿圖斯', text: '我家族傳下來的。三件、選一件。' },
      { speaker: '阿圖斯', text: '選了——就走那條路、別回頭。' },
      { text: '（他打開三個盒子。每個盒子裡躺著一件小東西。）' },
      { text: '（一個絲質飾結、繫在腰間像一縷風。）' },
      { text: '（一塊銅製家徽、補了七層、每一層代表一代主人。）' },
      { text: '（一枚鐵戒、內側刻了七個名字、最後一個是空白。）' },
      { speaker: '阿圖斯', text: '⋯⋯這三件、跟著我家七代了。再大的鎧甲、再好的劍、都會被打爛、會生鏽、會丟。' },
      { speaker: '阿圖斯', text: '只有這三件、傳下來了。' },
    ], {
      onComplete: () => {
        ChoiceModal.show({
          id: 'master_heirloom_choice',
          icon: '⚜',
          title: '主人傳家・三選一',
          body: '阿圖斯：「選一件、走一條路。這件不會被淘汰、跟你一輩子。」',
          forced: true,
          choices: [
            {
              id: 'cloak',
              label: '布傳家飾結（風 build）',
              hint: 'DEX +5 / AGI +3 / SPD +5 / EVA +6 — 速度與閃避的化身',
            },
            {
              id: 'leather',
              label: '皮傳家家徽（平衡 build）',
              hint: '全屬性 +3 / DEF +2 — 什麼都來一點',
            },
            {
              id: 'plate',
              label: '鐵傳家戒指（鐵壁 build）',
              hint: 'CON +5 / STR +2 / DEF +8 — 站得住就贏了',
            },
          ],
        }, {
          onChoose: (choiceId) => {
            Flags.set('master_heirloom_chosen', true);
            Flags.set('master_heirloom_choice', choiceId);
            const map = {
              cloak:   { id: 'heirloomCloak',   label: '布傳家飾結' },
              leather: { id: 'heirloomLeather', label: '皮傳家家徽' },
              plate:   { id: 'heirloomPlate',   label: '鐵傳家戒指' },
            };
            const choice = map[choiceId];
            if (!choice) return;
            _addToInventory(choice.id, 'legendary');
            _log(`✦ 主人傳家：「${choice.label}」── 你的身份定型了。`, '#ffaa20', true);
            if (typeof Stage !== 'undefined' && Stage.popupBig) {
              Stage.popupBig({
                icon: '⚜', title: choice.label, subtitle: '身份定型',
                color: 'gold', duration: 2400, shake: true, sound: 'acquire',
                onComplete: () => {
                  // 後話：主人說「剩兩件回到盒子裡、繼續傳下去」
                  if (typeof DialogueModal !== 'undefined') {
                    DialogueModal.play([
                      { speaker: '阿圖斯', text: '⋯⋯好。拿去。' },
                      { speaker: '阿圖斯', text: '剩兩件、回到盒子裡。或許下一個——下一個會選別的。' },
                      { speaker: '阿圖斯', text: '記住——你選的這條路、走到底。' },
                    ]);
                  }
                  if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
                },
              });
            }
          }
        });
      }
    });
  }

  // ─── 工具：把物品加到 inventory ──────────────────
  function _addToInventory(armorId, quality) {
    const p = Stats.player;
    if (!Array.isArray(p.armorInventory)) p.armorInventory = [];
    p.armorInventory.push({ id: armorId, tier: 1, quality: quality || 'common' });
  }

  function _qualityName(q) {
    return (typeof EquipmentQuality !== 'undefined' && EquipmentQuality.getName)
            ? EquipmentQuality.getName(q) : q;
  }

  return {
    tryGrantsAfterArenaWin,
  };
})();
