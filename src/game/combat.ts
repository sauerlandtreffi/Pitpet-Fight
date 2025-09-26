import { CONFIG } from './config';
import { RNG } from './rng';
import {
  ActionType,
  ComboRow,
  CombatantState,
  ElementType,
  ModType,
  Side
} from './types';
import { clamp, formatNumber } from './utils';

interface ResolveParams {
  attacker: CombatantState;
  defender: CombatantState;
  combo: ComboRow;
  attackerSide: Side;
  defenderSide: Side;
  rng: RNG;
  log: (text: string) => void;
  round: number;
}

const damagingActions: ActionType[] = ['Strike', 'Double', 'Wild'];

function isDamaging(action: ActionType): boolean {
  return damagingActions.includes(action);
}

function elementMultiplier(attackerElement: ElementType, defenderElement?: ElementType): number {
  if (attackerElement === 'Wild') return CONFIG.neutralMultiplier;
  if (!defenderElement || defenderElement === 'Wild') {
    return CONFIG.neutralMultiplier;
  }
  const chain = CONFIG.elementChain;
  for (let i = 0; i < chain.length - 1; i += 1) {
    const current = chain[i];
    const next = chain[i + 1];
    if (current === attackerElement) {
      if (next === defenderElement) {
        return CONFIG.advantageMultiplier;
      }
      const prev = chain[i === 0 ? chain.length - 2 : i - 1];
      if (prev === defenderElement) {
        return CONFIG.disadvantageMultiplier;
      }
      break;
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

function chooseWildElement(defenderElement?: ElementType): ElementType {
  if (!defenderElement || defenderElement === 'Wild') {
    return 'Void';
  }
  const chain = CONFIG.elementChain;
  const index = chain.indexOf(defenderElement);
  if (index === -1) return 'Void';
  const next = chain[(index + chain.length - 1) % (chain.length - 1)];
  return next;
}

function modScalar(mod: ModType): number {
  switch (mod) {
    case 'x1.5':
      return 1.5;
    case 'x2':
      return 2;
    case 'x1':
    default:
      return 1;
  }
}

function statusChance(attacker: CombatantState, defender: CombatantState): number {
  const base = 35 + (attacker.config.stats.WIS - defender.config.stats.WIS) / 4 + attacker.statusMod;
  return clamp(base, 15, 65);
}

function critChance(attacker: CombatantState, mod: ModType): number {
  const base = 10 + attacker.config.stats.LUK / 3 + attacker.critMod;
  const bonus = mod === 'Crit+' ? 15 : 0;
  return Math.max(0, base + bonus);
}

function critMultiplier(attacker: CombatantState): number {
  return 1.75 * (1 + attacker.config.stats.LUK / 400);
}

function applyShield(target: CombatantState, value: number): void {
  target.shield += value;
}

function resolveDamage(
  params: ResolveParams,
  power: number,
  element: ElementType
): { hit: boolean; crit: boolean; damage: number; defeated: boolean } {
  const { attacker, defender, rng, log, combo } = params;
  const missPenalty = combo.mod === 'Miss?' ? -30 : 0;
  const hitChance = clamp(
    90 + (attacker.config.stats.SPD - defender.config.stats.SPD) / 5 + missPenalty,
    30,
    98
  );
  const hitRoll = rng.next() * 100;
  const hit = hitRoll <= hitChance;
  log(`Hit Roll ${formatNumber(hitRoll)} vs ${formatNumber(hitChance)}% -> ${hit ? 'Hit' : 'Miss'}`);
  if (!hit) {
    return { hit: false, crit: false, damage: 0, defeated: false };
  }

  const defenderDef = combo.mod === 'Pierce'
    ? defender.config.stats.DEF * 0.6
    : defender.config.stats.DEF;
  let baseDamage = (attacker.config.stats.ATK / Math.max(1, defenderDef)) * power;
  if (attacker.chargeBonus) {
    baseDamage *= 1.25;
    attacker.chargeBonus = false;
    log('Charge bonus consumed (+25% power).');
  }

  const usedElement = combo.action === 'Wild' ? element : combo.element;
  const elementMult = elementMultiplier(usedElement, defender.lastElement);
  log(`Element multiplier: ${formatNumber(elementMult)}`);
  const scalar = modScalar(combo.mod);
  log(`Mod scalar: ${formatNumber(scalar)}`);

  const critChanceValue = clamp(critChance(attacker, combo.mod), 0, 100);
  const critRoll = rng.next() * 100;
  const critical = critRoll <= critChanceValue;
  log(`Crit chance ${formatNumber(critChanceValue)}% roll ${formatNumber(critRoll)}`);

  const critMult = critical ? critMultiplier(attacker) : 1;
  const betMult = attacker.betBoost;
  log(`Bet boost ${formatNumber(betMult)}x`);

  let finalDamage = baseDamage * elementMult * scalar * critMult * betMult;
  if (combo.mod === 'Miss?') {
    finalDamage *= 0.5;
  }
  finalDamage = Math.max(0, finalDamage);
  log(`Final damage before shields: ${formatNumber(finalDamage)}`);

  if (defender.shield > 0) {
    const absorbed = Math.min(defender.shield, finalDamage);
    defender.shield -= absorbed;
    finalDamage -= absorbed;
    log(`Shield absorbed ${formatNumber(absorbed)}.`);
  }

  defender.hp = Math.max(0, defender.hp - finalDamage);
  log(`Damage dealt to HP: ${formatNumber(finalDamage)} (HP now ${formatNumber(defender.hp)})`);

  if (combo.mod === 'Leech') {
    const heal = finalDamage * 0.3;
    attacker.hp = Math.min(attacker.config.stats.HP, attacker.hp + heal);
    log(`Leech healed ${formatNumber(heal)} HP.`);
  }

  if (combo.mod === 'Splash') {
    log('Splash echoes for 50% (log-only).');
  }

  return { hit: true, crit: critical, damage: finalDamage, defeated: defender.hp <= 0 };
}

export function resolveCombo(params: ResolveParams): void {
  const { attacker, defender, combo, log } = params;
  let workingElement = combo.element;
  if (combo.action === 'Wild') {
    workingElement = chooseWildElement(defender.lastElement);
    log(`Wild element optimizes to ${workingElement}.`);
  }
  attacker.lastElement = workingElement;

  const extraLogs: string[] = [];
  if (combo.mod === 'Shield+') {
    const chance = statusChance(attacker, defender);
    const roll = params.rng.next() * 100;
    log(`Shield+ status roll ${formatNumber(roll)} vs ${formatNumber(chance)}.`);
    if (roll <= chance) {
      const value = attacker.config.stats.HP * 0.15;
      applyShield(attacker, value);
      extraLogs.push(`Shield+ adds ${formatNumber(value)} shield.`);
    } else {
      extraLogs.push('Shield+ fizzles.');
    }
  }
  if (combo.mod === 'Cleanse') {
    const chance = statusChance(attacker, defender);
    const roll = params.rng.next() * 100;
    log(`Cleanse roll ${formatNumber(roll)} vs ${formatNumber(chance)}.`);
    if (roll <= chance) {
      attacker.dot = undefined;
      attacker.critMod = Math.max(0, attacker.critMod);
      extraLogs.push('Cleanse removes negative effects.');
    } else {
      extraLogs.push('Cleanse fails.');
    }
  }
  if (combo.mod === 'DoT') {
    const chance = statusChance(attacker, defender);
    const roll = params.rng.next() * 100;
    log(`DoT roll ${formatNumber(roll)} vs ${formatNumber(chance)}.`);
    if (roll <= chance) {
      const dotDamage = defender.config.stats.HP * 0.08 * 0.5;
      defender.dot = { ticksLeft: 2, damage: dotDamage };
      extraLogs.push(`DoT inflicts ${formatNumber(dotDamage)} over 2 rounds.`);
    } else {
      extraLogs.push('DoT fails to stick.');
    }
  }

  switch (combo.action) {
    case 'Guard': {
      const shieldValue = attacker.config.stats.HP * 0.1;
      applyShield(attacker, shieldValue);
      log(`Guard grants ${formatNumber(shieldValue)} shield.`);
      extraLogs.forEach((line) => log(line));
      return;
    }
    case 'Heal': {
      const healValue =
        (attacker.config.stats.ATK / Math.max(1, attacker.config.stats.DEF)) * attacker.betBoost;
      attacker.hp = Math.min(attacker.config.stats.HP, attacker.hp + healValue);
      log(`Heal restores ${formatNumber(healValue)} HP (HP now ${formatNumber(attacker.hp)}).`);
      extraLogs.forEach((line) => log(line));
      return;
    }
    case 'Charge': {
      attacker.chargeBonus = true;
      log('Charge readies +25% on next damaging action.');
      extraLogs.forEach((line) => log(line));
      return;
    }
    case 'StealTurn': {
      defender.skipNext = true;
      log('StealTurn triggers: defender skips their action this round.');
      extraLogs.forEach((line) => log(line));
      return;
    }
    case 'Hex': {
      const chance = statusChance(attacker, defender);
      const roll = params.rng.next() * 100;
      log(`Hex status roll ${formatNumber(roll)} vs ${formatNumber(chance)}.`);
      if (roll <= chance) {
        const dotDamage = defender.config.stats.HP * 0.08 * 0.5;
        defender.dot = { ticksLeft: 2, damage: dotDamage };
        log(`Hex inflicts DoT for ${formatNumber(dotDamage)} over 2 rounds.`);
      } else {
        log('Hex fails to take hold.');
      }
      extraLogs.forEach((line) => log(line));
      return;
    }
    default:
      break;
  }

  const power = combo.action === 'Double' ? 0.7 : 1;
  const elementUsed = combo.action === 'Wild' ? workingElement : combo.element;

  if (combo.action === 'Double') {
    let totalDamage = 0;
    for (let i = 0; i < 2; i += 1) {
      const outcome = resolveDamage(params, power, elementUsed);
      totalDamage += outcome.damage;
      if (!outcome.hit) {
        extraLogs.push(`Double hit ${i + 1} missed.`);
      }
      if (params.defender.hp <= 0) break;
    }
    extraLogs.push(`Double total damage ${formatNumber(totalDamage)}.`);
  } else {
    resolveDamage(params, power, elementUsed);
  }

  extraLogs.forEach((line) => log(line));
}

export function tickEndOfRound(player: CombatantState, ai: CombatantState, log: (text: string) => void): void {
  [
    { label: 'Player', target: player },
    { label: 'AI', target: ai }
  ].forEach(({ label, target }) => {
    if (target.dot && target.dot.ticksLeft > 0) {
      target.dot.ticksLeft -= 1;
      const damage = target.dot.damage;
      if (target.shield > 0) {
        const absorbed = Math.min(target.shield, damage);
        target.shield -= absorbed;
        const remainder = damage - absorbed;
        if (remainder > 0) {
          target.hp = Math.max(0, target.hp - remainder);
        }
        log(`${label} DoT tick ${formatNumber(damage)} (shield absorbed ${formatNumber(absorbed)}).`);
      } else {
        target.hp = Math.max(0, target.hp - damage);
        log(`${label} DoT tick ${formatNumber(damage)}.`);
      }
      if (target.dot.ticksLeft <= 0) {
        target.dot = undefined;
      }
    }
  });
}

export function resetRoundFlags(combatant: CombatantState): void {
  combatant.skipNext = false;
  combatant.betBoost = 1;
  combatant.critMod = 0;
  combatant.statusMod = 0;
  combatant.initiativeBoost = false;
}
