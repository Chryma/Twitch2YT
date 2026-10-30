const YT_RE = /^https?:\/\/(?:www\.)?youtube\.com\/(?:@[\w.-]+|channel\/UC[\w-]+|c\/[\w.-]+|user\/[\w.-]+)/i;
const $ = id => document.getElementById(id);
const tw = $('tw'), yt = $('yt'), list = $('list');

async function render() {
  const all = await chrome.storage.sync.get(null);
  const rows = Object.keys(all).filter(k => k.startsWith('yt:')).sort().map(k => {
    const ch = k.slice(3), row = document.createElement('div');
    row.className = 'row';
    const name = document.createElement('span');
    name.title = 'Edit';
    name.style.cursor = 'pointer';
    name.onclick = () => { tw.value = ch; yt.value = all[k]; yt.focus(); };
    const link = document.createElement('a');
    link.href = all[k];
    link.target = '_blank';
    link.textContent = all[k].replace(/^https?:\/\/(www\.)?youtube\.com\//, '');
    name.append(ch + ' → ', link);
    const x = document.createElement('button');
    x.textContent = '✕';
    x.title = 'Remove';
    x.onclick = () => chrome.storage.sync.remove(k, render);
    row.append(name, x);
    return row;
  });
  list.replaceChildren(...rows);
  if (!rows.length) list.innerHTML = '<span class="empty">No saved channels yet.</span>';
}

$('add').onsubmit = async e => {
  e.preventDefault();
  const v = yt.value.trim();
  const url = v.startsWith('@') ? 'https://www.youtube.com/' + v : v;
  if (!YT_RE.test(url)) return yt.setCustomValidity('Not a YouTube channel URL'), yt.reportValidity();
  await chrome.storage.sync.set({ ['yt:' + tw.value.trim().toLowerCase()]: url });
  tw.value = yt.value = '';
  render();
};
yt.oninput = () => yt.setCustomValidity('');

chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
  const ch = tab?.url?.match(/^https:\/\/www\.twitch\.tv\/(\w+)/)?.[1]?.toLowerCase();
  if (!ch) return;
  $('swapCard').hidden = false;
  $('sub').textContent = 'On twitch.tv/' + ch;
  const saved = (await chrome.storage.sync.get('yt:' + ch))['yt:' + ch];
  if (!saved) tw.value = ch;
  $('swap').onclick = () => chrome.tabs.sendMessage(tab.id, 'toggle').then(() => window.close(), () => alert('Reload the Twitch tab first'));
});

render();
