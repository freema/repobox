import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getJob, getJobOutput } from "@/lib/repositories";
import { SessionDetailClient } from "@/components/dashboard";

interface SessionPageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionPage({ params }: SessionPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const job = await getJob(id);

  if (!job) {
    notFound();
  }

  // Ensure user owns this job
  if (job.userId !== session.user.id) {
    notFound();
  }

  // Fetch initial job output for SSR hydration
  const initialOutput = await getJobOutput(id);

  return (
    <div className="h-full flex flex-col" data-testid="session-detail">
      <SessionDetailClient job={job} initialOutput={initialOutput} />
    </div>
  );
}
