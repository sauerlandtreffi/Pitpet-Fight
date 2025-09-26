import { CONFIG } from './config';
import { aiChooseRow, aiConsiderRespins, aiSpin } from './ai';
import { resolveCombo, tickEndOfRound } from './combat';
import { createPetJack, drawUntil, playDealer, playerHit, playerStand } from './petjack';
import { respinColumn, spinForge } from './reels';
import { RNG } from './rng';
import {
  ComboRow,
  CombatantState,
  GamePhase,
  GameSnapshot,
  PetJackState,
  Side,
  SpinOutcome
} from './types';
import { describeCombo } from './utils';

interface Listener {
  (snapshot: GameSnapshot): void;
}

interface InternalState {
  phase: GamePhase;
  coins: number;
  bet: number;
  round: number;
  player: CombatantState;
  ai: CombatantState;
  playerSpin?: SpinOutcome;
  aiSpin?: SpinOutcome;
  playerRow?: number;
  aiRow?: number;
  logs: { text: string; round: number }[];
  petJack?: PetJackState;
  totalBets: number;
  seed: number;
}

export class GameState {
  private state: InternalState;
  private listeners: Listener[] = [];
  private rng: RNG;

  constructor(private config = CONFIG) {
    const seed = Date.now();
    this.rng = new RNG(seed);
    this.state = {
      phase: 'Idle',
      coins: config.startingCoins,
      bet: config.betTiers[0],
      round: 1,
      player: this.createCombatant('player'),
      ai: this.createCombatant('ai'),
      logs: [],
      totalBets: 0,
      seed
    };
    this.emit();
  }

  private createCombatant(side: Side): CombatantState {
    const pitpet = this.config.pitpets[side];
    return {
      config: pitpet,
      hp: pitpet.stats.HP,
      shield: 0,
      dot: undefined,
      chargeBonus: false,
      critMod: 0,
      statusMod: 0,
      initiativeBoost: false,
      skipNext: false,
      betBoost: 1,
      lastElement: undefined
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    listener(this.snapshot());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(): void {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  snapshot(): GameSnapshot {
    const { playerSpin: playerGrid, aiSpin: aiGrid } = this.state;
    const canRespins = {
      action: Boolean(playerGrid && !playerGrid.grid.respinUsed && !playerGrid.grid.lockUsed),
      element: Boolean(playerGrid && !playerGrid.grid.respinUsed && !playerGrid.grid.lockUsed),
      mod: Boolean(playerGrid && !playerGrid.grid.respinUsed && !playerGrid.grid.lockUsed)
    };
    return {
      phase: this.state.phase,
      coins: this.state.coins,
      bet: this.state.bet,
      round: this.state.round,
      player: this.state.player,
      ai: this.state.ai,
      playerGrid: playerGrid,
      aiGrid: aiGrid,
      logs: this.state.logs.slice(-120),
      petJack: this.state.petJack,
      canSpin: this.canSpin(),
      canRespins
    };
  }

  setSeed(seed: number): void {
    if (!Number.isFinite(seed)) return;
    this.rng.setSeed(seed);
    this.state.seed = seed;
    this.log(`Seed set to ${seed}`, this.state.round);
    this.emit();
  }

  currentSeed(): number {
    return this.state.seed;
  }

  setBet(bet: number): void {
    if (!this.config.betTiers.includes(bet)) return;
    this.state.bet = bet;
    this.emit();
  }

  private canSpin(): boolean {
    return this.state.phase === 'Idle' && this.state.coins >= this.state.bet;
  }

  spin(): void {
    if (!this.canSpin()) {
      this.log('Spin unavailable: check phase or coins.', this.state.round);
      this.emit();
      return;
    }
    const bet = this.state.bet;
    this.state.coins -= bet;
    this.state.totalBets += bet;
    this.state.player.betBoost = this.config.betBoost[bet];
    this.state.ai.betBoost = this.config.betBoost[bet];
    this.state.player.critMod = 0;
    this.state.player.statusMod = 0;
    this.state.player.initiativeBoost = false;
    this.state.ai.critMod = 0;
    this.state.ai.statusMod = 0;
    this.state.ai.initiativeBoost = false;
    this.state.playerSpin = spinForge(this.rng, bet);
    const aiSpinInitial = aiSpin(this.rng, bet);
    const aiOptimized = aiConsiderRespins(aiSpinInitial, this.rng, bet, this.state.ai, this.state.player);
    if (aiOptimized.grid !== aiSpinInitial.grid) {
      aiOptimized.grid.respinUsed = true;
    }
    this.state.aiSpin = aiOptimized;
    this.state.aiRow = aiChooseRow(aiOptimized, this.state.ai, this.state.player);
    this.state.playerRow = undefined;
    this.state.phase = 'Spun';
    this.log(`Round ${this.state.round}: reels spun.`, this.state.round);
    this.emit();
  }

  lockCell(row: number, column: number): void {
    if (this.state.phase !== 'Spun' || !this.state.playerSpin) return;
    const grid = this.state.playerSpin.grid;
    if (grid.respinUsed) return;
    if (grid.lockUsed && grid.lockedCell && grid.lockedCell.row === row && grid.lockedCell.column === column) {
      grid.lockedCell = undefined;
      this.emit();
      return;
    }
    if (grid.lockUsed) return;
    grid.lockedCell = { row, column };
    grid.lockUsed = true;
    this.log(`Locked cell (${row + 1}, ${column + 1}).`, this.state.round);
    this.emit();
  }

  respin(column: 'action' | 'element' | 'mod'): void {
    if (this.state.phase !== 'Spun' || !this.state.playerSpin) return;
    const grid = this.state.playerSpin.grid;
    if (grid.lockUsed || grid.respinUsed) {
      this.log('Respins unavailable (lock used or already respun).', this.state.round);
      this.emit();
      return;
    }
    const cost = Math.floor(0.2 * this.state.bet);
    if (this.state.coins < cost) {
      this.log('Not enough coins to respin.', this.state.round);
      this.emit();
      return;
    }
    this.state.coins -= cost;
    const result = respinColumn(column, this.rng, this.state.bet, grid);
    this.state.playerSpin = result;
    this.log(`Respins reel ${column.toUpperCase()} for ${cost} coins.`, this.state.round);
    this.emit();
  }

  chooseRow(index: number): void {
    if (this.state.phase !== 'Spun' || !this.state.playerSpin) return;
    if (index < 0 || index > 2) return;
    this.state.playerRow = index;
    const combo = this.state.playerSpin.combos[index];
    this.log(`Player selects ${describeCombo(combo.action, combo.element, combo.mod)}.`, this.state.round);
    if (combo.mod === '🎴 Card-Ticket') {
      this.state.petJack = createPetJack(this.rng);
      this.state.phase = 'PetJack';
    } else {
      this.state.phase = 'ResolveTurn';
      this.resolveRound();
    }
    this.emit();
  }

  petJackHit(): void {
    if (!this.state.petJack) return;
    playerHit(this.state.petJack, this.rng);
    this.emit();
  }

  petJackStand(): void {
    if (!this.state.petJack) return;
    const stage = this.state.petJack.stage;
    if (stage === 'playerTurn') {
      playerStand(this.state.petJack);
      playDealer(this.state.petJack, this.rng);
      this.handlePetJackOutcome();
    } else if (stage === 'dealerTurn') {
      playDealer(this.state.petJack, this.rng);
      this.handlePetJackOutcome();
    } else if (stage === 'result') {
      this.handlePetJackOutcome();
    }
    this.emit();
  }

  private handlePetJackOutcome(): void {
    const pet = this.state.petJack;
    if (!pet || !pet.outcome) return;
    if (pet.outcome === 'dealer') {
      this.state.player.critMod -= 5;
      this.log('PetJack loss: -5% crit this round.', this.state.round);
      this.state.phase = 'ResolveTurn';
      this.resolveRound();
      return;
    }
    if (pet.outcome === 'push') {
      this.log('PetJack push: no effect.', this.state.round);
      this.state.phase = 'ResolveTurn';
      this.resolveRound();
      return;
    }
    // Player win -> wait for buff selection handled by UI.
  }

  applyPetJackBuff(buff: 'initiative' | 'crit' | 'status'): void {
    if (!this.state.petJack || this.state.petJack.outcome !== 'player') return;
    switch (buff) {
      case 'initiative':
        this.state.player.initiativeBoost = true;
        this.log('PetJack buff: Initiative secured.', this.state.round);
        break;
      case 'crit':
        this.state.player.critMod += 15;
        this.log('PetJack buff: +15% Crit this round.', this.state.round);
        break;
      case 'status':
        this.state.player.statusMod += 10;
        this.log('PetJack buff: +10 Status chance this round.', this.state.round);
        break;
    }
    this.state.phase = 'ResolveTurn';
    this.resolveRound();
    this.emit();
  }

  private resolveRound(): void {
    if (this.state.playerRow === undefined || !this.state.playerSpin || !this.state.aiSpin) return;
    this.state.petJack = undefined;
    const playerCombo = this.state.playerSpin.combos[this.state.playerRow];
    const aiCombo = this.state.aiSpin.combos[this.state.aiRow ?? 0];
    this.log(
      `AI selects ${describeCombo(aiCombo.action, aiCombo.element, aiCombo.mod)}.`,
      this.state.round
    );
    // AI PetJack if needed
    if (aiCombo.mod === '🎴 Card-Ticket') {
      const aiPet = createPetJack(this.rng);
      aiPet.playerHand = drawUntil(aiPet.playerHand, 17, this.rng);
      aiPet.stage = 'dealerTurn';
      playDealer(aiPet, this.rng);
      if (aiPet.outcome === 'player') {
        this.state.ai.initiativeBoost = true;
        this.log('AI wins PetJack: gains Initiative buff.', this.state.round);
      } else if (aiPet.outcome === 'dealer') {
        this.state.ai.critMod -= 5;
        this.log('AI loses PetJack: -5% crit.', this.state.round);
      }
    }

    this.state.phase = 'ResolveTurn';
    const order = this.determineOrder(playerCombo, aiCombo);
    for (const turn of order) {
      const attacker = turn === 'player' ? this.state.player : this.state.ai;
      const defender = turn === 'player' ? this.state.ai : this.state.player;
      const combo = turn === 'player' ? playerCombo : aiCombo;
      if (attacker.hp <= 0 || defender.hp <= 0) {
        continue;
      }
      if (attacker.skipNext) {
        this.log(`${attacker.config.name} skips their action.`, this.state.round);
        attacker.skipNext = false;
        continue;
      }
      this.log(
        `${attacker.config.name} executes ${describeCombo(combo.action, combo.element, combo.mod)}.`,
        this.state.round
      );
      resolveCombo(
        {
          attacker,
          defender,
          combo,
          attackerSide: turn,
          defenderSide: turn === 'player' ? 'ai' : 'player',
          rng: this.rng,
          log: (message: string) => this.log(message, this.state.round),
          round: this.state.round
        }
      );
      if (defender.hp <= 0) {
        this.log(`${defender.config.name} is defeated!`, this.state.round);
        break;
      }
    }

    tickEndOfRound(this.state.player, this.state.ai, (message: string) =>
      this.log(message, this.state.round)
    );
    this.state.phase = 'EndRound';
    this.checkMatchEnd();
    this.emit();
  }

  private determineOrder(playerCombo: ComboRow, aiCombo: ComboRow): Side[] {
    if (this.state.player.initiativeBoost && !this.state.ai.initiativeBoost) {
      return ['player', 'ai'];
    }
    if (this.state.ai.initiativeBoost && !this.state.player.initiativeBoost) {
      return ['ai', 'player'];
    }
    const playerSpeed = this.state.player.config.stats.SPD;
    const aiSpeed = this.state.ai.config.stats.SPD;
    if (playerSpeed === aiSpeed) {
      return ['player', 'ai'];
    }
    return playerSpeed > aiSpeed ? ['player', 'ai'] : ['ai', 'player'];
  }

  private checkMatchEnd(): void {
    const playerDead = this.state.player.hp <= 0;
    const aiDead = this.state.ai.hp <= 0;
    if (playerDead && aiDead) {
      this.log('Both pitpets fall! Match draws.', this.state.round);
      this.finishMatch('draw');
      return;
    }
    if (aiDead) {
      this.log('Player wins the duel!', this.state.round);
      this.finishMatch('player');
      return;
    }
    if (playerDead) {
      this.log('Aqualin wins the duel.', this.state.round);
      this.finishMatch('ai');
      return;
    }

    if (this.state.round >= this.config.maxRounds) {
      const winner = this.state.player.hp >= this.state.ai.hp ? 'player' : 'ai';
      this.log(`Max rounds reached. Winner: ${winner === 'player' ? 'Player' : 'AI'}.`, this.state.round);
      this.finishMatch(winner);
      return;
    }

    this.state.round += 1;
    this.state.player.skipNext = false;
    this.state.ai.skipNext = false;
    this.state.playerSpin = undefined;
    this.state.aiSpin = undefined;
    this.state.petJack = undefined;
    this.state.phase = 'Idle';
  }

  private finishMatch(winner: Side | 'draw'): void {
    if (winner === 'player') {
      this.state.coins += this.state.bet * 2;
    } else if (winner === 'ai') {
      this.state.coins += Math.floor(this.state.totalBets * 0.1);
    }
    this.state.phase = 'Finished';
  }

  restartMatch(): void {
    this.state.player = this.createCombatant('player');
    this.state.ai = this.createCombatant('ai');
    this.state.round = 1;
    this.state.playerSpin = undefined;
    this.state.aiSpin = undefined;
    this.state.petJack = undefined;
    this.state.playerRow = undefined;
    this.state.aiRow = undefined;
    this.state.logs.push({ text: '--- Match restarted ---', round: 0 });
    this.state.phase = 'Idle';
    this.emit();
  }

  resetConfig(): void {
    this.config = CONFIG;
    this.restartMatch();
    this.state.coins = CONFIG.startingCoins;
    this.state.totalBets = 0;
    this.log('Config reset to defaults.', this.state.round);
    this.emit();
  }

  private log(message: string, round: number): void {
    this.state.logs.push({ text: message, round });
  }
}
