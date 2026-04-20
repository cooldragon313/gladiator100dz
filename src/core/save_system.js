/**
 * save_system.js — Save slot management
 *
 * Part D.1.8 實作
 * ────────────────
 * 擴展原本的單一存檔位置為多槽位系統：
 *   slot_0 ~ slot_4  手動存檔（5 個槽）
 *   auto             自動存檔（依 settings.gameplay.autoSave）
 *   backup           備份槽（戰鬥前快照，可選用）
 *
 * 每個槽位除了完整存檔資料外，還包含 metadata 供 UI 顯示
 * （角色名、天數、背景、訓練所、名聲、存檔時間）而不需要解析完整資料。
 *
 * 相容舊存檔：
 *   啟動時自動把 'bairi_save_v1' 遷移到 slot_0，並保留舊 key（safety）。
 *
 * 載入順序：stats.js 之後、main.js 之前（main.js 會呼叫它）。
 * 依賴：Flags、GameState（讀取當前遊戲狀態）
 */
const SaveSystem = (() => {

  // ── 常數 ──────────────────────────────────────────
  const KEY_PREFIX  = 'bairi_save_';
  const LEGACY_KEY  = 'bairi_save_v1';
  const MANUAL_SLOTS = 5;       // slot_0 ~ slot_4
  const AUTO_SLOT    = 'auto';
  const BACKUP_SLOT  = 'backup';

  /** 所有可用的槽位 ID 列表（有序） */
  function _allSlotIds() {
    const ids = [];
    for (let i = 0; i < MANUAL_SLOTS; i++) ids.push('slot_' + i);
    ids.push(AUTO_SLOT, BACKUP_SLOT);
    return ids;
  }

  function _storageKey(slotId) {
    return KEY_PREFIX + slotId;
  }

  // ══════════════════════════════════════════════════
  // 寫入
  // ══════════════════════════════════════════════════

  /**
   * 存檔到指定槽位。
   *
   * @param {string}  slotId  'slot_0'~'slot_4' | 'auto' | 'backup'
   * @param {object}  payload 完整的遊戲狀態物件（由 main.js 組裝）
   * @returns {boolean} 是否成功
   */
  function saveToSlot(slotId, payload) {
    if (!slotId || !payload) return false;
    try {
      const entry = {
        slotId,
        metadata:  _buildMetadata(payload),
        data:      payload,
      };
      localStorage.setItem(_storageKey(slotId), JSON.stringify(entry));
      return true;
    } catch (e) {
      console.warn('[SaveSystem] saveToSlot failed:', slotId, e);
      return false;
    }
  }

  /**
   * 從 payload 提取展示用 metadata。
   * 這些欄位讓槽位選擇 UI 可以快速顯示，不用解析完整資料。
   */
  function _buildMetadata(payload) {
    const p = payload.player || {};
    return {
      playerName: p.name || '無名',
      day:        p.day  || 1,
      fame:       p.fame || 0,
      origin:     p.origin   || null,
      facility:   p.facility || null,
      religion:   p.religion || null,
      achievements: (p.achievements || []).length,
      savedAt:    Date.now(),
      version:    payload.version || 5,
    };
  }

  // ══════════════════════════════════════════════════
  // 讀取
  // ══════════════════════════════════════════════════

  /**
   * 從指定槽位讀取完整存檔資料。
   *
   * @param {string} slotId
   * @returns {object|null} payload 或 null
   */
  function loadFromSlot(slotId) {
    try {
      const raw = localStorage.getItem(_storageKey(slotId));
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (!entry || !entry.data) return null;
      return entry.data;
    } catch (e) {
      console.warn('[SaveSystem] loadFromSlot failed:', slotId, e);
      return null;
    }
  }

  /**
   * 取得槽位的 metadata（不含完整資料，輕量）。
   *
   * @param {string} slotId
   * @returns {object|null} metadata 或 null
   */
  function getSlotMetadata(slotId) {
    try {
      const raw = localStorage.getItem(_storageKey(slotId));
      if (!raw) return null;
      const entry = JSON.parse(raw);
      return entry?.metadata || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 檢查槽位是否有存檔。
   */
  function hasSlot(slotId) {
    return localStorage.getItem(_storageKey(slotId)) !== null;
  }

  /**
   * 列出所有槽位的 metadata（for UI 顯示）。
   *
   * @returns {Array<{slotId, metadata}|{slotId, metadata:null}>}
   *          每個槽位一個物件，空槽位 metadata 為 null
   */
  function listSlots() {
    return _allSlotIds().map(slotId => ({
      slotId,
      metadata: getSlotMetadata(slotId),
      isEmpty:  !hasSlot(slotId),
    }));
  }

  /**
   * 取得最新的存檔（按 savedAt 排序）。
   * 用於「繼續遊戲」預設選擇。
   *
   * @returns {string|null} slotId 或 null
   */
  function getLatest() {
    let latestSlot = null;
    let latestTime = 0;
    _allSlotIds().forEach(slotId => {
      const m = getSlotMetadata(slotId);
      if (m && m.savedAt > latestTime) {
        latestTime = m.savedAt;
        latestSlot = slotId;
      }
    });
    return latestSlot;
  }

  /**
   * 是否有任何存檔（包括 auto 和 backup）。
   */
  function hasAnySave() {
    return _allSlotIds().some(slotId => hasSlot(slotId));
  }

  // ══════════════════════════════════════════════════
  // 刪除
  // ══════════════════════════════════════════════════

  /**
   * 刪除指定槽位。
   */
  function deleteSlot(slotId) {
    try {
      localStorage.removeItem(_storageKey(slotId));
      return true;
    } catch (e) {
      console.warn('[SaveSystem] deleteSlot failed:', slotId, e);
      return false;
    }
  }

  /**
   * 清空所有存檔（危險操作）。
   */
  function clearAll() {
    _allSlotIds().forEach(slotId => deleteSlot(slotId));
    // 也清掉 legacy key
    try { localStorage.removeItem(LEGACY_KEY); } catch (e) { /* ignore */ }
  }

  // ══════════════════════════════════════════════════
  // Legacy 遷移
  // ══════════════════════════════════════════════════

  /**
   * 從舊的單一存檔 key 遷移到 slot_0。
   * 只在 slot_0 還沒有存檔時才遷移，避免覆蓋。
   *
   * @returns {boolean} 是否進行了遷移
   */
  function migrateFromLegacy() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return false;

      // 如果 slot_0 已有存檔，不要覆蓋
      if (hasSlot('slot_0')) return false;

      const legacyPayload = JSON.parse(raw);
      if (!legacyPayload || !legacyPayload.player) return false;

      const ok = saveToSlot('slot_0', legacyPayload);
      if (ok) {
        console.log('[SaveSystem] Legacy save migrated to slot_0');
      }
      // 不刪除 legacy key，作為 safety fallback
      return ok;
    } catch (e) {
      console.warn('[SaveSystem] migrateFromLegacy failed:', e);
      return false;
    }
  }

  // ══════════════════════════════════════════════════
  // 存檔摘要（debug 用）
  // ══════════════════════════════════════════════════

  function dump() {
    console.group('[SaveSystem] All slots');
    _allSlotIds().forEach(slotId => {
      const m = getSlotMetadata(slotId);
      if (m) {
        console.log(
          `  ${slotId}: ${m.playerName} (Day ${m.day}, Fame ${m.fame}) — ${new Date(m.savedAt).toLocaleString()}`
        );
      } else {
        console.log(`  ${slotId}: [empty]`);
      }
    });
    // Legacy
    const legacy = localStorage.getItem(LEGACY_KEY);
    console.log(`  legacy: ${legacy ? '[exists]' : '[empty]'}`);
    console.groupEnd();
  }

  // ── 自動執行 legacy 遷移 ──────────────────────────
  migrateFromLegacy();

  // ══════════════════════════════════════════════════
  // 公開介面
  // ══════════════════════════════════════════════════
  return {
    // 常數
    MANUAL_SLOTS,
    AUTO_SLOT,
    BACKUP_SLOT,
    // 寫入
    saveToSlot,
    // 讀取
    loadFromSlot,
    getSlotMetadata,
    hasSlot,
    listSlots,
    getLatest,
    hasAnySave,
    // 刪除
    deleteSlot,
    clearAll,
    // 遷移
    migrateFromLegacy,
    // Debug
    dump,
  };
})();
