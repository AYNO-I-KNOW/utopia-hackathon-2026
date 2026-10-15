// "Listen to advice" button: fetch TTS once per result, cache the blob, play/pause.
import { speak } from './api.js';
import { t } from './i18n.js';

const player = new Audio();
let objectUrl = null;
let token = 0;

export const pauseSpeech = () => player.pause();

// Call when leaving the result screen: stops audio and revokes the object URL.
export function releaseSpeech() {
  token += 1;
  player.pause();
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    player.removeAttribute('src');
    player.load();
  }
}

// result.speech caches { blob, autoplayed }; blob === null means "no audio available".
export function mountSpeech(button, result, lang, onFail) {
  releaseSpeech();
  const mine = token;
  const text = result.data.summary;
  if (!text) {
    button.remove();
    return;
  }
  const cache = (result.speech ??= { blob: undefined, autoplayed: false });
  const setLabel = (key) => { button.textContent = t(key); };
  const notify = (message) => { if (mine === token) onFail(message); }; // never after leaving the screen
  player.onplay = () => setLabel('r_pause');
  player.onpause = () => setLabel('r_listen');
  player.onended = () => setLabel('r_listen');

  // Returns true when audio is ready to play.
  async function load(silent) {
    button.disabled = true;
    setLabel('r_preparing');
    if (cache.blob === undefined) {
      try {
        cache.blob = await speak(text, lang);
      } catch (err) {
        if (!silent) notify(err.message);
      }
    }
    if (mine !== token) return false;
    button.disabled = false;
    setLabel('r_listen');
    if (cache.blob === null) button.remove();
    if (!cache.blob) return false;
    objectUrl = URL.createObjectURL(cache.blob);
    player.src = objectUrl;
    return true;
  }

  button.addEventListener('click', () => {
    if (!objectUrl) {
      // play() after an await would fall outside the tap gesture: ask for another tap instead
      load(false).then((ready) => { if (ready) notify(t('r_tap_again')); });
      return;
    }
    if (!player.paused) {
      player.pause();
      return;
    }
    player.play().catch((err) => { if (err?.name !== 'AbortError') notify(t('err_audio')); });
  });

  load(true).then((ready) => {
    if (!ready || cache.autoplayed) return;
    cache.autoplayed = true;
    player.play().catch(() => {}); // browsers may block autoplay; the button still works
  });
}
