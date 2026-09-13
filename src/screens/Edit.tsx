import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import mermaid from "mermaid";
import ReactMarkdown from "react-markdown";
import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
} from "@mui/material";
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

const unwrapMermaidCodeFence = (value: string) => {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:mermaid)?\s*\r?\n([\s\S]*?)\r?\n?```\s*$/i);
  return fenced ? fenced[1].trim() : trimmed;
};

const EvaluationModal: React.FC<{
  evaluation: string;
  score: number;
  onClose: () => void;
}> = ({ evaluation, score, onClose }) => (
  <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="evaluation-result-title">
    <DialogTitle id="evaluation-result-title" sx={{ pr: 7 }}>
      Evaluation Result
      <IconButton aria-label="Close" onClick={onClose} sx={{ position: "absolute", top: 12, right: 12 }}>
        <CloseIcon />
      </IconButton>
    </DialogTitle>
    <DialogContent dividers sx={{ maxHeight: "60vh" }}>
      <Chip label={`Score: ${score}`} color="primary" sx={{ mb: 2 }} />
      <Box
        sx={{
          color: "text.secondary",
          "& h1, & h2, & h3, & h4": { color: "text.primary", mt: 2, mb: 1 },
          "& p": { lineHeight: 1.65, my: 1 },
          "& ul, & ol": { pl: 3 },
          "& pre": { overflow: "auto", p: 1.5, bgcolor: "surfaces.subtle", borderRadius: 1 },
          "& code": { fontFamily: "'JetBrains Mono Variable', monospace", fontSize: "0.9em" },
        }}
      >
        <ReactMarkdown>{evaluation}</ReactMarkdown>
      </Box>
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2 }}>
      <Button variant="contained" onClick={onClose}>
        Back to editor
      </Button>
    </DialogActions>
  </Dialog>
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
      const diagramCode = unwrapMermaidCodeFence(code);
      if (!diagramCode) {
        setMermaidSvg("");
        setError(null);
        return;
      }
      try {
        const { svg } = await mermaid.render("designer-mermaid-diagram", diagramCode);
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
    <Box
      sx={{
        height: "100dvh",
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      <Header
        title="Edit Solution"
        description="Write and evaluate the current solution"
        showNavigation={false}
        rightContent={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button color="inherit" variant="outlined" onClick={handleBackToChat}>
              Chat
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !sessionId || !!error}
              variant="outlined"
              startIcon={isSubmitting ? <CircularProgress size={14} color="inherit" /> : undefined}
            >
              {isSubmitting ? "Evaluating..." : "Evaluate Solution"}
            </Button>
            <Button onClick={handleContinueConfiguration} variant="contained">
              Continue Configuration
            </Button>
          </Stack>
        }
      />

      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", px: { xs: 2, md: 3 }, py: 2 }}>
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
          {submitError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {submitError}
            </Alert>
          )}

          {error && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex" }}>
            <Box sx={{ width: `${editorWidth}%`, height: "100%", minHeight: 0, minWidth: 0 }}>
              <FormatEditor
                value={code}
                onChange={handleEditorChange}
                format={solutionFormat}
                onError={(nextError) => setError(nextError)}
              />
            </Box>
            <Box
              role="separator"
              aria-orientation="vertical"
              onMouseDown={handleMouseDown}
              sx={{
                width: 4,
                flexShrink: 0,
                cursor: "col-resize",
                bgcolor: isResizing ? "primary.main" : "divider",
                transition: (theme) => theme.transitions.create("background-color"),
                "&:hover": { bgcolor: "primary.main" },
              }}
            />
            <Box sx={{ width: `${100 - editorWidth}%`, height: "100%", minHeight: 0, minWidth: 0 }}>
              <FormatPreview
                code={code}
                format={solutionFormat}
                mermaidSvg={mermaidSvg}
                error={error}
              />
            </Box>
          </Paper>
        </Box>
      </Box>

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
    </Box>
  );
};
