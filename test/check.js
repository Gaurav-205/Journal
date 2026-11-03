import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';
import { getMidnightISO, getFormattedToday, generateCommitSummary } from '../src/summarizer.js';
import { buildPrefilledUrl } from '../src/urlBuilder.js';
import { isSunday, isSkippedDate, getLocalHour, pickFieldKey, hasAlreadySubmittedToday, recordSubmissionSuccess, getSubmissionStatePath } from '../src/submit.js';
import { config, parseEntryMap, DEFAULT_ANSWERS } from '../src/config.js';

test('isSunday correctly detects Sunday vs non-Sunday', () => {
  const sundayDate = new Date('2026-08-09T12:00:00Z');
  const mondayDate = new Date('2026-08-10T12:00:00Z');

  assert.strictEqual(isSunday('UTC', sundayDate), true);
  assert.strictEqual(isSunday('UTC', mondayDate), false);
});

test('buildPrefilledUrl generates valid Google Form pre-filled URL', () => {
  const formId = '1FAIpQLSc_EXAMPLE_FORM_ID';
  const entryMap = { 'entry.123456789': 'Test response text' };

  const url = buildPrefilledUrl({
    formId,
    entryMap,
  });

  assert.ok(url.startsWith(`https://docs.google.com/forms/d/e/${formId}/viewform?usp=pp_url`));
  assert.ok(url.includes('entry.123456789=Test%20response%20text'));
});

test('buildPrefilledUrl handles raw form URL as formId', () => {
  const rawFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSc_EXTRACTED_ID/viewform';
  const entryMap = { '123456': 'Test text' };

  const url = buildPrefilledUrl({
    formId: rawFormUrl,
    entryMap,
  });

  assert.ok(url.startsWith('https://docs.google.com/forms/d/e/1FAIpQLSc_EXTRACTED_ID/viewform?usp=pp_url&entry.123456=Test%20text'));
});

test('buildPrefilledUrl maps multi-field ENTRY_MAP correctly', () => {
  const formId = 'TEST_ID';
  const entryMap = {
    'entry.187493348': 'Present',
    'entry.32162408': 'Key tasks done',
    'entry.199221807': 'None',
  };

  const url = buildPrefilledUrl({ formId, entryMap });
  assert.ok(url.includes('entry.187493348=Present'));
  assert.ok(url.includes('entry.32162408=Key%20tasks%20done'));
  assert.ok(url.includes('entry.199221807=None'));
});

test('getFormattedToday formats YYYY-MM-DD correctly', () => {
  const date = new Date('2026-08-10T10:00:00Z');
  const formatted = getFormattedToday('UTC', date);
  assert.strictEqual(formatted, '2026-08-10');
});

test('getMidnightISO returns correct UTC ISO for target timezone midnight', () => {
  const refDate = new Date('2026-08-10T10:00:00Z');
  const iso = getMidnightISO('Asia/Kolkata', refDate);
  assert.strictEqual(iso, '2026-08-09T18:30:00.000Z');
});

test('buildPrefilledUrl handles null, undefined, or empty entryMap safely', () => {
  const urlNull = buildPrefilledUrl({ formId: 'TEST_ID', entryMap: null });
  assert.ok(urlNull.includes('entry.187493348='));

  const urlEmptyObj = buildPrefilledUrl({ formId: 'TEST_ID', entryMap: {} });
  assert.ok(urlEmptyObj.includes('entry.187493348='));
});

test('generateCommitSummary returns default summary text gracefully when offline or unconfigured', async () => {
  const summary = await generateCommitSummary({});
  assert.ok(typeof summary === 'string');
  assert.ok(summary.length > 10);
});

test('config parses dryRun setting correctly', () => {
  assert.strictEqual(typeof config.dryRun, 'boolean');
});

test('isSunday handles invalid date objects gracefully', () => {
  assert.strictEqual(typeof isSunday('UTC', new Date('invalid')), 'boolean');
});

test('buildPrefilledUrl preserves falsy values like 0 and boolean false', () => {
  const url = buildPrefilledUrl({
    formId: 'TEST_ID',
    entryMap: { 'entry.100': 0, 'entry.200': false },
    journalSummaryText: 'Default text',
  });
  assert.ok(url.includes('entry.100=0'));
  assert.ok(url.includes('entry.200=false'));
});

test('buildPrefilledUrl handles single entry ID string entryMap', () => {
  const url = buildPrefilledUrl({
    formId: 'TEST_ID',
    entryMap: 'entry.999',
    journalSummaryText: 'Summary for single field',
  });
  assert.ok(url.includes('entry.999=Summary%20for%20single%20field'));
});

test('getMidnightISO and getFormattedToday handle invalid dates and fallback timezones gracefully', () => {
  const iso = getMidnightISO('Invalid/Timezone', new Date('invalid'));
  assert.ok(typeof iso === 'string' && iso.endsWith('Z'));

  const formatted = getFormattedToday('Invalid/Timezone', new Date('invalid'));
  assert.match(formatted, /^\d{4}-\d{2}-\d{2}$/);
});

test('recordSubmissionSuccess and hasAlreadySubmittedToday work correctly for date state tracking', () => {
  const statePath = getSubmissionStatePath();
  const backup = fs.existsSync(statePath) ? fs.readFileSync(statePath, 'utf8') : null;

  try {
    const testDate = new Date('2026-08-11T12:00:00Z');
    assert.strictEqual(hasAlreadySubmittedToday('UTC', testDate), false);

    recordSubmissionSuccess('UTC', testDate);
    assert.strictEqual(hasAlreadySubmittedToday('UTC', testDate), true);

    const otherDate = new Date('2026-08-12T12:00:00Z');
    assert.strictEqual(hasAlreadySubmittedToday('UTC', otherDate), false);
  } finally {
    if (backup !== null) {
      fs.writeFileSync(statePath, backup, 'utf8');
    } else if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }
  }
});

test('config parses allowMultipleSubmissions setting correctly', () => {
  assert.strictEqual(typeof config.allowMultipleSubmissions, 'boolean');
});

test('isSkippedDate matches only listed dates in the target timezone', () => {
  // 20:00 UTC on Nov 7 is already Nov 8 in Kolkata
  const date = new Date('2026-11-07T20:00:00Z');
  assert.strictEqual(isSkippedDate(['2026-11-08'], 'Asia/Kolkata', date), true);
  assert.strictEqual(isSkippedDate(['2026-11-08'], 'UTC', date), false);
  assert.strictEqual(isSkippedDate([], 'UTC', date), false);
});

test('pickFieldKey separates solved and unsolved challenge questions', () => {
  assert.strictEqual(pickFieldKey({ heading: 'Challenges you could not solve' }), 'entry.199221807');
  assert.strictEqual(pickFieldKey({ heading: 'What challenges did you solve?' }), 'entry.1874357572');
  assert.strictEqual(pickFieldKey({ heading: 'Plan for the next day' }), 'entry.1546753981');
  assert.strictEqual(pickFieldKey({ heading: 'Key tasks done today' }), 'entry.32162408');
});

test('pickFieldKey does not match words by substring', () => {
  assert.strictEqual(pickFieldKey({ heading: 'Notes on your network', pageNum: 1, position: 0 }), null);
  assert.strictEqual(pickFieldKey({ heading: 'Please explain', pageNum: 1, position: 0 }), null);
});

test('pickFieldKey matches exact entry IDs, including custom ones', () => {
  assert.strictEqual(pickFieldKey({ name: 'entry.32162408' }), 'entry.32162408');
  assert.strictEqual(pickFieldKey({ name: 'entry.555', pageNum: 1 }, ['entry.555']), 'entry.555');
  assert.strictEqual(pickFieldKey({ name: 'entry.5551', pageNum: 1 }, ['entry.555']), null);
});

test('pickFieldKey position fallback covers the four page 2 questions only', () => {
  assert.strictEqual(pickFieldKey({ pageNum: 2, position: 0 }), 'entry.32162408');
  assert.strictEqual(pickFieldKey({ pageNum: 2, position: 1 }), 'entry.1874357572');
  assert.strictEqual(pickFieldKey({ pageNum: 2, position: 2 }), 'entry.199221807');
  assert.strictEqual(pickFieldKey({ pageNum: 2, position: 3 }), 'entry.1546753981');
  assert.strictEqual(pickFieldKey({ pageNum: 2, position: 4 }), null);
  assert.strictEqual(pickFieldKey({ pageNum: 3, position: 0 }), null);
});

test('pickFieldKey maps the real form question wording', () => {
  assert.strictEqual(pickFieldKey({ heading: 'What were your key tasks for the day? *' }), 'entry.32162408');
  assert.strictEqual(pickFieldKey({ heading: 'What challenges/problems did you solve today? *' }), 'entry.1874357572');
  assert.strictEqual(pickFieldKey({ heading: 'What challenges/problems you were NOT able to solve today and are planning to solve in upcoming days? *' }), 'entry.199221807');
  assert.strictEqual(pickFieldKey({ heading: 'What is your plan for the next day of Simulated Work? *' }), 'entry.1546753981');
});

test('getLocalHour reads the hour in the target timezone', () => {
  assert.strictEqual(getLocalHour('Asia/Kolkata', new Date('2026-11-02T20:25:00Z')), 1);
  assert.strictEqual(getLocalHour('Asia/Kolkata', new Date('2026-11-03T18:29:00Z')), 23);
  assert.strictEqual(getLocalHour('UTC', new Date('2026-11-03T00:10:00Z')), 0);
  assert.strictEqual(getLocalHour('Invalid/Timezone', new Date('2026-11-02T20:25:00Z')), 1);
});

test('getMidnightISO is correct on DST change days', () => {
  // NZDT (+13) ends at 03:00 on 2026-04-05, so that midnight is still +13
  assert.strictEqual(getMidnightISO('Pacific/Auckland', new Date('2026-04-05T10:00:00Z')), '2026-04-04T11:00:00.000Z');
  assert.strictEqual(getMidnightISO('America/New_York', new Date('2026-03-08T15:00:00Z')), '2026-03-08T05:00:00.000Z');
  assert.strictEqual(getMidnightISO('America/New_York', new Date('2026-11-01T15:00:00Z')), '2026-11-01T04:00:00.000Z');
});

test('buildPrefilledUrl sends only given entries when includeDefaults is false', () => {
  const url = buildPrefilledUrl({ formId: 'TEST_ID', entryMap: { 'entry.187493348': 'Leave' }, includeDefaults: false });
  assert.ok(url.includes('entry.187493348=Leave'));
  assert.ok(!url.includes('entry.32162408'));
});

test('generateCommitSummary drops merge commits and trailing periods', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => [
      { parents: [{}, {}], commit: { message: 'Merge branch main' } },
      { parents: [{}], commit: { message: 'Fix login.\n\nbody' } },
    ],
  }));
  const summary = await generateCommitSummary({ owner: 'o', repo: 'r' });
  assert.strictEqual(summary, 'Worked on daily tasks: Fix login. Tested changes and updated codebase.');
});

test('parseEntryMap handles object, single ID and empty values', () => {
  assert.strictEqual(parseEntryMap('{"123":"x"}')['entry.123'], 'x');
  assert.strictEqual(parseEntryMap("'{\"entry.1\":\"y\"}'")['entry.1'], 'y');
  assert.strictEqual(parseEntryMap('123'), 'entry.123');
  assert.strictEqual(parseEntryMap('"entry.123"'), 'entry.123');
  assert.strictEqual(parseEntryMap(''), DEFAULT_ANSWERS);
});

test('parseEntryMap rejects malformed values instead of using defaults', () => {
  assert.throws(() => parseEntryMap('{not json'), /ENTRY_MAP/);
  assert.throws(() => parseEntryMap('[1,2]'), /ENTRY_MAP/);
  assert.throws(() => parseEntryMap('{"a(b":"x"}'), /ENTRY_MAP/);
});
