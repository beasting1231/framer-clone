import { useEffect, useMemo, useRef, useState } from "react";
import { api, eventSourceUrl, type CodexMessage, type CodexProgress, type CodexSendResult } from "@/api/client";
import { hashProject } from "@/model/projectHash";
import { useCodexChat } from "@/store/codexChat";
import { useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";
import { IconClose, IconRefresh, IconSparkle } from "./icons";

const CODEX_MODELS = [
  { value: "gpt-5.6-sol", label: "5.6 Sol", defaultReasoning: "low", reasoning: ["low", "medium", "high", "xhigh", "max", "ultra"], fast: true },
  { value: "gpt-5.6-terra", label: "5.6 Terra", defaultReasoning: "medium", reasoning: ["low", "medium", "high", "xhigh", "max", "ultra"], fast: true },
  { value: "gpt-5.6-luna", label: "5.6 Luna", defaultReasoning: "medium", reasoning: ["low", "medium", "high", "xhigh", "max"], fast: true },
  { value: "gpt-5.5", label: "5.5", defaultReasoning: "medium", reasoning: ["low", "medium", "high", "xhigh"], fast: true },
  { value: "gpt-5.4-mini", label: "5.4 Mini", defaultReasoning: "medium", reasoning: ["low", "medium", "high", "xhigh"], fast: false },
  { value: "gpt-5.3-codex-spark", label: "5.3 Spark", defaultReasoning: "high", reasoning: ["low", "medium", "high", "xhigh"], fast: false },
];

const REASONING_LEVELS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
  { value: "max", label: "Max" },
  { value: "ultra", label: "Ultra" },
];

const SPEED_TIERS = [
  { value: "default", label: "Default" },
  { value: "fast", label: "Fast · 1.5×" },
];

function formatCodexResultMessage(result: CodexSendResult) {
  if (!result || !result.ok) return result?.output || result?.error || "Codex failed.";
  const output = result.output || "Done.";
  const details: string[] = [];
  if (Array.isArray(result.changedFiles) && result.changedFiles.length) {
    details.push(`Changed: ${result.changedFiles.slice(0, 5).join(", ")}${result.changedFiles.length > 5 ? "..." : ""}`);
  }
  return details.length ? `${output}\n\n${details.join("\n")}` : output;
}

function progressText(progress: CodexProgress | null) {
  if (!progress) return "";
  if (progress.type === "file") return `Editing ${progress.text}${progress.diff ? ` ${progress.diff}` : ""}`;
  if (progress.type === "command") return `Running ${progress.text}`;
  return progress.text;
}

export function CodexChat() {
  const project = useDocument((s) => s.project);
  const projectId = useDocument((s) => s.projectId);
  const agentBusy = useDocument((s) => s.agentBusy);
  const context = useEditor((s) => s.context);
  const breakpoint = useEditor((s) => s.breakpoint);
  const selection = useEditor((s) => s.selection);
  const [open, setOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const authState = useCodexChat((s) => s.authState);
  const setAuthState = useCodexChat((s) => s.setAuthState);
  const session = useCodexChat((s) => (projectId ? s.sessions[projectId] : undefined));
  const ensureSession = useCodexChat((s) => s.ensureSession);
  const updateSession = useCodexChat((s) => s.updateSession);
  const mutateSession = useCodexChat((s) => s.mutateSession);
  const resetSession = useCodexChat((s) => s.resetSession);
  const logRef = useRef<HTMLDivElement>(null);
  const input = session?.input ?? "";
  const messages = session?.messages ?? [];
  const progress = session?.progress ?? null;
  const pendingCustomCode = session?.pendingCustomCode ?? null;
  const busy = session?.busy ?? false;
  const model = session?.model ?? "gpt-5.6-sol";
  const reasoning = session?.reasoning ?? "low";
  const speed = session?.speed ?? "default";
  const modelConfig = CODEX_MODELS.find((option) => option.value === model) ?? CODEX_MODELS[0];
  const reasoningLevels = REASONING_LEVELS.filter((option) => modelConfig.reasoning.includes(option.value));
  const speedTiers = modelConfig.fast ? SPEED_TIERS : SPEED_TIERS.slice(0, 1);
  const authenticated = authState === "authenticated";

  const canSend = Boolean(projectId && authenticated && input.trim() && !busy && !agentBusy && !pendingCustomCode);
  const visibleMessages = useMemo(() => messages.filter((message) => message.text.trim()), [messages]);

  useEffect(() => {
    if (projectId) ensureSession(projectId);
  }, [ensureSession, projectId]);

  useEffect(() => {
    void refreshCodexAuthentication();
  }, []);

  useEffect(() => {
    if (!projectId) return;
    const events = new EventSource(eventSourceUrl(`/api/codex/events?projectId=${encodeURIComponent(projectId)}`));
    events.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as CodexProgress;
        const currentSession = useCodexChat.getState().sessions[projectId];
        if (!currentSession?.busy) return;
        updateSession(projectId, { progress: payload });
        if (payload.type === "assistant") {
          mutateSession(projectId, (current) => {
            const messages = [...current.messages];
            const last = messages[messages.length - 1];
            if (last?.role === "assistant" && busy) last.text = payload.text;
            else messages.push({ role: "assistant", text: payload.text });
            return { ...current, messages };
          });
        }
      } catch {}
    };
    return () => events.close();
  }, [busy, mutateSession, projectId, updateSession]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [visibleMessages, progress, open]);

  if (!project || !projectId) return null;

  const login = async () => {
    const generation = useCodexChat.getState().ensureSession(projectId).generation;
    setAuthBusy(true);
    updateSession(projectId, { progress: null });
    appendMessage(projectId, { role: "assistant", text: "Opening Codex login..." }, generation);
    try {
      const result = await api.codexLogin();
      if (!isCurrentChat(projectId, generation)) return;
      if (result.ok && !result.url && /already authenticated/i.test(result.output)) {
        setAuthState("authenticated");
        mutateSession(projectId, (current) => {
          const next = [...current.messages];
          const last = next[next.length - 1];
          if (last?.role === "assistant") last.text = result.output;
          else next.push({ role: "assistant", text: result.output });
          return { ...current, messages: next };
        });
        return;
      }
      if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
      const message = result.url
        ? `Finish Codex login in the browser:\n${result.url}`
        : result.output || "Finish Codex login in the browser.";
      mutateSession(projectId, (current) => {
        const next = [...current.messages];
        const last = next[next.length - 1];
        if (last?.role === "assistant") last.text = message;
        else next.push({ role: "assistant", text: message });
        return { ...current, messages: next };
      });

      for (let index = 0; index < 30; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const status = await api.codexStatus().catch(() => null);
        if (!isCurrentChat(projectId, generation)) return;
        if (status?.authenticated) {
          setAuthState("authenticated");
          appendMessage(projectId, { role: "assistant", text: "Codex authenticated." }, generation);
          return;
        }
      }
    } catch (err) {
      appendMessage(projectId, { role: "assistant", text: String((err as Error).message || err) }, generation);
    } finally {
      setAuthBusy(false);
    }
  };

  const send = async () => {
    const prompt = input.trim();
    if (!canSend || !prompt) return;
    const generation = useCodexChat.getState().ensureSession(projectId).generation;
    const conversation = visibleMessages.slice(-8);
    updateSession(projectId, { input: "" });
    updateSession(projectId, { busy: true });
    useDocument.getState().setAgentBusy(true);
    updateSession(projectId, { progress: { type: "status", text: "Thinking..." } });
    appendMessage(projectId, { role: "user", text: prompt }, generation);
    try {
      await useDocument.getState().flushSave();
      const currentProject = useDocument.getState().project;
      if (!currentProject) throw new Error("No project is open.");
      await api.codexStartSession(projectId);
      const result = await api.codexSend(projectId, {
        prompt,
        conversation,
        selection,
        model,
        reasoning,
        speed,
        projectHash: hashProject(currentProject),
        currentPageId: context?.kind === "page" ? context.pageId : undefined,
        breakpoint,
      });
      if (!isCurrentChat(projectId, generation)) return;
      mutateSession(projectId, (current) => {
        const next = [...current.messages];
        const last = next[next.length - 1];
        const text = formatCodexResultMessage(result);
        if (last?.role === "assistant") last.text = text;
        else next.push({ role: "assistant", text });
        return { ...current, messages: next };
      });
      if (result.ok && result.patchApplied && result.project) {
        useDocument.getState().applyAgentProject(result.project);
        if (result.changedNodeIds?.length) useEditor.getState().select(result.changedNodeIds.slice(0, 1));
      }
      if (result.ok && result.requiresCustomCodeApproval && result.customCodeProposal) {
        updateSession(projectId, { pendingCustomCode: result.customCodeProposal });
      }
    } catch (err) {
      appendMessage(projectId, { role: "assistant", text: String((err as Error).message || err) }, generation);
    } finally {
      if (!isCurrentChat(projectId, generation)) return;
      updateSession(projectId, { busy: false });
      useDocument.getState().setAgentBusy(false);
      updateSession(projectId, { progress: null });
    }
  };

  const applyCustomCode = async () => {
    if (!pendingCustomCode || !projectId) return;
    const generation = useCodexChat.getState().ensureSession(projectId).generation;
    updateSession(projectId, { busy: true });
    useDocument.getState().setAgentBusy(true);
    updateSession(projectId, { progress: { type: "status", text: "Applying custom code..." } });
    try {
      await useDocument.getState().flushSave();
      const currentProject = useDocument.getState().project;
      if (!currentProject) throw new Error("No project is open.");
      const result = await api.codexApplyCustomCode(projectId, {
        proposal: pendingCustomCode,
        projectHash: hashProject(currentProject),
      });
      if (!isCurrentChat(projectId, generation)) return;
      appendMessage(projectId, { role: "assistant", text: formatCodexResultMessage(result) }, generation);
      if (result.ok && result.project) {
        useDocument.getState().applyAgentProject(result.project);
        if (result.changedNodeIds?.length) useEditor.getState().select(result.changedNodeIds.slice(0, 1));
      }
      updateSession(projectId, { pendingCustomCode: null });
    } catch (err) {
      appendMessage(projectId, { role: "assistant", text: String((err as Error).message || err) }, generation);
    } finally {
      if (!isCurrentChat(projectId, generation)) return;
      updateSession(projectId, { busy: false });
      useDocument.getState().setAgentBusy(false);
      updateSession(projectId, { progress: null });
    }
  };

  const cancelCustomCode = () => {
    updateSession(projectId, { pendingCustomCode: null });
    appendMessage(projectId, { role: "assistant", text: "Custom code changes were not applied." });
  };

  const stop = async () => {
    if (!projectId) return;
    await api.codexStop(projectId).catch(() => {});
    updateSession(projectId, { busy: false });
    useDocument.getState().setAgentBusy(false);
    updateSession(projectId, { progress: null });
  };

  const refreshChat = () => {
    if (busy) void stop();
    resetSession(projectId);
  };

  return (
    <>
      <button
        className={`codex-fab ${open ? "active" : ""}`}
        title="Codex AI"
        onClick={() =>
          setOpen((value) => {
            if (!value) void refreshCodexAuthentication();
            return !value;
          })
        }
      >
        <IconSparkle />
      </button>
      {open && (
        <section className="codex-chat" aria-label="Codex AI chat">
          <header className="codex-chat-header">
            <div>
              <strong>Codex</strong>
              <span>{authLabel(authState)}</span>
            </div>
            <div className="codex-chat-header-actions">
              <button className="icon-btn" title="Refresh chat" onClick={refreshChat}>
                <IconRefresh />
              </button>
              <button className="icon-btn" title="Close" onClick={() => setOpen(false)}>
                <IconClose />
              </button>
            </div>
          </header>

          <div className="codex-chat-log" ref={logRef}>
            {authState === "unauthenticated" && (
              <div className="codex-auth">
                <button className="btn primary" disabled={authBusy} onClick={login}>
                  {authBusy ? "Opening..." : "Login to Codex"}
                </button>
              </div>
            )}
            {authState === "unavailable" && (
              <div className="codex-auth">
                <button className="btn primary" onClick={() => void refreshCodexAuthentication()}>
                  Retry connection
                </button>
              </div>
            )}
            {visibleMessages.map((message, index) => (
              <div key={index} className={`codex-message ${message.role}`}>
                {message.text}
              </div>
            ))}
            {pendingCustomCode && (
              <div className="codex-custom-approval">
                <strong>Apply custom code?</strong>
                <p>
                  This will override {project.nodes[pendingCustomCode.nodeId]?.name || pendingCustomCode.nodeId} with custom
                  HTML/CSS and gray out its properties panel.
                </p>
                {pendingCustomCode.note && <p>{pendingCustomCode.note}</p>}
                <div className="codex-custom-actions">
                  <button className="btn primary" disabled={busy || agentBusy} onClick={applyCustomCode}>
                    Yes, apply
                  </button>
                  <button className="btn" disabled={busy || agentBusy} onClick={cancelCustomCode}>
                    No
                  </button>
                </div>
              </div>
            )}
          </div>

          {authenticated && busy && progress && <div className={`codex-progress ${progress.type}`}>{progressText(progress)}</div>}

          <div className="codex-run-settings" aria-label="Codex run settings">
            <label>
              <span>Model</span>
              <select
                aria-label="Model"
                value={model}
                disabled={busy || agentBusy}
                onChange={(event) => {
                  const nextModel = CODEX_MODELS.find((option) => option.value === event.target.value) ?? CODEX_MODELS[0];
                  updateSession(projectId, {
                    model: nextModel.value,
                    reasoning: nextModel.reasoning.includes(reasoning) ? reasoning : nextModel.defaultReasoning,
                    speed: nextModel.fast ? speed : "default",
                  });
                }}
              >
                {CODEX_MODELS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Thinking</span>
              <select
                aria-label="Thinking level"
                value={reasoning}
                disabled={busy || agentBusy}
                onChange={(event) => updateSession(projectId, { reasoning: event.target.value })}
              >
                {reasoningLevels.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Speed</span>
              <select
                aria-label="Speed"
                value={speed}
                disabled={busy || agentBusy}
                onChange={(event) => updateSession(projectId, { speed: event.target.value })}
              >
                {speedTiers.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <form
            className="codex-composer"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy) void stop();
              else void send();
            }}
          >
            <textarea
              value={input}
              placeholder={authenticated ? "Ask Codex to edit this project..." : "Login to Codex first"}
              disabled={!authenticated || Boolean(pendingCustomCode)}
              onChange={(event) => updateSession(projectId, { input: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <button className={`btn ${busy ? "danger" : "primary"}`} disabled={!busy && !canSend}>
              {busy ? "Stop" : "Send"}
            </button>
          </form>
        </section>
      )}
    </>
  );
}

let authCheck: Promise<void> | null = null;

function refreshCodexAuthentication() {
  if (authCheck) return authCheck;
  const chat = useCodexChat.getState();
  if (chat.authState !== "authenticated") chat.setAuthState("checking");
  authCheck = api
    .codexStatus()
    .then((status) => {
      useCodexChat.getState().setAuthState(status.authenticated ? "authenticated" : "unauthenticated");
    })
    .catch(() => {
      useCodexChat.getState().setAuthState("unavailable");
    })
    .finally(() => {
      authCheck = null;
    });
  return authCheck;
}

function authLabel(authState: ReturnType<typeof useCodexChat.getState>["authState"]) {
  if (authState === "authenticated") return "Ready";
  if (authState === "unauthenticated") return "Login required";
  if (authState === "unavailable") return "Connection unavailable";
  return "Checking login...";
}

function appendMessage(projectId: string, message: CodexMessage, generation?: number) {
  if (generation !== undefined && !isCurrentChat(projectId, generation)) return;
  useCodexChat.getState().mutateSession(projectId, (session) => ({
    ...session,
    messages: [...session.messages, message],
  }));
}

function isCurrentChat(projectId: string, generation: number) {
  return useCodexChat.getState().ensureSession(projectId).generation === generation;
}
