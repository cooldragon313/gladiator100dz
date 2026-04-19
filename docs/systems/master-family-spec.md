# 訓練所家庭設計規範（Master Family Spec）

> 每個訓練所 = 一個家族故事。這份文件定義家族結構的通用模板。
> 設計日期：2026-04-19
> 本規範適用於**所有訓練所**（目前只有阿圖斯家，未來擴充）

---

## 核心理念

**訓練所不是工廠，是家族生意**。

每個訓練所主人有自己的家 — 有老婆、兒子、女兒、長輩。這些家族成員會：
- 偶爾下訓練場（打奴隸 / 幫助奴隸 / 勾搭奴隸）
- 影響整個訓練所的氣氛與規則
- 成為玩家互動的**非戰鬥敵人 / 恩人**

**不同訓練所 = 不同家族 = 完全不同遊戲體驗**。

---

## 家族欄位模板

```js
facility.family = {
  master: {
    npcId: 'masterArtus',
    present: true,  // 必備
  },
  mistress: {
    npcId: 'livia',
    present: true,
    archetype: 'kind_benefactor',  // 善良資助者
  },
  children: [
    {
      npcId: 'marcus',
      gender: 'male',
      age: 22,
      archetype: 'cruel_sadist',   // 殘忍施虐者
      hidden: false,                 // false = 會下訓練場
    },
    // 未來：
    // { npcId: 'julia', gender: 'female', age: 19, archetype: 'slave_seducer' },
  ],
  elders: [],   // 未來：祖父母、叔父
}
```

---

## 家族成員 archetype 清單

每個成員扮演一個 archetype，定義他們跟玩家的關係模式。

### 父系（主人）

| archetype | 描述 | 典型對白風格 |
|---|---|---|
| `cold_investor` | 冷血商人 | 「這個⋯⋯處理掉」 |
| `ambitious_warlord` | 野心軍閥 | 大聲、愛榮譽 |
| `debtor_desperate` | 破產中 | 焦慮、賣人 |
| `veteran_retired` | 退役角鬥士 | 敬重強者 |

**阿圖斯 = `cold_investor`**

### 母系（主人娘）

| archetype | 描述 | 跟玩家互動 |
|---|---|---|
| `kind_benefactor` | 善良資助者 | 透過僕人送食 / 藥 / 情報 |
| `controlling_mother` | 強勢母親 | 干涉兒女戀情 / 管家 |
| `religious_zealot` | 宗教狂熱 | 要求奴隸禱告 / 送聖物 |
| `absent_noble` | 冷漠 / 缺席 | 幾乎不登場 |

**Livia = `kind_benefactor`**

### 兒子 archetype

| archetype | 描述 | 跟玩家互動 |
|---|---|---|
| `cruel_sadist` | 殘忍施虐者 | 下訓練場打沙包 / 羞辱奴隸 |
| `ambitious_politician` | 政治野心 | 利用奴隸做髒活 |
| `weak_coward` | 軟弱 | 被玩家保護 / 求饒 |
| `rebel_kind` | 反叛善良 | 暗中幫助奴隸（跟 mother 呼應）|
| `playboy_debtor` | 花花公子欠債 | 勾結奴隸 / 借債 |

**Marcus = `cruel_sadist`**

### 女兒 archetype

| archetype | 描述 | 跟玩家互動 |
|---|---|---|
| `slave_seducer` | 勾搭戰士型 | 偷情（好處 / 被抓斷手）|
| `devout_protected` | 虔誠被保護 | 被父親嚴禁接觸奴隸 |
| `pre_arranged` | 已婚配 | 痛恨命運，可能尋求奴隸同情 |
| `arena_fan` | 角鬥場迷 | 追星某角鬥士，影響評分 |
| `secret_rebel` | 秘密反叛 | 協助奴隸逃脫計畫 |

**本訓練所女兒：留伏筆，Phase 2 決定 archetype**

### 長輩 archetype

| archetype | 描述 |
|---|---|
| `retired_warrior` | 退役戰士祖父 — 知道訓練場潛規則 |
| `frail_grandmother` | 脆弱祖母 — 需要照顧，奴隸任務來源 |
| `mad_ancestor` | 瘋了的曾祖 — 知道家族秘密 |

---

## 家族成員互動規則

### 跟玩家的好感系統

**家族 NPC 也用 teammates.getAffection 系統**，但互動方式不同：

| 家族成員 | 互動頻率 | 好感上升來源 |
|---|---|---|
| 主人 | 極罕見（1-5 次/全遊戲）| 戰鬥表現、fame、特殊選擇 |
| 主人娘 | 罕見（5-10 次）| 道德特性（kindness / merciful / loyal）|
| 兒子（cruel）| 頻繁（10-20 次）| **反諷 — 玩家做殘忍事他才讚賞** |
| 女兒（seducer）| 偶爾（5-15 次）| 戰力 / 長相（fame）|
| 長輩 | 一次性 | 特定故事事件 |

### 家族成員之間的連動

家族成員**互相影響**：
- Livia 看 Marcus 打奴隸 → mood 受挫 → 暗助受害者
- 女兒勾搭奴隸被抓 → 兒子告狀 → 父親下令斷手
- 兒子死 → 母親崩潰 → 家族氣氛劇變

**未來實作**：家族成員 `mood` 或 `state` 欄位，互相影響。

---

## 本訓練所（阿圖斯家）配置

### 家族成員清單

| 成員 | Archetype | 當前狀態 | 登場階段 |
|---|---|---|---|
| 阿圖斯（master）| `cold_investor` | ✅ 已實作 | Phase 1 |
| Livia（mistress）| `kind_benefactor` | 📝 設計完成，未實作 | Phase 2 |
| Marcus（兒子）| `cruel_sadist` | 📝 設計完成，未實作 | Phase 2 |
| （女兒）| — | ⏳ 未定 | Phase 3 |

### 家族動力

```
阿圖斯 ───┬── 商業生意（cold_investor）
          │
Livia ────┼── 柔軟內核（kind_benefactor）
          │    ↓ 透過梅拉暗助奴隸
          │    ↓ 救下了奧蘭
          │
Marcus ───┴── 暴力欲望（cruel_sadist）
               ↓ 下訓練場打沙包
               ↓ 奧蘭被降級的真正原因
```

### 本家故事核心

**阿圖斯家 = 三代人關於奧蘭的選擇**：
- 父親（阿圖斯）：「商業讓步，讓他下訓練場」
- 母親（Livia）：「我救了他」（善意的殘忍）
- 兒子（Marcus）：「這廢物還活著？」（真正想殺他）

玩家跟奧蘭越親，**這三個聲音越清楚**。

---

## 每訓練所設計檢查清單

新訓練所設計時：

- [ ] 決定主人 archetype
- [ ] 決定是否有主人娘（archetype）
- [ ] 決定兒女數量與 archetype
- [ ] 是否有長輩
- [ ] 家族成員之間的關係（衝突源？）
- [ ] 家族跟訓練所其他 NPC 的連動（梅拉 / 老默 / 官員）
- [ ] 至少 1 個家族成員有完整 4 幕主線（例：奧蘭 = 主人家的連結）
- [ ] 地理結構（見 `mansion-geography.md`）
- [ ] 設定 CODEX 同步

---

## 相關文件

- `docs/systems/mansion-geography.md` — 地理結構
- `docs/characters/masterArtus.md` — 阿圖斯（master）
- `docs/characters/livia.md` — Livia（mistress）
- `docs/characters/marcus.md` — Marcus（son）
- `docs/systems/found-family.md` — 新家人系統（奴隸側）
