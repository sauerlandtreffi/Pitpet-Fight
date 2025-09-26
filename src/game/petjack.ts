import { CONFIG } from './config';
import { RNG } from './rng';
import { PetJackState } from './types';
import { handValue } from './utils';

export function drawCard(rng: RNG): number {
  return CONFIG.petjack.deckValues[rng.nextInt(CONFIG.petjack.deckValues.length)];
}

export function createPetJack(rng: RNG): PetJackState {
  return {
    playerHand: [drawCard(rng), drawCard(rng)],
    dealerHand: [drawCard(rng), drawCard(rng)],
    stage: 'playerTurn'
  };
}

export function playerHit(state: PetJackState, rng: RNG): void {
  if (state.stage !== 'playerTurn') return;
  if (state.playerHand.length >= 3) return; // limit to one hit
  state.playerHand.push(drawCard(rng));
  const value = handValue(state.playerHand);
  if (value >= 21) {
    state.stage = 'dealerTurn';
  }
}

export function playerStand(state: PetJackState): void {
  if (state.stage !== 'playerTurn') return;
  state.stage = 'dealerTurn';
}

export function playDealer(state: PetJackState, rng: RNG): void {
  if (state.stage !== 'dealerTurn') return;
  while (handValue(state.dealerHand) < 17) {
    state.dealerHand.push(drawCard(rng));
  }
  state.stage = 'result';
  const playerTotal = handValue(state.playerHand);
  const dealerTotal = handValue(state.dealerHand);
  if (playerTotal > 21) {
    state.outcome = 'dealer';
  } else if (dealerTotal > 21) {
    state.outcome = 'player';
  } else if (playerTotal > dealerTotal) {
    state.outcome = 'player';
  } else if (playerTotal < dealerTotal) {
    state.outcome = 'dealer';
  } else {
    state.outcome = 'push';
  }
  if (state.outcome === 'player') {
    state.stage = 'buff';
  }
}

export function resetPetJack(state: PetJackState): void {
  state.stage = 'playerTurn';
  state.outcome = undefined;
  state.playerHand = [];
  state.dealerHand = [];
}

export function drawUntil(hand: number[], threshold: number, rng: RNG): number[] {
  const cards = [...hand];
  while (handValue(cards) < threshold) {
    cards.push(drawCard(rng));
  }
  return cards;
}
