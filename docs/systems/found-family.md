# 新家人系統（Found Family）

> 玩家失去了原本的家。在訓練所，有一群人慢慢變成他的新家。
> 這份文件定義「新家人儀式」— 每個 NPC 在高好感時會以**家人稱呼**確認關係。
> 設計日期：2026-04-19

---

## 核心哲學

**玩家開局時已失去家人**（被抓 / 被賣 / 背叛）。在訓練所這個殘酷的世界，**NPC 慢慢變成他的新家**。這不是玩家主動的選擇，是 NPC 單方向的**認養儀式**。

每個 NPC 有**獨立的認養時機**，依好感 + 特定事件觸發。一旦發生，是**永久印記**。

---

## 為什麼這個主題重要

奧蘭家書事件（`orlan_letter`）揭露了一個情感結構：
- 奧蘭還有家 — 玩家沒有
- 玩家心想：**「我的家⋯⋯？」**

這個失落感**需要回報** — 不是玩家自己填補，而是 NPC 慢慢成為新家人。這是 RPG 最有力量的情感弧線。

---

## 新家人儀式清單（Phase 2-3 實作）

每個 NPC 在特定條件下會**以家人稱呼確認關係**。這是一次性事件，觸發後永久改變對白。

| NPC | 角色 | 觸發條件 | 稱呼升級 |
|---|---|---|---|
| **奧蘭** | 兄弟 | 好感 50+ & `shared_olans_punishment` flag | 「兄弟」（從此稱呼）|
| **梅拉** | 母親型 | 好感 60+ & Day 50+ & kindness/merciful | 「孩子」（從此稱呼）|
| **卡西烏斯** | 老師型 | 好感 70+ & 教過招式 | 「我的學生」（從此稱呼）|
| **老默** | 可靠長輩 | 好感 70+ & 治療過 3+ 次 | 點頭不說話（最高形式）|
| **塔倫長官** | 嚴父型 | 好感 70+ & fame 60+ | 「小子」（承認但不親）|
| **（未來）主人娘 Livia** | 隱形母親 | 奧蘭好感 80+ 揭露 | 從未直接見面，只透過梅拉傳「孩子⋯」|

---

## 儀式的特徵

### 1. 一次性的情感高潮
- 不只是對白變化 — 是**小儀式**
- Stage.playEvent 演出（油燈 / 沉默 / 一個動作）
- 演出後永久改變對白

### 2. 玩家不能主動觸發
- 都是 NPC **單方向**給的
- 玩家好感夠 → 條件符合 → NPC 決定認養
- 這符合 Phase 1「奴隸沒有主動權」哲學

### 3. 彼此呼應 + 累積
- 每多一個 NPC 認養 → 玩家的新家越完整
- Day 80+ 當幾個 NPC 都認養完 → 玩家有**家族感**
- Day 100 結局：**你沒有回原本的家 — 你有新家**

### 4. 失去的代價
- 如果某個「新家人」死了（奧蘭 Day 85 訣別）→ 剩下的家人儀式更沉重
- 如果玩家背叛某個家人（betrayed_olan）→ 其他家人的儀式也會被影響（梅拉看你的眼神變了）

---

## 儀式設計模板

```
【Stage.playEvent 觸發】
  [NPC 的招牌動作 / 環境]
  NPC 第一次用家人稱呼叫玩家
  簡短的對話
  動作結束
【永久 flag: founded_family_{npcId}】
```

### 範例：梅拉「孩子」儀式

```
【廚房。晚餐後。】
梅拉叫住你。
「你身上⋯⋯有種味道。」
「像我們鄉下的磨坊。」
（你愣住。）
「我也是鄉下出身的。」
「在這裡，大家都是被丟過來的。」
梅拉看著你很久。
「⋯⋯孩子。好好活著。」
（這是她第一次這麼叫你。）
【flag: founded_family_mela = true】
```

### 範例：奧蘭「兄弟」儀式

```
【夜裡，牢房。】
奧蘭翻身面向你。
「今天在訓練場⋯⋯謝謝你擋那一下。」
「我現在有你這樣的人⋯⋯」
（他停了。）
「⋯⋯兄弟。」
「我叫你兄弟可以嗎？」
（你點頭。）
（他笑了，眼睛彎起來。）
【flag: founded_family_orlan = true】
```

---

## 程式碼掛鉤（Phase 2 實作）

### 觸發檢查
`main.js` DayCycle.onDayStart 跑一輪：
```js
DayCycle.onDayStart('foundFamilyCheck', () => {
  if (typeof FoundFamily !== 'undefined') FoundFamily.tryTrigger();
}, 20);
```

### 模組
新建 `found_family.js`：
```js
const FoundFamily = (() => {
  const RITUALS = [
    {
      npcId: 'orlan',
      condition: (p) => teammates.getAffection('orlan') >= 50 && Flags.has('shared_olans_punishment'),
      play: () => Stage.playEvent({ ... }),
    },
    // ... 其他 NPC
  ];

  function tryTrigger() {
    for (const ritual of RITUALS) {
      const flagKey = 'founded_family_' + ritual.npcId;
      if (Flags.has(flagKey)) continue;
      if (!ritual.condition(Stats.player)) continue;
      ritual.play();
      Flags.set(flagKey, true);
      return;  // 一天最多觸發一個（避免集中）
    }
  }
})();
```

### 對白系統整合
一旦有 `founded_family_{npcId}` flag，該 NPC 的所有對白使用升級稱呼：
- 奧蘭：從「你」→「兄弟」
- 梅拉：從「孩子」（可能已是）→ 語氣更家常
- 等

---

## 儀式跟結局的連結

### 多家人結局
擁有 3+ 個 `founded_family_*` flag → 解鎖「**新家人**」結局（擬定）：
- 百日祭後，即使獲勝，你不回原本的家 — 因為這裡才是你的家
- 跟這些 NPC 分別的對白變成核心敘事

### 孤獨結局
如果 `betrayed_olan` 或缺失所有家人儀式：
- 「你贏了。但沒人等你回家。」

---

## Phase 1 已做的準備（為 Phase 2 鋪路）

1. **奧蘭家書事件** 已加 8 origins 玩家內心獨白 — 「家人？⋯⋯我的呢？」
2. **情緒倍率系統** 已可以讓家書事件的 mood 變化隨特性調整
3. **梅拉 × 奧蘭** 的認識階段正在鋪陳（Phase 2 正式做三階段）

---

## 相關文件

- `docs/characters/orlan.md`（兄弟）
- `docs/characters/melaKook.md`（母親）
- `docs/characters/cassius.md`（老師）
- `docs/characters/doctorMo.md`（長輩）
- `docs/characters/officer.md`（嚴父）
- `docs/characters/livia.md`（隱形母親）
- `docs/systems/master-family-spec.md`（對照：主人家族）
