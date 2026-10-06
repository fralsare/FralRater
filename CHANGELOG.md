# Changelog

All notable changes to FralRater are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-06

### Added

- First public release.
- **Analyze** — Flesch-Kincaid grade, reading ease, Gunning fog, SMOG, jargon
  count and per-100-words density, long-sentence and passive-voice ratios,
  hard-word percentage.
- **Audience** — fit scores for 8 reader personas (child, general public,
  professional, executive, patient, developer, legal, academic) with
  per-paragraph confidence bars.
- **Lost Reader map** — SVG difficulty curve showing exactly where sentences
  get hard.
- **Rhythm heatmap** — visual detection of monotonous, choppy, or varied
  sentence-length patterns.
- **Actionability** — does the text tell the reader what to do next?
- **Accessibility** — flags jargon-heavy and passive-heavy text.
- **Rewrite** — rule-based, offline rewriting: passive-voice flip, buried-lead
  fix, jargon swaps with a per-100-word density meter, sentence splitting,
  sentence-by-sentence diff, and Before/After grade cards.
- **Compare** — two-version radar chart plus head-to-head metric table.
- Standalone desktop window (Electron) with right-click Cut/Copy/Paste menu.
- Voice-note input (Web Speech API, Chrome/Chromium).
- Zero network calls: all analysis runs locally in the browser; text never
  leaves the machine.
- Launchers for Linux/macOS (`start.sh`) and Windows (`start.bat`).
- Packaging recipes: AppImage, .deb, .rpm (Linux) and NSIS installer .exe,
  portable .exe zip (Windows).

[Unreleased]: https://github.com/fralsare/fralrater/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/fralsare/fralrater/releases/tag/v0.1.0
