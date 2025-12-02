import { auth } from "@/lib/auth";
import { UserMenu } from "@/components/user-menu";

export default async function Home() {
  const session = await auth();

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
        <h1 className="text-xl font-bold">Repobox</h1>
        {session?.user && <UserMenu user={session.user} />}
      </header>

      <div
        className="flex flex-col items-center justify-center"
        style={{ minHeight: "calc(100vh - 73px)" }}
      >
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Welcome, {session?.user?.name}</h2>
          <p className="text-neutral-400">Self-hosted AI Code Agent Platform</p>
          <p className="text-neutral-500 mt-4 text-sm">Dashboard coming soon...</p>
        </div>
      </div>
    </main>
  );
}
