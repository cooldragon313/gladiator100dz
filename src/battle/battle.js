/**
 * battle.js — Main game combat integration
 * Wraps testbattle.js engine for in-game battles.
 * Depends on: testbattle.js, stats.js, main.js (Game)
 */
const Battle = (() => {

  // ── State ──────────────────────────────────────────────
  let _player      = null;
  let _enemy       = null;
  let _active      = false;
  let _turn        = 0;
  let _autoRunning    = false;
  let _hardcoreActive = false;  // 硬核模式
  let _hardcoreTimer  = null;   // setInterval for countdown
  let _hardcoreCount  = 5;      // 倒數值 5→0
  let _onWin          = null;
  let _onLose         = null;

  // ── Rating / finishing state ─────────────────────────────
  let _battleTick       = 0;
  let _isArenaBattle    = false;
  let _pendingFameReward= 0;
  let _lastRating       = null;
  let _crowdMood        = null;  // 'bloodthirsty'|'neutral'|'merciful'|'special'

  // 🆕 2026-04-25c：返回訓練場按鈕 — 戰後手動關戰鬥畫面
  //   ⚠️ 必須在 IIFE 頂端宣告（let 不會 hoist）— start() 在 line 130 就會用到
  let _pendingReturnAction = null;

  // 🆕 2026-04-25c：自動戰鬥模式跨場記住（off / auto / hardcore）
  //   存 localStorage、新戰鬥開始自動套用、玩家手動切換才改變
  const AUTO_PREF_KEY = 'gladiator_auto_mode_pref';
  function _saveAutoPref(mode) {
    try { localStorage.setItem(AUTO_PREF_KEY, mode); } catch (e) {}
  }
  function _loadAutoPref() {
    try { return localStorage.getItem(AUTO_PREF_KEY) || 'off'; } catch (e) { return 'off'; }
  }
  function _showReturnButton() {
    const btn = document.getElementById('bt-return-btn');
    if (btn) {
      btn.classList.add('show');
      btn.style.display = 'block';   // 雙保險：inline + class
    }
  }
  function _hideReturnButton() {
    const btn = document.getElementById('bt-return-btn');
    if (btn) {
      btn.classList.remove('show');
      btn.style.display = '';   // 清掉 inline、回到 CSS class 控制
    }
  }
  function returnToTraining() {
    _hideReturnButton();
    _hideOverlay();
    Game.renderAll();
    const cb = _pendingReturnAction;
    _pendingReturnAction = null;
    if (typeof cb === 'function') {
      try { cb(); } catch (e) { console.error('[Battle] return callback error', e); }
    }
  }

  // ── ATB state ────────────────────────────────────────────
  let _atbLoop   = null;
  let _playerAtb = 0;   // 0–100, fills each tick
  let _enemyAtb  = 0;

  // ATB tick thresholds for rating (🆕 2026-04-20: 50ms ticks，數值 ×2 保持時間標準不變)
  const RATING_TICKS = { S: 120, A: 200, B: 240 };

  // ── Crowd mood config ────────────────────────────────────
  const CROWD_MOOD_CFG = {
    bloodthirsty: {
      hint: '觀眾席中傳來渴望的嘶吼，空氣中彷彿能聞到鮮血的味道。',
      execute:  { crowdFame:10, masterAff:3, officerAff:5, melaAff:-5, dagiAff:-3 },
      suppress: { crowdFame:4,  masterAff:0, officerAff:2, melaAff:0,  dagiAff:0  },
      spare:    { crowdFame:-3, masterAff:-2,officerAff:0, melaAff:8,  dagiAff:5, oldSlaveAff:5 },
    },
    neutral: {
      hint: '觀眾靜靜注視，等待你的決定。',
      execute:  { crowdFame:5,  masterAff:2, officerAff:3, melaAff:-3, dagiAff:-2 },
      suppress: { crowdFame:3,  masterAff:0, officerAff:2, melaAff:0,  dagiAff:0  },
      spare:    { crowdFame:2,  masterAff:-1,officerAff:0, melaAff:5,  dagiAff:5, oldSlaveAff:5 },
    },
    merciful: {
      hint: '有人開始為落敗的鬥士鼓掌——他打得很好。',
      execute:  { crowdFame:-5, masterAff:2, officerAff:2, melaAff:-8, dagiAff:-5 },
      suppress: { crowdFame:3,  masterAff:0, officerAff:1, melaAff:2,  dagiAff:0  },
      spare:    { crowdFame:8,  masterAff:-1,officerAff:0, melaAff:10, dagiAff:8, oldSlaveAff:8 },
    },
    special: {
      hint: '對手似乎在觀眾中頗有人緣——有人的眼神充滿緊張。',
      execute:  { crowdFame:5,  masterAff:3, officerAff:4, melaAff:-5, dagiAff:-5 },
      suppress: { crowdFame:8,  masterAff:1, officerAff:3, melaAff:0,  dagiAff:0  },
      spare:    { crowdFame:15, masterAff:-1,officerAff:0, melaAff:8,  dagiAff:10, oldSlaveAff:10 },
    },
  };

  function _generateCrowdMood() {
    const roll = Math.random() * 100;
    if (roll < 40) return 'bloodthirsty';
    if (roll < 70) return 'neutral';
    if (roll < 90) return 'merciful';
    return 'special';
  }

  const ROUTE_CFG = {
    rage:  { color:'#cc4422', label:'狂暴', icon:'⚔' },
    focus: { color:'#3366cc', label:'集中', icon:'◈' },
    fury:  { color:'#336633', label:'怒氣', icon:'⛊' },
  };

  const SPECIAL_FULL_DESC = {
    rage:  '攻擊×2.0 · 防禦×0.5 · 迴避歸零 · 持續3回合',
    focus: '命中必中 · 暴擊+40% · 速度×1.5 · 持續2回合',
    fury:  '下次被攻完全格擋 · 以敵方ATK×1.5反擊 · 1回合',
  };

  // ── 50% 小技能設定 ──────────────────────────────────────
  const HALF_SPECIALS = {
    rage:  { name:'爆筋', desc:'下次攻擊 ATK+60%（即時）',               delay: 0 },
    focus: { name:'瞬刺', desc:'下次攻擊必中 + 暴擊+20%（蓄力 1 tick）', delay: 1 },
    fury:  { name:'強架', desc:'下次受擊傷害 -80%（即時）',               delay: 0 },
  };

  // ── Delay 狀態 ────────────────────────────────────────────
  let _playerDelay      = 0;    // 剩餘蓄力 tick 數
  let _playerDelaySkill = null; // 'half_focus' | null

  function _routeLabel(r) {
    return { rage:'狂暴', focus:'集中', fury:'怒氣' }[r] || r;
  }

  // ══════════════════════════════════════════════════════
  // PUBLIC: start(opponentId, onWin, onLose)
  // ══════════════════════════════════════════════════════
  function start(opponentId, onWin, onLose, opts) {
    const options = opts || {};
    _onWin  = onWin  || (() => {});
    _onLose = onLose || (() => {});
    _turn        = 0;
    _autoRunning    = false;
    _hardcoreActive = false;
    _battleTick       = 0;
    // 🆕 預設開啟斬首面板，但切磋可傳 { sparring: true } 關閉
    _isArenaBattle    = !options.sparring;
    // 🆕 2026-04-25 修 bug：start(opponentId) 路徑從不讀 enemy.fameReward
    //   結果 timeline 事件競技場（Day 50 大型 / Day 100 萬骸祭等）S 評分都 +0 fame
    //   修法：從 TB_ENEMIES[opponentId] 讀 fameReward；無欄位則用 fame ÷ 2 估算
    _pendingFameReward = 0;
    if (typeof TB_ENEMIES !== 'undefined') {
      const enemyDef = TB_ENEMIES[opponentId];
      if (enemyDef) {
        if (typeof enemyDef.fameReward === 'number') {
          _pendingFameReward = enemyDef.fameReward;
        } else {
          // fallback：enemy fame 一半（最低 5）
          _pendingFameReward = Math.max(5, Math.round((enemyDef.fame || 10) / 2));
        }
      }
    }
    _lastRating       = null;
    _crowdMood        = _generateCrowdMood();
    _playerDelay      = 0;
    _playerDelaySkill = null;
    _pendingReturnAction = null;   // 🆕 2026-04-25c：清掉上一場 return callback
    _hideReturnButton();

    // ── Build player unit from Stats.player ──
    const p = Stats.player;
    _player = TB_buildUnit({
      name:     p.name || '無名',
      STR: Stats.eff('STR'), DEX: Stats.eff('DEX'), CON: Stats.eff('CON'),
      AGI: Stats.eff('AGI'), WIL: Stats.eff('WIL'), LUK: Stats.eff('LUK'),
      // hpBase: back-calc so TB formula gives back the correct total
      hpBase:   Math.max(10, p.hpMax - Math.round(2 * Stats.eff('CON'))),
      fame:     p.fame || 0,
      weaponId:  _mapId(p.equippedWeapon, TB_WEAPONS,  'fists'),
      armorId:   _mapId(p.equippedArmor,  TB_ARMORS,   'rags'),
      offhandId: _mapOffhand(p.equippedOffhand),
      amuletId:  'none',
      traitId:   'none',
    }, true);

    // 🆕 2026-04-25c：HP 共用 — 進場帶訓練場當前 HP（不是滿血上場）
    //   設計：訓練受傷殘血就帶殘血進競技場、戰後 HP 同步回訓練場
    _player.hp = Math.max(1, Math.min(p.hp || _player._hpMax, _player._hpMax));

    // 🆕 2026-04-25c 劇情技能戰鬥 hook
    _applyStorySkills();

    // 🆕 2026-04-27 主動技能 cooldown / buff 重置
    _resetActiveSkills();

    // ── Build enemy unit ──
    _enemy  = TB_buildUnit({ enemyId: opponentId });
    _active = true;

    _showOverlay();
    _initUI();

    // Opening log (main game log gets a summary line)
    const def = TB_ENEMIES[opponentId] || {};
    Game.addLog(`\n⚔ 【戰鬥開始】\n${p.name} vs ${_enemy.name}【${def.title || ''}】`, '#d4af37', false);

    _appendLog(`⚔ 戰鬥開始！${_player.name} vs ${_enemy.name}【${_enemy.title}】`, 'log-system');
    if (def.passiveDesc) _appendLog(`▸ 被動：${def.passiveDesc}`, 'log-system');
    if (def.specialDesc) _appendLog(`▸ 特技：${def.specialDesc}`, 'log-system');

    const routeHints = {
      rage:  '▸ 狂暴：被打+15 被暴擊+25 命中+10。滿→血怒',
      focus: '▸ 集中：命中+12 暴擊+22 閃躲+20。被打扣量。滿→絕對瞬息',
      fury:  '▸ 怒氣：被命中+10 格擋+28 防禦+25。滿→盾牆反擊',
    };
    _appendLog(routeHints[_player.gaugeRoute] || '', 'log-system');

    // ── Pressure system ──
    const p2e = TB_calcPressure(_player, _enemy);
    const p2p = TB_calcPressure(_enemy,  _player);
    if (p2e.penalty > 0) {
      TB_applyPressure(_enemy, p2e.penalty, _player.name);
      _appendLog(`◈ 你的威嚇 → ${_enemy.name} 全屬性 -${Math.round(p2e.penalty*100)}%`, 'log-special');
    } else {
      _appendLog(`◈ 你對 ${_enemy.name} 尚無壓制力`, 'log-system');
    }
    if (p2p.penalty > 0) {
      TB_applyPressure(_player, p2p.penalty, _enemy.name);
      _appendLog(`⚠ ${_enemy.name} 的威嚇 → 你的全屬性 -${Math.round(p2p.penalty*100)}%`, 'log-injury');
    } else {
      _appendLog(`◈ 你成功抵禦 ${_enemy.name} 的壓制`, 'log-system');
    }
    _applyOpeningTraits();
    _appendLog('', 'log-turn');

    // D.1.13: 戰鬥開始音效
    SoundManager.playSfx('battle_start');

    _playerAtb = 0;
    _enemyAtb  = 0;
    _startAtbLoop();
    _updateCombatantUI();
    _updateSkillDisplay();
    _renderActiveSkillsBar();   // 🆕 戰鬥開始渲染主動技能列

    // 🆕 2026-04-25c：恢復玩家上次選的自動戰鬥模式（auto / hardcore / off）
    _restoreAutoPref();
  }

  function _restoreAutoPref() {
    const pref = _loadAutoPref();
    if (pref === 'auto')          _startAuto(true);   // skipSave=true 避免覆寫
    else if (pref === 'hardcore') _startHardcore(true);
    // 'off' 不做事
  }

  // ══════════════════════════════════════════════════════
  // 🆕 2026-04-25c：劇情技能戰鬥 hook
  //   - veteran_eye: 戰鬥開場 +15% ATK +5 CRT（永久至戰鬥結束）
  //   - unyielding: 重置 fired 旗標 + buff 計時、進入戰鬥就清零
  // ══════════════════════════════════════════════════════
  function _applyStorySkills() {
    if (!_player || typeof Stats === 'undefined') return;
    // 不屈：每場戰鬥重置
    _player._unyieldingFired    = false;
    _player._unyieldingBuffTurns = 0;
    // 老兵之眼：戰鬥開始套加成
    if (Stats.hasSkill && Stats.hasSkill('veteran_eye')) {
      const beforeATK = _player.derived.ATK;
      const beforeCRT = _player.derived.CRT;
      _player.derived.ATK = Math.round(_player.derived.ATK * 1.15);
      _player.derived.CRT = Math.min(75, _player.derived.CRT + 5);
      _appendLog(`✦ 老兵之眼：看破對手破綻 — ATK ${beforeATK} → ${_player.derived.ATK}、CRT ${beforeCRT} → ${_player.derived.CRT}`, 'log-special');
    }
  }

  // ══════════════════════════════════════════════════════
  // 🆕 2026-04-27：主動技能系統
  //   - cooldowns: 每技能獨立倒數（Map<skillId, turnsLeft>）
  //   - render: 列出已習得 + 武器符合的主動技能
  //   - 玩家點擊 → useActiveSkill(id) → 對應 hook 觸發
  //
  //   每場戰鬥重置 cooldowns + buff state（_taunt / _riposte / _warCry / _powerCharge）
  // ══════════════════════════════════════════════════════
  let _activeSkillCD = {};   // { skillId: turnsLeft }

  function _resetActiveSkills() {
    _activeSkillCD = {};
    if (!_player) return;
    _player._tauntTurns      = 0;
    _player._riposteStance   = false;
    _player._warCryTurns     = 0;
    _player._warCryATKBonus  = 0;
    _player._powerCharging   = false;   // true 表示下回合放強力斬
    _player._tauntDefBonus   = 0;       // taunt 期間的 DEF 加成
    _player._tauntBlkBonus   = 0;
    if (_enemy) _enemy._tauntedTurns = 0;
  }

  function _getEquippedWeaponClass() {
    if (!_player) return null;
    const wId = (Stats.player && Stats.player.equippedWeapon) || 'fists';
    const w = (typeof Weapons !== 'undefined') ? Weapons[wId] : null;
    return w && w.weaponClass;
  }

  function _hasWeaponClass(skill) {
    if (!Array.isArray(skill.weaponClassAny)) return true;   // 沒 require 就過
    const cls = _getEquippedWeaponClass();
    return cls && skill.weaponClassAny.includes(cls);
  }

  function _renderActiveSkillsBar() {
    const bar = document.getElementById('bt-active-skills');
    if (!bar) return;
    if (!_active || !_player) {
      bar.innerHTML = '';
      return;
    }
    if (typeof Stats === 'undefined' || !Stats.hasSkill || typeof Skills === 'undefined') {
      bar.innerHTML = '';
      return;
    }

    const learned = (Stats.player.learnedSkills || []).filter(id => {
      const s = Skills[id];
      return s && s.type === 'active';
    });

    if (learned.length === 0) {
      bar.innerHTML = '';
      return;
    }

    bar.innerHTML = learned.map(id => {
      const s = Skills[id];
      const cd = _activeSkillCD[id] || 0;
      const wcOk = _hasWeaponClass(s);
      const stamOk = (Stats.player.stamina || 0) >= (s.staminaCost || 0);
      const atbOk = _playerAtb >= 100 && _playerDelay <= 0;
      const disabled = cd > 0 || !wcOk || !stamOk || !atbOk;
      const cdCls = cd > 0 ? ' cd-down' : '';
      const cdText = cd > 0 ? `cd ${cd}` : (s.cooldown ? `cd ${s.cooldown}` : '');
      const reason = !wcOk ? '武器不符' : !stamOk ? '體力不足' : '';
      const title = reason || `體力 ${s.staminaCost} · ${cdText}`;
      return `
        <button class="bt-active-skill-btn${cdCls}" data-skill-id="${id}"
                ${disabled ? 'disabled' : ''} title="${title}">
          <div class="skill-name">${s.name}</div>
          <div class="skill-cost">⚡${s.staminaCost} · ${cdText}</div>
        </button>
      `;
    }).join('');

    bar.querySelectorAll('[data-skill-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        useActiveSkill(btn.dataset.skillId);
      });
    });
  }

  // 主動技能使用統一入口
  function useActiveSkill(skillId) {
    if (!_active || !_player) return;
    const s = (typeof Skills !== 'undefined') ? Skills[skillId] : null;
    if (!s || s.type !== 'active') return;
    if (!Stats.hasSkill(skillId)) return;
    if (_activeSkillCD[skillId] > 0) return;
    if (!_hasWeaponClass(s)) {
      _appendLog(`  ✗ ${s.name}：武器不符`, 'log-injury');
      return;
    }
    if ((Stats.player.stamina || 0) < (s.staminaCost || 0)) {
      _appendLog(`  ✗ ${s.name}：體力不足`, 'log-injury');
      return;
    }
    if (_playerAtb < 100 || _playerDelay > 0) return;

    // 扣體力 + 設 cooldown
    Stats.modVital('stamina', -(s.staminaCost || 0));
    _activeSkillCD[skillId] = (s.cooldown || 0) + 1;   // +1 因為當回合結束會 -1

    // 分派到對應 hook
    switch (skillId) {
      case 'powerStrike': _useSkill_powerStrike(s); break;
      case 'warCry':      _useSkill_warCry(s); break;
      case 'riposte':     _useSkill_riposte(s); break;
      case 'taunt':       _useSkill_taunt(s); break;
      default:
        _appendLog(`  ⚠ ${s.name}：戰鬥 hook 未實作`, 'log-system');
    }
  }

  // ══════════════════════════════════════════════════════
  // 各主動技能實作
  // ══════════════════════════════════════════════════════

  // 強力斬：蓄力 1 回合、下回合 ATK×2.0 無視 15 DEF
  function _useSkill_powerStrike(s) {
    _player._powerCharging = true;
    _appendLog(`⚔ 你舉劍蓄力——【強力斬】`, 'log-special');
    _appendLog(`  （下回合放招、ATK×2.0、無視 15 DEF）`, 'log-system');
    if (typeof SoundManager !== 'undefined') SoundManager.playSfx('skill_rage');
    _playerAtb = 0;
    _setButtons(false);
    if (!_checkDeath()) _endTurnCleanup_atb();
    _renderActiveSkillsBar();
  }

  // 戰吼：自身 ATK +20%、3 回合
  function _useSkill_warCry(s) {
    if (_player._warCryTurns > 0) {
      _appendLog(`  ✗ 戰吼還在生效中（剩 ${_player._warCryTurns} 回合）`, 'log-injury');
      return;
    }
    const bonus = Math.max(3, Math.round(_player.derived.ATK * 0.20));
    _player.derived.ATK += bonus;
    _player._warCryATKBonus = bonus;
    _player._warCryTurns = 3;
    _appendLog(`📢 你發出震懾的【戰吼】！ATK +${bonus}（3 回合）`, 'log-special');
    if (typeof SoundManager !== 'undefined') SoundManager.playSfx('skill_rage');
    _playerAtb = 0;
    _setButtons(false);
    if (!_checkDeath()) _endTurnCleanup_atb();
    _renderActiveSkillsBar();
  }

  // 反擊主動（riposte）：進入預備姿態、被攻擊時強制格擋並反擊 ATK×1.5
  function _useSkill_riposte(s) {
    _player._riposteStance = true;
    _player._riposteStanceTurns = 2;   // 2 turn 內被打就觸發、超過自動解
    _appendLog(`🛡 你進入【反擊姿態】 — 等對方出招`, 'log-special');
    _appendLog(`  （下次被攻擊強制格擋並反擊 ATK×1.5）`, 'log-system');
    if (typeof SoundManager !== 'undefined') SoundManager.playSfx('skill_focus');
    _playerAtb = 0;
    _setButtons(false);
    if (!_checkDeath()) _endTurnCleanup_atb();
    _renderActiveSkillsBar();
  }

  // 嘲諷：強制目標 3 回合追打 + 自身 DEF+10 BLK+5
  function _useSkill_taunt(s) {
    if (_enemy._tauntedTurns > 0) {
      _appendLog(`  ✗ 對方已被嘲諷中（剩 ${_enemy._tauntedTurns} 回合）`, 'log-injury');
      return;
    }
    _enemy._tauntedTurns = 3;
    _player.derived.DEF += 10;
    _player.derived.BLK += 5;
    _player._tauntDefBonus = 10;
    _player._tauntBlkBonus = 5;
    _player._tauntTurns = 3;
    _appendLog(`💢 你怒吼挑釁【嘲諷】！${_enemy.name} 被激怒、3 回合內強制追擊你`, 'log-special');
    _appendLog(`  自身 DEF +10 BLK +5（3 回合）`, 'log-system');
    if (typeof SoundManager !== 'undefined') SoundManager.playSfx('skill_rage');
    _playerAtb = 0;
    _setButtons(false);
    if (!_checkDeath()) _endTurnCleanup_atb();
    _renderActiveSkillsBar();
  }

  // ── Equipment ID mapper ────────────────────────────────
  function _mapId(id, dict, fallback) {
    return (id && dict[id]) ? id : fallback;
  }
  // 副手可以是盾牌 ID 或單手武器 ID，兩張表都查
  function _mapOffhand(id) {
    if (!id) return 'none';
    if (TB_SHIELDS[id]) return id;
    if (TB_WEAPONS[id] && !TB_WEAPONS[id].twoHanded) return id;
    return 'none';
  }

  // ══════════════════════════════════════════════════════
  // OVERLAY SHOW / HIDE
  // ══════════════════════════════════════════════════════
  function _showOverlay() {
    const ov = document.getElementById('battle-overlay');
    if (ov) ov.style.display = 'grid';   // 🆕 D.28 v2：grid 取代 flex
    _startBattleTimer();
  }

  function _hideOverlay() {
    const ov = document.getElementById('battle-overlay');
    if (ov) ov.style.display = 'none';
    _stopBattleTimer();
  }

  // 🆕 D.28：戰鬥計時器（顯示在中央欄最上方）
  let _timerStart = 0;
  let _timerInterval = null;
  function _startBattleTimer() {
    _timerStart = Date.now();
    if (_timerInterval) clearInterval(_timerInterval);
    _timerInterval = setInterval(() => {
      const el = document.getElementById('bt-timer');
      if (!el) return;
      const elapsed = Math.floor((Date.now() - _timerStart) / 1000);
      const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const ss = String(elapsed % 60).padStart(2, '0');
      el.textContent = `戰鬥時間 ${mm}:${ss}`;
    }, 500);
  }
  function _stopBattleTimer() {
    if (_timerInterval) clearInterval(_timerInterval);
    _timerInterval = null;
  }

  // 🆕 D.28：攻擊動畫（攻擊方撲向被攻擊方 + 被攻擊方震動）
  //   attackerSide: 'player' | 'enemy'
  //   大頭圖（左右欄）跟中間 slot 同時動畫
  /**
   * 🆕 2026-04-20 v4：攻擊動畫 — 垂直方向（stage 上下布局）
   *   玩家在上 → 往下撲 (bt-lunge-down)
   *   敵方在下 → 往上撲 (bt-lunge-up)
   *   防守方依結果反應：
   *     hit (未格擋) → 震動 + 紅光 (bt-hit-shake)
   *     blocked      → 往右 + 藍光 (bt-block-right)
   *     miss / dodge → 往左 + 黃光 (bt-dodge-left)
   *
   * @param {string} attackerSide 'player' | 'enemy'
   * @param {object} result { hit: bool, blocked: bool, crit: bool }
   */
  function _playAttackAnim(attackerSide, result) {
    const res = result || { hit: true, blocked: false };
    const attackerCard = attackerSide === 'player'
      ? document.querySelector('.bt-card-player')
      : document.querySelector('.bt-card-enemy');
    const defenderCard = attackerSide === 'player'
      ? document.querySelector('.bt-card-enemy')
      : document.querySelector('.bt-card-player');

    // ── 攻擊方飛撲（上下方向）──
    const lungeClass = attackerSide === 'player' ? 'bt-lunge-down' : 'bt-lunge-up';
    if (attackerCard) {
      attackerCard.classList.remove('bt-lunge-down', 'bt-lunge-up');
      void attackerCard.offsetHeight;
      attackerCard.classList.add(lungeClass);
      setTimeout(() => attackerCard.classList.remove(lungeClass), 650);
    }

    // ── 防守方反應（依結果分類）──
    if (defenderCard) {
      // 清除舊特效
      defenderCard.classList.remove('bt-hit-shake', 'bt-dodge-left', 'bt-block-right');
      void defenderCard.offsetHeight;

      let reactCls;
      if (!res.hit)         reactCls = 'bt-dodge-left';    // 閃避 左+黃
      else if (res.blocked) reactCls = 'bt-block-right';   // 格擋 右+藍
      else                  reactCls = 'bt-hit-shake';     // 命中 震動+紅

      setTimeout(() => defenderCard.classList.add(reactCls), 120);
      setTimeout(() => defenderCard.classList.remove(reactCls), 650);
    }

    // 攻擊台詞（40% 命中時，30% 防守時）
    if (res.hit && Math.random() < 0.40) _showSpeech(attackerSide, 'attack');
    else if (!res.hit && Math.random() < 0.30) _showSpeech(attackerSide === 'player' ? 'enemy' : 'player', 'defend');
  }

  // 🆕 D.28：對話泡泡（stage 中央跳）
  const _SPEECH_POOL = {
    attack: [
      '看招！', '給你嘗嘗！', '呵！', '吃我一擊！',
      '拿命來！', '該結束了！', '去死吧！',
    ],
    defend: [
      '閃得好！', '哼！', '想都別想！', '差得遠了！',
      '這招我看過！',
    ],
    crit: [
      '啊啊啊！', '完美！', '漂亮！', '就是現在！',
    ],
    hurt: [
      '該死⋯⋯', '可惡！', '嗚——！', '啊！',
    ],
  };
  function _showSpeech(side, type) {
    const rowId = side === 'player' ? 'bt-row-player' : 'bt-row-enemy';
    const row = document.getElementById(rowId);
    if (!row) return;
    const pool = _SPEECH_POOL[type] || _SPEECH_POOL.attack;
    const line = pool[Math.floor(Math.random() * pool.length)];
    const bubble = document.createElement('div');
    bubble.className = 'bt-speech side-' + side;
    bubble.textContent = line;
    row.appendChild(bubble);
    setTimeout(() => { if (bubble.parentNode) bubble.remove(); }, 1800);
  }

  // ══════════════════════════════════════════════════════
  // INIT UI
  // ══════════════════════════════════════════════════════
  function _initUI() {
    const log = document.getElementById('bt-log');
    if (log) log.innerHTML = '';
    const rd = document.getElementById('bt-round');
    if (rd) rd.textContent = '— 戰鬥開始 —';
    _fillEnemyInfo();
    _fillBattleV2UI();
  }

  // 🆕 D.28 Step 2：填 v2 左右欄屬性 + slot 名字 + 觀眾區
  function _fillBattleV2UI() {
    _fillAttrColumn('l', _player, 'player');
    _fillAttrColumn('r', _enemy,  'enemy');
    _fillSlotDisplay('player', _player);
    _fillSlotDisplay('enemy',  _enemy);
    _fillAudience();
    _updateMoodFaces();
    _setupTargeting();
  }

  // 🆕 D.28：目標選擇系統（1v1 自動選中，3v3 未來可點切換）
  let _currentTargetSlot = 1;   // 0/1/2，預設中間

  function _setupTargeting() {
    // 掛點擊 handler 到敵方 slot
    document.querySelectorAll('.bt-slot-enemy:not(.bt-slot-empty)').forEach(slot => {
      slot.onclick = () => {
        const idx = parseInt(slot.getAttribute('data-idx'), 10);
        _selectTarget(idx);
      };
    });
    // 預設中間
    _selectTarget(1);
  }

  function _selectTarget(slotIdx) {
    _currentTargetSlot = slotIdx;
    // 清除所有 target class，設給選中的那個
    document.querySelectorAll('.bt-slot-enemy').forEach(s => s.classList.remove('bt-target'));
    const target = document.querySelector(`.bt-slot-enemy[data-idx="${slotIdx}"]`);
    if (target && !target.classList.contains('bt-slot-empty')) {
      target.classList.add('bt-target');
    }
    // 未來 3v3：_enemy = _enemyTeam[slotIdx]
  }

  function _fillAttrColumn(side, unit, kind) {
    if (!unit) return;
    const prefix = 'bt-' + side;
    // Name / title
    _setTxt('bt-' + (side === 'l' ? 'lname' : 'rname'), unit.name || '—');
    const def = (kind === 'enemy') ? (TB_ENEMIES[_enemy.id] || {}) : {};
    _setTxt('bt-' + (side === 'l' ? 'ltitle' : 'rtitle'),
            kind === 'enemy' ? (def.title || unit.title || '') : '角鬥士');

    // Stats
    const statsEl = document.getElementById(prefix + '-stats');
    if (statsEl) {
      const keys = ['STR','DEX','CON','AGI','WIL','LUK'];
      statsEl.innerHTML = keys.map(k =>
        `<span class="k">${k}</span><span class="v">${unit[k] || 0}</span>`
      ).join('');
    }

    // Derived
    const d = unit.derived || {};
    const drvEl = document.getElementById(prefix + '-derived');
    if (drvEl) {
      const rc = ROUTE_CFG[d.route] || { color:'#888', label:'?', icon:'?' };
      drvEl.innerHTML =
        `<span class="k">ATK</span><span class="v">${d.ATK || 0}</span>` +
        `<span class="k">DEF</span><span class="v">${d.DEF || 0}</span>` +
        `<span class="k">SPD</span><span class="v">${d.SPD || 0}</span>` +
        `<span class="k">ACC</span><span class="v">${d.ACC || 0}%</span>` +
        `<span class="k">CRT</span><span class="v">${d.CRT || 0}%</span>` +
        `<span class="k">EVA</span><span class="v">${d.EVA || 0}%</span>` +
        `<span class="k">路線</span><span class="v" style="color:${rc.color}">${rc.label}</span>`;
    }

    // Equipment
    const w  = TB_WEAPONS[unit.weaponId] || {};
    const ar = TB_ARMORS[unit.armorId]   || {};
    const sh = TB_SHIELDS[unit.shieldId] || {};
    const eqEl = document.getElementById(prefix + '-equip');
    if (eqEl) {
      eqEl.innerHTML =
        `<span class="k">武器</span><span class="v">${w.name || '—'}</span>` +
        `<span class="k">護甲</span><span class="v">${ar.name || '—'}</span>` +
        `<span class="k">盾</span><span class="v">${sh.name || '無'}</span>`;
    }

    // Traits（戰鬥相關 + 敵方的 passive/special）
    const trEl = document.getElementById(prefix + '-traits');
    if (trEl) {
      if (kind === 'enemy') {
        const lines = [];
        if (def.passiveDesc) lines.push(`<div>【被動】${def.passiveDesc}</div>`);
        if (def.specialDesc) lines.push(`<div>【特技】${def.specialDesc}</div>`);
        if (def.weakPoint)   lines.push(`<div style="color:#6699aa">【弱點】${def.weakPoint}</div>`);
        trEl.innerHTML = lines.join('') || '<div style="color:#887766">無</div>';
      } else {
        const p = Stats.player;
        const traits = Array.isArray(p?.traits) ? p.traits : [];
        if (traits.length === 0) {
          trEl.innerHTML = '<div style="color:#887766">無</div>';
        } else {
          trEl.innerHTML = traits.map(t => {
            const td = (typeof Config !== 'undefined' && Config.TRAIT_DEFS) ? Config.TRAIT_DEFS[t] : null;
            const name = td?.name || t;
            return `<div>${name}</div>`;
          }).join('');
        }
      }
    }
  }

  function _fillSlotDisplay(side, unit) {
    // 更新 slot 內部的名字（玩家／敵人）
    const nameId = side === 'player' ? 'bt-pname' : 'bt-ename';
    _setTxt(nameId, unit?.name || '—');
  }

  function _fillAudience() {
    const el = document.getElementById('bt-audience');
    if (!el) return;
    // 顯示主人 / 長官 / 侍從（如果有在場）
    const watchers = ['masterArtus', 'officer', 'masterServant', 'overseer'];
    const names = {
      masterArtus: '阿圖斯',
      officer: '塔倫',
      masterServant: '侍從',
      overseer: '監督官',
    };
    const present = watchers.filter(id => {
      const npc = (typeof teammates !== 'undefined' && teammates.getNPC) ? teammates.getNPC(id) : null;
      return npc && npc.alive !== false;
    });
    if (present.length === 0) {
      el.innerHTML = '<span class="bt-aud-item" style="opacity:0.4">（場邊無人）</span>';
      return;
    }
    el.innerHTML = present.map(id =>
      `<span class="bt-aud-item">👤 ${names[id] || id}</span>`
    ).join('');
  }

  // 根據 HP 百分比 + 心情更新臉色（純視覺，不影響數值）
  function _updateMoodFaces() {
    const playerFaceIds = ['bt-face-player', 'bt-pface'];
    const enemyFaceIds  = ['bt-face-enemy',  'bt-eface'];
    const playerHpPct = _player ? (_player.hp / _player._hpMax) : 1;
    const enemyHpPct  = _enemy  ? (_enemy.hp  / _enemy._hpMax)  : 1;
    const playerMood  = (typeof Stats !== 'undefined') ? (Stats.player?.mood || 50) : 50;

    // 玩家：hp < 30% → 紫，hp < 60% 或 mood < 30 → 藍，else 綠
    let pFace = '💚', pCls = 'bt-face-green';
    if (playerHpPct < 0.30) { pFace = '🟣'; pCls = 'bt-face-purple'; }
    else if (playerHpPct < 0.60 || playerMood < 30) { pFace = '🔵'; pCls = 'bt-face-blue'; }

    playerFaceIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = pFace;
      el.classList.remove('bt-face-green', 'bt-face-blue', 'bt-face-purple');
      el.classList.add(pCls);
    });

    // 敵人：hp < 30% → 紫，hp < 60% → 藍，else 綠
    let eFace = '💚', eCls = 'bt-face-green';
    if (enemyHpPct < 0.30) { eFace = '🟣'; eCls = 'bt-face-purple'; }
    else if (enemyHpPct < 0.60) { eFace = '🔵'; eCls = 'bt-face-blue'; }

    enemyFaceIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = eFace;
      el.classList.remove('bt-face-green', 'bt-face-blue', 'bt-face-purple');
      el.classList.add(eCls);
    });

    // 🆕 同步左右欄 HP/ATB bar
    _syncSideBars();
  }

  // 🆕 同步左右欄的 HP 和 ATB bar 顯示
  function _syncSideBars() {
    if (!_player || !_enemy) return;
    // 左欄（玩家）
    const lhpBar = document.getElementById('bt-lhp-bar');
    const lhpTxt = document.getElementById('bt-lhp-txt');
    const latbBar = document.getElementById('bt-latb-bar');
    if (lhpBar) lhpBar.style.width = Math.max(0, (_player.hp / _player._hpMax) * 100) + '%';
    if (lhpTxt) lhpTxt.textContent = `${_player.hp}/${_player._hpMax}`;
    if (latbBar) latbBar.style.width = Math.min(100, _playerAtb) + '%';
    // 右欄（敵人）
    const rhpBar = document.getElementById('bt-rhp-bar');
    const rhpTxt = document.getElementById('bt-rhp-txt');
    const ratbBar = document.getElementById('bt-ratb-bar');
    if (rhpBar) rhpBar.style.width = Math.max(0, (_enemy.hp / _enemy._hpMax) * 100) + '%';
    if (rhpTxt) rhpTxt.textContent = `${_enemy.hp}/${_enemy._hpMax}`;
    if (ratbBar) ratbBar.style.width = Math.min(100, _enemyAtb) + '%';
  }

  function _fillEnemyInfo() {
    const def = TB_ENEMIES[_enemy.id] || {};
    const d   = _enemy.derived;
    const fameTierNames = ['無名','初出茅廬','小有名氣','競技老手','場上傳說','不敗之名'];
    const fTier = Math.min(5, Math.floor((_enemy.fame || 0) / 20));

    _setTxt('bt-ei-name',    def.name  || _enemy.name);
    _setTxt('bt-ei-title',   `【${def.title || _enemy.title || ''}】${fameTierNames[fTier]}`);
    _setTxt('bt-ei-passive', def.passiveDesc ? `【被動】${def.passiveDesc}` : '');
    _setTxt('bt-ei-special', def.specialDesc ? `【特技】${def.specialDesc}` : '');
    _setTxt('bt-ei-weak',    def.weakPoint   ? `【弱點】${def.weakPoint}`   : '');

    // 6 base attrs
    const attrMap = { STR:'力量', DEX:'靈巧', CON:'體質', AGI:'反應', WIL:'意志', LUK:'幸運' };
    const el = document.getElementById('bt-ei-attrs');
    if (el) {
      el.innerHTML = Object.entries(attrMap).map(([k, cn]) =>
        `<span class="bt-attr-item"><span class="bt-attr-k">${cn}</span><span class="bt-attr-v">${_enemy[k] || 0}</span></span>`
      ).join('');
    }

    // Derived stats + route badge
    const rc = ROUTE_CFG[d.route] || { color:'#888', label:'?', icon:'?' };
    const drvEl = document.getElementById('bt-ei-derived');
    if (drvEl) {
      drvEl.innerHTML =
        `<span style="color:${rc.color}">${rc.icon} ${rc.label}路線</span>　` +
        `ATK<b>${d.ATK}</b> DEF<b>${d.DEF}</b> HP<b>${d.hpMax}</b> ` +
        `ACC<b>${d.ACC}%</b> EVA<b>${d.EVA}%</b> CRT<b>${d.CRT}%</b> ` +
        `SPD<b>${d.SPD}</b> BLK<b>${d.BLK}%</b> BpWr<b>${d.BpWr}%</b>`;
    }

    // Equipment
    const w  = TB_WEAPONS[_enemy.weaponId]  || {};
    const ar = TB_ARMORS[_enemy.armorId]    || {};
    const sh = TB_SHIELDS[_enemy.shieldId]  || {};
    _setTxt('bt-ei-equip', `武器：${w.name || '—'}　護甲：${ar.name || '—'}　盾牌：${sh.name || '無'}`);
  }

  function _setTxt(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // ══════════════════════════════════════════════════════
  // PUBLIC: doAction(action)
  // ══════════════════════════════════════════════════════
  function doAction(action) {
    if (!_active) return;
    if (_playerAtb < 100) return;     // ATB: must wait for bar to fill
    if (_hardcoreActive) _clearHcCountdown(); // 玩家及時行動，取消倒數
    _setButtons(false);

    if (action === 'special') {
      if (_player.gauge >= TBC.GAUGE_MAX) {
        // ── 大招（100%）──
        if (TB_releaseSpecial(_player)) {
          const sp = TBC.SPECIALS[_player.gaugeRoute];
          _appendLog(`【${_player.name}】釋放【${sp.name}】！持續 ${sp.turns} 回合。`, 'log-special');
          _appendLog(`  ${SPECIAL_FULL_DESC[_player.gaugeRoute] || ''}`, 'log-special');
          _updateSkillDisplay();
        }
        // 大招走正常流程（下方 _playerAtb=0 + cleanup）
      } else if (_player.gauge >= 50) {
        // ── 小技（50%）── 內部自行處理 ATB 歸零與 cleanup，直接 return
        _activateHalfSkill();
        return;
      } else {
        _appendLog('▸ 技能條不足（需 50%+）！', 'log-system');
        _playerAtb = 100;
        _setButtons(true);
        _checkSpecialReady();
        return;
      }
    } else if (action === 'defend') {
      const r = TB_defend(_player);
      _appendLog(r.log, 'log-system');
    } else {
      _playerAttack();
    }

    _playerAtb = 0;                   // Reset ATB — bar must refill before next action

    if (!_checkDeath()) {
      _endTurnCleanup_atb();
    }
  }

  // ── 50% 小技能啟動（doAction 的 'special' 分支在 gauge≥50 時呼叫）──
  function _activateHalfSkill() {
    const route = _player.gaugeRoute;
    const hs    = HALF_SPECIALS[route];

    if (route === 'rage') {
      // 爆筋：下次攻擊 ATK+60%（即時，delay=0）
      _player.gauge   -= 50;
      _player._burstVein = true;
      _appendLog(`【爆筋】${hs.desc}`, 'log-special');
      _updateSkillDisplay();
      _playerAtb = 0;
      if (!_checkDeath()) _endTurnCleanup_atb();

    } else if (route === 'focus') {
      // 瞬刺：delay=1 個 ATB 週期，期間被打即中斷（gauge 不消耗）
      const delayTicks = Math.max(5, Math.round(100 / _calcFillRate(_player)));
      _playerDelay      = delayTicks;
      _playerDelaySkill = 'half_focus';
      _appendLog(`【瞬刺蓄力】約 ${(delayTicks * 0.1).toFixed(1)} 秒後自動發動（被打即中斷）`, 'log-special');
      _setButtons(false);
      _playerAtb = 0;
      _updateSkillDisplay();
      // 不呼叫 cleanup — delay 期間 ATB 自行推進

    } else if (route === 'fury') {
      // 強架：下次受擊傷害 -80%（即時，delay=0）
      _player.gauge   -= 50;
      _player._powerBlock = true;
      _appendLog(`【強架】${hs.desc}`, 'log-special');
      _updateSkillDisplay();
      _playerAtb = 0;
      if (!_checkDeath()) _endTurnCleanup_atb();
    }
  }

  // ── Delay 計時結束後自動發動（由 _atbTick 呼叫）──
  function _executeDelayedSkill() {
    const skill       = _playerDelaySkill;
    _playerDelaySkill = null;
    _playerDelay      = 0;

    if (skill === 'half_focus') {
      _appendLog(`【瞬刺發動！】必中 + 暴擊+20%`, 'log-special');
      _player.gauge -= 50;

      // 暫時提升派生屬性
      const savedACC = _player.derived.ACC;
      const savedCRT = _player.derived.CRT;
      _player.derived.ACC = 100;
      _player.derived.CRT = Math.min(75, savedCRT + 20);

      _playerAttack();

      _player.derived.ACC = savedACC;
      _player.derived.CRT = savedCRT;

      _playerAtb = 0;
      _updateSkillDisplay();
      if (!_checkDeath()) _endTurnCleanup_atb();
    }
  }

  function _playerAttack() {
    const w    = TB_WEAPONS[_player.weaponId];
    const hits = w && w.dualHit ? 2 : 1;

    // D.1.13: 播放武器揮動音效（依武器類型）
    SoundManager.playSfx(w?.type ? `swing_${w.type}` : 'swing_blade');

    // 爆筋：暫時提升 ATK×1.6
    let savedATK = null;
    if (_player._burstVein) {
      _player._burstVein = false;
      savedATK = _player.derived.ATK;
      _player.derived.ATK = Math.round(savedATK * 1.6);
      _appendLog(`  ★ 爆筋觸發：ATK ${savedATK} → ${_player.derived.ATK}`, 'log-special');
      SoundManager.playSfx('skill_rage');  // D.1.13
    }

    // 🆕 2026-04-25c 不屈 ATK +30%：buff 期間每次攻擊都套（不疊加爆筋以免破壞數值）
    let savedATKUnyielding = null;
    if (_player._unyieldingBuffTurns > 0) {
      savedATKUnyielding = _player.derived.ATK;
      _player.derived.ATK = Math.round(savedATKUnyielding * 1.30);
      _appendLog(`  ✦ 不屈：ATK ${savedATKUnyielding} → ${_player.derived.ATK}（剩 ${_player._unyieldingBuffTurns} 回合）`, 'log-special');
    }

    // 🆕 2026-04-27 強力斬：蓄完力的這擊 ATK×2.0 + 無視 15 DEF
    let savedATKPower = null, savedEnemyDEF = null;
    if (_player._powerCharging) {
      _player._powerCharging = false;
      savedATKPower = _player.derived.ATK;
      savedEnemyDEF = _enemy.derived.DEF;
      _player.derived.ATK = Math.round(savedATKPower * 2.0);
      _enemy.derived.DEF  = Math.max(0, savedEnemyDEF - 15);
      _appendLog(`⚔💥 強力斬！ATK ${savedATKPower} → ${_player.derived.ATK}，無視 15 DEF`, 'log-special');
      if (typeof SoundManager !== 'undefined') SoundManager.playSfx('hit_crit');
      if (typeof Game !== 'undefined' && Game.shakeGameRoot) Game.shakeGameRoot();
    }

    for (let i = 0; i < hits; i++) {
      if (_enemy.hp <= 0) break;
      const r = TB_attack(_player, _enemy, { turn: _turn });
      _applyDamage(_enemy, r.damage, r.counterDamage ? _player : null, r.counterDamage);
      // 🆕 2026-04-20 v3：攻擊動畫帶 result 觸發（miss/block/hit 不同光）
      _playAttackAnim('player', { hit: r.hit, blocked: r.blocked, crit: r.crit });
      _appendLog((hits > 1 ? `[第${i+1}擊] ` : '') + r.log,
        r.crit ? 'log-crit' : r.hit ? '' : 'log-miss');
      // D.1.13: 依結果播放命中音效
      if (r.hit) {
        if (r.crit)         SoundManager.playSfx('hit_crit');
        else if (r.blocked) SoundManager.playSfx('hit_block');
        else                SoundManager.playSfx('hit_flesh');
      } else {
        SoundManager.playSfx('hit_miss');
      }
      if (r.injuredPart)   _appendLog(`  ※ ${_enemy.name}【${r.injuredPart}】受傷（${r.injuryLevel}）`, 'log-injury');
      if (r.counterDamage) _appendLog(`  ↩ 反擊！玩家受到 ${r.counterDamage} 傷害`, 'log-crit');
      // killAura
      if (r.hit && _player._killIntimActivated && !_player._killAuraApplied && _player._killIntimBonus > 0) {
        _player._killAuraApplied = true;
        const nP2e = TB_calcPressure(_player, _enemy);
        if (nP2e.penalty > (_enemy._pressurePenalty || 0)) {
          TB_applyPressure(_enemy, nP2e.penalty, _player.name + '（殺戮美學）');
          _appendLog(`  ★ 殺戮美學觸發！威嚇加深 -${Math.round(nP2e.penalty*100)}%`, 'log-special');
        }
      }
    }

    // 恢復爆筋暫時提升的 ATK
    if (savedATK !== null) _player.derived.ATK = savedATK;
    // 🆕 2026-04-25c 恢復不屈 ATK
    if (savedATKUnyielding !== null) _player.derived.ATK = savedATKUnyielding;
    // 🆕 2026-04-27 強力斬：恢復 ATK + 敵人 DEF
    if (savedATKPower !== null)  _player.derived.ATK = savedATKPower;
    if (savedEnemyDEF !== null)  _enemy.derived.DEF  = savedEnemyDEF;
  }

  // ══════════════════════════════════════════════════════
  // ENEMY TURN
  // ══════════════════════════════════════════════════════
  function _enemyTurn() {
    if (!_active || _enemy.hp <= 0) { _endTurnCleanup_atb(); return; }

    const decision = TB_bossDecide(_enemy, _player, { turn: _turn });
    // 🆕 2026-04-27 嘲諷：被嘲諷期間強制 'attack'、不能 special / triple / charge
    if (_enemy._tauntedTurns > 0 && decision.action !== 'attack') {
      decision.action = 'attack';
      decision.log = `${_enemy.name} 被嘲諷激怒、撲上來攻擊！`;
    }
    const isBigMove = ['triple_stab','mountain_crash','special_release'].includes(decision.action);
    if (decision.log) _appendLog(decision.log, isBigMove ? 'log-special' : 'log-system');

    switch (decision.action) {
      case 'attack': {
        // 🆕 2026-04-27 反擊主動：預備姿態 → 強制 100% 格擋並反擊 ATK×1.5
        if (_player._riposteStance) {
          _player._riposteStance = false;
          _player._riposteStanceTurns = 0;
          const counterDmg = Math.max(1, Math.round(_player.derived.ATK * 1.5));
          _enemy.hp = Math.max(0, _enemy.hp - counterDmg);
          _appendLog(`🛡✦ 反擊！${_player.name} 完美格擋並反擊 — ${_enemy.name} 受到 ${counterDmg} 傷害！`, 'log-special');
          _playAttackAnim('enemy', { hit: false, blocked: true, crit: false });
          _playAttackAnim('player', { hit: true, blocked: false, crit: true });
          if (typeof SoundManager !== 'undefined') {
            SoundManager.playSfx('hit_block');
            setTimeout(() => SoundManager.playSfx('hit_crit'), 200);
          }
          if (typeof Game !== 'undefined' && Game.shakeGameRoot) Game.shakeGameRoot();
          break;   // 跳過正常攻擊判定
        }

        const r = TB_attack(_enemy, _player, { turn: _turn });
        _applyDamage(_player, r.damage, r.counterDamage ? _enemy : null, r.counterDamage);
        // 🆕 2026-04-20 v3：敵方攻擊動畫（帶 result）
        _playAttackAnim('enemy', { hit: r.hit, blocked: r.blocked, crit: r.crit });
        _appendLog(r.log, r.crit ? 'log-crit' : r.hit ? '' : 'log-miss');
        if (r.injuredPart) _appendLog(`  ※ 玩家【${r.injuredPart}】受傷（${r.injuryLevel}）`, 'log-injury');
        // 🆕 2026-04-25c 反擊（被動）：玩家成功閃避（!hit 且 !blocked）→ 35% 機率立刻反擊 ATK×0.8
        if (!r.hit && !r.blocked && Stats.hasSkill && Stats.hasSkill('counter')
            && _enemy.hp > 0 && Math.random() < 0.35) {
          const counterDmg = Math.max(1, Math.round(_player.derived.ATK * 0.80));
          _enemy.hp = Math.max(0, _enemy.hp - counterDmg);
          _appendLog(`  ↩✦ 反擊！閃避瞬間 ${_player.name} 揮出反擊 — ${_enemy.name} 受到 ${counterDmg} 傷害`, 'log-special');
          _playAttackAnim('player', { hit: true, blocked: false, crit: false });
          if (typeof SoundManager !== 'undefined') SoundManager.playSfx('hit_flesh');
        }
        break;
      }
      case 'mountain_crash': {
        const r = TB_attack(_enemy, _player, { turn: _turn }, { mountainCrash: true });
        _applyDamage(_player, r.damage, null, 0);
        // 🆕 2026-04-20 v3：mountain_crash 也帶動畫（通常必中）
        _playAttackAnim('enemy', { hit: r.hit, blocked: r.blocked, crit: true });
        _appendLog(r.log, 'log-crit');
        if (r.injuredPart) _appendLog(`  ※ 玩家【${r.injuredPart}】受傷（${r.injuryLevel}）`, 'log-injury');
        break;
      }
      case 'triple_stab': {
        for (let i = 0; i < 3; i++) {
          if (_player.hp <= 0) break;
          const r = TB_attack(_enemy, _player, { turn: _turn });
          _applyDamage(_player, r.damage, r.counterDamage ? _enemy : null, r.counterDamage);
          // 🆕 2026-04-20 v3：每刺都播動畫
          _playAttackAnim('enemy', { hit: r.hit, blocked: r.blocked, crit: r.crit });
          _appendLog(`  [刺${i+1}] ${r.log}`, r.crit ? 'log-crit' : r.hit ? '' : 'log-miss');
        }
        break;
      }
      case 'defend': {
        TB_defend(_enemy);
        break;
      }
      case 'counter_stance':
      case 'charge':
        _updateSkillDisplay();
        break;
      case 'special_release': {
        const eSp = TBC.SPECIALS[_enemy.gaugeRoute];
        if (eSp) _appendLog(`  ${SPECIAL_FULL_DESC[_enemy.gaugeRoute] || ''}`, 'log-special');
        _updateSkillDisplay();
        break;
      }
    }

    if (!_checkDeath()) {
      _endTurnCleanup_atb();
    }
  }

  function _endTurnCleanup() {
    if (!_active) return;

    const pMsg = TB_endTurnGauge(_player);
    const eMsg = TB_endTurnGauge(_enemy);
    if (pMsg) _appendLog(pMsg, 'log-system');
    if (eMsg) _appendLog(eMsg, 'log-system');

    // Gruen passive regen
    if (_enemy.passive === 'regen5') {
      const regenCap = Math.round(_enemy._hpMax * 0.5);
      const regen    = Math.min(3, Math.max(0, regenCap - _enemy.hp));
      if (regen > 0) {
        _enemy.hp = Math.min(_enemy._hpMax, _enemy.hp + regen);
        _appendLog(`  ${_enemy.name} 被動回血 +${regen}`, 'log-system');
      }
    }

    _turn++;
    _appendLog(`── 回合 ${_turn} ──`, 'log-turn');
    const rd = document.getElementById('bt-round');
    if (rd) rd.textContent = `第 ${_turn} 回合`;

    _updateCombatantUI();
    _updateSkillDisplay();
    _setButtons(true);
    _checkSpecialReady();
  }

  // ATB version: no _setButtons — ATB tick re-enables when bar fills
  function _endTurnCleanup_atb() {
    if (!_active) return;

    const pMsg = TB_endTurnGauge(_player);
    const eMsg = TB_endTurnGauge(_enemy);
    if (pMsg) _appendLog(pMsg, 'log-system');
    if (eMsg) _appendLog(eMsg, 'log-system');

    // Gruen passive regen
    if (_enemy.passive === 'regen5') {
      const regenCap = Math.round(_enemy._hpMax * 0.5);
      const regen    = Math.min(3, Math.max(0, regenCap - _enemy.hp));
      if (regen > 0) {
        _enemy.hp = Math.min(_enemy._hpMax, _enemy.hp + regen);
        _appendLog(`  ${_enemy.name} 被動回血 +${regen}`, 'log-system');
      }
    }

    _turn++;
    _appendLog(`── 回合 ${_turn} ──`, 'log-turn');
    const rd = document.getElementById('bt-round');
    if (rd) rd.textContent = `第 ${_turn} 回合`;

    // 🆕 2026-04-25c 不屈 buff 倒數
    if (_player && _player._unyieldingBuffTurns > 0) {
      _player._unyieldingBuffTurns--;
      if (_player._unyieldingBuffTurns === 0) {
        _appendLog(`  ✦ 不屈效果結束。`, 'log-system');
      }
    }

    // 🆕 2026-04-27 主動技能 cooldown 倒數 + 各 buff 倒數
    Object.keys(_activeSkillCD).forEach(id => {
      if (_activeSkillCD[id] > 0) _activeSkillCD[id]--;
    });
    if (_player) {
      // 戰吼 buff
      if (_player._warCryTurns > 0) {
        _player._warCryTurns--;
        if (_player._warCryTurns === 0) {
          _player.derived.ATK -= (_player._warCryATKBonus || 0);
          _player._warCryATKBonus = 0;
          _appendLog(`  ✦ 戰吼效果結束。`, 'log-system');
        }
      }
      // 嘲諷 buff
      if (_player._tauntTurns > 0) {
        _player._tauntTurns--;
        if (_player._tauntTurns === 0) {
          _player.derived.DEF -= (_player._tauntDefBonus || 0);
          _player.derived.BLK -= (_player._tauntBlkBonus || 0);
          _player._tauntDefBonus = 0;
          _player._tauntBlkBonus = 0;
          _appendLog(`  ✦ 嘲諷效果結束。`, 'log-system');
        }
      }
      // 反擊預備（一次性、敵人攻擊後就清掉，這裡是 fallback 倒數）
      if (_player._riposteStanceTurns > 0) {
        _player._riposteStanceTurns--;
        if (_player._riposteStanceTurns === 0) {
          _player._riposteStance = false;
          _appendLog(`  ✦ 反擊姿態解除。`, 'log-system');
        }
      }
    }
    if (_enemy && _enemy._tauntedTurns > 0) {
      _enemy._tauntedTurns--;
    }

    _updateCombatantUI();
    _updateSkillDisplay();
    _renderActiveSkillsBar();   // 🆕 每回合更新
    // Note: _setButtons is intentionally omitted — ATB loop handles it
  }

  // ══════════════════════════════════════════════════════
  // DEATH CHECK / END BATTLE
  // ══════════════════════════════════════════════════════
  function _checkDeath() {
    if (_enemy.hp <= 0) {
      _appendLog(`\n勝利！${_enemy.name} 已倒下。`, 'log-win');
      _endBattle(true);
      return true;
    }
    if (_player.hp <= 0) {
      _appendLog(`\n敗北。你倒在競技場的血泊中。`, 'log-die');
      _endBattle(false);
      return true;
    }
    return false;
  }

  // ── Rating calculation ──────────────────────────────────
  function _calcRating() {
    const hpPct = _player.hp / _player._hpMax;
    // 效率殺手特性：評分 tick 閾值各降 10%
    const eff   = Stats.player.traits?.includes('efficiency') ? 0.9 : 1.0;
    const tS    = Math.round(RATING_TICKS.S * eff);
    const tA    = Math.round(RATING_TICKS.A * eff);
    const tB    = Math.round(RATING_TICKS.B * eff);
    if (_battleTick <= tS && hpPct > 0.70) return 'S';
    if (_battleTick <= tA && hpPct > 0.40) return 'A';
    if (_battleTick <= tB)                 return 'B';
    return 'C';
  }

  // ── 成就定義表 ────────────────────────────────────────────
  const ACHIEVEMENTS = [
    {
      id: 'bloody_1', name: '嗜血狂魔 Lv.1', desc: '砍首 10 人',
      check: cs => cs.executionCount >= 10,
      reward: { trait: 'bloodthirst' },
      rewardDesc: '特性【窮凶惡極】：開場威嚇 +10%',
    },
    {
      id: 'bloody_2', name: '嗜血狂魔 Lv.2', desc: '砍首 25 人',
      check: cs => cs.executionCount >= 25,
      reward: { trait: 'executioner', title: '劊子手' },
      rewardDesc: '稱號【劊子手】：低名聲對手開場心理崩潰 -20%',
    },
    {
      id: 'mercy_1', name: '仁慈之心 Lv.1', desc: '饒恕 10 人',
      check: cs => cs.spareCount >= 10,
      reward: { trait: 'kindness' },
      rewardDesc: '特性【寬厚】：隊友好感成長速度 +20%',
    },
    {
      id: 'perfectionist', name: '完美主義者', desc: 'S 評分 5 場',
      check: cs => cs.sRankCount >= 5,
      reward: { trait: 'efficiency' },
      rewardDesc: '特性【效率殺手】：評分 tick 閾值各降 10%',
    },
    {
      id: 'streak_5', name: '連勝者', desc: '競技場連續勝利 5 場',
      check: cs => (cs.winStreak || 0) >= 5,
      reward: { fameBase: 5 },
      rewardDesc: '名聲基礎加成 +5（每場競技場）',
    },
  ];

  function _checkAchievements() {
    const p   = Stats.player;
    const cs  = p.combatStats;
    if (!Array.isArray(p.achievements)) p.achievements = [];
    if (!Array.isArray(p.traits))       p.traits       = [];

    for (const ach of ACHIEVEMENTS) {
      if (p.achievements.includes(ach.id)) continue;
      if (!ach.check(cs)) continue;

      // ── 解鎖 ──
      p.achievements.push(ach.id);
      if (ach.reward.trait   && !p.traits.includes(ach.reward.trait))
        p.traits.push(ach.reward.trait);
      if (ach.reward.title)  p.title    = ach.reward.title;
      if (ach.reward.fameBase) p.fameBase = (p.fameBase || 0) + ach.reward.fameBase;

      // ── 通知 ──
      _appendLog(
        `\n╔═══ 成就解鎖 ═══╗\n  🏆 【${ach.name}】\n  ${ach.rewardDesc}\n╚════════════════╝`,
        'log-special'
      );
      Game.addLog(`🏆 成就解鎖：【${ach.name}】　${ach.rewardDesc}`, '#d4af37', false);
      _showAchievementToast(ach.name);
      SoundManager.playSfx('achievement');  // D.1.13
    }
  }

  // 開場特性套用（壓制計算後呼叫）
  function _applyOpeningTraits() {
    const traits = Stats.player.traits || [];
    if (!traits.length) return;

    // 窮凶惡極：額外施加 10% 威嚇
    if (traits.includes('bloodthirst')) {
      TB_applyPressure(_enemy, 0.10, '窮凶惡極');
      _appendLog(`  ★ 【窮凶惡極】額外威嚇 ${_enemy.name} -10%！`, 'log-special');
    }

    // 劊子手：低名聲敵人（fame<30）開場心理崩潰 -20%
    if (traits.includes('executioner') && (_enemy.fame || 0) < 30) {
      TB_applyPressure(_enemy, 0.20, '劊子手');
      _appendLog(`  ★ 【劊子手】${_enemy.name} 聽聞你名號，心理崩潰 -20%！`, 'log-special');
    }
  }

  function _showAchievementToast(name) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = `🏆 成就解鎖：【${name}】`;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 3500);
  }

  const RATING_CFG = {
    S: { label:'S 迅雷', color:'#d4af37', fameMult:2.0,  desc:'快速制敵，技壓全場！' },
    A: { label:'A 穩健', color:'#88ccff', fameMult:1.5,  desc:'攻守得當，表現出色。' },
    B: { label:'B 消耗', color:'#c8a060', fameMult:1.0,  desc:'勝負已分，但不夠漂亮。' },
    C: { label:'C 殘喘', color:'#888888', fameMult:0.7,  desc:'勉強獲勝，差點倒在場上。' },
  };

  function _endBattle(won) {
    _active = false;
    _stopAtbLoop();
    _clearHcCountdown();
    _hardcoreActive = false;
    _stopAuto(true);   // 🆕 2026-04-25c：skipSave=true，戰後別覆寫玩家偏好
    _setButtons(false);
    _updateCombatantUI();

    // 🆕 2026-04-25c：HP 共用 — 戰後同步 _player.hp 回 Stats.player.hp
    //   設計：戰鬥受傷直接帶回訓練場、不會重置成滿血
    //   注意：直接寫 .hp（不走 modVital）— 避免 Orlan 死亡救援以「剛剛從 X 跌到 0」邏輯誤觸
    //   Orlan save 條件 `before > 0 && now <= 0` 在這個直接賦值不會被觀察到、是預期行為
    //   （Orlan 救援應該由實際的訓練場/競技場傷害觸發、不是 sync）
    if (_player && Stats.player) {
      Stats.player.hp = Math.max(0, Math.min(_player.hp, Stats.player.hpMax || _player._hpMax));
    }

    // D.1.13: 勝敗音效
    SoundManager.playSfx(won ? 'battle_victory' : 'battle_defeat');

    // Battle costs 1 time slot (2 hours)
    Stats.advanceTime(120);

    const resultText = won
      ? `【戰鬥勝利】擊倒 ${_enemy.name}，歷時 ${_turn} 回合。`
      : `【戰鬥落敗】倒在 ${_enemy.name} 腳下，第 ${_turn} 回合。`;
    Game.addLog(resultText, won ? '#d4af37' : '#cc3300', false);

    // ── Arena rating (won only) ──────────────────────────
    if (won && _isArenaBattle) {
      _lastRating = _calcRating();
      // D.1.13: 評分音效
      SoundManager.playSfx(`rating_${_lastRating.toLowerCase()}`);
      const rc    = RATING_CFG[_lastRating];
      const hpPct = Math.round(_player.hp / _player._hpMax * 100);
      // 連勝者特性：每場加固定名聲；fameBase 由成就解鎖後永久儲存
      // 🆕 2026-04-25c 平衡：使用者反饋 50 天就名聲 100 → 整體 ×0.5
      const fameAwarded = Math.round((_pendingFameReward + (Stats.player.fameBase || 0)) * rc.fameMult * 0.5);

      // Apply fame
      Stats.modFame(fameAwarded);

      // Update combatStats
      const cs = Stats.player.combatStats;
      cs.arenaWins++;
      cs.totalTicks += _battleTick;
      cs.winStreak   = (cs.winStreak || 0) + 1;
      if (_lastRating === 'S') cs.sRankCount++;
      if (_lastRating === 'A') cs.aRankCount++;

      // S/A rank affection bonuses (officer & master)
      // 🆕 2026-04-25c 平衡：8/4 → 4/2（同樣 ×0.5）
      if (_lastRating === 'S' || _lastRating === 'A') {
        const affBonus = _lastRating === 'S' ? 4 : 2;
        if (typeof teammates !== 'undefined') {
          teammates.modAffection('officer',     affBonus);
          teammates.modAffection('masterArtus', affBonus);
        }
      }
      // C rank stamina penalty
      if (_lastRating === 'C') {
        Stats.modVital('stamina', -15);
        _appendLog('  體力因過度消耗額外扣減 15。', 'log-injury');
      }

      // Log rating result
      const fameBaseNote = (Stats.player.fameBase || 0) > 0
        ? ` + 基底 ${Stats.player.fameBase}` : '';
      _appendLog(
        `\n╔═══ 競技場評分 ═══╗\n` +
        `  ${rc.label}　${rc.desc}\n` +
        `  行動次數：${_battleTick}　HP剩餘：${hpPct}%\n` +
        `  名聲獎勵：+${fameAwarded}（基礎 ${_pendingFameReward}${fameBaseNote} × ${rc.fameMult} × 0.5）\n` +
        `╚══════════════════╝`,
        'log-special'
      );
      Game.addLog(`【評分】${rc.label}　名聲 +${fameAwarded}`, rc.color, false);

      // 成就檢查（勝利後）
      _checkAchievements();

    } else if (!won && _isArenaBattle) {
      const cs = Stats.player.combatStats;
      cs.arenaLosses++;
      cs.winStreak = 0;   // 連勝中斷
    }

    if (won && _isArenaBattle) {
      // Show rating result briefly, then show finishing panel
      setTimeout(() => _showFinishPanel(), 1800);
    } else {
      // 🆕 2026-04-25c：非競技場勝利 / 任何戰敗 → 不自動關、顯示返回按鈕
      //   讓玩家有時間看戰鬥 log + 評分做戰術規劃
      setTimeout(() => {
        Game.renderAll();
        _pendingReturnAction = won ? _onWin : _onLose;
        _showReturnButton();
      }, 1200);
    }
  }

  // ── Finishing move panel ─────────────────────────────────
  function _showFinishPanel() {
    const rc    = RATING_CFG[_lastRating] || RATING_CFG.B;
    const mood  = CROWD_MOOD_CFG[_crowdMood] || CROWD_MOOD_CFG.neutral;
    const hpPct = Math.round(_player.hp / _player._hpMax * 100);

    const moodEl   = document.getElementById('bt-finish-mood');
    const ratingEl = document.getElementById('bt-finish-rating');
    const panel    = document.getElementById('bt-finish-panel');

    if (moodEl)   moodEl.textContent   = mood.hint;
    if (ratingEl) ratingEl.textContent = `評分：${rc.label}　HP剩餘：${hpPct}%`;
    if (panel)    panel.classList.add('open');
  }

  function finishChoice(choice) {
    const panel = document.getElementById('bt-finish-panel');
    if (panel) panel.classList.remove('open');

    const mood   = CROWD_MOOD_CFG[_crowdMood] || CROWD_MOOD_CFG.neutral;
    const fx     = mood[choice] || {};
    const cs     = Stats.player.combatStats;

    // Update cumulative stats
    if (choice === 'execute')  cs.executionCount++;
    if (choice === 'suppress') cs.suppressCount++;
    if (choice === 'spare')    cs.spareCount++;

    // 🆕 D.19：戰鬥結束選擇 → 驅動 mercy 軸
    //   execute  → negative（殘忍）
    //   spare    → positive（仁慈）
    //   suppress → 不影響道德（中性鎮壓）
    if (typeof Moral !== 'undefined') {
      if (choice === 'execute') Moral.push('mercy', 'negative');
      if (choice === 'spare')   Moral.push('mercy', 'positive');
    }

    // 成就檢查（砍首 / 饒恕達標時）
    _checkAchievements();

    // Apply crowd fame bonus
    if (fx.crowdFame) Stats.modFame(fx.crowdFame);

    // Apply NPC affection changes
    if (typeof teammates !== 'undefined') {
      if (fx.masterAff)    teammates.modAffection('masterArtus',   fx.masterAff);
      if (fx.officerAff)   teammates.modAffection('officer',       fx.officerAff);
      if (fx.melaAff)      teammates.modAffection('melaKook',      fx.melaAff);
      if (fx.dagiAff)      teammates.modAffection('dagiSlave',     fx.dagiAff);
      if (fx.oldSlaveAff)  teammates.modAffection('oldSlave',      fx.oldSlaveAff);
    }

    // Log
    const choiceText = { execute:'砍首', suppress:'踩臉', spare:'饒恕' };
    const fameSign   = fx.crowdFame >= 0 ? '+' : '';
    _appendLog(
      `【${choiceText[choice]}】${fx.crowdFame ? `觀眾名聲 ${fameSign}${fx.crowdFame}` : ''}`,
      choice === 'execute' ? 'log-crit' : choice === 'spare' ? 'log-system' : ''
    );
    Game.addLog(`【${choiceText[choice]}】`, choice === 'execute' ? '#cc3300' : choice === 'spare' ? '#336633' : '#c8a060', false);

    // 🆕 D.22c：斬首/饒恕氣氛演出（DialogueModal）
    const atmosphereLines = _buildFinishAtmosphere(choice, mood);

    // 🆕 2026-04-25c：返回按鈕在對白「開始」就出現（不等對白播完）
    //   設計理由：玩家可能不點對白純看戰鬥 log → 之前等 onComplete 永遠不燒
    //   現在：對白和按鈕同時出現，玩家自己決定要不要看完對白才返回
    setTimeout(() => {
      Game.renderAll();
      _pendingReturnAction = _onWin;
      _showReturnButton();   // 🆕 立刻出按鈕
      if (atmosphereLines.length > 0 && typeof DialogueModal !== 'undefined') {
        DialogueModal.play(atmosphereLines);   // 對白照樣播、不依賴 onComplete
      }
    }, 600);
  }

  // 🆕 D.22c：根據選擇 + 群眾氣氛產生氣氛敘述
  function _buildFinishAtmosphere(choice, moodCfg) {
    const lines = [];
    const hint = moodCfg.hint || '';

    if (choice === 'execute') {
      lines.push({ text: '你舉起武器。' });
      if (_crowdMood === 'bloodthirsty') {
        lines.push({ text: '觀眾席爆發出嗜血的歡呼——他們要的就是這個。' });
        lines.push({ text: '鮮血濺上沙地。聲音震耳。' });
        lines.push({ text: '你放下武器時，全場還在呼喊你的名字。' });
      } else if (_crowdMood === 'merciful') {
        lines.push({ text: '觀眾突然安靜了。' });
        lines.push({ text: '有人別過臉。有人搖頭。' });
        lines.push({ text: '你放下武器時，掌聲稀稀落落，像在下一場冷雨。' });
      } else {
        lines.push({ text: '觀眾靜靜看著。' });
        lines.push({ text: '武器落下的那一瞬——有人歡呼，有人沉默。' });
        lines.push({ text: '你放下武器，轉過身。沒有回頭。' });
      }
    } else if (choice === 'spare') {
      lines.push({ text: '你收回武器。' });
      if (_crowdMood === 'bloodthirsty') {
        lines.push({ text: '噓聲鋪天蓋地。他們覺得你搶走了他們的表演。' });
        lines.push({ text: '你的對手癱在地上，用無法理解的眼神看著你。' });
        lines.push({ text: '你轉身走開。背後的噓聲比劍更冷。' });
      } else if (_crowdMood === 'merciful') {
        lines.push({ text: '觀眾爆發出掌聲——不是為了戰鬥，是為了仁慈。' });
        lines.push({ text: '你的對手被人扶起來。他看了你一眼，什麼都沒說。' });
        lines.push({ text: '那一眼比任何感謝都重。' });
      } else {
        lines.push({ text: '觀眾的反應參差不齊。有人點頭，有人嘆氣。' });
        lines.push({ text: '你的對手掙扎著站起來。他不知道自己該恨你還是謝你。' });
      }
    } else { // suppress
      lines.push({ text: '你踩住對手。他掙扎了一下，然後不動了。' });
      lines.push({ text: '觀眾看夠了，開始散場。這場不算精彩——但你活著。' });
    }

    return lines;
  }

  // ══════════════════════════════════════════════════════
  // DAMAGE / LAST-STAND
  // ══════════════════════════════════════════════════════
  function _applyDamage(target, dmg, counterTarget, counterDmg) {
    // 強架（fury 50%）：受擊傷害 -80%
    if (target === _player && _player._powerBlock && dmg > 0) {
      const blocked = Math.round(dmg * 0.8);
      dmg -= blocked;
      _player._powerBlock = false;
      _appendLog(`  ⛊ 強架生效！傷害 ${dmg + blocked} → ${dmg}（減免 ${blocked}）`, 'log-special');
      _updateSkillDisplay();
    }

    // 瞬刺蓄力中斷：被打即取消（gauge 保留）
    if (target === _player && dmg > 0 && _playerDelay > 0) {
      _playerDelay      = 0;
      _playerDelaySkill = null;
      _appendLog(`  ⚡ 瞬刺被打斷！技能條保留。`, 'log-injury');
      _updateSkillDisplay();
      if (_playerAtb >= 100) { _setButtons(true); _checkSpecialReady(); }
    }

    // 🆕 2026-04-25c 不屈：致命一擊鎖死 1 HP（每場 1 次）
    //   觸發條件：玩家 + 該招會把 hp 打到 ≤0 + 已習得 unyielding + 本場未觸發
    if (target === _player && dmg > 0
        && target.hp - dmg <= 0
        && Stats.hasSkill && Stats.hasSkill('unyielding')
        && !target._unyieldingFired) {
      const origDmg = dmg;
      dmg = Math.max(0, target.hp - 1);   // 留 1 HP
      target._unyieldingFired = true;
      target._unyieldingBuffTurns = 5;
      _appendLog(`💀✦ 不屈！你應該倒下、但你站著。HP 鎖死 1。5 回合內 ATK +30%！`, 'log-special');
      _appendLog(`  （原傷 ${origDmg} → 削減為 ${dmg}）`, 'log-system');
      if (typeof Game !== 'undefined' && Game.shakeGameRoot) Game.shakeGameRoot();
      if (typeof SoundManager !== 'undefined') SoundManager.playSfx('skill_rage');
    }

    // 🆕 2026-04-25c 戰鬥意志：HP 跌破 50% 時 ATK+12 DEF+5（持續性 buff）
    //   每次受傷後檢查、第一次跌破時套加成、回血超過 50% 時取消
    if (target === _player && Stats.hasSkill && Stats.hasSkill('battleWill')) {
      // 預備：之後回合套用，這裡先 set 旗標讓 _playerTurn 讀
      const willBeBelow = (target.hp - dmg) < target._hpMax * 0.5;
      if (willBeBelow && !target._battleWillActive) {
        target._battleWillActive = true;
        target.derived.ATK += 12;
        target.derived.DEF += 5;
        _appendLog(`✦ 戰鬥意志覺醒！殘血反而更冷靜 — ATK +12 / DEF +5。`, 'log-special');
      }
    }

    const wasAbove30 = target.hp >= target._hpMax * 0.30;
    if (dmg > 0) {
      target.hp = Math.max(0, target.hp - dmg);
      // 🆕 2026-04-20 v3：移除這裡的攻擊動畫呼叫
      //   改到 _playerTurn / _enemyTurn 的 TB_attack 後，帶 result 觸發
      //   （好處：miss 也能播黃光 / blocked 能播藍光，不只 dmg>0 才動）
    }
    if (counterTarget && counterDmg > 0)
      counterTarget.hp = Math.max(0, counterTarget.hp - counterDmg);

    if (wasAbove30 && target.hp < target._hpMax * 0.30 && _active) {
      const opp = target === _player ? _enemy : _player;
      if (TB_triggerLastStand(target, opp)) {
        _appendLog(`【背水一戰】${target.name} HP跌破30%！恐懼消散，對 ${opp.name} 反施壓 -15%！`, 'log-special');
        _updateCombatantUI();
      }
    }
  }

  // ══════════════════════════════════════════════════════
  // UI HELPERS
  // ══════════════════════════════════════════════════════
  function _setButtons(enabled) {
    // 🆕 2026-04-25c：bt-btn-auto 從 disable 列表移除
    //   自動戰鬥按鈕應該永遠可按（戰鬥中也要能切換 自動/硬核/關閉 模式）
    //   之前 bug：自動戰鬥時主動攻擊→_setButtons(false)→自動鈕也被鎖→無法關閉
    ['bt-btn-attack','bt-btn-defend','bt-btn-special'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
    // 自動鈕只有戰鬥不在進行時才禁用（_active=false 時）
    const autoBtn = document.getElementById('bt-btn-auto');
    if (autoBtn) autoBtn.disabled = !_active;
  }

  function _checkSpecialReady() {
    if (!_player) return;
    const btn = document.getElementById('bt-btn-special');
    if (!btn) return;
    if (_player.gauge >= TBC.GAUGE_MAX) {
      btn.classList.add('special-ready');
      btn.classList.remove('half-ready');
      const sp = TBC.SPECIALS[_player.gaugeRoute];
      btn.textContent = `★ ${sp?.name || '大招'}`;
    } else if (_player.gauge >= 50) {
      btn.classList.add('special-ready');
      btn.classList.add('half-ready');
      const hs = HALF_SPECIALS[_player.gaugeRoute];
      btn.textContent = `◈ ${hs?.name || '小技'}`;
    } else {
      btn.classList.remove('special-ready');
      btn.classList.remove('half-ready');
      btn.textContent = '技 能';
    }
  }

  function _updateCombatantUI() {
    if (!_player || !_enemy) return;

    // 🆕 D.28：更新心情臉（依 HP 動態變色）
    _updateMoodFaces();

    // Player
    _setTxt('bt-pname',  _player.name);
    _setTxt('bt-ptitle', '角鬥士');
    _setBarUI('bt-php',    _player.hp,    _player._hpMax);
    _setGaugeUI('bt-pgauge', _player.gauge, _player.gaugeRoute);
    _setTxt('bt-pgauge-lbl', `儀表 (${_routeLabel(_player.gaugeRoute)})`);
    let pStatus = '';
    if (_playerDelay > 0) {
      pStatus = `【瞬刺蓄力】${Math.ceil(_playerDelay * 0.1)}s…`;
    } else if (_player._burstVein) {
      pStatus = '【爆筋待命】下次攻擊 ATK+60%';
    } else if (_player._powerBlock) {
      pStatus = '【強架待命】下次受擊 -80%';
    } else if (_player.gaugeActive) {
      const sp = TBC.SPECIALS[_player.gaugeRoute];
      pStatus = `【${sp?.name || '?'}】剩${_player.gaugeActiveLeft}回合`;
    }
    if (_player._pressurePenalty > 0)
      pStatus += (pStatus ? '　' : '') + `⚠受壓 -${Math.round(_player._pressurePenalty*100)}%`;
    _setTxt('bt-pstatus', pStatus);

    // Enemy
    _setTxt('bt-ename',  _enemy.name);
    _setTxt('bt-etitle', _enemy.title);
    _setBarUI('bt-ehp',    _enemy.hp,    _enemy._hpMax);
    _setGaugeUI('bt-egauge', _enemy.gauge, _enemy.gaugeRoute);
    _setTxt('bt-egauge-lbl', `儀表 (${_routeLabel(_enemy.gaugeRoute)})`);
    let eStatus = '';
    if (_enemy._counterStance) eStatus = '【反制姿態】';
    if (_enemy._charging)      eStatus = '【蓄力中…】';
    if (_enemy.gaugeActive) {
      const sp = TBC.SPECIALS[_enemy.gaugeRoute];
      eStatus += `【${sp?.name || '?'}】剩${_enemy.gaugeActiveLeft}回合`;
    }
    if (_enemy._pressurePenalty > 0)
      eStatus += (eStatus ? '　' : '') + `⚠受壓 -${Math.round(_enemy._pressurePenalty*100)}%`;
    _setTxt('bt-estatus', eStatus);

    _fillMiniStats('bt-p-mini', _player);
    _fillMiniStats('bt-e-mini', _enemy);

    // 🆕 裝備顯示
    _fillEquipInfo('bt-p-equip', _player);
    _fillEquipInfo('bt-e-equip', _enemy);
  }

  function _fillEquipInfo(targetId, unit) {
    let el = document.getElementById(targetId);
    if (!el) {
      // 動態建立裝備欄位（在 mini-stats 下方）
      const parent = document.getElementById(targetId.replace('-equip', '-mini'))?.parentElement;
      if (!parent) return;
      el = document.createElement('div');
      el.id = targetId;
      el.className = 'bt-equip-info';
      parent.appendChild(el);
    }
    const wName = _getWeaponName(unit.weaponId);
    const aName = _getArmorName(unit.armorId);
    const oName = _getOffhandName(unit.offhandId || unit.shieldId);
    const parts = [`⚔ ${wName}`];
    if (oName !== '—') parts.push(`🛡 ${oName}`);
    parts.push(`🦺 ${aName}`);
    el.innerHTML = parts.join('　');
  }

  function _getWeaponName(id) {
    if (!id || id === 'fists') return '空手';
    const w = (typeof TB_WEAPONS !== 'undefined') ? TB_WEAPONS[id] : null;
    if (w && w.name) return w.name;
    if (typeof Weapons !== 'undefined' && Weapons[id]) return Weapons[id].name;
    return id;
  }
  function _getArmorName(id) {
    if (!id || id === 'rags') return '破布';
    const a = (typeof TB_ARMORS !== 'undefined') ? TB_ARMORS[id] : null;
    return a ? a.name : id;
  }
  function _getOffhandName(id) {
    if (!id || id === 'none') return '—';
    const s = (typeof TB_SHIELDS !== 'undefined') ? TB_SHIELDS[id] : null;
    if (s) return s.name;
    return _getWeaponName(id);
  }

  function _fillMiniStats(targetId, unit) {
    const el = document.getElementById(targetId);
    if (!el || !unit) return;
    const d   = unit.derived;
    const pen = (unit._pressurePenalty || 0) > 0;
    const vc  = pen ? ' pressured' : '';
    const rows = [
      ['ATK',  d.ATK],        ['DEF',  d.DEF],        ['HP', `${Math.round(unit.hp)}/${unit._hpMax}`],
      ['ACC',  d.ACC + '%'],   ['EVA',  d.EVA + '%'],   ['SPD', d.SPD],
      ['BLK',  d.BLK + '%'],   ['BpWr', d.BpWr + '%'], ['CRT', d.CRT + '%'],
    ];
    el.innerHTML = rows.map(([k, v]) =>
      `<div class="bt-ms-item"><span class="bt-ms-lbl">${k}</span><span class="bt-ms-val${vc}">${v}</span></div>`
    ).join('');
  }

  function _updateSkillDisplay() {
    if (!_player || !_enemy) return;
    _fillSkillCard('bt-p', _player, false);
    _fillSkillCard('bt-e', _enemy,  true);
  }

  function _fillSkillCard(prefix, unit, isEnemy) {
    const route = unit.gaugeRoute;
    const rc    = ROUTE_CFG[route] || { color:'#888', label:route, icon:'?' };
    const sp    = TBC.SPECIALS[route];
    const card  = document.getElementById(prefix + '-skill-card');
    const pct   = Math.round(unit.gauge / TBC.GAUGE_MAX * 100);

    if (card) card.className = `bt-skill-card ${route}-card${unit.gaugeActive ? ' active-card' : ''}`;

    const routeEl = document.getElementById(prefix + '-sk-route');
    if (routeEl) routeEl.innerHTML =
      `<span style="color:${rc.color}">${rc.icon} ${isEnemy ? unit.name + ' · ' : ''}${rc.label}</span>`;

    const gaugeEl = document.getElementById(prefix + '-sk-gauge');
    if (gaugeEl) {
      gaugeEl.textContent = `儀表 ${pct}%`;
      gaugeEl.style.color = pct >= 100 ? '#ffcc44' : '#444456';
    }

    const nameEl = document.getElementById(prefix + '-sk-name');
    const descEl = document.getElementById(prefix + '-sk-desc');
    if (!nameEl || !descEl) return;

    if (unit.gaugeActive) {
      nameEl.textContent = `★ ${sp?.name || '?'} 發動中！`;
      nameEl.style.color = '#ffcc44';
      descEl.innerHTML   = `<span style="color:#ffcc44">剩餘 ${unit.gaugeActiveLeft} 回合</span>　<span style="color:#555568">${SPECIAL_FULL_DESC[route] || ''}</span>`;
    } else if (isEnemy && unit._charging) {
      nameEl.textContent = '▲ 山崩蓄力中…';
      nameEl.style.color = '#ff4422';
      descEl.innerHTML   = '<span style="color:#ff6644">下回合發動！傷害×2.5，觸發重傷判定</span>';
    } else if (isEnemy && unit._counterStance) {
      nameEl.textContent = '⟳ 反制姿態';
      nameEl.style.color = '#ff8844';
      descEl.innerHTML   = '<span style="color:#ff8844">此回合攻擊將觸發反擊！考慮防禦或等待</span>';
    } else {
      nameEl.textContent = sp ? `★ ${sp.name}` : '無特技';
      nameEl.style.color = pct >= 100 ? '#ffcc44' : (rc.color || '#888');
      const defData = TB_ENEMIES[unit.id];
      descEl.innerHTML   = pct >= 100
        ? `<span style="color:#ffcc44">儀表已滿！可釋放技能</span>`
        : `<span style="color:#555568">${defData?.specialDesc || SPECIAL_FULL_DESC[route] || '—'}</span>`;
    }
  }

  function _setBarUI(prefix, current, max) {
    const pct = max > 0 ? Math.max(0, (current / max) * 100) : 0;
    const bar = document.getElementById(prefix + '-bar');
    const txt = document.getElementById(prefix + '-txt');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = `${Math.max(0, Math.round(current))} / ${max}`;
  }

  function _setGaugeUI(prefix, value, route) {
    const pct = Math.min(100, Math.max(0, value));
    const bar = document.getElementById(prefix + '-bar');
    const txt = document.getElementById(prefix + '-txt');
    if (bar) { bar.style.width = pct + '%'; bar.className = `bt-bar-fill bt-gauge-fill ${route}`; }
    if (txt) txt.textContent = `${Math.round(value)} / 100`;
  }

  function _appendLog(text, cls) {
    const log = document.getElementById('bt-log');
    if (!log || (!text && cls !== 'log-turn')) return;
    const div = document.createElement('div');
    div.className = 'bt-log-line ' + (cls || '');
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  // ══════════════════════════════════════════════════════
  // PUBLIC: toggleAuto()
  // ══════════════════════════════════════════════════════
  // 循環：關閉 → 自動 → 硬核 → 關閉
  function toggleAuto() {
    // 🆕 2026-04-25c：cycle 中間狀態不存（_stopAuto skipSave=true）
    //   只在最終狀態存：startHardcore / stopHardcore / startAuto
    if (_autoRunning)         { _stopAuto(true);    _startHardcore(); }
    else if (_hardcoreActive) { _stopHardcore(); }
    else                      { _startAuto(); }
  }

  function _startAuto(skipSave) {
    if (!_active) return;
    _autoRunning = true;
    _updateAutoBtn();
    if (!skipSave) _saveAutoPref('auto');   // 🆕 玩家手動切才存、自動恢復不存
    if (_playerAtb >= 100 && _playerDelay <= 0) {
      const action = (_player.gauge >= TBC.GAUGE_MAX) ? 'special' : 'attack';
      doAction(action);
    }
  }

  function _stopAuto(skipSave) {
    _autoRunning = false;
    _updateAutoBtn();
    if (!skipSave) _saveAutoPref('off');   // 🆕 toggle cycle 中間狀態不存（toggleAuto 會處理）
    if (_active && _playerAtb >= 100 && _playerDelay <= 0) { _setButtons(true); _checkSpecialReady(); }
  }

  // ── 硬核模式 ──────────────────────────────────────────
  function _startHardcore(skipSave) {
    if (!_active) return;
    _hardcoreActive = true;
    _updateAutoBtn();
    if (!skipSave) _saveAutoPref('hardcore');   // 🆕
    if (_playerAtb >= 100 && _playerDelay <= 0) _startHcCountdown();
  }

  function _stopHardcore(skipSave) {
    _clearHcCountdown();
    _hardcoreActive = false;
    _updateAutoBtn();
    if (!skipSave) _saveAutoPref('off');   // 🆕
    if (_active && _playerAtb >= 100 && _playerDelay <= 0) { _setButtons(true); _checkSpecialReady(); }
  }

  function _startHcCountdown() {
    _clearHcCountdown();
    _hardcoreCount = 5;
    _updateHcCountUI();
    _hardcoreTimer = setInterval(_hcCountStep, 1000);
  }

  function _hcCountStep() {
    _hardcoreCount--;
    if (_hardcoreCount <= 0) {
      _clearHcCountdown();
      _appendLog('  ⏱ 猶豫！跳過本次行動。', 'log-system');
      _playerAtb = 0;
      _setButtons(false);
      if (_active && !_checkDeath()) _endTurnCleanup_atb();
    } else {
      _updateHcCountUI();
    }
  }

  function _clearHcCountdown() {
    if (_hardcoreTimer) { clearInterval(_hardcoreTimer); _hardcoreTimer = null; }
    _hardcoreCount = 0;
    _updateHcCountUI();
  }

  function _updateHcCountUI() {
    const el = document.getElementById('bt-hc-count');
    if (!el) return;
    if (_hardcoreCount > 0) {
      el.style.display = 'block';
      el.textContent   = `⏱ ${_hardcoreCount}`;
    } else {
      el.style.display = 'none';
    }
  }

  function _updateAutoBtn() {
    const btn = document.getElementById('bt-btn-auto');
    if (!btn) return;
    btn.classList.remove('auto-on', 'hardcore-on');
    if (_autoRunning) {
      btn.textContent = '自動中';
      btn.classList.add('auto-on');
    } else if (_hardcoreActive) {
      btn.textContent = '硬核中';
      btn.classList.add('hardcore-on');
    } else {
      btn.textContent = '自 動';
    }
  }

  // ══════════════════════════════════════════════════════
  // ATB LOOP
  // ══════════════════════════════════════════════════════
  // 🆕 2026-04-23 Sprint 2：攻速公式
  //   - SPD 保底 max(8, SPD) → max(12, SPD)（避免重裝流 SPD 負到爆）
  //   - 舊共用 cap 6.5 → 每武器獨立 cap（weapon.cap 欄位）
  //     匕首 cap 10（500ms）、長槌 cap 3（1667ms）、長劍 cap 6（833ms）等
  //     對應 battle-system.md § 7.1 各武器極限速度表
  function _calcFillRate(unit) {
    const w = TB_WEAPONS[unit.weaponId] || {};
    const sw = w.swingTime || 5;
    const weaponCap = (typeof w.cap === 'number') ? w.cap : 6.5;
    return Math.min(weaponCap, Math.max(12, unit.derived.SPD) / sw);
  }

  function _startAtbLoop() {
    _stopAtbLoop();
    _playerAtb = 0;
    _enemyAtb  = 0;
    // 🆕 2026-04-20：ATB 速度 ×2（100ms → 50ms）戰鬥節奏加快
    _atbLoop   = setInterval(_atbTick, 50);
  }

  function _stopAtbLoop() {
    if (_atbLoop) { clearInterval(_atbLoop); _atbLoop = null; }
  }

  function _atbTick() {
    if (!_active) { _stopAtbLoop(); return; }

    _battleTick++;

    // ── Delay 倒數（瞬刺蓄力）──
    if (_playerDelay > 0) {
      _playerDelay--;
      if (_playerDelay <= 0 && _playerDelaySkill) {
        _executeDelayedSkill();
        if (!_active) return;
      }
    }

    // Fill enemy bar
    const eRate = _calcFillRate(_enemy);
    _enemyAtb   = Math.min(100, _enemyAtb + eRate);

    // Fill player bar
    const pRate    = _calcFillRate(_player);
    const wasReady = _playerAtb >= 100;
    _playerAtb     = Math.min(100, _playerAtb + pRate);
    const nowReady = _playerAtb >= 100;

    // Enemy acts when bar fills (sync — JS single-threaded, no race condition)
    if (_enemyAtb >= 100) {
      _enemyAtb = 0;
      _enemyTurn();
      if (!_active) return;
    }

    // Player bar just filled → 依模式分流（蓄力中跳過）
    if (!wasReady && nowReady && _playerDelay <= 0) {
      if (_autoRunning) {
        // 自動模式：立即攻擊
        const action = (_player.gauge >= TBC.GAUGE_MAX) ? 'special' : 'attack';
        doAction(action);
      } else if (_hardcoreActive) {
        // 硬核模式：開放按鈕 + 啟動 5 秒倒數
        _setButtons(true);
        _checkSpecialReady();
        _startHcCountdown();
      } else {
        // 一般模式：開放按鈕等玩家選擇
        _setButtons(true);
        _checkSpecialReady();
      }
      _renderActiveSkillsBar();   // 🆕 ATB 滿時主動技能也要刷新
    }

    _updateAtbBarsUI();
  }

  function _updateAtbBarsUI() {
    const pBar = document.getElementById('bt-patb-bar');
    const eBar = document.getElementById('bt-eatb-bar');
    const pTxt = document.getElementById('bt-patb-txt');
    const eTxt = document.getElementById('bt-eatb-txt');
    if (pBar) {
      pBar.style.width = _playerAtb + '%';
      if (_playerAtb >= 100) pBar.classList.add('ready');
      else                   pBar.classList.remove('ready');
    }
    if (eBar) eBar.style.width = _enemyAtb + '%';
    if (pTxt) pTxt.textContent = Math.round(_playerAtb) + '%';
    if (eTxt) eTxt.textContent = Math.round(_enemyAtb) + '%';
    // 🆕 D.28：同步左右欄 ATB bar
    const lAtb = document.getElementById('bt-latb-bar');
    const rAtb = document.getElementById('bt-ratb-bar');
    if (lAtb) {
      lAtb.style.width = _playerAtb + '%';
      if (_playerAtb >= 100) lAtb.classList.add('ready');
      else                   lAtb.classList.remove('ready');
    }
    if (rAtb) rAtb.style.width = _enemyAtb + '%';
  }

  // ══════════════════════════════════════════════════════
  // PUBLIC: startFromConfig(enemyCfg, onWin, onLose)
  // Used by Arena — builds enemy from custom stat config instead of TB_ENEMIES id
  // ══════════════════════════════════════════════════════
  function startFromConfig(enemyCfg, onWin, onLose) {
    _onWin  = onWin  || (() => {});
    _onLose = onLose || (() => {});
    _turn        = 0;
    _autoRunning    = false;
    _hardcoreActive = false;
    _battleTick       = 0;
    _isArenaBattle    = true;
    _pendingFameReward= enemyCfg.fameReward || 0;
    _lastRating       = null;
    _crowdMood        = _generateCrowdMood();
    _playerDelay      = 0;
    _playerDelaySkill = null;
    _pendingReturnAction = null;   // 🆕 2026-04-25c：清掉上一場 return callback
    _hideReturnButton();

    const p = Stats.player;
    _player = TB_buildUnit({
      name:     p.name || '無名',
      STR: Stats.eff('STR'), DEX: Stats.eff('DEX'), CON: Stats.eff('CON'),
      AGI: Stats.eff('AGI'), WIL: Stats.eff('WIL'), LUK: Stats.eff('LUK'),
      hpBase:   Math.max(20, p.hpMax - Math.round(2 * Stats.eff('CON'))),
      fame:     p.fame || 0,
      weaponId:  _mapId(p.equippedWeapon, TB_WEAPONS,  'fists'),
      armorId:   _mapId(p.equippedArmor,  TB_ARMORS,   'rags'),
      offhandId: _mapOffhand(p.equippedOffhand),
      amuletId:  'none',
      traitId:   'none',
    }, true);
    // 🆕 2026-04-25c：HP 共用 — 進場帶訓練場當前 HP
    _player.hp = Math.max(1, Math.min(p.hp || _player._hpMax, _player._hpMax));

    // 🆕 2026-04-25c 劇情技能戰鬥 hook
    _applyStorySkills();

    // 🆕 2026-04-27 主動技能 cooldown / buff 重置
    _resetActiveSkills();

    _enemy = TB_buildUnit({
      enemyId:      '_arena',
      name:         enemyCfg.name,
      title:        enemyCfg.title,
      STR: enemyCfg.STR, DEX: enemyCfg.DEX, CON: enemyCfg.CON,
      AGI: enemyCfg.AGI, WIL: enemyCfg.WIL, LUK: enemyCfg.LUK,
      hpBase:       enemyCfg.hpBase,
      weaponId:     enemyCfg.weaponId  || 'rustySword',
      armorId:      enemyCfg.armorId   || 'rags',
      shieldId:     enemyCfg.shieldId  || 'none',
      amuletId:     'none',
      traitId:      'none',
      ai:           enemyCfg.ai        || 'normal',
      fame:         enemyCfg.fame      || 0,
      intimidation: enemyCfg.intimidation || 0,
    });
    _active = true;

    _showOverlay();
    _initUI();

    Game.addLog(`\n⚔ 【競技場對戰】\n${p.name} vs ${_enemy.name}【${enemyCfg.title || ''}】`, '#c06030', false);
    _appendLog(`⚔ 競技場開始！${_player.name} vs ${_enemy.name}【${_enemy.title}】`, 'log-system');
    _appendLog('', 'log-turn');

    const p2e = TB_calcPressure(_player, _enemy);
    const p2p = TB_calcPressure(_enemy,  _player);
    if (p2e.penalty > 0) {
      TB_applyPressure(_enemy, p2e.penalty, _player.name);
      _appendLog(`◈ 你的威嚇 → ${_enemy.name} 全屬性 -${Math.round(p2e.penalty*100)}%`, 'log-special');
    } else {
      _appendLog(`◈ 你對 ${_enemy.name} 尚無壓制力`, 'log-system');
    }
    if (p2p.penalty > 0) {
      TB_applyPressure(_player, p2p.penalty, _enemy.name);
      _appendLog(`⚠ ${_enemy.name} 的威嚇 → 你的全屬性 -${Math.round(p2p.penalty*100)}%`, 'log-injury');
    } else {
      _appendLog(`◈ 你成功抵禦 ${_enemy.name} 的壓制`, 'log-system');
    }
    _applyOpeningTraits();
    _appendLog('', 'log-turn');

    // D.1.13: 戰鬥開始音效
    SoundManager.playSfx('battle_start');

    _playerAtb = 0;
    _enemyAtb  = 0;
    _startAtbLoop();
    _updateCombatantUI();
    _updateSkillDisplay();
    _renderActiveSkillsBar();   // 🆕 戰鬥開始渲染主動技能列

    // 🆕 2026-04-25c：恢復玩家上次選的自動戰鬥模式
    _restoreAutoPref();
  }

  // ══════════════════════════════════════════════════════
  function getLastRating() { return _lastRating; }

  // 🆕 D.28：對外暴露「戰鬥進行中」旗標，讓 main.js 可以擋住訓練動作
  function isActive() { return _active; }

  return { start, startFromConfig, doAction, toggleAuto, getLastRating, finishChoice, isActive, returnToTraining, useActiveSkill };
})();
