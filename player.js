// Runs inside the YouTube watch page we frame on Twitch (page world, so it can call the player API):
// strip the page down to just the player, hide the controls after HIDE_MS without mouse movement
// (YouTube waits ~3s+), and force the best quality.
const HIDE_MS = 1000;

if (window.top !== window && new URLSearchParams(location.search).has('t2y')) {
  document.documentElement.appendChild(document.createElement('style')).textContent = `
    html, body { overflow: hidden !important; background: #000 !important; }
    #masthead-container, tp-yt-app-drawer, ytd-mini-guide-renderer { display: none !important; }
    #movie_player { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 9999 !important; }
    html.t2y-idle :is(.ytp-chrome-bottom, .ytp-chrome-top, .ytp-gradient-bottom, .ytp-gradient-top) { opacity: 0 !important; transition: opacity .2s; }
    html.t2y-idle * { cursor: none !important; }`;

  // The player sizes its video from its own box; nudge it once our CSS has moved it.
  let applied;
  setInterval(() => {
    const p = document.getElementById('movie_player');
    if (!p) return;
    if (p.dataset.t2ySized !== innerWidth + 'x' + innerHeight) { p.dataset.t2ySized = innerWidth + 'x' + innerHeight; dispatchEvent(new Event('resize')); }
    // Auto quality can settle low; apply the best once per new best level, so a quality picked by hand sticks.
    const best = p.getAvailableQualityLevels?.()[0];
    if (best && best !== 'auto' && best !== applied) { p.setPlaybackQualityRange(best, best); applied = best; }
  }, 1000);

  const root = document.documentElement;
  let timer;
  const wake = () => {
    root.classList.remove('t2y-idle');
    clearTimeout(timer);
    timer = setTimeout(() => { if (!document.querySelector('video')?.paused) root.classList.add('t2y-idle'); }, HIDE_MS);
  };
  addEventListener('mousemove', wake, true);
  addEventListener('mousedown', wake, true);
  addEventListener('pause', wake, true);
}
