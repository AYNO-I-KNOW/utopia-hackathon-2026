const EVENT = "result-playback-start";

/** Tell every other player on the result screen to stop. */
export function claimPlayback(owner: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: owner }));
}

/** Call `onOther` when a different owner claims playback; returns the unsubscribe. */
export function onOtherPlayback(owner: string, onOther: () => void) {
  const listener = (event: Event) => {
    if ((event as CustomEvent<string>).detail !== owner) onOther();
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
