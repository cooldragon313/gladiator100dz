# 對白位置總索引

> 遊戲裡所有對白的位置清單。未來要改對白先查這張表。
> 最後更新：2026-04-18

---

## 🎬 開場三段（Day 1 之前）

| 內容 | 檔案 | 函式 / 位置 |
|---|---|---|
| 遊戲介紹頁（「你不是英雄，你是一筆投資」） | `main.js` | `_showGameIntro()` ~L4633 |
| 開場動畫（startscene.jpg + 打字機敘述 + 標題） | `main.js` | `_playOpeningCinematic()` ~L4692 |
| Day 1 起床（獄卒踢門 + 長官訓話「呵呵」） | `main.js` | `_playDay1WakeUp()` ~L4991 |

---

## 🎭 四大主線事件

### 奧蘭主線（4 幕 + 援手）
**檔案：`orlan_events.js`**
| 幕 | 觸發 | 函式 |
|---|---|---|
| Day 30 房間升級 | master_aff ≥ 50 + fame ≥ 30 | `_tryRoomUpgrade()` |
| Day 60 偷藥被抓 | player_was_nearly_dead + day ≥ 60 | `_tryStealMedicine()` |
| Day 85 最終訣別 | 強制 | `_tryFarewell()` |
| 生死援手 | 玩家 HP 歸零時 | `tryDeathSave()` |
| Day 92 前哨賽戰死 | farewell_accepted/rejected 路線 | init 裡的 `orlanPrelimDeath` hook |

### 索爾短命線（Day 1-5）
**檔案：`main.js`**
| 幕 | 位置 |
|---|---|
| Day 2 擋鞭 | `solEvents` hook，L5019+ `sol_day2` |
| Day 3 講女兒 | `sol_day3` |
| Day 4 給乾肉 | `sol_day4` |
| Day 5 三人試煉 | `_triggerThreePersonTrial()` ~L560 |
| Day 5 四條路線 | `choiceId === 'fight_sol' / 'send_orlan' / 'heroic' / silent` |
| 索爾死亡場景 | `_solDeathScene()` ~L705 |
| 玩家輸給索爾 | `_trialPlayerLostToSol()` ~L770（D.28 新增） |

### 醫生事件
**檔案：`doctor_events.js`**
- `DoctorEvents.tryVisit()` — 差異化治療對白（18 句）

### 赫克托反派線
**檔案：`main.js`**
- 日常騷擾：`_tryHectorHarassment()` ~L1682
- Day 8 試探：`hectorDay8` DayCycle hook ~L1507
- Day 15 警告：`hectorDay15` ~L1570
- Day 40 挑釁：`hectorDay40` ~L1648
- Day 25 秋祭嫁禍：`hectorFestival` ~L1712

---

## 💬 日常 / 世界事件

### 用餐事件
**檔案：`events.js`**
- 早餐 / 午餐 / 晚餐事件池
- 梅拉塞多塞食物、偷看等細節

### 日曆世界事件（Day 10/12/15/20/25）
**檔案：`main.js`**
| 事件 | 位置 |
|---|---|
| Day 10 淘汰 | `day10Elimination` hook ~L4846 |
| Day 12 切磋 | `day12Sparring` ~L4873 |
| Day 15 訓話 | `day15Speech` ~L4925 |
| Day 20 新奴隸 | `day20NewSlaves` ~L4948 |
| Day 25 秋祭 | `day25Festival` ~L4969 |

### 武器獎勵事件
**檔案：`main.js`**
- `_fireWeaponEvent(trigger)` ~L5101
- 分 `earned`（訓練 6 次）/ `forced`（Day 4 保底）兩條支線

---

## 🌊 情緒回聲（NPC 對大選擇的反應）

### NPC 反應（Day 5/60/85 隔日清晨）
**檔案：`npc_reactions.js`**
| 情境 | 函式 |
|---|---|
| Day 5 索爾死（sol_dead） | `_buildSolDeadReactions()` |
| Day 5 索爾活（sol_survived_trial） | `_buildSolSpareReactions()` |
| Day 60 告發 | `_buildBetrayReactions()` |
| Day 60 分擔 | `_buildSharedPunishmentReactions()` |
| Day 60 求情 | `_buildIntercedeReactions()` |
| Day 60 沉默 | `_buildSilenceReactions()` |
| Day 85 並肩 | `_buildFightBesideReactions()` |
| Day 85 接受 | `_buildAcceptedFarewellReactions()` |
| Day 85 拒絕 | `_buildRejectedFarewellReactions()` |
| 奧蘭死後 +1 天 | `_buildMournDay1()` |
| 奧蘭死後 +4 天 | `_buildMournDay4()` |
| 奧蘭死後 +10 天 | `_buildMournDay10()` |

### NPC 衝突事件（6 個選邊站）
**檔案：`npc_conflicts.js`**
| 事件 | 位置 |
|---|---|
| 赫克托霸凌奧蘭 | `hector_bullies_orlan` ~L84 |
| 長官 vs 老默醫療 | `officer_vs_doctor_medicine` |
| 卡西烏斯 vs 赫克托食堂挑釁 | `cassius_vs_hector_standoff` |
| 梅拉被抓偷塞食物 | `mela_caught_feeding` |
| 奧蘭求你教訓赫克托 | `orlan_asks_revenge` |
| 長官訓練場多打奧蘭 | `officer_targets_orlan` |

---

## 📜 NPC 故事揭露（storyReveals）

**檔案：`npc.js`**

每個 NPC 的 `storyReveals: [...]` 陣列裡。通常 5 flavor + 5 event = 10 段。

| NPC | 起始行 |
|---|---|
| orlan | L148+（10 段 + 8 散點支線） |
| sol | L477+（幾乎沒有，靠 main.js 事件） |
| hector | L508+（10 段） |
| cassius | L642+（10 段，D.12 範本） |
| doctorMo | L881+（10 段） |
| （其他 NPC 待補） | — |

flavor 文字最多 55 字（line-clamp: 2 限制），見 `docs/philosophy/numbers-hiding.md` 無關，但有字數規範。

---

## 🎓 教學型對白

### 對話型教學（8 則）
**檔案：`tutorial_hints.js`**
- 首次 EXP 滿（監督官）
- 心情低（梅拉塞）
- 飽食低（老默）
- 首次受傷（老默）
- 首次協力爆擊（卡西烏斯）
- 首次名聲（長官）
- 首次錢（侍從）
- 首次 NPC 好感 ≥ 30（卡西烏斯）

### 查詢型教學
**檔案：`help_modal.js`**（右上「？」按鈕）
- 8 區分類（一天流程、訓練、四條、偷懶、好感、戰鬥、存檔、詳細頁）

---

## 🧠 晨思 / 背景碎念

### 晨思（每日清晨一條）
**檔案：`morning_thoughts.js`**
- 30+ 條，分類：懸念 / 身體 / 社交 / 預感 / 反思 / 預設
- 優先度分層，會依玩家狀態選不同的

### 背景角鬥士碎念
**檔案：`background_gladiators.js`**
- `MUMBLE_POOL`（一般碎念）
- `SHOUT_POOLS`（協力吶喊，按屬性分）
- `GOSSIP_POOL`（八卦）
- `PARTNER_GREETINGS`（首次成為夥伴）

---

## ⚔ 戰鬥相關對白

### 戰前 DialogueModal
**檔案：`main.js`**
- `_buildPreBattleLines(ev)` ~L870 — 根據 event id 給戰前情緒鋪墊

### 戰鬥中即時 log
**檔案：`battle.js`**
- 攻擊 / 被打 / 暴擊 / 技能等 log 是英文 + 中文混合，分散在全檔

---

## 🎬 結局（8 種）

**檔案：`ending.js`**
| 結局 | 函式 |
|---|---|
| 戰死 | `deathEnding()` |
| 一般生存 | `survivorEnding()` |
| 獨自登頂（告發） | `loneVictor()` |
| 冠軍 | `championEnding()` |
| 殘存者 | `survivorPlain()` |
| 同命兄弟（並肩） | `brotherhoodEnding()` |
| 血色皇冠（殘忍） | `bloodyCrown()` |
| 奇蹟殘局 | `miracleEnding()` |

Console 測試：`Endings.test('miracle')`

---

## 📋 任務對白

### 梅拉抓老鼠任務
**檔案：`quests/mela_rat_quest.js`**
**設計書：`docs/quests/mela-rat.md`** ← 改對白先改這裡再改程式
- 白天提議 / 接受後變化（8 種 + baseline）
- 進廚房前碎念（7 種）
- 三階段判定（失敗/成功對白各 3 組）
- 全通過後特性變化（9 種）
- 三選一後反饋（含反差對白）

---

## 🗂️ 設計文件目錄（都是給你跟 AI 看，玩家看不到）

```
docs/
├── CONTENT-TEMPLATES.md      (內容模板)
├── DIALOGUE-MAP.md           (本檔 ← 對白位置總表)
├── characters/               (8 個 NPC 檔)
│   ├── orlan.md
│   ├── melaKook.md
│   ├── cassius.md
│   ├── hector.md
│   ├── doctorMo.md
│   ├── officer.md
│   ├── masterArtus.md
│   └── sol.md
├── philosophy/
│   └── numbers-hiding.md
├── systems/
│   ├── night-events.md
│   ├── multi-check-quest.md
│   └── traits.md
└── quests/
    └── mela-rat.md
```

---

## 🔍 查詢建議

**想改某句對白**：
1. 先 `Ctrl+F` 搜尋該對白的獨特關鍵字（例：搜「呵呵」找到 Day 1 長官訓話）
2. 用這張表定位檔案
3. 如果是**任務對白** → 優先改 `docs/quests/<id>.md`（我會同步到程式）

**想改某個 NPC 的講話風格**：
- 看 `docs/characters/<npc>.md` 的「對話風格」章節
- 所有該 NPC 出現的對白都應該符合那個風格

**想查某 flag 相關對白**：
- `grep "flag 名"` 在整個專案
- 通常會在對應 event 檔找到

---

## 💡 給 AI 的提示

做對白修改時：
1. **單句修改** — 直接改 .js 程式碼即可
2. **整段重寫** — 先改 `.md` 設計書，再同步到 .js
3. **跨 NPC 一致性** — 先看 `docs/characters/<npc>.md` 確認角色口氣
4. **新增任務** — 先寫 `docs/quests/<id>.md` 設計書（包含所有對白），再實作 `quests/<id>_quest.js`
