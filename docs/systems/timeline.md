# 百日條動態揭露系統

> 百日條不再是靜態的「遊戲一開始什麼都看得到」，改為 **NPC 對話逐步揭露**。
> 討論日期：2026-04-18
> 最後更新：2026-04-18
> 對應程式：`events.js:TIMELINE_EVENTS` + `main.js:renderDayBar`（待重寫）

---

## 哲學

玩家的知識應該**跟遊戲內玩家角色一致**。
百日條上顯示的事件 = 角色知道的事件。

**玩家不該開遊戲就知道 Day 75 有「宿敵會戰」**—— 要等 NPC（赫克托 / 卡西烏斯）說出來才能知道。

---

## 五種狀態

| 狀態 | 外觀 | 時機 |
|---|---|---|
| 🕳 **未揭露** | 百日條上**不顯示** | 玩家還沒聽說過 |
| ❓ **神秘標記** | 灰色問號（位置佔了，但沒名字） | 知道「那天有事」但不知內容 |
| 📍 **已揭露** | 完整名字 + 圖示 | NPC 對話揭露後 |
| ⚡ **逼近** | 脈衝發光（≤ 3 天） | 快到日子了 |
| 🔥 **當日** | 戰鬥鈕（現有機制） | 今天發生 |
| ✓ **過去** | 淡出 / 標記完成 | 已完成 |

---

## 四類事件

### 1. 🏛 LANDMARK（地標事件）— **固定**

|事件 | 日子 | 初始狀態 | 揭露時機 |
|---|---|---|---|
| 沙洗（Day 5） | Day 5 | **已揭露**（塔倫 Day 1 講完就可見） | Day 1 長官訓話後直接設 flag |
| 萬骸祭（Day 100） | Day 100 | **已揭露**（遊戲介紹已經講） | 開場介紹後設 flag |

這兩個是玩家一開始就知道的大事。

### 2. 📅 SCHEDULED（排程賽事）— **主線必有**

| 事件 | 日子 | 初始 | 揭露 |
|---|---|---|---|
| 大型競技 | Day 50 | 🕳 未揭露 | Day 40+ 監督官某場對話 |
| 宿敵會戰 | Day 75 | 🕳 未揭露 | Day 60+ 赫克托 / 卡西烏斯提過 |

### 3. 🎲 DYNAMIC（主人賭局）— **動態產生**

**候補日**：Day 35 / 42 / 48 / 55 / 62 / 70 / 80 / 88（共 8 個）
- 每個候補日在 7 天前 roll 30-40% 機率
- 觸發則：侍從送來**預告對話**（見範例）
- 預告對話後該候補日變 📍 **已揭露**狀態

**預告對話範例**：
```
侍從：大人跟莫拉斯老爺打了個賭。
侍從：下週三——就是七天後——你要跟他家的「鐵臂」打一場。
侍從：輸了你們都關禁閉；贏了多 20 銅。
侍從：練熟一點。
```

### 4. ⚡ CONDITIONAL（條件事件）— **不在百日條**

這些事件**不顯示在百日條**，因為不確定會不會發生：
- Day 30 房間升級（master_aff ≥ 50）
- Day 60 偷藥（player_was_nearly_dead）
- Day 85 訣別（強制，但劇情類）
- 夜間任務（抓老鼠等）

這些事件靠 log / DialogueModal 通知。

---

## 資料結構設計

### 舊的 TIMELINE_EVENTS（需改）

```js
{
  day: 5,
  id: 'trial',
  name: '基礎考驗',
  // ... 其他欄位
}
```

### 新的 TIMELINE_EVENTS

```js
{
  day: 5,
  id: 'trial',
  name: '沙洗',                       // 🆕 改名（見 day1-opening.md）
  revealType: 'landmark',              // 🆕 landmark | scheduled | dynamic | conditional
  revealFlag: 'timeline_sand_wash',    // 🆕 讓此事件「已揭露」的 flag
  autoRevealByLandmark: true,          // 🆕 landmark 自動揭露
  // ... 其他欄位不變
}
```

### 新事件：動態賭局候補池

```js
const DYNAMIC_BETS = [
  {
    candidateDay: 35,
    chance: 0.35,
    previewDaysBefore: 7,
    possibleOpponents: ['morras_ironarm', 'bandit_leader'],
    rewardBase: 20,
  },
  // ... 其他候補日
];
```

### 狀態儲存

用 Flags 儲存：
- `timeline_sand_wash_revealed` — 沙洗已揭露
- `timeline_day50_revealed` — 大型競技已揭露
- `timeline_bet_day35_triggered` — Day 35 賭局觸發了
- `timeline_bet_day35_opponent` — 對手是誰（從 possibleOpponents 挑）

---

## 🆕 2026-04-20 逐步揭露系統（Progressive Reveal）

對於**大事件**，百日條支持**分階段揭露**。玩家慢慢從流言拼湊真相。

### 資料結構擴充

```js
{
  day: 49,
  id: 'blood_feast',
  name: '血戰宴會',
  revealType: 'progressive',          // 🆕 逐步揭露
  revealStages: [
    {
      day: 30,
      flag: 'rumor_blood_feast_stage1',
      displayName: '???（宴會？）',
      triggerBy: 'blacksmith_talk',    // 葛拉好感 ≥ 40 時的對話
      rumor: '聽說大人要辦宴會 — 有貴族要來。',
    },
    {
      day: 40,
      flag: 'rumor_blood_feast_stage2',
      displayName: '血腥的宴會',
      triggerBy: 'doctor_or_mela',
      rumor: '好像要派一個戰士上場給貴族看。',
    },
    {
      day: 45,
      flag: 'rumor_blood_feast_stage3',
      displayName: '血戰宴會 — 快步馬爾斯',
      triggerBy: 'orlan_talk',
      rumor: '聽說「快步馬爾斯」要出場 — 20 年前的明星。',
    },
  ],
  finalName: '血戰宴會',                // Day 49 當天固定名稱
}
```

### 百日條顯示邏輯

```
Day 1-29：        ???
Day 30+ stage1： ???（宴會？）
Day 40+ stage2： 🩸 血腥的宴會
Day 45+ stage3： ⚔ 血戰宴會 — 快步馬爾斯
Day 49 觸發：    完整事件
```

### 流言觸發時機

每個 stage 的 `triggerBy` 指向**何時會聽到流言**：
- `blacksmith_talk` — 葛拉好感達標時下次互動
- `doctor_or_mela` — 醫療或用餐時其中一方說
- `orlan_talk` — 晚上奧蘭講悄悄話

流言**必定觸發**（滿條件就給），不靠機率 — 保證玩家能解鎖揭露。

### 未滿條件怎麼辦

若到 Day 40 玩家還沒葛拉好感 40 → 觸發**保底流言**：
- Day 40 某個路人奴隸說「最近大人好像有貴客⋯⋯」
- 至少給 stage1 揭露，避免 Day 49 完全措手不及

### 適用事件（當前）

- **Day 49 血戰宴會**（見 `docs/quests/blood-feast.md`）

### 未來可套用

- 主人兒子 Marcus 下訓練場（某日）
- 主人暗殺計畫事件
- 奧蘭密謀逃脫（若解鎖）
- 新家人儀式某些場合

---

## UI 變化（百日條）

### 現有
```
[====X====★==========⚔=======★================================◆]
 1   5    10           50     75                               100
```
所有事件都看得到，位置固定。

### 新版（Day 1 剛開場）
```
[====🏛================================================🏛]
 1   5                                                 100
```
只有兩個 landmark（Day 5 沙洗 + Day 100 萬骸祭）可見。中間一片空白。

### Day 40 後（監督官揭露 Day 50）
```
[=========================★================================🏛]
 1                        50                               100
```
Day 50 大型競技出現。

### Day 35 賭局觸發（Day 28 左右預告）
```
[=================🎲=============★=========================🏛]
 1                35             50                        100
```
Day 35 出現「🎲 莫拉斯的鐵臂」。

---

## 玩家體驗

### 好的情緒
- **Day 1**: 看到 Day 100 很遠，Day 5 在不遠處，中間一片空白 → **未知的壓迫感**
- **Day 40**: 監督官突然說「下週是大型競技」→ 玩家轉頭看百日條，Day 50 點亮 → **劇情有結果**
- **Day 28**: 侍從來傳話：「七天後你要打鐵臂」→ Day 35 點亮 → **故事在推進**

### 要避免的
- ❌ 一次揭露太多（一口氣 Day 1 就看到所有事件）
- ❌ 揭露後又隱藏（搞混玩家）
- ❌ 對話講了但百日條沒反應（玩家會懷疑是不是出 bug）

---

## 實作規劃

### Step 1：改 TIMELINE_EVENTS 資料結構
- 加 `revealType` / `revealFlag` 欄位
- 現有 4 個事件依類型分（landmark / scheduled）

### Step 2：加 `_isEventRevealed(evt)` 判斷函式
- 檢查 flag / landmark 狀態
- `renderDayBar` 過濾未揭露的

### Step 3：加 `DYNAMIC_BETS` 池
- 候補日 roll 機率
- 觸發時 push 一個 DialogueModal 預告 + 設 flag
- `renderDayBar` 把動態事件也加進去顯示

### Step 4：在既有對話中埋揭露點
- Day 1 塔倫訓話結尾 → 設 `timeline_sand_wash_revealed`
- 遊戲介紹頁 → 設 `timeline_festival_revealed`（Day 100 預揭）
- Day 40 監督官日常 → 設 `timeline_day50_revealed`
- Day 60 赫克托對話 → 設 `timeline_day75_revealed`

### Step 5：新增賭局預告對話事件
- 在 `DayCycle.onDayStart` 檢查 `DYNAMIC_BETS`
- 該日 -7 的時候 roll 機率
- 觸發則 push `_pendingDialogues` 侍從傳話

---

## 未決定

- 百日條上 **已揭露但還沒到** 的事件要不要加 hover 提示？（會破壞「零 hover」規則）
- **賭局失敗的後果** — 扣主人好感多少？
- **賭局對手 KO 了怎辦** — 再挑一個候補對手？

---

## 相關文件

- [battle-density.md](battle-density.md) — 戰鬥總量規劃
- [../enemies/](../enemies/) — 敵人資料
