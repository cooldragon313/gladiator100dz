/**
 * day_cycle.js — Day transition hook registry
 *
 * Part D.1.11 實作
 * ────────────────
 * 提供統一的「每日結算」鉤子機制，讓所有需要每日觸發的系統
 * （NPC 成長 / 天氣 / 任務掃描 / 生病推進 / 夢境 / 寵物階段 / 謠言…）
 * 都可以在這裡註冊，不用各自 hook 進 main.js。
 *
 * 使用範例：
 *   // 註冊（在模組載入時）
 *   DayCycle.onDayStart('rollWeather', (newDay) => {
 *     Weather.rollToday(newDay);
 *   }, 15);
 *
 *   DayCycle.onDayEnd('healScars', (endingDay) => {
 *     ScarSystem.healOverTime(endingDay);
 *   }, 30);
 *
 * 由 main.js sleepEndDay 呼叫 fireDayEnd → 推進天數 → fireDayStart。
 *
 * 載入順序：無依賴，放在 sound.js 之後即可。
 */
const DayCycle = (() => {
  // ── 內部儲存 ─────────────────────────────────────
  const _startHooks = [];   // 新一天開始時觸發
  const _endHooks   = [];   // 就寢結算時觸發

  // ══════════════════════════════════════════════════
  // 註冊
  // ══════════════════════════════════════════════════

  /**
   * 註冊一個「新的一天開始」鉤子。
   * 在 sleepEndDay 推進完天數後、rollDailyNPCs 之前觸發。
   *
   * @param {string}   name      鉤子名稱（debug 用，必須唯一）
   * @param {Function} callback  (newDay: number) => void
   * @param {number}   [priority=50] 越小越先執行（0~100 建議範圍）
   *
   * Priority 建議：
   *    0~10  — 核心系統（如 NPC 原型成長）
   *   20~30  — 世界狀態（天氣/季節/事件）
   *   40~50  — 一般內容（預設）
   *   60~80  — 連動/統計（謠言/NPC 互動）
   *   90~100 — UI 刷新（最後執行）
   */
  function onDayStart(name, callback, priority = 50) {
    if (typeof name !== 'string' || typeof callback !== 'function') {
      console.warn('[DayCycle] onDayStart: invalid args', name);
      return;
    }
    // 檢查重複註冊
    if (_startHooks.some(h => h.name === name)) {
      console.warn('[DayCycle] onDayStart: hook already registered:', name);
      return;
    }
    _startHooks.push({ name, callback, priority });
    _startHooks.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 註冊一個「一天結束」鉤子。
   * 在 sleepEndDay 推進天數之前觸發，此時 p.day 仍是舊的一天。
   *
   * @param {string}   name
   * @param {Function} callback  (endingDay: number) => void
   * @param {number}   [priority=50]
   */
  function onDayEnd(name, callback, priority = 50) {
    if (typeof name !== 'string' || typeof callback !== 'function') {
      console.warn('[DayCycle] onDayEnd: invalid args', name);
      return;
    }
    if (_endHooks.some(h => h.name === name)) {
      console.warn('[DayCycle] onDayEnd: hook already registered:', name);
      return;
    }
    _endHooks.push({ name, callback, priority });
    _endHooks.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 取消註冊一個鉤子（例如某系統被卸載時）。
   *
   * @param {'start'|'end'} phase
   * @param {string}         name
   */
  function off(phase, name) {
    const arr = phase === 'start' ? _startHooks : _endHooks;
    const idx = arr.findIndex(h => h.name === name);
    if (idx >= 0) arr.splice(idx, 1);
  }

  // ══════════════════════════════════════════════════
  // 觸發（由 main.js 呼叫）
  // ══════════════════════════════════════════════════

  /**
   * 觸發所有「新一天開始」鉤子。
   * @param {number} newDay 新的天數
   */
  function fireDayStart(newDay) {
    for (const hook of _startHooks) {
      try {
        hook.callback(newDay);
      } catch (e) {
        console.warn(`[DayCycle] start hook "${hook.name}" threw:`, e);
      }
    }
  }

  /**
   * 觸發所有「一天結束」鉤子。
   * @param {number} endingDay 即將結束的天數
   */
  function fireDayEnd(endingDay) {
    for (const hook of _endHooks) {
      try {
        hook.callback(endingDay);
      } catch (e) {
        console.warn(`[DayCycle] end hook "${hook.name}" threw:`, e);
      }
    }
  }

  // ══════════════════════════════════════════════════
  // Debug
  // ══════════════════════════════════════════════════

  /**
   * 列出所有已註冊的鉤子（給 console 用）。
   */
  function listHooks() {
    return {
      start: _startHooks.map(h => ({ name: h.name, priority: h.priority })),
      end:   _endHooks.map(h   => ({ name: h.name, priority: h.priority })),
    };
  }

  function dump() {
    console.group('[DayCycle] Registered hooks');
    console.log('onDayStart:');
    _startHooks.forEach(h => console.log(`  [${h.priority}] ${h.name}`));
    console.log('onDayEnd:');
    _endHooks.forEach(h => console.log(`  [${h.priority}] ${h.name}`));
    console.groupEnd();
  }

  /**
   * 清空所有鉤子（測試用，一般不應呼叫）。
   */
  function clearAll() {
    _startHooks.length = 0;
    _endHooks.length   = 0;
  }

  // ══════════════════════════════════════════════════
  // 公開介面
  // ══════════════════════════════════════════════════
  return {
    onDayStart,
    onDayEnd,
    off,
    fireDayStart,
    fireDayEnd,
    listHooks,
    dump,
    clearAll,
  };
})();
