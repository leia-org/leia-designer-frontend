import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import mermaid from "mermaid";
import ReactMarkdown from "react-markdown";
import { Header } from "../components/shared/Header";
import { FormatEditor } from "../components/FormatEditor";
import { FormatPreview } from "../components/FormatPreview";
import api from "../lib/axios";

const EDIT_STATE_KEY = "designerEditState";
const CHAT_SAVE_STATE_KEY = "designerChatSaveState";

const fallbackCode = `classDiagram
    class Person {
        +String firstName
        +String lastName
        +int age
        +getFullName(): String
    }
    class Employee {
        +int employeeId
        +calculateSalary(): float
    }
    class Client {
        +int clientId
        +placeOrder(): void
    }
    class Product {
        +int productId
        +String description
        +float price
    }
    class Order {
        +int orderId
        +Date date
        +calculateTotal(): float
    }

    Person <|-- Employee
    Person <|-- Client
    Client "1" --> "*" Order : places
    Order "1" --> "*" Product : contains`;

interface ExerciseSpec {
  description?: string;
  solutionFormat?: string;
  initialSolution?: string;
}

interface StoredEditState {
  sessionId: string;
  exercise?: ExerciseSpec;
}

interface EvaluationResponse {
  evaluation: string;
  score: number;
}

interface SavedNavigationState {
  save?: unknown;
}

mermaid.initialize({
  startOnLoad: true,
  theme: "default",
  securityLevel: "loose",
});

const parseJSON = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const getDefaultCode = (exercise?: ExerciseSpec) => {
  const initialSolution =
    typeof exercise?.initialSolution === "string"
      ? exercise.initialSolution.trim()
      : "";
  return initialSolution || fallbackCode;
};

const EvaluationModal: React.FC<{
  evaluation: string;
  score: number;
  onClose: () => void;
}> = ({ evaluation, score, onClose }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h2 className="text-xl font-semibold text-gray-900">
          Evaluation Result
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
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
          Back to editor
        </button>
      </div>
    </div>
  </div>
);

export const Edit: React.FC = () => {
  const navigate = useNavigate();
  const { sessionId: routeSessionId } = useParams();

  const storedState = parseJSON<StoredEditState>(localStorage.getItem(EDIT_STATE_KEY));
  const sessionId = routeSessionId || storedState?.sessionId || "";
  const exercise = storedState?.exercise;
  const solutionFormat = exercise?.solutionFormat || "mermaid";
  const codeStorageKey = useMemo(
    () => `designer_edit_code_${sessionId || "unknown"}`,
    [sessionId]
  );

  const [code, setCode] = useState<string>(() => {
    const persistedCode = localStorage.getItem(codeStorageKey);
    if (persistedCode) return persistedCode;
    return getDefaultCode(exercise);
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mermaidSvg, setMermaidSvg] = useState<string>("");
  const [lastValidSvg, setLastValidSvg] = useState<string>("");
  const [isResizing, setIsResizing] = useState(false);
  const [editorWidth, setEditorWidth] = useState(() => {
    const savedWidth = localStorage.getItem("designer_editor_width");
    return savedWidth ? Number(savedWidth) : 50;
  });

  useEffect(() => {
    if (!sessionId) return;
    localStorage.setItem(codeStorageKey, code);
  }, [code, codeStorageKey, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setSubmitError("Missing session. Go back to chat and retry.");
    }
  }, [sessionId]);

  useEffect(() => {
    localStorage.setItem("designer_editor_width", String(editorWidth));
  }, [editorWidth]);

  useEffect(() => {
    const renderMermaid = async () => {
      if (solutionFormat !== "mermaid") {
        setMermaidSvg("");
        setError(null);
        return;
      }
      try {
        const { svg } = await mermaid.render("designer-mermaid-diagram", code);
        setMermaidSvg(svg);
        setLastValidSvg(svg);
        setError(null);
      } catch (error: unknown) {
        setMermaidSvg(lastValidSvg);
        let message =
          error instanceof Error
            ? error.message
            : "Failed to render Mermaid diagram";
        if (message.includes("Syntax error in")) {
          message = message.split("Parse error:").pop()?.trim() || message;
        }
        setError(message);
      }
    };
    renderMermaid();
  }, [code, solutionFormat]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const percentage = (event.clientX / window.innerWidth) * 100;
      const boundedPercentage = Math.min(Math.max(percentage, 30), 70);
      setEditorWidth(boundedPercentage);
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const handleEditorChange = useCallback((value: string) => {
    setCode(value);
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    setIsResizing(true);
    event.preventDefault();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!sessionId || isSubmitting) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const response = await api.post<EvaluationResponse>(
        `/api/v1/runner/${sessionId}/evaluate`,
        { result: code }
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
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [code, isSubmitting, sessionId]);

  const handleContinueConfiguration = useCallback(() => {
    const savedChatState = parseJSON<SavedNavigationState>(
      localStorage.getItem(CHAT_SAVE_STATE_KEY)
    );
    if (savedChatState?.save) {
      navigate("/create", { state: { save: savedChatState.save } });
      return;
    }
    navigate("/create");
  }, [navigate]);

  const handleBackToChat = useCallback(() => {
    const savedChatState = parseJSON<unknown>(
      localStorage.getItem(CHAT_SAVE_STATE_KEY)
    );
    navigate(
      `/chat/${sessionId}`,
      savedChatState ? { state: savedChatState } : undefined
    );
  }, [navigate, sessionId]);

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <Header
        title="Edit Solution"
        description="Write and evaluate the current solution"
        showNavigation={false}
        rightContent={
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackToChat}
              className="px-4 py-1.5 text-sm text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Chat
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !sessionId || !!error}
              className="px-4 py-1.5 text-sm text-blue-600 bg-white border border-blue-600 rounded-md hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Evaluating..." : "Evaluate Solution"}
            </button>
            <button
              onClick={handleContinueConfiguration}
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-700 border border-blue-800 rounded-md hover:bg-blue-800 shadow-sm"
            >
              Continue Configuration
            </button>
          </div>
        }
      />

      <div className="flex-1 min-h-0 px-6 py-4">
        <div className="h-full w-full flex flex-col min-h-0">
          {submitError && (
            <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
              {submitError}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-xl overflow-hidden flex">
            <div style={{ width: `${editorWidth}%` }} className="h-full">
              <FormatEditor
                value={code}
                onChange={handleEditorChange}
                format={solutionFormat}
                onError={(nextError) => setError(nextError)}
              />
            </div>
            <div
              className={`w-1 hover:bg-blue-500 cursor-col-resize transition-colors ${
                isResizing ? "bg-blue-500" : "bg-gray-200"
              }`}
              onMouseDown={handleMouseDown}
            />
            <div style={{ width: `${100 - editorWidth}%` }} className="h-full">
              <FormatPreview
                code={code}
                format={solutionFormat}
                mermaidSvg={mermaidSvg}
                error={error}
              />
            </div>
          </div>
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
