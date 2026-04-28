# 📌 NEXT — 下次開工備忘

> 跨電腦/跨 session 的「下一步該幹嘛」。
> 新的一天開工先讀這份。
> **最後更新：2026-04-28（晚）** — 裝備系統大設計 + 戰鬥屬性 EXP Phase 1 落地
> **下一台機器**：拉最新（`git pull`）→ 看 § 4「明天開工：先做這個」開始動工

---

## ✅ 今天做完了什麼（2026-04-28）

### 對話脈絡
從「老默為何要被截肢」（其實是傷兵被截肢、不是老默）開始、user 提出**事件太少 / 屬性 30+ 太硬**的痛點，
討論演化成**戰鬥屬性 EXP + 連勝獎勵 + 戰鬥狂熱 + 裝備重構（品質+詞綴+多管道）+ 葛拉個人任務**整套設計。

### 4 個 commit（已推遠端）

| Commit | 內容 |
|---|---|
| `8163c76` | balance(hammer)：槌系列全面 buff（ATK +33% / ACC +3 / CDMG 大幅提升 / swingTime 快一拍）|
| `91eec15` | docs：3 份 design doc（裝備重構 / 戰鬥屬性 EXP / 葛拉主武器）+ CLAUDE/CODEX 索引同步 |
| `b11d7b3` | feat(battle)：**戰鬥屬性 EXP Phase 1 落地**（行為累積 + 評分加成 + 連勝獎勵 + bloodRoar）|

### 3 份 design doc（必讀，明天動工前先看）

1. **[docs/systems/equipment-rework.md](docs/systems/equipment-rework.md)** — 裝備重構主規格
   - 5 級品質（粗灰/普白/精藍/上紫/傳金）+ 顏色 + 數值倍率
   - 10 個詞綴（鋒利/精準/致命/嗜血/灼燒等）+ 套裝特效
   - 主人賜 3 條護飾線（布/皮/鐵 各 4 階、起手就精藍）+ 第 4 件三選一定型
   - 葛拉鐵匠鋪 UI（塔倫解鎖事件 + 主人付一半費用）+ 葛拉信用點上交
   - 競技場戰利品（S/A/B 觸發 80/60/40 + 對手掉啥拿啥）
   - 對手強度重新校準 + Boss 戰鐵則
   - 27 格儲物 + 強制處置 ChoiceModal

2. **[docs/systems/battle-attr-gain.md](docs/systems/battle-attr-gain.md)** — 戰鬥屬性 EXP（Phase 1 已實作）
   - A 行為累積 / B 評分加成 / C 防刷
   - 連勝獎勵階梯（3/5/7/10）
   - 第 6 種狂熱 `COMBAT_fervor`（每天必打、漏 3 天 mood -10 + WIL +20）— **未實作**

3. **[docs/quests/blacksmith-signature-weapon.md](docs/quests/blacksmith-signature-weapon.md)** — 葛拉主武器
   - 8 階段：綁定 → 認可 → 強化透漏歷史 → 升 T3 刻名 → 葛拉兒子的劍獨白 → 鍛傳家準備 → 傳家武器送 → **葛拉不退休、繼續陪你看到底**
   - 跟既有 [blacksmith-gra.md](docs/quests/blacksmith-gra.md) 整合、不另起爐灶

---

## 🧪 Phase 1 已實作 — 你需要在新電腦測這些

打開 `game.html`、隨便玩一場戰鬥、確認以下行為：

### 1. 戰鬥成長 log
任何戰鬥結束後 → 戰鬥畫面 log 跑出：
```
◈ 戰鬥成長：STR +X / DEX +Y / AGI +Z / CON +W
```
也會在訓練場 log 跑「**【戰鬥成長】**」綠字。

### 2. 評分加成
競技場勝利 + S 評 → 全屬性 +8 EXP（含 LUK +4）
A 評 → +5 / B 評 → +3 / C 不加。

### 3. 連勝獎勵（達 3/5/7/10 觸發）
連勝 3 場 → 戰後 log 大字框：
```
╔═══ 3 連勝獎勵 ═══╗
  全屬性 +5 EXP　STR 額外 +20　名聲 +5
╚════════════════════╝
```
連 5 → +10 / +40、設 flag `combat_fervor_streak_unlocked`
連 7 → +15 / +60 / +20 名聲、跳「你最近⋯⋯不太一樣了」
連 10 → +25 / +100 + 解鎖隱藏特性【嗜血之吼】

### 4. bloodRoar 開場 ATK +5%
獲得【嗜血之吼】後、每場戰鬥開頭 log：
```
🩸 【嗜血之吼】開場 ATK X → Y（+5%）
```

### 5. Sparring 也算連勝、屬性 EXP 給一半
切磋戰勝 → 連勝 +1、但 EXP 全部 ×0.5。

### 6. 防刷
- 受 5 次重擊（≥ HP 10%）後 CON 不再加（單場硬上限）
- 任何單屬性單場硬上限 +30 EXP（不會更多）

### 已知小問題（明天可決定要不要修）
- ❌ **首勝甜頭**（首次擊敗 rookie/gladB/vet/champion → 對應主屬性 +20）— 規格寫了但 Phase 1 未實作（要 enemy.tier 或 fame 分級邏輯）
- ❌ **同對手 24h 第二次戰勝 30%** — 規格寫了但 Phase 1 未實作（要追蹤 `lastBeatenTime[oppId]`）
- ⚠️ Phase 1 未追蹤 `combatFervor`、所以 `戰利品觸發機率 +10%` 未生效（要 Phase 2 戰鬥狂熱實作後才會用到）

---

## 🎯 明天開工：先做這個

### 優先順序（4 個 Phase 候選、user 自選）

#### **A. 戰鬥狂熱 `COMBAT_fervor`** ⭐ 我推薦先做
**為什麼**：跟今天剛做的連勝/EXP 同一系統、立刻把刷裝/刷戰鬥動機補上。  
**規格**：[docs/systems/battle-attr-gain.md](docs/systems/battle-attr-gain.md) § 6  
**改的檔案**：`src/systems/compulsion.js`（IIFE 名 Fervor、加第 6 種）  
**核心邏輯**：
- 觸發：3 天內戰鬥 ≥ 5 場（自然）OR 5 連勝（強制）
- 期間 buff：戰鬥 EXP +50% / 命中 +5% / 暴擊 +3% / 戰勝 mood +5 / 訓練 EXP -25%
- 維持：每天必打 1 場
- 漏 1 天 mood -3 / 漏 2 天 mood -8 / 漏 3 天結束 + mood -10 + WIL +20「也清醒了」+ 5 天冷卻
- 累積 8 場戰鬥自然結束 + 主屬性 +20 EXP
- UI 跟現有 5 種狂熱共用主畫面左上金色徽章

**估時**：3-4 小時（中等複雜度）

---

#### **B. 品質系統 Phase 1（無詞綴）**
**為什麼**：是裝備重構的基礎、所有後續（詞綴 / 鐵匠鋪 / 競技場掉落 / 主人賜）都依賴它。  
**規格**：[docs/systems/equipment-rework.md](docs/systems/equipment-rework.md) § 2 + § 8 + § 9 Phase 1  
**改的檔案**：
- 新：`src/systems/equipment_quality.js`（getQualityMult、formatName、constants）
- 改：`src/content/weapons.js` / `src/content/armors.js`（加 quality / baseQuality 欄位）
- 改：玩家裝備物件存 `quality` 屬性
- 改：`src/battle/battle.js`（`TB_buildUnit` 讀 quality 計算 ATK/DEF）
- 改：`src/main.js`（裝備 picker / hover tooltip 顯示品質顏色）
- 改：`save_system.js`（migration：舊存檔自動補 quality:'common'）

**估時**：4-6 小時（牽涉多檔案）

---

#### **C. 葛拉鐵匠鋪 UI + 塔倫解鎖事件**
**為什麼**：解「葛拉曝光太少 / 武器升級全卡死」痛點、玩家有主動權。  
**規格**：[docs/systems/equipment-rework.md](docs/systems/equipment-rework.md) § 4.2  
**改的檔案**：
- 改：`src/npc/blacksmith_events.js`（加塔倫解鎖事件 + 鋪內 modal）
- 新：玩家欄位 `gra_credit`（葛拉信用點）
- 新：modal UI（強化品質 / 升 Tier / 鍛新詞綴 / 上交裝備）

**前置**：要先做 B（品質系統）才能強化品質。如果先單做 C，只能做「升 Tier + 上交」基礎版。

**估時**：5-7 小時（UI 工作量大）

---

#### **D. 詞綴系統**
**規格**：[docs/systems/equipment-rework.md](docs/systems/equipment-rework.md) § 3  
**前置**：B 品質系統完成。
**估時**：3-4 小時

---

### 我的推薦動工順序

1. **明天**：A 戰鬥狂熱（3-4 小時、跟剛做完的連動）
2. **後天**：B 品質系統 Phase 1
3. **後後天**：C 葛拉鋪 UI（依賴 B）
4. **再後**：D 詞綴系統（依賴 B）

---

## 📂 必看的文件（明天醒來先看）

按重要性排序：

1. **這份 NEXT.md**（你現在看的）
2. **[CLAUDE.md](CLAUDE.md)**（專案約定、自動讀）
3. **[docs/systems/battle-attr-gain.md](docs/systems/battle-attr-gain.md)** § 6 — 戰鬥狂熱規格
4. **[docs/systems/equipment-rework.md](docs/systems/equipment-rework.md)** — 裝備重構主規格
5. **[docs/CODEX.md](docs/CODEX.md)** § 旗標字典 / § 數字速查表 — 已加新章節「裝備重構 flag」「戰鬥 EXP 加成」「COMBAT_fervor 規格」

---

## 🎨 美術資產（已加）

- **`asset/image/blacksmith.png`** — 鐵匠鋪內景（火爐 + 鐵砧 + 暗色調）
  - **用途**：葛拉所有對話場景的 Stage 背景
  - **觸發場合**：進入鍛造坊 / 找葛拉打造武器 / 葛拉鋪 UI / 葛拉個人任務各階段對話
  - **配置**：背景圖鋪滿 Stage、上面跑既有 DialogueModal（**沒大頭照、用 `{ speaker: '葛拉', text: '...' }` 名字顯示、跟全遊戲一致**）
  - **首句範本**：「今天來幹啥？」（葛拉開場常用）
  - **明天做葛拉鋪 UI 時** — 把這張圖接進來、寫一個 `Stage.playForgeBackdrop()` 共用元件

## 🐛 上線前 todo（暫不處理）

跟今天無關、但提醒自己：

1. 葛拉鋪 UI 完成後、CLAUDE.md「Debug 工具清單」加新項目
2. `combat_streak_max` flag 之後可在角色頁顯示成就
3. 戰鬥 EXP 100 天後驗證：平均屬性是否在 35-40（如果 > 45 砍 30%、< 30 加 30%）
4. `bloodRoar` 取得後可考慮加結局判定（10 連勝路線）
5. ~~葛拉大頭照~~ — 確認不需要、全遊戲統一用名字（speaker name）顯示

---

## 💤 user 留言給明天的自己

「**今天裝備設計都討論完了、3 份 doc 落地了、戰鬥 EXP Phase 1 也跑得起來。
明天起來先測一下戰鬥成長 log 有沒有跳出來、然後挑一個 Phase 開始做（推 A）。**」
