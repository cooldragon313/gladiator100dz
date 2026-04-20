# 訓練所升級系統（Facility Upgrades）

> 讓後期 EXP 需求不再是死牆。全場器材有等級，升級透過 4 次劇情事件取得。
> 設計日期：2026-04-20
> 實作對應：待建 `facility_upgrades.js` + 整合 `stats.js` EXP 曲線 + `main.js` doAction 倍率接入

---

## 為什麼要有這系統

### 問題
- 原 EXP 曲線 `10 × 1.15^(level-10)` → 50 級需 2679 EXP/級，100 級需 350 萬 EXP/級
- 100 天內**不可能練到破百**，連 60 都困難
- 玩家後期等於被指數牆強制停滯

### 解法
1. **曲線改溫和**：`10 + (level-10)^1.6`（100 級單級只需 ~1500 EXP）
2. **拔 ×15 cap**：讓完整協力堆疊能真正發揮
3. **訓練所升級**：全場 EXP 效率 ×1.0 → ×2.0，分 5 層
4. 三者合一，破百成為終局專精玩家的目標

→ 詳見本文 § 2「數字驗證」。

---

## § 1 系統架構

### 資料結構

```js
player.facilityTier = {
  STR: 1,   // 舉石/沙袋
  DEX: 1,   // 木人
  CON: 1,   // 跑道/負重
  AGI: 1,   // 跳繩/敏捷
  WIL: 1,   // 冥想石
}
```

- **每個屬性單獨有一個等級**（1~5）
- **全場升級** = 每項都 +2
- **單屬升級** = 指定一項 +2
- 每次升級只累加，不降級
- 無上限限制 tier 同時併存（某屬可 T5、另一屬仍 T1）

### EXP 倍率

```js
equipmentMult[attr] = 1 + (facilityTier[attr] - 1) × 0.25
```

| Tier | Mult |
|---|---|
| T1 | ×1.0 |
| T2 | ×1.25 |
| T3 | ×1.5 |
| T4 | ×1.75 |
| T5 | ×2.0 |

### 串接進 doAction EXP 計算鏈

**現有公式**（`main.js:2742` 附近）：
```
synergyMult = equipmentMult × itemMult × facilityMult × storyNpc × bgNpc × crowdMult
final = baseExp × synergyMult × thresholdMult × moodMult
```

`equipmentMult` 欄位**現在預留為 1.0**（`_getTrainingEquipmentMult` 還沒實作），接這個系統時：

1. 讀 `trainedAttr`（訓練動作目標屬性）
2. `equipmentMult = 1 + (player.facilityTier[trainedAttr] - 1) × 0.25`
3. 其餘不變

---

## § 2 數字驗證

### 滿協力 + 各 Tier EXP 對照

前提：2 故事 NPC aff≥90 同屬 + 4 背景熟悉同屬 + 滿體力 + 滿心情 + 無心流。
(synergyMult 除 equipmentMult 外 = 13.69；mood ×1.25)

| Tier | equipmentMult | 單次 EXP（base 8）| 心流中（×1.5）|
|---|---|---|---|
| T1 | 1.0 | 137 | 205 |
| T2 | 1.25 | 171 | 257 |
| T3 | 1.5 | 205 | 308 |
| T4 | 1.75 | 240 | 359 |
| T5 | 2.0 | **274** | **411** |

### 新 EXP 曲線對照

`expToNext(level) = ceil(10 + (level-10)^1.6)`

| 等級 → 下一級 | 單級 EXP | T1 需幾次 | T5 需幾次 |
|---|---|---|---|
| 20→21 | 50 | 0.4 | 0.2 |
| 30→31 | 131 | 1.0 | 0.5 |
| 50→51 | 392 | 2.9 | 1.4 |
| 70→71 | 795 | 5.8 | 2.9 |
| 90→91 | 1,256 | 9.2 | 4.6 |
| 100→101 | 1,486 | 10.9 | **5.4** |

→ 滿協力 + T5，**100 級每級 5-6 次訓練**，極限專精破百可行。

### 100 天體感模擬

| 階段 | Tier | 協力 | 單次 EXP | 每天次數 | 等級進度 |
|---|---|---|---|---|---|
| Day 1-20 | T1 | 0-1 人熟 | 10-40 | 2-3 | 15→25 |
| Day 20-45 | 長官升 T3 | 1-2 人熟 | 60-120 | 2 | 25→40 |
| Day 45-65 | 師父升 T5（單屬）| 3-4 人熟 | 150-250 | 2 | 40→55 |
| Day 65-85 | 競技場全場 T4 | 4+ 人熟 | 200-300 | 2 | 55→75 |
| Day 85-100 | 主人 T5 全場 | 滿協力 | 274+ | 2 | 75→90+ |

→ **專精極限 90-100**，**平衡 70 左右**，**多點開花 50-60**。

---

## § 3 升級事件（4 次劇情節點）

### 總覽

| 時序 | 事件 ID | 觸發 | 效果 | 主講 NPC |
|---|---|---|---|---|
| #1 Day ~20 | `facility_officer_advocates` | 累積條件達標 | 全場 T1→T3 | 塔倫長官 |
| #2 Day ~45 | `facility_master_advocates` | 師父觀察主屬 | 單屬 +2 | 師父（masterArtus 或 cassius） |
| #3 Day ~65 | `facility_arena_recognition` | 競技場 10 勝 OR 名聲 30 | 全場 T3→T4 | 主人侍從宣告 |
| #4 Day ~85 | `facility_master_blessing` | 主人好感 60 + 血戰宴會通過 | 全場 T4→T5 | 主人親臨 |

### 細節

#### #1 塔倫長官請命（首次全場升級）

**觸發條件**：
- Day ≥ 15
- 長官好感 ≥ 30
- 玩家累積訓練次數 ≥ 30（總次數，不分屬性）
- 玩家屬性至少有 1 項 ≥ 15

**敘事**（輕量 Stage.playEvent 或 DialogueModal）：

> 長官在訓練場邊叉著手看了你很久。
>
> **塔倫長官**：「你練得不錯。這些破爛器材配不上你的手。」
> **塔倫長官**：「我去跟主人說一聲——該換了。」
>
> 隔天，庫房多出新的木人、沙袋、跑道石塊。沒人道謝，沒人解釋。但你能感覺出——差別。

**效果**：
- 所有 `facilityTier.*` +2
- `Flags.set('facility_upgraded_1', true)`
- 長官好感 +5（他幫你挺身而出）

#### #2 師父請命（單屬深度升級）

**觸發條件**：
- Day ≥ 35
- 已觸發 #1
- 師父好感 ≥ 50
- 玩家單一屬性 ≥ 25（該屬性將被選為升級目標）
- 玩家讀過至少 1 本技能書 OR 見識 ≥ 15

**敘事**：

> 師父在訓練後叫住你，沒說話，只用眼神。
>
> **師父**：「你撞到牆了。我看得出來。」
> **師父**：「主人那邊我去談——他欠我兩年的話。」
>
> 隔日，專屬的高階器材入場（對應你主屬）。這一次是**為你一個人準備的**。

**效果**：
- `player.facilityTier[主屬] += 2`（自動選當前最高的屬性）
- `Flags.set('facility_upgraded_2', true)` + `facility_upgraded_attr`（記錄是哪屬）
- 師父好感 +5

#### #3 競技場榮譽（全場中期升級）

**觸發條件**（二選一）：
- 競技場勝場 ≥ 10 **OR**
- 名聲 ≥ 30

**敘事**：

> 主人的侍從捧著一卷絹帛來訓練場。他清了清嗓子：
>
> **侍從**：「主人有令——」
> **侍從**：「庭園那幾件舊器械撤了，換新的來。這裡要有配得上你名聲的樣子。」
>
> 工匠搬運了整整一天。葛拉從角落看著，什麼都沒說，但你看見他點了一下頭。

**效果**：
- 所有 `facilityTier.*` +1（若已 T4 就不動，避免超 T5）
- `Flags.set('facility_upgraded_3', true)`
- 名聲 +5

#### #4 主人恩賜（終極全場升級）

**觸發條件**（同時滿足）：
- 主人好感 ≥ 60
- Flag `blood_feast_passed`（血戰宴會通過）
- Day ≥ 75

**敘事（重量級 DialogueModal + Stage.playEvent）**：

> 主人親自來到訓練場。這是**破天荒的第一次**。他慢慢走過每一個器械、每一面牆。
>
> **主人**：「這地方……我當初買下它的時候，是一座廢墟。」
> **主人**：「現在它配得上『訓練場』這三個字了——」
> **主人**（看著你）：「而你，配得上這座訓練場。」
>
> 他離開後，當天下午所有器材全部翻新。葛拉在角落打鐵打了一整夜，沒停。

**效果**：
- 所有 `facilityTier.*` 設為 5（直接封頂，不是 +1）
- `Flags.set('facility_upgraded_final', true)`
- 主人好感 +5
- 玩家獲得稱號/成就：「主人親點」（story item 或 flag）

---

## § 4 與其他系統的互動

### 4.1 新 EXP 曲線（必須同步改）

```js
// stats.js: expToNext()
function expToNext(level) {
  if (level < 10) level = 10;
  return Math.ceil(10 + Math.pow(level - 10, 1.6));
}
```

**對照表**：
- lvl 10: 10
- lvl 20: 50
- lvl 30: 131
- lvl 50: 392
- lvl 75: 874
- lvl 100: 1,486

### 4.2 ×15 Cap 拔除

**位置**：`main.js` 約 `synergyMult = ...` 之後的 clamp 行。
**改動**：整段刪除或註解。
**理由**：新曲線 + T5 需要滿協力乘到 ×30 以上才感覺得到升級差，cap 會吞掉一半效益。

### 4.3 協力體力消耗下調

**現有係數**：aff 30/60/90 = +0.3/+0.5/+0.7；背景熟悉 = +0.2
**新係數**：aff 30/60/90 = **+0.2/+0.3/+0.5**；背景熟悉 = **+0.15**

**效果**：
- 舊：滿協力 × 3.2 → 體力消耗 20 × 3.2 = 64 → 滿體力只能 1 次/天
- 新：滿協力 × 2.3 → 體力消耗 20 × 2.3 = 46 → 滿體力 2 次/天，吃飯後可第 3 次

**位置**：`main.js:2755-2770`（staminaSynergyAdd 累加區塊）

### 4.4 NPC 好感系統（無改動，純讀取）

- 長官好感 30+ 為 #1 門檻（沿用現有 teammates.getAffection）
- 師父 50+ 為 #2 門檻
- 主人 60+ 為 #4 門檻

### 4.5 競技場勝場 / 名聲系統

- `player.arenaWins` 欄位**待查是否已存在**；若無，需加
- `player.fame` 已存在，只需讀取

### 4.6 書本/讀書系統

- #2 師父請命門檻含「見識 ≥ 15」或「讀過 1 本技能書」
- 讀 `player.discernment` + `player.readBooks`

### 4.7 內心獨白「瓶頸暗示」

**先前已加的 hint**（[tutorial_hints.js](tutorial_hints.js)）：
- `first_stamina_grow`：首次 CON 升級時獨白
- **建議新增**：`training_plateau`：玩家該屬連練 10 次但沒升級 → 「好像撞到什麼了」

---

## § 5 UI 呈現

### 角色頁新區塊：「訓練器材」

位置：派生數值下方 or 關係圖 tab 新增子頁。

**不顯示具體 tier 數字**（遵循 numbers-hiding 哲學）。

改顯示文字描述：
| Tier | 描述 |
|---|---|
| T1 | 「器材破舊，但還能用」 |
| T2 | 「——最近修繕過」 |
| T3 | 「新添了一些合用的器具」 |
| T4 | 「整座訓練場變得光鮮」 |
| T5 | 「一切都是為你準備的」 |

**用顏色深淺代替數字**（遵循已有 moral spectrum UI 精神）。

### 升級當下演出

- #1/#2/#3：`Stage.playEvent` 小過場（title + 4 行）
- #4：`DialogueModal` 重量級 + `Stage.playEvent` 過場 + log flash

---

## § 6 資料結構遷移

### Save Schema

**新欄位**（schema v7 → v8）：
```js
player.facilityTier = {
  STR: 1, DEX: 1, CON: 1, AGI: 1, WIL: 1
}
```

### 遷移邏輯

`save_system.js` loadFromSlot 時：
```js
if (!loaded.facilityTier) {
  loaded.facilityTier = { STR:1, DEX:1, CON:1, AGI:1, WIL:1 };
}
```

---

## § 7 實作順序（建議）

1. ⚙️ **核心改動**（~1 小時）
   - stats.js expToNext 新公式
   - main.js 拔 cap
   - main.js 協力體力係數下調
   - player.facilityTier 初始化 + save 遷移
   - main.js equipmentMult 接入 tier 值

2. 📖 **獨立模組 `facility_upgrades.js`**（~1 小時）
   - `FacilityUpgrades.tryTrigger(day)` → 每日呼叫
   - 四個觸發條件檢查
   - 事件敘事播放 + 效果套用

3. 🎨 **UI 呈現**（~30 分）
   - 角色頁新增「訓練器材」區塊
   - 文字描述按 tier 切換

4. 🧪 **驗收清單**
   - [ ] 新遊戲 facilityTier 初始化為 5 個 1
   - [ ] 舊存檔載入 auto-migrate
   - [ ] #1 觸發後所有 tier +2 = 3
   - [ ] #2 觸發後最高屬再 +2（若已 T3 就變 T5）
   - [ ] #3 觸發後除 T5 外全部 +1
   - [ ] #4 觸發後全部 = 5
   - [ ] 訓練 EXP 實際反映倍率（debug console 確認）
   - [ ] 體力消耗按新係數計算

---

## § 8 設計決策（已定）

1. **#2 單屬升級挑選邏輯**：✅ **自動選當前最高屬**
   - 鎖定「師父欣賞你最用心的那一項」的敘事邏輯
   - log 提示：「師父看你練 ${主屬} 練得最勤，親自去跟主人說——」
   - 若多屬並列，取排序第一（STR > DEX > CON > AGI > WIL）

2. **#4 血戰宴會未通過 → 鎖死 T5**：✅ **不給替代路徑**
   - 血戰宴會是 Day 49 主人認可的必經驗證
   - 逃避 / 失敗 / 拒絕 → 永遠停在 T4，合理懲罰
   - 與 `docs/quests/blood-feast.md` 連動：**血戰驗證本身也要有足夠難度**，不能讓玩家隨便過關。T5 的份量要配得上血戰的考驗。

3. **#3 競技場勝場 vs 名聲 30 二擇一**：✅ 保留
   - 給予玩家策略選擇（專精戰鬥 or 累積社交）

4. **跨訓練所換人**（未來 Phase 2 擴充）：✅
   - 每訓練所獨立 `facilityTier`（換場所歸零）
   - 主人好感可帶過去

---

## § 9 未寫的後續擴充（備忘）

- **鐵匠葛拉線**：獨立於訓練所升級，主導**武器**路線。單獨設計書另開。
- **黑市器材**：花錢偷偷升級某屬，但有風險（主人發現 -好感）。
- **訓練所專屬事件**：T5 後解鎖「月光下的訓練場」等氛圍事件（無機制加成，純敘事）。
- **背景角鬥士影響**：長期同練的背景角鬥士也會因訓練所升級而變強（NPC growth 系統連動）。

---

## 連動 Checklist（實作時對照）

- [ ] stats.js expToNext
- [ ] main.js synergyMult cap 拔除
- [ ] main.js equipmentMult 接入 facilityTier
- [ ] main.js 體力協力係數
- [ ] save_system.js schema 遷移
- [ ] facility_upgrades.js 新模組
- [ ] game.html 載入 facility_upgrades.js
- [ ] main.js onDayStart 接 FacilityUpgrades.tryTrigger
- [ ] 角色頁 UI 新區塊
- [ ] CODEX.md 字典新增 facilityTier + 4 事件 flag
- [ ] changelog.html 版本區塊
