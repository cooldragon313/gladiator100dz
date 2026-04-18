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

  // ── ATB state ────────────────────────────────────────────
  let _atbLoop   = null;
  let _playerAtb = 0;   // 0–100, fills each tick
  let _enemyAtb  = 0;

  // ATB tick thresholds for rating (100ms ticks)
  const RATING_TICKS = { S: 60, A: 100, B: 120 };

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
    _pendingFameReward= 0;
    _lastRating       = null;
    _crowdMood        = _generateCrowdMood();
    _playerDelay      = 0;
    _playerDelaySkill = null;

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
    if (ov) ov.style.display = 'flex';
  }

  function _hideOverlay() {
    const ov = document.getElementById('battle-overlay');
    if (ov) ov.style.display = 'none';
  }

  // 🆕 D.28：攻擊動畫（攻擊方撲向被攻擊方 + 被攻擊方震動）
  //   attackerSide: 'player' | 'enemy'
  function _playAttackAnim(attackerSide) {
    const playerCard = document.querySelector('.bt-card-player');
    const enemyCard  = document.querySelector('.bt-card-enemy');
    if (!playerCard || !enemyCard) return;
    const attacker = attackerSide === 'player' ? playerCard : enemyCard;
    const defender = attackerSide === 'player' ? enemyCard : playerCard;
    const lungeClass = attackerSide === 'player' ? 'bt-lunge-right' : 'bt-lunge-left';

    // 清掉之前的動畫（避免同回合多擊時不 reset）
    attacker.classList.remove('bt-lunge-right', 'bt-lunge-left');
    defender.classList.remove('bt-hit-shake');
    void attacker.offsetHeight;   // 觸發 reflow 讓動畫重新開始
    void defender.offsetHeight;

    attacker.classList.add(lungeClass);
    // 撲擊中段時被攻擊方才震動（有時間差才像真的撞到）
    setTimeout(() => defender.classList.add('bt-hit-shake'), 120);

    // 動畫完成後清掉 class
    setTimeout(() => {
      attacker.classList.remove(lungeClass);
      defender.classList.remove('bt-hit-shake');
    }, 650);
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

    for (let i = 0; i < hits; i++) {
      if (_enemy.hp <= 0) break;
      const r = TB_attack(_player, _enemy, { turn: _turn });
      _applyDamage(_enemy, r.damage, r.counterDamage ? _player : null, r.counterDamage);
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
  }

  // ══════════════════════════════════════════════════════
  // ENEMY TURN
  // ══════════════════════════════════════════════════════
  function _enemyTurn() {
    if (!_active || _enemy.hp <= 0) { _endTurnCleanup_atb(); return; }

    const decision = TB_bossDecide(_enemy, _player, { turn: _turn });
    const isBigMove = ['triple_stab','mountain_crash','special_release'].includes(decision.action);
    if (decision.log) _appendLog(decision.log, isBigMove ? 'log-special' : 'log-system');

    switch (decision.action) {
      case 'attack': {
        const r = TB_attack(_enemy, _player, { turn: _turn });
        _applyDamage(_player, r.damage, r.counterDamage ? _enemy : null, r.counterDamage);
        _appendLog(r.log, r.crit ? 'log-crit' : r.hit ? '' : 'log-miss');
        if (r.injuredPart) _appendLog(`  ※ 玩家【${r.injuredPart}】受傷（${r.injuryLevel}）`, 'log-injury');
        break;
      }
      case 'mountain_crash': {
        const r = TB_attack(_enemy, _player, { turn: _turn }, { mountainCrash: true });
        _applyDamage(_player, r.damage, null, 0);
        _appendLog(r.log, 'log-crit');
        if (r.injuredPart) _appendLog(`  ※ 玩家【${r.injuredPart}】受傷（${r.injuryLevel}）`, 'log-injury');
        break;
      }
      case 'triple_stab': {
        for (let i = 0; i < 3; i++) {
          if (_player.hp <= 0) break;
          const r = TB_attack(_enemy, _player, { turn: _turn });
          _applyDamage(_player, r.damage, r.counterDamage ? _enemy : null, r.counterDamage);
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

    _updateCombatantUI();
    _updateSkillDisplay();
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
    _stopAuto();
    _setButtons(false);
    _updateCombatantUI();

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
      const fameAwarded = Math.round((_pendingFameReward + (Stats.player.fameBase || 0)) * rc.fameMult);

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
      if (_lastRating === 'S' || _lastRating === 'A') {
        const affBonus = _lastRating === 'S' ? 8 : 4;
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
        `  名聲獎勵：+${fameAwarded}（基礎 ${_pendingFameReward}${fameBaseNote} × ${rc.fameMult}）\n` +
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
      setTimeout(() => {
        _hideOverlay();
        Game.renderAll();
        if (won) _onWin();
        else     _onLose();
      }, 2200);
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

    // Done — restore scene, play atmosphere, then call onWin
    setTimeout(() => {
      _hideOverlay();
      Game.renderAll();
      if (atmosphereLines.length > 0 && typeof DialogueModal !== 'undefined') {
        DialogueModal.play(atmosphereLines, { onComplete: _onWin });
      } else {
        _onWin();
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

    const wasAbove30 = target.hp >= target._hpMax * 0.30;
    if (dmg > 0) {
      target.hp = Math.max(0, target.hp - dmg);
      // 🆕 D.28：攻擊動畫 — 攻擊方撲擊 + 被攻擊方震動
      _playAttackAnim(target === _player ? 'enemy' : 'player');
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
    ['bt-btn-attack','bt-btn-defend','bt-btn-special','bt-btn-auto'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
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
    if (_autoRunning)      { _stopAuto();    _startHardcore(); }
    else if (_hardcoreActive) { _stopHardcore(); }
    else                   { _startAuto(); }
  }

  function _startAuto() {
    if (!_active) return;
    _autoRunning = true;
    _updateAutoBtn();
    if (_playerAtb >= 100 && _playerDelay <= 0) {
      const action = (_player.gauge >= TBC.GAUGE_MAX) ? 'special' : 'attack';
      doAction(action);
    }
  }

  function _stopAuto() {
    _autoRunning = false;
    _updateAutoBtn();
    if (_active && _playerAtb >= 100 && _playerDelay <= 0) { _setButtons(true); _checkSpecialReady(); }
  }

  // ── 硬核模式 ──────────────────────────────────────────
  function _startHardcore() {
    if (!_active) return;
    _hardcoreActive = true;
    _updateAutoBtn();
    if (_playerAtb >= 100 && _playerDelay <= 0) _startHcCountdown();
  }

  function _stopHardcore() {
    _clearHcCountdown();
    _hardcoreActive = false;
    _updateAutoBtn();
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
  function _calcFillRate(unit) {
    const sw = (TB_WEAPONS[unit.weaponId] || {}).swingTime || 5;
    return Math.min(6.5, Math.max(8, unit.derived.SPD) / sw);
  }

  function _startAtbLoop() {
    _stopAtbLoop();
    _playerAtb = 0;
    _enemyAtb  = 0;
    _atbLoop   = setInterval(_atbTick, 100);
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
  }

  // ══════════════════════════════════════════════════════
  function getLastRating() { return _lastRating; }

  // 🆕 D.28：對外暴露「戰鬥進行中」旗標，讓 main.js 可以擋住訓練動作
  function isActive() { return _active; }

  return { start, startFromConfig, doAction, toggleAuto, getLastRating, finishChoice, isActive };
})();
