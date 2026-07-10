import { create } from "zustand";
import type { CodexMessage, CodexProgress } from "@/api/client";
import type { CustomCodeProposal } from "@/model/customCode";

export interface CodexChatSession {
  input: string;
  messages: CodexMessage[];
  progress: CodexProgress | null;
  pendingCustomCode: CustomCodeProposal | null;
  busy: boolean;
  model: string;
  reasoning: string;
  speed: string;
  generation: number;
}

export type CodexAuthState = "checking" | "authenticated" | "unauthenticated" | "unavailable";

interface CodexChatState {
  sessions: Record<string, CodexChatSession>;
  authState: CodexAuthState;
  setAuthState: (authState: CodexAuthState) => void;
  ensureSession: (projectId: string) => CodexChatSession;
  updateSession: (projectId: string, patch: Partial<CodexChatSession>) => void;
  mutateSession: (projectId: string, fn: (session: CodexChatSession) => CodexChatSession) => void;
  resetSession: (projectId: string) => void;
}

const emptySession = (): CodexChatSession => ({
  input: "",
  messages: [],
  progress: null,
  pendingCustomCode: null,
  busy: false,
  model: "gpt-5.6-sol",
  reasoning: "low",
  speed: "default",
  generation: 0,
});

export const useCodexChat = create<CodexChatState>((set, get) => ({
  sessions: {},
  authState: "checking",

  setAuthState: (authState) => set({ authState }),

  ensureSession: (projectId) => {
    const existing = get().sessions[projectId];
    if (existing) return existing;
    const next = emptySession();
    set((state) => ({ sessions: { ...state.sessions, [projectId]: next } }));
    return next;
  },

  updateSession: (projectId, patch) => {
    set((state) => {
      const current = state.sessions[projectId] ?? emptySession();
      return { sessions: { ...state.sessions, [projectId]: { ...current, ...patch } } };
    });
  },

  mutateSession: (projectId, fn) => {
    set((state) => {
      const current = state.sessions[projectId] ?? emptySession();
      return { sessions: { ...state.sessions, [projectId]: fn(current) } };
    });
  },

  resetSession: (projectId) => {
    set((state) => {
      const current = state.sessions[projectId];
      const next = emptySession();
      return {
        sessions: {
          ...state.sessions,
          [projectId]: {
            ...next,
            model: current?.model ?? next.model,
            reasoning: current?.reasoning ?? next.reasoning,
            speed: current?.speed ?? next.speed,
            generation: (current?.generation ?? 0) + 1,
          },
        },
      };
    });
  },
}));
