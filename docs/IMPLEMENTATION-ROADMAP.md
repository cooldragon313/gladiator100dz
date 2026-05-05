# 🗺️ 實作規畫表（Implementation Roadmap）

> 從 [arena-events-roster.md](quests/arena-events-roster.md) spec 拆解出的實作清單。
> **每項任務有：依賴 / 預估工 / 狀態 / 優先級**。
> 進度更新規則：完成一項就把狀態改 ✅、commit 時引用任務編號（例：`feat(P1A-1): ...`）。
>
> **最後更新**：2026-05-06

---

## 🚦 明天頭條（2026-05-07）

**第一件事**：開 [docs/quests/errand-outings.md](quests/errand-outings.md) → 看頂部「🚦 明天開工頭條」section → 答 3 題（Q1 範圍 / Q2 維努斯場小孩 boss / Q3 3 個 CANON 問題）→ 開工跑腿事件系統

設計簡介：
- 「鳶尾紋飾」護身符 = 沒落貴族「德拉格家」家徽、撞小孩 merciful 路徑掉
- 訓練所 3 NPC（老默/梅拉/巴爺）認出 → 各自揭一層真相
- 撞小孩 3 路徑（merciful / cruel / neutral）+ 50% 護衛分支（道歉/幹架/逃）
- 4 個跑腿源頭（葛拉/梅拉/侍從/巴爺）+ 同行者陪同（防逃機制）
- 工時 P1 MVP 13h / 完整版 24h

---

## 🎯 高層原則

1. **Foundation 先**（不會被後續推翻的基礎設施）
2. **核心主線次之**（凱德 + 提圖斯線、決定遊戲終極體驗）
3. **周邊事件再次之**（蓋烏斯 + 維努斯場 + 訓練所內事件）
4. **平衡校準最後**（等所有戰力來源都做完才動 ARENA_TIERS / EXP）

每個 Phase 完成都應該**整體可玩通關**、不破壞現有體驗。

---

## 📊 進度總覽

| Phase | 狀態 | 主題 | 完成度 |
|---|---|---|---|
| **P1A** | ✅ 完成 | 結局 + Day 100 框架 | 4/4 |
| **P1B** | ✅ 完成 | 領主提圖斯主線 | 8/8 |
| **P1C** | ⚪ 待開工 | 凱德主線 | 0/6 |
| **P2** | ⚪ 待開工 | 蓋烏斯 + 維努斯場 | 0/8 |
| **P3** | ⚪ 待開工 | 訓練所內部事件 | 0/7 |
| **P4** | ⚪ 待開工 | 中段 BOSS（B1-B6 + 赫克特試煉）| 0/7 |
| **P5** | ⚪ 待開工 | 大會節點 + 比拉斯 | 0/4 |
| **P6** | ⚪ 待開工 | 平衡校準 | 0/3 |

---

## Phase 1A: Foundation（結局 + Day 100 框架）

> 不依賴任何主線、可獨立做完、為後續鋪路

| ID | 任務 | 檔案 | 依賴 | 工 | 狀態 |
|---|---|---|---|---|---|
| P1A-1 | `Moral.getDispositionType()` API（衝動/冷靜/中性） | src/systems/moral.js | — | 0.5h | ✅ |
| P1A-2 | ending.js 8 新結局 stub（B 4 + C 1 + 衝動 3） | src/ending.js | — | 2h | ✅ |
| P1A-3 | wanguji.js wave orchestrator + Day 100 ChoiceModal | src/quests/wanguji.js | P1A-2 | 3h | ✅ |
| P1A-4 | Day 100 自動觸發（攔 final_festival 按鈕、改走 WangujiQuest） | src/main.js（戰鬥按鈕 click handler）| P1A-3 | 0.3h | ✅ |

**P1A 驗收**：✅ console 跑 `WangujiQuest.start()` 走完 5 wave + ChoiceModal + 結局；遊戲跑到 Day 100 點「踏入萬骸祭」按鈕也會走 WangujiQuest（不再是單場 champion 戰）

---

## Phase 1B: 領主提圖斯主線（核心敘事 1 / 2）

> Day 25/45/65/80/100 五個出場點。**P1B-3 是整條線的高潮、必做**。

| ID | 任務 | 檔案 | 依賴 | 工 | 狀態 |
|---|---|---|---|---|---|
| P1B-1 | 提圖斯角色卡 + character md | src/npc/npc.js（直接加進去、不開新檔）+ docs/characters/titus.md | — | 0.5h | ✅ |
| P1B-2 | Day 25 春季大會 — 提圖斯首次遠望（log + flavor） | src/quests/lord_events.js | P1B-1 | 0.3h | ✅ |
| P1B-3 | Day 65 領主訪訓練所 + 相認 storyReveal（柴堆後 / 鐵味 / 認臉） | src/quests/lord_events.js | P1B-1, P1A-1 | 1h | ✅ |
| P1B-4 | Day 65 衝動 vs 冷靜分支實作（依 disposition 分流） | src/quests/lord_events.js | P1B-3, P1A-1 | 0.5h | ✅ |
| P1B-5 | Day 65 衝動分支戰鬥結果判定（屬性門檻 → impulseFailed/Killed/Escape）| src/quests/lord_events.js | P1B-4, P1A-2 | 已併入 P1B-4 | ✅ |
| P1B-6 | Day 80 領主夜宴 + 瓦倫演戲（完整 DialogueModal 橋段、4 破綻）| src/quests/lord_events.js | P1B-3 | 1h | ✅ |
| P1B-7 | 偽旗背景 storyReveal 系統（Day 70/75/85/92 4 個深層揭露）| src/quests/lord_events.js | P1B-3 | 1h | ✅ |
| P1B-8 | Day 45 白虎獸場（Battle.startFromConfig + win/lose 演出 + 白虎獵者 trait）| src/quests/lord_events.js + config.js TRAIT_DEFS | P1B-1 | 1h | ✅ |

**P1B 驗收**：✅ 農家 origin 玩家完整體驗 Day 25 → Day 45 白虎場 → Day 65 相認分流 → Day 70/75/85/92 4 個深層內心戲 → Day 80 瓦倫 4 破綻揭露 → Day 100 萬骸祭。整條領主主線串起來、可玩可測。

---

## Phase 1C: 凱德主線（核心敘事 2 / 2）

> Day 25/49/70/80/90/100 出場、Day 100 在 P1A-3 已建框架、這裡填內容

| ID | 任務 | 檔案 | 依賴 | 工 | 狀態 |
|---|---|---|---|---|---|
| P1C-1 | 凱德角色卡（NPC 定義、人設、戰績） | src/npc/kade.js（新）| — | 1h | ⚪ |
| P1C-2 | Day 25 春季大會 — 凱德遠望（玩家面熟）| src/quests/kade_events.js（新）| P1C-1, P1B-2 | 1h | ⚪ |
| P1C-3 | Day 49 血戰宴會 — 凱德同桌（面熟感持續）| src/quests/kade_events.js | P1C-1 | 1h | ⚪ |
| P1C-4 | Day 70 四強選拔 — 凱德同場、走前看玩家 | src/quests/kade_events.js | P1C-1 | 2h | ⚪ |
| P1C-5 | Day 80 凱德相認場景（5 分鐘獨處 + 揭真相）| src/quests/kade_events.js | P1C-1, P1B-6 | 4h | ⚪ |
| P1C-6 | Day 90 凱德私下對白（暗示 Day 100 故意輸） | src/quests/kade_events.js | P1C-5 | 2h | ⚪ |

**P1C 驗收**：玩家 Day 25→90 能看到凱德 6 個出場點、Day 100 凱德戰自然有重量

---

## Phase 2: 蓋烏斯 + 維努斯場（橫向張力）

> 所有跨訓練所事件的根

| ID | 任務 | 檔案 | 依賴 | 工 | 狀態 |
|---|---|---|---|---|---|
| P2-1 | 蓋烏斯角色卡 + 維努斯場規格 | src/npc/gaius.js（新）+ npc.js | — | 2h | ⚪ |
| P2-2 | 維努斯場 6 NPC 卡（4 討厭鬼 + 2 招敵候選） | src/npc/vesnus_gladiators.js（新）| P2-1 | 3h | ⚪ |
| P2-3 | 友鄰切磋事件（每 7-10 天） | src/quests/cross_ludus_events.js（新）| P2-2 | 4h | ⚪ |
| P2-4 | 雙主人合作場（Day 35） | src/quests/cross_ludus_events.js | P2-3 | 3h | ⚪ |
| P2-5 | 雙主人陰招場（Day 60） | src/quests/cross_ludus_events.js | P2-3 | 4h | ⚪ |
| P2-6 | 互換新兵事件（Day 50 + Day 80）+ 場景 UI 切換 | src/quests/cross_ludus_events.js | P2-3 | 6h | ⚪ |
| P2-7 | 招敵變友機制（前期弱化 + 放過 + 邀請 + 暗殺） | src/quests/recruit_enemy.js（新）| P2-3, P2-6 | 6h | ⚪ |
| P2-8 | 食物下毒 + 梅拉廚娘預警 | src/quests/recruit_enemy.js | P2-7 | 2h | ⚪ |

**P2 驗收**：玩家有橫向視角看到「對面那訓練所」的人、招敵變友機制可走通

---

## Phase 3: 訓練所內部事件（場內生態）

> 增加 immersion、不影響主線、玩家每天都會遇到

| ID | 任務 | 檔案 | 依賴 | 工 | 狀態 |
|---|---|---|---|---|---|
| P3-1 | 訓練所人口擴充到 40（背景 NPC pool） | src/npc/background_gladiators.js | — | 2h | ⚪ |
| P3-2 | 流動率事件系統（每 7-10 天人來人去） | src/quests/intra_events.js（新）| P3-1 | 3h | ⚪ |
| P3-3 | 抬屍體 + 清房間事件（流動附帶） | src/quests/intra_events.js | P3-2 | 2h | ⚪ |
| P3-4 | 偷竊事件（自己解決、4 選項） | src/quests/intra_events.js | P3-1 | 2h | ⚪ |
| P3-5 | 派系選邊戰（赫克特派 vs 卡西烏斯派） | src/quests/factions.js（新）| — | 4h | ⚪ |
| P3-6 | 狄圖斯伏筆 NPC（隨機出場 + 寶藏線） | src/quests/detius_quest.js（新）| P3-1 | 5h | ⚪ |
| P3-7 | 場內其他事件（欺負新人 / 群毆 / 老默喝醉 / 廚房短缺等 6 種） | src/quests/intra_events.js | P3-1 | 6h | ⚪ |

**P3 驗收**：玩家平常日常感受到訓練所「活著」、人來人去、有大小事件

---

## Phase 4: 中段 BOSS + 赫克特試煉

> Day 30-88 的 BOSS 戰、給玩家爽感

| ID | 任務 | 檔案 | 依賴 | 工 | 狀態 |
|---|---|---|---|---|---|
| P4-1 | B1 鐵骨阿巴（Day 30） | src/content/enemy.js | — | 1h | ⚪ |
| P4-2 | B2 領主白虎（Day 45）— 跟 P1B-8 整合 | src/content/enemy.js | P1B-8 | 2h | ⚪ |
| P4-3 | B3 快刀沙洛（Day 55）— 同時是招敵候選 | src/content/enemy.js + P2-7 整合 | P2-7 | 2h | ⚪ |
| P4-4 | B4 血斧穆爾（Day 70）— 強制傷勢 | src/content/enemy.js + wounds.js | — | 2h | ⚪ |
| P4-5 | B5 蓋烏斯黑爪（Day 80）— 暗殺鏈尾 | src/content/enemy.js + P2-7 | P2-7 | 2h | ⚪ |
| P4-6 | B6 七勝者塔倫弟（Day 88） | src/content/enemy.js | — | 1h | ⚪ |
| P4-7 | 赫克特試煉碑（Day 55）+ 必殺技傳承（快刺/放血/反擊） | src/quests/hector_trial.js（新）+ skill.js | — | 5h | ⚪ |

**P4 驗收**：玩家從 Day 30 開始每階段都有可挑戰的 BOSS、戰勝有獎勵

---

## Phase 5: 大會節點 + 比拉斯逃跑線

> 補完 100 天節奏、給 C 路徑結局

| ID | 任務 | 檔案 | 依賴 | 工 | 狀態 |
|---|---|---|---|---|---|
| P5-1 | Day 25 春季大會（待設計詳細內容） | src/quests/grand_events.js（新）| — | 4h | ⚪ |
| P5-2 | Day 70 四強選拔（待設計詳細內容） | src/quests/grand_events.js | P5-1 | 4h | ⚪ |
| P5-3 | 比拉斯角色 + Day 25/45/55/65/70 觸發鏈 | src/npc/bilas.js + src/quests/escape_quest.js（新）| — | 4h | ⚪ |
| P5-4 | Day 80 逃跑之夜 + 4-6 場小戰 + 結局接 P1A-2 | src/quests/escape_quest.js | P5-3, P1A-2 | 5h | ⚪ |

**P5 驗收**：玩家可以選擇 Day 80 跟比拉斯逃跑、走 C 路徑結局

---

## Phase 6: 平衡校準（最後做）

> 等所有 P1-P5 完成、玩家戰力來源全部到位、再校準數值

| ID | 任務 | 依賴 | 工 | 狀態 |
|---|---|---|---|---|
| P6-1 | 測試完整 100 天、量化玩家屬性曲線（記錄 Day 30/50/70/100 平均屬性） | P1-P5 | 4h | ⚪ |
| P6-2 | ARENA_TIERS 校準（依 P6-1 數據反推合理敵人強度） | P6-1 | 4h | ⚪ |
| P6-3 | EXP 公式微調（防刷 / 連勝獎勵 / 評分加成） | P6-1 | 2h | ⚪ |

---

## 🔄 Phase 之間的依賴關係

```
P1A (Foundation)
  ↓ 多數依賴 ↓
P1B (領主) ←→ P1C (凱德) ←→ P2 (蓋烏斯)
  ↓                ↓             ↓
P3 (訓練所事件)  P4 (中段 BOSS)  P5 (大會 + 比拉斯)
  ↓               ↓               ↓
       P6 (平衡校準) ← 等全部完成
```

**關鍵節點**：
- P1A 完成 → 結局系統可用、後續所有結局都能掛上
- P1B-3 完成 → 整個遊戲的核心情緒高潮（玩家認出領主）
- P1C-5 完成 → 凱德相認、為 Day 100 鋪路
- P2-7 完成 → 招敵機制、影響 Day 100 盟友數
- P5-4 完成 → C 路徑可玩

---

## ⏱️ 工時估算

| Phase | 總工時 | 累積 |
|---|---|---|
| P1A | 6.5h | ✅ 完成（實作 ~6h）|
| P1B | 22h | 28.5h |
| P1C | 11h | 39.5h |
| P2 | 30h | 69.5h |
| P3 | 24h | 93.5h |
| P4 | 15h | 108.5h |
| P5 | 17h | 125.5h |
| P6 | 10h | 135.5h |

**總計約 135 小時**（不含玩測 / debug / 對白 polish）

實際預期 1.5-2 倍 → 200-270 小時實作工。

---

## 🚦 推薦下一步

**Phase 1A 已收尾** ✅。下一步從 P1B / P1C 開始。

**選項 A — 補 character files（半小時、輕鬆）**
- 建 [docs/characters/titus.md](characters/titus.md) / [kade.md](characters/kade.md) / [gaius.md](characters/gaius.md)
- 從 [arena-events-roster.md § 0 / § 6.3 / § 6b](quests/arena-events-roster.md) 抽出來、按 [characters/orlan.md](characters/orlan.md) 既有格式
- 收益：實作 P1B/P1C 時對白有依據、不會寫到不一致的個性

**選項 B — 直接開 P1B-1（提圖斯角色卡 code）**
- 1h、建 src/npc/lord_titus.js（NPC 定義 + 好感欄位 + 不可被招募標記等）
- 接著 P1B-2 春季大會首次出場（2h）
- 收益：開始累積領主主線

**選項 C — 跳到 P1B-3 戲劇高潮（4h）**
- 直接做 Day 65 領主訪訓練所 + 相認 storyReveal（柴堆後 / 鐵味 / 認臉）
- 但會依賴 P1B-1 的 NPC 定義先有
- 收益：能立刻測試整個遊戲最重的一場戲

**個人推薦：A 補檔（30 分）→ B 提圖斯 NPC（1h）→ C 相認場景（4h）**
（總約 5.5h、跑完整條提圖斯 Day 25/45/65 入場）

---

## 📝 Phase 完成的更新規則

每完成一項任務：
1. 把該任務狀態改成 ✅
2. 該 Phase 完成度更新（例：P1A 改 4/4）
3. commit message 用 `feat(P1A-X): ...` 格式
4. 如果有發現 spec 漏洞 → 回去更新 [arena-events-roster.md](quests/arena-events-roster.md)
5. 如果有新事實 → 同步 [CANON.md](CANON.md)

---

## 🚫 不在這份的東西

- ❌ Phase 2/3 訓練所開放（4 家可選）— 留 NewGame+
- ❌ 玩家「多年後回來」結局 — 不塞回故事
- ❌ 主人賭局線 — 設計時被砍
- ❌ 玩家「前訓練所朋友」線 — 設計時被砍
- ❌ 戰鬥系統大改（多人戰真實作）— wanguji.js 用 stub 群戰先撐著、Phase 2 再做
