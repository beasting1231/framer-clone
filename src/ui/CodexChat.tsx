import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { nanoid } from "nanoid";
import { api, eventSourceUrl, type CodexImageAttachment, type CodexMessage, type CodexProgress, type CodexSendResult } from "@/api/client";
import { hashProject } from "@/model/projectHash";
import { useCodexChat } from "@/store/codexChat";
import { useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";
import { IconArrowUp, IconCheck, IconClose, IconPencil, IconRefresh, IconSparkle, IconStop } from "./icons";

type SelectOption = { value: string; label: string };

function ChatSelect({
  ariaLabel,
  value,
  options,
  disabled,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div className={`codex-custom-select ${open ? "open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="codex-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label}</span>
        <i aria-hidden="true" />
      </button>
      {open && (
        <div className="codex-select-menu" id={menuId} role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                type="button"
                className={isSelected ? "selected" : ""}
                role="option"
                aria-selected={isSelected}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {isSelected && <IconCheck />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatRef = useRef<HTMLElement>(null);
  const focusComposerOnOpenRef = useRef(false);
  const dragControls = useDragControls();
  const [dragConstraints, setDragConstraints] = useState({ left: 0, right: 0, top: 0, bottom: 0 });
  const input = session?.input ?? "";
  const inputImages = session?.inputImages ?? [];
  const promptQueue = session?.promptQueue ?? [];
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
  const [interruptingQueueId, setInterruptingQueueId] = useState<string | null>(null);

  const canSend = Boolean(projectId && authenticated && (input.trim() || inputImages.length) && !busy && !agentBusy && !pendingCustomCode && !interruptingQueueId);
  const visibleMessages = useMemo(() => messages.filter((message) => message.text.trim() || message.images?.length), [messages]);

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

  useEffect(() => {
    if (!projectId) return;
    const toggleChatWithTab = (event: KeyboardEvent) => {
      if (
        event.key !== "Tab" ||
        event.shiftKey ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.repeat ||
        event.isComposing
      ) {
        return;
      }
      event.preventDefault();
      setOpen((current) => {
        focusComposerOnOpenRef.current = !current;
        if (!current) void refreshCodexAuthentication();
        return !current;
      });
    };
    window.addEventListener("keydown", toggleChatWithTab);
    return () => window.removeEventListener("keydown", toggleChatWithTab);
  }, [projectId]);

  const updateDragConstraints = useCallback(() => {
    const element = chatRef.current;
    if (!element) return;
    const left = element.offsetLeft;
    const top = element.offsetTop;
    setDragConstraints({
      left: -left,
      right: window.innerWidth - left - element.offsetWidth,
      top: -top,
      bottom: window.innerHeight - top - element.offsetHeight,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateDragConstraints();
    window.addEventListener("resize", updateDragConstraints);
    return () => window.removeEventListener("resize", updateDragConstraints);
  }, [open, updateDragConstraints]);

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

  async function runPrompt(promptText: string, images: CodexImageAttachment[] = []) {
    if (!projectId) return;
    const prompt = promptText.trim();
    const currentSession = useCodexChat.getState().ensureSession(projectId);
    if (!authenticated || (!prompt && !images.length) || currentSession.busy || currentSession.pendingCustomCode) return;
    const generation = currentSession.generation;
    const runId = currentSession.runId + 1;
    const conversation = currentSession.messages
      .filter((message) => message.text.trim())
      .slice(-8)
      .map(({ role, text }) => ({ role, text }));
    updateSession(projectId, { busy: true, runId, progress: { type: "status", text: "Thinking..." } });
    useDocument.getState().setAgentBusy(true);
    appendMessage(projectId, { role: "user", text: prompt, images }, generation);
    try {
      await useDocument.getState().flushSave();
      const currentProject = useDocument.getState().project;
      if (!currentProject) throw new Error("No project is open.");
      await api.codexStartSession(projectId);
      const result = await api.codexSend(projectId, {
        prompt,
        images,
        conversation,
        selection,
        model,
        reasoning,
        speed,
        projectHash: hashProject(currentProject),
        currentPageId: context?.kind === "page" ? context.pageId : undefined,
        breakpoint,
      });
      if (!isCurrentRun(projectId, generation, runId)) return;
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
      if (isCurrentRun(projectId, generation, runId)) {
        appendMessage(projectId, { role: "assistant", text: String((err as Error).message || err) }, generation);
      }
    } finally {
      if (!isCurrentRun(projectId, generation, runId)) return;
      updateSession(projectId, { busy: false });
      useDocument.getState().setAgentBusy(false);
      updateSession(projectId, { progress: null });
      window.setTimeout(() => processNextQueuedPrompt(generation), 0);
    }
  }

  function queueDraft() {
    if (!projectId) return;
    const current = useCodexChat.getState().ensureSession(projectId);
    const prompt = current.input.trim();
    if (!authenticated || (!prompt && !current.inputImages.length) || pendingCustomCode) return;
    mutateSession(projectId, (current) => ({
      ...current,
      input: "",
      inputImages: [],
      promptQueue: [...current.promptQueue, { id: nanoid(), text: prompt, images: current.inputImages }],
    }));
  }

  function submitDraft() {
    if (!projectId) return;
    const current = useCodexChat.getState().ensureSession(projectId);
    const prompt = current.input.trim();
    const images = current.inputImages;
    if (!prompt && !images.length) return;
    if (current.busy || interruptingQueueId) {
      queueDraft();
      return;
    }
    updateSession(projectId, { input: "", inputImages: [] });
    void runPrompt(prompt, images);
  }

  function processNextQueuedPrompt(generation: number) {
    if (!projectId) return;
    const current = useCodexChat.getState().ensureSession(projectId);
    if (
      current.generation !== generation ||
      current.busy ||
      current.pendingCustomCode ||
      !current.promptQueue.length
    ) {
      return;
    }
    const [next, ...remaining] = current.promptQueue;
    updateSession(projectId, { promptQueue: remaining });
    void runPrompt(next.text, next.images);
  }

  function editQueuedPrompt(id: string) {
    if (!projectId) return;
    const queued = useCodexChat.getState().ensureSession(projectId).promptQueue.find((item) => item.id === id);
    if (!queued) return;
    mutateSession(projectId, (current) => ({
      ...current,
      input: queued.text,
      inputImages: queued.images,
      promptQueue: current.promptQueue.filter((item) => item.id !== id),
    }));
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(queued.text.length, queued.text.length);
    });
  }

  function deleteQueuedPrompt(id: string) {
    if (!projectId) return;
    mutateSession(projectId, (current) => ({
      ...current,
      promptQueue: current.promptQueue.filter((item) => item.id !== id),
    }));
  }

  async function interruptWithQueuedPrompt(id: string) {
    if (!projectId) return;
    const current = useCodexChat.getState().ensureSession(projectId);
    const queued = current.promptQueue.find((item) => item.id === id);
    if (!queued || interruptingQueueId) return;
    const generation = current.generation;
    setInterruptingQueueId(id);
    mutateSession(projectId, (session) => ({
      ...session,
      busy: false,
      progress: null,
      runId: session.runId + 1,
      promptQueue: session.promptQueue.filter((item) => item.id !== id),
    }));
    useDocument.getState().setAgentBusy(false);
    try {
      await api.codexStop(projectId);
      setInterruptingQueueId(null);
      if (isCurrentChat(projectId, generation)) void runPrompt(queued.text, queued.images);
    } catch (err) {
      if (isCurrentChat(projectId, generation)) {
        appendMessage(projectId, { role: "assistant", text: String((err as Error).message || err) }, generation);
      }
    } finally {
      setInterruptingQueueId(null);
    }
  }

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
      window.setTimeout(() => processNextQueuedPrompt(generation), 0);
    }
  };

  const cancelCustomCode = () => {
    updateSession(projectId, { pendingCustomCode: null });
    appendMessage(projectId, { role: "assistant", text: "Custom code changes were not applied." });
    window.setTimeout(() => processNextQueuedPrompt(useCodexChat.getState().ensureSession(projectId).generation), 0);
  };

  const stop = async () => {
    if (!projectId) return;
    mutateSession(projectId, (current) => ({
      ...current,
      busy: false,
      progress: null,
      runId: current.runId + 1,
    }));
    useDocument.getState().setAgentBusy(false);
    await api.codexStop(projectId).catch(() => {});
  };

  const refreshChat = async () => {
    if (busy) await stop();
    resetSession(projectId);
  };

  async function handlePastedImages(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    if (!projectId) return;
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (!files.length) return;
    event.preventDefault();
    const current = useCodexChat.getState().ensureSession(projectId);
    const availableSlots = Math.max(0, 8 - current.inputImages.length);
    const generation = current.generation;
    const attachments = await Promise.all(
      files.slice(0, availableSlots).map(async (file, index) => ({
        id: nanoid(),
        name: file.name || `Pasted image ${current.inputImages.length + index + 1}`,
        dataUrl: await readFileAsDataUrl(file),
      })),
    );
    if (!attachments.length || !isCurrentChat(projectId, generation)) return;
    mutateSession(projectId, (session) => ({
      ...session,
      inputImages: [...session.inputImages, ...attachments].slice(0, 8),
    }));
  }

  function removeInputImage(id: string) {
    if (!projectId) return;
    mutateSession(projectId, (current) => ({
      ...current,
      inputImages: current.inputImages.filter((image) => image.id !== id),
    }));
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!open ? (
        <motion.button
          key="codex-launcher"
          className="codex-fab"
          title="Codex AI (Tab)"
          initial={{ opacity: 0, scale: 0.78 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.78 }}
          transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => {
            focusComposerOnOpenRef.current = false;
            void refreshCodexAuthentication();
            setOpen(true);
          }}
        >
          <IconSparkle />
        </motion.button>
      ) : (
        <motion.section
          key="codex-chat"
          ref={chatRef}
          className="codex-chat"
          aria-label="Codex AI chat"
          drag
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={dragConstraints}
          dragElastic={0}
          dragMomentum={false}
          initial={{ opacity: 0, y: 14, scale: 0.955 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={() => {
            updateDragConstraints();
            focusComposerOnOpenRef.current = false;
          }}
        >
          <header
            className="codex-chat-header"
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest("button")) return;
              dragControls.start(event);
            }}
          >
            <div>
              <strong>Codex</strong>
              <span>{authLabel(authState)}</span>
            </div>
            <div className="codex-chat-header-actions">
              <button className="icon-btn" title="Refresh chat" onClick={refreshChat}>
                <IconRefresh />
              </button>
              <button className="icon-btn" title="Close (Tab)" onClick={() => setOpen(false)}>
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
                {message.images?.length ? (
                  <div className="codex-message-images">
                    {message.images.map((image) => (
                      <img src={image.dataUrl} alt={image.name} key={image.id} />
                    ))}
                  </div>
                ) : null}
                {message.text ? <div className="codex-message-text">{message.text}</div> : null}
              </div>
            ))}
            {pendingCustomCode && (
              <div className="codex-custom-approval">
                <strong>Apply custom code?</strong>
                <p>
                  This will override {project.nodes[pendingCustomCode.nodeId]?.name || pendingCustomCode.nodeId} with custom
                  HTML/CSS{pendingCustomCode.behaviors?.length ? ` and ${pendingCustomCode.behaviors.length} scoped interaction${pendingCustomCode.behaviors.length === 1 ? "" : "s"}` : ""} and gray out its properties panel.
                </p>
                {pendingCustomCode.behaviors?.length ? (
                  <div className="codex-custom-capabilities">
                    {[...new Set(pendingCustomCode.behaviors.map((behavior) => behavior.event))].map((event) => (
                      <span key={event}>{event}</span>
                    ))}
                  </div>
                ) : null}
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

          <AnimatePresence initial={false}>
            {promptQueue.length > 0 && (
              <motion.div
                className="codex-prompt-queue"
                aria-label="Queued messages"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
              >
                {promptQueue.map((queued, index) => (
                  <motion.div
                    className="codex-queued-prompt"
                    key={queued.id}
                    layout
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                  >
                    <div className="codex-queued-copy">
                      <span>{index === 0 ? "Next" : `Queued ${index + 1}`}</span>
                      {queued.images.length ? (
                        <div className="codex-queued-images" aria-label={`${queued.images.length} attached image${queued.images.length === 1 ? "" : "s"}`}>
                          {queued.images.slice(0, 3).map((image) => <img src={image.dataUrl} alt="" key={image.id} />)}
                          {queued.images.length > 3 ? <b>+{queued.images.length - 3}</b> : null}
                        </div>
                      ) : null}
                      {queued.text ? <p>{queued.text}</p> : null}
                    </div>
                    <div className="codex-queued-actions">
                      <button type="button" aria-label="Edit queued message" title="Edit" onClick={() => editQueuedPrompt(queued.id)}>
                        <IconPencil />
                      </button>
                      <button
                        type="button"
                        aria-label="Send queued message now"
                        title="Send now and interrupt"
                        disabled={Boolean(interruptingQueueId)}
                        onClick={() => void interruptWithQueuedPrompt(queued.id)}
                      >
                        <IconArrowUp />
                      </button>
                      <button type="button" aria-label="Delete queued message" title="Delete" onClick={() => deleteQueuedPrompt(queued.id)}>
                        <IconClose />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <form
            className="codex-composer"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy) void stop();
              else submitDraft();
            }}
          >
            <div className="codex-composer-field">
              {inputImages.length ? (
                <div className="codex-input-images" aria-label="Attached images">
                  {inputImages.map((image) => (
                    <div className="codex-input-image" key={image.id}>
                      <img src={image.dataUrl} alt={image.name} />
                      <button type="button" aria-label={`Remove ${image.name}`} title="Remove image" onClick={() => removeInputImage(image.id)}>
                        <IconClose />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <textarea
                ref={inputRef}
                autoFocus={focusComposerOnOpenRef.current}
                value={input}
                placeholder={authenticated ? (busy ? "Queue your next message..." : "Ask Codex to edit this project...") : "Login to Codex first"}
                disabled={!authenticated || Boolean(pendingCustomCode)}
                onChange={(event) => updateSession(projectId, { input: event.target.value })}
                onPaste={(event) => void handlePastedImages(event)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    submitDraft();
                  }
                }}
              />
              <div className="codex-composer-footer">
                <div className="codex-run-settings" aria-label="Codex run settings">
                  <ChatSelect
                    ariaLabel="Model"
                    value={model}
                    options={CODEX_MODELS}
                    disabled={busy || agentBusy}
                    onChange={(value) => {
                      const nextModel = CODEX_MODELS.find((option) => option.value === value) ?? CODEX_MODELS[0];
                      updateSession(projectId, {
                        model: nextModel.value,
                        reasoning: nextModel.reasoning.includes(reasoning) ? reasoning : nextModel.defaultReasoning,
                        speed: nextModel.fast ? speed : "default",
                      });
                    }}
                  />
                  <ChatSelect
                    ariaLabel="Thinking level"
                    value={reasoning}
                    options={reasoningLevels}
                    disabled={busy || agentBusy}
                    onChange={(value) => updateSession(projectId, { reasoning: value })}
                  />
                  <ChatSelect
                    ariaLabel="Speed"
                    value={speed}
                    options={speedTiers}
                    disabled={busy || agentBusy}
                    onChange={(value) => updateSession(projectId, { speed: value })}
                  />
                </div>
                <button
                  type="submit"
                  className={`codex-submit ${busy ? "stop" : ""}`}
                  aria-label={busy ? "Stop Codex" : "Send message"}
                  title={busy ? "Stop" : "Send"}
                  disabled={!busy && !canSend}
                >
                  {busy ? <IconStop /> : <IconArrowUp />}
                </button>
              </div>
            </div>
          </form>
        </motion.section>
      )}
    </AnimatePresence>
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

function isCurrentRun(projectId: string, generation: number, runId: number) {
  const session = useCodexChat.getState().ensureSession(projectId);
  return session.generation === generation && session.runId === runId;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read the pasted image."));
    reader.readAsDataURL(file);
  });
}
