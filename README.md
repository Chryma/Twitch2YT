# Twitch to YouTube

A Chrome extension that swaps a Twitch stream for the same streamer's YouTube live, right inside the Twitch page. Twitch chat, the sidebar and everything else stay where they are, and only the video player changes.

## Install

1. Download this repo (**Code → Download ZIP**) and unzip it, or `git clone` it.
2. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick the unzipped folder.

To update, replace the folder with the new version and click the reload icon on the extension's card.

## Use

- On any Twitch channel, click **▶ YouTube** in the top nav (next to the ⋮ menu), or open the extension popup and click **Swap this stream**.
- The first time you swap a channel it asks for the streamer's YouTube channel. It pre-fills one if the Twitch page links to a YouTube channel. You can enter a URL or an `@handle`.
- Click **■ Twitch** to switch back.
- If you leave a channel on YouTube, it opens straight into YouTube the next time you visit it. Switching back to Twitch turns that off.
- The popup lists your saved channels. Click a channel to edit it, or click ✕ to remove it. Saved channels sync through your browser account.

## Extras in the YouTube player

- Always plays at the best available quality (the embed's "auto" setting tends to stop at 720p).
- The player controls hide after 1 second without mouse movement.
- Scroll over the player to change the volume in 2% steps.
- Pausing and then playing a live stream jumps back to live. Seeking still lets you scrub back.

## Also

Twitch category pages open sorted by **highest viewers** instead of "Recommended For You", unless you pick a different sort.

## Permissions

- `twitch.tv`: adds the button and the YouTube player.
- `youtube.com`: checks whether a channel is live (`/live`) and controls the embedded player.
- `storage`: remembers your channel mappings.

Nothing is sent anywhere except Twitch and YouTube.
