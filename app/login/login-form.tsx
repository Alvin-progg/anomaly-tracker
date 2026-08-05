"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginFormState } from "@/app/lib/auth/actions";

const initialState: LoginFormState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const searchParams = useSearchParams();
  const loggedOutForIdle = searchParams.get("reason") === "idle";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1F3864] via-[#2E74B5] to-[#1F3864] relative overflow-hidden px-4">
      <div className="absolute inset-0 bg-dot-grid pointer-events-none" />

      <div className="relative w-full max-w-[420px] bg-white rounded-xl px-10 pt-10 pb-9 shadow-2xl">
        <div className="flex flex-col items-center mb-7">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1F3864] to-[#2E74B5] flex items-center justify-center mb-3.5 shadow-lg">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div className="text-[22px] font-extrabold text-[#1F3864] tracking-tight">RAAO Monitor</div>
          <div className="text-xs text-[#6B7A99] mt-0.5 text-center">Municipal Budget Office</div>
          <div className="mt-2.5 px-3 py-0.5 bg-[#EFF6FF] rounded-full text-[10px] text-[#1D4ED8] font-semibold tracking-wider uppercase">
            Budget Monitoring &amp; Decision Support System
          </div>
        </div>

        {loggedOutForIdle && (
          <div className="mb-3.5 px-3 py-2 bg-amber-50 rounded-md text-xs text-amber-800 border border-amber-200">
            You were logged out due to inactivity.
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-3.5">
          <div>
            <label htmlFor="username" className="block text-xs font-semibold text-gray-700 mb-1.5">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="Enter your username"
              className="w-full px-3.5 py-2.5 border-[1.5px] border-[#D1D9E6] rounded-lg text-sm text-[#1A2033] outline-none focus:border-[#2E74B5] transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-gray-700 mb-1.5">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              className="w-full px-3.5 py-2.5 border-[1.5px] border-[#D1D9E6] rounded-lg text-sm text-[#1A2033] outline-none focus:border-[#2E74B5] transition-colors"
            />
          </div>

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
            {isPending ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <span className="text-xs text-[#2E74B5] font-medium">Forgot password? Contact System Administrator</span>
        </div>

        <div className="mt-4 text-center text-[11px] text-gray-400">Version 1.0.0</div>
      </div>
    </div>
  );
}
