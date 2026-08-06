"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { usernameToEmail } from "./username";
import { signInWithPassword } from "./gotrue";
import { createSession, endSession, setSessionIdCookie } from "./session";
import { recordAuditEvent, recordSessionStart } from "@/app/lib/tracking/tracking";
import { isModuleEnabledForPersonnel } from "@/app/lib/permissions/permissions";

export interface LoginFormState {
  error?: string;
}

const INVALID_CREDENTIALS_MESSAGE = "Invalid username or password.";

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
  const result = await signInWithPassword(email, password);

  if ("error" in result) {
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

  await createSession(result);

  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? "unknown";
  const userAgent = headerList.get("user-agent") ?? "unknown";

  const sessionId = await recordSessionStart({
    accessToken: result.access_token,
    userId: result.user.id,
    email: result.user.email,
    role,
    ipAddress,
    userAgent,
  });

  if (sessionId) {
    await setSessionIdCookie(sessionId);
    await recordAuditEvent({
      accessToken: result.access_token,
      userId: result.user.id,
      email: result.user.email,
      role,
      action: "Logged in",
    });
  }

  redirect(role === "admin" ? "/admin" : "/personnel");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}
