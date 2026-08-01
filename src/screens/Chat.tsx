import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import PersonIcon from "@mui/icons-material/Person";
import {
  Avatar as MuiAvatar,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/shared/Header";
import { Avatar } from "../components/shared/Avatar";
import api from "../lib/axios";
import { toast, ToastContainer } from "react-toastify";
import type { LeiaConfig } from "../models/Experiment";
import type { ProblemWidget } from "../models/Leia";
import { buildOriginalAvatarPath } from "../lib/avatar";
import {
  VoiceModeWithWidgets,
  resolveWidgetDefinitions,
  useWidgetsContext,
  type WidgetDefinition,
  type FrontendTool,
} from "../widgets";

const CHAT_SAVE_STATE_KEY = "designerChatSaveState";
const EDIT_STATE_KEY = "designerEditState";

interface NavigationState {
  problem?: unknown;
  leia?: unknown;
  preset?: {
    persona?: unknown;
    problem?: unknown;
    behaviour?: unknown;
  };
  save?: {
    currentStep: number;
    leiaConfig: {
      persona: unknown | null;
      problem: unknown | null;
      behaviour: unknown | null;
    };
    leiaConfigSnapShot: unknown | null;
    customizations: {
      leia: { name: string; version: string };
      persona?: { name: string; version: string };
      problem?: { name: string; version: string };
      behaviour?: { name: string; version: string };
    };
  };
  problemDescription?: string;
  personaAvatar?: string;
  experimentTranscription?: {
    experimentId: string;
    leiaConfigId: string;
    leiaConfig: LeiaConfig;
  };
}

interface ExerciseSpec {
  description?: string;
  solutionFormat?: string;
  initialSolution?: string;
}

interface EditLocalState {
  sessionId: string;
  exercise?: ExerciseSpec;
}

const TypingAnimation = () => (
  <Stack direction="row" spacing={0.75}>
    {[0, 0.2, 0.4].map((delay) => (
      <Box
        component="span"
        key={delay}
        sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          bgcolor: "text.disabled",
          animation: "leiaTyping 0.6s ease-in-out infinite alternate",
          animationDelay: `${delay}s`,
          "@keyframes leiaTyping": { from: { transform: "translateY(0)" }, to: { transform: "translateY(-4px)" } },
        }}
      />
    ))}
  </Stack>
);

interface Message {
  text: string;
  timestamp: Date;
  isLeia: boolean;
}

// Mirrors the live widget tool registry into a ref the submit handler reads
// on each turn without re-binding.
const ToolsBridge: React.FC<{
  onTools: (tools: Record<string, FrontendTool>) => void;
}> = ({ onTools }) => {
  const { tools } = useWidgetsContext();
  useEffect(() => {
    onTools(tools as Record<string, FrontendTool>);
  }, [tools, onTools]);
  return null;
};

// Pulls the activity's widget config out of the navigation state passed to the
// "try" chat (CreateLeia / preset flows). Returns undefined when the problem
// declares no widgets — the chat then behaves as a plain text chat.
function extractWidgetsFromState(
  navState: NavigationState | null,
): ProblemWidget[] | undefined {
  const fromProblem = (p: unknown): ProblemWidget[] | undefined => {
    const problem = p as
      | { spec?: { widgets?: ProblemWidget[] }; widgets?: ProblemWidget[] }
      | null
      | undefined;
    const widgets = problem?.spec?.widgets ?? problem?.widgets;
    return Array.isArray(widgets) && widgets.length > 0 ? widgets : undefined;
  };
  const fromLeia = (leia: unknown): ProblemWidget[] | undefined =>
    fromProblem(
      (leia as { spec?: { problem?: unknown } } | null | undefined)?.spec
        ?.problem,
    );
  return (
    fromProblem(navState?.problem) ??
    fromLeia(navState?.leia) ??
    fromProblem(navState?.save?.leiaConfig?.problem) ??
    fromProblem(navState?.preset?.problem) ??
    fromLeia(navState?.experimentTranscription?.leiaConfig?.leia)
  );
}

function extractPersonaAvatarFromState(
  navState: NavigationState | null,
): string {
  const avatarFromResource = (resource: unknown): string => {
    const avatar = (resource as { spec?: { avatar?: unknown } } | null | undefined)
      ?.spec?.avatar;
    return typeof avatar === "string" ? avatar : "";
  };
  const avatarFromLeia = (leia: unknown): string => {
    const avatar = (leia as { spec?: { persona?: unknown } } | null | undefined)
      ?.spec?.persona;
    return avatarFromResource(avatar);
  };

  return (
    navState?.personaAvatar ||
    avatarFromResource(navState?.save?.leiaConfig?.persona) ||
    avatarFromResource(navState?.preset?.persona) ||
    avatarFromLeia(navState?.experimentTranscription?.leiaConfig?.leia) ||
    ""
  );
}

function extractPersonaAvatarFallbackFromState(
  navState: NavigationState | null,
): string {
  const getResourceId = (resource: unknown): string => {
    const id = (resource as { id?: unknown } | null | undefined)?.id;
    return typeof id === "string" ? id : "";
  };
  const getLeiaResourceIds = (leia: unknown): {
    leiaId: string;
    personaId: string;
  } => {
    const typedLeia = leia as
      | {
          id?: unknown;
          spec?: { persona?: unknown };
        }
      | null
      | undefined;
    return {
      leiaId: typeof typedLeia?.id === "string" ? typedLeia.id : "",
      personaId: getResourceId(typedLeia?.spec?.persona),
    };
  };

  const savedPersonaId = getResourceId(navState?.save?.leiaConfig?.persona);
  const presetPersonaId = getResourceId(navState?.preset?.persona);
  const transcriptionIds = getLeiaResourceIds(
    navState?.experimentTranscription?.leiaConfig?.leia,
  );

  return (
    buildOriginalAvatarPath("personas", savedPersonaId) ||
    buildOriginalAvatarPath("personas", presetPersonaId) ||
    buildOriginalAvatarPath("personas", transcriptionIds.personaId) ||
    buildOriginalAvatarPath("leias", transcriptionIds.leiaId) ||
    ""
  );
}

export const Chat = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [problemDescription, setProblemDescription] = useState<string>("");
  const [savingTranscription, setSavingTranscription] = useState(false);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [transcription, setTranscription] = useState(false);
  const [experimentId, setExperimentId] = useState<string | null>(null);
  const [leiaConfigId, setLeiaConfigId] = useState<string | null>(null);
  const [leiaConfig, setLeiaConfig] = useState<LeiaConfig | null>(null);
  const [problemWidgets, setProblemWidgets] = useState<ProblemWidget[] | undefined>(
    undefined,
  );
  const [personaAvatar, setPersonaAvatar] = useState("");
  const [personaAvatarFallback, setPersonaAvatarFallback] = useState("");

  // Mount the activity's widgets in a side panel (text mode). Any non-left
  // slot is shown on the right so a "main"-slotted widget still appears.
  const widgetDefs = useMemo<WidgetDefinition[]>(
    () =>
      resolveWidgetDefinitions(problemWidgets).map((w) => ({
        ...w,
        slot: w.slot === "left" ? "left" : "right",
      })),
    [problemWidgets],
  );
  const hasWidgets = widgetDefs.length > 0;

  // Live mirror of the widget-registered tools; the submit loop reads it.
  const toolsRef = useRef<Record<string, FrontendTool>>({});
  const handleToolsSync = useCallback((t: Record<string, FrontendTool>) => {
    toolsRef.current = t;
  }, []);

  const parseSavedNavigationState = (): NavigationState | null => {
    const raw = localStorage.getItem(CHAT_SAVE_STATE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as NavigationState;
    } catch {
      return null;
    }
  };

  const extractExerciseFromNavigationState = (
    navigationState: NavigationState | null
  ): ExerciseSpec | undefined => {
    const problem = (navigationState?.save?.leiaConfig?.problem ?? null) as
      | { spec?: unknown }
      | null;
    if (!problem || typeof problem !== "object") return undefined;
    const spec = problem.spec as ExerciseSpec | undefined;
    if (!spec || typeof spec !== "object") return undefined;
    return spec;
  };

  const configureEditState = useCallback(
    (navigationState: NavigationState | null) => {
      if (!sessionId) return;
      const exercise = extractExerciseFromNavigationState(navigationState);
      const payload: EditLocalState = {
        sessionId,
        exercise,
      };
      localStorage.setItem(EDIT_STATE_KEY, JSON.stringify(payload));
      localStorage.setItem("sessionId", sessionId);
      if (exercise) {
        localStorage.setItem("exercise", JSON.stringify(exercise));
      }
    },
    [sessionId]
  );

  const scrollToBottom = useCallback((smooth = true) => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTo({
        top: chatMessagesRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  const handleTextareaResize = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 150);
      textarea.style.height = `${newHeight}px`;
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessageText(e.target.value);
    handleTextareaResize();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sessionMessages") ?? "{}";
      const { sessionId: storedId, messages: storedArr } = JSON.parse(raw);
      setMessages(
        storedId === sessionId && Array.isArray(storedArr) ? storedArr : []
      );
    } catch {
      setMessages([]);
    }
  }, [sessionId]);

  useEffect(() => {
    const navigationState = location.state as NavigationState;
    if (navigationState) {
      localStorage.setItem(CHAT_SAVE_STATE_KEY, JSON.stringify(navigationState));
    }
    if (navigationState?.problemDescription) {
      setProblemDescription(navigationState.problemDescription);
    }

    if (navigationState?.experimentTranscription) {
      setTranscription(true);
      setExperimentId(navigationState.experimentTranscription.experimentId);
      setLeiaConfigId(navigationState.experimentTranscription.leiaConfigId);
      setLeiaConfig(navigationState.experimentTranscription.leiaConfig);
    }

    const resolvedNavigationState = navigationState || parseSavedNavigationState();

    setPersonaAvatar(extractPersonaAvatarFromState(resolvedNavigationState));
    setPersonaAvatarFallback(
      extractPersonaAvatarFallbackFromState(resolvedNavigationState),
    );
    setProblemWidgets(extractWidgetsFromState(resolvedNavigationState));

    configureEditState(resolvedNavigationState);
  }, [location.state]);

  useEffect(() => {
    // Usar requestAnimationFrame para asegurar que el DOM se haya actualizado
    requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [messages, scrollToBottom]);

  useEffect(() => {
    // Hacer scroll cuando aparece el indicador de "typing"
    if (sendingMessage) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [sendingMessage, scrollToBottom]);

  const addMessage = (newMessage: Message) => {
    setMessages((prev) => {
      const next = [...prev, newMessage];
      localStorage.setItem(
        "sessionMessages",
        JSON.stringify({ sessionId, messages: next })
      );
      return next;
    });
  };

  // Runs one user turn against the runner, looping while the model returns
  // tool calls. Each call is executed via the local widget tools registry and
  // its output shipped back as a function_call_output. Resolves with the
  // model's final text. When the activity has no widgets, toolsPayload is empty
  // and this is a single plain request — identical to the old behaviour.
  const runMessageTurn = useCallback(
    async (initialMessage: string): Promise<string> => {
      const toolsPayload = Object.entries(toolsRef.current).map(([name, tool]) => ({
        name,
        description: tool.description,
        parameters: tool.parameters,
      }));
      const url = `/api/v1/runner/${sessionId}/messages`;

      const initialBody: Record<string, unknown> = { message: initialMessage };
      if (toolsPayload.length > 0) initialBody.tools = toolsPayload;

      let response = await api.post(url, initialBody);
      // Cap the round-trip depth so a misbehaving tool loop cannot brick the UI.
      for (let i = 0; i < 8; i++) {
        const calls = response.data?.toolCalls;
        if (!Array.isArray(calls) || calls.length === 0) break;

        const results = await Promise.all(
          calls.map(
            async (call: { callId: string; name: string; arguments: string }) => {
              const tool = toolsRef.current[call.name];
              let output: unknown;
              if (!tool) {
                output = { error: `tool '${call.name}' is not registered on this client` };
              } else {
                let args: Record<string, unknown> = {};
                try {
                  args = call.arguments ? JSON.parse(call.arguments) : {};
                } catch {
                  args = {};
                }
                try {
                  output = await tool.execute(args);
                } catch (err) {
                  output = { error: (err as Error).message ?? "tool execution failed" };
                }
              }
              return { callId: call.callId, output };
            },
          ),
        );

        const continuationBody: Record<string, unknown> = { toolResults: results };
        if (toolsPayload.length > 0) continuationBody.tools = toolsPayload;
        response = await api.post(url, continuationBody);
      }

      return typeof response.data?.message === "string" ? response.data.message : "";
    },
    [sessionId],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const messageText = newMessageText.trim();
    if (!messageText) return;

    setNewMessageText("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    const newMessage: Message = {
      text: messageText,
      timestamp: new Date(),
      isLeia: false,
    };

    addMessage(newMessage);
    setSendingMessage(true);

    try {
      const leiaText = await runMessageTurn(messageText);
      if (leiaText) {
        addMessage({
          text: leiaText,
          timestamp: new Date(),
          isLeia: true,
        });
      }
    } catch {
      addMessage({
        text: "Your message is taking a bit longer to send. Retry?",
        timestamp: new Date(),
        isLeia: true,
      });
    } finally {
      localStorage.setItem(
        "sessionMessages",
        JSON.stringify({ sessionId, messages })
      );
      setSendingMessage(false);
    }
  };

  const handleSaveTranscription = async () => {
    console.log("Saving transcription...", messages);
    // Validar que existan mensajes
    if (messages.length === 0) {
      toast.error("No messages to save as transcription");
      return;
    }

    if (!transcription) {
      toast.error("Transcription option is not enabled");
      return;
    }

    if (!experimentId || !leiaConfigId || !leiaConfig) {
      toast.error("Missing experiment or LEIA configuration information");
      return;
    }

    const update = {
      leia:
        typeof leiaConfig.leia === "string"
          ? leiaConfig.leia
          : leiaConfig.leia.id,
      configuration: {
        mode: leiaConfig.configuration.mode,
        data: {
          ...leiaConfig.configuration.data,
          link: undefined,
          messages: messages,
        },
      },
    };

    try {
      setSavingTranscription(true);
      await api.put(
        `/api/v1/experiments/${experimentId}/leias/${leiaConfigId}`,
        update
      );
      toast.success("Transcription added successfully", {
        position: "bottom-right",
        autoClose: 3000,
      });
    } catch (error) {
      let errorMessage = "Failed to add transcription";

      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { status?: number; data?: { message?: string } };
        };
        if (
          axiosError.response?.status === 409 ||
          axiosError.response?.status === 404 ||
          axiosError.response?.status === 400
        ) {
          errorMessage = axiosError.response.data?.message || errorMessage;
        }
      }

      toast.error(errorMessage, {
        position: "bottom-right",
        autoClose: 3000,
      });
    } finally {
      setSavingTranscription(false);
    }
  };

  const handleFinishConversation = async () => {
    const navigationState =
      (location.state as NavigationState | null) || parseSavedNavigationState();
    if (navigationState?.save) {
      navigate("/create", {
        state: { save: navigationState.save } as NavigationState,
      });
    } else {
      navigate(-1);
    }
  };

  const handleOpenSolutionEditor = () => {
    const navigationState =
      (location.state as NavigationState | null) || parseSavedNavigationState();
    configureEditState(navigationState);
    if (!sessionId) {
      toast.error("Missing session id to open editor");
      return;
    }
    navigate(`/edit/${sessionId}`);
  };

  return (
    <Box sx={{ position: "relative", display: "flex", flex: 1, flexDirection: "column", minHeight: 0, bgcolor: "background.paper" }}>
      <Header
        title="Chat"
        description="Test and interact with a LEIA configuration"
        showNavigation={false}
        rightContent={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="outlined" color="inherit" onClick={handleOpenSolutionEditor}>
              Solution Editor
            </Button>
            <Button variant="outlined" onClick={() => setShowInstructions(!showInstructions)}>
              {showInstructions ? "Hide Instructions" : "Instructions"}
            </Button>
            <Button variant="contained" onClick={handleFinishConversation}>
              Continue Configuration
            </Button>
            {transcription && (
              <Button
                color="success"
                variant="contained"
                onClick={handleSaveTranscription}
                disabled={savingTranscription || messages.length === 0}
                startIcon={savingTranscription ? <CircularProgress color="inherit" size={14} /> : undefined}
              >
                {savingTranscription ? "Saving..." : "Save Transcription"}
              </Button>
            )}
          </Stack>
        }
      />
      <ToastContainer />

      {showInstructions && problemDescription && (
        <Box sx={{ px: 2, py: 2, bgcolor: "surfaces.accent", borderBottom: 1, borderColor: "primary.light" }}>
          <Box sx={{ maxWidth: 768, mx: "auto" }}>
            <Typography variant="subtitle2" color="primary.dark" gutterBottom>
              Instructions
            </Typography>
            <Typography variant="body2" color="primary.dark" sx={{ whiteSpace: "pre-wrap" }}>
              {problemDescription}
            </Typography>
          </Box>
        </Box>
      )}

      <Box sx={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Box
        ref={chatMessagesRef}
        sx={{ flex: 1, overflowY: "auto", px: 2, pb: 12 }}
      >
        <Stack spacing={2} sx={{ maxWidth: 768, mx: "auto", py: 2 }}>
          {messages.map((msg, index) => (
            <Stack
              key={index}
              direction="row"
              spacing={1}
              alignItems="flex-end"
              justifyContent={msg.isLeia ? "flex-start" : "flex-end"}
            >
              {msg.isLeia && (
                <Avatar
                  src={personaAvatar}
                  fallbackSrc={personaAvatarFallback}
                  alt="Persona avatar"
                  label="Persona"
                  size="md"
                  className="border-blue-100 bg-blue-50"
                />
              )}
              <Paper
                variant={msg.isLeia ? "outlined" : undefined}
                elevation={msg.isLeia ? 0 : 1}
                sx={{
                  maxWidth: "80%",
                  px: 2,
                  py: 1.25,
                  bgcolor: msg.isLeia ? "background.paper" : "primary.main",
                  color: msg.isLeia ? "text.primary" : "primary.contrastText",
                  borderRadius: 2.5,
                  borderBottomLeftRadius: msg.isLeia ? 0.5 : 2.5,
                  borderBottomRightRadius: msg.isLeia ? 2.5 : 0.5,
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
                  {msg.text}
                </Typography>
              </Paper>
              {!msg.isLeia && (
                <MuiAvatar sx={{ width: 32, height: 32, bgcolor: "primary.main" }}>
                  <PersonIcon fontSize="small" />
                </MuiAvatar>
              )}
            </Stack>
          ))}
          {sendingMessage && (
            <Stack direction="row" spacing={1} alignItems="flex-end">
              <Avatar
                src={personaAvatar}
                fallbackSrc={personaAvatarFallback}
                alt="Persona avatar"
                label="Persona"
                size="md"
                className="border-blue-100 bg-blue-50"
              />
              <Paper variant="outlined" sx={{ minWidth: 60, px: 2, py: 1.5, borderRadius: 2.5, borderBottomLeftRadius: 0.5 }}>
                <TypingAnimation />
              </Paper>
            </Stack>
          )}
        </Stack>
      </Box>
      {hasWidgets && (
        <Box sx={{ width: "50%", display: "flex", flexDirection: "column", overflow: "hidden", bgcolor: "#171717", color: "common.white", borderLeft: 1, borderColor: "#262626" }}>
          <VoiceModeWithWidgets widgets={widgetDefs}>
            {({ rightSlot, leftSlot }) => (
              <>
                <ToolsBridge onTools={handleToolsSync} />
                <Box sx={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column" }}>
                  {leftSlot && <Box sx={{ flex: 1, minHeight: 0 }}>{leftSlot}</Box>}
                  {rightSlot && <Box sx={{ flex: 1, minHeight: 0 }}>{rightSlot}</Box>}
                </Box>
              </>
            )}
          </VoiceModeWithWidgets>
        </Box>
      )}
      </Box>

      <Box sx={{ position: "absolute", right: 0, bottom: 9, left: 0, height: 96, pointerEvents: "none" }} />

      <Box
        sx={{ position: "absolute", right: hasWidgets ? "50%" : 0, bottom: 0, left: 0, px: 2, pb: 3, bgcolor: "background.paper" }}
      >
        <Box sx={{ maxWidth: 768, mx: "auto" }}>
          <Paper
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: "flex", alignItems: "flex-end", gap: 1, p: 1.5, boxShadow: 3 }}
          >
            <TextField
              inputRef={inputRef}
              value={newMessageText}
              onChange={handleTextareaChange}
              placeholder="Type a message... (Shift+Enter for new line)"
              multiline
              variant="standard"
              fullWidth
              rows={1}
              slotProps={{ input: { disableUnderline: true }, htmlInput: { onKeyDown: handleKeyDown } }}
              sx={{ "& .MuiInputBase-root": { px: 1, py: 0.75, alignItems: "flex-start" }, "& textarea": { maxHeight: 150, overflowY: "auto" } }}
            />
            <Button
              type="submit"
              disabled={!newMessageText.trim()}
              variant="contained"
            >
              Send
            </Button>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};
