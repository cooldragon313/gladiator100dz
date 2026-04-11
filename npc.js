/**
 * npc.js — NPC definitions and affection tracking
 */
const teammates = (() => {

  // ── NPC definitions ──────────────────────────────────
  const NPC_DEFS = {
    // ── Fellow gladiators (teammates) ──
    cassius: {
      id: 'cassius', name: '卡西烏斯',
      role: 'teammate',
      title: '老練劍士',
      desc: '在競技場存活超過五年的老兵。話不多，但每句話都值得記住。',
      baseAffection: 10,
    },
    dagiSlave: {
      id: 'dagiSlave', name: '達吉',
      role: 'teammate',
      title: '年輕奴隸',
      desc: '和你一樣剛被賣進來的年輕人。眼神裡還有尚未被磨滅的光。',
      baseAffection: 20,
    },
    ursa: {
      id: 'ursa', name: '烏爾薩',
      role: 'teammate',
      title: '重甲鬥士',
      desc: '身形如牛，性格卻比你想像的溫和。他的拳頭能把人打進地裡。',
      baseAffection: 5,
    },
    oldSlave: {
      id: 'oldSlave', name: '老篤',
      role: 'teammate',
      title: '垂死老奴',
      desc: '也許再過幾天就會死去。他說他曾是將軍，但沒有人相信他。',
      baseAffection: 30,
    },

    // ── Authority figures (audience) ──
    prisonGuard: {
      id: 'prisonGuard', name: '獄卒',
      role: 'officer',
      title: '牢房守衛',
      desc: '表情木然，從不多說一個字。手中的鑰匙決定你是否能呼吸新鮮空氣。',
      baseAffection: 0,
    },
    overseer: {
      id: 'overseer', name: '監督官',
      role: 'audience',
      title: '訓練監督',
      desc: '嚴厲、精確、毫無憐憫。他訓練出來的人，要麼成為最強的鬥士，要麼死在訓練場。',
      baseAffection: 0,
    },
    officer: {
      id: 'officer', name: '塔倫長官',
      role: 'audience',
      title: '競技場長官',
      desc: '管理整個競技場的實權人物。他的一個眼神能讓你獲得特權，也能讓你消失。',
      baseAffection: 0,
    },
    blacksmithGra: {
      id: 'blacksmithGra', name: '葛拉',
      role: 'audience',
      title: '鐵匠',
      desc: '沉默的工匠，打鐵三十年。他打造的武器從未在戰場上折斷——使用者倒是常常折斷。',
      baseAffection: 10,
    },
    melaKook: {
      id: 'melaKook', name: '梅拉',
      role: 'audience',
      title: '廚娘',
      desc: '用廚房剩料也能做出讓人流淚的食物。她悄悄多塞給你的那口飯，你永遠記得。',
      baseAffection: 15,
    },
    masterArtus: {
      id: 'masterArtus', name: '阿圖斯大人',
      role: 'audience',
      title: '競技場主人',
      desc: '你的所有者。冷靜、理性，將每一個角鬥士視為投資。你的生死，是他帳本上的數字。',
      baseAffection: 0,
    },
    masterServant: {
      id: 'masterServant', name: '侍從',
      role: 'audience',
      title: '主人的侍從',
      desc: '對主人言聽計從。傳話、監視、記錄——他的眼睛隨時都在。',
      baseAffection: 5,
    },
  };

  // ── Runtime affection state (separate from player.affection for NPCs) ──
  // Key: npcId, Value: current affection
  const affectionMap = {};

  Object.values(NPC_DEFS).forEach(npc => {
    affectionMap[npc.id] = npc.baseAffection;
  });

  function getAffection(npcId) {
    return affectionMap[npcId] || 0;
  }

  function modAffection(npcId, delta) {
    affectionMap[npcId] = Math.max(0, Math.min(100, (affectionMap[npcId] || 0) + delta));
  }

  function getNPC(npcId) {
    return NPC_DEFS[npcId] || null;
  }

  return { NPC_DEFS, getAffection, modAffection, getNPC };
})();
