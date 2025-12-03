"use client";

import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from "react";
import type { Job } from "@repobox/types";
import type { EnvironmentId } from "@/components/dashboard/environment-selector";

// Types
export interface Repository {
  id: string;
  name: string;
  fullName: string;
  url: string;
  defaultBranch: string;
  providerId: string;
  providerType: "github" | "gitlab";
}

export type SessionFilter = "active" | "all";

export interface DashboardState {
  // Selection
  selectedRepo: Repository | null;
  environment: EnvironmentId;

  // Sessions
  sessions: Job[];
  sessionFilter: SessionFilter;
  sessionsPage: number;
  hasMoreSessions: boolean;
  isLoadingSessions: boolean;

  // Active session
  activeSessionId: string | null;

  // Input states
  newSessionPrompt: string;
  sessionReplyPrompt: string;

  // Submission states
  isCreatingSession: boolean;
  isSubmittingReply: boolean;

  // UI states
  isProfileModalOpen: boolean;
}

// Actions
type DashboardAction =
  | { type: "SET_SELECTED_REPO"; payload: Repository | null }
  | { type: "SET_ENVIRONMENT"; payload: EnvironmentId }
  | { type: "SET_SESSION_FILTER"; payload: SessionFilter }
  | { type: "SET_ACTIVE_SESSION"; payload: string | null }
  | { type: "SET_NEW_PROMPT"; payload: string }
  | { type: "SET_REPLY_PROMPT"; payload: string }
  | { type: "SET_SESSIONS"; payload: Job[] }
  | { type: "APPEND_SESSIONS"; payload: Job[] }
  | { type: "SET_HAS_MORE_SESSIONS"; payload: boolean }
  | { type: "SET_LOADING_SESSIONS"; payload: boolean }
  | { type: "INCREMENT_SESSIONS_PAGE" }
  | { type: "START_CREATING_SESSION" }
  | { type: "FINISH_CREATING_SESSION" }
  | { type: "CREATE_SESSION_SUCCESS"; payload: Job }
  | { type: "START_SUBMITTING_REPLY" }
  | { type: "FINISH_SUBMITTING_REPLY" }
  | { type: "TOGGLE_PROFILE_MODAL" }
  | { type: "UPDATE_SESSION"; payload: Job };

// Initial state
const initialState: DashboardState = {
  selectedRepo: null,
  environment: "default",
  sessions: [],
  sessionFilter: "active",
  sessionsPage: 0,
  hasMoreSessions: true,
  isLoadingSessions: false,
  activeSessionId: null,
  newSessionPrompt: "",
  sessionReplyPrompt: "",
  isCreatingSession: false,
  isSubmittingReply: false,
  isProfileModalOpen: false,
};

// Reducer
function dashboardReducer(
  state: DashboardState,
  action: DashboardAction
): DashboardState {
  switch (action.type) {
    case "SET_SELECTED_REPO":
      return { ...state, selectedRepo: action.payload };

    case "SET_ENVIRONMENT":
      return { ...state, environment: action.payload };

    case "SET_SESSION_FILTER":
      return {
        ...state,
        sessionFilter: action.payload,
        sessions: [],
        sessionsPage: 0,
        hasMoreSessions: true,
      };

    case "SET_ACTIVE_SESSION":
      return { ...state, activeSessionId: action.payload, sessionReplyPrompt: "" };

    case "SET_NEW_PROMPT":
      return { ...state, newSessionPrompt: action.payload };

    case "SET_REPLY_PROMPT":
      return { ...state, sessionReplyPrompt: action.payload };

    case "SET_SESSIONS":
      return { ...state, sessions: action.payload };

    case "APPEND_SESSIONS":
      return {
        ...state,
        sessions: [...state.sessions, ...action.payload],
      };

    case "SET_HAS_MORE_SESSIONS":
      return { ...state, hasMoreSessions: action.payload };

    case "SET_LOADING_SESSIONS":
      return { ...state, isLoadingSessions: action.payload };

    case "INCREMENT_SESSIONS_PAGE":
      return { ...state, sessionsPage: state.sessionsPage + 1 };

    case "START_CREATING_SESSION":
      return { ...state, isCreatingSession: true };

    case "FINISH_CREATING_SESSION":
      return { ...state, isCreatingSession: false };

    case "CREATE_SESSION_SUCCESS":
      return {
        ...state,
        isCreatingSession: false,
        newSessionPrompt: "",
        sessions: [action.payload, ...state.sessions],
        activeSessionId: action.payload.id,
      };

    case "START_SUBMITTING_REPLY":
      return { ...state, isSubmittingReply: true };

    case "FINISH_SUBMITTING_REPLY":
      return { ...state, isSubmittingReply: false, sessionReplyPrompt: "" };

    case "TOGGLE_PROFILE_MODAL":
      return { ...state, isProfileModalOpen: !state.isProfileModalOpen };

    case "UPDATE_SESSION":
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.payload.id ? action.payload : s
        ),
      };

    default:
      return state;
  }
}

// Context
interface DashboardContextValue {
  state: DashboardState;
  dispatch: Dispatch<DashboardAction>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

// Provider
interface DashboardProviderProps {
  children: ReactNode;
  initialJobs?: Job[];
}

export function DashboardProvider({
  children,
  initialJobs = [],
}: DashboardProviderProps) {
  const [state, dispatch] = useReducer(dashboardReducer, {
    ...initialState,
    sessions: initialJobs,
    hasMoreSessions: initialJobs.length >= 20,
  });

  return (
    <DashboardContext.Provider value={{ state, dispatch }}>
      {children}
    </DashboardContext.Provider>
  );
}

// Hook
export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}

// Helper to get active session from state
export function getActiveSession(state: DashboardState): Job | null {
  if (!state.activeSessionId) return null;
  return state.sessions.find((s) => s.id === state.activeSessionId) ?? null;
}
