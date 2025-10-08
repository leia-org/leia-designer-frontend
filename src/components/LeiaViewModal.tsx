import type React from "react";
import { useState, useEffect, lazy, Suspense, memo } from "react";
import type { Leia } from "../models/Leia";
import { useAuth } from "../context/useAuth";
import { XMarkIcon } from "@heroicons/react/24/outline";

// Lazy load SyntaxHighlighter with Prism
const SyntaxHighlighter = lazy(() =>
  import("react-syntax-highlighter").then((module) => ({
    default: module.Prism,
  }))
);

const LazyCodeBlock: React.FC<{ code: string; language: string }> = ({
  code,
  language,
}) => {
  const [prismStyle, setPrismStyle] = useState<object | null>(null);

  useEffect(() => {
    import("react-syntax-highlighter/dist/esm/styles/prism").then((styles) => {
      setPrismStyle(styles.oneLight);
    });
  }, []);

  if (!prismStyle) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  return (
    <SyntaxHighlighter
      language={language}
      style={prismStyle}
      showLineNumbers={true}
      wrapLines={true}
      customStyle={{
        borderRadius: "8px",
        fontSize: "14px",
        lineHeight: "1.5",
      }}
    >
      {code}
    </SyntaxHighlighter>
  );
};

interface LeiaViewModalProps {
  leia: Leia | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LeiaViewModal: React.FC<LeiaViewModalProps> = memo(
  ({ leia, isOpen, onClose }) => {
    const [viewMode, setViewMode] = useState<
      "problem" | "persona" | "behaviour"
    >("problem");
    const { user } = useAuth();

    useEffect(() => {
      if (leia?.id) {
        setViewMode("problem");
      }
    }, [leia?.id]);

    if (!isOpen || !leia) return null;

    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {leia.metadata?.name || `LEIA ${leia.id}`}
              </h2>
              <p className="text-sm text-gray-500 mt-1">View LEIA content</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="flex border-b border-gray-200 flex-shrink-0">
            <button
              onClick={() => setViewMode("problem")}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                viewMode === "problem"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Problem
            </button>
            <button
              onClick={() => setViewMode("persona")}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                viewMode === "persona"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Persona
            </button>
            {user?.role === "admin" && (
              <button
                onClick={() => setViewMode("behaviour")}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  viewMode === "behaviour"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Behaviour
              </button>
            )}
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            {viewMode === "problem" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Problem Description
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-700 leading-relaxed">
                      {leia.spec?.problem?.spec?.description ||
                        "No description available"}
                    </p>
                  </div>
                </div>
                {leia.spec?.problem?.spec?.details && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Details
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {leia.spec.problem.spec.details}
                      </p>
                    </div>
                  </div>
                )}
                {leia.spec?.problem?.spec?.solution && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Solution
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <Suspense
                        fallback={
                          <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            <span className="ml-2 text-sm text-gray-500">
                              Loading syntax highlighter...
                            </span>
                          </div>
                        }
                      >
                        <LazyCodeBlock
                          code={leia.spec.problem.spec.solution}
                          language={leia.spec.problem.spec.solutionFormat}
                        />
                      </Suspense>
                    </div>
                  </div>
                )}{" "}
                {leia.spec?.problem?.spec?.process && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Process
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <ol className="list-decimal list-inside space-y-1">
                        {leia.spec.problem.spec.process.map((step, index) => (
                          <li key={index} className="text-gray-700">
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            )}

            {viewMode === "persona" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Persona Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium text-gray-600">
                        Full Name:
                      </span>
                      <p className="text-gray-900">
                        {leia.spec?.persona?.spec?.fullName || "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">
                        First Name:
                      </span>
                      <p className="text-gray-900">
                        {leia.spec?.persona?.spec?.firstName || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {leia.spec?.persona?.spec?.description && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Description
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700 leading-relaxed">
                        {leia.spec.persona.spec.description}
                      </p>
                    </div>
                  </div>
                )}

                {leia.spec?.persona?.spec?.personality && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Personality
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {leia.spec.persona.spec.personality}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-2">
                    Pronouns
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">
                        Subject:
                      </span>
                      <span className="ml-2 text-gray-900">
                        {leia.spec?.persona?.spec?.subjectPronoum || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Object:</span>
                      <span className="ml-2 text-gray-900">
                        {leia.spec?.persona?.spec?.objectPronoum || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">
                        Possessive:
                      </span>
                      <span className="ml-2 text-gray-900">
                        {leia.spec?.persona?.spec?.possesivePronoum || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">
                        Possessive Adj:
                      </span>
                      <span className="ml-2 text-gray-900">
                        {leia.spec?.persona?.spec?.possesiveAdjective || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {viewMode === "behaviour" && user?.role === "admin" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Behaviour Configuration
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-700 leading-relaxed">
                      {leia.spec?.behaviour?.spec?.description ||
                        "No description available"}
                    </p>
                  </div>
                </div>

                {leia.spec?.behaviour?.spec?.role && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Role
                    </h4>
                    <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                      {leia.spec.behaviour.spec.role}
                    </p>
                  </div>
                )}

                {leia.spec?.behaviour?.spec?.process && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Process Steps
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <ol className="list-decimal list-inside space-y-2">
                        {leia.spec.behaviour.spec.process.map((step, index) => (
                          <li key={index} className="text-gray-700">
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);
