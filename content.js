const YT_RE = /https?:\/\/(?:www\.)?youtube\.com\/(?:@[\w.-]+|channel\/UC[\w-]+|c\/[\w.-]+|user\/[\w.-]+)/i;

const channel = () => location.pathname.split('/')[1]?.toLowerCase();
let frame = null;

// Top-nav button, placed right after Twitch's ⋮ menu.
const btn = document.createElement('button');
btn.textContent = '▶ YouTube';
btn.title = 'Swap to the streamer\'s YouTube live';
btn.style.cssText = 'align-self:center;margin-left:8px;padding:4px 10px;border:0;border-radius:4px;background:#f00;color:#fff;' +
  'font:600 13px Inter,Roobert,sans-serif;cursor:pointer;white-space:nowrap';
btn.onclick = () => toggle();
const label = () => btn.textContent = frame ? '■ Twitch' : '▶ YouTube';

function mountButton() {
  // Climb from the ⋮ button to its wrapper that sits directly in the nav's flex row.
  let anchor = document.querySelector('button[data-a-target="ellipsis-button"]');
  while (anchor?.parentElement && !(anchor.parentElement.children.length > 1 && getComputedStyle(anchor.parentElement).display.includes('flex')))
    anchor = anchor.parentElement;
  if (anchor && btn.previousElementSibling !== anchor) anchor.after(btn);
}

function restore() {
  frame?.remove();
  frame = null;
  label();
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

// auto: swapping because we remembered this channel, so stay quiet if it can't be done.
async function toggle(auto = false) {
  const ch = channel();
  if (frame) return chrome.storage.sync.remove('auto:' + ch), restore();
  const player = document.querySelector('.video-player__container') || document.querySelector('.video-player');
  if (!ch || !player) return auto || alert('No Twitch player on this page');

  const url = await ytUrl(ch);
  if (!url) return;
  const id = await chrome.runtime.sendMessage(url);
  if (!id) return auto || alert(`${ch} isn't live on YouTube right now (${url})`);
  if (frame || channel() !== ch) return; // a click or navigation happened while we were looking it up
  document.querySelector('video')?.pause();
  frame = document.createElement('iframe');
  frame.src = `https://www.youtube.com/embed/${id}?autoplay=1&t2y`;
  frame.allow = 'autoplay; fullscreen; picture-in-picture';
  frame.allowFullscreen = true;
  frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;z-index:1000;background:#000';
  player.appendChild(frame);
  label();
  chrome.storage.sync.set({ ['auto:' + ch]: true });
}

// Channels left on YouTube last time swap again when opened, once Twitch's player has rendered.
let pending = null;
async function checkAuto() {
  const ch = channel();
  pending = ch && (await chrome.storage.sync.get('auto:' + ch))['auto:' + ch] ? ch : null;
}

// Popup: 'state' asks whether we're swapped, 'toggle' swaps.
chrome.runtime.onMessage.addListener((msg, _, reply) => {
  if (msg === 'state') reply(!!frame);
  if (msg === 'toggle') toggle();
});

// Twitch is a SPA: drop the YouTube frame when navigating to another channel, and re-add the button if the nav re-renders.
let last = location.pathname;
mountButton();
checkAuto();
setInterval(() => {
  mountButton();
  if (location.pathname !== last) { last = location.pathname; restore(); checkAuto(); }
  if (pending && pending === channel() && !frame && document.querySelector('.video-player__container, .video-player')) {
    pending = null;
    toggle(true);
  }
}, 1000);
