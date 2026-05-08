# 📌 NEXT — 下次開工備忘

> 跨電腦/跨 session 的「下一步該幹嘛」。
> 新的一天開工先讀這份。
> **最後更新：2026-05-08（晚）** — P2 stubs 全清 + 詞綴 tier 3 戰鬥端接上 + debug 工具 GUI 化

---

## 🔥 第一要務：實機驗收（5 個事件 + 帥氣武器）

> ⚠️ **這批內容全部 commit 但都還沒實機跑過**。下次開工先測這個。
> 全部用 `test.html`（雙擊開啟、勾 godMode、點按鈕跳場景）

### 🗡️ 帥氣武器驗收（詞綴 tier 3 戰鬥端剛接上）

**做法**：開遊戲 → 用 `Game.godMode()`（自動給 longSword_t4）→ 開葛拉鍛造鋪、把武器/護甲鍛上 tier 3 詞綴 → 上場打一場

**要看到**：戰鬥 log 出現以下提示（任一）就成功：
- `✦【嗜血】回 N HP`（vampiric — 命中時回 5% 損傷 HP）
- `✦【灼燒】+5 傷害`（flaming — MVP 版直接加傷、Phase 4 升 DOT）
- `✦【死神】觸發！ATK X → Y（殘血執行）`（reaping — 對 < 30% HP 敵人 +50% ATK）
- `✦【反擊】反彈 5 傷害`（riposting — 護甲詞綴、被擊中 30% 反 5）

**沒看到 = bug**、立刻回報、可能是：
- forge 鍛造沒寫到 inventory.affixes 欄位（檢查 forge_modal.js）
- battle.js 沒讀 affixLog 顯示（已加但要確認）
- testbattle.js TB_apply*Affixes 邏輯漏寫（看 line 740 之後）

### 🎬 P2 五個事件驗收（剛 stub → 完整版）

| testJump | 看什麼 |
|---|---|
| `Game.testJump('day35')` | P2-4 雙主人合作 — 3 選項 + 戰後 30 年舊帳隨機抽 1 |
| `Game.testJump('day50')` | P2-6 玩家去維努斯場 — 5 幕、進口教練震撼、3 選項 |
| `Game.testJump('day60')` | P2-5 陰招場 — 3 選項（舉發/沉默/反陰）+ 中毒 debuff |
| `Game.testJump('day75')` | 公開宴會撕逼 — 5 幕社交事件、抽 2 段素材 |
| `Game.testJump('day80')` | P2-6 來訪者 — 依 Day 50 玩家選擇變化（凱里烏斯/德基烏斯/隨機）|

**重點觀察**：
- 對白節奏（太拖？太快？）
- ChoiceModal 選項是否清楚
- 戰後 NPC 反應是否到位
- 跨事件 flag 串連（Day 50 選 spy → Day 60 是不是有「player_knows_gaius_scheme」對白接上？）

---

## ✅ 2026-05-08 做完了什麼（5 commits）

**5 個 commit、共 ~1700 行新對白 + 詞綴戰鬥端接好**：

```
cc644a4 feat(P2-6): Day 50/80 互換新兵 — 雙天 9 種「來訪者×選擇」分流
c9bc7ea feat(affixes): tier 3 主動效果戰鬥端接上
02b657a feat(P2-5+Day75): 雙主人陰招場 + 公開宴會撕逼
af6f571 feat(P2-4): Day 35 雙主人合作場
a251c6f feat(debug): test.html GUI + Game.godMode + Game.testJump
```

### 1. test.html GUI debug 工具
- 雙擊開啟、勾選 godMode（預設開）、點按鈕跳場景
- 9 個預設場景按鈕 + 自訂天數（1~100）
- 寫 localStorage `__debug_jump`、遊戲「繼續冒險」自動套用
- 不持久化、重整就回原狀

### 2. P2 stubs 全清（4 個事件升級成完整版）
- **Day 35 P2-4 雙主人合作場**（4 幕、3 選項、30 年素材池）
- **Day 50 P2-6 玩家去維努斯場**（5 幕、進口教練、3 選項）
- **Day 60 P2-5 陰招場**（4 幕、舉發/沉默/反陰、中毒 debuff）
- **Day 75 公開宴會撕逼**（5 幕社交、抽 2 段素材）
- **Day 80 P2-6 來訪者**（依 Day 50 分流：凱里烏斯/德基烏斯/隨機）

### 3. 詞綴 tier 3 主動戰鬥端
- 4 個 active affix 全接上 testbattle.js TB_apply*Affixes
- 戰鬥 log 顯示 affixLog 觸發提示
- flaming 是 MVP 版（命中時 +5 額外傷害、不真做 DOT）

---

## 🔮 驗收完之後可以接的事

按優先序：

1. **🟧 P2-8 食物下毒 + 梅拉廚娘預警** — 最後一個 P2 任務（~2h）
   - 完成後 P2 = 8/8 全清
2. **🟨 P3 訓練所內部生態** — P3-3/4/5/6/7 全待開工
   - 流動率 / 抬屍體 / 偷竊 / 派系選邊（赫克特派 vs 卡西烏斯派）/ 狄圖斯寶藏線 / 場內事件 6 種
3. **🟦 P4 中段 BOSS 全套** — 大工程（~15h）
   - Day 30/45/55/70/80/88 + 赫克特試煉
4. **🔵 P5 大會節點 + 比拉斯** — 待設計（~12h）

---

## 🚦 已知未修

- **flaming（灼燒）** 目前是「命中時 +5 額外傷害」MVP 版
  - Phase 4 升級為 3 回合 DOT tick（要做 statusEffects 系統 + 回合 tick 機制）
  - 設計時可放在 testbattle.js TB_endTurnGauge 或新加 TB_endTurnTickStatus

---

## ⚠️ 開發注意事項

- **bare addLog 已全清** — 新寫 `src/**/*.js` 模組時用 `_log` helper（CLAUDE.md 第 12 條）
- **選擇事件必須有 NPC 回應 + 視覺特效**（CLAUDE.md 第 11 條）
- **新 NPC 必填 `favoredAttr` + `likedTraits` / `dislikedTraits`**（D.18 / D.19）
- 跨系統整合清單 9 題（CLAUDE.md）— 提新事件前跑一遍
- **CANON.md 鐵則**：寫對白前必查（時間線 / 角色年齡 / 知識矩陣）
- **撞名警告**：拳法老師 = `Lucius`（保留）/ 維努斯場帥哥 = `Caelius` 凱里烏斯（已改）

---

## 📎 重要連結

- 設計書頂部進度總表：[DESIGN.md](DESIGN.md)
- 接手頭條（每日狀態）：[CLAUDE.md](CLAUDE.md) §「📰 接手頭條」
- 實作 roadmap：[docs/IMPLEMENTATION-ROADMAP.md](docs/IMPLEMENTATION-ROADMAP.md)
- 世界大綱：[docs/discussions/2026-05-06-world-overview.md](docs/discussions/2026-05-06-world-overview.md)
- Codex（特性 / 書 / origin / 詞綴 字典）：[docs/CODEX.md](docs/CODEX.md)
- Canon（故事事實）：[docs/CANON.md](docs/CANON.md)
- 對白位置索引：[docs/DIALOGUE-MAP.md](docs/DIALOGUE-MAP.md)
- titus 角色檔（雙殺路徑）：[docs/characters/titus.md](docs/characters/titus.md)
- gaius 角色檔（蓋烏斯 30 年情義）：[docs/characters/gaius.md](docs/characters/gaius.md)

---

## 💤 給明天的自己

「**今天 P2 stubs 全清、詞綴帥氣武器戰鬥端接好、debug 工具 GUI 化。
明天開工就先 test.html 跑一輪 — 帥氣武器 + 5 個 P2 事件。
測完爽了再接 P2-8 / P3 / P4。**」
