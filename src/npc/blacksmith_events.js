/**
 * blacksmith_events.js — 鐵匠葛拉事件系統
 * ══════════════════════════════════════════
 * 設計：docs/quests/blacksmith-gra.md
 * 角色：docs/characters/blacksmithGra.md
 *
 * 觸發機制（DayCycle.onDayStart）：
 *   - tryFirstArmor()：好感 ≥ 20 + Day ≥ 12 + arenaLosses ≥ 1 → 三幕進場事件
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
  // 存檔 / 讀檔（目前無狀態需序列化）
  // ══════════════════════════════════════════
  function serialize()      { return {}; }
  function restore(_data)   { }
  function reset()          { }

  return { tryFirstArmor, serialize, restore, reset };
})();
