import { redirect } from "next/navigation";
import { auth, authConfigured } from "@/lib/auth";

// The daily session is full-screen and phone-first, so it lives outside the
// dashboard shell (no sidebar). Same auth rule as the dashboard.
export default async function TodayLayout({ children }: { children: React.ReactNode }) {
  if (authConfigured) {
    const session = await auth();
    if (!session?.user) redirect("/login");
  }
  return <div className="min-h-screen bg-background text-text">{children}</div>;
}
