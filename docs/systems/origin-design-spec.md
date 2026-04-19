# 背景人物（Origin）設計規範

> 新增或調整 origin 時的完整規範。設計原則 + 欄位定義 + 平衡準則 + 未來擴充。
> 設計日期：2026-04-19
> 對應資料：`origins.js` / `docs/systems/origins.md`

---

## 核心哲學

### Origin = 種子，不是劇本

每個 origin 給玩家**起手條件**，不鎖死結局。透過選擇與事件，同一個 origin 可以長出**完全不同的結局**。

範例：
- farmBoy 可走「復仇」/「逃亡」/「收養新家人」三種結局
- nobleman 可走「贖身回貴族」/「背叛家族」/「競技場冠軍」

---

## 完整欄位清單

```js
{
  id:        'uniqueKey',              // 程式 ID（小寫駝峰）
  name:      '落魄貴族',                // 顯示名稱（2-5 字）
  title:     '政治鬥爭的輸家',          // 副標題（一句話概括）
  desc:      '一段描述...',             // 2-3 句話介紹，描述身世與被抓理由
  locked:    false,                    // true = 未開放
  lockReason: '等 Phase 2 開放',       // locked 時的說明

  // ── 數值層 ──
  statMod:   { STR:+2, CON:+3, DEX:-1, WIL:-1 },  // 六維偏移（+/- 總和建議 ±4）
  startingTraits: ['diligence', 'kindness'],       // 起手特性（0-2 個，見下方原則）
  startingFlags:  ['village_burned'],               // 起手 flag（歷史事件標記）
  startingItems:  [],                               // 起手物品
  startingBooks:  ['family_sword_manual'],          // 🆕 2026-04-19 起手書
  startingMoney:  0,                                // 起手錢
  hiddenTag:      'lord_is_enemy',                  // 內部 tag（事件條件用）

  // ── NPC 關係層 ──
  initialNpcAffection: {
    dagiSlave: +5,   // 親近
    oldSlave:  +10,
    officer:   -5,   // 疏遠
  },

  // ── 結局傾向（S6 命運抽取）──
  endingAffinities: {
    revenge:    +30,
    escape:     +10,
    champion:   -20,
    buyFreedom:  0,
  },

  // ── 難度（UI 顯示星星）──
  difficultyScore: {
    survival: 1,  // 生存難度
    social:   2,  // 社交難度
    combat:   2,  // 戰鬥難度
    resource: 1,  // 資源難度
    overall:  2,  // 總體（UI 顯示這個）
  },

  // ── 事件池 ──
  exclusiveEvents: ['recognize_lord_banner', 'survivor_letter'],
  blockedEvents:   ['noble_seal_recognition'],

  // ── 開場敘述 ──
  openingNarrative: [
    '你記得那天。煙從田邊升起。',
    '你記得母親的最後一個眼神。',
    '你記得那個戴冠的人。',
    '現在，你被賣進了他的競技場。',
  ],

  // ── 美術資源（未來接）──
  assets: {
    portrait:   null,
    background: null,
    cg:         null,
    bgm:        null,
  },
}
```

---

## 設計原則

### 1. statMod 平衡原則

**總和維持在 ±4 內**（避免 OP 或過弱）：
- ✅ farmBoy: +2+3-1-1 = **+3** OK
- ✅ nobleman: +2+1+2-2-2 = **+1** OK
- ❌ 極端設計: +5+3+2 = +10（太強）

**每個 origin 至少 1 個負值**（反映人生代價）：
- 貴族柔弱：STR-2 / CON-2
- 農家沒文化：WIL-1
- 乞丐骨瘦：CON-1
- 每個都有缺點才有個性

**主屬性不超過 +3**（避免開局秒練 15）：
- STR+3 / CON+3 最多

### 2. startingTraits 原則

**0-2 個起手特性**：
- 0 個：過於「一張白紙」，不推薦
- 1-2 個：主流
- 3+ 個：過擁擠，影響 birth 擲骰空間

**選擇反映身世**：
- 農家 → `diligence` 勤勉、`kindness` 寬厚（土地教會）
- 貴族 → `literate` 識字、`prideful` 驕傲（教養產物）
- 罪犯 → `reckless` 急躁（習性）
- 沒落騎士 → `literate` + `iron_will`（戰場鍛煉）

**避免直接給稀有軸組特性**：
- 不要起手給 `genius` / `ironclad` / `blessed` 等 1% 稀有
- 稀有留給 birth 擲骰，origin 用常見/罕見層

### 3. startingBooks 原則

**起手書 = 反映身世**：
- ruinedKnight → 《家傳劍譜》（家族餘澤）
- nobleman → 《商賈帳本要義》（家教底子）
- believer → 《殉道聖者列傳》（神殿教育）
- artisan → 《草藥配方集》（職業知識）

**農家 / 乞丐 / 罪犯 / 賭徒 不設起手書**：
- 反映階級現實 — 沒受過教育
- 這些 origin 要靠 NPC 贈書才能讀書

**起手書不能太強**：
- 避免「起手就拿技能書 → Day 5 讀完 → OP」
- 技能書可以（要時間讀）
- 藏寶圖/藍圖 OK（需見識門檻）
- 禁書 / 神器 blueprint 不可起手

### 4. initialNpcAffection 原則

**對稱性**：如果某 origin 偏好權威 → 對立 origin 可能疏遠
- nobleman: officer +5 / masterArtus +5 / melaKook -5 / dagiSlave -10
- farmBoy: dagiSlave +5 / oldSlave +10（同階層親近）
- criminal: orlan -5 / dagiSlave -5 / melaKook -10 / officer +3

**避免絕對值過大**（-15 會讓 NPC 一見面就厭惡）：
- +10 / -10 是極限
- 多數應在 ±5 內

### 5. 難度分級

| overall | 定義 | 範例 |
|---|---|---|
| 1 | 超簡單 | （目前無）|
| 2 | 容易 | farmBoy |
| 3 | 中等 | ruinedKnight / artisan / gambler |
| 4 | 困難 | nobleman / beggar / criminal |
| 5 | 挑戰 | （未來隱藏 origin）|

### 6. openingNarrative 風格

**4-5 句**：不要太長
**第二人稱（你）**：融入感
**具體意象，不說教**：「煙從田邊升起」不是「村莊被毀」
**最後一句接回現實**：「現在，你被賣進了他的競技場」

---

## 受傷偏好（Phase A 已實作）

每個 origin 有「被抓受傷部位」權重：

```js
// birth_traits.js _rollInjuryPart
const weights = {
  farmBoy:      { torso:3, legs:2, arms:2, head:1 },   // 村莊混戰傷軀幹
  nobleman:     { torso:3, head:2, legs:2, arms:1 },   // 被打下馬車
  ruinedKnight: { arms:3, torso:2, legs:2, head:1 },   // 劍下傷
  beggar:       { legs:3, arms:2, torso:2, head:1 },   // 街頭奔逃
  artisan:      { arms:3, torso:2, legs:2, head:1 },   // 工作傷
  criminal:     { torso:2, arms:2, legs:2, head:2 },   // 獄中隨機毆打
  gambler:      { torso:3, arms:2, legs:2, head:1 },   // 被討債的揍
  believer:     { head:3, torso:2, arms:1, legs:2 },   // 宗教迫害
}
```

**設計原則**：部位權重要**反映身世**。信徒頭傷多（被砸石頭）、手工匠手傷多（工具弄傷）、乞丐腿傷多（街頭奔逃）。

---

## 被抓基礎損失（HP / food / mood）

每個 origin 有不同的「被抓過程」損失：

```js
// birth_traits.js _baseLossByOrigin
farmBoy:       { hp:10, food:20, mood:25 }  // 村莊燒光，心情重傷
nobleman:      { hp: 8, food:15, mood:40 }  // 身體沒重傷，精神崩潰最嚴重
ruinedKnight:  { hp:15, food:10, mood:20 }  // 戰鬥傷為主
beggar:        { hp: 5, food:25, mood:15 }  // 早就餓慣、麻木
artisan:       { hp: 8, food:15, mood:20 }  // 一般傷勢
criminal:      { hp:10, food:10, mood:10 }  // 早已麻木，沒啥情緒波動
gambler:       { hp: 8, food:18, mood:25 }  // 不甘心最強
believer:      { hp: 6, food:15, mood:15 }  // 信仰支撐著
```

**原則**：
- HP 損失反映**身體創傷**
- food 損失反映**被抓期間飢餓時長**
- mood 損失反映**精神打擊**

---

## 回憶對白矩陣（origin × 部位）

起床受傷時，依 origin × 受傷部位觸發**具體回憶**（32 個變化）：

每個 origin 要寫 **4 個部位的回憶**（head / torso / arms / legs），每個 1-2 句。

範例（farmBoy）：
```js
farmBoy: {
  legs:  '村子燒的那天 — 跑的時候腳踩斷過。',
  head:  '父親倒下時 — 有什麼砸到我。',
  arms:  '搶鐮刀擋人時 — 被砍了一刀。',
  torso: '馬賊用棍子捶過我，胸口到現在還喘不過氣。',
}
```

**風格**：
- 第一人稱內心獨白
- 具體事件，不空洞
- 帶情緒但不濫情
- 15-25 字

---

## 🆕 未來擴充：Origin 起手技能

**設計想法（2026-04-19 記錄）**：未來某些 origin 應該起手就有技能。

### 為什麼

現在技能透過：
1. 起手書 → 讀完獲得（需時間）
2. 屬性 + EXP 購買（需累積）

但有些 origin 的身世**強烈暗示應該已經會某技能**：
- 沒落騎士 → 應該直接會「反擊（riposte）」— 戰場本能
- 老兵 origin（未來）→ 應該會「戰吼（warCry）」
- 刺客 origin（未來）→ 應該會「潛行攻擊」

### 實作建議（Phase X 做）

新增欄位 `startingSkillRolls`：

```js
ruinedKnight: {
  startingSkillRolls: [
    { skillId: 'riposte',     chance: 0.20 },  // 20% 機率起手會反擊
    { skillId: 'powerStrike', chance: 0.15 },  // 15% 機率會蓄力重擊
  ],
  // ...
}
```

每項獨立擲骰，最多 1 個（避免 OP）。Character roll 畫面顯示結果。

### 平衡準則

- **起手技能必為被動或低 cooldown 主動**（避免 OP）
- **機率 5-20%**，不能太常見（不然失去稀缺性）
- **跳過 unlockReq**（出生就會）
- **最多 1 個起手技能**
- **gambler / farmBoy / believer 等非戰鬥 origin 不給起手戰鬥技能**

**實作時一併加入 CODEX.md「起手技能字典」章節**。

---

## 🆕 未來擴充：Origin 專屬事件

每個 origin 在 Day 20 / 40 / 60 / 80 / 95 應該有**至少一個專屬事件**，強化角色感：

| Origin | Day 20 | Day 40 | Day 60 | Day 80 | Day 95 |
|---|---|---|---|---|---|
| farmBoy | 認出主人徽章 | 村莊倖存者信件 | 農家夢 | 決定復仇或放下 | — |
| nobleman | 識別貴族紋章 | 秘盟盟友紙條 | 政治低語 | — | — |
| ruinedKnight | 戰場記憶 | 老兵相認 | — | 家族劍傳承 | — |
| beggar | 街頭本能 | 舊巷子回憶 | — | — | — |
| artisan | 工匠之眼 | 工坊記憶 | — | — | — |
| criminal | 罪犯網絡 | 獄友聯繫 | — | — | — |
| gambler | 賭徒之運 | 紙牌記憶 | — | — | — |
| believer | 神殿記憶 | 信仰低語 | — | — | — |

設計時**優先填 Day 40 左右的事件**（玩家進入中期節奏）。

---

## 檢查清單（新 origin 通過標準）

新增 origin 時，對照下列所有項目 → 全部 ✅ 才能上線：

- [ ] id / name / title / desc 完整
- [ ] statMod 總和 ±4 內，至少 1 個負值
- [ ] startingTraits 0-2 個，非稀有軸組
- [ ] startingBooks 不超過 1 本（且非過強）
- [ ] startingMoney 反映階級（貴族 20 / 一般 10 / 窮 0）
- [ ] hiddenTag 設定（事件條件用）
- [ ] initialNpcAffection 合理（值在 ±10 內）
- [ ] endingAffinities 4 結局都填（不求平衡，但要明確）
- [ ] difficultyScore 5 項都填
- [ ] exclusiveEvents / blockedEvents 至少各 1 個
- [ ] openingNarrative 4-5 句
- [ ] 🆕 被抓損失（hp/food/mood）加入 `_baseLossByOrigin`
- [ ] 🆕 受傷部位權重加入 `_rollInjuryPart`
- [ ] 🆕 回憶對白 4 部位加入 `_getMemoryLine`
- [ ] 未來擴充：預留 `startingSkillRolls` 欄位（可為空）

**同步文件**：
- [ ] 更新 `docs/CODEX.md § Origin 字典`
- [ ] 更新 `docs/systems/origins.md`（若需）
- [ ] 更新 `changelog.html`

---

## 相關檔案

- `origins.js` — 8 origins 定義
- `birth_traits.js` — 擲骰 / 損失 / 部位權重 / 回憶
- `character_roll.js` — 擲骰畫面
- `docs/systems/origins.md` — 舊版設計筆記
- `docs/CODEX.md` — 字典總覽

---

## 未來 Origin 候選

- `vagabond` 流浪者（失憶 — 記憶碎片作為事件線）
- `gladiatorSon` 角鬥士之子（父親死在競技場）
- `escapedSoldier` 逃兵（沙場逃下來被抓）
- `druid` 德魯伊（森林流放，跟自然有關）
- `barbarian` 蠻族（部落被滅，武器偏好斧）
- `former_gladiator` 退役角鬥士（曾經贏過但被貶）
