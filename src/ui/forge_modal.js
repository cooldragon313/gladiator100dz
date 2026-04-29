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
    return el;
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
        return {
          kind: 'armor',
          id: e.id,
          baseName: a.name || e.id,
          quality: e.quality || 'common',
          tier: e.tier || 1,
          isEquipped: (p.equippedArmor === e.id),
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
      ? `<div><span class="speaker">葛拉：</span>給我吧。我熔一熔給其他兄弟用。</div>
         <div><span class="speaker">葛拉：</span>⋯⋯點哪一件就換哪一件。</div>`
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
          <span class="btn-cost">${COST_UPGRADE_GOLD} 金　/　信用 ${COST_UPGRADE_CREDIT} 抵半</span>
        </button>
        <button class="forge-action-btn" data-act="tier" ${canTier ? '' : 'disabled'} title="${tierTitle}">
          升 Tier
          <span class="btn-cost">${COST_TIER_GOLD} 金　好感 ${TIER_AFFINITY_REQ}+</span>
        </button>
        <button class="forge-action-btn" data-act="affix" ${canAffix ? '' : 'disabled'} title="${affixTitle}">
          鍛新詞綴
          <span class="btn-cost">${COST_AFFIX_GOLD} 金　Phase 2 待開放</span>
        </button>
        <button class="forge-action-btn trade" data-act="trade-mode">上交（換信用點）</button>
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
        <span>金錢：${p.money || 0}　·　葛拉信用：<span class="forge-credit">${credit}</span></span>
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
    const useCredit = (credit >= COST_UPGRADE_CREDIT);
    const goldCost  = useCredit ? Math.floor(COST_UPGRADE_GOLD / 2) : COST_UPGRADE_GOLD;
    if ((p.money || 0) < goldCost) {
      _log(`⚒ 金錢不足：強化需 ${goldCost} 金。`, '#cc6633', false);
      return;
    }
    const nextQuality = _nextQuality(entry.quality);
    const qName = (typeof EquipmentQuality !== 'undefined') ? EquipmentQuality.getName(nextQuality) : nextQuality;

    const confirmText = useCredit
      ? `強化「${entry.baseName}」到 ${qName}：花 ${goldCost} 金 + 信用 ${COST_UPGRADE_CREDIT} 點？`
      : `強化「${entry.baseName}」到 ${qName}：花 ${goldCost} 金？`;

    _quickConfirm(confirmText, () => {
      Stats.modMoney(-goldCost);
      if (useCredit) p.gra_credit = credit - COST_UPGRADE_CREDIT;
      _setEntryQuality(entry, nextQuality);
      _log(`⚒ 葛拉強化「${entry.baseName}」→ ${qName}。`, '#d4af37', true);
      _render();
      if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
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
      _render();
      if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
    });
  }

  function _doAffix() {
    // Phase 2 待開放
    _log('⚒ 葛拉：「⋯⋯詞綴系統還沒開、改天再來。」（Phase 2 待開放）', '#886655', false);
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
    _quickConfirm(`上交「${entry.baseName}」換 ${credits} 信用點？`, () => {
      const p = Stats.player;
      const inv = (kind === 'weapon') ? p.weaponInventory : p.armorInventory;
      const idx = inv.findIndex(e => e.id === itemId);
      if (idx >= 0) inv.splice(idx, 1);
      p.gra_credit = (p.gra_credit || 0) + credits;
      _log(`⚒ 上交「${entry.baseName}」→ 葛拉信用 +${credits}（總 ${p.gra_credit}）`, '#88cc77', true);
      _render();
      if (typeof Game !== 'undefined' && Game.renderAll) Game.renderAll();
    });
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
