# 傷勢系統（Wounds）

> 四部位 × 三級嚴重度的結構化傷勢系統。獨立於病痛（ailments）。
> 設計日期：2026-04-19
> 實作對應：`wounds.js` + 整合 `stats.js` `eff()` + `main.js` doAction + `doctor_events.js` 三階段暗示

---

## 核心設計

### 資料結構

```js
player.wounds = {
  head:  null,  // 或 { severity:1-3, source, daysElapsed, cameFromCombat }
  torso: null,
  arms:  null,
  legs:  null,
}
```

每個部位**最多一個**傷勢。每個傷勢有嚴重度（1-3）+ 來源（capture / combat / low_stamina_training / slavemaster）+ 已過天數。

### 部位 → 屬性映射

| 部位 | 主要屬性受影響 | 次要影響 |
|---|---|---|
| **head** | WIL | 晨思觸發率、暴擊抵抗（預留）|
| **torso** | CON | HP 上限、耐力恢復（預留）|
| **arms** | STR | 武器裝備限制（預留：雙手武器）|
| **legs** | AGI | 行動速度、潛行（預留）|

### 嚴重度 → 懲罰

| 級別 | 屬性減免 | 訓練 EXP 倍率 | 恢復時間 |
|---|---|---|---|
| **輕傷（1）** | −2 | ×0.90 | **3-5 天自癒** |
| **中傷（2）** | −4 | ×0.80 | 不治療 15 天 / **治療後 5-8 天** |
| **重傷（3）** | −6 | ×0.70 | **永久**（除非密醫 or 自然癒合）|

---

## 觸發來源

### 1. 開場被抓受傷（character generation）

- **總命中率 15%**
- 命中後擲嚴重度：輕 60% / 中 30% / 重 10%
- 部位依 origin 加權（農家軀幹多、乞丐腿多、信徒頭多等）
- 受傷時：強烈震動 + 紅光閃爍 + 回憶對白（origin × 部位矩陣）

### 2. 低體力訓練

訓練前依 stamina 分層擲新傷勢：

| Stamina | 輕傷機率 | 中傷機率 | 重傷機率 |
|---|---|---|---|
| > 50 | 0% | 0% | 0% |
| 30-50 | 5% | 0% | 0% |
| 15-30 | 15% | 3% | 0% |
| 5-15 | 30% | 10% | 2% |
| < 5 | 0% | 50% | 15% |

觸發後：震動 + 紅光 + 「你硬撐著揮出一劍 — 你把自己練傷了」對白。

### 3. 有傷時訓練對應部位 — 「好痛」觸發

玩家帶傷仍訓練對應屬性時：

| 現有嚴重度 | 好痛觸發率 | 效果 |
|---|---|---|
| 輕傷 | **30%** | 訓練失敗（失時間失體力，不得 EXP）/ HP -3 / 震動 |
| 中傷 | **60%** | 訓練失敗 / HP -8 / 震動 / **10% 機率升為重傷** |
| 重傷 | **90%** | 幾乎必失敗 / HP -15 / 震動 |

未觸發好痛時：訓練 EXP 倍率依上表扣減（×0.9 / ×0.8 / ×0.7）。

### 4. 戰鬥部位受傷（Phase C 實作）

戰鬥暴擊 + 武器 `hitParts` → 部位傷。保留未實作。

---

## 訓練 × 部位對應表

| 訓練類型 | 目標屬性 | 高風險部位 |
|---|---|---|
| 重武器揮擊 / 力量訓練 | STR | arms + torso |
| 敏捷訓練 / 步法 | AGI | legs |
| 匕首精準 / 準度訓練 | DEX | arms |
| 耐力訓練 / 負重 | CON | torso + legs |
| 冥想 / 讀書 | WIL | head |
| 幸運 / 觀察類 | LUK | 無 |

---

## 恢復路徑

### 路徑 A：自癒（主流）

- **輕傷 4 天** 自動痊癒（無條件）
- **中傷** 經老默治療後 7 天自癒（未治療要等 15 天）

### 路徑 B：老默治療

老默 visit 時玩家可選治哪個 ailment / wound。治療後設 `wound_treated_{part}` flag → 自癒加速。

### 路徑 C：自然癒合重傷（意志力路線）

條件：
- WIL ≥ 20
- 老默好感 ≥ 80
- 該重傷已過 30 天

觸發事件：老默對白「你的意志力連神都讓三分」→ 重傷降為中傷 + 獲得「鐵意志」或「不屈之身」特性。

### 路徑 D：黑市密醫（Phase B 實作）

三階段引薦（見下節）→ 拿到紙條 → 夜間接頭 → 改造選擇（四選一）。

---

## 老默三階段暗示（引向密醫）

### Stage 1：首次診到重傷
```
老默：「這傷我只能幫你止血。」
老默：「深處的問題 — 骨頭錯位、神經壞了 — 我治不了。」
```
設 flag：`doctor_saw_severe_wound`

### Stage 2：觀察期暗示（重傷過 10 天 + 玩家仍訓練）
```
老默：「你還在練。忍著痛也練。」
老默：「我看得出來。你不是放棄的人。」
老默：「等你準備好 — 我有個朋友。住在城南巷子裡。」
```
設 flag：`doctor_hinted_black_doc` + `days_since_black_doc_hint=0`

### Stage 3：密醫引薦（Stage 2 後 5 天）
```
老默：「他不是醫生。他做的事，神看了會皺眉。」
老默：「但他能讓你重新跑、重新揮劍。」
老默：「代價是 — 你不會再是原本的你。」
```
設 flag：`got_black_doc_contact`
玩家個人物品獲得：`black_doc_contact`（密醫紙條）

---

## 黑市密醫改造（Phase B 未實作）

四選一奇觀改造（對應四部位重傷）：

| 改造 | 強力加成 | 代價（社交 + 事件）|
|---|---|---|
| **鐵臂** | STR +5 / ATK +10 / 破甲 +8 | 老默拒絕治療 / 梅拉眼紅 / 月度關節痛事件 |
| **獸腿** | AGI +6 / SPD +12 / 首回合額外攻擊 | 食量 ×1.5 / 奧蘭疏遠 / 潛行失敗率 ×2 |
| **空腦** | 不會 panic / 絕望 / 痛覺切斷 | 完全失去晨思 / mood 固定 50 / 好感成長 ×0.5 |
| **金心** | HP+40 / CON+3 / 疾病抗性 +80% | 每日心情 -2 / 無法感動 / 失去神眷之子 |

---

## 傷勢特化結局（Phase B 未實作）

| 結局 ID | 觸發條件 |
|---|---|
| `unbroken_cripple` | 帶 2+ 重傷活過 Day 100 + 沒改造 |
| `iron_puppet` | 改造 3+ 部位活過 Day 100 |
| `hybrid_walker` | 改造 1 部位 + 自然癒合 1 部位 |

---

## 整合點

### Stats.eff(attr)
```js
return Math.round(
  base + eqBonus + buffBonus
  - staminaPenalty
  - Wounds.getAttrPenalty(attr)  // 🆕
);
```

### doAction（訓練流程）
```js
if (isTraining) {
  // 前置檢查（fatigue_force / mood_despair）...

  // 🆕 好痛觸發檢查
  const pain = Wounds.checkTrainingPain(trainedAttr);
  if (pain.painTriggered) {
    // 扣時間體力但不得 EXP
    return;
  }

  // 🆕 低體力擲新傷
  Wounds.rollLowStaminaInjury(trainedAttr);

  // 原有閾值修正（mood / flow / slacker / hunger）...

  // 🆕 傷勢 EXP 扣減
  thresholdMult *= (1 - Wounds.getTrainExpMultDec(trainedAttr));

  // 🆕 見識 EXP 加成
  thresholdMult *= Stats.getDiscernmentExpMult();
}
```

### DayCycle.onDayStart('woundsDailyTick')
```js
Wounds.onDayStart();  // 推進 daysElapsed + 自癒檢查 + 自然癒合檢查
if (Flags.has('doctor_hinted_black_doc')) {
  Flags.increment('days_since_black_doc_hint', 1);
}
```

### DoctorEvents.tryVisit
```js
// 🆕 2026-04-19：ailments 或 wounds 都可觸發訪視
if (!hasAilment && !hasWound) return false;
// ...
// 訪視時先跑 _tryWoundHintsThenTreat → 三階段判定
```

---

## Flags 命名

| Flag | 意義 |
|---|---|
| `doctor_saw_severe_wound` | 老默已提醒重傷（Stage 1）|
| `doctor_hinted_black_doc` | Stage 2 暗示觸發 |
| `days_since_black_doc_hint` | Stage 2 後天數（用於 Stage 3 倒數）|
| `got_black_doc_contact` | 拿到密醫紙條（Stage 3 完成）|
| `wound_treated_{part}` | 該部位已受老默治療 → 加速自癒 |
| `natural_recovery_triggered_{part}` | 自然癒合已觸發（一次性）|

---

## 平衡考量

### 為什麼開場 15%，不是 10%

- 15% 有感但非主流（85% 玩家正常開局）
- 輕 60% / 中 30% / 重 10% 的嚴重度分佈確保「重傷開局極稀有」（1.5%）
- 給想挑戰「殘疾開局」的玩家提供機會

### 為什麼恢復速度這麼快

100 天遊戲若受傷 3-4 次：
- 4 次 × 平均 6 天 = 最多 24 天在養傷
- 其他 76 天健康訓練
- 養傷時間佔 24% 剛好，不破壞遊戲節奏

### 四路徑的玩家分流

| 玩家類型 | 對應路徑 |
|---|---|
| 戰力控 | 黑市改造（鐵臂 / 獸腿）|
| 劇情控 | 自然癒合（保留人性）|
| 挑戰流 | 殘疾硬玩（unbroken_cripple 結局）|
| 極端流 | 多部位改造（iron_puppet 結局）|

四類玩家都有路，沒人「被迫」選改造。

---

## 相關檔案

- `wounds.js` — 模組主體
- `stats.js` — eff() 整合傷勢減免
- `birth_traits.js` — applyCaptureInjury 擲開場傷
- `character_roll.js` — 起床受傷演出
- `main.js` — doAction 好痛觸發 + DayCycle hook
- `doctor_events.js` — 三階段暗示
- `game.html` — 角色頁傷勢區塊 + CSS 震動紅閃動畫
