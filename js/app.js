// Application bootstrap for Coup Board Game
import { GameEngine } from './engine/GameEngine.js';
import { UIController } from './ui/UIController.js';
import { sound } from './audio/SoundFX.js';

window.addEventListener('DOMContentLoaded', () => {
  // Unlock Web Audio on first user click anywhere
  const unlockAudio = () => {
    sound.init();
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  };
  document.addEventListener('click', unlockAudio);
  document.addEventListener('keydown', unlockAudio);

  // Initialize Game and UI
  const engine = new GameEngine();
  const ui = new UIController(engine);

  // Expose to window for debugging or manual testing if needed
  window.coupEngine = engine;
  window.coupUI = ui;

  // Start initial 4-player game (Human vs 3 AI personalities)
  engine.startNewGame({
    playerCount: 4,
    humanName: 'You',
    speed: 1000
  });
});
