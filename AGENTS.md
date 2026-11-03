# AGENTS.md — Automated Coursework Journal System Directives

> [!IMPORTANT]
> **CRITICAL SYSTEM MANDATE:**
> Every AI agent operating in this repository MUST follow the guidelines, architecture, security directives, and diagnostic workflows defined in this document without exception.

---

## Project Overview & Architecture

**Automated Coursework Journal Submission** is an enterprise-grade Node.js & Playwright automation system that submits coursework entries to Google Forms using an authenticated Google session (`storageState.json`).

- **Engine**: Node.js v20+ (ES Modules)
- **Browser Automation**: Playwright Chromium with persistent session state restoration
- **CI/CD Automation**: Scheduled GitHub Actions workflow (`.github/workflows/daily-journal.yml`)
- **Testing Engine**: Built-in Node.js Test Runner (`node --test`)

---

## Security & Privacy Directives

1. **Session State Isolation**: `storageState.json` contains active Google session authentication cookies and MUST NEVER be committed to Git. Enforced via `.gitignore`.
2. **Secrets Management**: Credentials and session state are base64-encoded and injected via GitHub Repository Secrets (`STORAGE_STATE_BASE64`).
3. **Fail-Fast Error Strategy**: Non-zero exit code (`exit 1`) on any failure (expired session, missing form fields, network failure, missing binaries) to immediately alert maintainers via GitHub Actions notifications.
4. **Environment Masking**: Never expose session tokens in logs or public documentation.

---

## Repository Structure & File Responsibilities

```
.
├── .github/workflows/
│   └── daily-journal.yml     # Files an entry when one is pushed to entries/
├── scripts/
│   ├── login.js              # One-time interactive Google authentication & field extractor script
│   └── diagnose-form.js      # Diagnostic script for inspecting form DOM elements & checkboxes
├── src/
│   ├── config.js             # Environment & configuration loader, dry-run & map parser
│   ├── entry.js              # Loads and validates entries/YYYY-MM-DD.json
│   ├── urlBuilder.js         # Pre-filled Google Form URL constructor & parameter encoder
│   └── submit.js             # Headless Playwright runner, form filler
├── test/
│   ├── check.js              # Native Node.js unit test runner checks (node --test)
│   └── form-flow.test.js     # Browser tests against a local fake form (network fully intercepted)
├── .env.example              # Template environment file
├── .gitignore                # Git exclusions (node_modules, .env, storageState.json, screenshots)
├── package.json              # Project manifest, dependencies, and script definitions
├── LICENSE                   # Open-source MIT License
├── README.md                 # Public setup, pre-filled link guide & secrets storage documentation
└── AGENTS.md                 # System architecture directives & agent rules (This file)
```

---

## Detailed Module Specifications

### 1. `src/config.js` — Configuration & Environment Engine
- **Purpose**: Loads `.env` and exports form ID, session path, timezone, `dryRun`, and `allowMultipleSubmissions`.

### 2. `src/urlBuilder.js` — Pre-filled URL Constructor
- `buildPrefilledUrl({ formId, answers })`: Accepts a raw ID or form URL and encodes the answers into a pre-filled URL.

### 3. `src/entry.js` — Written Entries
- `loadEntryAnswers(date)`: Reads `entries/<date>.json`. Returns `null` when none exists, and then nothing is filed.
- `entryToAnswers(entry)`: Validates an entry and maps it to form fields. Throws on incomplete entries. Never add default or generated answers: the tool files only what the user wrote.
- `getFormattedToday(timezone, date)`: Formats date as `YYYY-MM-DD`.

### 4. `src/submit.js` — Playwright Automation Engine
- **Purpose**: Main execution entrypoint for headless browser form interaction.
- **Key Logic**:
  - `hasAlreadySubmittedToday(timezone, date)`: Checks `.last_submission.json` to prevent duplicate daily submissions when triggered multiple times on the same day.
  - `recordSubmissionSuccess(timezone, date)`: Writes `.last_submission.json` state file upon confirmed form submission.
  - `pickFieldKey()`: Maps a text field to a written answer by entry ID, then heading, then page position. Returns `null` for unknown fields, which stay blank so form validation fails loudly.
  - `fillCurrentPage()`: Dismisses "Continue draft" modals, checks the email consent checkbox, selects the radio option exactly matching the written answer, and fills empty text inputs/textareas.
  - `fillAndSubmitForm()`: Iterates through multi-section forms via `Next` and `Submit`, saving progress screenshots to `screenshots/`. Returns only after a verified submission (Submit gone, no validation alerts, URL on `/formResponse`) and throws otherwise.
  - Dry Run Handling: Logs form validation success without triggering the final submit click when dry-run mode is active.

### 5. `scripts/login.js` & `scripts/diagnose-form.js` — Utility Tools
- **`login.js`**: Interactive authentication CLI tool that launches visible Chromium, waits for Google sign-in, inspects form field names, and writes `storageState.json`.
- **`diagnose-form.js`**: Diagnostic DOM inspection script used to analyze Google Form checkbox ARIA roles and DOM trees when form layouts shift.

---

## Operational & Diagnostic Workflows

### 1. Handling Expired Google Sessions
If CI/CD or local submission fails with `Authentication failed! redirected to Google sign-in page`:
1. Execute `npm run login` locally.
2. Complete Google authentication in the spawned browser window.
3. Press **[ENTER]** in terminal to generate a fresh `storageState.json`.
4. Re-encode `storageState.json` to base64 (`base64 < storageState.json | tr -d '\n'`) and update the `STORAGE_STATE_BASE64` secret in GitHub Repository Settings.

### 2. Form Layout / DOM Selector Drift
Google Forms periodically updates UI class names. If navigation fails:
1. Run `npm run diagnose` to dump current form HTML and inspect ARIA locators.
2. Update selector strategies in `src/submit.js` maintaining multi-tier ARIA/role fallbacks (e.g. `getByRole('button')` combined with `locator('div[role="button"]')`).

### 3. Testing Directives
Agents modifying core logic MUST run `npm test` before committing changes. All tests in `test/` must pass with zero errors. Never run `npm start` without `--dry-run` while testing: it files a real response. Browser tests in `test/form-flow.test.js` intercept all network traffic.

---

## Compliance Mandate

All AI agents must ensure code changes remain ES Module compatible, adhere to strict error-handling practices, and maintain clear separation between secrets and codebase files.
