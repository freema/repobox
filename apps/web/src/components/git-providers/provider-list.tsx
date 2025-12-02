"use client";

import { useState } from "react";

interface Provider {
  id: string;
  type: "gitlab" | "github";
  url: string;
  username: string;
  verified: boolean;
  reposCount: number;
  createdAt: number;
  lastVerifiedAt: number | null;
}

interface ProviderListProps {
  providers: Provider[];
  onDelete?: (id: string) => void;
  onVerify?: (id: string) => void;
}

export function ProviderList({ providers, onDelete, onVerify }: ProviderListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this provider?")) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/git-providers/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete provider");
      }

      onDelete?.(id);
    } catch (error) {
      console.error("Failed to delete provider:", error);
      alert("Failed to delete provider");
    } finally {
      setDeletingId(null);
    }
  };

  const handleVerify = async (id: string) => {
    setVerifyingId(id);
    try {
      const response = await fetch(`/api/git-providers/${id}/verify`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to verify provider");
      }

      onVerify?.(id);
    } catch (error) {
      console.error("Failed to verify provider:", error);
      alert(error instanceof Error ? error.message : "Failed to verify provider");
    } finally {
      setVerifyingId(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (providers.length === 0) {
    return <div className="text-center py-8 text-gray-500">No git providers configured yet.</div>;
  }

  return (
    <div className="space-y-3">
      {providers.map((provider) => (
        <div
          key={provider.id}
          className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-lg"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 flex items-center justify-center bg-gray-700 rounded-lg">
              {provider.type === "gitlab" ? (
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-orange-500">
                  <path
                    fill="currentColor"
                    d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white">
                  <path
                    fill="currentColor"
                    d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                  />
                </svg>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-200">{provider.username}</span>
                <span
                  className={`px-2 py-0.5 text-xs rounded-full ${
                    provider.verified
                      ? "bg-green-900/50 text-green-400"
                      : "bg-red-900/50 text-red-400"
                  }`}
                >
                  {provider.verified ? "Verified" : "Not Verified"}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {provider.url} • {provider.reposCount} repositories
              </div>
              {provider.lastVerifiedAt && (
                <div className="text-xs text-gray-600">
                  Last verified: {formatDate(provider.lastVerifiedAt)}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleVerify(provider.id)}
              disabled={verifyingId === provider.id}
              className="px-3 py-1 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
            >
              {verifyingId === provider.id ? "Verifying..." : "Re-verify"}
            </button>
            <button
              onClick={() => handleDelete(provider.id)}
              disabled={deletingId === provider.id}
              className="px-3 py-1 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
            >
              {deletingId === provider.id ? "Removing..." : "Remove"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
