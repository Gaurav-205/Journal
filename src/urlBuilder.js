/**
 * Builds a pre-filled Google Form URL.
 *
 * @param {Object} opts
 * @param {string} opts.formId - The Google Form ID (from form URL /d/e/FORM_ID/viewform or raw ID)
 * @param {Record<string, string>} [opts.answers] - Map of entry keys (e.g. 'entry.123456789') to field values
 * @returns {string} Fully constructed pre-filled Google Form URL
 */
export function buildPrefilledUrl({ formId, answers = {} }) {
  if (!formId || typeof formId !== 'string' || !formId.trim()) {
    throw new Error('Google Form ID (formId) is required to construct the pre-filled URL.');
  }

  const cleanedFormId = formId.trim().match(/\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/)?.[1] || formId.trim();
  const query = Object.entries(answers).map(([key, val]) => `${key}=${encodeURIComponent(val)}`);
  return [`https://docs.google.com/forms/d/e/${cleanedFormId}/viewform?usp=pp_url`, ...query].join('&');
}
