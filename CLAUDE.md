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

1. **`DESIGN.md`** — 所有設計決策的單一真相源 (2026-04-15 重構後 ~800 行，可完整讀)
   - 頂部有 **📊 實作進度總表**（這是**進度的唯一事實源**）
   - 頂部有 **📋 TO DO / CHECK LIST**（當下開發焦點，每次更新）
   - 頂部有 **🎯 TL;DR**（新協作者 5 分鐘入門）
   - § 1 技術架構 / § 2 遊戲核心系統 / § 3 人物系統 / § 4 世界觀系統
   - § 5 UI 規範 / § 6 開發規範 / § 7 設計哲學 / § 8 內容模板 / § 9 路線圖
   - ⚠️ **「X 做完了嗎」→ 只看頂部進度總表**。其他章節的 checkbox 都是歷史快照。
2. **`HISTORY.md`** — 已實作系統的歷史細節、已廢棄設計的考古紀錄。一般開發不需要讀。
3. **`docs/CONTENT-TEMPLATES.md`** — 新 NPC / 武器 / 訓練所等內容創作模板（原 D.11）。
4. **`changelog.html`** — 版本記錄與歷次 commit 摘要
5. **`NOTES.md`** — 🆕 手機草稿本。使用者會在手機上寫未整理的想法到底部「待整理」區。
   **看到使用者叫你「整理 NOTES.md」時**：讀 NOTES.md → 歸類每個項目（屬於哪個章節）
   → 寫進正式文件 → 清空 NOTES.md 的待整理區（保留頂部使用說明）→ commit。
6. **`memory/MEMORY.md`** — 本機 auto-memory（使用者偏好、回饋）
7. **`DESIGN-legacy.md`**（暫時存在）— 2026-04-15 重構前的完整舊版 DESIGN.md 備份。
   第二輪重構完成後會刪除。遷移期間若發現新 DESIGN.md 漏掉某塊內容，可從這裡補。

---

## ⚠️ 開發習慣（實作前必跑）

### 跨系統整合檢查清單（D.15）

**在提案任何新事件、動作、NPC、物品、特性之前，在回覆中跑一遍這 9 題：**

1. **好感度連動** — 會改動哪個 NPC 的好感？有沒有好感門檻才能觸發？
2. **特性共鳴** — 有沒有哪個玩家特性應該觸發不同結果？
3. **故事揭露連動** — 會解鎖哪個 NPC 的 storyReveal？
4. **資源/物品流動** — 給/花 EXP、金錢、護符、個人物品、SP？給的東西有 storyTag 嗎？
5. **Stage 演出需求** — 用 `Stage.playEvent` 做小過場？還是純 log + flash？
6. **Origin 差異化** — 貴族跟農家子弟看到的內容應該不同嗎？
7. **觸發頻率** — onceOnly / 每日 / 每週 / 機率 / 永久常駐？
8. **旗標與後續鉤子** — 需要 `Flags.set(...)` 讓未來系統讀嗎？
9. **🆕 道德軸驅動（D.19）** — 有沒有道德意涵？要觸發哪個軸（reliability/mercy/loyalty/pride/patience）？weight:1 還是 weight:3？

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
  - 支援 type: vital / attr / exp / money / fame / affection / sp / flag / moral / ...
  - 透過 `Effects.apply(effects, ctx)` 統一派發
- **D.19 道德軸寫法**（有道德意涵的事件/選項都要接上）：
  - `{ type:'moral', axis:'reliability', side:'positive', weight:1 }`
  - 5 軸：reliability / mercy / loyalty / pride / patience
  - weight:1 一般 / weight:3 關鍵事件一次定型 / lock:true 極少用
  - 詳見 [docs/CONTENT-TEMPLATES.md](docs/CONTENT-TEMPLATES.md) 的快速查表
- **D.19 NPC 愛憎**：所有 NPC 都要有 `likedTraits` / `dislikedTraits`（強度 1~3）
  - 即使空 `{}` 也要明示，不能省略
  - 好感變動自動乘愛憎倍率（淨分 ±3 → ×1.5~×0.3）
  - 在 `teammates.modAffection` 內部統一處理

### 模組相依
載入順序（見 game.html bottom）：
```
config → stage → choice_modal → flags → origins → i18n → game_state → sound →
day_cycle → effect_dispatcher → stats → moral → fields → npc →
background_gladiators → orlan_events → events → item → weapons → armors → enemy →
train → skill → ending → save_system → testbattle → battle → actions → main
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
7. **新增命名 NPC 時，主動提醒使用者「favoredAttr 還沒定嗎？」**
   （D.18：命名 NPC 需要 `favoredAttr` 決定訓練協力屬性偏好；故事向 NPC 可先填 null，但要明示）
8. **新增命名 NPC 時，同時主動提醒「likedTraits / dislikedTraits 要怎麼設？」**
   （D.19：每個 NPC 都必須有愛憎欄位，即使空 `{}` 也要明示；這是角色設計的靈魂
   — 沒有愛憎的 NPC 等於沒有個性觀點。參考 `officer` 的寫法。）

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
- **changelog.html**：每次功能/修正的歷史紀錄。**每次中型以上改動都要自動補上**
  （新系統 / 新模組 / 新事件 / UI 重構 / 平衡調整等）。
  - 格式參考最近的版本區塊（`.version-block` → tag / title / date / change-list）
  - 徽章：`badge-new` / `badge-fix` / `badge-ui` / `badge-data` / `badge-system`
  - AI 主動規則：commit 前如果發現有**新模組、新系統、新事件池、或跨多檔案的平衡調整**，
    不用等使用者說，自己開新 version-block 補上去。只有純注釋 / 文字微調可以省略。
- **CHANGELOG.md**：keep-a-changelog 格式，目前較少用，主要版本標記用。
- **memory/MEMORY.md**：auto-memory 索引。不手動編輯。

---

## 🔄 最近重要變更

- **2026-04-16**：D.20 奧蘭主線 — 永駐兄弟完整四幕（10 storyReveals + 偷藥/分房/訣別三大事件 + 生死援手）
- **2026-04-16**：D.19 道德累積特性系統（10 earned traits + 滑動窗口 + NPC 愛憎倍率 + 戰鬥 mercy 軸）
- **2026-04-16**：D.18 訓練協力 v2（屬性偏好 + 背景角鬥士池 + favorWeight + 碎念/八卦系統）
- **2026-04-15**：D.12 NPC 故事揭露系統上線（卡西烏斯為範本）
- **2026-04-14**：D.6 v2 EXP 單一資源模型、技能購買系統、整數化全部
- **2026-04-13**：D.7 階段 B 人物面板重構（兩欄、六角形、EXP 條）+ Phase 1-J 場地極簡化
