import { Runner } from './resources/dino_game/offline.js';

window.addEventListener('load', () => {
  const trexGameContainer = document.querySelector('.trex-game');
  const configContainer = document.querySelector('.config-box');
  const spirit1xFileInput = document.getElementById('sprite-1x');
  const spirit2xFileInput = document.getElementById('sprite-2x');

  // Clear the spirit file input value on load
  spirit1xFileInput.value = '';
  spirit2xFileInput.value = '';

  let runner = new Runner(trexGameContainer);

  //   On keypress 'F' enable Arcade mode
  document.addEventListener('keydown', event => {
    if (event.key === 'f') {
      runner.setArcadeMode();

      // hide advance configs
      configContainer.style.display = 'none';
    }
  });

  // Handle sprite file selection and update assets
  spirit1xFileInput.addEventListener('change', event => {
    const file = event.target.files[0];
    if (file) {
      const imgUrl = URL.createObjectURL(file);
      document.getElementById('offline-resources-1x').src = imgUrl;

      // Destroy the existing instance and initialize game new a new spirit file
      runner.destroy();
      runner = new Runner(trexGameContainer);
    }
  });

  spirit2xFileInput.addEventListener('change', event => {
    const file = event.target.files[0];
    if (file) {
      const imgUrl = URL.createObjectURL(file);
      document.getElementById('offline-resources-2x').src = imgUrl;

      // Destroy the existing instance and initialize game new a new spirit file
      runner.destroy();
      runner = new Runner(trexGameContainer);
    }
  });
});
