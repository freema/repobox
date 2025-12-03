// User types
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  authProvider: "github" | "google" | "ldap";
  createdAt: number;
  lastLoginAt: number;
}

// Session types
export interface Session {
  userId: string;
  createdAt: number;
  expiresAt: number;
}

// Git Provider types
export type GitProviderType = "gitlab" | "github";

export interface GitProvider {
  id: string;
  type: GitProviderType;
  url: string;
  token: string; // encrypted
  username: string;
  verified: boolean;
  reposCount: number;
  createdAt: number;
}

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  url: string;
  defaultBranch: string;
  providerId: string;
}

// Job types
export type JobStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "cancelled";

export interface Job {
  id: string;
  userId: string;
  providerId: string;
  repoUrl: string;
  repoName: string;
  branch: string;
  prompt: string;
  environment: string;
  status: JobStatus;
  mrUrl?: string;
  mrWarning?: string;
  linesAdded: number;
  linesRemoved: number;
  errorMessage?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

export interface JobOutput {
  timestamp: number;
  line: string;
  stream: "stdout" | "stderr";
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Token verification
export interface TokenVerification {
  valid: boolean;
  username?: string;
  reposCount?: number;
  error?: string;
}
