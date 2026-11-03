# Automated Coursework Journal Submission

<p align="center">
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-v20%2B-026e00.svg?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" /></a>
  <a href="https://playwright.dev"><img src="https://img.shields.io/badge/Playwright-Chromium-45ba4b.svg?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" /></a>
  <a href=".github/workflows/daily-journal.yml"><img src="https://img.shields.io/badge/GitHub_Actions-Automated-2088FF.svg?style=for-the-badge&logo=github-actions&logoColor=white" alt="GitHub Actions" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="License" /></a>
</p>

Files daily coursework journal entries to a Google Form automatically, using **Node.js (ES Modules)**, **Playwright Chromium**, and **GitHub Actions**. Runs on a Mon–Fri schedule with configured default answers (`entries/default.json`), with optional support for daily written entries (`entries/YYYY-MM-DD.json`).

## Daily Submission & Default Answers

By default, the workflow runs Monday–Friday at 4:00 PM IST (10:30 AM UTC) and fills the journal using `entries/default.json` (or built-in defaults).

You can edit `entries/default.json` to customize your regular default answers:

```json
{
  "status": "present",
  "tasks": "Worked on assigned tasks as per the daily plan...",
  "solved": "Encountered a few technical issues...",
  "unsolved": "A few issues/tasks are still in progress...",
  "plan": "Continue working on the pending tasks..."
}
```

### Overriding for a Specific Date
To override the default answers on any specific date, create `entries/YYYY-MM-DD.json` (e.g. `{ "status": "leave" }` when absent, or custom tasks). When present, the date-specific entry takes priority over default answers.

> [!WARNING]
> Pushed entries are as visible as your repository. In a public repository anyone can read them, so keep yours private if they should stay between you and your program.

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

If you are not an admin of this repository, you can deploy your own personal copy on GitHub Actions for free in 5 steps:

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
   - *(Optional Secrets)*: `FORM_ID`, `TIMEZONE`.

> [!TIP]
> Once configured, pushing an entry runs the workflow. To retry or test, use **Actions** -> **Daily Coursework Journal Submission** -> **Run workflow**, with **dry_run** to fill without submitting.

---

## Key Features

- **Written Entries Only**: Submits exactly what you wrote in `entries/YYYY-MM-DD.json`. No entry, no submission.
- **Session Persistence**: Restores Google account session cookies via Playwright `storageState.json`, bypassing login prompts and preserving verified email consent.
- **Once-Per-Day Guard**: Tracks daily submission state via `.last_submission.json` and GitHub Actions cache to prevent duplicate form submissions if the job executes multiple times a day. Pass `--force` or `ALLOW_MULTIPLE_SUBMISSIONS=true` to override.
- **Multi-Page Form Navigation**: Automatically handles Google Form section transitions (`Next`), radio selections ("Present / Working Day"), draft popups ("Continue current draft?"), and mandatory email consent checkboxes.
- **Dry-Run Safety Controls**: Includes safety controls (`DRY_RUN=true` / `DISABLE_SUBMIT=true`) to validate form filling without triggering actual submissions.
- **Leave Reporting**: `{ "status": "leave" }` selects the leave option and sends no work answers.
- **Verified Submissions**: A run succeeds only when Google accepted the final page. Validation errors, closed forms, and unverifiable submits exit non-zero and are not recorded as submitted.
- **Debug Screenshots**: Automatically captures page-by-page progress screenshots to simplify DOM element troubleshooting.

---

## Project Structure

```
.
├── .github/workflows/
│   └── daily-journal.yml     # Files an entry when one is pushed to entries/
├── entries/                  # Your daily entries (YYYY-MM-DD.json)
├── scripts/
│   ├── login.js              # One-time interactive Google authentication script
│   └── diagnose-form.js      # Diagnostic script for inspecting form DOM elements & checkboxes
├── src/
│   ├── config.js             # Environment variables & default entry map loader
│   ├── entry.js              # Loads and validates entries/YYYY-MM-DD.json
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

## GitHub Actions Setup

To file entries from GitHub Actions:

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
3. **When It Runs**:
   The workflow `.github/workflows/daily-journal.yml` runs when a file under `entries/` is pushed to `main`, or manually via the **Actions** tab using `workflow_dispatch`.

> [!NOTE]
> GitHub Actions caches the daily submission state (`.last_submission.json`) by date. A second run on the same date skips execution to prevent duplicate form submissions.

---

## Testing & Verification

Run the native Node.js test suite:

```bash
npm test
```

Test coverage includes:
- `buildPrefilledUrl()` URL encoding
- `entryToAnswers()` & `loadEntryAnswers()` entry validation
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

---

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.
