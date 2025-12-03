"use client";

import { useState } from "react";
import type { GitProviderResponse } from "@/lib/git-providers/types";

interface SettingsClientProps {
  providers: GitProviderResponse[];
}

export function SettingsClient({ providers: initialProviders }: SettingsClientProps) {
  const [providers, setProviders] = useState(initialProviders);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(providerId: string) {
    if (!confirm("Are you sure you want to remove this provider? This cannot be undone.")) {
      return;
    }

    setDeletingId(providerId);
    try {
      const res = await fetch(`/api/git-providers/${providerId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete provider");
      }

      setProviders(providers.filter((p) => p.id !== providerId));
    } catch (error) {
      console.error("Failed to delete provider:", error);
      alert("Failed to delete provider. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  if (providers.length === 0) {
    return (
      <div
        className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-8 text-center"
        data-testid="no-providers"
      >
        <div className="text-4xl mb-4">🔗</div>
        <h3 className="text-lg font-medium text-white mb-2">No Git Providers</h3>
        <p className="text-sm text-neutral-400">
          Add a GitHub or GitLab provider to start creating code with AI.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="providers-list">
      {providers.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          isDeleting={deletingId === provider.id}
          onDelete={() => handleDelete(provider.id)}
        />
      ))}
    </div>
  );
}

function ProviderCard({
  provider,
  isDeleting,
  onDelete,
}: {
  provider: GitProviderResponse;
  isDeleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div
      className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4"
      data-testid="provider-card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ProviderIcon type={provider.type} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white" data-testid="provider-username">
                {provider.username}
              </span>
              <VerificationBadge verified={provider.verified} />
            </div>
            <p className="text-sm text-neutral-500" data-testid="provider-url">
              {provider.url}
            </p>
            <p className="text-xs text-neutral-600 mt-1">
              {provider.reposCount} repositories • Added{" "}
              {new Date(provider.createdAt).toISOString().split("T")[0]}
            </p>
          </div>
        </div>

        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="delete-provider-button"
        >
          {isDeleting ? (
            <svg
              className="w-5 h-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

function ProviderIcon({ type }: { type: "github" | "gitlab" }) {
  if (type === "github") {
    return (
      <div className="w-10 h-10 bg-neutral-700 rounded-full flex items-center justify-center">
        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
      </svg>
    </div>
  );
}

function VerificationBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/50 text-green-400 rounded-full text-xs font-medium">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Verified
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-900/50 text-yellow-400 rounded-full text-xs font-medium">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      Unverified
    </span>
  );
}
