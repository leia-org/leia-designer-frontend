import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

type WizardStep = 1 | 2 | 3;

export const CreateLeia: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [leiaConfig, setLeiaConfig] = useState<LeiaConfig>({
    persona: null,
    problem: null,
    behaviour: null,
  });
  const [generatedLeia, setGeneratedLeia] = useState<Leia | null>(null);

  const [customizations, setCustomizations] = useState<{
    persona?: { name: string };
    problem?: { name: string };
    behaviour?: { name: string };
  }>({});

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
  }>({
    resource: null,
    content: null,
  });

  // Cargar datos al montar el componente
  useEffect(() => {
    loadData();
  }, []);

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

  const handleEditResource = (resource: keyof LeiaConfig, content: string) => {
    try {
      const parsedContent = JSON.parse(content);
      parsedContent.edited = true;

      setLeiaConfig((prev) => ({
        ...prev,
        [resource]: parsedContent,
      }));

      setEditingResource({ resource: null, content: null });
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
      navigate(`/chat/${sessionId}`);
    } catch (error) {
      console.error("Error initializing LEIA:", error);
      setError("Failed to initialize LEIA session");
    } finally {
      setTestingLeia(false);
    }
  };

  const handleNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep((currentStep + 1) as WizardStep);
    }
    if (currentStep === 3) {
      setCustomizations({
        persona: leiaConfig.persona?.edited
          ? { name: leiaConfig.persona.metadata.name }
          : undefined,
        problem: leiaConfig.problem?.edited
          ? { name: leiaConfig.problem.metadata.name }
          : undefined,
        behaviour: leiaConfig.behaviour?.edited
          ? { name: leiaConfig.behaviour.metadata.name }
          : undefined,
      });
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
  const isStep3Complete = Object.values(customizations).some((c) => c.name);

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
            <h3 className="font-semibold text-gray-900 mb-3">Behavior</h3>
            {leiaConfig.behaviour ? (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-sm font-medium">
                    {leiaConfig.behaviour.metadata.name}
                  </p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-3">
                    {leiaConfig.behaviour.spec.description}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setEditingResource({
                      resource: "behaviour",
                      content: JSON.stringify(leiaConfig.behaviour, null, 2),
                    })
                  }
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Edit Behavior
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Not selected</p>
            )}
          </div>
        </div>

        {/* Columna 2: Problem */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Problem</h3>
            {leiaConfig.problem ? (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-sm font-medium">
                    {leiaConfig.problem.metadata.name}
                  </p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-3">
                    {leiaConfig.problem.spec.description}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setEditingResource({
                      resource: "problem",
                      content: JSON.stringify(leiaConfig.problem, null, 2),
                    })
                  }
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Edit Problem
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Not selected</p>
            )}
          </div>
        </div>

        {/* Columna 3: Persona */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Persona</h3>
            {leiaConfig.persona ? (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-sm font-medium">
                    {leiaConfig.persona.metadata.name}
                  </p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-3">
                    {leiaConfig.persona.spec.description}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setEditingResource({
                      resource: "persona",
                      content: JSON.stringify(leiaConfig.persona, null, 2),
                    })
                  }
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Edit Persona
                </button>
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
          <div className="space-y-4 transform transition-all duration-300">
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
            {/* Buttons container */}
            <div className="flex justify-end space-x-3 pt-2">
              {/* Cancel button */}
              <button
                onClick={() =>
                  setEditingResource({ resource: null, content: null })
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
                      editingResource.content
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
      )}

      {/* Vista previa en tiempo real */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Real-time Preview</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Behavior</h4>
            <p className="text-sm text-gray-600 mb-3">
              {leiaConfig.behaviour?.metadata.name || "Not selected"}
            </p>
            {leiaConfig.behaviour ? (
              <div className="bg-white rounded border border-gray-300 overflow-hidden">
                <Editor
                  height="150px"
                  language="json"
                  theme="vs-light"
                  value={JSON.stringify(generatedLeia?.spec.behaviour, null, 2)}
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
              {leiaConfig.problem?.metadata.name || "Not selected"}
            </p>
            {leiaConfig.problem ? (
              <div className="bg-white rounded border border-gray-300 overflow-hidden">
                <Editor
                  height="150px"
                  language="json"
                  theme="vs-light"
                  value={JSON.stringify(generatedLeia?.spec.problem, null, 2)}
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
              {leiaConfig.persona?.spec.fullName ||
                leiaConfig.persona?.metadata.name ||
                "Not selected"}
            </p>
            {leiaConfig.persona ? (
              <div className="bg-white rounded border border-gray-300 overflow-hidden">
                <Editor
                  height="150px"
                  language="json"
                  theme="vs-light"
                  value={JSON.stringify(generatedLeia?.spec.persona, null, 2)}
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

      <div className="grid grid-cols-3 gap-6">
        {/* Comportamiento */}
        {customizations.behaviour && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Behavior</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Name Required
                </label>
                <input
                  type="text"
                  value={customizations.behaviour.name}
                  onChange={(e) =>
                    setCustomizations((prev) => ({
                      ...prev,
                      behaviour: { ...prev.behaviour, name: e.target.value },
                    }))
                  }
                  placeholder={"resource-name"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
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
                  New Name Required
                </label>
                <input
                  type="text"
                  value={customizations.problem.name}
                  onChange={(e) =>
                    setCustomizations((prev) => ({
                      ...prev,
                      problem: { ...prev.problem, name: e.target.value },
                    }))
                  }
                  placeholder={"resource-name"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
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
                  New Name Required
                </label>
                <input
                  type="text"
                  value={customizations.persona.name}
                  onChange={(e) =>
                    setCustomizations((prev) => ({
                      ...prev,
                      persona: { ...prev.persona, name: e.target.value },
                    }))
                  }
                  placeholder={"resource-name"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vista final */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-row w-full mb-4">
          <h3 className="text-lg w-full font-semibold">Final LEIA Preview</h3>
          <div className="flex justify-end w-full">
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
                  value={JSON.stringify(generatedLeia?.spec.behaviour, null, 2)}
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
                  value={JSON.stringify(generatedLeia?.spec.problem, null, 2)}
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
                generatedLeia?.spec.persona?.spec.fullName ||
                generatedLeia?.spec.persona?.metadata.name ||
                "Not selected"}
            </p>
            {generatedLeia?.spec.persona ? (
              <div className="bg-white rounded border border-gray-300 overflow-hidden">
                <Editor
                  height="150px"
                  language="json"
                  theme="vs-light"
                  value={JSON.stringify(generatedLeia?.spec.persona, null, 2)}
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
              currentStep === 3
            }
            className={`px-6 py-2 rounded-lg transition-colors ${
              (currentStep === 1 && !isStep1Complete) ||
              (currentStep === 2 && !isStep2Complete) ||
              currentStep === 3
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
