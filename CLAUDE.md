# 百日萬骸祭 · 專案開發筆記

> 這份文件由 Claude Code 在**每個新對話 session 啟動時自動讀取**。
> 記錄專案的核心約定、開發習慣、設計哲學，確保跨電腦/跨 session 的一致性。
> 新的慣例出現時應該**主動提醒使用者「這應該記進 CLAUDE.md」**。

---

## 🎮 專案類型

瀏覽器端 vanilla JS 角鬥士 RPG，使用繁體中文敘述。
- **無框架**（不用 React/Vue/等），純 HTML + CSS + JS
- 所有模組都用 **IIFE 寫法**：`const X = (() => { ...; return { ... }; })();`
- 遊戲入口：`game.html`，相依模組透過 `<script src=>` 順序載入
- 存檔使用 localStorage，schema v5

---

## 📚 重要文件讀取順序

1. **`DESIGN.md`** — 所有設計決策的單一真相源（6000+ 行，**不要全讀**，用 grep 查需要的段落）
   - 頂部有 **📊 實作進度總表**（這是進度的唯一事實源）
   - **D.12** NPC 故事揭露系統
   - **D.13** 睡前時段互動設計
   - **D.14** 故事道具網路
   - **D.15** ⚠️ **跨系統整合檢查清單**（實作前必讀）
   - **D.16** 訓練所差異化系統（Phase 2 S2 待實作 — 核心：破訓練所也要藏珍珠）
   - **D.17** 謠言系統（Phase 2 待實作 — 世界觀網絡的第二把鑰匙）
2. **`changelog.html`** — 版本記錄與歷次 commit 摘要
3. **`NOTES.md`** — 🆕 手機草稿本。使用者會在手機上寫未整理的想法到底部「待整理」區。
   **看到使用者叫你「整理 NOTES.md」時**：讀 NOTES.md → 歸類每個項目（屬於哪個 D.x 章節/CLAUDE.md）
   → 寫進正式文件 → 清空 NOTES.md 的待整理區（保留頂部使用說明）→ commit。
4. **`memory/MEMORY.md`** — 本機 auto-memory（使用者偏好、回饋）

---

## ⚠️ 開發習慣（實作前必跑）

### 跨系統整合檢查清單（D.15）

**在提案任何新事件、動作、NPC、物品、特性之前，在回覆中跑一遍這 8 題：**

1. **好感度連動** — 會改動哪個 NPC 的好感？有沒有好感門檻才能觸發？
2. **特性共鳴** — 有沒有哪個玩家特性應該觸發不同結果？
3. **故事揭露連動** — 會解鎖哪個 NPC 的 storyReveal？
4. **資源/物品流動** — 給/花 EXP、金錢、護符、個人物品、SP？給的東西有 storyTag 嗎？
5. **Stage 演出需求** — 用 `Stage.playEvent` 做小過場？還是純 log + flash？
6. **Origin 差異化** — 貴族跟農家子弟看到的內容應該不同嗎？
7. **觸發頻率** — onceOnly / 每日 / 每週 / 機率 / 永久常駐？
8. **旗標與後續鉤子** — 需要 `Flags.set(...)` 讓未來系統讀嗎？

**明確表態原則**：對每一題要主動回答「有 / 沒有 / 先不做」，不要跳過不講。

如果使用者說「**檢查整合清單**」，重新跑一遍 8 題。

---

## 🧠 技術核心約定

### 資料與型別
- **所有 vital（HP/stamina/food/mood）與屬性（STR/DEX/...）強制整數**
  - `Stats.modVital` 和 `Stats.modAttr` 內部自動 `Math.round`
  - `Stats.eff(attr)` 回傳值也是整數
  - 任何繞過這些函式的直接寫入必須自己 round
- **EXP 單一資源模型**（無 SP 系統）
  - 訓練動作用 `type: 'exp'`，不是 `'attr'`
  - 升屬性手動花 EXP（`Stats.spendExpOnAttr`）
  - 未來技能購買也花 EXP（`requireItemTag` + `expCosts`）
- **effects 陣列統一格式**：`{ type, key, delta, ... }`
  - 支援 type: vital / attr / exp / money / fame / affection / sp
  - 透過 `Effects.apply(effects, ctx)` 統一派發

### 模組相依
載入順序（見 game.html bottom）：
```
config → stage → flags → origins → i18n → game_state → sound →
day_cycle → effect_dispatcher → stats → fields → npc → events →
item → weapons → armors → enemy → train → skill → ending →
save_system → testbattle → battle → actions → main
```
新增模組要注意放在依賴它的模組之前。

### 場景架構
- **訓練場是唯一場景**（Phase 1-J 重構後）
- `#scene-view` = Stage 中央動畫層，後續可能 rename 為 `#stage`
- `Stage` 模組處理所有**轉場動畫**：閉眼/開眼/事件小過場/開場敘述
- 關鍵 API：
  - `Stage.playSleep({ sleepType, onBlack })` — 就寢動畫
  - `Stage.playEvent({ title, icon, lines, color })` — 通用事件小過場
  - `Stage.playOpening(lines, onBlack)` — 新遊戲開場敘述

### Flag / State 寫入
- 劇情旗標：`Flags.set('story_xxx', true)` / `Flags.has('story_xxx')`
- Session state：`GameState.setX() / getX()`
- 玩家資料：`Stats.player.xxx`（盡量走 `mod*` 函式）

---

## 🎭 設計哲學

### 敘事哲學
- **「不預告未來，只給方向感」**（D.12 故事揭露原則）
  - 卡片 flavor 只描述觀察，不解釋含意
  - 暗示比明示強，留給玩家腦補
- **特性 = 故事鑰匙**
  - 負面特性（神經質/失眠症）反而能觸發共鳴事件
  - 故事不是每個玩家都能看到，靠特性組合解鎖
- **道具 = 會旅行的故事觸發器**（D.14）
  - 獨特道具有 `storyTag`，其他 NPC 用 `requireItemTag` 檢查
  - 一個符牌串起五條故事線

### Phase 1 核心哲學：奴隸沒有主動權
- **不做**主動找 NPC 聊天、主動拜訪權威、主動離開訓練場
- **所有 NPC 互動改為事件觸發**：主人/長官傳喚、隊友邀請切磋、梅拉塞食物等
- 玩家只能選：訓練 / 休息 / 冥想 / 等事件發生

### UI 哲學
- **重要事件用 `addLog(..., true, true)` flash 提示**(第 4 參數)
- **重大演出用 `Stage.playEvent()`**,不只是 log
- **不加 hover-only 隱藏資訊**（手機不友善）
- **卡片色系依好感分層**（9 層：loyal → nemesis）
- **字體不小於 14px**（整個角色頁已調校過，不要再回到小字）
- **關係圖 storyReveals flavor 文字控制在 25~45 字**（理想），上限 55 字
  （超過會被 `line-clamp: 2` 截斷）→ 詳見 DESIGN.md D.12「📏 Flavor 文字長度約定」

---

## 🚫 「不要做」清單

1. **不要自動做主動 NPC 互動**（違反 Phase 1 哲學）
2. **不要在訓練動作裡用 `type: 'attr'`**（改用 `type: 'exp'`）
3. **不要加 hover-only 的隱藏資訊**（手機不友善）
4. **不要創新 UI 元件**，優先使用既有的 class
5. **不要跳過整合檢查清單**（D.15 的 8 題）
6. **不要讀全 DESIGN.md**（6000+ 行會塞爆 context，用 grep 精準查）
7. **不要用 `--no-verify` 跳過 commit hook**
8. **不要自動 `git push`**（除非使用者明確說要推）
9. **不要加 emoji 到代碼**（除非使用者明確要求或是既有 convention）
10. **不要建立 documentation 檔案**（除非使用者要求；DESIGN.md / CLAUDE.md / changelog.html 例外）

---

## 🤖 AI 的主動提醒職責

### 應該主動提出的情況

當發現以下任一情況，**主動建議使用者記進 CLAUDE.md 或 DESIGN.md**：

1. **新的技術決策**（例如「以後 vital 都要整數」「所有訓練用 exp type」）
2. **新的設計模式**（例如「特性當故事鑰匙」「道具當故事錨點」）
3. **被使用者糾正過 2 次以上的同一件事**（代表這是長期偏好）
4. **新的 UI 約定**（例如字體大小、色系分層、動畫節奏）
5. **新的「不要做」規則**（例如「不要用 hover」）
6. **跨系統整合發現**（新的整合點應該加進 D.15 清單）

### 應該問使用者的情況

1. 實作牽涉修改既有風格 → 先問「這個改動要不要沿用到其他地方」
2. 加新的全域命名 → 先問「這個 ID/class 名稱你有偏好嗎」
3. 發現 DESIGN.md 有矛盾 → 先問「哪一個是對的」

---

## 🔧 Commit 與同步

- 使用者跨電腦開發 → 頻繁 git commit + push
- 提示使用者 commit 時機：
  - 完成一個完整功能
  - 通過驗收測試後
  - 跨 session / 跨電腦切換前
- commit message 用繁體中文 + 語意化前綴（`feat(Phase1-X):` / `fix(...)`/ `docs(...)`）

---

## 📝 文件更新規則

- **CLAUDE.md**（本檔）：長期穩定的約定與習慣。更新頻率低，穩定度高。
- **DESIGN.md**：設計規格與決策。更新頻率中。
- **changelog.html**：每次功能/修正的歷史紀錄。每次 commit 都要加一條。
- **memory/MEMORY.md**：auto-memory 索引。不手動編輯。

---

## 🔄 最近重要變更

- **2026-04-15**：D.12 NPC 故事揭露系統上線（卡西烏斯為範本）
- **2026-04-14**：D.6 v2 EXP 單一資源模型、技能購買系統、整數化全部
- **2026-04-13**：D.7 階段 B 人物面板重構（兩欄、六角形、EXP 條）+ Phase 1-J 場地極簡化
