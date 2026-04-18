# 敵人資料目錄

> 遊戲中所有**非 NPC** 的對戰對手。包含路人、刺客、野獸、外部鬥士等。
> 每個敵人一份 md，對應程式碼在 `testbattle.js:TB_ENEMIES`。
> 最後更新：2026-04-18

---

## 分類

### 🏛 `fixed/` — 固定鬥士（重複出現的有名對手）
跨訓練所的競爭對手、地下競技場名人等。**有自己的身份與故事**。
- [morras_ironarm.md](fixed/morras_ironarm.md) — 莫拉斯的「鐵臂」
- [dragonbay_shadow.md](fixed/dragonbay_shadow.md) — 海龍幫的「影子」

### 🏴‍☠ `specials/` — 特殊/路人挑戰
外出任務遇到的路人、強盜、刺客。
- [bandit_fang.md](specials/bandit_fang.md) — 毒牙強盜團
- [assassin_nighthawk.md](specials/assassin_nighthawk.md) — 夜鷹（刺客）

### 🦁 `beasts/` — 野獸
狩獵、困獸鬥。
- [tiger_striped.md](beasts/tiger_striped.md) — 斑虎

---

## 敵人 md 的標準欄位

```md
# 敵人名稱

## 快覽
- **ID**: enemyId（程式用）
- **正式名**: 中文名稱
- **外號**: 可選
- **類型**: fixed | special | beast
- **首次登場**: Day X / 條件

## 屬性
STR | DEX | CON | AGI | WIL | LUK | hpBase

## 武器 / 裝備
- weapon: X
- armor:  X
- shield: X

## 特色（AI / 被動 / 特技）
- AI 類型: basic | berserker | fox | defensive
- 被動: 描述
- 特技: 描述 + CD

## 背景 / 形象
（誰、來自哪、為什麼出場、能不能被說服）

## 戰鬥對白（戰前 / 戰中 / 戰後）

## 相關事件 / 觸發條件
```

---

## 程式碼端

所有敵人的實際屬性寫在：
**`測試頁面/testbattle.js:TB_ENEMIES`**

新增敵人時：
1. 寫 `docs/enemies/<category>/<id>.md`
2. 在 `TB_ENEMIES` 加對應 entry
3. 事件 / 關卡引用 `opponent: 'enemyId'`
