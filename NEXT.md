# 📌 NEXT — 下次開工備忘

> 跨電腦/跨 session 的「下一步該幹嘛」。
> 新的一天開工先讀這份，做完了就更新。
> 最後更新：2026-04-24

---

## 🎯 最近做完（別重做）

**2026-04-23 赫克托 Phase 1**
- [src/npc/hector_events.js](src/npc/hector_events.js) 新模組（笑臉/臭臉雙路線）
- Day 1 走廊 ChoiceModal 分岔（[src/main.js](src/main.js) `_playDay1WakeUp` 尾段）
- 笑臉示好池 8+1 條 / 臭臉騷擾池 6 條（帶震動 + 主角心想）
- main.js 舊 hectorDay8/15/25 + 舊騷擾全刪

**2026-04-24 老默治療徹底修好**
- 根因：bare `addLog` 在 IIFE 外部是 ReferenceError
- 修法：[src/npc/doctor_events.js](src/npc/doctor_events.js) 全部改用 `_log` 助手
- CLAUDE.md 第 12 條鐵律記下「外部模組禁用 bare addLog」

**設計書**
- [docs/discussions/2026-04-23-hector-redesign.md](docs/discussions/2026-04-23-hector-redesign.md) 已確認（§ 10 八題全過）

---

## ▶️ 明天優先要做的事

**第一要務：實機測 Phase 1（還沒跑過）**
1. 開新遊戲 → Day 1 走廊赫克特自介後應該看到 **ChoiceModal** 彈出兩選項
2. 選「笑臉」→ Day 2-12 訓練後應該偶爾跳示好對話（帶教學暗示）
3. 選「臭臉」→ Day 2-5 騷擾比較密、踩腳事件會彈反抗 ChoiceModal
4. **順便試老默治療**（付錢扣款 + 傷勢降級 + 對白播完）
   - F12 console 應該看到 `[DoctorEvents] _performWoundHeal called for part: xxx`

---

## 🧩 Phase 2 等開工（Hector 設計書 § 11）

按順序：
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

- **bare addLog 絕對禁用**（見 CLAUDE.md 第 12 條）。新寫 `src/npc/*.js` 或 `src/systems/*.js` 時，開頭放 `_log` 助手
- **選擇事件必須有 NPC 回應 + 視覺特效**（CLAUDE.md 第 11 條）
- **新 NPC 必填 `favoredAttr` + `likedTraits` / `dislikedTraits`**（D.18 / D.19）
- 跨系統整合清單 9 題（CLAUDE.md）— 提新事件/動作/NPC/物品/特性前跑一遍

---

## 📎 重要連結

- 設計書頂部進度總表 / TODO：[DESIGN.md](DESIGN.md)
- Hector 設計書：[docs/discussions/2026-04-23-hector-redesign.md](docs/discussions/2026-04-23-hector-redesign.md)
- Codex（特性/書/origin 字典）：[docs/CODEX.md](docs/CODEX.md)
- Canon（故事事實）：[docs/CANON.md](docs/CANON.md)
- 對白位置索引：[docs/DIALOGUE-MAP.md](docs/DIALOGUE-MAP.md)
