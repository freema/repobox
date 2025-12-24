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

// Auth Session types (for user authentication)
export interface AuthSession {
  userId: string;
  createdAt: number;
  expiresAt: number;
}

// Work Session types (for iterative AI work on repositories)
export type WorkSessionStatus =
  | "initializing"
  | "ready"
  | "running"
  | "pushed"
  | "archived"
  | "failed";

export interface WorkSession {
  id: string;
  userId: string;
  providerId: string;
  repoUrl: string;
  repoName: string;
  baseBranch: string;
  workBranch: string;
  status: WorkSessionStatus;
  mrUrl?: string;
  mrWarning?: string;
  errorMessage?: string;
  lastJobStatus?: JobStatus; // Status of the last executed job
  totalLinesAdded: number;
  totalLinesRemoved: number;
  jobCount: number;
  lastActivityAt: number;
  createdAt: number;
  pushedAt?: number;
  prompts?: string[]; // Prompts submitted in this session
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
  sessionId?: string; // Optional: if part of a work session
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

export type JobOutputSource = "runner" | "claude";

// Claude stream-json event types
export type ClaudeEventType = "system" | "assistant" | "user" | "result";
export type ContentBlockType = "text" | "tool_use" | "tool_result";

export interface ContentBlock {
  type: ContentBlockType;
  text?: string;                    // for "text" blocks
  id?: string;                      // for "tool_use"
  name?: string;                    // for "tool_use" (Read, Edit, Bash, etc.)
  input?: Record<string, unknown>;  // for "tool_use"
  tool_use_id?: string;             // for "tool_result"
  content?: string | unknown[];     // for "tool_result" (can be string or array)
}

export interface ClaudeMessage {
  type: ClaudeEventType;
  subtype?: string;                 // "init", "success", "error", etc.
  message?: {
    role: "assistant" | "user";
    content: ContentBlock[];
  };
  result?: string;
  session_id?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
}

export interface JobOutput {
  timestamp: number;
  line: string;
  stream: "stdout" | "stderr";
  source?: JobOutputSource;         // Optional for backward compatibility
  claude?: ClaudeMessage;           // Structured data from stream-json (future use)
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
