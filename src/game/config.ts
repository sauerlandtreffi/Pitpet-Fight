import { ActionType, Config, ElementType, ModType } from './types';

const actions: { label: ActionType; weight: number }[] = [
  { label: 'Strike', weight: 36 },
  { label: 'Guard', weight: 16 },
  { label: 'Hex', weight: 14 },
  { label: 'Heal', weight: 14 },
  { label: 'Charge', weight: 10 },
  { label: 'StealTurn', weight: 5 },
  { label: 'Double', weight: 4 },
  { label: 'Wild', weight: 1 }
];

const elements: { label: ElementType; weight: number }[] = [
  { label: 'Flame', weight: 12 },
  { label: 'Aqua', weight: 12 },
  { label: 'Terra', weight: 12 },
  { label: 'Volt', weight: 12 },
  { label: 'Gale', weight: 12 },
  { label: 'Bloom', weight: 12 },
  { label: 'Metal', weight: 12 },
  { label: 'Void', weight: 12 },
  { label: 'Wild', weight: 4 }
];

const mods: { label: ModType; weight: number }[] = [
  { label: 'x1', weight: 30 },
  { label: 'x1.5', weight: 22 },
  { label: 'x2', weight: 10 },
  { label: 'Crit+', weight: 12 },
  { label: 'Pierce', weight: 8 },
  { label: 'DoT', weight: 6 },
  { label: 'Splash', weight: 5 },
  { label: 'Shield+', weight: 4 },
  { label: 'Leech', weight: 2 },
  { label: 'Cleanse', weight: 0.8 },
  { label: 'Miss?', weight: 0.2 },
  { label: '🎴 Card-Ticket', weight: 10 }
];

export const CONFIG: Config = {
  startingCoins: 1000,
  maxRounds: 10,
  betTiers: [10, 20, 50, 100],
  betBoost: {
    10: 1.0,
    20: 1.1,
    50: 1.25,
    100: 1.45
  },
  elementChain: ['Flame', 'Bloom', 'Terra', 'Volt', 'Gale', 'Metal', 'Aqua', 'Flame'],
  advantageMultiplier: 1.25,
  disadvantageMultiplier: 0.8,
  neutralMultiplier: 1.0,
  pitpets: {
    player: {
      name: 'Flaro',
      stats: { HP: 180, ATK: 40, DEF: 28, SPD: 22, LUK: 14, WIS: 16, Level: 8 }
    },
    ai: {
      name: 'Aqualin',
      stats: { HP: 220, ATK: 34, DEF: 34, SPD: 18, LUK: 10, WIS: 20, Level: 8 }
    }
  },
  reelA: actions,
  reelB: elements,
  reelC: mods,
  reelCBoostMods: ['x2', 'Crit+', 'Pierce', 'Leech'],
  petjack: {
    deckValues: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  }
};

export type { Config };
