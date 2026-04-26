# 主動技能規劃 — 下階段 (2026-04-25)

> 本文件記錄主動技能的設計決策、武器分類、戰鬥引擎整合需求。
> 在 2026-04-25c 完成 7 被動 + 2 劇情戰鬥 hook 後撰寫。
> **下次 session 直接從此文件開始實作主動技能。**

---

## 🎯 設計原則

1. **主動技能必須與武器搭配** — 不是所有武器都能用所有招
2. **EXP 成本依「主屬性 + 副屬性」拆解** — 跟被動同邏輯
3. **每個主動都吃 stamina + cooldown** — 不能無限放
4. **資料已在 `src/content/skill.js` 末段定義** — 不需重做、直接整合戰鬥即可

---

## ⚔ 武器分類系統（**先做這個**）

新增武器欄位 `weaponClass`：

| Class | 武器 |
|---|---|
| `'sword'`  | dagger / shortSword / longSword / shortSword_t2 / longSword_t2 等 |
| `'blunt'`  | hammer / warHammer / hammer_t2 / warHammer_t2 |
| `'axe'`    | heavyAxe / heavyAxe_t2 |
| `'spear'`  | spear / spear_t2 |
| `'dagger'` | dagger（短刃單列、跟 sword 不同處理）|
| `'fist'`   | fists |

**實作位置**：[`src/content/weapons.js`](src/content/weapons.js) — 每個武器加 `weaponClass: 'xxx'` 欄位。

**檢查方法**：

```js
function _hasWeaponClass(classList) {
  if (!Array.isArray(classList)) return true;   // 沒 require 就 OK
  const wId = Stats.player.equippedWeapon;
  const w = (typeof Weapons !== 'undefined') ? Weapons[wId] : null;
  return w && classList.includes(w.weaponClass);
}
```

---

## 📋 4 個主動技能（資料已定義）

### 1. 強力斬 (powerStrike)
- **效果**：蓄力 1 回合、下回合 ATK×2.0 + 無視 15 DEF
- **武器**：sword / blunt / axe（銳器/重器才能蓄力一擊）
- **成本**：STR 300 + AGI 100 + DEX 50 = 450 / req STR 30 + fame 200
- **戰鬥 hook**：
  - `_playerTurn` action='special' 分支：if 已習得 + 武器符合 → 進入蓄力狀態
  - 下回合 `_playerTurn`：if 蓄力中 → 用 dmgMult: 2.0 + penBonus: 15 算傷
  - 蓄力期間用既有 `_playerDelay = 1` 機制（瞬刺已有類似邏輯）

### 2. 嘲諷 (taunt)
- **效果**：強制目標 3 回合追打你 + 自身 DEF+10 BLK+5
- **武器**：blunt / axe / spear（不適合匕首）
- **成本**：CON 250 + WIL 150 + STR 50 = 450 / req CON 30 + WIL 22
- **戰鬥 hook**：
  - 新增 `_player._tauntActive`（剩餘回合）+ `_enemy._taunted = true`
  - `_enemyTurn` 中：if `_taunted` → 強制 attack action（跳過 special）
  - `_endTurnCleanup_atb`：tauntActive--、清掉 `_enemy._taunted`
  - `_player.derived.DEF / BLK` 暫時加成（如不屈 ATK 模式）

### 3. 反擊主動 (riposte)
- **效果**：預備姿態（1 回合）、被攻擊時格擋並立刻反擊 ATK×1.5
- **武器**：sword / spear / dagger
- **成本**：DEX 250 + AGI 100 + STR 100 = 450 / req DEX 30 + AGI 22
- **戰鬥 hook**：
  - `_player._riposteStance = true`
  - `_enemyTurn` 攻擊時：if 預備姿態 → 強制格擋（hit=false, blocked=true）+ 反擊 ATK×1.5
  - 一次性、用完即清

### 4. 戰吼 (warCry)
- **效果**：自身 ATK +20%，持續 3 回合（不需武器）
- **成本**：WIL 250 + STR 100 = 350 / req WIL 30
- **戰鬥 hook**：
  - `_player._warCryTurns = 3`（與不屈 buff 同模式）
  - `_playerTurn` ATK 暫時加成
  - `_endTurnCleanup_atb` 倒數

---

## 🎮 UI 整合

### 角色頁技能卡片
- 主動技能也在 `_renderSkillsTab` 顯示
- 卡片右上加「⚔ 主動」標籤（區別被動）
- 顯示 stamina cost + cooldown + 武器需求
- 學完後出現在戰鬥畫面的技能列

### 戰鬥畫面
- 既有 `bt-btn-special` 是怒氣槽特技按鈕
- **新增**：技能列（已習得的主動）橫排在攻擊鈕下方
- 每個技能按鈕顯示：圖示 / 名稱 / 體力消耗 / cooldown 倒數
- 武器不符的技能顯示灰色 + tooltip「需要 ${武器類別}」

---

## 🔧 整合工作量估計

| 項目 | 工作量 | 備註 |
|---|---|---|
| 武器加 weaponClass 欄位 | 小 | 改 weapons.js 各條目、約 20 條 |
| `_hasWeaponClass` 檢查函式 | 小 | 加在 stats.js 或 battle.js |
| 強力斬戰鬥 hook | 中 | 蓄力機制可參考既有瞬刺（half_focus） |
| 嘲諷戰鬥 hook | 中 | 需要敵人 AI 強制 target、新加 status effect |
| 反擊主動 hook | 中 | 預備姿態 + 自動格擋反擊 |
| 戰吼 hook | 小 | 跟不屈 buff 同模式 |
| 角色頁主動卡片 | 小 | _renderSkillsTab 解開 'active' 過濾 |
| 戰鬥畫面技能列 | 中 | 新 UI element + 點擊邏輯 |
| 連動已習得測試 | 小 | 測四個主動 + 武器搭配 |

預估：**1 session 可做完**（不含完整測試）。

---

## 🚧 預期會踩的坑

1. **蓄力中被打中** — 強力斬蓄力中被攻擊應該打斷（瞬刺有先例 `_playerDelay = 0`）
2. **嘲諷對 boss 無效？** — 是否該讓某些 boss 免疫嘲諷？建議：**不免疫**，但 boss 觸發 special 時可中斷（boss flavor）
3. **反擊主動 vs 反擊被動** — 兩個都叫「反擊」會混淆。被動是 35% 機率隨機觸發、主動是 100% 主動進入姿態。**命名**：被動仍叫 `counter`、主動叫 `riposte`（已分開了）
4. **武器需求 vs 玩家手中沒武器** — fists 是 weaponClass 'fist'、不能用任何主動。給玩家明確錯誤訊息
5. **stamina 不夠** — 同樣要明確錯誤訊息

---

## 📌 已完成的 7 被動 + 2 劇情技能（2026-04-25c）

備忘：本次 session 完成的範圍，下次別重做。

### T1 被動（req attr 20、cost ~150 EXP）
- **巨力** (bigStrike) ATK+6 ACC+3 / STR 100 + DEX 50
- **精準** (precision) ACC+8 CRT+4 / DEX 100 + LUK 50
- **鐵皮** (ironSkin, 改名後) HP_max+25 DEF+3 / CON 150
- **疾風** (quickStep, 改名後) EVA+6 SPD+4 / AGI 150
- **靜心** (calmMind) 戰外 mood 衰減 ×0.7 + Fervor 擺爛機率 ×0.5 / WIL 150

### T2 被動（req attr 30、cost ~450 EXP）
- **連擊** (combo) SPD+5 ATK+3 / DEX 220 + AGI 150 + STR 80
- **反擊** (counter) 閃避成功 35% 機率反擊 ATK×0.8 / AGI 250 + DEX 100 + STR 100
- **戰鬥意志** (battleWill) HP<50% 時 +12 ATK +5 DEF / WIL 250 + STR 100 + CON 100

### 劇情（不能 EXP 買、由巴爺主線給）
- **不屈** (unyielding) 致命一擊鎖 1 HP + 5 回合 ATK +30%
- **老兵之眼** (veteran_eye) 戰鬥開場 ATK +15% CRT +5

### 戰鬥 hook 實作位置
- 戰鬥開始 `_applyStorySkills()`：veteran_eye + 重置不屈旗標
- `_applyDamage`：不屈鎖血、戰鬥意志觸發
- `_playerTurn`：不屈 ATK +30% 暫時加成
- `_endTurnCleanup_atb`：不屈 buff 倒數
- `_enemyTurn` attack case：反擊（counter）35% 機率
- `Stats.modVital` mood 路徑：靜心 ×0.7
- `Fervor.getSlackChance`：靜心 ×0.5

### 主屬性涵蓋對照
| 屬性 | T1 | T2 |
|---|---|---|
| STR | 巨力 | （搭配連擊副屬） |
| DEX | 精準 | 連擊 |
| CON | 鐵皮 | （搭配戰鬥意志副屬） |
| AGI | 疾風 | 反擊 |
| WIL | 靜心 | 戰鬥意志 |
| LUK | （搭配精準副屬）| — |
