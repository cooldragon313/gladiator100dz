# 特性系統（Traits）

> 特性是玩家的核心身份標記，影響好感、事件、結局、對話走向。
> 最後更新：2026-04-18

---

## 兩種特性

### 類型 A：**軸上特性**（10 個，5 對互斥）

每個軸上**同時間只能有一個特性**。玩家透過選擇行為推進軸向，三段同向就獲得該特性，反向一次就失去。

| 軸 (axis) | 正向 (positive) | 負向 (negative) |
|---|---|---|
| reliability | reliable（可靠）| coward（膽小鬼） |
| mercy | merciful（仁慈）| cruel（殘忍） |
| loyalty | loyal（忠誠）| opportunist（投機） |
| pride | humble（謙卑）| prideful（驕傲） |
| patience | patient（耐心）| impulsive（衝動） |

技術細節：`moral.js` 實作滑動窗口 (N=3)、`Moral.push(axis, side, opts)` 推進。

### 類型 B：**非軸特性**（獨立，可同時擁有多個）

這些特性**不互斥**，可以獨立存在，也可以同時擁有。

#### 積極
- `kindness`（寬厚）— origin 決定 / 開場特性
- `diligence`（勤勉）
- `iron_will`（鐵意志）
- `survivor`（戰場老兵）
- `unbreakable`（不屈之身）
- `literate`（識字）
- `silverTongue`（巧舌）

#### 負面
- `reckless`（急躁）
- `shaken`（信心崩潰）
- `neurotic`（神經質）
- `brooding`（鬱結）

詳見 `config.js:TRAIT_DEFS`。

---

## likedTraits / dislikedTraits 為什麼**同時列對立兩個**？

技術上，`merciful` 跟 `cruel` 是軸互斥的——玩家永遠只有一個。所以理論上只需要在 NPC 的 likedTraits 或 dislikedTraits 中列其中一個就夠了。

**但我們還是都列**，原因是：

### 保留「不對稱反應」的彈性

| NPC | likedTraits | dislikedTraits | 意圖 |
|---|---|---|---|
| 梅拉 | `merciful:3` | `cruel:3` | **對稱** — 一樣愛仁慈 / 一樣恨殘忍 |
| 塔倫長官 | `reliable:3` | `coward:2` | **不對稱** — 極愛可靠、只是有點討厭膽小 |
| 主人 | `cruel:3` | `merciful:2` | **不對稱** — 欣賞殘忍、輕蔑仁慈 |

如果簡化成 `axisPreference: { mercy: +3 }`（一個值表示整個軸偏好），就失去這種細緻。

**原則**：
- 對稱 NPC（大部分）：兩個 trait 各給同等強度（例 3/3）
- 不對稱 NPC（少數）：根據性格特別寫（長官 3/2、主人 3/2）
- `kindness` 不在軸上 → 永遠只在 likedTraits 側（或 dislikedTraits）

### 未來重構方向（暫不做）

如果大部分 NPC 持續對稱，可以統一改成：
```js
moralPreference: {
  mercy: +3,       // 正 3 等同 liked merciful:3 + disliked cruel:3
  pride: -2,       // 負 2 等同 disliked humble:2 + liked prideful:2
},
independentLikes:    { kindness: 3, iron_will: 1 },
independentDislikes: { neurotic: 1 },
```
可讀性更高、重複少。但目前不急著改。

---

## 如何設計一個 NPC 的愛憎表

按以下步驟：

1. **決定 personality**（aggressive / cautious / support / loner / cunning）
2. **在 5 軸上想像他的位置**
   - 「這個 NPC 會欣賞可靠的人嗎？還是鄙視？」
   - 「他會怕殘忍的人嗎？還是崇拜？」
3. **寫出 likedTraits**（通常 3~5 個 trait，強度 1-3）
4. **寫出 dislikedTraits**（通常 2~4 個）
5. **是否對稱？** 如果 NPC 性格清楚偏某方向，讓兩邊不對稱（長官就是典型）
6. **加非軸特性**（kindness / iron_will 等，如果這個 NPC 會有意見）

### 檢查清單

- [ ] 每個軸都決定了嗎？還是有些軸他無所謂？（無所謂就不寫）
- [ ] 對稱還是不對稱？有沒有特別的性格理由？
- [ ] kindness / iron_will / neurotic 等非軸特性他會在意嗎？
- [ ] 跟同陣營的 NPC 愛憎一致嗎？（盟友通常愛憎類似）

---

## 對話中的使用

所有 NPC 事件對白在展示時，**依玩家擁有的特性切換對白版本**。

### 處理順序（標準）
1. **負面特性優先**：cruel > prideful > coward > impulsive > opportunist > neurotic
2. **正面特性**：kindness > merciful > humble > reliable > iron_will > loyal > patient
3. **全都沒有 → baseline（中立版本）**

這個順序的邏輯：
- 負面特性更有戲（梅拉有話要罵）
- 正面特性中 kindness 特別（它是 origin 直達）
- baseline 要寫溫暖但克制，避免空洞

### 對話變化要**反映 NPC 的愛憎**

- 他喜歡的特性 → 讚美 / 親近 / 放心
- 他討厭的特性 → 抱怨 / 失望 / 保持距離
- 避免讓不討厭 cruel 的 NPC 突然罵 cruel 玩家，會不一致

### 範例：梅拉對 cruel 玩家

因為 `cruel:3` 是她最討厭的 → 對白強烈：
```
「你想對牠怎樣，我懶得管——但別在我廚房亂來。噁心死了。」
```

換成對 `cruel` 無感的 NPC（比如長官），同一情境就該是不同反應。

---

## 相關程式碼

- 特性定義: `config.js:TRAIT_DEFS`
- 好感倍率計算: `npc.js` `_calcTraitMult()`
- 軸上特性推進: `moral.js` `Moral.push()`
- 玩家特性陣列: `Stats.player.traits[]`

---

## 給 AI 的 TL;DR

寫 NPC 對話或事件時：
1. 先看 `docs/characters/<npc>.md` 的愛憎表
2. 決定對白要對哪些特性變化
3. 按**負面優先**的順序處理分支
4. **永遠留一個 baseline**（沒特性的玩家也要有像樣的台詞）
