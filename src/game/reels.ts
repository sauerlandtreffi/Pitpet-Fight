import { CONFIG } from './config';
import { RNG } from './rng';
import { ComboRow, ModType, SlotGrid, SpinOutcome } from './types';
import { weightedPick } from './utils';

function boostModsForBet(bet: number): { label: ModType; weight: number }[] {
  if (bet < 50) {
    return CONFIG.reelC;
  }
  return CONFIG.reelC.map((entry) =>
    CONFIG.reelCBoostMods.includes(entry.label)
      ? { ...entry, weight: entry.weight * 2 }
      : entry
  );
}

export function initialGrid(): SlotGrid {
  return {
    actions: ['Strike', 'Strike', 'Strike'],
    elements: ['Flame', 'Aqua', 'Terra'],
    mods: ['x1', 'x1', 'x1'],
    lockedCell: undefined,
    lockUsed: false,
    respinUsed: false
  };
}

function spinColumn<T extends string>(
  options: { label: T; weight: number }[],
  rng: RNG
): T[] {
  return Array.from({ length: 3 }, () => weightedPick(options, rng));
}

export function spinForge(rng: RNG, bet: number, previous?: SlotGrid): SpinOutcome {
  const grid: SlotGrid = previous
    ? {
        actions: [...previous.actions],
        elements: [...previous.elements],
        mods: [...previous.mods],
        lockedCell: previous.lockedCell,
        lockUsed: previous.lockUsed,
        respinUsed: previous.respinUsed
      }
    : initialGrid();

  const modWeights = boostModsForBet(bet);

  const newActions = spinColumn(CONFIG.reelA, rng);
  const newElements = spinColumn(CONFIG.reelB, rng);
  const newMods = spinColumn(modWeights, rng);

  const locked = previous?.lockedCell;
  for (let i = 0; i < 3; i += 1) {
    if (!locked || locked.column !== 0 || locked.row !== i) {
      grid.actions[i] = newActions[i];
    }
    if (!locked || locked.column !== 1 || locked.row !== i) {
      grid.elements[i] = newElements[i];
    }
    if (!locked || locked.column !== 2 || locked.row !== i) {
      grid.mods[i] = newMods[i];
    }
  }

  return {
    grid,
    combos: buildCombos(grid)
  };
}

export function respinColumn(
  column: 'action' | 'element' | 'mod',
  rng: RNG,
  bet: number,
  current: SlotGrid
): SpinOutcome {
  const modWeights = boostModsForBet(bet);
  const grid: SlotGrid = {
    actions: [...current.actions],
    elements: [...current.elements],
    mods: [...current.mods],
    lockedCell: current.lockedCell,
    lockUsed: current.lockUsed,
    respinUsed: true
  };

  const targetColumn = column === 'action' ? 0 : column === 'element' ? 1 : 2;

  let results: string[];
  if (column === 'action') {
    results = spinColumn(CONFIG.reelA, rng);
  } else if (column === 'element') {
    results = spinColumn(CONFIG.reelB, rng);
  } else {
    results = spinColumn(modWeights, rng);
  }

  for (let i = 0; i < 3; i += 1) {
    if (grid.lockedCell && grid.lockedCell.column === targetColumn && grid.lockedCell.row === i) {
      continue;
    }
    if (targetColumn === 0) grid.actions[i] = results[i] as typeof grid.actions[number];
    if (targetColumn === 1) grid.elements[i] = results[i] as typeof grid.elements[number];
    if (targetColumn === 2) grid.mods[i] = results[i] as typeof grid.mods[number];
  }

  return {
    grid,
    combos: buildCombos(grid)
  };
}

export function buildCombos(grid: SlotGrid): ComboRow[] {
  const rows: ComboRow[] = [];
  for (let row = 0; row < 3; row += 1) {
    rows.push({
      action: grid.actions[row],
      element: grid.elements[row],
      mod: grid.mods[row]
    });
  }
  return rows;
}
