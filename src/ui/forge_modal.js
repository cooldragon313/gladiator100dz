/**
 * forge_modal.js — 鍛造坊 UI（葛拉鋪）
 *
 * 設計：[docs/systems/equipment-rework.md](../../docs/systems/equipment-rework.md) § 4.2
 *
 * 全螢幕 overlay、用 blacksmith.png 背景、卡片式選擇、不逐句翻頁。
 *
 * 用法：
 *   Forge.open();
 *
 * 4 大功能：
 *   - 強化品質（粗灰→普白→精藍→上紫）30 金 / 信用 10 抵 50%
 *   - 升 Tier（T1→T2→T3）80 金 + 葛拉好感 60
 *   - 鍛新詞綴 50 金 + 上紫以上 + 葛拉好感 70（Phase 2 待開放、UI 顯佔位）
 *   - 上交（換信用點：粗灰 1 / 普白 2 / 精藍 4 / 上紫 8）
 */
const Forge = (() => {

  // 操作費用
  const COST_UPGRADE_GOLD     = 30;
  const COST_UPGRADE_CREDIT   = 10;   // 抵 50%
  const COST_TIER_GOLD        = 80;
  const COST_AFFIX_GOLD       = 50;
  const COST_AFFIX_CREDIT     = 15;
  // 信用點兌換率
  const TRADE_CREDITS = { crude: 1, common: 2, fine: 4, superb: 8 };
  // 🆕 2026-05-07：上交同時給銅幣（user 反饋金錢來源不夠）— 跟信用點一起發
  const TRADE_MONEY   = { crude: 8, common: 18, fine: 35, superb: 70 };
  // 好感門檻
  const TIER_AFFINITY_REQ  = 60;
  const AFFIX_AFFINITY_REQ = 70;

  // UI 狀態
  let _selectedKind   = null;   // 'weapon' | 'armor'
  let _selectedItemId = null;
  let _mode           = 'main'; // 'main' | 'trade'

  function _log(text, color, important) {
    if (typeof Game !== 'undefined' && Game.addLog) {
      Game.addLog(text, color, true, !!important);
    }
  }

  function _ensureStyles() {
    if (document.getElementById('forge-styles')) return;
    const style = document.createElement('style');
    style.id = 'forge-styles';
    style.textContent = `
      #forge-overlay {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 9500;
        background: rgba(4,2,1,0.85) url('asset/image/blacksmith.png') center/cover no-repeat;
        background-blend-mode: multiply;
        font-family: 'Noto Serif TC', Georgia, serif;
        animation: forgeFadeIn 320ms ease-out;
      }
      #forge-overlay.open { display: block; }

      .forge-frame {
        position: absolute;
        inset: 24px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 24px 36px;
        background: linear-gradient(180deg, rgba(20,12,6,0.7) 0%, rgba(10,5,2,0.85) 100%);
        border: 2px solid #5a4028;
        border-radius: 6px;
        box-shadow: 0 0 48px rgba(0,0,0,0.7), inset 0 0 18px rgba(212,175,55,0.08);
      }

      .forge-greeting {
        flex: 0 0 auto;
        padding: 14px 20px;
        background: rgba(8,4,2,0.85);
        border-left: 3px solid #d4af37;
        color: #e8d8b0;
        font-size: 17px;
        line-height: 1.9;
      }
      .forge-greeting .speaker { color: #d4af37; font-weight: 900; margin-right: 8px; }

      .forge-grid-wrap {
        flex: 1 1 auto;
        overflow-y: auto;
        padding-top: 8px;
      }
      .forge-section-title {
        font-size: 13px;
        color: #886655;
        letter-spacing: .15em;
        margin: 14px 0 8px;
        padding-bottom: 4px;
        border-bottom: 1px dashed #3a2a18;
      }
      .forge-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 12px;
      }
      .forge-item-card {
        background: rgba(20,14,8,0.92);
        border: 2px solid #3a2a18;
        border-radius: 4px;
        padding: 12px 16px;
        cursor: pointer;
        transition: transform .12s, border-color .12s, box-shadow .12s;
        text-align: left;
        font-family: inherit;
        color: #c8b898;
      }
      .forge-item-card:hover {
        border-color: #d4af37;
        transform: translateY(-2px);
      }
      .forge-item-card.selected {
        border-color: #ffd060;
        box-shadow: 0 0 16px rgba(255,208,96,0.4);
      }
      .forge-item-card.equipped::after {
        content: '裝備中';
        display: inline-block;
        margin-left: 8px;
        padding: 1px 6px;
        font-size: 11px;
        background: #2a1808;
        border: 1px solid #6a5028;
        color: #d4af37;
        border-radius: 2px;
      }
      .forge-item-name {
        display: block;
        font-size: 17px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .forge-item-meta {
        font-size: 13px;
        color: #886655;
      }
      .forge-item-trade-credit {
        display: block;
        margin-top: 6px;
        font-size: 14px;
        color: #88cc77;
        font-weight: 700;
      }

      .forge-actions {
        flex: 0 0 auto;
        display: flex;
        gap: 10px;
        padding-top: 10px;
        border-top: 1px solid #3a2a18;
        flex-wrap: wrap;
      }
      .forge-action-btn {
        background: #1a0c04;
        border: 2px solid #5a4028;
        color: #d4af37;
        padding: 10px 22px;
        font-family: inherit;
        font-size: 15px;
        font-weight: 900;
        letter-spacing: .15em;
        cursor: pointer;
        transition: all .15s;
      }
      .forge-action-btn:hover:not(:disabled) {
        background: #2a1808;
        box-shadow: 0 0 16px rgba(212,175,55,0.4);
      }
      .forge-action-btn:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
      .forge-action-btn.trade { color: #aaccff; border-color: #4a5878; }
      .forge-action-btn.trade:hover:not(:disabled) { box-shadow: 0 0 16px rgba(170,204,255,0.4); }
      .forge-action-btn.danger { color: #cc8866; border-color: #5a3818; }
      .forge-action-btn .btn-cost {
        display: block;
        font-size: 11px;
        font-weight: 400;
        color: #886655;
        margin-top: 2px;
        letter-spacing: .1em;
      }

      .forge-footer {
        flex: 0 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 6px;
        font-size: 13px;
        color: #886655;
      }
      .forge-credit { color: #d4af37; font-weight: 700; font-size: 15px; }
      .forge-leave-btn {
        background: transparent;
        border: 1px solid #5a4028;
        color: #886655;
        padding: 6px 18px;
        cursor: pointer;
        font-family: inherit;
        font-size: 13px;
        letter-spacing: .15em;
        transition: all .15s;
      }
      .forge-leave-btn:hover { color: #d4af37; border-color: #d4af37; }

      .forge-info-line {
        font-size: 12px;
        color: #886655;
        margin-top: 4px;
        font-style: italic;
      }

      @keyframes forgeFadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }

      /* 🆕 2026-05-08 hover tooltip — 顯示裝備完整屬性 */
      #forge-tooltip {
        position: fixed;
        display: none;
        z-index: 9700;
        min-width: 240px;
        max-width: 320px;
        padding: 12px 14px;
        background: rgba(8,4,2,0.96);
        border: 2px solid #d4af37;
        border-radius: 4px;
        box-shadow: 0 6px 24px rgba(0,0,0,0.7);
        color: #c8b898;
        font-size: 13px;
        line-height: 1.7;
        font-family: 'Noto Serif TC', Georgia, serif;
        pointer-events: none;
      }
      #forge-tooltip.show { display: block; }
      .forge-tt-name {
        font-size: 16px;
        font-weight: 900;
        margin-bottom: 4px;
        letter-spacing: .05em;
      }
      .forge-tt-meta {
        font-size: 12px;
        color: #886655;
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1px dashed #3a2a18;
      }
      .forge-tt-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px 12px;
        margin: 6px 0;
        font-size: 13px;
      }
      .forge-tt-stat-key {
        color: #886655;
        margin-right: 4px;
      }
      .forge-tt-stat-val {
        color: #e8d8b0;
        font-weight: 700;
      }
      .forge-tt-stat-val.pos { color: #88dd66; }
      .forge-tt-stat-val.neg { color: #cc6666; }
      .forge-tt-affixes {
        margin: 8px 0 4px;
        padding-top: 6px;
        border-top: 1px dashed #3a2a18;
      }
      .forge-tt-affix-line {
        color: #d4af37;
        font-size: 12px;
        margin: 2px 0;
      }
      .forge-tt-affix-name { font-weight: 900; }
      .forge-tt-affix-desc { color: #886655; margin-left: 6px; }
      .forge-tt-desc {
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px dashed #3a2a18;
        font-size: 12px;
        color: #886655;
        font-style: italic;
        line-height: 1.6;
      }
    `;
    document.head.appendChild(style);
  }

  function _ensureContainer() {
    let el = document.getElementById('forge-overlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'forge-overlay';
    el.innerHTML = '<div class="forge-frame" id="forge-frame"></div>';
    document.body.appendChild(el);
    // 🆕 2026-05-08 共用 tooltip 元素
    if (!document.getElementById('forge-tooltip')) {
      const tt = document.createElement('div');
      tt.id = 'forge-tooltip';
      document.body.appendChild(tt);
    }
    return el;
  }

  // ══════════════════════════════════════════════════
  // 🆕 2026-05-08 hover tooltip — 顯示裝備完整屬性
  // ══════════════════════════════════════════════════
  function _buildTooltipHTML(entry) {
    const isWeapon = (entry.kind === 'weapon');
    const base = isWeapon
      ? (typeof Weapons !== 'undefined' ? Weapons[entry.id] : null)
      : (typeof Armors  !== 'undefined' ? Armors[entry.id]  : null);
    if (!base) return '';

    // 套品質
    const styled = isWeapon
      ? (typeof EquipmentQuality !== 'undefined' ? EquipmentQuality.applyToWeapon(base, entry.quality) : base)
      : (typeof EquipmentQuality !== 'undefined' ? EquipmentQuality.applyToArmor(base,  entry.quality) : base);

    // 詞綴加成
    const p = Stats.player;
    const inv = isWeapon ? p.weaponInventory : p.armorInventory;
    const item = inv ? inv.find(e => e.id === entry.id) : null;
    const affixIds = (item && Array.isArray(item.affixes)) ? item.affixes : [];
    const affixBonus = (typeof Affixes !== 'undefined' && affixIds.length)
      ? Affixes.computePassiveBonus(affixIds) : {};

    // 名稱（套品質色）
    const colorName = (typeof EquipmentQuality !== 'undefined')
      ? EquipmentQuality.formatItemNameHTML(base.name, entry.quality)
      : base.name;
    const qualityName = (typeof EquipmentQuality !== 'undefined')
      ? EquipmentQuality.getName(entry.quality) : entry.quality;

    // meta line：T# + 品質 + 類型
    const typeLabel = isWeapon
      ? (base.twoHanded ? '雙手' : '單手') + (base.weaponClass ? `・${base.weaponClass}` : '')
      : ({ cloth: '布甲', leather: '皮甲', plate: '板甲', shield: '盾' }[base.type] || base.type || '');
    const metaHtml = `T${entry.tier}　${qualityName}　${typeLabel}`;

    // 屬性表
    const keys = isWeapon
      ? [['ATK','攻擊'], ['ACC','命中'], ['CRT','暴擊'], ['CDMG','暴傷'], ['SPD','速度'], ['PEN','破甲']]
      : [['DEF','防禦'], ['EVA','閃避'], ['SPD','速度'], ['BLK','格擋']];

    const statsHtml = keys.map(([k, label]) => {
      const baseVal  = (typeof styled[k]   === 'number') ? styled[k]   : 0;
      const affixVal = (typeof affixBonus[k] === 'number') ? affixBonus[k] : 0;
      const total = baseVal + affixVal;
      // 沒這個屬性（且詞綴也沒給）→ 不顯示
      if (typeof base[k] !== 'number' && !affixVal) return '';
      const cls = total > 0 ? 'pos' : (total < 0 ? 'neg' : '');
      const sign = total > 0 ? '+' : '';
      const affixHint = affixVal ? ` <span class="forge-tt-stat-key">(${baseVal}${affixVal >= 0 ? '+' : ''}${affixVal})</span>` : '';
      return `<div><span class="forge-tt-stat-key">${label}</span><span class="forge-tt-stat-val ${cls}">${sign}${total}</span>${affixHint}</div>`;
    }).filter(Boolean).join('');

    // 詞綴列表
    let affixHtml = '';
    if (affixIds.length && typeof Affixes !== 'undefined') {
      const lines = affixIds.map(aid => {
        const name = Affixes.getName(aid);
        const desc = Affixes.getDesc(aid);
        return `<div class="forge-tt-affix-line"><span class="forge-tt-affix-name">${name}</span><span class="forge-tt-affix-desc">${desc}</span></div>`;
      }).join('');
      affixHtml = `<div class="forge-tt-affixes">${lines}</div>`;
    }

    // desc
    const descHtml = base.desc ? `<div class="forge-tt-desc">${base.desc}</div>` : '';

    return `
      <div class="forge-tt-name">${colorName}</div>
      <div class="forge-tt-meta">${metaHtml}</div>
      <div class="forge-tt-stats">${statsHtml}</div>
      ${affixHtml}
      ${descHtml}
    `;
  }

  function _showTooltip(entry, ev) {
    const tt = document.getElementById('forge-tooltip');
    if (!tt) return;
    tt.innerHTML = _buildTooltipHTML(entry);
    tt.classList.add('show');
    _moveTooltip(ev);
  }
  function _moveTooltip(ev) {
    const tt = document.getElementById('forge-tooltip');
    if (!tt || !tt.classList.contains('show')) return;
    const pad = 14;
    const w = tt.offsetWidth;
    const h = tt.offsetHeight;
    let x = ev.clientX + pad;
    let y = ev.clientY + pad;
    // 邊界處理（不要超出視窗）
    if (x + w + 8 > window.innerWidth)  x = ev.clientX - w - pad;
    if (y + h + 8 > window.innerHeight) y = ev.clientY - h - pad;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    tt.style.left = x + 'px';
    tt.style.top  = y + 'px';
  }
  function _hideTooltip() {
    const tt = document.getElementById('forge-tooltip');
    if (tt) tt.classList.remove('show');
  }

  function open() {
    _selectedKind   = null;
    _selectedItemId = null;
    _mode           = 'main';
    _ensureStyles();
    _ensureContainer();
    _render();
    document.getElementById('forge-overlay').classList.add('open');
  }

  function close() {
    const el = document.getElementById('forge-overlay');
    if (el) el.classList.remove('open');
    _hideTooltip();
  }

  // ══════════════════════════════════════════════════
  // 取得玩家擁有可動的裝備列表
  // ══════════════════════════════════════════════════
  function _getWeaponEntries() {
    const p = Stats.player;
    if (!Array.isArray(p.weaponInventory)) return [];
    return p.weaponInventory
      .filter(e => e && e.id && e.id !== 'fists')
      .map(e => {
        const w = (typeof Weapons !== 'undefined') ? Weapons[e.id] : null;
        if (!w) return null;
        return {
          kind: 'weapon',
          id: e.id,
          baseName: w.name || e.id,
          quality: e.quality || 'common',
          tier: e.tier || 1,
          isEquipped: (p.equippedWeapon === e.id || p.equippedOffhand === e.id),
        };
      })
      .filter(Boolean);
  }

  function _getArmorEntries() {
    const p = Stats.player;
    if (!Array.isArray(p.armorInventory)) return [];
    return p.armorInventory
      .filter(e => e && e.id)
      .map(e => {
        const a = (typeof Armors !== 'undefined') ? Armors[e.id] : null;
        if (!a) return null;
        // 🆕 2026-04-30 修：isEquipped 也要查 helmet/arms/legs slot
        //   之前只查 equippedArmor、護臂/護腿/頭盔被誤判成「未裝備」
        //   → forge 沒顯示「裝備中」、上交時也沒擋下
        const isEquipped = (
          p.equippedArmor  === e.id ||
          p.equippedHelmet === e.id ||
          p.equippedArms   === e.id ||
          p.equippedLegs   === e.id
        );
        return {
          kind: 'armor',
          id: e.id,
          baseName: a.name || e.id,
          quality: e.quality || 'common',
          tier: e.tier || 1,
          isEquipped,
        };
      })
      .filter(Boolean);
  }

  // ══════════════════════════════════════════════════
  // 渲染主畫面
  // ══════════════════════════════════════════════════
  function _render() {
    const frame = document.getElementById('forge-frame');
    if (!frame) return;
    const p = Stats.player;
    const credit = p.gra_credit || 0;
    const aff = (typeof teammates !== 'undefined') ? teammates.getAffection('blacksmithGra') : 0;

    const greetingHtml = (_mode === 'trade')
      ? `<div><span class="speaker">葛拉：</span>有用不到的、我熔一熔給其他兄弟。</div>
         <div><span class="speaker">葛拉：</span>⋯⋯沒有也沒事、不勉強。</div>`
      : `<div><span class="speaker">葛拉：</span>我收到命令了。主人允許你選武器、強化裝備。</div>
         <div><span class="speaker">葛拉：</span>⋯⋯說、要動哪一把。</div>`;

    const weapons = _getWeaponEntries();
    const armors  = _getArmorEntries();

    const renderCard = (entry) => {
      const sel = (_selectedKind === entry.kind && _selectedItemId === entry.id) ? ' selected' : '';
      const eq  = entry.isEquipped ? ' equipped' : '';
      const colorName = (typeof EquipmentQuality !== 'undefined')
        ? EquipmentQuality.formatItemNameHTML(entry.baseName, entry.quality)
        : entry.baseName;
      const qualityName = (typeof EquipmentQuality !== 'undefined')
        ? EquipmentQuality.getName(entry.quality)
        : entry.quality;
      const tradeCredit = TRADE_CREDITS[entry.quality] || 0;
      const tradeLabel = (_mode === 'trade')
        ? `<span class="forge-item-trade-credit">→ ${tradeCredit} 點</span>`
        : '';
      return `
        <button class="forge-item-card${sel}${eq}" data-kind="${entry.kind}" data-id="${entry.id}">
          <span class="forge-item-name">${colorName}</span>
          <span class="forge-item-meta">T${entry.tier}　${qualityName}</span>
          ${tradeLabel}
        </button>`;
    };

    let actionsHtml = '';
    if (_mode === 'main') {
      const sel = _getSelectedEntry();
      const canUpgrade = !!(sel && _canUpgrade(sel));
      const canTier    = !!(sel && _canTier(sel, aff));
      const canAffix   = !!(sel && _canAffix(sel, aff));
      const tierTitle  = (sel && !_canTier(sel, aff))
                          ? `升 Tier 需葛拉好感 ${TIER_AFFINITY_REQ}`
                          : '';
      const affixTitle = (sel && !_canAffix(sel, aff))
                          ? `鍛新詞綴需上紫以上 + 好感 ${AFFIX_AFFINITY_REQ}（Phase 2 待開放）`
                          : '';
      actionsHtml = `
        <button class="forge-action-btn" data-act="upgrade" ${canUpgrade ? '' : 'disabled'}>
          強化品質
          <span class="btn-cost">${COST_UPGRADE_GOLD} 金</span>
        </button>
        <button class="forge-action-btn" data-act="tier" ${canTier ? '' : 'disabled'} title="${tierTitle}">
          升 Tier
          <span class="btn-cost">${COST_TIER_GOLD} 金　好感 ${TIER_AFFINITY_REQ}+</span>
        </button>
        <button class="forge-action-btn" data-act="affix" ${canAffix ? '' : 'disabled'} title="${affixTitle}">
          鍛新詞綴
          <span class="btn-cost">${COST_AFFIX_GOLD} 金　Phase 2 待開放</span>
        </button>
        <button class="forge-action-btn trade" data-act="trade-mode">上交（多餘裝備換信用點、可選）</button>
      `;
    } else {
      // trade mode
      actionsHtml = `<button class="forge-action-btn danger" data-act="trade-back">取消上交</button>`;
    }

    frame.innerHTML = `
      <div class="forge-greeting">${greetingHtml}</div>
      <div class="forge-grid-wrap">
        ${weapons.length ? `<div class="forge-section-title">— 武器 —</div><div class="forge-grid">${weapons.map(renderCard).join('')}</div>` : ''}
        ${armors.length ? `<div class="forge-section-title">— 護甲 —</div><div class="forge-grid">${armors.map(renderCard).join('')}</div>` : ''}
        ${(!weapons.length && !armors.length) ? '<div class="forge-info-line">⋯⋯你身上沒有可動的裝備。</div>' : ''}
      </div>
      <div class="forge-actions">${actionsHtml}</div>
      <div class="forge-footer">
        <span>金錢：${p.money || 0}${credit > 0 ? `　·　葛拉信用：<span class="forge-credit">${credit}</span>（強化可抵半價）` : ''}</span>
        <button class="forge-leave-btn" id="forge-leave">離開</button>
      </div>
    `;

    // bind
    frame.querySelectorAll('.forge-item-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.kind;
        const id   = btn.dataset.id;
        if (_mode === 'trade') {
          _doTrade(kind, id);
        } else {
          _selectedKind   = kind;
          _selectedItemId = id;
          _render();
        }
      });
      // 🆕 2026-05-08 hover tooltip
      const kind = btn.dataset.kind;
      const id   = btn.dataset.id;
      const list = (kind === 'weapon') ? _getWeaponEntries() : _getArmorEntries();
      const entry = list.find(e => e.id === id);
      if (!entry) return;
      btn.addEventListener('mouseenter', (ev) => _showTooltip(entry, ev));
      btn.addEventListener('mousemove',  (ev) => _moveTooltip(ev));
      btn.addEventListener('mouseleave', _hideTooltip);
    });
    frame.querySelectorAll('.forge-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (act === 'upgrade')    _doUpgrade();
        else if (act === 'tier')  _doTier();
        else if (act === 'affix') _doAffix();
        else if (act === 'trade-mode') { _mode = 'trade'; _render(); }
        else if (act === 'trade-back') { _mode = 'main';  _render(); }
      });
    });
    const leaveBtn = document.getElementById('forge-leave');
    if (leaveBtn) leaveBtn.addEventListener('click', close);
  }

  // ══════════════════════════════════════════════════
  // 條件判定
  // ══════════════════════════════════════════════════
  function _getSelectedEntry() {
    if (!_selectedKind || !_selectedItemId) return null;
    const list = (_selectedKind === 'weapon') ? _getWeaponEntries() : _getArmorEntries();
    return list.find(e => e.id === _selectedItemId) || null;
  }

  function _canUpgrade(entry) {
    if (!entry) return false;
    // 只能 crude → common → fine → superb（superb 不能再升、傳家不能升）
    return ['crude', 'common', 'fine'].includes(entry.quality);
  }
  function _canTier(entry, aff) {
    if (!entry) return false;
    if (aff < TIER_AFFINITY_REQ) return false;
    if (entry.kind !== 'weapon') return false;   // Phase 1 只支援武器升 tier
    if (entry.tier >= 3) return false;
    // 須有 T1→T2 / T2→T3 對照表
    const upgradeMap = (entry.tier === 1) ? (typeof WEAPON_TIER_UPGRADE !== 'undefined' ? WEAPON_TIER_UPGRADE : null)
                                          : (typeof WEAPON_TIER_UPGRADE_T3 !== 'undefined' ? WEAPON_TIER_UPGRADE_T3 : null);
    if (!upgradeMap) return false;
    return !!upgradeMap[entry.id];
  }
  function _canAffix(entry, aff) {
    if (!entry) return false;
    if (aff < AFFIX_AFFINITY_REQ) return false;
    return entry.quality === 'superb' || entry.quality === 'legendary';
  }

  // ══════════════════════════════════════════════════
  // 操作
  // ══════════════════════════════════════════════════
  function _quickConfirm(text, onYes) {
    if (typeof ChoiceModal === 'undefined') { onYes(); return; }
    ChoiceModal.show({
      id: 'forge_confirm_' + Date.now(),
      icon: '⚒',
      title: '確認',
      body: text,
      forced: true,
      choices: [
        { id: 'yes', label: '確定', resultLog: '', logColor: '#d4af37' },
        { id: 'no',  label: '取消', resultLog: '', logColor: '#886655' },
      ],
    }, {
      onChoose: (choiceId) => { if (choiceId === 'yes') onYes(); }
    });
  }

  function _doUpgrade() {
    const entry = _getSelectedEntry();
    if (!entry || !_canUpgrade(entry)) return;
    const p = Stats.player;
    const credit = p.gra_credit || 0;
    const nextQuality = _nextQuality(entry.quality);
    const qName = (typeof EquipmentQuality !== 'undefined') ? EquipmentQuality.getName(nextQuality) : nextQuality;
    const goldFull = COST_UPGRADE_GOLD;
    const goldHalf = Math.floor(COST_UPGRADE_GOLD / 2);
    const hasGoldFull   = (p.money || 0) >= goldFull;
    const canUseCredit  = (credit >= COST_UPGRADE_CREDIT) && (p.money || 0) >= goldHalf;

    if (!hasGoldFull && !canUseCredit) {
      _log(`⚒ 金錢不足：強化需 ${goldFull} 金（或 ${goldHalf} 金 + ${COST_UPGRADE_CREDIT} 信用）。`, '#cc6633', false);
      return;
    }

    // 沒 ChoiceModal fallback：直接全付金
    if (typeof ChoiceModal === 'undefined') {
      Stats.modMoney(-goldFull);
      _setEntryQuality(entry, nextQuality);
      _log(`⚒ 葛拉強化「${entry.baseName}」→ ${qName}（${goldFull} 金）。`, '#d4af37', true);
      _render();
      if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
      return;
    }

    // 玩家自選：付全金 / 信用抵半 / 取消
    const choices = [];
    choices.push({
      id: 'pay_full',
      label: `付 ${goldFull} 金`,
      hint: hasGoldFull ? '' : '（金錢不足）',
      disabled: !hasGoldFull,
    });
    if (canUseCredit) {
      choices.push({
        id: 'pay_credit',
        label: `${goldHalf} 金 + ${COST_UPGRADE_CREDIT} 信用點（省半價）`,
        hint: `（你有 ${credit} 點信用）`,
      });
    }
    choices.push({ id: 'cancel', label: '取消', hint: '' });

    ChoiceModal.show({
      id: 'forge_upgrade_' + Date.now(),
      icon: '⚒',
      title: `強化「${entry.baseName}」→ ${qName}`,
      body: '葛拉：「⋯⋯怎麼付？」',
      forced: true,
      choices,
    }, {
      onChoose: (choiceId) => {
        if (choiceId === 'cancel') return;
        const useCredit = (choiceId === 'pay_credit');
        const goldCost  = useCredit ? goldHalf : goldFull;
        Stats.modMoney(-goldCost);
        if (useCredit) p.gra_credit = credit - COST_UPGRADE_CREDIT;
        _setEntryQuality(entry, nextQuality);
        const costStr = useCredit ? `${goldCost} 金 + 信用 ${COST_UPGRADE_CREDIT}` : `${goldCost} 金`;
        _log(`⚒ 葛拉強化「${entry.baseName}」→ ${qName}（${costStr}）。`, '#d4af37', true);
        // 🆕 2026-05-08：升級品質自動加詞綴（依新品質允許的 maxAffixCount）
        //   common→fine 解 1 詞綴 / fine→superb 加到 2 / superb→legendary 加到 3
        if (typeof Affixes !== 'undefined') {
          const inv2 = (entry.kind === 'weapon') ? p.weaponInventory : p.armorInventory;
          const item2 = inv2.find(e => e.id === entry.id);
          if (item2) {
            if (!Array.isArray(item2.affixes)) item2.affixes = [];
            const slot2 = (entry.kind === 'weapon') ? 'weapon' : 'armor';
            const targetCount = Affixes.maxAffixCountForQuality(nextQuality);
            while (item2.affixes.length < targetCount) {
              const newA = Affixes.rollAffix(slot2, Affixes.maxTierForQuality(nextQuality), item2.affixes);
              if (!newA) break;
              item2.affixes.push(newA);
              _log(`⚒ 隨升級獲得詞綴【${Affixes.getName(newA)}】(${Affixes.getDesc(newA)})`, '#d4af37', false);
            }
          }
        }
        // 🆕 2026-04-30 立刻 render + 延遲再 render（防 ChoiceModal close 動畫遮擋）
        _render();
        if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
        setTimeout(() => _render(), 250);
        // 🆕 強化成功 popup 反饋（玩家立即看到效果）
        if (typeof Stage !== 'undefined' && Stage.popupBig) {
          Stage.popupBig({
            icon: '⚒', title: `${entry.baseName} → ${qName}`, subtitle: '強化完成',
            color: 'gold', duration: 1200, shake: false, sound: 'level_up',
          });
        }
      }
    });
  }

  function _doTier() {
    const entry = _getSelectedEntry();
    const aff = (typeof teammates !== 'undefined') ? teammates.getAffection('blacksmithGra') : 0;
    if (!entry || !_canTier(entry, aff)) return;
    const p = Stats.player;
    if ((p.money || 0) < COST_TIER_GOLD) {
      _log(`⚒ 金錢不足：升 Tier 需 ${COST_TIER_GOLD} 金。`, '#cc6633', false);
      return;
    }
    const upgradeMap = (entry.tier === 1) ? WEAPON_TIER_UPGRADE : WEAPON_TIER_UPGRADE_T3;
    const newId = upgradeMap[entry.id];
    if (!newId) return;
    const newW = (typeof Weapons !== 'undefined') ? Weapons[newId] : null;
    if (!newW) { _log('⚒ 升 Tier 對照表異常。', '#cc6633', false); return; }

    _quickConfirm(`把「${entry.baseName}」升到 T${entry.tier + 1}（${newW.name}）：花 ${COST_TIER_GOLD} 金？`, () => {
      Stats.modMoney(-COST_TIER_GOLD);
      // 換 inventory entry id（保留 quality）
      const inv = p.weaponInventory;
      const idx = inv.findIndex(e => e.id === entry.id);
      if (idx >= 0) {
        const oldQuality = inv[idx].quality || 'common';
        inv[idx] = { id: newId, tier: entry.tier + 1, quality: oldQuality };
        // 同步裝備 ID
        if (p.equippedWeapon === entry.id) p.equippedWeapon = newId;
        if (p.equippedOffhand === entry.id) p.equippedOffhand = newId;
        _selectedItemId = newId;   // 保持選中
      }
      _log(`⚒ 葛拉把「${entry.baseName}」升到 ${newW.name}！`, '#d4af37', true);
      // 🆕 2026-04-30 立刻 render + 延遲再 render
      _render();
      if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
      setTimeout(() => _render(), 250);
      if (typeof Stage !== 'undefined' && Stage.popupBig) {
        Stage.popupBig({
          icon: '⚒', title: newW.name, subtitle: 'Tier 升級完成',
          color: 'gold', duration: 1500, shake: true, sound: 'acquire',
        });
      }
    });
  }

  // 🆕 2026-05-08：詞綴系統開啟（user 要求）
  //   條件：上紫以上品質 + 葛拉好感 ≥ 70 + 50 金 + 詞綴未滿
  //   每件武器 max 3 詞綴、護甲 max 2、依品質 maxAffixCountForQuality
  function _doAffix() {
    if (typeof Affixes === 'undefined') {
      _log('⚒ 葛拉：「⋯⋯詞綴系統未載入。」', '#886655', false);
      return;
    }
    const entry = _getSelectedEntry();
    if (!entry) {
      _log('⚒ 先選一件裝備。', '#886655', false);
      return;
    }
    const aff = (typeof teammates !== 'undefined') ? teammates.getAffection('blacksmithGra') : 0;
    if (!_canAffix(entry, aff)) {
      _log(`⚒ 葛拉：「⋯⋯這件還不夠格。需上紫以上 + 我好感 ≥ ${AFFIX_AFFINITY_REQ}。」`, '#886655', false);
      return;
    }

    const p = Stats.player;
    if ((p.money || 0) < COST_AFFIX_GOLD) {
      _log(`⚒ 葛拉：「⋯⋯詞綴貴。要 ${COST_AFFIX_GOLD} 金。」`, '#cc6633', false);
      return;
    }

    // 詞綴上限
    const slot = (entry.kind === 'weapon') ? 'weapon' : 'armor';
    const inv = (entry.kind === 'weapon') ? p.weaponInventory : p.armorInventory;
    const item = inv.find(e => e.id === entry.id);
    if (!item) return;
    if (!Array.isArray(item.affixes)) item.affixes = [];
    const maxCount = Affixes.maxAffixCountForQuality(item.quality);
    if (item.affixes.length >= maxCount) {
      _log(`⚒ 葛拉：「⋯⋯這件詞綴已滿（${item.affixes.length}/${maxCount}）。再強化品質才能加。」`, '#886655', false);
      return;
    }

    _quickConfirm(
      `鍛新詞綴：「${entry.baseName}」<br>消耗 ${COST_AFFIX_GOLD} 金<br>葛拉幫你抽一個（隨機）`,
      () => {
        // 抽詞綴
        const maxTier = Affixes.maxTierForQuality(item.quality);
        const newAffix = Affixes.rollAffix(slot, maxTier, item.affixes);
        if (!newAffix) {
          _log('⚒ 葛拉：「⋯⋯沒法再加了、所有詞綴都鍛過了。」', '#886655', false);
          return;
        }
        // 扣錢、加詞綴
        Stats.modMoney(-COST_AFFIX_GOLD);
        item.affixes.push(newAffix);
        const affixName = Affixes.getName(newAffix);
        const affixDesc = Affixes.getDesc(newAffix);
        _log(`⚒ 鍛成功！「${entry.baseName}」獲得詞綴【${affixName}】(${affixDesc})。`, '#d4af37', true);
        _render();
        if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
      }
    );
  }

  function _doTrade(kind, itemId) {
    const list = (kind === 'weapon') ? _getWeaponEntries() : _getArmorEntries();
    const entry = list.find(e => e.id === itemId);
    if (!entry) return;
    if (entry.isEquipped) {
      _log('⚒ 葛拉：「裝備中的不能上交。先換下來。」', '#cc6633', false);
      return;
    }
    const credits = TRADE_CREDITS[entry.quality] || 0;
    if (credits === 0) {
      _log('⚒ 葛拉：「這件熔不了什麼東西。」', '#886655', false);
      return;
    }
    // 🆕 2026-04-30 user 反饋：上交不要每次彈確認、直接點即交、可連續上交
    const p = Stats.player;
    const inv = (kind === 'weapon') ? p.weaponInventory : p.armorInventory;
    const idx = inv.findIndex(e => e.id === itemId);
    if (idx >= 0) inv.splice(idx, 1);
    // 🆕 2026-04-30 防呆：如果該 ID 還掛在裝備 slot 上、也要清掉（避免戰鬥引擎讀到不存在的 ID）
    ['equippedWeapon','equippedOffhand','equippedArmor','equippedHelmet','equippedArms','equippedLegs']
      .forEach(slot => {
        if (p[slot] === itemId) p[slot] = null;
      });
    p.gra_credit = (p.gra_credit || 0) + credits;
    // 🆕 2026-05-07：上交同時給銅幣（金錢來源 buff）
    const money = TRADE_MONEY[entry.quality] || 0;
    if (money > 0 && typeof Stats !== 'undefined' && Stats.modMoney) {
      Stats.modMoney(money);
    }
    _log(`⚒ 上交「${entry.baseName}」→ 葛拉信用 +${credits}（總 ${p.gra_credit}）／銅幣 +${money}`, '#88cc77', true);
    _render();
    if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
  }

  // 修改 inventory 內某 entry 的 quality
  function _setEntryQuality(entry, newQuality) {
    const p = Stats.player;
    const inv = (entry.kind === 'weapon') ? p.weaponInventory : p.armorInventory;
    const e = inv.find(it => it.id === entry.id);
    if (e) e.quality = newQuality;
  }

  function _nextQuality(q) {
    const order = ['crude', 'common', 'fine', 'superb', 'legendary'];
    const i = order.indexOf(q);
    if (i < 0) return q;
    if (i >= order.length - 1) return q;
    return order[i + 1];
  }

  return { open, close };
})();
