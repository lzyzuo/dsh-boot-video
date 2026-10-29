# dsh-boot-animation

**English** · [简体中文](README.md)

> A full-screen boot animation for the **DeepSeek Harness** Web UI: play any video once when the window opens,
> then fade into the interface. Click to skip, sound on by default, and it coexists peacefully with the
> `dsh-plugin-wallpaper-engine` wallpaper plugin.

![overlay layout](docs/preview.png)

<!-- The image above is a layout mock of the overlay (video area / vignette / progress bar / skip hint / mute button), not a frame of any copyrighted video. -->

## What it does

| When | What happens |
| --- | --- |
| DSH window opens / restarts | Plays the boot video full-screen, then fades out (650 ms) to the UI |
| Navigating inside the UI | No replay — one playback per window lifetime |
| Click anywhere, `Esc`, `Enter`, `Space` | Fades out immediately |
| Video runs long | Hard cap at 26 s, never leaves a black screen |
| Video missing / broken | The overlay is not rendered at all (no black flash) |

## Features

- **Bring your own mp4** — an anime OP, a company logo, a demo reel; anything the browser can decode.
- **HTTP Range streaming** — served as `206` chunks, so a few hundred MB never gets buffered into memory.
- **Autoplay fallback** — if the browser refuses to autoplay with sound, it retries muted; the speaker button unmutes.
- **Wallpaper-friendly** — its own overlay with a positive z-index; it never reads or writes the wallpaper plugin's
  DOM or state, and unmounts itself completely when done.
- **i18n** — UI strings go through the DSH locale service (English / Chinese).
- **Graceful degradation** — with no video installed the plugin quietly does nothing.

## Install

```bash
git clone https://github.com/lzyzuo/dsh-boot-video.git
```

Then install that folder as a plugin package in DSH (Plugin manager → install local plugin → point at the directory
containing `package.json`), and **restart the DSH window**.

<details>
<summary>Manual install into a profile</summary>

Copy the directory to `<profile>/node_modules/@local/dsh-boot-animation/` and add to the profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: boot-animation
      name: '@local/dsh-boot-animation'
      config:
        enabled: true
        sound: true
```
</details>

## Add your own video

> ⚠️ **This repository ships no video files.** Partly copyright (the demo clip was a Gundam boot sequence owned by
> Bandai / Sunrise), partly because repositories should not carry tens of megabytes of binary.

Two options:

1. Drop your clip at `media/boot.mp4` (that folder is in `.gitignore`, so it will not be committed);
2. Or point at any path from the config:

```yaml
config:
  file: 'D:/videos/my-boot.mp4'
```

Recommended: 16:9, ≤1920×1080, ≤20 s, `H.264 + AAC` in an mp4 container. `object-fit: cover` crops the edges on
non-16:9 windows, so keep important content away from the borders.

## Configuration

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | `false` disables it entirely (the video route is not even registered) |
| `sound` | boolean | `true` | `false` starts muted |
| `file` | string | `media/boot.mp4` | Custom video path (absolute, or relative to the plugin directory) |

Restart the DSH window after changing config.

## Why it does not fight the wallpaper plugin

| | Wallpaper plugin | This plugin |
| --- | --- | --- |
| Mount point | `.we-layer` on `body` | Own overlay in the `shell.overlay` slot |
| z-index | `-2` (scrim `-1`) | `2147483000` |
| Input | ignores pointer events | owns the pointer while playing, unmounts afterwards |
| Coupling | — | never touches the wallpaper plugin's DOM, attributes or state |

The wallpaper keeps rendering underneath; when the animation ends it simply uncovers wallpaper + UI.

## How it works

Host side (`index.js`) registers two read-only routes:

| Route | Purpose |
| --- | --- |
| `GET /boot-animation/status.json` | `{"enabled":true,"sound":true,"ready":true}`, `Cache-Control: no-store` |
| `GET /boot-animation/video.mp4` | Range-capable stream (`200` / `206` / `400` / `416`, `Accept-Ranges: bytes`) |

Client side (`client.js`) occupies `shell.overlay` (`id: boot-animation`, `order: 90000`). It asks `status.json` first
and only renders when `enabled && ready`, which avoids a black flash.

## FAQ

**No sound?** Browser autoplay policy — the plugin falls back to muted playback. Click the speaker button.

**Nothing happens?** Open `http://127.0.0.1:<port>/boot-animation/status.json`. If `ready` is `false`, `media/boot.mp4`
is missing; if `enabled` is `false`, the plugin is configured off.

## Development

```bash
node --check index.js
node --check client.js
```

## License

[MIT](LICENSE) © 2026 20411
