import type { GitProvider, Repository, VerifyTokenResult, MergeRequestResult } from "./types";
import { proxyFetch } from "../proxy-fetch";

interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  http_url_to_repo: string;
  default_branch: string;
  visibility: "private" | "internal" | "public";
}

interface GitLabUser {
  id: number;
  username: string;
  name: string;
}

interface GitLabMergeRequest {
  iid: number;
  web_url: string;
  id: number;
}

/**
 * GitLab provider implementation
 * Supports both gitlab.com and self-hosted instances
 */
export class GitLabProvider implements GitProvider {
  readonly type = "gitlab" as const;
  readonly baseUrl: string;

  constructor(baseUrl: string = "https://gitlab.com") {
    // Normalize URL - remove trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async fetch<T>(endpoint: string, token: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v4${endpoint}`;

    // Use proxy-aware fetch for server-side requests
    const response = await proxyFetch(url, {
      ...options,
      headers: {
        "PRIVATE-TOKEN": token,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitLab API error: ${response.status} ${text}`);
    }

    return response.json();
  }

  async verifyToken(token: string): Promise<VerifyTokenResult> {
    try {
      const user = await this.fetch<GitLabUser>("/user", token);

      return {
        valid: true,
        username: user.username,
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

    // Paginate through all projects
    while (true) {
      const projects = await this.fetch<GitLabProject[]>(
        `/projects?membership=true&per_page=${perPage}&page=${page}&order_by=updated_at`,
        token
      );

      if (projects.length === 0) {
        break;
      }

      for (const project of projects) {
        repositories.push({
          id: String(project.id),
          name: project.name,
          fullName: project.path_with_namespace,
          description: project.description,
          url: project.web_url,
          cloneUrl: project.http_url_to_repo,
          defaultBranch: project.default_branch || "main",
          private: project.visibility === "private",
          providerId: "", // Will be set by caller
          providerType: "gitlab",
        });
      }

      // If we got fewer than requested, we've reached the end
      if (projects.length < perPage) {
        break;
      }

      page++;

      // Safety limit to prevent infinite loops
      if (page > 100) {
        console.warn("[gitlab] Reached pagination limit of 10000 repositories");
        break;
      }
    }

    return repositories;
  }

  getCloneUrl(repoUrl: string, token: string, _username: string): string {
    // GitLab uses oauth2 as username with PAT
    // Format: https://oauth2:<token>@gitlab.company.com/group/repo.git
    const url = new URL(repoUrl);
    url.username = "oauth2";
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
    const mr = await this.fetch<GitLabMergeRequest>(
      `/projects/${encodeURIComponent(params.projectId)}/merge_requests`,
      params.token,
      {
        method: "POST",
        body: JSON.stringify({
          source_branch: params.sourceBranch,
          target_branch: params.targetBranch,
          title: params.title,
          description: params.description,
        }),
      }
    );

    return {
      id: String(mr.id),
      url: mr.web_url,
      number: mr.iid,
    };
  }
}
