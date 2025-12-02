"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ProviderForm, ProviderList, RepositoryBrowser } from "@/components/git-providers";

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

interface Repository {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  private: boolean;
  providerId: string;
  providerType: "gitlab" | "github";
}

export default function SetupPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchProviders = useCallback(async () => {
    try {
      const response = await fetch("/api/git-providers");
      if (response.ok) {
        const data = await response.json();
        setProviders(data);
      }
    } catch (error) {
      console.error("Failed to fetch providers:", error);
    }
  }, []);

  const fetchRepositories = useCallback(async () => {
    try {
      const response = await fetch("/api/repositories");
      if (response.ok) {
        const data = await response.json();
        setRepositories(data);
      }
    } catch (error) {
      console.error("Failed to fetch repositories:", error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchProviders(), fetchRepositories()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchProviders, fetchRepositories]);

  const handleProviderAdded = async () => {
    setShowAddForm(false);
    await Promise.all([fetchProviders(), fetchRepositories()]);
  };

  const handleProviderDeleted = async () => {
    await Promise.all([fetchProviders(), fetchRepositories()]);
  };

  const handleProviderVerified = async () => {
    await Promise.all([fetchProviders(), fetchRepositories()]);
  };

  const handleContinue = () => {
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Configure Git Providers</h1>
          <p className="text-gray-400">
            Add your GitLab or GitHub personal access tokens to access your repositories.
          </p>
        </div>

        {/* Provider List */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Git Providers</h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-md transition-colors"
            >
              {showAddForm ? "Cancel" : "+ Add Provider"}
            </button>
          </div>

          {showAddForm && (
            <div className="mb-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
              <ProviderForm onSuccess={handleProviderAdded} />
            </div>
          )}

          <ProviderList
            providers={providers}
            onDelete={handleProviderDeleted}
            onVerify={handleProviderVerified}
          />
        </div>

        {/* Repository Browser */}
        {providers.some((p) => p.verified) && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Your Repositories</h2>
            <RepositoryBrowser
              repositories={repositories}
              onSelect={(repo) => window.open(repo.url, "_blank")}
            />
          </div>
        )}

        {/* Continue button */}
        {providers.some((p) => p.verified) && (
          <div className="text-center">
            <button
              onClick={handleContinue}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              Continue to Dashboard →
            </button>
          </div>
        )}

        {/* Help text */}
        <div className="mt-8 p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
          <h3 className="font-medium text-gray-300 mb-2">How to get a Personal Access Token:</h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li>
              <strong className="text-orange-400">GitLab:</strong> Settings → Access Tokens → Create
              with <code>api</code> scope
            </li>
            <li>
              <strong className="text-gray-300">GitHub:</strong> Settings → Developer settings →
              Fine-grained tokens → Generate with <code>repo</code> permission
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
