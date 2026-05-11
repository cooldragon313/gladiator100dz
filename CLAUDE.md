# 百日萬骸祭 · 專案開發筆記

> 這份文件由 Claude Code 在**每個新對話 session 啟動時自動讀取**。
> 記錄專案的核心約定、開發習慣、設計哲學，確保跨電腦/跨 session 的一致性。
> 新的慣例出現時應該**主動提醒使用者「這應該記進 CLAUDE.md」**。

---

## 📰 接手頭條（給下次 session 的第一眼）

> 這個區塊一直擺在最上面，每次 session 結束時更新。每次 session 開始時請先看這裡，
> 知道**上次停在哪、明天可以從哪繼續**。

### 2026-05-12 結束時狀態（Sol Arc Phase 1 實作完成、明天測試）

**✅ 今天主要成果**
- **Sol Arc Phase 1 全部落地**（救索爾分支實作完）
  - 新建 [src/quests/sol_arc.js](src/quests/sol_arc.js)（~340 行）— Phase 1 完整邏輯
  - 改 [src/main.js](src/main.js)：Day 5 戰勝後 hook `SolArc.offerSpareSol` + `_endOfSandWash` 通用塔倫對白（30 訓練門檻）
  - 改 [src/core/stats.js](src/core/stats.js)：`modMoney` 攔截正向金額、call `SolArc.applyMoneySkim` 扣抵債務
  - 改 [game.html](game.html)：加 sol_arc.js script 載入
- **Phase 1 對白大改寫**（user 2026-05-12 一連串訂正）
  - 主人對白：「哼~」+ 震動 → 三選一 → 100 買價 + 100 罰金 = **200 銅幣總債**
  - 塔倫補刀加抽鞭：「別讓我看到你偷懶——」`effect: shake-and-flash`
  - **取代結算 popup** → 主角 OS（「主人今天肯定是很不高興⋯⋯」）+ 扶索爾走醫療室
  - **加老默 scene**（順便當老默 first meeting）：「你也挺有種的⋯⋯別死太快阿」
  - 老默好感 +3（「有種」印象）
- **赫克特插話 bug 修**：不是「第一次注意你」（Day 1 走廊已搭話過）、改成「又靠過來」
- **顏色 audit**：
  - 阿圖斯：誤用卡西烏斯色 `#5a7a9a` → 改 `#d4af37`（金色、主人/貴族招牌）
  - 塔倫長官：`#883333` 暗紅難讀 → `#cc6666` 柔紅
  - midgame_bosses.js + recruit_enemy.js 既有塔倫對白色一併更新
  - 更改對話專用.md 色表 + 加 Aristus 條目

**✅ 昨天（2026-05-11）完成**
- Sol Arc 5 階段 spec 拍板（[docs/quests/sol-arc.md](docs/quests/sol-arc.md)）
- Day 5 沙洗加 E 路徑（饒索爾）+ 通用塔倫對白（30 訓練門檻）
- 買自由結局（500 銅幣 + Day 60+）

**🔮 下次開工優先序**
1. **🐛 測試 Phase 1 索爾分支**（user 2026-05-12 睡前指定）
   - `Game.testJump('day5')` + `Game.godMode({attr:30})` 進沙洗
   - 戰勝索爾（HP > 70%）→ 應該彈「了結 / 讓他活著」
   - 選「讓他活著」→ 看完整 30+ 行對白 + 主角 OS + 老默 scene
   - 確認：`Flags.get('debt_to_master')` = 200、`Flags.has('met_doctor')` = true
   - 跑腿賺錢測扣抵：`Stats.modMoney(30)` 應該扣 30 進債務
2. **🐛 系統 audit：day_story_claimed flag 機制**（user 2026-05-12 提議、未實作）
   - 詳見上次對話「腳本宣告佔用」flag 機制
   - 目標：任何腳本事件設旗、隨機事件查旗、不再用 SCRIPTED_DAYS 寫死清單
   - 涉及檔案：DayCycle、cross_ludus、lord、kade、midgame_bosses、intra_events、doctor_events、npc_reactions/conflicts、recruit_enemy、background_gladiators、mela_rat、errand_outings
   - 工程量約 30-50 行、跨 10 檔案
3. **Phase 1 測試 OK 後** → 開 Phase 2（索爾養傷 10 天醒 + 偷懶遮掩 + 守夜情報 + CON 陪練）

**⚠️ Phase 1 已知未完成**
- Phase 1 數值靜默套用、不開 popup（已實作）
- 老默對白 + `met_doctor` 設 true、跳過 doctor_events.js `_firstVisit`（已實作、需測試）
- 還清演出（Stage.popupBig + 對白）保留（不在每次扣款時、只在還清那一刻）

### 2026-05-11 結束時狀態（索爾存活線 5 階段 spec + Day 5 沙洗大改）

**✅ 今天主要成果**
- **「索爾存活線」5 階段 Arc spec 拍板** → 新建 [docs/quests/sol-arc.md](docs/quests/sol-arc.md)（10 段 / ~600 行）
  - **Day 5 沙洗加 E 路徑**：A-S/A 級碾壓 → 戰後彈「饒他」選項 → 跪求主人
  - 救索爾代價：主人 -15、長官 -10、**100 銅幣債**（任何 modMoney+ 都先扣抵）
  - 競技場**通用門檻**：訓練累計 30 次才能上場（不分救不救、邏輯一致）
  - 索爾養傷 10 天、Day 15 醒、感激誓言對白
  - Phase 2 偷懶遮掩（取代擋鞭、邏輯通）+ 守夜情報 + CON 陪練
  - Phase 3 帶索爾見黑鬍子 + 義肢（4 種規格、連動 [blackmarket.md](docs/systems/blackmarket.md)）
  - 索爾全盤接受、玩家自主決定義肢材質 + 可選自發匯款 -50 銅幣（kindness）
  - Phase 4 NvN 三賤客（玩家 + 奧蘭 + 索爾）+ 戰利品分享 + 防陰招升級
  - Phase 5 結局 4 變體：B 反撲 Sol 死守 / A 加冕同行 / 買自由帶走 / 逃脫後盾
- **新結局：買自由**（[ending-presentation.md](docs/systems/ending-presentation.md)）
  - 條件：500 銅幣 + fame 50 + master aff 30 + Day 60+
  - 結局名：「買來的命買回去」
  - 跟其他結局共存（Day 60+ 累積條件即可）
- **Day 5 沙洗通用塔倫對白改寫**：「競技場對外一直開、但你要練到我點頭」
  - 訓練 30 次門檻、達標後塔倫主動通知
  - 救不救索爾共用門檻（不分路線）

**✅ 昨天（2026-05-10）完成**
- NvN 2v2 玩家不攻擊 bug 修復（_allyTurn sync）
- 戰鬥動畫定位修（_findSlotForUnit unit-based）
- 腳本日擋掉隨機 intra 事件 + 老默
- 戰鬥日誌智慧捲動 + 暫停 + 320px 加高
- 勝利畫面浮動「看日誌 / 返回 / 直接離開」3 鈕
- 5×1 按鈕單列 + 頭像格縮高

**🔮 下次開工優先序**
1. **驗收 sol-arc.md spec 內容**（你看完整個 spec、有沒有要改的）
2. **Phase 1 實作起手**：救索爾分支對白 + 100 銅幣債扣抵 wrapper + 訓練 30 門檻
3. **驗收前幾天的大量內容**（test.html 各 testJump 跑一輪）
4. **fame 大重整 audit**（memory 標註、現在門檻太鬆）
5. **黑市 + 仇恨度實作起手**（spec 已就位）

**⚠️ 設計漂移待修（2026-05-11 user 發現）**
- **採臉 vs 放過 對白不對齊**：當前切磋勝利 onWin 觸發招敵變友 seedLines（凱里烏斯 / 諾克斯）說「**我欠你一次**」、感覺像對方在謝謝你 → 跟 [grudge-and-schemes.md § 1](docs/systems/grudge-and-schemes.md) 新 spec「採臉 = 對手憤怒、累積仇恨」**不同步**。
  - 根因：[recruit_enemy.js:37](src/npc/recruit_enemy.js) seedLines + [cross_ludus_events.js:154](src/quests/cross_ludus_events.js#L154) sparring onWin
  - 不是方向走錯、是舊代碼還在跑、新 spec（四選一含斷手腳）未實作
  - 等實作仇恨度四選一時、要把現有「採臉」相關對白 + 後果同步改成新 spec

**⚠️ Sol Arc spec 待 user 拍板的議題** — 詳見 [sol-arc.md § 7](docs/quests/sol-arc.md)
1. 救索爾要求 S/A 級碾壓 OK？還是 B 也行？
2. ~~索爾抗拒~~ ✅ 已拍板：索爾不抗拒、玩家自主匯款
3. 三賤客好感門檻 60 OK？
4. 索爾贖金 200 OK？
5. 給女兒匯款後加 Day +5 storyReveal「⋯⋯收到了」？
6. Phase 4 戰利品分配跟既有邏輯衝突？
7. 買自由結局是否加主人「⋯⋯你確定？」收尾？
8. 殺索爾路線是否保留 / 加強？
9. 索爾女兒 D 完整名揭露時機？

### 2026-05-10 結束時狀態（仇恨度系統 spec + godMode bug 修）

**✅ 今天主要成果**
- **「仇恨度與敵方陰招」系統 spec 拍板** → 新建 [docs/systems/grudge-and-schemes.md](docs/systems/grudge-and-schemes.md)（13 段 / ~750 行）
  - 戰後**四選一**（斬首 / 斷手腳 / 採臉 / 放過）— 取代既有「只有大勝才彈」
  - 個人 grudge + faction grudge（per-opponent + per-school）
  - 場合倍率（私下 ×1 / 主人觀戰 ×2.5 / 公開賽事 ×4 + 立即報復 flag）
  - 對手特性修正（cruel/impulsive ×1.5、patient/merciful ×0.7）
  - revenge_target 強制 80% 下次派遣回歸 + 重逢戰前對白（personality 變體）
  - 戰中陰招菜單（撒沙 / 暗藏毒匕 / 暗器 / 休息室埋伏）+ personality 反應
  - **玩家被斷手腳機制** → 1-3 天後 hector 引介黑鬍子 → 接義肢線
  - 主人 / 長官好感降低、靠後續勝利自然回升（不需特別任務）
  - 塔倫長官 Day 5 沙洗開場對白擴展（教學藏在世界觀內）
  - 玩家對自己人下陰招的後果（隊友不滿、對方好感不足會報復）
- **裝備色階 bug 修復** → 加 `debug` 品質階層（粉紅 / 2.0× / 「【DEBUG】」）
  - [equipment_quality.js](src/systems/equipment_quality.js) 加 debug 級
  - [main.js godMode](src/main.js#L8155) 套件全標 quality:'debug'、一眼分辨非正本
  - [blacksmith_events.js](src/npc/blacksmith_events.js) T1 套裝補 quality:'common'

**✅ 昨晚（2026-05-09 晚）完成（黑市整理）**
- 「赫克特的生存之道」spec 拍板（5 服務 → 3 服務）
- 新建 [blackmarket.md](docs/systems/blackmarket.md) / [blackbeard.md](docs/characters/blackbeard.md) / [steelpalm.md](docs/characters/steelpalm.md)
- 更新 hector.md / arena-system.md § 1.6 / hector_events.js 註解
- 刪除 discussions/2026-04-20-arena-hp-blackmarket.md

**🔮 下次開工優先序**
1. **🐛 NvN 2v2 玩家不攻擊 bug — 驗證已 commit 的修復**（user 2026-05-11 睡前指定優先）
   - 症狀：Day 35 雙主人合作場、玩家 ATB 有跑但「沒移動到前面打人」、法烏（隊友）秒掉對手、玩家從頭到尾沒攻擊
   - **已 commit fix（commit `64cf6fc`、未驗證）**：`_allyTurn` 殺敵後加 `_syncCurrentEnemy()`、`_playerAttack` 開頭加 sync + null guard
   - **明天第一步**：請 user 確認 3 件事
     1. **自動戰鬥按鈕有按嗎？**（NvN 預設 `_autoRunning = false`、要手動開或按攻擊鈕）
     2. **攻擊按鈕有按嗎？按了有反應嗎？**（按了沒反應 = fix 沒中根因 / 沒按 = 不是 bug）
     3. **dev console F12 → Sources → battle.js → Ctrl+G 搜「2026-05-11」確認 2 處 fix 載到了**
   - 三種情境對應：
     - 手動 + 沒按 = 不是 bug、教 user 開自動戰鬥
     - 手動 + 按了沒反應 = fix 沒中、繼續查（doAction / `_setButtons` / 按鈕禁用？）
     - 自動模式但不打 = fix 沒中、查 ATB tick 邏輯（`wasReady && nowReady` 邊緣觸發失效？）
   - 副帶釐清（user 2026-05-11）：「敵人打我啥感受不到兩人都沒受傷」**不是 bug**、是 godMode 太強（debug 品質 2.0× + 滿護甲 → 敵攻擊只削 3-8 點）
2. **🐛 picker 色階 bug 已修復 ✅**（user 2026-05-11 確認粉紅色 godMode 裝備可見、cache 問題、Disable cache + F5 解決）
   - 症狀：裝備區 + 葛拉區看得到紫色裝備、但「換裝備 picker」全白、godMode 粉紅也看不到
   - 兩個可能：(A) 存檔早於 quality 系統、entry 缺 quality 欄位 / (B) CSS `.cs-picker-name { color: var(--text-hi) }` 不知何故 override inline span
   - **明天第一步**：請 user 在 dev console 跑這兩段：
     ```js
     console.log('weapons:', JSON.stringify(Stats.player.weaponInventory, null, 2));
     console.log('armors:',  JSON.stringify(Stats.player.armorInventory,  null, 2));
     // 開 picker 後：
     document.querySelectorAll('.cs-picker-name').forEach((el,i) => console.log(i, el.outerHTML));
     ```
   - 看 inventory 是否有 quality 欄位 + picker HTML 是否有 inline span
   - 對應修復：
     - 若 quality 缺 → 跑 sanitizeInventory + 確認葛拉升級流程也保留 quality
     - 若 CSS override → 把 `formatItemNameHTML` span 改成 `style="color:X !important"` 或調整 `.cs-picker-name` CSS
2. **驗收前幾天的大量內容**（NvN 2v2 修好後、test.html 各 testJump 跑一輪）
3. **黑市 + 仇恨度實作起手**（spec 已就位、可開工）：
   - 前置：派遣制 [arena-system.md § 1.1-1.5](docs/systems/arena-system.md) 必須先做
   - 然後：傷勢系統開 `severity:4 = severed`
   - 然後：戰後四選一 + 戰中陰招 hooks（battle.js）
   - 然後：hector_services.js 約酒 + 派遣前菜單
   - 後段：blackbeard_events.js + 商店 UI + 義肢線
4. **fame 大重整 audit**（memory 標註、現在門檻太鬆）
5. **NvN 戰鬥對手平衡**（memory 標註、現在 2v2 太弱）
6. **非農家 origin 領主主線平行對白**

**⚠️ 設計漂移待修（2026-05-11 user 發現）**
- **採臉 vs 放過 對白不對齊**：當前切磋勝利 onWin 觸發招敵變友 seedLines（凱里烏斯 / 諾克斯）說「**我欠你一次**」、感覺像對方在謝謝你 → 跟 [grudge-and-schemes.md § 1](docs/systems/grudge-and-schemes.md) 新 spec「採臉 = 對手憤怒、累積仇恨」**不同步**。
  - 根因：[recruit_enemy.js:37](src/npc/recruit_enemy.js) seedLines + [cross_ludus_events.js:154](src/quests/cross_ludus_events.js#L154) sparring onWin
  - 不是方向走錯、是舊代碼還在跑、新 spec（四選一含斷手腳）未實作
  - 等實作仇恨度四選一時、要把現有「採臉」相關對白 + 後果同步改成新 spec

**⚠️ 待你拍板的議題**

黑市 7 議題（見 [blackmarket.md § 5](docs/systems/blackmarket.md)）+ 仇恨度 9 議題（見 [grudge-and-schemes.md § 11](docs/systems/grudge-and-schemes.md)）。

主要核心未決：
- 「會生存的」特性 ID（暫用 `streetwise`）+ 效果
- 義肢實作時機（待傷勢系統開 severed）
- 致命陰招（慢性毒、暗殺）真要做？
- 戰中陰招擲骰時機固定回合 vs 動態觸發

### 2026-05-09 結束時狀態（晚 22:00 黑市整理完）

**✅ 今天上午大量完成**
- **NvN 戰鬥引擎全面落地**（7 stage、Stage A-G、commit `c6dcd3a` ~ `cf2d981`）— 詳見 [HISTORY.md](HISTORY.md)
- **NvN polish**：隊友指令系統（自動/集火/防禦）+ 智能威脅 AI + last-stand 修正（`7fe1053`）
- **P2 全清**（P2-1~P2-8）：P2-4 Day 35 真 2v2 / P2-5 Day 60 真 2v2 / P2-6 Day 50/80 / Day 75 公開宴會 / P2-8 食物下毒（3-tier 梅拉預警 + Day +6 追查）
- **P3 場內 7 事件**：偷竊 / 欺負新人 / 老默喝醉 / 廚房短缺 / 詐賭 / 找到舊書 / 共夢 + **赫克特試煉**（派系深化、3 條路）
- **P4 中段 5 boss**（[midgame_bosses.js](src/quests/midgame_bosses.js)）：B1 鐵骨阿巴 / B3 快刀沙洛 / B4 血斧穆爾（強制傷勢）/ B5 黑爪 / B6 七勝者塔倫弟
- **領主主線補強**：Day 72 巴爺夜宴提示 + Day 80 fame 30→80 + Day 65 衝動分枝放寬 + 冷靜分枝得「復仇者」永久特性
- **凱德 Day 85 消化**（補 80→90 空檔、城南酒館 50 行對白）
- **萬骸祭 B 路殘血群戰真做**（從骰子 stub → 真 NvN 戰鬥）
- **debug**：testJump 自動清「done」flag（`1723af7`）+ skipToDay 允許回跳（`fe838b1`）

**✅ 今天晚上完成（黑市整理 — spec only、零實作）**
- **「赫克特的生存之道」spec 拍板**：5 服務 → 3 服務（情報 / 下毒 / 買通）、改 reliability 軸、加詭異名聲社交代價
- **新建 [docs/systems/blackmarket.md](docs/systems/blackmarket.md)** — 主規格（赫克特 + 黑鬍子 + 義肢、約 700 行）
- **新建 [docs/characters/blackbeard.md](docs/characters/blackbeard.md)** — 黑市販子人設
- **新建 [docs/characters/steelpalm.md](docs/characters/steelpalm.md)** — 守衛兼義肢活廣告
- **更新 hector.md** — 加「黑市販子身份」段、cassius 對比段（為何只有他做）
- **更新 arena-system.md § 1.6** — 壓成指針 → blackmarket.md
- **更新 hector_events.js 註解** — 「三功能」修為待建函式 + 規格指向
- **刪除 [discussions/2026-04-20-arena-hp-blackmarket.md](docs/discussions/2026-04-20-arena-hp-blackmarket.md)**（內容已搬完）

**🔮 下次開工優先序**
1. **驗收上午大量內容**（test.html 各 testJump 跑一輪、確認無爆）
2. **黑市實作起手**（spec 已就位、可開工）：
   - 前置：派遣制 [arena-system.md § 1.1-1.5](docs/systems/arena-system.md) 必須先做（赫克特 3 服務都接派遣）
   - 然後：`hector_services.js` 約酒對白 + 派遣前菜單
   - 之後：battle.js 加 6 個武器特性 hooks（飲血、毒 DOT、眩暈、破甲、反射、開場 buff）
   - 後段：blackbeard_events.js + 商店 UI
3. **fame 大重整 audit**（memory 標註、現在門檻太鬆）
4. **NvN 戰鬥對手平衡**（memory 標註、現在 2v2 太弱）
5. **非農家 origin 領主主線平行對白**（先領主後 origin 順序、現在領主圓了）
6. **flaming 詞綴升級為真 DOT**（要做 statusEffects tick 系統）

**⚠️ 黑市 spec 待 user 拍板的 7 個議題** — 詳見 [blackmarket.md § 5](docs/systems/blackmarket.md)
1. 「會生存的」特性 ID（`survivor` / `cunning` 都被佔用、暫用 `streetwise`）
2. 「會生存的」特性效果（戰前逃跑選項？黑市對話加成？）
3. 武器後補 2 把（破甲穗 / 鏡面盾）的觸發條件
4. 義肢實作時機（等傷勢系統開 severed 嚴重度）
5. 落魄騎士拒絕的具體事件 trigger
6. 黑鬍子是否有「條件式上架」
7. 詭異名聲是否要做隱形 chip / 顯性提示

**⚠️ 已知未修**
- NvN 特殊動作仍鎖打玩家（劇情向、可選改）
- flaming 詞綴 MVP「命中 +5」
- 隊友指令「防禦」太陽春（只 TB_defend、沒實質減傷）

**💡 暫緩議題（memory 紀錄）**
- 裝備差決定論 vs 屬性決定論（`feedback_pending_design_reviews.md` #1）
- 2v2 對手太弱（同上 #2）
- fame 全面 audit（`feedback_fame_audit_pending.md`）
- **密醫 NPC 線**（user 2026-05-09 晚決議：老默現階段全包傷勢、密醫延後）

---

## 🎮 專案類型

瀏覽器端 vanilla JS 角鬥士 RPG，使用繁體中文敘述。
- **無框架**（不用 React/Vue/等），純 HTML + CSS + JS
- 所有模組都用 **IIFE 寫法**：`const X = (() => { ...; return { ... }; })();`
- 遊戲入口：`game.html`，相依模組透過 `<script src=>` 順序載入
- 存檔使用 localStorage，schema v5

---

## 📚 重要文件讀取順序

1. **`DESIGN.md`** — 所有設計決策的單一真相源 (2026-04-15 重構後 ~800 行，可完整讀)
   - 頂部有 **📊 實作進度總表**（這是**進度的唯一事實源**）
   - 頂部有 **📋 TO DO / CHECK LIST**（當下開發焦點，每次更新）
   - 頂部有 **🎯 TL;DR**（新協作者 5 分鐘入門）
   - § 1 技術架構 / § 2 遊戲核心系統 / § 3 人物系統 / § 4 世界觀系統
   - § 5 UI 規範 / § 6 開發規範 / § 7 設計哲學 / § 8 內容模板 / § 9 路線圖
   - ⚠️ **「X 做完了嗎」→ 只看頂部進度總表**。其他章節的 checkbox 都是歷史快照。
2. **`HISTORY.md`** — 已實作系統的歷史細節、已廢棄設計的考古紀錄。一般開發不需要讀。
3. **`docs/CONTENT-TEMPLATES.md`** — 新 NPC / 武器 / 訓練所等內容創作模板（原 D.11）。
3-0. **`docs/CODEX.md`** — 🆕 **完整字典（2026-04-19）**：特性/書本/origin/傷勢/見識/旗標/數字速查表一份搞定。查「某個特性效果是什麼」「某本書門檻多少」「某 flag 做什麼用」先看這份。
3-0b. **`docs/CANON.md`** — 🆕 **故事事實單一事實源（2026-04-19）**：時間線、角色年齡、誰知道什麼、關係歷史。**寫新對白/事件前必查**。跟 CODEX 分工：CODEX 存規則，CANON 存事實。
3a. **`更改對話專用.md`**（root）— **對白編輯入口**。查某段對白在哪、怎麼改、配色規範、新事件登記都看這份。
3a1. **`docs/characters/*.md`** — 🆕 D.28：每個 NPC 的完整檔案（愛憎 / 對話風格 / 特性反應 / 招牌動作 / 程式碼指標）
   - 目前已建：orlan / melaKook / cassius / hector / doctorMo / officer / masterArtus / sol / overseer
   - 🆕 **livia**（主人娘，Phase 2/3 登場）/ **marcus**（少爺，Phase 2 登場）
   - 🆕 **blackbeard**（外部黑市販子）/ **steelpalm**（黑鬍子守衛、義肢活廣告）— 2026-05-09
   - 改 NPC 對白先看這份，確保語氣一致
3b. **`docs/quests/*.md`** — 🆕 D.28：每個任務的完整設計書（觸發 / 階段 / 門檻 / 對白 / 獎勵 / flag）
   - 目前已建：mela-rat / day1-opening / **day5-sand-wash**（2026-04-19）/ **blood-feast**（2026-04-20，Day 49 血戰宴會）
3c. **`docs/systems/*.md`** — 🆕 D.28：系統規範（night-events, multi-check-quest, **reading**, **books-catalog**, **wounds**, **compulsion**, traits, origins, timeline, battle-*, npc-growth, **equipment-rework**, **battle-attr-gain**）
   - 🆕 **reading.md / books-catalog.md**（2026-04-19）：讀書系統 + 五類書本 + 見識數值 + 傻福三階段交互
   - 🆕 **wounds.md**（2026-04-19）：4 部位 × 3 級傷勢系統 + 低體力擲傷 + 好痛觸發 + 老默三階段 → 密醫引薦
   - 🆕 **fervor.md**（2026-04-22 設計 / 2026-04-24 實作）：4 種訓練狂熱（力/敏/耐/禪）+ 自然觸發（5 天 8 次）/ 瓶頸儀式（20/30/.../100）+ 5 次結束
   - 🆕 **origin-design-spec.md**（2026-04-19）：**新增 origin 必看** — 完整欄位 / statMod 平衡 / 起手書原則 / 被抓損失 / 受傷權重 / 回憶對白矩陣 / 未來擴充（起手技能 + 專屬事件）/ 檢查清單
   - 🆕 **mansion-geography.md**（2026-04-19）：大宅地理 — 主人家 + 訓練場**同座建築**，正門/側門/共用中段
   - 🆕 **master-family-spec.md**（2026-04-19）：訓練所家庭通用規範 — archetype 模板，每個訓練所 = 一個家族故事
   - 🆕 **found-family.md**（2026-04-19）：新家人系統 — NPC 以家人稱呼確認關係的儀式（奧蘭=兄弟/梅拉=母/卡西烏斯=師⋯）
   - 🆕 **ending-presentation.md**（2026-04-19）：結局呈現系統 — 四幕結構（競技場/他們眼中/你成為了誰/多年後）+ 5 軸線組合 + 隱藏第五幕 + 文字風格規範。Disco Elysium 級敘事哲學。
   - 🆕 **blackmarket.md**（2026-05-09）：黑市總規格 — 赫克特生存之道（3 服務）+ 黑鬍子貨棧（傳奇武器 + 義肢）+ 詭異名聲社交代價。零實作、純 spec。
   - 🆕 **grudge-and-schemes.md**（2026-05-10）：仇恨度系統 — 戰後**四選一**（斬首/斷手腳/採臉/放過）+ 個人 / 訓練所 grudge + revenge_target 重逢戰 + 戰中陰招（撒沙/毒匕/暗器）+ 休息室埋伏 + **玩家被斷手腳→義肢線**（接 blackmarket）+ 塔倫長官 Day 5 教學擴展。零實作、純 spec。
3b-sol. **`docs/quests/sol-arc.md`** 🆕（2026-05-11）：**索爾存活 5 階段** — Day 5 A-S/A 饒他 → 100 銅幣債 → 養傷 → 偷懶遮掩 → 義肢 → 派遣三賤客 → 結局忠誠 4 變體。買自由結局新增。零實作、純 spec。
3d. **`docs/philosophy/*.md`** — 🆕 D.28：設計哲學（numbers-hiding）
4. **`changelog.html`** — 版本記錄與歷次 commit 摘要
5. **`NOTES.md`** — 🆕 手機草稿本。使用者會在手機上寫未整理的想法到底部「待整理」區。
   **看到使用者叫你「整理 NOTES.md」時**：讀 NOTES.md → 歸類每個項目（屬於哪個章節）
   → 寫進正式文件 → 清空 NOTES.md 的待整理區（保留頂部使用說明）→ commit。
6. **`memory/MEMORY.md`** — 本機 auto-memory（使用者偏好、回饋）

---

## ⚠️ 開發習慣（實作前必跑）

### 跨系統整合檢查清單（D.15）

**在提案任何新事件、動作、NPC、物品、特性之前，在回覆中跑一遍這 9 題：**

1. **好感度連動** — 會改動哪個 NPC 的好感？有沒有好感門檻才能觸發？
2. **特性共鳴** — 有沒有哪個玩家特性應該觸發不同結果？
3. **故事揭露連動** — 會解鎖哪個 NPC 的 storyReveal？
4. **資源/物品流動** — 給/花 EXP、金錢、護符、個人物品、SP？給的東西有 storyTag 嗎？
5. **Stage 演出需求** — 用 `Stage.playEvent` 做小過場？還是純 log + flash？
6. **Origin 差異化** — 貴族跟農家子弟看到的內容應該不同嗎？
7. **觸發頻率** — onceOnly / 每日 / 每週 / 機率 / 永久常駐？
8. **旗標與後續鉤子** — 需要 `Flags.set(...)` 讓未來系統讀嗎？
9. **🆕 道德軸驅動（D.19）** — 有沒有道德意涵？要觸發哪個軸（reliability/mercy/loyalty/pride/patience）？weight:1 還是 weight:3？

**明確表態原則**：對每一題要主動回答「有 / 沒有 / 先不做」，不要跳過不講。

如果使用者說「**檢查整合清單**」，重新跑一遍 8 題。

---

## 📖 術語字典（命名權威）

> **新增命名前先查這張表**。如果表裡已有對應概念，用表裡的名字。
> 實作前 `grep` 確認 codebase 中既有的命名。不要自己造新詞。

| 概念（中文） | 程式碼 ID / 欄位名 | 所在檔案 |
|---|---|---|
| 屬性偏好 | `favoredAttr` | npc.js, fields.js |
| 訓練所權重 | `favorWeight` | fields.js |
| 愛憎特性 | `likedTraits` / `dislikedTraits` | npc.js |
| 道德軸 | `moralAxis` + `moralSide` | config.js, moral.js |
| 滑動窗口 | `player.moralHistory` | moral.js |
| 道德軸推進 | `Moral.push(axis, side, {weight, lock})` | moral.js |
| 背景角鬥士 | `BackgroundGladiators` | background_gladiators.js |
| 熟悉度 | `familiarity`（門檻 40） | background_gladiators.js |
| 碎念 | `getMumble()` | background_gladiators.js |
| 八卦 | `GOSSIP_POOL` / `signatureGossip` | background_gladiators.js |
| 晨思 | `MorningThoughts` | morning_thoughts.js |
| 懸念回收 | `queueResolution(thoughtId)` | morning_thoughts.js |
| 重量級對話 | `DialogueModal.play(lines, opts)` | dialogue_modal.js |
| 輕量對話 | `addLog(text, color, flash, important)` | main.js |
| 故事揭露 | `storyReveals` | npc.js |
| 對話行 | `dialogueLines` (storyReveal 欄位) | npc.js |
| 永駐兄弟 | `orlan` | npc.js, orlan_events.js |
| 醫生 | `doctorMo` | npc.js, doctor_events.js |
| 協力倍率 | `synergyMult` | main.js, effect_dispatcher.js |
| 人多熱鬧 | `crowdMult`（1 + 0.08 × 人數）| main.js |
| 硬上限 | ×15 cap | main.js |
| 關鍵事件權重 | `weight: 3` | moral.js |
| 劇情鎖 | `lock: true` | moral.js |
| 三段協力門檻 | aff ≥ 30/60/90 → ×1.3/1.6/1.8 | main.js |
| 背景單段門檻 | familiarity ≥ 40 → ×1.3 | background_gladiators.js |
| 生死關頭援手 | `OrlanEvents.tryDeathSave()` | orlan_events.js, stats.js |
| 晨起過場 | `Stage.playMorning(opts)` | stage.js |
| 藥房懸念 flag | `saw_olan_at_apothecary` | main.js, morning_thoughts.js |
| 藥房解決 flag | `olan_apothecary_resolved` | npc.js (setFlag) |
| 分房 flag | `separated_from_olan` | orlan_events.js |
| 偷藥替罪 flag | `shared_olans_punishment` | orlan_events.js |
| 告發 flag | `betrayed_olan`（不可逆）| orlan_events.js |
| 🆕 見識 | `player.discernment` | reading.md / books.js（待建）|
| 🆕 書櫃 | `player.bookshelf[]`（上限 5）| reading.md / books.js（待建）|
| 🆕 專心書 | `player.focusBookId` | reading.md |
| 🆕 已讀清單 | `player.readBooks[]` | reading.md |
| 🆕 傻福階段 | `player.dullardStage`（0/1/2）| traits.md 傻福三階段 |
| 🆕 文字書 | 識字本 / 傳記類（推進傻福衰退）| books-catalog.md |
| 🆕 非文字書 | 技能 / 藍圖 / 地圖（不影響傻福）| books-catalog.md |
| 🆕 貪多嚼不爛 | 書櫃 ≥ 3 本未設專心 → 進度 ×0.7 | reading.md |
| 🆕 粗識文字 | 特性 `partialLiterate`（傻福半醒停留）| traits.md |
| 🆕 半醒拒絕 flag | `refused_awakening` | reading.md |
| 🆕 清醒觸發 flag | `dullard_awakened` | reading.md |
| 🆕 傷勢系統 | `player.wounds` | wounds.js |
| 🆕 四部位 | head / torso / arms / legs | wounds.md |
| 🆕 三級嚴重度 | severity:1/2/3（輕/中/重）| wounds.js |
| 🆕 好痛觸發 | `Wounds.checkTrainingPain(attr)` | wounds.js |
| 🆕 低體力擲傷 | `Wounds.rollLowStaminaInjury(attr)` | wounds.js |
| 🆕 傷勢減免 | `Wounds.getAttrPenalty(attr)`（整合到 Stats.eff）| wounds.js, stats.js |
| 🆕 密醫紙條 | `got_black_doc_contact` + personalItem `black_doc_contact` | doctor_events.js |
| 🆕 老默三階段 | `doctor_saw_severe_wound` → `doctor_hinted_black_doc` → `got_black_doc_contact` | doctor_events.js |
| 🆕 自然癒合 flag | `natural_recovery_triggered_{part}` | wounds.js |
| 🆕 狂熱系統 | `player.fervor` / `Fervor.*` | compulsion.js（IIFE 名 Fervor）/ fervor.md |
| 🆕 5 狂熱特性（正面暫時）| STR/DEX/CON/AGI/WIL_fervor — 力量/靈巧/體質/反應/意志狂熱 | config.js / fervor.md |
| 🆕 5 訓練動作名（單一事實源）| 推舉石頭(STR) / 投接碎石(DEX) / 杖擊承受(CON) / 亂棍格擋(AGI) / 打坐冥想(WIL) | actions.js + Fervor.TRAIN_NAME |
| 🆕 大字 POPUP | `Stage.popupBig({icon,title,subtitle,color,sound,shake})` | stage.js |
| 🆕 自然觸發 | 5 天內同屬性訓練 8 次 → 進入狂熱 | `Fervor.onTraining` |
| 🆕 瓶頸觸發 | 屬性升到 20/30/.../100 強制一次狂熱 | `Fervor.checkBreakthroughNeeded` in `Stats.spendExpOnAttr` |
| 🆕 狂熱加成 | 練對 EXP +25% / mood +5 / 練錯 mood -5 + 15% 擺爛 | `Fervor.getExpMultiplier` + `getMoodDelta` + `getSlackChance` |
| 🆕 狂熱結束 | 對應訓練累積 5 次；自然 → 14 天冷卻 / 瓶頸 → `fervor_passed_{attr}_{level}` flag | compulsion.js `_complete` |
| 🗑️ 舊強迫症 | `_addict` 特性 + `player.compulsion` — 已廢棄，存檔自動遷移 | — |

**Flag 命名規範**：`{主題}_{事件}_{狀態}` — 例：`olan_apothecary_resolved`、`doctor_visit_today`、`read_book_<id>`、`knows_blueprint_<id>`

### ⚠️ Debug 工具清單（上線前必須移除或鎖管理員）

> 以下功能僅供開發測試，正式發布前必須全部移除或加 admin flag 門檻。

| 工具 | 位置 | 用途 |
|---|---|---|
| **`test.html`** | 專案根目錄 | 🆕 2026-05-08 GUI 版 debug — 點按鈕跳場景、勾選 godMode、清存檔。寫 localStorage `__debug_jump`，遊戲 continue 時自動套用 |
| `Game.skipToDay(N)` | main.js（return 區塊內） | Console 輸入跳到指定天數 |
| `Game.godMode({attr,hp,fame,money,gear})` | main.js | 🆕 2026-05-08 屬性拉滿 + 給最強裝備 + 滿血錢名聲（測後段內容、不持久化）|
| `Game.testJump(scene)` | main.js | 🆕 2026-05-08 一鍵跳場景：`'day5' / 'day25' / 'day45' / 'day49' / 'day65' / 'day70' / 'day80' / 'day90' / 'day100' / 'wanguji'`（後段自動 godMode）|
| `Game.testChoice` | main.js | 測試 ChoiceModal |
| **F5 快存 / F9 快讀** | main.js 底部（IIFE 外） | 按鍵快速存讀檔 |
| **`_showGameIntro()`** | main.js（新遊戲流程內） | 測試用遊戲介紹頁，正式版改為官方首頁或移除 |

---

## 🏗️ 已實作系統登記（每次 session 開始前查這裡）

> **在做任何 UI 或功能之前先查這張表。如果已經有了，就用現有的，不要重做。**
> 更新規則：每次做完新系統或 UI，立刻在這裡補一行。

### UI 元件（角色頁）

| 功能 | 位置 | 關鍵函式 / ID | 備註 |
|---|---|---|---|
| **裝備欄位 picker** | main.js | `_renderEquipmentSlots()` / `_openEquipmentPicker()` / `#cs-equip-slots` | 已有主手/副手/胸甲三槽，點擊展開 picker，自動處理雙手武器 |
| **裝備切換** | main.js | `_equipItem(slot, itemId)` | 切換時自動清副手（雙手武器） |
| **裝備 picker 篩選** | main.js | `_getPickerOptions(source)` | weapons 來源只顯示 weaponInventory 裡有的 |
| **六角形屬性圖** | main.js | `_renderHexagon()` / `#cs-hex-svg` | SVG 六角形雷達圖 |
| **派生數值格子** | main.js | `_renderDerivedGrid()` | 10 項派生屬性 |
| **EXP 屬性升級** | main.js | `_renderAttrSpend()` | 花 EXP 升級，有升級鈕 |
| **特性顯示** | main.js | `_renderTraits()` | 空時 display:none |
| **疤痕顯示** | main.js | `_renderScars()` | 空時 display:none |
| **病痛顯示** | main.js | `_renderAilments()` | 空時 display:none |
| **道德光譜** | main.js | `_renderMoralSpectrum()` / `#cs-moral-spectrum` | 5 軸滑動窗口視覺化 |
| **技能列表** | main.js | `_renderSkills()` | passive skills |
| **關係圖 / NPC 卡片** | main.js | `_renderPeopleTab()` | flavor 文字 + 好感度色分 |
| **護符 6 格** | main.js | `_renderAmulets()` | Phase 3 預留，目前空格 |
| **寵物 3 槽** | main.js | `_renderPets()` | Phase 3 預留 |

### UI 元件（主畫面）

| 功能 | 位置 | 關鍵 ID | 備註 |
|---|---|---|---|
| **NPC 隊友欄位** | main.js `renderNPCSlots()` | `#tm-slot-0` ~ `#tm-slot-5` | 6 個 slot |
| **NPC 觀眾欄位** | main.js | `#aud-slot-0` ~ `#aud-slot-2` | 3 個 slot |
| **背景角鬥士字條** | main.js `_renderBackgroundStrip()` | `#bg-gladiator-strip` | 右上角小字，顯示熟悉度 |
| **戰鬥鈕** | main.js `_showTimelineBattleBtn()` | `#timeline-battle-btn` → `#stage-center` | 置中 + pulse 動畫 |
| **Stage 黑幕** | stage.js | `#stage-curtain-top` / `#stage-curtain-bot` | closeEyes / openEyes |
| **Stage 晨起覆蓋** | stage.js `playMorning()` | `#stage-morning-overlay` | 雞鳴 + 晨思，播完 display:none |
| **Stage 事件小過場** | stage.js `playEvent()` | `#stage-opening` | 標題 + 多行文字 |
| **DialogueModal** | dialogue_modal.js | `#modal-dialogue` / `.dialogue-box` | 垂直置中，Space/Ctrl |
| **ChoiceModal** | choice_modal.js | `#modal-choice` / `.choice-modal-box` | 多選項 + 條件篩選 |
| **行動列表** | main.js `renderActionList()` | `#action-list` | 動態生成訓練/休息按鈕 |
| **時段列** | main.js | `#time-slots` | 8 格 2h 時段 |
| **百日條** | main.js | `#hdb-wrap` | 100 天進度條 |
| **日誌** | main.js `addLog()` | `#log-content` | 捲動式文字日誌 |

### 遊戲系統模組

| 系統 | 檔案 | 關鍵 API | 備註 |
|---|---|---|---|
| **效果派發** | effect_dispatcher.js | `Effects.apply(list, ctx)` | 統一處理所有 vital/attr/exp/moral/flag/affection |
| **道德滑動窗口** | moral.js | `Moral.push(axis, side, opts)` | N=3 窗口，自動賦予/移除特性 |
| **晨思系統** | morning_thoughts.js | `MorningThoughts.pickToday(p)` | 每日一條，優先度分層 |
| **背景角鬥士** | background_gladiators.js | `BackgroundGladiators.rollDaily(day, weight)` | 碎念 + 八卦 + 協力 |
| **奧蘭事件** | orlan_events.js | `OrlanEvents.tryDeathSave()` | Day 30/60/85 脊椎事件 + 生死援手 |
| **醫生事件** | doctor_events.js | `DoctorEvents.tryVisit()` | 自動觸發，差異化治療 |
| **抓老鼠任務** | src/quests/mela_rat_quest.js | `MelaRatQuest.tryOffer()` / `playTonight()` | 🆕 D.28：白天接、晚上做、3 段判定 |
| **NPC 反應（情緒回聲）** | npc_reactions.js | `NPCReactions.pickDaily(day)` | Day 5/60/85 大選擇後隔日清晨 NPC 輪流表態 |
| **NPC 衝突事件** | npc_conflicts.js | `NPCConflicts.pickDaily(day)` | 6 個選邊站事件（赫克特/奧蘭/長官/老默/梅拉） |
| **結局判定器** | ending.js | `Endings.pickAndPlay(survived)` | 8 種結局：依 flags/屬性/特性自動判定 |
| **存檔系統** | save_system.js | `SaveSystem.saveToSlot()` / `loadFromSlot()` | 5 手動槽 + auto + backup |
| **日循環** | day_cycle.js | `DayCycle.onDayStart(name, cb)` / `fireDayStart(day)` | 各系統掛鉤的統一觸發器 |
| **場景舞台** | stage.js | `Stage.playSleep()` / `playMorning()` / `playEvent()` | 所有轉場動畫 |
| **音效合成** | sound.js | `SoundManager.playSynth(id)` | 8 種內建音效，Web Audio |
| **旗標系統** | flags.js | `Flags.set/has/get/increment` | 所有故事/狀態旗標 |
| **全域狀態** | game_state.js | `GameState.setFieldId()` / `getCurrentNPCs()` | session state |
| **戰鬥引擎** | battle.js + testbattle.js | `Battle.start(opponentId, onWin, onLose)` | ATB 即時制，兩套武器資料（待統一） |
| **武器資料** | weapons.js | `Weapons.shortSword` 等 | 給裝備 picker 用 |
| **護甲資料** | armors.js | `Armors` | 盾牌 + 護甲 |
| **敵人資料** | testbattle.js | `TB_ENEMIES` | 4 個敵人（rookie/gladB/vet/champion） |

### 玩家資料結構（Stats.player 關鍵欄位）

| 欄位 | 用途 | 更新方式 |
|---|---|---|
| `equippedWeapon` | 當前主手武器 ID | 裝備 picker / 武器事件 |
| `equippedOffhand` | 副手（盾/雙持）| 裝備 picker |
| `equippedArmor` | 胸甲 ID | 裝備 picker |
| `weaponInventory` | 擁有的武器陣列 `[{id, tier}]` | 武器獎勵事件 push |
| `moralHistory` | 5 軸道德滑動窗口 | Moral.push() |
| `moralLocks` | 鎖定的道德軸 | Moral.push({lock:true}) |
| `seenReveals` | 已觸發的 storyReveal ID | _scanStoryEvents |
| `traits` | 特性陣列 | 開場 + Moral 自動賦予 |
| `ailments` | 病痛陣列 | 失眠/受傷 + 醫生移除 |
| `exp` | 六維 EXP `{STR:0,...}` | modExp (訓練) |

---

## 🧠 技術核心約定

### 資料與型別
- **所有 vital（HP/stamina/food/mood）、屬性（STR/DEX/...）、EXP 強制整數**
  - `Stats.modVital` / `Stats.modAttr` / `Stats.modExp` 內部自動 `Math.round`
  - `Stats.eff(attr)` 回傳值也是整數
  - 任何繞過這些函式的直接寫入必須自己 round
  - **不要出現小數點**：倍率（mood/synergy/crowd）會在計算鏈中累積小數，但存入時一律 round
- **EXP 單一資源模型**（無 SP 系統）
  - 訓練動作用 `type: 'exp'`，不是 `'attr'`
  - 升屬性手動花 EXP（`Stats.spendExpOnAttr`）
  - 未來技能購買也花 EXP（`requireItemTag` + `expCosts`）
- **effects 陣列統一格式**：`{ type, key, delta, ... }`
  - 支援 type: vital / attr / exp / money / fame / affection / sp / flag / moral / ...
  - 透過 `Effects.apply(effects, ctx)` 統一派發
- **D.19 道德軸寫法**（有道德意涵的事件/選項都要接上）：
  - `{ type:'moral', axis:'reliability', side:'positive', weight:1 }`
  - 5 軸：reliability / mercy / loyalty / pride / patience
  - weight:1 一般 / weight:3 關鍵事件一次定型 / lock:true 極少用
  - 詳見 [docs/CONTENT-TEMPLATES.md](docs/CONTENT-TEMPLATES.md) 的快速查表
- **D.19 NPC 愛憎**：所有 NPC 都要有 `likedTraits` / `dislikedTraits`（強度 1~3）
  - 即使空 `{}` 也要明示，不能省略
  - 好感變動自動乘愛憎倍率（淨分 ±3 → ×1.5~×0.3）
  - 在 `teammates.modAffection` 內部統一處理

### 模組相依（2026-04-20 Phase 2 重組後）

**資料夾結構**（所有 JS 在 `src/` 下）：
```
src/
├── core/       config, flags, game_state, day_cycle, effect_dispatcher, stats, save_system
├── ui/         stage, choice_modal, dialogue_modal, help_modal, sound, i18n
├── systems/    moral, morning_thoughts, wounds, compulsion, reading, birth_traits, tutorial_hints
├── npc/        npc, background_gladiators, orlan_events, doctor_events, npc_reactions, npc_conflicts
├── content/    origins, fields, events, item, weapons, armors, enemy, books, skill
├── battle/     battle, testbattle
├── actions/    actions, train
├── quests/     mela_rat_quest
└── (root)      character_roll, ending, main
```

**載入順序**（見 game.html bottom，保持原順序，只改路徑）：
```
config → stage → choice_modal → dialogue_modal → flags → origins → i18n →
game_state → sound → day_cycle → effect_dispatcher → stats → moral →
morning_thoughts → fields → npc → background_gladiators → orlan_events →
doctor_events → npc_reactions → npc_conflicts → tutorial_hints → help_modal →
mela_rat_quest → events → item → weapons → armors → enemy → train → skill →
ending → save_system → wounds → compulsion → books → birth_traits → reading →
character_roll → testbattle → battle → actions → main
```
新增模組要注意放在依賴它的模組之前。新增 JS 檔案時：
- 選對子資料夾（core/ui/systems/npc/content/battle/actions/quests）
- 在 game.html 對應位置加 `<script src="src/XXX/yourfile.js">`
- 更新本區的載入順序（如果順序有影響）

### 場景架構
- **訓練場是唯一場景**（Phase 1-J 重構後）
- `#scene-view` = Stage 中央動畫層，後續可能 rename 為 `#stage`
- `Stage` 模組處理所有**轉場動畫**：閉眼/開眼/事件小過場/開場敘述
- 關鍵 API：
  - `Stage.playSleep({ sleepType, onBlack })` — 就寢動畫
  - `Stage.playEvent({ title, icon, lines, color })` — 通用事件小過場
  - `Stage.playOpening(lines, onBlack)` — 新遊戲開場敘述

### Flag / State 寫入
- 劇情旗標：`Flags.set('story_xxx', true)` / `Flags.has('story_xxx')`
- Session state：`GameState.setX() / getX()`
- 玩家資料：`Stats.player.xxx`（盡量走 `mod*` 函式）

---

## 🎭 設計哲學

### 敘事哲學
- **「不預告未來，只給方向感」**（D.12 故事揭露原則）
  - 卡片 flavor 只描述觀察，不解釋含意
  - 暗示比明示強，留給玩家腦補
- **特性 = 故事鑰匙**
  - 負面特性（神經質/失眠症）反而能觸發共鳴事件
  - 故事不是每個玩家都能看到，靠特性組合解鎖
- **道具 = 會旅行的故事觸發器**（D.14）
  - 獨特道具有 `storyTag`，其他 NPC 用 `requireItemTag` 檢查
  - 一個符牌串起五條故事線

### Phase 1 核心哲學：奴隸沒有主動權
- **不做**主動找 NPC 聊天、主動拜訪權威、主動離開訓練場
- **所有 NPC 互動改為事件觸發**：主人/長官傳喚、隊友邀請切磋、梅拉塞食物等
- 玩家只能選：訓練 / 休息 / 冥想 / 等事件發生

### UI 哲學
- **玩家應該從 NPC 對話去理解關係和事件**，不是從 UI 標籤
  - ❌ 「熟悉度 40/40 ✓」 — 遊戲感，破壞沉浸
  - ✅ NPC 跳出來說「嘿，我喜歡跟你訓練的感覺」— 自然理解
  - 數值/狀態改變可以用**顏色暗示**（名字變金色、邊框亮起），但**不解釋數字**
- **重要事件用 `addLog(..., true, true)` flash 提示**(第 4 參數)
- **重大演出用 `Stage.playEvent()`**,不只是 log
- **不加 hover-only 隱藏資訊**（手機不友善）
- **卡片色系依好感分層**（9 層：loyal → nemesis）
- **字體不小於 14px**（整個角色頁已調校過，不要再回到小字）
- **關係圖 storyReveals flavor 文字控制在 25~45 字**（理想），上限 55 字
  （超過會被 `line-clamp: 2` 截斷）→ 詳見 DESIGN.md D.12「📏 Flavor 文字長度約定」

### 教學哲學（D.28）：**零介面提示，全部由 NPC 對話帶出**
- ❌ **不做**：小精靈彈窗、「💡 提示」字樣、灰色 overlay 箭頭、Tutorial 模式標籤
- ✅ **要做**：用對應 NPC 在合理時機講出來，**1~3 句話帶過**，播完沒了
- **誰講就是誰的人設**：長官用長官的口氣、梅拉用母親口氣、老默用冷淡醫生口氣
  - 例：首次 EXP 到上限 → 監督官「那個數字夠了，去找葛拉升級。種下什麼就收什麼。」
  - 例：心情首次 <30 → 梅拉塞「孩子…撐不住時找個角落躲一下也不是罪。」
- **技術實作**：`tutorial_hints.js` 模組，HINT 條件滿足一次就 Flag 鎖住不再觸發
  - 觸發點：`doAction` 結束、`sleepEndDay` 結束各跑一次 `TutorialHints.tryShow(p)`
- **禁區**：不要在 hint 裡寫「點擊右上角詳細按鈕」這種介面指令，要用世界內語言
  （「去找葛拉」比「打開裝備欄」更符合世界觀）
- **Fallback**：未來在設定區加「？操作說明」純選單型查詢頁，純被動，不跳出

---

## 🚫 「不要做」清單

1. **不要自動做主動 NPC 互動**（違反 Phase 1 哲學）
2. **不要在訓練動作裡用 `type: 'attr'`**（改用 `type: 'exp'`）
3. **不要加 hover-only 的隱藏資訊**（手機不友善）
4. **不要創新 UI 元件**，先查上方「🏗️ 已實作系統登記」是否已有可用的
5. **不要跳過整合檢查清單**（D.15 的 9 題）
6. **不要讀全 DESIGN.md**（6000+ 行會塞爆 context，用 grep 精準查）
7. **不要用 `--no-verify` 跳過 commit hook**
8. **不要自動 `git push`**（除非使用者明確說要推）
9. **不要加 emoji 到代碼**（除非使用者明確要求或是既有 convention）
10. **不要建立 documentation 檔案**（除非使用者要求；DESIGN.md / CLAUDE.md / changelog.html 例外）
11. **不要寫沒反饋的選擇事件**（2026-04-23 鐵律）——有 choices 的事件**每個選項都要**有 NPC 回應對白 + 視覺特效（震動/閃光/音效其一），不能選完只 log 一行就結束。詳見 [docs/CONTENT-TEMPLATES.md](docs/CONTENT-TEMPLATES.md) 第 8 條「選擇事件反饋鐵律」。
12. **不要在 main.js 外直接呼叫 bare `addLog(...)`**（2026-04-24 鐵律）——`addLog` 定義在 `const Game = (() => {...})()` 閉包裡，**不是全域函式**。外部模組（`src/npc/*.js`、`src/systems/*.js` 等）直接寫 `addLog(...)` 會丟 `ReferenceError`，通常被上游 try/catch 吞掉 → 前端看就是「某動作按下去沒反應」。**正確寫法**：走 `Game.addLog(text, color, italic, flash)`，或守衛 `if (typeof addLog === 'function') addLog(...)`。這曾讓老默治療流程壞掉 3 次才找到根因。

---

## 🤖 AI 的主動提醒職責

### 應該主動提出的情況

當發現以下任一情況，**主動建議使用者記進 CLAUDE.md 或 DESIGN.md**：

1. **新的技術決策**（例如「以後 vital 都要整數」「所有訓練用 exp type」）
2. **新的設計模式**（例如「特性當故事鑰匙」「道具當故事錨點」）
3. **被使用者糾正過 2 次以上的同一件事**（代表這是長期偏好）
4. **新的 UI 約定**（例如字體大小、色系分層、動畫節奏）
5. **新的「不要做」規則**（例如「不要用 hover」）
6. **跨系統整合發現**（新的整合點應該加進 D.15 清單）
7. **新增命名 NPC 時，主動提醒使用者「favoredAttr 還沒定嗎？」**
   （D.18：命名 NPC 需要 `favoredAttr` 決定訓練協力屬性偏好；故事向 NPC 可先填 null，但要明示）
8. **新增命名 NPC 時，同時主動提醒「likedTraits / dislikedTraits 要怎麼設？」**
   （D.19：每個 NPC 都必須有愛憎欄位，即使空 `{}` 也要明示；這是角色設計的靈魂
   — 沒有愛憎的 NPC 等於沒有個性觀點。參考 `officer` 的寫法。）

### 應該問使用者的情況

1. 實作牽涉修改既有風格 → 先問「這個改動要不要沿用到其他地方」
2. 加新的全域命名 → 先問「這個 ID/class 名稱你有偏好嗎」
3. 發現 DESIGN.md 有矛盾 → 先問「哪一個是對的」

---

## 🔧 Commit 與同步

- 使用者跨電腦開發 → 頻繁 git commit + push
- 提示使用者 commit 時機：
  - 完成一個完整功能
  - 通過驗收測試後
  - 跨 session / 跨電腦切換前
- commit message 用繁體中文 + 語意化前綴（`feat(Phase1-X):` / `fix(...)`/ `docs(...)`）

---

## 📝 文件更新規則

- **CLAUDE.md**（本檔）：長期穩定的約定與習慣。更新頻率低，穩定度高。
- **⭐ docs/CODEX.md**：**完整字典** — 所有精緻做的東西（特性/書/origin/傷勢/見識/病痛/強迫症/旗標/數字速查）。
  - 🚨 **強制規則（2026-04-19 定）**：**新增任何系統 / 特性 / 書 / origin / flag / 數字公式，必須同步更新 CODEX.md**。
  - 這是單一事實源（Single Source of Truth）— 玩家、AI、開發者查東西都看這份。
  - AI 主動規則：寫新 `xxx.js` 模組或改動 `config.js TRAIT_DEFS` / `books.js` / `origins.js` / `wounds.js` 等資料時，
    **commit 前自動更新 CODEX.md 對應章節**，不用等使用者說。
  - 同步順序：程式碼 → 對應 `docs/systems/{name}.md` → CODEX.md 字典 → CLAUDE.md 術語
- **⭐ docs/CANON.md**：**故事事實單一事實源** — 時間線、年齡、誰知道什麼、關係歷史。
  - 🚨 **強制規則（2026-04-19 定）**：**寫新對白 / 新事件 / 新 storyReveal 前必查 CANON**。
  - 發現未決事實（某角色幾歲？認識幾年？）→ **問使用者，不得 extrapolate**
  - 這是避免「每次都要補丁拯救」的核心工具 — 新事實寫完立刻同步 CANON。
  - CANON 衝突處理：CANON 是源頭，程式碼與其他 md 向 CANON 對齊。
- **DESIGN.md**：設計規格與決策。更新頻率中。
- **changelog.html**：每次功能/修正的歷史紀錄。**每次中型以上改動都要自動補上**
  （新系統 / 新模組 / 新事件 / UI 重構 / 平衡調整等）。
  - 格式參考最近的版本區塊（`.version-block` → tag / title / date / change-list）
  - 徽章：`badge-new` / `badge-fix` / `badge-ui` / `badge-data` / `badge-system`
  - AI 主動規則：commit 前如果發現有**新模組、新系統、新事件池、或跨多檔案的平衡調整**，
    不用等使用者說，自己開新 version-block 補上去。只有純注釋 / 文字微調可以省略。
- **memory/MEMORY.md**：auto-memory 索引。不手動編輯。
- **HISTORY.md**：開發歷史歸檔（過去重大功能 / 設計決策）。
- **⭐ 更改對話專用.md**：使用者改對白的入口、所有事件 → .js 連結速查表。
  - 🚨 **強制規則（2026-05-09 定）**：**新增事件、新對白、新 NPC 出場時、必須在「更改對話專用.md」對應區塊加一行連結**（事件名 + 函式名 + .js 檔路徑）。
  - 不然使用者改對白時找不到、就破壞了這份檔案的用途。
  - 跟 changelog 同步：commit 前順手檢查、有新事件就補。

---

## 🔄 歷史紀錄

舊的「最近重要變更」搬到 [HISTORY.md](HISTORY.md) 了。
本檔只保留**接手頭條**（當下狀態）+ 規則 / 約定。
