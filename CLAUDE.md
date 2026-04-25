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
3-0. **`docs/CODEX.md`** — 🆕 **完整字典（2026-04-19）**：特性/書本/origin/傷勢/見識/旗標/數字速查表一份搞定。查「某個特性效果是什麼」「某本書門檻多少」「某 flag 做什麼用」先看這份。
3-0b. **`docs/CANON.md`** — 🆕 **故事事實單一事實源（2026-04-19）**：時間線、角色年齡、誰知道什麼、關係歷史。**寫新對白/事件前必查**。跟 CODEX 分工：CODEX 存規則，CANON 存事實。
3a. **`docs/DIALOGUE-MAP.md`** — 🆕 D.28：**對白位置總索引**。查某段對白在哪裡先看這份。
3a1. **`docs/characters/*.md`** — 🆕 D.28：每個 NPC 的完整檔案（愛憎 / 對話風格 / 特性反應 / 招牌動作 / 程式碼指標）
   - 目前已建：orlan / melaKook / cassius / hector / doctorMo / officer / masterArtus / sol
   - 🆕 **livia**（主人娘，Phase 2/3 登場）/ **marcus**（少爺，Phase 2 登場）
   - 改 NPC 對白先看這份，確保語氣一致
3b. **`docs/quests/*.md`** — 🆕 D.28：每個任務的完整設計書（觸發 / 階段 / 門檻 / 對白 / 獎勵 / flag）
   - 目前已建：mela-rat / day1-opening / **day5-sand-wash**（2026-04-19）/ **blood-feast**（2026-04-20，Day 49 血戰宴會）
3c. **`docs/systems/*.md`** — 🆕 D.28：系統規範（night-events, multi-check-quest, **reading**, **books-catalog**, **wounds**, **compulsion**, traits, origins, timeline, battle-*, npc-growth）
   - 🆕 **reading.md / books-catalog.md**（2026-04-19）：讀書系統 + 五類書本 + 見識數值 + 傻福三階段交互
   - 🆕 **wounds.md**（2026-04-19）：4 部位 × 3 級傷勢系統 + 低體力擲傷 + 好痛觸發 + 老默三階段 → 密醫引薦
   - 🆕 **fervor.md**（2026-04-22 設計 / 2026-04-24 實作）：4 種訓練狂熱（力/敏/耐/禪）+ 自然觸發（5 天 8 次）/ 瓶頸儀式（20/30/.../100）+ 5 次結束。**取代舊 compulsion.md**
   - 🗑️ **compulsion.md**：已廢棄（設計原稿保留為歷史紀錄），實作改為 Fervor
   - 🆕 **origin-design-spec.md**（2026-04-19）：**新增 origin 必看** — 完整欄位 / statMod 平衡 / 起手書原則 / 被抓損失 / 受傷權重 / 回憶對白矩陣 / 未來擴充（起手技能 + 專屬事件）/ 檢查清單
   - 🆕 **mansion-geography.md**（2026-04-19）：大宅地理 — 主人家 + 訓練場**同座建築**，正門/側門/共用中段
   - 🆕 **master-family-spec.md**（2026-04-19）：訓練所家庭通用規範 — archetype 模板，每個訓練所 = 一個家族故事
   - 🆕 **found-family.md**（2026-04-19）：新家人系統 — NPC 以家人稱呼確認關係的儀式（奧蘭=兄弟/梅拉=母/卡西烏斯=師⋯）
   - 🆕 **ending-presentation.md**（2026-04-19）：結局呈現系統 — 四幕結構（競技場/他們眼中/你成為了誰/多年後）+ 5 軸線組合 + 隱藏第五幕 + 文字風格規範。Disco Elysium 級敘事哲學。
3d. **`docs/philosophy/*.md`** — 🆕 D.28：設計哲學（numbers-hiding）
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

## 📖 術語字典（命名權威）

> **新增命名前先查這張表**。如果表裡已有對應概念，用表裡的名字。
> 實作前 `grep` 確認 codebase 中既有的命名。不要自己造新詞。

| 概念（中文） | 程式碼 ID / 欄位名 | 所在檔案 |
|---|---|---|
| 屬性偏好 | `favoredAttr` | npc.js, fields.js |
| 訓練所權重 | `favorWeight` | fields.js |
| 愛憎特性 | `likedTraits` / `dislikedTraits` | npc.js |
| 道德軸 | `moralAxis` + `moralSide` | config.js, moral.js |
| 滑動窗口 | `player.moralHistory` | moral.js |
| 道德軸推進 | `Moral.push(axis, side, {weight, lock})` | moral.js |
| 背景角鬥士 | `BackgroundGladiators` | background_gladiators.js |
| 熟悉度 | `familiarity`（門檻 40） | background_gladiators.js |
| 碎念 | `getMumble()` | background_gladiators.js |
| 八卦 | `GOSSIP_POOL` / `signatureGossip` | background_gladiators.js |
| 晨思 | `MorningThoughts` | morning_thoughts.js |
| 懸念回收 | `queueResolution(thoughtId)` | morning_thoughts.js |
| 重量級對話 | `DialogueModal.play(lines, opts)` | dialogue_modal.js |
| 輕量對話 | `addLog(text, color, flash, important)` | main.js |
| 故事揭露 | `storyReveals` | npc.js |
| 對話行 | `dialogueLines` (storyReveal 欄位) | npc.js |
| 永駐兄弟 | `orlan` | npc.js, orlan_events.js |
| 醫生 | `doctorMo` | npc.js, doctor_events.js |
| 協力倍率 | `synergyMult` | main.js, effect_dispatcher.js |
| 人多熱鬧 | `crowdMult`（1 + 0.08 × 人數）| main.js |
| 硬上限 | ×15 cap | main.js |
| 關鍵事件權重 | `weight: 3` | moral.js |
| 劇情鎖 | `lock: true` | moral.js |
| 三段協力門檻 | aff ≥ 30/60/90 → ×1.3/1.6/1.8 | main.js |
| 背景單段門檻 | familiarity ≥ 40 → ×1.3 | background_gladiators.js |
| 生死關頭援手 | `OrlanEvents.tryDeathSave()` | orlan_events.js, stats.js |
| 晨起過場 | `Stage.playMorning(opts)` | stage.js |
| 藥房懸念 flag | `saw_olan_at_apothecary` | main.js, morning_thoughts.js |
| 藥房解決 flag | `olan_apothecary_resolved` | npc.js (setFlag) |
| 分房 flag | `separated_from_olan` | orlan_events.js |
| 偷藥替罪 flag | `shared_olans_punishment` | orlan_events.js |
| 告發 flag | `betrayed_olan`（不可逆）| orlan_events.js |
| 🆕 見識 | `player.discernment` | reading.md / books.js（待建）|
| 🆕 書櫃 | `player.bookshelf[]`（上限 5）| reading.md / books.js（待建）|
| 🆕 專心書 | `player.focusBookId` | reading.md |
| 🆕 已讀清單 | `player.readBooks[]` | reading.md |
| 🆕 傻福階段 | `player.dullardStage`（0/1/2）| traits.md 傻福三階段 |
| 🆕 文字書 | 識字本 / 傳記類（推進傻福衰退）| books-catalog.md |
| 🆕 非文字書 | 技能 / 藍圖 / 地圖（不影響傻福）| books-catalog.md |
| 🆕 貪多嚼不爛 | 書櫃 ≥ 3 本未設專心 → 進度 ×0.7 | reading.md |
| 🆕 粗識文字 | 特性 `partialLiterate`（傻福半醒停留）| traits.md |
| 🆕 半醒拒絕 flag | `refused_awakening` | reading.md |
| 🆕 清醒觸發 flag | `dullard_awakened` | reading.md |
| 🆕 傷勢系統 | `player.wounds` | wounds.js |
| 🆕 四部位 | head / torso / arms / legs | wounds.md |
| 🆕 三級嚴重度 | severity:1/2/3（輕/中/重）| wounds.js |
| 🆕 好痛觸發 | `Wounds.checkTrainingPain(attr)` | wounds.js |
| 🆕 低體力擲傷 | `Wounds.rollLowStaminaInjury(attr)` | wounds.js |
| 🆕 傷勢減免 | `Wounds.getAttrPenalty(attr)`（整合到 Stats.eff）| wounds.js, stats.js |
| 🆕 密醫紙條 | `got_black_doc_contact` + personalItem `black_doc_contact` | doctor_events.js |
| 🆕 老默三階段 | `doctor_saw_severe_wound` → `doctor_hinted_black_doc` → `got_black_doc_contact` | doctor_events.js |
| 🆕 自然癒合 flag | `natural_recovery_triggered_{part}` | wounds.js |
| 🆕 狂熱系統 | `player.fervor` / `Fervor.*` | compulsion.js（IIFE 名 Fervor）/ fervor.md |
| 🆕 5 狂熱特性（正面暫時）| STR/DEX/CON/AGI/WIL_fervor — 力量/靈巧/體質/反應/意志狂熱 | config.js / fervor.md |
| 🆕 5 訓練動作名（單一事實源）| 推舉石頭(STR) / 投接碎石(DEX) / 杖擊承受(CON) / 亂棍格擋(AGI) / 打坐冥想(WIL) | actions.js + Fervor.TRAIN_NAME |
| 🆕 大字 POPUP | `Stage.popupBig({icon,title,subtitle,color,sound,shake})` | stage.js |
| 🆕 自然觸發 | 5 天內同屬性訓練 8 次 → 進入狂熱 | `Fervor.onTraining` |
| 🆕 瓶頸觸發 | 屬性升到 20/30/.../100 強制一次狂熱 | `Fervor.checkBreakthroughNeeded` in `Stats.spendExpOnAttr` |
| 🆕 狂熱加成 | 練對 EXP +25% / mood +5 / 練錯 mood -5 + 15% 擺爛 | `Fervor.getExpMultiplier` + `getMoodDelta` + `getSlackChance` |
| 🆕 狂熱結束 | 對應訓練累積 5 次；自然 → 14 天冷卻 / 瓶頸 → `fervor_passed_{attr}_{level}` flag | compulsion.js `_complete` |
| 🗑️ 舊強迫症 | `_addict` 特性 + `player.compulsion` — 已廢棄，存檔自動遷移 | — |

**Flag 命名規範**：`{主題}_{事件}_{狀態}` — 例：`olan_apothecary_resolved`、`doctor_visit_today`、`read_book_<id>`、`knows_blueprint_<id>`

### ⚠️ Debug 工具清單（上線前必須移除或鎖管理員）

> 以下功能僅供開發測試，正式發布前必須全部移除或加 admin flag 門檻。

| 工具 | 位置 | 用途 |
|---|---|---|
| `Game.skipToDay(N)` | main.js（return 區塊內） | Console 輸入跳到指定天數 |
| `Game.testChoice` | main.js | 測試 ChoiceModal |
| **F5 快存 / F9 快讀** | main.js 底部（IIFE 外） | 按鍵快速存讀檔 |
| **`_showGameIntro()`** | main.js（新遊戲流程內） | 測試用遊戲介紹頁，正式版改為官方首頁或移除 |

---

## 🏗️ 已實作系統登記（每次 session 開始前查這裡）

> **在做任何 UI 或功能之前先查這張表。如果已經有了，就用現有的，不要重做。**
> 更新規則：每次做完新系統或 UI，立刻在這裡補一行。

### UI 元件（角色頁）

| 功能 | 位置 | 關鍵函式 / ID | 備註 |
|---|---|---|---|
| **裝備欄位 picker** | main.js | `_renderEquipmentSlots()` / `_openEquipmentPicker()` / `#cs-equip-slots` | 已有主手/副手/胸甲三槽，點擊展開 picker，自動處理雙手武器 |
| **裝備切換** | main.js | `_equipItem(slot, itemId)` | 切換時自動清副手（雙手武器） |
| **裝備 picker 篩選** | main.js | `_getPickerOptions(source)` | weapons 來源只顯示 weaponInventory 裡有的 |
| **六角形屬性圖** | main.js | `_renderHexagon()` / `#cs-hex-svg` | SVG 六角形雷達圖 |
| **派生數值格子** | main.js | `_renderDerivedGrid()` | 10 項派生屬性 |
| **EXP 屬性升級** | main.js | `_renderAttrSpend()` | 花 EXP 升級，有升級鈕 |
| **特性顯示** | main.js | `_renderTraits()` | 空時 display:none |
| **疤痕顯示** | main.js | `_renderScars()` | 空時 display:none |
| **病痛顯示** | main.js | `_renderAilments()` | 空時 display:none |
| **道德光譜** | main.js | `_renderMoralSpectrum()` / `#cs-moral-spectrum` | 5 軸滑動窗口視覺化 |
| **技能列表** | main.js | `_renderSkills()` | passive skills |
| **關係圖 / NPC 卡片** | main.js | `_renderPeopleTab()` | flavor 文字 + 好感度色分 |
| **護符 6 格** | main.js | `_renderAmulets()` | Phase 3 預留，目前空格 |
| **寵物 3 槽** | main.js | `_renderPets()` | Phase 3 預留 |

### UI 元件（主畫面）

| 功能 | 位置 | 關鍵 ID | 備註 |
|---|---|---|---|
| **NPC 隊友欄位** | main.js `renderNPCSlots()` | `#tm-slot-0` ~ `#tm-slot-5` | 6 個 slot |
| **NPC 觀眾欄位** | main.js | `#aud-slot-0` ~ `#aud-slot-2` | 3 個 slot |
| **背景角鬥士字條** | main.js `_renderBackgroundStrip()` | `#bg-gladiator-strip` | 右上角小字，顯示熟悉度 |
| **戰鬥鈕** | main.js `_showTimelineBattleBtn()` | `#timeline-battle-btn` → `#stage-center` | 置中 + pulse 動畫 |
| **Stage 黑幕** | stage.js | `#stage-curtain-top` / `#stage-curtain-bot` | closeEyes / openEyes |
| **Stage 晨起覆蓋** | stage.js `playMorning()` | `#stage-morning-overlay` | 雞鳴 + 晨思，播完 display:none |
| **Stage 事件小過場** | stage.js `playEvent()` | `#stage-opening` | 標題 + 多行文字 |
| **DialogueModal** | dialogue_modal.js | `#modal-dialogue` / `.dialogue-box` | 垂直置中，Space/Ctrl |
| **ChoiceModal** | choice_modal.js | `#modal-choice` / `.choice-modal-box` | 多選項 + 條件篩選 |
| **行動列表** | main.js `renderActionList()` | `#action-list` | 動態生成訓練/休息按鈕 |
| **時段列** | main.js | `#time-slots` | 8 格 2h 時段 |
| **百日條** | main.js | `#hdb-wrap` | 100 天進度條 |
| **日誌** | main.js `addLog()` | `#log-content` | 捲動式文字日誌 |

### 遊戲系統模組

| 系統 | 檔案 | 關鍵 API | 備註 |
|---|---|---|---|
| **效果派發** | effect_dispatcher.js | `Effects.apply(list, ctx)` | 統一處理所有 vital/attr/exp/moral/flag/affection |
| **道德滑動窗口** | moral.js | `Moral.push(axis, side, opts)` | N=3 窗口，自動賦予/移除特性 |
| **晨思系統** | morning_thoughts.js | `MorningThoughts.pickToday(p)` | 每日一條，優先度分層 |
| **背景角鬥士** | background_gladiators.js | `BackgroundGladiators.rollDaily(day, weight)` | 碎念 + 八卦 + 協力 |
| **奧蘭事件** | orlan_events.js | `OrlanEvents.tryDeathSave()` | Day 30/60/85 脊椎事件 + 生死援手 |
| **醫生事件** | doctor_events.js | `DoctorEvents.tryVisit()` | 自動觸發，差異化治療 |
| **抓老鼠任務** | src/quests/mela_rat_quest.js | `MelaRatQuest.tryOffer()` / `playTonight()` | 🆕 D.28：白天接、晚上做、3 段判定 |
| **NPC 反應（情緒回聲）** | npc_reactions.js | `NPCReactions.pickDaily(day)` | Day 5/60/85 大選擇後隔日清晨 NPC 輪流表態 |
| **NPC 衝突事件** | npc_conflicts.js | `NPCConflicts.pickDaily(day)` | 6 個選邊站事件（赫克特/奧蘭/長官/老默/梅拉） |
| **結局判定器** | ending.js | `Endings.pickAndPlay(survived)` | 8 種結局：依 flags/屬性/特性自動判定 |
| **存檔系統** | save_system.js | `SaveSystem.saveToSlot()` / `loadFromSlot()` | 5 手動槽 + auto + backup |
| **日循環** | day_cycle.js | `DayCycle.onDayStart(name, cb)` / `fireDayStart(day)` | 各系統掛鉤的統一觸發器 |
| **場景舞台** | stage.js | `Stage.playSleep()` / `playMorning()` / `playEvent()` | 所有轉場動畫 |
| **音效合成** | sound.js | `SoundManager.playSynth(id)` | 8 種內建音效，Web Audio |
| **旗標系統** | flags.js | `Flags.set/has/get/increment` | 所有故事/狀態旗標 |
| **全域狀態** | game_state.js | `GameState.setFieldId()` / `getCurrentNPCs()` | session state |
| **戰鬥引擎** | battle.js + testbattle.js | `Battle.start(opponentId, onWin, onLose)` | ATB 即時制，兩套武器資料（待統一） |
| **武器資料** | weapons.js | `Weapons.shortSword` 等 | 給裝備 picker 用 |
| **護甲資料** | armors.js | `Armors` | 盾牌 + 護甲 |
| **敵人資料** | testbattle.js | `TB_ENEMIES` | 4 個敵人（rookie/gladB/vet/champion） |

### 玩家資料結構（Stats.player 關鍵欄位）

| 欄位 | 用途 | 更新方式 |
|---|---|---|
| `equippedWeapon` | 當前主手武器 ID | 裝備 picker / 武器事件 |
| `equippedOffhand` | 副手（盾/雙持）| 裝備 picker |
| `equippedArmor` | 胸甲 ID | 裝備 picker |
| `weaponInventory` | 擁有的武器陣列 `[{id, tier}]` | 武器獎勵事件 push |
| `moralHistory` | 5 軸道德滑動窗口 | Moral.push() |
| `moralLocks` | 鎖定的道德軸 | Moral.push({lock:true}) |
| `seenReveals` | 已觸發的 storyReveal ID | _scanStoryEvents |
| `traits` | 特性陣列 | 開場 + Moral 自動賦予 |
| `ailments` | 病痛陣列 | 失眠/受傷 + 醫生移除 |
| `exp` | 六維 EXP `{STR:0,...}` | modExp (訓練) |

---

## 🧠 技術核心約定

### 資料與型別
- **所有 vital（HP/stamina/food/mood）、屬性（STR/DEX/...）、EXP 強制整數**
  - `Stats.modVital` / `Stats.modAttr` / `Stats.modExp` 內部自動 `Math.round`
  - `Stats.eff(attr)` 回傳值也是整數
  - 任何繞過這些函式的直接寫入必須自己 round
  - **不要出現小數點**：倍率（mood/synergy/crowd）會在計算鏈中累積小數，但存入時一律 round
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

### 模組相依（2026-04-20 Phase 2 重組後）

**資料夾結構**（所有 JS 在 `src/` 下）：
```
src/
├── core/       config, flags, game_state, day_cycle, effect_dispatcher, stats, save_system
├── ui/         stage, choice_modal, dialogue_modal, help_modal, sound, i18n
├── systems/    moral, morning_thoughts, wounds, compulsion, reading, birth_traits, tutorial_hints
├── npc/        npc, background_gladiators, orlan_events, doctor_events, npc_reactions, npc_conflicts
├── content/    origins, fields, events, item, weapons, armors, enemy, books, skill
├── battle/     battle, testbattle
├── actions/    actions, train
├── quests/     mela_rat_quest
└── (root)      character_roll, ending, main
```

**載入順序**（見 game.html bottom，保持原順序，只改路徑）：
```
config → stage → choice_modal → dialogue_modal → flags → origins → i18n →
game_state → sound → day_cycle → effect_dispatcher → stats → moral →
morning_thoughts → fields → npc → background_gladiators → orlan_events →
doctor_events → npc_reactions → npc_conflicts → tutorial_hints → help_modal →
mela_rat_quest → events → item → weapons → armors → enemy → train → skill →
ending → save_system → wounds → compulsion → books → birth_traits → reading →
character_roll → testbattle → battle → actions → main
```
新增模組要注意放在依賴它的模組之前。新增 JS 檔案時：
- 選對子資料夾（core/ui/systems/npc/content/battle/actions/quests）
- 在 game.html 對應位置加 `<script src="src/XXX/yourfile.js">`
- 更新本區的載入順序（如果順序有影響）

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
- **玩家應該從 NPC 對話去理解關係和事件**，不是從 UI 標籤
  - ❌ 「熟悉度 40/40 ✓」 — 遊戲感，破壞沉浸
  - ✅ NPC 跳出來說「嘿，我喜歡跟你訓練的感覺」— 自然理解
  - 數值/狀態改變可以用**顏色暗示**（名字變金色、邊框亮起），但**不解釋數字**
- **重要事件用 `addLog(..., true, true)` flash 提示**(第 4 參數)
- **重大演出用 `Stage.playEvent()`**,不只是 log
- **不加 hover-only 隱藏資訊**（手機不友善）
- **卡片色系依好感分層**（9 層：loyal → nemesis）
- **字體不小於 14px**（整個角色頁已調校過，不要再回到小字）
- **關係圖 storyReveals flavor 文字控制在 25~45 字**（理想），上限 55 字
  （超過會被 `line-clamp: 2` 截斷）→ 詳見 DESIGN.md D.12「📏 Flavor 文字長度約定」

### 教學哲學（D.28）：**零介面提示，全部由 NPC 對話帶出**
- ❌ **不做**：小精靈彈窗、「💡 提示」字樣、灰色 overlay 箭頭、Tutorial 模式標籤
- ✅ **要做**：用對應 NPC 在合理時機講出來，**1~3 句話帶過**，播完沒了
- **誰講就是誰的人設**：長官用長官的口氣、梅拉用母親口氣、老默用冷淡醫生口氣
  - 例：首次 EXP 到上限 → 監督官「那個數字夠了，去找葛拉升級。種下什麼就收什麼。」
  - 例：心情首次 <30 → 梅拉塞「孩子…撐不住時找個角落躲一下也不是罪。」
- **技術實作**：`tutorial_hints.js` 模組，HINT 條件滿足一次就 Flag 鎖住不再觸發
  - 觸發點：`doAction` 結束、`sleepEndDay` 結束各跑一次 `TutorialHints.tryShow(p)`
- **禁區**：不要在 hint 裡寫「點擊右上角詳細按鈕」這種介面指令，要用世界內語言
  （「去找葛拉」比「打開裝備欄」更符合世界觀）
- **Fallback**：未來在設定區加「？操作說明」純選單型查詢頁，純被動，不跳出

---

## 🚫 「不要做」清單

1. **不要自動做主動 NPC 互動**（違反 Phase 1 哲學）
2. **不要在訓練動作裡用 `type: 'attr'`**（改用 `type: 'exp'`）
3. **不要加 hover-only 的隱藏資訊**（手機不友善）
4. **不要創新 UI 元件**，先查上方「🏗️ 已實作系統登記」是否已有可用的
5. **不要跳過整合檢查清單**（D.15 的 9 題）
6. **不要讀全 DESIGN.md**（6000+ 行會塞爆 context，用 grep 精準查）
7. **不要用 `--no-verify` 跳過 commit hook**
8. **不要自動 `git push`**（除非使用者明確說要推）
9. **不要加 emoji 到代碼**（除非使用者明確要求或是既有 convention）
10. **不要建立 documentation 檔案**（除非使用者要求；DESIGN.md / CLAUDE.md / changelog.html 例外）
11. **不要寫沒反饋的選擇事件**（2026-04-23 鐵律）——有 choices 的事件**每個選項都要**有 NPC 回應對白 + 視覺特效（震動/閃光/音效其一），不能選完只 log 一行就結束。詳見 [docs/CONTENT-TEMPLATES.md](docs/CONTENT-TEMPLATES.md) 第 8 條「選擇事件反饋鐵律」。
12. **不要在 main.js 外直接呼叫 bare `addLog(...)`**（2026-04-24 鐵律）——`addLog` 定義在 `const Game = (() => {...})()` 閉包裡，**不是全域函式**。外部模組（`src/npc/*.js`、`src/systems/*.js` 等）直接寫 `addLog(...)` 會丟 `ReferenceError`，通常被上游 try/catch 吞掉 → 前端看就是「某動作按下去沒反應」。**正確寫法**：走 `Game.addLog(text, color, italic, flash)`，或守衛 `if (typeof addLog === 'function') addLog(...)`。這曾讓老默治療流程壞掉 3 次才找到根因。

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
- **⭐ docs/CODEX.md**：**完整字典** — 所有精緻做的東西（特性/書/origin/傷勢/見識/病痛/強迫症/旗標/數字速查）。
  - 🚨 **強制規則（2026-04-19 定）**：**新增任何系統 / 特性 / 書 / origin / flag / 數字公式，必須同步更新 CODEX.md**。
  - 這是單一事實源（Single Source of Truth）— 玩家、AI、開發者查東西都看這份。
  - AI 主動規則：寫新 `xxx.js` 模組或改動 `config.js TRAIT_DEFS` / `books.js` / `origins.js` / `wounds.js` 等資料時，
    **commit 前自動更新 CODEX.md 對應章節**，不用等使用者說。
  - 同步順序：程式碼 → 對應 `docs/systems/{name}.md` → CODEX.md 字典 → CLAUDE.md 術語
- **⭐ docs/CANON.md**：**故事事實單一事實源** — 時間線、年齡、誰知道什麼、關係歷史。
  - 🚨 **強制規則（2026-04-19 定）**：**寫新對白 / 新事件 / 新 storyReveal 前必查 CANON**。
  - 發現未決事實（某角色幾歲？認識幾年？）→ **問使用者，不得 extrapolate**
  - 這是避免「每次都要補丁拯救」的核心工具 — 新事實寫完立刻同步 CANON。
  - CANON 衝突處理：CANON 是源頭，程式碼與其他 md 向 CANON 對齊。
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

- **2026-04-25 v10 監督官巴爺主線**（overseer-rework spec / Phase A-E 實作）—
  - 監督官改名「**巴布魯斯（巴爺）**」、退役角鬥士、跟玩家完整好感互動線
  - 三角動機鏈：主人愛錢愛名 / 塔倫沒能力走算計 / 巴爺成招牌被借局陷害
  - 4 層揭露結構：梅拉播種 → 塔倫稱讚 3 階段 + 引爆事件 + 曖昧指令 2 個 → 老默/卡西烏斯回響 → 偷聽密謀 → 喝酒透漏選擇（給玩家道德重量）
  - 新劇情技能：`unyielding` 不屈（致命一擊鎖死 1HP + 5 回合 +30%）/ `veteran_eye` 老兵之眼（看破弱點）
  - 抓偷懶 4 階梯：主人 5% / 侍從 10% / 塔倫 20% / 巴爺 75%；巴爺好感 ≥30 大吼 / ≥60 假裝沒看到
  - 場景頻率：overseer chance 0.65→0.85、officer 進 audience pool（chance 0.20）
  - 詳見 [docs/discussions/2026-04-25-overseer-rework.md](docs/discussions/2026-04-25-overseer-rework.md) + [docs/characters/overseer.md](docs/characters/overseer.md)
- **2026-04-24（晚）狂熱重構**（fervor-rework-plan.md）：5 條鐵則重做 — (a) 5 attr 命名統一（力量/靈巧/體質/反應/意志），補齊 DEX_fervor (b) 訓練動作改名為具體動作（推舉石頭/投接碎石/杖擊承受/亂棍格擋/打坐冥想） (c) 對白池全重寫（自然觸發 × 瓶頸 × 結束 × 進度 × 擺爛 5 attr 全配齊；擺爛吐槽 = 5 狂熱 × 4 錯訓練 = 20 句具體場景） (d) Stage.popupBig 共用元件（觸發/結束/升級都用） (e) 訓練按鈕視覺強化 — 對應狂熱按鈕放大發光呼吸閃爍，其他縮 0.94× 變灰。
- **2026-04-24**：**狂熱系統落實**（fervor.md）— 取代舊 compulsion 強迫症。四個正面暫時特性 STR/AGI/CON/WIL_fervor；自然觸發（5 天內同屬性 8 次）+ 瓶頸觸發（屬性升到 20/30/.../100 強制）；練對 EXP +25% / mood +5，練錯 mood -5 + 15% 擺爛；5 次結束。主畫面左上金色徽章顯示進度。舊 `_addict` 特性 / `player.compulsion` 自動遷移清除。
- **2026-04-24**：bare `addLog` 大清（CLAUDE.md 第 12 條鐵律）+ 老默治療 bug 根治 + Hector Phase 1 完成 + Day 1 開場大翻修
- **2026-04-19**：世界觀大擴充（Phase 2 準備）— 新增文件：mansion-geography.md（大宅+訓練場同座建築）/ master-family-spec.md（訓練所家族通用規範）/ found-family.md（新家人儀式系統）/ livia.md（主人娘）/ marcus.md（少爺）。重寫 orlan.md 背景三段式（磨坊子→阿圖斯家傭人→被 Marcus 告發偷錢→Livia 求情降級訓練場）。整合 Day 1 開場（受傷演出合進 wakeup 不重播）。替換磨劍事件為沙地畫磨坊（避免無武器矛盾）。orlan_letter 加「主人傳信？這不像是大人的做法」暗示 Livia 管道。
- **2026-04-19**：出生特性三層擲骰（birth_traits.js）— 原本只骰稀有 1%，擴充為稀有/罕見 3%/常見 10% 三層獨立擲骰。擲骰畫面分三層顯示。新 origin 設計規範 `docs/systems/origin-design-spec.md` — 新增 origin 必看。
- **2026-04-19**：強迫症系統上線（compulsion.md）— 4 種訓練強迫症（力/敏/韌/禪癮）/ 連 5 天同訓練養成 + Day 3-4 警告 / 三層獎懲（做 mood+3 / 夜補做 mood+5 / 拒絕 mood-5~-15 累進 + 失眠）/ 20 天不做可解除 / 夜間 slot 7 優先級鏈（任務 > 強迫症 > 休息）/ 負面特性改紅色顯示
- **2026-04-19**：傷勢系統上線（wounds.md）— 4 部位 × 3 級嚴重度 / 開場 15% 擲傷 + 紅光震動 + origin×部位回憶矩陣 / 低體力擲新傷 + 有傷練對應部位觸發「好痛」/ 老默三階段暗示 → 密醫紙條（Phase A 完）
- **2026-04-19**：讀書系統上線（reading.md + books-catalog.md）— 5 類 13 本種子書、見識數值公式、書櫃 5 本容量、傻福三階段漸進、起手書按 origin 差異化、睡前讀書事件、角色頁書櫃區塊
- **2026-04-19**：出生特性軸組系統（traits.md）— 5 軸互斥（智力 / 體質 / 運勢 / 心性 / 天賦）+ 各軸正負稀有特性 1% 獨立擲骰 + 重擲 2 次 + 特性轉化（天才→心力交瘁 / 鐵人→殘軀 / 神眷→神棄 / 神眷可後天獲得）
- **2026-04-19**：8 origins 擴展（origins.js）— farmBoy/nobleman/ruinedKnight/beggar/artisan/criminal/gambler/believer，各有起手書與 NPC 好感設定
- **2026-04-16**：D.22 醫生老默 + 治療系統（新 NPC + DialogueModal 18 句 + 四種傷勢差異化治療 + 藥房懸念橋接）
- **2026-04-16**：D.21b 奧蘭脊椎升級 + 藥房懸念完整鏈 + 道德光譜 UI
- **2026-04-16**：D.21 對話系統 + 晨思系統（DialogueModal L2 + MorningThoughts 30 條 + Stage.playMorning 雞鳴過場 + 奧蘭 Day 1 升級）
- **2026-04-16**：D.20 奧蘭主線 — 永駐兄弟完整四幕（10 storyReveals + 偷藥/分房/訣別三大事件 + 生死援手）
- **2026-04-16**：D.19 道德累積特性系統（10 earned traits + 滑動窗口 + NPC 愛憎倍率 + 戰鬥 mercy 軸）
- **2026-04-16**：D.18 訓練協力 v2（屬性偏好 + 背景角鬥士池 + favorWeight + 碎念/八卦系統）
- **2026-04-15**：D.12 NPC 故事揭露系統上線（卡西烏斯為範本）
- **2026-04-14**：D.6 v2 EXP 單一資源模型、技能購買系統、整數化全部
- **2026-04-13**：D.7 階段 B 人物面板重構（兩欄、六角形、EXP 條）+ Phase 1-J 場地極簡化
