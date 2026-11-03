import { DEFAULT_ANSWERS } from './config.js';

/**
 * Expands an entry map (object, single entry ID string, or empty) into the full answer map.
 *
 * @param {string|Record<string, string>|null} [entryMap]
 * @returns {Record<string, string>}
 */
export function normalizeEntryMap(entryMap) {
  if (typeof entryMap === 'string') {
    const key = entryMap.startsWith('entry.') ? entryMap : `entry.${entryMap}`;
    return { ...DEFAULT_ANSWERS, [key]: 'JOURNAL_TEXT' };
  }
  if (typeof entryMap === 'object' && entryMap !== null) {
    return { ...DEFAULT_ANSWERS, ...entryMap };
  }
  return DEFAULT_ANSWERS;
}

/**
 * Resolves the text to send for one entry: expands the JOURNAL_TEXT placeholder, lets the
 * journal summary replace the stock Key Tasks answer, and keeps any custom answer as written.
 */
export function resolveAnswer(entryKey, val, journalSummaryText = '') {
  if (val === 'JOURNAL_TEXT' || (entryKey === 'entry.32162408' && journalSummaryText && (!val || val === DEFAULT_ANSWERS[entryKey]))) {
    return journalSummaryText;
  }
  if (val === null || val === undefined || val === '') {
    return DEFAULT_ANSWERS[entryKey] || journalSummaryText;
  }
  return val;
}

/**
 * Builds a pre-filled Google Form URL with pre-populated entry field parameters.
 *
 * @param {Object} opts
 * @param {string} opts.formId - The Google Form ID (from form URL /d/e/FORM_ID/viewform or raw ID)
 * @param {string|Record<string, string>} [opts.entryMap] - Map of entry keys (e.g. 'entry.123456789') to field values, or a single entry ID string.
 * @param {string} [opts.journalSummaryText] - Summary text to populate if entryMap maps 'JOURNAL_TEXT', empty value, or if entryMap is a single entry string.
 * @param {boolean} [opts.includeDefaults=true] - When false, only entries in an object entryMap are prefilled.
 * @returns {string} Fully constructed pre-filled Google Form URL
 */
export function buildPrefilledUrl({ formId, entryMap, journalSummaryText = '', includeDefaults = true }) {
  if (!formId || typeof formId !== 'string' || !formId.trim()) {
    throw new Error('Google Form ID (formId) is required to construct the pre-filled URL.');
  }

  let cleanedFormId = formId.trim();
  const urlMatch = cleanedFormId.match(/\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
  if (urlMatch) {
    cleanedFormId = urlMatch[1];
  }

  const baseUrl = `https://docs.google.com/forms/d/e/${cleanedFormId}/viewform?usp=pp_url`;
  const queryParams = [];
  for (const [key, val] of Object.entries(includeDefaults ? normalizeEntryMap(entryMap) : entryMap)) {
    const entryKey = key.startsWith('entry.') ? key : `entry.${key}`;
    queryParams.push(`${entryKey}=${encodeURIComponent(String(resolveAnswer(entryKey, val, journalSummaryText)))}`);
  }

  if (queryParams.length === 0) {
    throw new Error('At least one entry ID must be provided in entryMap to build pre-filled URL.');
  }

  return `${baseUrl}&${queryParams.join('&')}`;
}
