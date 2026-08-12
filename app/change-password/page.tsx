import { verifyIdentity } from "@/app/lib/auth/dal";
import { getPasswordState, isPasswordChangeRequired } from "@/app/lib/auth/password-state";
import { getSecuritySettings } from "@/app/lib/config/security";
import { ChangePasswordForm } from "./change-password-form";

/**
 * verifyIdentity(), not verifySession(): this is the page the Password Expiry gate redirects to,
 * so the full gate would bounce the user straight back off it.
 */
export default async function ChangePasswordPage() {
  const session = await verifyIdentity();
  const security = await getSecuritySettings();
  const state = await getPasswordState(session.userId);

  return (
    <ChangePasswordForm
      required={isPasswordChangeRequired(state, security.passwordExpiryDays)}
      expiryDays={security.passwordExpiryDays}
      mustChange={Boolean(state?.mustChange)}
    />
  );
}
