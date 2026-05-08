# 百日萬骸祭 · 開發歷史

> 已完成的大型功能 / 設計決策歸檔。最新在最上面。
> CLAUDE.md「接手頭條」只記**當下狀態**、本檔記**完整歷史**。

---

## 2026-05-09（NvN 引擎 + 大量場景接進）

**戰鬥引擎 1v1 → NvN 完整改造（7 stage、~430 行）**
- Stage A `c6dcd3a`：pluralize `_enemy → _enemies[]` + `_enemyAtbs[]` + `_currentTargetIdx`、保 1v1 行為
- Stage B `61b3c92`：`_allies[]` + 隊友 ATB tick + 簡易 AI（攻擊最低 HP 敵）
- Stage C+D `50cd41b`：多 slot UI 渲染 + target picker（點敵切換目標）
- Stage E+F `71822af`：敵 AI 30% 改打活隊友 + `startFromConfig` 接陣列
- Stage G `cf2d981`：萬骸祭 Wave 1（1v3）/ Wave 3（1v2）+ P2-4 Day 35 真 2v2

**P2 stubs 全清（7/8 → 8/8）**
- P2-4 Day 35 雙主人合作場（4 幕 + 30 年素材池 + 3 選項）
- P2-5 Day 60 雙主人陰招場（4 幕 + 舉發/沉默/反陰 + 真 2v2 升級）
- P2-6 Day 50/80 互換新兵（雙天 + 9 種「來訪者×選擇」分流）
- Day 75 公開宴會撕逼（5 幕社交事件 + 多段素材抽 2）
- P2-8 食物下毒 + 梅拉廚娘預警（3-tier 好感 + Day +6 追查事件）

**P3 場內事件 7 連發（intra_events.js）**
- 第一批：偷竊 / 欺負新人 / 老默喝醉 / 廚房短缺
- 第二批：詐賭 / 找到舊書 / 共夢事件（5 NPC 各自核心傷痛夢）
- 第三批：赫克特試煉（派系深化）

**P4 中段 5 boss（midgame_bosses.js）**
- B1 鐵骨阿巴（Day 30、教「不屈」）
- B3 快刀沙洛（Day 55、招敵變友候選）
- B4 血斧穆爾（Day 68、強制傷勢）
- B5 黑爪（蓋烏斯暗殺鏈 +35）
- B6 七勝者塔倫弟（Day 88、終極對手前哨戰）

**領主主線補強（lord_events.js）**
- Day 72 巴爺夜宴門檻提示對白（「我當年也想見一個人、想了三年、用名聲換」）
- Day 80 fame 門檻 30 → 80（呼應提示數字、未來 fame audit 還會調）
- Day 65 衝動分枝放寬（殉道弒主三維 50 → 兩維 40 + 不屈特性、加帶傷活下路徑）
- 冷靜分枝機械加成：永久特性「復仇者」(vengeful) + patience 軸 weight:2

**凱德主線 + 萬骸祭 + 派系（d12b52b）**
- 凱德 Day 85 消化（補 80→90 空檔、城南酒館 50 行對白「我這個自由人有什麼意思」）
- 萬骸祭 B 路殘血群戰真做（從骰子 stub → 真 NvN：玩家 + 高好感 NPC vs 提圖斯 + 衛兵）

**NvN polish（7fe1053）**
- 隊友指令系統：自動 / 集火 / 防禦 三模式 + UI 列
- 隊友 AI 智能化：威脅評分（STR + fame + HP ratio）取代「最低 HP」
- `_applyDamage` 加 attacker 參數修最後一搏邊角

**Debug 工具修補**
- `skipToDay` 允許回跳 + 自動清「done」flag、修 day35 重複跳沒觸發（`fe838b1` + `1723af7`）

**Memory 加紀錄**
- `feedback_fame_audit_pending.md`（fame 全面大重整待做）
- `feedback_pending_design_reviews.md` 第 2 條（NvN 對手太弱待調）
- `project_next_after_multi_battle.md`（多人戰後接 P2-8 + P3 — 已完）

---

## 2026-05-08

- test.html GUI debug + `Game.godMode` + `Game.testJump` + 自訂天數欄位
- P2-4 Day 35 雙主人合作場 stub → 完整版（`af6f571`）
- P2-5 Day 60 雙主人陰招場 + Day 75 公開宴會撕逼（`02b657a`）
- 詞綴 tier 3 主動戰鬥端接上（vampiric/flaming/reaping/riposting、`c9bc7ea`）
- P2-6 Day 50/80 互換新兵（`cc644a4`）

---

## 2026-05-07

- 詞綴 20 個系統全鏈接（affixes.js + forge + battle + UI）
- NPC flavor 補完（10 NPC 30+ 階段：阿圖斯/侍從/蓋烏斯/維努斯場 6 NPC/凱德/梅拉）
- 葛拉鋪 hover tooltip
- 萬骸祭 race condition 兩修
- 巴爺改批訓練消耗品（修自家有葛拉的世界觀漏洞）+ 抬屍體加梅拉戲份 + 玩家內心 OS

---

## 2026-05-01

- arena-events-roster.md 完整 spec 鎖定（1300+ 行：蓋烏斯·維努斯/領主提圖斯/凱德/維努斯場 6 NPC/萬骸祭 5 wave/三結局路徑/領主夜宴瓦倫戲）
- CANON.md 同步：5 條 CANON 級鐵律 + 6 個新角色卡
- IMPLEMENTATION-ROADMAP.md：6 Phase 36 任務拆解
- Phase 1A 落地：8 個新結局 stub + wanguji.js 萬骸祭框架
- 主人傳家件 → 掛件 (accessory) 槽位重設計

---

## 2026-04-28

裝備重構 + 戰鬥屬性 EXP 設計（design doc）：
- equipment-rework.md：5 級品質 + 10 詞綴 + 主人賜 3 條護飾線 + 葛拉鋪 UI + 競技場戰利品 + 對手強度重新校準 + 27 格儲物 + Boss 戰鐵則
- battle-attr-gain.md：戰鬥動作累積 EXP + 評分加成 + 防刷 + 連勝獎勵階梯（10 連勝解鎖 `bloodRoar`）+ 第 6 種狂熱 `COMBAT_fervor`
- blacksmith-signature-weapon.md：葛拉個人任務 8 階段

---

## 2026-04-25c（大掃蟲日）

- **CRITICAL** 老默治療「選了沒反應」第 4 次真根因 — `ChoiceModal._handleChoice` 在 `_close()` 後讀 `_activeEvent.logColor` → null TypeError
- **CRITICAL** 葛拉每天重播「差了一個 tier」— `Stage.playEvent` async 但忽略 `opts.onComplete`
- **CRITICAL** 競技場戰敗 = 直接 deathEnding → 改成隨機重傷
- **CRITICAL** Math.round 默默把 +1 歸零 — Hector 訓練被動好感 bug
- DialogueModal 同步呼叫兩次會覆蓋 onComplete → 加排隊機制
- 戰鬥獎勵全面 ×0.5、競技場難度全面退回
- 葛拉鍛造線移除所有競技場依賴
- 3 個跑腿事件全升格 DialogueModal 戲劇化

---

## 2026-04-25（v10 監督官巴爺主線）

- 監督官改名「**巴布魯斯（巴爺）**」、退役角鬥士、完整好感互動線
- 三角動機鏈（主人愛錢愛名 / 塔倫沒能力 / 巴爺被借局陷害）
- 4 層揭露結構：梅拉播種 → 塔倫稱讚 + 引爆事件 → 老默/卡西烏斯回響 → 偷聽密謀 → 喝酒透漏選擇
- 新劇情技能：`unyielding` / `veteran_eye`
- 抓偷懶 4 階梯（主人 5% / 侍從 10% / 塔倫 20% / 巴爺 75%）

---

## 2026-04-24（晚）狂熱重構

- 5 條鐵則重做：5 attr 命名統一（力/敏/體/反/意） + 訓練動作改名（推舉石頭/投接碎石/杖擊承受/亂棍格擋/打坐冥想） + 對白池全重寫 + Stage.popupBig 共用元件 + 訓練按鈕視覺強化

---

## 2026-04-24

- 狂熱系統落實（fervor.md）— 取代舊 compulsion 強迫症
- bare `addLog` 大清（CLAUDE.md 第 12 條鐵律）+ 老默治療 bug 根治 + Hector Phase 1 完成 + Day 1 開場大翻修

---

## 2026-04-19（世界觀大擴充 + 多系統上線）

**新文件**：mansion-geography.md / master-family-spec.md / found-family.md / livia.md / marcus.md
**重寫**：orlan.md 背景三段式（磨坊子→阿圖斯家傭人→被 Marcus 告發偷錢→Livia 求情降級）

**新系統**：
- 出生特性三層擲骰（稀有 1% / 罕見 3% / 常見 10%、三層獨立）
- 強迫症系統（4 種訓練強迫症、後改成狂熱）
- 傷勢系統（4 部位 × 3 級嚴重度 + origin×部位回憶矩陣 + 老默三階段 → 密醫紙條）
- 讀書系統（5 類 13 本種子書、見識數值、書櫃 5 本、傻福三階段、起手書按 origin 差異化）
- 出生特性軸組系統（5 軸互斥、各軸正負稀有特性 + 重擲 + 特性轉化）
- 8 origins 擴展（farmBoy/nobleman/ruinedKnight/beggar/artisan/criminal/gambler/believer）

---

## 2026-04-16（D.20-22 主線爆發週）

- D.22 醫生老默 + 治療系統（DialogueModal 18 句 + 四種傷勢差異化治療 + 藥房懸念橋接）
- D.21b 奧蘭脊椎升級 + 藥房懸念完整鏈 + 道德光譜 UI
- D.21 對話系統 + 晨思系統（DialogueModal L2 + MorningThoughts 30 條 + Stage.playMorning + 奧蘭 Day 1 升級）
- D.20 奧蘭主線 — 永駐兄弟完整四幕（10 storyReveals + 偷藥/分房/訣別三大事件 + 生死援手）
- D.19 道德累積特性系統（10 earned traits + 滑動窗口 + NPC 愛憎倍率）
- D.18 訓練協力 v2（屬性偏好 + 背景角鬥士池 + 碎念/八卦）

---

## 2026-04-13 ~ 15

- D.7 階段 B 人物面板重構（兩欄 / 六角形 / EXP 條）+ Phase 1-J 場地極簡化
- D.6 v2 EXP 單一資源模型、技能購買、整數化全部
- D.12 NPC 故事揭露系統上線（卡西烏斯為範本）

---

> 更早歷史見 `changelog.html`（HTML 版本歷次變更紀錄）
