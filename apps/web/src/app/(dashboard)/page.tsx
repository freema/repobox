import { auth } from "@/lib/auth";
import { getUserWorkSessions } from "@/lib/repositories/work-session";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // Fetch user's work sessions
  const sessions = await getUserWorkSessions(session.user.id, { limit: 20 });

  return (
    <DashboardClient
      initialSessions={sessions}
      user={session.user}
    />
  );
}
