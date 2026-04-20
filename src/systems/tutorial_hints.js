/**
 * tutorial_hints.js — 對話型新手教學（D.28）
 *
 * 哲學：零介面提示，全部由 NPC 在合理時機講出來。
 *   - 不做小精靈彈窗、不做 tutorial overlay
 *   - 每個提示 1~3 句話，由對應 NPC 用自己的口氣說
 *   - 條件滿足一次就鎖 flag，不再觸發
 *   - 技術上只是 DialogueModal 的包裝
 *
 * 載入順序：flags.js 後、main.js 前。
 * 依賴：Flags, Stats, DialogueModal（播放時才需要）
 *
 * API:
 *   TutorialHints.tryShow(p) → { id, lines } 或 null
 *     由 main.js 在 doAction 結束、sleepEndDay 結束呼叫。
 *     由呼叫方決定用 DialogueModal.play 還是 _pendingDialogues 佇列。
 */
const TutorialHints = (() => {

  // ══════════════════════════════════════════════════
  // 提示定義（按優先度順序）
  // ══════════════════════════════════════════════════
  //
  // 每個 HINT：
  //   id        — flag 名稱（會自動加 hint_ 前綴防撞）
  //   condition — (player) => boolean，回 true 觸發
  //   lines     — DialogueModal 對話陣列
  //
  // 條件要「剛達到時觸發一次」— 用 flag 鎖住就好
  //
  const HINTS = [
    // ── 首次 EXP 到上限 → 升級機制教學 ──
    {
      id: 'first_exp_ready',
      condition: (p) => {
        if (!p || !p.exp) return false;
        const keys = ['STR','DEX','CON','AGI','WIL'];
        return keys.some(k => {
          const lvl = p[k] || 10;
          const exp = p.exp[k] || 0;
          const cost = (typeof Stats !== 'undefined' && Stats.expToNext)
            ? Stats.expToNext(lvl) : 50;
          return exp >= cost;
        });
      },
      lines: [
        { speaker: '監督官', text: '等等。你身上那些汗沒白流。' },
        { speaker: '監督官', text: '身上攢夠了——自己會知道。右上「詳細」翻一翻。' },
        { speaker: '監督官', text: '種下什麼，就收什麼。別忘了。' },
      ],
    },

    // ── 首次心情 < 30 → 偷懶機制暗示（梅拉塞） ──
    {
      id: 'low_mood',
      condition: (p) => (p?.mood || 100) < 30,
      lines: [
        { speaker: '梅拉塞', text: '……孩子，你臉色不對。' },
        { speaker: '梅拉塞', text: '撐不住的時候，找個陰涼角落躲一下。' },
        { speaker: '梅拉塞', text: '別讓長官看見就行——真的被瞪到了，也別怪大家。' },
      ],
    },

    // ── 首次飽食 < 30 → 食物重要性（老默） ──
    {
      id: 'low_food',
      condition: (p) => (p?.food || 100) < 30,
      lines: [
        { speaker: '老默', text: '餓著肚子的人，我看過太多了。' },
        { speaker: '老默', text: '鞭打恢復得了，餓出來的虛弱，恢復不了。' },
        { speaker: '老默', text: '廚房那邊，該去就去。' },
      ],
    },

    // ── 首次受傷 ailment → 治療提示（老默） ──
    {
      id: 'first_injury',
      condition: (p) => Array.isArray(p?.ailments) &&
                        p.ailments.some(a => typeof a === 'string' && a.includes('injury')),
      lines: [
        { speaker: '老默', text: '讓我看看——嗯，不重。' },
        { speaker: '老默', text: '帶著這種傷繼續練，練的不是力量，是死法。' },
        { speaker: '老默', text: '傷沒好前別逞強。到我這裡來，我處理。' },
      ],
    },

    // ── 首次協力爆擊 → 好感度價值（卡西烏斯） ──
    //   需由 main.js 在偵測到 synergyMult > 1 時呼叫 markSynergyHappened()
    {
      id: 'first_synergy',
      condition: () => _synergyHappened,
      lines: [
        { speaker: '卡西烏斯', text: '感覺到了嗎？' },
        { speaker: '卡西烏斯', text: '跟熟悉的人一起練——身體會自己懂。' },
        { speaker: '卡西烏斯', text: '在這裡，交到的每一個朋友都是武器。' },
      ],
    },

    // ── 首次心情 > 70 高 → 無提示（好狀態不需要打擾） ──
    // 略

    // ── 首次名聲提升（fame >= 5）→ 競技場邏輯（長官） ──
    {
      id: 'first_fame',
      condition: (p) => (p?.fame || 0) >= 5,
      lines: [
        { speaker: '塔倫長官', text: '看過你的報告了。' },
        { speaker: '塔倫長官', text: '名聲是這裡唯一能買東西的貨幣。' },
        { speaker: '塔倫長官', text: '——也是唯一能買命的。繼續。' },
      ],
    },

    // ── 首次存錢（金錢 >= 10）→ 錢的用途（侍從） ──
    {
      id: 'first_money',
      condition: (p) => (p?.money || 0) >= 10,
      lines: [
        { speaker: '侍從', text: '你攢到一點銅幣了。' },
        { speaker: '侍從', text: '這裡買不到自由——但偶爾能買條命。' },
        { speaker: '侍從', text: '餓得受不了的時候，梅拉或許會看在銅幣份上多塞你一點。' },
      ],
    },

    // ── 首次 CON 升級 → 體力上限連動（內心獨白，跨訓練所通用） ──
    {
      id: 'first_stamina_grow',
      condition: () => (typeof Flags !== 'undefined') && Flags.has('con_ever_raised'),
      lines: [
        { speaker: '你', text: '（好像……練著練著，體力比以前多了？）' },
        { speaker: '你', text: '（或許，還能再增加？）' },
      ],
    },

    // ── 首次 NPC 好感 >= 30 → 協力機制（卡西烏斯） ──
    {
      id: 'first_aff_30',
      condition: (p) => {
        if (typeof teammates === 'undefined' || !teammates.getAffection) return false;
        const ids = ['orlan','cassius','melaKook','doctorMo','officer','masterArtus'];
        return ids.some(id => teammates.getAffection(id) >= 30);
      },
      lines: [
        { speaker: '卡西烏斯', text: '你跟人開始熟了。' },
        { speaker: '卡西烏斯', text: '在這裡，信得過的人不多。' },
        { speaker: '卡西烏斯', text: '找到一個，就抓緊一個。他們會讓你的訓練不一樣。' },
      ],
    },
  ];

  // 供外部標記「協力爆擊發生過了」
  let _synergyHappened = false;
  function markSynergyHappened() { _synergyHappened = true; }

  // ══════════════════════════════════════════════════
  // 主入口：挑一個還沒顯示、條件符合的 hint 回傳
  // ══════════════════════════════════════════════════
  function tryShow(p) {
    if (typeof Flags === 'undefined') return null;
    for (const h of HINTS) {
      const flag = `hint_${h.id}`;
      if (Flags.has(flag)) continue;
      try {
        if (!h.condition(p)) continue;
      } catch (e) { continue; }
      Flags.set(flag, true);
      return { id: flag, lines: h.lines };
    }
    return null;
  }

  // ══════════════════════════════════════════════════
  // Public API
  // ══════════════════════════════════════════════════
  return {
    tryShow,
    markSynergyHappened,
    HINTS,   // expose for debugging
  };
})();
