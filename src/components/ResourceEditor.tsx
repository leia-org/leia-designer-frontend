import React, { useState, useEffect } from "react";
import { Editor } from "@monaco-editor/react";
import * as Tabs from "@radix-ui/react-tabs";
import type { Persona, Problem } from "../models/Leia";

type ResourceType = "persona" | "problem";

interface ResourceEditorProps {
  resourceType: ResourceType;
  initialData?: Partial<Persona> | Partial<Problem>;
  apiVersion?: string;
  onSave: (data: any, apiVersion: string) => void;
  onCancel: () => void;
}

export const ResourceEditor: React.FC<ResourceEditorProps> = ({
  resourceType,
  initialData,
  apiVersion = "v1",
  onSave,
  onCancel,
}) => {
  const [currentApiVersion, setCurrentApiVersion] = useState(apiVersion);
  const [activeTab, setActiveTab] = useState<"visual" | "code">("visual");
  const [jsonContent, setJsonContent] = useState("");
  const [visualData, setVisualData] = useState<any>({});
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Inicializar datos
  useEffect(() => {
    if (initialData?.spec) {
      setVisualData(initialData.spec);
      setJsonContent(JSON.stringify(initialData.spec, null, 2));
    } else {
      const emptySpec =
        resourceType === "persona"
          ? {
              fullName: "",
              firstName: "",
              description: "",
              personality: "",
              subjectPronoum: "",
              objectPronoum: "",
              possesivePronoum: "",
              possesiveAdjective: "",
            }
          : {
              description: "",
              personaBackground: "",
              details: "",
              solution: "",
              solutionFormat: "text",
              process: [],
              extends: {},
              overrides: {},
              constrainedTo: {},
            };
      setVisualData(emptySpec);
      setJsonContent(JSON.stringify(emptySpec, null, 2));
    }
  }, [initialData, resourceType]);

  // Sincronizar de visual a código
  useEffect(() => {
    if (activeTab === "code") {
      setJsonContent(JSON.stringify(visualData, null, 2));
    }
  }, [activeTab, visualData]);

  const handleVisualChange = (field: string, value: any) => {
    setVisualData((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleJsonChange = (value: string | undefined) => {
    setJsonContent(value || "");
    setJsonError(null);

    try {
      if (value) {
        const parsed = JSON.parse(value);
        setVisualData(parsed);
      }
    } catch (err) {
      setJsonError("Invalid JSON format");
    }
  };

  const handleSave = () => {
    if (activeTab === "code") {
      try {
        const parsed = JSON.parse(jsonContent);
        onSave(parsed, currentApiVersion);
      } catch (err) {
        setJsonError("Cannot save: Invalid JSON format");
        return;
      }
    } else {
      onSave(visualData, currentApiVersion);
    }
  };

  const renderPersonaForm = () => (
    <div className="space-y-4 p-4 max-h-[400px] overflow-y-auto">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Full Name
        </label>
        <input
          type="text"
          value={visualData.fullName || ""}
          onChange={(e) => handleVisualChange("fullName", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g., Dr. Alice Johnson"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          First Name
        </label>
        <input
          type="text"
          value={visualData.firstName || ""}
          onChange={(e) => handleVisualChange("firstName", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g., Alice"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={visualData.description || ""}
          onChange={(e) => handleVisualChange("description", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          placeholder="Describe the persona..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Personality
        </label>
        <textarea
          value={visualData.personality || ""}
          onChange={(e) => handleVisualChange("personality", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          placeholder="Describe personality traits..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject Pronoun
          </label>
          <input
            type="text"
            value={visualData.subjectPronoum || ""}
            onChange={(e) =>
              handleVisualChange("subjectPronoum", e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., she, he, they"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Object Pronoun
          </label>
          <input
            type="text"
            value={visualData.objectPronoum || ""}
            onChange={(e) =>
              handleVisualChange("objectPronoum", e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., her, him, them"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Possessive Pronoun
          </label>
          <input
            type="text"
            value={visualData.possesivePronoum || ""}
            onChange={(e) =>
              handleVisualChange("possesivePronoum", e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., hers, his, theirs"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Possessive Adjective
          </label>
          <input
            type="text"
            value={visualData.possesiveAdjective || ""}
            onChange={(e) =>
              handleVisualChange("possesiveAdjective", e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., her, his, their"
          />
        </div>
      </div>
    </div>
  );

  const renderProblemForm = () => (
    <div className="space-y-4 p-4 max-h-[400px] overflow-y-auto">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={visualData.description || ""}
          onChange={(e) => handleVisualChange("description", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          placeholder="Describe the problem..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Persona Background
        </label>
        <textarea
          value={visualData.personaBackground || ""}
          onChange={(e) =>
            handleVisualChange("personaBackground", e.target.value)
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={2}
          placeholder="Background context for the persona..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Details
        </label>
        <textarea
          value={visualData.details || ""}
          onChange={(e) => handleVisualChange("details", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          placeholder="Additional details..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Solution
        </label>
        <textarea
          value={visualData.solution || ""}
          onChange={(e) => handleVisualChange("solution", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          placeholder="Expected solution..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Solution Format
        </label>
        <select
          value={visualData.solutionFormat || "text"}
          onChange={(e) => handleVisualChange("solutionFormat", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="text">Plain Text</option>
          <option value="mermaid">Mermaid Diagram</option>
          <option value="yaml">YAML</option>
          <option value="markdown">Markdown</option>
          <option value="html">HTML</option>
          <option value="json">JSON</option>
          <option value="xml">XML</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Process
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={
                visualData.process?.includes("requirements-elicitation") ||
                false
              }
              onChange={(e) => {
                const newProcess = visualData.process || [];
                if (e.target.checked) {
                  handleVisualChange("process", [
                    ...newProcess,
                    "requirements-elicitation",
                  ]);
                } else {
                  handleVisualChange(
                    "process",
                    newProcess.filter(
                      (p: string) => p !== "requirements-elicitation"
                    )
                  );
                }
              }}
              className="mr-2"
            />
            Requirements Elicitation
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={visualData.process?.includes("game") || false}
              onChange={(e) => {
                const newProcess = visualData.process || [];
                if (e.target.checked) {
                  handleVisualChange("process", [...newProcess, "game"]);
                } else {
                  handleVisualChange(
                    "process",
                    newProcess.filter((p: string) => p !== "game")
                  );
                }
              }}
              className="mr-2"
            />
            Game
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6 shadow-sm">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b">
          <h4 className="text-lg font-semibold text-gray-900">
            Edit {resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}
          </h4>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">
              API Version:
            </label>
            <select
              value={currentApiVersion}
              onChange={(e) => setCurrentApiVersion(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="v1">v1</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <Tabs.Root
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "visual" | "code")}
        >
          <Tabs.List className="flex border-b border-gray-200">
            <Tabs.Trigger
              value="visual"
              className="px-4 py-2 text-sm font-medium text-gray-700 border-b-2 border-transparent hover:text-gray-900 hover:border-gray-300 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 transition-colors"
            >
              Visual Editor
            </Tabs.Trigger>
            <Tabs.Trigger
              value="code"
              className="px-4 py-2 text-sm font-medium text-gray-700 border-b-2 border-transparent hover:text-gray-900 hover:border-gray-300 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 transition-colors"
            >
              Code Editor
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="visual" className="pt-4">
            {resourceType === "persona"
              ? renderPersonaForm()
              : renderProblemForm()}
          </Tabs.Content>

          <Tabs.Content value="code" className="pt-4">
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <Editor
                height="400px"
                language="json"
                theme="vs-light"
                value={jsonContent}
                onChange={handleJsonChange}
                options={{
                  readOnly: false,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 12,
                  lineNumbers: "on",
                  glyphMargin: false,
                  folding: true,
                  lineDecorationsWidth: 0,
                  lineNumbersMinChars: 3,
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
            {jsonError && (
              <div className="mt-2 text-sm text-red-600">{jsonError}</div>
            )}
          </Tabs.Content>
        </Tabs.Root>

        {/* Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={jsonError !== null}
            className={`px-4 py-2 rounded-lg transition-colors text-sm ${
              jsonError
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
