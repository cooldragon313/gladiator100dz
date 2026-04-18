# 玩家背景系統（Origins）

> 定義每個 origin 的初始特性、屬性修正、NPC 好感、難度。
> 這是**設計記錄**，未來實作 origin 時依這份文件。
> 最後更新：2026-04-18

---

## 核心決議（2026-04-18）

### 1. Origin = 種子，不是劇本
- 每個 origin 給**初始條件**，但不鎖死玩家的結局
- 透過選擇與事件，同一個 origin 可以長出不同結局

### 2. 不為 origin 新增特性
- 用**既有的特性系統**表達 origin 的性格
- 貴族 = `prideful` + `literate`
- 農家 = `kindness` + `diligence`
- 原因：新增特性會膨脹系統、維護成本高。既有特性已足夠表達。

### 3. Origin 透過兩層機制作用
- **層一：startingTraits（特性）** — 影響行為分支
- **層二：hiddenTag（origin 標籤）** — 影響對話用詞 / 特殊事件

```js
// 層一：特性判斷（行為）
if (_hasTrait('prideful')) → 驕傲分支對白

// 層二：Origin 判斷（flavor）
if (Stats.player.origin === 'nobleman') → 貴族專屬用詞
```

---

## Origin 定義表

### ✅ `farmBoy` 農家子弟（**已實作，完整**）

```js
{
  id: 'farmBoy',
  name: '農家子弟',
  title: '燒毀村莊的倖存者',
  desc: '你的村莊被燒了。你被抓來這裡。你記得每一張臉。',
  locked: false,

  statMod: { STR: +2, CON: +3, DEX: -1, WIL: -1 },
  startingTraits: ['diligence', 'kindness'],   // 勤勉 + 寬厚
  startingFlags:  ['village_burned', 'story_lord_is_enemy'],
  startingMoney:  0,
  hiddenTag:      'lord_is_enemy',

  initialNpcAffection: {
    dagiSlave: +5,    // 同是年輕奴隸
    oldSlave:  +10,   // 老人對農家子弟特別有感
  },

  difficultyScore: { overall: 2 },    // 較易
}
```

#### farmBoy 在各場景的行為

| 場景 | 行為 |
|---|---|
| Day 1 起床 | 沒知識亂想「訓練場 = 穀場」 |
| Day 1 場景 3.5 | 有 kindness → 自動幫達吉（`day1_helped_dagi`） |
| Day 1 散場內心 | 亂想「沙洗」是什麼 |
| Day 1 見奧蘭 | kindness 版對白（奧蘭讚你救達吉） |
| Day 5 沙洗 | — |
| 貴族事件（特殊） | 無，沒 `noble_born` tag |

---

### 🔒 `nobleman` 貴族（**設計完成，尚未解鎖**）

```js
{
  id: 'nobleman',
  name: '落難貴族',
  title: '從高位摔下來的人',
  desc: '你家族破產了。你被迫賣身還債。你還不懂什麼叫「活下去」。',
  locked: true,   // 未來解鎖

  statMod: { WIL: +2, DEX: +1, STR: -2, CON: -2 },
  startingTraits: ['literate', 'prideful'],    // 識字 + 驕傲（無 kindness！）
  startingFlags:  ['family_fallen', 'story_debt_to_master'],
  startingMoney:  0,
  startingItems:  ['family_pendant'],           // 藏著一條項鍊（未來換錢事件用）
  hiddenTag:      'noble_born',

  initialNpcAffection: {
    officer:     +5,     // 長官看貴族覺得「有栽培價值」
    overseer:    +3,
    masterArtus: +5,     // 主人覺得這孩子能賺錢
    melaKook:    -5,     // 梅拉討厭驕傲的
    dagiSlave:  -10,     // 達吉本能警惕
    orlan:       0,      // 奧蘭不特別敵視也不特別親近
  },

  difficultyScore: { overall: 4 },    // 較難
}
```

#### nobleman 在各場景的行為（未來實作）

| 場景 | 行為 |
|---|---|
| Day 1 起床 | 幻想雞腿 + 讀過書拼湊「血洗」 |
| Day 1 場景 3.5 | 沒 kindness → 預設繞過達吉，但給「破例幫」選項（違反 prideful） |
| Day 1 散場內心 | 拼湊「以沙磨去」的書本記憶 |
| Day 1 見奧蘭 | **知道但不準備說** → `hid_sand_wash_from_orlan` flag |
| Day 5 沙洗 | 貴族對戰時可能有「書本讀過戰術」的 flavor |
| 貴族獨家 | 有 `literate` → 能讀主人帳本 / 藥房字條 / 墓碑 |

#### 「破例」機制（貴族專屬）

當貴族玩家**違反 prideful 本能**時，特殊 flag + moral axis 推進：
```
場景 3.5 貴族選「破例幫達吉」：
  dagi +15, orlan +10
  moral pride → positive（推一筆）
  flag 'noble_broke_pride'

未來用途：
  Day 20 某 NPC 會說「你跟其他貴族不一樣」
  Day 50 卡西烏斯會多教你一招
  Day 85 奧蘭訣別時會多一句「我看見你每次都在選擇」
```

---

### 🔒 `vagabond` 流浪者（**設計中**）

```js
{
  id: 'vagabond',
  name: '流浪者',
  locked: true,
  startingTraits: ['streetwise'],    // 待實作
  difficultyScore: { overall: 3 },
  // 其他待設計
}
```

---

### 🔒 `gladiatorSon` 角鬥士之子（**設計中**）

```js
{
  id: 'gladiatorSon',
  name: '角鬥士之子',
  locked: true,
  startingTraits: ['arena_instinct'],   // 待實作
  // 其他待設計
}
```

---

## 實作優先順序

### 現在（只做 farmBoy）
- ✅ farmBoy Day 1 開場（對應 `docs/quests/day1-opening.md`）
- ✅ farmBoy 的 diligence + kindness 已定義
- ✅ farmBoy 跟達吉/老篤好感加成已做

### 之後（逐個解鎖）
1. **nobleman**（等 Day 1 農家穩定後做）
2. **vagabond**（Phase 2 再考慮）
3. **gladiatorSon**（Phase 2 / 後日談）

---

## 為什麼不現在做所有 origin

> 使用者回饋（2026-04-18）：「先乖乖把農家做好，這樣跳來跳去我都怕我自己完全不知道做到哪」

專注農家的好處：
- **少變數** → 容易測試跟 debug
- **一次把一個做完** → 不會中途切換
- **抓出遊戲節奏感** → 再複製模式做其他 origin

農家 Day 1-30 穩定後，貴族等其他 origin 就是**複製模式 + 調參數**，而不是重新設計。

---

## 相關文件

- [../quests/day1-opening.md](../quests/day1-opening.md) — Day 1 開場（含農家實作路徑）
- [../systems/traits.md](traits.md) — 特性系統
- [../philosophy/numbers-hiding.md](../philosophy/numbers-hiding.md) — 數字藏哲學
- `origins.js` — 程式端定義

---

## 對話紀錄（避免重新討論）

### Q: 要新增 `noble` 特性嗎？
A: **不需要**。用 `prideful` + origin tag (`noble_born`) 兩層機制就夠。

### Q: 貴族該有 kindness 嗎？
A: **不該**。kindness 是「會自動幫弱者」的品格，跟貴族養成邏輯衝突。
   貴族 origin 應該要**主動違反 prideful 才能展現善意** — 這才是有戲的成長。

### Q: 獄卒對 cruel 踢達吉的反應要扣 / 加好感嗎？
A: **不動**。獄卒的 likedTraits 沒 cruel，他不 care。
   唯一的影響是**奧蘭看到**（-15 好感）跟 flavor 敘述。

### Q: 貴族撒謊給奧蘭的 flag 要不要做後續？
A: **延後**（等貴族 origin 實作時再決定）。
   使用者回饋：「打的時候才決定要不要改個性」— 所以這 flag 的複雜分歧不急。
