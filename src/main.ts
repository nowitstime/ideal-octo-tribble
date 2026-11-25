import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { engine } from './audio/engine';
import { mapScreen } from './screens/map';
import { drumsScreen } from './screens/drums';
import { chordsScreen } from './screens/chords';
import { progressionScreen } from './screens/progression';
import { bassScreen } from './screens/bass';
import { leadScreen } from './screens/lead';

registerSW({ immediate: true });

const root = document.getElementById('app')!;
let cleanup: (() => void) | null = null;

// Audio may only start from a user gesture: create it on the very first touch.
window.addEventListener('pointerdown', () => engine.ensure(), { capture: true });
document.addEventListener('contextmenu', (e) => e.preventDefault());

function route() {
  cleanup?.();
  root.replaceChildren();
  const path = location.hash.replace(/^#\/?/, '');
  switch (path) {
    case 'drums': cleanup = drumsScreen(root, 'play'); break;
    case 'drums/set': cleanup = drumsScreen(root, 'set'); break;
    case 'chords': cleanup = chordsScreen(root, 'play'); break;
    case 'chords/set': cleanup = chordsScreen(root, 'set'); break;
    case 'bass': cleanup = bassScreen(root, 'play'); break;
    case 'bass/set': cleanup = bassScreen(root, 'set'); break;
    case 'lead': cleanup = leadScreen(root, 'play'); break;
    case 'lead/set': cleanup = leadScreen(root, 'set'); break;
    case 'progression': cleanup = progressionScreen(root); break;
    default: cleanup = mapScreen(root);
  }
}

window.addEventListener('hashchange', route);
route();
