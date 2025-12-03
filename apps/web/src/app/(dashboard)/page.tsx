import { auth } from "@/lib/auth";
import { getUserJobs } from "@/lib/repositories";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // Fetch user's job history
  const jobs = await getUserJobs(session.user.id, { limit: 20 });

  return (
    <DashboardClient
      initialJobs={jobs}
      user={session.user}
    />
  );
}
