/**
 * Diagnostic script — loads the form with your saved session and dumps
 * the HTML around the Email checkbox so we know the exact selectors to use.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { config } from '../src/config.js';
import { buildPrefilledUrl } from '../src/urlBuilder.js';

const storagePath = path.resolve(config.storageStatePath);
if (!fs.existsSync(storagePath)) {
  console.error('storageState.json not found. Run npm run login first.');
  process.exit(1);
}

const prefilledUrl = buildPrefilledUrl({
  formId: config.formId,
  answers: { 'entry.32162408': 'Diagnostic run - test text' },
});

let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
} catch (err) {
  if (err.message.includes('Executable doesn\'t exist') || err.message.includes('npx playwright install')) {
    console.error('\n[ERROR] Playwright Chromium browser binary is missing.');
    console.error('Please run "npx playwright install chromium" to install browser binaries.\n');
    process.exit(1);
  }
  throw err;
}
try {
  const context = await browser.newContext({ storageState: storagePath });
  const page = await context.newPage();

  await page.goto(prefilledUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Dump the HTML of the Email question block
  const emailBlockHtml = await page.evaluate(() => {
    const allElements = Array.from(document.querySelectorAll('[role="listitem"], [role="region"], .Qr7Oae, .M7eMe, label, div'));
    for (const el of allElements) {
      const text = (el.textContent || '').toLowerCase();
      if (text.includes('email') && (text.includes('record') || text.includes('switch account') || text.includes('shared'))) {
        return el.outerHTML.substring(0, 3000);
      }
    }
    return document.body.innerText.substring(0, 2000);
  });

  console.log('\n=== EMAIL BLOCK HTML ===\n');
  console.log(emailBlockHtml);
  console.log('\n========================\n');

  // Also list ALL checkboxes and their roles/classes
  const checkboxInfo = await page.evaluate(() => {
    const results = [];

    // Real checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach((el, i) => {
      results.push({ index: i, tag: 'input[checkbox]', id: el.id, name: el.name, class: el.className, checked: el.checked });
    });

    // ARIA checkboxes
    document.querySelectorAll('[role="checkbox"]').forEach((el, i) => {
      results.push({ index: i, tag: 'div[role=checkbox]', ariaChecked: el.getAttribute('aria-checked'), class: el.className, text: el.textContent?.substring(0, 80) });
    });

    return results;
  });

  console.log('=== CHECKBOX ELEMENTS FOUND ===');
  console.log(JSON.stringify(checkboxInfo, null, 2));
} finally {
  await browser.close();
}
