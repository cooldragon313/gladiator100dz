# NPC 新血池系統 + 觀眾溢位區

> 解決兩個現況問題：
> 1. STR / AGI 訓練無 teammate 協力（屬性缺口）
> 2. 觀眾超過 3 個會「看不到」、被打小報告找不到人
> 設計初稿：2026-04-27
> 對應實作：尚未開始

---

## 🩸 NPC 新血池系統

### 解決的問題
**現況 teammate 協力屬性缺口**（檢查 `npc.js favoredAttr`）：

| favoredAttr | 既有 teammate | 數量 |
|---|---|---|
| STR | **無** | **0** ❌ |
| AGI | **無** | **0** ❌ |
| DEX | hector / dagiSlave | 2 |
| CON | sol(早死) / cassius / ursa | 2-3 |
| WIL | orlan / oldSlave | 2 |

→ 玩家走 STR / AGI build 完全沒 teammate 協力、訓練速度慢。

### 機制設計

#### 觸發
- 每 10 天觸發「新血到」事件（Day 10/20/30/40/50/60/70/80/90）
- 每次：**死亡結算 → 新血加入**

#### 死亡結算
**僅針對非劇情 NPC**（永駐家人不在死亡池）：
| 死亡計算因子 | 影響 |
|---|---|
| 基礎死亡率 | **8%** |
| 期間玩家輸過比賽 | +5% |
| 該 NPC CON 屬性低於 12 | +5% |
| 玩家對該 NPC 好感 ≥ 60 | -10%（玩家無形中保護過他） |

死亡判定為 alive=false、log「✦【XXX】沒回來。沒人提起他去哪。」

**永駐 NPC 死亡保護**：orlan / cassius / hector / ursa / dagiSlave / oldSlave 不在死亡池

#### 新血加入
**人數**：剛死了幾個、就補幾個 + 1（淨人數慢慢成長到飽和 6）

**屬性平衡規則**：
- 自動偵測目前訓練所**最缺**的屬性（按 teammate favoredAttr 統計）
- 新血優先補缺口（STR / AGI 優先）
- 補滿後才隨機選

**新血模板**（純功能性 NPC、無劇情）：
```js
{
  id: 'recruit_001',  // 數字遞增
  name: 'Marcus',     // 從羅馬名 pool 抽
  role: 'teammate',
  baseAffection: 0,
  favoredAttr: 'STR', // 由系統決定
  desc: '從高盧抓回來的戰俘。臉上一道刀疤、不太說話。', // 從背景 pool 抽
  arriveDay: 10,
  alive: true,
  isRecruit: true,    // 🆕 標記為「無名功能 NPC」、UI 用聚合顯示
  // 沒有 likedTraits / dislikedTraits / storyReveals
}
```

**羅馬名字 pool**：
Marcus / Titus / Servius / Quintus / Decimus / Gaius / Aulus / Sextus / Tiberius / Numa / Atticus / Fabius / Hortensius / Cornelius / Petronius

**背景 pool**（一句、無關劇情）：
- 「從高盧抓回來的戰俘。臉上一道刀疤、不太說話。」
- 「失去家產的小貴族。眼神還沒被磨平。」
- 「鄉下打鐵舖兒子。手粗、心也粗。」
- 「鄰村破產的釀酒師。喝起酒比戰鬥兇。」
- 「希臘人。會幾個你聽不懂的字。」
- 「埃及來的。皮膚黑、笑得多。」
- 「色雷斯山賊。被官兵抓到、賣到這裡。」
- 「老兵的兒子。父親死後沒人養。」
- 「逃奴。但他不會講。」
- ⋯⋯（共 10-15 個）

---

### 🎨 UI 改造：teammate 區聚合顯示

#### 現況
目前 6 個 teammate 格、每格顯示一個具體 NPC（名字 + 角色）。

#### 改造（無名 recruit 聚合）
**前 3 格固定給有名字的劇情 NPC**（orlan / cassius / hector / ...）— 跟現況一樣
**後 3 格動態**：
- 如果**有名字 NPC** 還沒滿 6 個 → 繼續占
- 名字 NPC 滿後、**recruit 開始聚合**：
  ```
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │  STR ×2      │ │  AGI ×3      │ │  DEX ×1      │
  │  (Marcus,    │ │              │ │              │
  │   Titus)     │ │              │ │              │
  └──────────────┘ └──────────────┘ └──────────────┘
  ```
- 一個格子 = 一個屬性組
- 顯示：屬性 + 數量（粗體大字） + 該屬性的 recruit 名字（小字、列出）
- 滑鼠 hover → tooltip 顯示完整名單 + 個別狀態

#### 永遠最多 5 個 recruit 在場
- 第 6 個進來時、最弱的（CON 最低）一個自動退役（log「【XXX】被調去別處。沒人問為什麼。」）
- 確保畫面不爆量

#### 點擊聚合格
- 彈出簡短 list：每個 recruit 一行
- 點某個名字 → 顯示該 recruit 的單獨資訊（簡單版人物卡）

---

## 🎭 觀眾溢位區

### 解決的問題
目前 3 觀眾格、超過就看不到、玩家困惑「怎麼某 NPC 影響我但我沒看到他」。

### 改造：主格 + 溢位區

#### 主觀眾區（3 大格）— 優先序固定
```
1. masterArtus（主人）  ← 永遠占最高優先
2. officer（塔倫長官）
3. overseer（巴爺監督官）
```
這 3 個任一在場 → 一定占主格之一。

優先序處理：
- 如果只有 1 個權威 NPC 在場 → 占第一格、其他兩格給隨機觀眾
- 如果 3 個權威都在 → 全占主格、其他擠溢位

#### 溢位區（右側 5 小格）
- 用 teammate-slot 同樣 size 的小格
- 排在 audience 區域右側、垂直排列
- 顯示：頭像首字 + 名字（縮小）
- HTML 結構：
  ```
  audience-zone:
    主格 ─────────────  溢位 ─
    ┌──────┐┌──────┐┌──────┐  ┌──┐
    │ 主人 ││ 塔倫 ││ 巴爺 │  │侍│
    └──────┘└──────┘└──────┘  ├──┤
                              │梅│
                              ├──┤
                              │葛│
                              ├──┤
                              │老│
                              ├──┤
                              │？│
                              └──┘
  ```

#### 為什麼 5 格夠
- 全 audience 池：overseer / officer / masterArtus / blacksmithGra / melaKook / masterServant / doctorMo（7 個）
- 3 大格通常占 1-2 個（主人權威群）
- 剩 5-6 個排隊到溢位 → **同時到齊機率 < 5%**、平常 2-3 個就滿了

---

## 🔧 整合工作量

| 項目 | 工作量 | 備註 |
|---|---|---|
| 新血池資料結構（recruit_xxx 動態生成） | 中 | 不能寫死在 npc.js、要 runtime 創 |
| Day 10 / 20 / ... 觸發 hook（main.js DayCycle） | 小 | 既有 onDayStart 加新監聽 |
| 死亡結算邏輯 | 中 | 跑 NPC list、roll、修改 alive |
| 新血加入邏輯 + 名字/背景 pool 抽取 | 小 | 純資料 |
| **UI 重構：teammate 聚合顯示** | **中** | 目前 1:1 渲染、要改成「先名字、後聚合」 |
| **UI 重構：audience 主格 + 溢位區** | **大** | HTML 結構大改、CSS 新增、優先序邏輯 |
| 跑分跟 favoredAttr 統計（找缺口） | 小 | 簡單聚合 |
| 存檔遷移（recruit 列表進存檔）| 小 | 加 `player.recruits[]` |

---

## 🚧 待決議題

- [ ] 第一批 recruit 是 Day 10 還是 Day 1 就有？我提案 Day 10（前 10 天先讓劇情 NPC 站穩）
- [ ] recruit 死亡 log 要不要演出（DialogueModal 一句話）還是只 addLog？
- [ ] recruit 進來要不要對白（「新人來了。」）還是默默進場？
- [ ] 一個 recruit 在場時間中位數預估幾天？需要平衡 8% 死亡率 + 補進速度
- [ ] recruit 跟玩家好感能漲嗎？（如果聚合顯示、好感數值還有意義嗎？）
  - 提案：可以漲、聚合格顯示「平均」好感色、tooltip 顯示個別
  - 或：完全不漲、純功能 NPC

---

## 🔗 跟其他系統的整合

### 跟主動技能整合
- recruit 補了 STR / AGI 缺口 → 玩家可以走拳法 / 重武器 build 不再痛苦
- 配合盧基烏斯線（拳法 = AGI 主導）→ 大幅改善遊玩體驗

### 跟巴爺主線
- recruit 死亡可以跟巴爺密謀的「送頭戰」呼應 — 主人/塔倫安排的「事故」
- 後期可加事件：玩家某個 recruit 跟自己訓練很久、突然被排「賭局戰」 → 死了 → 玩家發現是塔倫安排
- 強化整個訓練所「肉的工廠」主題

### 跟結局判定
- ending.js 可加「保護過幾個 recruit」統計 → 影響結局 flavor
