# 內容作者模板指南

> 本檔案收錄所有內容擴充的範本（新 NPC / 新武器 / 新訓練所 / 新事件 等）。  
> 原屬 DESIGN.md 的 D.11 章節，2026-04-15 大型重構時拆出。  
> 使用方式：新增任何內容前查閱對應模板，按最小必填欄位寫起。

---

## 📑 索引

- [D.11.1 統一 assets 欄位規範](#d111-統一-assets-欄位規範)
- [D.11.2 檔案與命名慣例](#d112-檔案與命名慣例)
- [D.11.3 模板 1：新天氣](#d113-模板-1新天氣)
- [D.11.4 模板 2：新世界狀況](#d114-模板-2新世界狀況)
- [D.11.5 模板 3：新宗教](#d115-模板-3新宗教)
- [D.11.6 模板 4：新寵物](#d116-模板-4新寵物)
- [D.11.7 模板 5：新 NPC（ELITE_DEFS）](#d117-模板-5新-npc)
- [D.11.8 模板 6：新任務（QUEST_DEFS）](#d118-模板-6新任務)
- [D.11.9 模板 7：新裝備（Weapons / Armors）](#d119-模板-7新裝備)
- [D.11.10 模板 8：新開場角色（ORIGINS）](#d1110-模板-8新開場角色)
- [D.11.11 模板 9：新訓練所（FACILITIES）](#d1111-模板-9新訓練所)
- [D.11.12 模板 10：新技能/特性（PURCHASABLE_TRAITS）](#d1112-模板-10新技能特性)
- [D.11.13 模板 11：新絕招（ROUTE_ULTIMATES）](#d1113-模板-11新絕招)
- [D.11.14 其他常用模板（補充）](#d1114-其他常用模板補充)
- [D.11.15 人物面板顯示規範（主角）](#d1115-人物面板顯示規範主角)
- [D.11.16 NPC 百科顯示規範（漸進揭露）](#d1116-npc-百科顯示規範漸進揭露)
- [D.11.17 事件面板顯示規範](#d1117-事件面板顯示規範)
- [D.11.18 新增內容的快速檢查清單](#d1118-新增內容的快速檢查清單)
- [D.11.19 常見錯誤與檢查表](#d1119-常見錯誤與檢查表)

---

## 📥 內容遷移狀態

**第一輪重構（2026-04-15）**：本檔案為骨架占位。完整內容暫存於 `DESIGN-legacy.md` 第 3879~5393 行（D.11.1~D.11.20 章節）。

**第二輪重構（計劃）**：將 `DESIGN-legacy.md` 的 D.11 內容完整遷移到此檔。

**在遷移完成前**：
- 需要查某個模板的詳細欄位 → `grep -n "D.11.7" DESIGN-legacy.md` 即可定位
- 需要寫新內容 → 參考 `npc.js` / `origins.js` / `weapons.js` 等現有資料檔的實際寫法
- 不確定欄位名稱 → 查 `DESIGN-legacy.md` 對應的模板區

---

## 暫時指引：如何新增各類內容（簡易版）

在完整模板遷移好之前，以下是最基本的新增指引。

### 🆕 新增一個 NPC

1. 編輯 `npc.js` 的 `NPC_DEFS`
2. **最小必填**：`id / name / title / desc / role / baseAffection`
3. 其他欄位由 `_applyDefaults()` 自動補齊
4. ⚠️ **D.18 訓練協力**：請明示 `favoredAttr`（'STR'/'DEX'/'CON'/'AGI'/'WIL' 或 `null`）
   - 命名 NPC 有匹配 favoredAttr 時提供三段協力：aff≥30 ×1.3 / aff≥60 ×1.6 / aff≥90 ×1.8
   - 故事主角型 NPC 可以先留 `null`，等角色定位明確再補
   - null 也要「明示」，不要省略讓它吃預設——提醒未來自己記得補
5. ⚠️ **D.19 特性愛憎**：請明示 `likedTraits` / `dislikedTraits`
   ```js
   likedTraits:    { reliable:3, patient:2, kindness:1 },   // { traitId: intensity 1~3 }
   dislikedTraits: { coward:3, impulsive:2, prideful:1 },
   ```
   - 強度 1 = 小偏好、2 = 中、3 = 強烈
   - 玩家淨分 ±3 → 好感成長 ×1.5 / ×0.3（詳見 DESIGN § 3.7）
   - **角色設計的靈魂**：這裡決定了 NPC 眼中玩家是什麼樣的人
   - 沒想好也要寫 `{}` 明示（不是省略），強迫自己記得之後要補
   - 可用的 traits 見 `config.js` TRAIT_DEFS（earned + 既有）
6. 未來擴充：`personality / storyReveals / schedule / hiddenQuestHints`
7. 參考 `cassius` 看故事揭露（storyReveals）的寫法，參考 `officer` 看 likedTraits 的寫法

### 🆕 新增一個事件

1. 編輯 `events.js` 對應常數（`ACTION_EVENTS` / `NPC_NOTICE_EVENTS` / `SUMMON_EVENTS` / `ERRAND_EVENTS` / `CHOICE_EVENTS`）
2. 最小必填：`id / text / effects`
3. 記得跑 D.15 整合檢查清單 8 題
4. 如果是玩家選擇事件，用 `CHOICE_EVENTS`，格式見 `choice_modal.js` 檔頭註解
5. 如果牽涉屬性變動，用 `type: 'exp'`（不是 'attr'）
6. 🆕 **D.19 道德軸**：有道德意涵的事件或選項要在 `effects` 加 moral 效果：
   ```js
   { type:'moral', axis:'reliability', side:'positive', weight:1 }
   //   axis   : reliability | mercy | loyalty | pride | patience
   //   side   : positive | negative
   //   weight : 1=普通事件  3=關鍵事件（一次定型）
   //   lock   : true=劇情鎖定軸（極少用，留給無法回頭的瞬間）
   ```
   - 每個軸對應兩個 earned traits（見下表）
   - 大部分事件用 weight:1 就好
   - 只有「主角認定自己是什麼樣的人」的關鍵事件才用 weight:3
7. 事件檢查整合清單的第 9 題：**有沒有道德軸該觸發？** 不要漏掉
8. 🆕 **2026-04-23 選擇事件「反饋鐵律」**：有選擇的事件**必須**給玩家後續反饋，不能選完一行 log 就結束：

   ```
   ❌ 沒頭沒尾:
     [選擇: 推他回去]
     → resultLog: "你用肩膀頂回去。赫克特退了一步。"
     → 結束（玩家心想：然後咧？）

   ✅ 有反饋:
     [選擇: 推他回去]
     → 視覺特效（shake / 紅光 / 金光）
     → NPC 回應對白（showing 而非 telling）:
       赫克特：不錯。
       赫克特：有這眼神——你可以活久一點。
     → 數值變動（好感 / 道德軸）
   ```

   每個選項分支**至少要有**：
   - **視覺反饋**：震動 / 閃光 / 音效 其中之一（用 `resultEffect` 欄位 — 若尚未支援就開 issue）
   - **敘事反饋**：`resultDialogue` 2-4 行 NPC 對白（比 resultLog 重很多的優先）
   - **數值反饋**：effects 改好感 / 道德軸 / vitals（已是標配）

   寫選擇事件時，**對每個選項分開想**「玩家選這個之後，會看到什麼？」
   絕對不要多個選項用同一條敘事 log。

   **常見特效 CSS class 對照**（方便寫作時選擇）：
   - `stage-red-flash` — 紅光（傷害、怒氣、暴力）
   - `shake-pain` — 震動（衝擊、鞭打、撞擊）
   - `bubble-pop` — 泡泡浮現（對話、驚訝）
   - 金光 / 光暈 — 成就、好結果（需要時新加）

   **不要只為省事用 `resultLog` 就交差**。log 只是歷史記錄，看完就過。NPC 對白才是玩家「感受」那一刻的管道。

### 🆕 新增一個特性（Trait）

1. 編輯 `config.js` 的 `TRAIT_DEFS`
2. 必填：`id / name / category / desc`
3. `category`: `'positive'` / `'negative'`
4. 如果是解鎖式（例：literate），在 desc 說明「解鎖什麼」
5. 數值加成目前靠硬編碼（未來 D.6 進化版會資料驅動）

### 🆕 新增一個訓練所（Facility）

**未實作** — 等 Phase 2 S2。

當前所有訓練資料都在 `stdTraining`，未來會建立 `facilities.js`。
詳細設計規格見 `DESIGN.md § 4.1`。

⚠️ **D.18 背景角鬥士抽取權重**：新增訓練所時記得在 `FIELDS[id]` 定義 `favorWeight`：
```js
favorWeight: { STR:3, DEX:2, CON:2, AGI:1, WIL:1 }  // 硬派肉搏向
```
這決定了該訓練所每日抽到哪種屬性偏好的背景角鬥士，是訓練所差異化的核心機制之一。

### 🆕 新增一個背景角鬥士（Background Gladiator）

1. 編輯 `background_gladiators.js` 的 `POOL`
2. 必填：`id / name / favoredAttr / shoutLines`
3. `id` 統一前綴 `bg_`，避免和命名 NPC 衝突
4. `favoredAttr`：五屬性之一（STR/DEX/CON/AGI/WIL），不可為 null
5. `shoutLines`：龍套台詞陣列，訓練時有 30% 機率隨機喊
6. **不要**加 storyReveals / 專屬事件 / 關係圖卡片 — 這些是命名 NPC 的領域
7. 熟悉度通過門檻（40）後才提供 ×1.3 協力加成

### 🆕 新增一個玩家背景（Origin）

1. 編輯 `origins.js`
2. 必填：`id / name / title / desc / statMod / startingTraits / startingFlags / openingNarrative`
3. `locked: true` 可先占位
4. 初始 NPC 好感寫在 `initialNpcAffection`

### 🆕 新增一個物品（Item）

1. 編輯 `item.js`（目前很空）
2. 最小必填：`id / name / type / desc / eqBonus`
3. 獨特道具（如 marcoCharm）加 `storyTag` 讓其他 NPC 能檢查
4. D.14 故事道具網路完整設計見 `DESIGN.md § 4.3`

### 🆕 新增一個武器

1. 編輯 `weapons.js`
2. 必填：`id / name / type / hands / desc / eqBonus / price`
3. 對應的戰鬥數據寫在 `testbattle.js` 的 `TB_WEAPONS`
4. `hands: 1` 單手可雙持、`hands: 2` 雙手鎖副手

### 🆕 新增一個技能（Passive Skill）

1. 編輯 `skill.js`
2. 必填：`id / name / type / desc / unlockReq / expCosts / passiveBonus`
3. `type: 'passive'` — 效果自動生效（由 `calcDerived` 讀 `learnedSkills` 加總）
4. `type: 'active'` — 資料保留，戰鬥系統未掛鉤

---

## 🧭 D.19 道德軸快速查表

5 對相反 earned traits，每一對對應一個「軸」。寫事件時選對應軸 + 方向即可。

| 軸 (axis) | positive | negative | 典型觸發情境 |
|---|---|---|---|
| `reliability` | `reliable` 可靠 | `coward` 膽小鬼 | 承擔他人後果 vs 臨陣脫逃 |
| `mercy`       | `merciful` 仁慈 | `cruel` 殘忍 | 饒命 vs 斬首 / 凌遲 |
| `loyalty`     | `loyal` 忠誠 | `opportunist` 投機 | 維護夥伴 vs 告密/叛變 |
| `pride`       | `humble` 謙卑 | `prideful` 驕傲 | 認錯/讓功 vs 拒絕幫助/自吹自擂 |
| `patience`    | `patient` 耐心 | `impulsive` 衝動 | 等待觀察 vs 立即動手 |

**滑動窗口 N=3**：
- 最近 3 筆行動**全同向** → 獲得該側特性
- 任一反向 → 該軸的現有特性立刻被移除
- 反覆橫跳 = 什麼特性都拿不到

**weight 選擇**：
- `weight:1`（預設）：一次日常選擇
- `weight:3`：關鍵事件，直接填滿窗口 → 一次定型
- `weight:3 + lock:true`：劇情重量級事件，定型後該軸永遠無法改變（極少用）

---

## 完整模板章節（待遷移）

**以下章節計劃從 DESIGN-legacy.md 完整遷移過來**。遷移前請暫時用 `DESIGN-legacy.md` 查閱。

### D.11.1 統一 assets 欄位規範
（portrait / icon / bgm / sfx 的標準結構）

### D.11.2 檔案與命名慣例
（資料夾結構、命名規則、路徑寫法）

### D.11.3 模板 1：新天氣
### D.11.4 模板 2：新世界狀況
### D.11.5 模板 3：新宗教
### D.11.6 模板 4：新寵物
### D.11.7 模板 5：新 NPC（ELITE_DEFS）
### D.11.8 模板 6：新任務（QUEST_DEFS）
### D.11.9 模板 7：新裝備（Weapons / Armors）
### D.11.10 模板 8：新開場角色（ORIGINS）
### D.11.11 模板 9：新訓練所（FACILITIES）
### D.11.12 模板 10：新技能/特性（PURCHASABLE_TRAITS）
### D.11.13 模板 11：新絕招（ROUTE_ULTIMATES）
### D.11.14 其他常用模板（補充）

### D.11.15 人物面板顯示規範（主角）
（資料欄位 → 顯示位置對照表）

### D.11.16 NPC 百科顯示規範（漸進揭露）
（5 階段正向揭露 / 5 階段負向揭露對照表）

### D.11.17 事件面板顯示規範
（事件結構、面板 UI、變數替換規則）

### D.11.18 新增內容的快速檢查清單
（13 個「如何新增 X」的分步指引）

### D.11.19 常見錯誤與檢查表
（忘記 assets 欄位、中文路徑、Flag 命名不一致等）

---

## 新增內容的鐵律（精簡版，完整版待遷移）

1. **不要忘記 assets 欄位** — 即使目前沒有美術，也要預留（null）。未來接圖才不用改結構。
2. **不用中文路徑 / 不用絕對路徑** — 所有資源路徑用 `asset/image/xxx.webp` 這種相對路徑。
3. **Flag 命名統一** — 格式 `story_xxx` / `quest_xxx` / `event_xxx` / `chose_xxx`。
4. **Tier 1 特性需求 1 個屬性、Tier 2 需求 2 個、...** — 不要 Tier 1 就要求 3 個屬性。
5. **任務 step 要記得設 flag** — 不然玩家完成條件但遊戲沒察覺。
6. **裝備 hitBias 加總必須 = 1.0** — 否則攻擊部位機率會失效。
7. **跑 D.15 整合檢查清單** — 新增內容前先跑一遍 8 題。

---

**本檔案待第二輪重構完整遷移。在此之前以 `DESIGN-legacy.md` 為準。**
