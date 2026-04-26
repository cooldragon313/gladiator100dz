# 📌 NEXT — 下次開工備忘

> 跨電腦/跨 session 的「下一步該幹嘛」。
> 新的一天開工先讀這份。
> **最後更新：2026-04-27** — 大爆發實作日：巴爺後段 + 盧基烏斯後段 + 三杯賭博

---

## 🎯 今天三大主軸全做完（2026-04-27，3 個 commit 已推）

| Commit | 內容 |
|---|---|
| `a5dbeea` | A 巴爺主線 4 hook 補完（達官顯貴 + 梅拉 + 老默接話 + 老兵之眼）+ E 赫克特好感修 |
| `e6b0d52` | B 盧基烏斯後段（T2/T3 自悟 + T4 自創 + 隱藏第 5 次相遇）|
| `f712c2d` | D 三杯賭博 + 幸運之星 + minigames/ folder |

---

## ✅ 今天做的事 — 9 大項詳述

### A. 巴爺主線後段補完

#### A.1 達官顯貴事件（最重要的新事件）
莫拉斯（阿圖斯老朋友兼老對手）帶他家招牌「鐵臂烏勒克」來訪。

- **觸發**：`Day ≥ 30 + fame ≥ 30 + winStreak ≥ 3`
- **流程**：預告對白 → 兩主見面（朋友兼找碴）→ **強制**對戰 morras_ironarm
- **戰勝**：主人 +20 / 塔倫 +5 / fame +25 / 啟動巴爺主線後段
- **戰敗**：主人 -10 / 塔倫 +5 / fame -5、**可再來**
- **赫克特情報網**：
  - 友善路線在場 + 玩家 10 錢 → ChoiceModal「買情報 / 不用」
  - 敵對路線 → 自動把你的弱點賣給對方（你不知道、戰後才有暗示）

#### A.2 梅拉 Layer 1 暗示
- **觸發**：梅拉在 audience + Day ≥ 15 + arenaWins ≥ 1 + 30% + 一次性
- **內容**：晚餐母親型口吻：「巴爺以前也這樣⋯⋯後來就變那樣了」
- 解決偷聽密謀觸發條件難達問題（set `mela_hinted_overseer`）

#### A.3 老默接話 hook 補上
- 每次治療結束自動嘗試 `OverseerEvents.tryDoctorHint()`

#### A.4 老兵之眼直接授予
- 喝酒「不告訴」結局 → 直接給 `veteran_eye` + popupBig

### B. 盧基烏斯空手線後段

#### B.1 T2/T3 自悟（新增 8 個技能）
- T2 條件：該招用 ≥ 8 次 + AGI ≥ 25 + EXP（AGI 200 + DEX 100）
- T3 條件：T2 + 該招用 ≥ 12 次 + AGI ≥ 30 + EXP（AGI 350 + DEX 200）
- 用完招自動檢查、達標 → ChoiceModal「升級！」
- 效果升級：
  - **赤手奪刃** 60% / 80% / **100%** 完美格擋（T3 加敵 silence 1）
  - **借力反摔** 70% / 85% / **100%** 反彈（T3 加敵 stun 1 整回合）
  - **要害打擊** silence 2 / 3 / **4** 回合（T2/T3 加 ATK/SPD debuff）
  - **關節破** 忽略 50% / **100%** DEF（T3 加 30% 斷手 ATK -50%）

#### B.2 T4 自創拳法 + 玩家命名
- 條件：4 招都 T3 + AGI ≥ 35 + DEX ≥ 30 + WIL ≥ 25
- 戰鬥結束 popup → 對白 → `prompt` 玩家輸入名字（最多 6 字、Enter = 「無名」）
- 效果按主導屬性：
  - **AGI 主導**：被攻擊 50% 敵 miss + EVA +20 / 3 turn
  - **DEX 主導**：必中暴擊（ATK ×2 無視防禦）
  - **WIL 主導**：HP<30% 時 ATK +30 / CRT +20 / SPD +10 / 戰鬥結束

#### B.3 隱藏第 5 次相遇
- 4 招學完 + 巴爺主線完成 + 還沒提過 → 玩家主動提巴布魯斯
- 「我以為他也死了。」「告訴他、斷腳的還記得他。」

### D. 三杯藏球賭博

- **觸發**：點睡覺 12% 機率 + 5 天 cd + Day ≥ 8 + teammate 在場
- 邀賭 NPC 個性化對白池
- 三杯洗牌動畫（DEX 對撞、玩家 DEX 高動畫減速）
- 三場制：場 1 簡單 / 場 2 中等 / 場 3 困難（防 LUK 速刷）
- 賭金每場 5 銅
- **全勝 → +1 LUK**「看來我挺幸運」popup
- **連 5 次全勝 → 幸運之星 (+5 LUK passive)**

### E. 赫克特好感修（順手做）

- 友善路線練 DEX → chance 45% → **65%**
- 訓練協力爆擊（synergyMult > 1.0）+ matchAttr → bypass trait mult **保證 +1**
- 新加 `modAffection(id, delta, { bypassTrait: true })` API
- 預期 5 場至少 1 hit 機率 44% → **91%**

---

## 🎯 明天測試清單（按優先序）

### 🔴 高優先 — 新核心系統
1. **達官顯貴事件**（最重要）
   - 起新檔、刷到 Day 30+ winStreak 3 + fame 30
   - 應該觸發強制戰鬥、看完整對白
   - 戰勝後檢查 master/officer aff 變動 + flag 解鎖
2. **三杯賭博**
   - Day 8+ 多點幾次睡覺、看有沒有人來邀
   - 玩看看小遊戲、確認動畫流暢、洗牌速度合理
   - 全勝確認 LUK +1
3. **盧基烏斯 T2 自悟**
   - 學了 T1 後在戰鬥中拼命用同一招、用 8 次
   - AGI 屬性練到 25+
   - 檢查有沒有跳 ChoiceModal「升級！」

### 🟡 中優先 — 補洞
4. **梅拉 Layer 1 暗示**：Day 15+ + 戰過 + 梅拉 audience → 觀察晚餐
5. **老默接話 hook**：高好感老默治療結束後檢查暗示對白
6. **赫克特好感**：DEX 訓練 5 場、檢查綠光頻率（應該明顯比之前多）

### 🟢 低優先 — 細節
7. **巴爺喝酒「不告訴」結局**：跑完整條巴爺線、確認拿到老兵之眼 popup
8. **盧基烏斯隱藏第 5 次**：學完 4 招 + 巴爺主線結束、再去看盧基烏斯

---

## 🔮 後續 TODO（按優先序）

### 🟥 高優先 — 進行中的系列
- **C. 達官顯貴後續延伸**：之後可加「主人邀你陪客人喝酒」「貴客要看你訓練」等小事件
- **赫克特情報網實際戰鬥效果**：目前只 set flag、戰鬥引擎沒讀（敵 ACC -15% 沒實作）
- **巴爺腰帶物品**：兩條結局都有提、item.js 還沒定義

### 🟧 中優先 — 中期補完
- **鍛造師階段 5 雙刃秘法**：需要 `twin_blade_schematic` 書（**書還沒做**、卡死）
- **觀眾切磋系統完成**（目前只有監督官）：
  - 卡西烏斯切磋（DEX/CON）
  - 烏爾沙切磋（CON）
  - 達吉切磋（WIL）
- **達吉 / 烏爾沙劇情線**（目前只有 baseAffection、沒專屬事件）

### 🟨 低優先 — 後期收尾
- **Day 100 萬骸祭結局演出**：8 結局判定有了、但儀式感（音樂 / 大字 popup / 觀眾呼喊）沒做
- **裝備差決定論**（待設計議題）：低 tier 武器在高 tier 對手前完全無效、要不要讓技巧/屬性翻盤

### 🩹 技術債
- **戰敗 wound + onLose -40% HP 重複懲罰**（clamp 0 沒事但邏輯髒）
- **bloodlust 改為「狂戰士」劇情特性**（之前收掉、要做新管道放回）
- **被動「反擊」(counter) vs 主動「反擊」(riposte) 名稱衝突 UI 區分**
- **Stage.popupBig 共用元件擴大使用**（學技能 / 強敵擊倒 / 里程碑）
- **盧基烏斯 T4 自創招式 CON 主導沒效果**（目前只看 AGI/DEX/WIL）

---

## 📁 今天動到的檔案

```
src/content/skill.js          — 4 拳法 T1 + 8 拳法 T2/T3 + luciusT4 + luckyStar
src/npc/lucius_events.js      — T1 學招 + T2/T3 自悟 + T4 自創 + 第 5 次隱藏
src/npc/overseer_events.js    — 達官顯貴主流程 + 梅拉 Layer 1 + 老兵之眼授予
src/npc/doctor_events.js      — _performWoundHeal 加 tryDoctorHint hook
src/npc/npc.js                — modAffection 加 bypassTrait 旗標
src/main.js                   — 達官顯貴 hook + 梅拉 hook + 赫克特好感修 +
                                睡前賭博 hook + 隊友協力爆擊 +1 aff
src/battle/battle.js          — 4 拳法 T1 hook + T2/T3 升級 effect 動態讀 +
                                T4 自創 hook + 敵人 stun 跳回合
src/minigames/shells_game.js  — 新檔案、三杯藏球小遊戲
src/quests/gambling_quest.js  — 新檔案、賭局觸發 + 結算 + 幸運之星
game.html                     — 加 shells_game.js / gambling_quest.js script
```

---

## 🚧 已知小問題（明天測試時注意）

1. **三杯賭博動畫**：杯子 swap 後 DOM 順序 + 球邏輯位置可能有 bug、實測再確認
2. **達官顯貴強制戰鬥的 timing**：用 setTimeout 300ms 給 DialogueModal 關時間、可能會有 race
3. **赫克特情報網的戰鬥加成**（敵 ACC -15%）目前沒實作、只有 flag

---

## 📚 之前完成的歷史（上次更新前）

- **2026-04-25 v10 監督官巴爺主線 Phase A-E** — 鋪墊期 / 曖昧任務 / 卡西烏斯補刀 / 偷聽密謀 / 喝酒選擇都實作
- **盧基烏斯空手線 T1** — 4 招 + 觸發鏈 + 善意 EXP 階梯（DEX/AGI/WIL bonus）
- **NPC 新血池 + 觀眾溢位區** — STR/AGI 缺口補、聚合顯示
- **主動技能戰鬥引擎** — 4 主動（強力斬/嘲諷/反擊/戰吼）+ weaponClass + 技能列 UI
- **房間系統真正生效** — 3 tier 加成 + 兄弟在側擴大判定
- **奧蘭人脈生 fame** — orlan aff ≥ 50 → 12% 機率 +8~15 fame

明天測完回報哪邊壞、哪邊不順 🌙
