/**
 * skill.js — Active and passive skill definitions
 * Skills are unlocked through training, story events, or NPC interactions.
 *
 * 🆕 D.6 v2：被動技能透過屬性 EXP 購買（見 Stats.learnSkill）。
 *   - expCosts: { [attr]: cost }  — 基礎成本（可多屬性 — 加成派生的多個屬性都要付）
 *   - unlockReq: { [attr]: level } — 若玩家屬性低於門檻，自動把差額 EXP 疊加到成本上
 *                                    且購買成功時把該屬性升到門檻
 *   - unlockReq.fame               — 名聲門檻為硬卡，無法用 EXP 補
 *
 * 🆕 2026-04-25c 重整：7 被動 + 2 劇情，覆蓋全 5 主屬性 × 2 階
 *   成本公式：T1 ~150 EXP（≈ expToNext(30) × 0.9）；T2 ~450 EXP；
 *            按派生公式拆主/副屬性。
 *   參考派生公式：ATK=1.5×STR+0.5×DEX、ACC=STR+DEX、CRT=0.25×DEX+0.5×LUK、
 *               EVA=AGI+裝備、SPD=AGI-甲重、HP=hpBase+2×CON、DEF=1.5×CON+0.5×STR
 */
const Skills = {
  // ══════════════════════════════════════════════════
  // T1 被動 (req attr 20)
  // ══════════════════════════════════════════════════
  bigStrike: {
    id: 'bigStrike', name: '巨力',
    type: 'passive',
    desc: '練到一定程度的力量讓你的揮砍變得更具殺傷力。永久 +6 ATK +3 ACC。',
    unlockReq: { STR: 20 },
    expCosts:  { STR: 100, DEX: 50 },
    passiveBonus: { ATK: 6, ACC: 3 },
  },
  precision: {
    id: 'precision', name: '精準',
    type: 'passive',
    desc: '反覆訓練讓你的眼準、手穩，每一擊都打在對的位置。永久 +8 ACC +4 CRT。',
    unlockReq: { DEX: 20 },
    expCosts:  { DEX: 100, LUK: 50 },
    passiveBonus: { ACC: 8, CRT: 4 },
  },
  ironSkin: {
    id: 'ironSkin', name: '鐵皮',
    type: 'passive',
    desc: '長年受創讓你的軀體更加結實。永久 +25 HP上限 +3 DEF。',
    unlockReq: { CON: 20 },
    expCosts:  { CON: 150 },
    passiveBonus: { HPmax: 25, DEF: 3 },
  },
  quickStep: {
    id: 'quickStep', name: '疾風',
    type: 'passive',
    desc: '腳步輕盈、反應靈敏，難以捕捉也走得快。永久 +6 EVA +4 SPD。',
    unlockReq: { AGI: 20 },
    expCosts:  { AGI: 150 },
    passiveBonus: { EVA: 6, SPD: 4 },
  },
  calmMind: {
    id: 'calmMind', name: '靜心',
    type: 'passive',
    desc: '意志訓練讓你心緒穩定。戰鬥外心情衰減 -30%；狂熱中練錯屬性的擺爛機率 -50%。',
    unlockReq: { WIL: 20 },
    expCosts:  { WIL: 150 },
    passiveBonus: {},
    // 戰外效果由 main.js mood decay + compulsion.js fervor slack 讀 hasSkill('calmMind') 套用
    moodDecayMult:  0.70,   // 1.0 → 0.70（衰減 -30%）
    fervorSlackMult: 0.50,  // 15% → 7.5%（擺爛機率減半）
  },

  // ══════════════════════════════════════════════════
  // T2 被動 (req attr 30)
  // ══════════════════════════════════════════════════
  combo: {
    id: 'combo', name: '連擊',
    type: 'passive',
    desc: '靈巧與反應的配合讓你的攻擊變得連綿不絕。永久 +5 SPD +3 ATK。',
    unlockReq: { DEX: 30, AGI: 22 },
    expCosts:  { DEX: 220, AGI: 150, STR: 80 },
    passiveBonus: { SPD: 5, ATK: 3 },
  },
  counter: {
    id: 'counter', name: '反擊',
    type: 'passive',
    desc: '閃避成功時 35% 機率立刻揮出反擊（造成 ATK×0.8 傷害）。',
    unlockReq: { AGI: 30, DEX: 22 },
    expCosts:  { AGI: 250, DEX: 100, STR: 100 },
    passiveBonus: {},
    // 戰鬥端 hook 條件：
    //   _enemyTurn 中 r.hit === false（玩家成功閃避）→ roll 35% → 反擊 ATK×0.8
    onDodge: {
      chance:    0.35,
      dmgMult:   0.80,
    },
  },
  battleWill: {
    id: 'battleWill', name: '戰鬥意志',
    type: 'passive',
    desc: '殘血時意志反而更堅定。HP 低於 50% 時 +12 ATK +5 DEF。',
    unlockReq: { WIL: 30 },
    expCosts:  { WIL: 250, STR: 100, CON: 100 },
    passiveBonus: {},
    // 戰鬥端 hook：每次 _player.hp 變動後檢查 hp/_hpMax < 0.5 → 套 +12 ATK +5 DEF
    //   實作走 _getSkillBonus 的「conditional」分支（_battleWillActive 旗標）
    conditionalBonus: {
      conditionFn: 'hp_below_50',
      bonus: { ATK: 12, DEF: 5 },
    },
  },

  // ══════════════════════════════════════════════════
  // 🆕 2026-04-25 v10 監督官巴爺主線獎勵（劇情授予、不靠 EXP 購買）
  // ══════════════════════════════════════════════════
  unyielding: {
    id: 'unyielding', name: '不屈',
    type: 'passive',
    desc: '巴爺傳授的絕技。受到致命一擊時鎖死 1 HP 不死，之後 5 回合內傷害 +30%。整場戰鬥僅觸發 1 次。',
    storyOnly: true,
    grantedBy: 'overseer_passed_torch',
    passiveBonus: {},
    // 戰鬥端 hook（_applyDamage + _playerTurn + _endTurnCleanup_atb）：
    //   onLethalHit: 鎖 hp = 1, set _player._unyieldingFired = true, set buff turns = 5
    //   active 期間 _player.derived.ATK × 1.30
    //   每回合結束 buffTurns--、戰鬥開始時 reset
    onLethalHit: {
      hpFloor:      1,
      buffTurns:    5,
      atkMult:      1.30,
    },
  },
  veteran_eye: {
    id: 'veteran_eye', name: '老兵之眼',
    type: 'passive',
    desc: '看過太多場、看得出對手破綻。戰鬥開場永久 +15% ATK +5 CRT。',
    storyOnly: true,
    grantedBy: 'overseer_kept_secret',
    passiveBonus: {},
    // 戰鬥端 hook：start() / startFromConfig() 末端、戰鬥已建好 _player 後套
    //   _player.derived.ATK = round(_player.derived.ATK * 1.15)
    //   _player.derived.CRT = min(75, _player.derived.CRT + 5)
    onBattleStart: {
      atkMult:    1.15,
      critBonus:  5,
    },
  },

  // ══════════════════════════════════════════════════
  // ⚔ 主動技能（資料保留、戰鬥整合下階段）
  //   完整設計見 docs/discussions/2026-04-25-active-skills-plan.md
  // ══════════════════════════════════════════════════
  powerStrike: {
    id: 'powerStrike', name: '強力斬',
    type: 'active',
    desc: '蓄力一回合、下回合造成 ATK×2.0 傷害，無視 15 DEF。',
    mpCost: 0, staminaCost: 20, cooldown: 3,
    unlockReq: { STR: 30, fame: 200 },
    expCosts:  { STR: 300, AGI: 100, DEX: 50 },   // 主屬性 STR + 蓄力時機 AGI + 揮砍精準 DEX
    weaponClassAny: ['sword', 'blunt', 'axe'],    // 銳器/重器才能蓄力
    effect: { dmgMult: 2.0, penBonus: 15, chargeTurns: 1 },
  },
  taunt: {
    id: 'taunt', name: '嘲諷',
    type: 'active',
    desc: '強制目標 3 回合追打你，期間自身 +10 DEF +5 BLK。',
    staminaCost: 15, cooldown: 5,
    unlockReq: { CON: 30, WIL: 22 },
    expCosts:  { CON: 250, WIL: 150, STR: 50 },
    weaponClassAny: ['blunt', 'axe', 'spear'],   // 不適合匕首
    effect: { tauntTurns: 3, defBonus: 10, blkBonus: 5 },
  },
  riposte: {
    id: 'riposte', name: '反擊（主動）',
    type: 'active',
    desc: '預備姿態、被攻擊時格擋並立刻反擊 ATK×1.5。',
    staminaCost: 15, cooldown: 2,
    unlockReq: { DEX: 30, AGI: 22 },
    expCosts:  { DEX: 250, AGI: 100, STR: 100 },
    weaponClassAny: ['sword', 'spear', 'dagger'],
    effect: { dmgMult: 1.5, evaBonus: 30 },
  },
  warCry: {
    id: 'warCry', name: '戰吼',
    type: 'active',
    desc: '震懾敵人，自身 ATK +20%，持續 3 回合。',
    staminaCost: 10, cooldown: 5,
    unlockReq: { WIL: 30 },
    expCosts:  { WIL: 250, STR: 100 },
    effect: { atkPctBonus: 20, duration: 3 },
  },

  // ══════════════════════════════════════════════════
  // 🆕 2026-04-27 拳法系（盧基烏斯傳授）— T1 劇情授予
  // 詳見 docs/quests/lucius-empty-hand.md
  // 全部 weaponClass 'fist'、storyOnly: true
  // ══════════════════════════════════════════════════
  bareDisarm: {
    id: 'bareDisarm', name: '赤手奪刃',
    type: 'active',
    desc: '盧基烏斯傳授的 pankration 技。1 回合內被攻擊有 60% 完美格擋（無傷）。',
    staminaCost: 12, cooldown: 4,
    storyOnly: true,
    grantedBy: 'lucius_taught_disarm',
    weaponClassAny: ['fist'],
    effect: { blockChance: 0.60, stanceTurns: 1 },
  },
  leverageThrow: {
    id: 'leverageThrow', name: '借力反摔',
    type: 'active',
    desc: '盧基烏斯傳授的摔技。被攻擊時把傷害的 70% 反彈給對方（撐 1 回合）。',
    staminaCost: 18, cooldown: 5,
    storyOnly: true,
    grantedBy: 'lucius_taught_throw',
    weaponClassAny: ['fist'],
    effect: { reflectPct: 0.70, stanceTurns: 1 },
  },
  vitalStrike: {
    id: 'vitalStrike', name: '要害打擊',
    type: 'active',
    desc: '盧基烏斯傳授的危險絕技。命中後敵人下 2 回合無法用特技。',
    staminaCost: 15, cooldown: 4,
    storyOnly: true,
    grantedBy: 'lucius_taught_vital',
    weaponClassAny: ['fist'],
    effect: { silenceTurns: 2 },
  },
  jointBreaker: {
    id: 'jointBreaker', name: '關節破',
    type: 'active',
    desc: '攻擊膝肘關節。對 DEF ≥ 8 的敵人忽略一半 DEF。',
    staminaCost: 10, cooldown: 3,
    storyOnly: true,
    grantedBy: 'lucius_taught_joint',
    weaponClassAny: ['fist'],
    effect: { defPiercePct: 0.50 },
  },

  // ── 拳法 T2 自悟（招用 ≥ 8 次 + AGI ≥ 25 + EXP）──
  bareDisarm_t2: {
    id: 'bareDisarm_t2', name: '赤手奪刃 T2',
    type: 'active',
    desc: '熟練後的赤手奪刃。1 回合內被攻擊 80% 完美格擋 + 格擋成功時敵人 SPD -10%（1 回合）。',
    staminaCost: 12, cooldown: 4,
    storyOnly: true,                    // 不靠 EXP 買、靠自悟條件
    grantedBy: 'lucius_t2_disarm',
    weaponClassAny: ['fist'],
    series: 'bareDisarm', tier: 2,
    effect: { blockChance: 0.80, slowOnBlock: true },
  },
  leverageThrow_t2: {
    id: 'leverageThrow_t2', name: '借力反摔 T2',
    type: 'active',
    desc: '85% 傷害反彈。',
    staminaCost: 18, cooldown: 5,
    storyOnly: true,
    grantedBy: 'lucius_t2_throw',
    weaponClassAny: ['fist'],
    series: 'leverageThrow', tier: 2,
    effect: { reflectPct: 0.85 },
  },
  vitalStrike_t2: {
    id: 'vitalStrike_t2', name: '要害打擊 T2',
    type: 'active',
    desc: '命中後敵人 silence 3 回合 + 30% 機率敵人 ATK -20%（3 回合）。',
    staminaCost: 15, cooldown: 4,
    storyOnly: true,
    grantedBy: 'lucius_t2_vital',
    weaponClassAny: ['fist'],
    series: 'vitalStrike', tier: 2,
    effect: { silenceTurns: 3, atkDebuffChance: 0.30 },
  },
  jointBreaker_t2: {
    id: 'jointBreaker_t2', name: '關節破 T2',
    type: 'active',
    desc: '忽略所有 DEF（不論高低）。',
    staminaCost: 10, cooldown: 3,
    storyOnly: true,
    grantedBy: 'lucius_t2_joint',
    weaponClassAny: ['fist'],
    series: 'jointBreaker', tier: 2,
    effect: { defPiercePct: 1.0 },
  },

  // ── 拳法 T3 自悟（招用 ≥ 12 次 + AGI ≥ 30 + EXP）──
  bareDisarm_t3: {
    id: 'bareDisarm_t3', name: '赤手奪刃 T3',
    type: 'active',
    desc: '完全掌握。100% 完美格擋 + 格擋成功時敵人下回合無法用特技。',
    staminaCost: 12, cooldown: 4,
    storyOnly: true,
    grantedBy: 'lucius_t3_disarm',
    weaponClassAny: ['fist'],
    series: 'bareDisarm', tier: 3,
    effect: { blockChance: 1.0, silenceOnBlock: 1 },
  },
  leverageThrow_t3: {
    id: 'leverageThrow_t3', name: '借力反摔 T3',
    type: 'active',
    desc: '100% 傷害反彈 + 敵人下回合無法行動（重摔倒地）。',
    staminaCost: 18, cooldown: 5,
    storyOnly: true,
    grantedBy: 'lucius_t3_throw',
    weaponClassAny: ['fist'],
    series: 'leverageThrow', tier: 3,
    effect: { reflectPct: 1.0, stunTurns: 1 },
  },
  vitalStrike_t3: {
    id: 'vitalStrike_t3', name: '要害打擊 T3',
    type: 'active',
    desc: 'silence 4 回合 + 50% ATK -20% + 50% SPD -20%。',
    staminaCost: 15, cooldown: 4,
    storyOnly: true,
    grantedBy: 'lucius_t3_vital',
    weaponClassAny: ['fist'],
    series: 'vitalStrike', tier: 3,
    effect: { silenceTurns: 4, atkDebuffChance: 0.50, spdDebuffChance: 0.50 },
  },
  jointBreaker_t3: {
    id: 'jointBreaker_t3', name: '關節破 T3',
    type: 'active',
    desc: '忽略所有 DEF + 30% 機率敵人「斷手」（ATK -50% 持續至戰鬥結束）。',
    staminaCost: 10, cooldown: 3,
    storyOnly: true,
    grantedBy: 'lucius_t3_joint',
    weaponClassAny: ['fist'],
    series: 'jointBreaker', tier: 3,
    effect: { defPiercePct: 1.0, breakArmChance: 0.30 },
  },
};

// 🆕 2026-04-27 拳法系自悟對照表（T1 → T2 → T3）
//   給 lucius_events.js 升級邏輯用
const FIST_SKILL_TIERS = {
  bareDisarm:    { t1: 'bareDisarm',    t2: 'bareDisarm_t2',    t3: 'bareDisarm_t3' },
  leverageThrow: { t1: 'leverageThrow', t2: 'leverageThrow_t2', t3: 'leverageThrow_t3' },
  vitalStrike:   { t1: 'vitalStrike',   t2: 'vitalStrike_t2',   t3: 'vitalStrike_t3' },
  jointBreaker:  { t1: 'jointBreaker',  t2: 'jointBreaker_t2',  t3: 'jointBreaker_t3' },
};

// 🆕 2026-04-27 三杯藏球賭博：連 5 次全勝獎勵
Skills.luckyStar = {
  id: 'luckyStar', name: '幸運之星',
  type: 'passive',
  desc: '累計賭局全勝 5 次。LUK 永久 +5。',
  storyOnly: true,
  grantedBy: 'lucky_star_granted',
  passiveBonus: { LUK: 5 },
};

// 🆕 2026-04-27 T4 自創招式（玩家自己取名、效果由主導屬性決定）
//   實際 name + effect 在 player.luciusT4 = { name, dominant, effDesc }
//   battle.js 顯示時讀 player.luciusT4.name、效果讀 dominant
Skills.luciusT4 = {
  id: 'luciusT4', name: '✦ 自創拳法',
  type: 'active',
  desc: '你自創的拳法。盧基烏斯沒教、他師父也沒教。',
  staminaCost: 20, cooldown: 6,
  storyOnly: true,
  grantedBy: 'lucius_t4_created',
  weaponClassAny: ['fist'],
  series: 'luciusT4',
};
