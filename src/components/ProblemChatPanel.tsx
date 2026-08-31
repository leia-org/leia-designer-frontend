import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SendIcon from "@mui/icons-material/Send";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { keyframes } from "@mui/material/styles";
import type { Problem, ProblemSpec, Behaviour, Persona } from "../models/Leia";
import type { RubricDefinition } from "../models/Rubric";
import { WIDGET_CATALOG } from "../widgets/catalog";
import {
  openProblemChat,
  uploadProblemChatFile,
  sendProblemChatMessage,
  type ProblemChatTool,
  type ProblemChatToolResult,
  type UploadedFile,
} from "../lib/problemChat";
import { validateRubricSemantics } from "../lib/rubrics";
import { getRubricSchema, validateAgainstRubricSchema, type JsonSchema } from "../lib/rubricSchema";
import { normalizeProcessFields } from "../lib/process";

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

const EXAMPLE_PROMPT =
  "Create a requirements-elicitation activity about a library booking system";

const thinkingDot = keyframes`
  0%, 80%, 100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-4px);
  }
`;

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
        name: { type: "string", description: "Short kebab-case name for the problem resource (e.g. 'deadlock-detection'). Set it so the instructor doesn't have to rename it." },
        description: { type: "string", description: "What the scenario/problem is about." },
        personaBackground: {
          type: "string",
          description: "Background about the persona/client in the scenario (may use {{persona.*}} tags).",
        },
        details: { type: "string", description: "Specific requirements, constraints and expected features." },
        solution: { type: "string", description: "The expected solution, in the chosen solutionFormat." },
        initialSolution: {
          type: "string",
          description: "Optional starting solution shown to the student. Use an empty string when none is needed; it will not be persisted.",
        },
        solutionFormat: {
          type: "string",
          enum: ["text", "mermaid", "yaml", "markdown", "html", "json", "xml"],
          description: "Format of the solution (use 'mermaid' for diagrams).",
        },
        evaluationPrompt: {
          type: "string",
          description: "Optional instructions for grading the student's solution. Use an empty string when none is needed; it will not be persisted.",
        },
        process: {
          type: "array",
          items: { type: "string", enum: ["requirements-elicitation", "game", "other"] },
          description: "Activity process tags. 'other' is exclusive: never combine it with 'requirements-elicitation' or 'game'. This is the source of truth for the LEIA, so use the exact same list when applying its behaviour.",
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
  {
    name: "get_current_behaviour",
    description:
      "Returns the behaviour currently selected for the LEIA (its spec). Call it before modifying an existing behaviour, or to match its style.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "apply_behaviour",
    description:
      "Writes a NEW, COMPLETE behaviour into the editor, replacing the current one. It must be written specifically for the exact current Problem, including its real task, subject, technology or programming language where relevant. Never reuse content from another exercise just because its language or process matches. The behaviour defines the role the AI plays opposite the student (e.g. a client being interviewed, a teammate). Use {{persona.firstName}}-style template tags where natural. Its `process` MUST exactly match the Problem `process`; call get_current_problem first when a problem already exists. Set `name` so the instructor doesn't have to rename it.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short kebab-case name for the behaviour resource (e.g. 'client-interviewee')." },
        description: { type: "string", description: "Detailed behavioural instructions for the role the AI plays (how it acts, what it knows/withholds)." },
        role: { type: "string", description: "Role name the AI plays (e.g. 'cliente', 'alumno de instituto')." },
        process: {
          type: "array",
          items: { type: "string", enum: ["requirements-elicitation", "game", "other"] },
          description: "Must exactly match the current Problem process tags. 'other' must be the only value when used.",
        },
        tooltip: { type: "string", description: "Short helper tooltip describing this behaviour." },
      },
      required: ["description", "role"],
    },
  },
  {
    name: "get_current_persona",
    description:
      "Returns the persona currently selected for the LEIA (its spec). Call it before modifying an existing persona, or to match its style.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "apply_persona",
    description:
      "Writes a COMPLETE persona into the editor, replacing the current one. The persona is the character the AI embodies (name, background, personality, pronouns). Set `name` so the instructor doesn't have to rename it.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short kebab-case name for the persona resource (e.g. 'marta-product-owner')." },
        fullName: { type: "string", description: "Full name of the persona." },
        firstName: { type: "string", description: "First name of the persona." },
        description: { type: "string", description: "Who this persona is: background, context, what they care about." },
        personality: { type: "string", description: "Personality traits (e.g. 'amigable, despistada, impaciente')." },
        subjectPronoum: { type: "string", description: "Subject pronoun (e.g. 'ella', 'he')." },
        objectPronoum: { type: "string", description: "Object pronoun (e.g. 'la', 'him')." },
        possesivePronoum: { type: "string", description: "Possessive pronoun (e.g. 'suyo', 'his')." },
        possesiveAdjective: { type: "string", description: "Possessive adjective (e.g. 'su', 'his')." },
      },
      required: ["firstName", "description"],
    },
  },
  {
    name: "get_current_rubric",
    description:
      "Returns the rubric currently prepared for the LEIA. Call it before revising an existing rubric.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "apply_rubric",
    description:
      "Writes a COMPLETE structured evaluation rubric for the exact current Problem. Levels must be ordered from worst to best, section weights must total 100, and every criterion must contain exactly one descriptor for every section level.",
    parameters: { type: "object", properties: {} },
    strict: true,
  },
  {
    name: "list_personas",
    description:
      "Lists existing personas the instructor can reuse. Prefer a suitable existing persona and only create a new one when none fits.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "use_persona",
    description:
      "Selects an existing persona by id from list_personas instead of creating a duplicate.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Persona id returned by list_personas." },
      },
      required: ["id"],
    },
  },
  {
    name: "set_leia_name",
    description:
      "Suggests a short, clear learner-facing title for the complete LEIA. Call this after you understand the activity, and call it again only if the activity changes materially.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "A concise human-readable LEIA title, not kebab-case.",
        },
      },
      required: ["name"],
    },
  },
];

export type ProblemChatRole = "user" | "assistant" | "system";

export interface ProblemChatMessage {
  role: ProblemChatRole;
  text: string;
}

export interface ProblemChatState {
  messages: ProblemChatMessage[];
  input: string;
}

type ChatRole = ProblemChatRole;
type ChatMessage = ProblemChatMessage;

interface ProblemChatPanelProps {
  currentProblem: Problem | null;
  currentBehaviour: Behaviour | null;
  currentPersona: Persona | null;
  currentRubric: RubricDefinition | null;
  personas: Persona[];
  onApplyProblem: (spec: ProblemSpec, name?: string) => void;
  onApplyBehaviour: (spec: Record<string, unknown>, name?: string) => void;
  onApplyPersona: (spec: Record<string, unknown>, name?: string) => void;
  onApplyRubric: (rubric: RubricDefinition) => void;
  onUsePersona: (id: string) => { ok: boolean; name?: string };
  onSetLeiaName?: (name: string) => void;
  modelName: string;
  apiKeyId: string | null;
  initialChatState?: ProblemChatState;
  onChatStateChange?: (state: ProblemChatState) => void;
}

export const ProblemChatPanel: React.FC<ProblemChatPanelProps> = ({
  currentProblem,
  currentBehaviour,
  currentPersona,
  currentRubric,
  personas,
  onApplyProblem,
  onApplyBehaviour,
  onApplyPersona,
  onApplyRubric,
  onUsePersona,
  onSetLeiaName,
  modelName,
  apiKeyId,
  initialChatState,
  onChatStateChange,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialChatState?.messages ?? []);
  const [input, setInput] = useState(() => initialChatState?.input ?? "");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rubricSchema, setRubricSchema] = useState<JsonSchema | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onChatStateChange?.({ messages, input });
  }, [input, messages, onChatStateChange]);

  // Always read the freshest resources when the model calls get_current_*.
  const currentProblemRef = useRef<Problem | null>(currentProblem);
  currentProblemRef.current = currentProblem;
  const currentBehaviourRef = useRef<Behaviour | null>(currentBehaviour);
  currentBehaviourRef.current = currentBehaviour;
  const currentPersonaRef = useRef<Persona | null>(currentPersona);
  currentPersonaRef.current = currentPersona;
  const currentRubricRef = useRef<RubricDefinition | null>(currentRubric);
  currentRubricRef.current = currentRubric;
  const personasRef = useRef<Persona[]>(personas);
  personasRef.current = personas;

  useEffect(() => {
    getRubricSchema().then(setRubricSchema).catch(() => setError("Failed to load the rubric schema."));
  }, []);

  const chatTools = React.useMemo(() => CHAT_TOOLS.map((tool) => {
    if (tool.name !== "apply_rubric" || !rubricSchema) return tool;
    const parameters = { ...rubricSchema };
    delete parameters.$id;
    return { ...tool, parameters };
  }), [rubricSchema]);

  const ready = Boolean(modelName && apiKeyId && rubricSchema);

  // Changing the model/key invalidates the server-side session.
  useEffect(() => {
    chatIdRef.current = null;
  }, [modelName, apiKeyId]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const pushMessage = (role: ChatRole, text: string) =>
    setMessages((prev) => [...prev, { role, text }]);

  const stripAvatar = (spec: Record<string, unknown>): ProblemSpec => {
    const cleanSpec = { ...spec };
    delete cleanSpec.avatar;
    return cleanSpec as unknown as ProblemSpec;
  };

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

  // One user turn → loop while the model returns tool calls.
  const runTurn = async (chatId: string, message: string): Promise<string> => {
    // Send the uploaded PDF ids with the turn so the runner attaches them even
    // if the session was re-opened; it only attaches each one once.
    let response = await sendProblemChatMessage(chatId, {
      message,
      tools: chatTools,
      fileIds: attachments.map((a) => a.fileId),
    });
    for (let i = 0; i < 8; i++) {
      const calls = response.toolCalls;
      if (!Array.isArray(calls) || calls.length === 0) break;

      // Tool calls may be returned in parallel. Applying the problem first is
      // important because it invalidates the previous behaviour; the new,
      // activity-specific behaviour must be applied afterwards.
      const priority: Record<string, number> = {
        get_current_problem: 0,
        get_current_behaviour: 0,
        get_current_persona: 0,
        get_current_rubric: 0,
        list_personas: 0,
        apply_problem: 10,
        apply_behaviour: 20,
        apply_persona: 30,
        use_persona: 30,
        apply_rubric: 40,
        set_leia_name: 50,
      };
      const orderedCalls = [...calls].sort(
        (left, right) => (priority[left.name] ?? 100) - (priority[right.name] ?? 100),
      );

      const results: ProblemChatToolResult[] = orderedCalls.map((call) => {
        let output: unknown;
        let args: Record<string, unknown> = {};
        try {
          args = call.arguments ? JSON.parse(call.arguments) : {};
        } catch {
          args = {};
        }
        const takeName = (): { name?: string; spec: Record<string, unknown> } => {
          const { name, ...rest } = args;
          return { name: typeof name === "string" && name.trim() ? name.trim() : undefined, spec: rest };
        };
        if (call.name === "apply_problem") {
          const { name, spec } = takeName();
          onApplyProblem(normalizeProcessFields(stripAvatar(spec)), name);
          pushMessage("system", `✓ Problem applied${name ? ` ("${name}")` : ""}.`);
          output = { status: "applied" };
        } else if (call.name === "apply_behaviour") {
          const { name, spec } = takeName();
          onApplyBehaviour(normalizeProcessFields(spec), name);
          pushMessage("system", `✓ Behaviour applied${name ? ` ("${name}")` : ""}.`);
          output = { status: "applied" };
        } else if (call.name === "apply_persona") {
          const { name, spec } = takeName();
          onApplyPersona(spec, name);
          pushMessage("system", `✓ Persona applied${name ? ` ("${name}")` : ""}.`);
          output = { status: "applied" };
        } else if (call.name === "apply_rubric") {
          const rubric = args as unknown as RubricDefinition;
          const schemaError = rubricSchema ? validateAgainstRubricSchema(rubric, rubricSchema) : "rubric schema is unavailable";
          const semanticError = schemaError ? null : validateRubricSemantics(rubric);
          if (!schemaError && !semanticError) {
            onApplyRubric(rubric);
            pushMessage("system", `✓ Rubric applied ("${rubric.metadata.name}").`);
            output = { status: "applied" };
          } else {
            const errorMessage = schemaError || semanticError;
            pushMessage("system", `⚠ Rubric was not applied: ${errorMessage}`);
            output = { error: errorMessage };
          }
        } else if (call.name === "set_leia_name") {
          const name = typeof args.name === "string" ? args.name.trim() : "";
          if (name) {
            onSetLeiaName?.(name);
            pushMessage("system", `✓ LEIA title suggested: "${name}".`);
            output = { status: "applied", name };
          } else {
            output = { error: "a non-empty LEIA title is required" };
          }
        } else if (call.name === "get_current_problem") {
          output = currentProblemRef.current?.spec ?? null;
        } else if (call.name === "get_current_behaviour") {
          output = currentBehaviourRef.current?.spec ?? null;
        } else if (call.name === "get_current_persona") {
          output = currentPersonaRef.current?.spec ?? null;
        } else if (call.name === "get_current_rubric") {
          output = currentRubricRef.current;
        } else if (call.name === "list_personas") {
          output = personasRef.current.map((persona) => ({
            id: persona.id,
            name: persona.metadata?.name,
            firstName: persona.spec?.firstName,
            description:
              typeof persona.spec?.description === "string"
                ? persona.spec.description.slice(0, 240)
                : undefined,
          }));
        } else if (call.name === "use_persona") {
          const id = typeof args.id === "string" ? args.id : "";
          const result = onUsePersona(id);
          if (result.ok) {
            pushMessage("system", `✓ Using existing persona${result.name ? ` ("${result.name}")` : ""}.`);
            output = { status: "selected", name: result.name };
          } else {
            output = { error: `no persona with id '${id}'` };
          }
        } else {
          output = { error: `unknown tool '${call.name}'` };
        }
        return { callId: call.callId, output };
      });

      response = await sendProblemChatMessage(chatId, { toolResults: results, tools: chatTools });
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
    <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: "divider" }}>
        <AutoAwesomeIcon color="primary" fontSize="small" />
        <Typography variant="subtitle2">AI Assistant</Typography>
      </Stack>

      <Stack ref={transcriptRef} spacing={1.5} sx={{ flex: 1, minHeight: 160, overflowY: "auto", px: 2, py: 1.5 }}>
        {messages.length === 0 ? (
          <Typography variant="caption" color="text.disabled" fontStyle="italic">
            Attach a PDF of a past exercise or describe what you want, and I'll build the whole
            LEIA — problem, behaviour, persona and rubric — applying each component and suggesting a LEIA title.
            E.g. "{EXAMPLE_PROMPT}".
          </Typography>
        ) : (
          messages.map((msg, i) => {
            if (msg.role === "system") {
              return (
                <Typography key={i} variant="caption" sx={{ px: 1, py: 0.5, bgcolor: "#F0FDF4", color: "success.dark", borderRadius: 1 }}>
                  {msg.text}
                </Typography>
              );
            }
            const isUser = msg.role === "user";
            return (
              <Box key={i} sx={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                <Paper
                  variant={isUser ? undefined : "outlined"}
                  elevation={isUser ? 1 : 0}
                  sx={{
                    maxWidth: "85%",
                    px: 1.5,
                    py: 1,
                    bgcolor: isUser ? "primary.main" : "surfaces.subtle",
                    color: isUser ? "primary.contrastText" : "text.primary",
                    borderRadius: 1.5,
                    borderBottomRightRadius: isUser ? 0.5 : 1.5,
                    borderBottomLeftRadius: isUser ? 1.5 : 0.5,
                  }}
                >
                  {isUser ? (
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{msg.text}</Typography>
                  ) : (
                    <Box
                      sx={{
                        fontSize: 14,
                        lineHeight: 1.55,
                        "& p": { m: 0 },
                        "& p + p": { mt: 1 },
                        "& ul, & ol": { my: 0.75, pl: 2.5 },
                        "& li + li": { mt: 0.35 },
                        "& pre": {
                          m: 0,
                          mt: 1,
                          p: 1,
                          overflowX: "auto",
                          borderRadius: 1,
                          bgcolor: "rgba(15, 23, 42, 0.08)",
                          fontSize: 12,
                        },
                        "& :not(pre) > code": {
                          px: 0.45,
                          py: 0.1,
                          borderRadius: 0.5,
                          bgcolor: "rgba(15, 23, 42, 0.08)",
                          fontSize: "0.88em",
                        },
                      }}
                    >
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </Box>
                  )}
                </Paper>
              </Box>
            );
          })
        )}
        {sending && (
          <Box
            role="status"
            aria-label="The assistant is thinking"
            sx={{ display: "flex", justifyContent: "flex-start" }}
          >
            <Paper
              variant="outlined"
              sx={{
                px: 1.5,
                py: 1.25,
                bgcolor: "surfaces.subtle",
                borderRadius: 1.5,
                borderBottomLeftRadius: 0.5,
              }}
            >
              <Stack direction="row" spacing={0.6} alignItems="center" aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <Box
                    key={index}
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      bgcolor: "primary.main",
                      animation: `${thinkingDot} 1.2s ease-in-out infinite`,
                      animationDelay: `${index * 0.16}s`,
                    }}
                  />
                ))}
              </Stack>
            </Paper>
          </Box>
        )}
      </Stack>

      {attachments.length > 0 && (
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75} sx={{ px: 2, py: 1, borderTop: 1, borderColor: "divider" }}>
          {attachments.map((file) => (
            <Chip
              key={file.fileId}
              icon={<AttachFileIcon />}
              label={file.filename}
              size="small"
            />
          ))}
        </Stack>
      )}

      {error && <Alert severity="error" sx={{ mx: 2, mb: 1 }}>{error}</Alert>}

      <Box sx={{ p: 1, borderTop: 1, borderColor: "divider" }}>
        <Stack direction="row" alignItems="flex-end" spacing={1}>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={handleAttach}
          />
          <IconButton
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!ready || uploading || sending}
            aria-label="Attach a PDF"
            color="primary"
          >
            {uploading ? (
              <CircularProgress size={18} />
            ) : (
              <AttachFileIcon />
            )}
          </IconButton>
          <TextField
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={!ready || sending}
            multiline
            minRows={1}
            maxRows={5}
            placeholder={ready ? `E.g. ${EXAMPLE_PROMPT}` : "Select a model and key…"}
            fullWidth
            slotProps={{ htmlInput: { onKeyDown: handleKeyDown } }}
            sx={{ "& textarea": { maxHeight: 120, overflowY: "auto" } }}
          />
          <IconButton
            type="button"
            onClick={() => void handleSend()}
            disabled={!ready || sending || !input.trim()}
            color="primary"
            sx={{ bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.dark" } }}
            aria-label="Send message"
          >
            <SendIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
    </Paper>
  );
};

export type { ProblemChatPanelProps };
