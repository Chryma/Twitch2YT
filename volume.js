// Runs inside our YouTube embed at document_start (page world, for the player API).
// The embed autoplays at 100% until YouTube or Enhancer for YouTube applies a saved level a moment later.
// content.js passes your last Twitch2YT volume in the URL (?vol=); until you touch the player nothing can go
// louder than that, and once you do, whatever you set is sent back up to be saved.
const q = new URLSearchParams(location.search);
if (q.has('t2y')) {
  const saved = +(q.get('vol') ?? 10);
  let touched = false;
  for (const t of ['wheel', 'mousedown', 'keydown']) addEventListener(t, () => { touched = true; }, true);

  // Clamp at the element itself: an event handler runs a few ms after the volume changed, long enough to hear.
  const vol = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
  Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
    ...vol, set(v) { vol.set.call(this, touched ? v : Math.min(v, saved / 100)); },
  });

  for (const t of ['loadstart', 'play', 'volumechange']) addEventListener(t, e => {
    if (!(e.target instanceof HTMLMediaElement)) return;
    const p = document.getElementById('movie_player');
    if (touched) { if (t === 'volumechange' && p?.getVolume) parent.postMessage({ t2yVol: p.getVolume() }, 'https://www.twitch.tv'); return; }
    e.target.volume = e.target.volume; // a new <video> starts at 1.0 without going through the setter
    if (p?.setVolume && p.getVolume() !== saved) p.setVolume(saved); // keep the player's own slider in step
  }, true);
}
