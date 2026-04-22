# 戰鬥系統總覽

> 戰鬥公式、武器/護甲資料、四流派系統的單一事實源。
> 初稿：2026-04-21（現況整理）
> **大改版：2026-04-22**（四流派 + 每武器獨立 cap + 新爆擊公式 + 盾 EVA=0）
> 實作對應：`src/battle/testbattle.js`（核心引擎）+ `src/battle/battle.js`（遊戲整合層）
> 關聯：`src/content/weapons.js` + `src/content/armors.js`（背包/商店資料）

## 🎯 速查最終決議（2026-04-22）

**戰鬥流程**：命中 → 傷害（PEN 破 DEF）→ 爆擊（CRT 破 BLK）→ 格擋

**四流派**（裝備時自動套加成 + NPC 教導後強化）：
- 單手 / 雙持（需 DEX 15）/ 單盾（EVA=0）/ 雙手

**新公式**：
- 爆擊：`net × (1 + CDMG/100)`（2.6x~3.4x）
- CRT cap 95%、EVA 有盾歸零
- SPD 保底 `max(12, SPD)`
- 每武器獨立 cap（匕首 10 / 長槌 3）

**採納**：武器耐久度、武器獨門招式（split_shield / riposte / bleed）
**砍**：armorHP 雙血條、匕首 Puncture、快重攻二擇

詳細決議見 [§ 12](#§-12-最終決議速查2026-04-22)。

---

## § 1 系統分層

```
┌───────────────────────────────────────┐
│ src/battle/battle.js                  │
│ - ATB 迴圈 (50ms tick)                 │
│ - UI 渲染 + 動畫                       │
│ - 評分 S/A/B/C + 名聲獎勵              │
│ - 受傷勢派發（呼叫 Wounds）            │
│ - 結束流程 / 死亡判定                  │
└──────────────┬────────────────────────┘
               │ 呼叫
               ▼
┌───────────────────────────────────────┐
│ src/battle/testbattle.js              │
│ - TB_WEAPONS / TB_ARMORS / TB_SHIELDS │
│ - TB_AMULETS / TB_TRAITS              │
│ - TB_ENEMIES (Boss 資料)              │
│ - TB_calcDerived() 派生屬性計算        │
│ - TB_attack() 傷害結算                │
│ - 三路線儀表 rage/focus/fury           │
└───────────────────────────────────────┘
```

**雙武器表並行**（待統一）：
- `TB_WEAPONS`（testbattle.js）：戰鬥引擎用，含 `route` / `swingTime` / `special`
- `Weapons`（weapons.js）：背包/商店顯示用，含 `desc` / `price`

兩者 `eqBonus` 數值必須同步。

---

## § 2 派生屬性公式（TB_calcDerived）

### 2.1 六維 → 派生

| 派生屬性 | 公式 | 上限 |
|---|---|---|
| **ATK** 攻擊 | `1.5×STR + 0.5×DEX + weapon.ATK + amulet.ATK` | - |
| **DEF** 防禦 | `1.5×CON + 0.5×STR + armor.DEF + shield.DEF` | - |
| **ACC** 命中 | `60 + 0.5×DEX + 0.25×LUK + weapon.ACC + amulet.ACC` | 92（單手流派進階後 → 98）|
| **CRT** 暴擊率 | `0.25×DEX + 0.5×LUK + weapon.CRT + amulet.CRT` | **95** |
| **CDMG** 暴擊倍率 | `150 + 0.5×DEX + 0.3×LUK + 0.5×WIL + weapon.CDMG + amulet.CDMG` | 300 |
| **PEN** 穿透 | `0.5×DEX + 0.5×STR + weapon.PEN + amulet.PEN` | 75 |
| **BLK** 格擋觸發率 | `0.5×CON + shield.BLK + amulet.BLK` | 75 |
| **BpWr** 格擋減傷率 | `0.5×STR + shield.BLK × 1.5 + amulet.BpWr` | 85 |
| **EVA** 閃避 | `2×AGI + 0.5×LUK + armor.EVA + amulet.EVA`（有盾 → **EVA = 0**）| 95 |
| **SPD** 攻速 | `0.75×AGI + 0.25×DEX + weapon.SPD + armor.SPD + amulet.SPD` | - |
| **HP** | `hpBase + 2×CON + amulet.hpMax` | - |

### 2.2 四流派加成（2026-04-22 新增）

裝備組合 → 自動判定流派 → 套用加成。**預設**（戴上武器就有）+ **學習進階**（NPC 教導後強化）。

| 流派 | 判定條件 | 預設加成 | 學習進階加成 |
|---|---|---|---|
| **單手** | 單手武器、無副手 | ACC +5、SPD +1、EVA +2 | ACC +10、SPD +2、EVA +4、**ACC cap → 98** |
| **雙持** | 主手 + 副手（兩把武器）| 副手 ACC ×0.65、副手 ATK ×0.5、SPD -5、EVA -3 | 副手 ACC ×0.75、副手 ATK ×0.6、SPD -4、EVA -2 |
| **單盾** | 單手武器 + 盾 | **EVA = 0**、SPD -4、BLK 啟用 | SPD -3、BLK +5、BpWr +5 |
| **雙手** | 雙手武器 | ACC -5、SPD -3、CRT +5 | ACC -3、SPD -2、CRT +8、CDMG +10 |

**學習進階取得**：
- 需要對應屬性門檻（單手/雙持 DEX ≥ 15；單盾 CON ≥ 15；雙手 STR ≥ 18；雙持加測 AGI ≥ 15）
- 透過 NPC 教導事件解鎖（塔倫長官、師父、訓練所長老等）
- 每個訓練所可能教 1-2 流派，跨所可學其他
- 學會後寫入 `player.learnedStyles`，永久保留

**雙持 DEX 門檻（15+）**：未達標者**裝不上副手**（背包顯示「需要靈巧 15」）。

**UI 顯示**：
- 人物介面武器欄旁顯示小框「單持 / 雙持 / 單持+盾 / 雙手」（不同色系）
- Hover tooltip → 完整加成數值列表

### 2.3 路線判定

`route` 決定儀表系統類型：
- 有盾 → **fury**（盾牆流）
- 雙持 → **rage**（狂暴流）
- 其他 → 武器原始 `route`

### 2.4 WIL 儀表加成

每 10 點 WIL → 正向儀表增益 **+3%**，上限 +30%。
懲罰性扣減不受影響。

### 2.5 SPD 攻速

每點 SPD → 揮速 +0.5%，上限 +30%。

---

## § 3 武器資料表（TB_WEAPONS）— 2026-04-22 修訂

| 武器 | type | route | hands | ATK | ACC | CRT | CDMG | SPD | PEN | swingTime | **cap** | hitParts | special |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 空手 fists | unarmed | rage | 1 | 4 | 5 | 3 | 8 | 5 | 0 | 1 | 15 | 身體 | none |
| 匕首 dagger | blade1h | focus | 1 | 4 | 8 | 12 | 20 | 12 | 2 | 2 | **10** | 頸部/身體 | none |
| 短劍 shortSword | blade1h | fury | 1 | 8 | 5 | 4 | 8 | 2 | 4 | 3 | **8** | 身體 | none |
| 槌 hammer | blunt1h | rage | 1 | 12 | 2 | -2 | 0 | -3 | 10 | 5 | **6** | 頭/手 | none |
| 長槍 spear | polearm | focus | 2 | **8** | **8** | **5** | 5 | 6 | **15** | 4 | **7** | 身體/腳 | **first_strike** |
| 長劍 longSword | blade2h | fury | 2 | 16 | 3 | 4 | 10 | -3 | **10** | 5 | **6** | 身體/頭 | none |
| 長槌 warHammer | blunt2h | rage | 2 | 18 | 0 | 0 | 0 | -8 | **18** | 10 | **3** | 頭/身體 | **concuss** |
| 重斧 heavyAxe | heavy2h | rage | 2 | 20 | -5 | 2 | 15 | -10 | **14** | 9 | **4** | 身體/手 | none |

**2026-04-22 修訂重點**：
- 長槍：ATK 10→8、ACC 6→8、CRT 2→5、PEN 12→**15**（趙子龍風格：低攻高命中高穿甲）
- 長劍 PEN 5→**10**（雙手破甲）
- 重斧 PEN 8→**14**（雙手破甲）
- 長槌 PEN 15→**18**、swingTime 8→**10**（最重武器）
- 加 **cap** 欄位：每武器獨立的 fillRate 上限（物理極限）

**現有 special 效果**：
- `first_strike`（長槍）：先制攻擊，瞬刺（delay=1 個 ATB 週期，期間被打即中斷）
- `concuss`（長槌）：震盪 / 擊昏（待實作）
- `armorPierce40`（某些 Boss 被動）：穿透 +40%

---

## § 4 護甲資料表 — 2026-04-22 三類 × 5 tier 定案

### 總覽

三類型對應三種戰鬥風格：

| 類型 | 定位 | type 欄位 |
|---|---|---|
| **布** cloth | 閃避流（低 DEF 高 EVA/SPD）| `cloth` |
| **皮** leather | 平衡流（中 DEF 無懲罰）| `leather` |
| **板** plate | 肉盾流（高 DEF 大懲罰）| `plate` |

### 完整數值表

| Tier | 布 cloth | 皮 leather | 板 plate |
|---|---|---|---|
| **T1** | DEF 0 / SPD 0 / EVA 0 | DEF 3 / SPD 0 / EVA 0 | DEF 8 / SPD -3 / EVA -2 |
| **T2** | DEF 1 / SPD +1 / EVA +1 | DEF 5 / SPD 0 / EVA 0 | DEF 12 / SPD -5 / EVA -3 |
| **T3** | DEF 2 / SPD +2 / EVA +2 | DEF 8 / SPD -1 / EVA 0 | DEF 16 / SPD -7 / EVA -5 |
| **T4** | DEF 4 / SPD +3 / EVA +4 | DEF 11 / SPD -1 / EVA +1 | DEF 20 / SPD -10 / EVA -8 |
| **T5** | DEF 6 / SPD +4 / EVA +6 | DEF 15 / SPD -2 / EVA +2 | DEF 25 / SPD -13 / EVA -12 / AGI -2 |

### 品項命名

| Tier | 布 | 皮 | 板 |
|---|---|---|---|
| T1 | 破衣 rags | 皮甲 leather | 鐵片甲 ironScale |
| T2 | 粗布衫 roughCloth | 加厚皮甲 reinforcedLeather | 鎖鏈甲 chainmail |
| T3 | 結實麻衣 linenGarb | 鉚釘皮甲 studdedLeather | 鍛鐵板甲 forgedPlate |
| T4 | 編織軟甲 wovenSoft | 獸革甲 beastHide | 鐵板甲 ironPlate |
| T5 | 絲紋輕衣 silkweave | 龍皮甲 dragonHide | 玄鐵甲 blackIron |

**現有保留**：
- `rags` → 布 T1（DEF 從 0 不變）
- `leatherArmor` → 皮 T1（DEF 4 → 3）
- `chainmail` → 板 T2（DEF 8 → 12、SPD -2 → -5）
- `ironPlate` → 板 T4（DEF 14 → 20、SPD -6 → -10、EVA -4 → -8）

### 盾牌（TB_SHIELDS）— 不分大小

| 盾 | BLK | DEF | SPD |
|---|---|---|---|
| 無 none | 0 | 0 | 0 |
| 木盾 woodShield | 5 | 2 | 0 |
| 鐵盾 ironShield | 9 | 4 | -2 |

**重要**：**拿盾 = EVA 歸零**（2.1 節規則），不分木盾鐵盾。

### 派生 DEF 公式（複習）

```
DEF = 1.5×CON + 0.5×STR + armor.DEF + shield.DEF
```

### 模擬對照（中期玩家 STR 25 DEX 25 CON 20 挨打）

敵人長劍 ATK 16 PEN 10、STR 20 CON 20：敵 ATK = 56、PEN 30 (20%)

| 玩家護甲 | DEF 總 | effDef | 被打每擊 | HP 140 挨幾擊 |
|---|---|---|---|---|
| 無甲 | 45 | 36 | 20 | 7 擊死 |
| 布 T3 | 47 | 37.6 | 18 | 8 擊 |
| 皮 T3 | 53 | 42.4 | 13 | 11 擊 |
| 板 T3 | 61 | 48.8 | **7** | 20 擊 |
| 板 T5 | 70 | 56 | **1**（floor） | 140 擊 |

### 設計意圖

- 板 T5 面對同等級對手**近乎無敵**（被打 floor 1 傷）
- 但 **SPD -13 + AGI -2** 讓重甲流行動緩慢（60/60 玩家穿板 T5 每擊 2 秒）
- 布 T5 **EVA +6** 疊加 AGI 50 後可 cap 95%，**閃避流另一條路**
- 皮系是「百搭」——無亮點但無缺點，適合不確定流派的玩家

---

## § 5 攻擊結算流程（TB_attack）— 2026-04-22 新公式

### 流程順序：命中 → 傷害 → 爆擊 → 格擋

```
1. 路線 special buff 套用（rage/focus 改數值）
2. 反制檢查（Boss counter_stance / 盾牆反擊）

3. 命中判定
   hitChance = clamp(ACC - max(0, (EVA-20) × 0.7), 10, 92)
   （單手流派進階後 cap 改為 98）
   if random(0-100) > hitChance: → MISS, 結束

4. 傷害計算（三步）
   (a) 基礎   raw    = ATK × random(0.88 ~ 1.12)
   (b) 穿甲   penPct = min(0.75, PEN / 150)
            effDef = DEF × (1 - penPct)
   (c) 淨傷   net    = max(1, raw - effDef)

5. 爆擊判定
   isCrit = random(0-100) < CRT    (CRT cap 95%)
   if isCrit:
     net = net × (1 + CDMG/100)
     // CDMG 163 → net × 2.63 (263%)
     // CDMG 240 → net × 3.40 (340%)

6. 格擋（有盾才觸發）
   if 有盾:
     blkTrigger = isCrit ? BLK × 0.5 : BLK         // 爆擊觸發率減半
     if random(0-100) < blkTrigger:
       reduction = BpWr × (isCrit ? 0.5 : 1.0)     // 爆擊減傷效力減半
       net = max(1, net × (1 - reduction/100))

7. 受傷判定（寫入戰鬥結果，傳給 Wounds 系統）
   - damage ≥ 40 或（暴擊 && damage ≥ 20）→ medium / heavy
   - damage ≥ 20 → 25% 機率 light
   - 部位依 weapon.type 從 BODY_PARTS_BY_TYPE 選

8. 儀表累積（rage 被打 +15、focus 閃避 +20、fury 格擋 +28）
```

### 公式設計哲學（2026-04-22 明確化）

| 攻擊端屬性 | 用來剋制對方的 | 原理 |
|---|---|---|
| **PEN** | 高 DEF 對手 | 每擊穩穩打薄防禦 |
| **CRT** | 高 BLK 對手 | 偶爾打穿盾 |
| **ACC** | 高 EVA 對手 | 確保命中 |

→ 防守三軸（DEF / BLK / EVA）各有對應攻擊軸（PEN / CRT / ACC）來破解。

### BODY_PARTS_BY_TYPE

| 武器 type | 部位池 |
|---|---|
| unarmed | 軀幹 × 2, 頭部 |
| blade1h | 軀幹, 手臂, 腿部 |
| dual | 手臂 × 2, 頭部, 腿部 |
| polearm | 軀幹 × 2, 腿部 |
| heavy2h | 軀幹 × 2, 手臂, 頭部 |

**注意**：blunt1h/blunt2h/blade2h **沒有在表中**，fallback 到 blade1h 的部位池。

---

## § 6 三路線儀表系統

每個戰鬥單位歸類到 **rage / focus / fury** 其中一個。儀表累積到 100 → 觸發必殺。

### 儀表獲取規則（TBC.GAUGE_GAIN）

| 路線 | 觸發 | 獲取 |
|---|---|---|
| **rage** | 被擊中 | +15 |
| rage | 被暴擊 | +25 |
| rage | 命中對手 | +10 |
| rage | HP 低時 | +12 |
| **focus** | 命中 | +12 |
| focus | 閃避 | +20 |
| focus | 命中暴擊 | +22 |
| focus | 連續未被命中 | +10 |
| **fury** | 格擋 | +28 |
| fury | 部分吸收 | +18 |
| fury | 防禦動作 | +25 |
| fury | 任意被命中 | +10 |
| fury | 被穿透（PEN）| -8 |

每回合結束自動衰減（rage -5 / focus -3 / fury -2）。

### 必殺效果（TBC.SPECIALS）

| 路線 | 名稱 | 持續 | 效果 |
|---|---|---|---|
| **rage** | 血怒 | 3 回合 | ATK ×2、DEF ×0.5、EVA ×0（不閃避），結束後 stamina -30 |
| **focus** | 絕對瞬息 | 2 回合 | ACC +999（必中）、CRT +40、SPD ×1.5 |
| **fury** | 盾牆反擊 | 1 回合 | 反應式：下次被攻擊時，阻擋並反擊 ×1.5 |

### 路線與武器搭配

| 武器 | 預設 route | 核心玩法 |
|---|---|---|
| 匕首 / 長槍 | focus | 高命中、高閃避、等待必殺必中 |
| 短劍 / 長劍 | fury | 穩守反擊、等格擋/盾牆 |
| 槌 / 長槌 / 重斧 | rage | 硬碰硬、低血觸發必殺 |

**副手覆蓋**：
- 裝盾 → 強制 fury（不管原武器 route）
- 雙持 → 強制 rage

---

## § 7 其他關鍵機制

### 7.1 ATB 系統（battle.js）— 2026-04-22 新公式

**原理**：每單位有一條 ATB 條（0→100），每 50ms tick 加一點值，滿 100 可行動、行動後歸零。

**填速公式**（2026-04-22 修訂）：
```js
function _calcFillRate(unit) {
  const weapon = TB_WEAPONS[unit.weaponId];
  const effSPD = Math.max(12, unit.derived.SPD);    // 新保底 12（原為 8）
  const rawRate = effSPD / weapon.swingTime;
  return Math.min(weapon.cap, rawRate);              // 新：每武器獨立 cap（原為共用 6.5）
}
```

**實際攻擊間隔**：
```
毫秒/擊 = (100 / fillRate) × 50ms
       = swingTime × 5000 / effSPD   (未撞 cap)
       = 100 × 50 / cap  =  5000 / cap  (撞 cap)
```

### 各武器極限速度（撞 cap 時）

| 武器 | swingTime | cap | 最快毫秒/擊 | 一秒擊數 |
|---|---|---|---|---|
| **匕首** | 2 | **10** | 500ms | 2.00 |
| 短劍 | 3 | 8 | 625ms | 1.60 |
| 長槍 | 4 | 7 | 714ms | 1.40 |
| 長劍 | 5 | 6 | 833ms | 1.20 |
| 槌 | 5 | 6 | 833ms | 1.20 |
| 重斧 | 9 | 4 | 1250ms | 0.80 |
| **長槌** | 10 | 3 | **1667ms** | 0.60 |

### 各階段實際速度（AGI = DEX = X）

| 武器 | 新手 X=15 | 中期 X=25 | 後期 X=40 | 極限 X=60 |
|---|---|---|---|---|
| 匕首 (+12 SPD) | 500ms ⚡ | 500ms | 500ms | 500ms |
| 短劍 (+2) | 882ms | 625ms ⚡ | 625ms | 625ms |
| 長槍 (+6) | 952ms | 714ms ⚡ | 714ms | 714ms |
| 長劍 (-3) | 2083ms | 1136ms | 833ms ⚡ | 833ms |
| 槌 (-3) | 2083ms | 1136ms | 833ms ⚡ | 833ms |
| 重斧 (-10) | 4167ms | 2994ms | 1500ms | 1250ms ⚡ |
| 長槌 (-8) | 4167ms | 2941ms | 1562ms | 1667ms ⚡ |

⚡ = 撞 cap（練再多 AGI/DEX 也不會更快）

### 7.2 評分 S/A/B/C（戰後）

| 評分 | 門檻（tick 數） | 名聲倍率 |
|---|---|---|
| **S** 迅雷 | ≤ 120 ticks | ×2.0 |
| **A** 穩健 | ≤ 200 ticks | ×1.5 |
| **B** 消耗 | ≤ 240 ticks | ×1.0 |
| **C** 殘喘 | > 240 ticks | ×0.7 |

C 級額外扣體力 -15。

### 7.3 名聲壓制（intimidation）

敵人 `intimidation` 值 vs 玩家 WIL → 壓制 penalty（ACC / CRT / SPD 下降）。

### 7.4 護符 TB_AMULETS

| 護符 | 效果 |
|---|---|
| 破爛幸運符 | LUK +5, DEF -3 |
| 主人賞賜戒指 | 六維 +3 |
| 鬥技徽章 | ATK +5 |
| 力量符文 | STR +8, gaugeBonus +15% |
| 集中寶石 | DEX +6, focusBonus +20% |
| 鐵意志符 | WIL +10, debuffResist +30% |
| 血祭護符 | ATK +8, hpMax -20 |

### 7.5 戰鬥特性 TB_TRAITS（部分）

| 特性 | 效果 |
|---|---|
| 逆境覺醒 bloodlust | HP < 30% → ATK ×1.25 |
| 武器本能 weaponInstinct | ACC +8, CRT +10 |
| 獵人直覺 predator | 對手 HP > 自己 → EVA +15 |
| 不屈 unbreakable | 首次擊倒後下一擊 ×2 |
| 冷靜眼 coldEye | 每回合 ACC +5（同對手，上限 +20）|

---

## § 8 BB 擴充評估（2026-04-22 定稿）

### 決議總覽

| BB 元素 | 決議 | 理由 |
|---|---|---|
| ❌ **雙血條 armorHP** | **不做** | 新 PEN 值 + 爆擊公式已解決重甲難題 |
| ❌ 匕首 Puncture | **不做** | 新爆擊公式已讓敏捷流破甲 |
| ❌ 快/重攻二擇 | **不做** | 三路線儀表已覆蓋 |
| ❌ 第二排/投擲/兵種/地形 | **不做** | 1v1 角鬥士設定不合 |
| ✅ **武器耐久度** | **做** | 葛拉線核心驅動 |
| ✅ **武器獨門招式擴充** | **做** | split_shield / bleed / riposte |
| ✅ **對硬甲耗損倍率** | **做** | 配合耐久度，打板甲武器磨得快 |

### 8.1 武器耐久度系統

#### Durability 上限
| Tier | durabilityMax |
|---|---|
| T1 | 15 |
| T2 | 25 |
| T3 | 40 |
| T4 | 60 |
| T5 | 90 |

#### 每擊耗損公式
```
wear = 1 × armorTypeMult × weaponMismatchMult
```

**armorTypeMult**（被打方穿什麼）：
- 無甲 / 布衣 → ×0.5
- 皮甲 → ×1.0
- 鏈甲 → ×1.5
- 板甲 → ×2.0

**weaponMismatchMult**（武器 vs 甲）：
- 鈍器 vs 板甲 → ×0.8
- 鈍器 vs 其他 → ×1.0
- 劍 / 斧 vs 板甲 → ×1.5
- 長槍 vs 任何 → ×1.0
- 匕首 vs 鏈甲 → ×2.0
- 匕首 vs 板甲 → ×3.0

#### 三階段武器狀態
```
完好 (dura > 0)
   ↓ dura = 0
損壞 (ATK ×0.7、PEN ×0.5、失去 special，仍可用)
   ↓ 損壞後再挨擊 × 3 或對方爆擊
真正毀滅（極罕見）→ 自動切 fists
```

→ **損壞不等於變空手**，玩家永遠有機會翻身。

#### 戰前警告
- < 25% dura → 派遣事件「你真要拿那個上場？」
- < 10% dura → 紅字強警告

#### 戰後處理
- 損壞武器 → `weaponInventory` 標 `broken: true`
- 無法再裝備直到修繕
- 修繕成本：武器價格 × 30%
- 葛拉好感 30+ → 每 10 天免費修 1 次

### 8.2 武器獨門招式擴充

| 武器 | special | 效果 |
|---|---|---|
| 長槍 | `first_strike` | 已有：瞬刺 delay=1 tick |
| 長槌 | `concuss` | 待實作：擊中後對方下回合跳過 |
| 重斧 | `split_shield`（新）| 攻擊時 20% 機率對方 shield.BLK -5（單場內）|
| 長劍 | `riposte`（新）| 格擋後下次攻擊必暴擊 |
| 匕首 | `bleed`（新）| 爆擊時施加 3 tick × 2 dmg 流血 |

### 8.3 舊設計（已砍，存檔備忘）

以下內容曾考慮過但已**否決**，保留於此防止再繞回來：

- ~~Armor HP 雙血條~~：新公式已解
- ~~匕首 Puncture（甲破後 ×2）~~：爆擊流已夠
- ~~快/重攻二擇~~：三路線夠用

（舊 armorHP / puncture / 快重攻 設計稿詳細內容已刪除，避免誤導。上表已列明最終決議。）

---

## § 9 現有系統的問題 / 統一 TODO

### 9.1 雙武器表合併 ✅ 2026-04-23 完成

`src/content/weapons.js` 現為**單一事實源**（flat 結構）。
`TB_WEAPONS` 在 testbattle.js 開頭 alias 到 `Weapons`。
所有戰鬥欄位（route/swingTime/special/twoHanded/hitParts）加入。

### 9.2 雙護甲表合併 ✅ 2026-04-23 完成

`src/content/armors.js` 為**單一事實源**（flat 結構）。
DEF 值統一為**戰鬥尺度**（0/4/8/14），**不是**原顯示尺度（0/12/22/38）。
新增 thickLeather（葛拉線 T2）/ studdedLeather（葛拉線 T3）。
`TB_ARMORS` / `TB_SHIELDS` 在 testbattle.js 分流 alias（按 type 欄位）。
舊 bug 修復：main.js / testbattle.js 的 'leather' → 'leatherArmor'（id 統一）。

### 9.3 BODY_PARTS_BY_TYPE 不全

blunt1h / blunt2h / blade2h 沒定義，會 fallback 到 blade1h。
應該各自定義部位池（例：blunt → 頭 × 2, 身體）。

### 9.4 special 'concuss' 只是標記，沒實作

長槌的 `special:'concuss'` 寫了但沒有對應效果 code。
需要實作：擊中後對方下回合跳過。

### 9.5 結局死亡判定與 arena-system.md 的新公式未整合

arena-system.md 我寫了新的「overkill > hpMax × 15% 才死」公式，現在 battle.js 還是直接 onLose → deathEnding。
這個要同步修。

---

## § 10 實作順序（2026-04-22 定稿）

### 階段 1：統一基礎
1. 合併 `weapons.js` + `TB_WEAPONS`（單一事實源）
2. 合併 `armors.js` + `TB_ARMORS`（統一用 testbattle 的小數字 0/4/8/14）
3. 補全 BODY_PARTS_BY_TYPE（blunt / blade2h 各自部位池）

### 階段 2：新戰鬥公式
1. CRT cap 75 → 95
2. 爆擊公式 `net × (CDMG/100)` → `net × (1 + CDMG/100)`
3. 爆擊破格擋（BLK 觸發 ×0.5、BpWr ×0.5）
4. SPD 保底 `max(8, SPD)` → `max(12, SPD)`
5. 每武器獨立 cap（取代共用 6.5）
6. 更新武器 PEN 值（長槍 15、長劍 10、重斧 14、長槌 18）
7. 拿盾 EVA = 0

### 階段 3：四流派加成
1. 預設加成（裝上武器自動套用）
2. 雙持 DEX ≥ 15 門檻檢查
3. UI 武器欄旁小框顯示流派 + hover tooltip
4. 人物介面顯示邏輯

### 階段 4：武器耐久度 + 獨門招式
1. `weaponInventory` 加 `durability` 欄位
2. 每擊耗損公式（armorTypeMult × weaponMismatchMult）
3. 損壞 → 三階段狀態（完好 / 損壞 / 毀滅）
4. 獨門招式：實作 concuss、新增 split_shield / riposte / bleed
5. 葛拉修繕服務（連動鐵匠線）

### 階段 5：整合 arena-system 的死亡公式
- battle.js onLose → 讀 overkill 判定而非直接 deathEnding

---

## § 11 檔案索引

| 檔案 | 角色 |
|---|---|
| `src/battle/testbattle.js` | 核心引擎（資料表 + 公式 + AI） |
| `src/battle/battle.js` | 遊戲整合層（ATB 迴圈 + UI + 評分） |
| `src/content/weapons.js` | 武器資料（背包 / 商店顯示用） |
| `src/content/armors.js` | 護甲資料（背包 / 商店顯示用） |
| `src/content/enemy.js` | 敵人定義 |
| `src/systems/wounds.js` | 部位傷勢 + 低血擲傷 + 密醫 |
| `tests/testbattle.html` | 戰鬥測試平台（獨立頁） |

---

## § 12 最終決議速查（2026-04-22）

✅ **採納**：
- 四流派加成（單手/雙持/單盾/雙手）
- 每武器獨立 cap
- 新爆擊公式 `1 + CDMG/100`
- 爆擊破格擋
- CRT cap 95
- 拿盾 EVA = 0
- 長槍調整（ATK↓、PEN↑、ACC↑、CRT↑）
- 雙手武器 PEN 直接調高
- SPD 保底 max(12, SPD)
- 武器耐久度 + 損壞三階段
- 對硬甲 wear 倍率
- split_shield / riposte / bleed 武器招式
- arena-system overkill 死亡公式

❌ **砍掉**：
- ~~雙血條 armorHP~~（新公式已解）
- ~~匕首 Puncture~~（新爆擊已夠）
- ~~快/重攻二擇~~（三路線夠用）
- ~~武器 × 護甲 15 格克制表~~
- ~~武器 × 部位 20 格擲骰表~~
- ~~流派相剋圈~~
