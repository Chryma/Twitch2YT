// Runs inside our YouTube embed: hide the controls after HIDE_MS without mouse movement (YouTube waits ~3s+).
const HIDE_MS = 1000;

if (new URLSearchParams(location.search).has('t2y')) {
  document.documentElement.appendChild(document.createElement('style')).textContent =
    'html.t2y-idle :is(ytm-custom-control,.ytp-chrome-bottom,.ytp-chrome-top,.ytp-gradient-bottom,.ytp-gradient-top)' +
    '{opacity:0!important;transition:opacity .2s}html.t2y-idle *{cursor:none!important}';
  const root = document.documentElement;
  let timer;
  const wake = () => {
    root.classList.remove('t2y-idle');
    clearTimeout(timer);
    timer = setTimeout(() => { if (!document.querySelector('video')?.paused) root.classList.add('t2y-idle'); }, HIDE_MS);
  };
  addEventListener('mousemove', wake, true);
  addEventListener('mousedown', wake, true);
  addEventListener('pause', wake, true);
}
