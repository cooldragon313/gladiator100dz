# Changelog

所有重要版本變更記錄於此。
格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)。

---

## [Unreleased]

---

## [0.1.6] — 2026-04-13

### Phase 1-D：強制用餐 / 就寢事件池 + 病痛系統

#### 新增
- `_triggerMealEvent()` — 早/午/晚三餐各有獨立敘事，依梅拉好感分三階（基本 / ≥30 / ≥60）
- `_triggerSleepEvent()` — 就寢事件，動態加權隨機三種結果：
  - 正常睡眠（stamina +40, mood +5）
  - 失眠（stamina +18, mood −5）
  - 噩夢（stamina +22, mood −12）
- 失眠症機制：連續 2 夜失眠/噩夢 → 自動獲得病痛【失眠症】；連續正眠 3 夜 → 自動解除
- 失眠症被動效果：就寢體力恢復上限降至 15，每個 rest 時段 stamina/mood 各 −3
- `Config.TRAIT_DEFS` — 特性定義表（積極/負面，含 name/desc/category）
- `Config.AILMENT_DEFS` — 病痛定義表（失眠症/手傷/腿傷/軀幹傷 + 佔位：腦震盪/阿基里斯腱/憂鬱症）
- `Stats.player.ailments[]`、`insomniaStreak`、`normalSleepStreak` 欄位
- 角色頁新增「特性」與「病痛」區塊，三色標籤系統：
  - `★` 金色 = 積極特性
  - `▼` 琥珀色 = 負面特性
  - `⚕` 暗紅脈動動畫 = 病痛

---

## [0.1.5] — 2026-04-13

### Phase 1-E：閾值訓練事件 + 受傷系統 v2

#### 新增
- 訓練強制中斷（Pre-check，100% 觸發）：
  - 體力 ≤ 10（力竭）：取消訓練，消耗時段，stamina +5
  - 心情 ≤ 9（崩潰）：取消訓練，消耗時段，mood −5
- 效率軟修正（可疊加，折入 `finalSynergyMult`）：
  - 心情 ≥ 80（40% 機率）：✨ 心流 ×1.5
  - 體力 ≤ 25（25% 機率）：擺爛 ×0.4
  - 飽食 ≤ 30（25% 機率）：輕度飢餓 ×0.75
- Log 尾端顯示閾值修正說明，如「（心流 ×1.5）（飢餓 ×0.75）」

#### 修改
- 受傷系統重構為 v2，改為「訓練強度」驅動而非「體力低」驅動：
  - 主要因子：超負荷比例（effectiveStaminaCost ÷ staminaBefore）
  - 協力倍率越高，額外受傷加成
  - 擺爛（thresholdMult < 1）時完全跳過受傷判定
  - 兩段結果：輕傷（−12/−8）/ 重傷（−25/−20）

---

## [0.1.4] — 2026-04-13

### Phase 1-F：NPC 注意系統

#### 新增
- `_scanNpcNotice(act)` — 每次訓練動作完成後掃描在場 NPC
- 兩層 Flag 設計：
  - `notice_today_{npcId}` — 每日清空，防止同天重複計數
  - `notice_count_{npcId}` — 跨天累積，達門檻後觸發保證事件並歸零
- `DayCycle.onDayStart('clearNoticeToday', priority 20)` — 每天清除今日觀察鎖
- 三個 NPC 注意規則：

  | NPC | 觀察條件 | 門檻 | 觸發事件 |
  |---|---|---|---|
  | 葛拉 | 在場 + STR 訓練 | 3 次 | 邀觀摩打鐵，好感 +5 |
  | 梅拉 | 在場 + food ≤ 30 + 好感 ≥ 30 | 2 次 | 偷塞食物，food +20 |
  | 監督官 | 在場 + 任意訓練 | 4 次 | 派清掃任務，stamina −10 |

- `Events.NPC_NOTICE_EVENTS` — 三個注意事件的文字與效果定義

---

## [0.1.3] — 2026-04-13

### Phase 1-G：主人 / 長官傳喚制度

#### 新增
- `_triggerSummonEvent(ev)` — 統一輸出敘事 log、套用效果、設 doneFlag
- `DayCycle.onDayStart('checkSummons', priority 30)` — 每天按條件掃描傳喚
- `Events.SUMMON_EVENTS[]` — 四種傳喚事件：

  | 事件 | 觸發條件 | 次數 | 效果 |
  |---|---|---|---|
  | 主人初見 | fame ≥ 15 | 一次性 | mood −5, 主人好感 +3 |
  | 主人贈禮 | 主人好感 ≥ 30 | 一次性 | money +10, food +15, mood +12 |
  | 長官任務 | fame ≥ 25 | 一次性 | fame +3, mood +8, 長官好感 +5 |
  | 長官定期點名 | 每 12 天 | 重複 | mood −3 |

---

## [0.1.2] — 2026-04-13

### Phase 1-H：切磋邀請事件化

#### 新增
- `_checkSparringInvite(act)` — 訓練後掃描在場隊友，好感 ≥ 50 → 20% 機率邀切磋
- 每天每 NPC 最多邀請一次（`sparring_invite_today_` flag，每日清空）
- `Events.SPARRING_INVITE_EVENTS` — 三個隊友專屬切磋事件：

  | 隊友 | 效果重點 |
  |---|---|
  | 卡西烏斯 | STR+0.3, DEX+0.3，沉默風格 |
  | 達吉 | AGI+0.3, mood+15，熱情風格 |
  | 烏爾薩 | STR+0.4, CON+0.2，重量風格 |

#### 修改
- `sparring` 動作已在 Phase 1-A 設為 `hiddenFromList`，本 Phase 完成事件化轉換

---

## [0.1.1] — 2026-04-13

### Phase 1-I：主人採購派遣

#### 新增
- `DayCycle.onDayStart('checkMasterErrand', priority 35)` — 從第 4 天起每 7 天派一次跑腿
- `Events.ERRAND_EVENTS[]` — 三種市集情境隨機觸發：

  | 情境 | 效果 |
  |---|---|
  | 普通採購 | food +25, mood +12, money +3 |
  | 市集謠言 | food +20, mood +8, fame +1 |
  | 扶倒地小孩 | food +20, mood +18 |

- 金錢效果透過既有 `Effects.apply({ type:'money', delta })` 處理

---

## [0.1.0] — 2026-04-12

### Phase 1-A～C：奴隸循環基礎架構

#### Phase 1-A：左欄極簡化
- 所有主動 NPC 互動動作改為 `hiddenFromList`（sparring / visitOfficer / visitMaster / helpCook 等）
- 場景 UI 重構：隊友頂部 / 舞台中央 / 觀眾底部
- 協力訓練系統（synergyMult）+ 視覺特效（浮字、對話泡泡、觀眾評論）
- 訓練受傷系統 v1（後於 Phase 1-E 升級為 v2）

#### Phase 1-B：時段系統重分類
- 8 個時段分類：training(4) / meal(3) / rest(1)
- `slotsRemaining()` 只計 training 格
- `_resolveNonTrainingSlots()` 自動推進 meal/rest 時段

#### Phase 1-C：閾值常數模組
- 新增 `config.js`：THRESHOLDS / DAILY / MONEY / NPC_NOTICE / EXP / EVENT_TRIGGER_RATES
- `Config.getTier()` 輔助函式

---

## [0.0.x] — 2026-03-xx ～ 2026-04-12

### Phase 0：基礎架構（D.1.1 ～ D.1.15）

- D.1.1：Stats 模組重構
- D.1.2：NPC 好感度系統（±100 範圍，仇恨系統）
- D.1.3：存檔 / 讀檔系統
- D.1.5：NPC 完整模板（成長/人格/漸進揭露/資產）
- D.1.6：金錢系統 modMoney
- D.1.7：設定介面重構（音量/語言/自動存檔）
- D.1.8：自動存檔機制（action / day / manual 三槽）
- D.1.9：Effects 統一效果處理器（EffectDispatcher）
- D.1.10：條件化時間軸事件（百日條）
- D.1.11：DayCycle 鉤子系統（onDayStart / onDayEnd）
- D.1.12：GameState 場景狀態模組
- D.1.13：SoundManager 音效框架
- D.1.14：i18n 國際化框架
- D.1.15：角色介面 Tab 系統（角色 / 所有人 / 成就 / 百科 / 任務）
