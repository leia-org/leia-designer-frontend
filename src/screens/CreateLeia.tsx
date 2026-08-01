import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Editor } from "@monaco-editor/react";
import { type InputActionMeta, type MultiValue } from "react-select";
import CreatableSelect from "react-select/creatable";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import {
  LightBulbIcon,
  CpuChipIcon,
  InformationCircleIcon,
  SparklesIcon,
  ChevronDownIcon,
  EllipsisHorizontalIcon,
} from "@heroicons/react/24/outline";
import { SelectionColumn } from "../components/shared/SelectionColumn";
import { Header } from "../components/shared/Header";
import { ResourceEditor } from "../components/ResourceEditor";
import { DeleteResourceModal } from "../components/DeleteResourceModal";
import { AddLeiaToAnActivity } from "../components/AddLeiaToAnActivity";
import { LeiaTryDropdown } from "../components/LeiaTryDropdown";
import { ProblemChatPanel } from "../components/ProblemChatPanel";
import { Avatar } from "../components/shared/Avatar";
import { useAuth } from "../context";
import type {
  Persona,
  Behaviour,
  Problem,
  ProblemSpec,
  Leia as LeiaResource,
} from "../models/Leia";
import { useApiKeys } from "../hooks/useApiKeys";
import { useProviders } from "../hooks/useProviders";
import api from "../lib/axios";
import { generateLeia } from "../lib/leia";
import { buildOriginalAvatarPath } from "../lib/avatar";

import { ActivityReplicationModal } from "../components/ActivityReplicationModal";
import { toast, ToastContainer } from "react-toastify";
interface Label {
  id?: string;
  _id?: string;
  name: string;
  color: string;
  secundaryColor: string;
  isGlobal?: boolean;
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
  };
}

interface NavigationState {
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
    customizations: {
      persona?: { name: string; version?: string };
      problem?: { name: string; version?: string };
      behaviour?: { name: string; version?: string };
      leia: { name: string; version?: string };
    };
  };
}

type WizardStep = 1 | 2 | 3;
type AvatarEntityPathSegment = "leias" | "personas" | "problems";
type InfographicVariant = "infographic" | "infographicSolution";

interface AvatarGenerationTarget {
  entity: AvatarEntityPathSegment;
  id: string;
}

interface IllustrationsConfig {
  apiKeyId: string | null;
  generateLeiaAvatar: boolean;
  generatePersonaAvatar: boolean;
  generateProblemAvatar: boolean;
  generateInfographic: boolean;
  generateInfographicSolution: boolean;
}

const DEFAULT_PROBLEM_GENERATION_SUBJECT = "Sistema de biblioteca";
const DEFAULT_PROBLEM_GENERATION_DETAILS =
  "Incluye catalogo, prestamos, reservas, cuentas de socios y notificaciones de vencimiento.";

const DEFAULT_BEHAVIOUR_GENERATION_SUBJECT = "Bibliotecario experto";
const DEFAULT_BEHAVIOUR_GENERATION_DETAILS =
  "Mantén un tono profesional y colaborativo. Debe guiar al estudiante con preguntas de aclaración sobre catálogo, préstamos, reservas y multas.";

const PENDING_LABEL_PREFIX = "__pending_label__";

export const CreateLeia: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const tourRef = useRef<ReturnType<typeof driver> | null>(null);
  const {
    apiKeys,
    isLoading: isApiKeysLoading,
    error: apiKeysError,
    getDefaultKey,
  } = useApiKeys();
  const {
    apiKeyProvidersMapped,
    providerProviderModuleMap,
    defaultModel,
    isLoading: isProvidersLoading,
    error: providersError,
  } = useProviders();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [tourRequested, setTourRequested] = useState(false);
  const [leiaConfig, setLeiaConfig] = useState<LeiaConfig>({
    persona: null,
    problem: null,
    behaviour: null,
  });
  const [leiaConfigSnapShot, setLeiaConfigSnapShot] =
    useState<LeiaConfig | null>(null);
  const [generatedLeia, setGeneratedLeia] = useState<Leia | null>(null);

  const [customizations, setCustomizations] = useState<{
    persona?: { name: string; version?: string };
    problem?: { name: string; version?: string };
    behaviour?: { name: string; version?: string };
    leia: { name: string; version?: string };
  }>({ leia: { name: "", version: "1.0.0" } });

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<Error | null>(null);
  const [testingLeia, setTestingLeia] = useState(false);
  const [isTryMenuOpen, setIsTryMenuOpen] = useState(false);
  const [tryConfig, setTryConfig] = useState<{
    modelName: string;
    apiKeyId: string | null;
  }>({ modelName: "", apiKeyId: null });
  // Per-LEIA background supervisor (instructor-authored). Persisted into
  // spec.supervisorConfig; runs on the LEIA's own key in the workbench.
  const [supervisorConfig, setSupervisorConfig] = useState<{
    enabled: boolean;
    instructions: string;
    sensitivity: "low" | "medium" | "high";
    cadence: "everyN" | "onFinish";
    everyN: number;
    intervene: boolean;
    interveneInstructions: string;
    // The supervisor always runs on OpenAI (independent of the LEIA's own
    // provider), so it gets its own OpenAI key + model.
    apiKeyId: string | null;
    model: string;
  }>({
    enabled: false,
    instructions: "",
    sensitivity: "medium",
    cadence: "everyN",
    everyN: 4,
    intervene: false,
    interveneInstructions: "",
    apiKeyId: null,
    model: "",
  });
  // OpenAI keys/models available to the supervisor (it always runs on OpenAI).
  const supervisorOpenaiKeys = useMemo(
    () => apiKeys.filter((k) => k.provider === "openai"),
    [apiKeys],
  );
  const supervisorOpenaiModels = useMemo(
    () => apiKeyProvidersMapped?.openai || [],
    [apiKeyProvidersMapped],
  );
  const geminiApiKeys = useMemo(
    () => apiKeys.filter((key) => key.provider === "gemini"),
    [apiKeys],
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
  const [isFinishingLeia, setIsFinishingLeia] = useState(false);
  const [illustrationsConfig, setIllustrationsConfig] =
    useState<IllustrationsConfig>({
      apiKeyId: null,
      generateLeiaAvatar: false,
      generatePersonaAvatar: false,
      generateProblemAvatar: false,
      generateInfographic: false,
      generateInfographicSolution: false,
    });
  const [hasChosenIllustrationApiKey, setHasChosenIllustrationApiKey] =
    useState(false);
  const previousIllustrationDefaultsRef = useRef<{
    apiKeyId: string | null;
    personaAvailable: boolean;
    problemAvailable: boolean;
  } | null>(null);

  useEffect(() => {
    setIllustrationsConfig((current) => {
      if (
        current.apiKeyId &&
        geminiApiKeys.some((key) => key.id === current.apiKeyId)
      ) {
        return current;
      }
      if (hasChosenIllustrationApiKey) {
        return { ...current, apiKeyId: null };
      }

      const defaultKey = getDefaultKey?.();
      if (defaultKey?.provider === "gemini") {
        return { ...current, apiKeyId: defaultKey.id };
      }

      return { ...current, apiKeyId: geminiApiKeys[0]?.id ?? null };
    });
  }, [geminiApiKeys, getDefaultKey, hasChosenIllustrationApiKey]);

  useEffect(() => {
    const apiKeyId = illustrationsConfig.apiKeyId;
    const personaAvailable = Boolean(leiaConfig.persona?.edited);
    const problemAvailable = Boolean(leiaConfig.problem?.edited);
    const previous = previousIllustrationDefaultsRef.current;

    setIllustrationsConfig((current) => {
      let next = current;

      if (!apiKeyId) {
        next = {
          ...current,
          generateLeiaAvatar: false,
          generatePersonaAvatar: false,
          generateProblemAvatar: false,
          generateInfographic: false,
          generateInfographicSolution: false,
        };
      } else if (previous?.apiKeyId !== apiKeyId) {
        next = {
          ...current,
          generateLeiaAvatar: true,
          generatePersonaAvatar: personaAvailable,
          generateProblemAvatar: problemAvailable,
        };
      } else {
        next = {
          ...current,
          generatePersonaAvatar: personaAvailable
            ? previous?.personaAvailable
              ? current.generatePersonaAvatar
              : true
            : false,
          generateProblemAvatar: problemAvailable
            ? previous?.problemAvailable
              ? current.generateProblemAvatar
              : true
            : false,
        };
      }

      return next;
    });

    previousIllustrationDefaultsRef.current = {
      apiKeyId,
      personaAvailable,
      problemAvailable,
    };
  }, [
    illustrationsConfig.apiKeyId,
    leiaConfig.persona?.edited,
    leiaConfig.problem?.edited,
  ]);

  // Estados para opcionalmente añadir la LEIA a una Activity
  const [showAddToActivityModal, setShowAddToActivityModal] = useState(false);
  const [createdLeiaResource, setCreatedLeiaResource] =
    useState<LeiaResource | null>(null);
  const [showFinishActionsMenu, setShowFinishActionsMenu] = useState(false);
  const [showActivityReplicationModal, setShowActivityReplicationModal] = useState(false);
  const [nameActivityReplication, setNameActivityReplication] = useState("");

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showFinishActionsMenu &&
        !(event.target as Element)?.closest(".finish-actions-menu")
      ) {
        setShowFinishActionsMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showFinishActionsMenu]);

  const startGuidedTour = useCallback((startStep: WizardStep = 2) => {
    tourRef.current?.destroy();
    setIsTryMenuOpen(false);
    setShowGenerateModal(false);
    setShowGenerateBehaviourModal(false);
    setShowCreateLabelModal(false);
    setShowFinishModal(false);
    setShowAddToActivityModal(false);
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
        if (activeIndex === 1) {
          setCurrentStep(1);
          window.setTimeout(() => {
            options.driver.moveNext();
          }, 150);
          return;
        }
        if (activeIndex === 3) {
          setCurrentStep(2);
          window.setTimeout(() => {
            options.driver.moveNext();
          }, 150);
          return;
        }

        if (activeIndex === 4) {
          setCurrentStep(3);
          
          window.setTimeout(() => {
            options.driver.moveNext();
          }, 150);
          return;
        }
        
        options.driver.moveNext();
      },
      onPrevClick: (_element, _step, options) => {
        const activeIndex = options.driver.getActiveIndex();

        if (activeIndex === 2) {
          setCurrentStep(2);
          window.setTimeout(() => {
            options.driver.movePrevious();
          }, 100);
          return;
        }

        if (activeIndex === 4) {
          setCurrentStep(2);
          window.setTimeout(() => {
            options.driver.movePrevious();
          }, 150);
          return;
        }

        if (activeIndex === 5) {
          setCurrentStep(2);
          window.setTimeout(() => {
            options.driver.movePrevious();
          }, 150);
          return;
        }

        options.driver.movePrevious();
      },
      steps: [
        {
          element: "#create-preview-panel",
          popover: {
            title: "Step 2: review",
            description:
              "Right here you can see the Behaviour, Problem and Persona that compose this LEIA. You can edit them and create new ones",
            side: "top",
          },
        },
        {
          element: "#create-previous-button",
          popover: {
            title: "Previous",
            description:
              "This button takes you back to the previous step.",
            side: "top",
          },
        },
        {
          element: "#create-selection-grid",
          popover: {
            title: "Step 1: selection",
            description:
              "You could also select different components for the LEIA by clicking on these cards.",
            side: "top",
          },
        },
        
        {
          element: "#create-next-button",
          popover: {
            title: "Next",
            description:
              "Let's go to the next step.",
            side: "top",
          },
        },
        
        {
          element: "#try-button",
          popover: {
            title: "Try",
            description:
              "Try chatting with it to see how it behaves",
            side: "top",
          },
        },
        {
          element: "#create-final-form",
          popover: {
            title: "Step 3: creation",
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
  }, [currentStep, loading, tourRequested]);

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
      setCurrentStep(2);
    }
    if (navigationState?.startTourFromSearch) {
      startGuidedTour(2);
      try {
        navigate(location.pathname, { replace: true, state: undefined as unknown as NavigationState });
      } catch (e) {
        console.error("Error clearing navigation state after starting tour:", e);}
    }
  }, [location.pathname, location.state, navigate, startGuidedTour]);

  // Restaurar estado cuando se vuelve del chat
  useEffect(() => {
    const navigationState = location.state as NavigationState;
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
        savedState.customizations || { leia: { name: "", version: "1.0.0" } },
      );
      setSelectedLabelIds(
        savedState.labelIds || (savedState.labelId ? [savedState.labelId] : []),
      );

      // Limpiar el estado de navegación para evitar cargas repetidas
      navigate(location.pathname, {
        replace: true,
        state: { ...navigationState, save: undefined } as NavigationState,
      });
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    if (
      currentStep > 1 &&
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

  const getResourceIdentifier = (resource: unknown): string | null => {
    if (!resource || typeof resource !== "object") return null;

    const candidate = resource as { id?: unknown; _id?: unknown };
    const id = candidate.id || candidate._id;
    return typeof id === "string" && id.trim() ? id : null;
  };

  const generateCreatedAvatars = async (
    targets: AvatarGenerationTarget[],
    apiKeyId: string,
  ): Promise<LeiaResource | null> => {
    const uniqueTargets = Array.from(
      new Map(
        targets.map((target) => [`${target.entity}:${target.id}`, target]),
      ).values(),
    );

    const avatarResults = await Promise.allSettled(
      uniqueTargets.map(async (target) => {
        const response = await api.post(
          `/api/v1/images/${target.entity}/${target.id}/generate`,
          { apiKeyId },
        );
        return { target, entity: response.data?.entity };
      }),
    );

    for (const result of avatarResults) {
      if (result.status === "rejected") {
        console.error("Error generating avatar after creation:", result.reason);
      }
    }

    const leiaAvatarResult = avatarResults.find(
      (result) =>
        result.status === "fulfilled" &&
        result.value.target.entity === "leias",
    );

    return leiaAvatarResult?.status === "fulfilled"
      ? (leiaAvatarResult.value.entity as LeiaResource)
      : null;
  };

  const generateCreatedInfographics = async (
    leiaId: string,
    variants: InfographicVariant[],
    apiKeyId: string,
  ): Promise<LeiaResource | null> => {
    let updatedLeia: LeiaResource | null = null;

    for (const variant of variants) {
      try {
        const path =
          variant === "infographic"
            ? "infographic"
            : "infographic-solution";
        const response = await api.post(
          `/api/v1/images/leias/${leiaId}/${path}/generate`,
          { apiKeyId },
        );
        if (response.data?.entity) {
          updatedLeia = response.data.entity as LeiaResource;
        }
      } catch (error) {
        console.error(`Error generating ${variant} after creation:`, error);
      }
    }

    return updatedLeia;
  };

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

  // Componente para selector de visibilidad
  const VisibilitySelector: React.FC<{
    value: "all" | "private" | "public";
    onChange: (value: "all" | "private" | "public") => void;
  }> = ({ value, onChange }) => (
    <div className="flex flex-col items-center">
      <label className="text-xs text-gray-600 mb-1">Visibility</label>
      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value as "all" | "private" | "public")
        }
        className="px-2 py-1 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ease-in-out w-auto min-w-[70px]"
      >
        <option value="all">All</option>
        <option value="private">Private</option>
        <option value="public">Public</option>
      </select>
    </div>
  );

  // Componente para selector de process
  const ProcessSelector: React.FC<{
    value: "all" | "requirements-elicitation" | "game" | "other";
    onChange: (value: "all" | "requirements-elicitation" | "game" | "other") => void;
  }> = ({ value, onChange }) => (
    <div className="flex flex-col items-center">
      <label className="text-xs text-gray-600 mb-1">Process</label>
      <select
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value as "all" | "requirements-elicitation" | "game" | "other",
          )
        }
        className="px-2 py-1 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ease-in-out w-auto min-w-[60px] max-w-[140px]"
      >
        <option value="all">All</option>
        <option value="requirements-elicitation">Req. Elicitation</option>
        <option value="game">Game</option>
        <option value="other">Other</option>
      </select>
    </div>
  );

  const handleSelect = (
    type: keyof LeiaConfig,
    item: Persona | Behaviour | Problem,
  ) => {
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

      // Añadir a la lista de problems
      setProblems((prev) => [generatedProblem, ...prev]);

      // Seleccionar el problema generado
      setLeiaConfig((prev) => ({
        ...prev,
        problem: generatedProblem,
      }));

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

      const generatedBehaviour: Behaviour = {
        apiVersion: leiaConfig.behaviour.apiVersion || "v1",
        metadata: {
          name: generateBehaviourSubject
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-"),
          version: "1.0.0",
        },
        spec: generatedBehaviourSpec,
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
    if (currentStep === 2) {
      delete cleaned.metadata;
    }
    if (currentStep === 3 && resource && leiaConfig[resource]?.edited) {
      const metadata = cleaned.metadata as Record<string, unknown>;
      if (metadata) {
        metadata.name = customizations[resource]?.name || "";
        metadata.version = "1.0.0";
      }
    }
    return cleaned;
  };

  const getValidModels = useCallback(
    (apiKeyId: string | null | undefined) => {
      const models = Object.values(apiKeyProvidersMapped || {}).flat();
      if (!apiKeyId) return models;

      const apiKey = apiKeys.find((key) => key.id === apiKeyId);
      if (!apiKey || !apiKey.provider) return models;

      return apiKeyProvidersMapped[apiKey.provider] || [];
    },
    [apiKeyProvidersMapped, apiKeys]
  );

  const getValidApiKeys = useCallback(
    (modelName: string | null | undefined) => {
      const activeApiKeys = apiKeys.filter((key) => key.isActive !== false);
      if (!modelName) return activeApiKeys;

      const validProviders = Object.entries(apiKeyProvidersMapped || {})
        .filter(([, models]) => models.includes(modelName))
        .map(([provider]) => provider);

      return activeApiKeys.filter((key) =>
        validProviders.includes(key.provider)
      );
    },
    [apiKeyProvidersMapped, apiKeys]
  );

  const ensureTryConfig = useCallback(() => {
    // When the problem declares widgets, tools only run on a tool-capable
    // provider (openai-responses), so the Try must seed an OpenAI model/key —
    // even if the user's DEFAULT key belongs to another provider.
    const problemWidgets = leiaConfig.problem?.spec?.widgets;
    const requiresTools = Array.isArray(problemWidgets) && problemWidgets.length > 0;
    const toolCapableProviders = Object.entries(providerProviderModuleMap || {})
      .filter(([, moduleName]) => moduleName === "openai-responses")
      .map(([provider]) => provider);
    const toolCapableModels = toolCapableProviders.flatMap(
      (provider) => apiKeyProvidersMapped[provider] || []
    );
    const activeApiKeys = apiKeys.filter((key) => key.isActive !== false);
    const candidateKeys = requiresTools
      ? activeApiKeys.filter((key) =>
          toolCapableProviders.includes(key.provider)
        )
      : activeApiKeys;

    setTryConfig((prev) => {
      const prevKeyValid = Boolean(prev.apiKeyId && candidateKeys.some((k) => k.id === prev.apiKeyId));
      const prevModelValid = Boolean(
        prev.modelName && (!requiresTools || toolCapableModels.includes(prev.modelName))
      );
      // Keep a still-valid selection; otherwise (re)seed from the candidates.
      if ((prev.modelName || prev.apiKeyId) && prevKeyValid && prevModelValid) {
        return prev;
      }

      const defaultKey = getDefaultKey();
      const key =
        defaultKey && candidateKeys.some((k) => k.id === defaultKey.id)
          ? defaultKey
          : candidateKeys[0] ?? null;
      const validModels = requiresTools ? toolCapableModels : getValidModels(key?.id);
      // Preselect the chosen key's default model, then fall back.
      const model =
        key?.model && validModels.includes(key.model)
          ? key.model
          : defaultModel && validModels.includes(defaultModel)
            ? defaultModel
            : validModels[0] ?? "";

      return { modelName: model, apiKeyId: key?.id ?? null };
    });
  }, [
    leiaConfig.problem,
    providerProviderModuleMap,
    apiKeyProvidersMapped,
    apiKeys,
    defaultModel,
    getDefaultKey,
    getValidModels,
  ]);

  const handleTryMenuToggle = useCallback(() => {
    if (testingLeia) return;
    setIsTryMenuOpen((prev) => !prev);
    ensureTryConfig();
  }, [ensureTryConfig, testingLeia]);

  const handleTryModelChange = useCallback(
    (modelName: string) => {
      setTryConfig((prev) => {
        const validApiKeys = getValidApiKeys(modelName);
        const apiKeyId = validApiKeys.some((key) => key.id === prev.apiKeyId)
          ? prev.apiKeyId
          : (validApiKeys.find((key) => key.isDefault) || validApiKeys[0])?.id ?? null;

        return {
          ...prev,
          modelName,
          apiKeyId,
        };
      });
    },
    [getValidApiKeys]
  );

  const handleTryApiKeyChange = useCallback((apiKeyId: string) => {
    setTryConfig((prev) => ({ ...prev, apiKeyId: apiKeyId || null }));
  }, []);

  const handleTestLeia = async () => {
    if (!generatedLeia) {
      console.error("No generated LEIA available");
      return;
    }

    if (!tryConfig.modelName || !tryConfig.apiKeyId) {
      return;
    }

    try {
      setTestingLeia(true);
      const response = await api.post("/api/v1/runner/initialize", {
        spec: generatedLeia.spec,
        runnerConfiguration: tryConfig,
      });
      const { sessionId } = response.data;
      navigate(`/chat/${sessionId}`, {
        state: {
          save: {
            currentStep,
            leiaConfig,
            leiaConfigSnapShot,
            labelIds: selectedLabelIds,
            labelId: selectedLabelIds[0] || null,
            customizations,
          },
          problemDescription: generatedLeia.spec.problem.spec.description,
          personaAvatar: generatedLeia.spec.persona.spec.avatar || "",
        },
      });
    } catch (error) {
      console.error("Error initializing LEIA:", error);
      setError("Failed to initialize LEIA session");
    } finally {
      setTestingLeia(false);
    }
  };

  const handleStartTry = async () => {
    if (!tryConfig.modelName || !tryConfig.apiKeyId) {
      return;
    }
    setIsTryMenuOpen(false);
    await handleTestLeia();
  };

  useEffect(() => {
    if (generatedLeia && !isApiKeysLoading && !isProvidersLoading) {
      ensureTryConfig();
    }
  }, [generatedLeia, isApiKeysLoading, isProvidersLoading, ensureTryConfig]);

  const handleNextStep = async () => {
    if (currentStep === 3 && isStep3Complete) {
      if (isFinishingLeia) {
        return;
      }

      setIsFinishingLeia(true);

      try {
        const errors = {} as Record<string, string>;

        for (const [key, value] of Object.entries(customizations)) {
          if (value) {
            if (!value.name?.trim()) {
              errors[key] = "Name is required";
              continue;
            }

            try {
              const response = await api.get(
                `/api/v1/${key}s/exists/${value.name}`,
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

        const leia = {
          apiVersion: "v1",
          metadata: {
            name: customizations.leia.name,
            version: "1.0.0",
            labels: finalLabelIds.length > 0 ? finalLabelIds : undefined,
          },
          spec: {} as Record<string, any>,
        };
        const avatarGenerationTargets: AvatarGenerationTarget[] = [];

        for (const [key, value] of Object.entries(leiaConfig)) {
          if (value && value.edited) {
            const newResource = structuredClone(value) as any;
            delete newResource.edited;
            delete newResource.id;
            delete newResource.createdAt;
            delete newResource.updatedAt;
            delete newResource.user;
            delete newResource.metadata.version;
            delete newResource.isPublished;
            if (key === "persona" || key === "problem") {
              delete newResource.spec?.avatar;
            }
            newResource.metadata.name =
              customizations[key as keyof LeiaConfig]?.name;
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
              const createdResourceId = getResourceIdentifier(response.data);
              if (
                createdResourceId &&
                key === "persona" &&
                illustrationsConfig.generatePersonaAvatar
              ) {
                avatarGenerationTargets.push({
                  entity: "personas",
                  id: createdResourceId,
                });
              }
              if (
                createdResourceId &&
                key === "problem" &&
                illustrationsConfig.generateProblemAvatar
              ) {
                avatarGenerationTargets.push({
                  entity: "problems",
                  id: createdResourceId,
                });
              }
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

        // Attach the per-LEIA supervisor config only when enabled.
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
            apiKeyRequesterId: supervisorConfig.apiKeyId
              ? currentUser?.id
              : undefined,
            model: supervisorConfig.model || undefined,
          };
        }

        try {
          // Construir la URL con el query parameter publish
          const publishParam =
            currentUser?.role === "admin" ? `?publish=${leiaPublish}` : "";
          const response = await api.post(`/api/v1/leias${publishParam}`, leia);
          console.log("LEIA created successfully:", response.data);
          const createdLeiaId = getResourceIdentifier(response.data);
          if (createdLeiaId && illustrationsConfig.generateLeiaAvatar) {
            avatarGenerationTargets.push({
              entity: "leias",
              id: createdLeiaId,
            });
          }
          const imageKeyId = illustrationsConfig.apiKeyId;
          const leiaWithGeneratedAvatar = imageKeyId
            ? await generateCreatedAvatars(avatarGenerationTargets, imageKeyId)
            : null;
          const infographicVariants: InfographicVariant[] = [];
          if (illustrationsConfig.generateInfographic) {
            infographicVariants.push("infographic");
          }
          if (illustrationsConfig.generateInfographicSolution) {
            infographicVariants.push("infographicSolution");
          }
          const leiaWithGeneratedInfographics =
            createdLeiaId && imageKeyId && infographicVariants.length > 0
              ? await generateCreatedInfographics(
                  createdLeiaId,
                  infographicVariants,
                  imageKeyId,
                )
              : null;
          setCreatedLeiaName(
            response.data?.metadata?.name || customizations.leia.name || "LEIA",
          );
          setCreatedLeiaResource(
            leiaWithGeneratedInfographics ||
              leiaWithGeneratedAvatar ||
              (response.data as LeiaResource),
          );
          setShowFinishModal(true);
        } catch (error) {
          console.error("Error creating LEIA:", error);
          setError("Failed to create LEIA");
        }
      } finally {
        setIsFinishingLeia(false);
      }
    }
    if (currentStep < 3) {
      if (currentStep === 1) {
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
      }
      if (currentStep === 2) {
        setCustomizations({
          persona: leiaConfig.persona?.edited
            ? { name: "", version: "1.0.0" }
            : undefined,
          problem: leiaConfig.problem?.edited
            ? { name: "", version: "1.0.0" }
            : undefined,
          behaviour: leiaConfig.behaviour?.edited
            ? { name: "", version: "1.0.0" }
            : undefined,
          leia: { name: "", version: "1.0.0" },
        });
      }
      setCurrentStep((currentStep + 1) as WizardStep);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as WizardStep);
    }
  };

  const isStep1Complete =
    leiaConfig.persona && leiaConfig.problem && leiaConfig.behaviour;
  const isStep2Complete = !generationError && generatedLeia;
  const isStep3Complete = (() => {
    const customizationsValid = Object.values(customizations).every(
      (resource) => {
        if (!resource) return true;
        return resource.name && resource.name.trim() !== "";
      },
    );

    const noValidationErrors = validationErrors
      ? Object.values(validationErrors).every((error) => !error)
      : true;

    return customizationsValid && noValidationErrors;
  })();

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-8 mb-8">
      <div className="flex items-center space-x-2">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep >= 1
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          1
        </div>
        <span
          className={`text-sm font-medium ${
            currentStep >= 1 ? "text-blue-600" : "text-gray-600"
          }`}
        >
          Selection
        </span>
      </div>
      <div
        className={`h-px w-12 ${
          currentStep >= 2 ? "bg-blue-300" : "bg-gray-300"
        }`}
      />
      <div className="flex items-center space-x-2">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep >= 2
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          2
        </div>
        <span
          className={`text-sm font-medium ${
            currentStep >= 2 ? "text-blue-600" : "text-gray-600"
          }`}
        >
          Edit
        </span>
      </div>
      <div
        className={`h-px w-12 ${
          currentStep >= 3 ? "bg-blue-300" : "bg-gray-300"
        }`}
      />
      <div className="flex items-center space-x-2">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep >= 3
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          3
        </div>
        <span
          className={`text-sm font-medium ${
            currentStep >= 3 ? "text-blue-600" : "text-gray-600"
          }`}
        >
          Create
        </span>
      </div>
    </div>
  );

  // Applies a problem produced by the AI assistant's apply_problem tool: wraps
  // the returned spec into a Problem and selects it (full replace), mirroring
  // the one-shot generate flow.
  const applyChatProblem = useCallback(
    (spec: ProblemSpec, name?: string) => {
      const incomingSpec = spec as unknown as Record<string, unknown>;
      setLeiaConfig((prev) => ({
        ...prev,
        problem: {
          apiVersion: "v1",
          metadata: {
            name: name || prev.problem?.metadata?.name || "ai-generated-problem",
            version: "1.0.0",
          },
          // Preserve extends/overrides/constrainedTo and widgets the model set;
          // default the composition objects to {} only when absent.
          spec: {
            ...incomingSpec,
            extends: incomingSpec.extends ?? {},
            overrides: incomingSpec.overrides ?? {},
            constrainedTo: incomingSpec.constrainedTo ?? {},
          },
          id: `generated-${Date.now()}`,
          edited: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPublished: false,
          user: currentUser!,
        } as unknown as Problem,
        // A matching process or programming language does not make an old
        // exercise-specific behaviour valid for this new problem.
        behaviour: null,
      }));
    },
    [currentUser],
  );

  // The chat can author the whole LEIA: behaviour + persona too (each written
  // into its editor with a name, marked edited so it's created on save).
  const applyChatBehaviour = useCallback(
    (spec: Record<string, unknown>, name?: string) => {
      setLeiaConfig((prev) => ({
        ...prev,
        behaviour: {
          apiVersion: "v1",
          metadata: {
            name: name || prev.behaviour?.metadata?.name || "ai-generated-behaviour",
            version: "1.0.0",
          },
          spec: { ...spec },
          id: `generated-${Date.now()}`,
          edited: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPublished: false,
          user: currentUser!,
        } as unknown as Behaviour,
      }));
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
          id: `generated-${Date.now()}`,
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

  // The chat may reuse an existing persona by id. Behaviours are always
  // generated for the exact new problem.
  const handleUseExistingPersona = useCallback(
    (id: string): { ok: boolean; name?: string } => {
      const item = personas.find((p) => p.id === id);
      if (!item) return { ok: false };
      setLeiaConfig((prev) => ({ ...prev, persona: item }));
      return { ok: true, name: item.metadata?.name };
    },
    [personas],
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Step 1: Select Components
        </h2>
        <p className="text-gray-600">
          Choose a persona, problem, and behaviour for your LEIA
        </p>
      </div>

      {/* Show loading state for individual columns if data is still loading */}
      {loading && (
        <div className="grid grid-cols-3">
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show actual content when not loading */}
      {!loading && (
        <div id="create-selection-grid" className="grid grid-cols-3">
          {/* Columna 1: Behaviour */}
          <div className="h-full">
            <SelectionColumn
              title="Behaviour"
              items={behaviours}
              selectedItem={leiaConfig.behaviour}
              onSelect={(item) => handleSelect("behaviour", item)}
              placeholder="Search behaviours..."
              onDelete={handleDeleteResource}
              rightHeaderElement={
                <div className="flex gap-3 items-start">
                  <button
                    onClick={openGenerateBehaviourModal}
                    disabled={!leiaConfig.behaviour}
                    className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Generate similar behaviour with AI"
                  >
                    <SparklesIcon className="w-5 h-5" />
                  </button>
                  <VisibilitySelector
                    value={behaviourVisibility}
                    onChange={handleBehaviourVisibilityChange}
                  />
                  <ProcessSelector
                    value={behaviourProcess}
                    onChange={handleBehaviourProcessChange}
                  />
                </div>
              }
            />
          </div>

          {/* Columna 2: Problem */}
          <div className="h-full">
            <SelectionColumn
              title="Problem"
              items={problems}
              selectedItem={leiaConfig.problem}
              onSelect={(item) => handleSelect("problem", item)}
              placeholder="Search problems..."
              onDelete={handleDeleteResource}
              rightHeaderElement={
                <div className="flex gap-3 items-start">
                  <button
                    onClick={openGenerateProblemModal}
                    disabled={!leiaConfig.problem}
                    className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Generate similar problem with AI"
                  >
                    <SparklesIcon className="w-5 h-5" />
                  </button>
                  <VisibilitySelector
                    value={problemVisibility}
                    onChange={handleProblemVisibilityChange}
                  />
                  <ProcessSelector
                    value={problemProcess}
                    onChange={handleProblemProcessChange}
                  />
                </div>
              }
            />
          </div>

          {/* Columna 3: Persona */}
          <div className="h-full">
            <SelectionColumn
              title="Persona"
              items={personas}
              selectedItem={leiaConfig.persona}
              onSelect={(item) => handleSelect("persona", item)}
              placeholder="Search personas..."
              onDelete={handleDeleteResource}
              rightHeaderElement={
                <VisibilitySelector
                  value={personaVisibility}
                  onChange={handlePersonaVisibilityChange}
                />
              }
            />
          </div>
        </div>
      )}
    </div>
  );

  const isCurrentUserInstructor = currentUser?.role === "instructor";

  const renderStep2 = () => {
    const isTryLoading = isApiKeysLoading || isProvidersLoading;
    // Widgets / tool-functions only work through a tool-capable runner provider
    // (the openai-responses module). When the problem declares widgets, the Try
    // is restricted to those models/keys — today that means OpenAI.
    const problemHasWidgets =
      Array.isArray(leiaConfig.problem?.spec?.widgets) &&
      (leiaConfig.problem?.spec?.widgets?.length ?? 0) > 0;
    const toolCapableProviders = Object.entries(providerProviderModuleMap || {})
      .filter(([, moduleName]) => moduleName === "openai-responses")
      .map(([provider]) => provider);
    const toolCapableModels = toolCapableProviders.flatMap(
      (provider) => apiKeyProvidersMapped[provider] || []
    );
    // Show every available model in the Try menu. Selecting one will choose a
    // compatible API key in handleTryModelChange; filtering by the currently
    // selected (usually default) key would hide the rest of the catalog.
    let validTryModels = getValidModels(null);
    let validTryApiKeys = getValidApiKeys(tryConfig.modelName);
    if (problemHasWidgets) {
      validTryModels = validTryModels.filter((m) => toolCapableModels.includes(m));
      validTryApiKeys = validTryApiKeys.filter((k) =>
        toolCapableProviders.includes(k.provider)
      );
    }
    const canStartTry =
      Boolean(tryConfig.modelName && tryConfig.apiKeyId) &&
      !isTryLoading &&
      (!problemHasWidgets || toolCapableModels.includes(tryConfig.modelName));
    const showNoApiKeys =
      !isTryLoading &&
      !providersError &&
      !apiKeysError &&
      apiKeys.every((key) => key.isActive === false);
    const showNoMatchingKeys =
      !isTryLoading &&
      Boolean(tryConfig.modelName) &&
      validTryApiKeys.length === 0 &&
      apiKeys.some((key) => key.isActive !== false);

    return (
      <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Step 2: Edit</h2>
        <p className="text-gray-600">
          Modify any of the resources, see changes in real-time and test your
          creation
        </p>
      </div>

      {/* AI Assistant: chat + PDF attachments → writes the problem into the editor */}
      <div className="h-[440px]">
        <ProblemChatPanel
          currentProblem={leiaConfig.problem}
          currentBehaviour={leiaConfig.behaviour}
          currentPersona={leiaConfig.persona}
          personas={personas}
          onApplyProblem={applyChatProblem}
          onApplyBehaviour={applyChatBehaviour}
          onApplyPersona={applyChatPersona}
          onUsePersona={handleUseExistingPersona}
        />
      </div>

      <div id="create-preview-panel" className="grid grid-cols-3 gap-6 h-full">
        {/* Columna 1: Behaviour */}
        <div className="space-y-4 flex flex-col">
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex-1 flex flex-col">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-gray-900">
                  Behaviour
                  {leiaConfig.behaviour?.edited ? (
                    <span className="text-xs text-gray-500 font-normal ml-2">
                      (edited)
                    </span>
                  ) : (
                    leiaConfig.behaviour?.user && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 font-normal ml-2 inline-flex">
                        <span>by {leiaConfig.behaviour.user.email}</span>
                        <span className="flex items-center gap-1">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              leiaConfig.behaviour.user.role === "admin"
                                ? "bg-purple-500"
                                : "bg-green-500"
                            }`}
                          ></span>
                          {leiaConfig.behaviour.user.role === "admin"
                            ? "Administrator"
                            : "Instructor"}
                        </span>
                      </div>
                    )
                  )}
                </h3>
              </div>
              {leiaConfig.behaviour && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {leiaConfig.behaviour.metadata.name}
                  </span>
                  <span className="px-1.5 py-0.5 bg-gray-100 text-xs font-medium text-gray-600 rounded-full">
                    v{leiaConfig.behaviour.metadata.version}
                  </span>
                </div>
              )}
            </div>
            {leiaConfig.behaviour ? (
              <div className="space-y-3 flex-1 flex flex-col">
                {!isCurrentUserInstructor ? (
                  <>
                    <div className="p-3 bg-gray-50 rounded border border-gray-200 flex-1">
                      <p className="text-xs text-gray-600 mt-1 line-clamp-3">
                        {leiaConfig.behaviour.spec.description}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {leiaConfig.behaviour?.edited && (
                        <button
                          onClick={() =>
                            setLeiaConfig((prev) => ({
                              ...prev,
                              behaviour:
                                structuredClone(
                                  leiaConfigSnapShot?.behaviour,
                                ) || null,
                            }))
                          }
                          className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                        >
                          Reset
                        </button>
                      )}
                      <button
                        onClick={openGenerateBehaviourModal}
                        className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center gap-1"
                        title="Generate similar with AI"
                      >
                        <SparklesIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setEditingResource({
                            resource: "behaviour",
                            content: JSON.stringify(
                              leiaConfig.behaviour?.spec,
                              null,
                              2,
                            ),
                            apiVersion:
                              leiaConfig.behaviour?.apiVersion || "v1",
                          })
                        }
                        className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm ${
                          leiaConfig.behaviour?.edited ? "flex-1" : "w-full"
                        }`}
                      >
                        Edit
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-3 bg-gray-50 rounded border border-gray-200 flex-1 flex items-center justify-center">
                    <CpuChipIcon className="w-10 h-10 text-gray-400 mx-auto" />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Not selected</p>
            )}
          </div>
        </div>

        {/* Columna 2: Problem */}
        <div className="space-y-4 flex flex-col">
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex-1 flex flex-col">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-gray-900">
                  Problem
                  {leiaConfig.problem?.edited ? (
                    <span className="text-xs text-gray-500 font-normal ml-2">
                      (edited)
                    </span>
                  ) : (
                    leiaConfig.problem?.user && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 font-normal ml-2 inline-flex">
                        <span>by {leiaConfig.problem.user.email}</span>
                        <span className="flex items-center gap-1">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              leiaConfig.problem.user.role === "admin"
                                ? "bg-purple-500"
                                : "bg-green-500"
                            }`}
                          ></span>
                          {leiaConfig.problem.user.role === "admin"
                            ? "Administrator"
                            : "Instructor"}
                        </span>
                      </div>
                    )
                  )}
                </h3>
              </div>
              {leiaConfig.problem && (
                <div className="flex items-center gap-2 mb-2">
                  <Avatar
                    src={leiaConfig.problem.spec.avatar}
                    fallbackSrc={buildOriginalAvatarPath(
                      "problems",
                      leiaConfig.problem.id,
                    )}
                    alt={`${leiaConfig.problem.metadata.name} avatar`}
                    label={leiaConfig.problem.metadata.name}
                    size="sm"
                  />
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {leiaConfig.problem.metadata.name}
                    </span>
                    <span className="px-1.5 py-0.5 bg-gray-100 text-xs font-medium text-gray-600 rounded-full">
                      v{leiaConfig.problem.metadata.version}
                    </span>
                  </div>
                </div>
              )}
            </div>
            {leiaConfig.problem ? (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-xs text-gray-600 mt-1 line-clamp-3">
                    {leiaConfig.problem.spec.description}
                  </p>
                </div>
                <div className="flex gap-2">
                  {leiaConfig.problem?.edited && (
                    <button
                      onClick={() =>
                        setLeiaConfig((prev) => ({
                          ...prev,
                          problem:
                            structuredClone(leiaConfigSnapShot?.problem) ||
                            null,
                        }))
                      }
                      className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    onClick={openGenerateProblemModal}
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center gap-1"
                    title="Generate similar with AI"
                  >
                    <SparklesIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setEditingResource({
                        resource: "problem",
                        content: null,
                        apiVersion: leiaConfig.problem?.apiVersion || "v1",
                      })
                    }
                    className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm ${
                      leiaConfig.problem?.edited ? "flex-1" : "flex-1"
                    }`}
                  >
                    Edit
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Not selected</p>
            )}
          </div>
        </div>

        {/* Columna 3: Persona */}
        <div className="space-y-4 flex flex-col">
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex-1 flex flex-col">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-gray-900">
                  Persona
                  {leiaConfig.persona?.edited ? (
                    <span className="text-xs text-gray-500 font-normal ml-2">
                      (edited)
                    </span>
                  ) : (
                    leiaConfig.persona?.user && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 font-normal ml-2 inline-flex">
                        <span>by {leiaConfig.persona.user.email}</span>
                        <span className="flex items-center gap-1">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              leiaConfig.persona.user.role === "admin"
                                ? "bg-purple-500"
                                : "bg-green-500"
                            }`}
                          ></span>
                          {leiaConfig.persona.user.role === "admin"
                            ? "Administrator"
                            : "Instructor"}
                        </span>
                      </div>
                    )
                  )}
                </h3>
              </div>
              {leiaConfig.persona && (
                <div className="flex items-center gap-2 mb-2">
                  <Avatar
                    src={leiaConfig.persona.spec.avatar}
                    fallbackSrc={buildOriginalAvatarPath(
                      "personas",
                      leiaConfig.persona.id,
                    )}
                    alt={`${leiaConfig.persona.metadata.name} avatar`}
                    label={leiaConfig.persona.metadata.name}
                    size="sm"
                  />
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {leiaConfig.persona.metadata.name}
                    </span>
                    <span className="px-1.5 py-0.5 bg-gray-100 text-xs font-medium text-gray-600 rounded-full">
                      v{leiaConfig.persona.metadata.version}
                    </span>
                  </div>
                </div>
              )}
            </div>
            {leiaConfig.persona ? (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-xs text-gray-600 mt-1 line-clamp-3">
                    {leiaConfig.persona.spec.description}
                  </p>
                </div>
                <div className="flex gap-2">
                  {leiaConfig.persona?.edited && (
                    <button
                      onClick={() =>
                        setLeiaConfig((prev) => ({
                          ...prev,
                          persona:
                            structuredClone(leiaConfigSnapShot?.persona) ||
                            null,
                        }))
                      }
                      className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    onClick={() =>
                      setEditingResource({
                        resource: "persona",
                        content: null,
                        apiVersion: leiaConfig.persona?.apiVersion || "v1",
                      })
                    }
                    className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm ${
                      leiaConfig.persona?.edited ? "flex-1" : "w-full"
                    }`}
                  >
                    Edit
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Not selected</p>
            )}
          </div>
        </div>
      </div>

      {/* Resource Editor */}
      {editingResource.resource && (
        <div className="overflow-hidden transition-all duration-500 ease-in-out animate-in slide-in-from-top-5">
          <ResourceEditor
            resourceType={editingResource.resource}
            initialData={leiaConfig[editingResource.resource] || undefined}
            apiVersion={editingResource.apiVersion}
            onSave={(data, apiVersion) => {
              setLeiaConfig((prev) => ({
                ...prev,
                [editingResource.resource!]: {
                  ...prev[editingResource.resource!],
                  spec: data,
                  apiVersion: apiVersion,
                  edited: true,
                },
              }));
              setEditingResource({
                resource: null,
                content: null,
                apiVersion: "v1",
              });
            }}
            onCancel={() =>
              setEditingResource({
                resource: null,
                content: null,
                apiVersion: "v1",
              })
            }
          />
        </div>
      )}

      {/* Vista previa en tiempo real */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Real-time Preview</h3>
          {(() => {
            if (!generatedLeia) {
              return (
                <button
                  disabled
                  className="px-2.5 py-2 rounded-lg bg-gray-300 text-gray-500 cursor-not-allowed transition-all duration-300 flex items-center gap-2"
                >
                  <LightBulbIcon className="w-5 h-5" />
                </button>
              );
            }

            if (testingLeia) {
              return (
                <button
                  disabled
                  className="px-4 py-2 rounded-lg bg-blue-500 text-white cursor-wait transition-all duration-300 flex items-center gap-2"
                >
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Starting...</span>
                </button>
              );
            }

            return (
              <div className="relative flex">
                <button
                  onClick={showNoApiKeys ? handleTryMenuToggle : handleStartTry}
                  disabled={!showNoApiKeys && !canStartTry}
                  className={`bg-green-600 px-3 py-2 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300 flex items-center gap-2 ${
                    showNoApiKeys ? "rounded-lg" : "rounded-l-lg"
                  }`}
                  id= "try-button"
                >
                  <LightBulbIcon className="w-5 h-5 flex-shrink-0" />
                  <span>Try</span>
                </button>
                {!showNoApiKeys && (
                  <button
                    onClick={handleTryMenuToggle}
                    className="rounded-r-lg border-l border-green-700 bg-green-600 px-2 text-white transition-colors hover:bg-green-700"
                    aria-label="Choose Try settings"
                    aria-expanded={isTryMenuOpen}
                    aria-haspopup="dialog"
                  >
                    <ChevronDownIcon className="h-4 w-4" />
                  </button>
                )}
                <LeiaTryDropdown
                  isOpen={isTryMenuOpen}
                  onClose={() => setIsTryMenuOpen(false)}
                  isLoading={isTryLoading}
                  providersError={providersError}
                  apiKeysError={apiKeysError}
                  modelValue={tryConfig.modelName}
                  models={validTryModels}
                  apiKeys={validTryApiKeys}
                  apiKeyValue={tryConfig.apiKeyId}
                  apiKeyProvidersMapped={apiKeyProvidersMapped}
                  toolsRestricted={problemHasWidgets}
                  onModelChange={handleTryModelChange}
                  onApiKeyChange={handleTryApiKeyChange}
                  canStart={canStartTry}
                  onStart={handleStartTry}
                  isStarting={testingLeia}
                  showNoApiKeys={showNoApiKeys}
                  showNoMatchingKeys={showNoMatchingKeys}
                />
              </div>
            );
          })()}
        </div>
        {generatedLeia && !generationError ? (
          <div
            className={`grid ${
              isCurrentUserInstructor ? "grid-cols-2" : "grid-cols-3"
            } gap-4`}
          >
            {!isCurrentUserInstructor && (
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Behaviour</h4>
                {leiaConfig.behaviour ? (
                  <div className="bg-white rounded border border-gray-300 overflow-hidden">
                    <Editor
                      height="150px"
                      language="json"
                      theme="vs-light"
                      value={JSON.stringify(
                        cleanObjectForPreview(generatedLeia?.spec.behaviour),
                        null,
                        2,
                      )}
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
                        scrollbar: {
                          vertical: "auto",
                          horizontal: "auto",
                          handleMouseWheel: true,
                        },
                        overviewRulerLanes: 0,
                        hideCursorInOverviewRuler: true,
                        overviewRulerBorder: false,
                        wordWrap: "on",
                      }}
                    />
                  </div>
                ) : (
                  <div className="bg-gray-100 rounded p-4 text-center text-gray-500 text-sm">
                    No behaviour selected
                  </div>
                )}
              </div>
            )}
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">Problem</h4>
              {leiaConfig.problem ? (
                <div className="bg-white rounded border border-gray-300 overflow-hidden">
                  <Editor
                    height="150px"
                    language="json"
                    theme="vs-light"
                    value={JSON.stringify(
                      cleanObjectForPreview(generatedLeia?.spec.problem),
                      null,
                      2,
                    )}
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
                      scrollbar: {
                        vertical: "auto",
                        horizontal: "auto",
                        handleMouseWheel: true,
                      },
                      overviewRulerLanes: 0,
                      hideCursorInOverviewRuler: true,
                      overviewRulerBorder: false,
                      wordWrap: "on",
                    }}
                  />
                </div>
              ) : (
                <div className="bg-gray-100 rounded p-4 text-center text-gray-500 text-sm">
                  No problem selected
                </div>
              )}
            </div>
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">Persona</h4>
              {leiaConfig.persona ? (
                <div className="bg-white rounded border border-gray-300 overflow-hidden">
                  <Editor
                    height="150px"
                    language="json"
                    theme="vs-light"
                    value={JSON.stringify(
                      cleanObjectForPreview(generatedLeia?.spec.persona),
                      null,
                      2,
                    )}
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
                      scrollbar: {
                        vertical: "auto",
                        horizontal: "auto",
                        handleMouseWheel: true,
                      },
                      overviewRulerLanes: 0,
                      hideCursorInOverviewRuler: true,
                      overviewRulerBorder: false,
                      wordWrap: "on",
                    }}
                  />
                </div>
              ) : (
                <div className="bg-gray-100 rounded p-4 text-center text-gray-500 text-sm">
                  No persona selected
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-center mb-3">
              <h4 className="text-lg font-medium text-red-800">
                LEIA Generation Error
              </h4>
            </div>
            <div className="text-red-700">
              <p className="mb-3">
                {generationError ? (
                  <>
                    <strong>Error:</strong> {generationError.message}
                  </>
                ) : (
                  "Unable to generate LEIA preview. Please ensure all components are properly selected and configured."
                )}
              </p>
              <p className="text-sm">
                Please review the affected components content.
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                {!leiaConfig.behaviour && (
                  <li className="flex items-center">
                    <span className="text-red-500 mr-2">✗</span>
                    Behaviour component is missing
                  </li>
                )}
                {!leiaConfig.problem && (
                  <li className="flex items-center">
                    <span className="text-red-500 mr-2">✗</span>
                    Problem component is missing
                  </li>
                )}
                {!leiaConfig.persona && (
                  <li className="flex items-center">
                    <span className="text-red-500 mr-2">✗</span>
                    Persona component is missing
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
    );
  };

  const renderStep3 = () => {
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

    const selectedLabelOptions: LabelOption[] = labelOptions.filter((option) =>
      selectedLabelIds.includes(option.value),
    );
    const personaIllustrationAvailable = Boolean(leiaConfig.persona?.edited);
    const problemIllustrationAvailable = Boolean(leiaConfig.problem?.edited);
    const illustrationsDisabled = !illustrationsConfig.apiKeyId;
    const updateIllustrationsConfig = (
      patch: Partial<IllustrationsConfig>,
    ) => {
      setIllustrationsConfig((current) => ({ ...current, ...patch }));
    };

    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Step 3: Create your LEIA
          </h2>
          <p className="text-gray-600">
            Update the fields of the required resources and complete the process
          </p>
        </div>
      <div id="create-final-form" className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">LEIA</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              A new LEIA will be created with the following name:
            </label>
            <input
              type="text"
              value={customizations.leia.name}
              onChange={(e) => {
                setCustomizations((prev) => ({
                  ...prev,
                  leia: { ...prev.leia, name: e.target.value },
                }));
                // Limpiar error cuando el usuario escriba
                if (validationErrors?.leia) {
                  setValidationErrors((prev) => ({
                    ...prev,
                    leia: undefined,
                  }));
                }
              }}
              placeholder="Enter LEIA name"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-[42px] ${
                validationErrors?.leia
                  ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                  : "border-gray-300"
              }`}
            />
            {validationErrors?.leia && (
              <p className="mt-1 text-sm text-red-600">
                {validationErrors.leia}
              </p>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Labels
              </label>
              <CreatableSelect<LabelOption, true>
                isMulti
                closeMenuOnSelect={false}
                isSearchable
                isDisabled={loading || !!labelsError}
                isLoading={loading}
                inputValue={labelSearchInput}
                placeholder="Select one or more labels..."
                value={selectedLabelOptions}
                options={labelOptions}
                onChange={(options: MultiValue<LabelOption>) => {
                  const nextSelectedLabelIds = options.map(
                    (option) => option.value,
                  );

                  setSelectedLabelIds(nextSelectedLabelIds);
                  setPendingLabelDrafts((prev) =>
                    prev.filter((draft) =>
                      nextSelectedLabelIds.includes(draft.id),
                    ),
                  );
                  setLabelSearchInput("");
                }}
                onInputChange={(inputValue: string, meta: InputActionMeta) => {
                  if (meta.action === "input-change") {
                    setLabelSearchInput(inputValue);
                  }

                  return inputValue;
                }}
                onCreateOption={(inputValue: string) => {
                  const candidate = inputValue.trim();
                  if (!candidate) return;
                  setShowCreateLabelModal(true);
                  setCreateLabelError(null);
                  setNewLabelName(candidate);
                }}
                formatCreateLabel={(inputValue) =>
                  `Create label "${inputValue}"`
                }
                noOptionsMessage={({ inputValue }) =>
                  inputValue?.trim()
                    ? `No labels found. Create "${inputValue.trim()}"`
                    : "No labels available"
                }
                isValidNewOption={(inputValue) => {
                  const candidate = inputValue.trim();
                  if (!candidate) return false;
                  const isExistingLabel = labels.some(
                    (label) =>
                      label.name.trim().toLowerCase() ===
                      candidate.toLowerCase(),
                  );

                  const isPendingLabel = pendingLabelDrafts.some(
                    (draft) =>
                      draft.name.trim().toLowerCase() ===
                      candidate.toLowerCase(),
                  );

                  return !isExistingLabel && !isPendingLabel;
                }}
                formatOptionLabel={(option) => (
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full border border-black/10"
                      style={{ backgroundColor: option.color }}
                    />
                    <span className="truncate">{option.label}</span>
                    {option.isGlobal && (
                      <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                        Global
                      </span>
                    )}
                  </div>
                )}
                styles={{
                  control: (base, state) => ({
                    ...base,
                    minHeight: "42px",
                    borderColor: labelsError
                      ? "#fca5a5"
                      : state.isFocused
                        ? "#3b82f6"
                        : "#d1d5db",
                    boxShadow: state.isFocused
                      ? "0 0 0 1px #3b82f6"
                      : "none",
                    "&:hover": {
                      borderColor: labelsError ? "#fca5a5" : "#9ca3af",
                    },
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isFocused
                      ? "#eff6ff"
                      : state.isSelected
                        ? "#dbeafe"
                        : "white",
                    color: "#111827",
                  }),
                }}
                className="react-select-container"
                classNamePrefix="react-select"
              />
              {pendingLabelDrafts.length > 0 && (
                <p className="mt-1 text-xs text-blue-700">
                  {pendingLabelDrafts.length} new label
                  {pendingLabelDrafts.length === 1 ? "" : "s"} will be created when you click Finish.
                </p>
              )}
              {labelsError && (
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-sm text-red-600">{labelsError}</p>
                  <button
                    type="button"
                    onClick={loadLabels}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Selector de visibilidad - solo para usuarios admin */}
          {currentUser?.role === "admin" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Visibility:
              </label>
              <select
                value={leiaPublish ? "public" : "private"}
                onChange={(e) => {
                  const isPublic = e.target.value === "public";
                  setLeiaPublish(isPublic);
                  // Si se selecciona public para la LEIA, forzar todos los recursos a public
                  if (isPublic) {
                    setBehaviourPublish(true);
                    setProblemPublish(true);
                    setPersonaPublish(true);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-[42px]"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {leiaPublish
                  ? "This LEIA will be published and visible to all users. All resources will also be public."
                  : "This LEIA will remain private and only visible to you"}
              </p>
            </div>
          )}

          {/* Alerta de recursos que se van a publicar */}
          {currentUser?.role === "admin" && leiaPublish && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <InformationCircleIcon className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800">
                    The state of the following resources will change from
                    private to public:
                  </h4>
                  <div className="mt-1 text-sm text-blue-700">
                    <ul className="list-disc list-inside space-y-1">
                      {customizations.behaviour && (
                        <li>
                          <strong>Behaviour:</strong>{" "}
                          {customizations.behaviour.name || "New behaviour"}
                        </li>
                      )}
                      {customizations.problem && (
                        <li>
                          <strong>Problem:</strong>{" "}
                          {customizations.problem.name || "New problem"}
                        </li>
                      )}
                      {customizations.persona && (
                        <li>
                          <strong>Persona:</strong>{" "}
                          {customizations.persona.name || "New persona"}
                        </li>
                      )}
                      <li>
                        <strong>LEIA:</strong>{" "}
                        {customizations.leia.name || "New LEIA"}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-900">Illustrations</h3>
            <p className="mt-1 text-sm text-gray-600">
              Choose which avatars and infographics to generate when this LEIA
              is created.
            </p>
          </div>
          <SparklesIcon className="mt-1 h-5 w-5 flex-shrink-0 text-blue-500" />
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gemini API key
            </label>
            <select
              value={illustrationsConfig.apiKeyId ?? ""}
              onChange={(e) => {
                setHasChosenIllustrationApiKey(true);
                updateIllustrationsConfig({ apiKeyId: e.target.value || null });
              }}
              disabled={isApiKeysLoading || geminiApiKeys.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-[42px] disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">
                {isApiKeysLoading
                  ? "Loading API keys..."
                  : "Select Gemini API key"}
              </option>
              {geminiApiKeys.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.description}
                  {key.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
            {apiKeysError ? (
              <p className="mt-1 text-xs text-red-600">{apiKeysError}</p>
            ) : geminiApiKeys.length === 0 && !isApiKeysLoading ? (
              <p className="mt-1 text-xs text-gray-500">
                Add a Gemini API key to generate illustrations.
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                This key is used only for the illustrations selected below.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
              <input
                type="checkbox"
                checked={illustrationsConfig.generateLeiaAvatar}
                onChange={(e) =>
                  updateIllustrationsConfig({
                    generateLeiaAvatar: e.target.checked,
                  })
                }
                disabled={illustrationsDisabled}
                className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span>
                <span className="block text-sm font-medium text-gray-700">
                  Generate LEIA avatar
                </span>
                <span className="block text-xs text-gray-500">
                  Creates the avatar for the new LEIA.
                </span>
              </span>
            </label>

            {personaIllustrationAvailable && (
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <input
                  type="checkbox"
                  checked={illustrationsConfig.generatePersonaAvatar}
                  onChange={(e) =>
                    updateIllustrationsConfig({
                      generatePersonaAvatar: e.target.checked,
                    })
                  }
                  disabled={illustrationsDisabled}
                  className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-700">
                    Generate persona avatar
                  </span>
                  <span className="block text-xs text-gray-500">
                    Available because this flow creates a new persona.
                  </span>
                </span>
              </label>
            )}

            {problemIllustrationAvailable && (
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <input
                  type="checkbox"
                  checked={illustrationsConfig.generateProblemAvatar}
                  onChange={(e) =>
                    updateIllustrationsConfig({
                      generateProblemAvatar: e.target.checked,
                    })
                  }
                  disabled={illustrationsDisabled}
                  className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-700">
                    Generate problem avatar
                  </span>
                  <span className="block text-xs text-gray-500">
                    Available because this flow creates a new problem.
                  </span>
                </span>
              </label>
            )}

            <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
              <input
                type="checkbox"
                checked={illustrationsConfig.generateInfographic}
                onChange={(e) =>
                  updateIllustrationsConfig({
                    generateInfographic: e.target.checked,
                  })
                }
                disabled={illustrationsDisabled}
                className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span>
                <span className="block text-sm font-medium text-gray-700">
                  Generate infographic
                </span>
                <span className="block text-xs text-gray-500">
                  Creates the student-facing infographic for this LEIA.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
              <input
                type="checkbox"
                checked={illustrationsConfig.generateInfographicSolution}
                onChange={(e) =>
                  updateIllustrationsConfig({
                    generateInfographicSolution: e.target.checked,
                  })
                }
                disabled={illustrationsDisabled}
                className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span>
                <span className="block text-sm font-medium text-gray-700">
                  Generate infographic with solution
                </span>
                <span className="block text-xs text-gray-500">
                  Creates the instructor version including solution guidance.
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Supervisor: una IA en segundo plano que observa la actividad del
          alumno (texto y audio) para marcar comportamientos al instructor. */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-900">Supervisor (AI background monitor)</h3>
            <p className="mt-1 text-sm text-gray-600">
              A background AI that reads what the student does during the activity
              (both text chat and Luke audio) and flags behaviours for you — e.g.
              a student trying to get the AI to write the code for them, or
              behavioural patterns in a research setting. Flags are private to the
              instructor; the student never sees them.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={supervisorConfig.enabled}
              onChange={(e) =>
                setSupervisorConfig((prev) => ({ ...prev, enabled: e.target.checked }))
              }
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {supervisorConfig.enabled && (
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OpenAI key &amp; model for the supervisor
              </label>
              {supervisorOpenaiKeys.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <select
                    value={supervisorConfig.apiKeyId ?? ""}
                    onChange={(e) =>
                      setSupervisorConfig((prev) => ({ ...prev, apiKeyId: e.target.value || null }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-[42px]"
                  >
                    <option value="">-- API key --</option>
                    {supervisorOpenaiKeys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.description}
                      </option>
                    ))}
                  </select>
                  <select
                    value={supervisorConfig.model}
                    onChange={(e) =>
                      setSupervisorConfig((prev) => ({ ...prev, model: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-[42px]"
                  >
                    <option value="">-- model --</option>
                    {supervisorOpenaiModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-sm text-amber-700">
                  No OpenAI API key available.{" "}
                  <Link to="/administration/api-keys" className="text-blue-600 underline">
                    Create one
                  </Link>{" "}
                  — the supervisor runs on OpenAI even if this LEIA uses another provider.
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                The supervisor always uses OpenAI, independent of the LEIA's own model.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What should the supervisor watch for?
              </label>
              <textarea
                value={supervisorConfig.instructions}
                onChange={(e) =>
                  setSupervisorConfig((prev) => ({ ...prev, instructions: e.target.value }))
                }
                rows={4}
                placeholder="e.g. Flag whenever the student asks the AI to write or complete the code for them instead of guiding them. Note signs of off-task conversation or frustration."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sensitivity
                </label>
                <select
                  value={supervisorConfig.sensitivity}
                  onChange={(e) =>
                    setSupervisorConfig((prev) => ({
                      ...prev,
                      sensitivity: e.target.value as "low" | "medium" | "high",
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-[42px]"
                >
                  <option value="low">Low (only clear cases)</option>
                  <option value="medium">Medium (balanced)</option>
                  <option value="high">High (even borderline)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  When it runs
                </label>
                <select
                  value={supervisorConfig.cadence}
                  onChange={(e) =>
                    setSupervisorConfig((prev) => ({
                      ...prev,
                      cadence: e.target.value as "everyN" | "onFinish",
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-[42px]"
                >
                  <option value="everyN">Every N messages (live)</option>
                  <option value="onFinish">Only at the end</option>
                </select>
              </div>
              {supervisorConfig.cadence === "everyN" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Every how many messages
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={supervisorConfig.everyN}
                    onChange={(e) =>
                      setSupervisorConfig((prev) => ({
                        ...prev,
                        everyN: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-[42px]"
                  />
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={supervisorConfig.intervene}
                  onChange={(e) =>
                    setSupervisorConfig((prev) => ({ ...prev, intervene: e.target.checked }))
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Let the supervisor nudge the student
                </span>
              </label>
              <p className="mt-1 text-xs text-gray-500">
                When enabled, the supervisor can send the student a short, gentle
                coaching message (delivered on their next turn) in addition to
                flagging you.
              </p>
              {supervisorConfig.intervene && (
                <textarea
                  value={supervisorConfig.interveneInstructions}
                  onChange={(e) =>
                    setSupervisorConfig((prev) => ({
                      ...prev,
                      interveneInstructions: e.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="e.g. If the student keeps asking for the full solution, encourage them to try writing it themselves first."
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              )}
            </div>
          </div>
        )}
      </div>

      <div
        className={`grid gap-6 ${
          isCurrentUserInstructor ? "grid-cols-2" : "grid-cols-3"
        }`}
      >
        {/* Comportamiento */}
        {customizations.behaviour && !isCurrentUserInstructor && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Behaviour</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  A new behaviour will be created with the following name:
                </label>
                <input
                  type="text"
                  value={customizations.behaviour.name}
                  onChange={(e) => {
                    setCustomizations((prev) => ({
                      ...prev,
                      behaviour: { ...prev.behaviour, name: e.target.value },
                    }));
                    // Limpiar error cuando el usuario escriba
                    if (validationErrors?.behaviour) {
                      setValidationErrors((prev) => ({
                        ...prev,
                        behaviour: undefined,
                      }));
                    }
                  }}
                  placeholder="Enter behaviour name"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-[42px] ${
                    validationErrors?.behaviour
                      ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300"
                  }`}
                />
                {validationErrors?.behaviour && (
                  <p className="mt-1 text-sm text-red-600">
                    {validationErrors.behaviour}
                  </p>
                )}
              </div>

              {/* Selector de visibilidad - solo para usuarios admin */}
              {currentUser?.role === "admin" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Visibility:
                  </label>
                  <select
                    value={behaviourPublish ? "public" : "private"}
                    onChange={(e) =>
                      setBehaviourPublish(e.target.value === "public")
                    }
                    disabled={leiaPublish}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-[42px] ${
                      leiaPublish ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {leiaPublish
                      ? "Visibility is locked to public because the LEIA is public"
                      : behaviourPublish
                        ? "This behaviour will be published and visible to all users"
                        : "This behaviour will remain private and only visible to you"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Problema */}
        {customizations.problem && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Problem</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  A new problem will be created with the following name:
                </label>
                <input
                  type="text"
                  value={customizations.problem.name}
                  onChange={(e) => {
                    setCustomizations((prev) => ({
                      ...prev,
                      problem: { ...prev.problem, name: e.target.value },
                    }));
                    // Limpiar error cuando el usuario escriba
                    if (validationErrors?.problem) {
                      setValidationErrors((prev) => ({
                        ...prev,
                        problem: undefined,
                      }));
                    }
                  }}
                  placeholder="Enter problem name"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-[42px] ${
                    validationErrors?.problem
                      ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300"
                  }`}
                />
                {validationErrors?.problem && (
                  <p className="mt-1 text-sm text-red-600">
                    {validationErrors.problem}
                  </p>
                )}
              </div>

              {/* Selector de visibilidad - solo para usuarios admin */}
              {currentUser?.role === "admin" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Visibility:
                  </label>
                  <select
                    value={problemPublish ? "public" : "private"}
                    onChange={(e) =>
                      setProblemPublish(e.target.value === "public")
                    }
                    disabled={leiaPublish}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-[42px] ${
                      leiaPublish ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {leiaPublish
                      ? "Visibility is locked to public because the LEIA is public"
                      : problemPublish
                        ? "This problem will be published and visible to all users"
                        : "This problem will remain private and only visible to you"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Persona */}
        {customizations.persona && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Persona</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  A new persona will be created with the following name:
                </label>
                <input
                  type="text"
                  value={customizations.persona.name}
                  onChange={(e) => {
                    setCustomizations((prev) => ({
                      ...prev,
                      persona: { ...prev.persona, name: e.target.value },
                    }));
                    // Limpiar error cuando el usuario escriba
                    if (validationErrors?.persona) {
                      setValidationErrors((prev) => ({
                        ...prev,
                        persona: undefined,
                      }));
                    }
                  }}
                  placeholder="Enter persona name"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-[42px] ${
                    validationErrors?.persona
                      ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300"
                  }`}
                />
                {validationErrors?.persona && (
                  <p className="mt-1 text-sm text-red-600">
                    {validationErrors.persona}
                  </p>
                )}
              </div>

              {/* Selector de visibilidad - solo para usuarios admin */}
              {currentUser?.role === "admin" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Visibility:
                  </label>
                  <select
                    value={personaPublish ? "public" : "private"}
                    onChange={(e) =>
                      setPersonaPublish(e.target.value === "public")
                    }
                    disabled={leiaPublish}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-[42px] ${
                      leiaPublish ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {leiaPublish
                      ? "Visibility is locked to public because the LEIA is public"
                      : personaPublish
                        ? "This persona will be published and visible to all users"
                        : "This persona will remain private and only visible to you"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Vista final */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-row w-full mb-4">
          <h3 className="text-lg w-full font-semibold">Final LEIA Preview</h3>
        </div>
        <div
          className={`grid gap-4 ${
            isCurrentUserInstructor ? "grid-cols-2" : "grid-cols-3"
          }`}
        >
          {!isCurrentUserInstructor && (
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">Behaviour</h4>
              <p className="text-sm text-gray-600 mb-3">
                {customizations.behaviour?.name ||
                  generatedLeia?.spec.behaviour?.metadata.name ||
                  "Not selected"}
              </p>
              {generatedLeia?.spec.behaviour ? (
                <div className="bg-white rounded border border-gray-300 overflow-hidden">
                  <Editor
                    height="150px"
                    language="json"
                    theme="vs-light"
                    value={JSON.stringify(
                      cleanObjectForPreview(
                        generatedLeia?.spec.behaviour,
                        "behaviour",
                      ),
                      null,
                      2,
                    )}
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
                      scrollbar: {
                        vertical: "auto",
                        horizontal: "auto",
                        handleMouseWheel: true,
                      },
                      overviewRulerLanes: 0,
                      hideCursorInOverviewRuler: true,
                      overviewRulerBorder: false,
                      wordWrap: "on",
                    }}
                  />
                </div>
              ) : (
                <div className="bg-gray-100 rounded p-4 text-center text-gray-500 text-sm">
                  No behaviour selected
                </div>
              )}
            </div>
          )}
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Problem</h4>
            <p className="text-sm text-gray-600 mb-3">
              {customizations.problem?.name ||
                generatedLeia?.spec.problem?.metadata.name ||
                "Not selected"}
            </p>
            {generatedLeia?.spec.problem ? (
              <div className="bg-white rounded border border-gray-300 overflow-hidden">
                <Editor
                  height="150px"
                  language="json"
                  theme="vs-light"
                  value={JSON.stringify(
                    cleanObjectForPreview(
                      generatedLeia?.spec.problem,
                      "problem",
                    ),
                    null,
                    2,
                  )}
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
                    scrollbar: {
                      vertical: "auto",
                      horizontal: "auto",
                      handleMouseWheel: true,
                    },
                    overviewRulerLanes: 0,
                    hideCursorInOverviewRuler: true,
                    overviewRulerBorder: false,
                    wordWrap: "on",
                  }}
                />
              </div>
            ) : (
              <div className="bg-gray-100 rounded p-4 text-center text-gray-500 text-sm">
                No problem selected
              </div>
            )}
          </div>
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Persona</h4>
            <p className="text-sm text-gray-600 mb-3">
              {customizations.persona?.name ||
                generatedLeia?.spec.persona?.metadata.name ||
                "Not selected"}
            </p>
            {generatedLeia?.spec.persona ? (
              <div className="bg-white rounded border border-gray-300 overflow-hidden">
                <Editor
                  height="150px"
                  language="json"
                  theme="vs-light"
                  value={JSON.stringify(
                    cleanObjectForPreview(
                      generatedLeia?.spec.persona,
                      "persona",
                    ),
                    null,
                    2,
                  )}
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
                    scrollbar: {
                      vertical: "auto",
                      horizontal: "auto",
                      handleMouseWheel: true,
                    },
                    overviewRulerLanes: 0,
                    hideCursorInOverviewRuler: true,
                    overviewRulerBorder: false,
                    wordWrap: "on",
                  }}
                />
              </div>
            ) : (
              <div className="bg-gray-100 rounded p-4 text-center text-gray-500 text-sm">
                No persona selected
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header
          title="Design"
          description="Create your own LEIAs and test them!"
        />

        {/* Loading Content */}
        <div className="flex-1 container mx-auto px-6 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Loading resources...
              </h3>
              <p className="text-gray-600 text-center">
                Loading personas, problems, and behaviours from the API...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header
          title="Design"
          description="Create your own LEIAs and test them!"
        />

        {/* Error Content */}
        <div className="flex-1 container mx-auto px-6 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="bg-red-100 rounded-full p-3 mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Error Loading Data
              </h3>
              <p className="text-gray-600 text-center mb-6">{error}</p>
              <button
                onClick={loadData}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
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
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header
        title="Design"
        description="Create your own LEIAs and test them!"
        
      />

      {/* Main Content */}
      <ToastContainer />
      <div className="flex-1 container mx-auto px-6 py-8">
        <div id="create-step-indicator">{renderStepIndicator()}</div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8">
          <button
            onClick={handlePrevStep}
            disabled={currentStep === 1}
            id= "create-previous-button"
            className={`px-6 py-2 rounded-lg transition-colors ${
              currentStep === 1
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-gray-600 text-white hover:bg-gray-700"
            }`}
          >
            Previous
          </button>

          <div className="flex items-center space-x-4">
            {currentStep === 1 && (
              <div className="text-sm text-gray-500">
                {isStep1Complete
                  ? "✓ All elements selected"
                  : "Missing elements to select"}
              </div>
            )}
            {currentStep === 2 && (
              <div className="text-sm text-gray-500">
                ✓ You can edit resources or continue
              </div>
            )}
            {currentStep === 3 && (
              <div className="text-sm text-gray-500">
                {isStep3Complete
                  ? "✓ Customization complete"
                  : "Customize names for edited resources"}
              </div>
            )}
          </div>

          <button
            id="create-next-button"
            onClick={handleNextStep}
            aria-busy={currentStep === 3 && isFinishingLeia}
            disabled={
              (currentStep === 1 && !isStep1Complete) ||
              (currentStep === 2 && !isStep2Complete) ||
              (currentStep === 3 && (!isStep3Complete || isFinishingLeia))
            }
            className={`px-6 py-2 rounded-lg transition-colors inline-flex items-center justify-center gap-2 min-w-[96px] ${
              (currentStep === 1 && !isStep1Complete) ||
              (currentStep === 2 && !isStep2Complete) ||
              (currentStep === 3 && (!isStep3Complete || isFinishingLeia))
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {currentStep === 3 && isFinishingLeia ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Finish
              </>
            ) : currentStep === 3 ? (
              "Finish"
            ) : (
              "Next"
            )}
          </button>
        </div>
      </div>

      {/* Modal de eliminación de recursos */}
      <DeleteResourceModal
        isOpen={deleteModal.isOpen}
        resource={deleteModal.resource}
        resourceType={deleteModal.resourceType}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteResource}
        isDeleting={isDeleting}
        error={deleteError}
      />  
      {showCreateLabelModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateLabelModal(false);
              setCreateLabelError(null);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Create New Label
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Add a label and reuse it in your LEIAs.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder=""
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Background colour
                    </label>
                    <input
                      type="color"
                      value={newLabelColor}
                      onChange={(e) => setNewLabelColor(e.target.value)}
                      className="h-10 w-full border border-gray-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Text colour
                    </label>
                    <input
                      type="color"
                      value={newLabelSecondaryColor}
                      onChange={(e) => setNewLabelSecondaryColor(e.target.value)}
                      className="h-10 w-full border border-gray-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <label className="block text-sm font-medium text-gray-700 mb-1 ">
                    Preview
                  </label>
                  <span
                                className="px-2 py-0.5 text-xs font-medium rounded-full border border-gray-200 "
                                style={{
                                  backgroundColor: newLabelColor || "#2563eb",
                                  color: newLabelSecondaryColor || "#bfdbfe",
                                }}
                                title={`Label: ${newLabelName}`}
                              >
                                {newLabelName || "Preview"}
                              </span>
                </div>
                {currentUser?.role === "admin" && (
                  <div>
                    <p className="block text-sm font-medium text-gray-700 mb-2">
                      Visibility
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsLabelGlobal((prev) => !prev)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                        isLabelGlobal
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span>{isLabelGlobal ? "Global" : "Private"}</span>
                      <span
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          isLabelGlobal ? "bg-blue-600" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                            isLabelGlobal ? "translate-x-5" : "translate-x-1"
                          }`}
                        />
                      </span>
                    </button>
                  </div>
                )}

                {createLabelError && (
                  <p className="text-sm text-red-600">{createLabelError}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 bg-gray-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => {
                  setShowCreateLabelModal(false);
                  setCreateLabelError(null);
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateLabel}
                disabled={creatingLabel}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                Save label for Finish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de generación de behaviours con IA */}
      {showGenerateBehaviourModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <SparklesIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Generate Similar Behaviour
                  </h3>
                  <p className="text-sm text-gray-500">
                    Using "{leiaConfig.behaviour?.metadata.name}" as template
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Behaviour Subject *
                  </label>
                  <input
                    type="text"
                    value={generateBehaviourSubject}
                    onChange={(e) => setGenerateBehaviourSubject(e.target.value)}
                    placeholder="e.g., Senior Librarian"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Details (optional)
                  </label>
                  <textarea
                    value={generateBehaviourDetails}
                    onChange={(e) => setGenerateBehaviourDetails(e.target.value)}
                    placeholder="e.g., Ask clarifying questions and keep a constructive interview tone."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                  />
                </div>

                {generateBehaviourError && (
                  <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                    {generateBehaviourError}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 bg-gray-50 rounded-b-xl">
              <button
                onClick={closeGenerateBehaviourModal}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateBehaviour}
                disabled={!generateBehaviourSubject.trim() || isGeneratingBehaviour}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isGeneratingBehaviour ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Generating...
                  </>
                ) : (
                  "Generate"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
        
      {(currentUser?.role === "admin" || currentUser?.role === "advanced") && (
        <AddLeiaToAnActivity
          isOpen={showAddToActivityModal}
          selectedLeia={createdLeiaResource}
          onClose={() => {setShowAddToActivityModal(false); navigate("/leias")}}
          onSuccess={() => {
            setShowAddToActivityModal(false);
            navigate("/users/me/activities");
          }}
        />
      )}
      {(currentUser?.role === "admin" || currentUser?.role === "advanced") && (
        <ActivityReplicationModal
          isOpen={showActivityReplicationModal}
          name={nameActivityReplication}
          onNameChange={setNameActivityReplication}
          onConfirm={() => handleQuickReplication(createdLeiaResource)}
          onClose={closeActivityReplicationModal}
            />
      )}
      {/* Modal mostrado despues de crear la LEIA*/}
      {showFinishModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                LEIA created successfully
              </h3>
              <p className="text-sm text-gray-600">
                "{createdLeiaName}" was created successfully.
              </p>
              <p className="text-sm text-gray-600 mt-2">
                You have created a LEIA. Now you can create the activity and its
            replication directly, add it to an existing activity, or return to
            the home page.
              </p>
            </div>

            <div className="px-6 py-4 bg-gray-50 rounded-b-xl">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowFinishModal(false);
                    setShowFinishActionsMenu(false);
                    navigate("/leias");
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Go to Home Page
                </button>
                <button
                  onClick={() => {
                    setShowFinishModal(false);
                    setShowFinishActionsMenu(false);
                    handleQuickReplication(createdLeiaResource);
                  }}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Quick Replication
                </button>
                <div className="relative finish-actions-menu">
                  <button
                    type="button"
                    onClick={() => setShowFinishActionsMenu((open) => !open)}
                    className="h-full px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
                    title="More actions"
                    aria-label="More actions"
                    aria-expanded={showFinishActionsMenu}
                    aria-haspopup="menu"
                  >
                    <EllipsisHorizontalIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
              {showFinishActionsMenu && (
                <div className="finish-actions-menu mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFinishActionsMenu(false);
                      setShowFinishModal(false);
                      setShowAddToActivityModal(true);
                    }}
                    className="w-full rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                    role="menuitem"
                  >
                    Add to Activity
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de generación de behaviours con IA */}
      {showGenerateBehaviourModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <SparklesIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Generate Similar Behaviour
                  </h3>
                  <p className="text-sm text-gray-500">
                    Using "{leiaConfig.behaviour?.metadata.name}" as template
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Behaviour Subject *
                  </label>
                  <input
                    type="text"
                    value={generateBehaviourSubject}
                    onChange={(e) => setGenerateBehaviourSubject(e.target.value)}
                    placeholder="e.g., Senior Librarian"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Details (optional)
                  </label>
                  <textarea
                    value={generateBehaviourDetails}
                    onChange={(e) => setGenerateBehaviourDetails(e.target.value)}
                    placeholder="e.g., Ask clarifying questions and keep a constructive interview tone."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                  />
                </div>

                {generateBehaviourError && (
                  <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                    {generateBehaviourError}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 bg-gray-50 rounded-b-xl">
              <button
                onClick={closeGenerateBehaviourModal}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateBehaviour}
                disabled={!generateBehaviourSubject.trim() || isGeneratingBehaviour}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isGeneratingBehaviour ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Generating...
                  </>
                ) : (
                  "Generate"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de generación de problemas con IA */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <SparklesIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Generate Similar Problem
                  </h3>
                  <p className="text-sm text-gray-500">
                    Using "{leiaConfig.problem?.metadata.name}" as template
                  </p>
                </div>
              </div>
              <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
                <p className="text-xs text-purple-800 leading-relaxed">
                  If present in the base template, the generator will also adapt{" "}
                  <code>evaluationPrompt</code>, <code>extends</code>, and{" "}
                  <code>overrides</code>.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Subject *
                  </label>
                  <input
                    type="text"
                    value={generateSubject}
                    onChange={(e) => setGenerateSubject(e.target.value)}
                    placeholder="p. ej., Sistema de biblioteca"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Details (optional)
                  </label>
                  <textarea
                    value={generateDetails}
                    onChange={(e) => setGenerateDetails(e.target.value)}
                    placeholder="p. ej., catálogo, préstamos, reservas, cuentas de socios y notificaciones de vencimiento."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                  />
                </div>

                {generateError && (
                  <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                    {generateError}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 bg-gray-50 rounded-b-xl">
              <button
                onClick={closeGenerateProblemModal}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateProblem}
                disabled={!generateSubject.trim() || isGenerating}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Generating...
                  </>
                ) : (
                  "Generate"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
