import type React from "react";
import { Header } from "../components/shared/Header";
import { useEffect, useState, useCallback } from "react";
import type { Experiment, LeiaConfig } from "../models/Experiment";
import type { Leia } from "../models/Leia";
import api from "../lib/axios";
import { z } from "zod";
import { ToastContainer, toast } from "react-toastify";
import { LeiaViewModal } from "../components/LeiaViewModal";
import { TranscriptionView } from "../components/TranscriptionView";
import {
  ExclamationCircleIcon,
  ArrowPathIcon,
  BriefcaseIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  TrashIcon,
  LinkIcon,
  PencilIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  DocumentIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Select from "react-select";
import { useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import * as Tabs from "@radix-ui/react-tabs";
import "../styles/monaco-tooltip-fix.css";

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
      if (error instanceof Error) {
        toast.error("Could not create new activity: " + error.message, {
          position: "bottom-right",
          autoClose: 5000,
        });
      }
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
          axiosError.response?.status === 404
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

  const handleUpdateExperimentLeiaAudioMode = async (
    experimentId: string,
    leiaConfigId: string,
    leiaConfig: LeiaConfig,
    enabled: boolean
  ) => {
    try {
      const update = {
        leia:
          typeof leiaConfig.leia === "string"
            ? leiaConfig.leia
            : leiaConfig.leia.id,
        configuration: {
          ...leiaConfig.configuration,
          audioMode: enabled ? "realtime" : null,
          realtimeConfig: enabled
            ? {
                model: "gpt-4o-realtime-preview",
                voice: "marin",
                instructions: "",
                turnDetection: {
                  type: "server_vad",
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 500,
                },
              }
            : undefined,
        },
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

      toast.success(
        enabled ? "Audio mode enabled" : "Audio mode disabled",
        {
          position: "bottom-right",
          autoClose: 2000,
        }
      );
    } catch (error) {
      let errorMessage = "Failed to update audio mode";

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

  return (
    <div className="flex flex-col h-screen bg-white">
      <Header
        title="My Activities"
        description="View and manage your activities"
      />
      <ToastContainer />

      {/* Create Activity Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
              setNewExperimentName("");
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
            <div
              className="p-6"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Create New Activity
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Activity Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter activity name..."
                    value={newExperimentName}
                    onChange={(e) => setNewExperimentName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && newExperimentName.trim()) {
                        handleCreateExperiment();
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>

                {creatingNewExperiment && (
                  <div className="flex items-center justify-center text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Creating activity...
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewExperimentName("");
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateExperiment}
                    disabled={
                      !newExperimentName.trim() || creatingNewExperiment
                    }
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2"
                  >
                    {creatingNewExperiment ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Creating...
                      </>
                    ) : (
                      "Create Activity"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LEIA Content Modal - Mantener montado para mejor rendimiento */}
      {(showLeiaModal || preloadModal) && (
        <LeiaViewModal
          leia={selectedLeia}
          isOpen={showLeiaModal}
          onClose={() => setShowLeiaModal(false)}
        />
      )}

      {/* Transcription View Modal */}
      {showTranscriptionModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTranscriptionModal(false);
              setTranscriptionMessages([]);
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl mx-4 h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Transcription Messages
              </h2>
              <button
                onClick={() => {
                  setShowTranscriptionModal(false);
                  setTranscriptionMessages([]);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Content - TranscriptionView */}
            <div className="flex-1 overflow-hidden">
              <TranscriptionView messages={transcriptionMessages} />
            </div>
          </div>
        </div>
      )}

      {/* Transcription Preview Modal */}
      {showPreviewModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget && !generatingPreview) {
              handleCancelPreviewTranscription();
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl mx-4 h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Transcription Preview
              </h2>
              <button
                onClick={handleCancelPreviewTranscription}
                disabled={generatingPreview}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden">
              {generatingPreview ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600 text-lg mb-2">
                    Generating transcription...
                  </p>
                  <p className="text-gray-500 text-sm">
                    This may take a few moments
                  </p>
                </div>
              ) : previewMessages.length > 0 ? (
                <TranscriptionView messages={previewMessages} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="text-gray-400 mb-4">
                    <ExclamationCircleIcon className="w-12 h-12 mx-auto" />
                  </div>
                  <p className="text-gray-600 text-lg mb-2">
                    No messages generated
                  </p>
                  <p className="text-gray-500 text-sm">
                    Something went wrong during generation
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {!generatingPreview && previewMessages.length > 0 && (
              <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
                <button
                  onClick={handleCancelPreviewTranscription}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePreviewTranscription}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Save Transcription
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* JSON Edit Modal */}
      {showJsonEditModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelJsonEdit();
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl mx-4 h-[85vh] flex flex-col relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                JSON Editor
              </h2>
              <button
                onClick={handleCancelJsonEdit}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Tabs Container */}
            <Tabs.Root
              value={jsonEditTab}
              onValueChange={(value) =>
                handleJsonEditTabChange(value as "editor" | "preview")
              }
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Tab Header */}
              <Tabs.List className="flex border-b border-gray-200">
                <Tabs.Trigger
                  value="editor"
                  className="px-4 py-2 text-sm font-medium transition-colors data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-blue-50 text-gray-600 hover:text-gray-800"
                >
                  Editor
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="preview"
                  className="px-4 py-2 text-sm font-medium transition-colors data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-blue-50 text-gray-600 hover:text-gray-800"
                >
                  Preview
                </Tabs.Trigger>
              </Tabs.List>

              {/* Editor Tab Content */}
              <Tabs.Content value="editor" className="flex-1 overflow-hidden">
                <div className="h-full relative" style={{ paddingTop: "8px" }}>
                  <Editor
                    height="calc(100% - 8px)"
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
                      suggest: {
                        showKeywords: true,
                        showSnippets: true,
                      },
                      quickSuggestions: true,
                      // Tooltip and hover configuration
                      hover: {
                        enabled: true,
                        delay: 100,
                        sticky: true,
                      },
                      // Fix tooltip positioning issues
                      fixedOverflowWidgets: true,
                    }}
                    theme="vs"
                  />
                </div>
              </Tabs.Content>

              {/* Preview Tab Content */}
              <Tabs.Content value="preview" className="flex-1 overflow-hidden">
                <div className="h-full">
                  {jsonEditError ? (
                    <div className="flex flex-col items-center justify-center h-full">
                      <div className="text-red-400 mb-4">
                        <ExclamationTriangleIcon className="w-12 h-12 mx-auto" />
                      </div>
                      <p className="text-red-600 text-lg mb-2">Invalid JSON</p>
                      <p className="text-red-500 text-sm text-center max-w-md">
                        {jsonEditError}
                      </p>
                    </div>
                  ) : (
                    <div className="h-full">
                      {(() => {
                        try {
                          const messages = JSON.parse(jsonEditText || "[]");
                          return Array.isArray(messages) &&
                            messages.length > 0 ? (
                            <TranscriptionView messages={messages} />
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full">
                              <div className="text-gray-400 mb-4">
                                <DocumentIcon className="w-12 h-12 mx-auto" />
                              </div>
                              <p className="text-gray-600 text-lg mb-2">
                                No messages
                              </p>
                              <p className="text-gray-500 text-sm">
                                Add messages in the editor to see the preview
                              </p>
                            </div>
                          );
                        } catch {
                          return (
                            <div className="flex flex-col items-center justify-center h-full">
                              <div className="text-red-400 mb-4">
                                <ExclamationTriangleIcon className="w-12 h-12 mx-auto" />
                              </div>
                              <p className="text-red-600 text-lg mb-2">
                                Invalid JSON
                              </p>
                              <p className="text-red-500 text-sm">
                                Check the syntax in the editor
                              </p>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  )}
                </div>
              </Tabs.Content>
            </Tabs.Root>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200">
              {/* Error message on the left */}
              <div className="flex-1">
                {jsonEditError && (
                  <div className="flex items-center gap-2 text-red-700 text-sm">
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="truncate">{jsonEditError}</span>
                  </div>
                )}
              </div>

              {/* Buttons on the right */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancelJsonEdit}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveJsonEdit}
                  disabled={!!jsonEditError}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activities Header with Search and Create */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-gray-50 text-gray-500 cursor-not-allowed focus:outline-none"
              />
            </div>

            {/* Create Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <PlusIcon className="h-5 w-5" />
              New Activity
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1">
        {loadingExperiments ? (
          // Loading State - Centered both ways
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading activities...</p>
            </div>
          </div>
        ) : errorLoadingExperiments ? (
          // Error State - Centered both ways
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md px-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="text-red-500 mb-4">
                  <ExclamationCircleIcon className="w-12 h-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-red-800 mb-2">
                  Something went wrong
                </h3>
                <p className="text-red-600 text-sm mb-4">
                  {errorLoadingExperiments}
                </p>
                <button
                  onClick={fetchExperiments}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center gap-2 mx-auto"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            </div>
          </div>
        ) : experiments ? (
          // Success State
          <div className="max-w-6xl mx-auto px-6 py-6 w-full">
            <div className="grid gap-4">
              {experiments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <BriefcaseIcon className="w-16 h-16 mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No activities yet
                  </h3>
                  <p className="text-gray-500">
                    Create your first activity to get started
                  </p>
                  <div className="mt-6 flex justify-center">
                    <input
                      type="text"
                      value={newExperimentName}
                      onChange={(e) => setNewExperimentName(e.target.value)}
                      placeholder="Activity Name"
                      className="px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={creatingNewExperiment}
                    />
                    <button
                      onClick={handleCreateExperiment}
                      className={`px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2 ${
                        creatingNewExperiment
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      disabled={
                        creatingNewExperiment || !newExperimentName.trim()
                      }
                    >
                      {creatingNewExperiment ? (
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      ) : (
                        "Create Activity"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {experiments.map((experiment) => (
                    <div
                      key={experiment.id}
                      className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow duration-200"
                    >
                      {/* Experiment Header */}
                      <div className="p-6 pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                              {experiment.name}
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>
                                Created:{" "}
                                {new Date(
                                  experiment.createdAt
                                ).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <img
                                  src="/logo/leia_puzzle_black.png"
                                  alt="LEIA"
                                  className="w-4 h-4"
                                />
                                {experiment.leias?.length || 0} LEIAs
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {experiment.isPublished && (
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 border border-green-200`}
                              >
                                Published
                              </span>
                            )}
                            {!experiment.isPublished && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => publishExperiment(experiment)}
                                  disabled={publishingExperiments.has(
                                    experiment.id
                                  )}
                                  className="h-8 px-3 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-1"
                                >
                                  {publishingExperiments.has(experiment.id) ? (
                                    <>
                                      <ArrowPathIcon className="w-3 h-3 animate-spin" />
                                      Publishing...
                                    </>
                                  ) : (
                                    <>
                                      <PlusIcon className="w-4 h-4" />
                                      Publish
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteExperiment(experiment.id)
                                  }
                                  className="h-8 px-3 flex items-center gap-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors duration-200 text-xs font-medium"
                                  title="Delete activity"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                  Delete Activity
                                </button>
                              </div>
                            )}
                            <button
                              onClick={() => toggleExperiment(experiment.id)}
                              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              {expandedExperiments.has(experiment.id) ? (
                                <ChevronUpIcon className="w-5 h-5" />
                              ) : (
                                <ChevronDownIcon className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* LEIAs Accordion */}
                      {expandedExperiments.has(experiment.id) && (
                        <div className="border-t border-gray-200">
                          {experiment.leias && experiment.leias.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                              {experiment.leias.map((leiaConfig, index) => {
                                const leia =
                                  typeof leiaConfig.leia === "object"
                                    ? leiaConfig.leia
                                    : null;
                                return (
                                  <div
                                    key={leiaConfig.id || index}
                                    className="p-4"
                                  >
                                    <div className="p-2">
                                      {/* First row: LEIA name, mode selector, delete button */}
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                          <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-gray-900">
                                              {leia?.metadata?.name ||
                                                `LEIA ${index + 1}`}
                                            </h4>
                                            {leia && (
                                              <button
                                                onClick={() =>
                                                  viewLeiaContent(leia)
                                                }
                                                onMouseEnter={() =>
                                                  setPreloadModal(true)
                                                }
                                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                title="View LEIA content"
                                              >
                                                <EyeIcon className="w-4 h-4" />
                                              </button>
                                            )}
                                          </div>

                                          {/* Mode selector */}
                                          {leiaConfig.configuration?.mode && (
                                            <div className="flex items-center gap-2">
                                              <span className="font-medium text-gray-600 text-sm">
                                                Mode:
                                              </span>
                                              {experiment.isPublished ? (
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                                  {
                                                    leiaConfig.configuration
                                                      .mode
                                                  }
                                                </span>
                                              ) : (
                                                <Select
                                                  value={{
                                                    value:
                                                      leiaConfig.configuration
                                                        .mode,
                                                    label:
                                                      leiaConfig.configuration
                                                        .mode,
                                                  }}
                                                  options={[
                                                    {
                                                      value: "standard",
                                                      label: "standard",
                                                    },
                                                    {
                                                      value: "transcription",
                                                      label: "transcription",
                                                    },
                                                  ]}
                                                  onChange={(
                                                    selectedOption
                                                  ) => {
                                                    if (selectedOption) {
                                                      handleUpdateExperimentLeiaMode(
                                                        experiment.id,
                                                        leiaConfig.id,
                                                        leiaConfig,
                                                        selectedOption.value
                                                      );
                                                    }
                                                  }}
                                                />
                                              )}
                                            </div>
                                          )}

                                          {/* Audio Mode Toggle */}
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-600 text-sm">
                                              Audio Mode:
                                            </span>
                                            {experiment.isPublished ? (
                                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                leiaConfig.configuration?.audioMode === 'realtime'
                                                  ? 'bg-purple-100 text-purple-800'
                                                  : 'bg-gray-100 text-gray-800'
                                              }`}>
                                                {leiaConfig.configuration?.audioMode === 'realtime' ? 'Enabled' : 'Disabled'}
                                              </span>
                                            ) : (
                                              <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  className="sr-only peer"
                                                  checked={leiaConfig.configuration?.audioMode === 'realtime'}
                                                  onChange={(e) => {
                                                    handleUpdateExperimentLeiaAudioMode(
                                                      experiment.id,
                                                      leiaConfig.id,
                                                      leiaConfig,
                                                      e.target.checked
                                                    );
                                                  }}
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                              </label>
                                            )}
                                            {leiaConfig.configuration?.audioMode === 'realtime' && (
                                              <span className="text-xs text-purple-600 flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                </svg>
                                                Voice: {leiaConfig.configuration?.realtimeConfig?.voice || 'marin'}
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Delete button */}
                                        {experiment.isPublished == false && (
                                          <button
                                            className="h-8 px-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 text-xs font-medium flex items-center gap-1"
                                            onClick={() =>
                                              handleDeleteExperimentLeia(
                                                experiment.id,
                                                leiaConfig.id
                                              )
                                            }
                                            title="Delete LEIA from activity"
                                          >
                                            <TrashIcon className="w-4 h-4" />
                                            Delete LEIA
                                          </button>
                                        )}
                                      </div>

                                      {/* Second row: Transcription section */}
                                      {leiaConfig.configuration?.mode ===
                                        "transcription" && (
                                        <div className="flex items-center justify-between mt-3">
                                          <div className="flex items-center gap-4">
                                            {leiaConfig.configuration?.data
                                              ?.messages ||
                                            leiaConfig.configuration?.data
                                              ?.link ? (
                                              <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 text-sm">
                                                  <span className="font-medium text-gray-600">
                                                    Transcription Type:
                                                  </span>
                                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                                    {leiaConfig.configuration
                                                      ?.data?.link
                                                      ? "External Link"
                                                      : "Chat Messages"}
                                                  </span>
                                                </div>
                                                <button
                                                  onClick={() =>
                                                    handleViewTranscription(
                                                      leiaConfig.configuration
                                                        ?.data
                                                    )
                                                  }
                                                  className="text-gray-400 hover:text-blue-600 transition-colors"
                                                  title="View transcription content"
                                                >
                                                  <DocumentIcon className="w-5 h-5" />
                                                </button>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-2 text-amber-700 bg-amber-100 px-3 py-2 rounded-md text-sm font-medium border border-amber-200">
                                                <ExclamationTriangleIcon className="w-4 h-4" />
                                                No Transcription Available
                                              </div>
                                            )}
                                          </div>

                                          {!experiment.isPublished && (
                                            <div className="flex items-center gap-2 ml-4">
                                              <button
                                                onClick={() => {
                                                  const leiaKey = `${experiment.id}-${leiaConfig.id}`;
                                                  setShowUrlInput((prev) => {
                                                    const newSet = new Set(
                                                      prev
                                                    );
                                                    if (newSet.has(leiaKey)) {
                                                      newSet.delete(leiaKey);
                                                    } else {
                                                      newSet.add(leiaKey);
                                                    }
                                                    return newSet;
                                                  });
                                                }}
                                                disabled={
                                                  !!initializingTranscriptionChat
                                                }
                                                className="h-8 px-3 flex items-center gap-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-medium"
                                                title="Add transcription link"
                                              >
                                                <LinkIcon className="w-4 h-4" />
                                                Add Link
                                              </button>

                                              <button
                                                onClick={() =>
                                                  handleCreateTranscriptionManually(
                                                    experiment.id,
                                                    leiaConfig.id,
                                                    leiaConfig
                                                  )
                                                }
                                                disabled={
                                                  !!initializingTranscriptionChat
                                                }
                                                className="h-8 px-3 flex items-center gap-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-medium"
                                                title="Create transcription manually"
                                              >
                                                {initializingTranscriptionChat ===
                                                `${experiment.id}-${leiaConfig.id}` ? (
                                                  <>
                                                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                    Initializing...
                                                  </>
                                                ) : (
                                                  <>
                                                    <PencilIcon className="w-4 h-4" />
                                                    Generate
                                                  </>
                                                )}
                                              </button>

                                              <button
                                                onClick={() =>
                                                  handleGenerateTranscriptionAutomatically(
                                                    experiment.id,
                                                    leiaConfig.id,
                                                    leiaConfig
                                                  )
                                                }
                                                disabled={
                                                  !!initializingTranscriptionChat
                                                }
                                                className="h-8 px-3 flex items-center gap-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:bg-orange-400 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-medium"
                                                title="Generate transcription automatically"
                                              >
                                                <SparklesIcon className="w-4 h-4" />
                                                Auto Generate
                                              </button>

                                              <button
                                                onClick={() =>
                                                  handleOpenJsonEdit(
                                                    experiment.id,
                                                    leiaConfig.id,
                                                    leiaConfig
                                                  )
                                                }
                                                disabled={
                                                  !!initializingTranscriptionChat
                                                }
                                                className="h-8 px-3 flex items-center gap-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-medium"
                                                title="Edit transcription JSON"
                                              >
                                                <DocumentIcon className="w-4 h-4" />
                                                JSON Edit
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* URL Input */}
                                      {showUrlInput.has(
                                        `${experiment.id}-${leiaConfig.id}`
                                      ) &&
                                        !experiment.isPublished && (
                                          <div className="space-y-2 mt-3">
                                            <div className="flex gap-3">
                                              <input
                                                type="url"
                                                placeholder="Enter transcription URL..."
                                                value={
                                                  urlInputValues[
                                                    `${experiment.id}-${leiaConfig.id}`
                                                  ] || ""
                                                }
                                                onChange={(e) => {
                                                  const leiaKey = `${experiment.id}-${leiaConfig.id}`;
                                                  setUrlInputValues((prev) => ({
                                                    ...prev,
                                                    [leiaKey]: e.target.value,
                                                  }));
                                                }}
                                                className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                                                  urlInputValues[
                                                    `${experiment.id}-${leiaConfig.id}`
                                                  ] &&
                                                  !isValidUrl(
                                                    urlInputValues[
                                                      `${experiment.id}-${leiaConfig.id}`
                                                    ]
                                                  )
                                                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                                                    : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                                }`}
                                              />
                                              <button
                                                onClick={() => {
                                                  const leiaKey = `${experiment.id}-${leiaConfig.id}`;
                                                  const url =
                                                    urlInputValues[leiaKey];
                                                  if (
                                                    url &&
                                                    url.trim() &&
                                                    isValidUrl(url.trim())
                                                  ) {
                                                    handleAddTranscriptionLink(
                                                      experiment.id,
                                                      leiaConfig.id,
                                                      leiaConfig,
                                                      url.trim()
                                                    );
                                                    setUrlInputValues(
                                                      (prev) => ({
                                                        ...prev,
                                                        [leiaKey]: "",
                                                      })
                                                    );
                                                    setShowUrlInput((prev) => {
                                                      const newSet = new Set(
                                                        prev
                                                      );
                                                      newSet.delete(leiaKey);
                                                      return newSet;
                                                    });
                                                  }
                                                }}
                                                disabled={
                                                  !!initializingTranscriptionChat ||
                                                  !urlInputValues[
                                                    `${experiment.id}-${leiaConfig.id}`
                                                  ] ||
                                                  !isValidUrl(
                                                    urlInputValues[
                                                      `${experiment.id}-${leiaConfig.id}`
                                                    ] || ""
                                                  )
                                                }
                                                className="h-8 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-medium"
                                              >
                                                Add
                                              </button>
                                              <button
                                                onClick={() => {
                                                  const leiaKey = `${experiment.id}-${leiaConfig.id}`;
                                                  setUrlInputValues((prev) => ({
                                                    ...prev,
                                                    [leiaKey]: "",
                                                  }));
                                                  setShowUrlInput((prev) => {
                                                    const newSet = new Set(
                                                      prev
                                                    );
                                                    newSet.delete(leiaKey);
                                                    return newSet;
                                                  });
                                                }}
                                                className="h-8 px-4 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 text-sm font-medium"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                            {urlInputValues[
                                              `${experiment.id}-${leiaConfig.id}`
                                            ] &&
                                              !isValidUrl(
                                                urlInputValues[
                                                  `${experiment.id}-${leiaConfig.id}`
                                                ]
                                              ) && (
                                                <p className="text-red-500 text-xs">
                                                  Please enter a valid URL
                                                </p>
                                              )}
                                          </div>
                                        )}

                                      {/* Transcription Warning */}
                                      {leiaConfig.configuration?.mode ===
                                        "transcription" && (
                                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                          <div className="flex items-start gap-2">
                                            <ExclamationTriangleIcon className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                            <p className="text-sm text-yellow-800">
                                              <span className="font-medium">
                                                Important:
                                              </span>{" "}
                                              Any form of transcription update
                                              will result in overwriting
                                              previous data.
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-6 text-center text-gray-500">
                              <img
                                src="/logo/leia_puzzle_black.png"
                                alt="LEIA"
                                className="w-8 h-8 mx-auto opacity-30 mb-2"
                              />
                              <p className="text-sm">
                                No LEIAs in this experiment
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MyActivities;
