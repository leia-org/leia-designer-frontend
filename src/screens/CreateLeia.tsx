import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Editor } from "@monaco-editor/react";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Menu,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { SelectionColumn } from "../components/shared/SelectionColumn";
import { Header } from "../components/shared/Header";
import { ResourceEditor } from "../components/ResourceEditor";
import { DeleteResourceModal } from "../components/DeleteResourceModal";
import { AddLeiaToAnActivity } from "../components/AddLeiaToAnActivity";
import { ProblemChatPanel, type ProblemChatState } from "../components/ProblemChatPanel";
import { LeiaLivePreview } from "../components/LeiaLivePreview";
import { ProblemWidgetsEditor } from "../components/ProblemWidgetsEditor";
import { useAuth } from "../context";
import type {
  Persona,
  Behaviour,
  Problem,
  ProblemSpec,
  ProblemWidget,
  Leia as LeiaResource,
} from "../models/Leia";
import type { Rubric, RubricDefinition, RubricSnapshot } from "../models/Rubric";
import { useApiKeys } from "../hooks/useApiKeys";
import { useProviders } from "../hooks/useProviders";
import api from "../lib/axios";
import {
  createLeiaDraft,
  deleteLeiaDraft,
  listLeiaDrafts,
  type LeiaDraft,
  updateLeiaDraft,
} from "../lib/leiaDrafts";
import { generateLeia } from "../lib/leia";
import { RubricPreview } from "../components/RubricPreview";
import { parseRubricMarkdown } from "../lib/rubrics";
import { toast, ToastContainer } from "react-toastify";

interface Label {
  id?: string;
  _id?: string;
  name: string;
  color: string;
  secundaryColor: string;
  isGlobal?: boolean;
  user?: unknown;
}

interface LabelDraft {
  id: string;
  name: string;
  color: string;
  secundaryColor: string;
  isGlobal: boolean;
}

type LabelOption = {
  value: string;
  label: string;
  color: string;
  secundaryColor: string;
  isGlobal: boolean;
};

interface LeiaConfig {
  persona: Persona | null;
  problem: Problem | null;
  behaviour: Behaviour | null;
}

interface Leia {
  spec: {
    persona: Persona;
    problem: Problem;
    behaviour: Behaviour;
    rubric?: RubricSnapshot;
    rubricId?: string;
  };
}

type LeiaCustomizations = {
  persona?: { name: string; version?: string };
  problem?: { name: string; version?: string };
  behaviour?: { name: string; version?: string };
  leia: { name: string; version?: string };
};

type SupervisorConfig = {
  enabled: boolean;
  instructions: string;
  sensitivity: "low" | "medium" | "high";
  cadence: "everyN" | "onFinish";
  everyN: number;
  intervene: boolean;
  interveneInstructions: string;
  apiKeyId: string | null;
  model: string;
};

interface NavigationState {
  draft?: LeiaDraft<CreateLeiaDraftState>;
  preset?: {
    persona: Persona | null;
    problem: Problem | null;
    behaviour: Behaviour | null;
  };
  startTourFromSearch?: boolean;
  save?: {
    currentStep: WizardStep;
    leiaConfig: LeiaConfig;
    leiaConfigSnapShot: LeiaConfig | null;
    labelIds?: string[];
    labelId?: string | null;
    customizations: LeiaCustomizations;
    draftId?: string | null;
    chatState?: ProblemChatState;
    chatModelName?: string;
    chatApiKeyId?: string | null;
    pendingLabelDrafts?: LabelDraft[];
    rubricDraft?: RubricSnapshot | null;
    supervisorConfig?: SupervisorConfig;
    leiaNameManuallyEdited?: boolean;
    leiaPublish?: boolean;
    behaviourPublish?: boolean;
    problemPublish?: boolean;
    personaPublish?: boolean;
  };
}

type WizardStep = 1 | 2;

interface CreateLeiaDraftState {
  currentStep: WizardStep;
  leiaConfig: LeiaConfig;
  leiaConfigSnapShot: LeiaConfig | null;
  customizations: LeiaCustomizations;
  leiaNameManuallyEdited: boolean;
  selectedLabelIds: string[];
  pendingLabelDrafts: LabelDraft[];
  rubricDraft: RubricSnapshot | null;
  chatState: ProblemChatState;
  chatModelName: string;
  chatApiKeyId: string | null;
  supervisorConfig: SupervisorConfig;
  leiaPublish: boolean;
  behaviourPublish: boolean;
  problemPublish: boolean;
  personaPublish: boolean;
}

const DEFAULT_PROBLEM_GENERATION_SUBJECT = "Sistema de biblioteca";
const DEFAULT_PROBLEM_GENERATION_DETAILS =
  "Incluye catalogo, prestamos, reservas, cuentas de socios y notificaciones de vencimiento.";

const DEFAULT_BEHAVIOUR_GENERATION_SUBJECT = "Bibliotecario experto";
const DEFAULT_BEHAVIOUR_GENERATION_DETAILS =
  "Mantén un tono profesional y colaborativo. Debe guiar al estudiante con preguntas de aclaración sobre catálogo, préstamos, reservas y multas.";

const PENDING_LABEL_PREFIX = "__pending_label__";
const EMPTY_CHAT_STATE: ProblemChatState = { messages: [], input: "" };
const DEFAULT_SUPERVISOR_CONFIG: SupervisorConfig = {
  enabled: false,
  instructions: "",
  sensitivity: "medium",
  cadence: "everyN",
  everyN: 4,
  intervene: false,
  interveneInstructions: "",
  apiKeyId: null,
  model: "",
};

const createEmptyLeiaConfig = (): LeiaConfig => ({
  persona: null,
  problem: null,
  behaviour: null,
});

const createEmptyCustomizations = (): LeiaCustomizations => ({
  leia: { name: "", version: "1.0.0" },
});

const copyProcess = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((process): process is string => typeof process === "string")
    : [];

export const CreateLeia: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuth().user;
  const { user: currentUser } = useAuth();
  const tourRef = useRef<ReturnType<typeof driver> | null>(null);
  const {
    apiKeys,
    isLoading: isApiKeysLoading,
    getDefaultKey,
  } = useApiKeys();
  const {
    apiKeyProvidersMapped,
    providerProviderModuleMap,
    defaultModel,
    isLoading: isProvidersLoading,
  } = useProviders();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [tourRequested, setTourRequested] = useState(false);
  const [nameActivityReplication, setNameActivityReplication] = useState("");
  const [showActivityReplicationModal, setShowActivityReplicationModal] = useState(false);
  const [leiaConfig, setLeiaConfig] = useState<LeiaConfig>(createEmptyLeiaConfig);
  const [leiaConfigSnapShot, setLeiaConfigSnapShot] =
    useState<LeiaConfig | null>(null);
  const [generatedLeia, setGeneratedLeia] = useState<Leia | null>(null);

  const [customizations, setCustomizations] = useState<LeiaCustomizations>(
    createEmptyCustomizations,
  );
  const [leiaNameManuallyEdited, setLeiaNameManuallyEdited] = useState(false);
  const [showComponentSelector, setShowComponentSelector] = useState(false);
  const [chatApiKeyId, setChatApiKeyId] = useState<string | null>(null);
  const [chatModelName, setChatModelName] = useState("");
  const [chatSettingsAnchor, setChatSettingsAnchor] = useState<HTMLElement | null>(null);
  const [chatState, setChatState] = useState<ProblemChatState>(EMPTY_CHAT_STATE);
  const [chatResetKey, setChatResetKey] = useState(0);
  const [drafts, setDrafts] = useState<LeiaDraft<CreateLeiaDraftState>[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [showDraftsDialog, setShowDraftsDialog] = useState(false);
  const [isDraftsLoading, setIsDraftsLoading] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [showLeaveDraftDialog, setShowLeaveDraftDialog] = useState(false);
  const currentDraftIdRef = useRef<string | null>(null);
  const draftSavePromiseRef = useRef<Promise<LeiaDraft<CreateLeiaDraftState> | null> | null>(null);
  const pendingLeaveActionRef = useRef<(() => void) | null>(null);

  const [validationErrors, setValidationErrors] = useState<
    | {
        [key in keyof typeof customizations]?: string;
      }
    | null
  >(null);

  // Estados para los datos de la API
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [behaviours, setBehaviours] = useState<Behaviour[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [rubricDraft, setRubricDraft] = useState<RubricSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<Error | null>(null);
  const [testingLeia, setTestingLeia] = useState(false);
  // Per-LEIA background supervisor (instructor-authored). Persisted into
  // spec.supervisorConfig; runs on the LEIA's own key in the workbench.
  const [supervisorConfig, setSupervisorConfig] = useState<SupervisorConfig>(
    DEFAULT_SUPERVISOR_CONFIG,
  );
  // The New LEIA assistant always uses the OpenAI Responses API, so its
  // model and key are scoped to OpenAI and configured from the workspace header.
  const chatOpenaiKeys = useMemo(
    () => apiKeys.filter((key) => key.provider === "openai"),
    [apiKeys],
  );
  const chatOpenaiModels = useMemo(
    () => apiKeyProvidersMapped?.openai || [],
    [apiKeyProvidersMapped],
  );
  const chatOptionsLoading = isApiKeysLoading || isProvidersLoading;
  useEffect(() => {
    if (chatOptionsLoading) return;

    let nextApiKeyId =
      chatApiKeyId && chatOpenaiKeys.some((key) => key.id === chatApiKeyId)
        ? chatApiKeyId
        : null;
    if (!nextApiKeyId) {
      const defaultKey = getDefaultKey();
      nextApiKeyId =
        defaultKey?.provider === "openai"
          ? defaultKey.id
          : (chatOpenaiKeys[0]?.id ?? null);
      if (nextApiKeyId !== chatApiKeyId) {
        setChatApiKeyId(nextApiKeyId);
      }
    }

    const keyModel = chatOpenaiKeys.find((key) => key.id === nextApiKeyId)?.model;
    setChatModelName((previous) => {
      if (previous && chatOpenaiModels.includes(previous)) return previous;
      if (keyModel && chatOpenaiModels.includes(keyModel)) return keyModel;
      if (defaultModel && chatOpenaiModels.includes(defaultModel)) return defaultModel;
      return chatOpenaiModels[0] ?? "";
    });
  }, [
    chatApiKeyId,
    chatOpenaiKeys,
    chatOpenaiModels,
    chatOptionsLoading,
    defaultModel,
    getDefaultKey,
  ]);

  const handleChatApiKeyChange = useCallback(
    (apiKeyId: string | null) => {
      setChatApiKeyId(apiKeyId);
      const keyModel = chatOpenaiKeys.find((key) => key.id === apiKeyId)?.model;
      if (keyModel && chatOpenaiModels.includes(keyModel)) {
        setChatModelName(keyModel);
      }
    },
    [chatOpenaiKeys, chatOpenaiModels],
  );
  // OpenAI keys/models available to the supervisor (it always runs on OpenAI).
  const supervisorOpenaiKeys = useMemo(
    () => apiKeys.filter((k) => k.provider === "openai"),
    [apiKeys],
  );
  const supervisorOpenaiModels = useMemo(
    () => apiKeyProvidersMapped?.openai || [],
    [apiKeyProvidersMapped],
  );
  // Seed a sensible default OpenAI key + model once the supervisor is enabled.
  useEffect(() => {
    if (!supervisorConfig.enabled) return;
    setSupervisorConfig((prev) => {
      if (!prev.enabled) return prev;
      let next = prev;
      if (!prev.apiKeyId || !supervisorOpenaiKeys.some((k) => k.id === prev.apiKeyId)) {
        const def = getDefaultKey?.();
        const seeded = def && def.provider === "openai" ? def.id : supervisorOpenaiKeys[0]?.id ?? null;
        if (seeded !== prev.apiKeyId) next = { ...next, apiKeyId: seeded };
      }
      if (!prev.model || !supervisorOpenaiModels.includes(prev.model)) {
        const seededModel =
          defaultModel && supervisorOpenaiModels.includes(defaultModel)
            ? defaultModel
            : supervisorOpenaiModels[0] ?? "";
        if (seededModel !== next.model) next = { ...next, model: seededModel };
      }
      return next;
    });
  }, [
    supervisorConfig.enabled,
    supervisorOpenaiKeys,
    supervisorOpenaiModels,
    defaultModel,
    getDefaultKey,
  ]);
  const [labelsError, setLabelsError] = useState<string | null>(null);
  const [showCreateLabelModal, setShowCreateLabelModal] = useState(false);
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [createLabelError, setCreateLabelError] = useState<string | null>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#2563eb");
  const [newLabelSecondaryColor, setNewLabelSecondaryColor] =
    useState("#bfdbfe");
  const [isLabelGlobal, setIsLabelGlobal] = useState(false);
  const [labelSearchInput, setLabelSearchInput] = useState("");
  const [pendingLabelDrafts, setPendingLabelDrafts] = useState<LabelDraft[]>(
    [],
  );
  // Estados para filtros de visibilidad
  const [personaVisibility, setPersonaVisibility] = useState<
    "all" | "public" | "private"
  >("all");
  const [problemVisibility, setProblemVisibility] = useState<
    "all" | "public" | "private"
  >("all");
  const [behaviourVisibility, setBehaviourVisibility] = useState<
    "all" | "public" | "private"
  >("all");

  // Estados para filtros de process
  const [problemProcess, setProblemProcess] = useState<
    "all" | "requirements-elicitation" | "game" | "other"
  >("all");
  const [behaviourProcess, setBehaviourProcess] = useState<
    "all" | "requirements-elicitation" | "game" | "other"
  >("all");

  // Estado para controlar la visibilidad/publicación de la LEIA
  const [leiaPublish, setLeiaPublish] = useState<boolean>(true);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);

  // Estados para controlar la visibilidad de los recursos individuales
  const [behaviourPublish, setBehaviourPublish] = useState<boolean>(true);
  const [problemPublish, setProblemPublish] = useState<boolean>(true);
  const [personaPublish, setPersonaPublish] = useState<boolean>(true);

  const [editingResource, setEditingResource] = useState<{
    resource: keyof LeiaConfig | null;
    content: string | null;
    apiVersion: string;
  }>({
    resource: null,
    content: null,
    apiVersion: "v1",
  });
  const [rubricEditorDraft, setRubricEditorDraft] = useState<RubricDefinition | null>(null);
  const [rubricEditorError, setRubricEditorError] = useState<string | null>(null);

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    resource: Persona | Problem | Behaviour | null;
    resourceType: "persona" | "problem" | "behaviour" | null;
  }>({
    isOpen: false,
    resource: null,
    resourceType: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<{
    message: string;
    data?: Array<{ id: string; name: string }>;
  } | null>(null);

  // Estados para generación de problemas con IA
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateSubject, setGenerateSubject] = useState(
    DEFAULT_PROBLEM_GENERATION_SUBJECT,
  );
  const [generateDetails, setGenerateDetails] = useState(
    DEFAULT_PROBLEM_GENERATION_DETAILS,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showGenerateBehaviourModal, setShowGenerateBehaviourModal] =
    useState(false);
  const [generateBehaviourSubject, setGenerateBehaviourSubject] = useState(
    DEFAULT_BEHAVIOUR_GENERATION_SUBJECT,
  );
  const [generateBehaviourDetails, setGenerateBehaviourDetails] = useState(
    DEFAULT_BEHAVIOUR_GENERATION_DETAILS,
  );
  const [isGeneratingBehaviour, setIsGeneratingBehaviour] = useState(false);
  const [generateBehaviourError, setGenerateBehaviourError] = useState<
    string | null
  >(null);

  // Modal cuando se pulsa Finish
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [createdLeiaName, setCreatedLeiaName] = useState("");

  // Estados para opcionalmente añadir la LEIA a una Activity
  const [showAddToActivityModal, setShowAddToActivityModal] = useState(false);
  const [createdLeiaResource, setCreatedLeiaResource] =
    useState<LeiaResource | null>(null);

  const hasDraftContent = useMemo(() => {
    const hasSelectedComponent = Boolean(
      leiaConfig.persona || leiaConfig.problem || leiaConfig.behaviour,
    );
    const hasNamedResource = Object.values(customizations).some(
      (resource) => Boolean(resource?.name?.trim()),
    );

    return Boolean(
      hasSelectedComponent ||
        hasNamedResource ||
        selectedLabelIds.length ||
        pendingLabelDrafts.length ||
        rubricDraft ||
        chatState.messages.length ||
        chatState.input.trim(),
    );
  }, [chatState.input, chatState.messages.length, customizations, leiaConfig, pendingLabelDrafts.length, rubricDraft, selectedLabelIds.length]);

  const draftTitle = useMemo(
    () =>
      customizations.leia.name.trim() ||
      leiaConfig.problem?.metadata?.name ||
      leiaConfig.persona?.metadata?.name ||
      leiaConfig.behaviour?.metadata?.name ||
      "Untitled LEIA",
    [customizations.leia.name, leiaConfig.behaviour?.metadata?.name, leiaConfig.persona?.metadata?.name, leiaConfig.problem?.metadata?.name],
  );

  const buildCurrentDraftState = useCallback(
    (): CreateLeiaDraftState => ({
      currentStep,
      leiaConfig,
      leiaConfigSnapShot,
      customizations,
      leiaNameManuallyEdited,
      selectedLabelIds,
      pendingLabelDrafts,
      rubricDraft,
      chatState,
      chatModelName,
      chatApiKeyId,
      supervisorConfig,
      leiaPublish,
      behaviourPublish,
      problemPublish,
      personaPublish,
    }),
    [
      behaviourPublish,
      chatApiKeyId,
      chatModelName,
      chatState,
      currentStep,
      customizations,
      leiaConfig,
      leiaConfigSnapShot,
      leiaNameManuallyEdited,
      leiaPublish,
      pendingLabelDrafts,
      personaPublish,
      problemPublish,
      rubricDraft,
      selectedLabelIds,
      supervisorConfig,
    ],
  );

  const resetWorkspace = useCallback(() => {
    currentDraftIdRef.current = null;
    setCurrentDraftId(null);
    setCurrentStep(1);
    setLeiaConfig(createEmptyLeiaConfig());
    setLeiaConfigSnapShot(null);
    setGeneratedLeia(null);
    setCustomizations(createEmptyCustomizations());
    setLeiaNameManuallyEdited(false);
    setSelectedLabelIds([]);
    setPendingLabelDrafts([]);
    setRubricDraft(null);
    setLabelSearchInput("");
    setValidationErrors(null);
    setChatState({ messages: [], input: "" });
    setChatResetKey((previous) => previous + 1);
    setChatModelName("");
    setChatApiKeyId(null);
    setSupervisorConfig(DEFAULT_SUPERVISOR_CONFIG);
    setLeiaPublish(true);
    setBehaviourPublish(true);
    setProblemPublish(true);
    setPersonaPublish(true);
    setEditingResource({ resource: null, content: null, apiVersion: "v1" });
    setRubricEditorDraft(null);
    setRubricEditorError(null);
    setDraftError(null);
  }, []);

  const restoreDraft = useCallback((draft: LeiaDraft<CreateLeiaDraftState>) => {
    const state = draft.state as Partial<CreateLeiaDraftState>;
    const restoredConfig = state.leiaConfig ?? createEmptyLeiaConfig();
    const restoredCustomizations = state.customizations ?? createEmptyCustomizations();

    currentDraftIdRef.current = draft.id;
    setCurrentDraftId(draft.id);
    setCurrentStep(state.currentStep === 2 ? 2 : 1);
    setLeiaConfig({
      persona: restoredConfig.persona ?? null,
      problem: restoredConfig.problem ?? null,
      behaviour: restoredConfig.behaviour ?? null,
    });
    setLeiaConfigSnapShot(state.leiaConfigSnapShot ?? null);
    setGeneratedLeia(null);
    setCustomizations({
      ...restoredCustomizations,
      leia: {
        name: restoredCustomizations.leia?.name ?? "",
        version: restoredCustomizations.leia?.version ?? "1.0.0",
      },
    });
    setLeiaNameManuallyEdited(Boolean(state.leiaNameManuallyEdited));
    setSelectedLabelIds(state.selectedLabelIds ?? []);
    setPendingLabelDrafts(state.pendingLabelDrafts ?? []);
    setRubricDraft(state.rubricDraft ?? null);
    setChatState({
      messages: Array.isArray(state.chatState?.messages)
        ? state.chatState.messages
        : [],
      input: typeof state.chatState?.input === "string" ? state.chatState.input : "",
    });
    setChatResetKey((previous) => previous + 1);
    setChatModelName(state.chatModelName ?? "");
    setChatApiKeyId(state.chatApiKeyId ?? null);
    setSupervisorConfig({
      ...DEFAULT_SUPERVISOR_CONFIG,
      ...(state.supervisorConfig ?? {}),
    });
    setLeiaPublish(state.leiaPublish ?? true);
    setBehaviourPublish(state.behaviourPublish ?? true);
    setProblemPublish(state.problemPublish ?? true);
    setPersonaPublish(state.personaPublish ?? true);
    setValidationErrors(null);
    setEditingResource({ resource: null, content: null, apiVersion: "v1" });
    setRubricEditorDraft(null);
    setRubricEditorError(null);
    setDraftError(null);
    setShowDraftsDialog(false);
  }, []);

  const loadDrafts = useCallback(async () => {
    setIsDraftsLoading(true);
    setDraftError(null);
    try {
      const savedDrafts = await listLeiaDrafts<CreateLeiaDraftState>();
      setDrafts(savedDrafts);
    } catch (draftLoadError) {
      console.error("Error loading LEIA drafts:", draftLoadError);
      setDraftError("Could not load your saved drafts.");
    } finally {
      setIsDraftsLoading(false);
    }
  }, []);

  const saveCurrentDraft = useCallback(async (): Promise<LeiaDraft<CreateLeiaDraftState> | null> => {
    if (!hasDraftContent) return null;

    const previousSave = draftSavePromiseRef.current;
    setIsSavingDraft(true);
    const saveOperation = (async () => {
      if (previousSave) {
        await previousSave.catch(() => null);
      }

      setDraftError(null);
      const payload = {
        title: draftTitle,
        state: buildCurrentDraftState(),
      };
      const existingDraftId = currentDraftIdRef.current;
      const savedDraft = existingDraftId
        ? await updateLeiaDraft(existingDraftId, payload)
        : await createLeiaDraft(payload);

      currentDraftIdRef.current = savedDraft.id;
      setCurrentDraftId(savedDraft.id);
      setDrafts((previous) =>
        [savedDraft, ...previous.filter((draft) => draft.id !== savedDraft.id)].sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
        ),
      );
      return savedDraft;
    })();

    draftSavePromiseRef.current = saveOperation;
    try {
      return await saveOperation;
    } catch (draftSaveError) {
      console.error("Error saving LEIA draft:", draftSaveError);
      setDraftError("Could not save this draft. Keep editing and try again.");
      return null;
    } finally {
      if (draftSavePromiseRef.current === saveOperation) {
        draftSavePromiseRef.current = null;
        setIsSavingDraft(false);
      }
    }
  }, [buildCurrentDraftState, draftTitle, hasDraftContent]);

  const handleDeleteDraft = useCallback(
    async (draft: LeiaDraft<CreateLeiaDraftState>) => {
      try {
        setDraftError(null);
        await deleteLeiaDraft(draft.id);
        setDrafts((previous) => previous.filter((item) => item.id !== draft.id));
        if (currentDraftIdRef.current === draft.id) {
          resetWorkspace();
        }
      } catch (draftDeleteError) {
        console.error("Error deleting LEIA draft:", draftDeleteError);
        setDraftError("Could not delete this draft.");
      }
    },
    [resetWorkspace],
  );

  const handleOpenDrafts = useCallback(async () => {
    setShowDraftsDialog(true);
    if (hasDraftContent) {
      await saveCurrentDraft();
    }
    await loadDrafts();
  }, [hasDraftContent, loadDrafts, saveCurrentDraft]);

  const requestLeave = useCallback(
    (action: () => void) => {
      if (!hasDraftContent) {
        action();
        return;
      }

      pendingLeaveActionRef.current = action;
      setShowLeaveDraftDialog(true);
    },
    [hasDraftContent],
  );

  const continueEditingDraft = useCallback(() => {
    pendingLeaveActionRef.current = null;
    setShowLeaveDraftDialog(false);
  }, []);

  const saveDraftAndLeave = useCallback(async () => {
    const action = pendingLeaveActionRef.current;
    const savedDraft = await saveCurrentDraft();
    if (hasDraftContent && !savedDraft) return;

    pendingLeaveActionRef.current = null;
    setShowLeaveDraftDialog(false);
    action?.();
  }, [hasDraftContent, saveCurrentDraft]);

  useEffect(() => {
    currentDraftIdRef.current = currentDraftId;
  }, [currentDraftId]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  useEffect(() => {
    if (!hasDraftContent) return;

    const timeoutId = window.setTimeout(() => {
      void saveCurrentDraft();
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [hasDraftContent, saveCurrentDraft]);

  useEffect(() => {
    if (!hasDraftContent) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasDraftContent]);

  const startGuidedTour = useCallback((startStep: WizardStep = 1) => {
    tourRef.current?.destroy();
    setShowGenerateModal(false);
    setShowGenerateBehaviourModal(false);
    setShowCreateLabelModal(false);
    setShowFinishModal(false);
    setShowAddToActivityModal(false);
    setShowComponentSelector(false);
    setEditingResource({
      resource: null,
      content: null,
      apiVersion: "v1",
    });
    setCurrentStep(startStep);
    setTourRequested(true);
  }, []);


  useEffect(() => {
    if (!tourRequested || loading) {
      return;
    }

    let tour: ReturnType<typeof driver> | null = null;

    tour = driver({
      animate: true,
      smoothScroll: true,
      allowClose: true,
      showProgress: true,
      progressText: "Paso {{current}} de {{total}}",
      onNextClick: (_element, _step, options) => {
        const activeIndex = options.driver.getActiveIndex();
        if (activeIndex === 3) {
          setCurrentStep(2);
          window.setTimeout(() => {
            options.driver.moveNext();
          }, 150);
          return;
        }
        options.driver.moveNext();
      },
      onPrevClick: (_element, _step, options) => {
        const activeIndex = options.driver.getActiveIndex();
        if (activeIndex === 4) {
          setCurrentStep(1);
          window.setTimeout(() => {
            options.driver.movePrevious();
          }, 150);
          return;
        }
        options.driver.movePrevious();
      },
      steps: [
        {
          element: "#create-chat-panel",
          popover: {
            title: "New LEIA",
            description:
              "Describe the learning experience here. The assistant creates the problem, behaviour and persona together.",
            side: "top",
          },
        },
        {
          element: "#create-preview-panel",
          popover: {
            title: "Activity setup",
            description:
              "Configure widgets and the tools LEIA can use for the activity.",
            side: "top",
          },
        },
        {
          element: "#create-live-preview",
          popover: {
            title: "Live preview",
            description:
              "The title is suggested by the assistant and remains editable. You can also test the draft from here.",
            side: "top",
          },
        },
        {
          element: "#create-next-button",
          popover: {
            title: "Review",
            description:
              "Continue when the draft is ready to set its final details.",
            side: "top",
          },
        },
        {
          element: "#create-final-form",
          popover: {
            title: "Review",
            description:
              "Here you complete the final name and labels before clicking Finish to save the LEIA.",
            side: "bottom",
          },
        },
        {
          element: "#create-next-button",
          popover: {
            title: "Final create",
            description:
              "Here you complete the final name and labels before clicking Finish to save the LEIA, and return to the main page",
            side: "left",
            onNextClick: () => {
              tour?.destroy();
              navigate("/", {
                state: {
                  continueTour: 3,
                },
              });
            },
          },
        },
      ],
      onDestroyed: () => {
        if (tourRef.current === tour) {
          tourRef.current = null;
        }
      },
    });
      
    tourRef.current = tour;
    setTourRequested(false);
    tour.drive();
  }, [currentStep, loading, navigate, tourRequested]);

  useEffect(() => {
    return () => {
      tourRef.current?.destroy();
      tourRef.current = null;
    };
  }, []);
  
  // Cargar datos al montar el componente
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aplicar preset si viene desde navegación
  useEffect(() => {
    const navigationState = location.state as NavigationState;
    if (!navigationState) return;
    const preset = navigationState?.preset;
    if (preset) {
      setLeiaConfig({
        persona: preset.persona ?? null,
        problem: preset.problem ?? null,
        behaviour: preset.behaviour ?? null,
      });
      setLeiaConfigSnapShot(preset);
      setCurrentStep(1);
    }
    if (navigationState?.startTourFromSearch) {
      startGuidedTour(1);
      try {
        navigate(location.pathname, { replace: true, state: undefined as unknown as NavigationState });
      } catch (e) {
        console.error("Error clearing navigation state after starting tour:", e);}
    }
  }, [location.pathname, location.state, navigate, startGuidedTour]);

  // Restaurar estado cuando se vuelve del chat
  useEffect(() => {
    const navigationState = location.state as NavigationState;
    const draft = navigationState?.draft;
    if (draft) {
      restoreDraft(draft);
      navigate(location.pathname, {
        replace: true,
        state: undefined as unknown as NavigationState,
      });
      return;
    }
    const savedState = navigationState?.save;
    if (savedState) {
      // Restaurar el estado completo
      setCurrentStep(savedState.currentStep || 1);
      setLeiaConfig(
        savedState.leiaConfig || {
          persona: null,
          problem: null,
          behaviour: null,
        },
      );
      setLeiaConfigSnapShot(savedState.leiaConfigSnapShot || null);
      setCustomizations(
        savedState.customizations || createEmptyCustomizations(),
      );
      setSelectedLabelIds(
        savedState.labelIds || (savedState.labelId ? [savedState.labelId] : []),
      );
      currentDraftIdRef.current = savedState.draftId ?? null;
      setCurrentDraftId(savedState.draftId ?? null);
      setChatState(savedState.chatState ?? EMPTY_CHAT_STATE);
      setChatResetKey((previous) => previous + 1);
      setChatModelName(savedState.chatModelName ?? "");
      setChatApiKeyId(savedState.chatApiKeyId ?? null);
      setPendingLabelDrafts(savedState.pendingLabelDrafts ?? []);
      setRubricDraft(savedState.rubricDraft ?? null);
      setSupervisorConfig(savedState.supervisorConfig ?? DEFAULT_SUPERVISOR_CONFIG);
      setLeiaNameManuallyEdited(Boolean(savedState.leiaNameManuallyEdited));
      setLeiaPublish(savedState.leiaPublish ?? true);
      setBehaviourPublish(savedState.behaviourPublish ?? true);
      setProblemPublish(savedState.problemPublish ?? true);
      setPersonaPublish(savedState.personaPublish ?? true);

      // Limpiar el estado de navegación para evitar cargas repetidas
      navigate(location.pathname, {
        replace: true,
        state: { ...navigationState, save: undefined } as NavigationState,
      });
    }
  }, [location.state, navigate, location.pathname, restoreDraft]);

  useEffect(() => {
    if (
      leiaConfig.persona &&
      leiaConfig.behaviour &&
      leiaConfig.problem
    ) {
      try {
        setGenerationError(null);
        const leia = generateLeia(
          leiaConfig.persona,
          leiaConfig.behaviour,
          leiaConfig.problem,
        );
        setGeneratedLeia(leia as Leia);
      } catch (err: unknown) {
        const error =
          err instanceof Error
            ? err
            : new Error("Unknown error occurred while generating LEIA");
        setGenerationError(error);
        setGeneratedLeia(null);
      }
    }
  }, [currentStep, leiaConfig]);

  const loadPersonas = async (
    visibility: "all" | "public" | "private" = "all",
  ) => {
    try {
      const response = await api.get<Persona[]>("/api/v1/personas", {
        params: { visibility },
      });
      setPersonas(response.data);
    } catch (err) {
      console.error("Error loading personas:", err);
    }
  };

  const loadProblems = async (
    visibility: "all" | "public" | "private" = "all",
    process: "all" | "requirements-elicitation" | "game" | "other" = "all",
  ) => {
    try {
      const params: Record<string, string> = { visibility };
      if (process !== "all") {
        params.process = process;
      }
      const response = await api.get<Problem[]>("/api/v1/problems", {
        params,
      });
      setProblems(response.data);
    } catch (err) {
      console.error("Error loading problems:", err);
    }
  };

  const loadBehaviours = async (
    visibility: "all" | "public" | "private" = "all",
    process: "all" | "requirements-elicitation" | "game" | "other" = "all",
  ) => {
    try {
      const params: Record<string, string> = { visibility, process };
      const response = await api.get<Behaviour[]>("/api/v1/behaviours", {
        params,
      });
      setBehaviours(response.data);
    } catch (err) {
      console.error("Error loading behaviours:", err);
    }
  };

  const loadLabels = async () => {
    try {
      setLabelsError(null);
      const response = await api.get<Label[]>("/api/v1/labels");
      setLabels(response.data || []);
    } catch (err) {
      console.error("Error loading labels:", err);
      setLabelsError("Failed to load labels");
    }
  };

  const getLabelIdentifier = (label: Label) => label.id || label._id || null;

  const getPendingLabelId = (labelName: string) =>
    `${PENDING_LABEL_PREFIX}${labelName.trim().toLowerCase()}`;

  const handleCreateLabel = async () => {
    const trimmedName = newLabelName.trim();
    if (!trimmedName) {
      setCreateLabelError("Label name is required");
      return;
    }

    try {
      setCreateLabelError(null);
      const pendingLabelId = getPendingLabelId(trimmedName);
      const nextDraft: LabelDraft = {
        id: pendingLabelId,
        name: trimmedName,
        color: newLabelColor,
        secundaryColor: newLabelSecondaryColor,
        isGlobal: currentUser?.role === "admin" ? isLabelGlobal : false,
      };

      setPendingLabelDrafts((prev) => {
        const withoutDuplicatedName = prev.filter(
          (draft) =>
            draft.name.trim().toLowerCase() !== trimmedName.toLowerCase(),
        );

        return [...withoutDuplicatedName, nextDraft];
      });
      setSelectedLabelIds((prev) =>
        prev.includes(pendingLabelId) ? prev : [...prev, pendingLabelId],
      );
      setShowCreateLabelModal(false);
      setLabelSearchInput("");
      setNewLabelName("");
      setNewLabelColor("#2563eb");
      setNewLabelSecondaryColor("#bfdbfe");
      setIsLabelGlobal(false);
    } catch (err) {
      console.error("Error creating label:", err);
      setCreateLabelError("Failed to prepare label");
    }
  };
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Hacer las peticiones en paralelo con los filtros de visibilidad y process actuales
      await Promise.all([
        loadPersonas(personaVisibility),
        loadProblems(problemVisibility, problemProcess),
        loadBehaviours(behaviourVisibility, behaviourProcess),
        loadLabels(),
      ]);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load data from API");
    } finally {
      setLoading(false);
    }
  };

  // Funciones para manejar cambios de visibilidad
  const handlePersonaVisibilityChange = (
    visibility: "all" | "private" | "public",
  ) => {
    setPersonaVisibility(visibility);
    loadPersonas(visibility); // Solo recargar personas
  };

  const handleProblemVisibilityChange = (
    visibility: "all" | "private" | "public",
  ) => {
    setProblemVisibility(visibility);
    loadProblems(visibility, problemProcess); // Solo recargar problemas
  };

  const handleBehaviourVisibilityChange = (
    visibility: "all" | "private" | "public",
  ) => {
    setBehaviourVisibility(visibility);
    loadBehaviours(visibility, behaviourProcess); // Solo recargar behaviours
  };

  // Funciones para manejar cambios de process
  const handleProblemProcessChange = (
    process: "all" | "requirements-elicitation" | "game" | "other",
  ) => {
    setProblemProcess(process);
    loadProblems(problemVisibility, process); // Solo recargar problems
  };

  const handleBehaviourProcessChange = (
    process: "all" | "requirements-elicitation" | "game" | "other",
  ) => {
    setBehaviourProcess(process);
    loadBehaviours(behaviourVisibility, process); // Solo recargar behaviours
  };

  const handleSelect = (
    type: keyof LeiaConfig,
    item: Persona | Behaviour | Problem,
  ) => {
    if (type === "problem") setRubricDraft(null);
    setLeiaConfig((prev) => ({
      ...prev,
      [type]: item,
    }));
  };

  // Funciones de eliminación de recursos
  const handleDeleteResource = (
    resource: Persona | Problem | Behaviour,
    resourceType: "persona" | "problem" | "behaviour",
  ) => {
    setDeleteModal({
      isOpen: true,
      resource,
      resourceType,
    });
    setDeleteError(null);
  };

  const confirmDeleteResource = async (
    resource: Persona | Problem | Behaviour,
    resourceType: "persona" | "problem" | "behaviour",
  ) => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const endpoint = `${resourceType}s`; // personas, problems, behaviours
      await api.delete(`/api/v1/${endpoint}/${resource.id}`);

      // Refrescar la lista correspondiente
      switch (resourceType) {
        case "persona":
          await loadPersonas(personaVisibility);
          // Si el recurso eliminado estaba seleccionado, deseleccionarlo
          if (leiaConfig.persona?.id === resource.id) {
            setLeiaConfig((prev) => ({ ...prev, persona: null }));
          }
          break;
        case "problem":
          await loadProblems(problemVisibility, problemProcess);
          if (leiaConfig.problem?.id === resource.id) {
            setLeiaConfig((prev) => ({ ...prev, problem: null }));
          }
          break;
        case "behaviour":
          await loadBehaviours(behaviourVisibility, behaviourProcess);
          if (leiaConfig.behaviour?.id === resource.id) {
            setLeiaConfig((prev) => ({ ...prev, behaviour: null }));
          }
          break;
      }

      // Cerrar modal
      setDeleteModal({
        isOpen: false,
        resource: null,
        resourceType: null,
      });
    } catch (error: unknown) {
      const err = {
        message: "An error occurred while deleting the resource",
        data: [] as Array<{ id: string; name: string }>,
      };

      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: {
            status?: number;
            data?: {
              message?: string;
              data?: Array<{ id: string; name: string }>;
            };
          };
        };

        console.log(axiosError?.response?.data);

        if (axiosError.response?.status === 403) {
          err.message = "You don't have permission to delete this resource";
        } else if (axiosError.response?.status === 404) {
          err.message = "Resource not found";
        } else if (axiosError.response?.status === 400) {
          err.message = `Cannot delete resource: it is being used in ${
            axiosError.response?.data?.data?.length
          } LEIA${axiosError.response?.data?.data?.length === 1 ? "" : "s"}.`;
          err.data = axiosError.response?.data?.data || [];
        } else if (axiosError.response?.data?.message) {
          err.message = axiosError.response.data.message;
        }
      }

      setDeleteError(err);
    } finally {
      setIsDeleting(false);
    }
  };

const closeActivityReplicationModal = useCallback(() => {
      setShowActivityReplicationModal(false);
      setNameActivityReplication("");
      navigate("/leias");
    }, [navigate]);
    const handleQuickReplication = useCallback(async (leia?: LeiaResource|null) => {
  
    if (!leia) {
      toast.error("No LEIA selected", {
        position: "bottom-right",
        autoClose: 3000,
      });
      return;
    }
  
    try {
      const leiaName = nameActivityReplication || leia.metadata.name || "";
      const activityReplication = await api.post(`/api/v1/experiments/leia/`, {
        leiaName,
        leiaId: leia.id,
      });
      toast.success("LEIA replicated successfully", {
        position: "bottom-right",
        autoClose: 3000,
      });
  
      const workbenchBaseUrl = import.meta.env.VITE_WORKBENCH_URL;
      const replicationUrl = `${workbenchBaseUrl.replace(
      /\/$/, "" )}/login?redirect=/replications/${encodeURIComponent(
      activityReplication.data.replication.id)}`;
      closeActivityReplicationModal();
      const newWindow = window.open(replicationUrl);
  
      if (!newWindow) {
        toast.error("Popup blocked or could not open replication", {
          position: "bottom-right",
          autoClose: 2000,
        });
      }
    } catch (error) {
      const axiosError = error as {
        response?: {
          status?: number;
          data?: {
            error?: string;
            data?: Array<{ id: string; name: string }>;
          };
        };
      };
  
      if (axiosError.response?.status === 409) {
        toast.info(axiosError.response?.data?.error, {
          position: "bottom-right",
          autoClose: 3000,
        });
  
        if (!nameActivityReplication) {
          setNameActivityReplication(leia.metadata.name + "-v2");
        }
        setShowActivityReplicationModal(true);
        return;
      }
  
      toast.error("Error replicating LEIA. Please try again.", {
        position: "bottom-right",
        autoClose: 3000,
      });
    }
  }, [closeActivityReplicationModal, nameActivityReplication]);

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      resource: null,
      resourceType: null,
    });
    setDeleteError(null);
  };

const openGenerateProblemModal = () => {
    if (!leiaConfig.problem) return;
    setGenerateSubject(DEFAULT_PROBLEM_GENERATION_SUBJECT);
    setGenerateDetails(DEFAULT_PROBLEM_GENERATION_DETAILS);
    setGenerateError(null);
    setShowGenerateModal(true);
  };

  const closeGenerateProblemModal = () => {
    setShowGenerateModal(false);
    setGenerateSubject(DEFAULT_PROBLEM_GENERATION_SUBJECT);
    setGenerateDetails(DEFAULT_PROBLEM_GENERATION_DETAILS);
    setGenerateError(null);
  };

  const openGenerateBehaviourModal = () => {
    if (!leiaConfig.behaviour) {
      return;
    }
    setGenerateBehaviourSubject(DEFAULT_BEHAVIOUR_GENERATION_SUBJECT);
    setGenerateBehaviourDetails(DEFAULT_BEHAVIOUR_GENERATION_DETAILS);
    setGenerateBehaviourError(null);
    setShowGenerateBehaviourModal(true);
  };

  const closeGenerateBehaviourModal = () => {
    setShowGenerateBehaviourModal(false);
    setGenerateBehaviourSubject(DEFAULT_BEHAVIOUR_GENERATION_SUBJECT);
    setGenerateBehaviourDetails(DEFAULT_BEHAVIOUR_GENERATION_DETAILS);
    setGenerateBehaviourError(null);
  };
 

  // Función para generar un problema similar con IA
  const handleGenerateProblem = async () => {
    if (!generateSubject.trim() || !leiaConfig.problem) {
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);

    try {
      const response = await api.post("/api/v1/runner/problems/generate", {
        subject: generateSubject.trim(),
        additionalDetails: generateDetails.trim() || undefined,
        exampleProblem: leiaConfig.problem,
      });

      // Crear el nuevo problema con los datos generados y marcarlo como editado
      const generatedProblem: Problem = {
        ...response.data,
        id: `generated-${Date.now()}`,
        edited: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPublished: false,
        user: currentUser!,
      };

      setRubricDraft(null);
      // Añadir a la lista de problems
      setProblems((prev) => [generatedProblem, ...prev]);

      // Seleccionar el problema generado
      setLeiaConfig((prev) => {
        const process = copyProcess(generatedProblem.spec?.process);

        return {
          ...prev,
          problem: generatedProblem,
          behaviour:
            prev.behaviour?.edited
              ? ({
                  ...prev.behaviour,
                  spec: { ...prev.behaviour.spec, process },
                  updatedAt: new Date().toISOString(),
                } as unknown as Behaviour)
              : prev.behaviour,
        };
      });

      // Cerrar modal y limpiar
      closeGenerateProblemModal();
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string; error?: string } };
      };
      setGenerateError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to generate problem",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Función para generar un behaviour similar con IA
  const handleGenerateBehaviour = async () => {
    if (!generateBehaviourSubject.trim() || !leiaConfig.behaviour) {
      return;
    }

    setIsGeneratingBehaviour(true);
    setGenerateBehaviourError(null);

    try {
      const response = await api.post("/api/v1/runner/behaviours/generate", {
        subject: generateBehaviourSubject.trim(),
        additionalDetails: generateBehaviourDetails.trim() || undefined,
        exampleBehaviour: leiaConfig.behaviour,
      });

      const generatedBehaviourSpec = (response.data?.spec ||
        response.data) as Behaviour["spec"];

      const process = copyProcess(
        leiaConfig.problem?.spec?.process ?? generatedBehaviourSpec.process,
      );
      const generatedBehaviour: Behaviour = {
        apiVersion: leiaConfig.behaviour.apiVersion || "v1",
        metadata: {
          name: generateBehaviourSubject
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-"),
          version: "1.0.0",
        },
        spec: { ...generatedBehaviourSpec, process } as unknown as Behaviour["spec"],
        id: `generated-behaviour-${Date.now()}`,
        edited: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPublished: false,
        user: currentUser!,
      };

      setBehaviours((prev) => [generatedBehaviour, ...prev]);
      setLeiaConfig((prev) => ({
        ...prev,
        behaviour: generatedBehaviour,
      }));

      closeGenerateBehaviourModal();
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string; error?: string } };
      };
      setGenerateBehaviourError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to generate behaviour",
      );
    } finally {
      setIsGeneratingBehaviour(false);
    }
  };

  const cleanObjectForPreview = (
    obj: unknown,
    resource?: keyof LeiaConfig,
  ): unknown => {
    if (!obj || typeof obj !== "object" || obj === null) return obj;
    const cleaned = structuredClone(obj) as Record<string, unknown>;
    delete cleaned.createdAt;
    delete cleaned.updatedAt;
    delete cleaned.id;
    delete cleaned.edited;
    delete cleaned.user;
    delete cleaned.isPublished;
    if (currentStep === 1) {
      delete cleaned.metadata;
    }
    const selectedResource = resource ? leiaConfig[resource] : null;
    const customName = resource ? customizations[resource]?.name?.trim() : "";
    if (
      currentStep === 2 &&
      resource &&
      customName &&
      (selectedResource?.edited || customName !== selectedResource?.metadata?.name)
    ) {
      const metadata = cleaned.metadata as Record<string, unknown>;
      if (metadata) {
        metadata.name = customName;
        metadata.version = "1.0.0";
      }
    }
    return cleaned;
  };

  const resolveTestRunnerConfiguration = useCallback(() => {
    // Use the model and provider already selected for the design assistant.
    // A manual-only LEIA can still fall back to the user's default key. Widgets
    // require a tool-capable provider, so that restriction remains automatic.
    const problemWidgets = leiaConfig.problem?.spec?.widgets;
    const requiresTools = Array.isArray(problemWidgets) && problemWidgets.length > 0;
    const toolCapableProviders = Object.entries(providerProviderModuleMap || {})
      .filter(([, moduleName]) => moduleName === "openai-responses")
      .map(([provider]) => provider);
    const candidateKeys = requiresTools
      ? apiKeys.filter((key) => toolCapableProviders.includes(key.provider))
      : apiKeys;
    const activeAssistantKey = chatApiKeyId
      ? candidateKeys.find((key) => key.id === chatApiKeyId) ?? null
      : null;
    const defaultKey = getDefaultKey();
    const key = activeAssistantKey ?? (
      defaultKey && candidateKeys.some((candidate) => candidate.id === defaultKey.id)
        ? defaultKey
        : candidateKeys[0] ?? null
    );
    if (!key) return null;

    const providerModels = apiKeyProvidersMapped[key.provider] || [];
    const modelName = [chatModelName, key.model, defaultModel, ...providerModels].find(
      (model): model is string => Boolean(model && providerModels.includes(model)),
    );

    return modelName ? { modelName, apiKeyId: key.id } : null;
  }, [
    apiKeyProvidersMapped,
    apiKeys,
    chatApiKeyId,
    chatModelName,
    defaultModel,
    getDefaultKey,
    leiaConfig.problem,
    providerProviderModuleMap,
  ]);

  const handleTestLeia = async () => {
    if (!generatedLeia) {
      console.error("No generated LEIA available");
      return;
    }

    const runnerConfiguration = resolveTestRunnerConfiguration();
    if (!runnerConfiguration) {
      console.error("No valid model and API key available for testing");
      return;
    }

    try {
      setTestingLeia(true);
      const savedDraft = await saveCurrentDraft();
      const testLeia: Leia = rubricDraft
        ? {
            ...generatedLeia,
            spec: {
              ...generatedLeia.spec,
              rubric: rubricDraft,
            },
          }
        : generatedLeia;
      const response = await api.post("/api/v1/runner/initialize", {
        spec: testLeia.spec,
        runnerConfiguration,
      });
      const { sessionId } = response.data;
      navigate(`/chat/${sessionId}`, {
        state: {
          leia: testLeia,
          personaAvatar: generatedLeia.spec.persona.spec.avatar || "",
          personaName:
            generatedLeia.spec.persona.spec.fullName ||
            generatedLeia.spec.persona.metadata.name,
          save: {
            currentStep,
            leiaConfig,
            leiaConfigSnapShot,
            labelIds: selectedLabelIds,
            labelId: selectedLabelIds[0] || null,
            customizations,
            draftId: savedDraft?.id ?? currentDraftIdRef.current,
            chatState,
            chatModelName,
            chatApiKeyId,
            pendingLabelDrafts,
            rubricDraft,
            supervisorConfig,
            leiaNameManuallyEdited,
            leiaPublish,
            behaviourPublish,
            problemPublish,
            personaPublish,
          },
          problemDescription: generatedLeia.spec.problem.spec.description,
        },
      });
    } catch (error) {
      console.error("Error initializing LEIA:", error);
      setError("Failed to initialize LEIA session");
    } finally {
      setTestingLeia(false);
    }
  };

  const handleNextStep = async () => {
    if (currentStep === 2 && isStep2Complete) {
      const errors = {} as Record<string, string>;

      for (const [key, value] of Object.entries(customizations)) {
        if (value) {
          const isComponent = key === "persona" || key === "problem" || key === "behaviour";
          const selectedResource = isComponent
            ? leiaConfig[key as keyof LeiaConfig]
            : null;
          const name = value.name?.trim() || selectedResource?.metadata?.name?.trim() || "";
          if (!name) {
            errors[key] = "Name is required";
            continue;
          }
          const needsNewResource =
            key === "leia" ||
            Boolean(selectedResource?.edited) ||
            name !== selectedResource?.metadata?.name;

          if (!needsNewResource) continue;

          try {
            const response = await api.get(
              `/api/v1/${key}s/exists/${name}`,
            );
            if (response.data.exists) {
              errors[key] = "Name already exists";
            }
          } catch {
            errors[key] = "Failed to check name existence";
          }
        }
      }

      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }

      let finalLabelIds = [...selectedLabelIds];
      if (pendingLabelDrafts.length > 0) {
        try {
          setCreatingLabel(true);
          const createdLabels = await Promise.all(
            pendingLabelDrafts.map(async (draft) => {
              const response = await api.post<Label>("/api/v1/labels", {
                name: draft.name,
                color: draft.color,
                secundaryColor: draft.secundaryColor,
                isGlobal:
                  currentUser?.role === "admin" ? draft.isGlobal : false,
                user: currentUser?.id,
              });

              return {
                pendingId: draft.id,
                createdId: getLabelIdentifier(response.data),
              };
            }),
          );

          const pendingToCreated = new Map(
            createdLabels
              .filter((entry) => Boolean(entry.createdId))
              .map((entry) => [entry.pendingId, entry.createdId as string]),
          );

          finalLabelIds = finalLabelIds
            .map((labelId) => pendingToCreated.get(labelId) || labelId)
            .filter(Boolean);

          setSelectedLabelIds(finalLabelIds);
          setPendingLabelDrafts([]);
          await loadLabels();
        } catch (error) {
          console.error("Error creating label on finish:", error);
          setError("Failed to create label");
          return;
        } finally {
          setCreatingLabel(false);
        }
      }

      const leia: {
        apiVersion: string;
        metadata: {
          name: string;
          version: string;
          labels?: string[];
        };
        spec: Record<string, unknown>;
      } = {
        apiVersion: "v1",
        metadata: {
          name: customizations.leia.name,
          version: "1.0.0",
          labels: finalLabelIds.length > 0 ? finalLabelIds : undefined,
        },
        spec: {},
      };

      for (const [key, value] of Object.entries(leiaConfig)) {
        const resourceKey = key as keyof LeiaConfig;
        const customization = customizations[resourceKey];
        const resourceName = customization?.name?.trim() || value?.metadata?.name || "";
        const isRenamed = Boolean(
          resourceName && resourceName !== value?.metadata?.name,
        );

        if (value && (value.edited || isRenamed)) {
          const newResource: {
            apiVersion: string;
            metadata: { name: string; version?: string };
            spec: Persona["spec"] | Problem["spec"] | Behaviour["spec"];
            id?: string;
            createdAt?: string;
            updatedAt?: string;
            user?: unknown;
            isPublished?: boolean;
            edited?: boolean;
          } = structuredClone(value);
          delete newResource.edited;
          delete newResource.id;
          delete newResource.createdAt;
          delete newResource.updatedAt;
          delete newResource.user;
          delete newResource.metadata.version;
          delete newResource.isPublished;
          if (resourceName) {
            newResource.metadata.name = resourceName;
          }
          try {
            // Agregar query parameter de visibilidad para cada recurso si el usuario es admin
            let publishParam = "";
            if (currentUser?.role === "admin") {
              const resourcePublishState = leiaPublish
                ? leiaPublish
                : key === "behaviour"
                  ? behaviourPublish
                  : key === "problem"
                    ? problemPublish
                    : key === "persona"
                      ? personaPublish
                      : false;
              publishParam = `?publish=${resourcePublishState}`;
            }
            const response = await api.post(
              `/api/v1/${key}s${publishParam}`,
              newResource,
            );
            leia.spec[key] = response.data.id;
            leiaConfig[key as keyof LeiaConfig] = response.data;
            if (leiaConfigSnapShot) {
              leiaConfigSnapShot[key as keyof LeiaConfig] = response.data;
            }
            delete customizations[key as keyof LeiaConfig];
          } catch (error) {
            console.error("Error creating resource:", error);
            setError(`Failed to create ${key} resource`);
            return;
          }
        } else {
          leia.spec[key] = leiaConfig[key as keyof LeiaConfig]?.id;
        }
      }
      if (rubricDraft) {
        if (rubricDraft._id) {
          leia.spec.rubric = rubricDraft._id;
        } else {
          try {
            const response = await api.post<Rubric>("/api/v1/rubrics", rubricDraft);
            setRubricDraft(response.data);
            leia.spec.rubric = response.data._id;
          } catch (error) {
            console.error("Error creating rubric:", error);
            setError("Failed to create rubric resource");
            return;
          }
        }
      }
      // Attach the per-LEIA supervisor config (only when enabled). The
      // supervisor runs on OpenAI with its own key — stored together with the
      // owning user id so the workbench can resolve it at runtime (BYOK).
      if (supervisorConfig.enabled) {
        leia.spec.supervisorConfig = {
          enabled: true,
          instructions: supervisorConfig.instructions.trim(),
          sensitivity: supervisorConfig.sensitivity,
          cadence: supervisorConfig.cadence,
          everyN: supervisorConfig.everyN,
          intervene: supervisorConfig.intervene,
          interveneInstructions: supervisorConfig.intervene
            ? supervisorConfig.interveneInstructions.trim()
            : "",
          apiKeyId: supervisorConfig.apiKeyId || undefined,
          apiKeyRequesterId: supervisorConfig.apiKeyId ? currentUser?.id : undefined,
          model: supervisorConfig.model || undefined,
        };
      }
      try {
        // Construir la URL con el query parameter publish
        const publishParam =
          currentUser?.role === "admin" ? `?publish=${leiaPublish}` : "";
        const response = await api.post(`/api/v1/leias${publishParam}`, leia);
        console.log("LEIA created successfully:", response.data);
        setCreatedLeiaName(
          response.data?.metadata?.name || customizations.leia.name || "LEIA",
        );
        setCreatedLeiaResource(response.data as LeiaResource);
        setShowFinishModal(true);
      } catch (error) {
        console.error("Error creating LEIA:", error);
        setError("Failed to create LEIA");
      }
    }
    if (currentStep === 1 && isStep1Complete) {
      setLeiaConfigSnapShot({
        persona: leiaConfig.persona?.edited
          ? leiaConfigSnapShot?.persona || null
          : leiaConfig.persona,
        problem: leiaConfig.problem?.edited
          ? leiaConfigSnapShot?.problem || null
          : leiaConfig.problem,
        behaviour: leiaConfig.behaviour?.edited
          ? leiaConfigSnapShot?.behaviour || null
          : leiaConfig.behaviour,
      });
      setCustomizations((previous) => ({
          persona: {
            name: previous.persona?.name?.trim() || leiaConfig.persona?.metadata?.name || "",
            version: previous.persona?.version || "1.0.0",
          },
          problem: {
            name: previous.problem?.name?.trim() || leiaConfig.problem?.metadata?.name || "",
            version: previous.problem?.version || "1.0.0",
          },
          behaviour: {
            name: previous.behaviour?.name?.trim() || leiaConfig.behaviour?.metadata?.name || "",
            version: previous.behaviour?.version || "1.0.0",
          },
          leia: { name: previous.leia.name, version: "1.0.0" },
        }));
      setCurrentStep(2);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as WizardStep);
    }
  };

  const isStep1Complete = Boolean(
    leiaConfig.persona && leiaConfig.problem && leiaConfig.behaviour && !generationError && generatedLeia,
  );
  const isStep2Complete = (() => {
    const customizationsValid =
      Boolean(customizations.leia.name?.trim()) &&
      (["persona", "problem", "behaviour"] as const).every((resource) =>
        Boolean(customizations[resource]?.name?.trim() || leiaConfig[resource]?.metadata?.name?.trim()),
      );

    const noValidationErrors = validationErrors
      ? Object.values(validationErrors).every((error) => !error)
      : true;

    return customizationsValid && noValidationErrors;
  })();

  const renderStepIndicator = () => {
    const steps = ["New LEIA", "Review"];

    return (
      <Stack
        id="create-step-indicator"
        direction="row"
        alignItems="center"
        justifyContent="center"
        spacing={1}
      >
        {steps.map((label, index) => {
          const complete = currentStep >= index + 1;
          return (
            <React.Fragment key={label}>
              <Stack direction="row" alignItems="center" spacing={0.65}>
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "50%",
                    bgcolor: complete ? "primary.main" : "surfaces.subtle",
                    color: complete ? "primary.contrastText" : "text.secondary",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {index + 1}
                </Box>
                <Typography
                  variant="caption"
                  fontWeight={600}
                  sx={{
                    color: complete ? "primary.main" : "text.secondary",
                    display: { xs: "none", lg: "block" },
                  }}
                >
                  {label}
                </Typography>
              </Stack>
              {index < steps.length - 1 && (
                <Box
                  sx={{
                    width: { xs: 14, lg: 22 },
                    height: 1,
                    bgcolor: currentStep > index + 1 ? "primary.light" : "divider",
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </Stack>
    );
  };

  const applyChatProblem = useCallback(
    (spec: ProblemSpec, name?: string) => {
      // Keep the current rubric while the assistant applies the other LEIA
      // resources. A complete assistant turn may apply the problem first and
      // the rubric afterwards; clearing here made the rubric disappear again
      // when the assistant revisited the problem in a later turn.
      const incomingSpec = spec as unknown as Record<string, unknown>;
      const process = copyProcess(incomingSpec.process);
      setLeiaConfig((prev) => ({
        ...prev,
        problem: {
          apiVersion: "v1",
          metadata: {
            name: name || prev.problem?.metadata?.name || "ai-generated-problem",
            version: "1.0.0",
          },
          spec: {
            ...incomingSpec,
            process,
            extends: incomingSpec.extends ?? {},
            overrides: incomingSpec.overrides ?? {},
            constrainedTo: incomingSpec.constrainedTo ?? {},
          },
          id: "generated-" + Date.now(),
          edited: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPublished: false,
          user: currentUser!,
        } as unknown as Problem,
        // A previous behaviour may be tied to a different exercise even if
        // its broad process tag matches. The assistant must now apply a new
        // behaviour specifically written for this problem.
        behaviour: null,
      }));
    },
    [currentUser],
  );

  const handleProblemWidgetsChange = useCallback((widgets: ProblemWidget[]) => {
    setLeiaConfig((previous) => {
      if (!previous.problem) return previous;

      return {
        ...previous,
        problem: {
          ...previous.problem,
          spec: {
            ...previous.problem.spec,
            widgets: widgets.length > 0 ? widgets : undefined,
          },
          edited: true,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }, []);

  const applyChatBehaviour = useCallback(
    (spec: Record<string, unknown>, name?: string) => {
      setLeiaConfig((prev) => {
        const process = copyProcess(prev.problem?.spec?.process ?? spec.process);

        return {
          ...prev,
          behaviour: {
            apiVersion: "v1",
            metadata: {
              name: name || prev.behaviour?.metadata?.name || "ai-generated-behaviour",
              version: "1.0.0",
            },
            spec: { ...spec, process },
            id: "generated-" + Date.now(),
            edited: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPublished: false,
            user: currentUser!,
          } as unknown as Behaviour,
        };
      });
    },
    [currentUser],
  );

  const applyChatPersona = useCallback(
    (spec: Record<string, unknown>, name?: string) => {
      setLeiaConfig((prev) => ({
        ...prev,
        persona: {
          apiVersion: "v1",
          metadata: {
            name: name || prev.persona?.metadata?.name || "ai-generated-persona",
            version: "1.0.0",
          },
          spec: { ...spec },
          id: "generated-" + Date.now(),
          edited: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPublished: false,
          user: currentUser!,
        } as unknown as Persona,
      }));
    },
    [currentUser],
  );

  const applyChatRubric = useCallback(
    (spec: { markdown: string }, name: string) => {
      setRubricDraft({
        apiVersion: "v1",
        metadata: { name },
        spec: { markdown: spec.markdown },
      });
    },
    [],
  );

  const openRubricEditor = useCallback(() => {
    if (!rubricDraft) return;
    setRubricEditorDraft(structuredClone({
      apiVersion: rubricDraft.apiVersion,
      metadata: rubricDraft.metadata,
      spec: rubricDraft.spec,
    }));
    setRubricEditorError(null);
  }, [rubricDraft]);

  const closeRubricEditor = useCallback(() => {
    setRubricEditorDraft(null);
    setRubricEditorError(null);
  }, []);

  const saveRubricEditor = useCallback(() => {
    if (!rubricEditorDraft) return;
    const name = rubricEditorDraft.metadata.name.trim();
    if (!name) {
      setRubricEditorError("Rubric name is required.");
      return;
    }

    const parsed = parseRubricMarkdown(rubricEditorDraft.spec.markdown);
    if (parsed.error) {
      setRubricEditorError(parsed.error);
      return;
    }

    setRubricDraft({
      apiVersion: "v1",
      metadata: { name },
      spec: { markdown: rubricEditorDraft.spec.markdown.trim() },
    });
    closeRubricEditor();
  }, [closeRubricEditor, rubricEditorDraft]);

  const handleUseExistingPersona = useCallback(
    (id: string): { ok: boolean; name?: string } => {
      const persona = personas.find((item) => item.id === id);
      if (!persona) return { ok: false };
      setLeiaConfig((previous) => ({ ...previous, persona }));
      return { ok: true, name: persona.metadata?.name };
    },
    [personas],
  );

  const handleAssistantLeiaName = useCallback(
    (name: string) => {
      const suggestion = name.trim();
      if (!suggestion || leiaNameManuallyEdited) return;
      setCustomizations((previous) => ({
        ...previous,
        leia: { ...previous.leia, name: suggestion },
      }));
    },
    [leiaNameManuallyEdited],
  );

  const handleLeiaNameChange = useCallback((name: string) => {
    setLeiaNameManuallyEdited(true);
    setCustomizations((previous) => ({
      ...previous,
      leia: { ...previous.leia, name },
    }));
  }, []);

  useEffect(() => {
    if (leiaNameManuallyEdited || customizations.leia.name.trim()) return;

    const sourceName =
      leiaConfig.problem?.metadata?.name ||
      leiaConfig.persona?.metadata?.name ||
      "";
    if (!sourceName || sourceName.startsWith("ai-generated-")) return;

    const readableName = sourceName
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    setCustomizations((previous) => ({
      ...previous,
      leia: { ...previous.leia, name: readableName },
    }));
  }, [customizations.leia.name, leiaConfig.persona?.metadata?.name, leiaConfig.problem?.metadata?.name, leiaNameManuallyEdited]);

  const MuiVisibilitySelector: React.FC<{
    value: "all" | "private" | "public";
    onChange: (value: "all" | "private" | "public") => void;
  }> = ({ value, onChange }) => (
    <TextField
      select
      label="Visibility"
      size="small"
      value={value}
      onChange={(event) => onChange(event.target.value as "all" | "private" | "public")}
      sx={{ minWidth: 104 }}
    >
      <MenuItem value="all">All</MenuItem>
      <MenuItem value="private">Private</MenuItem>
      <MenuItem value="public">Public</MenuItem>
    </TextField>
  );

  const MuiProcessSelector: React.FC<{
    value: "all" | "requirements-elicitation" | "game" | "other";
    onChange: (value: "all" | "requirements-elicitation" | "game" | "other") => void;
  }> = ({ value, onChange }) => (
    <TextField
      select
      label="Process"
      size="small"
      value={value}
      onChange={(event) =>
        onChange(
          event.target.value as "all" | "requirements-elicitation" | "game" | "other",
        )
      }
      sx={{ minWidth: 132 }}
    >
      <MenuItem value="all">All</MenuItem>
      <MenuItem value="requirements-elicitation">Req. elicitation</MenuItem>
      <MenuItem value="game">Game</MenuItem>
      <MenuItem value="other">Other</MenuItem>
    </TextField>
  );

  const renderComponentSelector = () => (
    <Stack spacing={3}>
      <Box sx={{ textAlign: "center" }}>
        <Typography variant="h5" gutterBottom>Select components</Typography>
        <Typography color="text.secondary">
          Choose a persona, problem, and behaviour for this LEIA.
        </Typography>
      </Box>
      <Box
        id="create-selection-grid"
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "repeat(3, minmax(0, 1fr))" },
          minHeight: { lg: 550 },
        }}
      >
        <Box sx={{ minHeight: 440 }}>
          <SelectionColumn
            title="Behaviour"
            items={behaviours}
            selectedItem={leiaConfig.behaviour}
            onSelect={(item) => handleSelect("behaviour", item)}
            placeholder="Search behaviours..."
            onDelete={handleDeleteResource}
            rightHeaderElement={
              <Stack direction="row" spacing={0.75} alignItems="flex-start">
                <Tooltip title="Generate similar behaviour with AI">
                  <span>
                    <IconButton
                      color="secondary"
                      size="small"
                      onClick={openGenerateBehaviourModal}
                      disabled={!leiaConfig.behaviour}
                    >
                      <AutoAwesomeIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <MuiVisibilitySelector value={behaviourVisibility} onChange={handleBehaviourVisibilityChange} />
                <MuiProcessSelector value={behaviourProcess} onChange={handleBehaviourProcessChange} />
              </Stack>
            }
          />
        </Box>
        <Box sx={{ minHeight: 440 }}>
          <SelectionColumn
            title="Problem"
            items={problems}
            selectedItem={leiaConfig.problem}
            onSelect={(item) => handleSelect("problem", item)}
            placeholder="Search problems..."
            onDelete={handleDeleteResource}
            rightHeaderElement={
              <Stack direction="row" spacing={0.75} alignItems="flex-start">
                <Tooltip title="Generate similar problem with AI">
                  <span>
                    <IconButton
                      color="secondary"
                      size="small"
                      onClick={openGenerateProblemModal}
                      disabled={!leiaConfig.problem}
                    >
                      <AutoAwesomeIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <MuiVisibilitySelector value={problemVisibility} onChange={handleProblemVisibilityChange} />
                <MuiProcessSelector value={problemProcess} onChange={handleProblemProcessChange} />
              </Stack>
            }
          />
        </Box>
        <Box sx={{ minHeight: 440 }}>
          <SelectionColumn
            title="Persona"
            items={personas}
            selectedItem={leiaConfig.persona}
            onSelect={(item) => handleSelect("persona", item)}
            placeholder="Search personas..."
            onDelete={handleDeleteResource}
            rightHeaderElement={
              <MuiVisibilitySelector value={personaVisibility} onChange={handlePersonaVisibilityChange} />
            }
          />
        </Box>
      </Box>
    </Stack>
  );

  const renderNewStep = () => {
    const canTest = Boolean(resolveTestRunnerConfiguration()) && !chatOptionsLoading;

    const editResource = (resource: "persona" | "problem" | "behaviour") => {
      const current = leiaConfig[resource];
      if (!current) return;
      setEditingResource({
        resource,
        content: resource === "behaviour" ? JSON.stringify(current.spec, null, 2) : null,
        apiVersion: current.apiVersion || "v1",
      });
    };
    const handleOverviewComponentClick = (
      resource: "persona" | "problem" | "behaviour" | "rubric",
    ) => {
      if (resource === "rubric") {
        openRubricEditor();
        return;
      }
      editResource(resource);
    };
    const testAction = !generatedLeia ? (
      <Button fullWidth variant="contained" disabled startIcon={<PlayArrowIcon />}>
        Test LEIA
      </Button>
    ) : testingLeia ? (
      <Button fullWidth variant="contained" disabled startIcon={<CircularProgress size={16} color="inherit" />}>
        Starting test...
      </Button>
    ) : (
      <Button
        id="try-button"
        fullWidth
        color="success"
        variant="contained"
        startIcon={<PlayArrowIcon />}
        onClick={() => void handleTestLeia()}
        disabled={!canTest}
        title={canTest ? undefined : "Configure a valid model and API key in the Design menu first."}
      >
        Test LEIA
      </Button>
    );

    return (
      <Box sx={{ minWidth: 0 }}>
        {generationError && <Alert severity="error" sx={{ mb: 1.5 }}>{generationError.message}</Alert>}

        <Box
          id="create-workspace"
          sx={{
            display: "grid",
            gridTemplateAreas: { xs: '"chat" "components" "preview"', lg: '"components chat preview"' },
            gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "272px minmax(0, 1fr) 370px" },
            gridTemplateRows: { lg: "minmax(0, 1fr)" },
            gap: { xs: 2, lg: 1.5 },
            alignItems: "stretch",
            minHeight: { lg: 620 },
            height: { lg: "calc(100dvh - 248px)" },
          }}
        >
          <Paper
            id="create-preview-panel"
            variant="outlined"
            sx={{
              gridArea: "components",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              overflow: "hidden",
              bgcolor: "background.paper",
            }}
          >
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
              <Typography variant="subtitle2">Activity setup</Typography>
              <Typography variant="caption" color="text.secondary">
                Configure widgets and tool access. Click a component in the preview to edit it.
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, flex: 1, minHeight: 0, overflowY: "auto" }}>
              {leiaConfig.problem ? (
                <ProblemWidgetsEditor
                  widgets={leiaConfig.problem.spec.widgets ?? []}
                  onChange={handleProblemWidgetsChange}
                />
              ) : (
                <Stack spacing={1} sx={{ pt: 1 }}>
                  <Typography variant="body2" fontWeight={600}>
                    Widgets appear with the problem
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Ask the assistant to create a problem first, then configure the widgets and tool access here.
                  </Typography>
                </Stack>
              )}
            </Box>
          </Paper>

          <Box
            id="create-chat-panel"
            sx={{
              gridArea: "chat",
              minWidth: 0,
              minHeight: { xs: 560, lg: 0 },
              height: { lg: "100%" },
            }}
          >
            <ProblemChatPanel
              currentProblem={leiaConfig.problem}
              currentBehaviour={leiaConfig.behaviour}
              currentPersona={leiaConfig.persona}
              currentRubric={rubricDraft}
              personas={personas}
              onApplyProblem={applyChatProblem}
              onApplyBehaviour={applyChatBehaviour}
              onApplyPersona={applyChatPersona}
              onApplyRubric={applyChatRubric}
              onUsePersona={handleUseExistingPersona}
              onSetLeiaName={handleAssistantLeiaName}
              modelName={chatModelName}
              apiKeyId={chatApiKeyId}
              key={chatResetKey}
              initialChatState={chatState}
              onChatStateChange={setChatState}
            />
          </Box>

          <Box
            id="create-live-preview"
            sx={{
              gridArea: "preview",
              minWidth: 0,
              minHeight: { xs: 560, lg: 0 },
              height: { lg: "100%" },
            }}
          >
            <LeiaLivePreview
              leia={generatedLeia}
              rubric={rubricDraft}
              title={customizations.leia.name}
              onTitleChange={handleLeiaNameChange}
              titleSuggested={Boolean(customizations.leia.name) && !leiaNameManuallyEdited}
              testAction={testAction}
              onComponentClick={handleOverviewComponentClick}
            />
          </Box>
        </Box>

        {editingResource.resource && (
          <Dialog
            open
            onClose={() => setEditingResource({ resource: null, content: null, apiVersion: "v1" })}
            fullWidth
            maxWidth="lg"
          >
            <DialogContent dividers sx={{ p: { xs: 1, md: 2 }, bgcolor: "background.default" }}>
              <ResourceEditor
                resourceType={editingResource.resource}
                initialData={leiaConfig[editingResource.resource] || undefined}
                apiVersion={editingResource.apiVersion}
                onSave={(data, apiVersion, resourceName) => {
                  const resource = editingResource.resource;
                  if (!resource) return;
                  if (resource === "problem") setRubricDraft(null);

                  setLeiaConfig((previous) => {
                    const current = previous[resource];
                    if (!current) return previous;

                    return {
                      ...previous,
                      [resource]: {
                        ...current,
                        metadata: {
                          ...current.metadata,
                          name: resourceName,
                        },
                        spec: data,
                        apiVersion,
                        edited: true,
                      },
                    };
                  });
                  setCustomizations((previous) => ({
                    ...previous,
                    [resource]: {
                      ...(previous[resource] || { name: "", version: "1.0.0" }),
                      name: resourceName,
                    },
                  }));
                  setEditingResource({ resource: null, content: null, apiVersion: "v1" });
                }}
                onCancel={() => setEditingResource({ resource: null, content: null, apiVersion: "v1" })}
              />
            </DialogContent>
          </Dialog>
        )}

        <Dialog
          open={Boolean(rubricEditorDraft)}
          onClose={closeRubricEditor}
          fullWidth
          maxWidth="xl"
        >
          <DialogTitle>Edit rubric</DialogTitle>
          <DialogContent dividers sx={{ p: { xs: 1.5, md: 2.5 }, bgcolor: "background.default" }}>
            {rubricEditorDraft && (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" },
                  gap: 2,
                }}
              >
                <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
                  <Stack spacing={2}>
                    <TextField
                      label="Rubric name"
                      value={rubricEditorDraft.metadata.name}
                      onChange={(event) => {
                        setRubricEditorError(null);
                        setRubricEditorDraft((current) => current ? ({
                          ...current,
                          metadata: { name: event.target.value },
                        }) : current);
                      }}
                      fullWidth
                    />
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Markdown</Typography>
                      <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
                        <Editor
                          height="480px"
                          language="markdown"
                          theme="vs-light"
                          value={rubricEditorDraft.spec.markdown}
                          onChange={(value) => {
                            setRubricEditorError(null);
                            setRubricEditorDraft((current) => current ? ({
                              ...current,
                              spec: { markdown: value ?? "" },
                            }) : current);
                          }}
                          options={{
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            fontSize: 13,
                            lineNumbers: "on",
                            automaticLayout: true,
                            wordWrap: "on",
                          }}
                        />
                      </Box>
                    </Box>
                    {rubricEditorError && <Alert severity="error">{rubricEditorError}</Alert>}
                  </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, minWidth: 0, maxHeight: 590, overflow: "auto" }}>
                  <Typography variant="subtitle2" sx={{ mb: 2 }}>Preview</Typography>
                  <RubricPreview markdown={rubricEditorDraft.spec.markdown} />
                </Paper>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button color="inherit" onClick={closeRubricEditor}>Cancel</Button>
            <Button variant="contained" onClick={saveRubricEditor}>Save rubric</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  };

  const renderReviewStep = () => {
    const labelOptions: LabelOption[] = [
      ...labels.map((label) => ({
        value: getLabelIdentifier(label) || label.name,
        label: label.name,
        color: label.color,
        secundaryColor: label.secundaryColor,
        isGlobal: Boolean(label.isGlobal),
      })),
      ...pendingLabelDrafts.map((draft) => ({
        value: draft.id,
        label: draft.name,
        color: draft.color,
        secundaryColor: draft.secundaryColor,
        isGlobal: draft.isGlobal,
      })),
    ];
    const selectedOptions = labelOptions.filter((option) => selectedLabelIds.includes(option.value));
    const updateName = (
      resource: "leia" | "persona" | "problem" | "behaviour",
      value: string,
    ) => {
      if (resource === "leia") setLeiaNameManuallyEdited(true);
      setCustomizations((previous) => ({
        ...previous,
        [resource]: { ...(previous[resource] || { name: "", version: "1.0.0" }), name: value },
      }));
      if (validationErrors?.[resource]) {
        setValidationErrors((previous) => (previous ? { ...previous, [resource]: undefined } : previous));
      }
    };

    const resourceName = (
      resource: "persona" | "problem" | "behaviour",
      title: string,
      published: boolean,
      setPublished: React.Dispatch<React.SetStateAction<boolean>>,
    ) => {
      const selectedResource = leiaConfig[resource];
      if (!selectedResource) return null;
      const name = customizations[resource]?.name?.trim() || selectedResource.metadata.name;

      return (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle2">{title}</Typography>
            <TextField
              label={title + " name"}
              value={name}
              onChange={(event) => updateName(resource, event.target.value)}
              placeholder={"Enter " + title.toLowerCase() + " name"}
              error={Boolean(validationErrors?.[resource])}
              helperText={validationErrors?.[resource]}
              fullWidth
            />
            {currentUser?.role === "admin" && (
              <TextField
                select
                label="Visibility"
                value={published ? "public" : "private"}
                onChange={(event) => setPublished(event.target.value === "public")}
                disabled={leiaPublish}
                fullWidth
                helperText={
                  leiaPublish
                    ? "Locked to public because the LEIA is public."
                    : published ? "Visible to all users." : "Private to you."
                }
              >
                <MenuItem value="public">Public</MenuItem>
                <MenuItem value="private">Private</MenuItem>
              </TextField>
            )}
          </Stack>
        </Paper>
      );
    };

    const preview = (
      title: string,
      resource: Persona | Problem | Behaviour | undefined,
      type: "persona" | "problem" | "behaviour",
    ) => (
      <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "surfaces.subtle" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Typography variant="subtitle2">{title}</Typography>
          <Typography variant="caption" color="text.secondary">JSON</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }} noWrap>
          {customizations[type]?.name || resource?.metadata.name || "Not selected"}
        </Typography>
        {resource ? (
          <Accordion
            disableGutters
            elevation={0}
            sx={{ border: 1, borderColor: "divider", borderRadius: "6px !important", overflow: "hidden", bgcolor: "background.paper" }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon fontSize="small" />}
              sx={{ minHeight: 38, "& .MuiAccordionSummary-content": { my: 0.75 } }}
            >
              <Typography variant="caption" fontWeight={700}>Code preview</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0, borderTop: 1, borderColor: "divider" }}>
              <Editor
                height="132px"
                language="json"
                theme="vs-light"
                value={JSON.stringify(cleanObjectForPreview(resource, type), null, 2)}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 11,
                  lineNumbers: "off",
                  glyphMargin: false,
                  folding: false,
                  lineDecorationsWidth: 0,
                  lineNumbersMinChars: 0,
                  automaticLayout: true,
                  contextmenu: false,
                  wordWrap: "on",
                }}
              />
            </AccordionDetails>
          </Accordion>
        ) : (
          <Typography variant="body2" color="text.secondary">Not selected</Typography>
        )}
      </Paper>
    );

    return (
      <Stack spacing={3}>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h5" gutterBottom>Review your LEIA</Typography>
          <Typography color="text.secondary">Confirm the names and inspect each component before you finish.</Typography>
        </Box>
        <Paper id="create-final-form" variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle2">LEIA</Typography>
            <TextField
              label="New LEIA name"
              value={customizations.leia.name}
              onChange={(event) => updateName("leia", event.target.value)}
              placeholder="Enter LEIA name"
              error={Boolean(validationErrors?.leia)}
              helperText={validationErrors?.leia}
              fullWidth
            />
            <Autocomplete
              multiple
              freeSolo
              options={labelOptions}
              value={selectedOptions}
              inputValue={labelSearchInput}
              disabled={loading || Boolean(labelsError)}
              onInputChange={(_, value) => setLabelSearchInput(value)}
              onChange={(_, nextValues) => {
                const values = nextValues as Array<LabelOption | string>;
                const newLabel = values.find((value) => typeof value === "string");
                if (typeof newLabel === "string") {
                  const candidate = newLabel.trim();
                  if (
                    candidate &&
                    !labelOptions.some((option) => option.label.toLowerCase() === candidate.toLowerCase())
                  ) {
                    setNewLabelName(candidate);
                    setCreateLabelError(null);
                    setShowCreateLabelModal(true);
                  }
                  return;
                }
                const options = values as LabelOption[];
                const ids = options.map((option) => option.value);
                setSelectedLabelIds(ids);
                setPendingLabelDrafts((previous) => previous.filter((draft) => ids.includes(draft.id)));
                setLabelSearchInput("");
              }}
              getOptionLabel={(option) => typeof option === "string" ? option : option.label}
              isOptionEqualToValue={(option, value) =>
                typeof value !== "string" && option.value === value.value
              }
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: option.color, mr: 1 }} />
                  <Typography variant="body2">{option.label}</Typography>
                  {option.isGlobal && <Chip label="Global" size="small" sx={{ ml: "auto" }} />}
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Labels"
                  placeholder="Select or create labels..."
                  error={Boolean(labelsError)}
                  helperText={
                    labelsError ||
                    (pendingLabelDrafts.length
                      ? String(pendingLabelDrafts.length) + " new label(s) will be created on Finish."
                      : "Type a new label and press Enter to create it.")
                  }
                />
              )}
            />
            {labelsError && <Button size="small" sx={{ alignSelf: "flex-start" }} onClick={loadLabels}>Retry labels</Button>}
            {currentUser?.role === "admin" && (
              <TextField
                select
                label="LEIA visibility"
                value={leiaPublish ? "public" : "private"}
                onChange={(event) => {
                  const isPublic = event.target.value === "public";
                  setLeiaPublish(isPublic);
                  if (isPublic) {
                    setBehaviourPublish(true);
                    setProblemPublish(true);
                    setPersonaPublish(true);
                  }
                }}
                fullWidth
              >
                <MenuItem value="public">Public</MenuItem>
                <MenuItem value="private">Private</MenuItem>
              </TextField>
            )}
            {currentUser?.role === "admin" && leiaPublish && (
              <Alert severity="info" icon={<InfoOutlinedIcon />}>
                This LEIA and its selected resources will be public.
              </Alert>
            )}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
              <Box>
                <Typography variant="subtitle2">Supervisor (AI background monitor)</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  A private background AI can flag behaviours during text and Luke audio sessions.
                </Typography>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={supervisorConfig.enabled}
                    onChange={(event) =>
                      setSupervisorConfig((previous) => ({
                        ...previous,
                        enabled: event.target.checked,
                      }))
                    }
                  />
                }
                label="Enabled"
                sx={{ m: 0 }}
              />
            </Stack>
            {supervisorConfig.enabled && (
              <Stack spacing={2}>
                {supervisorOpenaiKeys.length > 0 ? (
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                    <TextField
                      select
                      label="OpenAI API key"
                      value={supervisorConfig.apiKeyId ?? ""}
                      onChange={(event) =>
                        setSupervisorConfig((previous) => ({
                          ...previous,
                          apiKeyId: event.target.value || null,
                        }))
                      }
                      fullWidth
                    >
                      <MenuItem value="">-- API key --</MenuItem>
                      {supervisorOpenaiKeys.map((key) => <MenuItem key={key.id} value={key.id}>{key.description}</MenuItem>)}
                    </TextField>
                    <TextField
                      select
                      label="Model"
                      value={supervisorConfig.model}
                      onChange={(event) =>
                        setSupervisorConfig((previous) => ({ ...previous, model: event.target.value }))
                      }
                      fullWidth
                    >
                      <MenuItem value="">-- model --</MenuItem>
                      {supervisorOpenaiModels.map((model) => <MenuItem key={model} value={model}>{model}</MenuItem>)}
                    </TextField>
                  </Box>
                ) : (
                  <Alert severity="warning">
                    No OpenAI API key is available. <Link to="/administration/api-keys">Create one</Link> to enable the supervisor.
                  </Alert>
                )}
                <TextField
                  label="What should the supervisor watch for?"
                  value={supervisorConfig.instructions}
                  onChange={(event) =>
                    setSupervisorConfig((previous) => ({
                      ...previous,
                      instructions: event.target.value,
                    }))
                  }
                  multiline
                  rows={4}
                  placeholder="Describe the patterns or behaviours to flag."
                  fullWidth
                />
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
                  <TextField
                    select
                    label="Sensitivity"
                    value={supervisorConfig.sensitivity}
                    onChange={(event) =>
                      setSupervisorConfig((previous) => ({
                        ...previous,
                        sensitivity: event.target.value as "low" | "medium" | "high",
                      }))
                    }
                    fullWidth
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </TextField>
                  <TextField
                    select
                    label="When it runs"
                    value={supervisorConfig.cadence}
                    onChange={(event) =>
                      setSupervisorConfig((previous) => ({
                        ...previous,
                        cadence: event.target.value as "everyN" | "onFinish",
                      }))
                    }
                    fullWidth
                  >
                    <MenuItem value="everyN">Every N messages</MenuItem>
                    <MenuItem value="onFinish">Only at the end</MenuItem>
                  </TextField>
                  {supervisorConfig.cadence === "everyN" && (
                    <TextField
                      type="number"
                      label="Every N messages"
                      inputProps={{ min: 1, max: 50 }}
                      value={supervisorConfig.everyN}
                      onChange={(event) =>
                        setSupervisorConfig((previous) => ({
                          ...previous,
                          everyN: Math.max(1, Math.min(50, Number(event.target.value) || 1)),
                        }))
                      }
                      fullWidth
                    />
                  )}
                </Box>
                <Box sx={{ pt: 2, borderTop: 1, borderColor: "divider" }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={supervisorConfig.intervene}
                        onChange={(event) =>
                          setSupervisorConfig((previous) => ({
                            ...previous,
                            intervene: event.target.checked,
                          }))
                        }
                      />
                    }
                    label="Let the supervisor nudge the student"
                    sx={{ m: 0 }}
                  />
                  {supervisorConfig.intervene && (
                    <TextField
                      value={supervisorConfig.interveneInstructions}
                      onChange={(event) =>
                        setSupervisorConfig((previous) => ({
                          ...previous,
                          interveneInstructions: event.target.value,
                        }))
                      }
                      placeholder="Describe the coaching response."
                      multiline
                      rows={2}
                      fullWidth
                      sx={{ mt: 1 }}
                    />
                  )}
                </Box>
              </Stack>
            )}
          </Stack>
        </Paper>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(3, minmax(0, 1fr))",
            },
            gap: 2,
          }}
        >
          {resourceName("behaviour", "Behaviour", behaviourPublish, setBehaviourPublish)}
          {resourceName("problem", "Problem", problemPublish, setProblemPublish)}
          {resourceName("persona", "Persona", personaPublish, setPersonaPublish)}
        </Box>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle2">Component code</Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(3, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            {preview("Behaviour", generatedLeia?.spec.behaviour, "behaviour")}
            {preview("Problem", generatedLeia?.spec.problem, "problem")}
            {preview("Persona", generatedLeia?.spec.persona, "persona")}
          </Box>
        </Paper>

        {rubricDraft && (
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle2">Rubric</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
              {rubricDraft.metadata.name}
            </Typography>
            <RubricPreview markdown={rubricDraft.spec.markdown} />
          </Paper>
        )}
      </Stack>
    );
  };

  const designBackButton = (
    <Button
      size="small"
      color="inherit"
      variant="outlined"
      startIcon={<ArrowBackOutlinedIcon />}
      onClick={() => requestLeave(() => navigate("/"))}
      sx={{ flexShrink: 0, textTransform: "none" }}
    >
      Go back
    </Button>
  );

  if (loading) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
        <Header title="Design" description="Create your own LEIAs and test them!" leadingContent={designBackButton} />
        <Container maxWidth="lg" sx={{ flex: 1, display: "flex", alignItems: "center", py: 4 }}>
          <Paper variant="outlined" sx={{ width: "100%", p: 5 }}>
            <Stack alignItems="center" spacing={2}>
              <CircularProgress />
              <Typography variant="h6">Loading resources...</Typography>
              <Typography color="text.secondary">Loading personas, problems, and behaviours from the API...</Typography>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
        <Header title="Design" description="Create your own LEIAs and test them!" leadingContent={designBackButton} />
        <Container maxWidth="lg" sx={{ flex: 1, display: "flex", alignItems: "center", py: 4 }}>
          <Paper variant="outlined" sx={{ width: "100%", p: 5 }}>
            <Stack alignItems="center" spacing={2}>
              <ErrorOutlineIcon color="error" sx={{ fontSize: 48 }} />
              <Typography variant="h6">Error Loading Data</Typography>
              <Typography color="text.secondary">{error}</Typography>
              <Button variant="contained" startIcon={<RefreshIcon />} onClick={loadData}>Try Again</Button>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  const cannotContinue =
    (currentStep === 1 && !isStep1Complete) ||
    (currentStep === 2 && !isStep2Complete);
  const status =
    currentStep === 1
      ? isStep1Complete ? "LEIA draft ready for review" : "Create or select a persona, problem, and behaviour"
      : isStep2Complete ? "Ready to finish" : "Complete the required names before finishing";
  const designHeaderRightContent = (
    <Stack direction="row" alignItems="center" spacing={{ xs: 1, lg: 1.5 }}>
      <Button
        size="small"
        variant="outlined"
        onClick={() => void handleOpenDrafts()}
        sx={{ textTransform: "none", whiteSpace: "nowrap" }}
      >
        {isSavingDraft
          ? "Saving draft..."
          : `Drafts${drafts.length ? ` (${drafts.length})` : ""}`}
      </Button>
      {currentStep === 1 && (
        <>
        <IconButton
          id="create-assistant-settings"
          aria-label="Design menu"
          aria-controls={chatSettingsAnchor ? "create-assistant-settings-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={Boolean(chatSettingsAnchor)}
          onClick={(event) => setChatSettingsAnchor(event.currentTarget)}
          size="small"
          sx={{ border: 1, borderColor: "divider", borderRadius: 1.5 }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu
          id="create-assistant-settings-menu"
          anchorEl={chatSettingsAnchor}
          open={Boolean(chatSettingsAnchor)}
          onClose={() => setChatSettingsAnchor(null)}
          MenuListProps={{ "aria-labelledby": "create-assistant-settings" }}
          slotProps={{ paper: { sx: { minWidth: 320, mt: 1, border: 1, borderColor: "divider" } } }}
        >
          <Box sx={{ p: 1.5 }}>
            <Typography variant="subtitle2">Assistant settings</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, mb: 1.5 }}>
              Choose the model and key used to create this LEIA.
            </Typography>
                {chatOpenaiKeys.length > 0 ? (
                  <Stack spacing={1.25}>
                    <TextField
                      select
                      label="Model"
                      size="small"
                      value={chatModelName}
                      onChange={(event) => setChatModelName(event.target.value)}
                      disabled={chatOptionsLoading}
                      fullWidth
                    >
                      <MenuItem value="">
                        {chatOptionsLoading ? "Loading…" : "-- model --"}
                      </MenuItem>
                      {chatOpenaiModels.map((model) => (
                        <MenuItem key={model} value={model}>{model}</MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label="API Key"
                      size="small"
                      value={chatApiKeyId ?? ""}
                      onChange={(event) => handleChatApiKeyChange(event.target.value || null)}
                      disabled={chatOptionsLoading}
                      fullWidth
                    >
                      <MenuItem value="">
                        {chatOptionsLoading ? "Loading…" : "-- key --"}
                      </MenuItem>
                      {chatOpenaiKeys.map((key) => (
                        <MenuItem key={key.id} value={key.id}>{key.description}</MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    fullWidth
                    disabled={chatOptionsLoading}
                    onClick={() => {
                      setChatSettingsAnchor(null);
                      navigate("/administration/api-keys");
                    }}
                  >
                    {chatOptionsLoading ? "Loading keys" : "Add OpenAI key"}
                  </Button>
                )}
            {currentUser?.role === "admin" && (
              <Button
                size="small"
                variant="outlined"
                fullWidth
                sx={{ mt: 1.25 }}
                onClick={() => {
                  setChatSettingsAnchor(null);
                  setShowComponentSelector(true);
                }}
              >
                Components
              </Button>
            )}
          </Box>
        </Menu>
        </>
      )}
      {renderStepIndicator()}
    </Stack>
  );

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <Header
        title="Design"
        description="Create your own LEIAs and test them!"
        dropdownTour={tourRequested}
        leadingContent={designBackButton}
        rightContent={designHeaderRightContent}
      />
      <ToastContainer />
      {showActivityReplicationModal && (
              <Dialog open onClose={closeActivityReplicationModal} maxWidth="sm" fullWidth>
                <DialogTitle>Replicate activity</DialogTitle>
                <DialogContent>
                  <Box sx={{ pt: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      Choose a name for the new activity and its Workbench replication.
                    </Typography>
                    <TextField
                      autoFocus
                      label="Activity and Replication name"
                      value={nameActivityReplication}
                      onChange={(event) => setNameActivityReplication(event.target.value)}
                      placeholder="Activity replication name"
                      fullWidth
                    />
                  </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                  <Button color="inherit" onClick={closeActivityReplicationModal}>Cancel</Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => void handleQuickReplication(createdLeiaResource)}
                    disabled={!nameActivityReplication.trim()}
                  >
                    Replicate
                  </Button>
                </DialogActions>
              </Dialog>
            )}
      <Container maxWidth={false} sx={{ flex: 1, py: { xs: 2, md: 4 }, px: { xs: 2, md: 3 } }}>
        <Box
          sx={{
            p: currentStep === 1 ? 0 : { xs: 2, md: 3 },
            overflow: currentStep === 1 ? "visible" : "hidden",
          }}
        >
          <Box sx={{ display: currentStep === 1 ? "block" : "none" }}>
            {renderNewStep()}
          </Box>
          <Box sx={{ display: currentStep === 2 ? "block" : "none" }}>
            {renderReviewStep()}
          </Box>
        </Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mt: 3 }}>
          <Button
            id="create-previous-button"
            color="inherit"
            variant="contained"
            onClick={handlePrevStep}
            disabled={currentStep === 1}
          >
            Previous
          </Button>
          <Typography variant="body2" color="text.secondary" align="center">{status}</Typography>
          <Button id="create-next-button" variant="contained" onClick={handleNextStep} disabled={cannotContinue}>
            {currentStep === 2 ? "Finish LEIA" : "Review LEIA"}
          </Button>
        </Stack>
      </Container>

      <Dialog
        open={showComponentSelector}
        onClose={() => setShowComponentSelector(false)}
        fullWidth
        maxWidth="xl"
        PaperProps={{ sx: { height: { xs: "94vh", md: "88vh" } } }}
      >
        <DialogTitle>Select components</DialogTitle>
        <DialogContent dividers sx={{ py: 3 }}>
          {renderComponentSelector()}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={() => setShowComponentSelector(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setShowComponentSelector(false)} disabled={!isStep1Complete}>
            Use selected components
          </Button>
        </DialogActions>
      </Dialog>

      <DeleteResourceModal
        isOpen={deleteModal.isOpen}
        resource={deleteModal.resource}
        resourceType={deleteModal.resourceType}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteResource}
        isDeleting={isDeleting}
        error={deleteError}
      />

      <Dialog
        open={showDraftsDialog}
        onClose={() => setShowDraftsDialog(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>LEIA drafts</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.25}>
            {draftError && <Alert severity="error">{draftError}</Alert>}
            {isDraftsLoading ? (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">Loading drafts...</Typography>
              </Stack>
            ) : drafts.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                Your saved LEIA drafts will appear here.
              </Typography>
            ) : (
              drafts.map((draft) => (
                <Paper key={draft.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack spacing={1.25}>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap>{draft.title || "Untitled LEIA"}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Updated {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(draft.updatedAt))}
                        </Typography>
                      </Box>
                      {currentDraftId === draft.id && <Chip label="Current" size="small" color="primary" />}
                    </Stack>
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                      <Button size="small" color="error" onClick={() => void handleDeleteDraft(draft)} disabled={isSavingDraft}>
                        Delete
                      </Button>
                      <Button size="small" variant="contained" onClick={() => restoreDraft(draft)} disabled={isSavingDraft}>
                        Continue
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={() => setShowDraftsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showLeaveDraftDialog}
        onClose={continueEditingDraft}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Keep this LEIA draft?</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Typography color="text.secondary">
              Continue editing here, or save your work as a draft and come back to it later.
            </Typography>
            {draftError && <Alert severity="error">{draftError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={continueEditingDraft} disabled={isSavingDraft}>
            Continue editing
          </Button>
          <Button variant="contained" onClick={() => void saveDraftAndLeave()} disabled={isSavingDraft}>
            {isSavingDraft ? "Saving draft..." : "Save draft and leave"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showCreateLabelModal}
        onClose={() => {
          setShowCreateLabelModal(false);
          setCreateLabelError(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Create New Label</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField label="Name" value={newLabelName} onChange={(event) => setNewLabelName(event.target.value)} fullWidth />
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <TextField
                label="Background colour"
                type="color"
                value={newLabelColor}
                onChange={(event) => setNewLabelColor(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
              <TextField
                label="Text colour"
                type="color"
                value={newLabelSecondaryColor}
                onChange={(event) => setNewLabelSecondaryColor(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
            </Box>
            <Chip
              label={newLabelName || "Preview"}
              sx={{ alignSelf: "center", bgcolor: newLabelColor, color: newLabelSecondaryColor }}
            />
            {currentUser?.role === "admin" && (
              <FormControlLabel
                control={<Switch checked={isLabelGlobal} onChange={(event) => setIsLabelGlobal(event.target.checked)} />}
                label="Make this label global"
                sx={{ m: 0 }}
              />
            )}
            {createLabelError && <Alert severity="error">{createLabelError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={() => setShowCreateLabelModal(false)}>Cancel</Button>
          <Button
            color="success"
            variant="contained"
            onClick={handleCreateLabel}
            disabled={creatingLabel}
            startIcon={creatingLabel ? <CircularProgress color="inherit" size={16} /> : undefined}
          >
            Save label for Finish
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showGenerateBehaviourModal} onClose={closeGenerateBehaviourModal} fullWidth maxWidth="sm">
        <DialogTitle>Generate Similar Behaviour</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Using "{leiaConfig.behaviour?.metadata.name}" as the template.
            </Typography>
            <TextField
              label="New Behaviour Subject"
              value={generateBehaviourSubject}
              onChange={(event) => setGenerateBehaviourSubject(event.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Additional Details"
              value={generateBehaviourDetails}
              onChange={(event) => setGenerateBehaviourDetails(event.target.value)}
              multiline
              rows={3}
              fullWidth
            />
            {generateBehaviourError && <Alert severity="error">{generateBehaviourError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={closeGenerateBehaviourModal}>Cancel</Button>
          <Button
            color="secondary"
            variant="contained"
            onClick={handleGenerateBehaviour}
            disabled={!generateBehaviourSubject.trim() || isGeneratingBehaviour}
            startIcon={isGeneratingBehaviour ? <CircularProgress color="inherit" size={16} /> : <AutoAwesomeIcon />}
          >
            {isGeneratingBehaviour ? "Generating..." : "Generate"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showGenerateModal} onClose={closeGenerateProblemModal} fullWidth maxWidth="sm">
        <DialogTitle>Generate Similar Problem</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info">The generator adapts relevant settings from the selected problem template.</Alert>
            <TextField
              label="New Subject"
              value={generateSubject}
              onChange={(event) => setGenerateSubject(event.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Additional Details"
              value={generateDetails}
              onChange={(event) => setGenerateDetails(event.target.value)}
              multiline
              rows={3}
              fullWidth
            />
            {generateError && <Alert severity="error">{generateError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={closeGenerateProblemModal}>Cancel</Button>
          <Button
            color="secondary"
            variant="contained"
            onClick={handleGenerateProblem}
            disabled={!generateSubject.trim() || isGenerating}
            startIcon={isGenerating ? <CircularProgress color="inherit" size={16} /> : <AutoAwesomeIcon />}
          >
            {isGenerating ? "Generating..." : "Generate"}
          </Button>
        </DialogActions>
      </Dialog>

      {(currentUser?.role === "admin" || currentUser?.role === "advanced") && (
        <AddLeiaToAnActivity
          isOpen={showAddToActivityModal}
          selectedLeia={createdLeiaResource}
          onClose={() => {
            setShowAddToActivityModal(false);
            navigate("/leias");
          }}
          onSuccess={() => {
            setShowAddToActivityModal(false);
            navigate("/users/me/activities");
          }}
        />
      )}

      <Dialog open={showFinishModal} onClose={() => setShowFinishModal(false)} fullWidth maxWidth="sm">
        <DialogTitle>LEIA created successfully</DialogTitle>
        <DialogContent dividers>
          {(user?.role === "admin" || user?.role === "advanced") && (
            <Typography color="text.secondary">
              "{createdLeiaName}" was created successfully. Now you can create the activity and its replication directly, add it to an existing activity or return to the home page.
            </Typography>
          )}
          {user?.role === "instructor" && (
            <Typography color="text.secondary">
              "{createdLeiaName}" was created successfully.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            color="inherit"
            onClick={() => {
              setShowFinishModal(false);
              navigate("/leias");
            }}
          >
            Go to LEIAs
          </Button>
          {(user?.role === "admin" || user?.role === "advanced") && (
          <Button
            variant="contained"
            onClick={() => {
              setShowFinishModal(false);
              setShowAddToActivityModal(true);
            }}
          >
            Add to Activity
          </Button>
          )}
          {(user?.role === "admin" || user?.role === "advanced") && (
          <Button
            variant="contained"
            color="secondary"
            onClick={() => void handleQuickReplication(createdLeiaResource)}
              >
              Quick Replication
          </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};
