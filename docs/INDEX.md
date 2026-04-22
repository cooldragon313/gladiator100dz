# 📚 百日萬骸祭 · 文件索引

> 所有設計文件的總目錄。找不到東西先看這裡。
> 最後更新：2026-04-20

---

## 🧭 快速查找

| 我要... | 看這份 |
|---|---|
| 查「某個特性效果是什麼」「某 flag 做什麼用」| [CODEX.md](CODEX.md) |
| 確認「某角色幾歲」「誰認識誰多久」 | [CANON.md](CANON.md) |
| 寫新 NPC / 武器 / 訓練所 | [CONTENT-TEMPLATES.md](CONTENT-TEMPLATES.md) |
| 找某段對白在哪 | [DIALOGUE-MAP.md](DIALOGUE-MAP.md) |
| 看過去一次性討論的決議 | [discussions/](discussions/) |
| 看舊版設計（考古）| [archive/](archive/) |
| 整體遊戲規範 | [../CLAUDE.md](../CLAUDE.md) |

---

## ⭐ 核心文件（根目錄）

| 檔案 | 內容 |
|---|---|
| [CANON.md](CANON.md) | 故事事實單一事實源（時間線、年齡、誰知道什麼）|
| [CODEX.md](CODEX.md) | 完整字典（特性/書/origin/傷勢/見識/旗標/數字速查）|
| [DIALOGUE-MAP.md](DIALOGUE-MAP.md) | 對白位置總索引 |
| [CONTENT-TEMPLATES.md](CONTENT-TEMPLATES.md) | 新 NPC / 武器 / 訓練所等內容創作模板 |

---

## 🎮 systems/ — 系統設計規格

正式設計規格（寫完或實作中）。

### 戰鬥與競技
| 檔案 | 主題 |
|---|---|
| [battle-system.md](systems/battle-system.md) | 🆕 戰鬥公式總覽 + 武器/護甲資料 + BB 式擴充評估 |
| [arena-system.md](systems/arena-system.md) | 競技場派遣制、對手池、赫克托黑市、戰敗死亡 |
| [battle-density.md](systems/battle-density.md) | 戰鬥密度設計 |
| [battle-screen-rework.md](systems/battle-screen-rework.md) | 戰鬥畫面重構紀錄 |
| [facility-upgrades.md](systems/facility-upgrades.md) | 訓練所 5 階升級 + 4 次事件 |

### 角色養成
| 檔案 | 主題 |
|---|---|
| [traits.md](systems/traits.md) | 特性五軸組 + 稀有/罕見/常見三層擲骰 |
| [origin-design-spec.md](systems/origin-design-spec.md) | 新增 origin 必看的規範 |
| [origins.md](systems/origins.md) | 8 個 origins 概覽 |
| [reading.md](systems/reading.md) | 讀書系統 + 見識 + 傻福三階段 |
| [books-catalog.md](systems/books-catalog.md) | 5 類書本目錄 |
| [wounds.md](systems/wounds.md) | 4 部位 × 3 級傷勢 + 密醫引薦 |
| [fervor.md](systems/fervor.md) | 🆕 訓練狂熱 + 屬性突破儀式（取代強迫症）|
| [compulsion.md](systems/compulsion.md) | ⚠️ 已廢棄 — 舊強迫症設計，看歷史用 |
| [npc-growth.md](systems/npc-growth.md) | NPC 成長系統 |

### 世界觀與關係
| 檔案 | 主題 |
|---|---|
| [mansion-geography.md](systems/mansion-geography.md) | 大宅 + 訓練場同座建築 |
| [master-family-spec.md](systems/master-family-spec.md) | 訓練所家族 archetype 模板 |
| [found-family.md](systems/found-family.md) | 新家人稱呼系統（兄弟/母/師等）|
| [timeline.md](systems/timeline.md) | 時間線與劇情節點 |
| [multi-check-quest.md](systems/multi-check-quest.md) | 多階段任務結構 |
| [night-events.md](systems/night-events.md) | 夜間事件系統 |

### 結局
| 檔案 | 主題 |
|---|---|
| [ending-presentation.md](systems/ending-presentation.md) | 四幕結構 + 5 軸線組合 + 隱藏第五幕 |

---

## 🎭 characters/ — NPC 完整檔案

每個 NPC 的愛憎 / 對話風格 / 特性反應 / 招牌動作 / 程式碼指標。

### 訓練所核心
| NPC | 檔案 | 角色 |
|---|---|---|
| 奧蘭 | [orlan.md](characters/orlan.md) | 永駐兄弟（主線）|
| 卡西烏斯 | [cassius.md](characters/cassius.md) | 老手戰友（故事深）|
| 赫克托 | [hector.md](characters/hector.md) | 老油條（黑市情報販）|
| 索爾 | [sol.md](characters/sol.md) | Day 5 沙洗被選中（28 歲瘸子）|
| **葛拉** | [blacksmithGra.md](characters/blacksmithGra.md) | 🆕 鐵匠（50+ 歲、打鐵 30 年、那根鐵條）|

### 訓練所權威
| NPC | 檔案 | 角色 |
|---|---|---|
| 塔倫長官 | [officer.md](characters/officer.md) | 訓練所管理者 |
| 阿圖斯師父 | [masterArtus.md](characters/masterArtus.md) | 主人 / 武術師父 |
| 梅拉廚娘 | [melaKook.md](characters/melaKook.md) | 廚房母親形象 |
| 老默醫生 | [doctorMo.md](characters/doctorMo.md) | 訓練所奴隸醫生 |

### 主人家族（Phase 2/3）
| NPC | 檔案 | 角色 |
|---|---|---|
| 莉維雅 | [livia.md](characters/livia.md) | 主人娘（善意潛藏推手）|
| 馬可仕 | [marcus.md](characters/marcus.md) | 少爺（Phase 2 反派）|

---

## 📜 quests/ — 任務設計書

| 檔案 | 時機 | 主題 |
|---|---|---|
| [day1-opening.md](quests/day1-opening.md) | Day 1 | 開場受傷演出 + 沙洗伏筆 |
| [mela-rat.md](quests/mela-rat.md) | 不定 | 梅拉抓老鼠（白天接、晚上做、3 段判定）|
| [day5-sand-wash.md](quests/day5-sand-wash.md) | Day 5 | 沙洗公開處決儀式 |
| [blood-feast.md](quests/blood-feast.md) | Day 49 | 血戰宴會 + T5 訓練所升級門檻 |
| [blacksmith-gra.md](quests/blacksmith-gra.md) | Day 5-100 持續 | 🆕 鐵匠葛拉 8 階段任務 + 武器耐久/升級系統 |

---

## 🎨 philosophy/ — 設計哲學

| 檔案 | 主題 |
|---|---|
| [numbers-hiding.md](philosophy/numbers-hiding.md) | 不顯示數字的設計哲學 |
| 結局設計原則.docx | 結局文字風格規範（docx）|

---

## 👹 enemies/ — 敵人設計

| 分類 | 子資料夾 |
|---|---|
| 野獸 | [enemies/beasts/](enemies/beasts/) |

---

## 💬 discussions/ — 臨時討論記錄

一次性討論、細節辯論的紀錄。成熟後精華抽進 systems/。

格式：`YYYY-MM-DD-主題.md`

---

## 📦 archive/ — 已廢棄 / 考古

不再使用但保留參考。

| 檔案 | 廢棄原因 |
|---|---|
| DESIGN-legacy.md | 2026-04-15 前的 6000+ 行舊設計總表 |
| HISTORY.md | 已實作系統的歷史細節（設計 → 實作過程）|
| GladiatorPhase 1-D ～ 1-I 完整修改總整理.txt | 開發初期整理稿 |

---

## 🔗 外部文件

| 文件 | 位置 |
|---|---|
| 專案規範 | [../CLAUDE.md](../CLAUDE.md) |
| 版本記錄 | [../changelog.html](../changelog.html) |
| Keep-a-changelog | [../CHANGELOG.md](../CHANGELOG.md) |
| 手機草稿本 | [../NOTES.md](../NOTES.md) |
| Claude 自動記憶 | [../memory/MEMORY.md](../memory/MEMORY.md) |

---

## 📝 更新守則

**新增文件時**：
1. 寫完文件後，**回來更新本索引**（加一行到對應分類）
2. 若是系統設計 → systems/ + 索引 § systems
3. 若是角色 → characters/ + 索引 § characters
4. 若是任務 → quests/ + 索引 § quests
5. 若是一次性討論紀錄 → discussions/ + 索引 § discussions

**重組時**：
- 檔案搬走 → 路徑必須在索引同步更新
- 廢棄文件 → 移到 archive/ + 更新索引

**查找原則**（給 Claude 用）：
- 先查 CODEX.md（規則速查）
- 次查 CANON.md（故事事實）
- 再查本 INDEX.md（找對應系統/角色文件）
- 最後查 systems/characters/quests 內的細節
