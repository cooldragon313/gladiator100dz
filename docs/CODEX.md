# 📕 百日萬骸祭 · 完整字典（Codex）

> 查找所有精緻做的東西 — 特性、書、origin、傷勢、見識、旗標、數字。
> 來源：config.js / books.js / origins.js / wounds.js / stats.js 實際程式碼
> 最後更新：2026-04-19

---

## 📑 目錄

- [🎲 特性字典](#-特性字典)
- [📚 書本字典](#-書本字典)
- [🧬 Origin 字典](#-origin-字典)
- [💥 傷勢字典](#-傷勢字典)
- [📖 見識字典](#-見識字典)
- [🩺 病痛字典](#-病痛字典)
- [🏷️ 旗標字典](#-旗標字典)
- [💢 強迫症字典](#-強迫症字典)
- [💭 情緒倍率](#-情緒倍率emotion-modulator)
- [🎯 數字速查表](#-數字速查表)
- [🔗 系統檔案索引](#-系統檔案索引)

---

## 🎲 特性字典

### A. 軸上特性（10 個，5 對互斥）

每軸最多一個特性。透過玩家選擇推進（N=3 滑動窗口，一次反向會失去）。

| 軸 | 正向 | 負向 | 來源 |
|---|---|---|---|
| reliability 可靠 | **reliable** 可靠 | **coward** 膽小鬼 | 選擇累積 |
| mercy 仁慈 | **merciful** 仁慈 | **cruel** 殘忍 | 戰鬥/事件選擇 |
| loyalty 忠誠 | **loyal** 忠誠 | **opportunist** 投機 | 背叛/保護選擇 |
| pride 謙卑 | **humble** 謙卑 | **prideful** 驕傲 | 互動選擇 |
| patience 耐心 | **patient** 耐心 | **impulsive** 衝動 | 行動選擇 |

**機制**：Moral.push(axis, side) 累積 3 次同向獲得特性。weight:1 普通事件 / weight:3 關鍵事件一次定型 / lock:true 劇情鎖死。

---

### B. 非軸特性（獨立，可同時擁有）

#### 積極（Positive）

| ID | 名稱 | 效果 | 來源 |
|---|---|---|---|
| `kindness` | 寬厚 | 隊友好感成長速度 +20% | farmBoy / artisan / believer origin |
| `diligence` | 勤勉 | 所有屬性訓練 EXP +10% | farmBoy / artisan origin / 讀書自發 |
| `iron_will` | 鐵意志 | WIL 訓練效率 +15% | 讀《老將軍回憶錄》/ 自然癒合獎勵 |
| `survivor` | 戰場老兵 | 競技場 ACC +3 | beggar origin / 戰鬥累積 |
| `unbreakable` | 不屈之身 | HP 跌至 20% 以下時 ATK +15% | 自然癒合獎勵（有 iron_will 時給此）|
| `literate` | 識字 | 解鎖讀書 + 文字對話選項 | nobleman / ruinedKnight / believer 起手 / 讀《三千常用字》|
| `silverTongue` | 巧舌 | 睡前可說故事給隊友聽 | gambler origin |
| `cunning` | 狡智 | 對話選項 +1 / 故事揭露線索 +1 | 讀《奧德修斯傳》|
| `faithful` | 虔誠 | mood 下限 +5 / 神殿事件獎勵 ×1.5 | 讀《殉道聖者列傳》/ believer origin |
| `brave` | 勇敢 | 戰鬥首回合 ATK +10% / 抵抗絕望 | 戰鬥事件累積 |
| `partial_literate` | 粗識文字 | 解鎖少數文字對話選項（傻福玩家專用中間態）| 傻福半醒期選擇停留 |

#### 負面（Negative）

| ID | 名稱 | 效果 | 來源 |
|---|---|---|---|
| `reckless` | 急躁 | 訓練受傷機率 +5% | criminal origin |
| `shaken` | 信心崩潰 | 所有屬性訓練效率 −10% | 戰敗事件 |
| `neurotic` | 神經質 | 正向好感成長 −20% / 夜間故事觸發 ×1.5 | 事件 |
| `brooding` | 鬱結 | 心情恢復 −20% / 獨處時觸發深層記憶 | 事件 |
| `STR_addict` | 力癮 | 連 5 天做 STR 訓練 → 養成。做則 mood+3 / 不做夜彈選擇 / 拒絕 mood-5 累進 | 連續訓練 |
| `AGI_addict` | 敏癮 | 連 5 天做 AGI 訓練 → 養成。同上 | 連續訓練 |
| `CON_addict` | 韌癮 | 連 5 天做 CON 訓練 → 養成。同上 | 連續訓練 |
| `WIL_addict` | 禪癮 | 連 5 天做 WIL 訓練 → 養成。同上 | 連續訓練 |

---

### C. 出生稀有特性（10 個軸組，1% 獨立擲骰）

5 軸互斥，每軸最多一個。`isRare: true` + `birthAxis` + `birthSide` 標記。

#### 智力軸（intelligence）

| 特性 | 效果（完整數字）|
|---|---|
| **天才** genius（正） | 訓練 EXP **+15%** / WIL **+2** / 能看懂複雜對話 / 讀書吸收 ×1.5 |
| **傻人傻福** dullard_lucky（正）| 訓練 EXP **−15%** / WIL **−2** / 不識字 / LUK 三取最高 / 奇遇 +80% / 笑躲攻擊 **20%** / 暴擊 **+15%** / 永不絕望 |
| **愚鈍** dull（負）| 訓練 EXP **−10%** / WIL **−3** / 難以識字 / 對話選項減少 |

#### 體質軸（constitution）

| 特性 | 效果 |
|---|---|
| **鐵人** ironclad（正）| CON **+3** / HP 上限 **+15%** / 疾病抗性 **+50%** / 受傷不留疤 |
| **病弱** sickly（負）| CON **−3** / 疾病抗性 **−50%** / 隨機患病機率 **+30%** |

#### 運勢軸（luck）

| 特性 | 效果 |
|---|---|
| **福星高照** fortunate（正）| LUK **+3** / 奇遇觸發率 **+50%** / 受傷 20% 機率減輕為輕傷 |
| **厄運之子** cursed（負）| LUK **−3** / 奇遇觸發率 **−50%** / 暴擊受傷機率 **+10%** |

#### 心性軸（spirit）

| 特性 | 效果 |
|---|---|
| **神眷之子** blessed（正）| 好感倍率 **×1.2** / mood 下限 **+10** / 絕望抵抗 / 道德崩壞可能失去 |
| **暗影纏身** shadowed（負）| 好感倍率 **×0.8** / mood 下限 **−10** / 信徒與神職者怕你 |

#### 天賦軸（gift）

| 特性 | 效果 |
|---|---|
| **天生戰士** born_warrior（正）| 戰鬥首回合 ATK **+20%** / 怯戰抵抗 / 戰鬥 EXP **+10%** |
| **膽小如鼠** cowardly（負）| 戰鬥首回合 ATK **−10%** / 受傷時可能失控逃跑 |

---

### D. 特性擲骰規則（三層結構）

- **屬性**：每維 base（10 + origin.statMod）± 2 隨機
- **出生特性**：分三層獨立擲骰 — 稀有 / 罕見 / 常見
- **重擲 2 次**：玩家可拒絕結果，最多 2 次，第 3 次強制接受
- **自動跳過**：若 origin 已給某特性（startingTraits），擲骰時跳過

#### 三層機率表

| 層級 | 機率 | 池子大小 | 期望值 / 角色 |
|---|---|---|---|
| **稀有 rare** | 1% / 軸（5 軸）| 10 個（5 正 + 5 負） | ~0.1（10% 玩家有）|
| **罕見 uncommon** | 3% / 項 | 4 個（3 正 + 1 負）| ~0.12 |
| **常見 common** | 10% / 項 | 6 個（3 正 + 3 負）| ~0.6 |

**合計期望**：每角色 ~0.8 個出生特性（不含 origin 起手特性）
**加上 origin 起手 1-2 個**：平均總共 1.8-2.8 特性/角色

#### 各層特性清單

**稀有（Rare）**：見「C. 出生稀有特性」章節 — genius / dullard_lucky / dull / ironclad / sickly / fortunate / cursed / blessed / shadowed / born_warrior / cowardly

**罕見（Uncommon）**：
- 正：iron_will（鐵意志）/ survivor（戰場老兵）/ unbreakable（不屈之身）
- 負：shaken（信心崩潰）

**常見（Common）**：
- 正：kindness（寬厚）/ diligence（勤勉）/ silverTongue（巧舌）
- 負：reckless（急躁）/ neurotic（神經質）/ brooding（鬱結）

---

### E. Origin 設計規範

**新增或調整 origin 必看**：[`docs/systems/origin-design-spec.md`](systems/origin-design-spec.md)

---

### F. 世界觀系統文件（新 Phase 2 設計稿）

| 文件 | 內容 |
|---|---|
| [`docs/systems/mansion-geography.md`](systems/mansion-geography.md) | 大宅地理規範 — 主人家 + 訓練場**同座建築複合**，正門/側門/共用中段 |
| [`docs/systems/master-family-spec.md`](systems/master-family-spec.md) | 訓練所家庭通用規範 — archetype 模板、家族動力、檢查清單 |
| [`docs/systems/found-family.md`](systems/found-family.md) | 新家人系統 — NPC 以家人稱呼確認關係的儀式 |
| [`docs/characters/livia.md`](characters/livia.md) | 主人娘 Livia（隱形善意源頭，Phase 2/3 登場）|
| [`docs/characters/marcus.md`](characters/marcus.md) | 少爺 Marcus（真正反派，殘忍沙包型，Phase 2 登場）|

**阿圖斯家族配置**：阿圖斯（冷血商人）/ Livia（善良資助者）/ Marcus（殘忍施虐者）

包含：
- 完整欄位清單 + 範例
- statMod 平衡原則（總和 ±4 / 至少 1 個負值）
- startingTraits 原則（0-2 個，非稀有軸組）
- startingBooks 原則（階級現實）
- initialNpcAffection 原則（±10 內）
- 難度分級（1-5 星）
- 被抓損失配置
- 受傷部位權重
- 回憶對白矩陣（origin × 4 部位 = 32 變化）
- 🆕 未來擴充：Origin 起手技能（startingSkillRolls）
- 🆕 未來擴充：Origin 專屬事件（Day 20/40/60/80/95）
- 新 origin 檢查清單

---

## 📚 書本字典

### 五大分類

| 類型 | 推見識？ | 影響傻福？ |
|---|---|---|
| **literacy** 識字本 | ✅ 主力 | ✅ 推衰退 |
| **memoir** 傳記/哲學 | ✅ 小量 | ✅ 推衰退 |
| **skill** 技能秘術 | ❌ | ❌ |
| **blueprint** 藍圖 | ❌ | ❌ |
| **map** 藏寶/秘密 | ❌ | ❌ |

---

### 識字本（3 本）

| ID | 書名 | 晚數 | 見識 | 門檻 | 效果 | 來源 |
|---|---|---|---|---|---|---|
| `children_reader` | 《百字蒙書》| 6 | +2 | 0 | WIL+1 / flag: read_children_reader | 卡西烏斯贈 / 梅拉贈 / 市場 50 金 |
| `common_words_3000` | 《三千常用字》| 8 | +3 | 2 | WIL+2 / 獲得 literate | 卡西烏斯進階贈 / 長官賞 |
| `merchant_ledger` | 《商賈帳本要義》| 5 | +1 | 5 | WIL+1 / +50 金 / flag: can_read_ledger | 主人塔倫贈貴族玩家 / 黑市 200 金 |

---

### 傳記 / 哲學（3 本）

| ID | 書名 | 晚數 | 見識 | 門檻 | 效果 | 來源 |
|---|---|---|---|---|---|---|
| `old_general_memoir` | 《老將軍回憶錄》| 7 | +1 | 3 | 獲得 iron_will | 長官好感 70+ / 市場 80 金 |
| `odysseus_tale` | 《奧德修斯傳》| 8 | +2 | 4 | 獲得 cunning | 卡西烏斯好感 80+ / 祭典獎品 |
| `martyr_saint_life` | 《殉道聖者列傳》| 6 | +1 | 3 | 獲得 faithful / moral pride+1 | believer 起手 / 神殿事件 |

---

### 技能秘術（3 本）— 無見識門檻，傻福玩家可讀

| ID | 書名 | 晚數 | 獲得技能 | 副作用 | 來源 |
|---|---|---|---|---|---|
| `family_sword_manual` | 《林氏家傳劍譜》| 5 | `sweep_slash` 橫掃 | 無 | ruinedKnight 起手 |
| `berserker_fist_scroll` | 《血怒拳譜》| 4 | `berserker_rage` 血怒被動 | moral mercy−1 | 擊敗 tiger_striped 掉落 |
| `shield_wall_essay` | 《盾牆心訣》| 5 | `shield_wall` 盾牆反擊 | 無 | 長官好感 60+ & 裝盾 |

---

### 藍圖（2 本）

| ID | 書名 | 晚數 | 門檻 | 觸發事件 | 來源 |
|---|---|---|---|---|---|
| `twin_blade_schematic` | 《雙刃合鑄法殘篇》| 4 | 5 | blacksmith_twinblade_offer | 鍛造事件 / 市場 300 金 |
| `herbal_recipe_tome` | 《草藥配方集》| 5 | 5 | doctor_mo_herbal_offer | 老默好感 70+ / artisan 起手 / 黑市 |

---

### 藏寶圖 / 秘密（2 本）

| ID | 書名 | 晚數 | 門檻 | 觸發事件 | 來源 |
|---|---|---|---|---|---|
| `red_cliff_treasure_map` | 《赤崖藏寶圖殘片》| 3 | 8 | red_cliff_expedition | 奧蘭密謀事件（好感 80+）|
| `master_son_plot` | 《塔倫少主密函》| 4 | 10 | master_heir_choice | 侍從遺失事件 / 潛入主人府 |

---

### 書櫃機制

- **上限** 5 本未讀書
- **專心書**：標記後每晚 ×1.0（滿速）
- **貪多嚼不爛 debuff**（未設專心書）：
  - 3 本 → ×0.7
  - 4 本 → ×0.5
  - 5 本 → ×0.4
- **勤勉特性**：睡前讀書進度 +0.1 額外加成
- **見識對速度**：`進度 × (1 / (1 - 見識 × 0.03))` → 見識越高讀越快

---

## 🧬 Origin 字典

8 個出身（完整）。每個的 statMod 會套用到擲骰 base（+隨機 ±2）。

### farmBoy 農家子弟
- **StatMod**: STR+2 / CON+3 / DEX−1 / WIL−1
- **起手特性**: diligence + kindness
- **起手書**: 無
- **起手錢**: 0
- **初始好感**: dagiSlave +5 / oldSlave +10
- **開場敘述**: 「你記得那天。煙從田邊升起。」
- **難度**: 較易（overall 2）
- **受傷偏好**: torso > legs > arms > head

### nobleman 落難貴族
- **StatMod**: WIL+2 / DEX+1 / LUK+2 / STR−2 / CON−2
- **起手特性**: literate + prideful
- **起手書**: 《商賈帳本要義》（已識字可直接讀）
- **起手錢**: 20
- **初始好感**: officer +5 / overseer +3 / masterArtus +5 / melaKook −5 / dagiSlave −10
- **開場敘述**: 「你曾穿絲綢，飲金盞。」
- **難度**: 較難（overall 4）
- **受傷偏好**: torso > head > legs > arms

### ruinedKnight 沒落騎士
- **StatMod**: STR+2 / DEX+2 / WIL+1 / CON+1 / LUK−1
- **起手特性**: literate + iron_will
- **起手書**: 《林氏家傳劍譜》（讀完獲橫掃技能）
- **起手錢**: 10
- **初始好感**: officer +10 / masterArtus +3 / orlan +5
- **開場敘述**: 「你家族的徽記早已落入泥土。」
- **難度**: 中（combat 1）
- **受傷偏好**: arms > torso > legs > head

### beggar 乞丐
- **StatMod**: AGI+2 / LUK+2 / CON−1 / WIL−1
- **起手特性**: survivor
- **起手書**: 無
- **起手錢**: 0
- **初始好感**: melaKook +5 / dagiSlave +5 / orlan +3 / officer −5
- **開場敘述**: 「沒有家。沒有屋頂。只有街角。」
- **難度**: 較難（survival 1 但 resource 3）
- **受傷偏好**: legs > arms > torso > head

### artisan 手工匠
- **StatMod**: STR+1 / DEX+2 / CON+2 / WIL+1 / LUK−1
- **起手特性**: diligence + kindness
- **起手書**: 《草藥配方集》（需見識 5，要累積才能讀）
- **起手錢**: 15
- **初始好感**: blacksmithGra +10 / oldSlave +5
- **開場敘述**: 「你的手指記得每一個工具。」
- **難度**: 中（overall 2）
- **受傷偏好**: arms > torso > legs > head

### criminal 罪犯
- **StatMod**: STR+1 / AGI+2 / WIL+1 / CON+1 / LUK−2
- **起手特性**: reckless
- **起手書**: 無
- **起手錢**: 0
- **初始好感**: orlan −5 / dagiSlave −5 / melaKook −10 / officer +3
- **開場敘述**: 「你不記得那人的臉了。血、一把刀、一個錯誤。」
- **難度**: 中（combat 1 但 social 3）
- **受傷偏好**: 全部平均（torso / arms / legs / head 各 2 權重）

### gambler 賭徒
- **StatMod**: DEX+1 / WIL+1 / LUK+3 / STR−1 / CON−1
- **起手特性**: silverTongue
- **起手書**: 無
- **起手錢**: 5
- **初始好感**: orlan +5 / melaKook −3 / officer −3
- **開場敘述**: 「你賭過最後一枚金幣。」
- **難度**: 中偏難（combat 3）
- **受傷偏好**: torso > arms > legs > head

### believer 信徒
- **StatMod**: WIL+3 / CON+1 / LUK+1 / STR−1 / DEX−1
- **起手特性**: literate + kindness
- **起手書**: 《殉道聖者列傳》
- **起手錢**: 0
- **初始好感**: melaKook +10 / oldSlave +5 / officer −5
- **開場敘述**: 「你在神殿長大。你誦讀聖典。」
- **難度**: 較難（combat 3）
- **受傷偏好**: head > torso > legs > arms

---

### 被抓基礎損失（各 origin 不同）

| Origin | HP 損 | food 損 | mood 損 |
|---|---|---|---|
| farmBoy | 10 | 20 | 25 |
| nobleman | 8 | 15 | 40 |
| ruinedKnight | 15 | 10 | 20 |
| beggar | 5 | 25 | 15 |
| artisan | 8 | 15 | 20 |
| criminal | 10 | 10 | 10 |
| gambler | 8 | 18 | 25 |
| believer | 6 | 15 | 15 |

---

## 💥 傷勢字典

### 部位 → 屬性對應（5 部位）

| 部位 ID | 部位名 | 主要屬性 | 次要影響（預留）|
|---|---|---|---|
| `head` | 頭部 | WIL | 晨思觸發率 / 暴擊抵抗 |
| `torso` | 軀幹 | CON | HP 上限 / 耐力恢復 |
| `arms` | 手臂 | STR | 武器裝備限制（雙手武器）|
| `legs` | 腿部 | AGI | 行動速度 / 潛行 |
| `mind` | 精神 🆕 | WIL（mind 傷對所有訓練扣減）| 睡眠 / mood 上限 |

### 🆕 特殊傷（永久類，通常需改造人）

| ID | 名稱 | 部位 | 屬性懲罰 | 訓練 EXP 扣減 | 其他效果 |
|---|---|---|---|---|---|
| `concussion` | 腦震盪 | head | WIL −8 | ×0.60 | 讀書失效、戰鬥 SPD−15 |
| `achilles_tear` | 阿基里斯腱撕裂 | legs | AGI −8 | ×0.50 | 跑動類訓練失效 / 永久 |
| `insomnia` | 失眠症 | mind | − | 所有訓練 ×0.85 | 夜間 stamina 上限 15 / rest -3 stamina -3 mood |
| `depression` | 憂鬱症 | mind | − | 所有訓練 ×0.90 | mood 上限 −15 |

**資料結構**：
```js
player.wounds.head = null | { severity:1-3, daysElapsed } | { special:'concussion', daysElapsed }
```

特殊傷覆蓋同部位的一般傷（更嚴重）。

### 嚴重度 → 懲罰（完整數字）

| 級別 | 屬性減免 | 訓練 EXP 倍率 | 自癒時間 |
|---|---|---|---|
| **1 輕傷** | **−2** | **×0.90** | 4 天自動 |
| **2 中傷** | **−4** | **×0.80** | 不治療 15 天 / 治療後 7 天 |
| **3 重傷** | **−6** | **×0.70** | **永久**（除密醫 / 自然癒合）|

### 觸發率速查

#### 1. 開場被抓受傷（🆕 2026-04-19 重新設計）

**16 種傷各 3% 獨立擲骰**（一般 12 + 特殊 4）：
- 一般：4 部位 × 3 級 × 3% 每個
- 特殊：4 種（腦震盪 / 阿基里斯腱 / 失眠症 / 憂鬱症）× 3% 每個
- 可能擲到多個傷（殘廢開局 = 改造人伏筆）

**機率預估**：
- P(至少 1 個) ≈ 38.6%
- P(2+ 個) ≈ 9.1%
- P(3+ 個) ≈ 1.5%
- P(特殊 ≥ 1) ≈ 11.5%
- 全中 16 個 ≈ 天文數字（彩蛋）

#### 2. 低體力訓練擲新傷

| Stamina | 輕傷 | 中傷 | 重傷 |
|---|---|---|---|
| > 50 | 0% | 0% | 0% |
| 30-50 | 5% | 0% | 0% |
| 15-30 | 15% | 3% | 0% |
| 5-15 | 30% | 10% | 2% |
| < 5 | 0% | 50% | 15% |

#### 3. 有傷訓練「好痛」觸發

| 現有嚴重度 | 觸發率 | 效果 |
|---|---|---|
| 輕傷 | **30%** | 失訓練 / HP−3 / ⚡−10 / 震動 |
| 中傷 | **60%** | 失訓練 / HP−8 / ⚡−20 / 震動 / **10% 機率升重傷** |
| 重傷 | **90%** | 幾乎必失 / HP−15 / ⚡−30 / 震動 |

### 訓練 × 部位對應（觸發來源）

| 訓練類型 | 目標屬性 | 高風險部位 |
|---|---|---|
| 基礎揮砍 / 重量訓練 | STR | arms + torso |
| 步法練習 | AGI | legs |
| 耐力訓練 | CON | torso + legs |
| 冥想 / 讀書 | WIL | head |
| 幸運 / 觀察類 | LUK | 無 |

### 恢復路徑

| 路徑 | 條件 | 結果 |
|---|---|---|
| **A. 自癒**（主流）| 輕傷 4 天 / 中傷 15 天 | 自動 |
| **B. 老默治療** | ailment 訪視治療 | flag: wound_treated_{part} → 自癒加速到 7 天 |
| **C. 自然癒合重傷** | WIL ≥ 20 + 老默好感 ≥ 80 + 養傷 30 天 | 重傷→中傷 + 獲得 iron_will 或 unbreakable |
| **D. 黑市改造**（Phase B 未做）| 拿到 black_doc_contact | 四選一奇觀改造 |

### 老默三階段暗示 → 密醫引薦

| Stage | 觸發條件 | 結果 / Flag |
|---|---|---|
| **1. 首次警告** | 第一次診到玩家重傷 | flag: doctor_saw_severe_wound + 「這傷我只能幫你止血」對白 |
| **2. 觀察期** | 重傷已過 10 天 + 仍在訓練 + Stage 1 完成 | flag: doctor_hinted_black_doc + days_since_black_doc_hint=0 + 「等你準備好，我有個朋友」對白 |
| **3. 密醫引薦** | Stage 2 後 5 天 | flag: got_black_doc_contact + personalItem: black_doc_contact + 「他不是醫生，做的事神看了會皺眉」對白 |

---

## 📖 見識字典

### 見識（discernment）閾值效果

| 見識 | 訓練 EXP 加成 | 閾值提示 |
|---|---|---|
| 0 | ±0（無加成）| — |
| 3 | **+10%** | 「你感覺思路清晰了一些」 |
| 5 | **+20%** | （傻福玩家半醒觸發）|
| 8 | **+35%** | 「你的思路越來越敏銳」 |
| 12 | **+50%** | （傻福玩家清醒觸發 10+）|

### 讀書速度倍率

```
讀書晚數 × (1 - 見識 × 0.03) = 實際晚數
```

| 見識 | 速度倍率 | 讀 6 晚書變 |
|---|---|---|
| 0 | ×1.00 | 6 晚 |
| 3 | ×0.91 | ~5.5 晚 |
| 8 | ×0.76 | ~4.5 晚 |
| 15 | ×0.55 | ~3.3 晚 |
| 20 | ×0.40 | ~2.4 晚 |

### 傻福三階段

| 階段 | 見識 | 訓練 EXP | 福氣加成 | 缺陷 |
|---|---|---|---|---|
| 0 完整 | 0-4 | −15% | LUK 三取最高 / 奇遇 +80% / 笑躲 20% / 暴擊 +15% / 永不絕望 | 文盲 / WIL−2 |
| 1 半醒 | 5-9 | −5% | LUK 二取最高 / 奇遇 +40% / 笑躲 10% / 暴擊 +5% / 不易絕望 | 粗識文字 / WIL−1 |
| 2 清醒 | 10+ | ±0 | 無（全失）| 獲得 literate + WIL+2 |

**半醒觸發**：讀完文字書見識達 5，flag: `dullard_half_awakened_warned` → DialogueModal 警告 + ChoiceModal 二選一：
- A 「繼續，我想看見這個世界」 → flag: `dullard_chose_continue` → 見識正常累積
- B 「夠了，我這樣挺好」 → 獲得 `partial_literate` + flag: `refused_awakening` + 所有文字書從書櫃移除

**清醒觸發**：見識達 10，flag: `dullard_awakened` → 移除 dullard_lucky + 獲得 literate + WIL+2

---

## 🩺 病痛字典（AILMENT_DEFS）

### 現有病痛（config.js:AILMENT_DEFS）

| ID | 名稱 | 效果 | 來源 |
|---|---|---|---|
| `insomnia_disorder` | 失眠症 | 就寢 stamina 恢復上限減半 | 連續壞睡 ≥2 天 |
| `mild_wound` | 輕傷 | 被動扣 HP / 部位影響訓練 | 事件 |
| `bruised_ribs` | 肋骨瘀傷 | 耐力訓練 −20% | 事件 |
| `shaken_nerves` | 驚魂未定 | mood 波動大 | 事件 |

（注意：此表為 ailments，與新系統 wounds 不同。wounds 是結構化部位傷，ailments 是單一病痛狀態。）

---

## 🏷️ 旗標字典

### 劇情 flag（D.28 核心）

| Flag | 意義 | 寫入時機 |
|---|---|---|
| `village_burned` | farmBoy 村莊被燒 | origin 設定 |
| `noble_fall` | nobleman 家族敗落 | origin 設定 |
| `knight_fallen` | ruinedKnight 家族已敗 | origin 設定 |
| `met_doctor` | 已見老默 | 首次訪視 |
| `separated_from_olan` | 奧蘭分房 | orlan_events |
| `shared_olans_punishment` | 偷藥替罪 | orlan_events |
| `betrayed_olan` | 告發奧蘭（不可逆）| orlan_events |
| `saw_olan_at_apothecary` | 看見奧蘭偷藥 | 藥房事件 |
| `olan_apothecary_resolved` | 藥房懸念解決 | 各種選擇 |

### 傷勢系統 flag（新）

| Flag | 意義 | 寫入時機 |
|---|---|---|
| `doctor_saw_severe_wound` | 老默已提醒重傷（Stage 1）| 首次診到重傷 |
| `doctor_hinted_black_doc` | Stage 2 暗示觸發 | 重傷 10 天 + 仍訓練 |
| `days_since_black_doc_hint` | Stage 2 後天數計數 | DayCycle 每日 +1 |
| `got_black_doc_contact` | 拿到密醫紙條 | Stage 3 完成 |
| `wound_treated_{part}` | 該部位已治療（加速自癒）| 老默治療時 |
| `natural_recovery_triggered_{part}` | 自然癒合已觸發（一次性）| 條件滿足時 |

### 讀書系統 flag（新）

| Flag | 意義 | 寫入時機 |
|---|---|---|
| `read_book_{id}` | 讀完某本書 | 讀書完成 |
| `knows_blueprint_{id}` | 讀完藍圖 | 藍圖讀完 |
| `has_map_{id}` | 讀完地圖 | 地圖讀完 |
| `dullard_half_awakened_warned` | 傻福半醒警告已觸發 | 見識達 5 |
| `dullard_chose_continue` | 選擇繼續讀下去 | 半醒 ChoiceModal |
| `refused_awakening` | 選擇停在半醒 | 半醒 ChoiceModal |
| `dullard_awakened` | 傻福完全清醒 | 見識達 10 |

### Flag 命名規範
```
{主題}_{事件}_{狀態}
例：olan_apothecary_resolved / doctor_visit_today / read_book_<id>
```

---

## 💢 強迫症字典

### 四種強迫症（連 5 天同訓練養成）

| ID | 名稱 | 對應訓練 | 獲得條件 |
|---|---|---|---|
| `STR_addict` | 力癮 | STR | 連 5 天做力量訓練 |
| `AGI_addict` | 敏癮 | AGI | 連 5 天做步法訓練 |
| `CON_addict` | 韌癮 | CON | 連 5 天做耐力訓練 |
| `WIL_addict` | 禪癮 | WIL | 連 5 天做冥想訓練 |

### 養成警告期

| 連續天數 | 事件 | 收手時機 |
|---|---|---|
| Day 3 | 「你今天沒練反而覺得不自在⋯」 | ✅ 換訓練即重置 |
| Day 4 | 「你的身體在催促你回到訓練場」 | ⚠ 最後機會 |
| Day 5 | 獲得強迫症特性（紅色）| ❌ 已養成 |

### 三層獎懲

| 情境 | 效果 |
|---|---|
| 白天做對應訓練 | +mood 3（滿足）+ 訓練獎勵 |
| 夜間選補做 | +mood 5 + EXP+5 + stamina-15（無 NPC 加成）|
| 夜間選不做（1 次）| −mood 5 |
| 夜間選不做（2 次）| −mood 10 |
| 夜間選不做（3+ 次）| −mood 15 + 失眠症 + hp-10 |
| 被主線任務/約會占用 | −mood 累進（算被迫拒絕）|

### 解除條件

| 連續不做天數 | 狀態 |
|---|---|
| 10 天 | 日誌：「焦慮慢慢淡了」（減輕，尚未解除）|
| 20 天 | 完全解除 + flag: `overcame_{id}` |
| 中途做一次該訓練 | 歸零，解除進度重置 |

### 夜間 slot 7 優先級鏈

| 優先 | 情境 | 對強迫症的影響 |
|---|---|---|
| 1 | NPC 約會 / 劇情事件 | 被迫拒絕 → 累進 +1 |
| 2 | 主線任務（抓老鼠）| 被迫拒絕 → 累進 +1 |
| 3 | 強迫症彈選擇 | 正常 A/B |
| 4 | 無事 | 靠牆恢復 |

---

## 💭 情緒倍率（Emotion Modulator）

> 故事事件的 mood 效果會根據玩家特性加乘（`_calcEmotionMult` in main.js）

| 特性 | 倍率 | 設計意義 |
|---|---|---|
| `cruel` 殘忍 | **×0.5** | 看到家書 — 無聊 |
| `prideful` 驕傲 | ×0.7 | 輕蔑但不到無視 |
| `blessed` 神眷 | ×0.8 | 信念讓情緒穩 |
| **（無修正）** | ×1.0 | 普通反應 |
| `neurotic` 神經質 | ×1.3 | 感情起伏大 |
| `shadowed` 暗影纏身 | ×1.3 | 黑暗思維放大 |
| `brooding` 鬱結 | **×1.5** | 多愁善感 |

**疊加**：多特性相乘，clamp 到 0.2 ~ 3.0。
**作用範圍**：所有 story reveal 的 `effects` 陣列中 `type:'vital', key:'mood'` 的 delta。

### 使用範例

```js
// npc.js story reveal
{
  id: 'orlan_letter',
  effects: [
    { type: 'vital', key: 'mood', delta: -8 },  // 基礎 -8
    // cruel 玩家實際 = -4
    // brooding 玩家實際 = -12
    // cruel+prideful 玩家實際 = -3
  ],
}
```

---

## 🎯 數字速查表

### 心情倍率（訓練時）

| Mood | 倍率 | 描述 |
|---|---|---|
| ≥ 70 | **×1.25** | 心情佳 |
| 30-70 | ×1.0 | 正常 |
| ≤ 30 | **×0.75** | 心情低落 |
| ≤ 9 | **×0** + 強制取消 | 崩潰（無法訓練）|

### 體力閾值

| Stamina | 效果 |
|---|---|
| > 50 | 訓練無負面 |
| 30-50 | 輕度疲勞可能受傷 5% |
| ≤ 25 | 25% 機率擺爛（×0.4）|
| ≤ 10 | **100% 強制取消訓練**（fatigue_force）|

### 飽食閾值

| Food | 效果 |
|---|---|
| ≥ 70 | 就寢 mood +2 |
| < 30 | 25% 輕度飢餓（×0.75）|
| < 20 | 就寢 mood −5 / hp −3 |
| < 10 | 就寢 mood −8 / hp −5 |

### 🆕 Vital 上限公式（2026-04-19）

| 數值 | 公式 | CON 10 | CON 20 | CON 30 |
|---|---|---|---|---|
| `hpMax` | `hpBase(80) + 2 × CON` | 100 | 120 | 140 |
| `staminaMax` | `50 + 5 × CON` | **100** | **150** | **200** |

升 CON 同時增 HP 上限 + stamina 上限。花 EXP 升 CON 是最佳投資。

### EXP 升級公式

```
升到下一級所需 EXP = ceil(10 × 1.15^(level - 10))
```

| 屬性等級 | 升級所需 EXP |
|---|---|
| 10 → 11 | 10 |
| 15 → 16 | 20 |
| 20 → 21 | 40 |
| 25 → 26 | 81 |
| 30 → 31 | 163 |

### 協力倍率（D.18）

```
總倍率 = mood × 裝備 × (1+護符/特性/屬性/寵物加成) × 訓練所
      × ∏(命名協力) × ∏(背景協力) × (1 + 0.08 × 總人數)

最終硬上限 ×15（mood 在外層另算不納入 cap）
```

### 命名 NPC 協力三段門檻

| 好感 | 倍率 |
|---|---|
| ≥ 30 | ×1.3 |
| ≥ 60 | ×1.6 |
| ≥ 90 | ×1.8 |

### 背景角鬥士熟悉度

| 熟悉度 | 倍率 |
|---|---|
| ≥ 40 | ×1.3（單段）|

### 奧蘭生死援手（Day 30/60/85）

| 觸發 | 效果 |
|---|---|
| HP ≤ 5 生死關頭 | Orlan 出現保護，HP 回到 20 / 特殊對白 |

---

## 🔗 系統檔案索引

### 資料模組

| 模組 | 檔案 | 主要內容 |
|---|---|---|
| 特性定義 | `config.js:TRAIT_DEFS` | 所有特性（軸上 + 非軸 + 出生稀有 + 讀書衍生）|
| 病痛定義 | `config.js:AILMENT_DEFS` | ailments（與 wounds 不同系統）|
| 書本定義 | `books.js:BOOK_DEFS` | 13 本種子書 |
| Origin 定義 | `origins.js:Origins` | 8 origins |
| 武器資料 | `weapons.js:Weapons` | 裝備 picker 用 |
| 武器戰鬥資料 | `測試頁面/testbattle.js:TB_WEAPONS` | 戰鬥引擎用（待統一）|
| 護甲資料 | `armors.js:Armors` | 盾牌 + 護甲 |
| 敵人資料 | `測試頁面/testbattle.js:TB_ENEMIES` | 4 個現有敵人 |

### 系統模組

| 模組 | 檔案 | 主要 API |
|---|---|---|
| 效果派發 | `effect_dispatcher.js` | `Effects.apply(list, ctx)` |
| 玩家統計 | `stats.js` | `Stats.player / eff / modVital / modAttr / modExp / modDiscernment` |
| 道德軸 | `moral.js` | `Moral.push(axis, side, opts)` |
| 傷勢 | `wounds.js` | `Wounds.inflict/heal/checkTrainingPain/rollLowStaminaInjury/onDayStart` |
| 讀書 | `reading.js` + `books.js` | `Reading.tryBedtime/renderBookshelf` + `Books.grantBook/advanceReading` |
| 出生擲骰 | `birth_traits.js` | `BirthTraits.rollAll/rollStats/applyRoll/applyCaptureInjury` |
| 角色生成畫面 | `character_roll.js` | `CharacterRoll.start(originId, onComplete)` |
| 老默事件 | `doctor_events.js` | `DoctorEvents.tryVisit` |
| 奧蘭事件 | `orlan_events.js` | `OrlanEvents.tryDeathSave` |
| 存檔 | `save_system.js` | `SaveSystem.saveToSlot/loadFromSlot` |
| 戰鬥 | `battle.js` | `Battle.start(oppId, onWin, onLose)` |

### 設計文件

| 文件 | 內容 |
|---|---|
| `docs/systems/reading.md` | 讀書系統核心規範 |
| `docs/systems/books-catalog.md` | 13 本種子書完整定義 |
| `docs/systems/wounds.md` | 傷勢系統規範 + 密醫路線 + 結局 |
| `docs/systems/traits.md` | 特性系統 + 出生軸組 + 傻福三階段 |
| `docs/systems/origins.md` | Origin 設計（舊版，部分過時）|
| `docs/systems/night-events.md` | 夜間事件窗口規則 |
| `docs/systems/multi-check-quest.md` | 多階段判定任務範本 |
| `docs/systems/npc-growth.md` | NPC 屬性成長（設計中）|
| `docs/systems/timeline.md` | 百日條動態揭露 |
| `docs/systems/battle-density.md` | 戰鬥相遇頻率設計 |
| `docs/systems/battle-screen-rework.md` | 戰鬥畫面三欄式重構 |
| `docs/philosophy/numbers-hiding.md` | 零數字哲學 / 日誌獎勵分工 |
| `docs/characters/*.md` | 8 個 NPC 角色檔 |
| `docs/quests/mela-rat.md` | 抓老鼠任務 |
| `docs/quests/day1-opening.md` | Day 1 開場 |
| `docs/DIALOGUE-MAP.md` | 對白位置總索引 |
| `docs/CONTENT-TEMPLATES.md` | 內容創作模板（NPC / 武器 / 訓練所）|

---

## 🔍 快速查找情境

- **想知道特性做什麼** → [特性字典](#-特性字典)
- **想知道某本書在哪拿** → [書本字典](#-書本字典)
- **想知道 origin 起手有什麼** → [Origin 字典](#-origin-字典)
- **想知道傷勢怎麼觸發** → [傷勢字典](#-傷勢字典)
- **想查數字（倍率 / 閾值 / 公式）** → [數字速查表](#-數字速查表)
- **想查 flag 名字** → [旗標字典](#-旗標字典)
- **想改程式碼** → [系統檔案索引](#-系統檔案索引)

---

*📝 若發現錯誤或不完整，直接改這份文件 + 對應 md + 程式碼同步。*
