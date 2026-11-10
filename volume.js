// Runs inside our YouTube embed at document_start (page world, for the player API).
// Autoplay starts at 100% until YouTube (or another extension) restores the saved level a moment later.
// Hold the last volume from the very first frame; once you touch the player, whatever you set is saved.
if (new URLSearchParams(location.search).has('t2y')) {
  const KEY = 't2y-vol';
  let saved = localStorage.getItem(KEY);
  if (saved === null) try { saved = JSON.parse(JSON.parse(localStorage.getItem('yt-player-volume')).data).volume; } catch {}
  saved = saved == null ? null : +saved;
  let touched = false;
  for (const t of ['wheel', 'mousedown', 'keydown']) addEventListener(t, () => { touched = true; }, true);
  for (const t of ['loadstart', 'play', 'volumechange']) addEventListener(t, e => {
    if (!(e.target instanceof HTMLMediaElement)) return;
    const p = document.getElementById('movie_player');
    if (touched) { if (t === 'volumechange' && p?.getVolume) localStorage.setItem(KEY, p.getVolume()); return; }
    if (saved === null) return;
    if (p?.setVolume) { if (p.getVolume() !== saved) p.setVolume(saved); } // the API applies loudness normalisation
    else if (Math.abs(e.target.volume - saved / 100) > 0.005) e.target.volume = saved / 100;
  }, true);
}
