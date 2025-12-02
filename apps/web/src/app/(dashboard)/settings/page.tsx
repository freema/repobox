import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { getUserGitProviders, configToResponse } from "@/lib/git-providers/repository";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const providerConfigs = await getUserGitProviders(session.user.id);
  const providers = providerConfigs.map(configToResponse);

  return (
    <div className="h-full overflow-y-auto" data-testid="settings-page">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/"
            className="text-neutral-500 hover:text-white transition-colors"
            data-testid="settings-back-link"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>

        {/* Profile section */}
        <section className="mb-8" data-testid="profile-section">
          <h2 className="text-lg font-semibold text-white mb-4">Profile</h2>
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4">
            <div className="flex items-center gap-4">
              {session.user.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name || "User avatar"}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-full"
                  data-testid="profile-avatar"
                />
              )}
              <div>
                <p className="text-lg font-medium text-white" data-testid="profile-name">
                  {session.user.name}
                </p>
                <p className="text-sm text-neutral-400" data-testid="profile-email">
                  {session.user.email}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Git Providers section */}
        <section data-testid="providers-section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Git Providers</h2>
            <Link
              href="/setup"
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-200 text-neutral-900 rounded-lg text-sm font-medium transition-colors"
              data-testid="add-provider-button"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Provider
            </Link>
          </div>

          <SettingsClient providers={providers} />
        </section>
      </div>
    </div>
  );
}
