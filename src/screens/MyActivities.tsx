import type React from "react";
import { Header } from "../components/shared/Header";
import { useEffect, useState, useCallback, useRef } from "react";
import type { Experiment, LeiaConfig } from "../models/Experiment";
import type { Leia } from "../models/Leia";
import api from "../lib/axios";
import { z } from "zod";
import { ToastContainer, toast } from "react-toastify";
import { LeiaViewModal } from "../components/LeiaViewModal";
import { TranscriptionView } from "../components/TranscriptionView";
import { useNavigate, useLocation } from "react-router-dom";
import Editor from "@monaco-editor/react";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LinkIcon from "@mui/icons-material/Link";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import "../styles/monaco-tooltip-fix.css";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

interface TranscriptionMessage {
  text: string;
  timestamp: Date | string;
  isLeia: boolean;
}

// Zod schema for manual validation (tab switching and save)
const TranscriptionMessageSchema = z.object({
  text: z.string().min(1, "Message text cannot be empty"),
  timestamp: z.iso.datetime(),
  isLeia: z.boolean(),
});

const TranscriptionArraySchema = z
  .array(TranscriptionMessageSchema)
  .min(1, "At least one message is required");

export const MyActivities: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);
  const [loadingExperiments, setLoadingExperiments] = useState(false);
  const [errorLoadingExperiments, setErrorLoadingExperiments] = useState("");
  const [creatingNewExperiment, setCreatingNewExperiment] = useState(false);
  const [newExperimentName, setNewExperimentName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // LEIA accordion and viewing state
  const [expandedExperiments, setExpandedExperiments] = useState<Set<string>>(
    new Set()
  );
  const [selectedLeia, setSelectedLeia] = useState<Leia | null>(null);
  const [showLeiaModal, setShowLeiaModal] = useState(false);
  const [preloadModal, setPreloadModal] = useState(false);

  // Publishing state
  const [publishingExperiments, setPublishingExperiments] = useState<
    Set<string>
  >(new Set());

  // Transcription state
  const [showUrlInput, setShowUrlInput] = useState<Set<string>>(new Set());
  const [urlInputValues, setUrlInputValues] = useState<{
    [key: string]: string;
  }>({});

  // Transcription modal state
  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false);
  const [transcriptionMessages, setTranscriptionMessages] = useState<
    TranscriptionMessage[]
  >([]);

  // Transcription loading state
  const [initializingTranscriptionChat, setInitializingTranscriptionChat] =
    useState<string | null>(null);

  // Auto-generation preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewMessages, setPreviewMessages] = useState<
    TranscriptionMessage[]
  >([]);
  const [generatingPreview, setGeneratingPreview] = useState(false);

  // JSON Edit modal state
  const [showJsonEditModal, setShowJsonEditModal] = useState(false);
  const [jsonEditText, setJsonEditText] = useState("");
  const [jsonEditTab, setJsonEditTab] = useState<"editor" | "preview">(
    "editor"
  );
  const [jsonEditError, setJsonEditError] = useState<string | null>(null);
  const [currentEditingLeia, setCurrentEditingLeia] = useState<{
    experimentId: string;
    leiaConfigId: string;
    leiaConfig: LeiaConfig;
  } | null>(null);

  const [previewContext, setPreviewContext] = useState<{
    experimentId: string;
    leiaConfigId: string;
    leiaConfig: LeiaConfig;
  } | null>(null);

  // Fetch experiments for the current user

  const fetchExperiments = async () => {
    setLoadingExperiments(true);
    setErrorLoadingExperiments("");
    try {
      const response = await api.get("/api/v1/experiments/user/me", {
        params: { populated: true },
      });
      setExperiments(response.data);
    } catch (error) {
      if (error instanceof Error) {
        setErrorLoadingExperiments(
          "Error loading activities: " + error.message
        );
      } else {
        setErrorLoadingExperiments("Error loading activities");
      }
    } finally {
      setLoadingExperiments(false);
    }
  };

  useEffect(() => {
    fetchExperiments();
  }, []);

  const handleCreateExperiment = async () => {
    if (!newExperimentName.trim()) return;

    try {
      setCreatingNewExperiment(true);
      const response = await api.post<Experiment>("/api/v1/experiments", {
        name: newExperimentName.trim(),
      });

      setExperiments((prev) => [...(prev || []), response.data]);

      toast.success("Activity '" + response.data.name + "' created", {
        position: "bottom-right",
        autoClose: 5000,
      });

      setNewExperimentName("");
      setShowCreateModal(false);
    } catch (error) {
      const axiosError = error as {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };

      if (axiosError.response?.status === 409) {
        toast.error(
          axiosError.response.data?.message || "An activity with that name already exists",
          {
            position: "bottom-right",
            autoClose: 5000,
          }
        );
        return;
      }

      toast.error(
        "Could not create new activity: " +
          (axiosError.response?.data?.message || axiosError.message || "Unknown error"),
        {
          position: "bottom-right",
          autoClose: 5000,
        }
      );
    } finally {
      setCreatingNewExperiment(false);
    }
  };

  // Get LEIAs for a specific experiment (from already loaded experiment data)

  // Toggle experiment accordion
  const toggleExperiment = useCallback(
    (experimentId: string) => {
      const newExpanded = new Set(expandedExperiments);
      if (newExpanded.has(experimentId)) {
        newExpanded.delete(experimentId);
      } else {
        newExpanded.add(experimentId);
      }
      setExpandedExperiments(newExpanded);
    },
    [expandedExperiments]
  );

  // Open LEIA viewing modal - optimizado para evitar re-renders
  const viewLeiaContent = useCallback((leia: Leia) => {
    setSelectedLeia(leia);
    setShowLeiaModal(true);
  }, []);

  // Publish experiment (one-way action)
  const publishExperiment = async (experiment: Experiment) => {
    setPublishingExperiments((prev) => new Set([...prev, experiment.id]));

    try {
      const response = await api.patch(
        `/api/v1/experiments/${experiment.id}/publish`
      );

      // Update the experiment in the local state
      setExperiments(
        (prev) =>
          prev?.map((exp) =>
            exp.id === experiment.id
              ? { ...exp, isPublished: response.data.isPublished }
              : exp
          ) || null
      );

      toast.success("Activity published successfully", {
        position: "bottom-right",
        autoClose: 3000,
      });
    } catch (error) {
      let errorMessage = "Failed to publish activity";

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
      setPublishingExperiments((prev) => {
        const newSet = new Set([...prev]);
        newSet.delete(experiment.id);
        return newSet;
      });
    }
  };
      
  
  const tourRef = useRef<ReturnType<typeof driver> | null>(null);
  const startGuidedTour = useCallback(() => {
      let tour: ReturnType<typeof driver> | null = null;
      tourRef.current?.destroy();
      tour = driver({
                animate: true,
                smoothScroll: true,
                allowClose: true,
                showProgress: true,
                progressText: "Paso {{current}} de {{total}}",
                steps: [
            {
          element: "#activities",
          popover: {
            title: "Activities",
            description:
              "Here is the list of Activities you can use.",
            side: "bottom",
            
          },
        },
        {
          element: "#first-activity-open",
          popover: {
            title: "Activity",
            description:
              "You can publish your activity in order to start the replication, or delete it if you don't need it anymore.",
            side: "bottom",
            onNextClick: () => {
              const firstActivity = experiments?.[0]?.id;
              console.log("First activity ID for tour:", firstActivity);
              if (firstActivity) {
                toggleExperiment(firstActivity);
                setTimeout(() => tourRef.current?.moveNext(), 300);
              }
            }
          }
        },
        {
          element: "#first-activity-open",
          popover: {
            title: "Activity",
            description:
              "You can see your related Leias, and change their mode to be standard or transcription.",
            side: "bottom",
            
          }
        },
        {
          element: "#activities",
          popover: {
            title: "End of tour",
            description:
              "This is the end of the tour. Now you know everything you need to know to start using LEIA.",
            side: "bottom",
          }
        },
      ],
        onDestroyed: () => {
        if (tourRef.current === tour) {
          tourRef.current = null;
          toggleExperiment("");
        }
      }
      });
      tourRef.current = tour;
        tour.drive();

    }, [experiments]);
    const [pendingTour, setPendingTour] = useState(false);
    useEffect(() => {
          const navigationState = location.state;
          if (!navigationState) return;
          if (navigationState.isTour) {
            setPendingTour(true);
            startGuidedTour();
            try {
            navigate(location.pathname, { replace: true, state: undefined });
          } catch (e) {
            console.error("Error clearing navigation state after starting tour:", e);}
        }
        }, [location.pathname, location.state, navigate, startGuidedTour]);
      
        useEffect(() => {
  if (pendingTour && experiments && experiments.length > 0 && !loadingExperiments) {
    setPendingTour(false);
    startGuidedTour();
  }
}, [pendingTour, experiments, loadingExperiments, startGuidedTour]);
  const handleDeleteExperimentLeia = async (
    experimentId: string,
    leiaConfigId: string
  ) => {
    try {
      await api.delete(
        `/api/v1/experiments/${experimentId}/leias/${leiaConfigId}`
      );

      setExperiments(
        (prev) =>
          prev?.map((exp) => {
            if (exp.id === experimentId) {
              return {
                ...exp,
                leias: exp.leias.filter(
                  (leiaConfig) => leiaConfig.id !== leiaConfigId
                ),
              };
            }
            return exp;
          }) || null
      );
      toast.success("LEIA deleted from activity", {
        position: "bottom-right",
        autoClose: 3000,
      });
    } catch (error) {
      let errorMessage = "Failed to delete LEIA from activity";

      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { status?: number; data?: { message?: string } };
        };
        if (
          axiosError.response?.status === 409 ||
          axiosError.response?.status === 404
        ) {
          errorMessage = axiosError.response.data?.message || errorMessage;
        }
      }

      toast.error(errorMessage, {
        position: "bottom-right",
        autoClose: 3000,
      });
    }
  };

  const handleDeleteExperiment = async (experimentId: string) => {
    try {
      await api.delete(`/api/v1/experiments/${experimentId}`);

      setExperiments(
        (prev) => prev?.filter((exp) => exp.id !== experimentId) || null
      );
      toast.success("Activity deleted successfully", {
        position: "bottom-right",
        autoClose: 3000,
      });
    } catch (error) {
      let errorMessage = "Failed to delete activity";

      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { status?: number; data?: { message?: string } };
        };
        if (
          axiosError.response?.status === 409 ||
          axiosError.response?.status === 404
        ) {
          errorMessage = axiosError.response.data?.message || errorMessage;
        }
      }

      toast.error(errorMessage, {
        position: "bottom-right",
        autoClose: 3000,
      });
    }
  };

  const handleFastReplication = (experimentId: string) => {
    const workbenchBaseUrl =
      import.meta.env.VITE_WORKBENCH_URL;

    const replicationUrl = `${workbenchBaseUrl.replace(/\/$/, "")}/experiments/${encodeURIComponent(experimentId)}`;
    const newWindow = window.open(replicationUrl);
    if (!newWindow) {
      toast.error("Popup blocked or could not open replication", {
        position: "bottom-right",
        autoClose: 2000,
      });
    }
  };

  const handleUpdateExperimentLeiaMode = async (
    experimentId: string,
    leiaConfigId: string,
    leiaConfig: LeiaConfig,
    mode: string
  ) => {
    try {
      const update = {
        leia:
          typeof leiaConfig.leia === "string"
            ? leiaConfig.leia
            : leiaConfig.leia.id,
        configuration: { ...leiaConfig.configuration, mode },
      };
      const response = await api.put<Experiment>(
        `/api/v1/experiments/${experimentId}/leias/${leiaConfigId}`,
        update
      );

      setExperiments((prev) => {
        if (!prev) return null;
        return prev.map((exp) => {
          if (exp.id === experimentId) {
            return response.data;
          }
          return exp;
        });
      });
    } catch (error) {
      let errorMessage = "Failed to update LEIA mode";

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
    }
  };

  const handleAddTranscriptionLink = async (
    experimentId: string,
    leiaConfigId: string,
    leiaConfig: LeiaConfig,
    url: string
  ) => {
    const update = {
      leia:
        typeof leiaConfig.leia === "string"
          ? leiaConfig.leia
          : leiaConfig.leia.id,
      configuration: {
        mode: leiaConfig.configuration.mode,
        data: {
          ...leiaConfig.configuration.data,
          link: url,
          messages: undefined,
        },
      },
    };
    try {
      const response = await api.put(
        `/api/v1/experiments/${experimentId}/leias/${leiaConfigId}`,
        update
      );
      setExperiments((prev) => {
        if (!prev) return null;
        return prev.map((exp) => {
          if (exp.id === experimentId) {
            return response.data;
          }
          return exp;
        });
      });
      toast.success("Transcription link added successfully", {
        position: "bottom-right",
        autoClose: 3000,
      });
    } catch (error) {
      let errorMessage = "Failed to add transcription link";

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
    }
  };

  const handleCreateTranscriptionManually = async (
    experimentId: string,
    leiaConfigId: string,
    leiaConfig: LeiaConfig
  ) => {
    if (typeof leiaConfig.leia !== "object") {
      return;
    }

    const transcriptionKey = `${experimentId}-${leiaConfigId}`;
    setInitializingTranscriptionChat(transcriptionKey);

    try {
      const response = await api.post("/api/v1/runner/initialize", {
        spec: leiaConfig.leia.spec,
      });
      const { sessionId } = response.data || {};
      if (sessionId) {
        navigate(`/chat/${sessionId}`, {
          state: {
            problemDescription:
              leiaConfig.leia.spec?.problem?.spec?.description || "",
            personaAvatar: leiaConfig.leia.spec?.persona?.spec?.avatar || "",
            experimentTranscription: {
              experimentId,
              leiaConfigId,
              leiaConfig,
            },
          },
        });
      }
    } catch {
      toast.error("Failed to create transcription session", {
        position: "bottom-right",
        autoClose: 3000,
      });
    } finally {
      setInitializingTranscriptionChat(null);
    }
  };

  const handleGenerateTranscriptionAutomatically = async (
    experimentId: string,
    leiaConfigId: string,
    leiaConfig: LeiaConfig
  ) => {
    const leia = typeof leiaConfig.leia === "object" ? leiaConfig.leia : null;

    if (!leia) {
      toast.error("LEIA data is not available", {
        position: "bottom-right",
        autoClose: 3000,
      });
      return;
    }

    // Set preview context and show modal
    setPreviewContext({ experimentId, leiaConfigId, leiaConfig });
    setShowPreviewModal(true);
    setGeneratingPreview(true);
    setPreviewMessages([]);

    try {
      const response = await api.post(
        "/api/v1/runner/transcriptions/generate",
        {
          spec: leia.spec,
        }
      );
      const messages = response.data;
      if (messages && Array.isArray(messages)) {
        setPreviewMessages(messages);
      }
    } catch {
      toast.error("Failed to generate transcription", {
        position: "bottom-right",
        autoClose: 3000,
      });
      setShowPreviewModal(false);
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handleViewTranscription = (data: {
    link?: string;
    messages?: unknown;
  }) => {
    if (data?.link) {
      // Abrir enlace en nueva pestaña
      window.open(data.link, "_blank", "noopener,noreferrer");
    } else if (data?.messages && Array.isArray(data.messages)) {
      // Abrir modal con mensajes de transcripción
      setTranscriptionMessages(data.messages);
      setShowTranscriptionModal(true);
    }
  };

  const isValidUrl = (string: string): boolean => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  const handleSavePreviewTranscription = async () => {
    if (!previewContext || !previewMessages.length) return;

    const { experimentId, leiaConfigId, leiaConfig } = previewContext;

    const update = {
      leia:
        typeof leiaConfig.leia === "string"
          ? leiaConfig.leia
          : leiaConfig.leia.id,
      configuration: {
        mode: leiaConfig.configuration.mode,
        data: {
          ...leiaConfig.configuration.data,
          messages: previewMessages,
          link: undefined,
        },
      },
    };

    try {
      const response = await api.put(
        `/api/v1/experiments/${experimentId}/leias/${leiaConfigId}`,
        update
      );
      setExperiments((prev) => {
        if (!prev) return null;
        return prev.map((exp) => {
          if (exp.id === experimentId) {
            return response.data;
          }
          return exp;
        });
      });
      toast.success("Transcription saved successfully", {
        position: "bottom-right",
        autoClose: 3000,
      });
      setShowPreviewModal(false);
      setPreviewMessages([]);
      setPreviewContext(null);
    } catch (error) {
      let errorMessage = "Failed to save transcription";

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
    }
  };

  const handleCancelPreviewTranscription = () => {
    setShowPreviewModal(false);
    setPreviewMessages([]);
    setPreviewContext(null);
    setGeneratingPreview(false);
  };

  // JSON Edit modal handlers
  const handleOpenJsonEdit = (
    experimentId: string,
    leiaConfigId: string,
    leiaConfig: LeiaConfig
  ) => {
    const existingMessages = leiaConfig.configuration?.data?.messages || [];
    setJsonEditText(JSON.stringify(existingMessages, null, 2));
    setCurrentEditingLeia({ experimentId, leiaConfigId, leiaConfig });
    setJsonEditError(null);
    setJsonEditTab("editor");
    setShowJsonEditModal(true);
  };

  const validateTranscriptionMessages = (
    text: string
  ): {
    isValid: boolean;
    error?: string;
    messages?: TranscriptionMessage[];
  } => {
    try {
      const parsed = JSON.parse(text);
      const result = TranscriptionArraySchema.safeParse(parsed);

      if (!result.success) {
        const firstError = result.error.issues[0];
        if (firstError.path.length === 0) {
          // Array-level error
          return { isValid: false, error: firstError.message };
        } else {
          // Message-level error
          const [index, field] = firstError.path;
          return {
            isValid: false,
            error: `Message at index ${String(index)}, field "${String(
              field
            )}": ${firstError.message}`,
          };
        }
      }

      return { isValid: true, messages: result.data };
    } catch {
      return { isValid: false, error: "Invalid JSON format" };
    }
  };

  const handleJsonEditTabChange = (tab: "editor" | "preview") => {
    if (tab === "preview") {
      const validation = validateTranscriptionMessages(jsonEditText);
      if (!validation.isValid) {
        setJsonEditError(validation.error || "Invalid JSON");
        return;
      }
      setJsonEditError(null);
    }
    setJsonEditTab(tab);
  };

  const handleJsonEditorChange = (value: string | undefined) => {
    const newValue = value || "";
    setJsonEditText(newValue);
    setJsonEditError(null);
  };

  const handleMonacoEditorMount = (_editor: unknown, monaco: unknown) => {
    // Configure Monaco Editor JSON schema validation
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const monacoInstance = monaco as any;

      // Configure JSON validation
      monacoInstance.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemas: [
          {
            uri: "http://transcription-schema.json",
            fileMatch: ["*"],
            schema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: {
                    type: "string",
                    minLength: 1,
                    description: "Message text content",
                  },
                  timestamp: {
                    type: "string",
                    minLength: 1,
                    format: "date-time",
                    description:
                      "Message timestamp (ISO date: YYYY-MM-DDTHH:MM:SSZ)",
                  },
                  isLeia: {
                    type: "boolean",
                    description: "Whether this message is from LEIA",
                  },
                },
                required: ["text", "timestamp", "isLeia"],
                additionalProperties: false,
              },
              minItems: 1,
              description: "Array of transcription messages",
            },
          },
        ],
      });

      monacoInstance.editor.setTheme("vs");

      setJsonEditError(null);
    } catch (error) {
      console.warn("Could not configure Monaco JSON schema:", error);
    }
  };

  const handleSaveJsonEdit = async () => {
    if (!currentEditingLeia) return;

    const validation = validateTranscriptionMessages(jsonEditText);
    if (!validation.isValid) {
      setJsonEditError(validation.error || "Invalid JSON");
      return;
    }

    try {
      const messages = validation.messages;
      const { experimentId, leiaConfigId, leiaConfig } = currentEditingLeia;

      const update = {
        leia:
          typeof leiaConfig.leia === "string"
            ? leiaConfig.leia
            : leiaConfig.leia.id,
        configuration: {
          mode: leiaConfig.configuration.mode,
          data: {
            ...leiaConfig.configuration.data,
            messages: messages,
            link: undefined,
          },
        },
      };

      const response = await api.put(
        `/api/v1/experiments/${experimentId}/leias/${leiaConfigId}`,
        update
      );

      setExperiments((prev) => {
        if (!prev) return null;
        return prev.map((exp) => {
          if (exp.id === experimentId) {
            return response.data;
          }
          return exp;
        });
      });

      toast.success("Transcription updated successfully", {
        position: "bottom-right",
        autoClose: 3000,
      });

      setShowJsonEditModal(false);
      setCurrentEditingLeia(null);
      setJsonEditText("");
      setJsonEditError(null);
    } catch (error) {
      let errorMessage = "Failed to save transcription";

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
    }
  };

  const handleCancelJsonEdit = () => {
    setShowJsonEditModal(false);
    setCurrentEditingLeia(null);
    setJsonEditText("");
    setJsonEditError(null);
  };

  const closeTranscriptionView = () => {
    setShowTranscriptionModal(false);
    setTranscriptionMessages([]);
  };

  const renderJsonPreview = () => {
    if (jsonEditError) {
      return (
        <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ height: "100%" }}>
          <ErrorOutlineIcon color="error" sx={{ fontSize: 48 }} />
          <Typography color="error" variant="h6">Invalid JSON</Typography>
          <Typography color="error" variant="body2" align="center">{jsonEditError}</Typography>
        </Stack>
      );
    }

    try {
      const messages = JSON.parse(jsonEditText || "[]");
      if (Array.isArray(messages) && messages.length > 0) {
        return <TranscriptionView messages={messages} />;
      }
      return (
        <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ height: "100%" }}>
          <DescriptionOutlinedIcon sx={{ fontSize: 48, color: "text.disabled" }} />
          <Typography variant="h6">No messages</Typography>
          <Typography color="text.secondary">Add messages in the editor to see the preview.</Typography>
        </Stack>
      );
    } catch {
      return (
        <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ height: "100%" }}>
          <ErrorOutlineIcon color="error" sx={{ fontSize: 48 }} />
          <Typography color="error" variant="h6">Invalid JSON</Typography>
          <Typography color="error" variant="body2">Check the syntax in the editor.</Typography>
        </Stack>
      );
    }
  };

  const filteredExperiments = (experiments || []).filter((experiment) =>
    experiment.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <Header title="My Activities" description="View and manage your activities" />
      <ToastContainer />

      <Dialog
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setNewExperimentName("");
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Create New Activity</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              autoFocus
              label="Activity Name"
              placeholder="Enter activity name..."
              value={newExperimentName}
              onChange={(event) => setNewExperimentName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && newExperimentName.trim()) {
                  void handleCreateExperiment();
                }
              }}
              fullWidth
            />
            {creatingNewExperiment && (
              <Alert severity="info" icon={<CircularProgress size={16} />}>
                Creating activity...
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            color="inherit"
            onClick={() => {
              setShowCreateModal(false);
              setNewExperimentName("");
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateExperiment}
            disabled={!newExperimentName.trim() || creatingNewExperiment}
            startIcon={creatingNewExperiment ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
          >
            {creatingNewExperiment ? "Creating..." : "Create Activity"}
          </Button>
        </DialogActions>
      </Dialog>

      {(showLeiaModal || preloadModal) && (
        <LeiaViewModal
          leia={selectedLeia}
          isOpen={showLeiaModal}
          onClose={() => setShowLeiaModal(false)}
        />
      )}

      <Dialog open={showTranscriptionModal} onClose={closeTranscriptionView} fullWidth maxWidth="lg">
        <DialogTitle sx={{ pr: 7 }}>
          Transcription Messages
          <IconButton aria-label="Close" onClick={closeTranscriptionView} sx={{ position: "absolute", top: 12, right: 12 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ height: "70vh", p: 0 }}>
          <TranscriptionView messages={transcriptionMessages} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={showPreviewModal}
        onClose={generatingPreview ? undefined : handleCancelPreviewTranscription}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ pr: 7 }}>
          Transcription Preview
          <IconButton
            aria-label="Close"
            onClick={handleCancelPreviewTranscription}
            disabled={generatingPreview}
            sx={{ position: "absolute", top: 12, right: 12 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ height: "70vh", p: 0 }}>
          {generatingPreview ? (
            <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ height: "100%" }}>
              <CircularProgress />
              <Typography variant="h6">Generating transcription...</Typography>
              <Typography color="text.secondary">This may take a few moments.</Typography>
            </Stack>
          ) : previewMessages.length > 0 ? (
            <TranscriptionView messages={previewMessages} />
          ) : (
            <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ height: "100%" }}>
              <ErrorOutlineIcon sx={{ color: "text.disabled", fontSize: 48 }} />
              <Typography variant="h6">No messages generated</Typography>
              <Typography color="text.secondary">Something went wrong during generation.</Typography>
            </Stack>
          )}
        </DialogContent>
        {!generatingPreview && previewMessages.length > 0 && (
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button color="inherit" onClick={handleCancelPreviewTranscription}>Cancel</Button>
            <Button variant="contained" startIcon={<CheckIcon />} onClick={handleSavePreviewTranscription}>
              Save Transcription
            </Button>
          </DialogActions>
        )}
      </Dialog>

      <Dialog open={showJsonEditModal} onClose={handleCancelJsonEdit} fullWidth maxWidth="xl">
        <DialogTitle sx={{ pr: 7 }}>
          JSON Editor
          <IconButton aria-label="Close" onClick={handleCancelJsonEdit} sx={{ position: "absolute", top: 12, right: 12 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Tabs
          value={jsonEditTab}
          onChange={(_, value) => handleJsonEditTabChange(value as "editor" | "preview")}
          sx={{ px: 3, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab value="editor" label="Editor" />
          <Tab value="preview" label="Preview" />
        </Tabs>
        <DialogContent dividers sx={{ height: "65vh", p: jsonEditTab === "editor" ? 1 : 0 }}>
          {jsonEditTab === "editor" ? (
            <Editor
              height="100%"
              defaultLanguage="json"
              value={jsonEditText}
              onChange={handleJsonEditorChange}
              onMount={handleMonacoEditorMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: "on",
                formatOnPaste: true,
                formatOnType: true,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                tabSize: 2,
                insertSpaces: true,
                renderLineHighlight: "line",
                renderWhitespace: "boundary",
                bracketPairColorization: { enabled: true },
                quickSuggestions: true,
                hover: { enabled: true, delay: 100, sticky: true },
                fixedOverflowWidgets: true,
              }}
              theme="vs"
            />
          ) : (
            renderJsonPreview()
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between", px: 3, py: 2 }}>
          <Typography variant="body2" color="error">{jsonEditError || ""}</Typography>
          <Stack direction="row" spacing={1}>
            <Button color="inherit" onClick={handleCancelJsonEdit}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveJsonEdit} disabled={Boolean(jsonEditError)} startIcon={<CheckIcon />}>
              Save Changes
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
        <Container maxWidth="lg" sx={{ py: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
            <TextField
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                ),
              }}
            />
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowCreateModal(true)}>
              New Activity
            </Button>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ flex: 1, py: 3 }}>
        {loadingExperiments ? (
          <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ minHeight: 320 }}>
            <CircularProgress />
            <Typography color="text.secondary">Loading activities...</Typography>
          </Stack>
        ) : errorLoadingExperiments ? (
          <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 320 }}>
            <Alert severity="error" sx={{ maxWidth: 520 }}>
              <Typography variant="subtitle2">Something went wrong</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>{errorLoadingExperiments}</Typography>
              <Button color="error" variant="contained" size="small" startIcon={<RefreshIcon />} sx={{ mt: 1.5 }} onClick={fetchExperiments}>
                Try Again
              </Button>
            </Alert>
          </Stack>
        ) : experiments ? (
          experiments.length === 0 ? (
            <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ minHeight: 320, textAlign: "center" }}>
              <BusinessCenterOutlinedIcon sx={{ fontSize: 64, color: "text.disabled" }} />
              <Typography variant="h6">No activities yet</Typography>
              <Typography color="text.secondary">Create your first activity to get started.</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: "100%", maxWidth: 440, mt: 1 }}>
                <TextField
                  size="small"
                  placeholder="Activity Name"
                  value={newExperimentName}
                  onChange={(event) => setNewExperimentName(event.target.value)}
                  disabled={creatingNewExperiment}
                  fullWidth
                />
                <Button
                  variant="contained"
                  onClick={handleCreateExperiment}
                  disabled={creatingNewExperiment || !newExperimentName.trim()}
                  startIcon={creatingNewExperiment ? <CircularProgress color="inherit" size={16} /> : <AddIcon />}
                >
                  Create
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              {filteredExperiments.map((experiment, experimentIndex) => {
                const expanded = expandedExperiments.has(experiment.id);

                return (
                  <Paper
                    key={experiment.id}
                    id={experimentIndex === 0 ? "first-activity-open" : undefined}
                    variant="outlined"
                    sx={{ overflow: "hidden" }}
                  >
                    <Stack
                      id={experimentIndex === 0 ? "first-activity" : undefined}
                      direction={{ xs: "column", md: "row" }}
                      justifyContent="space-between"
                      alignItems={{ md: "flex-start" }}
                      spacing={2}
                      sx={{ p: 2.5 }}
                    >
                      <Box>
                        <Typography variant="h6">{experiment.name}</Typography>
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.75 }}>
                          <Typography variant="caption" color="text.secondary">
                            Created: {new Date(experiment.createdAt).toLocaleDateString()}
                          </Typography>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Box component="img" src="/logo/leia_puzzle_black.png" alt="" sx={{ width: 16, height: 16 }} />
                            <Typography variant="caption" color="text.secondary">
                              {experiment.leias?.length || 0} LEIAs
                            </Typography>
                          </Stack>
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        {experiment.isPublished && <Chip label="Published" color="success" size="small" />}
                        {experiment.isPublished ? (
                          <Button size="small" color="secondary" variant="contained" startIcon={<ContentCopyIcon />} onClick={() => handleFastReplication(experiment.id)}>
                            Replicate
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => publishExperiment(experiment)}
                              disabled={publishingExperiments.has(experiment.id)}
                              startIcon={publishingExperiments.has(experiment.id) ? <CircularProgress color="inherit" size={14} /> : <AddIcon />}
                            >
                              {publishingExperiments.has(experiment.id) ? "Publishing..." : "Publish"}
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              color="error"
                              startIcon={<DeleteOutlineIcon />}
                              onClick={() => handleDeleteExperiment(experiment.id)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                        <IconButton
                          aria-label={expanded ? "Collapse activity" : "Expand activity"}
                          onClick={() => toggleExperiment(experiment.id)}
                        >
                          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </Stack>
                    </Stack>

                    <Collapse in={expanded}>
                      <Box sx={{ borderTop: 1, borderColor: "divider" }}>
                        {experiment.leias && experiment.leias.length > 0 ? (
                          <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
                            {experiment.leias.map((leiaConfig, leiaIndex) => {
                              const leia = typeof leiaConfig.leia === "object" ? leiaConfig.leia : null;
                              const leiaKey = experiment.id + "-" + leiaConfig.id;
                              const hasTranscription =
                                Boolean(leiaConfig.configuration?.data?.messages) ||
                                Boolean(leiaConfig.configuration?.data?.link);
                              const urlValue = urlInputValues[leiaKey] || "";
                              const validUrl = !urlValue || isValidUrl(urlValue);

                              return (
                                <Box key={leiaConfig.id || leiaIndex} sx={{ p: 2.5 }}>
                                  <Stack spacing={1.5}>
                                    <Stack direction={{ xs: "column", md: "row" }} alignItems={{ md: "center" }} justifyContent="space-between" spacing={1.5}>
                                      <Stack direction="row" alignItems="center" spacing={1}>
                                        <Typography variant="subtitle2">{leia?.metadata?.name || "LEIA " + String(leiaIndex + 1)}</Typography>
                                        {leia && (
                                          <Tooltip title="View LEIA content">
                                            <IconButton
                                              size="small"
                                              color="primary"
                                              onClick={() => viewLeiaContent(leia)}
                                              onMouseEnter={() => setPreloadModal(true)}
                                            >
                                              <VisibilityOutlinedIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
                                        )}
                                        {leiaConfig.configuration?.mode && (
                                          experiment.isPublished ? (
                                            <Chip label={leiaConfig.configuration.mode} size="small" color="primary" variant="outlined" />
                                          ) : (
                                            <TextField
                                              select
                                              label="Mode"
                                              size="small"
                                              value={leiaConfig.configuration.mode}
                                              onChange={(event) =>
                                                handleUpdateExperimentLeiaMode(
                                                  experiment.id,
                                                  leiaConfig.id,
                                                  leiaConfig,
                                                  event.target.value,
                                                )
                                              }
                                              sx={{ minWidth: 150 }}
                                            >
                                              <MenuItem value="standard">standard</MenuItem>
                                              <MenuItem value="transcription">transcription</MenuItem>
                                            </TextField>
                                          )
                                        )}
                                      </Stack>
                                      {!experiment.isPublished && (
                                        <Button
                                          size="small"
                                          color="error"
                                          variant="contained"
                                          startIcon={<DeleteOutlineIcon />}
                                          onClick={() => handleDeleteExperimentLeia(experiment.id, leiaConfig.id)}
                                        >
                                          Delete LEIA
                                        </Button>
                                      )}
                                    </Stack>

                                    {leiaConfig.configuration?.mode === "transcription" && (
                                      <>
                                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} spacing={1.5}>
                                          {hasTranscription ? (
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                              <Chip
                                                size="small"
                                                color="primary"
                                                label={leiaConfig.configuration?.data?.link ? "External Link" : "Chat Messages"}
                                              />
                                              <Tooltip title="View transcription content">
                                                <IconButton
                                                  size="small"
                                                  color="primary"
                                                  onClick={() => handleViewTranscription(leiaConfig.configuration?.data)}
                                                >
                                                  <DescriptionOutlinedIcon fontSize="small" />
                                                </IconButton>
                                              </Tooltip>
                                            </Stack>
                                          ) : (
                                            <Alert severity="warning" icon={<WarningAmberOutlinedIcon fontSize="inherit" />} sx={{ py: 0 }}>
                                              No transcription available
                                            </Alert>
                                          )}

                                          {!experiment.isPublished && (
                                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                              <Button
                                                size="small"
                                                variant="contained"
                                                startIcon={<LinkIcon />}
                                                disabled={Boolean(initializingTranscriptionChat)}
                                                onClick={() =>
                                                  setShowUrlInput((previous) => {
                                                    const next = new Set(previous);
                                                    if (next.has(leiaKey)) next.delete(leiaKey);
                                                    else next.add(leiaKey);
                                                    return next;
                                                  })
                                                }
                                              >
                                                Add Link
                                              </Button>
                                              <Button
                                                size="small"
                                                color="secondary"
                                                variant="contained"
                                                startIcon={
                                                  initializingTranscriptionChat === leiaKey
                                                    ? <CircularProgress color="inherit" size={14} />
                                                    : <EditOutlinedIcon />
                                                }
                                                disabled={Boolean(initializingTranscriptionChat)}
                                                onClick={() =>
                                                  handleCreateTranscriptionManually(
                                                    experiment.id,
                                                    leiaConfig.id,
                                                    leiaConfig,
                                                  )
                                                }
                                              >
                                                Generate
                                              </Button>
                                              <Button
                                                size="small"
                                                color="warning"
                                                variant="contained"
                                                startIcon={<AutoAwesomeIcon />}
                                                disabled={Boolean(initializingTranscriptionChat)}
                                                onClick={() =>
                                                  handleGenerateTranscriptionAutomatically(
                                                    experiment.id,
                                                    leiaConfig.id,
                                                    leiaConfig,
                                                  )
                                                }
                                              >
                                                Auto Generate
                                              </Button>
                                              <Button
                                                size="small"
                                                color="success"
                                                variant="contained"
                                                startIcon={<DescriptionOutlinedIcon />}
                                                disabled={Boolean(initializingTranscriptionChat)}
                                                onClick={() => handleOpenJsonEdit(experiment.id, leiaConfig.id, leiaConfig)}
                                              >
                                                JSON Edit
                                              </Button>
                                            </Stack>
                                          )}
                                        </Stack>

                                        {showUrlInput.has(leiaKey) && !experiment.isPublished && (
                                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                            <TextField
                                              type="url"
                                              label="Transcription URL"
                                              placeholder="Enter transcription URL..."
                                              value={urlValue}
                                              onChange={(event) =>
                                                setUrlInputValues((previous) => ({
                                                  ...previous,
                                                  [leiaKey]: event.target.value,
                                                }))
                                              }
                                              error={!validUrl}
                                              helperText={!validUrl ? "Please enter a valid URL" : ""}
                                              fullWidth
                                            />
                                            <Stack direction="row" spacing={1} alignItems="flex-start">
                                              <Button
                                                variant="contained"
                                                disabled={Boolean(initializingTranscriptionChat) || !urlValue || !validUrl}
                                                onClick={() => {
                                                  handleAddTranscriptionLink(
                                                    experiment.id,
                                                    leiaConfig.id,
                                                    leiaConfig,
                                                    urlValue.trim(),
                                                  );
                                                  setUrlInputValues((previous) => ({ ...previous, [leiaKey]: "" }));
                                                  setShowUrlInput((previous) => {
                                                    const next = new Set(previous);
                                                    next.delete(leiaKey);
                                                    return next;
                                                  });
                                                }}
                                              >
                                                Add
                                              </Button>
                                              <Button
                                                color="inherit"
                                                variant="contained"
                                                onClick={() => {
                                                  setUrlInputValues((previous) => ({ ...previous, [leiaKey]: "" }));
                                                  setShowUrlInput((previous) => {
                                                    const next = new Set(previous);
                                                    next.delete(leiaKey);
                                                    return next;
                                                  });
                                                }}
                                              >
                                                Cancel
                                              </Button>
                                            </Stack>
                                          </Stack>
                                        )}

                                        <Alert severity="warning" icon={<WarningAmberOutlinedIcon fontSize="inherit" />}>
                                          Any transcription update overwrites previous data.
                                        </Alert>
                                      </>
                                    )}
                                  </Stack>
                                </Box>
                              );
                            })}
                          </Stack>
                        ) : (
                          <Stack alignItems="center" spacing={1} sx={{ p: 4 }}>
                            <Box component="img" src="/logo/leia_puzzle_black.png" alt="" sx={{ width: 32, height: 32, opacity: 0.3 }} />
                            <Typography variant="body2" color="text.secondary">No LEIAs in this experiment</Typography>
                          </Stack>
                        )}
                      </Box>
                    </Collapse>
                  </Paper>
                );
              })}
            </Stack>
          )
        ) : null}
      </Container>
    </Box>
  );
};

export default MyActivities;
