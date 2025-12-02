import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { UserMenu } from "@/components/user-menu";
import { getUserGitProviders } from "@/lib/git-providers/repository";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Check if user has configured git providers
  const providers = await getUserGitProviders(session.user.id);
  const hasProviders = providers.length > 0;

  // Redirect to setup if no providers configured (except for settings page)
  if (!hasProviders) {
    redirect("/setup");
  }

  return (
    <div
      className="min-h-screen bg-neutral-950 text-white flex flex-col"
      data-testid="dashboard-layout"
    >
      {/* Header */}
      <header
        className="h-14 flex items-center justify-between px-4 border-b border-neutral-800 shrink-0"
        data-testid="dashboard-header"
      >
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            data-testid="logo-link"
          >
            <span className="text-xl">🗃️</span>
            <span className="font-bold text-lg">Repobox</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1" data-testid="main-nav">
            <Link
              href="/"
              className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white rounded-md hover:bg-neutral-800 transition-colors"
              data-testid="nav-dashboard"
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white rounded-md hover:bg-neutral-800 transition-colors"
              data-testid="nav-settings"
            >
              Settings
            </Link>
          </nav>
        </div>
        <UserMenu user={session.user} />
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden" data-testid="dashboard-main">
        {children}
      </main>
    </div>
  );
}
