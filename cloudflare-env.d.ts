declare namespace Cloudflare {
  interface Env {
    EMAIL_SIGNIN_ENABLED?: string;
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
    SUPABASE_SECRET_KEY?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
  }
}
