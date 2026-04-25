/**
 * blacksmith_events.js — 鐵匠葛拉事件系統
 * ══════════════════════════════════════════
 * 設計：docs/quests/blacksmith-gra.md
 * 角色：docs/characters/blacksmithGra.md
 *
 * 觸發機制（晨起 / 訓練後 hook）：
 *   - tryFirstArmor()       階段 2 — 好感 ≥ 20 + Day ≥ 12 + arenaLosses ≥ 1 → 三幕進場 + 送皮甲
 *   - tryFirstRepair()      階段 3 — flag gra_weapon_needs_repair + 葛拉好感 ≥ 25 → 免費修繕一次
 *   - tryWeaponUpgradeT2()  階段 4 — Day ≥ 25 + 好感 30 / arena 3 勝 + money ≥ 30 → 武器 +1 tier
 *   - markWeaponNeedsRepair() 戰鬥後呼叫 — 機率標記武器需修
 *
 * 設計簡化（2026-04-25 v1）：
 *   - 還沒做完整 durability 系統 — 用「戰鬥後機率 + flag」簡化版代替
 *   - 武器升級 = 換 ID（weaponInventory entry swap）— 不需戰鬥端讀 tier
 */
const BlacksmithEvents = (() => {

  // CLAUDE.md 第 12 條：bare addLog 在外部模組是 ReferenceError
  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    } else {
      console.warn('[BlacksmithEvents] _log: no addLog available', text);
    }
  }

  // ══════════════════════════════════════════
  // 階段 2：首件護甲（三幕結構）
  // ══════════════════════════════════════════
  function tryFirstArmor() {
    const p = Stats.player;
    if (!p || p.day < 12) return false;
    if (Flags.has('gra_first_armor')) return false;
    if (typeof teammates === 'undefined') return false;

    const aff = teammates.getAffection('blacksmithGra');
    if (aff < 20) return false;
    if ((p.combatStats?.arenaLosses ?? 0) < 1) return false;

    _playFirstArmorEvent(aff);
    return true;
  }

  function _playFirstArmorEvent(aff) {
    // 按好感決定護甲等級
    let armorId, armorName;
    if (aff >= 60) {
      armorId = 'studdedLeather'; armorName = '鉚釘皮甲';
    } else if (aff >= 40) {
      armorId = 'thickLeather'; armorName = '加厚皮甲';
    } else {
      armorId = 'leatherArmor'; armorName = '皮甲';
    }

    // 幕一：主人點名評估
    const act1Lines = [
      { text: '（訓練場側廊。你被帶路走過去。）' },
      { speaker: '主人', text: '隔壁莫拉斯家的戰士，素質聽說上來了。我們這波能不能看？' },
      { speaker: '塔倫', text: '有幾個還行。新來的，還在看。' },
      { speaker: '主人', text: '下午讓他們輪打，選幾個出來——過陣子要安排一場活動。' },
      { speaker: '塔倫', text: '明白。' },
      { text: '（葛拉靠牆站著。他看了你一眼——沒說話，低下頭繼續擦那根鐵條。）' },
    ];

    DialogueModal.play(act1Lines, {
      onComplete: () => _playAct2(armorId, armorName, aff),
    });
  }

  function _playAct2(armorId, armorName, aff) {
    // 幕二：競技場輪打（敘事，不走引擎）
    Stage.playEvent({
      title: '點名',
      icon: '⚔',
      color: '#aa7744',
      lines: [
        '主人在陽台，背光，看不清臉。',
        '塔倫一聲令下，所有人排開輪打。',
        '',
        '你遇上的第一個——老鳥，裝備比你齊整。',
        '差了一個 tier 的護甲，差了一個 tier 的武器。',
        '你輸了。不難看，但輸了。',
        '',
        '主人沒有看一眼。',
        '塔倫對著陽台點下頭，叫了下一組。',
      ],
      onComplete: () => _playAct3(armorId, armorName, aff),
    });
  }

  function _playAct3(armorId, armorName, aff) {
    // 幕三：葛拉鍛造坊
    const lastLine = aff >= 60
      ? { text: '（他沒加說明，直接轉身。但你看到他在那本小本子上寫了什麼。）' }
      : aff >= 40
        ? { speaker: '葛拉', text: '這件比那種貨色硬一點。要壞了，找我。' }
        : { speaker: '葛拉', text: '要壞了，也來找我。' };

    const act3Lines = [
      { text: '（有人拍了你肩一下。葛拉，用下巴指了指鍛造坊方向。）' },
    ];

    Stage.playEvent({
      title: '鍛造坊',
      icon: '🔥',
      color: '#cc6622',
      lines: ['葛拉的鍛造坊。鐵砧旁的炭火還燒著。'],
      onComplete: () => {
        const dialogLines = [
          { speaker: '葛拉', text: '坐。' },
          { speaker: '葛拉', text: '你今天那場——我看到了。' },
          { speaker: '葛拉', text: '裝備差了一截，不是你的問題。' },
          { text: `（他從架子上拿下一件護甲，扔到你腳邊。）` },
          { speaker: '葛拉', text: '多打的。拿去。' },
          { speaker: '葛拉', text: '別說是我給的。' },
          { text: '（停頓。他拿起那根鐵條敲了兩下。）' },
          lastLine,
        ];

        DialogueModal.play(dialogLines, {
          onComplete: () => _giveArmor(armorId, armorName),
        });
      },
    });
  }

  function _giveArmor(armorId, armorName) {
    const p = Stats.player;

    // 加進護甲庫
    if (!Array.isArray(p.armorInventory)) p.armorInventory = [{ id: 'rags' }];
    if (!p.armorInventory.find(e => e.id === armorId)) {
      p.armorInventory.push({ id: armorId });
    }
    // 自動裝備（之前只穿破布）
    if (!p.equippedArmor || p.equippedArmor === 'rags') {
      p.equippedArmor = armorId;
    }

    teammates.modAffection('blacksmithGra', +5);
    Flags.set('gra_first_armor', true);

    _log(`你得到了【${armorName}】。`, '#c8a060', true);
  }

  // ══════════════════════════════════════════
  // 🆕 階段 3：首次修繕（免費，含教學意義）
  // ══════════════════════════════════════════
  // 觸發：
  //   - 武器需修標記 (gra_weapon_needs_repair)
  //   - 葛拉好感 ≥ 25 + 階段 2 已完成
  //   - 還沒首次修繕過
  function tryFirstRepair() {
    const p = Stats.player;
    if (!p) return false;
    if (typeof Flags === 'undefined') return false;
    if (Flags.has('gra_first_repair')) return false;
    if (!Flags.has('gra_weapon_needs_repair')) return false;
    if (!Flags.has('gra_first_armor')) return false;  // 階段 2 先做
    if (typeof teammates === 'undefined') return false;
    if (teammates.getAffection('blacksmithGra') < 25) return false;

    Flags.set('gra_first_repair', true);
    Flags.unset('gra_weapon_needs_repair');
    _playFirstRepairEvent();
    return true;
  }

  function _playFirstRepairEvent() {
    if (typeof DialogueModal === 'undefined') {
      _log('葛拉看你的武器一眼：「快斷了。免費這次。下次你得付錢。」', '#cc8855', true);
      return;
    }
    const lines = [
      { text: '（你的武器開始搖晃。刃上有幾條細小的裂縫。）' },
      { text: '（葛拉走過、瞄一眼。）' },
      { speaker: '葛拉', text: '你這把劍快斷了。' },
      { text: '（他直接從你手上把武器拿走。）' },
      { speaker: '葛拉', text: '這次我免費。' },
      { speaker: '葛拉', text: '下次你得付錢——別讓我覺得我看錯人。' },
      { text: '（他放回鐵砧旁、敲了兩下。）' },
      { speaker: '葛拉', text: '明天來拿。' },
    ];
    DialogueModal.play(lines, {
      onComplete: () => {
        if (teammates && teammates.modAffection) teammates.modAffection('blacksmithGra', +5);
        _log('✦ 葛拉幫你把武器修好了（免費）。下次需要修繕要付錢。', '#c8a060', true);
      }
    });
  }

  // 戰鬥後呼叫 — 機率標記武器需修（簡化版 durability）
  // 整合點：battle.js Battle.start 結束後 / arena 結算後
  function markWeaponNeedsRepair(opts) {
    if (typeof Flags === 'undefined') return;
    if (Flags.has('gra_weapon_needs_repair')) return;
    // 已修過：用較低機率持續觸發（讓玩家偶爾去修）
    const baseChance = (opts && typeof opts.chance === 'number') ? opts.chance : 0.25;
    if (Math.random() < baseChance) {
      Flags.set('gra_weapon_needs_repair', true);
      // 不立即提示 — 讓事件觸發點來呈現
    }
  }

  // ══════════════════════════════════════════
  // 🆕 階段 4：武器升級 T2
  // ══════════════════════════════════════════
  // 觸發：
  //   - Day >= 25
  //   - 葛拉好感 ≥ 30 OR arena 3 勝
  //   - money ≥ 30
  //   - 階段 3 已完成
  //   - 玩家當前裝備武器有 T2 升級對應
  //   - 還沒升級過該武器
  function tryWeaponUpgradeT2() {
    const p = Stats.player;
    if (!p || p.day < 25) return false;
    if (typeof Flags === 'undefined') return false;
    if (!Flags.has('gra_first_repair')) return false;  // 階段 3 先做
    if (typeof teammates === 'undefined') return false;

    const aff = teammates.getAffection('blacksmithGra');
    const wins = (p.combatStats?.arenaWins || 0);
    if (aff < 30 && wins < 3) return false;

    if ((p.money || 0) < 30) return false;

    // 檢查當前裝備武器是否有 T2 對應
    const currentWeaponId = p.equippedWeapon;
    if (!currentWeaponId) return false;
    const upgradeMap = (typeof WEAPON_TIER_UPGRADE !== 'undefined') ? WEAPON_TIER_UPGRADE : {};
    const t2Id = upgradeMap[currentWeaponId];
    if (!t2Id) return false;  // 玩家武器不在升級對照表（已是 T2 / 不在系列）

    // 還沒升級過該武器（避免重複觸發）
    const flagKey = `gra_upgraded_${currentWeaponId}`;
    if (Flags.has(flagKey)) return false;

    _playUpgradeT2Event(currentWeaponId, t2Id, flagKey);
    return true;
  }

  function _playUpgradeT2Event(currentId, t2Id, flagKey) {
    const w     = (typeof Weapons !== 'undefined') ? Weapons[currentId] : null;
    const newW  = (typeof Weapons !== 'undefined') ? Weapons[t2Id]      : null;
    const oldName = w     ? w.name    : currentId;
    const newName = newW  ? newW.name : t2Id;

    if (typeof ChoiceModal === 'undefined') {
      // fallback：自動接受
      _grantWeaponUpgrade(currentId, t2Id, flagKey, oldName, newName);
      return;
    }

    // 先播旁白、再彈 ChoiceModal
    if (typeof DialogueModal !== 'undefined') {
      DialogueModal.play([
        { text: '（葛拉走過你身邊、用下巴指了指鍛造坊。）' },
        { speaker: '葛拉', text: '你那把——' },
        { speaker: '葛拉', text: `${oldName}。` },
        { speaker: '葛拉', text: '可以再上一階。' },
        { text: '（他敲了敲鐵砧。）' },
        { speaker: '葛拉', text: '三十金。明天來拿。' },
        { speaker: '葛拉', text: '⋯⋯不收手工。是看你最近的份上。' },
      ], {
        onComplete: () => {
          ChoiceModal.show({
            id: 'gra_weapon_upgrade_t2',
            icon: '🔥',
            title: '葛拉提議升級你的武器',
            body: `${oldName} → ${newName}（30 金）`,
            forced: true,
            choices: [
              {
                id: 'accept',
                label: `付 30 金 升級`,
                hint: '（他不收手工。）',
                effects: [
                  { type: 'money', delta: -30 },
                ],
                resultLog: `✦ 葛拉接過你的 ${oldName}。「明天來拿。」`,
                logColor: '#c8a060',
              },
              {
                id: 'decline',
                label: '不用',
                hint: '（這把還行。）',
                resultLog: '葛拉聳肩：「⋯⋯隨你。」',
                logColor: '#8899aa',
              },
            ],
          }, {
            onChoose: (choiceId) => {
              if (choiceId === 'accept') {
                _grantWeaponUpgrade(currentId, t2Id, flagKey, oldName, newName);
              }
            }
          });
        }
      });
    }
  }

  function _grantWeaponUpgrade(oldId, newId, flagKey, oldName, newName) {
    const p = Stats.player;
    if (!Array.isArray(p.weaponInventory)) p.weaponInventory = [];

    // 移除舊武器（如果在 inventory）+ 加新武器
    const oldIdx = p.weaponInventory.findIndex(e => (e.id || e) === oldId);
    if (oldIdx >= 0) p.weaponInventory.splice(oldIdx, 1);
    if (!p.weaponInventory.find(e => (e.id || e) === newId)) {
      p.weaponInventory.push({ id: newId });
    }

    // 自動裝備新武器（替換當前裝備的舊版）
    if (p.equippedWeapon === oldId) {
      p.equippedWeapon = newId;
    }

    Flags.set(flagKey, true);
    Flags.set('gra_weapon_t2', true);  // 一次性 flag（任一武器升 T2 都 set，方便階段 6 判斷）
    if (teammates && teammates.modAffection) teammates.modAffection('blacksmithGra', +8);
    _log(`✦ 你獲得了【${newName}】（從 ${oldName} 升級）。`, '#c8a060', true);
  }

  // ══════════════════════════════════════════
  // 存檔 / 讀檔（目前無狀態需序列化）
  // ══════════════════════════════════════════
  function serialize()      { return {}; }
  function restore(_data)   { }
  function reset()          { }

  return {
    tryFirstArmor,           // 階段 2
    tryFirstRepair,          // 階段 3
    markWeaponNeedsRepair,   // 戰鬥後 hook
    tryWeaponUpgradeT2,      // 階段 4
    serialize, restore, reset,
  };
})();
