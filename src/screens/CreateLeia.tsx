import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Editor } from "@monaco-editor/react";
import {
  LightBulbIcon,
  CpuChipIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { SelectionColumn } from "../components/shared/SelectionColumn";
import { Header } from "../components/shared/Header";
import { ResourceEditor } from "../components/ResourceEditor";
import { useAuth } from "../context";
import type { Persona, Behaviour, Problem } from "../models/Leia";
import api from "../lib/axios";
import { generateLeia } from "../lib/leia";

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
  save?: {
    currentStep: WizardStep;
    leiaConfig: LeiaConfig;
    leiaConfigSnapShot: LeiaConfig | null;
    customizations: {
      persona?: { name: string; version?: string };
      problem?: { name: string; version?: string };
      behaviour?: { name: string; version?: string };
      leia: { name: string; version?: string };
    };
  };
}

type WizardStep = 1 | 2 | 3;

export const CreateLeia: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<Error | null>(null);
  const [testingLeia, setTestingLeia] = useState(false);

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
    "all" | "requirements-elicitation" | "game"
  >("all");
  const [behaviourProcess, setBehaviourProcess] = useState<
    "all" | "requirements-elicitation" | "game"
  >("all");

  // Estado para controlar la visibilidad/publicación de la LEIA
  const [leiaPublish, setLeiaPublish] = useState<boolean>(true);

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

  // Cargar datos al montar el componente
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aplicar preset si viene desde navegación
  useEffect(() => {
    const navigationState = location.state as NavigationState;
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
  }, [location.state]);

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
        }
      );
      setLeiaConfigSnapShot(savedState.leiaConfigSnapShot || null);
      setCustomizations(
        savedState.customizations || { leia: { name: "", version: "1.0.0" } }
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
          leiaConfig.problem
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
    visibility: "all" | "public" | "private" = "all"
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
    process: "all" | "requirements-elicitation" | "game" = "all"
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
    process: "all" | "requirements-elicitation" | "game" = "all"
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

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Hacer las peticiones en paralelo con los filtros de visibilidad y process actuales
      await Promise.all([
        loadPersonas(personaVisibility),
        loadProblems(problemVisibility, problemProcess),
        loadBehaviours(behaviourVisibility, behaviourProcess),
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
    visibility: "all" | "private" | "public"
  ) => {
    setPersonaVisibility(visibility);
    loadPersonas(visibility); // Solo recargar personas
  };

  const handleProblemVisibilityChange = (
    visibility: "all" | "private" | "public"
  ) => {
    setProblemVisibility(visibility);
    loadProblems(visibility, problemProcess); // Solo recargar problemas
  };

  const handleBehaviourVisibilityChange = (
    visibility: "all" | "private" | "public"
  ) => {
    setBehaviourVisibility(visibility);
    loadBehaviours(visibility, behaviourProcess); // Solo recargar behaviours
  };

  // Funciones para manejar cambios de process
  const handleProblemProcessChange = (
    process: "all" | "requirements-elicitation" | "game"
  ) => {
    setProblemProcess(process);
    loadProblems(problemVisibility, process); // Solo recargar problems
  };

  const handleBehaviourProcessChange = (
    process: "all" | "requirements-elicitation" | "game"
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
    value: "all" | "requirements-elicitation" | "game";
    onChange: (value: "all" | "requirements-elicitation" | "game") => void;
  }> = ({ value, onChange }) => (
    <div className="flex flex-col items-center">
      <label className="text-xs text-gray-600 mb-1">Process</label>
      <select
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value as "all" | "requirements-elicitation" | "game"
          )
        }
        className="px-2 py-1 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ease-in-out w-auto min-w-[60px] max-w-[140px]"
      >
        <option value="all">All</option>
        <option value="requirements-elicitation">Req. Elicitation</option>
        <option value="game">Game</option>
      </select>
    </div>
  );

  const handleSelect = (
    type: keyof LeiaConfig,
    item: Persona | Behaviour | Problem
  ) => {
    setLeiaConfig((prev) => ({
      ...prev,
      [type]: item,
    }));
  };

  const handleEditResource = (
    resource: keyof LeiaConfig,
    content: string,
    apiVersion: string
  ) => {
    try {
      const parsedSpec = JSON.parse(content);

      setLeiaConfig((prev) => ({
        ...prev,
        [resource]: {
          ...prev[resource],
          spec: parsedSpec,
          apiVersion: apiVersion,
          edited: true,
        },
      }));

      setEditingResource({ resource: null, content: null, apiVersion: "v1" });
    } catch (error) {
      console.error("Error parsing JSON content:", error);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    setEditingResource((prev) => ({
      ...prev,
      content: value || "",
    }));
  };

  const handleApiVersionChange = (value: string) => {
    setEditingResource((prev) => ({
      ...prev,
      apiVersion: value,
    }));
  };

  const cleanObjectForPreview = (
    obj: unknown,
    resource?: keyof LeiaConfig
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

  const handleTestLeia = async () => {
    if (!generatedLeia) {
      console.error("No generated LEIA available");
      return;
    }

    try {
      setTestingLeia(true);
      const response = await api.post("/api/v1/runner/initialize", {
        ...generatedLeia,
      });
      const { sessionId } = response.data;
      navigate(`/chat/${sessionId}`, {
        state: {
          save: {
            currentStep,
            leiaConfig,
            leiaConfigSnapShot,
            customizations,
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
    if (currentStep === 3 && isStep3Complete) {
      const errors = {} as Record<string, string>;

      for (const [key, value] of Object.entries(customizations)) {
        if (value) {
          if (!value.name?.trim()) {
            errors[key] = "Name is required";
            continue;
          }

          try {
            const response = await api.get(
              `/api/v1/${key}s/exists/${value.name}`
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

      const leia = {
        apiVersion: "v1",
        metadata: {
          name: customizations.leia.name,
          version: "1.0.0",
        },
        spec: {} as Record<string, any>,
      };

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
              newResource
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
      try {
        // Construir la URL con el query parameter publish
        const publishParam =
          currentUser?.role === "admin" ? `?publish=${leiaPublish}` : "";
        const response = await api.post(`/api/v1/leias${publishParam}`, leia);
        console.log("LEIA created successfully:", response.data);
        navigate("/leias");
      } catch (error) {
        console.error("Error creating LEIA:", error);
        setError("Failed to create LEIA");
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
      }
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
        <div className="grid grid-cols-3">
          {/* Columna 1: Behaviour */}
          <div className="h-full">
            <SelectionColumn
              title="Behaviour"
              items={behaviours}
              selectedItem={leiaConfig.behaviour}
              onSelect={(item) => handleSelect("behaviour", item)}
              placeholder="Search behaviours..."
              rightHeaderElement={
                <div className="flex gap-3 items-start">
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
              rightHeaderElement={
                <div className="flex gap-3 items-start">
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

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Step 2: Edit</h2>
        <p className="text-gray-600">
          Modify any of the resources, see changes in real-time and test your
          creation
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6 h-full">
        {/* Columna 1: Behaviour */}
        <div className="space-y-4 flex flex-col">
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex-1 flex flex-col">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
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
                                  leiaConfigSnapShot?.behaviour
                                ) || null,
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
                            resource: "behaviour",
                            content: JSON.stringify(
                              leiaConfig.behaviour?.spec,
                              null,
                              2
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
              <h3 className="font-semibold text-gray-900 mb-3">
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
                    onClick={() =>
                      setEditingResource({
                        resource: "problem",
                        content: null,
                        apiVersion: leiaConfig.problem?.apiVersion || "v1",
                      })
                    }
                    className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm ${
                      leiaConfig.problem?.edited ? "flex-1" : "w-full"
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
              <h3 className="font-semibold text-gray-900 mb-3">
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
      {editingResource.resource &&
        (editingResource.resource === "persona" ||
          editingResource.resource === "problem") && (
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

      {/* Fallback Editor Monaco for Behaviour */}
      {editingResource.content && editingResource.resource === "behaviour" && (
        <div className="overflow-hidden transition-all duration-500 ease-in-out animate-in slide-in-from-top-5">
          <div className="bg-white rounded-lg border-2 border-gray-200 p-6 shadow-sm">
            <div className="space-y-4">
              {/* Header with title and API version selector */}
              <div className="flex justify-between items-center pb-4">
                <h4 className="text-lg font-semibold text-gray-900">
                  Edit Behaviour Spec
                </h4>
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">
                    API Version:
                  </label>
                  <select
                    value={editingResource.apiVersion}
                    onChange={(e) => handleApiVersionChange(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="v1">v1</option>
                  </select>
                </div>
              </div>

              {/* Editor container with rounded borders */}
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <Editor
                  height="300px"
                  language="json"
                  theme="vs-light"
                  value={editingResource.content}
                  onChange={handleEditorChange}
                  options={{
                    readOnly: false,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 12,
                    lineNumbers: "on",
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

              {/* Buttons container */}
              <div className="flex justify-end space-x-3 pt-2">
                {/* Cancel button */}
                <button
                  onClick={() =>
                    setEditingResource({
                      resource: null,
                      content: null,
                      apiVersion: "v1",
                    })
                  }
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors text-sm"
                >
                  Cancel
                </button>
                {/* Save button */}
                <button
                  onClick={() => {
                    if (editingResource.resource && editingResource.content) {
                      handleEditResource(
                        editingResource.resource,
                        editingResource.content,
                        editingResource.apiVersion
                      );
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
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
              <button
                onClick={handleTestLeia}
                className="group relative px-2.5 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-all duration-300 flex items-center gap-2 overflow-hidden w-10 hover:w-22"
              >
                <LightBulbIcon className="w-5 h-5 flex-shrink-0" />
                <span className="absolute left-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                  Try
                </span>
              </button>
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
                        2
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
                      2
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
                      2
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

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Step 3: Create your LEIA
        </h2>
        <p className="text-gray-600">
          Update the fields of the required resources and complete the process
        </p>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
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
                        "behaviour"
                      ),
                      null,
                      2
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
                      "problem"
                    ),
                    null,
                    2
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
                      "persona"
                    ),
                    null,
                    2
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
      <div className="flex-1 container mx-auto px-6 py-8">
        {renderStepIndicator()}

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
            onClick={handleNextStep}
            disabled={
              (currentStep === 1 && !isStep1Complete) ||
              (currentStep === 2 && !isStep2Complete) ||
              (currentStep === 3 && !isStep3Complete)
            }
            className={`px-6 py-2 rounded-lg transition-colors ${
              (currentStep === 1 && !isStep1Complete) ||
              (currentStep === 2 && !isStep2Complete) ||
              (currentStep === 3 && !isStep3Complete)
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {currentStep === 3 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
};
