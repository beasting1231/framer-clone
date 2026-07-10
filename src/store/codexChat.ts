import { create } from "zustand";
import type { CodexImageAttachment, CodexMessage, CodexProgress } from "@/api/client";
import type { CustomCodeProposal } from "@/model/customCode";

export interface CodexQueuedPrompt {
  id: string;
  text: string;
  images: CodexImageAttachment[];
  contextNodes: CodexContextNode[];
}

export interface CodexContextNode {
  id: string;
  label: string;
}

export interface CodexChatSession {
  input: string;
  inputImages: CodexImageAttachment[];
  contextNodes: CodexContextNode[];
  promptQueue: CodexQueuedPrompt[];
  messages: CodexMessage[];
  progress: CodexProgress | null;
  pendingCustomCode: CustomCodeProposal | null;
  busy: boolean;
  model: string;
  reasoning: string;
  speed: string;
  generation: number;
  runId: number;
}

export type CodexAuthState = "checking" | "authenticated" | "unauthenticated" | "unavailable";

interface CodexChatState {
  sessions: Record<string, CodexChatSession>;
  authState: CodexAuthState;
  setAuthState: (authState: CodexAuthState) => void;
  ensureSession: (projectId: string) => CodexChatSession;
  updateSession: (projectId: string, patch: Partial<CodexChatSession>) => void;
  mutateSession: (projectId: string, fn: (session: CodexChatSession) => CodexChatSession) => void;
  addContextNode: (projectId: string, node: CodexContextNode) => void;
  removeContextNode: (projectId: string, nodeId: string) => void;
  resetSession: (projectId: string) => void;
}

type CodexRunSettings = Pick<CodexChatSession, "model" | "reasoning" | "speed">;

const RUN_SETTINGS_STORAGE_KEY = "framer-clone.codex-run-settings";
const DEFAULT_RUN_SETTINGS: CodexRunSettings = {
  model: "gpt-5.6-sol",
  reasoning: "low",
  speed: "default",
};
const MODEL_CAPABILITIES: Record<string, { defaultReasoning: string; reasoning: Set<string>; fast: boolean }> = {
  "gpt-5.6-sol": { defaultReasoning: "low", reasoning: new Set(["low", "medium", "high", "xhigh", "max", "ultra"]), fast: true },
  "gpt-5.6-terra": { defaultReasoning: "medium", reasoning: new Set(["low", "medium", "high", "xhigh", "max", "ultra"]), fast: true },
  "gpt-5.6-luna": { defaultReasoning: "medium", reasoning: new Set(["low", "medium", "high", "xhigh", "max"]), fast: true },
  "gpt-5.5": { defaultReasoning: "medium", reasoning: new Set(["low", "medium", "high", "xhigh"]), fast: true },
  "gpt-5.4-mini": { defaultReasoning: "medium", reasoning: new Set(["low", "medium", "high", "xhigh"]), fast: false },
  "gpt-5.3-codex-spark": { defaultReasoning: "high", reasoning: new Set(["low", "medium", "high", "xhigh"]), fast: false },
};

function normalizeRunSettings(value: Partial<CodexRunSettings>): CodexRunSettings {
  const model = value.model && MODEL_CAPABILITIES[value.model] ? value.model : DEFAULT_RUN_SETTINGS.model;
  const capabilities = MODEL_CAPABILITIES[model];
  const reasoning = value.reasoning && capabilities.reasoning.has(value.reasoning) ? value.reasoning : capabilities.defaultReasoning;
  const speed = value.speed === "fast" && capabilities.fast ? "fast" : "default";
  return { model, reasoning, speed };
}

function loadRunSettings(): CodexRunSettings {
  if (typeof window === "undefined") return DEFAULT_RUN_SETTINGS;
  try {
    const saved = window.localStorage.getItem(RUN_SETTINGS_STORAGE_KEY);
    return saved ? normalizeRunSettings(JSON.parse(saved) as Partial<CodexRunSettings>) : DEFAULT_RUN_SETTINGS;
  } catch {
    return DEFAULT_RUN_SETTINGS;
  }
}

let runSettings = loadRunSettings();

function saveRunSettings(patch: Partial<CodexChatSession>): CodexRunSettings | null {
  if (patch.model === undefined && patch.reasoning === undefined && patch.speed === undefined) return null;
  runSettings = normalizeRunSettings({
    ...runSettings,
    ...(patch.model !== undefined ? { model: patch.model } : {}),
    ...(patch.reasoning !== undefined ? { reasoning: patch.reasoning } : {}),
    ...(patch.speed !== undefined ? { speed: patch.speed } : {}),
  });
  try {
    window.localStorage.setItem(RUN_SETTINGS_STORAGE_KEY, JSON.stringify(runSettings));
  } catch {
    // Keep the settings for this app session when persistent storage is unavailable.
  }
  return runSettings;
}

const emptySession = (): CodexChatSession => ({
  input: "",
  inputImages: [],
  contextNodes: [],
  promptQueue: [],
  messages: [],
  progress: null,
  pendingCustomCode: null,
  busy: false,
  ...runSettings,
  generation: 0,
  runId: 0,
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
    const savedSettings = saveRunSettings(patch);
    set((state) => {
      const sessions = savedSettings
        ? Object.fromEntries(Object.entries(state.sessions).map(([id, session]) => [id, { ...session, ...savedSettings }]))
        : { ...state.sessions };
      const current = sessions[projectId] ?? emptySession();
      sessions[projectId] = { ...current, ...patch, ...(savedSettings ?? {}) };
      return { sessions };
    });
  },

  mutateSession: (projectId, fn) => {
    set((state) => {
      const current = state.sessions[projectId] ?? emptySession();
      return { sessions: { ...state.sessions, [projectId]: fn(current) } };
    });
  },

  addContextNode: (projectId, node) => {
    set((state) => {
      const current = state.sessions[projectId] ?? emptySession();
      const contextNodes = current.contextNodes.some((item) => item.id === node.id)
        ? current.contextNodes
        : [...current.contextNodes, node];
      return { sessions: { ...state.sessions, [projectId]: { ...current, contextNodes } } };
    });
  },

  removeContextNode: (projectId, nodeId) => {
    set((state) => {
      const current = state.sessions[projectId] ?? emptySession();
      return {
        sessions: {
          ...state.sessions,
          [projectId]: { ...current, contextNodes: current.contextNodes.filter((node) => node.id !== nodeId) },
        },
      };
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
