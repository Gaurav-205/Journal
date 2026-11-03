// Drives fillAndSubmitForm against a local fake form. Every request is intercepted,
// so these tests can never reach a real Google Form.
import assert from 'node:assert';
import test, { after } from 'node:test';
import { chromium } from 'playwright';
import { fillAndSubmitForm } from '../src/submit.js';
import { DEFAULT_ANSWERS } from '../src/config.js';

const FORM_URL = 'https://docs.google.com/forms/d/e/TEST/viewform';
const RESPONSE_URL = 'https://docs.google.com/forms/d/e/TEST/formResponse';
const ATTENDANCE = DEFAULT_ANSWERS['entry.187493348'];
const LEAVE = 'It was a working day, but I was on leave or absent';

const question = (title, control) =>
  `<div role="listitem"><div role="heading">${title}</div>${control}<div role="alert" class="err"></div></div>`;
const radio = (label) =>
  `<div role="radio" tabindex="0" aria-label="${label}" aria-checked="false" onclick="this.setAttribute('aria-checked','true')">${label}</div>`;

// Blocks navigation and shows a question-level alert while a required field is unanswered.
const SCRIPT = `<script>
function go(url) {
  let ok = true;
  document.querySelectorAll('[role=listitem]').forEach((q) => {
    const answered = [...q.querySelectorAll('textarea')].every((t) => t.value.trim()) &&
      (!q.querySelector('[role=radio]') || q.querySelector('[role=radio][aria-checked=true]'));
    if (!answered) { q.querySelector('.err').textContent = 'This is a required question'; ok = false; }
  });
  if (!ok) return;
  document.title = 'submitted-values';
  window.__values = [...document.querySelectorAll('textarea')].map((t) => t.value);
  fetch('/record', { method: 'POST', body: JSON.stringify({ url, values: window.__values, radio: document.querySelector('[role=radio][aria-checked=true]')?.getAttribute('aria-label') }) })
    .then(() => { location.href = url; });
}
</script>`;
const page_ = (body, button, target) =>
  `<html><body><form>${body}</form><div role="button" onclick="go('${target}')">${button}</div>${SCRIPT}</body></html>`;

// Same layout and wording as the live form: attendance, then four questions on one page,
// then a closing page holding Submit. Every page says the email "will be recorded".
const header = '<div>Your email address will be recorded when you submit this form</div>';
const options = ['It was a campus holiday', ATTENDANCE, LEAVE].map(radio).join('');
const pages = {
  [FORM_URL]: page_(header + question('A confirmation to start with - was today a working day for you?', options), 'Next', `${RESPONSE_URL}?p=2`),
  [`${RESPONSE_URL}?p=2`]: page_(
    header +
      question('What were your key tasks for the day? *', '<textarea></textarea>') +
      question('What challenges/problems did you solve today? *', '<textarea></textarea>') +
      question('What challenges/problems you were NOT able to solve today and are planning to solve in upcoming days? *', '<textarea></textarea>') +
      question('What is your plan for the next day of Simulated Work? *', '<textarea></textarea>'),
    'Next',
    `${RESPONSE_URL}?p=3`
  ),
  [`${RESPONSE_URL}?p=3`]: page_(`${header}<div>Thank you for filling today's journal</div>`, 'Submit', `${RESPONSE_URL}?done=1`),
  [`${RESPONSE_URL}?done=1`]: '<html><body>Your response has been recorded. <a href="#">Submit another response</a></body></html>',
};

let browser;
try {
  browser = await chromium.launch();
} catch {
  browser = null;
}
const skip = browser ? false : 'Chromium not installed (run: npx playwright install chromium)';

async function open(routes = pages) {
  const context = await browser.newContext();
  const records = [];
  await context.route('**/*', (route) => {
    const req = route.request();
    if (req.url().endsWith('/record')) {
      records.push(JSON.parse(req.postData()));
      return route.fulfill({ status: 204 });
    }
    return routes[req.url()] ? route.fulfill({ contentType: 'text/html', body: routes[req.url()] }) : route.abort();
  });
  const page = await context.newPage();
  await page.goto(FORM_URL);
  return { page, records };
}

after(async () => {
  await browser?.close();
});

test('fills every page with the right answer and verifies submission', { skip }, async () => {
  const { page, records } = await open();
  const result = await fillAndSubmitForm(page, { answers: DEFAULT_ANSWERS, journalSummaryText: 'Commit summary' });

  assert.strictEqual(result, 'submitted');
  assert.strictEqual(records.at(0).radio, ATTENDANCE, 'must pick the exact option, not the first containing "working"');
  assert.deepStrictEqual(records.at(1).values, [
    'Commit summary',
    DEFAULT_ANSWERS['entry.1874357572'],
    DEFAULT_ANSWERS['entry.199221807'],
    DEFAULT_ANSWERS['entry.1546753981'],
  ]);
  assert.ok(records.at(2).url.includes('done=1'));
});

test('custom Key Tasks answer is not overwritten by the summary', { skip }, async () => {
  const { page, records } = await open();
  const answers = { ...DEFAULT_ANSWERS, 'entry.32162408': 'My real tasks' };
  await fillAndSubmitForm(page, { answers, journalSummaryText: 'Commit summary' });
  assert.strictEqual(records.at(1).values[0], 'My real tasks');
});

test('dry run never clicks Submit', { skip }, async () => {
  const { page, records } = await open();
  const result = await fillAndSubmitForm(page, { answers: DEFAULT_ANSWERS, dryRun: true });
  assert.strictEqual(result, 'dry-run');
  assert.ok(!records.some((r) => r.url.includes('done=1')));
});

test('reports a validation error instead of looping when an option does not exist', { skip }, async () => {
  const { page } = await open();
  const answers = { ...DEFAULT_ANSWERS, 'entry.187493348': 'No such option' };
  await assert.rejects(fillAndSubmitForm(page, { answers }), /required question/);
});

test('a leave day selects the leave option and types no work answers', { skip }, async () => {
  const leavePages = { ...pages, [FORM_URL]: pages[FORM_URL].replace(`${RESPONSE_URL}?p=2`, `${RESPONSE_URL}?p=3`) };
  const { page, records } = await open(leavePages);
  const result = await fillAndSubmitForm(page, { answers: { 'entry.187493348': LEAVE } });
  assert.strictEqual(result, 'submitted');
  assert.strictEqual(records.at(0).radio, LEAVE);

  // If the form shows work questions anyway, they stay blank and the run fails loudly.
  const second = await open();
  await assert.rejects(fillAndSubmitForm(second.page, { answers: { 'entry.187493348': LEAVE } }), /required question/);
});

test('throws when the form has no Submit button, e.g. closed form', { skip }, async () => {
  const { page } = await open({ [FORM_URL]: '<html><body>This form is no longer accepting responses. Your response was recorded.</body></html>' });
  await assert.rejects(fillAndSubmitForm(page, { answers: DEFAULT_ANSWERS }), /nothing was submitted/);
});

test('throws when clicking Submit leaves the form in place', { skip }, async () => {
  const stuck = `<html><body>Your email address will be recorded when you submit this form<div role="button">Submit</div></body></html>`;
  const { page } = await open({ [FORM_URL]: stuck });
  await assert.rejects(fillAndSubmitForm(page, { answers: DEFAULT_ANSWERS }), /could not be verified/);
});
