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
  chainmail: {
    id: 'chainmail', name: '鏈甲',
    type: 'plate',
    DEF: 8, SPD: -2, EVA: -2,
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
