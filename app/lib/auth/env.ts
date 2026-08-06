import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const supabaseUrl = required("SUPABASE_URL").replace(/\/$/, "");

export const authEnv = {
  supabaseUrl,
  // Kong gateway auth route. Every GoTrue endpoint is reached through here, not directly.
  authUrl: `${supabaseUrl}/auth/v1`,
  // Kong gateway PostgREST route, for the app's own `public` schema tables.
  restUrl: `${supabaseUrl}/rest/v1`,
  anonKey: required("SUPABASE_ANON_KEY"),
  cookieSecure: process.env.COOKIE_SECURE === "true",
  idleTimeoutMinutes: Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES ?? "15"),
};
