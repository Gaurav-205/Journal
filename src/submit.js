import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, DEFAULT_ANSWERS } from './config.js';
import { generateCommitSummary, getFormattedToday } from './summarizer.js';
import { buildPrefilledUrl, normalizeEntryMap, resolveAnswer } from './urlBuilder.js';

const ATTENDANCE_ENTRY = 'entry.187493348';
const LEAVE_OPTION = 'It was a working day, but I was on leave or absent';
// The form rejects backdated entries, and GitHub delays cron runs by hours. A delayed run landing
// in the small hours would file a report for a day that has barely started.
const EARLIEST_SCHEDULED_HOUR = 12;
const MAX_PAGES = 15;

/**
 * Returns the path to the daily submission state file.
 */
export function getSubmissionStatePath() {
  return path.resolve('.last_submission.json');
}

/**
 * Checks if a successful submission has already been recorded for today in target timezone.
 */
export function hasAlreadySubmittedToday(timezone = 'Asia/Kolkata', referenceDate = new Date()) {
  try {
    const statePath = getSubmissionStatePath();
    if (!fs.existsSync(statePath)) return false;
    const content = fs.readFileSync(statePath, 'utf8');
    const data = JSON.parse(content);
    const today = getFormattedToday(timezone, referenceDate);
    return data.lastSubmittedDate === today && data.status === 'SUCCESS';
  } catch {
    return false;
  }
}

/**
 * Records a successful submission for today in target timezone.
 */
export function recordSubmissionSuccess(timezone = 'Asia/Kolkata', referenceDate = new Date()) {
  try {
    const statePath = getSubmissionStatePath();
    const today = getFormattedToday(timezone, referenceDate);
    const stateData = {
      lastSubmittedDate: today,
      timestamp: new Date().toISOString(),
      timezone,
      status: 'SUCCESS',
    };
    fs.writeFileSync(statePath, JSON.stringify(stateData, null, 2), 'utf8');
  } catch (err) {
    console.warn('Warning: Could not save submission state file:', err.message);
  }
}

/**
 * Checks if today is Sunday in the target timezone.
 */
export function isSunday(timezone = 'Asia/Kolkata', referenceDate = new Date()) {
  const refDate = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date();
  let tz = timezone;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    tz = 'Asia/Kolkata';
  }

  const dayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  }).format(refDate);
  return dayStr === 'Sun';
}

/**
 * True when today (in the target timezone) is listed in skipDates (YYYY-MM-DD),
 * e.g. holidays or days off, when no journal entry should be filed.
 */
export function isSkippedDate(skipDates = [], timezone = 'Asia/Kolkata', referenceDate = new Date()) {
  return skipDates.includes(getFormattedToday(timezone, referenceDate));
}

/**
 * Hour of day (0-23) in the target timezone.
 */
export function getLocalHour(timezone = 'Asia/Kolkata', referenceDate = new Date()) {
  let tz = timezone;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    tz = 'Asia/Kolkata';
  }
  return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(referenceDate), 10);
}

/**
 * Decides which configured answer a text field receives. Returns null when the field
 * cannot be identified, so unknown questions are left blank and fail form validation
 * instead of receiving an unrelated answer.
 */
export function pickFieldKey({ name = '', heading = '', pageNum, position }, knownKeys = Object.keys(DEFAULT_ANSWERS)) {
  for (const key of knownKeys) {
    const id = key.replace('entry.', '');
    if (new RegExp(`\\b${id}\\b`).test(name)) return key;
  }

  const h = heading.toLowerCase();
  if (/challenge|problem/.test(h)) {
    if (/\bnot\b|cannot|n't\b|unable|carrying/.test(h)) return 'entry.199221807';
    if (/solve|\bdid\b/.test(h)) return 'entry.1874357572';
  }
  if (/\bplans?\b|next day|upcoming/.test(h)) return 'entry.1546753981';
  if (/\btasks?\b|\bkey\b|\bwork/.test(h)) return 'entry.32162408';

  // Position fallback: the form asks all four questions, in this order, on page 2.
  if (pageNum === 2) return ['entry.32162408', 'entry.1874357572', 'entry.199221807', 'entry.1546753981'][position] ?? null;
  return null;
}

// Locator.isVisible() ignores its timeout and returns immediately, so waiting needs waitFor().
function visibleWithin(locator, timeout) {
  return locator.waitFor({ state: 'visible', timeout }).then(() => true, () => false);
}

async function throwOnValidationErrors(page) {
  const errors = await page.locator('[role="listitem"] [role="alert"]').filter({ hasText: /\S/ }).allInnerTexts();
  if (errors.length > 0) {
    throw new Error(`Form rejected the answers: ${[...new Set(errors)].join('; ')}`);
  }
}

async function fillCurrentPage(page, answers, journalSummaryText, pageNum) {
  // 0. Handle "Continue current draft?" dialog modal if present
  const continueBtn = page.locator(
    'div[role="dialog"] button:has-text("Continue"), div[role="dialog"] div[role="button"]:has-text("Continue"), div[role="dialog"] button:has-text("Restore"), div[role="dialog"] div[role="button"]:has-text("Restore")'
  ).first();
  if (await visibleWithin(continueBtn, 1500)) {
    console.log('  [ACTION] Dismissing "Continue current draft?" popup modal...');
    await continueBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }

  // 1. Email consent checkbox
  const emailCheckboxes = page.locator('div[role="checkbox"], input[type="checkbox"]');
  const cbCount = await emailCheckboxes.count().catch(() => 0);
  for (let i = 0; i < cbCount; i++) {
    const cb = emailCheckboxes.nth(i);
    const ariaChecked = await cb.getAttribute('aria-checked').catch(() => 'false');
    const isChecked = ariaChecked === 'true' || (await cb.isChecked().catch(() => false));
    if (!isChecked) {
      const containerText = await cb
        .evaluate((el) => {
          const container = el.closest('[role="listitem"], label') || el.parentElement;
          return `${el.getAttribute('aria-label') || ''} ${container?.innerText || container?.textContent || ''}`.toLowerCase();
        })
        .catch(() => '');

      if (containerText.includes('email') && containerText.includes('record')) {
        console.log('  [ACTION] Checking email consent checkbox...');
        await cb.click({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
      }
    }
  }

  // 2. Radio option: only ever the exact configured answer, never a fuzzy match
  const configuredOption = answers[ATTENDANCE_ENTRY];
  if (configuredOption) {
    const radio = page.getByRole('radio', { name: String(configuredOption), exact: true }).first();
    if (await visibleWithin(radio, 1000)) {
      if ((await radio.getAttribute('aria-checked').catch(() => 'false')) !== 'true') {
        console.log(`  [ACTION] Selecting configured option "${configuredOption}"`);
        await radio.click({ force: true });
        await page.waitForTimeout(500);
      }
    }
  }

  // 3. Fill empty text inputs / textareas. Email inputs are excluded: no configured answer fits them.
  const textFields = page.locator(
    'textarea, input[type="text"]:not([readonly]), input[type="url"]:not([readonly]), input:not([type]):not([readonly])'
  );
  const fieldCount = await textFields.count().catch(() => 0);

  let position = -1;
  for (let i = 0; i < fieldCount; i++) {
    const field = textFields.nth(i);
    if (!(await field.isVisible().catch(() => false))) continue;
    position++;

    const currentVal = await field.inputValue().catch(() => '');
    if (currentVal.trim() !== '') continue;

    // Inspect field attributes & parent question container text
    const { name, heading } = await field
      .evaluate((el) => {
        const box = el.closest('[role="listitem"], .Qr7Oae, .M7eMe') || el.parentElement;
        return {
          name: el.getAttribute('name') || el.closest('[data-params]')?.getAttribute('data-params') || '',
          heading: box?.querySelector('[role="heading"], .M7eMe, .hoL3id, label, legend, span')?.innerText || box?.innerText || '',
        };
      })
      .catch(() => ({ name: '', heading: '' }));

    const key = pickFieldKey({ name, heading, pageNum, position }, Object.keys(answers));
    const answer = key && key in answers ? resolveAnswer(key, answers[key], journalSummaryText) : '';
    if (answer === '' || answer === null || answer === undefined) {
      console.warn(`  [WARN] No configured answer for field "${heading.slice(0, 60)}" (page ${pageNum}). Left blank.`);
      continue;
    }

    const answerText = String(answer);
    console.log(`  [FIELD] Filled [${key}] (Page ${pageNum}): "${answerText.substring(0, 45)}..."`);
    await field.fill(answerText);
  }
}

/**
 * Walks the loaded form page by page and submits it (unless dryRun).
 * Throws unless the final submission was verified, so callers can only record
 * success for a response Google actually accepted.
 *
 * @returns {Promise<'submitted'|'dry-run'>}
 */
export async function fillAndSubmitForm(page, { answers, journalSummaryText = '', dryRun = false, takeScreenshot = async () => {} }) {
  const submitButton = page
    .getByRole('button', { name: /^submit$|^submit response$|^send$|^bhejein$/i })
    .or(page.locator('div[role="button"]:has-text("Submit")'))
    .first();
  const nextButton = page
    .getByRole('button', { name: /^next$/i })
    .or(page.locator('div[role="button"]:has-text("Next")'))
    .first();

  let pageCount = 1;
  await fillCurrentPage(page, answers, journalSummaryText, pageCount);
  await takeScreenshot('initial');

  for (let remaining = MAX_PAGES; remaining > 0; remaining--) {
    await visibleWithin(submitButton.or(nextButton).first(), 5000);

    if (await submitButton.isVisible().catch(() => false)) {
      await takeScreenshot(`p${pageCount}-submit-page`);

      if (dryRun) {
        console.log('\n[INFO] [DRY RUN / FORM FILL DISABLED] Submit button located. Form was filled & validated successfully!');
        console.log('Skipping actual form submission as DRY_RUN / DISABLE_SUBMIT is enabled.\n');
        return 'dry-run';
      }

      console.log('Submit button found. Submitting form response...');
      await submitButton.click();
      await submitButton.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      await takeScreenshot('after-submit');

      await throwOnValidationErrors(page);
      const finalUrl = page.url();
      if (finalUrl.includes('accounts.google.com')) {
        throw new Error('Session expired during submission. Please run "npm run login" again.');
      }
      // Submit is gone and Google answered on /formResponse. The confirmation wording is form-specific,
      // and the phrase "recorded" also appears on the unsubmitted form, so text is not checked.
      if ((await submitButton.isVisible().catch(() => false)) || !finalUrl.includes('/formResponse')) {
        throw new Error(`Submission could not be verified (URL: ${finalUrl}). Check the form's responses before re-running.`);
      }
      return 'submitted';
    }

    if (!(await nextButton.isVisible().catch(() => false))) break;

    console.log(`  -> Clicking Next button (page ${pageCount})...`);
    await takeScreenshot(`p${pageCount}-before-next`);
    await page.waitForTimeout(500); // let overlays/tooltips disappear
    await nextButton.click({ force: true }); // force: bypass pointer-events blockers
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(1500);
    await throwOnValidationErrors(page);

    pageCount++;
    await fillCurrentPage(page, answers, journalSummaryText, pageCount);
  }

  throw new Error(
    `No Submit button reached after ${pageCount} page(s); nothing was submitted. The form may be closed, already answered, or changed layout.`
  );
}

async function runScheduledSubmission() {
  console.log('=== Automated Coursework Journal Submission ===\n');

  if (config.dryRun) {
    console.log('[WARN] [DRY RUN MODE ENABLED] Form submission is disabled via configuration (DRY_RUN / DISABLE_SUBMIT).\n');
  }

  // 1. Skip on Sundays
  if (isSunday(config.timezone)) {
    console.log(`[SKIP] Today is Sunday in ${config.timezone}. Skipping journal submission as scheduled.`);
    process.exit(0);
  }

  // 1a. Skip holidays / days off listed in SKIP_DATES
  if (isSkippedDate(config.skipDates, config.timezone)) {
    console.log(`[SKIP] ${getFormattedToday(config.timezone)} is listed in SKIP_DATES. Nothing submitted.`);
    process.exit(0);
  }

  // 1a-ii. A delayed scheduled run must not file for a day that has barely started
  if (process.env.GITHUB_EVENT_NAME === 'schedule' && getLocalHour(config.timezone) < EARLIEST_SCHEDULED_HOUR) {
    console.log(`::warning::Scheduled run arrived too late (now ${getFormattedToday(config.timezone)}, ${getLocalHour(config.timezone)}:00 in ${config.timezone}). Nothing submitted.`);
    process.exit(0);
  }

  // 1b. Skip if already submitted today (unless force/allowMultipleSubmissions is set; a dry run submits nothing)
  if (!config.dryRun && !config.allowMultipleSubmissions && hasAlreadySubmittedToday(config.timezone)) {
    const today = getFormattedToday(config.timezone);
    console.log(`[SKIP] Coursework journal has already been submitted today (${today}) in ${config.timezone}. Skipping duplicate execution.`);
    process.exit(0);
  }

  // 2. Validate session file existence
  const storagePath = path.resolve(config.storageStatePath);
  if (!fs.existsSync(storagePath)) {
    console.error(`[ERROR] Storage state file not found at '${storagePath}'.`);
    console.error('Please run "npm run login" locally to generate the session file.');
    process.exit(1);
  }

  // 3. Validate configuration
  if (!config.formId) {
    console.error('[ERROR] FORM_ID environment variable is missing.');
    process.exit(1);
  }

  // A day of leave reports only that: no work answers are prefilled or typed.
  const onLeave = isSkippedDate(config.leaveDates, config.timezone);
  const leaveAnswers = { [ATTENDANCE_ENTRY]: LEAVE_OPTION };

  // 4. Fetch Commit Activity & Generate Summary
  let journalSummaryText = '';
  if (onLeave) {
    console.log(`[INFO] ${getFormattedToday(config.timezone)} is listed in LEAVE_DATES. Reporting leave.`);
  } else if (config.githubOwner && config.githubRepo) {
    console.log(`Fetching commit summary for ${config.githubOwner}/${config.githubRepo}...`);
    journalSummaryText = await generateCommitSummary({
      owner: config.githubOwner,
      repo: config.githubRepo,
      username: config.githubUsername,
      token: config.commitReadToken,
      timezone: config.timezone,
    });
  } else {
    journalSummaryText = await generateCommitSummary({ timezone: config.timezone });
  }

  if (!onLeave) {
    console.log('\n--- Generated Journal Entry ---');
    console.log(journalSummaryText);
    console.log('-------------------------------\n');
  }

  // 5. Construct Pre-filled Form URL
  const prefilledUrl = buildPrefilledUrl({
    formId: config.formId,
    entryMap: onLeave ? leaveAnswers : config.entryMap,
    journalSummaryText,
    includeDefaults: !onLeave,
  });

  console.log(`Navigating to pre-filled Google Form URL...`);

  // 6. Launch Headless Browser with Restored Session
  const userAgent =
    process.env.CUSTOM_USER_AGENT ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });
  } catch (err) {
    if (err.message.includes('Executable doesn\'t exist') || err.message.includes('npx playwright install')) {
      console.error('\n[ERROR] Playwright Chromium browser binary is missing.');
      console.error('Please run "npx playwright install chromium" to install browser binaries.\n');
      process.exit(1);
    }
    throw err;
  }

  try {
    const context = await browser.newContext({
      storageState: storagePath,
      userAgent,
      viewport: { width: 1280, height: 800 },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    const page = await context.newPage();
    const response = await page.goto(prefilledUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (!response || response.status() >= 400) {
      throw new Error(`Failed to load Google Form. HTTP Status: ${response ? response.status() : 'Unknown'}`);
    }

    const currentUrl = page.url();

    // Check if redirected to Google Authentication page
    if (currentUrl.includes('accounts.google.com') || currentUrl.includes('ServiceLogin')) {
      throw new Error(
        'Authentication failed! redirected to Google sign-in page. Saved session in storageState.json is expired or invalid. Please run "npm run login" again to refresh session.'
      );
    }

    console.log('Page loaded. Processing form sections...');

    // Ensure screenshots directory exists
    const screenshotsDir = path.resolve('screenshots');
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
    let screenshotIndex = 0;

    async function takeScreenshot(label) {
      screenshotIndex++;
      const filename = path.join(screenshotsDir, `page-${String(screenshotIndex).padStart(2, '0')}-${label}.png`);
      await page
        .screenshot({ path: filename, fullPage: true })
        .then(() => console.log(`  [SCREENSHOT] Saved: ${filename}`))
        .catch((err) => console.warn(`  [WARN] Screenshot failed: ${err.message}`));
    }

    const result = await fillAndSubmitForm(page, {
      answers: onLeave ? leaveAnswers : normalizeEntryMap(config.entryMap),
      journalSummaryText,
      dryRun: config.dryRun,
      takeScreenshot,
    });

    if (result === 'submitted') {
      recordSubmissionSuccess(config.timezone);
      await takeScreenshot('confirmation');
      console.log('\n[SUCCESS] Journal entry submitted and verified.');
    }
    await context.storageState({ path: storagePath }).catch(() => {});
    console.log('Updated session storage state saved successfully.');
    await browser.close();
    process.exit(0);
  } catch (error) {
    console.error('\n[ERROR] SUBMISSION FAILED:', error.message);
    if (browser) {
      // Try to grab a failure screenshot if page is still open
      try {
        const pages = browser.contexts()?.[0]?.pages();
        if (pages && pages.length > 0) {
          const screenshotsDir = path.resolve('screenshots');
          if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir);
          await pages[0].screenshot({ path: path.join(screenshotsDir, 'error-state.png'), fullPage: true });
          console.error('  [SCREENSHOT] Error screenshot saved to screenshots/error-state.png');
        }
      } catch {}
      await browser.close();
    }
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runScheduledSubmission();
}
