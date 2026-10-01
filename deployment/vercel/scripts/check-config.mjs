import fs from 'node:fs';
const required = ['PUBLIC_APP_ORIGIN', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}. Configure it before deployment.`);
const origin = new URL(process.env.PUBLIC_APP_ORIGIN);
if (origin.protocol !== 'https:' || origin.origin !== process.env.PUBLIC_APP_ORIGIN) throw new Error('PUBLIC_APP_ORIGIN must be an exact HTTPS origin.');
if (process.env.SUPABASE_SECRET_KEY || process.env.GEMINI_API_KEY) throw new Error('Backend secrets must not be configured in this entry project.');
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/entry.txt', 'FieldProof Vercel entry point\n');
console.log('Entry configuration validated. No backend secrets needed.');
