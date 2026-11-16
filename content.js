const YT_RE = /https?:\/\/(?:www\.)?youtube\.com\/(?:@[\w.-]+|channel\/UC[\w-]+|c\/[\w.-]+|user\/[\w.-]+)/i;
const KICK_RE = /https?:\/\/(?:www\.)?kick\.com\/[\w-]+/i;

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
const KICK_ICON = icon([
  ['M3 0h18a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3z', '#53fc18'],
  ['M6 4h4v5h2V7h2V4h4v5h-2v2h-2v2h2v2h2v5h-4v-3h-2v-2h-2v5H6z', '#000'],
]);

// Matches Twitch's own secondary buttons (their CSS vars, with fallbacks if they rename them).
document.documentElement.appendChild(document.createElement('style')).textContent = `
.t2y-btn{align-self:center;display:flex;align-items:center;gap:6px;height:30px;margin-left:8px;padding:0 10px;border:0;border-radius:4px;
  background:var(--color-background-button-secondary-default,#53535f61);color:var(--color-text-button-secondary,#efeff1);
  font:600 13px Inter,Roobert,sans-serif;cursor:pointer;white-space:nowrap;transition:background .1s}
.t2y-btn:hover{background:var(--color-background-button-secondary-hover,#53535f7a)}
.t2y-btn svg{width:20px;height:20px;flex:none}
.t2y-offer{position:fixed;top:58px;right:16px;z-index:5000;display:flex;align-items:center;gap:4px;padding:8px 8px 8px 12px;border-radius:6px;
  background:var(--color-background-base,#18181b);color:var(--color-text-base,#efeff1);box-shadow:0 4px 16px #0009;font:13px Inter,Roobert,sans-serif}.t2y-offer .t2y-btn{margin-left:4px}`;

const btn = document.createElement('button');
btn.className = 't2y-btn';
btn.onclick = () => toggle();
const btnText = document.createElement('span');
let prefKick = false; // this channel's first saved choice is Kick, so the button says Kick
const label = () => {
  const kick = !frame && prefKick;
  btn.replaceChildren(frame ? TW_ICON : kick ? KICK_ICON : YT_ICON, btnText);
  btnText.textContent = frame ? 'Switch to Twitch' : kick ? 'Switch to Kick' : 'Switch to YouTube';
  btn.title = frame ? 'Back to the Twitch stream' : 'Swap to the streamer\'s YouTube or Kick live';
};
label();

function mountButton() {
  // Climb from the ⋮ button to its wrapper that sits directly in the nav's flex row.
  let anchor = document.querySelector('button[data-a-target="ellipsis-button"]');
  while (anchor?.parentElement && !(anchor.parentElement.children.length > 1 && getComputedStyle(anchor.parentElement).display.includes('flex')))
    anchor = anchor.parentElement;
  if (anchor && btn.previousElementSibling !== anchor) anchor.after(btn);
}

// "<name> is live on YouTube" toast, shown by suggest().
const offer = document.createElement('div');
offer.className = 't2y-offer';

function restore() {
  offer.remove();
  frame?.remove();
  frame = null;
  label();
  document.querySelector('video')?.play();
}

// Saved YouTube/Kick URLs for ch, the one it was last left on first. auto is that URL (true, from before Kick, means YouTube).
async function saved(ch) {
  const s = await chrome.storage.sync.get(['yt:' + ch, 'kick:' + ch, 'auto:' + ch]);
  const auto = s['auto:' + ch];
  return { auto, urls: [s['yt:' + ch], s['kick:' + ch]].filter(Boolean).sort((a, b) => (b === auto) - (a === auto)) };
}

// Nothing saved for ch yet: ask, pre-filled from a link on the page or the same name on YouTube.
async function addUrl(ch) {
  const found = [...document.querySelectorAll('a[href*="youtube.com/"],a[href*="kick.com/"]')]
    .map(a => a.href.match(YT_RE)?.[0] || a.href.match(KICK_RE)?.[0]).find(Boolean);
  const input = prompt(`YouTube or Kick channel for ${ch} (YouTube URL or @handle, or kick.com/name):`, found || '@' + ch)?.trim();
  if (!input) return null;
  const url = input.startsWith('@') ? 'https://www.youtube.com/' + input : /^(www\.)?kick\.com\//i.test(input) ? 'https://' + input : input;
  const key = KICK_RE.test(url) ? 'kick:' : YT_RE.test(url) ? 'yt:' : null;
  if (!key) return alert('Not a YouTube or Kick channel URL'), null;
  await chrome.storage.sync.set({ [key + ch]: url });
  return url;
}

const findPlayer = () => document.querySelector('.video-player__container') || document.querySelector('.video-player');

// The first of ch's saved channels that's live, as [url, embed src], or [] if none is.
// auto: swapping because we remembered this channel, so never prompt and stay quiet if it isn't live.
async function liveSrc(ch, auto) {
  let { urls } = await saved(ch);
  if (!urls.length && !auto) urls = [await addUrl(ch)].filter(Boolean);
  const srcs = await Promise.all(urls.map(u => chrome.runtime.sendMessage(u)));
  const i = srcs.findIndex(Boolean);
  if (i < 0 && urls.length && !auto) alert(`${ch} isn't live right now on ${urls.join(' or ')}`);
  return i < 0 ? [] : [urls[i], srcs[i]];
}

// Last YouTube volume, kept here because Brave wipes the embed's own storage when the tab closes (see volume.js).
let ytVol;
chrome.storage.local.get('vol').then(r => { ytVol = r.vol; });
addEventListener('message', e => {
  if (!/^https:\/\/(www\.youtube|player\.kick)\.com$/.test(e.origin) || e.source !== frame?.contentWindow || !Number.isInteger(e.data?.t2yVol)) return;
  if (e.data.t2yVol !== ytVol && chrome.runtime?.id) chrome.storage.local.set({ vol: ytVol = e.data.t2yVol });
});

function show(player, src) {
  offer.remove();
  document.querySelector('video')?.pause();
  frame = document.createElement('iframe');
  frame.src = `${src}&t2y${ytVol != null ? '&vol=' + ytVol : ''}`;
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
  const [url, src] = await liveSrc(ch);
  if (!src || frame || channel() !== ch) return; // a click or navigation happened while we were looking it up
  prefKick = KICK_RE.test(url);
  show(findPlayer(), src);
  chrome.storage.sync.set({ ['auto:' + ch]: url });
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
  if (!ch) return;
  const { urls, auto } = await saved(ch);
  if (channel() !== ch) return;
  prefKick = KICK_RE.test(urls[0]);
  label();
  if (!auto) return suggest(ch, urls.length);
  document.documentElement.appendChild(hold);
  document.querySelector('video')?.pause(); // Twitch may already be playing this channel; hold only hides it
  const [, src] = await liveSrc(ch, true);
  let player;
  while (src && !frame && channel() === ch && !(player = findPlayer())) await new Promise(r => setTimeout(r, 100));
  hold.remove();
  if (player && !frame && channel() === ch) show(player, src);
  else if (!frame) document.querySelector('video')?.play();
}

// First visit to a channel with nothing saved: check once whether youtube.com/@<same name> or kick.com/<same name>
// is live, and offer it. Each channel is only ever checked once, live or not; after that it's the button or the popup.
// Kept in local storage, not sync: sync caps at 512 keys and this grows with every channel you open.
async function suggest(ch, hasSaved) {
  if (hasSaved) return;
  // Wait for a Twitch player, so /directory, /search and other non-channel pages never get checked.
  for (let i = 0; i < 100 && channel() === ch && !findPlayer(); i++) await new Promise(r => setTimeout(r, 100));
  if (channel() !== ch || !findPlayer()) return;
  const k = 'chk:' + ch;
  if ((await chrome.storage.local.get(k))[k]) return;
  await chrome.storage.local.set({ [k]: 1 });
  const urls = ['https://www.youtube.com/@' + ch, 'https://kick.com/' + ch];
  const srcs = await Promise.all(urls.map(u => chrome.runtime.sendMessage(u)));
  if (!srcs.some(Boolean) || frame || channel() !== ch) return;
  // Watching either one saves every live one, so the button can fall back to the other later.
  const found = {};
  const buttons = urls.flatMap((url, i) => {
    if (!srcs[i]) return [];
    found[(i ? 'kick:' : 'yt:') + ch] = url;
    const b = document.createElement('button');
    b.className = 't2y-btn';
    b.title = url;
    b.append((i ? KICK_ICON : YT_ICON).cloneNode(true), i ? 'Kick' : 'YouTube');
    b.onclick = async () => {
      const player = findPlayer();
      if (!alive() || !player || channel() !== ch) return offer.remove();
      await chrome.storage.sync.set({ ...found, ['auto:' + ch]: url });
      prefKick = !!i;
      show(player, srcs[i]);
    };
    return [b];
  });
  const close = document.createElement('button');
  close.className = 't2y-btn';
  close.textContent = '✕';
  close.title = 'Not this one (it won\'t ask again)';
  close.onclick = () => offer.remove();
  offer.replaceChildren(ch + ' is live on', ...buttons, close);
  document.body.appendChild(offer);
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
