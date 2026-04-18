# 夜間事件窗口（Night Events，20:00-22:00）

> 把原本空轉的休息時段，轉成「奴隸才做得出來的黑夜選擇」。
> 最後更新：2026-04-18

---

## 背景

### 原本的 Slot 7

```
SLOT_TYPES[7] = 'rest'
```

時段：20:00-22:00（一天最後一個非睡眠時段）
原行為：`_resolveNonTrainingSlots()` 自動觸發一句 log「你靠在牆邊喘口氣」+ 10 體力 + 3 心情。

**問題**：玩家對這段時間沒有 agency，純粹是時間被吞掉。

---

## 新設計

### 一句話

**20:00-22:00 變成「黑夜事件窗口」——白天接任務，晚上執行。**

### 流程

1. 白天某個時段 → NPC 事件或玩家某個狀態觸發「提議」
2. **提議對話** 用 ChoiceModal 給玩家選：**接** / **不接**
3. 接了 → 設 flag `night_pending_<questId>`
4. Slot 7 到了 → 檢查所有 `night_pending_*` flag，播對應任務
5. 沒任何 pending → 走原本的 rest 流程

同一晚如果同時有多個 pending，依優先度播一個，其他順延或取消。

### 程式碼進入點

`_resolveNonTrainingSlots()` 裡，slot 7 判定改為：
```js
} else if (type === 'rest') {
  if (NightEvents.hasPending()) {
    NightEvents.playTonight();    // 替代 rest 流程
  } else {
    // 原本的靠牆恢復 + log
  }
}
```

---

## 事件池（規劃中）

| 事件 ID | 提議者 / 觸發 | 關鍵屬性 | 風險 |
|---|---|---|---|
| `mela_rat` | 梅拉（好感 25+，見你練過 3 種訓練） | WIL / AGI / DEX | 失敗只損小面子 |
| `orlan_night_talk` | 奧蘭（好感 40+，隨機） | 無（純故事）| 無 |
| `mo_sleepless` | 老默（你有失眠 ailment） | 無（純故事） | 無 |
| `steal_kitchen` | 飢餓 + hungry_critical | STR / AGI | 被抓會挨鞭 |
| `sneak_listen` | Day 15+，高 WIL | AGI / WIL | 被抓會扣主人好感 |
| `escape_attempt` | Day 40+，多條件解鎖 | STR / AGI / WIL | 極高風險 |

（以上規劃，逐步實作）

---

## 任務的共同設計模式

所有夜間任務都用**多階段判定**：

```
提議 (ChoiceModal)
   ↓ 接
[夜間] 任務開場 DialogueModal
   ↓
判定 1（WIL / AGI / DEX / STR 其中一項）
   ├── 失敗 → 失敗對白（告訴玩家哪條不夠）+ 微小慰問獎 → 結束
   └── 過 → 進入下一段
   ↓
判定 2
   ├── 失敗 → 失敗對白 + 中等慰問獎
   └── 過 → 進入下一段
   ↓
判定 3
   ├── 失敗 → 失敗對白 + 部分獎勵
   └── 過 → 完整獎勵 + 後續決策選項（放生/收養/回報等）
```

每階段之間有**特性對白變化**（prideful、cruel、kindness、neurotic 等至少 4 種）。

詳細規範見 `docs/systems/multi-check-quest.md`。

---

## 如何加入新的夜間任務

1. 寫 `docs/quests/<quest-id>.md` 設計書（屬性門檻 + 對白全文 + 獎勵）
2. 建 `quests/<quest-id>_quest.js` 模組
3. 在 NightEvents 事件池註冊
4. 白天對應 NPC 加觸發條件
5. 測試

---

## 哲學要點

- **晚上時間不是被動的**，是奴隸唯一能選「要不要冒險」的時段
- **接任務 ≠ 保證成功**，失敗要有戲
- **屬性門檻不外顯**（見 `docs/philosophy/numbers-hiding.md`）
- **失敗對白要告訴玩家「哪裡不夠」**，但用語言而非數字
- **同一事件不同性格有不同對白** → 玩家每次重玩看到不同

---

## 與 DayCycle 的關係

- 白天觸發（DayCycle.onDayStart 或動作完成）設 `night_pending_*` flag
- Slot 7 到了由 `_resolveNonTrainingSlots` 檢查 pending 並執行
- 任務結束後 flag 清除（下一輪要重新接）
- 一晚只跑一個任務（即使多個 pending，第二優先順延到明晚）
