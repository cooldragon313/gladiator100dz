/**
 * blacksmith_events.js — 鐵匠葛拉事件系統
 * ══════════════════════════════════════════
 * 設計：docs/quests/blacksmith-gra.md
 * 角色：docs/characters/blacksmithGra.md
 *
 * 觸發機制（晨起 / 訓練後 hook）：
 *   - tryFirstArmor()       階段 2 — 好感 ≥ 20 + Day ≥ 12 → 三幕進場 + 送皮甲（2026-04-25c：移除 arenaLosses 要求）
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
    // 🆕 2026-04-25c：使用者反饋 — 鍛造師流程不要綁競技場勝負
    //   原本 arenaLosses ≥ 1 = 必須先輸過一場才看葛拉示弱送皮甲
    //   改：好感到就好（葛拉自己注意到玩家撐不住）

    _playFirstArmorEvent(aff);
    return true;
  }

  function _playFirstArmorEvent(aff) {
    // 🆕 2026-04-25c：立刻設 flag — 避免後續任何 callback chain 斷掉就每天重播
    //   原本 flag 在 _giveArmor 末端才設，三幕中間 callback 任一壞掉就永遠 set 不到
    //   現在第一幕一啟動就設 — 護甲在 _giveArmor 才實際發放，不影響後續邏輯
    Flags.set('gra_first_armor', true);

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

    // 🆕 2026-04-27：階段 2 一次給整套 T1 皮甲（leatherArmor + thickLeather + studdedLeather）
    //   設計理由：玩家有換裝選擇才能測試後續事件（修繕 / 升級判定吃當前裝備）
    //   主送的還是依好感決定的那件、自動裝備
    //   其他兩件進 inventory、玩家可換
    if (!Array.isArray(p.armorInventory)) p.armorInventory = [{ id: 'rags' }];
    const t1Set = ['leatherArmor', 'thickLeather', 'studdedLeather'];
    t1Set.forEach(id => {
      if (!p.armorInventory.find(e => e.id === id)) {
        p.armorInventory.push({ id });
      }
    });

    // 自動裝備主送那件（之前只穿破布）
    if (!p.equippedArmor || p.equippedArmor === 'rags') {
      p.equippedArmor = armorId;
    }

    teammates.modAffection('blacksmithGra', +5);
    Flags.set('gra_first_armor', true);

    _log(`你得到了【${armorName}】。`, '#c8a060', true);
    _log(`✦ 葛拉順手塞了【加厚皮甲】跟【鉚釘皮甲】給你：「換著穿、別讓哪件破得太快。」`, '#888899', false);
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
    if (!p || p.day < 18) return false;   // 🆕 2026-04-25c：階段 2 是 Day 12、隔幾天再觸發
    if (typeof Flags === 'undefined') return false;
    if (Flags.has('gra_first_repair')) return false;
    if (!Flags.has('gra_first_armor')) return false;  // 階段 2 先做
    if (typeof teammates === 'undefined') return false;
    if (teammates.getAffection('blacksmithGra') < 25) return false;
    // 🆕 2026-04-25c：移除 gra_weapon_needs_repair flag 要求（之前綁戰鬥才會設）
    //   現在純好感觸發 — 葛拉敘事上「看你訓練那麼多次劍刃也磨損了」即可

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
    if (aff < 30) return false;
    // 🆕 2026-04-25c：移除 wins ≥ 3 替代條件，純好感觸發

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

    // 🆕 2026-04-30 修：保留舊武器的品質、tier 升一階（之前 push({id:newId}) 會把紫匕首歸零成 common）
    const oldIdx = p.weaponInventory.findIndex(e => (e.id || e) === oldId);
    const oldEntry = oldIdx >= 0 ? p.weaponInventory[oldIdx] : null;
    const oldQuality = (oldEntry && oldEntry.quality) || 'common';
    const oldTier    = (oldEntry && oldEntry.tier) || 1;

    if (oldIdx >= 0) p.weaponInventory.splice(oldIdx, 1);
    const existingNew = p.weaponInventory.find(e => (e.id || e) === newId);
    if (!existingNew) {
      p.weaponInventory.push({ id: newId, tier: oldTier + 1, quality: oldQuality });
    } else {
      // 同 ID 已有 → 升品質到舊品質（如果舊的更好）
      const order = ['crude','common','fine','superb','legendary'];
      if (order.indexOf(oldQuality) > order.indexOf(existingNew.quality || 'common')) {
        existingNew.quality = oldQuality;
      }
    }

    // 自動裝備新武器（替換當前裝備的舊版）
    if (p.equippedWeapon === oldId) {
      p.equippedWeapon = newId;
    }

    Flags.set(flagKey, true);
    Flags.set('gra_weapon_t2', true);  // 一次性 flag（任一武器升 T2 都 set，方便階段 6 判斷）
    if (teammates && teammates.modAffection) teammates.modAffection('blacksmithGra', +8);
    _log(`✦ 你獲得了【${newName}】（從 ${oldName} 升級、保留品質：${oldQuality}）。`, '#c8a060', true);
  }

  // ══════════════════════════════════════════
  // 🆕 階段 6：武器升級 T3（80 金）
  // ══════════════════════════════════════════
  // 觸發：
  //   - Day >= 50
  //   - 葛拉好感 ≥ 50
  //   - arena 5 勝
  //   - money ≥ 80
  //   - 玩家當前裝備武器是 T2（已階段 4 升過）
  //   - 還沒升 T3 過該武器
  function tryWeaponUpgradeT3() {
    const p = Stats.player;
    if (!p || p.day < 50) return false;
    if (typeof Flags === 'undefined') return false;
    if (typeof teammates === 'undefined') return false;

    const aff = teammates.getAffection('blacksmithGra');
    if (aff < 50) return false;
    // 🆕 2026-04-25c：移除 wins ≥ 5 要求，純好感觸發

    if ((p.money || 0) < 80) return false;

    const currentWeaponId = p.equippedWeapon;
    if (!currentWeaponId) return false;
    const upgradeMap = (typeof WEAPON_TIER_UPGRADE_T3 !== 'undefined') ? WEAPON_TIER_UPGRADE_T3 : {};
    const t3Id = upgradeMap[currentWeaponId];
    if (!t3Id) return false;

    const flagKey = `gra_upgraded_t3_${currentWeaponId}`;
    if (Flags.has(flagKey)) return false;

    _playUpgradeT3Event(currentWeaponId, t3Id, flagKey);
    return true;
  }

  function _playUpgradeT3Event(currentId, t3Id, flagKey) {
    const w     = (typeof Weapons !== 'undefined') ? Weapons[currentId] : null;
    const newW  = (typeof Weapons !== 'undefined') ? Weapons[t3Id]      : null;
    const oldName = w     ? w.name    : currentId;
    const newName = newW  ? newW.name : t3Id;

    if (typeof DialogueModal === 'undefined') {
      _grantWeaponUpgradeT3(currentId, t3Id, flagKey, oldName, newName);
      return;
    }

    DialogueModal.play([
      { text: '（葛拉拿著你的武器看了很久。）' },
      { speaker: '葛拉', text: '⋯⋯這把該再上一階了。' },
      { speaker: '葛拉', text: '我用我這幾年存的好鋼。' },
      { speaker: '葛拉', text: '八十金。明天來拿。' },
      { text: '（他停下。）' },
      { speaker: '葛拉', text: '⋯⋯這次我會在劍背刻名字。我的。' },
      { text: '（他從不對誰這麼說。）' },
    ], {
      onComplete: () => {
        if (typeof ChoiceModal === 'undefined') {
          _grantWeaponUpgradeT3(currentId, t3Id, flagKey, oldName, newName);
          return;
        }
        ChoiceModal.show({
          id: 'gra_weapon_upgrade_t3',
          icon: '🔥',
          title: '葛拉提議升級你的武器',
          body: `${oldName} → ${newName}（80 金）\n他要在劍背刻名字。`,
          forced: true,
          choices: [
            {
              id: 'accept',
              label: '付 80 金 升級',
              hint: '（葛拉的最高榮譽。）',
              effects: [{ type: 'money', delta: -80 }],
              resultLog: `葛拉接過 ${oldName}：「明天來拿。」`,
              logColor: '#c8a060',
            },
            {
              id: 'decline',
              label: '不用',
              hint: '（這把還行。）',
              resultLog: '葛拉沉默地把武器還給你。「⋯⋯隨你。」',
              logColor: '#8899aa',
            },
          ],
        }, {
          onChoose: (choiceId) => {
            if (choiceId === 'accept') {
              _grantWeaponUpgradeT3(currentId, t3Id, flagKey, oldName, newName);
            }
          }
        });
      }
    });
  }

  function _grantWeaponUpgradeT3(oldId, newId, flagKey, oldName, newName) {
    const p = Stats.player;
    if (!Array.isArray(p.weaponInventory)) p.weaponInventory = [];

    // 🆕 2026-04-30 修：保留舊武器的品質、tier 升一階
    const oldIdx = p.weaponInventory.findIndex(e => (e.id || e) === oldId);
    const oldEntry = oldIdx >= 0 ? p.weaponInventory[oldIdx] : null;
    const oldQuality = (oldEntry && oldEntry.quality) || 'common';
    const oldTier    = (oldEntry && oldEntry.tier) || 2;

    if (oldIdx >= 0) p.weaponInventory.splice(oldIdx, 1);
    const existingNew = p.weaponInventory.find(e => (e.id || e) === newId);
    if (!existingNew) {
      p.weaponInventory.push({ id: newId, tier: oldTier + 1, quality: oldQuality });
    } else {
      const order = ['crude','common','fine','superb','legendary'];
      if (order.indexOf(oldQuality) > order.indexOf(existingNew.quality || 'common')) {
        existingNew.quality = oldQuality;
      }
    }

    if (p.equippedWeapon === oldId) {
      p.equippedWeapon = newId;
    }

    Flags.set(flagKey, true);
    Flags.set('gra_weapon_t3', true);
    if (teammates && teammates.modAffection) teammates.modAffection('blacksmithGra', +12);
    _log(`✦ 你獲得了【${newName}】（從 ${oldName} 升級、保留品質：${oldQuality}）。`, '#c8a060', true);
    if (typeof Stage !== 'undefined' && Stage.popupBig) {
      Stage.popupBig({
        icon: '⚔', title: newName, subtitle: '葛拉的鍛造',
        color: 'gold', duration: 1800, shake: true, sound: 'acquire',
      });
    }
  }

  // ══════════════════════════════════════════
  // 🆕 階段 7：護甲升級（依當前裝備自動換下一階）
  // ══════════════════════════════════════════
  // 觸發：
  //   - Day >= 60
  //   - 葛拉好感 ≥ 40
  //   - 階段 4 已完成（gra_weapon_t2 = 玩家已開始升級之路）
  //   - 玩家當前裝備有對應升級
  //   - 還沒升過該護甲
  //   - money ≥ 50（護甲升級 50 金）
  function tryArmorUpgrade() {
    const p = Stats.player;
    if (!p || p.day < 60) return false;
    if (typeof Flags === 'undefined') return false;
    if (typeof teammates === 'undefined') return false;
    if (!Flags.has('gra_weapon_t2')) return false;

    const aff = teammates.getAffection('blacksmithGra');
    if (aff < 40) return false;

    if ((p.money || 0) < 50) return false;

    const currentArmorId = p.equippedArmor;
    if (!currentArmorId) return false;
    const upgradeMap = (typeof ARMOR_TIER_UPGRADE !== 'undefined') ? ARMOR_TIER_UPGRADE : {};
    const nextId = upgradeMap[currentArmorId];
    if (!nextId) return false;

    const flagKey = `gra_upgraded_armor_${currentArmorId}`;
    if (Flags.has(flagKey)) return false;

    _playArmorUpgradeEvent(currentArmorId, nextId, flagKey);
    return true;
  }

  function _playArmorUpgradeEvent(currentId, nextId, flagKey) {
    const a    = (typeof Armors !== 'undefined') ? Armors[currentId] : null;
    const newA = (typeof Armors !== 'undefined') ? Armors[nextId]    : null;
    const oldName = a    ? a.name    : currentId;
    const newName = newA ? newA.name : nextId;
    const cost = 50;

    if (typeof DialogueModal === 'undefined') {
      _grantArmorUpgrade(currentId, nextId, flagKey, oldName, newName);
      return;
    }

    DialogueModal.play([
      { text: '（葛拉敲了敲你身上的甲。）' },
      { speaker: '葛拉', text: '這身——夠了。' },
      { speaker: '葛拉', text: '我有一套新的給你。' },
      { speaker: '葛拉', text: `${cost} 金。明天來拿。` },
    ], {
      onComplete: () => {
        if (typeof ChoiceModal === 'undefined') {
          _grantArmorUpgrade(currentId, nextId, flagKey, oldName, newName);
          return;
        }
        ChoiceModal.show({
          id: 'gra_armor_upgrade',
          icon: '🛡',
          title: '葛拉提議升級你的護甲',
          body: `${oldName} → ${newName}（${cost} 金）`,
          forced: true,
          choices: [
            {
              id: 'accept',
              label: `付 ${cost} 金 升級`,
              effects: [{ type: 'money', delta: -cost }],
              resultLog: '葛拉接過你身上的甲：「明天再見。」',
              logColor: '#c8a060',
            },
            {
              id: 'decline',
              label: '不用',
              resultLog: '葛拉聳肩：「⋯⋯隨你。」',
              logColor: '#8899aa',
            },
          ],
        }, {
          onChoose: (choiceId) => {
            if (choiceId === 'accept') {
              _grantArmorUpgrade(currentId, nextId, flagKey, oldName, newName);
            }
          }
        });
      }
    });
  }

  function _grantArmorUpgrade(oldId, newId, flagKey, oldName, newName) {
    const p = Stats.player;
    if (!Array.isArray(p.armorInventory)) p.armorInventory = [];

    // 🆕 2026-04-30 修：保留舊護甲的品質、tier 升一階
    const oldIdx = p.armorInventory.findIndex(e => (e.id || e) === oldId);
    const oldEntry = oldIdx >= 0 ? p.armorInventory[oldIdx] : null;
    const oldQuality = (oldEntry && oldEntry.quality) || 'common';
    const oldTier    = (oldEntry && oldEntry.tier) || 1;
    if (oldIdx >= 0) p.armorInventory.splice(oldIdx, 1);

    const existingNew = p.armorInventory.find(e => (e.id || e) === newId);
    if (!existingNew) {
      p.armorInventory.push({ id: newId, tier: oldTier + 1, quality: oldQuality });
    } else {
      const order = ['crude','common','fine','superb','legendary'];
      if (order.indexOf(oldQuality) > order.indexOf(existingNew.quality || 'common')) {
        existingNew.quality = oldQuality;
      }
    }
    if (p.equippedArmor === oldId) {
      p.equippedArmor = newId;
    }

    Flags.set(flagKey, true);
    Flags.set('gra_armor_upgraded_once', true);
    if (teammates && teammates.modAffection) teammates.modAffection('blacksmithGra', +8);
    _log(`✦ 你獲得了【${newName}】（從 ${oldName} 升級）。`, '#c8a060', true);
    if (typeof Stage !== 'undefined' && Stage.popupBig) {
      Stage.popupBig({
        icon: '🛡', title: newName, subtitle: '葛拉的鍛造',
        color: 'gold', duration: 1600, shake: true, sound: 'acquire',
      });
    }
  }

  // ══════════════════════════════════════════
  // 🆕 階段 5：秘法打造（雙刃短劍）
  // ══════════════════════════════════════════
  // 觸發：
  //   - 玩家讀過 twin_blade_schematic 書（flag knows_twin_blade_recipe）
  //   - 葛拉好感 ≥ 30
  //   - 50 金
  //   - 還沒做過秘法
  function tryBlueprintCraft() {
    const p = Stats.player;
    if (!p) return false;
    if (typeof Flags === 'undefined') return false;
    if (Flags.has('gra_blueprint_done')) return false;
    if (!Flags.has('knows_twin_blade_recipe')) return false;
    if (typeof teammates === 'undefined') return false;
    if (teammates.getAffection('blacksmithGra') < 30) return false;
    if ((p.money || 0) < 50) return false;

    _playBlueprintCraftEvent();
    return true;
  }

  function _playBlueprintCraftEvent() {
    if (typeof DialogueModal === 'undefined') {
      _grantTwinblade();
      return;
    }
    DialogueModal.play([
      { text: '（葛拉看著你手上那本《雙刃合鑄法殘篇》。）' },
      { speaker: '葛拉', text: '⋯⋯你哪來這個。' },
      { text: '（他沒等你回答。）' },
      { speaker: '葛拉', text: '我試試。給我兩把破刀 + 五十金。' },
      { speaker: '葛拉', text: '三天後來拿。' },
    ], {
      onComplete: () => {
        if (typeof ChoiceModal === 'undefined') {
          _grantTwinblade();
          return;
        }
        ChoiceModal.show({
          id: 'gra_blueprint_twinblade',
          icon: '🔥',
          title: '葛拉提議造雙刃短劍',
          body: '兩把短劍熔在一起 — 副手 ATK 不打折。\n50 金 + 三天等待。',
          forced: true,
          choices: [
            {
              id: 'accept',
              label: '付 50 金 委託',
              hint: '（這武器在外面買不到。）',
              effects: [{ type: 'money', delta: -50 }],
              resultLog: '葛拉收下錢：「⋯⋯我等你三天後來。」',
              logColor: '#c8a060',
            },
            {
              id: 'decline',
              label: '不用',
              resultLog: '葛拉聳肩：「行。書還我。」（其實沒收回。）',
              logColor: '#8899aa',
            },
          ],
        }, {
          onChoose: (choiceId) => {
            if (choiceId === 'accept') _grantTwinblade();
          }
        });
      }
    });
  }

  function _grantTwinblade() {
    const p = Stats.player;
    if (!Array.isArray(p.weaponInventory)) p.weaponInventory = [];
    if (!p.weaponInventory.find(e => (e.id || e) === 'twinblade')) {
      // 🆕 2026-04-30 加 tier + quality 預設（雙刃 T2.5 階段、葛拉精製品 = fine）
      p.weaponInventory.push({ id: 'twinblade', tier: 2, quality: 'fine' });
    }
    Flags.set('gra_blueprint_done', true);
    if (teammates && teammates.modAffection) teammates.modAffection('blacksmithGra', +10);
    _log('✦ 三天後你領回——一把奇怪的雙刃短劍。', '#c8a060', true);
    _log('（兩把短劍熔在一起。揮起來像短劍、但副手能用長劍的力道。）', '#a89070', false);
    if (typeof Stage !== 'undefined' && Stage.popupBig) {
      Stage.popupBig({
        icon: '⚔', title: '雙刃短劍', subtitle: '葛拉的秘法',
        color: 'gold', duration: 1800, shake: true, sound: 'acquire',
      });
    }
  }

  // ══════════════════════════════════════════
  // 🆕 階段 8：傳家武器（tier 4 劇情）
  // ══════════════════════════════════════════
  // 觸發：
  //   - Day >= 80
  //   - 葛拉好感 ≥ 80
  //   - 玩家有 divine_blessing 或 iron_body 特性（罕見出生稀有特性）
  //   - 已升過 T3 武器（gra_weapon_t3）
  //   - 還沒拿過傳家武器
  function tryHeirloomWeapon() {
    const p = Stats.player;
    if (!p || p.day < 80) return false;
    if (typeof Flags === 'undefined') return false;
    if (Flags.has('gra_heirloom_done')) return false;
    if (typeof teammates === 'undefined') return false;
    if (teammates.getAffection('blacksmithGra') < 80) return false;
    if (!Flags.has('gra_weapon_t3')) return false;

    const traits = Array.isArray(p.traits) ? p.traits : [];
    const hasSpecialTrait = traits.includes('divine_blessing') || traits.includes('iron_body');
    if (!hasSpecialTrait) return false;

    const currentWeaponId = p.equippedWeapon;
    if (!currentWeaponId) return false;
    const upgradeMap = (typeof WEAPON_TIER_UPGRADE_T4 !== 'undefined') ? WEAPON_TIER_UPGRADE_T4 : {};
    const t4Id = upgradeMap[currentWeaponId];
    if (!t4Id) return false;

    _playHeirloomEvent(currentWeaponId, t4Id);
    return true;
  }

  function _playHeirloomEvent(currentId, t4Id) {
    const w     = (typeof Weapons !== 'undefined') ? Weapons[currentId] : null;
    const newW  = (typeof Weapons !== 'undefined') ? Weapons[t4Id]      : null;
    const oldName = w     ? w.name    : currentId;
    const newName = newW  ? newW.name : t4Id;

    DialogueModal.play([
      { text: '（葛拉把你叫到鍛造坊。火還沒滅。）' },
      { speaker: '葛拉', text: '⋯⋯坐。' },
      { text: '（他從炭火裡拿出一個東西、還燒紅的。）' },
      { text: '（他用鉗子夾著、舉到你眼前。）' },
      { speaker: '葛拉', text: '我這輩子打過很多刀。' },
      { speaker: '葛拉', text: '⋯⋯這把是最後一把這樣的。' },
      { text: '（他看你。眼神不一樣。）' },
      { speaker: '葛拉', text: '帶出去。' },
      { speaker: '葛拉', text: '別讓它斷在你之前。' },
      { text: '（他用爐火重新淬了一次、然後遞給你。）' },
      { text: '（劍背刻了兩個字。葛拉的名字。）' },
    ], {
      onComplete: () => _grantHeirloom(currentId, t4Id, oldName, newName)
    });
  }

  function _grantHeirloom(oldId, newId, oldName, newName) {
    const p = Stats.player;
    if (!Array.isArray(p.weaponInventory)) p.weaponInventory = [];
    // 🆕 2026-04-30 傳家武器永遠是 legendary 品質、tier 4
    if (!p.weaponInventory.find(e => (e.id || e) === newId)) {
      p.weaponInventory.push({ id: newId, tier: 4, quality: 'legendary' });
    }
    if (p.equippedWeapon === oldId) {
      p.equippedWeapon = newId;
    }
    Flags.set('gra_heirloom_done', true);
    if (teammates && teammates.modAffection) teammates.modAffection('blacksmithGra', +20);
    _log(`✦ 你獲得了【${newName}】。葛拉一輩子最好的鍛造。`, '#d4af37', true);
    if (typeof Stage !== 'undefined' && Stage.popupBig) {
      Stage.popupBig({
        icon: '✦', title: newName, subtitle: '葛拉的傳家',
        color: 'gold', duration: 2400, shake: true, sound: 'acquire',
      });
    }
  }

  // ══════════════════════════════════════════
  // 🆕 2026-04-29 主人召見大畫面（解鎖鍛造坊 UI）
  //   設計：[docs/systems/equipment-rework.md](../../docs/systems/equipment-rework.md) § 4.2
  //   觸發：首次連勝 5 場（battle.js 在 _applyStreakRewards 呼叫設 pending flag）
  //   時機：下次訓練後 hook 檢查、playForge unlock 大事件
  // ══════════════════════════════════════════
  function tryMasterSummonsForUnlock() {
    if (typeof Flags === 'undefined') return false;
    if (Flags.has('gra_forge_unlocked')) return false;        // 已解鎖
    if (!Flags.has('gra_forge_unlock_pending')) return false; // 沒被標記
    if (typeof DialogueModal === 'undefined') {
      // fallback：沒 modal 就直接解鎖、不演大事件
      Flags.set('gra_forge_unlocked', true);
      Flags.unset && Flags.unset('gra_forge_unlock_pending');
      _log('✦ 主人召見：「⋯⋯你現在可以自己選武器、自己強化裝備了。」', '#d4af37', true);
      return true;
    }

    // 立刻設 unlocked 防呆（避免 callback chain 斷掉每天重播）
    Flags.set('gra_forge_unlocked', true);
    if (Flags.unset) Flags.unset('gra_forge_unlock_pending');

    DialogueModal.play([
      { text: '（塔倫拍你肩、把你推到主人廳。）' },
      { text: '（主人正在桌邊看一份報告。看到你進來，他抬頭。）' },
      { speaker: '阿圖斯', text: '你很好！', color: '#f0d068' },
      { speaker: '阿圖斯', text: '⋯⋯我這個訓練所、下一個招牌就是你。' },
      { text: '（他轉身、招手叫葛拉過來。）' },
      { speaker: '阿圖斯', text: '葛拉、他現在可以自己選武器、自己強化裝備了。' },
      { speaker: '阿圖斯', text: '他要什麼你給他什麼。' },
      { speaker: '阿圖斯', text: '⋯⋯我准了。' },
      { text: '（葛拉低頭。）' },
      { speaker: '葛拉', text: '⋯⋯遵命。' },
      { text: '（主人拍拍你肩。）' },
      { speaker: '阿圖斯', text: '走、去打你的鐵。' },
    ], {
      onComplete: () => {
        if (typeof Stage !== 'undefined' && Stage.popupBig) {
          Stage.popupBig({
            icon: '⚒', title: '鍛造坊解鎖', subtitle: '主人允許你自己選武器、自己強化',
            color: 'gold', duration: 2200, shake: true, sound: 'acquire',
            onComplete: () => {
              _log('✦ 鍛造坊解鎖！訓練場行動列出現「去找葛拉」。', '#d4af37', true);
              if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
            },
          });
        } else {
          _log('✦ 鍛造坊解鎖！訓練場行動列出現「去找葛拉」。', '#d4af37', true);
          if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
        }
      }
    });
    return true;
  }

  // ══════════════════════════════════════════
  // 存檔 / 讀檔（目前無狀態需序列化）
  // ══════════════════════════════════════════
  // ══════════════════════════════════════════════════
  // 🆕 2026-05-06 葛拉私人教學系統（5 階段、累積觀察觸發）
  // ══════════════════════════════════════════════════
  // 觸發條件：
  //   - 每次 STR 訓練動作完成時呼叫（main.js _scanNpcNotice 內）
  //   - 葛拉在當天場景內（teammates 或 audience 都可）
  //   - 同一天最多累 1 次（避免一天連發）
  //   - 累積到 3 次 → 觸發下一階段（前提：好感達當階門檻）
  //
  // 5 階段獎勵：
  //   階段 1（aff ≥ 30）：STR EXP +30 — 「握力」
  //   階段 2（aff ≥ 40）：STR EXP +60 — 「出力」
  //   階段 3（aff ≥ 50）：STR +1 直接屬性 — 「腰胯傳力」
  //   階段 4（aff ≥ 60）：STR +3 直接屬性 — 「震勁」
  //   階段 5（aff ≥ 70）：STR +5 直接屬性 — 「崩」
  //
  // Flags：
  //   gra_teach_count   — 自上次觸發以來累積觀察次數（達 3 重置）
  //   gra_teach_stage   — 已完成的階段（0~5）
  //   gra_teach_today   — 當天已累過（鎖 1/day）
  // ══════════════════════════════════════════════════

  const GRA_TEACH_THRESHOLD = 3;
  const GRA_TEACH_STAGES = [
    {
      stage: 1, affNeed: 30,
      title: '葛拉教你 — 握力', subtitle: 'STR EXP +30',
      reward: { type: 'exp', attr: 'STR', delta: 30 },
      lines: [
        { text: '（你又推完一輪石頭、手在抖。）' },
        { text: '（葛拉走過來、什麼話都沒說、抓起你的手。）' },
        { speaker: '葛拉', text: '⋯⋯握法錯了。' },
        { speaker: '葛拉', text: '拇指扣下面。不是包外面。' },
        { speaker: '葛拉', text: '來、再推一次。' },
        { text: '（他親自示範握法、然後鬆手。）' },
        { text: '（你跟著做。）' },
        { text: '（——對。這次力沒散。）' },
        { speaker: '葛拉', text: '⋯⋯記住。' },
        { text: '（他轉身回鍛造坊、一句廢話都沒有。）' },
      ],
    },
    {
      stage: 2, affNeed: 40,
      title: '葛拉教你 — 出力', subtitle: 'STR EXP +60',
      reward: { type: 'exp', attr: 'STR', delta: 60 },
      lines: [
        { speaker: '葛拉', text: '⋯⋯你還在用手臂硬推。' },
        { speaker: '葛拉', text: '力是從腳跟出來的。' },
        { speaker: '葛拉', text: '站穩。膝蓋微彎。屁股壓低。' },
        { speaker: '葛拉', text: '然後從這裡——' },
        { text: '（他用拳頭輕敲你的腰。）' },
        { speaker: '葛拉', text: '——一路頂上來。' },
        { text: '（你照他說的試。）' },
        { text: '（——對。完全不一樣的感覺。）' },
        { text: '（同樣的石頭、突然輕了。）' },
      ],
    },
    {
      stage: 3, affNeed: 50,
      title: '葛拉教你 — 腰胯傳力', subtitle: 'STR +1（永久屬性）',
      reward: { type: 'attr', attr: 'STR', delta: 1 },
      lines: [
        { speaker: '葛拉', text: '⋯⋯出力對了、但力沒傳出去。' },
        { speaker: '葛拉', text: '你出去的拳是直線。太老實。' },
        { speaker: '葛拉', text: '腰要先轉。肩跟後到。' },
        { text: '（他比劃了一下。動作不大、但你看到他袖子破風的聲。）' },
        { speaker: '葛拉', text: '打鐵也一樣——錘下去前、腰先動。' },
        { text: '（你試。）' },
        { text: '（震——你的拳第一次有重量感了。）' },
        { speaker: '葛拉', text: '⋯⋯有那個意思了。' },
      ],
    },
    {
      stage: 4, affNeed: 60,
      title: '葛拉教你 — 震勁', subtitle: 'STR +3（永久屬性）',
      reward: { type: 'attr', attr: 'STR', delta: 3 },
      lines: [
        { speaker: '葛拉', text: '⋯⋯今天教你個別人不會的。' },
        { speaker: '葛拉', text: '短距離。' },
        { speaker: '葛拉', text: '把全身力氣壓進三寸內。' },
        { text: '（他握拳、貼著木樁、什麼都沒做、然後——）' },
        { text: '（喀。木樁裂了。）' },
        { speaker: '葛拉', text: '⋯⋯試試。' },
        { text: '（你照做。第一次手骨震得發麻。）' },
        { text: '（但——木樁也裂了。）' },
        { speaker: '葛拉', text: '⋯⋯這招、別到處用。' },
      ],
    },
    {
      stage: 5, affNeed: 70,
      title: '葛拉教你 — 崩', subtitle: 'STR +5（永久屬性、葛拉私傳）',
      reward: { type: 'attr', attr: 'STR', delta: 5 },
      lines: [
        { speaker: '葛拉', text: '⋯⋯最後一招。' },
        { speaker: '葛拉', text: '我教兒子、教過一次。' },
        { text: '（他停了一下。看著遠方。）' },
        { speaker: '葛拉', text: '把腳跟抬離地、一瞬間落下。' },
        { speaker: '葛拉', text: '然後——所有東西、都跟著落下。' },
        { text: '（他示範。地上的灰、跟著震起來。）' },
        { text: '（你試。第一次差點摔倒。）' },
        { text: '（第二次——你打出去的拳、自己都嚇到。）' },
        { speaker: '葛拉', text: '⋯⋯記住這個感覺。' },
        { speaker: '葛拉', text: '⋯⋯以後都用得到。' },
        { text: '（他拍了拍你的肩、轉身走了。）' },
        { text: '（你站在訓練場、感覺自己跟剛才不太一樣。）' },
      ],
    },
  ];

  /**
   * 試觸發葛拉私人教學（每次 STR 訓練 + 葛拉在場時呼叫）
   * @param {object} npcs  currentNPCs { teammates, audience }
   * @returns {boolean} true 若觸發了某階段
   */
  function tryTeaching(npcs) {
    if (typeof teammates === 'undefined') return false;
    // 葛拉是否在場
    const inScene = [...(npcs.teammates || []), ...(npcs.audience || [])].includes('blacksmithGra');
    if (!inScene) return false;

    // 一天只累 1 次
    if (Flags.has('gra_teach_today')) return false;

    // 階段已全部走完
    const stage = Flags.get('gra_teach_stage') || 0;
    if (stage >= GRA_TEACH_STAGES.length) return false;

    // 累積觀察次數
    Flags.set('gra_teach_today', true);
    const newCount = Flags.increment('gra_teach_count');
    if (newCount < GRA_TEACH_THRESHOLD) return false;

    // 達門檻 — 檢查當階段好感
    const nextStage = GRA_TEACH_STAGES[stage];
    const aff = teammates.getAffection('blacksmithGra');
    if (aff < nextStage.affNeed) {
      // 好感不夠 — 計數歸零等下一輪（玩家養感情後再觸發）
      Flags.set('gra_teach_count', 0);
      _log(`（葛拉看著你訓練、嘴邊像要說什麼、又轉身回去了。）（好感未達 ${nextStage.affNeed}、教學暫停）`, '#888', false);
      return false;
    }

    // 觸發！
    Flags.set('gra_teach_count', 0);
    Flags.set('gra_teach_stage', stage + 1);
    _playTeachingStage(nextStage);
    return true;
  }

  function _playTeachingStage(stageData) {
    if (typeof DialogueModal === 'undefined') {
      // fallback
      _applyStageReward(stageData);
      _log(`✦ ${stageData.title}：${stageData.subtitle}`, '#d4af37', true);
      return;
    }
    DialogueModal.play(stageData.lines, {
      onComplete: () => {
        _applyStageReward(stageData);
        // popupBig 提示
        if (typeof Stage !== 'undefined' && Stage.popupBig) {
          Stage.popupBig({
            icon: '⚒', title: stageData.title, subtitle: stageData.subtitle,
            color: 'gold', duration: 2000, shake: false, sound: 'levelup',
          });
        }
        _log(`✦ ${stageData.title}：${stageData.subtitle}`, '#d4af37', true);
        // 葛拉好感 +3（教學累積、不只獎勵屬性）
        if (typeof teammates !== 'undefined') teammates.modAffection('blacksmithGra', 3);
      },
    });
  }

  function _applyStageReward(stageData) {
    const r = stageData.reward;
    if (!r || !r.attr) return;
    if (r.type === 'exp') {
      Stats.modExp(r.attr, r.delta);
    } else if (r.type === 'attr') {
      // 直接加屬性（永久）— Stats.modAttr 會處理 round + cap
      if (typeof Stats.modAttr === 'function') {
        Stats.modAttr(r.attr, r.delta);
      } else {
        Stats.player[r.attr] = (Stats.player[r.attr] || 10) + r.delta;
      }
    }
    // refresh UI
    if (typeof Stats.renderAll === 'function') Stats.renderAll();
    if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
  }

  /** 每天結束時呼叫、清除 today flag（讓明天可以再累一次）*/
  function clearTeachingDailyFlag() {
    Flags.set('gra_teach_today', false);
  }

  function serialize()      { return {}; }
  function restore(_data)   { }
  function reset()          { }

  return {
    tryFirstArmor,                  // 階段 2
    tryFirstRepair,                 // 階段 3
    markWeaponNeedsRepair,          // 戰鬥後 hook
    tryWeaponUpgradeT2,             // 階段 4
    tryBlueprintCraft,              // 🆕 階段 5
    tryWeaponUpgradeT3,             // 🆕 階段 6
    tryArmorUpgrade,                // 🆕 階段 7
    tryHeirloomWeapon,              // 🆕 階段 8
    tryMasterSummonsForUnlock,      // 🆕 2026-04-29 鍛造坊解鎖（5 連勝）
    tryTeaching,                    // 🆕 2026-05-06 私人教學 5 階段
    clearTeachingDailyFlag,         // 🆕 2026-05-06 day end hook
    serialize, restore, reset,
  };
})();
