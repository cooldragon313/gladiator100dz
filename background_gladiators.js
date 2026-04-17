/**
 * background_gladiators.js — 背景角鬥士池（D.18）
 * ══════════════════════════════════════════════════
 * 非劇情的填充 NPC，僅用於訓練協力加成與訓練場氛圍。
 *
 * 與 npc.js 的命名 NPC 差異：
 *   - 沒有 storyReveals / 專屬事件 / 關係圖卡片
 *   - 沒有多段好感；採「熟悉度通過與否」二元判定
 *   - 每日隨機抽 2-4 人出現在訓練場
 *   - 各自有 favoredAttr，只對該屬性訓練提供 ×1.3
 *   - 熟悉度（familiarity）每次同場訓練 +1，到 FAMILIAR_THRESHOLD 開始生效
 *
 * 訓練所差異化：
 *   各訓練所在 fields.js 可指定 favorWeight，改變背景人員抽取分佈。
 *   例：標準訓練所 { CON:3, WIL:3, STR:2, DEX:1, AGI:1 } → CON/WIL 派背景更常見。
 *
 * 存檔：serialize() / restore() 由 save_system.js 整合。
 */
const BackgroundGladiators = (() => {

  // ══════════════════════════════════════════════════
  // 池子定義（10 名，覆蓋 5 屬性各 2 人）
  // 每人有：
  //   shoutLines      — 個性吼叫（和 SHOUT_POOLS 屬性池合併抽）
  //   signatureGossip — 個人簽名八卦（1 句，只有本人會講）
  //                     🔮 未來：某些「故事 key gossip」可由 2+ 人共同持有，
  //                     避免某天該 NPC 不在場玩家就永遠聽不到。例：梅拉姪子在哪個訓練所。
  // ══════════════════════════════════════════════════
  const POOL = [
    { id:'bg_marcus', name:'馬可斯', favoredAttr:'STR',
      shoutLines:['再用力一點！','肌肉是男人的勳章！','再來十下！'],
      signatureGossip:'我練這個是為了我弟有天能抬起頭。' },
    { id:'bg_tirus',  name:'提魯斯', favoredAttr:'STR',
      shoutLines:['別讓木樁笑你！','揮到手臂發酸才算數！','用力，鬥士！'],
      signatureGossip:'拳頭是我唯一還剩下的東西了。' },
    { id:'bg_felix',  name:'菲利克斯', favoredAttr:'DEX',
      shoutLines:['對準中心。','手要穩。','一刀命中要害。'],
      signatureGossip:'我以前是扒手，手要準才能活著。' },
    { id:'bg_dakos',  name:'達可斯', favoredAttr:'DEX',
      shoutLines:['看準再出手。','冷靜。','呼吸沉下來。'],
      signatureGossip:'我表哥說啊，西邊的訓練所每月有真正的肉吃。' },
    { id:'bg_brenn',  name:'布倫', favoredAttr:'CON',
      shoutLines:['撐住！','再跑一圈！','呼吸，呼吸。'],
      signatureGossip:'我老婆說我什麼都不會，就是耐打。' },
    { id:'bg_orak',   name:'歐拉克', favoredAttr:'CON',
      shoutLines:['鐵打的身體！','不准停！','再撐一下。'],
      signatureGossip:'聽說阿圖斯大人欠了一筆大債。' },
    { id:'bg_sella',  name:'塞拉', favoredAttr:'AGI',
      shoutLines:['腳步放輕！','別被地面綁住！','滑過去！'],
      signatureGossip:'這雙腿跑過三個郡的緝捕令。' },
    { id:'bg_veyr',   name:'維爾', favoredAttr:'AGI',
      shoutLines:['像風一樣！','快！','再快一點。'],
      signatureGossip:'昨晚有人從北邊帶回奇怪的消息，沒人敢講。' },
    { id:'bg_silas',  name:'賽拉斯', favoredAttr:'WIL',
      shoutLines:['心要靜。','別被雜念拖垮。','專注。'],
      signatureGossip:'你不覺得塔倫長官最近心情特別差嗎？' },
    { id:'bg_kuro',   name:'庫羅', favoredAttr:'WIL',
      shoutLines:['意志高於肉體。','堅持下去。','內心不要動搖。'],
      signatureGossip:'我師父說意志是唯一他們帶不走的東西。' },
  ];

  // 預設抽取權重（訓練所沒定義 favorWeight 時用）
  const DEFAULT_WEIGHT = { STR:2, DEX:2, CON:2, AGI:2, WIL:2 };

  // ══════════════════════════════════════════════════
  // 屬性共享碎念池（每屬性 10 句）
  // 任何該屬性的背景角鬥士都可以說這些話 —
  // 個別 POOL 成員的 shoutLines 則是他們的「個性台詞」，與此池合併隨機
  // ══════════════════════════════════════════════════
  // 每屬性 20 句正經 + 3 句白癡話（每人身邊總有幾個）
  const SHOUT_POOLS = {
    STR: [
      // — 正經 20 —
      '再用力！','手臂不是裝飾！','肌肉才是真的！','再揮十下！','出力——！',
      '別軟下去！','把它打爛！','再來！再來！','這才像話。','對，就是這樣用力！',
      '膝蓋彎，腰沉！','這才是我認識的鬥士！','骨頭會記得！','用全身的重量！','用腰出力！',
      '再狠一點！','這樣才像個男人！','天啊看那個揮速！','這不是揉麵團！','拿出吃奶的力氣！',
      // — 白癡話 3 —
      '看到沒？這才叫肌肉。','他媽的我剛剛手滑了。','打到他媽都認不出他！',
    ],
    DEX: [
      // — 正經 20 —
      '準度！準度！','看準再下手。','呼吸，穩住。','偏了，修正。','對準中心。',
      '冷靜，別急。','一擊斃命！','手不要抖。','眼睛盯著。','就是那裡！',
      '半寸也不能偏！','快速復位！','看招不如看破綻！','手腕柔一點！','讓出手看不見！',
      '握緊，但不要死握！','準頭是吃出來的！','慢下來，反而更準！','就差一絲！再一次！','穩、快、準。',
      // — 白癡話 3 —
      '呃，剛才那一下是故意的。','我瞄準的是木樁，不是我的腳。','看——我的手沒抖，是地在抖。',
    ],
    CON: [
      // — 正經 20 —
      '撐住！','再跑一圈！','呼吸！呼吸！','不准停！','撐過這段就是你的。',
      '身體記住這個痛！','再五下！','站起來，還沒完！','鐵打的身體！','活下去靠這個！',
      '喘氣均勻！','不痛不是訓練！','肌肉會哭，但不會斷！','再一組就休息！','吐氣！吐氣！',
      '別趴下！','這點算什麼？','我昨天做兩倍！','把身體當成石頭！','明天還要來一次！',
      // — 白癡話 3 —
      '我吃過三個人份的晚餐。','等等，我剛剛呼吸忘了。','疼痛只是大腦的幻覺——（然後倒下）',
    ],
    AGI: [
      // — 正經 20 —
      '快！再快一點！','腳步放輕！','像風一樣！','滑過去！','閃！閃！閃！',
      '別被黏住！','流動！','再快一秒！','輕巧點！','動起來！',
      '別黏在原地！','腳尖著地！','像貓！像貓！','節奏！節奏！','重心低一點！',
      '別讓他抓住時機！','感覺風的方向！','再轉一次！','輕、快、準。','這樣才叫會動！',
      // — 白癡話 3 —
      '我腳底被釘子扎到了，等等。','別看我，我只是在伸展。','我不是慢，是在節省體力。',
    ],
    WIL: [
      // — 正經 20 —
      '心要靜。','專注。','別被雜念拖垮。','意志高於肉體。','內心不動搖。',
      '堅持下去。','呼吸沉入丹田。','坐得穩。','心一橫，就過了。','這是意志的戰場。',
      '把雜念吞下去。','心中有山。','不動如山，動如風。','痛苦是通道，不是牆。','眼閉起來也能看見。',
      '意念先於動作。','守一念，破千劫。','心定，則萬物靜。','你在這裡，就是意志。','想著你要成為的人。',
      // — 白癡話 3 —
      '我昨晚夢到自己會飛，這算意志嗎？','我剛剛開悟了——等等，忘了。','別想太多——不對，要想，但不要想這個。',
    ],
  };

  // ══════════════════════════════════════════════════
  // 公共八卦池（15% 機率取代屬性碎念）
  // 作用：在不實作 D.17 謠言系統前，透過背景人員漸進地讓玩家知道「外面還有世界」
  // 原則：沒有真實資訊、都是「聽說」— 為未來解鎖其他訓練所/世界狀態預埋印象
  // 註：4 條有明確角色色彩的八卦已移到 POOL 各成員的 signatureGossip
  // ══════════════════════════════════════════════════
  const GOSSIP_POOL = [
    '聽說鐵獄的傢伙都是跟熊摔跤長大的。',
    '聽說西區那間訓練所的裝備比我們好十倍。',
    '北邊那間訓練所連飯都不給，只吃生肉。',
    '聽說首都那間訓練所，地板是大理石的。',
    '隔壁訓練所的主人最近換人了，聽說更兇。',
    '紫瓊訓練所？那地方出來的人眼神都不一樣。',
    '外面好像又打仗了，難怪最近新貨多。',
    '他們說今年祭典規模會比去年大。',
    '上個冠軍據說還活著，被送到什麼神秘地方去了。',
    '今天的豆子味道不對，是不是廚娘心情不好？',
    '聽說皇帝最近特別愛看斬首。',
  ];

  const GOSSIP_CHANCE   = 0.15;    // 碎念中有 15% 機率改講八卦
  const SIGNATURE_RATIO = 0.30;    // 八卦中有 30% 機率講自己的簽名八卦

  // 熟悉度門檻與加成
  const FAMILIAR_THRESHOLD = 40;
  const SYNERGY_MULT       = 1.3;
  const DAILY_MIN          = 2;
  const DAILY_MAX          = 4;

  // ══════════════════════════════════════════════════
  // Runtime state（save 到存檔）
  // ══════════════════════════════════════════════════
  const familiarity = {};          // { bgId: 0~100 }
  let   activeToday = [];          // 今日在場的 id 陣列
  let   lastRollDay = -1;

  POOL.forEach(bg => { familiarity[bg.id] = 0; });

  // ══════════════════════════════════════════════════
  // 每日抽取
  // ══════════════════════════════════════════════════
  function rollDaily(day, facilityWeight) {
    if (lastRollDay === day) return;
    lastRollDay = day;

    const weight = facilityWeight || DEFAULT_WEIGHT;
    const count  = DAILY_MIN + Math.floor(Math.random() * (DAILY_MAX - DAILY_MIN + 1));

    // 加權抽樣（不重複）
    const pool = POOL.map(bg => ({ bg, w: (weight[bg.favoredAttr] || 1) }));
    activeToday = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const totalW = pool.reduce((s, e) => s + e.w, 0);
      let r = Math.random() * totalW;
      for (let j = 0; j < pool.length; j++) {
        r -= pool[j].w;
        if (r <= 0) {
          activeToday.push(pool[j].bg.id);
          pool.splice(j, 1);
          break;
        }
      }
    }
  }

  function getActiveToday() {
    return activeToday
      .map(id => POOL.find(b => b.id === id))
      .filter(Boolean);
  }

  function get(id) {
    return POOL.find(b => b.id === id) || null;
  }

  function getFamiliarity(id) {
    return familiarity[id] || 0;
  }

  function isFamiliar(id) {
    return (familiarity[id] || 0) >= FAMILIAR_THRESHOLD;
  }

  // ══════════════════════════════════════════════════
  // 每次訓練讓今日在場的背景人員 +1 熟悉度
  // ══════════════════════════════════════════════════
  // 🆕 通過熟悉度門檻時的打招呼台詞（隨機選一句）
  const PARTNER_GREETINGS = [
    '嘿！我喜歡跟你一起訓練的感覺。以後我們多努力吧！',
    '你練得越來越好了——我可不想被你甩開。',
    '感覺跟你訓練的時候特別帶勁。繼續吧，夥伴。',
    '我覺得我們合得來。別問為什麼——直覺。',
    '嘿，你是叫……算了，名字不重要。重要的是你練得不錯。',
  ];

  function bumpOnTraining() {
    const newPartners = [];
    activeToday.forEach(id => {
      const before = familiarity[id] || 0;
      familiarity[id] = Math.min(100, before + 1);
      // 剛好跨過門檻 → 記下來
      if (before < FAMILIAR_THRESHOLD && familiarity[id] >= FAMILIAR_THRESHOLD) {
        newPartners.push(id);
      }
    });
    return newPartners;   // 回傳剛成為夥伴的 id 列表
  }

  // ══════════════════════════════════════════════════
  // 碎念 / 吶喊系統
  // ══════════════════════════════════════════════════
  // 從背景人員的「個性台詞 + 屬性共享池」合併隨機選一句
  function _pickLineFor(bg) {
    if (!bg) return null;
    const pool = SHOUT_POOLS[bg.favoredAttr] || [];
    const personal = bg.shoutLines || [];
    const merged = personal.concat(pool);
    if (!merged.length) return null;
    return merged[Math.floor(Math.random() * merged.length)];
  }

  // 每次訓練：從今日在場的背景中隨機挑一人碎念一句
  // 15% 機率改講八卦，其中 30% 機率是該角色的個人簽名八卦
  function getMumble() {
    if (activeToday.length === 0) return null;
    const id = activeToday[Math.floor(Math.random() * activeToday.length)];
    const bg = get(id);
    if (!bg) return null;
    // 八卦優先判定
    if (Math.random() < GOSSIP_CHANCE) {
      // 30% 機率講個人簽名（如果有的話）
      if (bg.signatureGossip && Math.random() < SIGNATURE_RATIO) {
        return { id, name: bg.name, line: bg.signatureGossip, isGossip: true, isSignature: true };
      }
      // 其餘從公共池抽
      if (GOSSIP_POOL.length) {
        const line = GOSSIP_POOL[Math.floor(Math.random() * GOSSIP_POOL.length)];
        return { id, name: bg.name, line, isGossip: true };
      }
    }
    const line = _pickLineFor(bg);
    if (!line) return null;
    return { id, name: bg.name, line };
  }

  /**
   * 協力吶喊：當訓練屬性與某背景人員匹配且已通過熟悉度時，取得他們的吶喊
   * @param {string} trainedAttr  訓練的屬性 key
   * @param {number} maxCount     最多回傳幾句（預設 2）
   * @returns {Array<{id,name,line}>}
   */
  function getSynergyShouts(trainedAttr, maxCount = 2) {
    if (!trainedAttr) return [];
    const contributors = activeToday
      .map(id => get(id))
      .filter(bg => bg && bg.favoredAttr === trainedAttr && isFamiliar(bg.id));
    if (!contributors.length) return [];
    // 洗牌
    const shuffled = [...contributors].sort(() => Math.random() - 0.5);
    const out = [];
    for (let i = 0; i < Math.min(maxCount, shuffled.length); i++) {
      const bg = shuffled[i];
      const line = _pickLineFor(bg);
      if (line) out.push({ id: bg.id, name: bg.name, line });
    }
    return out;
  }

  // 向下相容的舊 API（保留以防別處還在呼叫）
  function getRandomShout() {
    return getMumble();
  }

  // ══════════════════════════════════════════════════
  // 存檔整合
  // ══════════════════════════════════════════════════
  function serialize() {
    return {
      familiarity: { ...familiarity },
      activeToday: [...activeToday],
      lastRollDay,
    };
  }

  function restore(data) {
    if (!data) return;
    if (data.familiarity) {
      POOL.forEach(bg => {
        if (typeof data.familiarity[bg.id] === 'number') {
          familiarity[bg.id] = data.familiarity[bg.id];
        }
      });
    }
    if (Array.isArray(data.activeToday)) activeToday = [...data.activeToday];
    if (typeof data.lastRollDay === 'number') lastRollDay = data.lastRollDay;
  }

  function reset() {
    POOL.forEach(bg => { familiarity[bg.id] = 0; });
    activeToday = [];
    lastRollDay = -1;
  }

  function getPartnerGreeting() {
    return PARTNER_GREETINGS[Math.floor(Math.random() * PARTNER_GREETINGS.length)];
  }

  return {
    POOL,
    SHOUT_POOLS,
    FAMILIAR_THRESHOLD,
    SYNERGY_MULT,
    getPartnerGreeting,
    rollDaily,
    getActiveToday,
    get,
    getFamiliarity,
    isFamiliar,
    bumpOnTraining,
    getMumble,
    getSynergyShouts,
    getRandomShout,
    serialize,
    restore,
    reset,
  };
})();
