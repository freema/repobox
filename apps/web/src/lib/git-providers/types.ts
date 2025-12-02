/**
 * Git Provider types based on SPEC.MD#Git-Providers
 */

export type GitProviderType = "gitlab" | "github";

/**
 * Repository information returned by provider APIs
 */
export interface Repository {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  cloneUrl: string;
  defaultBranch: string;
  private: boolean;
  providerId: string;
  providerType: GitProviderType;
}

/**
 * Git provider configuration stored in Redis
 */
export interface GitProviderConfig {
  id: string;
  type: GitProviderType;
  url: string;
  token: string; // Encrypted
  username: string;
  verified: boolean;
  reposCount: number;
  createdAt: number;
  lastVerifiedAt: number | null;
}

/**
 * Git provider data returned to client (token masked)
 */
export interface GitProviderResponse {
  id: string;
  type: GitProviderType;
  url: string;
  username: string;
  verified: boolean;
  reposCount: number;
  createdAt: number;
  lastVerifiedAt: number | null;
}

/**
 * Input for creating a new git provider
 */
export interface CreateGitProviderInput {
  type: GitProviderType;
  url: string;
  token: string;
}

/**
 * Result of token verification
 */
export interface VerifyTokenResult {
  valid: boolean;
  username: string | null;
  error: string | null;
}

/**
 * Merge request/Pull request creation result
 */
export interface MergeRequestResult {
  id: string;
  url: string;
  number: number;
}

/**
 * Git provider interface - all providers must implement this
 */
export interface GitProvider {
  readonly type: GitProviderType;
  readonly baseUrl: string;

  /**
   * Verifies that a token is valid and returns the associated username
   */
  verifyToken(token: string): Promise<VerifyTokenResult>;

  /**
   * Lists all repositories accessible with the given token
   */
  listRepositories(token: string): Promise<Repository[]>;

  /**
   * Gets the clone URL with embedded credentials
   */
  getCloneUrl(repoUrl: string, token: string, username: string): string;

  /**
   * Creates a merge request / pull request
   */
  createMergeRequest(params: {
    token: string;
    projectId: string;
    title: string;
    description: string;
    sourceBranch: string;
    targetBranch: string;
  }): Promise<MergeRequestResult>;
}
