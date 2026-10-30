chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  // Let YouTube load framed inside this Twitch tab. Scoped to the tab (not the initiator) because
  // YouTube or other extensions can reload the frame, and those loads come from youtube.com.
  if (msg === 'allowFrame') {
    const id = sender.tab.id;
    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [id],
      addRules: [{
        id, action: { type: 'modifyHeaders', responseHeaders: [
          { header: 'x-frame-options', operation: 'remove' },
          { header: 'content-security-policy', operation: 'remove' }] },
        condition: { requestDomains: ['www.youtube.com'], resourceTypes: ['sub_frame'], tabIds: [id] }
      }]
    }).then(() => reply(true));
    return true;
  }

  // Otherwise msg is a YouTube channel URL: resolve it to the current live video id (null if offline).
  fetch(msg.replace(/\/+$/, '') + '/live')
    .then(r => r.text())
    .then(html => {
      const m = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/);
      reply(m ? m[1] : null);
    })
    .catch(() => reply(null));
  return true;
});
