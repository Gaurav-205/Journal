# Changelog

All notable changes to the **Automated Coursework Journal Submission** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.1] - 2026-11-04

### Fixed
- The "Continue current draft?" dialog was not dismissed, so it swallowed the next click and threw off page counting.
- Fields already holding text were skipped, so a restored draft could be filed instead of the written entry. Written answers now always win.

---

## [2.0.0] - 2026-11-04

### Changed
- **Breaking**: the tool now files only entries you write in `entries/YYYY-MM-DD.json`. With no entry for today, nothing is submitted.
- **Breaking**: the workflow runs when an entry is pushed instead of on a cron schedule, so entries land before the form's deadline.

### Removed
- Stock default answers, `ENTRY_MAP`, and generated commit summaries, plus `src/summarizer.js` and the `GH_*` settings. They reported attendance and work regardless of what happened that day.
- `SKIP_DATES`, `LEAVE_DATES`, the delayed-cron guard, and the Sunday skip, which entries replace.

---

## [1.2.0] - 2026-11-03

### Added
- `SKIP_DATES` to file nothing on campus holidays and unscheduled days.
- `LEAVE_DATES` to report the form's "on leave or absent" option with no work answers. Previously no run could report anything but present.
- Guard against delayed scheduled runs: GitHub started cron runs up to 10 hours late, past the form's 11:59 PM deadline. A run arriving before 12:00 now files nothing, instead of reporting on a day that has barely started.
- `dry_run` input on the manual workflow run.
- Browser tests of the form flow against a local fake form.

### Fixed
- **False success**: runs were recorded as submitted when Submit was never clicked or could not be confirmed. The confirmation regex also matched "recorded" on the unsubmitted form.
- **Fragile radio answer**: the first option containing "working" or "present" was selected, which gave the right option only because of the form's current order. Only the exact configured answer is selected now.
- **Unintended submissions**: every push to `main` filed a real response. The `push` trigger is removed.
- **Wrong answers in fields**: the position fallback assumed a layout the form no longer has; custom Key Tasks answers were overwritten by the summary; `JOURNAL_TEXT` was typed literally; unknown and email fields received unrelated text.
- **Stale session handling**: the cached session was always overwritten by the secret, because `cache-hit` is false for `restore-keys` matches. Caches are now scoped to a hash of the secret, so a new secret takes effect at once.
- **Foreign commits in journals**: in CI, `GITHUB_REPOSITORY` made summaries use this repository's own commits.
- Malformed `ENTRY_MAP` silently fell back to default answers; it now fails.
- `isVisible({ timeout })` ignored its timeout, causing races on slow page loads.
- Importing `submit.js` from any path containing "submit" started a real run.
- `npm run diagnose` broke on a single-ID `ENTRY_MAP`.
- `GH_TOKEN` secret was documented but not passed to the job.
- Base64 command in the docs did not work on macOS.
- `npm run login` saved a session even if sign-in had not finished, listed question item IDs as entry IDs, ran the browser without its sandbox, and wrote cookies world-readable.
- A dry run was blocked once that day's journal had been submitted.
- `getMidnightISO` was an hour off on DST change days in zones with large offsets.
- Merge commits appeared in summaries as if they were work.
- `npm run diagnose` left the browser open on failure.
- Non-numeric `ENTRY_MAP` keys could crash field matching.

### Changed
- Actions upgraded off the deprecated Node 20 runtime: `checkout` and `setup-node` v7, `cache` v6.

---

## [1.1.0] - 2026-08-11

### Added
- **Once-Per-Day Submission Guard**: Automatic idempotency state tracking via `.last_submission.json` to skip duplicate submissions when the workflow or script is triggered multiple times in a single day.
- **GitHub Actions Date Caching**: Integrated `actions/cache` in `daily-journal.yml` keyed by `journal-submitted-${{ steps.date.outputs.today }}` to prevent duplicate CI runs on cron retries.
- **Override Setting**: Added `ALLOW_MULTIPLE_SUBMISSIONS` / `--force` option to bypass idempotency locks when forced re-submission is desired.
- **Diagnose Shortcut**: Added `npm run diagnose` script alias to package.json for DOM layout inspection.

### Fixed
- Prevented duplicate daily Google Form submissions caused by GitHub Actions schedule jitter and workflow dispatches.

---

## [1.0.0] - 2026-08-10

### Added
- **Playwright Automation Engine**: Headless Chromium submission runner with persistent session state restoration (`storageState.json`).
- **GitHub Commit Activity Summarizer**: REST API integration to summarize daily commit activity using timezone-aware midnight ISO calculations.
- **Pre-filled Form URL Generator**: Dynamic parameter builder supporting custom entry maps and placeholder string substitution.
- **Multi-Section Form Support**: Automated handling of multi-page Google Form transitions (`Next`), draft modal dismissal, email consent checkboxes, and radio options.
- **Dry-Run Mode**: Flags (`DRY_RUN`, `DISABLE_SUBMIT`, `--dry-run`) to test form interactions without executing the final submission click.
- **Native Unit Test Suite**: Comprehensive tests under Node.js built-in test runner (`node --test`).
- **Open-Source Documentation Suite**: Added `LICENSE` (MIT), `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `AGENTS.md`, and `CHANGELOG.md`.

### Fixed
- Fixed runtime `TypeError` when parsing invalid or empty JSON strings in `ENTRY_MAP`.
- Fixed URL constructor fallbacks when `entryMap` is `null`, `undefined`, or `{}`.
- Hardened Playwright locators for Google Form draft restoration modals and email consent check boxes.
- Fixed timezone offset benchmark calculations in `getMidnightISO()`.
