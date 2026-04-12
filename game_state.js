/**
 * game_state.js — Session-level global state
 *
 * 存放「非玩家資料」的遊戲狀態：
 *   - 當前場地（玩家所在位置）
 *   - 當前場地的 NPC（runtime 計算結果）
 *   - 每日 NPC 預滾快取
 *   - 季節 / 天氣 / 世界狀態（D.11 擴展預留）
 *
 * 區分職責：
 *   - Stats.player  = 玩家屬性與擁有物（存檔主體）
 *   - Flags         = 故事旗標（存檔）
 *   - teammates     = NPC 好感度（存檔）
 *   - GameState     = 世界/場景 runtime 狀態（部分存檔）
 *
 * 載入順序：在 flags.js 之後、stats.js 之前或之後皆可（無依賴）。
 *
 * Part D.1.12 實作
 */
const GameState = (() => {
  // ── 內部狀態 ─────────────────────────────────────
  const _state = {
    // ── 場景 ───────────────────────────────────────
    fieldId:        'dirtyCell',              // 當前所在場地 ID
    currentNPCs:    { teammates: [], audience: [] },  // 當前場地的 runtime NPC 列表

    // ── 每日 NPC 快取 ──────────────────────────────
    dailyNPCMap:    {},                        // { fieldId: { teammates, audience } }
    lastNPCRollDay: -1,                        // 最後一次 roll 的天數（避免同天重 roll）

    // ── 未來擴展（D.11 模板對應） ──────────────────
    season:      null,                         // 季節：spring/summer/autumn/winter
    weather:     null,                         // 天氣 ID
    worldState:  null,                          // 世界狀態 ID

    // ── 戰鬥/事件 runtime 標記 ─────────────────────
    currentEncounter: null,                    // 目前進行中的事件 ID（若有）
  };

  // ══════════════════════════════════════════════════
  // 場地
  // ══════════════════════════════════════════════════

  function getFieldId() {
    return _state.fieldId;
  }

  function setFieldId(id) {
    _state.fieldId = id;
  }

  // ══════════════════════════════════════════════════
  // 當前 NPC
  // ══════════════════════════════════════════════════

  function getCurrentNPCs() {
    return _state.currentNPCs;
  }

  function setCurrentNPCs(data) {
    _state.currentNPCs = data || { teammates: [], audience: [] };
  }

  // ══════════════════════════════════════════════════
  // 每日 NPC 快取
  // ══════════════════════════════════════════════════

  /**
   * 取得某場地的每日 NPC 快取。
   * @param {string} fieldId
   * @returns {{teammates:string[], audience:string[]}|undefined}
   */
  function getDailyNPCs(fieldId) {
    return _state.dailyNPCMap[fieldId];
  }

  /**
   * 設定某場地的每日 NPC 快取。
   * @param {string} fieldId
   * @param {object} data
   */
  function setDailyNPCs(fieldId, data) {
    _state.dailyNPCMap[fieldId] = data;
  }

  /**
   * 清空所有場地的每日 NPC 快取（每日結算時呼叫）。
   */
  function clearDailyNPCs() {
    _state.dailyNPCMap = {};
  }

  function getLastNPCRollDay() {
    return _state.lastNPCRollDay;
  }

  function setLastNPCRollDay(day) {
    _state.lastNPCRollDay = day;
  }

  /**
   * 強制使下次 rollDailyNPCs 重 roll（破壞快取）。
   * 存檔載入後、特殊事件後呼叫。
   */
  function invalidateDailyRoll() {
    _state.lastNPCRollDay = -1;
    _state.dailyNPCMap = {};
  }

  // ══════════════════════════════════════════════════
  // 季節 / 天氣 / 世界狀態（D.11 預留）
  // ══════════════════════════════════════════════════

  function getSeason()       { return _state.season; }
  function setSeason(s)      { _state.season = s; }

  function getWeather()      { return _state.weather; }
  function setWeather(w)     { _state.weather = w; }

  function getWorldState()   { return _state.worldState; }
  function setWorldState(ws) { _state.worldState = ws; }

  // ══════════════════════════════════════════════════
  // 事件 runtime
  // ══════════════════════════════════════════════════

  function getCurrentEncounter()    { return _state.currentEncounter; }
  function setCurrentEncounter(id)  { _state.currentEncounter = id; }
  function clearCurrentEncounter()  { _state.currentEncounter = null; }

  // ══════════════════════════════════════════════════
  // 序列化（存檔）
  // ══════════════════════════════════════════════════

  /**
   * 回傳要存檔的部分。不存 currentNPCs / dailyNPCMap 因為這些每天重算。
   * @returns {object}
   */
  function getSerializable() {
    return {
      fieldId:    _state.fieldId,
      season:     _state.season,
      weather:    _state.weather,
      worldState: _state.worldState,
    };
  }

  /**
   * 從存檔資料還原。會破壞每日 NPC 快取，確保載入後會重 roll。
   * @param {object} data
   */
  function loadFrom(data) {
    if (!data || typeof data !== 'object') return;
    _state.fieldId    = data.fieldId    || 'dirtyCell';
    _state.season     = data.season     || null;
    _state.weather    = data.weather    || null;
    _state.worldState = data.worldState || null;
    // 清空 runtime 快取，讓下次 rollDailyNPCs 重新計算
    invalidateDailyRoll();
    _state.currentNPCs = { teammates: [], audience: [] };
    _state.currentEncounter = null;
  }

  /**
   * 重置到初始狀態（新遊戲開始時呼叫）。
   */
  function reset() {
    _state.fieldId          = 'dirtyCell';
    _state.currentNPCs      = { teammates: [], audience: [] };
    _state.dailyNPCMap      = {};
    _state.lastNPCRollDay   = -1;
    _state.season           = null;
    _state.weather          = null;
    _state.worldState       = null;
    _state.currentEncounter = null;
  }

  // ══════════════════════════════════════════════════
  // Debug
  // ══════════════════════════════════════════════════

  function dump() {
    console.group('[GameState] Current session state');
    console.log('Field:', _state.fieldId);
    console.log('Current NPCs:', _state.currentNPCs);
    console.log('Daily Map keys:', Object.keys(_state.dailyNPCMap));
    console.log('Last roll day:', _state.lastNPCRollDay);
    console.log('Season/Weather/World:', _state.season, _state.weather, _state.worldState);
    console.groupEnd();
  }

  // ══════════════════════════════════════════════════
  // 公開介面
  // ══════════════════════════════════════════════════
  return {
    // 場地
    getFieldId, setFieldId,
    // NPC
    getCurrentNPCs, setCurrentNPCs,
    // 每日快取
    getDailyNPCs, setDailyNPCs, clearDailyNPCs,
    getLastNPCRollDay, setLastNPCRollDay,
    invalidateDailyRoll,
    // 季節 / 天氣 / 世界
    getSeason, setSeason,
    getWeather, setWeather,
    getWorldState, setWorldState,
    // 事件
    getCurrentEncounter, setCurrentEncounter, clearCurrentEncounter,
    // 存檔
    getSerializable, loadFrom, reset,
    // Debug
    dump,
  };
})();
