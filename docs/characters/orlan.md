# 奧蘭（orlan）

> 同命兄弟。跟你同一輛車被押進來的年輕人。磨坊主人獨子，沒揮過劍。
> 最後更新：2026-04-18

---

## 快覽卡

| 項目 | 值 |
|---|---|
| Role | `teammate`（永駐兄弟） |
| 職稱 | 同命兄弟 |
| favoredAttr | **WIL**（他靠意志撐著，不是肉體） |
| baseAffection | 25（開場就對你友好） |
| personality | support |
| 存活關鍵 | 預設 Day 85 訣別 / 或 betrayed 後 Day 85 被處決 / 或並肩到 Day 100 |

---

## 一句話定位

**這遊戲的情感核心。** 他是「讓奴隸生活還有溫度」的人，也是玩家最容易**愧疚**的人。他的四幕（1/30/60/85）串起整個第一幕劇情。

---

## 背景（真相）

- 磨坊主人獨子，沒揮過劍
- 父親說的是「欠貴族債務被抵押」
- **真相**：妹妹得了血咳症，父親為了籌藥錢把他賣了
- 他不恨父親 — 他認為這是對的
- **他永遠不敢告訴你這件事**，怕你覺得他家人狠心（好感 ≥ 70 才揭露）
- 他偶爾還會夢見磨坊壓碎麥子的陽光味

---

## 愛憎表

### 喜歡（+）
| 特性 | 強度 |
|---|---|
| kindness | **3** |
| merciful | **3** |
| reliable | 2 |
| loyal | 2 |
| humble | 1 |

### 厭惡（-）
| 特性 | 強度 |
|---|---|
| cruel | **3**（他最怕你變成那種人） |
| opportunist | 2 |
| coward | 1（他太了解恐懼，不忍心責怪） |
| prideful | 1 |

---

## 人際關係

- **盟友**: melaKook, cassius, doctorMo
- **敵對**: hector, officer

---

## 對玩家特性的典型反應

### 對 kindness（+）— 信任 / 感動
- 「謝謝你沒變成那種人。」
- 「我知道你不會讓我一個人。」
- 高好感：他會把他最後一塊麵包推到你面前

### 對 merciful（+）— 崇拜
- 「你跟他們不一樣。」
- 「能饒就饒——我沒那種勇氣，但你有。」
- 解鎖生死援手路線的前提特性

### 對 cruel（-）— 害怕 / 退縮
- 「你⋯⋯最近不太一樣。」
- 「別變成那樣——拜託。」
- 極度負向：不敢再跟你同桌

### 對 coward（微負）— 理解但失望
- 「沒關係⋯⋯我懂。」
- 他太懂恐懼了，所以不會真的討厭你
- 但他會在心裡記住

### 對 iron_will（中性偏正）— 尊敬
- 「你比我強多了。」
- 「我要是有你一半意志⋯⋯」

### 對 prideful（微負）— 傷心
- 「你以前不是這樣的⋯⋯」

---

## 對話風格 / 寫作指南

### 語氣
- **溫暖但話不多**，該說的話都會先說
- 笑的時候**眼睛先彎起來**（招牌動作）
- 習慣用「我們」而不是「我跟你」（他強調「一起」）
- 夜裡會輕聲講話，白天訓練場就安靜
- 害怕的時候會**摸自己的手腕**（他妹妹的動作）

### 稱呼玩家
- 直接叫名字
- 親密時：「夥伴」、「兄弟」
- 道歉時不太會用稱呼，只說「對不起」

### 寫錯 vs 寫對

❌ 「謝謝你啊兄弟！你真是好人！我愛死你了！」
（太誇張，不是他的個性）

✅ 「謝謝你——沒變成那種人。」
（簡單、有重量、可以反覆品味）

### 他的招牌動作
- 「他笑了。眼睛先彎起來的那種笑。」
- 「他伸手拍了拍你的肩。」
- 「他把麵包塞到你手裡，轉身走了。」
- 「他沒有抬頭。」
- 「他的手在抖——從頭到尾。」

---

## 四幕主線

### 第一幕：Day 1 初遇（強制）
牢車上跟你同車被押進來。第一夜伸手對你說「我們一起活下去吧」。
- 存檔 flag: `orlan_initial_met`
- 詳見 `events.js` 開場事件

### 第二幕：Day 30 房間升級（條件觸發）
主人好感 ≥ 50 + fame ≥ 30 → 奧蘭強制分房。
- 四選項（帶他走 / 接受 / 內疚不看 / 【驕傲】冷漠）
- 結果 flag: `separated_from_olan`
- 詳見 `orlan_events.js:51`

### 第三幕：Day 60 偷藥事件（強制，若曾 near-death）
player_was_nearly_dead 觸發 → 奧蘭被抓到偷藥。
- 四選項（分擔 / 沉默 / 求情 / 【鐵意志】告發）
- 結果 flag: `shared_olans_punishment` / `guilt_olan` / `interceded_for_olan` / `betrayed_olan`
- 詳見 `orlan_events.js:141`

### 第四幕：Day 85 訣別（強制）
- 預設三選項（接受 / 【高 fame+分擔】並肩 / 【驕傲】冷漠拒絕）
- 告發路線 → 奧蘭昨晚被處決
- 結果 flag: `orlan_will_fight_beside` / `orlan_farewell_accepted` / `orlan_farewell_rejected`
- 詳見 `orlan_events.js:254`

### 外加：生死援手（Day 任何，觸發式）
玩家 HP 即將歸零時，若好感 ≥ 80 + merciful/kindness 特性 → 奧蘭衝上來救你。
- 一次性 flag: `orlan_death_save_used`
- 設 flag: `player_was_nearly_dead`（是 Day 60 偷藥事件的前置）
- 詳見 `orlan_events.js:371`

---

## 結局觸發

| Flag / 條件 | 結局 |
|---|---|
| `betrayed_olan` + survived | 獨自登頂 loneVictor |
| `orlan_will_fight_beside` + orlan alive | 同命兄弟 brotherhoodEnding |
| 同上 + totalStats ≥ 120 + shared_olans_punishment + olan_sister_truth_known | **奇蹟殘局 miracleEnding** |
| `orlan_dead` + Day 1/4/10 | 哀悼序列（`npc_reactions.js`） |

---

## Story Reveals（已實作 10 段 + 8 散點支線）

### Flavor（5 段，關係圖卡片常駐）
- `orlan_first_night_flavor`（aff 25）— 「他每晚睡前都會說一句『晚安』」
- `orlan_bad_joke_flavor`（aff 35）— 葛拉鐵匠鬍子的笑話
- `orlan_second_fall_flavor`（aff 45）— 他又跌倒了一次
- `orlan_hand_tremor_flavor`（aff 55）— 他的手偶爾會抖
- `orlan_mill_dream_flavor`（aff 65）— 他做夢夢到磨坊

### Event（5 段，需條件）
- `orlan_share_food_event`（aff ≥ 40）— 他把自己的麵包推給你
- `orlan_sister_mention`（aff ≥ 55）— 第一次提到妹妹
- `orlan_prayer_at_night`（aff ≥ 60，WIL ≥ 10）— 深夜祈禱
- `orlan_sister_truth_reveal`（aff ≥ 70，WIL ≥ 12）— 揭露父親賣他的真相
- `orlan_final_confession`（aff ≥ 85，有 shared_olans_punishment）— 他告白「有你在，我沒那麼怕」

### 散點支線（8 段 D.26 新增）
第一百次跌倒 / 第二百次跌倒 / 磨坊味道 / 妹妹的歲數 / 等等
詳見 `npc.js:148-465`

---

## 程式碼參考

- NPC 定義: `npc.js:121`
- 事件模組: `orlan_events.js`
- 哀悼序列: `npc_reactions.js`（_buildMournDay1/4/10）
- 結局判定: `ending.js:597`（pickAndPlay）

---

## 寫奧蘭對白的鐵則

1. **短句 + 沉默**：他話不多，但每句都重
2. **招牌動作**：眼睛彎笑、拍肩、低頭
3. **不要過度說愛**：他用行動而非言語
4. **他的脆弱在手腕**：他妹妹的印記
5. **他永遠不會先抱怨**：他先擔心的是你

### 對白範例（放在這裡供參考）

**Day 1 初遇**：
> 「我們一起活下去吧。」
> （他伸出手。你看見他的指節在抖，但他的手沒有縮回去。）

**Day 30 分房**：
> 「⋯⋯去吧。」
> （他正在整理床鋪。他沒有抬頭。）

**Day 60 被抓**：
> （他抬頭看了你一眼——很快地。你看見他嘴角的血。）
> （他搖頭。）

**Day 85 訣別**：
> 「你不是為了我一個人活下去的。」
> 「你要活過百日祭典。讓我妹妹聽到你的名字。」

**生死援手**：
> 「撐住——撐住啊兄弟！」
> （你聽見他的聲音在空中震。他從來沒吼過。）
