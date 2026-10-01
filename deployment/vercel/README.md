# FieldProof on Vercel

This is a hybrid entry deployment, not a migration of D1/R2 to Vercel. Vercel proxies the working application and retains a local OAuth callback so sign-in returns to its public address. The Cloudflare backend remains required. The upstream address remains visible in public configuration; this is branding, not concealment of development tools.

Import `SidharthMonangi/fieldproof` into your own free Hobby account with **Root Directory `deployment/vercel`**, Framework **Other**, Build Command **npm run build**, and Output Directory **public**. Never import the repository root as an ordinary Next.js project: its main build targets Cloudflare.

Configure only `PUBLIC_APP_ORIGIN` (the actual production HTTPS Vercel origin, with no trailing slash), `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY`. No Gemini, Supabase admin or database credential belongs in this project.

Before enabling use, publish the backend's exact `PUBLIC_APP_ORIGIN` allowlist, add the Vercel `/auth/callback` URL to Supabase, and set its Site URL to the verified new origin. Keep the old callback during migration. Preview domains are deliberately not authorized.

Verify sign-in, session refresh, cross-site write rejection, cases, uploads/downloads at existing size limits, backups, AI answers and offline reconnection on the new origin. Device queues belong to their browser origin: sync/export old-origin drafts before switching. Update the uptime workflow and reviewer links only after these checks pass. No working Vercel URL is claimed until deployment succeeds.
