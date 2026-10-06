# FralRater

**Readability that tells you who your text is too hard for — and shows you the fix.**

FralRater is a fully offline desktop app. It scores your writing for specific
reader personas, maps exactly where readers get lost, and rewrites the hard
parts in front of you. Your text never leaves your machine — no network, no
accounts, no AI.

> Hemingway tells you *where* your writing is hard.
> FralRater tells you **who it's too hard for — and shows you the fix.**

![platforms](https://img.shields.io/badge/platform-Linux%20%7C%20Windows-blue)
![electron](https://img.shields.io/badge/Electron-44-47848F)
![license](https://img.shields.io/badge/license-MIT-green)
![privacy](https://img.shields.io/badge/privacy-100%25%20local-brightgreen)

---

## Why it's different

| Tool | Does this? |
|------|-----------|
| **Score + fix** | Rewrites the hard sentences and shows a before/after diff — not just a red highlight |
| **Audience-targeted scoring** | Grade for a child, an exec, a patient, a developer — 8 reader personas, each with per-paragraph confidence |
| **Lost Reader map** | A difficulty curve showing exactly which sentence loses the reader |
| **Jargon & concept density** | Per-100-words jargon meter + the exact flagged words |
| **Actionability** | Does the text tell the reader what to *do* next? |
| **Comparative mode** | Draft vs edit, human vs LLM, original vs translation — radar + head-to-head |
| **Rhythm heatmap** | Monotonous, choppy, or varied sentence length, visualized |
| **100% offline** | No network calls; your text never leaves the window |

## Features

- **Analyze** — Flesch-Kincaid grade, reading ease, Gunning fog, SMOG, jargon
  density, long-sentence and passive-voice ratios, hard-word percentage.
- **Audience** — 0–100 fit score for 8 reader personas + per-paragraph
  confidence bars.
- **Lost Reader map** — SVG difficulty curve, one point per sentence.
- **Rhythm heatmap** — sentence-length variance at a glance.
- **Rewrite** — passive→active flip, buried-lead fix, jargon swaps,
  sentence splitting. Deterministic, rule-based, offline. Sentence-by-sentence
  diff with per-100-word jargon density before/after.
- **Compare** — two-version radar chart + head-to-head metric table.
- **Voice note** — dictate into the Analyze box (Chrome/Chromium Web Speech).
- **Right-click menus** — Cut/Copy/Paste in the desktop app.

## Download / Install

Prebuilt releases are attached to each [GitHub
Release](https://github.com/fralsare/fralrater/releases):

| File | Platform | Install |
|------|----------|---------|
| `FralRater-<ver>-linux-x64.AppImage` | Linux (any distro) | `chmod +x` then run |
| `fralrater_<ver>_amd64.deb` | Debian / Ubuntu | `sudo dpkg -i` or double-click |
| `fralrater-<ver>-1.x86_64.rpm` | Fedora / RHEL / openSUSE | `sudo rpm -i` or double-click |
| `FralRater Setup <ver>.exe` | Windows | Run the installer |
| `FralRater-portable-<ver>-win-x64.zip` | Windows (no install) | Unzip, run `FralRater.exe` |

📖 **Full user manual:** see [MANUAL.md](MANUAL.md).

## Run from source

```bash
npm install     # one-time
npm start       # opens the FralRater window
```

Or:

```bash
./start.sh      # Linux/macOS
start.bat       # Windows (double-click works)
```

Requires Node 18+.

## Build the release artifacts

```bash
npm install

# Linux artifacts: AppImage + .deb + .rpm
npm run package:linux

# Windows installer: FralRater Setup x.y.z.exe
npm run package:win

# Windows portable: FralRater-portable-x.y.z-win-x64.zip (unzip-and-run .exe)
npm run package:portable

# All of the above
npm run package:all
```

**Easiest: push a tag — GitHub Actions builds everything.**

```bash
git tag v0.1.0 && git push origin v0.1.0
```

The workflow in [`.github/workflows/release.yml`](.github/workflows/release.yml)
runs on GitHub runners (Linux + Windows), builds all five artifacts, and
publishes them as a GitHub Release automatically. Watch it under the repo's
**Actions** tab.

### Manual local builds (fallback)

```bash
npm install
npm run package:all   # outputs land in dist/
```

- **Linux** (AppImage, .deb, .rpm): build on Linux. `.rpm` additionally needs
  `sudo apt-get install rpm` (for `rpmbuild`).
- **Windows** installer (.exe): build on Windows, or on Linux with Wine
  (`sudo apt-get install wine64`).
- **Windows** portable (.zip of the .exe): cross-builds from Linux without Wine.

## Architecture

Zero runtime dependencies. The "app" is a static bundle in `public/` served by
a 60-line Node server (`server.js`) on a free local port. Electron
(`electron/main.js`) owns the window, spawns the server, and kills it on
close. All analysis lives in `public/lib/` as pure functions:

| Module | Job |
|--------|-----|
| `lib/metrics.js` | FK, ease, fog, SMOG, jargon, passive, rhythm, density |
| `lib/jargon.js` | ~80-entry jargon dictionary + swap table |
| `lib/audiences.js` | 8 reader personas + fit scoring |
| `lib/rewriter.js` | Rule-based rewriter (flip, de-bury, swap, split) |
| `lib/charts.js` | SVG difficulty curve, radar, rhythm heatmap |

The `lib/` layer is a clean seam: swap in a different engine (or LLM) without
touching the UI.

## Security model

- `contextIsolation: true`, `nodeIntegration: false`
- Content-Security-Policy: `default-src 'self'`
- Navigation locked to the local server; external links open in the OS browser
- Single-instance lock

## Privacy

No analytics, no telemetry, no network calls. Voice notes use the underlying
browser engine's Web Speech API.

## License

[MIT](LICENSE)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

---

## 🙏 Support open-source tool development

Your donation keeps this project maintained and funds new open-source
projects, while supporting my **CyberSecurity studies**. Even a small amount
makes a real difference. Thank you for supporting independent open-source
work!

| Method | Link |
|--------|------|
| **PayPal** | <https://paypal.com/ncp/payment/KKFBWQP97XUCN> |
| **Razorpay** | <https://rzp.io/rzp/TdksERz> |

*Made with care by [Fralsare](https://github.com/fralsare).*
