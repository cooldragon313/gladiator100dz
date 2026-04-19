# 書本目錄（Books Catalog）

> Phase 1.5 首批種子書（10-12 本），5 類各 2-3 本。
> 每本書有完整 metadata，實作時按此寫入 `books.js`。
> 設計日期：2026-04-19

---

## 資料結構範本

```js
{
  id: 'book_id',
  name: '書名',
  type: 'literacy' | 'memoir' | 'skill' | 'blueprint' | 'map',
  nights: 6,                    // 基礎讀書晚數（會被見識倍率調整）
  discernmentGain: 2,           // 讀完獲得見識（非文字書為 0）
  minDiscernment: 0,            // 最低見識門檻，讀不到就封鎖
  source: ['cassius_gift', 'market_buy'],   // 來源清單
  storyTag: 'book',
  flavor: '一本...（25 字內簡述）',
  onRead: {                     // 讀完觸發的效果
    effects: [...],             // 標準 Effects.apply 格式
    grantTrait: 'trait_id',     // 獲得特性（可選）
    grantSkill: 'skill_id',     // 獲得技能（可選）
    unlockFlag: 'flag_id',      // 解鎖後續事件用 flag（可選）
    triggerEvent: 'event_id',   // 直接觸發事件（可選）
  }
}
```

---

## 一、識字本（Literacy）— 3 本

### 1. `children_reader` 兒童讀本

```yaml
name: 《百字蒙書》
nights: 6
discernmentGain: 2
minDiscernment: 0
source: [cassius_gift, mela_gift_lategame, market_buy_cheap]
flavor: 「手指沾口水，一個字一個字指著讀。」
onRead:
  effects: [{type:'attr', key:'WIL', delta:1}]
  unlockFlag: read_children_reader
```

**獲取**：
- 卡西烏斯好感 40+ 初見贈送
- 梅拉好感 60+ 的角鬥場採買機會
- 市場 50 銀幣

---

### 2. `common_words_3000` 三千常用字

```yaml
name: 《三千常用字》
nights: 8
discernmentGain: 3
minDiscernment: 2
source: [cassius_gift_advanced, officer_reward]
flavor: 「翻過蒙書之後，下一本。字變難了。」
onRead:
  effects: [{type:'attr', key:'WIL', delta:2}]
  grantTrait: literate          # 如果還沒有識字 → 獲得
  unlockFlag: read_common_words
```

**獲取**：
- 卡西烏斯好感 60+，讀完蒙書後追贈
- 長官賞（完成重要訓練任務）

---

### 3. `merchant_ledger` 商賈帳本

```yaml
name: 《商賈帳本要義》
nights: 5
discernmentGain: 1
minDiscernment: 5
source: [master_tarn_gift, black_market]
flavor: 「主人說，能讀帳的奴隸比單純能打的值三倍。」
onRead:
  effects:
    - {type:'attr', key:'WIL', delta:1}
    - {type:'money', delta:50}   # 讀完獲得小額獎金（主人給的津貼）
  unlockFlag: can_read_ledger   # 未來解鎖「管帳」側線任務
```

**獲取**：
- 主人塔倫對貴族 origin 玩家主動贈
- 黑市買（200 銀幣）

---

## 二、傳記 / 哲學（Memoir）— 3 本

### 4. `old_general_memoir` 老將軍回憶錄

```yaml
name: 《老將軍回憶錄》
nights: 7
discernmentGain: 1
minDiscernment: 3
source: [officer_gift_loyal, market_buy]
flavor: 「一個老人寫的仗。他活下來了 — 靠什麼？」
onRead:
  grantTrait: iron_will          # 讀完獲得鐵意志特性（非軸）
  unlockFlag: read_general_memoir
```

**獲取**：
- 長官好感 70+ 贈
- 市場 80 銀幣

---

### 5. `odysseus_tale` 奧德修斯傳

```yaml
name: 《奧德修斯傳》
nights: 8
discernmentGain: 2
minDiscernment: 4
source: [cassius_gift_rare, festival_prize]
flavor: 「一個靠智慧而非力量回家的人。」
onRead:
  grantTrait: cunning            # 獲得「狡智」特性（新增非軸特性）
  unlockFlag: read_odysseus
```

**獲取**：
- 卡西烏斯好感 80+（深度對話後）
- 季節祭典獎品

---

### 6. `martyr_saint_life` 殉道聖者列傳

```yaml
name: 《殉道聖者列傳》
nights: 6
discernmentGain: 1
minDiscernment: 3
source: [starting_item_believer, temple_event]
flavor: 「為信念而死的人，他們後悔過嗎？」
onRead:
  grantTrait: faithful           # 獲得「虔誠」特性（非軸，Phase 2 再擴）
  effects: [{type:'moral', axis:'pride', side:'positive', weight:1}]
  unlockFlag: read_martyr
```

**獲取**：
- 信徒 origin 起手物
- 神殿事件獎勵

---

## 三、技能秘術（Skill）— 3 本

> 🔓 技能書無見識門檻，傻福玩家可讀 → 戰力補償路線

### 7. `family_sword_manual` 家傳劍譜

```yaml
name: 《林氏家傳劍譜》
nights: 5
discernmentGain: 0
minDiscernment: 0
source: [starting_item_ruinedKnight]
flavor: 「你家族留給你的最後一件東西。紙張發黃，字跡模糊。」
onRead:
  grantSkill: sweep_slash        # 橫掃主動技能
  unlockFlag: read_family_manual
```

**獲取**：
- 沒落騎士 origin 起手物

---

### 8. `berserker_fist_scroll` 血怒拳譜

```yaml
name: 《血怒拳譜》
nights: 4
discernmentGain: 0
minDiscernment: 0
source: [tiger_striped_drop, gladiator_memento]
flavor: 「字少圖多。翻到後面全是沾血的拳印。」
onRead:
  grantSkill: berserker_rage     # 血怒被動：HP<30% 時 ATK +20%
  effects: [{type:'moral', axis:'mercy', side:'negative', weight:1}]
  unlockFlag: read_berserker
```

**獲取**：
- 擊敗 `tiger_striped` 後拾獲
- 角鬥士遺物事件

---

### 9. `shield_wall_essay` 盾牆心訣

```yaml
name: 《盾牆心訣》
nights: 5
discernmentGain: 0
minDiscernment: 0
source: [officer_reward, veteran_gift]
flavor: 「一個活過二十年的老兵寫的。盾不是擋，是問候。」
onRead:
  grantSkill: shield_wall        # 盾牆反擊主動技（需裝備盾）
  unlockFlag: read_shield_wall
```

**獲取**：
- 長官好感 60+ 且裝備盾
- 老兵 NPC 事件（Phase 2）

---

## 四、藍圖（Blueprint）— 2 本

### 10. `twin_blade_schematic` 雙刃合鑄法

```yaml
name: 《雙刃合鑄法殘篇》
nights: 4
discernmentGain: 0
minDiscernment: 5
source: [blacksmith_forge_event, market_rare]
flavor: 「兩把破劍熔在一起 — 鐵匠說這是可能的。」
onRead:
  unlockFlag: knows_twin_blade_recipe
  triggerEvent: blacksmith_twinblade_offer    # 觸發鍛造師事件
```

**獲取**：
- 鍛造事件（Phase 2）
- 市場稀有（300 銀幣）

**後續**：觸發鐵匠事件 → 花 2 把舊劍 + 150 金錢 → 打造「雙刃」獨特武器

---

### 11. `herbal_recipe_tome` 草藥配方集

```yaml
name: 《草藥配方集》
nights: 5
discernmentGain: 0
minDiscernment: 5
source: [doctor_mo_gift, black_market]
flavor: 「老默的筆記。字跡很亂，但方子清楚。」
onRead:
  unlockFlag: knows_herbal_recipes
  triggerEvent: doctor_mo_herbal_offer       # 觸發老默事件
```

**獲取**：
- 老默好感 70+
- 黑市密醫販售

**後續**：觸發老默合作事件 → 採藥 mini-quest → 獲得「治療藥劑」可用品

---

## 五、藏寶圖 / 秘密（Map / Secret）— 2 本

### 12. `red_cliff_treasure_map` 赤崖藏寶圖

```yaml
name: 《赤崖藏寶圖殘片》
nights: 3
discernmentGain: 0
minDiscernment: 8
source: [orlan_plot_event, grave_robber_event]
flavor: 「奧蘭塞給你這張紙 — 他的眼睛在發光。」
onRead:
  unlockFlag: has_red_cliff_map
  triggerEvent: red_cliff_expedition          # 觸發挖寶事件鏈
```

**獲取**：
- 奧蘭密謀事件（好感 80+）
- 盜墓者 NPC 事件（Phase 3）

**後續**：觸發夜間密謀 → 奧蘭 + 玩家潛出訓練場 → 挖寶 mini-quest → 成功 300 金幣 / 失敗扣好感扣 HP

---

### 13. `master_son_plot` 主人兒子的密函

```yaml
name: 《塔倫少主密函》
nights: 4
discernmentGain: 0
minDiscernment: 10
source: [servant_drop_event, stolen_from_mansion]
flavor: 「一封不該被你看到的信。裡面有計畫。」
onRead:
  unlockFlag: knows_heir_plot
  triggerEvent: master_heir_choice            # 觸發重大抉擇事件
```

**獲取**：
- 侍從遺失事件
- 潛入主人府的秘密事件（Phase 2）

**後續**：觸發重大抉擇 — 告發主人（主人好感暴漲）/ 袖手（被少主拉攏）/ 裝作沒看過（安全但損失機會）。主人活著或換新主人都可能，**但玩家仍是角鬥士，百日祭照常辦**。

---

## 特性 / 技能定義新增清單

### 新增特性

| id | 名稱 | 類型 | 效果 |
|---|---|---|---|
| `cunning` | 狡智 | 非軸 | 好感事件額外 +1 選項 / 對話揭露 +1 線索 |
| `faithful` | 虔誠 | 非軸 | mood 下限 +5 / 神殿事件獎勵 ×1.5 |
| `brave` | 勇敢 | 非軸 | 戰鬥首回合 ATK +10% / 絕望抵抗 |
| `partialLiterate` | 粗識文字 | 非軸 | 解鎖少數文字對話選項 / 傻福中間態保留 |

### 新增技能

| id | 名稱 | 類型 | 效果 |
|---|---|---|---|
| `sweep_slash` | 橫掃 | 主動 | 攻擊前排 2 敵人，傷害 80% |
| `berserker_rage` | 血怒 | 被動 | HP<30% 時 ATK +20% |
| `shield_wall` | 盾牆 | 主動 | 需盾，當回合免傷 + 反擊 50% |

詳細技能效果待 `skills.js` 擴充時定義。

---

## 實作檢查清單

### 必須新增的檔案

- [ ] `books.js` — 書本資料定義（上述 13 本的 `BOOKS` 物件）
- [ ] `bookshelf.js` 或併入 `main.js` — 書櫃 UI + 睡前讀書事件
- [ ] 新增 `player.discernment` / `player.bookshelf[]` / `player.focusBookId` / `player.readBooks[]`
- [ ] 存檔 schema v6（含書櫃狀態）

### 必須修改的既有檔案

- [ ] `origins.js` — 為沒落騎士 / 手工匠 / 信徒 / 貴族加 `startingBooks`
- [ ] `config.js` — 新增特性 / 技能定義
- [ ] `effect_dispatcher.js` — 支援 `{type:'discernment', delta}` 類型
- [ ] `stats.js` — 加 `modDiscernment()` helper
- [ ] `cassius_events.js` / `doctor_events.js` / `officer_events.js` — 加贈書事件
- [ ] `stage.js` — 加睡前讀書過場 `playBookReading(bookId)`
- [ ] 角色頁 UI — 新增「書櫃」tab

### 存檔遷移

```js
// v5 → v6 migration
if (save.schema === 5) {
  save.player.discernment = 0
  save.player.bookshelf = []
  save.player.focusBookId = null
  save.player.readBooks = []
  save.schema = 6
}
```

---

## 未來擴充方向（Phase 2 / 3）

### 更多書本類型

- **日記殘頁**：揭露特定 NPC 過往（不影響數值，純故事）
- **密典 / 禁書**：讀完有風險（被主人發現、道德衝擊）
- **預言書**：暗示結局走向（Phase 3）

### 書本的「深度閱讀」機制

- 同一本書可以讀第二次（花更多晚）獲得「深讀」版本
- 深讀 = 額外見識 + 獨特 storyReveal
- 限於哲學 / 傳記類（技能書讀一次就學會）

### 書本交易系統

- Phase 2 後可跟書販 NPC 交易
- 複本書可以賣錢
- 稀有書可能被偷（事件）

---

## 相關文件

- [reading.md](reading.md) — 核心讀書系統規範
- [traits.md](traits.md) — 特性定義（含新增 4 個）
- [origins.md](origins.md) — 起手書與 origin 關聯
