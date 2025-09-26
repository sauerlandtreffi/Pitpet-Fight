import { CONFIG } from './config';
import { GameState } from './state';
import { GameSnapshot } from './types';
import { describeCombo, formatNumber } from './utils';

export class GameUI {
  private root: HTMLElement;
  private lockMode = false;
  private elements: Record<string, HTMLElement> = {};

  constructor(container: HTMLElement, private game: GameState) {
    this.root = document.createElement('div');
    this.root.className = 'app-shell';
    container.appendChild(this.root);
    this.renderSkeleton();
    this.bindEvents();
    this.game.subscribe((snapshot) => this.update(snapshot));
  }

  private renderSkeleton(): void {
    this.root.innerHTML = `
      <header>
        <div class="coin-display">💰 Coins: <span data-id="coins">0</span></div>
        <div class="bet-selector" data-id="bet-selector"></div>
        <div class="seed-controls">
          <label>Seed <input type="number" data-id="seed-input" /></label>
          <button data-id="set-seed">Set Seed</button>
        </div>
        <div class="header-actions">
          <button data-id="spin">Spin (S)</button>
          <button data-id="restart">Restart Match (R)</button>
          <button data-id="reset-config">Reset Config</button>
        </div>
      </header>
      <main class="main-grid">
        <section class="slot-section">
          <div class="slot-grid" data-id="slot-grid"></div>
          <div class="slot-controls">
            <button class="secondary" data-id="lock-toggle">Lock Mode (L)</button>
            <button class="secondary" data-id="reel-a">Re-Spin A (Q)</button>
            <button class="secondary" data-id="reel-b">Re-Spin B (W)</button>
            <button class="secondary" data-id="reel-c">Re-Spin C (E)</button>
          </div>
          <div class="combo-buttons" data-id="combo-buttons"></div>
        </section>
        <section class="pit-section">
          <div class="pit-card" data-id="player-card"></div>
          <div class="pit-card" data-id="ai-card"></div>
        </section>
      </main>
      <section class="log-panel">
        <h3>Battle Log</h3>
        <div class="log-entries" data-id="log-entries"></div>
      </section>
      <footer>
        <span>Keyboard: S Spin · 1/2/3 Choose Row · L Lock Mode · Q/W/E Respins · H Hit · T Stand · R Restart</span>
        <span>Round <span data-id="round">1</span> · Phase <span data-id="phase">Idle</span></span>
      </footer>
      <div data-id="modal-host"></div>
    `;

    this.elements.coins = this.root.querySelector('[data-id="coins"]') as HTMLElement;
    this.elements.betSelector = this.root.querySelector('[data-id="bet-selector"]') as HTMLElement;
    this.elements.spin = this.root.querySelector('[data-id="spin"]') as HTMLElement;
    this.elements.restart = this.root.querySelector('[data-id="restart"]') as HTMLElement;
    this.elements.resetConfig = this.root.querySelector('[data-id="reset-config"]') as HTMLElement;
    this.elements.slotGrid = this.root.querySelector('[data-id="slot-grid"]') as HTMLElement;
    this.elements.comboButtons = this.root.querySelector('[data-id="combo-buttons"]') as HTMLElement;
    this.elements.playerCard = this.root.querySelector('[data-id="player-card"]') as HTMLElement;
    this.elements.aiCard = this.root.querySelector('[data-id="ai-card"]') as HTMLElement;
    this.elements.logEntries = this.root.querySelector('[data-id="log-entries"]') as HTMLElement;
    this.elements.round = this.root.querySelector('[data-id="round"]') as HTMLElement;
    this.elements.phase = this.root.querySelector('[data-id="phase"]') as HTMLElement;
    this.elements.modalHost = this.root.querySelector('[data-id="modal-host"]') as HTMLElement;
    this.elements.seedInput = this.root.querySelector('[data-id="seed-input"]') as HTMLElement;
    this.elements.setSeed = this.root.querySelector('[data-id="set-seed"]') as HTMLElement;
    this.elements.lockToggle = this.root.querySelector('[data-id="lock-toggle"]') as HTMLElement;
    this.elements.reelA = this.root.querySelector('[data-id="reel-a"]') as HTMLElement;
    this.elements.reelB = this.root.querySelector('[data-id="reel-b"]') as HTMLElement;
    this.elements.reelC = this.root.querySelector('[data-id="reel-c"]') as HTMLElement;
  }

  private bindEvents(): void {
    this.elements.spin.addEventListener('click', () => this.game.spin());
    this.elements.restart.addEventListener('click', () => this.game.restartMatch());
    this.elements.resetConfig.addEventListener('click', () => this.game.resetConfig());
    this.elements.lockToggle.addEventListener('click', () => this.toggleLockMode());
    this.elements.reelA.addEventListener('click', () => this.game.respin('action'));
    this.elements.reelB.addEventListener('click', () => this.game.respin('element'));
    this.elements.reelC.addEventListener('click', () => this.game.respin('mod'));
    (this.elements.setSeed as HTMLButtonElement).addEventListener('click', () => {
      const input = this.elements.seedInput as HTMLInputElement;
      const seed = Number(input.value || Date.now());
      this.game.setSeed(seed);
    });
    window.addEventListener('keydown', (event) => this.handleKey(event));
  }

  private handleKey(event: KeyboardEvent): void {
    switch (event.key.toLowerCase()) {
      case 's':
        this.game.spin();
        break;
      case '1':
      case '2':
      case '3':
        this.game.chooseRow(Number(event.key) - 1);
        break;
      case 'l':
        this.toggleLockMode();
        break;
      case 'q':
        this.game.respin('action');
        break;
      case 'w':
        this.game.respin('element');
        break;
      case 'e':
        this.game.respin('mod');
        break;
      case 'h':
        this.game.petJackHit();
        break;
      case 't':
        this.game.petJackStand();
        break;
      case 'r':
        this.game.restartMatch();
        break;
      default:
        break;
    }
  }

  private toggleLockMode(): void {
    this.lockMode = !this.lockMode;
    this.elements.lockToggle.classList.toggle('active', this.lockMode);
    this.elements.lockToggle.textContent = this.lockMode ? 'Lock Mode: ON (L)' : 'Lock Mode (L)';
  }

  private update(snapshot: GameSnapshot): void {
    this.elements.coins.textContent = snapshot.coins.toString();
    this.elements.round.textContent = snapshot.round.toString();
    this.elements.phase.textContent = snapshot.phase;
    (this.elements.spin as HTMLButtonElement).disabled = !snapshot.canSpin;
    this.renderBetSelector(snapshot);
    this.renderSlotGrid(snapshot);
    this.renderComboButtons(snapshot);
    this.renderCombatant(snapshot.player, this.elements.playerCard, 'Player');
    this.renderCombatant(snapshot.ai, this.elements.aiCard, 'AI');
    this.renderLogs(snapshot);
    this.renderPetJack(snapshot);
    (this.elements.seedInput as HTMLInputElement).value = this.game.currentSeed().toString();
    this.updateRespins(snapshot);
  }

  private updateRespins(snapshot: GameSnapshot): void {
    const disabled = snapshot.phase !== 'Spun';
    (this.elements.reelA as HTMLButtonElement).disabled = disabled || !snapshot.canRespins.action;
    (this.elements.reelB as HTMLButtonElement).disabled = disabled || !snapshot.canRespins.element;
    (this.elements.reelC as HTMLButtonElement).disabled = disabled || !snapshot.canRespins.mod;
  }

  private renderBetSelector(snapshot: GameSnapshot): void {
    const container = this.elements.betSelector;
    container.innerHTML = '';
    for (const bet of CONFIG.betTiers) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'bet';
      input.value = String(bet);
      if (bet === snapshot.bet) input.checked = true;
      input.disabled = snapshot.phase !== 'Idle';
      input.addEventListener('change', () => this.game.setBet(bet));
      label.appendChild(input);
      label.appendChild(document.createTextNode(`${bet}`));
      container.appendChild(label);
    }
  }

  private renderSlotGrid(snapshot: GameSnapshot): void {
    const grid = this.elements.slotGrid;
    grid.innerHTML = '';
    const outcome = snapshot.playerGrid;
    if (!outcome) {
      for (let i = 0; i < 9; i += 1) {
        const cell = document.createElement('div');
        cell.className = 'slot-cell';
        cell.innerHTML = '<span class="slot-symbol">--</span>';
        grid.appendChild(cell);
      }
      return;
    }
    const { actions, elements, mods, lockedCell } = outcome.grid;
    for (let row = 0; row < 3; row += 1) {
      const actionCell = this.buildSlotCell(actions[row], 'symbol-action', row, 0, lockedCell);
      const elementCell = this.buildSlotCell(elements[row], 'symbol-element', row, 1, lockedCell);
      const modCell = this.buildSlotCell(mods[row], 'symbol-mod', row, 2, lockedCell);
      grid.append(actionCell, elementCell, modCell);
    }
  }

  private buildSlotCell(
    value: string,
    className: string,
    row: number,
    column: number,
    lockedCell?: { row: number; column: number }
  ): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'slot-cell';
    if (lockedCell && lockedCell.row === row && lockedCell.column === column) {
      cell.classList.add('locked');
    }
    const span = document.createElement('span');
    span.className = `slot-symbol ${className}`;
    span.textContent = value;
    cell.appendChild(span);
    cell.addEventListener('click', () => {
      if (this.lockMode) {
        this.game.lockCell(row, column);
        this.lockMode = false;
        this.elements.lockToggle.classList.remove('active');
        this.elements.lockToggle.textContent = 'Lock Mode (L)';
      }
    });
    return cell;
  }

  private renderComboButtons(snapshot: GameSnapshot): void {
    const container = this.elements.comboButtons;
    container.innerHTML = '';
    if (!snapshot.playerGrid || snapshot.phase !== 'Spun') {
      return;
    }
    snapshot.playerGrid.combos.forEach((combo, index) => {
      const btn = document.createElement('button');
      btn.textContent = `Choose Row ${index + 1} (${describeCombo(
        combo.action,
        combo.element,
        combo.mod
      )})`;
      btn.addEventListener('click', () => this.game.chooseRow(index));
      container.appendChild(btn);
    });
  }

  private renderCombatant(combatant: GameSnapshot['player'], target: HTMLElement, label: string): void {
    const stats = combatant.config.stats;
    const hpPercent = (combatant.hp / stats.HP) * 100;
    const buffs: string[] = [];
    if (combatant.shield > 0) buffs.push(`Shield ${formatNumber(combatant.shield)}`);
    if (combatant.chargeBonus) buffs.push('Charged');
    if (combatant.initiativeBoost) buffs.push('Initiative');
    if (combatant.dot) buffs.push(`DoT ${formatNumber(combatant.dot.damage)} (${combatant.dot.ticksLeft})`);
    if (combatant.critMod > 0) buffs.push(`Crit+${combatant.critMod}`);
    if (combatant.critMod < 0) buffs.push(`Crit${combatant.critMod}`);
    if (combatant.statusMod !== 0) buffs.push(`Status${combatant.statusMod > 0 ? '+' : ''}${combatant.statusMod}`);
    target.innerHTML = `
      <div class="pit-header">
        <h2>${label}: ${combatant.config.name}</h2>
        <span>HP ${formatNumber(combatant.hp)} / ${stats.HP}</span>
      </div>
      <div class="hp-bar"><div class="hp-bar-inner" style="width:${Math.max(0, hpPercent)}%"></div></div>
      <div>Shield: ${formatNumber(combatant.shield)}</div>
      <div class="stats-grid">
        <span>ATK ${stats.ATK}</span>
        <span>DEF ${stats.DEF}</span>
        <span>SPD ${stats.SPD}</span>
        <span>LUK ${stats.LUK}</span>
        <span>WIS ${stats.WIS}</span>
        <span>Lv ${stats.Level}</span>
      </div>
      <div class="buff-tags">${buffs
        .map((buff) => `<span class="buff-tag">${buff}</span>`)
        .join('')}</div>
    `;
  }

  private renderLogs(snapshot: GameSnapshot): void {
    const logContainer = this.elements.logEntries;
    logContainer.innerHTML = snapshot.logs
      .map((entry) => `<p><strong>R${entry.round}:</strong> ${entry.text}</p>`)
      .join('');
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  private renderPetJack(snapshot: GameSnapshot): void {
    const host = this.elements.modalHost;
    host.innerHTML = '';
    const pet = snapshot.petJack;
    if (!pet) return;
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    const content = document.createElement('div');
    content.className = 'modal';
    content.innerHTML = `
      <h3>PetJack 🎴</h3>
      <div>Player Hand (${pet.playerHand.reduce((a, b) => a + b, 0)}):</div>
      <div class="card-row">${pet.playerHand
        .map((card) => `<div class="card">${card}</div>`)
        .join('')}</div>
      <div>Dealer Showing (${pet.dealerHand[0]} + ?)</div>
      <div class="card-row">${pet.dealerHand
        .map((card, index) => `<div class="card">${index === 0 || pet.stage !== 'playerTurn' ? card : '?'}</div>`)
        .join('')}</div>
    `;
    const actions = document.createElement('div');
    actions.className = 'buff-choice';

    if (pet.stage === 'playerTurn') {
      const hit = document.createElement('button');
      hit.textContent = 'Hit (H)';
      hit.addEventListener('click', () => this.game.petJackHit());
      const stand = document.createElement('button');
      stand.textContent = 'Stand (T)';
      stand.addEventListener('click', () => this.game.petJackStand());
      actions.append(hit, stand);
    } else if (pet.stage === 'dealerTurn') {
      const stand = document.createElement('button');
      stand.textContent = 'Resolve';
      stand.addEventListener('click', () => {
        this.game.petJackStand();
      });
      actions.append(stand);
    } else if (pet.stage === 'result') {
      const resolve = document.createElement('button');
      resolve.textContent = 'Continue';
      resolve.addEventListener('click', () => {
        this.game.petJackStand();
      });
      actions.append(resolve);
    } else if (pet.stage === 'buff' && pet.outcome === 'player') {
      const buffs: Array<{ label: string; key: 'initiative' | 'crit' | 'status' }> = [
        { label: 'Initiative', key: 'initiative' },
        { label: '+15% Crit', key: 'crit' },
        { label: '+10% Status', key: 'status' }
      ];
      buffs.forEach((buff) => {
        const btn = document.createElement('button');
        btn.textContent = buff.label;
        btn.addEventListener('click', () => this.game.applyPetJackBuff(buff.key));
        actions.appendChild(btn);
      });
    }

    if (pet.outcome) {
      const result = document.createElement('div');
      result.textContent = `Outcome: ${pet.outcome}`;
      content.appendChild(result);
    }

    content.appendChild(actions);
    modal.appendChild(content);
    host.appendChild(modal);
  }
}
