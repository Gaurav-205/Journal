import { chromium } from 'playwright';
import readline from 'readline';
import path from 'path';
import fs from 'fs';
import { config } from '../src/config.js';

async function promptEnter(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    });
  });
}

async function runInteractiveLogin() {
  console.log('=== Automated Coursework Journal - One-Time Google Interactive Login ===\n');

  const formId = config.formId;
  let targetUrl = 'https://accounts.google.com/';

  if (formId) {
    const cleanedFormId = formId.match(/\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/)?.[1] || formId;
    targetUrl = `https://docs.google.com/forms/d/e/${cleanedFormId}/viewform`;
  }

  console.log(`Launching visible browser window...`);
  console.log(`Navigating to: ${targetUrl}\n`);

  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });
  } catch (err) {
    if (err.message.includes('Executable doesn\'t exist') || err.message.includes('npx playwright install')) {
      console.error('\n[ERROR] Playwright Chromium browser binary is missing on this machine.');
      console.error('Please run the following command to download Chromium:\n');
      console.error('    npx playwright install chromium\n');
      process.exit(1);
    }
    throw err;
  }

  const userAgent =
    process.env.CUSTOM_USER_AGENT ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

  const context = await browser.newContext({
    userAgent,
    viewport: { width: 1280, height: 800 },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  const page = await context.newPage();

  await page.goto(targetUrl);

  console.log('----------------------------------------------------------------------');
  console.log('ACTION REQUIRED:');
  console.log('1. Sign in to your verified coursework Google account in the browser window.');
  console.log('2. Ensure you can view the full form with your verified email displayed.');
  console.log('----------------------------------------------------------------------\n');

  await promptEnter('--> Press [ENTER] in this terminal AFTER you have successfully signed in & loaded the form: ');

  // Scan form DOM for entry IDs & field names
  console.log('\nScanning form for entry IDs...');
  const detectedFields = await page.evaluate(() => {
    const fields = [];
    const seen = new Set();

    // 1. Direct input/textarea elements
    const inputs = document.querySelectorAll('[name^="entry."]');
    inputs.forEach((el) => {
      const name = el.getAttribute('name');
      if (name && !seen.has(name)) {
        seen.add(name);
        const container = el.closest('[role="listitem"]') || el.closest('.geSsid') || el.closest('.QrRbSc');
        const titleEl = container ? container.querySelector('[role="heading"], .M7eMe, .ss-q-title') : null;
        fields.push({
          entryId: name,
          title: titleEl ? titleEl.textContent.replace(/\s*\*$/, '').trim() : 'Form Field',
          type: el.tagName.toLowerCase(),
        });
      }
    });

    // 2. Data params scanner for complex inputs (radios, dropdowns, etc.)
    const items = document.querySelectorAll('[data-params]');
    items.forEach((item) => {
      const paramsStr = item.getAttribute('data-params');
      if (paramsStr) {
        const matches = paramsStr.match(/\[(\d{7,12}),/g);
        if (matches) {
          matches.forEach((m) => {
            const num = m.match(/\d+/)?.[0];
            if (num) {
              const entryId = `entry.${num}`;
              if (!seen.has(entryId)) {
                seen.add(entryId);
                const titleEl = item.querySelector('[role="heading"], .M7eMe, .ss-q-title');
                fields.push({
                  entryId,
                  title: titleEl ? titleEl.textContent.replace(/\s*\*$/, '').trim() : 'Form Question',
                  type: 'data-params',
                });
              }
            }
          });
        }
      }
    });

    return fields;
  });

  if (detectedFields.length > 0) {
    console.log('\n[INFO] Detected Google Form Fields:');
    detectedFields.forEach((f, idx) => {
      console.log(`   [${idx + 1}] ID: ${f.entryId}  | Question: "${f.title}"`);
    });
  } else {
    console.log('\n[WARN] Could not automatically detect entry IDs from DOM. You can find them via "Get pre-filled link".');
  }

  // Save session state
  const storagePath = path.resolve(config.storageStatePath || 'storageState.json');
  const storageDir = path.dirname(storagePath);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  await context.storageState({ path: storagePath });

  console.log(`\n[SUCCESS] Session storage state successfully saved to: ${storagePath}`);

  await browser.close();

  console.log('\n============================== IMPORTANT ==============================');
  console.log('1. DO NOT commit storageState.json to git or source control!');
  console.log('2. DO NOT execute this interactive login script inside CI / GitHub Actions.');
  console.log('3. Encode storageState.json to base64 and store it as a GitHub secret:');
  console.log('   STORAGE_STATE_BASE64');
  console.log('=======================================================================\n');
}

runInteractiveLogin().catch((err) => {
  console.error('\n[ERROR] Login script error:', err.message || err);
  process.exit(1);
});
