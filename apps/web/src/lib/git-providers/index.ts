import { GitLabProvider } from "./gitlab";
import { GitHubProvider } from "./github";
import type { GitProvider, GitProviderType } from "./types";

export * from "./types";
export { GitLabProvider } from "./gitlab";
export { GitHubProvider } from "./github";

/**
 * Creates a git provider instance based on type and URL
 */
export function createProvider(type: GitProviderType, url: string): GitProvider {
  switch (type) {
    case "gitlab":
      return new GitLabProvider(url);
    case "github":
      return new GitHubProvider(url);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

/**
 * Gets the default URL for a provider type
 */
export function getDefaultUrl(type: GitProviderType): string {
  switch (type) {
    case "gitlab":
      return "https://gitlab.com";
    case "github":
      return "https://github.com";
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

/**
 * Validates a provider URL format
 */
export function isValidProviderUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
