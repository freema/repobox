import type {
  GitProvider,
  Repository,
  VerifyTokenResult,
  MergeRequestResult,
} from "./types";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  owner: {
    login: string;
  };
}

interface GitHubUser {
  id: number;
  login: string;
  name: string;
}

interface GitHubPullRequest {
  id: number;
  html_url: string;
  number: number;
}

/**
 * GitHub provider implementation
 * Supports github.com and GitHub Enterprise
 */
export class GitHubProvider implements GitProvider {
  readonly type = "github" as const;
  readonly baseUrl: string;
  private readonly apiUrl: string;

  constructor(baseUrl: string = "https://github.com") {
    // Normalize URL
    this.baseUrl = baseUrl.replace(/\/$/, "");

    // API URL differs for github.com vs enterprise
    if (this.baseUrl === "https://github.com") {
      this.apiUrl = "https://api.github.com";
    } else {
      // GitHub Enterprise uses /api/v3 suffix
      this.apiUrl = `${this.baseUrl}/api/v3`;
    }
  }

  private async fetch<T>(
    endpoint: string,
    token: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${text}`);
    }

    return response.json();
  }

  async verifyToken(token: string): Promise<VerifyTokenResult> {
    try {
      const user = await this.fetch<GitHubUser>("/user", token);

      return {
        valid: true,
        username: user.login,
        error: null,
      };
    } catch (error) {
      return {
        valid: false,
        username: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async listRepositories(token: string): Promise<Repository[]> {
    const repositories: Repository[] = [];
    let page = 1;
    const perPage = 100;

    // Paginate through all repos
    while (true) {
      const repos = await this.fetch<GitHubRepo[]>(
        `/user/repos?per_page=${perPage}&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
        token
      );

      if (repos.length === 0) {
        break;
      }

      for (const repo of repos) {
        repositories.push({
          id: String(repo.id),
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description,
          url: repo.html_url,
          cloneUrl: repo.clone_url,
          defaultBranch: repo.default_branch || "main",
          private: repo.private,
          providerId: "", // Will be set by caller
          providerType: "github",
        });
      }

      // If we got fewer than requested, we've reached the end
      if (repos.length < perPage) {
        break;
      }

      page++;

      // Safety limit
      if (page > 100) {
        console.warn("[github] Reached pagination limit of 10000 repositories");
        break;
      }
    }

    return repositories;
  }

  getCloneUrl(repoUrl: string, token: string, username: string): string {
    // GitHub uses username:token format
    // Format: https://<username>:<token>@github.com/user/repo.git
    const url = new URL(repoUrl);
    url.username = username;
    url.password = token;
    return url.toString();
  }

  async createMergeRequest(params: {
    token: string;
    projectId: string;
    title: string;
    description: string;
    sourceBranch: string;
    targetBranch: string;
  }): Promise<MergeRequestResult> {
    // projectId should be in format "owner/repo"
    const pr = await this.fetch<GitHubPullRequest>(
      `/repos/${params.projectId}/pulls`,
      params.token,
      {
        method: "POST",
        body: JSON.stringify({
          title: params.title,
          body: params.description,
          head: params.sourceBranch,
          base: params.targetBranch,
        }),
      }
    );

    return {
      id: String(pr.id),
      url: pr.html_url,
      number: pr.number,
    };
  }
}
