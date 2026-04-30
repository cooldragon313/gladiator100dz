/**
 * armors.js — 護甲 / 盾 單一事實源（2026-04-23 統一後）
 *
 * 結構為 flat（所有戰鬥欄位直接在物件上，不再用 eqBonus 包）：
 *   - 護甲：DEF, SPD, EVA
 *   - 盾：BLK, DEF, SPD
 *   - 共通：id, name, type, desc, price
 *
 * testbattle.js 的 TB_ARMORS / TB_SHIELDS 會 alias 到本檔（見 testbattle.js 開頭）。
 *
 * type 欄位用途：
 *   - 'cloth' / 'leather' / 'plate'：護甲類型（對應 battle-system.md § 4 三類）
 *   - 'shield'：盾牌（會被 alias 分流到 TB_SHIELDS）
 *
 * 2026-04-23 重點改動：
 *   - DEF 數值統一用**戰鬥引擎尺度**（0/4/8/14），非原 armors.js 顯示尺度（0/12/22/38）
 *   - 新增 thickLeather / studdedLeather 兩件葛拉打造的皮甲
 *   - 移除 .eqBonus 包裝
 *
 * 擴充：三類 × 5 tier 完整系統見 docs/systems/battle-system.md § 4（待實作）
 */
const Armors = {

  // ── 布系 ──────────────────────────────────────────────
  rags: {
    id: 'rags', name: '破布',
    type: 'cloth',
    DEF: 0, SPD: 0, EVA: 0,
    desc: '遮體而已，沒有任何防護效果。',
    price: 0,
  },

  // ── 皮系 ──────────────────────────────────────────────
  leatherArmor: {
    id: 'leatherArmor', name: '皮甲',
    type: 'leather',
    DEF: 4, SPD: 0, EVA: 0,
    desc: '輕便的皮革護甲，不妨礙移動。',
    price: 40,
  },
  thickLeather: {
    id: 'thickLeather', name: '加厚皮甲',
    type: 'leather',
    DEF: 6, SPD: 0, EVA: 0,
    desc: '多層鞣製皮革壓合，比普通皮甲吸衝擊。葛拉打的。',
    price: 70,
  },
  studdedLeather: {
    id: 'studdedLeather', name: '鉚釘皮甲',
    type: 'leather',
    DEF: 10, SPD: -1, EVA: 0,
    desc: '皮革上釘了鐵釘，兼顧防禦與輕便。能看出打造者的心思。',
    price: 110,
  },

  // ── 板系 ──────────────────────────────────────────────
  // 🆕 2026-04-30 拉強：base 8 → 12（皮系頂峰 studded 10、板系起點該 ≥ 12 才合升級邏輯）
  //   SPD/EVA 加大懲罰：-2 → -3（板甲就是肉盾、犧牲機動風味出來）
  chainmail: {
    id: 'chainmail', name: '鏈甲',
    type: 'plate',
    DEF: 12, SPD: -3, EVA: -3,
    desc: '由鐵環編織而成，比皮甲堅固，但重量也更大。',
    price: 80,
  },
  ironPlate: {
    id: 'ironPlate', name: '鐵板甲',
    type: 'plate',
    DEF: 14, SPD: -6, EVA: -4,
    desc: '幾乎刀槍不入，但你每走一步都像拖著鐵錨。',
    price: 150,
  },
  // 🆕 2026-04-25b：板甲 T3（葛拉階段 7 終階）
  steelPlate: {
    id: 'steelPlate', name: '鋼板甲',
    type: 'plate',
    DEF: 18, SPD: -7, EVA: -5,
    desc: '葛拉打過最重的一件。穿上去能擋兩記重斧、但你也走不快。「這套不是給普通人穿的。」',
    price: 350,
  },

  // ── 🆕 2026-04-25 護甲升級對照表（葛拉階段 7 用）───────
  //   依玩家當前裝備自動找下一階
  //   皮系（輕路線）：rags → leatherArmor → thickLeather → studdedLeather → chainmail（轉板系）
  //   板系（重路線）：chainmail → ironPlate → steelPlate
  // 寫成全域 map 供 blacksmith_events 讀取
  // ══════════════════════════════════════════════════
  // 🆕 2026-04-30 主人賜護飾線（3 條：布護臂 / 皮護腿 / 鐵頭盔）
  //   設計：[docs/systems/equipment-rework.md § 4.1](../../docs/systems/equipment-rework.md)
  //   每條 3 件（粗灰/精藍/上紫）、勝場推進、第 4 件傳家獨立三選一
  // ══════════════════════════════════════════════════

  // 護臂線（布材質）
  clothArm: {
    id: 'clothArm', name: '布護臂',
    type: 'cloth', slot: 'arms',
    DEF: 1, SPD: 1, EVA: 1,
    desc: '主人賜的第一件護臂——粗布裹腕。輕、不妨礙、能在你被打到那一下少留一道疤。',
    price: 0,
  },
  clothArm_fine: {
    id: 'clothArm_fine', name: '布精護臂',
    type: 'cloth', slot: 'arms',
    DEF: 2, SPD: 2, EVA: 2,
    desc: '主人讓人重縫過的版本。內襯加厚、繡線整齊。穿戴時會聽到絲綢摩擦的聲音。',
    price: 0,
  },
  clothArm_superb: {
    id: 'clothArm_superb', name: '布上等護臂',
    type: 'cloth', slot: 'arms',
    DEF: 3, SPD: 3, EVA: 3,
    desc: '南方絲、北方麻交織。染成深褐、繡紋暗紋。穿上去你會發現自己揮拳變快了一點。',
    price: 0,
  },

  // 護腿線（皮材質）
  leatherLeg: {
    id: 'leatherLeg', name: '皮護腿',
    type: 'leather', slot: 'legs',
    DEF: 2, SPD: 0, EVA: 1,
    desc: '主人賜的第一件護腿——硬皮綁腿。包裹小腿、護膝有銅釘。',
    price: 0,
  },
  leatherLeg_fine: {
    id: 'leatherLeg_fine', name: '皮精護腿',
    type: 'leather', slot: 'legs',
    DEF: 3, SPD: 0, EVA: 2,
    desc: '兩層皮加棉襯、釘扣是黃銅。膝蓋部位有花紋——主人家的徽記簡化版。',
    price: 0,
  },
  leatherLeg_superb: {
    id: 'leatherLeg_superb', name: '皮上等護腿',
    type: 'leather', slot: 'legs',
    DEF: 5, SPD: 0, EVA: 3,
    desc: '匠人花了整週縫的版本。皮革染成深紅、釘扣是真銀。穿上你會多一份重量、但也多一份底氣。',
    price: 0,
  },

  // 頭盔線（鐵材質）
  ironHelm: {
    id: 'ironHelm', name: '鐵頭盔',
    type: 'plate', slot: 'helmet',
    DEF: 2, SPD: -1, EVA: 0,
    desc: '主人賜的第一件頭盔——鐵半盔、護鼻無面甲。能擋一棍、但聽不太到自己的呼吸。',
    price: 0,
  },
  ironHelm_fine: {
    id: 'ironHelm_fine', name: '鐵精頭盔',
    type: 'plate', slot: 'helmet',
    DEF: 3, SPD: -1, EVA: 0,
    desc: '葛拉重新校準過的版本。重心更穩、後腦多一塊鐵片。',
    price: 0,
  },
  ironHelm_superb: {
    id: 'ironHelm_superb', name: '鐵上等頭盔',
    type: 'plate', slot: 'helmet',
    DEF: 4, SPD: -1, EVA: 0,
    desc: '鋼鐵打的、頭頂鏤空一個小徽記。戴上去你會感覺自己變成了某種雕像。',
    price: 0,
  },

  // 🆕 第 4 件傳家三選一（35 場勝 + 5 連勝 + S 評達成、定型）
  heirloomCloak: {
    id: 'heirloomCloak', name: '主人傳家斗篷',
    type: 'cloth', slot: 'chest',
    DEF: 4, SPD: 5, EVA: 6,
    flatBonus: { DEX: 5, AGI: 2 },
    desc: '主人從家族長輩傳下的絲質斗篷。輕、滑、但不易破。「⋯⋯選這件、就要學會像風那樣打。」',
    price: 0, isHeirloom: true,
  },
  heirloomLeather: {
    id: 'heirloomLeather', name: '主人傳家護甲套',
    type: 'leather', slot: 'chest',
    DEF: 8, SPD: 0, EVA: 2,
    flatBonus: { STR: 3, DEX: 3, CON: 3, AGI: 3, WIL: 3 },
    desc: '主人家族世代傳的工匠皮甲、每一塊皮都有不同年代的補丁。「⋯⋯選這件、就要學會什麼都來一點。」',
    price: 0, isHeirloom: true,
  },
  heirloomPlate: {
    id: 'heirloomPlate', name: '主人傳家鎧甲',
    type: 'plate', slot: 'chest',
    DEF: 16, SPD: -4, EVA: -3,
    flatBonus: { CON: 5 },
    desc: '主人家族最古老的一件、傳了七代的鋼鐵鎧。每一道凹痕都有名字。「⋯⋯選這件、就要學會被打不倒。」',
    price: 0, isHeirloom: true,
  },

  // ── 盾牌 ──────────────────────────────────────────────
  woodShield: {
    id: 'woodShield', name: '木盾',
    type: 'shield',
    BLK: 5, DEF: 2, SPD: 0,
    desc: '乾燥的木頭做成的盾牌，兩三下就可能碎裂。',
    price: 20,
  },
  ironShield: {
    id: 'ironShield', name: '鐵盾',
    type: 'shield',
    BLK: 9, DEF: 4, SPD: -2,
    desc: '厚實的鐵盾，擋住重擊的同時你的手臂也在顫抖。',
    price: 70,
  },
};

// 🆕 2026-04-25：護甲升級對照表（葛拉階段 7 用）
const ARMOR_TIER_UPGRADE = {
  rags:           'leatherArmor',
  leatherArmor:   'thickLeather',
  thickLeather:   'studdedLeather',
  studdedLeather: 'chainmail',     // 皮系頂峰 → 轉板系
  chainmail:      'ironPlate',
  ironPlate:      'steelPlate',
  // steelPlate 已是頂級、再升要走階段 8 傳家
};
