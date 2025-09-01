import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Editor } from "@monaco-editor/react";
import { SelectionColumn } from "../components/shared/SelectionColumn";
import type { Persona, Behavior, Problem } from "../models/Leia";
import api from "../lib/axios";
import { generateLeia } from "../lib/leia";

interface LeiaConfig {
  persona: Persona | null;
  problem: Problem | null;
  behaviour: Behavior | null;
}

interface Leia {
  spec: {
    persona: Persona;
    problem: Problem;
    behaviour: Behavior;
  };
}

interface NavigationState {
  preset?: {
    persona: Persona | null;
    problem: Problem | null;
    behaviour: Behavior | null;
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
  const [behaviours, setBehaviours] = useState<Behavior[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingLeia, setTestingLeia] = useState(false);

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
      const leia = generateLeia(
        leiaConfig.persona,
        leiaConfig.behaviour,
        leiaConfig.problem
      );
      setGeneratedLeia(leia as Leia);
    }
  }, [currentStep, leiaConfig]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Hacer las peticiones en paralelo
      const [personasResponse, problemsResponse, behavioursResponse] =
        await Promise.all([
          api.get<Persona[]>("/api/v1/personas"),
          api.get<Problem[]>("/api/v1/problems"),
          api.get<Behavior[]>("/api/v1/behaviours"),
        ]);

      setPersonas(personasResponse.data);
      setProblems(problemsResponse.data);
      setBehaviours(behavioursResponse.data);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load data from API");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (
    type: keyof LeiaConfig,
    item: Persona | Behavior | Problem
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
      localStorage.setItem("leiaConfig", JSON.stringify(leiaConfig));
      navigate(`/chat/${sessionId}`, {
        state: {
          save: {
            currentStep,
            leiaConfig,
            leiaConfigSnapShot,
            customizations,
          },
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
          newResource.metadata.name =
            customizations[key as keyof LeiaConfig]?.name;
          try {
            const response = await api.post(`/api/v1/${key}s`, newResource);
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
        const response = await api.post("/api/v1/leias", leia);
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
  const isStep2Complete = true;
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
          Choose a persona, problem, and behavior for your LEIA
        </p>
      </div>

      {/* Show loading state for individual columns if data is still loading */}
      {loading && (
        <div className="grid grid-cols-3 gap-6">
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
        <div className="grid grid-cols-3 gap-6">
          {/* Columna 1: Behaviour */}
          <div
            className={`h-full ${
              leiaConfig.behaviour
                ? "ring-2 ring-green-500 ring-opacity-50"
                : ""
            }`}
          >
            <SelectionColumn
              title="Behavior"
              items={behaviours}
              selectedItem={leiaConfig.behaviour}
              onSelect={(item) => handleSelect("behaviour", item)}
              onCreateNew={() => null}
              placeholder="Search behaviors..."
            />
          </div>

          {/* Columna 2: Problem */}
          <div
            className={`h-full ${
              leiaConfig.problem ? "ring-2 ring-green-500 ring-opacity-50" : ""
            }`}
          >
            <SelectionColumn
              title="Problem"
              items={problems}
              selectedItem={leiaConfig.problem}
              onSelect={(item) => handleSelect("problem", item)}
              onCreateNew={() => null}
              placeholder="Search problems..."
            />
          </div>

          {/* Columna 3: Persona */}
          <div
            className={`h-full ${
              leiaConfig.persona ? "ring-2 ring-green-500 ring-opacity-50" : ""
            }`}
          >
            <SelectionColumn
              title="Persona"
              items={personas}
              selectedItem={leiaConfig.persona}
              onSelect={(item) => handleSelect("persona", item)}
              onCreateNew={() => null}
              placeholder="Search personas..."
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Step 2: Edit</h2>
        <p className="text-gray-600">
          Modify any of the resources and see changes in real-time
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Columna 1: Behaviour */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                Behavior
                {leiaConfig.behaviour?.edited && (
                  <span className="text-xs text-gray-500 font-normal ml-2">
                    (edited)
                  </span>
                )}
              </h3>
            </div>
            {leiaConfig.behaviour ? (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
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
                            structuredClone(leiaConfigSnapShot?.behaviour) ||
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
                        resource: "behaviour",
                        content: JSON.stringify(
                          leiaConfig.behaviour?.spec,
                          null,
                          2
                        ),
                        apiVersion: leiaConfig.behaviour?.apiVersion || "v1",
                      })
                    }
                    className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm ${
                      leiaConfig.behaviour?.edited ? "flex-1" : "w-full"
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

        {/* Columna 2: Problem */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                Problem
                {leiaConfig.problem?.edited && (
                  <span className="text-xs text-gray-500 font-normal ml-2">
                    (edited)
                  </span>
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
                        content: JSON.stringify(
                          leiaConfig.problem?.spec,
                          null,
                          2
                        ),
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
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                Persona
                {leiaConfig.persona?.edited && (
                  <span className="text-xs text-gray-500 font-normal ml-2">
                    (edited)
                  </span>
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
                        content: JSON.stringify(
                          leiaConfig.persona?.spec,
                          null,
                          2
                        ),
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

      {/* Editor Monaco */}
      {editingResource.content && editingResource.resource && (
        <div className="overflow-hidden transition-all duration-500 ease-in-out animate-in slide-in-from-top-5">
          <div className="bg-white rounded-lg border-2 border-gray-200 p-6 shadow-sm">
            <div className="space-y-4">
              {/* Header with title and API version selector */}
              <div className="flex justify-between items-center pb-4">
                <h4 className="text-lg font-semibold text-gray-900">
                  Edit{" "}
                  {editingResource.resource?.charAt(0).toUpperCase() +
                    editingResource.resource?.slice(1)}{" "}
                  Spec
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
          <button
            onClick={handleTestLeia}
            disabled={testingLeia}
            className={`px-6 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              testingLeia
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700"
            } text-white`}
          >
            {testingLeia ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Testing...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                Test LEIA
              </>
            )}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Behavior</h4>
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
                No behavior selected
              </div>
            )}
          </div>
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
          Update the fields of the required resources, test your creation and
          complete the process
        </p>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900">LEIA</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-small text-gray-700 mb-2">
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
              placeholder={"leia-name"}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
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
        </div>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {/* Comportamiento */}
        {customizations.behaviour && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900">Behavior</h3>
            <div>
              <label className="block text-sm font-small text-gray-700 mb-2">
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
                placeholder={"resource-name"}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
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
          </div>
        )}

        {/* Problema */}
        {customizations.problem && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Problem</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-small text-gray-700 mb-2">
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
                  placeholder={"resource-name"}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
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
            </div>
          </div>
        )}

        {/* Persona */}
        {customizations.persona && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Persona</h3>

            <div>
              <label className="block text-sm font-small text-gray-700 mb-2">
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
                placeholder={"resource-name"}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
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
          </div>
        )}
      </div>

      {/* Vista final */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-row w-full mb-4">
          <h3 className="text-lg w-full font-semibold">Final LEIA Preview</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Behavior</h4>
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
                No behavior selected
              </div>
            )}
          </div>
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
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Create LEIA
                </h1>
                <p className="mt-2 text-gray-600">
                  Create your own LEIA and test it!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Content */}
        <div className="flex-1 container mx-auto px-6 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Loading resources...
              </h3>
              <p className="text-gray-600 text-center">
                Loading personas, problems, and behaviors from the API...
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
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Create LEIA
                </h1>
                <p className="mt-2 text-gray-600">
                  Create your own LEIA and test it!
                </p>
              </div>
            </div>
          </div>
        </div>

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
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Create LEIA
              </h1>
              <p className="mt-2 text-gray-600">
                Create your own LEIA and test it!
              </p>
            </div>
          </div>
        </div>
      </div>

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
