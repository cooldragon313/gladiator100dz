/**
 * help_modal.js — 操作說明 Modal（D.28 輔助）
 *
 * 純查詢型介面。玩家按右上「？」按鈕才會打開。
 * 配合對話型教學（NPC 講話的那些）做 fallback。
 *
 * 哲學：用世界內語言（「找葛拉」），不用 tutorial 術語（「打開裝備欄」）。
 *       純文字分區，不放 screenshot、不放箭頭指引。
 *
 * 載入順序：無依賴，放在 main.js 之前即可。
 *
 * API:
 *   HelpModal.show()
 *   HelpModal.hide()
 */
const HelpModal = (() => {

  // ══════════════════════════════════════════════════
  // 分類內容
  // ══════════════════════════════════════════════════
  const SECTIONS = [
    {
      icon: '⏳',
      title: '一天的流程',
      items: [
        '一天有 4 個訓練時段（每段 2 小時）。選完 4 個動作後就會到傍晚。',
        '中間有早餐 / 午餐 / 晚餐 / 休息時段會自動過，不用你選。',
        '日末按右下「就寢・結束今天」進入下一天。',
        '剛開始幾天什麼都不會發生，你就是個普通奴隸。第 5 天會是第一個大事件。',
        '距離萬骸祭剩 100 天。那是你要活下去的目標。',
      ],
    },
    {
      icon: '⚔',
      title: '訓練與屬性',
      items: [
        '左邊動作按鈕：5 種訓練對應 5 種屬性（力量/敏捷/體質/靈巧/意志）。',
        '訓練累積「EXP」，不會自動升級。EXP 夠了右上「詳細」按鈕會跳金色徽章。',
        '打開詳細頁，金色發光的屬性卡可以點「升級」按鈕消耗 EXP 升等。',
        '冥想調息是特例：不消耗體力、練意志。體力耗盡時的唯一選擇。',
        '訓練會扣一點心情（被迫勞動本來就不爽）。冥想不扣。',
      ],
    },
    {
      icon: '❤️',
      title: '四條 + 飽食的意義',
      items: [
        'HP：戰鬥用，低了會輸。受傷才會扣，訓練不會。',
        '體力：決定今天能練幾次。每晚睡覺恢復 45。',
        '飽食：低於 30 → 日結扣心情 + HP。靠早餐、廚師事件回復。',
        '心情：影響訓練效率。低了會強制崩潰、終止訓練。',
        '要特別注意飽食和心情——餓著 + 心情低會惡性循環把你拖死。',
      ],
    },
    {
      icon: '😴',
      title: '偷懶放空（右下那顆黃色的）',
      items: [
        '這是奴隸唯一能主動補心情的動作。體力也會回一點。',
        '代價：現場有誰就扣誰的好感。主人 -8、長官 -5、監督官 -3。',
        '友善 NPC（卡西烏斯/奧蘭/梅拉/老默）在場不扣，他們會幫你掩護。',
        '沒人在場 → 30% 機率被巡邏抓包，扣得更多。運氣不好就認栽。',
        '心情撐得住就乖乖訓練，快崩潰了就去偷懶。這是奴隸的藝術。',
      ],
    },
    {
      icon: '🤝',
      title: 'NPC 好感與協力',
      items: [
        '好感度不會顯示數字。從 NPC 的對話跟反應去感受。',
        '好感夠高的 NPC 在場陪你訓練 → 協力加成，EXP 多、體力多耗一點。',
        '好感分 9 層（盟友 / 朋友 / 熟人 / ... / 宿敵）。名字顏色會變。',
        '每個 NPC 有「故事揭露」—— 好感到某門檻會自動觸發，揭開他們的過去。',
        '友善 NPC 是奴隸生活的命脈。關係越近，世界越活。',
      ],
    },
    {
      icon: '🎭',
      title: '戰鬥與百日祭',
      items: [
        'Day 5 是第一個考驗 — 三個人進去，兩個人出來。你會明白這個世界的規則。',
        'Day 60 左右有個關於奧蘭的偷藥大事件。你的選擇會決定後面很多事。',
        'Day 85 是奧蘭的訣別。不同選擇 → 不同結局。',
        'Day 100 萬骸祭 — 最後一戰。贏了看你這百日怎麼過來，有 7 種結局可能。',
        '平日戰敗不會死，只會重傷 + 恥辱。Day 100 戰敗才是真的死。',
      ],
    },
    {
      icon: '💾',
      title: '存檔與快捷鍵',
      items: [
        'F5：快速存檔（開發中，給你放心試選項）',
        'F9：快速讀取（回到上一次 F5 的狀態）',
        'Ctrl 或 Space：對話 Modal 快進',
        '設定頁有 5 個手動存檔槽 + 自動存檔 + 戰前備份槽。',
        '存檔是每個瀏覽器獨立的。換裝置要手動轉存檔檔案。',
      ],
    },
    {
      icon: '📚',
      title: '人物詳細頁（右上「詳細」）',
      items: [
        '角色 tab：六角形屬性圖 / EXP 升級 / 裝備欄位 / 道德光譜 / 特性疤痕病痛',
        '技能 tab：已學會的被動技能（Phase 2 會擴充）',
        '關係圖 tab：所有見過的 NPC 卡片，好感色分 + 解鎖的 storyReveals',
        '裝備欄位點一下會展開 picker，可以換主手 / 副手 / 胸甲。',
        '雙手武器會自動清掉副手。',
      ],
    },
  ];

  // ══════════════════════════════════════════════════
  // DOM 建立
  // ══════════════════════════════════════════════════
  let _injected = false;
  function _inject() {
    if (_injected) return;
    _injected = true;

    const overlay = document.createElement('div');
    overlay.id = 'modal-help';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="help-box">
        <div class="help-header">
          <span class="help-title">❓ 操作說明</span>
          <button class="modal-close" id="btn-close-help">✕</button>
        </div>
        <div class="help-body">
          ${SECTIONS.map(s => `
            <section class="help-section">
              <h3 class="help-h3">${s.icon}　${s.title}</h3>
              <ul class="help-list">
                ${s.items.map(t => `<li>${t}</li>`).join('')}
              </ul>
            </section>
          `).join('')}
          <p class="help-footer">不懂的就關掉視窗，繼續玩。玩了就會懂。</p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hide();
    });
    document.getElementById('btn-close-help')?.addEventListener('click', hide);
  }

  function show() {
    _inject();
    document.getElementById('modal-help')?.classList.add('open');
  }
  function hide() {
    document.getElementById('modal-help')?.classList.remove('open');
  }

  // ══════════════════════════════════════════════════
  // Public API
  // ══════════════════════════════════════════════════
  return {
    show,
    hide,
    SECTIONS,   // expose for debugging
  };
})();
