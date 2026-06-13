import type React from "react";
import { useState, useEffect, lazy, Suspense, memo, useRef } from "react";
import type { Leia } from "../models/Leia";
import { useAuth } from "../context/useAuth";
import {
  ArrowPathIcon,
  ChevronDownIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Avatar } from "./shared/Avatar";
import {
  buildLeiaInfographicPaths,
  buildOriginalAvatarPath,
  buildStoredImageCandidateSources,
} from "../lib/avatar";
import InfographicViewer, {
  type InfographicViewerHandle,
} from "./InfographicViewer";
import api from "../lib/axios";
import { toast } from "react-toastify";

// Lazy load SyntaxHighlighter with Prism
const SyntaxHighlighter = lazy(() =>
  import("react-syntax-highlighter").then((module) => ({
    default: module.Prism,
  })),
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

type AvatarRegenerationTarget = "leias" | "problems" | "personas";
type InfographicRegenerationTarget = "infographic" | "infographicSolution";
type RegenerationTarget =
  | AvatarRegenerationTarget
  | InfographicRegenerationTarget;
type ViewMode = "problem" | "persona" | "behaviour" | "infographics";

const InfographicImage: React.FC<{
  title: string;
  description: string;
  src?: string | null;
  candidateSources: string[];
}> = ({ title, description, src, candidateSources }) => {
  const viewerRef = useRef<InfographicViewerHandle | null>(null);
  const sources = buildStoredImageCandidateSources(src, ...candidateSources);
  const hasSource = sources.length > 0;
  const [thumbnailIndex, setThumbnailIndex] = useState(0);

  if (!hasSource) {
    return null;
  }

  const thumbnailSrc = sources[thumbnailIndex] || sources[0];

  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <button
        type="button"
        onClick={() => viewerRef.current?.open()}
        className="flex h-24 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50"
        title={`Open ${title}`}
      >
        <img
          src={thumbnailSrc}
          alt={title}
          className="h-full w-full object-contain"
          onError={() => {
            setThumbnailIndex((previousIndex) => {
              const nextIndex = previousIndex + 1;
              return nextIndex < sources.length ? nextIndex : previousIndex;
            });
          }}
        />
      </button>
      <div className="min-w-0 flex-1">
        <h4 className="text-md font-medium text-gray-900">{title}</h4>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => viewerRef.current?.open()}
        className="inline-flex flex-shrink-0 items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Open viewer
      </button>
      <InfographicViewer
        ref={viewerRef}
        candidateSources={sources}
        title={title}
        hidden
      />
    </div>
  );
};

export const LeiaViewModal: React.FC<LeiaViewModalProps> = memo(
  ({ leia, isOpen, onClose }) => {
    const [viewMode, setViewMode] = useState<ViewMode>("problem");
    const [displayLeia, setDisplayLeia] = useState<Leia | null>(leia);
    const [isRegenerateMenuOpen, setIsRegenerateMenuOpen] = useState(false);
    const [regeneratingTarget, setRegeneratingTarget] =
      useState<RegenerationTarget | null>(null);
    const { user } = useAuth();

    useEffect(() => {
      if (leia?.id) {
        setViewMode("problem");
        setDisplayLeia(leia);
        setIsRegenerateMenuOpen(false);
      }
    }, [leia?.id]);

    const getTargetId = (target: AvatarRegenerationTarget) => {
      if (!displayLeia) return null;
      if (target === "leias") return displayLeia.id;
      if (target === "problems") return displayLeia.spec?.problem?.id;
      return displayLeia.spec?.persona?.id;
    };

    const refreshAvatar = (avatar?: string) => {
      if (!avatar) return "";
      const separator = avatar.includes("?") ? "&" : "?";
      return `${avatar}${separator}t=${Date.now()}`;
    };

    const refreshStoredImage = refreshAvatar;
    const infographicCandidates = buildLeiaInfographicPaths(
      displayLeia?.id,
      "infographic",
    );
    const infographicSolutionCandidates = buildLeiaInfographicPaths(
      displayLeia?.id,
      "infographicSolution",
    );

    const handleRegenerateAvatar = async (
      target: AvatarRegenerationTarget,
    ) => {
      const targetId = getTargetId(target);
      if (!targetId) {
        toast.error("Could not find the selected resource", {
          position: "bottom-right",
          autoClose: 3000,
        });
        return;
      }

      setRegeneratingTarget(target);
      setIsRegenerateMenuOpen(false);

      try {
        const response = await api.post(
          `/api/v1/images/${target}/${targetId}/generate`,
        );
        const avatar = refreshAvatar(response.data?.avatar);

        setDisplayLeia((currentLeia) => {
          if (!currentLeia || !avatar) return currentLeia;

          if (target === "leias") {
            return {
              ...currentLeia,
              spec: { ...currentLeia.spec, avatar },
            };
          }

          if (target === "problems") {
            return {
              ...currentLeia,
              spec: {
                ...currentLeia.spec,
                problem: {
                  ...currentLeia.spec.problem,
                  spec: {
                    ...currentLeia.spec.problem.spec,
                    avatar,
                  },
                },
              },
            };
          }

          return {
            ...currentLeia,
            spec: {
              ...currentLeia.spec,
              persona: {
                ...currentLeia.spec.persona,
                spec: {
                  ...currentLeia.spec.persona.spec,
                  avatar,
                },
              },
            },
          };
        });

        toast.success("Image regenerated successfully", {
          position: "bottom-right",
          autoClose: 3000,
        });
      } catch (error) {
        let errorMessage = "Could not regenerate the image";

        if (error && typeof error === "object" && "response" in error) {
          const axiosError = error as {
            response?: { data?: { message?: string } };
          };
          errorMessage = axiosError.response?.data?.message || errorMessage;
        }

        toast.error(errorMessage, {
          position: "bottom-right",
          autoClose: 3000,
        });
      } finally {
        setRegeneratingTarget(null);
      }
    };

    const handleRegenerateInfographic = async (
      target: InfographicRegenerationTarget,
    ) => {
      if (!displayLeia?.id) {
        toast.error("Could not find the selected LEIA", {
          position: "bottom-right",
          autoClose: 3000,
        });
        return;
      }

      const path =
        target === "infographic" ? "infographic" : "infographic-solution";

      setRegeneratingTarget(target);
      setIsRegenerateMenuOpen(false);

      try {
        const response = await api.post(
          `/api/v1/images/leias/${displayLeia.id}/${path}/generate`,
        );
        const image = refreshStoredImage(response.data?.[target]);

        setDisplayLeia((currentLeia) => {
          if (!currentLeia || !image) return currentLeia;

          return {
            ...currentLeia,
            spec: {
              ...currentLeia.spec,
              [target]: image,
            },
          };
        });

        toast.success("Image regenerated successfully", {
          position: "bottom-right",
          autoClose: 3000,
        });
      } catch (error) {
        let errorMessage = "Could not regenerate the image";

        if (error && typeof error === "object" && "response" in error) {
          const axiosError = error as {
            response?: { data?: { message?: string } };
          };
          errorMessage = axiosError.response?.data?.message || errorMessage;
        }

        toast.error(errorMessage, {
          position: "bottom-right",
          autoClose: 3000,
        });
      } finally {
        setRegeneratingTarget(null);
      }
    };

    if (!isOpen || !displayLeia) return null;

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
                {displayLeia.metadata?.name || `LEIA ${displayLeia.id}`}
              </h2>
              <p className="text-sm text-gray-500 mt-1">View LEIA content</p>
            </div>
            <div className="flex items-center gap-2">
              {user?.role === "admin" && (
                <div className="relative">
                  <button
                    onClick={() =>
                      setIsRegenerateMenuOpen((isOpen) => !isOpen)
                    }
                    disabled={regeneratingTarget !== null}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    <ArrowPathIcon
                      className={`h-4 w-4 ${
                        regeneratingTarget ? "animate-spin" : ""
                      }`}
                    />
                    Regenerate
                    <ChevronDownIcon className="h-4 w-4" />
                  </button>

                  {isRegenerateMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg z-10 overflow-hidden">
                      {[
                        { label: "LEIA", target: "leias" as const },
                        { label: "Problem", target: "problems" as const },
                        { label: "Persona", target: "personas" as const },
                      ].map((option) => (
                        <button
                          key={option.target}
                          onClick={() => handleRegenerateAvatar(option.target)}
                          className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                          {option.label}
                        </button>
                      ))}
                      <div className="border-t border-gray-100" />
                      {[
                        {
                          label: "Infographic",
                          target: "infographic" as const,
                        },
                        {
                          label: "Infographic with solution",
                          target: "infographicSolution" as const,
                        },
                      ].map((option) => (
                        <button
                          key={option.target}
                          onClick={() =>
                            handleRegenerateInfographic(option.target)
                          }
                          className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
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
            <button
              onClick={() => setViewMode("infographics")}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                viewMode === "infographics"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Infographics
            </button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            {viewMode === "problem" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={displayLeia.spec?.problem?.spec?.avatar}
                    fallbackSrc={buildOriginalAvatarPath(
                      "problems",
                      displayLeia.spec?.problem?.id,
                    )}
                    alt={`${displayLeia.spec?.problem?.metadata?.name || "Problem"} avatar`}
                    label={
                      displayLeia.spec?.problem?.metadata?.name || "Problem"
                    }
                    size="lg"
                  />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {displayLeia.spec?.problem?.metadata?.name || "Problem"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      v{displayLeia.spec?.problem?.metadata?.version || "N/A"}
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Problem Description
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-700 leading-relaxed">
                      {displayLeia.spec?.problem?.spec?.description ||
                        "No description available"}
                    </p>
                  </div>
                </div>
                {displayLeia.spec?.problem?.spec?.details && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Details
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {displayLeia.spec.problem.spec.details}
                      </p>
                    </div>
                  </div>
                )}
                {displayLeia.spec?.problem?.spec?.solution && (
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
                          code={displayLeia.spec.problem.spec.solution}
                          language={displayLeia.spec.problem.spec.solutionFormat}
                        />
                      </Suspense>
                    </div>
                  </div>
                )}{" "}
                {displayLeia.spec?.problem?.spec?.initialSolution && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Initial Solution
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
                          code={displayLeia.spec.problem.spec.initialSolution}
                          language={displayLeia.spec.problem.spec.solutionFormat}
                        />
                      </Suspense>
                    </div>
                  </div>
                )}{" "}
                {displayLeia.spec?.problem?.spec?.evaluationPrompt && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Evaluation Prompt
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {displayLeia.spec.problem.spec.evaluationPrompt}
                      </p>
                    </div>
                  </div>
                )}
                {displayLeia.spec?.problem?.spec?.process && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Process
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <ol className="list-decimal list-inside space-y-1">
                        {displayLeia.spec.problem.spec.process.map(
                          (step, index) => (
                            <li key={index} className="text-gray-700">
                              {step}
                            </li>
                          ),
                        )}
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            )}

            {viewMode === "persona" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={displayLeia.spec?.persona?.spec?.avatar}
                    fallbackSrc={buildOriginalAvatarPath(
                      "personas",
                      displayLeia.spec?.persona?.id,
                    )}
                    alt={`${displayLeia.spec?.persona?.spec?.fullName || "Persona"} avatar`}
                    label={
                      displayLeia.spec?.persona?.spec?.fullName || "Persona"
                    }
                    size="lg"
                  />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {displayLeia.spec?.persona?.spec?.fullName ||
                        displayLeia.spec?.persona?.metadata?.name ||
                        "Persona"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      v{displayLeia.spec?.persona?.metadata?.version || "N/A"}
                    </p>
                  </div>
                </div>
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
                        {displayLeia.spec?.persona?.spec?.fullName || "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">
                        First Name:
                      </span>
                      <p className="text-gray-900">
                        {displayLeia.spec?.persona?.spec?.firstName || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {displayLeia.spec?.persona?.spec?.description && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Description
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700 leading-relaxed">
                        {displayLeia.spec.persona.spec.description}
                      </p>
                    </div>
                  </div>
                )}

                {displayLeia.spec?.persona?.spec?.personality && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Personality
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {displayLeia.spec.persona.spec.personality}
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
                        {displayLeia.spec?.persona?.spec?.subjectPronoum ||
                          "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Object:</span>
                      <span className="ml-2 text-gray-900">
                        {displayLeia.spec?.persona?.spec?.objectPronoum ||
                          "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">
                        Possessive:
                      </span>
                      <span className="ml-2 text-gray-900">
                        {displayLeia.spec?.persona?.spec?.possesivePronoum ||
                          "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">
                        Possessive Adj:
                      </span>
                      <span className="ml-2 text-gray-900">
                        {displayLeia.spec?.persona?.spec?.possesiveAdjective ||
                          "N/A"}
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
                      {displayLeia.spec?.behaviour?.spec?.description ||
                        "No description available"}
                    </p>
                  </div>
                </div>

                {displayLeia.spec?.behaviour?.spec?.role && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Role
                    </h4>
                    <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                      {displayLeia.spec.behaviour.spec.role}
                    </p>
                  </div>
                )}

                {displayLeia.spec?.behaviour?.spec?.process && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Process
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <ol className="list-decimal list-inside space-y-2">
                        {displayLeia.spec.behaviour.spec.process.map(
                          (step, index) => (
                            <li key={index} className="text-gray-700">
                              {step}
                            </li>
                          ),
                        )}
                      </ol>
                    </div>
                  </div>
                )}

                {displayLeia.spec?.behaviour?.spec?.tooltip && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Initial Tooltip
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {displayLeia.spec.behaviour.spec.tooltip}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {viewMode === "infographics" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Infographics
                  </h3>
                  {!displayLeia.spec?.infographic &&
                    !displayLeia.spec?.infographicSolution && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-gray-600">
                          No infographics available for this LEIA.
                        </p>
                      </div>
                    )}
                </div>
                <InfographicImage
                  title="Infographic"
                  description="Student-facing version without the solution."
                  src={displayLeia.spec?.infographic}
                  candidateSources={infographicCandidates}
                />
                <InfographicImage
                  title="Infographic with solution"
                  description="Instructor version including the expected solution."
                  src={displayLeia.spec?.infographicSolution}
                  candidateSources={infographicSolutionCandidates}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);
