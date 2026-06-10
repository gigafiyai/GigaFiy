import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { auth, authConfigured } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Once auth is configured, the dashboard requires a session. In the
  // single-tenant pilot (auth off) it stays open.
  if (authConfigured) {
    const session = await auth();
    if (!session?.user) redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
