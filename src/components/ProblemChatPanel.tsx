import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  PaperClipIcon,
  PaperAirplaneIcon,
  SparklesIcon,
} from "@heroicons/react/24/solid";
import type { Problem, ProblemSpec } from "../models/Leia";
import {
  openProblemChat,
  uploadProblemChatFile,
  sendProblemChatMessage,
  type ProblemChatTool,
  type ProblemChatToolResult,
  type UploadedFile,
} from "../lib/problemChat";

// The editor-driving tools the model can call. apply_problem's parameters ARE
// the Problem spec — this is how we get structured output via function calling
// (same pattern as the workbench widget tools). get_current_problem lets the
// model read the editor to iterate on an existing problem.
const CHAT_TOOLS: ProblemChatTool[] = [
  {
    name: "get_current_problem",
    description:
      "Returns the problem currently in the editor (its spec fields). Call it before modifying an existing problem, or to match its style/solutionFormat.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "apply_problem",
    description:
      "Writes a COMPLETE problem into the editor, replacing the current one. Call it once you have enough information (from the conversation and/or an attached PDF) to produce a coherent problem.",
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
        solutionFormat: {
          type: "string",
          enum: ["text", "mermaid", "yaml", "markdown", "html", "json", "xml"],
          description: "Format of the solution (use 'mermaid' for diagrams).",
        },
        process: {
          type: "array",
          items: { type: "string" },
          description: "Optional process tags, e.g. ['requirements-elicitation'].",
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
  modelName: string | null | undefined;
  apiKeyId: string | null | undefined;
  currentProblem: Problem | null;
  onApplyProblem: (spec: ProblemSpec) => void;
}

export const ProblemChatPanel: React.FC<ProblemChatPanelProps> = ({
  modelName,
  apiKeyId,
  currentProblem,
  onApplyProblem,
}) => {
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

  const ready = Boolean(modelName && apiKeyId);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const pushMessage = (role: ChatRole, text: string) =>
    setMessages((prev) => [...prev, { role, text }]);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (chatIdRef.current) return chatIdRef.current;
    if (!modelName || !apiKeyId) throw new Error("Select a model and API key first");
    const chatId = await openProblemChat(modelName, apiKeyId);
    chatIdRef.current = chatId;
    return chatId;
  }, [modelName, apiKeyId]);

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

  // One user turn → loop while the model returns tool calls. apply_problem
  // writes to the editor; get_current_problem reads it back.
  const runTurn = async (chatId: string, message: string): Promise<string> => {
    let response = await sendProblemChatMessage(chatId, { message, tools: CHAT_TOOLS });
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
          onApplyProblem(args as unknown as ProblemSpec);
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
        <span className="ml-auto text-[11px] text-gray-400">
          {modelName ? modelName : "no model"}
        </span>
      </div>

      {!ready && (
        <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-200">
          Select a model and API key (Try settings) to use the assistant.
        </div>
      )}

      {/* Transcript */}
      <div ref={transcriptRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-[200px]">
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
            placeholder={ready ? "Describe the problem or ask to convert the PDF…" : "Select a model first…"}
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
