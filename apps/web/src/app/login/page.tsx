"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    // If Google is wired, the providers endpoint lists it.
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((p) => setConfigured(!!p?.google))
      .catch(() => setConfigured(false));
  }, []);

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="flex items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-accent-blue to-purple flex items-center justify-center">
            <span className="text-white text-sm font-bold font-display">G</span>
          </div>
          <span className="font-display font-semibold text-text text-xl tracking-tight">Gigify</span>
        </div>
        <p className="text-sm text-text-medium">Your AI booking agent. Sign in to manage your tour.</p>

        {configured === false ? (
          <div className="text-sm text-text-light border border-border rounded-lg p-4">
            Sign-in isn't configured yet. Set <code className="text-text-medium">AUTH_GOOGLE_ID</code> and{" "}
            <code className="text-text-medium">AUTH_GOOGLE_SECRET</code> to enable Google login.
          </div>
        ) : (
          <button
            type="button"
            disabled={configured === null}
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="w-full flex items-center justify-center gap-2 border border-border rounded-lg py-2.5 text-sm font-medium text-text hover:bg-surface transition disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>
            Continue with Google
          </button>
        )}
      </div>
    </div>
  );
}
