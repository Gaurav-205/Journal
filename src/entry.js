import fs from 'fs';
import path from 'path';

export const ATTENDANCE_ENTRY = 'entry.187493348';

// Form entry ID for each text answer in an entry file.
const QUESTION_ENTRIES = {
  tasks: 'entry.32162408',
  solved: 'entry.1874357572',
  unsolved: 'entry.199221807',
  plan: 'entry.1546753981',
};
export const QUESTION_KEYS = Object.values(QUESTION_ENTRIES);

const STATUS_OPTIONS = {
  present: 'It was a working day, and I was present',
  leave: 'It was a working day, but I was on leave or absent',
};

export const DEFAULT_ENTRY = {
  status: 'present',
  tasks:
    'Worked on assigned tasks as per the daily plan, including reviewing requirements, implementing planned features/modules, and testing the changes made. Coordinated with the team wherever required and updated task status accordingly.',
  solved:
    'Encountered a few technical issues during implementation/testing, which were resolved by debugging the code, referring to documentation, and testing alternate approaches. Also resolved minor doubts regarding task requirements through self-analysis and review of existing resources.',
  unsolved:
    'A few issues/tasks are still in progress and could not be fully completed today due to their complexity or dependency on further testing/review. These will be prioritized and worked on in the coming days.',
  plan:
    'Continue working on the pending tasks from today, complete testing/review of the current module, and move forward with the next set of planned tasks as per the schedule.',
};

/**
 * Formats a date as YYYY-MM-DD in the target timezone.
 */
export function getFormattedToday(timezone = 'Asia/Kolkata', referenceDate = new Date()) {
  const refDate = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date();
  let tz = timezone;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
  } catch {
    tz = 'Asia/Kolkata';
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(refDate);
}

/**
 * Turns a written entry into form answers. Throws on anything incomplete, so a
 * half-written entry is never filed.
 */
export function entryToAnswers(entry) {
  const option = STATUS_OPTIONS[entry?.status];
  if (!option) {
    throw new Error(`Entry status must be one of: ${Object.keys(STATUS_OPTIONS).join(', ')}.`);
  }
  const answers = { [ATTENDANCE_ENTRY]: option };
  if (entry.status === 'leave') return answers;

  for (const [field, key] of Object.entries(QUESTION_ENTRIES)) {
    if (typeof entry[field] !== 'string' || !entry[field].trim()) {
      throw new Error(`Entry field "${field}" must be filled in.`);
    }
    answers[key] = entry[field];
  }
  return answers;
}

/**
 * Loads entries/<date>.json if present, then entries/default.json, or falls back
 * to DEFAULT_ENTRY. Pass fallback=false to return null when no file exists.
 */
export function loadEntryAnswers(date, dir = 'entries', fallback = true) {
  const dateFile = path.resolve(dir, `${date}.json`);
  if (fs.existsSync(dateFile)) {
    let entry;
    try {
      entry = JSON.parse(fs.readFileSync(dateFile, 'utf8'));
    } catch (err) {
      throw new Error(`${dateFile} is not valid JSON: ${err.message}`);
    }
    return entryToAnswers(entry);
  }

  const defaultFile = path.resolve(dir, 'default.json');
  if (fs.existsSync(defaultFile)) {
    let entry;
    try {
      entry = JSON.parse(fs.readFileSync(defaultFile, 'utf8'));
    } catch (err) {
      throw new Error(`${defaultFile} is not valid JSON: ${err.message}`);
    }
    return entryToAnswers(entry);
  }

  if (!fallback) return null;
  return entryToAnswers(DEFAULT_ENTRY);
}
