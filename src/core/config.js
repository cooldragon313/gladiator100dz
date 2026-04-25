/**
 * config.js — Game tuning constants
 *
 * Part E.4 實作
 * ──────────────
 * 所有可調的遊戲數值常數集中在這裡，方便平衡調整。
 * 事件觸發機率、狀態閾值、各種倍率等都存在這個模組。
 *
 * **任何 const 都可以直接改數字調整遊戲平衡，不用改邏輯。**
 *
 * 載入順序：無依賴，放在最前面即可。
 */
const Config = (() => {

  // ══════════════════════════════════════════════════
  // 狀態閾值（Part E.4）
  // ══════════════════════════════════════════════════
  /**
   * 各數值的範圍等級。值越小越嚴重。
   * 用法：Config.getTier('food', food_value) 回傳等級名稱。
   *
   * 正常狀態 = 安靜自動；異常狀態 = 觸發選擇事件（Phase 1-D/E）
   */
  const THRESHOLDS = {
    food: {
      overStuffed: 85,   // ≥85 太飽 → 跳餐事件
      full:        60,   // 60~84 充足
      normal:      35,   // 35~59 正常
      hungry:      15,   // 15~34 餓（訓練效率 -20%）
      starving:     5,   // 5~14 飢餓（強制偷竊事件）
      critical:     0,   // ≤4 崩潰倒地
    },
    stamina: {
      overcharged: 90,   // ≥90 精力過剩 → 失眠事件
      high:        60,   // 60~89 充沛
      normal:      30,   // 30~59 正常
      tired:       15,   // 15~29 疲憊（擺爛事件可觸發）
      exhausted:    5,   // 5~14 力竭（強制休息）
      collapse:     0,   // ≤4 暈倒
    },
    mood: {
      euphoric:    80,   // ≥80 狀態爆發
      happy:       50,   // 50~79 正常
      normal:      25,   // 25~49 訓練效率 -15%
      sad:         10,   // 10~24 自暴自棄事件
      depressed:    0,   // ≤9 強制放棄訓練
    },
    hp: {
      healthy:     80,
      wounded:     50,
      hurt:        25,
      critical:    10,
      dying:        0,
    },
  };

  /**
   * 取得數值的等級名稱。
   *
   * @param {string} key    'food' | 'stamina' | 'mood' | 'hp'
   * @param {number} value  當前數值
   * @returns {string}      等級名稱（最高的符合項目）
   *
   * @example
   *   Config.getTier('food', 50);   // 'normal'
   *   Config.getTier('stamina', 8); // 'exhausted'
   */
  function getTier(key, value) {
    const tiers = THRESHOLDS[key];
    if (!tiers) return 'unknown';
    // 按值由大到小比對，回傳第一個符合的
    const order = Object.entries(tiers).sort((a, b) => b[1] - a[1]);
    for (const [name, threshold] of order) {
      if (value >= threshold) return name;
    }
    return order[order.length - 1]?.[0] || 'unknown';
  }

  // ══════════════════════════════════════════════════
  // 事件觸發機率（Part E.4）
  // ══════════════════════════════════════════════════
  /**
   * 各種事件的觸發條件和機率。
   * Phase 1-D/E 會實際讀取這些值。
   */
  const EVENT_TRIGGER_RATES = {
    // 跳餐（飽食度過高時）
    skip_meal: {
      condition: 'food_overStuffed',
      chance: 0.35,
    },

    // 飢餓（食物不足）
    hunger_minor: {
      condition: 'food_hungry',
      chance: 0.25,
    },
    hunger_critical: {
      condition: 'food_starving',
      chance: 1.0,     // 強制觸發
    },

    // 失眠（體力過剩）
    insomnia: {
      condition: 'stamina_overcharged && hour >= 22',
      chance: 0.30,
    },

    // 訓練擺爛（疲憊）
    training_slacker: {
      condition: 'stamina_tired && action == training',
      chance: 0.25,
    },
    fatigue_force: {
      condition: 'stamina_exhausted',
      chance: 1.0,
    },

    // 心情低落
    mood_slack: {
      condition: 'mood_sad && action == training',
      chance: 0.30,
    },
    mood_despair: {
      condition: 'mood_depressed',
      chance: 1.0,
    },

    // 心情爆發（正向）
    mood_flow: {
      condition: 'mood_euphoric && action == training',
      chance: 0.40,
    },

    // NPC 注意事件（Phase 1-F）
    // 累積 flag 達門檻後觸發派遣
    npc_notice_porter: {
      condition: 'flag_gte(gra_noticed_strength, 3)',
      chance: 0.4,   // 每天檢查的機率
    },
  };

  // ══════════════════════════════════════════════════
  // 戰鬥相關常數（未來 Phase 2 擴展）
  // ══════════════════════════════════════════════════
  const COMBAT = {
    // 身體部位傷害倍率（D.2 多部位裝備）
    BODY_PART_CRIT_MULT: {
      head:  1.5,
      body:  1.0,
      arms:  0.8,
      legs:  0.8,
    },

    // 雙持修正（D.11 武器副手系統）
    DUAL_WIELD_PENALTY: {
      ATK_MULT:   0.5,   // 副手武器 ATK × 50%
      ACC_DELTA: -5,
      SPD_DELTA: -3,
      BLK_ZERO:   true,  // BLK 強制 0
    },

    // 疤痕出現機率
    SCAR_CHANCE_BASE: 0.5,  // 重傷時的基礎機率
  };

  // ══════════════════════════════════════════════════
  // 經驗值成長曲線（D.6）
  // ══════════════════════════════════════════════════
  const EXP = {
    BASE_COST:   10,      // 屬性 10 → 11 的 EXP
    GROWTH_RATE: 1.15,    // 每升一級成本 × 1.15
    SOFT_CAP:    30,      // 屬性 30 後成本爆炸
  };

  /**
   * 計算某屬性從 level N 升到 N+1 需要的 EXP。
   */
  function expToNext(currentLevel) {
    return Math.ceil(EXP.BASE_COST * Math.pow(EXP.GROWTH_RATE, currentLevel - 10));
  }

  // ══════════════════════════════════════════════════
  // 金錢基準（Part E.8）
  // ══════════════════════════════════════════════════
  const MONEY = {
    LABOR_PORTER:   [3, 10],    // 搬貨報酬範圍
    LABOR_KITCHEN:  [3, 8],     // 廚房幫工
    LABOR_ERRAND:   [5, 5],     // 跑腿
    ARENA_CUT:      0.30,       // 玩家拿 30%，主人抽 70%
    ARENA_WIN_BASE: [30, 80],   // 一般勝利獎金範圍
    ARENA_WIN_MAJOR:[100, 200], // 重大勝利獎金範圍
  };

  // ══════════════════════════════════════════════════
  // 每日行為預設值
  // ══════════════════════════════════════════════════
  const DAILY = {
    // 用餐自動恢復量（Phase 1-B _resolveNonTrainingSlots 用）
    MEAL_FOOD_GAIN:   18,   // 🆕 2026-04-15 下調：原 25，讓食物變戰略資源而非自動滿血
    MEAL_MOOD_GAIN:    2,
    // 晚間休息自動恢復量
    REST_STAMINA_GAIN: 10,
    REST_MOOD_GAIN:     5,   // 🆕 2026-04-19：3→5（被動恢復更有感）
    // 夜間睡覺
    SLEEP_STAMINA_GAIN: 45,   // 🆕 D.26：移除「休息」動作後微調補償
    SLEEP_MOOD_GAIN:     5,
    SLEEP_FOOD_COST:   -15,   // 🆕 2026-04-15 加重：原 -12
  };

  // ══════════════════════════════════════════════════
  // NPC 注意系統閾值（Phase 1-F）
  // ══════════════════════════════════════════════════
  const NPC_NOTICE = {
    // NPC 會「看到」玩家表現的門檻
    GRA_STRENGTH_THRESHOLD: 15,   // STR ≥ 15 時葛拉注意到
    MELA_AGILITY_THRESHOLD: 15,   // AGI ≥ 15 時梅拉注意到
    OFFICER_FAME_THRESHOLD: 20,   // 名聲 ≥ 20 時長官注意到

    // 累積幾次後觸發派遣事件
    NOTICE_TRIGGER_COUNT: 3,
  };

  // ══════════════════════════════════════════════════
  // 特性定義（Phase 1-D 視覺系統）
  // ══════════════════════════════════════════════════
  /**
   * 特性 ID → { name, category, desc }
   * category: 'positive' | 'negative'
   * 病痛獨立存放在 AILMENT_DEFS，不在這裡。
   */
  const TRAIT_DEFS = {
    // ── 積極特性 ─────────────────────────────────
    kindness: {
      id: 'kindness', name: '寬厚', category: 'positive',
      desc: '對他人的善意讓你更容易獲得好感。隊友好感成長速度 +20%。',
    },
    diligence: {
      id: 'diligence', name: '勤勉', category: 'positive',
      desc: '日復一日的耕作讓你學會耐心與堅持。所有屬性訓練 EXP +10%。',
    },
    iron_will: {
      id: 'iron_will', name: '鐵意志', category: 'positive',
      desc: '意志力超乎常人，在極端壓力下仍能保持冷靜。WIL 訓練效率 +15%。',
    },
    survivor: {
      id: 'survivor', name: '戰場老兵', category: 'positive',
      desc: '見過太多生死，稍微能看穿對手的意圖。競技場 ACC +3。',
    },
    unbreakable: {
      id: 'unbreakable', name: '不屈之身', category: 'positive',
      desc: 'HP 跌至 20% 以下時，攻擊力 +15%。',
    },
    // 🆕 D.12 / D.13 新增：解鎖睡前活動與故事共鳴
    literate: {
      id: 'literate', name: '識字', category: 'positive',
      desc: '奴隸中罕見的能力。睡前可以讀書、寫日記；能讀懂牆上的字、信件、地圖。',
    },
    silverTongue: {
      id: 'silverTongue', name: '巧舌', category: 'positive',
      desc: '天生的說書人。睡前可以說故事給隊友聽，提升隊友好感。',
    },
    // ── 負面特性 ─────────────────────────────────
    reckless: {
      id: 'reckless', name: '急躁', category: 'negative',
      desc: '容易衝動行事，訓練時受傷機率 +5%。',
    },
    shaken: {
      id: 'shaken', name: '信心崩潰', category: 'negative',
      desc: '近期的失敗打擊了你的自信。所有屬性訓練效率 −10%。',
    },
    // 🆕 D.12 / D.13 新增：負面但能觸發共鳴故事
    neurotic: {
      id: 'neurotic', name: '神經質', category: 'negative',
      desc: '夜裡易驚醒，正向好感成長 −20%。但能察覺別人察覺不到的細微事物——夜間故事觸發機率 ×1.5。',
    },
    brooding: {
      id: 'brooding', name: '鬱結', category: 'negative',
      desc: '容易陷入往事。心情恢復 −20%，但獨自沉思時偶爾會觸發深層記憶。',
    },

    // ══════════════════════════════════════════════════
    // 🆕 D.19 道德累積特性（10 個，5 對相反）— earned 類
    // ── 透過玩家選擇累積獲得（滑動窗口 N=3），窗口全同向就獲得，
    //    一次反向就失去。關鍵事件 push 3 筆直接定型。
    // ── 軸：reliability / mercy / loyalty / pride / patience
    // ══════════════════════════════════════════════════
    reliable: {
      id: 'reliable', name: '可靠', category: 'positive',
      moralAxis: 'reliability', moralSide: 'positive',
      desc: '關鍵時刻能扛住重量的人。隊友在你身邊會感到安心。',
    },
    coward: {
      id: 'coward', name: '膽小鬼', category: 'negative',
      moralAxis: 'reliability', moralSide: 'negative',
      desc: '關鍵時刻你選擇了逃開。別人看你的眼神不一樣了。',
    },
    merciful: {
      id: 'merciful', name: '仁慈', category: 'positive',
      moralAxis: 'mercy', moralSide: 'positive',
      desc: '即使在血腥的競技場，你仍選擇手下留情。',
    },
    cruel: {
      id: 'cruel', name: '殘忍', category: 'negative',
      moralAxis: 'mercy', moralSide: 'negative',
      desc: '你學會了把每一刀砍到底。對某些人這是生存，對某些人這是墮落。',
    },
    loyal: {
      id: 'loyal', name: '忠誠', category: 'positive',
      moralAxis: 'loyalty', moralSide: 'positive',
      desc: '維護夥伴不離不棄。朋友把背交給你。',
    },
    opportunist: {
      id: 'opportunist', name: '投機', category: 'negative',
      moralAxis: 'loyalty', moralSide: 'negative',
      desc: '立場會隨風轉。沒人敢把秘密交給你。',
    },
    humble: {
      id: 'humble', name: '謙卑', category: 'positive',
      moralAxis: 'pride', moralSide: 'positive',
      desc: '知道自己的位置。長官喜歡不愛出風頭的鬥士。',
    },
    prideful: {
      id: 'prideful', name: '驕傲', category: 'negative',
      moralAxis: 'pride', moralSide: 'negative',
      desc: '你覺得自己與眾不同。別人覺得你討人厭。',
    },
    patient: {
      id: 'patient', name: '耐心', category: 'positive',
      moralAxis: 'patience', moralSide: 'positive',
      desc: '懂得等待時機。在競技場，這可能是最強的武器。',
    },
    impulsive: {
      id: 'impulsive', name: '衝動', category: 'negative',
      moralAxis: 'patience', moralSide: 'negative',
      desc: '看到就想動手，聽到就想反擊。還沒學會停下來。',
    },

    // ══════════════════════════════════════════════════
    // 🆕 2026-04-19 出生特性（軸組互斥，1% 獨立擲骰）
    // ── 智力軸 / 體質軸 / 運勢軸 / 心性軸 / 天賦軸
    // ══════════════════════════════════════════════════

    // ── 智力軸 ─────────────────────────────
    genius: {
      id: 'genius', name: '天才', category: 'positive',
      birthAxis: 'intelligence', birthSide: 'positive', isRare: true,
      desc: '大腦比一般人快兩拍。訓練 EXP +15%，WIL +2，能看懂複雜對話，讀書吸收更快。',
    },
    dullard_lucky: {
      id: 'dullard_lucky', name: '傻人傻福', category: 'positive',
      birthAxis: 'intelligence', birthSide: 'positive', isRare: true,
      desc: '你笑嘻嘻的走過這世界。訓練慢（EXP −15%）、不識字、WIL −2，但 LUK 三取最高、奇遇 +80%、笑躲攻擊 20%、暴擊 +15%、永不絕望。',
    },
    dull: {
      id: 'dull', name: '愚鈍', category: 'negative',
      birthAxis: 'intelligence', birthSide: 'negative', isRare: true,
      desc: '腦袋轉得慢。訓練 EXP −10%、WIL −3、難以識字、對話選項減少。',
    },

    // ── 體質軸 ─────────────────────────────
    ironclad: {
      id: 'ironclad', name: '鐵人', category: 'positive',
      birthAxis: 'constitution', birthSide: 'positive', isRare: true,
      desc: '生來就是硬殼子。CON +3、HP 上限 +15%、疾病抗性 +50%、受傷不留疤。',
    },
    sickly: {
      id: 'sickly', name: '病弱', category: 'negative',
      birthAxis: 'constitution', birthSide: 'negative', isRare: true,
      desc: '從小就容易病。CON −3、疾病抗性 −50%、隨機患病機率 +30%。',
    },

    // ── 運勢軸 ─────────────────────────────
    fortunate: {
      id: 'fortunate', name: '福星高照', category: 'positive',
      birthAxis: 'luck', birthSide: 'positive', isRare: true,
      desc: 'LUK +3、奇遇事件觸發率 +50%、受傷時 20% 機率減輕為輕傷。',
    },
    cursed: {
      id: 'cursed', name: '厄運之子', category: 'negative',
      birthAxis: 'luck', birthSide: 'negative', isRare: true,
      desc: 'LUK −3、奇遇事件觸發率 −50%、暴擊受傷機率 +10%。',
    },

    // ── 心性軸 ─────────────────────────────
    blessed: {
      id: 'blessed', name: '神眷之子', category: 'positive',
      birthAxis: 'spirit', birthSide: 'positive', isRare: true,
      desc: '冥冥中有人看著你。好感倍率 ×1.2、mood 下限 +10、絕望抵抗。道德崩壞可能失去。',
    },
    shadowed: {
      id: 'shadowed', name: '暗影纏身', category: 'negative',
      birthAxis: 'spirit', birthSide: 'negative', isRare: true,
      desc: '黑影跟著你。好感倍率 ×0.8、mood 下限 −10、信徒與神職者怕你。',
    },

    // ── 天賦軸 ─────────────────────────────
    born_warrior: {
      id: 'born_warrior', name: '天生戰士', category: 'positive',
      birthAxis: 'gift', birthSide: 'positive', isRare: true,
      desc: '血液裡就有戰鬥的節奏。戰鬥首回合 ATK +20%、怯戰抵抗、戰鬥 EXP +10%。',
    },
    cowardly: {
      id: 'cowardly', name: '膽小如鼠', category: 'negative',
      birthAxis: 'gift', birthSide: 'negative', isRare: true,
      desc: '打鬥時手發抖。戰鬥首回合 ATK −10%、受傷時可能失控逃跑。',
    },

    // ══════════════════════════════════════════════════
    // 🆕 2026-04-19 讀書系統衍生特性
    // ══════════════════════════════════════════════════
    cunning: {
      id: 'cunning', name: '狡智', category: 'positive',
      desc: '讀過奧德修斯的故事後學會不用拳頭也能贏。對話選項 +1、故事揭露線索 +1。',
    },
    faithful: {
      id: 'faithful', name: '虔誠', category: 'positive',
      desc: '相信更大的東西。mood 下限 +5、神殿事件獎勵 ×1.5。',
    },
    brave: {
      id: 'brave', name: '勇敢', category: 'positive',
      desc: '面對死亡不退一步。戰鬥首回合 ATK +10%、抵抗絕望。',
    },
    partial_literate: {
      id: 'partial_literate', name: '粗識文字', category: 'positive',
      desc: '讀過點書但沒讀透。解鎖少數文字對話選項。傻福玩家半醒期選擇停留獲得。',
    },

    // ══════════════════════════════════════════════════
    // 🆕 2026-04-24 狂熱（Fervor，取代舊 _addict 強迫症）
    //   暫時性正面特性：狂熱結束時自動移除（temporary:true）
    //   觸發：5 天內同屬性訓練 8 次（自然）/ 屬性 19→20 等瓶頸（儀式）
    //   加成：練對屬性 EXP +25% / mood +5；練別的 mood -5 + 擺爛
    //   結束：對應訓練累積 5 次
    // ══════════════════════════════════════════════════
    STR_fervor: {
      id: 'STR_fervor', name: '力量狂熱', category: 'positive',
      fervorAttr: 'STR', temporary: true,
      desc: '你正在突破——推舉石頭 EXP +25% / mood +5。練別的會分心：mood -5 + 15% 擺爛。對應訓練累積 5 次結束。',
    },
    DEX_fervor: {
      id: 'DEX_fervor', name: '靈巧狂熱', category: 'positive',
      fervorAttr: 'DEX', temporary: true,
      desc: '你正在突破——投接碎石 EXP +25% / mood +5。練別的會分心：mood -5 + 15% 擺爛。對應訓練累積 5 次結束。',
    },
    AGI_fervor: {
      id: 'AGI_fervor', name: '反應狂熱', category: 'positive',
      fervorAttr: 'AGI', temporary: true,
      desc: '你正在突破——亂棍格擋 EXP +25% / mood +5。練別的會分心：mood -5 + 15% 擺爛。對應訓練累積 5 次結束。',
    },
    CON_fervor: {
      id: 'CON_fervor', name: '體質狂熱', category: 'positive',
      fervorAttr: 'CON', temporary: true,
      desc: '你正在突破——杖擊承受 EXP +25% / mood +5。練別的會分心：mood -5 + 15% 擺爛。對應訓練累積 5 次結束。',
    },
    WIL_fervor: {
      id: 'WIL_fervor', name: '意志狂熱', category: 'positive',
      fervorAttr: 'WIL', temporary: true,
      desc: '你正在突破——打坐冥想 EXP +25% / mood +5。練別的會分心：mood -5 + 15% 擺爛。對應訓練累積 5 次結束。',
    },
  };

  // ══════════════════════════════════════════════════
  // 病痛定義（Phase 1-D）
  // ══════════════════════════════════════════════════
  /**
   * 病痛 ID → 定義物件。
   * category 永遠是 'ailment'，與 traits 的 'positive'/'negative' 區分。
   *
   * passiveOnRest   : 每個 'rest' 時段自動扣除（type: vital）
   * sleepStaminaMax : 就寢體力恢復上限（覆蓋 DAILY.SLEEP_STAMINA_GAIN）
   * injuryPartBonus : { parts:[...], bonus: 0.xx } 訓練受傷機率加成
   */
  const AILMENT_DEFS = {
    insomnia_disorder: {
      id:       'insomnia_disorder',
      name:     '失眠症',
      category: 'ailment',
      desc:     '長期失眠傷及神經。夜晚無法充分休息，體力持續流失，心情難以穩定。',
      // 每個 rest 時段被動消耗
      passiveOnRest: { stamina: -3, mood: -3 },
      // 就寢體力恢復上限（正常為 DAILY.SLEEP_STAMINA_GAIN = 40）
      sleepStaminaMax: 15,
      // 解除條件：連續 3 天正常睡眠
      cureCondition: 'sleep_normal_streak_3',
    },
    arm_injury: {
      id:       'arm_injury',
      name:     '手臂受傷',
      category: 'ailment',
      desc:     '傷口未癒，手臂相關訓練受傷機率 +15%。',
      injuryPartBonus: { parts: ['手臂', '手部'], bonus: 0.15 },
    },
    leg_injury: {
      id:       'leg_injury',
      name:     '腿部受傷',
      category: 'ailment',
      desc:     '腿傷未癒，腿部相關訓練受傷機率 +15%，敏捷訓練效率 −20%。',
      injuryPartBonus: { parts: ['腿部'], bonus: 0.15 },
    },
    torso_injury: {
      id:       'torso_injury',
      name:     '軀幹挫傷',
      category: 'ailment',
      desc:     '肋骨與腹部的瘀傷讓每次呼吸都很痛。體力訓練效率 −20%。',
      injuryPartBonus: { parts: ['軀幹'], bonus: 0.10 },
    },
    // 以下為占位定義，Phase 2+ 補充完整效果
    concussion: {
      id:       'concussion',
      name:     '腦震盪',
      category: 'ailment',
      desc:     '頭部受到重擊，視野模糊，命中率與反應下降。',
      // Phase 2 補：combatPenalty
    },
    achilles_tear: {
      id:       'achilles_tear',
      name:     '阿基里斯腱撕裂',
      category: 'ailment',
      desc:     '腳跟的傷讓你舉步維艱。速度大幅下降，腿部訓練幾乎不可能。',
      // Phase 2 補
    },
    depression: {
      id:       'depression',
      name:     '憂鬱症',
      category: 'ailment',
      desc:     '深層的黑暗蔓延整個精神。心情上限降低，訓練效率全面下降。',
      // Phase 2 補：moodCapReduction
    },
  };

  // ══════════════════════════════════════════════════
  // Debug
  // ══════════════════════════════════════════════════
  function dump() {
    console.group('[Config] 遊戲常數');
    console.log('THRESHOLDS:',          THRESHOLDS);
    console.log('EVENT_TRIGGER_RATES:', EVENT_TRIGGER_RATES);
    console.log('COMBAT:',              COMBAT);
    console.log('EXP:',                 EXP);
    console.log('MONEY:',               MONEY);
    console.log('DAILY:',               DAILY);
    console.log('NPC_NOTICE:',          NPC_NOTICE);
    console.log('TRAIT_DEFS:',          TRAIT_DEFS);
    console.log('AILMENT_DEFS:',        AILMENT_DEFS);
    console.groupEnd();
  }

  // ══════════════════════════════════════════════════
  // 公開介面
  // ══════════════════════════════════════════════════
  return {
    THRESHOLDS,
    EVENT_TRIGGER_RATES,
    COMBAT,
    EXP,
    MONEY,
    DAILY,
    NPC_NOTICE,
    TRAIT_DEFS,
    AILMENT_DEFS,
    // Helpers
    getTier,
    expToNext,
    dump,
  };
})();
