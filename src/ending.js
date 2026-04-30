/**
 * ending.js — Ending sequences
 *
 * 使用方式（瀏覽器 console 測試）:
 *   Endings.test('survivor')
 *   Endings.test('death')
 *
 * 或直接開啟 測試業面/ending_test.html
 */
const Endings = (() => {

  // ── Inject CSS once ───────────────────────────────────
  let _styleInjected = false;
  function _injectStyle() {
    if (_styleInjected) return;
    _styleInjected = true;
    const s = document.createElement('style');
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700;900&display=swap');

      #ending-overlay {
        position: fixed; inset: 0; z-index: 9999;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        background: #000;
        opacity: 0; transition: opacity 1.6s ease;
        overflow: hidden;
        font-family: 'Noto Serif TC', Georgia, serif;
      }
      #ending-overlay.e-visible { opacity: 1; }

      /* ── particles ── */
      .e-particles { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
      .e-p-gold {
        position:absolute; border-radius:50%;
        animation: e-rise linear infinite;
      }
      @keyframes e-rise {
        0%   { transform:translateY(0) translateX(0); opacity:0; }
        10%  { opacity:1; }
        90%  { opacity:.8; }
        100% { transform:translateY(-110vh) translateX(var(--drift)); opacity:0; }
      }
      .e-p-blood {
        position:absolute; top:0; width:2px;
        border-radius:0 0 3px 3px;
        background:linear-gradient(180deg,#8b0000,rgba(80,0,0,0));
        animation: e-drip linear infinite;
      }
      @keyframes e-drip {
        0%   { height:0; opacity:0; }
        15%  { opacity:1; }
        100% { height:var(--h); opacity:0; }
      }

      /* ── vignette ── */
      .e-vignette {
        position:absolute; inset:0;
        background:radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(0,0,0,.75) 100%);
        pointer-events:none;
      }

      /* ── text box ── */
      .e-box {
        position:relative; z-index:1;
        max-width:640px; width:90vw;
        padding:40px 32px; text-align:center;
        max-height:90vh; overflow-y:auto;
      }

      /* ── title ── */
      .e-title {
        font-size:36px; font-weight:900;
        letter-spacing:.3em; margin-bottom:32px;
        opacity:0; transform:translateY(-20px);
        transition:opacity 1s ease, transform 1s ease;
      }
      .e-title.e-show { opacity:1; transform:translateY(0); }

      /* ── lines ── */
      .e-line {
        font-size:26px; line-height:2.1; color:#c8b898;
        margin-bottom:2px;
        opacity:0; transform:translateY(8px);
        transition:opacity .65s ease, transform .65s ease;
      }
      .e-line.e-show { opacity:1; transform:translateY(0); }
      .e-line.e-gap  { height:14px; }
      .e-line.e-speech { font-size:18px; font-style:italic; color:#e8d8b0; }
      .e-line.e-hi    { font-size:20px; font-weight:700; letter-spacing:.08em; }
      .e-line.e-big   { font-size:26px; font-weight:900; letter-spacing:.3em; margin-top:18px; }

      /* ── button ── */
      .e-btn {
        display:inline-block; margin-top:40px;
        padding:12px 44px;
        background:transparent;
        font-family:inherit; font-size:15px; letter-spacing:.25em;
        cursor:pointer;
        opacity:0; transition:opacity .6s ease, background .2s;
        border:1px solid currentColor;
      }
      .e-btn.e-show { opacity:1; }
      .e-btn:hover { background:rgba(255,255,255,.08); }

      /* ── survivor ── */
      .e-survivor .e-title { color:#d4af37; text-shadow:0 0 24px rgba(212,175,55,.55); }
      .e-survivor .e-btn   { color:#d4af37; }

      /* ── death ── */
      .e-death .e-title { color:#8b0000; text-shadow:0 0 20px rgba(139,0,0,.7); }
      .e-death .e-btn   { color:#6a4040; }
    `;
    document.head.appendChild(s);
  }

  // ── Helpers ───────────────────────────────────────────
  function _overlay(cls) {
    document.getElementById('ending-overlay')?.remove();
    const el = document.createElement('div');
    el.id = 'ending-overlay';
    el.className = cls;
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('e-visible')));
    return el;
  }

  function _particles(overlay, type, n) {
    const wrap = document.createElement('div');
    wrap.className = 'e-particles';
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      const dur  = (Math.random() * 7 + 4).toFixed(1) + 's';
      const del  = -(Math.random() * 10).toFixed(1) + 's';
      const left = (Math.random() * 100).toFixed(1) + '%';
      if (type === 'gold') {
        p.className = 'e-p-gold';
        const sz = (Math.random() * 4 + 2).toFixed(1);
        const col = Math.random() > .5 ? '#FFD700' : '#FFA040';
        p.style.cssText = `
          width:${sz}px;height:${sz}px;
          background:${col};
          box-shadow:0 0 ${+sz*2}px ${col};
          bottom:-6px;left:${left};
          animation-duration:${dur};animation-delay:${del};
          --drift:${((Math.random()-.5)*100).toFixed(0)}px;
        `;
      } else {
        p.className = 'e-p-blood';
        const h = (Math.random() * 160 + 60).toFixed(0);
        p.style.cssText = `
          left:${left};
          animation-duration:${dur};animation-delay:${del};
          --h:${h}px;
        `;
      }
      wrap.appendChild(p);
    }
    overlay.appendChild(wrap);
  }

  function _glow(overlay, color) {
    const g = document.createElement('div');
    g.style.cssText = `
      position:absolute;inset:0;pointer-events:none;
      background:radial-gradient(ellipse 65% 55% at 50% 100%, ${color} 0%, transparent 70%);
      opacity:0;transition:opacity 2.5s ease;
    `;
    overlay.appendChild(g);
    setTimeout(() => g.style.opacity = 1, 1000);
    return g;
  }

  /**
   * Reveal lines one by one.
   * @param {HTMLElement} box
   * @param {Array<{text,cls}>} lines
   * @param {number} startDelay  ms
   * @param {number} step        ms per line
   * @returns {number} delay after last line
   */
  function _revealLines(box, lines, startDelay = 1000, step = 600) {
    lines.forEach((l, i) => {
      const el = document.createElement('div');
      el.className = 'e-line' + (l.cls ? ' ' + l.cls : '');
      if (l.cls === 'e-gap') {
        box.appendChild(el);
        return;
      }
      el.innerHTML = l.text;
      box.appendChild(el);
      setTimeout(() => el.classList.add('e-show'), startDelay + i * step);
    });
    return startDelay + lines.length * step;
  }

  function _addTitle(box, text, delay) {
    const el = document.createElement('div');
    el.className = 'e-title';
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.classList.add('e-show'), delay);
  }

  function _addButton(box, label, delay, onClick) {
    const btn = document.createElement('button');
    btn.className = 'e-btn';
    btn.textContent = label;
    btn.onclick = onClick;
    box.appendChild(btn);
    setTimeout(() => btn.classList.add('e-show'), delay);
  }

  // ── SURVIVOR ENDING ──────────────────────────────────
  function survivorEnding(playerName) {
    _injectStyle();
    const ov = _overlay('e-survivor');
    _glow(ov, 'rgba(180,120,0,.28)');
    _particles(ov, 'gold', 55);
    const vg = document.createElement('div');
    vg.className = 'e-vignette';
    ov.appendChild(vg);

    const box = document.createElement('div');
    box.className = 'e-box';
    ov.appendChild(box);

    _addTitle(box, '萬骸祭・生存者', 700);

    const lines = [
      { text: '競技場沙地之上，屍骸如山。' },
      { text: '你喘著氣，右手握著顫動的刀——' },
      { text: '最後一刀落下，最後一個敵人的頭顱滾落沙地。' },
      { cls: 'e-gap' },
      { text: '你緩緩抬起頭，' },
      { text: '用盡最後的力氣，將那顆首級高高舉起。' },
      { text: '一聲撕裂空氣的怒吼，從你喉嚨深處衝出——' },
      { cls: 'e-gap' },
      { text: '觀眾席，沸騰了。', cls: 'e-hi' },
      { cls: 'e-gap' },
      { text: '掌聲、歡呼聲、哭喊聲，' },
      { text: '鋪天蓋地砸在你血跡斑斑的身上。' },
      { cls: 'e-gap' },
      { text: '領主緩緩站起，微微頷首。' },
      { text: '那個眼神，你這輩子不會忘記。' },
      { cls: 'e-gap' },
      { text: '主人看著領主的臉，嘴角浮現出你從未見過的笑容。' },
      { text: '他整理袍服，慢慢走到人群面前——' },
      { cls: 'e-gap' },
      { text: `「<strong>${playerName}</strong>，我們的最後生存者，帶給我們無比的歡樂！`, cls: 'e-speech' },
      { text: '今天，我們偉大的領主，', cls: 'e-speech' },
      { text: '將賜予他——回歸 <strong>自由</strong> 的權利！」', cls: 'e-speech' },
      { cls: 'e-gap' },
      { text: '人群的呼聲，再次衝破天際。', cls: 'e-hi' },
      { cls: 'e-gap' },
      { text: '你站在那片沙地中央，' },
      { text: '第一次感覺到，腳下不再是牢籠。' },
    ];

    let d = _revealLines(box, lines, 1400, 560);

    // Freedom stamp
    const free = document.createElement('div');
    free.className = 'e-line e-big';
    free.style.color = '#d4af37';
    free.style.textShadow = '0 0 22px rgba(212,175,55,.6)';
    free.textContent = '— 自　由 —';
    box.appendChild(free);
    setTimeout(() => free.classList.add('e-show'), d + 200);

    _addButton(box, '重回塵世', d + 1400, () => {
      ov.style.opacity = 0;
      setTimeout(() => ov.remove(), 1600);
    });
  }

  // ── DEATH ENDING ─────────────────────────────────────
  function deathEnding(playerName) {
    _injectStyle();

    // Red flash
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;z-index:9998;background:#8b0000;opacity:.75;transition:opacity 1.3s ease;pointer-events:none;';
    document.body.appendChild(flash);
    requestAnimationFrame(() => requestAnimationFrame(() => flash.style.opacity = 0));
    setTimeout(() => flash.remove(), 1400);

    setTimeout(() => {
      const ov = _overlay('e-death');
      _particles(ov, 'blood', 22);
      const vg = document.createElement('div');
      vg.className = 'e-vignette';
      ov.appendChild(vg);

      const box = document.createElement('div');
      box.className = 'e-box';
      ov.appendChild(box);

      _addTitle(box, '戰　死', 500);

      const lines = [
        { text: '沙地是溫的。' },
        { cls: 'e-gap' },
        { text: '你不知道自己什麼時候倒下的——' },
        { text: '只記得最後一擊的衝擊，' },
        { text: '然後是耳鳴，然後是沉默。' },
        { cls: 'e-gap' },
        { text: '你試著站起來。' },
        { text: '身體沒有回應。' },
        { cls: 'e-gap' },
        { text: '觀眾的聲音變得遙遠，像隔著水底聽見的呼喊。' },
        { text: '也許有人在為你歡呼，也許不是。' },
        { cls: 'e-gap' },
        { text: '你看見天空。' },
        { text: '競技場的天空很藍——' },
        { text: '你第一次注意到這件事。', cls: 'e-hi' },
        { cls: 'e-gap' },
        { text: `百日的訓練、傷痛、屈辱，` },
        { text: `每一個 <strong>${playerName}</strong> 用命換來的夜晚，` },
        { text: '就這樣，靜靜地沉下去。' },
        { cls: 'e-gap' },
        { text: '在某個地方，主人皺著眉，', cls: 'e-speech' },
        { text: '在帳本上，劃去了一個名字。', cls: 'e-speech' },
        { cls: 'e-gap' },
        { text: '沙地，緩緩將你包裹。' },
      ];

      let d = _revealLines(box, lines, 900, 580);

      const fin = document.createElement('div');
      fin.className = 'e-line e-big';
      fin.style.color = '#4a2020';
      fin.style.letterSpacing = '.45em';
      fin.textContent = '— 終 —';
      box.appendChild(fin);
      setTimeout(() => fin.classList.add('e-show'), d + 300);

      // 🆕 死亡結局：提供重新開始 + 讀取存檔兩個選項
      _addButton(box, '重新開始', d + 1600, () => {
        ov.style.opacity = 0;
        setTimeout(() => {
          ov.remove();
          location.reload();   // 重新載入頁面 = 乾淨的新遊戲/讀檔畫面
        }, 800);
      });

      _addButton(box, '回到戰鬥前', d + 2200, () => {
        ov.style.opacity = 0;
        setTimeout(() => {
          ov.remove();
          // 讀取戰前備份（backup slot，戰鬥前自動存的）
          if (typeof Game !== 'undefined' && Game.loadGameFromSlot) {
            let ok = Game.loadGameFromSlot('backup');
            if (!ok) ok = Game.loadGameFromSlot('auto');   // fallback: 每日自動存檔
            if (!ok) ok = Game.loadGameFromSlot('slot_0'); // fallback: 手動存檔
            if (ok) {
              if (Game.renderAll) Game.renderAll();
              if (Game.showToast) Game.showToast('📂 回到戰鬥前', 2000);
            } else {
              location.reload();
            }
          } else {
            location.reload();
          }
        }, 800);
      });

    }, 900);
  }

  // ══════════════════════════════════════════════════
  // 🆕 新增結局（5 種）
  // ══════════════════════════════════════════════════

  // 獨自登頂（告發奧蘭路線）
  function loneVictor(playerName) {
    _injectStyle();
    const ov = _overlay('e-lone');
    _particles(ov, 'blood', 15);
    const vg = document.createElement('div'); vg.className = 'e-vignette';
    ov.appendChild(vg);
    const box = document.createElement('div'); box.className = 'e-box';
    ov.appendChild(box);
    _addTitle(box, '獨 自 登 頂', 600);

    const lines = [
      { text: '你贏了。' },
      { cls: 'e-gap' },
      { text: '觀眾的歡呼砸在你身上，但你沒聽見。' },
      { text: '你的耳朵裡只有一個聲音——' },
      { text: '第一夜黑暗中那隻伸出來的手。' },
      { cls: 'e-gap' },
      { text: '主人走過來，拍拍你的肩：「你讓我賺了很多錢。」' },
      { text: `「<strong>${playerName}</strong>，我看好你。」`, cls: 'e-speech' },
      { cls: 'e-gap' },
      { text: '你笑了。你成為了一個成功的鬥士。' },
      { text: '一個成功的——什麼？' },
      { cls: 'e-gap' },
      { text: '那天晚上，你獨自走回房間。', cls: 'e-hi' },
      { text: '房間很安靜。' },
      { text: '你從未像今天這樣，覺得自己贏了。' },
      { text: '也從未像今天這樣，覺得自己什麼都沒有。' },
    ];
    const d = _revealLines(box, lines, 1200, 560);
    _finishEnding(ov, box, '— 空 —', '#663344', d);
  }

  // 冠軍（高名聲，正面路線）
  function championEnding(playerName) {
    _injectStyle();
    const ov = _overlay('e-champion');
    _glow(ov, 'rgba(212,175,55,.3)');
    _particles(ov, 'gold', 40);
    const vg = document.createElement('div'); vg.className = 'e-vignette';
    ov.appendChild(vg);
    const box = document.createElement('div'); box.className = 'e-box';
    ov.appendChild(box);
    _addTitle(box, '萬骸祭・冠軍', 700);

    const lines = [
      { text: '最後一擊落下。沙地歸於寂靜。' },
      { cls: 'e-gap' },
      { text: '觀眾的聲音像潮水一樣湧過來。' },
      { text: `他們在喊你的名字——<strong>${playerName}</strong>。`, cls: 'e-speech' },
      { cls: 'e-gap' },
      { text: '領主緩緩站起。他看著你的眼神不一樣了。' },
      { text: '不是在看商品。是在看——一個人。' },
      { cls: 'e-gap' },
      { text: '「這個鬥士，」領主說，「從今天起，是自由人。」' },
      { cls: 'e-gap' },
      { text: '你站在沙地中央。', cls: 'e-hi' },
      { text: '腳下不再是牢籠。' },
      { text: '但你知道——你永遠是這座競技場的一部分。' },
    ];
    const d = _revealLines(box, lines, 1300, 560);
    _finishEnding(ov, box, '— 榮 耀 —', '#d4af37', d);
  }

  // 殘存者（一般活下來）
  function survivorPlain(playerName) {
    _injectStyle();
    const ov = _overlay('e-surv-plain');
    _particles(ov, 'dust', 20);
    const vg = document.createElement('div'); vg.className = 'e-vignette';
    ov.appendChild(vg);
    const box = document.createElement('div'); box.className = 'e-box';
    ov.appendChild(box);
    _addTitle(box, '殘 存 者', 600);

    const lines = [
      { text: '你贏了最後一場。' },
      { text: '沒有歡呼。沒有獎賞。' },
      { cls: 'e-gap' },
      { text: '觀眾散了。沙地被僕人清理。' },
      { text: '你被帶回牢房。明天——' },
      { text: '還有下一場。' },
      { cls: 'e-gap' },
      { text: '你沒成為英雄。', cls: 'e-hi' },
      { text: '沒拿到自由。' },
      { text: '沒人會記得你。' },
      { cls: 'e-gap' },
      { text: '但你活著。' },
      { text: `<strong>${playerName}</strong>，活著。` },
      { text: '在這裡——這已經是勝利。' },
    ];
    const d = _revealLines(box, lines, 1200, 560);
    _finishEnding(ov, box, '— 活 著 —', '#aa9060', d);
  }

  // 同命兄弟（奧蘭活，共同作戰路線）
  function brotherhoodEnding(playerName) {
    _injectStyle();
    const ov = _overlay('e-brother');
    _glow(ov, 'rgba(180,140,80,.25)');
    _particles(ov, 'gold', 30);
    const vg = document.createElement('div'); vg.className = 'e-vignette';
    ov.appendChild(vg);
    const box = document.createElement('div'); box.className = 'e-box';
    ov.appendChild(box);
    _addTitle(box, '同 命 兄 弟', 700);

    const lines = [
      { text: '你站在沙地中央。' },
      { text: '旁邊——奧蘭也站著。' },
      { text: '他瘸了一條腿。但他站著。' },
      { cls: 'e-gap' },
      { text: '你們並肩走了一百天。' },
      { text: '今天，你們並肩走出這片沙地。' },
      { cls: 'e-gap' },
      { text: '奧蘭看著你，笑了——' },
      { text: '眼睛先彎起來的那種笑。' },
      { cls: 'e-gap' },
      { speaker: '奧蘭', text: '我們……真的做到了。' },
      { cls: 'e-gap' },
      { text: '你沒說話。你只是拍了拍他的肩。', cls: 'e-hi' },
      { text: '他的肩膀很瘦。但很穩。' },
      { cls: 'e-gap' },
      { text: '第一夜黑暗中那隻伸出來的手——' },
      { text: '你沒有放開。' },
      { text: '你永遠不會放開。' },
    ];
    const d = _revealLines(box, lines, 1400, 580);
    _finishEnding(ov, box, '— 兄 弟 —', '#d9a84f', d);
  }

  // 血色皇冠（殘忍路線）
  function bloodyCrown(playerName) {
    _injectStyle();
    const ov = _overlay('e-bloody');
    _glow(ov, 'rgba(180,30,30,.35)');
    _particles(ov, 'blood', 40);
    const vg = document.createElement('div'); vg.className = 'e-vignette';
    ov.appendChild(vg);
    const box = document.createElement('div'); box.className = 'e-box';
    ov.appendChild(box);
    _addTitle(box, '血 色 皇 冠', 700);

    const lines = [
      { text: '最後一擊——你沒有停下。' },
      { text: '對手已經跪下。你還是砍了下去。' },
      { cls: 'e-gap' },
      { text: '觀眾的歡呼帶著恐懼。' },
      { text: `他們喊你的名字——<strong>${playerName}</strong>——但他們不敢看你的眼睛。`, cls: 'e-speech' },
      { cls: 'e-gap' },
      { text: '你贏得了冠軍。' },
      { text: '你贏得了觀眾的尖叫。' },
      { text: '你贏得了主人帳本上最高的數字。' },
      { cls: 'e-gap' },
      { text: '你走回房間。', cls: 'e-hi' },
      { text: '鏡子裡那個人——你不認識。' },
      { text: '但他跟你長得一模一樣。' },
      { cls: 'e-gap' },
      { text: '你曾經害怕成為那種人。' },
      { text: '現在你是。' },
    ];
    const d = _revealLines(box, lines, 1300, 560);
    _finishEnding(ov, box, '— 怪 物 —', '#8b0000', d);
  }

  // 奇蹟殘局（最難條件 — 兩人都活但奧蘭殘廢）
  function miracleEnding(playerName) {
    _injectStyle();
    const ov = _overlay('e-miracle');
    _glow(ov, 'rgba(232,216,176,.35)');
    _particles(ov, 'gold', 60);
    const vg = document.createElement('div'); vg.className = 'e-vignette';
    ov.appendChild(vg);
    const box = document.createElement('div'); box.className = 'e-box';
    ov.appendChild(box);
    _addTitle(box, '奇 蹟', 800);

    const lines = [
      { text: '全場安靜了一瞬——' },
      { text: '然後爆發出沒有人聽過的歡呼。' },
      { cls: 'e-gap' },
      { text: '你贏了決賽。獨自一人。' },
      { text: '帶著奧蘭的期望、索爾的乾肉、老默的藥草——' },
      { text: '所有幫過你的人，都在這一刻跟你一起站在沙地上。' },
      { cls: 'e-gap' },
      { text: '領主站起來，沉默很久才開口。' },
      { text: '「一百天前，你是一筆投資。」' },
      { text: '「今天——你是傳說。」', cls: 'e-speech' },
      { cls: 'e-gap' },
      { text: '兩個自由身的憑證。' },
      { text: '你拿了一個。然後走到場邊。' },
      { text: '奧蘭拄著拐杖，眼眶紅了。' },
      { cls: 'e-gap' },
      { speaker: '奧蘭', text: '……你瘋了。' },
      { text: '你把另一個憑證塞進他手裡。', cls: 'e-hi' },
      { cls: 'e-gap' },
      { text: `「<strong>${playerName}</strong>，」奧蘭說，「你妹妹……」`, cls: 'e-speech' },
      { text: `「我們一起去看她。」`, cls: 'e-speech' },
    ];
    const d = _revealLines(box, lines, 1500, 600);
    _finishEnding(ov, box, '— 自 由 —', '#e8d070', d);
  }

  // ══════════════════════════════════════════════════
  // 🆕 2026-05-01：B 路徑大反撲結局（4 種）+ C 路徑逃跑（1 種）+ 衝動分支（3 種）
  //   詳細設計：[docs/quests/arena-events-roster.md § 6d](../docs/quests/arena-events-roster.md)
  //   stub 版本 — 對白先用 spec 草稿、未來 polish
  // ══════════════════════════════════════════════════

  // ── B 路徑 1：自由人（大反撲大勝） ───────────────────
  function rebelFreedom(playerName, allyCount) {
    _injectStyle();
    const ov = _overlay('e-rebel-freedom');
    _glow(ov, 'rgba(212,175,55,.32)');
    _particles(ov, 'gold', 50);
    const vg = document.createElement('div'); vg.className = 'e-vignette';
    ov.appendChild(vg);
    const box = document.createElement('div'); box.className = 'e-box';
    ov.appendChild(box);
    _addTitle(box, '自 由 人', 700);

    const lines = [
      { text: '提圖斯倒下了。' },
      { text: '衛兵亂了。觀眾席的奴隸跳下來。' },
      { cls: 'e-gap' },
      { text: '你不知道是誰先喊的——' },
      { text: '「殺！」' },
      { text: '整座競技場、像被撕開。' },
      { cls: 'e-gap' },
      { text: `凱德躺在沙地中央、看著天。`, cls: 'e-hi' },
      { text: '你跨過他的身體、繼續往前殺。' },
      { cls: 'e-gap' },
      { text: `${allyCount} 個兄弟跟你並肩。` },
      { text: '殘血、瘸腿、缺臂。' },
      { text: '但站著。' },
      { cls: 'e-gap' },
      { text: '日落時、城門大開。' },
      { text: '你騎上一匹搶來的馬、回頭看了競技場一眼。' },
      { text: '凱德的屍體已經被拖走了。' },
      { cls: 'e-gap' },
      { text: `<strong>${playerName}</strong>——`, cls: 'e-hi' },
      { text: '從今天起、地下傳奇。' },
      { text: '帝國通緝令上有你的名字、但沒人知道你的臉。' },
    ];
    const d = _revealLines(box, lines, 1300, 580);
    _finishEnding(ov, box, '— 自 由 —', '#d4af37', d);
  }

  // ── B 路徑 2：血祭（大反撲小勝、盟友幾乎全滅） ─────
  function rebelBloody(playerName) {
    _injectStyle();
    const ov = _overlay('e-rebel-bloody');
    _glow(ov, 'rgba(180,30,30,.30)');
    _particles(ov, 'blood', 35);
    const vg = document.createElement('div'); vg.className = 'e-vignette';
    ov.appendChild(vg);
    const box = document.createElement('div'); box.className = 'e-box';
    ov.appendChild(box);
    _addTitle(box, '血 祭', 700);

    const lines = [
      { text: '你跪在沙地上、喘氣。' },
      { text: '提圖斯死了。' },
      { text: '你也是這場屠殺裡最後一個站著的。' },
      { cls: 'e-gap' },
      { text: '凱德躺在你左邊。' },
      { text: '赫克特、奧蘭、一個個你叫得出名字的兄弟、躺在你身邊。' },
      { text: '所有人為你死、你贏了。' },
      { cls: 'e-gap' },
      { text: '你站起來。沒有歡呼。' },
      { text: '觀眾席空了。倖存的奴隸都逃了。' },
      { text: '只有你、跟一地的屍體。', cls: 'e-hi' },
      { cls: 'e-gap' },
      { text: `<strong>${playerName}</strong>——你贏了。`, cls: 'e-speech' },
      { text: '但這場勝利、值得嗎？' },
      { text: '你沒答案。' },
    ];
    const d = _revealLines(box, lines, 1200, 580);
    _finishEnding(ov, box, '— 孤 勝 —', '#8b0000', d);
  }

  // ── B 路徑 3：殉道者（玩家死、提圖斯死） ───────────
  function rebelMartyr(playerName) {
    _injectStyle();
    const ov = _overlay('e-rebel-martyr');
    _glow(ov, 'rgba(150,100,50,.28)');
    _particles(ov, 'blood', 25);
    const vg = document.createElement('div'); vg.className = 'e-vignette';
    ov.appendChild(vg);
    const box = document.createElement('div'); box.className = 'e-box';
    ov.appendChild(box);
    _addTitle(box, '殉 道 者', 700);

    const lines = [
      { text: '你看到提圖斯倒下。' },
      { text: '你也倒下。' },
      { cls: 'e-gap' },
      { text: '沙地很溫。' },
      { text: '凱德的臉就在你旁邊、眼睛還睜著。' },
      { text: '他笑了一下、像是在說「⋯⋯做完了」。' },
      { cls: 'e-gap' },
      { text: '你走的時候、聽到城裡傳出第一聲喊話——' },
      { text: '「領主死了！」', cls: 'e-hi' },
      { cls: 'e-gap' },
      { text: '幾年後、有人會傳：' },
      { text: `「<strong>${playerName}</strong>那年的血、洗開了真相。」`, cls: 'e-speech' },
      { text: '偽旗的事被翻出來、家鄉的冤魂被祭奠。' },
      { cls: 'e-gap' },
      { text: '你沒看到。' },
      { text: '但你做到了。' },
    ];
    const d = _revealLines(box, lines, 1300, 600);
    _finishEnding(ov, box, '— 殉 道 —', '#c89060', d);
  }

  // ── B 路徑 4：無名死（反撲失敗） ─────────────────
  function rebelFailed(playerName) {
    _injectStyle();
    const ov = _overlay('e-rebel-failed');
    _particles(ov, 'blood', 18);
    const vg = document.createElement('div'); vg.className = 'e-vignette';
    ov.appendChild(vg);
    const box = document.createElement('div'); box.className = 'e-box';
    ov.appendChild(box);
    _addTitle(box, '無 名 死', 600);

    const lines = [
      { text: '你撲上去的那一刀、慢了一步。' },
      { text: '衛兵的長矛先到。' },
      { cls: 'e-gap' },
      { text: '提圖斯閃身、面無表情看你倒下。' },
      { text: '凱德躺在你不遠處、已經閉眼了。' },
      { cls: 'e-gap' },
      { text: '主人來收屍體的時候罵了一句：「⋯⋯沒用的東西。」' },
      { text: '帳本上、你的名字被劃掉了。', cls: 'e-hi' },
      { cls: 'e-gap' },
      { text: '城裡這天有點亂。' },
      { text: '但很快就沒事了。' },
      { text: '提圖斯第二天還是領主、還是笑著上朝。' },
      { cls: 'e-gap' },
      { text: `<strong>${playerName}</strong>——沒人記得這個名字。`, cls: 'e-speech' },
    ];
    const d = _revealLines(box, lines, 1100, 560);
    _finishEnding(ov, box, '— 無 名 —', '#5a3030', d);
  }

  // ── C 路徑：逃亡者（比拉斯地道逃跑） ────────────
  function escapeTunnel(playerName, bilasAlive) {
    _injectStyle();
    const ov = _overlay('e-escape');
    _particles(ov, 'gold', 12);
    const vg = document.createElement('div'); vg.className = 'e-vignette';
    ov.appendChild(vg);
    const box = document.createElement('div'); box.className = 'e-box';
    ov.appendChild(box);
    _addTitle(box, '逃 亡 者', 600);

    const lines = [
      { text: '地道很窄。土腥味很重。' },
      { text: '比拉斯在前面爬。你跟著。' },
      { cls: 'e-gap' },
      { text: '上頭傳來追兵的腳步聲。' },
      { text: '你們爬得更快。' },
      { cls: 'e-gap' },
      bilasAlive
        ? { text: '出口在天亮前到。比拉斯先跳出去、回頭拉你。' }
        : { text: '出口在天亮前到。比拉斯沒撐過最後一個轉角、你只能自己爬出去。' },
      { cls: 'e-gap' },
      { text: '城外的風很冷。', cls: 'e-hi' },
      { text: '你站在山坡上、回頭看城牆。' },
      { text: '萬骸祭的火光還在燒。' },
      { cls: 'e-gap' },
      { text: `<strong>${playerName}</strong>——`, cls: 'e-speech' },
      { text: '從今天起、你沒名字、沒身份、沒家。' },
      { text: '但活著。' },
      { cls: 'e-gap' },
      { text: '多年後、城裡的人偶爾會提到「萬骸祭那年發生了什麼」。' },
      { text: '你不會回去了。' },
    ];
    const d = _revealLines(box, lines, 1200, 580);
    _finishEnding(ov, box, '— 逃 —', '#aa9060', d);
  }

  // ── 衝動 1：當場 GG（衝動失敗） ──────────────────
  function impulseFailed(playerName) {
    _injectStyle();
    const ov = _overlay('e-impulse-failed');
    _particles(ov, 'blood', 20);
    const vg = document.createElement('div'); vg.className = 'e-vignette';
    ov.appendChild(vg);
    const box = document.createElement('div'); box.className = 'e-box';
    ov.appendChild(box);
    _addTitle(box, '無 名 死', 500);

    const lines = [
      { text: '你看到那張臉。' },
      { text: '想都沒想、衝出去。' },
      { cls: 'e-gap' },
      { text: '訓練場的圍欄被你撞翻。' },
      { text: '衛兵的長矛來得快。' },
      { text: '阿圖斯也叫人圍上來。' },
      { cls: 'e-gap' },
      { text: '你倒下時、嘴裡是血。' },
      { text: '提圖斯連看都沒看你一眼。' },
      { cls: 'e-gap' },
      { text: '阿圖斯隔天罵：「沒用的東西。」', cls: 'e-hi' },
      { text: '訓練所恢復正常。' },
      { text: '家鄉冤魂無報。' },
      { cls: 'e-gap' },
      { text: `<strong>${playerName}</strong>——沒人知道你為什麼忽然爆走。`, cls: 'e-speech' },
    ];
    const d = _revealLines(box, lines, 1000, 560);
    _finishEnding(ov, box, '— 終 —', '#4a2020', d);
  }

  // ── 衝動 2：殉道弒主（夢幻屬性、殺到領主） ─────
  function impulseLordKilled(playerName) {
    _injectStyle();
    const ov = _overlay('e-impulse-killed');
    _glow(ov, 'rgba(150,80,30,.30)');
    _particles(ov, 'blood', 30);
    const vg = document.createElement('div'); vg.className = 'e-vignette';
    ov.appendChild(vg);
    const box = document.createElement('div'); box.className = 'e-box';
    ov.appendChild(box);
    _addTitle(box, '殉 道 弒 主', 700);

    const lines = [
      { text: '你撞翻圍欄、衝過衛兵、撲上提圖斯的台。' },
      { text: '那一瞬、所有人都沒反應過來。' },
      { cls: 'e-gap' },
      { text: '你的劍刺進了他的胸口。' },
      { text: '你看到他眼裡的不解——' },
      { text: '「⋯⋯為什麼？」' },
      { cls: 'e-gap' },
      { text: '你沒回答。' },
      { text: '衛兵的劍從你背後插進來。' },
      { cls: 'e-gap' },
      { text: '你跟提圖斯一起倒在台上。' },
      { text: '阿圖斯尖叫。', cls: 'e-hi' },
      { cls: 'e-gap' },
      { text: '城裡有人傳：「⋯⋯有個瘋子衝上去把領主殺了。」' },
      { text: `<strong>${playerName}</strong>——沒人知道你的本名。`, cls: 'e-speech' },
      { text: '但這個城市再也不一樣了。' },
    ];
    const d = _revealLines(box, lines, 1300, 600);
    _finishEnding(ov, box, '— 弒 —', '#8b3030', d);
  }

  // ── 衝動 3：殺出血路逃跑（AGI 高） ───────────────
  function impulseEscape(playerName) {
    _injectStyle();
    const ov = _overlay('e-impulse-escape');
    _particles(ov, 'gold', 10);
    const vg = document.createElement('div'); vg.className = 'e-vignette';
    ov.appendChild(vg);
    const box = document.createElement('div'); box.className = 'e-box';
    ov.appendChild(box);
    _addTitle(box, '血 路 逃 亡', 600);

    const lines = [
      { text: '你衝出去、卻發現衝不過。' },
      { text: '剎那間身體比腦子快——' },
      { text: '你閃身、翻牆、跳屋頂。' },
      { cls: 'e-gap' },
      { text: '衛兵追不上。' },
      { text: '阿圖斯的人也追不上。' },
      { text: '你的腳像沒接過地。' },
      { cls: 'e-gap' },
      { text: '城外的山林、是你接下來的家。', cls: 'e-hi' },
      { cls: 'e-gap' },
      { text: '通緝令貼遍各城。' },
      { text: '你沒有名字、沒有身份、沒有家。' },
      { text: '但你活著。' },
      { cls: 'e-gap' },
      { text: `<strong>${playerName}</strong>——`, cls: 'e-speech' },
      { text: '逃亡的後半輩子、你沒有再見過提圖斯。' },
      { text: '但每個夜裡、那張臉都在你夢裡。' },
    ];
    const d = _revealLines(box, lines, 1200, 580);
    _finishEnding(ov, box, '— 逃 —', '#9a8050', d);
  }

  // ══════════════════════════════════════════════════
  // 🆕 2026-05-01：B / C / 衝動分支結局調度入口
  // ══════════════════════════════════════════════════

  /**
   * B 路徑（大反撲）結局調度
   * @param {object} ctx
   * @param {number} ctx.allyCount       存活盟友數
   * @param {boolean} ctx.lordKilled     提圖斯是否死
   * @param {boolean} ctx.playerSurvived 玩家是否活
   */
  function playRebellion(ctx) {
    const p = (typeof Stats !== 'undefined') ? Stats.player : null;
    const name = p?.name || '無名';
    const ac = ctx?.allyCount || 0;
    const lordDead = !!ctx?.lordKilled;
    const playerAlive = !!ctx?.playerSurvived;

    if (playerAlive && lordDead && ac >= 5)  { rebelFreedom(name, ac); return; }
    if (playerAlive && lordDead)             { rebelBloody(name);     return; }
    if (!playerAlive && lordDead)            { rebelMartyr(name);     return; }
    rebelFailed(name);
  }

  /**
   * C 路徑（提早溜走）結局
   * @param {object} ctx
   * @param {boolean} ctx.bilasAlive  比拉斯是否活著出去
   */
  function playEscape(ctx) {
    const p = (typeof Stats !== 'undefined') ? Stats.player : null;
    const name = p?.name || '無名';
    escapeTunnel(name, !!ctx?.bilasAlive);
  }

  /**
   * 衝動分支結局調度（Day 65 領主訪場、玩家衝出去）
   * @param {object} ctx
   * @param {boolean} ctx.lordKilled    殺到領主了嗎
   * @param {boolean} ctx.escaped       逃跑了嗎（AGI 高）
   *   都沒 → 失敗 GG
   */
  function playImpulse(ctx) {
    const p = (typeof Stats !== 'undefined') ? Stats.player : null;
    const name = p?.name || '無名';
    if (ctx?.lordKilled) { impulseLordKilled(name); return; }
    if (ctx?.escaped)    { impulseEscape(name);     return; }
    impulseFailed(name);
  }

  // 共用結尾按鈕
  function _finishEnding(ov, box, finalText, color, delayMs) {
    const fin = document.createElement('div');
    fin.className = 'e-line e-big';
    fin.style.color = color;
    fin.style.letterSpacing = '.45em';
    fin.textContent = finalText;
    box.appendChild(fin);
    setTimeout(() => fin.classList.add('e-show'), delayMs + 300);

    _addButton(box, '重新開始', delayMs + 1600, () => {
      ov.style.opacity = 0;
      setTimeout(() => { ov.remove(); location.reload(); }, 800);
    });
  }

  // ══════════════════════════════════════════════════
  // 🆕 結局判定器：讀玩家 flag/狀態，決定播哪個結局
  // ══════════════════════════════════════════════════
  function pickAndPlay(survived) {
    const p = (typeof Stats !== 'undefined') ? Stats.player : null;
    const name = p?.name || '無名';
    if (!survived) { deathEnding(name); return; }
    if (typeof Flags === 'undefined') { survivorEnding(name); return; }

    // 告發奧蘭 → 獨自登頂
    if (Flags.has('betrayed_olan')) { loneVictor(name); return; }

    // 奇蹟殘局：共同作戰 + 極高屬性 + 多條件
    if (Flags.has('orlan_will_fight_beside') && !Flags.has('orlan_dead')) {
      const totalStats = (p.STR||0) + (p.DEX||0) + (p.CON||0) + (p.AGI||0) + (p.WIL||0);
      const sisterTruthSeen = Flags.has('olan_sister_truth_known')
                           || (Array.isArray(p.seenReveals) && p.seenReveals.includes('orlan_sister_truth_reveal'));
      const isMiracle = totalStats >= 120
                     && Flags.has('shared_olans_punishment')
                     && sisterTruthSeen;
      if (isMiracle) { miracleEnding(name); return; }
      brotherhoodEnding(name); return;
    }

    // 血色皇冠：殘忍特性 + 多次斬首
    const executions = p.combatStats?.executionCount || 0;
    if ((p.traits || []).includes('cruel') && executions >= 3) {
      bloodyCrown(name); return;
    }

    // 冠軍：高名聲
    if ((p.fame || 0) >= 60) { championEnding(name); return; }

    // 殘存者：一般活下來
    survivorPlain(name);
  }

  // ── Public API ────────────────────────────────────────
  /**
   * Test from console: Endings.test('survivor') 等
   */
  function test(endingId) {
    const name = (typeof Stats !== 'undefined') ? Stats.player.name : '無名英雄';
    const map = {
      // 既有 8 結局
      survivor:    () => survivorEnding(name),
      death:       () => deathEnding(name),
      lone:        () => loneVictor(name),
      champion:    () => championEnding(name),
      plain:       () => survivorPlain(name),
      brotherhood: () => brotherhoodEnding(name),
      bloody:      () => bloodyCrown(name),
      miracle:     () => miracleEnding(name),
      // 🆕 2026-05-01 B 路徑反撲（4 種）
      rebel_freedom: () => rebelFreedom(name, 10),
      rebel_bloody:  () => rebelBloody(name),
      rebel_martyr:  () => rebelMartyr(name),
      rebel_failed:  () => rebelFailed(name),
      // 🆕 C 路徑逃跑
      escape:        () => escapeTunnel(name, true),
      escape_alone:  () => escapeTunnel(name, false),
      // 🆕 衝動分支（3 種）
      impulse_failed: () => impulseFailed(name),
      impulse_killed: () => impulseLordKilled(name),
      impulse_escape: () => impulseEscape(name),
    };
    if (map[endingId]) map[endingId]();
    else console.log('[Endings] test():', Object.keys(map).join(' / '));
  }

  return {
    survivorEnding, deathEnding,
    loneVictor, championEnding, survivorPlain, brotherhoodEnding, bloodyCrown, miracleEnding,
    // 🆕 2026-05-01 B/C/衝動分支結局
    rebelFreedom, rebelBloody, rebelMartyr, rebelFailed,
    escapeTunnel,
    impulseFailed, impulseLordKilled, impulseEscape,
    // 🆕 2026-05-01 結局調度入口
    playRebellion, playEscape, playImpulse,
    pickAndPlay,   // 既有主要入口（A 路徑用）
    test,
  };
})();
