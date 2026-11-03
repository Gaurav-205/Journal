# Contributing to Automated Coursework Journal Submission

Thank you for your interest in contributing to **Automated Coursework Journal Submission**! We welcome contributions from developers of all skill levels.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How to Contribute](#how-to-contribute)
   - [Reporting Bugs](#reporting-bugs)
   - [Suggesting Enhancements](#suggesting-enhancements)
   - [Submitting Pull Requests](#submitting-pull-requests)
3. [Development Setup](#development-setup)
4. [Coding & Style Standards](#coding--style-standards)
5. [Testing Directives](#testing-directives)
6. [Security Reminders](#security-reminders)

---

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

---

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates. When filing a bug report:

- Use a clear and descriptive title.
- Describe the exact steps to reproduce the issue.
- Include expected vs. actual behavior.
- Attach scrubbed log output or sanitized debug screenshots from `screenshots/`.
- Do **NOT** post session cookies, `storageState.json` data, or personal API tokens.

### Suggesting Enhancements

Enhancement suggestions are welcome! When proposing a new feature:

- Explain the use case and why this feature would be useful to others.
- Describe how you envision the feature working.
- Maintain compatibility with ES Modules and Playwright Chromium automation.

### Submitting Pull Requests

1. **Fork the Repository**: Create your own fork of `Gaurav-205/Journal`.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/my-new-feature
   ```
3. **Make & Test Your Changes**:
   - Write clean, ES Module-compatible JavaScript.
   - Add tests in `test/` covering your new logic.
   - Run the test suite:
     ```bash
     npm test
     ```
4. **Commit & Push**:
   ```bash
   git commit -m "feat: add support for dynamic radiogroup locators"
   git push origin feature/my-new-feature
   ```
5. **Open a Pull Request**: Submit your PR targeting the `main` branch with a concise description of changes.

---

## Development Setup

1. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Journal.git
   cd Journal
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure local environment**:
   ```bash
   cp .env.example .env
   ```
4. **Run interactive login**:
   ```bash
   npm run login
   ```
5. **Execute dry-run test**:
   ```bash
   npm start -- --dry-run
   ```

---

## Coding & Style Standards

- **ES Modules**: Use native `import`/`export` syntax. No CommonJS `require()`.
- **Node.js Target**: Minimum Node.js v20.0.0.
- **Fail-Fast Error Strategy**: Explicit error messages with non-zero exit codes (`process.exit(1)`) on critical failures.
- **Clean Formatting**: Use standard 2-space indentation and descriptive variable names.
- **JSDoc Comments**: Document public functions with JSDoc parameter and return types.

---

## Testing Directives

All submitted code MUST pass the built-in Node.js test runner:

```bash
npm test
```

Ensure all tests in `test/` pass with 0 errors before requesting a PR review.

---

## Security Reminders

- **NEVER** commit `storageState.json` or `.env` files.
- Ensure all personal tokens (`GH_TOKEN`, `COMMIT_READ_TOKEN`) are masked in issue descriptions and PR logs.
