// Runs inside our YouTube embed (page world, so it can call the player API):
// hide the controls after HIDE_MS without mouse movement (YouTube waits ~3s+), and force the best quality.
const HIDE_MS = 1000;

if (new URLSearchParams(location.search).has('t2y')) {
  // Embed "auto" quality settles on 720p even when 1080p is available and the player is big enough.
  // Apply once per new best level, so a quality picked by hand afterwards sticks.
  let applied;
  setInterval(() => {
    const p = document.getElementById('movie_player');
    const best = p?.getAvailableQualityLevels?.()[0];
    if (best && best !== 'auto' && best !== applied) { p.setPlaybackQualityRange(best, best); applied = best; }
  }, 2000);

  document.documentElement.appendChild(document.createElement('style')).textContent =
    'html.t2y-idle :is(ytm-custom-control,.ytp-chrome-bottom,.ytp-chrome-top,.ytp-gradient-bottom,.ytp-gradient-top)' +
    '{opacity:0!important;transition:opacity .2s}html.t2y-idle *{cursor:none!important}';
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
  root.addEventListener('mouseleave', () => { clearTimeout(timer); root.classList.add('t2y-idle'); });

  // Pause then play on a live stream jumps back to live. Seeking (while playing or paused) keeps the
  // chosen spot, so scrubbing back still works.
  let toLive = false;
  addEventListener('pause', () => { toLive = true; }, true);
  addEventListener('seeked', () => { toLive = false; }, true);
  addEventListener('playing', () => { // not 'play': YouTube ignores a seek that early
    const p = document.getElementById('movie_player');
    if (!toLive || !p?.getVideoData?.().isLive) return;
    toLive = false;
    p.seekTo(p.getDuration(), true);
  }, true);

  // Scroll over the player to change volume, like the Twitch scroll-volume extension (it can't see into our frame).
  const osd = document.createElement('div');
  osd.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
    'padding:6px 14px;border-radius:6px;background:rgba(0,0,0,.7);color:#fff;font:600 18px sans-serif;' +
    'pointer-events:none;opacity:0;transition:opacity .3s';
  let osdTimer;
  addEventListener('wheel', e => {
    const p = document.getElementById('movie_player');
    if (!p?.setVolume) return;
    e.preventDefault();
    const vol = Math.max(0, Math.min(100, p.getVolume() + (e.deltaY < 0 ? 5 : -5)));
    p.unMute();
    p.setVolume(vol);
    if (!osd.isConnected) document.body.appendChild(osd);
    osd.textContent = `Volume ${vol}%`;
    osd.style.opacity = 1;
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => { osd.style.opacity = 0; }, 1000);
    wake();
  }, { capture: true, passive: false });
}
