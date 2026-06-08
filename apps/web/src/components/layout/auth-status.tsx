"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

type SessionUser = { name?: string | null; email?: string | null; image?: string | null };

// Shows the signed-in user + sign-out when auth is active. Renders nothing in
// single-tenant pilot mode (no session), so the static profile footer stays.
export function AuthStatus() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => setUser(s?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  if (!user) return null;

  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-text truncate">{user.name ?? "Signed in"}</p>
        <p className="text-xs text-text-light truncate">{user.email}</p>
      </div>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-text-light hover:text-text shrink-0"
        title="Sign out"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
