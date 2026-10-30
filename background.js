// Resolves a YouTube channel URL to its current live video id (null if offline).
chrome.runtime.onMessage.addListener((url, _, reply) => {
  fetch(url.replace(/\/+$/, '') + '/live')
    .then(r => r.text())
    .then(html => {
      const m = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/);
      reply(m ? m[1] : null);
    })
    .catch(() => reply(null));
  return true;
});
