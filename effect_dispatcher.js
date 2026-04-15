/**
 * effect_dispatcher.js — Unified effect dispatcher
 *
 * Part D.1.9 實作
 * ────────────────
 * 統一處理來自 action / event / quest / trait / background 等資料模板的效果。
 * 所有效果都透過 Effects.apply(list, ctx) 套用，不再散落在各檔案。
 *
 * 取代以下重複邏輯：
 *   - main.js doAction 的 effect loop
 *   - main.js conditionalEffects 的 effect loop
 *   - events.js applyEvent
 *   - 未來：quests / traits / background init 等
 *
 * 使用範例：
 *   Effects.apply([
 *     { type: 'vital',  key: 'mood', delta: +10 },
 *     { type: 'money',  delta: -30 },
 *     { type: 'flag',   key: 'met_cassius' },
 *     { type: 'affection', key: 'cassius', delta: +5 },
 *   ]);
 *
 *   // 含 context（心情加成、當前 NPC、來源追蹤）
 *   Effects.apply(act.effects, {
 *     moodMult: 1.25,              // 正向效果 ×1.25
 *     currentNPCs: Game.currentNPCs, // for affection_all_present
 *     source: 'action:basicSwing',
 *   });
 *
 *   // 單一效果前置條件
 *   Effects.apply([
 *     { type: 'vital', key: 'hp', delta: +20, ifFlag: 'has_medicine' },
 *     { type: 'money', delta: -10, ifNot: 'is_broke' },
 *   ]);
 *
 * 載入順序：需要在 flags.js / game_state.js / stats.js 之後。
 *           其他依賴（teammates/Flags/GameState）在 runtime 才查，順序不嚴格。
 */
const Effects = (() => {

  // ══════════════════════════════════════════════════
  // 主要入口
  // ══════════════════════════════════════════════════

  /**
   * 套用一組效果。
   *
   * @param {Array}  list  效果陣列（每個元素見 applyOne 的 eff 參數）
   * @param {Object} [ctx] 執行上下文
   * @param {number} [ctx.moodMult=1]   正向效果的心情倍率（1.0 = 不變）
   * @param {Object} [ctx.currentNPCs]  當前場地 NPC（for affection_all_present）
   * @param {string} [ctx.source]       來源描述（debug 用，例：'action:rest'）
   */
  function apply(list, ctx = {}) {
    if (!Array.isArray(list)) return;
    for (const eff of list) {
      applyOne(eff, ctx);
    }
  }

  /**
   * 套用單一效果。會檢查前置條件（ifFlag / ifNot）。
   *
   * 效果物件結構：
   *   {
   *     type:  string,    // 效果類型（見 SWITCH）
   *     key:   string,    // 對象 key（如 'STR', 'cassius', 'marcus_told_story'）
   *     delta: number,    // 增量（正向效果會受 moodMult 影響）
   *     value: any,       // 某些類型用 value 而非 delta（flag/origin/facility 等）
   *     id:    string,    // 某些類型用 id（item/scar/pet 等）
   *     slot:  string,    // pet 用
   *     ifFlag: string,   // 前置：需要此 flag 為 true
   *     ifNot:  string,   // 前置：需要此 flag 為 false
   *   }
   *
   * @param {Object} eff
   * @param {Object} [ctx]
   */
  function applyOne(eff, ctx = {}) {
    if (!eff || typeof eff !== 'object') return;

    // ── 前置條件 ───────────────────────────────────
    if (eff.ifFlag && typeof Flags !== 'undefined' && !Flags.has(eff.ifFlag)) return;
    if (eff.ifNot  && typeof Flags !== 'undefined' &&  Flags.has(eff.ifNot))  return;

    // ── 心情倍率（只作用於正向 delta） ─────────────
    const moodMult = ctx.moodMult || 1.0;
    let delta = eff.delta;
    if (typeof delta === 'number' && delta > 0 && moodMult !== 1.0) {
      delta = delta * moodMult;
    }

    // ── 協力倍率（作用於 attr / exp 正向 delta） ────
    // 🆕 D.18 修正：D.6 v2 把訓練改為 type:'exp' 後協力倍率沒跟著遷移，
    //              導致所有訓練動作實際沒有吃到協力加成（只吃 moodMult）。
    // synergyMult 由 doAction 計算後傳入 ctx（已包含訓練所/護符/背景/三段等所有乘數）
    if ((eff.type === 'attr' || eff.type === 'exp') && typeof delta === 'number' && delta > 0) {
      const synergyMult = ctx.synergyMult || 1.0;
      delta = delta * synergyMult;
    }

    // 最終 delta 四捨五入
    if (typeof delta === 'number') delta = Math.round(delta * 100) / 100;

    // ── 分派到對應的處理器 ──────────────────────────
    switch (eff.type) {

      // ── 核心：體力/屬性/名聲 ───────────────────────
      case 'vital':
        Stats.modVital(eff.key, delta);
        break;

      case 'attr':
        Stats.modAttr(eff.key, delta);
        break;

      case 'fame':
        Stats.modFame(delta);
        break;

      // ── 經濟 / 經驗 ─────────────────────────────
      case 'money':
        Stats.modMoney(delta);
        break;

      case 'exp':
        Stats.modExp(eff.key, delta);
        break;

      case 'sp':
        Stats.modSp(delta);
        break;

      // ── 好感（單一 NPC） ────────────────────────
      case 'affection':
        if (typeof teammates !== 'undefined') {
          teammates.modAffection(eff.key, delta);
        }
        break;

      // ── 好感（當前場地所有 NPC） ─────────────────
      case 'affection_all_present':
        if (typeof teammates !== 'undefined' && ctx.currentNPCs) {
          const allIds = [
            ...(ctx.currentNPCs.teammates || []),
            ...(ctx.currentNPCs.audience  || []),
          ];
          allIds.forEach(id => teammates.modAffection(id, delta));
        }
        break;

      // ── 🆕 D.19 道德累積（滑動窗口）──────────────
      // 格式：{ type:'moral', axis:'reliability', side:'positive', weight:1, lock:false }
      //   axis   : reliability | mercy | loyalty | pride | patience
      //   side   : positive | negative
      //   weight : 1 = 普通事件，3 = 關鍵事件一次定型
      //   lock   : true = 劇情鎖定（後續此軸無效，僅極少用）
      case 'moral':
        if (typeof Moral !== 'undefined' && eff.axis && eff.side) {
          const result = Moral.push(eff.axis, eff.side, {
            weight: eff.weight || 1,
            lock:   !!eff.lock,
          });
          // 有新獲得的特性時給玩家回饋
          if (typeof Config !== 'undefined' && Config.TRAIT_DEFS) {
            result.added.forEach(tid => {
              const def = Config.TRAIT_DEFS[tid];
              if (def && typeof addLog === 'function') {
                const color = def.category === 'negative' ? '#cc7733' : '#88cc77';
                addLog(`✦ 你獲得了新的特性：【${def.name}】`, color, true, true);
              }
            });
            result.removed.forEach(tid => {
              const def = Config.TRAIT_DEFS[tid];
              if (def && typeof addLog === 'function') {
                addLog(`✧ 你失去了特性：【${def.name}】`, '#8899aa', false);
              }
            });
          }
        }
        break;

      // ── 旗標 ──────────────────────────────────
      case 'flag':
        Flags.set(eff.key, eff.value !== undefined ? eff.value : true);
        break;

      case 'flag_unset':
        Flags.unset(eff.key);
        break;

      case 'flag_increment':
        Flags.increment(eff.key, eff.delta || 1);
        break;

      // ── 個人物品（D.3 預留） ─────────────────────
      case 'item_add':
        if (!Array.isArray(Stats.player.personalItems)) Stats.player.personalItems = [];
        if (Stats.player.personalItems.length < 6) {    // 6 格上限（D.3）
          Stats.player.personalItems.push(eff.id);
        } else {
          console.warn('[Effects] personalItems full, cannot add:', eff.id);
        }
        break;

      case 'item_remove': {
        if (!Array.isArray(Stats.player.personalItems)) break;
        const idx = Stats.player.personalItems.indexOf(eff.id);
        if (idx >= 0) Stats.player.personalItems.splice(idx, 1);
        break;
      }

      // ── 疤痕（D.2 / C.1 預留） ───────────────────
      case 'scar':
        if (!Array.isArray(Stats.player.scars)) Stats.player.scars = [];
        if (!Stats.player.scars.includes(eff.id)) {
          Stats.player.scars.push(eff.id);
        }
        break;

      // ── 身分系統（S1/S2/E7/E8 預留） ─────────────
      case 'origin_set':
        Stats.player.origin = eff.id;
        break;

      case 'facility_set':
        Stats.player.facility = eff.id;
        break;

      case 'religion_set':
        Stats.player.religion = eff.id;
        break;

      case 'faction_set':
        Stats.player.faction = eff.id;
        break;

      // ── 世界狀態 / 季節 / 天氣（S4/E3 預留） ─────
      case 'world_state_set':
        if (typeof GameState !== 'undefined') GameState.setWorldState(eff.id);
        break;

      case 'season_set':
        if (typeof GameState !== 'undefined') GameState.setSeason(eff.id);
        break;

      case 'weather_set':
        if (typeof GameState !== 'undefined') GameState.setWeather(eff.id);
        break;

      // ── 寵物（D.5 預留） ────────────────────────
      case 'pet_add':
        if (eff.slot && Stats.player.pets) {
          Stats.player.pets[eff.slot] = eff.id;
        }
        break;

      case 'pet_remove':
        if (eff.slot && Stats.player.pets) {
          Stats.player.pets[eff.slot] = null;
        }
        break;

      // ── 特性 / 成就（獨立處理，不走 modXxx） ─────
      case 'trait_add':
        if (!Array.isArray(Stats.player.traits)) Stats.player.traits = [];
        if (!Stats.player.traits.includes(eff.id)) {
          Stats.player.traits.push(eff.id);
        }
        break;

      case 'trait_remove': {
        if (!Array.isArray(Stats.player.traits)) break;
        const tIdx = Stats.player.traits.indexOf(eff.id);
        if (tIdx >= 0) Stats.player.traits.splice(tIdx, 1);
        break;
      }

      // ── 任務（F4 預留，實作時補） ─────────────────
      case 'quest_start':
      case 'quest_advance':
      case 'quest_complete':
      case 'quest_fail':
        // TODO: Quest 系統實作時填入
        if (typeof Quests !== 'undefined') {
          if (typeof Quests[eff.type.replace('quest_', '')] === 'function') {
            Quests[eff.type.replace('quest_', '')](eff.id);
          }
        }
        break;

      // ── 未知類型 ──────────────────────────────
      default:
        console.warn('[Effects] Unknown effect type:', eff.type, eff);
    }
  }

  // ══════════════════════════════════════════════════
  // 公開介面
  // ══════════════════════════════════════════════════
  return {
    apply,
    applyOne,
  };
})();
