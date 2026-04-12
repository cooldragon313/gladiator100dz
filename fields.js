/**
 * fields.js — Scene/location definitions
 *
 * Each field config:
 *   id          : unique key
 *   name        : display name
 *   icon        : single CJK char shown on scene button
 *   category    : 'room' | 'training' | 'special'
 *   timeRange   : [startHour, endHour]  (24h, end exclusive)
 *   requirements: { maxFame, minFame, affection:{npcId:min}, items:[itemId] }
 *   bgClass     : CSS class applied to scene-view for background
 *   ambientClass: CSS class for ambient overlay effect
 *   logText     : italic white description text shown on entry
 *   logColor    : text color override (default '#e0e0e0')
 *   characters  : [ { npcId, role:'teammate'|'audience', chance:0-1 } ]
 */

const FIELDS = {

  // ── ROOMS (only one accessible at a time based on fame) ──────────────────

  dirtyCell: {
    id: 'dirtyCell',
    name: '骯髒牢房',
    icon: '囚',
    category: 'room',
    timeRange: [0, 24],
    requirements: {
      maxFame: 19,
    },
    bgClass: 'bg-dirty-cell',
    ambientClass: 'ambient-damp',
    logText: '石牆滲出暗沉的水漬，腐爛與鐵鏽的氣味令人作嘔。\n隔壁牢欄裡的囚徒已數日未曾動彈，不知生死。\n你是一粒塵埃——新進的奴隸，或不再受寵的鬥士，才會淪落至此。',
    characters: [
      { npcId: 'dagiSlave',    role: 'teammate', chance: 0.65 },
      { npcId: 'oldSlave',     role: 'teammate', chance: 0.40 },
      { npcId: 'prisonGuard',  role: 'officer', chance: 0.50 },
    ],
  },

  basicRoom: {
    id: 'basicRoom',
    name: '簡單鬥士房',
    icon: '寢',
    category: 'room',
    timeRange: [0, 24],
    requirements: {
      minFame: 20,
      maxFame: 59,
    },
    bgClass: 'bg-basic-room',
    ambientClass: 'ambient-neutral',
    logText: '不再破舊，但也稱不上舒適。\n一張硬木床、一條薄被，和牆上掛著的生鏽鐵勾。\n能住在這裡，代表主人至少記得你的臉。',
    characters: [
      { npcId: 'cassius',      role: 'teammate', chance: 0.55 },
      { npcId: 'dagiSlave',    role: 'teammate', chance: 0.30 },
      { npcId: 'ursa',         role: 'teammate', chance: 0.35 },
      { npcId: 'overseer',     role: 'audience', chance: 0.40 },
    ],
  },

  luxuryRoom: {
    id: 'luxuryRoom',
    name: '高級房間',
    icon: '榮',
    category: 'room',
    timeRange: [0, 24],
    requirements: {
      minFame: 60,
    },
    bgClass: 'bg-luxury-room',
    ambientClass: 'ambient-warm',
    logText: '乾淨的石板地，柔軟的羊毛被褥，燭火輕搖。\n這是為數不多值得活著的理由之一。\n能走進這個房間，你已是主人眼中的明珠——但眾人的嫉妒也如影隨形。',
    characters: [
      { npcId: 'cassius',      role: 'teammate', chance: 0.50 },
      { npcId: 'ursa',         role: 'teammate', chance: 0.45 },
      { npcId: 'overseer',     role: 'audience', chance: 0.30 },
      { npcId: 'masterServant',role: 'audience', chance: 0.40 },
    ],
  },

  // ── TRAINING GROUNDS ─────────────────────────────────────────────────────

  oldTraining: {
    id: 'oldTraining',
    name: '破訓練場',
    icon: '練',
    category: 'training',
    timeRange: [8, 18],
    requirements: {
      maxFame: 29,
    },
    bgClass: 'bg-old-training',
    ambientClass: 'ambient-dust',
    logText: '沙地上留著無數血跡，生鏽的木樁孤零零地立著。\n訓練器材殘缺不全，但這仍是你少數能磨礪自身的地方。\n揮動著手中的廢鐵，只是為了明天還能活著。',
    characters: [
      { npcId: 'dagiSlave',    role: 'teammate', chance: 0.55 },
      { npcId: 'oldSlave',     role: 'teammate', chance: 0.45 },
      { npcId: 'overseer',     role: 'audience', chance: 0.60 },
    ],
  },

  stdTraining: {
    id: 'stdTraining',
    name: '標準訓練場',
    icon: '鬥',
    category: 'training',
    timeRange: [8, 18],
    requirements: {
      minFame: 30,
    },
    bgClass: 'bg-std-training',
    ambientClass: 'ambient-dust',
    logText: '整齊排列的訓練器械，平整的沙地上印滿了腳印與血跡。\n這裡的空氣都充滿了汗水與鐵鏽的氣息。\n磨礪自身——這是唯一讓你在百日祭典上活下去的機會。',
    characters: [
      { npcId: 'cassius',      role: 'teammate', chance: 0.60 },
      { npcId: 'ursa',         role: 'teammate', chance: 0.55 },
      { npcId: 'dagiSlave',    role: 'teammate', chance: 0.30 },
      { npcId: 'overseer',     role: 'audience', chance: 0.65 },
    ],
  },

  // ── SPECIAL LOCATIONS ────────────────────────────────────────────────────

  officerRoom: {
    id: 'officerRoom',
    name: '長官房',
    icon: '令',
    category: 'special',
    timeRange: [9, 17],
    requirements: {
      affection: { officer: 30 },
    },
    bgClass: 'bg-officer-room',
    ambientClass: 'ambient-neutral',
    logText: '長官的房間掛著地圖與戰利品，沉重的木桌上散落著文書。\n他用審視的目光打量著你——你的每一個舉動都在他眼中被記錄。\n好感能換來照顧，失察則是一句輕描淡寫的「送去競技場」。',
    characters: [
      { npcId: 'officer',      role: 'audience', chance: 0.90 },
      { npcId: 'cassius',      role: 'teammate', chance: 0.20 },
    ],
  },

  forge: {
    id: 'forge',
    name: '鍛造坊',
    icon: '鑄',
    category: 'special',
    timeRange: [7, 19],
    requirements: {},
    bgClass: 'bg-forge',
    ambientClass: 'ambient-fire',
    logText: '爐火熊熊，鐵鎚敲擊聲震耳欲聾。\n空氣中充滿了焦炭與鐵屑的氣味，高溫烘烤著你的皮膚。\n鐵匠沉默地打造著決定生死的兵器——每一把刀，都可能終結某人的百日。',
    characters: [
      { npcId: 'blacksmithGra', role: 'audience', chance: 0.95 },
      { npcId: 'ursa',          role: 'teammate', chance: 0.25 },
    ],
  },

  kitchen: {
    id: 'kitchen',
    name: '廚房',
    icon: '食',
    category: 'special',
    timeRange: [6, 21],
    requirements: {},
    bgClass: 'bg-kitchen',
    ambientClass: 'ambient-warm',
    logText: '油脂燃燒的香氣混著廚師的咒罵聲充滿整個空間。\n能在這裡討到一頓飽飯，對角鬥士來說已是難得的奢侈。\n廚娘梅拉的一碗稀粥，有時比任何訓練都更能讓人撐下去。',
    characters: [
      { npcId: 'melaKook',     role: 'audience', chance: 0.85 },
      { npcId: 'dagiSlave',    role: 'teammate', chance: 0.35 },
      { npcId: 'oldSlave',     role: 'teammate', chance: 0.30 },
    ],
  },

  masterRoom: {
    id: 'masterRoom',
    name: '主人房',
    icon: '主',
    category: 'special',
    timeRange: [10, 22],
    requirements: {
      affection: { master: 80 },
    },
    bgClass: 'bg-master-room',
    ambientClass: 'ambient-luxury',
    logText: '金色燈火搖曳，空氣中飄散著名貴香料的氣息。\n踏入此處，意味著你已獲得主人的青睞。\n每一分、每一秒都可能改變命運——也可能是最後一次走進這個房間。',
    characters: [
      { npcId: 'masterArtus',  role: 'audience', chance: 0.80 },
      { npcId: 'masterServant',role: 'audience', chance: 0.60 },
    ],
  },

  // ── OUTSIDE CITY ─────────────────────────────────────────────────────────

  market: {
    id: 'market',
    name: '城內市集',
    icon: '市',
    category: 'outside',
    timeRange: [8, 18],
    requirements: {
      // 長官或主人好感度 50 以上才可出行
      affectionOr: [{ officer: 50 }, { master: 50 }],
    },
    bgClass: 'bg-market',
    ambientClass: 'ambient-warm',
    logText: '城內市集人聲鼎沸，攤販的叫賣聲此起彼落。\n作為角鬥士能出現在這裡，引來不少路人的竊竊私語與目光。\n這裡可以購買道具與裝備，但錢袋要握緊——小偷無處不在。',
    characters: [
      { npcId: 'dagiSlave',     role: 'teammate', chance: 0.30 },
      { npcId: 'melaKook',      role: 'audience', chance: 0.25 },
      { npcId: 'blacksmithGra', role: 'audience', chance: 0.30 },
      { npcId: 'masterServant', role: 'audience', chance: 0.20 },
    ],
  },

  cityExit: {
    id: 'cityExit',
    name: '出城',
    icon: '野',
    category: 'outside',
    timeRange: [7, 17],
    requirements: {
      // 長官或主人好感度 50 以上才獲准出城
      affectionOr: [{ officer: 50 }, { master: 50 }],
    },
    bgClass: 'bg-city-exit',
    ambientClass: 'ambient-dust',
    logText: '城門緩緩在身後關閉，荒野的風撲面而來。\n這是難得的自由——但護衛的眼睛從未離開你的背影。\n城外的空氣中有泥土、枯草、和某種難以名狀的寂靜。',
    characters: [
      { npcId: 'cassius',    role: 'teammate', chance: 0.35 },
      { npcId: 'dagiSlave',  role: 'teammate', chance: 0.25 },
      { npcId: 'overseer',   role: 'audience', chance: 0.50 },
    ],
  },
};

// ── Field button list (order for left panel) ──────────────────────────────
// Each entry references which field IDs belong to a "slot" on the left panel
const FIELD_SLOTS = [
  { slot: 'room',      label: '寢室',   ids: ['dirtyCell', 'basicRoom', 'luxuryRoom'] },
  { slot: 'training',  label: '訓練場', ids: ['oldTraining', 'stdTraining'] },
  { slot: 'officer',   label: '長官房', ids: ['officerRoom'] },
  { slot: 'forge',     label: '鍛造坊', ids: ['forge'] },
  { slot: 'kitchen',   label: '廚房',   ids: ['kitchen'] },
  { slot: 'master',    label: '主人房', ids: ['masterRoom'] },
  { slot: 'market',    label: '市集',   ids: ['market'] },
  { slot: 'cityExit',  label: '出城',   ids: ['cityExit'] },
];

/**
 * Returns the best accessible field for a given slot, or null if none accessible.
 * @param {string} slotId
 * @param {object} playerRef  Stats.player
 * @returns {object|null}  FIELDS entry or null
 */
function getSlotField(slotId, playerRef) {
  const slot = FIELD_SLOTS.find(s => s.slot === slotId);
  if (!slot) return null;

  const hourNow = Math.floor(playerRef.time / 60) % 24;

  for (const id of slot.ids) {
    const f = FIELDS[id];
    if (!f) continue;

    // Time check
    const [tStart, tEnd] = f.timeRange;
    if (tEnd === 24) {
      if (hourNow < tStart) continue;
    } else {
      if (hourNow < tStart || hourNow >= tEnd) continue;
    }

    const req = f.requirements || {};

    // Fame checks
    if (req.minFame !== undefined && playerRef.fame < req.minFame) continue;
    if (req.maxFame !== undefined && playerRef.fame > req.maxFame) continue;

    // Affection checks (AND — all must be met)
    if (req.affection) {
      let ok = true;
      for (const [npc, minAff] of Object.entries(req.affection)) {
        if ((playerRef.affection[npc] || 0) < minAff) { ok = false; break; }
      }
      if (!ok) continue;
    }

    // Affection OR checks — at least one condition must be met
    if (req.affectionOr) {
      const anyMet = req.affectionOr.some(cond =>
        Object.entries(cond).every(([npc, minAff]) =>
          (playerRef.affection[npc] || 0) >= minAff
        )
      );
      if (!anyMet) continue;
    }

    // Item checks
    if (req.items && req.items.length > 0) {
      const hasAll = req.items.every(itemId =>
        playerRef.inventory.some(i => i.id === itemId)
      );
      if (!hasAll) continue;
    }

    return f; // first match wins (ids ordered from lowest to highest tier)
  }
  return null;
}

/**
 * Roll which NPCs appear in a field this visit.
 * @returns { teammates: npcId[], audience: npcId[] }
 */
function rollFieldNPCs(fieldId) {
  const f = FIELDS[fieldId];
  if (!f) return { teammates: [], audience: [] };

  // Grab NPC_DEFS before any local variable named 'teammates' is declared
  const NPC_ALL = (typeof teammates !== 'undefined' && teammates.NPC_DEFS)
                  ? teammates.NPC_DEFS : {};

  // Current slot start hour: 6, 8, 10 … 20
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
    if (Math.random() < entry.chance) {
      (entry.role === 'teammate' ? tmList : audList).push(entry.npcId);
    }
  });

  return { teammates: tmList, audience: audList };
}
