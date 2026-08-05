const USERNAME_EMAIL_DOMAIN = "raao.local";

/**
 * GoTrue only authenticates by email. Usernames typed on the login screen are
 * mapped to a synthetic email under this fixed local domain. Keep this in sync
 * with the emails hardcoded in db/seed/seed-users.sql — SQL can't import this.
 */
export function usernameToEmail(username: string): string {
  const normalized = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `${normalized}@${USERNAME_EMAIL_DOMAIN}`;
}
