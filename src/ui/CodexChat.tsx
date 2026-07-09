import { useEffect, useMemo, useRef, useState } from "react";
import { api, eventSourceUrl, type CodexMessage, type CodexProgress, type CodexSendResult } from "@/api/client";
import { hashProject } from "@/model/projectHash";
import { useDocument } from "@/store/document";
import { useEditor } from "@/store/editor";
import { IconClose, IconSparkle } from "./icons";

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
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<CodexMessage[]>([]);
  const [progress, setProgress] = useState<CodexProgress | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const canSend = Boolean(projectId && authenticated && input.trim() && !busy && !agentBusy);
  const visibleMessages = useMemo(() => messages.filter((message) => message.text.trim()), [messages]);

  useEffect(() => {
    api
      .codexStatus()
      .then((status) => {
        setAuthenticated(Boolean(status.authenticated));
        if (!status.authenticated) setProgress(null);
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    const events = new EventSource(eventSourceUrl(`/api/codex/events?projectId=${encodeURIComponent(projectId)}`));
    events.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as CodexProgress;
        setProgress(payload);
        if (payload.type === "assistant") {
          setMessages((current) => {
            const next = [...current];
            const last = next[next.length - 1];
            if (last?.role === "assistant" && busy) last.text = payload.text;
            else next.push({ role: "assistant", text: payload.text });
            return next;
          });
        }
      } catch {}
    };
    return () => events.close();
  }, [projectId, busy]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [visibleMessages, progress, open]);

  if (!project || !projectId) return null;

  const login = async () => {
    setAuthBusy(true);
    setProgress(null);
    setMessages((current) => [...current, { role: "assistant", text: "Opening Codex login..." }]);
    try {
      const result = await api.codexLogin();
      if (result.ok && !result.url && /already authenticated/i.test(result.output)) {
        setAuthenticated(true);
        setAuthChecked(true);
        setMessages((current) => {
          const next = [...current];
          const last = next[next.length - 1];
          if (last?.role === "assistant") last.text = result.output;
          else next.push({ role: "assistant", text: result.output });
          return next;
        });
        return;
      }
      if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
      const message = result.url
        ? `Finish Codex login in the browser:\n${result.url}`
        : result.output || "Finish Codex login in the browser.";
      setMessages((current) => {
        const next = [...current];
        const last = next[next.length - 1];
        if (last?.role === "assistant") last.text = message;
        else next.push({ role: "assistant", text: message });
        return next;
      });

      for (let index = 0; index < 30; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const status = await api.codexStatus().catch(() => null);
        if (status?.authenticated) {
          setAuthenticated(true);
          setAuthChecked(true);
          setMessages((current) => [...current, { role: "assistant", text: "Codex authenticated." }]);
          return;
        }
      }
    } catch (err) {
      setMessages((current) => [...current, { role: "assistant", text: String((err as Error).message || err) }]);
    } finally {
      setAuthBusy(false);
    }
  };

  const send = async () => {
    const prompt = input.trim();
    if (!canSend || !prompt) return;
    const conversation = visibleMessages.slice(-8);
    setInput("");
    setBusy(true);
    useDocument.getState().setAgentBusy(true);
    setProgress({ type: "status", text: "Thinking..." });
    setMessages((current) => [...current, { role: "user", text: prompt }]);
    try {
      await useDocument.getState().flushSave();
      const currentProject = useDocument.getState().project;
      if (!currentProject) throw new Error("No project is open.");
      await api.codexStartSession(projectId);
      const result = await api.codexSend(projectId, {
        prompt,
        conversation,
        selection,
        projectHash: hashProject(currentProject),
        currentPageId: context?.kind === "page" ? context.pageId : undefined,
        breakpoint,
      });
      setMessages((current) => {
        const next = [...current];
        const last = next[next.length - 1];
        const text = formatCodexResultMessage(result);
        if (last?.role === "assistant") last.text = text;
        else next.push({ role: "assistant", text });
        return next;
      });
      if (result.ok && result.patchApplied && result.project) {
        useDocument.getState().applyAgentProject(result.project);
        if (result.changedNodeIds?.length) useEditor.getState().select(result.changedNodeIds.slice(0, 1));
      }
    } catch (err) {
      setMessages((current) => [...current, { role: "assistant", text: String((err as Error).message || err) }]);
    } finally {
      setBusy(false);
      useDocument.getState().setAgentBusy(false);
      setProgress(null);
    }
  };

  const stop = async () => {
    if (!projectId) return;
    await api.codexStop(projectId).catch(() => {});
    setBusy(false);
    useDocument.getState().setAgentBusy(false);
    setProgress(null);
  };

  return (
    <>
      <button className={`codex-fab ${open ? "active" : ""}`} title="Codex AI" onClick={() => setOpen((value) => !value)}>
        <IconSparkle />
      </button>
      {open && (
        <section className="codex-chat" aria-label="Codex AI chat">
          <header className="codex-chat-header">
            <div>
              <strong>Codex</strong>
              <span>{authChecked ? (authenticated ? "Ready" : "Login required") : "Checking login..."}</span>
            </div>
            <button className="icon-btn" title="Close" onClick={() => setOpen(false)}>
              <IconClose />
            </button>
          </header>

          <div className="codex-chat-log" ref={logRef}>
            {authChecked && !authenticated && (
              <div className="codex-auth">
                <button className="btn primary" disabled={authBusy} onClick={login}>
                  {authBusy ? "Opening..." : "Login to Codex"}
                </button>
              </div>
            )}
            {visibleMessages.map((message, index) => (
              <div key={index} className={`codex-message ${message.role}`}>
                {message.text}
              </div>
            ))}
          </div>

          {authenticated && busy && progress && <div className={`codex-progress ${progress.type}`}>{progressText(progress)}</div>}

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
              disabled={!authenticated}
              onChange={(event) => setInput(event.target.value)}
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
