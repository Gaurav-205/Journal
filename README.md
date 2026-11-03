# Automated Coursework Journal Submission

<p align="center">
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-v20%2B-026e00.svg?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" /></a>
  <a href="https://playwright.dev"><img src="https://img.shields.io/badge/Playwright-Chromium-45ba4b.svg?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" /></a>
  <a href=".github/workflows/daily-journal.yml"><img src="https://img.shields.io/badge/GitHub_Actions-Automated-2088FF.svg?style=for-the-badge&logo=github-actions&logoColor=white" alt="GitHub Actions" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="License" /></a>
</p>

An automated daily coursework journal submission engine built with **Node.js (ES Modules)** and **Playwright Chromium**. It populates multi-page Google Forms using authenticated session persistence (`storageState.json`) and executes scheduled submissions via **GitHub Actions**.

---

## Documentation Hub

| Document | Purpose |
| :--- | :--- |
| [Contributing Guidelines](CONTRIBUTING.md) | Guide on reporting issues, proposing features, and submitting pull requests. |
| [Code of Conduct](CODE_OF_CONDUCT.md) | Contributor Covenant v2.1 community standards. |
| [Security Policy](SECURITY.md) | Vulnerability reporting procedure and security safeguards. |
| [System Architecture](AGENTS.md) | Comprehensive AI agent directives and core architecture reference. |
| [Changelog](CHANGELOG.md) | Release notes and version history. |
| [License](LICENSE) | Open-source software license terms. |

---

## Personal Production Deployment (Fork & Automate Guide)

If you are not an admin of this repository, you can deploy your own **100% automated personal submission engine** in production on GitHub Actions for free in 5 steps:

1. **Fork this repository**: Click the **Fork** button at top right to copy this repository to your GitHub account (`github.com/YOUR_USERNAME/Journal`).
2. **Enable GitHub Actions**: In your forked repository, go to **Actions** -> click **"I understand my workflows, go ahead and enable them"**.
3. **Generate Session File Locally**:
   - Clone your fork: `git clone https://github.com/YOUR_USERNAME/Journal.git && cd Journal`
   - Run `npm install` and configure your `FORM_ID` in `.env`
   - Run `npm run login`, sign in to Google, and press **[ENTER]** in terminal to generate `storageState.json`.
4. **Base64 Encode Session File**:
   - **PowerShell (Windows)**: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("storageState.json"))`
   - **macOS / Linux**: `base64 < storageState.json | tr -d '\n'`
5. **Add Repository Secret**:
   - In your fork on GitHub, go to **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**.
   - Create secret `STORAGE_STATE_BASE64` and paste your base64 string.
   - *(Optional Secrets)*: `FORM_ID`, `GH_USERNAME`, `GH_TOKEN`, `TIMEZONE`.

> [!TIP]
> **Fully Automated Execution**: Once configured, your fork's GitHub Actions workflow runs on schedule every Monday-Friday at 4:00 PM IST (10:30 UTC) in production without any manual input required! You can also click **Actions** -> **Daily Coursework Journal Submission** -> **Run workflow** to trigger manual submissions anytime.

---

## Key Features

- **Automated Daily Journaling**: Automatically populates daily coursework journal responses using configured default answers.
- **Session Persistence**: Restores Google account session cookies via Playwright `storageState.json`, bypassing login prompts and preserving verified email consent.
- **Once-Per-Day Guard**: Tracks daily submission state via `.last_submission.json` and GitHub Actions cache to prevent duplicate form submissions if the job executes multiple times a day. Pass `--force` or `ALLOW_MULTIPLE_SUBMISSIONS=true` to override.
- **Multi-Page Form Navigation**: Automatically handles Google Form section transitions (`Next`), radio selections ("Present / Working Day"), draft popups ("Continue current draft?"), and mandatory email consent checkboxes.
- **Dry-Run Safety Controls**: Includes safety controls (`DRY_RUN=true` / `DISABLE_SUBMIT=true`) to validate form filling without triggering actual submissions.
- **Schedule & Sunday Skip**: Configured for scheduled GitHub Actions cron jobs (Mon–Fri at 16:00 IST / 10:30 UTC), automatically skipping Sunday executions.
- **Holidays & Leave**: Dates in `SKIP_DATES` file nothing; dates in `LEAVE_DATES` report the leave option with no work answers (repository variables in CI).
- **Delayed Run Guard**: A scheduled run arriving before 12:00 in the target timezone files nothing, because GitHub can delay cron past midnight and the form rejects backdated entries.
- **Verified Submissions**: A run succeeds only when Google accepted the final page. Validation errors, closed forms, and unverifiable submits exit non-zero and are not recorded as submitted.
- **Debug Screenshots**: Automatically captures page-by-page progress screenshots to simplify DOM element troubleshooting.

---

## Project Structure

```
.
├── .github/workflows/
│   └── daily-journal.yml     # Scheduled daily GitHub Actions workflow (Mon-Fri 10:30 UTC / 4:00 PM IST)
├── scripts/
│   ├── login.js              # One-time interactive Google authentication script
│   └── diagnose-form.js      # Diagnostic script for inspecting form DOM elements & checkboxes
├── src/
│   ├── config.js             # Environment variables & default entry map loader
│   ├── summarizer.js         # GitHub REST API commit summarizer module
│   ├── urlBuilder.js         # Pre-filled Google Form URL builder
│   └── submit.js             # Headless Playwright runner & idempotency guard
├── test/
│   └── check.js              # Native Node.js test runner suite (node --test)
├── .env.example              # Template environment variables file
├── .gitignore                # Excludes node_modules, .env, storageState.json
├── package.json              # ES Module manifest & script shortcuts
├── AGENTS.md                 # System technical directives
├── CHANGELOG.md              # Project version history
├── CODE_OF_CONDUCT.md        # Community conduct standards
├── CONTRIBUTING.md           # Contribution guidelines
├── LICENSE                   # Open-source MIT License
├── README.md                 # System setup & documentation hub
└── SECURITY.md               # Security & vulnerability policy
```

---

## Quick Start

### 1. Prerequisites

- **Node.js**: v20.0.0 or higher
- **npm**: v10.0.0 or higher

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Gaurav-205/Journal.git
cd Journal
npm install
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and configure your settings:

```bash
cp .env.example .env
```

Example `.env` configuration:

```env
# Target Google Form ID (extracted from /d/e/FORM_ID/viewform)
FORM_ID=1FAIpQLSc8RRUAG8n8nPB9dm21m_MxwHQ-JuDnEj7GnvwEkWXykkKFuQ

# Optional: GitHub credentials for auto-generating commit summaries
GH_OWNER=your-github-username
GH_REPO=your-repository-name
GH_USERNAME=your-github-username
GH_TOKEN=your_github_personal_access_token

# Timezone & Session settings
TIMEZONE=Asia/Kolkata
STORAGE_STATE_PATH=storageState.json

# Dry-run flag for testing (true = fill form without submitting)
DRY_RUN=true
```

---

## One-Time Authentication Setup

Google Forms requiring user sign-in cannot be filled anonymously. Follow these steps once on your local machine to save your authenticated session cookies:

1. **Run the interactive login script**:
   ```bash
   npm run login
   ```
2. A visible Chromium browser window will open and navigate to your Google Form.
3. Sign in to your verified coursework Google Account.
4. Ensure the form is visible with your email displayed.
5. Return to your terminal and press **[ENTER]**.
6. The script will inspect form fields, output entry IDs, and save session cookies to `storageState.json`.

> [!CAUTION]
> **Security Warning**: Never commit `storageState.json` to git or version control! It contains active Google account session cookies. It is strictly excluded in `.gitignore`.

---

## GitHub Actions Setup (Scheduled Daily Runs)

To run daily submissions automatically on GitHub Actions:

1. **Encode your local `storageState.json` to base64**:
   - **Linux / macOS**:
     ```bash
     base64 < storageState.json | tr -d '\n'
     ```
   - **Windows (PowerShell)**:
     ```powershell
     [Convert]::ToBase64String([IO.File]::ReadAllBytes("storageState.json"))
     ```
2. **Add GitHub Repository Secrets**:
   Go to your GitHub repository **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**:
   - `STORAGE_STATE_BASE64`: Paste the generated base64 string.
   - `FORM_ID` *(Optional)*: Override standard Form ID.
   To test in CI without submitting, use **Run workflow** and tick **dry_run**.
3. **Workflow Schedule**:
   The workflow `.github/workflows/daily-journal.yml` runs automatically Monday through Friday at 10:30 UTC (4:00 PM IST). You can also trigger it manually via the **Actions** tab using `workflow_dispatch`.

> [!NOTE]
> GitHub Actions automatically caches the daily submission state (`.last_submission.json`) by date. If a scheduled run retries or is manually triggered on the same calendar date, it will safely skip execution to prevent duplicate form submissions.

---

## Testing & Verification

Run the native Node.js test suite:

```bash
npm test
```

Test coverage includes:
- `isSunday()` timezone calculations
- `buildPrefilledUrl()` URL encoding & entry mapping
- `getMidnightISO()` timezone-safe ISO timestamp generation
- `generateCommitSummary()` fallback summary generation
- `hasAlreadySubmittedToday()` & `recordSubmissionSuccess()` date tracking
- Dry-run & configuration parsing
- `fillAndSubmitForm()` page flow against a local fake form (all network intercepted; skipped if Chromium is missing)

---

## Environment Variables Reference

| Variable | Required | Description | Default |
| :--- | :--- | :--- | :--- |
| `FORM_ID` | No (set it in a fork: the default targets the original author's form) | Target Google Form ID or raw URL | Default Coursework Form |
| `TIMEZONE` | No | Target execution timezone | `Asia/Kolkata` |
| `STORAGE_STATE_PATH` | No | Path to Playwright session file | `storageState.json` |
| `DRY_RUN` / `DISABLE_SUBMIT` | No | Set to `true` to disable final submission click | `false` |
| `ALLOW_MULTIPLE_SUBMISSIONS` | No | Set to `true` to force re-submission on the same day | `false` |
| `SKIP_DATES` | No | Comma-separated `YYYY-MM-DD` dates with nothing to file (campus holidays, unscheduled days). Repository **variable** in CI | — |
| `LEAVE_DATES` | No | Comma-separated `YYYY-MM-DD` dates to report the "on leave or absent" option instead of filing work answers. Repository **variable** in CI | — |
| `ENTRY_MAP` | No | JSON object of entry IDs to your own answers; `JOURNAL_TEXT` inserts the commit summary | Stock answers |
| `COMMIT_READ_TOKEN` | No | GitHub PAT for commit API access (takes precedence over `GH_TOKEN`) | — |
| `GH_OWNER` | No | GitHub repo owner for commit activity | — |
| `GH_REPO` | No | GitHub repo name for commit activity | — |
| `GH_USERNAME` | No | Target GitHub username filter | — |
| `GH_TOKEN` | No | GitHub PAT for commit API access | — |

---

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.
