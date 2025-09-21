import { useState, useRef, useEffect } from "react";
import { Editor, loader } from "@monaco-editor/react";
import type { User } from "../models/Leia";

// Ensure YAML language support is loaded
loader.init().then((monaco) => {
  // Register YAML language if not already registered
  if (!monaco.languages.getLanguages().find((lang) => lang.id === "yaml")) {
    monaco.languages.register({ id: "yaml" });
  }
});

interface LeiaCardProps {
  title: string;
  description: string;
  version: string;
  selected?: boolean;
  yaml?: string;
  onClick?: () => void;
  user?: User;
  isPublished?: boolean;
}

export default function LeiaCard({
  title,
  description,
  version,
  selected = false,
  yaml,
  onClick,
  user,
  isPublished = false,
}: LeiaCardProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showPopup && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setPopoverPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 8,
      });
    }
  }, [showPopup]);

  return (
    <div
      ref={cardRef}
      className="relative"
      onMouseEnter={() => setShowPopup(true)}
      onMouseLeave={() => setShowPopup(false)}
    >
      <div
        className={`p-4 rounded-lg cursor-pointer transition-colors ${
          selected
            ? "bg-blue-50 border-2 border-blue-500"
            : "border border-gray-200 hover:border-blue-300"
        }`}
        onClick={onClick}
      >
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-gray-100 text-xs font-medium text-gray-600 rounded-full">
              v{version}
            </span>
            {user && (
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  isPublished
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {isPublished ? "Published" : "Unpublished"}
              </span>
            )}
          </div>
        </div>
        {/* User information */}
        {user && user.email && user.role ? (
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
            <span>{user.email}</span>
            <span className="flex items-center gap-1">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  user.role === "admin"
                    ? "bg-purple-500"
                    : "bg-green-500"
                }`}
              ></span>
              {user.role === "admin" ? "Administrator" : "Instructor"}
            </span>
          </div>
        ) : null}
        <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
          {description}
        </p>
        {selected && (
          <div className="mt-3 flex items-center text-blue-600 text-sm font-medium">
            <svg
              className="w-4 h-4 mr-1"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Seleccionado
          </div>
        )}
      </div>

      {/* Popup de YAML con Monaco Editor */}
      {showPopup && yaml && (
        <div
          className="fixed z-[9999] transition-opacity duration-200"
          style={{
            top: popoverPosition.top,
            left: popoverPosition.left,
            transform: "translateY(-50%)",
          }}
        >
          <div className="bg-gray-900 rounded-lg shadow-xl p-2 w-[500px] h-[300px]">
            <Editor
              height="100%"
              language="yaml"
              theme="vs-dark"
              value={yaml}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: "off",
                folding: false,
                lineDecorationsWidth: 0,
                lineNumbersMinChars: 0,
                renderLineHighlight: "none",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                automaticLayout: true,
                contextmenu: false,
                hover: { enabled: false },
                links: false,
                occurrencesHighlight: "off",
                renderValidationDecorations: "off",
                selectionHighlight: false,
              }}
              beforeMount={(monaco) => {
                // Ensure YAML language is available
                if (
                  !monaco.languages
                    .getLanguages()
                    .find((lang) => lang.id === "yaml")
                ) {
                  monaco.languages.register({ id: "yaml" });
                }
              }}
            />
          </div>
          <div
            className="absolute left-0 top-1/2 -ml-2 w-0 h-0 
            border-t-[6px] border-r-[6px] border-b-[6px] 
            border-t-transparent border-r-gray-900 border-b-transparent"
            style={{ transform: "translateY(-50%)" }}
          ></div>
        </div>
      )}
    </div>
  );
};
