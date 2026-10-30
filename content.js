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

const findPlayer = () => document.querySelector('.video-player__container') || document.querySelector('.video-player');

// auto: swapping because we remembered this channel, so never prompt and stay quiet if it isn't live.
async function liveId(ch, auto) {
  const url = auto ? (await chrome.storage.sync.get('yt:' + ch))['yt:' + ch] : await ytUrl(ch);
  if (!url) return null;
  const id = await chrome.runtime.sendMessage(url);
  if (!id && !auto) alert(`${ch} isn't live on YouTube right now (${url})`);
  return id;
}

function show(player, id) {
  document.querySelector('video')?.pause();
  frame = document.createElement('iframe');
  frame.src = `https://www.youtube.com/embed/${id}?autoplay=1&t2y`;
  frame.allow = 'autoplay; fullscreen; picture-in-picture';
  frame.allowFullscreen = true;
  frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;z-index:1000;background:#000';
  player.appendChild(frame);
  label();
}

async function toggle() {
  const ch = channel();
  if (frame) return chrome.storage.sync.remove('auto:' + ch), restore();
  if (!ch || !findPlayer()) return alert('No Twitch player on this page');
  const id = await liveId(ch);
  if (!id || frame || channel() !== ch) return; // a click or navigation happened while we were looking it up
  show(findPlayer(), id);
  chrome.storage.sync.set({ ['auto:' + ch]: true });
}

// Channels left on YouTube last time: look the stream up as the page starts loading, keep Twitch hidden
// and paused meanwhile, and drop YouTube in the moment Twitch's player exists.
const hold = document.createElement('style');
hold.textContent = '.video-player video{visibility:hidden}';
// Twitch never plays underneath the YouTube frame (it resumes itself after ads etc.).
addEventListener('play', e => { if (hold.isConnected || frame) e.target.pause(); }, true);

async function checkAuto() {
  const ch = channel();
  if (!ch || !(await chrome.storage.sync.get('auto:' + ch))['auto:' + ch]) return;
  document.documentElement.appendChild(hold);
  const id = await liveId(ch, true);
  let player;
  while (id && !frame && channel() === ch && !(player = findPlayer())) await new Promise(r => setTimeout(r, 100));
  hold.remove();
  if (player && !frame && channel() === ch) show(player, id);
  else if (!frame) document.querySelector('video')?.play();
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
}, 1000);
