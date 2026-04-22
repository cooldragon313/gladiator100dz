# 訓練狂熱系統（Fervor）

> 連續訓練同屬性 → 進入「狂熱」狀態，成為屬性突破的必經儀式。
> 設計日期：2026-04-22
> **取代舊設計**：[compulsion.md](compulsion.md)（強迫症）已廢棄 — 舊版是懲罰玩家做對事情
> 實作對應：重寫 `src/systems/compulsion.js` → `fervor.js`（rename）

---

## § 1 核心哲學（與舊強迫症的差異）

### 舊設計問題
- 連 5 天同訓練 = 獲得「強迫症」**負面特性**
- 沒練 mood 累進下降，觸發失眠
- 解除要 20 天不做 → 懲罰專精玩家
- **遊戲要你訓練，訓練要你中詛咒**——矛盾

### 新設計：狂熱 = 獎勵 + 成長儀式

- 連續訓練 = 進入**狂熱狀態**（正面體驗）
- 狂熱期間練對屬性有 EXP 加成 + 好心情
- **練夠 5 次就結束**（有明確盡頭）
- **屬性突破 20/30/40... 必須通過狂熱**（劇情層意義）

→ **玩家從「靠，又中了」變成「來狂熱！」**

---

## § 2 狂熱觸發（雙軌）

### A. 自然觸發 — 專精玩家的獎勵

條件：**5 天內同屬性訓練累積 8 次**

程式邏輯（滑動窗口）：
```js
// 每次訓練
player.trainingLog[attr] ||= [];
player.trainingLog[attr].push(player.day);
player.trainingLog[attr] = player.trainingLog[attr].filter(d => d >= player.day - 5);

if (player.trainingLog[attr].length >= 8 && !hasActiveFervor()) {
  triggerFervor(attr, 'natural');
}
```

- 5 天內累積 8 次 = 表示玩家正在專精這屬性
- 偶然玩家（每天訓練輪換）**不會中**
- 全遊戲一次狂熱冷卻後才能再觸發（不會連發）

### B. 瓶頸觸發 — 屬性突破的必經儀式

條件：**屬性要從 19→20、29→30、39→40... 每 10 級瓶頸**

```js
// 玩家花 EXP 升級時檢查
if (Stats.player[attr] + 1 in [20, 30, 40, 50, 60, 70, 80, 90, 100]) {
  // 如果還沒通過該瓶頸的狂熱 → 先強制觸發
  if (!Flags.has(`fervor_passed_${attr}_${targetLevel}`)) {
    triggerFervor(attr, 'breakthrough');
    return; // 先完成狂熱才能繼續升級
  }
}
```

**無選擇直接觸發**（玩家不能拒絕）：
```
[事件彈窗：屬性突破]

你想花 EXP 升 STR 20。

（但是——你感覺到身體在抗拒。）
（不是不夠努力，是缺了什麼。）
（這堵牆不是 EXP 可以推倒的。）

⚡ 你進入了【力量狂熱】狀態。
```

### 瓶頸對照表

| 屬性等級 | 突破條件 |
|---|---|
| 10 → 19 | 純花 EXP |
| **19 → 20** | 必通過一次狂熱 |
| 20 → 29 | 純花 EXP |
| **29 → 30** | 必通過一次狂熱 |
| 30 → 39 | 純花 EXP |
| **39 → 40 / 49→50 / ... / 99→100** | 每 10 級強制狂熱 |

→ 100 天內專精玩家會觸發 **~7 次狂熱**（20/30/40/50/60/70/80）。

---

## § 3 狂熱期間效果

### 練對屬性（該屬性）

| 加成 | 值 |
|---|---|
| EXP 加成 | **+25%** |
| 心情 | **+5** |
| 體力消耗 | **+5 固定額外** |
| 狂熱進度 | +1（累積到 5 結束） |

### 練別屬性

| 效果 | 值 |
|---|---|
| 心情 | **-5** |
| **擺爛機率** | **15%**（該次 EXP ×0.5）|
| 狂熱進度 | 不變 |

擺爛時隨機 log（吐槽風格）：
- 「你抬腳的時候一直想起昨天沒練完的石塊⋯⋯」
- 「你跑到一半停下來——手心癢，想握武器。」
- 「你意識到自己又在空揮拳頭。」
- 「你的腳不聽話——像是只想走那條路。」

### 休息 / 事件 / 任務 / 戰鬥

**不影響進度**，不扣心情。狂熱只在**訓練動作**時生效。

---

## § 4 狂熱結束

### 條件：對應屬性訓練累積 **5 次**

達 5 次後：
- 彈 log：「⚡ 那種癮頭散了。你感覺到——你真的變強了。」
- 狂熱狀態移除
- **若是瓶頸觸發**：`fervor_passed_${attr}_${targetLevel}` flag 設定 → 玩家回到升級動作
- **若是自然觸發**：無特殊 flag，但進入冷卻期（14 天內不再自然觸發）

### 玩家節奏預估

| 狀況 | 狂熱結束所需天數 |
|---|---|
| 專注（一天 1-2 次對應訓練）| 3-5 天 |
| 分心（一天 0-1 次）| 5-10 天 |
| 忙碌（事件多、少訓練）| 10 天+ |

5 次比舊版 10 次短，不會拖住玩家進度。

---

## § 5 UI 呈現

### 狂熱狀態顯示

角色頁 + 主畫面固定位置：
```
┌─ ⚡ 力量狂熱 ─────────┐
│ 你正在突破——         │
│ 已訓練：3 / 5            │
└────────────────────────┘
```

- **金色光暈**邊框（正面特性感）
- 進度條 3/5 清楚顯示
- hover tooltip：「練對屬性 +25% EXP。練別的 -5 mood。」

### 觸發演出

**自然觸發**：
```
[Stage.playEvent]
⚡ 你感覺到身體正在說什麼。
⚡ 這幾天的訓練堆疊起來——你抓到什麼了。
⚡ 【力量狂熱】進入狀態。
```

**瓶頸觸發**（更重量級）：
```
[DialogueModal，黑幕過場]
你坐下，準備花 EXP 升級。

（但身體在抗拒。）
（你發現——不夠。）
（你缺的不是力氣，是某種「讓它屬於你」的過程。）

⚡ 【力量狂熱】啟動。突破，就差這幾次。
```

---

## § 6 失眠與憂鬱症（精神狀態）

**重要**：這兩個系統**完全獨立於狂熱**。新設計**拔掉**「睡不好自動失眠症」的機制。

### 失眠（insomnia）觸發條件

改為**精神創傷**取得，不是疲勞累積：

| 觸發 | 條件 |
|---|---|
| 🔪 **仁慈殺人後悔** | 擁有仁慈/神經質特性 + 被迫殺人（殘忍者不觸發）|
| 💀 **目擊死亡** | 連續 2 次（沙洗、隊友死等）|
| 🧬 **特性共鳴** | 神經質 + 高壓事件（如血戰宴會、重大選擇）|
| 🎲 **開場 3% roll** | 已實作保留 |

**移除**的觸發：
- ~~重傷 3 天未治療~~（醫生一起修等於沒意義）
- ~~連續睡不好累進~~（懲罰玩家做對事）
- ~~殘忍殺人~~（人設衝突）

### 憂鬱症（depression）觸發條件

| 觸發 | 條件 |
|---|---|
| ⚰ **重要 NPC 死亡** | 奧蘭 / 梅拉 / 老默 死亡後 3 天內 50% |
| 💔 **長期 mood < 25** 持續 10 天 | 緩慢崩潰 |
| 🎭 **背叛累積** | 反覆選投機 / 背叛 達 3 次 + 關鍵 NPC 好感崩盤 |
| 🎲 **開場 3% roll** | 保留 |

### 解除

- **失眠**：老默治療 + 連 5 天正常睡眠（原機制保留）
- **憂鬱**：老默治療（困難）+ 重要 NPC 互動 + 30 天自然消退

---

## § 7 特性命名

### 四個狂熱特性（取代舊 _addict）

| ID | 新名稱 | 舊名稱 | 顏色 |
|---|---|---|---|
| `STR_fervor` | 力量狂熱 | ~~力癮~~ | 🟢 金色（正面）|
| `AGI_fervor` | 步法狂熱 | ~~敏癮~~ | 🟢 金色 |
| `CON_fervor` | 鐵耐狂熱 | ~~韌癮~~ | 🟢 金色 |
| `WIL_fervor` | 禪定覺醒 | ~~禪癮~~ | 🟢 金色 |

### config.js TRAIT_DEFS 更新

```js
STR_fervor: {
  id: 'STR_fervor',
  name: '力量狂熱',
  category: 'positive',
  desc: '正在突破——STR 訓練 EXP +25%。練別屬性 -5 mood。',
  temporary: true,                 // 🆕 暫時性特性（狂熱結束自動移除）
}
// AGI_fervor / CON_fervor / WIL_fervor 類似
```

---

## § 8 資料結構（player.fervor）

```js
player.fervor = {
  active:     null,           // 'STR' | 'AGI' | 'CON' | 'WIL' | null
  source:     null,           // 'natural' | 'breakthrough'
  progress:   0,              // 0-5
  target:     5,              // 結束門檻
  targetLevel: null,          // breakthrough 時記錄升到哪級（e.g. 20）
  startDay:   null,
  naturalCooldownUntil: null, // 自然觸發冷卻至第 N 天

  // 追蹤 5 天內訓練記錄（滑動窗口）
  trainingLog: {
    STR: [], AGI: [], CON: [], WIL: []
  },

  // 突破記錄
  passedBreakthroughs: {
    STR: [20, 30],  // 已通過 STR 20、30 瓶頸
    AGI: [],
    CON: [],
    WIL: [],
  }
}
```

---

## § 9 跟其他系統的互動

### 訓練動作（actions.js / main.js doAction）
- 訓練成功後呼叫 `Fervor.onTraining(attr)`
- Fervor 內部：記錄、檢查觸發、加成計算

### 屬性升級（stats.js spendExpOnAttr）
- 嘗試升級時先檢查 `Fervor.checkBreakthroughNeeded(attr, targetLevel)`
- 需要狂熱 → 先觸發狂熱，阻擋升級
- 狂熱通過後 → `passedBreakthroughs[attr].push(targetLevel)`，升級繼續

### EXP 計算
- 原 synergyMult 計算鏈最後一層：
  ```js
  if (Fervor.active === attr) expGain *= 1.25;
  ```

### UI 顯示
- 主畫面固定位置狂熱框（金色 + 進度 3/5）
- 角色頁特性區塊顯示金色標籤
- Tooltip 說明效果

---

## § 10 實作順序

### Sprint A：核心機制
1. `src/systems/fervor.js`（重寫 compulsion.js）
2. `config.js` 四個新特性定義（category: 'positive', temporary: true）
3. `player.fervor` 初始化 + 存檔遷移
4. `Fervor.onTraining(attr)` 滑動窗口觸發邏輯
5. `Fervor.checkBreakthroughNeeded` / `Fervor.complete` 方法

### Sprint B：UI
1. 主畫面狂熱進度框
2. 觸發演出（Stage.playEvent / DialogueModal）
3. 結束演出 + 效果標籤切換

### Sprint C：失眠 / 憂鬱重做
1. 拔掉舊 insomniaStreak → ailment 自動觸發機制
2. 加新觸發條件（殺人/目擊/特性/死亡 NPC）
3. 配合 npc_reactions.js / moral.js 系統

---

## § 11 待決定（可先實作後再定）

1. **狂熱期間**要不要**顯示倒數在主畫面**？（我建議要，讓玩家有進度感）
2. **瓶頸觸發**的 DialogueModal 要**每個屬性不同文字**嗎？還是共用一套？
3. **自然觸發冷卻 14 天**OK？還是 7 天（更容易再觸發）/ 30 天（更稀有）？
4. 狂熱期間玩家可不可以**手動中止**？還是必須完成 5 次？
5. **瓶頸突破未完成**時存檔 → 下次讀檔狀態保留（這個程式要處理）

---

## § 12 替代舊檔案

- `docs/systems/compulsion.md` → 加「已廢棄」標頭，指向本檔
- `src/systems/compulsion.js` → 重寫為 `fervor.js`（rename 檔名）
- `config.js TRAIT_DEFS` 的 4 個 `_addict` → 4 個 `_fervor`
- **舊存檔遷移**：
  - `player.compulsion.*` → 初始化成 `player.fervor.*`
  - 舊 `_addict` 特性移除
