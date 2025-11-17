import React, { useState, useEffect, useMemo, useRef } from "react";
import { Editor } from "@monaco-editor/react";
import * as Tabs from "@radix-ui/react-tabs";
import type { Persona, Problem, Behaviour } from "../models/Leia";

type ResourceType = "persona" | "problem" | "behaviour";

type HighlightSegment = {
  text: string;
  highlight: boolean;
};

const splitPlaceholderSegments = (text: string): HighlightSegment[] => {
  const segments: HighlightSegment[] = [];
  if (!text) {
    return segments;
  }

  const regex = /\{\{[^}]+\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        highlight: false,
      });
    }

    segments.push({ text: match[0], highlight: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      highlight: false,
    });
  }

  return segments.length ? segments : [{ text, highlight: false }];
};

const HighlightableInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement>
> = ({ value, className = "", placeholder, ...rest }) => {
  const normalizedValue =
    value === undefined || value === null
      ? ""
      : Array.isArray(value)
      ? value.join(", ")
      : String(value);

  const segments = useMemo(
    () => splitPlaceholderSegments(normalizedValue),
    [normalizedValue]
  );
  const showPlaceholder = normalizedValue.length === 0;

  return (
    <div className="relative w-full">
      <input
        {...rest}
        value={normalizedValue}
        className={`${className} relative z-10 bg-transparent text-transparent caret-blue-600`}
        placeholder={placeholder}
      />
      <div
        className="pointer-events-none absolute inset-[3px] z-0 flex items-center px-3 py-2 text-gray-900 whitespace-pre break-words overflow-hidden rounded-md"
        aria-hidden="true"
        style={{ font: "inherit" }}
      >
        {showPlaceholder ? (
          placeholder ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : null
        ) : (
          segments.map((segment, index) =>
            segment.highlight ? (
              <span
                key={`placeholder-${index}`}
                className="rounded bg-purple-100 inline text-purple-700"
              >
                {segment.text}
              </span>
            ) : (
              <span key={`text-${index}`}>{segment.text}</span>
            )
          )
        )}
      </div>
    </div>
  );
};

const HighlightableTextarea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
> = ({ value, className = "", placeholder, onScroll, ...rest }) => {
  const normalizedValue =
    value === undefined || value === null ? "" : String(value);

  const segments = useMemo(
    () => splitPlaceholderSegments(normalizedValue),
    [normalizedValue]
  );
  const showPlaceholder = normalizedValue.length === 0;
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleScroll: React.UIEventHandler<HTMLTextAreaElement> = (event) => {
    if (overlayRef.current) {
      overlayRef.current.scrollTop = event.currentTarget.scrollTop;
      overlayRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }
    onScroll?.(event);
  };

  return (
    <div className="relative w-full">
      <textarea
        {...rest}
        value={normalizedValue}
        onScroll={handleScroll}
        className={`${className} relative z-10 bg-transparent text-transparent caret-blue-600`}
        placeholder={placeholder}
      />
      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-[3px] z-0 overflow-auto px-3 py-2 text-gray-900 whitespace-pre-wrap break-words rounded-md"
        aria-hidden="true"
        style={{ font: "inherit" }}
      >
        {showPlaceholder ? (
          placeholder ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : null
        ) : (
          segments.map((segment, index) =>
            segment.highlight ? (
              <span
                key={`placeholder-${index}`}
                className="rounded bg-purple-100 text-purple-700"
              >
                {segment.text}
              </span>
            ) : (
              <span key={`text-${index}`}>{segment.text}</span>
            )
          )
        )}
      </div>
    </div>
  );
};

interface ResourceEditorProps {
  resourceType: ResourceType;
  initialData?: Partial<Persona> | Partial<Problem> | Partial<Behaviour>;
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
  const processOptions = [
    { value: "requirements-elicitation", label: "Requirements Elicitation" },
    { value: "game", label: "Game" },
  ];

  // Inicializar datos
  useEffect(() => {
    if (initialData?.spec) {
      setVisualData(initialData.spec);
      setJsonContent(JSON.stringify(initialData.spec, null, 2));
    } else {
      const emptySpec = (() => {
        switch (resourceType) {
          case "persona":
            return {
              fullName: "",
              firstName: "",
              description: "",
              personality: "",
              subjectPronoum: "",
              objectPronoum: "",
              possesivePronoum: "",
              possesiveAdjective: "",
            };
          case "problem":
            return {
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
          case "behaviour":
            return {
              description: "",
              role: "",
              process: [],
            };
          default:
            return {};
        }
      })();
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
        <HighlightableInput
          type="text"
          value={visualData.fullName || ""}
          onChange={(e) => handleVisualChange("fullName", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          placeholder="e.g., Dr. Alice Johnson"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          First Name
        </label>
        <HighlightableInput
          type="text"
          value={visualData.firstName || ""}
          onChange={(e) => handleVisualChange("firstName", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          placeholder="e.g., Alice"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <HighlightableTextarea
          value={visualData.description || ""}
          onChange={(e) => handleVisualChange("description", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={3}
          placeholder="Describe the persona..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Personality
        </label>
        <HighlightableTextarea
          value={visualData.personality || ""}
          onChange={(e) => handleVisualChange("personality", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={3}
          placeholder="Describe personality traits..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject Pronoun
          </label>
          <HighlightableInput
            type="text"
            value={visualData.subjectPronoum || ""}
            onChange={(e) =>
              handleVisualChange("subjectPronoum", e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="e.g., she, he, they"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Object Pronoun
          </label>
          <HighlightableInput
            type="text"
            value={visualData.objectPronoum || ""}
            onChange={(e) =>
              handleVisualChange("objectPronoum", e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="e.g., her, him, them"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Possessive Pronoun
          </label>
          <HighlightableInput
            type="text"
            value={visualData.possesivePronoum || ""}
            onChange={(e) =>
              handleVisualChange("possesivePronoum", e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="e.g., hers, his, theirs"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Possessive Adjective
          </label>
          <HighlightableInput
            type="text"
            value={visualData.possesiveAdjective || ""}
            onChange={(e) =>
              handleVisualChange("possesiveAdjective", e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="e.g., her, his, their"
          />
        </div>
      </div>
    </div>
  );

  const renderProcessCheckboxes = () => (
    <div className="space-y-2">
      {processOptions.map(({ value, label }) => (
        <label className="flex items-center" key={value}>
          <input
            type="checkbox"
            checked={visualData.process?.includes(value) || false}
            onChange={(e) => {
              const newProcess = visualData.process || [];
              if (e.target.checked) {
                handleVisualChange("process", [...newProcess, value]);
              } else {
                handleVisualChange(
                  "process",
                  newProcess.filter((p: string) => p !== value)
                );
              }
            }}
            className="mr-2"
          />
          {label}
        </label>
      ))}
    </div>
  );

  const renderProblemForm = () => (
    <div className="space-y-4 p-4 max-h-[400px] overflow-y-auto">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <HighlightableTextarea
          value={visualData.description || ""}
          onChange={(e) => handleVisualChange("description", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={3}
          placeholder="Describe the problem..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Persona Background
        </label>
        <HighlightableTextarea
          value={visualData.personaBackground || ""}
          onChange={(e) =>
            handleVisualChange("personaBackground", e.target.value)
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={2}
          placeholder="Background context for the persona..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Details
        </label>
        <HighlightableTextarea
          value={visualData.details || ""}
          onChange={(e) => handleVisualChange("details", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={3}
          placeholder="Additional details..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Solution
        </label>
        <HighlightableTextarea
          value={visualData.solution || ""}
          onChange={(e) => handleVisualChange("solution", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
        {renderProcessCheckboxes()}
      </div>
    </div>
  );

  const renderBehaviourForm = () => (
    <div className="space-y-4 p-4 max-h-[400px] overflow-y-auto">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <HighlightableTextarea
          value={visualData.description || ""}
          onChange={(e) => handleVisualChange("description", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={3}
          placeholder="Describe the behaviour..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Role
        </label>
        <HighlightableInput
          type="text"
          value={visualData.role || ""}
          onChange={(e) => handleVisualChange("role", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          placeholder="e.g., Facilitator"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Process
        </label>
        {renderProcessCheckboxes()}
      </div>
    </div>
  );

  const renderForm = () => {
    switch (resourceType) {
      case "persona":
        return renderPersonaForm();
      case "problem":
        return renderProblemForm();
      case "behaviour":
        return renderBehaviourForm();
      default:
        return null;
    }
  };

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
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
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
            {renderForm()}
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
