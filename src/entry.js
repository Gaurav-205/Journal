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
 * Loads entries/<date>.json. Returns null when no entry was written for that date.
 */
export function loadEntryAnswers(date, dir = 'entries') {
  const file = path.resolve(dir, `${date}.json`);
  if (!fs.existsSync(file)) return null;

  let entry;
  try {
    entry = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${file} is not valid JSON: ${err.message}`);
  }
  return entryToAnswers(entry);
}
