# 結局呈現系統（Ending Presentation）

> 百日結束時不是算分，是**呈現**玩家成為了誰。
> 設計日期：2026-04-19
> 狀態：**設計文件**（Phase 2 實作，取代現有 `ending.js` 6 個固定結局）

---

## 🎭 核心哲學

### 變強與成為誰是同一問題的兩面

> 「『變強』和『成為什麼樣的人』不是兩個平行的系統，而是同一個問題的兩面 ——
> 讓玩家用他選擇的方式變強，並在變強的過程中不得不面對他成為了誰。」
> — 使用者設計宣言，2026-04-19

### 所有選擇沒有最好，只有取捨

每個結局都有光也有影。沒有真結局 / 假結局。玩家看到的是**他這一百天成為了誰**。

### 呈現，不是評分

- ❌ 避免：「成績單」「評價」「評分」「結算」「達成度」
- ✅ 使用：「這一百天」「你留下了什麼」「你成為了誰」

---

## 📋 四幕結構（情緒由外向內）

| 幕 | 主題 | 呈現重點 | 情緒距離 |
|---|---|---|---|
| **第一幕** | 競技場 | 百日最終結果（凱旋/慘勝/敗活/敗死）| 最遠（社會評判）|
| **第二幕** | 他們眼中的你 | 3-5 個關鍵 NPC 的回應 | 中（關係評判）|
| **第三幕** | 你成為了誰 | 內在狀態 + 人格變化 | 最近（自我評判）|
| **第四幕**（可選）| 多年後 | 長期影響 / 留下的痕跡 | 延續（歷史評判）|
| **第五幕**（隱藏彩蛋）| 傳說 | 極端路線專屬收尾 | 驚喜 |

---

## 📐 五條軸線

結局不是從固定清單挑選，而是由**五條軸線的座標**組合生成。

### 軸定義

| 軸 | 呈現幕 | 資料來源 |
|---|---|---|
| **戰力 combat** | 第一幕 | `fame` / `combatStats.arenaWins` / 是否活過 Day 100 |
| **連結 bonds** | 第二幕 | NPC 好感總和 / 新家人儀式數 / `betrayed_*` flags |
| **道德 moral** | 第三幕 | 5 軸合成（mercy + kindness + reliable - cruel - prideful）|
| **身體 body** | 第一幕 + 第三幕 | `wounds` 總嚴重度 + 改造特性數 |
| **痕跡 legacy** | 第四幕 | `seenReveals.length` / 完成 quests / 關鍵事件 flag |

每軸 **5 檔位**：極負（-2）/ 負（-1）/ 中（0）/ 正（+1）/ 極正（+2）

---

## 🎚️ 軸線計算

### 戰力軸

```js
function calcCombatAxis() {
  const p = Stats.player;
  const dead = p.hp <= 0 || !p.aliveAtEnd;
  const fame = p.fame || 0;
  const wins = p.combatStats?.arenaWins || 0;
  if (dead && fame < 20) return -2;        // 極負：無名死亡
  if (dead) return -1;                      // 負：英勇戰死
  if (fame < 20) return 0;                  // 中：勉強活下來
  if (fame < 60) return 1;                  // 正：贏得一席
  return 2;                                 // 極正：傳奇勝者
}
```

### 連結軸

```js
function calcBondsAxis() {
  const familyCount = Object.keys(Flags.getAll()).filter(k => k.startsWith('founded_family_')).length;
  const betrayed = Flags.has('betrayed_olan') || Flags.has('betrayed_mela') ||
                   Flags.has('betrayed_hector');
  const totalAff = teammates.getAllAffection 
    ? Object.values(teammates.getAllAffection()).reduce((a, b) => a + b, 0)
    : 0;
  if (betrayed) return -2;                  // 極負：背叛
  if (familyCount >= 3) return 2;           // 極正：多家人
  if (familyCount >= 1 || totalAff > 150) return 1;  // 正
  if (totalAff > 50) return 0;              // 中
  return -1;                                 // 負：孤立
}
```

### 道德軸

```js
function calcMoralAxis() {
  const p = Stats.player;
  const ts = p.traits || [];
  let score = 0;
  // 正向
  if (ts.includes('kindness')) score += 2;
  if (ts.includes('merciful')) score += 2;
  if (ts.includes('reliable')) score += 1;
  if (ts.includes('loyal')) score += 1;
  if (ts.includes('humble')) score += 1;
  // 負向
  if (ts.includes('cruel')) score -= 3;
  if (ts.includes('prideful')) score -= 2;
  if (ts.includes('opportunist')) score -= 2;
  if (ts.includes('coward')) score -= 1;
  // 分層
  if (score <= -4) return -2;
  if (score <= -1) return -1;
  if (score <= 1)  return 0;
  if (score <= 4)  return 1;
  return 2;
}
```

### 身體軸

```js
function calcBodyAxis() {
  const w = Stats.player.wounds || {};
  let severeCount = 0;
  let specialCount = 0;
  Object.values(w).forEach(wound => {
    if (!wound) return;
    if (wound.special) { specialCount++; return; }
    if (wound.severity === 3) severeCount++;
  });
  const cyborgTraits = (Stats.player.traits || []).filter(t => 
    ['iron_arm', 'beast_leg', 'empty_brain', 'golden_heart'].includes(t)
  ).length;
  if (cyborgTraits >= 3) return -2;         // 極負：半機器人
  if (specialCount >= 2) return -2;
  if (cyborgTraits >= 1 || specialCount >= 1) return -1;
  if (severeCount >= 2) return -1;
  if (severeCount >= 1) return 0;
  return 1;                                  // 正：健全
  // 極正（2）預留給「訓練出超凡體魄」— 待定
}
```

### 痕跡軸

```js
function calcLegacyAxis() {
  const revealCount = (Stats.player.seenReveals || []).length;
  const heavyFlags = [
    'shared_olans_punishment', 'olan_sister_truth_known',
    'red_cliff_treasure_found', 'master_heir_exposed',
    'cyborg_fast_track',
  ].filter(f => Flags.has(f)).length;
  const score = revealCount * 1 + heavyFlags * 5;
  if (score <= 3)  return -1;   // 負：幾乎無痕
  if (score <= 10) return 0;
  if (score <= 20) return 1;
  if (score <= 35) return 2;
  return 2;                      // 極正
  // 極負（-2）預留給「主動消除痕跡」— 待定
}
```

---

## 📝 片段庫結構

每軸 × 每幕 × 5 檔位 = 一個片段。

```js
const ENDING_FRAGMENTS = {
  combat: {
    act1: {
      [-2]: '你的名字沒被刻在牆上。沒人記得你死在哪一場。',
      [-1]: '你躺在沙上。血從嘴角流出。觀眾席有人鼓掌 — 為了下一場。',
      [0]:  '你站著。一場接一場地活下來。不算勝利，但也不是死亡。',
      [1]:  '你舉起劍。觀眾喊你的名字。這是一個百日的勝者。',
      [2]:  '你走下競技場，身後是傳說。沒人再敢跟你對視。',
    },
    // act3 不由 combat 軸決定，不寫
    // act4 可能部分引用戰力
  },
  bonds: {
    act2: {
      [-2]: '沒有人來送你。你走進人群，人群自動讓開。',
      [-1]: '幾個點頭。幾個錯身而過。他們認得你，但不認你。',
      [0]:  '有人喊你名字。你轉頭 — 是卡西烏斯。他沒說話，只是點頭。',
      [1]:  '奧蘭在門口等著你。他的眼睛彎起來的那種笑。',
      [2]:  '梅拉給了你一塊乾糧。「路上吃。」她說。奧蘭遞給你他的木牌。你身後站著所有愛你的人。',
    },
  },
  moral: {
    // 🎯 示範：完整 5 檔位
    act3: {
      [-2]: '你不再做噩夢。因為那些人都不敢出現在你的夢裡。',
      [-1]: '你學會了不看倒地的人。你的手不再抖。',
      [0]:  '你沒變成怪物。但你也不再是從前那個人了。',
      [1]:  '你仍會停下來。別人覺得這是弱點 — 你知道這是你僅剩的東西。',
      [2]:  '你的名字不再讓人發抖。偶爾有人夢見你的臉 — 那是安慰的夢。',
    },
  },
  body: {
    act1: {
      [-2]: '你的身體已經不像人。金屬與肉、螺絲與血，分不清了。',
      [-1]: '你拖著殘腿走向競技場。這腿早就不是你的。',
      [0]:  '你的身上到處是傷疤。它們知道你去過哪裡。',
      [1]:  '你沒留下什麼傷痕。這很罕見。',
      [2]:  '你的身體比進訓練場時還強壯。這很罕見。',
    },
    act3: {
      [-2]: '你看鏡子時，認不出裡面的是誰。',
      [-1]: '你活著。靠著改造。這算活著嗎？',
      [0]:  '你摸著疤痕。每一個都有故事。',
      [1]:  '你沒變。身體還是你原本的身體。',
      [2]:  '你比來時強了。但你失去了對弱者的理解。',
    },
  },
  legacy: {
    act4: {
      [-2]: '三十年後 — 沒人記得你。這也算一種自由。',
      [-1]: '你的名字偶爾被提起。沒有細節。',
      [0]:  '有個老人說：「我年輕的時候，有個角鬥士⋯⋯」然後他忘了名字。',
      [1]:  '三十年後，你的故事還在夜裡被傳誦。只是每次都變長了一點。',
      [2]:  '三十年後，奴隸們仍在夜裡念你的名字。那不是歌 — 是一種祈禱。',
    },
  },
};
```

---

## 🔗 膠水過場句

**讓文字讀起來像一個人寫的**，不是片段拼貼。四幕之間有固定過場：

### 第一幕 → 第二幕
```
銀幕暗下。
你想起這一百天。
那些陪你走過的人。那些離開的。
```

### 第二幕 → 第三幕
```
人們漸漸散去。
你獨自站在訓練場中央。
你閉上眼。
你看見的，不是他們。是自己。
```

### 第三幕 → 第四幕（若觸發）
```
時間繼續走。
十年。二十年。三十年。
你的故事 — 如果還有人記得的話 ——
```

---

## 🪦 已死 NPC 的呈現

死亡不是**缺席**，是一種**呈現**。第二幕若某 NPC 已死 → 用**遺物 / 臨終一句 / 他留下的東西**代替。

```js
const DEAD_NPC_FRAGMENTS = {
  orlan: {
    betrayed_olan: '奧蘭的位置空著。他的木牌在你口袋裡，冷的。',
    orlan_died_sharing: '奧蘭的麵包還在櫃子裡。你沒吃。',
    default: '奧蘭站在你身邊 — 他還在的話。',
  },
  sol: {
    default: 'Sol 的名字被刻在訓練場牆上。一個小小的字。',
  },
  // 其他可死的 NPC...
};
```

---

## 🏛️ 命名結局如何整合（框架層）

保留現有 6 個命名結局，但它們變成「**第一幕標題**」的**標籤**，實質內容由軸線組合生成。

```js
const NAMED_ENDINGS = {
  loneVictor: {
    title: '獨自登頂',
    condition: (axes) => axes.combat >= 1 && axes.bonds <= -2,
    // 第一幕標題、氛圍色、BGM 指向（預留）
  },
  brotherhoodEnding: {
    title: '同命兄弟',
    condition: (axes) => axes.combat >= 1 && axes.bonds >= 1 && !Flags.has('orlan_dead'),
  },
  miracleEnding: {
    title: '奇蹟殘局',
    condition: (axes) => axes.combat >= 1 && axes.bonds >= 2 && 
                         Flags.has('shared_olans_punishment') && 
                         Flags.has('olan_sister_truth_known'),
  },
  championEnding: {
    title: '百日冠軍',
    condition: (axes) => axes.combat >= 2,
  },
  survivorPlain: {
    title: '尋常倖存',
    condition: (axes) => axes.combat >= 0 && axes.combat < 2,
  },
  bloodyCrown: {
    title: '血冠',
    condition: (axes) => axes.combat >= 1 && axes.moral <= -2,
  },
};
```

**匹配邏輯**：依優先級掃描，第一個 condition 通過的當標題。

---

## 🎁 隱藏第五幕（彩蛋層）

極端組合觸發專屬第五幕。**留給深度玩家驚喜**。

### 觸發條件

| ID | 觸發 | 內容 |
|---|---|---|
| `iron_puppet` | body ≤ -2（3+ 改造） | 機械角鬥士傳奇 |
| `unbroken_cripple` | body ≤ -2（2+ 重傷但無改造）+ combat ≥ 0 | 殘軀不屈 |
| `hybrid_walker` | 恰 1 改造 + 1 自然癒合 | 混合行者 |
| `found_family_complete` | 5+ 新家人儀式 | 新家人結局 |
| `total_silence` | legacy ≤ -2 + combat ≤ 0 | 徹底消失 |
| `moral_saint` | moral >= 2 + 從未殺人（`combatStats.executionCount === 0`）| 百日聖者 |

第五幕文字更長（3-5 句），有更強儀式感。

---

## 🎨 文字風格規範

### 原則

1. **第二人稱「你」** — 自我凝視的力量
2. **冷靜、留白** — 不用情緒化形容詞（悲傷、憤怒、絕望）
3. **不解釋因果** — 讓玩家自己連結
4. **每幕極度節制** — 重量來自簡潔
5. **具體意象 > 抽象描述**（「你的手不再抖」比「你變強了」有力）

### 寫錯 vs 寫對

❌ 「你終於成為了真正的戰士，你的心已經堅硬如鐵！」
（太誇張、解釋、情緒化）

✅ 「你的手不再抖。」
（冷靜、具體、留白）

❌ 「你這 100 天幫助了很多人，贏得了友誼。」
（說明、成績單味）

✅ 「梅拉給了你一塊乾糧。『路上吃。』」
（呈現、動作、無說教）

### 字數規範

| 幕 | 字數 |
|---|---|
| 第一幕 | 1-2 句（10-30 字）|
| 第二幕 | 每 NPC 1-2 句，3-5 個 NPC 共 40-100 字 |
| 第三幕 | 3-5 句（30-80 字）|
| 第四幕 | 1-2 句（10-30 字）|
| 第五幕 | 3-5 句（可以更長，儀式感）|

---

## 🛠️ 實作流程

### Step 1（本次 commit）
- ✅ 這份設計文件
- 一條軸（道德 moral）× 第三幕完整示範片段

### Step 2（下一次 commit）
- 寫滿 5 軸 × 4 幕 × 5 檔位 = 100 段片段
- 寫過場膠水句
- 寫 6 已死 NPC 的 fragment
- 存到 `ending/fragments.js`

### Step 3（下下次 commit）
- 軸線計算函式 `ending/axes.js`
- 命名結局匹配 `ending/named.js`
- 第五幕觸發 `ending/secrets.js`

### Step 4（最後 commit）
- 改寫 `ending.js`：四幕播放系統
- Stage 演出（黑幕 / 漸入 / 打字效果）
- 取代舊 `pickAndPlay()`

---

## 🔗 相關系統 / 檔案

- `ending.js` — 現有 6 個固定結局（將被重構）
- `moral.js` — 道德軸計算（已有）
- `teammates.js` — NPC 好感系統（已有）
- `wounds.js` — 身體軸資料來源
- `docs/CANON.md` — 時間線（誰死、誰活）
- `docs/characters/*.md` — NPC 設定（影響 fragment 寫作）

---

## 📝 Phase 2 擴充想法

- **軸線更細**：加「勞動軸」（訓練總次數）/「飲食軸」（飢餓率）
- **跨周目**：第二輪遊戲玩家能看到**前世的結局片段** — 比如遇到某 NPC 時閃現上輩子的結局
- **結局畫面有互動**：某些幕讓玩家「按任意鍵繼續」但按鍵有講究（某些結局按鍵直接關遊戲，不讓玩家重讀）
- **結局後的遊戲狀態** — 結局播完後玩家可以**漫步訓練場**一次，看所有 NPC 的告別（Disco Elysium 終幕感）

---

## 💭 設計師筆記

這個系統的靈感來自：
- Disco Elysium — 不評分，只呈現「你成為了誰」
- Sunless Sea — 結局是軸線座標，不是清單
- Pathologic — 四幕情緒堆疊
- Spec Ops: The Line — 「變強」與「成為什麼」的辯證

**最終目標**：玩家看完結局，**安靜幾分鐘**。而不是想「我要玩好結局」。
