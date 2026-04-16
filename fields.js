/**
 * fields.js — Scene/location definitions
 *
 * Phase 1-J 重構（2026-04-13）：
 *   訓練場是遊戲唯一場景。所有寢室/廚房/鍛造坊/長官房/主人房/市集/出城
 *   已全部刪除——房間品質改由名聲決定，其餘 NPC 互動改由事件觸發。
 *
 * Each field config:
 *   id          : unique key
 *   name        : display name
 *   icon        : single CJK char shown on scene button
 *   category    : 'room' | 'training' | 'special'
 *   timeRange   : [startHour, endHour]  (24h, end exclusive)
 *   bgClass     : CSS class applied to scene-view for background
 *   ambientClass: CSS class for ambient overlay effect
 *   logText     : italic white description text shown on entry
 *   characters  : [ { npcId, role:'teammate'|'audience', chance:0-1 } ]
 *   favorWeight : { STR, DEX, CON, AGI, WIL } — 🆕 D.18 背景角鬥士抽取權重
 *                 影響每日在場的背景人員屬性分佈，定義訓練所「風格」
 */

const FIELDS = {

  // ── 唯一場景：標準訓練場 ─────未來需要再製作不同的等級───────────────────────────────
  stdTraining: {
    id: 'stdTraining',
    name: '訓練場',
    icon: '鬥',
    category: 'training',
    timeRange: [0, 24],
    requirements: {},
    bgClass: 'bg-std-training',
    ambientClass: 'ambient-dust',
    logText: '整齊排列的訓練器械，平整的沙地上印滿了腳印與血跡。\n這裡的空氣都充滿了汗水與鐵鏽的氣息。\n磨礪自身——這是唯一讓你在百日祭典上活下去的機會。',
    // 🆕 D.18：背景角鬥士抽取權重（標準訓練所偏好存活派）
    // 塔倫長官希望大家都活下去 → CON/WIL 派背景更常見
    favorWeight: { CON:3, WIL:3, STR:2, DEX:1, AGI:1 },
    characters: [
      // 隊友（可發起切磋/友情練習）
      // 🆕 D.20：奧蘭永駐出現（同命兄弟，每天 100% 在場）
      { npcId: 'orlan',         role: 'teammate', chance: 1.00 },
      // 🆕 索爾（Day 1-4 在場，Day 5 後透過 alive:false 從隊伍消失）
      { npcId: 'sol',           role: 'teammate', chance: 1.00 },
      { npcId: 'cassius',       role: 'teammate', chance: 0.60 },
      { npcId: 'ursa',          role: 'teammate', chance: 0.55 },
      { npcId: 'dagiSlave',     role: 'teammate', chance: 0.50 },
      { npcId: 'oldSlave',      role: 'teammate', chance: 0.35 },
      // 觀眾/權威（事件觸發目標）
      { npcId: 'overseer',      role: 'audience', chance: 0.65 },
      { npcId: 'blacksmithGra', role: 'audience', chance: 0.30 },
      { npcId: 'melaKook',      role: 'audience', chance: 0.25 },
      { npcId: 'masterServant', role: 'audience', chance: 0.20 },
    ],
  },

};

/**
 * Roll which NPCs appear in the field this visit.
 * Phase 1-J：schedule 系統保留，但目前唯一場景是 stdTraining。
 * @returns { teammates: npcId[], audience: npcId[] }
 */
function rollFieldNPCs(fieldId) {
  const f = FIELDS[fieldId];
  if (!f) return { teammates: [], audience: [] };

  const NPC_ALL = (typeof teammates !== 'undefined' && teammates.NPC_DEFS)
                  ? teammates.NPC_DEFS : {};

  const rawTime = (typeof Stats !== 'undefined') ? Stats.player.time : 360;
  const curHour = 6 + Math.max(0, Math.floor((rawTime - 360) / 120)) * 2;

  const forcedIds = new Set();
  const tmList = [], audList = [];

  // Step 1: force-add scheduled NPCs
  Object.values(NPC_ALL).forEach(npc => {
    if (!npc.schedule) return;
    npc.schedule.forEach(rule => {
      if (rule.fields.includes(fieldId) && rule.hours.includes(curHour) && !forcedIds.has(npc.id)) {
        forcedIds.add(npc.id);
        (npc.role === 'teammate' ? tmList : audList).push(npc.id);
      }
    });
  });

  // Step 2: random fill, skip already-forced NPCs
  (f.characters || []).forEach(entry => {
    if (forcedIds.has(entry.npcId)) return;
    // 🆕 檢查 NPC 是否還活著（索爾 Day 5 後 alive=false 就不再出現）
    const npcDef = NPC_ALL[entry.npcId];
    if (npcDef && npcDef.alive === false) return;
    if (Math.random() < entry.chance) {
      (entry.role === 'teammate' ? tmList : audList).push(entry.npcId);
    }
  });

  return { teammates: tmList, audience: audList };
}
