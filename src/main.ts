import './styles.css';
import { GameState } from './game/state';
import { GameUI } from './game/ui';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Missing #app container');
}

const state = new GameState();
new GameUI(container, state);
