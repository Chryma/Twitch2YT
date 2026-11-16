// Resolves a YouTube or Kick channel URL to an embed URL for its current live stream (null if offline).
chrome.runtime.onMessage.addListener((url, _, reply) => {
  const kick = url.match(/kick\.com\/([\w-]+)/i)?.[1];
  (kick
    ? fetch('https://kick.com/api/v2/channels/' + kick)
      .then(r => r.json())
      .then(j => j.livestream && `https://player.kick.com/${kick}?autoplay=true`)
    : fetch(url.replace(/\/+$/, '') + '/live')
      .then(r => r.text())
      .then(html => {
        const m = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/);
        return m && `https://www.youtube.com/embed/${m[1]}?autoplay=1`;
      }))
    .then(src => reply(src || null), () => reply(null));
  return true;
});
