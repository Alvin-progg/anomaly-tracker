import { redirect } from "next/navigation";
import { getPendingTokens } from "@/app/lib/auth/session";
import { verifyAccessToken } from "@/app/lib/auth/jwt";
import { clearUnverifiedFactors, enrollTotpFactor, listFactors, verifiedTotpFactor } from "@/app/lib/auth/mfa";
import { VerifyForm } from "./verify-form";

/**
 * Second step of a 2FA login. Reached only from loginAction, which parks the password step's aal1
 * token in the pending cookies — those are what authorise everything on this page. Nothing here
 * is a session: verifyOtpAction is the only thing that can turn the pending token into one.
 *
 * Cookies cannot be written while a Server Component renders, so an unusable pending token is
 * bounced to /login and left to expire on its own five-minute timer.
 */
export default async function VerifyPage() {
  const pending = await getPendingTokens();
  if (!pending) redirect("/login");

  const payload = await verifyAccessToken(pending.accessToken);
  if (!payload) redirect("/login");

  const factors = await listFactors(pending.accessToken);
  if ("error" in factors) redirect("/login");

  if (verifiedTotpFactor(factors)) {
    return <VerifyForm />;
  }

  // First login since 2FA was switched on: enrol now, show the QR, and let verifyOtpAction flip
  // the factor to verified. Abandoned enrolments are cleared first so repeated visits to this
  // page cannot pile up unverified factors against max_enrolled_factors.
  await clearUnverifiedFactors(pending.accessToken, factors);

  const enrollment = await enrollTotpFactor(pending.accessToken, "RAAO Monitor");
  if ("error" in enrollment) redirect("/login");

  return <VerifyForm enrolment={{ qrCode: enrollment.totp.qr_code, secret: enrollment.totp.secret }} />;
}
