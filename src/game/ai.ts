import { CONFIG } from './config';
import { RNG } from './rng';
import { CombatantState, ComboRow, ElementType, SpinOutcome } from './types';
import { spinForge, respinColumn } from './reels';

function elementMultiplier(attackerElement: ElementType, defenderElement?: ElementType): number {
  if (attackerElement === 'Wild') return CONFIG.neutralMultiplier;
  if (!defenderElement || defenderElement === 'Wild') {
    return CONFIG.neutralMultiplier;
  }
  const chain = CONFIG.elementChain;
  for (let i = 0; i < chain.length - 1; i += 1) {
    if (chain[i] === attackerElement) {
      const adv = chain[i + 1];
      const disadv = chain[i === 0 ? chain.length - 2 : i - 1];
      if (adv === defenderElement) return CONFIG.advantageMultiplier;
      if (disadv === defenderElement) return CONFIG.disadvantageMultiplier;
    }
  }
  if (attackerElement === defenderElement) {
    return CONFIG.neutralMultiplier;
  }
  if (attackerElement === 'Void' || defenderElement === 'Void') {
    return CONFIG.neutralMultiplier;
  }
  return CONFIG.neutralMultiplier;
}

function modScalar(mod: string): number {
  if (mod === 'x1.5') return 1.5;
  if (mod === 'x2') return 2;
  return 1;
}

function basePower(action: string): number {
  if (action === 'Double') return 0.7 * 2;
  if (action === 'Strike' || action === 'Wild') return 1;
  return 0;
}

function expectedComboValue(
  combo: ComboRow,
  attacker: CombatantState,
  defender: CombatantState
): number {
  const power = basePower(combo.action);
  const attack = attacker.config.stats.ATK;
  const defence = combo.mod === 'Pierce' ? defender.config.stats.DEF * 0.6 : defender.config.stats.DEF;
  const base = (attack / Math.max(1, defence)) * power;
  const element = combo.action === 'Wild' ? CONFIG.advantageMultiplier : elementMultiplier(combo.element, defender.lastElement);
  const scalar = modScalar(combo.mod);
  const bet = attacker.betBoost || 1;
  let bonus = 0;
  if (combo.action === 'StealTurn') {
    bonus = attacker.config.stats.ATK * 0.6;
  }
  return base * element * scalar * bet + bonus;
}

export function aiSpin(rng: RNG, bet: number): SpinOutcome {
  return spinForge(rng, bet);
}

export function aiConsiderRespins(
  current: SpinOutcome,
  rng: RNG,
  bet: number,
  attacker: CombatantState,
  defender: CombatantState
): SpinOutcome {
  const baseRows = current.combos.map((combo) => expectedComboValue(combo, attacker, defender));
  const baseBest = Math.max(...baseRows);
  const columns: Array<'action' | 'element' | 'mod'> = ['action', 'element', 'mod'];
  let bestOutcome = current;
  let bestValue = baseBest;
  for (const column of columns) {
    const trial = respinColumn(column, rng, bet, current.grid);
    const values = trial.combos.map((combo) => expectedComboValue(combo, attacker, defender));
    const trialBest = Math.max(...values);
    if (trialBest > bestValue) {
      bestValue = trialBest;
      bestOutcome = trial;
    }
  }
  return bestOutcome;
}

export function aiChooseRow(outcome: SpinOutcome, attacker: CombatantState, defender: CombatantState): number {
  let bestIndex = 0;
  let bestValue = -Infinity;
  outcome.combos.forEach((combo, index) => {
    const value = expectedComboValue(combo, attacker, defender);
    if (value > bestValue) {
      bestValue = value;
      bestIndex = index;
    }
  });
  return bestIndex;
}
