import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { authEnv } from "./env";

// This Supabase CLI stack signs session JWTs asymmetrically (ES256) and publishes the public
// key via JWKS rather than a shared HS256 secret — createRemoteJWKSet caches/refreshes the key
// set itself, so this only needs to be built once per process.
const jwks = createRemoteJWKSet(new URL(`${authEnv.authUrl}/.well-known/jwks.json`));

export interface RaaoJwtPayload {
  sub: string;
  email?: string;
  exp: number;
  /** Fixed Postgres/PostgREST role ("authenticated") — NOT the app's admin/personnel role. */
  role?: string;
  /**
   * Authenticator Assurance Level. "aal1" = password only, "aal2" = a TOTP factor was verified
   * for this session. Set by GoTrue and preserved across refreshes; checked in dal.ts when the
   * Two-Factor Authentication setting is on.
   */
  aal?: string;
  app_metadata?: { role?: string };
}

/**
 * Verifies the GoTrue-issued JWT signature before trusting any claim in it.
 * A cookie value is client-controlled input — without signature verification,
 * a forged cookie could claim any role. Returns null on any failure
 * (expired, bad signature, malformed) rather than throwing.
 */
export async function verifyAccessToken(token: string): Promise<RaaoJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwks, { algorithms: ["ES256"] });
    return payload as unknown as RaaoJwtPayload;
  } catch {
    return null;
  }
}
