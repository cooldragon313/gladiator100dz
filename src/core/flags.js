/**
 * flags.js — Global story flag manager
 *
 * 集中管理所有遊戲旗標（flag）。所有故事狀態必須透過這個模組存取，
 * 不得散落在 Stats.player 上。
 *
 * 命名規範（小寫 + 底線）：
 *   met_<npcId>             已見過某 NPC
 *   story_<event>           劇情狀態
 *   quest_<id>_<key>        任務進度
 *   pet_<id>_<action>       寵物互動
 *   has_<item>              擁有某物品/能力
 *   read_<thing>            讀過某東西
 *   killed_<npcId>          殺了某人
 *   spared_<npcId>          饒恕某人
 *   fed_<id>_count          計數器（餵食次數等）
 *   <origin>_<feature>      背景專屬
 *
 * 載入順序：必須在 stats.js、npc.js、events.js、battle.js、main.js 之前。
 * 無其他模組依賴。
 */
const Flags = (() => {
  // ── 內部儲存 ─────────────────────────────────────
  // 扁平物件，所有 flag 混在一起，用 key 前綴區分類別
  const _store = {};

  // ══════════════════════════════════════════════════
  // 設定
  // ══════════════════════════════════════════════════

  /**
   * 設定一個 flag。
   * 支援任意可 JSON 序列化的值（boolean / number / string / object / array）。
   *
   * @param {string} key   flag 名稱
   * @param {*}      value 值（預設為 true）
   *
   * @example
   *   Flags.set('met_cassius');                      // true
   *   Flags.set('player_village', '鐵木村');
   *   Flags.set('fed_rat_count', 3);
   */
  function set(key, value = true) {
    if (typeof key !== 'string' || !key) {
      console.warn('[Flags] set: invalid key', key);
      return;
    }
    _store[key] = value;
  }

  /**
   * 累加計數器。如果 key 不存在會從 0 開始。
   * 用於事件鏈累積條件（餵食次數、互動次數等）。
   *
   * @param {string} key   flag 名稱
   * @param {number} delta 增量（預設 1，可為負）
   * @returns {number}     累加後的值
   *
   * @example
   *   Flags.increment('fed_rat_count');           // 1
   *   Flags.increment('fed_rat_count');           // 2
   *   Flags.increment('fed_rat_count', 2);        // 4
   */
  function increment(key, delta = 1) {
    if (typeof key !== 'string' || !key) {
      console.warn('[Flags] increment: invalid key', key);
      return 0;
    }
    const current = typeof _store[key] === 'number' ? _store[key] : 0;
    _store[key] = current + delta;
    return _store[key];
  }

  // ══════════════════════════════════════════════════
  // 查詢
  // ══════════════════════════════════════════════════

  /**
   * 檢查 flag 是否「成立」（值為 truthy）。
   * 主要的條件判定方式。
   *
   * 注意：set(key, false) 後 has(key) 會回傳 false。
   *       如需檢查 key 是否存在，用 defined()。
   *
   * @param {string} key
   * @returns {boolean}
   */
  function has(key) {
    return !!_store[key];
  }

  /**
   * 檢查 key 是否存在（不論值為何，包括 false / 0 / ''）。
   * 較少用，一般用 has() 即可。
   *
   * @param {string} key
   * @returns {boolean}
   */
  function defined(key) {
    return Object.prototype.hasOwnProperty.call(_store, key);
  }

  /**
   * 取 flag 的值。
   *
   * @param {string} key
   * @param {*}      defaultVal 未設定時回傳此值
   * @returns {*}
   *
   * @example
   *   Flags.get('fed_rat_count', 0);        // 如果沒有則是 0
   *   Flags.get('player_village', '未知');  // 預設字串
   */
  function get(key, defaultVal = undefined) {
    return _store[key] !== undefined ? _store[key] : defaultVal;
  }

  /**
   * 檢查 flag 的數值是否 >= n。
   * 用於事件鏈計數條件的簡便寫法。
   *
   * @param {string} key
   * @param {number} n
   * @returns {boolean}
   *
   * @example
   *   if (Flags.gte('fed_rat_count', 3)) { ... }
   */
  function gte(key, n) {
    return (typeof _store[key] === 'number' ? _store[key] : 0) >= n;
  }

  // ══════════════════════════════════════════════════
  // 刪除
  // ══════════════════════════════════════════════════

  /**
   * 刪除一個 flag。
   *
   * @param {string} key
   */
  function unset(key) {
    delete _store[key];
  }

  // ══════════════════════════════════════════════════
  // 批量查詢（事件系統最常用）
  // ══════════════════════════════════════════════════

  /**
   * 多個 flag 必須全部成立。
   * 用於事件條件 `flag_required`。
   *
   * @param {string[]} keys
   * @returns {boolean}
   *
   * @example
   *   Flags.hasAll(['met_cassius', 'quest_marcus_active'])
   */
  function hasAll(keys) {
    if (!Array.isArray(keys)) return false;
    return keys.every(k => has(k));
  }

  /**
   * 多個 flag 任一成立即可。
   *
   * @param {string[]} keys
   * @returns {boolean}
   */
  function hasAny(keys) {
    if (!Array.isArray(keys)) return false;
    return keys.some(k => has(k));
  }

  /**
   * 多個 flag 必須全部「不成立」。
   * 用於事件條件 `flag_blocked`。
   *
   * @param {string[]} keys
   * @returns {boolean}
   *
   * @example
   *   Flags.hasNone(['marcus_dead', 'marcus_left'])
   */
  function hasNone(keys) {
    if (!Array.isArray(keys)) return false;
    return keys.every(k => !has(k));
  }

  // ══════════════════════════════════════════════════
  // 前綴篩選（百科、任務列表用）
  // ══════════════════════════════════════════════════

  /**
   * 取出所有 key 以指定前綴開頭的 flag。
   * 用於列出「所有見過的 NPC」「所有進行中的任務」等。
   *
   * @param {string} prefix
   * @returns {Object} 符合的 flag 子集
   *
   * @example
   *   Flags.getByPrefix('met_')   // { met_cassius: true, met_marcus: true, ... }
   *   Flags.getByPrefix('quest_') // 所有任務相關
   */
  function getByPrefix(prefix) {
    const result = {};
    for (const key in _store) {
      if (key.startsWith(prefix)) result[key] = _store[key];
    }
    return result;
  }

  /**
   * 計算符合前綴的 flag 數量。
   *
   * @param {string} prefix
   * @returns {number}
   *
   * @example
   *   Flags.countByPrefix('met_')  // 已見過 NPC 的數量
   */
  function countByPrefix(prefix) {
    let count = 0;
    for (const key in _store) {
      if (key.startsWith(prefix)) count++;
    }
    return count;
  }

  // ══════════════════════════════════════════════════
  // 序列化（存檔用）
  // ══════════════════════════════════════════════════

  /**
   * 取出完整 flag store 的淺拷貝。
   * 用於 saveGame() 寫入存檔。
   *
   * @returns {Object}
   */
  function getAll() {
    // 淺拷貝即可，因為 flag 值通常是原始型別
    // 若未來有物件型 flag 需求，改為深拷貝
    return { ..._store };
  }

  /**
   * 從存檔資料還原 flag store。
   * 用於 loadGame()。會先清空現有 store。
   *
   * @param {Object} data 存檔中的 flags 物件
   */
  function loadFrom(data) {
    clear();
    if (!data || typeof data !== 'object') return;
    Object.assign(_store, data);
  }

  /**
   * 清空所有 flag。
   * 用於新遊戲開始前。
   */
  function clear() {
    for (const key in _store) {
      delete _store[key];
    }
  }

  // ══════════════════════════════════════════════════
  // Debug
  // ══════════════════════════════════════════════════

  /**
   * 在 console 列印所有 flag（開發用）。
   */
  function dump() {
    console.group('[Flags] Current store');
    console.table(_store);
    console.log('Total flags:', Object.keys(_store).length);
    console.groupEnd();
  }

  /**
   * 回傳 flag 數量（唯讀檢查用）。
   *
   * @returns {number}
   */
  function size() {
    return Object.keys(_store).length;
  }

  // ══════════════════════════════════════════════════
  // 公開介面
  // ══════════════════════════════════════════════════
  return {
    // 設定
    set,
    increment,
    // 查詢
    has,
    defined,
    get,
    gte,
    // 刪除
    unset,
    // 批量
    hasAll,
    hasAny,
    hasNone,
    // 前綴
    getByPrefix,
    countByPrefix,
    // 序列化
    getAll,
    loadFrom,
    clear,
    // Debug
    dump,
    size,
  };
})();
