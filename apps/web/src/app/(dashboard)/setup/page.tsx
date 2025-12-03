"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ProviderType = "github" | "gitlab";

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"select" | "token">("select");
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null);
  const [token, setToken] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [useCustomUrl, setUseCustomUrl] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleProviderSelect(provider: ProviderType) {
    setSelectedProvider(provider);
    setStep("token");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProvider || !token) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const body: Record<string, string> = {
        type: selectedProvider,
        token,
      };

      if (useCustomUrl && customUrl) {
        body.url = customUrl;
      }

      const res = await fetch("/api/git-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to add provider");
      }

      router.push("/settings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto" data-testid="setup-page">
      <div className="max-w-xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/settings"
            className="text-neutral-500 hover:text-white transition-colors"
            data-testid="setup-back-link"
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
          <h1 className="text-2xl font-bold text-white">Add Git Provider</h1>
        </div>

        {step === "select" && (
          <div className="space-y-4">
            <p className="text-neutral-400 mb-6">
              Choose a Git provider to connect. You&apos;ll need a Personal Access Token with
              repository access.
            </p>

            <button
              onClick={() => handleProviderSelect("github")}
              className="w-full flex items-center gap-4 p-4 bg-neutral-800/50 border border-neutral-700 rounded-xl hover:border-neutral-600 transition-colors"
              data-testid="select-github"
            >
              <div className="w-12 h-12 bg-neutral-700 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </div>
              <div className="text-left">
                <div className="font-medium text-white">GitHub</div>
                <div className="text-sm text-neutral-500">github.com or GitHub Enterprise</div>
              </div>
            </button>

            <button
              onClick={() => handleProviderSelect("gitlab")}
              className="w-full flex items-center gap-4 p-4 bg-neutral-800/50 border border-neutral-700 rounded-xl hover:border-neutral-600 transition-colors"
              data-testid="select-gitlab"
            >
              <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
                </svg>
              </div>
              <div className="text-left">
                <div className="font-medium text-white">GitLab</div>
                <div className="text-sm text-neutral-500">gitlab.com or self-hosted</div>
              </div>
            </button>
          </div>
        )}

        {step === "token" && selectedProvider && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <button
              type="button"
              onClick={() => {
                setStep("select");
                setToken("");
                setError(null);
              }}
              className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Change provider
            </button>

            <div className="flex items-center gap-4 p-4 bg-neutral-800/50 border border-neutral-700 rounded-xl">
              {selectedProvider === "github" ? (
                <div className="w-10 h-10 bg-neutral-700 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </div>
              ) : (
                <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
                  </svg>
                </div>
              )}
              <div>
                <div className="font-medium text-white capitalize">{selectedProvider}</div>
                <div className="text-sm text-neutral-500">
                  {selectedProvider === "github" ? "github.com" : "gitlab.com"}
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="token" className="block text-sm font-medium text-neutral-300 mb-2">
                Personal Access Token
              </label>
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={selectedProvider === "github" ? "ghp_xxxx..." : "glpat-xxxx..."}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
                required
                data-testid="token-input"
              />
              <p className="mt-2 text-xs text-neutral-500">
                {selectedProvider === "github" ? (
                  <>
                    Create a token at{" "}
                    <a
                      href="https://github.com/settings/tokens/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      github.com/settings/tokens
                    </a>{" "}
                    with <code className="bg-neutral-700 px-1 rounded">repo</code> scope.
                  </>
                ) : (
                  <>
                    Create a token at{" "}
                    <a
                      href="https://gitlab.com/-/user_settings/personal_access_tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      GitLab settings
                    </a>{" "}
                    with <code className="bg-neutral-700 px-1 rounded">read_api</code> and{" "}
                    <code className="bg-neutral-700 px-1 rounded">read_repository</code> scopes.
                  </>
                )}
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomUrl}
                  onChange={(e) => setUseCustomUrl(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-neutral-900"
                />
                <span className="text-sm text-neutral-400">
                  Use custom URL (self-hosted / enterprise)
                </span>
              </label>

              {useCustomUrl && (
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder={
                    selectedProvider === "github"
                      ? "https://github.mycompany.com"
                      : "https://gitlab.mycompany.com"
                  }
                  className="mt-3 w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
                  data-testid="custom-url-input"
                />
              )}
            </div>

            {error && (
              <div
                className="p-4 bg-red-900/30 border border-red-700 rounded-xl text-red-400 text-sm"
                data-testid="error-message"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !token}
              className="w-full py-3 bg-white hover:bg-neutral-200 disabled:bg-neutral-600 disabled:cursor-not-allowed text-neutral-900 rounded-xl font-medium transition-colors"
              data-testid="submit-button"
            >
              {isSubmitting ? "Verifying..." : "Add Provider"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
