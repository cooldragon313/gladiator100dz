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
      survivor:    () => survivorEnding(name),
      death:       () => deathEnding(name),
      lone:        () => loneVictor(name),
      champion:    () => championEnding(name),
      plain:       () => survivorPlain(name),
      brotherhood: () => brotherhoodEnding(name),
      bloody:      () => bloodyCrown(name),
      miracle:     () => miracleEnding(name),
    };
    if (map[endingId]) map[endingId]();
    else console.log('[Endings] test():', Object.keys(map).join(' / '));
  }

  return {
    survivorEnding, deathEnding,
    loneVictor, championEnding, survivorPlain, brotherhoodEnding, bloodyCrown, miracleEnding,
    pickAndPlay,   // 🆕 主要入口
    test,
  };
})();
