# 📌 NEXT — 下次開工備忘

> 跨電腦/跨 session 的「下一步該幹嘛」。
> 新的一天開工先讀這份，做完了就更新。
> 最後更新：2026-04-24（晚上收工 — 跨電腦切換前更新）

---

## 🎯 今天做完（2026-04-24，全部 commit 了但**還沒實機測過**）

**1. bare addLog 大清（commit 7659688）**
- CLAUDE.md 第 12 條鐵律全專案落實
- 修了 11 個檔案 / 58 處：orlan_events / stats / compulsion / reading / wounds / books / effect_dispatcher / character_roll / blacksmith_events / npc_conflicts / mela_rat_quest
- 每個外部模組頂部加統一 `_log` helper
- **副作用（正面）**：以前靜默掉的提示文字從此會真的顯示（訓練強迫症警告、傷勢痊癒、見識 +N、效果總結⋯⋯）

**2. Day 1 開場大翻修（commit c8804b5）**
- 原本奧蘭突然冒出來「你好我叫奧蘭以後請多指教」—— 玩家莫名其妙
- 現在建立完整「CANON 同批三新人」背景：
  - 牢房場景點出「同房還有兩個人」（捲髮奧蘭 + 角落大個子索爾）
  - 獄卒踢門改「三個臭貨」+ 起身側寫
  - 奧蘭靠過來改「昨晚跟你同一間牢房的那個」— recognize 銜接
- 奧蘭自介重寫：先擔心你 / 摸手腕（妹妹印記）/ 壓低聲音 / CANON 鐵則只說「磨坊裡來的」
- 🆕 索爾 Day 1 視覺印象（三選項後）：瘸腿 + 空洞眼神 + 胸前木牌（Day 5 遺物伏筆）
- Flag: `met_sol_day1`

**3. 赫克特死碼 flag 清掉（commit 1a997b0）**
- 刪掉 `hector_fake_friendly_day1`（audit 已確認後續無引用）
- 註解「假善意」→「自來熟試探」符合 Phase 1 設計

---

## ▶️ 換電腦後的**第一要務**：實機測 Day 1 整條

> ⚠️ 這個 session 改了一大堆東西**一次都沒開過瀏覽器跑**。
> 下次開工先把這輪跑完，確認沒踩到雷。

測試清單（按 Day 1 執行順序）：

1. **開新遊戲 → 牢房醒來** — 有沒有提到「同房還有兩個人」
2. **獄卒踢門** — 「三個臭貨」台詞 + 看另外兩人起身側寫
3. **走廊 → 血狼伍爾克 → 赫克特靠過來**
4. **🔴 赫克特 ChoiceModal** — 彈兩選項（笑臉 / 臭臉）← **Phase 1 第一要務**
5. **達吉** — 依特性分岔（kindness / cruel / baseline）
6. **奧蘭初遇新版** — 看感情到位沒（你沒事吧 / 摸手腕 / 磨坊裡來的 / 只有我一個新的）
7. **奧蘭三選項** — 握手 / 點頭 / 拒絕
8. **🆕 索爾視覺印象** — 瘸腿 + 胸前木牌 + 奧蘭 narrator（除非剛拒絕奧蘭）
9. **Day 2+ 訓練** — 測赫克特笑臉示好池 / 臭臉騷擾池
10. **老默治療** — F12 console 看 `[DoctorEvents] _performWoundHeal`

**重點觀察**：
- 節奏會不會太拖（今天加了不少對白 — 牢房/獄卒兩段都變長了）
- 奧蘭的感情到位了沒，索爾的視覺印象夠不夠
- **Console 任何 ReferenceError** — 今天 bare addLog 大清過，不該再有
- 以前靜默的 log 現在會出現，畫面會不會太吵

---

## 🧩 Phase 2 等開工（Hector 設計書 § 11）

Day 1 測完沒事再排這些，順序：

5. **仇恨撞擊**（臭臉路線，aff ≤ -30 + 8%/天）
6. **介入保護他人**（玩家看到赫克托欺負達吉/奧蘭時）
7. **好感暗示 + 賣情報**（笑臉路線、莫拉斯對打前）
8. **敵人 weakness 欄位 + 戰鬥端加乘**（真情報觸發 +25% PEN 等）

Phase 3（高階）：
9. 嫁禍事件改版 + **私戰 mini-battle**（8 回合限制）
10. **黑市三功能**（斷肢義肢 / 興奮劑 / 欲練神功必先自宮）
11. Day 40 倒地加 NPC 反應

Phase 4（清理）：
12. 故事揭露門檻調整（§ 8 表）

---

## ⚠️ 已知坑 / 注意事項

- **bare addLog 已全清** — 新寫 `src/**/*.js` 模組時仍要沿用 `_log` helper 模式
- **選擇事件必須有 NPC 回應 + 視覺特效**（CLAUDE.md 第 11 條）
- **新 NPC 必填 `favoredAttr` + `likedTraits` / `dislikedTraits`**（D.18 / D.19）
- 跨系統整合清單 9 題（CLAUDE.md）— 提新事件/動作/NPC/物品/特性前跑一遍
- **CANON.md 鐵則**：寫新對白前必查，Day 1 奧蘭刻意只說「磨坊裡來的」不提主人家 6 年

---

## 📎 重要連結

- 設計書頂部進度總表 / TODO：[DESIGN.md](DESIGN.md)
- Hector 設計書：[docs/discussions/2026-04-23-hector-redesign.md](docs/discussions/2026-04-23-hector-redesign.md)
- Codex（特性/書/origin 字典）：[docs/CODEX.md](docs/CODEX.md)
- Canon（故事事實）：[docs/CANON.md](docs/CANON.md)
- 對白位置索引：[docs/DIALOGUE-MAP.md](docs/DIALOGUE-MAP.md)
- Orlan 人物檔：[docs/characters/orlan.md](docs/characters/orlan.md)
- Sol 人物檔：[docs/characters/sol.md](docs/characters/sol.md)
