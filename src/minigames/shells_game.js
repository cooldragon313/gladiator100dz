/**
 * shells_game.js — 三杯藏球（Shells & Pea）
 * ══════════════════════════════════════════════════
 * 設計：docs/quests/gambling-shells.md
 *
 * 在 Stage 上展開的 minigame、不像戰鬥畫面那麼大。
 *
 * 用法：
 *   ShellsGame.play({
 *     oppDEX: 18,
 *     playerDEX: Stats.eff('DEX'),
 *     rounds: 3,
 *     onComplete: ({ wins, losses }) => { ... }
 *   });
 *
 * 流程：
 *   1. 在 Stage 上 inject 3 個杯子 + 球
 *   2. 球放進指定杯、給玩家看 1.5 秒
 *   3. 蓋下 + 開始洗牌動畫（速度依 DEX 對撞）
 *   4. 玩家點擊 → 開蓋 → 中/不中
 *   5. 進下一場（best of 3）
 *   6. 結束 → onComplete
 */
const ShellsGame = (() => {

  let _config = null;
  let _wins = 0;
  let _losses = 0;
  let _round = 0;
  let _ballPos = 0;       // 球目前在哪個杯（0/1/2）
  let _phase = 'idle';    // idle | reveal | shuffle | guess | result

  function _ensureContainer() {
    let c = document.getElementById('shells-game-container');
    if (c) return c;
    c = document.createElement('div');
    c.id = 'shells-game-container';
    c.innerHTML = `
      <div id="shells-overlay">
        <div id="shells-title">三杯藏球</div>
        <div id="shells-rounds-info">第 1 場 / 共 3 場</div>
        <div id="shells-status">看清楚球在哪個杯⋯⋯</div>
        <div id="shells-cups">
          <div class="shell-cup" data-idx="0"><div class="shell-ball"></div></div>
          <div class="shell-cup" data-idx="1"><div class="shell-ball"></div></div>
          <div class="shell-cup" data-idx="2"><div class="shell-ball"></div></div>
        </div>
        <div id="shells-score">勝 0 / 敗 0</div>
      </div>
    `;
    document.body.appendChild(c);
    return c;
  }

  function _ensureStyles() {
    if (document.getElementById('shells-game-styles')) return;
    const style = document.createElement('style');
    style.id = 'shells-game-styles';
    style.textContent = `
      #shells-game-container {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 9000;
        background: rgba(8, 4, 2, 0.92);
        align-items: center;
        justify-content: center;
        font-family: 'Noto Serif TC', Georgia, serif;
      }
      #shells-game-container.show { display: flex; }
      #shells-overlay {
        background: linear-gradient(135deg, #1a1410, #0e0a06);
        border: 2px solid #5a4028;
        border-radius: 4px;
        padding: 32px 48px;
        text-align: center;
        min-width: 480px;
      }
      #shells-title {
        font-size: 22px;
        font-weight: 900;
        color: #d4af37;
        letter-spacing: .2em;
        margin-bottom: 8px;
      }
      #shells-rounds-info {
        font-size: 13px;
        color: #886655;
        margin-bottom: 20px;
        letter-spacing: .15em;
      }
      #shells-status {
        font-size: 16px;
        color: #e8d8b0;
        margin-bottom: 24px;
        min-height: 24px;
      }
      #shells-cups {
        display: flex;
        gap: 32px;
        justify-content: center;
        margin-bottom: 24px;
        position: relative;
        height: 180px;   /* 🆕 留空間給弧線動畫 */
      }
      .shell-cup {
        width: 80px;
        height: 100px;
        background: linear-gradient(180deg, #5a3a1c, #2a1a08);
        border: 2px solid #1a0c04;
        border-radius: 50% 50% 8px 8px / 35% 35% 8px 8px;
        cursor: pointer;
        position: relative;
        transition: transform .15s, border-color .15s;
        box-shadow: 0 4px 12px rgba(0,0,0,.5);
      }
      /* 🆕 2026-04-27 繞上 / 繞下的弧線洗牌動畫
         避免兩杯直線平移重疊、玩家追不到 */
      @keyframes shell-arc-over {
        0%   { transform: translate(0, 0); }
        25%  { transform: translate(calc(var(--dx) * 0.25), -60px); }
        50%  { transform: translate(calc(var(--dx) * 0.5),  -75px); }
        75%  { transform: translate(calc(var(--dx) * 0.75), -60px); }
        100% { transform: translate(var(--dx), 0); }
      }
      @keyframes shell-arc-under {
        0%   { transform: translate(0, 0); }
        25%  { transform: translate(calc(var(--dx) * 0.25),  60px); }
        50%  { transform: translate(calc(var(--dx) * 0.5),   75px); }
        75%  { transform: translate(calc(var(--dx) * 0.75),  60px); }
        100% { transform: translate(var(--dx), 0); }
      }
      .shell-cup:hover { border-color: #d4af37; }
      .shell-cup.lifted {
        transform: translateY(-32px) rotate(15deg);
      }
      .shell-cup.shuffling {
        cursor: wait;
      }
      .shell-ball {
        position: absolute;
        bottom: -16px;
        left: 50%;
        transform: translateX(-50%);
        width: 24px;
        height: 24px;
        background: radial-gradient(circle at 30% 30%, #aaa, #333);
        border-radius: 50%;
        display: none;
      }
      .shell-cup.show-ball .shell-ball { display: block; }
      #shells-score {
        font-size: 14px;
        color: #c8a060;
        letter-spacing: .15em;
      }
      .shell-cup.correct { border-color: #88cc77 !important; box-shadow: 0 0 16px #44aa44; }
      .shell-cup.wrong   { border-color: #cc3333 !important; box-shadow: 0 0 16px #aa2222; }
    `;
    document.head.appendChild(style);
  }

  function play(config) {
    _config = config || {};
    _wins = 0;
    _losses = 0;
    _round = 0;
    _ensureStyles();
    _ensureContainer().classList.add('show');
    _startRound();
  }

  function _startRound() {
    _round++;
    _phase = 'reveal';

    // 對手 DEX 依 round 微調（round 1 笨手 / round 3 飛快）
    const baseDEX = _config.oppDEX || 15;
    const playerDEX = _config.playerDEX || 10;
    let roundDEX = baseDEX;
    let speedMult = 1.0;
    if (_round === 1) { roundDEX = baseDEX - 10; speedMult = 1.5; }   // 簡單
    else if (_round === 3) { roundDEX = baseDEX + 5; speedMult = 0.8; }   // 困難

    // 玩家 DEX 高 → 動畫變慢（玩家眼睛跟得上）
    if (playerDEX >= 35) speedMult *= 0.7;
    else if (playerDEX >= 25) speedMult *= 0.85;

    document.getElementById('shells-rounds-info').textContent =
      `第 ${_round} 場 / 共 3 場`;
    document.getElementById('shells-status').textContent =
      _round === 1 ? '⋯⋯熱身一場、看清楚！' :
      _round === 3 ? '⋯⋯最後一場！對手手變快了！' :
      '⋯⋯看清楚球在哪個杯！';
    document.getElementById('shells-score').textContent =
      `勝 ${_wins} / 敗 ${_losses}`;

    // 隨機放球位置
    _ballPos = Math.floor(Math.random() * 3);
    const cups = document.querySelectorAll('.shell-cup');
    cups.forEach((c, i) => {
      c.classList.remove('lifted', 'shuffling', 'correct', 'wrong', 'show-ball');
      c.style.transition = '';
      c.style.transform = '';
      if (i === _ballPos) c.classList.add('lifted', 'show-ball');
    });

    // 1.5 秒後蓋下、開始洗牌
    setTimeout(() => {
      cups.forEach(c => c.classList.remove('lifted', 'show-ball'));
      _shuffleAnim(roundDEX, speedMult);
    }, 1500);
  }

  function _shuffleAnim(roundDEX, speedMult) {
    _phase = 'shuffle';
    document.getElementById('shells-status').textContent = '⋯⋯洗牌中⋯⋯';

    const cups = Array.from(document.querySelectorAll('.shell-cup'));
    cups.forEach(c => c.classList.add('shuffling'));

    // 🆕 2026-04-27 大幅放慢 + 減少 swap 次數（之前快到不科學）
    //   shuffleCount: 4 ~ 8（依 DEX）
    //   stepMs: 最低 800ms、最高 1400ms
    const shuffleCount = Math.min(8, 3 + Math.floor(roundDEX * 0.15));
    const stepMs = Math.max(800, Math.round(1400 * speedMult));

    let step = 0;
    function _doSwap() {
      if (step >= shuffleCount) {
        cups.forEach(c => c.classList.remove('shuffling'));
        _phase = 'guess';
        document.getElementById('shells-status').textContent = '⋯⋯點擊一個杯子！';
        cups.forEach((c, i) => {
          c.onclick = () => _onGuess(i);
        });
        return;
      }
      let a = Math.floor(Math.random() * 3);
      let b = Math.floor(Math.random() * 3);
      while (b === a) b = Math.floor(Math.random() * 3);

      const cupA = cups[a], cupB = cups[b];
      const rectA = cupA.getBoundingClientRect();
      const rectB = cupB.getBoundingClientRect();
      const dx = rectB.left - rectA.left;

      // 🆕 用 CSS keyframes 弧線動畫：cupA 繞上 / cupB 繞下
      //   兩杯不會視覺重疊、玩家可以清楚追到
      cupA.style.setProperty('--dx', dx + 'px');
      cupB.style.setProperty('--dx', (-dx) + 'px');
      cupA.style.animation = `shell-arc-over ${stepMs}ms ease-in-out`;
      cupB.style.animation = `shell-arc-under ${stepMs}ms ease-in-out`;

      // 球追蹤：邏輯上 swap
      if (_ballPos === a) _ballPos = b;
      else if (_ballPos === b) _ballPos = a;

      setTimeout(() => {
        // 清掉動畫、把 dx 寫進 transform 暫存最終位置
        cupA.style.animation = '';
        cupB.style.animation = '';
        cupA.style.transform = '';
        cupB.style.transform = '';
        cupA.style.removeProperty('--dx');
        cupB.style.removeProperty('--dx');

        // 真正交換 DOM 順序
        const parent = cupA.parentNode;
        const aIdx = Array.from(parent.children).indexOf(cupA);
        const bIdx = Array.from(parent.children).indexOf(cupB);
        if (aIdx < bIdx) {
          parent.insertBefore(cupB, cupA);
        } else {
          parent.insertBefore(cupA, cupB);
        }
        const newCupOrder = Array.from(parent.children);
        cups.length = 0;
        newCupOrder.forEach(c => cups.push(c));
        step++;
        _doSwap();
      }, stepMs);
    }
    _doSwap();
  }

  function _onGuess(clickedIdx) {
    if (_phase !== 'guess') return;
    _phase = 'result';
    const cups = Array.from(document.querySelectorAll('.shell-cup'));
    cups.forEach(c => c.onclick = null);

    // 找球真正在哪個 DOM index（_ballPos 可能跟 DOM 順序不同步、但這裡簡化）
    const correctIdx = _ballPos;
    const won = (clickedIdx === correctIdx);
    if (won) _wins++; else _losses++;

    cups.forEach((c, i) => {
      if (i === correctIdx) c.classList.add('correct', 'lifted', 'show-ball');
      else if (i === clickedIdx) c.classList.add('wrong', 'lifted');
      else c.classList.add('lifted');
    });

    document.getElementById('shells-status').textContent =
      won ? '✦ 猜中了！' : '✗ 沒中⋯⋯';
    document.getElementById('shells-score').textContent =
      `勝 ${_wins} / 敗 ${_losses}`;

    setTimeout(() => {
      if (_round < (_config.rounds || 3)) {
        _startRound();
      } else {
        _close();
      }
    }, 1800);
  }

  function _close() {
    document.getElementById('shells-game-container').classList.remove('show');
    if (typeof _config.onComplete === 'function') {
      _config.onComplete({ wins: _wins, losses: _losses });
    }
  }

  return { play };
})();
