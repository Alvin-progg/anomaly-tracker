"use client";

import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordFormState } from "./actions";

const initialState: ChangePasswordFormState = {};

const fields = [
  { name: "currentPassword", label: "Current Password", autoComplete: "current-password" },
  { name: "newPassword", label: "New Password", autoComplete: "new-password" },
  { name: "confirmPassword", label: "Confirm New Password", autoComplete: "new-password" },
];

export function ChangePasswordForm({
  required,
  expiryDays,
  mustChange,
}: {
  required: boolean;
  expiryDays: number;
  mustChange: boolean;
}) {
  const [state, formAction, isPending] = useActionState(changePasswordAction, initialState);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1F3864] via-[#2E74B5] to-[#1F3864] relative overflow-hidden px-4">
      <div className="absolute inset-0 bg-dot-grid pointer-events-none" />

      <div className="relative w-full max-w-[420px] bg-white rounded-xl px-10 pt-10 pb-9 shadow-2xl">
        <div className="flex flex-col items-center mb-7">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1F3864] to-[#2E74B5] flex items-center justify-center mb-3.5 shadow-lg">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="text-[22px] font-extrabold text-[#1F3864] tracking-tight">Change Password</div>
          <div className="text-xs text-[#6B7A99] mt-0.5 text-center">RAAO Monitor · Municipal Budget Office</div>
        </div>

        {required && (
          <div className="mb-3.5 px-3 py-2 bg-amber-50 rounded-md text-xs text-amber-800 border border-amber-200">
            {mustChange
              ? "This account is using a password set by an administrator. Choose your own password to continue."
              : `Your password is older than ${expiryDays} days. Choose a new one to continue.`}
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-3.5">
          {fields.map((field) => (
            <div key={field.name}>
              <label htmlFor={field.name} className="block text-xs font-semibold text-gray-700 mb-1.5">
                {field.label}
              </label>
              <input
                id={field.name}
                name={field.name}
                type="password"
                autoComplete={field.autoComplete}
                className="w-full px-3.5 py-2.5 border-[1.5px] border-[#D1D9E6] rounded-lg text-sm text-[#1A2033] outline-none focus:border-[#2E74B5] transition-colors"
              />
            </div>
          ))}

          {state?.error && (
            <div className="px-3 py-2 bg-red-100 rounded-md text-xs text-red-800 border border-red-200">
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="mt-1 py-2.75 bg-[#1F3864] disabled:bg-[#6B7A99] disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold tracking-wide transition-colors"
          >
            {isPending ? "Saving..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
