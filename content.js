const YT_RE = /https?:\/\/(?:www\.)?youtube\.com\/(?:@[\w.-]+|channel\/UC[\w-]+|c\/[\w.-]+|user\/[\w.-]+)/i;

// Only a channel's own page (/name) is its live stream; /name/clip/..., /name/videos etc. stay on Twitch.
const channel = () => /^\/[^/]+\/?$/.test(location.pathname) ? location.pathname.split('/')[1].toLowerCase() : null;
let frame = null;

// Top-nav button, placed right after Twitch's ⋮ menu.
// Built with createElementNS, not innerHTML, in case Twitch enforces Trusted Types.
const NS = 'http://www.w3.org/2000/svg';
const icon = paths => {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  for (const [d, fill] of paths) {
    const p = s.appendChild(document.createElementNS(NS, 'path'));
    p.setAttribute('d', d);
    p.setAttribute('fill', fill);
  }
  return s;
};
const YT_ICON = icon([
  ['M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8z', '#f00'],
  ['M9.6 15.6 15.8 12 9.6 8.4z', '#fff'],
]);
const TW_ICON = icon([
  ['M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z', '#9146ff'],
]);

// Matches Twitch's own secondary buttons (their CSS vars, with fallbacks if they rename them).
document.documentElement.appendChild(document.createElement('style')).textContent = `
.t2y-btn{align-self:center;display:flex;align-items:center;gap:6px;height:30px;margin-left:8px;padding:0 10px;border:0;border-radius:4px;
  background:var(--color-background-button-secondary-default,#53535f61);color:var(--color-text-button-secondary,#efeff1);
  font:600 13px Inter,Roobert,sans-serif;cursor:pointer;white-space:nowrap;transition:background .1s}
.t2y-btn:hover{background:var(--color-background-button-secondary-hover,#53535f7a)}
.t2y-btn svg{width:20px;height:20px;flex:none}`;

const btn = document.createElement('button');
btn.className = 't2y-btn';
btn.onclick = () => toggle();
const btnText = document.createElement('span');
const label = () => {
  btn.replaceChildren(frame ? TW_ICON : YT_ICON, btnText);
  btnText.textContent = frame ? 'Switch to Twitch' : 'Switch to YouTube';
  btn.title = frame ? 'Back to the Twitch stream' : 'Swap to the streamer\'s YouTube live';
};
label();

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

// Last YouTube volume, kept here because Brave wipes the embed's own storage when the tab closes (see volume.js).
let ytVol;
chrome.storage.local.get('vol').then(r => { ytVol = r.vol; });
addEventListener('message', e => {
  if (e.origin !== 'https://www.youtube.com' || e.source !== frame?.contentWindow || !Number.isInteger(e.data?.t2yVol)) return;
  if (e.data.t2yVol !== ytVol && chrome.runtime?.id) chrome.storage.local.set({ vol: ytVol = e.data.t2yVol });
});

function show(player, id) {
  document.querySelector('video')?.pause();
  frame = document.createElement('iframe');
  frame.src = `https://www.youtube.com/embed/${id}?autoplay=1&t2y${ytVol != null ? '&vol=' + ytVol : ''}`;
  frame.allow = 'autoplay; fullscreen; picture-in-picture';
  frame.allowFullscreen = true;
  frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;z-index:1000;background:#000';
  player.appendChild(frame);
  label();
}

// After the extension reloads, this copy in an already-open tab is cut off (chrome.* calls fail silently);
// reloading the page brings in the new copy.
const alive = () => chrome.runtime?.id || location.reload();

async function toggle() {
  if (!alive()) return;
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
// Twitch treats those interrupted plays as blocked autoplay and falls back to muted, which then carries over
// to the next channel (same player, SPA nav). Undo that once Twitch plays again, unless you muted it yourself.
let interrupted = false;
addEventListener('play', e => { onNav(); if (hold.isConnected || frame) e.target.pause(), interrupted = true; }, true);
addEventListener('playing', e => {
  if (!interrupted || frame || hold.isConnected || !e.target.muted) return;
  try { if (JSON.parse(localStorage.getItem('video-muted')).default) return; } catch {}
  interrupted = false;
  document.querySelector('button[data-a-target="player-mute-unmute-button"]')?.click(); // Twitch's own button keeps its UI in sync
}, true);

async function checkAuto() {
  if (!alive()) return;
  const ch = channel();
  if (!ch || !(await chrome.storage.sync.get('auto:' + ch))['auto:' + ch]) return;
  document.documentElement.appendChild(hold);
  document.querySelector('video')?.pause(); // Twitch may already be playing this channel; hold only hides it
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

// Category pages default to "Recommended For You"; force highest viewers unless a sort was picked.
const unsorted = u => /^\/directory\/(category|game)\//.test(u.pathname) && !u.search.includes('sort=');
// Direct loads: we run before Twitch boots, so rewriting the URL is enough. Later navs are caught by the click hook; reload is the fallback.
function sortByViewers(boot) {
  if (!unsorted(location)) return;
  const url = location.pathname + '?sort=VIEWER_COUNT';
  boot ? history.replaceState(history.state, '', url) : location.replace(url);
}
// In-app category links: send Twitch's router to the sorted URL instead (it re-renders on popstate).
document.addEventListener('click', e => {
  const a = e.target.closest?.('a[href]');
  if (!a || e.button || e.ctrlKey || e.metaKey || e.shiftKey || !unsorted(new URL(a.href))) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  history.pushState(null, '', new URL(a.href).pathname + '?sort=VIEWER_COUNT');
  dispatchEvent(new PopStateEvent('popstate', { state: null }));
}, true);

// Twitch is a SPA: drop the YouTube frame when navigating to another channel, and re-add the button if the nav re-renders.
let last = location.pathname;
sortByViewers(true);
mountButton();
checkAuto();
// Also run from the play listener: Twitch starts the new channel before the 1s tick would notice the nav.
function onNav() {
  if (location.pathname === last) return;
  last = location.pathname; sortByViewers(); restore(); checkAuto();
}
setInterval(() => { mountButton(); onNav(); }, 1000);
