/**
 * equipment_quality.js — 裝備品質系統 Phase 1
 *
 * 設計：[docs/systems/equipment-rework.md](../../docs/systems/equipment-rework.md) § 2 + § 8
 *
 * 5 級品質：
 *   crude（粗灰）-15% / common（普白）±0% / fine（精藍）+15% /
 *   superb（上紫）+30% / legendary（傳金）+50%
 *
 * 數值修正套用範圍：
 *   武器：ATK / ACC / CRT / CDMG / SPD / PEN（負數值也按比例）
 *   護甲：DEF / EVA / SPD / BLK
 *   不影響：hands / twoHanded / weaponClass / hitParts / special / route
 *
 * Phase 1 不做詞綴系統（Phase 2 才做）。
 *
 * 玩家裝備物件：weaponInventory[i].quality（'common' 是預設）
 */
const EquipmentQuality = (() => {

  // 🆕 2026-04-30 user 改 5 級色階：去掉灰、加綠在中間（白綠藍紫金）
  //   ID 保留（avoid save migration）、但名字 + 顏色改
  const QUALITY_DEFS = {
    crude:     { id: 'crude',     name: '普通', mult: 0.85, color: '#dddddd', order: 1 },  // 白
    common:    { id: 'common',    name: '良品', mult: 1.00, color: '#88dd66', order: 2 },  // 綠
    fine:      { id: 'fine',      name: '精品', mult: 1.15, color: '#5a9aff', order: 3 },  // 藍
    superb:    { id: 'superb',    name: '上品', mult: 1.30, color: '#c060ff', order: 4 },  // 紫
    legendary: { id: 'legendary', name: '傳家', mult: 1.50, color: '#ffaa20', order: 5 },  // 金
  };

  const DEFAULT_QUALITY = 'common';

  function getDef(quality) {
    return QUALITY_DEFS[quality] || QUALITY_DEFS[DEFAULT_QUALITY];
  }
  function getMult(quality)  { return getDef(quality).mult; }
  function getColor(quality) { return getDef(quality).color; }
  function getName(quality)  { return getDef(quality).name; }
  function isValid(quality)  { return !!QUALITY_DEFS[quality]; }
  function listQualities()   { return Object.values(QUALITY_DEFS).sort((a,b) => a.order - b.order); }

  // 武器戰鬥屬性（負數值也按比例倍率、保留正負方向）
  const WEAPON_COMBAT_KEYS = ['ATK', 'ACC', 'CRT', 'CDMG', 'SPD', 'PEN'];
  // 護甲戰鬥屬性
  const ARMOR_COMBAT_KEYS  = ['DEF', 'EVA', 'SPD', 'BLK', 'BpWr'];

  /**
   * 套品質倍率到武器物件、回傳 shallow copy。
   *   傳入 'common' 或 undefined → 直接回傳原物件（不複製、節省記憶體）
   */
  function applyToWeapon(w, quality) {
    if (!w) return w;
    if (!quality || quality === DEFAULT_QUALITY) return w;
    const mult = getMult(quality);
    if (mult === 1.0) return w;
    const out = Object.assign({}, w);
    WEAPON_COMBAT_KEYS.forEach(k => {
      if (typeof w[k] === 'number') {
        out[k] = Math.round(w[k] * mult);
      }
    });
    return out;
  }

  function applyToArmor(ar, quality) {
    if (!ar) return ar;
    if (!quality || quality === DEFAULT_QUALITY) return ar;
    const mult = getMult(quality);
    if (mult === 1.0) return ar;
    const out = Object.assign({}, ar);
    ARMOR_COMBAT_KEYS.forEach(k => {
      if (typeof ar[k] === 'number') {
        out[k] = Math.round(ar[k] * mult);
      }
    });
    return out;
  }

  /**
   * 從 player inventory 找出某 itemId 的 quality。
   *   slot: 'weapon' | 'armor' | 'offhand' (offhand 也走 weaponInventory)
   *   itemId: 武器/護甲 ID
   *   回傳 quality 字串、找不到回 'common'
   */
  function getInventoryQuality(player, slot, itemId) {
    if (!player || !itemId) return DEFAULT_QUALITY;
    const inv = (slot === 'armor')
      ? (player.armorInventory || [])
      : (player.weaponInventory || []);   // offhand 也從武器庫存找
    const entry = inv.find(it => it && it.id === itemId);
    if (entry && entry.quality && QUALITY_DEFS[entry.quality]) return entry.quality;
    return DEFAULT_QUALITY;
  }

  /**
   * 取得玩家當前裝備的品質。
   *   slot: 'weapon' | 'armor' | 'offhand'
   *   回傳 quality 字串
   */
  function getEquippedQuality(player, slot) {
    if (!player) return DEFAULT_QUALITY;
    let id;
    if (slot === 'weapon')       id = player.equippedWeapon;
    else if (slot === 'armor')   id = player.equippedArmor;
    else if (slot === 'offhand') id = player.equippedOffhand;
    if (!id) return DEFAULT_QUALITY;
    return getInventoryQuality(player, slot, id);
  }

  /**
   * 格式化裝備顯示名（含品質中文標記、可在 UI 顯示）。
   *   範例：formatItemName('短劍', 'fine') → '短劍（精良）'
   *   common 不加標記 → 'short_sword'（保持原名）
   */
  function formatItemName(baseName, quality) {
    if (!baseName) return '';
    if (!quality || quality === DEFAULT_QUALITY) return baseName;
    const def = QUALITY_DEFS[quality];
    if (!def) return baseName;
    return `${baseName}（${def.name}）`;
  }

  /**
   * 格式化裝備顯示名（含品質顏色 HTML span）。
   *   common 不加 span。
   */
  function formatItemNameHTML(baseName, quality) {
    if (!baseName) return '';
    if (!quality || quality === DEFAULT_QUALITY) return baseName;
    const def = QUALITY_DEFS[quality];
    if (!def) return baseName;
    return `<span style="color:${def.color}">${baseName}（${def.name}）</span>`;
  }

  /**
   * 舊存檔遷移：weaponInventory / armorInventory 補齊 quality 欄位（預設 common）。
   *   呼叫時機：save_system.js sanitize 時、或 Stats.ensure 內。
   */
  function sanitizeInventory(player) {
    if (!player) return;
    if (Array.isArray(player.weaponInventory)) {
      player.weaponInventory.forEach(entry => {
        if (entry && typeof entry === 'object' && !entry.quality) {
          entry.quality = DEFAULT_QUALITY;
        }
      });
    }
    if (Array.isArray(player.armorInventory)) {
      player.armorInventory.forEach(entry => {
        if (entry && typeof entry === 'object' && !entry.quality) {
          entry.quality = DEFAULT_QUALITY;
        }
      });
    }
  }

  return {
    QUALITY_DEFS,
    DEFAULT_QUALITY,
    getDef,
    getMult,
    getColor,
    getName,
    isValid,
    listQualities,
    applyToWeapon,
    applyToArmor,
    getInventoryQuality,
    getEquippedQuality,
    formatItemName,
    formatItemNameHTML,
    sanitizeInventory,
  };
})();
