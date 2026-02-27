import React, { useEffect, memo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";

interface FormatEditorProps {
  value: string;
  onChange: (value: string) => void;
  format: string;
  onError?: (error: string | null) => void;
}

const getMonacoLanguage = (format: string): string => {
  const languageMap: Record<string, string> = {
    text: "plaintext",
    mermaid: "plaintext",
    yaml: "yaml",
    markdown: "markdown",
    html: "html",
    json: "json",
    xml: "xml",
  };
  return languageMap[format] || "plaintext";
};

const getEditorConfig = (format: string) => {
  const baseConfig = {
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 14,
    lineNumbers: "on" as const,
    automaticLayout: true,
    wordWrap: "on" as const,
  };

  switch (format) {
    case "json":
      return {
        ...baseConfig,
        formatOnPaste: true,
        formatOnType: true,
        autoIndent: "full" as const,
      };
    case "yaml":
      return {
        ...baseConfig,
        insertSpaces: true,
        tabSize: 2,
        detectIndentation: true,
      };
    case "xml":
    case "html":
      return {
        ...baseConfig,
        formatOnPaste: true,
        autoIndent: "full" as const,
      };
    default:
      return baseConfig;
  }
};

const validators: Record<string, (value: string) => string | null> = {
  json: (value: string) => {
    if (!value.trim()) return null;
    try {
      JSON.parse(value);
      return null;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown JSON error";
      return `Invalid JSON: ${message}`;
    }
  },
  yaml: (value: string) => {
    if (!value.trim()) return null;
    if (value.includes("\t")) {
      return "YAML does not support tabs, use spaces for indentation";
    }
    return null;
  },
  xml: (value: string) => {
    if (!value.trim()) return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(value, "text/xml");
      const error = doc.querySelector("parsererror");
      if (error) {
        return `Invalid XML: ${error.textContent}`;
      }
      return null;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown XML error";
      return `Invalid XML: ${message}`;
    }
  },
  html: (value: string) => {
    if (!value.trim()) return null;
    try {
      const parser = new DOMParser();
      parser.parseFromString(value, "text/html");
      return null;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown HTML error";
      return `Invalid HTML: ${message}`;
    }
  },
};

export const FormatEditor: React.FC<FormatEditorProps> = memo(
  ({ value, onChange, format, onError }) => {
    const [internalError, setInternalError] = useState<string | null>(null);
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<any>(null);

    useEffect(() => {
      const validator = validators[format];
      const error = validator ? validator(value) : null;
      setInternalError(error);
      onError?.(error);
    }, [value, format, onError]);

    useEffect(() => {
      const monaco = monacoRef.current;
      const editorInstance = editorRef.current;
      if (!monaco || !editorInstance) return;

      const model = editorInstance.getModel();
      if (!model) return;

      if (!internalError) {
        monaco.editor.setModelMarkers(model, "format-validation", []);
        return;
      }

      const lines = model.getLinesContent();
      const lineCount = lines.length || 1;
      const lastLine = lineCount;
      const lastCol = (lines[lineCount - 1]?.length || 0) + 1;

      monaco.editor.setModelMarkers(model, "format-validation", [
        {
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: lastLine,
          endColumn: lastCol,
          message: internalError,
          severity: monaco.MarkerSeverity.Error,
        },
      ]);
    }, [internalError]);

    const monacoLanguage = getMonacoLanguage(format);
    const editorConfig = getEditorConfig(format);

    return (
      <div className="h-full relative">
        <Editor
          value={value}
          onChange={(nextValue) => onChange(nextValue || "")}
          language={monacoLanguage}
          theme="vs-light"
          options={editorConfig}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;
          }}
        />
      </div>
    );
  }
);

FormatEditor.displayName = "FormatEditor";
