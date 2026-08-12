"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { usernameToEmail } from "./username";
import { signInWithPassword, type GoTrueTokenResponse } from "./gotrue";
import {
  clearPendingSession,
  createPendingSession,
  createSession,
  endSession,
  getPendingTokens,
  setSessionIdCookie,
} from "./session";
import { verifyAccessToken } from "./jwt";
import { challengeFactor, listFactors, verifiedTotpFactor, verifyFactor } from "./mfa";
import { getPasswordState, isPasswordChangeRequired } from "./password-state";
import { recordAuditEvent, recordSessionStart } from "@/app/lib/tracking/tracking";
import { isModuleEnabledForPersonnel } from "@/app/lib/permissions/permissions";
import { getSecuritySettings, type SecuritySettings } from "@/app/lib/config/security";
import { getLockoutRemainingMinutes, recordFailedLoginAttempt, resetLoginAttempts } from "./login-attempts";
import type { AppRole } from "./gotrue";

export interface LoginFormState {
  error?: string;
}

const INVALID_CREDENTIALS_MESSAGE = "Invalid username or password.";

/**
 * The one place a session is created, shared by the password-only path and the OTP path so the
 * tracking, audit and password-expiry rules cannot drift apart between them.
 *
 * Returns the path to redirect to rather than redirecting itself — redirect() throws, and callers
 * need it outside their try blocks.
 */
async function finalizeLogin(
  tokens: GoTrueTokenResponse,
  role: AppRole,
  security: SecuritySettings,
  extraAuditAction?: string
): Promise<string> {
  await createSession(tokens);

  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? "unknown";
  const userAgent = headerList.get("user-agent") ?? "unknown";

  const sessionId = await recordSessionStart({
    accessToken: tokens.access_token,
    userId: tokens.user.id,
    email: tokens.user.email,
    role,
    ipAddress,
    userAgent,
  });

  if (sessionId) {
    await setSessionIdCookie(sessionId);
    if (extraAuditAction) {
      await recordAuditEvent({
        accessToken: tokens.access_token,
        userId: tokens.user.id,
        email: tokens.user.email,
        role,
        action: extraAuditAction,
      });
    }
    await recordAuditEvent({
      accessToken: tokens.access_token,
      userId: tokens.user.id,
      email: tokens.user.email,
      role,
      action: "Logged in",
    });
  }

  // An expired or admin-issued password gets a session first on purpose: GoTrue's PUT /user needs
  // the user's own bearer token, so they cannot change the password without one.
  const passwordState = await getPasswordState(tokens.user.id);
  if (isPasswordChangeRequired(passwordState, security.passwordExpiryDays)) {
    return "/change-password";
  }

  return role === "admin" ? "/admin" : "/personnel";
}

export async function loginAction(
  _prevState: LoginFormState | undefined,
  formData: FormData
): Promise<LoginFormState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Please enter your username and password." };
  }

  const email = usernameToEmail(username);
  const security = await getSecuritySettings();

  const lockedMinutes = await getLockoutRemainingMinutes(email);
  if (lockedMinutes !== null) {
    return { error: `Account temporarily locked. Try again in ${lockedMinutes} minute${lockedMinutes === 1 ? "" : "s"}.` };
  }

  const result = await signInWithPassword(email, password);

  if ("error" in result) {
    await recordFailedLoginAttempt(email, security.maxFailedLoginAttempts, security.lockoutDurationMinutes);
    return { error: INVALID_CREDENTIALS_MESSAGE };
  }

  const role = result.user.app_metadata?.role;
  if (role !== "admin" && role !== "personnel") {
    return { error: "Account is not fully configured. Contact the System Administrator." };
  }

  // Admin login can never be disabled — this check only runs for personnel, and
  // module_permissions has no admin row for it to even check against.
  if (role === "personnel" && !(await isModuleEnabledForPersonnel("login"))) {
    return { error: "Login is currently disabled for your role. Contact the System Administrator." };
  }

  await resetLoginAttempts(email);

  // Two-Factor Authentication on: the password step only earns an aal1 token, which is parked in
  // the short-lived pending cookies instead of becoming a session. /login/verify turns it into an
  // aal2 session, or nothing.
  if (security.twoFactorEnabled) {
    await createPendingSession(result);
    redirect("/login/verify");
  }

  redirect(await finalizeLogin(result, role, security));
}

export interface OtpFormState {
  error?: string;
}

const SIGN_IN_EXPIRED_MESSAGE = "Your sign-in timed out. Please sign in again.";

/**
 * Second step of a 2FA login. The factor is looked up server-side from the pending token rather
 * than taken from the form, so a tampered field cannot point the verification at anything else.
 */
export async function verifyOtpAction(
  _prevState: OtpFormState | undefined,
  formData: FormData
): Promise<OtpFormState> {
  const code = String(formData.get("code") ?? "").trim();

  const pending = await getPendingTokens();
  if (!pending) return { error: SIGN_IN_EXPIRED_MESSAGE };

  const payload = await verifyAccessToken(pending.accessToken);
  const role = payload?.app_metadata?.role;
  if (!payload || (role !== "admin" && role !== "personnel")) {
    await clearPendingSession();
    return { error: SIGN_IN_EXPIRED_MESSAGE };
  }

  if (!/^\d{6}$/.test(code)) {
    return { error: "Enter the 6-digit code from your authenticator app." };
  }

  const factors = await listFactors(pending.accessToken);
  if ("error" in factors) return { error: "Could not verify the code. Please sign in again." };

  // Either the account's verified factor, or the unverified one the enrolment screen just created.
  const factor = verifiedTotpFactor(factors) ?? factors.find((f) => f.factor_type === "totp");
  if (!factor) return { error: "No authenticator is set up for this account. Please sign in again." };

  const isEnrolment = factor.status === "unverified";
  const email = payload.email ?? "";
  const security = await getSecuritySettings();

  const challenge = await challengeFactor(pending.accessToken, factor.id);
  if ("error" in challenge) return { error: "Could not verify the code. Please try again." };

  const verified = await verifyFactor(pending.accessToken, factor.id, challenge.id, code);
  if ("error" in verified) {
    // A wrong OTP is a failed login attempt like any other — same counter, same lockout.
    if (email) {
      await recordFailedLoginAttempt(email, security.maxFailedLoginAttempts, security.lockoutDurationMinutes);
    }
    return { error: "Invalid verification code." };
  }

  await clearPendingSession();
  if (email) await resetLoginAttempts(email);

  redirect(
    await finalizeLogin(verified, role, security, isEnrolment ? "Enrolled 2FA device" : undefined)
  );
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}
