import { RNG } from './rng';
import { ReelOption } from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function weightedPick<T extends string>(options: ReelOption<T>[], rng: RNG): T {
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let roll = rng.next() * total;
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) {
      return option.label;
    }
  }
  return options[options.length - 1]?.label ?? options[0].label;
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}

export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

export function handValue(cards: number[]): number {
  return sum(cards);
}

export function describeCombo(action: string, element: string, mod: string): string {
  return `${action} | ${element} | ${mod}`;
}
