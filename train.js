/**
 * train.js — Training actions available at training grounds
 * Each action costs stamina/time and gives attribute/stat gains.
 */
const Training = {
  basicSwing: {
    id: 'basicSwing', name: '基礎揮砍',
    desc: '反覆揮動武器，磨礪基本攻擊動作。',
    timeRequired: 60,    // minutes
    staminaCost: 15,
    foodCost: 5,
    gains: [{ type: 'attr', key: 'STR', delta: 0.5 }],
    minField: 'oldTraining',
  },
  footwork: {
    id: 'footwork', name: '步法練習',
    desc: '在沙地上反覆移動，提高靈敏度與閃避能力。',
    timeRequired: 60,
    staminaCost: 20,
    foodCost: 5,
    gains: [{ type: 'attr', key: 'AGI', delta: 0.5 }],
    minField: 'oldTraining',
  },
  endurance: {
    id: 'endurance', name: '耐力訓練',
    desc: '全副武裝跑步，直到精疲力竭。強化體質。',
    timeRequired: 90,
    staminaCost: 30,
    foodCost: 10,
    gains: [{ type: 'attr', key: 'CON', delta: 0.5 }, { type: 'vital', key: 'hpMax', delta: 2 }],
    minField: 'oldTraining',
  },
  sparring: {
    id: 'sparring', name: '對練',
    desc: '與隊友切磋，同時提升攻擊與反應速度。',
    timeRequired: 90,
    staminaCost: 25,
    foodCost: 8,
    gains: [
      { type: 'attr', key: 'STR', delta: 0.3 },
      { type: 'attr', key: 'DEX', delta: 0.3 },
    ],
    minField: 'stdTraining',
    requireTeammate: true,
  },
  heavyLift: {
    id: 'heavyLift', name: '重量訓練',
    desc: '舉起重石，蠻力滾滾而來。',
    timeRequired: 60,
    staminaCost: 20,
    foodCost: 10,
    gains: [{ type: 'attr', key: 'STR', delta: 0.8 }],
    minField: 'stdTraining',
  },
  meditation: {
    id: 'meditation', name: '冥想調息',
    desc: '靜坐調整呼吸，強化意志力，恢復部分心情。',
    timeRequired: 60,
    staminaCost: 5,
    foodCost: 0,
    gains: [
      { type: 'attr',  key: 'WIL',  delta: 0.4 },
      { type: 'vital', key: 'mood', delta: 10  },
    ],
    minField: 'oldTraining',
  },
};
