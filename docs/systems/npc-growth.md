# NPC 成長系統

> 命名 NPC 也會變強，不只玩家。
> 討論日期：2026-04-18
> 最後更新：2026-04-18

---

## 為什麼要做

目前 NPC 屬性是**定義在資料裡的固定值**，從 Day 1 到 Day 100 不變。問題：
- 奧蘭到 Day 85 替你出戰 → 他能不能贏？靠的是他 Day 1 的屬性
- 主人賭局需要「你帶隊友並肩」→ 隊友實力等於沒成長的菜雞
- 事件衝擊（例：你為奧蘭擋刀）→ 他沒有「變強」的回饋

所以：
**NPC 的屬性應該隨著玩家的一百天一起成長。**

---

## 成長方式（混合版）

### 🅐 被動每日訓練（低度、自動）

每天命名 NPC **隨機一項屬性 +0.1**（所有命名 NPC 都跑）：
```
每個命名 NPC：
  attr = random('STR', 'DEX', 'CON', 'AGI', 'WIL')
  npc.stats[attr] += 0.1
```

100 天後每個 NPC 各屬性大約 +2（總 +10）。
- ✅ 有「世界持續運轉」感
- ✅ 玩家就算沒互動，NPC 也會慢慢變強
- ✅ 成長很慢，玩家的 EXP 系統會遠遠超過

### 🅑 關鍵事件跳升（高度、戲劇性）

特定事件後 NPC 屬性**直接跳升**。做法是事件 effect 裡加：
```js
{ type: 'npcStat', key: 'orlan', attr: 'DEX', delta: +5 }
```

搭配對白說明：
```
奧蘭：「看到你倒下的樣子——我不能再讓那種事發生。」
（從那晚之後，他每天多練一個時辰。兩週後你看見他的動作更俐落了。）
```

---

## 關鍵事件 → NPC 成長對應表（規劃）

### 奧蘭
| 事件 | 成長 | 對話 |
|---|---|---|
| 生死援手（你倒下他衝上來） | +5 DEX / +5 AGI / +5 WIL | 「不能再讓你為我受傷」 |
| 你替他分擔鞭刑（Day 60） | +3 STR / +5 WIL | 「那天你替我挨了十鞭。我⋯⋯不能白欠。」 |
| 你告發他 | — | （他死了） |
| 你並肩上 Day 100 | +10 STR / +5 DEX（訓練期間） | 訓練段落播 |

### 卡西烏斯
| 事件 | 成長 |
|---|---|
| 他收你為徒（aff ≥ 60） | +3 CON（他更專注自己訓練） |
| 他交給你馬可符牌（D.14） | +5 所有屬性（象徵放下心結） |

### 赫克托
| 事件 | 成長 |
|---|---|
| 他跟長官密謀害過你 | +5 DEX（他更警覺，避免被你報復） |
| Day 25 秋祭嫁禍成功 | +3 所有屬性（他越來越囂張） |

### 梅拉、老默
- 比較不涉及戰鬥，成長不明顯
- 梅拉可以有「廚藝 level」（不是戰鬥屬性）
- 老默可以有「治療效率」成長

---

## 技術實作

### 資料結構改動

`npc.js` 每個 NPC 加：
```js
stats: {
  STR: 10, DEX: 10, CON: 10, AGI: 10, WIL: 10,
},
```

### 新 API

```js
// teammates 模組擴充
teammates.getNpcStat(npcId, attr)           // 取單一屬性
teammates.getNpcStats(npcId)                // 取整組 { STR, DEX, CON, AGI, WIL }
teammates.modNpcStat(npcId, attr, delta)    // 修改（支援小數）
teammates.rollDailyGrowth()                 // 每日被動成長（DayCycle 呼叫）
```

### `effect_dispatcher.js` 新增 type

```js
case 'npcStat':
  teammates.modNpcStat(eff.key, eff.attr, eff.delta);
  break;
```

### DayCycle hook

```js
DayCycle.onDayStart('npcDailyGrowth', () => {
  teammates.rollDailyGrowth();
}, 80);   // 在 NPC 反應、衝突之後
```

---

## 用在哪裡

### 1. 戰鬥協力加成（新）
目前協力加成靠好感 + favoredAttr。可以**加入隊友實際屬性**：
```
協力加成 = 好感加成 ×（隊友屬性 / 玩家屬性 的比例）
  若隊友遠弱於你 → 協力打折
  若隊友跟你差不多 → 協力完整
```

### 2. 奧蘭替你出戰（Day 85-92）
奧蘭的實戰結果直接看他的屬性。他太弱 → 前哨賽死。他夠強 → 可能活。
- 讓「你並肩 vs 讓他代替」這個選擇更有意義

### 3. 隊友並肩戰鬥（Phase 2 新機制）
Day 100 萬骸祭 + `orlan_will_fight_beside` flag → 奧蘭出場陪打。
- 他的傷害輸出依他的屬性
- 他的 HP 依 CON
- 看玩家有多照顧他決定他戰鬥貢獻

---

## 平衡

- **玩家每天 EXP 累積快**（訓練 4 次 = 32 EXP）
- **NPC 每天 +0.1**（幾乎感覺不到）
- **事件跳升 +3~5** 一次性（有戲）
- **100 天後**：
  - 玩家好好練 = 各屬性 20-25
  - NPC 被動漲 = 各屬性 12-15
  - NPC 有關鍵事件跳升 = 各屬性 18-22
- **結論**：玩家還是更強，但 NPC 不會是菜雞

---

## 實作優先順序

1. **資料結構改動**（最基礎）— npc.js 加 stats + teammates API
2. **DayCycle 被動成長** — 每日 0.1 增長
3. **事件 effect 型別 `npcStat`** — dispatcher 加 case
4. **重寫現有協力加成** — 納入隊友屬性
5. **奧蘭 Day 85-92 實戰判定** — 依他的屬性決定是否前哨賽死
6. **關鍵事件加成長對白** — Phase 2 再補

---

## 開放討論

1. 玩家要看得到 NPC 屬性嗎？—— **不**（見 `docs/philosophy/numbers-hiding.md`）
2. 對白要暗示 NPC 變強嗎？—— **有**（「他動作俐落了」「他的劍變重了」）
3. 要讓玩家「訓練隊友」嗎？—— **不**（玩家是奴隸沒權利訓練別人）
4. 隊友的 storyReveal 門檻要隨屬性調嗎？—— **不需要**（好感為主）

---

## 相關文件

- [battle-density.md](battle-density.md) — 戰鬥規劃
- [timeline.md](timeline.md) — 百日條
- [../characters/orlan.md](../characters/orlan.md) — 奧蘭的成長路徑
