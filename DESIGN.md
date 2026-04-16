# 百日萬骸祭 · 開發計畫書

> 瀏覽器端角鬥士題材 RPG，繁體中文，vanilla JS 單檔部署。  
> 本文件是設計單一事實源，實作時以此為準。  
> 最後更新：2026-04-15（大型重構 v2）

---

## 🗂️ 相關文件

| 文件 | 用途 |
|------|------|
| **DESIGN.md**（本檔） | 設計哲學、系統架構、當前實作規格、未來路線圖 |
| **CLAUDE.md** | Claude Code session 啟動時自動載入的專案約定 |
| **HISTORY.md** | 已實作系統的歷史細節、Phase 0/1 完整紀錄、已廢棄設計的原始說明（考古用）|
| **docs/CONTENT-TEMPLATES.md** | 內容作者模板指南（新 NPC / 新武器 / 新訓練所等如何寫）|
| **NOTES.md** | 手機草稿本（待整理）|
| **changelog.html** | 版本記錄 |

---

## 📊 實作進度總表

> **這是進度的唯一事實源。修改狀態時只改這裡。**  
> ⚠️ 下方各章節若出現 checkbox 勾選，**可能是歷史快照**。若與此表不符，以此表為準。

**圖例**：✅ 完成 · 🟡 進行中 · ⬜ 未開始 · ⚠️ 設計完成待實作 · 🟤 已廢案

### Phase 0：基礎設施修復 — ✅ 完成（15/15）

| ID | 項目 | Commit | 主要檔案 |
|----|------|--------|----------|
| D.1.1 | Flags 模組 | `54e1af8` | flags.js |
| D.1.2 | 好感度系統整合 | `51b9d01` | npc.js |
| D.1.3 | modAttr 下限改為 1 | `cd3a6f4` | stats.js |
| D.1.4 | 存檔 schema v5 | `124f85f` | save_system.js |
| D.1.5 | NPC 結構重構 | `aea17e5` | npc.js |
| D.1.6 | 金錢系統 | `124f85f` | stats.js |
| D.1.7 | 設定頁面容器 | `229580a` | game.html |
| D.1.8 | 存檔槽管理 | `9e2b43f` | save_system.js |
| D.1.9 | EffectDispatcher | `e881c05` | effect_dispatcher.js |
| D.1.10 | TIMELINE_EVENTS 條件化 | `9019f70` | events.js |
| D.1.11 | DayCycle 每日結算鉤子 | `1abc4cf` | day_cycle.js |
| D.1.12 | GameState 全局狀態模組 | `f390e7d` | game_state.js |
| D.1.13 | SoundManager 空殼 | `9255aa3` | sound.js |
| D.1.14 | i18n 文字外部化 | `bd7d768` | i18n.js |
| D.1.15 | 人物介面階段 A | `7023113` | stats.js, game.html |

### Phase 1：奴隸循環核心 — ✅ 完成（11/11）

| ID | 項目 | Commit | 備註 |
|----|------|--------|------|
| 1-A | 左欄極簡化 | `4ab00cb` | |
| 1-B | 時段系統重分類 | `970aaa1` | training / meal / rest / sleep |
| 1-C | 閾值常數 Config 模組 | `012b4ea` | config.js |
| 1-D | 強制用餐/就寢事件 + 病痛系統 | `1474459` | ailments v1 |
| 1-E | 飢餓/疲勞/心情事件 | `1474459` | 精簡版 |
| 1-E.2 | `hunger_critical` ChoiceModal | `77c50b0` | 4 選項含鐵意志專屬 |
| 1-F | NPC 注意系統 | `1474459` | 葛拉/梅拉/監督官 |
| 1-G | 主人/長官傳喚制度 | `1474459` | 敘事版 |
| 1-H | 切磋事件化 | `1474459` | |
| 1-I | 金錢事件化 | `1474459` | 市集跑腿 / 主人派遣 |
| 1-J | 場地系統極簡化 | `31c0c06` | 訓練場為唯一場景 |

### 已完成的大型重構（非 Phase 定義）

| 項目 | Commit | 摘要 |
|------|--------|------|
| D.7 人物面板階段 A | `7023113` | tab bar + 動態好感度列表 |
| D.7 人物面板階段 B | `532ec9c` | 兩欄重構 + 裝備 picker + 關係圖 tab |
| D.7 階段 B+ 六角形 | `532ec9c` | 六角形屬性雷達圖 + 派生格子 + 可讀性放大 |
| D.6 v2 EXP 單一資源 | `532ec9c` | 廢除 SP，訓練用 type: 'exp'，手動花 EXP 升級 |
| D.6 v2 技能購買 | `532ec9c` | 技能 tab、passive skills 自動生效 |
| D.12 故事揭露系統 | `fae2ccc` | 卡西烏斯範本 4 flavor + 3 event |
| D.15 整合檢查清單 | `fae2ccc` | 方法論：實作前必問 8 題 |
| D.16/D.17 設計文件 | `77c50b0` | 訓練所差異化 + 謠言系統規格 |
| Stage 模組（轉場） | `532ec9c` | 就寢動畫 + 開場敘述 + 事件小過場 |
| Origins 系統前哨 | `fae2ccc` | farmBoy + nobleman 完整、其他鎖定 |
| 食物經濟平衡 | `77c50b0` | 餐點 25→18、訓練 8→10、sleep -12→-15 |
| D.18 屬性偏好協力 | `e06bbb7` | 命名三段 + 背景池 + favorWeight + ×15 總 cap + dispatcher exp 修正 |
| D.19 道德累積特性 | `0898cd3` | 10 個 earned traits + 滑動窗口 + NPC 愛憎倍率 + 失眠首夜敘述修正 |
| D.20 奧蘭主線 | `fba80cf` | 永駐兄弟 + 四幕脊椎 + 10 storyReveals + 偷藥/訣別/房間升級 + 生死關頭援手 |
| D.21 對話與晨思 | `4c23393` | DialogueModal（L2 手動）+ MorningThoughts（30 條）+ Stage.playMorning 雞鳴過場 + 奧蘭 Day 1 升級 |
| D.21b 奧蘭脊椎升級 + 道德光譜 | `204ffdc` | 藥房懸念完整鏈路 + Day 30/60/85 三大事件 DialogueModal 演出 + 人物頁道德光譜 UI |
| D.22 醫生老默 + 治療系統 | `2b31205` | 新 NPC 老默 + 首次見面 18 句對話 + 傷勢治療 ChoiceModal + 依 ailment 敘述差異化 |

### Phase 2：核心系統 — ⬜ 未開始

| ID | 項目 | 對應設計 |
|----|------|---------|
| S1 | 玩家背景系統擴充到 4 種 | 現有 2 個完整 + 2 個 locked |
| S2 | 訓練所系統（差異化） | § 4.1 / D.16 |
| S3 | NPC 原型與成長 | § 3.2 |
| S4 | 世界狀態系統（6 種） | § 4.5 |
| S5 | 結局判定器 | 未詳細規劃 |
| S6 | 多維度命運抽取 UI | 未詳細規劃 |

### Phase 3：擴展系統 — ⬜ 未開始

E1 職業 NPC / E2 等級×天賦 / E3 天氣季節 / E4 生病+醫生 / E5 羈絆 / E6 訓練協同 / E7 派系 / E8 宗教（6 神）/ E9 裝備深度 / E10 多部位裝備 / E11 個人物品+武器庫 / E12 仇恨擴展 / E13 寵物 / E14 EXP/SP/Tier 特性 / E15 人物介面階段 C / E16 音效內容

### Phase 4：內容系統 — ⬜ 未開始

C1 疤痕 / C2 夢境 / C3 謠言（見 § 4.2 / D.17）/ C4 婚姻伴侶 / C5 酒與藥物 / C6 寫信 / C7 戰爭徵召 / C8 暗殺+Nemesis / C9 3v3 團戰 / C10 教學 / C11 死亡結局畫面 / C12 統計頁 / C13 Meta-progression / C14 戰鬥 Juice / C15 輔助功能 / C16 日曆特殊日子

### Phase 5：美術資產 — ⬜ 未開始

A1 預留欄位 ✅（已做）/ A2 AI 生成占位 / A3 關鍵立繪 5 人 / A4 完整美術包

### Phase 6：手機適配 — ⬜ 未開始

M1 UI 容器化 🟡（Phase 0~1 已埋基礎）/ M2 Responsive CSS / M3 觸控友善 / M4 PWA / M5 Capacitor 封裝

---

## 📋 TO DO / CHECK LIST

> **這是當下開發週期的焦點清單**（不是整個遊戲的 roadmap）。  
> 使用者或 AI 完成某項時，勾選 ✅ 並移到「本週已完成」區塊保留 1~2 週作記憶，之後可刪除。

### 本週焦點（2026-04-15 ~）

- [ ] **D.14 marcoCharm 物品實作** — 讓卡西烏斯 80 好感事件真的給出符牌，完成 D.12 故事揭露閉環
- [ ] **D.13 睡前選單** — 冥想 / 讀書 / 寫日記 / 說故事 / 獨思 / 觀察（特性解鎖）
- [ ] **補其他 NPC 的 storyReveals** — 達吉、烏爾薩、老篤、梅拉、葛拉各 2~3 段
- [ ] **DESIGN.md 大型重構** — 本次進行中（分 2~3 session）
  - [x] 第一輪：新 DESIGN.md 骨架 + 遷移 D.12~D.17 至新章節
  - [ ] 第二輪：將 D.11 模板遷移到 `docs/CONTENT-TEMPLATES.md`
  - [ ] 第三輪：將 Phase 0/1 實作細節、已廢棄內容遷移到 `HISTORY.md`
  - [ ] 第四輪：刪除 `DESIGN-legacy.md`

### 阻擋中 / 等討論

- [ ] 標準訓練所的 template 化（需先補 Valerius 訓練官 NPC）—— 等 Phase 2 S2 啟動時做

### ✅ 本週已完成

- [x] **D.18 訓練協力系統 v2**（屬性偏好 + 背景池 + 三段門檻 + ×15 cap + dispatcher exp 修正）
- [x] Phase 1-E.2 ChoiceModal + hunger_critical 四選項 (`77c50b0`)
- [x] 食物經濟平衡（餐點下調、訓練加耗、sleep 加耗）(`77c50b0`)
- [x] D.16 訓練所差異化系統 設計文件 (`77c50b0`)
- [x] D.17 謠言系統 設計文件 (`77c50b0`)
- [x] NOTES.md 手機草稿本 (`2e4e24d`)
- [x] 進度表修正 Phase 1-E.2 狀態 ⬜→✅

---

## 🎯 TL;DR（5 分鐘快速上手 —— 新協作者必讀）

### 這個遊戲是什麼

**《百日萬骸祭》** 是瀏覽器端角鬥士題材 RPG。玩家扮演被賣進訓練所的奴隸角鬥士，**在 100 天後的大型祭典**要面對最終戰鬥。白天訓練、晚上就寢、偶爾遇到事件、好感度決定劇情深度——但你**幾乎沒有主動權**（這是核心設計）。

### 為什麼特別

跟同類型遊戲（實況野球、Princess Maker 等）的差別：

1. **奴隸沒有自主權**（Phase 1 哲學）——玩家只能選訓練類型，不能主動找 NPC 說話、不能自由移動。所有 NPC 互動都要**等事件發生**
2. **emergent 敘事**——每個玩家看到的故事不一樣，靠特性 × 好感 × 屬性觸發共鳴（詳見 § 3.3）
3. **「窮中藏寶」的訓練所設計**（Phase 2 規劃）——破訓練所不是難度條，而是有別處拿不到的珍珠
4. **故事道具網路**（D.14）——重要道具有 `storyTag`，一個符牌可以串起多條 NPC 故事線

### 目前進度（2026-04-15）

- **Phase 0 基礎設施** ✅ 全做完（15/15）
- **Phase 1 奴隸循環核心** ✅ 全做完（11/11）
- **人物面板** ✅ 六角形屬性圖 + 關係圖 tab + 裝備動態 picker
- **Stage 轉場系統** ✅ 就寢動畫、開場敘述、事件小過場
- **D.12 故事揭露** ✅ 卡西烏斯範本做完，其他 NPC 待補
- **D.14 / D.16 / D.17** ⚠️ 設計完成，實作待 Phase 2

### 技術棧

- **純 vanilla JS**（無框架）
- **所有模組都是 IIFE 寫法**：`const X = (() => { ...; return { ... }; })();`
- **載入順序**：`config.js` → `stage.js` → `choice_modal.js` → `flags.js` → `origins.js` → ...（見 § 1.2）
- **存檔用 localStorage**，schema v5
- **沒有 build step**（直接改 → 瀏覽器重新整理）

### 第一天上工先看什麼

1. **本 DESIGN.md § 6.1（整合檢查清單）** —— 實作任何新功能前必跑
2. **CLAUDE.md** —— 技術約定、「不要做」清單
3. **`game.html`** —— 所有 HTML + CSS、script 載入順序
4. **`main.js`** —— 遊戲主邏輯，從 `Game.init()` 看起
5. **`stats.js` / `npc.js` / `events.js`** —— 核心資料模組

---

## 1. 技術架構

### 1.1 檔案結構

```
100dz2LoD/
├── game.html           # UI 入口（含所有 CSS + script 載入）
├── index.html          # 封面/新遊戲選擇
├── main.js             # 遊戲主邏輯（Game IIFE，最大檔）
├── stats.js            # 玩家資料、屬性計算、渲染
├── config.js           # 常數（THRESHOLDS / DAILY / TRAIT_DEFS / AILMENT_DEFS）
│
├── 資料定義模組
│   ├── actions.js      # 可執行動作（訓練/休息/等）
│   ├── events.js       # 事件池（ACTION_EVENTS / NPC_NOTICE_EVENTS / ...）
│   ├── npc.js          # NPC 定義 + 好感度 + storyReveals
│   ├── origins.js      # 玩家背景定義（farmBoy / nobleman / ...）
│   ├── fields.js       # 場景定義（目前只有 stdTraining）
│   ├── weapons.js      # 武器表
│   ├── armors.js       # 防具表
│   ├── item.js         # 物品表
│   ├── enemy.js        # 敵人表
│   ├── skill.js        # 技能表
│
├── 系統模組
│   ├── flags.js          # Flag 管理器（劇情旗標）
│   ├── game_state.js     # 全局狀態（session）
│   ├── day_cycle.js      # 每日結算鉤子
│   ├── effect_dispatcher.js  # 統一效果處理器
│   ├── save_system.js    # 存檔槽管理
│   ├── sound.js          # 音效呼叫點（目前空殼）
│   ├── i18n.js           # 文字國際化（目前鋪路）
│
├── UI 模組
│   ├── stage.js          # 🆕 Stage 轉場/動畫層
│   ├── choice_modal.js   # 🆕 ChoiceModal 選擇 modal
│   ├── battle.js         # 戰鬥 UI 整合層
│   ├── ending.js         # 結局
│
├── 戰鬥核心（獨立）
│   └── 測試頁面/testbattle.js   # TB_WEAPONS/TB_ARMORS/TB_SHIELDS + 戰鬥引擎
│
└── 文件
    ├── DESIGN.md         # 本檔（設計單一事實源）
    ├── CLAUDE.md         # Claude Code 自動載入約定
    ├── HISTORY.md        # 實作歷史、已廢棄設計
    ├── docs/CONTENT-TEMPLATES.md  # 內容作者模板
    ├── NOTES.md          # 手機草稿本
    └── changelog.html    # 版本紀錄
```

### 1.2 模組載入順序（見 game.html 底部）

```
config.js → stage.js → choice_modal.js → flags.js → origins.js →
i18n.js → game_state.js → sound.js → day_cycle.js →
effect_dispatcher.js → stats.js → fields.js → npc.js → events.js →
item.js → weapons.js → armors.js → enemy.js → train.js → skill.js →
ending.js → save_system.js → testbattle.js → battle.js → actions.js → main.js
```

**原則**：資料定義 → 系統模組 → UI 模組 → 戰鬥 → 行動 → 主遊戲邏輯。

### 1.3 資料流（核心）

```
┌─────────────────────────────────────────────────┐
│  玩家操作（點按鈕 / 選 choice / 推時間）       │
│            ↓                                    │
│  Game.doAction(id) 或事件觸發                   │
│            ↓                                    │
│  Effects.apply(effects[], ctx)                  │
│    ├── type: 'vital'     → Stats.modVital       │
│    ├── type: 'attr'      → Stats.modAttr        │
│    ├── type: 'exp'       → Stats.modExp         │
│    ├── type: 'money'     → Stats.modMoney       │
│    ├── type: 'fame'      → Stats.modFame        │
│    ├── type: 'affection' → teammates.modAffection│
│    ├── type: 'sp'        → Stats.modSp (legacy) │
│    └── type: 'choice'    → ChoiceModal.show     │
│            ↓                                    │
│  Flags.set(storyFlag, true) [可選]              │
│            ↓                                    │
│  addLog(text, color, italic, flash)             │
│            ↓                                    │
│  Game.renderAll()  / Stats.renderAll()          │
└─────────────────────────────────────────────────┘
```

**關鍵原則**：
- **所有狀態修改走 `mod*()` 函式**，不要直接寫 `player.x = y`
- **`Stats.modVital` / `Stats.modAttr` 自動 `Math.round`**，確保整數
- **`Stats.eff(attr)` 也是整數**（`player[attr] + eqBonus - staminaPenalty + ...` 再 round）

### 1.4 存檔系統（D.1.4 / D.1.8）

- **localStorage**，schema v5
- **多槽支援**（D.1.8）：`slot_1` ~ `slot_5` + `auto`
- **自動存檔**：每天結束、重大事件後
- **payload 內容**：`player`、`fieldId`、`gameState`、`npcAffection`、`flags`、`savedAt`
- **向下相容**：`_applySavePayload` 接受 v2~v5，缺欄位自動補預設值

---

## 2. 遊戲核心系統

### 2.1 時段與生存循環（Phase 1 實作）

**每日 8 個 2 小時時段**（06:00 ~ 22:00），分 4 類：

| Slot | 時段 | 類型 | 玩家可操作 |
|------|------|------|-----------|
| 0 | 06-08 | meal（早餐） | 自動事件 |
| 1 | 08-10 | training 1 | ⭐ 選訓練 |
| 2 | 10-12 | training 2 | ⭐ 選訓練 |
| 3 | 12-14 | meal（午餐） | 自動事件 |
| 4 | 14-16 | training 3 | ⭐ 選訓練 |
| 5 | 16-18 | training 4 | ⭐ 選訓練 |
| 6 | 18-20 | meal（晚餐） | 自動事件 |
| 7 | 20-22 | rest | 自動結算（未來 D.13 改為選單） |
| — | 22:00 | sleep | 就寢事件 + Stage 動畫 |

**關鍵點**：
- 玩家真正能選的只有 **4 個訓練時段** + `rest` 動作
- 用餐/就寢**自動觸發**（Phase 1-D 事件池）
- 訓練動作用 `type: 'exp'`（見 § 2.3）
- 食物收支設計為「略微緊繃」，強迫玩家經營梅拉關係或冒險取得食物（見 § 2.1.1）

#### 2.1.1 當前食物平衡（2026-04-15 調整）

**收入**：
- 早餐：18 / 22 / 28（無好感 / 梅拉 30+ / 梅拉 60+）
- 午餐：18 / 22 / 28
- 晚餐：20 / 25 / 32
- **一日總進**：56 / 69 / 88

**支出**：
- 訓練 4 次：40（每次 10，耐力訓練 12）
- 就寢：15
- **一日總耗**：55

**淨**：
- 無好感 **+1**（略微緊繃）
- 梅拉好感 30 **+14**（穩定）
- 梅拉好感 60 **+33**（充裕，屬於「建立關係的獎勵」）

### 2.2 戰鬥系統摘要 1)

**已實作的戰鬥核心**（testbattle.js / battle.js）：

- **ATB 時間系統**：每個單位有 swingTime（揮速），依速度填充 ATB，填滿 = 行動
- **評分系統 A/B/C/D**：根據戰鬥時間、連擊、爆擊、受傷等評分
- **砍首選擇系統**：戰勝後可選「砍首 / 踩臉羞辱 / 饒恕」，影響 fame / 好感 / 成就
- **技能條雙門檻**：小招 50% / 大招 100%
- **自動模式三段**：一般 / 進攻 / 硬核
- **主手/副手雙槽**：路線由裝備組合決定（fury 盾衛 / rage 狂戰 / 依武器）

**完整規格**：見 `HISTORY.md` 戰鬥系統附錄，或直接看 `testbattle.js` 代碼（最終事實源）。

### 2.3 屬性與 EXP 系統（D.6 v2）

**核心設計**：**EXP 是唯一資源**（無 SP 系統）

- **6 屬性**：STR / DEX / CON / AGI / WIL / LUK
- **訓練行動**用 `type: 'exp'`（不是 `'attr'`）：
  ```js
  basicSwing: { effects: [{ type: 'exp', key: 'STR', delta: 8 }] }
  ```
- **升級曲線**：`expToNext(level) = ceil(10 * 1.15^(level-10))`
  - 10→11: 10 EXP · 15→16: 20 EXP · 20→21: 40 EXP · 25→26: 81 EXP · 30→31: 163 EXP
- **升級方式**：玩家在角色頁手動點「升級」按鈕，花 EXP 換一級（**不是自動滿格升級**）
- **屬性上限**：目前預設 30，未來按訓練所 override（見 § 4.1）
- **強制整數**：`Stats.modAttr` / `Stats.eff` / `Stats.modVital` 都 `Math.round`

**未來技能購買也走 EXP**：
```js
ironSkin: { expCosts: { CON: 200 } }  // 需要 CON 200 EXP 解鎖鐵皮
```

### 2.4 事件系統

**事件類別**（集中在 `events.js`）：

| 常數 | 用途 | 觸發時機 |
|------|------|---------|
| `EVENT_POOL` | 一般隨機事件 | rollRandom() |
| `ACTION_EVENTS` | 行動後事件 | 訓練/動作完成後 |
| `NPC_NOTICE_EVENTS` | NPC 注意系統（Phase 1-F） | 訓練累積 N 次後 |
| `SUMMON_EVENTS` | 主人/長官傳喚（Phase 1-G） | DayCycle 條件觸發 |
| `SPARRING_INVITE_EVENTS` | 切磋邀請（Phase 1-H） | 訓練後 NPC 好感 ≥ 50 |
| `ERRAND_EVENTS` | 跑腿事件（Phase 1-I） | 每 7 天 |
| `TIMELINE_EVENTS` | 條件化時間軸事件（D.1.10） | 特定天數 + 條件 |
| `CHOICE_EVENTS` | 🆕 玩家選擇事件（D.12 v2） | 由 `ChoiceModal.show` 顯示 |

**事件觸發流程**：
1. 事件定義寫在 `events.js` 對應常數
2. 某個時機（訓練後/睡前/...）呼叫 `Events.getXxxEvent()` 或 `ChoiceModal.show(ev)`
3. 效果由 `Effects.apply(ev.effects)` 統一處理
4. log 輸出 + flag 寫入 + UI 重繪

### 2.5 Stage 演出層（`stage.js`）

**中央訓練場畫面**（`#scene-view`）是 Stage，提供以下 API：

| API | 用途 |
|-----|------|
| `Stage.playSleep({ sleepType, onBlack })` | 就寢動畫，依 sleepType 分流：normal 金色 zzz / insomnia 紅灰字 / nightmare 血紅文字 |
| `Stage.playOpening(lines, onBlack)` | 開場敘述（黑幕閉眼 → 逐行淡入 → 掀眼）|
| `Stage.playEvent({ title, icon, lines, color })` | 通用事件小過場（不閉眼，在現有畫面上淡入） |
| `Stage.closeEyes() / openEyes()` | 單獨的閉眼/掀眼（手動控制） |

**時序與阻塞**：
- `playSleep` 是 async，回傳 Promise
- `sleepEndDay` 用 `await Stage.playSleep(...)` 確保動畫完成前不推進
- 黑幕下執行的邏輯放在 `onBlack` callback 裡

**事件佇列**（D.12 v2）：
- `queueStageEvent(ev)` 將事件推入佇列
- `_flushStageEvents()` 在 Stage.playSleep 結束後依序 `await Stage.playEvent(ev)`
- 用途：DayCycle 觸發的事件（主人傳喚等）不再只寫 log，而是跳到舞台上演出

---

## 3. 人物系統

### 3.1 玩家背景 Origins（Phase 2 S1 前哨）

**資料**：`origins.js`

**已完成 2 個**：

| ID | 名字 | 屬性修正 | 初始特性 | 初始金錢 | 初始 NPC 好感 |
|----|------|---------|---------|---------|--------------|
| `farmBoy` | 農家子弟 | STR+2 CON+3 DEX-1 WIL-1 | `diligence`（勤勉） | 0 | 達吉+5 老篤+10 |
| `nobleman` | 落魄貴族 | WIL+3 LUK+2 STR-2 CON-1 | `kindness`（寬厚） | 20 | 主人+10 長官+5 鐵匠-5 |

**鎖定占位 2 個**：`vagabond`（流浪漢）、`gladiatorSon`（角鬥士之子）

**開場流程**：
1. 姓名輸入（`#modal-name`）
2. `confirmName()` → 開 origin 選擇 modal（`#modal-origin`）
3. 玩家選卡片 → 看詳情 chips → 確認
4. `Stats.applyOrigin(id)` 套用所有修正
5. `Stage.playOpening(narrative)` 播放開場敘述
6. `_enterNewGame()` rollNPCs + log + save + render

**開場敘述範例**（farmBoy）：
```
你記得那天。煙從田邊升起。
你記得母親的最後一個眼神。
你記得那個戴冠的人。
現在，你被賣進了他的競技場。
```

### 3.2 NPC 結構

**資料**：`npc.js` 的 `NPC_DEFS`

**完整欄位**（`_defaultNpcFields` 模板）：
- 基本：id / name / title / desc / role / baseAffection
- **成長系統（D.11.5）**：archetype / growthRate / baseStats
- **人格**：personality / personalityDesc
- **時間軸**：arriveDay / leaveDay
- 排程：schedule
- **漸進揭露（D.11.16）**：background / secrets / weaknesses / fears / hiddenQuestHints
- **連動**：questlineId / religion / faction / petReactions
- 存活狀態：alive
- 語音：voiceLines
- **資產**：assets（portrait / icon / bgm / sfx）
- **🆕 D.12 故事揭露**：`storyReveals[]`（見 § 3.3）

**目前 11 個 NPC**：
- 隊友：cassius / dagiSlave / ursa / oldSlave
- 權威：prisonGuard / overseer / officer / masterArtus / masterServant
- 職業：blacksmithGra（鐵匠）/ melaKook（廚娘）

### 3.3 故事揭露系統 2)（D.12）

> **哲學**：不預告未來，但給方向感。每個玩家看到的故事都不一樣。

**核心概念**：
1. **故事 = 碎片陣列**：每個 NPC 有 `storyReveals[]`
2. **漸進揭露**：好感門檻逐步解鎖
3. **特性共鳴**：某些 reveal 只對特定玩家開放
4. **內容可漸進補**：允許一次只補一個 NPC
5. **道具是故事載體**：重要 reveal 可贈送獨特道具（見 § 4.3）

**資料結構**：
```js
cassius.storyReveals = [
  // Flavor 段：關係圖卡片常駐顯示
  {
    id: 'cassius_quiet',
    type: 'flavor',
    affection: 10,
    text: '他很少說話。每天揮劍的時間永遠比別人多一個小時。',
  },
  // Event 段：夜間隨機觸發（一次性）
  {
    id: 'cassius_whisper_night',
    type: 'event',
    affection: 40,
    requireAnyTrait: ['insomnia_disorder', 'neurotic'],
    chance: 0.3,
    onceOnly: true,
    text: '深夜裡你聽見他低聲念著一個名字——「馬可」。',
    logColor: '#8899aa',
  },
  // Event 段：觸發時贈送道具
  {
    id: 'cassius_charm_touch',
    type: 'event',
    affection: 80,
    requireMinAttr: { WIL: 15 },
    chance: 0.25,
    onceOnly: true,
    text: '他把那塊符牌塞進你手裡...',
    grantItem: 'marcoCharm',
  },
];
```

**支援的觸發條件**：
| 欄位 | 意義 |
|------|------|
| `affection` | 最低好感門檻（必填） |
| `requireAnyTrait` | 玩家需擁有其中任一特性 |
| `requireAnyAilment` | 玩家需擁有其中任一病痛 |
| `requireMinAttr` | 屬性最低值 |
| `requireFlag` | 需特定旗標 |
| `requireOrigin` | 限此 origin |
| `requireItemTag` | 身上需有帶此 tag 的物品 |
| `chance` | event 型觸發機率 |
| `onceOnly` | 觸發過寫入 `player.seenReveals[]` 永不再觸發 |

**API**：
- `teammates.getVisibleFlavor(npcId)` → 當前可見最高段 flavor 文字
- `teammates.getPendingStoryEvents(player)` → 所有符合條件且未觸發的 event 型 reveals
- `main.js _scanStoryEvents()` → 每晚就寢時掃描 + roll 觸發

### 3.4 好感度與仇恨（9 層，D.4 系統）

| 層級 | 範圍 | 關係圖卡片背景 |
|------|------|---------------|
| loyal 忠誠 | 90~100 | 金 `#2a1e08` |
| devoted 崇敬 | 70~89 | 紫 `#1e1030` |
| friendly 友好 | 40~69 | 藍 `#0a1828` |
| acquainted 認識 | 10~39 | 綠 `#0f2010` |
| neutral 中立 | -9~9 | 灰 `#1a1a1a` |
| annoyed 不悅 | -10~-29 | 紅灰 `#2a1410` |
| disliked 厭惡 | -30~-59 | 暗紅 `#2a0a0a` |
| hated 憎恨 | -60~-89 | 血紅 `#350505` |
| nemesis 不共戴天 | -90~-100 | 血黑 `#1a0000` + 脈動紅邊框 |

**API**：
- `teammates.getAffection(npcId)` → 當前值
- `teammates.modAffection(npcId, delta)` → 修改（含 kindness trait +20% 加成）
- `teammates.getAffectionLevel(npcId)` → 層級字串

**特殊機制**：
- **寬厚特性（`kindness`）**：正向好感成長 +20%
- **神經質特性（`neurotic`）**：正向好感成長 -20%

### 3.5 特性系統（D.6 / D.12 擴充）

**資料**：`config.js` 的 `TRAIT_DEFS`

**目前定義的特性**（11 個）：

**積極（6 個）**：
- `kindness` 寬厚 — 好感成長 +20%
- `diligence` 勤勉 — 訓練 EXP +10%（farmBoy 起手）
- `iron_will` 鐵意志 — WIL 訓練 +15%
- `survivor` 戰場老兵 — 競技場 ACC +3
- `unbreakable` 不屈之身 — HP<20% 時攻擊 +15%
- `literate` 識字 — 解鎖睡前讀書/寫日記（D.13）
- `silverTongue` 巧舌 — 解鎖睡前說故事（D.13）

**負面（4 個）**：
- `reckless` 急躁 — 訓練受傷率 +5%
- `shaken` 信心崩潰 — 訓練效率 -10%
- `neurotic` 神經質 — 好感 -20% 但夜間共鳴 ×1.5
- `brooding` 鬱結 — 心情恢復 -20%，但獨思解鎖深層記憶

**病痛**（獨立於 traits）：`config.js` 的 `AILMENT_DEFS`
- `insomnia_disorder` 失眠症
- `arm_injury` / `leg_injury` / `torso_injury` 傷

### 3.10 醫生老默與治療系統（D.22）

**資料**：`npc.js` 的 `doctorMo` + [doctor_events.js](../doctor_events.js)

**角色定位**：
- 曾是帝國北境軍團的主治醫官
- 違反軍令試圖救治敵軍傷員 → 被剝奪自由身 → 輾轉賣進訓練所
- 看過的死法比活人多。喝酒，但手還是穩的
- `role: 'audience'`, `personality: 'cautious'`, `baseAffection: 0`
- **愛憎**：`likedTraits: { patient:3, merciful:2, humble:2, reliable:2 }`
  `dislikedTraits: { impulsive:3, cruel:3, prideful:2, opportunist:1 }`
- 他每天都在處理衝動者和殘忍者造成的後果，自然討厭這些特性

**觸發機制**（符合 Phase 1「奴隸沒自主權」哲學）：
- 玩家**不能主動**去找醫生
- 主人為了保護「投資」，在玩家有傷勢時派侍從帶去
- 條件：Day ≥ 10 + 有 ailment + 未今日訪問過
- **第一次保證觸發**（破冰），之後每日 35% 機率
- 掛鉤於 `sleepEndDay` 在 `flushDialogues` 之後（晨起演出全部完成才能開始新 modal）

**第一次見面**（DialogueModal 18 句）：
侍從帶你到訓練所後方小房間 → 烈酒與草藥味 → 老默手很穩 →
「我是醫生。沒人叫我老默以外的名字——包括主人。」→
「我不會替你隱瞞傷勢」→「我也不會問你怎麼受傷的」→
**若有藥房懸念未解** → 額外多出 4 句：「我這裡偶爾會少一些草藥……有時候是老鼠偷的。有時候不是。」

**治療流程**：
1. DialogueModal 開場對話
2. ChoiceModal 列出所有當前 ailment 讓玩家選一個治療（或拒絕）
3. 選定後 DialogueModal 依該 ailment 播出差異化敘述：
   - `insomnia_disorder`：給草粉「睡不著是弱點，別跟別人說」
   - `arm_injury`：判斷筋膜 + 包紮「三天別出力」
   - `leg_injury`：按壓小腿 + 熱藥貼「會痛，但有效」
   - `torso_injury`：聽胸腔 + 綁帶「接下來七天別深呼吸。也別哭。」
4. 移除該 ailment、老默 aff +5、消耗 2 slots（4 小時）

**拒絕治療**：老默 aff -5，沒其他懲罰。「你搖頭走出房間。老默沒有追問。」

**後續訪問對話差異**（依好感度）：
- aff < 40：平淡「坐」
- aff ≥ 40：帶感情「……又是你」「語氣裡有點東西」

**存檔**：`DoctorEvents.serialize()` / `restore()` 儲存 `_lastVisitDay`

---

### 3.9 對話系統與晨思（D.21）

**模組**：[dialogue_modal.js](../dialogue_modal.js) + [morning_thoughts.js](../morning_thoughts.js) + [stage.js](../stage.js) `playMorning`

#### 三層對話節奏

| 層級 | 用於 | 節奏 | 實作 |
|---|---|---|---|
| **L0 · Log 碎念** | 訓練碎念、戰鬥日誌、系統訊息 | 立即寫入，無暫停 | 現有 addLog |
| **L1 · 自動過場** | storyReveal flavor、散點敘述 | 打字機 + 自動流 | 現有 addLog（未來會加 Stage.playEvent） |
| **L2 · 手動對話** | 脊椎事件、ChoiceModal 前置、重量級 reveal | 打字機 + 必須按鍵 | **DialogueModal** |

#### DialogueModal 操作

- `Space` / `Enter` / 點擊 → 跳過打字機 / 進下一句
- 按住 `Ctrl` → 秒過整段（重複玩家的朋友）
- 首次開啟時右下角淡入按鍵提示（只顯示一次）
- 使用格式：
  ```js
  DialogueModal.play([
    { text: '敘述文字。' },
    { speaker: '奧蘭', text: '對話文字。' },
    { speaker: '你',   text: '玩家的話。' },
  ], { onComplete: () => { /* 下一步 */ } });
  ```

#### storyReveal 升級：dialogueLines

storyReveal 可以選擇性加 `dialogueLines: [...]` 欄位：
- 若有 → 事件被 `_scanStoryEvents` 掃到時排入 `_pendingDialogues` 佇列，
  在 `playMorning` 之後自動播出
- 若無 → fallback 到 `text` 欄位 + `addLog` 輕量顯示

範例：奧蘭 Day 1 誓言（`orlan_first_night_oath`）已升級成 11 句 DialogueModal。

#### 晨思系統（MorningThoughts）

**核心哲學**：主角「醒來的第一個念頭」系統。同時解決：
1. 懸念記憶（前一天看到的事，隔日在腦中延續）
2. 新手教學（把按鍵、機制、解法偽裝成主角的自言自語）
3. 狀態解析（病痛/特性/心情變動 → 主角會抱怨）
4. 預感伏筆（祭典將近、大事將至）
5. 反思儀式（屬性破門檻、天數里程碑）
6. 每天晨起的情緒節拍（哪怕沒條件也有預設念頭）

**機制**：每天晨起從 REGISTRY 中挑一條符合當前狀態的 thought 播出
- **優先度分層**：mystery(100) > resolution(95) > anticipation(80) > social(70) > foreboding(65) > body(45) > mood(30) > reflection(25) > default(10)
- **輪播**：同一條 thought 有多句文字，依 `shownCount` 輪播
- **衰退**：`maxShowCount` 達上限不再播；`decayAfter` 超過 N 天不再觸發
- **解決回收**：`resolvedBy` 對應 flag 設定後自動靜默；`queueResolution()` 可排入回收 thought

**首發庫**：10 類共 ~30 條
- 預感（80/90 天分段）
- 身體（失眠/手傷/腿傷/軀幹/力竭/飢餓）
- 社交（10 個道德特性各有反應）
- 情緒（高/低 mood）
- 反思（day 10/30/50、STR 破 20、慢/弱）
- 預設（day 1-5 / 6-20 / 21-50 / 51-79 四段）

#### Stage.playMorning 晨起過場

流程：
```
黑幕保持
  ↓ 0.3s
雞鳴 🐓……咯咯咯…… 淡入（italic 暗金）
  ↓ 0.9s
內心獨白淡入 + 打字機動畫（灰斜體）
  ↓ 播完 0.8s
覆蓋層淡出 → 黑幕掀開
  ↓
進主畫面
```

**支援 skip**：播放期間按 Space/Enter/Ctrl/點擊 → 立即跳到完整顯示 + 進入下一階段

**串接方式**：`sleepEndDay` 先呼叫 `playSleep({skipFinalOpen:true})` 保留黑幕，再呼叫 `playMorning({assumeBlack:true, innerThought})`，避免雙重閉眼動畫

**存檔**：`MorningThoughts.serialize()` / `restore()` 整合 save.morningThoughts

---

### 3.8 奧蘭主線 — 永駐兄弟（D.20）

**資料**：`npc.js` 的 `orlan` NPC 定義 + [orlan_events.js](../orlan_events.js) + `fields.js` 的 chance:1.0

**角色核心**：遊戲唯一的**永駐兄弟**。跟主角同一天被押進訓練所，磨坊主人獨子。
表面說法是父親欠債，真相是妹妹得了血咳症、父親為了救她把他賣了。
他不恨；他認為這是對的。

**定位**：
- `favoredAttr: 'WIL'`（意志代表）
- `baseAffection: 25`（比其他 NPC 高，反映「第一天就是朋友」）
- `personality: 'support'`（主動溫暖型 — 不沉默也不多話）
- `chance: 1.00`（每天 100% 出現在訓練場）

**愛憎特性**：
- `likedTraits`: kindness 3 / merciful 3 / reliable 2 / loyal 2 / humble 1
- `dislikedTraits`: cruel 3 / opportunist 2 / coward 1 / prideful 1
- 關鍵：`coward` 只 1 分（他太了解恐懼）；`cruel` 3 分（他最怕你變成那種人）

**四幕主線**：
| 幕 | 天數 | 狀態 | 核心張力 |
|---|---|---|---|
| 第一幕 · 同命兄弟 | Day 1–30 | 同房 | 建立羈絆，奧蘭照顧主角 |
| 第二幕 · 分道揚鑣 | Day 30–60 | 分房 | 主人升級房間強制分開 |
| 第三幕 · 交會再別 | Day 60–85 | 重逢與危機 | 偷藥事件 + 秘密揭露 |
| 第四幕 · 最終訣別 | Day 85–100 | 分離定局 | 代你出戰 / 訣別 |

**storyReveals 10 段**（5 flavor + 5 event）：
- Flavor：第一夜 / 那個爛笑話 / 磨坊記憶 / 摸左手腕 / 半塊麵包（25/35/50/65/80 好感）
- Event：初遇誓言（強制 1.0）/ 半夜分食（40 aff，可重複 0.40）/ 爛笑話（25 aff，可重複 0.35）/
  惡夢的安慰（50 aff + 失眠症）/ 妹妹真相（70 aff + WIL ≥ 12）

**脊椎事件（[orlan_events.js](../orlan_events.js)）**：
1. **房間升級**（Day 30+）觸發條件 `masterArtus_aff ≥ 50 AND fame ≥ 30`
   - 普通選項：接受 / 試圖拒絕
   - `prideful` 特性：多一個「這是我應得的」傲然選項
   - 無論如何都會被強制分房（flag `separated_from_olan`）
2. **偷藥事件**（Day 60+）觸發條件 `flag player_was_nearly_dead`
   - 四選項：替他分擔 / 沉默 / 求情 / 告發（iron_will 鎖）
   - 沉默 → 一次定型【膽小鬼】
   - 替他分擔 → 一次定型【可靠】
   - 告發 → 永久鎖【投機】（lock:true）
3. **最終訣別**（Day 85 強制）
   - 接受 / 拒絕（fame ≥ 60 + 救過他才解鎖）/ 傲然拒絕（prideful 才有）
   - 拒絕路線 → flag `orlan_will_fight_beside` 解鎖共同出戰結局
   - 已告發路線 → 奧蘭不出現，改為「昨晚被處決」訊息

**生死關頭援手**（`OrlanEvents.tryDeathSave()`）：
- 掛鉤於 `Stats.modVital('hp', ...)` — HP 即將歸零時呼叫
- 條件：奧蘭 aff ≥ 80 + 玩家有 merciful/kindness 特性 + 一次性 + 奧蘭活著
- 效果：HP 補至 30、flag `player_was_nearly_dead`、奧蘭 aff +10
- 敘述：「你睜開眼。奧蘭的臉就在你上方……『終於活了。』」

**結局矩陣**（Day 100 判定，依 flag 組合）：
| 結局 | 觸發條件 | 敘事重點 |
|---|---|---|
| 悲 A · 無名訣別 | 奧蘭 aff < 40 | Day 85 代你出戰，死在沙地 |
| 悲 B · 殘廢殞命 | `guilt_olan` + `olan_crippled` | Day 90 在牢裡自盡，留紙條「我不怪你」 |
| 悲 C · 無聲消失 | 一般路線 | 事後才知道他代你死了 |
| 苦 D · 並肩到底 | `shared_olans_punishment` + 妹妹真相已揭露 | 共同出戰，決賽前他倒下 |
| 極 E · 奇蹟殘局 | `orlan_will_fight_beside` + 多重高好感條件 | 兩人都活，但奧蘭失去一條腿 |
| 極特 F · 獨自登頂 | `betrayed_olan` | 你奪冠，一個人走回房間 |

**存活狀態**：奧蘭被害死時 `NPC_DEFS.orlan.alive = false`，後續所有對話改為回憶型 log。

---

### 3.7 道德累積特性系統（D.19）

**資料**：`config.js` 的 earned traits 區塊 + [moral.js](../moral.js) + `npc.js` 的 `likedTraits` / `dislikedTraits`

**核心哲學**：
- **你的標籤 = 你最近的行為**，不是一輩子的總和
- 100 天太短，每個選擇都要有機會被下一個覆蓋
- NPC 看見的不是你過去做了什麼，是你現在是誰

**5 對相反的 earned traits**：
| 正面 | 反面 | 軸 |
|---|---|---|
| reliable 可靠 | coward 膽小鬼 | reliability |
| merciful 仁慈 | cruel 殘忍 | mercy |
| loyal 忠誠 | opportunist 投機 | loyalty |
| humble 謙卑 | prideful 驕傲 | pride |
| patient 耐心 | impulsive 衝動 | patience |

**滑動窗口機制**（N=3）：
- 每個軸存最近 3 筆行動記錄
- 窗口「全部同向」→ 賦予該側特性
- 窗口「出現反向」→ 移除該軸的現有特性
- 反覆橫跳 = 永遠沒特性 = 「你什麼都不是」

**關鍵事件**：
- 普通事件 `Moral.push(axis, side)` → push 1 筆
- 關鍵事件 `Moral.push(axis, side, { weight: 3 })` → 一口氣 3 筆，立即定型
- 劇情鎖 `Moral.push(axis, side, { weight: 3, lock: true })` → 定型且不可逆（極少用）

**NPC 愛憎倍率**（`teammates.modAffection` 內建）：
```
likedTraits    = { reliable:3, cruel:2, ... }   // 強度 1~3
dislikedTraits = { coward:3, impulsive:2, ... }

淨分 = Σ(liked) − Σ(disliked)
倍率：+3→×1.5 / +2→×1.3 / +1→×1.15 / 0→×1.0
      -1→×0.8 / -2→×0.5 / -3以下→×0.3
```
只對正向好感成長作用。

**觸發點（尚待接入）**：
- ChoiceModal 的選項加 `moral` 欄位，選完自動呼叫 `Moral.push`
- 事件系統的 effects 陣列加 `{ type:'moral', axis, side, weight? }`
- 戰鬥結束斬首 / 饒命選項直接驅動 mercy 軸

**存檔**：`player.moralHistory` + `player.moralLocks` 存在 save.player 內

---

### 3.6 訓練協力與屬性偏好系統（D.18）

**資料**：`npc.js` 的 `favoredAttr` 欄位 + `background_gladiators.js` + `fields.js` 的 `favorWeight`

**核心哲學**：
- 好感度決定「**故事揭露**」（D.12）
- 屬性偏好決定「**訓練協力**」
- 兩條軸各司其職，互不干擾

**完整公式**：
```
base × mood × 訓練場裝備等級 × (1 + 護符/特性/屬性/寵物加成)
     × 訓練所加成 × ∏(命名協力) × ∏(背景協力) × (1 + 0.08 × 當場總人數)
```
最終乘數 **硬上限 ×15**（人多熱鬧本身無單獨上限，但被總 cap 蓋住）

**命名 NPC 三段協力**（僅當 `favoredAttr` 匹配訓練屬性時生效）：
| 好感 | 倍率 |
|---|---|
| ≥ 30 認同 | ×1.3 |
| ≥ 60 摯友 | ×1.6 |
| ≥ 90 知己 | ×1.8 |

**背景角鬥士協力**（單段，二元判定）：
- 每日從 10 人池中按訓練所 `favorWeight` 抽 2-4 人
- 熟悉度 `familiarity`：每次同場訓練 +1，累積到 ≥ 40 通過門檻
- 通過後且 `favoredAttr` 匹配 → ×1.3
- 不進關係圖、不觸發 storyReveals，純機能性填充

**訓練所差異化（favorWeight）**：
- 標準訓練所：`{ CON:3, WIL:3, STR:2, DEX:1, AGI:1 }`（長官希望大家活下去）
- 未來鐵獄：`{ STR:5, CON:3, DEX:1, AGI:1, WIL:0 }`（硬派肉搏向）
- 這決定每日在場背景人員的屬性分佈 → 間接逼玩家練什麼

**架構關鍵點**：
- 公式在 [main.js](../main.js) `doAction` 的 D.18 區塊計算
- 最終組合後透過 `Effects.apply(..., { moodMult, synergyMult: finalMult })` 傳給 dispatcher
- dispatcher 對 `type: 'attr'` 和 `type: 'exp'` 都套用 synergyMult（修正 D.6 v2 遷移遺漏）
- 背景角鬥士熟悉度存檔於 `save.backgroundGladiators`

**預留接口（Phase 2 實作）**：
- `_getFacilityBonusMult()` — 訓練所加成（暫 1.0）
- `_getTrainingEquipmentMult()` — 訓練場裝備等級（暫 1.0）
- `_getItemBonusPct()` — 護符/特性/屬性/寵物加成總和（暫 0）

---

## 4. 世界觀系統（未來擴充）

### 4.1 訓練所差異化系統 3)（D.16）

> **Phase 2 S2 實作**。未來遊戲深度的關鍵。

**核心哲學**：每個訓練所是「不同的人生」，不是難度條。**破訓練所必須藏顆珍珠**。

**四個訓練所草案**：

| 訓練所 | 核心主題 | 屬性上限偏好 | 食物 | 專屬 NPC |
|--------|---------|-------------|------|---------|
| **鐵獄** | 放任、藏著傳奇 | WIL+3 LUK+2 STR-2 | 貧乏 | 退役魔神訓練官 |
| **鷹之營** | 斯巴達紀律 | STR+2 CON+2 AGI-2 | 充足 | 百夫長教官 |
| **標準訓練所**（目前） | 均衡生存 | 無修正 | 中等 | 監督官 Valerius（待實作） |
| **安佩拉宅邸** | 貴族娛樂 | WIL+2 LUK+2 CON-2 | 豐盛 | 占卜師 + 主人女兒 + 詩人 |

**資料結構範例**：
```js
ironCage: {
  attrCapMod:      { STR:-2, DEX:-1, WIL:+3, LUK:+2 },
  trainingExpMult: { STR: 0.8, WIL: 1.3, LUK: 1.2 },
  mealGains: {
    breakfast: { base: 12, aff30: 18, aff60: 24 },
    lunch:     { base: 12, aff30: 18, aff60: 24 },
    dinner:    { base: 14, aff30: 20, aff60: 26 },
  },
  sleepFoodCost:    -10,
  uniqueNpcs:       ['retired_legend_grax'],
  masterPreference: null,
  rumors: ['聽說鐵獄藏了個老傢伙，徒手殺過十幾個人。'],
}
```

**開局流程**（Phase 2 S2 第一版）：
- 鎖死在標準訓練所
- 通過謠言（§ 4.2）漸進解鎖其他訓練所的「認知」
- 解鎖 4 階段：`???` → 名字 → 剪影描述 → 親眼見過
- **第一次通關後**永久開放全部選擇

**屬性上限系統**：
```js
function getAttrCap(attr) {
  const base = 30;
  const facility = player.facility && FACILITIES[player.facility];
  const facMod = facility ? (facility.attrCapMod?.[attr] || 0) : 0;
  return base + facMod;
}
```

**標準訓練所範本化**：需補 Valerius 訓練官（穩健派）+ masterArtus 偏好 CON + 全屬性訓練 EXP ×1.05 + 新人教程獨特事件

### 4.2 謠言系統（D.17）

> **Phase 2 中期實作**。世界觀網絡的第二把鑰匙。

**目的**：
- 世界活起來（就算沒離開訓練所也知道外面在發生事）
- 伏筆機制 + 內容解鎖鑰匙
- NPC 社交深度 + 任務入口倉庫

**資料結構**：
```js
const RUMORS = {
  ironCage_legend: {
    text:    '聽說鐵獄藏了個老傢伙，徒手殺過十幾個人。',
    category:'facility',
    sources: ['market', 'guard', 'teammate'],
    minDay:  10,
    unlocks: [
      { heardCount: 1, effect: 'reveal_silhouette', target: 'ironCage' },
      { heardCount: 3, effect: 'reveal_name',       target: 'ironCage' },
      { heardCount: 5, flag:   'can_request_visit_ironCage' },
    ],
  },
};

Stats.player.heardRumors = { ironCage_legend: 2, ... };
```

**六種觸發通道**：
1. 市集跑腿（errand）
2. 訓練時隊友閒聊（5% per action）
3. 護衛抱怨（meal event 附加）
4. 梅拉主動對話（好感 ≥50）
5. 夢境（D.13 睡前獨自沉思）
6. 新 NPC 加入時帶來外部消息

**完整範例鏈（梅拉的姪子）**：
1. Day 20+ 市集跑腿：「梅拉老鄉村子被燒光」
2. 梅拉好感 ≥50：「她的姪子被賣為奴」
3. 梅拉拜託你幫忙打聽
4. 主人派你送信到鐵獄 → 發現新奴隸名字相符
5. 帶回消息 → 梅拉好感 +30 → 姪子加入訓練所

**一條鏈串起：謠言 → 好感 → 任務 → 橋接事件 → 新 NPC**

### 4.3 故事道具網路（D.14）

> **Phase 2 初期實作**（與 D.12 閉環）。

**原則**：
1. 獨特道具 = 故事鑰匙，不可交易、不可複製
2. 其他 NPC 能「看到」身上的道具（`requireItemTag`）
3. 一個道具觸發多條故事線
4. 道具不只是 buff，是敘事錨點

**範例：馬可的符牌** `marcoCharm`：
```js
marcoCharm: {
  id: 'marcoCharm', name: '磨損的符牌', type: 'amulet', rarity: 'unique',
  desc: '邊角磨得發亮。背面刻著「馬可」兩個字——不是你的名字。',
  eqBonus: { WIL: +2, mood: +3 },
  storyTag: 'marco_charm',
  acquiredBy: 'cassius_charm_touch',
}
```

**可觸發的 NPC 反應**：
- 梅拉（好感 60+）：「那個名字也愛吃這口粥」
- 葛拉（拿武器來修）：「這符牌我打過五次」
- 旅行商人（Phase 3）：「這東西在北邊是喪禮信物」
- 宗教 NPC（Phase 3 E8）：要求歸還或摧毀

### 4.4 天氣與季節（Phase 3 E3 規劃）

4 季節：春夏秋冬，每季影響訓練效率、事件觸發、疾病機率。  
天氣：晴/陰/雨/暴雨/酷熱 5 種。  
詳細設計見 `HISTORY.md`（從 legacy 遷移）。

### 4.5 世界狀態系統（Phase 2 S4 規劃）

6 種：和平 / 戰亂期 / 瘟疫 / 慶典 / 饑荒 / 叛亂。  
影響食物供應、NPC 情緒、特殊事件。  
詳細設計見 `HISTORY.md`（從 legacy 遷移）。

---

## 5. UI 規範

### 5.1 人物面板（`#modal-detail`）4)

**結構**：
- Header：立繪（姓名前兩字 fallback）+ 名字 + 關係圖按鈕 + 副標（origin / facility / day / 世界）+ 名聲條
- 6 個 tab：角色 / 技能 / 關係圖 / 成就 / 百科 / 任務

**角色 tab 版面**（40% / 40% / 20% 三欄）：
- 左欄：屬性（六角形 SVG 雷達圖）+ 派生屬性 5×2 格子 + 屬性升級區（EXP 條）
- 中欄：裝備 6 槽 + 人物特質（traits / scars / ailments）+ 技能
- 右欄：資源 + 護符 6 格 + 寵物 3 槽 + 當前狀態

**技能 tab**：六屬性 EXP 總覽 + 技能卡片網格（可購買 / 已學會 / 鎖定）

**關係圖 tab**：2 欄卡片，每張依 9 層好感色分層背景，顯示名字 + 層級 + flavor 文字（`line-clamp: 2`）

### 5.2 Stage 場景/動畫層

**容器**：`#scene-view`（未來 rename 為 `#stage`）  
**子層**：
- 背景 bg class（`.bg-std-training`）
- 水印（場景名字）
- 隊友頂部欄位 + 觀眾底部欄位
- `#stage-center`（舞台中央，特效）
- `#stage-curtain-top/-bot`（Stage.playSleep 的閉眼黑幕）
- `#stage-zzz`（zzz 動畫）
- `#stage-opening`（開場敘述/事件文字 overlay）

### 5.3 ChoiceModal（`#modal-choice`）

**資料形式**：
```js
{
  id, title, icon, body, forced,
  choices: [
    {
      id, label, hint,
      requireTrait / requireAnyTrait / requireOrigin / requireMinAttr / requireFlag / requireAffection,
      effects: [...],  // 或 rolls: [{ weight, effects, log }]
      flagSet,
      resultLog,
    }
  ]
}
```

**API**：`ChoiceModal.show(eventData, { onChoose })`

**目前事件**：
- `hunger_critical`（4 選項：忍著 / 乞食 / 偷竊 / 鐵意志專屬「用意志壓下飢餓」）
- 食物 ≤14 自動觸發（`_checkHungerCritical`），每日一次

### 5.4 開場流程

```
主畫面（新遊戲）
   ↓
modal-name（輸入姓名）
   ↓
confirmName()
   ↓
modal-origin（2 可選卡片 + 2 鎖定）
   ↓
confirmOrigin()
   ↓ Stats.applyOrigin(id)
Stage.playOpening([...])  ← 黑幕 + 逐行淡入敘述 + 掀眼
   ↓
_enterNewGame() → rollNPCs + log + save + render
```

---

## 6. 開發規範

### 6.1 跨系統整合檢查清單 5)（D.15）

> **實作前必跑的 8 題**。解決 emergent design 的「事後補充」困擾。

當你要加**新事件、動作、NPC、物品、特性、選項**時，依序問：

1. **好感度連動** — 會改哪個 NPC 的好感？有好感門檻嗎？
2. **特性共鳴** — 有哪個玩家特性該觸發不同結果？
3. **故事揭露連動** — 會解鎖 storyReveal 嗎？
4. **資源/物品流動** — 給/花 EXP、金錢、護符、SP？給的東西有 storyTag 嗎？
5. **Stage 演出需求** — 需要 `Stage.playEvent` 小過場，還是純 log？重要事件要 flash。
6. **Origin 差異化** — 不同背景應該看到不同內容嗎？明確表態「不適用」也要。
7. **觸發頻率** — onceOnly / 每日 / 每週 / 機率觸發？
8. **旗標與後續鉤子** — 需 `Flags.set(...)` 讓未來系統檢查嗎？

**明確表態原則**：對每一題主動回答「是 / 否 / 先不做」，不要跳過不講。

### 6.2 敘述文字長度約定

**storyReveals 的 flavor 文字**：
- 理想：**25~45 字**
- 極限：55 字（超過被 `line-clamp: 2` 截斷）
- 原則：只描述觀察，不解釋意義（留腦補空間給玩家）

### 6.3 字體與色彩約定

- **字體不小於 14px**（整個角色頁已調校過，不要再回到小字）
- **文字色**：`--text-hi`（亮）/ `--text`（中）/ `--text-dim`（暗，少用）
- **金色**：`--gold-lt`（突出數字）
- **血紅**：`--blood`（負面 / 警告）
- **紫色**：正向好感 bar
- **重要事件**用 `addLog(text, color, italic, flash=true)` 金色脈動提示

### 6.4 「不要做」清單

1. **不要自動做主動 NPC 互動**（違反 Phase 1 哲學）
2. **訓練動作不要用 `type: 'attr'`**（改用 `type: 'exp'`）
3. **不要加 hover-only 的隱藏資訊**（手機不友善）
4. **不要創新 UI 元件**，優先使用既有 class
5. **不要跳過整合檢查清單**
6. **不要讀全 DESIGN.md**（用 grep 精準查）
7. **不要用 `--no-verify` 跳過 commit hook**
8. **不要自動 `git push`**（除非使用者明確說要推）
9. **不要加 emoji 到代碼**（除非使用者明確要求）
10. **不要建立 documentation 檔案**（DESIGN / CLAUDE / changelog / NOTES / HISTORY 已足夠）

---

## 7. 設計哲學

### 7.1 奴隸沒有自主權（Phase 1 核心）

**宣言**：角鬥士題材的核心不是「變強」，是「在沒有選擇的處境裡找到意義」。

**對照**：

| 傳統 RPG | 本作 |
|---------|------|
| 玩家主動找 NPC 聊天 | NPC 主動注意你（NPC Notice） |
| 玩家自由移動到別的場地 | 主人/長官傳喚才能離開 |
| 玩家自由花錢買東西 | 金錢由主人賞賜，跑腿事件使用 |
| 玩家主動切磋隊友 | 隊友依好感主動邀請 |

**為什麼**：這樣的設計讓**每一次「可以選擇的事情」都變得珍貴**。玩家只能選訓練項目、rest、未來睡前活動——但正因為選擇少，每個選擇都有重量。

### 7.2 不預告未來（故事揭露哲學）

**原則**：「他凝視西邊的牆」比「他懷念死去的戰友」強十倍。

- **只描述觀察，不解釋意義**
- **不顯示精確數字**：「好感 23」→「認識」
- **不預告未來**：不說「再 +10 好感就能看到特性」
- **給方向感**：「他似乎還有話沒說完」

**應用**：storyReveals flavor 都遵循此原則，未來對話系統也是。

### 7.3 刻意錯過 vs 保底

**決策**：本作**不做「保底」**。讓選擇有真正的代價。

**理由**：
- 不可錯過 = 每個選擇都重要 = 重玩動機
- 保底 = 選擇被稀釋 = 玩家失去「我錯過了什麼」的遺憾感

**但提供橋接通道**讓被封死的內容能被聽到、讀到、傳說到：
1. **主人傳喚送信** — 有機會短暫造訪其他訓練所
2. **謠言系統** — 聽得到但看不到
3. **跨訓練所賽事** — Day 30/60/90 大型會面

### 7.4 窮中有寶（訓練所差異化原則）

**破訓練所不是難度條，是「不同的人生」**。每個訓練所都有別處拿不到的東西：

- 鐵獄：退役魔神訓練官 + WIL 上限 +3
- 鷹之營：STR 訓練 +50% + 斯巴達紀律
- 貴族宅邸：占卜師 + 主人女兒可能教你技能
- 標準訓練所：均衡是特色，適合新手 + 完整 NPC 陣容

**玩家的選擇是「我想成為什麼樣的角鬥士」，不是「難度高低」**。

---

## 8. 內容創作模板 → 獨立文件

> **完整模板見 `docs/CONTENT-TEMPLATES.md`**（原 D.11 內容，第二輪重構時遷移過去）

涵蓋：新 NPC / 新事件 / 新任務 / 新武器 / 新背景 / 新訓練所 / 新寵物 / 新特性 / 新天氣 / 新世界狀態 / 新宗教 / 新絕招

---

## 9. 未來路線圖（精簡版）

完整狀態見頂部「進度總表」。下面只列高層目標：

### Phase 2（核心系統）
- **S1** 擴充 origins 到 4 個
- **S2** 訓練所差異化（§ 4.1）
- **S3** NPC 原型與成長曲線
- **S4** 世界狀態系統（§ 4.5）
- **S5** 結局判定器
- **S6** 多維度命運抽取 UI

### Phase 3（擴展系統）
- E1 職業 NPC / E3 天氣季節 / E4 生病醫生 / E5 羈絆 / E6 訓練協同 / E7 派系 / E8 宗教 / E9 裝備深度 / E10 多部位裝備 / E11 個人物品 / E12 仇恨擴展 / E13 寵物 / E14 EXP/Tier 特性 / E15 人物介面階段 C / E16 音效內容

### Phase 4（內容系統）
- C1 疤痕 / C2 夢境 / C3 謠言情報 / C4 婚姻 / C5 酒與藥物 / C6 寫信 / C7 戰爭徵召 / C8 暗殺 Nemesis / C9 3v3 / C10~C16 後期體驗

### Phase 5 美術資產
### Phase 6 手機適配

---

## 📁 附錄 B：已廢棄的設計決定

> 下面這些曾經被認真設計過，但後來被其他方案取代或放棄。保留備忘以免重蹈。

1. **SP（技能點）系統** → 被 **D.6 v2 EXP 單一資源模型**取代。原本設計 SP 從屬性升級獲得、用來買特性，但跟 EXP 功能重疊。現在 EXP 同時負責升屬性 + 買技能（`expCosts`）。
2. **多場景切換系統** → **Phase 1-J** 場地系統極簡化，訓練場成為唯一場景，其他場景的功能改為事件/敘事描述。
3. **房間品質場景切換**（dirtyCell / basicRoom / luxuryRoom）→ 改為**休息/過夜事件的敘事描述**，依名聲閾值呈現（≥60 豪華 / ≥20 簡單 / 否則骯髒）。
4. **左欄 NPC 主動互動動作**（chat_* / visitOfficer / visitMaster / helpCook / stealFood 等）→ **Phase 1-A** 全部改為事件觸發（hiddenFromList），玩家不能主動發起。
5. **hover-only UI 設計**（滑鼠懸停才看到內容） → 放棄。手機不友善，而且讓玩家覺得在「打 UI 工」而非「發現故事」。
6. **重量訓練** `heavyLift` 動作 → 刪除。與 `basicSwing` 功能重疊，Phase 1-J.2 訓練動作整理時移除。
7. **D.10 原始整合優先度表** → 被**頂部進度總表**取代。原表按 Part A/B/C/D 分類，但 prone to drift，現在統一由頂部表追蹤。
8. **D.1 修復審計** → 15 項問題全部修好（Phase 0 完成），歷史清單移到 `HISTORY.md`。

---

## 📁 附錄 C：開放問題（待討論）

> 下面是目前還沒決定的事。等需要時再拉出來討論。

- **訓練所解鎖後是否提供「轉移」機制**？（玩家通關後能選別的訓練所起手 vs 只能從謠言解鎖）
- **marcoCharm 之外的故事道具**要用哪幾個 NPC 的故事？梅拉還是葛拉？
- **謠言系統的 UI 放在哪**？關係圖 tab 加子區 vs 獨立「耳聞」tab
- **主人屬性偏好影響的具體公式**？例如「偏好 STR」是對 STR 訓練加 10% 好感，還是好感門檻不同？
- **競技場的 100 日終戰設計**—— 每個 origin 看到的終戰敘述不同？結局分歧如何呈現？
- **中後期難度曲線**—— 玩家 level 50+ 時怎麼保持挑戰性？

---

## 備註

1) **戰鬥系統詳細規格**（ATB tick 公式、swingTime 定義、評分表、技能條雙門檻、砍首流程、雙槽路線判定）完整規格見 `HISTORY.md` 的「戰鬥系統歷史規格」章節，或直接看 `testbattle.js` / `battle.js` 代碼（最終事實源）。

2) **故事揭露系統**的完整 check list（四階段實作步驟、新特性列表）：現階段 D.12 已完成第一、二階段（卡西烏斯範本 + 事件掃描器），剩下第三、四、五階段（道具層 / 其他 NPC / 新特性）見 TO DO / CHECK LIST。

3) **訓練所差異化系統**的完整 check list（資料層 / 開局 UI / 擴充 / 範本化）：現階段設計定案、尚未實作，完整步驟見 `HISTORY.md` 設計紀錄或 legacy 文件。

4) **人物面板的完整驗收清單**（階段 A 22/23 + 階段 B 所有區塊詳細檢核）：見 legacy 文件 D.7.B.9 章節，或直接測試代碼。

5) **D.15 整合檢查清單的使用範例**：errand 事件當初漏了「好感連動」和「origin 差異化」兩題，2026-04-15 發現後補上主人好感 +2~3，這是清單第一次應用。

---

**本計畫書的使用者**：Claude Code（自動讀取）、使用者本人、未來協作者。**更新責任**：Claude Code 在完成新功能後主動提醒使用者更新相應章節。
