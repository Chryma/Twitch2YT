const YT_RE = /https?:\/\/(?:www\.)?youtube\.com\/(?:@[\w.-]+|channel\/UC[\w-]+|c\/[\w.-]+|user\/[\w.-]+)/i;

const channel = () => location.pathname.split('/')[1]?.toLowerCase();
let frame = null;

function restore() {
  frame?.remove();
  frame = null;
  document.querySelector('video')?.play();
}

async function ytUrl(ch) {
  const key = 'yt:' + ch;
  const saved = (await chrome.storage.sync.get(key))[key];
  if (saved) return saved;
  const found = [...document.querySelectorAll('a[href*="youtube.com/"]')].map(a => a.href.match(YT_RE)?.[0]).find(Boolean);
  const input = prompt(`YouTube channel for ${ch} (URL or @handle):`, found || '');
  if (!input) return null;
  const url = input.startsWith('@') ? 'https://www.youtube.com/' + input : input.trim();
  if (!YT_RE.test(url)) return alert('Not a YouTube channel URL'), null;
  await chrome.storage.sync.set({ [key]: url });
  return url;
}

async function toggle() {
  if (frame) return restore();
  const ch = channel();
  const player = document.querySelector('.video-player__container') || document.querySelector('.video-player');
  if (!ch || !player) return alert('No Twitch player on this page');

  const url = await ytUrl(ch);
  if (!url) return;
  const id = await chrome.runtime.sendMessage(url);
  if (!id) return alert(`${ch} isn't live on YouTube right now (${url})`);
  document.querySelector('video')?.pause();
  frame = document.createElement('iframe');
  frame.src = `https://www.youtube.com/embed/${id}?autoplay=1&t2y`;
  frame.allow = 'autoplay; fullscreen; picture-in-picture';
  frame.allowFullscreen = true;
  frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;z-index:1000;background:#000';
  player.appendChild(frame);
}

// Popup: 'state' asks whether we're swapped, 'toggle' swaps.
chrome.runtime.onMessage.addListener((msg, _, reply) => {
  if (msg === 'state') reply(!!frame);
  if (msg === 'toggle') toggle();
});

// Twitch is a SPA: drop the YouTube frame when navigating to another channel.
let last = location.pathname;
setInterval(() => { if (location.pathname !== last) { last = location.pathname; restore(); } }, 1000);
