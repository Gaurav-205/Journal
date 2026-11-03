import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getFormattedToday, entryToAnswers, loadEntryAnswers, ATTENDANCE_ENTRY } from '../src/entry.js';
import { buildPrefilledUrl } from '../src/urlBuilder.js';
import { pickFieldKey, hasAlreadySubmittedToday, recordSubmissionSuccess, getSubmissionStatePath } from '../src/submit.js';
import { config } from '../src/config.js';

test('getFormattedToday formats YYYY-MM-DD correctly', () => {
  const date = new Date('2026-08-10T10:00:00Z');
  const formatted = getFormattedToday('UTC', date);
  assert.strictEqual(formatted, '2026-08-10');
});

test('config parses dryRun setting correctly', () => {
  assert.strictEqual(typeof config.dryRun, 'boolean');
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

test('buildPrefilledUrl encodes answers and accepts a raw form URL', () => {
  const url = buildPrefilledUrl({
    formId: 'https://docs.google.com/forms/d/e/ABC_1/viewform',
    answers: { 'entry.123': 'Test & text' },
  });
  assert.strictEqual(url, 'https://docs.google.com/forms/d/e/ABC_1/viewform?usp=pp_url&entry.123=Test%20%26%20text');
});

test('buildPrefilledUrl requires a form ID', () => {
  assert.throws(() => buildPrefilledUrl({ formId: ' ' }), /formId/);
});

const fullEntry = { status: 'present', tasks: 'a', solved: 'b', unsolved: 'c', plan: 'd' };

test('entryToAnswers maps a present entry to all form fields', () => {
  assert.deepStrictEqual(entryToAnswers(fullEntry), {
    [ATTENDANCE_ENTRY]: 'It was a working day, and I was present',
    'entry.32162408': 'a',
    'entry.1874357572': 'b',
    'entry.199221807': 'c',
    'entry.1546753981': 'd',
  });
});

test('entryToAnswers reports leave with no work answers', () => {
  assert.deepStrictEqual(entryToAnswers({ status: 'leave', tasks: 'ignored' }), {
    [ATTENDANCE_ENTRY]: 'It was a working day, but I was on leave or absent',
  });
});

test('entryToAnswers rejects incomplete entries and unknown statuses', () => {
  assert.throws(() => entryToAnswers({ ...fullEntry, plan: '  ' }), /plan/);
  assert.throws(() => entryToAnswers({ status: 'present', tasks: 'a' }), /solved/);
  assert.throws(() => entryToAnswers({ status: 'holiday' }), /status/);
  assert.throws(() => entryToAnswers(null), /status/);
});

test('loadEntryAnswers returns null with no file and fails on bad JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'entries-'));
  try {
    assert.strictEqual(loadEntryAnswers('2026-11-04', dir), null);

    fs.writeFileSync(path.join(dir, '2026-11-04.json'), JSON.stringify(fullEntry));
    assert.strictEqual(loadEntryAnswers('2026-11-04', dir)['entry.32162408'], 'a');

    fs.writeFileSync(path.join(dir, '2026-11-05.json'), '{oops');
    assert.throws(() => loadEntryAnswers('2026-11-05', dir), /not valid JSON/);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
