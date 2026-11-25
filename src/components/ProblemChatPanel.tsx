import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { Problem, Behaviour, Persona } from "../models/Leia";
import { behaviourPage, behaviourCandidates, CORE_BEHAVIOUR_REFERENCES, templateReferences } from "../lib/chatBehaviours.mjs";
import type { User } from "../models/User";
import {
  commandTarget,
  processConflict,
  reviewCreatorChanges,
  stageCreatorCommand,
  validateCreatorChanges,
  type CreatorDraft,
  type CreatorLibrary,
  type CreatorProposal,
  type DraftTarget,
  type ReviewedChange,
} from "../lib/creatorCommands";
import { CreatorProposalCard } from "./CreatorProposalCard";
import { WIDGET_CATALOG } from "../widgets/catalog";
import {
  openProblemChat,
  uploadProblemChatFile,
  sendProblemChatMessage,
  type ProblemChatTool,
  type ProblemChatToolResult,
  type UploadedFile,
} from "../lib/problemChat";
import { getRubricSchema, type JsonSchema } from "../lib/rubricSchema";

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

// The model proposes changes through commands. Designer previews them on a copy of the draft.
const AUTHORING_CHAT_TOOLS: ProblemChatTool[] = [
  {
    name: "get_current_problem",
    description:
      "Returns the problem currently in the editor (its full spec, including any widgets). Call it before modifying an existing problem, or to match its style/solutionFormat.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_problems",
    description:
      "Lists existing problems that can be reused. You MUST call this, wait for its result and inspect it before apply_problem. Reuse a semantically suitable problem instead of creating a near-duplicate.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "use_problem",
    description:
      "Proposes reusing an existing problem by id from list_problems. Prefer this when its scenario, learning objective and expected solution materially match the user's request.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Problem id returned by list_problems." },
      },
      required: ["id"],
    },
  },
  {
    name: "apply_problem",
    description:
      "Proposes a new, complete Problem. If a Problem is selected, this replaces it after review. For edits to the selected Problem, call edit_problem. Call list_problems first and use this only when no existing problem is semantically suitable. Fill every field you reasonably can.\n\n" +
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
                  "Widget configuration. codeEditor: { fnName, description, language, starter, tests: [{ name, args, expected }] }. Supports JavaScript, TypeScript, Python, Java, Rust, C/C++, C#, PHP, Go, Kotlin, Swift, Ruby, R, MATLAB, Dart, Scala, Perl, Lua, SQL and other common languages.",
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
    name: "list_behaviours",
    description:
      "Lists saved behaviours and previous conversation drafts as short summaries, 10 per page. Pass nextOffset as offset to read the next page until nextOffset is null. After changing the Problem, look for a compatible reusable role. Call get_behaviour with a candidate id to inspect its complete instructions and template references before selecting or editing it. A change of scenario alone does not require a new behaviour.",
    parameters: {
      type: "object",
      properties: { offset: { type: "integer", minimum: 0, description: "Start offset; omit for the first page." } },
    },
  },
  {
    name: "get_behaviour",
    description:
      "Returns the complete spec and template references of one saved behaviour or conversation draft by id from list_behaviours. Inspect it before use_behaviour to reject incompatible hardcoded case instructions and preserve dynamic references when editing. Does not change the selected behaviour.",
    parameters: {
      type: "object",
      properties: { id: { type: "string", description: "Behaviour id from list_behaviours." } },
      required: ["id"],
    },
  },
  {
    name: "use_behaviour",
    description:
      "Proposes reusing a saved or draft Behaviour by id from list_behaviours. Reuse a compatible generic role across different scenarios; the dynamic problem/persona references supply the current context. Its process must exactly match the selected problem process. Inspect its full instructions and reject incompatible hardcoded case data.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Behaviour id returned by list_behaviours." },
      },
      required: ["id"],
    },
  },
  {
    name: "apply_behaviour",
    description:
      "Proposes a new, complete reusable Behaviour. Call list_behaviours first; prefer use_behaviour when a saved or draft role is compatible. For edits to the selected Behaviour, call edit_behaviour. Define the interaction pattern, boundaries and guidance using dynamic problem/persona references rather than hardcoding the current exercise. Preserve all template references in the previous behaviour when editing it. Required references in description: " + CORE_BEHAVIOUR_REFERENCES.join(", ") + ". Missing references return an error without changing the editor. Set `name` so the instructor doesn't have to rename it.",
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
      "Proposes a new, complete Persona. If a Persona is selected, this replaces it after review. For edits to the selected Persona, call edit_persona. Call list_personas first and use this only when no existing persona is suitable. The persona is the character the AI embodies (name, background, personality, pronouns). Set `name` so the instructor doesn't have to rename it.",
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
      "Proposes a COMPLETE structured evaluation rubric for the exact current Problem. Levels must be ordered from worst to best, section weights must total 100, and every criterion must contain exactly one descriptor for every section level.",
    parameters: { type: "object", properties: {} },
    strict: true,
  },
  {
    name: "list_personas",
    description:
      "Lists existing personas the instructor can reuse. You MUST call this, wait for its result and inspect it before apply_persona. Prefer a suitable existing persona and only create a new one when none fits.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "use_persona",
    description:
      "Proposes reusing an existing Persona from list_personas instead of creating a duplicate.",
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
      "Proposes a learner-facing title for a new LEIA or when the user explicitly asks to rename it.",
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

const turnPriority = { problem: 1, behaviour: 2, persona: 3, rubric: 4, leia: 5 };
const toolPriority = (tool: string) => {
  const target = commandTarget(tool);
  return target ? turnPriority[target] : 0;
};

const editDescriptions = {
  problem: "Edit specific fields of the selected Problem. Keep all fields outside the request.",
  behaviour: "Edit specific fields of the selected Behaviour. To add a guardrail or other instructions, use appendInstructions with empty changes. Keep the selected role, existing instructions and template references.",
  persona: "Edit specific fields of the selected Persona. Keep all fields outside the request.",
};

const buildChatTools = (canEditBehaviour: boolean, rubricEnabled: boolean): ProblemChatTool[] => {
  const tools = AUTHORING_CHAT_TOOLS.filter(tool =>
    (canEditBehaviour || tool.name !== "apply_behaviour") &&
    (rubricEnabled || (tool.name !== "apply_rubric" && tool.name !== "get_current_rubric")),
  );
  return tools.flatMap(tool => {
    const component = commandTarget(tool.name);
    if (!component || component === "leia" || component === "rubric" || !tool.name.startsWith("apply_")) return [tool];
    const fields = { ...tool.parameters.properties as Record<string, unknown> };
    delete fields.name;
    return [tool, {
      name: `edit_${component}`,
      description: editDescriptions[component],
      parameters: {
        type: "object",
        properties: {
          changes: { type: "object", properties: fields, additionalProperties: false },
          ...(component === "behaviour" ? { appendInstructions: { type: "string" } } : {}),
        },
        required: ["changes"],
        additionalProperties: false,
      },
    }];
  });
};

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
  draft: CreatorDraft;
  user: User | undefined;
  problems: Problem[];
  behaviours: Behaviour[];
  personas: Persona[];
  canEditBehaviour: boolean;
  onApplyProposal: (proposal: CreatorProposal) => void;
  modelName: string;
  apiKeyId: string | null;
  initialChatState?: ProblemChatState;
  onChatStateChange?: (state: ProblemChatState) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}

export const ProblemChatPanel: React.FC<ProblemChatPanelProps> = ({
  draft,
  user,
  problems,
  behaviours,
  personas,
  canEditBehaviour,
  onApplyProposal,
  modelName,
  apiKeyId,
  initialChatState,
  onChatStateChange,
  onBusyChange,
  disabled = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialChatState?.messages ?? []);
  const [input, setInput] = useState(() => initialChatState?.input ?? "");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rubricSchema, setRubricSchema] = useState<JsonSchema | null>(null);
  const [proposal, setProposal] = useState<CreatorProposal | null>(null);
  const [revising, setRevising] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const chatIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const { rubricEnabled } = draft;
  const chatTools = useMemo(
    () =>
      buildChatTools(canEditBehaviour, rubricEnabled).map((tool) => {
        if (tool.name !== "apply_rubric" || !rubricSchema) return tool;
        const parameters = { ...rubricSchema };
        delete parameters.$id;
        return { ...tool, parameters };
      }),
    [canEditBehaviour, rubricEnabled, rubricSchema],
  );

  useEffect(() => {
    onChatStateChange?.({ messages, input });
  }, [input, messages, onChatStateChange]);

  const rememberedBehavioursRef = useRef<Map<string, Behaviour>>(new Map());
  useEffect(() => {
    const behaviour = draft.config.behaviour;
    if (behaviour?.edited) rememberedBehavioursRef.current.set(behaviour.id, behaviour);
  }, [draft.config.behaviour]);

  const library: CreatorLibrary = {
    problem: problems.filter(problem => problem.id && !problem.id.startsWith("generated-")),
    behaviour: behaviourCandidates(behaviours, rememberedBehavioursRef.current.values()),
    persona: personas.filter(persona => persona.id && !persona.id.startsWith("generated-")),
  };
  const latest = useRef({ draft, user, canEditBehaviour, library });
  latest.current = { draft, user, canEditBehaviour, library };
  const stale = proposal !== null && proposal.base !== draft;

  useEffect(() => {
    if (!rubricEnabled || rubricSchema) return;
    getRubricSchema().then(setRubricSchema).catch(() => setError("Failed to load the rubric schema."));
  }, [rubricEnabled, rubricSchema]);

  const ready = Boolean(modelName && apiKeyId && (!rubricEnabled || rubricSchema));

  // Changing the model/key invalidates the server-side session.
  useEffect(() => {
    chatIdRef.current = null;
  }, [modelName, apiKeyId]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [messages, sending, proposal]);

  const pushMessage = useCallback((role: ChatRole, text: string) =>
    setMessages((prev) => [...prev, { role, text }]), []);

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

  const runTurn = async (chatId: string, message: string, base: CreatorDraft): Promise<string> => {
    const { user, canEditBehaviour, library } = latest.current;
    if (!user) throw new Error("Sign in to propose draft changes.");
    const context = { user, canEditBehaviour, library, rubricSchema };
    const inspected = new Set<DraftTarget>();
    const actions = new Map<DraftTarget, ReviewedChange["action"]>();
    const errors = new Map<DraftTarget, string>();
    let staged = base;
    let response = await sendProblemChatMessage(chatId, {
      message,
      tools: chatTools,
      fileIds: attachments.map(attachment => attachment.fileId),
    });
    for (let round = 0; response.toolCalls?.length; round++) {
      if (round >= 14) throw new Error("The assistant did not finish the proposal. Please try again.");
      const inspectedBeforeRound = new Set(inspected);
      const calls = [...response.toolCalls].sort((left, right) => toolPriority(left.name) - toolPriority(right.name));
      const results: ProblemChatToolResult[] = calls.map(call => {
        let args: Record<string, unknown>;
        try {
          const parsed: unknown = JSON.parse(call.arguments || "{}");
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
          args = parsed as Record<string, unknown>;
        } catch {
          const error = "Provide valid arguments for the tool.";
          const target = commandTarget(call.name);
          if (target) errors.set(target, error);
          return { callId: call.callId, output: { error } };
        }

        const target = commandTarget(call.name);
        let output: unknown;
        if (target) {
          const result = target !== "rubric" && call.name.startsWith("apply_") && !inspectedBeforeRound.has(target)
            ? { error: `Inspect list_${target}s first, then propose a new ${target}.` }
            : stageCreatorCommand(staged, call.name, args, context);
          if ("error" in result) {
            errors.set(target, result.error);
            output = result;
          } else {
            errors.delete(target);
            if (result.draft !== staged && (result.action !== "Edit" || !actions.has(target))) actions.set(target, result.action);
            staged = result.draft;
            const name = target === "leia" ? staged.customizations.leia.name
              : target === "rubric" ? staged.rubricDraft?.metadata.name
              : staged.config[target]?.metadata.name;
            output = {
              status: "proposed",
              name,
              ...(processConflict(staged) ? { warning: "The proposed Problem and Behaviour have different processes. Propose a compatible selection before finishing." } : {}),
            };
          }
        } else if (call.name === "get_current_problem") {
          output = staged.config.problem?.spec ?? null;
        } else if (call.name === "get_current_behaviour") {
          output = staged.config.behaviour?.spec ?? null;
        } else if (call.name === "get_current_persona") {
          output = staged.config.persona?.spec ?? null;
        } else if (call.name === "get_current_rubric" && staged.rubricEnabled) {
          output = staged.rubricDraft;
        } else if (call.name === "list_behaviours") {
          inspected.add("behaviour");
          output = behaviourPage(library.behaviour, typeof args.offset === "number" ? args.offset : 0);
        } else if (call.name === "get_behaviour") {
          const candidate = library.behaviour.find(item => item.id === args.id);
          output = candidate
            ? { id: candidate.id, spec: candidate.spec, templateReferences: templateReferences(candidate.spec.description), isDraft: candidate.edited === true }
            : { error: "Choose an available Behaviour from the library." };
        } else if (call.name === "list_problems") {
          inspected.add("problem");
          output = library.problem.map(({ id, metadata, spec }) => ({
            id, name: metadata.name, description: spec.description?.slice(0, 240),
            details: spec.details?.slice(0, 240), solutionPreview: spec.solution?.slice(0, 240),
            process: spec.process, solutionFormat: spec.solutionFormat,
          }));
        } else if (call.name === "list_personas") {
          inspected.add("persona");
          output = library.persona.map(({ id, metadata, spec }) => ({
            id, name: metadata.name, firstName: spec.firstName,
            description: spec.description?.slice(0, 240), personality: spec.personality,
          }));
        } else {
          output = { error: "This tool is unavailable." };
        }
        return { callId: call.callId, output };
      });
      response = await sendProblemChatMessage(chatId, { toolResults: results, tools: chatTools });
    }

    if (latest.current.draft !== base) throw new Error("The draft changed while the assistant was working. Send your request again.");
    if (errors.size > 0) throw new Error([...errors.values()].join(" "));
    if (staged !== base) {
      const validationError = validateCreatorChanges(base, staged, context);
      if (validationError) throw new Error(validationError);
      const nextProposal = reviewCreatorChanges(base, staged, actions);
      if (nextProposal.changes.length) {
        setProposal(nextProposal);
        return "";
      }
    }
    return response.message ?? "";
  };

  const handleApply = () => {
    if (!proposal || disabled || sending || !user) return;
    const validationError = stale
      ? "The draft has changed. Ask for a fresh proposal."
      : validateCreatorChanges(proposal.base, proposal.next, { user, canEditBehaviour, library });
    if (validationError) {
      setError(validationError);
      return;
    }
    onApplyProposal(proposal);
    setProposal(null);
    setRevising(false);
    setError(null);
    pushMessage("system", "Applied the proposed changes to the draft.");
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || disabled) return;
    setError(null);
    setInput("");
    setProposal(null);
    setRevising(false);
    pushMessage("user", text);
    setSending(true);
    onBusyChange?.(true);
    try {
      const chatId = await ensureSession();
      const instruction = revising && proposal && !stale
        ? `Revise the previous proposal using this feedback: ${text}`
        : text;
      const reply = await runTurn(chatId, instruction, draft);
      if (reply) pushMessage("assistant", reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant failed to respond");
    } finally {
      setSending(false);
      onBusyChange?.(false);
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
            {rubricEnabled
              ? "Attach a PDF of a past exercise or describe what you want. I'll first search the existing problem, behaviour and persona library, reuse the best matches, and create only what is missing — including an evaluation rubric and suggested LEIA title."
              : "Attach a PDF of a past exercise or describe what you want. I'll first search the existing problem, behaviour and persona library, reuse the best matches, and create only what is missing."}
            {" "}E.g. "{EXAMPLE_PROMPT}".
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
        {proposal && (stale ? (
          <Alert severity="info">The draft changed. Send a new message to request an updated proposal.</Alert>
        ) : (
          <CreatorProposalCard
            proposal={proposal}
            disabled={disabled || sending}
            onApply={handleApply}
            onRevise={() => { setRevising(true); composerRef.current?.focus(); }}
            onDiscard={() => {
              setProposal(null);
              setRevising(false);
              setError(null);
              pushMessage("system", "Proposal discarded.");
            }}
          />
        ))}
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
            disabled={disabled || !ready || uploading || sending}
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
            inputRef={composerRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={disabled || !ready || sending}
            multiline
            minRows={1}
            maxRows={5}
            placeholder={ready ? (revising ? "What should change in the proposal?" : `E.g. ${EXAMPLE_PROMPT}`) : "Select a model and key…"}
            fullWidth
            slotProps={{ htmlInput: { onKeyDown: handleKeyDown, "aria-label": "Message the assistant" } }}
            sx={{ "& textarea": { maxHeight: 120, overflowY: "auto" } }}
          />
          <IconButton
            type="button"
            onClick={() => void handleSend()}
            disabled={disabled || !ready || sending || !input.trim()}
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
