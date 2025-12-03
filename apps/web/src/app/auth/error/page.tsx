import Link from "next/link";

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  AccessDenied: {
    title: "Access Denied",
    description: "You do not have permission to sign in. This might be a temporary issue - please try again.",
  },
  Verification: {
    title: "Verification Error",
    description: "The verification link may have expired or already been used.",
  },
  OAuthAccountNotLinked: {
    title: "Account Already Exists",
    description: "This email is already associated with another account. Please sign in with your original provider.",
  },
  OAuthCallback: {
    title: "Authentication Failed",
    description: "There was a problem communicating with the authentication provider.",
  },
  OAuthCreateAccount: {
    title: "Account Creation Failed",
    description: "Could not create your account. Please try again later.",
  },
  Configuration: {
    title: "Configuration Error",
    description: "There is a problem with the server configuration. Please contact the administrator.",
  },
  Default: {
    title: "Authentication Error",
    description: "An unexpected error occurred during sign in. Please try again.",
  },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorType = params.error || "Default";
  const errorInfo = ERROR_MESSAGES[errorType] || ERROR_MESSAGES.Default;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 text-white p-4">
      <div className="w-full max-w-md">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center">
          {/* Error Icon */}
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red-900/30 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>

          {/* Error Message */}
          <h1 className="text-2xl font-bold mb-3">{errorInfo.title}</h1>
          <p className="text-neutral-400 mb-8">{errorInfo.description}</p>

          {/* Actions */}
          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full px-4 py-3 bg-white text-neutral-900 font-medium rounded-lg hover:bg-neutral-200 transition-colors"
            >
              Try Again
            </Link>
            <Link
              href="/"
              className="block w-full px-4 py-3 bg-neutral-800 text-white font-medium rounded-lg hover:bg-neutral-700 border border-neutral-700 transition-colors"
            >
              Go Home
            </Link>
          </div>
        </div>

        {/* Debug info in dev */}
        {process.env.NODE_ENV === "development" && params.error && (
          <div className="mt-4 p-3 bg-neutral-900/50 border border-neutral-800 rounded-lg">
            <p className="text-xs text-neutral-500 font-mono">
              Error code: {params.error}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
