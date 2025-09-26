export type ActionType =
  | 'Strike'
  | 'Guard'
  | 'Hex'
  | 'Heal'
  | 'Charge'
  | 'StealTurn'
  | 'Double'
  | 'Wild';

export type ElementType =
  | 'Flame'
  | 'Aqua'
  | 'Terra'
  | 'Volt'
  | 'Gale'
  | 'Bloom'
  | 'Metal'
  | 'Void'
  | 'Wild';

export type ModType =
  | 'x1'
  | 'x1.5'
  | 'x2'
  | 'Crit+'
  | 'Pierce'
  | 'DoT'
  | 'Splash'
  | 'Shield+'
  | 'Leech'
  | 'Cleanse'
  | 'Miss?'
  | '🎴 Card-Ticket';

export interface ReelOption<T extends string> {
  label: T;
  weight: number;
}

export interface PitpetConfig {
  name: string;
  stats: CombatStats;
}

export interface CombatStats {
  HP: number;
  ATK: number;
  DEF: number;
  SPD: number;
  LUK: number;
  WIS: number;
  Level: number;
}

export interface Config {
  startingCoins: number;
  maxRounds: number;
  betTiers: number[];
  betBoost: Record<number, number>;
  elementChain: ElementType[];
  advantageMultiplier: number;
  disadvantageMultiplier: number;
  neutralMultiplier: number;
  pitpets: {
    player: PitpetConfig;
    ai: PitpetConfig;
  };
  reelA: ReelOption<ActionType>[];
  reelB: ReelOption<ElementType>[];
  reelC: ReelOption<ModType>[];
  reelCBoostMods: ModType[];
  petjack: {
    deckValues: number[];
  };
}

export interface SlotCell {
  row: number;
  column: number; // 0 action,1 element,2 mod
  action: ActionType;
  element: ElementType;
  mod: ModType;
  locked: boolean;
}

export interface SlotColumnValues<T extends string> {
  values: T[];
}

export interface SlotGrid {
  actions: ActionType[];
  elements: ElementType[];
  mods: ModType[];
  lockedCell?: { row: number; column: number };
  lockUsed: boolean;
  respinUsed: boolean;
}

export interface ComboRow {
  action: ActionType;
  element: ElementType;
  mod: ModType;
}

export type GamePhase =
  | 'Idle'
  | 'BetPaid'
  | 'Spun'
  | 'RowChosen'
  | 'PetJack'
  | 'ResolveTurn'
  | 'EndRound'
  | 'CheckEnd'
  | 'Finished';

export type Side = 'player' | 'ai';

export interface CombatantState {
  config: PitpetConfig;
  hp: number;
  shield: number;
  dot?: { ticksLeft: number; damage: number };
  chargeBonus: boolean;
  critMod: number;
  statusMod: number;
  initiativeBoost: boolean;
  skipNext: boolean;
  betBoost: number;
  lastElement?: ElementType;
}

export interface BattleLogLine {
  text: string;
  round: number;
}

export interface RoundContext {
  round: number;
  playerCombo?: ComboRow;
  aiCombo?: ComboRow;
}

export interface MatchResult {
  winner: Side | 'draw';
}

export interface StatusEffect {
  type: 'DoT';
  source: Side;
  ticksLeft: number;
  damage: number;
}

export interface ChargeEffect {
  side: Side;
  active: boolean;
}

export interface SpinContext {
  grid: SlotGrid;
  combos: ComboRow[];
}

export interface SpinOutcome extends SpinContext {}

export interface ActionResolution {
  logs: string[];
  damage: number;
  hit: boolean;
  critical: boolean;
  skipped: boolean;
  defeated: boolean;
}

export interface CombatResolution {
  logs: string[];
  playerDefeated: boolean;
  aiDefeated: boolean;
}

export interface PetJackState {
  playerHand: number[];
  dealerHand: number[];
  stage: 'playerTurn' | 'dealerTurn' | 'result' | 'buff';
  outcome?: 'player' | 'dealer' | 'push';
}

export interface GameSnapshot {
  phase: GamePhase;
  coins: number;
  bet: number;
  round: number;
  player: CombatantState;
  ai: CombatantState;
  playerGrid?: SpinOutcome;
  aiGrid?: SpinOutcome;
  logs: BattleLogLine[];
  petJack?: PetJackState;
  canSpin: boolean;
  canRespins: {
    action: boolean;
    element: boolean;
    mod: boolean;
  };
}
