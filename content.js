const YT_RE = /https?:\/\/(?:www\.)?youtube\.com\/(?:@[\w.-]+|channel\/UC[\w-]+|c\/[\w.-]+|user\/[\w.-]+)/i;

const btn = document.createElement('button');
btn.textContent = '▶ YouTube';
btn.title = 'Swap to YouTube stream (Shift+click to change channel)';
btn.style.cssText = 'position:fixed;top:60px;right:20px;z-index:99999;padding:6px 12px;border:0;border-radius:6px;' +
  'background:#f00;color:#fff;font:600 13px sans-serif;cursor:pointer;opacity:.85';
document.body.appendChild(btn);

const channel = () => location.pathname.split('/')[1]?.toLowerCase();
let frame = null;

function restore() {
  frame?.remove();
  frame = null;
  btn.textContent = '▶ YouTube';
  document.querySelector('video')?.play();
}

async function ytUrl(ch, force) {
  const key = 'yt:' + ch;
  const saved = (await chrome.storage.sync.get(key))[key];
  if (saved && !force) return saved;
  const found = [...document.querySelectorAll('a[href*="youtube.com/"]')].map(a => a.href.match(YT_RE)?.[0]).find(Boolean);
  const input = prompt(`YouTube channel for ${ch} (URL or @handle):`, saved || found || '');
  if (!input) return null;
  const url = input.startsWith('@') ? 'https://www.youtube.com/' + input : input.trim();
  if (!YT_RE.test(url)) return alert('Not a YouTube channel URL'), null;
  await chrome.storage.sync.set({ [key]: url });
  return url;
}

btn.onclick = async e => {
  if (frame && !e.shiftKey) return restore();
  const ch = channel();
  const player = document.querySelector('.video-player__container') || document.querySelector('.video-player');
  if (!ch || !player) return alert('No Twitch player on this page');

  const url = await ytUrl(ch, e.shiftKey);
  if (!url) return;
  btn.textContent = '…';
  const id = await chrome.runtime.sendMessage(url);
  if (!id) {
    btn.textContent = '▶ YouTube';
    return alert(`${ch} isn't live on YouTube right now (${url})`);
  }
  restore();
  document.querySelector('video')?.pause();
  frame = document.createElement('iframe');
  frame.src = `https://www.youtube.com/embed/${id}?autoplay=1`;
  frame.allow = 'autoplay; fullscreen; picture-in-picture';
  frame.allowFullscreen = true;
  frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;z-index:1000;background:#000';
  player.appendChild(frame);
  btn.textContent = '■ Twitch';
};

// Twitch is a SPA: drop the YouTube frame when navigating to another channel.
let last = location.pathname;
setInterval(() => { if (location.pathname !== last) { last = location.pathname; restore(); } }, 1000);

// Popup's "Swap this stream" button.
chrome.runtime.onMessage.addListener(msg => { if (msg === 'toggle') btn.click(); });
