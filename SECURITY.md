# Security Policy

## Supported Versions

We actively release security updates and bug fixes for the following versions of **Automated Coursework Journal Submission**:

| Version | Supported |
| :--- | :--- |
| 1.1.x | Yes |
| 1.0.x | Yes |
| < 1.0.0 | No |

---

## Reporting a Vulnerability

If you discover a security vulnerability within this project (including session handling bugs, accidental secret exposure, or dependency vulnerabilities), please **do not** open a public GitHub issue.

Instead, please report the vulnerability directly to the project maintainers:

1. Send a detailed report describing the vulnerability.
2. Include step-by-step instructions or proof-of-concept code to reproduce the issue.
3. Allow up to **48 hours** for an initial response from maintainers.

---

## Security Best Practices & Safeguards

1. **Session Cookies (`storageState.json`)**:
   - `storageState.json` contains sensitive Google session authentication tokens.
   - **Never commit `storageState.json` to version control.** It is strictly listed in `.gitignore`.
   - When deploying to CI/CD (GitHub Actions), encode the session to base64 (`base64 < storageState.json | tr -d '\n'`) and inject it using encrypted Repository Secrets (`STORAGE_STATE_BASE64`).

2. **Personal Access Tokens (`GH_TOKEN`)**:
   - Limit token permissions to read-only commit access (`contents: read`).
   - Store GitHub tokens strictly in environment variables (`.env`) or GitHub Actions secrets.

3. **Screenshots**:
   - Files in `screenshots/` show the signed-in email address and form contents. Never commit or upload them.

4. **Masking Sensitive Outputs**:
   - Ensure logs, issues, and pull requests are sanitized to prevent accidental credential leakage.
