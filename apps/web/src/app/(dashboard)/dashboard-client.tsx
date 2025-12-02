"use client";

import { useState } from "react";
import type { Job } from "@repobox/types";
import {
  SessionList,
  RepositorySelector,
  EnvironmentSelector,
  PromptInput,
  type EnvironmentId,
} from "@/components/dashboard";

interface Repository {
  id: string;
  name: string;
  fullName: string;
  providerId: string;
  providerType: "github" | "gitlab";
}

interface DashboardClientProps {
  initialJobs: Job[];
}

export function DashboardClient({ initialJobs }: DashboardClientProps) {
  const [jobs] = useState<Job[]>(initialJobs);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [environment, setEnvironment] = useState<EnvironmentId>("default");
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedRepo || !prompt.trim()) return;

    setIsSubmitting(true);
    try {
      // TODO: Implement job creation API in Phase 06
      console.log("Creating job:", {
        repoId: selectedRepo.id,
        providerId: selectedRepo.providerId,
        environment,
        prompt: prompt.trim(),
      });

      // Reset form after successful submission
      setPrompt("");
    } catch (error) {
      console.error("Failed to create job:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex" data-testid="dashboard-page">
      {/* Sessions sidebar */}
      <aside
        className="w-72 border-r border-neutral-800 flex-shrink-0 hidden lg:flex flex-col"
        data-testid="sessions-sidebar"
      >
        <SessionList jobs={jobs} />
      </aside>

      {/* Main workspace */}
      <div className="flex-1 flex flex-col overflow-hidden" data-testid="main-workspace">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl space-y-6">
            {/* Logo and tagline */}
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🗃️</div>
              <h1 className="text-2xl font-bold mb-2">What would you like to build?</h1>
              <p className="text-neutral-500">Select a repository and describe your task</p>
            </div>

            {/* Selectors */}
            <div className="grid grid-cols-2 gap-3">
              <RepositorySelector
                value={selectedRepo?.id ?? null}
                onChange={(id, repo) => setSelectedRepo(repo)}
              />
              <EnvironmentSelector value={environment} onChange={setEnvironment} />
            </div>

            {/* Prompt input */}
            <PromptInput
              value={prompt}
              onChange={setPrompt}
              onSubmit={handleSubmit}
              disabled={isSubmitting || !selectedRepo}
              placeholder={
                selectedRepo
                  ? `What should I do in ${selectedRepo.name}?`
                  : "Select a repository first..."
              }
            />

            {/* Quick actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <QuickAction
                title="Write a CLAUDE.md"
                description="Create or update my project documentation"
                onClick={() => setPrompt("Write a CLAUDE.md file for this project")}
              />
              <QuickAction
                title="Fix a small todo"
                description="Search for TODO and fix it"
                onClick={() => setPrompt("Find and fix TODO comments in the codebase")}
              />
              <QuickAction
                title="Improve test coverage"
                description="Add missing unit tests"
                onClick={() => setPrompt("Analyze the codebase and add missing unit tests")}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - hidden on smaller screens */}
      <aside
        className="w-64 border-l border-neutral-800 p-4 hidden xl:block"
        data-testid="quick-actions-panel"
      >
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Quick Actions
        </h3>
        <div className="space-y-2">
          <QuickActionSmall
            title="Write a CLAUDE.md"
            onClick={() => setPrompt("Write a CLAUDE.md file for this project")}
          />
          <QuickActionSmall
            title="Fix a small todo"
            onClick={() => setPrompt("Find and fix TODO comments in the codebase")}
          />
          <QuickActionSmall
            title="Improve test coverage"
            onClick={() => setPrompt("Analyze the codebase and add missing unit tests")}
          />
          <QuickActionSmall
            title="Refactor code"
            onClick={() => setPrompt("Identify and refactor code that needs improvement")}
          />
        </div>
      </aside>
    </div>
  );
}

function QuickAction({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="p-4 bg-neutral-800/50 border border-neutral-700 rounded-xl text-left hover:bg-neutral-800 hover:border-neutral-600 transition-colors"
    >
      <h4 className="font-medium text-sm text-white mb-1">{title}</h4>
      <p className="text-xs text-neutral-500">{description}</p>
    </button>
  );
}

function QuickActionSmall({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full p-3 bg-neutral-800/50 border border-neutral-700 rounded-lg text-left text-sm text-neutral-300 hover:bg-neutral-800 hover:border-neutral-600 hover:text-white transition-colors"
    >
      {title}
    </button>
  );
}
