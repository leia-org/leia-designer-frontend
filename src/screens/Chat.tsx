import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import { UserCircleIcon } from "@heroicons/react/24/solid";
import { ArrowDownTrayIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/shared/Header";
import api from "../lib/axios";
import { toast, ToastContainer } from "react-toastify";
import ReactMarkdown from "react-markdown";
import type { LeiaConfig } from "../models/Experiment";
import type { ProblemWidget } from "../models/Leia";
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

interface EvaluationResponse {
  evaluation: string;
  score: number;
}

type SpeechRecognitionResult = {
  readonly isFinal: boolean;
  readonly [index: number]: { transcript: string };
};

type SpeechRecognitionEventLike = {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResult;
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

interface EditLocalState {
  sessionId: string;
  exercise?: ExerciseSpec;
}

const TypingAnimation = () => (
  <div className="flex items-center space-x-1.5">
    <div
      className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
      style={{ animationDuration: "0.6s" }}
    ></div>
    <div
      className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
      style={{ animationDuration: "0.6s", animationDelay: "0.2s" }}
    ></div>
    <div
      className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
      style={{ animationDuration: "0.6s", animationDelay: "0.4s" }}
    ></div>
  </div>
);

const EvaluationModal: React.FC<{
  evaluation: string;
  score: number;
  onClose: () => void;
}> = ({ evaluation, score, onClose }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h2 className="text-xl font-semibold text-gray-900">
          Evaluation Result
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close evaluation"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
        <div className="mb-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-sm font-medium">
            Score: {score}
          </span>
        </div>
        <div className="prose prose-sm max-w-none text-gray-700">
          <ReactMarkdown>{evaluation}</ReactMarkdown>
        </div>
      </div>
      <div className="px-6 py-4 border-t flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Back to try out
        </button>
      </div>
    </div>
  </div>
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

function extractExerciseFromState(
  navState: NavigationState | null,
): ExerciseSpec | undefined {
  const fromProblem = (p: unknown): ExerciseSpec | undefined => {
    const problem = p as
      | { spec?: ExerciseSpec; description?: string; solutionFormat?: string; initialSolution?: string }
      | null
      | undefined;
    const spec = problem?.spec ?? problem;
    if (!spec || typeof spec !== "object") return undefined;
    return {
      description:
        typeof spec.description === "string" ? spec.description : undefined,
      solutionFormat:
        typeof spec.solutionFormat === "string" ? spec.solutionFormat : undefined,
      initialSolution:
        typeof spec.initialSolution === "string" ? spec.initialSolution : undefined,
    };
  };
  const fromLeia = (leia: unknown): ExerciseSpec | undefined =>
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
  const [exercise, setExercise] = useState<ExerciseSpec | undefined>(undefined);
  const [solutionText, setSolutionText] = useState("");
  const [evaluatingSolution, setEvaluatingSolution] = useState(false);
  const [evaluation, setEvaluation] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceInputBaseRef = useRef("");

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
    const resolvedExercise = extractExerciseFromState(resolvedNavigationState);

    setProblemWidgets(extractWidgetsFromState(resolvedNavigationState));
    setExercise(resolvedExercise);
    setSolutionText((current) => {
      if (current.trim()) return current;
      return resolvedExercise?.initialSolution || "";
    });

    configureEditState(resolvedNavigationState);
  }, [location.state]);

  useEffect(() => {
    if (!voiceEnabled || typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    const lastMessage = messages[messages.length - 1];
    if (!synth || !lastMessage?.isLeia || !lastMessage.text.trim()) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(lastMessage.text);
    utterance.lang = navigator.language || "en-US";
    synth.speak(utterance);
    return () => {
      synth.cancel();
    };
  }, [messages, voiceEnabled]);

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    },
    [],
  );

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

  const handleVoiceInput = () => {
    if (typeof window === "undefined") return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const speechWindow = window as SpeechWindow;
    const Recognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error("Voice input is not supported in this browser");
      return;
    }

    const recognition = new Recognition();
    voiceInputBaseRef.current = newMessageText.trim();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      const prefix = voiceInputBaseRef.current
        ? `${voiceInputBaseRef.current} `
        : "";
      setNewMessageText(`${prefix}${transcript}`.trimStart());
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      toast.error("Voice input failed. Check microphone permissions.");
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const handleEvaluateSolution = async () => {
    if (!sessionId || evaluatingSolution) return;
    const result = solutionText.trim();
    if (!result) {
      toast.error("Add a solution before evaluating");
      return;
    }
    setEvaluatingSolution(true);
    try {
      const response = await api.post<EvaluationResponse>(
        `/api/v1/runner/${sessionId}/evaluate`,
        { result },
      );
      setEvaluation(response.data.evaluation || "No evaluation provided.");
      setScore(response.data.score ?? 0);
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response
          ?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response!
              .data!.message!
          : "Failed to evaluate the solution.";
      toast.error(message);
    } finally {
      setEvaluatingSolution(false);
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
    <div className="flex flex-col h-screen bg-white">
      <Header
        title="Chat"
        description="Test and interact with a LEIA configuration"
        showNavigation={false}
        rightContent={
          <div className="flex gap-2">
            <button
              onClick={() => setVoiceEnabled((enabled) => !enabled)}
              className={`px-4 py-1.5 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                voiceEnabled
                  ? "text-white bg-slate-800 border-slate-900 hover:bg-slate-900"
                  : "text-slate-700 bg-white border-slate-300 hover:bg-slate-50"
              }`}
            >
              {voiceEnabled ? "Voice On" : "Voice"}
            </button>
            <button
              onClick={handleOpenSolutionEditor}
              className="px-4 py-1.5 text-sm text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Solution Editor
            </button>
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="px-4 py-1.5 text-sm text-blue-600 bg-white border border-blue-600 rounded-md hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {showInstructions ? "Hide Instructions" : "Instructions"}
            </button>
            <button
              onClick={handleFinishConversation}
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-700 border border-blue-800 rounded-md hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              Continue Configuration
            </button>
            {transcription && (
              <button
                onClick={handleSaveTranscription}
                disabled={savingTranscription || messages.length === 0}
                className="px-4 py-1.5 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {savingTranscription ? (
                  <>
                    <ArrowPathIcon className="animate-spin h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  <>
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    Save Transcription
                  </>
                )}
              </button>
            )}
          </div>
        }
      />
      <ToastContainer />

      {showInstructions && problemDescription && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Instructions
            </h3>
            <p className="text-sm text-blue-800 whitespace-pre-wrap">
              {problemDescription}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
      <div
        ref={chatMessagesRef}
        className="flex-1 overflow-y-auto px-4 pb-24 scroll-smooth"
      >
        <div className="max-w-3xl mx-auto space-y-4 py-4">
          <div className="border border-slate-200 rounded-lg bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Solution Evaluation
                </h3>
                <p className="text-xs text-slate-500">
                  Format: {exercise?.solutionFormat || "text"}
                </p>
              </div>
              <button
                onClick={handleEvaluateSolution}
                disabled={evaluatingSolution || !sessionId || !solutionText.trim()}
                className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {evaluatingSolution ? "Evaluating..." : "Evaluate"}
              </button>
            </div>
            <textarea
              value={solutionText}
              onChange={(event) => setSolutionText(event.target.value)}
              placeholder="Write a candidate solution to evaluate..."
              className="w-full min-h-[120px] max-h-[260px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-end gap-2 ${
                msg.isLeia ? "flex-row" : "flex-row-reverse"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  msg.isLeia ? "bg-blue-50" : "bg-blue-600"
                }`}
              >
                {msg.isLeia ? (
                  <UserCircleIcon className="w-5 h-5 text-blue-700" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-5 h-5 text-white"
                  >
                    <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                  </svg>
                )}
              </div>
              <div
                className={`max-w-[80%] px-4 py-2 ${
                  msg.isLeia
                    ? "bg-white border border-gray-200 text-gray-900 rounded-t-2xl rounded-r-2xl rounded-bl-md"
                    : "bg-blue-600 text-white rounded-t-2xl rounded-l-2xl rounded-br-md"
                }`}
              >
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                  {msg.text}
                </p>
              </div>
            </div>
          ))}
          {sendingMessage && (
            <div className="flex items-end gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                <UserCircleIcon className="w-5 h-5 text-blue-700" />
              </div>
              <div className="min-w-[60px] bg-white border border-gray-200 rounded-t-2xl rounded-r-2xl rounded-bl-md px-4 py-3">
                <TypingAnimation />
              </div>
            </div>
          )}
        </div>
      </div>
      {hasWidgets && (
        <div className="w-1/2 bg-neutral-900 text-white flex flex-col overflow-hidden border-l border-neutral-800">
          <VoiceModeWithWidgets widgets={widgetDefs}>
            {({ rightSlot, leftSlot }) => (
              <>
                <ToolsBridge onTools={handleToolsSync} />
                <div className="flex-1 min-h-0 flex flex-col">
                  {leftSlot && <div className="flex-1 min-h-0">{leftSlot}</div>}
                  {rightSlot && <div className="flex-1 min-h-0">{rightSlot}</div>}
                </div>
              </>
            )}
          </VoiceModeWithWidgets>
        </div>
      )}
      </div>

      <div className="absolute bottom-[72px] left-0 right-0 h-24 pointer-events-none"></div>

      <div
        className="absolute bottom-0 left-0 right-0 px-4 pb-6 bg-white"
        style={{ right: hasWidgets ? "50%" : 0 }}
      >
        <div className="max-w-3xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="flex gap-2 bg-white rounded-lg p-3 shadow-[0_0_10px_rgba(0,0,0,0.1)] hover:shadow-[0_0_15px_rgba(0,0,0,0.15)] transition-all"
          >
            <textarea
              ref={inputRef}
              value={newMessageText}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Shift+Enter for new line)"
              className="flex-1 px-2 py-1.5 bg-transparent border-none focus:outline-none text-[15px] resize-none overflow-y-auto"
              style={{ minHeight: "40px", maxHeight: "150px" }}
              rows={1}
            />
            <button
              type="button"
              onClick={handleVoiceInput}
              className={`px-4 py-2 text-sm border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                listening
                  ? "text-white bg-red-600 border-red-700 hover:bg-red-700"
                  : "text-slate-700 bg-white border-slate-300 hover:bg-slate-50"
              }`}
              title={listening ? "Stop voice input" : "Start voice input"}
            >
              {listening ? "Stop" : "Mic"}
            </button>
            <button
              type="submit"
              disabled={!newMessageText.trim()}
              className="px-5 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        </div>
      </div>
      {evaluation !== null && score !== null && (
        <EvaluationModal
          evaluation={evaluation}
          score={score}
          onClose={() => {
            setEvaluation(null);
            setScore(null);
          }}
        />
      )}
    </div>
  );
};
