/**
 * recruit_pool.js — 無名招募 NPC 池（補屬性協力缺口）
 * ══════════════════════════════════════════════════
 * 設計：docs/systems/npc-influx-system.md
 *
 * 解決問題：teammate 中沒有 STR/AGI favoredAttr 的 NPC
 *   → 玩家走 STR/AGI build 完全沒協力加成
 *
 * 機制：
 *   - 每 10 天（Day 10/20/.../90）觸發「新血到」
 *   - 死亡結算（基礎 8% / 受過傷 +5% / 玩家好感保護 -10%）
 *   - 新血優先補目前最缺的屬性
 *
 * recruit NPC 特性：
 *   - 動態生成（id: recruit_xxx）
 *   - 純功能性、無 storyReveals / 道德軸事件 / 愛憎
 *   - 1 句羅馬風背景描述
 *   - 上限：每屬性最多 3 個、總上限 6 個 recruit
 */
const RecruitPool = (() => {

  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    } else if (typeof addLog === 'function') {
      addLog(text, color, true, !!important);
    }
  }

  // ── 名字 pool（羅馬風）─────────────────────────────
  const NAME_POOL = [
    'Marcus', 'Titus', 'Servius', 'Quintus', 'Decimus',
    'Gaius', 'Aulus', 'Sextus', 'Tiberius', 'Numa',
    'Atticus', 'Fabius', 'Hortensius', 'Cornelius', 'Petronius',
    'Vibius', 'Manius', 'Spurius', 'Tullus', 'Hostus',
  ];

  // ── 背景 pool（一句、無關劇情）───────────────────
  const BG_POOL = [
    '從高盧抓回來的戰俘。臉上一道刀疤、不太說話。',
    '失去家產的小貴族。眼神還沒被磨平。',
    '鄉下打鐵舖兒子。手粗、心也粗。',
    '鄰村破產的釀酒師。喝起酒比戰鬥兇。',
    '希臘人。會幾個你聽不懂的字。',
    '埃及來的。皮膚黑、笑得多。',
    '色雷斯山賊。被官兵抓到、賣到這裡。',
    '老兵的兒子。父親死後沒人養。',
    '逃奴。但他不會講。',
    '奴隸出生、沒見過自由是什麼樣子。',
    '原本是農場工人、欠主人錢被賣到這。',
    '前帝國輔助軍。退役後沒地方去。',
    '街頭打架打太多被官府收編進來。',
    '說自己會醫術但他的傷沒人會替他看。',
    '不知道從哪來。連他自己也說不清楚。',
  ];

  // ── 永駐 NPC 名單（不在死亡池）─────────────────
  const PROTECTED_IDS = ['orlan', 'cassius', 'hector', 'ursa', 'dagiSlave', 'oldSlave', 'sol'];

  // ── 上限 ───────────────────────────────────────
  const MAX_RECRUITS = 6;
  const PER_ATTR_MAX = 3;

  function _ensurePlayerRecruits() {
    if (!Stats.player.recruits) Stats.player.recruits = [];
    return Stats.player.recruits;
  }

  function _getActiveRecruits() {
    return _ensurePlayerRecruits().filter(r => r.alive !== false);
  }

  // ── 缺口分析（按目前隊伍找最缺的屬性）──────────
  function _findShortageAttrs() {
    const ATTRS = ['STR', 'DEX', 'CON', 'AGI', 'WIL'];
    const counts = { STR: 0, DEX: 0, CON: 0, AGI: 0, WIL: 0 };

    // 算永駐 + alive teammate 的 favoredAttr
    if (typeof teammates !== 'undefined' && teammates.NPC_DEFS) {
      Object.values(teammates.NPC_DEFS).forEach(npc => {
        if (npc.role !== 'teammate') return;
        if (npc.alive === false) return;
        if (npc.favoredAttr && counts[npc.favoredAttr] !== undefined) {
          counts[npc.favoredAttr]++;
        }
      });
    }
    // 加上 active recruits
    _getActiveRecruits().forEach(r => {
      if (r.favoredAttr && counts[r.favoredAttr] !== undefined) {
        counts[r.favoredAttr]++;
      }
    });

    // 排序：少的在前
    return ATTRS.slice().sort((a, b) => counts[a] - counts[b]);
  }

  // ── 動態生成一個 recruit ──────────────────────
  function _generateRecruit(forceAttr) {
    const recruits = _ensurePlayerRecruits();
    const id = `recruit_${recruits.length + 1}_${Date.now() % 10000}`;
    const usedNames = new Set(recruits.map(r => r.name));
    const availNames = NAME_POOL.filter(n => !usedNames.has(n));
    const name = availNames.length > 0
      ? availNames[Math.floor(Math.random() * availNames.length)]
      : `Recruit ${recruits.length + 1}`;

    // 屬性：優先填補缺口
    let favoredAttr = forceAttr;
    if (!favoredAttr) {
      const shortages = _findShortageAttrs();
      // 從前 2 缺口隨機選一個（避免每次都一樣）
      favoredAttr = shortages[Math.floor(Math.random() * 2)];
    }

    const desc = BG_POOL[Math.floor(Math.random() * BG_POOL.length)];

    return {
      id,
      name,
      role: 'teammate',
      title: '同訓的人',
      desc,
      favoredAttr,
      arriveDay: Stats.player.day,
      alive: true,
      isRecruit: true,        // 🆕 標記、UI 用聚合顯示
      // 簡單的「狀態」追蹤（給死亡結算用）
      tookInjury: false,
      affection: 0,
    };
  }

  // ── 死亡結算 ───────────────────────────────────
  function _runDeathRoll() {
    const active = _getActiveRecruits();
    const deaths = [];

    active.forEach(r => {
      let chance = 0.08;   // 基礎
      if (r.tookInjury) chance += 0.05;

      // 玩家對該 recruit 好感保護
      // recruit 是動態 NPC、teammates.affectionMap 用 recruit_id 存
      const aff = (typeof teammates !== 'undefined' && teammates.getAffection)
                    ? teammates.getAffection(r.id) : 0;
      if (aff >= 60) chance -= 0.10;
      chance = Math.max(0, chance);

      if (Math.random() < chance) {
        r.alive = false;
        deaths.push(r);
      }
    });

    return deaths;
  }

  // ── 主入口：每 10 天觸發 ────────────────────────
  function tryInflux() {
    const p = Stats.player;
    if (!p) return false;
    if (p.day < 10) return false;
    if (p.day % 10 !== 0) return false;
    if (Flags.has(`recruit_influx_day_${p.day}`)) return false;
    Flags.set(`recruit_influx_day_${p.day}`, true);

    // 1. 死亡結算
    const deaths = _runDeathRoll();
    deaths.forEach(r => {
      _log(`✦ 大家都沒回來時注意到——【${r.name}】這幾天沒見了。沒人提起他去哪。`, '#776666', true);
    });

    // 2. 新血加入（補死的 + 1 個淨成長、但不超過上限）
    const active = _getActiveRecruits();
    const slotLeft = MAX_RECRUITS - active.length;
    const wantToAdd = Math.min(slotLeft, deaths.length + 1);   // 補空缺 + 1

    if (wantToAdd <= 0) return true;

    const added = [];
    for (let i = 0; i < wantToAdd; i++) {
      const recruit = _generateRecruit();
      _ensurePlayerRecruits().push(recruit);
      // 註冊到 teammates module（讓 affection / flashNpcSlot 能找到）
      if (typeof teammates !== 'undefined' && teammates.registerRecruit) {
        teammates.registerRecruit(recruit);
      }
      added.push(recruit);
    }

    // log 通知（一句聚合 + 個別名單）
    const namesSummary = added.map(r => `${r.name}(${r.favoredAttr})`).join('、');
    _log(`✦ 新人來了：${namesSummary}`, '#88aacc', true);

    return true;
  }

  // ── UI 聚合資料：給 main.js 渲染用 ──────────────
  // 回傳 { STR: [r1, r2], AGI: [r3] } 格式
  function getActiveByAttr() {
    const grouped = { STR: [], DEX: [], CON: [], AGI: [], WIL: [] };
    _getActiveRecruits().forEach(r => {
      if (grouped[r.favoredAttr]) grouped[r.favoredAttr].push(r);
    });
    return grouped;
  }

  // ── debug：強制觸發一次（給 console 用）────────
  function _debugForceInflux() {
    const p = Stats.player;
    Flags.unset(`recruit_influx_day_${p.day}`);
    return tryInflux();
  }

  // ══════════════════════════════════════════════════
  // 註冊 DayCycle hook
  // ══════════════════════════════════════════════════
  function init() {
    if (typeof DayCycle === 'undefined' || !DayCycle.onDayStart) return;
    DayCycle.onDayStart('recruitInflux', () => {
      try { tryInflux(); } catch (e) { console.error('[RecruitPool]', e); }
    });
  }

  if (typeof DayCycle !== 'undefined') {
    init();
  } else if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', init);
  }

  return {
    init,
    tryInflux,
    getActiveByAttr,
    _debugForceInflux,
    _getActiveRecruits,
  };
})();
