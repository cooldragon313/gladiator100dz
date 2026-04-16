/**
 * morning_thoughts.js — 晨思系統（D.21）
 * ══════════════════════════════════════════════════
 * 主角「醒來的第一個念頭」系統。
 * 每天早上掃描當前狀態，冒出一句符合情境的內心獨白。
 *
 * 這個系統同時解決：
 *   1. 懸念記憶（前一天看到的事，隔日在腦中延續）
 *   2. 新手教學（把按鍵、機制、解法偽裝成主角的自言自語）
 *   3. 狀態解析（玩家不知道病痛/特性/心情的影響？主角會抱怨）
 *   4. 預感伏筆（祭典將近、大事將至）
 *   5. 反思儀式（屬性破門檻、天數里程碑）
 *   6. 每天晨起的情緒節拍（哪怕沒條件也有預設念頭）
 *
 * 資料結構（每條 thought）：
 *   {
 *     id:           unique string
 *     type:         'mystery' | 'social' | 'foreboding' | 'anticipation'
 *                   | 'body'  | 'mood'   | 'reflection'  | 'default'
 *     priority:     number (higher = more important)
 *     condition:    (player) => boolean
 *     thoughts:     [string, ...]      依 shownCount 輪播
 *     maxShowCount: number (default 2)
 *     decayAfter:   number | null  // 觸發後 N 天自動不再出現
 *     once:         boolean        // 一次性（true）
 *     onShow:       (player) => {} // 播放時回呼（例：設反思 flag）
 *     resolvedBy:   'flag_id'      // 某 flag 設定時結束本 thought
 *   }
 *
 * 優先度分層：
 *   100 · mystery（未解懸念，剛發生）
 *    95 · resolution（剛解決的懸念，溫暖回收）
 *    80 · anticipation（大活動即將發生）
 *    70 · social（剛獲得的道德特性反應）
 *    65 · foreboding（末期氛圍）
 *    45 · body（病痛/受傷）
 *    30 · mood（極端情緒）
 *    25 · reflection（里程碑）
 *    10 · default（fallback 預設念頭）
 *
 * 依賴：Stats, Flags
 * 載入順序：stats.js / flags.js 之後，main.js 之前
 */
const MorningThoughts = (() => {

  const REGISTRY = [];
  let   STATE = {
    shownCounts:     {},    // { id: count }
    lastShownDay:    {},    // { id: day }
    pendingResolve:  [],    // 已 resolve 但還沒回收播出的 thought id queue
  };

  // ══════════════════════════════════════════════════
  // 註冊
  // ══════════════════════════════════════════════════
  function define(thought) {
    if (!thought || !thought.id) return;
    REGISTRY.push(thought);
  }

  function defineMany(arr) {
    (arr || []).forEach(define);
  }

  // ══════════════════════════════════════════════════
  // 核心：挑出今天該出現的 thought
  // ══════════════════════════════════════════════════
  function pickToday(player) {
    if (!player) return null;

    // 先檢查 resolution queue — 有回收就優先播
    if (STATE.pendingResolve.length > 0) {
      const id = STATE.pendingResolve.shift();
      const t = REGISTRY.find(x => x.id === id);
      if (t) return t;
    }

    const candidates = REGISTRY.filter(t => {
      // maxShowCount 檢查
      const count = STATE.shownCounts[t.id] || 0;
      if (count >= (t.maxShowCount || 2)) return false;
      // decayAfter 檢查（超過 N 天沒播就不再出現）
      if (t.decayAfter && STATE.lastShownDay[t.id]) {
        const daysSince = player.day - STATE.lastShownDay[t.id];
        if (daysSince > t.decayAfter) return false;
      }
      // resolvedBy 檢查 — 已經解決就別播了
      if (t.resolvedBy && typeof Flags !== 'undefined' && Flags.has(t.resolvedBy)) {
        return false;
      }
      // condition 檢查
      if (typeof t.condition === 'function') {
        try { if (!t.condition(player)) return false; }
        catch (e) { console.warn('[MorningThoughts] condition error', t.id, e); return false; }
      }
      return true;
    });

    if (candidates.length === 0) return null;

    // 排序：priority 高者優先，同 priority 取未播過的
    candidates.sort((a, b) => {
      const pa = (b.priority || 0) - (a.priority || 0);
      if (pa !== 0) return pa;
      const ca = (STATE.shownCounts[a.id] || 0) - (STATE.shownCounts[b.id] || 0);
      return ca;
    });

    return candidates[0];
  }

  // ══════════════════════════════════════════════════
  // 取得這條 thought 的目前文字（依輪播次數）
  // ══════════════════════════════════════════════════
  function getLine(thought) {
    if (!thought || !Array.isArray(thought.thoughts) || thought.thoughts.length === 0) return '';
    const count = STATE.shownCounts[thought.id] || 0;
    const idx = Math.min(count, thought.thoughts.length - 1);
    return thought.thoughts[idx];
  }

  // ══════════════════════════════════════════════════
  // 標記為已顯示
  // ══════════════════════════════════════════════════
  function markShown(thought, player) {
    if (!thought) return;
    STATE.shownCounts[thought.id] = (STATE.shownCounts[thought.id] || 0) + 1;
    STATE.lastShownDay[thought.id] = player ? player.day : 0;
    if (typeof thought.onShow === 'function') {
      try { thought.onShow(player); } catch (e) { console.warn('[MorningThoughts] onShow error', e); }
    }
  }

  // ══════════════════════════════════════════════════
  // 手動排入 resolution（某事件解決後，之後某天自動播回收）
  // ══════════════════════════════════════════════════
  function queueResolution(thoughtId) {
    if (!STATE.pendingResolve.includes(thoughtId)) {
      STATE.pendingResolve.push(thoughtId);
    }
  }

  // ══════════════════════════════════════════════════
  // 存檔
  // ══════════════════════════════════════════════════
  function serialize() {
    return JSON.parse(JSON.stringify(STATE));
  }

  function restore(data) {
    if (!data) return;
    STATE.shownCounts     = data.shownCounts     || {};
    STATE.lastShownDay    = data.lastShownDay    || {};
    STATE.pendingResolve  = data.pendingResolve  || [];
  }

  function reset() {
    STATE = { shownCounts:{}, lastShownDay:{}, pendingResolve:[] };
  }

  // ══════════════════════════════════════════════════
  // ══════════════════════════════════════════════════
  // 初始 thought 庫（首發 ~40 條）
  // ══════════════════════════════════════════════════
  // ══════════════════════════════════════════════════

  // ── 🆕 索爾的記憶（Day 5 考驗後） ──
  defineMany([
    {
      id: 'sol_memory_day6',
      type: 'mystery',
      priority: 100,
      condition: p => Flags.has('sol_dead') && p.day === (Flags.get('sol_died_day', 5) + 1),
      maxShowCount: 1,
      thoughts: [
        '你想起索爾把乾肉遞給你時的表情。他知道的。他一直都知道。——如果你的意志再堅定一點，或許三個人都能活著走出來。',
      ],
    },
    {
      id: 'sol_memory_day7',
      type: 'mystery',
      priority: 95,
      condition: p => Flags.has('sol_dead') && p.day === (Flags.get('sol_died_day', 5) + 2),
      maxShowCount: 1,
      thoughts: [
        '索爾的鋪位空了。沒有人來收拾。你看著那個位置發了很久的呆。他有個女兒——五歲。',
      ],
    },
    {
      id: 'sol_memory_lingering',
      type: 'mystery',
      priority: 60,
      condition: p => Flags.has('sol_dead') && p.day >= (Flags.get('sol_died_day', 5) + 5) && p.day <= 20,
      maxShowCount: 3,
      decayAfter: 15,
      thoughts: [
        '你偶爾還是會想起索爾。他在這裡的時間那麼短——但他留下的重量，你還背著。',
        '五歲的女孩在等一個永遠不會回家的父親。你沒辦法告訴她。',
        '你現在比索爾強了。但這個念頭讓你覺得……空。',
      ],
    },
    // 英雄路線（三人都活）的特別晨思
    {
      id: 'sol_survived_pride',
      type: 'reflection',
      priority: 80,
      condition: p => Flags.has('sol_survived_trial') && p.day <= 8,
      maxShowCount: 1,
      thoughts: [
        '三個人都活下來了。你做到了。索爾看你的眼神不一樣了——裡面有一種你不太習慣的東西。信任。',
      ],
    },
  ]);

  // ── 🆕 懸念型（mystery）── 最高優先度，前一天的事件延續 ──
  defineMany([
    // 奧蘭藥房懸念：看到他在醫療房前 → 隔天開始在腦中延續
    {
      id: 'mystery_olan_apothecary',
      type: 'mystery',
      priority: 100,
      condition: p => {
        if (typeof Flags === 'undefined') return false;
        if (!Flags.has('saw_olan_at_apothecary')) return false;
        if (Flags.has('olan_apothecary_resolved')) return false;
        // 只有看到的隔天開始才播
        const seenDay = Flags.get('olan_apothecary_seen_day', 0);
        return p.day > seenDay;
      },
      maxShowCount: 3,
      decayAfter: 7,
      thoughts: [
        '奧蘭叫醒你，笑得像什麼都沒發生過。但昨天那個在醫療房前慌張的身影……你還記得。',
        '你又看著奧蘭。他今天特別勤奮——是在轉移話題嗎？',
        '奧蘭依然笑著。你沒問過，他也沒提過。但那個畫面還沒散。',
      ],
    },
    // 藥房懸念解決回收（resolvedBy 不設，改由 queueResolution 推入 pendingResolve 佇列）
    {
      id: 'recall_olan_apothecary',
      type: 'mystery',
      priority: 95,
      // 從 queueResolution() 觸發，condition 放寬
      condition: () => true,
      maxShowCount: 1,
      thoughts: [
        '昨夜奧蘭把那包藥草塞進你枕頭下。你睡前摸了摸。他其實不必那樣冒險的。',
      ],
    },
  ]);

  // ── 預感型（foreboding）── 末期氛圍 ──
  defineMany([
    {
      id: 'festival_approaching_80',
      type: 'foreboding',
      priority: 70,
      condition: p => p.day >= 80 && p.day < 90,
      maxShowCount: 3,
      thoughts: [
        '還剩二十天……你不敢細算，但身體算得比你準。',
        '訓練場外的天色變了。是真的變了，還是你自己變了？',
        '祭典越來越近。你開始在半夜無來由地醒。',
      ],
    },
    {
      id: 'festival_approaching_90',
      type: 'foreboding',
      priority: 75,
      condition: p => p.day >= 90,
      maxShowCount: 4,
      thoughts: [
        '日子不多了。你數著還剩幾個早晨。',
        '再過幾天你就要站在那片沙地上。你準備好了嗎？',
        '你不害怕——不完全是。但胸口有種說不出的緊。',
        '該做的事都該做了。明天，一切會不一樣。',
      ],
    },
  ]);

  // ── 身體型（body）── 病痛與受傷 ──
  defineMany([
    {
      id: 'body_insomnia',
      type: 'body',
      priority: 45,
      condition: p => Array.isArray(p.ailments) && p.ailments.includes('insomnia_disorder'),
      maxShowCount: 4,
      thoughts: [
        '該死……昨晚又沒睡好。今天肯定累死。或許——該找個醫生談談？',
        '頭痛得像被槌子敲。失眠這種東西，總得有辦法處理吧？',
        '眼皮重得像鉛塊。不能再這樣下去了。',
        '你已經忘記上次一覺到天亮是什麼感覺。',
      ],
    },
    {
      id: 'body_arm_injury',
      type: 'body',
      priority: 50,
      condition: p => Array.isArray(p.ailments) && p.ailments.includes('arm_injury'),
      maxShowCount: 3,
      thoughts: [
        '手臂一碰就痛……這樣下去沒辦法訓練。或許葛拉能幫我看看，或者醫生？',
        '手還沒好。每一次揮動都像有針在肉裡鑽。',
        '你咬牙試著握緊拳頭。手顫抖著。',
      ],
    },
    {
      id: 'body_leg_injury',
      type: 'body',
      priority: 50,
      condition: p => Array.isArray(p.ailments) && p.ailments.includes('leg_injury'),
      maxShowCount: 3,
      thoughts: [
        '走路都一跛一跛的。再這樣下去別說訓練——連逃跑都跑不動。',
        '腿上的傷痛得像火。你想到該找醫生。',
        '你試著走一步。牙齒咬緊。',
      ],
    },
    {
      id: 'body_torso_injury',
      type: 'body',
      priority: 50,
      condition: p => Array.isArray(p.ailments) && p.ailments.includes('torso_injury'),
      maxShowCount: 3,
      thoughts: [
        '每一次呼吸都像有人往肋骨踹一腳。這傷真的可以自己好嗎？',
        '胸口抽痛。你嘗試深呼吸——更痛了。',
      ],
    },
    {
      id: 'body_exhausted',
      type: 'body',
      priority: 35,
      condition: p => (p.stamina || 0) <= 15,
      maxShowCount: 3,
      decayAfter: 3,
      thoughts: [
        '你感覺身體被榨乾了。今天最好不要硬撐——休息是投資，不是偷懶。',
        '手臂抬不起來。該給自己喘一下。',
      ],
    },
    {
      id: 'body_hungry',
      type: 'body',
      priority: 40,
      condition: p => (p.food || 0) <= 20,
      maxShowCount: 3,
      decayAfter: 3,
      thoughts: [
        '肚子咕嚕嚕叫。你知道——餓著肚子訓練，效率會掉很多。',
        '你想到梅拉——她有時候會悄悄多塞一口飯給你。也許今天……',
      ],
    },
  ]);

  // ── 社交型（social）── 新獲得的道德特性 ──
  defineMany([
    {
      id: 'social_cruel',
      type: 'social',
      priority: 70,
      condition: p => Array.isArray(p.traits) && p.traits.includes('cruel'),
      maxShowCount: 3,
      decayAfter: 8,
      thoughts: [
        '昨天不過砍了個人頭——可今天大家看你的眼神都不一樣了。梅拉連盛飯都不敢多看你一眼。',
        '訓練場上那幾個年輕的奴隸看見你就讓路。你應該覺得得意——但胸口有種奇怪的空。',
        '你聽見背景有人在背後嘀咕。他們沒說什麼，但你知道。',
      ],
    },
    {
      id: 'social_merciful',
      type: 'social',
      priority: 65,
      condition: p => Array.isArray(p.traits) && p.traits.includes('merciful'),
      maxShowCount: 2,
      decayAfter: 8,
      thoughts: [
        '梅拉今天盛飯時抬頭看了你一眼。她沒笑，但那個眼神你看得懂。',
        '達吉站得比平時更靠近你一點。年輕人還沒學會掩飾崇拜。',
      ],
    },
    {
      id: 'social_reliable',
      type: 'social',
      priority: 65,
      condition: p => Array.isArray(p.traits) && p.traits.includes('reliable'),
      maxShowCount: 2,
      decayAfter: 8,
      thoughts: [
        '奧蘭今天看你的眼神比平時更軟了一點。你不確定為什麼——但你知道自己做過什麼。',
        '卡西烏斯第一次對你點了點頭。他從來不跟任何人點頭的。',
      ],
    },
    {
      id: 'social_coward',
      type: 'social',
      priority: 70,
      condition: p => Array.isArray(p.traits) && p.traits.includes('coward'),
      maxShowCount: 3,
      decayAfter: 8,
      thoughts: [
        '奧蘭今天問你睡得好不好——那種小心翼翼的口吻。他知道你心裡有個結。',
        '你聽見背景有幾個人在講話。他們沒有指名道姓，但你知道在說你。',
        '你試著回憶昨天做的決定。你告訴自己那是對的——但鏡子裡的自己說不是。',
      ],
    },
    {
      id: 'social_opportunist',
      type: 'social',
      priority: 68,
      condition: p => Array.isArray(p.traits) && p.traits.includes('opportunist'),
      maxShowCount: 3,
      decayAfter: 8,
      thoughts: [
        '老篤今天沒跟你說話。他幾天前還會。',
        '你覺得自己每走一步都有眼睛在盯著。這裡的人不笨。',
      ],
    },
    {
      id: 'social_prideful',
      type: 'social',
      priority: 55,
      condition: p => Array.isArray(p.traits) && p.traits.includes('prideful'),
      maxShowCount: 2,
      thoughts: [
        '你抬頭挺胸走過走廊。他們應該看著。他們應該記住你是誰。',
      ],
    },
    {
      id: 'social_humble',
      type: 'social',
      priority: 55,
      condition: p => Array.isArray(p.traits) && p.traits.includes('humble'),
      maxShowCount: 2,
      thoughts: [
        '你走得比平時更輕。這裡的每個人都有他們自己的重量——你不是唯一的。',
      ],
    },
    {
      id: 'social_loyal',
      type: 'social',
      priority: 55,
      condition: p => Array.isArray(p.traits) && p.traits.includes('loyal'),
      maxShowCount: 2,
      thoughts: [
        '你想到昨天那個選擇。你不後悔——有些事，做過就是做了。',
      ],
    },
    {
      id: 'social_patient',
      type: 'social',
      priority: 55,
      condition: p => Array.isArray(p.traits) && p.traits.includes('patient'),
      maxShowCount: 2,
      thoughts: [
        '慢慢來。你現在比昨天更懂這個道理。',
      ],
    },
    {
      id: 'social_impulsive',
      type: 'social',
      priority: 60,
      condition: p => Array.isArray(p.traits) && p.traits.includes('impulsive'),
      maxShowCount: 2,
      decayAfter: 8,
      thoughts: [
        '你想起昨天那一下——沒多想就做了。那是對的嗎？你說不準。',
      ],
    },
  ]);

  // ── 情緒型（mood）── 極端情緒 ──
  defineMany([
    {
      id: 'mood_high',
      type: 'mood',
      priority: 25,
      condition: p => (p.mood || 0) >= 80,
      maxShowCount: 2,
      thoughts: [
        '心情奇好。你甚至不記得上次這樣是什麼時候。',
        '身體還痛著，但奇怪——今天什麼都想試試看。',
      ],
    },
    {
      id: 'mood_crash',
      type: 'mood',
      priority: 55,
      condition: p => (p.mood || 0) <= 20,
      maxShowCount: 3,
      decayAfter: 4,
      thoughts: [
        '什麼都不想動。連拿起劍都覺得重。',
        '昨夜夢見過去。醒來之後——你寧願不要醒。',
        '希望這世界沒有這些煩躁的事情。',
      ],
    },
  ]);

  // ── 反思型（reflection）── 里程碑 ──
  defineMany([
    {
      id: 'reflect_day_10',
      type: 'reflection',
      priority: 30,
      condition: p => p.day === 10,
      once: true, maxShowCount: 1,
      onShow: () => Flags && Flags.set('reflected_day_10'),
      thoughts: ['十天。你還活著。以前你從沒想過這會是成就。'],
    },
    {
      id: 'reflect_day_30',
      type: 'reflection',
      priority: 35,
      condition: p => p.day === 30,
      maxShowCount: 1,
      thoughts: ['三十天。你開始分不清楚訓練場的味道和家裡的味道了。'],
    },
    {
      id: 'reflect_day_50',
      type: 'reflection',
      priority: 40,
      condition: p => p.day === 50,
      maxShowCount: 1,
      thoughts: ['已經五十天了。一半。你還記得進來那天的自己——但那個人已經不太像你了。'],
    },
    {
      id: 'reflect_str_20',
      type: 'reflection',
      priority: 25,
      condition: p => (p.STR || 0) >= 20 && !(Flags && Flags.has('reflected_str_20')),
      maxShowCount: 1,
      onShow: () => Flags && Flags.set('reflected_str_20'),
      thoughts: ['你的手臂已經記得每一個揮劍的角度。進來的第一天，你連劍柄都握不穩。'],
    },
    {
      id: 'reflect_weak_arms',
      type: 'reflection',
      priority: 28,
      condition: p => p.day >= 15 && (p.STR || 0) < 12,
      maxShowCount: 2,
      decayAfter: 6,
      thoughts: [
        '你的手臂還是那麼瘦。力氣——太小了。你該不該花更多時間練 STR？',
      ],
    },
    {
      id: 'reflect_slow',
      type: 'reflection',
      priority: 28,
      condition: p => p.day >= 20 && (p.fame || 0) < 10,
      maxShowCount: 2,
      decayAfter: 6,
      thoughts: [
        '你是不是太慢了？別人都在前進，你還在原地。但「慢」不等於「錯」——也許。',
      ],
    },
  ]);

  // ── 期待型（anticipation）── 重大活動暗示 ──
  defineMany([
    // 暗示「認真訓練有獎勵」
    {
      id: 'anticipation_train_hint',
      type: 'anticipation',
      priority: 72,
      condition: p => p.day <= 3 && !Flags.has('chose_starting_weapon')
                   && Flags.get('training_action_count', 0) < 4,
      maxShowCount: 2,
      thoughts: [
        '或許該認真點……聽說表現好的人，主人都會給獎勵。',
        '你注意到監督官有時候會多看勤奮訓練的人幾眼。那代表什麼？',
      ],
    },
    // 暗示「快到門檻了」
    {
      id: 'anticipation_almost_weapon',
      type: 'anticipation',
      priority: 78,
      condition: p => !Flags.has('chose_starting_weapon')
                   && Flags.get('training_action_count', 0) >= 4
                   && Flags.get('training_action_count', 0) < 6,
      maxShowCount: 2,
      thoughts: [
        '監督官今天多看了你幾眼。是好事還是壞事？',
        '你隱約覺得監督官昨天跟侍從說了什麼——他看你的眼神變了。',
      ],
    },
    // 考驗即將到來
    {
      id: 'anticipation_first_trial',
      type: 'anticipation',
      priority: 80,
      condition: p => p.day >= 3 && p.day < 5,
      maxShowCount: 2,
      thoughts: [
        '聽說再過幾天就要考驗了。你握了握拳——準備好了嗎？',
        '考驗快到了。訓練場上的眼神都變了。',
      ],
    },
    // 拿到武器後的感受
    {
      id: 'anticipation_weapon_new',
      type: 'anticipation',
      priority: 75,
      condition: p => Flags.has('chose_starting_weapon') && p.day <= 5,
      maxShowCount: 1,
      thoughts: [
        '手裡多了武器之後，連走路都覺得不一樣。它有它的重量——那重量就是你的命。',
      ],
    },
  ]);

  // ── 預設型（default）── 日數分段的預設念頭 ──
  defineMany([
    {
      id: 'default_day_1_5',
      type: 'default',
      priority: 10,
      condition: p => p.day <= 5,
      maxShowCount: 99,
      thoughts: [
        '或許今天該做點什麼……',
        '這裡是哪裡？你還想問——但沒人會回答。',
        '又是一天。你還沒習慣這個味道。',
        '你還記得昨夜的夢嗎？',
      ],
    },
    {
      id: 'default_day_6_20',
      type: 'default',
      priority: 10,
      condition: p => p.day >= 6 && p.day <= 20,
      maxShowCount: 99,
      thoughts: [
        '又是一天。',
        '身體比昨天好一點了……也許。',
        '該起來了。',
        '你聽見雞叫——原來這裡也有雞。',
        '起床吧。動起來就會暖。',
      ],
    },
    {
      id: 'default_day_21_50',
      type: 'default',
      priority: 10,
      condition: p => p.day >= 21 && p.day <= 50,
      maxShowCount: 99,
      thoughts: [
        '訓練場的味道你已經熟悉。',
        '再多撐幾天，或許就習慣了。',
        '陽光從窗縫透進來，跟昨天一樣。',
        '又一天，你還活著。這不是理所當然的。',
      ],
    },
    {
      id: 'default_day_51_79',
      type: 'default',
      priority: 10,
      condition: p => p.day >= 51 && p.day <= 79,
      maxShowCount: 99,
      thoughts: [
        '還剩多少天？你試著不去算。',
        '你不一樣了。你知道。',
        '起床。再一天。',
        '胸口有種說不出來的感覺。',
      ],
    },
  ]);

  return {
    define,
    defineMany,
    pickToday,
    getLine,
    markShown,
    queueResolution,
    serialize,
    restore,
    reset,
  };
})();
