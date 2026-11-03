import dotenv from 'dotenv';
dotenv.config();

export const DEFAULT_FORM_ID = '1FAIpQLSc8RRUAG8n8nPB9dm21m_MxwHQ-JuDnEj7GnvwEkWXykkKFuQ';

export const config = {
  formId: (process.env.FORM_ID || DEFAULT_FORM_ID).trim(),

  storageStatePath: process.env.STORAGE_STATE_PATH || 'storageState.json',
  timezone: process.env.TIMEZONE || 'Asia/Kolkata',

  dryRun:
    ['true', '1', 'yes'].includes(String(process.env.DRY_RUN || '').toLowerCase()) ||
    ['true', '1', 'yes'].includes(String(process.env.DISABLE_SUBMIT || '').toLowerCase()) ||
    process.argv.includes('--dry-run') ||
    process.argv.includes('--disable-submit'),

  allowMultipleSubmissions:
    ['true', '1', 'yes'].includes(String(process.env.ALLOW_MULTIPLE_SUBMISSIONS || '').toLowerCase()) ||
    process.argv.includes('--force') ||
    process.argv.includes('--allow-multiple'),
};
