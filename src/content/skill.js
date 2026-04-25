/**
 * skill.js — Active and passive skill definitions
 * Skills are unlocked through training, story events, or NPC interactions.
 *
 * 🆕 D.6 v2：被動技能透過屬性 EXP 購買（見 Stats.learnSkill）。
 *   - expCosts: { [attr]: cost }  — 基礎成本（可多屬性）
 *   - unlockReq: { [attr]: level } — 若玩家屬性低於門檻，自動把差額 EXP 疊加到成本上
 *                                    且購買成功時把該屬性升到門檻
 *   - unlockReq.fame               — 名聲門檻為硬卡，無法用 EXP 補
 *   - 主動技能目前資料保留，等戰鬥系統掛鉤後啟用
 */
const Skills = {
  // ── Passive skills ──────────────────────────────────
  ironSkin: {
    id: 'ironSkin', name: '鐵皮',
    type: 'passive',
    desc: '長年受創讓你的皮膚變得更厚實。永久 +5 DEF。',
    unlockReq: { CON: 15 },
    expCosts:  { CON: 200 },
    passiveBonus: { DEF: 5 },
  },
  quickStep: {
    id: 'quickStep', name: '輕步',
    type: 'passive',
    desc: '腳步比常人更輕盈，難以捕捉。永久 +8 EVA。',
    unlockReq: { AGI: 15 },
    expCosts:  { AGI: 200 },
    passiveBonus: { EVA: 8 },
  },
  bloodlust: {
    id: 'bloodlust', name: '嗜血',
    type: 'passive',
    desc: '每次擊殺敵人時，恢復少量HP。',
    unlockReq: { STR: 18, fame: 20 },
    passiveBonus: {},
    onKill: { type: 'vital', key: 'hp', delta: 10 },
  },

  // ── Active skills ────────────────────────────────────
  powerStrike: {
    id: 'powerStrike', name: '蓄力重擊',
    type: 'active',
    desc: '蓄力一擊，造成 ATK×2.0 傷害，無視部分防禦。',
    mpCost: 0, staminaCost: 20,
    cooldown: 3,  // turns
    unlockReq: { STR: 14 },
    effect: { dmgMult: 2.0, penBonus: 15 },
  },
  riposte: {
    id: 'riposte', name: '反擊',
    type: 'active',
    desc: '格擋後立即反擊，造成 ATK×1.5 傷害，且此回合 EVA +30%。',
    staminaCost: 15, cooldown: 2,
    unlockReq: { DEX: 14, AGI: 12 },
    effect: { dmgMult: 1.5, evaBonus: 30 },
  },
  warCry: {
    id: 'warCry', name: '戰吼',
    type: 'active',
    desc: '發出震懾的戰吼，使自身 ATK +20%，持續 3 回合。',
    staminaCost: 10, cooldown: 5,
    unlockReq: { WIL: 14 },
    effect: { atkPctBonus: 20, duration: 3 },
  },

  // ── 🆕 2026-04-25 v10 監督官巴爺主線獎勵 ─────────────
  unyielding: {
    id: 'unyielding', name: '不屈',
    type: 'passive',
    desc: '巴爺傳授的絕技。受到致命一擊時鎖死 1 HP 不死，之後 5 回合內傷害 +30%。整場戰鬥僅觸發 1 次。',
    // 🆕 不靠 EXP 購買 — 由「揭露真相 → 告訴巴爺 → 訣別事件」劇情授予
    storyOnly: true,
    grantedBy: 'overseer_passed_torch',  // flag set 後玩家獲得
    passiveBonus: {},
    // 戰鬥端 hook（待 battle.js 整合）：
    //   onLethalHit: 鎖 hp = 1, set flag _unyielding_fired_battle, set duration 5 turns
    //   onTurnAfterFire (5 turns): atkPctBonus: 30
    //   每場戰鬥開始時 reset _unyielding_fired_battle
    onLethalHit: {
      hpFloor: 1,
      buffName: 'unyielding_rage',
      buffDuration: 5,
      atkPctBonus: 30,
    },
  },

  veteran_eye: {
    id: 'veteran_eye', name: '老兵之眼',
    type: 'passive',
    desc: '看過太多場、看得出對手破綻。戰鬥開始時看破對手 1 個弱點屬性（PEN/CRT/ACC/SPD 任一），對應你的攻擊屬性 +20%。',
    // 🆕 v10：巴爺主線「不透漏」路線獎勵 — 但實際取得來源待設計（設計書標 TODO）
    //   暫定觸發來源：巴爺主線「不透漏真相」結局獎勵（aff 70+ + 偷聽密謀已觸發 + 不告訴）
    //   未來其他取得來源（卡西烏斯訓練 / 老默觀察 / 賭場斥候）可再開
    storyOnly: true,
    grantedBy: 'overseer_kept_secret',  // flag set 後玩家獲得
    passiveBonus: {},
    // 戰鬥端 hook（待 battle.js 整合）：
    //   onBattleStart: 從對手 weakness 欄位讀取（需戰鬥系統 weakness 欄位）
    //   套用對應屬性 ×1.20
    onBattleStart: {
      revealWeakness: true,
      attrBonusPct: 20,
    },
  },
};
