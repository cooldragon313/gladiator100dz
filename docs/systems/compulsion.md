# 強迫症系統（Compulsion）

> 連續做同訓練 5 天 → 養成強迫症。選擇做有獎勵，不做有懲罰。
> 設計日期：2026-04-19
> 實作對應：`compulsion.js` + `config.js` 4 特性 + `main.js` 整合

---

## 核心哲學

強迫症**不是數字懲罰，是人格塑造**：
- **做對應訓練** → 滿足 + 獎勵（你這個角色離不開訓練場）
- **不做** → 焦慮累進（你在跟自己戰鬥，代價很大）
- **反覆抗拒** → 崩潰（失眠 / HP 扣）
- **長期抗拒成功** → 克服它（成為另一個人）

---

## 四個強迫症

| ID | 名稱 | 對應訓練屬性 |
|---|---|---|
| `STR_addict` | 力癮 | STR（基礎揮砍 / 重量訓練）|
| `AGI_addict` | 敏癮 | AGI（步法訓練）|
| `CON_addict` | 韌癮 | CON（耐力訓練）|
| `WIL_addict` | 禪癮 | WIL（冥想調息）|

- 四個可同時擁有（沒有上限）
- 顯示為紅色特性（category: 'negative'）

---

## 三階段養成

| 連續天數 | 事件 | 玩家可否收手 |
|---|---|---|
| Day 3 | 日誌提示：「你今天沒練反而覺得不自在⋯」 | ✅ 換練別的 → `buildUp` 歸零 |
| Day 4 | 日誌提示：「你的身體在催促你回到訓練場。」 | ⚠ 最後機會 |
| Day 5 | 獲得 `{attr}_addict` 特性（紅色）| ❌ 已養成 |

**連續中斷**：日結時若當日沒做該訓練 → `buildUp[attr]` 歸零。

---

## 三層獎懲機制

### 1. 白天做對應訓練 → +mood 3（滿足）

```
if hasTrait({attr}_addict) && 訓練 attr：
  Stats.modVital('mood', +3)
  addLog：「（力量訓練讓你覺得踏實。mood +3）」
  absent[{attr}_addict] = 0
  anxiety[{attr}_addict] = 0
```

### 2. 當天沒做 → 夜間 slot 7 彈出選擇

```
ChoiceModal：
  「你的身體記得該做力量訓練了」
  [A] 去練 → 吃掉 20-22h + 訓練獎勵 + mood +5（滿足）
  [B] 不練 → mood -5 × 累進
```

**選 A（補做）**：
- 獎勵：EXP +5（該屬性）、mood +5、stamina -15
- **無 NPC 協力加成**（自己的強迫，沒人陪你）
- 補做時一樣會受 Wounds.rollLowStaminaInjury 檢查（體力低仍可能受傷）

### 3. 連續不做的焦慮累進

| 連續拒絕次數 | mood 扣 | 其他 |
|---|---|---|
| 第 1 次 | **−5** | 「你躺在床上，腦中一直閃過訓練場的畫面」 |
| 第 2 次 | **−10** | 「你開始流汗。手不自覺地握拳又鬆開」 |
| 第 3+ 次 | **−15** + **失眠症** + **hp -10** | 「焦慮像潮水拍打。你整夜無眠」 |

**重置條件**：做一次該訓練 → 累進歸零

---

## 夜間優先級鏈

當 slot 7（20-22h）有事件時：

| 優先級 | 情境 | 對強迫症的影響 |
|---|---|---|
| 1 | NPC 約會 / 劇情強推（未來）| **被迫拒絕** → 累進 +1 |
| 2 | 主線任務（抓老鼠）| **被迫拒絕** → 累進 +1 |
| 3 | 強迫症彈選擇 | 正常 A/B |
| 4 | 無事 | 正常靠牆休息 |

**被占用時的 addLog**：
> 「（你今晚另有要事。身體的焦躁只能硬壓下去。mood -X）」

這讓玩家開始**策略性規劃**：有強迫症的日子要不要跟 NPC 約？約了就要忍焦慮。

---

## 解除機制

| 連續不做天數 | 變化 |
|---|---|
| 10 天 | 日誌：「焦慮慢慢淡了」（尚未解除）|
| 20 天 | **完全解除** + addLog：「✦ 你克服了【XX 癮】」+ flag: `overcame_{attr}_addict` |
| 中途做一次 | `absent` 歸零，解除進度重置 |

解除過程每次違反（做該訓練）都是一次逆流。從擁有強迫症到克服需要**堅持 20 天不碰**，不容易。

---

## 資料結構

```js
player.compulsion = {
  buildUp:  { STR: 3, AGI: 0, CON: 0, WIL: 0 },        // 養成階段連續做天數
  didToday: { STR: true, AGI: false, CON: false, WIL: false },  // 今日已做
  absent:   { STR_addict: 0, ... },                     // 擁有後連續不做天數
  anxiety:  { STR_addict: 0, ... },                     // 夜間拒絕累進次數
}
```

---

## 整合點

### main.js `doAction`（訓練成功後）
```js
Effects.apply(act.effects, { ... });
if (hasAttrEffect && trainedAttr && typeof Compulsion !== 'undefined') {
  Compulsion.onTraining(trainedAttr);
}
```

### main.js `_sleepEndDayBody`（日結）
```js
if (typeof Compulsion !== 'undefined' && Compulsion.onDayEnd) {
  Compulsion.onDayEnd();
}
```

### main.js 夜間 slot 7 優先級鏈
```js
if (MelaRatQuest.hasPending()) {
  MelaRatQuest.playTonight();
  Compulsion.onNightPreempted();  // 被任務占用 → 累進
}
else if (Compulsion.hasPendingTonight()) {
  Compulsion.playNightChoice();   // 彈 ChoiceModal
}
else {
  // 正常靠牆休息
}
```

---

## 平衡考量

### 為什麼連 5 天才養成（不是 3 天）

- 3 天太容易誤中（玩家沒意識就得到了）
- 7 天太長（很少玩家會碰到）
- 5 天 + Day 3/4 警告 → 給玩家收手機會

### 為什麼補做給 mood +5 而拒絕扣 mood -5

對稱設計 — 做了滿足，不做焦慮。金額相同避免「傾向性偏頗」。
但累進到 -15 + 失眠 → 長期拒絕代價大得多。

### 為什麼拒絕 3 次才觸發失眠

- 1-2 次：警告性懲罰，還能承受
- 3 次：人格崩壞級別，扣 hp + 病痛
- 避免一次就炸，給玩家試錯空間

### 為什麼要用 20 天才解除

- 跟 Battle Brothers 類似的「永久 trait」哲學
- 解除太容易 = 特性沒意義
- 20 天 ≈ 遊戲 1/5 時間，代表真正的人格轉變

---

## NPC 反應（未來擴充）

當玩家擁有強迫症時，可以加入 NPC 觀察對白：

| NPC | 看到玩家強迫症的反應 |
|---|---|
| 梅拉 | 「孩子⋯⋯你不要太逼自己。」（關心）|
| 奧蘭 | 「兄弟你跟我一起 — 別一個人練那麼狠。」|
| 老默 | 「你這樣⋯⋯身體會壞。」（專業擔憂）|
| 塔倫長官 | 「好！這才是角鬥士！」（讚賞）|
| 主人塔倫 | 「你練得兇，我高興。」（利益導向）|

**哲學**：強迫症在某些 NPC 眼中是優點（長官 / 主人），在某些眼中是警訊（梅拉 / 老默 / 奧蘭）。形成**道德張力**。

---

## 未來擴充

### 更多強迫症類型（Phase X）

| 可能新增 | 觸發條件 | 效果 |
|---|---|---|
| 賭癮 `gambling_addict` | 連續 5 次賭博 | 看到賭局必加入 / 拒絕 mood -5 |
| 酒癮 `drinking_addict` | 連續 5 次喝酒 | 每日需要喝酒 / 無酒 mood -5 |
| 血癮 `blood_addict` | 戰鬥殺 10 人 | 不戰鬥 mood -5 / 戰鬥 ATK +5 |
| 孤癮 `solitude_addict` | 連續獨處 5 晚 | 社交事件 mood -3 / 獨處 mood +5 |

這些都走 Compulsion 模組同一套機制。

---

## 相關檔案

- `compulsion.js` — 模組主體
- `config.js:TRAIT_DEFS` — 4 個強迫症特性
- `stats.js` — player.compulsion 初始化
- `main.js` — 訓練 hook / 日結 hook / 夜間優先級
- `game.html` — `.trait-negative` 紅色 CSS
- `docs/CODEX.md` — 完整字典
