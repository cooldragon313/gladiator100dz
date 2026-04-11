/**
 * main.js — Core game engine
 * Depends on: stats.js, fields.js, npc.js, events.js
 */
const Game = (() => {
  let currentFieldId = 'dirtyCell';
  let currentNPCs    = { teammates: [], audience: [] };
  const logHistory   = [];
  const MAX_LOG      = 80;

  // ── Settings (persisted in localStorage) ─────────────
  const settings = {
    sfx:   parseInt(localStorage.getItem('sfx')   ?? 1),
    music: parseInt(localStorage.getItem('music') ?? 1),
  };

  function saveSettings() {
    localStorage.setItem('sfx',   settings.sfx);
    localStorage.setItem('music', settings.music);
  }

  // ── Log ───────────────────────────────────────────────
  function addLog(text, color = '#e0e0e0', italic = true) {
    logHistory.unshift({ text, color, italic });
    if (logHistory.length > MAX_LOG) logHistory.pop();
    renderLog();
  }

  function renderLog() {
    const el = document.getElementById('log-content');
    if (!el) return;
    el.innerHTML = logHistory.map(entry => {
      const style = `color:${entry.color};${entry.italic ? 'font-style:italic;' : ''}`;
      return `<p style="${style}">${entry.text.replace(/\n/g, '<br>')}</p>`;
    }).join('');
  }

  // ── Time display ──────────────────────────────────────
  function renderTimeBar() {
    const p   = Stats.player;
    const pct = (p.time / 1440) * 100;
    const fill     = document.getElementById('time-bar-fill');
    const label    = document.getElementById('time-label');
    const dayEl    = document.getElementById('day-counter');
    const celestial= document.getElementById('time-celestial');

    if (fill)  fill.style.width = pct + '%';
    if (label) label.textContent = '第 ' + p.day + ' 天　' + Stats.getTimeStr();
    if (dayEl) dayEl.textContent = (100 - p.day + 1) + ' 天後 · 萬骸祭';

    // Sun / Moon
    if (celestial) {
      celestial.style.left = pct + '%';
      const hour = Math.floor(p.time / 60) % 24;
      const isSun = hour >= 8 && hour < 18;
      celestial.className = isSun ? 'sun' : 'moon';
    }
  }

  // ── 百日條 ────────────────────────────────────────────
  const DAY_W = 14; // px per day

  function _buildDayBar() {
    const inner = document.getElementById('hdb-inner');
    if (!inner) return;
    const totalW = 100 * DAY_W;
    inner.style.width = totalW + 'px';

    // Ticks
    for (let d = 1; d <= 100; d++) {
      const x = (d - 1) * DAY_W + DAY_W / 2;
      const tick = document.createElement('div');
      tick.className = 'hdb-tick' + (d % 5 === 0 ? ' hdb-tick-5' : '');
      tick.style.left = x + 'px';
      inner.appendChild(tick);
    }

    // Event markers
    const events = Events.TIMELINE_EVENTS;
    Object.entries(events).forEach(([dayStr, ev]) => {
      const d = parseInt(dayStr);
      const x = (d - 1) * DAY_W + DAY_W / 2;
      const marker = document.createElement('div');
      marker.className = 'hdb-event';
      marker.style.left = x + 'px';
      marker.title = `第 ${d} 天：${ev.name}`;
      marker.innerHTML = `
        <span class="hdb-event-icon" style="color:${ev.iconColor}">${ev.icon}</span>
        <span class="hdb-event-name">${ev.name}</span>
      `;
      inner.appendChild(marker);
    });
  }

  function renderDayBar() {
    const p     = Stats.player;
    const inner = document.getElementById('hdb-inner');
    const view  = document.getElementById('hdb-view');
    const past  = document.getElementById('hdb-past-fill');
    const todayIcon = document.getElementById('hdb-today-icon');
    if (!inner || !view) return;

    const viewW  = view.offsetWidth || 600;
    const todayX = (p.day - 1) * DAY_W + DAY_W / 2;
    const offset = viewW / 2 - todayX;

    inner.style.transform = `translateX(${offset}px)`;

    // Past fill width = from day 1 to today
    if (past) past.style.width = todayX + 'px';

    // Today icon — changes if today is a timeline event
    const tlEv = Events.TIMELINE_EVENTS[p.day];
    if (todayIcon) {
      todayIcon.textContent = tlEv ? tlEv.icon : '◆';
      todayIcon.style.color = tlEv ? tlEv.iconColor : 'var(--blood-lt)';
      todayIcon.style.filter = `drop-shadow(0 0 5px ${tlEv ? tlEv.iconColor : 'var(--blood-lt)'})`;
    }
  }

  // ── Timeline event trigger (called when day changes) ──
  let _lastTriggeredDay = 0;

  function checkTimelineEvent() {
    const p   = Stats.player;
    const ev  = Events.TIMELINE_EVENTS[p.day];
    if (!ev || _lastTriggeredDay === p.day) return;
    _lastTriggeredDay = p.day;

    // Announcement
    addLog(`\n【第 ${p.day} 天 · ${ev.name}】\n${ev.logText}`, '#e8c870', true);
    showToast(`第 ${p.day} 天 ── ${ev.name}`, 5000);

    // Force scene + NPCs
    if (ev.forced) {
      currentFieldId = ev.forcedField;
      currentNPCs = ev.forcedNPCs;
      renderAll();

      // Show battle trigger button inside scene area
      _showTimelineBattleBtn(ev);
    }
  }

  function _showTimelineBattleBtn(ev) {
    // Remove old if exists
    document.getElementById('timeline-battle-btn')?.remove();
    const npcArea = document.getElementById('npc-area');
    if (!npcArea) return;

    const btn = document.createElement('button');
    btn.id = 'timeline-battle-btn';
    btn.style.cssText = `
      margin-top:16px;
      padding:12px 40px;
      background:#1a0000;
      border:1px solid var(--blood-lt);
      color:#e87060;
      font-family:var(--font);
      font-size:22px;
      letter-spacing:.2em;
      cursor:pointer;
      transition:background .2s;
      box-shadow:0 0 16px rgba(192,57,43,.3);
    `;
    btn.textContent = ev.actionLabel || '進入戰鬥';
    btn.onmouseover = () => btn.style.background = '#2a0000';
    btn.onmouseout  = () => btn.style.background = '#1a0000';
    btn.onclick = () => {
      btn.remove();
      Battle.start(
        ev.opponent,
        () => { /* onWin: handle survival */ addLog('你贏得了這場戰鬥！', '#d4af37'); },
        () => { /* onLose: trigger death ending */ Endings.deathEnding(Stats.player.name); }
      );
    };
    npcArea.appendChild(btn);
  }

  // ── Scene info bar ────────────────────────────────────
  function renderSceneInfoBar() {
    const f = FIELDS[currentFieldId];
    const nameEl = document.getElementById('scene-name');
    if (nameEl && f) nameEl.textContent = f.name;
    Stats.renderFame();
  }

  // ── Scene view (background + watermark) ───────────────
  function renderSceneView() {
    const view = document.getElementById('scene-view');
    if (!view) return;
    // Remove all bg- classes
    view.className = view.className.replace(/\bbg-\S+/g, '').replace(/\bambient-\S+/g, '').trim();
    const f = FIELDS[currentFieldId];
    if (f) {
      view.classList.add(f.bgClass, f.ambientClass);
      // Watermark text
      const wm = document.getElementById('scene-watermark');
      if (wm) wm.textContent = f.name;
    }
  }

  // ── NPC slots ─────────────────────────────────────────
  function renderNPCSlots() {
    // Teammate slots (6 max)
    for (let i = 0; i < 6; i++) {
      const slot = document.getElementById('tm-slot-' + i);
      if (!slot) continue;
      const npcId = currentNPCs.teammates[i];
      if (npcId) {
        const npc = teammates.getNPC(npcId);
        slot.classList.add('occupied');
        slot.classList.remove('empty');
        slot.innerHTML = `<span class="npc-role-tag">隊友</span><span class="npc-name">${npc ? npc.name : npcId}</span>`;
        slot.onclick = () => onNPCClick(npcId);
      } else {
        slot.classList.remove('occupied');
        slot.classList.add('empty');
        slot.innerHTML = '<span class="npc-empty-label">—</span>';
        slot.onclick = null;
      }
    }
    // Audience slots (3 max)
    for (let i = 0; i < 3; i++) {
      const slot = document.getElementById('aud-slot-' + i);
      if (!slot) continue;
      const npcId = currentNPCs.audience[i];
      if (npcId) {
        const npc = teammates.getNPC(npcId);
        slot.classList.add('occupied');
        slot.classList.remove('empty');
        slot.innerHTML = `<span class="npc-role-tag aud-tag">觀眾</span><span class="npc-name">${npc ? npc.name : npcId}</span>`;
        slot.onclick = () => onNPCClick(npcId);
      } else {
        slot.classList.remove('occupied');
        slot.classList.add('empty');
        slot.innerHTML = '<span class="npc-empty-label">—</span>';
        slot.onclick = null;
      }
    }
  }

  // ── Scene buttons (left panel) ────────────────────────
  function renderSceneButtons() {
    const p = Stats.player;
    FIELD_SLOTS.forEach(slot => {
      const btn = document.getElementById('sbtn-' + slot.slot);
      if (!btn) return;
      const accessible = getSlotField(slot.slot, p);
      if (accessible) {
        btn.classList.remove('locked');
        btn.classList.toggle('active', accessible.id === currentFieldId);
        btn.querySelector('.sbtn-name').textContent = accessible.name;
        btn.onclick = () => switchField(accessible.id);
      } else {
        btn.classList.add('locked');
        btn.classList.remove('active');
        btn.querySelector('.sbtn-name').textContent = slot.label;
        btn.onclick = null;
      }
    });
  }

  // ── Switch scene ──────────────────────────────────────
  function switchField(fieldId) {
    if (fieldId === currentFieldId) return;
    currentFieldId = fieldId;
    currentNPCs = rollFieldNPCs(fieldId);

    const f = FIELDS[fieldId];
    if (f) addLog(f.logText, '#ddd', true);

    // Small time cost to move
    Stats.advanceTime(15);

    renderAll();
  }

  // ── NPC interaction placeholder ───────────────────────
  function onNPCClick(npcId) {
    const npc = teammates.getNPC(npcId);
    if (!npc) return;
    showToast(`【${npc.name}】${npc.desc}`);
  }

  // ── Full render pass ──────────────────────────────────
  function renderAll() {
    renderTimeBar();
    renderDayBar();
    renderSceneInfoBar();
    renderSceneView();
    renderNPCSlots();
    renderSceneButtons();
    Stats.renderAll();
    document.getElementById('player-name-display').textContent = Stats.player.name;
    checkTimelineEvent();
  }

  // ── Toast notification ────────────────────────────────
  function showToast(msg, duration = 3500) {
    let toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('visible'), duration);
  }

  // ── Detail modal (full character sheet) ──────────────
  function openDetailModal() {
    const modal = document.getElementById('modal-detail');
    if (!modal) return;
    _fillCharSheet();
    modal.classList.add('open');
  }

  function closeDetailModal() {
    document.getElementById('modal-detail')?.classList.remove('open');
  }

  function _fillCharSheet() {
    const p = Stats.player;
    const d = Stats.calcDerived();

    // Header
    const nameEl = document.getElementById('cs-name');
    if (nameEl) nameEl.textContent = p.name || '無名';
    const dayEl = document.getElementById('cs-day');
    if (dayEl) dayEl.textContent = p.day;
    const fameVal = document.getElementById('cs-fame-val');
    if (fameVal) fameVal.textContent = p.fame;
    const fameFill = document.getElementById('cs-fame-bar-fill');
    if (fameFill) fameFill.style.width = Math.min(100, p.fame) + '%';

    // ── Vital bars ──
    [
      { id:'cs-bar-hp',      val:p.hp,      max:p.hpMax },
      { id:'cs-bar-stamina', val:p.stamina,  max:p.staminaMax },
      { id:'cs-bar-food',    val:p.food,     max:p.foodMax },
      { id:'cs-bar-mood',    val:p.mood,     max:p.moodMax },
    ].forEach(b => {
      const row = document.getElementById(b.id);
      if (!row) return;
      const pct = Math.round(b.val / b.max * 100);
      row.querySelector('.cs-bar-fill').style.width = pct + '%';
      row.querySelector('.cs-vital-num').textContent = b.val + '/' + b.max;
    });

    // ── Equipment ──
    const eqW = document.getElementById('cs-eq-weapon');
    const eqA = document.getElementById('cs-eq-armor');
    const eqS = document.getElementById('cs-eq-shield');
    if (eqW) eqW.textContent = p.equippedWeapon ? (Weapons[p.equippedWeapon]?.name || p.equippedWeapon) : '— 空手 —';
    if (eqA) eqA.textContent = p.equippedArmor  ? (Armors[p.equippedArmor]?.name  || p.equippedArmor)  : '— 破布 —';
    if (eqS) eqS.textContent = p.equippedShield ? (Armors[p.equippedShield]?.name || p.equippedShield) : '— 無 —';

    // ── Affection bars ──
    const affNpcs = ['master','officer','cassius','blacksmithGra','melaKook'];
    affNpcs.forEach(npcId => {
      const val = teammates.getAffection(npcId);
      const fill = document.getElementById('cs-aff-' + npcId);
      const num  = document.getElementById('cs-aff-' + npcId + '-n');
      if (fill) fill.style.width = val + '%';
      if (num)  num.textContent  = val;
    });

    // ── Six attribute cards ──
    ['STR','DEX','CON','AGI','WIL','LUK'].forEach(key => {
      const card = document.getElementById('cs-attr-' + key);
      if (!card) return;
      card.querySelector('.cs-attr-val').textContent = Stats.eff(key);
    });

    // ── Derived stats (bar max = 200 for visual scaling) ──
    const DRV_MAX = { ATK:200, DEF:150, ACC:100, PEN:100, BLK:100, SPD:100, CRT:100, CDMG:300, EVA:100 };
    const PCT_KEYS = new Set(['ACC','CRT','CDMG']);
    Object.entries(d).forEach(([key, val]) => {
      const numEl  = document.getElementById('cs-drv-' + key);
      const barEl  = document.getElementById('cs-drv-bar-' + key);
      const maxV   = DRV_MAX[key] || 100;
      const pct    = Math.min(100, Math.round(val / maxV * 100));
      if (numEl) numEl.textContent = PCT_KEYS.has(key) ? val + '%' : val;
      if (barEl) barEl.style.width = pct + '%';
    });

    // ── Skills ──
    const skillList = document.getElementById('cs-skill-list');
    if (skillList) {
      const known = Object.values(Skills).filter(sk => _playerKnowsSkill(sk));
      if (known.length === 0) {
        skillList.innerHTML = '<div class="cs-skill-empty">尚未習得任何技能</div>';
      } else {
        skillList.innerHTML = known.map(sk => `
          <div class="cs-skill-item">
            <div class="cs-skill-name">${sk.name}</div>
            <div class="cs-skill-type">${sk.type === 'passive' ? '被動' : '主動'}</div>
            <div class="cs-skill-desc">${sk.desc}</div>
          </div>
        `).join('');
      }
    }
  }

  function _playerKnowsSkill(skill) {
    // Placeholder: check unlock requirements vs current stats
    const p = Stats.player;
    const req = skill.unlockReq || {};
    for (const [key, minVal] of Object.entries(req)) {
      if (key === 'fame') { if (p.fame < minVal) return false; }
      else { if (Stats.eff(key) < minVal) return false; }
    }
    return false; // default false until player actually learns skills
  }

  // ── Settings modal ────────────────────────────────────
  function openSettingsModal() {
    const modal = document.getElementById('modal-settings');
    if (!modal) return;
    updateSettingsUI();
    modal.classList.add('open');
  }

  function closeSettingsModal() {
    document.getElementById('modal-settings')?.classList.remove('open');
  }

  function updateSettingsUI() {
    ['sfx', 'music'].forEach(key => {
      document.querySelectorAll(`.vol-btn[data-key="${key}"]`).forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.val) === settings[key]);
      });
    });
  }

  function setVolume(key, val) {
    settings[key] = val;
    saveSettings();
    updateSettingsUI();
  }

  // ── Name entry modal ──────────────────────────────────
  function openNameModal() {
    document.getElementById('modal-name')?.classList.add('open');
    document.getElementById('name-input')?.focus();
  }

  function confirmName() {
    const input = document.getElementById('name-input');
    let name = (input?.value || '').trim().slice(0, 6) || '無名';
    Stats.player.name = name;
    document.getElementById('modal-name')?.classList.remove('open');
    // Enter initial scene
    currentNPCs = rollFieldNPCs(currentFieldId);
    const f = FIELDS[currentFieldId];
    if (f) addLog('【' + f.name + '】\n' + f.logText, '#ddd', true);
    renderAll();
  }

  // ── Init ──────────────────────────────────────────────
  function init() {
    // Wire up detail / settings buttons
    document.getElementById('btn-detail')   ?.addEventListener('click', openDetailModal);
    document.getElementById('btn-settings') ?.addEventListener('click', openSettingsModal);
    document.getElementById('btn-close-detail')   ?.addEventListener('click', closeDetailModal);
    document.getElementById('btn-close-settings') ?.addEventListener('click', closeSettingsModal);
    document.getElementById('btn-confirm-name')   ?.addEventListener('click', confirmName);
    document.getElementById('name-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') confirmName();
    });
    // Settings volume buttons
    document.querySelectorAll('.vol-btn').forEach(btn => {
      btn.addEventListener('click', () => setVolume(btn.dataset.key, parseInt(btn.dataset.val)));
    });
    // Leave game
    document.getElementById('btn-leave')?.addEventListener('click', () => {
      if (confirm('確定離開遊戲？')) window.location.href = 'index.html';
    });
    // Close modals on backdrop click
    document.querySelectorAll('.modal-overlay').forEach(m => {
      m.addEventListener('click', e => {
        if (e.target === m) m.classList.remove('open');
      });
    });

    // Build day bar structure (once)
    _buildDayBar();
    // Initial render (before name entry)
    renderAll();
    // Show name entry
    openNameModal();
  }

  return { init, switchField, addLog, renderAll, showToast, openDetailModal, openSettingsModal };
})();

// Boot when DOM ready
document.addEventListener('DOMContentLoaded', Game.init);
