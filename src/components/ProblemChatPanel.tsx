import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  PaperClipIcon,
  PaperAirplaneIcon,
  SparklesIcon,
} from "@heroicons/react/24/solid";
import type { Problem, ProblemSpec } from "../models/Leia";
import { useApiKeys } from "../hooks/useApiKeys";
import { useProviders } from "../hooks/useProviders";
import { WIDGET_CATALOG } from "../widgets/catalog";
import {
  openProblemChat,
  uploadProblemChatFile,
  sendProblemChatMessage,
  type ProblemChatTool,
  type ProblemChatToolResult,
  type UploadedFile,
} from "../lib/problemChat";

// Widget catalog context for the model: available widgetTypes + their tool
// functions, so it can decide whether the activity needs a widget (e.g. a
// coding exercise) and configure each tool's usage.
const WIDGET_TYPES = WIDGET_CATALOG.map((w) => w.widgetType);
const WIDGET_TOOL_NAMES = Array.from(
  new Set(WIDGET_CATALOG.flatMap((w) => w.tools.map((t) => t.name))),
);
const WIDGET_CATALOG_DOC = WIDGET_CATALOG.length
  ? WIDGET_CATALOG.map(
      (w) =>
        `- "${w.widgetType}": ${w.description} Tools: ${w.tools
          .map((t) => `${t.name} (${t.description})`)
          .join("; ")}`,
    ).join("\n")
  : "(none available)";

// extends / overrides / constrainedTo are keyed by component (persona /
// behaviour / problem); each component is { spec: {...}, apiVersion? }.
const COMPONENT_SCOPED_PROPS = {
  persona: { type: "object", properties: { spec: { type: "object" }, apiVersion: { type: "string" } } },
  behaviour: { type: "object", properties: { spec: { type: "object" }, apiVersion: { type: "string" } } },
  problem: { type: "object", properties: { spec: { type: "object" }, apiVersion: { type: "string" } } },
};
const componentScoped = (description: string) => ({
  type: "object",
  description,
  properties: COMPONENT_SCOPED_PROPS,
});

// The editor-driving tools. apply_problem's parameters ARE the full Problem
// spec (structured output via function calling, like the workbench widget
// tools). get_current_problem lets the model read the editor to iterate.
const CHAT_TOOLS: ProblemChatTool[] = [
  {
    name: "get_current_problem",
    description:
      "Returns the problem currently in the editor (its full spec, including any widgets). Call it before modifying an existing problem, or to match its style/solutionFormat.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "apply_problem",
    description:
      "Writes a COMPLETE problem into the editor, replacing the current one. Fill every field you reasonably can.\n\n" +
      "`extends` / `overrides` / `constrainedTo` customize the persona / behaviour / problem this activity is paired with. Each is keyed by component (`persona`, `behaviour`, `problem`); each component is `{ spec: { ...fields }, apiVersion?: \"v1\" }`. extends ADDS to a spec, overrides REPLACES fields, constrainedTo CONSTRAINS/limits. persona.spec fields: fullName, firstName, description, personality, subjectPronoum, objectPronoum, possesivePronoum, possesiveAdjective. behaviour.spec fields: description, role, process. Use them ONLY when the user asks to customize the persona/behaviour for this problem; otherwise leave them as {}. Example:\n" +
      '{ "extends": { "persona": { "spec": { "personality": ["amigable", "despistado"] } } }, "overrides": { "behaviour": { "spec": { "role": "alumno de instituto" } } }, "constrainedTo": { "behaviour": { "spec": { "process": ["requirements-elicitation"] }, "apiVersion": "v1" } } }\n\n' +
      "Add `widgets` ONLY when the activity needs an interactive tool (e.g. a coding exercise needs the code editor). Available widgets and their tool functions:\n" +
      WIDGET_CATALOG_DOC +
      "\nFor each widget tool you may set `enabled` and a `usage` note telling LEIA when to use it in this activity.",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string", description: "What the scenario/problem is about." },
        personaBackground: {
          type: "string",
          description: "Background about the persona/client in the scenario (may use {{persona.*}} tags).",
        },
        details: { type: "string", description: "Specific requirements, constraints and expected features." },
        solution: { type: "string", description: "The expected solution, in the chosen solutionFormat." },
        initialSolution: {
          type: "string",
          description: "Optional starting solution shown to the student (empty string if none).",
        },
        solutionFormat: {
          type: "string",
          enum: ["text", "mermaid", "yaml", "markdown", "html", "json", "xml"],
          description: "Format of the solution (use 'mermaid' for diagrams).",
        },
        evaluationPrompt: {
          type: "string",
          description: "Optional instructions for grading the student's solution (empty string if none).",
        },
        process: {
          type: "array",
          items: { type: "string", enum: ["requirements-elicitation", "game", "other"] },
          description: "Optional process tags.",
        },
        extends: componentScoped(
          "ADD to the paired persona/behaviour/problem spec (e.g. add persona personality traits). Empty object {} unless asked to compose.",
        ),
        overrides: componentScoped(
          "REPLACE fields in the paired persona/behaviour/problem spec (e.g. set the behaviour role). Empty object {} unless asked to override.",
        ),
        constrainedTo: componentScoped(
          "CONSTRAIN/limit the paired persona/behaviour/problem (e.g. restrict the behaviour process). Empty object {} unless asked to constrain.",
        ),
        widgets: {
          type: "array",
          description:
            "Interactive widgets for the activity (and their tool functions). Include ONLY if the activity needs one.",
          items: {
            type: "object",
            properties: {
              widgetType: { type: "string", enum: WIDGET_TYPES, description: "Which widget." },
              slot: { type: "string", enum: ["left", "right", "main"], description: "Where it mounts." },
              params: {
                type: "object",
                description:
                  "Widget configuration. codeEditor: { fnName, description, starter: { javascript, python }, tests: [{ name, args, expected }] }.",
              },
              tools: {
                type: "array",
                description: "Per-tool config for this widget's tool functions.",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", enum: WIDGET_TOOL_NAMES, description: "The tool function." },
                    enabled: { type: "boolean", description: "Whether LEIA may use it (default true)." },
                    usage: { type: "string", description: "When LEIA should use this tool in this activity." },
                  },
                  required: ["name"],
                },
              },
            },
            required: ["widgetType"],
          },
        },
      },
      required: ["description", "personaBackground", "details", "solution"],
    },
  },
];

type ChatRole = "user" | "assistant" | "system";
interface ChatMessage {
  role: ChatRole;
  text: string;
}

interface ProblemChatPanelProps {
  currentProblem: Problem | null;
  onApplyProblem: (spec: ProblemSpec) => void;
}

export const ProblemChatPanel: React.FC<ProblemChatPanelProps> = ({
  currentProblem,
  onApplyProblem,
}) => {
  const { apiKeys, getDefaultKey, isLoading: apiKeysLoading } = useApiKeys();
  const { apiKeyProvidersMapped, defaultModel, isLoading: providersLoading } = useProviders();

  // The problem-chat always runs on OpenAI (Responses API + PDF input), so only
  // OpenAI models/keys are selectable here.
  const openaiKeys = useMemo(
    () => apiKeys.filter((k) => k.provider === "openai"),
    [apiKeys],
  );
  const openaiModels = useMemo(
    () => apiKeyProvidersMapped?.openai || [],
    [apiKeyProvidersMapped],
  );

  const [selectedApiKeyId, setSelectedApiKeyId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");

  const optionsLoading = apiKeysLoading || providersLoading;

  // Seed sensible defaults once the keys/models load (default OpenAI key + model).
  useEffect(() => {
    if (optionsLoading) return;
    setSelectedApiKeyId((prev) => {
      if (prev && openaiKeys.some((k) => k.id === prev)) return prev;
      const def = getDefaultKey();
      if (def && def.provider === "openai") return def.id;
      return openaiKeys[0]?.id ?? null;
    });
    setSelectedModel((prev) => {
      if (prev && openaiModels.includes(prev)) return prev;
      if (defaultModel && openaiModels.includes(defaultModel)) return defaultModel;
      return openaiModels[0] ?? "";
    });
  }, [optionsLoading, openaiKeys, openaiModels, defaultModel, getDefaultKey]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Always read the freshest problem when the model calls get_current_problem.
  const currentProblemRef = useRef<Problem | null>(currentProblem);
  currentProblemRef.current = currentProblem;

  const ready = Boolean(selectedModel && selectedApiKeyId);
  const hasOpenaiKeys = openaiKeys.length > 0;

  // Changing the model/key invalidates the server-side session.
  useEffect(() => {
    chatIdRef.current = null;
  }, [selectedModel, selectedApiKeyId]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const pushMessage = (role: ChatRole, text: string) =>
    setMessages((prev) => [...prev, { role, text }]);

  const stripAvatar = (spec: Record<string, unknown>): ProblemSpec => {
    const { avatar: _avatar, ...rest } = spec;
    return rest as unknown as ProblemSpec;
  };

  const ensureSession = useCallback(async (): Promise<string> => {
    if (chatIdRef.current) return chatIdRef.current;
    if (!selectedModel || !selectedApiKeyId) throw new Error("Select a model and API key first");
    const chatId = await openProblemChat(selectedModel, selectedApiKeyId);
    chatIdRef.current = chatId;
    return chatId;
  }, [selectedModel, selectedApiKeyId]);

  const handleAttach = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const chatId = await ensureSession();
      const uploaded = await uploadProblemChatFile(chatId, file);
      setAttachments((prev) => [...prev, uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach the PDF");
    } finally {
      setUploading(false);
    }
  };

  // One user turn → loop while the model returns tool calls.
  const runTurn = async (chatId: string, message: string): Promise<string> => {
    // Send the uploaded PDF ids with the turn so the runner attaches them even
    // if the session was re-opened; it only attaches each one once.
    let response = await sendProblemChatMessage(chatId, {
      message,
      tools: CHAT_TOOLS,
      fileIds: attachments.map((a) => a.fileId),
    });
    for (let i = 0; i < 8; i++) {
      const calls = response.toolCalls;
      if (!Array.isArray(calls) || calls.length === 0) break;

      const results: ProblemChatToolResult[] = calls.map((call) => {
        let output: unknown;
        let args: Record<string, unknown> = {};
        try {
          args = call.arguments ? JSON.parse(call.arguments) : {};
        } catch {
          args = {};
        }
        if (call.name === "apply_problem") {
          onApplyProblem(stripAvatar(args));
          pushMessage("system", "✓ Problem applied to the editor.");
          output = { status: "applied" };
        } else if (call.name === "get_current_problem") {
          output = currentProblemRef.current?.spec ?? null;
        } else {
          output = { error: `unknown tool '${call.name}'` };
        }
        return { callId: call.callId, output };
      });

      response = await sendProblemChatMessage(chatId, { toolResults: results, tools: CHAT_TOOLS });
    }
    return response.message ?? "";
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setInput("");
    pushMessage("user", text);
    setSending(true);
    try {
      const chatId = await ensureSession();
      const reply = await runTurn(chatId, text);
      if (reply) pushMessage("assistant", reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant failed to respond");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200">
        <SparklesIcon className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold text-gray-800">AI Assistant</span>
      </div>

      {/* Model + API key selectors (OpenAI only — the assistant runs on OpenAI). */}
      <div className="px-3 py-2 border-b border-gray-100">
        {hasOpenaiKeys ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={optionsLoading}
                className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">{optionsLoading ? "Loading…" : "-- model --"}</option>
                {openaiModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">API Key</label>
              <select
                value={selectedApiKeyId ?? ""}
                onChange={(e) => setSelectedApiKeyId(e.target.value || null)}
                disabled={optionsLoading}
                className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">{optionsLoading ? "Loading…" : "-- key --"}</option>
                {openaiKeys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.description}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-amber-700">
            {optionsLoading ? (
              "Loading API keys…"
            ) : (
              <>
                No OpenAI API key available.{" "}
                <Link to="/administration/api-keys" className="text-blue-600 underline">
                  Create one
                </Link>{" "}
                to use the assistant.
              </>
            )}
          </div>
        )}
      </div>

      {/* Transcript */}
      <div ref={transcriptRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-[160px]">
        {messages.length === 0 ? (
          <div className="text-xs text-gray-400 italic">
            Attach a PDF of a past exercise and ask me to turn it into a problem, or describe a
            new one (e.g. "make a problem about deadlock detection"). I'll write it into the editor.
          </div>
        ) : (
          messages.map((msg, i) => {
            if (msg.role === "system") {
              return (
                <div key={i} className="text-[11px] text-green-700 bg-green-50 rounded px-2 py-1">
                  {msg.text}
                </div>
              );
            }
            const isUser = msg.role === "user";
            return (
              <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                    isUser
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        {sending && <div className="text-xs text-gray-400 italic">Thinking…</div>}
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 flex flex-wrap gap-2">
          {attachments.map((file) => (
            <span
              key={file.fileId}
              className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-600"
            >
              <PaperClipIcon className="h-3 w-3" />
              {file.filename}
            </span>
          ))}
        </div>
      )}

      {error && <div className="px-3 py-1 text-[11px] text-red-600">{error}</div>}

      {/* Composer */}
      <div className="border-t border-gray-200 p-2">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleAttach}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!ready || uploading || sending}
            title="Attach a PDF"
            className="p-2 text-gray-500 hover:text-blue-600 disabled:opacity-40"
          >
            {uploading ? (
              <span className="block h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            ) : (
              <PaperClipIcon className="h-5 w-5" />
            )}
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!ready || sending}
            rows={1}
            placeholder={ready ? "Describe the problem or ask to convert the PDF…" : "Select a model and key…"}
            className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
            style={{ maxHeight: 120 }}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!ready || sending || !input.trim()}
            className="p-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export type { ProblemChatPanelProps };
