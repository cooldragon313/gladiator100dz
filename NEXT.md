# 📌 NEXT — 下次開工備忘

> 跨電腦/跨 session 的「下一步該幹嘛」。
> 新的一天開工先讀這份。
> **最後更新：2026-05-06（晚）** — 世界大綱拍板 11 點 + CANON 升格 + 待動工：errand-outings 完整版 C

---

## ✅ 2026-05-06 做完了

**世界大綱 + CANON 升格**（5 commit、純文檔）：

1. ✅ 寫 `docs/discussions/2026-05-06-world-overview.md` — 整個世界 10 章大綱
2. ✅ user 拍板 11 點（帝國 / 競技場 / 阿圖斯 / 原領主 / 倖存者 / 老默 / 祭神 / 任務命名表 / Lucius 撞名）
3. ✅ Lucius 撞名解決：維努斯場 → **凱里烏斯（Caelius）**、拳法老師保留 Lucius
4. ✅ CANON.md 大升格：加「帝國概覽」+「30 年前政變 + 提圖斯雙殺」+「阿圖斯純商人」章節
5. ✅ masterArtus.md 補政治立場段
6. ✅ titus.md 補家族世代政治史 + 倖存者盲點

**重要 CANON 新事實**（寫對白前必看）：
- 帝國個性 = 外表富裕、實質腐爛
- 競技場 = 發洩 + 社交 + **社會刑罰**（戰犯 / 罪犯處決機制）
- **奴隸來源 4 類**：戰俘 / 罪犯 / 債務奴 / 主人內部處置
- 玩家是**冤獄式假戰俘**（被自己國家偽旗誤抓賣到本城）
- 競技場大會場合**祭戰神**（開場儀式 / 唸頌詞 / 酒灑沙地）
- Livia 信奉的女神 = 跟戰神對位的「慈悲 / 守護女神」
- **30 年前政變**：提圖斯家族滅德拉格家
- **前任領主 = 德拉格家最後血脈**、剛幾個月前**病死**（**有陰謀** 疑似中毒）
- **倖存者**：前任有一個家人剛好偷溜出去沒回來、沒人知道他活著（Phase 2 設計）
- **「德拉格血脈」身份只有提圖斯知道** — 老默知道德拉格家但不知道前任就是
- 阿圖斯 = **純冷血商人、不參與政治派系**

---

## ▶️ 下次開工：errand-outings 完整版 C（4-8 小時）

> ⚠️ user 已選 **C 完整版** + **Q2 維努斯場小孩 boss 戰綁進**。
> spec 已寫完、所有 CANON 已鎖定、可以**直接開工不用再問**。

### 工作範圍（按工時拆解）

| ID | 任務 | 預估 | 依賴 |
|---|---|---|---|
| **E-1** | 跑腿事件框架 + 4 源頭差異化（葛拉採購 / 梅拉買菜 / 侍從送信 / 巴爺修器）| 2h | — |
| **E-2** | 撞小孩 3 路徑（merciful / cruel / neutral）+ NPC 反應對白 | 2h | E-1 |
| **E-3** | 護衛分支 ChoiceModal（道歉 / 幹架 / 逃）+ 50% 觸發 | 1h | E-2 |
| **E-4** | 護衛幹架 mini-battle（簡化版戰鬥）| 1.5h | E-3 |
| **E-5** | 鳶尾紋飾發現 → 加入 `personalItems` + storyTag `dragow_iris` | 0.5h | E-2 |
| **E-6** | 3 NPC 認出對白（老默戰場線 / 梅拉舊識線 / 巴爺老兵伏筆）| 1.5h | E-5 |
| **E-7** | 維努斯場小孩 boss 戰（Q2 綁進來）| 2h | E-3, E-4 |
| **E-8** | 同行者陪同防逃機制（不武裝、社會壓力）| 1h | E-1 |

**總工時**：~11.5h（比 spec 估的 24h 少、因為 CANON 已全鎖、不用設計階段）

### 設計參考
- 主 spec：[docs/quests/errand-outings.md](docs/quests/errand-outings.md)
- CANON 鎖定：[docs/CANON.md](docs/CANON.md) § 30 年前政變 + § 帝國概覽
- 撞名：拳法老師 = **Lucius**（保留）/ 維努斯場帥哥 = **Caelius 凱里烏斯**（已改）

### 對白核心鐵則（3 NPC 認出鳶尾紋飾）

**老默** —「⋯⋯我在北境治過一個鳶尾紋的隊、那批人後來全沒了。」（戰場見過、不知前任就是德拉格）

**梅拉** —「這紋飾⋯⋯主人家庫房裡見過。但很多年前的事了。」（暗示阿圖斯庫房有、純商品轉手）

**巴爺** —「⋯⋯老兵的東西。30 年前的事。」（隱約感覺到、但不敢深想）

### 程式入口
- 新檔：`src/quests/errand_outings.js`
- 接 `src/main.js` 跑腿事件 trigger（既有事件系統有空檔可加）
- 物品：`src/content/item.js` 加 `dragow_iris`（鳶尾紋飾）+ storyTag

---

## 🚦 待 user Phase 2 拍板（不擋當前）

寫對白若需要時再問：

1. **倖存者** — 性別 / 年齡 / 姓名 / 現在在哪 / 怎麼出場？
2. **前任領主有家人嗎**（除了倖存者）— 老婆？其他子女？
3. **Livia 信仰女神具體名稱**？對位戰神的「慈悲女神」？
4. **戰神具體名稱**？（暫用「戰神」泛稱）
5. **帝國國名**？(羅馬式 / 純架空)
6. **黑市地下競技場**做不做？（赫克托 / 比拉斯 / 義肢可能在這）

---

## ⚠️ 已知坑 / 注意事項

- **bare addLog 已全清** — 新寫 `src/**/*.js` 模組時仍要沿用 `_log` helper 模式（CLAUDE.md 第 12 條）
- **選擇事件必須有 NPC 回應 + 視覺特效**（CLAUDE.md 第 11 條）
- **新 NPC 必填 `favoredAttr` + `likedTraits` / `dislikedTraits`**（D.18 / D.19）
- 跨系統整合清單 9 題（CLAUDE.md）— 提新事件 / 動作 / NPC / 物品 / 特性前跑一遍
- **CANON.md 鐵則**：寫新對白前必查、Day 1 奧蘭刻意只說「磨坊裡來的」

---

## 📎 重要連結

- 設計書頂部進度總表 / TODO：[DESIGN.md](DESIGN.md)
- **🆕 世界大綱 v1**：[docs/discussions/2026-05-06-world-overview.md](docs/discussions/2026-05-06-world-overview.md)
- 跑腿外出 spec：[docs/quests/errand-outings.md](docs/quests/errand-outings.md)
- 實作 roadmap：[docs/IMPLEMENTATION-ROADMAP.md](docs/IMPLEMENTATION-ROADMAP.md)
- Codex（特性 / 書 / origin 字典）：[docs/CODEX.md](docs/CODEX.md)
- Canon（故事事實）：[docs/CANON.md](docs/CANON.md)
- 對白位置索引：[docs/DIALOGUE-MAP.md](docs/DIALOGUE-MAP.md)
- titus 角色檔（雙殺路徑）：[docs/characters/titus.md](docs/characters/titus.md)
- masterArtus 角色檔（純商人）：[docs/characters/masterArtus.md](docs/characters/masterArtus.md)
